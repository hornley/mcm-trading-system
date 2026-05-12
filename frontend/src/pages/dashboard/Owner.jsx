import { Card, Row, Col, Statistic, Table, Tag, Typography } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { colors } from '../../theme';

const COLORS = ['#5b7ff0', '#aac4f5'];

const mockStats = {
  totalItems: 1284,
  salesToday: 47,
  lowStockAlerts: 12,
  activeUsers: 36,
};

const branchData = [
  {
    name: 'Main Store',
    total: 720,
    lowStock: 5,
    stockSplit: [
      { name: 'Textiles', value: 480 },
      { name: 'Miscellaneous', value: 240 },
    ],
  },
  {
    name: 'Storehouse',
    total: 564,
    lowStock: 7,
    stockSplit: [
      { name: 'Textiles', value: 320 },
      { name: 'Miscellaneous', value: 244 },
    ],
  },
];

const stockMovement = [
  { day: 'Mon', in: 45, out: 32 },
  { day: 'Tue', in: 52, out: 28 },
  { day: 'Wed', in: 38, out: 41 },
  { day: 'Thu', in: 61, out: 35 },
  { day: 'Fri', in: 47, out: 44 },
  { day: 'Sat', in: 29, out: 22 },
  { day: 'Sun', in: 33, out: 18 },
];

const recentSalesColumns = [
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
];

const recentSalesData = [
  { key: 1, product: 'Cotton Fabric', quantity: 10, amount: '₱2,500', branch: 'Main Store', status: 'Completed' },
  { key: 2, product: 'Polyester Thread', quantity: 25, amount: '₱875', branch: 'Storehouse', status: 'Completed' },
  { key: 3, product: 'Silk Blend', quantity: 5, amount: '₱3,200', branch: 'Main Store', status: 'Pending' },
  { key: 4, product: 'Denim Roll', quantity: 8, amount: '₱4,000', branch: 'Storehouse', status: 'Completed' },
  { key: 5, product: 'Lace Trim', quantity: 15, amount: '₱1,125', branch: 'Main Store', status: 'Completed' },
];

const Owner = () => {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Owner Dashboard</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Inventory Items" value={mockStats.totalItems} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Sales Today" value={mockStats.salesToday} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Low Stock Alerts" value={mockStats.lowStockAlerts} valueStyle={{ color: colors.error }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Active Users" value={mockStats.activeUsers} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {branchData.map((branch) => (
          <Col xs={24} sm={12} key={branch.name}>
            <Card title={branch.name}>
              <Row align="middle">
                <Col span={12}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={branch.stockSplit}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        dataKey="value"
                      >
                        {branch.stockSplit.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Col>
                <Col span={12}>
                  <Statistic title="Total Items" value={branch.total} />
                  <div style={{ marginTop: 16 }}>
                    <Statistic title="Low Stock" value={branch.lowStock} valueStyle={{ color: colors.error }} />
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement (Last 7 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockMovement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="in" fill={colors.success} name="Stock In" />
                <Bar dataKey="out" fill={colors.error} name="Stock Out" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Recent Transactions">
            <Table dataSource={recentSalesData} columns={recentSalesColumns} pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Owner;
