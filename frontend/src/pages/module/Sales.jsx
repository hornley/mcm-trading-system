import { useState, useMemo } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Input, Select, Button, Modal,
  Form, InputNumber, DatePicker, Descriptions, Popconfirm, Space, message,
  Statistic,
} from 'antd';
import { SearchOutlined, ShoppingCartOutlined, DollarOutlined, TransactionOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const BRANCHES = ['Main Store', 'Storehouse'];

const mockProducts = [
  { id: 1, name: 'Cotton Fabric', category: 'Textiles', unitPrice: 150 },
  { id: 2, name: 'Silk Satin', category: 'Textiles', unitPrice: 450 },
  { id: 3, name: 'Linen Blend', category: 'Textiles', unitPrice: 200 },
  { id: 4, name: 'Polyester Thread', category: 'Miscellaneous', unitPrice: 35 },
  { id: 5, name: 'Buttons Pack', category: 'Miscellaneous', unitPrice: 50 },
  { id: 6, name: 'Zipper Roll', category: 'Miscellaneous', unitPrice: 120 },
  { id: 7, name: 'Fleece', category: 'Textiles', unitPrice: 180 },
  { id: 8, name: 'Velvet', category: 'Textiles', unitPrice: 160 },
];

const now = dayjs();
const today = now.format('YYYY-MM-DD');

const mockSales = [
  { key: '1', transactionId: 'TRX-001', productName: 'Cotton Fabric', category: 'Textiles', quantity: 10, unitPrice: 150, totalAmount: 1500, amountPaid: 1500, change: 0, branch: 'Main Store', date: '2025-05-15', status: 'Active' },
  { key: '2', transactionId: 'TRX-002', productName: 'Silk Satin', category: 'Textiles', quantity: 3, unitPrice: 450, totalAmount: 1350, amountPaid: 1400, change: 50, branch: 'Main Store', date: '2025-05-15', status: 'Active' },
  { key: '3', transactionId: 'TRX-003', productName: 'Polyester Thread', category: 'Miscellaneous', quantity: 50, unitPrice: 35, totalAmount: 1750, amountPaid: 2000, change: 250, branch: 'Storehouse', date: '2025-05-14', status: 'Active' },
  { key: '4', transactionId: 'TRX-004', productName: 'Buttons Pack', category: 'Miscellaneous', quantity: 20, unitPrice: 50, totalAmount: 1000, amountPaid: 1000, change: 0, branch: 'Main Store', date: '2025-05-10', status: 'Voided' },
  { key: '5', transactionId: 'TRX-005', productName: 'Linen Blend', category: 'Textiles', quantity: 5, unitPrice: 200, totalAmount: 1000, amountPaid: 1000, change: 0, branch: 'Storehouse', date: '2025-05-13', status: 'Active' },
  { key: '6', transactionId: 'TRX-006', productName: 'Zipper Roll', category: 'Miscellaneous', quantity: 8, unitPrice: 120, totalAmount: 960, amountPaid: 1000, change: 40, branch: 'Main Store', date: '2025-05-12', status: 'Active' },
  { key: '7', transactionId: 'TRX-007', productName: 'Fleece', category: 'Textiles', quantity: 4, unitPrice: 180, totalAmount: 720, amountPaid: 720, change: 0, branch: 'Storehouse', date: '2025-05-11', status: 'Voided' },
  { key: '8', transactionId: 'TRX-008', productName: 'Velvet', category: 'Textiles', quantity: 6, unitPrice: 160, totalAmount: 960, amountPaid: 1000, change: 40, branch: 'Main Store', date: '2025-05-09', status: 'Active' },
];

const todaySales = mockSales.filter((s) => s.date === today && s.status === 'Active');
const monthSales = mockSales.filter((s) => s.date.startsWith('2025-05') && s.status === 'Active');

const todayTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
const monthTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);

