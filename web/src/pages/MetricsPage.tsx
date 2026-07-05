import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Result } from 'antd';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';

const { Title } = Typography;

const COLLECTIONS: { key: string; label: string }[] = [
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'groups', label: 'Groups' },
  { key: 'users', label: 'Users' },
  { key: 'items', label: 'Items' },
  { key: 'kits', label: 'Kits' },
  { key: 'requests', label: 'Requests' },
];

const MetricsPage: React.FC = () => {
  const { isPlatformAdmin } = useAuth();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        COLLECTIONS.map(async ({ key }) => {
          const snap = await getCountFromServer(collection(db, key));
          return [key, snap.data().count] as const;
        })
      );
      if (!cancelled) {
        setCounts(Object.fromEntries(entries));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin) {
    return <Result status="403" title="Not authorized" subTitle="Platform Admin access only." />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Site-wide Metrics</Title>
      <Row gutter={[16, 16]}>
        {COLLECTIONS.map(({ key, label }) => (
          <Col xs={24} sm={12} md={8} key={key}>
            <Card>
              <Statistic title={label} value={counts[key] ?? undefined} loading={loading} />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default MetricsPage;
