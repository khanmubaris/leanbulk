export const parseNumberInput = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseIntegerInput = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

export const formatMaybeNumber = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(digits);
};

export const kgToLbs = (kg: number): number => kg * 2.20462;

export const lbsToKg = (lbs: number): number => lbs / 2.20462;
