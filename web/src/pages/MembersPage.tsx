import React, { useEffect, useState } from 'react';
import { Table, Space, Card, Typography, message, Select } from 'antd';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../auth/AuthContext';
import type { Group, Role, UserProfile } from '../types/models';

const { Title } = Typography;

const MembersPage: React.FC = () => {
  const { userData } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userData?.subscriptionId) return;

    // Fetch all users in this subscription
    const qUsers = query(collection(db, 'users'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)));
    });

    // Fetch all groups in this subscription
    const qGroups = query(collection(db, 'groups'), where('subscriptionId', '==', userData.subscriptionId));
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
    });

    return () => { unsubUsers(); unsubGroups(); };
  }, [userData]);

  const handleRoleChange = async (targetUid: string, groupId: string, role: Role | null) => {
    setLoading(true);
    try {
      const assignRoleFn = httpsCallable(functions, 'assignRole');
      await assignRoleFn({ targetUid, groupId, role });
      message.success('Role updated successfully');
    } catch (err) {
      message.error('Failed to update role: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: unknown, record: UserProfile) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          {groups.map(group => {
            const currentRole = record.groups?.[group.id];
            return (
              <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{group.name}:</span>
                <Select
                  value={currentRole || null}
                  placeholder="No Role"
                  style={{ width: 120 }}
                  onChange={(val) => handleRoleChange(record.id, group.id, val)}
                  loading={loading}
                >
                  <Select.Option value={null}>None</Select.Option>
                  <Select.Option value="user">User</Select.Option>
                  <Select.Option value="admin">Admin</Select.Option>
                  <Select.Option value="superadmin">Superadmin</Select.Option>
                </Select>
              </div>
            );
          })}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={2}>Member Management</Title>
        <Table dataSource={members} columns={columns} rowKey="id" />
      </Card>
    </div>
  );
};

export default MembersPage;
