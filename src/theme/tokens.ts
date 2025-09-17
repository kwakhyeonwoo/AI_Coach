// src/theme/tokens.ts
import { Platform } from 'react-native';

export type Tokens = {
  gap: number; topPad: number; cardRadius: number;
  bg: string; cardBg: string; border: string;
  label: string; sub: string; good: string; warn: string; bad: string; tint: string;
};

const ios: Tokens = {
  gap: 16, topPad: 8, cardRadius: 12,
  bg: '#F2F2F7', cardBg: '#FFFFFF', border: '#E5E5EA',
  label: '#1C1C1E', sub: '#6B7280',
  good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', tint: '#0a84ff',
};

const android: Tokens = {
  gap: 16, topPad: 8, cardRadius: 12,
  bg: '#FFFBFE', cardBg: '#FFFFFF', border: '#E6E1E5',
  label: '#1D1B20', sub: '#6B7280',
  good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', tint: '#6750A4',
};

export const TOKENS: Tokens = Platform.OS === 'ios' ? ios : android;
