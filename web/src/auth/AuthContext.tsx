import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Subscription, UserProfile } from '../types/models';

interface ImpersonatedSubscription {
  id: string;
  name: string;
  groupIds: string[];
}

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isPlatformAdmin: boolean;
  impersonating: ImpersonatedSubscription | null;
  startImpersonating: (subscriptionId: string) => Promise<void>;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [realUserData, setRealUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState<ImpersonatedSubscription | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setImpersonating(null);
      if (u) {
        const unsubData = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          const data = snap.data();
          setRealUserData(data ? { id: snap.id, ...data } as UserProfile : null);
          setLoading(false);
        });
        const unsubPlatformAdmin = onSnapshot(doc(db, 'platformAdmins', u.uid), (snap) => {
          setIsPlatformAdmin(snap.exists());
        });
        return () => {
          unsubData();
          unsubPlatformAdmin();
        };
      } else {
        setRealUserData(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Platform Admin "Manage as" support: fetch every group belonging to the
  // target subscription and synthesize superadmin membership in all of them.
  // This is purely a client-side UI convenience - real enforcement happens
  // server-side (Firestore rules + Cloud Functions both check the actual
  // platformAdmins allowlist independently of what userData claims here).
  const startImpersonating = async (subscriptionId: string) => {
    const subSnap = await new Promise<Subscription | undefined>((resolve) => {
      const unsub = onSnapshot(doc(db, 'subscriptions', subscriptionId), (snap) => {
        unsub();
        const data = snap.data();
        resolve(data ? { id: snap.id, ...data } as Subscription : undefined);
      });
    });
    const groupsQuery = query(collection(db, 'groups'), where('subscriptionId', '==', subscriptionId));
    const groupIds = await new Promise<string[]>((resolve) => {
      const unsub = onSnapshot(groupsQuery, (snap) => {
        unsub();
        resolve(snap.docs.map((d) => d.id));
      });
    });
    setImpersonating({ id: subscriptionId, name: subSnap?.name || subscriptionId, groupIds });
  };

  const stopImpersonating = () => setImpersonating(null);

  const userData: UserProfile | null = useMemo(() => {
    if (!impersonating) return realUserData;
    return {
      id: realUserData?.id || user?.uid || '',
      ...realUserData,
      name: realUserData?.name || user?.displayName || 'Platform Admin',
      email: realUserData?.email || user?.email || undefined,
      avatarUrl: realUserData?.avatarUrl || user?.photoURL,
      subscriptionId: impersonating.id,
      groups: Object.fromEntries(impersonating.groupIds.map((gid) => [gid, 'superadmin' as const])),
    };
  }, [impersonating, realUserData, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        login,
        logout,
        isPlatformAdmin,
        impersonating,
        startImpersonating,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
