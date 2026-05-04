import React from 'react'
import {Typography, Row, Col} from 'antd';
import {colors} from '../theme.js';

const {Text} = Typography;

const Bottombar = () => {
  return (
    <Row justify="center" align= 'middle' style={{ width: '100%', height: '100%' }}>
      <Col>
        <Text style={{ color: colors.secondaryText }}>
          © 2026 FanThree
        </Text>
      </Col>
    </Row>
  )
}

export default Bottombar