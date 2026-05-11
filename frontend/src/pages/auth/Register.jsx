import { Card, Col, Row, Button, Divider, Input, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {colors} from '../../theme.js';

const Register = () => {
  const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');


    return (
        <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col span={8}>
            <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Please enter your details!</span>}>
            <Row justify="center" align="middle">
                <Space orientation='vertical'> 
                    <form>
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
                        <Button type="primary" htmlType='submit'>
                            Login
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