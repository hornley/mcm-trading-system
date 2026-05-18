from .response import error_response


def validate_required(data, fields):
    missing = [field for field in fields if field not in data or data[field] is None or data[field] == ""]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", "MISSING_FIELDS", 400)
    return None


def validate_positive_int(val, field_name="value"):
    if val is None:
        return None
    try:
        int_val = int(val)
        if int_val <= 0:
            return error_response(f"{field_name} must be a positive integer", "INVALID_VALUE", 400)
        return None
    except (ValueError, TypeError):
        return error_response(f"{field_name} must be a valid integer", "INVALID_VALUE", 400)


def validate_non_negative(val, field_name="value"):
    if val is None:
        return None
    try:
        int_val = int(val)
        if int_val < 0:
            return error_response(f"{field_name} must be a non-negative integer", "INVALID_VALUE", 400)
        return None
    except (ValueError, TypeError):
        return error_response(f"{field_name} must be a valid integer", "INVALID_VALUE", 400)


FABRIC_CATEGORY_NAME = "Fabrics"


def is_fabric_category(category_id):
    from models import Category
    cat = Category.query.get(category_id)
    return cat is not None and cat.name == FABRIC_CATEGORY_NAME


def validate_quantity(val, field_name="quantity", category_id=None):
    if val is None:
        return error_response(f"{field_name} is required", "MISSING_FIELDS", 400)
    try:
        qty = float(val)
    except (ValueError, TypeError):
        return error_response(f"{field_name} must be a valid number", "INVALID_VALUE", 400)

    if qty <= 0:
        return error_response(f"{field_name} must be a positive number", "INVALID_VALUE", 400)

    if category_id is not None and not is_fabric_category(category_id):
        if qty != int(qty):
            return error_response(f"{field_name} must be a whole number for this category", "INVALID_VALUE", 400)

    return None