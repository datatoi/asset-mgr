import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onIdTokenChanged,
  getIdTokenResult,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types/models';

interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  loading: boolean;
  isOwner: boolean;
  isSiteAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(true);

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    let stopSubscription: (() => void) | undefined;
    let generation = 0;
    const unsubAuth = onIdTokenChanged(auth, (u) => {
      const current = ++generation;
      stopProfile?.();
      stopSubscription?.();
      stopProfile = undefined;
      stopSubscription = undefined;
      setUser(u);
      setUserData(null);
      setIsOwner(false);
      setLoading(!!u);
      setIsSiteAdmin(false);
      setClaimsLoading(!!u);
      if (u) void getIdTokenResult(u).then(result => {
        if (generation === current) setIsSiteAdmin(result.claims.siteAdmin === true);
      }).catch(() => {
        if (generation === current) setIsSiteAdmin(false);
      }).finally(() => {
        if (generation === current) setClaimsLoading(false);
      });
      if (!u) return;
      let subscriptionId: string | undefined;
      stopProfile = onSnapshot(doc(db, 'users', u.uid), (snap) => {
        if (generation !== current) return;
        const data = snap.data();
        setUserData(data ? { ...data, id: snap.id } as UserProfile : null);
        if (data?.subscriptionId && data.subscriptionId !== subscriptionId) {
          stopSubscription?.();
          subscriptionId = data.subscriptionId;
          stopSubscription = onSnapshot(doc(db, 'subscriptions', data.subscriptionId), (sub) => {
            if (generation !== current) return;
            setIsOwner(sub.data()?.ownerUserId === u.uid);
            setLoading(false);
          }, () => {
            if (generation !== current) return;
            setIsOwner(false);
            setLoading(false);
          });
        } else {
          if (!data?.subscriptionId) {
            stopSubscription?.();
            subscriptionId = undefined;
            setIsOwner(false);
          }
          setLoading(false);
        }
      }, () => {
        if (generation !== current) return;
        stopSubscription?.();
        setUserData(null);
        setIsOwner(false);
        setLoading(false);
      });
    });
    return () => {
      generation++;
      stopProfile?.();
      stopSubscription?.();
      unsubAuth();
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading: loading || claimsLoading, isOwner, isSiteAdmin, login, logout }}>
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
