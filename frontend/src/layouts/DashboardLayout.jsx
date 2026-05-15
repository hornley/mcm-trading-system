import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'
import Sidebar from '../components/Sidebar.jsx'

const { Header, Content, Footer } = Layout

const DashboardLayout = () => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Layout style={{ overflow: 'hidden' }}>
        <Header style={{ background: '#ffffff', padding: '0 24px', height: '64px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
          <Topbar />
        </Header>
        <Content style={{ overflow: 'auto', padding: 24 }}>
          <Outlet />
        </Content>
        <Footer style={{ background: '#ffffff', padding: '0 24px', height: '48px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bottombar />
        </Footer>
      </Layout>
    </Layout>
  )
}

export default DashboardLayout