import { Timestamp, FieldValue } from "firebase/firestore";

export type Language = 'ko' | 'en';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Mode = 'free' | 'pro';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type InterviewLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type JDRole = "iOS" | "Android" | "Frontend" | "Backend" | "Data";

export type JDExtractOptions = {
  endpoint?: string;   // Functions URL (없으면 환경변수 사용)
  topK?: number;       // 키워드 최대 개수
  timeoutMs?: number;  // 네트워크 타임아웃
};

export type QAFeedback = {
  id: string;
  questionText: string; // buildSummary에서 questionText로 통일했습니다.
  answerSummary: string;
  score: number;
  tags: string[];
  sentiment: Sentiment;
  // --- UI 구현을 위해 추가된 필드 ---
  modelAnswer?: string; // 모범 답안
  followUpQuestions?: string[]; // 팔로업 제안 질문
  timeSec: number; // 답변 시간 (초)
};

export type SummaryData = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  overallScore: number;
  level: InterviewLevel;
  totalQuestions: number;
  totalSpeakingSec: number;
  strengths: string[];
  improvements: string[];
  tips: string[];
  qa: QAFeedback[];
};

export type RootStackParamList = {
  Home: undefined;
  Question: { sessionId: string } | undefined;
  Result: { sessionId: string; index: number } | undefined; // 한 문항 결과
  Summary: { sessionId: string } | undefined; // 세트 요약
  History: undefined;
  SessionDetail: { sessionId: string };
  Settings: undefined;
  Feedback: { sessionId: string } | undefined;
  ProUpsell: undefined;
};

export interface InterviewSettings {
  role: string; // ex) iOS, Android, Frontend, Backend, Data, etc
  language: Language;
  difficulty: Difficulty;
  mode: Mode; // free | pro
  company?: string; // 회사명(선택)
  jdText?: string;  // Pro에서만 사용
  jdKeywords?: string[]; // 추출 키워드
}

export interface InterviewSession {
  id: string;
  uid?: string | null;
  companyId: string;
  role: string;
  status: 'active' | 'completed' | 'aborted';
  settings: InterviewSettings;
  startedAt: Date | Timestamp;
  createdAt: Date | Timestamp | FieldValue;
  updatedAt: Date | Timestamp | FieldValue;
  avgResponseTime?: number;
  overallScore?: number | null;
  expectedQuestions?: number;
}

export interface QA { q: string; a: string }