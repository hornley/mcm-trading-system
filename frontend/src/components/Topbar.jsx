import {Typography, Row, Col, Button} from 'antd';
import {LogoutOutlined} from '@ant-design/icons';
import {useAuth} from '../context/AuthContext';

const {Title} = Typography;

const Topbar = () => {
  const {logout} = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <Row align='middle' style={{ width: '100%', height: '100%' }}>
      <Col span={4} />
      <Col span={16} style={{ textAlign: 'center' }}>
        <Title level={3} style={{ color: '#ffffff', margin: 0 }}>
          Manco (MCM) Trading Shop Management System
        </Title>
      </Col>
      <Col span={4} style={{ textAlign: 'right', paddingRight: '24px' }}>
        <Button icon={<LogoutOutlined />} onClick={handleLogout} style={{ backgroundColor: '#ffffff', color: '#ff4d4f', border: '1px solid #ff4d4f' }}>
          Logout
        </Button>
      </Col>
    </Row>
  )
}

export default Topbar