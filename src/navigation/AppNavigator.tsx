import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { onAuthStateChanged, User } from 'firebase/auth';

import Home from '../views/Home';
import Question from '../views/Question';
import Summary from '../views/Summary';
import Settings from '../views/Settings';
import History from '../views/History';
import SessionDetail from '../views/SessionDetail';
import LoginScreen from '../screens/LoginScreen';
import type { RootStackParamList } from '../models/types';
import { TOKENS } from '../theme/tokens';
import { auth } from '../services/firebase';

export type TabParamList = {
  Practice: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function PracticeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: TOKENS.bg },
      }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Question" component={Question} />
      <Stack.Screen name="Summary" component={Summary} options={{ title: '면접 요약' }} />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: TOKENS.bg },
      }}
    >
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="SessionDetail" component={SessionDetail} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const insets = useSafeAreaInsets();

  // ❌ NavigationContainer를 여기서 삭제하고 Tab.Navigator만 반환합니다.
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TOKENS.tint,
        tabBarInactiveTintColor: TOKENS.sub,
        tabBarStyle: {
          backgroundColor: TOKENS.cardBg,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: TOKENS.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          marginTop: -5,
        },
      }}>
      <Tab.Screen
        name="Practice"
        component={PracticeStack}
        options={{
          title: '연습',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="microphone-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStack}
        options={{
          title: '기록',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default AppNavigator;
