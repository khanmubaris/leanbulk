import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>—</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '300',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});

