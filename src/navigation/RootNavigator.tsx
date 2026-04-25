import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import WorkoutLogScreen from '../screens/WorkoutLogScreen';
import WorkoutEntryScreen from '../screens/WorkoutEntryScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { RootTabParamList, WorkoutStackParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const WorkoutStack = createNativeStackNavigator<WorkoutStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    text: colors.textPrimary,
    card: colors.surface,
    border: colors.border,
  },
};

const sharedStackOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 18 },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

const WorkoutStackNavigator = () => (
  <WorkoutStack.Navigator screenOptions={sharedStackOptions}>
    <WorkoutStack.Screen name="WorkoutLog" component={WorkoutLogScreen} options={{ title: 'Workout Log' }} />
    <WorkoutStack.Screen name="WorkoutEntry" component={WorkoutEntryScreen} options={{ title: 'Session' }} />
  </WorkoutStack.Navigator>
);

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, size, focused }) => {
            const iconByRoute: Record<keyof RootTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
              Home: { active: 'home', inactive: 'home-outline' },
              Workouts: { active: 'barbell', inactive: 'barbell-outline' },
              Insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
              Settings: { active: 'settings', inactive: 'settings-outline' },
            };
            const icons = iconByRoute[route.name as keyof RootTabParamList];
            const iconName = focused ? icons.active : icons.inactive;
            return <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />;
          },
          tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.3, marginTop: -2 },
          tabBarStyle: { height: 76, paddingBottom: 14, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Workouts" component={WorkoutStackNavigator} />
        <Tab.Screen name="Insights" component={InsightsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

