import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        if (existingSessionId) {
          const session = await getWorkoutSessionById(existingSessionId);

          if (!active) {
            return;
          }

          if (!session) {
            Alert.alert('Not found', 'Workout session could not be loaded.');
            router.back();
            return;
          }

          setDate(session.date);
          setType(session.type);
          setNotes(session.notes ?? '');
          setExercises(
            session.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              sets:
                exercise.sets.length > 0
                  ? exercise.sets.map((set) => ({ weight: String(set.weight), reps: String(set.reps) }))
                  : [{ weight: '', reps: '' }],
            }))
          );
        } else {
          const template = await buildWorkoutTemplateDraft(presetType);

          if (!active) {
            return;
          }

          setDate(todayDateKey());
          setType(presetType);
          setNotes('');
          setExercises(template);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not load workout.';
        console.warn('[WorkoutEntry] load error:', message);
        // Graceful fallback: start with an empty new session rather than crashing
        if (!existingSessionId) {
          setDate(todayDateKey());
          setType(presetType);
          setNotes('');
          setExercises([{ name: '', sets: [{ weight: '', reps: '' }] }]);
        } else {
          Alert.alert('Load failed', message);
          router.back();
          return;
        }
      }

      if (active) {
        setActiveExerciseIndex(0);
        setExpandedExerciseIndex(0);
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
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

      const unchanged =
        prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key]);

      return unchanged ? prev : next;
    });
  }, [exercises]);

  useEffect(() => {
    if (!exercises.length) {
      setActiveExerciseIndex(0);
      setExpandedExerciseIndex(0);
      return;
    }

    if (activeExerciseIndex >= exercises.length) {
      setActiveExerciseIndex(exercises.length - 1);
    }

    if (expandedExerciseIndex >= exercises.length) {
      setExpandedExerciseIndex(exercises.length - 1);
    }
  }, [activeExerciseIndex, expandedExerciseIndex, exercises.length]);

  const totalSets = useMemo(
    () => exercises.reduce((count, exercise) => count + exercise.sets.length, 0),
    [exercises]
  );

  const templateExerciseNames = useMemo(() => {
    return getTemplateByType(type).map((item) => item.name);
  }, [type]);

  const existingNameSet = useMemo(() => {
    return new Set(exercises.map((exercise) => normalizeExerciseName(exercise.name)).filter(Boolean));
  }, [exercises]);

  const missingTemplateExercises = useMemo(() => {
    return templateExerciseNames.filter((name) => !existingNameSet.has(normalizeExerciseName(name)));
  }, [existingNameSet, templateExerciseNames]);

  const getInputKey = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps'): string => {
    return `${exerciseIndex}-${setIndex}-${field}`;
  };

  const setInputRef = (
    exerciseIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    input: TextInput | null
  ) => {
    setInputRefs.current[getInputKey(exerciseIndex, setIndex, field)] = input;
  };

  const focusSetInput = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps') => {
    setInputRefs.current[getInputKey(exerciseIndex, setIndex, field)]?.focus();
  };

  const goToExercise = (exerciseIndex: number) => {
    if (exerciseIndex < 0 || exerciseIndex >= exercises.length) {
      return;
    }

    setActiveExerciseIndex(exerciseIndex);
    setExpandedExerciseIndex(exerciseIndex);

    requestAnimationFrame(() => {
      const y = exerciseOffsetY.current[exerciseIndex] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    });
  };

  const replaceWithTemplate = async (nextType: WorkoutType) => {
    const apply = async () => {
      try {
        const template = await buildWorkoutTemplateDraft(nextType);
        setType(nextType);
        setExercises(template);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load template.';
        console.warn('[WorkoutEntry] replaceWithTemplate error:', message);
        // Fallback: switch type and give one blank exercise
        setType(nextType);
        setExercises([{ name: '', sets: [{ weight: '', reps: '' }] }]);
      }
      setActiveExerciseIndex(0);
      setExpandedExerciseIndex(0);
    };

    if (exercises.length === 0) {
      await apply();
      return;
    }

    Alert.alert('Load template', 'Replace current exercises with the default template and last-used values?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replace',
        style: 'destructive',
        onPress: () => {
          void apply();
        },
      },
    ]);
  };

  const setExerciseValue = (
    exerciseIndex: number,
    updater: (exercise: EditableExerciseDraft) => EditableExerciseDraft
  ) => {
    setExercises((prev) => prev.map((item, idx) => (idx === exerciseIndex ? updater(item) : item)));
  };

  const addSet = (exerciseIndex: number, focusAfterAdd = false) => {
    let nextSetIndex: number | null = null;

    setExerciseValue(exerciseIndex, (exercise) => {
      if (exercise.sets.length >= MAX_SETS_PER_EXERCISE) {
        return exercise;
      }

      nextSetIndex = exercise.sets.length;

      return {
        ...exercise,
        sets: [...exercise.sets, { weight: '', reps: '' }],
      };
    });

    if (focusAfterAdd) {
      setTimeout(() => {
        if (nextSetIndex !== null) {
          focusSetInput(exerciseIndex, nextSetIndex, 'weight');
        }
      }, 40);
    }
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExerciseValue(exerciseIndex, (exercise) => {
      const nextSets = exercise.sets.filter((_, index) => index !== setIndex);
      return {
        ...exercise,
        sets: nextSets.length ? nextSets : [{ weight: '', reps: '' }],
      };
    });
  };

  const handleSubmitWeight = (exerciseIndex: number, setIndex: number) => {
    focusSetInput(exerciseIndex, setIndex, 'reps');
  };

  const handleSubmitReps = (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return;
    }

    const nextSetIndex = setIndex + 1;
    if (nextSetIndex < exercise.sets.length) {
      focusSetInput(exerciseIndex, nextSetIndex, 'weight');
      return;
    }

    if (exercise.sets.length < MAX_SETS_PER_EXERCISE) {
      addSet(exerciseIndex, true);
      return;
    }

    if (exerciseIndex < exercises.length - 1) {
      goToExercise(exerciseIndex + 1);
    }
  };

  const applyLastValues = async (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise?.name.trim()) {
      Alert.alert('Name required', 'Enter the exercise name first.');
      return;
    }

    const exerciseName = exercise.name.trim();

    let lastSets: Array<{ weight: number; reps: number }> = [];
    try {
      lastSets = await getLatestSetsForExerciseName(exerciseName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load history.';
      console.warn('[WorkoutEntry] applyLastValues error:', message);
      Alert.alert('Load failed', message);
      return;
    }

    if (!lastSets.length) {
      Alert.alert('No history', `No previous sets found for ${exercise.name}.`);
      return;
    }

    setExerciseValue(exerciseIndex, (item) => ({
      ...item,
      sets: lastSets.slice(0, MAX_SETS_PER_EXERCISE).map((set) => ({
        weight: String(set.weight),
        reps: String(set.reps),
      })),
    }));
  };

  const exerciseNameExists = (name: string, exceptIndex?: number): boolean => {
    const normalizedName = normalizeExerciseName(name);

    if (!normalizedName) {
      return false;
    }

    return exercises.some((exercise, index) => {
      if (exceptIndex !== undefined && index === exceptIndex) {
        return false;
      }

      return normalizeExerciseName(exercise.name) === normalizedName;
    });
  };

  const buildExerciseDraftFromName = async (name: string): Promise<EditableExerciseDraft> => {
    let lastSets: Array<{ weight: number; reps: number }> = [];
    try {
      lastSets = await getLatestSetsForExerciseName(name);
    } catch (error) {
      console.warn('[WorkoutEntry] buildExerciseDraftFromName error:', error instanceof Error ? error.message : error);
      // Graceful fallback: blank set
    }

    return {
      name,
      sets:
        lastSets.length > 0
          ? lastSets.map((set) => ({ weight: String(set.weight), reps: String(set.reps) }))
          : [{ weight: '', reps: '' }],
    };
  };

  const addExerciseByName = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) {
      return false;
    }

    if (exerciseNameExists(trimmed)) {
      Alert.alert('Duplicate exercise', `${trimmed} is already in this session.`);
      return false;
    }

    const nextExercise = await buildExerciseDraftFromName(trimmed);
    let nextExerciseIndex = 0;

    setExercises((prev) => {
      nextExerciseIndex = prev.length;
      return [...prev, nextExercise];
    });

    setTimeout(() => {
      goToExercise(nextExerciseIndex);
    }, 80);

    return true;
  };

  const addCustomExercise = async () => {
    const trimmed = newExerciseName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a custom exercise name to add.');
      return;
    }

    const added = await addExerciseByName(trimmed);
    if (added) {
      setNewExerciseName('');
    }
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
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return;
    }

    setCompletedSets((prev) => {
      const next = { ...prev };

      exercise.sets.forEach((set, setIndex) => {
        if (set.weight.trim() && set.reps.trim()) {
          next[setKey(exerciseIndex, setIndex)] = true;
        }
      });

      return next;
    });

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (exerciseIndex < exercises.length - 1) {
      goToExercise(exerciseIndex + 1);
    }
  };

  const completedCountForExercise = (exerciseIndex: number): number => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      return 0;
    }

    return exercise.sets.reduce((count, set, setIndex) => {
      const key = setKey(exerciseIndex, setIndex);
      const autoCompleted = Boolean(set.weight.trim() && set.reps.trim());
      return count + (completedSets[key] ?? autoCompleted ? 1 : 0);
    }, 0);
  };

  const validateForm = (): string | null => {
    if (!isValidDateKey(date)) {
      return 'Date must be valid and use YYYY-MM-DD.';
    }

    const namedExercises = exercises.filter((exercise) => exercise.name.trim().length > 0);

    if (!namedExercises.length) {
      return 'Add at least one exercise.';
    }

    const seenNames = new Set<string>();

    for (const exercise of namedExercises) {
      const normalizedName = normalizeExerciseName(exercise.name);
      if (seenNames.has(normalizedName)) {
        return `Exercise "${exercise.name}" appears more than once. Use unique names for accurate insights.`;
      }

      seenNames.add(normalizedName);

      for (let idx = 0; idx < exercise.sets.length; idx += 1) {
        const set = exercise.sets[idx];
        const hasWeight = Boolean(set.weight.trim());
        const hasReps = Boolean(set.reps.trim());

        if (hasWeight !== hasReps) {
          return `Exercise "${exercise.name}", set ${idx + 1}: fill both weight and reps or leave both blank.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Check your entry', validationError);
      return;
    }

    setSaving(true);

    try {
      await saveWorkoutSession({
        sessionId: existingSessionId,
        date,
        type,
        notes,
        exercises,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save workout session.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existingSessionId) {
      return;
    }

    Alert.alert('Delete workout', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutSession(existingSessionId);
            refresh();
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not delete workout session.';
            Alert.alert('Delete failed', message);
          }
        },
      },
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
              <FormField
                label="Date"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                maxLength={10}
              />

              <Text style={styles.label}>Workout type</Text>
              <SegmentedControl
                value={type}
                options={[
                  { label: 'Upper', value: 'upper' },
                  { label: 'Lower', value: 'lower' },
                ]}
                onChange={(value) => {
                  const nextType = value as WorkoutType;
                  if (nextType !== type) {
                    void replaceWithTemplate(nextType);
                  }
                }}
              />

              <View style={styles.buttonRow}>
                <AppButton
                  label="Load Upper"
                  variant="ghost"
                  style={styles.flexButton}
                  onPress={() => replaceWithTemplate('upper')}
                />
                <AppButton
                  label="Load Lower"
                  variant="ghost"
                  style={styles.flexButton}
                  onPress={() => replaceWithTemplate('lower')}
                />
              </View>

              <FormField
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional session notes"
                multiline
              />
              <Text style={styles.helperText}>{exercises.length} exercises · {totalSets} set slots</Text>
            </>
          ) : null}
        </Card>

        <Card style={styles.cardGap}>
          <Text style={styles.sectionTitle}>Set matrix</Text>

          <Text style={styles.subSectionLabel}>Template quick add ({type.toUpperCase()})</Text>
          {missingTemplateExercises.length ? (
            <View style={styles.templateChipsWrap}>
              {missingTemplateExercises.map((exerciseName) => (
                <Pressable
                  key={exerciseName}
                  style={styles.templateChip}
                  onPress={() => {
                    void addExerciseByName(exerciseName);
                  }}
                >
                  <Text style={styles.templateChipLabel}>+ {exerciseName}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>All standard {type.toUpperCase()} exercises are already in this session.</Text>
          )}
          <Text style={styles.helperText}>Use template names when possible to keep insights consistent.</Text>

          {exercises.map((exercise, exerciseIndex) => {
            const isExpanded = exerciseIndex === expandedExerciseIndex;
            const isActive = exerciseIndex === activeExerciseIndex;
            const doneCount = completedCountForExercise(exerciseIndex);

            return (
              <View
                key={`${exercise.name}-${exerciseIndex}`}
                onLayout={(event) => {
                  exerciseOffsetY.current[exerciseIndex] = event.nativeEvent.layout.y;
                }}
              >
                <Card style={[styles.exerciseCard, isActive ? styles.exerciseCardActive : null]}>
                  <Pressable onPress={() => goToExercise(exerciseIndex)} style={styles.exerciseHeader}>
                    <View style={styles.exerciseHeaderTextWrap}>
                      <Text style={styles.exerciseTitle} numberOfLines={1}>
                        {exercise.name || `Exercise ${exerciseIndex + 1}`}
                      </Text>
                      <Text style={styles.exerciseSubtext}>
                        {doneCount}/{exercise.sets.length} sets done
                      </Text>
                    </View>
                    <View style={[styles.completionChip, doneCount === exercise.sets.length && exercise.sets.length > 0 ? styles.completionChipDone : null]}>
                      <Text style={[styles.completionChipText, doneCount === exercise.sets.length && exercise.sets.length > 0 ? styles.completionChipTextDone : null]}>
                        {doneCount === exercise.sets.length && exercise.sets.length > 0 ? '✓' : `${doneCount}/${exercise.sets.length}`}
                      </Text>
                    </View>
                  </Pressable>

                  {isExpanded ? (
                    <>
                      <FormField
                        label={`Exercise ${exerciseIndex + 1}`}
                        value={exercise.name}
                        onChangeText={(value) =>
                          setExerciseValue(exerciseIndex, (item) => {
                            return {
                              ...item,
                              name: value,
                            };
                          })
                        }
                        placeholder="Exercise name"
                        helperText="Avoid duplicates. Use canonical names for cleaner progress tracking."
                      />

                      <View style={styles.matrixHeaderRow}>
                        <Text style={[styles.matrixHeaderText, styles.colSet]}>Set</Text>
                        <Text style={[styles.matrixHeaderText, styles.colInput]}>kg</Text>
                        <Text style={[styles.matrixHeaderText, styles.colInput]}>Reps</Text>
                      </View>

                      <View style={styles.matrixRowsWrap}>
                        {exercise.sets.map((set, setIndex) => {
                          const setCompleted =
                            completedSets[setKey(exerciseIndex, setIndex)] ?? Boolean(set.weight.trim() && set.reps.trim());
                          const isLastSet = setIndex === exercise.sets.length - 1;
                          const canAddMoreSets = exercise.sets.length < MAX_SETS_PER_EXERCISE;

                          return (
                            <View key={`${exerciseIndex}-${setIndex}`} style={[styles.matrixRow, setCompleted ? styles.matrixRowDone : null]}>
                              <Pressable
                                style={[styles.setBadge, exercise.sets.length > 1 ? styles.setBadgeDeletable : null]}
                                onPress={() => exercise.sets.length > 1 ? removeSet(exerciseIndex, setIndex) : undefined}
                              >
                                <Text style={[styles.setBadgeText, exercise.sets.length > 1 ? styles.setBadgeDeleteText : null]}>
                                  {exercise.sets.length > 1 ? '×' : String(setIndex + 1)}
                                </Text>
                              </Pressable>

                              <TextInput
                                ref={(input) => setInputRef(exerciseIndex, setIndex, 'weight', input)}
                                style={[styles.matrixInput, styles.colInput, setCompleted ? styles.matrixInputDone : null]}
                                value={set.weight}
                                onChangeText={(value) =>
                                  setExerciseValue(exerciseIndex, (item) => ({
                                    ...item,
                                    sets: item.sets.map((setRow, innerIndex) =>
                                      innerIndex === setIndex ? { ...setRow, weight: value } : setRow
                                    ),
                                  }))
                                }
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => handleSubmitWeight(exerciseIndex, setIndex)}
                              />

                              <TextInput
                                ref={(input) => setInputRef(exerciseIndex, setIndex, 'reps', input)}
                                style={[styles.matrixInput, styles.colInput, setCompleted ? styles.matrixInputDone : null]}
                                value={set.reps}
                                onChangeText={(value) =>
                                  setExerciseValue(exerciseIndex, (item) => ({
                                    ...item,
                                    sets: item.sets.map((setRow, innerIndex) =>
                                      innerIndex === setIndex ? { ...setRow, reps: value } : setRow
                                    ),
                                  }))
                                }
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                returnKeyType={isLastSet && !canAddMoreSets ? 'done' : 'next'}
                                blurOnSubmit={isLastSet && !canAddMoreSets}
                                onSubmitEditing={() => handleSubmitReps(exerciseIndex, setIndex)}
                              />
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.exerciseActionsRow}>
                        <AppButton
                          label="+ Set"
                          variant="secondary"
                          style={styles.flexButton}
                          onPress={() => addSet(exerciseIndex, true)}
                          disabled={exercise.sets.length >= MAX_SETS_PER_EXERCISE}
                        />
                        <AppButton
                          label="Copy Last"
                          variant="ghost"
                          style={styles.flexButton}
                          onPress={() => applyLastValues(exerciseIndex)}
                        />
                        <AppButton
                          label="Finish"
                          variant="primary"
                          style={styles.flexButton}
                          onPress={() => markExerciseFinished(exerciseIndex)}
                        />
                      </View>

                      <AppButton
                        label="Remove Exercise"
                        variant="danger"
                        onPress={() => removeExercise(exerciseIndex)}
                        style={styles.removeExerciseButton}
                      />
                    </>
                  ) : null}
                </Card>
              </View>
            );
          })}

          <Text style={styles.subSectionLabel}>Add custom exercise (optional)</Text>
          <View style={styles.addExerciseRow}>
            <TextInput
              style={styles.exerciseInput}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder="Custom exercise name"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={() => {
                void addCustomExercise();
              }}
            />
            <AppButton label="Add" onPress={() => void addCustomExercise()} variant="primary" style={styles.addExerciseButton} />
          </View>
        </Card>
      </ScrollView>

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
          <AppButton
            label="Next Exercise"
            variant="secondary"
            style={styles.flexButton}
            onPress={() => goToExercise(Math.min(activeExerciseIndex + 1, exercises.length - 1))}
            disabled={isLastExercise || exercises.length === 0}
          />
          <AppButton
            label={saving ? 'Saving...' : 'Save Session'}
            onPress={handleSave}
            disabled={saving}
            style={styles.flexButton}
          />
        </View>
        {isEditing ? (
          <Pressable onPress={handleDelete} style={styles.deleteTextButton}>
            <Text style={styles.deleteText}>Delete Session</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 160,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  cardGap: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: fonts.black,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  templateChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  templateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  templateChipLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseCard: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  exerciseCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseHeaderTextWrap: {
    flex: 1,
    gap: 3,
  },
  exerciseTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  exerciseSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseHeaderAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  matrixHeaderText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  matrixRowsWrap: {
    gap: spacing.xs,
  },
  colSet: {
    width: 38,
  },
  colInput: {
    flex: 1,
  },
  setBadge: {
    width: 38,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeDeletable: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  setBadgeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  setBadgeDeleteText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  matrixRowDone: {
    opacity: 0.6,
  },
  matrixInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  matrixInputDone: {
    borderColor: colors.primary,
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  removeExerciseButton: {
    marginTop: spacing.xs,
  },
  addExerciseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  exerciseInput: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
    fontWeight: '600',
  },
  addExerciseButton: {
    minWidth: 92,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionCardHeaderLeft: {
    flex: 1,
    gap: 3,
  },
  sessionCardSummary: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
    paddingLeft: spacing.sm,
  },
  completionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  completionChipDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  completionChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  completionChipTextDone: {
    color: colors.primary,
  },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  footerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerProgressText: {
    fontSize: 13,
  },
  footerProgressCurrent: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  footerProgressTotal: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  footerExerciseName: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  footerButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deleteTextButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
