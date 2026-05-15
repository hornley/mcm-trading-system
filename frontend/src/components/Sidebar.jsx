import { Menu, Layout, Col, Row, Typography} from "antd"
import { Avatar } from 'antd';
import { Space } from 'antd';
import { useAuth } from "../context/AuthContext";
import {UserOutlined} from '@ant-design/icons'
import { useNavigate, useLocation } from "react-router-dom";

const { Sider } = Layout;
const { Text } = Typography;


const ownerModules = [
  { key: '1', label: 'Dashboard', path: '/dashboard/owner' },
  { key: '2', label: 'Inventory', path: '/dashboard/inventory' },
  { key: '3', label: 'Stock Management', path: '/dashboard/stock-management' },
  { key: '4', label: 'Manage Users', path: '/dashboard/users' },
  { key: '5', label: 'Sales', path: '/dashboard/sales' },
  { key: '6', label: 'Maintenance', path: '/dashboard/maintenance' },
  { key: '7', label: 'Settings', path: '/dashboard/settings' },
  { key: '8', label: 'Report', path: '/dashboard/report' },
];

const managerModules = [
  { key: '1', label: 'Dashboard', path: '/dashboard/manager' },
  { key: '2', label: 'Inventory', path: '/dashboard/inventory' },
  { key: '3', label: 'Sales', path: '/dashboard/sales' },
  { key: '4', label: 'Stock Management', path: '/dashboard/stock-management' },
  { key: '5', label: 'Manage Staff', path: '/dashboard/users' },
  { key: '6', label: 'Settings', path: '/dashboard/settings' },
  { key: '7', label: 'Report', path: '/dashboard/report' },
];

const adminModules = [
  { key: '1', label: 'Dashboard', path: '/dashboard/admin' },
  { key: '2', label: 'Maintenance', path: '/dashboard/maintenance' },
  { key: '3', label: 'Settings', path: '/dashboard/settings' },
  { key: '4', label: 'Report', path: '/dashboard/report' },
];
const Sidebar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const modules = 
        user?.role === 'owner' ? ownerModules :
        user?.role === 'admin' ? adminModules :
        user?.role === 'manager' ? managerModules :
    [];

    const selectedKey = modules.find(m => m.path === location.pathname)?.key || '1';

  return (
    <Sider style={{padding: '16px 16px'}}>
        <Row justify='center'>
            <Space orientation="vertical" size='medium'>
                <Row justify='center'>
                <Col>
                    <Space>
                        <Avatar src={user?.avatar || null} icon={!user?.avatar && <UserOutlined /> }/>
                        <Text style={{color: '#ffffff' }}>
                            {user?.username}
                        </Text>
                    </Space>
                </Col>
            </Row>
            <Menu
                selectedKeys={[selectedKey]}
                mode='inline'
                theme='dark'
                items={modules}
                onSelect={({ key }) => {
                    const selected = modules.find(m => m.key === key);
                    if (selected) navigate(selected.path);
                }}
            />
            </Space>
        </Row>
    </Sider>
        

  )
}

export default Sidebar