import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Typography, message } from 'antd';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import type { TransferRequest } from '../types/models';

const { Title } = Typography;

const RequestInbox: React.FC = () => {
  const { user, userData } = useAuth();
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    // Admin sees all pending; user sees requests where they are the current holder
    const isAdmin = Object.values(userData.groups || {}).some(r => r === 'admin' || r === 'superadmin');

    const q = isAdmin
      ? query(collection(db, 'requests'), where('subscriptionId', '==', userData.subscriptionId), where('status', '==', 'pending'))
      : query(collection(db, 'requests'), where('currentHolderId', '==', user?.uid), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferRequest)));
    });

    return () => unsubscribe();
  }, [user, userData]);

  const handleAction = async (requestId: string, itemId: string, requesterId: string, action: 'approved' | 'declined') => {
    setLoading(true);
    try {
      if (action === 'approved') {
        const transferItemFn = httpsCallable(functions, 'transferItem');
        await transferItemFn({
          itemId,
          newHolderId: requesterId,
          transferType: 'request',
          requestId // Pass requestId to handle status update in Cloud Function
        });
        message.success('Item transferred!');
      } else {
        await updateDoc(doc(db, 'requests', requestId), {
          status: 'declined',
          declinedAt: serverTimestamp()
        });
        message.success('Request declined');
      }
    } catch (error) {
      console.error(error);
      message.error('Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Requested At', dataIndex: 'requestedAt', render: (d: TransferRequest['requestedAt']) => d?.toDate()?.toLocaleString() },
    { title: 'Item ID', dataIndex: 'itemId' },
    { title: 'Requester', dataIndex: 'requestedByUserId' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: string) => <Tag color="gold">{s.toUpperCase()}</Tag>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: TransferRequest) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            onClick={() => handleAction(record.id, record.itemId, record.requestedByUserId, 'approved')}
            loading={loading}
          >
            Approve & Transfer
          </Button>
          <Button 
            danger 
            size="small" 
            onClick={() => handleAction(record.id, record.itemId, record.requestedByUserId, 'declined')}
            loading={loading}
          >
            Decline
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>Pending Requests</Title>
        <Table dataSource={requests} columns={columns} rowKey="id" />
      </Card>
    </div>
  );
};

export default RequestInbox;