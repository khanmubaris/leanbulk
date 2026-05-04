import {
  AppSettings,
  EditableExerciseDraft,
  ExerciseProgressPoint,
  HomeSummary,
  UnitPreference,
  WeeklyExerciseInsight,
  WeeklyInsights,
  WorkoutCsvRow,
  WorkoutExerciseWithSets,
  WorkoutLogItem,
  WorkoutSaveInput,
  WorkoutSession,
  WorkoutSessionWithExercises,
  WorkoutSet,
  WorkoutType,
} from '../models/types';
import { ExerciseTemplate, getTemplateByType, MAX_SETS_PER_EXERCISE } from '../models/templates';
import { addDays, isValidDateKey, todayDateKey } from '../utils/date';
import { isSupabaseConfigured, supabase } from '../backend/supabase';

const VALID_WORKOUT_TYPES: WorkoutType[] = ['upper', 'lower'];

type SettingsKey = 'unit_preference' | 'last_cloud_sync_at';

interface SessionRow {
  id: string;
  date: string;
  type: WorkoutType;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface ExerciseRow {
  id: string;
  session_id: string;
  name: string;
  order_index: number;
}

interface SetRow {
  id: string;
  exercise_id: string;
  set_index: number;
  weight: number;
  reps: number;
}

interface AppSettingRow {
  key: SettingsKey;
  value: string;
}

interface CloudSettingsRow {
  user_id: string;
  unit_preference: UnitPreference;
  updated_at: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  unitPreference: 'kg',
};

export interface DatabaseSnapshot {
  version: number;
  exported_at: string;
  app_settings: AppSettingRow[];
  workout_sessions: SessionRow[];
  workout_exercises: ExerciseRow[];
  workout_sets: SetRow[];
}

const createId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = (): string => new Date().toISOString();

const ensureClient = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Backend is not configured. This app is cloud-only.');
  }

  return supabase;
};

const getCurrentUserId = async (): Promise<string | null> => {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
};

const requireUserId = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Sign in required.');
  }

  return userId;
};

const toWorkoutType = (value: string): WorkoutType => {
  return VALID_WORKOUT_TYPES.includes(value as WorkoutType) ? (value as WorkoutType) : 'upper';
};

const toWorkoutSession = (row: SessionRow): WorkoutSession => {
  return {
    id: row.id,
    date: row.date,
    type: toWorkoutType(row.type),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toWorkoutSet = (row: SetRow): WorkoutSet => {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    setIndex: Number(row.set_index),
    weight: Number(row.weight),
    reps: Number(row.reps),
  };
};

const compareSessionsNewestFirst = (
  a: Pick<SessionRow, 'date' | 'updated_at'>,
  b: Pick<SessionRow, 'date' | 'updated_at'>
): number => {
  if (a.date !== b.date) {
    return a.date > b.date ? -1 : 1;
  }

  if (a.updated_at !== b.updated_at) {
    return a.updated_at > b.updated_at ? -1 : 1;
  }

  return 0;
};

const normalizeExercisesForSave = (exercises: EditableExerciseDraft[]): Array<{
  name: string;
  sets: Array<{ setIndex: number; weight: number; reps: number }>;
}> => {
  const normalized = exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      sets: exercise.sets.slice(0, MAX_SETS_PER_EXERCISE),
    }))
    .filter((exercise) => exercise.name.length > 0)
    .map((exercise) => {
      const normalizedSets: Array<{ setIndex: number; weight: number; reps: number }> = [];

      exercise.sets.forEach((setDraft, idx) => {
        const weightRaw = setDraft.weight.trim();
        const repsRaw = setDraft.reps.trim();

        if (!weightRaw && !repsRaw) {
          return;
        }

        if (!weightRaw || !repsRaw) {
          throw new Error(`Exercise "${exercise.name}", set ${idx + 1}: fill both weight and reps or leave both blank.`);
        }

        const weight = Number(weightRaw);
        const reps = Number(repsRaw);

        if (!Number.isFinite(weight) || weight < 0) {
          throw new Error(`Exercise "${exercise.name}": weight for set ${idx + 1} must be >= 0.`);
        }

        if (!Number.isInteger(reps) || reps <= 0) {
          throw new Error(`Exercise "${exercise.name}": reps for set ${idx + 1} must be a positive integer.`);
        }

        normalizedSets.push({
          setIndex: idx + 1,
          weight,
          reps,
        });
      });

      return {
        name: exercise.name,
        sets: normalizedSets,
      };
    });

  if (!normalized.length) {
    throw new Error('Add at least one exercise before saving.');
  }

  return normalized;
};

