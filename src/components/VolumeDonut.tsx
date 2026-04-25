import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface VolumeDonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export const VolumeDonut = ({
  segments,
  size = 140,
  strokeWidth = 14,
  centerLabel,
  centerValue,
}: VolumeDonutProps) => {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <Circle cx={center} cy={center} r={radius}
            fill="none" stroke={colors.surfaceElevated} strokeWidth={strokeWidth} />

          {/* Segments */}
          {segments.map((segment) => {
            const percent = segment.value / total;
            const dashLength = circumference * percent;
            const gapLength = circumference * (1 - percent);
            const rotation = cumulativePercent * 360 - 90;
            cumulativePercent += percent;

            return (
              <Circle
                key={segment.label}
                cx={center} cy={center} r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeLinecap="round"
                rotation={rotation}
                origin={`${center},${center}`}
                opacity={0.85}
              />
            );
          })}
        </Svg>

        {/* Center text */}
        {(centerLabel || centerValue) ? (
          <View style={[styles.centerWrap, { width: size, height: size }]}>
            {centerValue ? <Text style={styles.centerValue}>{centerValue}</Text> : null}
            {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
          </View>
        ) : null}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text style={styles.legendLabel}>{segment.label}</Text>
            <Text style={styles.legendValue}>{Math.round((segment.value / total) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  centerWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 20,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  centerLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontFamily: fonts.monoBold,
    color: colors.textMuted,
  },
});

