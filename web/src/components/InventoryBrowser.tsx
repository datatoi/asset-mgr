import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Drawer, Empty, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { call } from '../lib/api';
import type { Category, Group, Item, Kit, Product, TransferRequest, UserProfile } from '../types/models';
import { emptyFilters, filterItems, groupItems, personName } from '../inventory/model';
import type { Grouping, InventoryFilters } from '../inventory/model';

export default function InventoryBrowser({ cards = false, mobile = false, defaultMine = false, actions }: { cards?: boolean; mobile?: boolean; defaultMine?: boolean; actions?: (item: Item) => ReactNode }) {
  const { user, userData, isOwner } = useAuth();
  const items = useTenantCollection<Item>('items');
  const products = useTenantCollection<Product>('products');
  const categories = useTenantCollection<Category>('categories');
  const groups = useTenantCollection<Group>('groups');
  const members = useTenantCollection<UserProfile>('users');
  const kits = useTenantCollection<Kit>('kits');
  const transfers = useTenantCollection<TransferRequest>('transfers');
  const [filters, setFilters] = useState<InventoryFilters>(() => ({ ...emptyFilters, holder: defaultMine ? user?.uid || '' : '' }));
  const [grouping, setGrouping] = useState<Grouping>('none');
  const [sort, setSort] = useState('product');
  const [busy, setBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [requesting, setRequesting] = useState<Item[] | null>(null);
  const productMap = new Map(products.rows.map(p => [p.id, p]));
  const pending = new Set(transfers.rows.filter(t => t.status === 'pending' && t.requestedByUserId === user?.uid && !t.targetUserId).map(t => t.itemId));
  const itemName = (item: Item) => productMap.get(item.productId)?.name || 'Unknown product';
  const name = (id?: string | null) => personName(id, members.rows);
  const canRequest = (item: Item) => item.holderId !== user?.uid && !pending.has(item.id) && (isOwner || ['user', 'admin', 'superadmin'].includes(userData?.groups?.[item.groupId] || ''));
  const value = (item: Item, field: string) => field === 'owner' ? name(item.ownerId) : field === 'holder' ? name(item.holderId) : field === 'size' ? item.size || '' : itemName(item);
  const compare = (a: Item, b: Item, field: string) => value(a, field).localeCompare(value(b, field), undefined, { numeric: true, sensitivity: 'base' });
  const rows = filterItems(items.rows, products.rows, kits.rows, members.rows, filters).sort((a, b) => compare(a, b, sort.replace('-desc', '')) * (sort.endsWith('-desc') ? -1 : 1) || a.id.localeCompare(b.id));
  const sections = groupItems(rows, kits.rows, members.rows, grouping, filters.kit);
  const sources = [items, products, categories, groups, members, kits, transfers];
  const loading = sources.some(s => s.loading);
  const error = sources.find(s => s.error)?.error;
  const options = (entries: { id: string; name?: string }[]) => entries.map(e => ({ value: e.id, label: e.name || 'Unnamed' }));
  const select = (key: keyof InventoryFilters, label: string, entries: { value: string; label: string }[]) => <Select aria-label={label} placeholder={label} allowClear showSearch optionFilterProp="label" style={{ width: 160, maxWidth: '100%' }} value={filters[key] || undefined} options={entries} onChange={v => setFilters(f => ({ ...f, [key]: v || '', ...(key === 'category' ? { product: '' } : {}) }))} />;
  const prepare = (visible: Item[]) => setRequesting([...new Map(visible.filter(canRequest).map(i => [i.id, i])).values()]);
  const send = async () => {
    if (!requesting?.length) return;
    setBusy(true);
    try {
      const result = await call<{ transferIds: string[]; skipped: number }>('requestItems', { itemIds: requesting.map(i => i.id) });
      message.success(`${result.transferIds.length} requests sent${result.skipped ? `; ${result.skipped} already held or requested` : ''}. Track them in Transfers.`);
      setRequesting(null);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not request items'); }
    finally { setBusy(false); }
  };
  const requestButton = (visible: Item[], label: string) => {
    const count = visible.filter(canRequest).length;
    return <Button disabled={loading || !!error || busy || count === 0 || count > 100} onClick={() => prepare(visible)}>{label} ({count})</Button>;
  };
  const sortOrder = (field: string) => sort === field ? 'ascend' as const : sort === `${field}-desc` ? 'descend' as const : null;
  const columns: TableColumnsType<Item> = [
    { title: 'Image', render: (_, item) => {
      const src = item.imageUrl || productMap.get(item.productId)?.imageUrl;
      return src ? <img src={src} alt={itemName(item)} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} /> : '—';
    } },
    { title: 'Product', key: 'product', sortOrder: sortOrder('product'), sorter: (a, b) => compare(a, b, 'product'), render: (_, item) => <Link to={`/items/${item.id}`}>{itemName(item)}</Link> },
    { title: 'Size', key: 'size', dataIndex: 'size', sortOrder: sortOrder('size'), sorter: (a, b) => compare(a, b, 'size') },
    { title: 'Gender', dataIndex: 'gender' },
    { title: 'Condition', dataIndex: 'condition' },
    { title: 'Owner', key: 'owner', sortOrder: sortOrder('owner'), sorter: (a, b) => compare(a, b, 'owner'), render: (_, item) => name(item.ownerId) },
    { title: 'Holder', key: 'holder', sortOrder: sortOrder('holder'), sorter: (a, b) => compare(a, b, 'holder'), render: (_, item) => item.holderId === 'storage' ? <Tag color="green">Storage</Tag> : name(item.holderId) },
    { title: 'Kit', render: (_, item) => kits.rows.filter(k => k.groupId === item.groupId && k.productIds.includes(item.productId)).map(k => <Tag key={k.id}>{k.name}</Tag>) },
    { title: 'Group', render: (_, item) => groups.rows.find(g => g.id === item.groupId)?.name || 'Unknown' },
    { title: 'NFC tag', dataIndex: 'rfidTag' },
    { title: 'Actions', render: (_, item) => <Space wrap>{pending.has(item.id) ? <Tag>Requested</Tag> : canRequest(item) && requestButton([item], 'Request')}{actions?.(item)}</Space> },
  ];
  const controls = <>
      {select('group', 'Group', options(groups.rows))}
      {select('category', 'Category', options(categories.rows))}
      {select('product', 'Product', options(products.rows.filter(p => !filters.category || p.categoryId === filters.category)))}
      {select('holder', 'Holder', [{ value: 'storage', label: 'Storage' }, ...options(members.rows)])}
      {select('owner', 'Owner', [{ value: 'unassigned', label: 'Unassigned' }, ...options(members.rows)])}
      {select('kit', 'Kit', options(kits.rows))}
      <Input aria-label="Size" placeholder="Size" value={filters.size} onChange={e => setFilters(f => ({ ...f, size: e.target.value }))} style={{ width: 100 }} />
      <Select aria-label="Group items by" value={grouping} onChange={setGrouping} style={{ width: 180 }} options={[{ value: 'none', label: 'No grouping' }, { value: 'owner', label: 'Group by owner' }, { value: 'kit', label: 'Group by kit' }, { value: 'ownerKit', label: 'Group by owner + kit' }]} />
      <Select aria-label="Sort items" value={sort} onChange={setSort} style={{ width: 180 }} options={['product', 'owner', 'holder', 'size'].flatMap(field => [{ value: field, label: `${field[0].toUpperCase() + field.slice(1)} ↑` }, { value: `${field}-desc`, label: `${field[0].toUpperCase() + field.slice(1)} ↓` }])} />
      <Button onClick={() => setFilters({ ...emptyFilters })}>Clear filters</Button>
      <Button onClick={() => setFilters(f => ({ ...f, holder: user?.uid || '' }))}>My items</Button>
      <Button onClick={() => setFilters(f => ({ ...f, holder: 'storage' }))}>Available</Button>
  </>;
  return <div>
    <Space wrap style={{ marginBottom: 16, width: '100%' }}>
      <Input aria-label="Search inventory" placeholder="Search garments, people, kits or tags" prefix={<SearchOutlined />} allowClear value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ width: 280, maxWidth: '100%' }} />
      {mobile ? <Button icon={<FilterOutlined />} onClick={() => setFiltersOpen(true)} aria-label="Filters, grouping and sorting">Filters</Button> : controls}

    </Space>
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
    <Space wrap style={{ marginBottom: 16 }}><Typography.Text>{rows.length} items</Typography.Text>{requestButton(rows, 'Request matching items')}</Space>
    {(grouping === 'kit' || grouping === 'ownerKit') && <Typography.Paragraph type="secondary">Items can appear in several kits. These groups show matching garments, including incomplete outfits. Request all uses the exact visible items and skips items you already hold or requested.</Typography.Paragraph>}
    {!loading && !rows.length && <Empty description="No matching items" />}
    {sections.map(section => <section key={section.key} style={{ marginBottom: 24 }}>
      {grouping !== 'none' && <Space wrap style={{ marginBottom: 12 }}><Typography.Title level={4} style={{ margin: 0 }}>{section.title}</Typography.Title><Typography.Text type="secondary">{section.items.length} items</Typography.Text>{requestButton(section.items, 'Request group')}</Space>}
      {cards ? <Row gutter={[16, 16]}>{section.items.map(item => <Col xs={24} sm={12} md={8} lg={6} key={item.id}><Card cover={(item.imageUrl || productMap.get(item.productId)?.imageUrl) ? <Link to={`/items/${item.id}`}><img src={item.imageUrl || productMap.get(item.productId)?.imageUrl} alt={itemName(item)} style={{ width: '100%', height: 180, objectFit: 'cover' }} /></Link> : undefined}>
        <Link to={`/items/${item.id}`}><Typography.Text strong>{itemName(item)}</Typography.Text></Link>
        <p>{[item.size, item.gender, item.condition].filter(Boolean).join(' · ')}</p>
        <p>Owner: {name(item.ownerId)}<br />Holder: {name(item.holderId)}</p>
        {pending.has(item.id) ? <Tag>Requested</Tag> : canRequest(item) && requestButton([item], 'Request')}
        {actions?.(item)}
      </Card></Col>)}</Row> : <Table<Item> loading={loading} rowKey="id" columns={columns} dataSource={section.items} scroll={{ x: 'max-content' }} onChange={(_, __, sorter) => {
        const selected = Array.isArray(sorter) ? sorter[0] : sorter;
        setSort(selected.order ? `${selected.columnKey}${selected.order === 'descend' ? '-desc' : ''}` : 'product');
      }} />}
    </section>)}
    {loading && !sections.length && <Typography.Text>Loading inventory…</Typography.Text>}
    <Drawer title="Filters, grouping and sorting" placement="bottom" height="85svh" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
      <Space wrap style={{ marginBottom: 24 }}>{controls}</Space>
      <Button type="primary" block onClick={() => setFiltersOpen(false)}>Show {rows.length} items</Button>
    </Drawer>
    <Modal title={`Request ${requesting?.length || 0} items`} open={requesting !== null} onCancel={() => !busy && setRequesting(null)} onOk={send} confirmLoading={busy} okText="Send requests" okButtonProps={{ disabled: !requesting?.length || (requesting?.length || 0) > 100 }} cancelButtonProps={{ disabled: busy }}>
      <p>Request these exact garments. Each request needs approval from the current holder or an administrator.</p>
      <ul style={{ maxHeight: '50vh', overflowY: 'auto' }}>{requesting?.map(item => <li key={item.id}>{itemName(item)}{item.size ? ` · ${item.size}` : ''} · Holder: {name(item.holderId)}{item.rfidTag ? ` · ${item.rfidTag}` : ''}</li>)}</ul>
    </Modal>
  </div>;
}
