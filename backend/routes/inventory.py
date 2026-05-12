from flask import Blueprint, jsonify
from models import db, Product, Category

inventory_bp = Blueprint("inventory", __name__)


@inventory_bp.route("/api/products", methods=["GET"])
def get_products():
    products = Product.query.all()
    return jsonify([
        {
            "product_id": p.product_id,
            "name": p.name,
            "category": p.category.name if p.category else "",
            "price": p.price,
            "reorder_level": p.reorder_level,
            "category_id": p.category_id,
        }
        for p in products
    ])
