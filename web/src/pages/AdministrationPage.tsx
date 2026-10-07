import { Link } from 'react-router-dom';
import { Button, Card, Col, Input, message, Result, Row, Space, Typography } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { canManage, canManageRoles } from '../auth/permissions';

export default function AdministrationPage() {
  const { userData, isOwner } = useAuth();
  if (!canManage(userData, undefined, isOwner)) {
    return <Result status="403" title="Administrator access required" subTitle="Ask your organization's administrator if you need management access." />;
  }
  const inviteLink = `${window.location.origin}/join/${userData!.subscriptionId}`;
  const sections = [
    { path: '/members', title: 'Members', description: 'Manage member profiles and group roles.' },
    ...(canManageRoles(userData, undefined, isOwner) ? [{ path: '/groups', title: 'Groups', description: 'Create and manage groups in your subscription.' }] : []),
    { path: '/categories', title: 'Categories', description: 'Define garment categories and sizing.' },
    { path: '/products', title: 'Products', description: 'Manage costume variants and product images.' },
    { path: '/manage/items', title: 'Items', description: 'Manage physical garments, owners and NFC tags.' },
    { path: '/manage/kits', title: 'Kits', description: 'Define complete outfits from required products.' },
  ];
  return <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
    <Typography.Title level={2}>Administration</Typography.Title>
    <Typography.Paragraph type="secondary">Manage your organization's subscription, groups, members and catalog. Management permissions follow your role in each group.</Typography.Paragraph>
    <Card title="Invite a member" style={{ marginBottom: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Text>Share this link with new members. They can complete their profile after joining; grant a group role from Members to give them access.</Typography.Text>
        <Input aria-label="Invitation link" readOnly value={inviteLink} onFocus={e => e.target.select()} />
        <Button onClick={async () => {
          try { await navigator.clipboard.writeText(inviteLink); message.success('Invitation link copied'); }
          catch { message.info('Select and copy the invitation link above.'); }
        }}>Copy invitation link</Button>
      </Space>
    </Card>
    <Row gutter={[16, 16]}>
      {sections.map(section => <Col key={section.path} xs={24} sm={12} lg={8}>
        <Card title={<Link to={section.path}>{section.title}</Link>} style={{ height: '100%' }}>
          {section.description}
        </Card>
      </Col>)}
    </Row>
  </div>;
}
