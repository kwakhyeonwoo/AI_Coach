// src/services/uploadAudio.ts
import { storage, db, ensureAuth } from '@/services/firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';

export async function uploadQuestionAudio(params: {
  sessionId: string;
  questionId: string;
  localUri: string;        // file://...
  companyId?: string;
  role?: string;
  questionText?: string;
}) {
  const { sessionId, questionId, localUri, companyId = 'generic', role = 'general', questionText } = params;
  const u = await ensureAuth();

  const path = `interviews/${u.uid}/${sessionId}/${questionId}.m4a`;
  const r = ref(storage, path);

  const metadata = {
    contentType: 'audio/mp4',                 // m4a는 mp4 컨테이너
    customMetadata: { uid: u.uid, sessionId, questionId, companyId, role, lang: 'ko-KR' },
  } as const;

  // --- 업로드: Blob -> 실패 시 base64 폴백 ---
  try {
    const resp = await fetch(localUri);
    if (!resp.ok) throw new Error(`fetch(${localUri}) failed: ${resp.status}`);
    const blob = await resp.blob();
    await uploadBytes(r, blob, metadata);
  } catch (err: any) {
    console.warn('[uploadQuestionAudio] blob upload failed, fallback to base64', {
      code: err?.code, msg: err?.message, srv: err?.customData?.serverResponse,
    });
    const base64 = await FileSystem.readAsStringAsync(localUri, { 
        encoding: 'base64' as any,
     });
    await uploadString(r, base64, 'base64', metadata);
  }

  const url = await getDownloadURL(r);

  // QA 문서 생성/업데이트
  await setDoc(
    doc(db, 'sessions', sessionId, 'qa', questionId),
    {
      uid: u.uid,
      questionText: questionText ?? null,
      audioPath: path,
      audioUrl: url,
      status: 'uploaded',
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log('[uploadQuestionAudio] ok', { sessionId, questionId });
  return { path, url };
}
