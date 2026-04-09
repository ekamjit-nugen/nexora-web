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
import { SafeAreaView } from "react-native-safe-area-context";
import { leaveApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";
import Svg, { Circle } from "react-native-svg";

type Tab = "my_leaves" | "pending_approval";

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual: COLORS.primary,
  sick: COLORS.danger,
  earned: COLORS.success,
  comp_off: COLORS.secondary,
  wfh: COLORS.accent,
  maternity: "#EC4899",
  paternity: "#8B5CF6",
  bereavement: COLORS.textSecondary,
  lop: COLORS.warning,
};

const LEAVE_TYPE_ICONS: Record<string, string> = {
  casual: "beach",
  sick: "hospital-box-outline",
  earned: "star-outline",
  comp_off: "swap-horizontal",
  wfh: "home-outline",
  maternity: "baby-carriage",
  paternity: "human-male-child",
  bereavement: "heart-outline",
  lop: "alert-circle-outline",
};

function ProgressRing({
  used,
  total,
  color,
  size = 56,
  strokeWidth = 5,
}: {
  used: number;
  total: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(used / total, 1) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color + "20"}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color }}>{total - used}</Text>
      </View>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "approved": return COLORS.success;
    case "pending": return COLORS.warning;
    case "rejected": return COLORS.danger;
    case "cancelled": return COLORS.textMuted;
    default: return COLORS.textSecondary;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "approved": return "check-circle";
    case "pending": return "clock-outline";
    case "rejected": return "close-circle";
    case "cancelled": return "cancel";
    default: return "help-circle-outline";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getLeaveTypeLabel(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LeaveIndexScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("my_leaves");
  const [refreshing, setRefreshing] = useState(false);

  const isManager = user?.roles?.some((r: string) =>
    ["admin", "manager", "hr", "hr_manager", "team_lead"].includes(r.toLowerCase())
  );

  // Queries
  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: () => leaveApi.getBalance(),
  });

  const {
    data: myLeavesData,
    isLoading: leavesLoading,
    refetch: refetchLeaves,
  } = useQuery({
    queryKey: ["leaves", "my"],
    queryFn: () => leaveApi.getMyLeaves({ page: 1 }),
    enabled: activeTab === "my_leaves",
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["leaves", "pending-approval"],
    queryFn: () => leaveApi.getAll({ page: 1, status: "pending" }),
    enabled: activeTab === "pending_approval" && !!isManager,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to cancel leave");
    },
  });

  // Approve/reject mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: "approved" | "rejected"; rejectionReason?: string }) =>
      leaveApi.approve(id, { status, rejectionReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to update leave");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const promises = [refetchBalance()];
    if (activeTab === "my_leaves") {
      promises.push(refetchLeaves());
    } else if (isManager) {
      promises.push(refetchPending());
    }
    await Promise.all(promises);
    setRefreshing(false);
  }, [activeTab, isManager, refetchBalance, refetchLeaves, refetchPending]);

  const handleCancel = (id: string) => {
    Alert.alert("Cancel Leave", "Are you sure you want to cancel this leave request?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  const handleQuickApprove = (id: string) => {
    Alert.alert("Approve Leave", "Approve this leave request?", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveMutation.mutate({ id, status: "approved" }) },
    ]);
  };

  const handleQuickReject = (id: string) => {
    Alert.alert("Reject Leave", "Reject this leave request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => approveMutation.mutate({ id, status: "rejected", rejectionReason: "Rejected by manager" }),
      },
    ]);
  };

  const renderBalanceCards = () => {
    const balances = balanceData?.data || [];
    if (balanceLoading) {
      return (
        <View style={styles.card}>
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        </View>
      );
    }

    if (balances.length === 0) {
      return (
        <View style={styles.card}>
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-remove-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No leave balances available</Text>
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.balanceScrollContent}
      >
        {balances.map((item: any, idx: number) => {
          const type = item.type || item.leaveType || "leave";
          const total = item.total ?? item.annualAllocation ?? 0;
          const used = item.used ?? (total - (item.remaining ?? item.balance ?? total));
          const remaining = item.remaining ?? item.balance ?? total;
          const color = LEAVE_TYPE_COLORS[type] || COLORS.primary;
          const icon = LEAVE_TYPE_ICONS[type] || "calendar-blank-outline";

          return (
            <View key={idx} style={styles.balanceCard}>
              <View style={styles.balanceCardHeader}>
                <View style={[styles.balanceIconCircle, { backgroundColor: color + "15" }]}>
                  <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                </View>
                <ProgressRing used={used} total={total} color={color} />
              </View>
              <Text style={styles.balanceCardType} numberOfLines={1}>
                {getLeaveTypeLabel(type)}
              </Text>
              <Text style={styles.balanceCardDetail}>
                {used} used of {total}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderLeaveCard = (leave: any, showActions: boolean = false) => {
    const statusColor = getStatusColor(leave.status);
    const typeColor = LEAVE_TYPE_COLORS[leave.leaveType || leave.type] || COLORS.primary;

    return (
      <TouchableOpacity
        key={leave._id}
        style={styles.leaveCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/leave/${leave._id}`)}
      >
        <View style={styles.leaveCardTop}>
          <View style={styles.leaveCardLeft}>
            <View style={[styles.leaveTypeBadge, { backgroundColor: typeColor + "15" }]}>
              <Text style={[styles.leaveTypeBadgeText, { color: typeColor }]}>
                {getLeaveTypeLabel(leave.leaveType || leave.type)}
              </Text>
            </View>
            <Text style={styles.leaveCardDates}>
              {formatDateShort(leave.startDate)} - {formatDateShort(leave.endDate)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "15" }]}>
            <MaterialCommunityIcons name={getStatusIcon(leave.status) as any} size={14} color={statusColor} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {leave.status}
            </Text>
          </View>
        </View>

        {leave.reason && (
          <Text style={styles.leaveCardReason} numberOfLines={2}>
            {leave.reason}
          </Text>
        )}

        {showActions && leave.employeeName && (
          <View style={styles.employeeRow}>
            <MaterialCommunityIcons name="account-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.employeeName}>{leave.employeeName || (leave.employee ? `${leave.employee.firstName || ''} ${leave.employee.lastName || ''}`.trim() : 'Unknown')}</Text>
          </View>
        )}

        {/* Action buttons */}
        {!showActions && leave.status === "pending" && (
          <View style={styles.leaveCardActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancel(leave._id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={14} color={COLORS.danger} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {showActions && (
          <View style={styles.approvalActions}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleQuickReject(leave._id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={16} color={COLORS.danger} />
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => handleQuickApprove(leave._id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMyLeaves = () => {
    if (leavesLoading) {
      return <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />;
    }
    const leaves = myLeavesData?.data || [];
    if (leaves.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Leave Requests</Text>
          <Text style={styles.emptyText}>You have not applied for any leaves yet.</Text>
        </View>
      );
    }
    return leaves.map((leave: any) => renderLeaveCard(leave, false));
  };

  const renderPendingApproval = () => {
    if (pendingLoading) {
      return <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />;
    }
    const leaves = pendingData?.data || [];
    if (leaves.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-all" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>All Caught Up</Text>
          <Text style={styles.emptyText}>No pending leave requests to review.</Text>
        </View>
      );
    }
    return leaves.map((leave: any) => renderLeaveCard(leave, true));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerContent}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Leave</Text>
              <View style={{ width: 40 }} />
            </View>

            {isManager && (
              <View style={styles.tabSwitcher}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "my_leaves" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("my_leaves")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={16}
                    color={activeTab === "my_leaves" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                  />
                  <Text style={[styles.tabBtnText, activeTab === "my_leaves" && styles.tabBtnTextActive]}>
                    My Leaves
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "pending_approval" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("pending_approval")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={16}
                    color={activeTab === "pending_approval" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                  />
                  <Text style={[styles.tabBtnText, activeTab === "pending_approval" && styles.tabBtnTextActive]}>
                    Approvals
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Cards */}
        {renderBalanceCards()}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeTab === "my_leaves" ? "My Requests" : "Pending Approvals"}
          </Text>
        </View>

        {/* Leave List */}
        {activeTab === "my_leaves" ? renderMyLeaves() : renderPendingApproval()}
      </ScrollView>

      {/* Apply Leave FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push("/leave/apply")}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingBottom: SPACING.md,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.md,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm + 2,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  tabBtnTextActive: {
    color: COLORS.primary,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl + 40,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  // Balance cards
  balanceScrollContent: {
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  balanceCard: {
    width: 130,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  balanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  balanceIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceCardType: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  balanceCardDetail: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  // Leave card
  leaveCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  leaveCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  leaveCardLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  leaveTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  leaveTypeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  leaveCardDates: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  leaveCardReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  employeeName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  leaveCardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dangerLight,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.danger,
  },
  approvalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.dangerLight,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.success,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl + SPACING.md,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    ...SHADOWS.colored(COLORS.primary),
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
