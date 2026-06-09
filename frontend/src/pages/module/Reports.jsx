import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Table, Tabs, Statistic,
  Select, Spin, Space, message, Divider, Button, Modal, Form,
  Input, Tag, List, Badge, Tooltip, Dropdown,
} from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DatabaseOutlined, ShoppingCartOutlined, DollarOutlined,
  UserOutlined, SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, FileTextOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const { user, theme, selectedLocationId, setSelectedLocationId, setIsStorehouse } = useAuth();
  const isDark = theme === 'dark';
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
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [reportForm] = Form.useForm();
  const [editingReport, setEditingReport] = useState(null);
  const [locations, setLocations] = useState([]);

  const [branchLocations, setBranchLocations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [distributionData, setDistributionData] = useState([]);
  const [stockLevelsView, setStockLevelsView] = useState('table');

  const exportCSV = (data, title, columnDefs) => {
    if (!data || data.length === 0) {
      message.warning('No data to export');
      return;
    }
    const headers = columnDefs.map(c => c.label).join(',');
    const rows = data.map(row =>
      columnDefs.map(c => {
        const val = c.accessor(row);
        const str = val !== null && val !== undefined ? String(val) : '';
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = (data, title, subtitle, columnDefs, filename) => {
    if (!data || data.length === 0) {
      message.warning('No data to export');
      return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    let startY = 27;
    if (subtitle) {
      doc.text(subtitle, 14, startY);
      startY = 33;
    }
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, startY);
    autoTable(doc, {
      startY: startY + 5,
      head: [columnDefs.map(c => c.label)],
      body: data.map(row => columnDefs.map(c => c.accessor(row))),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [22, 119, 255], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save(`${(filename || title).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  };

  const mkParams = (extra) => {
    const p = new URLSearchParams({ usertype: user?.usertype });
    if (user?.user_id) p.set('user_id', user.user_id);
    p.set('location_id', selectedLocationId !== 'all' ? String(selectedLocationId) : '-1');
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
      const locationParam = selectedLocationId !== 'all' ? selectedLocationId : -1;

      const [statsRes, allBranchesRes, lowStockRes] = await Promise.all([
        fetch(`/api/reports/inventory/summary?${mkParams({ location_id: locationParam })}`),
        fetch(`/api/reports/inventory/summary?${mkParams({ location_id: -1 })}`),
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
        setDistributionData((allBranches.data?.rows || []).map((r) => ({
          location_name: r.location_name,
          total_quantity: Math.floor(r.total_quantity),
        })));
      }
    } catch {
      message.error('Failed to load inventory reports');
    } finally {
      setLoading((prev) => ({ ...prev, inventory: false }));
    }
  };

  const fetchDistribution = async () => {
    try {
      const params = { location_id: -1 };
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
        if (data.data?.length > 0 && !activeReport) {
          setActiveReport(data.data[0]);
        }
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
      location_id: user?.role !== 'manager' ? report.location_id : undefined,
      issue_type: report.issue_type,
      description: report.description,
    });
    setReportModalOpen(true);
  };

  const handleViewReport = (report) => {
    setViewingReport(report);
    setViewModalOpen(true);
  };

  const handleSubmitReport = async (values) => {
    try {
      const payload = {
        usertype: user?.usertype,
        user_id: user?.user_id,
        location_id: user?.role === 'manager' ? user?.location_id : values.location_id,
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
          const res = await fetch(`/api/store-reports/${reportId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              usertype: user?.usertype, 
              user_id: user?.user_id,
              status: 'voided' 
            }),
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
        setBranchLocations(data.data.filter((l) => l.is_active));
      }
    } catch {
      message.error('Failed to load locations');
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (activeTab === 'inventory') fetchProducts();
  }, [activeTab]);

  useEffect(() => {
    const locId = selectedLocationId;
    const uid = user?.user_id;
    const utype = user?.usertype;
    const apiParams = () => {
      const p = new URLSearchParams({ usertype: utype });
      if (uid) p.set('user_id', uid);
      p.set('location_id', locId !== 'all' ? String(locId) : '-1');
      return p;
    };

    if (activeTab === 'inventory') {
      setLoading((prev) => ({ ...prev, inventory: true }));
      const doFetch = async () => {
        try {
          const lp = locId !== 'all' ? locId : 'all';
          const withLoc = (loc) => { const p = apiParams(); p.set('location_id', String(loc)); return p.toString(); };
          const [statsRes, allBranchesRes, lowStockRes] = await Promise.all([
            fetch(`/api/reports/inventory/summary?${withLoc(lp)}`),
            fetch(`/api/reports/inventory/summary?${withLoc(-1)}`),
            fetch(`/api/reports/inventory/low-stock?${withLoc(lp)}`),
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
        } catch { message.error('Failed to load inventory reports'); }
        finally { setLoading((prev) => ({ ...prev, inventory: false })); }
      };
      doFetch();
      fetchDistribution();
    }
    else if (activeTab === 'sales') {
      setLoading((prev) => ({ ...prev, sales: true }));
      const doFetch = async () => {
        try {
          const [dailyRes, topRes] = await Promise.all([
            fetch(`/api/reports/sales/daily?${apiParams()}&days=${salesPeriod}`),
            fetch(`/api/reports/sales/top-products?${apiParams()}&days=${salesPeriod}&limit=10`),
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
        } catch { message.error('Failed to load sales reports'); }
        finally { setLoading((prev) => ({ ...prev, sales: false })); }
      };
      doFetch();
    }
    else if (activeTab === 'financial') {
      setLoading((prev) => ({ ...prev, financial: true }));
      const doFetch = async () => {
        try {
          const [revenueRes, pmRes] = await Promise.all([
            fetch(`/api/reports/financial/revenue?${apiParams()}&days=${financialPeriod}`),
            fetch(`/api/reports/financial/payment-methods?${apiParams()}&days=${financialPeriod}`),
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
        } catch { message.error('Failed to load financial reports'); }
        finally { setLoading((prev) => ({ ...prev, financial: false })); }
      };
      doFetch();
    }
    else if (activeTab === 'store-reports') {
      fetchStoreReports();
    }
    else if (activeTab === 'activity') {
      setLoading((prev) => ({ ...prev, activity: true }));
      const doFetch = async () => {
        try {
          const res = await fetch(`/api/reports/activity/summary?${apiParams()}&days=${activityPeriod}`);
          const data = await res.json();
          if (data.success) {
            setActivityData({
              stats: data.data.stats || {},
              by_user: data.data.by_user || [],
              by_module: data.data.by_module || [],
            });
          }
        } catch { message.error('Failed to load activity reports'); }
        finally { setLoading((prev) => ({ ...prev, activity: false })); }
      };
      doFetch();
      fetchStoreReports();
    }
    else if (activeTab === 'system') {
      setLoading((prev) => ({ ...prev, system: true }));
      const doFetch = async () => {
        try {
          const res = await fetch(`/api/reports/system/summary?${apiParams()}`);
          const data = await res.json();
          if (data.success) {
            setSystemData({
              stats: data.data.stats || {},
              backups: data.data.backups || [],
            });
          }
        } catch { message.error('Failed to load system reports'); }
        finally { setLoading((prev) => ({ ...prev, system: false })); }
      };
      doFetch();
    }
  }, [activeTab, selectedLocationId, salesPeriod, financialPeriod, activityPeriod, user?.usertype, user?.user_id]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchDistribution();
    }
  }, [selectedProduct]);

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  const inventoryColsBranch = [
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Total Items', dataIndex: 'product_count', key: 'product_count', sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0) },
    { title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity', render: (v) => Math.floor(v).toLocaleString(), sorter: (a, b) => (a.total_quantity || 0) - (b.total_quantity || 0) },
  ];

  const inventoryColsLowStock = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', render: (_, r) => {
      const p = [r.color, r.pattern].filter(Boolean);
      return r.product_name + (p.length ? ` (${p.join(', ')})` : '');
    }, sorter: (a, b) => (a.product_name || '').localeCompare(b.product_name || '') },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', sorter: (a, b) => (a.sku || '').localeCompare(b.sku || '') },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Stock', dataIndex: 'quantity', key: 'quantity', render: (v) => qtyLabel(v), sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0) },
    { title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level', sorter: (a, b) => (a.reorder_level || 0) - (b.reorder_level || 0) },
  ];

  const lowStockColumns = isManager
    ? inventoryColsLowStock.filter(c => c.dataIndex !== 'location_name')
    : inventoryColsLowStock;

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
                    scroll={{ x: 'max-content' }}
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
          <Card title={isManager ? `Low Stock Items in ${user?.location_name || 'your branch'}` : "Low Stock Items"}>
            <Table
              dataSource={inventorySummary.low_stock}
              columns={inventoryColsLowStock}
              rowKey={(r) => `${r.product_name || ''}-${r.location_name || ''}`}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: 'max-content' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <Space>
              {user && (user.usertype === 1 || user.usertype === 3) && (
                <Dropdown
                  menu={{
                    items: [
                      { key: 'all', label: 'All Locations' },
                      ...branchLocations.map(loc => ({ key: String(loc.location_id), label: loc.name })),
                    ],
                    onClick: ({ key }) => {
                      if (key === 'all') {
                        setSelectedLocationId('all');
                        setIsStorehouse(false);
                      } else {
                        setSelectedLocationId(Number(key));
                        const loc = branchLocations.find(l => l.location_id === Number(key));
                        setIsStorehouse(loc ? loc.is_storehouse : false);
                      }
                    },
                  }}
                >
                  <Button type={selectedLocationId !== 'all' ? 'primary' : 'default'}>
                    {selectedLocationId !== 'all'
                      ? (branchLocations.find(l => l.location_id === Number(selectedLocationId))?.name || 'Branch')
                      : 'All Locations'}
                  </Button>
                </Dropdown>
              )}
              <span>Period:</span>
              <Select value={salesPeriod} onChange={(v) => setSalesPeriod(v)} style={{ width: 120 }}>
                <Select.Option value={7}>7 days</Select.Option>
                <Select.Option value={30}>30 days</Select.Option>
                <Select.Option value={90}>90 days</Select.Option>
              </Select>
            </Space>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'csv',
                    label: 'CSV',
                    onClick: () => exportCSV(salesData.topProducts, `Top_Products_${salesPeriod}d`, [
                      { label: 'Product', accessor: (r) => r.product_name },
                      { label: 'Qty Sold', accessor: (r) => r.total_quantity },
                      { label: 'Total Revenue', accessor: (r) => r.total_revenue },
                    ]),
                  },
                  {
                    key: 'pdf',
                    label: 'PDF',
                    onClick: () => exportPDF(salesData.topProducts, `Top Products - ${salesPeriod} days`, null, [
                      { label: 'Product', accessor: (r) => r.product_name },
                      { label: 'Qty Sold', accessor: (r) => r.total_quantity },
                      { label: 'Total Revenue', accessor: (r) => r.total_revenue },
                    ], `Top_Products_${salesPeriod}d`),
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Export</Button>
            </Dropdown>
          </div>
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
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    });
  }

  if (isOwner || isManager) {
    tabs.push({
      key: 'financial',
      label: <span><DollarOutlined /> Financial</span>,
      children: (
        <Spin spinning={loading.financial}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <Space>
              {user && (user.usertype === 1 || user.usertype === 3) && (
                <Dropdown
                  menu={{
                    items: [
                      { key: 'all', label: 'All Locations' },
                      ...branchLocations.map(loc => ({ key: String(loc.location_id), label: loc.name })),
                    ],
                    onClick: ({ key }) => {
                      if (key === 'all') {
                        setSelectedLocationId('all');
                        setIsStorehouse(false);
                      } else {
                        setSelectedLocationId(Number(key));
                        const loc = branchLocations.find(l => l.location_id === Number(key));
                        setIsStorehouse(loc ? loc.is_storehouse : false);
                      }
                    },
                  }}
                >
                  <Button type={selectedLocationId !== 'all' ? 'primary' : 'default'}>
                    {selectedLocationId !== 'all'
                      ? (branchLocations.find(l => l.location_id === Number(selectedLocationId))?.name || 'Branch')
                      : 'All Locations'}
                  </Button>
                </Dropdown>
              )}
              <span>Period:</span>
              <Select value={financialPeriod} onChange={(v) => setFinancialPeriod(v)} style={{ width: 120 }}>
                <Select.Option value={30}>30 days</Select.Option>
                <Select.Option value={90}>90 days</Select.Option>
                <Select.Option value={365}>365 days</Select.Option>
              </Select>
            </Space>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'csv',
                    label: 'CSV',
                    onClick: () => exportCSV(financialData.revenue, `Revenue_by_Date_${financialPeriod}d`, [
                      { label: 'Date', accessor: (r) => r.date },
                      { label: 'Orders', accessor: (r) => r.order_count },
                      { label: 'Revenue', accessor: (r) => r.revenue },
                    ]),
                  },
                  {
                    key: 'pdf',
                    label: 'PDF',
                    onClick: () => {
                      const branchName = selectedLocationId !== 'all'
                        ? (branchLocations.find(l => l.location_id === Number(selectedLocationId))?.name || 'Branch')
                        : 'All Locations';
                      exportPDF(
                        financialData.revenue,
                        branchName,
                        `Revenue - ${financialPeriod} days`,
                        [
                          { label: 'Date', accessor: (r) => r.date },
                          { label: 'Orders', accessor: (r) => r.order_count },
                          { label: 'Revenue', accessor: (r) => r.revenue },
                        ],
                        `Revenue_${branchName.replace(/\s+/g, '_')}_${financialPeriod}d`
                      );
                    },
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Export</Button>
            </Dropdown>
          </div>
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
                  scroll={{ x: 'max-content' }}
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
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      ),
    });
  }

  if (isManager) {
    tabs.push({
      key: 'store-reports',
      label: <span><FileTextOutlined /> Store Reports</span>,
      children: (
        <Spin spinning={loadingStoreReports}>
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateReport}>New Report</Button>
          </div>
          <Row gutter={16} style={{ height: 'calc(100vh - 280px)' }}>
            <Col xs={24} md={10}>
              <div style={{ height: '100%', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                {storeReports.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>No reports yet</div>
                ) : (
                  storeReports.map((report) => {
                    const colors = { pending: 'orange', resolved: 'green', voided: 'red' };
                    const labels = { store: 'Store Issue', software: 'Software Issue' };
                    return (
                      <div
                        key={report.report_id}
                        onClick={() => setActiveReport(report)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          background: activeReport?.report_id === report.report_id ? (isDark ? '#1d1d1d' : '#e6f4ff') : 'transparent',
                          borderLeft: activeReport?.report_id === report.report_id ? '3px solid #1677ff' : '3px solid transparent',
                        }}
                      >
                        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{report.title}</div>
                        <Space size={4}>
                          <Tag color={colors[report.status]}>{report.status}</Tag>
                          <Tag>{labels[report.issue_type] || report.issue_type}</Tag>
                        </Space>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                          {report.username} · {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Col>
            <Col xs={24} md={14}>
              <div style={{ height: '100%', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 24 }}>
                {!activeReport ? (
                  <div style={{ textAlign: 'center', paddingTop: 80, color: '#8c8c8c' }}>
                    Select a report to view details
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{activeReport.title}</div>
                    <Row gutter={[16, 12]}>
                      <Col xs={24} sm={12}>
                        <div style={{ color: '#888', fontSize: 12 }}>Branch</div>
                        <div>{activeReport.location_name}</div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ color: '#888', fontSize: 12 }}>Issue Type</div>
                        <div>
                          <Tag color="blue">{ISSUE_TYPES.find((t) => t.value === activeReport.issue_type)?.label}</Tag>
                        </div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ color: '#888', fontSize: 12 }}>Status</div>
                        <div>
                          <Tag color={activeReport.status === 'resolved' ? 'green' : activeReport.status === 'voided' ? 'red' : 'orange'}>
                            {activeReport.status}
                          </Tag>
                        </div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ color: '#888', fontSize: 12 }}>Submitted By</div>
                        <div>{activeReport.username}</div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div style={{ color: '#888', fontSize: 12 }}>Date Submitted</div>
                        <div>{activeReport.created_at ? new Date(activeReport.created_at).toLocaleString() : ''}</div>
                      </Col>
                      {activeReport.status === 'resolved' && activeReport.resolved_by_username && (
                        <>
                          <Col xs={24} sm={12}>
                            <div style={{ color: '#888', fontSize: 12 }}>Resolved By</div>
                            <div>{activeReport.resolved_by_username}</div>
                          </Col>
                          <Col xs={24} sm={12}>
                            <div style={{ color: '#888', fontSize: 12 }}>Resolved At</div>
                            <div>{activeReport.resolved_at ? new Date(activeReport.resolved_at).toLocaleString() : ''}</div>
                          </Col>
                        </>
                      )}
                      <Col xs={24}>
                        <div style={{ color: '#888', fontSize: 12 }}>Description</div>
                        <div style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4, marginTop: 4 }}>
                          {activeReport.description}
                        </div>
                      </Col>
                    </Row>
                    <Divider />
                    <Space>
                      {activeReport.status === 'pending' && user?.user_id === activeReport.user_id && (
                        <>
                          <Button icon={<EditOutlined />} onClick={() => { setEditingReport(activeReport); reportForm.setFieldsValue({ title: activeReport.title, issue_type: activeReport.issue_type, description: activeReport.description }); setReportModalOpen(true); }}>Edit</Button>
                          <Button danger icon={<DeleteOutlined />} onClick={() => handleVoidReport(activeReport.report_id)}>Void</Button>
                        </>
                      )}
                      {activeReport.status === 'pending' && (
                        <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleUpdateStatus(activeReport.report_id, 'resolved')}>Mark Resolved</Button>
                      )}
                    </Space>
                  </div>
                )}
              </div>
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
                  scroll={{ x: 'max-content' }}
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
                  scroll={{ x: 'max-content' }}
                />
              </Card>
            </Col>
          </Row>
          <Divider />
          <Card title="Store Reports" extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateReport}>New Report</Button>}>
            <Spin spinning={loadingStoreReports}>
              <Table
                dataSource={storeReports}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: 'User', dataIndex: 'username', key: 'username' },
                  { title: 'Branch', dataIndex: 'location_name', key: 'location_name' },
                  { title: 'Issue Type', dataIndex: 'issue_type', key: 'issue_type', render: (v) => {
                    const labels = { store: 'Store Issue', software: 'Software Issue' };
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
                  { title: 'Actions', key: 'actions', render: (_, record) => {
                    const isCreator = user?.user_id === record.user_id;
                    return (
                      <Space>
                        <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewReport(record)} />
                        {record.status === 'pending' && isCreator && (
                          <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditReport(record)} />
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleVoidReport(record.report_id)} />
                          </>
                        )}
                      </Space>
                    );
                  }},
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
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Spin>
      ),
    });
  }

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  return (
    <div>
      <Card styles={{ body: { padding: '16px 24px' } }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
      </Card>
      {isOwnerOrAdmin && (
        <>
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
              {user?.role !== 'manager' && (
                <Form.Item name="location_id" label="Branch" rules={[{ required: true, message: 'Please select branch' }]}>
                  <Select placeholder="Select branch" options={locations} />
                </Form.Item>
              )}
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
          <Modal
            title="View Report"
            open={viewModalOpen}
            onCancel={() => setViewModalOpen(false)}
            footer={<Button onClick={() => setViewModalOpen(false)}>Close</Button>}
          >
          {viewingReport && (
            <div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Title</div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{viewingReport.title}</div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Branch</div>
                  <div>{viewingReport.location_name}</div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Issue Type</div>
                  <div>
                    <Tag color="blue">
                      {ISSUE_TYPES.find((t) => t.value === viewingReport.issue_type)?.label}
                    </Tag>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Status</div>
                  <div>
                    <Tag color={viewingReport.status === 'resolved' ? 'green' : viewingReport.status === 'voided' ? 'red' : 'orange'}>
                      {viewingReport.status}
                    </Tag>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Submitted By</div>
                  <div>{viewingReport.username}</div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ color: '#888', fontSize: 12 }}>Date Submitted</div>
                  <div>{viewingReport.created_at ? new Date(viewingReport.created_at).toLocaleString() : ''}</div>
                </Col>
                {viewingReport.status === 'resolved' && viewingReport.resolved_by_username && (
                  <>
                    <Col xs={24} sm={12}>
                      <div style={{ color: '#888', fontSize: 12 }}>Resolved By</div>
                      <div>{viewingReport.resolved_by_username}</div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ color: '#888', fontSize: 12 }}>Resolved At</div>
                      <div>{viewingReport.resolved_at ? new Date(viewingReport.resolved_at).toLocaleString() : ''}</div>
                    </Col>
                  </>
                )}
                <Col xs={24}>
                  <div style={{ color: '#888', fontSize: 12 }}>Description</div>
                  <div style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 4 }}>
                    {viewingReport.description}
                  </div>
                </Col>
              </Row>
            </div>
          )}
        </Modal>
        </>
      )}
    </div>
  );
};

const ISSUE_TYPES = [
  { value: 'store', label: 'Store Issue' },

  { value: 'software', label: 'Software Issue' },
];

const STATUS_COLORS = {
  pending: 'orange',
  resolved: 'green',
  voided: 'red',
};

// kept for potential future use — standalone store reports view for managers
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
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
