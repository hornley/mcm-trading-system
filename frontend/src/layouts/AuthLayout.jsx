import { Layout, Typography } from 'antd'
import { Outlet } from 'react-router-dom'
import Bottombar from '../components/Bottombar.jsx'

const { Header, Content, Footer } = Layout
const { Title } = Typography

const AuthLayout = () => {
  return (
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Header style={{ background: 'rgba(0,0,0,0.15)', padding: '0 24px', height: '64px', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Title level={3} style={{ color: '#ffffff', margin: 0, letterSpacing: 1 }}>
            Manco (MCM) Trading
          </Title>
        </div>
      </Header>
      <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Outlet />
      </Content>
      <Footer style={{ background: 'rgba(0,0,0,0.15)', padding: '0 24px', height: '64px', backdropFilter: 'blur(8px)' }}>
        <Bottombar />
      </Footer>
    </Layout>
  )
}

export default AuthLayout