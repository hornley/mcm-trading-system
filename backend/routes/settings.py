from flask import Blueprint, request, jsonify
from models import db, User
from werkzeug.security import check_password_hash, generate_password_hash

settings_bp = Blueprint("settings", __name__)

@settings_bp.route("/api/settings", methods=["GET"])
def get_settings():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
       #"profile_picture": user.profile_picture,
        "theme": user.theme,
        "fontsize": user.fontsize,
    })

@settings_bp.route("/api/settings/profile", methods=["PUT"])
def update_profile(): 
    data = request.get_json()
    if not data: 
        return jsonify ({"error" : "Request body is required"}), 400 
    
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404    
    
    if "email" in data:
        user.email = data["email"]
    if "phone" in data:
        user.phone = data["phone"]
#   if "profile_picture" in data:
#       user.profile_picture = data["profile_picture"]
    db.session.commit()
    return jsonify({"message": "Profile updated successfully"})

@settings_bp.route("/api/settings/preferences", methods=["PUT"])
def update_preferences(): 
    data = request.get_json()
    if not data: 
        return jsonify ({"error" : "Request body is required"}), 400
    
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404    
    
    if "theme" in data:
        user.theme = data["theme"]      
    if "fontsize" in data:
        user.fontsize = data["fontsize"]
    db.session.commit()
    return jsonify({"message": "Preferences updated successfully"})


@settings_bp.route("/api/about", methods=["GET"])
def get_about():
    return jsonify({
        "app_name": "MCM Trading System",
        "version": "0.0.1",
        "description": "MCM Trading - Shop Management System",
    })


@settings_bp.route("/api/user_manual", methods=["GET"])
def get_user_manual():
    return jsonify({
        "user_manual_url": "no link yet"
    })

@settings_bp.route("/api/settings/password", methods=["PUT"])
def change_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    user_id = data.get("user_id")
    old_password = data.get("old_password")
    new_password = data.get("new_password")
    
    if not user_id or not old_password or not new_password:
        return jsonify({"error": "user_id, old_password, and new_password are required"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not check_password_hash(user.password, old_password):
        return jsonify({"error": "Old password is incorrect"}), 400
    
    user.password = generate_password_hash(new_password)
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})

@settings_bp.route("/api/settings/verify-password", methods=["POST"])
def verify_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    user_id = data.get("user_id")
    password = data.get("password")
    
    if not user_id or not password:
        return jsonify({"error": "user_id and password are required"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if check_password_hash(user.password, password):
        return jsonify({"valid": True})
    return jsonify({"valid": False})