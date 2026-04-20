import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getHomeSummary, getWorkoutSessionById, listWorkoutSessions } from '../db/database';
import { HomeSummary, WorkoutSessionWithExercises, WorkoutType } from '../models/types';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useAuth } from '../backend/auth';
import { addDays, formatDateForDisplay, todayDateKey } from '../utils/date';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

const WEEKLY_TARGET = 4;

const sessionTotals = (session: WorkoutSessionWithExercises | null): { reps: number; loadKg: number } => {
  if (!session) {
    return { reps: 0, loadKg: 0 };
  }

  let reps = 0;
  let loadKg = 0;

  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      reps += set.reps;
      loadKg += set.weight * set.reps;
    });
  });

  return { reps, loadKg };
};

const signed = (value: number): string => {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `-${Math.abs(value)}`;
  }

  return '0';
};

const formatLoadDelta = (value: number): string => {
  const rounded = Math.round(value);
  return `${signed(rounded)} kg load`;
};

const formatRepsDelta = (value: number): string => {
  return `${signed(Math.round(value))} reps`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { refreshToken } = useAppRefresh();
  const { session } = useAuth();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [deltaText, setDeltaText] = useState<string | null>(null);
  const [quickType, setQuickType] = useState<WorkoutType>('upper');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        let nextSummary: HomeSummary;
        let sessions: Awaited<ReturnType<typeof listWorkoutSessions>>;

        try {
          nextSummary = await getHomeSummary();
        } catch (err) {
          if (__DEV__) {
            console.warn('HomeScreen: getHomeSummary failed:', err);
          }
          nextSummary = { todayDate: todayDateKey(), todayWorkoutCount: 0, lastWorkout: null };
        }

        try {
          sessions = await listWorkoutSessions('all');
        } catch (err) {
          if (__DEV__) {
            console.warn('HomeScreen: listWorkoutSessions failed:', err);
          }
          sessions = [];
        }

        if (!active) {
          return;
        }

        setSummary(nextSummary);
        setQuickType(nextSummary.lastWorkout?.type ?? 'upper');

        const weekStart = addDays(todayDateKey(), -6);
        const thisWeekCount = sessions.filter((item) => item.date >= weekStart).length;
        setWeeklyCount(thisWeekCount);

        if (!nextSummary.lastWorkout) {
          setDeltaText(null);
          return;
        }

        const previousOfSameType = sessions.find(
          (item) => item.id !== nextSummary.lastWorkout?.id && item.type === nextSummary.lastWorkout?.type
        );

        if (!previousOfSameType) {
          setDeltaText('First logged session for this split.');
          return;
        }

        let previousDetail: WorkoutSessionWithExercises | null = null;
        try {
          previousDetail = await getWorkoutSessionById(previousOfSameType.id);
        } catch (err) {
          if (__DEV__) {
            console.warn('HomeScreen: getWorkoutSessionById failed:', err);
          }
        }

        if (!active) {
          return;
        }

        const latestTotals = sessionTotals(nextSummary.lastWorkout);
        const previousTotals = sessionTotals(previousDetail);

        const repsDelta = latestTotals.reps - previousTotals.reps;
        const loadDelta = latestTotals.loadKg - previousTotals.loadKg;

        setDeltaText(`${formatRepsDelta(repsDelta)} · ${formatLoadDelta(loadDelta)} vs previous ${nextSummary.lastWorkout.type.toUpperCase()}`);
      };

      void load();

      return () => {
        active = false;
      };
    }, [refreshToken, session])
  );

  const goToWorkout = (presetType: WorkoutType) => {
    router.push(`/workouts/entry?presetType=${presetType}`);
  };

  const openLastWorkout = () => {
    if (!summary?.lastWorkout?.id) {
      return;
    }
    router.push(`/workouts/entry?sessionId=${summary.lastWorkout.id}`);
  };

  const lastWorkout = summary?.lastWorkout;

  const weeklyProgress = useMemo(() => {
    return Math.min(1, weeklyCount / WEEKLY_TARGET);
  }, [weeklyCount]);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: weeklyProgress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [weeklyProgress]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Command Center</Text>
          <Text style={styles.subtitle}>{formatDateForDisplay(summary?.todayDate ?? todayDateKey())}</Text>
        </View>
        <View style={styles.weeklyBadge}>
          <Text style={styles.weeklyBadgeValue}>{weeklyCount}</Text>
          <Text style={styles.weeklyBadgeLabel}>/ {WEEKLY_TARGET}</Text>
        </View>
      </View>

      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Start session</Text>
        <SegmentedControl
          value={quickType}
          options={[
            { label: 'Upper', value: 'upper' },
            { label: 'Lower', value: 'lower' },
          ]}
          onChange={(value) => setQuickType(value as WorkoutType)}
        />
        <AppButton
          label={`Start ${quickType.toUpperCase()} Session`}
          onPress={() => goToWorkout(quickType)}
          accessibilityLabel={`Start ${quickType} session`}
        />
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Weekly momentum</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.metricText}>
          {weeklyCount} of {WEEKLY_TARGET} sessions logged in the last 7 days
        </Text>
        {deltaText ? <Text style={styles.helperText}>{deltaText}</Text> : null}
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Next best action</Text>
        {lastWorkout ? (
          <>
            <Text style={styles.metricText}>
              Repeat last {lastWorkout.type.toUpperCase()} template with last-used values.
            </Text>
            <View style={styles.buttonRow}>
              <AppButton
                label={`Repeat ${lastWorkout.type.toUpperCase()}`}
                onPress={() => goToWorkout(lastWorkout.type)}
                style={styles.flexButton}
              />
              <AppButton label="Review Last" variant="secondary" onPress={openLastWorkout} style={styles.flexButton} />
            </View>
          </>
        ) : (
          <EmptyState title="No workouts yet" description="Start with your first Upper or Lower session." />
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Last workout</Text>
        {lastWorkout ? (
          <>
            <Text style={styles.metricText}>
              {formatDateForDisplay(lastWorkout.date)} · {lastWorkout.type.toUpperCase()}
            </Text>
            <Text style={styles.metricText}>Exercises: {lastWorkout.exercises.length}</Text>
            <Text style={styles.metricText}>
              Total sets: {lastWorkout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)}
            </Text>
            {lastWorkout.notes ? <Text style={styles.helperText}>{lastWorkout.notes}</Text> : null}
          </>
        ) : (
          <EmptyState title="No recent workout" description="Your latest session snapshot appears here." />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 36,
    fontFamily: fonts.black,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
    fontFamily: fonts.medium,
  },
  weeklyBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  weeklyBadgeValue: {
    color: colors.primary,
    fontSize: 28,
    fontFamily: fonts.black,
    lineHeight: 32,
  },
  weeklyBadgeLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.bold,
    marginTop: -2,
  },
  cardGap: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bold,
    letterSpacing: 0.1,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  metricText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
