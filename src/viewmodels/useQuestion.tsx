// src/viewmodels/useQuestionVM.ts
import { useCallback, useMemo, useState } from 'react';
import type { QA, InterviewSettings } from '../models/types';
import { requestFirstQuestion, requestNextQuestion } from '../services/apiClient';

type Options = { maxQ?: number };
type NextResult = { done?: boolean; question?: string };

export function useQuestionVM(settings: InterviewSettings, opts: Options = {}) {
  const maxQ = opts.maxQ ?? 5;

  const [index, setIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const [followups, setFollowups] = useState(0);

  const progress = useMemo(() => Math.min(1, (index - 1) / maxQ), [index, maxQ]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestFirstQuestion(settings, { maxQ });
      if (res.question) setQuestion(res.question);
    } finally {
      setLoading(false);
    }
  }, [settings, maxQ]);

  const next = useCallback(
    async (answerText: string | undefined): Promise<NextResult> => {
      const newHist = [...history, { q: question, a: answerText ?? '(no audio)' }];
      setHistory(newHist);
      setLoading(true);
      try {
        const res = await requestNextQuestion(settings, newHist, { maxQ });
        if (res.done) return { done: true };
        if (res.question) {
          setQuestion(res.question);
          setIndex(i => i + 1);
          setFollowups(0);
          return { question: res.question };
        }
        return {};
      } finally {
        setLoading(false);
      }
    },
    [history, question, settings, maxQ],
  );

  const resetCurrentAnswer = useCallback(() => {
    setFollowups(0);
  }, []);

  return {
    // state
    maxQ, index, loading, question, history, followups, progress,
    // actions
    loadFirst, next, resetCurrentAnswer,
  };
}
