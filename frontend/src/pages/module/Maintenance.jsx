import { useState, useEffect } from 'react';
import {
  Card, Typography, Row, Col, Button, Table, Tag, Modal, Spin,
  Statistic, Tabs, Descriptions, InputNumber, Checkbox, Space, message, Divider,
} from 'antd';
import {
  DatabaseOutlined, CloudUploadOutlined, CloudDownloadOutlined,
  DeleteOutlined, ToolOutlined, ClearOutlined, BarChartOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';

const { Title, Text } = Typography;

const _formatSize = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  for (const unit of units) {
    if (size < 1024) return `${size.toFixed(1)} ${unit}`;
    size /= 1024;
  }
  return `${size.toFixed(1)} TB`;
};

const Maintenance = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [checkResult, setCheckResult] = useState(null);
  const [vacuumResult, setVacuumResult] = useState(null);
  const [reindexResult, setReindexResult] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupItems, setCleanupItems] = useState({ logs: true, products: true, transfers: true });
  const [confirmModal, setConfirmModal] = useState(null);

  const fetchSystemInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/system/info?usertype=${user.usertype}`);
      const data = await res.json();
      if (data.success) setSystemInfo(data.data);
      else message.error(data.error);
    } catch {
      message.error('Failed to load system info');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`/api/admin/backups?usertype=${user.usertype}`);
      const data = await res.json();
      if (data.success) setBackups(data.data);
      else message.error(data.error);
    } catch {
      message.error('Failed to load backups');
    }
  };

  useEffect(() => {
    fetchSystemInfo();
    fetchBackups();
  }, [user]);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype }),
      });
      const data = await res.json();
      if (data.success) {
        message.success('Backup created successfully');
        fetchBackups();
      } else {
        message.error(data.error);
      }
    } catch {
      message.error('Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = (filename) => {
    setConfirmModal({
      title: 'Restore Backup',
      content: `Are you sure you want to restore from "${filename}"? This will replace the current database with the backup.`,
      okText: 'Restore',
      danger: true,
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/backups/${filename}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usertype: user.usertype }),
          });
          const data = await res.json();
          if (data.success) {
            message.success('Database restored successfully');
            fetchSystemInfo();
          } else {
            message.error(data.error);
          }
        } catch {
          message.error('Failed to restore backup');
        }
        setConfirmModal(null);
      },
    });
  };

  const handleDeleteBackup = (filename) => {
    setConfirmModal({
      title: 'Delete Backup',
      content: `Delete "${filename}"? This action cannot be undone.`,
      okText: 'Delete',
      danger: true,
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/backups/${filename}?usertype=${user.usertype}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            message.success('Backup deleted');
            fetchBackups();
          } else {
            message.error(data.error);
          }
        } catch {
          message.error('Failed to delete backup');
        }
        setConfirmModal(null);
      },
    });
  };

  const handleIntegrityCheck = async () => {
    setCheckResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/maintenance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype }),
      });
      const data = await res.json();
      if (data.success) setCheckResult(data.data);
      else message.error(data.error);
    } catch {
      message.error('Integrity check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVacuum = async () => {
    setVacuumResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/optimize/vacuum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype }),
      });
      const data = await res.json();
      if (data.success) {
        setVacuumResult(data.data);
        message.success(data.message);
        fetchSystemInfo();
      } else {
        message.error(data.error);
      }
    } catch {
      message.error('VACUUM failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setReindexResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/optimize/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertype: user.usertype }),
      });
      const data = await res.json();
      if (data.success) {
        setReindexResult(data.data);
        message.success(data.message);
      } else {
        message.error(data.error);
      }
    } catch {
      message.error('Reindex failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = () => {
    if (!cleanupItems.logs && !cleanupItems.products && !cleanupItems.transfers) {
      message.warning('Select at least one cleanup category');
      return;
    }
    setConfirmModal({
      title: 'Run Cleanup',
      content: `This will permanently delete data older than ${cleanupDays} days. This action cannot be undone.`,
      okText: 'Run Cleanup',
      danger: true,
      onOk: async () => {
        setCleanupResult(null);
        try {
          const res = await fetch('/api/admin/cleanup/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usertype: user.usertype,
              days: cleanupDays,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setCleanupResult(data.data);
            message.success(data.message);
            fetchSystemInfo();
          } else {
            message.error(data.error);
          }
        } catch {
          message.error('Cleanup failed');
        }
        setConfirmModal(null);
      },
    });
  };

  const backupColumns = [
    {
      title: 'Filename', dataIndex: 'filename', key: 'filename',
      sorter: (a, b) => a.filename.localeCompare(b.filename),
    },
    {
      title: 'Size', dataIndex: 'size', key: 'size',
      render: (v) => _formatSize(v),
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at',
      render: (v) => new Date(v).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<CloudDownloadOutlined />} onClick={() => handleRestoreBackup(record.filename)}>
            Restore
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteBackup(record.filename)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'info',
      label: <span><DatabaseOutlined /> System Info</span>,
      children: (
        <Spin spinning={loading && !systemInfo}>
          {systemInfo ? (
            <>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic title="Database Size" value={systemInfo.database_size_formatted} prefix={<DatabaseOutlined />} />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic title="SQLite Version" value={systemInfo.sqlite_version} prefix={<DatabaseOutlined />} />
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic title="Backups" value={systemInfo.backup_count} prefix={<CloudUploadOutlined />} />
                  </Card>
                </Col>
              </Row>
              <Divider />
              <Title level={5}>Application</Title>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="App Name">{systemInfo.app_name}</Descriptions.Item>
                <Descriptions.Item label="Version">{systemInfo.version}</Descriptions.Item>
              </Descriptions>
              <Title level={5}>Table Records</Title>
              <Table
                dataSource={systemInfo.table_counts}
                columns={[
                  {
                    title: 'Table Name', dataIndex: 'name', key: 'name',
                    sorter: (a, b) => a.name.localeCompare(b.name),
                  },
                  {
                    title: 'Record Count', dataIndex: 'count', key: 'count',
                    sorter: (a, b) => a.count - b.count,
                  },
                ]}
                rowKey="name"
                pagination={false}
                size="small"
                bordered
              />
            </>
          ) : (
            <Button type="primary" onClick={fetchSystemInfo} loading={loading}>Load System Info</Button>
          )}
        </Spin>
      ),
    },
    {
      key: 'backup',
      label: <span><CloudUploadOutlined /> Backup & Restore</span>,
      children: (
        <>
          <Row style={{ marginBottom: 16 }}>
            <Col>
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreateBackup} loading={loading}>
                Create Backup
              </Button>
            </Col>
          </Row>
          <Table
            dataSource={backups}
            columns={backupColumns}
            rowKey="filename"
            pagination={false}
            locale={{ emptyText: 'No backups yet' }}
          />
        </>
      ),
    },
    {
      key: 'maintenance',
      label: <span><ToolOutlined /> Maintenance</span>,
      children: (
        <>
          <Row style={{ marginBottom: 16 }}>
            <Col>
              <Button type="primary" icon={<ToolOutlined />} onClick={handleIntegrityCheck} loading={loading}>
                Run Integrity Check
              </Button>
            </Col>
          </Row>
          {checkResult && (
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col>
                    <Statistic
                      title="Status"
                      value={checkResult.passed ? 'Passed' : 'Failed'}
                      valueStyle={{ color: checkResult.passed ? '#52c41a' : '#ff4d4f' }}
                      prefix={checkResult.passed ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                    />
                  </Col>
                  <Col>
                    <Statistic title="FK Violations" value={checkResult.foreign_key_violations} />
                  </Col>
                </Row>
                {checkResult.issues.length > 0 && (
                  <>
                    <Divider />
                    <Title level={5}>Issues Found</Title>
                    {checkResult.issues.map((issue, i) => (
                      <Tag key={i} color="red">{issue.type}: {issue.detail}</Tag>
                    ))}
                  </>
                )}
              </Space>
            </Card>
          )}
        </>
      ),
    },
    {
      key: 'optimize',
      label: <span><BarChartOutlined /> Optimize</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="Vacuum Database" size="small">
              <Text>Reclaims unused space in the database file.</Text>
              <br /><br />
              <Button type="primary" onClick={handleVacuum} loading={loading}>
                Run VACUUM
              </Button>
              {vacuumResult && (
                <div style={{ marginTop: 12 }}>
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Size Before">{vacuumResult.size_before_formatted}</Descriptions.Item>
                    <Descriptions.Item label="Size After">{vacuumResult.size_after_formatted}</Descriptions.Item>
                    <Descriptions.Item label="Space Saved">{vacuumResult.space_saved_formatted}</Descriptions.Item>
                    <Descriptions.Item label="Duration">{vacuumResult.duration_seconds}s</Descriptions.Item>
                  </Descriptions>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Rebuild Indexes" size="small">
              <Text>Rebuilds all database indexes for better query performance.</Text>
              <br /><br />
              <Button type="primary" onClick={handleReindex} loading={loading}>
                Run REINDEX
              </Button>
              {reindexResult && (
                <div style={{ marginTop: 12 }}>
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Duration">{reindexResult.duration_seconds}s</Descriptions.Item>
                  </Descriptions>
                  <Tag color="green" style={{ marginTop: 8 }}><CheckCircleOutlined /> Indexes rebuilt</Tag>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'cleanup',
      label: <span><ClearOutlined /> Cleanup</span>,
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Title level={5}>Cleanup Configuration</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text>Delete records older than (days):</Text>
                <InputNumber
                  min={1}
                  max={3650}
                  value={cleanupDays}
                  onChange={setCleanupDays}
                  style={{ marginLeft: 12, width: 100 }}
                />
              </div>
              <div>
                <Text strong>Categories:</Text>
                <div style={{ marginTop: 8 }}>
                  <Checkbox checked={cleanupItems.logs} onChange={(e) => setCleanupItems({ ...cleanupItems, logs: e.target.checked })}>
                    Purge old activity logs
                  </Checkbox>
                </div>
                <div>
                  <Checkbox checked={cleanupItems.products} onChange={(e) => setCleanupItems({ ...cleanupItems, products: e.target.checked })}>
                    Permanently delete voided products
                  </Checkbox>
                </div>
                <div>
                  <Checkbox checked={cleanupItems.transfers} onChange={(e) => setCleanupItems({ ...cleanupItems, transfers: e.target.checked })}>
                    Clean old / cancelled transfers
                  </Checkbox>
                </div>
              </div>
              <Button type="primary" danger icon={<DeleteOutlined />} onClick={handleCleanup}>
                Run Cleanup
              </Button>
            </Space>
          </Card>
          {cleanupResult && (
            <Card title="Cleanup Results">
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Statistic title="Logs Deleted" value={cleanupResult.logs_deleted} />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title="Products Deleted" value={cleanupResult.products_deleted} />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title="Transfers Deleted" value={cleanupResult.transfers_deleted} />
                </Col>
              </Row>
              <Divider />
              <Text type="secondary">Retention period: {cleanupResult.retention_days} days</Text>
            </Card>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Maintenance</Title>
      <Card styles={{ body: { padding: '16px 24px' } }}>
        <Tabs defaultActiveKey="info" items={tabItems} />
      </Card>
      <Modal
        title={confirmModal?.title}
        open={!!confirmModal}
        onCancel={() => setConfirmModal(null)}
        onOk={confirmModal?.onOk}
        okText={confirmModal?.okText}
        okButtonProps={{ danger: confirmModal?.danger }}
      >
        <Text>{confirmModal?.content}</Text>
      </Modal>
    </div>
  );
};

export default Maintenance;
