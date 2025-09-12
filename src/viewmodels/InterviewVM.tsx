import React, { createContext, useContext, useMemo, useState } from 'react';
import type { InterviewSettings, Mode } from '../models/types';

interface VMState {
  loading: boolean;
  currentSessionId?: string;
  settings: InterviewSettings;
  setSettings: (s: Partial<InterviewSettings>) => void;
  setMode: (m: Mode) => void;
  startNewSession: () => Promise<string>; // sessionId 반환
}

const DEFAULT_SETTINGS: InterviewSettings = {
  role: 'iOS',
  language: 'ko',
  difficulty: 'intermediate',
  mode: 'free',
  company: '',
  jdText: '',
  jdKeywords: [],
};

const InterviewContext = createContext<VMState | null>(null);

export const InterviewProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [settings, setSettingsState] = useState<InterviewSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();

  const setSettings = (patch: Partial<InterviewSettings>) =>
    setSettingsState((prev) => ({ ...prev, ...patch }));

  const setMode = (m: Mode) => setSettingsState((prev) => ({ ...prev, mode: m }));

  const startNewSession = async (): Promise<string> => {
    setLoading(true);
    try {
      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setCurrentSessionId(id);
      return id;
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<VMState>(
    () => ({ loading, currentSessionId, settings, setSettings, setMode, startNewSession }),
    [loading, currentSessionId, settings]
  );

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
};

export const useInterviewVM = () => {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterviewVM must be used within InterviewProvider');
  return ctx;
};