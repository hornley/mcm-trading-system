import { useState, useEffect, useMemo, useCallback } from 'react';
import { Typography, Spin, Card, Collapse, Input, Space, Button, Menu, Row, Col } from 'antd';
import { ArrowLeftOutlined, SearchOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Title, Text } = Typography;

const roleTitles = {
  owner: "Owner's Manual",
  manager: "Manager's Manual",
  admin: "Admin Manual",
};

const ManualContent = ({ role }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/manual/${role}?usertype=${user.usertype}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSections(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, role]);

  const topLevelSections = useMemo(() =>
    sections.filter((s) => s.parent_id === null),
    [sections],
  );

  const getChildren = (parentId) =>
    sections.filter((s) => s.parent_id === parentId);

  const filteredSections = useMemo(() => {
    if (!searchText) return topLevelSections;
    const lower = searchText.toLowerCase();
    const childParentIds = new Set();
    const matchIds = new Set();

    sections.forEach((s) => {
      if (s.title.toLowerCase().includes(lower) || s.content.toLowerCase().includes(lower)) {
        matchIds.add(s.section_id);
        if (s.parent_id) childParentIds.add(s.parent_id);
      }
    });

    return topLevelSections.filter(
      (s) => matchIds.has(s.section_id) || childParentIds.has(s.section_id),
    );
  }, [searchText, topLevelSections, sections]);

  const sidebarItems = useMemo(() =>
    filteredSections.map((s) => ({
      key: `sec-${s.section_id}`,
      label: s.title,
    })),
    [filteredSections],
  );

  const scrollToSection = useCallback((key) => {
    const sectionId = key.replace('sec-', '');
    const el = document.getElementById(`sec-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const renderMarkdown = useCallback((content) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  ), []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}><Text type="secondary">Loading manual...</Text></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Row align="middle" style={{ marginBottom: 16 }} gutter={16}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard/help')}>
            Back to Help
          </Button>
        </Col>
        <Col flex="auto">
          <Title level={4} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 8 }} />{roleTitles[role] || 'User Manual'}
          </Title>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Input
            placeholder="Search the manual..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Col>
      </Row>

      <Row gutter={24}>
        <Col xs={0} lg={6}>
          <div style={{ position: 'sticky', top: 24 }}>
            <Menu
              mode="inline"
              selectedKeys={[]}
              items={sidebarItems}
              onClick={({ key }) => scrollToSection(key)}
              style={{ borderInlineEnd: 'none' }}
            />
          </div>
        </Col>
        <Col xs={24} lg={18}>
          {filteredSections.length === 0 ? (
            <Card>
              <Text type="secondary">No sections match your search.</Text>
            </Card>
          ) : (
            filteredSections.map((section) => {
              const children = getChildren(section.section_id);
              return (
                <Card
                  key={section.section_id}
                  id={`sec-${section.section_id}`}
                  title={<span style={{ fontSize: 16, fontWeight: 600 }}>{section.title}</span>}
                  style={{ marginBottom: 16 }}
                  styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
                >
                  <div className="manual-content">
                    {renderMarkdown(section.content)}
                  </div>
                  {children.length > 0 && (
                    <Collapse
                      ghost
                      expandIconPosition="end"
                      items={children.map((child) => ({
                        key: child.section_id,
                        label: <span style={{ fontWeight: 500 }}>{child.title}</span>,
                        children: (
                          <div className="manual-content">
                            {renderMarkdown(child.content)}
                          </div>
                        ),
                      }))}
                    />
                  )}
                </Card>
              );
            })
          )}
        </Col>
      </Row>
    </div>
  );
};

export default ManualContent;
