import { useCallback } from 'react';
import { useAuthStore } from '../lib/store';
import { getAuthService, LoginRequest, RegisterRequest } from '../lib/auth-service';
import { toast } from 'react-native-toast-notifications';

export const useAuth = () => {
  const authService = getAuthService();
  const { user, isLoading, isAuthenticated, error, setUser, setIsLoading, setError } =
    useAuthStore();

  const login = useCallback(
    async (credentials: LoginRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        const { user: userData, tokens } = await authService.login(credentials);
        setUser(userData);
        return { success: true, user: userData };
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Login failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authService, setUser, setIsLoading, setError],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        const { user: userData, tokens } = await authService.register(data);
        setUser(userData);
        return { success: true, user: userData };
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Registration failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authService, setUser, setIsLoading, setError],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await useAuthStore.getState().logout();
    } catch (err: any) {
      const errorMessage = err.message || 'Logout failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError]);

  const updateProfile = useCallback(
    async (data: { firstName?: string; lastName?: string; avatar?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedUser = await authService.updateProfile(data);
        setUser(updatedUser);
        return { success: true, user: updatedUser };
      } catch (err: any) {
        const errorMessage = err.message || 'Profile update failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authService, setUser, setIsLoading, setError],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await authService.changePassword(currentPassword, newPassword);
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || err.message || 'Password change failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authService, setIsLoading, setError],
  );

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };
};
