import math
from flask import Blueprint, request
from datetime import datetime
from models import db, User, Product, Category, Location, Inventory, StockAdjustment, StockTransfer, StockRequest, OrderItem, Notification, ProductVariety
from utils.response import success_response, error_response
from utils.validation import validate_required, validate_quantity, is_fabric_category
from utils.activity_logger import log_activity
from utils.sorting import quick_sort

inventory_bp = Blueprint("inventory", __name__)


def _resolve_location_id(usertype, user_id, requested_location_id):
    if usertype == 2:
        user = User.query.get(user_id)
        if not user:
            return None, error_response("User not found", "NOT_FOUND", 404)
        return user.location_id, None
    return requested_location_id, None


def _can_create(usertype):
    return usertype in [1, 3]


def _can_update(usertype):
    return usertype in [1, 2, 3]


def _can_delete(usertype):
    return usertype in [1, 3]


def check_and_auto_restock(location_id):
    location = Location.query.get(location_id)
    if not location:
        return
    inventory_list = Inventory.query.filter_by(location_id=location_id).all()
    for inv in inventory_list:
        product = inv.product
        if not product or not product.auto_restock_source_id:
            continue
        source_id = product.auto_restock_source_id
        source = Location.query.get(source_id)
        if not source:
            continue
        try:
            level = int(product.reorder_level) if product and product.reorder_level else 0
        except (ValueError, TypeError):
            level = 0
        if level <= 0 or inv.quantity >= level:
            continue
        source_inv = Inventory.query.filter_by(product_id=inv.product_id, location_id=source_id).first()
        deficit = level - inv.quantity
        if not source_inv or source_inv.quantity <= 0:
            db.session.add(Notification(
                location_id=location_id, type="restock_failed",
                message=f"Auto-restock failed for {inv.product.name}: insufficient stock at {source.name}",
            ))
            continue
        transfer_qty = min(deficit, source_inv.quantity)
        if transfer_qty <= 0:
            continue
        stock_request = StockRequest(
            product_id=inv.product_id, from_location_id=source_id, to_location_id=location_id,
            requested_by=0, quantity=transfer_qty,
            description=f"Auto-restock (below reorder level {level})", status="pending",
        )
        db.session.add(stock_request)
        db.session.flush()
        db.session.add(Notification(
            location_id=location_id, type="restock_pending",
            message=f"Auto-restock request for {inv.product.name} x {transfer_qty} sent to {source.name}",
            request_id=stock_request.request_id,
        ))
        db.session.add(Notification(
            location_id=source_id, type="restock_pending",
            message=f"Auto-restock request from {location.name} for {inv.product.name} x {transfer_qty}",
            request_id=stock_request.request_id,
        ))
    db.session.commit()


def _generate_sku():
    count = Product.query.count()
    return f"PROD-{count + 1:03d}"


def _get_variety_stock(variety_id, location_id=None):
    inv = Inventory.query.filter_by(variety_id=variety_id)
    if location_id:
        inv = inv.filter_by(location_id=location_id)
    total = sum(i.quantity for i in inv.all())
    return total


def _serialize_product(product, include_inventory=False, location_id=None):
    varieties = ProductVariety.query.filter_by(product_id=product.product_id).all()
    data = {
        "product_id": product.product_id,
        "name": product.name,
        "category_id": product.category_id,
        "category": product.category.name if product.category else None,
        "price": product.price,
        "reorder_level": product.reorder_level,
        "auto_restock_source_id": product.auto_restock_source_id,
        "description": product.description,
        "sku": product.sku,
        "unit": product.unit,
        "is_active": product.is_active,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        "varieties": [
            {
                "variety_id": v.variety_id,
                "variety_sku": v.variety_sku,
                "color": v.color,
                "pattern": v.pattern,
                "stock": _get_variety_stock(v.variety_id, location_id),
            }
            for v in varieties
        ],
    }
    if include_inventory:
        inventory = Inventory.query.filter_by(product_id=product.product_id).all()
        data["inventory"] = [
            {
                "inventory_id": inv.inventory_id,
                "location_id": inv.location_id,
                "location_name": inv.location.name if inv.location else None,
                "quantity": inv.quantity,
                "variety_id": inv.variety_id,
            }
            for inv in inventory
        ]
    return data


