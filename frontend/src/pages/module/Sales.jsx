import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Input, Select, Button, Modal,
  Form, InputNumber, DatePicker, Descriptions, Popconfirm, Space, message,
  Statistic, Divider,
} from 'antd';
import {
  SearchOutlined, ShoppingCartOutlined, DollarOutlined, TransactionOutlined,
  PlusOutlined, DeleteOutlined, PrinterOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const PAYMENT_METHODS = ['Cash', 'Card', 'GCash', 'Bank Transfer'];
import { FABRIC_CATEGORY, qtyLabel, fmtQty } from '../../utils/format.js';

const STEP_QTY = 0.25;
const MIN_QTY = 0.5;

const Sales = () => {
  const { user, selectedLocationId } = useAuth();
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
  const [branchFilter, setBranchFilter] = useState(null);
  const [locations, setLocations] = useState([]);

  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [totalSalesModalVisible, setTotalSalesModalVisible] = useState(false);
  const [totalSalesDateRange, setTotalSalesDateRange] = useState(null);
  const [totalSalesBranch, setTotalSalesBranch] = useState(defaultTotalBranch);
  const [totalSalesLoading, setTotalSalesLoading] = useState(false);

  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [cartQuantity, setCartQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState(null);
  const [orderDate, setOrderDate] = useState(dayjs());
  const [remarks, setRemarks] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [orderDetailsMap, setOrderDetailsMap] = useState({});
  const [form] = Form.useForm();

  const usertype = user?.usertype;
  const userId = user?.user_id;

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
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/locations?usertype=${usertype}`);
      const json = await res.json();
      if (json.success) setLocations(json.data || []);
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

  const grandTotal = useMemo(() =>
    cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart],
  );

  const change = useMemo(() =>
    Math.max(0, (paymentAmount || 0) - grandTotal),
    [paymentAmount, grandTotal],
  );

  const canAddToCart = selectedProductId && cartQuantity > 0;
  const canConfirm = cart.length > 0 && (paymentAmount || 0) >= grandTotal && !submitting;

  const handleAddToCart = () => {
    const product = products.find((p) => p.product_id === selectedProductId);
    if (!product) return;
    if (cart.some((c) => c.product_id === product.product_id)) {
      message.warning('Product already in cart');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        product_id: product.product_id,
        product_name: product.name,
        quantity: cartQuantity,
        price: product.price,
        is_fabric: product.category === FABRIC_CATEGORY,
      },
    ]);
    setSelectedProductId(null);
    setCartQuantity(1);
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  };

  const handleAdd = () => {
    setSelectedRecord(null);
    setCart([]);
    setSelectedProductId(null);
    setCartQuantity(1);
    setPaymentMethod('Cash');
    setPaymentAmount(null);
    setOrderDate(dayjs());
    setRemarks('');
    form.resetFields();
    form.setFieldsValue({ orderDate: dayjs() });
    setSaleModalVisible(true);
  };

  const handleConfirmOrder = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const payload = {
        usertype,
        user_id: userId,
        location_id: isManager ? locationId : undefined,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
        order_date: orderDate.toISOString(),
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        form.resetFields();
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
      render: (qty) => Math.floor(qty).toLocaleString(),
      sorter: (a, b) => a.total_qty - b.total_qty,
    },
    {
      title: 'Total Amount', dataIndex: 'total_amount', key: 'total_amount',
      render: (v) => `₱${v.toLocaleString()}`,
      sorter: (a, b) => a.total_amount - b.total_amount,
    },
  ];

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
            {isManager && <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={productsLoading} loading={productsLoading}>Add Sale</Button>}
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

      <Modal
        title="Add Sale"
        open={saleModalVisible}
        onCancel={() => { setSaleModalVisible(false); form.resetFields(); }}
        width={900}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto', overflowX: 'hidden' } }}
        footer={[
          <Button key="cancel" onClick={() => { setSaleModalVisible(false); form.resetFields(); }}>Cancel</Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmOrder} disabled={!canConfirm} loading={submitting}>
            Confirm Order
          </Button>,
        ]}
      >
        <Row gutter={24}>
          <Col xs={24} md={14}>
            <Form form={form} layout="vertical">
              <Text strong>Add Products</Text>
              <Row gutter={8} style={{ marginTop: 8 }}>
                <Col flex="auto">
                  <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Search product"
                    optionFilterProp="label"
                    value={selectedProductId}
                    onChange={(id) => {
                      setSelectedProductId(id);
                      const p = products.find(p => p.product_id === id);
                      if (p?.category !== FABRIC_CATEGORY) setCartQuantity(1);
                    }}
                  >
                    {products
                      .filter((p) => p.is_active !== false)
                      .slice()
                      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                      .map((p) => (
                      <Select.Option key={p.product_id} value={p.product_id} disabled={!p.quantity} label={p.name}>
                        <span style={{ opacity: p.quantity ? 1 : 0.45 }}>
                          {p.name} — ₱{p.price} (stock: {fmtQty(p.quantity, p.category === FABRIC_CATEGORY)})
                        </span>
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  {(() => {
                    const sp = products.find(p => p.product_id === selectedProductId);
                    const isFab = sp?.category === FABRIC_CATEGORY;
                    const maxQty = sp?.quantity ?? 1;
                    if (isFab) {
                      return (
                        <div>
                          <Space.Compact>
                            <Button onClick={() => setCartQuantity(Math.max(MIN_QTY, cartQuantity - STEP_QTY))}>−</Button>
                            <InputNumber
                              min={MIN_QTY}
                              max={maxQty}
                              step={STEP_QTY}
                              value={cartQuantity}
                              onChange={(v) => setCartQuantity(v ?? MIN_QTY)}
                              style={{ width: 70, textAlign: 'center' }}
                            />
                            <Button onClick={() => setCartQuantity(Math.min(maxQty, cartQuantity + STEP_QTY))}>+</Button>
                          </Space.Compact>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 2, textAlign: 'center' }}>
                            {qtyLabel(cartQuantity)} yd
                          </div>
                        </div>
                      );
                    }
                    return (
                      <InputNumber
                        min={1}
                        max={maxQty}
                        step={1}
                        value={cartQuantity}
                        onChange={(v) => setCartQuantity(v)}
                        style={{ width: 80 }}
                      />
                    );
                  })()}
                </Col>
                <Col>
                  <Button type="primary" icon={<PlusOutlined />} disabled={!canAddToCart} onClick={handleAddToCart}>
                    Add
                  </Button>
                </Col>
              </Row>

              <Divider />
              <Text strong>Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</Text>
              <Table
                dataSource={cart}
                columns={[
                  { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
                  { title: 'Qty', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.is_fabric) },
                  { title: 'Unit Price', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
                  {
                    title: 'Total', key: 'line_total',
                    render: (_, r) => `₱${(r.quantity * r.price).toLocaleString()}`,
                  },
                  {
                    title: '', key: 'action', width: 40,
                    render: (_, r) => (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveFromCart(r.product_id)} />
                    ),
                  },
                ]}
                rowKey="product_id"
                pagination={false}
                size="small"
                locale={{ emptyText: 'No items in cart' }}
              />

              <Divider />
              <Form.Item name="orderDate" label="Date">
                <DatePicker
                  style={{ width: '100%' }}
                  value={orderDate}
                  onChange={(d) => setOrderDate(d || dayjs())}
                />
              </Form.Item>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes"
                />
              </Form.Item>
            </Form>
          </Col>

          <Col xs={24} md={10}>
            <Card title="Order Summary">
              <Descriptions bordered column={1} size="small">
                {cart.map((item, idx) => (
                  <Descriptions.Item key={idx} label={item.product_name}>
                    {fmtQty(item.quantity, item.is_fabric)} × ₱{item.price} = ₱{(item.quantity * item.price).toLocaleString()}
                  </Descriptions.Item>
                ))}
                {cart.length === 0 && (
                  <Descriptions.Item label="—">No items added</Descriptions.Item>
                )}
              </Descriptions>
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ fontSize: 16 }}>Grand Total: ₱{grandTotal.toLocaleString()}</Text>
              </div>
              <Divider />
              <Select
                value={paymentMethod}
                onChange={setPaymentMethod}
                style={{ width: '100%', marginBottom: 8 }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
              <InputNumber
                min={0}
                style={{ width: '100%', marginBottom: 8 }}
                placeholder="Payment Amount"
                prefix="₱"
                value={paymentAmount}
                onChange={(v) => setPaymentAmount(v)}
              />
              <div style={{ marginBottom: 8 }}>
                <Text>Change: </Text>
                <Text strong style={{ color: change > 0 ? '#52c41a' : undefined }}>₱{change.toLocaleString()}</Text>
              </div>
              {paymentAmount > 0 && paymentAmount < grandTotal && (
                <Text type="danger" style={{ display: 'block', marginBottom: 8 }}>Insufficient amount of money</Text>
              )}
              <Text type="secondary">Branch: {branchName}</Text>
            </Card>
          </Col>
        </Row>
      </Modal>

      <Modal
        title="Receipt"
        open={receiptModalVisible}
        onCancel={() => setReceiptModalVisible(false)}
        width={420}
        footer={[
          <Button key="print" type="primary" icon={<PrinterOutlined />}
            onClick={() => window.print()}>
            Print Receipt
          </Button>,
          <Button key="close" onClick={() => setReceiptModalVisible(false)}>Close</Button>,
        ]}
        styles={{ body: { padding: 24 } }}
      >
        {lastOrder && (
          <div id="receipt-content">
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>MCM Trading System</Text>
              <br />
              <Text>{lastOrder.location_name || branchName}</Text>
              <br />
              <Text type="secondary">Transaction #{lastOrder.order_id}</Text>
              <br />
              <Text type="secondary">{dayjs(lastOrder.order_date).format('YYYY-MM-DD hh:mm A')}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(lastOrder.items || []).map((item) => (
                  <tr key={item.order_item_id}>
                    <td>{item.product_name}</td>
                    <td style={{ textAlign: 'center' }}>{Number(item.quantity).toFixed(item.category === FABRIC_CATEGORY ? 2 : 0)}</td>
                    <td style={{ textAlign: 'right' }}>₱{item.price}</td>
                    <td style={{ textAlign: 'right' }}>₱{(item.line_total || (item.quantity * item.price)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Total:</Text>
              <Text strong>₱{lastOrder.total_amount?.toLocaleString() || 0}</Text>
            </div>
            {(lastOrder.payments || []).map((pmt) => (
              <div key={pmt.payment_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Payment ({pmt.payment_method}):</Text>
                  <Text>₱{pmt.price?.toLocaleString() || 0}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Change:</Text>
                  <Text style={{ color: '#52c41a' }}>₱{Math.max(0, (pmt.price || 0) - (lastOrder.total_amount || 0)).toLocaleString()}</Text>
                </div>
              </div>
            ))}
            {(lastOrder.auto_restocks || []).length > 0 && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ fontSize: 11, color: '#52c41a' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Auto-Restock Triggered:</Text>
                  {lastOrder.auto_restocks.map((r, i) => (
                    <div key={i}>{r.product_name}: +{qtyLabel(r.quantity)} from {r.from_location}</div>
                  ))}
                </div>
              </>
            )}
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Thank you for your purchase!</Text>
            </div>
          </div>
        )}
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
