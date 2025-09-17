// src/navigation/AppNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Home from '../views/Home';
import Question from '../views/Question';
import Summary from '../views/Summary';
import Settings from '../views/Settings';
import type { RootStackParamList } from '../models/types';
import { Platform } from 'react-native';

function HistoryScreen() { return null; }

export type TabParamList = {
  Practice: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function PracticeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen name="Home" component={Home} options={{
        title: '면접',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
      }}/>
      <Stack.Screen name="Question" component={Question} />
      <Stack.Screen name="Summary" component={Summary} options={{title:'면접 요약'}}/>
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#635BFF',
        tabBarInactiveTintColor: '#9CA3AF',
        // ✅ 기본 바텀 탭 (하단 고정)
        tabBarStyle: {
          height: 58,
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 6 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tab.Screen
        name="Practice"
        component={PracticeStack}
        options={{
          title: '연습',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'book-open-variant' : 'book-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: '기록',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="history" size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog-outline" size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
