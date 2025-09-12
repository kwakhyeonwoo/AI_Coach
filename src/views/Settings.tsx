import React from 'react';
import { View, Text } from 'react-native';

export default function Settings() {
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Settings</Text>
      <Text>음성/타이머/저장옵션 등</Text>
    </View>
  );
}