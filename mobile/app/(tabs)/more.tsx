import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  subtitle?: string;
  color?: string;
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
  const { user, currentOrg, logout, organizations, isFeatureEnabled } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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

  const accountItems: MenuItem[] = [
    { id: "profile", label: "Profile", icon: "account-outline", subtitle: user?.email || "", color: COLORS.primary, onPress: () => router.push("/profile") },
    { id: "notifications", label: "Notifications", icon: "bell-outline", color: COLORS.warning, onPress: () => router.push("/notifications") },
    { id: "settings", label: "Settings", icon: "cog-outline", color: COLORS.textSecondary, onPress: () => Alert.alert("Settings", "App settings coming in a future update.") },
  ];

  // Per-tenant feature gating. Items with a `feature:` key drop out
  // when the org has the flag off (e.g. Nugen with timesheets disabled
  // won't see the Timesheets row). Directory has no gate — it's
  // assumed always-on across tenants. Policies follows policy/work-
  // config which is part of `attendance` for now.
  const workItemsAll: MenuItem[] = [
    { id: "leave", label: "Leave", icon: "calendar-check-outline", subtitle: "Apply & manage leaves", color: COLORS.primary, onPress: () => router.push("/leave"), feature: "leaves" },
    { id: "directory", label: "Directory", icon: "account-group-outline", subtitle: "Browse team members", color: COLORS.accent, onPress: () => router.push("/directory") },
    { id: "timesheets", label: "Timesheets", icon: "table-clock", subtitle: "View and submit timesheets", color: COLORS.success, onPress: () => router.push("/timesheets"), feature: "timesheets" },
    { id: "policies", label: "Policies", icon: "shield-check-outline", subtitle: "Company policies", color: COLORS.secondary, onPress: () => router.push("/policies") },
  ];
  const workItems = workItemsAll.filter((it) => !it.feature || isFeatureEnabled(it.feature));

  const orgItems: MenuItem[] = [
    {
      id: "switch-org",
      label: "Switch Organization",
      icon: "office-building-cog-outline",
      subtitle: currentOrg?.name || "No organization",
      onPress: handleSwitchOrg,
      color: COLORS.info,
    },
  ];

  const renderMenuItem = (item: MenuItem, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      activeOpacity={0.6}
      onPress={item.onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: (item.color || COLORS.primary) + "12" }]}>
        <MaterialCommunityIcons
          name={item.icon as any}
          size={20}
          color={item.color || COLORS.primary}
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
        {/* Profile Header */}
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={["top"]}>
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {(user?.firstName?.[0] || "U").toUpperCase()}
                  {(user?.lastName?.[0] || "").toUpperCase()}
                </Text>
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
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          {renderSection("Account", accountItems)}
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
  headerGradient: {
    paddingBottom: SPACING.xl,
  },
  profileSection: {
    alignItems: "center",
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: SPACING.sm,
  },
  roleBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    justifyContent: "center",
  },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    textTransform: "capitalize",
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
