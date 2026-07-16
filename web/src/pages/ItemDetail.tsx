import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { Tabs, Descriptions, Tag, List, Input, Button, Avatar, Typography, Card, Table, Row, Col, message, Select, Space } from 'antd';
import { useAuth } from '../auth/AuthContext';
import type { HolderHistoryEntry, Item, ItemComment, UserProfile } from '../types/models';

const { Title, Text } = Typography;

const ItemDetail: React.FC = () => {
  const { id } = useParams();
  const { user, userData } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [history, setHistory] = useState<HolderHistoryEntry[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [newComment, setNewComment] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [changingHolder, setChangingHolder] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | undefined>();
  const [sendingTransfer, setSendingTransfer] = useState(false);

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');
  const isHolderOrOwner = item?.holderId === user?.uid || item?.ownerId === user?.uid;

  useEffect(() => {
    if (!id) return;
    const unsubItem = onSnapshot(doc(db, 'items', id), (snap) => setItem({ id: snap.id, ...snap.data() } as Item));

    const qComments = query(collection(db, 'items', id, 'comments'), orderBy('timestamp', 'desc'));
    const unsubComments = onSnapshot(qComments, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemComment))));

    const qHistory = query(collection(db, 'items', id, 'holderHistory'), orderBy('transferDate', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HolderHistoryEntry))));

    return () => { unsubItem(); unsubComments(); unsubHistory(); };
  }, [id]);

  useEffect(() => {
    if ((!isAdmin && !isHolderOrOwner) || !userData?.subscriptionId) return;
    const q = query(collection(db, 'users'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, [isAdmin, isHolderOrOwner, userData?.subscriptionId]);

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

  const handleInitiateTransfer = async () => {
    if (!id || !user || !userData || !item || !transferTarget) return;
    setSendingTransfer(true);
    try {
      await addDoc(collection(db, 'requests'), {
        subscriptionId: userData.subscriptionId,
        groupId: item.groupId,
        itemId: id,
        requestedByUserId: user.uid,
        currentHolderId: item.holderId,
        targetUserId: transferTarget,
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      message.success('Transfer offer sent - awaiting their acceptance');
      setTransferTarget(undefined);
    } catch (err) {
      message.error('Failed to send transfer offer: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSendingTransfer(false);
    }
  };

  const handleChangeHolder = async (newHolderId: string) => {
    if (!id) return;
    setChangingHolder(true);
    try {
      const transferItemFn = httpsCallable(functions, 'transferItem');
      await transferItemFn({ itemId: id, newHolderId, transferType: 'admin' });
      message.success('Holder updated');
    } catch (err) {
      message.error('Failed to update holder: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setChangingHolder(false);
    }
  };

  const handleChangeOwner = async (newOwnerId: string | null) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'items', id), { ownerId: newOwnerId });
      message.success('Owner updated');
    } catch (err) {
      message.error('Failed to update owner: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!item) return null;

  const memberName = (uid?: string) => uid ? (members.find(m => m.id === uid)?.name || uid) : 'Unassigned';

  const historyColumns = [
    { title: 'Date', dataIndex: 'transferDate', render: (d: HolderHistoryEntry['transferDate']) => d?.toDate().toLocaleString() },
    { title: 'From', dataIndex: 'previousHolderId', render: (uid: string) => uid === 'storage' ? 'Storage' : memberName(uid) },
    { title: 'To', dataIndex: 'newHolderId', render: (uid: string) => uid === 'storage' ? 'Storage' : memberName(uid) },
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Title level={2} style={{ margin: 0 }}>Item Details</Title>
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
              {!isAdmin && isHolderOrOwner && (
                <Space wrap>
                  <Select
                    placeholder="Transfer to..."
                    style={{ width: 200, maxWidth: '100%' }}
                    value={transferTarget}
                    onChange={setTransferTarget}
                    showSearch
                    optionFilterProp="children"
                  >
                    {members.filter(m => m.id !== user?.uid).map(m => (
                      <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>
                    ))}
                  </Select>
                  <Button
                    type="primary"
                    disabled={!transferTarget}
                    loading={sendingTransfer}
                    onClick={handleInitiateTransfer}
                  >
                    Send Transfer Offer
                  </Button>
                </Space>
              )}
            </div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="RFID Tag">{item.rfidTag || 'None'}</Descriptions.Item>
              <Descriptions.Item label="Size">{item.size}</Descriptions.Item>
              <Descriptions.Item label="Condition"><Tag color="orange">{item.condition?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Description">{item.description || 'None'}</Descriptions.Item>
              <Descriptions.Item label="Current Holder">
                {isAdmin ? (
                  <Select
                    value={item.holderId}
                    style={{ width: 240, maxWidth: '100%' }}
                    loading={changingHolder}
                    onChange={handleChangeHolder}
                  >
                    <Select.Option value="storage">Storage (Available)</Select.Option>
                    {members.map(m => <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>)}
                  </Select>
                ) : (
                  <Text strong>{item.holderId === 'storage' ? 'STORAGE' : memberName(item.holderId)}</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Owner">
                {isAdmin ? (
                  <Select
                    value={item.ownerId}
                    placeholder="Unassigned"
                    allowClear
                    style={{ width: 240, maxWidth: '100%' }}
                    onChange={(value) => handleChangeOwner(value ?? null)}
                  >
                    {members.map(m => <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>)}
                  </Select>
                ) : (
                  <Text strong>{memberName(item.ownerId)}</Text>
                )}
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
                  children: <Table dataSource={history} columns={historyColumns} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />,
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
