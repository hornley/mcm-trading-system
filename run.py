import subprocess
import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

npm_executable = shutil.which("npm") or shutil.which("npm.cmd") or shutil.which("npm.exe")
if not npm_executable:
    raise FileNotFoundError(
        "npm was not found on PATH. Install Node.js or add npm to PATH, then retry."
    )

frontend_dir = os.path.join(BASE_DIR, "frontend")
if not os.path.isdir(os.path.join(frontend_dir, "node_modules")):
    print("Installing frontend dependencies...")
    subprocess.run([npm_executable, "install"], cwd=frontend_dir, check=True)
else:
    print("Frontend dependencies already installed.")

print("Building frontend...")
subprocess.run([npm_executable, "run", "build"], cwd=frontend_dir, check=True)

print("Checking database connection...")
import sys
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))
from app import create_app
from models import db

_temp_app = create_app()
with _temp_app.app_context():
    db_mode = "local (SQLite offline)" if db.engine.url.drivername == "sqlite" else "remote (Supabase PostgreSQL)"
    print(f"DB_MODE: {db_mode} — {db.engine.url.drivername}")

print("Starting Flask backend (serving built frontend)...")
subprocess.run(["python", "app.py"], cwd=os.path.join(BASE_DIR, "backend"))
