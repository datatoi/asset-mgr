import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag, Typography, Card, Result } from 'antd';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Plan, Subscription } from '../types/models';

const { Title } = Typography;

const PlatformAdminPage: React.FC = () => {
  const { startImpersonating, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!isPlatformAdmin) return;
    const unsubSubs = onSnapshot(collection(db, 'subscriptions'), (snap) => {
      setSubscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subscription)));
    });
    const unsubPlans = onSnapshot(collection(db, 'plans'), (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan)));
    });
    return () => {
      unsubSubs();
      unsubPlans();
    };
  }, [isPlatformAdmin]);

  const handleEdit = (record: Subscription) => {
    setEditingSub(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const onFinish = async (values: Pick<Subscription, 'name' | 'ownerUserId' | 'status' | 'planId'>) => {
    if (!editingSub) return;
    try {
      await updateDoc(doc(db, 'subscriptions', editingSub.id), values);
      message.success('Subscription updated');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Failed to update subscription');
    }
  };

  const handleManageAs = async (subId: string) => {
    setManagingId(subId);
    try {
      await startImpersonating(subId);
      navigate('/dashboard');
    } catch (err) {
      message.error('Failed to impersonate subscription');
    } finally {
      setManagingId(null);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Owner UID', dataIndex: 'ownerUserId' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => <Tag color={s === 'suspended' ? 'red' : 'green'}>{(s || 'active').toUpperCase()}</Tag>,
    },
    {
      title: 'Plan',
      dataIndex: 'planId',
      render: (id: string) => plans.find((p) => p.id === id)?.name || '—',
    },
    {
      title: 'Action',
      render: (_: unknown, record: Subscription) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          <Button type="primary" loading={managingId === record.id} onClick={() => handleManageAs(record.id)}>
            Manage as
          </Button>
        </Space>
      ),
    },
  ];

  if (!isPlatformAdmin) {
    return <Result status="403" title="Not authorized" subTitle="Platform Admin access only." />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>Platform Admin — Subscriptions</Title>
        <Table dataSource={subscriptions} columns={columns} rowKey="id" />
      </Card>

      <Modal title="Edit Subscription" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ownerUserId" label="Owner UID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="suspended">Suspended</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="planId" label="Plan">
            <Select allowClear placeholder="No plan assigned">
              {plans.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlatformAdminPage;
