import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Row, Col, Card, Tag, Typography, Input, Select, Button, Modal,
  InputNumber, DatePicker, message, Divider,
} from 'antd';
import {
  PlusOutlined, MinusOutlined, DeleteOutlined, ShoppingCartOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { FABRIC_CATEGORY, qtyLabel, fmtQty } from '../utils/format.js';

const { Text } = Typography;
const PAYMENT_METHODS = ['Cash', 'Card', 'GCash', 'Bank Transfer'];
const STEP_QTY = 0.25;
const MIN_FABRIC_QTY = 0.5;

const POSModal = ({
  open, onClose, onConfirm, products,
  usertype, branchName, confirmLoading,
}) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState(null);
  const [orderDate, setOrderDate] = useState(dayjs());
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [qtyModalProduct, setQtyModalProduct] = useState(null);
  const [qtyModalValue, setQtyModalValue] = useState(1);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showPayment, setShowPayment] = useState(false);
  const longPressRef = useRef(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedCategoryId(null);
      setCart([]);
      setPaymentMethod('Cash');
      setPaymentAmount(null);
      setOrderDate(dayjs());
      setShowPayment(false);
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories?usertype=${usertype}`);
      const json = await res.json();
      if (json.success) setCategories(json.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!open) {
      setQtyModalVisible(false);
      setQtyModalProduct(null);
    }
  }, [open]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    return products.filter((p) => p.category_id === selectedCategoryId && p.is_active !== false);
  }, [products, selectedCategoryId]);

  const grandTotal = useMemo(() =>
    cart.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cart],
  );

  const change = useMemo(() =>
    Math.max(0, (paymentAmount || 0) - grandTotal),
    [paymentAmount, grandTotal],
  );

  const canProceedToPayment = cart.length > 0;
  const canConfirm = cart.length > 0 && (paymentAmount || 0) >= grandTotal && !confirmLoading;

  const modalWidth = useMemo(() => {
    if (windowWidth < 576) return windowWidth - 32;
    return Math.min(windowWidth * 0.92, 1400);
  }, [windowWidth]);

  const getDefaultQty = useCallback((product) =>
    product.category === FABRIC_CATEGORY ? MIN_FABRIC_QTY : 1,
  []);

  const handleQuickAdd = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.product_id);
      if (existing) {
        const maxQty = product.quantity ?? 999;
        const newQty = Math.min(maxQty, existing.quantity + getDefaultQty(product));
        return prev.map((c) =>
          c.product_id === product.product_id ? { ...c, quantity: newQty } : c,
        );
      }
      return [...prev, {
        product_id: product.product_id,
        product_name: product.name,
        quantity: getDefaultQty(product),
        price: product.price,
        is_fabric: product.category === FABRIC_CATEGORY,
      }];
    });
  }, [getDefaultQty, products]);

  const handleOpenQtyModal = useCallback((product) => {
    setQtyModalProduct(product);
    const existing = cart.find((c) => c.product_id === product.product_id);
    setQtyModalValue(existing ? existing.quantity : getDefaultQty(product));
    setQtyModalVisible(true);
  }, [getDefaultQty, cart]);

  const handleQtyModalConfirm = useCallback(() => {
    const product = qtyModalProduct;
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.product_id);
      if (existing) {
        const maxQty = product.quantity ?? 999;
        const newQty = Math.min(maxQty, existing.quantity + qtyModalValue);
        return prev.map((c) =>
          c.product_id === product.product_id ? { ...c, quantity: newQty } : c,
        );
      }
      return [...prev, {
        product_id: product.product_id,
        product_name: product.name,
        quantity: qtyModalValue,
        price: product.price,
        is_fabric: product.category === FABRIC_CATEGORY,
      }];
    });
    setQtyModalVisible(false);
    setQtyModalProduct(null);
  }, [qtyModalProduct, qtyModalValue, products]);

  const handlePointerDown = useCallback((product) => {
    isLongPress.current = false;
    longPressRef.current = setTimeout(() => {
      isLongPress.current = true;
      handleOpenQtyModal(product);
    }, 500);
  }, [handleOpenQtyModal]);

  const handlePointerUp = useCallback((product) => {
    clearTimeout(longPressRef.current);
    if (!isLongPress.current) {
      handleQuickAdd(product);
    }
  }, [handleQuickAdd]);

  const handlePointerLeave = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  const handleUpdateQty = useCallback((productId, newQty) => {
    setCart((prev) => prev.map((item) =>
      item.product_id === productId ? { ...item, quantity: newQty } : item,
    ));
  }, []);

  const handleRemoveFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    const payload = {
      usertype,
      items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
      payment_method: paymentMethod,
      payment_amount: paymentAmount,
      order_date: orderDate.toISOString(),
    };
    await onConfirm(payload);
  }, [canConfirm, usertype, cart, paymentMethod, paymentAmount, orderDate, onConfirm]);

  return (
    <>
      <Modal
        title={`Add Sale${branchName ? ` — ${branchName}` : ''}`}
        open={open}
        onCancel={onClose}
        width={modalWidth}
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto', padding: '16px 24px' } }}
        footer={null}
        destroyOnClose
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={17}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Categories</Text>
              <Row gutter={[16, 16]}>
                {categories.length === 0 && (
                  <Col span={24}><Text type="secondary">Loading categories...</Text></Col>
                )}
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.category_id;
                  const expanded = !selectedCategoryId;
                  return (
                    <Col
                      key={cat.category_id}
                      xs={expanded ? 12 : undefined}
                      md={expanded ? 8 : undefined}
                    >
                      <Card
                        hoverable
                        size={expanded ? 'default' : 'small'}
                        onClick={() => setSelectedCategoryId(cat.category_id)}
                        className="pos-category-tile"
                        styles={{ body: { padding: expanded ? 24 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
                        style={{
                          cursor: 'pointer',
                          textAlign: 'center',
                          minWidth: expanded ? undefined : 110,
                          minHeight: expanded ? 120 : undefined,
                          background: isSelected ? '#e6f4ff' : undefined,
                          borderColor: isSelected ? '#5b7ff0' : undefined,
                          borderWidth: isSelected ? 2 : 1,
                        }}
                      >
                        <Text strong style={{ fontSize: expanded ? 16 : 14 }}>{cat.name}</Text>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              {selectedCategoryId ? (
                <>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
                    {categories.find((c) => c.category_id === selectedCategoryId)?.name}
                  </Text>
                  <Row gutter={[16, 16]}>
                    {filteredProducts.map((product) => {
                      const inCart = cart.find((c) => c.product_id === product.product_id);
                      return (
                      <Col xs={12} md={8} key={product.product_id}>
                        <Card
                          hoverable
                          onPointerDown={() => handlePointerDown(product)}
                          onPointerUp={() => handlePointerUp(product)}
                          onPointerLeave={handlePointerLeave}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderColor: inCart ? '#ff4d4f' : undefined,
                            borderWidth: inCart ? 2 : 1,
                            background: inCart ? '#fff2f0' : undefined,
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, lineHeight: 1.3 }}>
                            {product.name}
                          </div>
                          <div style={{ color: '#52c41a', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                            ₱{product.price}
                          </div>
                          <div style={{ fontSize: 12, color: '#888', marginBottom: inCart ? 4 : 0 }}>
                            Stock: {fmtQty(product.quantity, product.category === FABRIC_CATEGORY)}
                          </div>
                          {inCart && (
                            <div style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#ff4d4f',
                              marginTop: 4,
                              padding: '2px 6px',
                              background: '#ff4d4f15',
                              borderRadius: 4,
                              display: 'inline-block',
                            }}>
                              In cart: {fmtQty(inCart.quantity, inCart.is_fabric)}
                            </div>
                          )}
                        </Card>
                      </Col>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <Col span={24}>
                        <Text type="secondary">No products in this category</Text>
                      </Col>
                    )}
                  </Row>
                </>
              ) : null}
            </div>
          </Col>

          <Col xs={24} lg={7}>
            <style>{`
              .pos-cart-list {
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: rgba(0,0,0,0.15) transparent;
              }
              .pos-cart-list::-webkit-scrollbar {
                width: 4px;
              }
              .pos-cart-list::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.15);
                border-radius: 4px;
              }
              .pos-cart-list::-webkit-scrollbar-track {
                background: transparent;
              }
              .pos-category-tile {
                transition: min-height 150ms ease, padding 150ms ease, background 150ms ease, border-color 150ms ease;
              }
              .pos-category-tile .ant-card-body {
                transition: padding 150ms ease;
              }
            `}</style>

            {!showPayment ? (
              <Card
                title={<span><ShoppingCartOutlined style={{ marginRight: 6 }} />Cart ({cart.length})</span>}
                styles={{ body: { padding: '12px 16px' } }}
              >
                <div className="pos-cart-list" style={{ maxHeight: 340, marginBottom: 12 }}>
                  {cart.length === 0 ? (
                    <Text type="secondary">No items in cart</Text>
                  ) : (
                    cart.map((item) => {
                      const product = products.find((p) => p.product_id === item.product_id);
                      const maxQty = product?.quantity ?? 999;
                      const step = item.is_fabric ? STEP_QTY : 1;
                      const minQty = item.is_fabric ? MIN_FABRIC_QTY : 1;
                      return (
                        <div key={item.product_id} style={{
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, lineHeight: 1.2 }}>
                            {item.product_name}
                          </div>
                          <Row align="middle" gutter={4}>
                            <Col>
                              <Button
                                size="small"
                                icon={<MinusOutlined />}
                                onClick={() => handleUpdateQty(
                                  item.product_id,
                                  Math.max(minQty, +((item.quantity - step).toFixed(2))),
                                )}
                              />
                            </Col>
                            <Col>
                              <Text style={{ padding: '0 6px', minWidth: 44, display: 'inline-block', textAlign: 'center' }}>
                                {fmtQty(item.quantity, item.is_fabric)}
                              </Text>
                            </Col>
                            <Col>
                              <Button
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => handleUpdateQty(
                                  item.product_id,
                                  Math.min(maxQty, +((item.quantity + step).toFixed(2))),
                                )}
                              />
                            </Col>
                            <Col flex="auto" style={{ textAlign: 'right' }}>
                              <Text style={{ fontSize: 13 }}>₱{(item.quantity * item.price).toLocaleString()}</Text>
                            </Col>
                            <Col>
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveFromCart(item.product_id)}
                              />
                            </Col>
                          </Row>
                        </div>
                      );
                    })
                  )}
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ margin: '8px 0', padding: '8px 0', borderTop: '2px solid #5b7ff0' }}>
                  <Text strong style={{ fontSize: 16 }}>Total: ₱{grandTotal.toLocaleString()}</Text>
                </div>

                <Row gutter={8}>
                  <Col span={12}>
                    <Button
                      block
                      size="large"
                      onClick={onClose}
                      style={{ height: 48, fontSize: 15, fontWeight: 500 }}
                    >
                      Cancel
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      type="primary"
                      size="large"
                      disabled={!canProceedToPayment}
                      onClick={() => setShowPayment(true)}
                      style={{ height: 48, fontSize: 15, fontWeight: 500 }}
                    >
                      Confirm Order
                    </Button>
                  </Col>
                </Row>
              </Card>
            ) : (
              <Card
                title={<span>Payment</span>}
                styles={{ body: { padding: '12px 16px' } }}
              >
                <Button
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setShowPayment(false)}
                  style={{ marginBottom: 8, padding: 0, height: 32 }}
                >
                  Back to cart
                </Button>

                <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '12px 0', padding: '8px 0', borderTop: '2px solid #5b7ff0', borderBottom: '2px solid #5b7ff0' }}>
                  ₱{grandTotal.toLocaleString()}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Date</Text>
                  <DatePicker
                    style={{ width: '100%' }}
                    value={orderDate}
                    onChange={(d) => setOrderDate(d || dayjs())}
                    size="small"
                  />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Payment Method</Text>
                  <Select
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    style={{ width: '100%' }}
                    size="small"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <Select.Option key={m} value={m}>{m}</Select.Option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Payment Amount</Text>
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="Enter amount"
                    prefix="₱"
                    value={paymentAmount}
                    onChange={(v) => setPaymentAmount(v)}
                    size="small"
                  />
                </div>

                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>Change: </Text>
                  <Text strong style={{ color: change > 0 ? '#52c41a' : undefined }}>
                    ₱{change.toLocaleString()}
                  </Text>
                </div>

                {paymentAmount > 0 && paymentAmount < grandTotal && (
                  <Text type="danger" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                    Insufficient amount
                  </Text>
                )}

                <Button
                  block
                  type="primary"
                  size="large"
                  disabled={!canConfirm}
                  loading={confirmLoading}
                  onClick={handleConfirm}
                  style={{ height: 48, fontSize: 15, fontWeight: 500, marginTop: 8 }}
                >
                  Confirm Payment
                </Button>
              </Card>
            )}
          </Col>
        </Row>
      </Modal>

      <Modal
        title="Set Quantity"
        open={qtyModalVisible}
        onCancel={() => { setQtyModalVisible(false); setQtyModalProduct(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setQtyModalVisible(false); setQtyModalProduct(null); }}>
            Cancel
          </Button>,
          <Button key="add" type="primary" onClick={handleQtyModalConfirm} disabled={!qtyModalValue}>
            Add to Cart
          </Button>,
        ]}
        width={340}
        destroyOnClose
      >
        {qtyModalProduct && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
              {qtyModalProduct.name}
            </Text>
            <Text style={{ display: 'block', marginBottom: 16, color: '#888' }}>
              Unit Price: ₱{qtyModalProduct.price}
            </Text>
            {(() => {
              const isFab = qtyModalProduct.category === FABRIC_CATEGORY;
              const maxQty = qtyModalProduct.quantity ?? 999;
              return (
                <>
                  <InputNumber
                    min={isFab ? MIN_FABRIC_QTY : 1}
                    max={maxQty}
                    step={isFab ? STEP_QTY : 1}
                    value={qtyModalValue}
                    onChange={(v) => setQtyModalValue(v ?? (isFab ? MIN_FABRIC_QTY : 1))}
                    size="large"
                    style={{ width: '100%' }}
                  />
                  {isFab && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {qtyLabel(qtyModalValue)} yards
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </>
  );
};

export default POSModal;
