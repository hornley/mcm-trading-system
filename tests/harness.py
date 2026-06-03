#!/usr/bin/env python3
"""
Interactive test harness for the Maintenance Integrity Check.

Connects directly to the local SQLite database (no Flask dependency)
so it can run alongside the backend.  Inject issues, then click
"Run Integrity Check" in the UI to see them detected live.

Run:
    python tests/harness.py
"""

import sqlite3
import os
import sys
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "database.db")

# ── colour helpers ──

C = {"R": "\033[91m", "G": "\033[92m", "Y": "\033[93m", "B": "\033[94m",
     "W": "\033[97m", "D": "\033[0m", "BOLD": "\033[1m"}


def green(s):
    return f"{C['G']}{s}{C['D']}"


def red(s):
    return f"{C['R']}{s}{C['D']}"


def bold(s):
    return f"{C['BOLD']}{s}{C['D']}"


# ── FK injection targets ───────────────────────────────────────────────────

FK_TARGETS = [
    # (display_name, table, fk_col, extra_cols, default_values)
    # extra_cols are the other NOT NULL columns besides the FK
    ("OrderItems -> Orders", "Order_Items", "order_id",
     ["product_id", "quantity", "price"],
     {"product_id": 1, "quantity": 1, "price": 10}),
    ("Payments -> Orders", "Payments", "order_id",
     ["payment_method", "quantity", "price"],
     {"payment_method": "'cash'", "quantity": 1, "price": 50}),
    ("Inventory -> Products", "Inventory", "product_id",
     ["location_id", "quantity"],
     {"location_id": 1, "quantity": 0}),
    ("Inventory -> Locations", "Inventory", "location_id",
     ["product_id", "quantity"],
     {"product_id": 1, "quantity": 0}),
    ("StockTransfers -> Users", "Stock_Transfers", "user_id",
     ["product_id", "from_location_id", "to_location_id", "quantity",
      "transfer_date", "status"],
     {"product_id": 1, "from_location_id": 1, "to_location_id": 2,
      "quantity": 1, "transfer_date": "datetime('now')", "status": "'completed'"}),
    ("ActivityLogs -> Users", "Activity_Log", "user_id",
     ["module", "action_type", "action"],
     {"module": "'test'", "action_type": "'test'",
      "action": "'injected orphan'"}),
    ("StockRequests -> Users (requested_by)", "Stock_Requests", "requested_by",
     ["product_id", "from_location_id", "to_location_id", "quantity",
      "status"],
     {"product_id": 1, "from_location_id": 1, "to_location_id": 2,
      "quantity": 1, "status": "'pending'"}),
    ("StoreReports -> Users", "Store_Reports", "user_id",
     ["location_id", "title", "issue_type", "description", "status"],
     {"location_id": 1, "title": "'test'", "issue_type": "'store'",
      "description": "'injected orphan'", "status": "'pending'"}),
]


def _connect():
    if not os.path.exists(DB_PATH):
        print(red(f"Database not found at {DB_PATH}"))
        print("Run the Flask app once first (python run.py).")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_table(conn, table_name):
    """Create a missing table from internal DDL so injection always works."""
    fallback = {
        "Stock_Requests": (
            "CREATE TABLE IF NOT EXISTS Stock_Requests ("
            " request_id INTEGER PRIMARY KEY,"
            " product_id INTEGER NOT NULL,"
            " from_location_id INTEGER NOT NULL,"
            " to_location_id INTEGER NOT NULL,"
            " requested_by INTEGER NOT NULL,"
            " quantity REAL NOT NULL,"
            " description VARCHAR,"
            " status VARCHAR NOT NULL DEFAULT 'pending',"
            " created_at DATETIME NOT NULL DEFAULT (datetime('now')),"
            " updated_at DATETIME"
            ")"
        ),
        "Store_Reports": (
            "CREATE TABLE IF NOT EXISTS Store_Reports ("
            " report_id INTEGER PRIMARY KEY,"
            " user_id INTEGER NOT NULL,"
            " location_id INTEGER NOT NULL,"
            " title VARCHAR NOT NULL,"
            " issue_type VARCHAR NOT NULL,"
            " description TEXT NOT NULL,"
            " status VARCHAR NOT NULL DEFAULT 'pending',"
            " resolved_by INTEGER,"
            " resolved_at DATETIME,"
            " created_at DATETIME NOT NULL DEFAULT (datetime('now')),"
            " updated_at DATETIME"
            ")"
        ),
        "Password_Reset_Tokens": (
            "CREATE TABLE IF NOT EXISTS Password_Reset_Tokens ("
            " token_id INTEGER PRIMARY KEY,"
            " user_id INTEGER NOT NULL,"
            " token VARCHAR NOT NULL UNIQUE,"
            " expires_at DATETIME NOT NULL,"
            " used INTEGER NOT NULL DEFAULT 0"
            ")"
        ),
    }
    if table_name in fallback:
        conn.execute(fallback[table_name])
        conn.commit()


