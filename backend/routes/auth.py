import random
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Location, PasswordResetToken
from flask_mail import Message

auth_bp = Blueprint("auth", __name__)

ROLE_MAP = {1: "owner", 2: "manager", 3: "admin", 4: "staff"}


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter(
        (User.username == username) | (User.email == username)
    ).first()

    if not user or not check_password_hash(user.password, password):
        return jsonify({"error": "Invalid username or password"}), 401

    location = Location.query.get(user.location_id) if user.location_id else None

    return jsonify({
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": ROLE_MAP.get(user.usertype, "staff"),
        "usertype": user.usertype,
        "location_id": user.location_id,
        "location_name": location.name if location else None,
    })


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password),
        usertype=data.get("usertype", 4),
        employee_code=str(random.randint(100000000, 999999999)),
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "Registration successful",
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": ROLE_MAP.get(user.usertype, "staff"),
    }), 201


@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    from flask import current_app
    from flask_mail import Mail
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "If the email exists, a reset link will be sent"}), 200
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=1)
    
    reset_token = PasswordResetToken(
        user_id=user.user_id,
        token=token,
        expires_at=expires_at,
    )
    db.session.add(reset_token)
    db.session.commit()
    
    reset_url = f"http://localhost:5173/reset-password/{token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }}
            .container {{ max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #1890ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #888; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Reset Your Password</h2>
            <p>Hello {user.username},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #1890ff;">{reset_url}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <div class="footer">
                <p>Thank you,<br>MCM Trading System</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        mail = current_app.extensions.get('mail')
        if not mail:
            from flask import Flask
            mail = Mail(current_app._get_current_object())
        
        msg = Message(
            subject="Reset Your Password - MCM Trading System",
            recipients=[user.email],
            html=html_content,
            sender=("MCM Trading System", current_app.config['MAIL_USERNAME'])
        )
        mail.send(msg)
    except Exception as e:
        print(f"Email error: {e}")
        return jsonify({"error": "Failed to send email"}), 500
    
    return jsonify({"message": "If the email exists, a reset link will be sent"}), 200


@auth_bp.route("/api/auth/reset/<token>", methods=["GET"])
def verify_reset_token(token):
    reset_token = PasswordResetToken.query.filter_by(token=token, used=False).first()
    
    if not reset_token:
        return jsonify({"error": "Invalid or expired token"}), 400
    
    if reset_token.expires_at < datetime.now():
        return jsonify({"error": "Token has expired"}), 400
    
    return jsonify({"valid": True, "message": "Token is valid"}), 200


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400
    
    reset_token = PasswordResetToken.query.filter_by(token=token, used=False).first()
    
    if not reset_token:
        return jsonify({"error": "Invalid or expired token"}), 400
    
    if reset_token.expires_at < datetime.now():
        return jsonify({"error": "Token has expired"}), 400
    
    user = User.query.get(reset_token.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    user.password = generate_password_hash(new_password)
    reset_token.used = True
    db.session.commit()
    
    return jsonify({"message": "Password reset successfully"}), 200
