import { useState } from 'react';
import {
  Table,
  Card,
  Typography,
  Tabs,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Modal,
  Form,
  Space,
  Popconfirm,
  InputNumber,
} from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;
const { Search } = Input;

const mockProducts = [
  { key: '1', name: 'FELT HARD 1', category: 'Textiles', subcategory: 'Felt', stockQuantity: 25, price: 120, reorderLevel: '10', status: 'active' },
  { key: '2', name: 'FELT HARD 2', category: 'Textiles', subcategory: 'Felt', stockQuantity: 30, price: 130, reorderLevel: '10', status: 'active' },
  { key: '3', name: 'FLEECE', category: 'Textiles', subcategory: 'Fleece', stockQuantity: 15, price: 180, reorderLevel: '8', status: 'active' },
  { key: '4', name: 'HI-PILE', category: 'Textiles', subcategory: 'Plush', stockQuantity: 10, price: 250, reorderLevel: '5', status: 'active' },
  { key: '5', name: '12MM CIRCULAR', category: 'Textiles', subcategory: 'Plush', stockQuantity: 20, price: 200, reorderLevel: '10', status: 'active' },
  { key: '6', name: '8MM AND 20MM PLUSH', category: 'Textiles', subcategory: 'Plush', stockQuantity: 12, price: 220, reorderLevel: '8', status: 'active' },
  { key: '7', name: '7MM AND 20MM PLUSH', category: 'Textiles', subcategory: 'Plush', stockQuantity: 8, price: 230, reorderLevel: '8', status: 'active' },
  { key: '8', name: '3MM PRINTED FUR', category: 'Textiles', subcategory: 'Fur', stockQuantity: 5, price: 280, reorderLevel: '5', status: 'active' },
  { key: '9', name: 'SHAGGY FUR', category: 'Textiles', subcategory: 'Fur', stockQuantity: 7, price: 300, reorderLevel: '5', status: 'active' },
  { key: '10', name: 'NYLEX 220G', category: 'Textiles', subcategory: 'Nylex', stockQuantity: 40, price: 90, reorderLevel: '15', status: 'active' },
  { key: '11', name: 'VELBOA KOREA', category: 'Textiles', subcategory: 'Velboa', stockQuantity: 6, price: 350, reorderLevel: '5', status: 'active' },
  { key: '12', name: 'LAMB FUR 2323', category: 'Textiles', subcategory: 'Fur', stockQuantity: 3, price: 400, reorderLevel: '3', status: 'active' },
  { key: '13', name: 'VELVET 1', category: 'Textiles', subcategory: 'Velvet', stockQuantity: 18, price: 160, reorderLevel: '10', status: 'active' },
  { key: '14', name: 'VELVET 2', category: 'Textiles', subcategory: 'Velvet', stockQuantity: 22, price: 170, reorderLevel: '10', status: 'active' },
  { key: '15', name: 'VELBOA SUPER SOFT', category: 'Textiles', subcategory: 'Velboa', stockQuantity: 4, price: 380, reorderLevel: '5', status: 'active' },
  { key: '16', name: 'PRINTED DESIGN', category: 'Textiles', subcategory: 'Printed', stockQuantity: 15, price: 150, reorderLevel: '10', status: 'active' },
  { key: '17', name: 'SUEDE GAMOSA', category: 'Textiles', subcategory: 'Suede', stockQuantity: 10, price: 200, reorderLevel: '8', status: 'active' },
  { key: '18', name: 'NEON WOVEN CLOTH', category: 'Textiles', subcategory: 'Woven', stockQuantity: 35, price: 100, reorderLevel: '15', status: 'active' },
  { key: '19', name: 'FEATHERS', category: 'Textiles', subcategory: 'Decor', stockQuantity: 50, price: 50, reorderLevel: '20', status: 'active' },
];

const subcategories = ['Felt', 'Fleece', 'Plush', 'Fur', 'Nylex', 'Velboa', 'Velvet', 'Printed', 'Suede', 'Woven', 'Decor'];

const Inventory = () => {
  const { can } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setSelectedRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleVoid = (record) => {
    console.log('Void product:', record);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      console.log('Save:', selectedRecord ? { ...selectedRecord, ...values } : values);
      setModalVisible(false);
      form.resetFields();
    });
  };

  const columns = [
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Subcategory', dataIndex: 'subcategory', key: 'subcategory' },
    { title: 'Stock Quantity', dataIndex: 'stockQuantity', key: 'stockQuantity' },
    { title: 'Base Price', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
    { title: 'Reorder Level', dataIndex: 'reorderLevel', key: 'reorderLevel' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? 'Active' : 'Voided'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {can('update') && (
            <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          )}
          {can('delete') && (
            <Popconfirm
              title="Are you sure you want to void this product?"
              onConfirm={() => handleVoid(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger>Void</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const Toolbar = ({ onSearch }) => (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} md={14}>
        <Space wrap>
          <Search
            placeholder="Search by product name"
            onSearch={onSearch}
            enterButton
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by subcategory"
            style={{ width: 180 }}
            allowClear
          >
            {subcategories.map((sub) => (
              <Select.Option key={sub} value={sub}>{sub}</Select.Option>
            ))}
          </Select>
        </Space>
      </Col>
      <Col xs={24} sm={12} md={10} style={{ textAlign: 'right' }}>
        {can('create') && (
          <Button type="primary" onClick={handleAdd}>
            Add Product
          </Button>
        )}
      </Col>
    </Row>
  );

  const items = [
    {
      key: 'textiles',
      label: 'Textiles',
      children: (
        <>
          <Toolbar />
          <Table
            dataSource={mockProducts}
            columns={columns}
            rowKey="key"
            pagination={{ pageSize: 10 }}
          />
        </>
      ),
    },
  ];

  return (
    <Card style={{ margin: 24 }}>
      <Title level={2}>Inventory</Title>
      <Tabs items={items} />
      <Modal
        title={selectedRecord ? 'Edit Product' : 'Add Product'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSave}>Save</Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="Enter product name" />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              <Select.Option value="Textiles">Textiles</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="subcategory"
            label="Subcategory"
            rules={[{ required: true, message: 'Please select subcategory' }]}
          >
            <Select placeholder="Select subcategory">
              {subcategories.map((sub) => (
                <Select.Option key={sub} value={sub}>{sub}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="stockQuantity"
            label="Stock Quantity"
            rules={[{ required: true, message: 'Please enter stock quantity' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter stock quantity" />
          </Form.Item>
          <Form.Item
            name="price"
            label="Base Price"
            rules={[{ required: true, message: 'Please enter price' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter price" prefix="₱" />
          </Form.Item>
          <Form.Item
            name="reorderLevel"
            label="Reorder Level"
            rules={[{ required: true, message: 'Please enter reorder level' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter reorder level" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Inventory;