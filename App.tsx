// App.tsx
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InterviewProvider } from './src/viewmodels/InterviewVM';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <InterviewProvider>
        <NavigationContainer theme={DefaultTheme}>
          <StatusBar barStyle="dark-content" />
          <AppNavigator />
        </NavigationContainer>
      </InterviewProvider>
    </SafeAreaProvider>
  );
}
