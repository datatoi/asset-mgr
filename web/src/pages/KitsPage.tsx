import Table from '../components/PresentationTable';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveCatalog, deleteCatalog } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import type { Group, Kit, Product } from '../types/models';

const KitsPage: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const { userData, isOwner } = useAuth();
  const [kits, setKits] = useState<Kit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);



  const isAdmin = canManage(userData, undefined, isOwner);
  const selectedGroup = Form.useWatch('groupId', form);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qKits = query(collection(db, 'kits'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubKits = onSnapshot(qKits, (snapshot) => {
      setKits(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Kit)));
    });

    const qProducts = query(collection(db, 'products'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    });

    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group)));
    });

    return () => { unsubKits(); unsubProducts(); unsubGroups(); };
  }, [userData]);

  const onFinish = async (values: Pick<Kit, 'name' | 'gender' | 'productIds' | 'description' | 'groupId'>) => {
    if (!userData?.subscriptionId || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      const { name, gender, productIds, description, groupId } = values;
      await saveCatalog('kits', { name, gender, productIds, description, groupId }, editingKit?.id);
      message.success(editingKit ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Kit Name', dataIndex: 'name' },
    { title: 'Gender', dataIndex: 'gender', render: (g: string) => <Tag>{g?.toUpperCase()}</Tag> },
    {
      title: 'Required Products',
      dataIndex: 'productIds',
      render: (ids: string[]) => ids?.map(id => {
        const productName = products.find(p => p.id === id)?.name;
        return <Tag key={id} color="blue">{productName}</Tag>;
      })
    },
    {
      title: 'Group',
      dataIndex: 'groupId',
      render: (id: string) => groups.find(g => g.id === id)?.name || 'Unknown'
    },
    {
      title: 'Action',
      render: (_: unknown, record: Kit) => (
        <Space>
          {canManage(userData, record.groupId, isOwner) ? (
            <>
              <Button type="link" onClick={() => { setEditingKit(record); form.resetFields(); form.setFieldsValue(record); setIsModalOpen(true); }}>Edit</Button>
              <Popconfirm title="Delete?" onConfirm={() => deleteCatalog('kits', record.id)}><Button type="link" danger>Delete</Button></Popconfirm>
            </>
          ) : null}
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
      <Table mobile={mobile} dataSource={kits} columns={columns} rowKey="id" scroll={{ x: 'max-content' }} />

      <Modal className={mobile ? "mobile-editor" : undefined} title="Kit Definition" open={isModalOpen} onCancel={() => { if (!submitting.current) setIsModalOpen(false); }} onOk={() => { if (!submitting.current) form.submit(); }} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} mask={{ closable: !saving }}>
        <Form form={form} layout="vertical" onFinish={onFinish} disabled={saving}>
          <Form.Item name="name" label="Kit Name" rules={[{ required: true }]}><Input placeholder="e.g. Wedding Costume A" /></Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
            <Select><Select.Option value="male">Male</Select.Option><Select.Option value="female">Female</Select.Option></Select>
          </Form.Item>
          <Form.Item name="productIds" label="Required Products" rules={[{ required: true }]}>
            <Select mode="multiple" placeholder="Select what makes this kit complete">
              {products.filter(p => p.groupId === selectedGroup).map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea /></Form.Item>
          <Form.Item name="groupId" label="Group" rules={[{ required: true }]}>
            <Select placeholder="Select Group" onChange={() => form.setFieldsValue({ productIds: undefined })} disabled={!!editingKit?.groupId}>
              {groups.filter(g => canManage(userData, g.id, isOwner)).map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KitsPage;
