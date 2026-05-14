# Full Inventory CRUD — API Usage Guide

## Authentication

Every request requires `usertype` and optionally `user_id` (for activity logging).

| usertype | Role |
|----------|------|
| 1        | Owner |
| 2        | Manager |
| 3        | Admin |

**Login first:**
```
POST /api/auth/login
Body: { "username": "owner", "password": "password" }
→ { "user_id": 4, "usertype": 1, "role": "owner", ... }
```

Pass `usertype` as query param for GET, or in request body for POST/PUT/DELETE.

---

## Access Control

| Operation | Owner | Manager | Admin |
|-----------|-------|---------|-------|
| List/View | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ |
| Update | ✅ | ✅ | ✅ |
| Void | ✅ | ✅ | ✅ |
| Delete | ✅ | ❌ | ✅ |

---

## Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories?usertype=<n>` | List all (sorted) |
| GET | `/api/categories/<id>?usertype=<n>` | Get one |
| POST | `/api/categories` | Create |
| PUT | `/api/categories/<id>` | Update |
| PUT | `/api/categories/<id>/void` | Soft-delete |
| DELETE | `/api/categories/<id>` | Hard delete (Owner/Admin) |

**List** supports `?sort_by=name&sort_order=asc`.

**Create:**
```json
{ "usertype": 1, "name": "Fabrics", "description": "..." }
```

**Update** accepts partial fields:
```json
{ "usertype": 1, "name": "New Name" }
```

---

## Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products?usertype=<n>` | List (searchable, filterable, sorted) |
| GET | `/api/products/<id>?usertype=<n>` | Get one with inventory per location |
| POST | `/api/products` | Create |
| PUT | `/api/products/<id>` | Update |
| PUT | `/api/products/<id>/void` | Soft-delete |
| DELETE | `/api/products/<id>` | Hard delete (Owner/Admin) |

**List** supports:
- `?sort_by=name&sort_order=asc`
- `?q=search_term` — searches name & SKU
- `?category_id=1` — filter by category
- `?is_active=true` — filter by active status

**Create** (SKU auto-generates as `PROD-XXX` if omitted; auto-creates Inventory rows for all active Locations):
```json
{
  "usertype": 1,
  "name": "FELT HARD 1",
  "category_id": 1,
  "price": 120,
  "sku": "PROD-001",
  "unit": "piece",
  "reorder_level": "10",
  "description": "..."
}
```

---

## Locations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations?usertype=<n>` | List all (sorted) |
| GET | `/api/locations/<id>?usertype=<n>` | Get one with inventory summary |
| POST | `/api/locations` | Create |
| PUT | `/api/locations/<id>` | Update |
| PUT | `/api/locations/<id>/void` | Soft-delete only (no hard delete) |

**Create** auto-creates Inventory rows for all active Products:
```json
{ "usertype": 1, "name": "Branch 3", "address": "..." }
```

---

## Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory?usertype=<n>` | All stock across all locations |
| GET | `/api/inventory/location/<id>?usertype=<n>` | Stock at a specific location |
| GET | `/api/inventory/product/<id>?usertype=<n>` | Stock of a product across all locations |
| POST | `/api/inventory/adjust` | Adjust stock quantity |
| GET | `/api/inventory/low-stock?usertype=<n>` | Products below reorder level |

**Adjust stock:**
```json
{
  "usertype": 1,
  "user_id": 4,
  "product_id": 1,
  "location_id": 1,
  "quantity_change": 10,
  "reason": "New shipment received"
}
```
- Negative `quantity_change` decreases stock
- `quantity_change` as a positive integer
- Enforces stock never goes below 0
- Auto-logs `StockAdjustment` and `ActivityLog`

---

## Response Format

**Success (single item):**
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Success (list):**
```json
{ "success": true, "data": [ ... ] }
```

**Error:**
```json
{ "success": false, "message": "...", "error": "ERROR_CODE" }
```

---

## Activity Logging

Every CRUD operation auto-logs with:
- `module`: "categories", "products", "locations", "inventory"
- `action_type`: "create", "update", "void", "delete", "adjust"
- `action`: human-readable string
- `details`: JSON string with IDs/context
