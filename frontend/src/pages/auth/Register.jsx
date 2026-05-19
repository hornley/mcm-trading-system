import { Card, Button, Input, message, Typography, Form, Space } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, HomeOutlined, PhoneOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const { Title } = Typography

const Register = () => {
  const [loading, setLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const navigate = useNavigate()

  const handleRegister = async (values) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.error)
        return
      }
      message.success('Registration successful! You can now log in.')
      navigate('/login')
    } catch {
      message.error('Connection error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      styles={{ body: { padding: '40px 32px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ margin: 0 }}>Create Account</Title>
        <Typography.Text type="secondary">Register for a new account</Typography.Text>
      </div>
      <Form layout="vertical" onFinish={handleRegister} autoComplete="off">
        <Form.Item name="username" rules={[{ required: true, message: 'Please enter a username' }]}>
          <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
          <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Please enter a password' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
        </Form.Item>
        <Form.Item name="address">
          <Input prefix={<HomeOutlined />} placeholder="Address (optional)" size="large" />
        </Form.Item>
        <Form.Item name="phoneNumber" extra={phoneError ? <span style={{ color: '#ff4d4f', fontSize: 12 }}>{phoneError}</span> : null}>
          <Input 
            prefix={<><PhoneOutlined /> <span style={{ color: '#666', marginLeft: 4 }}>63+</span></>} 
            placeholder="9XXXXXXXXX" 
            size="large"
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value && !value.startsWith('639')) {
                setPhoneError('Invalid number');
              } else {
                setPhoneError('');
              }
            }}
            maxLength={10}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ borderRadius: 8 }}>
            Register
          </Button>
        </Form.Item>
      </Form>
      <Space style={{ width: '100%', justifyContent: 'center' }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Space>
    </Card>
  )
}

export default Register