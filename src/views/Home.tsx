// src/screens/Home.tsx
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Mode, JDRole } from '../models/types';
import { useInterviewVM } from '../viewmodels/InterviewVM';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '@/theme/tokens';
import { resolveAndExtractJD } from "@/utils/jd";
import { useNavigation } from '@react-navigation/native';
import { createSession } from '@/services/sessionStore';

const TEMP_UID = 'test-user-001';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const Button: React.FC<{ label: string; onPress?: () => void; disabled?: boolean; variant?: 'primary'|'secondary' }>
= ({ label, onPress, disabled, variant='primary' }) => (
  <Pressable onPress={onPress} disabled={disabled}
    style={({ pressed }) => [
      s.btn,
      variant==='secondary' && s.btnSecondary,
      pressed && { opacity: 0.85 },
      disabled && { opacity: 0.4 },
    ]}
  >
    <Text style={[s.btnText, variant==='secondary' && s.btnTextSecondary]}>{label}</Text>
  </Pressable>
);

const Segmented: React.FC<{ options: string[]; value: string; onChange: (v:string)=>void }> = ({ options, value, onChange }) => (
  <View style={s.segmented}>
    {options.map(o => (
      <Pressable key={o} onPress={() => onChange(o)} style={[s.segment, value===o && s.segmentActive]}>
        <Text style={[s.segmentText, value===o && s.segmentTextActive]}>{o}</Text>
      </Pressable>
    ))}
  </View>
);

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <View style={s.chip}><Text style={s.chipText}>{label}</Text></View>
);

const Home: React.FC<Props> = ({ navigation }) => {
  const { startNewSession, loading, settings, setSettings, setMode } = useInterviewVM();
  const [keywords, setKeywords] = useState<string[]>(settings.jdKeywords || []);
  const [extracting, setExtracting] = useState(false);

  const sessionIdRef = useRef(`local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  
  const extractKeywords = async () => {
    const raw = (settings.jdText || "").trim();
    if (!raw) return;
    setExtracting(true);
    try {
        const { text, keywords } = await resolveAndExtractJD (
            raw, 
            settings.role as JDRole,
            sessionIdRef.current
        );
        setSettings({ jdText: text, jdKeywords: keywords });
        setKeywords(keywords);
    } catch(e:any) {
        Alert.alert("오류", e.message || "키워드 추출 중 오류 발생");
    } finally {
        setExtracting(false);
    }
  };  

  const start = async () => {
    try {
        const companyId = (settings.company || 'generic').trim() || 'generic';
        const role = (settings.role as string) || 'general';
        const expectedQuestions = 5; // 필요시 설정값으로 교체

        // ✅ 새 세션 생성
        const sessionId = await createSession(TEMP_UID, {
        companyId,
        role,
        status: 'active',
        expectedQuestions,
        startedAt: new Date(),
        updatedAt: new Date(),
        });

        console.log('✅ Created session:', sessionId);

        // ✅ Question 화면으로 이동 (sessionId 전달)
        navigation.navigate('Question', { sessionId });
    } catch (e) {
        console.warn('[Home.start] failed to start session', e);
    }
  };


  const insets = useSafeAreaInsets();

  const cardStyle = {
    backgroundColor: TOKENS.cardBg,
    borderRadius: TOKENS.cardRadius,
    padding: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: TOKENS.bg }} edges={['top','left','right']}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,                         // 상단 꽉 차보이게
          paddingHorizontal: TOKENS.gap,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== App Bar ===== */}
        <View style={s.appbar}>
          <Text style={s.brand}>AI</Text>
          <Pressable onPress={() => navigation.navigate('ProUpsell')}>
            <Text style={s.proBadge}>{settings.mode==='pro' ? 'PRO' : '업그레이드'}</Text>
          </Pressable>
        </View>

        {/* ===== 회사 / 직무 ===== */}
        <View style={cardStyle}>
          <Text style={s.label}>회사(선택/입력)</Text>
          <TextInput
            style={s.input}
            placeholder="예) 토스, 네이버"
            placeholderTextColor={TOKENS.sub}
            value={settings.company}
            onChangeText={(t)=>setSettings({ company: t })}
          />

          <Text style={[s.label,{ marginTop:12 }]}>직무</Text>
          <Segmented
            options={['iOS','Android','Frontend','Backend','Data']}
            value={settings.role}
            onChange={(v)=>setSettings({ role: v })}
          />
        </View>

        {/* ===== 모드 ===== */}
        <View>
          <Text style={s.label}>모드</Text>
          <Segmented
            options={['Free','Pro']}
            value={settings.mode==='pro'?'Pro':'Free'}
            onChange={(v)=>setMode(v.toLowerCase() as Mode)}
          />
        </View>

        {/* ===== Pro: JD 입력/키워드 ===== */}
        {settings.mode==='pro' && (
          <View style={[cardStyle]}>
            <Text style={s.label}>JD URL/텍스트</Text>
            <TextInput
              style={[s.input,{ minHeight:110, textAlignVertical:'top' }]}
              placeholder="JD를 붙여넣으세요"
              placeholderTextColor={TOKENS.sub}
              value={settings.jdText}
              onChangeText={(t)=>setSettings({ jdText: t })}
              multiline
            />

            <View style={{ height:8 }} />
            <Button
                label={extracting ? "추출 중..." : "키워드 추출"}
                onPress={extractKeywords}
                variant='secondary'
                disabled={extracting}
            />
            
            {!!keywords.length && (
              <View style={s.row}>
                {keywords.map(k => <Chip key={k} label={k} />)}
              </View>
            )}
          </View>
        )}

        {/* ===== CTA ===== */}
        <Button label="세트 시작하기" onPress={start} disabled={loading} />
        {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  appbar: {
    height: 40,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    paddingHorizontal: 2,
  },
  brand: { fontWeight:'800', letterSpacing: 1, color: TOKENS.label },
  proBadge: { fontSize:12, fontWeight:'700', color: TOKENS.label },

  label: { fontSize:12, color: TOKENS.label },
  input: {
    borderWidth:1, borderColor: TOKENS.border, borderRadius: 12,
    padding: 12, backgroundColor: '#fff', marginTop: 8, color: TOKENS.label,
  },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: TOKENS.border, backgroundColor: TOKENS.cardBg,
  },
  chipText: { fontSize: 12, color: TOKENS.label },

  segmented: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: TOKENS.border,
    borderRadius: 12, overflow: 'hidden', marginTop: 8,
    backgroundColor: TOKENS.cardBg,
  },
  segment: { flex:1, paddingVertical: 10, alignItems:'center', backgroundColor: TOKENS.cardBg },
  segmentActive: { backgroundColor: '#111827' },
  segmentText: { fontSize: 13, color: TOKENS.label },
  segmentTextActive: { color:'#fff', fontWeight:'700' },

  btn: {
    backgroundColor: '#111827', height: 52, borderRadius: 14,
    alignItems:'center', justifyContent:'center',
  },
  btnSecondary: { backgroundColor: TOKENS.cardBg, borderWidth: 1, borderColor: TOKENS.border },
  btnText: { color:'#fff', fontSize:16, fontWeight:'700' },
  btnTextSecondary: { color: TOKENS.label },
});

export default Home;
