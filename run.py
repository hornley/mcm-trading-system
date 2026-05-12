import subprocess
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Building frontend...")
subprocess.run(["npm", "run", "build"], cwd=os.path.join(BASE_DIR, "frontend"), check=True)

print("Starting backend...")
subprocess.run(["python", "app.py"], cwd=os.path.join(BASE_DIR, "backend"))