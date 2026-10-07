import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Segmented, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { call } from '../lib/api';
import { useMobileLayout } from '../hooks/useMobileLayout';
import type { SubscriptionApplication, SubscriptionRequestStatus } from '../types/subscriptionRequests';

const colors = { pending: 'processing', approved: 'success', declined: 'error', cancelled: 'default' };
const labels = { pending: 'Awaiting review', approved: 'Approved', declined: 'Declined', cancelled: 'Closed' };

export default function SubscriptionRequestQueue() {
  const mobile = useMobileLayout();
  const [status, setStatus] = useState<SubscriptionRequestStatus>('pending');
  const [rows, setRows] = useState<SubscriptionApplication[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SubscriptionApplication | null>(null);
  const [decision, setDecision] = useState<'approved' | 'declined' | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [form] = Form.useForm();
  const generation = useRef(0);
  const load = useCallback(async (after?: string) => {
    const current = ++generation.current;
    setBusy(true); setError('');
    if (!after) { setRows([]); setCursor(null); }
    try {
      const result = await call<{ applications: SubscriptionApplication[]; nextCursor: string | null }>('listSubscriptionRequests', { status, after });
      if (generation.current !== current) return;
      setRows(previous => after ? [...previous, ...result.applications] : result.applications);
      setCursor(result.nextCursor);
    } catch (e) { if (generation.current === current) setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { if (generation.current === current) setBusy(false); }
  }, [status]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  const open = (row: SubscriptionApplication) => {
    setSelected(row); setDecision(null); setReviewError(''); form.resetFields();
  };
  const review = async (values: { reason?: string }) => {
    if (!selected || !decision) return;
    setSaving(true); setReviewError('');
    try {
      await call('reviewSubscriptionRequest', {
        requesterId: selected.requesterId, revision: selected.revision, decision,
        ...(decision === 'declined' ? { reason: values.reason } : {}),
      });
      setSelected(null);
      message.success(decision === 'approved' ? 'Subscription approved and ready to use' : 'Request declined. The applicant can read your feedback.');
      await load();
    } catch (e) { setReviewError(e instanceof Error ? e.message : 'Could not save this decision. Please try again.'); }
    finally { setSaving(false); }
  };
  return <>
    <Typography.Paragraph type="secondary">Review why each organization needs a subscription. Approval creates its subscription and first group, and gives the applicant owner access.</Typography.Paragraph>
    <Space wrap style={{ marginBottom: 16 }}>
      {mobile ? <Select aria-label="Request status" value={status} style={{ width: 210 }} onChange={setStatus} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} /> : <Segmented value={status} onChange={value => setStatus(value as SubscriptionRequestStatus)} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} />}
      <Button disabled={busy} onClick={() => void load()}>Refresh requests</Button>
    </Space>
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
    {mobile ? <Space direction="vertical" style={{ width: '100%' }}>
      {busy && <Spin />}
      {rows.map(row => <Card key={row.requesterId} title={row.orgName} extra={<Tag color={colors[row.status]}>{labels[row.status]}</Tag>}>
        <Typography.Paragraph>{row.requesterName} · {row.requesterEmail}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">{row.requestedAt && new Date(row.requestedAt).toLocaleString()}</Typography.Paragraph>
        <Typography.Paragraph ellipsis={{ rows: 2 }}>{row.description}</Typography.Paragraph>
        <Button block onClick={() => open(row)}>{row.status === 'pending' ? 'Review request' : 'View request'}</Button>
      </Card>)}
    </Space> : <Table rowKey="requesterId" dataSource={rows} loading={busy} pagination={false} columns={[
      { title: 'Organization', dataIndex: 'orgName' },
      { title: 'Applicant', render: (_: unknown, row: SubscriptionApplication) => <>{row.requesterName}<br /><Typography.Text type="secondary">{row.requesterEmail}</Typography.Text></> },
      { title: 'Submitted', dataIndex: 'requestedAt', render: (date: string | null) => date ? new Date(date).toLocaleString() : '—' },
      { title: 'Status', render: (_: unknown, row: SubscriptionApplication) => <Tag color={colors[row.status]}>{labels[row.status]}</Tag> },
      { title: 'Action', render: (_: unknown, row: SubscriptionApplication) => <Button onClick={() => open(row)}>{row.status === 'pending' ? 'Review request' : 'View request'}</Button> },
    ]} />}
    {!busy && !error && !rows.length && <Typography.Paragraph style={{ padding: 24, textAlign: 'center' }}>{status === 'pending' ? 'No requests awaiting review.' : 'No requests in this status.'}</Typography.Paragraph>}
    {cursor && <Button loading={busy} style={{ marginTop: 16 }} onClick={() => void load(cursor)}>Load more requests</Button>}
    <Modal title="Subscription request" open={!!selected} width={700} footer={null} closable={!saving} maskClosable={!saving} keyboard={!saving} onCancel={() => setSelected(null)}>
      {selected && <>
        <Tag color={colors[selected.status]}>{labels[selected.status]}</Tag>
        <Descriptions column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="Organization">{selected.orgName}</Descriptions.Item>
          <Descriptions.Item label="First group">{selected.groupName}</Descriptions.Item>
          <Descriptions.Item label="Applicant">{selected.requesterName} ({selected.requesterEmail})</Descriptions.Item>
          <Descriptions.Item label="Submitted">{selected.requestedAt && new Date(selected.requestedAt).toLocaleString()}</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5}>Reason for the subscription</Typography.Title>
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.description}</Typography.Paragraph>
        {selected.reviewReason && <Alert type="info" title="Review feedback" description={<span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.reviewReason}</span>} />}
        {reviewError && <Alert type="error" showIcon title={reviewError} style={{ marginBottom: 16 }} action={<Button onClick={() => { setSelected(null); void load(); }}>Refresh queue</Button>} />}
        {selected.status === 'pending' && (!decision ? <Space wrap>
          <Button type="primary" onClick={() => setDecision('approved')}>Approve request</Button>
          <Button danger onClick={() => setDecision('declined')}>Decline request</Button>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </Space> : <Form form={form} layout="vertical" onFinish={review} disabled={saving}>
          {decision === 'approved' ? <Alert type="info" showIcon title={`Approve ${selected.orgName}?`} description={`This creates the subscription and “${selected.groupName}” group. ${selected.requesterEmail} will become the subscription owner and can immediately manage their organization.`} style={{ marginBottom: 16 }} /> : <Form.Item label="Reason for declining" name="reason" extra="The applicant will see this feedback and can revise their request." rules={[{ required: true, whitespace: true, message: 'Explain why you are declining this request.' }]}><Input.TextArea rows={4} maxLength={2000} showCount /></Form.Item>}
          <Space wrap>
            <Button type="primary" danger={decision === 'declined'} htmlType="submit" loading={saving}>{decision === 'approved' ? 'Confirm approval' : 'Confirm decline'}</Button>
            <Button onClick={() => setDecision(null)}>Back to review</Button>
          </Space>
        </Form>)}
      </>}
    </Modal>
  </>;
}