@inventory_bp.route("/api/products", methods=["GET"])
def list_products():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")
    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")
    search = request.args.get("q", "").strip()
    category_id = request.args.get("category_id", type=int)
    is_active = request.args.get("is_active")

    resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
    if error:
        return error

    query = Product.query

    if search:
        query = query.filter(
            Product.name.ilike(f"%{search}%") |
            Product.sku.ilike(f"%{search}%")
        )

    if category_id:
        query = query.filter_by(category_id=category_id)

    if is_active is not None:
        is_active_val = is_active.lower() == "true"
        query = query.filter_by(is_active=is_active_val)

    products = quick_sort(query.all(), key=sort_by, order=sort_order)

    result = []
    for p in products:
        data = _serialize_product(p, location_id=resolved_location_id)
        if resolved_location_id is not None and resolved_location_id != "all":
            inventory = Inventory.query.filter_by(
                product_id=p.product_id,
                location_id=resolved_location_id
            ).first()
            data["quantity"] = inventory.quantity if inventory else 0
        else:
            total = db.session.query(db.func.sum(Inventory.quantity)).filter_by(product_id=p.product_id).scalar()
            data["quantity"] = total or 0
        result.append(data)

    return success_response(result)


@inventory_bp.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")

    resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
    if error:
        return error

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    data = _serialize_product(product)

    if resolved_location_id and resolved_location_id != "all":
        inventory = Inventory.query.filter_by(
            product_id=product_id,
            location_id=resolved_location_id
        ).all()
    else:
        inventory = Inventory.query.filter_by(product_id=product_id).all()

    data["inventory"] = [
        {
            "inventory_id": inv.inventory_id,
            "location_id": inv.location_id,
            "location_name": inv.location.name if inv.location else None,
            "quantity": inv.quantity,
        }
        for inv in inventory
    ]
    data["quantity"] = sum(inv.quantity for inv in inventory)

    return success_response(data)


@inventory_bp.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_create(usertype):
        return error_response("You don't have permission to create products", "FORBIDDEN", 403)

    error = validate_required(data, ["name", "category_id", "price"])
    if error:
        return error

    category = Category.query.get(data["category_id"])
    if not category:
        return error_response("Category not found", "NOT_FOUND", 404)

    sku = data.get("sku", "").strip()
    if not sku:
        sku = _generate_sku()
    else:
        existing = Product.query.filter_by(sku=sku).first()
        if existing:
            return error_response("SKU already exists", "DUPLICATE_SKU", 409)

    product = Product(
        name=data["name"],
        category_id=data["category_id"],
        price=data["price"],
        reorder_level=data.get("reorder_level"),
        description=data.get("description"),
        sku=sku,
        unit=data.get("unit"),
    )
    db.session.add(product)
    db.session.flush()

    locations = Location.query.filter_by(is_active=True).all()
    for location in locations:
        inventory = Inventory(
            product_id=product.product_id,
            location_id=location.location_id,
            quantity=0,
        )
        db.session.add(inventory)

    varieties_data = data.get("varieties", [])
    for v in varieties_data:
        color = v.get("color")
        pattern = v.get("pattern")
        vs = v.get("variety_sku", "").strip()
        if not vs:
            vs = f"{sku}-{ProductVariety.query.count() + 1:02d}"
        existing_v = ProductVariety.query.filter_by(variety_sku=vs).first()
        if existing_v:
            return error_response(f"Variety SKU {vs} already exists", "DUPLICATE_VARIETY_SKU", 409)
        db.session.add(ProductVariety(
            product_id=product.product_id,
            variety_sku=vs,
            color=color or None,
            pattern=pattern or None,
        ))

    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="create",
        action=f"Created product {product.name}",
        details={"product_id": product.product_id, "sku": product.sku}
    )

    return success_response(_serialize_product(product), "Product created successfully")


@inventory_bp.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to update products", "FORBIDDEN", 403)

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    if data.get("name"):
        product.name = data["name"]
    if "category_id" in data:
        category = Category.query.get(data["category_id"])
        if not category:
            return error_response("Category not found", "NOT_FOUND", 404)
        product.category_id = data["category_id"]
    if "price" in data:
        product.price = data["price"]
    if "reorder_level" in data:
        product.reorder_level = data["reorder_level"]
    if "auto_restock_source_id" in data:
        product.auto_restock_source_id = data["auto_restock_source_id"]
    if "description" in data:
        product.description = data["description"]
    if "unit" in data:
        product.unit = data["unit"]

    new_sku = data.get("sku", "").strip()
    if new_sku and new_sku != product.sku:
        existing = Product.query.filter_by(sku=new_sku).first()
        if existing and existing.product_id != product_id:
            return error_response("SKU already exists", "DUPLICATE_SKU", 409)
        product.sku = new_sku

    if "varieties" in data:
        ProductVariety.query.filter_by(product_id=product_id).delete()
        for v in data["varieties"]:
            color = v.get("color")
            pattern = v.get("pattern")
            vs = v.get("variety_sku", "").strip()
            if not vs:
                vs = f"{product.sku}-{ProductVariety.query.count() + 1:02d}"
            existing_v = ProductVariety.query.filter_by(variety_sku=vs).first()
            if existing_v and existing_v.product_id != product_id:
                return error_response(f"Variety SKU {vs} already exists", "DUPLICATE_VARIETY_SKU", 409)
            db.session.add(ProductVariety(
                product_id=product_id,
                variety_sku=vs,
                color=color or None,
                pattern=pattern or None,
            ))

    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="update",
        action=f"Updated product {product.name}",
        details={"product_id": product.product_id}
    )

    return success_response(_serialize_product(product), "Product updated successfully")


