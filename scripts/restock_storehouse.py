"""
Add stock to the storehouse for all active products (or only those below reorder level).

Usage:
    python scripts/restock_storehouse.py [quantity] [--below-reorder]
    
    quantity        Number of units to add per product (default: 100)
    --below-reorder Only restock products below their reorder_level
    
Examples:
    python scripts/restock_storehouse.py 50
    python scripts/restock_storehouse.py 200 --below-reorder
    python scripts/restock_storehouse.py -b
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from models import db, Product, Location, Inventory

app = create_app()

with app.app_context():
    storehouse = Location.query.filter_by(is_storehouse=True, is_active=True).first()
    if not storehouse:
        print("ERROR: No storehouse location found. Mark a location as is_storehouse=True first.")
        sys.exit(1)

    quantity = 100
    below_reorder_only = "--below-reorder" in sys.argv or "-b" in sys.argv

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        quantity = int(sys.argv[1])
    elif len(sys.argv) > 2 and sys.argv[2].isdigit():
        quantity = int(sys.argv[2])

    products = Product.query.filter_by(is_active=True).all()
    updated = 0
    skipped = 0

    for product in products:
        if below_reorder_only:
            try:
                level = int(product.reorder_level) if product.reorder_level else 0
            except (ValueError, TypeError):
                level = 0
            if level <= 0:
                skipped += 1
                continue

            inv = Inventory.query.filter_by(
                product_id=product.product_id,
                location_id=storehouse.location_id,
            ).first()
            current_qty = inv.quantity if inv else 0
            if current_qty >= level:
                skipped += 1
                continue

        inv = Inventory.query.filter_by(
            product_id=product.product_id,
            location_id=storehouse.location_id,
        ).first()

        if inv:
            inv.quantity += quantity
        else:
            inv = Inventory(
                product_id=product.product_id,
                location_id=storehouse.location_id,
                quantity=quantity,
            )
            db.session.add(inv)

        updated += 1

    db.session.commit()
    print(f"Storehouse: {storehouse.name}")
    print(f"Added {quantity} units to {updated} product(s)")
    if skipped:
        print(f"Skipped {skipped} product(s) (already above reorder level)")

    print("Done.")
