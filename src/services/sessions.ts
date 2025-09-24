// services/sessions.ts
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, ensureAuth } from "@/services/firebase";

export async function ensureSessionDoc(
  sessionId: string,
  companyId: string,
  role: string,
  expectedQuestions: number
) {
  const u = await ensureAuth();
  const ref = doc(db, "sessions", sessionId);

  await setDoc(
    ref,
    {
      uid: u.uid,  // ✅ 로그인한 계정 UID 넣기
      companyId,
      role,
      expectedQuestions,
      startedAt: serverTimestamp(),
      overallScore: 0,
      avgResponseTime: 0,
    },
    { merge: true }
  );

  return ref;
}
