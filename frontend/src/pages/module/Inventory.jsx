import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Input, Select, Button,
  Tag, Modal, Form, Space, Popconfirm, InputNumber, Spin,
  Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { FABRIC_CATEGORY, qtyLabel } from '../../utils/format.js';

const { Search } = Input;
const { TextArea } = Input;

const getStockStatus = (qty, reorderLevel) => {
  const n = Number(qty);
  if (n === 0) return { tag: <Tag color="red">Out of Stock</Tag>, color: '#ff4d4f' };
  if (reorderLevel && n <= Number(reorderLevel)) return { tag: <Tag color="orange">Low Stock</Tag>, color: '#fa8c16' };
  if (n <= 10) return { tag: <Tag color="orange">Low Stock</Tag>, color: '#fa8c16' };
  return { tag: <Tag color="green">In Stock</Tag>, color: '#52c41a' };
};

const Inventory = () => {
  const { user, can, selectedLocationId, setSelectedLocationId, setIsStorehouse } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [branchLocations, setBranchLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [productForm] = Form.useForm();
  const [isFabricCategory, setIsFabricCategory] = useState(false);
  const [varieties, setVarieties] = useState([]);

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
      Modal.error({ title: 'Error', content: 'Failed to load data', centered: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedLocationId]);

  useEffect(() => {
    if (user && (user.usertype === 1 || user.usertype === 3)) {
      fetch(`/api/locations?usertype=${user.usertype}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setBranchLocations(data.data.filter((l) => l.is_active));
        })
        .catch(() => {});
    }
  }, [user]);

  const handleAdd = () => {
    setSelectedRecord(null);
    productForm.resetFields();
    setIsFabricCategory(false);
    setVarieties([]);
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
    const cat = categories.find(c => c.category_id === record.category_id);
    setIsFabricCategory(cat?.name === FABRIC_CATEGORY);
    setVarieties((record.varieties || []).map(v => ({ variety_sku: v.variety_sku, pattern: v.pattern || '' })));
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
        Modal.success({ title: 'Success', content: 'Product voided', centered: true });
        fetchData();
      } else {
        Modal.error({ title: 'Error', content: data.message, centered: true });
      }
    } catch {
      Modal.error({ title: 'Error', content: 'Failed to void product', centered: true });
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
        Modal.success({ title: 'Success', content: 'Product restored', centered: true });
        fetchData();
      } else {
        Modal.error({ title: 'Error', content: data.message, centered: true });
      }
    } catch {
      Modal.error({ title: 'Error', content: 'Failed to restore product', centered: true });
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
        Modal.success({ title: 'Success', content: 'Product deleted', centered: true });
        fetchData();
      } else {
        Modal.error({ title: 'Error', content: data.message, centered: true });
      }
    } catch {
      Modal.error({ title: 'Error', content: 'Failed to delete product', centered: true });
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
        body: JSON.stringify({
          ...values,
          usertype: user.usertype,
          user_id: user.user_id,
          varieties: isFabricCategory ? varieties.map(v => ({ pattern: v.pattern, variety_sku: v.variety_sku })) : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        Modal.success({ title: 'Success', content: isEdit ? 'Product updated' : 'Product created', centered: true });
        setProductModalVisible(false);
        productForm.resetFields();
        setIsFabricCategory(false);
        setVarieties([]);
        fetchData();
      } else {
        Modal.error({ title: 'Error', content: data.message, centered: true });
      }
    } catch {
      if (!selectedRecord) Modal.error({ title: 'Error', content: 'Failed to save product', centered: true });
    }
  };

  const filteredProducts = products
    .filter((p) => {
      if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return 0;
    });

  if (loading) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={14}>
          <Space wrap>
            <Search
              placeholder="Search by product name"
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            {user && (user.usertype === 1 || user.usertype === 3) && (
              <Dropdown
                menu={{
                  items: [
                    { key: 'all', label: 'All Locations' },
                    ...branchLocations.map(loc => ({ key: String(loc.location_id), label: loc.name })),
                  ],
                  onClick: ({ key }) => {
                    if (key === 'all') {
                      setSelectedLocationId('all');
                      setIsStorehouse(false);
                    } else {
                      setSelectedLocationId(Number(key));
                      const loc = branchLocations.find(l => l.location_id === Number(key));
                      setIsStorehouse(loc ? loc.is_storehouse : false);
                    }
                  },
                }}
              >
                <Button type={selectedLocationId !== 'all' ? 'primary' : 'default'}>
                  {selectedLocationId !== 'all'
                    ? (branchLocations.find(l => l.location_id === Number(selectedLocationId))?.name || 'Branch')
                    : 'All Locations'}
                </Button>
              </Dropdown>
            )}
            {categories.map((cat) => {
              const active = categoryFilter === cat.category_id;
              return (
                <Button
                  key={cat.category_id}
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
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                {product.category === FABRIC_CATEGORY ? 'yards' : (product.unit || '-')}
              </div>
              {product.quantity != null ? (
                <Space style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: getStockStatus(product.quantity, product.reorder_level).color }}>
                    {qtyLabel(product.quantity)}
                  </span>
                  {getStockStatus(product.quantity, product.reorder_level).tag}
                </Space>
              ) : (
                <div style={{ fontSize: 12, color: '#595959', marginBottom: 8 }}>
                  Stock: -
                </div>
              )}

              {product.varieties && product.varieties.length > 0 && (
                <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {product.varieties.map((v) => (
                    <div key={v.variety_id} title={`${v.color || ''} ${v.pattern || ''}`.trim()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 10, border: '1px solid #d9d9d9',
                        fontSize: 11, background: '#fafafa',
                      }}
                    >
                      {v.color && (
                        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: v.color, display: 'inline-block', border: '1px solid #d9d9d9' }} />
                      )}
                      <span>{v.pattern || v.color || '-'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {can('update') && product.is_active && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(product)}>
                    Edit
                  </Button>
                )}
                {can('update') && product.is_active && (
                  <Popconfirm
                    title="Void this product?"
                    onConfirm={() => handleVoid(product)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button size="small" danger>Void</Button>
                  </Popconfirm>
                )}
                {can('update') && !product.is_active && (
                  <Button size="small" style={{ borderColor: '#52c41a', color: '#52c41a' }} onClick={() => handleRestore(product)}>
                    Return
                  </Button>
                )}
                {can('update') && !product.is_active && (
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
        onCancel={() => { setProductModalVisible(false); productForm.resetFields(); setIsFabricCategory(false); setVarieties([]); }}
        centered
        width={520}
        footer={[
          <Button key="cancel" onClick={() => { setProductModalVisible(false); productForm.resetFields(); setIsFabricCategory(false); setVarieties([]); }}>Cancel</Button>,
          <Button key="save" type="primary" onClick={handleSaveProduct}>Save</Button>,
        ]}
      >
        <Form
          form={productForm}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if ('category_id' in changedValues) {
              const cat = categories.find(c => c.category_id === changedValues.category_id);
              setIsFabricCategory(cat?.name === FABRIC_CATEGORY);
              if (cat?.name !== FABRIC_CATEGORY) setVarieties([]);
            }
          }}
        >
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

          {isFabricCategory && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Varieties</div>
              {varieties.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="Pattern (e.g. Solid, Striped, Floral)"
                    value={v.pattern || ''}
                    onChange={(e) => {
                      const next = [...varieties];
                      next[i] = { ...next[i], pattern: e.target.value };
                      setVarieties(next);
                    }}
                    style={{ flex: 1 }}
                    size="small"
                  />
                  <Input
                    placeholder="Variety SKU"
                    value={v.variety_sku || ''}
                    onChange={(e) => {
                      const next = [...varieties];
                      next[i] = { ...next[i], variety_sku: e.target.value };
                      setVarieties(next);
                    }}
                    style={{ width: 140 }}
                    size="small"
                  />
                  <CloseOutlined
                    style={{ color: '#ff4d4f', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => setVarieties(varieties.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setVarieties([...varieties, { pattern: '', variety_sku: '' }])}
              >
                Add Variety
              </Button>
            </div>
          )}

          {!selectedRecord && (
            <Form.Item name="sku" label="SKU">
              <Input placeholder="Auto-generated if empty" />
            </Form.Item>
          )}
          <Form.Item name="price" label="Base Price" rules={[{ required: true, message: 'Please enter price' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter price" prefix="₱" />
          </Form.Item>
          <Form.Item name="unit" label="Unit">
            <Select placeholder="Select unit" allowClear>
              <Select.Option value="piece">Piece</Select.Option>
              <Select.Option value="meter">Meter</Select.Option>
              <Select.Option value="yard">Yard</Select.Option>
              <Select.Option value="kilogram">Kilogram</Select.Option>
              <Select.Option value="pack">Pack</Select.Option>
              <Select.Option value="box">Box</Select.Option>
            </Select>
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