@inventory_bp.route("/api/products/<int:product_id>/void", methods=["PUT"])
def void_product(product_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to void products", "FORBIDDEN", 403)

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    if not product.is_active:
        return error_response("Product is already voided", "ALREADY_VOIDED", 400)

    product.is_active = False
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="void",
        action=f"Voided product {product.name}",
        details={"product_id": product.product_id}
    )

    return success_response(_serialize_product(product), "Product voided successfully")


@inventory_bp.route("/api/products/<int:product_id>/restore", methods=["PUT"])
def restore_product(product_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to restore products", "FORBIDDEN", 403)

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    if product.is_active:
        return error_response("Product is already active", "ALREADY_ACTIVE", 400)

    product.is_active = True
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="restore",
        action=f"Restored product {product.name}",
        details={"product_id": product.product_id}
    )

    return success_response(_serialize_product(product), "Product restored successfully")


@inventory_bp.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_delete(usertype):
        return error_response("You don't have permission to delete products", "FORBIDDEN", 403)

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    product_name = product.name

    try:
        OrderItem.query.filter_by(product_id=product_id).delete()
        StockTransfer.query.filter_by(product_id=product_id).delete()
        StockAdjustment.query.filter_by(product_id=product_id).delete()
        StockRequest.query.filter_by(product_id=product_id).delete()
        Inventory.query.filter_by(product_id=product_id).delete()
        ProductVariety.query.filter_by(product_id=product_id).delete()

        db.session.delete(product)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_response(f"Failed to delete product: {str(e)}", "DELETE_ERROR", 500)

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="delete",
        action=f"Deleted product {product_name}",
        details={"product_id": product_id}
    )

    return success_response(message="Product deleted successfully")


@inventory_bp.route("/api/inventory/counts", methods=["GET"])
def inventory_counts():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")

    resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
    if error:
        return error

    query = Inventory.query.join(Product).filter(Product.is_active == True)
    if resolved_location_id and resolved_location_id != "all":
        query = query.filter(Inventory.location_id == resolved_location_id)

    all_inv = query.all()

    total_items = len(all_inv)
    low_stock_count = sum(1 for i in all_inv if i.quantity > 0 and i.quantity <= 10)
    out_of_stock_count = sum(1 for i in all_inv if i.quantity == 0)

    pending_request_count = StockRequest.query.filter_by(status="pending", requested_by=user_id).count()

    return success_response({
        "total_items": total_items,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "pending_request_count": pending_request_count,
    })


@inventory_bp.route("/api/inventory", methods=["GET"])
def list_inventory():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")

    resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
    if error:
        return error

    query = Inventory.query.join(Product).filter(Product.is_active == True)

    if resolved_location_id and resolved_location_id != "all":
        query = query.filter(Inventory.location_id == resolved_location_id)

    search = request.args.get("q", "").strip()
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    status_filter = request.args.get("status", "").strip()
    sort_by = request.args.get("sort_by", "product_name")
    sort_order = request.args.get("sort_order", "asc")

    sort_map = {
        "product_name": Product.name,
        "location_name": Location.name,
        "quantity": Inventory.quantity,
        "reorder_level": Product.reorder_level,
    }
    sort_col = sort_map.get(sort_by, Product.name)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    page = max(1, page)
    limit = max(1, min(100, limit))

    if status_filter == "out_of_stock":
        query = query.filter(Inventory.quantity == 0)
    elif status_filter == "low_stock":
        query = query.filter(Inventory.quantity > 0, Inventory.quantity <= 10)
    elif status_filter == "in_stock":
        query = query.filter(Inventory.quantity > 10)

    total_count = query.count()

    inventory = query.offset((page - 1) * limit).limit(limit).all()

    return success_response({
        "data": [
            {
                "inventory_id": inv.inventory_id,
                "product_id": inv.product_id,
                "variety_id": inv.variety_id,
                "product_name": inv.product.name,
                "sku": inv.product.sku,
                "category_id": inv.product.category_id,
                "category": inv.product.category.name if inv.product.category else None,
                "unit": inv.product.unit,
                "location_id": inv.location_id,
                "location_name": inv.location.name if inv.location else None,
                "quantity": inv.quantity,
                "reorder_level": inv.product.reorder_level,
                "auto_restock_source_id": inv.product.auto_restock_source_id,
                "color": inv.variety.color if inv.variety else None,
                "pattern": inv.variety.pattern if inv.variety else None,
                "variety_sku": inv.variety.variety_sku if inv.variety else None,
            }
            for inv in inventory
        ],
        "total_count": total_count,
        "page": page,
        "limit": limit,
    })


