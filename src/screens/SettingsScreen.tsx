import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getLastCloudSyncAt,
  getSettings,
  getWorkoutCsvRows,
  setUnitPreference,
} from '../db/database';
import { UnitPreference } from '../models/types';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { rowsToCsv } from '../utils/csv';
import { fileTimestamp } from '../utils/date';
import { shareFile, writeTextToCacheFile } from '../utils/files';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { useAuth } from '../backend/auth';

const formatSyncLabel = (iso: string | null): string => {
  if (!iso) {
    return 'No sync metadata yet';
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return parsed.toLocaleString();
};

export default function SettingsScreen() {
  const { refreshToken, refresh } = useAppRefresh();
  const { isBackendConfigured, session, loading: authLoading, signIn, signOut, signUp } = useAuth();

  const [unitPreference, setUnitPreferenceState] = useState<UnitPreference>('kg');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, lastSync] = await Promise.all([getSettings(), getLastCloudSyncAt()]);
      setUnitPreferenceState(settings.unitPreference);
      setLastCloudSyncAt(lastSync);
    } catch (error) {
      if (__DEV__) {
        console.warn('SettingsScreen load error:', error instanceof Error ? error.message : error);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshToken])
  );

  const withBusy = async (label: string, task: () => Promise<void>) => {
    setBusyAction(label);
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Action failed', message);
    } finally {
      setBusyAction(null);
    }
  };

  const exportWorkoutsCsv = async () => {
    await withBusy('Exporting workouts...', async () => {
      const rows = await getWorkoutCsvRows();
      const csvRows = rows.map((row) => ({
        date: row.date,
        workout_type: row.workoutType,
        exercise: row.exercise,
        set_number: row.setNumber,
        weight: row.weight,
        reps: row.reps,
        notes: row.notes,
      }));

      const csv = rowsToCsv(csvRows);
      const content = csv || 'date,workout_type,exercise,set_number,weight,reps,notes\n';
      const uri = await writeTextToCacheFile(`workouts-${fileTimestamp()}.csv`, content);
      await shareFile(uri, {
        dialogTitle: 'Export workouts CSV',
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    });
  };

  const handleUnitChange = async (nextUnit: UnitPreference) => {
    const previous = unitPreference;
    setUnitPreferenceState(nextUnit);

    try {
      await setUnitPreference(nextUnit);
      refresh();
    } catch (error) {
      setUnitPreferenceState(previous);
      const message = error instanceof Error ? error.message : 'Could not update unit preference.';
      Alert.alert('Update failed', message);
    }
  };

  const validateAuthForm = () => {
    const email = authEmail.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      throw new Error('Enter a valid email.');
    }

    if (authPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    return { email, password: authPassword };
  };

  const handleSignIn = async () => {
    await withBusy('Signing in...', async () => {
      const { email, password } = validateAuthForm();
      await signIn(email, password);
      setAuthPassword('');
      refresh();
      await load();
    });
  };

  const handleSignUp = async () => {
    await withBusy('Creating account...', async () => {
      const { email, password } = validateAuthForm();
      await signUp(email, password);
      setAuthPassword('');
      Alert.alert('Account created', 'If email confirmation is enabled, confirm your email before signing in.');
      refresh();
      await load();
    });
  };

  const handleSignOut = async () => {
    await withBusy('Signing out...', async () => {
      await signOut();
      refresh();
      await load();
    });
  };

  const handleRetryCloudCheck = async () => {
    await withBusy('Refreshing cloud status...', async () => {
      refresh();
      await load();
    });
  };

  const accountLabel = useMemo(() => {
    if (!session?.user?.email) {
      return '';
    }

    return session.user.email;
  }, [session?.user?.email]);

  const cloudStatusLabel = useMemo(() => {
    if (!isBackendConfigured) {
      return 'Backend not configured';
    }

    if (authLoading) {
      return 'Connecting to cloud...';
    }

    if (!session) {
      return 'Signed out';
    }

    return `Connected as ${session.user.email ?? session.user.id}`;
  }, [authLoading, isBackendConfigured, session]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
<Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        <Text style={styles.label}>Bodyweight unit</Text>
        <SegmentedControl
          value={unitPreference}
          options={[
            { label: 'kg', value: 'kg' },
            { label: 'lbs', value: 'lbs' },
          ]}
          onChange={(value) => handleUnitChange(value as UnitPreference)}
        />
      </Card>

      <Card style={styles.cardGap}>
        <Text style={styles.sectionTitle}>Account</Text>

        {!isBackendConfigured ? (
          <Text style={styles.helperText}>
            Backend is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to
            your Expo environment.
          </Text>
        ) : authLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.helperText}>Checking account session...</Text>
          </View>
        ) : session ? (
          <>
            <Text style={styles.metricText}>Signed in as {accountLabel}</Text>
            <Text style={styles.helperText}>All workout data is stored only in Supabase cloud tables.</Text>
            <AppButton label="Sign Out" onPress={handleSignOut} variant="ghost" />
          </>
        ) : (
          <>
            <Text style={styles.helperText}>Sign in to load and edit your cloud data.</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={authEmail}
              onChangeText={setAuthEmail}
            />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={authPassword}
              onChangeText={setAuthPassword}
            />
            <AppButton label="Sign In" onPress={handleSignIn} />
            <AppButton label="Create Account" onPress={handleSignUp} variant="secondary" />
          </>
        )}
      </Card>

{busyAction ? <Text style={styles.busyText}>{busyAction}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  cardGap: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.bold,
    letterSpacing: 0.1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  metricText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  busyText: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
});
