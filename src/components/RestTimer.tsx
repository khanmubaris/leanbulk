import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PRESETS = [60, 90, 120, 180];
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RestTimerProps {
  onDismiss?: () => void;
}

export const RestTimer = ({ onDismiss }: RestTimerProps) => {
  const [duration, setDuration] = useState(90);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const startTimer = useCallback((secs: number) => {
    setSecondsLeft(secs);
    setIsRunning(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: secs * 1000,
      useNativeDriver: false,
    }).start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
    setSecondsLeft(0);
    progress.stopAnimation();
    progress.setValue(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }, 200);
            return 0;
          }
          if (prev === 11) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, secondsLeft]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rest Timer</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.ringWrap}>
        <Svg width={128} height={128} viewBox="0 0 128 128">
          <Circle cx={64} cy={64} r={RADIUS} fill="none"
            stroke={colors.surfaceElevated} strokeWidth={6} />
          <AnimatedCircle cx={64} cy={64} r={RADIUS} fill="none"
            stroke={isRunning ? (secondsLeft <= 10 ? colors.accent : colors.primary) : colors.textMuted}
            strokeWidth={6} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            rotation={-90} origin="64,64"
          />
        </Svg>
        <View style={styles.ringTextWrap}>
          {isRunning || secondsLeft > 0 ? (
            <Text style={[styles.timerText, secondsLeft <= 10 && secondsLeft > 0 && styles.timerTextUrgent]}>
              {formatTime(secondsLeft)}
            </Text>
          ) : (
            <Text style={styles.timerReady}>Ready</Text>
          )}
        </View>
      </View>

      <View style={styles.presetsRow}>
        {PRESETS.map((secs) => (
          <Pressable
            key={secs}
            style={[styles.presetBtn, duration === secs && styles.presetBtnActive]}
            onPress={() => { setDuration(secs); if (!isRunning) startTimer(secs); }}
          >
            <Text style={[styles.presetText, duration === secs && styles.presetTextActive]}>
              {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.controlsRow}>
        {isRunning ? (
          <Pressable style={styles.stopBtn} onPress={stopTimer}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.startBtn} onPress={() => startTimer(duration)}>
            <Text style={styles.startBtnText}>
              {secondsLeft === 0 ? 'Start' : 'Restart'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  ringWrap: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTextWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 32,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  timerTextUrgent: {
    color: colors.accent,
  },
  timerReady: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  presetBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(0,232,159,0.25)',
  },
  presetText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  presetTextActive: {
    color: colors.primary,
  },
  controlsRow: {
    width: '100%',
  },
  startBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#060F0A',
  },
  stopBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,69,69,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.danger,
  },
});

