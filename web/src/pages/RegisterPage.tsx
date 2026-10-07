import { useEffect, useState } from 'react';
import { Alert, Form, Input, Button, Card, Typography, Layout, message, Spin, Space, Result, Descriptions } from 'antd';
import { Link } from 'react-router-dom';
import { GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { call } from '../lib/api';
import type { SubscriptionApplication } from '../types/subscriptionRequests';

const { Title, Paragraph } = Typography;
const cardStyle = { width: 600, maxWidth: '100%', borderRadius: 12 };

function RegistrationApplication() {
  const { user, userData, logout } = useAuth();
  const [application, setApplication] = useState<SubscriptionApplication | null>(null);
  const [checking, setChecking] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  const refresh = async () => {
    setChecking(true); setError('');
    try {
      const result = await call<{ application: SubscriptionApplication | null }>('getMySubscriptionRequest', {});
      setApplication(result.application); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check your request. Please try again.'); }
    finally { setChecking(false); }
  };
  useEffect(() => {
    let current = true;
    call<{ application: SubscriptionApplication | null }>('getMySubscriptionRequest', {}).then(result => {
      if (current) { setApplication(result.application); setLoaded(true); }
    }).catch(e => { if (current) setError(e instanceof Error ? e.message : 'Could not check your request.'); })
      .finally(() => { if (current) setChecking(false); });
    return () => { current = false; };
  }, []);

  const submit = async (values: { orgName: string; groupName: string; description: string }) => {
    setBusy(true); setError('');
    try {
      const submitted = await call<{ revision: number }>('registerSubscription', values);
      setApplication({ ...values, requesterId: user!.uid, requesterName: user!.displayName || 'Member', requesterEmail: user!.email || '', revision: submitted.revision, status: 'pending', requestedAt: new Date().toISOString(), reviewedAt: null, reviewReason: '', subscriptionId: null });
      setLoaded(true);
      setEditing(false);
      message.success('Request submitted for review');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your request. Your details are still here.'); }
    finally { setBusy(false); }
  };
  const hasStatus = application && !editing;
  const approved = application?.status === 'approved';
  const showForm = !userData?.subscriptionId && !hasStatus && !checking && loaded;

  return <Card style={cardStyle}>
    <Title level={3}>Request a new subscription</Title>
    <Paragraph type="secondary">Signed in as {user?.email}</Paragraph>
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} action={<Button disabled={busy || checking} onClick={() => void refresh()}>Try again</Button>} />}
    {checking && <div style={{ padding: 24, textAlign: 'center' }}><Spin aria-label="Checking request status" /></div>}
    {!checking && hasStatus && <>
      <Result
        status={approved ? 'success' : application.status === 'pending' ? 'info' : 'warning'}
        title={approved ? 'Your subscription is approved' : application.status === 'pending' ? 'Your request is awaiting approval' : application.status === 'declined' ? 'Your request was declined' : 'Your request is closed'}
        subTitle={approved ? 'Your organization is ready. Start by adding your catalog and inviting members.' : application.status === 'pending' ? 'A site administrator will review your request. You can start using your subscription after approval. Return to this page to check the result.' : application.status === 'declined' ? 'Read the administrator’s feedback below. You can revise your details and submit a new request.' : application.reviewReason}
        extra={approved ? userData?.subscriptionId ? <Link to="/administration"><Button type="primary">Open my organization</Button></Link> : <Button loading={checking} onClick={() => void refresh()}>Check access</Button> : application.status === 'pending' ? <Button onClick={() => void refresh()}>Check status</Button> : !userData?.subscriptionId ? <Button type="primary" onClick={() => { form.setFieldsValue(application); setEditing(true); }}>Revise and resubmit</Button> : <Link to="/dashboard">Open my organization</Link>}
      />
      {application.status === 'declined' && <Alert type="warning" showIcon title="Administrator’s feedback" description={<span style={{ whiteSpace: 'pre-wrap' }}>{application.reviewReason}</span>} style={{ marginBottom: 24 }} />}
      <Descriptions column={1} size="small" title="Your submitted request">
        <Descriptions.Item label="Organization">{application.orgName}</Descriptions.Item>
        <Descriptions.Item label="First group">{application.groupName}</Descriptions.Item>
        <Descriptions.Item label="Reason"><span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{application.description}</span></Descriptions.Item>
        <Descriptions.Item label="Submitted">{application.requestedAt ? new Date(application.requestedAt).toLocaleString() : '—'}</Descriptions.Item>
      </Descriptions>
    </>}
    {!checking && loaded && !hasStatus && userData?.subscriptionId && <Result status="info" title="You already belong to an organization" extra={<Link to="/dashboard"><Button type="primary">Open my organization</Button></Link>} />}
    {showForm && <>
      <Paragraph>Tell us about your organization and why it needs a subscription. A site administrator must approve your request before you can manage costumes or invite members.</Paragraph>
      <Form form={form} layout="vertical" onFinish={submit} disabled={busy}>
        <Form.Item label="Organization name" name="orgName" rules={[{ required: true, whitespace: true, message: 'Enter your organization’s name.' }]}>
          <Input maxLength={200} placeholder="e.g. Folk Dance Ensemble" />
        </Form.Item>
        <Form.Item label="First group name" name="groupName" extra="This group will be created when your request is approved." rules={[{ required: true, whitespace: true, message: 'Enter the name of your first group.' }]}>
          <Input maxLength={200} placeholder="e.g. Main Group" />
        </Form.Item>
        <Form.Item label="Why do you need a subscription?" name="description" extra="Explain who your organization serves, which costumes you manage, and how you plan to use this application." rules={[{ required: true, whitespace: true, message: 'Explain why your organization needs a subscription.' }]}>
          <Input.TextArea rows={5} maxLength={2000} showCount placeholder="Tell the site administrator about your organization and the reason for this request." />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={busy}>Submit for approval</Button>
        {editing && <Button block style={{ marginTop: 12 }} onClick={() => setEditing(false)}>Cancel changes</Button>}
      </Form>
    </>}
    <Space wrap style={{ marginTop: 24 }}>
      <Link to="/">Back to main page</Link>
      <Button disabled={busy} onClick={() => void logout()}>Sign out</Button>
    </Space>
  </Card>;
}

export default function RegisterPage() {
  const { user, loading, login } = useAuth();
  return <Layout style={{ minHeight: '100vh', padding: '48px 16px', alignItems: 'center' }}>
    {loading ? <Spin /> : user ? <RegistrationApplication key={user.uid} /> : <Card style={cardStyle}>
      <Title level={3}>Request a new subscription</Title>
      <Paragraph>Sign in to tell us about your organization. A site administrator will review your request before your subscription becomes available.</Paragraph>
      <Button type="primary" size="large" block icon={<GoogleOutlined />} onClick={async () => {
        try { await login(); } catch (e) { message.error(e instanceof Error ? e.message : 'Could not sign in. Please try again.'); }
      }}>Sign in with Google</Button>
      <Paragraph style={{ marginTop: 24, marginBottom: 0 }}><Link to="/">Back to main page</Link></Paragraph>
    </Card>}
  </Layout>;
}
