import os
from dotenv import load_dotenv
from flask import Flask, app, send_from_directory
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

supabase: Client = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY"),
)

from flask_cors import CORS
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

def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
    app.config.from_object(Config)
    CORS(app)
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

    with app.app_context():
        from models import (
            User, Location, Category, Product, Order, OrderItem,
            Payment, Inventory, StockTransfer, StockAdjustment, ActivityLog,
        )
        db.create_all()

    @app.route("/api/health")
    def health():
        return {"status": "ok"}

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
