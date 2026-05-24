import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")


DB_MODE = os.getenv("DB_MODE", "remote")

if DB_MODE == "local":
    _db_path = os.path.join(BASE_DIR, "..", "db", "database.db")
    _uri = f"sqlite:///{os.path.abspath(_db_path)}"
else:
    _uri = os.getenv("DATABASE_URL")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = _uri
    SQLALCHEMY_TRACK_MODIFICATIONS = False
