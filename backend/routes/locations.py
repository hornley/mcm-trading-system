from flask import Blueprint, request
from models import db, Location, Inventory, Product
from utils.response import success_response, error_response
from utils.validation import validate_required
from utils.activity_logger import log_activity
from utils.sorting import quick_sort

locations_bp = Blueprint("locations", __name__)


def _can_create(usertype):
    return usertype in [1, 3]


def _can_update(usertype):
    return usertype in [1, 2, 3]


def _serialize_location(location, include_inventory=False):
    data = {
        "location_id": location.location_id,
        "name": location.name,
        "address": location.address,
        "is_active": location.is_active,
        "is_storehouse": location.is_storehouse,
        "created_at": location.created_at.isoformat() if location.created_at else None,
        "updated_at": location.updated_at.isoformat() if location.updated_at else None,
    }
    if include_inventory:
        inventory = db.session.query(
            Inventory.product_id,
            Product.name.label("product_name"),
            db.func.sum(Inventory.quantity).label("total_quantity")
        ).join(Product).filter(
            Inventory.location_id == location.location_id
        ).group_by(Inventory.product_id).all()

        data["inventory_summary"] = [
            {
                "product_id": inv.product_id,
                "product_name": inv.product_name,
                "total_quantity": inv.total_quantity,
            }
            for inv in inventory
        ]
        data["total_products"] = len(inventory)
    return data


@locations_bp.route("/api/locations", methods=["GET"])
def list_locations():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")

    locations = quick_sort(Location.query.all(), key=sort_by, order=sort_order)

    return success_response([_serialize_location(loc) for loc in locations])


@locations_bp.route("/api/locations/<int:location_id>", methods=["GET"])
def get_location(location_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    return success_response(_serialize_location(location, include_inventory=True))


@locations_bp.route("/api/locations", methods=["POST"])
def create_location():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_create(usertype):
        return error_response("You don't have permission to create locations", "FORBIDDEN", 403)

    error = validate_required(data, ["name"])
    if error:
        return error

    location = Location(
        name=data["name"],
        address=data.get("address"),
        is_storehouse=data.get("is_storehouse", False),
    )
    db.session.add(location)
    db.session.flush()

    products = Product.query.filter_by(is_active=True).all()
    for product in products:
        inventory = Inventory(
            product_id=product.product_id,
            location_id=location.location_id,
            quantity=0,
        )
        db.session.add(inventory)

    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="locations",
        action_type="create",
        action=f"Created location {location.name}",
        details={"location_id": location.location_id}
    )

    return success_response(_serialize_location(location), "Location created successfully")


@locations_bp.route("/api/locations/<int:location_id>", methods=["PUT"])
def update_location(location_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to update locations", "FORBIDDEN", 403)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    if data.get("name"):
        location.name = data["name"]
    if "address" in data:
        location.address = data["address"]
    if "is_storehouse" in data:
        location.is_storehouse = data["is_storehouse"]

    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="locations",
        action_type="update",
        action=f"Updated location {location.name}",
        details={"location_id": location.location_id}
    )

    return success_response(_serialize_location(location), "Location updated successfully")


@locations_bp.route("/api/locations/<int:location_id>/void", methods=["PUT"])
def void_location(location_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to void locations", "FORBIDDEN", 403)

    location = Location.query.get(location_id)
    if not location:
        return error_response("Location not found", "NOT_FOUND", 404)

    location.is_active = False
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="locations",
        action_type="void",
        action=f"Voided location {location.name}",
        details={"location_id": location.location_id}
    )

    return success_response(_serialize_location(location), "Location voided successfully")