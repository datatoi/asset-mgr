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

    // Admin sees all pending. A regular user sees requests where they need to
    // act: either they're the current holder being asked to release the item
    // (the "pull" flow), or they're the named recipient of a holder/owner-
    // initiated "push" transfer offer (ItemDetail's "Transfer to..." control).
    const isAdmin = Object.values(userData.groups || {}).some(r => r === 'admin' || r === 'superadmin');

    if (isAdmin) {
      const q = query(collection(db, 'requests'), where('subscriptionId', '==', userData.subscriptionId), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferRequest)));
      });
      return () => unsubscribe();
    }

    const asHolder = new Map<string, TransferRequest>();
    const asTarget = new Map<string, TransferRequest>();
    const merge = () => setRequests([...asHolder.values(), ...asTarget.values()].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i));

    const qHolder = query(collection(db, 'requests'), where('currentHolderId', '==', user?.uid), where('status', '==', 'pending'));
    const unsubHolder = onSnapshot(qHolder, (snap) => {
      asHolder.clear();
      snap.docs.forEach(d => asHolder.set(d.id, { id: d.id, ...d.data() } as TransferRequest));
      merge();
    });

    const qTarget = query(collection(db, 'requests'), where('targetUserId', '==', user?.uid), where('status', '==', 'pending'));
    const unsubTarget = onSnapshot(qTarget, (snap) => {
      asTarget.clear();
      snap.docs.forEach(d => asTarget.set(d.id, { id: d.id, ...d.data() } as TransferRequest));
      merge();
    });

    return () => { unsubHolder(); unsubTarget(); };
  }, [user, userData]);

  const handleAction = async (record: TransferRequest, action: 'approved' | 'declined') => {
    setLoading(true);
    try {
      if (action === 'approved') {
        const transferItemFn = httpsCallable(functions, 'transferItem');
        await transferItemFn({
          itemId: record.itemId,
          newHolderId: record.targetUserId || record.requestedByUserId,
          transferType: 'request',
          requestId: record.id // Pass requestId to handle status update in Cloud Function
        });
        message.success('Item transferred!');
      } else {
        await updateDoc(doc(db, 'requests', record.id), {
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
    {
      title: 'Type',
      key: 'type',
      render: (_: unknown, record: TransferRequest) => record.targetUserId
        ? <Tag color="blue">Offered to you</Tag>
        : <Tag color="purple">Requested from you</Tag>
    },
    { title: 'Initiated By', dataIndex: 'requestedByUserId' },
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
            onClick={() => handleAction(record, 'approved')}
            loading={loading}
          >
            {record.targetUserId ? 'Accept & Transfer' : 'Approve & Transfer'}
          </Button>
          <Button
            danger
            size="small"
            onClick={() => handleAction(record, 'declined')}
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