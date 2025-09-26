// src/screens/LoginScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!;
const EXPO_PROJECT = '@kwakhyeonwoo/ai-interview-coach';
const REDIRECT_URI = `https://auth.expo.io/${EXPO_PROJECT}`;

console.log('WEB_CLIENT_ID =', WEB_CLIENT_ID);
console.log('REDIRECT_URI  =', REDIRECT_URI);

export default function LoginScreen({ navigation }: any) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: WEB_CLIENT_ID,      // ✅ 반드시 '웹' 클라이언트 ID
    iosClientId: IOS_CLIENT_ID,   // (EAS iOS 빌드 대비)
    redirectUri: REDIRECT_URI,    // ✅ 프록시 URL을 하드코딩
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.authentication?.idToken ?? (response.params as any)?.id_token;
      if (!idToken) return;

      const cred = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, cred)
        .then(() => navigation.replace('Home'))
        .catch((e) => console.warn('Firebase 로그인 실패:', e));
    }
  }, [response, navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ marginBottom: 12 }}>Google 계정으로 로그인</Text>
      <Button
        title="Google 로그인"
        disabled={!request}
        onPress={() =>
          // ✅ providers/google이 prompt 옵션을 우선시하므로 프록시를 한 번 더 강제
          (promptAsync as any)({
            // 타입 정의엔 없지만 런타임에서 처리됨
            // @ts-ignore
            useProxy: true,
            // @ts-ignore
            projectNameForProxy: EXPO_PROJECT,
          })
        }
      />
    </View>
  );
}