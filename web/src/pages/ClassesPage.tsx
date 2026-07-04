import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';

const ClassesPage: React.FC = () => {
  const { userData } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const q = query(
      collection(db, 'classes'),
      where('subscriptionId', '==', userData.subscriptionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(data);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleAdd = () => {
    setEditingClass(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingClass(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'classes', id));
      message.success('Class deleted');
    } catch (err) {
      message.error('Failed to delete');
    }
  };

  const onFinish = async (values: any) => {
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), values);
        message.success('Class updated');
      } else {
        await addDoc(collection(db, 'classes'), {
          ...values,
          subscriptionId: userData.subscriptionId,
        });
        message.success('Class created');
      }
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Asset Classes</h2>
        <Button type="primary" onClick={handleAdd}>Add Class</Button>
      </div>
      <Table dataSource={classes} columns={columns} rowKey="id" />

      <Modal
        title={editingClass ? "Edit Class" : "Add Class"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item 
            name="name" 
            label="Class Name" 
            rules={[{ required: true, message: 'Please input class name' }]}
          >
            <Input placeholder="e.g. Dress, Shoes, Trousers" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassesPage;