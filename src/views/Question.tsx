import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, QA } from '../models/types';
import { useInterviewVM } from '../viewmodels/InterviewVM';
import { requestFirstQuestion, requestNextQuestion } from '../services/apiClient';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

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
  const maxQ = 5;
  const [index, setIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<string>('');
  const [history, setHistory] = useState<QA[]>([]);
  const [followups, setFollowups] = useState(0); // Pro 모드용 카운트

  // 음성 녹음 상태
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [remain, setRemain] = useState(90); // 90초 카운트다운
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => { stopRecording(); };
  }, []);

  const askMicAndStart = () => {
    Alert.alert('마이크 권한', '음성 녹음을 허락하시겠습니까?', [
      { text: '비동의', style: 'cancel' },
      { text: '동의', onPress: startRecording },
    ]);
  };

  const startRecording = async () => {
  try {
    // 1) 권한
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '설정에서 마이크 권한을 허용해주세요.');
      return;
    }

    // 2) 오디오 세션 (iOS/Android 공통 안정 세팅)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    // 3) 녹음 시작 (프리셋 사용: 플랫폼별 옵션 알아서 적용)
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    setRecording(recording);
    setIsRecording(true);
    setAudioUri(undefined);
    setRemain(90);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemain(r => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          stopRecording();
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
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI() || undefined;
        setAudioUri(uri);
      }
    } catch (e) {
      // no-op
    } finally {
      setIsRecording(false);
      setRecording(null);
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    }
  };

  const onNext = async () => {
    // 지금은 음성 파일만 확보. 추후 서버 전사/채점 붙일 예정.
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
        // 녹음 상태 초기화
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

  // 진행도 (단순 비율)
  const progress = Math.min(1, (index - 1) / maxQ);

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.topBar}>
        <Text style={styles.badge}>Q {index}/{maxQ}</Text>
        <Text style={styles.badgeAlt}>팔로업 {followups}/2</Text>
      </View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${progress*100}%` }]} /></View>

      {/* 질문 카드 */}
      <View style={styles.card}>
        <Text style={styles.q}>{question || (loading ? '질문 생성 중…' : '질문을 불러오세요')}</Text>
        <View style={styles.tagRow}>
          {['성능','디버깅','메모리 관리'].map(t=> (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
          ))}
        </View>
      </View>

      {/* 녹음 패널 */}
      <View style={[styles.card,{ marginTop:12, alignItems:'center' }]}> 
        <View style={styles.ring}><Text style={{ fontSize:16, color:'#6b7280' }}>{remain}</Text></View>
        <Pressable
          onPress={isRecording ? stopRecording : askMicAndStart}
          style={({ pressed }) => [styles.fab, isRecording ? styles.fabActive : null, pressed && { opacity: 0.8 } ]}
        >
          <Text style={{ color:'#fff', fontSize:28 }}>{isRecording ? '■' : '✓'}</Text>
        </Pressable>
        <Text style={{ marginTop:8, color:'#6b7280' }}>{isRecording ? '녹음 중…' : (audioUri ? '완료' : '대기 중')}</Text>
      </View>

      {/* 하단 보조 버튼 + 다음 */}
      <View style={{ flexDirection:'row', gap:12, marginTop:12 }}>
        <SmallBtn label="다시 질문" onPress={() => { /* 서버 재생성 로직 가능 */ }} />
        <SmallBtn label="스킵 (1회)" onPress={() => onNext()} />
      </View>

      <Pressable onPress={onNext} disabled={loading || (!audioUri && !isRecording)} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }, (loading || (!audioUri && !isRecording)) && { opacity: 0.5 }]}>
        {loading ? <ActivityIndicator /> : <Text style={styles.ctaText}>다음 질문</Text>}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { fontSize: 12, color: '#1f2937' },
  badgeAlt: { fontSize: 12, color: '#6b7280' },
  progress: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 999, overflow:'hidden' },
  progressFill: { height: '100%', backgroundColor: '#9ca3af' },
  card: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, borderWidth:1, borderColor:'#E5E7EB', marginTop:12 },
  q: { fontSize: 16, fontWeight: '600', color:'#111827' },
  tagRow: { flexDirection:'row', marginTop:8 },
  tag: { backgroundColor:'#EEF2FF', borderRadius: 12, paddingHorizontal:8, paddingVertical:4, marginRight:6 },
  tagText: { fontSize: 12, color:'#374151' },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 8, borderColor: '#E5E7EB', alignItems: 'center', justifyContent:'center', marginTop:8 },
  fab: { width: 72, height: 72, borderRadius: 36, backgroundColor:'#10B981', alignItems:'center', justifyContent:'center', marginTop:12 },
  fabActive: { backgroundColor:'#EF4444' },
  smallBtn: { flex:1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  smallBtnText: { color:'#111827', fontSize: 14 },
  cta: { height: 48, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default Question;