import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { authApi, orgApi } from "./api";

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isPlatformAdmin?: boolean;
  avatar?: string;
  phone?: string;
}

interface Organization {
  _id: string;
  name: string;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  currentOrg: Organization | null;
  organizations: Organization[];
  isPlatformAdmin: boolean;
  login: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  selectOrg: (org: Organization) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await authApi.me();
      const userData = res.data || null;
      setUser(userData);

      if (userData) {
        try {
          const orgRes = await orgApi.getMyOrgs();
          const orgs = orgRes.data || [];
          setOrganizations(orgs);

          if (orgs.length === 1) {
            setCurrentOrg(orgs[0]);
            await SecureStore.setItemAsync("currentOrgId", orgs[0]._id);
          } else {
            const savedOrgId = await SecureStore.getItemAsync("currentOrgId");
            const saved = savedOrgId
              ? orgs.find((o: Organization) => o._id === savedOrgId)
              : null;
            if (saved) setCurrentOrg(saved);
          }
        } catch (err) {
          console.warn("[Auth] Failed to fetch organizations:", err);
        }
      }
    } catch (err) {
      console.warn("[Auth] Failed to fetch user, clearing tokens:", err);
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => {
    await SecureStore.setItemAsync("accessToken", tokens.accessToken);
    await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
    await fetchUser();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("[Auth] Logout API error (proceeding with local cleanup):", err);
    }
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("currentOrgId");
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
  };

  const selectOrg = async (org: Organization) => {
    setCurrentOrg(org);
    await SecureStore.setItemAsync("currentOrgId", org._id);
    try {
      await orgApi.switchOrg(org._id);
    } catch (err) {
      console.warn("[Auth] Failed to switch organization:", err);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const isPlatformAdmin = user?.isPlatformAdmin === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentOrg,
        organizations,
        isPlatformAdmin,
        login,
        logout,
        selectOrg,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
