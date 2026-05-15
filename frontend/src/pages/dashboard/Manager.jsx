import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Typography } from 'antd'
import {
  DatabaseOutlined, ShoppingCartOutlined, WarningOutlined, TeamOutlined,
} from '@ant-design/icons'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'

const { Title, Text } = Typography
const COLORS = ['#5b7ff0', '#fa8c16']

const Manager = () => {
  const { user, selectedLocationId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 },
    stock_by_category: [],
    stock_movement: [],
    recent_transactions: [],
    low_stock_items: [],
  })

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ usertype: user?.usertype, user_id: user?.user_id, location_id: selectedLocationId })
    fetch(`/api/dashboard/summary?${params}`)
      .then((res) => res.json())
      .then((res) => { if (res.success) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) fetchData() }, [user, selectedLocationId])

  const { stats, stock_by_category, stock_movement, recent_transactions, low_stock_items } = data
  const branchName = user?.location_name || `Branch #${user?.location_id}`

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Manager Dashboard</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Branch: {branchName}
      </Text>

      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Inventory Items', value: stats.total_items, icon: <DatabaseOutlined /> },
          { title: 'Sales Today', value: stats.sales_today, icon: <ShoppingCartOutlined /> },
          { title: 'Low Stock Alerts', value: stats.low_stock_count, icon: <WarningOutlined />, valueStyle: { color: '#fa8c16' } },
          { title: 'Total Staff', value: stats.active_users, icon: <TeamOutlined /> },
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
          <Card title="Stock Movement — Last 7 Days" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
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
        <Col xs={24} lg={12}>
          <Card title="Recent Sales" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <Table
              dataSource={recent_transactions}
              columns={[
                { title: 'Product', dataIndex: 'product', key: 'product' },
                { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount' },
                { title: 'Date', dataIndex: 'date', key: 'date' },
              ]}
              pagination={false} size="small" loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Low Stock Items" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <Table
              dataSource={low_stock_items}
              columns={[
                { title: 'Product Name', dataIndex: 'product_name', key: 'product_name' },
                { title: 'Category', dataIndex: 'category', key: 'category' },
                { title: 'Current Stock', dataIndex: 'quantity', key: 'quantity' },
                { title: 'Status', key: 'status', render: () => <Tag color="orange">Low Stock</Tag> },
              ]}
              pagination={false} size="small" loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Manager