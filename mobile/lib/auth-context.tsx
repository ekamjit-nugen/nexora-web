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

// Match the shape returned by /auth/organizations/my — the org object
// carries `features` map that drives per-tenant gating in mobile tabs/
// menus. Every flag is optional in the type because:
//   1. The auth-service only persists explicit flags; defaults are
//      assumed `enabled` for backward compat with older orgs.
//   2. New flags added on the backend ship without a mobile rebuild —
//      they just default to enabled until the mobile catches up.
export interface OrgFeatures {
  projects?: { enabled: boolean };
  tasks?: { enabled: boolean };
  sprints?: { enabled: boolean };
  timesheets?: { enabled: boolean };
  attendance?: { enabled: boolean };
  leaves?: { enabled: boolean };
  clients?: { enabled: boolean };
  invoices?: { enabled: boolean };
  reports?: { enabled: boolean };
  chat?: { enabled: boolean };
  calls?: { enabled: boolean };
  ai?: { enabled: boolean };
  assetManagement?: { enabled: boolean };
  expenseManagement?: { enabled: boolean };
  recruitment?: { enabled: boolean };
  payroll?: { enabled: boolean };
  performance?: { enabled: boolean };
  helpdesk?: { enabled: boolean };
  knowledge?: { enabled: boolean };
  [key: string]: { enabled: boolean } | undefined;
}

interface Organization {
  _id: string;
  name: string;
  onboardingCompleted: boolean;
  features?: OrgFeatures;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  currentOrg: Organization | null;
  organizations: Organization[];
  isPlatformAdmin: boolean;
  // Per-tenant role on the current org. Decoded from the JWT payload
  // after login / org-switch — backend mints a new token with the
  // appropriate `orgRole` whenever the user switches orgs. Used by
  // screens to gate self-service actions (e.g. owner/admin can't
  // clock in or apply for leave; they only approve their team's).
  orgRole: string;
  // Per-tenant feature check — same semantics as the web auth-context.
  // Returns true if (a) the platform admin is logged in, (b) the
  // feature is missing from the org doc (legacy default), or (c) the
  // flag is explicitly enabled. Any other state returns false so
  // tabs/menus disappear cleanly.
  isFeatureEnabled: (feature: keyof OrgFeatures) => boolean;
  login: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  selectOrg: (org: Organization) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// JWT payload decode without external library — a single-line
// base64url decode is sufficient to read the orgRole claim. We only
// trust this for UI gating; security checks happen server-side via
// the JwtAuthGuard.
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgRole, setOrgRole] = useState<string>('member');

  // Re-read orgRole from the stored token. Called after login + after
  // an org-switch, since the backend issues a new token with the
  // updated orgRole claim each time. Falls back to 'member' if the
  // token can't be decoded — a sensible default for non-admin gating.
  const refreshOrgRole = useCallback(async () => {
    const t = await SecureStore.getItemAsync('accessToken');
    if (!t) { setOrgRole('member'); return; }
    const payload = decodeJwtPayload(t);
    setOrgRole(payload?.orgRole || 'member');
  }, []);

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
    // First-load orgRole hydration — runs in parallel with fetchUser
    // since we just need to read the stored JWT without a server call.
    refreshOrgRole();
  }, [fetchUser, refreshOrgRole]);

  const login = async (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => {
    await SecureStore.setItemAsync("accessToken", tokens.accessToken);
    await refreshOrgRole();
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
      // switchOrg returns a fresh token with the new orgRole claim;
      // it's already saved to SecureStore by the api wrapper, so we
      // just re-read it here to update local state.
      await refreshOrgRole();
    } catch (err) {
      console.warn("[Auth] Failed to switch organization:", err);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const isPlatformAdmin = user?.isPlatformAdmin === true;

  // Mirrors the web auth-context behaviour. Three-state truth:
  //   - missing org doc / missing flag → enabled (backward compat for
  //     orgs created before a flag existed)
  //   - flag.enabled === true → enabled
  //   - flag.enabled === false → disabled
  // Platform admins always see everything.
  const isFeatureEnabled = useCallback(
    (feature: keyof OrgFeatures): boolean => {
      if (isPlatformAdmin) return true;
      const features = currentOrg?.features;
      if (!features) return true;
      const flag = features[feature];
      if (flag === undefined) return true;
      return flag.enabled === true;
    },
    [isPlatformAdmin, currentOrg],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentOrg,
        organizations,
        isPlatformAdmin,
        orgRole,
        isFeatureEnabled,
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
