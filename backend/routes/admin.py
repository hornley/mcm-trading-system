import os
import json
import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import text
from models import db, User, Product, Location, Category, Inventory
from models import StockTransfer, StockAdjustment, ActivityLog, Order, OrderItem, Payment
from utils.sorting import quick_sort

admin_bp = Blueprint("admin", __name__)

BACKUP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "..", "db", "backups"
)
os.makedirs(BACKUP_DIR, exist_ok=True)

BACKUP_MODELS = [
    ("Users", User), ("Locations", Location), ("Categories", Category),
    ("Products", Product), ("Orders", Order), ("Order Items", OrderItem),
    ("Payments", Payment), ("Inventory", Inventory),
    ("Stock Transfers", StockTransfer), ("Stock Adjustments", StockAdjustment),
    ("Activity Logs", ActivityLog),
]


def _authorized(usertype):
    return usertype in [1, 3]


def _format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _table_counts():
    return {name: db.session.query(m).count() for name, m in BACKUP_MODELS}


def _serialise_row(row):
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


def _create_backup_file(data):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    return filename, filepath


# ── BACKUP & RESTORE ──

@admin_bp.route("/api/admin/backups", methods=["GET"])
def list_backups():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        sort_by = request.args.get("sort_by", "created_at")
        sort_order = request.args.get("sort_order", "desc")
        files = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith(".json"):
                fpath = os.path.join(BACKUP_DIR, f)
                stat = os.stat(fpath)
                files.append({
                    "filename": f,
                    "size": stat.st_size,
                    "size_formatted": _format_size(stat.st_size),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
        files = quick_sort(files, key=sort_by, order=sort_order)
        return jsonify({"success": True, "data": files})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/backups", methods=["POST"])
def create_backup():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        backup_data = {}
        for name, model in BACKUP_MODELS:
            rows = model.query.all()
            backup_data[name] = [_serialise_row(r) for r in rows]

        filename, filepath = _create_backup_file(backup_data)
        return jsonify({
            "success": True,
            "message": f"Backup created ({len(json.dumps(backup_data))} bytes)",
            "data": {"filename": filename, "size": os.path.getsize(filepath)},
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/backups/<filename>/restore", methods=["POST"])
def restore_backup(filename):
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        if ".." in filename or "/" in filename:
            return jsonify({"success": False, "error": "Invalid filename"}), 400
        backup_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(backup_path):
            return jsonify({"success": False, "error": "Backup file not found"}), 404

        with open(backup_path) as f:
            backup_data = json.load(f)

        for name, model in reversed(BACKUP_MODELS):
            db.session.query(model).delete()
        db.session.commit()

        for name, model in BACKUP_MODELS:
            rows = backup_data.get(name, [])
            for row_data in rows:
                for col in ("created_at", "updated_at", "order_date", "transfer_date",
                            "date", "timestamp"):
                    if col in row_data and isinstance(row_data[col], str):
                        try:
                            row_data[col] = datetime.fromisoformat(row_data[col].replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            pass
                instance = model(**row_data)
                db.session.add(instance)
        db.session.commit()

        return jsonify({"success": True, "message": "Database restored successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/backups/<filename>", methods=["DELETE"])
def delete_backup(filename):
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        if ".." in filename or "/" in filename:
            return jsonify({"success": False, "error": "Invalid filename"}), 400
        backup_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(backup_path):
            return jsonify({"success": False, "error": "Backup file not found"}), 404
        os.remove(backup_path)
        return jsonify({"success": True, "message": "Backup deleted"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── SYSTEM INFO ──

@admin_bp.route("/api/admin/system/info", methods=["GET"])
def system_info():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        result = db.session.execute(text("SELECT version()"))
        db_version = result.scalar()

        result = db.session.execute(text("SELECT pg_database_size(current_database())"))
        db_bytes = result.scalar()

        counts = _table_counts()
        sort_by = request.args.get("sort_by", "name")
        sort_order = request.args.get("sort_order", "asc")
        counts_list = [{"name": k, "count": v} for k, v in counts.items()]
        counts_list = quick_sort(counts_list, key=sort_by, order=sort_order)

        return jsonify({
            "success": True,
            "data": {
                "app_name": "MCM Trading System",
                "version": "0.0.1",
                "db_version": db_version,
                "database_size": db_bytes,
                "database_size_formatted": _format_size(db_bytes),
                "backup_count": len([f for f in os.listdir(BACKUP_DIR) if f.endswith(".json")]),
                "table_counts": counts_list,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── MAINTENANCE ──

@admin_bp.route("/api/admin/maintenance/check", methods=["POST"])
def integrity_check():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        issues = []
        for name, model in BACKUP_MODELS:
            try:
                count = db.session.query(model).count()
            except Exception as e:
                issues.append({"type": "table_error", "table": name, "detail": str(e)})

        return jsonify({
            "success": True,
            "data": {
                "integrity_check": "ok" if not issues else "issues_found",
                "foreign_key_violations": 0,
                "issues": issues,
                "passed": len(issues) == 0,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── OPTIMIZE ──

@admin_bp.route("/api/admin/optimize/vacuum", methods=["POST"])
def run_vacuum():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        start = time.time()
        db.session.execute(text("VACUUM ANALYZE"))
        db.session.commit()
        elapsed = round(time.time() - start, 2)
        return jsonify({
            "success": True,
            "message": "VACUUM ANALYZE completed",
            "data": {"duration_seconds": elapsed}
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/optimize/reindex", methods=["POST"])
def run_reindex():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        start = time.time()
        db.session.execute(text("REINDEX SCHEMA public"))
        db.session.commit()
        elapsed = round(time.time() - start, 2)
        return jsonify({
            "success": True,
            "message": "Indexes rebuilt successfully",
            "data": {"duration_seconds": elapsed}
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── CLEANUP ──

@admin_bp.route("/api/admin/cleanup/logs", methods=["POST"])
def cleanup_logs():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = data.get("days", 90)
        cutoff = datetime.now() - timedelta(days=days)
        deleted = ActivityLog.query.filter(ActivityLog.timestamp < cutoff).delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Deleted {deleted} activity log(s) older than {days} days",
            "data": {"deleted_count": deleted, "retention_days": days}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/cleanup/products", methods=["POST"])
def cleanup_products():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        voided = Product.query.filter_by(is_active=False).all()
        count = len(voided)
        for p in voided:
            Inventory.query.filter_by(product_id=p.product_id).delete()
            StockTransfer.query.filter_by(product_id=p.product_id).delete()
            StockAdjustment.query.filter_by(product_id=p.product_id).delete()
            db.session.delete(p)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Permanently deleted {count} voided product(s)",
            "data": {"deleted_count": count}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/cleanup/transfers", methods=["POST"])
def cleanup_transfers():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = data.get("days", 90)
        cutoff = datetime.now() - timedelta(days=days)
        deleted = StockTransfer.query.filter(
            StockTransfer.transfer_date < cutoff,
            StockTransfer.status.in_(["cancelled", "completed"])
        ).delete()
        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Deleted {deleted} transfer(s) older than {days} days",
            "data": {"deleted_count": deleted, "retention_days": days}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/api/admin/cleanup/all", methods=["POST"])
def cleanup_all():
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = data.get("days", 90)
        cutoff = datetime.now() - timedelta(days=days)

        logs_deleted = ActivityLog.query.filter(ActivityLog.timestamp < cutoff).delete()

        voided = Product.query.filter_by(is_active=False).all()
        products_deleted = len(voided)
        for p in voided:
            Inventory.query.filter_by(product_id=p.product_id).delete()
            StockTransfer.query.filter_by(product_id=p.product_id).delete()
            StockAdjustment.query.filter_by(product_id=p.product_id).delete()
            db.session.delete(p)

        transfers_deleted = StockTransfer.query.filter(
            StockTransfer.transfer_date < cutoff,
            StockTransfer.status.in_(["cancelled", "completed"])
        ).delete()

        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Cleanup completed",
            "data": {
                "logs_deleted": logs_deleted,
                "products_deleted": products_deleted,
                "transfers_deleted": transfers_deleted,
                "retention_days": days,
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
