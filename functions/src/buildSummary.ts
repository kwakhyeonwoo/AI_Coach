// functions/src/buildSummary.ts
import {onRequest} from 'firebase-functions/v2/https';
import {db} from './admin';
import {OpenAI} from 'openai';

export const buildSummary = onRequest(
  {
    region: 'asia-northeast3',
    cors: true,
    // v2: 런타임에 OPENAI_API_KEY를 env로 주입하려면 반드시 secrets 지정
    secrets: ['OPENAI_API_KEY'],
  },
  async (req, res) => {
    try {
      // https 호출 방식 혼용 지원 (HTTP 쿼리 or POST body)
      const sessionId =
        (req.query?.sessionId as string) ??
        (typeof req.body === 'object' ? (req.body?.sessionId as string) : undefined);

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId required' });
        return;
      }

      // 🔑 핸들러 내부에서 지연 생성 (분석/빌드 시점 안전)
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY missing (server secret)' });
        return;
      }
      const openai = new OpenAI({apiKey});

      // --- Firestore 읽기 ---
      const sessionRef = db.doc(`sessions/${sessionId}`);
      const session = await sessionRef.get();
      if (!session.exists) {
        res.status(404).json({error: 'session not found'});
        return;
      }
      const {uid, companyId = 'generic', role = 'general', startedAt, endedAt} = session.data()!;

      const qaSnap = await db
        .collection(`sessions/${sessionId}/qa`)
        .orderBy('createdAt')
        .get();
      const qa = qaSnap.docs.map((d) => ({id: d.id, ...d.data()}));

      // --- 루브릭 로드 ---
      const rubricSnap = await db.doc(`companyRubrics/${companyId}`).get();
      const weights =
        (rubricSnap.exists && rubricSnap.get('weights')) || {
          communication: 1,
          structure: 1,
          problemSolving: 1,
          leadership: 0.5,
          quantification: 1,
          cultureFit: 0.5,
        };

      // --- 문항별 스코어 임시 산출 ---
      const perQ = qa.map((q: any) => {
        const {metrics = {}, transcript = ''} = q;
        const base = 70;
        const quantBoost = /\d+%|\d+개|초|분|시간|증가|감소/.test(transcript) ? 10 : 0;
        const fillerPenalty = Math.min(10, (metrics.fillerRatePerMin || 0) * 2);
        const wpmPenalty = metrics.wpm && (metrics.wpm < 90 || metrics.wpm > 170) ? 5 : 0;
        const score = Math.max(0, Math.min(100, base + quantBoost - fillerPenalty - wpmPenalty));
        return {
          id: q.id,
          question: q.questionText ?? '',
          answerSummary: summarizeLine(transcript),
          score,
          timeSec: Math.round(metrics.durationSec || 0),
          tags: inferTags(q),
        };
      });

      const overall =
        Math.round(perQ.reduce((a, b) => a + b.score, 0) / Math.max(1, perQ.length)) || 0;
      const level = overall >= 80 ? 'Advanced' : overall >= 60 ? 'Intermediate' : 'Beginner';

      // --- LLM 피드백 생성 ---
      const prompt = buildLLMPrompt({
        role,
        weights,
        qa: qa.map((q: any, i: number) => ({idx: i + 1, transcript: q.transcript || ''})),
      });

      const llm = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {role: 'system', content: 'You are a concise Korean interview coach. Output JSON only.'},
          {role: 'user', content: prompt},
        ],
      });

      const parsed =
        safeJson(llm.choices?.[0]?.message?.content) ?? {
          strengths: [],
          improvements: [],
          tips: [],
        };

      const summaryDoc = {
        uid,
        companyId,
        role,
        startedAt: startedAt ?? null,
        endedAt: endedAt ?? null,
        overallScore: overall,
        level,
        totalQuestions: perQ.length,
        totalSpeakingSec: perQ.reduce((a, b) => a + (b.timeSec || 0), 0),
        strengths: parsed.strengths,
        improvements: parsed.improvements,
        tips: parsed.tips,
        qa: perQ,
        status: 'ready',
        updatedAt: new Date(),
      };

      await db.doc(`summaries/${sessionId}`).set(summaryDoc, { merge: true });
      await sessionRef.set({status: 'ready'}, {merge: true});

      res.json({ ok: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({error: e?.message ?? 'failed'});
    }
  }
);

// --- helpers ---
function summarizeLine(s: string) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > 120 ? t.slice(0, 118) + '…' : t;
}
function inferTags(q: any): string[] {
  const tags = new Set<string>();
  const t: string = q.transcript || '';
  if (/\d+%|\d+개|증가|감소|단축|향상/.test(t)) tags.add('정량화');
  if (/문제|원인|해결|대안/.test(t)) tags.add('문제해결');
  if (/협업|커뮤니케이션|조율/.test(t)) tags.add('커뮤니케이션');
  return Array.from(tags);
}
function buildLLMPrompt({ role, weights, qa }: any) {
  return (
    JSON.stringify({ role, weights, qa }, null, 2) +
    `
분석 기준:
- 한국어. 항목은 strengths(3~5), improvements(3~5), tips(3).
- weights를 반영해 강조/약점 선택.
- 중복 피드백 금지. 간결·실행가능 문장으로.

반환(JSON만):
{ "strengths": [...], "improvements": [...], "tips": [...] }`
  );
}
function safeJson(s?: string | null) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
