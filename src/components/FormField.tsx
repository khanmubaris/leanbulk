import React from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  helperText?: string;
  maxLength?: number;
}

export const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  helperText,
  maxLength,
}: FormFieldProps) => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline ? styles.multilineInput : null]}
      />
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  helper: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
});

