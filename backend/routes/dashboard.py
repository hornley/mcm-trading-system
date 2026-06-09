from datetime import datetime, timedelta
from flask import Blueprint, request
from sqlalchemy import func
from models import db, Product, Category, Location, Inventory, Order, OrderItem, User
from models import StockAdjustment, StockTransfer, ActivityLog
from utils.response import success_response, error_response

dashboard_bp = Blueprint("dashboard", __name__)


def _authorized(usertype):
    return usertype in [1, 2, 3]


def _resolve_location_id(usertype, user_id, requested_location_id):
    if usertype == 2:
        user = User.query.get(user_id)
        return user.location_id if user else None
    return requested_location_id


@dashboard_bp.route("/api/dashboard/summary", methods=["GET"])
def dashboard_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return error_response("Unauthorized", 401)

    try:
        user_id = request.args.get("user_id", type=int)
        location_id = _resolve_location_id(
            usertype, user_id, request.args.get("location_id", type=int)
        )

        now = datetime.now()
        today = now.date()

        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")

        # ── Stats ──
        inv_query = Inventory.query.join(Product).filter(Product.is_active == True)
        if location_id:
            inv_query = inv_query.filter(Inventory.location_id == location_id)
        all_inv = inv_query.all()
        total_items = sum(inv.quantity for inv in all_inv)

        low_stock_count = 0
        out_of_stock_count = 0
        for inv in all_inv:
            if inv.quantity == 0:
                out_of_stock_count += 1
            try:
                rl = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
            except (ValueError, TypeError):
                rl = 0
            if rl > 0 and inv.quantity <= rl:
                low_stock_count += 1

        sales_query = db.session.query(func.coalesce(func.sum(Order.total_amount), 0))
        sales_query = sales_query.filter(Order.status == "completed")
        if date_from:
            sales_query = sales_query.filter(Order.order_date >= datetime.fromisoformat(date_from))
        else:
            sales_query = sales_query.filter(func.date(Order.order_date) == today)
        if date_to:
            sales_query = sales_query.filter(Order.order_date <= datetime.fromisoformat(date_to))
        if location_id:
            sales_query = sales_query.filter(Order.location_id == location_id)
        sales_period = sales_query.scalar()

        transactions_query = db.session.query(func.count(Order.order_id)).filter(
            Order.status == "completed"
        )
        if date_from:
            transactions_query = transactions_query.filter(Order.order_date >= datetime.fromisoformat(date_from))
        else:
            transactions_query = transactions_query.filter(func.date(Order.order_date) == today)
        if date_to:
            transactions_query = transactions_query.filter(Order.order_date <= datetime.fromisoformat(date_to))
        if location_id:
            transactions_query = transactions_query.filter(Order.location_id == location_id)
        transactions_period = transactions_query.scalar()

        month_start = today.replace(day=1)
        month_sales_query = db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
            Order.status == "completed",
            Order.order_date >= datetime.combine(month_start, datetime.min.time()),
        )
        if location_id:
            month_sales_query = month_sales_query.filter(Order.location_id == location_id)
        month_sales = month_sales_query.scalar()

        active_users = User.query.count()

        # ── Stock by Category (pie chart) ──
        cat_query = db.session.query(
            Category.name,
            func.coalesce(func.sum(Inventory.quantity), 0).label("value")
        ).join(Product, Product.category_id == Category.category_id
        ).join(Inventory, Inventory.product_id == Product.product_id
        ).filter(Product.is_active == True)
        if location_id:
            cat_query = cat_query.filter(Inventory.location_id == location_id)
        stock_by_category = cat_query.group_by(Category.category_id).all()
        pie_data = [{"name": r.name, "value": r.value} for r in stock_by_category]

        # ── Stock Movement (last 7 days, bar chart) ──
        cutoff = now - timedelta(days=6)
        adj_query = StockAdjustment.query.filter(StockAdjustment.date >= cutoff)
        transfer_query = StockTransfer.query.filter(StockTransfer.transfer_date >= cutoff)
        if location_id:
            adj_query = adj_query.filter(StockAdjustment.location_id == location_id)
            transfer_query = transfer_query.filter(
                (StockTransfer.from_location_id == location_id) |
                (StockTransfer.to_location_id == location_id)
            )

        movement_map = {}
        for adj in adj_query.all():
            d = adj.date.strftime("%a") if adj.date else "Unknown"
            if d not in movement_map:
                movement_map[d] = {"in": 0, "out": 0}
            if adj.quantity_change > 0:
                movement_map[d]["in"] += adj.quantity_change
            else:
                movement_map[d]["out"] += abs(adj.quantity_change)

        for t in transfer_query.all():
            d = t.transfer_date.strftime("%a") if t.transfer_date else "Unknown"
            if d not in movement_map:
                movement_map[d] = {"in": 0, "out": 0}
            if not location_id:
                movement_map[d]["in"] += t.quantity
                movement_map[d]["out"] += t.quantity
            else:
                if t.to_location_id == location_id:
                    movement_map[d]["in"] += t.quantity
                if t.from_location_id == location_id:
                    movement_map[d]["out"] += t.quantity

        day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        stock_movement = [
            {"day": d, "in": movement_map.get(d, {}).get("in", 0),
             "out": movement_map.get(d, {}).get("out", 0)}
            for d in day_order
        ]

        # ── Recent Transactions (last 5 completed orders) ──
        orders_query = Order.query.filter(Order.status == "completed")
        if location_id:
            orders_query = orders_query.filter(Order.location_id == location_id)
        recent_orders = orders_query.order_by(Order.order_date.desc()).limit(5).all()

        recent_transactions = []
        for order in recent_orders:
            items = OrderItem.query.filter_by(order_id=order.order_id).all()
            for item in items:
                recent_transactions.append({
                    "key": order.order_id,
                    "product": item.product.name if item.product else "Unknown",
                    "quantity": item.quantity,
                    "amount": f"₱{item.quantity * item.price:,.2f}",
                    "branch": order.location.name if order.location else "Unknown",
                    "status": order.status,
                    "date": order.order_date.strftime("%Y-%m-%d") if order.order_date else "",
                    "color": item.variety.color if item.variety else None,
                    "pattern": item.variety.pattern if item.variety else None,
                })

        # ── Admin data (only when usertype is admin) ──
        admin_stats = {}
        if usertype in [1, 3]:
            cutoff_7d = now - timedelta(days=7)
            admin_stats = {
                "total_users": User.query.count(),
                "last_maintenance": "",
                "system_operational": True,
                "activity_7d": ActivityLog.query.filter(ActivityLog.timestamp >= cutoff_7d).count(),
            }

        # ── Low Stock Items (for manager table) ──
        low_stock_items = []
        for inv in all_inv:
            try:
                rl = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
            except (ValueError, TypeError):
                rl = 0
            if rl > 0 and inv.quantity <= rl:
                low_stock_items.append({
                    "key": inv.inventory_id,
                    "product_name": inv.product.name if inv.product else "Unknown",
                    "category": inv.product.category.name if inv.product and inv.product.category else "",
                    "quantity": inv.quantity,
                    "color": inv.variety.color if inv.variety else None,
                    "pattern": inv.variety.pattern if inv.variety else None,
                })

        return success_response({
            "stats": {
                "total_items": total_items,
                "sales_today": sales_period,
                "month_sales": month_sales,
                "transactions_today": transactions_period,
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "active_users": active_users,
            },
            "stock_by_category": pie_data,
            "stock_movement": stock_movement,
            "recent_transactions": recent_transactions,
            "admin_stats": admin_stats,
            "low_stock_items": low_stock_items,
        })
    except Exception as e:
        return error_response(str(e), 500)
