from flask import jsonify


def success_response(data=None, message="Success"):
    response = {
        "success": True,
        "message": message
    }
    if data is not None:
        response["data"] = data
    return jsonify(response), 200


def error_response(message="An error occurred", error_code=None, status_code=400):
    response = {
        "success": False,
        "message": message
    }
    if error_code:
        response["error"] = error_code
    return jsonify(response), status_code


def paginated_response(data, page, limit, total):
    return jsonify({
        "success": True,
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total
        }
    }), 200