const getSettingsRow = async (userId: string): Promise<CloudSettingsRow | null> => {
  const client = ensureClient();
  const { data, error } = await client
    .from('user_settings')
    .select('user_id, unit_preference, updated_at')
    .eq('user_id', userId)
    .maybeSingle<CloudSettingsRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
};

const mapSettings = (row: CloudSettingsRow | null): AppSettings => {
  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    unitPreference: row.unit_preference === 'lbs' ? 'lbs' : 'kg',
  };
};

const fetchExercisesForSessions = async (userId: string, sessionIds: string[]): Promise<ExerciseRow[]> => {
  if (!sessionIds.length) {
    return [];
  }

  const client = ensureClient();
  const { data, error } = await client
    .from('workout_exercises')
    .select('id, session_id, name, order_index')
    .eq('user_id', userId)
    .in('session_id', sessionIds)
    .order('session_id', { ascending: true })
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExerciseRow[];
};

const fetchSetsForExercises = async (userId: string, exerciseIds: string[]): Promise<SetRow[]> => {
  if (!exerciseIds.length) {
    return [];
  }

  const client = ensureClient();
  const { data, error } = await client
    .from('workout_sets')
    .select('id, exercise_id, set_index, weight, reps')
    .eq('user_id', userId)
    .in('exercise_id', exerciseIds)
    .order('exercise_id', { ascending: true })
    .order('set_index', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SetRow[];
};

const templateToDraftExercise = async (template: ExerciseTemplate): Promise<EditableExerciseDraft> => {
  const lastSets = await getLatestSetsForExerciseName(template.name);

  return {
    name: template.name,
    sets:
      lastSets.length > 0
        ? lastSets.slice(0, MAX_SETS_PER_EXERCISE).map((set) => ({
            weight: '',
            reps: '',
            weightHint: String(set.weight),
            repsHint: String(set.reps),
          }))
        : [{ weight: '', reps: '' }],
  };
};

export const initDatabase = async (): Promise<void> => {
  // Intentionally empty. App data is server-only in Supabase.
  ensureClient();
};

export const getSettings = async (): Promise<AppSettings> => {
  if (!isSupabaseConfigured) {
    return DEFAULT_SETTINGS;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return DEFAULT_SETTINGS;
    }

    return mapSettings(await getSettingsRow(userId));
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const setUnitPreference = async (unit: UnitPreference): Promise<void> => {
  if (!isSupabaseConfigured) {
    throw new Error('Backend not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const userId = await requireUserId();
  const client = ensureClient();

  const { error } = await client.from('user_settings').upsert(
    {
      user_id: userId,
      unit_preference: unit,
      updated_at: nowIso(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(error.message);
  }
};

export const getLastCloudSyncAt = async (): Promise<string | null> => {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    const client = ensureClient();
    const { data, error } = await client
      .from('workout_sessions')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ updated_at: string }>();

    if (error) {
      throw new Error(error.message);
    }

    if (data?.updated_at) {
      return data.updated_at;
    }

    // Fallback for users with no workout rows yet.
    const settings = await getSettingsRow(userId);
    return settings?.updated_at ?? null;
  } catch {
    return null;
  }
};

export const setLastCloudSyncAt = async (_iso: string): Promise<void> => {
  // No-op in server-only mode.
};

export const listWorkoutSessions = async (filter: 'all' | WorkoutType = 'all'): Promise<WorkoutLogItem[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  try {
    const client = ensureClient();
    let query = client
      .from('workout_sessions')
      .select('id, date, type, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('type', filter);
    }

    const { data: sessionsData, error: sessionsError } = await query;
    if (sessionsError) {
      throw new Error(sessionsError.message);
    }

    const sessions = (sessionsData ?? []) as SessionRow[];
    if (!sessions.length) {
      return [];
    }

    const sessionIds = sessions.map((row) => row.id);
    const exercises = await fetchExercisesForSessions(userId, sessionIds);
    const sets = await fetchSetsForExercises(userId, exercises.map((row) => row.id));

    const exerciseCountBySession = new Map<string, number>();
    const exerciseSessionById = new Map<string, string>();

    for (const row of exercises) {
      exerciseCountBySession.set(row.session_id, (exerciseCountBySession.get(row.session_id) ?? 0) + 1);
      exerciseSessionById.set(row.id, row.session_id);
    }

    const setCountBySession = new Map<string, number>();
    for (const row of sets) {
      const sessionId = exerciseSessionById.get(row.exercise_id);
      if (!sessionId) {
        continue;
      }

      setCountBySession.set(sessionId, (setCountBySession.get(sessionId) ?? 0) + 1);
    }

    return sessions.map((row) => ({
      ...toWorkoutSession(row),
      exerciseCount: exerciseCountBySession.get(row.id) ?? 0,
      totalSets: setCountBySession.get(row.id) ?? 0,
    }));
  } catch (err) {
    if (__DEV__) {
      console.warn('listWorkoutSessions: network error, returning empty list.', err);
    }
    return [];
  }
};

export const getWorkoutSessionById = async (sessionId: string): Promise<WorkoutSessionWithExercises | null> => {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  try {
    const client = ensureClient();
    const { data: sessionData, error: sessionError } = await client
      .from('workout_sessions')
      .select('id, date, type, notes, created_at, updated_at')
      .eq('user_id', userId)
      .eq('id', sessionId)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!sessionData) {
      return null;
    }

    const exercises = await fetchExercisesForSessions(userId, [sessionId]);
    const sets = await fetchSetsForExercises(userId, exercises.map((row) => row.id));

    const setsByExerciseId = new Map<string, WorkoutSet[]>();
    for (const row of sets) {
      const current = setsByExerciseId.get(row.exercise_id) ?? [];
      current.push(toWorkoutSet(row));
      setsByExerciseId.set(row.exercise_id, current);
    }

    const mappedExercises: WorkoutExerciseWithSets[] = exercises
      .sort((a, b) => Number(a.order_index) - Number(b.order_index))
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        name: row.name,
        orderIndex: Number(row.order_index),
        sets: (setsByExerciseId.get(row.id) ?? []).sort((a, b) => a.setIndex - b.setIndex),
      }));

    return {
      ...toWorkoutSession(sessionData),
      exercises: mappedExercises,
    };
  } catch (err) {
    if (__DEV__) {
      console.warn('getWorkoutSessionById: network error, returning null.', err);
    }
    return null;
  }
};

