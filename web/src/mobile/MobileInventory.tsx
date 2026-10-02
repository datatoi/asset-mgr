import InventoryBrowser from '../components/InventoryBrowser';

export default function MobileInventory({ browse = false }: { browse?: boolean }) {
  return <InventoryBrowser cards mobile defaultMine={!browse} />;
}
