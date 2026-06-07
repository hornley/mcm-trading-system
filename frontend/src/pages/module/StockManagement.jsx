import { useState, useEffect } from 'react';
import {
  Row, Col, Input, Select, Button, Card, Tag, Typography, message, Spin, Modal, Form, DatePicker, Descriptions, Table, Space,
} from 'antd';
import {
  SearchOutlined, SwapOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { FABRIC_CATEGORY, fmtQty } from '../../utils/format.js';
import QtyInput from '../../components/QtyInput.jsx';

const { Text, Title } = Typography;
const { TextArea } = Input;

const StockManagement = () => {
  const { user, can, selectedLocationId } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [movementsCache, setMovementsCache] = useState({});
  const [sortBy, setSortBy] = useState('product_name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [transferVisible, setTransferVisible] = useState(false);
  const [fromLocationId, setFromLocationId] = useState(null);
  const [transferForm] = Form.useForm();

  const [requestVisible, setRequestVisible] = useState(false);
  const [requestForm] = Form.useForm();
  const [requestLoading, setRequestLoading] = useState(false);

  const [requestLogVisible, setRequestLogVisible] = useState(false);
  const [requestLogs, setRequestLogs] = useState([]);
  const [requestLogLoading, setRequestLogLoading] = useState(false);

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

      const [invRes, locRes] = await Promise.all([
        fetch(`/api/inventory?usertype=${user.usertype}${locationParam}${userIdParam}&page=${p}&limit=${pageSize}${searchParam}${sortParam}`),
        fetch(`/api/locations?usertype=${user.usertype}`),
      ]);
      const invData = await invRes.json();
      const locData = await locRes.json();

      if (invData.success) {
        setInventory(invData.data.data || []);
        setTotalCount(invData.data.total_count || 0);
        setCurrentPage(invData.data.page || p);
      }
      if (locData.success) {
        setLocations(locData.data.filter((l) => l.is_active));
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

  const handleRequestStock = (record) => {
    if (selectedLocationId === "all") {
      message.warning('Select a specific branch from the top bar to request stock');
      return;
    }
    setSelectedRecord(record);
    requestForm.resetFields();
    setRequestVisible(true);
  };

  const handleRequestSubmit = async () => {
    try {
      const values = await requestForm.validateFields();
      setRequestLoading(true);
      const sourceRes = await fetch(`/api/inventory/product/${selectedRecord.product_id}?usertype=${user.usertype}&location_id=${values.from_location_id}&stock_check=1`);
      const sourceData = await sourceRes.json();
      if (sourceData.success) {
        const sourceInv = sourceData.data.find(i => i.location_id === values.from_location_id);
        const sourceQty = sourceInv?.quantity || 0;
        if (Number(sourceQty) < Number(values.quantity)) {
          requestForm.setFields([{
            name: 'from_location_id',
            errors: [`Insufficient stock at this branch (available: ${fmtQty(sourceQty, selectedRecord?.category === FABRIC_CATEGORY)})`],
          }]);
          return;
        }
      }
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
        setRequestVisible(false);
        requestForm.resetFields();
      } else {
        message.error(data.message);
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to submit stock request');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleTransferStock = (record) => {
    setSelectedRecord(record);
    setFromLocationId(record.location_id);
    transferForm.resetFields();
    transferForm.setFieldsValue({ from_location_id: record.location_id });
    setTransferVisible(true);
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

  const fetchRequestLogs = async () => {
    setRequestLogLoading(true);
    try {
      const res = await fetch(`/api/inventory/request-logs?usertype=${user.usertype}&user_id=${user.user_id}`);
      const data = await res.json();
      if (data.success) {
        setRequestLogs(data.data || []);
      }
    } catch {}
    setRequestLogLoading(false);
    setRequestLogVisible(true);
  };

  const showBranch = selectedLocationId === "all";
  const categories = [...new Set(inventory.map(i => i.category).filter(Boolean))];

  const movementColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', sorter: (a, b) => new Date(a.date) - new Date(b.date) },
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
      render: (val) => <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>{val >= 0 ? `+${val}` : val}</span>,
      sorter: (a, b) => a.quantity_change - b.quantity_change,
    },
    { title: 'Location', dataIndex: 'location_name', key: 'location_name', sorter: (a, b) => (a.location_name || '').localeCompare(b.location_name || '') },
    { title: 'Reason / Remarks', dataIndex: 'remarks', key: 'remarks', render: (v) => v || '-', sorter: (a, b) => (a.remarks || '').localeCompare(b.remarks || '') },
  ];

  if (loading && inventory.length === 0) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input.Search
            placeholder="Search products..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => { setCurrentPage(1); fetchData(1); }}
            enterButton
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={sortBy}
            onChange={(val) => { setSortBy(val); fetchData(1, { sortBy: val }); }}
            style={{ width: 150 }}
            options={[
              { value: 'product_name', label: 'Product Name' },
              { value: 'location_name', label: 'Branch' },
            ]}
          />
          <Button
            icon={sortOrder === 'asc' ? <span>&#9650;</span> : <span>&#9660;</span>}
            onClick={() => {
              const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
              setSortOrder(newOrder);
              fetchData(1, { sortOrder: newOrder });
            }}
          />
          <Button onClick={fetchRequestLogs}>
            Request Logs
          </Button>
        </Space>
        <Text style={{ fontSize: 13, color: '#8c8c8c' }}>
          {totalCount} product{totalCount !== 1 ? 's' : ''}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {inventory.map((item) => {
          const isActive = item.is_active !== false;
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={item.inventory_id}>
              <Card
                style={{
                  borderColor: isActive ? '#52c41a' : '#ff4d4f',
                  borderWidth: 2,
                  height: '100%',
                }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>
                  {item.product_name}
                </div>
                {showBranch && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                    {item.location_name}
                  </div>
                )}
                {item.category && (
                  <Tag style={{ fontSize: 11, marginBottom: 8 }}>{item.category}</Tag>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {can('update') && selectedLocationId !== "all" && (
                    <Button size="small" icon={<SwapOutlined />} onClick={() => handleRequestStock(item)}>
                      Request
                    </Button>
                  )}
                  {can('update') && selectedLocationId !== "all" && item.quantity > 0 && (
                    <Button size="small" onClick={() => handleTransferStock(item)}>
                      Transfer
                    </Button>
                  )}
                  <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewDetails(item)}>
                    Details
                  </Button>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {inventory.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Text type="secondary">No products found</Text>
        </div>
      )}

      {totalCount > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space>
            <Button
              disabled={currentPage <= 1}
              onClick={() => fetchData(currentPage - 1)}
            >
              Previous
            </Button>
            <Text style={{ fontSize: 13 }}>
              Page {currentPage} of {Math.ceil(totalCount / pageSize)}
            </Text>
            <Button
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              onClick={() => fetchData(currentPage + 1)}
            >
              Next
            </Button>
          </Space>
        </div>
      )}

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
          <Descriptions.Item label="Current Stock">{fmtQty(selectedRecord?.quantity, selectedRecord?.category === FABRIC_CATEGORY)}</Descriptions.Item>
        </Descriptions>
        <Text strong style={{ marginBottom: 8, display: 'block' }}>
          Stock Movement History
        </Text>
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
        title={`Request Stock - ${selectedRecord?.product_name}`}
        open={requestVisible}
        onCancel={() => { setRequestVisible(false); requestForm.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setRequestVisible(false); requestForm.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" loading={requestLoading} onClick={handleRequestSubmit}>Submit Request</Button>,
        ]}
      >
        <Form form={requestForm} layout="vertical">
          <Text style={{ display: 'block', marginBottom: 16 }}>
            Request stock from another branch to your current location.
          </Text>
          <Form.Item name="from_location_id" label="Source Branch" rules={[{ required: true, message: 'Please select source branch' }]}>
            <Select placeholder="Select branch to request from">
              {locations.filter((loc) => loc.location_id !== selectedLocationId).map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={`Quantity (${selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'})`} required>
            <Form.Item name="quantity" noStyle rules={[{ required: true, message: 'Please enter quantity' }]}>
              <QtyInput isFabric={selectedRecord?.category === FABRIC_CATEGORY} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="remarks" label="Description (optional)">
            <TextArea rows={2} placeholder="Additional notes for the request" />
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
          <Form.Item label={`Quantity (${selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'})`} required>
            <Form.Item name="quantity" noStyle rules={[{ required: true, message: 'Please enter quantity' }]}>
              <QtyInput isFabric={selectedRecord?.category === FABRIC_CATEGORY} max={selectedRecord?.quantity || 1} />
            </Form.Item>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12, marginTop: -16, marginBottom: 16, display: 'block' }}>
            Available: {fmtQty(selectedRecord?.quantity, selectedRecord?.category === FABRIC_CATEGORY)} {selectedRecord?.category === FABRIC_CATEGORY ? 'yards' : 'units'}
          </Text>
          <Form.Item name="date" label="Transfer Date" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks (optional)">
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Request Transfer Log"
        open={requestLogVisible}
        onCancel={() => setRequestLogVisible(false)}
        footer={[<Button key="close" type="primary" onClick={() => setRequestLogVisible(false)}>Close</Button>]}
        width={800}
      >
        <Table
          dataSource={requestLogs}
          rowKey="request_id"
          loading={requestLogLoading}
          size="small"
          bordered
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Branch', key: 'branch', render: (_, r) => `${r.from_location_name} → ${r.to_location_name}` },
            { title: 'Product', dataIndex: 'product_name', key: 'product' },
            { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.is_fabric) },
            { title: 'Date & Time', dataIndex: 'created_at', key: 'created_at', render: (d) => d ? new Date(d).toLocaleString() : '-' },
            {
              title: 'Status', dataIndex: 'status', key: 'status',
              render: (s) => {
                const color = s === 'accepted' ? 'green' : s === 'declined' ? 'red' : 'orange';
                return <Tag color={color}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>;
              },
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default StockManagement;
