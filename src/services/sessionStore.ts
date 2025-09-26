import { db } from './firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import type { InterviewSession, QA } from '../models/types';

const TEMP_UID = 'test-user-001';

// ✅ 세션 생성 (users/{uid}/sessions)
export async function createSession(uid: string, partialSession: Partial<InterviewSession>): Promise<string> {
  try {
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

// ✅ QA 업데이트 (users/{uid}/sessions/{sessionId}/qa)
export async function updateSessionQa(uid: string = TEMP_UID, sessionId: string, qa: QA) {
  try {
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

// ✅ 요약 업데이트도 users/{uid}/sessions/{sessionId} 경로로
export async function updateSessionSummary(uid: string = TEMP_UID, sessionId: string, summary: any) {
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  await setDoc(sessionRef, { summary }, { merge: true });
}
