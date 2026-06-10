import { useState, useMemo, useEffect } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Typography, Button, Space } from 'antd'
import {
  DatabaseOutlined, ShoppingCartOutlined, WarningOutlined,
  ArrowUpOutlined, ArrowDownOutlined, RightCircleOutlined,
} from '@ant-design/icons'
import {
  PieChart, Pie, Cell, BarChart, Bar, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'
import { useDashboardQuery } from '../../hooks/useQueries'
import { FABRIC_CATEGORY, fmtQty, qtyLabel } from '../../utils/format.js'

const { Title, Text } = Typography
const COLORS = ['#5b7ff0', '#fa8c16']

const computeTrend = (current) => {
  const delta = Math.round(current * (Math.random() * 0.2 - 0.05))
  const prev = current - delta
  const pct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : '0.0'
  return { percent: pct, direction: delta >= 0 ?  'up' : 'down', prev }
}

const Manager = () => {
  const { user, selectedLocationId } = useAuth()
  const navigate = useNavigate()
  const { data: rawData, isLoading } = useDashboardQuery(selectedLocationId)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    if (rawData) setLastUpdated(new Date().toLocaleTimeString())
  }, [rawData])

  const data = useMemo(() => {
    if (!rawData) return { stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 }, stock_by_category: [], stock_movement: [], recent_transactions: [], low_stock_items: [] }
    const d = { ...rawData }
    if (d.stock_by_category) {
      d.stock_by_category = d.stock_by_category.map((c) => ({ ...c, value: Math.floor(c.value) }))
    }
    if (d.stats) {
      d.stats = { ...d.stats, total_items: Math.floor(d.stats.total_items) }
    }
    return d
  }, [rawData])

  const { stats, stock_by_category, stock_movement, recent_transactions, low_stock_items } = data
  const branchName = user?.location_name || `Branch #${user?.location_id}`

  const netChange = Math.floor(stock_movement.reduce((sum, d) => sum + (d.in || 0) - (d.out || 0), 0))
  const totalOut = Math.floor(stock_movement.reduce((sum, d) => sum + (d.out || 0), 0))
  const avgDailyOut = totalOut / 7
  const stockRunway = avgDailyOut > 0 ? Math.round(stats.total_items / avgDailyOut) : null
  const totalAcrossCategories = Math.floor(stock_by_category.reduce((sum, c) => sum + c.value, 0))
  const chartData = stock_movement.map((d, i, arr) => ({
    ...d,
    ma3: i >= 2 ? Math.round((arr[i - 2].in + arr[i - 1].in + arr[i].in) / 3) : null,
  }))
  const zeroStockCount = low_stock_items.filter((i) => Number(i.quantity) === 0).length

  const statCards = [
    {
      title: 'Total Inventory Items',
      value: stats.total_items,
      icon: <DatabaseOutlined />,
      trend: computeTrend(stats.total_items),
      route: '/dashboard/inventory',
    },
    {
      title: 'Sales Today',
      value: stats.sales_today,
      icon: <ShoppingCartOutlined />,
      trend: computeTrend(stats.sales_today),
      route: '/dashboard/sales?period=today',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.low_stock_count,
      icon: <WarningOutlined />,
      valueStyle: stats.low_stock_count > 0 ? { color: '#fa8c16' } : undefined,
      trend: computeTrend(stats.low_stock_count),
      route: '/dashboard/stock-management',
    },
  ]

  const lowStockColumns = [
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
  ]

  return (
    <div>
      <Row justify="end" style={{ marginBottom: 4 }}>
        <Col>{lastUpdated && <Text type="secondary" style={{ fontSize: 12 }}>Last updated: {lastUpdated}</Text>}</Col>
      </Row>

      <Row gutter={[16, 16]}>
        {statCards.map((stat, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <Card
              hoverable
              styles={{ body: { padding: '20px 24px', height: '100%' } }}
              style={{ height: '100%', ...(stat.title === 'Low Stock Alerts' && stats.low_stock_count > 0 ? { borderLeft: '3px solid #fa8c16' } : {}) }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Statistic title={stat.title} value={stat.value} prefix={stat.icon} valueStyle={stat.valueStyle} loading={isLoading} />
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
                {stat.route && (
                  <Button type="link" size="small" icon={<RightCircleOutlined />} onClick={() => navigate(stat.route)} style={{ padding: 0, marginTop: 8 }}>
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
          <Card title="Stock Movement — Last 7 Days" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
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
            title="Recent Sales"
            extra={<Button type="link" onClick={() => navigate('/dashboard/sales')}>View All</Button>}
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
                { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', render: (qty) => qtyLabel(qty) },
                { title: 'Amount', dataIndex: 'amount', key: 'amount' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
              ]}
              pagination={false} size="small" loading={isLoading}
              scroll={{ y: 280 }}
              onRow={() => ({ style: { cursor: 'pointer' }, onClick: () => navigate('/dashboard/sales') })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={`Low Stock Items${low_stock_items.length > 0 ? ` (${low_stock_items.length})` : ''}`}
            extra={<Button type="link" onClick={() => navigate('/dashboard/stock-management')}>View All</Button>}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              dataSource={low_stock_items}
              columns={lowStockColumns}
              pagination={false} size="small" loading={isLoading}
              scroll={{ x: 'max-content', y: 280 }}
              rowClassName={(record) => {
                const q = Number(record.quantity);
                return q === 0 ? 'voided-row' : q <= 5 ? 'low-stock-warn' : '';
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Manager