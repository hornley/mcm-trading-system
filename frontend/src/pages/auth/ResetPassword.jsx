import { Card, Button, Input, message, Typography, Form, Space } from 'antd'
import { LockOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

const { Title, Text } = Typography

const ResetPassword = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)
  const [checking, setChecking] = useState(true)
  const [passwordValidation, setPasswordValidation] = useState({
    length: null,
    uppercase: null,
    lowercase: null,
    special: null,
    number: null,
  })
  const [confirmPasswordMatch, setConfirmPasswordMatch] = useState(false)

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/reset/${token}`)
        const data = await res.json()
        if (!res.ok || !data.valid) {
          setTokenValid(false)
          message.error('Invalid or expired reset link')
        }
      } catch {
        setTokenValid(false)
        message.error('Failed to verify token')
      } finally {
        setChecking(false)
      }
    }
    verifyToken()
  }, [token])

  const handleSubmit = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match')
      return
    }

    const pwdCheck = {
      length: values.newPassword.length >= 6,
      uppercase: /[A-Z]/.test(values.newPassword),
      lowercase: /[a-z]/.test(values.newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(values.newPassword),
      number: /[0-9]/.test(values.newPassword),
    }

    if (!pwdCheck.length || !pwdCheck.uppercase || !pwdCheck.lowercase || !pwdCheck.special || !pwdCheck.number) {
      message.error('Password does not meet requirements')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: values.newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        message.success('Password reset successfully')
        navigate('/login')
      } else {
        message.error(data.error || 'Failed to reset password')
      }
    } catch {
      message.error('Connection error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Card style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Title level={4}>Verifying...</Title>
          </div>
        </Card>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Card style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Title level={4} style={{ color: '#ff4d4f' }}>Invalid Link</Title>
            <Text type="secondary">This reset link is invalid or has expired.</Text>
            <div style={{ marginTop: 24 }}>
              <Button type="primary" onClick={() => navigate('/forgot-password')}>
                Request New Link
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <Card
        style={{ width: 420, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>Reset Password</Title>
          <Typography.Text type="secondary">Enter your new password</Typography.Text>
        </div>
        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item 
            name="newPassword" 
            label={<span>New Password {passwordValidation.length && passwordValidation.uppercase && passwordValidation.lowercase && passwordValidation.special && passwordValidation.number && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}</span>}
            rules={[{ required: true, message: 'Enter new password' }]}
          >
            <Input.Password 
              placeholder="Enter new password"
              onChange={(e) => {
                const pwd = e.target.value
                if (!pwd) {
                  setPasswordValidation({ length: null, uppercase: null, lowercase: null, special: null, number: null })
                } else {
                  setPasswordValidation({
                    length: pwd.length >= 6,
                    uppercase: /[A-Z]/.test(pwd),
                    lowercase: /[a-z]/.test(pwd),
                    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
                    number: /[0-9]/.test(pwd),
                  })
                }
              }}
            />
          </Form.Item>
          <ul style={{ margin: '0 0 16px 0', paddingLeft: 20, fontSize: 13, color: '#888', listStyleType: 'disc' }}>
            <li style={{ color: !passwordValidation.length ? '#ff4d4f' : '#888' }}>Minimum 6 characters</li>
            <li style={{ color: !passwordValidation.uppercase ? '#ff4d4f' : '#888' }}>One uppercase character</li>
            <li style={{ color: !passwordValidation.lowercase ? '#ff4d4f' : '#888' }}>One lowercase character</li>
            <li style={{ color: !passwordValidation.special ? '#ff4d4f' : '#888' }}>One special character</li>
            <li style={{ color: !passwordValidation.number ? '#ff4d4f' : '#888' }}>One number</li>
          </ul>
          <div style={{ marginBottom: 16 }} />
          <Form.Item 
            name="confirmPassword" 
            label={<span>Confirm New Password {confirmPasswordMatch && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}</span>}
            rules={[
              { required: true, message: 'Confirm new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    setConfirmPasswordMatch(value && getFieldValue('newPassword') === value)
                    return Promise.resolve()
                  }
                  setConfirmPasswordMatch(false)
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" onChange={() => setConfirmPasswordMatch(false)} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ borderRadius: 8 }}>
              Reset Password
            </Button>
          </Form.Item>
        </Form>
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/login')}>
            Back to Login
          </Button>
        </Space>
      </Card>
    </div>
  )
}

export default ResetPassword