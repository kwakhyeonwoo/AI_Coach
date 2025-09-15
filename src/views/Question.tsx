import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Animated, Easing, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, QA } from '../models/types';
import { useInterviewVM } from '../viewmodels/InterviewVM';
import { requestFirstQuestion, requestNextQuestion } from '../services/apiClient';

// ✅ expo-audio 사용
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';

import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Question'>;

// ✅ 최초 1회 안내 Alert 플래그 키
const MIC_PREASK_KEY = 'mic_preask_done_v1';

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
  const maxQ = 5;
  const [index, setIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<string>('');
  const [history, setHistory] = useState<QA[]>([]);
  const [followups, setFollowups] = useState(0);

  // 🔊 상태
  const [isRecording, setIsRecording] = useState(false);
  const [remain, setRemain] = useState(90);
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 파동/펄스 애니메이션
  const [level, setLevel] = useState(0);                 // 0~1
  const pulse = useRef(new Animated.Value(0)).current;   // 외곽 링 펄스

  useEffect(() => {
    if (isRecording) {
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
      setLevel(0);
    }
  }, [isRecording]);

  // 첫 질문 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await requestFirstQuestion(settings, { maxQ: 5 });
        if (res.question) setQuestion(res.question);
      } catch (e: any) {
        Alert.alert('질문 로드 실패', e?.message ?? '서버 오류');
      } finally {
        setLoading(false);
      }
    })();

    // 언마운트 시 녹음/타이머 정리
    return () => { stopRecording().catch(()=>{}); };
  }, []);

  type MeteringStatus = { metering?: number | null };

  // ✅ expo-audio 녹음기 + 메터링
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (st: unknown) => {
      const m = (st as MeteringStatus)?.metering;
      if (typeof m === 'number') {
        const norm = Math.min(1, Math.max(0, (m + 160) / 160));
        setLevel(prev => prev * 0.6 + norm * 0.4);
      } else {
        // (Android 등) 메터링 미지원 시 의사 파형
        setLevel(prev => prev * 0.75 + 0.25 * (0.3 + Math.random() * 0.7));
      }
    }
  );

  // ⏯ 마이크 버튼: 최초 1회만 우리 Alert → 그 다음부턴 바로 동작
  const handleMicPress = async () => {
    try {
      const perm = await getRecordingPermissionsAsync();
      const shown = await AsyncStorage.getItem(MIC_PREASK_KEY);

      // ✅ 1) 우리 안내 Alert를 '무조건' 딱 한 번 먼저 보여준다 (권한 상태와 무관)
      if (!shown) {
        await AsyncStorage.setItem(MIC_PREASK_KEY, '1'); // 다시는 안 보이게

        if (perm.granted) {
          // 이미 OS 권한이 있는 경우: 안내 후 바로 녹음 시작 선택
          Alert.alert(
            '마이크 사용 안내',
            '지금부터 마이크 녹음을 시작할게요.',
            [
              { text: '취소', style: 'cancel' },
              { text: '시작', onPress: () => startRecording() },
            ],
          );
          return;
        }

        if (perm.status === 'undetermined') {
          // 아직 한 번도 OS 권한을 안 물어본 경우: 안내 → OS 다이얼로그
          Alert.alert(
            '마이크 사용 안내',
            '다음 단계에서 OS 권한을 요청합니다.',
            [
              { text: '취소', style: 'cancel' },
              {
                text: '동의하고 계속',
                onPress: async () => {
                  const req = await requestRecordingPermissionsAsync();
                  if (req.granted) await startRecording();
                  else Alert.alert('마이크 권한 필요', '설정에서 마이크 권한을 허용해주세요.');
                },
              },
            ],
          );
          return;
        }

        // 명시적으로 거부돼 있는 경우
        Alert.alert(
          '마이크 권한이 꺼져 있어요',
          '설정에서 마이크 권한을 허용하면 녹음이 가능합니다.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => Linking.openSettings?.() },
          ],
        );
        return;
      }

      // ✅ 2) 이미 한 번 안내를 보여줬다면, 권한 상태에 따라 바로 동작
      if (perm.granted) {
        if (isRecording) await stopRecording();
        else await startRecording();
        return;
      }

      if (perm.status === 'undetermined') {
        const req = await requestRecordingPermissionsAsync();
        if (req.granted) await startRecording();
        else Alert.alert('마이크 권한 필요', '설정에서 마이크 권한을 허용해주세요.');
        return;
      }

      Alert.alert(
        '마이크 권한이 꺼져 있어요',
        '설정에서 마이크 권한을 허용하면 녹음이 가능합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings?.() },
        ],
      );
    } catch (e) {
      console.warn('handleMicPress error', e);
    }
  };



  const startRecording = async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setAudioUri(undefined);
      setRemain(90);

      // ✅ 90초 카운트다운
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemain((r) => {
          if (r <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            // 자동 종료
            stopRecording().catch(()=>{});
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } catch (e: any) {
      console.warn('startRecording error', e);
      Alert.alert('녹음 시작 실패', e?.message ?? '다시 시도해주세요.');
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (isRecording) {
        await recorder.stop();
        setAudioUri(recorder.uri ?? undefined);
      }
    } catch (e) {
      // no-op
    } finally {
      setIsRecording(false);
      setLevel(0);
    }
  };

  const onNext = async () => {
    const newHist = [...history, { q: question, a: audioUri ? `[audio] ${audioUri}` : '(no audio)' }];
    setHistory(newHist);
    setLoading(true);
    try {
      const res = await requestNextQuestion(settings, newHist, { maxQ: 5 });
      if (res.done) {
        navigation.replace('Summary', { sessionId: route.params?.sessionId ?? 'local' });
      } else if (res.question) {
        setQuestion(res.question);
        setIndex((i) => i + 1);
        setFollowups(0);
        setAudioUri(undefined);
        setRemain(90);
        setIsRecording(false);
      }
    } catch (e: any) {
      Alert.alert('다음 질문 실패', e?.message ?? '서버 오류');
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min(1, (index - 1) / maxQ);

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.topBar}>
        <Text style={styles.badge}>Q {index}/{maxQ}</Text>
        <Text style={styles.badgeAlt}>팔로업 {followups}/2</Text>
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>

      {/* 질문 카드 */}
      <View style={styles.card}>
        <Text style={styles.q}>{question || (loading ? '질문 생성 중…' : '질문을 불러오세요')}</Text>
        <View style={styles.tagRow}>
          {['성능', '디버깅', '메모리 관리'].map(t => (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
          ))}
        </View>
      </View>

      {/* ▼▼ 새 녹음 패널 UI ▼▼ */}
      <View style={[styles.card, { marginTop: 12, alignItems: 'center', paddingVertical: 16 }]}>
        <Text style={{ color: '#6b7280', marginBottom: 8 }}>{remain}s</Text>

        <Animated.View
          style={[
            styles.micOuter,
            isRecording && { borderColor: '#FACC15', shadowOpacity: 0.35 },
            {
              transform: [{
                scale: isRecording
                  ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + level * 0.25 + 0.05] })
                  : 1,
              }],
            },
          ]}
        >
          <Pressable
            onPress={handleMicPress}
            style={({ pressed }) => [styles.micInner, pressed && { opacity: 0.9 }]}
          >
            <MaterialCommunityIcons
              name={isRecording ? 'microphone' : 'microphone-outline'}
              size={36}
              color="#FACC15"
            />
          </Pressable>
        </Animated.View>

        <Waveform level={level} isRecording={isRecording} />

        <Text style={{ marginTop: 8, color: '#6b7280' }}>
          {isRecording ? '녹음 중…' : (audioUri ? '완료' : '대기 중')}
        </Text>
      </View>
      {/* ▲▲ 새 녹음 패널 UI ▲▲ */}

      {/* 하단 보조 버튼 + 다음 */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <SmallBtn label="다시 질문" onPress={() => { /* 서버 재생성 로직 가능 */ }} />
        <SmallBtn label="스킵 (1회)" onPress={() => onNext()} />
      </View>

      <Pressable
        onPress={onNext}
        disabled={loading || (!audioUri && !isRecording)}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }, (loading || (!audioUri && !isRecording)) && { opacity: 0.5 }]}
      >
        {loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>다음 질문</Text>}
      </Pressable>
    </View>
  );
};

