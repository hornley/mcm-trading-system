import { Table, Card, Select, Tag, message, Space } from 'antd';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const USERTYPE_MAP = {
  1: { label: 'Owner', color: 'gold' },
  2: { label: 'Manager', color: 'blue' },
  3: { label: 'Admin', color: 'purple' },
  4: { label: 'Staff', color: 'default' },
};

const typeOptions = Object.entries(USERTYPE_MAP).map(([key, val]) => ({
  value: Number(key),
  label: val.label,
}));

const columns = [
  { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code' },
  { title: 'Username', dataIndex: 'username', key: 'username' },
  { title: 'Location', dataIndex: 'location', key: 'location' },
  {
    title: 'Role',
    dataIndex: 'usertype',
    key: 'role',
    render: (usertype) => {
      const info = USERTYPE_MAP[usertype];
      return <Tag color={info?.color}>{info?.label}</Tag>;
    },
  },
];

const UserAccess = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/account/users?usertype=${user.usertype}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => Promise.reject(new Error(data.error || 'Failed to load users')));
        }
        return res.json();
      })
      .then(setUsers)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const handleTypeChange = async (targetId, newUsertype) => {
    try {
      const res = await fetch(`/api/account/users/${targetId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_usertype: user.usertype,
          new_usertype: newUsertype,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === targetId ? { ...u, usertype: newUsertype } : u
        )
      );
      message.success('User type updated');
    } catch {
      message.error('Failed to update user type');
    }
  };

  const actionColumn = {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => (
      <Select
        value={record.usertype}
        onChange={(val) => handleTypeChange(record.user_id, val)}
        style={{ width: 110 }}
        size="small"
        disabled={record.user_id === user?.user_id}
        options={typeOptions}
      />
    ),
  };

  return (
    <Card title="Users" style={{ margin: 24 }}>
      <Table
        dataSource={users}
        columns={[...columns, actionColumn]}
        rowKey="user_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default UserAccess;
