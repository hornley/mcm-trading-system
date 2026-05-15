import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Typography } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext.jsx';
import { colors } from '../../theme';

const COLORS = ['#5b7ff0', '#aac4f5'];

const Owner = () => {
  const { user, selectedLocationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: { total_items: 0, sales_today: 0, low_stock_count: 0, active_users: 0 },
    stock_by_category: [],
    stock_movement: [],
    recent_transactions: [],
  });

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({
      usertype: user?.usertype,
      location_id: selectedLocationId,
    });
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
  }, [user, selectedLocationId]);

  const { stats, stock_by_category, stock_movement, recent_transactions } = data;

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Owner Dashboard</Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Total Inventory Items" value={stats.total_items} loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Sales Today" value={stats.sales_today} prefix="₱" loading={loading} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Low Stock Alerts" value={stats.low_stock_count} valueStyle={{ color: colors.error }} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Active Users" value={stats.active_users} loading={loading} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Stock Movement (Last 7 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stock_movement}>
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
          <Card title="Stock by Category">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stock_by_category.length > 0 ? stock_by_category : [{ name: 'No Data', value: 1 }]}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
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
          <Card title="Recent Transactions">
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
  );
};

export default Owner;
