import { Card, Space, Typography, Button, message } from 'antd';
import { CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import InventoryBrowser from '../components/InventoryBrowser';

export default function Dashboard() {
  const { userData, isOwner } = useAuth();
  const isAdmin = isOwner || Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');
  const inviteLink = userData?.subscriptionId ? `${window.location.origin}/join/${userData.subscriptionId}` : '';
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteLink); message.success('Invite link copied to clipboard'); }
    catch { message.error('Could not copy automatically — copy it manually instead'); }
  };
  return <div style={{ padding: 24 }}>
    {isAdmin && <Card size="small" style={{ marginBottom: 24 }}><Space wrap>
      <LinkOutlined /><Typography.Text strong>Invite link:</Typography.Text>
      <Typography.Text code style={{ maxWidth: '60vw' }} ellipsis>{inviteLink}</Typography.Text>
      <Button size="small" icon={<CopyOutlined />} onClick={copyInvite}>Copy</Button>
      <Typography.Text type="secondary">New members join with profile-only access. Grant a group role from Members.</Typography.Text>
    </Space></Card>}
    <Typography.Title level={2}>Inventory Dashboard</Typography.Title>
    <InventoryBrowser cards defaultMine />
  </div>;
}
