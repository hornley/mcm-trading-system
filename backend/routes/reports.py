import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import cast, Integer, func
from models import db, User, Product, Location, Inventory, Order, OrderItem, Payment
from models import StockTransfer, StockAdjustment, ActivityLog, StoreReport
from utils.backup_storage import list_backups as storage_list_backups

reports_bp = Blueprint("reports", __name__)


def _authorized(usertype):
    return usertype in [1, 2, 3]


def _resolve_location_id(usertype, user_id, requested_location_id):
    if requested_location_id == -1:
        return None
    if usertype == 2:
        user = User.query.get(user_id)
        if not user:
            return None
        return user.location_id
    return requested_location_id


def _parse_days(days_str):
    try:
        return max(1, min(365, int(days_str)))
    except (TypeError, ValueError):
        return 30


def _format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


# ── INVENTORY REPORTS ──

@reports_bp.route("/api/reports/inventory/summary", methods=["GET"])
def inventory_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        user_id = request.args.get("user_id", type=int)
        location_id = _resolve_location_id(usertype, user_id, request.args.get("location_id", type=int))
        product_id = request.args.get("product_id", type=int)

        query = db.session.query(
            Location.location_id,
            Location.name,
            func.count(Inventory.inventory_id).label("product_count"),
            func.coalesce(func.sum(Inventory.quantity), 0).label("total_quantity"),
        ).outerjoin(Inventory, Inventory.location_id == Location.location_id)

        if location_id:
            query = query.filter(Location.location_id == location_id)

        if product_id:
            query = query.filter(Inventory.product_id == product_id)

        rows = query.group_by(Location.location_id).order_by(Location.name).all()

        if location_id:
            total_products = db.session.query(func.count(func.distinct(Inventory.product_id))).filter(Inventory.location_id == location_id).scalar()
            total_q = db.session.query(func.coalesce(func.sum(Inventory.quantity), 0)).filter(Inventory.location_id == location_id).scalar()
        else:
            total_products = db.session.query(func.count(Product.product_id)).scalar()
            total_q = db.session.query(func.coalesce(func.sum(Inventory.quantity), 0)).scalar()

        inv_query = Inventory.query
        if location_id:
            inv_query = inv_query.filter(Inventory.location_id == location_id)
        if product_id:
            inv_query = inv_query.filter(Inventory.product_id == product_id)

        all_inv = inv_query.all()
        low_stock_count = 0
        out_of_stock_count = 0
        for inv in all_inv:
            try:
                rl = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
            except (ValueError, TypeError):
                rl = 0
            if inv.quantity <= rl:
                low_stock_count += 1
            if inv.quantity == 0:
                out_of_stock_count += 1

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_products": total_products,
                    "total_quantity": total_q,
                    "low_stock_count": low_stock_count,
                    "out_of_stock_count": out_of_stock_count,
                },
                "rows": [
                    {
                        "location_id": r.location_id,
                        "location_name": r.name,
                        "product_count": r.product_count,
                        "total_quantity": r.total_quantity,
                    }
                    for r in rows
                ],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/reports/inventory/low-stock", methods=["GET"])
