import { db } from './firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import type { InterviewSession } from '../models/types';

// ✅ 1. listenForSessions 함수가 uid를 인자로 받도록 수정합니다.
export function listenForSessions(uid: string, callback: (sessions: InterviewSession[]) => void) {
  
  // ✅ 2. 'sessions' 대신 'users/{uid}/sessions' 경로를 사용합니다.
  const q = query(collection(db, 'users', uid, 'sessions'), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const sessions: InterviewSession[] = [];
    querySnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() } as InterviewSession);
    });
    callback(sessions);
  });

  return unsubscribe;
}
