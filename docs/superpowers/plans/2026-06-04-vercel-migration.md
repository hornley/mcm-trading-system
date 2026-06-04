# Vercel Full-Stack Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the MCM Trading System to full Vercel deployment with Flask serverless backend, Vite static frontend, Supabase Storage backups, and production-safe operation guards.

**Architecture:** Single Vercel project. Vite-built React app served as static assets from `frontend/dist/`. Flask backend runs as a Vercel Python Function at `api/index.py` handling all `/api/*` routes. `vercel.json` routes requests: non-API paths serve static files or fall back to `index.html` (SPA), `/api/*` paths hit the Python function.

**Tech Stack:** Vite + React (frontend), Flask + SQLAlchemy (backend serverless), Supabase Postgres + Supabase Storage, Vercel platform.

---

### Task 1: Create vercel.json

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write vercel.json with static serving, API rewrites, and SPA fallback**

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "pip install -r backend/requirements.txt",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/((?!assets/).*)", "destination": "/index.html" }
  ]
}
```

- `/api/*` is rewritten to the Python serverless function at `api/index.py`.
- `/assets/*` is served directly from `frontend/dist/assets/` (handled by Vercel's filesystem tier before rewrites).
- All other paths (`/login`, `/inventory`, etc.) fallback to `index.html` for SPA client-side routing.
- `pip install -r backend/requirements.txt` ensures the serverless function has all Python dependencies.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore: add Vercel deployment config with static + API routing"
```

---

### Task 2: Create Vercel Python Function Entrypoint

**Files:**
- Create: `api/index.py`
- Verify: `backend/app.py`, `backend/config.py`

- [ ] **Step 1: Create `api/index.py`**

```python
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import create_app

app = create_app()
```

- [ ] **Step 2: Verify the created file**

Run: `ls -la api/index.py`
Expected: file exists and is readable.

- [ ] **Step 3: Commit**

```bash
git add api/index.py
git commit -m "chore: add Vercel Python function entrypoint wrapping Flask app"
```

---

### Task 3: Adapt backend/app.py for Serverless

**Files:**
- Modify: `backend/app.py`

Changes needed:
1. Make `app` module-level variable so Vercel can import it.
2. Keep the `app.run()` block only for local dev (`__name__ == "__main__"` already does this, so no change there).
3. Move `create_app()` to return `app` at module scope if the file is being imported (not run directly).

- [ ] **Step 1: Read current `backend/app.py`**
  Already read; lines 86-89 contain the `if __name__ == "__main__":` block. The function `create_app()` is defined on line 35 but the `app` instance is never set at module level.

- [ ] **Step 2: Modify `backend/app.py` to export `app` at module level**

Replace lines 35-89 with:

```python
def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIST)
    app.config.from_object(Config)
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    CORS(app)
    mail.init_app(app)
    db.init_app(app)
    app.register_blueprint(account_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(locations_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(manual_bp)

    with app.app_context():
        from models import (
            User, Location, Category, Product, Order, OrderItem,
            Payment, Inventory, StockTransfer, StockAdjustment, ActivityLog,
            PasswordResetToken, StockRequest, ManualSection,
        )
        db.create_all()

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    @app.route("/assets/<path:filename>")
    def serve_assets(filename):
        return send_from_directory(os.path.join(FRONTEND_DIST, "assets"), filename)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
            return send_from_directory(FRONTEND_DIST, path)
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(FRONTEND_DIST, "index.html")
        return {"error": "Frontend not built. Run `cd frontend && npm run build` first."}, 200

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

- [ ] **Step 3: Test import works from Python**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && python -c "import sys; sys.path.insert(0, 'backend'); from app import app; print('Flask app imported successfully:', app.name)"
```
Expected: `Flask app imported successfully: app`

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "feat: expose Flask app at module level for Vercel serverless import"
```

---

### Task 4: Update backend/config.py with Production Guards

**Files:**
- Modify: `backend/config.py`

Changes:
1. Add `IS_PRODUCTION` flag derived from env.
2. Add `APP_BASE_URL` for password reset links.
3. Add a `validate_production()` function for fast-fail checks.

- [ ] **Step 1: Replace `backend/config.py`**

```python
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")

IS_PRODUCTION = os.getenv("IS_PRODUCTION", "").lower() == "true"
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173")

DB_MODE = os.getenv("DB_MODE", "remote")

if DB_MODE == "local":
    _db_path = os.path.join(BASE_DIR, "..", "db", "database.db")
    _uri = f"sqlite:///{os.path.abspath(_db_path)}"
else:
    _uri = os.getenv("DATABASE_URL")


def validate_production():
    if not IS_PRODUCTION:
        return
    if DB_MODE != "remote":
        raise RuntimeError("DB_MODE must be 'remote' in production (IS_PRODUCTION=true)")
    required = [
        "APP_BASE_URL", "SUPABASE_URL", "SUPABASE_KEY",
        "DATABASE_URL", "SECRET_KEY", "MAIL_USERNAME", "MAIL_PASSWORD",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing required env vars in production: {', '.join(missing)}")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = _uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False
```

- [ ] **Step 2: Verify the config imports correctly**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && python -c "import sys; sys.path.insert(0, 'backend'); from config import IS_PRODUCTION, APP_BASE_URL; print('IS_PRODUCTION:', IS_PRODUCTION); print('APP_BASE_URL:', APP_BASE_URL)"
```
Expected: `IS_PRODUCTION: False` and `APP_BASE_URL: http://localhost:5173`

- [ ] **Step 3: Commit**

```bash
git add backend/config.py
git commit -m "feat: add IS_PRODUCTION flag, APP_BASE_URL, and production env validation"
```

---

### Task 5: Call validate_production in app.py

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add validation call to `backend/app.py`**

Insert after the `load_dotenv` call (after line 5), add:

```python
from config import validate_production
validate_production()
```

So the top of `backend/app.py` becomes:

```python
import os
from dotenv import load_dotenv
from flask import Flask, send_from_directory

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from config import validate_production
validate_production()

DB_MODE = os.environ.get("DB_MODE", "remote")
```

- [ ] **Step 2: Test production validation fails with missing vars**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && IS_PRODUCTION=true python -c "
import os, sys
sys.path.insert(0, 'backend')
os.environ['IS_PRODUCTION'] = 'true'
os.environ['DB_MODE'] = 'remote'
try:
    from config import validate_production
    validate_production()
    print('UNEXPECTED: validation passed')
except RuntimeError as e:
    print('Expected runtime error:', e)
"
```
Expected: a `RuntimeError` about missing env vars.

- [ ] **Step 3: Test production validation passes with all vars set**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && python -c "
import os, sys
sys.path.insert(0, 'backend')
for k in ['IS_PRODUCTION','APP_BASE_URL','SUPABASE_URL','SUPABASE_KEY','DATABASE_URL','SECRET_KEY','MAIL_USERNAME','MAIL_PASSWORD','DB_MODE']:
    os.environ[k] = 'test-value'
os.environ['IS_PRODUCTION'] = 'true'
os.environ['DB_MODE'] = 'remote'
from config import validate_production
validate_production()
print('Validation passed correctly')
"
```
Expected: `Validation passed correctly`

- [ ] **Step 4: Commit**

```bash
git add backend/app.py
git commit -m "feat: call production env validation at app startup"
```

---

### Task 6: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace `.env.example` with production-ready template**

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
SECRET_KEY=<your-secret-key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<your-supabase-anon-key>
DB_MODE=remote            # "remote" (Supabase PostgreSQL) or "local" (offline SQLite)
IS_PRODUCTION=false       # set to "true" in Vercel env
APP_BASE_URL=https://your-app.vercel.app  # production URL for password reset links
MAIL_USERNAME=<gmail-address>
MAIL_PASSWORD=<gmail-app-password>
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add IS_PRODUCTION, APP_BASE_URL to env template"
```

---

### Task 7: Update Password Reset URL in auth.py

**Files:**
- Modify: `backend/routes/auth.py`

- [ ] **Step 1: Replace hardcoded localhost with APP_BASE_URL**

In `backend/routes/auth.py` line 114, replace:

```python
reset_url = f"http://localhost:5173/reset-password/{token}"
```

with:

```python
from config import APP_BASE_URL
reset_url = f"{APP_BASE_URL}/reset-password/{token}"
```

Move the import to the top of the file with other imports if preferred, or keep it local. To keep minimal changes, add the import right before the usage:

In line 114, replace the one line as shown above.

- [ ] **Step 2: Verify the change**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && python -c "
import sys; sys.path.insert(0, 'backend')
os.environ['APP_BASE_URL'] = 'https://test.example.com'
from config import APP_BASE_URL
print('APP_BASE_URL:', APP_BASE_URL)
"
```
Expected: `APP_BASE_URL: https://test.example.com`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/auth.py
git commit -m "fix: use APP_BASE_URL env var for password reset links instead of hardcoded localhost"
```

---

### Task 8: Create backup_storage.py — Supabase Storage Abstraction

**Files:**
- Create: `backend/utils/backup_storage.py`

This module abstracts backup CRUD over Supabase Storage. It replaces all local filesystem backup operations in `admin.py` and `reports.py`.

- [ ] **Step 1: Create `backend/utils/backup_storage.py`**

```python
import json
import os
from datetime import datetime
from supabase import create_client, Client

BUCKET_NAME = os.environ.get("SUPABASE_STORAGE_BUCKET", "backups")

_supabase_storage_client = None


def _get_client() -> Client:
    global _supabase_storage_client
    if _supabase_storage_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY required for backup storage")
        _supabase_storage_client = create_client(url, key)
    return _supabase_storage_client


def _ensure_bucket():
    client = _get_client()
    try:
        client.storage.create_bucket(BUCKET_NAME, options={"public": False})
    except Exception:
        pass


def create_backup(data: dict) -> dict:
    _ensure_bucket()
    client = _get_client()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    content = json.dumps(data, indent=2)
    client.storage.from_(BUCKET_NAME).upload(
        path=filename,
        file=content.encode("utf-8"),
        file_options={"content-type": "application/json"},
    )
    size = len(content.encode("utf-8"))
    return {"filename": filename, "size": size}


def list_backups():
    _ensure_bucket()
    client = _get_client()
    try:
        files = client.storage.from_(BUCKET_NAME).list()
    except Exception:
        return []
    if files is None:
        return []
    result = []
    for f in files:
        if f["name"].endswith(".json"):
            result.append({
                "filename": f["name"],
                "size": f.get("metadata", {}).get("size", 0),
                "created_at": f.get("created_at", ""),
            })
    return result


def download_backup(filename: str) -> bytes:
    client = _get_client()
    data = client.storage.from_(BUCKET_NAME).download(filename)
    return data


def download_backup_json(filename: str) -> dict:
    raw = download_backup(filename)
    return json.loads(raw.decode("utf-8"))


def delete_backup(filename: str):
    client = _get_client()
    client.storage.from_(BUCKET_NAME).remove([filename])


def backup_count():
    return len(list_backups())
```

- [ ] **Step 2: Verify the module imports without errors**

Run:
```bash
cd /Users/hornley/Projects/mcm-trading-system && python -c "
import sys; sys.path.insert(0, 'backend')
from utils.backup_storage import list_backups, backup_count
print('backup_count:', backup_count())
"
```
Expected: `backup_count: 0` (or an error about missing Supabase credentials if env vars not set — that's acceptable; the module syntax is valid).

- [ ] **Step 3: Commit**

```bash
git add backend/utils/backup_storage.py
git commit -m "feat: add Supabase Storage abstraction for backup CRUD operations"
```

---

### Task 9: Refactor admin.py Backup Endpoints to Use Supabase Storage

**Files:**
- Modify: `backend/routes/admin.py`

Replace the local-filesystem backup functions (lines 16-20, 89-95, 107-224) with calls to `backup_storage`. Also add production guards for VACUUM and REINDEX.

- [ ] **Step 1: Read `backend/routes/admin.py` to prepare targeted edits**

Already read; the sections to change are:
- Lines 16-20: `BACKUP_DIR` definition and `os.makedirs` call
- Lines 89-95: `_create_backup_file` function
- Lines 107-224: all backup route handlers (`list_backups`, `create_backup`, `restore_backup`, `delete_backup`, `download_backup`)
- Lines 264: `backup_count` in system info

- [ ] **Step 2: Replace imports and BACKUP_DIR (lines 1-20)**

Replace lines 1-20 with:

```python
import os
import json
import time
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from sqlalchemy.orm import aliased
from models import db, User, Product, Location, Category, Inventory
from models import StockTransfer, StockAdjustment, ActivityLog, Order, OrderItem, Payment
from models import PasswordResetToken, StockRequest, StoreReport, ManualSection
from utils.sorting import quick_sort
from utils.activity_logger import log_activity
from utils.backup_storage import (
    create_backup as storage_create_backup,
    list_backups as storage_list_backups,
    download_backup_json as storage_download_json,
    delete_backup as storage_delete_backup,
    backup_count as storage_backup_count,
)
from config import IS_PRODUCTION

admin_bp = Blueprint("admin", __name__)
```

- [ ] **Step 3: Remove the `_create_backup_file` function (line 89-95)**

Delete lines 89-95 entirely (the `_create_backup_file` function).

- [ ] **Step 4: Replace `list_backups` endpoint (lines 107-129)**

Replace the `list_backups` function (lines 107-129) with:

```python
@admin_bp.route("/api/admin/backups", methods=["GET"])
def list_backups():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")
        files = storage_list_backups()
        files = quick_sort(files, key=sort_by, order=sort_order)
        return jsonify({"success": True, "data": files})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 5: Replace `create_backup` endpoint (lines 132-151)**

Replace the `create_backup` function (lines 132-151) with:

```python
@admin_bp.route("/api/admin/backups", methods=["POST"])
def create_backup():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        backup_data = {}
        for name, model in BACKUP_MODELS:
            rows = model.query.all()
            backup_data[name] = [_serialise_row(r) for r in rows]

        result = storage_create_backup(backup_data)
        return jsonify({
            "success": True,
            "message": f"Backup created ({len(json.dumps(backup_data))} bytes)",
            "data": result,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 6: Replace `restore_backup` endpoint (lines 154-193)**

Replace the `restore_backup` function (lines 154-193) with:

```python
@admin_bp.route("/api/admin/backups/<filename>/restore", methods=["POST"])
def restore_backup(filename):
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        if ".." in filename or "/" in filename:
            return jsonify({"success": False, "error": "Invalid filename"}), 400

        backup_data = storage_download_json(filename)

        for name, model in reversed(BACKUP_MODELS):
            db.session.query(model).delete()
        db.session.commit()

        for name, model in BACKUP_MODELS:
            rows = backup_data.get(name, [])
            if name == "Manual Sections":
                rows = sorted(rows, key=lambda r: r.get("section_id", 0))
            for row_data in rows:
                for col in ("created_at", "updated_at", "order_date", "transfer_date",
                            "date", "timestamp"):
                    if col in row_data and isinstance(row_data[col], str):
                        try:
                            row_data[col] = datetime.fromisoformat(row_data[col].replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            pass
                instance = model(**row_data)
                db.session.add(instance)
        db.session.commit()

        return jsonify({"success": True, "message": "Database restored successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 7: Replace `delete_backup` endpoint (lines 196-210)**

Replace the `delete_backup` function (lines 196-210) with:

```python
@admin_bp.route("/api/admin/backups/<filename>", methods=["DELETE"])
def delete_backup(filename):
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        if ".." in filename or "/" in filename:
            return jsonify({"success": False, "error": "Invalid filename"}), 400
        storage_delete_backup(filename)
        return jsonify({"success": True, "message": "Backup deleted"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 8: Replace `download_backup` endpoint (lines 213-224)**

Replace the `download_backup` function (lines 213-224) with:

```python
@admin_bp.route("/api/admin/backups/<filename>/download", methods=["GET"])
def download_backup(filename):
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    if ".." in filename or "/" in filename:
        return jsonify({"success": False, "error": "Invalid filename"}), 400
    try:
        raw = storage_download_json(filename)
        content = json.dumps(raw, indent=2).encode("utf-8")
        return send_file(
            BytesIO(content),
            mimetype="application/json",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 9: Replace backup_count reference in system_info (lines 264)**

In the `system_info` function, replace the `os.listdir(BACKUP_DIR)` backup count line (line 264):

Old:
```python
"backup_count": len([f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")]),
```

New:
```python
"backup_count": storage_backup_count(),
```

- [ ] **Step 10: Guard risky operations in VACUUM and REINDEX endpoints**

In the `run_vacuum` function (lines 470-518), add a production guard at the top of the try block. After the authorization check, add:

```python
if IS_PRODUCTION:
    return jsonify({"success": False, "error": "VACUUM is disabled in production"}), 400
```

In the `run_reindex` function (lines 521-550), add the same guard:

```python
if IS_PRODUCTION:
    return jsonify({"success": False, "error": "REINDEX is disabled in production"}), 400
```

- [ ] **Step 11: Commit**

```bash
git add backend/routes/admin.py
git commit -m "feat: migrate backup endpoints to Supabase Storage; guard heavy ops in production"
```

---

### Task 10: Refactor reports.py Backup Listing to Use Supabase Storage

**Files:**
- Modify: `backend/routes/reports.py`

The `system_summary` endpoint lists backups from the local filesystem. Replace with Supabase Storage listing.

- [ ] **Step 1: Replace backup listing in `system_summary` (lines 379-392)**

In `backend/routes/reports.py`, first add the import at the top (after line 7):

```python
from utils.backup_storage import list_backups as storage_list_backups
```

Then remove line 10:
```python
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "db", "backups")
```

In the `system_summary` function (lines 366-406), replace lines 379-392 (the backup listing block) with:

```python
        backups = storage_list_backups()
        backups.sort(key=lambda b: b["created_at"], reverse=True)
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/reports.py
git commit -m "feat: use Supabase Storage for backup listing in system reports"
```

---

### Task 11: Disable Risky Operations in Maintenance UI for Production

**Files:**
- Modify: `frontend/src/pages/module/Maintenance.jsx`

Add a production-awareness check that disables VACUUM and REINDEX buttons in production, showing an informative tooltip.

- [ ] **Step 1: Add production detection to Maintenance.jsx**

At the top of the component body (after `const { user } = useAuth()`, line 26), add:

```jsx
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
```

Then, in the Optimize tab (starting around line 666), wrap each button with a disabled state when `isProduction` is true.

- [ ] **Step 2: Modify the VACUUM button (around lines 674-676)**

Replace:
```jsx
<Button type="primary" onClick={handleVacuumClick} loading={loading}>
  Run VACUUM
</Button>
```

With:
```jsx
<Button
  type="primary"
  onClick={handleVacuumClick}
  loading={loading}
  disabled={isProduction}
  title={isProduction ? 'VACUUM is not supported on Vercel serverless deployment' : undefined}
>
  Run VACUUM
</Button>
{isProduction && <Tag color="orange" style={{ marginLeft: 8 }}>Unavailable in production</Tag>}
```

- [ ] **Step 3: Modify the REINDEX button (around lines 693-695)**

Replace:
```jsx
<Button type="primary" onClick={handleReindexClick} loading={loading}>
  Run REINDEX
</Button>
```

With:
```jsx
<Button
  type="primary"
  onClick={handleReindexClick}
  loading={loading}
  disabled={isProduction}
  title={isProduction ? 'REINDEX is not supported on Vercel serverless deployment' : undefined}
>
  Run REINDEX
</Button>
{isProduction && <Tag color="orange" style={{ marginLeft: 8 }}>Unavailable in production</Tag>}
```

- [ ] **Step 4: Add Tag import (if not already present)**

Check the imports at the top of `Maintenance.jsx` (line 4-5). `Tag` is already imported from `antd` at line 4. No import change needed.

- [ ] **Step 5: Build the frontend to verify no errors**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/module/Maintenance.jsx
git commit -m "feat: disable VACUUM/REINDEX in production UI with informational tag"
```

---

### Task 12: Verification — Build, Deploy, and Smoke Test

**Files:**
- Verify all modified files are committed and build succeeds.

- [ ] **Step 1: Build the frontend**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds, `frontend/dist/` populated.

- [ ] **Step 2: Test the Flask app starts locally**

Run:
```bash
cd backend && python -c "from app import app; print('App routes:', len(app.url_map._rules))"
```
Expected: Prints number of routes (> 30).

- [ ] **Step 3: Test the health endpoint locally**

Start Flask:
```bash
cd backend && python app.py &
sleep 2
curl http://localhost:5000/api/health
kill %1
```
Expected: `{"status":"ok"}`

- [ ] **Step 4: Verify vercel.json is valid JSON**

Run:
```bash
python -c "import json; json.load(open('vercel.json')); print('Valid JSON')"
```
Expected: `Valid JSON`

- [ ] **Step 5: Run the git diff summary for review**

Run:
```bash
git diff main...HEAD --stat
```
Expected: List of changed files matches the plan (approx 10-11 files).

- [ ] **Step 6: Commit final verification notes**

```bash
git add -A
git commit -m "chore: final verification — build succeeds, health endpoint works, config valid"
```

---
