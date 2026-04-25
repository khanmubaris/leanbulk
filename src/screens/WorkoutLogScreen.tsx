import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { deleteWorkoutSession, listWorkoutSessions } from '../db/database';
import { WorkoutLogItem, WorkoutType } from '../models/types';
import { useAppRefresh } from '../hooks/useAppRefresh';
import { useAuth } from '../backend/auth';
import { formatDateForDisplay } from '../utils/date';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/spacing';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type FilterType = 'all' | WorkoutType;

export default function WorkoutLogScreen() {
  const router = useRouter();
  const { refreshToken, refresh } = useAppRefresh();
  const { session } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [items, setItems] = useState<WorkoutLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listWorkoutSessions(filter);
      setItems(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load workouts.';
      console.warn('[WorkoutLogScreen] listWorkoutSessions failed:', message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, refreshToken, session])
  );

  const handleDelete = (sessionId: string) => {
    Alert.alert('Delete session', 'This will remove the workout and all sets. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutSession(sessionId);
            refresh();
            await load();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete session.';
            console.warn('[WorkoutLogScreen] deleteWorkoutSession failed:', message);
            Alert.alert('Delete failed', message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Card style={styles.controlsCard}>
        <SegmentedControl
          value={filter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Upper', value: 'upper' },
            { label: 'Lower', value: 'lower' },
          ]}
          onChange={(value) => setFilter(value as FilterType)}
        />
        <AppButton
          label="New Session"
          onPress={() => router.push('/workouts/entry')}
          variant="primary"
        />
      </Card>

      {loading ? (
        <ActivityIndicator style={styles.loadingIndicator} color={colors.primary} />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No workouts"
              description="Create your first Upper/Lower session to start long-term tracking."
            />
          )
        }
        renderItem={({ item }) => {
          const isUpper = item.type === 'upper';
          return (
            <Card style={styles.itemCard}>
              <Pressable
                style={styles.itemPressable}
                onPress={() => router.push(`/workouts/entry?sessionId=${item.id}`)}
              >
                <View style={styles.itemRow}>
                  <View style={[styles.typeIcon, isUpper ? styles.typeIconUpper : styles.typeIconLower]}>
                    <Text style={[styles.typeIconText, isUpper ? styles.typeIconTextUpper : styles.typeIconTextLower]}>
                      {item.type[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.type.toUpperCase()} Session</Text>
                    <Text style={styles.itemMeta}>{item.exerciseCount} exercises · {item.totalSets} sets</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemDate}>{formatDateForDisplay(item.date)}</Text>
                  </View>
                </View>
                {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
              </Pressable>
              <AppButton
                label="Delete"
                variant="danger"
                onPress={() => handleDelete(item.id)}
                style={styles.deleteButton}
              />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  controlsCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listContainer: {
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  itemCard: {
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  itemPressable: {
    paddingBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconUpper: {
    backgroundColor: colors.primarySoft,
  },
  typeIconLower: {
    backgroundColor: colors.accentSoft,
  },
  typeIconText: {
    fontSize: 16,
    fontFamily: fonts.black,
  },
  typeIconTextUpper: {
    color: colors.primary,
  },
  typeIconTextLower: {
    color: colors.accent,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemDate: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },
  itemNotes: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    lineHeight: 20,
    paddingLeft: 52,
  },
  deleteButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  loadingIndicator: {
    marginTop: spacing.lg,
  },
});

