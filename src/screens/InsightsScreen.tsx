import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle as SvgCircle, Defs, LinearGradient, Stop, Path, Rect, Text as SvgText, Line, Polyline } from 'react-native-svg';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getExerciseProgressSeries,
  getLastCloudSyncAt,
  getPersonalRecords,
  getSettings,
  getWeeklyInsights,
  getWeeklyVolumeTrend,
  listRecordedExercisesByType,
} from '../db/database';
import {
  ExerciseProgressPoint,
  PersonalRecord,
  UnitPreference,
  WeeklyInsights,
  WeeklyVolumeTrendPoint,
  WorkoutType,
} from '../models/types';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useAuth } from '../backend/auth';
import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import { AppButton } from '../components/AppButton';
import { VolumeDonut } from '../components/VolumeDonut';
import { MuscleGroupIcon } from '../components/MuscleGroupIcon';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { formatDateForDisplay, formatShortDay } from '../utils/date';
import { kgToLbs } from '../utils/number';

type SessionRangePreset = '3' | '10' | '20' | 'custom';
type ProgressViewMode = 'line' | 'bar' | 'table';
type ChartMetric = 'maxWeightKg' | 'totalLoadKg' | 'totalReps' | 'estimatedOneRmKg';
type InsightsTab = 'week' | 'progress' | 'records';

const TARGET_WORKOUTS_PER_WEEK = 4;

const formatInteger = (value: number): string => Number.isFinite(value) ? Math.round(value).toString() : '0';

const adherenceLabel = (workoutCount: number): string => {
  const ratio = Math.min(1, workoutCount / TARGET_WORKOUTS_PER_WEEK);
  return `${Math.round(ratio * 100)}% of 4-session target`;
};

const metricLabel = (metric: ChartMetric): string => {
  switch (metric) {
    case 'maxWeightKg': return 'Top Weight';
    case 'totalLoadKg': return 'Total Load';
    case 'totalReps': return 'Total Reps';
    case 'estimatedOneRmKg': return 'Est. 1RM';
    default: return 'Metric';
  }
};

const metricValueForPoint = (point: ExerciseProgressPoint, metric: ChartMetric): number => {
  switch (metric) {
    case 'maxWeightKg': return point.maxWeightKg;
    case 'totalLoadKg': return point.totalLoadKg;
    case 'totalReps': return point.totalReps;
    case 'estimatedOneRmKg': return point.estimatedOneRmKg;
    default: return 0;
  }
};

const toPreferredWeight = (valueKg: number, unitPreference: UnitPreference): number =>
  unitPreference === 'kg' ? valueKg : kgToLbs(valueKg);

const formatMetricValue = (value: number, metric: ChartMetric, unitPreference: UnitPreference): string => {
  if (metric === 'totalReps') return `${formatInteger(value)} reps`;
  const converted = toPreferredWeight(value, unitPreference);
  const suffix = unitPreference === 'kg' ? 'kg' : 'lbs';
  if (metric === 'estimatedOneRmKg') return `${converted.toFixed(1)} ${suffix} (est.)`;
  return `${converted.toFixed(1)} ${suffix}`;
};

const formatLoad = (kgValue: number, unitPreference: UnitPreference): string => {
  const converted = toPreferredWeight(kgValue, unitPreference);
  const suffix = unitPreference === 'kg' ? 'kg' : 'lbs';
  return `${converted.toFixed(1)} ${suffix}`;
};

const AnimatedRect = Animated.createAnimatedComponent(Rect as any);

// ─── Bar chart ───────────────────────────────────────────────────
const BAR_WIDTH = 36;
const BAR_GAP = 14;
const CHART_H = 180;
const LABEL_AREA = 44;

