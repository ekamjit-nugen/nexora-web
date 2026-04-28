import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, TextInput, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Hero } from "../../components/Hero";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { leaveApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

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
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getLeaveTypeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDayCount(startDate: string, endDate: string, halfDay?: any): number {
  if (halfDay?.enabled) return 0.5;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

export default function LeaveDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [comment, setComment] = useState("");

  const isManager = user?.roles?.some((r: string) =>
    ["admin", "manager", "hr", "hr_manager", "team_lead"].includes(r.toLowerCase())
  );

  const { data: leaveData, isLoading } = useQuery({
    queryKey: ["leave", id],
    queryFn: () => leaveApi.getById(id as string),
    enabled: !!id,
  });
  const leave = leaveData?.data;
  const isOwnLeave = leave?.employee === user?._id || leave?.employee?._id === user?._id;
  const canCancel = isOwnLeave && leave?.status === "pending";
  const canApproveReject = isManager && leave?.status === "pending" && !isOwnLeave;

  // Cancel
  const cancelMutation = useMutation({
    mutationFn: () => leaveApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      Alert.alert("Cancelled", "Your leave request has been cancelled.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to cancel leave");
    },
  });

  // Approve
  const approveMutation = useMutation({
    mutationFn: (data: { status: "approved" | "rejected"; rejectionReason?: string }) =>
      leaveApi.approve(id!, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      Alert.alert(
        variables.status === "approved" ? "Approved" : "Rejected",
        `Leave request has been ${variables.status}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to update leave");
    },
  });

  const handleCancel = () => {
    Alert.alert("Cancel Leave", "Are you sure you want to cancel this leave request?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate() },
    ]);
  };

  const handleApprove = () => {
    approveMutation.mutate({ status: "approved" });
  };

  const handleReject = () => {
    if (!comment.trim()) {
      Alert.alert("Required", "Please provide a reason for rejection.");
      return;
    }
    approveMutation.mutate({ status: "rejected", rejectionReason: comment.trim() });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!leave) {
    return (
      <View style={styles.container}>
        <Hero title="Leave Detail" showBack />
        <View style={[styles.container, styles.centered]}>
          <MaterialCommunityIcons name="file-document-remove-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.notFoundText}>Leave request not found</Text>
        </View>
      </View>
    );
  }

  const typeColor = LEAVE_TYPE_COLORS[leave.leaveType || leave.type] || COLORS.primary;
  const statusColor = getStatusColor(leave.status);
  const days = getDayCount(leave.startDate, leave.endDate, leave.halfDay);

  return (
    <View style={styles.container}>
      <Hero title="Leave Detail" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Header Card */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusCircle, { backgroundColor: statusColor + "15" }]}>
              <MaterialCommunityIcons name={getStatusIcon(leave.status) as any} size={28} color={statusColor} />
            </View>
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
            </Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Type</Text>
              <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                  {getLeaveTypeLabel(leave.leaveType || leave.type)}
                </Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{days} day{days !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>

        {/* Dates Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="calendar-range" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Dates</Text>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>From</Text>
              <Text style={styles.dateValue}>{formatDate(leave.startDate)}</Text>
            </View>
            <View style={styles.dateSeparator}>
              <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.textMuted} />
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>To</Text>
              <Text style={styles.dateValue}>{formatDate(leave.endDate)}</Text>
            </View>
          </View>

          {leave.halfDay?.enabled && (
            <View style={styles.halfDayInfo}>
              <MaterialCommunityIcons name="clock-fast" size={16} color={COLORS.accent} />
              <Text style={styles.halfDayInfoText}>
                Half Day - {leave.halfDay.half === "first_half" ? "First Half" : "Second Half"}
              </Text>
            </View>
          )}
        </View>

        {/* Reason Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="text" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Reason</Text>
          </View>
          <Text style={styles.reasonText}>{leave.reason || "No reason provided"}</Text>
        </View>

        {/* Status Timeline */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="timeline-clock-outline" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Timeline</Text>
          </View>

          {/* Applied */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineBullet}>
              <View style={[styles.timelineDot, { backgroundColor: COLORS.primary }]} />
              {(leave.status !== "pending") && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Applied</Text>
              <Text style={styles.timelineDate}>
                {leave.createdAt ? formatDate(leave.createdAt) : "Date unknown"}
              </Text>
            </View>
          </View>

          {/* Outcome */}
          {leave.status !== "pending" && (
            <View style={styles.timelineItem}>
              <View style={styles.timelineBullet}>
                <View style={[styles.timelineDot, { backgroundColor: statusColor }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </Text>
                <Text style={styles.timelineDate}>
                  {leave.updatedAt ? formatDate(leave.updatedAt) : "Date unknown"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Manager comment */}
        {(leave.rejectionReason || leave.managerComment || leave.reviewComment) && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="comment-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Manager Comment</Text>
            </View>
            <Text style={styles.reasonText}>
              {leave.rejectionReason || leave.managerComment || leave.reviewComment}
            </Text>
          </View>
        )}

        {/* Cancel Button (for own pending leaves) */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
            activeOpacity={0.8}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <>
                <MaterialCommunityIcons name="close-circle-outline" size={20} color={COLORS.danger} />
                <Text style={styles.cancelButtonText}>Cancel Leave Request</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Approve/Reject Section (for managers) */}
        {canApproveReject && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="gavel" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Take Action</Text>
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Add a comment (required for rejection)..."
              style={styles.commentInput}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              theme={{ roundness: RADIUS.md }}
            />

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleReject}
                disabled={approveMutation.isPending}
                activeOpacity={0.8}
              >
                {approveMutation.isPending ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="close" size={18} color={COLORS.danger} />
                    <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.approveButton}
                onPress={handleApprove}
                disabled={approveMutation.isPending}
                activeOpacity={0.8}
              >
                {approveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  // Status header
  statusHeader: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  statusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  detailGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  detailItem: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  typeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Dates
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateItem: {
    flex: 1,
    gap: SPACING.xs,
  },
  dateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  dateSeparator: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.md,
  },
  halfDayInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  halfDayInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent,
  },
  // Reason
  reasonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  // Timeline
  timelineItem: {
    flexDirection: "row",
    marginBottom: SPACING.xs,
  },
  timelineBullet: {
    alignItems: "center",
    width: 24,
    marginRight: SPACING.sm,
    paddingTop: 5,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: SPACING.md,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // Not found
  notFoundText: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  // Cancel button
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dangerLight,
    ...SHADOWS.sm,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.danger,
  },
  // Approve/Reject
  commentInput: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerLight,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
    ...SHADOWS.colored(COLORS.success),
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
