import { Card, Col, Row, Button, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import {colors} from '../theme.js';


const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
      <Col span={8}>
        <Card title={<span style={{ color: colors.primaryText, textAlign:'center'}}>Welcome User!</span>}>
          <Row justify="center" align="middle">
            <Button onClick={() => navigate('/Login')}type="primary">
              Login
            </Button>
            <Divider orientation="vertical"></Divider>
            <Button onClick={() => navigate('/Register')}>
              Sign Up
            </Button>
          </Row>
        </Card>
      </Col>
    </Row>
  )
}

export default LandingPage