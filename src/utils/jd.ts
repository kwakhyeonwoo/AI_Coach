// src/utils/jd.ts
// JD URL/텍스트 → {text, keywords} 로 변환

import { getFunctions, httpsCallable } from 'firebase/functions'; // ✅ Firebase Functions import 추가
import type { JDRole, JDExtractOptions } from '@/models/types'; // ✅ 타입 경로 수정 (프로젝트에 맞게)

// Expo에서 .env에 넣어두면 빌드 타임에 주입됨
// EX) EXPO_PUBLIC_JD_SCRAPE_URL=https://asia-northeast3-<project-id>.cloudfunctions.net/jdScrape
const ENV_ENDPOINT = process.env.EXPO_PUBLIC_JD_SCRAPE_URL;

const URL_RE = /^https?:\/\//i;
const DEFAULT_TOPK = 12;

async function extractKeywordsViaCloudFunction(
  url: string,
  sessionId: string // Home.tsx에서 세션 ID를 전달받습니다.
): Promise<{ text: string; keywords: string[] }> {
  
  const functions = getFunctions(undefined, "asia-northeast3");
  const parseJd = httpsCallable(functions, 'parseJdFromUrl');

  try {
    const result = await parseJd({ url, sessionId });
    const data = result.data as { success: boolean; keywords: string[] };

    if (data.success) {
      return { text: url, keywords: data.keywords || [] };
    } else {
      throw new Error("Cloud Function returned success: false.");
    }
  } catch (error) {
    console.error("Error calling parseJdFromUrl function:", error);
    throw new Error("URL에서 키워드를 추출하는 데 실패했습니다.");
  }
}

// 불용어(한/영)
const KO_STOP = new Set([
  "은","는","이","가","을","를","과","와","의","에","에서","으로","및","또는","그리고","이나","나",
  "및","등","등의","또한","대한","대해","위해","위한","기반","경우","관련","관련된","수","수준",
  "사용","사용하여","사용하고","선택","선정","필요","필요한","필수","가능","가능한","해결","개선",
  "정의","설명","예시","예를","들어","때","중","하면","하며","하기","구현","제공","고려","방법",
  "전략","기법","장단점","무엇","무엇인가요","어떻게","왜","어떤","기준"
]);
const EN_STOP = new Set([
  "the","a","an","to","of","for","in","on","at","and","or","with","by","is","are","be","as",
  "what","which","how","why","please","explain","using","use","select","choose","when"
]);

// 도메인 힌트 (가중치 ↑)
const ROLE_HINTS: Record<JDRole, string[]> = {
  iOS: ["iOS","Swift","SwiftUI","UIKit","Combine","GCD","OperationQueue","Instruments","ARC","Leaks","메모리","동시성","성능","QoS"],
  Android: ["Android","Kotlin","Coroutine","Flow","Compose","WorkManager","Paging","메모리","성능"],
  Frontend: ["React","Next.js","SSR","CSR","WebVitals","Accessibility","Performance","Cache"],
  Backend: ["Spring","Node","Nest","DB","SQL","NoSQL","Redis","Kafka","CQRS","샤딩","트랜잭션","지연","캐시","스케일링"],
  Data: ["Python","Pandas","Spark","Feature","모델","정규화","AUC","Recall","Precision","F1"]
};

// 코어 토큰/구 (가중치 ↑)
const CORE_TOKENS = [
  "메모리","누수","성능","최적화","지연","지속","네트워크","요청","응답","데이터","일관성","무결성",
  "에러","오류","예외","재시도","백오프","캐시","동시성","스레드","큐","스케줄링","보안","인증","권한",
  "CPU","IO","Latency","Throughput"
];
const CORE_PHRASES = [
  "메모리 누수","성능 최적화","네트워크 요청","데이터 일관성","에러 핸들링",
  "이미지 로딩","캐시 무효화","동시성 제어","백오프 재시도"
];

const isStop = (t: string) => EN_STOP.has(t.toLowerCase()) || KO_STOP.has(t);

// ───────── 네트워크 ─────────
export async function fetchJdText(url: string, endpoint?: string, timeoutMs = 12000): Promise<string> {
  const fn = endpoint || ENV_ENDPOINT;
  if (!fn) throw new Error("JD scrape endpoint not configured (EXPO_PUBLIC_JD_SCRAPE_URL).");

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${fn}?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`scrape failed (${res.status})`);
    const json = await res.json();
    return String(json?.text || "");
  } finally {
    clearTimeout(id);
  }
}

// ───────── 텍스트 → 키워드 ─────────
export function extractKeywordsFromJD(text: string, role: JDRole, topK = DEFAULT_TOPK): string[] {
  if (!text) return [];

  // 전처리
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()\[\]{}'`"“”‘’,.?!;:/\\|<>~*_+=\-]/g, " ")
    .replace(/\d+(\.\d+)?%?/g, " ") // 숫자/버전 제거
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // n-gram 점수
  type Score = Record<string, number>;
  const score: Score = {};

  const add = (phrase: string, inc = 1) => {
    const p = phrase.trim();
    if (!p || p.length < 2) return;
    if (/^\d+$/.test(p)) return;

    const parts = p.split(" ");
    if (parts.every(isStop)) return;
    if (isStop(p)) return;

    let s = inc;
    const lower = p.toLowerCase();

    if (parts.length === 2) s += 0.6;
    if (parts.length >= 3) s += 0.8;

    if (CORE_PHRASES.some((c) => lower.includes(c.toLowerCase()))) s += 1.2;
    s += parts.filter((x) => CORE_TOKENS.includes(x)).length * 0.5;

    // 도메인 힌트 보정
    const hints = ROLE_HINTS[role] ?? [];
    if (hints.some((h) => p.toLowerCase().includes(h.toLowerCase()))) s += 0.6;

    score[p] = (score[p] ?? 0) + s;
  };

  // unigram
  for (const t of tokens) if (!isStop(t)) add(t, 0.8);

  // bi / tri-gram
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i], b = tokens[i + 1], c = tokens[i + 2];
    if (a && b && !isStop(a) && !isStop(b)) add(`${a} ${b}`, 1.2);
    if (a && b && c && !isStop(a) && !isStop(b) && !isStop(c)) add(`${a} ${b} ${c}`, 1.4);
  }

  const alias = (t: string) =>
    t.replace(/오류/g, "에러").replace(/\s+/g, " ").toLowerCase();

  const sorted = Object.entries(score)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .filter((k) => k.length <= 24);

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const k of sorted) {
    const key = alias(k);
    if (seen.has(key)) continue;
    // 너무 일반적인 꼬리말 컷
    if (/^(방법|전략|기법|고려|사용|구현|제공|개선|무엇|있음|가능)$/.test(k)) continue;
    seen.add(key);
    uniq.push(k);
    if (uniq.length >= topK) break;
  }
  return uniq;
}

export async function resolveAndExtractJD(
  input: string,
  role: JDRole,
  sessionId: string, // ✅ Home.tsx에서 세션 ID를 받습니다.
  opts: JDExtractOptions = {}
): Promise<{ text: string; keywords: string[] }> {
  
  const text = (input || "").trim();

  if (URL_RE.test(text)) {
    // URL이면 Cloud Function 호출
    return await extractKeywordsViaCloudFunction(text, sessionId);
  } else {
    // 텍스트이면 기존 로직 사용
    const keywords = extractKeywordsFromJD(text, role, opts.topK);
    return { text, keywords };
  }
}