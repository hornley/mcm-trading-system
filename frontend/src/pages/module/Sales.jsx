import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Input, Select, Button, Modal,
  DatePicker, Popconfirm, Space, message,
  Statistic, Dropdown,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import dayjs from 'dayjs';
import POSModal from '../../components/POSModal.jsx';
import receiptConfig from '../../config/receipt.json';
import { generateReceiptPDF } from '../../utils/generateReceiptPDF.js';

const { Text } = Typography;
const { RangePicker } = DatePicker;

import { FABRIC_CATEGORY, qtyLabel, fmtQty } from '../../utils/format.js';

const Sales = () => {
  const { user, selectedLocationId, setSelectedLocationId, setIsStorehouse } = useAuth();
  const branchName = user?.location_name || 'Main Store';
  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const defaultTotalBranch = isOwner || user?.role === 'admin' ? 'All' : branchName;

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [dashboardStats, setDashboardStats] = useState({ sales_today: 0, month_sales: 0, transactions_today: 0 });
  const [allSalesFull, setAllSalesFull] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [locations, setLocations] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);

  const receiptRef = useRef(null);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [totalSalesModalVisible, setTotalSalesModalVisible] = useState(false);
  const [totalSalesDateRange, setTotalSalesDateRange] = useState(null);
  const [totalSalesBranch, setTotalSalesBranch] = useState(defaultTotalBranch);
  const [totalSalesLoading, setTotalSalesLoading] = useState(false);

  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [orderDetailsMap, setOrderDetailsMap] = useState({});

  const usertype = user?.usertype;
  const userId = user?.user_id;
  const locationId = isManager ? user?.location_id : undefined;

  const apiParams = `usertype=${usertype}&user_id=${userId}` + (selectedLocationId && selectedLocationId !== 'all' ? `&location_id=${selectedLocationId}` : '');

  const fetchSales = async (page) => {
    setLoading(true);
    try {
      const p = page || currentPage;
      let url = `/api/orders?${apiParams}&page=${p}&limit=${pageSize}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (dateRange && dateRange[0]) url += `&date_from=${dateRange[0].toISOString()}`;
      if (dateRange && dateRange[1]) url += `&date_to=${dateRange[1].toISOString()}`;
      if (searchText) url += `&q=${searchText}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setSales(json.data.orders || []);
        setTotalCount(json.data.total_count || 0);
        setCurrentPage(json.data.page || p);
      }
    } catch (e) {
      message.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch(`/api/products?${apiParams}`);
      const json = await res.json();
      if (json.success) setProducts(json.data || []);
    } catch (e) { /* ignore */ }
    finally { setProductsLoading(false); }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`/api/locations?usertype=${usertype}`);
      const json = await res.json();
      if (json.success) {
        const active = (json.data || []).filter((l) => l.is_active);
        setLocations(active);
        setBranchLocations(active);
      }
    } catch (e) { /* ignore */ }
  };

  const [orderDetailsLoading, setOrderDetailsLoading] = useState({});

  const fetchOrderDetail = async (orderId) => {
    if (orderDetailsMap[orderId] || orderDetailsLoading[orderId]) return;
    setOrderDetailsLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch(`/api/orders/${orderId}?${apiParams}`);
      const json = await res.json();
      if (json.success) {
        setOrderDetailsMap((prev) => ({ ...prev, [orderId]: json.data }));
        return json.data;
      }
    } catch (e) { /* ignore */ }
    finally {
      setOrderDetailsLoading((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`/api/dashboard/summary?${apiParams}`);
      const json = await res.json();
      if (json.success) setDashboardStats(json.data.stats || {});
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { fetchSales(1); fetchDashboardStats(); }, [searchText, dateRange, statusFilter, selectedLocationId]);
  useEffect(() => { fetchProducts(); fetchLocations(); }, []);

  const fetchTotalSalesData = useCallback(async (branch, dateFrom, dateTo) => {
    setTotalSalesLoading(true);
    try {
      const loc = branch && branch !== 'All' ? locations.find((l) => l.name === branch)?.location_id : undefined;
      const params = new URLSearchParams({ usertype, user_id: userId, include_items: 'true', limit: '999' });
      if (loc) params.set('location_id', loc);
      if (dateFrom) params.set('date_from', dateFrom.toISOString());
      if (dateTo) params.set('date_to', dateTo.toISOString());
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (json.success) setAllSalesFull(json.data.orders || []);
    } catch { /* ignore */ }
    finally { setTotalSalesLoading(false); }
  }, [usertype, userId, locations]);

  useEffect(() => {
    if (totalSalesModalVisible) {
      const [from, to] = totalSalesDateRange || [];
      fetchTotalSalesData(totalSalesBranch, from, to);
    }
  }, [totalSalesModalVisible, totalSalesBranch, totalSalesDateRange]);

  const handleAdd = () => {
    setSaleModalVisible(true);
  };

  const handleConfirmOrder = async (payload) => {
    setSubmitting(true);
    try {
      const finalPayload = {
        ...payload,
        user_id: userId,
        location_id: isManager ? locationId : undefined,
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });
      const json = await res.json();
      if (json.success) {
        message.success(`Order #${json.data.order_id} created`);
        if (json.data.auto_restocks?.length > 0) {
          const names = json.data.auto_restocks.map((r) => r.product_name).join(', ');
          message.info(`Auto-restock triggered: ${names}`);
        }
        setLastOrder(json.data);
        setSaleModalVisible(false);
        setReceiptModalVisible(true);
        fetchSales();
        fetchProducts();
      } else {
        message.error(json.message || 'Failed to create order');
      }
    } catch (e) {
      message.error('Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (record) => {
    try {
      const res = await fetch(`/api/orders/${record.order_id}/void`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype, user_id: userId }),
      });
      const json = await res.json();
      if (json.success) {
        message.success(`Order #${record.order_id} voided`);
        fetchSales();
      } else {
        message.error(json.message || 'Failed to void order');
      }
    } catch (e) {
      message.error('Failed to void order');
    }
  };

  const handleViewReceipt = async (record) => {
    const cached = orderDetailsMap[record.order_id];
    if (cached) {
      setLastOrder(cached);
    } else {
      const detail = await fetchOrderDetail(record.order_id);
      setLastOrder(detail || record);
    }
    setReceiptModalVisible(true);
  };

  const handleDownloadPDF = () => {
    if (lastOrder && receiptRef.current) generateReceiptPDF(receiptRef.current, lastOrder.order_id);
  };

  const isVoided = (record) => record.status === 'voided';

  const columns = [
    {
      title: 'Transaction ID', dataIndex: 'order_id', key: 'order_id',
      render: (v) => `#${v}`,
      sorter: (a, b) => a.order_id - b.order_id,
    },
    {
      title: 'Branch', dataIndex: 'location_name', key: 'location_name',
      sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || ''),
    },
    {
      title: 'Date', dataIndex: 'order_date', key: 'order_date',
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
      sorter: (a, b) => (a.order_date || '').localeCompare(b.order_date || ''),
    },
    {
      title: 'Items', key: 'items',
      render: (_, record) => {
        const names = record.product_names || [];
        if (names.length === 0) return '-';
        const isExpanded = expandedRowKeys.includes(record.order_id);
        const expandIcon = names.length > 1 ? (isExpanded ? '▼' : '▶') : '  ';
        return (
          <span
            onClick={() => {
              if (names.length <= 1) return;
              setExpandedRowKeys((prev) =>
                prev.includes(record.order_id)
                  ? prev.filter((id) => id !== record.order_id)
                  : [...prev, record.order_id]
              );
            }}
            style={{ cursor: names.length > 1 ? 'pointer' : 'default' }}
          >
            <span style={{ fontSize: 10, marginRight: 4 }}>{expandIcon}</span>
            {names[0]}{names.length > 1 ? ` +${names.length - 1} more` : ''}
          </span>
        );
      },
      sorter: (a, b) => (a.item_count || 0) - (b.item_count || 0),
    },
    {
      title: 'Total Amount', dataIndex: 'total_amount', key: 'total_amount',
      render: (v) => `₱${v?.toLocaleString() || 0}`,
      sorter: (a, b) => a.total_amount - b.total_amount,
    },
    {
      title: 'Payment', key: 'payment',
      render: (_, record) => {
        return record.payment_method ? `${record.payment_method} — ₱${(record.payment_price || 0).toLocaleString()}` : '-';
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => (
        <Tag color={status === 'completed' ? 'green' : 'red'}>{status === 'completed' ? 'Completed' : 'Voided'}</Tag>
      ),
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleViewReceipt(record)}>View Receipt</Button>
          <Popconfirm
            title="Void this transaction? This will restore inventory."
            onConfirm={() => handleVoid(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger disabled={isVoided(record)}>Void</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record) => {
    const detail = orderDetailsMap[record.order_id];
    const items = detail?.items || [];
    const pmt = detail?.payments?.[0];

    if (!detail && !orderDetailsLoading[record.order_id]) {
      fetchOrderDetail(record.order_id);
    }

    if (!detail) {
      return <Text type="secondary">Loading items...</Text>;
    }

    return (
      <div style={{ padding: '8px 0' }}>
        <Table
          dataSource={items}
          columns={[
            { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
            { title: 'Qty', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.category === FABRIC_CATEGORY) },
            { title: 'Unit Price', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
            { title: 'Line Total', dataIndex: 'line_total', key: 'line_total', render: (v) => `₱${v?.toLocaleString() || 0}` },
          ]}
          rowKey="order_item_id"
          pagination={false}
          size="small"
        />
        {pmt && (
          <Text style={{ marginTop: 8, display: 'block' }}>
            Payment: {pmt.payment_method} — ₱{pmt.price?.toLocaleString() || 0}
          </Text>
        )}
      </div>
    );
  };

  const totalSalesFiltered = useMemo(() => {
    const data = allSalesFull.filter((s) => {
      if (s.status !== 'completed') return false;
      if (totalSalesBranch && totalSalesBranch !== 'All' && s.location_name !== totalSalesBranch) return false;
      if (totalSalesDateRange?.[0]) {
        const d = dayjs(s.order_date);
        if (d.isBefore(totalSalesDateRange[0].startOf('day'))) return false;
      }
      if (totalSalesDateRange?.[1]) {
        const d = dayjs(s.order_date);
        if (d.isAfter(totalSalesDateRange[1].endOf('day'))) return false;
      }
      return true;
    });
    const grouped = {};
    data.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.product_name;
        if (!grouped[key]) grouped[key] = { product_name: item.product_name, total_qty: 0, total_amount: 0, is_fabric: item.category === FABRIC_CATEGORY };
        grouped[key].total_qty += Math.floor(item.quantity);
        grouped[key].total_amount += item.line_total;
      });
    });
    return Object.values(grouped);
  }, [allSalesFull, totalSalesBranch, totalSalesDateRange]);

  const totalSalesSummary = () => {
    const total = totalSalesFiltered.reduce((sum, r) => sum + r.total_amount, 0);
    return (
      <Table.Summary.Row>
        <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} />
        <Table.Summary.Cell index={2}><Text strong>₱{total.toLocaleString()}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    );
  };

  const totalSalesColumns = [
    {
      title: 'Product Name', dataIndex: 'product_name', key: 'product_name',
      sorter: (a, b) => a.product_name.localeCompare(b.product_name),
    },
    {
      title: 'Total Quantity Sold', dataIndex: 'total_qty', key: 'total_qty',
      render: (qty, record) => fmtQty(Math.floor(qty), record.is_fabric),
      sorter: (a, b) => a.total_qty - b.total_qty,
    },
    {
      title: 'Total Amount', dataIndex: 'total_amount', key: 'total_amount',
      render: (v) => `₱${v.toLocaleString()}`,
      sorter: (a, b) => a.total_amount - b.total_amount,
    },
  ];

  const renderReceiptContent = useCallback((order) => {
    const pmt = (order.payments || [])[0];
    const total = order.total_amount || 0;
    const payment = pmt?.price || 0;
    const change = Math.max(0, payment - total);
    const vatableSales = total / 1.12;
    const vatAmount = total - vatableSales;
    const cfg = receiptConfig;
    return (
      <div style={{ fontSize: 13, fontFamily: "'Courier New', monospace" }}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{cfg.companyName}</div>
          {cfg.companyAddress && <div style={{ fontSize: 11 }}>{cfg.companyAddress}</div>}
          <div style={{ fontSize: 10, marginTop: 4 }}>VAT REG TIN: {cfg.vatRegTin}</div>
          <div style={{ fontSize: 10 }}>MIN NO: {cfg.minNo}</div>
          <div style={{ fontSize: 10 }}>SALES INVOICE NO: {cfg.salesInvoiceNo}</div>
        </div>

        <div style={{ borderTop: '1px dashed #333', borderBottom: '1px dashed #333', padding: '4px 0', marginBottom: 8 }}>
          <div style={{ display: 'flex', fontWeight: 600, fontSize: 11, padding: '2px 0', borderBottom: '1px solid #333' }}>
            <span style={{ width: '45px', textAlign: 'center' }}>QTY</span>
            <span style={{ flex: 1, paddingLeft: 4 }}>ITEM</span>
            <span style={{ width: '5.5em', textAlign: 'right' }}>AMOUNT</span>
          </div>
          {(order.items || []).map((item) => (
            <div key={item.order_item_id} style={{ display: 'flex', fontSize: 11, padding: '2px 0' }}>
              <span style={{ width: '45px', textAlign: 'center', fontFamily: "'Courier New', monospace" }}>
                {fmtQty(item.quantity, item.category === FABRIC_CATEGORY, item.category === FABRIC_CATEGORY ? 'yds' : 'pcs')}
              </span>
              <span style={{ flex: 1, paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Courier New', monospace" }}>
                {item.product_name}
              </span>
              <span style={{ width: '5.5em', textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
                ₱{(item.line_total || (item.quantity * item.price)).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
            <span>TOTAL:</span>
            <span>₱{total.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
            <span>Payment ({pmt?.payment_method || 'N/A'}):</span>
            <span>₱{payment.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>Change:</span>
            <span>₱{change.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #333', padding: '4px 0', marginBottom: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Vatable Sales:</span>
            <span>₱{vatableSales.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>VAT (12%):</span>
            <span>₱{vatAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>VAT Exempt Sale:</span>
            <span>₱0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Zero Rated Sale:</span>
            <span>₱0.00</span>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #333', padding: '4px 0', marginBottom: 8, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date:</span>
            <span>{dayjs(order.order_date).format('YYYY-MM-DD')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Time:</span>
            <span>{dayjs(order.order_date).format('hh:mm A')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Transaction:</span>
            <span>#{order.order_id}</span>
          </div>
        </div>

        <div style={{ fontSize: 11, marginBottom: 8 }}>
          <div>TIN: {cfg.tin}</div>
          <div>ACCRED NO: {cfg.accredNo}</div>
          <div>DATE ISSUED: {cfg.dateIssued}</div>
          <div>POS PERMIT: {cfg.posPermit}</div>
        </div>

        <div style={{ borderTop: '1px dashed #333', textAlign: 'center', padding: '6px 0', fontSize: 11, marginTop: 4 }}>
          Thank you for your purchase!
        </div>

        {(order.auto_restocks || []).length > 0 && (
          <div style={{ fontSize: 10, color: '#52c41a', marginTop: 4, borderTop: '1px dashed #999', padding: '4px 0' }}>
            <div style={{ fontWeight: 600 }}>Auto-Restock:</div>
            {order.auto_restocks.map((r, i) => (
              <div key={i}>{r.product_name}: +{qtyLabel(r.quantity)} from {r.from_location}</div>
            ))}
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Sales Today" value={`₱${(dashboardStats.sales_today || 0).toLocaleString()}`} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Sales This Month" value={`₱${(dashboardStats.month_sales || 0).toLocaleString()}`} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Transactions Today" value={dashboardStats.transactions_today || 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={24} sm={12} md={16}>
          <Space wrap>
            <Input
              placeholder="Search by transaction ID"
              prefix={<SearchOutlined />}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
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
            <RangePicker onChange={(dates) => setDateRange(dates)} />
            <Select
              placeholder="Filter by status"
              style={{ width: 150 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="voided">Voided</Select.Option>
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={12} md={8} style={{ textAlign: 'right' }}>
          <Space>
            {(isManager || isOwner) && <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={productsLoading} loading={productsLoading}>Add Sale</Button>}
            <Button onClick={() => {
              const defaultBranch = isOwner || user?.role === 'admin' ? 'All' : branchName;
              setTotalSalesBranch(defaultBranch);
              setTotalSalesDateRange(null);
              setTotalSalesModalVisible(true);
            }}>View Total Sales</Button>
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={sales}
        columns={columns}
        rowKey="order_id"
        loading={loading}
        expandable={{ expandedRowRender, expandedRowKeys, onExpand: (expanded, record) => {
          setExpandedRowKeys((prev) =>
            expanded
              ? [...prev, record.order_id]
              : prev.filter((id) => id !== record.order_id)
          );
        }, showExpandColumn: false }}
        rowClassName={(record) => isVoided(record) ? 'voided-row' : ''}
        pagination={{ current: currentPage, pageSize, total: totalCount, showSizeChanger: false, onChange: (p) => fetchSales(p) }}
      />

      <POSModal
        open={saleModalVisible}
        onClose={() => setSaleModalVisible(false)}
        onConfirm={handleConfirmOrder}
        products={products}
        usertype={usertype}
        branchName={branchName}
        confirmLoading={submitting}
      />

      <Modal
        title="Receipt"
        open={receiptModalVisible}
        onCancel={() => setReceiptModalVisible(false)}
        width={520}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}>
            Download Receipt
          </Button>,
          <Button key="close" onClick={() => setReceiptModalVisible(false)}>Close</Button>,
        ]}
        styles={{ body: { padding: 24 } }}
      >
        <div ref={receiptRef} style={{ padding: '20px' }}>
          {lastOrder && renderReceiptContent(lastOrder)}
        </div>
      </Modal>

      <Modal
        title="Total Sales"
        open={totalSalesModalVisible}
        onCancel={() => setTotalSalesModalVisible(false)}
        width={700}
        footer={[<Button key="close" onClick={() => setTotalSalesModalVisible(false)}>Close</Button>]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {isOwner && (
            <Select
              value={totalSalesBranch}
              onChange={setTotalSalesBranch}
              style={{ width: 200 }}
            >
              <Select.Option value="All">All Branches</Select.Option>
              {locations.map((l) => (
                <Select.Option key={l.location_id} value={l.name}>{l.name}</Select.Option>
              ))}
            </Select>
          )}
          <Text type="secondary" style={{ display: 'block' }}>Branch: {totalSalesBranch}</Text>
          <RangePicker
            style={{ marginBottom: 16 }}
            onChange={(dates) => setTotalSalesDateRange(dates)}
          />
          <Table
            dataSource={totalSalesFiltered}
            columns={totalSalesColumns}
            rowKey="product_name"
            pagination={false}
            size="small"
            loading={totalSalesLoading}
            summary={totalSalesSummary}
            locale={{ emptyText: totalSalesLoading ? 'Loading...' : 'No sales data' }}
          />
        </Space>
      </Modal>


    </div>
  );
};

export default Sales;