export const getLatestSetsForExerciseName = async (
  exerciseName: string
): Promise<Array<{ weight: number; reps: number }>> => {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  let userId: string | null;
  try {
    userId = await getCurrentUserId();
  } catch {
    return [];
  }

  if (!userId) {
    return [];
  }

  const trimmed = exerciseName.trim();
  if (!trimmed) {
    return [];
  }

  const client = ensureClient();
  const { data: exerciseData, error: exerciseError } = await client
    .from('workout_exercises')
    .select('id, session_id, name, order_index')
    .eq('user_id', userId)
    .ilike('name', trimmed);

  if (exerciseError) {
    throw new Error(exerciseError.message);
  }

  const exercises = (exerciseData ?? []) as ExerciseRow[];
  if (!exercises.length) {
    return [];
  }

  const sessionIds = Array.from(new Set(exercises.map((row) => row.session_id)));
  const { data: sessionData, error: sessionError } = await client
    .from('workout_sessions')
    .select('id, date, type, notes, created_at, updated_at')
    .eq('user_id', userId)
    .in('id', sessionIds);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionById = new Map<string, SessionRow>();
  for (const row of (sessionData ?? []) as SessionRow[]) {
    sessionById.set(row.id, row);
  }

  let latestExercise: ExerciseRow | null = null;
  let latestSession: SessionRow | null = null;

  for (const exercise of exercises) {
    const session = sessionById.get(exercise.session_id);
    if (!session) {
      continue;
    }

    if (!latestExercise || !latestSession || compareSessionsNewestFirst(session, latestSession) < 0) {
      latestExercise = exercise;
      latestSession = session;
    }
  }

  if (!latestExercise) {
    return [];
  }

  const { data: setData, error: setError } = await client
    .from('workout_sets')
    .select('id, exercise_id, set_index, weight, reps')
    .eq('user_id', userId)
    .eq('exercise_id', latestExercise.id)
    .order('set_index', { ascending: true })
    .limit(MAX_SETS_PER_EXERCISE);

  if (setError) {
    throw new Error(setError.message);
  }

  return ((setData ?? []) as SetRow[]).map((row) => ({
    weight: Number(row.weight),
    reps: Number(row.reps),
  }));
};

