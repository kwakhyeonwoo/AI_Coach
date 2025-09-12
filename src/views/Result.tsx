import React from 'react';
import { View, Text } from 'react-native';

export default function Result() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Result</Text>
      <Text>면접 요약/피드백 화면</Text>
    </View>
  );
}