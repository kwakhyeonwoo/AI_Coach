import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native'; // ✅ 여기에만 NavigationContainer를 둡니다.

import AppNavigator from './src/navigation/AppNavigator';
// 참고: 이전 버전에서는 InterviewVMProvider, SessionProvider를 사용했습니다.
// 현재 코드에 맞게 InterviewProvider로 유지합니다.
import { InterviewProvider } from './src/viewmodels/InterviewVM';
import { GoogleAuthProvider } from 'firebase/auth/web-extension';


export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InterviewProvider>
          {/* ✅ 최상위에 NavigationContainer가 앱 전체를 감쌉니다. */}
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </InterviewProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
