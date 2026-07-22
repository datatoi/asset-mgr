import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, Select, message, Space } from 'antd';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';
import type { Category, Gender } from '../types/models';

const { Title, Text } = Typography;

const ProfilePage: React.FC = () => {
  const { user, userData, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!userData?.subscriptionId) return;
    const q = query(collection(db, 'categories'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    return () => unsubscribe();
  }, [userData?.subscriptionId]);

  useEffect(() => {
    if (userData) {
      form.setFieldsValue(userData);
    }
  }, [userData, form]);

  // Reacts live if the user changes their gender in this same form, so the
  // size list below updates before they've even saved.
  const selectedGender = Form.useWatch('gender', form) ?? userData?.gender;
  const visibleCategories = categories.filter(c => c.gender === 'unisex' || c.gender === selectedGender);

  const onFinish = async (values: { name?: string; avatarUrl?: string; gender?: Gender; sizes?: Record<string, string> }) => {
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
      <Card style={{ width: 600, maxWidth: '100%' }}>
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

          <Form.Item label="Gender" name="gender">
            <Select style={{ width: 120 }}>
              <Select.Option value="male">Male</Select.Option>
              <Select.Option value="female">Female</Select.Option>
            </Select>
          </Form.Item>

          <Text strong>Sizes by category</Text>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            A shoe size and a dress size aren't the same scale — set one per category.
            {!selectedGender && ' Set your gender above to see male/female categories (unisex ones always show).'}
          </Text>
          <Space direction="vertical" style={{ width: '100%' }}>
            {categories.length === 0 && <Text type="secondary">No categories defined yet.</Text>}
            {categories.length > 0 && visibleCategories.length === 0 && (
              <Text type="secondary">No categories for your gender yet.</Text>
            )}
            {visibleCategories.map(category => (
              <Form.Item
                key={category.id}
                label={category.name}
                name={['sizes', category.id]}
                style={{ marginBottom: 8 }}
              >
                <Input placeholder="e.g. M, 42" style={{ width: 200 }} />
              </Form.Item>
            ))}
          </Space>

          <Form.Item style={{ marginTop: 16 }}>
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
