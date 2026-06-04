# Vercel Full-Stack Migration — Design Spec

## Overview

Migrate the MCM Trading System to a fully Vercel-hosted deployment. The existing Flask backend runs as a Vercel Python serverless function, the Vite React frontend is served as static assets, and all data lives in Supabase (Postgres + Storage). No separate backend host. No local-filesystem dependency in production.

## Constraints

- Remote-only production: `DB_MODE=remote` enforced, Supabase Postgres required.
- Keep Flask (no backend framework rewrite).
- Same-origin `/api/*` routing preserved (no frontend `fetch` URL changes needed).
- Backup/restore via Supabase Storage instead of local `db/backups/`.
- Heavy maintenance ops (VACUUM, REINDEX) disabled in production.

## Target Architecture

```
Browser
  |
  |-- GET /, /assets/*, /login, /inventory, ... -> Vercel Static (frontend/dist/)
  |-- GET/POST/DELETE /api/*                    -> Vercel Python Function (Flask)
  |                                                  |
  |                                                  +-- Supabase Postgres (SQLAlchemy)
  |                                                  +-- Supabase Storage (backups)
  |                                                  +-- SMTP (Gmail) for password reset
```

- Frontend: Vite build output in `frontend/dist/` deployed as static files.
- Backend: Flask entrypoint at `api/index.py` (Vercel Python Function). All `/api/*` requests routed here via `vercel.json` rewrites.
- SPA fallback: all non-API, non-asset routes serve `index.html`.
- No CORS needed (same-origin).

## Data Flow

### Normal API flow (unchanged)
1. Browser calls `fetch('/api/...')`.
2. Vercel routes to Python function.
3. Flask blueprint handles request via SQLAlchemy.
4. Response returned to browser.

### Backup flow (changed)
| Operation | Before (local) | After (Supabase Storage) |
|-----------|---------------|--------------------------|
| Create   | Write JSON to `db/backups/` | Serialize tables, upload JSON to Storage bucket |
| List     | `os.listdir(db/backups/)` | `supabase.storage.from_('backups').list()` |
| Download | `send_from_directory(BACKUP_DIR)` | `supabase.storage.from_('backups').download()` |
| Restore  | `open(local_path)` then insert | Download from Storage, then insert |
| Delete   | `os.remove(local_path)` | `supabase.storage.from_('backups').remove()` |

### Password reset (changed)
- `reset_url` uses `APP_BASE_URL` env var instead of hardcoded `http://localhost:5173`.

## File Changes

| File | Action | Impact |
|------|--------|--------|
| `vercel.json` | Create | Routing config: static assets, API rewrites, SPA fallback |
| `api/index.py` | Create | Vercel Python entrypoint wrapping Flask app |
| `backend/app.py` | Modify | Remove `app.run()`, export `app` for serverless; production guard |
| `backend/config.py` | Modify | Add `APP_BASE_URL`, `IS_PRODUCTION`; enforce remote DB in prod |
| `.env.example` | Modify | Add `APP_BASE_URL`, `IS_PRODUCTION`, `SUPABASE_STORAGE_BUCKET` |
| `backend/utils/backup_storage.py` | Create | Supabase Storage abstraction for backup CRUD |
| `backend/routes/admin.py` | Modify | Replace filesystem backup ops with `backup_storage`; guard heavy ops in prod |
| `backend/routes/reports.py` | Modify | Replace filesystem backup listing with `backup_storage` |
| `backend/routes/auth.py` | Modify | Use `APP_BASE_URL` for password reset link |
| `frontend/src/pages/module/Maintenance.jsx` | Modify | Disable VACUUM/REINDEX buttons in production; show informative message |

## Production Guards

- **DB mode**: startup validation that `DB_MODE=remote` in production.
- **Required env vars**: `APP_BASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `DATABASE_URL`, `SECRET_KEY`, `MAIL_USERNAME`, `MAIL_PASSWORD` validated at startup in prod.
- **Risky operations blocked**: VACUUM, REINDEX, and VACUUM/REINDEX UI buttons disabled in production. Integrity check is kept (runs SQL queries only, no DDL).
- **Backup restore validation**: filename sanitization, size limits, transactional rollback on failure.

## Phased Rollout

### Phase 1: Platform Scaffolding
- Create `vercel.json`, `api/index.py`.
- Adjust `backend/app.py` to support both `app.run()` (local) and serverless export.
- Set up Vercel project, connect repo, deploy preview.

### Phase 2: Runtime Hardening
- Add `IS_PRODUCTION` and `APP_BASE_URL` to config.
- Add startup env validation.
- Add production guard helpers.
- Update `.env.example`.

### Phase 3: Backup Migration
- Create `backend/utils/backup_storage.py` with Supabase Storage CRUD.
- Refactor admin backup endpoints to use storage wrapper.
- Refactor reports backup listing to use storage wrapper.

### Phase 4: Frontend Production Guards
- Disable VACUUM/REINDEX UI in production.
- Apply same for any other unsupported prod actions.

### Phase 5: Verification
- Deploy preview to Vercel.
- Run smoke test checklist.
- Cut over to production.

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Serverless timeout on heavy endpoints | Block VACUUM/REINDEX in prod; integrity check kept (query-only) |
| Storage restore inconsistency | Transactional restore: delete all then re-insert; rollback on error |
| Missing env vars in prod | Fast-fail startup validation with clear error messages |
| Password reset links broken | `APP_BASE_URL` validated at startup in prod |
| Backup filename injection | Validate no `..` or `/` in filenames (already done, kept) |

## Validation Checklist

- [ ] `vite build` succeeds for frontend.
- [ ] `api/index.py` imports and returns Flask app without errors.
- [ ] `/api/health` returns `{"status": "ok"}` in preview.
- [ ] Login flow works end-to-end.
- [ ] Password reset email sends with correct `APP_BASE_URL` link.
- [ ] Inventory CRUD works (create, read product).
- [ ] Sales order creation works.
- [ ] Reports load with data.
- [ ] Backup: create, list, download, restore, delete all work via Supabase Storage.
- [ ] System info page loads in Maintenance tab.
- [ ] Integrity check runs and returns results.
- [ ] VACUUM and REINDEX endpoints return "disabled in production" error.
- [ ] VACUUM/REINDEX buttons in Maintenance UI show disabled state with explanation.
- [ ] SPA deep links load correctly (e.g., `/inventory`, `/sales` directly).
