import React from 'react';
import { Button, Card, Typography, Layout, Space } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Content } = Layout;

const LoginPage: React.FC = () => {
  const { login, user, userData, loading, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && user) {
      if (userData) {
        navigate('/dashboard');
      } else if (isPlatformAdmin) {
        navigate('/platform-admin');
      } else {
        navigate('/register');
      }
    }
  }, [user, userData, isPlatformAdmin, loading, navigate]);

  return (
    <Layout style={{ minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Card style={{ width: 400, textAlign: 'center', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={2}>Dress Asset Management</Title>
            <Text type="secondary">Manage your organization's costumes with ease.</Text>
            <Button 
              type="primary" 
              size="large" 
              icon={<GoogleOutlined />} 
              onClick={login}
              block
              style={{ height: 48, borderRadius: 6 }}
            >
              Sign in with Google
            </Button>
          </Space>
        </Card>
      </Content>
    </Layout>
  );
};

export default LoginPage;