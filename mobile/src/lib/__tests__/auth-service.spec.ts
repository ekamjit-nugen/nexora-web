import { AuthService } from '../auth-service';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('axios');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('initialization', () => {
    it('should initialize with stored tokens', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await authService.initialize();

      expect(result).toBe(true);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false if no stored tokens', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await authService.initialize();

      expect(result).toBe(false);
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle initialization errors', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await authService.initialize();

      expect(result).toBe(false);
    });
  });

  describe('authentication', () => {
    it('should check if user is authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('token management', () => {
    it('should get access token', async () => {
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await authService.initialize();
      const token = authService.getAccessToken();

      expect(token).toBe('access-token');
    });

    it('should get API client', () => {
      const client = authService.getApiClient();
      expect(client).toBeDefined();
      expect(client.defaults.baseURL).toContain('/api/v1');
    });
  });

  describe('logout', () => {
    it('should clear stored credentials on logout', async () => {
      await authService.logout();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
