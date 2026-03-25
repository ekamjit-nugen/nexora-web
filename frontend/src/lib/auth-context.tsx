"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { authApi, orgApi, User, Organization } from "./api";
import { useRouter } from "next/navigation";
import { resetTheme } from "./theme";

interface AuthState {
  user: User | null;
  loading: boolean;
  currentOrg: Organization | null;
  organizations: Organization[];
  needsOrgSelection: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<{ needsOrgSelection: boolean }>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
  setCurrentOrg: (org: Organization | null) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);
  const router = useRouter();

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await orgApi.getMyOrgs();
      const orgs = res.data || [];
      setOrganizations(orgs);

      if (orgs.length === 1) {
        setCurrentOrg(orgs[0]);
        setNeedsOrgSelection(false);
      } else if (orgs.length > 1) {
        // Check if we had a previously selected org in localStorage
        const savedOrgId = localStorage.getItem("currentOrgId");
        const savedOrg = savedOrgId ? orgs.find((o) => o._id === savedOrgId) : null;
        if (savedOrg) {
          setCurrentOrg(savedOrg);
          setNeedsOrgSelection(false);
        } else {
          setNeedsOrgSelection(true);
        }
      } else {
        setCurrentOrg(null);
        setNeedsOrgSelection(false);
      }
      return orgs;
    } catch {
      setOrganizations([]);
      setCurrentOrg(null);
      return [];
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await authApi.me();
      setUser(res.data || null);
      if (res.data) {
        await fetchOrgs();
      }
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentOrgId");
    } finally {
      setLoading(false);
    }
  }, [fetchOrgs]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (res.data) {
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);

      // Fetch user
      const userRes = await authApi.me();
      setUser(userRes.data || null);

      // Fetch orgs
      const orgs = await fetchOrgs();

      if (orgs.length > 1 && !localStorage.getItem("currentOrgId")) {
        setNeedsOrgSelection(true);
        return { needsOrgSelection: true };
      }

      return { needsOrgSelection: false };
    }
    return { needsOrgSelection: false };
  };

  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    await authApi.register(data);
    // Auto-login after register
    const res = await authApi.login({ email: data.email, password: data.password });
    if (res.data) {
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      const userRes = await authApi.me();
      setUser(userRes.data || null);
      await fetchOrgs();
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentOrgId");
    localStorage.removeItem("nexora-theme");
    localStorage.removeItem("nexora-preferences");
    resetTheme();
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
    setNeedsOrgSelection(false);
    router.push("/login");
  };

  const switchOrg = async (orgId: string) => {
    try {
      const res = await orgApi.switchOrg(orgId);
      if (res.data) {
        localStorage.setItem("accessToken", res.data.accessToken);
        localStorage.setItem("refreshToken", res.data.refreshToken);
        localStorage.setItem("currentOrgId", orgId);
      }
    } catch {
      // If switch-org endpoint fails, just set the org locally
      localStorage.setItem("currentOrgId", orgId);
    }

    // Set current org from existing list
    const org = organizations.find((o) => o._id === orgId);
    if (org) {
      setCurrentOrg(org);
    }
    setNeedsOrgSelection(false);

    // Refetch user with new token
    try {
      const userRes = await authApi.me();
      setUser(userRes.data || null);
    } catch {
      // continue with existing user
    }
  };

  const refreshOrgs = async () => {
    await fetchOrgs();
  };

  const needsOnboarding = Boolean(user && currentOrg && currentOrg.onboardingCompleted === false);

  const handleSetCurrentOrg = (org: Organization | null) => {
    setCurrentOrg(org);
    if (org) {
      localStorage.setItem("currentOrgId", org._id);
      setNeedsOrgSelection(false);
    } else {
      localStorage.removeItem("currentOrgId");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentOrg,
        organizations,
        needsOrgSelection,
        needsOnboarding,
        login,
        register,
        logout,
        switchOrg,
        refreshOrgs,
        setCurrentOrg: handleSetCurrentOrg,
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
