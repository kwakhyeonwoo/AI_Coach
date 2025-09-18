// src/services/summaries.ts
export async function requestBuildSummary(sessionId: string) {
  const url = process.env.EXPO_PUBLIC_BUILD_SUMMARY_URL!;
  const res = await fetch(`${url}?sessionId=${encodeURIComponent(sessionId)}`);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.warn('[requestBuildSummary] url', url, 'sessionId', sessionId, 'status', res.status, 'body', text);
    throw new Error(`buildSummary ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}
