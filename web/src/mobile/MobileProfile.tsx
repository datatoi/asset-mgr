import { useEffect, useRef, useState } from 'react';
import { Button, Collapse, Form, Input, message, Select } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { useTenantCollection } from '../hooks/useTenantCollection';
import { call } from '../lib/api';
import ImageUpload from '../components/ImageUpload';
import type { Category, Gender } from '../types/models';
import { MobileLoadState } from './components';

export default function MobileProfile() {
  const { user, userData, loading } = useAuth();
  const categories = useTenantCollection<Category>('categories');
  const [form] = Form.useForm();
  const initialized = useRef<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const gender = Form.useWatch('gender', form) || userData?.gender;
  useEffect(() => {
    if (userData && initialized.current !== userData.id) {
      form.setFieldsValue(userData);
      initialized.current = userData.id;
    }
  }, [userData, form]);
  const visible = categories.rows.filter(c => c.gender === 'unisex' || c.gender === gender);
  const save = async ({ name, gender, sizes }: { name: string; gender?: Gender; sizes?: Record<string, string> }) => {
    setSaving(true);
    try { await call('updateProfile', { name, gender, sizes }); message.success('Profile saved'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not save profile'); }
    finally { setSaving(false); }
  };
  return <MobileLoadState loading={loading || categories.loading} error={categories.error} empty={!userData}>
    <Form form={form} layout="vertical" onFinish={save} className="mobile-stack mobile-with-actions">
      <section className="mobile-card mobile-profile-avatar"><ImageUpload value={userData?.avatarUrl || undefined} folder={`avatars/${user?.uid}`} onChange={async avatarUrl => { await call('updateProfile', { avatarUrl }); }} /><div><h2>{userData?.name || 'Your profile'}</h2><p className="mobile-muted">Tap the picture to upload. It saves immediately.</p></div></section>
      <section className="mobile-card">
        <Form.Item label="Name" name="name" rules={[{ required: true }, { max: 200 }]}><Input autoComplete="name" maxLength={200} /></Form.Item>
        <Form.Item label="Email"><Input value={userData?.email} disabled /></Form.Item>
        <Form.Item label="Gender" name="gender"><Select placeholder="Choose gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} /></Form.Item>
      </section>
      <section className="mobile-card mobile-stack"><h2>Sizes by category</h2><p className="mobile-muted">Set a separate size for shoes, dresses and other garment categories.</p>
        {!gender && <p className="mobile-muted">Choose your gender to see all matching categories.</p>}
        {!visible.length && <p className="mobile-muted">No matching categories yet.</p>}
        <Collapse ghost defaultActiveKey={['sizes']} items={[{ key: 'sizes', label: `${visible.length} category sizes`, forceRender: true, children: visible.map(c => <Form.Item key={c.id} label={c.name} name={['sizes', c.id]} rules={[{ max: 50 }]}><Input placeholder="e.g. M or 42" maxLength={50} /></Form.Item>) }]} />
      </section>
      <div className="mobile-fixed-action"><Button type="primary" block htmlType="submit" loading={saving}>Save profile</Button></div>
    </Form>
  </MobileLoadState>;
}
