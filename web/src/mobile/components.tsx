import type { ReactNode } from 'react';
import { Alert, Empty, Skeleton } from 'antd';
import { SkinOutlined } from '@ant-design/icons';

export function MobileLoadState({ loading, error, empty, children, emptyText = 'Nothing here yet' }: { loading: boolean; error?: string; empty: boolean; children: ReactNode; emptyText?: string }) {
  if (error) return <Alert type="error" showIcon title="Could not load this page" description={error} />;
  if (loading) return <div className="mobile-stack"><Skeleton active /><Skeleton active /></div>;
  if (empty) return <Empty description={emptyText} />;
  return <>{children}</>;
}

export function GarmentImage({ src, name, large = false }: { src?: string; name: string; large?: boolean }) {
  return src ? <img className={large ? 'mobile-hero' : 'mobile-thumbnail'} src={src} alt={name} loading="lazy" /> : <div className={large ? 'mobile-hero mobile-image-placeholder' : 'mobile-thumbnail mobile-image-placeholder'} role="img" aria-label={`No image for ${name}`}><SkinOutlined /></div>;
}
