import React, { useEffect, useState } from 'react';
import { Table, Space, Card, Typography, message, Select, Button, Modal, Form, Input, Popconfirm } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { call } from '../lib/api';
import { canManage, canManageRoles } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import type { Category, Group, Role, UserProfile } from '../types/models';

const MembersPage: React.FC = () => {
  const { user, userData, isOwner } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ member: UserProfile; groupId: string }>();
  const [form] = Form.useForm();
  useEffect(() => {
    if (!userData?.subscriptionId) return;
    const sub = userData.subscriptionId;
    const error = (e: Error) => { message.error(e.message); };
    const a = onSnapshot(query(collection(db, 'users'), where('subscriptionId', '==', sub)), snap => setMembers(snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile))), error);
    const b = onSnapshot(query(collection(db, 'groups'), where('subscriptionId', '==', sub)), snap => setGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as Group))), error);
    const c = onSnapshot(query(collection(db, 'categories'), where('subscriptionId', '==', sub)), snap => setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id } as Category))), error);
    return () => { a(); b(); c(); };
  }, [userData?.subscriptionId]);
  const changeRole = async (targetUid: string, groupId: string, role: Role | null) => {
    setBusy(true);
    try { await call('assignRole', { targetUid, groupId, role }); message.success('Role updated'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not update role'); }
    finally { setBusy(false); }
  };
  const editGroup = (m: UserProfile) => groups.find(g => m.groups?.[g.id] && canManage(userData, g.id, isOwner) &&
    (isOwner || m.id === user?.uid || (m.groups?.[g.id] !== 'superadmin' && (userData?.groups?.[g.id] === 'superadmin' || m.groups?.[g.id] !== 'admin'))));
  const save = async (values: { name?: string; gender?: string; sizes?: Record<string, string> }) => {
    if (!editing) return;
    setBusy(true);
    try {
      await call('updateMember', { targetUid: editing.member.id, groupId: editing.groupId, profile: values });
      setEditing(undefined); message.success('Member saved');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not save member'); }
    finally { setBusy(false); }
  };
  const remove = async (targetUid: string) => {
    try { await call('removeMember', { targetUid }); message.success('Member removed'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not remove member'); }
  };
  return <div style={{ padding: 24 }}><Card>
    <Typography.Title level={2}>Members</Typography.Title>
    <Table dataSource={members} rowKey="id" scroll={{ x: 'max-content' }} columns={[
      { title: 'Name', dataIndex: 'name' }, { title: 'Email', dataIndex: 'email' },
      { title: 'Roles', render: (_: unknown, m: UserProfile) => <Space orientation="vertical">{groups.map(g => <Space key={g.id}>
        <span>{g.name}</span>
        <Select style={{ width: 150 }} value={m.groups?.[g.id] || ''} loading={busy}
          disabled={!canManageRoles(userData, g.id, isOwner)}
          onChange={val => changeRole(m.id, g.id, (val || null) as Role | null)} options={[
            { value: '', label: 'No role' }, ...['joiner', 'user', 'admin', 'superadmin'].map(role => ({ value: role, label: role })),
          ]} />
      </Space>)}</Space> },
      { title: 'Action', render: (_: unknown, m: UserProfile) => <Space>
        {editGroup(m) && <Button onClick={() => { const g = editGroup(m); if (g) { setEditing({ member: m, groupId: g.id }); form.resetFields(); form.setFieldsValue(m); } }}>Edit profile</Button>}
        {isOwner && m.id !== user?.uid && <Popconfirm title="Remove this member from the organization? Reassign their items first." onConfirm={() => remove(m.id)}><Button danger>Remove</Button></Popconfirm>}
      </Space> },
    ]} />
    <Modal title="Edit member" open={!!editing} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="gender" label="Gender"><Select options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></Form.Item>
        {categories.map(c => <Form.Item key={c.id} name={['sizes', c.id]} label={`${c.name} size`}><Input maxLength={50} /></Form.Item>)}
      </Form>
    </Modal>
  </Card></div>;
};
export default MembersPage;