export const buildWorkoutTemplateDraft = async (type: WorkoutType): Promise<EditableExerciseDraft[]> => {
  const templates = getTemplateByType(type);
  const results = await Promise.allSettled(templates.map(templateToDraftExercise));

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    // Fallback: blank draft for this exercise if history fetch failed
    console.warn('[database] templateToDraftExercise failed for', templates[index]?.name, result.reason);
    return {
      name: templates[index]?.name ?? '',
      sets: [{ weight: '', reps: '' }],
    };
  });
};

export const saveWorkoutSession = async (input: WorkoutSaveInput): Promise<string> => {
  const userId = await requireUserId();

  if (!isValidDateKey(input.date)) {
    throw new Error('Workout date must use YYYY-MM-DD format.');
  }

  if (!VALID_WORKOUT_TYPES.includes(input.type)) {
    throw new Error('Workout type must be Upper or Lower.');
  }

  const normalizedExercises = normalizeExercisesForSave(input.exercises);
  const client = ensureClient();
  const timestamp = nowIso();
  const sessionId = input.sessionId ?? createId('session');

  if (input.sessionId) {
    const { data: existing, error: existingError } = await client
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('id', sessionId)
      .maybeSingle<{ id: string }>();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existing) {
      throw new Error('Workout session does not exist.');
    }

    const { error: updateError } = await client
      .from('workout_sessions')
      .update({
        date: input.date,
        type: input.type,
        notes: input.notes.trim(),
        updated_at: timestamp,
      })
      .eq('user_id', userId)
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: deleteExercisesError } = await client
      .from('workout_exercises')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (deleteExercisesError) {
      throw new Error(deleteExercisesError.message);
    }
  } else {
    const { error: insertError } = await client.from('workout_sessions').insert({
      user_id: userId,
      id: sessionId,
      date: input.date,
      type: input.type,
      notes: input.notes.trim(),
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const exerciseRows = normalizedExercises.map((exercise, orderIndex) => ({
    user_id: userId,
    id: createId('exercise'),
    session_id: sessionId,
    name: exercise.name,
    order_index: orderIndex,
    updated_at: timestamp,
  }));

  if (exerciseRows.length) {
    const { error: insertExercisesError } = await client.from('workout_exercises').insert(exerciseRows);
    if (insertExercisesError) {
      throw new Error(insertExercisesError.message);
    }
  }

  const setRows = exerciseRows.flatMap((exerciseRow, exerciseIndex) => {
    return normalizedExercises[exerciseIndex].sets.map((set) => ({
      user_id: userId,
      id: createId('set'),
      exercise_id: exerciseRow.id,
      set_index: set.setIndex,
      weight: set.weight,
      reps: set.reps,
      updated_at: timestamp,
    }));
  });

  if (setRows.length) {
    const { error: insertSetsError } = await client.from('workout_sets').insert(setRows);
    if (insertSetsError) {
      throw new Error(insertSetsError.message);
    }
  }

  return sessionId;
};

export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
  const userId = await requireUserId();
  const client = ensureClient();

  const { error } = await client
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message);
  }
};

