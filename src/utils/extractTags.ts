import type { InterviewSettings } from '../models/types';

/** 0) 불용어(질문 어미/조사/일반어) — 문제되는 것들 추가 */
const KO_STOP = new Set([
  '은','는','이','가','을','를','과','와','의','에','에서','으로','및','또는','그리고','이나','나',
  '무엇','무엇인가요','어떻게','왜','어떤','경우','방법','전략','기법','방안','고려','사용','사용하며',
  '사용하시겠습니까','설명','설명해','주세요','논의','해결','제공','구현','개선','위해','위한','때','중',
  '장단점','선택','기준','맞추기','균형','가능','가능한','정의','예시','예를','들어','대해',
  // 스샷에 나오던 것들
  '발생','발생할','발생할수','과정','과정에서','있는지','있으며','어떻게든','어떤가요'
]);

const EN_STOP = new Set([
    'the','a','an','to','of','for','in','on','at','and','or','with','by','is','are',
    'be','as','what','which','how','why','please','explain','using','use','choose','when'
])

/** 1) 도메인 사전 */
const HEADS = [
  '메모리','성능','네트워크','데이터','에러','오류','예외','이미지','캐시','동시성','CPU','요청'
];
const TAILS = [
  '누수','관리','최적화','요청','일관성','핸들링','로딩','무효화','지연','재시도','백오프','사용','제어','저하'
];
const MODS  = ['비동기','동시성','병렬','백그라운드'];

const ROLE_HINTS: Record<string, string[]> = {
  iOS: ['iOS','GCD','OperationQueue','Instruments','Leaks','ARC','SwiftUI','Combine','QoS'],
  Android: ['Android','Coroutine','Flow','Compose','WorkManager','Paging'],
  Frontend: ['React','Next.js','SSR','CSR','WebVitals','접근성'],
  Backend: ['DB','Redis','CQRS','샤딩','스케일링','트랜잭션'],
  Data: ['특징공학','모델링','정규화','평가','AUC','리콜','정밀도'],
};

/** 동의어/표기 정규화 */
function canon(s: string) {
  return s
    .replace(/오류/g, '에러')
    .replace(/캐싱/g, '캐시')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(t: string) {
  if (!t) return '';
  t = t.replace(/[()\-/_.,;:!?[\]{}'"`~]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t
    .replace(/(하기|하는|하면|하며|해야|해요|하기위해|하기 위한)$/u, '')
    .replace(/(인가요|입니까|인가|입니까\?)$/u, '')
    .replace(/^(을|를|이|가|은|는)/u, '')
    .replace(/(을|를|이|가|은|는)$/u, '');
  return t;
}

function tokenize(q: string) {
  const cleaned = q.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return cleaned.split(/\s+/).filter(Boolean);
}

export function extractTagsFromQuestion(
  q: string,
  settings: InterviewSettings,
  opts: { topK?: number } = {}
) {
  const topK = opts.topK ?? 3;

  const raw = tokenize(q);
  const tokens = raw.map(normalizeToken).filter(Boolean);

  const isStop = (t: string) => EN_STOP.has(t.toLowerCase()) || KO_STOP.has(t);

  // 2) 규칙 기반 후보 생성: [MOD] + HEAD + TAIL, 또는 HEAD + (HEAD|TAIL)
  const cand = new Map<string, number>();

  const add = (phrase: string, base = 1) => {
    let t = canon(phrase);
    if (!t || t.length < 2) return;
    const parts = t.split(' ');
    if (parts.every(p => isStop(p))) return;

    let s = base;

    // 가중치: 3gram > 2gram > unigram
    if (parts.length === 2) s += 0.8;
    if (parts.length >= 3) s += 1.1;

    // 테크 약어/카멜 우대 (iOS, GCD, OperationQueue)
    if (/[A-Z]{2,}/.test(t) || /[a-z]+[A-Z][a-z]+/.test(t)) s += 0.6;

    cand.set(t, (cand.get(t) ?? 0) + s);
  };

  // 2-1) 3-gram: MOD + HEAD + TAIL
  for (let i = 0; i < tokens.length - 2; i++) {
    const a = tokens[i], b = tokens[i + 1], c = tokens[i + 2];
    if (isStop(a) || isStop(b) || isStop(c)) continue;

    if (MODS.includes(a) && HEADS.includes(b) && TAILS.includes(c)) {
      add(`${a} ${b} ${c}`, 2.2); // ex) 비동기 네트워크 요청
    }
    // HEAD + MOD + TAIL (간혹 중간 수식)
    if (HEADS.includes(a) && MODS.includes(b) && TAILS.includes(c)) {
      add(`${a} ${b} ${c}`, 1.8);
    }
  }

  // 2-2) 2-gram: HEAD + TAIL, HEAD + HEAD
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (isStop(a) || isStop(b)) continue;

    if (HEADS.includes(a) && TAILS.includes(b)) add(`${a} ${b}`, 2.0);// 메모리 관리, 성능 최적화
    if (HEADS.includes(a) && HEADS.includes(b)) add(`${a} ${b}`, 1.6);// 데이터 일관성
    if (MODS.includes(a) && HEADS.includes(b)) add(`${a} ${b}`, 1.4);// 비동기 작업
  }

  // 2-3) 유니그램(보조): HEAD/TAIL/MOD 단독
  for (const t of tokens) {
    if (isStop(t)) continue;
    if (HEADS.includes(t) || TAILS.includes(t) || MODS.includes(t)) {
      add(t, 0.6);
    }
  }

  // 3) JD 키워드/역할 힌트 보정
  const jd = (settings.jdKeywords ?? []).map(k => k.toLowerCase());
  for (const [k, v] of cand) {
    let s = v;
    if (jd.some(j => k.toLowerCase().includes(j))) s += 1.0;
    if ((ROLE_HINTS[settings.role] ?? []).some(h => k.toLowerCase().includes(h.toLowerCase()))) s += 0.4;
    cand.set(k, s);
  }

  // 4) 정렬 + 후처리(일반어 꼬리 컷, 길이 제한)
  const sorted = [...cand.entries()]
    .filter(([t, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter(t => t.length <= 22)
    .filter(t => {
      const last = t.split(' ').slice(-1)[0];
      return !['방법','전략','기법','고려','사용','구현','개선','무엇','있는지'].includes(last);
    });

  // 5) 중복/동의어 정리 + iOS/Android 보조 태그
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of sorted) {
    const key = canon(t).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= topK) break;
  }

  if (out.length < topK) {
    if (/\biOS\b/.test(q) && !out.includes('iOS')) out.push('iOS');
    if (/\bAndroid\b/i.test(q) && !out.includes('Android')) out.push('Android');
  }

  return out.slice(0, topK);
}
