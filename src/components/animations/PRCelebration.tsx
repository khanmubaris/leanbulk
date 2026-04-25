import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

const PARTICLE_COUNT = 20;
const PARTICLE_COLORS = [
  colors.primary,
  colors.accent,
  colors.gold,
  '#00C4FF',
  '#FF6BFF',
  colors.primary,
];

interface ParticleData {
  angle: number;
  distance: number;
  size: number;
  color: string;
  spinDir: number;
}

const Particle = ({ data, progress }: { data: ParticleData; progress: Animated.Value }) => {
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(data.angle) * data.distance],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(data.angle) * data.distance - 40],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 1.3, 0.2],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 * data.spinDir}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: data.size,
        height: data.size,
        borderRadius: data.size / 2,
        backgroundColor: data.color,
        opacity,
        transform: [{ translateX }, { translateY }, { scale }, { rotate }],
      }}
    />
  );
};

interface PRCelebrationProps {
  visible: boolean;
  exerciseName: string;
  metricLabel: string;
  onDismiss: () => void;
}

export const PRCelebration = ({ visible, exerciseName, metricLabel, onDismiss }: PRCelebrationProps) => {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.5)).current;
  const particleProgress = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  const particles = useMemo<ParticleData[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      distance: 80 + Math.random() * 140,
      size: 6 + Math.random() * 8,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      spinDir: i % 2 === 0 ? 1 : -1,
    })),
  []);

  useEffect(() => {
    if (!visible) return;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);

    overlayOpacity.setValue(0);
    contentScale.setValue(0.5);
    particleProgress.setValue(0);
    badgeScale.setValue(0);

    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(contentScale, { toValue: 1, damping: 12, stiffness: 180, useNativeDriver: true }),
      Animated.timing(particleProgress, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(badgeScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(contentScale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        onDismiss();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="auto">
      <Animated.View style={[styles.content, { transform: [{ scale: contentScale }] }]}>
        {/* Particles */}
        <View style={styles.particleContainer}>
          {particles.map((data, i) => (
            <Particle key={i} data={data} progress={particleProgress} />
          ))}
        </View>

        {/* Badge */}
        <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.trophyEmoji}>🏆</Text>
        </Animated.View>

        <Text style={styles.prTitle}>New Personal Record!</Text>
        <Text style={styles.prExercise}>{exerciseName}</Text>
        <Text style={styles.prMetric}>{metricLabel}</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,15,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  particleContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trophyEmoji: {
    fontSize: 36,
  },
  prTitle: {
    fontSize: 24,
    fontFamily: fonts.black,
    color: colors.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  prExercise: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  prMetric: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

