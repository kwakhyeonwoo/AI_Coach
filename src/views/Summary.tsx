// src/views/Summary.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView,
  StyleSheet, Text, View, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/services/firebase';
import { requestBuildSummary } from '@/services/summaries';
import type { RootStackParamList, SummaryData, QAFeedback, InterviewLevel } from '@/models/types';
import { TOKENS } from '@/theme/tokens';
import { syncSummaryToSession } from '@/services/summarySync';

// Android에서 LayoutAnimation을 사용하기 위한 설정
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- 네비게이션 타입 ---
type Props = {
  navigation: any; // 실제 프로젝트에 맞는 타입으로 교체 권장
  route: { params?: { sessionId: string } };
};

// --- 도우미 함수 ---
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const getLevelDescription = (level: InterviewLevel, score: number) => {
  if (score > 85) return '훌륭해요! 핵심을 찌르는 답변이에요.';
  if (level === 'Advanced') return '좋은 답변이지만, 조금 더 구체적인 예시가 필요해요.';
  if (level === 'Intermediate') return '구조는 좋아요. 수치와 보안 키워드가 부족해요.';
  return '개념 이해는 충분해요. 실제 경험을 더 녹여내 보세요.';
};

// --- UI 서브 컴포넌트 ---
const OverallScoreCard: React.FC<{ summary: SummaryData }> = ({ summary }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const scoreColor = summary.overallScore >= 80 ? TOKENS.good : summary.overallScore >= 60 ? TOKENS.warn : TOKENS.bad;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamp(summary.overallScore),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [summary.overallScore, progress]);

  const progressWidth = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.card}>
      <Text style={styles.score}>{summary.overallScore}<Text style={styles.scoreTotal}> / 100</Text></Text>
      <Text style={styles.sub}>{getLevelDescription(summary.level, summary.overallScore)}</Text>
      <View style={styles.progressWrap}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: scoreColor }]} />
      </View>
    </View>
  );
};

const AnalysisCard: React.FC<{ strengths: string[], improvements: string[] }> = ({ strengths, improvements }) => (
  <View style={styles.card}>
    <Text style={styles.title}>강점 & 개선점</Text>
    <View style={{ gap: 12 }}>
      <ChipList items={strengths} icon="thumb-up-outline" color={TOKENS.good} />
      <ChipList items={improvements} icon="arrow-up-circle-outline" color={TOKENS.bad} />
    </View>
  </View>
);

const QACard: React.FC<{ qaItem: QAFeedback, index: number }> = ({ qaItem, index }) => {
  const [expanded, setExpanded] = useState(false);
  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.card, { paddingBottom: 8 }]}>
      <Text style={styles.qTitle}>{`Q${index + 1}. ${qaItem.questionText}`}</Text>
      <View style={styles.tagRow}>
        {qaItem.tags.map(tag => <Chip key={tag} label={tag} />)}
      </View>

      <Pressable onPress={onToggle} style={styles.expandHeader}>
        <Text style={styles.sub}>모범 답안</Text>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={24} color={TOKENS.sub} />
      </Pressable>

      {expanded && (
        <View style={styles.expandContent}>
          <Text style={styles.body}>{qaItem.modelAnswer || '모범 답안이 제공되지 않았습니다.'}</Text>
        </View>
      )}

      <View style={styles.proAnalysis}>
        <Text style={styles.proTitle}>Pro 분석</Text>
        {qaItem.followUpQuestions && qaItem.followUpQuestions.length > 0 && (
          <>
            <Text style={styles.subTitle}>팔로업 제안</Text>
            {qaItem.followUpQuestions.map((fq, i) => (
              <Text key={i} style={styles.followUp}>• {fq}</Text>
            ))}
          </>
        )}
      </View>
    </View>
  );
};

