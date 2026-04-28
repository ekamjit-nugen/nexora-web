import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../lib/theme";
import { Hero } from "../components/Hero";

// ─────────────────────────────────────────────────────────────────────────────
// Settings — user preference controls.
//
// Backed by the auth-service `/auth/preferences` endpoint. Mirror of the web
// settings panel, scoped to what's meaningful on mobile:
//   • Notifications: email + in-app push toggles
//   • Appearance: theme (system / light / dark)
//   • Language: read-only display for now (i18n is web-only at v1)
//   • About: app version + support links
//
// Save is automatic on toggle/select (optimistic), so the user never has to
// tap a "Save" button — matches the iOS Settings.app pattern.
// ─────────────────────────────────────────────────────────────────────────────

const APP_VERSION = "1.0.0";

type Theme = "system" | "light" | "dark";

const THEME_OPTIONS: Array<{ key: Theme; label: string; icon: string }> = [
  { key: "system", label: "System", icon: "theme-light-dark" },
  { key: "light",  label: "Light",  icon: "white-balance-sunny" },
  { key: "dark",   label: "Dark",   icon: "weather-night" },
];

export default function SettingsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["auth", "preferences"],
    queryFn: () => authApi.getPreferences(),
    retry: 1,
  });

  // Local state mirrors the server so toggles feel instant. The mutation
  // patches the server in the background; on failure we revert.
  const prefs = (data as any)?.data || {};
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [theme, setTheme] = useState<Theme>("system");

  // Hydrate local state once the prefs land.
  useEffect(() => {
    if (data) {
      setEmailNotif(prefs?.notifications?.email ?? true);
      setInAppNotif(prefs?.notifications?.inApp ?? true);
      setTheme((prefs?.theme as Theme) || "system");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      authApi.updatePreferences(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth", "preferences"] }),
    onError: (err: any) => {
      Alert.alert(
        "Couldn't save",
        err?.message || "Your change wasn't saved. Please try again.",
      );
      // Revert by re-syncing with server.
      queryClient.invalidateQueries({ queryKey: ["auth", "preferences"] });
    },
  });

  const onToggleEmail = (val: boolean) => {
    setEmailNotif(val);
    update.mutate({
      notifications: {
        ...(prefs?.notifications || {}),
        email: val,
      },
    });
  };

  const onToggleInApp = (val: boolean) => {
    setInAppNotif(val);
    update.mutate({
      notifications: {
        ...(prefs?.notifications || {}),
        inApp: val,
      },
    });
  };

  const onSelectTheme = (next: Theme) => {
    setTheme(next);
    update.mutate({ theme: next });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Hero title="Settings" showBack />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Hero title="Settings" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.card, styles.errorRow]}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>
              Couldn't load preferences. Pull to retry.
            </Text>
          </View>
        ) : null}

        {/* ── Notifications ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneAmber.bg }]}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={18}
                  color={COLORS.toneAmber.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Email Notifications</Text>
                <Text style={styles.rowSubtitle}>
                  Leave updates, payslips, announcements
                </Text>
              </View>
            </View>
            <Switch
              value={emailNotif}
              onValueChange={onToggleEmail}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.borderLight}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneIndigo.bg }]}>
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={18}
                  color={COLORS.toneIndigo.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>In-App Notifications</Text>
                <Text style={styles.rowSubtitle}>
                  Bell badge on Home and notification list
                </Text>
              </View>
            </View>
            <Switch
              value={inAppNotif}
              onValueChange={onToggleInApp}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.borderLight}
            />
          </View>
        </View>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <Text style={styles.cardCaption}>
            Currently the mobile app follows light mode regardless. Dark mode
            ships in a future update — your preference is saved so it will
            apply automatically when ready.
          </Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = theme === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeChip,
                    active && styles.themeChipActive,
                  ]}
                  onPress={() => onSelectTheme(opt.key)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={18}
                    color={active ? "#FFFFFF" : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeChipText,
                      active && styles.themeChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneSlate.bg }]}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={COLORS.toneSlate.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>App Version</Text>
                <Text style={styles.rowSubtitle}>
                  Nexora Mobile · {Platform.OS === "ios" ? "iOS" : "Android"}
                </Text>
              </View>
            </View>
            <Text style={styles.rowValue}>v{APP_VERSION}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => Linking.openURL("https://nexora.io/privacy").catch(() => null)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneTeal.bg }]}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={18}
                  color={COLORS.toneTeal.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Privacy Policy</Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => Linking.openURL("https://nexora.io/terms").catch(() => null)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneViolet.bg }]}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={18}
                  color={COLORS.toneViolet.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Terms of Service</Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() =>
              Linking.openURL(
                "mailto:support@nexora.io?subject=Nexora Mobile Support",
              ).catch(() => null)
            }
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.toneRose.bg }]}>
                <MaterialCommunityIcons
                  name="lifebuoy"
                  size={18}
                  color={COLORS.toneRose.fg}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Contact Support</Text>
                <Text style={styles.rowSubtitle}>support@nexora.io</Text>
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Saved automatically · Pull to refresh
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxl,
  },
  // ─── Section ─────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xs,
    ...SHADOWS.sm,
  },
  cardCaption: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  // ─── Row ─────────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm + 2,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: SPACING.md + 36 + (SPACING.sm + 2),
  },
  // ─── Theme picker ────────────────────────────────────────────────
  themeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  themeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  themeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    letterSpacing: -0.1,
  },
  themeChipTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
});
