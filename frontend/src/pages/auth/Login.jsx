import { Card, Col, Row, Button, Divider, Input, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {colors} from '../../theme.js';


const Login = () => {
    const navigate = useNavigate();
    return (
        <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col span={8}>
            <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Enter your Login Details!</span>}>
            <Row justify="center" align="middle">
                <Space.Compact>
                    <Input placeholder='Username' />
                    <Input.Password placeholder='Password' />
                    <Button type="primary">
                        Login
                    </Button>
                    <Divider type="vertical"></Divider>
                    <Button onClick={() => navigate('/')}>
                        Back
                    </Button>
                </Space.Compact>
            </Row>
            </Card>
        </Col>
        </Row>
    )
}

export default Login