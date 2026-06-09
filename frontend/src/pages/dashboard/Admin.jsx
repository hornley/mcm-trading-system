import { Row, Col, Card, Statistic, Tag, Descriptions, Typography } from 'antd'
import { UserOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useDashboardQuery } from '../../hooks/useQueries'

const { Title } = Typography

const Admin = () => {
  const { data, isLoading } = useDashboardQuery(null)

  const stats = data?.stats || { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 }
  const admin_stats = data?.admin_stats || { total_users: 0, last_maintenance: '', system_operational: true, activity_7d: 0 }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Admin Dashboard</Title>

      <Row gutter={[16, 16]}>
        {[
          { title: 'Total Users', value: admin_stats.total_users, icon: <UserOutlined /> },
          { title: 'Inventory Items', value: stats.total_items, icon: <UserOutlined /> },
          { title: '7-Day Activity', value: admin_stats.activity_7d, icon: <CalendarOutlined /> },
          { title: 'System Status', value: 'Operational', icon: <CheckCircleOutlined />, valueStyle: { color: '#52c41a' } },
        ].map((stat, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card styles={{ body: { padding: '20px 24px' } }}>
              <Statistic {...stat} loading={isLoading} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="System Configuration" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Total Registered Users">{admin_stats.total_users}</Descriptions.Item>
              <Descriptions.Item label="Database Status">
                <Tag color="green">Connected</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Active Inventory Items">{stats.total_items}</Descriptions.Item>
              <Descriptions.Item label="Low Stock Alerts">
                <Tag color={stats.low_stock_count > 0 ? 'orange' : 'green'}>{stats.low_stock_count}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="7-Day Activity Logs">{admin_stats.activity_7d}</Descriptions.Item>
              <Descriptions.Item label="Sales Today">₱{stats.sales_today}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Admin