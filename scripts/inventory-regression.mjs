import assert from 'node:assert/strict';
import { emptyFilters, filterItems, groupItems } from '../web/src/inventory/model.ts';

const members = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }];
const products = [{ id: 'dress', name: 'Red dress', categoryId: 'dresses' }];
const kits = [
  { id: 'one', name: 'Summer', groupId: 'g', productIds: ['dress'] },
  { id: 'two', name: 'Winter', groupId: 'g', productIds: ['dress'] },
  { id: 'foreign', name: 'Other group', groupId: 'other', productIds: ['dress'] },
];
const items = [
  { id: 'a', groupId: 'g', productId: 'dress', ownerId: 'alice', holderId: 'bob', size: 'M' },
  { id: 'b', groupId: 'g', productId: 'dress', ownerId: 'bob', holderId: 'storage', size: 'L', rfidTag: 'Laundry-42' },
  { id: 'c', groupId: 'g', productId: 'boots', holderId: 'storage' },
];
const filter = values => filterItems(items, products, kits, members, { ...emptyFilters, ...values }).map(i => i.id);
assert.deepEqual(filter({ search: 'ALICE' }), ['a']);
assert.deepEqual(filter({ search: 'laundry-42' }), ['b']);
assert.deepEqual(filter({ owner: 'alice', kit: 'one' }), ['a']);
assert.deepEqual(filter({ holder: 'storage', size: 'L' }), ['b']);
assert.deepEqual(filter({ kit: 'foreign' }), []);
assert.deepEqual(filter({ owner: 'unassigned' }), ['c']);
const sections = groupItems(items, kits, members, 'ownerKit');
assert.equal(sections.length, 5);
assert.equal(sections.find(s => s.title === 'Alice · Summer').items[0].id, 'a');
assert.equal(sections.find(s => s.title === 'Alice · Winter').items[0].id, 'a');
assert.equal(sections.find(s => s.title === 'Unassigned · Outside kits').items[0].id, 'c');
assert.equal(new Set(sections.flatMap(s => s.items.map(i => i.id))).size, 3);
assert.equal(groupItems(items.slice(0, 2), kits, members, 'kit', 'one').length, 1);
console.log('Inventory filtering and shared-kit grouping checks passed.');
