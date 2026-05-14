import React, { useState, useEffect } from 'react'
import { Typography, Row, Col, Button, Select, Space } from 'antd';
import { colors } from '../theme.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
const { Title } = Typography;

const Topbar = () => {
  const navigate = useNavigate();
  const { user, selectedLocationId, setSelectedLocationId } = useAuth();
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (user && (user.usertype === 1 || user.usertype === 3)) {
      fetch(`/api/locations?usertype=${user.usertype}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setLocations(data.data.filter((l) => l.is_active));
        })
        .catch(() => {});
    }
  }, [user]);

  return (
    <Row align='middle' style={{ width: '100%', height: '100%' }} justify="space-between">
      <Col>
        {user && (user.usertype === 1 || user.usertype === 3) && (
          <Space>
            <span style={{ color: colors.secondaryText, fontSize: 14 }}>Branch:</span>
            <Select
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              style={{ width: 160 }}
              size="small"
            >
              <Select.Option value="all">All Branches</Select.Option>
              {locations.map((loc) => (
                <Select.Option key={loc.location_id} value={loc.location_id}>{loc.name}</Select.Option>
              ))}
            </Select>
          </Space>
        )}
        {user && user.usertype === 2 && (
          <span style={{ color: colors.secondaryText, fontSize: 14 }}>
            Branch: {user.location_name || `Location #${user.location_id}`}
          </span>
        )}
      </Col>
      <Col>
        <Title level={3} style={{ color: colors.secondaryText, margin: 0, textAlign: 'center' }}>
          Manco (MCM) Trading Shop Management System
        </Title>
      </Col>
      <Col>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Col>
    </Row>
  )
}

export default Topbar