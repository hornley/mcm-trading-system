import sys
import os
import traceback

app = None

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from app import create_app
    app = create_app()
    print(f"[BOOT] app created OK — {len(app.url_map._rules)} routes", file=sys.stderr)

    with app.app_context():
        try:
            from models import User, Product, Location, Inventory, Order
            users = User.query.count()
            products = Product.query.count()
            locations = Location.query.count()
            inventory = Inventory.query.count()
            orders = Order.query.count()
            print(f"[BOOT] DB OK — users={users} products={products} locations={locations} inventory={inventory} orders={orders}", file=sys.stderr)
        except Exception as dbe:
            print(f"[BOOT] DB check failed: {dbe}", file=sys.stderr)

except Exception as e:
    from flask import Flask, jsonify
    tb = traceback.format_exc()
    print(f"[BOOT CRASH] {tb}", file=sys.stderr)
    app = Flask(__name__)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "405", "detail": str(e)}), 405

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def startup_error(path):
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": tb.split("\n"),
        }), 500
