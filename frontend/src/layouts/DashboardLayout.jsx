import { Layout } from 'antd'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'
import Sidebar from '../components/Sidebar.jsx'

const { Header, Content, Footer } = Layout

const DashboardLayout = () => {
  const location = useLocation()
  const { theme } = useAuth()
  const isDark = theme === 'dark'

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Layout style={{ overflow: 'hidden' }}>
        <Header style={{ background: isDark ? '#141414' : '#ffffff', padding: '0 24px', height: '64px', borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`, display: 'flex', alignItems: 'center' }}>
          <Topbar />
        </Header>
        <Content key={location.pathname} className="page-enter" style={{ overflow: 'auto', padding: 24 }}>
          <Outlet />
        </Content>
        <Footer style={{ background: isDark ? '#141414' : '#ffffff', padding: '0 24px', height: '48px', borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bottombar />
        </Footer>
      </Layout>
    </Layout>
  )
}

export default DashboardLayout