# ── menu actions ───────────────────────────────────────────────────────────

def menu_inject_fk():
    """Inject orphan FK rows."""
    print(f"\n{bold('FK Conflict Injection')}")
    print("Select a foreign key relationship:\n")
    for i, t in enumerate(FK_TARGETS, 1):
        print(f"  {i:2}. {t[0]}")
    print()

    try:
        choice = int(input("Which FK? [1-{}]: ".format(len(FK_TARGETS))))
        if choice < 1 or choice > len(FK_TARGETS):
            raise ValueError
    except (ValueError, EOFError):
        print(red("Cancelled."))
        return

    display, table, fk_col, extra_cols, defaults = FK_TARGETS[choice - 1]

    try:
        count = int(input("How many orphan rows? [1]: ") or "1")
        if count < 1:
            raise ValueError
    except (ValueError, EOFError):
        print(red("Cancelled."))
        return

    conn = _connect()
    _ensure_table(conn, table)

    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()
    orphan_id = 999999

    for i in range(count):
        extra_parts = {}
        for col in extra_cols:
            default = defaults.get(col)
            if isinstance(default, str) and default.startswith("'"):
                extra_parts[col] = default
            else:
                extra_parts[col] = str(default)
        extra_parts[fk_col] = str(orphan_id + i)

        cols = ", ".join(extra_parts.keys())
        vals = ", ".join(extra_parts.values())
        sql = f"INSERT INTO {table} ({cols}) VALUES ({vals})"
        try:
            cur.execute(sql)
        except Exception as e:
            print(red(f"  Insert failed on table {table}: {e}"))
            break

    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print(green(f"  OK  Injected {count} orphan row(s) into {table} ({display})."))


def menu_inject_negative_inventory():
    """Set an inventory row's quantity to a negative value."""
    print(f"\n{bold('Negative Inventory Injection')}")

    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT inventory_id, product_id, location_id, quantity "
                "FROM Inventory ORDER BY inventory_id LIMIT 20")
    rows = cur.fetchall()
    if not rows:
        print(red("  No inventory rows exist. Create some first."))
        conn.close()
        return
    print("Existing inventory rows:")
    for r in rows:
        print(f"  id={r[0]}  product_id={r[1]}  location_id={r[2]}  qty={r[3]}")

    try:
        inv_id = int(input("\nInventory ID to set negative: ") or "1")
    except (ValueError, EOFError):
        print(red("Cancelled."))
        conn.close()
        return

    try:
        target = float(input("Target quantity [-5]: ") or "-5")
    except (ValueError, EOFError):
        print(red("Cancelled."))
        conn.close()
        return

    cur.execute("UPDATE Inventory SET quantity = ? WHERE inventory_id = ?",
                (target, inv_id))
    if cur.rowcount == 0:
        print(red(f"  No row with inventory_id={inv_id}."))
    else:
        conn.commit()
        print(green(f"  OK  Set inventory_id={inv_id} to quantity={target}."))
    conn.close()


def menu_inject_stale_tokens():
    """Inject expired, unused password reset tokens."""
    print(f"\n{bold('Stale Password Token Injection')}")

    try:
        count = int(input("How many stale tokens? [1]: ") or "1")
        if count < 1:
            raise ValueError
    except (ValueError, EOFError):
        print(red("Cancelled."))
        return

    conn = _connect()
    _ensure_table(conn, "Password_Reset_Tokens")
    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()
    ts = datetime.datetime.now().isoformat()

    for i in range(count):
        token = f"test-harness-stale-{ts}-{i}"
        cur.execute(
            "INSERT INTO Password_Reset_Tokens (user_id, token, expires_at, used) "
            "VALUES (1, ?, datetime('now', '-48 hours'), 0)",
            (token,)
        )
    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print(green(f"  OK  Injected {count} stale password token(s)."))


def menu_view_issues():
    """Show counts of all known test-injected data."""
    print(f"\n{bold('Current Test Issues — Counts')}\n")
    conn = _connect()
    cur = conn.cursor()

    # orphans (any FK pointing to order_id >= 999000 or user_id >= 999000)
    for display, table, fk_col, _, _ in FK_TARGETS:
        cur.execute(
            f"SELECT COUNT(*) FROM {table} WHERE {fk_col} >= 999000"
        )
        n = cur.fetchone()[0]
        label = f"Orphans in {table} (via {fk_col})"
        if n > 0:
            print(f"  {label}: {red(n)}")
        else:
            print(f"  {label}: 0")

    cur.execute("SELECT COUNT(*) FROM Inventory WHERE quantity < 0")
    neg = cur.fetchone()[0]
    print(f"  Negative inventory rows: {red(neg) if neg else '0'}")

    cur.execute("SELECT COUNT(*) FROM Password_Reset_Tokens "
                "WHERE token LIKE 'test-harness-stale-%'")
    stale = cur.fetchone()[0]
    print(f"  Stale password tokens:   {red(stale) if stale else '0'}")

    conn.close()


