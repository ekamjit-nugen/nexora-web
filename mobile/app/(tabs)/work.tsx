import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Portal,
  Modal,
  Snackbar,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { taskApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const { width } = Dimensions.get("window");
const SUMMARY_CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.sm * 3) / 4;

interface MyWorkData {
  overdue: any[];
  dueToday: any[];
  inProgress: any[];
  readyToStart: any[];
  blocked: any[];
  upcomingThisSprint: any[];
  recentlyCompleted: any[];
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  urgent: { color: COLORS.danger, bg: COLORS.dangerLight, icon: "alert-circle" },
  high: { color: COLORS.danger, bg: COLORS.dangerLight, icon: "arrow-up-bold" },
  medium: { color: COLORS.warning, bg: COLORS.warningLight, icon: "minus" },
  low: { color: COLORS.textSecondary, bg: COLORS.borderLight, icon: "arrow-down" },
};

const STATUS_OPTIONS = [
  { key: "todo", label: "To Do", icon: "circle-outline", color: COLORS.textSecondary },
  { key: "in_progress", label: "In Progress", icon: "progress-clock", color: COLORS.info },
  { key: "review", label: "In Review", icon: "eye-outline", color: COLORS.warning },
  { key: "done", label: "Done", icon: "check-circle", color: COLORS.success },
];

interface SectionConfig {
  key: keyof MyWorkData;
  title: string;
  icon: string;
  accentColor: string;
  emptyText: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "overdue", title: "Overdue", icon: "alert-circle-outline", accentColor: COLORS.danger, emptyText: "No overdue tasks" },
  { key: "dueToday", title: "Due Today", icon: "calendar-today", accentColor: COLORS.warning, emptyText: "Nothing due today" },
  { key: "inProgress", title: "In Progress", icon: "progress-clock", accentColor: COLORS.info, emptyText: "No tasks in progress" },
  { key: "readyToStart", title: "Ready to Start", icon: "play-circle-outline", accentColor: COLORS.success, emptyText: "No tasks ready to start" },
  { key: "blocked", title: "Blocked", icon: "block-helper", accentColor: COLORS.danger, emptyText: "No blocked tasks" },
  { key: "upcomingThisSprint", title: "This Sprint", icon: "run-fast", accentColor: COLORS.textSecondary, emptyText: "No upcoming sprint tasks" },
  { key: "recentlyCompleted", title: "Recently Completed", icon: "check-circle-outline", accentColor: COLORS.success, emptyText: "No recently completed tasks" },
];