/** 간단한 파형: 레벨(0~1)에 비례해 막대 높이 변화 */
function Waveform({ level, isRecording }: { level: number; isRecording: boolean }) {
  const bars = 18;
  const arr = Array.from({ length: bars });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, marginTop: 14 }}>
      {arr.map((_, i) => {
        const phase = (i / bars) * Math.PI;
        const h = 6 + Math.pow(Math.sin(phase), 2) * (14 + 60 * level);
        return (
          <View
            key={i}
            style={{
              width: 4,
              height: h,
              borderRadius: 2,
              marginHorizontal: 2,
              backgroundColor: isRecording ? '#FDE047' : '#D1D5DB',
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { fontSize: 12, color: '#1f2937' },
  badgeAlt: { fontSize: 12, color: '#6b7280' },
  progress: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#9ca3af' },
  card: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12 },
  q: { fontSize: 16, fontWeight: '600', color: '#111827' },
  tagRow: { flexDirection: 'row', marginTop: 8 },
  tag: { backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6 },
  tagText: { fontSize: 12, color: '#374151' },

  // 새 마이크 버튼
  micOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 6, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#FACC15', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0,
  },
  micInner: {
    width: 108, height: 108, borderRadius: 54,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0F172A',
  },

  smallBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  smallBtnText: { color: '#111827', fontSize: 14 },
  cta: { height: 48, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default Question;
