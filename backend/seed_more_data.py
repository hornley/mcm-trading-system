import os
import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, User, Location, Category, Product, Order, OrderItem
from models import Payment, Inventory, StockTransfer, StockAdjustment, ActivityLog
from werkzeug.security import generate_password_hash


def seed():
    app = create_app()
    with app.app_context():
        print("Adding more mock data to existing database...\n")

        existing_categories = Category.query.all()
        existing_locations = Location.query.all()
        existing_users = User.query.all()
        existing_products = Product.query.all()

        if not existing_locations or not existing_users:
            print("ERROR: No locations or users found. Run createDatabase.py first.")
            return

        locs = existing_locations
        users = existing_users
        now = datetime.now()

        # ── 1. NEW CATEGORIES ──
        new_cat_names = ["Threads & Sewing", "Tools & Equipment"]
        new_cats = []
        for cname in new_cat_names:
            if not Category.query.filter_by(name=cname).first():
                c = Category(name=cname, description=f"{cname} supplies", is_active=True)
                db.session.add(c)
                new_cats.append(c)
            else:
                new_cats.append(Category.query.filter_by(name=cname).first())
        db.session.flush()
        print(f"  Categories: {len(new_cats)} checked/added")

        # ── 2. NEW PRODUCTS ──
        max_sku_num = 0
        for p in existing_products:
            if p.sku and p.sku.startswith("PROD-"):
                try:
                    num = int(p.sku.replace("PROD-", ""))
                    max_sku_num = max(max_sku_num, num)
                except ValueError:
                    pass

        next_sku = max_sku_num + 1
        cat_ids = [c.category_id for c in existing_categories + new_cats]

        new_product_defs = [
            ("COTTON CANVAS", 140, "12", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("LINEN FABRIC", 190, "10", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("DENIM BLUE", 210, "8", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("SATIN SILK", 320, "5", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("POLYESTER MESH", 85, "20", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("LEATHERETTE", 260, "6", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("TWEED WOOL", 340, "4", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("CHIFFON", 110, "15", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("ORGANZA", 130, "12", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("BROCADE GOLD", 450, "3", next_sku := next_sku + 1, "meter", cat_ids[0]),
            ("Velcro Tape 5cm", 10, "70", next_sku := next_sku + 1, "meter", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
            ("Metal Buckle 3cm", 18, "40", next_sku := next_sku + 1, "piece", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
            ("Lace Trim 2cm", 14, "50", next_sku := next_sku + 1, "meter", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
            ("Snap Fastener Set", 7, "90", next_sku := next_sku + 1, "set", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
            ("Hook & Eye Set", 4, "100", next_sku := next_sku + 1, "set", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
            ("Bias Binding Tape", 9, "75", next_sku := next_sku + 1, "meter", cat_ids[1] if len(cat_ids) > 1 else cat_ids[0]),
        ]
        if len(new_cats) >= 2:
            new_product_defs += [
                ("Polyester Thread White", 3, "200", next_sku := next_sku + 1, "spool", new_cats[0].category_id),
                ("Polyester Thread Black", 3, "200", next_sku := next_sku + 1, "spool", new_cats[0].category_id),
                ("Nylon Thread Clear", 5, "150", next_sku := next_sku + 1, "spool", new_cats[0].category_id),
                ("Sewing Needles Assorted", 6, "100", next_sku := next_sku + 1, "pack", new_cats[0].category_id),
                ("Pins with Glass Heads", 4, "120", next_sku := next_sku + 1, "pack", new_cats[0].category_id),
                ("Tailor's Chalk", 2, "150", next_sku := next_sku + 1, "piece", new_cats[0].category_id),
                ("Thread Holder Box", 25, "30", next_sku := next_sku + 1, "piece", new_cats[0].category_id),
                ("Fabric Scissors 10in", 180, "10", next_sku := next_sku + 1, "piece", new_cats[1].category_id),
                ("Measuring Tape 150cm", 15, "40", next_sku := next_sku + 1, "piece", new_cats[1].category_id),
                ("Rotary Cutter 45mm", 220, "8", next_sku := next_sku + 1, "piece", new_cats[1].category_id),
                ("Cutting Mat A2", 350, "5", next_sku := next_sku + 1, "piece", new_cats[1].category_id),
            ]

        existing_sku_set = {p.sku for p in existing_products if p.sku}
        new_products = []
        for name, price, reorder, sku_num, unit, cid in new_product_defs:
            sku = f"PROD-{sku_num:03d}"
            if sku in existing_sku_set:
                continue
            p = Product(category_id=cid, name=name, price=price,
                        reorder_level=reorder, sku=sku, unit=unit, is_active=True)
            db.session.add(p)
            new_products.append(p)
            existing_sku_set.add(sku)

        db.session.flush()
        print(f"  Products: {len(new_products)} new added")

        all_products = existing_products + new_products

        # ── 3. INVENTORY for new products ──
        inv_count = 0
        for p in new_products:
            for loc in locs:
                existing_inv = Inventory.query.filter_by(
                    product_id=p.product_id, location_id=loc.location_id
                ).first()
                if not existing_inv:
                    qty = random.randint(3, 50) if loc == locs[0] else random.randint(0, 15)
                    db.session.add(Inventory(
                        product_id=p.product_id, location_id=loc.location_id, quantity=qty
                    ))
                    inv_count += 1

        db.session.flush()
        print(f"  Inventory: {inv_count} new entries")

        # ── 4. Add stock to entries that have 0 across all locations ──
        topped_up = 0
        for p in all_products:
            for loc in locs:
                inv = Inventory.query.filter_by(
                    product_id=p.product_id, location_id=loc.location_id
                ).first()
                if inv and inv.quantity == 0:
                    inv.quantity = random.randint(1, 10)
                    topped_up += 1
        if topped_up:
            db.session.flush()
            print(f"  Topped up {topped_up} zero-stock entries")

        # ── 5. MORE ORDERS ──
        existing_order_count = Order.query.count()
        target_orders = max(0, 300 - existing_order_count)
        statuses = ["completed", "completed", "completed", "pending", "cancelled"]
        methods = ["Cash", "Card", "Bank Transfer", "GCash"]

        if target_orders > 0:
            to_create = min(target_orders, 250)
            for _ in range(to_create):
                loc = random.choice(locs)
                odate = now - timedelta(
                    days=random.randint(0, 365), hours=random.randint(0, 23),
                    minutes=random.randint(0, 59)
                )
                n = random.randint(1, 8)
                chosen = random.sample(all_products, min(n, len(all_products)))
                items = [(p.product_id, random.randint(1, 20), p.price) for p in chosen]
                total = sum(q * pr for _, q, pr in items)

                order = Order(location_id=loc.location_id, order_date=odate,
                              status=random.choice(statuses), total_amount=total)
                db.session.add(order)
                db.session.flush()

                for pid, qty, pr in items:
                    db.session.add(OrderItem(order_id=order.order_id, product_id=pid,
                                            quantity=qty, price=pr))
                db.session.add(Payment(order_id=order.order_id,
                                       payment_method=random.choice(methods),
                                       quantity=sum(q for _, q, _ in items), price=total))
            db.session.flush()
            print(f"  Orders: {to_create} new added (total: {existing_order_count + to_create})")
        else:
            print(f"  Orders: already {existing_order_count}, skipping")

        # ── 6. STOCK TRANSFERS ──
        existing_transfers = StockTransfer.query.count()
        target_transfers = max(0, 50 - existing_transfers)
        tstatus = ["pending", "approved", "completed", "cancelled"]
        if target_transfers > 0:
            for _ in range(target_transfers):
                fl, tl = random.sample(locs, 2)
                db.session.add(StockTransfer(
                    product_id=random.choice(all_products).product_id,
                    from_location_id=fl.location_id, to_location_id=tl.location_id,
                    user_id=random.choice(users).user_id,
                    quantity=random.randint(5, 50),
                    transfer_date=now - timedelta(days=random.randint(0, 180),
                                                  hours=random.randint(0, 23)),
                    status=random.choice(tstatus),
                ))
            db.session.flush()
            print(f"  Transfers: {target_transfers} new added")
        else:
            print(f"  Transfers: already {existing_transfers}, skipping")

        # ── 7. STOCK ADJUSTMENTS ──
        existing_adjustments = StockAdjustment.query.count()
        target_adjustments = max(0, 50 - existing_adjustments)
        reasons = ["Damaged goods", "Inventory count correction", "Sample material",
                    "Quality check removal", "Supplier return", "Damaged in transit"]
        if target_adjustments > 0:
            for _ in range(target_adjustments):
                db.session.add(StockAdjustment(
                    product_id=random.choice(all_products).product_id,
                    location_id=random.choice(locs).location_id,
                    user_id=random.choice(users).user_id,
                    quantity_change=random.choice([-50, -20, -10, -5, -3, 5, 10, 15, 25]),
                    reason=random.choice(reasons),
                    date=now - timedelta(days=random.randint(0, 180),
                                         hours=random.randint(0, 23)),
                ))
            db.session.flush()
            print(f"  Adjustments: {target_adjustments} new added")
        else:
            print(f"  Adjustments: already {existing_adjustments}, skipping")

        # ── 8. ACTIVITY LOGS ──
        existing_logs = ActivityLog.query.count()
        target_logs = max(0, 200 - existing_logs)
        activities = [
            ("auth", "login", "Logged in"),
            ("products", "create", "Created product"),
            ("products", "update", "Updated product"),
            ("inventory", "adjust", "Adjusted inventory"),
            ("categories", "create", "Created category"),
            ("locations", "create", "Created location"),
            ("inventory", "adjust", "Stock adjustment"),
            ("products", "update", "Updated product price"),
            ("orders", "create", "Created order"),
            ("orders", "complete", "Completed order"),
        ]
        if target_logs > 0:
            for _ in range(target_logs):
                mod, typ, act = random.choice(activities)
                db.session.add(ActivityLog(
                    user_id=random.choice(users).user_id,
                    module=mod, action_type=typ, action=act,
                    timestamp=now - timedelta(days=random.randint(0, 180),
                                              hours=random.randint(0, 23),
                                              minutes=random.randint(0, 59)),
                ))
            db.session.flush()
            print(f"  Activity Logs: {target_logs} new added")
        else:
            print(f"  Activity Logs: already {existing_logs}, skipping")

        db.session.commit()
        print(f"\n[OK] Additional data seeded successfully!")
        print(f"  Products:        {Product.query.count()}")
        print(f"  Inventory:       {Inventory.query.count()}")
        print(f"  Orders:          {Order.query.count()}")
        print(f"  Transfers:       {StockTransfer.query.count()}")
        print(f"  Adjustments:     {StockAdjustment.query.count()}")
        print(f"  Activity Logs:   {ActivityLog.query.count()}")


if __name__ == "__main__":
    seed()
