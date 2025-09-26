import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions';
import { db } from './admin';
import { FieldValue } from 'firebase-admin/firestore';
import { SpeechClient, protos } from '@google-cloud/speech';

const speech = new SpeechClient();

export const onInterviewAudioFinalized = onObjectFinalized(
  {
    region: 'asia-northeast3',
    bucket: 'ai-interview-coach-196ec.firebasestorage.app',
    memory: '1GiB',
    concurrency: 10,
  },
  async (event) => {
    const obj = event.data;
    const name = obj.name ?? '';
    const ctype = obj.contentType ?? '';
    if (!name.startsWith('interviews/') || !ctype.startsWith('audio/')) {
      logger.debug('skip object', { name, ctype });
      return;
    }

    const md = obj.metadata || {};
    const uid = md.uid as string | undefined;
    const sessionId = md.sessionId as string | undefined;
    const questionId = md.questionId as string | undefined;
    const lang = (md.lang as string) || 'ko-KR';
    if (!uid || !sessionId || !questionId) {
      logger.warn('missing meta', { uid, sessionId, questionId, name });
      return;
    }

    const gcsUri = `gs://${obj.bucket}/${name}`;

    // ---- 인코딩/샘플레이트 결정 (WAV는 자동 감지에 맡김) ----
    let encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding| undefined;
    let sampleRateHertz: number | undefined;

    const isWav = /wav/i.test(ctype) || /\.wav$/i.test(name);
    const isMp3 = /mp3/i.test(ctype) || /\.mp3$/i.test(name);
    const isOggOpus = /(ogg|opus|webm)/i.test(ctype) || /\.(ogg|opus|webm)$/i.test(name);

    if (isWav) {
      // 👉 WAV는 헤더에서 자동 감지 (encoding/sampleRate 지정 안 함)
      encoding = protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16;
      sampleRateHertz = 16000;
    } else if (isMp3) {
      encoding = protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.MP3;
    } else if (isOggOpus) {
      // webm/ogg -> opus
      encoding = protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS;
    } else {
      // 모르면 지정하지 않음(자동 감지 시도)
      encoding = undefined;
      sampleRateHertz = undefined;
    }

    // ---- STT 호출 ----
    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
      languageCode: lang,
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
    };
    if (encoding !== undefined) config.encoding = encoding;
    if (sampleRateHertz) config.sampleRateHertz = sampleRateHertz;

    let transcript = '';
    let durationSec = 0;
    let wpm = 0;
    let fillerCount = 0;
    let fillerRatePerMin = 0;

    try {
      const [resp] = await speech.recognize({ audio: { uri: gcsUri }, config });
      const results = (resp.results ?? []) as protos.google.cloud.speech.v1.ISpeechRecognitionResult[];
      transcript = results.map(r => r.alternatives?.[0]?.transcript || '').join('\n').trim();

      const words = results.flatMap(r => r.alternatives?.[0]?.words || []) as protos.google.cloud.speech.v1.IWordInfo[];
      const last = words[words.length - 1];
      durationSec =
        last?.endTime?.seconds !== undefined
          ? Number(last.endTime.seconds) + (Number(last.endTime.nanos || 0) / 1e9)
          : Math.max(1, Math.round((transcript.split(/\s+/).length || 2) / 2));

      const totalWords = transcript.replace(/\n/g, ' ').split(/\s+/).filter(Boolean).length;
      wpm = Math.round(totalWords / (Math.max(durationSec, 1) / 60));
      const fillers = ['음', '어', '그', '그러니까', '약간', '뭔가'];
      fillerCount = fillers.reduce((acc, f) => acc + (transcript.match(new RegExp(f, 'g'))?.length || 0), 0);
      fillerRatePerMin = Math.round((fillerCount / Math.max(durationSec, 1)) * 60 * 100) / 100;

      logger.info('stt ok', { name, ctype, durationSec, wpm });
    } catch (e: any) {
      logger.error('stt failed', { name, ctype, err: e?.message });
      // 실패해도 파이프라인은 진행
      transcript = transcript || '';
      durationSec = durationSec || 0;
      wpm = wpm || 0;
    }

    // ---- QA 문서 업데이트 ----
    const qaRef = db.doc(`users/${uid}/sessions/${sessionId}/qa/${questionId}`);
    await qaRef.set({
      transcript,
      metrics: { wpm, durationSec, fillerCount, fillerRatePerMin, avgPauseSec: null, sentiment: 'neutral' },
      status: 'processed',
      processedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // ---- 세션 완료 시 summaries/{sessionId} 대기 상태로 ----
    const sessionRef = db.doc(`sessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();
    const expected = sessionSnap.get('expectedQuestions') ?? 3;
    const qaSnap = await db.collection(`users/${uid}/sessions/${sessionId}/qa`).get();
    const processedCount = qaSnap.docs.filter(d => d.get('status') === 'processed').length;

    if (processedCount >= expected) {
      await sessionRef.set({ status: 'processing', endedAt: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc(`summaries/${sessionId}`).set(
        { uid, status: 'pending', updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      logger.info('summary pending set', { sessionId });
    }
  }
);