def low_stock():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        user_id = request.args.get("user_id", type=int)
        location_id = _resolve_location_id(usertype, user_id, request.args.get("location_id", type=int))

        inv_query = Inventory.query
        if location_id:
            inv_query = inv_query.filter(Inventory.location_id == location_id)

        all_inv = inv_query.all()
        rows = []
        for inv in all_inv:
            try:
                rl = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
            except (ValueError, TypeError):
                rl = 0
            if inv.quantity <= rl:
                rows.append({
                    "inventory_id": inv.inventory_id,
                    "product_id": inv.product_id,
                    "product_name": inv.product.name if inv.product else "Unknown",
                    "sku": inv.product.sku if inv.product else "",
                    "location_id": inv.location_id,
                    "location_name": inv.location.name if inv.location else "Unknown",
                    "quantity": inv.quantity,
                    "reorder_level": rl,
                    "color": inv.variety.color if inv.variety else None,
                    "pattern": inv.variety.pattern if inv.variety else None,
                })

        rows.sort(key=lambda r: r["quantity"])
        return jsonify({"success": True, "data": {"rows": rows}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── SALES REPORTS ──

@reports_bp.route("/api/reports/sales/daily", methods=["GET"])
def sales_daily():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = _parse_days(request.args.get("days"))
        cutoff = datetime.now() - timedelta(days=days)
        location_id = _resolve_location_id(usertype, request.args.get("user_id", type=int),
                                            request.args.get("location_id", type=int))

        query = db.session.query(
            func.date(Order.order_date).label("date"),
            func.count(Order.order_id).label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        ).filter(Order.status == "completed", Order.order_date >= cutoff)

        if location_id:
            query = query.filter(Order.location_id == location_id)

        rows = query.group_by(func.date(Order.order_date)).order_by(func.date(Order.order_date).desc()).all()

        total_orders = sum(r.order_count for r in rows)
        total_revenue = sum(r.revenue for r in rows)
        avg_order_value = round(total_revenue / total_orders, 2) if total_orders else 0

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_orders": total_orders,
                    "total_revenue": total_revenue,
                    "avg_order_value": avg_order_value,
                },
                "rows": [
                    {"date": r.date, "order_count": r.order_count, "revenue": r.revenue}
                    for r in rows
                ],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/reports/sales/top-products", methods=["GET"])
def top_products():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = _parse_days(request.args.get("days"))
        limit = max(1, min(100, request.args.get("limit", 10, type=int)))
        cutoff = datetime.now() - timedelta(days=days)

        rows = db.session.query(
            Product.product_id,
            Product.name.label("product_name"),
            Product.sku,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("total_quantity"),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.price), 0).label("total_revenue"),
        ).join(OrderItem, OrderItem.product_id == Product.product_id
        ).join(Order, Order.order_id == OrderItem.order_id
        ).filter(Order.status == "completed", Order.order_date >= cutoff
        ).group_by(Product.product_id
        ).order_by(func.sum(OrderItem.quantity).desc()
        ).limit(limit).all()

        return jsonify({
            "success": True,
            "data": {
                "rows": [
                    {
                        "product_id": r.product_id,
                        "product_name": r.product_name,
                        "sku": r.sku,
                        "total_quantity": r.total_quantity,
                        "total_revenue": r.total_revenue,
                    }
                    for r in rows
                ],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── FINANCIAL REPORTS ──

@reports_bp.route("/api/reports/financial/revenue", methods=["GET"])
def financial_revenue():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = _parse_days(request.args.get("days"))
        cutoff = datetime.now() - timedelta(days=days)

        rows = db.session.query(
            func.date(Order.order_date).label("date"),
            func.count(Order.order_id).label("order_count"),
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        ).filter(Order.status == "completed", Order.order_date >= cutoff
        ).group_by(func.date(Order.order_date)
        ).order_by(func.date(Order.order_date).desc()).all()

        total_revenue = sum(r.revenue for r in rows)
        total_orders = sum(r.order_count for r in rows)

        return jsonify({
            "success": True,
            "data": {
                "stats": {"total_revenue": total_revenue, "total_orders": total_orders},
                "rows": [
                    {"date": r.date, "order_count": r.order_count, "revenue": r.revenue}
                    for r in rows
                ],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/reports/financial/payment-methods", methods=["GET"])
def payment_methods():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = _parse_days(request.args.get("days"))
        cutoff = datetime.now() - timedelta(days=days)

        rows = db.session.query(
            Payment.payment_method,
            func.count(Payment.payment_id).label("count"),
            func.coalesce(func.sum(Payment.price), 0).label("total"),
        ).join(Order, Order.order_id == Payment.order_id
        ).filter(Order.status == "completed", Order.order_date >= cutoff
        ).group_by(Payment.payment_method
        ).order_by(func.count(Payment.payment_id).desc()).all()

        return jsonify({
            "success": True,
            "data": {
                "rows": [
                    {"payment_method": r.payment_method, "count": r.count, "total": r.total}
                    for r in rows
                ],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── ACTIVITY REPORTS ──

@reports_bp.route("/api/reports/activity/summary", methods=["GET"])
def activity_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        days = _parse_days(request.args.get("days"))
        cutoff = datetime.now() - timedelta(days=days)

        logs = ActivityLog.query.filter(ActivityLog.timestamp >= cutoff).all()

        total_logs = len(logs)
        unique_users = len(set(log.user_id for log in logs))

        user_counts = {}
        module_counts = {}
        for log in logs:
            user_counts[log.user_id] = user_counts.get(log.user_id, 0) + 1
            module_counts[log.module] = module_counts.get(log.module, 0) + 1

        by_user = sorted(
            [
                {
                    "user_id": uid,
                    "username": User.query.get(uid).username if User.query.get(uid) else "Unknown",
                    "count": cnt,
                }
                for uid, cnt in user_counts.items()
            ],
            key=lambda r: r["count"],
            reverse=True,
        )

        by_module = sorted(
            [{"module": m, "count": c} for m, c in module_counts.items()],
            key=lambda r: r["count"],
            reverse=True,
        )

        return jsonify({
            "success": True,
            "data": {
                "stats": {"total_logs": total_logs, "unique_users": unique_users},
                "by_user": by_user,
                "by_module": by_module,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── SYSTEM REPORTS ──

@reports_bp.route("/api/reports/system/summary", methods=["GET"])
def system_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        now = datetime.now()
        cutoff_7d = now - timedelta(days=7)
        cutoff_30d = now - timedelta(days=30)

        activity_7d = ActivityLog.query.filter(ActivityLog.timestamp >= cutoff_7d).count()
        activity_30d = ActivityLog.query.filter(ActivityLog.timestamp >= cutoff_30d).count()

        backups = storage_list_backups()
        backups.sort(key=lambda b: b["created_at"], reverse=True)

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "backup_count": len(backups),
                    "activity_7d": activity_7d,
                    "activity_30d": activity_30d,
                },
                "backups": backups,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/store-reports", methods=["GET"])
def get_store_reports():
    usertype = request.args.get("usertype", type=int)
    user_id = request.args.get("user_id", type=int)

    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        query = StoreReport.query

        if usertype == 2:
            user = User.query.get(user_id)
            if user:
                query = query.filter(StoreReport.location_id == user.location_id)

        reports = query.order_by(StoreReport.created_at.desc()).all()

        return jsonify({
            "success": True,
            "data": [{
                "report_id": r.report_id,
                "user_id": r.user_id,
                "username": r.user.username if r.user else None,
                "location_id": r.location_id,
                "location_name": r.location.name if r.location else None,
                "title": r.title,
                "issue_type": r.issue_type,
                "description": r.description,
                "status": r.status,
                "resolved_by": r.resolved_by,
                "resolved_by_username": r.resolver.username if r.resolver else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            } for r in reports]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/store-reports", methods=["POST"])
def create_store_report():
    data = request.get_json()
    usertype = data.get("usertype")
    user_id = data.get("user_id")
    location_id = data.get("location_id")
    title = data.get("title")
    issue_type = data.get("issue_type")
    description = data.get("description")

    if not all([usertype, user_id, location_id, title, issue_type, description]):
        return jsonify({"success": False, "error": "Missing required fields"}), 400

    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        report = StoreReport(
            user_id=user_id,
            location_id=location_id,
            title=title,
            issue_type=issue_type,
            description=description,
            status="pending"
        )
        db.session.add(report)
        db.session.commit()

        return jsonify({
            "success": True,
            "data": {
                "report_id": report.report_id,
                "status": report.status,
                "created_at": report.created_at.isoformat()
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/store-reports/<int:report_id>", methods=["PUT"])
def update_store_report(report_id):
    data = request.get_json()
    usertype = data.get("usertype")
    user_id = data.get("user_id")

    report = StoreReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "error": "Report not found"}), 404

    if usertype not in [1, 2, 3]:
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    if usertype == 3 and report.user_id != user_id:
        return jsonify({"success": False, "error": "Cannot update other user's report"}), 403

    if usertype == 2:
        user = User.query.get(user_id)
        if not user or report.location_id != user.location_id:
            return jsonify({"success": False, "error": "Cannot update reports outside your branch"}), 403

    try:
        if "title" in data:
            report.title = data["title"]
        if "issue_type" in data:
            report.issue_type = data["issue_type"]
        if "description" in data:
            report.description = data["description"]
        if "status" in data:
            report.status = data["status"]
            if data["status"] == "resolved":
                from datetime import datetime
                report.resolved_by = user_id
                report.resolved_at = datetime.now()

        db.session.commit()

        return jsonify({
            "success": True,
            "data": {
                "report_id": report.report_id,
                "status": report.status,
                "resolved_at": report.resolved_at.isoformat() if report.resolved_at else None,
                "updated_at": report.updated_at.isoformat()
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@reports_bp.route("/api/store-reports/<int:report_id>", methods=["DELETE"])
def delete_store_report(report_id):
    usertype = request.args.get("usertype", type=int)
    user_id = request.args.get("user_id", type=int)

    report = StoreReport.query.get(report_id)
    if not report:
        return jsonify({"success": False, "error": "Report not found"}), 404

    if usertype not in [1, 2, 3]:
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    if usertype == 3 and report.user_id != user_id:
        return jsonify({"success": False, "error": "Cannot delete other user's report"}), 403

    if usertype == 2:
        user = User.query.get(user_id)
        if not user or report.location_id != user.location_id:
            return jsonify({"success": False, "error": "Cannot delete reports outside your branch"}), 403

    try:
        db.session.delete(report)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
