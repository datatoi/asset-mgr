import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Input, Tag, Empty, Badge, Space, Typography, Button, message } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import type { Category, Item, Product } from '../types/models';

const { Title, Text } = Typography;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState({ productId: '', categoryId: '', size: '', search: '' });

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');
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
    const unsubItems = onSnapshot(qItems, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item))));

    const qProducts = query(collection(db, 'products'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubProducts = onSnapshot(qProducts, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))));

    const qCategories = query(collection(db, 'categories'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubCategories = onSnapshot(qCategories, (snap) => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))));

    return () => { unsubItems(); unsubProducts(); unsubCategories(); };
  }, [userData]);

  const filteredItems = items.filter(item => {
    const matchesProduct = !filters.productId || item.productId === filters.productId;
    const product = products.find(p => p.id === item.productId);
    const matchesCategory = !filters.categoryId || product?.categoryId === filters.categoryId;
    const matchesSize = !filters.size || item.size?.toLowerCase().includes(filters.size.toLowerCase());
    const matchesSearch = !filters.search || product?.name?.toLowerCase().includes(filters.search.toLowerCase());
    return matchesProduct && matchesCategory && matchesSize && matchesSearch;
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
            <Text type="secondary">New members joining via this link get the "user" role — promote them from Members.</Text>
          </Space>
        </Card>
      )}
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>Inventory Dashboard</Title>
        <Space wrap>
          <Input
            placeholder="Search items..."
            prefix={<SearchOutlined />}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Category"
            allowClear
            style={{ width: 140 }}
            onChange={val => setFilters({ ...filters, categoryId: val })}
          >
            {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select
            placeholder="Product"
            allowClear
            style={{ width: 140 }}
            onChange={val => setFilters({ ...filters, productId: val })}
          >
            {products.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
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
                      <Badge status={item.holderId === 'storage' ? 'success' : 'processing'} text={item.holderId === 'storage' ? 'In Storage' : 'With User'} />
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