def menu_cleanup():
    """Remove all data injected by this harness."""
    print(f"\n{bold('Cleanup All Test Data')}")
    confirm = input("Remove all injected orphans, negative inventory, and stale tokens? [y/N]: ")
    if confirm.lower() != 'y':
        print("Cancelled.")
        return

    conn = _connect()
    cur = conn.cursor()

    for _, table, fk_col, _, _ in FK_TARGETS:
        cur.execute(f"DELETE FROM {table} WHERE {fk_col} >= 999000")
        n = cur.rowcount
        if n:
            print(green(f"  Deleted {n} orphan(s) from {table}"))

    cur.execute("UPDATE Inventory SET quantity = 0 WHERE quantity < 0")
    n = cur.rowcount
    if n:
        print(green(f"  Reset {n} negative inventory row(s) to 0"))

    cur.execute("DELETE FROM Password_Reset_Tokens "
                "WHERE token LIKE 'test-harness-stale-%'")
    n = cur.rowcount
    if n:
        print(green(f"  Deleted {n} stale password token(s)"))

    conn.commit()
    conn.close()
    print(green("\nCleanup complete."))


def menu_inject_all():
    """Quick batch: inject one of each issue type."""
    print(f"\n{bold('Batch Injection — all issue types')}\n")

    conn = _connect()
    _ensure_table(conn, "Password_Reset_Tokens")

    conn.execute("PRAGMA foreign_keys = OFF")
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO Order_Items (order_id, product_id, quantity, price) "
        "VALUES (999998, 1, 1, 10)"
    )
    print(green("  OK  1 orphan OrderItem"))

    cur.execute(
        "INSERT INTO Payments (order_id, payment_method, quantity, price) "
        "VALUES (999998, 'cash', 1, 50)"
    )
    print(green("  OK  1 orphan Payment"))

    cur.execute(
        "UPDATE Inventory SET quantity = -5 WHERE inventory_id = 1"
    )
    if cur.rowcount == 0:
        print(red("  FAIL No inventory_id=1 — skipped negative inventory"))
    else:
        print(green("  OK  Inventory row 1 set to -5"))

    cur.execute(
        "INSERT INTO Password_Reset_Tokens (user_id, token, expires_at, used) "
        "VALUES (1, 'test-harness-batch-token', datetime('now', '-48 hours'), 0)"
    )
    print(green("  OK  1 stale password token"))

    conn.execute("PRAGMA foreign_keys = ON")
    conn.commit()
    conn.close()
    print(green("\nDone. Run Integrity Check in the Maintenance tab."))


# ── main menu ──────────────────────────────────────────────────────────────

MENU = [
    (menu_inject_fk,                 "Inject FK Conflicts (orphan rows)"),
    (menu_inject_negative_inventory, "Inject Negative Inventory"),
    (menu_inject_stale_tokens,       "Inject Stale Password Tokens"),
    (menu_inject_all,                "Inject All Issues (batch)"),
    (menu_view_issues,               "View Current Issues"),
    (menu_cleanup,                   "Cleanup All Test Data"),
]


def _header():
    print(f"""
{C['BOLD']}{C['W']}{'=' * 60}
     Maintenance Integrity Test Harness
     (runs alongside Flask — direct SQLite access)
{'=' * 60}{C['D']}
Database: {DB_PATH}
""")


def main():
    _header()
    while True:
        print(f"\n{C['BOLD']}Menu:{C['D']}")
        for i, (_, label) in enumerate(MENU, 1):
            print(f"  {C['B']}{i}.{C['D']} {label}")
        print(f"  {C['B']}0.{C['D']} Exit")
        try:
            raw = input(f"\n{C['Y']}Choose [{len(MENU)}]:{C['D']} ").strip()
            if raw == "":
                raw = str(len(MENU))
            choice = int(raw)
        except (ValueError, EOFError, KeyboardInterrupt):
            print(f"\n{C['D']}Goodbye.")
            break
        if choice == 0:
            print(f"\n{C['D']}Goodbye.")
            break
        if 1 <= choice <= len(MENU):
            try:
                MENU[choice - 1][0]()
            except KeyboardInterrupt:
                print()
                continue
        else:
            print(red("Invalid choice."))


if __name__ == "__main__":
    main()
