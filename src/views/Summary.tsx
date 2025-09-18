// src/views/Summary.tsx
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TOKENS } from '@/theme/tokens';
import { requestSummary } from '@/services/apiClient';
import { watchSummary } from '@/services/summaryStore';
import { requestBuildSummary } from '@/services/summaries';
// ↑ apiClient에 requestSummary(sessionId: string) 추가 (아래 3번 참고)

// 타입: 기존 types.ts에 정의되어 있지 않다면 아래 인터페이스를 내부에 둬도 됨
type Sentiment = 'positive' | 'neutral' | 'negative';

type QAFeedback = {
  id: string;
  question: string;
  answerSummary: string; // 요약된 답변
  score: number; // 0~100
  tags: string[];
  timeSec: number;
  sentiment: Sentiment;
  notes?: string;
};

type SummaryData = {
  sessionId: string;
  startedAt: string; // ISO
  endedAt: string;   // ISO
  overallScore: number; // 0~100
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  totalQuestions: number;
  totalSpeakingSec: number;
  strengths: string[];
  improvements: string[];
  tips: string[];
  qa: QAFeedback[];
};

// 네비게이션 파라미터(프로젝트의 RootStackParamList가 따로 있다면 그걸로 대체)
type RouteParams = { sessionId: string; summary?: SummaryData };
type Props = {
  navigation: any;
  route: { params?: RouteParams };
};

