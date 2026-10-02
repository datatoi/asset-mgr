import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import DesktopApp from './DesktopApp';
import { useMobileLayout } from './hooks/useMobileLayout';

const MobileApp = lazy(() => import('./mobile/MobileApp'));

export default function App() {
  const mobile = useMobileLayout();
  return mobile ? <Suspense fallback={<div style={{ padding: 24 }}><Spin /></div>}><MobileApp /></Suspense> : <DesktopApp />;
}
