import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Typography, message, Tabs, Alert } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { call } from '../lib/api';
import { canManage } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import type { TransferRequest, UserProfile } from '../types/models';

const TransferInbox: React.FC = () => {
  const { user, userData, isOwner } = useAuth();
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setTransfers([]);
    setError(undefined);
    if (!userData?.subscriptionId) return;
    const q = query(collection(db, 'transfers'), where('subscriptionId', '==', userData.subscriptionId));
    const stop = onSnapshot(q, snap => {
      setTransfers(snap.docs.map(d => ({ ...d.data(), id: d.id } as TransferRequest)));
    }, e => setError(e.message));
    const stopMembers = onSnapshot(query(collection(db, 'users'), where('subscriptionId', '==', userData.subscriptionId)), snap => {
      setMembers(snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile)));
    }, e => setError(e.message));
    return () => { stop(); stopMembers(); };
  }, [userData?.subscriptionId]);

  const admin = (r: TransferRequest) => canManage(userData, r.groupId, isOwner);
  const participant = (r: TransferRequest) => [r.requestedByUserId, r.currentHolderId, r.targetUserId].includes(user?.uid);
  const canApprove = (r: TransferRequest) => admin(r) || (r.targetUserId ? r.targetUserId === user?.uid : r.currentHolderId === user?.uid);
  const canDecline = (r: TransferRequest) => admin(r) || participant(r);
  const name = (uid: string) => uid === 'storage' ? 'Storage' : members.find(m => m.id === uid)?.name || uid;

  const action = async (r: TransferRequest, approve: boolean) => {
    setBusy(r.id);
    try {
      await call(approve ? 'transferItem' : 'declineTransfer', approve ? { itemId: r.itemId, transferId: r.id } : { transferId: r.id });
      message.success(approve ? 'Item transferred' : 'Request closed');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Could not process request');
    } finally { setBusy(undefined); }
  };
  const columns = [
    { title: 'Requested', dataIndex: 'requestedAt', render: (d: TransferRequest['requestedAt']) => d?.toDate()?.toLocaleString() },
    { title: 'Item', dataIndex: 'itemId', render: (id: string) => <a href={`/items/${id}`}>{id}</a> },
    { title: 'Initiated by', dataIndex: 'requestedByUserId', render: name },
    { title: 'Recipient', render: (_: unknown, r: TransferRequest) => name(r.targetUserId || r.requestedByUserId) },
    { title: 'Status', render: (_: unknown, r: TransferRequest) => <Space><Tag>{r.status}</Tag>{r.declineReason === 'holder-changed' && 'Item assigned elsewhere'}</Space> },
    { title: 'Action', render: (_: unknown, r: TransferRequest) => r.status === 'pending' && (
      <Space wrap>
        {r.schemaVersion !== 2 && <span>Old request: cancel and create it again</span>}
        {canApprove(r) && r.schemaVersion === 2 && <Button type="primary" loading={busy === r.id} onClick={() => action(r, true)}>{r.targetUserId ? 'Accept & Transfer' : 'Approve & Transfer'}</Button>}
        {canDecline(r) && <Button danger loading={busy === r.id} onClick={() => action(r, false)}>{r.requestedByUserId === user?.uid ? 'Cancel' : 'Decline'}</Button>}
      </Space>
    ) },
  ];
  const visible = transfers.filter(r => admin(r) || participant(r)).sort((a, b) => (b.requestedAt?.toMillis() || 0) - (a.requestedAt?.toMillis() || 0));
  const table = (rows: TransferRequest[]) => <Table dataSource={rows} columns={columns} rowKey="id" scroll={{ x: 'max-content' }} />;
  return <div style={{ padding: 24 }}><Card>
    <Typography.Title level={2}>Transfers</Typography.Title>
    {error && <Alert type="error" showIcon title={error} />}
    <Tabs items={[
      { key: 'pending', label: 'Pending', children: table(visible.filter(r => r.status === 'pending' && canApprove(r))) },
      { key: 'outgoing', label: 'My requests and offers', children: table(visible.filter(r => r.requestedByUserId === user?.uid)) },
      { key: 'history', label: 'History', children: table(visible.filter(r => r.status !== 'pending')) },
    ]} />
  </Card></div>;
};
export default TransferInbox;
