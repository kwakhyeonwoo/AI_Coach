// src/services/sessions.ts
import { ensureAuth, db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function ensureSessionDoc(
  sessionId: string,
  companyId?: string,
  role?: string,
  expectedQuestions = 5
) {
  const u = await ensureAuth();
  await setDoc(
    doc(db, 'sessions', sessionId),
    {
      uid: u.uid,
      companyId: companyId ?? 'generic',
      role: role ?? 'general',
      expectedQuestions,
      startedAt: serverTimestamp(),
      status: 'recording',
    },
    { merge: true }
  );
  console.log('[ensureSessionDoc] ok', sessionId);
  return u.uid;
}
