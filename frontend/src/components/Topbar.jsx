import React from 'react'
import {Typography, Row, Col, Button} from 'antd';
import {colors} from '../theme.js';
import {useNavigate } from 'react-router-dom';
const {Title} = Typography;

const Topbar = () => {
  const navigate = useNavigate();
  return (
    <Row align='middle' style={{ width: '100%', height: '100%' }}>
      <Col span={4} />
      <Col span={16} style={{ textAlign: 'center' }}>
        <Title level={3} style={{ color: colors.secondaryText, margin: 0 }}>
          Manco (MCM) Trading Shop Management System
        </Title>
      </Col>
      <Col span={4} style={{ textAlign: 'right', paddingRight: '24px' }}>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Col>
    </Row>
  )
}

export default Topbar