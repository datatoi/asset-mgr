import type { Item, Kit, Product, UserProfile } from '../types/models';

export type Grouping = 'none' | 'owner' | 'kit' | 'ownerKit';
export type InventoryFilters = { search: string; group: string; category: string; product: string; holder: string; owner: string; kit: string; size: string };
export const emptyFilters: InventoryFilters = { search: '', group: '', category: '', product: '', holder: '', owner: '', kit: '', size: '' };
export function personName(id: string | null | undefined, members: UserProfile[]) {
  return !id ? 'Unassigned' : id === 'storage' ? 'Storage' : members.find(m => m.id === id)?.name || 'Unknown member';
}
export function itemKits(item: Item, kits: Kit[]) {
  return kits.filter(k => k.groupId === item.groupId && k.productIds.includes(item.productId));
}
export function filterItems(items: Item[], products: Product[], kits: Kit[], members: UserProfile[], filters: InventoryFilters) {
  const productMap = new Map(products.map(p => [p.id, p]));
  const search = filters.search.trim().toLowerCase();
  return items.filter(item => {
    const product = productMap.get(item.productId);
    const matchesSearch = !search || [product?.name, item.rfidTag, item.size, item.description, personName(item.ownerId, members), personName(item.holderId, members), ...itemKits(item, kits).map(k => k.name)].join(' ').toLowerCase().includes(search);
    return matchesSearch && (!filters.group || item.groupId === filters.group) &&
      (!filters.category || product?.categoryId === filters.category) && (!filters.product || item.productId === filters.product) &&
      (!filters.holder || item.holderId === filters.holder) && (!filters.owner || (item.ownerId || 'unassigned') === filters.owner) &&
      (!filters.kit || itemKits(item, kits).some(k => k.id === filters.kit)) &&
      (!filters.size || item.size?.toLowerCase().includes(filters.size.toLowerCase()));
  });
}
export function groupItems(items: Item[], kits: Kit[], members: UserProfile[], grouping: Grouping, kitFilter = '') {
  const sections = new Map<string, { key: string; title: string; items: Item[] }>();
  for (const item of items) {
    const matches = itemKits(item, kits).filter(k => !kitFilter || k.id === kitFilter);
    const memberships = grouping === 'kit' || grouping === 'ownerKit' ? (matches.length ? matches : [null]) : [null];
    for (const kit of memberships) {
      const owner = grouping === 'owner' || grouping === 'ownerKit' ? item.ownerId || 'unassigned' : '';
      const key = JSON.stringify([owner, kit?.id || '']);
      const title = [owner ? personName(item.ownerId, members) : '', kit?.name || ((grouping === 'kit' || grouping === 'ownerKit') ? 'Outside kits' : '')].filter(Boolean).join(' · ') || 'All items';
      if (!sections.has(key)) sections.set(key, { key, title, items: [] });
      sections.get(key)!.items.push(item);
    }
  }
  return [...sections.values()];
}
