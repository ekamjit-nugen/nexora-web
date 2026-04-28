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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { leaveApi } from "../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../lib/theme";
import { Hero } from "../components/Hero";

// ─────────────────────────────────────────────────────────────────────────────
// Approvals — dedicated admin/manager surface for reviewing pending leave
// requests inline. Single-purpose by design: no tab switching, no balance
// cards, no apply-leave CTA. Just the queue, scoped to the caller's org,
// with one-tap approve/reject.
//
// Why a separate screen rather than reusing /leave with ?tab=pending:
//   1. /leave tries to be both the employee surface (apply, my history,
//      balances) and the manager surface (approvals). The mixed responsibility
//      caused render fragility for managers.
//   2. Admins/owners shouldn't see balance cards or an "Apply" button — those
//      surface a 403 server-side anyway.
//   3. Clean route = clean deep-link from notifications later (e.g. tapping
//      a "5 leaves pending review" notification jumps straight here).
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.danger,
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDays(start?: string, end?: string) {
  if (!start || !end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86_400_000) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["approvals", "pending-leaves"],
    queryFn: () => leaveApi.getAll({ page: 1, status: "pending" }),
    retry: 1,
  });

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      status,
      rejectionReason,
    }: {
      id: string;
      status: "approved" | "rejected";
      rejectionReason?: string;
    }) => leaveApi.approve(id, { status, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (err: any) => {
      Alert.alert("Could not update leave", err?.message || "Please try again.");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleApprove = (leave: any) => {
    Alert.alert(
      "Approve leave?",
      `Approve ${leave.leaveType || "this"} request for ${formatDays(
        leave.startDate,
        leave.endDate,
      )}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () =>
            approveMutation.mutate({ id: leave._id, status: "approved" }),
        },
      ],
    );
  };

  const handleReject = (leave: any) => {
    Alert.alert("Reject leave?", "This will notify the employee.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          approveMutation.mutate({
            id: leave._id,
            status: "rejected",
            rejectionReason: "Rejected by manager",
          }),
      },
    ]);
  };

  // Pull the array from a few possible shapes — the API normally returns
  // `{ success, data: [...] }`, but we guard against unexpected shapes so
  // a malformed response never crashes the screen.
  const leaves: any[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray((data as any)?.data?.data)
    ? (data as any).data.data
    : [];

  return (
    <View style={styles.container}>
      <Hero
        title="Approvals"
        subtitle={
          isLoading
            ? "Loading…"
            : leaves.length === 0
            ? "All caught up"
            : `${leaves.length} pending`
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
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color={COLORS.danger}
            />
            <Text style={styles.errorTitle}>Couldn't load approvals</Text>
            <Text style={styles.errorBody}>
              {(error as any)?.message || "Pull down to retry."}
            </Text>
          </View>
        ) : leaves.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={56}
              color={COLORS.success}
            />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyBody}>
              No pending leave requests need your review.
            </Text>
          </View>
        ) : (
          leaves.map((leave: any) => {
            const statusColor =
              STATUS_COLORS[leave.status] || COLORS.textSecondary;
            const employeeName =
              leave.employeeName ||
              [leave.employee?.firstName, leave.employee?.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              "Team member";
            return (
              <View key={leave._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(employeeName[0] || "?").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.employeeName} numberOfLines={1}>
                      {employeeName}
                    </Text>
                    <Text style={styles.leaveType} numberOfLines={1}>
                      {(leave.leaveType || "leave").replace(/_/g, " ")} ·{" "}
                      {formatDays(leave.startDate, leave.endDate)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor + "18" },
                    ]}
                  >
                    <Text
                      style={[styles.statusPillText, { color: statusColor }]}
                    >
                      {leave.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <MaterialCommunityIcons
                    name="calendar-range"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.dateText}>
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </Text>
                </View>

                {leave.reason ? (
                  <Text style={styles.reason} numberOfLines={3}>
                    {leave.reason}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(leave)}
                    activeOpacity={0.7}
                    disabled={approveMutation.isPending}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={16}
                      color={COLORS.danger}
                    />
                    <Text
                      style={[styles.actionText, { color: COLORS.danger }]}
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(leave)}
                    activeOpacity={0.85}
                    disabled={approveMutation.isPending}
                  >
                    <MaterialCommunityIcons
                      name="check"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={[styles.actionText, { color: "#FFFFFF" }]}>
                      Approve
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
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
    paddingVertical: SPACING.xxl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  errorBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.sm,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },
  headerText: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  leaveType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  statusPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs + 2,
    marginBottom: SPACING.sm,
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
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceMuted,
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger + "40",
    backgroundColor: COLORS.dangerLight,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
