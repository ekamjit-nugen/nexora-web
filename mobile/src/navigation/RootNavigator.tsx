import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  DashboardScreen,
  ProjectsScreen,
  ProjectDetailScreen,
  CreateProjectScreen,
  EditProjectScreen,
  ProjectMembersScreen,
  TasksScreen,
  TaskDetailScreen,
  CreateTaskScreen,
  ProfileScreen,
  SettingsScreen,
} from '../screens';
import { AuthStackParamList, MainStackParamList, HomeTabsParamList } from '../types/navigation';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const HomeTabs = createBottomTabNavigator<HomeTabsParamList>();

/**
 * Auth Stack Navigator
 * Displays login, register, and forgot password screens
 */
const AuthStackNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        cardStyle: { backgroundColor: '#fff' },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
    </AuthStack.Navigator>
  );
};

/**
 * Home Tabs Navigator
 * Bottom tab navigation for main app screens
 */
const HomeTabsNavigator = () => {
  return (
    <HomeTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = '📱';

          if (route.name === 'Dashboard') {
            icon = '🏠';
          } else if (route.name === 'Projects') {
            icon = '📁';
          } else if (route.name === 'Tasks') {
            icon = '✓';
          } else if (route.name === 'Profile') {
            icon = '👤';
          }

          return (
            <View style={{ fontSize: size, color }}>
              <Text style={{ fontSize: 20 }}>{icon}</Text>
            </View>
          );
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f0f0f0',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <HomeTabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <HomeTabs.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          tabBarLabel: 'Projects',
        }}
      />
      <HomeTabs.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarLabel: 'Tasks',
        }}
      />
      <HomeTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </HomeTabs.Navigator>
  );
};

/**
 * Main Stack Navigator
 * Displays home tabs and detail/modal screens
 */
const MainStackNavigator = () => {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        cardStyle: { backgroundColor: '#f5f7fa' },
      }}
    >
      <MainStack.Screen
        name="HomeTabs"
        component={HomeTabsNavigator}
        options={{
          animationEnabled: false,
        }}
      />
      <MainStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
      <MainStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
      <MainStack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{
          animationTypeForReplace: 'slide_from_bottom',
        }}
      />
      <MainStack.Screen
        name="EditProject"
        component={EditProjectScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
      <MainStack.Screen
        name="ProjectMembers"
        component={ProjectMembersScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
      <MainStack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{
          animationTypeForReplace: 'slide_from_bottom',
        }}
      />
      <MainStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          animationTypeForReplace: 'slide_from_right',
        }}
      />
    </MainStack.Navigator>
  );
};

/**
 * Root Navigator
 * Conditionally displays auth or main stack based on authentication state
 */
export const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStackNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
};
