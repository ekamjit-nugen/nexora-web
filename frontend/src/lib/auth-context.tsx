"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { authApi, orgApi, User, Organization, OrgFeatures } from "./api";
import { useRouter } from "next/navigation";
import { resetTheme } from "./theme";

// Role hierarchy for comparison
const ROLE_HIERARCHY = ['viewer', 'member', 'employee', 'designer', 'developer', 'manager', 'hr', 'admin', 'owner'];

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  currentOrg: Organization | null;
  organizations: Organization[];
  needsOrgSelection: boolean;
  needsOnboarding: boolean;
  isPlatformAdmin: boolean;
  orgRole: string;
  hasOrgRole: (minRole: string) => boolean;
  isProjectRole: (team: Array<{ userId: string; role: string }>, minRole: string) => boolean;
  isFeatureEnabled: (feature: keyof OrgFeatures) => boolean;
  login: (email: string, password: string) => Promise<{ needsOrgSelection: boolean }>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setCurrentOrg: (org: Organization | null) => void;
  handlePostOtpRoute: (routeData: { route: string; organizationId?: string }) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);
  const [orgRole, setOrgRole] = useState<string>('member');
  const router = useRouter();

  const extractOrgRoleFromToken = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return 'member';
    const payload = decodeJwtPayload(token);
    return payload?.orgRole || 'member';
  }, []);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await orgApi.getMyOrgs();
      const orgs = res.data || [];
      setOrganizations(orgs);

      if (orgs.length === 1) {
        setCurrentOrg(orgs[0]);
        setNeedsOrgSelection(false);
      } else if (orgs.length > 1) {
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
        setOrgRole(extractOrgRoleFromToken());
      }
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("currentOrgId");
    } finally {
      setLoading(false);
    }
  }, [fetchOrgs, extractOrgRoleFromToken]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data || null);
    } catch {
      // ignore
    }
  }, []);

  const handlePostOtpRoute = useCallback((routeData: { route: string; organizationId?: string }) => {
    if (routeData.organizationId) {
      localStorage.setItem("currentOrgId", routeData.organizationId);
    }
    router.push(routeData.route);
  }, [router]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (res.data) {
      // Store tokens in localStorage as fallback; httpOnly cookies are set by the server
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);

      const userRes = await authApi.me();
      setUser(userRes.data || null);

      const orgs = await fetchOrgs();
      setOrgRole(extractOrgRoleFromToken());

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
    const res = await authApi.login({ email: data.email, password: data.password });
    if (res.data) {
      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      const userRes = await authApi.me();
      setUser(userRes.data || null);
      await fetchOrgs();
      setOrgRole(extractOrgRoleFromToken());
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
    setOrgRole('member');
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
      localStorage.setItem("currentOrgId", orgId);
    }

    const org = organizations.find((o) => o._id === orgId);
    if (org) {
      setCurrentOrg(org);
    }
    setNeedsOrgSelection(false);
    setOrgRole(extractOrgRoleFromToken());

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

  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const needsOnboarding = Boolean(user && currentOrg && currentOrg.onboardingCompleted === false && !isPlatformAdmin);

  const hasOrgRole = useCallback((minRole: string): boolean => {
    if (isPlatformAdmin) return true;
    const userIndex = ROLE_HIERARCHY.indexOf(orgRole);
    const minIndex = ROLE_HIERARCHY.indexOf(minRole);
    return userIndex >= minIndex;
  }, [isPlatformAdmin, orgRole]);

  const isProjectRole = useCallback((team: Array<{ userId: string; role: string }>, minRole: string): boolean => {
    if (isPlatformAdmin) return true;
    if (hasOrgRole('admin')) return true;
    const userId = user?._id || (user as any)?.userId;
    const member = team?.find(m => m.userId === userId);
    if (!member) return false;
    const memberIndex = ROLE_HIERARCHY.indexOf(member.role);
    const minIndex = ROLE_HIERARCHY.indexOf(minRole);
    return memberIndex >= minIndex;
  }, [isPlatformAdmin, hasOrgRole, user]);

  const isFeatureEnabled = useCallback((feature: keyof OrgFeatures): boolean => {
    if (isPlatformAdmin) return true;
    const features = currentOrg?.features;
    if (!features) return true;
    const flag = features[feature];
    if (flag === undefined) return true;
    return flag.enabled === true;
  }, [isPlatformAdmin, currentOrg]);

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
        isPlatformAdmin,
        orgRole,
        hasOrgRole,
        isProjectRole,
        isFeatureEnabled,
        login,
        register,
        logout,
        switchOrg,
        refreshOrgs,
        refreshUser,
        setCurrentOrg: handleSetCurrentOrg,
        handlePostOtpRoute,
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
