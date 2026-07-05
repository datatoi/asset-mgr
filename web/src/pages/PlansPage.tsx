import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Result } from 'antd';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import type { Plan } from '../types/models';

const PlansPage: React.FC = () => {
  const { isPlatformAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'plans'), (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Plan)));
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = () => {
    setEditingPlan(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: Plan) => {
    setEditingPlan(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const onFinish = async (values: Pick<Plan, 'name' | 'priceMonthly' | 'maxMembers' | 'maxItems' | 'description'>) => {
    try {
      if (editingPlan) {
        await updateDoc(doc(db, 'plans', editingPlan.id), values);
        message.success('Plan updated');
      } else {
        await addDoc(collection(db, 'plans'), values);
        message.success('Plan created');
      }
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Price/month', dataIndex: 'priceMonthly', render: (v: number) => v != null ? `$${v}` : '—' },
    { title: 'Max members', dataIndex: 'maxMembers' },
    { title: 'Max items', dataIndex: 'maxItems' },
    { title: 'Description', dataIndex: 'description' },
    {
      title: 'Action',
      render: (_: unknown, record: Plan) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Delete plan?" onConfirm={() => deleteDoc(doc(db, 'plans', record.id))}>
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isPlatformAdmin) {
    return <Result status="403" title="Not authorized" subTitle="Platform Admin access only." />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Pricing Plans</h2>
        <Button type="primary" onClick={handleAdd}>Add Plan</Button>
      </div>
      <Table dataSource={plans} columns={columns} rowKey="id" />

      <Modal title={editingPlan ? 'Edit Plan' : 'Add Plan'} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Plan Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Pro" />
          </Form.Item>
          <Form.Item name="priceMonthly" label="Price per month (USD)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxMembers" label="Max members">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxItems" label="Max items">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlansPage;
