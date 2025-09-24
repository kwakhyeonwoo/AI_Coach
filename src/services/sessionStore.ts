// src/services/sessionStore.ts
import { db, TEMP_UID } from '@/services/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * 새 세션 생성
 */
export async function createSession(companyId: string, role: string) {
  const sessionId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // 🔑 여기서 users/{TEMP_UID}/sessions/{sessionId} 경로에 문서가 생성됨
  const ref = doc(db, "users", TEMP_UID, "sessions", sessionId);

  await setDoc(ref, {
    companyId,
    role,
    uid: TEMP_UID,
    startedAt: new Date(),
    status: "processing",
    overallScore: 0,
    avgResponseTime: 0,
    updatedAt: new Date(),
  });

  return sessionId;
}


/**
 * summaries → sessions 동기화
 */
export async function syncSummaryToSession(sessionId: string, summary: any) {
  const ref = doc(db, 'users', TEMP_UID, 'sessions', sessionId);

  await updateDoc(ref, {
    overallScore: summary.overallScore ?? 0,
    avgResponseTime: summary.totalQuestions
      ? Math.round(summary.totalSpeakingSec / summary.totalQuestions)
      : 0,
    updatedAt: summary.updatedAt ?? new Date(),
  });
}
