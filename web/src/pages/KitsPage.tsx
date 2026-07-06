import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { httpsCallable } from 'firebase/functions';
import type { Kit, ItemType } from '../types/models';

const KitsPage: React.FC = () => {
  const { userData } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [form] = Form.useForm();

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qKits = query(collection(db, 'kits'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubKits = onSnapshot(qKits, (snapshot) => {
      setKits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kit)));
    });

    const qTypes = query(collection(db, 'types'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemType)));
    });

    return () => { unsubKits(); unsubTypes(); };
  }, [userData]);

  const handleRequest = async (kitId: string) => {
    setRequestLoading(kitId);
    try {
      const requestKitFn = httpsCallable(functions, 'requestKit');
      await requestKitFn({ kitId });
      message.success('Kit requested successfully! Individual item requests have been created.');
    } catch (err) {
      message.error('Failed to request kit: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRequestLoading(null);
    }
  };

  const onFinish = async (values: Pick<Kit, 'name' | 'gender' | 'typeIds' | 'description'>) => {
    if (!userData?.subscriptionId) return;
    try {
      const data = { ...values, subscriptionId: userData.subscriptionId };
      if (editingKit) {
        await updateDoc(doc(db, 'kits', editingKit.id), data);
        message.success('Kit updated');
      } else {
        await addDoc(collection(db, 'kits'), data);
        message.success('Kit created');
      }
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const columns = [
    { title: 'Kit Name', dataIndex: 'name' },
    { title: 'Gender', dataIndex: 'gender', render: (g: string) => <Tag>{g?.toUpperCase()}</Tag> },
    {
      title: 'Required Types',
      dataIndex: 'typeIds',
      render: (ids: string[]) => ids?.map(id => {
        const typeName = types.find(t => t.id === id)?.name;
        return <Tag key={id} color="blue">{typeName}</Tag>;
      })
    },
    {
      title: 'Action',
      render: (_: unknown, record: Kit) => (
        <Space>
          {isAdmin ? (
            <>
              <Button type="link" onClick={() => { setEditingKit(record); form.setFieldsValue(record); setIsModalOpen(true); }}>Edit</Button>
              <Popconfirm title="Delete?" onConfirm={() => deleteDoc(doc(db, 'kits', record.id))}><Button type="link" danger>Delete</Button></Popconfirm>
            </>
          ) : (
            <Button
              type="primary"
              onClick={() => handleRequest(record.id)}
              loading={requestLoading === record.id}
            >
              Request Kit
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Costume Kits (Sets)</h2>
        {isAdmin && <Button type="primary" onClick={() => { setEditingKit(null); form.resetFields(); setIsModalOpen(true); }}>Define Kit</Button>}
      </div>
      <Table dataSource={kits} columns={columns} rowKey="id" />

      <Modal title="Kit Definition" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Kit Name" rules={[{ required: true }]}><Input placeholder="e.g. Wedding Costume A" /></Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
            <Select><Select.Option value="male">Male</Select.Option><Select.Option value="female">Female</Select.Option></Select>
          </Form.Item>
          <Form.Item name="typeIds" label="Required Types" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="Select what makes this kit complete">
              {types.map(t => <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KitsPage;
