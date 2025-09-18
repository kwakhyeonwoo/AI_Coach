import { onRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import { OpenAI } from 'openai';

export const buildSummary = onRequest(
  { region: 'asia-northeast3', cors: true, secrets: ['OPENAI_API_KEY'] },
  async (req, res) => {
    try {
      const sessionId =
        (req.query?.sessionId as string) ??
        (typeof req.body === 'object' ? (req.body?.sessionId as string) : undefined);
      if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }

      // 🔎 환경/경로 로그
      console.log('[buildSummary] project',
        process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
      console.log('[buildSummary] sessionId', sessionId);

      // 🔎 세션 문서 존재 확인 (오류도 잡아냄)
      const sessionRef = db.collection('sessions').doc(sessionId);
      console.log('[buildSummary] sessionRef', sessionRef.path);
      let sessionSnap;
      try {
        sessionSnap = await sessionRef.get();
      } catch (err) {
        console.error('[buildSummary] session get() failed:', err);
        throw err; // 여기서 터지면 바로 원인 확인 가능
      }
      if (!sessionSnap.exists) {
        console.error('[buildSummary] session not found:', sessionRef.path);
        res.status(404).json({ error: 'session not found' });
        return;
      }

      const { uid, companyId = 'generic', role = 'general', startedAt, endedAt } = sessionSnap.data()!;

      // 🔎 QA 수집 (먼저 정렬 없이)
      const qaCol = sessionRef.collection('qa');
      console.log('[buildSummary] qa path', qaCol.path);
      let qaSnap;
      try {
        qaSnap = await qaCol.get();
      } catch (err) {
        console.error('[buildSummary] qa get() failed:', err);
        throw err;
      }
      console.log('[buildSummary] qa count', qaSnap.size);
      const qa = qaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (qa.length === 0) {
        res.status(400).json({ error: 'no QA docs for session' });
        return;
      }

      // ← 이후 기존 점수/LLM/쓰기 로직 그대로...
      // (OpenAI 블록은 try/catch로 감싸서 실패해도 진행하도록 이전에 안내한 버전 유지)
      // ...
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[buildSummary] fatal:', e);
      res.status(500).json({ error: e?.message ?? 'failed', code: e?.code ?? null });
    }
  }
);
