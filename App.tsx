import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native'; // ✅ 여기에만 NavigationContainer를 둡니다.

import AppNavigator from './src/navigation/AppNavigator';
// 참고: 이전 버전에서는 InterviewVMProvider, SessionProvider를 사용했습니다.
// 현재 코드에 맞게 InterviewProvider로 유지합니다.
import { InterviewProvider } from './src/viewmodels/InterviewVM';
import { GoogleAuthProvider } from './src/viewmodels/GoogleAuthVM';


export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InterviewProvider>
          <GoogleAuthProvider> {/* ✅ 여기서 Context로 로그인 관리 */}
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </GoogleAuthProvider>
        </InterviewProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
