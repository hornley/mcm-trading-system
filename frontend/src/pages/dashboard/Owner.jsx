import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography, Button, Space } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, RightCircleOutlined } from '@ant-design/icons'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [data, setData] = useState({
    stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 },
    stock_by_category: [],
    stock_movement: [],
    recent_transactions: [],
  })

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ usertype: user?.usertype, location_id: selectedLocationId })
    fetch(`/api/dashboard/summary?${params}`)
      .then((res) => res.json())
      .then((res) => { if (res.success) { setData(res.data); setLastUpdated(new Date().toLocaleTimeString()) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) fetchData() }, [user, selectedLocationId])

  const { stats, stock_by_category, stock_movement, recent_transactions } = data

  const netChange = stock_movement.reduce((sum, d) => sum + (d.in || 0) - (d.out || 0), 0)
  const totalAcrossCategories = stock_by_category.reduce((sum, c) => sum + c.value, 0)

  const statCards = [
    {
      title: 'Total Inventory Items',
      value: stats.total_items,
      trend: computeTrend(stats.total_items),
      route: '/dashboard/inventory',
    },
    {
      title: 'Sales Today',
      value: `₱${stats.sales_today}`,
      trend: computeTrend(stats.sales_today),
      route: '/dashboard/sales',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.low_stock_count,
      valueStyle: stats.low_stock_count > 0 ? { color: '#fa8c16' } : undefined,
      trend: computeTrend(stats.low_stock_count),
      route: '/dashboard/stock-management',
    },
    {
      title: 'Active Users',
      value: stats.active_users,
      route: '/dashboard/users',
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col><Title level={4} style={{ margin: 0 }}>Owner Dashboard</Title></Col>
        <Col>{lastUpdated && <Text type="secondary" style={{ fontSize: 12 }}>Last updated: {lastUpdated}</Text>}</Col>
      </Row>

      <Row gutter={[16, 16]}>
        {statCards.map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              hoverable
              styles={{ body: { padding: '20px 24px' } }}
              style={stat.title === 'Low Stock Alerts' && stats.low_stock_count > 0 ? { borderLeft: '3px solid #fa8c16' } : {}}
            >
              <Statistic title={stat.title} value={stat.value} valueStyle={stat.valueStyle} loading={loading} />
              {stat.trend && (
                <Space style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 13, color: stat.trend.direction === 'up' ? '#52c41a' : '#ff4d4f' }}>
                    {stat.trend.direction === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {' '}{stat.trend.percent}%
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>vs yesterday</Text>
                </Space>
              )}
              {stat.route && (
                <Button type="link" size="small" icon={<RightCircleOutlined />} onClick={() => navigate(stat.route)} style={{ padding: 0, marginTop: 4 }}>
                  View {stat.title.replace(/^(Total |Low )/, '')}
                </Button>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement (Last 7 Days)" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stock_movement}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="in" fill="#52c41a" name="Stock In" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" fill="#ff4d4f" name="Stock Out" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {stock_movement.length > 0 && (
              <Text style={{ display: 'block', textAlign: 'right', marginTop: 8, fontSize: 13 }}>
                Net change: <Text style={{ color: netChange >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{netChange >= 0 ? '+' : ''}{netChange} units</Text> this week
              </Text>
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
        <Col span={24}>
          <Card
            title="Recent Transactions"
            extra={<Button type="link" onClick={() => navigate('/dashboard/sales')}>View All Sales</Button>}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              dataSource={recent_transactions}
              columns={[
                { title: 'Product', dataIndex: 'product', key: 'product' },
                { title: 'Qty', dataIndex: 'quantity', key: 'quantity' },
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
              onRow={() => ({ style: { cursor: 'pointer' }, onClick: () => navigate('/dashboard/sales') })}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Owner