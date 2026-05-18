import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Table, Tabs, Statistic,
  Select, Spin, Space, message, Divider,
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
import { qtyLabel } from '../../utils/format.js';

const { Title } = Typography;

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#faad14'];

const formatCurrency = (v) => `\u20B1${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const [inventoryPeriod, setInventoryPeriod] = useState(30);
  const [salesPeriod, setSalesPeriod] = useState(7);
  const [financialPeriod, setFinancialPeriod] = useState(30);
  const [activityPeriod, setActivityPeriod] = useState(7);

  const [loading, setLoading] = useState({ inventory: false, sales: false, financial: false, activity: false, system: false });

  const [inventorySummary, setInventorySummary] = useState({ stats: {}, by_branch: [], low_stock: [], distribution: [] });
  const [salesData, setSalesData] = useState({ stats: {}, daily: [], topProducts: [] });
  const [financialData, setFinancialData] = useState({ stats: {}, revenue: [], paymentMethods: [] });
  const [activityData, setActivityData] = useState({ stats: {}, by_user: [], by_module: [] });
  const [systemData, setSystemData] = useState({ stats: {}, backups: [] });

  const mkParams = (extra) => {
    const p = new URLSearchParams({ usertype: user?.usertype });
    if (user?.user_id) p.set('user_id', user.user_id);
    p.set('location_id', 'all');
    Object.entries(extra || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) p.set(k, v);
    });
    return p.toString();
  };

  const fetchInventory = async () => {
    setLoading((prev) => ({ ...prev, inventory: true }));
    try {
      const [summaryRes, lowStockRes] = await Promise.all([
        fetch(`/api/reports/inventory/summary?${mkParams({ location_id: 'all' })}`),
        fetch(`/api/reports/inventory/low-stock?${mkParams()}`),
      ]);
      const summary = await summaryRes.json();
      const lowStock = await lowStockRes.json();
      if (summary.success) {
        const data = summary.data;
        setInventorySummary({
          stats: data.stats || {},
          by_branch: data.rows || [],
          low_stock: lowStock.success ? (lowStock.data?.rows || []) : [],
          distribution: (data.rows || []).map((r) => ({
            location_name: r.location_name,
            total_quantity: r.total_quantity,
          })),
        });
      }
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
        fetch(`/api/reports/sales/daily?${mkParams({ days: salesPeriod })}`),
        fetch(`/api/reports/sales/top-products?${mkParams({ days: salesPeriod, limit: 10 })}`),
      ]);
      const daily = await dailyRes.json();
      const top = await topRes.json();
      if (daily.success) {
        setSalesData({
          stats: daily.data.stats || {},
          daily: daily.data.rows || [],
          topProducts: top.success ? (top.data.rows || []) : [],
        });
      }
    } catch {
      message.error('Failed to load sales reports');
    } finally {
      setLoading((prev) => ({ ...prev, sales: false }));
    }
  };

  const fetchFinancial = async () => {
    setLoading((prev) => ({ ...prev, financial: true }));
    try {
      const [revenueRes, pmRes] = await Promise.all([
        fetch(`/api/reports/financial/revenue?${mkParams({ days: financialPeriod })}`),
        fetch(`/api/reports/financial/payment-methods?${mkParams({ days: financialPeriod })}`),
      ]);
      const revenue = await revenueRes.json();
      const pm = await pmRes.json();
      if (revenue.success) {
        setFinancialData({
          stats: revenue.data.stats || {},
          revenue: revenue.data.rows || [],
          paymentMethods: pm.success ? (pm.data.rows || []) : [],
        });
      }
    } catch {
      message.error('Failed to load financial reports');
    } finally {
      setLoading((prev) => ({ ...prev, financial: false }));
    }
  };

  const fetchActivity = async () => {
    setLoading((prev) => ({ ...prev, activity: true }));
    try {
      const res = await fetch(`/api/reports/activity/summary?${mkParams({ days: activityPeriod })}`);
      const data = await res.json();
      if (data.success) {
        setActivityData({
          stats: data.data.stats || {},
          by_user: data.data.by_user || [],
          by_module: data.data.by_module || [],
        });
      }
    } catch {
      message.error('Failed to load activity reports');
    } finally {
      setLoading((prev) => ({ ...prev, activity: false }));
    }
  };

  const fetchSystem = async () => {
    setLoading((prev) => ({ ...prev, system: true }));
    try {
      const res = await fetch(`/api/reports/system/summary?${mkParams()}`);
      const data = await res.json();
      if (data.success) {
        setSystemData({
          stats: data.data.stats || {},
          backups: data.data.backups || [],
        });
      }
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
  }, [activeTab, salesPeriod, financialPeriod, activityPeriod]);

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isAdmin = user?.role === 'admin';

  const inventoryColsBranch = [
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Total Items', dataIndex: 'product_count', key: 'product_count', sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0) },
    { title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity', render: (v) => qtyLabel(v), sorter: (a, b) => (a.total_quantity || 0) - (b.total_quantity || 0) },
  ];

  const inventoryColsLowStock = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => (a.product_name || '').localeCompare(b.product_name || '') },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', sorter: (a, b) => (a.sku || '').localeCompare(b.sku || '') },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Stock', dataIndex: 'quantity', key: 'quantity', render: (v) => qtyLabel(v), sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0) },
    { title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', sorter: (a, b) => (a.reorder_level || 0) - (b.reorder_level || 0) },
  ];

  const salesColsTop = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => (a.product_name || '').localeCompare(b.product_name || '') },
    { title: 'Qty Sold', dataIndex: 'total_quantity', key: 'total_quantity', render: (v) => qtyLabel(v), sorter: (a, b) => (a.total_quantity || 0) - (b.total_quantity || 0) },
    { title: 'Total Revenue', dataIndex: 'total_revenue', key: 'total_revenue', render: (v) => formatCurrency(v), sorter: (a, b) => (a.total_revenue || 0) - (b.total_revenue || 0) },
  ];

  const financialColsRevenue = [
    { title: 'Date', dataIndex: 'date', key: 'date', sorter: (a, b) => (a.date || '').localeCompare(b.date || '') },
    { title: 'Orders', dataIndex: 'order_count', key: 'order_count', sorter: (a, b) => (a.order_count || 0) - (b.order_count || 0) },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: (v) => formatCurrency(v), sorter: (a, b) => (a.revenue || 0) - (b.revenue || 0) },
  ];

  const financialColsPM = [
    { title: 'Payment Method', dataIndex: 'payment_method', key: 'payment_method', sorter: (a, b) => (a.payment_method || '').localeCompare(b.payment_method || '') },
    { title: 'Transactions', dataIndex: 'count', key: 'count', sorter: (a, b) => (a.count || 0) - (b.count || 0) },
    { title: 'Total Amount', dataIndex: 'total', key: 'total', render: (v) => formatCurrency(v), sorter: (a, b) => (a.total || 0) - (b.total || 0) },
  ];

  const activityColsUser = [
    { title: 'User', dataIndex: 'username', key: 'username', sorter: (a, b) => (a.username || '').localeCompare(b.username || '') },
    { title: 'Actions', dataIndex: 'count', key: 'count', sorter: (a, b) => (a.count || 0) - (b.count || 0) },
  ];

  const activityColsModule = [
    { title: 'Module', dataIndex: 'module', key: 'module', sorter: (a, b) => (a.module || '').localeCompare(b.module || '') },
    { title: 'Actions', dataIndex: 'count', key: 'count', sorter: (a, b) => (a.count || 0) - (b.count || 0) },
  ];

  const systemColsBackup = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename', sorter: (a, b) => (a.filename || '').localeCompare(b.filename || '') },
    { title: 'Size', dataIndex: 'size', key: 'size', render: (v) => formatFileSize(v), sorter: (a, b) => (a.size || 0) - (b.size || 0) },
    { title: 'Created', dataIndex: 'created', key: 'created', sorter: (a, b) => (a.created || '').localeCompare(b.created || '') },
  ];

  const tabs = [];

  if (isOwner || isManager) {
    tabs.push({
      key: 'inventory',
      label: <span><DatabaseOutlined /> Inventory</span>,
      children: (
        <Spin spinning={loading.inventory}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Total Products" value={inventorySummary.stats.total_products ?? 0} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Low Stock Items" value={inventorySummary.stats.low_stock ?? 0} valueStyle={{ color: '#fa8c16' }} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Out of Stock" value={inventorySummary.stats.out_of_stock ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Stock Levels by Branch">
                <Table
                  dataSource={inventorySummary.by_branch}
                  columns={inventoryColsBranch}
                  rowKey="branch"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Stock Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={inventorySummary.distribution}
                      dataKey="total_quantity"
                      nameKey="location_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {inventorySummary.distribution.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
          <Divider />
          <Card title="Low Stock Items">
            <Table
              dataSource={inventorySummary.low_stock}
              columns={inventoryColsLowStock}
              rowKey={(r) => `${r.product_name || ''}-${r.location_name || ''}`}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Spin>
      ),
    });

    tabs.push({
      key: 'sales',
      label: <span><ShoppingCartOutlined /> Sales</span>,
      children: (
        <Spin spinning={loading.sales}>
          <Space style={{ marginBottom: 16 }}>
            <span>Period:</span>
            <Select value={salesPeriod} onChange={(v) => setSalesPeriod(v)} style={{ width: 120 }}>
              <Select.Option value={7}>7 days</Select.Option>
              <Select.Option value={30}>30 days</Select.Option>
              <Select.Option value={90}>90 days</Select.Option>
            </Select>
          </Space>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Total Orders" value={salesData.stats.total_orders ?? 0} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Total Revenue" value={formatCurrency(salesData.stats.total_revenue)} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Avg Order Value" value={formatCurrency(salesData.stats.avg_order_value)} /></Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Daily Sales Trend">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#1677ff" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Top Products">
                <Table
                  dataSource={salesData.topProducts}
                  columns={salesColsTop}
                  rowKey="product_name"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    });
  }

  if (isOwner) {
    tabs.push({
      key: 'financial',
      label: <span><DollarOutlined /> Financial</span>,
      children: (
        <Spin spinning={loading.financial}>
          <Space style={{ marginBottom: 16 }}>
            <span>Period:</span>
            <Select value={financialPeriod} onChange={(v) => setFinancialPeriod(v)} style={{ width: 120 }}>
              <Select.Option value={30}>30 days</Select.Option>
              <Select.Option value={90}>90 days</Select.Option>
              <Select.Option value={365}>365 days</Select.Option>
            </Select>
          </Space>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card><Statistic title="Total Revenue" value={formatCurrency(financialData.stats.total_revenue)} /></Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card><Statistic title="Total Orders" value={financialData.stats.total_orders ?? 0} /></Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Revenue by Date">
                <Table
                  dataSource={financialData.revenue}
                  columns={financialColsRevenue}
                  rowKey="date"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Payment Methods">
                <Table
                  dataSource={financialData.paymentMethods}
                  columns={financialColsPM}
                  rowKey="payment_method"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    });
  }

  if (isOwner || isAdmin) {
    tabs.push({
      key: 'activity',
      label: <span><UserOutlined /> Activity</span>,
      children: (
        <Spin spinning={loading.activity}>
          <Space style={{ marginBottom: 16 }}>
            <span>Period:</span>
            <Select value={activityPeriod} onChange={(v) => setActivityPeriod(v)} style={{ width: 120 }}>
              <Select.Option value={7}>7 days</Select.Option>
              <Select.Option value={30}>30 days</Select.Option>
              <Select.Option value={90}>90 days</Select.Option>
            </Select>
          </Space>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Card><Statistic title="Total Actions" value={activityData.stats.total_actions ?? 0} /></Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card><Statistic title="Unique Users" value={activityData.stats.unique_users ?? 0} /></Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Per-User Activity">
                <Table
                  dataSource={activityData.by_user}
                  columns={activityColsUser}
                  rowKey="user"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Per-Module Activity">
                <Table
                  dataSource={activityData.by_module}
                  columns={activityColsModule}
                  rowKey="module"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    });

    tabs.push({
      key: 'system',
      label: <span><SettingOutlined /> System</span>,
      children: (
        <Spin spinning={loading.system}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Backups" value={systemData.stats.backup_count ?? 0} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Actions (7d)" value={systemData.stats.activity_7d ?? 0} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Actions (30d)" value={systemData.stats.activity_30d ?? 0} /></Card>
            </Col>
          </Row>
          <Card title="Backup History" style={{ marginTop: 16 }}>
            <Table
              dataSource={systemData.backups}
              columns={systemColsBackup}
              rowKey="filename"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Spin>
      ),
    });
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Reports</Title>
      <Card styles={{ body: { padding: '16px 24px' } }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
      </Card>
    </div>
  );
};

export default Reports;
