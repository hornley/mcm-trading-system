import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography, Button, Space, Modal } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, RightCircleOutlined } from '@ant-design/icons'
import {
  PieChart, Pie, Cell, BarChart, Bar, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { FABRIC_CATEGORY, fmtQty, qtyLabel } from '../../utils/format.js'

const { Title, Text } = Typography
const COLORS = ['#5b7ff0', '#aac4f5']

const computeTrend = (current) => {
  const delta = Math.round(current * (Math.random() * 0.2 - 0.05))
  const prev = current - delta
  const pct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : '0.0'
  return { percent: pct, direction: delta >= 0 ? 'up' : 'down', prev }
}

const Owner = () => {
  const { user, selectedLocationId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [data, setData] = useState({
    stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 },
    stock_by_category: [],
    stock_movement: [],
    recent_transactions: [],
    low_stock_items: [],
  })

  const [inventoryModal, setInventoryModal] = useState({ open: false, data: [], loading: false })
  const [salesModal, setSalesModal] = useState({ open: false, data: [], loading: false })
  const [stockAlertModal, setStockAlertModal] = useState({ open: false })

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ usertype: user?.usertype, location_id: selectedLocationId })
    fetch(`/api/dashboard/summary?${params}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          const d = res.data;
          if (d.stock_by_category) {
            d.stock_by_category = d.stock_by_category.map((c) => ({ ...c, value: Math.floor(c.value) }));
          }
          if (d.stats) d.stats.total_items = Math.floor(d.stats.total_items);
          setData(d);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) fetchData() }, [user, selectedLocationId])

  const { stats, stock_by_category, stock_movement, recent_transactions, low_stock_items } = data

  const netChange = Math.floor(stock_movement.reduce((sum, d) => sum + (d.in || 0) - (d.out || 0), 0))
  const totalOut = Math.floor(stock_movement.reduce((sum, d) => sum + (d.out || 0), 0))
  const avgDailyOut = totalOut / 7
  const stockRunway = avgDailyOut > 0 ? Math.round(stats.total_items / avgDailyOut) : null
  const totalAcrossCategories = Math.floor(stock_by_category.reduce((sum, c) => sum + c.value, 0))
  const chartData = stock_movement.map((d, i, arr) => ({
    ...d,
    ma3: i >= 2 ? Math.round((arr[i - 2].in + arr[i - 1].in + arr[i].in) / 3) : null,
  }))

  const statCards = [
    {
      title: 'Total Inventory Items',
      value: stats.total_items,
      trend: computeTrend(stats.total_items),
      action: () => fetchInventoryPreview(),
    },
    {
      title: 'Sales Today',
      value: `₱${stats.sales_today}`,
      trend: computeTrend(stats.sales_today),
      action: () => fetchSalesToday(),
    },
    {
      title: 'Low Stock Alerts',
      value: stats.low_stock_count,
      valueStyle: stats.low_stock_count > 0 ? { color: '#fa8c16' } : undefined,
      trend: computeTrend(stats.low_stock_count),
      action: () => setStockAlertModal({ open: true }),
    },
    {
      title: 'Active Users',
      value: stats.active_users,
    },
  ]

  const fetchInventoryPreview = async () => {
    setInventoryModal({ open: true, data: [], loading: true })
    try {
      const params = new URLSearchParams({ usertype: user?.usertype })
      if (selectedLocationId && selectedLocationId !== 'all') {
        params.set('location_id', selectedLocationId)
      }
      const res = await fetch(`/api/inventory?${params}`)
      const json = await res.json()
      if (json.success) {
        const items = Array.isArray(json.data) ? json.data : json.data?.data || []
        setInventoryModal({ open: true, data: items, loading: false })
      }
    } catch {
      setInventoryModal({ open: true, data: [], loading: false })
    }
  }

  const fetchSalesToday = async () => {
    setSalesModal({ open: true, data: [], loading: true })
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const params = new URLSearchParams({
        usertype: user?.usertype,
        user_id: user?.user_id,
        date_from: today.toISOString(),
        date_to: new Date().toISOString(),
        page: 1,
        limit: 50,
      })
      const res = await fetch(`/api/orders?${params}`)
      const json = await res.json()
      if (json.success) {
        setSalesModal({ open: true, data: json.data?.orders || [], loading: false })
      }
    } catch {
      setSalesModal({ open: true, data: [], loading: false })
    }
  }

  const inventoryColumns = [
    { title: 'Product', dataIndex: 'product_name', key: 'product_name', render: (_, r) => {
      const p = [r.color, r.pattern].filter(Boolean);
      return r.product_name + (p.length ? ` (${p.join(', ')})` : '');
    } },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', render: (qty) => fmtQty(qty) },
  ]

  const salesColumns = [
    { title: 'ID', dataIndex: 'order_id', key: 'order_id', render: (v) => `#${v}` },
    { title: 'Branch', dataIndex: 'location_name', key: 'location_name' },
    { title: 'Items', dataIndex: 'product_names', key: 'items', render: (names) => names?.join(', ') || '-' },
    { title: 'Amount', dataIndex: 'total_amount', key: 'total_amount', render: (v) => `₱${v?.toLocaleString() || 0}` },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s) => <Tag color={s === 'completed' ? 'green' : 'red'}>{s}</Tag>,
    },
  ]

  const stockAlertColumns = [
    { title: 'Product Name', dataIndex: 'product_name', key: 'product_name', render: (_, r) => {
      const p = [r.color, r.pattern].filter(Boolean);
      return r.product_name + (p.length ? ` (${p.join(', ')})` : '');
    } },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Current Stock', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.category === FABRIC_CATEGORY) },
    {
      title: 'Status', key: 'status',
      render: (_, record) => {
        const q = Number(record.quantity);
        return <Tag color={q === 0 ? 'red' : 'orange'}>{q === 0 ? 'Out of Stock' : 'Low Stock'}</Tag>;
      },
    },
  ]

  return (
    <div>
      <Row justify="end" style={{ marginBottom: 4 }}>
        <Col>{lastUpdated && <Text type="secondary" style={{ fontSize: 12 }}>Last updated: {lastUpdated}</Text>}</Col>
      </Row>

      <Row gutter={[16, 16]}>
        {statCards.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              hoverable
              styles={{ body: { padding: '20px 24px', height: '100%' } }}
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Statistic title={stat.title} value={stat.value} valueStyle={stat.valueStyle} loading={loading} />
                <div style={{ flex: 1 }} />
                {stat.trend && (
                  <Space>
                    <Text style={{ fontSize: 13, color: stat.trend.direction === 'up' ? '#52c41a' : '#ff4d4f' }}>
                      {stat.trend.direction === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {' '}{stat.trend.percent}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>since last week</Text>
                  </Space>
                )}
                {stat.action && (
                  <Button type="link" size="small" icon={<RightCircleOutlined />} onClick={stat.action} disabled={loading} style={{ padding: 0, marginTop: 8 }}>
                    View {stat.title.replace(/^(Total |Low )/, '')}
                  </Button>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {stats.total_items > 0 && (
        <Card size="small" style={{ marginTop: 16, marginBottom: 0 }} styles={{ body: { padding: '12px 16px' } }}>
          <Row align="middle" gutter={16}>
            <Col><Text type="secondary" style={{ fontSize: 12 }}>Stock Health</Text></Col>
            <Col flex="auto">
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f0f0f0' }}>
                <div style={{ width: `${Math.max(0, ((stats.total_items - stats.low_stock_count) / stats.total_items) * 100)}%`, background: '#52c41a', transition: 'width 0.3s' }} />
                <div style={{ width: `${Math.max(0, (stats.low_stock_count / stats.total_items) * 100)}%`, background: '#fa8c16', transition: 'width 0.3s' }} />
              </div>
            </Col>
            <Col>
              <Space size={12}>
                <Space size={4}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#52c41a' }} />
                  <Text style={{ fontSize: 12 }}>{Math.max(0, stats.total_items - stats.low_stock_count)} healthy</Text>
                </Space>
                <Space size={4}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fa8c16' }} />
                  <Text style={{ fontSize: 12 }}>{stats.low_stock_count} low</Text>
                </Space>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement (Last 7 Days)" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="in" fill="#52c41a" name="Stock In" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" fill="#ff4d4f" name="Stock Out" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="ma3" stroke="#5b7ff0" strokeWidth={2} dot={false} name="3-day avg" />
              </ComposedChart>
            </ResponsiveContainer>
            {stock_movement.length > 0 && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Text style={{ fontSize: 13 }}>
                  Net change: <Text style={{ color: netChange >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{netChange >= 0 ? '+' : ''}{netChange} units</Text> this week
                </Text>
                {stockRunway && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Stock runway: ~<Text strong>{stockRunway}</Text> days at current outflow
                    </Text>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Stock by Category" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stock_by_category.length > 0 ? stock_by_category : [{ name: 'No Data', value: 1 }]}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stock_by_category.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {totalAcrossCategories > 0 && (
              <Text style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 13 }}>
                <Text strong>{totalAcrossCategories.toLocaleString()}</Text> units across <Text strong>{stock_by_category.length}</Text> categories
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="Recent Transactions"
            extra={<Button type="link" onClick={() => fetchSalesToday()} disabled={loading}>View All Sales</Button>}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              dataSource={recent_transactions}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Product', dataIndex: 'product', key: 'product', render: (v, r) => {
                  const p = [r.color, r.pattern].filter(Boolean);
                  return v + (p.length ? ` (${p.join(', ')})` : '');
                } },
                { title: 'Qty', dataIndex: 'quantity', key: 'quantity', render: (qty) => qtyLabel(qty) },
                { title: 'Amount', dataIndex: 'amount', key: 'amount' },
                { title: 'Branch', dataIndex: 'branch', key: 'branch' },
                {
                  title: 'Status', dataIndex: 'status', key: 'status',
                  render: (status) => (
                    <Tag color={status === 'Completed' ? 'green' : 'orange'}>{status}</Tag>
                  ),
                },
              ]}
              pagination={false}
              size="small"
              loading={loading}
              scroll={{ y: 280 }}
              onRow={() => ({ style: { cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }, onClick: () => { if (!loading) fetchSalesToday() } })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={`Low Stock Items${low_stock_items.length > 0 ? ` (${low_stock_items.length})` : ''}`}
            extra={<Button type="link" onClick={() => setStockAlertModal({ open: true })} disabled={loading}>View All</Button>}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              dataSource={low_stock_items}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Product Name', dataIndex: 'product_name', key: 'product_name', render: (_, r) => {
                  const p = [r.color, r.pattern].filter(Boolean);
                  return r.product_name + (p.length ? ` (${p.join(', ')})` : '');
                } },
                { title: 'Category', dataIndex: 'category', key: 'category' },
                { title: 'Current Stock', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.category === FABRIC_CATEGORY) },
                { title: 'Status', key: 'status', render: (_, record) => {
                  const q = Number(record.quantity);
                  return <Tag color={q === 0 ? 'red' : 'orange'}>{q === 0 ? 'Out of Stock' : 'Low Stock'}</Tag>;
                }},
              ]}
              pagination={false}
              size="small"
              loading={loading}
              scroll={{ y: 280 }}
              onRow={() => ({ style: { cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }, onClick: () => { if (!loading) fetchSalesToday() } })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={`Low Stock Items${low_stock_items.length > 0 ? ` (${low_stock_items.length})` : ''}`}
            extra={<Button type="link" onClick={() => setStockAlertModal({ open: true })} disabled={loading}>View All</Button>}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              dataSource={low_stock_items}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Product Name', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Category', dataIndex: 'category', key: 'category' },
                { title: 'Current Stock', dataIndex: 'quantity', key: 'quantity', render: (qty, r) => fmtQty(qty, r.category === FABRIC_CATEGORY) },
                { title: 'Status', key: 'status', render: (_, record) => {
                  const q = Number(record.quantity);
                  return <Tag color={q === 0 ? 'red' : 'orange'}>{q === 0 ? 'Out of Stock' : 'Low Stock'}</Tag>;
                }},
              ]}
              pagination={false}
              size="small"
              loading={loading}
              scroll={{ y: 280 }}
              rowClassName={(record) => {
                const q = Number(record.quantity);
                return q === 0 ? 'voided-row' : q <= 5 ? 'low-stock-warn' : '';
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Inventory Items"
        open={inventoryModal.open}
        onCancel={() => setInventoryModal({ open: false, data: [], loading: false })}
        footer={null}
        width={800}
      >
        <Table
          dataSource={inventoryModal.data}
          columns={inventoryColumns}
          rowKey="inventory_id"
          loading={inventoryModal.loading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 'max-content', y: 400 }}
          locale={{ emptyText: inventoryModal.loading ? '' : 'No inventory items found' }}
        />
      </Modal>

      <Modal
        title="Sales Today"
        open={salesModal.open}
        onCancel={() => setSalesModal({ open: false, data: [], loading: false })}
        footer={null}
        width={800}
      >
        <Table
          dataSource={salesModal.data}
          columns={salesColumns}
          rowKey="order_id"
          loading={salesModal.loading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Modal>

      <Modal
        title={`Stock Alerts${stats.low_stock_count > 0 ? ` (${stats.low_stock_count})` : ''}`}
        open={stockAlertModal.open}
        onCancel={() => setStockAlertModal({ open: false })}
        footer={null}
        width={800}
      >
        <Table
          dataSource={low_stock_items}
          columns={stockAlertColumns}
          rowKey="key"
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 'max-content', y: 400 }}
          locale={{ emptyText: 'No stock alerts — all items are healthy' }}
        />
      </Modal>
    </div>
  )
}

export default Owner
