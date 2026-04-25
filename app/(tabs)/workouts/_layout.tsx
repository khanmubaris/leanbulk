import { Stack } from 'expo-router';
import { colors } from 'src/theme/colors';
import { fonts } from 'src/theme/fonts';

const stackOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Workout Log' }} />
      <Stack.Screen name="entry" options={{ title: 'Session' }} />
    </Stack>
  );
}