export const getHomeSummary = async (): Promise<HomeSummary> => {
  const today = todayDateKey();
  const userId = await getCurrentUserId();

  if (!userId) {
    return {
      todayDate: today,
      todayWorkoutCount: 0,
      lastWorkout: null,
    };
  }

  try {
    const client = ensureClient();

    const { count: todayCount, error: todayCountError } = await client
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today);

    if (todayCountError) {
      throw new Error(todayCountError.message);
    }

    const { data: lastSessions, error: lastSessionError } = await client
      .from('workout_sessions')
      .select('id, date, type, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1);

    if (lastSessionError) {
      throw new Error(lastSessionError.message);
    }

    const lastWorkoutId = ((lastSessions ?? []) as SessionRow[])[0]?.id;
    const lastWorkout = lastWorkoutId ? await getWorkoutSessionById(lastWorkoutId) : null;

    return {
      todayDate: today,
      todayWorkoutCount: Number(todayCount ?? 0),
      lastWorkout,
    };
  } catch (err) {
    if (__DEV__) {
      console.warn('getHomeSummary: network error, returning empty summary.', err);
    }
    return {
      todayDate: today,
      todayWorkoutCount: 0,
      lastWorkout: null,
    };
  }
};

export const getWeeklyInsights = async (days = 7): Promise<WeeklyInsights> => {
  const periodEnd = todayDateKey();
  const periodStart = addDays(periodEnd, -(days - 1));
  const userId = await getCurrentUserId();

  if (!userId) {
    return {
      periodStart,
      periodEnd,
      workoutCount: 0,
      upperSessionCount: 0,
      lowerSessionCount: 0,
      totalSetCount: 0,
      exerciseInsights: [],
    };
  }

  const client = ensureClient();
  const { data: sessionData, error: sessionError } = await client
    .from('workout_sessions')
    .select('id, date, type, notes, created_at, updated_at')
    .eq('user_id', userId)
    .gte('date', periodStart)
    .lte('date', periodEnd);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessions = (sessionData ?? []) as SessionRow[];
  if (!sessions.length) {
    return {
      periodStart,
      periodEnd,
      workoutCount: 0,
      upperSessionCount: 0,
      lowerSessionCount: 0,
      totalSetCount: 0,
      exerciseInsights: [],
    };
  }

  const upperSessionCount = sessions.filter((row) => row.type === 'upper').length;
  const lowerSessionCount = sessions.filter((row) => row.type === 'lower').length;

  const sessionIds = sessions.map((row) => row.id);
  const exercises = await fetchExercisesForSessions(userId, sessionIds);
  const sets = await fetchSetsForExercises(userId, exercises.map((row) => row.id));

  const sessionDateById = new Map<string, string>(sessions.map((row) => [row.id, row.date]));
  const setsByExerciseId = new Map<string, SetRow[]>();

  for (const row of sets) {
    const current = setsByExerciseId.get(row.exercise_id) ?? [];
    current.push(row);
    setsByExerciseId.set(row.exercise_id, current);
  }

  const aggregateByName = new Map<
    string,
    {
      exerciseName: string;
      setCount: number;
      totalReps: number;
      totalLoadKg: number;
      weightSum: number;
      lastPerformedDate: string;
    }
  >();

  for (const exercise of exercises) {
    const exerciseSets = setsByExerciseId.get(exercise.id) ?? [];
    if (!exerciseSets.length) {
      continue;
    }

    const performedDate = sessionDateById.get(exercise.session_id) ?? periodStart;
    const current =
      aggregateByName.get(exercise.name) ??
      {
        exerciseName: exercise.name,
        setCount: 0,
        totalReps: 0,
        totalLoadKg: 0,
        weightSum: 0,
        lastPerformedDate: performedDate,
      };

    for (const set of exerciseSets) {
      const reps = Number(set.reps);
      const weight = Number(set.weight);
      current.setCount += 1;
      current.totalReps += reps;
      current.totalLoadKg += weight * reps;
      current.weightSum += weight;
    }

    if (performedDate > current.lastPerformedDate) {
      current.lastPerformedDate = performedDate;
    }

    aggregateByName.set(exercise.name, current);
  }

  const exerciseInsights: WeeklyExerciseInsight[] = Array.from(aggregateByName.values())
    .map((row) => ({
      exerciseName: row.exerciseName,
      setCount: row.setCount,
      totalReps: row.totalReps,
      averageReps: row.setCount > 0 ? row.totalReps / row.setCount : 0,
      totalLoadKg: row.totalLoadKg,
      averageWeightKg: row.setCount > 0 ? row.weightSum / row.setCount : 0,
      lastPerformedDate: row.lastPerformedDate,
    }))
    .filter((row) => row.setCount > 0)
    .sort((a, b) => {
      if (a.setCount !== b.setCount) {
        return b.setCount - a.setCount;
      }

      if (a.totalLoadKg !== b.totalLoadKg) {
        return b.totalLoadKg - a.totalLoadKg;
      }

      return a.exerciseName.localeCompare(b.exerciseName);
    });

  const totalSetCount = exerciseInsights.reduce((sum, row) => sum + row.setCount, 0);

  return {
    periodStart,
    periodEnd,
    workoutCount: sessions.length,
    upperSessionCount,
    lowerSessionCount,
    totalSetCount,
    exerciseInsights,
  };
};

