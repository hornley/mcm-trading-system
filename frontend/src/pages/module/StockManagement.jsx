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
  const [storehouse, setStorehouse] = useState(null);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [reorderForm] = Form.useForm();
  const [adjustForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [restocking, setRestocking] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [movementsCache, setMovementsCache] = useState({});
  const [stats, setStats] = useState({ total_items: 0, low_stock_count: 0, out_of_stock_count: 0 });

  const fetchData = async (page) => {
    if (!user) return;
    const p = page || currentPage;
    setLoading(true);
    try {
      const locationParam = selectedLocationId !== "all" ? `&location_id=${selectedLocationId}` : '';
      const userIdParam = `&user_id=${user.user_id}`;
      const searchParam = searchText ? `&q=${encodeURIComponent(searchText)}` : '';

      const [invRes, locRes, countRes] = await Promise.all([
        fetch(`/api/inventory?usertype=${user.usertype}${locationParam}${userIdParam}&page=${p}&limit=${pageSize}${searchParam}`),
        fetch(`/api/locations?usertype=${user.usertype}`),
        fetch(`/api/inventory/counts?usertype=${user.usertype}${locationParam}${userIdParam}`),
      ]);
      const invData = await invRes.json();
      const locData = await locRes.json();
      const countData = await countRes.json();

      if (invData.success) {
        setInventory(invData.data.data || []);
        setTotalCount(invData.data.total_count || 0);
        setCurrentPage(invData.data.page || p);
      }
      if (countData.success) {
        setStats(countData.data);
      }
      if (locData.success) {
        const activeLocs = locData.data.filter((l) => l.is_active);
        setLocations(activeLocs);
        setStorehouse(activeLocs.find((l) => l.is_storehouse) || null);
      }
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setMovementsCache({});
    fetchData(1);
  }, [user, selectedLocationId]);

  const handleViewDetails = async (record) => {
    setSelectedRecord(record);
    if (movementsCache[record.product_id]) {
      setMovements(movementsCache[record.product_id]);
    } else {
      try {
        const res = await fetch(`/api/inventory/movements?usertype=${user.usertype}&product_id=${record.product_id}`);
        const data = await res.json();
        const result = data.success ? data.data : [];
        setMovements(result);
        setMovementsCache((prev) => ({ ...prev, [record.product_id]: result }));
      } catch {
        setMovements([]);
      }
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

  const handleSetReorder = (record) => {
    setSelectedRecord(record);
    reorderForm.resetFields();
    reorderForm.setFieldsValue({ reorder_level: record.reorder_level ? parseInt(record.reorder_level) : 0 });
    setReorderVisible(true);
  };

  const handleReorderSave = async () => {
    try {
      const values = await reorderForm.validateFields();
      const res = await fetch(`/api/products/${selectedRecord.product_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          reorder_level: values.reorder_level ? String(values.reorder_level) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Reorder level updated');
        setReorderVisible(false);
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to update reorder level');
    }
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

  const handleBulkRestock = async () => {
    if (!storehouse) {
      message.warning('No storehouse configured. Mark a location as storehouse first.');
      return;
    }
    if (selectedLocationId === "all") {
      message.warning('Select a specific branch from the top bar to restock');
      return;
    }
    setRestocking(true);
    try {
      const res = await fetch('/api/inventory/restock-below-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          location_id: selectedLocationId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data.count > 0) {
          message.success(`Restocked ${json.data.count} product(s) from ${storehouse.name}`);
          fetchData();
        } else {
          message.info('No products below reorder level');
        }
      } else {
        message.error(json.message);
      }
    } catch {
      message.error('Failed to restock');
    } finally {
      setRestocking(false);
    }
  };

  const { total_items: totalItems, low_stock_count: lowStockCount, out_of_stock_count: outOfStockCount } = stats;

  const columns = [
    {
      title: 'Product Name', dataIndex: 'product_name', key: 'product_name',
      defaultSortOrder: 'ascend',
      sorter: (a, b) => a.product_name.localeCompare(b.product_name),
    },
    {
      title: 'Branch', dataIndex: 'location_name', key: 'location_name',
      sorter: (a, b) => a.location_name.localeCompare(b.location_name),
    },
    {
      title: 'Current Stock Quantity', dataIndex: 'quantity', key: 'quantity',
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Stock Status',
      dataIndex: 'quantity',
      key: 'stockStatus',
      render: (qty) => getStockStatus(qty).tag,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level',
      render: (val) => (val ? parseInt(val) : '-'),
      sorter: (a, b) => (parseInt(a.reorder_level) || 0) - (parseInt(b.reorder_level) || 0),
    },
    {
      title: 'Auto-Restock',
      key: 'autoRestock',
      render: (_, record) => {
        const level = parseInt(record.reorder_level) || 0;
        const enabled = storehouse && level > 0;
        return enabled
          ? <Tag color="green">Active</Tag>
          : <Tag>{storehouse ? 'Inactive' : 'No Storehouse'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space wrap>
          {can('update') && (
            <Button type="link" disabled={selectedLocationId === "all"} onClick={() => handleSetReorder(record)}>
              Set Reorder Level
            </Button>
          )}
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
    {
      title: 'Date', dataIndex: 'date', key: 'date',
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (type) => {
        const labels = { adjustment: 'Adjustment', transfer_out: 'Transfer Out', transfer_in: 'Transfer In' };
        return labels[type] || type;
      },
      sorter: (a, b) => (a.type || '').localeCompare(b.type || ''),
    },
    {
      title: 'Quantity Change', dataIndex: 'quantity_change', key: 'quantity_change',
      render: (val) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {val >= 0 ? `+${val}` : val}
        </span>
      ),
      sorter: (a, b) => a.quantity_change - b.quantity_change,
    },
    {
      title: 'Location', dataIndex: 'location_name', key: 'location_name',
      sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || ''),
    },
    {
      title: 'Reason / Remarks', dataIndex: 'remarks', key: 'remarks', render: (v) => v || '-',
      sorter: (a, b) => (a.remarks || '').localeCompare(b.remarks || ''),
    },
  ];

  if (loading && inventory.length === 0) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Stock Management</Title>
      <Card styles={{ body: { padding: '16px 24px' } }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card styles={{ body: { padding: '20px 24px' } }}><Statistic title="Total Stock Items" value={totalItems} /></Card>
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

      {storehouse && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Space>
            <Tag color="green">Storehouse</Tag>
            <span><strong>{storehouse.name}</strong> — auto-restock source branch</span>
          </Space>
        </Card>
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={14}>
          <Space wrap>
            <Search
              placeholder="Search by product name"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={() => fetchData(1)}
              onPressEnter={() => fetchData(1)}
              enterButton
              style={{ width: 220 }}
            />
            {can('update') && storehouse && (
              <Button type="primary" onClick={handleBulkRestock} loading={restocking} disabled={selectedLocationId === "all"}>
                Restock Below Reorder
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={inventory}
        columns={columns}
        rowKey="inventory_id"
        loading={loading}
        pagination={{ current: currentPage, pageSize, total: totalCount, showSizeChanger: false, onChange: (p) => fetchData(p) }}
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
          <Descriptions.Item label="Reorder Level">{parseInt(selectedRecord?.reorder_level) || 'Not set'}</Descriptions.Item>
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
        title={`Set Reorder Level - ${selectedRecord?.product_name}`}
        open={reorderVisible}
        onCancel={() => setReorderVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setReorderVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleReorderSave}>Save</Button>,
        ]}
      >
        <Form form={reorderForm} layout="vertical">
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Set the minimum stock threshold. When quantity drops below this level after a sale, an auto-restock transfer from the storehouse will be triggered.
          </Typography.Text>
          <Form.Item name="reorder_level" label="Reorder Level" rules={[{ required: true, message: 'Please enter reorder level' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter minimum stock level" />
          </Form.Item>
        </Form>
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
    </div>
  );
};

export default StockManagement;
