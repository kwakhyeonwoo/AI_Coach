import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Mode } from '../models/types';
import { useInterviewVM } from '../viewmodels/InterviewVM';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const Button: React.FC<{ label: string; onPress?: () => void; disabled?: boolean; variant?: 'primary'|'secondary' }>
= ({ label, onPress, disabled, variant='primary' }) => (
  <Pressable onPress={onPress} disabled={disabled}
    style={({ pressed }) => [
      styles.btn,
      variant==='secondary' && styles.btnSecondary,
      pressed && { opacity: 0.7 },
      disabled && { opacity: 0.4 },
    ]}
  >
    <Text style={[styles.btnText, variant==='secondary' && styles.btnTextSecondary]}>{label}</Text>
  </Pressable>
);

const Segmented: React.FC<{ options: string[]; value: string; onChange: (v:string)=>void }> = ({ options, value, onChange }) => (
  <View style={styles.segmented}>
    {options.map(o => (
      <Pressable key={o} onPress={() => onChange(o)} style={[styles.segment, value===o && styles.segmentActive]}>
        <Text style={[styles.segmentText, value===o && styles.segmentTextActive]}>{o}</Text>
      </Pressable>
    ))}
  </View>
);

const cardStyle = {
  backgroundColor: TOKENS.cardBg,
  borderRadius: TOKENS.cardRadius,
  padding: 12,
  borderWidth: 1,
  borderColor: TOKENS.border,
};

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>
);

const Home: React.FC<Props> = ({ navigation, route }) => {
  const { startNewSession, loading, settings, setSettings, setMode } = useInterviewVM();
  const [keywords, setKeywords] = useState<string[]>(settings.jdKeywords || []);

  const extractKeywords = () => {
    const text = settings.jdText || '';
    const words = text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').split(/\s+/).filter(w => w.length>=2);
    const freq: Record<string, number> = {};
    words.forEach(w=>{ freq[w]=(freq[w]||0)+1; });
    const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
    setKeywords(sorted);
    setSettings({ jdKeywords: sorted });
  };

  const start = async () => {
    const id = await startNewSession();
    navigation.navigate('Question', { sessionId: id });
  };

  const insets = useSafeAreaInsets();
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.appbar}>
        <Text style={{ fontWeight:'700' }}>[AI]</Text>
        <Pressable onPress={() => navigation.navigate('ProUpsell')}>
          <Text style={{ fontSize:12, fontWeight:'700' }}>[PRO]</Text>
        </Pressable>
      </View>

      {/* 회사/직무 카드 */}
      <View style={styles.card}>
        <Text style={styles.label}>회사(선택/입력)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 토스, 네이버"
          value={settings.company}
          onChangeText={(t)=>setSettings({ company: t })}
        />
        <Text style={[styles.label,{ marginTop:12 }]}>직무</Text>
        <Segmented
          options={['iOS','Android','Frontend','Backend','Data']}
          value={settings.role}
          onChange={(v)=>setSettings({ role: v })}
        />
      </View>

      {/* 모드 토글 */}
      <Text style={[styles.label,{ marginTop:16 }]}>모드</Text>
      <Segmented
        options={['Free','Pro']}
        value={settings.mode==='pro'?'Pro':'Free'}
        onChange={(v)=>setMode(v.toLowerCase() as Mode)}
      />

      {/* Pro: JD 입력/키워드 */}
      {settings.mode==='pro' && (
        <View style={[styles.card,{ marginTop:12 }]}>
          <Text style={styles.label}>JD URL/텍스트</Text>
          <TextInput
            style={[styles.input,{ minHeight:100, textAlignVertical:'top' }]}
            placeholder="JD를 붙여넣으세요"
            value={settings.jdText}
            onChangeText={(t)=>setSettings({ jdText: t })}
            multiline
          />
          <View style={{ height:8 }} />
          <Button label="키워드 추출" onPress={extractKeywords} variant='secondary' />
          <View style={styles.row}>
            {keywords.map(k => <Chip key={k} label={k} />)}
          </View>
        </View>
      )}

      <View style={{ height: 16 }} />
      <Button label="세트 시작하기" onPress={start} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}

      <View style={{ height: 16 }} />
      <View style={styles.row}>
        
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  appbar: { height: 44, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  card: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, borderWidth:1, borderColor:'#E5E7EB', marginTop:12 },
  label: { fontSize:12, color:'#111827' },
  input: { borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:12, backgroundColor:'#fff', marginTop:8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', marginRight: 8, marginTop: 8 },
  chipText: { fontSize: 12, color: '#111827' },
  segmented: { flexDirection: 'row', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, overflow:'hidden', marginTop:8 },
  segment: { flex:1, paddingVertical:10, alignItems:'center', backgroundColor:'#fff' },
  segmentActive: { backgroundColor:'#111827' },
  segmentText: { fontSize:13, color:'#111827' },
  segmentTextActive: { color:'#fff', fontWeight:'600' },
  btn: { backgroundColor: '#111827', height:48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnSecondary: { backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnTextSecondary: { color:'#111827' },
});

export default Home;
