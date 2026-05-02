import { Menu, Layout, Col, Row, Typography} from "antd"
import { Avatar } from 'antd';
import { useAuth } from "../context/AuthContext"
import { Space } from 'antd';
import sampleUser from '../assets/user-placeholder.png'
import { colors } from '../theme.js' 

const { Sider } = Layout;
const { Text } = Typography;

const ownerModules = [
    { key: '1', label: 'Dashboard'},
    { key: '2', label: 'Inventory'},
    { key: '3', label: 'Stock Management'},
    { key: '4', label: 'User Access'},
    { key: '5', label: 'Report'}
]

const adminModules = [
    { key: '1', label: 'Dashboard'},
    { key: '2', label: 'Maintenance'},
    { key: '3', label: 'Report'}
]

const managerModules = [
    { key: '1', label: 'Dashboard'},
    { key: '2', label: 'Inventory'},
    { key: '3', label: 'Stock Management'},
    { key: '4', label: 'User Access'},
    { key: '5', label: 'Report'}
]

const Sidebar = () => {
    const { user } = useAuth();
    const modules = 
        user?.role === 'owner' ? ownerModules :
        user?.role === 'admin' ? adminModules :
        user?.role === 'manager' ? managerModules :
    [];

  return (
    <Sider style={{padding: '16px 16px'}}>
        <Space orientation="vertical">
            <Row justify='center'>
            <Col>
                <Space>
                    <Avatar src={sampleUser}/>
                    <Text style={{color: colors.secondaryText }}>
                        owner
                    </Text>
                </Space>
            </Col>
        </Row>
        <Menu 
            defaultSelectedKeys={['1']}
            mode='inline'
            theme='dark'
            items={modules}
        />
        </Space>
    </Sider>
        

  )
}

export default Sidebar