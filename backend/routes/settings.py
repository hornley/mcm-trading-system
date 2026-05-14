from flask import Blueprint, request, jsonify
from models import db, User 

settings_bp = Blueprint ("settings", __name__)
@settings_bp.route("/api/settings", methods=["GET"]) 
def get_settings():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error:" "user_id is required"}), 400 
    user = user.query.get(user_id) 
    if not user: 
        return jsonify ({"erorr": "User not found"}), 404 
    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "profile_picture": user.profile_picture,
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
    
    #Update software appearance 
    if "theme" in data: 
        user.theme = data["theme"]
    if "fontsize" in data:
        user.fontsize = data["fontsize"]
    
    db.session.commit()
    return jsonify({"message": "Preference updated successfully"})