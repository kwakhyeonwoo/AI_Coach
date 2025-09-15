// src/services/apiClient.ts
import type { InterviewSettings, QA, Difficulty } from '../models/types';

type ServerDifficulty = 'junior' | 'mid' | 'senior';

function toServerDifficulty(d?: Difficulty): ServerDifficulty {
  switch (d) {
    case 'beginner':
      return 'junior';
    case 'intermediate':
      return 'mid';
    case 'advanced':
      return 'senior';
    default:
      return 'mid';
  }
}

const CLOUD_FN_URL =
  'https://asia-northeast3-ai-interview-coach-196ec.cloudfunctions.net/interviewQuestion';

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return (await resp.json()) as T;
}

/** 첫 질문 요청 — maxQ는 옵션(기본 5) */
export async function requestFirstQuestion(
  settings: InterviewSettings,
  opts?: { maxQ?: number }
) {
  const maxQ = opts?.maxQ ?? 5;
  return postJSON<{ question: string | null; done: boolean }>(CLOUD_FN_URL, {
    role: settings.role,
    history: [],
    maxQ,
    difficulty: toServerDifficulty(settings.difficulty),
  });
}

/** 다음 질문 요청 — maxQ는 옵션(기본 5) */
export async function requestNextQuestion(
  settings: InterviewSettings,
  history: QA[],
  opts?: { maxQ?: number }
) {
  const maxQ = opts?.maxQ ?? 5;
  return postJSON<{ question: string | null; done: boolean }>(CLOUD_FN_URL, {
    role: settings.role,
    history,
    maxQ,
    difficulty: toServerDifficulty(settings.difficulty),
  });
}
