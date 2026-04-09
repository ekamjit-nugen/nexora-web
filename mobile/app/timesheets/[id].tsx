import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Button,
  TextInput,
  Portal,
  Modal,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { timesheetApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft: { label: "Draft", color: COLORS.textSecondary, bg: COLORS.borderLight, icon: "pencil-outline" },
  submitted: { label: "Submitted", color: COLORS.warning, bg: COLORS.warningLight, icon: "clock-outline" },
  approved: { label: "Approved", color: COLORS.success, bg: COLORS.successLight, icon: "check-circle" },
  rejected: { label: "Rejected", color: COLORS.danger, bg: COLORS.dangerLight, icon: "close-circle" },
  revision_requested: { label: "Revision Needed", color: COLORS.warning, bg: COLORS.warningLight, icon: "alert-circle-outline" },
};

const categoryColors: Record<string, { color: string; bg: string }> = {
  development: { color: COLORS.primary, bg: COLORS.primaryLight },
  design: { color: COLORS.secondary, bg: COLORS.secondaryLight },
  meeting: { color: COLORS.warning, bg: COLORS.warningLight },
  review: { color: COLORS.info, bg: COLORS.infoLight },
  testing: { color: COLORS.success, bg: COLORS.successLight },
  documentation: { color: COLORS.textSecondary, bg: COLORS.borderLight },
  admin: { color: COLORS.warning, bg: COLORS.warningLight },
  training: { color: COLORS.secondary, bg: COLORS.secondaryLight },
  other: { color: COLORS.textMuted, bg: COLORS.borderLight },
};

function formatWeekLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} - ${endStr}`;
}

function formatEntryDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TimesheetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "revision_requested">("approved");
  const [reviewComment, setReviewComment] = useState("");

  const isManager = user?.roles?.some((r: string) =>
    ["admin", "manager", "hr_manager", "org_admin"].includes(r)
  );

  const {
    data: timesheetRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["timesheets", id],
    queryFn: () => timesheetApi.getById(id!),
    enabled: !!id,
  });

  const timesheet = timesheetRes?.data;

  const submitMutation = useMutation({
    mutationFn: () => timesheetApi.submit(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      Alert.alert("Submitted", "Your timesheet has been submitted for review.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to submit timesheet");
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: () => {
      const startDate = timesheet?.period?.startDate || timesheet?.startDate;
      const endDate = timesheet?.period?.endDate || timesheet?.endDate;
      return timesheetApi.autoPopulate({ startDate, endDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", id] });
      Alert.alert("Populated", "Timesheet entries have been auto-populated from your tasks.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to auto-populate");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { status: string; reviewComment?: string }) =>
      timesheetApi.review(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setReviewModalVisible(false);
      setReviewComment("");
      Alert.alert("Done", `Timesheet has been ${reviewAction === "approved" ? "approved" : reviewAction === "rejected" ? "rejected" : "sent back for revision"}.`);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to review timesheet");
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSubmit = () => {
    Alert.alert(
      "Submit Timesheet",
      "Are you sure you want to submit this timesheet for review?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Submit", onPress: () => submitMutation.mutate() },
      ]
    );
  };

  const handleReviewAction = (action: "approved" | "rejected" | "revision_requested") => {
    setReviewAction(action);
    if (action === "approved") {
      Alert.alert(
        "Approve Timesheet",
        "Are you sure you want to approve this timesheet?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            onPress: () => reviewMutation.mutate({ status: "approved" }),
          },
        ]
      );
    } else {
      setReviewModalVisible(true);
    }
  };

  const handleSubmitReview = () => {
    if ((reviewAction === "rejected" || reviewAction === "revision_requested") && !reviewComment.trim()) {
      Alert.alert("Required", "Please provide a comment.");
      return;
    }
    reviewMutation.mutate({
      status: reviewAction,
      reviewComment: reviewComment.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!timesheet) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>Timesheet not found</Text>
        <Button mode="text" onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  const status = timesheet.status || "draft";
  const cfg = statusConfig[status] || statusConfig.draft;
  const startDate = timesheet.period?.startDate || timesheet.startDate;
  const endDate = timesheet.period?.endDate || timesheet.endDate;
  const entries = timesheet.entries || [];
  const totalHours = timesheet.totalHours ?? entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const expectedHours = timesheet.expectedHours || 40;
  const progress = Math.min(totalHours / expectedHours, 1);
  const isOwner = timesheet.employee?._id === user?._id || timesheet.employeeId === user?._id;
  const canReview = isManager && !isOwner && status === "submitted";

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
            <View style={styles.headerTopRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Timesheet</Text>
              <View style={{ width: 36 }} />
            </View>
            {startDate && endDate && (
              <Text style={styles.headerSubtitle}>{formatWeekLabel(startDate, endDate)}</Text>
            )}
            <View style={[styles.headerBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <MaterialCommunityIcons name={cfg.icon as any} size={14} color="#FFFFFF" />
              <Text style={styles.headerBadgeText}>{cfg.label}</Text>
            </View>
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
        {/* Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="chart-arc" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Summary</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLORS.primary }]}>{totalHours.toFixed(1)}h</Text>
              <Text style={styles.summaryLabel}>Logged</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLORS.textSecondary }]}>{expectedHours}h</Text>
              <Text style={styles.summaryLabel}>Expected</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>{entries.length}</Text>
              <Text style={styles.summaryLabel}>Entries</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: progress >= 1 ? COLORS.success : COLORS.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>

        {/* Status Messages */}
        {status === "submitted" && isOwner && (
          <View style={[styles.infoBar, { backgroundColor: COLORS.warningLight }]}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.warning} />
            <Text style={[styles.infoBarText, { color: COLORS.warning }]}>Waiting for manager approval</Text>
          </View>
        )}

        {status === "approved" && (
          <View style={[styles.infoBar, { backgroundColor: COLORS.successLight }]}>
            <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBarText, { color: COLORS.success }]}>
                Approved{timesheet.reviewedBy ? ` by ${timesheet.reviewedBy.firstName || "Manager"}` : ""}
              </Text>
              {timesheet.reviewedAt && (
                <Text style={[styles.infoBarSubtext, { color: COLORS.success }]}>
                  {new Date(timesheet.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              )}
            </View>
          </View>
        )}

        {(status === "rejected" || status === "revision_requested") && (
          <View style={[styles.infoBar, { backgroundColor: COLORS.dangerLight }]}>
            <MaterialCommunityIcons
              name={status === "rejected" ? "close-circle" : "alert-circle-outline"}
              size={18}
              color={COLORS.danger}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBarText, { color: COLORS.danger }]}>
                {status === "rejected" ? "Rejected" : "Revision requested"}
              </Text>
              {timesheet.reviewComment && (
                <Text style={[styles.infoBarSubtext, { color: COLORS.danger }]}>
                  "{timesheet.reviewComment}"
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Entries */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="format-list-bulleted" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Entries</Text>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyEntries}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyEntriesText}>No entries yet</Text>
              {status === "draft" && (
                <Text style={styles.emptyEntriesSubtext}>
                  Use "Auto-Populate" to fill from your tasks
                </Text>
              )}
            </View>
          ) : (
            entries.map((entry: any, idx: number) => {
              const cat = entry.category || "other";
              const catStyle = categoryColors[cat] || categoryColors.other;
              return (
                <View
                  key={entry._id || idx}
                  style={[styles.entryRow, idx < entries.length - 1 && styles.entryBorder]}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryDate}>
                      {entry.date ? formatEntryDate(entry.date) : `Entry ${idx + 1}`}
                    </Text>
                    <View style={styles.entryHoursBadge}>
                      <Text style={styles.entryHoursText}>{(entry.hours || 0).toFixed(1)}h</Text>
                    </View>
                  </View>

                  {(entry.taskName || entry.task?.name) && (
                    <Text style={styles.entryTask} numberOfLines={1}>
                      {entry.taskName || entry.task?.name}
                    </Text>
                  )}

                  {(entry.projectName || entry.project?.name) && (
                    <Text style={styles.entryProject} numberOfLines={1}>
                      {entry.projectName || entry.project?.name}
                    </Text>
                  )}

                  <View style={styles.entryFooter}>
                    <View style={[styles.categoryBadge, { backgroundColor: catStyle.bg }]}>
                      <Text style={[styles.categoryText, { color: catStyle.color }]}>{cat}</Text>
                    </View>
                    {entry.description ? (
                      <Text style={styles.entryDesc} numberOfLines={2}>{entry.description}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Actions */}
        {status === "draft" && isOwner && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => autoPopulateMutation.mutate()}
              disabled={autoPopulateMutation.isPending}
              activeOpacity={0.7}
            >
              {autoPopulateMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={18} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Auto-Populate</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleSubmit}
              disabled={submitMutation.isPending || entries.length === 0}
              activeOpacity={0.7}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Submit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {(status === "rejected" || status === "revision_requested") && isOwner && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={() => autoPopulateMutation.mutate()}
              disabled={autoPopulateMutation.isPending}
              activeOpacity={0.7}
            >
              {autoPopulateMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={18} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Revise</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleSubmit}
              disabled={submitMutation.isPending}
              activeOpacity={0.7}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Re-submit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {canReview && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success, flex: 1 }]}
              onPress={() => handleReviewAction("approved")}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.warningLight, flex: 1 }]}
              onPress={() => handleReviewAction("revision_requested")}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="pencil" size={18} color={COLORS.warning} />
              <Text style={[styles.actionBtnText, { color: COLORS.warning }]}>Revise</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.dangerLight, flex: 1 }]}
              onPress={() => handleReviewAction("rejected")}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={18} color={COLORS.danger} />
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Review Comment Modal */}
      <Portal>
        <Modal
          visible={reviewModalVisible}
          onDismiss={() => { setReviewModalVisible(false); setReviewComment(""); }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {reviewAction === "rejected" ? "Reject Timesheet" : "Request Revision"}
            </Text>
            <TouchableOpacity onPress={() => { setReviewModalVisible(false); setReviewComment(""); }}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <TextInput
            label="Comment"
            value={reviewComment}
            onChangeText={setReviewComment}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={reviewAction === "rejected" ? COLORS.danger : COLORS.warning}
            placeholder="Provide feedback..."
            theme={{ roundness: RADIUS.md }}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => { setReviewModalVisible(false); setReviewComment(""); }}
              style={styles.modalBtnOutline}
              textColor={COLORS.textSecondary}
              theme={{ roundness: RADIUS.md }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmitReview}
              loading={reviewMutation.isPending}
              disabled={reviewMutation.isPending}
              buttonColor={reviewAction === "rejected" ? COLORS.danger : COLORS.warning}
              theme={{ roundness: RADIUS.md }}
            >
              {reviewAction === "rejected" ? "Reject" : "Request Revision"}
            </Button>
          </View>
        </Modal>
      </Portal>
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
    paddingBottom: SPACING.lg,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
    ...SHADOWS.md,
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
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    width: 36,
    textAlign: "right",
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  infoBarText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoBarSubtext: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
    fontStyle: "italic",
  },
  emptyEntries: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyEntriesText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyEntriesSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  entryRow: {
    paddingVertical: SPACING.md,
  },
  entryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  entryDate: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  entryHoursBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  entryHoursText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  entryTask: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 2,
  },
  entryProject: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  entryFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  entryDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
  },
  actionsCard: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 48,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
  },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  modalInput: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalBtnOutline: {
    borderColor: COLORS.border,
  },
});
