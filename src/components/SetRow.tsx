import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { AppButton } from './AppButton';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface SetRowProps {
  index: number;
  weight: string;
  reps: string;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onRemove?: () => void;
  weightInputRef?: (input: TextInput | null) => void;
  repsInputRef?: (input: TextInput | null) => void;
  onSubmitWeight?: () => void;
  onSubmitReps?: () => void;
  repsReturnKeyType?: TextInputProps['returnKeyType'];
}

export const SetRow = ({
  index,
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
  onRemove,
  weightInputRef,
  repsInputRef,
  onSubmitWeight,
  onSubmitReps,
  repsReturnKeyType = 'next',
}: SetRowProps) => {
  return (
    <View style={styles.row}>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <TextInput
        ref={weightInputRef}
        style={styles.input}
        value={weight}
        onChangeText={onChangeWeight}
        keyboardType="decimal-pad"
        placeholder="kg"
        placeholderTextColor={colors.textMuted}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={onSubmitWeight}
      />
      <TextInput
        ref={repsInputRef}
        style={styles.input}
        value={reps}
        onChangeText={onChangeReps}
        keyboardType="number-pad"
        placeholder="reps"
        placeholderTextColor={colors.textMuted}
        returnKeyType={repsReturnKeyType}
        blurOnSubmit={repsReturnKeyType === 'done'}
        onSubmitEditing={onSubmitReps}
      />
      {onRemove ? (
        <AppButton
          label="Del"
          onPress={onRemove}
          variant="danger"
          style={styles.removeButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  setLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    minWidth: 56,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
});
