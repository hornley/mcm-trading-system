import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Typography } from 'antd'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'

const { Title } = Typography
const COLORS = ['#5b7ff0', '#aac4f5']

const Owner = () => {
  const { user, selectedLocationId } = useAuth()
  const [loading, setLoading] = useState(true)
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
      .then((res) => { if (res.success) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) fetchData() }, [user, selectedLocationId])

  const { stats, stock_by_category, stock_movement, recent_transactions } = data

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Owner Dashboard</Title>

      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Inventory Items', value: stats.total_items },
          { title: 'Sales Today', value: `₱${stats.sales_today}` },
          { title: 'Low Stock Alerts', value: stats.low_stock_count, valueStyle: { color: '#fa8c16' } },
          { title: 'Active Users', value: stats.active_users },
        ].map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card styles={{ body: { padding: '20px 24px' } }}>
              <Statistic {...stat} loading={loading} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement (Last 7 Days)" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <ResponsiveContainer width="100%" height={300}>
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
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Stock by Category" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <ResponsiveContainer width="100%" height={300}>
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
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Recent Transactions" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
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
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Owner