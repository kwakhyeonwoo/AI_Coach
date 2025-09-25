import { db } from './firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import type { InterviewSession, QA } from '../models/types';

const TEMP_UID = 'test-user-001'; // 여기서도 UID를 사용할 수 있지만, 함수 인자로 받는 것이 더 명확합니다.

// ✅ 1. createSession 함수가 uid를 인자로 받도록 수정합니다.
export async function createSession(uid: string, partialSession: Partial<InterviewSession>): Promise<string> {
  try {
    // ✅ 2. 'sessions' 컬렉션 대신 'users/{uid}/sessions' 경로를 사용합니다.
    const docRef = await addDoc(collection(db, 'users', uid, 'sessions'), {
      uid,
      ...partialSession,
      createdAt: new Date(),
      summary: null,
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw new Error('Failed to create session');
  }
}

// ✅ 3. updateSessionQa 함수가 uid를 인자로 받도록 수정합니다.
export async function updateSessionQa(uid: string, sessionId: string, qa: QA) {
  try {
    // ✅ 4. 'sessions/{sessionId}/qa' 대신 'users/{uid}/sessions/{sessionId}/qa' 경로를 사용합니다.
    const qaCollectionRef = collection(db, 'users', uid, 'sessions', sessionId, 'qa');
    await addDoc(qaCollectionRef, {
        uid,
        ...qa,
    });
  } catch (e) {
    console.error("Error updating session QA: ", e);
    throw new Error('Failed to update session QA');
  }
}

export async function updateSessionSummary(sessionId: string, summary: any) {
  // 참고: 요약 기능도 나중에 uid를 받도록 수정해야 합니다.
  const sessionRef = doc(db, 'sessions', sessionId);
  await setDoc(sessionRef, { summary }, { merge: true });
}