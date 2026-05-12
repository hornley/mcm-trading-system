import subprocess
import os
import signal
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
vite_process = None

def cleanup(signum, frame):
    if vite_process and vite_process.poll() is None:
        print("\nShutting down Vite dev server...")
        vite_process.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print("Seeding database...")
subprocess.run(["python", "createDatabase.py"], cwd=os.path.join(BASE_DIR, "backend"), check=True)

print("Starting Vite dev server (hot reload)...")
vite_process = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd=os.path.join(BASE_DIR, "frontend"),
)

print("Starting Flask backend (hot reload)...")
try:
    subprocess.run(["python", "app.py"], cwd=os.path.join(BASE_DIR, "backend"))
finally:
    cleanup(None, None)
