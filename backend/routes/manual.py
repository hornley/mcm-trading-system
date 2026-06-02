from flask import Blueprint, jsonify, request
from models import db, ManualSection

manual_bp = Blueprint("manual", __name__)

@manual_bp.route("/api/manual/<role>", methods=["GET"])
def get_manual(role):
    usertype = request.args.get("usertype", type=int)

    if role not in ("owner", "manager", "admin"):
        return jsonify({"success": False, "error": "Invalid role"}), 400
    if not usertype or usertype < 1:
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    sections = ManualSection.query.filter_by(role=role).order_by(ManualSection.sort_order).all()

    def serialize(s):
        return {
            "section_id": s.section_id,
            "role": s.role,
            "parent_id": s.parent_id,
            "sort_order": s.sort_order,
            "title": s.title,
            "content": s.content,
        }

    return jsonify({"success": True, "data": [serialize(s) for s in sections]})
