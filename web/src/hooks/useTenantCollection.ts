import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { db } from '../lib/firebase';

/** A subscription-scoped reader shared by the mobile presentation components. */
export function useTenantCollection<T extends { id: string }>(name: string) {
  const { userData } = useAuth();
  const tenant = userData?.subscriptionId;
  const [state, setState] = useState<{ tenant?: string; rows: T[]; loading: boolean; error?: string }>({ rows: [], loading: true });
  useEffect(() => {
    if (!tenant) return;
    return onSnapshot(query(collection(db, name), where('subscriptionId', '==', tenant)), snapshot => {
      setState({ tenant, rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id } as T)), loading: false });
    }, error => setState({ tenant, rows: [], loading: false, error: error.message }));
  }, [tenant, name]);
  return state.tenant === tenant && tenant ? state : { rows: [] as T[], loading: !!tenant, error: undefined };
}
