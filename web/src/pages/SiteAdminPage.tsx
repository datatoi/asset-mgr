import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Modal, Result, Space, Spin, Table, Tabs, Typography, message } from 'antd';
import { useAuth } from '../auth/AuthContext';
import SubscriptionRequestQueue from './SubscriptionRequestQueue';
import { call } from '../lib/api';
import { useMobileLayout } from '../hooks/useMobileLayout';

interface SubscriptionRow { id: string; name: string; ownerUserId: string; createdAt: string | null }
interface SubscriptionDetail {
  id: string; name: string; ownerUserId: string;
  groups: { id: string; name: string }[];
  members: { id: string; name: string; email: string; groups: Record<string, string> }[];
  memberCount: number;
}

function SiteAdministration() {
  const { user, userData, logout } = useAuth();
  const mobile = useMobileLayout();
  const [tab, setTab] = useState('requests');
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SubscriptionDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async (after?: string) => {
    setBusy(true); setError('');
    try {
      const result = await call<{ subscriptions: SubscriptionRow[]; nextCursor: string | null }>('listSiteSubscriptions', { after });
      setRows(previous => after ? [...previous, ...result.subscriptions] : result.subscriptions);
      setCursor(result.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load subscriptions'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (tab === 'subscriptions') void load(); }, [tab]);
  const inspect = async (row: SubscriptionRow) => {
    setDetailBusy(true);
    try {
      const detail = await call<SubscriptionDetail>('getSiteSubscription', { subscriptionId: row.id });
      setSelected(detail); form.setFieldsValue({ name: detail.name });
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not load subscription'); }
    finally { setDetailBusy(false); }
  };
  const save = async ({ name }: { name: string }) => {
    if (!selected) return;
    setSaving(true);
    try {
      await call('updateSiteSubscription', { subscriptionId: selected.id, name });
      setRows(previous => previous.map(row => row.id === selected.id ? { ...row, name: name.trim() } : row));
      setSelected({ ...selected, name: name.trim() });
      message.success('Subscription updated');
    } catch (e) { message.error(e instanceof Error ? e.message : 'Could not update subscription'); }
    finally { setSaving(false); }
  };
  return <div style={{ padding: mobile ? 16 : 24, maxWidth: 1200, margin: '0 auto' }}>
    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
      <Typography.Title level={2}>Site administration</Typography.Title>
      <Space wrap>
        {userData?.subscriptionId && <Link to="/dashboard">My organization</Link>}
        <Button onClick={() => void logout()}>Sign out</Button>
      </Space>
    </Space>
    <Typography.Paragraph type="secondary">Manage subscriptions across this installation. Signed in as {user?.email}.</Typography.Paragraph>
    <Tabs activeKey={tab} onChange={setTab} items={[
      { key: 'requests', label: 'Subscription requests' }, { key: 'subscriptions', label: 'Subscriptions' },
    ]} />
    {tab === 'requests' ? <SubscriptionRequestQueue /> : <>
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
    <Button disabled={busy || detailBusy} onClick={() => void load()} style={{ marginBottom: 16 }}>Refresh</Button>
    <Spin spinning={detailBusy}>
      {mobile ? <Space direction="vertical" style={{ width: '100%' }}>
        {rows.map(row => <Card key={row.id} title={row.name}>
          <Typography.Paragraph type="secondary">{row.id}</Typography.Paragraph>
          <Typography.Paragraph>Owner: {row.ownerUserId}</Typography.Paragraph>
          <Button block disabled={detailBusy} onClick={() => void inspect(row)}>Manage subscription</Button>
        </Card>)}
        {busy && <Spin />}
        {!busy && !rows.length && !error && <Typography.Text>No subscriptions yet.</Typography.Text>}
      </Space> : <Table rowKey="id" dataSource={rows} loading={busy} pagination={false} columns={[
        { title: 'Subscription', dataIndex: 'name' },
        { title: 'ID', dataIndex: 'id' },
        { title: 'Owner UID', dataIndex: 'ownerUserId' },
        { title: 'Created', dataIndex: 'createdAt', render: (date: string | null) => date ? new Date(date).toLocaleDateString() : '—' },
        { title: 'Action', render: (_: unknown, row: SubscriptionRow) => <Button disabled={detailBusy} onClick={() => void inspect(row)}>Manage</Button> },
      ]} />}
    </Spin>
    {cursor && <Button loading={busy} onClick={() => void load(cursor)} style={{ marginTop: 16 }}>Load more subscriptions</Button>}
    </>}
    <Modal title="Manage subscription" open={!!selected} width={760} footer={null} closable={!saving} maskClosable={!saving} onCancel={() => setSelected(null)}>
      {selected && <>
        <Typography.Paragraph type="secondary">ID: {selected.id} · Owner: {selected.ownerUserId}</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="name" label="Subscription name" rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Save name</Button>
        </Form>
        <Typography.Title level={4}>Groups ({selected.groups.length})</Typography.Title>
        {selected.groups.map(group => <Typography.Paragraph key={group.id}>{group.name} <Typography.Text type="secondary">({group.id})</Typography.Text></Typography.Paragraph>)}
        <Typography.Title level={4}>Members ({selected.memberCount})</Typography.Title>
        {selected.memberCount > selected.members.length && <Typography.Paragraph type="secondary">Showing the first {selected.members.length} members.</Typography.Paragraph>}
        <Table size="small" rowKey="id" dataSource={selected.members} scroll={{ x: 500 }} pagination={{ pageSize: 5 }} columns={[
          { title: 'Name', dataIndex: 'name' }, { title: 'Email', dataIndex: 'email' },
          { title: 'Roles', render: (_: unknown, member: SubscriptionDetail['members'][number]) => Object.entries(member.groups).map(([groupId, role]) => `${selected.groups.find(group => group.id === groupId)?.name || groupId}: ${role}`).join(', ') },
        ]} />
      </>}
    </Modal>
  </div>;
}

export default function SiteAdminPage() {
  const { user, loading, isSiteAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Spin style={{ display: 'block', padding: 48 }} />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isSiteAdmin) return <Result status="403" title="Site administrator access required" subTitle="This page is available to administrators of this installation." extra={<Link to="/">Return to the app</Link>} />;
  return <SiteAdministration />;
}
