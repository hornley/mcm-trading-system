import { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Row, Col, Input, Select, Button,
  Tag, Modal, Statistic, Space, Descriptions, Form, InputNumber,
  DatePicker, message, Spin,
} from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;
const { Search, TextArea } = Input;

const getStockStatus = (qty) => {
  if (qty === 0) return { tag: <Tag color="red">Out of Stock</Tag>, label: 'out' };
  if (qty <= 10) return { tag: <Tag color="orange">Low Stock</Tag>, label: 'low' };
  return { tag: <Tag color="green">In Stock</Tag>, label: 'in' };
};

const adjustmentReasons = ['Restock', 'Damaged', 'Correction', 'Sample', 'Sales Return'];

const StockManagement = () => {
  const { user, can, selectedLocationId } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailVisible, setDetailVisible] = useState(false);
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [fromLocationId, setFromLocationId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [adjustForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const locationParam = selectedLocationId !== "all" ? `&location_id=${selectedLocationId}` : '';
      const userIdParam = `&user_id=${user.user_id}`;

      const [invRes, locRes] = await Promise.all([
        fetch(`/api/inventory?usertype=${user.usertype}${locationParam}${userIdParam}`),
        fetch(`/api/locations?usertype=${user.usertype}`),
      ]);
      const invData = await invRes.json();
      const locData = await locRes.json();

      if (invData.success) setInventory(invData.data);
      if (locData.success) setLocations(locData.data.filter((l) => l.is_active));
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedLocationId]);

  const handleViewDetails = async (record) => {
    setSelectedRecord(record);
    try {
      const res = await fetch(`/api/inventory/movements?usertype=${user.usertype}&product_id=${record.product_id}`);
      const data = await res.json();
      if (data.success) setMovements(data.data);
      else setMovements([]);
    } catch {
      setMovements([]);
    }
    setDetailVisible(true);
  };

  const handleAdjustStock = (record) => {
    if (selectedLocationId === "all") {
      message.warning('Select a specific branch from the top bar to adjust stock');
      return;
    }
    setSelectedRecord(record);
    adjustForm.resetFields();
    setAdjustVisible(true);
  };

  const handleTransferStock = (record) => {
    setSelectedRecord(record);
    setFromLocationId(record.location_id);
    transferForm.resetFields();
    transferForm.setFieldsValue({ from_location_id: record.location_id });
    setTransferVisible(true);
  };

  const handleAdjustSave = async () => {
    try {
      const values = await adjustForm.validateFields();
      const quantityChange = values.adjustmentType === 'in'
        ? Math.abs(values.quantity)
        : -Math.abs(values.quantity);

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          product_id: selectedRecord.product_id,
          location_id: selectedLocationId,
          quantity_change: quantityChange,
          reason: values.reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Stock adjusted');
        setAdjustVisible(false);
        adjustForm.resetFields();
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to adjust stock');
    }
  };

  const handleTransferSave = async () => {
    try {
      const values = await transferForm.validateFields();
      const transferDate = values.date ? values.date.toISOString() : new Date().toISOString();

      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          product_id: selectedRecord.product_id,
          from_location_id: values.from_location_id,
          to_location_id: values.to_location_id,
          quantity: values.quantity,
          transfer_date: transferDate,
          remarks: values.remarks || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Stock transferred');
        setTransferVisible(false);
        setFromLocationId(null);
        transferForm.resetFields();
        fetchData();
      } else {
        message.error(data.message || 'Failed to transfer stock');
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to transfer stock');
    }
  };

  const filteredData = inventory.filter((item) =>
    item.product_name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const totalItems = filteredData.length;
  const lowStockCount = filteredData.filter((s) => s.quantity > 0 && s.quantity <= 10).length;
  const outOfStockCount = filteredData.filter((s) => s.quantity === 0).length;

  const columns = [
    { title: 'Product Name', dataIndex: 'product_name', key: 'product_name' },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name' },
    { title: 'Current Stock Quantity', dataIndex: 'quantity', key: 'quantity' },
    {
      title: 'Stock Status',
      dataIndex: 'quantity',
      key: 'stockStatus',
      render: (qty) => getStockStatus(qty).tag,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {can('update') && (
            <Button type="link" disabled={selectedLocationId === "all"} onClick={() => handleAdjustStock(record)}>
              Adjust Stock
            </Button>
          )}
          {can('update') && (
            <Button type="link" onClick={() => handleTransferStock(record)}>
              Transfer
            </Button>
          )}
          <Button type="link" onClick={() => handleViewDetails(record)}>
            View Details
          </Button>
        </Space>
      ),
    },
  ];

  const movementColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (type) => {
        const labels = { adjustment: 'Adjustment', transfer_out: 'Transfer Out', transfer_in: 'Transfer In' };
        return labels[type] || type;
      },
    },
    {
      title: 'Quantity Change', dataIndex: 'quantity_change', key: 'quantity_change',
      render: (val) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {val >= 0 ? `+${val}` : val}
        </span>
      ),
    },
    { title: 'Location', dataIndex: 'location_name', key: 'location_name' },
    { title: 'Reason / Remarks', dataIndex: 'remarks', key: 'remarks', render: (v) => v || '-' },
  ];

  if (loading) return <Card style={{ margin: 24, textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <Card style={{ margin: 24 }}>
      <Title level={2}>Stock Management</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Total Stock Items" value={totalItems} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Low Stock Items" value={lowStockCount} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Out of Stock Items" value={outOfStockCount} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={14}>
          <Space wrap>
            <Search
              placeholder="Search by product name"
              onSearch={setSearchText}
              onChange={(e) => setSearchText(e.target.value)}
              enterButton
              style={{ width: 220 }}
            />
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="inventory_id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`${selectedRecord?.product_name} - Stock Details`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[<Button key="close" type="primary" onClick={() => setDetailVisible(false)}>Close</Button>]}
        width={700}
      >
        <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Product Name">{selectedRecord?.product_name}</Descriptions.Item>
          <Descriptions.Item label="SKU">{selectedRecord?.sku}</Descriptions.Item>
          <Descriptions.Item label="Branch">{selectedRecord?.location_name}</Descriptions.Item>
          <Descriptions.Item label="Current Stock Quantity">{selectedRecord?.quantity}</Descriptions.Item>
        </Descriptions>

        <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
          Stock Movement History
        </Typography.Text>
        <Table
          dataSource={movements}
          columns={movementColumns}
          rowKey={(row, idx) => `${row.type}-${idx}`}
          size="small"
          pagination={false}
          bordered
        />
      </Modal>

      <Modal
        title={`Adjust Stock - ${selectedRecord?.product_name}`}
        open={adjustVisible}
        onCancel={() => setAdjustVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAdjustVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleAdjustSave}>Save</Button>,
        ]}
      >
        <Form form={adjustForm} layout="vertical">
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Adjusting stock at selected branch
          </Typography.Text>
          <Form.Item name="adjustmentType" label="Adjustment Type" rules={[{ required: true, message: 'Please select adjustment type' }]}>
            <Select placeholder="Select type">
              <Select.Option value="in">Stock In (+)</Select.Option>
              <Select.Option value="out">Stock Out (-)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Please enter quantity' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please select a reason' }]}>
            <Select placeholder="Select reason">
              {adjustmentReasons.map((r) => (
                <Select.Option key={r} value={r}>{r}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="Remarks (optional)">
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Transfer Stock - ${selectedRecord?.product_name}`}
        open={transferVisible}
        onCancel={() => { setTransferVisible(false); setFromLocationId(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setTransferVisible(false); setFromLocationId(null); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleTransferSave}>Save</Button>,
        ]}
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item name="from_location_id" label="From Branch">
            <Select disabled>
              {locations.map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="to_location_id" label="To Branch" rules={[{ required: true, message: 'Please select destination branch' }]}>
            <Select placeholder="Select destination branch">
              {locations.filter((loc) => loc.location_id !== fromLocationId).map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Please enter quantity' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -16, marginBottom: 16, display: 'block' }}>
            Available: {selectedRecord?.quantity ?? 0} units
          </Typography.Text>
          <Form.Item name="date" label="Transfer Date" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks (optional)">
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default StockManagement;
