import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const req = (k: string) => {
  const v = process.env[k as keyof NodeJS.ProcessEnv] as string | undefined;
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

const cfg: FirebaseOptions = {
  apiKey: req('EXPO_PUBLIC_FIREBASE_API_KEY'),
  projectId: req('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  appId: req('EXPO_PUBLIC_FIREBASE_APP_ID'),
  ...(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN && { authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN }),
  ...(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET && { storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET }),
  ...(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID && { messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }),
};

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true, // ✅ RN에서 권장
});

const region = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-northeast3';
export const functions = getFunctions(app, region);

export const storage = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  ? getStorage(app)
  : (undefined as unknown as ReturnType<typeof getStorage>);