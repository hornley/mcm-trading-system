import { Table, Card, Select, Tag, message, Typography, Button, Space } from 'antd';
import { EditOutlined, CloseOutlined } from '@ant-design/icons';
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

const UserAccess = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

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
        body: JSON.stringify({ requester_usertype: user.usertype, new_usertype: newUsertype }),
      });
      const data = await res.json();
      if (!res.ok) { message.error(data.error); return; }
      setUsers((prev) => prev.map((u) => u.user_id === targetId ? { ...u, usertype: newUsertype } : u));
      message.success('Role updated');
    } catch { message.error('Failed to update role'); }
  };

  const handleLocationChange = async (targetId, newLocationId) => {
    try {
      const res = await fetch(`/api/account/users/${targetId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_usertype: user.usertype, location_id: newLocationId }),
      });
      const data = await res.json();
      if (!res.ok) { message.error(data.error); return; }
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === targetId
            ? { ...u, location_id: newLocationId, location: LOCATIONS.find((l) => l.id === newLocationId)?.name || u.location }
            : u
        )
      );
      message.success('Location updated');
    } catch { message.error('Failed to update location'); }
  };

  const columns = [
    { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc, record) =>
        editing ? (
          <Select
            value={record.location_id}
            onChange={(val) => handleLocationChange(record.user_id, val)}
            size="small"
            style={{ width: '100%' }}
            disabled={record.usertype === 1 || record.user_id === user?.user_id}
            options={LOCATIONS.map((l) => ({ value: l.id, label: l.name }))}
          />
        ) : (
          loc
        ),
    },
    {
      title: 'Role',
      dataIndex: 'usertype',
      key: 'role',
      render: (usertype, record) =>
        editing ? (
          <Select
            value={usertype}
            onChange={(val) => handleTypeChange(record.user_id, val)}
            size="small"
            style={{ width: '100%' }}
            disabled={record.user_id === user?.user_id}
            options={typeOptions}
          />
        ) : (
          <Tag color={USERTYPE_MAP[usertype]?.color}>{USERTYPE_MAP[usertype]?.label}</Tag>
        ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>User Access</Title>
        <Button icon={editing ? <CloseOutlined /> : <EditOutlined />} onClick={() => setEditing(!editing)}>
          {editing ? 'Done Editing' : 'Edit'}
        </Button>
      </Space>
      <Card styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="user_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default UserAccess;