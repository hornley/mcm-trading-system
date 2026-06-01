import { useState } from 'react'
import { Button, Input, message, Typography, Form } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import bgImage from '../../../images/mancoImage.png'

const { Title, Text } = Typography

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
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Sign In</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>Welcome back! Please enter your details.</Text>
            </div>

            <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
              <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
                <Input
                  prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="Username"
                  size="large"
                  style={{ borderRadius: 10, height: 48 }}
                />
              </Form.Item>

              <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="Password"
                  size="large"
                  style={{ borderRadius: 10, height: 48 }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                  style={{ borderRadius: 10, height: 48, fontWeight: 600, fontSize: 15 }}
                >
                  Sign in
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>

        <div style={{
          padding: '16px 40px',
          textAlign: 'center',
          borderTop: '1px solid #f0f0f0',
        }}>
          <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
            &copy; {new Date().getFullYear()} Manco (MCM) Trading. All rights reserved.
          </Text>
        </div>
      </div>

      <div style={{
        flex: 3,
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />
    </div>
  )
}

export default Login
