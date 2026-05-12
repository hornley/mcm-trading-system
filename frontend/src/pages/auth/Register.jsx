import { Card, Col, Row, Button, Divider, Input, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {colors} from '../../theme.js';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email }),
            });

            const data = await res.json();

            if (!res.ok) {
                message.error(data.error);
                return;
            }

            message.success('Registration successful! You can now log in.');
            navigate('/login');
        } catch {
            message.error('Connection error. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col span={8}>
            <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Please enter your details!</span>}>
            <Row justify="center" align="middle">
                <Space orientation='vertical'> 
                    <form onSubmit={handleRegister}>
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
                        <Input
                            placeholder='Email'
                            value={email} 
                            onChange={(e)=> setEmail(e.target.value)}
                        />
                        <Input
                            placeholder='Address'
                            value={address} 
                            onChange={(e)=> setAddress(e.target.value)}
                        />
                        <Input
                            placeholder='Phone Number'
                            value={phoneNumber} 
                            onChange={(e)=> setPhoneNumber(e.target.value)}
                        />
                        <Divider></Divider> 
                        <Button type="primary" htmlType='submit' loading={loading}>
                            Register
                        </Button>
                        <Divider orientation='vertical'></Divider> 
                        <Button onClick={() => navigate('/')}>
                            Back
                        </Button>
                    </form>
                </Space>
            </Row>
            </Card>
        </Col>
        </Row>
    )
}

export default Register