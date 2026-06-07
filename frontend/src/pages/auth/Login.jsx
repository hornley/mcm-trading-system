import { useState } from 'react'
import { Button, Input, message, Typography, Form } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import bgImage from '../../../images/mancoImage.png'
import logoImage from '../../../images/Manco.png'

const { Text } = Typography

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
        console.error('Login 500:', data)
        message.error(data.error || data.message || 'Server error')
        return
      }
      login(data)
      navigate(`/dashboard/${data.role}`)
    } catch (e) {
      console.error('Login request failed:', e)
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
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px 44px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <img src={logoImage} alt="Manco Trading" style={{ width: 270, height: 'auto' }} />
          </div>

          <Form layout="vertical" onFinish={handleLogin} autoComplete="off" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]} style={{ marginBottom: 24 }}>
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf', fontSize: 18 }} />}
                placeholder="Username"
                size="large"
                style={{ borderRadius: 12, height: 56, fontSize: 16, paddingLeft: 14 }}
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]} style={{ marginBottom: 32 }}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf', fontSize: 18 }} />}
                placeholder="Password"
                size="large"
                style={{ borderRadius: 12, height: 56, fontSize: 16, paddingLeft: 14 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{ borderRadius: 12, height: 58, fontWeight: 700, fontSize: 17 }}
              >
                Sign in
              </Button>
            </Form.Item>
          </Form>
        </div>

        <div style={{
          padding: '20px 44px',
          textAlign: 'center',
          borderTop: '1px solid #f0f0f0',
        }}>
          <Text style={{ color: '#8c8c8c', fontSize: 13 }}>
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
