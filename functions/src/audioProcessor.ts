// functions/src/audioProcessor.ts (Gen2)
import {onObjectFinalized} from 'firebase-functions/v2/storage';
import {db} from './admin';
import {SpeechClient, protos} from '@google-cloud/speech';
import { Timestamp } from 'firebase-admin/firestore';

const speech = new SpeechClient();

export const onInterviewAudioFinalized = onObjectFinalized(
  {region: 'asia-northeast3', memory: '1GiB', concurrency: 10},
  async (event) => {
    const object = event.data;
    const bucket = object.bucket;
    const name = object.name; // interviews/{uid}/{sessionId}/{questionId}.m4a
    const contentType = object.contentType || '';

    // 1) 관심 경로/타입만 처리
    if (!name?.startsWith('interviews/') || !contentType.startsWith('audio/')) return;

    // 2) 메타데이터/경로 파싱
    const meta = object.metadata || {};
    const uid = meta.uid;
    const sessionId = meta.sessionId;
    const questionId = meta.questionId;
    const companyId = meta.companyId || 'generic';
    const role = meta.role || 'general';
    const lang = meta.lang || 'ko-KR';

    if (!uid || !sessionId || !questionId) return;

    // 3) 전사(STT)
    const gcsUri = `gs://${bucket}/${name}`;
    const [resp] = await speech.recognize({
      audio: { uri: gcsUri },
      config: {
        languageCode: lang,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        // 모델/샘플레이트/인증 등 상세옵션은 프로젝트 환경 맞게 조정
      },
    });

    const results = (resp.results ?? []) as protos.google.cloud.speech.v1.ISpeechRecognitionResult[];
    const transcript = results
        .map((r: protos.google.cloud.speech.v1.ISpeechRecognitionResult) =>
            r.alternatives?.[0]?.transcript || ''
        )
        .join('\n')
        .trim();

    // 4) 타임스탬프 기반 지표 산출
    const words = results.flatMap(
        (r: protos.google.cloud.speech.v1.ISpeechRecognitionResult) =>
            (r.alternatives?.[0]?.words || [])
    ) as protos.google.cloud.speech.v1.IWordInfo[];
    // durationSec: 마지막 단어 endTime 사용
    const last = words[words.length - 1];
    const durationSec =
      last?.endTime?.seconds !== undefined
        ? Number(last.endTime.seconds) + (Number(last.endTime.nanos || 0) / 1e9)
        : Math.max(1, Math.round((transcript.split(/\s+/).length / 2))); // fallback 대략치

    const totalWords = transcript.replace(/\n/g, ' ').split(/\s+/).filter(Boolean).length;
    const wpm = Math.round(totalWords / (Math.max(durationSec, 1) / 60));

    // 간단한 filler 추정(한국어 말버릇 토큰)
    const fillers = ['음', '어', '그', '그러니까', '약간', '뭔가'];
    const fillerCount = fillers.reduce((acc, f) => acc + (transcript.match(new RegExp(f, 'g'))?.length || 0), 0);
    const fillerRatePerMin = Math.round((fillerCount / Math.max(durationSec, 1)) * 60 * 100) / 100;

    // 아주 단순한 sentiment (임시)
    const sentiment: 'positive'|'neutral'|'negative' = 'neutral';

    // 5) QA 문서 업데이트
    const qaRef = db.doc(`sessions/${sessionId}/qa/${questionId}`);
    await qaRef.set({
      transcript,
      metrics: {
        wpm, durationSec, fillerCount, fillerRatePerMin, avgPauseSec: null, sentiment,
      },
      status: 'processed',
      processedAt: Timestamp.now(),
    }, { merge: true });

    // 6) 세션 상태 체크 → 모든 QA 처리 끝나면 요약 생성 큐(플래그) 세팅
    const sessionRef = db.doc(`sessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    const expected = sessionSnap.get('expectedQuestions') ?? 3;

    const qaSnap = await db.collection(`sessions/${sessionId}/qa`).get();
    const processedCount = qaSnap.docs.filter(d => d.get('status') === 'processed').length;

    if (processedCount >= expected) {
      await sessionRef.set({status: 'processing', endedAt: Timestamp.now()}, {merge: true});
      // 요약 생성은 별도 HTTP/Task 함수에서 수행 (아래 5번)
      await db.doc(`summaries/${sessionId}`).set({uid, companyId, role, status: 'pending'}, {merge: true});
    }
  }
);
