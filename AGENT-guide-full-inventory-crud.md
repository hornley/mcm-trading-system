# Agent Guide: Full Inventory CRUD

## Backend Stack

- Flask (Python 3.12+), Flask-SQLAlchemy, SQLite
- Blueprint-based route organization
- All models in `backend/models.py`, routes in `backend/routes/`

## How Routes Work

Each request carries auth via `usertype` (integer):
- 1 = Owner (full access)
- 2 = Manager (no create/delete)
- 3 = Admin (full access)

GET requests use `?usertype=<n>` as query param.
POST/PUT/DELETE include `"usertype": <n>` in the JSON body, optionally `"user_id": <n>` for activity logging.

## CRUD Pattern (used across Categories, Products, Locations)

Every resource follows this identical pattern:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/<resource>` | List (sorted, filtered) |
| GET | `/api/<resource>/<id>` | Single item |
| POST | `/api/<resource>` | Create |
| PUT | `/api/<resource>/<id>` | Update |
| PUT | `/api/<resource>/<id>/void` | Soft-delete (`is_active = false`) |
| DELETE | `/api/<resource>/<id>` | Hard delete (Owner/Admin only) |

All responses use `success_response(data, msg)` / `error_response(msg, code, status)` from `backend/utils/response.py`.

All mutations auto-log via `log_activity()` from `backend/utils/activity_logger.py`.

### Where to implement a new CRUD resource:
1. Create `backend/routes/<resource>.py` with blueprint
2. Write `_can_create(usertype)`, `_can_update(usertype)`, `_can_delete(usertype)` helpers
3. Write `_serialize_<resource>(item)` for consistent JSON output
4. Implement the 5-6 standard endpoints (GET list, GET single, POST, PUT, PUT void, DELETE)
5. Register blueprint in `backend/app.py`

### Quick Sort utility (`backend/utils/sorting.py`):
```python
quick_sort(items, key="name", order="asc")
```
Works on both SQLAlchemy model objects and dicts. Case-insensitive string comparison. None values sort to end. Pass `sort_by` and `sort_order` from request args.

## Products Special Behavior

- `POST /api/products`: SKU auto-generates as `PROD-XXX` if empty. Also auto-creates Inventory rows for all active Locations.
- `POST /api/products`: required fields = name, category_id, price
- `GET /api/products?id=<id>`: returns inventory per location

## Locations Special Behavior

- `POST /api/locations`: auto-creates Inventory rows for all active Products
- No hard DELETE (soft-delete only via `/void`)
- `GET /api/locations/<id>`: includes inventory summary (product_name, total_quantity per product)

## Inventory Endpoints

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/inventory` | All stock |
| GET | `/api/inventory/location/<id>` | Stock at one location |
| GET | `/api/inventory/product/<id>` | Stock of one product |
| POST | `/api/inventory/adjust` | Mutates stock |
| GET | `/api/inventory/low-stock` | Reorder alerts |

### Adjust Rules:
- Body: `{ product_id, location_id, quantity_change, reason }`
- `quantity_change` is absolute positive int (will be validated)
- Enforces `new_quantity >= 0`
- Auto-logs StockAdjustment and ActivityLog in one transaction

## Response Format

```json
// Success
{ "success": true, "message": "...", "data": {...} }

// Error
{ "success": false, "message": "...", "error": "ERROR_CODE" }
```

## Activity Logging

```python
log_activity(
    user_id=user_id,
    module="categories|products|locations|inventory",
    action_type="create|update|void|delete|adjust",
    action=f"Human readable: {name}",
    details={"key": "value"}
)
```

## Testing

To test, reseed the database, start the server, and hit endpoints:
```bash
cd backend && python createDatabase.py && python app.py
```

Test login is `owner` / `password` (usertype=1). Use curl, Postman, or the frontend.
