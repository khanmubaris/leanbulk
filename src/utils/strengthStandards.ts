import { colors } from '../theme/colors';

type Tier = 'Novice' | 'Intermediate' | 'Advanced' | 'Elite';

interface Standard {
  keywords: string[];
  thresholds: [number, number, number]; // [noviceMax, intermediateMax, advancedMax]
}

const TIER_COLORS: Record<Tier, string> = {
  Novice: colors.textMuted,
  Intermediate: colors.primary,
  Advanced: colors.gold,
  Elite: '#FF6BFF',
};

const STANDARDS: Standard[] = [
  { keywords: ['bench'], thresholds: [60, 100, 140] },
  { keywords: ['squat'], thresholds: [80, 130, 180] },
  { keywords: ['deadlift'], thresholds: [100, 160, 220] },
  { keywords: ['ohp', 'overhead press', 'shoulder press'], thresholds: [35, 60, 90] },
  { keywords: ['barbell row', 'cable row', 'dumbbell row', 'seated row', 't-bar row'], thresholds: [60, 100, 140] },
  { keywords: ['lat pulldown'], thresholds: [50, 80, 110] },
  { keywords: ['leg press'], thresholds: [120, 200, 280] },
  { keywords: ['hip thrust'], thresholds: [80, 140, 200] },
];

export const getStrengthTier = (
  exerciseName: string,
  weightKg: number
): { tier: Tier; color: string } | null => {
  const lower = exerciseName.toLowerCase();
  for (const standard of STANDARDS) {
    if (standard.keywords.some((kw) => lower.includes(kw))) {
      const [noviceMax, intermediateMax, advancedMax] = standard.thresholds;
      let tier: Tier;
      if (weightKg < noviceMax) tier = 'Novice';
      else if (weightKg < intermediateMax) tier = 'Intermediate';
      else if (weightKg < advancedMax) tier = 'Advanced';
      else tier = 'Elite';
      return { tier, color: TIER_COLORS[tier] };
    }
  }
  return null;
};
