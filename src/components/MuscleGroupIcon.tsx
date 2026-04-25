import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

type MuscleGroup = 'chest' | 'shoulders' | 'back' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'calves' | 'glutes' | 'core' | 'full';

const EXERCISE_MAP: Record<string, MuscleGroup> = {
  // Chest
  'bench press': 'chest', 'incline dumbbell press': 'chest', 'machine chest press': 'chest',
  'cable fly': 'chest', 'chest press': 'chest', 'push ups': 'chest', 'dumbbell fly': 'chest',
  'incline bench press': 'chest', 'decline bench press': 'chest',
  // Shoulders
  'ohp': 'shoulders', 'overhead press': 'shoulders', 'shoulder press': 'shoulders',
  'dumbbell lateral raises': 'shoulders', 'lateral raises': 'shoulders',
  'seated dumbbell shoulder press': 'shoulders', 'face pulls': 'shoulders',
  'front raises': 'shoulders', 'arnold press': 'shoulders',
  // Back
  'cable rows': 'back', 'lat pulldown': 'back', 'pull ups': 'back', 'chin ups': 'back',
  'barbell row': 'back', 'dumbbell row': 'back', 'seated row': 'back', 't-bar row': 'back',
  // Biceps
  'dumbbell curls': 'biceps', 'curls': 'biceps', 'barbell curls': 'biceps',
  'hammer curls': 'biceps', 'preacher curls': 'biceps', 'cable curls': 'biceps',
  // Triceps
  'rope pushdowns': 'triceps', 'tricep pushdown': 'triceps', 'skull crushers': 'triceps',
  'dips': 'triceps', 'close grip bench': 'triceps', 'overhead tricep extension': 'triceps',
  // Quads
  'squat': 'quads', 'leg press': 'quads', 'leg extension': 'quads',
  'front squat': 'quads', 'lunges': 'quads', 'hack squat': 'quads', 'goblet squat': 'quads',
  // Hamstrings
  'deadlift': 'hamstrings', 'seated leg curl': 'hamstrings', 'leg curl': 'hamstrings',
  'romanian deadlift': 'hamstrings', 'stiff leg deadlift': 'hamstrings',
  'good mornings': 'hamstrings', 'nordic curl': 'hamstrings',
  // Calves
  'calf raises': 'calves', 'seated calf raise': 'calves', 'standing calf raise': 'calves',
  // Glutes
  'hip thrust': 'glutes', 'glute bridge': 'glutes', 'cable kickback': 'glutes',
  // Core
  'plank': 'core', 'crunches': 'core', 'ab wheel': 'core', 'hanging leg raise': 'core',
};

const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: colors.primary,
  shoulders: '#00C4FF',
  back: '#FF6BFF',
  biceps: colors.accent,
  triceps: colors.gold,
  quads: colors.primary,
  hamstrings: colors.accent,
  calves: '#00C4FF',
  glutes: '#FF6BFF',
  core: colors.gold,
  full: colors.textMuted,
};

const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: '胸', shoulders: '肩', back: '背', biceps: '💪', triceps: '三',
  quads: '腿', hamstrings: '腿', calves: '小', glutes: '臀', core: '腹', full: '●',
};

function getMuscleGroup(exerciseName: string): MuscleGroup {
  const lower = exerciseName.trim().toLowerCase();
  return EXERCISE_MAP[lower] ?? 'full';
}

interface MuscleGroupIconProps {
  exerciseName: string;
  size?: number;
  style?: ViewStyle;
}

export const MuscleGroupIcon = ({ exerciseName, size = 32, style }: MuscleGroupIconProps) => {
  const group = getMuscleGroup(exerciseName);
  const iconColor = MUSCLE_COLORS[group];
  const bgColor = `${iconColor}18`;

  return (
    <View style={[
      {
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}>
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        {group === 'chest' && (
          <>
            <Ellipse cx={8} cy={12} rx={6} ry={7} fill="none" stroke={iconColor} strokeWidth={2} />
            <Ellipse cx={16} cy={12} rx={6} ry={7} fill="none" stroke={iconColor} strokeWidth={2} />
          </>
        )}
        {group === 'shoulders' && (
          <>
            <Path d="M4 16 C4 8 12 4 12 4 C12 4 20 8 20 16" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={12} cy={16} r={3} fill="none" stroke={iconColor} strokeWidth={2} />
          </>
        )}
        {group === 'back' && (
          <>
            <Path d="M12 2 L12 22" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
            <Path d="M6 6 L12 10 L18 6" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M6 14 L12 18 L18 14" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {(group === 'biceps' || group === 'triceps') && (
          <>
            <Path d="M6 18 C6 12 8 8 12 6 C16 8 18 12 18 18" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
            <Ellipse cx={12} cy={12} rx={4} ry={3} fill="none" stroke={iconColor} strokeWidth={1.5} />
          </>
        )}
        {(group === 'quads' || group === 'hamstrings') && (
          <>
            <Rect x={4} y={2} width={6} height={20} rx={3} fill="none" stroke={iconColor} strokeWidth={2} />
            <Rect x={14} y={2} width={6} height={20} rx={3} fill="none" stroke={iconColor} strokeWidth={2} />
          </>
        )}
        {group === 'calves' && (
          <>
            <Path d="M8 4 C8 4 6 12 8 20" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
            <Path d="M16 4 C16 4 18 12 16 20" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
          </>
        )}
        {group === 'glutes' && (
          <>
            <Ellipse cx={8} cy={12} rx={5} ry={8} fill="none" stroke={iconColor} strokeWidth={2} />
            <Ellipse cx={16} cy={12} rx={5} ry={8} fill="none" stroke={iconColor} strokeWidth={2} />
          </>
        )}
        {group === 'core' && (
          <>
            <Rect x={4} y={2} width={16} height={20} rx={4} fill="none" stroke={iconColor} strokeWidth={2} />
            <Line x1={12} y1={4} x2={12} y2={20} stroke={iconColor} strokeWidth={1.5} />
            <Line x1={6} y1={9} x2={18} y2={9} stroke={iconColor} strokeWidth={1} />
            <Line x1={6} y1={15} x2={18} y2={15} stroke={iconColor} strokeWidth={1} />
          </>
        )}
        {group === 'full' && (
          <Circle cx={12} cy={12} r={8} fill="none" stroke={iconColor} strokeWidth={2} />
        )}
      </Svg>
    </View>
  );
};

export { getMuscleGroup, MUSCLE_COLORS, type MuscleGroup };

