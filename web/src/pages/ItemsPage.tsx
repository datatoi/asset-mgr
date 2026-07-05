import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';
import type { Item, ItemType } from '../types/models';

const ItemsPage: React.FC = () => {
  const { userData } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qItems = query(collection(db, 'items'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
    });

    const qTypes = query(collection(db, 'types'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemType)));
    });

    return () => { unsubItems(); unsubTypes(); };
  }, [userData]);

  const onFinish = async (values: Pick<Item, 'typeId' | 'size' | 'gender' | 'rfidTag' | 'condition' | 'imageUrl'>) => {
    if (!userData?.subscriptionId) return;
    try {
      const data = {
        ...values,
        subscriptionId: userData.subscriptionId,
        updatedAt: serverTimestamp(),
      };
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), data);
        message.success('Item updated');
      } else {
        await addDoc(collection(db, 'items'), {
          ...data,
          createdAt: serverTimestamp(),
          holderId: 'storage', // Initial holder is storage
        });
        message.success('Item created');
      }
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed');
    }
  };

  const columns = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      render: (url: string) => <img src={url} alt="item" style={{ width: 40, height: 40, borderRadius: 4 }} />
    },
    {
      title: 'Type',
      dataIndex: 'typeId',
      render: (id: string) => types.find(t => t.id === id)?.name || 'Unknown'
    },
    { title: 'Size', dataIndex: 'size' },
    {
      title: 'Gender',
      dataIndex: 'gender',
      render: (g: string) => <Tag color={g === 'male' ? 'blue' : 'magenta'}>{g?.toUpperCase()}</Tag>
    },
    { title: 'RFID Tag', dataIndex: 'rfidTag' },
    {
      title: 'Holder',
      dataIndex: 'holderId',
      render: (h: string) => h === 'storage' ? <Tag color="green">STORAGE</Tag> : h
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: Item) => (
        <Space>
          <Button type="link" onClick={() => { setEditingItem(record); form.setFieldsValue(record); setIsModalOpen(true); }}>Edit</Button>
          <Popconfirm title="Delete item?" onConfirm={() => deleteDoc(doc(db, 'items', record.id))}><Button type="link" danger>Delete</Button></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Physical Items (Inventory)</h2>
        <Button type="primary" onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }}>Add Item</Button>
      </div>
      <Table dataSource={items} columns={columns} rowKey="id" />

      <Modal title={editingItem ? "Edit Item" : "Add Item"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Space align="start" size="large">
            <Form.Item name="imageUrl" label="Item Image"><ImageUpload folder="items" /></Form.Item>
            <div style={{ flex: 1, minWidth: 400 }}>
              <Form.Item name="typeId" label="Type" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children">
                  {types.map(t => <Select.Option key={t.id} value={t.id}>{t.name} ({t.gender})</Select.Option>)}
                </Select>
              </Form.Item>
              <Space>
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
            </div>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemsPage;
