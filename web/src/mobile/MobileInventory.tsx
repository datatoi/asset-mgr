import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Drawer, Form, Input, Radio, Select, Tag } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { useTenantCollection } from '../hooks/useTenantCollection';
import type { Category, Group, Item, Product, UserProfile } from '../types/models';
import { GarmentImage, MobileLoadState } from './components';

export default function MobileInventory({ browse = false }: { browse?: boolean }) {
  const { user } = useAuth();
  const items = useTenantCollection<Item>('items');
  const products = useTenantCollection<Product>('products');
  const categories = useTenantCollection<Category>('categories');
  const groups = useTenantCollection<Group>('groups');
  const members = useTenantCollection<UserProfile>('users');
  const [mode, setMode] = useState(browse ? 'all' : 'mine');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState({ group: '', category: '', product: '', holder: '', owner: '', size: '' });
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const productMap = new Map(products.rows.map(p => [p.id, p]));
  const name = (id?: string | null) => id === 'storage' ? 'Storage' : members.rows.find(m => m.id === id)?.name || 'Member';
  const rows = items.rows.filter(item => {
    const product = productMap.get(item.productId);
    return (mode === 'all' || (mode === 'mine' ? item.holderId === user?.uid : item.holderId === 'storage')) &&
      (!search || `${product?.name || ''} ${item.rfidTag || ''}`.toLowerCase().includes(search.toLowerCase())) &&
      (!filters.group || item.groupId === filters.group) && (!filters.category || product?.categoryId === filters.category) &&
      (!filters.product || item.productId === filters.product) && (!filters.holder || item.holderId === filters.holder) &&
      (!filters.owner || item.ownerId === filters.owner) && (!filters.size || item.size?.toLowerCase().includes(filters.size.toLowerCase()));
  });
  const options = (entries: { id: string; name?: string }[]) => entries.map(e => ({ value: e.id, label: e.name || e.id }));
  const select = (key: keyof typeof filters, label: string, values: { value: string; label: string }[]) => <Form.Item label={label}>
    <Select aria-label={label} allowClear showSearch optionFilterProp="label" value={filters[key] || undefined} options={values} onChange={value => setFilters(f => ({ ...f, [key]: value || '', ...(key === 'category' ? { product: '' } : {}) }))} />
  </Form.Item>;
  return <section className="mobile-stack">
    <div className="mobile-search-row"><Input aria-label="Search inventory" placeholder="Search garments or tags" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} allowClear /><Button aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ''}`} icon={<FilterOutlined />} onClick={() => setOpen(true)}>{activeFilters || undefined}</Button></div>
    <Radio.Group className="mobile-segments" value={mode} onChange={e => setMode(e.target.value)} optionType="button" buttonStyle="solid" options={[{ label: 'My items', value: 'mine' }, { label: 'Available', value: 'available' }, { label: 'All', value: 'all' }]} />
    <p className="mobile-muted mobile-count">{rows.length} {rows.length === 1 ? 'item' : 'items'}{activeFilters ? ` · ${activeFilters} filters` : ''}</p>
    <MobileLoadState loading={items.loading || products.loading || members.loading} error={items.error || products.error || members.error || groups.error || categories.error} empty={!rows.length} emptyText={mode === 'mine' ? 'You are not holding any matching items.' : 'No matching items.'}>
      {rows.map(item => { const product = productMap.get(item.productId); return <Link key={item.id} to={`/items/${item.id}`} className="mobile-item-card">
        <GarmentImage src={item.imageUrl || product?.imageUrl} name={product?.name || 'Garment'} />
        <div className="mobile-item-copy"><h2>{product?.name || 'Unknown product'}</h2><p>{[item.size, item.gender].filter(Boolean).join(' · ')}</p><Tag color={item.holderId === 'storage' ? 'green' : 'blue'}>{item.holderId === 'storage' ? 'In storage' : `With ${name(item.holderId)}`}</Tag>{item.condition === 'damaged' && <Tag color="red">Damaged</Tag>}</div>
      </Link>; })}
    </MobileLoadState>
    <Drawer title="Inventory filters" placement="bottom" height="85svh" open={open} onClose={() => setOpen(false)} className="mobile-overlay" extra={<Button onClick={() => setFilters({ group: '', category: '', product: '', holder: '', owner: '', size: '' })}>Reset</Button>}>
      <Form layout="vertical">
        {select('group', 'Group', options(groups.rows))}
        {select('category', 'Category', options(categories.rows))}
        {select('product', 'Product', options(products.rows.filter(p => !filters.category || p.categoryId === filters.category)))}
        {select('holder', 'Holder', [{ value: 'storage', label: 'Storage' }, ...options(members.rows)])}
        {select('owner', 'Owner', options(members.rows))}
        <Form.Item label="Size"><Input value={filters.size} onChange={e => setFilters(f => ({ ...f, size: e.target.value }))} placeholder="e.g. M or 42" /></Form.Item>
      </Form>
      <Button type="primary" block onClick={() => setOpen(false)}>Show {rows.length} items</Button>
    </Drawer>
  </section>;
}
