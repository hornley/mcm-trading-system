import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Descriptions, Typography } from 'antd';
import {
  UserOutlined, CalendarOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;

const roleColors = {
  Owner: 'blue', Manager: 'green', Admin: 'purple',
};

const ROLE_MAP = { 1: 'Owner', 2: 'Manager', 3: 'Admin' };

const Admin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 },
    admin_stats: { total_users: 0, last_maintenance: '', system_operational: true, activity_7d: 0 },
  });

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ usertype: user?.usertype });
    fetch(`/api/dashboard/summary?${params}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const { stats, admin_stats } = data;

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>Admin Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Users" value={admin_stats.total_users} prefix={<UserOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Inventory Items" value={stats.total_items} prefix={<UserOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="7-Day Activity" value={admin_stats.activity_7d} prefix={<CalendarOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="System Status"
              value={'Operational'}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="System Configuration">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Total Registered Users">{admin_stats.total_users}</Descriptions.Item>
              <Descriptions.Item label="Database Status">
                <Tag color="green">Connected</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Active Inventory Items">{stats.total_items}</Descriptions.Item>
              <Descriptions.Item label="Low Stock Alerts">
                <Tag color={stats.low_stock_count > 0 ? 'orange' : 'green'}>
                  {stats.low_stock_count}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="7-Day Activity Logs">{admin_stats.activity_7d}</Descriptions.Item>
              <Descriptions.Item label="Sales Today">₱{stats.sales_today}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Admin;
