import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const fontSizeMap = { small: 12, medium: 14, large: 16, xlarge: 28 }

const ThemedApp = () => {
  const { theme: appTheme, fontSize } = useAuth()
  const isDark = appTheme === 'dark'

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#5b7ff0',
          colorSuccess: '#52c41a',
          colorWarning: '#fa8c16',
          colorError: '#ff4d4f',
          borderRadius: 8,
          fontFamily: "'Roboto', sans-serif",
          fontSize: fontSizeMap[fontSize] || 14,
        },
        components: {
          Layout: {
            headerBg: isDark ? '#141414' : '#ffffff',
            siderBg: isDark ? '#001529' : '#ffffff',
            bodyBg: isDark ? '#000000' : '#f0f2f5',
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
        <App />
      </AntApp>
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)