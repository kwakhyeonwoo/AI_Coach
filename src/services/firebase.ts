import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, type User, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, // 꼭 *.appspot.com
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const storage = getStorage(app);

// RN에서 연결 안정화
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// 🔧 RN 퍼시스턴스 모듈 없이도 실행되게: 경고만 감수(세션은 메모리 유지)
export const auth = getAuth(app);
// (옵션) 경고를 줄이고 의도를 명시: 메모리 퍼시스턴스
setPersistence(auth, inMemoryPersistence).catch(() => {});

// 익명 로그인 보장
export async function ensureAuth(): Promise<User> {
  if (!auth.currentUser) {
    const cred = await signInAnonymously(auth);
    console.log('[auth] anonymous uid:', cred.user.uid);
    return cred.user;
  }
  return auth.currentUser!;
}