const Sales = () => {
  const { user } = useAuth();
  const branch = user?.location || 'Main Store';
  const isOwner = user?.role === 'owner';

  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [totalSalesModalVisible, setTotalSalesModalVisible] = useState(false);
  const [productHistoryVisible, setProductHistoryVisible] = useState(false);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [lockedProduct, setLockedProduct] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [formValues, setFormValues] = useState({
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    paymentAmount: 0,
    change: 0,
    date: dayjs(),
    branch: branch,
    remarks: '',
  });
  const [totalSalesDateRange, setTotalSalesDateRange] = useState(null);
  const [totalSalesBranch, setTotalSalesBranch] = useState(branch);
  const [form] = Form.useForm();

  const filteredSales = mockSales.filter((s) => {
    const matchesSearch = !searchText || s.productName.toLowerCase().includes(searchText.toLowerCase()) || s.transactionId.toLowerCase().includes(searchText.toLowerCase());
    const matchesDate = !dateRange || !dateRange[0] || !dateRange[1] || (s.date >= dateRange[0].format('YYYY-MM-DD') && s.date <= dateRange[1].format('YYYY-MM-DD'));
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesDate && matchesStatus;
  });

  const totalSalesFiltered = useMemo(() => {
    const data = mockSales.filter((s) => {
      const matchesBranch = s.branch === totalSalesBranch;
      const matchesDate = !totalSalesDateRange || !totalSalesDateRange[0] || !totalSalesDateRange[1] || (s.date >= totalSalesDateRange[0].format('YYYY-MM-DD') && s.date <= totalSalesDateRange[1].format('YYYY-MM-DD'));
      return matchesBranch && matchesDate && s.status === 'Active';
    });
    const grouped = {};
    data.forEach((s) => {
      if (!grouped[s.productName]) grouped[s.productName] = { productName: s.productName, category: s.category, totalQty: 0, totalAmount: 0 };
      grouped[s.productName].totalQty += s.quantity;
      grouped[s.productName].totalAmount += s.totalAmount;
    });
    return Object.values(grouped);
  }, [totalSalesBranch, totalSalesDateRange]);

  const totalSalesSummary = useMemo(() => {
    const total = totalSalesFiltered.reduce((sum, s) => sum + s.totalAmount, 0);
    return () => (
      <Table.Summary.Row>
        <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={1} />
        <Table.Summary.Cell index={2} />
        <Table.Summary.Cell index={3}><Text strong>₱{total.toLocaleString()}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    );
  }, [totalSalesFiltered]);

  const handleProductSelect = (productId) => {
    const product = mockProducts.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setLockedProduct(true);
      const total = formValues.quantity * product.unitPrice;
      const change = Math.max(0, formValues.paymentAmount - total);
      setFormValues((prev) => ({ ...prev, unitPrice: product.unitPrice, totalAmount: total, change }));
      form.setFieldsValue({ product: productId, unitPrice: product.unitPrice, totalAmount: total, change });
    }
  };

  const handleChangeProduct = () => {
    setSelectedProduct(null);
    setLockedProduct(false);
    setConfirmed(false);
    setFormValues({ quantity: 1, unitPrice: 0, totalAmount: 0, paymentAmount: 0, change: 0, date: dayjs(), branch: branch, remarks: '' });
    form.resetFields();
  };

  const handleQuantityChange = (val) => {
    const qty = val || 0;
    const total = qty * (selectedProduct?.unitPrice || 0);
    const change = Math.max(0, formValues.paymentAmount - total);
    setFormValues((prev) => ({ ...prev, quantity: qty, totalAmount: total, change }));
    form.setFieldsValue({ totalAmount: total, change });
  };

  const handlePaymentChange = (val) => {
    const payment = val || 0;
    const change = Math.max(0, payment - formValues.totalAmount);
    setFormValues((prev) => ({ ...prev, paymentAmount: payment, change }));
    form.setFieldsValue({ change });
  };

  const handleDateChange = (date) => {
    setFormValues((prev) => ({ ...prev, date }));
    form.setFieldsValue({ date });
  };

  const handleRemarksChange = (e) => {
    setFormValues((prev) => ({ ...prev, remarks: e.target.value }));
  };

  const handleAdd = () => {
    setSelectedRecord(null);
    setSelectedProduct(null);
    setLockedProduct(false);
    setConfirmed(false);
    setFormValues({ quantity: 1, unitPrice: 0, totalAmount: 0, paymentAmount: 0, change: 0, date: dayjs(), branch: branch, remarks: '' });
    form.resetFields();
    form.setFieldsValue({ branch: branch, date: dayjs() });
    setSaleModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    const product = mockProducts.find((p) => p.name === record.productName);
    setSelectedProduct(product);
    setLockedProduct(true);
    setConfirmed(true);
    setFormValues({
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      totalAmount: record.totalAmount,
      paymentAmount: record.amountPaid,
      change: record.change,
      date: dayjs(record.date),
      branch: record.branch,
      remarks: '',
    });
    form.setFieldsValue({
      product: product?.id,
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      totalAmount: record.totalAmount,
      paymentAmount: record.amountPaid,
      change: record.change,
      date: dayjs(record.date),
      branch: record.branch,
    });
    setSaleModalVisible(true);
  };

  const handleVoid = (record) => {
    message.success(`Transaction ${record.transactionId} voided`);
  };

  const handleConfirmOrder = () => {
    form.validateFields().then(() => {
      const { paymentAmount, totalAmount } = form.getFieldsValue();
      if (paymentAmount >= totalAmount) {
        setConfirmed(true);
        message.success('Order confirmed');
      } else {
        message.error('Payment amount must be at least the total amount');
      }
    }).catch(() => {});
  };

  const handleSaveSale = () => {
    if (!confirmed && !selectedRecord) return;
    message.success(selectedRecord ? 'Sale updated' : 'Sale recorded');
    setSaleModalVisible(false);
    form.resetFields();
  };

  const canConfirm = useMemo(() => {
    if (!selectedProduct) return false;
    if (!formValues.quantity || formValues.quantity < 1) return false;
    if (!formValues.paymentAmount || formValues.paymentAmount < formValues.totalAmount) return false;
    return true;
  }, [selectedProduct, formValues]);

  const isVoided = (record) => record.status === 'Voided';

  const columns = [
    {
      title: 'Transaction ID', dataIndex: 'transactionId', key: 'transactionId',
      sorter: (a, b) => a.transactionId.localeCompare(b.transactionId),
    },
    {
      title: 'Product Name', dataIndex: 'productName', key: 'productName',
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category',
      sorter: (a, b) => a.category.localeCompare(b.category),
    },
    {
      title: 'Quantity', dataIndex: 'quantity', key: 'quantity',
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', render: (v) => `₱${v}`,
      sorter: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', render: (v) => `₱${v}`,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Amount Paid', dataIndex: 'amountPaid', key: 'amountPaid', render: (v) => `₱${v}`,
      sorter: (a, b) => a.amountPaid - b.amountPaid,
    },
    {
      title: 'Change', dataIndex: 'change', key: 'change', render: (v) => `₱${v}`,
      sorter: (a, b) => a.change - b.change,
    },
    {
      title: 'Branch', dataIndex: 'branch', key: 'branch',
      sorter: (a, b) => a.branch.localeCompare(b.branch),
    },
    {
      title: 'Date', dataIndex: 'date', key: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" disabled={isVoided(record)} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm
            title="Are you sure you want to void this transaction?"
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

  const totalSalesColumns = [
    {
      title: 'Product Name', dataIndex: 'productName', key: 'productName',
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category',
      sorter: (a, b) => a.category.localeCompare(b.category),
    },
    {
      title: 'Total Quantity Sold', dataIndex: 'totalQty', key: 'totalQty',
      sorter: (a, b) => a.totalQty - b.totalQty,
    },
    {
      title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', render: (v) => `₱${v.toLocaleString()}`,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
  ];

  const historyColumns = [
    {
      title: 'Transaction ID', dataIndex: 'transactionId', key: 'transactionId',
      sorter: (a, b) => a.transactionId.localeCompare(b.transactionId),
    },
    {
      title: 'Date', dataIndex: 'date', key: 'date',
      sorter: (a, b) => a.date.localeCompare(b.date),
    },
    {
      title: 'Quantity', dataIndex: 'quantity', key: 'quantity',
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Unit Price', dataIndex: 'unitPrice', key: 'unitPrice', render: (v) => `₱${v}`,
      sorter: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', render: (v) => `₱${v}`,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Sales</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>Branch: {branch}</Text>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Sales Today" value={`₱${todayTotal.toLocaleString()}`} prefix={<ShoppingCartOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Sales This Month" value={`₱${monthTotal.toLocaleString()}`} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Transactions Today" value={todaySales.length} prefix={<TransactionOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={24} sm={12} md={16}>
          <Space wrap>
            <Input
              placeholder="Search by product or transaction ID"
              prefix={<SearchOutlined />}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
            />
            <RangePicker onChange={(dates) => setDateRange(dates)} />
            <Select
              placeholder="Filter by status"
              style={{ width: 150 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="Active">Active</Select.Option>
              <Select.Option value="Voided">Voided</Select.Option>
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={12} md={8} style={{ textAlign: 'right' }}>
          <Space>
            <Button type="primary" onClick={handleAdd}>Add Sale</Button>
            <Button onClick={() => { setTotalSalesBranch(branch); setTotalSalesModalVisible(true); }}>View Total Sales</Button>
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={filteredSales}
        columns={columns}
        rowKey="key"
        rowClassName={(record) => isVoided(record) ? 'voided-row' : ''}
        pagination={{ pageSize: 10 }}
        scroll={{ y: 400 }}
      />

      <Modal
        title={selectedRecord ? 'Edit Sale' : 'Add Sale'}
        open={saleModalVisible}
        onCancel={() => { setSaleModalVisible(false); form.resetFields(); }}
        width={800}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden' } }}
        footer={[
          <Button key="cancel" onClick={() => { setSaleModalVisible(false); form.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSaveSale} disabled={!confirmed && !selectedRecord}>Save</Button>,
        ]}
      >
        <Row gutter={24}>
          <Col xs={24} md={14}>
            <Form form={form} layout="vertical">
              <Form.Item name="product" label="Product" rules={[{ required: true, message: 'Please select a product' }]}>
                {!lockedProduct ? (
                  <Select
                    showSearch
                    placeholder="Search for a product"
                    optionFilterProp="children"
                    onChange={handleProductSelect}
                  >
                    {mockProducts.map((p) => (
                      <Select.Option key={p.id} value={p.id}>{p.name} — ₱{p.unitPrice}</Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Space style={{ width: '100%' }}>
                    <Input value={selectedProduct?.name} disabled />
                    {!selectedRecord && <Button onClick={handleChangeProduct}>Change Product</Button>}
                  </Space>
                )}
              </Form.Item>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Please enter quantity' }]}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  disabled={!lockedProduct}
                  value={formValues.quantity}
                  onChange={handleQuantityChange}
                />
              </Form.Item>
              <Form.Item name="unitPrice" label="Unit Price">
                <InputNumber min={0} style={{ width: '100%' }} disabled value={formValues.unitPrice} prefix="₱" />
              </Form.Item>
              <Form.Item name="totalAmount" label="Total Amount">
                <InputNumber min={0} style={{ width: '100%' }} disabled value={formValues.totalAmount} prefix="₱" />
              </Form.Item>
              <Form.Item name="paymentAmount" label="Payment Amount" rules={[{ required: true, message: 'Please enter payment amount' }]}>
                <InputNumber
                  min={formValues.totalAmount}
                  style={{ width: '100%' }}
                  disabled={!lockedProduct}
                  value={formValues.paymentAmount}
                  onChange={handlePaymentChange}
                  prefix="₱"
                />
              </Form.Item>
              <Form.Item name="change" label="Change">
                <InputNumber min={0} style={{ width: '100%' }} disabled value={formValues.change} prefix="₱" />
              </Form.Item>
              <Form.Item name="branch" label="Branch">
                <Input disabled value={branch} />
              </Form.Item>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select date' }]}>
                <DatePicker style={{ width: '100%' }} value={formValues.date} onChange={handleDateChange} />
              </Form.Item>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea
                  rows={2}
                  value={formValues.remarks}
                  onChange={handleRemarksChange}
                  placeholder="Optional notes"
                />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} md={10}>
            <Card title="Order Summary">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Product">{selectedProduct?.name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Category">{selectedProduct?.category || '—'}</Descriptions.Item>
                <Descriptions.Item label="Quantity">{formValues.quantity}</Descriptions.Item>
                <Descriptions.Item label="Unit Price">₱{formValues.unitPrice}</Descriptions.Item>
                <Descriptions.Item label="Total Amount">₱{formValues.totalAmount}</Descriptions.Item>
                <Descriptions.Item label="Payment Amount">₱{formValues.paymentAmount}</Descriptions.Item>
                <Descriptions.Item label="Change">₱{formValues.change}</Descriptions.Item>
              </Descriptions>
              {!selectedRecord && (
                <Button
                  type="primary"
                  style={{ marginTop: 16, width: '100%' }}
                  disabled={!canConfirm || confirmed}
                  onClick={handleConfirmOrder}
                >
                  {confirmed ? 'Confirmed ✓' : 'Confirm Order'}
                </Button>
              )}
            </Card>
          </Col>
        </Row>
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
              {BRANCHES.map((b) => (
                <Select.Option key={b} value={b}>{b}</Select.Option>
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
            rowKey="productName"
            pagination={false}
            size="small"
            summary={totalSalesSummary}
            onRow={(record) => ({
              onClick: () => {
                setSelectedHistoryProduct(record.productName);
                setProductHistoryVisible(true);
              },
              style: { cursor: 'pointer' },
            })}
          />
        </Space>
      </Modal>

      <Modal
        title={`Sales History — ${selectedHistoryProduct}`}
        open={productHistoryVisible}
        onCancel={() => setProductHistoryVisible(false)}
        footer={[<Button key="close" onClick={() => setProductHistoryVisible(false)}>Close</Button>]}
        width={650}
      >
        <Table
          dataSource={mockSales.filter((s) => s.productName === selectedHistoryProduct && s.branch === totalSalesBranch)}
          columns={historyColumns}
          rowKey="key"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default Sales;