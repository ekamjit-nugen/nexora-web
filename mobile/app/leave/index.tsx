import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { leaveApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";
import { Hero } from "../../components/Hero";

// ─────────────────────────────────────────────────────────────────────────────
// Leave — employee-facing screen.
//
// Shows the caller's leave balances + their personal request history. Admins/
// owners reviewing the team's pending requests use the dedicated /approvals
// screen instead — this one is single-purpose to avoid the render-fragility
// the previous combined screen had (ProgressRing SVG + tab switching +
// conditional FAB all in one file caused crashes for managers on newArch).
//
// The Apply CTA is hidden for admins/owners (backend rejects 403 anyway —
// surfacing the button just produces a confusing error toast).
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_TYPE_TONES: Record<string, { bg: string; fg: string }> = {
  casual:      COLORS.toneIndigo,
  sick:        COLORS.toneRose,
  earned:      COLORS.toneEmerald,
  comp_off:    COLORS.toneViolet,
  wfh:         COLORS.toneTeal,
  maternity:   { bg: "#FCE7F3", fg: "#BE185D" },
  paternity:   COLORS.toneViolet,
  bereavement: COLORS.toneSlate,
  lop:         COLORS.toneAmber,
};

function tone(t?: string) {
  return LEAVE_TYPE_TONES[t || ""] || COLORS.toneSlate;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "approved":  return COLORS.success;
    case "pending":   return COLORS.warning;
    case "rejected":  return COLORS.danger;
    case "cancelled": return COLORS.textMuted;
    default:          return COLORS.textSecondary;
  }
}

