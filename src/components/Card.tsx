import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export const Card = ({ style, ...props }: ViewProps) => {
  return <View {...props} style={[styles.card, style]} />;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      web: {
        // @ts-ignore
        boxShadow: '0px 8px 32px rgba(0,0,0,0.5)',
      },
    }),
  },
});

