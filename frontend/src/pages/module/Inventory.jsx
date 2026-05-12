import { Table, Card } from 'antd';
import { useState, useEffect } from 'react';
import { colors } from '../../theme.js';

const columns = [
  { title: 'ID', dataIndex: 'product_id', key: 'product_id', width: 60 },
  { title: 'Product Name', dataIndex: 'name', key: 'name' },
  { title: 'Category', dataIndex: 'category', key: 'category' },
  { title: 'Price', dataIndex: 'price', key: 'price', render: (v) => `₱${v}` },
  { title: 'Reorder Level', dataIndex: 'reorder_level', key: 'reorder_level' },
];

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="Products" style={{ margin: 24 }}>
      <Table
        dataSource={products}
        columns={columns}
        rowKey="product_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default Inventory;
