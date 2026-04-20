import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getExerciseProgressSeries,
  getLastCloudSyncAt,
  getSettings,
  getWeeklyInsights,
  listRecordedExercisesByType,
} from '../db/database';
import {
  ExerciseProgressPoint,
  UnitPreference,
  WeeklyExerciseInsight,
  WeeklyInsights,
  WorkoutType,
} from '../models/types';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useAuth } from '../backend/auth';
import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import { AppButton } from '../components/AppButton';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { formatDateForDisplay, formatShortDay } from '../utils/date';
import { kgToLbs } from '../utils/number';

type SessionRangePreset = '3' | '10' | '20' | 'custom';
type ProgressViewMode = 'chart' | 'table';
type ChartMetric = 'maxWeightKg' | 'totalLoadKg' | 'totalReps';

const TARGET_WORKOUTS_PER_WEEK = 4;

const formatInteger = (value: number): string => {
  return Number.isFinite(value) ? Math.round(value).toString() : '0';
};

const adherenceLabel = (workoutCount: number): string => {
  const ratio = Math.min(1, workoutCount / TARGET_WORKOUTS_PER_WEEK);
  return `${Math.round(ratio * 100)}% of 4-session target`;
};

const metricLabel = (metric: ChartMetric): string => {
  switch (metric) {
    case 'maxWeightKg':
      return 'Top Weight';
    case 'totalLoadKg':
      return 'Total Load';
    case 'totalReps':
      return 'Total Reps';
    default:
      return 'Metric';
  }
};

const metricValueForPoint = (point: ExerciseProgressPoint, metric: ChartMetric): number => {
  switch (metric) {
    case 'maxWeightKg':
      return point.maxWeightKg;
    case 'totalLoadKg':
      return point.totalLoadKg;
    case 'totalReps':
      return point.totalReps;
    default:
      return 0;
  }
};

const toPreferredWeight = (valueKg: number, unitPreference: UnitPreference): number => {
  return unitPreference === 'kg' ? valueKg : kgToLbs(valueKg);
};

const formatMetricValue = (value: number, metric: ChartMetric, unitPreference: UnitPreference): string => {
  if (metric === 'totalReps') {
    return `${formatInteger(value)} reps`;
  }

  const converted = toPreferredWeight(value, unitPreference);
  const suffix = unitPreference === 'kg' ? 'kg' : 'lbs';
  return `${converted.toFixed(1)} ${suffix}`;
};

const formatLoad = (kgValue: number, unitPreference: UnitPreference): string => {
  const converted = toPreferredWeight(kgValue, unitPreference);
  const suffix = unitPreference === 'kg' ? 'kg' : 'lbs';
  return `${converted.toFixed(1)} ${suffix}`;
};

