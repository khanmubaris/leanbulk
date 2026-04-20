import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { AppRefreshProvider } from './src/hooks/useAppRefresh';
import { AuthProvider } from './src/backend/auth';
import { colors } from './src/theme/colors';

export default function App() {
  React.useEffect(() => {
    const removeLegacyLocalDb = async () => {
      const base = FileSystem.documentDirectory;
      if (!base) {
        return;
      }

      const sqliteDir = `${base}SQLite/`;
      const staleFiles = [
        `${sqliteDir}leanbulk_tracker.db`,
        `${sqliteDir}leanbulk_tracker.db-shm`,
        `${sqliteDir}leanbulk_tracker.db-wal`,
      ];

      for (const filePath of staleFiles) {
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch {
          // Ignore cleanup errors; app is cloud-only regardless.
        }
      }
    };

    removeLegacyLocalDb();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppRefreshProvider>
            <RootNavigator />
            <StatusBar style="light" />
          </AppRefreshProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
