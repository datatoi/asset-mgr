import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, ConfigProvider, Drawer, Input, message } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, MenuOutlined, SkinOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/permissions';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import MobileInventory from './MobileInventory';
import ItemsPage from '../pages/ItemsPage';
import MobileItemDetail from './MobileItemDetail';
import KitsPage from '../pages/KitsPage';
import MobileKits from './MobileKits';
import MobileProfile from './MobileProfile';
import MobileTransfers from './MobileTransfers';
import CategoriesPage from '../pages/CategoriesPage';
import ProductsPage from '../pages/ProductsPage';
import MembersPage from '../pages/MembersPage';
import GroupsPage from '../pages/GroupsPage';
import Login from '../pages/Login';
import RegisterPage from '../pages/RegisterPage';
import JoinPage from '../pages/JoinPage';
import './mobile.css';

const titles: Record<string, string> = {
  '/': 'My items', '/dashboard': 'My items', '/items': 'Inventory', '/kits': 'Kits',
  '/transfers': 'Transfers', '/profile': 'Profile', '/categories': 'Categories',
  '/products': 'Products', '/members': 'Members', '/groups': 'Groups', '/manage/items': 'Manage items', '/manage/kits': 'Manage kits',
};

export default function MobileApp() {
  const { user, userData, isOwner, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const publicPage = ['/login', '/register'].includes(location.pathname) || location.pathname.startsWith('/join/');
  const profileOnly = !isOwner && !Object.values(userData?.groups || {}).some(r => ['user', 'admin', 'superadmin'].includes(r));
  const admin = canManage(userData, undefined, isOwner);
  const detail = location.pathname.startsWith('/items/');
  const inviteLink = userData?.subscriptionId ? `${window.location.origin}/join/${userData.subscriptionId}` : '';
  const title = detail ? 'Item details' : titles[location.pathname] || 'Dress Manager';
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const tabs = profileOnly ? [{ path: '/profile', label: 'Profile', icon: <UserOutlined /> }] : [
    { path: '/dashboard', label: 'My items', icon: <SkinOutlined /> },
    { path: '/kits', label: 'Kits', icon: <TeamOutlined /> },
    { path: '/transfers', label: 'Transfers', icon: <InboxOutlined /> },
    { path: '/profile', label: 'Profile', icon: <UserOutlined /> },
  ];
  const links = profileOnly ? [] : [
    { path: '/items', label: 'Browse inventory' },
    { path: '/categories', label: 'Categories' },
    { path: '/products', label: 'Products' },
    ...(admin ? [{ path: '/manage/items', label: 'Manage items' }, { path: '/manage/kits', label: 'Manage kits' }, { path: '/members', label: 'Members' }, { path: '/groups', label: 'Groups' }] : []),
  ];
  return <ConfigProvider componentSize="large" theme={{ token: { controlHeightLG: 48, borderRadius: 12 } }}>
    <div className={`mobile-app${publicPage ? ' mobile-public' : ''}`}>
      {!publicPage && user && <header className="mobile-header">
        {detail && <Button type="text" aria-label="Back to inventory" icon={<ArrowLeftOutlined />} onClick={() => navigate('/items')} />}
        <h1>{title}</h1>
        <Button type="text" aria-label="Open more menu" icon={<MenuOutlined />} onClick={() => setMore(true)} />
      </header>}
      <main id="mobile-content" className="mobile-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/join/:subscriptionId" element={<JoinPage />} />
          <Route path="/" element={<ProtectedRoute><MobileInventory key="my-items" /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><MobileInventory key="my-items" /></ProtectedRoute>} />
          <Route path="/items" element={<ProtectedRoute><MobileInventory key="inventory" browse /></ProtectedRoute>} />
          <Route path="/items/:id" element={<ProtectedRoute><MobileItemDetail key={location.pathname} /></ProtectedRoute>} />
          <Route path="/kits" element={<ProtectedRoute><MobileKits /></ProtectedRoute>} />
          <Route path="/transfers" element={<ProtectedRoute><MobileTransfers /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><MobileProfile /></ProtectedRoute>} />
          <Route path="/manage/items" element={<ProtectedRoute><div className="mobile-admin"><ItemsPage mobile /></div></ProtectedRoute>} />
          <Route path="/manage/kits" element={<ProtectedRoute><div className="mobile-admin"><KitsPage mobile /></div></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><div className="mobile-admin"><CategoriesPage mobile /></div></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><div className="mobile-admin"><ProductsPage mobile /></div></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><div className="mobile-admin"><MembersPage mobile /></div></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><div className="mobile-admin"><GroupsPage mobile /></div></ProtectedRoute>} />
        </Routes>
      </main>
      {!publicPage && user && <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {tabs.map(tab => <NavLink key={tab.path} to={tab.path} className={({ isActive }) => (isActive || (tab.path === '/dashboard' && location.pathname === '/')) ? 'active' : ''}>
          {tab.icon}<span>{tab.label}</span>
        </NavLink>)}
      </nav>}
      <Drawer title="More" placement="right" width="min(360px, 100vw)" open={more} onClose={() => setMore(false)} className="mobile-overlay">
        <p className="mobile-muted">{userData?.name || 'Your account'}</p>
        <div className="mobile-stack">{links.map(link => <Button key={link.path} block onClick={() => { setMore(false); navigate(link.path); }}>{link.label}</Button>)}</div>
        {admin && inviteLink && <section className="mobile-stack" style={{ marginTop: 24 }}><strong>Invite a member</strong><Input aria-label="Invite link" readOnly value={inviteLink} onFocus={e => e.target.select()} /><Button block onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); message.success('Invite link copied'); } catch { message.info('Select and copy the invite link above.'); } }}>Copy invite link</Button></section>}
        <Button block danger style={{ marginTop: 24 }} onClick={async () => { await logout(); setMore(false); }}>Sign out</Button>
      </Drawer>
    </div>
  </ConfigProvider>;
}
