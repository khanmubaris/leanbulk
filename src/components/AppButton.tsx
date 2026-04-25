import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const AppButton = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  accessibilityLabel,
}: AppButtonProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, disabled ? styles.disabled : null]}
    >
      <Animated.View style={[styles.base, variantStyles[variant], { transform: [{ scale }] }]}>
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.35,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(0,232,159,0.20)',
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(255,69,69,0.20)',
  },
  ghost: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
};

const labelStyles: Record<ButtonVariant, { color: string }> = {
  primary: { color: '#060F0A' },
  secondary: { color: colors.primary },
  danger: { color: colors.danger },
  ghost: { color: colors.textPrimary },
};

