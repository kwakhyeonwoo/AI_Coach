import React, { createContext, useContext, useMemo, useState } from 'react';
import type { InterviewSession, InterviewSettings, Mode, QA } from '../models/types';
// ⭐️ 1. 경로 별칭(@/)을 상대 경로(../)로 수정합니다.
import { createSession, updateSessionQa } from '../services/sessionStore';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '@/services/firebase';

const TEMP_UID = 'test-user-001';

interface VMState {
  loading: boolean;
  currentSessionId?: string;
  settings: InterviewSettings;
  setSettings: (s: Partial<InterviewSettings>) => void;
  setMode: (m: Mode) => void;
  startNewSession: () => Promise<string>;
  saveQa: (qa: QA) => Promise<void>;
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
      const partialSession: Partial<InterviewSession> = {
        uid: auth.currentUser?.uid,
        companyId: settings.company || "generic",
        role: settings.role || "general",
        status: "active",
        settings,
        startedAt: new Date(),         // 로컬 Date 저장 (혹은 serverTimestamp())
        createdAt: serverTimestamp(),  // Firestore 서버 시간
        updatedAt: serverTimestamp(),  // Firestore 서버 시간
      };

      const newSessionId = await createSession(TEMP_UID, partialSession);
      setCurrentSessionId(newSessionId);
      return newSessionId;
    } catch (error) {
        console.error("Failed to start new session in Firestore:", error);
        throw error;
    } finally {
      setLoading(false);
    }
  };

  const saveQa = async (qa: QA) => {
    if (!currentSessionId) {
        console.error("Cannot save QA without a current session ID.");
        return;
    }
    try {
        await updateSessionQa(TEMP_UID, currentSessionId, qa);
    } catch (error) {
        console.error("Failed to save QA to Firestore:", error);
        throw error;
    }
  };

  const value = useMemo<VMState>(
    () => ({ loading, currentSessionId, settings, setSettings, setMode, startNewSession, saveQa }),
    [loading, currentSessionId, settings]
  );

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
};

export const useInterviewVM = () => {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterviewVM must be used within InterviewProvider');
  return ctx;
};