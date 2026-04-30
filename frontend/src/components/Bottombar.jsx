import React from 'react'
import {Typography} from 'antd';
import {colors} from '../theme.js';

const {Text} = Typography;

const Bottombar = () => {
  return (
    <Text level={1} style={{color: colors.secondaryText, margin: 0}}>
        © 2026 FanThree
    </Text>
  )
}

export default Bottombar