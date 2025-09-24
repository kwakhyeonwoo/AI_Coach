// src/services/summarySync.ts
// summaries 컬렉션에 새 데이터 생기면 sessions 컬렉션에 정보 동기화
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export async function syncSummaryToSession(sessionId: string, summary: any) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    overallScore: summary.overallScore ?? 0,
    avgResponseTime: summary.totalQuestions
      ? Math.round(summary.totalSpeakingSec / summary.totalQuestions)
      : 0,
    updatedAt: summary.updatedAt,
  });
}
