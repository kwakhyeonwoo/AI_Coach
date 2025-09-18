// src/services/debugPing.ts
import { ensureAuth, db, storage } from '@/services/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

export async function pingFirestore() {
  const u = await ensureAuth();
  await setDoc(doc(db, 'debug', 'ping'), { uid: u.uid, ts: serverTimestamp() }, { merge: true });
  console.log('[pingFirestore] ok');
}

export async function pingStorage() {
  const u = await ensureAuth();
  const r = ref(storage, `interviews/${u.uid}/debug/ping.txt`);
  await uploadBytes(r, new Blob(['hello'], { type: 'text/plain' }), {
    customMetadata: { uid: u.uid, sessionId: 'debug', questionId: 'ping' },
  });
  console.log('[pingStorage] ok');
}
