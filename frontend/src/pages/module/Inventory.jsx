import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Input, Select, Button,
  Tag, Modal, Form, Space, Popconfirm, InputNumber, Spin,
  Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { FABRIC_CATEGORY, qtyLabel } from '../../utils/format.js';
import ColorPickerModal from '../../components/ColorPickerModal.jsx';

const { Search } = Input;
const { TextArea } = Input;

const NAMED_COLORS = {
  '#000000': 'Black', '#FFFFFF': 'White', '#FF0000': 'Red', '#00FF00': 'Green',
  '#0000FF': 'Blue', '#FFFF00': 'Yellow', '#FF00FF': 'Magenta', '#00FFFF': 'Cyan',
  '#C0C0C0': 'Silver', '#808080': 'Gray', '#800000': 'Maroon', '#808000': 'Olive',
  '#008000': 'Dark Green', '#800080': 'Purple', '#008080': 'Teal', '#000080': 'Navy',
  '#FF4500': 'Orange Red', '#FF6347': 'Tomato', '#FFD700': 'Gold', '#FFA500': 'Orange',
  '#FF69B4': 'Hot Pink', '#FFC0CB': 'Pink', '#FF1493': 'Deep Pink', '#DC143C': 'Crimson',
  '#8B0000': 'Dark Red', '#B22222': 'Firebrick', '#A0522D': 'Sienna', '#D2691E': 'Chocolate',
  '#8B4513': 'Saddle Brown', '#A52A2A': 'Brown', '#DAA520': 'Goldenrod', '#556B2F': 'Dark Olive Green',
  '#006400': 'Dark Green', '#228B22': 'Forest Green', '#32CD32': 'Lime Green',
  '#90EE90': 'Light Green', '#98FB98': 'Pale Green', '#7CFC00': 'Lawn Green',
  '#00FF7F': 'Spring Green', '#2E8B57': 'Sea Green', '#66CDAA': 'Medium Aquamarine',
  '#8FBC8F': 'Dark Sea Green', '#20B2AA': 'Light Sea Green', '#00CED1': 'Dark Turquoise',
  '#40E0D0': 'Turquoise', '#48D1CC': 'Medium Turquoise', '#7FFFD4': 'Aquamarine',
  '#87CEEB': 'Sky Blue', '#87CEFA': 'Light Sky Blue', '#00BFFF': 'Deep Sky Blue',
  '#ADD8E6': 'Light Blue', '#B0C4DE': 'Light Steel Blue', '#4682B4': 'Steel Blue',
  '#6495ED': 'Cornflower Blue', '#1E90FF': 'Dodger Blue', '#4169E1': 'Royal Blue',
  '#0000CD': 'Medium Blue', '#191970': 'Midnight Blue', '#6A5ACD': 'Slate Blue',
  '#7B68EE': 'Medium Slate Blue', '#9370DB': 'Medium Purple', '#8A2BE2': 'Blue Violet',
  '#9400D3': 'Dark Violet', '#9932CC': 'Dark Orchid', '#BA55D3': 'Medium Orchid',
  '#DDA0DD': 'Plum', '#EE82EE': 'Violet', '#DA70D6': 'Orchid', '#C71585': 'Medium Violet Red',
  '#DB7093': 'Pale Violet Red', '#F5F5DC': 'Beige', '#FFEBCD': 'Blanched Almond',
  '#FFDAB9': 'Peach Puff', '#FFE4C4': 'Bisque', '#FAEBD7': 'Antique White',
  '#F5DEB3': 'Wheat', '#DEB887': 'Burlywood', '#D2B48C': 'Tan', '#BC8F8F': 'Rosy Brown',
  '#F4A460': 'Sandy Brown', '#CD853F': 'Peru', '#E9967A': 'Dark Salmon', '#FA8072': 'Salmon',
  '#FFA07A': 'Light Salmon', '#FF7F50': 'Coral', '#F08080': 'Light Coral',
  '#CD5C5C': 'Indian Red', '#FFE4E1': 'Misty Rose', '#FFF0F5': 'Lavender Blush',
  '#E6E6FA': 'Lavender', '#D8BFD8': 'Thistle', '#F0F8FF': 'Alice Blue', '#F0FFFF': 'Azure',
  '#F5FFFA': 'Mint Cream', '#FFFFF0': 'Ivory', '#FFFACD': 'Lemon Chiffon',
  '#FAFAD2': 'Light Goldenrod Yellow', '#FFFAF0': 'Floral White', '#FDF5E6': 'Old Lace',
  '#2F4F4F': 'Dark Slate Gray', '#696969': 'Dim Gray', '#778899': 'Light Slate Gray',
  '#A9A9A9': 'Dark Gray', '#D3D3D3': 'Light Gray', '#F5F5F5': 'White Smoke',
  '#F0E68C': 'Khaki', '#BDB76B': 'Dark Khaki', '#EEE8AA': 'Pale Goldenrod',
  '#8B008B': 'Dark Magenta', '#4B0082': 'Indigo', '#FFF8DC': 'Cornsilk',
  '#FFDEAD': 'Navajo White', '#FFEFD5': 'Papaya Whip',
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const findClosestColorName = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const upperHex = hex.toUpperCase();
  if (NAMED_COLORS[upperHex]) return NAMED_COLORS[upperHex];
  let closestName = null;
  let minDistance = Infinity;
  for (const [namedHex, name] of Object.entries(NAMED_COLORS)) {
    const namedRgb = hexToRgb(namedHex);
    if (!namedRgb) continue;
    const distance = Math.sqrt((rgb.r - namedRgb.r) ** 2 + (rgb.g - namedRgb.g) ** 2 + (rgb.b - namedRgb.b) ** 2);
    if (distance < minDistance) { minDistance = distance; closestName = name; }
  }
  return closestName;
};

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
  const [varietyColorPickerVisible, setVarietyColorPickerVisible] = useState(false);
  const [editingVarietyIndex, setEditingVarietyIndex] = useState(null);
  const [activeColorProductId, setActiveColorProductId] = useState(null);

  const toggleColorBubble = (productId) => {
    setActiveColorProductId((prev) => (prev === productId ? null : productId));
  };

  useEffect(() => {
    if (activeColorProductId !== null) {
      const handler = () => setActiveColorProductId(null);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [activeColorProductId]);

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
    setEditingVarietyIndex(null);
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
    setVarieties((record.varieties || []).map(v => ({ color: v.color, pattern: v.pattern || '', variety_sku: v.variety_sku })));
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
          varieties: isFabricCategory ? varieties.map(v => ({ color: v.color, pattern: v.pattern, variety_sku: v.variety_sku })) : [],
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
                overflow: 'visible',
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
              {(() => {
                const totalQty = product.varieties?.length
                  ? product.varieties.reduce((s, v) => s + (Number(v.stock) || 0), 0)
                  : product.quantity;
                const status = totalQty != null ? getStockStatus(totalQty, product.reorder_level) : null;
                return totalQty != null ? (
                  <Space style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: status?.color }}>
                      {qtyLabel(totalQty)}
                    </span>
                    {status?.tag}
                  </Space>
                ) : (
                  <div style={{ fontSize: 12, color: '#595959', marginBottom: 8 }}>Stock: -</div>
                );
              })()}

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                {product.varieties?.length > 0 && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleColorBubble(product.product_id); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        borderRadius: 20, border: '1px solid #d9d9d9',
                        padding: '1px 8px 1px 4px', height: 24, cursor: 'pointer',
                        background: '#fafafa',
                      }}
                    >
                      {product.varieties.slice(0, 4).map((v) => (
                        <div
                          key={v.variety_id}
                          style={{
                            width: 14, height: 14, borderRadius: '50%',
                            backgroundColor: activeColorProductId === product.product_id ? '#888' : (v.color || '#eee'),
                            border: '1px solid #d9d9d9', flexShrink: 0,
                          }}
                        />
                      ))}
                      {product.varieties.length > 4 && (
                        <span style={{ fontSize: 10, color: activeColorProductId === product.product_id ? '#ccc' : '#888', lineHeight: 1 }}>
                          +{product.varieties.length - 4}
                        </span>
                      )}
                    </div>

                    {activeColorProductId === product.product_id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: 0,
                          marginBottom: 10,
                          backgroundColor: '#fff',
                          border: '1px solid #e8e8e8',
                          borderRadius: 10,
                          boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                          padding: '14px 16px',
                          minWidth: 240,
                          zIndex: 20,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#333' }}>
                          Varieties ({product.varieties.length})
                        </div>
                        {product.varieties.map((v) => (
                          <div
                            key={v.variety_id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '6px 0',
                              borderBottom: '1px solid #f0f0f0',
                            }}
                          >
                            <div
                              style={{
                                width: 22, height: 22, borderRadius: '50%',
                                backgroundColor: v.color || '#eee',
                                border: '1px solid #d9d9d9', flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 13, flex: 1, color: '#444' }}>
                              {v.pattern || v.color || '—'}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                              {v.stock != null ? qtyLabel(v.stock) : 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  <div
                    onClick={() => { setEditingVarietyIndex(i); setVarietyColorPickerVisible(true); }}
                    style={{
                      width: 36, height: 36, borderRadius: 4, cursor: 'pointer',
                      backgroundColor: v.color || '#fff',
                      border: '2px solid #d9d9d9', flexShrink: 0, fontSize: 9, color: '#999',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={v.color || 'Pick color'}
                  >
                    {!v.color ? 'Pick' : ''}
                  </div>
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
                onClick={() => setVarieties([...varieties, { color: '', pattern: '', variety_sku: '' }])}
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

      <ColorPickerModal
        visible={varietyColorPickerVisible}
        onClose={() => { setVarietyColorPickerVisible(false); setEditingVarietyIndex(null); }}
        onColorSelect={(colors) => {
          if (editingVarietyIndex != null && colors.length > 0) {
            const next = [...varieties];
            const existing = next[editingVarietyIndex] || {};
            const colorName = findClosestColorName(colors[0]);
            next[editingVarietyIndex] = {
              ...existing,
              color: colors[0],
              pattern: colorName || existing.pattern || '',
            };
            setVarieties(next);
          }
          setVarietyColorPickerVisible(false);
          setEditingVarietyIndex(null);
        }}
      />
    </div>
  );
};

export default Inventory;
