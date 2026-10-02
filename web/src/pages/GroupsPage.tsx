import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { call } from '../lib/api';
import { canManageRoles } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import type { Group } from '../types/models';

const GroupsPage: React.FC = () => {
  const { userData, isOwner } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group>();
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => {
    if (!userData?.subscriptionId) return;
    return onSnapshot(query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId)), snap => {
      setGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as Group)));
    }, e => message.error(e.message));
  }, [userData?.subscriptionId]);
  const save = async (values: { name: string; description?: string }) => {
    setBusy(true);
    try {
      await call(editing ? 'updateGroup' : 'createGroup', { ...values, ...(editing ? { groupId: editing.id } : {}) });
      setOpen(false);
      message.success('Group saved');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not save group'); }
    finally { setBusy(false); }
  };
  const remove = async (groupId: string) => {
    try { await call('deleteGroup', { groupId }); message.success('Group deleted'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not delete group'); }
  };
  return <div style={{ padding: 24 }}>
    <Space style={{ marginBottom: 16 }}><h2>Groups</h2>
      {canManageRoles(userData, undefined, isOwner) && <Button type="primary" onClick={() => { setEditing(undefined); form.resetFields(); setOpen(true); }}>Add group</Button>}
    </Space>
    <Table dataSource={groups} rowKey="id" columns={[
      { title: 'Name', dataIndex: 'name' }, { title: 'Description', dataIndex: 'description' },
      { title: 'Action', render: (_: unknown, g: Group) => canManageRoles(userData, g.id, isOwner) && <Space>
        <Button onClick={() => { setEditing(g); form.setFieldsValue(g); setOpen(true); }}>Edit</Button>
        <Popconfirm title="Delete this empty group?" onConfirm={() => remove(g.id)}><Button danger>Delete</Button></Popconfirm>
      </Space> },
    ]} />
    <Modal open={open} title={editing ? 'Edit group' : 'Add group'} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea maxLength={2000} /></Form.Item>
      </Form>
    </Modal>
  </div>;
};
export default GroupsPage;
