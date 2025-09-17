// functions/src/admin.ts
import {getApps, initializeApp, App} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

// 이미 초기화돼 있으면 재사용, 아니면 1회 초기화
export const adminApp: App = getApps().length ? getApps()[0] : initializeApp();
export const db = getFirestore(adminApp);