export default function WorkScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [snackMessage, setSnackMessage] = useState("");
  const [snackVisible, setSnackVisible] = useState(false);

  const {
    data: myWorkResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["myWork"],
    queryFn: () => taskApi.getMyWork(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      taskApi.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["myWork"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setStatusSheetVisible(false);
      setSelectedTask(null);
      const label = STATUS_OPTIONS.find((s) => s.key === variables.status)?.label || variables.status;
      setSnackMessage(`Task moved to ${label}`);
      setSnackVisible(true);
    },
    onError: (err: any) => {
      setSnackMessage(err.message || "Failed to update status");
      setSnackVisible(true);
    },
  });

  const myWork: MyWorkData = myWorkResponse?.data || {
    overdue: [],
    dueToday: [],
    inProgress: [],
    readyToStart: [],
    blocked: [],
    upcomingThisSprint: [],
    recentlyCompleted: [],
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLongPress = (task: any) => {
    setSelectedTask(task);
    setStatusSheetVisible(true);
  };

  const handleStatusChange = (status: string, task?: any) => {
    const targetTask = task || selectedTask;
    if (!targetTask) return;
    updateStatusMutation.mutate({ id: targetTask._id, status });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatDueDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDaysOverdue = (dateStr: string | undefined) => {
    if (!dateStr) return 0;
    const due = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getDueDateStyle = (dateStr: string | undefined) => {
    if (!dateStr) return { color: COLORS.textMuted };
    const due = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDay < today) return { color: COLORS.danger };
    if (dueDay.getTime() === today.getTime()) return { color: COLORS.warning };
    return { color: COLORS.textMuted };
  };

  // Summary counts
  const summaryCards = [
    { label: "Overdue", count: myWork.overdue.length, color: COLORS.danger, bg: COLORS.dangerLight, icon: "alert-circle" as const },
    { label: "Due Today", count: myWork.dueToday.length, color: COLORS.warning, bg: COLORS.warningLight, icon: "calendar-today" as const },
    { label: "In Progress", count: myWork.inProgress.length, color: COLORS.info, bg: COLORS.infoLight, icon: "progress-clock" as const },
    { label: "Blocked", count: myWork.blocked.length, color: COLORS.danger, bg: COLORS.dangerLight, icon: "block-helper" as const },
  ];

  const renderTaskCard = (task: any, sectionKey: keyof MyWorkData) => {
    const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
    const isCompleted = sectionKey === "recentlyCompleted";
    const isOverdue = sectionKey === "overdue";
    const isBlocked = sectionKey === "blocked";
    const daysOverdue = isOverdue ? getDaysOverdue(task.dueDate) : 0;

    return (
      <TouchableOpacity
        key={task._id}
        activeOpacity={0.7}
        onLongPress={() => handleLongPress(task)}
        delayLongPress={400}
      >
        <View style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}>
          {/* Priority dot */}
          {priority && (
            <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
          )}
          {!priority && <View style={[styles.priorityDot, { backgroundColor: COLORS.textMuted }]} />}

          <View style={styles.taskCardContent}>
            {/* Project name */}
            <Text style={styles.taskProject} numberOfLines={1}>
              {task.project?.name || task.projectName || "No project"}
              {task.key ? ` / ${task.key}` : ""}
            </Text>

            {/* Title */}
            <Text
              style={[
                styles.taskTitle,
                isCompleted && styles.taskTitleCompleted,
              ]}
              numberOfLines={2}
            >
              {task.title || task.name}
            </Text>

            {/* Meta row */}
            <View style={styles.taskMeta}>
              {/* Due date */}
              {task.dueDate && (
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={12}
                    color={getDueDateStyle(task.dueDate).color}
                  />
                  <Text style={[styles.metaText, getDueDateStyle(task.dueDate)]}>
                    {isOverdue && daysOverdue > 0
                      ? `${daysOverdue}d overdue`
                      : formatDueDate(task.dueDate)}
                  </Text>
                </View>
              )}

              {/* Story points */}
              {task.storyPoints != null && (
                <View style={styles.storyPointsBadge}>
                  <MaterialCommunityIcons
                    name="lightning-bolt"
                    size={10}
                    color={COLORS.accent}
                  />
                  <Text style={styles.storyPointsText}>{task.storyPoints}</Text>
                </View>
              )}

              {/* Priority badge */}
              {priority && (
                <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
                  <Text style={[styles.priorityText, { color: priority.color }]}>
                    {task.priority}
                  </Text>
                </View>
              )}
            </View>

            {/* Blocked reason */}
            {isBlocked && task.blockedReason && (
              <View style={styles.blockedReason}>
                <MaterialCommunityIcons name="alert-outline" size={12} color={COLORS.danger} />
                <Text style={styles.blockedReasonText} numberOfLines={1}>
                  {task.blockedReason}
                </Text>
              </View>
            )}
            {isBlocked && task.blockedBy && !task.blockedReason && (
              <View style={styles.blockedReason}>
                <MaterialCommunityIcons name="link-variant" size={12} color={COLORS.danger} />
                <Text style={styles.blockedReasonText} numberOfLines={1}>
                  Blocked by: {task.blockedBy?.title || task.blockedBy?.key || "another task"}
                </Text>
              </View>
            )}
          </View>

          {/* Swipe hint for overdue / due today */}
          {(isOverdue || sectionKey === "dueToday") && (
            <TouchableOpacity
              style={styles.quickDoneBtn}
              onPress={() => {
                handleStatusChange("done", task);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check" size={16} color={COLORS.success} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (config: SectionConfig) => {
    const tasks = myWork[config.key] || [];
    if (tasks.length === 0) return null;

    const isCollapsed = collapsedSections[config.key] || false;
    const isCompleted = config.key === "recentlyCompleted";

    return (
      <View key={config.key} style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(config.key)}
          activeOpacity={0.7}
        >
          <View style={[styles.sectionAccent, { backgroundColor: config.accentColor }]} />
          <MaterialCommunityIcons
            name={config.icon as any}
            size={18}
            color={config.accentColor}
          />
          <Text style={[styles.sectionTitle, isCompleted && styles.sectionTitleDimmed]}>
            {config.title}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: config.accentColor + "20" }]}>
            <Text style={[styles.countBadgeText, { color: config.accentColor }]}>
              {tasks.length}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={styles.sectionContent}>
            {tasks.map((task: any) => renderTaskCard(task, config.key))}
          </View>
        )}
      </View>
    );
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
            <Text style={styles.headerTitle}>My Work</Text>
            <Text style={styles.headerGreeting}>
              {getGreeting()}, {user?.firstName || "there"}
            </Text>
            <Text style={styles.headerDate}>{formatDate()}</Text>
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
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : (
          <>
            {/* Summary Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryRow}
              style={styles.summaryScroll}
            >
              {summaryCards.map((card) => (
                <View key={card.label} style={[styles.summaryCard, { borderTopColor: card.color }]}>
                  <View style={[styles.summaryIconCircle, { backgroundColor: card.bg }]}>
                    <MaterialCommunityIcons name={card.icon} size={18} color={card.color} />
                  </View>
                  <Text style={[styles.summaryCount, { color: card.color }]}>
                    {card.count}
                  </Text>
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Task Sections */}
            {SECTIONS.map(renderSection)}

            {/* Empty state if absolutely no tasks */}
            {Object.values(myWork).every((arr) => arr.length === 0) && (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="checkbox-marked-circle-outline"
                  size={48}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>
                  No tasks in your work queue right now
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Quick Status Change Bottom Sheet */}
      <Portal>
        <Modal
          visible={statusSheetVisible}
          onDismiss={() => {
            setStatusSheetVisible(false);
            setSelectedTask(null);
          }}
          contentContainerStyle={styles.bottomSheet}
        >
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Change Status</Text>
          {selectedTask && (
            <Text style={styles.bottomSheetTaskName} numberOfLines={1}>
              {selectedTask.title || selectedTask.name}
            </Text>
          )}
          <View style={styles.statusOptions}>
            {STATUS_OPTIONS.map((option) => {
              const isCurrentStatus = selectedTask?.status === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.statusOption,
                    isCurrentStatus && styles.statusOptionActive,
                  ]}
                  onPress={() => handleStatusChange(option.key)}
                  disabled={isCurrentStatus || updateStatusMutation.isPending}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusOptionIcon, { backgroundColor: option.color + "15" }]}>
                    <MaterialCommunityIcons
                      name={option.icon as any}
                      size={20}
                      color={option.color}
                    />
                  </View>
                  <Text
                    style={[
                      styles.statusOptionLabel,
                      isCurrentStatus && styles.statusOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isCurrentStatus && (
                    <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
                  )}
                  {updateStatusMutation.isPending &&
                    updateStatusMutation.variables?.status === option.key && (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.bottomSheetCancel}
            onPress={() => {
              setStatusSheetVisible(false);
              setSelectedTask(null);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.bottomSheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Modal>
      </Portal>

      {/* Toast */}
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        style={styles.snackbar}
        action={{
          label: "OK",
          onPress: () => setSnackVisible(false),
          textColor: COLORS.primary,
        }}
      >
        {snackMessage}
      </Snackbar>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerGreeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
    marginTop: SPACING.xs,
  },
  headerDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
  },
  loader: {
    marginVertical: SPACING.xxl,
  },

  // Summary cards
  summaryScroll: {
    marginBottom: SPACING.lg,
    marginHorizontal: -SPACING.lg,
  },
  summaryRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  summaryCard: {
    width: SUMMARY_CARD_WIDTH,
    minWidth: 80,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    alignItems: "center",
    borderTopWidth: 3,
    ...SHADOWS.sm,
  },
  summaryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  summaryCount: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },

  // Sections
  section: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  sectionAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  sectionTitleDimmed: {
    color: COLORS.textSecondary,
  },
  countBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    minWidth: 24,
    alignItems: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionContent: {
    gap: SPACING.sm,
  },

  // Task card
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  taskCardCompleted: {
    opacity: 0.6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 2,
  },
  taskCardContent: {
    flex: 1,
  },
  taskProject: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    color: COLORS.textSecondary,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xs + 2,
    gap: SPACING.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  storyPointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
    borderRadius: RADIUS.xs,
  },
  storyPointsText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.accent,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.xs + 3,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  blockedReason: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xs,
  },
  blockedReasonText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: "500",
    flex: 1,
  },
  quickDoneBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.successLight,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptyCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl + 8,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    marginTop: SPACING.lg,
    ...SHADOWS.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  // Bottom sheet
  bottomSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === "ios" ? SPACING.xxl : SPACING.lg,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  bottomSheetTaskName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  statusOptions: {
    gap: SPACING.xs,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  statusOptionActive: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  statusOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statusOptionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  statusOptionLabelActive: {
    color: COLORS.primary,
  },
  bottomSheetCancel: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  bottomSheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },

  // Snackbar
  snackbar: {
    backgroundColor: COLORS.text,
    borderRadius: RADIUS.md,
    marginBottom: Platform.OS === "ios" ? 90 : 70,
  },
});
