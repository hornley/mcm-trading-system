import React from 'react'
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'
import Sidebar from '../components/Sidebar.jsx';

const { Header, Content, Footer } = Layout;

const DashboardLayout = () => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Layout style={{ overflow: 'hidden' }}>
        <Header style={{ backgroundColor: '#2c3e50', padding: '0 24px', height: '64px', position: 'sticky', top: 0, zIndex: 1 }}>
          <Topbar />
        </Header>
        <Content style={{ overflow: 'auto', padding: 0 }}>
          <Outlet />
        </Content>
        <Footer style={{ backgroundColor: '#2c3e50', padding: '0 24px', height: '64px' }}>
          <Bottombar />
        </Footer>
      </Layout>
    </Layout>
  )
}

export default DashboardLayout