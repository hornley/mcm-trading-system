import { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Form, Input, Select, Button, message,
  Spin, Descriptions, Menu,
} from 'antd';
import {
  UserOutlined, SettingOutlined, SaveOutlined, LockOutlined,
  BellOutlined,   BgColorsOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

const Settings = () => {
  const { user, setTheme, setFontSize } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm] = Form.useForm();
  const [prefForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [passwordValidation, setPasswordValidation] = useState({
    length: null,
    uppercase: null,
    lowercase: null,
    special: null,
    number: null,
  });
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [oldPasswordEntered, setOldPasswordEntered] = useState(false);
  const [oldPasswordValid, setOldPasswordValid] = useState(false);
  const [confirmPasswordMatch, setConfirmPasswordMatch] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?user_id=${user.user_id}&usertype=${user.usertype}`);
        const data = await res.json();
        if (data.user_id) {
          const phoneValue = data.phone && data.phone.startsWith('63') ? data.phone.slice(2) : data.phone;
          profileForm.setFieldsValue({
            email: data.email,
            phone: phoneValue,
          });
          prefForm.setFieldsValue({
            theme: data.theme || 'light',
            fontsize: data.fontsize || 'medium',
          });
          setTheme(data.theme || 'light');
          setFontSize(data.fontsize || 'medium');
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
      const phoneValue = values.phone ? '63' + values.phone : values.phone;
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          usertype: user.usertype,
          phone: phoneValue,
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
        setTheme(values.theme);
        setFontSize(values.fontsize);
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

  const handlePasswordChange = async () => {
    try {
      const values = await passwordForm.validateFields();
      const { oldPassword, newPassword, confirmPassword } = values;
      
      setPasswordSubmitted(true);
      
      const pwdCheck = {
        length: newPassword.length >= 6,
        uppercase: /[A-Z]/.test(newPassword),
        lowercase: /[a-z]/.test(newPassword),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
        number: /[0-9]/.test(newPassword),
      };
      
      setPasswordValidation(pwdCheck);
      
      if (!pwdCheck.length || !pwdCheck.uppercase || !pwdCheck.lowercase || !pwdCheck.special || !pwdCheck.number) {
        return;
      }

      if (newPassword !== confirmPassword) {
        message.error('Passwords do not match');
        return;
      }

      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.message) {
        message.success('Password changed successfully');
        passwordForm.resetFields();
        setPasswordValidation({ length: null, uppercase: null, lowercase: null, special: null, number: null });
        setPasswordSubmitted(false);
      } else {
        message.error(data.error || 'Failed to change password');
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to change password');
    }
  };

  if (loading) return <Card style={{ textAlign: 'center' }}><Spin size="large" /></Card>;

  const menuItems = [
    { key: 'account', icon: <UserOutlined />, label: 'Account Information' },
    { key: 'password', icon: <LockOutlined />, label: 'Change Password' },
    { key: 'notifications', icon: <BellOutlined />, label: 'Notifications' },
    { key: 'personalization', icon: <BgColorsOutlined />, label: 'Personalization' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Username">{user?.username}</Descriptions.Item>
              <Descriptions.Item label="Role">{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</Descriptions.Item>
            </Descriptions>
            <Form form={profileForm} layout="vertical" style={{ maxWidth: 400 }}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
                <Input placeholder="your@email.com" />
              </Form.Item>
              <Form.Item name="phone" label="Phone" rules={[
                { required: false },
                { validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (!/^\d+$/.test(value)) {
                    return Promise.reject(new Error('Invalid number'));
                  }
                  const fullNumber = '63' + value;
                  if (fullNumber.length !== 12 || !fullNumber.startsWith('63')) {
                    return Promise.reject(new Error('Invalid number'));
                  }
                  return Promise.resolve();
                }, validateTrigger: 'onSubmit' },
              ]}>
                <Input prefix={<span style={{ color: '#666' }}>63+</span>} maxLength={10} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleProfileSave} loading={saving}>
                  Save Profile
                </Button>
              </Form.Item>
            </Form>
          </>
        );
      case 'password':
        return (
          <Form form={passwordForm} layout="vertical" style={{ maxWidth: 400 }}>
            <Form.Item 
              name="oldPassword" 
              label={<span>Old Password {oldPasswordValid && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}</span>} 
              rules={[{ required: true, message: 'Enter old password' }]}
            >
              <Input.Password 
                placeholder="Enter old password" 
                onChange={() => {
                  setOldPasswordValid(false);
                  setOldPasswordEntered(false);
                }}
                onBlur={async (e) => {
                  const pwd = e.target.value;
                  if (!pwd) return;
                  setOldPasswordEntered(true);
                  try {
                    const res = await fetch('/api/settings/verify-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: user.user_id, password: pwd }),
                    });
                    const data = await res.json();
                    setOldPasswordValid(data.valid);
                  } catch {
                    setOldPasswordValid(false);
                  }
                }}
              />
            </Form.Item>
            <Form.Item 
              name="newPassword" 
              label={<span>New Password {passwordValidation.length && passwordValidation.uppercase && passwordValidation.lowercase && passwordValidation.special && passwordValidation.number && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}</span>}
              rules={[{ required: true, message: 'Enter new password' }]}
            >
              <Input.Password 
                placeholder="Enter new password"
                onChange={(e) => {
                  const pwd = e.target.value;
                  setPasswordSubmitted(false);
                  if (!pwd) {
                    setPasswordValidation({ length: null, uppercase: null, lowercase: null, special: null, number: null });
                  } else {
                    setPasswordValidation({
                      length: pwd.length >= 6,
                      uppercase: /[A-Z]/.test(pwd),
                      lowercase: /[a-z]/.test(pwd),
                      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
                      number: /[0-9]/.test(pwd),
                    });
                  }
                }}
              />
            </Form.Item>
            {passwordSubmitted && (
              <>
                <div style={{ color: '#ff4d4f', marginBottom: 8, fontWeight: 500 }}>
                  Please add all necessary characters to proceed:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#888', listStyleType: 'disc' }}>
                <li style={{ color: passwordSubmitted && !passwordValidation.length ? '#ff4d4f' : '#888' }}>
                  Minimum 6 characters
                </li>
                <li style={{ color: passwordSubmitted && !passwordValidation.uppercase ? '#ff4d4f' : '#888' }}>
                  One uppercase character
                </li>
                <li style={{ color: passwordSubmitted && !passwordValidation.lowercase ? '#ff4d4f' : '#888' }}>
                  One lowercase character
                </li>
                <li style={{ color: passwordSubmitted && !passwordValidation.special ? '#ff4d4f' : '#888' }}>
                  One special character
                </li>
                <li style={{ color: passwordSubmitted && !passwordValidation.number ? '#ff4d4f' : '#888' }}>
                  One number
                </li>
              </ul>
              </>
            )}
            <Form.Item 
              name="confirmPassword" 
              label={<span>Confirm New Password {confirmPasswordMatch && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}</span>}
              rules={[
                { required: true, message: 'Confirm new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      setConfirmPasswordMatch(value && getFieldValue('newPassword') === value);
                      return Promise.resolve();
                    }
                    setConfirmPasswordMatch(false);
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm new password" onChange={() => setConfirmPasswordMatch(false)} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" block onClick={handlePasswordChange}>
                Change Password
              </Button>
            </Form.Item>
            <div style={{ textAlign: 'center' }}>
              <a href="/forgot-password" style={{ fontSize: 13 }}>Forgot Password?</a>
            </div>
          </Form>
        );
      case 'notifications':
        return (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Text type="secondary">Notification settings coming soon.</Text>
          </div>
        );
      case 'personalization':
        return (
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
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SettingOutlined /> Settings
      </Title>
      <Row gutter={24}>
        <Col xs={24} sm={6}>
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Menu
              mode="inline"
              selectedKeys={[activeTab]}
              onClick={({ key }) => setActiveTab(key)}
              items={menuItems}
              style={{ border: 'none' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={18}>
          <Card size="small">
            {renderContent()}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Settings;
