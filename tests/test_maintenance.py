#!/usr/bin/env python3
"""
Test harness for the Maintenance module's Integrity Check.

Connects directly to the local SQLite database and injects known-bad
data (orphan rows, negative inventory, stale password tokens) so you
can run the Integrity Check in the UI and verify it detects everything.

Usage patterns:
    python tests/test_maintenance.py --setup     # create/reset tables from schema.sql
    python tests/test_maintenance.py --inject    # inject test issues
    python tests/test_maintenance.py --verify    # confirm injections are present
    python tests/test_maintenance.py --cleanup   # remove all injected test data
    python tests/test_maintenance.py --all       # setup, inject, verify (skip cleanup)
    python tests/test_maintenance.py             # same as --all

After --inject or --all, open the Maintenance tab in the UI and click
"Run Integrity Check".  You should see:

    Status: Failed
    FK Violations: 2
    Orphan Rows:   2  (1 OrderItems -> Orders, 1 Payments -> Orders)
    Negative Inventory: 1
    Stale Password Tokens: 1

Then use the Investigation Modals to view and fix each issue.
Run --cleanup when you are done.

Pre-requisites:
    - The Flask backend is stopped (this script writes to the same SQLite file).
    - python3 is on your PATH.
    - db/database.db exists (run the Flask app once before using this script
      if you haven't already, or use --setup with the schema.sql to seed it).
"""

import sqlite3
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "database.db")
SCHEMA_PATH = os.path.join(ROOT, "db", "schema.sql")

# ── minimal ddl for tables that schema.sql is missing ──────────────────────

_FALLBACK_DDL = {
    "Password_Reset_Tokens": (
        "CREATE TABLE IF NOT EXISTS Password_Reset_Tokens ("
        "    token_id    INTEGER PRIMARY KEY,"
        "    user_id     INTEGER NOT NULL REFERENCES Users(user_id),"
        "    token       VARCHAR NOT NULL UNIQUE,"
        "    expires_at  DATETIME NOT NULL,"
        "    used        INTEGER NOT NULL DEFAULT 0"
        ")"
    ),
    "Stock_Requests": (
        "CREATE TABLE IF NOT EXISTS Stock_Requests ("
        "    request_id        INTEGER PRIMARY KEY,"
        "    product_id        INTEGER NOT NULL REFERENCES Products(product_id),"
        "    from_location_id  INTEGER NOT NULL REFERENCES Locations(location_id),"
        "    to_location_id    INTEGER NOT NULL REFERENCES Locations(location_id),"
        "    requested_by      INTEGER NOT NULL REFERENCES Users(user_id),"
        "    quantity          REAL NOT NULL,"
        "    description       VARCHAR,"
        "    status            VARCHAR NOT NULL DEFAULT 'pending',"
        "    created_at        DATETIME NOT NULL DEFAULT (datetime('now')),"
        "    updated_at        DATETIME"
        ")"
    ),
    "Store_Reports": (
        "CREATE TABLE IF NOT EXISTS Store_Reports ("
        "    report_id    INTEGER PRIMARY KEY,"
        "    user_id      INTEGER NOT NULL REFERENCES Users(user_id),"
        "    location_id  INTEGER NOT NULL REFERENCES Locations(location_id),"
        "    title        VARCHAR NOT NULL,"
        "    issue_type   VARCHAR NOT NULL,"
        "    description  TEXT NOT NULL,"
        "    status       VARCHAR NOT NULL DEFAULT 'pending',"
        "    resolved_by  INTEGER REFERENCES Users(user_id),"
        "    resolved_at  DATETIME,"
        "    created_at   DATETIME NOT NULL DEFAULT (datetime('now')),"
        "    updated_at   DATETIME"
        ")"
    ),
    "Manual_Sections": (
        "CREATE TABLE IF NOT EXISTS Manual_Sections ("
        "    section_id  INTEGER PRIMARY KEY,"
        "    role        VARCHAR(16) NOT NULL,"
        "    parent_id   INTEGER REFERENCES Manual_Sections(section_id),"
        "    sort_order  INTEGER NOT NULL DEFAULT 0,"
        "    title       VARCHAR(255) NOT NULL,"
        "    content     TEXT NOT NULL DEFAULT ''"
        ")"
    ),
}

NEEDED_TABLES = ["Order_Items", "Payments", "Inventory", "Password_Reset_Tokens"]


# ── helpers ────────────────────────────────────────────────────────────────

def _connect():
    if not os.path.exists(DB_PATH):
        print(f"Error: database file not found at {DB_PATH}")
        print("Run the Flask app once first (python run.py), or use --setup if schema.sql exists.")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_tables(cur, conn):
    """Create any tables from _FALLBACK_DDL that are missing."""
    for table in NEEDED_TABLES:
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,)
        )
        if cur.fetchone() is None:
            if table in _FALLBACK_DDL:
                cur.execute(_FALLBACK_DDL[table])
                conn.commit()
                print(f"  Created missing table: {table}")
            else:
                print(f"  FAIL Missing table '{table}' and no fallback DDL — injection may fail")
                sys.exit(1)


def _print_ok(msg):
    print(f"  OK   {msg}")


def _print_err(msg):
    print(f"  FAIL {msg}")


# ── actions ─────────────────────────────────────────────────────────────────

