# Agent Workflow

This file defines the workflow every agent must follow before starting any feature, fix, or refactor.

## Workflow Checklist

### 1. Pull Latest from Main

```bash
git checkout main
git pull origin main
```

### 2. Create a Branch

Use the naming convention:

| Prefix | Purpose |
|--------|---------|
| `feature/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `refactor/` | Code restructuring |

```bash
git checkout -b feature/<descriptive-name>
git push -u origin feature/<descriptive-name>
```

### 3. Explore Before Coding

Before writing code:
- Read relevant existing files to understand patterns
- Check `backend/routes/` for existing route patterns
- Check `frontend/src/pages/module/` for component patterns
- Check `models.py` if new database tables are needed

### 4. Create a TODO List

Use the `todowrite` tool to track all steps for the current task. Break the work into clear, ordered steps.

### 5. Follow Code Conventions

**Backend:**
- New routes go in `backend/routes/<name>.py` as a Blueprint
- Register the Blueprint in `app.py`
- Every endpoint requires `usertype` (query param for GET, body for POST/PUT/DELETE)
- Use `_can_create()`, `_can_update()`, `_can_delete()` pattern for access control
- Use `utils/response.py` helpers: `success_response()`, `error_response()`
- Use `utils/validation.py` helpers: `validate_required()`
- Log mutations with `utils/activity_logger.log_activity()`
- Use `utils/sorting.quick_sort()` for list endpoint sorting

**Frontend:**
- Pages go in `frontend/src/pages/module/` (or `dashboard/` for dashboards)
- Use `useAuth()` from context for user/role/branch info
- Use `can('create')`, `can('update')`, `can('delete')` for permission gates
- Fetch pattern: `fetch()` in `useEffect` with try/catch + `message.error()`
- Wrap page content in `<Card style={{ margin: 24 }}>`
- Use Ant Design components (`Table`, `Modal`, `Form`, `Button`, etc.)
- Register routes in `AppRouter.jsx` with `ProtectedRoute` + `allowedRoles`
- Add navigation items in `Sidebar.jsx`

### 6. Update THESIS-REQUIREMENTS.md

After completing a feature, update the thesis progress tracker to reflect the new status.

### 7. Lint Before Committing

```bash
cd frontend && npm run lint
```

Fix any errors in new/changed code before committing.

### 8. Commit Changes

```bash
git add <files>
git commit -m "type: description"
```

Commit message prefixes:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation change
- `refactor:` — code restructuring
- `revert:` — revert a previous change

### 9. Check for Conflicts

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main && echo "Up to date" || echo "Behind main — rebase needed"
```

If behind, rebase:
```bash
git rebase origin/main
# fix conflicts if any
```

### 10. Push to Remote

```bash
git push
```

### 11. Create a Pull Request

```bash
gh pr create --title "type: description" --body "## Summary\n- bullet points of changes" --base main
```

## Recommended Additions for Agent Awareness

### Project Architecture
- **Frontend**: React 19 + Ant Design 6 + Vite + react-router-dom 7
- **Backend**: Flask 3 + Flask-SQLAlchemy + SQLite
- **Auth**: usertype-based (1=Owner, 2=Manager, 3=Admin, 4=Staff)
- **State**: React Context (no Redux), persisted in localStorage
- **API format**: `{ success: bool, data: ..., message: ..., error: ... }`

### Key Files at a Glance
| File | Purpose |
|------|---------|
| `backend/app.py` | Flask app factory, blueprint registration |
| `backend/models.py` | All 11 SQLAlchemy models |
| `backend/routes/` | Per-module route blueprints |
| `backend/utils/` | Response, validation, sorting, activity logger |
| `frontend/src/context/AuthContext.jsx` | Auth state + permission checks |
| `frontend/src/routes/AppRouter.jsx` | All routes with role guards |
| `frontend/src/components/Sidebar.jsx` | Role-based navigation menus |
| `THESIS-REQUIREMENTS.md` | Progress tracker — update after each feature |
| `PLAN-feature-full-inventory-crud.md` | API endpoint documentation |
