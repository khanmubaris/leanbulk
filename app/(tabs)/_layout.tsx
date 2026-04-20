import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from 'src/theme/colors';

type TabName = 'index' | 'workouts' | 'insights' | 'settings';

const tabIcons: Record<TabName, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
  workouts: { active: 'barbell', inactive: 'barbell-outline' },
  insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

const isWeb = Platform.OS === 'web';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPosition: isWeb ? 'top' : 'bottom',
        tabBarIcon: ({ color, size, focused }) => {
          const name = route.name as TabName;
          const icons = tabIcons[name] ?? tabIcons.index;
          return <Ionicons name={focused ? icons.active : icons.inactive} size={isWeb ? size - 2 : focused ? size + 1 : size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: isWeb ? 13 : 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: isWeb ? 0 : -2,
        },
        tabBarStyle: isWeb
          ? {
              height: 52,
              paddingBottom: 0,
              paddingTop: 0,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              borderTopWidth: 0,
              elevation: 0,
            }
          : {
              height: 76,
              paddingBottom: 14,
              paddingTop: 10,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
        tabBarIndicatorStyle: isWeb
          ? { backgroundColor: colors.primary, height: 2 }
          : undefined,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
