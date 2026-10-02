import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveCatalog, deleteCatalog } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import type { Category, Group } from '../types/models';

const CategoriesPage: React.FC = () => {
  const { userData, isOwner } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();

  const isAdmin = canManage(userData, undefined, isOwner);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const q = query(
      collection(db, 'categories'),
      where('subscriptionId', '==', userData.subscriptionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category));
      setCategories(data);
    });

    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group)));
    });

    return () => { unsubscribe(); unsubGroups(); };
  }, [userData]);

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: Category) => {
    setEditingCategory(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => deleteCatalog('categories', id);

  const onFinish = async (values: Pick<Category, 'name' | 'groupId' | 'gender'>) => {
    if (!userData?.subscriptionId) return;
    try {
      const { name, groupId, gender } = values;
      await saveCatalog('categories', { name, groupId, gender }, editingCategory?.id);
      message.success(editingCategory ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Group',
      dataIndex: 'groupId',
      key: 'groupId',
      render: (id: string) => groups.find(g => g.id === id)?.name || 'Unknown'
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (g: string) => <Tag color={g === 'male' ? 'blue' : g === 'female' ? 'magenta' : 'default'}>{g?.toUpperCase()}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: Category) => (
        <Space size="middle">
          <Button type="link" hidden={!canManage(userData, record.groupId, isOwner)} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger hidden={!canManage(userData, record.groupId, isOwner)}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Categories</h2>
        <Button type="primary" hidden={!isAdmin} onClick={handleAdd}>Add Category</Button>
      </div>
      <Table dataSource={categories} columns={columns} rowKey="id" scroll={{ x: 'max-content' }} />

      <Modal
        title={editingCategory ? "Edit Category" : "Add Category"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please input category name' }]}
          >
            <Input placeholder="e.g. Dress, Shoes, Trousers" />
          </Form.Item>
          <Form.Item name="groupId" label="Group" rules={[{ required: true }]}>
            <Select placeholder="Select Group" disabled={!!editingCategory?.groupId}>
              {groups.filter(g => canManage(userData, g.id, isOwner)).map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
            <Select placeholder="Select Gender">
              <Select.Option value="male">Male</Select.Option>
              <Select.Option value="female">Female</Select.Option>
              <Select.Option value="unisex">Unisex</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoriesPage;
