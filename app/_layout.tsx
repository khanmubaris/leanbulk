import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_900Black,
} from '@expo-google-fonts/dm-sans';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { AuthProvider } from 'src/backend/auth';
import { AppRefreshProvider } from 'src/hooks/useAppRefresh';
import { colors } from 'src/theme/colors';
import { fonts } from 'src/theme/fonts';

const defaultTextStyle = Text.defaultProps?.style;
Text.defaultProps = Text.defaultProps ?? {};
Text.defaultProps.style = [defaultTextStyle, { fontFamily: fonts.regular }];

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    text: colors.textPrimary,
    card: colors.surface,
    border: colors.border,
    notification: colors.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_900Black,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  React.useEffect(() => {
    const removeLegacyLocalDb = async () => {
      const base = FileSystem.documentDirectory;
      if (!base) return;
      const sqliteDir = `${base}SQLite/`;
      const staleFiles = [
        `${sqliteDir}leanbulk_tracker.db`,
        `${sqliteDir}leanbulk_tracker.db-shm`,
        `${sqliteDir}leanbulk_tracker.db-wal`,
      ];
      for (const filePath of staleFiles) {
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch {}
      }
    };
    removeLegacyLocalDb();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <AuthProvider>
            <AppRefreshProvider>
              {Platform.OS === 'web' ? (
                <View style={styles.webContainer}>
                  <Stack screenOptions={{ headerShown: false }} />
                </View>
              ) : (
                <Stack screenOptions={{ headerShown: false }} />
              )}
              <StatusBar style="light" />
            </AppRefreshProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webContainer: {
    flex: 1,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
});
