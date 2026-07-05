import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Input, Tag, Empty, Badge, Space, Typography } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined } from '@ant-design/icons';
import type { AssetClass, Item, ItemType } from '../types/models';

const { Title, Text } = Typography;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [classes, setClasses] = useState<AssetClass[]>([]);
  const [filters, setFilters] = useState({ typeId: '', classId: '', size: '', search: '' });

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    const qItems = query(collection(db, 'items'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubItems = onSnapshot(qItems, (snap) => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item))));

    const qTypes = query(collection(db, 'types'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubTypes = onSnapshot(qTypes, (snap) => setTypes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemType))));

    const qClasses = query(collection(db, 'classes'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubClasses = onSnapshot(qClasses, (snap) => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as AssetClass))));

    return () => { unsubItems(); unsubTypes(); unsubClasses(); };
  }, [userData]);

  const filteredItems = items.filter(item => {
    const matchesType = !filters.typeId || item.typeId === filters.typeId;
    const type = types.find(t => t.id === item.typeId);
    const matchesClass = !filters.classId || type?.classId === filters.classId;
    const matchesSize = !filters.size || item.size?.toLowerCase().includes(filters.size.toLowerCase());
    const matchesSearch = !filters.search || type?.name?.toLowerCase().includes(filters.search.toLowerCase());
    return matchesType && matchesClass && matchesSize && matchesSearch;
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Inventory Dashboard</Title>
        <Space>
          <Input 
            placeholder="Search items..." 
            prefix={<SearchOutlined />} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
            style={{ width: 250 }}
          />
          <Select 
            placeholder="Class" 
            allowClear 
            style={{ width: 150 }}
            onChange={val => setFilters({ ...filters, classId: val })}
          >
            {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>
          <Select 
            placeholder="Type" 
            allowClear 
            style={{ width: 150 }}
            onChange={val => setFilters({ ...filters, typeId: val })}
          >
            {types.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {filteredItems.length > 0 ? filteredItems.map(item => {
          const type = types.find(t => t.id === item.typeId);
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
              <Card
                hoverable
                cover={<img alt={type?.name} src={item.imageUrl || type?.imageUrl} style={{ height: 200, objectFit: 'cover' }} />}
                onClick={() => navigate(`/items/${item.id}`)}
              >
                <Card.Meta 
                  title={type?.name || 'Unknown Item'}
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