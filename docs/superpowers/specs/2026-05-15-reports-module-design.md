# Reports Module — Design Spec

## Overview

The Reports module provides automated, aggregated reports across Inventory, Sales, Financial, Activity, and System data. Each category is a separate tab with summary stat cards, data tables, and optional charts. All reports query real database tables directly.

## Roles & Access

| Role | Tabs Visible | Branch Scope |
|------|-------------|-------------|
| Owner | All 5 | All branches (branch selector in UI) |
| Manager | Inventory + Sales | Assigned branch only (no selector) |
| Admin | Activity + System | All branches |

## Backend

### New File: `backend/routes/reports.py`

A new Flask Blueprint (`reports_bp`) with aggregate query endpoints. Register in `app.py`.

### Endpoints

All endpoints accept `?usertype=N` for auth and `?days=N` for date range filtering. Manager endpoints auto-scope via `_resolve_location_id()`.

**Inventory Tab:**
- `GET /api/reports/inventory/summary` — per-branch stock levels, low stock counts, total inventory value
- `GET /api/reports/inventory/low-stock` — products below reorder level with branch info

**Sales Tab:**
- `GET /api/reports/sales/daily?days=7|30|90` — daily sales totals, order count, avg order value
- `GET /api/reports/sales/top-products?days=30&limit=10` — top N products by quantity sold

**Financial Tab:**
- `GET /api/reports/financial/revenue?days=30|90|365` — revenue by period
- `GET /api/reports/financial/payment-methods?days=30` — payment method breakdown

**Activity Tab:**
- `GET /api/reports/activity/summary?days=30` — total logs, unique users, per-user action counts, per-module breakdown

**System Tab:**
- `GET /api/reports/system/summary` — backup count, backup history, activity volume by period

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": {
    "stats": { "key": value, ... },
    "rows": [ ... ]
  }
}
```

### Data Sources

- **Inventory**: `Inventory`, `Product`, `Location`, `StockAdjustment`, `StockTransfer`
- **Sales**: `Order`, `OrderItem`, `Location`
- **Financial**: `Order`, `Payment`, `OrderItem`
- **Activity**: `ActivityLog`, `User`
- **System**: `ActivityLog` (counts by module), filesystem backup listing

## Frontend

### File: `frontend/src/pages/module/Reports.jsx`

Rewrite the stub into a full tabbed page.

### Layout

```
Card
  Title: "Reports"
  Tabs
    Tab: Inventory
      Row: 3 Statistic cards (Total Products, Low Stock, Out of Stock)
      Row: Date range selector (optional)
      Table: per-branch stock levels (Branch, Items, Low Stock, Value)
      Chart: Pie chart (stock distribution by branch) via recharts

    Tab: Sales
      Row: 3 Statistic cards (Today's Sales, Monthly Sales, Avg Order Value)
      Row: Date range selector
      Table: top products by quantity
      Chart: Bar chart (daily sales trend) via recharts

    Tab: Financial
      Row: 2 Statistic cards (Total Revenue, Total Orders)
      Row: Date range selector
      Table: payment method breakdown
      Table: revenue by period

    Tab: Activity
      Row: 2 Statistic cards (Total Logs, Unique Users)
      Row: Date range selector
      Table: per-user action summary
      Table: module breakdown

    Tab: System
      Row: 2 Statistic cards (Backups, Status)
      Table: backup history
      Table: activity volume by period
```

### State & Fetching

- Single `useEffect` per tab fetches data when tab is switched
- Each tab has its own loading state
- Fetch pattern: try/catch + `message.error()` + `setLoading(false)` in finally
- Date range changes trigger re-fetch

### Role Gating

- Tab visibility controlled by `user.role`:
  - Owner: show all 5
  - Manager: show Inventory + Sales only
  - Admin: show Activity + System only
- Inventory/Sales tabs: when manager, pass their `selectedLocationId` to API

### Charts

- Uses `recharts` (already a dependency)
- Inventory: `PieChart` showing stock distribution by branch
- Sales: `BarChart` showing daily sales trend

## Files Changed

| File | Action |
|------|--------|
| `backend/routes/reports.py` | New — aggregate query endpoints |
| `backend/app.py` | Edit — register `reports_bp` |
| `frontend/src/pages/module/Reports.jsx` | Rewrite — full tabbed page |
| `THESIS-REQUIREMENTS.md` | Edit — mark Reports as Complete |
