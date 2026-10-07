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
  subscriptionOwnerId: string | null;
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
  const [subscriptionOwnerId, setSubscriptionOwnerId] = useState<string | null>(null);

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    let stopSubscription: (() => void) | undefined;
    let generation = 0;
    let claimsGeneration = 0;
    let sessionUid: string | null | undefined;
    const unsubAuth = onIdTokenChanged(auth, (u) => {
      const nextUid = u?.uid || null;
      const sameUser = sessionUid === nextUid;
      const claimVersion = ++claimsGeneration;
      setUser(u);
      if (u) void getIdTokenResult(u).then(result => {
        if (claimsGeneration === claimVersion) setIsSiteAdmin(result.claims.siteAdmin === true);
      }).catch(() => {
        if (claimsGeneration === claimVersion) setIsSiteAdmin(false);
      }).finally(() => {
        if (claimsGeneration === claimVersion) setClaimsLoading(false);
      });
      // Refresh credentials/claims without unmounting same-user pages and drafts.
      if (sameUser) return;
      sessionUid = nextUid;
      const current = ++generation;
      stopProfile?.();
      stopSubscription?.();
      stopProfile = undefined;
      stopSubscription = undefined;
      setUserData(null);
      setSubscriptionOwnerId(null);
      setIsOwner(false);
      setLoading(!!u);
      setIsSiteAdmin(false);
      setClaimsLoading(!!u);
      if (!u) return;
      let subscriptionId: string | undefined;
      stopProfile = onSnapshot(doc(db, 'users', u.uid), (snap) => {
        if (generation !== current) return;
        const data = snap.data();
        setUserData(data ? { ...data, id: snap.id } as UserProfile : null);
        if (data?.subscriptionId && data.subscriptionId !== subscriptionId) {
          stopSubscription?.();
          subscriptionId = data.subscriptionId;
          setSubscriptionOwnerId(null);
          setIsOwner(false);
          stopSubscription = onSnapshot(doc(db, 'subscriptions', data.subscriptionId), (sub) => {
            if (generation !== current) return;
            const ownerId = sub.data()?.ownerUserId || null;
            setSubscriptionOwnerId(ownerId);
            setIsOwner(ownerId === u.uid);
            setLoading(false);
          }, () => {
            if (generation !== current) return;
            setIsOwner(false);
            setSubscriptionOwnerId(null);
            setLoading(false);
          });
        } else {
          if (!data?.subscriptionId) {
            stopSubscription?.();
            subscriptionId = undefined;
            setSubscriptionOwnerId(null);
            setIsOwner(false);
          }
          setLoading(false);
        }
      }, () => {
        if (generation !== current) return;
        stopSubscription?.();
        setUserData(null);
        setSubscriptionOwnerId(null);
        setIsOwner(false);
        setLoading(false);
      });
    });
    return () => {
      generation++;
      claimsGeneration++;
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
    <AuthContext.Provider value={{ user, userData, loading: loading || claimsLoading, isOwner, isSiteAdmin, subscriptionOwnerId, login, logout }}>
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
