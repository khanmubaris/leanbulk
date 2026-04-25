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
  if (!iso) return 'No sync metadata yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
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
      if (__DEV__) console.warn('SettingsScreen load error:', error instanceof Error ? error.message : error);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load, refreshToken]));

  const withBusy = async (label: string, task: () => Promise<void>) => {
    setBusyAction(label);
    try { await task(); } catch (error) {
      Alert.alert('Action failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally { setBusyAction(null); }
  };

  const exportWorkoutsCsv = async () => {
    await withBusy('Exporting workouts...', async () => {
      const rows = await getWorkoutCsvRows();
      const csvRows = rows.map((row) => ({
        date: row.date, workout_type: row.workoutType, exercise: row.exercise,
        set_number: row.setNumber, weight: row.weight, reps: row.reps, notes: row.notes,
      }));
      const csv = rowsToCsv(csvRows);
      const content = csv || 'date,workout_type,exercise,set_number,weight,reps,notes\n';
      const uri = await writeTextToCacheFile(`workouts-${fileTimestamp()}.csv`, content);
      await shareFile(uri, { dialogTitle: 'Export workouts CSV', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    });
  };

  const handleUnitChange = async (nextUnit: UnitPreference) => {
    const previous = unitPreference;
    setUnitPreferenceState(nextUnit);
    try { await setUnitPreference(nextUnit); refresh(); }
    catch (error) { setUnitPreferenceState(previous); Alert.alert('Update failed', error instanceof Error ? error.message : 'Could not update.'); }
  };

  const validateAuthForm = () => {
    const email = authEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Enter a valid email.');
    if (authPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    return { email, password: authPassword };
  };

  const handleSignIn = async () => {
    await withBusy('Signing in...', async () => {
      const { email, password } = validateAuthForm();
      await signIn(email, password); setAuthPassword(''); refresh(); await load();
    });
  };

  const handleSignUp = async () => {
    await withBusy('Creating account...', async () => {
      const { email, password } = validateAuthForm();
      await signUp(email, password); setAuthPassword('');
      Alert.alert('Account created', 'If email confirmation is enabled, confirm your email before signing in.');
      refresh(); await load();
    });
  };

  const handleSignOut = async () => {
    await withBusy('Signing out...', async () => { await signOut(); refresh(); await load(); });
  };

  const accountLabel = useMemo(() => session?.user?.email ?? '', [session?.user?.email]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Preferences & account</Text>

      {/* Preferences */}
      <Text style={styles.sectionLabel}>Preferences</Text>
      <Card style={styles.cardGap}>
        <View style={styles.settingsRow}>
          <View style={styles.srLeft}>
            <View style={styles.srIcon}><Text style={styles.srIconText}>⚖</Text></View>
            <Text style={styles.srLabel}>Weight unit</Text>
          </View>
          <View style={{ width: 120 }}>
            <SegmentedControl
              value={unitPreference}
              options={[{ label: 'kg', value: 'kg' }, { label: 'lbs', value: 'lbs' }]}
              onChange={(value) => handleUnitChange(value as UnitPreference)}
            />
          </View>
        </View>
      </Card>

      {/* Account */}
      <Text style={styles.sectionLabel}>Account</Text>
      <Card style={styles.cardGap}>
        {!isBackendConfigured ? (
          <Text style={styles.helperText}>
            Backend is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your Expo environment.
          </Text>
        ) : authLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.helperText}>Checking account session...</Text>
          </View>
        ) : session ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{accountLabel.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountEmail}>{accountLabel}</Text>
                <Text style={styles.accountStatus}>Connected to Supabase cloud</Text>
              </View>
            </View>
            <View style={styles.syncRow}>
              <Text style={styles.syncDot}>●</Text>
              <Text style={styles.syncText}>Last synced: {formatSyncLabel(lastCloudSyncAt)}</Text>
            </View>
            <AppButton label="Sign Out" onPress={handleSignOut} variant="ghost" />
          </>
        ) : (
          <>
            <Text style={styles.helperText}>Sign in to load and edit your cloud data.</Text>
            <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              placeholder="Email" placeholderTextColor={colors.textMuted} value={authEmail} onChangeText={setAuthEmail} />
            <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} secureTextEntry
              placeholder="Password" placeholderTextColor={colors.textMuted} value={authPassword} onChangeText={setAuthPassword} />
            <AppButton label="Sign In" onPress={handleSignIn} />
            <AppButton label="Create Account" onPress={handleSignUp} variant="secondary" />
          </>
        )}
      </Card>

      {/* Data */}
      <Text style={styles.sectionLabel}>Data</Text>
      <Card style={styles.cardGap}>
        <AppButton label="Export Workouts CSV" onPress={exportWorkoutsCsv} variant="ghost" />
      </Card>

      {busyAction ? <Text style={styles.busyText}>{busyAction}</Text> : null}

      <Text style={styles.versionText}>LeanBulk v1.0.0 · Built with Expo + Supabase</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm, backgroundColor: colors.background },
  title: { fontSize: 28, fontFamily: fonts.black, color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, marginTop: -4 },
  sectionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.md, marginBottom: spacing.xs, paddingLeft: 2 },
  cardGap: { gap: spacing.sm },
  helperText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.regular, lineHeight: 18 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  srLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  srIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  srIconText: { fontSize: 15 },
  srLabel: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontFamily: fonts.black, color: colors.primary },
  accountInfo: { flex: 1, gap: 2 },
  accountEmail: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary },
  accountStatus: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  syncDot: { fontSize: 8, color: colors.primary },
  syncText: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.textPrimary, fontSize: 15, fontFamily: fonts.semiBold },
  busyText: { color: colors.primary, textAlign: 'center', fontSize: 13, fontFamily: fonts.bold },
  versionText: { textAlign: 'center', fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted, marginTop: spacing.md },
});

