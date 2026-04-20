import { WorkoutType } from '../models/types';

export type WorkoutStackParamList = {
  WorkoutLog: undefined;
  WorkoutEntry: {
    sessionId?: string;
    presetType?: WorkoutType;
  };
};

export type RootTabParamList = {
  Home: undefined;
  Workouts: undefined;
  Insights: undefined;
  Settings: undefined;
};