@inventory_bp.route("/api/inventory/location/<int:location_id>", methods=["GET"])
def get_inventory_by_location(location_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)

    resolved_location_id, error = _resolve_location_id(usertype, user_id, str(location_id))
    if error:
        return error

    if usertype == 2:
        if not resolved_location_id or int(resolved_location_id) != location_id:
            return error_response("You can only view inventory at your assigned location", "FORBIDDEN", 403)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    inventory = Inventory.query.join(Product).filter(
        Inventory.location_id == location_id,
        Product.is_active == True
    ).order_by(Product.name.asc()).all()

    return success_response([
        {
            "inventory_id": inv.inventory_id,
            "product_id": inv.product_id,
            "variety_id": inv.variety_id,
            "product_name": inv.product.name,
            "sku": inv.product.sku,
            "category_id": inv.product.category_id,
            "category": inv.product.category.name if inv.product.category else None,
            "unit": inv.product.unit,
            "quantity": inv.quantity,
            "color": inv.variety.color if inv.variety else None,
            "pattern": inv.variety.pattern if inv.variety else None,
            "variety_sku": inv.variety.variety_sku if inv.variety else None,
        }
        for inv in inventory
    ])


@inventory_bp.route("/api/inventory/product/<int:product_id>", methods=["GET"])
def get_inventory_by_product(product_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")
    stock_check = request.args.get("stock_check", type=int)

    if stock_check:
        resolved_location_id = location_id
    else:
        resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
        if error:
            return error

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    query = Inventory.query.filter_by(product_id=product_id)
    if resolved_location_id and resolved_location_id != "all":
        query = query.filter_by(location_id=resolved_location_id)

    inventory = query.all()

    return success_response([
        {
            "inventory_id": inv.inventory_id,
            "product_id": product.product_id,
            "variety_id": inv.variety_id,
            "product_name": product.name,
            "category_id": product.category_id,
            "category": product.category.name if product.category else None,
            "unit": product.unit,
            "location_id": inv.location_id,
            "location_name": inv.location.name if inv.location else None,
            "quantity": inv.quantity,
            "color": inv.variety.color if inv.variety else None,
            "pattern": inv.variety.pattern if inv.variety else None,
            "variety_sku": inv.variety.variety_sku if inv.variety else None,
        }
        for inv in inventory
    ])


@inventory_bp.route("/api/inventory/adjust", methods=["POST"])
def adjust_inventory():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to adjust inventory", "FORBIDDEN", 403)

    if usertype == 2:
        manager = User.query.get(data.get("user_id"))
        if not manager:
            return error_response("User not found", "NOT_FOUND", 404)
        if manager.location_id != data.get("location_id"):
            return error_response("You can only adjust inventory at your assigned location", "FORBIDDEN", 403)

    error = validate_required(data, ["product_id", "location_id", "quantity_change"])
    if error:
        return error

    product = Product.query.get(data["product_id"])
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    quantity_change = float(data["quantity_change"])
    if quantity_change == 0:
        return error_response("quantity_change must not be zero", "INVALID_VALUE", 400)
    qty_error = validate_quantity(abs(quantity_change), "quantity_change", product.category_id)
    if qty_error:
        return qty_error

    location = Location.query.get(data["location_id"])
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    inventory = Inventory.query.filter_by(
        product_id=data["product_id"],
        location_id=data["location_id"]
    ).first()

    if not inventory:
        return error_response("Inventory record not found", "NOT_FOUND", 404)

    new_quantity = inventory.quantity + quantity_change
    if new_quantity < 0:
        return error_response("Insufficient stock. Resulting quantity would be negative", "INSUFFICIENT_STOCK", 400)

    inventory.quantity = new_quantity

    adjustment = StockAdjustment(
        product_id=data["product_id"],
        location_id=data["location_id"],
        user_id=data.get("user_id"),
        quantity_change=quantity_change,
        reason=data.get("reason"),
    )
    db.session.add(adjustment)
    db.session.commit()

    if quantity_change < 0:
        check_and_auto_restock(data["location_id"])

    log_activity(
        user_id=data.get("user_id"),
        module="inventory",
        action_type="adjust",
        action=f"Adjusted inventory for {product.name} at {location.name}: {quantity_change:+g}",
        details={
            "product_id": product.product_id,
            "location_id": location.location_id,
            "quantity_change": quantity_change,
            "new_quantity": new_quantity,
        }
    )

    return success_response(
        {
            "inventory_id": inventory.inventory_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "location_id": location.location_id,
            "location_name": location.name,
            "previous_quantity": inventory.quantity - quantity_change,
            "quantity_change": quantity_change,
            "new_quantity": new_quantity,
        },
        "Inventory adjusted successfully"
    )


@inventory_bp.route("/api/inventory/restock-below-reorder", methods=["POST"])
def restock_below_reorder():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to restock", "FORBIDDEN", 403)

    location_id = data.get("location_id")
    user_id = data.get("user_id")
    source_location_id = data.get("source_location_id")

    if not source_location_id:
        return error_response("source_location_id is required", "MISSING_PARAM", 400)

    if usertype == 2:
        manager = User.query.get(user_id)
        if not manager:
            return error_response("User not found", "NOT_FOUND", 404)
        if manager.location_id != location_id:
            return error_response("You can only restock your assigned location", "FORBIDDEN", 403)

    source = Location.query.get(source_location_id)
    if not source:
        return error_response("Source branch not found", "NOT_FOUND", 404)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    inventory_list = Inventory.query.filter_by(location_id=location_id).all()
    requested = []
    failed = []

    for inv in inventory_list:
        try:
            level = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
        except (ValueError, TypeError):
            level = 0

        if level <= 0:
            continue

        target = level + math.ceil(level / 2)
        if inv.quantity >= target:
            continue

        source_inv = Inventory.query.filter_by(
            product_id=inv.product_id,
            location_id=source_location_id,
        ).first()

        deficit = target - inv.quantity
        if not source_inv or source_inv.quantity <= 0 or deficit <= 0:
            failed.append({
                "product_id": inv.product_id,
                "product_name": inv.product.name,
                "reason": "Insufficient stock at source branch",
            })
            notif = Notification(
                location_id=location_id,
                type="restock_failed",
                message=f"Auto-restock failed for {inv.product.name}: insufficient stock at {source.name}",
            )
            db.session.add(notif)
            continue

        transfer_qty = min(deficit, source_inv.quantity)
        if transfer_qty <= 0:
            continue

        stock_request = StockRequest(
            product_id=inv.product_id,
            from_location_id=source_location_id,
            to_location_id=location_id,
            requested_by=user_id,
            quantity=transfer_qty,
            description=f"Auto-restock (below reorder level {level})",
            status="pending",
        )
        db.session.add(stock_request)
        db.session.flush()

        notif_target = Notification(
            location_id=location_id,
            type="restock_pending",
            message=f"Auto-restock request for {inv.product.name} x {transfer_qty} sent to {source.name}",
            request_id=stock_request.request_id,
        )
        db.session.add(notif_target)

        notif_source = Notification(
            location_id=source_location_id,
            type="restock_pending",
            message=f"Auto-restock request from {location.name} for {inv.product.name} x {transfer_qty}",
            request_id=stock_request.request_id,
        )
        db.session.add(notif_source)

        log_activity(
            user_id=user_id,
            module="inventory",
            action_type="auto_restock_request",
            action=f"Requested {transfer_qty} {inv.product.name} from {source.name} to {location.name}",
            details={
                "product_id": inv.product_id,
                "from_location_id": source_location_id,
                "to_location_id": location_id,
                "quantity": transfer_qty,
                "request_id": stock_request.request_id,
            },
        )

        requested.append({
            "product_id": inv.product_id,
            "product_name": inv.product.name,
            "quantity": transfer_qty,
            "request_id": stock_request.request_id,
        })

    db.session.commit()

    return success_response({
        "requested": requested,
        "failed": failed,
        "requested_count": len(requested),
        "failed_count": len(failed),
    }, f"{len(requested)} item(s) requested, {len(failed)} failed")


@inventory_bp.route("/api/inventory/restock-selected", methods=["POST"])
def restock_selected():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to restock", "FORBIDDEN", 403)

    location_id = data.get("location_id")
    user_id = data.get("user_id")
    items = data.get("items", [])

    if not items:
        return error_response("No items provided", "MISSING_ITEMS", 400)

    if usertype == 2:
        manager = User.query.get(user_id)
        if not manager:
            return error_response("User not found", "NOT_FOUND", 404)
        if manager.location_id != location_id:
            return error_response("You can only restock your assigned location", "FORBIDDEN", 403)

    storehouse = Location.query.filter_by(is_storehouse=True, is_active=True).first()
    if not storehouse:
        return error_response("No storehouse branch configured. Mark a location as storehouse first.", "NO_STOREHOUSE", 400)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    errors = []
    valid_items = []

    for item in items:
        product_id = item.get("product_id")
        requested_qty = item.get("quantity", 0)

        if not product_id or requested_qty <= 0:
            continue

        product = Product.query.get(product_id)
        if not product:
            errors.append(f"Product ID {product_id} (not found)")
            continue

        store_inv = Inventory.query.filter_by(
            product_id=product_id,
            location_id=storehouse.location_id,
        ).first()

        if not store_inv or store_inv.quantity <= 0:
            errors.append(f"{product.name} (no stock at storehouse)")
            continue

        if store_inv.quantity < requested_qty:
            errors.append(f"{product.name} (only {store_inv.quantity:.0f} available, requested {requested_qty:.0f})")
            continue

        valid_items.append({
            "product": product,
            "product_id": product_id,
            "quantity": requested_qty,
        })

    if errors:
        return error_response(
            "Cannot fulfill request. Issues: " + "; ".join(errors),
            "INSUFFICIENT_STOCK",
            400,
        )

    created = []
    for vi in valid_items:
        stock_request = StockRequest(
            product_id=vi["product_id"],
            from_location_id=storehouse.location_id,
            to_location_id=location_id,
            requested_by=user_id,
            quantity=vi["quantity"],
            description="Bulk restock request",
            status="pending",
        )
        db.session.add(stock_request)
        created.append({
            "product_id": vi["product_id"],
            "product_name": vi["product"].name,
            "quantity": vi["quantity"],
        })

    db.session.commit()

    return success_response(
        {"requests": created, "count": len(created)},
        f"Restock request submitted for {len(created)} product(s) — waiting for storehouse approval",
    )


@inventory_bp.route("/api/inventory/low-stock", methods=["GET"])
def get_low_stock():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")

    resolved_location_id, error = _resolve_location_id(usertype, user_id, location_id)
    if error:
        return error

    storehouse = Location.query.filter_by(is_storehouse=True, is_active=True).first()

    products = Product.query.filter_by(is_active=True).all()
    low_stock = []

    for product in products:
        reorder_level = product.reorder_level
        if reorder_level is None:
            continue
        try:
            level = int(reorder_level)
        except (ValueError, TypeError):
            continue

        query = Inventory.query.filter_by(product_id=product.product_id)
        if resolved_location_id is not None and resolved_location_id != "all":
            query = query.filter_by(location_id=resolved_location_id)

        store_qty = 0
        if storehouse:
            store_inv = Inventory.query.filter_by(
                product_id=product.product_id,
                location_id=storehouse.location_id,
            ).first()
            store_qty = store_inv.quantity if store_inv else 0

        inventory = query.all()
        for inv in inventory:
            if inv.quantity < level:
                low_stock.append({
                    "inventory_id": inv.inventory_id,
                    "product_id": product.product_id,
                    "product_name": product.name,
                    "sku": product.sku,
                    "category_id": product.category_id,
                    "category": product.category.name if product.category else None,
                    "location_id": inv.location_id,
                    "location_name": inv.location.name if inv.location else None,
                    "quantity": inv.quantity,
                    "reorder_level": level,
                    "storehouse_quantity": store_qty,
                })

    return success_response(low_stock)


@inventory_bp.route("/api/inventory/branch-needs", methods=["GET"])
def get_branch_needs():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    storehouse = Location.query.filter_by(is_storehouse=True, is_active=True).first()
    if not storehouse:
        return error_response("No storehouse configured", "NO_STOREHOUSE", 400)

    branches = Location.query.filter(
        Location.is_storehouse == False,
        Location.is_active == True
    ).all()

    branch_needs = []
    for branch in branches:
        items = Inventory.query.filter_by(location_id=branch.location_id).all()
        for inv in items:
            product = Product.query.get(inv.product_id)
            if not product or not product.reorder_level:
                continue
            try:
                level = int(product.reorder_level)
            except (ValueError, TypeError):
                continue
            if inv.quantity < level:
                store_inv = Inventory.query.filter_by(
                    product_id=product.product_id,
                    location_id=storehouse.location_id,
                ).first()
                branch_needs.append({
                    "product_id": product.product_id,
                    "product_name": product.name,
                    "category": product.category.name if product.category else None,
                    "branch_id": branch.location_id,
                    "branch_name": branch.name,
                    "current_qty": inv.quantity,
                    "reorder_level": level,
                    "deficit": level - inv.quantity,
                    "storehouse_qty": store_inv.quantity if store_inv else 0,
                })

    return success_response(branch_needs)


@inventory_bp.route("/api/stock/transfer", methods=["POST"])
def transfer_stock():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to transfer stock", "FORBIDDEN", 403)

    error = validate_required(data, ["product_id", "from_location_id", "to_location_id", "quantity"])
    if error:
        return error

    if usertype == 2:
        manager = User.query.get(data.get("user_id"))
        if not manager:
            return error_response("User not found", "NOT_FOUND", 404)
        if manager.location_id != data.get("from_location_id"):
            return error_response("You can only transfer stock from your assigned location", "FORBIDDEN", 403)

    product = Product.query.get(data["product_id"])
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    qty_error = validate_quantity(data["quantity"], "quantity", product.category_id)
    if qty_error:
        return qty_error
    quantity = float(data["quantity"])

    from_location = Location.query.get(data["from_location_id"])
    if not from_location:
        return error_response("Source location not found", "NOT_FOUND", 404)

    to_location = Location.query.get(data["to_location_id"])
    if not to_location:
        return error_response("Destination location not found", "NOT_FOUND", 404)

    if data["from_location_id"] == data["to_location_id"]:
        return error_response("Source and destination locations must be different", "SAME_LOCATION", 400)

    from_inventory = Inventory.query.filter_by(
        product_id=data["product_id"],
        location_id=data["from_location_id"]
    ).first()

    if not from_inventory or from_inventory.quantity < quantity:
        return error_response("Insufficient stock at source location", "INSUFFICIENT_STOCK", 400)

    to_inventory = Inventory.query.filter_by(
        product_id=data["product_id"],
        location_id=data["to_location_id"]
    ).first()

    from_inventory.quantity -= quantity

    if to_inventory:
        to_inventory.quantity += quantity
    else:
        to_inventory = Inventory(
            product_id=data["product_id"],
            location_id=data["to_location_id"],
            quantity=quantity,
        )
        db.session.add(to_inventory)

    transfer = StockTransfer(
        product_id=data["product_id"],
        from_location_id=data["from_location_id"],
        to_location_id=data["to_location_id"],
        user_id=data.get("user_id"),
        quantity=quantity,
        remarks=data.get("remarks"),
    )
    if data.get("transfer_date"):
        try:
            transfer.transfer_date = datetime.fromisoformat(data["transfer_date"])
        except (ValueError, TypeError):
            pass
    db.session.add(transfer)
    db.session.commit()

    check_and_auto_restock(data["from_location_id"])

    log_activity(
        user_id=data.get("user_id"),
        module="inventory",
        action_type="transfer",
        action=f"Transferred {product.name}: {quantity} from {from_location.name} to {to_location.name}",
        details={
            "product_id": product.product_id,
            "from_location_id": from_location.location_id,
            "to_location_id": to_location.location_id,
            "quantity": quantity,
        }
    )

    return success_response(
        {
            "transfer_id": transfer.transfer_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "from_location_id": from_location.location_id,
            "from_location_name": from_location.name,
            "to_location_id": to_location.location_id,
            "to_location_name": to_location.name,
            "quantity": quantity,
        },
        "Stock transferred successfully"
    )


@inventory_bp.route("/api/inventory/request-stock", methods=["POST"])
def request_stock():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to request stock", "FORBIDDEN", 403)

    error = validate_required(data, ["product_id", "from_location_id", "to_location_id", "quantity"])
    if error:
        return error

    product = Product.query.get(data["product_id"])
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    from_location = Location.query.get(data["from_location_id"])
    if not from_location:
        return error_response("Source location not found", "NOT_FOUND", 404)

    to_location = Location.query.get(data["to_location_id"])
    if not to_location:
        return error_response("Destination location not found", "NOT_FOUND", 404)

    if data["from_location_id"] == data["to_location_id"]:
        return error_response("Source and destination locations must be different", "SAME_LOCATION", 400)

    qty_error = validate_quantity(data["quantity"], "quantity", product.category_id)
    if qty_error:
        return qty_error
    quantity = float(data["quantity"])

    stock_request = StockRequest(
        product_id=data["product_id"],
        from_location_id=data["from_location_id"],
        to_location_id=data["to_location_id"],
        requested_by=data.get("user_id"),
        quantity=quantity,
        description=data.get("description"),
        status="pending",
    )
    db.session.add(stock_request)
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="inventory",
        action_type="request",
        action=f"Stock request: {quantity} {product.name} from {from_location.name} to {to_location.name}",
        details={
            "product_id": product.product_id,
            "from_location_id": from_location.location_id,
            "to_location_id": to_location.location_id,
            "quantity": quantity,
        }
    )

    return success_response(
        {
            "request_id": stock_request.request_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "from_location_id": from_location.location_id,
            "from_location_name": from_location.name,
            "to_location_id": to_location.location_id,
            "to_location_name": to_location.name,
            "quantity": quantity,
            "description": stock_request.description,
            "status": stock_request.status,
        },
        "Stock request submitted"
    )


