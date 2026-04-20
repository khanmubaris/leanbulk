import { WorkoutType } from './types';

export const MAX_SETS_PER_EXERCISE = 4;

export interface ExerciseTemplate {
  name: string;
}

const upperTemplate: ExerciseTemplate[] = [
  { name: 'Incline Dumbbell Press' },
  { name: 'Machine Chest Press' },
  { name: 'Cable Fly' },
  { name: 'Dumbbell Lateral Raises' },
  { name: 'Seated Dumbbell Shoulder Press' },
  { name: 'Dumbbell Curls' },
  { name: 'Rope Pushdowns' },
];

const lowerTemplate: ExerciseTemplate[] = [
  { name: 'Squat' },
  { name: 'Deadlift' },
  { name: 'Leg press' },
  { name: 'Seated leg curl' },
  { name: 'Leg extension' },
  { name: 'Calf raises' },
];

export const ALL_EXERCISE_TEMPLATES: ExerciseTemplate[] = [...upperTemplate, ...lowerTemplate];

export const getTemplateByType = (type: WorkoutType): ExerciseTemplate[] => {
  return type === 'upper' ? upperTemplate : lowerTemplate;
};
