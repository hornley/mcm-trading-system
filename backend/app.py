import os
import traceback
from dotenv import load_dotenv
from flask import Flask, request, send_from_directory

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from config import validate_production
validate_production()

DB_MODE = os.environ.get("DB_MODE", "remote")

if DB_MODE == "remote":
    from supabase import create_client, Client
    supabase: Client = create_client(
        os.environ.get("SUPABASE_URL"),
        os.environ.get("SUPABASE_KEY"),
    )
else:
    supabase = None

from flask_cors import CORS
from flask_mail import Mail
mail = Mail()
from config import Config, FRONTEND_DIST
from models import db
from routes.auth import auth_bp
from routes.accountControl import account_bp
from routes.inventory import inventory_bp
from routes.settings import settings_bp
from routes.categories import categories_bp
from routes.locations import locations_bp
from routes.admin import admin_bp
from routes.reports import reports_bp
from routes.dashboard import dashboard_bp
from routes.orders import orders_bp
from routes.manual import manual_bp
from routes.notifications import notifications_bp

def create_app():
    import sys
    print("[CREATE_APP] starting ...", file=sys.stderr)

    app = Flask(__name__, static_folder=FRONTEND_DIST)
    app.config.from_object(Config)
    print(f"[CREATE_APP] SQLALCHEMY_DATABASE_URI = {'SET' if app.config.get('SQLALCHEMY_DATABASE_URI') else 'NOT SET'}", file=sys.stderr)
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    CORS(app)
    mail.init_app(app)
    db.init_app(app)
    with app.app_context():
        import sys
        try:
            import sqlalchemy as sa
            if db.engine.url.drivername == 'sqlite':
                sa.event.listen(db.engine, 'connect', lambda c, _: c.execute('PRAGMA journal_mode=WAL'))
            inspector = sa.inspect(db.engine)
            cols = [c['name'] for c in inspector.get_columns('Locations')]
            if 'auto_restock_source_id' not in cols:
                db.session.execute(sa.text('ALTER TABLE "Locations" ADD COLUMN auto_restock_source_id INTEGER REFERENCES "Locations"(location_id)'))
                db.session.commit()
            prod_cols = [c['name'] for c in inspector.get_columns('Products')]
            if 'auto_restock_source_id' not in prod_cols:
                db.session.execute(sa.text('ALTER TABLE "Products" ADD COLUMN auto_restock_source_id INTEGER REFERENCES "Locations"(location_id)'))
                db.session.commit()
            user_cols = [c['name'] for c in inspector.get_columns('Users')]
            if 'theme' not in user_cols:
                db.session.execute(sa.text('ALTER TABLE "Users" ADD COLUMN theme VARCHAR DEFAULT \'light\''))
                db.session.commit()
            if 'fontsize' not in user_cols:
                db.session.execute(sa.text('ALTER TABLE "Users" ADD COLUMN fontsize VARCHAR DEFAULT \'medium\''))
                db.session.commit()
            if 'is_active' not in user_cols:
                db.session.execute(sa.text('ALTER TABLE "Users" ADD COLUMN is_active BOOLEAN DEFAULT TRUE'))
                db.session.commit()
            tables = inspector.get_table_names()
            if 'Product_Varieties' not in tables:
                db.create_all()
                db.session.commit()
            # Add nullable variety_id FK columns to existing tables
            mig_tables = [
                ('Inventory', 'variety_id'),
                ('Order_Items', 'variety_id'),
                ('Stock_Transfers', 'variety_id'),
                ('Stock_Adjustments', 'variety_id'),
                ('Stock_Requests', 'variety_id'),
            ]
            for tname, col in mig_tables:
                if tname in tables:
                    existing = [c['name'] for c in inspector.get_columns(tname)]
                    if col not in existing:
                        db.session.execute(sa.text(
                            f'ALTER TABLE "{tname}" ADD COLUMN {col} INTEGER REFERENCES "Product_Varieties"(variety_id)'
                        ))
                        db.session.commit()
            if 'Notifications' not in tables:
                db.create_all()
                db.session.commit()
            # Clean up self-referencing pending auto-restock requests
            if 'Stock_Requests' in tables:
                db.session.execute(
                    sa.text("UPDATE Stock_Requests SET status = 'declined' WHERE status = 'pending' AND from_location_id = to_location_id")
                )
                db.session.commit()
        except Exception as e:
            print(f"[MIGRATION] {e}", file=sys.stderr)
    print("[CREATE_APP] registering blueprints ...", file=sys.stderr)
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
    app.register_blueprint(notifications_bp)

    @app.errorhandler(Exception)
    def handle_error(e):
        original = getattr(e, "original_exception", None) or e
        import sys
        print(f"[500 ERROR] {original}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"success": False, "error": str(original)}, getattr(e, "code", 500)

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    @app.before_request
    def log_and_fix_request():
        import sys
        path_info = request.environ.get('PATH_INFO', '?')
        raw_uri = request.environ.get('REQUEST_URI', '?')
        original = request.headers.get('X-Vercel-Original-Url', '')
        print(f"[REQUEST] {request.method} PATH_INFO={path_info} RAW_URI={raw_uri} X-Vercel-Original-Url={original}", file=sys.stderr)
        if original and path_info == '/api/index':
            parsed = original.split('?')[0]
            request.environ['PATH_INFO'] = parsed
            print(f"[REQUEST] fixed PATH_INFO to {parsed}", file=sys.stderr)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db.session.remove()

    @app.route("/api/debug", methods=["GET", "POST"])
    def debug_info():
        import sys, os as _os
        return jsonify({
            "python": sys.version,
            "cwd": _os.getcwd(),
            "env_DATABASE_URL": "SET" if _os.environ.get("DATABASE_URL") else "MISSING",
            "env_DB_MODE": _os.environ.get("DB_MODE", "not set"),
            "env_SUPABASE_URL": "SET" if _os.environ.get("SUPABASE_URL") else "MISSING",
            "env_IS_PRODUCTION": _os.environ.get("IS_PRODUCTION", "not set"),
            "uri": app.config.get("SQLALCHEMY_DATABASE_URI", "NOT SET")[:40] + "..." if app.config.get("SQLALCHEMY_DATABASE_URI") else "NOT SET",
            "path_info": request.environ.get("PATH_INFO", "?"),
            "request_uri": request.environ.get("REQUEST_URI", "?"),
            "script_name": request.environ.get("SCRIPT_NAME", "?"),
            "request_path": request.path,
            "request_url": request.url,
            "headers": dict(request.headers),
        })

    @app.route("/api/health/db")
    def health_db():
        try:
            from models import User
            count = User.query.count()
            return {"status": "ok", "users": count}
        except Exception as e:
            return {"status": "error", "error": str(e)}, 500

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


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
