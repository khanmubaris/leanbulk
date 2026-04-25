import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
import { SkeletonCard, SkeletonMetricRow } from '../components/animations/SkeletonLoader';
import { AnimatedCounter } from '../components/animations/AnimatedCounter';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

const WEEKLY_TARGET = 4;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const sessionTotals = (session: WorkoutSessionWithExercises | null): { reps: number; loadKg: number } => {
  if (!session) return { reps: 0, loadKg: 0 };
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
  if (value > 0) return `+${value}`;
  if (value < 0) return `-${Math.abs(value)}`;
  return '0';
};

const formatLoadDelta = (value: number): string => `${signed(Math.round(value))} kg`;
const formatRepsDelta = (value: number): string => `${signed(Math.round(value))} reps`;

const GREETINGS = [
  'Push harder today.',
  'Consistency wins.',
  'One more rep.',
  'Build the habit.',
  'Stay relentless.',
];

const getGreeting = (): string => {
  const dayIndex = new Date().getDay();
  return GREETINGS[dayIndex % GREETINGS.length];
};

export default function HomeScreen() {
  const router = useRouter();
  const { refreshToken } = useAppRefresh();
  const { session } = useAuth();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [deltaText, setDeltaText] = useState<string | null>(null);
  const [quickType, setQuickType] = useState<WorkoutType>('upper');
  const [weekDayMap, setWeekDayMap] = useState<Record<number, WorkoutType | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setIsLoading(true);
        let nextSummary: HomeSummary;
        let sessions: Awaited<ReturnType<typeof listWorkoutSessions>>;

        try {
          nextSummary = await getHomeSummary();
        } catch (err) {
          if (__DEV__) console.warn('HomeScreen: getHomeSummary failed:', err);
          nextSummary = { todayDate: todayDateKey(), todayWorkoutCount: 0, lastWorkout: null };
        }

        try {
          sessions = await listWorkoutSessions('all');
        } catch (err) {
          if (__DEV__) console.warn('HomeScreen: listWorkoutSessions failed:', err);
          sessions = [];
        }

        if (!active) return;

        setSummary(nextSummary);
        setQuickType(nextSummary.lastWorkout?.type ?? 'upper');

        // Build week day map
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);

        const dayMap: Record<number, WorkoutType | null> = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const dateStr = d.toISOString().split('T')[0];
          const sessionForDay = sessions.find((s) => s.date === dateStr);
          dayMap[i] = sessionForDay ? sessionForDay.type : null;
        }
        setWeekDayMap(dayMap);

        const weekStart = addDays(todayDateKey(), -6);
        const thisWeekCount = sessions.filter((item) => item.date >= weekStart).length;
        setWeeklyCount(thisWeekCount);

        if (!nextSummary.lastWorkout) {
          setDeltaText(null);
          setIsLoading(false);
          return;
        }

        const previousOfSameType = sessions.find(
          (item) => item.id !== nextSummary.lastWorkout?.id && item.type === nextSummary.lastWorkout?.type
        );

        if (!previousOfSameType) {
          setDeltaText('First logged session for this split.');
          setIsLoading(false);
          return;
        }

        let previousDetail: WorkoutSessionWithExercises | null = null;
        try {
          previousDetail = await getWorkoutSessionById(previousOfSameType.id);
        } catch (err) {
          if (__DEV__) console.warn('HomeScreen: getWorkoutSessionById failed:', err);
        }
        if (!active) return;

        const latestTotals = sessionTotals(nextSummary.lastWorkout);
        const previousTotals = sessionTotals(previousDetail);
        const repsDelta = latestTotals.reps - previousTotals.reps;
        const loadDelta = latestTotals.loadKg - previousTotals.loadKg;

        setDeltaText(`${formatRepsDelta(repsDelta)} · ${formatLoadDelta(loadDelta)} vs prev ${nextSummary.lastWorkout.type.toUpperCase()}`);
        setIsLoading(false);
      };

      void load();
      return () => { active = false; };
    }, [refreshToken, session])
  );

  const goToWorkout = (presetType: WorkoutType) => {
    router.push(`/workouts/entry?presetType=${presetType}`);
  };

  const openLastWorkout = () => {
    if (!summary?.lastWorkout?.id) return;
    router.push(`/workouts/entry?sessionId=${summary.lastWorkout.id}`);
  };

  const lastWorkout = summary?.lastWorkout;
  const weeklyProgress = useMemo(() => Math.min(1, weeklyCount / WEEKLY_TARGET), [weeklyCount]);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: weeklyProgress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [weeklyProgress]);

  const circumference = 2 * Math.PI * 38;
  const strokeOffset = circumference * (1 - weeklyProgress);

  const lastTotals = useMemo(() => sessionTotals(lastWorkout ?? null), [lastWorkout]);

  // Determine today's index (0=Mon)
  const todayDayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero header */}
      <View style={styles.heroRow}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>{getGreeting()}</Text>
          <Text style={styles.heroDate}>{formatDateForDisplay(summary?.todayDate ?? todayDateKey())}</Text>
        </View>
        <View style={styles.ringContainer}>
          <Svg width={84} height={84} viewBox="0 0 92 92">
            <Circle cx={46} cy={46} r={38} fill="none" stroke={colors.primarySoft} strokeWidth={5} />
            <Circle
              cx={46} cy={46} r={38}
              fill="none"
              stroke={colors.primary}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              rotation={-90}
              origin="46,46"
            />
          </Svg>
          <View style={styles.ringTextWrap}>
            <Text style={styles.ringValue}>{weeklyCount}</Text>
            <Text style={styles.ringLabel}>/ {WEEKLY_TARGET}</Text>
          </View>
        </View>
      </View>

      {/* Week day dots */}
      <View style={styles.dayDotsRow}>
        {DAY_LABELS.map((label, i) => {
          const type = weekDayMap[i] ?? null;
          const isToday = i === todayDayIndex;
          return (
            <View key={label} style={styles.dayDotWrap}>
              <View style={[
                styles.dayDotCircle,
                type && styles.dayDotFilled,
                type === 'lower' && styles.dayDotLower,
                isToday && !type && styles.dayDotToday,
              ]}>
                <Text style={[
                  styles.dayDotChar,
                  type && styles.dayDotCharFilled,
                  type === 'lower' && styles.dayDotCharLower,
                ]}>
                  {type ? type[0].toUpperCase() : ''}
                </Text>
              </View>
              <Text style={[styles.dayDotLabel, isToday && styles.dayDotLabelToday]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* Quick start card */}
      <Text style={styles.sectionLabel}>Quick start</Text>
      <Card style={styles.quickStartCard}>
        {weeklyCount >= 3 ? (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 On a roll this week</Text>
          </View>
        ) : null}
        <SegmentedControl
          value={quickType}
          options={[
            { label: 'Upper', value: 'upper' },
            { label: 'Lower', value: 'lower' },
          ]}
          onChange={(value) => setQuickType(value as WorkoutType)}
        />
        {lastWorkout && lastWorkout.type === quickType ? (
          <Text style={styles.hintText}>
            Your last <Text style={styles.hintBold}>{quickType.toUpperCase()}</Text> template is pre-loaded with last-used values.
          </Text>
        ) : null}
        <AppButton
          label={`Start ${quickType.toUpperCase()} Session`}
          onPress={() => goToWorkout(quickType)}
          accessibilityLabel={`Start ${quickType} session`}
        />
      </Card>

      {/* Last session */}
      <Text style={styles.sectionLabel}>Last session</Text>
      {isLoading ? (
        <>
          <SkeletonCard />
        </>
      ) : (
      <Card style={styles.cardGap}>
        {lastWorkout ? (
          <>
            <View style={styles.lastSessionHeader}>
              <Text style={styles.lastSessionDate}>
                {formatDateForDisplay(lastWorkout.date)} · {lastWorkout.type.toUpperCase()}
              </Text>
              {deltaText && deltaText.includes('+') ? (
                <View style={styles.volBadge}>
                  <Text style={styles.volBadgeText}>↑ PR</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricTile}>
                <AnimatedCounter value={lastWorkout.exercises.length} style={styles.metricValue} />
                <Text style={styles.metricLabel}>Exercises</Text>
              </View>
              <View style={styles.metricTile}>
                <AnimatedCounter
                  value={lastWorkout.exercises.reduce((t, e) => t + e.sets.length, 0)}
                  style={styles.metricValue}
                />
                <Text style={styles.metricLabel}>Sets</Text>
              </View>
              <View style={styles.metricTile}>
                <AnimatedCounter
                  value={lastTotals.loadKg > 0 ? Math.round(lastTotals.loadKg) : 0}
                  style={styles.metricValue}
                  duration={1200}
                />
                <Text style={styles.metricLabel}>kg load</Text>
              </View>
            </View>
            {deltaText ? <Text style={styles.deltaText}>{deltaText}</Text> : null}
            <View style={styles.buttonRow}>
              <AppButton label="Repeat" onPress={() => goToWorkout(lastWorkout.type)} variant="secondary" style={styles.flex1} />
              <AppButton label="Review" onPress={openLastWorkout} variant="ghost" style={styles.flex1} />
            </View>
          </>
        ) : (
          <EmptyState title="No workouts yet" description="Start with your first Upper or Lower session." />
        )}
      </Card>
      )}

      {/* Momentum */}
      <Text style={styles.sectionLabel}>Momentum</Text>
      <Card style={styles.cardGap}>
        <View style={styles.momentumHeader}>
          <Text style={styles.momentumText}>{weeklyCount} of {WEEKLY_TARGET} sessions this week</Text>
          <Text style={styles.momentumPercent}>{Math.round(weeklyProgress * 100)}%</Text>
        </View>
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
        <Text style={styles.helperText}>
          {weeklyCount >= WEEKLY_TARGET
            ? 'Target hit! Keep the momentum going.'
            : `${WEEKLY_TARGET - weeklyCount} more session${WEEKLY_TARGET - weeklyCount === 1 ? '' : 's'} to hit your target.`}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  heroTextWrap: { flex: 1 },
  heroTitle: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  heroDate: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    fontFamily: fonts.medium,
  },
  ringContainer: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTextWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringValue: {
    color: colors.primary,
    fontSize: 26,
    fontFamily: fonts.black,
    lineHeight: 30,
  },
  ringLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.bold,
    marginTop: -2,
  },
  dayDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dayDotWrap: {
    alignItems: 'center',
    gap: 4,
  },
  dayDotCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dayDotLower: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dayDotToday: {
    borderColor: colors.textSecondary,
  },
  dayDotChar: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  dayDotCharFilled: {
    color: colors.primary,
  },
  dayDotCharLower: {
    color: colors.accent,
  },
  dayDotLabel: {
    fontSize: 9,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  dayDotLabelToday: {
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingLeft: 2,
  },
  quickStartCard: {
    gap: spacing.sm,
    borderColor: 'rgba(0,232,159,0.08)',
  },
  streakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.accent,
  },
  hintText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  hintBold: {
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  cardGap: { gap: spacing.sm },
  lastSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastSessionDate: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  volBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  volBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricTile: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 20,
    fontFamily: fonts.monoBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deltaText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: { flex: 1 },
  momentumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  momentumText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  momentumPercent: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
});

