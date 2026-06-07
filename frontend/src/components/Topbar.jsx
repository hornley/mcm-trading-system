import { useState, useEffect } from 'react'
import { Typography, Button, Select, Space, Badge } from 'antd'
import { LogoutOutlined, BellOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.jsx'
import NotificationModal from './NotificationModal.jsx'

const { Title } = Typography

const Topbar = () => {
  const { user, selectedLocationId, setSelectedLocationId, logout, theme } = useAuth()
  const [locations, setLocations] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)
  const isDark = theme === 'dark'

  useEffect(() => {
    if (user && (user.usertype === 1 || user.usertype === 3)) {
      fetch(`/api/locations?usertype=${user.usertype}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setLocations(data.data.filter((l) => l.is_active))
        })
        .catch(() => {})
    }
  }, [user])

  const fetchPendingCount = () => {
    if (!user) return
    const params = new URLSearchParams({ usertype: user.usertype, user_id: user.user_id })
    if (user.location_id) params.append('location_id', user.location_id)
    fetch(`/api/inventory/pending-requests?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPendingCount((data.data || []).length)
      })
      .catch(() => {})
    if (user.location_id) {
      fetch(`/api/notifications/count?location_id=${user.location_id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setNotifCount(data.count || 0)
        })
        .catch(() => {})
    }
  }

  useEffect(() => {
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ width: 240 }}>
        {user && (user.usertype === 1 || user.usertype === 3) && (
          <Space>
            <span style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#8c8c8c', fontSize: 13 }}>Branch:</span>
            <Select
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              style={{ width: 160 }}
              size="small"
            >
              <Select.Option value="all">All Branches</Select.Option>
              {locations.map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Space>
        )}
        {user && user.usertype === 2 && (
          <span style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#8c8c8c', fontSize: 13 }}>
            Branch: {user.location_name || `Location #${user.location_id}`}
          </span>
        )}
      </div>
      <Title level={4} style={{ margin: 0, color: isDark ? 'rgba(255,255,255,0.85)' : '#262626', textAlign: 'center', flex: 1 }}>
        Manco (MCM) Trading
      </Title>
      <div style={{ width: 240, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <Badge count={(pendingCount || 0) + (notifCount || 0)} size="small" offset={[-2, 2]}>
          <Button
            icon={<BellOutlined />}
            onClick={() => { setNotifOpen(true); fetchPendingCount() }}
            type="text"
            style={{ color: isDark ? 'rgba(255,255,255,0.65)' : '#595959', fontSize: 16 }}
          />
        </Badge>
        <Button icon={<LogoutOutlined />} onClick={logout} type="text" style={{ color: '#ff4d4f' }}>
          Logout
        </Button>
      </div>
      <NotificationModal open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}

export default Topbar