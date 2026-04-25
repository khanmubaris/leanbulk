import React, { useEffect, useRef, useState } from 'react';
import { Animated, TextStyle, Text } from 'react-native';
import { fonts } from '../../theme/fonts';
import { colors } from '../../theme/colors';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  style?: TextStyle;
}

export const AnimatedCounter = ({
  value,
  duration = 800,
  decimals = 0,
  suffix = '',
  prefix = '',
  style,
}: AnimatedCounterProps) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    animValue.setValue(0);

    const listener = animValue.addListener(({ value: v }) => {
      const formatted = decimals > 0
        ? v.toFixed(decimals)
        : Math.round(v).toLocaleString();
      setDisplayValue(`${prefix}${formatted}${suffix}`);
    });

    Animated.timing(animValue, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [value]);

  return (
    <Text
      style={[
        {
          fontSize: 22,
          fontFamily: fonts.monoBold,
          color: colors.textPrimary,
          letterSpacing: -0.5,
        },
        style,
      ]}
    >
      {displayValue}
    </Text>
  );
};