@inventory_bp.route("/api/inventory/movements", methods=["GET"])
def get_inventory_movements():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    product_id = request.args.get("product_id", type=int)
    location_id = request.args.get("location_id")

    if not product_id:
        return error_response("product_id query parameter is required", "MISSING_PARAM", 400)

    adjustments = StockAdjustment.query.filter_by(product_id=product_id)
    transfers_from = StockTransfer.query.filter_by(product_id=product_id)
    transfers_to = StockTransfer.query.filter_by(product_id=product_id)

    if location_id:
        adjustments = adjustments.filter_by(location_id=location_id)
        transfers_from = transfers_from.filter_by(from_location_id=location_id)
        transfers_to = transfers_to.filter_by(to_location_id=location_id)

    movements = []

    for adj in adjustments.all():
        movements.append({
            "date": adj.date.isoformat() if adj.date else None,
            "type": "adjustment",
            "quantity_change": adj.quantity_change,
            "location_id": adj.location_id,
            "location_name": adj.location.name if adj.location else None,
            "reason": adj.reason,
            "remarks": None,
        })

    for t in transfers_from.all():
        movements.append({
            "date": t.transfer_date.isoformat() if t.transfer_date else None,
            "type": "transfer_out",
            "quantity_change": -t.quantity,
            "location_id": t.from_location_id,
            "location_name": t.from_location.name if t.from_location else None,
            "reason": "Transfer out",
            "remarks": t.remarks or f"To: {t.to_location.name if t.to_location else 'Unknown'}",
        })

    for t in transfers_to.all():
        movements.append({
            "date": t.transfer_date.isoformat() if t.transfer_date else None,
            "type": "transfer_in",
            "quantity_change": t.quantity,
            "location_id": t.to_location_id,
            "location_name": t.to_location.name if t.to_location else None,
            "reason": "Transfer in",
            "remarks": t.remarks or f"From: {t.from_location.name if t.from_location else 'Unknown'}",
        })

    movements.sort(key=lambda m: m["date"] or "", reverse=True)

    return success_response(movements)


