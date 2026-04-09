import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.charAt(0)?.toUpperCase() || "";
  const l = lastName?.charAt(0)?.toUpperCase() || "";
  return f + l || "?";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatRoleLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <View style={styles.infoIconWrap}>
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, currentOrg } = useAuth();

  const fullName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "User";

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerContent}>
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(user?.firstName, user?.lastName)}
                </Text>
              </View>
            </View>

            {/* Name & Email */}
            <Text style={styles.headerName}>{fullName}</Text>
            <Text style={styles.headerEmail}>{user?.email || ""}</Text>

            {/* Role badges */}
            {user?.roles && user.roles.length > 0 && (
              <View style={styles.rolesRow}>
                {user.roles.map((role) => (
                  <View key={role} style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {formatRoleLabel(role)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Body */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Info Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="account-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Personal Info</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="account"
            label="First Name"
            value={user?.firstName || "N/A"}
          />
          <InfoRow
            icon="account"
            label="Last Name"
            value={user?.lastName || "N/A"}
          />
          <InfoRow
            icon="email-outline"
            label="Email"
            value={user?.email || "N/A"}
          />
          {user?.phone ? (
            <InfoRow icon="phone-outline" label="Phone" value={user.phone} />
          ) : null}
        </View>

        {/* Organization Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="office-building-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Organization</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="domain"
            label="Organization"
            value={currentOrg?.name || "N/A"}
          />
          <InfoRow
            icon="briefcase-outline"
            label="Department"
            value={(user as any)?.department || "N/A"}
          />
          <InfoRow
            icon="badge-account-horizontal-outline"
            label="Designation"
            value={(user as any)?.designation || "N/A"}
          />
        </View>

        {/* Account Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="shield-account-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <View style={styles.sectionDivider} />
          <InfoRow
            icon="calendar-clock"
            label="Member Since"
            value={formatDate((user as any)?.createdAt)}
          />
          {(user as any)?.lastLogin ? (
            <InfoRow
              icon="login"
              label="Last Login"
              value={formatDate((user as any).lastLogin)}
            />
          ) : null}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={styles.infoIconWrap}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.infoLabel}>Status</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
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
  headerGradient: {
    paddingBottom: SPACING.xl,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    alignItems: "center",
  },
  backBtn: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: SPACING.md,
  },
  rolesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm + 2,
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
    maxWidth: "50%",
    textAlign: "right",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.success,
  },
});
