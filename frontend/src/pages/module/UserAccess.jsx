import { Table, Card, Select, Tag, message, Space, Typography } from 'antd';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;

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

const LOCATIONS = [
  { id: 1, name: 'Storehouse' },
  { id: 2, name: 'Main Store' },
  { id: 3, name: 'Branch 2' },
];

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

  const handleLocationChange = async (targetId, newLocationId) => {
    try {
      const res = await fetch(`/api/account/users/${targetId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_usertype: user.usertype,
          location_id: newLocationId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === targetId
            ? { ...u, location_id: newLocationId, location: LOCATIONS.find((l) => l.id === newLocationId)?.name || u.location }
            : u
        )
      );
      message.success('Location updated');
    } catch {
      message.error('Failed to update location');
    }
  };

  const actionColumn = {
    title: 'Actions',
    key: 'actions',
    render: (_, record) => (
      <Space size={4}>
        <Select
          value={record.usertype}
          onChange={(val) => handleTypeChange(record.user_id, val)}
          style={{ width: 100 }}
          size="small"
          disabled={record.user_id === user?.user_id}
          options={typeOptions}
        />
        <Select
          value={record.location_id}
          onChange={(val) => handleLocationChange(record.user_id, val)}
          style={{ width: 120 }}
          size="small"
          disabled={record.usertype === 1 || record.user_id === user?.user_id}
          options={LOCATIONS.map((l) => ({ value: l.id, label: l.name }))}
        />
      </Space>
    ),
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>User Access</Title>
      <Card styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
        <Table
        dataSource={users}
        columns={[...columns, actionColumn]}
        rowKey="user_id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      </Card>
    </div>
  );
};

export default UserAccess;