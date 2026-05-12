from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, User

account_bp = Blueprint("account", __name__)

ALLOWED_TYPES = {1, 3}

LOCATION_MAP = {0: "all", 1: "storehouse", 2: "store"}


def _location_name(location_id):
    return LOCATION_MAP.get(location_id, "unknown")


def _generate_employee_code():
    prefix = datetime.now().strftime("%y%m%d")
    count = User.query.filter(User.employee_code.startswith(prefix)).count()
    return f"{prefix}{count + 1:03d}"


def _check_access(user_id):
    user = User.query.get(user_id)
    if not user or user.usertype not in ALLOWED_TYPES:
        return None
    return user


@account_bp.route("/api/account/users", methods=["GET"])
def list_users():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "user_id query parameter is required"}), 400
    if not _check_access(user_id):
        return jsonify({"error": "Forbidden"}), 403

    query = User.query

    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(
            User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    usertype = request.args.get("usertype", type=int)
    if usertype:
        query = query.filter_by(usertype=usertype)

    location_id = request.args.get("location_id", type=int)
    if location_id is not None:
        query = query.filter_by(location_id=location_id)

    users = query.all()

    return jsonify([
        {
            "employee_code": u.employee_code,
            "username": u.username,
            "location": _location_name(u.location_id),
        }
        for u in users
    ])


@account_bp.route("/api/account/users/<int:target_id>/access", methods=["PUT"])
def edit_user_access(target_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    requester_id = data.get("user_id")
    if not requester_id:
        return jsonify({"error": "user_id is required"}), 400
    if not _check_access(requester_id):
        return jsonify({"error": "Forbidden"}), 403

    target = User.query.get(target_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    new_usertype = data.get("usertype")
    if new_usertype is None or new_usertype not in ALLOWED_TYPES | {2, 4}:
        return jsonify({"error": "usertype must be 1 (owner), 2 (manager), 3 (admin), or 4 (staff)"}), 400

    target.usertype = new_usertype

    target.location_id = data.get("location_id", target.location_id)
    db.session.commit()

    return jsonify({
        "message": "User access updated",
        "employee_code": target.employee_code,
        "username": target.username,
        "usertype": target.usertype,
        "location": _location_name(target.location_id),
    })
