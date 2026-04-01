import { NavigationProp, RouteProp } from '@react-navigation/native';

// Auth Stack Navigation
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MFA: { email: string };
};

// Main Stack Navigation
export type MainStackParamList = {
  HomeTabs: undefined;
  TaskDetail: { taskId: string };
  CreateTask: { projectId?: string };
  ProjectDetail: { projectId: string };
  CreateProject: undefined;
  EditProject: { projectId: string };
  ProjectMembers: { projectId: string };
  Settings: undefined;
  Profile: undefined;
};

// Home Tabs Navigation
export type HomeTabsParamList = {
  Dashboard: undefined;
  Projects: undefined;
  Tasks: undefined;
  Profile: undefined;
};

// Root Navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
};

// Type helpers
export type AuthStackNavigationProp = NavigationProp<AuthStackParamList>;
export type AuthStackRouteProp<T extends keyof AuthStackParamList> = RouteProp<
  AuthStackParamList,
  T
>;

export type MainStackNavigationProp = NavigationProp<MainStackParamList>;
export type MainStackRouteProp<T extends keyof MainStackParamList> = RouteProp<
  MainStackParamList,
  T
>;

export type HomeTabsNavigationProp = NavigationProp<HomeTabsParamList>;
export type HomeTabsRouteProp<T extends keyof HomeTabsParamList> = RouteProp<
  HomeTabsParamList,
  T
>;
