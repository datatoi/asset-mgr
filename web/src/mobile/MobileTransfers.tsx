import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, message, Radio, Tag } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/permissions';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { call } from '../lib/api';
import type { Item, Product, TransferRequest, UserProfile } from '../types/models';
import { GarmentImage, MobileLoadState } from './components';

export default function MobileTransfers() {
  const { user, userData, isOwner } = useAuth();
  const transfers = useTenantCollection<TransferRequest>('transfers');
  const items = useTenantCollection<Item>('items');
  const products = useTenantCollection<Product>('products');
  const members = useTenantCollection<UserProfile>('users');
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState<string>();
  const admin = (r: TransferRequest) => canManage(userData, r.groupId, isOwner);
  const participant = (r: TransferRequest) => [r.requestedByUserId, r.currentHolderId, r.targetUserId].includes(user?.uid);
  const canApprove = (r: TransferRequest) => admin(r) || (r.targetUserId ? r.targetUserId === user?.uid : r.currentHolderId === user?.uid);
  const name = (id: string) => id === 'storage' ? 'Storage' : members.rows.find(m => m.id === id)?.name || 'Member';
  const visible = transfers.rows.filter(r => admin(r) || participant(r)).sort((a, b) => (b.requestedAt?.toMillis() || 0) - (a.requestedAt?.toMillis() || 0));
  const pendingCount = visible.filter(r => r.status === 'pending' && canApprove(r)).length;
  const rows = visible.filter(r => tab === 'pending' ? r.status === 'pending' && canApprove(r) : tab === 'outgoing' ? r.requestedByUserId === user?.uid : r.status !== 'pending');
  const action = async (r: TransferRequest, approve: boolean) => {
    setBusy(r.id);
    try { await call(approve ? 'transferItem' : 'declineTransfer', approve ? { itemId: r.itemId, transferId: r.id } : { transferId: r.id }); message.success(approve ? 'Item transferred' : 'Request closed'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not process request'); }
    finally { setBusy(undefined); }
  };
  return <section className="mobile-stack">
    <Radio.Group className="mobile-segments" value={tab} onChange={e => setTab(e.target.value)} optionType="button" buttonStyle="solid" options={[{ label: `Pending${pendingCount ? ` (${pendingCount})` : ''}`, value: 'pending' }, { label: 'Outgoing', value: 'outgoing' }, { label: 'History', value: 'history' }]} />
    <MobileLoadState loading={transfers.loading || items.loading || products.loading || members.loading} error={transfers.error || items.error || products.error || members.error} empty={!rows.length} emptyText={tab === 'pending' ? 'No requests need your approval.' : 'No transfers here yet.'}>
      {rows.map(r => { const item = items.rows.find(i => i.id === r.itemId); const product = products.rows.find(p => p.id === item?.productId); return <article className="mobile-card mobile-stack" key={r.id}>
        <Link className="mobile-transfer-item" to={`/items/${r.itemId}`}><GarmentImage src={item?.imageUrl || product?.imageUrl} name={product?.name || 'Item'} /><div><h2>{product?.name || 'Item details'}</h2><p>{item?.size}</p></div></Link>
        <div className="mobile-transfer-people"><span>From <strong>{name(r.currentHolderId)}</strong></span><span>To <strong>{name(r.targetUserId || r.requestedByUserId)}</strong></span></div>
        <p className="mobile-muted">Requested by {name(r.requestedByUserId)} · {r.requestedAt?.toDate().toLocaleDateString()}</p>
        <div><Tag color={r.status === 'transferred' ? 'green' : r.status === 'pending' ? 'blue' : 'default'}>{r.status}</Tag>{r.declineReason === 'holder-changed' && <span>Item assigned elsewhere</span>}</div>
        {r.status === 'pending' && <>
          {r.schemaVersion !== 2 && <p className="mobile-muted">Old request: cancel and create it again.</p>}
          <div className="mobile-actions">
            {canApprove(r) && r.schemaVersion === 2 && <Button type="primary" block loading={busy === r.id} disabled={!!busy} onClick={() => action(r, true)}>{r.targetUserId ? 'Accept transfer' : 'Approve transfer'}</Button>}
            {(admin(r) || participant(r)) && <Button block danger loading={busy === r.id} disabled={!!busy} onClick={() => action(r, false)}>{r.requestedByUserId === user?.uid ? 'Cancel request' : 'Decline'}</Button>}
          </div>
        </>}
      </article>; })}
    </MobileLoadState>
  </section>;
}
