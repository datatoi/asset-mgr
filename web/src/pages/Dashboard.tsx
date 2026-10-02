import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Input, Tag, Empty, Badge, Space, Typography, Button, message } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import type { Category, Group, Item, Product, UserProfile } from '../types/models';

const { Title, Text } = Typography;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const { user, userData, isOwner } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  // Defaults to showing the signed-in user's own items ("what do I have?")
  // rather than the whole inventory; clear the Holder filter to see everyone's.
  const [filters, setFilters] = useState({ groupId: '', productId: '', categoryId: '', size: '', search: '', holderId: user?.uid || '', ownerId: '' });

  const memberName = (uid?: string) => {
    if (!uid) return '';
    if (uid === 'storage') return 'Storage';
    return members.find(m => m.id === uid)?.name || '';
  };

  const isAdmin = isOwner || Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');
  const inviteLink = userData?.subscriptionId
    ? `${window.location.origin}/join/${userData.subscriptionId}`
    : '';

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      message.success('Invite link copied to clipboard');
    } catch {
      message.error('Could not copy automatically — copy it manually instead');
    }
  };

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qItems = query(collection(db, 'items'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubItems = onSnapshot(qItems, (snap) => setItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as Item))));

    const qProducts = query(collection(db, 'products'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubProducts = onSnapshot(qProducts, (snap) => setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Product))));

    const qCategories = query(collection(db, 'categories'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubCategories = onSnapshot(qCategories, (snap) => setCategories(snap.docs.map(d => ({ ...d.data(), id: d.id } as Category))));

    const qMembers = query(collection(db, 'users'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubMembers = onSnapshot(qMembers, (snap) => setMembers(snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile))));

    const unsubGroups = onSnapshot(query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId)), snap => setGroups(snap.docs.map(d => ({ ...d.data(), id: d.id } as Group))));
    return () => { unsubGroups(); unsubItems(); unsubProducts(); unsubCategories(); unsubMembers(); };
  }, [userData]);

  const productsInSelectedCategory = filters.categoryId
    ? products.filter(p => p.categoryId === filters.categoryId)
    : products;

  const handleCategoryChange = (categoryId: string | undefined) => {
    const newCategoryId = categoryId || '';
    const selectedProduct = products.find(p => p.id === filters.productId);
    const productStillValid = !newCategoryId || selectedProduct?.categoryId === newCategoryId;
    setFilters({
      ...filters,
      categoryId: newCategoryId,
      productId: productStillValid ? filters.productId : '',
    });
  };

  const filteredItems = items.filter(item => {
    const matchesProduct = !filters.productId || item.productId === filters.productId;
    const product = products.find(p => p.id === item.productId);
    const matchesCategory = !filters.categoryId || product?.categoryId === filters.categoryId;
    const matchesSize = !filters.size || item.size?.toLowerCase().includes(filters.size.toLowerCase());
    const matchesHolder = !filters.holderId || item.holderId === filters.holderId;
    const matchesOwner = !filters.ownerId || item.ownerId === filters.ownerId;
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || product?.name?.toLowerCase().includes(search);
    return (!filters.groupId || item.groupId === filters.groupId) && matchesProduct && matchesCategory && matchesSize && matchesHolder && matchesOwner && matchesSearch;
  });

  return (
    <div style={{ padding: 24 }}>
      {isAdmin && (
        <Card size="small" style={{ marginBottom: 24 }}>
          <Space wrap>
            <LinkOutlined />
            <Text strong>Invite link:</Text>
            <Text code copyable={false} style={{ maxWidth: '60vw' }} ellipsis>{inviteLink}</Text>
            <Button size="small" icon={<CopyOutlined />} onClick={handleCopyInvite}>Copy</Button>
            <Text type="secondary">New members joining via this link get the "joiner" role (profile-only access) — grant them a real role from Members.</Text>
          </Space>
        </Card>
      )}
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>Inventory Dashboard</Title>
        <Space wrap>
          <Select placeholder="Group" allowClear style={{ width: 160 }} value={filters.groupId || undefined} onChange={val => setFilters({ ...filters, groupId: val || '' })}>
            {groups.map(g => <Option key={g.id} value={g.id}>{g.name}</Option>)}
          </Select>
          <Input
            placeholder="Search by product..."
            prefix={<SearchOutlined />}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Category"
            allowClear
            value={filters.categoryId || undefined}
            style={{ width: 140 }}
            onChange={handleCategoryChange}
          >
            {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select
            placeholder="Product"
            allowClear
            value={filters.productId || undefined}
            style={{ width: 140 }}
            onChange={val => setFilters({ ...filters, productId: val || '' })}
          >
            {productsInSelectedCategory.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
          </Select>
          <Select
            placeholder="Holder"
            allowClear
            showSearch
            optionFilterProp="children"
            value={filters.holderId || undefined}
            style={{ width: 160 }}
            onChange={val => setFilters({ ...filters, holderId: val || '' })}
          >
            <Option value="storage">Storage (Available)</Option>
            {members.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
          </Select>
          <Select
            placeholder="Owner"
            allowClear
            showSearch
            optionFilterProp="children"
            value={filters.ownerId || undefined}
            style={{ width: 160 }}
            onChange={val => setFilters({ ...filters, ownerId: val || '' })}
          >
            {members.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {filteredItems.length > 0 ? filteredItems.map(item => {
          const product = products.find(p => p.id === item.productId);
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
              <Card
                hoverable
                cover={<img alt={product?.name} src={item.imageUrl || product?.imageUrl} style={{ height: 200, objectFit: 'cover' }} />}
                onClick={() => navigate(`/items/${item.id}`)}
              >
                <Card.Meta
                  title={product?.name || 'Unknown Item'}
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space split={<Text type="secondary">|</Text>}>
                        <Text strong>{item.size}</Text>
                        <Tag color={item.gender === 'male' ? 'blue' : 'magenta'}>{item.gender?.toUpperCase()}</Tag>
                      </Space>
                      <Badge status={item.holderId === 'storage' ? 'success' : 'processing'} text={item.holderId === 'storage' ? 'In Storage' : `With ${memberName(item.holderId) || 'User'}`} />
                    </Space>
                  }
                />
              </Card>
            </Col>
          );
        }) : <Col span={24}><Empty description="No items found matching filters" /></Col>}
      </Row>
    </div>
  );
};

export default Dashboard;
