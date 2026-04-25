import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

const SkeletonBlock = ({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.surfaceElevated,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard = () => (
  <View style={styles.card}>
    <SkeletonBlock width={120} height={12} />
    <View style={styles.row}>
      <SkeletonBlock width="30%" height={48} borderRadius={10} />
      <SkeletonBlock width="30%" height={48} borderRadius={10} />
      <SkeletonBlock width="30%" height={48} borderRadius={10} />
    </View>
    <SkeletonBlock width="80%" height={12} />
    <SkeletonBlock width="60%" height={12} />
  </View>
);

export const SkeletonMetricRow = () => (
  <View style={styles.metricRow}>
    <SkeletonBlock height={72} borderRadius={10} style={{ flex: 1 }} />
    <SkeletonBlock height={72} borderRadius={10} style={{ flex: 1 }} />
    <SkeletonBlock height={72} borderRadius={10} style={{ flex: 1 }} />
  </View>
);

export { SkeletonBlock };

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

