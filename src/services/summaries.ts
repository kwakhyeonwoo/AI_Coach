// src/services/summaries.ts (예시)
export async function requestBuildSummary(sessionId: string) {
  const url = process.env.EXPO_PUBLIC_BUILD_SUMMARY_URL!; // .env에 넣어두기
  const res = await fetch(`${url}?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET', // POST 써도 됨(서버 코드가 둘 다 지원)
  });
  if (!res.ok) throw new Error(`buildSummary failed: ${res.status}`);
}
