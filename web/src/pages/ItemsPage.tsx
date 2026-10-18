import InventoryBrowser from '../components/InventoryBrowser';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Form, Input, Space, message, Popconfirm, Select, Typography } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveCatalog, deleteCatalog } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import ImageUpload from '../components/ImageUpload';
import SizeInput from '../components/SizeInput';
import type { Category, Group, Item, Product } from '../types/models';

const ItemsPage: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const { userData, isOwner } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  const isAdmin = canManage(userData, undefined, isOwner);
  const selectedGroup = Form.useWatch('groupId', form);
  const managedGroups = groups.filter(g => canManage(userData, g.id, isOwner));
  const selectedProductId = Form.useWatch('productId', form);
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const itemImage = Form.useWatch('imageUrl', form);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qProducts = query(collection(db, 'products'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product)));
    });

    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Group)));
    });

    const qCategories = query(collection(db, 'categories'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Category)));
    });

    return () => { unsubProducts(); unsubGroups(); unsubCategories(); };
  }, [userData]);

  const onFinish = async (values: Pick<Item, 'productId' | 'groupId' | 'size' | 'gender' | 'rfidTag' | 'condition' | 'imageUrl' | 'description'>) => {
    if (!userData?.subscriptionId || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      const { productId, groupId, size, gender, rfidTag, condition, imageUrl, description } = values;
      await saveCatalog('items', { productId, groupId, size, gender, rfidTag, condition, imageUrl, description }, editingItem?.id);
      message.success(editingItem ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
    } catch (err) {
      message.error('Operation failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Physical Items (Inventory)</h2>
        <Button type="primary" hidden={!isAdmin} onClick={() => { setEditingItem(null); form.resetFields(); if (managedGroups.length === 1) form.setFieldsValue({ groupId: managedGroups[0].id }); setIsModalOpen(true); }}>Add Item</Button>
      </div>
      <InventoryBrowser cards={mobile} mobile={mobile} actions={record => (
        <Space wrap>
          <Button type="link" onClick={() => navigate(`/items/${record.id}`)}>View</Button>
          <Button type="link" hidden={!canManage(userData, record.groupId, isOwner)} onClick={() => { setEditingItem(record); form.resetFields(); form.setFieldsValue(record); setIsModalOpen(true); }}>Edit</Button>
          <Popconfirm title="Delete item?" onConfirm={() => deleteCatalog('items', record.id)}><Button type="link" danger hidden={!canManage(userData, record.groupId, isOwner)}>Delete</Button></Popconfirm>
        </Space>
      )} />

      <Modal className={mobile ? "mobile-editor" : undefined} title={editingItem ? "Edit Item" : "Add Item"} open={isModalOpen} onCancel={() => { if (!submitting.current) setIsModalOpen(false); }} onOk={() => { if (!submitting.current) form.submit(); }} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} mask={{ closable: !saving }} width={700}>
        <Form form={form} layout="vertical" onFinish={onFinish} disabled={saving}>
          <Space align="start" size="large" wrap style={{ width: '100%' }}>
            <div>
              <Form.Item label="Product Image">
                {selectedProduct?.imageUrl
                  ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} style={{ width: 102, height: 102, objectFit: 'cover', borderRadius: 8 }} />
                  : <Typography.Text type="secondary">{selectedProduct ? 'No product image' : 'Select a product'}</Typography.Text>}
              </Form.Item>
              <Form.Item name="imageUrl" label="Additional Item Image" extra="Optional photo of this specific garment" style={{ marginBottom: 4 }}>
                <ImageUpload disabled={saving || !selectedGroup} folder={`subscriptions/${userData?.subscriptionId}/groups/${selectedGroup}/items`} />
              </Form.Item>
              {itemImage && <Button size="small" type="link" danger disabled={saving} onClick={() => form.setFieldsValue({ imageUrl: '' })}>Remove item image</Button>}
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <Form.Item name="groupId" label="Group" rules={[{ required: true }]}>
                <Select placeholder="Select Group" onChange={() => form.setFieldsValue({ productId: undefined, imageUrl: undefined })} disabled={!!editingItem?.groupId}>
                  {managedGroups.map(g => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" disabled={!selectedGroup} placeholder={selectedGroup ? 'Select Product' : 'Select a group first'} notFoundContent="No products in this group. Add a product first."
                  onChange={(id: string) => { const gender = products.find(p => p.id === id)?.gender; if (gender) form.setFieldsValue({ gender }); }}
                  options={products.filter(p => p.groupId === selectedGroup).map(p => ({ value: p.id, label: `${p.name} (${p.gender})` }))} />
              </Form.Item>
              <Space wrap>
                <Form.Item name="size" label="Size" rules={[{ required: true }]}><SizeInput sizes={categories.find(c => c.id === selectedProduct?.categoryId)?.sizes} style={{ width: 200 }} /></Form.Item>
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
            </div>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default ItemsPage;
