import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#5b7ff0',
          colorSuccess: '#52c41a',
          colorWarning: '#fa8c16',
          colorError: '#ff4d4f',
          borderRadius: 8,
          fontFamily: "'Roboto', sans-serif",
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#001529',
            bodyBg: '#f0f2f5',
          },
          Card: {
            borderRadiusLG: 12,
          },
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          },
          Table: {
            borderRadius: 8,
          },
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
