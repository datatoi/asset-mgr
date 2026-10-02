import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { HolderHistoryEntry, Item, ItemComment } from '../types/models';

export function useItemActivity(id?: string) {
  const [state, setState] = useState<{ id?: string; item: Item | null; loading: boolean; error?: string }>({ item: null, loading: true });
  const [comments, setComments] = useState<{ id?: string; rows: ItemComment[]; error?: string }>({ rows: [] });
  const [history, setHistory] = useState<{ id?: string; rows: HolderHistoryEntry[]; error?: string }>({ rows: [] });
  useEffect(() => {
    if (!id) return;
    const stopItem = onSnapshot(doc(db, 'items', id), snapshot => setState({ id, item: snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Item : null, loading: false, error: snapshot.exists() ? undefined : 'Item not found' }), error => setState({ id, item: null, loading: false, error: error.message }));
    const stopComments = onSnapshot(query(collection(db, 'items', id, 'comments'), orderBy('timestamp', 'desc')), snapshot => setComments({ id, rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ItemComment)) }), error => setComments({ id, rows: [], error: error.message }));
    const stopHistory = onSnapshot(query(collection(db, 'items', id, 'holderHistory'), orderBy('transferDate', 'desc')), snapshot => setHistory({ id, rows: snapshot.docs.map(d => ({ ...d.data(), id: d.id } as HolderHistoryEntry)) }), error => setHistory({ id, rows: [], error: error.message }));
    return () => { stopItem(); stopComments(); stopHistory(); };
  }, [id]);
  return {
    item: state.id === id ? state.item : null,
    loading: state.id !== id || state.loading,
    error: state.id === id ? state.error : undefined,
    comments: comments.id === id ? comments.rows : [],
    commentsError: comments.id === id ? comments.error : undefined,
    history: history.id === id ? history.rows : [],
    historyError: history.id === id ? history.error : undefined,
  };
}