function getStatusIcon(status: string): any {
  switch (status) {
    case "approved":  return "check-circle";
    case "pending":   return "clock-outline";
    case "rejected":  return "close-circle";
    case "cancelled": return "cancel";
    default:          return "help-circle-outline";
  }
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatDateShort(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function getLeaveTypeLabel(type?: string) {
  if (!type) return "Leave";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LeaveIndexScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, orgRole } = useAuth();

  // Admin/owner sees this screen as a passive list (their personal leaves are
  // empty anyway; the Apply CTA is hidden because the backend rejects 403).
  const isAdminOrOwner =
    !!user?.roles?.some((r: string) =>
      ["admin", "super_admin"].includes(r.toLowerCase()),
    ) ||
    orgRole === "owner" ||
    orgRole === "admin";
  const canApplyLeave = !isAdminOrOwner;

  const [refreshing, setRefreshing] = useState(false);

  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
    error: balanceError,
  } = useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: () => leaveApi.getBalance(),
    retry: 1,
  });

  const {
    data: myLeavesData,
    isLoading: leavesLoading,
    refetch: refetchLeaves,
    error: leavesError,
  } = useQuery({
    queryKey: ["leaves", "my"],
    queryFn: () => leaveApi.getMyLeaves({ page: 1 }),
    retry: 1,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leaves"] }),
    onError: (err: any) =>
      Alert.alert("Couldn't cancel", err?.message || "Please try again."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchLeaves()]);
    setRefreshing(false);
  }, [refetchBalance, refetchLeaves]);

  const handleCancel = (id: string) => {
    Alert.alert("Cancel leave?", "This will withdraw your request.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel leave",
        style: "destructive",
        onPress: () => cancelMutation.mutate(id),
      },
    ]);
  };

  // Defensive parse — the leave-service returns `data: { balances: [...] }`
  // (object with a balances array). Older shapes used a plain array or an
  // object-map of type→count. Handle all of them so a shape mismatch never
  // crashes the screen.
  const balances: any[] = (() => {
    const d: any = balanceData?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.balances)) return d.balances;
    if (d && typeof d === "object") {
      return Object.entries(d)
        // Skip metadata fields (year, _id, organizationId, etc.) — keep
        // only entries whose value looks like a balance count or record.
        .filter(([k, v]) => {
          if (["_id", "year", "organizationId", "employeeId", "createdAt", "updatedAt", "__v"].includes(k)) return false;
          return typeof v === "number" || (v && typeof v === "object");
        })
        .map(([type, v]: [string, any]) => ({
          leaveType: type,
          available: typeof v === "number" ? v : v?.available ?? v?.remaining ?? 0,
          opening: typeof v === "object" ? v?.opening ?? v?.total ?? v?.annualAllocation ?? 0 : 0,
        }));
    }
    return [];
  })();

  const myLeaves: any[] = Array.isArray(myLeavesData?.data)
    ? myLeavesData.data
    : Array.isArray((myLeavesData as any)?.data?.data)
    ? (myLeavesData as any).data.data
    : [];

  return (
    <View style={styles.container}>
      <Hero
        title="Leave"
        subtitle={
          balanceLoading
            ? "Loading…"
            : `${myLeaves.length} request${myLeaves.length === 1 ? "" : "s"}`
        }
        showBack
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Balance section — text-only cards. */}
        <Text style={styles.sectionLabel}>Balance</Text>
        <View style={styles.balanceCard}>
          {balanceLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : balanceError ? (
            <View style={styles.errorRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={COLORS.danger} />
              <Text style={styles.errorText}>
                Couldn't load balances. Pull to retry.
              </Text>
            </View>
          ) : balances.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineText}>
                No leave balances configured yet.
              </Text>
            </View>
          ) : (
            <View style={styles.balanceGrid}>
              {balances.map((b: any, idx: number) => {
                const t = tone(b.type || b.leaveType);
                // Backend writes `available` / `opening`. Older shapes used
                // `remaining` / `total` / `annualAllocation` / `balance`.
                // Try them all so the card always shows a number.
                const remaining = b.available ?? b.remaining ?? b.balance ?? 0;
                const total = b.opening ?? b.total ?? b.annualAllocation ?? null;
                return (
                  <View key={idx} style={styles.balanceItem}>
                    <View style={[styles.balanceDot, { backgroundColor: t.bg }]}>
                      <Text style={[styles.balanceNumber, { color: t.fg }]}>
                        {remaining}
                      </Text>
                    </View>
                    <Text style={styles.balanceLabel} numberOfLines={1}>
                      {getLeaveTypeLabel(b.type || b.leaveType)}
                    </Text>
                    {total !== null && (
                      <Text style={styles.balanceTotal}>of {total}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* My requests */}
        <Text style={styles.sectionLabel}>My Requests</Text>
        {leavesLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : leavesError ? (
          <View style={[styles.balanceCard, styles.errorRow]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={COLORS.danger} />
            <Text style={styles.errorText}>
              Couldn't load your leaves. Pull to retry.
            </Text>
          </View>
        ) : myLeaves.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={40}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyTitle}>No leave requests yet</Text>
            <Text style={styles.emptyBody}>
              {canApplyLeave
                ? "Tap the button below to apply for your first leave."
                : "Admins don't apply for personal leaves on this account."}
            </Text>
          </View>
        ) : (
          myLeaves.map((leave: any) => {
            const t = tone(leave.leaveType || leave.type);
            const statusColor = getStatusColor(leave.status);
            return (
              <TouchableOpacity
                key={leave._id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/leave/${leave._id}` as any)}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: t.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: t.fg }]}>
                      {getLeaveTypeLabel(leave.leaveType || leave.type)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor + "18" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getStatusIcon(leave.status)}
                      size={12}
                      color={statusColor}
                    />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {leave.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <MaterialCommunityIcons
                    name="calendar-range"
                    size={15}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.dateText}>
                    {formatDateShort(leave.startDate)} → {formatDateShort(leave.endDate)}
                  </Text>
                </View>

                {leave.reason ? (
                  <Text style={styles.reason} numberOfLines={2}>
                    {leave.reason}
                  </Text>
                ) : null}

                {leave.status === "pending" && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={(e) => {
                      // Stop the parent TouchableOpacity from firing — we want
                      // Cancel to be a self-contained action, not navigate.
                      e?.stopPropagation?.();
                      handleCancel(leave._id);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={14}
                      color={COLORS.danger}
                    />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Apply Leave FAB — hidden for admins/owners. */}
      {canApplyLeave && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => router.push("/leave/apply" as any)}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <Text style={styles.fabText}>Apply</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
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
    paddingBottom: SPACING.xxl + 60, // leave room for FAB
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  // ─── Balance ──────────────────────────────────────────────────────
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  loader: {
    marginVertical: SPACING.md,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  emptyInline: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  emptyInlineText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  balanceItem: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  balanceDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs + 2,
  },
  balanceNumber: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  balanceTotal: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  // ─── Empty state ──────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  center: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  // ─── Leave card ───────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
    marginBottom: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.xs,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  reason: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.dangerLight,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.danger,
    letterSpacing: 0.2,
  },
  // ─── FAB ───────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    right: SPACING.lg,
    bottom: SPACING.lg + 8,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    ...SHADOWS.colored(COLORS.primary),
  },
  fabGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md - 2,
  },
  fabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});
