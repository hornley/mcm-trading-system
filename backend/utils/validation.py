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