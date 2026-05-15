import { Row, Col, Card, Statistic, Table, Tag, Typography } from 'antd';
import {
  DatabaseOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

const COLORS = ['#5b7ff0', '#fa8c16'];

const mockStats = {
  totalItems: 487,
  salesToday: 23,
  lowStockAlerts: 8,
  totalStaff: 12,
};

const stockMovement = [
  { day: 'Mon', stockIn: 42, stockOut: 28 },
  { day: 'Tue', stockIn: 55, stockOut: 33 },
  { day: 'Wed', stockIn: 31, stockOut: 39 },
  { day: 'Thu', stockIn: 48, stockOut: 27 },
  { day: 'Fri', stockIn: 62, stockOut: 45 },
  { day: 'Sat', stockIn: 25, stockOut: 19 },
  { day: 'Sun', stockIn: 36, stockOut: 22 },
];

const stockByCategory = [
  { name: 'Textiles', value: 352 },
  { name: 'Miscellaneous', value: 135 },
];

const recentSalesColumns = [
  { title: 'Product', dataIndex: 'product', key: 'product' },
  { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
  { title: 'Amount', dataIndex: 'amount', key: 'amount' },
  { title: 'Date', dataIndex: 'date', key: 'date' },
];

const recentSalesData = [
  { key: 1, product: 'Cotton Fabric', quantity: 10, amount: '₱2,500', date: '2025-05-15' },
  { key: 2, product: 'Polyester Thread', quantity: 25, amount: '₱875', date: '2025-05-15' },
  { key: 3, product: 'Silk Blend', quantity: 5, amount: '₱3,200', date: '2025-05-14' },
  { key: 4, product: 'Denim Roll', quantity: 8, amount: '₱4,000', date: '2025-05-14' },
  { key: 5, product: 'Lace Trim', quantity: 15, amount: '₱1,125', date: '2025-05-13' },
];

const lowStockColumns = [
  { title: 'Product Name', dataIndex: 'name', key: 'name' },
  { title: 'Category', dataIndex: 'category', key: 'category' },
  { title: 'Current Stock', dataIndex: 'currentStock', key: 'currentStock' },
  {
    title: 'Status',
    key: 'status',
    render: () => <Tag color="orange">Low Stock</Tag>,
  },
];

const lowStockData = [
  { key: 1, name: 'HI-PILE', category: 'Textiles', currentStock: 3 },
  { key: 2, name: '3MM PRINTED FUR', category: 'Textiles', currentStock: 5 },
  { key: 3, name: 'VELBOA KOREA', category: 'Textiles', currentStock: 4 },
  { key: 4, name: 'SUEDE GAMOSA', category: 'Textiles', currentStock: 2 },
  { key: 5, name: 'LAMB FUR 2323', category: 'Textiles', currentStock: 1 },
];

const Manager = () => {
  const { user } = useAuth();
  const branchName = user?.location || 'Main Store';

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>Manager Dashboard</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Branch: {branchName}
      </Text>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Inventory Items"
              value={mockStats.totalItems}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Sales Today"
              value={mockStats.salesToday}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Low Stock Alerts"
              value={mockStats.lowStockAlerts}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Staff"
              value={mockStats.totalStaff}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement — Last 7 Days">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockMovement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="stockIn" fill="#52c41a" name="Stock In" />
                <Bar dataKey="stockOut" fill="#ff4d4f" name="Stock Out" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Stock by Category">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockByCategory}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stockByCategory.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx]} />
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
          <Card title="Recent Sales">
            <Table
              dataSource={recentSalesData}
              columns={recentSalesColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Low Stock Items">
            <Table
              dataSource={lowStockData}
              columns={lowStockColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Manager;