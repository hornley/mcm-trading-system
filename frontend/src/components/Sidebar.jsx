import { useState } from 'react'
import { Menu, Layout, Typography, Avatar, Space } from 'antd'
import {
  DashboardOutlined, AppstoreOutlined, AuditOutlined, TeamOutlined,
  ShoppingCartOutlined, ToolOutlined, SettingOutlined, BarChartOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  QuestionCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

const { Sider } = Layout
const { Text } = Typography

const iconMap = {
  Dashboard: <DashboardOutlined />,
  Inventory: <AppstoreOutlined />,
  'Stock Management': <AuditOutlined />,
  'Manage Users': <TeamOutlined />,
  Sales: <ShoppingCartOutlined />,
  Maintenance: <ToolOutlined />,
  Settings: <SettingOutlined />,
  Reports: <BarChartOutlined />,
  'Manage Staff': <TeamOutlined />,
  Help: <QuestionCircleOutlined />,
  About: <InfoCircleOutlined />,
}

const mapModules = (modules) =>
  modules.map((m) => ({ ...m, icon: iconMap[m.label] }))

const ownerModules = mapModules([
  { key: '1', label: 'Dashboard', path: '/dashboard/owner' },
  { key: '2', label: 'Inventory', path: '/dashboard/inventory' },
  { key: '3', label: 'Stock Management', path: '/dashboard/stock-management' },
  { key: '4', label: 'Manage Users', path: '/dashboard/users' },
  { key: '5', label: 'Sales', path: '/dashboard/sales' },
  { key: '6', label: 'Maintenance', path: '/dashboard/maintenance' },
  { key: '7', label: 'Settings', path: '/dashboard/settings' },
  { key: '8', label: 'Reports', path: '/dashboard/report' },
  { key: '9', label: 'Help', path: '/dashboard/help' },
  { key: '10', label: 'About', path: '/dashboard/about' },
])

const managerModules = mapModules([
  { key: '1', label: 'Dashboard', path: '/dashboard/manager' },
  { key: '2', label: 'Inventory', path: '/dashboard/inventory' },
  { key: '3', label: 'Sales', path: '/dashboard/sales' },
  { key: '4', label: 'Stock Management', path: '/dashboard/stock-management' },
  { key: '5', label: 'Settings', path: '/dashboard/settings' },
  { key: '6', label: 'Reports', path: '/dashboard/report' },
  { key: '7', label: 'Help', path: '/dashboard/help' },
  { key: '8', label: 'About', path: '/dashboard/about' },
])

const adminModules = mapModules([
  { key: '1', label: 'Dashboard', path: '/dashboard/admin' },
  { key: '2', label: 'Maintenance', path: '/dashboard/maintenance' },
  { key: '3', label: 'Settings', path: '/dashboard/settings' },
  { key: '4', label: 'Reports', path: '/dashboard/report' },
  { key: '5', label: 'Help', path: '/dashboard/help' },
  { key: '6', label: 'About', path: '/dashboard/about' },
])

const Sidebar = () => {
  const { user, isStorehouse, theme } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mcm_sidebar_collapsed') === 'true')
  const isDark = theme === 'dark'

  const baseModules =
    user?.role === 'owner' ? ownerModules :
    user?.role === 'admin' ? adminModules :
    user?.role === 'manager' ? managerModules :
    []

  const modules = isStorehouse
    ? baseModules.filter((m) => m.label !== 'Sales')
    : baseModules

  const selectedKey = modules.find((m) => m.path === location.pathname)?.key || '1'

  const handleCollapse = (val) => {
    setCollapsed(val)
    localStorage.setItem('mcm_sidebar_collapsed', val)
  }

  return (
    <Sider width={220} collapsedWidth={60} collapsible collapsed={collapsed} onCollapse={handleCollapse} className={isDark ? 'sider-dark' : 'sider-light'} style={{ background: isDark ? '#001529' : '#ffffff' }}>
      <div style={{ padding: collapsed ? '16px 10px' : '20px 16px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`, textAlign: collapsed ? 'center' : 'left' }}>
        {collapsed ? (
          <Avatar size={36} src={user?.avatar || null} icon={!user?.avatar && <UserOutlined />} style={{ backgroundColor: '#5b7ff0' }} />
        ) : (
          <Space>
            <Avatar size={36} src={user?.avatar || null} icon={!user?.avatar && <UserOutlined />} style={{ backgroundColor: '#5b7ff0' }} />
            <div style={{ lineHeight: 1.3 }}>
              <Text style={{ color: isDark ? '#ffffff' : '#262626', fontWeight: 600, fontSize: 14, display: 'block' }}>
                {user?.username}
              </Text>
              <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c', fontSize: 12 }}>
                {user?.role}{user?.location_name ? ` · ${user.location_name}` : ''}
              </Text>
            </div>
          </Space>
        )}
      </div>
      <Menu
        selectedKeys={[selectedKey]}
        mode="inline"
        theme={isDark ? 'dark' : 'light'}
        inlineCollapsed={collapsed}
        items={modules}
        onSelect={({ key }) => {
          const selected = modules.find((m) => m.key === key)
          if (selected) navigate(selected.path)
        }}
        style={{ borderInlineEnd: 'none', marginTop: 4 }}
      />
    </Sider>
  )
}

export default Sidebar