// src/views/Setting.tsx
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TOKENS } from "@/theme/tokens";

export default function Setting() {
  const [hintEnabled, setHintEnabled] = useState(true);
  const [voiceData, setVoiceData] = useState(true);
  const [textData, setTextData] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [weaknessReminder, setWeaknessReminder] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* 구독 상태 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>구독 상태</Text>
          <View style={s.card}>
            <View>
              <Text style={s.title}>Free 플랜</Text>
              <Text style={s.sub}>기본 기능 이용 가능</Text>
            </View>
            <Pressable style={s.button}>
              <Text style={s.buttonText}>Pro 업그레이드</Text>
            </Pressable>
          </View>
        </View>

        {/* 연습 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>연습 설정</Text>
          <View style={s.card}>
            <Row label="답변 시간" value="90초" />
            <Row label="팔로업 최대 횟수" value="2회 (Pro 전용)" />
            <ToggleRow
              label="실시간 힌트"
              sub="답변 중 도움말 표시"
              value={hintEnabled}
              onValueChange={setHintEnabled}
            />
          </View>
        </View>

        {/* 개인정보 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>개인정보 설정</Text>
          <View style={s.card}>
            <ToggleRow
              label="음성 데이터 저장"
              sub="30일 후 자동 삭제"
              value={voiceData}
              onValueChange={setVoiceData}
            />
            <ToggleRow
              label="텍스트 데이터 저장"
              sub="분석 개선을 위한 데이터 활용"
              value={textData}
              onValueChange={setTextData}
            />
          </View>
        </View>

        {/* 알림 설정 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>알림 설정</Text>
          <View style={s.card}>
            <ToggleRow
              label="데일리 연습 알림"
              sub="매일 오후 7시"
              value={dailyReminder}
              onValueChange={setDailyReminder}
            />
            <ToggleRow
              label="약점 보완 알림"
              sub="주 2회 맞춤 추천"
              value={weaknessReminder}
              onValueChange={setWeaknessReminder}
            />
          </View>
        </View>

        {/* 약관 및 정책 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>약관 및 정책</Text>
          <View style={s.card}>
            <LinkRow label="이용약관" />
            <LinkRow label="개인정보처리방침" />
            <LinkRow label="면책사항" />
            <LinkRow label="환불 및 결제 정책" />
            <LinkRow label="고객지원" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={s.row}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value}</Text>
  </View>
);

const ToggleRow = ({
  label,
  sub,
  value,
  onValueChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={s.rowBetween}>
    <View>
      <Text style={s.label}>{label}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
    </View>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const LinkRow = ({ label }: { label: string }) => (
  <Pressable style={s.row}>
    <Text style={[s.label, { color: TOKENS.tint }]}>{label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.bg },
  scroll: { padding: 16, paddingBottom: 40, gap: 20 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: TOKENS.label },
  card: {
    backgroundColor: TOKENS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 16,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 15, fontWeight: "500", color: TOKENS.label },
  sub: { fontSize: 12, color: TOKENS.sub, marginTop: 4 },
  value: { fontSize: 15, color: TOKENS.sub },
  button: {
    backgroundColor: TOKENS.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },

  title: { fontSize: 15, fontWeight: "600", color: TOKENS.label},
});
