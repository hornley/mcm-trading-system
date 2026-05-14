import { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Tabs, Row, Col, Input, Select, Button,
  Tag, Modal, Form, Space, Popconfirm, InputNumber, message, Spin,
} from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;
const { Search } = Input;

const Inventory = () => {
  const { user, can } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    if (!user) return;
    setTableLoading(true);
    try {
      const [productsRes, categoriesRes, inventoryRes] = await Promise.all([
        fetch(`/api/products?usertype=${user.usertype}`),
        fetch(`/api/categories?usertype=${user.usertype}`),
        fetch(`/api/inventory?usertype=${user.usertype}`),
      ]);
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      const inventoryData = await inventoryRes.json();

      if (productsData.success) setProducts(productsData.data);
      if (categoriesData.success) setCategories(categoriesData.data);
      if (inventoryData.success) {
        const map = {};
        inventoryData.data.forEach((inv) => {
          if (!map[inv.product_id]) map[inv.product_id] = [];
          map[inv.product_id].push(inv);
        });
        setInventoryMap(map);
      }
    } catch {
      message.error('Failed to load data');
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const totalStock = (productId) => {
    const invs = inventoryMap[productId];
    if (!invs) return 0;
    return invs.reduce((sum, inv) => sum + inv.quantity, 0);
  };

  const handleAdd = () => {
    setSelectedRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    form.setFieldsValue({
      name: record.name,
      category_id: record.category_id,
      price: record.price,
      sku: record.sku,
      unit: record.unit,
      reorder_level: record.reorder_level,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleVoid = async (record) => {
    try {
      const res = await fetch(`/api/products/${record.product_id}/void`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype, user_id: user.user_id }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Product voided');
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to void product');
    }
  };

  const handleDelete = async (record) => {
    try {
      const res = await fetch(`/api/products/${record.product_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype, user_id: user.user_id }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Product deleted');
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to delete product');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const isEdit = !!selectedRecord;
      const url = isEdit ? `/api/products/${selectedRecord.product_id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, usertype: user.usertype, user_id: user.user_id }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(isEdit ? 'Product updated' : 'Product created');
        setModalVisible(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      if (!selectedRecord) message.error('Failed to save product');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase()) && !p.sku?.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  const columns = [
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Stock Quantity', key: 'stockQuantity',
      render: (_, record) => totalStock(record.product_id),
    },
    { title: 'Base Price', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
    { title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level' },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Voided'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {can('update') && record.is_active && (
            <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          )}
          {can('delete') && record.is_active && (
            <Popconfirm
              title="Are you sure you want to void this product?"
              onConfirm={() => handleVoid(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger>Void</Button>
            </Popconfirm>
          )}
          {can('delete') && !record.is_active && (
            <Popconfirm
              title="Permanently delete this product?"
              onConfirm={() => handleDelete(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="link" danger>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const Toolbar = () => (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} md={14}>
        <Space wrap>
          <Search
            placeholder="Search by name or SKU"
            onSearch={(val) => setSearchText(val)}
            onChange={(e) => { if (!e.target.value) setSearchText(''); }}
            enterButton
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by category"
            style={{ width: 180 }}
            allowClear
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
          >
            {categories.map((cat) => (
              <Select.Option key={cat.category_id} value={cat.category_id}>{cat.name}</Select.Option>
            ))}
          </Select>
        </Space>
      </Col>
      <Col xs={24} sm={12} md={10} style={{ textAlign: 'right' }}>
        {can('create') && (
          <Button type="primary" onClick={handleAdd}>Add Product</Button>
        )}
      </Col>
    </Row>
  );

  if (loading) return <Card style={{ margin: 24, textAlign: 'center' }}><Spin size="large" /></Card>;

  const items = [
    {
      key: 'products',
      label: 'Products',
      children: (
        <>
          <Toolbar />
          <Table
            dataSource={filteredProducts}
            columns={columns}
            rowKey="product_id"
            pagination={{ pageSize: 10 }}
            loading={tableLoading}
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
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setModalVisible(false); form.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSave}>Save</Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Please enter product name' }]}>
            <Input placeholder="Enter product name" />
          </Form.Item>
          <Form.Item name="category_id" label="Category" rules={[{ required: true, message: 'Please select category' }]}>
            <Select placeholder="Select category">
              {categories.map((cat) => (
                <Select.Option key={cat.category_id} value={cat.category_id}>{cat.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="sku" label="SKU">
            <Input placeholder="Auto-generated if empty" />
          </Form.Item>
          <Form.Item name="price" label="Base Price" rules={[{ required: true, message: 'Please enter price' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter price" prefix="₱" />
          </Form.Item>
          <Form.Item name="unit" label="Unit">
            <Input placeholder="e.g. piece, meter" />
          </Form.Item>
          <Form.Item name="reorder_level" label="Reorder Level">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter reorder level" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Enter description" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Inventory;
