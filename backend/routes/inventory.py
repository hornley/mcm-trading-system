from flask import Blueprint, request
from datetime import datetime
from models import db, User, Product, Category, Location, Inventory, StockAdjustment, StockTransfer
from utils.response import success_response, error_response
from utils.validation import validate_required
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


def _generate_sku():
    count = Product.query.count()
    return f"PROD-{count + 1:03d}"


def _serialize_product(product, include_inventory=False):
    data = {
        "product_id": product.product_id,
        "name": product.name,
        "category_id": product.category_id,
        "category": product.category.name if product.category else None,
        "price": product.price,
        "reorder_level": product.reorder_level,
        "description": product.description,
        "sku": product.sku,
        "unit": product.unit,
        "is_active": product.is_active,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
    }
    if include_inventory:
        inventory = Inventory.query.filter_by(product_id=product.product_id).all()
        data["inventory"] = [
            {
                "inventory_id": inv.inventory_id,
                "location_id": inv.location_id,
                "location_name": inv.location.name if inv.location else None,
                "quantity": inv.quantity,
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
        data = _serialize_product(p)
        if resolved_location_id and resolved_location_id != "all":
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

    Inventory.query.filter_by(product_id=product_id).delete()
    db.session.delete(product)
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="products",
        action_type="delete",
        action=f"Deleted product {product_name}",
        details={"product_id": product_id}
    )

    return success_response(message="Product deleted successfully")


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

    inventory = query.order_by(Product.name.asc()).all()

    return success_response([
        {
            "inventory_id": inv.inventory_id,
            "product_id": inv.product_id,
            "product_name": inv.product.name,
            "sku": inv.product.sku,
            "location_id": inv.location_id,
            "location_name": inv.location.name if inv.location else None,
            "quantity": inv.quantity,
            "reorder_level": inv.product.reorder_level,
        }
        for inv in inventory
    ])


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
            "product_name": inv.product.name,
            "sku": inv.product.sku,
            "quantity": inv.quantity,
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
            "location_id": inv.location_id,
            "location_name": inv.location.name if inv.location else None,
            "quantity": inv.quantity,
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

    try:
        quantity_change = int(data["quantity_change"])
    except (ValueError, TypeError):
        return error_response("quantity_change must be a valid integer", "INVALID_VALUE", 400)

    product = Product.query.get(data["product_id"])
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

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

    log_activity(
        user_id=data.get("user_id"),
        module="inventory",
        action_type="adjust",
        action=f"Adjusted inventory for {product.name} at {location.name}: {quantity_change:+d}",
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

    inventory_list = Inventory.query.filter_by(location_id=location_id).all()
    restocked = []

    for inv in inventory_list:
        try:
            level = int(inv.product.reorder_level) if inv.product and inv.product.reorder_level else 0
        except (ValueError, TypeError):
            level = 0

        if level <= 0 or inv.quantity >= level:
            continue

        store_inv = Inventory.query.filter_by(
            product_id=inv.product_id,
            location_id=storehouse.location_id,
        ).first()

        if not store_inv or store_inv.quantity <= 0:
            continue

        deficit = level - inv.quantity
        transfer_qty = min(deficit, store_inv.quantity)

        if transfer_qty <= 0:
            continue

        store_inv.quantity -= transfer_qty
        inv.quantity += transfer_qty

        transfer = StockTransfer(
            product_id=inv.product_id,
            from_location_id=storehouse.location_id,
            to_location_id=location_id,
            user_id=user_id,
            quantity=transfer_qty,
            status="completed",
            remarks="Bulk restock (below reorder level)",
        )
        db.session.add(transfer)

        log_activity(
            user_id=user_id,
            module="inventory",
            action_type="auto_restock",
            action=f"Bulk restock: {transfer_qty} {inv.product.name} from {storehouse.name} to {location.name}",
            details={
                "product_id": inv.product_id,
                "from_location_id": storehouse.location_id,
                "to_location_id": location_id,
                "quantity": transfer_qty,
            },
        )

        restocked.append({
            "product_id": inv.product_id,
            "product_name": inv.product.name,
            "previous_quantity": inv.quantity - transfer_qty,
            "new_quantity": inv.quantity,
            "reorder_level": level,
            "quantity_added": transfer_qty,
            "from_location": storehouse.name,
        })

    if restocked:
        db.session.commit()
        message = f"Restocked {len(restocked)} product(s)"
    else:
        message = "No products below reorder level"

    return success_response({"restocked": restocked, "count": len(restocked)}, message)


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
        if resolved_location_id and resolved_location_id != "all":
            query = query.filter_by(location_id=resolved_location_id)

        inventory = query.all()
        for inv in inventory:
            if inv.quantity < level:
                low_stock.append({
                    "inventory_id": inv.inventory_id,
                    "product_id": product.product_id,
                    "product_name": product.name,
                    "sku": product.sku,
                    "location_id": inv.location_id,
                    "location_name": inv.location.name if inv.location else None,
                    "quantity": inv.quantity,
                    "reorder_level": level,
                })

    return success_response(low_stock)


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

    try:
        quantity = int(data["quantity"])
        if quantity <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return error_response("quantity must be a positive integer", "INVALID_VALUE", 400)

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