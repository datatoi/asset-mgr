import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Layout, message } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

const { Title } = Typography;
const { Content } = Layout;

const RegisterPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { orgName: string, groupName: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Create Subscription
      const subRef = doc(collection(db, 'subscriptions'));
      batch.set(subRef, {
        name: values.orgName,
        ownerUserId: user.uid,
        createdAt: new Date().toISOString()
      });

      // 2. Create first Group
      const groupRef = doc(collection(db, 'groups'));
      batch.set(groupRef, {
        subscriptionId: subRef.id,
        name: values.groupName,
        description: 'Default group',
        createdAt: new Date().toISOString()
      });

      // 3. Create User doc
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, {
        subscriptionId: subRef.id,
        name: user.displayName || 'Anonymous',
        email: user.email,
        avatarUrl: user.photoURL,
        groups: {
          [groupRef.id]: 'superadmin'
        },
        createdAt: new Date().toISOString()
      });

      await batch.commit();
      message.success('Account setup complete!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      message.error('Failed to setup account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', padding: '50px 0', background: '#f0f2f5' }}>
      <Content style={{ display: 'flex', justifyContent: 'center' }}>
        <Card style={{ width: 500, borderRadius: 8 }}>
          <Title level={3} style={{ textAlign: 'center' }}>Setup Your Organization</Title>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item label="Organization Name" name="orgName" rules={[{ required: true }]}>
              <Input placeholder="e.g. Folk Dance Ensemble" />
            </Form.Item>
            <Form.Item label="First Group Name" name="groupName" rules={[{ required: true }]}>
              <Input placeholder="e.g. Main Group" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                Create & Start
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
};

export default RegisterPage;