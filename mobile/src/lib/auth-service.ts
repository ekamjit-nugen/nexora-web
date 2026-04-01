import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3005';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  mfaEnabled: boolean;
  isPlatformAdmin?: boolean;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export class AuthService {
  private apiClient: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_BASE}/api/v1`,
      timeout: 10000,
    });

    this.apiClient.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try refresh
          try {
            await this.refreshTokens();
            // Retry original request
            return this.apiClient.request(error.config);
          } catch (refreshError) {
            await this.logout();
            throw refreshError;
          }
        }
        throw error;
      },
    );
  }

  /**
   * Initialize auth service - restore tokens from storage
   */
  async initialize(): Promise<boolean> {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (accessToken && refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      return false;
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await this.apiClient.post<{
        data: { user: User; tokens: AuthTokens };
      }>('/auth/login', credentials);

      const { user, tokens } = response.data.data;

      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync('accessToken', tokens.accessToken),
        SecureStore.setItemAsync('refreshToken', tokens.refreshToken),
      ]);

      // Store user in async storage
      await AsyncStorage.setItem('user', JSON.stringify(user));

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;

      return { user, tokens };
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Register new account
   */
  async register(data: RegisterRequest): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const response = await this.apiClient.post<{
        data: { user: User; tokens: AuthTokens };
      }>('/auth/register', data);

      const { user, tokens } = response.data.data;

      // Store tokens and user
      await Promise.all([
        SecureStore.setItemAsync('accessToken', tokens.accessToken),
        SecureStore.setItemAsync('refreshToken', tokens.refreshToken),
        AsyncStorage.setItem('user', JSON.stringify(user)),
      ]);

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;

      return { user, tokens };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshTokens(): Promise<AuthTokens> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<{
        data: AuthTokens;
      }>(`${API_BASE}/api/v1/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      const tokens = response.data.data;

      // Store new tokens
      await Promise.all([
        SecureStore.setItemAsync('accessToken', tokens.accessToken),
        SecureStore.setItemAsync('refreshToken', tokens.refreshToken),
      ]);

      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;

      return tokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    try {
      const response = await this.apiClient.get<{ data: User }>('/auth/me');
      const user = response.data.data;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    try {
      await this.apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Update profile
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    phoneNumber?: string;
  }): Promise<User> {
    try {
      const response = await this.apiClient.put<{ data: User }>('/auth/me', data);
      const user = response.data.data;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint
      try {
        await this.apiClient.post('/auth/logout', {});
      } catch (error) {
        // Ignore errors from logout endpoint
        console.error('Logout request failed:', error);
      }

      // Clear local storage
      await Promise.all([
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('refreshToken'),
        AsyncStorage.removeItem('user'),
        AsyncStorage.removeItem('organizationId'),
      ]);

      this.accessToken = null;
      this.refreshToken = null;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get stored user (sync)
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Failed to get stored user:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.refreshToken;
  }

  /**
   * Get API client for making requests
   */
  getApiClient(): AxiosInstance {
    return this.apiClient;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Singleton instance
let authService: AuthService | null = null;

export const getAuthService = (): AuthService => {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
};
