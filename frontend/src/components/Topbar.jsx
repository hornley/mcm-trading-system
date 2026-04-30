import React from 'react'
import {Typography, Row, Col} from 'antd';
import {colors} from '../theme.js';

const {Title} = Typography;

const Topbar = () => {
  return (
        <Row>
          <Col>
            <Title level={3} style={{color: colors.secondaryText, margin: 0, textAlign: 'center'}}>
            Manco (MCM) Trading Shop Management System
            </Title>  
          </Col>
        </Row>
  )
}

export default Topbar