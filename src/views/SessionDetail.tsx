// src/views/SessionDetail.tsx
import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/models/types';
import Summary from './Summary';
import { TOKENS } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionDetail'>;

export default function SessionDetail({ route }: Props) {
  const { sessionId } = route.params;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Summary 재활용 */}
      <Summary route={{ params: { sessionId } }} navigation={null as any} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.bg },
});