export const listRecordedExercisesByType = async (type: WorkoutType): Promise<string[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const client = ensureClient();
  const { data: sessionData, error: sessionError } = await client
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessionIds = (sessionData ?? []).map((row) => String((row as { id: string }).id));
  if (!sessionIds.length) {
    return [];
  }

  const exercises = await fetchExercisesForSessions(userId, sessionIds);
  const unique = Array.from(new Set(exercises.map((row) => row.name.trim()).filter((name) => name.length > 0)));

  return unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};

export const getExerciseProgressSeries = async (input: {
  workoutType: WorkoutType;
  exerciseName: string;
  sessionLimit: number;
}): Promise<ExerciseProgressPoint[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const sessionLimit = Math.max(1, Math.min(100, Math.floor(input.sessionLimit)));
  const client = ensureClient();

  const { data: sessionData, error: sessionError } = await client
    .from('workout_sessions')
    .select('id, date, type, notes, created_at, updated_at')
    .eq('user_id', userId)
    .eq('type', input.workoutType)
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessions = (sessionData ?? []) as SessionRow[];
  if (!sessions.length) {
    return [];
  }

  const sessionIds = sessions.map((row) => row.id);
  const { data: exerciseData, error: exerciseError } = await client
    .from('workout_exercises')
    .select('id, session_id, name, order_index')
    .eq('user_id', userId)
    .in('session_id', sessionIds)
    .ilike('name', input.exerciseName.trim());

  if (exerciseError) {
    throw new Error(exerciseError.message);
  }

  const exercises = (exerciseData ?? []) as ExerciseRow[];
  if (!exercises.length) {
    return [];
  }

  const exerciseIds = exercises.map((row) => row.id);
  const sets = await fetchSetsForExercises(userId, exerciseIds);

  const setsByExerciseId = new Map<string, SetRow[]>();
  for (const row of sets) {
    const current = setsByExerciseId.get(row.exercise_id) ?? [];
    current.push(row);
    setsByExerciseId.set(row.exercise_id, current);
  }

  const exercisesBySessionId = new Map<string, ExerciseRow[]>();
  for (const row of exercises) {
    const current = exercisesBySessionId.get(row.session_id) ?? [];
    current.push(row);
    exercisesBySessionId.set(row.session_id, current);
  }

  const points: ExerciseProgressPoint[] = [];

  for (const session of sessions) {
    const sessionExercises = exercisesBySessionId.get(session.id);
    if (!sessionExercises?.length) {
      continue;
    }

    let setCount = 0;
    let totalReps = 0;
    let totalLoadKg = 0;
    let maxWeightKg = 0;
    let weightSum = 0;
    let estimatedOneRmKg = 0;

    for (const exercise of sessionExercises) {
      const rows = setsByExerciseId.get(exercise.id) ?? [];
      for (const set of rows) {
        const reps = Number(set.reps);
        const weight = Number(set.weight);
        setCount += 1;
        totalReps += reps;
        totalLoadKg += reps * weight;
        weightSum += weight;
        maxWeightKg = Math.max(maxWeightKg, weight);
        if (reps >= 1 && reps < 15) {
          estimatedOneRmKg = Math.max(estimatedOneRmKg, weight * (1 + reps / 30));
        }
      }
    }

    points.push({
      sessionId: session.id,
      date: session.date,
      workoutType: toWorkoutType(session.type),
      setCount,
      totalReps,
      totalLoadKg,
      maxWeightKg,
      averageWeightKg: setCount > 0 ? weightSum / setCount : 0,
      estimatedOneRmKg,
    });

    if (points.length >= sessionLimit) {
      break;
    }
  }

  return points;
};