@inventory_bp.route("/api/inventory/request-stock/<int:request_id>/accept", methods=["PUT"])
def accept_request(request_id):
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)
    if not _can_update(usertype):
        return error_response("Forbidden", "FORBIDDEN", 403)

    stock_request = StockRequest.query.get(request_id)
    if not stock_request:
        return error_response("Request not found", "NOT_FOUND", 404)
    if stock_request.status != "pending":
        return error_response("Request already processed", "ALREADY_PROCESSED", 400)

    inventory = Inventory.query.filter_by(
        product_id=stock_request.product_id,
        location_id=stock_request.from_location_id,
    ).first()
    if not inventory or inventory.quantity < stock_request.quantity:
        return error_response("Insufficient stock at source location", "INSUFFICIENT_STOCK", 400)

    inventory.quantity -= stock_request.quantity

    dest_inv = Inventory.query.filter_by(
        product_id=stock_request.product_id,
        location_id=stock_request.to_location_id,
    ).first()
    if dest_inv:
        dest_inv.quantity = (dest_inv.quantity or 0) + stock_request.quantity
    else:
        dest_inv = Inventory(
            product_id=stock_request.product_id,
            location_id=stock_request.to_location_id,
            quantity=stock_request.quantity,
        )
        db.session.add(dest_inv)

    stock_request.status = "accepted"
    db.session.commit()
    check_and_auto_restock(stock_request.from_location_id)
    return success_response({"message": "Request accepted"})


