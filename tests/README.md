# Maintenance Test Scripts

Two scripts to inject known-bad data directly into the local SQLite DB so you can verify the Integrity Check detects it.

Both scripts connect directly to `db/database.db` — no Flask dependency. They can run **alongside** the backend.

## Interactive (recommended)

```bash
python tests/harness.py
```

Menu-driven. Inject issues one at a time, view counts, or batch everything. Then switch to the Maintenance tab in the UI and click **Run Integrity Check**.

## One-shot

```bash
python tests/test_maintenance.py          # setup → inject → verify
python tests/test_maintenance.py --inject  # just inject
python tests/test_maintenance.py --verify  # check counts
python tests/test_maintenance.py --cleanup # remove everything
```

## What to expect in the UI

After injection, Integrity Check should show:

| Check | Expected |
|---|---|
| FK Violations | 2 |
| Orphan Rows | 2 (1 OrderItems, 1 Payments) |
| Negative Inventory | 1 |
| Stale Password Tokens | 1 |

Status: **Failed**. Click any red Statistic to open the Investigation Modal and see the offending rows. Use **Fix All** to run the remediation endpoint.

After cleanup, re-run Integrity Check → **Status: Passed**, all 4 checks green.
