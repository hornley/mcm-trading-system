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
        if "sqlite" not in db.engine.url.drivername:
            print("ABORTED: This script drops all tables. It only works with SQLite.")
            print(f"Detected engine: {db.engine.url.drivername}")
            return
        print("Dropping all tables and recreating...")
        db.drop_all()
        db.create_all()

        # ── 1. LOCATIONS ──
        print("Seeding Locations...")
        locs = [
            Location(name="Storehouse", address="123 Industrial Zone, Main City", is_active=True),
            Location(name="Branch 1", address="456 Commercial Ave, Downtown", is_active=True),
            Location(name="Branch 2", address="789 Suburb Road, North District", is_active=True),
        ]
        db.session.add_all(locs)
        db.session.flush()

        # ── 2. USERS ──
        print("Seeding Users...")
        # usertype: 0=Staff(no access), 1=Owner, 2=Manager, 3=Admin
        users_data = [
            (1, "owner",    "owner@mcm.com",    "260512001", 0),
            (2, "manager",  "manager@mcm.com",  "260512002", 2),
            (2, "manager2", "manager2@mcm.com", "260512007", 1),
            (3, "admin",    "admin@mcm.com",    "260512003", 1),
            (3, "admin2",   "admin2@mcm.com",   "260512008", 3),
        ]
        users = []
        for ut, uname, email, emp, lid in users_data:
            u = User(
                usertype=ut, username=uname, email=email,
                password=generate_password_hash("password"),
                location_id=lid, employee_code=emp,
            )
            db.session.add(u)
            users.append(u)
        db.session.flush()

        # ── 3. CATEGORIES ──
        print("Seeding Categories...")
        cat = Category(name="Fabrics", description="Fabric materials for upholstery and clothing", is_active=True)
        db.session.add(cat)
        db.session.flush()

        cat2 = Category(name="Trims & Accessories", description="Trims, buttons, zippers and other accessories", is_active=True)
        db.session.add(cat2)
        db.session.flush()

        cat3 = Category(name="Threads & Sewing", description="Threads, needles and sewing supplies", is_active=True)
        db.session.add(cat3)
        db.session.flush()

        cat4 = Category(name="Tools & Equipment", description="Cutting tools, rulers and equipment", is_active=True)
        db.session.add(cat4)
        db.session.flush()

        # ── 4. PRODUCTS ──
        print("Seeding Products...")
        prods = [
            Product(category_id=cat.category_id, name="FELT HARD 1", price=120, reorder_level="10", sku="PROD-001", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="FELT HARD 2", price=130, reorder_level="10", sku="PROD-002", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="FLEECE", price=180, reorder_level="8", sku="PROD-003", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="HI-PILE", price=250, reorder_level="5", sku="PROD-004", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="12MM CIRCULAR", price=200, reorder_level="10", sku="PROD-005", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="8MM AND 20MM PLUSH", price=220, reorder_level="8", sku="PROD-006", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="7MM AND 20MM PLUSH", price=230, reorder_level="8", sku="PROD-007", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="3MM PRINTED FUR", price=280, reorder_level="5", sku="PROD-008", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="SHAGGY FUR", price=300, reorder_level="5", sku="PROD-009", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="NYLEX 220G", price=90, reorder_level="15", sku="PROD-010", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="VELBOA KOREA", price=350, reorder_level="5", sku="PROD-011", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="LAMB FUR 2323", price=400, reorder_level="3", sku="PROD-012", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="VELVET 1", price=160, reorder_level="10", sku="PROD-013", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="VELVET 2", price=170, reorder_level="10", sku="PROD-014", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="VELBOA SUPER SOFT", price=380, reorder_level="5", sku="PROD-015", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="PRINTED DESIGN", price=150, reorder_level="10", sku="PROD-016", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="SUEDE GAMOSA", price=200, reorder_level="8", sku="PROD-017", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="NEON WOVEN CLOTH", price=100, reorder_level="15", sku="PROD-018", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="FEATHERS", price=50, reorder_level="20", sku="PROD-019", unit="piece", is_active=True),
            Product(category_id=cat.category_id, name="COTTON CANVAS", price=140, reorder_level="12", sku="PROD-020", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="LINEN FABRIC", price=190, reorder_level="10", sku="PROD-021", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="DENIM BLUE", price=210, reorder_level="8", sku="PROD-022", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="SATIN SILK", price=320, reorder_level="5", sku="PROD-023", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="POLYESTER MESH", price=85, reorder_level="20", sku="PROD-024", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="LEATHERETTE", price=260, reorder_level="6", sku="PROD-025", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="TWEED WOOL", price=340, reorder_level="4", sku="PROD-026", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="CHIFFON", price=110, reorder_level="15", sku="PROD-027", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="ORGANZA", price=130, reorder_level="12", sku="PROD-028", unit="meter", is_active=True),
            Product(category_id=cat.category_id, name="BROCADE GOLD", price=450, reorder_level="3", sku="PROD-029", unit="meter", is_active=True),
        ]
        db.session.add_all(prods)
        db.session.flush()

        new_prods = [
            Product(category_id=cat2.category_id, name="Metallic Zipper 20cm", price=15, reorder_level="50", sku="PROD-030", unit="piece", is_active=True),
            Product(category_id=cat2.category_id, name="Plastic Buttons 20mm", price=5, reorder_level="100", sku="PROD-031", unit="piece", is_active=True),
            Product(category_id=cat2.category_id, name="Elastic Band 2cm", price=8, reorder_level="80", sku="PROD-032", unit="meter", is_active=True),
            Product(category_id=cat2.category_id, name="Satin Ribbon 1cm", price=12, reorder_level="60", sku="PROD-033", unit="meter", is_active=True),
            Product(category_id=cat2.category_id, name="Velcro Tape 5cm", price=10, reorder_level="70", sku="PROD-034", unit="meter", is_active=True),
            Product(category_id=cat2.category_id, name="Metal Buckle 3cm", price=18, reorder_level="40", sku="PROD-035", unit="piece", is_active=True),
            Product(category_id=cat2.category_id, name="Lace Trim 2cm", price=14, reorder_level="50", sku="PROD-036", unit="meter", is_active=True),
            Product(category_id=cat2.category_id, name="Snap Fastener Set", price=7, reorder_level="90", sku="PROD-037", unit="set", is_active=True),
            Product(category_id=cat2.category_id, name="Hook & Eye Set", price=4, reorder_level="100", sku="PROD-038", unit="set", is_active=True),
            Product(category_id=cat2.category_id, name="Bias Binding Tape", price=9, reorder_level="75", sku="PROD-039", unit="meter", is_active=True),
            Product(category_id=cat3.category_id, name="Polyester Thread White", price=3, reorder_level="200", sku="PROD-040", unit="spool", is_active=True),
            Product(category_id=cat3.category_id, name="Polyester Thread Black", price=3, reorder_level="200", sku="PROD-041", unit="spool", is_active=True),
            Product(category_id=cat3.category_id, name="Nylon Thread Clear", price=5, reorder_level="150", sku="PROD-042", unit="spool", is_active=True),
            Product(category_id=cat3.category_id, name="Sewing Needles Assorted", price=6, reorder_level="100", sku="PROD-043", unit="pack", is_active=True),
            Product(category_id=cat3.category_id, name="Pins with Glass Heads", price=4, reorder_level="120", sku="PROD-044", unit="pack", is_active=True),
            Product(category_id=cat3.category_id, name="Tailor's Chalk", price=2, reorder_level="150", sku="PROD-045", unit="piece", is_active=True),
            Product(category_id=cat3.category_id, name="Thread Holder Box", price=25, reorder_level="30", sku="PROD-046", unit="piece", is_active=True),
            Product(category_id=cat4.category_id, name="Fabric Scissors 10in", price=180, reorder_level="10", sku="PROD-047", unit="piece", is_active=True),
            Product(category_id=cat4.category_id, name="Measuring Tape 150cm", price=15, reorder_level="40", sku="PROD-048", unit="piece", is_active=True),
            Product(category_id=cat4.category_id, name="Rotary Cutter 45mm", price=220, reorder_level="8", sku="PROD-049", unit="piece", is_active=True),
            Product(category_id=cat4.category_id, name="Cutting Mat A2", price=350, reorder_level="5", sku="PROD-050", unit="piece", is_active=True),
        ]
        db.session.add_all(new_prods)
        db.session.flush()

        # ── 5. INVENTORY ──
        print("Seeding Inventory...")
        all_products = prods + new_prods
        stockhouse_floor = 3
        branch_floor = 1
        for p in all_products:
            db.session.add(Inventory(product_id=p.product_id, location_id=locs[0].location_id,
                                     quantity=random.randint(stockhouse_floor, 50)))
            for loc in locs[1:]:
                db.session.add(Inventory(product_id=p.product_id, location_id=loc.location_id,
                                         quantity=random.randint(branch_floor, 15)))
        db.session.flush()

        # ── 6. ORDERS + ITEMS + PAYMENTS ──
        print("Seeding Orders, Items, Payments...")
        statuses = ["completed", "completed", "completed", "pending", "cancelled"]
        methods = ["Cash", "Card", "Bank Transfer", "GCash"]
        now = datetime.now()

        for _ in range(300):
            loc = random.choice(locs)
            odate = now - timedelta(days=random.randint(0, 365),
                                    hours=random.randint(0, 23),
                                    minutes=random.randint(0, 59))
            n = random.randint(1, 8)
            chosen = random.sample(all_products, min(n, len(all_products)))
            items = [(p.product_id, random.randint(1, 20), p.price) for p in chosen]
            total = sum(q * pr for _, q, pr in items)

            order = Order(location_id=loc.location_id, order_date=odate,
                          status=random.choice(statuses), total_amount=total)
            db.session.add(order)
            db.session.flush()

            for pid, qty, pr in items:
                db.session.add(OrderItem(order_id=order.order_id, product_id=pid, quantity=qty, price=pr))
            db.session.add(Payment(order_id=order.order_id, payment_method=random.choice(methods),
                                   quantity=sum(q for _, q, _ in items), price=total))
        db.session.flush()

        # ── 7. STOCK TRANSFERS ──
        print("Seeding Stock Transfers...")
        tstatus = ["pending", "approved", "completed", "cancelled"]
        for _ in range(50):
            fl, tl = random.sample(locs, 2)
            st = StockTransfer(
                product_id=random.choice(all_products).product_id,
                from_location_id=fl.location_id, to_location_id=tl.location_id,
                user_id=random.choice(users).user_id,
                quantity=random.randint(5, 50),
                transfer_date=now - timedelta(days=random.randint(0, 180), hours=random.randint(0, 23)),
                status=random.choice(tstatus),
            )
            db.session.add(st)
        db.session.flush()

        # ── 8. STOCK ADJUSTMENTS ──
        print("Seeding Stock Adjustments...")
        reasons = ["Damaged goods", "Inventory count correction", "Sample material",
                    "Quality check removal", "Supplier return", "Damaged in transit",
                    "Employee discount adjustment"]
        for _ in range(50):
            sa = StockAdjustment(
                product_id=random.choice(all_products).product_id,
                location_id=random.choice(locs).location_id,
                user_id=random.choice(users).user_id,
                quantity_change=random.choice([-50, -20, -10, -5, -3, 5, 10, 15, 25]),
                reason=random.choice(reasons),
                date=now - timedelta(days=random.randint(0, 180), hours=random.randint(0, 23)),
            )
            db.session.add(sa)
        db.session.flush()

        # ── 9. ACTIVITY LOGS ──
        print("Seeding Activity Logs...")
        activities = [
            ("auth", "login", "Logged in"),
            ("auth", "login", "Logged in"),
            ("products", "create", "Created product"),
            ("products", "update", "Updated product"),
            ("inventory", "adjust", "Adjusted inventory"),
            ("categories", "create", "Created category"),
            ("locations", "create", "Created location"),
            ("inventory", "adjust", "Stock adjustment"),
            ("products", "update", "Updated product price"),
            ("inventory", "adjust", "Inventory count correction"),
        ]
        for _ in range(200):
            mod, typ, act = random.choice(activities)
            db.session.add(ActivityLog(
                user_id=random.choice(users).user_id,
                module=mod,
                action_type=typ,
                action=act,
                timestamp=now - timedelta(days=random.randint(0, 180),
                                          hours=random.randint(0, 23),
                                          minutes=random.randint(0, 59)),
            ))
        db.session.flush()

        db.session.commit()
        print("\n[OK] Database seeded successfully!")
        print(f"  Locations:       {len(locs)}")
        print(f"  Users:           {len(users_data)}")
        print(f"  Categories:      4")
        print(f"  Products:        {len(prods) + len(new_prods)}")
        print(f"  Inventory:       {(len(prods) + len(new_prods)) * len(locs)}")
        print(f"  Orders:          300")
        print(f"  Transfers:       50")
        print(f"  Adjustments:     50")
        print(f"  Activity Logs:   200")


if __name__ == "__main__":
    seed()
