from flask import Blueprint, request
from datetime import datetime
from sqlalchemy import cast, String
from models import db, User, Order, OrderItem, Payment, Product, Inventory, Location, ProductVariety
from utils.response import success_response, error_response
from utils.validation import validate_required, validate_quantity
from utils.activity_logger import log_activity
from routes.inventory import check_and_auto_restock

orders_bp = Blueprint("orders", __name__)


def _authorized(usertype):
    return usertype in [1, 2, 3]


def _can_sell(usertype):
    return usertype == 2


def _resolve_location_id(usertype, user_id, requested_location_id):
    if usertype == 2:
        user = User.query.get(user_id)
        if not user:
            return None, error_response("User not found", "NOT_FOUND", 404)
        return user.location_id, None
    if usertype in [1, 3]:
        user = User.query.get(user_id)
        if user:
            return user.location_id or requested_location_id, None
    return requested_location_id, None


def _serialize_order_detail(order):
    items = OrderItem.query.filter_by(order_id=order.order_id).all()
    payments = Payment.query.filter_by(order_id=order.order_id).all()
    return {
        "order_id": order.order_id,
        "location_id": order.location_id,
        "location_name": order.location.name if order.location else None,
        "location_address": order.location.address if order.location else None,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "status": order.status,
        "total_amount": order.total_amount,
        "items": [
            {
                "order_item_id": item.order_item_id,
                "product_id": item.product_id,
                "variety_id": item.variety_id,
                "product_name": item.product.name if item.product else "Unknown",
                "category": item.product.category.name if item.product and item.product.category else None,
                "is_active": item.product.is_active if item.product else True,
                "quantity": item.quantity,
                "price": item.price,
                "line_total": item.quantity * item.price,
                "color": item.variety.color if item.variety else None,
                "pattern": item.variety.pattern if item.variety else None,
            }
            for item in items
        ],
        "payments": [
            {
                "payment_id": p.payment_id,
                "payment_method": p.payment_method,
                "quantity": p.quantity,
                "price": p.price,
            }
            for p in payments
        ],
        "item_count": len(items),
    }


def _serialize_order_list(order):
    first_payment = Payment.query.filter_by(order_id=order.order_id).first()
    items = OrderItem.query.filter_by(order_id=order.order_id).all()
    return {
        "order_id": order.order_id,
        "location_id": order.location_id,
        "location_name": order.location.name if order.location else None,
        "location_address": order.location.address if order.location else None,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "status": order.status,
        "total_amount": order.total_amount,
        "item_count": len(items),
        "product_names": [
            _item_label(item) for item in items if item.product
        ],
        "product_categories": {item.product_id: (item.product.category.name if item.product and item.product.category else None) for item in items},
        "payment_method": first_payment.payment_method if first_payment else None,
        "payment_price": first_payment.price if first_payment else None,
    }


def _item_label(item):
    label = item.product.name if item.product else "Unknown"
    parts = []
    if item.variety and item.variety.color:
        parts.append(item.variety.color)
    if item.variety and item.variety.pattern:
        parts.append(item.variety.pattern)
    if parts:
        label += f" ({', '.join(parts)})"
    return label