function SvgBarChart({ points, metric, unitPreference, maxValue }: {
  points: ExerciseProgressPoint[]; metric: ChartMetric; unitPreference: UnitPreference; maxValue: number;
}) {
  const anims = useRef<Animated.Value[]>([]);
  useEffect(() => {
    anims.current = points.map(() => new Animated.Value(0));
    const staggered = points.map((_, i) =>
      Animated.timing(anims.current[i], { toValue: 1, duration: 500, delay: i * 50, useNativeDriver: false })
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
          const barY = anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [CHART_H, CHART_H - fullBarH] }) : CHART_H - fullBarH;
          const barH = anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, fullBarH] }) : fullBarH;
          return (
            <React.Fragment key={point.sessionId}>
              {anim ? (
                <AnimatedRect x={x} y={barY as any} width={BAR_WIDTH} height={barH as any} rx={6} fill={colors.primary} opacity={0.85} />
              ) : (
                <Rect x={x} y={CHART_H - fullBarH} width={BAR_WIDTH} height={fullBarH} rx={6} fill={colors.primary} opacity={0.85} />
              )}
              <SvgText x={x + BAR_WIDTH / 2} y={CHART_H - fullBarH - 8} textAnchor="middle" fill={colors.textSecondary} fontSize={9} fontWeight="700">
                {formatMetricValue(value, metric, unitPreference)}
              </SvgText>
              <SvgText x={x + BAR_WIDTH / 2} y={CHART_H + 18} textAnchor="middle" fill={colors.textMuted} fontSize={10} fontWeight="600">
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

// ─── Line chart ──────────────────────────────────────────────────
const LINE_CHART_H = 180;
const LINE_CHART_PAD_TOP = 32;
const LINE_CHART_PAD_BOTTOM = 44;
const LINE_DOT_RADIUS = 5;
const LINE_DOT_STROKE = 2.5;

function SvgLineChart({ points, metric, unitPreference, maxValue }: {
  points: ExerciseProgressPoint[]; metric: ChartMetric; unitPreference: UnitPreference; maxValue: number;
}) {
  if (points.length < 1) return null;

  const minValue = points.reduce((min, p) => Math.min(min, metricValueForPoint(p, metric)), maxValue);
  const range = maxValue - minValue;
  const effectiveRange = range > 0 ? range : 1;

  // Add 10% padding to top and bottom of value range
  const paddedMin = minValue - effectiveRange * 0.1;
  const paddedMax = maxValue + effectiveRange * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const dotSpacing = points.length > 1 ? 60 : 100;
  const svgWidth = Math.max(300, (points.length - 1) * dotSpacing + 80);
  const svgHeight = LINE_CHART_H + LINE_CHART_PAD_BOTTOM;
  const plotHeight = LINE_CHART_H - LINE_CHART_PAD_TOP;

  const getX = (i: number) => 40 + i * dotSpacing;
  const getY = (value: number) => {
    const ratio = paddedRange > 0 ? (value - paddedMin) / paddedRange : 0.5;
    return LINE_CHART_PAD_TOP + plotHeight * (1 - ratio);
  };

  // Build the polyline points string
  const linePoints = points
    .map((p, i) => `${getX(i)},${getY(metricValueForPoint(p, metric))}`)
    .join(' ');

  // Build the fill path (area under the line)
  const firstX = getX(0);
  const lastX = getX(points.length - 1);
  const baseY = LINE_CHART_H;
  let areaPath = `M ${firstX},${baseY}`;
  points.forEach((p, i) => {
    areaPath += ` L ${getX(i)},${getY(metricValueForPoint(p, metric))}`;
  });
  areaPath += ` L ${lastX},${baseY} Z`;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xs }}>
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = LINE_CHART_PAD_TOP + plotHeight * (1 - ratio);
          return (
            <Line key={ratio} x1={30} y1={y} x2={svgWidth - 10} y2={y}
              stroke={colors.border} strokeWidth={0.5} strokeDasharray="4,4" />
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaFill)" />

        {/* Baseline */}
        <Line x1={30} y1={LINE_CHART_H} x2={svgWidth - 10} y2={LINE_CHART_H}
          stroke={colors.border} strokeWidth={1} />

        {/* Connecting line */}
        <Polyline
          points={linePoints}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots + labels */}
        {points.map((point, i) => {
          const value = metricValueForPoint(point, metric);
          const cx = getX(i);
          const cy = getY(value);
          return (
            <React.Fragment key={point.sessionId}>
              {/* Outer ring */}
              <SvgCircle cx={cx} cy={cy} r={LINE_DOT_RADIUS + LINE_DOT_STROKE}
                fill={colors.background} />
              {/* Inner dot */}
              <SvgCircle cx={cx} cy={cy} r={LINE_DOT_RADIUS}
                fill={colors.primary} />

              {/* Value label above dot */}
              <SvgText x={cx} y={cy - 14} textAnchor="middle"
                fill={colors.textSecondary} fontSize={9} fontWeight="700">
                {formatMetricValue(value, metric, unitPreference)}
              </SvgText>

              {/* Date label below baseline */}
              <SvgText x={cx} y={LINE_CHART_H + 18} textAnchor="middle"
                fill={colors.textMuted} fontSize={10} fontWeight="600">
                {formatShortDay(point.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ─── Volume trend bar chart ───────────────────────────────────────
function SvgVolumeBarChart({ points, unitPreference }: {
  points: WeeklyVolumeTrendPoint[];
  unitPreference: UnitPreference;
}) {
  if (!points.length) return null;
  const maxLoad = Math.max(...points.map((p) => p.totalLoadKg), 1);
  const svgWidth = points.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const svgHeight = CHART_H + LABEL_AREA;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xs }}>
      <Svg width={svgWidth} height={svgHeight}>
        {points.map((point, i) => {
          const ratio = point.totalLoadKg > 0 ? point.totalLoadKg / maxLoad : 0;
          const fullBarH = Math.max(point.totalLoadKg > 0 ? 6 : 0, ratio * (CHART_H - 32));
          const x = BAR_GAP + i * (BAR_WIDTH + BAR_GAP);
          const y = CHART_H - fullBarH;
          const isCurrentWeek = i === points.length - 1;
          const displayVal = toPreferredWeight(point.totalLoadKg, unitPreference);
          const label = displayVal >= 10000
            ? `${(displayVal / 1000).toFixed(1)}k`
            : Math.round(displayVal).toString();
          return (
            <React.Fragment key={point.weekStart}>
              <Rect x={x} y={y} width={BAR_WIDTH} height={fullBarH} rx={6}
                fill={isCurrentWeek ? colors.primary : colors.primarySoft} opacity={0.9} />
              {point.totalLoadKg > 0 ? (
                <SvgText x={x + BAR_WIDTH / 2} y={y - 7} textAnchor="middle"
                  fill={colors.textSecondary} fontSize={8} fontWeight="700">{label}</SvgText>
              ) : null}
              <SvgText x={x + BAR_WIDTH / 2} y={CHART_H + 18} textAnchor="middle"
                fill={colors.textMuted} fontSize={10} fontWeight="600">{point.weekLabel}</SvgText>
            </React.Fragment>
          );
        })}
        <Line x1={0} y1={CHART_H} x2={svgWidth} y2={CHART_H} stroke={colors.border} strokeWidth={1} />
      </Svg>
    </ScrollView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────

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

  const [viewMode, setViewMode] = useState<ProgressViewMode>('line');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('maxWeightKg');

  const [progressPoints, setProgressPoints] = useState<ExerciseProgressPoint[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeTab, setActiveTab] = useState<InsightsTab>('week');
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [volumeTrend, setVolumeTrend] = useState<WeeklyVolumeTrendPoint[]>([]);

  const loadSummary = useCallback(async () => {
    setPrimaryLoading(true);
    try {
      const [weekly, settings, lastSync, prs, trend] = await Promise.all([
        getWeeklyInsights(7).catch(() => null),
        getSettings().catch(() => null),
        getLastCloudSyncAt().catch(() => null),
        getPersonalRecords().catch(() => []),
        getWeeklyVolumeTrend(8).catch(() => []),
      ]);
      if (weekly !== null) setInsights(weekly);
      if (settings !== null) setUnitPreference(settings.unitPreference);
      setLastCloudSyncAt(lastSync ?? null);
      setPersonalRecords(prs as PersonalRecord[]);
      setVolumeTrend(trend as WeeklyVolumeTrendPoint[]);
    } catch (err) { console.warn('loadSummary unexpected error:', err); }
    finally { setPrimaryLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadSummary(); }, [loadSummary, refreshToken, reloadTick]));

  useEffect(() => {
    let active = true;
    const loadExerciseNames = async () => {
      let names: string[] = [];
      try { names = await listRecordedExercisesByType(splitFilter); } catch { names = []; }
      if (!active) return;
      setExerciseNames(names);
      setSelectedExercise((current) => (current && names.includes(current)) ? current : names[0] ?? '');
    };
    void loadExerciseNames();
    return () => { active = false; };
  }, [splitFilter, refreshToken, reloadTick]);

  const resolvedSessionLimit = useMemo(() => {
    if (rangePreset === '3') return 3;
    if (rangePreset === '10') return 10;
    if (rangePreset === '20') return 20;
    const parsed = Number(customSessionCount);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return Math.min(parsed, 100);
  }, [rangePreset, customSessionCount]);

  useEffect(() => {
    let active = true;
    const loadSeries = async () => {
      if (!selectedExercise || !resolvedSessionLimit) { setProgressPoints([]); return; }
      setProgressLoading(true);
      try {
        const rows = await getExerciseProgressSeries({ workoutType: splitFilter, exerciseName: selectedExercise, sessionLimit: resolvedSessionLimit });
        if (!active) return;
        setProgressPoints(rows.slice().reverse());
      } catch { if (active) setProgressPoints([]); }
      finally { if (active) setProgressLoading(false); }
    };
    void loadSeries();
    return () => { active = false; };
  }, [selectedExercise, resolvedSessionLimit, splitFilter, refreshToken, reloadTick]);

  const chartMaxValue = useMemo(() => {
    if (!progressPoints.length) return 0;
    return progressPoints.reduce((max, point) => Math.max(max, metricValueForPoint(point, chartMetric)), 0);
  }, [progressPoints, chartMetric]);

  const trendBadge = useMemo(() => {
    if (progressPoints.length < 2) return null;
    const first = metricValueForPoint(progressPoints[0], chartMetric);
    const latest = metricValueForPoint(progressPoints[progressPoints.length - 1], chartMetric);
    const delta = latest - first;
    if (Math.abs(delta) < 0.0001) return { label: 'Flat', tone: 'neutral' as const };
    const pct = Math.abs(first) > 0.0001 ? Math.round((Math.abs(delta) / Math.abs(first)) * 100) : null;
    const directionLabel = delta > 0 ? '↑' : '↓';
    const pctLabel = pct === null ? '' : ` ${pct}%`;
    return { label: `${directionLabel}${pctLabel}`, tone: delta > 0 ? ('up' as const) : ('down' as const) };
  }, [chartMetric, progressPoints]);

  const chartSummaryText = useMemo(() => {
    if (progressPoints.length < 2) return 'Need at least 2 logged sessions to compute trend.';
    const first = metricValueForPoint(progressPoints[0], chartMetric);
    const latest = metricValueForPoint(progressPoints[progressPoints.length - 1], chartMetric);
    const delta = latest - first;
    if (Math.abs(delta) < 0.0001) return `${metricLabel(chartMetric)} is stable across selected sessions.`;
    const direction = delta > 0 ? 'up' : 'down';
    return `${metricLabel(chartMetric)} is ${direction} by ${formatMetricValue(Math.abs(delta), chartMetric, unitPreference)} from first to latest.`;
  }, [chartMetric, progressPoints, unitPreference]);

  const tableRows = useMemo(() => [...progressPoints].reverse(), [progressPoints]);

  const averageSetsPerSession = useMemo(() => {
    if (!insights?.workoutCount) return 0;
    return insights.totalSetCount / insights.workoutCount;
  }, [insights?.totalSetCount, insights?.workoutCount]);

  const filteredExerciseNames = useMemo(() => {
    const normalized = exerciseQuery.trim().toLowerCase();
    if (!normalized) return exerciseNames;
    return exerciseNames.filter((name) => name.toLowerCase().includes(normalized));
  }, [exerciseNames, exerciseQuery]);

  const adjustCustomSessionCount = (delta: number) => {
    const base = Number(customSessionCount);
    const current = Number.isInteger(base) && base > 0 ? base : 1;
    setCustomSessionCount(String(Math.max(1, Math.min(100, current + delta))));
  };

  const isChartMode = viewMode === 'line' || viewMode === 'bar';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Insights</Text>

      {/* Top-level tab switcher */}
      <SegmentedControl
        value={activeTab}
        options={[
          { label: 'This Week', value: 'week' },
          { label: 'Progress', value: 'progress' },
          { label: 'Records', value: 'records' },
        ]}
        onChange={(value) => setActiveTab(value as InsightsTab)}
      />

      {/* ── This Week tab ── */}
      {activeTab === 'week' ? (
        <>
          {insights ? (
            <Text style={styles.subtitle}>{formatDateForDisplay(insights.periodStart)} — {formatDateForDisplay(insights.periodEnd)}</Text>
          ) : null}

          <View style={styles.metricsRow}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{insights?.workoutCount ?? 0}</Text>
              <Text style={styles.metricTileLabel}>Sessions</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{insights?.totalSetCount ?? 0}</Text>
              <Text style={styles.metricTileLabel}>Total sets</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>{Math.round(averageSetsPerSession * 10) / 10}</Text>
              <Text style={styles.metricTileLabel}>Sets/session</Text>
            </View>
          </View>
          <Text style={styles.helperText}>{adherenceLabel(insights?.workoutCount ?? 0)}</Text>

          {insights && (insights.upperSessionCount > 0 || insights.lowerSessionCount > 0) ? (
            <Card style={styles.cardGap}>
              <Text style={styles.cardTitle}>Split distribution</Text>
              <VolumeDonut
                segments={[
                  { label: 'Upper', value: insights.upperSessionCount, color: colors.primary },
                  { label: 'Lower', value: insights.lowerSessionCount, color: colors.accent },
                ]}
                centerValue={String(insights.workoutCount)}
                centerLabel="sessions"
                size={120}
              />
            </Card>
          ) : null}

          {volumeTrend.some((p) => p.totalLoadKg > 0) ? (
            <Card style={styles.cardGap}>
              <Text style={styles.cardTitle}>Volume trend · last 8 weeks</Text>
              <SvgVolumeBarChart points={volumeTrend} unitPreference={unitPreference} />
              <Text style={styles.helperText}>
                Total {unitPreference === 'kg' ? 'kg' : 'lbs'} lifted per week. Rightmost bar is this week.
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}

      {/* ── Progress tab ── */}
      {activeTab === 'progress' ? (
        <Card style={styles.cardGap}>
          <SegmentedControl
            value={splitFilter}
            options={[{ label: 'Upper', value: 'upper' }, { label: 'Lower', value: 'lower' }]}
            onChange={(value) => setSplitFilter(value as WorkoutType)}
          />

          <SegmentedControl
            value={rangePreset}
            options={[{ label: 'Last 3', value: '3' }, { label: 'Last 10', value: '10' }, { label: 'Last 20', value: '20' }, { label: 'Picker', value: 'custom' }]}
            onChange={(value) => setRangePreset(value as SessionRangePreset)}
          />

          {rangePreset === 'custom' ? (
            <View style={styles.customRangeRow}>
              <Pressable onPress={() => adjustCustomSessionCount(-1)} style={styles.stepperButton}><Text style={styles.stepperLabel}>-</Text></Pressable>
              <TextInput style={styles.customInput} keyboardType="number-pad" value={customSessionCount} onChangeText={setCustomSessionCount} maxLength={3} />
              <Pressable onPress={() => adjustCustomSessionCount(1)} style={styles.stepperButton}><Text style={styles.stepperLabel}>+</Text></Pressable>
              <Text style={styles.helperText}>sessions</Text>
            </View>
          ) : null}

          {filteredExerciseNames.length ? (
            <View style={styles.exercisePillsWrap}>
              {filteredExerciseNames.map((exerciseName) => {
                const selected = exerciseName === selectedExercise;
                return (
                  <Pressable key={exerciseName} onPress={() => setSelectedExercise(exerciseName)}
                    style={[styles.exercisePill, selected && styles.exercisePillSelected]}>
                    <MuscleGroupIcon exerciseName={exerciseName} size={18} style={{ marginRight: 6 }} />
                    <Text style={[styles.exercisePillText, selected && styles.exercisePillTextSelected]}>{exerciseName}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helperText}>No recorded exercises for this split yet.</Text>
          )}

          {selectedExercise ? (
            <>
              <View style={styles.selectedExerciseHeader}>
                <Text style={styles.selectedExerciseTitle}>{selectedExercise}</Text>
                {trendBadge ? (
                  <View style={[styles.trendBadge, trendBadge.tone === 'up' ? styles.trendBadgeUp : trendBadge.tone === 'down' ? styles.trendBadgeDown : styles.trendBadgeNeutral]}>
                    <Text style={styles.trendBadgeText}>{trendBadge.label}</Text>
                  </View>
                ) : null}
              </View>

              <SegmentedControl value={viewMode}
                options={[
                  { label: 'Line', value: 'line' },
                  { label: 'Bar', value: 'bar' },
                  { label: 'Table', value: 'table' },
                ]}
                onChange={(value) => setViewMode(value as ProgressViewMode)} />

              {isChartMode ? (
                <>
                  <SegmentedControl value={chartMetric}
                    options={[{ label: 'Top Weight', value: 'maxWeightKg' }, { label: 'Total Load', value: 'totalLoadKg' }, { label: 'Reps', value: 'totalReps' }, { label: 'Est. 1RM', value: 'estimatedOneRmKg' }]}
                    onChange={(value) => setChartMetric(value as ChartMetric)} />

                  {progressLoading ? (
                    <View style={styles.loadingInline}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.helperText}>Loading...</Text></View>
                  ) : progressPoints.length ? (
                    <>
                      {viewMode === 'line' ? (
                        <SvgLineChart points={progressPoints} metric={chartMetric} unitPreference={unitPreference} maxValue={chartMaxValue} />
                      ) : (
                        <SvgBarChart points={progressPoints} metric={chartMetric} unitPreference={unitPreference} maxValue={chartMaxValue} />
                      )}
                      <Text style={styles.helperText}>{chartSummaryText}</Text>
                    </>
                  ) : (
                    <Text style={styles.helperText}>No sessions found for this exercise in the selected range.</Text>
                  )}
                </>
              ) : progressLoading ? (
                <View style={styles.loadingInline}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.helperText}>Loading...</Text></View>
              ) : tableRows.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tableWrap}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, styles.tableColDate]}>Date</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColSmall]}>Sets</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColMetric]}>Top</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColMetric]}>Load</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColMetric]}>Est. 1RM</Text>
                    </View>
                    {tableRows.map((row) => (
                      <View key={row.sessionId} style={styles.tableRow}>
                        <Text style={[styles.tableText, styles.tableColDate]}>{formatShortDay(row.date)}</Text>
                        <Text style={[styles.tableText, styles.tableColSmall]}>{row.setCount}</Text>
                        <Text style={[styles.tableText, styles.tableColMetric]}>{formatMetricValue(row.maxWeightKg, 'maxWeightKg', unitPreference)}</Text>
                        <Text style={[styles.tableText, styles.tableColMetric]}>{formatLoad(row.totalLoadKg, unitPreference)}</Text>
                        <Text style={[styles.tableText, styles.tableColMetric]}>{formatMetricValue(row.estimatedOneRmKg, 'estimatedOneRmKg', unitPreference)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.helperText}>No sessions found for this exercise in the selected range.</Text>
              )}
            </>
          ) : null}
        </Card>
      ) : null}

      {/* ── Records tab ── */}
      {activeTab === 'records' ? (
        personalRecords.length > 0 ? (
          <Card style={styles.cardGap}>
            <Text style={styles.cardTitle}>All-time best sets</Text>
            <Text style={styles.helperText}>Best weight lifted for each exercise across all sessions.</Text>
            {personalRecords.map((pr, idx) => (
              <View key={`${pr.exerciseName}-${pr.workoutType}`} style={[styles.prRow, idx > 0 && styles.prRowBorder]}>
                <View style={styles.prLeft}>
                  <Text style={styles.prName}>{pr.exerciseName}</Text>
                  <Text style={styles.prMeta}>{pr.workoutType.toUpperCase()} · {formatDateForDisplay(pr.date)}</Text>
                </View>
                <View style={styles.prRight}>
                  <Text style={styles.prWeight}>{toPreferredWeight(pr.weightKg, unitPreference).toFixed(1)} {unitPreference === 'kg' ? 'kg' : 'lbs'}</Text>
                  <Text style={styles.prReps}>× {pr.reps}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Text style={styles.helperText}>No records yet. Log some sessions to see your bests here.</Text>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm, backgroundColor: colors.background },
  title: { color: colors.textPrimary, fontSize: 28, fontFamily: fonts.black, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium, marginTop: -4 },
  sectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.md, marginBottom: spacing.xs, paddingLeft: 2 },
  cardGap: { gap: spacing.sm },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.bold, marginBottom: spacing.xs },
  helperText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricTile: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 22, fontFamily: fonts.monoBold, color: colors.textPrimary, letterSpacing: -0.5 },
  metricTileLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  stepperLabel: { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.bold, lineHeight: 22 },
  customInput: { minWidth: 64, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, backgroundColor: colors.surfaceElevated, color: colors.textPrimary, textAlign: 'center', fontSize: 15, fontFamily: fonts.monoBold, paddingHorizontal: spacing.sm },
  exercisePillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exercisePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong },
  exercisePillSelected: { backgroundColor: colors.primarySoft, borderColor: 'rgba(0,232,159,0.25)' },
  exercisePillText: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  exercisePillTextSelected: { color: colors.primary },
  selectedExerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  selectedExerciseTitle: { color: colors.textPrimary, fontSize: 17, fontFamily: fonts.black, flex: 1, letterSpacing: -0.2 },
  trendBadge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  trendBadgeUp: { borderColor: 'rgba(0,232,159,0.25)', backgroundColor: colors.primarySoft },
  trendBadgeDown: { borderColor: 'rgba(255,107,53,0.25)', backgroundColor: colors.accentSoft },
  trendBadgeNeutral: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated },
  trendBadgeText: { color: colors.textPrimary, fontSize: 12, fontFamily: fonts.bold },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  tableWrap: { borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden', backgroundColor: colors.surfaceElevated },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderText: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tableText: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.semiBold },
  tableColDate: { flex: 1 },
  tableColSmall: { width: 48, textAlign: 'center' },
  tableColMetric: { width: 90, textAlign: 'right' },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  prRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  prLeft: { flex: 1, gap: 2 },
  prName: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  prMeta: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textMuted },
  prRight: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  prWeight: { fontSize: 16, fontFamily: fonts.monoBold, color: colors.primary },
  prReps: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary },
});

