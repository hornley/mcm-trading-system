import os
import shutil
import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from models import db, User, Product, Location, Category, Inventory
from models import StockTransfer, StockAdjustment, ActivityLog, Order, OrderItem, Payment

admin_bp = Blueprint("admin", __name__)

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "db", "backups")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "db", "database.db")

os.makedirs(BACKUP_DIR, exist_ok=True)


def _authorized(usertype):
    return usertype in [1, 3]


def _format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _table_counts():
    models = [
        ("Users", User),
        ("Locations", Location),
        ("Categories", Category),
        ("Products", Product),
        ("Orders", Order),
        ("Order Items", OrderItem),
        ("Payments", Payment),
        ("Inventory", Inventory),
        ("Stock Transfers", StockTransfer),
        ("Stock Adjustments", StockAdjustment),
        ("Activity Logs", ActivityLog),
    ]
    return {name: db.session.query(m).count() for name, m in models}


def _db_size():
    try:
        return os.path.getsize(DB_PATH)
    except OSError:
        return 0


# ── BACKUP & RESTORE ──

@admin_bp.route("/api/admin/backups", methods=["GET"])
def list_backups():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        files = []
        for f in sorted(os.listdir(BACKUP_DIR), reverse=True):
            if f.endswith(".db"):
                fpath = os.path.join(BACKUP_DIR, f)
                stat = os.stat(fpath)
                files.append({
                    "filename": f,
                    "size": stat.st_size,
                    "size_formatted": _format_size(stat.st_size),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
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
        if not os.path.exists(DB_PATH):
            return jsonify({"success": False, "error": "Database file not found"}), 404
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.db"
        dest = os.path.join(BACKUP_DIR, filename)
        shutil.copy2(DB_PATH, dest)
        return jsonify({"success": True, "message": "Backup created", "data": {"filename": filename}})
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
        shutil.copy2(backup_path, DB_PATH)
        return jsonify({"success": True, "message": "Database restored successfully"})
    except Exception as e:
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
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("SELECT sqlite_version()")
        sqlite_version = cur.fetchone()[0]
        conn.close()

        db_bytes = _db_size()
        counts = _table_counts()
        return jsonify({
            "success": True,
            "data": {
                "app_name": "MCM Trading System",
                "version": "0.0.1",
                "sqlite_version": sqlite_version,
                "database_size": db_bytes,
                "database_size_formatted": _format_size(db_bytes),
                "backup_count": len([f for f in os.listdir(BACKUP_DIR) if f.endswith(".db")]),
                "table_counts": counts,
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
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("PRAGMA integrity_check")
        integrity = cur.fetchone()[0]
        cur = conn.execute("PRAGMA foreign_key_check")
        fk_violations = cur.fetchall()
        conn.close()

        issues = []
        if integrity != "ok":
            issues.append({"type": "integrity", "detail": integrity})
        for v in fk_violations:
            issues.append({"type": "foreign_key", "detail": f"Table={v[0]}, rowid={v[1]}, parent={v[2]}, fk_index={v[3]}"})

        return jsonify({
            "success": True,
            "data": {
                "integrity_check": integrity,
                "foreign_key_violations": len(fk_violations),
                "issues": issues,
                "passed": integrity == "ok" and len(fk_violations) == 0,
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
        before = _db_size()
        start = time.time()
        db.session.execute("VACUUM")
        db.session.commit()
        elapsed = round(time.time() - start, 2)
        after = _db_size()
        saved = before - after
        return jsonify({
            "success": True,
            "message": "VACUUM completed",
            "data": {
                "size_before": before,
                "size_before_formatted": _format_size(before),
                "size_after": after,
                "size_after_formatted": _format_size(after),
                "space_saved": saved,
                "space_saved_formatted": _format_size(saved),
                "duration_seconds": elapsed,
            }
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
        db.session.execute("REINDEX")
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
