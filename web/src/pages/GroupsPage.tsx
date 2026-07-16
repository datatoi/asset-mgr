import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import type { Group } from '../types/models';

const GroupsPage: React.FC = () => {
  const { userData } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const isSuperAdmin = Object.values(userData?.groups || {}).some(r => r === 'superadmin');

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const q = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    });

    return () => unsubscribe();
  }, [userData]);

  const onFinish = async (values: Pick<Group, 'name' | 'description'>) => {
    setCreating(true);
    try {
      const createGroupFn = httpsCallable(functions, 'createGroup');
      await createGroupFn(values);
      message.success('Group created');
      setIsModalOpen(false);
      form.resetFields();
    } catch (err) {
      message.error('Failed to create group: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Groups</h2>
        {isSuperAdmin && (
          <Button type="primary" onClick={() => setIsModalOpen(true)}>Add Group</Button>
        )}
      </div>
      <Table dataSource={groups} columns={columns} rowKey="id" scroll={{ x: 'max-content' }} />

      <Modal
        title="Add Group"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please input group name' }]}
          >
            <Input placeholder="e.g. Seniors, Youth, Middle-aged" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GroupsPage;
