// src/services/apiClient.ts
import type { InterviewSettings, QA, Difficulty, SummaryData } from '../models/types';

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

//Summary 요약 - 모의 데이터 추가
export async function requestSummary(sessionId: string): Promise<SummaryData> {
  await new Promise((r) => setTimeout(r, 400));
  const now = new Date();
  const started = new Date(now.getTime() - 20 * 60 * 1000);

  const res: SummaryData = {
    sessionId,
    startedAt: started.toISOString(),
    endedAt: now.toISOString(),
    overallScore: 79,
    level: 'Intermediate', // ← 리터럴 유니온에 맞게 OK
    totalQuestions: 3,
    totalSpeakingSec: 58 + 95 + 83,
    strengths: [
      '핵심 메시지를 앞에 배치해 설득력 높음',
      '기술 스택과 역할을 분리해 명료하게 설명',
      '문제 해결 과정에서 대안 제시가 구체적',
    ],
    improvements: ['성과를 수치로 정량화', 'STAR 구조의 R 강화', '예시 1개로 압축해 시간관리'],
    tips: [
      '약점 태그 위주로 10분 복습',
      '주요 프로젝트 KPI 숫자 3개 준비',
      '답변 마무리 임팩트 멘트 한 문장 추가',
    ],
    qa: [
      {
        id: 'q1',
        question: '자기소개를 간단히 해주세요.',
        answerSummary:
          '핵심 기술스택과 최근 성과를 1분 내로 구조화. 로딩 속도 35% 개선 등 수치가 포함됨.',
        score: 82,
        tags: ['커뮤니케이션', '구조화'],
        timeSec: 58,
        sentiment: 'positive',
        notes: '말 속도와 멈춤 제어가 양호.',
      },
      {
        id: 'q2',
        question: '최근 프로젝트에서 가장 어려웠던 이슈와 해결은?',
        answerSummary:
          'Functions 배포 에러를 로그/환경변수/타깃분리로 해결. 재발 방지용 사전 검증 스텝 추가.',
        score: 74,
        tags: ['문제해결', '딥다이브'],
        timeSec: 95,
        sentiment: 'neutral',
        notes: '수치화 보강 필요(오류율/배포시간).',
      },
      {
        id: 'q3',
        question: '팀 협업 갈등을 어떻게 조율했나요?',
        answerSummary:
          'API 변경 충돌 시 의사결정 로그 공유, Mock 서버로 FE 병행, 주 2회 스탠드업으로 리스크 조기 발견.',
        score: 66,
        tags: ['커뮤니케이션', '협업'],
        timeSec: 83,
        sentiment: 'neutral',
        notes: '리드타임 단축 시간 등 수치가 있으면 좋음.',
      },
    ],
  };

  return res;
}

