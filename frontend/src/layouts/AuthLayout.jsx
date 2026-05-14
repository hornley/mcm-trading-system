import React from 'react'
import { Layout, Typography } from 'antd';
import { Outlet } from 'react-router-dom';
import {colors} from '../theme.js';
import Bottombar from '../components/Bottombar.jsx'

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const AuthLayout = () => {
  return (
    <Layout style={{minHeight: '100vh', backgroundColor: colors.primaryBg}}>
      <Header style={{ backgroundColor: '#2c3e50', padding: '0 24px', height: '64px'}}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <Title level={3} style={{ color: '#ffffff', margin: 0 }}>
            Manco (MCM) Trading Shop Management System
          </Title>
        </div>
      </Header>
      <Content>
        <Outlet />
      </Content>
       <Footer style={{ backgroundColor: '#2c3e50', padding: '0 24px', height: '64px'}}>
         <Bottombar />
      </Footer>
    </Layout>
  )
}

export default AuthLayout