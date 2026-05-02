import React from 'react'
import { Layout, Menu } from 'antd';
import { Outlet } from 'react-router-dom';
import {colors} from '../theme.js';
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'
import Sidebar from '../components/Sidebar.jsx';

const { Header, Content, Footer, Sider } = Layout;

const items = [
  { key: '1', label: 'Dashboard'},
  { key: '2', label: 'Dashboard'},
];

const DashboardLayout = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header style={{ backgroundColor: colors.headerBg, padding: '0 24px', height: '64px'}}>
          <Topbar />
        </Header>
        <Content>
          <Outlet />
        </Content>
        <Footer style={{ backgroundColor: colors.headerBg, padding: '0 24px', height: '64px'}}>
          <Bottombar />
        </Footer>
        </Layout>
    </Layout>

  )
}

export default DashboardLayout