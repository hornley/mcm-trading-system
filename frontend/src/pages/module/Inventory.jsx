import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Input, Select, Button,
  Tag, Modal, Form, Space, Popconfirm, InputNumber, message, Spin,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { FABRIC_CATEGORY } from '../../utils/format.js';

const { Search } = Input;
const { TextArea } = Input;

const Inventory = () => {
  const { user, can, selectedLocationId } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [productForm] = Form.useForm();

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const locationParam = selectedLocationId !== "all" ? `&location_id=${selectedLocationId}` : '';
      const userIdParam = `&user_id=${user.user_id}`;

      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/products?usertype=${user.usertype}${locationParam}${userIdParam}`),
        fetch(`/api/categories?usertype=${user.usertype}`),
      ]);
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      if (productsData.success) setProducts(productsData.data);
      if (categoriesData.success) setCategories(categoriesData.data);
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedLocationId]);

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
      description: record.description,
    });
    setProductModalVisible(true);
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

  const handleRestore = async (record) => {
    try {
      const res = await fetch(`/api/products/${record.product_id}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype, user_id: user.user_id }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Product restored');
        fetchData();
      } else {
        message.error(data.message);
      }
    } catch {
      message.error('Failed to restore product');
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

  const filteredProducts = products.filter((p) => {
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  if (loading) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
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
            {categories.map((cat) => {
              const active = categoryFilter === cat.category_id;
              return (
                <Button
                  key={cat.category_id}
                  size="small"
                  type={active ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter(active ? null : cat.category_id)}
                >
                  {cat.name}
                </Button>
              );
            })}
          </Space>
        </Col>
        <Col xs={24} sm={12} md={10} style={{ textAlign: 'right' }}>
          {can('create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Product</Button>
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {filteredProducts.map((product) => (
          <Col xs={24} sm={12} md={8} lg={6} key={product.product_id}>
            <Card
              style={{
                borderColor: product.is_active ? '#52c41a' : '#ff4d4f',
                borderWidth: 2,
                height: '100%',
              }}
              styles={{ body: { padding: 16 } }}
            >
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>
                {product.name}
              </div>
              {product.category && (
                <Tag style={{ fontSize: 11, marginBottom: 6 }}>{product.category}</Tag>
              )}
              <div style={{ fontSize: 13, color: '#52c41a', fontWeight: 600, marginBottom: 4 }}>
                ₱{product.price}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                {product.category === FABRIC_CATEGORY ? 'yards' : (product.unit || '-')}
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {can('update') && product.is_active && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(product)}>
                    Edit
                  </Button>
                )}
                {can('delete') && product.is_active && (
                  <Popconfirm
                    title="Void this product?"
                    onConfirm={() => handleVoid(product)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button size="small" danger>Void</Button>
                  </Popconfirm>
                )}
                {can('delete') && !product.is_active && (
                  <Button size="small" style={{ borderColor: '#52c41a', color: '#52c41a' }} onClick={() => handleRestore(product)}>
                    Return
                  </Button>
                )}
                {can('delete') && !product.is_active && (
                  <Popconfirm
                    title="Permanently delete this product?"
                    onConfirm={() => handleDelete(product)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button size="small" danger>Delete</Button>
                  </Popconfirm>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {filteredProducts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Typography.Text type="secondary">No products found</Typography.Text>
        </div>
      )}

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
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Enter description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
