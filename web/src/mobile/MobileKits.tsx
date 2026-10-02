import { useState } from 'react';
import { Input, Tag } from 'antd';
import { useTenantCollection } from '../hooks/useTenantCollection';
import type { Group, Kit, Product } from '../types/models';
import { MobileLoadState } from './components';

export default function MobileKits() {
  const kits = useTenantCollection<Kit>('kits');
  const products = useTenantCollection<Product>('products');
  const groups = useTenantCollection<Group>('groups');
  const [search, setSearch] = useState('');
  const rows = kits.rows.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));
  return <section className="mobile-stack">
    <Input aria-label="Search kits" placeholder="Search kits" value={search} onChange={e => setSearch(e.target.value)} allowClear />
    <p className="mobile-muted">Kits describe outfits. Browse inventory to request specific garments.</p>
    <MobileLoadState loading={kits.loading || products.loading} error={kits.error || products.error || groups.error} empty={!rows.length} emptyText="No matching kits.">
      {rows.map(kit => { return <article key={kit.id} className="mobile-card mobile-stack">
        <div><h2>{kit.name}</h2><p className="mobile-muted">{groups.rows.find(g => g.id === kit.groupId)?.name || 'Group'} · {kit.gender}</p></div>
        {kit.description && <p>{kit.description}</p>}
        <div className="mobile-tags">{kit.productIds.map(id => <Tag key={id}>{products.rows.find(p => p.id === id)?.name || 'Unknown product'}</Tag>)}</div>
      </article>; })}
    </MobileLoadState>
  </section>;
}
