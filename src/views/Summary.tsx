import React from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../models/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export default function Summary() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Summary</Text>
      <Text>면접 요약/피드백 화면</Text>
    </View>
  );
}