// --- 메인 컴포넌트 ---
const Summary: React.FC<Props> = ({ route, navigation }) => {
  const sessionId = route?.params?.sessionId;
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [status, setStatus] = useState<'loading' | 'pending' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("세션 ID가 없습니다.");
      setStatus('error');
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'summaries', sessionId),
      (snap) => {
        // ✅ 데이터 스냅샷 처리
        if (!snap.exists()) {
          setStatus('pending');
          requestBuildSummary(sessionId).catch((err: unknown) => {
            console.error('requestBuildSummary failed on mount:', err);
            setError('요약 생성 요청에 실패했습니다.');
            setStatus('error');
          });
          return;
        }

        const data = snap.data() as any;
        setStatus(data.status || 'pending');

        if (data.status === 'ready') {
          const normalized = {
            ...data,
            startedAt: data.startedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            endedAt: data.endedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          };

          setSummary(normalized);

          // ✅ sessions에도 반영
          syncSummaryToSession(sessionId, data).catch((err: unknown) =>
            console.warn('syncSummaryToSession failed', err)
          );
        } else if (data.status === 'error') {
          setError(data.error || '알 수 없는 오류로 요약 생성에 실패했습니다.');
        }
      },
      (err) => {
        console.error('Firestore watch error:', err);
        setError('요약 데이터를 불러오는 중 오류가 발생했습니다.');
        setStatus('error');
      }
    );

    return () => {
      unsub();
    };
  }, [sessionId]);
  
  // ✅ 렌더링 로직을 더 단순하게 수정
  const renderContent = () => {
      // 1. 에러가 발생했다면 에러 메시지 표시
      if (error) {
          return (
              <View style={styles.center}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={48} color={TOKENS.bad} />
                  <Text style={styles.message}>오류 발생</Text>
                  <Text style={styles.sub}>{error}</Text>
              </View>
          );
      }
      
      // 2. summary 데이터가 아직 없으면 로딩 메시지 표시
      //    (status가 loading, pending, 또는 ready여도 데이터가 없으면 이 부분을 통과)
      if (!summary) {
          return (
              <View style={styles.center}>
                  <ActivityIndicator />
                  <Text style={styles.message}>요약을 생성 중입니다. 잠시만 기다려주세요.</Text>
              </View>
          );
      }

      // 3. summary 데이터가 완전히 준비되면 요약본 표시
      return (
        <ScrollView contentContainerStyle={styles.scroll}>
          <OverallScoreCard summary={summary} />
          <AnalysisCard strengths={summary.strengths} improvements={summary.improvements} />
          {summary.qa.map((item, index) => (
            <QACard key={item.id} qaItem={item} index={index} />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {renderContent()}
    </SafeAreaView>
  );
};

// ... (스타일과 다른 컴포넌트들은 그대로 유지)
const Chip: React.FC<{ label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; color?: string }> = ({ label, icon, color = TOKENS.sub }) => (
    <View style={[styles.chip, { backgroundColor: `${color}1A` }]}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={color} />}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
);
const ChipList: React.FC<{ items: string[]; icon?: keyof typeof MaterialCommunityIcons.glyphMap; color?: string }> = ({ items, icon, color }) => (
    <View style={styles.tagRow}>
      {items.map((txt, i) => <Chip key={`${txt}-${i}`} label={txt} icon={icon} color={color} />)}
    </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scroll: { padding: TOKENS.gap, gap: TOKENS.gap },
  message: { fontSize: 16, color: TOKENS.label, marginTop: 12 },
  card: {
    backgroundColor: TOKENS.cardBg,
    borderRadius: TOKENS.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  score: { fontSize: 48, fontWeight: 'bold', color: TOKENS.label },
  scoreTotal: { fontSize: 24, color: TOKENS.sub, fontWeight: 'normal' },
  sub: { fontSize: 14, color: TOKENS.sub, marginTop: 4 },
  title: { fontSize: 18, fontWeight: 'bold', color: TOKENS.label, marginBottom: 12 },
  progressWrap: { height: 8, backgroundColor: TOKENS.border, borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '500' },
  qTitle: { fontSize: 16, fontWeight: '600', color: TOKENS.label, marginBottom: 8 },
  expandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: TOKENS.border },
  expandContent: { paddingTop: 8, paddingBottom: 12 },
  body: { fontSize: 14, lineHeight: 22, color: TOKENS.label },
  proAnalysis: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: `${TOKENS.tint}33` },
  proTitle: { color: TOKENS.tint, fontWeight: 'bold', fontSize: 14 },
  subTitle: { fontWeight: '600', color: TOKENS.label, marginTop: 8, marginBottom: 4 },
  followUp: { fontSize: 13, color: TOKENS.sub, lineHeight: 20, marginLeft: 4 },
});
  
export default Summary;