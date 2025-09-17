export type Language = 'ko' | 'en';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Mode = 'free' | 'pro';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type InterviewLevel = 'Beginner' | 'Intermediate' | 'Advanced';


export type QAFeedback = {
  id: string;
  question: string;
  answerSummary: string;
  score: number;
  tags: string[];
  timeSec: number;
  sentiment: Sentiment;
  notes?: string;
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
  SessionDetail: { sessionId: string } | undefined;
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
  settings: InterviewSettings;
  status: 'active' | 'completed' | 'aborted';
  createdAt: number; // Date.now()
  updatedAt: number; // Date.now()
}

export interface QA { q: string; a: string }