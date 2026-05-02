import React from 'react'
import {Typography, Row, Col} from 'antd';
import {colors} from '../theme.js';

const {Title} = Typography;

const Topbar = () => {
  return (
    <Row justify="center" align= 'middle' style={{ width: '100%', height: '100%' }}>
      <Col>
        <Title level={3} style={{ color: colors.secondaryText, margin: 0 }}>
          Manco (MCM) Trading Shop Management System
        </Title>
      </Col>
    </Row>
  )
}

export default Topbar