const formatSyncLabel = (iso: string | null): string => {
  if (!iso) {
    return 'No sync metadata yet';
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return parsed.toLocaleString();
};

const AnimatedRect = Animated.createAnimatedComponent(Rect as any);

const BAR_WIDTH = 36;
const BAR_GAP = 14;
const CHART_H = 180;
const LABEL_AREA = 44;

function SvgBarChart({
  points,
  metric,
  unitPreference,
  maxValue,
}: {
  points: ExerciseProgressPoint[];
  metric: ChartMetric;
  unitPreference: UnitPreference;
  maxValue: number;
}) {
  const anims = useRef<Animated.Value[]>([]);

  useEffect(() => {
    anims.current = points.map(() => new Animated.Value(0));
    const staggered = points.map((_, i) =>
      Animated.timing(anims.current[i], {
        toValue: 1,
        duration: 500,
        delay: i * 50,
        useNativeDriver: false,
      })
    );
    Animated.parallel(staggered).start();
  }, [points]);

  if (!points.length) return null;

  const svgWidth = points.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const svgHeight = CHART_H + LABEL_AREA;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xs }}>
      <Svg width={svgWidth} height={svgHeight}>
        {points.map((point, i) => {
          const value = metricValueForPoint(point, metric);
          const ratio = maxValue > 0 ? value / maxValue : 0;
          const fullBarH = Math.max(6, ratio * (CHART_H - 32));
          const x = BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
          const anim = anims.current[i];

          const barY = anim
            ? anim.interpolate({ inputRange: [0, 1], outputRange: [CHART_H, CHART_H - fullBarH] })
            : CHART_H - fullBarH;
          const barH = anim
            ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, fullBarH] })
            : fullBarH;

          return (
            <React.Fragment key={point.sessionId}>
              {anim ? (
                <AnimatedRect
                  x={x}
                  y={barY as any}
                  width={BAR_WIDTH}
                  height={barH as any}
                  rx={8}
                  fill={colors.primary}
                  opacity={0.9}
                />
              ) : (
                <Rect x={x} y={CHART_H - fullBarH} width={BAR_WIDTH} height={fullBarH} rx={8} fill={colors.primary} opacity={0.9} />
              )}
              <SvgText
                x={x + BAR_WIDTH / 2}
                y={CHART_H - fullBarH - 8}
                textAnchor="middle"
                fill={colors.textSecondary}
                fontSize={9}
                fontWeight="700"
              >
                {formatMetricValue(value, metric, unitPreference)}
              </SvgText>
              <SvgText
                x={x + BAR_WIDTH / 2}
                y={CHART_H + 18}
                textAnchor="middle"
                fill={colors.textMuted}
                fontSize={10}
                fontWeight="600"
              >
                {formatShortDay(point.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Line x1={0} y1={CHART_H} x2={svgWidth} y2={CHART_H} stroke={colors.border} strokeWidth={1} />
      </Svg>
    </ScrollView>
  );
}

export default function InsightsScreen() {
  const router = useRouter();
  const { refreshToken, refresh } = useAppRefresh();
  const { isBackendConfigured, loading: authLoading, session } = useAuth();

  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [unitPreference, setUnitPreference] = useState<UnitPreference>('kg');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(true);

  const [splitFilter, setSplitFilter] = useState<WorkoutType>('upper');
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [exerciseQuery, setExerciseQuery] = useState('');

  const [rangePreset, setRangePreset] = useState<SessionRangePreset>('10');
  const [customSessionCount, setCustomSessionCount] = useState('12');

  const [viewMode, setViewMode] = useState<ProgressViewMode>('chart');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('maxWeightKg');

  const [progressPoints, setProgressPoints] = useState<ExerciseProgressPoint[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const loadSummary = useCallback(async () => {
    setPrimaryLoading(true);

    try {
      const [weekly, settings, lastSync] = await Promise.all([
        getWeeklyInsights(7).catch((err) => {
          console.warn('getWeeklyInsights failed:', err?.message ?? err);
          return null;
        }),
        getSettings().catch((err) => {
          console.warn('getSettings failed:', err?.message ?? err);
          return null;
        }),
        getLastCloudSyncAt().catch((err) => {
          console.warn('getLastCloudSyncAt failed:', err?.message ?? err);
          return null;
        }),
      ]);

      if (weekly !== null) {
        setInsights(weekly);
      }
      if (settings !== null) {
        setUnitPreference(settings.unitPreference);
      }
      // lastSync is string | null — always safe to set
      setLastCloudSyncAt(lastSync ?? null);
    } catch (err) {
      console.warn('loadSummary unexpected error:', err);
    } finally {
      setPrimaryLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary, refreshToken, reloadTick])
  );

  useEffect(() => {
    let active = true;

    const loadExerciseNames = async () => {
      let names: string[] = [];

      try {
        names = await listRecordedExercisesByType(splitFilter);
      } catch (err) {
        console.warn('listRecordedExercisesByType failed:', err instanceof Error ? err.message : err);
        names = [];
      }

      if (!active) {
        return;
      }

      setExerciseNames(names);
      setSelectedExercise((current) => {
        if (current && names.includes(current)) {
          return current;
        }

        return names[0] ?? '';
      });
    };

    void loadExerciseNames();

    return () => {
      active = false;
    };
  }, [splitFilter, refreshToken, reloadTick]);

  const resolvedSessionLimit = useMemo(() => {
    if (rangePreset === '3') {
      return 3;
    }

    if (rangePreset === '10') {
      return 10;
    }

    if (rangePreset === '20') {
      return 20;
    }

    const parsed = Number(customSessionCount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return Math.min(parsed, 100);
  }, [rangePreset, customSessionCount]);

  useEffect(() => {
    let active = true;

    const loadSeries = async () => {
      if (!selectedExercise || !resolvedSessionLimit) {
        setProgressPoints([]);
        return;
      }

      setProgressLoading(true);

      try {
        const rows = await getExerciseProgressSeries({
          workoutType: splitFilter,
          exerciseName: selectedExercise,
          sessionLimit: resolvedSessionLimit,
        });

        if (!active) {
          return;
        }

        setProgressPoints(rows.slice().reverse());
      } catch (err) {
        console.warn('getExerciseProgressSeries failed:', err instanceof Error ? err.message : err);
        if (active) {
          setProgressPoints([]);
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    };

    void loadSeries();

    return () => {
      active = false;
    };
  }, [selectedExercise, resolvedSessionLimit, splitFilter, refreshToken, reloadTick]);

  const topExerciseByLoad: WeeklyExerciseInsight | null = useMemo(() => {
    if (!insights?.exerciseInsights.length) {
      return null;
    }

    return [...insights.exerciseInsights].sort((a, b) => b.totalLoadKg - a.totalLoadKg)[0] ?? null;
  }, [insights?.exerciseInsights]);

  const chartMaxValue = useMemo(() => {
    if (!progressPoints.length) {
      return 0;
    }

    return progressPoints.reduce((max, point) => Math.max(max, metricValueForPoint(point, chartMetric)), 0);
  }, [progressPoints, chartMetric]);

  const trendBadge = useMemo(() => {
    if (progressPoints.length < 2) {
      return null;
    }

    const first = metricValueForPoint(progressPoints[0], chartMetric);
    const latest = metricValueForPoint(progressPoints[progressPoints.length - 1], chartMetric);
    const delta = latest - first;

    if (Math.abs(delta) < 0.0001) {
      return {
        label: 'Flat trend',
        tone: 'neutral' as const,
      };
    }

    const pct = Math.abs(first) > 0.0001 ? Math.round((Math.abs(delta) / Math.abs(first)) * 100) : null;
    const directionLabel = delta > 0 ? 'Up' : 'Down';
    const pctLabel = pct === null ? '' : ` · ${pct}%`;

    return {
      label: `${directionLabel}${pctLabel}`,
      tone: delta > 0 ? ('up' as const) : ('down' as const),
    };
  }, [chartMetric, progressPoints]);

  const chartSummaryText = useMemo(() => {
    if (progressPoints.length < 2) {
      return 'Need at least 2 logged sessions to compute trend.';
    }

    const first = metricValueForPoint(progressPoints[0], chartMetric);
    const latest = metricValueForPoint(progressPoints[progressPoints.length - 1], chartMetric);
    const delta = latest - first;

    if (Math.abs(delta) < 0.0001) {
      return `${metricLabel(chartMetric)} is stable across selected sessions.`;
    }

    const direction = delta > 0 ? 'up' : 'down';
    const absDelta = Math.abs(delta);
    return `${metricLabel(chartMetric)} is ${direction} by ${formatMetricValue(absDelta, chartMetric, unitPreference)} from first to latest.`;
  }, [chartMetric, progressPoints, unitPreference]);

  const tableRows = useMemo(() => {
    return [...progressPoints].reverse();
  }, [progressPoints]);

  const averageSetsPerSession = useMemo(() => {
    if (!insights?.workoutCount) {
      return 0;
    }

    return insights.totalSetCount / insights.workoutCount;
  }, [insights?.totalSetCount, insights?.workoutCount]);

  const filteredExerciseNames = useMemo(() => {
    const normalized = exerciseQuery.trim().toLowerCase();

    if (!normalized) {
      return exerciseNames;
    }

    return exerciseNames.filter((name) => name.toLowerCase().includes(normalized));
  }, [exerciseNames, exerciseQuery]);

  const adjustCustomSessionCount = (delta: number) => {
    const base = Number(customSessionCount);
    const current = Number.isInteger(base) && base > 0 ? base : 1;
    const next = Math.max(1, Math.min(100, current + delta));
    setCustomSessionCount(String(next));
  };

  const handleRetry = async () => {
    refresh();
    setReloadTick((prev) => prev + 1);
  };

  const cloudStatusMessage = useMemo(() => {
    if (!isBackendConfigured) {
      return 'Backend is not configured in this build.';
    }

    if (authLoading) {
      return 'Connecting to cloud account...';
    }

    if (!session) {
      return 'Signed out. Sign in from Settings to load cloud workouts.';
    }

    if ((insights?.workoutCount ?? 0) === 0) {
      return 'Connected. No cloud workout sessions found yet.';
    }

    return `Connected as ${session.user.email ?? session.user.id}`;
  }, [authLoading, insights?.workoutCount, isBackendConfigured, session]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Insights</Text>
      {insights ? (
        <Text style={styles.subtitle}>
          {formatDateForDisplay(insights.periodStart)} to {formatDateForDisplay(insights.periodEnd)}
        </Text>
      ) : null}


      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Weekly overview</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileValue}>{insights?.workoutCount ?? 0}</Text>
            <Text style={styles.metricTileLabel}>Sessions</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileValue}>{insights?.totalSetCount ?? 0}</Text>
            <Text style={styles.metricTileLabel}>Total Sets</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricTileValue}>{averageSetsPerSession.toFixed(1)}</Text>
            <Text style={styles.metricTileLabel}>Sets / Session</Text>
          </View>
        </View>
        <Text style={styles.metric}>Upper: {insights?.upperSessionCount ?? 0} · Lower: {insights?.lowerSessionCount ?? 0}</Text>
        <Text style={styles.helperText}>{adherenceLabel(insights?.workoutCount ?? 0)}</Text>
        {topExerciseByLoad ? (
          <Text style={styles.helperText}>
            Highest weekly workload: {topExerciseByLoad.exerciseName} ({formatLoad(topExerciseByLoad.totalLoadKg, unitPreference)})
          </Text>
        ) : null}
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Exercise progress</Text>

        <Text style={styles.label}>Workout split</Text>
        <SegmentedControl
          value={splitFilter}
          options={[
            { label: 'Upper', value: 'upper' },
            { label: 'Lower', value: 'lower' },
          ]}
          onChange={(value) => setSplitFilter(value as WorkoutType)}
        />

        <Text style={styles.label}>Session range</Text>
        <SegmentedControl
          value={rangePreset}
          options={[
            { label: 'Last 3', value: '3' },
            { label: 'Last 10', value: '10' },
            { label: 'Last 20', value: '20' },
            { label: 'Picker', value: 'custom' },
          ]}
          onChange={(value) => setRangePreset(value as SessionRangePreset)}
        />

        {rangePreset === 'custom' ? (
          <View style={styles.customRangeRow}>
            <Pressable onPress={() => adjustCustomSessionCount(-1)} style={styles.stepperButton}>
              <Text style={styles.stepperLabel}>-</Text>
            </Pressable>
            <TextInput
              style={styles.customInput}
              keyboardType="number-pad"
              value={customSessionCount}
              onChangeText={setCustomSessionCount}
              maxLength={3}
            />
            <Pressable onPress={() => adjustCustomSessionCount(1)} style={styles.stepperButton}>
              <Text style={styles.stepperLabel}>+</Text>
            </Pressable>
            <Text style={styles.helperText}>sessions</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Choose exercise</Text>
        <TextInput
          style={styles.searchInput}
          value={exerciseQuery}
          onChangeText={setExerciseQuery}
          placeholder="Search recorded exercises"
          placeholderTextColor={colors.textMuted}
        />

        {filteredExerciseNames.length ? (
          <View style={styles.exerciseListWrap}>
            {filteredExerciseNames.map((exerciseName) => {
              const selected = exerciseName === selectedExercise;

              return (
                <Pressable
                  key={exerciseName}
                  onPress={() => setSelectedExercise(exerciseName)}
                  style={[styles.exerciseRow, selected ? styles.exerciseRowSelected : null]}
                >
                  <Text style={[styles.exerciseRowText, selected ? styles.exerciseRowTextSelected : null]}>
                    {selected ? '✓ ' : ''}
                    {exerciseName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.helperText}>No matching recorded exercises.</Text>
        )}

        {selectedExercise ? (
          <>
            <View style={styles.selectedExerciseHeader}>
              <Text style={styles.selectedExerciseTitle}>{selectedExercise}</Text>
              {trendBadge ? (
                <View
                  style={[
                    styles.trendBadge,
                    trendBadge.tone === 'up'
                      ? styles.trendBadgeUp
                      : trendBadge.tone === 'down'
                        ? styles.trendBadgeDown
                        : styles.trendBadgeNeutral,
                  ]}
                >
                  <Text style={styles.trendBadgeText}>{trendBadge.label}</Text>
                </View>
              ) : null}
            </View>

            <SegmentedControl
              value={viewMode}
              options={[
                { label: 'Chart', value: 'chart' },
                { label: 'Table', value: 'table' },
              ]}
              onChange={(value) => setViewMode(value as ProgressViewMode)}
            />

            {viewMode === 'chart' ? (
              <>
                <SegmentedControl
                  value={chartMetric}
                  options={[
                    { label: 'Top Weight', value: 'maxWeightKg' },
                    { label: 'Total Load', value: 'totalLoadKg' },
                    { label: 'Total Reps', value: 'totalReps' },
                  ]}
                  onChange={(value) => setChartMetric(value as ChartMetric)}
                />
                {progressLoading ? (
                  <View style={styles.loadingInline}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.helperText}>Loading chart...</Text>
                  </View>
                ) : progressPoints.length ? (
                  <>
                    <SvgBarChart
                      points={progressPoints}
                      metric={chartMetric}
                      unitPreference={unitPreference}
                      maxValue={chartMaxValue}
                    />
                    <Text style={styles.helperText}>{chartSummaryText}</Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>No sessions found for this exercise in the selected range.</Text>
                )}
              </>
            ) : progressLoading ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.helperText}>Loading table...</Text>
              </View>
            ) : tableRows.length ? (
              <View style={styles.tableWrap}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.tableColDate]}>Date</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColSmall]}>Sets</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColMetric]}>Top</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColMetric]}>Load</Text>
                </View>
                {tableRows.map((row) => (
                  <View key={row.sessionId} style={styles.tableRow}>
                    <Text style={[styles.tableText, styles.tableColDate]}>{formatShortDay(row.date)}</Text>
                    <Text style={[styles.tableText, styles.tableColSmall]}>{row.setCount}</Text>
                    <Text style={[styles.tableText, styles.tableColMetric]}>
                      {formatMetricValue(row.maxWeightKg, 'maxWeightKg', unitPreference)}
                    </Text>
                    <Text style={[styles.tableText, styles.tableColMetric]}>{formatLoad(row.totalLoadKg, unitPreference)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.helperText}>No sessions found for this exercise in the selected range.</Text>
            )}
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>How to read this</Text>
        <Text style={styles.helperText}>
          Keep set count consistent, then push top weight, total reps, or total load up over time for the same exercise.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 36,
    fontFamily: fonts.black,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
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
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metric: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
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
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    gap: 4,
  },
  metricTileValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricTileLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  customInput: {
    minWidth: 72,
    height: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseListWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  exerciseRow: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  exerciseRowText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseRowTextSelected: {
    color: colors.primary,
    fontWeight: '800',
  },
  selectedExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  selectedExerciseTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  trendBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
  },
  trendBadgeUp: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  trendBadgeDown: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  trendBadgeNeutral: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  trendBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  chartItem: {
    width: 94,
    alignItems: 'center',
    gap: spacing.xs,
  },
  chartValue: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  chartTrack: {
    height: 200,
    width: 40,
    justifyContent: 'flex-end',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    padding: 4,
  },
  chartBar: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  chartDate: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tableWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tableText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tableColDate: {
    flex: 1,
  },
  tableColSmall: {
    width: 52,
    textAlign: 'center',
  },
  tableColMetric: {
    width: 98,
    textAlign: 'right',
  },
});
