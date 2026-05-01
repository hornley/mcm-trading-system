import { Card, Col, Row, Button, Divider, Input, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import {colors} from '../../theme.js';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const mockUsers = [
  {
    username: 'owner1',
    password: '1234',
    role: 'owner'
  },
  {
    username: 'manager1',
    password: '1234',
    role: 'manager'
  },
  {
    username: 'admin1',
    password: '1234',
    role: 'admin'
  }
]

const Login = () => {
    const {login} = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();

        const foundUser = mockUsers.find(
            (user) => 
                user.username === username &&
                user.password === password
        )

        if (foundUser) {
            login(foundUser);
            navigate(`/dashboard/${foundUser.role}`)
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
                        <Button type="primary" htmlType="submit">
                            Login
                        </Button>
                        <Divider orientation="vertical"></Divider>                       <Button onClick={() => navigate('/')}>
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