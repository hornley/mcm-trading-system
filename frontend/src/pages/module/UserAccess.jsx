import { Table, Card, Select, Tag, message, Typography, Button, Space, Modal } from 'antd';
import { EditOutlined, CloseOutlined, FilterOutlined } from '@ant-design/icons';
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterRole, setFilterRole] = useState(null);
  const [filterLocation, setFilterLocation] = useState(null);
  const [appliedRole, setAppliedRole] = useState(null);
  const [appliedLocation, setAppliedLocation] = useState(null);

  const fetchUsers = (role, location) => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ usertype: user.usertype });
    if (role) params.append('filter_usertype', role);
    if (location) params.append('location_id', location);
    fetch(`/api/account/users?${params}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => Promise.reject(new Error(data.error || 'Failed to load users')));
        }
        return res.json();
      })
      .then(setUsers)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const applyFilter = () => {
    setAppliedRole(filterRole);
    setAppliedLocation(filterLocation);
    setFilterOpen(false);
    fetchUsers(filterRole, filterLocation);
  };

  const resetFilter = () => {
    setFilterRole(null);
    setFilterLocation(null);
    setAppliedRole(null);
    setAppliedLocation(null);
    setFilterOpen(false);
    fetchUsers(null, null);
  };

  const hasActiveFilter = appliedRole || appliedLocation;

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
    { title: 'Username', dataIndex: 'username', key: 'username', sorter: (a, b) => a.username.localeCompare(b.username) },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      sorter: (a, b) => a.location_id - b.location_id,
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
      sorter: (a, b) => a.usertype - b.usertype,
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
        <Space>
          <Button icon={<FilterOutlined />} type={hasActiveFilter ? 'primary' : 'default'} onClick={() => setFilterOpen(true)}>
            Filter{hasActiveFilter ? ' (1)' : ''}
          </Button>
          <Button icon={editing ? <CloseOutlined /> : <EditOutlined />} onClick={() => setEditing(!editing)}>
            {editing ? 'Done Editing' : 'Edit'}
          </Button>
        </Space>
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
      <Modal
        title="Filter Users"
        open={filterOpen}
        onCancel={() => { setFilterOpen(false); setFilterRole(appliedRole); setFilterLocation(appliedLocation); }}
        footer={
          <Space>
            <Button onClick={resetFilter}>Reset</Button>
            <Button type="primary" onClick={applyFilter}>Apply</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>Role</Typography.Text>
            <Select
              allowClear
              placeholder="All Roles"
              value={filterRole}
              onChange={setFilterRole}
              style={{ width: '100%', marginTop: 4 }}
              options={[{ value: null, label: 'All' }, ...typeOptions]}
            />
          </div>
          <div>
            <Typography.Text strong>Location</Typography.Text>
            <Select
              allowClear
              placeholder="All Locations"
              value={filterLocation}
              onChange={setFilterLocation}
              style={{ width: '100%', marginTop: 4 }}
              options={[{ value: null, label: 'All' }, ...LOCATIONS.map((l) => ({ value: l.id, label: l.name }))]}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default UserAccess;