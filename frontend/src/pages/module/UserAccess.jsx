import { Table, Card, Select, Tag, message, Typography, Button, Space, Modal, Input, Form } from 'antd';
import { EditOutlined, CloseOutlined, FilterOutlined, UserAddOutlined, MailOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;

const USERTYPE_MAP = {
  1: { label: 'Owner', color: 'gold' },
  2: { label: 'Manager', color: 'blue' },
  3: { label: 'Admin', color: 'purple' },
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
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerForm] = Form.useForm();

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

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortField || !sortOrder) return 0;
    let cmp;
    if (sortField === 'username') cmp = a.username.localeCompare(b.username);
    else if (sortField === 'location_id') cmp = a.location_id - b.location_id;
    else if (sortField === 'usertype') cmp = a.usertype - b.usertype;
    return sortOrder === 'ascend' ? cmp : -cmp;
  });

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

  const handleRegister = async (values) => {
    setRegisterLoading(true);
    try {
      const payload = { ...values };
      if (payload.phone) payload.phone = '63' + payload.phone;
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { message.error(data.error); return; }
      message.success('Account created successfully');
      setRegisterOpen(false);
      registerForm.resetFields();
      fetchUsers();
    } catch {
      message.error('Failed to create account');
    } finally {
      setRegisterLoading(false);
    }
  };

  const columns = [
    { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code' },
    { title: 'Username', dataIndex: 'username', key: 'username', sorter: (a, b) => a.username.localeCompare(b.username), sortDirections: ['ascend', 'descend'] },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location_id',
      sorter: (a, b) => a.location_id - b.location_id,
      sortDirections: ['ascend', 'descend'],
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
      key: 'usertype',
      sorter: (a, b) => a.usertype - b.usertype,
      sortDirections: ['ascend', 'descend'],
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
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setRegisterOpen(true)}>
            Create account
          </Button>
        </Space>
      </Space>
      <Card styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
        <Table
          dataSource={sortedUsers}
          columns={columns}
          rowKey="user_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          onChange={(_pagination, _filters, sorter) => {
            if (Array.isArray(sorter)) sorter = sorter[0];
            setSortField(sorter.columnKey || null);
            setSortOrder(sorter.order || null);
          }}
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
      <Modal
        title="Create Account"
        open={registerOpen}
        onCancel={() => { setRegisterOpen(false); registerForm.resetFields(); }}
        footer={[
          <Button key="cancel" onClick={() => { setRegisterOpen(false); registerForm.resetFields(); }}>Cancel</Button>,
          <Button key="create" type="primary" loading={registerLoading} onClick={() => registerForm.submit()}>Create</Button>,
        ]}
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter a username' }]}>
            <Input prefix={<UserAddOutlined />} placeholder="Username" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input prefix={<MailOutlined />} placeholder="Email" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter a password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item name="usertype" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select placeholder="Select role" options={typeOptions} />
          </Form.Item>
          <Form.Item name="location_id" label="Location" rules={[{ required: true, message: 'Please select a location' }]}>
            <Select placeholder="Select location" options={LOCATIONS.map((l) => ({ value: l.id, label: l.name }))} />
          </Form.Item>
          <Form.Item name="phone" label="Phone (optional)" rules={[
            { validator: (_, value) => {
              if (!value) return Promise.resolve();
              if (!/^\d+$/.test(value)) return Promise.reject(new Error('Numbers only'));
              if (value.length !== 10) return Promise.reject(new Error('Must be 10 digits'));
              return Promise.resolve();
            }},
          ]}>
            <Input prefix={<><PhoneOutlined /><span style={{ color: '#666', marginLeft: 4 }}>63+</span></>} maxLength={10} placeholder="9123456789" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserAccess;