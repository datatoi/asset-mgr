import React, { useState } from 'react';
import { Button, Card, Typography, Layout, Space, Result } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';

const { Title, Text } = Typography;
const { Content } = Layout;

const JoinPage: React.FC = () => {
  const { subscriptionId } = useParams();
  const { user, userData, loading, login } = useAuth();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedName, setJoinedName] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!subscriptionId) return;
    setJoining(true);
    setError(null);
    try {
      const joinSubscription = httpsCallable(functions, 'joinSubscription');
      const result = await joinSubscription({ subscriptionId });
      const data = result.data as { subscriptionName?: string };
      setJoinedName(data.subscriptionName || 'the organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJoining(false);
    }
  };

  if (!subscriptionId) {
    return <Result status="404" title="Invalid invite link" />;
  }

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '0 16px', boxSizing: 'border-box' }}>
        <Card style={{ width: 420, maxWidth: '100%', textAlign: 'center', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {loading ? null : joinedName ? (
            <Result
              status="success"
              title={`You've joined ${joinedName}!`}
              extra={<Button type="primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>}
            />
          ) : !user ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={3}>You're invited</Title>
              <Text type="secondary">Sign in with Google to join this organization.</Text>
              <Button type="primary" size="large" icon={<GoogleOutlined />} onClick={login} block>
                Sign in with Google
              </Button>
            </Space>
          ) : userData ? (
            <Result
              status="warning"
              title="You already belong to an organization"
              subTitle="This account is already part of another subscription. Ask an admin there to remove you first if you want to switch."
              extra={<Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>}
            />
          ) : (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={3}>You're invited</Title>
              <Text type="secondary">Join this organization as a member. An admin can change your role afterward.</Text>
              {error && <Text type="danger">{error}</Text>}
              <Button type="primary" size="large" loading={joining} onClick={handleJoin} block>
                Join
              </Button>
            </Space>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default JoinPage;