export const getWorkoutCsvRows = async (): Promise<WorkoutCsvRow[]> => {
  if (!isSupabaseConfigured) {
    return [];
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const client = ensureClient();
  const { data: sessionData, error: sessionError } = await client
    .from('workout_sessions')
    .select('id, date, type, notes, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const sessions = (sessionData ?? []) as SessionRow[];
  if (!sessions.length) {
    return [];
  }

  const sessionOrder = new Map<string, number>(sessions.map((row, idx) => [row.id, idx]));
  const sessionIds = sessions.map((row) => row.id);
  const exercises = await fetchExercisesForSessions(userId, sessionIds);
  const sets = await fetchSetsForExercises(userId, exercises.map((row) => row.id));

  const exercisesBySession = new Map<string, ExerciseRow[]>();
  for (const row of exercises) {
    const current = exercisesBySession.get(row.session_id) ?? [];
    current.push(row);
    exercisesBySession.set(row.session_id, current);
  }

  for (const rows of exercisesBySession.values()) {
    rows.sort((a, b) => Number(a.order_index) - Number(b.order_index));
  }

  const setsByExercise = new Map<string, SetRow[]>();
  for (const row of sets) {
    const current = setsByExercise.get(row.exercise_id) ?? [];
    current.push(row);
    setsByExercise.set(row.exercise_id, current);
  }

  for (const rows of setsByExercise.values()) {
    rows.sort((a, b) => Number(a.set_index) - Number(b.set_index));
  }

  const rows: WorkoutCsvRow[] = [];

  const orderedSessions = [...sessions].sort((a, b) => (sessionOrder.get(a.id) ?? 0) - (sessionOrder.get(b.id) ?? 0));

  for (const session of orderedSessions) {
    const sessionExercises = exercisesBySession.get(session.id) ?? [];

    if (!sessionExercises.length) {
      rows.push({
        date: session.date,
        workoutType: toWorkoutType(session.type),
        exercise: '',
        setNumber: null,
        weight: null,
        reps: null,
        notes: session.notes ?? '',
      });
      continue;
    }

    for (const exercise of sessionExercises) {
      const exerciseSets = setsByExercise.get(exercise.id) ?? [];

      if (!exerciseSets.length) {
        rows.push({
          date: session.date,
          workoutType: toWorkoutType(session.type),
          exercise: exercise.name,
          setNumber: null,
          weight: null,
          reps: null,
          notes: session.notes ?? '',
        });
        continue;
      }

      for (const set of exerciseSets) {
        rows.push({
          date: session.date,
          workoutType: toWorkoutType(session.type),
          exercise: exercise.name,
          setNumber: Number(set.set_index),
          weight: Number(set.weight),
          reps: Number(set.reps),
          notes: session.notes ?? '',
        });
      }
    }
  }

  return rows;
};

export const createDatabaseSnapshot = async (): Promise<DatabaseSnapshot> => {
  const userId = await requireUserId();
  const client = ensureClient();

  const [settingsRow, sessions, exercises, sets] = await Promise.all([
    getSettingsRow(userId),
    client
      .from('workout_sessions')
      .select('id, date, type, notes, created_at, updated_at')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as SessionRow[];
      }),
    client
      .from('workout_exercises')
      .select('id, session_id, name, order_index')
      .eq('user_id', userId)
      .order('session_id', { ascending: true })
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as ExerciseRow[];
      }),
    client
      .from('workout_sets')
      .select('id, exercise_id, set_index, weight, reps')
      .eq('user_id', userId)
      .order('exercise_id', { ascending: true })
      .order('set_index', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as SetRow[];
      }),
  ]);

  const settings = mapSettings(settingsRow);

  return {
    version: 3,
    exported_at: nowIso(),
    app_settings: [
      { key: 'unit_preference', value: settings.unitPreference },
      { key: 'last_cloud_sync_at', value: settingsRow?.updated_at ?? '' },
    ],
    workout_sessions: sessions,
    workout_exercises: exercises,
    workout_sets: sets,
  };
};

