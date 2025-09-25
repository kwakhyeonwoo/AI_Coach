// src/screens/LoginScreen.tsx
import React, { useEffect } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function LoginScreen({ navigation }: any) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID, // ✅ expoClientId → clientId
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;

      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(userCred => {
          console.log("✅ 로그인 성공:", userCred.user.uid);
          navigation.replace('Home'); // 로그인 성공 시 홈으로 이동
        })
        .catch(err => console.error("❌ Firebase 로그인 실패:", err));
    }
  }, [response]);

  return (
    <View style={styles.container}>
      <Button
        title="Google로 로그인"
        disabled={!request}
        onPress={() => promptAsync()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
