// 질문 흐름
import { useCallback, useMemo, useState, useRef } from 'react';
import type { QA, InterviewSettings } from '../models/types';
import { requestFirstQuestion, requestNextQuestion } from '../services/apiClient';
import { extractTagsFromQuestion } from '@/utils/extractTags';

type Options = { maxQ?: number };
type NextResult = { done?: boolean; question?: string };

function normQ(s: string) {
  return s.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
}

export function useQuestionVM(settings: InterviewSettings, opts: Options = {}) {
  const maxQ = opts.maxQ ?? 5;

  const [index, setIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const [followups, setFollowups] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  async function fetchUnique(
    fetcher: () => Promise<{ question?: string; done?: boolean }>,
    tries = 3
  ): Promise<{ question?: string; done?: boolean }> {
    for (let i = 0; i < tries; i++) {
      const res = await fetcher();
      if (!res.question) return res;
      const sig = normQ(res.question);
      if (!seenRef.current.has(sig)) {
        seenRef.current.add(sig);
        return res;
      }
      // 중복이면 루프 계속 → 다음 시도에서 새 질문 받도록
    }
    return { question: undefined };
  }

  const progress = useMemo(() => Math.min(1, (index - 1) / maxQ), [index, maxQ]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestFirstQuestion(settings, { maxQ });
      if (res.question){
        setQuestion(res.question);
        setTags(extractTagsFromQuestion(res.question, settings));
      }
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
        const res = await requestNextQuestion(settings, newHist, { maxQ }); // fetchUnique부분 추가 
        if (res.done) return { done: true };
        if (res.question) {
          setQuestion(res.question);
          setIndex(i => i + 1);
          setFollowups(0);
          setTags(extractTagsFromQuestion(res.question, settings));
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
    maxQ, index, loading, question, history, followups, progress, tags,
    // actions
    loadFirst, next, resetCurrentAnswer,
  };
}
