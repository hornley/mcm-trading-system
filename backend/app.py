import os
from dotenv import load_dotenv
from flask import Flask, app, send_from_directory

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

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


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
