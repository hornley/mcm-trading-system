import { Card, Col, Row, Button, Divider, Input, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {colors} from '../../theme.js';

const Register = () => {
  const navigate = useNavigate();
    return (
        <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col span={8}>
            <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Please enter your details!</span>}>
            <Row justify="center" align="middle">
                <Space orientation='vertical'> 
                    <Input placeholder='Username' />
                    <Input.Password placeholder='Password' />
                    <Input placeholder='Email' />
                    <Input placeholder='Address' />
                    <Input placeholder='Phone Number' />
                    <Button type="primary">
                        Login
                    </Button>
                    <Button onClick={() => navigate('/')}>
                        Back
                    </Button>
                </Space>
            </Row>
            </Card>
        </Col>
        </Row>
    )
}

export default Register