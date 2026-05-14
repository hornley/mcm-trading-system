import { useState, useEffect } from 'react';
import {
  Table, Card, Typography, Tabs, Row, Col, Input, Select, Button,
  Tag, Modal, Form, Space, Popconfirm, InputNumber, message, Spin, Radio,
} from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;
const { Search } = Input;
const { TextArea } = Input;

const Inventory = () => {
  const { user, can } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [productForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const fetchData = async () => {
    if (!user) return;
    setTableLoading(true);
    try {
      const [productsRes, categoriesRes, inventoryRes, locationsRes] = await Promise.all([
        fetch(`/api/products?usertype=${user.usertype}`),
        fetch(`/api/categories?usertype=${user.usertype}`),
        fetch(`/api/inventory?usertype=${user.usertype}`),
        fetch(`/api/locations?usertype=${user.usertype}`),
      ]);
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      const inventoryData = await inventoryRes.json();
      const locationsData = await locationsRes.json();

      if (productsData.success) setProducts(productsData.data);
      if (categoriesData.success) setCategories(categoriesData.data);
      if (locationsData.success) setLocations(locationsData.data);
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
    productForm.resetFields();
    setProductModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedRecord(record);
    productForm.setFieldsValue({
      name: record.name,
      category_id: record.category_id,
      price: record.price,
      unit: record.unit,
      reorder_level: record.reorder_level,
      description: record.description,
    });
    setProductModalVisible(true);
  };

  const handleAdjust = (record) => {
    setAdjustProduct(record);
    adjustForm.resetFields();
    adjustForm.setFieldsValue({ direction: 'add' });
    setAdjustModalVisible(true);
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

  const handleSaveProduct = async () => {
    try {
      const values = await productForm.validateFields();
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
        setProductModalVisible(false);
        productForm.resetFields();
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      if (!selectedRecord) message.error('Failed to save product');
    }
  };

  const handleSaveAdjust = async () => {
    try {
      const values = await adjustForm.validateFields();
      const quantityChange = values.direction === 'remove'
        ? -Math.abs(values.quantity)
        : Math.abs(values.quantity);

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertype: user.usertype,
          user_id: user.user_id,
          product_id: adjustProduct.product_id,
          location_id: values.location_id,
          quantity_change: quantityChange,
          reason: values.reason || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Stock adjusted');
        setAdjustModalVisible(false);
        adjustForm.resetFields();
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to adjust stock');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  const columns = [
    { title: 'Product Name', dataIndex: 'name', key: 'name' },
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
          {can('update') && record.is_active && (
            <Button type="link" onClick={() => handleAdjust(record)}>Adjust</Button>
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
            placeholder="Search by product name"
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
        open={productModalVisible}
        onCancel={() => { setProductModalVisible(false); productForm.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setProductModalVisible(false); productForm.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSaveProduct}>Save</Button>,
        ]}
      >
        <Form form={productForm} layout="vertical">
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
          {!selectedRecord && (
            <Form.Item name="sku" label="SKU">
              <Input placeholder="Auto-generated if empty" />
            </Form.Item>
          )}
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
            <TextArea rows={3} placeholder="Enter description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={adjustProduct ? `Adjust Stock — ${adjustProduct.name}` : 'Adjust Stock'}
        open={adjustModalVisible}
        onCancel={() => { setAdjustModalVisible(false); adjustForm.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setAdjustModalVisible(false); adjustForm.resetFields(); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSaveAdjust}>Save</Button>,
        ]}
      >
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="location_id" label="Location" rules={[{ required: true, message: 'Please select location' }]}>
            <Select placeholder="Select location">
              {locations.filter((l) => l.is_active).map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="direction" label="Direction">
            <Radio.Group>
              <Radio value="add">Add Stock</Radio>
              <Radio value="remove">Remove Stock</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: 'Please enter quantity' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input placeholder="e.g. New shipment, Damaged goods" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Inventory;
