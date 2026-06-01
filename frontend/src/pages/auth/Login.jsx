import { Card, Button, Input, message, Typography, Form } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'

const { Title } = Typography

const Login = () => {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (values) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.error)
        return
      }
      login(data)
      navigate(`/dashboard/${data.role}`)
    } catch {
      message.error('Connection error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      style={{ width: 400, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      styles={{ body: { padding: '40px 32px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3} style={{ margin: 0 }}>Welcome Back</Title>
        <Typography.Text type="secondary">Sign in to your account</Typography.Text>
      </div>
      <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
        <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
          <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ borderRadius: 8 }}>
            Login
          </Button>
        </Form.Item>
      </Form>

    </Card>
  )
}

export default Login