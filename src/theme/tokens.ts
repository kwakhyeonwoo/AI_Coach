// src/theme/tokens.ts
import { Platform } from 'react-native';

export type DesignTokens = {
  gap: number;
  topPad: number;
  cardRadius: number;
  bg: string;
  cardBg: string;
  border: string;
  label: string;
  sub: string;
};

const IOS: DesignTokens = {
  gap: 16,
  topPad: 8,
  cardRadius: 12,
  bg: '#F2F2F7',
  cardBg: '#FFFFFF',
  border: '#E5E5EA',
  label: '#1C1C1E',
  sub: '#6B7280',
};

const ANDROID: DesignTokens = {
  gap: 16,
  topPad: 8,
  cardRadius: 12,
  bg: '#FFFBFE',
  cardBg: '#FFFFFF',
  border: '#E6E1E5',
  label: '#1D1B20',
  sub: '#6B7280',
};

// default를 넣고 non-null 단언으로 TS 경고/런타임 undefined 방지
export const TOKENS: DesignTokens = Platform.select<DesignTokens>({
  ios: IOS,
  android: ANDROID,
  default: IOS,
})!;

export default TOKENS; // (원하면 default 임포트도 가능)
