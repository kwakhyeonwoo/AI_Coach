import React from 'react';
import { View, Text } from 'react-native';

export default function History() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>History</Text>
      <Text>지난 세션 목록</Text>
    </View>
  );
}