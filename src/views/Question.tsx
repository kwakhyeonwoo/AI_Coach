// src/screens/Question.tsx
import React, { useEffect, useRef } from 'react';
import { View, Pressable, ActivityIndicator, Animated, Easing, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../models/types';
import { useInterviewVM } from '../viewmodels/InterviewVM'; // 기존 settings 보유
import { useQuestionVM } from '../viewmodels/useQuestion';
import { useRecorder } from '../hook/useRecorder';
import { TOKENS } from '@/theme/tokens';
import { requestBuildSummary } from '@/services/summaries';
import { uploadQuestionAudio } from '@/services/uploadAudio';

type Props = NativeStackScreenProps<RootStackParamList, 'Question'>;

const SmallBtn: React.FC<{ label: string; onPress?: () => void; disabled?: boolean }>
  = ({ label, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );

const Question: React.FC<Props> = ({ route, navigation }) => {
  const { settings } = useInterviewVM();
  const vm = useQuestionVM(settings, { maxQ: 5 });
  const rec = useRecorder('mic_preask_done_v1');

  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const didInit = useRef(false) // 최초 1회 로드 가드 

  // 첫 질문 로드
  useEffect(() => {
    if(didInit.current) return;
    didInit.current = true;
    vm.loadFirst();
  }, [vm.loadFirst]);

  // 녹음 중일 때 펄스 애니메이션
  useEffect(() => {
    if (rec.isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [rec.isRecording, pulse]);

  useEffect(() => {
    rec.clear();           // audioUri, remain(90s), level, isRecording reset
  }, [vm.index]);    

  const onNext = async () => {
    const res = await vm.next(rec.audioUri ? `[audio] ${rec.audioUri}` : undefined);
    if (res.done) {
      navigation.replace('Summary', { sessionId: route.params?.sessionId ?? 'local' });
      return;
    }
    // 다음 질문으로 넘어갔으니 현재 녹음 상태 초기화
    rec.stop().catch(() => {});
  };

  const sessionId = route.params?.sessionId ?? 'local';

  const goNext = async () => {
    if (!rec.audioUri) return;                    // 🔒 오디오 없으면 진행 금지
    const currentQuestionId = `q${vm.index}`;
    const questionText = vm.question ?? '';

    try {
      await uploadQuestionAudio({
        sessionId,
        questionId: currentQuestionId,
        localUri: rec.audioUri,
        questionText,
        companyId: (settings.company || 'generic').trim() || 'generic',
        role: (settings.role as string) || 'general',
      });
    } catch(e) {
      console.warn('[Question.goNext] upload failed', e);
      return;
    }
    const res = await vm.next(`[audio] ${rec.audioUri}`);
    if(res.done) {
      try{
        await requestBuildSummary(sessionId);
      } catch (e) {
        console.warn('buildSummary error', e);
      }
      navigation.replace('Summary', { sessionId });
      return;
    }
    rec.clear();
  };

  const skipNext = async () => {
    const res = await vm.next(undefined);
    if (res.done) {
      try {
        await requestBuildSummary(sessionId);
      } catch(e) {
        console.warn('buildSummary error', e);
      }
      navigation.replace('Summary', { sessionId });
      return;
    }
    rec.clear();
  };

  const cardStyle = {
    backgroundColor: TOKENS.cardBg,
    borderRadius: TOKENS.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: TOKENS.bg }} edges={['top','left','right']}>
      <ScrollView
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
        contentContainerStyle={{
          paddingTop: 6,
          paddingHorizontal: TOKENS.gap,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 상단 */}
        <View style={styles.topBar}>
          <Text style={styles.badge}>Q {vm.index}/{vm.maxQ}</Text>
          <Text style={styles.badgeAlt}>팔로업 {vm.followups}/2</Text>
        </View>
        <View style={styles.progress}><View style={[styles.progressFill, { width: `${vm.progress * 100}%` }]} /></View>

        {/* 질문 카드 */}
        <View style={[cardStyle]}>
          <Text style={styles.q}>
            {vm.question || (vm.loading ? '질문 생성 중…' : '질문을 불러오세요')}
          </Text>
          <View style={styles.tagRow}>
            {vm.tags.map(t => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
                </View>
            ))}
          </View>
        </View>

        {/* 녹음 패널 */}
        <View style={[cardStyle, { alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 280 }]}>
          <Text style={{ color: TOKENS.sub }}>{rec.remain}s</Text>

          <Animated.View
            style={[
              styles.micOuter,
              rec.isRecording && { borderColor: '#FACC15', shadowOpacity: 0.35 },
              { transform: [{ scale: rec.isRecording
                ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + rec.level * 0.25 + 0.05] })
                : 1 }]},
            ]}
          >
            <Pressable onPress={rec.askAndToggle} style={({ pressed }) => [styles.micInner, pressed && { opacity: 0.9 }]}>
              <MaterialCommunityIcons
                name={rec.isRecording ? 'microphone' : 'microphone-outline'}
                size={40}
                color="#FACC15"
              />
            </Pressable>
          </Animated.View>

          <Waveform level={rec.level} isRecording={rec.isRecording} />

          <Text style={{ color: TOKENS.sub }}>
            {rec.isRecording ? '녹음 중…' : (rec.audioUri ? '완료' : '대기 중')}
          </Text>
        </View>

        {/* 하단 액션 */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SmallBtn label="다시 질문" onPress={() => { /* TODO: 재생성 로직 */ }} />
          <SmallBtn label="스킵 (1회)" onPress={skipNext} disabled={vm.loading} />
        </View>

        <Pressable
          onPress={goNext}
          disabled={vm.loading || !rec.audioUri}
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.88 },
            (vm.loading || !rec.audioUri) && { opacity: 0.5 }
          ]}
        >
          {vm.loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>다음 질문</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

function Waveform({ level, isRecording }: { level: number; isRecording: boolean }) {
  const bars = 18;
  const arr = Array.from({ length: bars });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, marginTop: 4 }}>
      {arr.map((_, i) => {
        const phase = (i / bars) * Math.PI;
        const h = 6 + Math.pow(Math.sin(phase), 2) * (14 + 60 * level);
        return (
          <View key={i} style={{
            width: 4, height: h, borderRadius: 2, marginHorizontal: 2,
            backgroundColor: isRecording ? '#FDE047' : '#D1D5DB',
          }}/>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 12, color: TOKENS.label, fontWeight: '600' },
  badgeAlt: { fontSize: 12, color: TOKENS.sub },
  progress: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#9ca3af' },
  q: { fontSize: 16, fontWeight: '600', color: TOKENS.label },
  tagRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: TOKENS.border },
  tagText: { fontSize: 12, color: TOKENS.sub },
  micOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 6, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0 },
  micInner: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  smallBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: TOKENS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: TOKENS.cardBg },
  smallBtnText: { color: TOKENS.label, fontSize: 14, fontWeight: '600' },
  cta: { height: 52, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default Question;
