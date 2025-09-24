import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, ensureAuth } from '@/services/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/models/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKENS } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function History({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    ensureAuth().then((u) => {
      const q = query(
        collection(db, 'sessions'),
        where('uid', '==', u.uid),
        orderBy('startedAt', 'desc')
      );

      unsub = onSnapshot(q, async (snap) => {
        const items = await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            const sessionId = d.id;

            // summaries/{sessionId} 문서 가져오기
            const summaryRef = doc(db, 'summaries', sessionId);
            const summarySnap = await getDoc(summaryRef);
            const summaryData = summarySnap.exists() ? summarySnap.data() : null;

            return {
              id: sessionId,
              ...data,
              overallScore: summaryData?.overallScore ?? null,
              avgResponseTime: summaryData?.avgResponseTime ?? null,
              mode: data.mode ?? 'free',
            };
          })
        );

        setSessions(items);
        setLoading(false);
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.header}>연습 기록</Text>

      {loading ? (
        <View style={s.center}><ActivityIndicator /></View>
      ) : !sessions.length ? (
        <View style={s.center}><Text style={s.empty}>연습 기록이 없습니다.</Text></View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const scoreLabel = item.overallScore != null ? `${item.overallScore}점` : '-점';
            const dateStr = item.startedAt?.toDate?.().toLocaleString?.() ?? '시작 시간 없음';

            return (
              <Pressable
                style={s.card}
                onPress={() => navigation.navigate('SessionDetail', { sessionId: item.id })}
              >
                <View>
                  <Text style={s.title}>{item.companyId} · {item.role}</Text>
                  <Text style={s.sub}>{dateStr}</Text>
                  {item.avgResponseTime && (
                    <Text style={s.sub}>평균 응답시간 {item.avgResponseTime}초</Text>
                  )}
                </View>
                <Text style={s.score}>{scoreLabel}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.bg },
  header: {
    fontSize: 18, fontWeight: '700', color: TOKENS.label,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: TOKENS.sub, fontSize: 14 },
  card: {
    backgroundColor: TOKENS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '600', color: TOKENS.label },
  sub: { fontSize: 12, color: TOKENS.sub, marginTop: 4 },
  score: { fontSize: 18, fontWeight: '700', color: TOKENS.tint },
});
