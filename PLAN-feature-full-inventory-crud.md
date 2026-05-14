# Feature: Full Inventory CRUD (Backend Only)

## Branch: `feature/full-inventory-crud`

## Commits

### Commit 1 — Backend Cleanup
- Create `backend/utils/__init__.py`
- Create `backend/utils/response.py` — `success_response(data, message)`, `error_response(message, error_code)`, `paginated_response(data, page, limit, total)`
- Create `backend/utils/validation.py` — `validate_required(data, fields)`, `validate_positive_int(val)`, `validate_non_negative(val)`
- Create `backend/utils/activity_logger.py` — `log_activity(user_id, module, action_type, action, details=None)`
- Update `ActivityLog` model: add `module` (String), `action_type` (String), `details` (Text) columns

### Commit 2 — Database Model Updates
- **Product**: add `description` (Text), `sku` (String, unique), `unit` (String), `is_active` (Boolean, default=True), `created_at` (DateTime), `updated_at` (DateTime, onupdate)
- **Category**: add `is_active` (Boolean, default=True), `created_at`, `updated_at`
- **Location**: add `is_active` (Boolean, default=True), `created_at`, `updated_at`
- **Inventory**: add `updated_at` (DateTime, onupdate)
- Update `db/schema.sql` to match

### Commit 3 — Quick Sort Utility
- Create `backend/utils/sorting.py`
- `quick_sort(items, key="name", order="asc")` — generic Quick Sort
  - Case-insensitive string comparison
  - Handles None values (sorted to end)
  - Works with SQLAlchemy model objects or dicts

### Commit 4 — Categories CRUD
- Create `backend/routes/categories.py` blueprint
- **GET** `/api/categories` — list with Quick Sort (`?sort_by=name&sort_order=asc`)
- **GET** `/api/categories/<id>` — single category
- **POST** `/api/categories` — create (name required)
- **PUT** `/api/categories/<id>` — update
- **PUT** `/api/categories/<id>/void` — set `is_active = false`
- **DELETE** `/api/categories/<id>` — hard delete (Owner/Admin only)
- Register blueprint in `app.py`

### Commit 5 — Products CRUD
- Extend `backend/routes/inventory.py`
- **GET** `/api/products` — list with Quick Sort + search + filters (`?sort_by=name&sort_order=asc&q=&category_id=&is_active=`)
- **GET** `/api/products/<id>` — single with inventory per location
- **POST** `/api/products` — create (SKU auto-gen as `PROD-XXX` if empty, auto-creates Inventory rows for all locations)
- **PUT** `/api/products/<id>` — update
- **PUT** `/api/products/<id>/void` — set `is_active = false`
- **DELETE** `/api/products/<id>` — hard delete

### Commit 6 — Locations CRUD
- Create `backend/routes/locations.py` blueprint
- **GET** `/api/locations` — list with Quick Sort
- **GET** `/api/locations/<id>` — single with inventory summary
- **POST** `/api/locations` — create
- **PUT** `/api/locations/<id>` — update
- **PUT** `/api/locations/<id>/void` — soft-delete only (no hard delete)
- Register blueprint in `app.py`

### Commit 7 — Inventory CRUD
- Extend `backend/routes/inventory.py`
- **GET** `/api/inventory` — all stock across all locations
- **GET** `/api/inventory/location/<id>` — stock at a specific location
- **GET** `/api/inventory/product/<id>` — stock of a product across all locations
- **POST** `/api/inventory/adjust` — adjust stock (body: `{ product_id, location_id, quantity_change, reason }`); auto-logs StockAdjustment + ActivityLog; enforces quantity >= 0
- **GET** `/api/inventory/low-stock` — products where quantity < reorder_level

### Commit 8 — Update Seed Script
- Auto-generate SKUs `PROD-001` to `PROD-019` for existing products
- Set `unit = "piece"` for all existing products
- Add `is_active = True`, timestamps to all seed data
- Add second Category: "Trims & Accessories"
- Add 4 new products under new category with their own Inventory rows
- All operations use updated models

## Access Control

| Operation | Owner | Manager | Admin |
|-----------|-------|---------|-------|
| List / View | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ |
| Update | ✅ | ✅ | ✅ |
| Void | ✅ | ✅ | ✅ |
| Delete | ✅ | ❌ | ✅ |

## Standard API Response Format

```json
// Success
{ "success": true, "message": "...", "data": {...} }

// Error
{ "success": false, "message": "...", "error": "error_code" }

// Paginated (future)
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 10, "total": 57 } }
```

## Activity Logging

Auto-log on every CRUD operation:
- `module`: "categories", "products", "locations", "inventory"
- `action_type`: "create", "update", "void", "delete", "adjust"
- `action`: human-readable string like "Created category Fabrics"
- `details`: JSON string with relevant IDs/context