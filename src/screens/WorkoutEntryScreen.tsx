import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  buildWorkoutTemplateDraft,
  deleteWorkoutSession,
  getLatestSetsForExerciseName,
  getWorkoutSessionById,
  saveWorkoutSession,
} from '../db/database';
import { EditableExerciseDraft, WorkoutType } from '../models/types';
import { getTemplateByType, MAX_SETS_PER_EXERCISE } from '../models/templates';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { FormField } from '../components/FormField';
import { SegmentedControl } from '../components/SegmentedControl';
import { RestTimer } from '../components/RestTimer';
import { MuscleGroupIcon } from '../components/MuscleGroupIcon';
import { PRCelebration } from '../components/animations/PRCelebration';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { isValidDateKey, todayDateKey } from '../utils/date';

const setKey = (exerciseIndex: number, setIndex: number): string => `${exerciseIndex}-${setIndex}`;
const normalizeExerciseName = (value: string): string => value.trim().toLowerCase();

export default function WorkoutEntryScreen() {
  const router = useRouter();
  const { refresh } = useAppRefresh();
  const { sessionId: existingSessionId, presetType: presetTypeParam } = useLocalSearchParams<{ sessionId?: string; presetType?: string }>();
  const presetType = (presetTypeParam ?? 'upper') as WorkoutType;
  const isEditing = Boolean(existingSessionId);

  const scrollRef = useRef<ScrollView | null>(null);
  const setInputRefs = useRef<Record<string, TextInput | null>>({});
  const exerciseOffsetY = useRef<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayDateKey());
  const [type, setType] = useState<WorkoutType>(presetType);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<EditableExerciseDraft[]>([]);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [expandedExerciseIndex, setExpandedExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({});
  const [sessionCardCollapsed, setSessionCardCollapsed] = useState(isEditing);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [prCelebration, setPrCelebration] = useState<{ visible: boolean; exercise: string; metric: string }>({ visible: false, exercise: '', metric: '' });
  const [flashSavedKeys, setFlashSavedKeys] = useState<Set<string>>(new Set());

  const draftSessionIdRef = useRef<string | null>(null);
  const prevCompletedRef = useRef<Record<string, boolean>>({});
  const exercisesRef = useRef(exercises);
  const dateRef = useRef(date);
  const typeRef = useRef(type);
  const notesRef = useRef(notes);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (existingSessionId) {
          const session = await getWorkoutSessionById(existingSessionId);
          if (!active) return;
          if (!session) { Alert.alert('Not found', 'Workout session could not be loaded.'); router.back(); return; }
          setDate(session.date);
          setType(session.type);
          setNotes(session.notes ?? '');
          setExercises(session.exercises.map((exercise) => ({
            id: exercise.id, name: exercise.name,
            sets: exercise.sets.length > 0
              ? exercise.sets.map((set) => ({ weight: String(set.weight), reps: String(set.reps) }))
              : [{ weight: '', reps: '' }],
          })));
        } else {
          const template = await buildWorkoutTemplateDraft(presetType);
          if (!active) return;
          setDate(todayDateKey()); setType(presetType); setNotes(''); setExercises(template);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Could not load workout.';
        console.warn('[WorkoutEntry] load error:', message);
        if (!existingSessionId) {
          setDate(todayDateKey()); setType(presetType); setNotes('');
          setExercises([{ name: '', sets: [{ weight: '', reps: '' }] }]);
        } else { Alert.alert('Load failed', message); router.back(); return; }
      }
      if (active) { setActiveExerciseIndex(0); setExpandedExerciseIndex(0); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [existingSessionId, presetType]);

  useEffect(() => {
    setCompletedSets((prev) => {
      const next: Record<string, boolean> = {};
      exercises.forEach((exercise, exerciseIndex) => {
        exercise.sets.forEach((set, setIndex) => {
          const key = setKey(exerciseIndex, setIndex);
          next[key] = prev[key] ?? Boolean(set.weight.trim() && set.reps.trim());
        });
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged = prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key]);
      return unchanged ? prev : next;
    });
  }, [exercises]);

  useEffect(() => {
    if (!exercises.length) { setActiveExerciseIndex(0); setExpandedExerciseIndex(0); return; }
    if (activeExerciseIndex >= exercises.length) setActiveExerciseIndex(exercises.length - 1);
    if (expandedExerciseIndex >= exercises.length) setExpandedExerciseIndex(exercises.length - 1);
  }, [activeExerciseIndex, expandedExerciseIndex, exercises.length]);

  // Keep refs in sync for stale-closure-free auto-save
  useEffect(() => { exercisesRef.current = exercises; }, [exercises]);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => { typeRef.current = type; }, [type]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const triggerAutoSave = useCallback(async () => {
    try {
      const savedId = await saveWorkoutSession({
        sessionId: draftSessionIdRef.current ?? undefined,
        date: dateRef.current,
        type: typeRef.current,
        notes: notesRef.current,
        exercises: exercisesRef.current,
      });
      if (!draftSessionIdRef.current) draftSessionIdRef.current = savedId;
    } catch (error) {
      console.warn('[WorkoutEntry] auto-save failed:', error instanceof Error ? error.message : error);
    }
  }, []);

  // Auto-save whenever a new set is completed (new sessions only)
  useEffect(() => {
    if (isEditing || loading) { prevCompletedRef.current = { ...completedSets }; return; }
    const prev = prevCompletedRef.current;
    const newlyCompleted: string[] = [];
    for (const [key, isDone] of Object.entries(completedSets)) {
      if (isDone && !prev[key]) newlyCompleted.push(key);
    }
    prevCompletedRef.current = { ...completedSets };
    if (newlyCompleted.length === 0) return;

    setFlashSavedKeys((prevKeys) => {
      const next = new Set(prevKeys);
      newlyCompleted.forEach((k) => next.add(k));
      return next;
    });
    const timer = setTimeout(() => {
      setFlashSavedKeys((prevKeys) => {
        const next = new Set(prevKeys);
        newlyCompleted.forEach((k) => next.delete(k));
        return next;
      });
    }, 1500);
    void triggerAutoSave();
    return () => clearTimeout(timer);
  }, [completedSets, isEditing, loading, triggerAutoSave]);

  const totalSets = useMemo(() => exercises.reduce((count, exercise) => count + exercise.sets.length, 0), [exercises]);

  const templateExerciseNames = useMemo(() => getTemplateByType(type).map((item) => item.name), [type]);

  const existingNameSet = useMemo(() => new Set(exercises.map((e) => normalizeExerciseName(e.name)).filter(Boolean)), [exercises]);

  const missingTemplateExercises = useMemo(() =>
    templateExerciseNames.filter((name) => !existingNameSet.has(normalizeExerciseName(name))),
  [existingNameSet, templateExerciseNames]);

  const getInputKey = (ei: number, si: number, field: 'weight' | 'reps'): string => `${ei}-${si}-${field}`;
  const setInputRef = (ei: number, si: number, field: 'weight' | 'reps', input: TextInput | null) => {
    setInputRefs.current[getInputKey(ei, si, field)] = input;
  };
  const focusSetInput = (ei: number, si: number, field: 'weight' | 'reps') => {
    setInputRefs.current[getInputKey(ei, si, field)]?.focus();
  };

  const goToExercise = (exerciseIndex: number) => {
    if (exerciseIndex < 0 || exerciseIndex >= exercises.length) return;
    setActiveExerciseIndex(exerciseIndex); setExpandedExerciseIndex(exerciseIndex);
    requestAnimationFrame(() => {
      const y = exerciseOffsetY.current[exerciseIndex] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    });
  };

  const replaceWithTemplate = async (nextType: WorkoutType) => {
    const apply = async () => {
      try {
        const template = await buildWorkoutTemplateDraft(nextType);
        setType(nextType); setExercises(template);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load template.';
        console.warn('[WorkoutEntry] replaceWithTemplate error:', message);
        setType(nextType); setExercises([{ name: '', sets: [{ weight: '', reps: '' }] }]);
      }
      setActiveExerciseIndex(0); setExpandedExerciseIndex(0);
    };
    if (exercises.length === 0) { await apply(); return; }
    Alert.alert('Load template', 'Replace current exercises with the default template and last-used values?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: () => { void apply(); } },
    ]);
  };

  const setExerciseValue = (ei: number, updater: (e: EditableExerciseDraft) => EditableExerciseDraft) => {
    setExercises((prev) => prev.map((item, idx) => (idx === ei ? updater(item) : item)));
  };

  const addSet = (exerciseIndex: number, focusAfterAdd = false) => {
    let nextSetIndex: number | null = null;
    setExerciseValue(exerciseIndex, (exercise) => {
      if (exercise.sets.length >= MAX_SETS_PER_EXERCISE) return exercise;
      nextSetIndex = exercise.sets.length;
      return { ...exercise, sets: [...exercise.sets, { weight: '', reps: '' }] };
    });
    if (focusAfterAdd) setTimeout(() => { if (nextSetIndex !== null) focusSetInput(exerciseIndex, nextSetIndex, 'weight'); }, 40);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExerciseValue(exerciseIndex, (exercise) => {
      const nextSets = exercise.sets.filter((_, index) => index !== setIndex);
      return { ...exercise, sets: nextSets.length ? nextSets : [{ weight: '', reps: '' }] };
    });
  };

  const handleSubmitWeight = (ei: number, si: number) => focusSetInput(ei, si, 'reps');
  const handleSubmitReps = (ei: number, si: number) => {
    const exercise = exercises[ei]; if (!exercise) return;
    const nextSetIndex = si + 1;
    if (nextSetIndex < exercise.sets.length) { focusSetInput(ei, nextSetIndex, 'weight'); return; }
    if (exercise.sets.length < MAX_SETS_PER_EXERCISE) { addSet(ei, true); return; }
    if (ei < exercises.length - 1) goToExercise(ei + 1);
  };

  const applyLastValues = async (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise?.name.trim()) { Alert.alert('Name required', 'Enter the exercise name first.'); return; }
    let lastSets: Array<{ weight: number; reps: number }> = [];
    try { lastSets = await getLatestSetsForExerciseName(exercise.name.trim()); } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load history.';
      Alert.alert('Load failed', message); return;
    }
    if (!lastSets.length) { Alert.alert('No history', `No previous sets found for ${exercise.name}.`); return; }
    setExerciseValue(exerciseIndex, (item) => ({
      ...item,
      sets: lastSets.slice(0, MAX_SETS_PER_EXERCISE).map((set) => ({ weight: String(set.weight), reps: String(set.reps) })),
    }));
  };

  const exerciseNameExists = (name: string, exceptIndex?: number): boolean => {
    const normalizedName = normalizeExerciseName(name);
    if (!normalizedName) return false;
    return exercises.some((exercise, index) => {
      if (exceptIndex !== undefined && index === exceptIndex) return false;
      return normalizeExerciseName(exercise.name) === normalizedName;
    });
  };

  const buildExerciseDraftFromName = async (name: string): Promise<EditableExerciseDraft> => {
    let lastSets: Array<{ weight: number; reps: number }> = [];
    try { lastSets = await getLatestSetsForExerciseName(name); } catch {}
    return {
      name,
      sets: lastSets.length > 0
        ? lastSets.map((set) => ({ weight: '', reps: '', weightHint: String(set.weight), repsHint: String(set.reps) }))
        : [{ weight: '', reps: '' }],
    };
  };

  const addExerciseByName = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (exerciseNameExists(trimmed)) { Alert.alert('Duplicate exercise', `${trimmed} is already in this session.`); return false; }
    const nextExercise = await buildExerciseDraftFromName(trimmed);
    let nextExerciseIndex = 0;
    setExercises((prev) => { nextExerciseIndex = prev.length; return [...prev, nextExercise]; });
    setTimeout(() => { goToExercise(nextExerciseIndex); }, 80);
    return true;
  };

  const addCustomExercise = async () => {
    const trimmed = newExerciseName.trim();
    if (!trimmed) { Alert.alert('Name required', 'Enter a custom exercise name to add.'); return; }
    const added = await addExerciseByName(trimmed);
    if (added) setNewExerciseName('');
  };

  const removeExercise = (exerciseIndex: number) => {
    setExercises((prev) => prev.filter((_, index) => index !== exerciseIndex));
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const key = setKey(exerciseIndex, setIndex);
    setCompletedSets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  };

  const markExerciseFinished = (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex]; if (!exercise) return;
    setCompletedSets((prev) => {
      const next = { ...prev };
      exercise.sets.forEach((set, setIndex) => {
        if (set.weight.trim() && set.reps.trim()) next[setKey(exerciseIndex, setIndex)] = true;
      });
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (exerciseIndex < exercises.length - 1) goToExercise(exerciseIndex + 1);
  };

  const completedCountForExercise = (exerciseIndex: number): number => {
    const exercise = exercises[exerciseIndex]; if (!exercise) return 0;
    return exercise.sets.reduce((count, set, setIndex) => {
      const key = setKey(exerciseIndex, setIndex);
      const autoCompleted = Boolean(set.weight.trim() && set.reps.trim());
      return count + (completedSets[key] ?? autoCompleted ? 1 : 0);
    }, 0);
  };

  const validateForm = (): string | null => {
    if (!isValidDateKey(date)) return 'Date must be valid and use YYYY-MM-DD.';
    const namedExercises = exercises.filter((e) => e.name.trim().length > 0);
    if (!namedExercises.length) return 'Add at least one exercise.';
    const seenNames = new Set<string>();
    for (const exercise of namedExercises) {
      const normalizedName = normalizeExerciseName(exercise.name);
      if (seenNames.has(normalizedName)) return `Exercise "${exercise.name}" appears more than once.`;
      seenNames.add(normalizedName);
      for (let idx = 0; idx < exercise.sets.length; idx += 1) {
        const set = exercise.sets[idx];
        const hasWeight = Boolean(set.weight.trim()); const hasReps = Boolean(set.reps.trim());
        if (hasWeight !== hasReps) return `Exercise "${exercise.name}", set ${idx + 1}: fill both weight and reps or leave both blank.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) { Alert.alert('Check your entry', validationError); return; }
    setSaving(true);
    try {
      // Check for PRs before saving
      let prExercise = '';
      let prMetric = '';
      for (const exercise of exercises) {
        if (!exercise.name.trim()) continue;
        try {
          const lastSets = await getLatestSetsForExerciseName(exercise.name.trim());
          if (lastSets.length > 0) {
            const prevMax = Math.max(...lastSets.map((s) => s.weight));
            const currentMax = Math.max(...exercise.sets.map((s) => parseFloat(s.weight) || 0));
            if (currentMax > prevMax && currentMax > 0 && !isEditing) {
              prExercise = exercise.name;
              prMetric = `${currentMax} kg (was ${prevMax} kg)`;
            }
          }
        } catch {}
      }

      await saveWorkoutSession({ sessionId: existingSessionId ?? draftSessionIdRef.current ?? undefined, date, type, notes, exercises });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();

      if (prExercise) {
        setPrCelebration({ visible: true, exercise: prExercise, metric: prMetric });
        // Router back after celebration dismisses
      } else {
        router.back();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save workout session.';
      Alert.alert('Save failed', message);
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!existingSessionId) return;
    Alert.alert('Delete workout', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteWorkoutSession(existingSessionId); refresh(); router.back(); }
        catch (error) { Alert.alert('Delete failed', error instanceof Error ? error.message : 'Could not delete.'); }
      }},
    ]);
  };

  const activeExerciseName = exercises[activeExerciseIndex]?.name || 'No exercise selected';
  const isLastExercise = activeExerciseIndex >= exercises.length - 1;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Session details card */}
        <Card style={styles.cardGap}>
          <Pressable style={styles.sessionCardHeader} onPress={() => setSessionCardCollapsed((v) => !v)}>
            <View style={styles.sessionCardHeaderLeft}>
              <Text style={styles.sectionTitle}>Session details</Text>
              {sessionCardCollapsed ? (
                <Text style={styles.sessionCardSummary}>{date} · {type.toUpperCase()} · {exercises.length} exercises</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>{sessionCardCollapsed ? '›' : '‹'}</Text>
          </Pressable>

          {!sessionCardCollapsed ? (
            <>
              <FormField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" maxLength={10} />
              <Text style={styles.label}>Workout type</Text>
              <SegmentedControl
                value={type}
                options={[{ label: 'Upper', value: 'upper' }, { label: 'Lower', value: 'lower' }]}
                onChange={(value) => { const nextType = value as WorkoutType; if (nextType !== type) void replaceWithTemplate(nextType); }}
              />
              <View style={styles.buttonRow}>
                <AppButton label="Load Upper" variant="ghost" style={styles.flex1} onPress={() => replaceWithTemplate('upper')} />
                <AppButton label="Load Lower" variant="ghost" style={styles.flex1} onPress={() => replaceWithTemplate('lower')} />
              </View>
              <FormField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional session notes" multiline />
              <Text style={styles.helperText}>{exercises.length} exercises · {totalSets} set slots</Text>
            </>
          ) : null}
        </Card>

        {/* Rest Timer */}
        <Pressable
          style={styles.restTimerToggle}
          onPress={() => setShowRestTimer((v) => !v)}
        >
          <Text style={styles.restTimerToggleText}>
            {showRestTimer ? '⏱ Hide Rest Timer' : '⏱ Rest Timer'}
          </Text>
        </Pressable>
        {showRestTimer ? <RestTimer onDismiss={() => setShowRestTimer(false)} /> : null}

        {/* Set matrix */}
        <Card style={styles.cardGap}>
          <Text style={styles.sectionTitle}>Exercises</Text>

          <Text style={styles.subSectionLabel}>Template quick add ({type.toUpperCase()})</Text>
          {missingTemplateExercises.length ? (
            <View style={styles.templateChipsWrap}>
              {missingTemplateExercises.map((exerciseName) => (
                <Pressable key={exerciseName} style={styles.templateChip} onPress={() => { void addExerciseByName(exerciseName); }}>
                  <Text style={styles.templateChipLabel}>+ {exerciseName}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>All standard {type.toUpperCase()} exercises added.</Text>
          )}

          {exercises.map((exercise, exerciseIndex) => {
            const isExpanded = exerciseIndex === expandedExerciseIndex;
            const isActive = exerciseIndex === activeExerciseIndex;
            const doneCount = completedCountForExercise(exerciseIndex);
            const allDone = doneCount === exercise.sets.length && exercise.sets.length > 0;

            return (
              <View key={`${exercise.name}-${exerciseIndex}`} onLayout={(event) => { exerciseOffsetY.current[exerciseIndex] = event.nativeEvent.layout.y; }}>
                <Card style={[styles.exerciseCard, isActive ? styles.exerciseCardActive : null]}>
                  <View style={styles.exerciseHeader}>
                    <Pressable onPress={() => goToExercise(exerciseIndex)} style={styles.exerciseHeaderPressable}>
                      <MuscleGroupIcon exerciseName={exercise.name} size={36} style={{ marginRight: 8 }} />
                      <View style={styles.exerciseHeaderTextWrap}>
                        <Text style={styles.exerciseTitle} numberOfLines={1}>
                          {exercise.name || `Exercise ${exerciseIndex + 1}`}
                        </Text>
                        <Text style={styles.exerciseSubtext}>{doneCount}/{exercise.sets.length} sets done</Text>
                      </View>
                    </Pressable>
                    <View style={[styles.completionChip, allDone ? styles.completionChipDone : null]}>
                      <Text style={[styles.completionChipText, allDone ? styles.completionChipTextDone : null]}>
                        {allDone ? '✓' : `${doneCount}/${exercise.sets.length}`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setExpandedExerciseIndex(isExpanded ? -1 : exerciseIndex)}
                      style={styles.expandToggleBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.expandToggleText}>{isExpanded ? '−' : '+'}</Text>
                    </Pressable>
                  </View>

                  {isExpanded ? (
                    <>
                      <FormField
                        label={`Exercise ${exerciseIndex + 1}`}
                        value={exercise.name}
                        onChangeText={(value) => setExerciseValue(exerciseIndex, (item) => ({ ...item, name: value }))}
                        placeholder="Exercise name"
                        helperText="Use consistent names for cleaner progress tracking."
                      />

                      {exercise.sets.some((s) => s.weightHint && s.repsHint) ? (
                        <View style={styles.lastSessionBlock}>
                          <Text style={styles.lastSessionLabel}>Last session</Text>
                          <View style={styles.lastSessionRows}>
                            {exercise.sets.map((s, si) =>
                              s.weightHint && s.repsHint ? (
                                <Text key={si} style={styles.lastSessionRow}>
                                  {`${si + 1}.  ${s.weightHint}kg × ${s.repsHint}`}
                                </Text>
                              ) : null
                            )}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.matrixHeaderRow}>
                        <Text style={[styles.matrixHeaderText, styles.colSet]}>Set</Text>
                        <Text style={[styles.matrixHeaderText, styles.colInput]}>kg</Text>
                        <Text style={[styles.matrixHeaderText, styles.colInput]}>Reps</Text>
                        <View style={{ width: 44 }} />
                      </View>

                      <View style={styles.matrixRowsWrap}>
                        {exercise.sets.map((set, setIndex) => {
                          const key = setKey(exerciseIndex, setIndex);
                          const setCompleted = completedSets[key] ?? Boolean(set.weight.trim() && set.reps.trim());
                          const isLastSet = setIndex === exercise.sets.length - 1;
                          const canAddMoreSets = exercise.sets.length < MAX_SETS_PER_EXERCISE;
                          const isFlashing = flashSavedKeys.has(key);

                          return (
                            <View key={`${exerciseIndex}-${setIndex}`} style={[styles.matrixRow, setCompleted ? styles.matrixRowDone : null]}>
                              <Pressable
                                style={[styles.setBadge, exercise.sets.length > 1 ? styles.setBadgeDeletable : null, isFlashing ? styles.setBadgeFlash : null]}
                                onPress={() => exercise.sets.length > 1 ? removeSet(exerciseIndex, setIndex) : undefined}
                              >
                                <Text style={[styles.setBadgeText, exercise.sets.length > 1 ? styles.setBadgeDeleteText : null, isFlashing ? styles.setBadgeFlashText : null]}>
                                  {isFlashing ? '✓' : exercise.sets.length > 1 ? '×' : String(setIndex + 1)}
                                </Text>
                              </Pressable>

                              <TextInput
                                ref={(input) => setInputRef(exerciseIndex, setIndex, 'weight', input)}
                                style={[styles.matrixInput, styles.colInput, setCompleted ? styles.matrixInputDone : null]}
                                value={set.weight} onChangeText={(value) =>
                                  setExerciseValue(exerciseIndex, (item) => ({
                                    ...item, sets: item.sets.map((setRow, innerIndex) =>
                                      innerIndex === setIndex ? { ...setRow, weight: value } : setRow),
                                  }))}
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => handleSubmitWeight(exerciseIndex, setIndex)}
                              />

                              <TextInput
                                ref={(input) => setInputRef(exerciseIndex, setIndex, 'reps', input)}
                                style={[styles.matrixInput, styles.colInput, setCompleted ? styles.matrixInputDone : null]}
                                value={set.reps} onChangeText={(value) =>
                                  setExerciseValue(exerciseIndex, (item) => ({
                                    ...item, sets: item.sets.map((setRow, innerIndex) =>
                                      innerIndex === setIndex ? { ...setRow, reps: value } : setRow),
                                  }))}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType={isLastSet && !canAddMoreSets ? 'done' : 'next'}
                                blurOnSubmit={isLastSet && !canAddMoreSets}
                                onSubmitEditing={() => handleSubmitReps(exerciseIndex, setIndex)}
                              />

                              <Pressable
                                style={[styles.checkBtn, setCompleted && styles.checkBtnDone]}
                                onPress={() => toggleSetComplete(exerciseIndex, setIndex)}
                                hitSlop={4}
                              >
                                <Text style={[styles.checkText, setCompleted && styles.checkTextDone]}>✓</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.exerciseActionsRow}>
                        <AppButton label="+ Set" variant="secondary" style={styles.flex1}
                          onPress={() => addSet(exerciseIndex, true)} disabled={exercise.sets.length >= MAX_SETS_PER_EXERCISE} />
                        <AppButton label="Copy Last" variant="ghost" style={styles.flex1} onPress={() => applyLastValues(exerciseIndex)} />
                        <AppButton label="Finish" variant="primary" style={styles.flex1} onPress={() => markExerciseFinished(exerciseIndex)} />
                      </View>

                      <AppButton label="Remove Exercise" variant="danger" onPress={() => removeExercise(exerciseIndex)} style={styles.removeExerciseButton} />
                    </>
                  ) : null}
                </Card>
              </View>
            );
          })}

          <Text style={styles.subSectionLabel}>Add custom exercise</Text>
          <View style={styles.addExerciseRow}>
            <TextInput style={styles.exerciseInput} value={newExerciseName} onChangeText={setNewExerciseName}
              placeholder="Custom exercise name" placeholderTextColor={colors.textMuted}
              returnKeyType="done" onSubmitEditing={() => { void addCustomExercise(); }} />
            <AppButton label="Add" onPress={() => void addCustomExercise()} variant="primary" style={styles.addExerciseButton} />
          </View>
        </Card>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.stickyFooter}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: exercises.length > 0 ? `${((activeExerciseIndex + 1) / exercises.length) * 100}%` : '0%' }]} />
        </View>
        <View style={styles.footerProgressRow}>
          <Text style={styles.footerProgressText}>
            <Text style={styles.footerProgressCurrent}>{activeExerciseIndex + 1}</Text>
            <Text style={styles.footerProgressTotal}> / {exercises.length} exercises</Text>
          </Text>
          <Text style={styles.footerExerciseName} numberOfLines={1}>{activeExerciseName}</Text>
        </View>
        <View style={styles.footerButtonRow}>
          <AppButton label="Next Exercise" variant="secondary" style={styles.flex1}
            onPress={() => goToExercise(Math.min(activeExerciseIndex + 1, exercises.length - 1))}
            disabled={isLastExercise || exercises.length === 0} />
          <AppButton label={saving ? 'Saving...' : 'Save Session'} onPress={handleSave} disabled={saving} style={styles.flex1} />
        </View>
        {isEditing ? (
          <Pressable onPress={handleDelete} style={styles.deleteTextButton}>
            <Text style={styles.deleteText}>Delete Session</Text>
          </Pressable>
        ) : null}
      </View>

      {/* PR Celebration overlay */}
      <PRCelebration
        visible={prCelebration.visible}
        exerciseName={prCelebration.exercise}
        metricLabel={prCelebration.metric}
        onDismiss={() => {
          setPrCelebration({ visible: false, exercise: '', metric: '' });
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 160, gap: spacing.sm, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.medium },
  cardGap: { gap: spacing.sm },
  sectionTitle: { fontSize: 20, fontFamily: fonts.black, color: colors.textPrimary, letterSpacing: -0.3 },
  subSectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  label: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  helperText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  templateChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  templateChip: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,232,159,0.20)', backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  templateChipLabel: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold },
  exerciseCard: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceElevated },
  exerciseCardActive: { borderColor: colors.primary, borderWidth: 1.5 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseHeaderPressable: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  exerciseHeaderTextWrap: { flex: 1, gap: 2 },
  expandToggleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  expandToggleText: { color: colors.primary, fontSize: 20, fontFamily: fonts.bold, lineHeight: 22 },
  exerciseTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.black, letterSpacing: -0.2 },
  exerciseSubtext: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bold },
  matrixHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 2 },
  matrixHeaderText: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  matrixRowsWrap: { gap: spacing.xs },
  colSet: { width: 36 },
  colInput: { flex: 1 },
  setBadge: { width: 36, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  setBadgeDeletable: { borderColor: 'rgba(255,69,69,0.20)', backgroundColor: colors.dangerSoft },
  setBadgeText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.bold },
  setBadgeDeleteText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  setBadgeFlash: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  setBadgeFlashText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  matrixRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  matrixRowDone: { opacity: 0.6 },
  matrixInput: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, color: colors.textPrimary, backgroundColor: colors.background, fontSize: 15, fontFamily: fonts.monoBold, textAlign: 'center' },
  matrixInputDone: { borderColor: colors.primary },
  lastSessionBlock: { backgroundColor: colors.surfaceElevated, borderRadius: 8, padding: spacing.sm, gap: 4 },
  lastSessionLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  lastSessionRows: { gap: 2 },
  lastSessionRow: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  checkBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkText: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
  checkTextDone: { color: colors.primary },
  exerciseActionsRow: { flexDirection: 'row', gap: spacing.sm },
  removeExerciseButton: { marginTop: spacing.xs },
  addExerciseRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  exerciseInput: { flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.sm, color: colors.textPrimary, backgroundColor: colors.surfaceElevated, fontSize: 14, fontFamily: fonts.semiBold },
  addExerciseButton: { minWidth: 80 },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionCardHeaderLeft: { flex: 1, gap: 2 },
  sessionCardSummary: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.semiBold },
  chevron: { color: colors.primary, fontSize: 20, fontFamily: fonts.bold, paddingLeft: spacing.sm },
  completionChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', minWidth: 40 },
  completionChipDone: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  completionChipText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bold },
  completionChipTextDone: { color: colors.primary },
  stickyFooter: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  progressBarTrack: { height: 3, borderRadius: 99, backgroundColor: colors.borderStrong, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary },
  footerProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerProgressText: { fontSize: 13 },
  footerProgressCurrent: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  footerProgressTotal: { color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 13 },
  footerExerciseName: { color: colors.textSecondary, fontSize: 13, fontFamily: fonts.semiBold, flex: 1, textAlign: 'right' },
  footerButtonRow: { flexDirection: 'row', gap: spacing.sm },
  deleteTextButton: { alignSelf: 'center', paddingVertical: spacing.xs },
  deleteText: { color: colors.danger, fontSize: 13, fontFamily: fonts.bold, letterSpacing: 0.2 },
  restTimerToggle: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong },
  restTimerToggleText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary },
});

