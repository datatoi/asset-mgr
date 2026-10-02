import type { UserProfile } from '../types/models';

export function canManage(user: UserProfile | null, groupId?: string, owner = false) {
  return owner || (groupId ? ['admin', 'superadmin'].includes(user?.groups?.[groupId] || '') :
    Object.values(user?.groups || {}).some(r => r === 'admin' || r === 'superadmin'));
}

export function canManageRoles(user: UserProfile | null, groupId?: string, owner = false) {
  return owner || (groupId ? user?.groups?.[groupId] === 'superadmin' :
    Object.values(user?.groups || {}).includes('superadmin'));
}