@inventory_bp.route("/api/inventory/request-stock/<int:request_id>/decline", methods=["PUT"])
def decline_request(request_id):
    data = request.get_json() or {}
    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)
    if not _can_update(usertype):
        return error_response("Forbidden", "FORBIDDEN", 403)

    stock_request = StockRequest.query.get(request_id)
    if not stock_request:
        return error_response("Request not found", "NOT_FOUND", 404)
    if stock_request.status != "pending":
        return error_response("Request already processed", "ALREADY_PROCESSED", 400)

    stock_request.status = "declined"
    db.session.commit()
    return success_response({"message": "Request declined"})


@inventory_bp.route("/api/inventory/pending-requests", methods=["GET"])
def list_pending_requests():
    from_location_id = request.args.get("location_id", type=int)
    query = StockRequest.query.filter_by(status="pending").order_by(StockRequest.created_at.desc())
    if from_location_id:
        query = query.filter_by(from_location_id=from_location_id)
    requests = query.limit(50).all()
    return success_response([{
        "request_id": r.request_id,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Unknown",
        "quantity": r.quantity,
        "is_fabric": is_fabric_category(r.product.category_id) if r.product else False,
        "description": r.description,
        "from_location_id": r.from_location_id,
        "from_location_name": r.from_location.name if r.from_location else "Unknown",
        "to_location_id": r.to_location_id,
        "to_location_name": r.to_location.name if r.to_location else "Unknown",
        "requested_by": r.requested_by,
        "requester_name": r.requester.username if r.requester else "System",
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in requests])


@inventory_bp.route("/api/inventory/request-logs", methods=["GET"])
def list_request_logs():
    user_id = request.args.get("user_id", type=int)
    query = StockRequest.query.order_by(StockRequest.created_at.desc())
    if user_id:
        query = query.filter_by(requested_by=user_id)
    requests = query.limit(100).all()
    return success_response([{
        "request_id": r.request_id,
        "product_id": r.product_id,
        "product_name": r.product.name if r.product else "Unknown",
        "quantity": r.quantity,
        "is_fabric": is_fabric_category(r.product.category_id) if r.product else False,
        "description": r.description,
        "from_location_id": r.from_location_id,
        "from_location_name": r.from_location.name if r.from_location else "Unknown",
        "to_location_id": r.to_location_id,
        "to_location_name": r.to_location.name if r.to_location else "Unknown",
        "requested_by": r.requested_by,
        "requester_name": r.requester.username if r.requester else "System",
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in requests])