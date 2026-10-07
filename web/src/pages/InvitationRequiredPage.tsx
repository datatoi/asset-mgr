import { Button, Card, Layout, Result, Space, Spin, Typography } from 'antd';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function InvitationRequiredPage() {
  const { user, userData, loading, isSiteAdmin, logout } = useAuth();
  if (loading) return <Spin style={{ display: 'block', padding: 48 }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (userData?.subscriptionId) return <Navigate to="/dashboard" replace />;

  return <Layout style={{ minHeight: '100vh', padding: '48px 16px', alignItems: 'center' }}>
    <Card style={{ width: 560, maxWidth: '100%' }}>
      <Result status="info" title="You need an invitation link"
        subTitle="Your account is not attached to a subscription. Ask your organization's administrator for an invitation link, then open it to join."
        extra={<Space direction="vertical">
          <Typography.Text type="secondary">Signed in as {user.email}</Typography.Text>
          {isSiteAdmin && <Link to="/site-admin">Site administration</Link>}
          <Button onClick={() => void logout()}>Sign out to use another account</Button>
        </Space>}
      />
    </Card>
  </Layout>;
}
