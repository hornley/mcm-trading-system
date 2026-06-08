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
elif DB_MODE == "remote":
    _uri = os.getenv("DATABASE_URL")
    if not _uri:
        raise RuntimeError(
            "DATABASE_URL is required when DB_MODE=remote. "
            "Set it in your Vercel environment variables."
        )
    if "sslmode" not in _uri:
        separator = "&" if "?" in _uri else "?"
        _uri = f"{_uri}{separator}sslmode=require"


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
    _engine_options = {
        "pool_size": 1,
        "pool_recycle": 60,
        "pool_pre_ping": True,
    }
    if _uri and _uri.startswith("sqlite"):
        _engine_options["connect_args"] = {"timeout": 15}
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options
