import { Table, Card } from 'antd';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const columns = [
  { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code' },
  { title: 'Username', dataIndex: 'username', key: 'username' },
  { title: 'Location', dataIndex: 'location', key: 'location' },
];

const UserAccess = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/account/users?usertype=${user.usertype}`)
      .then((res) => res.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <Card title="Users" style={{ margin: 24 }}>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="user_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default UserAccess;
