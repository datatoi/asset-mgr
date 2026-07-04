import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';

const TypesPage: React.FC = () => {
  const { userData } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    // Sync Types
    const qTypes = query(
      collection(db, 'types'),
      where('subscriptionId', '==', userData.subscriptionId)
    );
    const unsubTypes = onSnapshot(qTypes, (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Sync Classes for the dropdown
    const qClasses = query(
      collection(db, 'classes'),
      where('subscriptionId', '==', userData.subscriptionId)
    );
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTypes();
      unsubClasses();
    };
  }, [userData]);

  const handleAdd = () => {
    setEditingType(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingType(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const onFinish = async (values: any) => {
    try {
      const data = {
        ...values,
        subscriptionId: userData.subscriptionId,
      };
      if (editingType) {
        await updateDoc(doc(db, 'types', editingType.id), data);
        message.success('Type updated');
      } else {
        await addDoc(collection(db, 'types'), data);
        message.success('Type created');
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
      key: 'imageUrl',
      render: (url: string) => url ? <img src={url} alt="type" style={{ width: 50, height: 50, objectFit: 'cover' }} /> : 'No image'
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Class', 
      dataIndex: 'classId', 
      key: 'classId',
      render: (id: string) => classes.find(c => c.id === id)?.name || 'Unknown'
    },
    { 
      title: 'Gender', 
      dataIndex: 'gender', 
      key: 'gender',
      render: (g: string) => <Tag color={g === 'male' ? 'blue' : g === 'female' ? 'magenta' : 'default'}>{g.toUpperCase()}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => deleteDoc(doc(db, 'types', record.id))}>
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Asset Types</h2>
        <Button type="primary" onClick={handleAdd}>Add Type</Button>
      </div>
      <Table dataSource={types} columns={columns} rowKey="id" />

      <Modal
        title={editingType ? "Edit Type" : "Add Type"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="imageUrl" label="Type Image">
            <ImageUpload folder="types" />
          </Form.Item>
          <Form.Item 
            name="name" 
            label="Type Name" 
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. Red Floral Skirt" />
          </Form.Item>
          <Form.Item name="classId" label="Class" rules={[{ required: true }]}>
            <Select placeholder="Select Class">
              {classes.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
            <Select>
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

export default TypesPage;