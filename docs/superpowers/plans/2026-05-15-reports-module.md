# Reports Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Reports module with 5 tabs (Inventory, Sales, Financial, Activity, System) using aggregate backend queries and a tabbed frontend.

**Architecture:** New Flask Blueprint (`reports.py`) with aggregate SQLAlchemy queries for each report category. Frontend `Reports.jsx` rewritten with Ant Design `Tabs`, stat cards, sortable tables, and recharts for Inventory/Sales charts.

**Tech Stack:** Flask 3 + Flask-SQLAlchemy + SQLite (backend), React 19 + Ant Design 6 + recharts (frontend)

---

### Task 1: Backend — Create `backend/routes/reports.py`

**Files:** Create `backend/routes/reports.py`

- [ ] **Step 1: Create reports blueprint with auth helper**

Write the blueprint boilerplate and auth check at the top of `backend/routes/reports.py`:

```python
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from models import db, User, Product, Location, Inventory, Order, OrderItem, Payment
from models import StockTransfer, StockAdjustment, ActivityLog

reports_bp = Blueprint("reports", __name__)


def _authorized(usertype):
    return usertype in [1, 2, 3]


def _resolve_location_id(usertype, user_id, requested_location_id):
    if usertype == 2:
        user = User.query.get(user_id)
        if not user:
            return None
        return user.location_id
    return requested_location_id


def _parse_days(days_str):
    try:
        return max(1, min(365, int(days_str)))
    except (TypeError, ValueError):
        return 30
```

- [ ] **Step 2: Add inventory summary endpoint**

