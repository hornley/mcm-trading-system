import { Result, Button } from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import OwnerManual from './OwnerManual';
import ManagerManual from './ManagerManual';
import AdminManual from './AdminManual';

const Manual = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  if (user.role === 'owner') return <OwnerManual />;
  if (user.role === 'manager') return <ManagerManual />;
  if (user.role === 'admin') return <AdminManual />;

  return (
    <Result
      status="403"
      title="Manual Not Available"
      subTitle={`The manual for "${user.role}" role is not yet available.`}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard/help')}>
          Back to Help
        </Button>
      }
    />
  );
};

export default Manual;
