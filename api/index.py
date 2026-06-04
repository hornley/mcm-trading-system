import sys
import os
import traceback

app = None
CRASH_REASON = ""
CRASH_TRACEBACK = ""

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from app import create_app
    app = create_app()

    with app.app_context():
        try:
            from models import User, Product, Location, Inventory, Order
            u = User.query.count()
            p = Product.query.count()
            l = Location.query.count()
            i = Inventory.query.count()
            o = Order.query.count()
            print(f"[BOOT] OK — routes={len(app.url_map._rules)} db=users:{u} products:{p} locations:{l} inventory:{i} orders:{o}", file=sys.stderr)
        except Exception as dbe:
            print(f"[BOOT] DB check failed: {dbe}", file=sys.stderr)

except Exception as e:
    tb = traceback.format_exc()
    print(f"[BOOT CRASH] {tb}", file=sys.stderr)
    CRASH_REASON = str(e)
    CRASH_TRACEBACK = tb
    from flask import Flask, jsonify
    app = Flask(__name__)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def crash_handler(path):
        return jsonify({
            "success": False,
            "crash": CRASH_REASON,
            "traceback": CRASH_TRACEBACK.split("\n"),
        }), 500
