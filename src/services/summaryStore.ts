// src/services/summaryStore.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';

export function watchSummary(sessionId: string, cb: (snap: any) => void) {
  const ref = doc(db, 'summaries', sessionId);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}
