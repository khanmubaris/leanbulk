import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';

export interface SegmentOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  value: string;
  options: SegmentOption[];
  onChange: (value: string) => void;
}

export const SegmentedControl = ({ value, options, onChange }: SegmentedControlProps) => {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed && !selected ? styles.segmentPressed : null,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={4}
          >
            <Text style={[styles.segmentLabel, selected ? styles.segmentLabelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primarySoft,
  },
  segmentPressed: {
    backgroundColor: colors.surfaceHighlight,
  },
  segmentLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textAlign: 'center',
  },
  segmentLabelSelected: {
    color: colors.primary,
  },
});