```python
@reports_bp.route("/api/reports/inventory/summary", methods=["GET"])
def inventory_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")
    resolved_location_id = _resolve_location_id(usertype, user_id, location_id)

    try:
        query = db.session.query(
            Location.location_id,
            Location.name.label("location_name"),
            db.func.count(Inventory.inventory_id).label("total_items"),
            db.func.coalesce(db.func.sum(Inventory.quantity), 0).label("total_quantity"),
        ).select_from(Location).outerjoin(
            Inventory, Inventory.location_id == Location.location_id
        )

        if resolved_location_id and resolved_location_id != "all":
            query = query.filter(Location.location_id == resolved_location_id)

        rows = query.group_by(Location.location_id).order_by(Location.name).all()

        total_products = db.session.query(db.func.count(Product.product_id)).scalar() or 0
        total_quantity = db.session.query(db.func.coalesce(db.func.sum(Inventory.quantity), 0)).scalar() or 0
        low_stock_count = 0
        all_inventory = Inventory.query.all()
        for inv in all_inventory:
            product = Product.query.get(inv.product_id)
            if product and product.reorder_level:
                    try:
                        if inv.quantity <= int(product.reorder_level):
                            low_stock_count += 1
                    except ValueError:
                        pass
        out_of_stock = Inventory.query.filter(Inventory.quantity == 0).count()

        result = []
        for r in rows:
            result.append({
                "location_id": r.location_id,
                "location_name": r.location_name,
                "total_items": r.total_items,
                "total_quantity": r.total_quantity,
            })

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_products": total_products,
                    "total_quantity": total_quantity,
                    "low_stock_count": low_stock_count,
                    "out_of_stock_count": out_of_stock,
                },
                "rows": result,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 3: Add inventory low-stock endpoint**

```python
@reports_bp.route("/api/reports/inventory/low-stock", methods=["GET"])
def inventory_low_stock():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        rows = []
        all_inventory = Inventory.query.all()
        for inv in all_inventory:
            product = Product.query.get(inv.product_id)
            if product and product.reorder_level:
                try:
                    if inv.quantity <= int(product.reorder_level):
                        location = Location.query.get(inv.location_id)
                        rows.append({
                            "product_id": product.product_id,
                            "product_name": product.name,
                            "sku": product.sku,
                            "location_name": location.name if location else "Unknown",
                            "quantity": inv.quantity,
                            "reorder_level": int(product.reorder_level),
                        })
                except ValueError:
                    pass

        rows.sort(key=lambda r: r["quantity"])
        return jsonify({"success": True, "data": {"rows": rows}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 4: Add sales daily endpoint**

```python
@reports_bp.route("/api/reports/sales/daily", methods=["GET"])
def sales_daily():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    user_id = request.args.get("user_id", type=int)
    location_id = request.args.get("location_id")
    resolved_location_id = _resolve_location_id(usertype, user_id, location_id)
    days = _parse_days(request.args.get("days", "30"))
    cutoff = datetime.now() - timedelta(days=days)

    try:
        query = db.session.query(
            db.func.date(Order.order_date).label("date"),
            db.func.count(Order.order_id).label("order_count"),
            db.func.coalesce(db.func.sum(Order.total_amount), 0).label("total_amount"),
        ).filter(Order.order_date >= cutoff, Order.status == "completed")

        if resolved_location_id and resolved_location_id != "all":
            query = query.filter(Order.location_id == resolved_location_id)

        rows = query.group_by(db.func.date(Order.order_date)).order_by(db.func.date(Order.order_date)).all()

        result = []
        total_orders = 0
        total_revenue = 0.0
        for r in rows:
            result.append({
                "date": r.date,
                "order_count": r.order_count,
                "total_amount": float(r.total_amount),
            })
            total_orders += r.order_count
            total_revenue += float(r.total_amount)

        avg_order = round(total_revenue / total_orders, 2) if total_orders > 0 else 0

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_orders": total_orders,
                    "total_revenue": round(total_revenue, 2),
                    "avg_order_value": avg_order,
                },
                "rows": result,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 5: Add sales top-products endpoint**

```python
@reports_bp.route("/api/reports/sales/top-products", methods=["GET"])
def sales_top_products():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    days = _parse_days(request.args.get("days", "30"))
    limit = request.args.get("limit", 10, type=int)
    cutoff = datetime.now() - timedelta(days=days)

    try:
        rows = db.session.query(
            Product.product_id,
            Product.name.label("product_name"),
            db.func.coalesce(db.func.sum(OrderItem.quantity), 0).label("total_qty"),
            db.func.coalesce(db.func.sum(OrderItem.quantity * OrderItem.price), 0).label("total_amount"),
        ).join(OrderItem, OrderItem.product_id == Product.product_id
        ).join(Order, Order.order_id == OrderItem.order_id
        ).filter(Order.order_date >= cutoff, Order.status == "completed"
        ).group_by(Product.product_id
        ).order_by(db.func.sum(OrderItem.quantity).desc()
        ).limit(limit).all()

        result = []
        for r in rows:
            result.append({
                "product_id": r.product_id,
                "product_name": r.product_name,
                "total_qty": r.total_qty,
                "total_amount": float(r.total_amount),
            })

        return jsonify({"success": True, "data": {"rows": result}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 6: Add financial revenue endpoint**

```python
@reports_bp.route("/api/reports/financial/revenue", methods=["GET"])
def financial_revenue():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    days = _parse_days(request.args.get("days", "30"))
    cutoff = datetime.now() - timedelta(days=days)

    try:
        rows = db.session.query(
            db.func.date(Order.order_date).label("date"),
            db.func.count(Order.order_id).label("order_count"),
            db.func.coalesce(db.func.sum(Order.total_amount), 0).label("revenue"),
        ).filter(Order.order_date >= cutoff, Order.status == "completed"
        ).group_by(db.func.date(Order.order_date)
        ).order_by(db.func.date(Order.order_date)).all()

        total_revenue = 0.0
        total_orders = 0
        result = []
        for r in rows:
            result.append({
                "date": r.date,
                "order_count": r.order_count,
                "revenue": float(r.revenue),
            })
            total_revenue += float(r.revenue)
            total_orders += r.order_count

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_revenue": round(total_revenue, 2),
                    "total_orders": total_orders,
                },
                "rows": result,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 7: Add financial payment-methods endpoint**

```python
@reports_bp.route("/api/reports/financial/payment-methods", methods=["GET"])
def financial_payment_methods():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    days = _parse_days(request.args.get("days", "30"))
    cutoff = datetime.now() - timedelta(days=days)

    try:
        rows = db.session.query(
            Payment.payment_method,
            db.func.count(Payment.payment_id).label("count"),
            db.func.coalesce(db.func.sum(Payment.price), 0).label("total_amount"),
        ).join(Order, Order.order_id == Payment.order_id
        ).filter(Order.order_date >= cutoff, Order.status == "completed"
        ).group_by(Payment.payment_method).all()

        result = []
        for r in rows:
            result.append({
                "payment_method": r.payment_method,
                "count": r.count,
                "total_amount": float(r.total_amount),
            })

        return jsonify({"success": True, "data": {"rows": result}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 8: Add activity summary endpoint**

```python
@reports_bp.route("/api/reports/activity/summary", methods=["GET"])
def activity_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    days = _parse_days(request.args.get("days", "30"))
    cutoff = datetime.now() - timedelta(days=days)

    try:
        total_logs = ActivityLog.query.filter(ActivityLog.timestamp >= cutoff).count()
        unique_users = db.session.query(db.func.count(db.distinct(ActivityLog.user_id))).filter(
            ActivityLog.timestamp >= cutoff
        ).scalar() or 0

        by_user = db.session.query(
            ActivityLog.user_id,
            User.username,
            db.func.count(ActivityLog.log_id).label("count"),
        ).join(User, User.user_id == ActivityLog.user_id
        ).filter(ActivityLog.timestamp >= cutoff
        ).group_by(ActivityLog.user_id).order_by(db.func.count(ActivityLog.log_id).desc()).all()

        by_module = db.session.query(
            ActivityLog.module,
            db.func.count(ActivityLog.log_id).label("count"),
        ).filter(ActivityLog.timestamp >= cutoff
        ).group_by(ActivityLog.module).order_by(db.func.count(ActivityLog.log_id).desc()).all()

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "total_logs": total_logs,
                    "unique_users": unique_users,
                },
                "by_user": [{"user_id": u.user_id, "username": u.username, "count": u.count} for u in by_user],
                "by_module": [{"module": m.module, "count": m.count} for m in by_module],
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 9: Add system summary endpoint**

```python
@reports_bp.route("/api/reports/system/summary", methods=["GET"])
def system_summary():
    usertype = request.args.get("usertype", type=int)
    if not _authorized(usertype):
        return jsonify({"success": False, "error": "Unauthorized"}), 403

    try:
        import os
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "db", "backups")
        backup_count = 0
        backups = []
        if os.path.exists(backup_dir):
            for f in sorted(os.listdir(backup_dir), reverse=True):
                if f.endswith(".db"):
                    fpath = os.path.join(backup_dir, f)
                    stat = os.stat(fpath)
                    backups.append({
                        "filename": f,
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    })
                    backup_count += 1

        now = datetime.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        week_count = ActivityLog.query.filter(ActivityLog.timestamp >= week_ago).count()
        month_count = ActivityLog.query.filter(ActivityLog.timestamp >= month_ago).count()

        return jsonify({
            "success": True,
            "data": {
                "stats": {
                    "backup_count": backup_count,
                    "activity_7d": week_count,
                    "activity_30d": month_count,
                },
                "backups": backups,
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 10: Commit**

```bash
git add backend/routes/reports.py
git commit -m "feat: add reports backend with 8 aggregate query endpoints"
```

---

### Task 2: Backend — Register reports blueprint in app.py

**Files:** Modify `backend/app.py`

- [ ] **Step 1: Add import and register blueprint**

Add import after line 11 (`from routes.admin import admin_bp`):
```python
from routes.reports import reports_bp
```

Add registration after line 25 (`app.register_blueprint(admin_bp)`):
```python
    app.register_blueprint(reports_bp)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app.py
git commit -m "feat: register reports blueprint in app.py"
```

---

### Task 3: Frontend — Rewrite Reports.jsx

**Files:** Overwrite `frontend/src/pages/module/Reports.jsx`

- [ ] **Step 1: Write the full Reports page**

Write the complete tabbed Reports page to `frontend/src/pages/module/Reports.jsx`:

```jsx
import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Table, Tag, Tabs, Statistic,
  Select, DatePicker, Spin, Space, message, Divider,
} from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DatabaseOutlined, ShoppingCartOutlined, DollarOutlined,
  UserOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#faad14'];

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState({});
  const [inventoryData, setInventoryData] = useState(null);
  const [lowStockData, setLowStockData] = useState([]);
  const [salesData, setSalesData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activityData, setActivityData] = useState(null);
  const [systemData, setSystemData] = useState(null);
  const [salesDays, setSalesDays] = useState(30);
  const [financialDays, setFinancialDays] = useState(30);
  const [activityDays, setActivityDays] = useState(30);

  const fetchInventory = async () => {
    setLoading((prev) => ({ ...prev, inventory: true }));
    try {
      const [summaryRes, lowStockRes] = await Promise.all([
        fetch(`/api/reports/inventory/summary?usertype=${user.usertype}&user_id=${user.user_id}&location_id=${user.usertype === 2 ? user.location_id : 'all'}`),
        fetch(`/api/reports/inventory/low-stock?usertype=${user.usertype}`),
      ]);
      const summary = await summaryRes.json();
      const lowStock = await lowStockRes.json();
      if (summary.success) setInventoryData(summary.data);
      if (lowStock.success) setLowStockData(lowStock.data.rows);
    } catch {
      message.error('Failed to load inventory reports');
    } finally {
      setLoading((prev) => ({ ...prev, inventory: false }));
    }
  };

  const fetchSales = async () => {
    setLoading((prev) => ({ ...prev, sales: true }));
    try {
      const [dailyRes, topRes] = await Promise.all([
        fetch(`/api/reports/sales/daily?usertype=${user.usertype}&user_id=${user.user_id}&location_id=${user.usertype === 2 ? user.location_id : 'all'}&days=${salesDays}`),
        fetch(`/api/reports/sales/top-products?usertype=${user.usertype}&days=${salesDays}&limit=10`),
      ]);
      const daily = await dailyRes.json();
      const top = await topRes.json();
      if (daily.success) setSalesData(daily.data);
      if (top.success) setTopProducts(top.data.rows);
    } catch {
      message.error('Failed to load sales reports');
    } finally {
      setLoading((prev) => ({ ...prev, sales: false }));
    }
  };

  const fetchFinancial = async () => {
    setLoading((prev) => ({ ...prev, financial: true }));
    try {
      const [revRes, pmRes] = await Promise.all([
        fetch(`/api/reports/financial/revenue?usertype=${user.usertype}&days=${financialDays}`),
        fetch(`/api/reports/financial/payment-methods?usertype=${user.usertype}&days=${financialDays}`),
      ]);
      const rev = await revRes.json();
      const pm = await pmRes.json();
      if (rev.success) setFinancialData(rev.data);
      if (pm.success) setPaymentMethods(pm.data.rows);
    } catch {
      message.error('Failed to load financial reports');
    } finally {
      setLoading((prev) => ({ ...prev, financial: false }));
    }
  };

  const fetchActivity = async () => {
    setLoading((prev) => ({ ...prev, activity: true }));
    try {
      const res = await fetch(`/api/reports/activity/summary?usertype=${user.usertype}&days=${activityDays}`);
      const data = await res.json();
      if (data.success) setActivityData(data.data);
    } catch {
      message.error('Failed to load activity reports');
    } finally {
      setLoading((prev) => ({ ...prev, activity: false }));
    }
  };

  const fetchSystem = async () => {
    setLoading((prev) => ({ ...prev, system: true }));
    try {
      const res = await fetch(`/api/reports/system/summary?usertype=${user.usertype}`);
      const data = await res.json();
      if (data.success) setSystemData(data.data);
    } catch {
      message.error('Failed to load system reports');
    } finally {
      setLoading((prev) => ({ ...prev, system: false }));
    }
  };

  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory();
    else if (activeTab === 'sales') fetchSales();
    else if (activeTab === 'financial') fetchFinancial();
    else if (activeTab === 'activity') fetchActivity();
    else if (activeTab === 'system') fetchSystem();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'sales') fetchSales();
  }, [salesDays]);

  useEffect(() => {
    if (activeTab === 'financial') fetchFinancial();
  }, [financialDays]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivity();
  }, [activityDays]);

  const inventoryColumns = [
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => a.location_name.localeCompare(b.location_name) },
    { title: 'Total Items', dataIndex: 'total_items', key: 'total_items', sorter: (a, b) => a.total_items - b.total_items },
    { title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity', sorter: (a, b) => a.total_quantity - b.total_quantity },
  ];

  const lowStockColumns = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => a.product_name.localeCompare(b.product_name) },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => a.location_name.localeCompare(b.location_name) },
    { title: 'Stock', dataIndex: 'quantity', key: 'quantity', sorter: (a, b) => a.quantity - b.quantity },
    { title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', sorter: (a, b) => a.reorder_level - b.reorder_level },
  ];

  const topProductColumns = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => a.product_name.localeCompare(b.product_name) },
    { title: 'Qty Sold', dataIndex: 'total_qty', key: 'total_qty', sorter: (a, b) => a.total_qty - b.total_qty },
    { title: 'Total Revenue', dataIndex: 'total_amount', key: 'total_amount', render: (v) => `₱${v.toLocaleString()}`, sorter: (a, b) => a.total_amount - b.total_amount },
  ];

  const paymentMethodColumns = [
    { title: 'Payment Method', dataIndex: 'payment_method', key: 'payment_method', sorter: (a, b) => a.payment_method.localeCompare(b.payment_method) },
    { title: 'Transactions', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
    { title: 'Total Amount', dataIndex: 'total_amount', key: 'total_amount', render: (v) => `₱${v.toLocaleString()}`, sorter: (a, b) => a.total_amount - b.total_amount },
  ];

  const revenueColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', sorter: (a, b) => a.date.localeCompare(b.date) },
    { title: 'Orders', dataIndex: 'order_count', key: 'order_count', sorter: (a, b) => a.order_count - b.order_count },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: (v) => `₱${v.toLocaleString()}`, sorter: (a, b) => a.revenue - b.revenue },
  ];

  const userActivityColumns = [
    { title: 'User', dataIndex: 'username', key: 'username', sorter: (a, b) => a.username.localeCompare(b.username) },
    { title: 'Actions', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
  ];

  const moduleActivityColumns = [
    { title: 'Module', dataIndex: 'module', key: 'module', sorter: (a, b) => a.module.localeCompare(b.module) },
    { title: 'Actions', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
  ];

  const backupColumns = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename', sorter: (a, b) => a.filename.localeCompare(b.filename) },
    { title: 'Size', dataIndex: 'size', key: 'size', render: (v) => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let s = v;
      for (const u of units) { if (s < 1024) return `${s.toFixed(1)} ${u}`; s /= 1024; }
      return `${s.toFixed(1)} TB`;
    }, sorter: (a, b) => a.size - b.size },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (v) => new Date(v).toLocaleString(), sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at) },
  ];

  const renderTab = (key, content, spinKey) => (
    <Spin spinning={loading[spinKey]}>
      {content}
    </Spin>
  );

  const tabItems = [
    ...(user?.role === 'owner' || user?.role === 'manager'
      ? [{
          key: 'inventory',
          label: <span><DatabaseOutlined /> Inventory</span>,
          children: renderTab('inventory', (
            <>
              {inventoryData && (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Total Products" value={inventoryData.stats.total_products} prefix={<DatabaseOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Low Stock Items" value={inventoryData.stats.low_stock_count} valueStyle={{ color: '#fa8c16' }} prefix={<DatabaseOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Out of Stock" value={inventoryData.stats.out_of_stock_count} valueStyle={{ color: '#ff4d4f' }} prefix={<DatabaseOutlined />} /></Card>
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                      <Card title="Stock Levels by Branch" size="small">
                        <Table dataSource={inventoryData.rows} columns={inventoryColumns} rowKey="location_id" pagination={false} size="small" />
                      </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                      <Card title="Stock Distribution" size="small">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie data={inventoryData.rows} cx="50%" cy="50%" outerRadius={80} dataKey="total_quantity" nameKey="location_name" label={({ location_name, percent }) => `${location_name} ${(percent * 100).toFixed(0)}%`}>
                              {inventoryData.rows.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                  </Row>
                  <Divider />
                  <Card title="Low Stock Items" size="small">
                    <Table dataSource={lowStockData} columns={lowStockColumns} rowKey={(r) => `${r.product_id}-${r.location_name}`} pagination={{ pageSize: 5 }} size="small" />
                  </Card>
                </>
              )}
            </>
          ), 'inventory'),
        }]
      : []),
    ...(user?.role === 'owner' || user?.role === 'manager'
      ? [{
          key: 'sales',
          label: <span><ShoppingCartOutlined /> Sales</span>,
          children: renderTab('sales', (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Text>Period:</Text>
                <Select value={salesDays} onChange={setSalesDays} style={{ width: 120 }}>
                  <Select.Option value={7}>Last 7 days</Select.Option>
                  <Select.Option value={30}>Last 30 days</Select.Option>
                  <Select.Option value={90}>Last 90 days</Select.Option>
                </Select>
              </Space>
              {salesData && (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Total Orders" value={salesData.stats.total_orders} prefix={<ShoppingCartOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Total Revenue" value={`₱${salesData.stats.total_revenue.toLocaleString()}`} prefix={<DollarOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Avg Order Value" value={`₱${salesData.stats.avg_order_value.toLocaleString()}`} prefix={<DollarOutlined />} /></Card>
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                      <Card title="Daily Sales Trend" size="small">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={salesData.rows}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="total_amount" fill="#1677ff" name="Revenue" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                      <Card title="Top Products" size="small">
                        <Table dataSource={topProducts} columns={topProductColumns} rowKey="product_id" pagination={false} size="small" />
                      </Card>
                    </Col>
                  </Row>
                </>
              )}
            </>
          ), 'sales'),
        }]
      : []),
    ...(user?.role === 'owner'
      ? [{
          key: 'financial',
          label: <span><DollarOutlined /> Financial</span>,
          children: renderTab('financial', (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Text>Period:</Text>
                <Select value={financialDays} onChange={setFinancialDays} style={{ width: 120 }}>
                  <Select.Option value={30}>Last 30 days</Select.Option>
                  <Select.Option value={90}>Last 90 days</Select.Option>
                  <Select.Option value={365}>Last 365 days</Select.Option>
                </Select>
              </Space>
              {financialData && (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12}>
                      <Card><Statistic title="Total Revenue" value={`₱${financialData.stats.total_revenue.toLocaleString()}`} prefix={<DollarOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card><Statistic title="Total Orders" value={financialData.stats.total_orders} prefix={<ShoppingCartOutlined />} /></Card>
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card title="Revenue by Date" size="small">
                        <Table dataSource={financialData.rows} columns={revenueColumns} rowKey="date" pagination={false} size="small" />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="Payment Methods" size="small">
                        <Table dataSource={paymentMethods} columns={paymentMethodColumns} rowKey="payment_method" pagination={false} size="small" />
                      </Card>
                    </Col>
                  </Row>
                </>
              )}
            </>
          ), 'financial'),
        }]
      : []),
    ...(user?.role === 'owner' || user?.role === 'admin'
      ? [{
          key: 'activity',
          label: <span><UserOutlined /> Activity</span>,
          children: renderTab('activity', (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Text>Period:</Text>
                <Select value={activityDays} onChange={setActivityDays} style={{ width: 120 }}>
                  <Select.Option value={7}>Last 7 days</Select.Option>
                  <Select.Option value={30}>Last 30 days</Select.Option>
                  <Select.Option value={90}>Last 90 days</Select.Option>
                </Select>
              </Space>
              {activityData && (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12}>
                      <Card><Statistic title="Total Actions" value={activityData.stats.total_logs} prefix={<UserOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card><Statistic title="Unique Users" value={activityData.stats.unique_users} prefix={<UserOutlined />} /></Card>
                    </Col>
                  </Row>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                      <Card title="Per-User Activity" size="small">
                        <Table dataSource={activityData.by_user} columns={userActivityColumns} rowKey="user_id" pagination={false} size="small" />
                      </Card>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Card title="Per-Module Activity" size="small">
                        <Table dataSource={activityData.by_module} columns={moduleActivityColumns} rowKey="module" pagination={false} size="small" />
                      </Card>
                    </Col>
                  </Row>
                </>
              )}
            </>
          ), 'activity'),
        }]
      : []),
    ...(user?.role === 'owner' || user?.role === 'admin'
      ? [{
          key: 'system',
          label: <span><SettingOutlined /> System</span>,
          children: renderTab('system', (
            <>
              {systemData && (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Backups" value={systemData.stats.backup_count} prefix={<SettingOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Actions (7d)" value={systemData.stats.activity_7d} prefix={<UserOutlined />} /></Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card><Statistic title="Actions (30d)" value={systemData.stats.activity_30d} prefix={<UserOutlined />} /></Card>
                    </Col>
                  </Row>
                  <Card title="Backup History" size="small">
                    <Table dataSource={systemData.backups} columns={backupColumns} rowKey="filename" pagination={false} size="small" />
                  </Card>
                </>
              )}
            </>
          ), 'system'),
        }]
      : []),
  ];

  return (
    <Card style={{ margin: 24 }}>
      <Title level={2}>Reports</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Card>
  );
};

export default Reports;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/module/Reports.jsx
git commit -m "feat: implement full Reports page with 5 tabs, charts, and role gating"
```

---

### Task 4: Update THESIS-REQUIREMENTS.md

**Files:** Modify `THESIS-REQUIREMENTS.md`

- [ ] **Step 1: Mark Reports as Complete**

Change line:
```
| Reports Module | ❌ Missing | Page is a stub. No backend endpoints. |
```
to:
```
| Reports Module | ✅ Complete | 5-tab page with aggregate reports (Inventory, Sales, Financial, Activity, System) with charts and sortable tables. |
```

- [ ] **Step 2: Commit**

```bash
git add THESIS-REQUIREMENTS.md
git commit -m "docs: mark Reports Module complete in thesis tracker"
```

---

### Task 5: Final verification and PR

- [ ] **Step 1: Run frontend lint**

```bash
cd frontend && npm run lint -- --quiet 2>&1
```

Fix any errors in Reports.jsx.

- [ ] **Step 2: Verify backend imports**

```bash
python3 -c "import py_compile; py_compile.compile('backend/routes/reports.py', doraise=True); py_compile.compile('backend/app.py', doraise=True); print('Syntax OK')"
```

- [ ] **Step 3: Push and create PR**

```bash
git push
gh pr create --title "feat: implement reports module with 5 tabs" --body "..." --base main
```
