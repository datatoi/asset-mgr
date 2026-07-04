import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { httpsCallable } from 'firebase/functions';

const KitsPage: React.FC = () => {
  const { userData } = useAuth();
  const [kits, setKits] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState<string | null>(null);
  const [form] = Form.useForm();

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qKits = query(collection(db, 'kits'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubKits = onSnapshot(qKits, (snapshot) => {
      setKits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qClasses = query(collection(db, 'classes'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubKits(); unsubClasses(); };
  }, [userData]);

  const handleRequest = async (kitId: string) => {
    setRequestLoading(kitId);
    try {
      const requestKitFn = httpsCallable(functions, 'requestKit');
      await requestKitFn({ kitId });
      message.success('Kit requested successfully! Individual item requests have been created.');
    } catch (err: any) {
      message.error('Failed to request kit: ' + err.message);
    } finally {
      setRequestLoading(null);
    }
  };

  const onFinish = async (values: any) => {
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
    } catch (err) { message.error('Failed'); }
  };

  const columns = [
    { title: 'Kit Name', dataIndex: 'name' },
    { title: 'Gender', dataIndex: 'gender', render: (g: string) => <Tag>{g?.toUpperCase()}</Tag> },
    { 
      title: 'Required Classes', 
      dataIndex: 'classIds',
      render: (ids: string[]) => ids?.map(id => {
        const className = classes.find(c => c.id === id)?.name;
        return <Tag key={id} color="blue">{className}</Tag>;
      })
    },
    {
      title: 'Action',
      render: (_: any, record: any) => (
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
          <Form.Item name="classIds" label="Required Classes" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="Select what makes this kit complete">
              {classes.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KitsPage;