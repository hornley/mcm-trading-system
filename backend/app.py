import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config, FRONTEND_DIST
from models import db
from routes.auth import auth_bp


def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
    app.config.from_object(Config)
    CORS(app)
    db.init_app(app)
    app.register_blueprint(auth_bp)

    with app.app_context():
        from models import (
            User, Location, Category, Product, Order, OrderItem,
            Payment, Inventory, StockTransfer, StockAdjustment, ActivityLog,
        )
        from werkzeug.security import generate_password_hash
        db.create_all()

        if User.query.count() == 0:
            defaults = [
                User(username='owner',   email='owner@mcm.com',   password=generate_password_hash('password'), usertype=1),
                User(username='manager', email='manager@mcm.com', password=generate_password_hash('password'), usertype=2),
                User(username='admin',   email='admin@mcm.com',   password=generate_password_hash('password'), usertype=3),
            ]
            db.session.add_all(defaults)
            db.session.commit()

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
