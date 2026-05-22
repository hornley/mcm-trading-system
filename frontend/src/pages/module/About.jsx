import { Typography, Row, Col, Card, Avatar, Descriptions, Space } from 'antd'
import { UserOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const developers = [
  { name: 'Buendia Harley Albert C.', role: 'Project Manager & Full Stack Developer' },
  { name: 'Ferrer Jeremy Christian S.', role: 'Backend Developer & Database Administrator' },
  { name: 'Rodriguez Dave Matthew', role: 'Frontend Developer & UI/UX Designer' },
]

const About = () => {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>About</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="About the Company" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <Paragraph>
              Manco (MCM) Trading is a marketing, distribution, sourcing, and trading company
              located in Binondo, Manila. Founded in 1980 by Rodney Uyan, the company specializes
              in novelty textiles and shoe products, serving a wide range of clients across the
              Philippines.
            </Paragraph>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Company Name">Manco (MCM) Trading</Descriptions.Item>
              <Descriptions.Item label="Location">Binondo, Manila</Descriptions.Item>
              <Descriptions.Item label="Founded">1980</Descriptions.Item>
              <Descriptions.Item label="Owner">Rodney Uyan</Descriptions.Item>
              <Descriptions.Item label="Product Categories">Novelty Textiles and Shoe Products</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="About the System" styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
            <Paragraph>
              The Web-Based Store Management System was developed to modernize and replace
              the manual inventory and sales tracking of Manco (MCM) Trading. It provides
              a centralized platform for managing products, stock levels, sales transactions,
              user access, and reporting.
            </Paragraph>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="System Name">MCM Trading Shop Management System</Descriptions.Item>
              <Descriptions.Item label="Version">v2.1.0</Descriptions.Item>
              <Descriptions.Item label="Platform">Web</Descriptions.Item>
              <Descriptions.Item label="Developed By">Team FanThree</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="The Development Team" style={{ marginTop: 16 }} styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
        <Row gutter={[16, 16]} justify="center">
          {developers.map((dev) => (
            <Col xs={24} sm={12} lg={8} key={dev.name}>
              <Card styles={{ body: { padding: '24px', textAlign: 'center' } }}>
                <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#5b7ff0', marginBottom: 12 }} />
                <Title level={5} style={{ marginBottom: 4 }}>{dev.name}</Title>
                <Text type="secondary">{dev.role}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="Technologies Used" style={{ marginTop: 16 }} styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Frontend">React 19, Ant Design 6, Recharts</Descriptions.Item>
          <Descriptions.Item label="Backend">Flask (Python)</Descriptions.Item>
          <Descriptions.Item label="Database">Supabase (PostgreSQL)</Descriptions.Item>
          <Descriptions.Item label="Deployment">GitHub</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}

export default About