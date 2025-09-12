// Callable — 질문 생성/다음 질문
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import OpenAI from 'openai';

admin.initializeApp();
setGlobalOptions({ region: 'asia-northeast3', timeoutSeconds: 60, memory: '256MiB' });

const OPENAI_KEY =
  process.env.OPENAI_API_KEY || (functions.config().openai && functions.config().openai.key);
if (!OPENAI_KEY) {
  console.warn('Missing OpenAI key. Run: firebase functions:config:set openai.key="sk-..."');
}
const openai = new OpenAI({ apiKey: OPENAI_KEY });

const MAX_QUESTIONS = 5;

type Settings = { role: string; language: 'ko' | 'en'; difficulty: 'beginner' | 'intermediate' | 'advanced' };
type QA = { q: string; a: string };

function systemFor(s: Settings) {
  const lang = s.language === 'en' ? 'English' : 'Korean';
  return `You are a senior interviewer for ${s.role}. Ask exactly one ${s.difficulty} interview question. Only return the question in ${lang}. No preface, no numbering.`;
}

async function genQuestion(settings: Settings, history: QA[]) {
  // 면접 종료 → 요약
  if (history.length >= MAX_QUESTIONS) {
    const lang = settings.language === 'en' ? 'English' : 'Korean';
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are an interview coach. Summarize the candidate performance in ${lang}. Provide 3 concise bullets and an overall score (0-100).` },
        { role: 'user', content: JSON.stringify({ settings, history }) },
      ],
      temperature: 0.4,
      max_tokens: 320,
    });
    const summary = resp.choices[0].message.content || '';
    return { done: true, summary };
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemFor(settings) },
  ];
  if (history.length) {
    messages.push({
      role: 'user',
      content:
        `Previous Q/A:\n` +
        history.map((h, i) => `${i + 1}. Q: ${h.q}\nA: ${h.a}`).join('\n\n') +
        `\nNext question:`,
    });
  } else {
    messages.push({ role: 'user', content: 'First question:' });
  }

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.6,
    max_tokens: 200,
  });
  let question = resp.choices[0].message.content?.trim() || '';
  question = question.replace(/^(\d+\.|\-|\*)\s*/, ''); // 번호/불릿 제거
  return { done: false, question };
}

export const ai_createQuestion = onCall({ region: 'asia-northeast3' }, async (req) => {
  const { settings } = (req.data || {}) as { settings: Settings };
  if (!settings) throw new Error('Missing settings');
  return genQuestion(settings, []);
});

export const ai_nextQuestion = onCall({ region: 'asia-northeast3' }, async (req) => {
  const { settings, history } = (req.data || {}) as { settings: Settings; history: QA[] };
  if (!settings) throw new Error('Missing settings');
  return genQuestion(settings, Array.isArray(history) ? history : []);
});
