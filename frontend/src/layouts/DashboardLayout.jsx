import React from 'react'
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import {colors} from '../theme.js';
import Topbar from '../components/Topbar.jsx'
import Bottombar from '../components/Bottombar.jsx'

const { Header, Content, Footer } = Layout;

const DashboardLayout = () => {
  return (
    <Layout style={{minHeight: '100vh', backgroundColor: colors.primaryBg}}>
      <Header style={{ backgroundColor: colors.headerBg, padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Topbar />
      </Header>
      <Content>
        <Outlet />
      </Content>
       <Footer style={{ backgroundColor: colors.headerBg, padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <Bottombar />
      </Footer>
    </Layout>
  )
}

export default DashboardLayout