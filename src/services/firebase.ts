import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type User,
  signInAnonymously,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

export const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const storage = getStorage(app);
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// ✅ Auth: 이미 초기화된 경우 재사용
let authInstance;
try {
  authInstance = getAuth(app);
} catch (e) {
  // getAuth 실패하면 initializeAuth 시도
}

export const auth = authInstance ?? initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// ⚠️ 익명 로그인은 필요 시에만
export async function ensureAuth(): Promise<User> {
  if (!auth.currentUser) {
    const cred = await signInAnonymously(auth);
    console.log('[auth] anonymous uid:', cred.user.uid);
    return cred.user;
  }
  return auth.currentUser!;
}


declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: any): any;
}