// 도우미
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const toMMSS = (sec: number) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
const scoreColor = (n: number) => {
  if (n >= 80) return TOKENS.good;
  if (n >= 60) return TOKENS.warn;
  return TOKENS.bad;
};
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mi = `${d.getMinutes()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

const SentimentIcon: React.FC<{ tone: Sentiment }> = ({ tone }) => {
  const map: Record<Sentiment, { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
    positive: { name: 'emoticon-happy-outline', color: TOKENS.good },
    neutral: { name: 'emoticon-neutral-outline', color: TOKENS.warn },
    negative: { name: 'emoticon-sad-outline', color: TOKENS.bad },
  };
  const { name, color } = map[tone];
  return <MaterialCommunityIcons name={name} size={18} color={color} />;
};

const Summary: React.FC<Props> = ({ route, navigation }) => {
  const params = route?.params;
  const sessionId = params?.sessionId;
  const preset = params?.summary;

  const [summary, setSummary] = useState<SummaryData | null>(preset ?? null);
  const [loading, setLoading] = useState<boolean>(!preset);
  const [error, setError] = useState<string | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const [status, setStatus] = useState<'idle'|'loading'|'pending'|'processing'|'ready'|'error'>('loading');
  const [err, setErr] = useState<string|undefined>();
  const triggered = useRef(false);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamp(summary?.overallScore ?? 0, 0, 100),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [summary]);

  useEffect(() => {
    if (!sessionId) return;
    requestBuildSummary(sessionId).catch((e) => {
      console.warn('buildSummary error', e);
      // UI에 토스트/경고 표시해도 좋음
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setStatus('loading');
    setErr(undefined);
    triggered.current = false;

    const unsub = onSnapshot(
      doc(db, 'summaries', sessionId),
      async (snap) => {
        if (!snap.exists()) {
          // 문서가 없으면 최초 1회 자동 생성 호출
          setStatus('idle');
          if (!triggered.current) {
            triggered.current = true;
            try { await requestBuildSummary(sessionId); setStatus('pending'); }
            catch (e:any) { setErr(String(e?.message || e)); setStatus('error'); }
          }
          return;
        }

        const d: any = snap.data();
        const s = (d.status ?? 'ready') as typeof status;
        setStatus(s);

        if (s === 'ready') {
          // 기존 setSummary 로직이 있다면 여기서 변환해서 넣어주세요
          setSummary({
            sessionId,
            startedAt: d.startedAt?.toDate?.()?.toISOString?.() ?? d.startedAt ?? '',
            endedAt: d.endedAt?.toDate?.()?.toISOString?.() ?? d.endedAt ?? '',
            overallScore: d.overallScore ?? 0,
            level: (['Beginner','Intermediate','Advanced'] as const).includes(d.level)
              ? d.level
              : (d.overallScore>=80?'Advanced':d.overallScore>=60?'Intermediate':'Beginner'),
            totalQuestions: d.totalQuestions ?? (Array.isArray(d.qa)? d.qa.length : 0),
            totalSpeakingSec: d.totalSpeakingSec ?? 0,
            strengths: d.strengths ?? [],
            improvements: d.improvements ?? [],
            tips: d.tips ?? [],
            qa: (d.qa ?? []).map((q:any) => ({
              id: q.id ?? '',
              question: q.question ?? q.questionText ?? '',
              answerSummary: q.answerSummary ?? '',
              score: q.score ?? 0,
              timeSec: q.timeSec ?? q.metrics?.durationSec ?? 0,
              tags: q.tags ?? [],
            })),
          });
        }
      },
      (e) => { setErr(e.message); setStatus('error'); }
    );

    return () => unsub();
  }, [sessionId]);


  const progressWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const onShare = async () => {
    if (!summary) return;
    const text =
      `Interview Summary\n` +
      `Session: ${summary.sessionId}\n` +
      `Time: ${formatDateTime(summary.startedAt)} ~ ${formatDateTime(summary.endedAt)}\n` +
      `Overall: ${summary.overallScore} (${summary.level})\n` +
      `Q: ${summary.totalQuestions} • Speaking: ${toMMSS(summary.totalSpeakingSec)}\n\n` +
      `Strengths:\n- ${summary.strengths.join('\n- ')}\n\n` +
      `Improvements:\n- ${summary.improvements.join('\n- ')}`;
    try {
      await Share.share({ message: text });
    } catch (e) {
      Alert.alert('공유 실패', '내용을 공유하는 중 문제가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
        <Text style={[styles.sub, { marginTop: 8 }]}>요약을 불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={[styles.title]}>요약 불러오기 실패</Text>
          <Text style={styles.sub}>{error}</Text>
          <Pressable style={[styles.btn, { marginTop: 16 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.btnLabel}>뒤로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={styles.title}>표시할 요약이 없어요</Text>
          <Text style={styles.sub}>세션 ID가 유효한지 확인해주세요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const durationMin = Math.max(1, Math.round((new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime()) / 60000));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: TOKENS.gap }}>
        {/* Header / Overall */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.kicker}>Interview Summary</Text>
              <Text style={styles.h1}>{summary.overallScore}점</Text>
              <Text style={[styles.sub, { marginTop: 2 }]}>{summary.level}</Text>
              <Text style={[styles.meta, { marginTop: 8 }]}>
                {formatDateTime(summary.startedAt)} • {durationMin}분 • 질문 {summary.totalQuestions} • 말한 시간 {toMMSS(summary.totalSpeakingSec)}
              </Text>
            </View>
            <Pressable onPress={onShare} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <MaterialCommunityIcons name="share-variant" size={22} color={TOKENS.tint} />
            </Pressable>
          </View>

          <View style={styles.progressWrap}>
            <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: scoreColor(summary.overallScore) }]} />
          </View>
          <View style={styles.legendRow}>
            <Legend color={TOKENS.good} label="80~ 우수" />
            <Legend color={TOKENS.warn} label="60~ 보통" />
            <Legend color={TOKENS.bad} label="~59 개선" />
          </View>
        </View>

        {/* Strengths / Improvements */}
        <View style={styles.card}>
          <Text style={styles.title}>강점</Text>
          <ChipList items={summary.strengths} tone="good" />
          <View style={{ height: 12 }} />
          <Text style={styles.title}>개선 포인트</Text>
          <ChipList items={summary.improvements} tone="bad" />
        </View>

        {/* Tips */}
        {summary.tips?.length ? (
          <View style={styles.card}>
            <Text style={styles.title}>다음 인터뷰 전 팁</Text>
            {summary.tips.map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={TOKENS.tint} />
                <Text style={styles.body}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Q&A Feedback */}
        <View style={styles.card}>
          <Text style={styles.title}>문항별 피드백</Text>
          {summary.qa.map((q) => (
            <View key={q.id} style={styles.qaItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <SentimentIcon tone={q.sentiment} />
                <Text style={[styles.qaTitle]} numberOfLines={2}>
                  {q.question}
                </Text>
              </View>
              <Text style={styles.body}>{q.answerSummary}</Text>
              <View style={styles.qaMetaRow}>
                <Text style={[styles.meta, { color: scoreColor(q.score) }]}>점수 {q.score}</Text>
                <Text style={styles.meta}>발화 {toMMSS(q.timeSec)}</Text>
              </View>
              {!!q.tags?.length && (
                <View style={styles.tagRow}>
                  {q.tags.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagLabel}>#{t}</Text>
                    </View>
                  ))}
                </View>
              )}
              {!!q.notes && <Text style={[styles.sub, { marginTop: 6 }]}>{q.notes}</Text>}
            </View>
          ))}
        </View>

        {/* Bottom actions */}
        <View style={{ height: 12 }} />
        <View style={[styles.row, { gap: 12 }]}>
          <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => navigation.navigate('History')}>
            <Text style={styles.btnLabel}>히스토리</Text>
          </Pressable>
          <Pressable
            style={[styles.btnOutline, { flex: 1 }]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.btnOutlineLabel}>홈으로</Text>
          </Pressable>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={styles.legend}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.meta}>{label}</Text>
  </View>
);

const ChipList: React.FC<{ items: string[]; tone?: 'good' | 'bad' | 'neutral' }> = ({ items, tone = 'neutral' }) => {
  const color = tone === 'good' ? TOKENS.good : tone === 'bad' ? TOKENS.bad : TOKENS.border;
  return (
    <View style={styles.chips}>
      {items.map((txt, i) => (
        <View key={`${txt}-${i}`} style={[styles.chip, { borderColor: color }]}>
          <Text style={[styles.chipLabel]}>{txt}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.bg },
  kicker: { color: TOKENS.sub, fontSize: 12, marginBottom: 6 },
  h1: { color: TOKENS.label, fontSize: 32, fontWeight: '700' },
  title: { color: TOKENS.label, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  sub: { color: TOKENS.sub, fontSize: 13, lineHeight: 18 },
  body: { color: TOKENS.label, fontSize: 14, lineHeight: 20 },
  meta: { color: TOKENS.sub, fontSize: 12 },

  card: {
    backgroundColor: TOKENS.cardBg,
    borderColor: TOKENS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: TOKENS.cardRadius,
    padding: TOKENS.gap,
    marginBottom: TOKENS.gap,
  },

  progressWrap: {
    height: 8,
    backgroundColor: '#E9E9EF',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  legendRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 99 },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },

  qaItem: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TOKENS.border,
  },
  qaTitle: { color: TOKENS.label, fontSize: 14, fontWeight: '600', marginLeft: 6, flex: 1 },
  qaMetaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tag: {
    borderColor: TOKENS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagLabel: { color: TOKENS.sub, fontSize: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  chipLabel: { color: TOKENS.label, fontSize: 13 },

  row: { flexDirection: 'row' },

  btn: {
    backgroundColor: TOKENS.tint,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: { color: 'white', fontSize: 15, fontWeight: '600' },

  btnOutline: {
    borderColor: TOKENS.tint,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineLabel: { color: TOKENS.tint, fontSize: 15, fontWeight: '600' },
});

export default Summary;
