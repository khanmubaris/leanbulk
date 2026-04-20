import { DatabaseSnapshot } from '../db/database';

export const snapshotToJson = (snapshot: DatabaseSnapshot): string => {
  return JSON.stringify(snapshot, null, 2);
};

export const parseSnapshotJson = (raw: string): DatabaseSnapshot => {
  const parsed = JSON.parse(raw) as Partial<DatabaseSnapshot>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is invalid.');
  }

  const requiredArrays: Array<keyof DatabaseSnapshot> = [
    'app_settings',
    'workout_sessions',
    'workout_exercises',
    'workout_sets',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(parsed[key])) {
      throw new Error(`Backup is missing table: ${String(key)}`);
    }
  }

  return parsed as DatabaseSnapshot;
};
