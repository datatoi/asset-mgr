import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveCatalog, deleteCatalog } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';
import type { Category, Group, Product } from '../types/models';

const ProductsPage: React.FC = () => {
  const { userData, isOwner } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();

  const isAdmin = canManage(userData, undefined, isOwner);
  const selectedGroup = Form.useWatch('groupId', form);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    // Sync Products
    const qProducts = query(
      collection(db, 'products'),
      where('subscriptionId', '==', userData.subscriptionId)
    );
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    });

    // Sync Categories for the dropdown
    const qCategories = query(
      collection(db, 'categories'),
      where('subscriptionId', '==', userData.subscriptionId)
    );
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category)));
    });

    // Sync Groups for the dropdown
    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group)));
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubGroups();
    };
  }, [userData]);

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record: Product) => {
    setEditingProduct(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const onFinish = async (values: Pick<Product, 'name' | 'categoryId' | 'groupId' | 'gender' | 'imageUrl'>) => {
    if (!userData?.subscriptionId) return;
    try {
      const { name, categoryId, groupId, gender, imageUrl } = values;
      await saveCatalog('products', { name, categoryId, groupId, gender, imageUrl }, editingProduct?.id);
      message.success(editingProduct ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const columns = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      render: (url: string) => url ? <img src={url} alt="product" style={{ width: 50, height: 50, objectFit: 'cover' }} /> : 'No image'
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Category',
      dataIndex: 'categoryId',
      key: 'categoryId',
      render: (id: string) => categories.find(c => c.id === id)?.name || 'Unknown'
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (g: string) => <Tag color={g === 'male' ? 'blue' : g === 'female' ? 'magenta' : 'default'}>{g.toUpperCase()}</Tag>
    },
    {
      title: 'Group',
      dataIndex: 'groupId',
      key: 'groupId',
      render: (id: string) => groups.find(g => g.id === id)?.name || 'Unknown'
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: Product) => (
        <Space size="middle">
          <Button type="link" hidden={!canManage(userData, record.groupId, isOwner)} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm title="Sure to delete?" onConfirm={() => deleteCatalog('products', record.id)}>
            <Button type="link" danger hidden={!canManage(userData, record.groupId, isOwner)}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Products</h2>
        <Button type="primary" hidden={!isAdmin} onClick={handleAdd}>Add Product</Button>
      </div>
      <Table dataSource={products} columns={columns} rowKey="id" scroll={{ x: 'max-content' }} />

      <Modal
        title={editingProduct ? "Edit Product" : "Add Product"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="imageUrl" label="Product Image">
            <ImageUpload disabled={!selectedGroup} folder={`subscriptions/${userData?.subscriptionId}/groups/${selectedGroup}/products`} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. Red Floral Skirt" />
          </Form.Item>
          <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select Category">
              {categories.filter(c => c.groupId === selectedGroup).map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="male">Male</Select.Option>
              <Select.Option value="female">Female</Select.Option>
              <Select.Option value="unisex">Unisex</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="groupId" label="Group" rules={[{ required: true }]}>
            <Select placeholder="Select Group" onChange={() => form.setFieldsValue({ categoryId: undefined, imageUrl: undefined })} disabled={!!editingProduct?.groupId}>
              {groups.filter(g => canManage(userData, g.id, isOwner)).map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductsPage;
