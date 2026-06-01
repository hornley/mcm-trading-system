import { Card, Row, Col, Button, Typography, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import { ShoppingCartOutlined, TeamOutlined, SafetyOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <div style={{ textAlign: 'center', maxWidth: 600, width: '100%' }}>
      <Card
        style={{ borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        styles={{ body: { padding: '48px 32px' } }}
      >
        <Title level={2} style={{ marginBottom: 8 }}>Manco (MCM) Trading</Title>
        <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 32 }}>
          Shop Management System
        </Text>

        <Paragraph style={{ color: '#595959', marginBottom: 40, fontSize: 14 }}>
          Manage inventory, track sales, monitor stock levels, and oversee business operations — all in one place.
        </Paragraph>

        <Row gutter={[16, 16]} style={{ marginBottom: 40 }}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <ShoppingCartOutlined style={{ fontSize: 28, color: '#5b7ff0', marginBottom: 8 }} />
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Inventory</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <TeamOutlined style={{ fontSize: 28, color: '#5b7ff0', marginBottom: 8 }} />
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Staff</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <SafetyOutlined style={{ fontSize: 28, color: '#5b7ff0', marginBottom: 8 }} />
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>Reports</Text>
            </div>
          </Col>
        </Row>

        <Space size={16}>
          <Button type="primary" size="large" onClick={() => navigate('/login')} style={{ borderRadius: 8, paddingInline: 32 }}>
            Login
          </Button>
        </Space>
      </Card>
    </div>
  )
}

export default LandingPage