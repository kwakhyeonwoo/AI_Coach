// src/screens/History.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

export default function History() {
  // ✅ 더미 데이터 (추후 Firestore나 AsyncStorage에서 불러올 수도 있음)
  const [sessions, setSessions] = useState([
    { id: '1', title: 'iOS 면접 연습', date: '2025-09-20', result: '성공' },
    { id: '2', title: 'Android 코딩테스트', date: '2025-09-18', result: '보통' },
    { id: '3', title: 'Frontend 모의 인터뷰', date: '2025-09-15', result: '아쉬움' },
  ]);

  const renderItem = ({ item }: { item: typeof sessions[0] }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.date}>{item.date}</Text>
      <Text style={styles.result}>결과: {item.result}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>History</Text>
      <Text style={styles.sub}>지난 세션 목록</Text>

      <FlatList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 16, color: '#666', marginBottom: 16 },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: '600' },
  date: { fontSize: 14, color: '#888', marginTop: 4 },
  result: { fontSize: 14, marginTop: 6 },
});
