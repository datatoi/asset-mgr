import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import {
  DashboardOutlined,
  SkinOutlined,
  GroupOutlined,
  TagsOutlined,
  UserOutlined,
  InboxOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import RegisterPage from './pages/RegisterPage';
import JoinPage from './pages/JoinPage';
import ItemsPage from './pages/ItemsPage';
import ItemDetail from './pages/ItemDetail';
import CategoriesPage from './pages/CategoriesPage';
import ProductsPage from './pages/ProductsPage';
import KitsPage from './pages/KitsPage';
import ProfilePage from './pages/ProfilePage';
import RequestInbox from './pages/RequestInbox';
import MembersPage from './pages/MembersPage';
import GroupsPage from './pages/GroupsPage';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isAdmin = Object.values(userData?.groups || {}).some(r => r === 'admin' || r === 'superadmin');

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/items', icon: <SkinOutlined />, label: 'Items' },
    { key: '/categories', icon: <GroupOutlined />, label: 'Categories' },
    { key: '/products', icon: <TagsOutlined />, label: 'Products' },
    { key: '/kits', icon: <InboxOutlined />, label: 'Kits' },
    { key: '/requests', icon: <InboxOutlined />, label: 'Requests' },
    ...(isAdmin ? [{ key: '/members', icon: <UserOutlined />, label: 'Members' }] : []),
    ...(isAdmin ? [{ key: '/groups', icon: <TeamOutlined />, label: 'Groups' }] : []),
    { key: '/profile', icon: <UserOutlined />, label: 'Profile' },
  ];

  const showSider = !['/login', '/register'].includes(location.pathname) && !location.pathname.startsWith('/join/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {showSider && (
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          trigger={null}
          collapsed={collapsed}
          onBreakpoint={(broken) => { setIsMobile(broken); setCollapsed(broken); }}
        >
          <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', color: 'white', textAlign: 'center', lineHeight: '32px', fontWeight: 'bold' }}>
            DRESS MGR
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => { navigate(key); if (isMobile) setCollapsed(true); }}
          />
        </Sider>
      )}
      <Layout>
        {showSider && (
          <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
          </Header>
        )}
        <Content style={{ margin: '24px 16px 0' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/join/:subscriptionId" element={<JoinPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
            <Route path="/items/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
            <Route path="/kits" element={<ProtectedRoute><KitsPage /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><RequestInbox /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
