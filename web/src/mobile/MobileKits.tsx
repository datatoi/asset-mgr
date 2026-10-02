import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, message, Tag } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { call } from '../lib/api';
import type { Group, Kit, Product } from '../types/models';
import { MobileLoadState } from './components';

export default function MobileKits() {
  const { userData, isOwner } = useAuth();
  const kits = useTenantCollection<Kit>('kits');
  const products = useTenantCollection<Product>('products');
  const groups = useTenantCollection<Group>('groups');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string>();
  const rows = kits.rows.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));
  const request = async (kitId: string) => {
    setBusy(kitId);
    try { await call('requestKit', { kitId }); message.success('Kit requested. Follow its item requests in Transfers.'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not request kit'); }
    finally { setBusy(undefined); }
  };
  return <section className="mobile-stack">
    <Input aria-label="Search kits" placeholder="Search kits" value={search} onChange={e => setSearch(e.target.value)} allowClear />
    <p className="mobile-muted">Kits use your profile sizes. <Link to="/profile">Update sizes</Link></p>
    <MobileLoadState loading={kits.loading || products.loading} error={kits.error || products.error || groups.error} empty={!rows.length} emptyText="No matching kits.">
      {rows.map(kit => { const member = isOwner || ['user', 'admin', 'superadmin'].includes(userData?.groups?.[kit.groupId] || ''); return <article key={kit.id} className="mobile-card mobile-stack">
        <div><h2>{kit.name}</h2><p className="mobile-muted">{groups.rows.find(g => g.id === kit.groupId)?.name || 'Group'} · {kit.gender}</p></div>
        {kit.description && <p>{kit.description}</p>}
        <div className="mobile-tags">{kit.productIds.map(id => <Tag key={id}>{products.rows.find(p => p.id === id)?.name || 'Unknown product'}</Tag>)}</div>
        <Button type="primary" block loading={busy === kit.id} disabled={!!busy || !member} onClick={() => request(kit.id)}>Request kit</Button>
        {!member && <p className="mobile-muted">Ask a group administrator for access to request this kit.</p>}
      </article>; })}
    </MobileLoadState>
  </section>;
}
