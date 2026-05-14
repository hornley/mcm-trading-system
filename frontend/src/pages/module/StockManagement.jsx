import { useState } from 'react';
import {
  Table,
  Card,
  Typography,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Modal,
  Statistic,
  Space,
  Descriptions,
  Form,
  InputNumber,
  DatePicker,
  message,
} from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;
const { Search, TextArea } = Input;

const today = () => new Date().toISOString().split('T')[0];

const getStockStatus = (qty) => {
  if (qty === 0) return { tag: <Tag color="red">Out of Stock</Tag>, label: 'out' };
  if (qty <= 10) return { tag: <Tag color="orange">Low Stock</Tag>, label: 'low' };
  return { tag: <Tag color="green">In Stock</Tag>, label: 'in' };
};

const adjustmentReasons = ['Restock', 'Damaged', 'Correction', 'Sample', 'Sales Return'];

const mockStock = [
  { key: '1', name: 'FELT HARD 1', category: 'Textiles', subcategory: 'Felt', branch: 'Main Store', stockQuantity: 25, price: 120, lastRestocked: '2025-11-15', movements: [{ date: '2025-11-15', qtyIn: 20, qtyOut: 5, remarks: 'Initial stock' }, { date: '2025-12-01', qtyIn: 10, qtyOut: 0, remarks: 'Restock' }] },
  { key: '2', name: 'FELT HARD 2', category: 'Textiles', subcategory: 'Felt', branch: 'Storehouse', stockQuantity: 30, price: 130, lastRestocked: '2025-10-20', movements: [{ date: '2025-10-20', qtyIn: 30, qtyOut: 0, remarks: 'Initial stock' }] },
  { key: '3', name: 'FLEECE', category: 'Textiles', subcategory: 'Fleece', branch: 'Main Store', stockQuantity: 8, price: 180, lastRestocked: '2025-09-10', movements: [{ date: '2025-09-10', qtyIn: 15, qtyOut: 7, remarks: 'Sales' }] },
  { key: '4', name: 'HI-PILE', category: 'Textiles', subcategory: 'Plush', branch: 'Main Store', stockQuantity: 0, price: 250, lastRestocked: '2025-08-01', movements: [{ date: '2025-08-01', qtyIn: 10, qtyOut: 10, remarks: 'Sold out' }] },
  { key: '5', name: '8MM AND 20MM PLUSH', category: 'Textiles', subcategory: 'Plush', branch: 'Storehouse', stockQuantity: 12, price: 220, lastRestocked: '2025-10-05', movements: [{ date: '2025-10-05', qtyIn: 12, qtyOut: 0, remarks: 'Restock' }] },
  { key: '6', name: '3MM PRINTED FUR', category: 'Textiles', subcategory: 'Fur', branch: 'Main Store', stockQuantity: 5, price: 280, lastRestocked: '2025-07-22', movements: [{ date: '2025-07-22', qtyIn: 10, qtyOut: 5, remarks: 'Sales and transfers' }] },
  { key: '7', name: 'VELBOA KOREA', category: 'Textiles', subcategory: 'Velboa', branch: 'Storehouse', stockQuantity: 6, price: 350, lastRestocked: '2025-11-01', movements: [{ date: '2025-11-01', qtyIn: 10, qtyOut: 4, remarks: 'Distribution to branches' }] },
  { key: '8', name: 'VELVET 1', category: 'Textiles', subcategory: 'Velvet', branch: 'Main Store', stockQuantity: 18, price: 160, lastRestocked: '2025-10-15', movements: [{ date: '2025-10-15', qtyIn: 18, qtyOut: 0, remarks: 'Restock' }] },
  { key: '9', name: 'SUEDE GAMOSA', category: 'Textiles', subcategory: 'Suede', branch: 'Storehouse', stockQuantity: 0, price: 200, lastRestocked: '2025-06-30', movements: [{ date: '2025-06-30', qtyIn: 10, qtyOut: 10, remarks: 'Sold out' }] },
  { key: '10', name: 'FEATHERS', category: 'Textiles', subcategory: 'Decor', branch: 'Main Store', stockQuantity: 50, price: 50, lastRestocked: '2025-12-01', movements: [{ date: '2025-12-01', qtyIn: 30, qtyOut: 0, remarks: 'New shipment' }, { date: '2025-12-10', qtyIn: 20, qtyOut: 0, remarks: 'Additional stock' }] },
];

