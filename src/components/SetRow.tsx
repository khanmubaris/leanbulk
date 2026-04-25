import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { AppButton } from './AppButton';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
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
  completed?: boolean;
  onToggleComplete?: () => void;
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
  completed = false,
  onToggleComplete,
}: SetRowProps) => {
  return (
    <View style={styles.row}>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <TextInput
        ref={weightInputRef}
        style={[styles.input, completed && styles.inputDone]}
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
        style={[styles.input, completed && styles.inputDone]}
        value={reps}
        onChangeText={onChangeReps}
        keyboardType="number-pad"
        placeholder="reps"
        placeholderTextColor={colors.textMuted}
        returnKeyType={repsReturnKeyType}
        blurOnSubmit={repsReturnKeyType === 'done'}
        onSubmitEditing={onSubmitReps}
      />
      {onToggleComplete ? (
        <Pressable
          style={[styles.checkBtn, completed && styles.checkBtnDone]}
          onPress={onToggleComplete}
          hitSlop={4}
        >
          <Text style={[styles.checkText, completed && styles.checkTextDone]}>✓</Text>
        </Pressable>
      ) : onRemove ? (
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
    fontSize: 11,
    fontFamily: fonts.bold,
    width: 36,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
    fontFamily: fonts.monoBold,
    textAlign: 'center',
  },
  inputDone: {
    borderColor: colors.primary,
    opacity: 0.7,
  },
  removeButton: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  checkText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
  },
  checkTextDone: {
    color: colors.primary,
  },
});

