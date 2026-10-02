import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveCatalog, deleteCatalog } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';
import type { Group, Item, Product } from '../types/models';

const ItemsPage: React.FC = () => {
  const { userData, isOwner } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form] = Form.useForm();

  const isAdmin = canManage(userData, undefined, isOwner);
  const selectedGroup = Form.useWatch('groupId', form);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qItems = query(collection(db, 'items'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Item)));
    });

    const qProducts = query(collection(db, 'products'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    });

    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group)));
    });

    return () => { unsubItems(); unsubProducts(); unsubGroups(); };
  }, [userData]);

  const onFinish = async (values: Pick<Item, 'productId' | 'groupId' | 'size' | 'gender' | 'rfidTag' | 'condition' | 'imageUrl' | 'description'>) => {
    if (!userData?.subscriptionId) return;
    try {
      const { productId, groupId, size, gender, rfidTag, condition, imageUrl, description } = values;
      await saveCatalog('items', { productId, groupId, size, gender, rfidTag, condition, imageUrl, description }, editingItem?.id);
      message.success(editingItem ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const columns = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      render: (url: string) => <img src={url} alt="item" style={{ width: 40, height: 40, borderRadius: 4 }} />
    },
    {
      title: 'Product',
      dataIndex: 'productId',
      render: (id: string) => products.find(p => p.id === id)?.name || 'Unknown'
    },
    { title: 'Size', dataIndex: 'size' },
    {
      title: 'Gender',
      dataIndex: 'gender',
      render: (g: string) => <Tag color={g === 'male' ? 'blue' : 'magenta'}>{g?.toUpperCase()}</Tag>
    },
    { title: 'RFID Tag', dataIndex: 'rfidTag' },
    {
      title: 'Group',
      dataIndex: 'groupId',
      render: (id: string) => groups.find(g => g.id === id)?.name || 'Unknown'
    },
    {
      title: 'Holder',
      dataIndex: 'holderId',
      render: (h: string) => h === 'storage' ? <Tag color="green">STORAGE</Tag> : h
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: Item) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button type="link" onClick={() => navigate(`/items/${record.id}`)}>View</Button>
          <Button type="link" hidden={!canManage(userData, record.groupId, isOwner)} onClick={() => { setEditingItem(record); form.setFieldsValue(record); setIsModalOpen(true); }}>Edit</Button>
          <Popconfirm title="Delete item?" onConfirm={() => deleteCatalog('items', record.id)}><Button type="link" danger hidden={!canManage(userData, record.groupId, isOwner)}>Delete</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Physical Items (Inventory)</h2>
        <Button type="primary" hidden={!isAdmin} onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }}>Add Item</Button>
      </div>
      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => navigate(`/items/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal title={editingItem ? "Edit Item" : "Add Item"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Space align="start" size="large" wrap style={{ width: '100%' }}>
            <Form.Item name="imageUrl" label="Item Image"><ImageUpload disabled={!selectedGroup} folder={`subscriptions/${userData?.subscriptionId}/groups/${selectedGroup}/items`} /></Form.Item>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children">
                  {products.filter(p => p.groupId === selectedGroup).map(p => <Select.Option key={p.id} value={p.id}>{p.name} ({p.gender})</Select.Option>)}
                </Select>
              </Form.Item>
              <Space wrap>
                <Form.Item name="size" label="Size" rules={[{ required: true }]}><Input placeholder="e.g. M, 42, 175cm" /></Form.Item>
                <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
                  <Select style={{ width: 120 }}>
                    <Select.Option value="male">Male</Select.Option>
                    <Select.Option value="female">Female</Select.Option>
                    <Select.Option value="unisex">Unisex</Select.Option>
                  </Select>
                </Form.Item>
              </Space>
              <Form.Item name="rfidTag" label="NFC / RFID Tag ID"><Input placeholder="Scan or type Tag UID" /></Form.Item>
              <Form.Item name="condition" label="Condition"><Select><Select.Option value="new">New</Select.Option><Select.Option value="good">Good</Select.Option><Select.Option value="worn">Worn</Select.Option><Select.Option value="damaged">Damaged</Select.Option></Select></Form.Item>
              <Form.Item name="description" label="Description"><Input.TextArea rows={2} placeholder="Notes about this specific item" /></Form.Item>
              <Form.Item name="groupId" label="Group" rules={[{ required: true }]}>
                <Select placeholder="Select Group" onChange={() => form.setFieldsValue({ productId: undefined, imageUrl: undefined })} disabled={!!editingItem?.groupId}>
                  {groups.filter(g => canManage(userData, g.id, isOwner)).map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </div>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemsPage;
