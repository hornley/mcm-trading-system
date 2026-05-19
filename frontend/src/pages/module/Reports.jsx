import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Table, Tabs, Statistic,
  Select, Spin, Space, message, Divider, Button, Modal, Form,
  Input, Tag, List, Badge, Tooltip,
} from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DatabaseOutlined, ShoppingCartOutlined, DollarOutlined,
  UserOutlined, SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
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
  const { user, selectedLocationId } = useAuth();
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'activity' : 'inventory');
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
  const [storeReports, setStoreReports] = useState([]);
  const [loadingStoreReports, setLoadingStoreReports] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm] = Form.useForm();
  const [editingReport, setEditingReport] = useState(null);
  const [locations, setLocations] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [distributionData, setDistributionData] = useState([]);
  const [stockLevelsView, setStockLevelsView] = useState('table');

  const mkParams = (extra) => {
    const p = new URLSearchParams({ usertype: user?.usertype });
    if (user?.user_id) p.set('user_id', user.user_id);
    p.set('location_id', 'all');
    Object.entries(extra || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) p.set(k, v);
    });
    return p.toString();
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`/api/products?${mkParams({ is_active: 'true' })}`);
      const data = await res.json();
      if (data.success) {
        setProductsList(data.data.map((p) => ({ label: p.name, value: p.product_id })));
      }
    } catch {
      message.error('Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchInventory = async () => {
    setLoading((prev) => ({ ...prev, inventory: true }));
    try {
      const locationParam = selectedLocationId !== 'all' ? selectedLocationId : 'all';

      const [statsRes, allBranchesRes, lowStockRes] = await Promise.all([
        fetch(`/api/reports/inventory/summary?${mkParams({ location_id: locationParam })}`),
        fetch(`/api/reports/inventory/summary?${mkParams({ location_id: 'all' })}`),
        fetch(`/api/reports/inventory/low-stock?${mkParams({ location_id: locationParam })}`),
      ]);
      const stats = await statsRes.json();
      const allBranches = await allBranchesRes.json();
      const lowStock = await lowStockRes.json();

      if (stats.success && allBranches.success) {
        setInventorySummary({
          stats: stats.data?.stats || {},
          by_branch: allBranches.data?.rows || [],
          low_stock: lowStock.success ? (lowStock.data?.rows || []) : [],
          distribution: allBranches.data?.rows || [],
        });
      }
    } catch {
      message.error('Failed to load inventory reports');
    } finally {
      setLoading((prev) => ({ ...prev, inventory: false }));
    }
  };

  const fetchDistribution = async () => {
    try {
      const params = { location_id: 'all' };
      if (selectedProduct) params.product_id = selectedProduct;
      const res = await fetch(`/api/reports/inventory/summary?${mkParams(params)}`);
      const data = await res.json();
      if (data.success) {
        setDistributionData((data.data.rows || []).map((r) => ({
          location_name: r.location_name,
          total_quantity: Math.floor(r.total_quantity),
        })));
      }
    } catch {
      message.error('Failed to load distribution data');
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

  const fetchStoreReports = async () => {
    setLoadingStoreReports(true);
    try {
      const res = await fetch(`/api/store-reports?usertype=${user?.usertype}&user_id=${user?.user_id}`);
      const data = await res.json();
      if (data.success) {
        setStoreReports(data.data || []);
      }
    } catch {
      message.error('Failed to load store reports');
    } finally {
      setLoadingStoreReports(false);
    }
  };

  const handleCreateReport = () => {
    setEditingReport(null);
    reportForm.resetFields();
    setReportModalOpen(true);
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    reportForm.setFieldsValue({
      title: report.title,
      location_id: report.location_id,
      issue_type: report.issue_type,
      description: report.description,
    });
    setReportModalOpen(true);
  };

  const handleSubmitReport = async (values) => {
    try {
      const payload = {
        usertype: user?.usertype,
        user_id: user?.user_id,
        location_id: values.location_id,
        title: values.title,
        issue_type: values.issue_type,
        description: values.description,
      };

      let res;
      if (editingReport) {
        res = await fetch(`/api/store-reports/${editingReport.report_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/store-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        message.success(editingReport ? 'Report updated' : 'Report created');
        setReportModalOpen(false);
        fetchStoreReports();
      } else {
        message.error(data.error || 'Failed to save report');
      }
    } catch {
      message.error('Failed to save report');
    }
  };

  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      const res = await fetch(`/api/store-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user?.usertype, user_id: user?.user_id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Status updated');
        fetchStoreReports();
      }
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleVoidReport = (reportId) => {
    Modal.confirm({
      title: 'Void Report',
      content: 'Are you sure you want to void this report?',
      okText: 'Yes, Void',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await fetch(`/api/store-reports/${reportId}?usertype=${user?.usertype}&user_id=${user?.user_id}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (data.success) {
            message.success('Report voided');
            fetchStoreReports();
          }
        } catch {
          message.error('Failed to void report');
        }
      },
    });
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`/api/locations?usertype=${user?.usertype}`);
      const data = await res.json();
      if (data.success) {
        setLocations(data.data.map((l) => ({ label: l.name, value: l.location_id })));
      }
    } catch {
      message.error('Failed to load locations');
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchProducts();
    if (activeTab === 'inventory') {
      fetchInventory();
      fetchDistribution();
    }
    else if (activeTab === 'sales') fetchSales();
    else if (activeTab === 'financial') fetchFinancial();
    else if (activeTab === 'activity') {
      fetchActivity();
      fetchStoreReports();
    }
    else if (activeTab === 'system') fetchSystem();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchDistribution();
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [selectedLocationId]);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const inventoryColsBranch = [
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Total Items', dataIndex: 'product_count', key: 'product_count', sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0) },
    { title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity', render: (v) => Math.floor(v).toLocaleString(), sorter: (a, b) => (a.total_quantity || 0) - (b.total_quantity || 0) },
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

  if (isOwner) {
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
              <Card><Statistic title="Low Stock Items" value={inventorySummary.stats.low_stock_count ?? 0} valueStyle={{ color: '#fa8c16' }} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="Out of Stock" value={inventorySummary.stats.out_of_stock_count ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card
                title={
                  <Space>
                    <span>Stock Levels by Branch</span>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setStockLevelsView(stockLevelsView === 'table' ? 'chart' : 'table')}
                    >
                      {stockLevelsView === 'table' ? 'Chart' : 'Table'}
                    </Button>
                  </Space>
                }
              >
                {stockLevelsView === 'table' ? (
                  <Table
                    dataSource={inventorySummary.by_branch}
                    columns={inventoryColsBranch}
                    rowKey="branch"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={inventorySummary.by_branch}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location_name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total_quantity" name="Total Quantity">
                        {inventorySummary.by_branch.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title={
                  <Space>
                    <span>Stock Distribution</span>
                    <Select
                      allowClear
                      showSearch
                      placeholder="Filter by product"
                      value={selectedProduct}
                      onChange={(v) => setSelectedProduct(v)}
                      options={productsList}
                      loading={loadingProducts}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      style={{ width: 200 }}
                    />
                  </Space>
                }
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="total_quantity"
                      nameKey="location_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {distributionData.map((_, idx) => (
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
          <Divider />
          <Card title="Store Reports" extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateReport}>New Report</Button>}>
            <Spin spinning={loadingStoreReports}>
              <Table
                dataSource={storeReports}
                columns={[
                  { title: 'User', dataIndex: 'username', key: 'username' },
                  { title: 'Branch', dataIndex: 'location_name', key: 'location_name' },
                  { title: 'Issue Type', dataIndex: 'issue_type', key: 'issue_type', render: (v) => {
                    const labels = { store: 'Store Issue', materials: 'Materials Issue', software: 'Software Issue' };
                    return <Tag>{labels[v] || v}</Tag>;
                  }},
                  { title: 'Status', dataIndex: 'status', key: 'status', render: (v, record) => {
                    const colors = { pending: 'orange', resolved: 'green', voided: 'red' };
                    const statusTag = <Tag color={colors[v]}>{v}</Tag>;
                    return (
                      <Space>
                        {v === 'resolved' && record.resolved_by_username && record.resolved_at ? (
                          <Tooltip title={`Resolved by ${record.resolved_by_username} on ${new Date(record.resolved_at).toLocaleString()}`}>
                            {statusTag}
                          </Tooltip>
                        ) : (
                          statusTag
                        )}
                        {v === 'pending' && (
                          <Button size="small" type="link" onClick={() => handleUpdateStatus(record.report_id, 'resolved')}>Resolve</Button>
                        )}
                      </Space>
                    );
                  }},
                  { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? new Date(v).toLocaleString() : '' },
                  { title: 'Actions', key: 'actions', render: (_, record) => (
                    <Space>
                      {record.status === 'pending' && (
                        <>
                          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditReport(record)} />
                          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleVoidReport(record.report_id)} />
                        </>
                      )}
                    </Space>
                  )},
                ]}
                rowKey="report_id"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Spin>
          </Card>
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

  if (isManager) {
    return <ManagerReports user={user} selectedLocationId={selectedLocationId} />;
  }

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Reports</Title>
      <Card styles={{ body: { padding: '16px 24px' } }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
      </Card>
      {isOwnerOrAdmin && (
        <Modal
          title={editingReport ? 'Edit Report' : 'New Report'}
          open={reportModalOpen}
          onCancel={() => setReportModalOpen(false)}
          footer={null}
        >
          <Form form={reportForm} layout="vertical" onFinish={handleSubmitReport}>
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
              <Input placeholder="Enter report title" />
            </Form.Item>
            <Form.Item name="location_id" label="Branch" rules={[{ required: true, message: 'Please select branch' }]}>
              <Select placeholder="Select branch" options={locations} />
            </Form.Item>
            <Form.Item name="issue_type" label="Issue Type" rules={[{ required: true, message: 'Please select issue type' }]}>
              <Select placeholder="Select issue type" options={ISSUE_TYPES} />
            </Form.Item>
            <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please enter description' }]}>
              <Input.TextArea rows={4} placeholder="Explain the issue in detail..." />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setReportModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">
                  {editingReport ? 'Update' : 'Submit'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

const ISSUE_TYPES = [
  { value: 'store', label: 'Store Issue' },
  { value: 'materials', label: 'Materials Issue' },
  { value: 'software', label: 'Software Issue' },
];

const STATUS_COLORS = {
  pending: 'orange',
  resolved: 'green',
  voided: 'red',
};

const ManagerReports = ({ user, selectedLocationId }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form] = Form.useForm();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/store-reports?usertype=${user?.usertype}&user_id=${user?.user_id}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.data || []);
      }
    } catch {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user?.usertype, user?.user_id]);

  const handleCreate = () => {
    setSelectedReport(null);
    setEditMode(false);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (report) => {
    setSelectedReport(report);
    setEditMode(true);
    form.setFieldsValue({
      title: report.title,
      issue_type: report.issue_type,
      description: report.description,
    });
    setModalOpen(true);
  };

  const handleView = (report) => {
    setSelectedReport(report);
    setEditMode(false);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        usertype: user?.usertype,
        user_id: user?.user_id,
        location_id: selectedLocationId || user?.location_id,
        title: values.title,
        issue_type: values.issue_type,
        description: values.description,
      };

      let res;
      if (editMode && selectedReport) {
        res = await fetch(`/api/store-reports/${selectedReport.report_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/store-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        message.success(editMode ? 'Report updated' : 'Report created');
        setModalOpen(false);
        fetchReports();
      } else {
        message.error(data.error || 'Failed to save report');
      }
    } catch {
      message.error('Failed to save report');
    }
  };

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      const res = await fetch(`/api/store-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user?.usertype, user_id: user?.user_id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Status updated');
        fetchReports();
        if (selectedReport?.report_id === reportId) {
          setSelectedReport((prev) => ({ ...prev, status: newStatus }));
        }
      }
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleVoid = (reportId) => {
    Modal.confirm({
      title: 'Void Report',
      content: 'Are you sure you want to void this report?',
      okText: 'Yes, Void',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await fetch(`/api/store-reports/${reportId}?usertype=${user?.usertype}&user_id=${user?.user_id}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (data.success) {
            message.success('Report voided');
            fetchReports();
            if (selectedReport?.report_id === reportId) {
              setSelectedReport(null);
            }
          }
        } catch {
          message.error('Failed to void report');
        }
      },
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Store Reports</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          New Report
        </Button>
      </div>
      <Row gutter={16}>
        <Col xs={24} md={10}>
          <Card title="Report Log" bodyStyle={{ padding: selectedReport ? '12px' : '0' }}>
            <Spin spinning={loading}>
              {reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                  No reports yet
                </div>
              ) : (
                <List
                  dataSource={reports}
                  renderItem={(item) => (
                    <List.Item
                      onClick={() => handleView(item)}
                      style={{
                        cursor: 'pointer',
                        background: selectedReport?.report_id === item.report_id ? '#f0f0f0' : 'transparent',
                        padding: '12px 16px',
                        borderRadius: 4,
                        marginBottom: 4,
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <span style={{ fontWeight: 500 }}>{item.title}</span>
                            <Tag color={STATUS_COLORS[item.status]}>{item.status}</Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <div style={{ fontSize: 12, color: '#888' }}>
                              {ISSUE_TYPES.find((t) => t.value === item.issue_type)?.label} • {item.location_name}
                            </div>
                            <div style={{ fontSize: 12, color: '#aaa' }}>
                              {formatDate(item.created_at)}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card
            title={selectedReport ? 'Report Details' : 'Select a report'}
            extra={
              selectedReport && selectedReport.status === 'pending' && (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(selectedReport)}>
                    Edit
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleVoid(selectedReport.report_id)}>
                    Void
                  </Button>
                </Space>
              )
            }
          >
            {selectedReport ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <div style={{ color: '#888', fontSize: 12 }}>Title</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedReport.title}</div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <div style={{ color: '#888', fontSize: 12 }}>Issue Type</div>
                    <div>
                      <Tag color="blue">
                        {ISSUE_TYPES.find((t) => t.value === selectedReport.issue_type)?.label}
                      </Tag>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <div style={{ color: '#888', fontSize: 12 }}>Branch</div>
                    <div>{selectedReport.location_name}</div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <div style={{ color: '#888', fontSize: 12 }}>Status</div>
                    <div>
                      <Tag color={STATUS_COLORS[selectedReport.status]}>{selectedReport.status}</Tag>
                      {selectedReport.status === 'pending' && (
                        <Button size="small" type="link" onClick={() => handleStatusChange(selectedReport.report_id, 'resolved')}>
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </Col>
                  <Col xs={24}>
                    <div style={{ color: '#888', fontSize: 12 }}>Description</div>
                    <div style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                      {selectedReport.description}
                    </div>
                  </Col>
                  <Col xs={24}>
                    <div style={{ color: '#888', fontSize: 12 }}>Submitted</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>{formatDate(selectedReport.created_at)}</div>
                  </Col>
                </Row>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
                Click a report on the left to view details
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editMode ? 'Edit Report' : 'New Report'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="Enter report title" />
          </Form.Item>
          <Form.Item name="issue_type" label="Issue Type" rules={[{ required: true, message: 'Please select issue type' }]}>
            <Select placeholder="Select issue type" options={ISSUE_TYPES} />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Please enter description' }]}>
            <Input.TextArea rows={4} placeholder="Explain the issue in detail..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editMode ? 'Update' : 'Submit'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Reports;
