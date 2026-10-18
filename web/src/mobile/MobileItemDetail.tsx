import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Avatar, Button, Drawer, Empty, Form, Input, message, Popconfirm, Select, Tabs, Tag } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { canManage, canReceiveOffer } from '../auth/permissions';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { call, saveCatalog } from '../lib/api';
import type { Category, Product, UserProfile } from '../types/models';
import { GarmentImage, MobileLoadState } from './components';
import { useItemActivity } from './useItemActivity';

export default function MobileItemDetail() {
  const { id } = useParams();
  const { user, userData, isOwner, subscriptionOwnerId } = useAuth();
  const activity = useItemActivity(id);
  const products = useTenantCollection<Product>('products');
  const categories = useTenantCollection<Category>('categories');
  const members = useTenantCollection<UserProfile>('users');
  const [busy, setBusy] = useState<string>();
  const [offer, setOffer] = useState(false);
  const [manage, setManage] = useState(false);
  const [target, setTarget] = useState<string>();
  const [comment, setComment] = useState('');
  const [holder, setHolder] = useState<string>();
  const [owner, setOwner] = useState<string>();
  const item = activity.item;
  const product = products.rows.find(p => p.id === item?.productId);
  const category = categories.rows.find(c => c.id === product?.categoryId);
  const isAdmin = !!item && canManage(userData, item.groupId, isOwner);
  const groupMember = !!item && (isOwner || ['user', 'admin', 'superadmin'].includes(userData?.groups?.[item.groupId] || ''));
  const isHolder = item?.holderId === user?.uid;
  const canOffer = groupMember && (isHolder || item?.ownerId === user?.uid);
  const name = (uid?: string | null) => !uid ? 'Unassigned' : uid === 'storage' ? 'Storage' : members.rows.find(m => m.id === uid)?.name || 'Member';
  const options = members.rows.map(m => ({ value: m.id, label: m.name || m.email || 'Member' }));
  const recipientOptions = members.rows.filter(m => m.id !== user?.uid && !!item && canReceiveOffer(m, item.groupId, subscriptionOwnerId)).map(m => ({ value: m.id, label: m.name || m.email || 'Member' }));
  const perform = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await fn(); message.success(success); return true; }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not complete action'); return false; }
    finally { setBusy(undefined); }
  };
  return <MobileLoadState loading={activity.loading || products.loading || members.loading} error={activity.error || products.error || members.error || categories.error} empty={!item}>
    {item && <section className="mobile-stack mobile-with-actions">
      <GarmentImage src={product?.imageUrl || item.imageUrl} name={product?.name || 'Garment'} large />
      {product?.imageUrl && item.imageUrl && <div className="mobile-card mobile-stack"><h3>Item photo</h3><GarmentImage src={item.imageUrl} name={`${product.name} item photo`} large /></div>}
      <div className="mobile-card mobile-stack"><h2>{product?.name || 'Garment'}</h2><div className="mobile-tags"><Tag>{item.size || 'No size'}</Tag><Tag>{item.gender}</Tag><Tag color={item.condition === 'damaged' ? 'red' : 'default'}>{item.condition}</Tag></div><p>{item.description || 'No description provided.'}</p>
        <dl className="mobile-properties"><dt>Category</dt><dd>{category?.name || 'Unknown'}</dd><dt>Holder</dt><dd>{name(item.holderId)}</dd><dt>Owner</dt><dd>{name(item.ownerId)}</dd><dt>NFC tag</dt><dd>{item.rfidTag || 'Not assigned'}</dd></dl>
        {canOffer && <Button block disabled={!!busy} onClick={() => { setTarget(undefined); setOffer(true); }}>Offer to another member</Button>}
        {isAdmin && <Button block onClick={() => { setHolder(item.holderId); setOwner(item.ownerId || undefined); setManage(true); }}>Manage owner and holder</Button>}
      </div>
      <div className="mobile-card"><Tabs items={[
        { key: 'comments', label: `Comments (${activity.comments.length})`, children: <div className="mobile-stack">
          {activity.commentsError && <Alert type="error" title={activity.commentsError} />}
          {groupMember && <><Input.TextArea aria-label="New comment" placeholder="Add a comment" maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} /><Button block type="primary" loading={busy === 'comment'} disabled={!comment.trim() || !!busy} onClick={async () => { if (await perform('comment', () => call('addComment', { itemId: id, text: comment }), 'Comment posted')) setComment(''); }}>Post comment</Button></>}
          {!activity.comments.length && !activity.commentsError && <Empty description="No comments yet" />}
          {activity.comments.map(c => <article className="mobile-comment" key={c.id}><div className="mobile-comment-author"><Avatar src={c.avatarUrl} /><strong>{c.userName || 'Member'}</strong><time>{c.timestamp?.toDate().toLocaleDateString()}</time></div><p>{c.text}</p></article>)}
        </div> },
        { key: 'history', label: 'Holder history', children: <div className="mobile-stack">
          {activity.historyError && <Alert type="error" title={activity.historyError} />}
          {!activity.history.length && !activity.historyError && <Empty description="No holder changes yet" />}
          {activity.history.map(h => <article className="mobile-history" key={h.id}><strong>{name(h.previousHolderId)} → {name(h.newHolderId)}</strong><p className="mobile-muted">{h.transferDate?.toDate().toLocaleString()}</p><p className="mobile-muted">By {name(h.initiatedByUserId)} · {h.transferType}</p></article>)}
        </div> },
      ]} /></div>
      {groupMember && <div className="mobile-fixed-action">
        {isHolder ? <Popconfirm title="Return this item to storage?" onConfirm={() => perform('return', () => call('transferItem', { itemId: id, newHolderId: 'storage' }), 'Returned to storage')}><Button block type="primary" loading={busy === 'return'} disabled={!!busy}>Return to storage</Button></Popconfirm> : <Button block type="primary" loading={busy === 'request'} disabled={!!busy} onClick={() => perform('request', () => call('createTransfer', { itemId: id }), 'Request sent. Track it in Transfers.')}>{item.holderId === 'storage' ? 'Request from storage' : 'Request transfer'}</Button>}
      </div>}
      <Drawer title="Offer item to a member" placement="bottom" height="70svh" open={offer} onClose={() => setOffer(false)} className="mobile-overlay">
        <div className="mobile-stack"><p>The recipient must accept before the item changes hands.</p><Select aria-label="Recipient" placeholder="Select recipient" showSearch optionFilterProp="label" options={recipientOptions} value={target} onChange={setTarget} /><Button type="primary" block disabled={!target || !!busy} loading={busy === 'offer'} onClick={async () => { if (await perform('offer', () => call('createTransfer', { itemId: id, targetUserId: target }), 'Offer sent')) setOffer(false); }}>Send offer</Button></div>
      </Drawer>
      <Drawer title="Owner and holder" placement="bottom" height="80svh" open={manage} onClose={() => setManage(false)} className="mobile-overlay">
        <Form layout="vertical">
          <Form.Item label="Owner"><Select aria-label="Owner" placeholder="Unassigned" allowClear showSearch optionFilterProp="label" options={options} value={owner} onChange={setOwner} /></Form.Item>
          <Button block disabled={!!busy || (owner || null) === (item.ownerId || null)} loading={busy === 'owner'} onClick={() => perform('owner', () => saveCatalog('items', { ownerId: owner || null }, item.id), 'Owner updated')}>Save owner</Button>
          <Form.Item label="Holder" style={{ marginTop: 24 }}><Select aria-label="Holder" showSearch optionFilterProp="label" options={[{ value: 'storage', label: 'Storage' }, ...options]} value={holder} onChange={setHolder} /></Form.Item>
          <Popconfirm title="Change holder immediately?" description="This will be recorded in holder history." onConfirm={() => perform('holder', () => call('transferItem', { itemId: id, newHolderId: holder }), 'Holder updated')}><Button block type="primary" disabled={!!busy || !holder || holder === item.holderId} loading={busy === 'holder'}>Change holder</Button></Popconfirm>
        </Form>
      </Drawer>
    </section>}
  </MobileLoadState>;
}
