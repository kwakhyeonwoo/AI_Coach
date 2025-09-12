import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { InterviewSettings, QA } from '../models/types';

export interface QuestionRes { question?: string; done?: boolean; summary?: string }

export async function requestFirstQuestion(settings: InterviewSettings): Promise<QuestionRes> {
  const call = httpsCallable(functions, 'ai_createQuestion');
  const res = await call({ settings });
  return res.data as QuestionRes;
}

export async function requestNextQuestion(settings: InterviewSettings, history: QA[]): Promise<QuestionRes> {
  const call = httpsCallable(functions, 'ai_nextQuestion');
  const res = await call({ settings, history });
  return res.data as QuestionRes;
}