@orders_bp.route("/api/orders", methods=["POST"])
def create_order():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if not _can_sell(usertype):
        return error_response("Only managers can create orders", "FORBIDDEN", 403)

    error = validate_required(data, ["items", "payment_method", "payment_amount"])
    if error:
        return error

    items_data = data.get("items", [])
    if not items_data or not isinstance(items_data, list):
        return error_response("items must be a non-empty array", "INVALID_ITEMS", 400)

    user_id = data.get("user_id")
    location_id = data.get("location_id")

    resolved_location_id, err = _resolve_location_id(usertype, user_id, location_id)
    if err:
        return err

    if not resolved_location_id:
        return error_response("location_id is required", "MISSING_PARAM", 400)

    location = Location.query.get(resolved_location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    order_date_str = data.get("order_date")
    order_date = None
    if order_date_str:
        try:
            cleaned = order_date_str.replace("Z", "+00:00")
            order_date = datetime.fromisoformat(cleaned)
        except (ValueError, TypeError):
            return error_response("Invalid order_date format. Use ISO format", "INVALID_DATE", 400)

    payment_method = data.get("payment_method")
    try:
        payment_amount = int(data["payment_amount"])
    except (ValueError, TypeError):
        return error_response("payment_amount must be a valid integer", "INVALID_VALUE", 400)

    resolved_items = []
    total_amount = 0
    total_quantity = 0
    seen_product_ids = set()

    for idx, item in enumerate(items_data):
        pid = item.get("product_id")
        vid = item.get("variety_id")
        qty = item.get("quantity")

        if not pid:
            return error_response(f"Item {idx}: product_id is required", "MISSING_FIELDS", 400)

        product = Product.query.get(pid)
        if not product or not product.is_active:
            return error_response(f"Product {pid} not found or inactive", "NOT_FOUND", 404)

        if vid:
            variety = ProductVariety.query.get(vid)
            if not variety or variety.product_id != pid:
                return error_response(f"Variety {vid} not found for product {pid}", "NOT_FOUND", 404)

        qty_error = validate_quantity(qty, "quantity", product.category_id)
        if qty_error:
            return error_response(f"Item {idx}: {qty_error.get('message', 'Invalid quantity')}", "INVALID_VALUE", 400)
        qty = float(qty)

        if pid in seen_product_ids:
            return error_response(f"Duplicate product_id {pid} in items", "DUPLICATE_PRODUCT", 400)
        seen_product_ids.add(pid)

        inventory = Inventory.query.filter_by(
            product_id=pid,
            location_id=resolved_location_id,
            variety_id=vid or None,
        ).first()
        if not inventory or inventory.quantity < qty:
            available = inventory.quantity if inventory else 0
            return error_response(
                f"Insufficient stock for {product.name}: requested {qty}, available {available}",
                "INSUFFICIENT_STOCK", 400,
            )

        resolved_items.append({
            "product": product,
            "variety_id": vid,
            "quantity": qty,
            "price": product.price,
        })
        total_amount += product.price * qty
        total_quantity += qty

    if payment_amount < total_amount:
        return error_response(
            f"Payment amount ({payment_amount}) is less than total ({total_amount})",
            "INSUFFICIENT_PAYMENT", 400,
        )

    order = Order(
        location_id=resolved_location_id,
        order_date=order_date or datetime.now(),
        status="completed",
        total_amount=total_amount,
    )
    db.session.add(order)
    db.session.flush()

    for ri in resolved_items:
        oi = OrderItem(
            order_id=order.order_id,
            product_id=ri["product"].product_id,
            variety_id=ri.get("variety_id"),
            quantity=ri["quantity"],
            price=ri["price"],
        )
        db.session.add(oi)

        inv = Inventory.query.filter_by(
            product_id=ri["product"].product_id,
            location_id=resolved_location_id,
            variety_id=ri.get("variety_id") or None,
        ).first()
        if inv:
            inv.quantity -= ri["quantity"]

    payment = Payment(
        order_id=order.order_id,
        payment_method=payment_method,
        quantity=total_quantity,
        price=payment_amount,
    )
    db.session.add(payment)

    db.session.commit()

    check_and_auto_restock(resolved_location_id)

    log_activity(
        user_id=user_id,
        module="orders",
        action_type="create",
        action=f"Created order #{order.order_id} with {len(resolved_items)} item(s), total ₱{total_amount}",
        details={
            "order_id": order.order_id,
            "item_count": len(resolved_items),
            "total_amount": total_amount,
            "payment_method": payment_method,
        },
    )

    response_data = _serialize_order_detail(order)
    return success_response(
        response_data,
        f"Order #{order.order_id} created successfully",
    )


@orders_bp.route("/api/orders", methods=["GET"])
def list_orders():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return error_response("Unauthorized", "UNAUTHORIZED", 403)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")

    resolved_location_id, err = _resolve_location_id(usertype, user_id, location_id)
    if err:
        return err

    status = request.args.get("status")
    search = request.args.get("q", "").strip()
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    sort_by = request.args.get("sort_by", "order_date")
    sort_order = request.args.get("sort_order", "desc")

    query = Order.query

    if resolved_location_id and resolved_location_id != "all":
        query = query.filter(Order.location_id == resolved_location_id)

    if status:
        query = query.filter(Order.status == status)

    if search:
        query = query.filter(cast(Order.order_id, String).startswith(search))

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            query = query.filter(Order.order_date >= dt_from)
        except (ValueError, TypeError):
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            query = query.filter(Order.order_date <= dt_to)
        except (ValueError, TypeError):
            pass

    sort_col = getattr(Order, sort_by, Order.order_date)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    page = max(1, page)
    limit = max(1, min(100, limit))

    include_items = request.args.get("include_items", "").lower() == "true"

    total_count = query.count()
    orders = query.offset((page - 1) * limit).limit(limit).all()

    serializer = _serialize_order_detail if include_items else _serialize_order_list

    return success_response({
        "orders": [serializer(o) for o in orders],
        "total_count": total_count,
        "page": page,
        "limit": limit,
    })


@orders_bp.route("/api/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return error_response("Unauthorized", "UNAUTHORIZED", 403)

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", "NOT_FOUND", 404)

    return success_response(_serialize_order_detail(order))


@orders_bp.route("/api/orders/<int:order_id>/void", methods=["PUT"])
def void_order(order_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if not _can_sell(usertype):
        return error_response("Only managers can void orders", "FORBIDDEN", 403)

    user_id = data.get("user_id")

    order = Order.query.get(order_id)
    if not order:
        return error_response("Order not found", "NOT_FOUND", 404)

    if order.status == "voided":
        return error_response("Order is already voided", "ALREADY_VOIDED", 400)

    if usertype == 2:
        user = User.query.get(user_id)
        if not user or user.location_id != order.location_id:
            return error_response("You can only void orders at your assigned location", "FORBIDDEN", 403)

    items = OrderItem.query.filter_by(order_id=order_id).all()
    for item in items:
        inventory = Inventory.query.filter_by(
            product_id=item.product_id,
            location_id=order.location_id,
        ).first()
        if inventory:
            inventory.quantity += item.quantity

    order.status = "voided"
    db.session.commit()

    log_activity(
        user_id=user_id,
        module="orders",
        action_type="void",
        action=f"Voided order #{order.order_id}",
        details={"order_id": order.order_id},
    )

    return success_response(_serialize_order_detail(order), f"Order #{order.order_id} voided successfully")
