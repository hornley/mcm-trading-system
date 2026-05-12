# Changes in `feature/DummyDatabase2`

## New Files

### `backend/createDatabase.py`
Standalone seed script that drops and recreates all tables with dummy data:
- **3 Locations**: Storehouse, Branch 1, Branch 2
- **8 Users**: 3 staff (usertype 0), 1 owner, 2 managers, 2 admins — all with password `password`
- **1 Category**: Fabrics
- **19 Products**: All fabric types (FELT HARD, FLEECE, HI-PILE, VELVET, etc.) with prices P50–P400
- **57 Inventory rows**: Each product at each location with random stock (0–50)
- **50 Orders** + items + payments: Random dates across 6 months
- **15 Stock Transfers**: Between random locations
- **15 Stock Adjustments**: Various reasons
- **100 Activity Logs**: Random user actions

Run with: `python backend/createDatabase.py`

### `backend/routes/inventory.py`
Products API endpoint:
- `GET /api/products` — returns all products with id, name, category, price, reorder_level

### `backend/routes/accountControl.py`
User management API:
- `GET /api/account/users?user_id=` — list users (requires owner or admin)
- `PUT /api/account/users/:id/access` — update user role and location

## Modified Files

### `backend/app.py`
- Removed inline user seeding (moved to `createDatabase.py`)
- Registered `inventory_bp` blueprint for products endpoint

### `backend/models.py`
- Added `employee_code` (unique String) and `location_id` (Integer) fields to User model

### `frontend/src/pages/module/Inventory.jsx`
- Replaced placeholder with Ant Design `<Table>` component
- Fetches products from `/api/products` on mount
- Displays columns: ID, Product Name, Category, Price (P formatted), Reorder Level
- Pagination (10 per page) with loading spinner

### `run.py`
- Added step to run `createDatabase.py` before starting the Flask server
