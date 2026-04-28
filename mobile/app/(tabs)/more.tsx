import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import {
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS, SURFACES } from "../../lib/theme";

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  subtitle?: string;
  // Tone from the curated COLORS.tone* palette. Drives the icon's
  // bg + fg so categories feel like a designed family.
  tone: { bg: string; fg: string };
  onPress?: () => void;
  // Optional feature key — when set, the item only appears if the
  // current org has the matching feature toggle enabled. Items
  // without a feature key are always visible (Profile, Notifications,
  // Settings — universal admin/profile actions).
  feature?:
    | "leaves"
    | "tasks"
    | "timesheets"
    | "projects"
    | "attendance"
    | "chat"
    | "calls"
    | "policies";
}

export default function MoreScreen() {
  const router = useRouter();
  const { user, currentOrg, logout, organizations, orgRole, isFeatureEnabled } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // Role-based admin/owner detection. Mirrors the home/time/leave screens —
  // we don't show admin actions to regular employees, and conversely we
  // surface admin-only entries (Approvals queue) for those who can act.
  const isAdminOrOwner =
    !!user?.roles?.some((r: string) => ["admin", "super_admin"].includes(r.toLowerCase())) ||
    orgRole === "owner" || orgRole === "admin";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleSwitchOrg = () => {
    if (organizations.length > 1) {
      router.push("/(auth)/select-org");
    }
  };

  // Each menu item carries a `tone` from the curated palette. Drives
  // the icon's bg/fg colours so every section looks like a coordinated
  // family rather than a row of one-off neutral buttons.
  const accountItems: MenuItem[] = [
    { id: "profile",       label: "Profile",       icon: "account-outline", subtitle: user?.email || "", tone: COLORS.toneIndigo,  onPress: () => router.push("/profile") },
    { id: "notifications", label: "Notifications", icon: "bell-outline",                                   tone: COLORS.toneAmber,   onPress: () => router.push("/notifications") },
    { id: "settings",      label: "Settings",      icon: "cog-outline",                                    tone: COLORS.toneSlate,   onPress: () => router.push("/settings" as any) },
  ];

  // Per-tenant feature gating. Items with a `feature:` key drop out
  // when the org has the flag off (e.g. Nugen with timesheets disabled
  // won't see the Timesheets row).
  const workItemsAll: MenuItem[] = [
    { id: "my-tasks",   label: "My Tasks",   icon: "clipboard-check-outline", subtitle: "Personal todos & assignments",  tone: COLORS.toneViolet,  onPress: () => router.push("/my-tasks" as any) },
    { id: "leave",      label: "Leave",      icon: "calendar-check-outline",  subtitle: "Apply & manage leaves",         tone: COLORS.toneEmerald, onPress: () => router.push("/leave"),       feature: "leaves" },
    { id: "directory",  label: "Directory",  icon: "account-group-outline",   subtitle: "Browse team members",           tone: COLORS.toneTeal,    onPress: () => router.push("/directory") },
    { id: "timesheets", label: "Timesheets", icon: "table-clock",             subtitle: "View and submit timesheets",    tone: COLORS.toneSky,     onPress: () => router.push("/timesheets"),  feature: "timesheets" },
    { id: "policies",   label: "Policies",   icon: "shield-check-outline",    subtitle: "Company policies",              tone: COLORS.toneViolet,  onPress: () => router.push("/policies") },
  ];
  const workItems = workItemsAll.filter((it) => !it.feature || isFeatureEnabled(it.feature));

  // Admin-only menu section. Each item routes into existing manager
  // surfaces (the leave screen already has a pending-approval tab —
  // no need for a duplicate screen, just deep-link with ?tab=pending).
  const adminItemsAll: MenuItem[] = [
    {
      id: "leave-approvals",
      label: "Leave Approvals",
      icon: "checkbox-marked-circle-plus-outline",
      subtitle: "Approve or reject team leaves",
      tone: COLORS.toneAmber,
      onPress: () => router.push("/approvals" as any),
      feature: "leaves",
    },
    {
      id: "directory-admin",
      label: "Manage People",
      icon: "account-group-outline",
      subtitle: "Browse and manage team members",
      tone: COLORS.toneTeal,
      onPress: () => router.push("/directory"),
    },
  ];
  const adminItems = isAdminOrOwner
    ? adminItemsAll.filter((it) => !it.feature || isFeatureEnabled(it.feature))
    : [];

  const orgItems: MenuItem[] = [
    {
      id: "switch-org",
      label: "Switch Organization",
      icon: "office-building-cog-outline",
      subtitle: currentOrg?.name || "No organization",
      onPress: handleSwitchOrg,
      tone: COLORS.toneRose,
    },
  ];

  const renderMenuItem = (item: MenuItem, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      activeOpacity={0.6}
      onPress={item.onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.tone.bg }]}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={20}
          color={item.tone.fg}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.subtitle && (
          <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderSection = (title: string, items: MenuItem[]) => {
    // Skip an entirely empty section — happens when every item in
    // the section is gated off for the current tenant. Without this,
    // a Nugen-style tenant with leaves+timesheets disabled would see
    // a "Work" section header followed by just Directory + Policies,
    // which is fine — but a tenant with everything disabled would
    // see a header with no rows beneath it.
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionCard}>
          {items.map((item, idx) => renderMenuItem(item, idx === items.length - 1))}
        </View>
      </View>
    );
  };

  if (loggingOut) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loggingOutText}>Signing out...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Gradient profile hero — deeper indigo→violet anchors the
            page. Avatar overlaps the bottom edge for a layered feel. */}
        <SafeAreaView edges={["top"]}>
          <LinearGradient
            colors={SURFACES.heroGradientDeep as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHero}
          >
            <View style={styles.heroBlobLg} />
            <View style={styles.heroBlobSm} />
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                {(user as any)?.avatar ? (
                  <Image
                    source={{ uri: (user as any).avatar }}
                    style={styles.profileAvatarImage}
                  />
                ) : (
                  <Text style={styles.profileAvatarText}>
                    {(user?.firstName?.[0] || "U").toUpperCase()}
                    {(user?.lastName?.[0] || "").toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.profileName}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              {user?.roles && user.roles.length > 0 && (
                <View style={styles.roleBadges}>
                  {user.roles.slice(0, 3).map((role) => (
                    <View key={role} style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{role}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
        </SafeAreaView>

        <View style={styles.content}>
          {renderSection("Account", accountItems)}
          {renderSection("Admin", adminItems)}
          {renderSection("Work", workItems)}
          {renderSection("Organization", orgItems)}

          {/* Logout */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.7}
              onPress={handleLogout}
            >
              <View style={[styles.menuIcon, { backgroundColor: COLORS.dangerLight }]}>
                <MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} />
              </View>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>Nexora Mobile v1.0.0</Text>
            {currentOrg && (
              <Text style={styles.appInfoText}>{currentOrg.name}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  loggingOutText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  // ─── Gradient profile hero — deep indigo → violet ────────────────
  profileHero: {
    paddingBottom: SPACING.xl + 8,
    overflow: "hidden",
  },
  // Two decorative blobs at different sizes/positions add depth and
  // make the gradient feel less flat. They're soft enough to read as
  // ambient lighting rather than UI elements.
  heroBlobLg: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroBlobSm: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  profileSection: {
    alignItems: "center",
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: SPACING.md,
  },
  roleBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    justifyContent: "center",
  },
  // Glass role chip — translucent on the hero gradient.
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "700",
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.danger,
  },
  appInfo: {
    alignItems: "center",
    paddingTop: SPACING.lg,
    gap: SPACING.xs,
  },
  appInfoText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
