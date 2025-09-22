// hook/useRecorder.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAudioRecorder,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from 'expo-audio';
import { Audio } from 'expo-av';

type MeteringStatus = { metering?: number | null };

/** WAV(Linear PCM) 16kHz mono 녹음 옵션 */
const WAV_RECORDING_OPTIONS: any = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    // ✅ 최신 enum 이름
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000, // 무시될 수 있음
  },
  ios: {
    extension: '.wav',
    // LINEAR PCM(WAV)
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.LOW,
    sampleRate: 16000,
    numberOfChannels: 1,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export function useRecorder(preaskKey = 'mic_preask_done_v1') {
  const [isRecording, setIsRecording] = useState(false);
  const isRecRef = useRef(false);
  useEffect(() => { isRecRef.current = isRecording; }, [isRecording]);

  const [remain, setRemain] = useState(90);
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const [level, setLevel] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(
    WAV_RECORDING_OPTIONS,
    (st: unknown) => {
      const m = (st as MeteringStatus)?.metering;
      if (typeof m === 'number') {
        const norm = Math.min(1, Math.max(0, (m + 160) / 160));
        setLevel(prev => prev * 0.6 + norm * 0.4);
      } else {
        setLevel(prev => prev * 0.75 + 0.25 * (0.3 + Math.random() * 0.7));
      }
    }
  );

  const start = useCallback(async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();

    setIsRecording(true);
    setAudioUri(undefined);
    setRemain(90);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemain(r => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          // 자동 종료
          stop().catch(() => {});
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  const stop = useCallback(async () => {
    try {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (isRecRef.current) {
        await recorder.stop();
        setAudioUri(recorder.uri ?? undefined);
      }
    } finally {
      setIsRecording(false);
      setLevel(0);
    }
  }, [recorder]);

  const askAndToggle = useCallback(async () => {
    try {
      const perm = await getRecordingPermissionsAsync();
      const shown = await AsyncStorage.getItem(preaskKey);

      if (!shown) {
        await AsyncStorage.setItem(preaskKey, '1');
        if (perm.granted) {
          Alert.alert('마이크 사용 안내', '지금부터 마이크 녹음을 시작할게요.', [
            { text: '취소', style: 'cancel' },
            { text: '시작', onPress: () => start() },
          ]);
          return;
        }
        if (perm.status === 'undetermined') {
          Alert.alert('마이크 사용 안내', '다음 단계에서 OS 권한을 요청합니다.', [
            { text: '취소', style: 'cancel' },
            {
              text: '동의하고 계속',
              onPress: async () => {
                const req = await requestRecordingPermissionsAsync();
                if (req.granted) await start();
                else Alert.alert('마이크 권한 필요', '설정에서 마이크 권한을 허용해주세요.');
              },
            },
          ]);
          return;
        }
        Alert.alert('마이크 권한이 꺼져 있어요', '설정에서 마이크 권한을 허용하면 녹음이 가능합니다.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings?.() },
        ]);
        return;
      }

      // 안내 이후: 바로 토글
      if (perm.granted) { isRecRef.current ? await stop() : await start(); return; }
      if (perm.status === 'undetermined') {
        const req = await requestRecordingPermissionsAsync();
        if (req.granted) await start();
        else Alert.alert('마이크 권한 필요', '설정에서 마이크 권한을 허용해주세요.');
        return;
      }
      Alert.alert('마이크 권한이 꺼져 있어요', '설정에서 마이크 권한을 허용하면 녹음이 가능합니다.', [
        { text: '취소', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings?.() },
      ]);
    } catch (e) {
      console.warn('askAndToggle error', e);
    }
  }, [preaskKey, start, stop]);

  useEffect(() => {
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (isRecRef.current) { recorder.stop().catch(() => {}); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    setAudioUri(undefined);
    setRemain(90);
    setLevel(0);
  }, []);

  return {
    isRecording, remain, audioUri, level,
    askAndToggle, start, stop,
    clear,
  };
}
