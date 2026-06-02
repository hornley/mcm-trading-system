import { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Row, Col, Input, Select, Button,
  Tag, Modal, Statistic, Space, Descriptions, Form, InputNumber,
  DatePicker, message, Spin, Segmented, Checkbox,
} from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { FABRIC_CATEGORY, fmtQty, qtyLabel } from '../../utils/format.js';

const { Search, TextArea } = Input;

const getStockStatus = (qty) => {
  const n = Number(qty);
  if (n === 0) return { tag: <Tag color="red">Out of Stock</Tag>, label: 'out' };
  if (n <= 10) return { tag: <Tag color="orange">Low Stock</Tag>, label: 'low' };
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
  const [requestPreset, setRequestPreset] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const [movementsCache, setMovementsCache] = useState({});
  const [stats, setStats] = useState({ total_items: 0, low_stock_count: 0, out_of_stock_count: 0 });
  const [sortBy, setSortBy] = useState('product_name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectRestockVisible, setSelectRestockVisible] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [selectedRestockIds, setSelectedRestockIds] = useState(new Set());
  const [restockQuantities, setRestockQuantities] = useState({});
  const [orderSummaryVisible, setOrderSummaryVisible] = useState(false);
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const fetchData = async (page, sortOverrides) => {
    if (!user) return;
    const p = page || currentPage;
    const sb = sortOverrides?.sortBy || sortBy;
    const so = sortOverrides?.sortOrder || sortOrder;
    setLoading(true);
    try {
      const locationParam = selectedLocationId !== "all" ? `&location_id=${selectedLocationId}` : '';
      const userIdParam = `&user_id=${user.user_id}`;
      const searchParam = searchText ? `&q=${encodeURIComponent(searchText)}` : '';
      const sortParam = `&sort_by=${sb}&sort_order=${so}`;
      const statusParam = statusFilter ? `&status=${statusFilter}` : '';

      const [invRes, locRes, countRes] = await Promise.all([
        fetch(`/api/inventory?usertype=${user.usertype}${locationParam}${userIdParam}&page=${p}&limit=${pageSize}${searchParam}${sortParam}${statusParam}`),
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
  }, [user, selectedLocationId, statusFilter]);

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
    setRequestPreset(false);
    adjustForm.resetFields();
    setAdjustVisible(true);
  };

  const handleRequestStock = (record) => {
    if (selectedLocationId === "all") {
      message.warning('Select a specific branch from the top bar to request stock');
      return;
    }
    setSelectedRecord(record);
    setRequestPreset(true);
    adjustForm.resetFields();
    adjustForm.setFieldsValue({ adjustmentType: 'in', reason: 'Restock' });
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
    reorderForm.setFieldsValue({ reorder_level: record.reorder_level ? Number(record.reorder_level) : 0 });
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

      if (requestPreset) {
        const res = await fetch('/api/inventory/request-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usertype: user.usertype,
            user_id: user.user_id,
            product_id: selectedRecord.product_id,
            from_location_id: values.from_location_id,
            to_location_id: selectedLocationId,
            quantity: values.quantity,
            description: values.remarks || null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          message.success('Stock request submitted');
          setAdjustVisible(false);
          adjustForm.resetFields();
        } else {
          message.error(data.message);
        }
      } else {
        const adjType = values.adjustmentType;
        const reason = values.reason;
        const quantityChange = adjType === 'in'
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
            reason,
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
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error(requestPreset ? 'Failed to submit stock request' : 'Failed to adjust stock');
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

  const handleOpenSelectRestock = async () => {
    if (selectedLocationId === "all") {
      message.warning('Select a specific branch from the top bar to restock');
      return;
    }
    try {
      const res = await fetch(`/api/inventory/low-stock?usertype=${user.usertype}&location_id=${selectedLocationId}&user_id=${user.user_id}`);
      const data = await res.json();
      if (data.success) {
        setLowStockItems(data.data || []);
        const defaultQtys = {};
        (data.data || []).forEach((item) => {
          const deficit = Math.max(0, (item.reorder_level || 0) - item.quantity);
          defaultQtys[item.product_id] = deficit > 0 ? deficit + Math.ceil(deficit / 2) : 0;
        });
        setRestockQuantities(defaultQtys);
        setSelectedRestockIds(new Set());
      } else {
        message.error(data.message || 'Failed to load low stock items');
      }
    } catch {
      message.error('Failed to load low stock items');
    }
    setSelectRestockVisible(true);
  };

  const handleToggleRestockItem = (productId) => {
    setSelectedRestockIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAllRestock = (checked) => {
    if (checked) {
      setSelectedRestockIds(new Set(lowStockItems.map((i) => i.product_id)));
    } else {
      setSelectedRestockIds(new Set());
    }
  };

  const handleRestockQtyChange = (productId, value) => {
    setRestockQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const handleOrderRestock = () => {
    if (selectedRestockIds.size === 0) {
      message.warning('Select at least one item to restock');
      return;
    }
    setOrderSummaryVisible(true);
  };

  const handleConfirmRestock = async () => {
    const items = [];
    for (const productId of selectedRestockIds) {
      const qty = restockQuantities[productId] || 0;
      if (qty > 0) {
        items.push({ product_id: productId, quantity: qty });
      }
    }
    if (items.length === 0) {
      message.warning('All selected items have zero quantity');
      return;
    }
    setRestockSubmitting(true);
    try {
      const res = await fetch('/api/inventory/restock-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          location_id: selectedLocationId,
          items,
        }),
      });
      const json = await res.json();
      if (json.success) {
        message.success(`Restocked ${json.data.count} product(s)`);
        setOrderSummaryVisible(false);
        setSelectRestockVisible(false);
        setSelectedRestockIds(new Set());
        fetchData();
      } else {
        message.error(json.message);
      }
    } catch {
      message.error('Failed to restock selected items');
    } finally {
      setRestockSubmitting(false);
    }
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const { total_items: totalItems, low_stock_count: lowStockCount, out_of_stock_count: outOfStockCount } = stats;

  const columns = [
    {
      title: 'Product Name', dataIndex: 'product_name', key: 'product_name',
      sorter: true,
      defaultSortOrder: sortBy === 'product_name' ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
    },
    {
      title: 'Branch', dataIndex: 'location_name', key: 'location_name',
      sorter: true,
    },
    {
      title: 'Current Stock Quantity', dataIndex: 'quantity', key: 'quantity',
      render: (qty, record) => fmtQty(qty, record.category === FABRIC_CATEGORY),
      sorter: true,
    },
    {
      title: 'Stock Status',
      dataIndex: 'quantity',
      key: 'stockStatus',
      render: (qty) => getStockStatus(qty).tag,
      sorter: true,
    },
    {
      title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level',
      render: (val) => (val ? Number(val).toLocaleString() : '-'),
      sorter: true,
    },
    {
      title: 'Auto-Restock',
      key: 'autoRestock',
      render: (_, record) => {
        const level = Number(record.reorder_level) || 0;
        const enabled = storehouse && level > 0;
        return enabled
          ? <Tag color="green">Active</Tag>
          : <Tag>{storehouse ? 'Inactive' : 'No Storehouse'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Space size={4}>
            {can('update') && (
              <Button type="link" size="small" disabled={selectedLocationId === "all"} onClick={() => handleRequestStock(record)}>
                Request
              </Button>
            )}
            {can('update') && (
              <Button type="link" size="small" disabled={selectedLocationId === "all"} onClick={() => handleSetReorder(record)}>
                Reorder
              </Button>
            )}
            {can('update') && (
              <Button type="link" size="small" disabled={selectedLocationId === "all"} onClick={() => handleAdjustStock(record)}>
                Adjust
              </Button>
            )}
          </Space>
          <Space size={4}>
            {can('update') && (
              <Button type="link" size="small" disabled={selectedLocationId === "all" || record.quantity === 0} onClick={() => handleTransferStock(record)}>
                Transfer
              </Button>
            )}
            <Button type="link" size="small" onClick={() => handleViewDetails(record)}>
              Details
            </Button>
          </Space>
        </div>
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

  const qtyValue = Form.useWatch('quantity', adjustForm);

  const handleQtyChange = (delta) => {
    const isFab = selectedRecord?.category === FABRIC_CATEGORY;
    const step = isFab ? 0.25 : 1;
    const min = isFab ? 0.25 : 1;
    const current = qtyValue ?? min;
    const newVal = Math.max(min, +((current + delta).toFixed(2)));
    adjustForm.setFieldsValue({ quantity: newVal });
  };

  if (loading && inventory.length === 0) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
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
        <Card size="small" style={{ marginBottom: 16, background: 'rgba(82, 196, 26, 0.08)', borderColor: 'rgba(82, 196, 26, 0.3)' }}>
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
              onSearch={() => { setCurrentPage(1); fetchData(1); }}
              enterButton
              allowClear
              style={{ width: 220 }}
            />
            {can('update') && storehouse && (
              <Button type="primary" onClick={handleBulkRestock} loading={restocking} disabled={selectedLocationId === "all"}>
                Restock Below Reorder
              </Button>
            )}
            {can('update') && (
              <Button type="primary" onClick={handleOpenSelectRestock} disabled={selectedLocationId === "all"}>
                Select Restock
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12 }}>
        <Segmented
          value={statusFilter || 'all'}
          options={[
            { label: 'All', value: 'all' },
            { label: `In Stock (${stats.total_items - stats.low_stock_count - stats.out_of_stock_count})`, value: 'in_stock' },
            { label: `Low Stock (${stats.low_stock_count})`, value: 'low_stock' },
            { label: `Out of Stock (${stats.out_of_stock_count})`, value: 'out_of_stock' },
          ]}
          onChange={(val) => setStatusFilter(val === 'all' ? '' : val)}
        />
      </Space>

      <Table
        dataSource={inventory}
        columns={columns}
        rowKey="inventory_id"
        loading={loading}
        rowClassName={(record) => {
          const q = Number(record.quantity);
          if (q === 0) return 'row-out-of-stock';
          if (q <= 10) return 'row-low-stock';
          return '';
        }}
        onChange={(pagination, filters, sorter) => {
          if (sorter.field) {
            const newSortBy = sorter.field;
            const newSortOrder = sorter.order === 'descend' ? 'desc' : 'asc';
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
            fetchData(1, { sortBy: newSortBy, sortOrder: newSortOrder });
          }
        }}
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
          <Descriptions.Item label="Current Stock Quantity">{fmtQty(selectedRecord?.quantity, selectedRecord?.category === FABRIC_CATEGORY)}</Descriptions.Item>
          <Descriptions.Item label="Reorder Level">{selectedRecord?.reorder_level ? Number(selectedRecord.reorder_level).toLocaleString() : 'Not set'}</Descriptions.Item>
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
        title={requestPreset ? `Request Stock - ${selectedRecord?.product_name}` : `Adjust Stock - ${selectedRecord?.product_name}`}
        open={adjustVisible}
        onCancel={() => setAdjustVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAdjustVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleAdjustSave}>{requestPreset ? 'Submit Request' : 'Save'}</Button>,
        ]}
      >
        <Form form={adjustForm} layout="vertical">
          {requestPreset ? (
            <>
              <Typography.Text style={{ display: 'block', marginBottom: 16 }}>
                Request stock from another branch to your current location.
              </Typography.Text>
              <Form.Item name="from_location_id" label="Source Branch" rules={[{ required: true, message: 'Please select source branch' }]}>
                <Select placeholder="Select branch to request from">
                  {locations.filter((loc) => loc.location_id !== selectedLocationId).map((loc) => (
                    <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Adjusting stock at selected branch
              </Typography.Text>
              <Typography.Text style={{ display: 'block', marginBottom: 16 }}>
                Current stock: <strong>{fmtQty(selectedRecord?.quantity, selectedRecord?.category === FABRIC_CATEGORY)} {selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'}</strong>
              </Typography.Text>
              <Form.Item name="adjustmentType" label="Adjustment Type" rules={[{ required: true, message: 'Please select adjustment type' }]}>
                <Select placeholder="Select type">
                  <Select.Option value="in">Stock In (+)</Select.Option>
                  <Select.Option value="out">Stock Out (-)</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please select a reason' }]}>
                <Select placeholder="Select reason">
                  {adjustmentReasons.map((r) => (
                    <Select.Option key={r} value={r}>{r}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          <Form.Item label={`Quantity (${selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'})`} required>
            <Row align="middle" gutter={4} wrap={false}>
              <Col>
                <Button
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() => handleQtyChange(-(selectedRecord?.category === FABRIC_CATEGORY ? 0.25 : 1))}
                />
              </Col>
              <Col flex="auto">
                <Form.Item name="quantity" noStyle rules={[{ required: true, message: 'Please enter quantity' }]}>
                  <InputNumber
                    controls={false}
                    min={selectedRecord?.category === FABRIC_CATEGORY ? 0.25 : 1}
                    step={selectedRecord?.category === FABRIC_CATEGORY ? 0.25 : 1}
                    precision={selectedRecord?.category === FABRIC_CATEGORY ? undefined : 0}
                    formatter={(value) => qtyLabel(Number(value))}
                    parser={(display) => {
                      const fracMap = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
                      for (const [char, val] of Object.entries(fracMap)) {
                        if (display.includes(char)) {
                          const before = display.split(char)[0].trim();
                          const whole = before ? parseInt(before) || 0 : 0;
                          return whole + val;
                        }
                      }
                      const num = parseFloat(display.replace(/[^\d.]/g, ''));
                      return isNaN(num) ? 0 : num;
                    }}
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </Form.Item>
              </Col>
              <Col>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleQtyChange(selectedRecord?.category === FABRIC_CATEGORY ? 0.25 : 1)}
                />
              </Col>
            </Row>
          </Form.Item>
          <Form.Item name="remarks" label={requestPreset ? 'Description (optional)' : 'Remarks (optional)'}>
            <TextArea rows={2} placeholder={requestPreset ? 'Additional notes for the request' : 'Additional notes'} />
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
          <Form.Item name="quantity" label={`Quantity (${selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'})`} rules={[{ required: true, message: 'Please enter quantity' }]}>
            <InputNumber min={selectedRecord?.category === FABRIC_CATEGORY ? 0.125 : 1} max={selectedRecord?.quantity || 1} step={selectedRecord?.category === FABRIC_CATEGORY ? 0.125 : 1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -16, marginBottom: 16, display: 'block' }}>
            Available: {fmtQty(selectedRecord?.quantity, selectedRecord?.category === FABRIC_CATEGORY)} {selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'}
          </Typography.Text>
          <Form.Item name="date" label="Transfer Date" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks (optional)">
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Select Items to Restock"
        open={selectRestockVisible}
        onCancel={() => { setSelectRestockVisible(false); setOrderSummaryVisible(false); }}
        width={orderSummaryVisible ? 1100 : 800}
        styles={{ body: { padding: '16px 24px' } }}
        footer={
          orderSummaryVisible
            ? null
            : [
              <Button key="cancel" onClick={() => { setSelectRestockVisible(false); setOrderSummaryVisible(false); }}>Cancel</Button>,
              <Button key="order" type="primary" onClick={handleOrderRestock}>Order</Button>,
            ]
        }
      >
        <Row gutter={16} style={{ minHeight: '100%' }}>
          <Col xs={24} lg={orderSummaryVisible ? 14 : 24}>
            <div style={{ marginBottom: 12 }}>
              <Checkbox
                checked={selectedRestockIds.size > 0 && selectedRestockIds.size === lowStockItems.length}
                indeterminate={selectedRestockIds.size > 0 && selectedRestockIds.size < lowStockItems.length}
                onChange={(e) => handleSelectAllRestock(e.target.checked)}
              >
                Select All
              </Checkbox>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '45vh' }}>
              <Table
                dataSource={lowStockItems}
                rowKey="product_id"
                pagination={false}
                size="small"
                bordered
                columns={[
                  {
                    title: 'Select', key: 'select', width: 60,
                    render: (_, record) => (
                      <Checkbox
                        checked={selectedRestockIds.has(record.product_id)}
                        onChange={() => handleToggleRestockItem(record.product_id)}
                      />
                    ),
                  },
                  { title: 'Product Name', dataIndex: 'product_name', key: 'product_name', sorter: (a, b) => a.product_name.localeCompare(b.product_name) },
                  { title: 'Category', dataIndex: 'category', key: 'category', sorter: (a, b) => (a.category || '').localeCompare(b.category || '') },
                  {
                    title: 'Status', key: 'status', width: 130,
                    sorter: (a, b) => a.quantity - b.quantity,
                    render: (_, record) => getStockStatus(record.quantity).tag,
                  },
                  {
                    title: 'Current Quantity', dataIndex: 'quantity', key: 'quantity', width: 130,
                    sorter: (a, b) => a.quantity - b.quantity,
                    render: (qty, record) => fmtQty(qty, record.category === FABRIC_CATEGORY),
                  },
                  {
                    title: 'Restock Quantity', key: 'restockQty', width: 140,
                    render: (_, record) => {
                      const isFab = record.category === FABRIC_CATEGORY;
                      const step = isFab ? 0.25 : 1;
                      const qty = restockQuantities[record.product_id] || 0;
                      const disabled = !selectedRestockIds.has(record.product_id);
                      return (
                        <Row align="middle" gutter={2} wrap={false}>
                          <Col>
                            <Button
                              size="small"
                              icon={<MinusOutlined />}
                              disabled={disabled}
                              onClick={() => handleRestockQtyChange(record.product_id, Math.max(0, +((qty - step).toFixed(2))))}
                            />
                          </Col>
                          <Col flex="auto">
                            <InputNumber
                              controls={false}
                              min={0}
                              step={step}
                              value={qty}
                              disabled={disabled}
                              formatter={(value) => qtyLabel(Number(value))}
                              parser={(display) => {
                                const fracMap = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
                                for (const [char, val] of Object.entries(fracMap)) {
                                  if (display.includes(char)) {
                                    const before = display.split(char)[0].trim();
                                    const whole = before ? parseInt(before) || 0 : 0;
                                    return whole + val;
                                  }
                                }
                                const num = parseFloat(display.replace(/[^\d.]/g, ''));
                                return isNaN(num) ? 0 : num;
                              }}
                              onChange={(val) => handleRestockQtyChange(record.product_id, val || 0)}
                              style={{ width: '100%', textAlign: 'center' }}
                            />
                          </Col>
                          <Col>
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              disabled={disabled}
                              onClick={() => handleRestockQtyChange(record.product_id, +((qty + step).toFixed(2)))}
                            />
                          </Col>
                        </Row>
                      );
                    },
                  },
                ]}
              />
            </div>
          </Col>
          {orderSummaryVisible && (
            <Col xs={24} lg={10}>
              <div
                id="restock-summary-content"
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid #f0f0f0',
                  paddingLeft: 16,
                }}
              >
                <Typography.Title level={5} style={{ marginTop: 0 }}>Order Summary</Typography.Title>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '35vh' }}>
                  <Table
                    dataSource={lowStockItems.filter((i) => selectedRestockIds.has(i.product_id) && (restockQuantities[i.product_id] || 0) > 0)}
                    rowKey="product_id"
                    pagination={false}
                    size="small"
                    bordered
                    columns={[
                      { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
                      { title: 'Category', dataIndex: 'category', key: 'category' },
                      {
                        title: 'Current Qty', dataIndex: 'quantity', key: 'quantity', width: 80,
                        render: (qty, record) => fmtQty(qty, record.category === FABRIC_CATEGORY),
                      },
                      {
                        title: 'Restock Qty', key: 'restockQty', width: 80,
                        render: (_, record) => fmtQty(restockQuantities[record.product_id] || 0, record.category === FABRIC_CATEGORY),
                      },
                    ]}
                  />
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button style={{ background: '#1677ff', borderColor: '#1677ff', color: '#fff' }} onClick={handlePrintSummary}>
                    Print
                  </Button>
                  <Button danger onClick={() => { setOrderSummaryVisible(false); }}>
                    Cancel
                  </Button>
                  <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} loading={restockSubmitting} onClick={handleConfirmRestock}>
                    Confirm
                  </Button>
                </div>
              </div>
            </Col>
          )}
        </Row>
      </Modal>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #restock-summary-content, #restock-summary-content * { visibility: visible; }
          #restock-summary-content { position: absolute; left: 0; top: 0; width: 100%; }
          .ant-modal-header, .ant-modal-footer { display: none !important; }
          .ant-table-thead > tr > th { background: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      </Card>
    </div>
  );
};

export default StockManagement;
