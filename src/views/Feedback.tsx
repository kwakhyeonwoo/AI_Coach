import React from 'react';
import { View, Text } from 'react-native';

export default function Feedback() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Feedback</Text>
      <Text>세부 피드백</Text>
    </View>
  );
}