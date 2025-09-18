// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, // 반드시 *.appspot.com
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const auth = getAuth(app);
// 버킷을 명시적으로 고정 (오타 방지)
export const storage = getStorage(app, 'gs://' + process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!);

// ✅ 반환 타입을 User로 고정, cred.user 사용
export async function ensureAuth(): Promise<User> {
  if (!auth.currentUser) {
    const cred = await signInAnonymously(auth);
    console.log('[auth] signed in anonymously:', cred.user.uid);
    return cred.user;
  }
  console.log('[auth] already signed in:', auth.currentUser.uid);
  return auth.currentUser;
}
