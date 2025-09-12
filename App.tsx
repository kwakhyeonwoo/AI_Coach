import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

import Home from './src/views/Home';
import Question from './src/views/Question';
import Summary from './src/views/Summary';
import History from './src/views/History';
import Settings from './src/views/Settings';
import Feedback from './src/views/Feedback';
import ProUpsell from './src/views/ProUpsell';
import Result from './src/views/Result';
import SessionDetail from './src/views/SessionDetail';

import { InterviewProvider } from './src/viewmodels/InterviewVM';
import type { RootStackParamList } from './src/models/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <InterviewProvider>
      <NavigationContainer theme={DefaultTheme}>
        <StatusBar barStyle="dark-content" />
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={Home} options={{ title: '연습(홈)' }} />
          <Stack.Screen name="Question" component={Question} options={{ title: 'Interview' }} />
          <Stack.Screen name="Result" component={Result} options={{ title: '결과' }} />
          <Stack.Screen name="Summary" component={Summary} options={{ title: '세트 요약' }} />
          <Stack.Screen name="History" component={History} options={{ title: '기록' }} />
          <Stack.Screen name="SessionDetail" component={SessionDetail} options={{ title: '기록 상세' }} />
          <Stack.Screen name="Settings" component={Settings} options={{ title: '설정' }} />
          <Stack.Screen name="Feedback" component={Feedback} options={{ title: 'Feedback' }} />
          <Stack.Screen name="ProUpsell" component={ProUpsell} options={{ title: 'Pro', presentation: 'modal' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </InterviewProvider>
  );
}
