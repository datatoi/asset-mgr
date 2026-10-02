import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, ConfigProvider, Drawer } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, MenuOutlined, SkinOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/permissions';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import Dashboard from '../pages/Dashboard';
import ItemsPage from '../pages/ItemsPage';
import ItemDetail from '../pages/ItemDetail';
import KitsPage from '../pages/KitsPage';
import ProfilePage from '../pages/ProfilePage';
import TransferInbox from '../pages/TransferInbox';
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
  '/products': 'Products', '/members': 'Members', '/groups': 'Groups',
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
    ...(admin ? [{ path: '/members', label: 'Members' }, { path: '/groups', label: 'Groups' }] : []),
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
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
          <Route path="/items/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
          <Route path="/kits" element={<ProtectedRoute><KitsPage /></ProtectedRoute>} />
          <Route path="/transfers" element={<ProtectedRoute><TransferInbox /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
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
        <Button block danger style={{ marginTop: 24 }} onClick={async () => { await logout(); setMore(false); }}>Sign out</Button>
      </Drawer>
    </div>
  </ConfigProvider>;
}
