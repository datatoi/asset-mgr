import React, { useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Space } from 'antd';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const { user, userData, loading: authLoading } = useAuth();
  const [form] = Form.useForm();

  useEffect(() => {
    if (userData) {
      form.setFieldsValue(userData);
    }
  }, [userData, form]);

  const onFinish = async (values: any) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...values,
        updatedAt: new Date().toISOString(),
      });
      message.success('Profile updated successfully');
    } catch (error) {
      message.error('Failed to update profile');
    }
  };

  if (authLoading) return null;

  return (
    <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
      <Card style={{ width: 600 }}>
        <Title level={2}>My Profile</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={userData || {}}
        >
          <Form.Item name="avatarUrl" label="Profile Picture">
            <ImageUpload folder="avatars" />
          </Form.Item>
          
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          <Form.Item label="Email" name="email">
            <Input disabled />
          </Form.Item>

          <Space size="large">
            <Form.Item label="Default Size" name="size">
              <Input placeholder="e.g. M, 42" />
            </Form.Item>
            
            <Form.Item label="Gender" name="gender">
              <Select style={{ width: 120 }}>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
                <Select.Option value="unisex">Unisex</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large">
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProfilePage;
