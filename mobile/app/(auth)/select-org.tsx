import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Button,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

export default function SelectOrgScreen() {
  const router = useRouter();
  const { organizations, selectOrg, user, logout, loading } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = async (org: (typeof organizations)[0]) => {
    setSelectedId(org._id);
    setSubmitting(true);

    try {
      await selectOrg(org);
      router.replace("/(tabs)");
    } catch {
      setSubmitting(false);
      setSelectedId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading workspaces...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeader}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>N</Text>
            </View>
            <Text style={styles.title}>Choose Workspace</Text>
            {user?.email && (
              <View style={styles.emailChip}>
                <MaterialCommunityIcons
                  name="account-circle-outline"
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
                <Text style={styles.emailChipText}>{user.email}</Text>
              </View>
            )}
          </View>

          {/* Org List */}
          <View style={styles.listWrapper}>
            {organizations.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="office-building-outline"
                  size={48}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyTitle}>No workspaces found</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't been added to any organization yet.
                  Contact your admin or create one from the web app.
                </Text>
              </View>
            ) : (
              <FlatList
                data={organizations}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
                renderItem={({ item }) => {
                  const isSelected = selectedId === item._id;
                  return (
                    <TouchableOpacity
                      onPress={() => handleSelect(item)}
                      disabled={submitting}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.orgCard,
                          isSelected && styles.orgCardSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.orgIcon,
                            isSelected && styles.orgIconSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.orgIconText,
                              isSelected && styles.orgIconTextSelected,
                            ]}
                          >
                            {item.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.orgInfo}>
                          <Text style={styles.orgName}>{item.name}</Text>
                          <View style={styles.orgStatusRow}>
                            <View
                              style={[
                                styles.orgStatusDot,
                                {
                                  backgroundColor: item.onboardingCompleted
                                    ? COLORS.success
                                    : COLORS.warning,
                                },
                              ]}
                            />
                            <Text style={styles.orgStatus}>
                              {item.onboardingCompleted ? "Active" : "Setting up"}
                            </Text>
                          </View>
                        </View>
                        {isSelected && submitting ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={22}
                            color={COLORS.textMuted}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              mode="text"
              onPress={handleLogout}
              labelStyle={styles.logoutText}
              icon="logout"
              textColor={COLORS.textMuted}
            >
              Sign out
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: SPACING.md,
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: "center",
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  emailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  emailChipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  listWrapper: {
    flex: 1,
  },
  list: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  orgCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  orgCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  orgIconSelected: {
    backgroundColor: COLORS.primary,
  },
  orgIconText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primary,
  },
  orgIconTextSelected: {
    color: "#FFFFFF",
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  orgStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  orgStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  orgStatus: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    marginTop: SPACING.lg,
    ...SHADOWS.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  footer: {
    paddingBottom: SPACING.md,
    alignItems: "center",
  },
  logoutText: {
    color: COLORS.textMuted,
    fontWeight: "500",
  },
});