def setup():
    """Create / recreate all tables from db/schema.sql."""
    if not os.path.exists(SCHEMA_PATH):
        print(f"Error: schema.sql not found at {SCHEMA_PATH}")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH) as f:
        schema = f.read()
    conn.executescript(schema)
    # also create tables that schema.sql is missing
    cur = conn.cursor()
    for table, ddl in _FALLBACK_DDL.items():
        cur.execute(ddl)
    conn.commit()
    conn.close()
    _print_ok("Schema applied from db/schema.sql (+ fallback tables)")


def inject():
    """Insert known-bad data that the Integrity Check should detect."""
    conn = _connect()
    cur = conn.cursor()
    _ensure_tables(cur, conn)

    cur.execute("PRAGMA foreign_keys = OFF")

    # orphan OrderItem: references a non-existent order
    cur.execute(
        "INSERT INTO Order_Items (order_id, product_id, quantity, price) "
        "VALUES (999999, 1, 1, 10)"
    )
    _print_ok("Injected orphan OrderItem (order_id=999999)")

    # orphan Payment: references a non-existent order
    cur.execute(
        "INSERT INTO Payments (order_id, payment_method, quantity, price) "
        "VALUES (999999, 'cash', 1, 50)"
    )
    _print_ok("Injected orphan Payment (order_id=999999)")

    # negative inventory
    cur.execute(
        "UPDATE Inventory SET quantity = -5 WHERE inventory_id = 1"
    )
    if cur.rowcount == 0:
        _print_err("No inventory_id=1 found — negative inventory injection skipped")
    else:
        _print_ok("Set Inventory row 1 quantity to -5")

    # stale password token (expires_at = 48 hours ago)
    cur.execute(
        "INSERT INTO Password_Reset_Tokens (user_id, token, expires_at, used) "
        "VALUES (1, 'test-stale-token-xyz', datetime('now', '-48 hours'), 0)"
    )
    _print_ok("Injected stale PasswordResetToken (48h expired)")

    cur.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print("\nDone. Now click 'Run Integrity Check' in the Maintenance tab.")


def verify():
    """Confirm that previously injected data is still present."""
    conn = _connect()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM Order_Items WHERE order_id = 999999")
    orphans_oi = cur.fetchone()[0]
    status = "PASS" if orphans_oi > 0 else "FAIL"
    print(f"  [{status}] OrderItems orphan: {orphans_oi} row(s) — expected >=1")

    cur.execute("SELECT COUNT(*) FROM Payments WHERE order_id = 999999")
    orphans_pm = cur.fetchone()[0]
    status = "PASS" if orphans_pm > 0 else "FAIL"
    print(f"  [{status}] Payments orphan:     {orphans_pm} row(s) — expected >=1")

    cur.execute("SELECT quantity FROM Inventory WHERE inventory_id = 1")
    qty = cur.fetchone()
    is_neg = qty is not None and qty[0] < 0
    status = "PASS" if is_neg else "FAIL"
    actual = qty[0] if qty else "row missing"
    print(f"  [{status}] Inventory row 1 qty:  {actual} — expected <0")

    cur.execute("SELECT COUNT(*) FROM Password_Reset_Tokens WHERE token = 'test-stale-token-xyz'")
    tokens = cur.fetchone()[0]
    status = "PASS" if tokens > 0 else "FAIL"
    print(f"  [{status}] Stale token:           {tokens} row(s) — expected >=1")

    conn.close()


def cleanup():
    """Remove all data injected by the --inject step."""
    conn = _connect()
    cur = conn.cursor()

    cur.execute("DELETE FROM Order_Items WHERE order_id = 999999")
    n1 = cur.rowcount
    _print_ok(f"Deleted {n1} orphan OrderItem(s)")

    cur.execute("DELETE FROM Payments WHERE order_id = 999999")
    n2 = cur.rowcount
    _print_ok(f"Deleted {n2} orphan Payment(s)")

    cur.execute("UPDATE Inventory SET quantity = 0 WHERE quantity < 0")
    n3 = cur.rowcount
    _print_ok(f"Reset {n3} negative inventory row(s) to 0")

    cur.execute("DELETE FROM Password_Reset_Tokens WHERE token = 'test-stale-token-xyz'")
    n4 = cur.rowcount
    _print_ok(f"Deleted {n4} stale password token(s)")

    conn.commit()
    conn.close()
    print("\nCleanup complete. Integrity Check should now show 'All 4 checks passed'.")


# ── cli ─────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(
    description="Test harness for Maintenance Integrity Check",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog=__doc__,
)
parser.add_argument(
    "--setup", action="store_true",
    help="Apply db/schema.sql to the local database"
)
parser.add_argument(
    "--inject", action="store_true",
    help="Inject orphan rows, negative inventory, and stale tokens"
)
parser.add_argument(
    "--verify", action="store_true",
    help="Confirm injected data is present"
)
parser.add_argument(
    "--cleanup", action="store_true",
    help="Remove all injected test data"
)
parser.add_argument(
    "--all", action="store_true",
    help="Run --setup, --inject, and --verify (no cleanup)"
)

args = parser.parse_args()

if args.all or (not any([args.setup, args.inject, args.verify, args.cleanup, args.all])):
    print("=== Maintenance Integrity Check — Test Harness ===\n")
    if not os.path.exists(SCHEMA_PATH):
        print("Warning: schema.sql not found, skipping --setup.\n")
    else:
        setup()
        print()
    inject()
    print()
    verify()
else:
    if args.setup:
        setup()
    if args.inject:
        inject()
    if args.verify:
        verify()
    if args.cleanup:
        cleanup()
