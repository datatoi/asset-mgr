import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tabs, Descriptions, Tag, List, Input, Button, Avatar, Typography, Card, Table, Row, Col, message } from 'antd';
import { useAuth } from '../auth/AuthContext';
import type { HolderHistoryEntry, Item, ItemComment } from '../types/models';

const { Title, Text } = Typography;

const ItemDetail: React.FC = () => {
  const { id } = useParams();
  const { user, userData } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [history, setHistory] = useState<HolderHistoryEntry[]>([]);
  const [newComment, setNewComment] = useState('');
  const [requesting, setRequesting] = useState(false);

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!id) return;
    const unsubItem = onSnapshot(doc(db, 'items', id), (snap) => setItem({ id: snap.id, ...snap.data() } as Item));

    const qComments = query(collection(db, 'items', id, 'comments'), orderBy('timestamp', 'desc'));
    const unsubComments = onSnapshot(qComments, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemComment))));

    const qHistory = query(collection(db, 'items', id, 'holderHistory'), orderBy('transferDate', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HolderHistoryEntry))));

    return () => { unsubItem(); unsubComments(); unsubHistory(); };
  }, [id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !id || !user) return;
    await addDoc(collection(db, 'items', id, 'comments'), {
      userId: user.uid,
      userName: user.displayName,
      avatarUrl: user.photoURL,
      text: newComment,
      timestamp: serverTimestamp(),
    });
    setNewComment('');
  };

  const handleRequest = async () => {
    if (!id || !user || !userData || !item) return;
    setRequesting(true);
    try {
      await addDoc(collection(db, 'requests'), {
        subscriptionId: userData.subscriptionId,
        groupId: item.groupId,
        itemId: id,
        requestedByUserId: user.uid,
        currentHolderId: item.holderId,
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      message.success('Request sent successfully');
    } catch (err) {
      message.error('Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  if (!item) return null;

  const historyColumns = [
    { title: 'Date', dataIndex: 'transferDate', render: (d: HolderHistoryEntry['transferDate']) => d?.toDate().toLocaleString() },
    { title: 'From', dataIndex: 'previousHolderId' },
    { title: 'To', dataIndex: 'newHolderId' },
    { title: 'Type', dataIndex: 'transferType', render: (t: string) => <Tag>{t.toUpperCase()}</Tag> }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={24}>
          <Col md={8}>
            <img src={item.imageUrl} alt="item" style={{ width: '100%', borderRadius: 8 }} />
          </Col>
          <Col md={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Title level={2}>Item Details</Title>
              {!isAdmin && item.holderId !== user?.uid && (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleRequest}
                  loading={requesting}
                  disabled={item.holderId === user?.uid}
                >
                  {item.holderId === 'storage' ? 'Request from Storage' : 'Request Transfer'}
                </Button>
              )}
            </div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="RFID Tag">{item.rfidTag || 'None'}</Descriptions.Item>
              <Descriptions.Item label="Size">{item.size}</Descriptions.Item>
              <Descriptions.Item label="Condition"><Tag color="orange">{item.condition?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Current Holder">
                <Text strong>{item.holderId === 'storage' ? 'STORAGE' : item.holderId}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              defaultActiveKey="1"
              style={{ marginTop: 24 }}
              items={[
                {
                  key: '1',
                  label: 'Comments',
                  children: (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <Input.TextArea
                          rows={3}
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Add a comment about this item..."
                        />
                        <Button type="primary" onClick={handleAddComment} style={{ marginTop: 8 }}>Post Comment</Button>
                      </div>
                      <List
                        dataSource={comments}
                        renderItem={comment => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar src={comment.avatarUrl} />}
                              title={comment.userName}
                              description={comment.text}
                            />
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {comment.timestamp?.toDate().toLocaleDateString()}
                            </Text>
                          </List.Item>
                        )}
                      />
                    </>
                  ),
                },
                {
                  key: '2',
                  label: 'History',
                  children: <Table dataSource={history} columns={historyColumns} rowKey="id" pagination={false} />,
                },
              ]}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ItemDetail;