const StockManagement = () => {
  const { can } = useAuth();
  const [detailVisible, setDetailVisible] = useState(false);
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [adjustForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const handleViewDetails = (record) => {
    setSelectedItem(record);
    setDetailVisible(true);
  };

  const handleAdjustStock = (record) => {
    setSelectedItem(record);
    adjustForm.setFieldsValue({ branch: record.branch });
    setAdjustVisible(true);
  };

  const handleTransferStock = (record) => {
    setSelectedItem(record);
    transferForm.resetFields();
    setTransferVisible(true);
  };

  const handleAdjustSave = () => {
    adjustForm.validateFields().then((values) => {
      const isIncrease = values.adjustmentType === 'in';
      const newQty = isIncrease
        ? selectedItem.stockQuantity + values.quantity
        : Math.max(0, selectedItem.stockQuantity - values.quantity);
      const today = today();
      const idx = mockStock.findIndex((s) => s.key === selectedItem.key);
      if (idx !== -1) {
        mockStock[idx] = {
          ...mockStock[idx],
          stockQuantity: newQty,
          lastRestocked: today,
          movements: [
            ...mockStock[idx].movements,
            {
              date: today,
              qtyIn: isIncrease ? values.quantity : 0,
              qtyOut: isIncrease ? 0 : values.quantity,
              remarks: `${values.reason}${values.remarks ? ': ' + values.remarks : ''}`,
            },
          ],
        };
      }
      message.success(`Stock adjusted for ${selectedItem.name}`);
      setAdjustVisible(false);
      adjustForm.resetFields();
    });
  };

  const handleTransferSave = () => {
    transferForm.validateFields().then((values) => {
      const fromBranch = values.fromBranch;
      const toBranch = values.toBranch;
      const qty = values.quantity;
      const today = today();
      const selectedIdx = mockStock.findIndex((s) => s.key === selectedItem.key);
      if (selectedIdx !== -1) {
        const sourceItem = mockStock.find((s) => s.name === selectedItem.name && s.branch === fromBranch);
        const destItem = mockStock.find((s) => s.name === selectedItem.name && s.branch === toBranch);
        if (sourceItem) {
          sourceItem.stockQuantity = Math.max(0, sourceItem.stockQuantity - qty);
          sourceItem.movements.push({ date: today, qtyIn: 0, qtyOut: qty, remarks: `Transfer to ${toBranch}${values.remarks ? ': ' + values.remarks : ''}` });
        }
        if (destItem) {
          destItem.stockQuantity += qty;
          destItem.movements.push({ date: today, qtyIn: qty, qtyOut: 0, remarks: `Transfer from ${fromBranch}${values.remarks ? ': ' + values.remarks : ''}` });
        }
      }
      message.success(`Transfer of ${selectedItem.name} from ${values.fromBranch} to ${values.toBranch} recorded`);
      setTransferVisible(false);
      transferForm.resetFields();
    });
  };

  const filteredData = mockStock.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesBranch = branchFilter && branchFilter !== 'All' ? item.branch === branchFilter : true;
    return matchesSearch && matchesBranch;
  });

  const filteredTotal = filteredData.length;
  const filteredLowStock = filteredData.filter((s) => s.stockQuantity > 0 && s.stockQuantity <= 10).length;
  const filteredOutOfStock = filteredData.filter((s) => s.stockQuantity === 0).length;

  const columns = [
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Subcategory', dataIndex: 'subcategory', key: 'subcategory' },
    { title: 'Branch', dataIndex: 'branch', key: 'branch' },
    { title: 'Current Stock Quantity', dataIndex: 'stockQuantity', key: 'stockQuantity' },
    { title: 'Price per Measurement', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
    {
      title: 'Stock Status',
      dataIndex: 'stockQuantity',
      key: 'stockStatus',
      render: (qty) => getStockStatus(qty).tag,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {can('update') && (
            <Button type="link" onClick={() => handleAdjustStock(record)}>
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
    { title: 'Quantity In', dataIndex: 'qtyIn', key: 'qtyIn' },
    { title: 'Quantity Out', dataIndex: 'qtyOut', key: 'qtyOut' },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
  ];

  return (
    <Card style={{ margin: 24 }}>
      <Title level={2}>Stock Management</Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Stock Items" value={filteredTotal} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={filteredLowStock}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Out of Stock Items"
              value={filteredOutOfStock}
              valueStyle={{ color: '#cf1322' }}
            />
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
            <Select
              placeholder="Filter by branch"
              style={{ width: 180 }}
              allowClear
              value={branchFilter}
              onChange={setBranchFilter}
            >
              <Select.Option value="All">All Branches</Select.Option>
              <Select.Option value="Main Store">Main Store</Select.Option>
              <Select.Option value="Storehouse">Storehouse</Select.Option>
            </Select>
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="key"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`${selectedItem?.name} - Stock Details`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailVisible(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Product Name">{selectedItem?.name}</Descriptions.Item>
          <Descriptions.Item label="Branch">{selectedItem?.branch}</Descriptions.Item>
          <Descriptions.Item label="Category">{selectedItem?.category}</Descriptions.Item>
          <Descriptions.Item label="Subcategory">{selectedItem?.subcategory}</Descriptions.Item>
          <Descriptions.Item label="Current Stock Quantity">{selectedItem?.stockQuantity}</Descriptions.Item>
          <Descriptions.Item label="Price per Measurement">₱{selectedItem?.price}</Descriptions.Item>
          <Descriptions.Item label="Last Restocked" span={2}>
            {selectedItem?.lastRestocked}
          </Descriptions.Item>
        </Descriptions>

        <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
          Stock Movement History
        </Typography.Text>
        <Table
          dataSource={selectedItem?.movements || []}
          columns={movementColumns}
          rowKey="date"
          size="small"
          pagination={false}
          bordered
        />
      </Modal>

      <Modal
        title={`Adjust Stock - ${selectedItem?.name}`}
        open={adjustVisible}
        onCancel={() => setAdjustVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAdjustVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleAdjustSave}>Save</Button>,
        ]}
      >
        <Form form={adjustForm} layout="vertical">
          <Form.Item
            name="branch"
            label="Branch"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="Main Store">Main Store</Select.Option>
              <Select.Option value="Storehouse">Storehouse</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="adjustmentType"
            label="Adjustment Type"
            rules={[{ required: true, message: 'Please select adjustment type' }]}
          >
            <Select placeholder="Select type">
              <Select.Option value="in">Stock In (+)</Select.Option>
              <Select.Option value="out">Stock Out (-)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Please select a reason' }]}
          >
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
        title={`Transfer Stock - ${selectedItem?.name}`}
        open={transferVisible}
        onCancel={() => setTransferVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setTransferVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleTransferSave}>Save</Button>,
        ]}
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item
            name="fromBranch"
            label="From Branch"
            rules={[{ required: true, message: 'Please select source branch' }]}
          >
            <Select placeholder="Select source branch">
              <Select.Option value="Main Store">Main Store</Select.Option>
              <Select.Option value="Storehouse">Storehouse</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="toBranch"
            label="To Branch"
            rules={[{ required: true, message: 'Please select destination branch' }]}
          >
            <Select placeholder="Select destination branch">
              <Select.Option value="Main Store">Main Store</Select.Option>
              <Select.Option value="Storehouse">Storehouse</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Form.Item
            name="date"
            label="Transfer Date"
            rules={[{ required: true, message: 'Please select date' }]}
          >
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