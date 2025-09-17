// src/services/uploadAudio.ts
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase'; // initializeApp 된 Firestore 인스턴스
import * as FileSystem from 'expo-file-system';

// localUri: expo-audio가 만든 파일 경로 (file://...m4a)
export async function uploadQuestionAudio(params: {
  uid: string;
  sessionId: string;
  questionId: string;
  companyId?: string;
  role?: string;
  questionText?: string;
  localUri: string; // file://...
}) {
  const { uid, sessionId, questionId, companyId = 'generic', role = 'general', questionText, localUri } = params;

  // 1) Blob 변환
  const res = await fetch(localUri);
  const blob = await res.blob();

  // 2) Storage 경로
  const storage = getStorage();
  const path = `interviews/${uid}/${sessionId}/${questionId}.m4a`;
  const storageRef = ref(storage, path);

  // 3) 업로드(메타데이터 포함)
  const task = uploadBytesResumable(storageRef, blob, {
    contentType: 'audio/m4a',
    customMetadata: { uid, sessionId, questionId, companyId, role, lang: 'ko-KR' },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      // (progress) => console.log(progress.bytesTransferred / progress.totalBytes),
      () => {},
      reject,
      () => resolve()
    );
  });

  const downloadURL = await getDownloadURL(storageRef);

  // 4) Firestore QA 문서 초기 저장 (status: uploaded)
  const qaRef = doc(db, 'sessions', sessionId, 'qa', questionId);
  await setDoc(
    qaRef,
    {
      uid,
      questionText: questionText ?? null,
      audioPath: path,
      audioUrl: downloadURL,
      status: 'uploaded',
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { path, downloadURL };
}

// 세션 생성 (처음 질문 업로드 전에 1회)
export async function ensureSessionDoc(sessionId: string, uid: string, companyId?: string, role?: string, expectedQuestions?: number) {
  await setDoc(
    doc(db, 'sessions', sessionId),
    {
      uid, companyId: companyId ?? 'generic', role: role ?? 'general',
      expectedQuestions: expectedQuestions ?? 3,
      startedAt: serverTimestamp(),
      status: 'recording',
    },
    { merge: true }
  );
}
