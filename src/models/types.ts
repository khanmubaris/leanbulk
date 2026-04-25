export type WorkoutType = 'upper' | 'lower';
export type UnitPreference = 'kg' | 'lbs';

export interface WorkoutSession {
  id: string;
  date: string;
  type: WorkoutType;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  sessionId: string;
  name: string;
  orderIndex: number;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  sets: WorkoutSet[];
}

export interface WorkoutSessionWithExercises extends WorkoutSession {
  exercises: WorkoutExerciseWithSets[];
}

export interface WorkoutLogItem extends WorkoutSession {
  exerciseCount: number;
  totalSets: number;
}

export interface EditableSetDraft {
  weight: string;
  reps: string;
  weightHint?: string;
  repsHint?: string;
}

export interface EditableExerciseDraft {
  id?: string;
  name: string;
  sets: EditableSetDraft[];
}

export interface WorkoutSaveInput {
  sessionId?: string;
  date: string;
  type: WorkoutType;
  notes: string;
  exercises: EditableExerciseDraft[];
}

export interface AppSettings {
  unitPreference: UnitPreference;
}

export interface HomeSummary {
  todayDate: string;
  todayWorkoutCount: number;
  lastWorkout: WorkoutSessionWithExercises | null;
}

export interface WeeklyExerciseInsight {
  exerciseName: string;
  setCount: number;
  totalReps: number;
  averageReps: number;
  totalLoadKg: number;
  averageWeightKg: number;
  lastPerformedDate: string;
}

export interface ExerciseProgressPoint {
  sessionId: string;
  date: string;
  workoutType: WorkoutType;
  setCount: number;
  totalReps: number;
  totalLoadKg: number;
  maxWeightKg: number;
  averageWeightKg: number;
}

export interface WeeklyInsights {
  periodStart: string;
  periodEnd: string;
  workoutCount: number;
  upperSessionCount: number;
  lowerSessionCount: number;
  totalSetCount: number;
  exerciseInsights: WeeklyExerciseInsight[];
}

export interface WorkoutCsvRow {
  date: string;
  workoutType: WorkoutType;
  exercise: string;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  notes: string;
}
