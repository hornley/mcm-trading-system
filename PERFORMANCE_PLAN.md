# Performance Optimization Plan

## Commits on `perf/optimize-db-queries`
```
d3a3e0b perf: fix vite 8 rolldown manualChunks syntax, finalize plan
98dfea8 perf: enable Vite code splitting + lazy-load all route pages with React.lazy
d7b53c3 perf: add React Query with caching, refactor dashboard pages to use useQuery
1686182 docs: update performance plan with completed backend optimizations
ef95c79 perf: move schema migration checks to standalone migrate.py, strip from cold start
52fea46 perf: rewrite low_stock and branch_needs with JOIN queries, add eager loading to inventory list and movements
77c0620 perf: add selectinload to product list serializer and bulk-load inventory/variety stock
7c316ed perf: add selectinload to order list/detail serializers, remove N+1 queries
3e9dbc2 perf: add selectinload/joinedload to dashboard summary queries
04dc58e perf: fix connection pool from 1 to 5 connections
```

## To Deploy
1. Merge this branch and deploy to Vercel
2. **Run the SQL indexes below in Supabase SQL Editor** (one-time)
3. Run `cd frontend && npm install` to install `@tanstack/react-query`

## What's Left (Future)
- `@tanstack/react-query` query hooks exist but only dashboard pages use them. Sales, StockManagement, Inventory still use raw `fetch()`. They benefit from being lazy-loaded but would be faster with `useQuery`.
- `useCreateOrderMutation` is defined but not wired into the Sales POS form yet.

---

## Baseline (before optimizations)
| Page | Load Time |
|------|-----------|
| Login | ~20s |
| Dashboard | ~40-50s |
| Sales | ~30s |
| Stock Management | ~30s |

## Optimizations

### 1. Connection Pool Fix
**File:** `backend/config.py`
**Change:** `pool_size: 1, max_overflow: 0` → `pool_size: 5, max_overflow: 10, pool_recycle: 300`
**Status:** ✅ done (commit 04dc58e)

### 2. Database Indexes (Supabase SQL Editor)
**SQL:** Add indexes on FK and sort columns across 6 tables
**Status:** ⚠️ pending — run SQL below in Supabase SQL Editor

### 3. Eager Loading - Dashboard Summary
**File:** `backend/routes/dashboard.py`
**Change:** Add `selectinload`/`joinedload` options to inventory, order, and product queries
**Status:** ✅ done (commit 3e9dbc2)

### 4. Eager Loading - Order Serializers
**File:** `backend/routes/orders.py`
**Change:** Remove N+1 queries in `_serialize_order_list`, `_serialize_order_detail`; add `selectinload` in `list_orders`
**Status:** ✅ done (commit 7c316ed)

### 5. Eager Loading - Product Serializer
**File:** `backend/routes/inventory.py`
**Change:** Add `selectinload` for Product varieties, category, and inventory in `list_products`
**Status:** ✅ done (commit 77c0620)

### 6. Rewrite low_stock and branch_needs with JOINs
**File:** `backend/routes/inventory.py`
**Change:** Replace nested Python loops with single SQL JOIN queries
**Status:** ✅ done (commit 52fea46)

### 7. Remove Cold-Start Migration Introspection
**File:** `backend/app.py`, `backend/migrate.py`
**Change:** Move ALTER TABLE checks out of `create_app()` to a standalone migration script
**Status:** ✅ done (commit ef95c79)

### 8. React Query - Dashboard
**File:** `frontend/src/hooks/useQueries.js`, `frontend/src/main.jsx`, `frontend/src/pages/dashboard/*.jsx`
**Change:** Add `@tanstack/react-query`, replace `fetch()` with `useQuery` on dashboard pages
**Status:** ✅ done (commit d7b53c3)

### 9. React Query - All Pages
**File:** `frontend/src/hooks/useQueries.js`
**Change:** Created centralized query hooks (`useDashboardQuery`, `useOrdersQuery`, `useInventoryQuery`, `useProductsQuery`, `useCategoriesQuery`, `useLocationsQuery`, `useLowStockQuery`, `useCreateOrderMutation`, etc.)
**Status:** ✅ done (commit d7b53c3)

### 10. Optimistic Updates
**File:** `frontend/src/hooks/useQueries.js`
**Change:** `useCreateOrderMutation` with `invalidateQueries` after mutation
**Status:** ✅ done (commit d7b53c3)

### 11. Vite Bundle Optimization
**File:** `frontend/vite.config.js`
**Change:** Code splitting (antd, recharts, vendor, query chunks), esbuild minification, sourcemaps off
**Status:** ✅ done (commit 98dfea8)

### 12. Lazy-Load Routes
**File:** `frontend/src/routes/AppRouter.jsx`
**Change:** Replace static imports with `React.lazy()` + `<Suspense>` wrapper
**Status:** ✅ done (commit 98dfea8)

---

## Supabase SQL Editor — Run these indexes once

```sql
-- Orders: filtered by status, sorted by date, filtered by location
CREATE INDEX IF NOT EXISTS idx_orders_status ON "Orders"(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON "Orders"(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_location ON "Orders"(location_id);

-- Inventory: joined on product, filtered by location
CREATE INDEX IF NOT EXISTS idx_inventory_product ON "Inventory"(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON "Inventory"(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_prod_loc ON "Inventory"(product_id, location_id);

-- Order_Items: joined on order_id
CREATE INDEX IF NOT EXISTS idx_orderitems_order ON "Order_Items"(order_id);

-- Payments: joined on order_id
CREATE INDEX IF NOT EXISTS idx_payments_order ON "Payments"(order_id);

-- Stock_Adjustments: filtered by product, location, date
CREATE INDEX IF NOT EXISTS idx_stockadj_product ON "Stock_Adjustments"(product_id);
CREATE INDEX IF NOT EXISTS idx_stockadj_date ON "Stock_Adjustments"(date DESC);
CREATE INDEX IF NOT EXISTS idx_stockadj_prod_loc ON "Stock_Adjustments"(product_id, location_id);

-- Stock_Transfers: filtered by product, from/to location, date
CREATE INDEX IF NOT EXISTS idx_stocktrans_product ON "Stock_Transfers"(product_id);
CREATE INDEX IF NOT EXISTS idx_stocktrans_transfer_date ON "Stock_Transfers"(transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_stocktrans_from_loc ON "Stock_Transfers"(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stocktrans_to_loc ON "Stock_Transfers"(to_location_id);

-- Activity_Log: sorted by timestamp
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON "Activity_Log"(timestamp DESC);

-- Notifications: filtered by location
CREATE INDEX IF NOT EXISTS idx_notifications_location ON "Notifications"(location_id);

-- Stock_Requests: filtered by location, status
CREATE INDEX IF NOT EXISTS idx_stockreq_from_loc ON "Stock_Requests"(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stockreq_to_loc ON "Stock_Requests"(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stockreq_status ON "Stock_Requests"(status);

-- Products: filtered by category, active status
CREATE INDEX IF NOT EXISTS idx_products_category ON "Products"(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON "Products"(is_active);
```
