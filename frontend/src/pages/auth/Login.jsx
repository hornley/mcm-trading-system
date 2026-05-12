import { Card, Col, Row, Button, Divider, Input, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {colors} from '../../theme.js';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const Login = () => {
    const {login} = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                message.error(data.error);
                return;
            }

            login(data);
            navigate(`/dashboard/${data.role}`);
        } catch {
            message.error('Connection error. Is the server running?');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col span={8}>
            <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Enter your Login Details!</span>}>
            <Row justify="center" align="middle">
                <Space.Compact>
                    <form onSubmit={handleLogin}>
                        <Input 
                            placeholder='Username' 
                            value={username} 
                            onChange={(e)=> setUsername(e.target.value)}
                        />
                        <Input.Password 
                            placeholder='Password'
                            value={password}
                            onChange={(e)=> setPassword(e.target.value)}
                        />
                        <Divider></Divider> 
                        <Button type="primary" htmlType="submit" loading={loading}>
                            Login
                        </Button>
                        <Divider orientation="vertical"></Divider>                       
                        <Button onClick={() => navigate('/')}>
                            Back
                        </Button>
                    </form>
                    
                </Space.Compact>
            </Row>
            </Card>
        </Col>
        </Row>
    )
}

export default Login