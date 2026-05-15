import { useState, useEffect } from 'react';
import {
  Card, Typography, Form, Input, Select, Button, message, Spin, Descriptions,
} from 'antd';
import { UserOutlined, SettingOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title } = Typography;

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm] = Form.useForm();
  const [prefForm] = Form.useForm();

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?user_id=${user.user_id}&usertype=${user.usertype}`);
        const data = await res.json();
        if (data.user_id) {
          profileForm.setFieldsValue({
            email: data.email,
            phone: data.phone,
          });
          prefForm.setFieldsValue({
            theme: data.theme || 'light',
            fontsize: data.fontsize || 'medium',
          });
        }
      } catch {
        message.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleProfileSave = async () => {
    try {
      const values = await profileForm.validateFields();
      setSaving(true);
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          usertype: user.usertype,
          ...values,
        }),
      });
      const data = await res.json();
      if (data.message) {
        message.success('Profile updated');
      } else {
        message.error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePrefSave = async () => {
    try {
      const values = await prefForm.validateFields();
      setSaving(true);
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          usertype: user.usertype,
          ...values,
        }),
      });
      const data = await res.json();
      if (data.message) {
        message.success('Preferences updated');
      } else {
        message.error(data.error || 'Failed to update preferences');
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SettingOutlined /> Settings
      </Title>

      <Card
        title={<span><UserOutlined /> Profile</span>}
        style={{ marginBottom: 16 }}
        size="small"
      >
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Username">{user?.username}</Descriptions.Item>
          <Descriptions.Item label="Role">{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</Descriptions.Item>
        </Descriptions>
        <Form form={profileForm} layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="your@email.com" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Phone number" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleProfileSave} loading={saving}>
              Save Profile
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={<span><SettingOutlined /> Preferences</span>}
        size="small"
      >
        <Form form={prefForm} layout="vertical" style={{ maxWidth: 400 }}>
          <Form.Item name="theme" label="Theme">
            <Select>
              <Select.Option value="light">Light</Select.Option>
              <Select.Option value="dark">Dark</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="fontsize" label="Font Size">
            <Select>
              <Select.Option value="small">Small</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="large">Large</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handlePrefSave} loading={saving}>
              Save Preferences
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
