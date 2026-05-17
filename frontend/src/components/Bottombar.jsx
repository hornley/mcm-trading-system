import { Typography } from 'antd'
import { useAuth } from '../context/AuthContext.jsx'

const { Text } = Typography

const Bottombar = () => {
  const { theme } = useAuth()
  const isDark = theme === 'dark'

  return (
    <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#8c8c8c', fontSize: 12 }}>
      © 2026 FanThree — Manco (MCM) Trading Shop Management System
    </Text>
  )
}

export default Bottombar