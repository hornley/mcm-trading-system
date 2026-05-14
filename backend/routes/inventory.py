from flask import Blueprint, request
from models import db, Product, Category, Location, Inventory, StockAdjustment
from utils.response import success_response, error_response
from utils.validation import validate_required, validate_non_negative
from utils.activity_logger import log_activity
from utils.sorting import quick_sort

inventory_bp = Blueprint("inventory", __name__)


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

    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")
    search = request.args.get("q", "").strip()
    category_id = request.args.get("category_id", type=int)
    is_active = request.args.get("is_active")

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

    return success_response([_serialize_product(p) for p in products])


@inventory_bp.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    return success_response(_serialize_product(product, include_inventory=True))


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

    inventory = Inventory.query.join(Product).filter(
        Product.is_active == True
    ).all()

    return success_response([
        {
            "inventory_id": inv.inventory_id,
            "product_id": inv.product_id,
            "product_name": inv.product.name,
            "sku": inv.product.sku,
            "location_id": inv.location_id,
            "location_name": inv.location.name if inv.location else None,
            "quantity": inv.quantity,
        }
        for inv in inventory
    ])


@inventory_bp.route("/api/inventory/location/<int:location_id>", methods=["GET"])
def get_inventory_by_location(location_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    inventory = Inventory.query.join(Product).filter(
        Inventory.location_id == location_id,
        Product.is_active == True
    ).all()

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

    product = Product.query.get(product_id)
    if not product:
        return error_response("Product not found", "NOT_FOUND", 404)

    inventory = Inventory.query.filter_by(product_id=product_id).all()

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


@inventory_bp.route("/api/inventory/low-stock", methods=["GET"])
def get_low_stock():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

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

        inventory = Inventory.query.filter_by(product_id=product.product_id).all()
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