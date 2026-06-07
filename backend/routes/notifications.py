from flask import Blueprint, request
from datetime import datetime
from models import db, Notification, Location
from utils.response import success_response, error_response

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/api/notifications", methods=["GET"])
def list_notifications():
    location_id = request.args.get("location_id", type=int)
    if not location_id:
        return error_response("location_id is required", "MISSING_PARAM", 400)

    query = Notification.query.filter_by(location_id=location_id).order_by(Notification.created_at.desc()).limit(50)
    notifications = query.all()
    return success_response([{
        "notification_id": n.notification_id,
        "location_id": n.location_id,
        "type": n.type,
        "message": n.message,
        "request_id": n.request_id,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in notifications])


@notifications_bp.route("/api/notifications/count", methods=["GET"])
def notifications_count():
    location_id = request.args.get("location_id", type=int)
    if not location_id:
        return error_response("location_id is required", "MISSING_PARAM", 400)

    count = Notification.query.filter_by(location_id=location_id, is_read=False).count()
    resp = success_response({"count": count})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return resp


@notifications_bp.route("/api/notifications/<int:notification_id>/read", methods=["PUT"])
def mark_read(notification_id):
    notification = Notification.query.get(notification_id)
    if not notification:
        return error_response("Notification not found", "NOT_FOUND", 404)
    notification.is_read = True
    db.session.commit()
    return success_response({"message": "Marked as read"})


@notifications_bp.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_read():
    location_id = request.args.get("location_id", type=int)
    if not location_id:
        return error_response("location_id is required", "MISSING_PARAM", 400)
    Notification.query.filter_by(location_id=location_id, is_read=False).update({"is_read": True})
    db.session.commit()
    return success_response({"message": "All marked as read"})


@notifications_bp.route("/api/notifications/<int:notification_id>", methods=["DELETE"])
def delete_notification(notification_id):
    notification = Notification.query.get(notification_id)
    if not notification:
        return error_response("Notification not found", "NOT_FOUND", 404)
    db.session.delete(notification)
    db.session.commit()
    return success_response({"message": "Notification deleted"})


@notifications_bp.route("/api/notifications", methods=["DELETE"])
def clear_notifications():
    location_id = request.args.get("location_id", type=int)
    if not location_id:
        return error_response("location_id is required", "MISSING_PARAM", 400)
    Notification.query.filter_by(location_id=location_id).delete()
    db.session.commit()
    return success_response({"message": "All notifications cleared"})
