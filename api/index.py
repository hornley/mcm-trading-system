import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from app import create_app
    app = create_app()
except Exception as e:
    from flask import Flask, jsonify
    tb = traceback.format_exc()
    print(f"[STARTUP CRASH] {tb}", file=sys.stderr)
    app = Flask(__name__)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def startup_error(path):
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": tb.split("\n"),
        }), 500
