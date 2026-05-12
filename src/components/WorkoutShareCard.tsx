import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { formatDateForDisplay } from '../utils/date';
import { EditableExerciseDraft, WorkoutType } from '../models/types';

interface Props {
  date: string;
  type: WorkoutType;
  exercises: EditableExerciseDraft[];
  totalSets: number;
}

const totalLoad = (exercises: EditableExerciseDraft[]): number => {
  let load = 0;
  for (const ex of exercises) {
    for (const set of ex.sets) {
      const w = parseFloat(set.weight);
      const r = parseInt(set.reps, 10);
      if (isFinite(w) && isFinite(r)) load += w * r;
    }
  }
  return load;
};

const bestSet = (exercise: EditableExerciseDraft): string => {
  let bestW = 0;
  let bestR = 0;
  for (const set of exercise.sets) {
    const w = parseFloat(set.weight);
    const r = parseInt(set.reps, 10);
    if (isFinite(w) && isFinite(r) && w > bestW) { bestW = w; bestR = r; }
  }
  if (bestW === 0) return '';
  return `${bestW} kg × ${bestR}`;
};

export const WorkoutShareCard = React.forwardRef<View, Props>(
  ({ date, type, exercises, totalSets }, ref) => {
    const load = totalLoad(exercises);
    const filledExercises = exercises.filter((e) => e.name.trim() && e.sets.some((s) => s.weight.trim() && s.reps.trim()));

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>LeanBulk</Text>
            <Text style={styles.sessionMeta}>{formatDateForDisplay(date)} · {type.toUpperCase()}</Text>
          </View>
          <View style={[styles.typeBadge, type === 'upper' ? styles.typeBadgeUpper : styles.typeBadgeLower]}>
            <Text style={[styles.typeBadgeText, type === 'upper' ? styles.typeBadgeTextUpper : styles.typeBadgeTextLower]}>
              {type.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{filledExercises.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{Math.round(load).toLocaleString()}</Text>
            <Text style={styles.statLabel}>kg lifted</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Exercise list */}
        {filledExercises.slice(0, 6).map((ex) => {
          const best = bestSet(ex);
          if (!best) return null;
          return (
            <View key={ex.name} style={styles.exerciseRow}>
              <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
              <Text style={styles.exerciseBest}>{best}</Text>
            </View>
          );
        })}
        {filledExercises.length > 6 ? (
          <Text style={styles.moreText}>+{filledExercises.length - 6} more exercises</Text>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Tracked with LeanBulk</Text>
        </View>
      </View>
    );
  }
);

WorkoutShareCard.displayName = 'WorkoutShareCard';

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#0D0D18',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,232,159,0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  appName: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  sessionMeta: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeBadgeUpper: { borderColor: 'rgba(0,232,159,0.3)', backgroundColor: colors.primarySoft },
  typeBadgeLower: { borderColor: 'rgba(255,107,53,0.3)', backgroundColor: colors.accentSoft },
  typeBadgeText: { fontSize: 11, fontFamily: fonts.bold },
  typeBadgeTextUpper: { color: colors.primary },
  typeBadgeTextLower: { color: colors.accent },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  exerciseName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  exerciseBest: {
    fontSize: 13,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
  },
  moreText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xs,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
});
