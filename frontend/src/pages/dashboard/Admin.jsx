import { useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Descriptions, Popconfirm, Typography, Space } from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;

const mockStats = {
  totalUsers: 28,
  lastMaintenance: '2025-05-10',
  systemOperational: true,
};

const roleColors = {
  Owner: 'blue',
  Manager: 'green',
  Admin: 'purple',
};

const userColumns = [
  { title: 'Username', dataIndex: 'username', key: 'username' },
  { title: 'Email', dataIndex: 'email', key: 'email' },
  {
    title: 'Role', dataIndex: 'role', key: 'role',
    render: (role) => <Tag color={roleColors[role]}>{role}</Tag>,
  },
  {
    title: 'Status', dataIndex: 'status', key: 'status',
    render: (status) => (
      <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
    ),
  },
  {
    title: 'Actions', key: 'actions',
    render: (_, record) => (
      <Space>
        <Popconfirm
          title="Are you sure you want to deactivate this account?"
          okText="Yes"
          cancelText="No"
          onConfirm={() => console.log('Deactivate:', record.username)}
        >
          <a>Deactivate</a>
        </Popconfirm>
      </Space>
    ),
  },
];

const userData = [
  { key: 1, username: 'owner', email: 'owner@mcm.com', role: 'Owner', status: 'Active' },
  { key: 2, username: 'manager', email: 'manager@mcm.com', role: 'Manager', status: 'Active' },
  { key: 3, username: 'admin', email: 'admin@mcm.com', role: 'Admin', status: 'Active' },
  { key: 4, username: 'manager2', email: 'manager2@mcm.com', role: 'Manager', status: 'Active' },
  { key: 5, username: 'admin2', email: 'admin2@mcm.com', role: 'Admin', status: 'Deactivated' },
  { key: 6, username: 'staff1', email: 'staff1@mcm.com', role: 'Owner', status: 'Active' },
];

const maintenanceColumns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Type', dataIndex: 'type', key: 'type' },
  {
    title: 'Status', dataIndex: 'status', key: 'status',
    render: (status) => (
      <Tag color={status === 'Completed' ? 'green' : status === 'In Progress' ? 'blue' : 'orange'}>
        {status}
      </Tag>
    ),
  },
  { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
];

const maintenanceData = [
  { key: 1, date: '2025-05-10', type: 'Database Optimization', status: 'Completed', remarks: 'Index rebuild and cleanup' },
  { key: 2, date: '2025-05-08', type: 'Security Patch', status: 'Completed', remarks: 'Applied latest security updates' },
  { key: 3, date: '2025-05-05', type: 'Server Maintenance', status: 'Completed', remarks: 'Hardware check and reboot' },
  { key: 4, date: '2025-05-12', type: 'Scheduled Backup', status: 'In Progress', remarks: 'Full system backup' },
  { key: 5, date: '2025-04-28', type: 'Software Update', status: 'Pending', remarks: 'Upgrade to v2.1.0' },
];

const Admin = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>Admin Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Registered Users"
              value={mockStats.totalUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Last Maintenance Date"
              value={mockStats.lastMaintenance}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="System Status"
              value={mockStats.systemOperational ? 'Operational' : 'Issue Detected'}
              valueStyle={{ color: mockStats.systemOperational ? '#52c41a' : '#ff4d4f' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="User Accounts">
            <Table
              dataSource={userData}
              columns={userColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Recent Maintenance Logs">
            <Table
              dataSource={maintenanceData}
              columns={maintenanceColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="System Configuration">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="System Version">v2.1.0</Descriptions.Item>
              <Descriptions.Item label="Database Status">
                <Tag color="green">Connected</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Last Backup Date">2025-05-12</Descriptions.Item>
              <Descriptions.Item label="Hosting Provider">Local Server</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Admin;