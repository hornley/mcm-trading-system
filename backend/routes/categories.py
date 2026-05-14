from flask import Blueprint, request
from models import db, Category
from utils.response import success_response, error_response
from utils.validation import validate_required
from utils.activity_logger import log_activity
from utils.sorting import quick_sort

categories_bp = Blueprint("categories", __name__)


def _can_create(usertype):
    return usertype in [1, 3]


def _can_update(usertype):
    return usertype in [1, 2, 3]


def _can_delete(usertype):
    return usertype in [1, 3]


def _serialize_category(category):
    return {
        "category_id": category.category_id,
        "name": category.name,
        "description": category.description,
        "is_active": category.is_active,
        "created_at": category.created_at.isoformat() if category.created_at else None,
        "updated_at": category.updated_at.isoformat() if category.updated_at else None,
    }


@categories_bp.route("/api/categories", methods=["GET"])
def list_categories():
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")

    query = Category.query
    categories = quick_sort(query.all(), key=sort_by, order=sort_order)

    return success_response([_serialize_category(c) for c in categories])


@categories_bp.route("/api/categories/<int:category_id>", methods=["GET"])
def get_category(category_id):
    usertype = request.args.get("usertype", type=int)
    if usertype is None:
        return error_response("usertype query parameter is required", "MISSING_PARAM", 400)

    category = Category.query.get(category_id)
    if not category:
        return error_response("Category not found", "NOT_FOUND", 404)

    return success_response(_serialize_category(category))


@categories_bp.route("/api/categories", methods=["POST"])
def create_category():
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_create(usertype):
        return error_response("You don't have permission to create categories", "FORBIDDEN", 403)

    error = validate_required(data, ["name"])
    if error:
        return error

    category = Category(
        name=data["name"],
        description=data.get("description"),
    )
    db.session.add(category)
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="categories",
        action_type="create",
        action=f"Created category {category.name}",
        details={"category_id": category.category_id}
    )

    return success_response(_serialize_category(category), "Category created successfully")


@categories_bp.route("/api/categories/<int:category_id>", methods=["PUT"])
def update_category(category_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to update categories", "FORBIDDEN", 403)

    category = Category.query.get(category_id)
    if not category:
        return error_response("Category not found", "NOT_FOUND", 404)

    if data.get("name"):
        category.name = data["name"]
    if "description" in data:
        category.description = data["description"]

    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="categories",
        action_type="update",
        action=f"Updated category {category.name}",
        details={"category_id": category.category_id}
    )

    return success_response(_serialize_category(category), "Category updated successfully")


@categories_bp.route("/api/categories/<int:category_id>/void", methods=["PUT"])
def void_category(category_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_update(usertype):
        return error_response("You don't have permission to void categories", "FORBIDDEN", 403)

    category = Category.query.get(category_id)
    if not category:
        return error_response("Category not found", "NOT_FOUND", 404)

    category.is_active = False
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="categories",
        action_type="void",
        action=f"Voided category {category.name}",
        details={"category_id": category.category_id}
    )

    return success_response(_serialize_category(category), "Category voided successfully")


@categories_bp.route("/api/categories/<int:category_id>", methods=["DELETE"])
def delete_category(category_id):
    data = request.get_json()
    if not data:
        return error_response("Request body is required", "MISSING_BODY", 400)

    usertype = data.get("usertype")
    if usertype is None:
        return error_response("usertype is required", "MISSING_PARAM", 400)

    if not _can_delete(usertype):
        return error_response("You don't have permission to delete categories", "FORBIDDEN", 403)

    category = Category.query.get(category_id)
    if not category:
        return error_response("Category not found", "NOT_FOUND", 404)

    category_name = category.name
    db.session.delete(category)
    db.session.commit()

    log_activity(
        user_id=data.get("user_id"),
        module="categories",
        action_type="delete",
        action=f"Deleted category {category_name}",
        details={"category_id": category_id}
    )

    return success_response(message="Category deleted successfully")