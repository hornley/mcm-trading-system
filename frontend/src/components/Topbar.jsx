import { useState, useEffect } from 'react'
import { Typography, Button, Select, Space } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext.jsx'

const { Title } = Typography

const Topbar = () => {
  const { user, selectedLocationId, setSelectedLocationId, logout } = useAuth()
  const [locations, setLocations] = useState([])

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ width: 240 }}>
        {user && (user.usertype === 1 || user.usertype === 3) && (
          <Space>
            <span style={{ color: '#8c8c8c', fontSize: 13 }}>Branch:</span>
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
          <span style={{ color: '#8c8c8c', fontSize: 13 }}>
            Branch: {user.location_name || `Location #${user.location_id}`}
          </span>
        )}
      </div>
      <Title level={4} style={{ margin: 0, color: '#262626', textAlign: 'center', flex: 1 }}>
        Manco (MCM) Trading
      </Title>
      <div style={{ width: 240, textAlign: 'right' }}>
        <Button icon={<LogoutOutlined />} onClick={logout} type="text" style={{ color: '#ff4d4f' }}>
          Logout
        </Button>
      </div>
    </div>
  )
}

export default Topbar