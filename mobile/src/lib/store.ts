import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthService, User } from './auth-service';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

export interface AppState {
  organizationId: string | null;
  theme: 'light' | 'dark';
  language: string;
  setOrganizationId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: string) => void;
  loadSettings: () => Promise<void>;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingChanges: number;
  startSync: () => void;
  endSync: () => void;
  setPendingChanges: (count: number) => void;
  setLastSyncTime: (time: number) => void;
}

/**
 * Auth Store - Manages authentication state
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  setIsLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const authService = getAuthService();
      const hasTokens = await authService.initialize();

      if (hasTokens) {
        try {
          const user = await authService.getProfile();
          set({ user, isAuthenticated: true, error: null });
        } catch (error) {
          console.error('Failed to fetch profile:', error);
          await authService.logout();
          set({ user: null, isAuthenticated: false });
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      set({ error: 'Failed to initialize authentication' });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      const authService = getAuthService();
      await authService.logout();
      set({ user: null, isAuthenticated: false, error: null });
    } catch (error) {
      console.error('Logout failed:', error);
      set({ error: 'Failed to logout' });
    }
  },
}));

/**
 * App Store - Manages application-wide state
 */
export const useAppStore = create<AppState>((set) => ({
  organizationId: null,
  theme: 'light',
  language: 'en',

  setOrganizationId: async (id) => {
    set({ organizationId: id });
    if (id) {
      await AsyncStorage.setItem('organizationId', id);
    } else {
      await AsyncStorage.removeItem('organizationId');
    }
  },

  setTheme: async (theme) => {
    set({ theme });
    await AsyncStorage.setItem('theme', theme);
  },

  setLanguage: async (language) => {
    set({ language });
    await AsyncStorage.setItem('language', language);
  },

  loadSettings: async () => {
    try {
      const [organizationId, theme, language] = await Promise.all([
        AsyncStorage.getItem('organizationId'),
        AsyncStorage.getItem('theme'),
        AsyncStorage.getItem('language'),
      ]);

      set({
        organizationId: organizationId || null,
        theme: (theme as 'light' | 'dark') || 'light',
        language: language || 'en',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },
}));

/**
 * Sync Store - Manages offline sync state
 */
export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncTime: null,
  pendingChanges: 0,

  startSync: () => set({ isSyncing: true }),

  endSync: () => {
    set((state) => ({
      isSyncing: false,
      lastSyncTime: Date.now(),
    }));
  },

  setPendingChanges: (count) => set({ pendingChanges: count }),

  setLastSyncTime: (time) => set({ lastSyncTime: time }),
}));