export const restoreDatabaseSnapshot = async (snapshot: DatabaseSnapshot): Promise<void> => {
  const userId = await requireUserId();
  const client = ensureClient();

  const settingMap = new Map(snapshot.app_settings.map((row) => [row.key, row.value]));
  const unitPreference = settingMap.get('unit_preference') === 'lbs' ? 'lbs' : 'kg';

  const { error: deleteSessionsError } = await client
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId);
  if (deleteSessionsError) {
    throw new Error(deleteSessionsError.message);
  }

  const { error: deleteSettingsError } = await client
    .from('user_settings')
    .delete()
    .eq('user_id', userId);
  if (deleteSettingsError) {
    throw new Error(deleteSettingsError.message);
  }

  if (snapshot.workout_sessions.length) {
    const { error } = await client.from('workout_sessions').insert(
      snapshot.workout_sessions.map((row) => ({
        user_id: userId,
        id: row.id,
        date: row.date,
        type: toWorkoutType(row.type),
        notes: row.notes ?? '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }))
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.workout_exercises.length) {
    const { error } = await client.from('workout_exercises').insert(
      snapshot.workout_exercises.map((row) => ({
        user_id: userId,
        id: row.id,
        session_id: row.session_id,
        name: row.name,
        order_index: Number(row.order_index),
        updated_at: nowIso(),
      }))
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  if (snapshot.workout_sets.length) {
    const { error } = await client.from('workout_sets').insert(
      snapshot.workout_sets.map((row) => ({
        user_id: userId,
        id: row.id,
        exercise_id: row.exercise_id,
        set_index: Number(row.set_index),
        weight: Number(row.weight),
        reps: Number(row.reps),
        updated_at: nowIso(),
      }))
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  const { error: settingsError } = await client.from('user_settings').insert({
    user_id: userId,
    unit_preference: unitPreference,
    updated_at: nowIso(),
  });

  if (settingsError) {
    throw new Error(settingsError.message);
  }
};

export const seedSampleData = async (): Promise<void> => {
  const existing = await listWorkoutSessions('all');
  if (existing.length > 0) {
    throw new Error('Sample data seeding only runs on an empty account.');
  }

  const today = todayDateKey();
  const yesterday = addDays(today, -1);

  await saveWorkoutSession({
    date: yesterday,
    type: 'upper',
    notes: 'Sample upper session.',
    exercises: [
      {
        name: 'Incline Dumbbell Press',
        sets: [
          { weight: '12', reps: '10' },
          { weight: '16', reps: '8' },
          { weight: '16', reps: '7' },
        ],
      },
    ],
  });

  await saveWorkoutSession({
    date: today,
    type: 'lower',
    notes: 'Sample lower session.',
    exercises: [
      {
        name: 'Squat / Hack Squat',
        sets: [
          { weight: '80', reps: '8' },
          { weight: '80', reps: '7' },
          { weight: '80', reps: '6' },
        ],
      },
    ],
  });
};
