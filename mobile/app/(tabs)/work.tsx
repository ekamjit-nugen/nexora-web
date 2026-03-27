import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { projectApi, taskApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

type Tab = "projects" | "tasks";

const PROJECT_STATUS: Record<string, { color: string; icon: string }> = {
  active: { color: COLORS.success, icon: "play-circle" },
  planning: { color: COLORS.info, icon: "lightbulb-outline" },
  on_hold: { color: COLORS.warning, icon: "pause-circle" },
  completed: { color: COLORS.textMuted, icon: "check-circle" },
  cancelled: { color: COLORS.danger, icon: "close-circle" },
};

const TASK_STATUS: Record<string, { color: string; icon: string }> = {
  todo: { color: COLORS.textSecondary, icon: "circle-outline" },
  in_progress: { color: COLORS.info, icon: "progress-clock" },
  review: { color: COLORS.warning, icon: "eye-outline" },
  done: { color: COLORS.success, icon: "check-circle" },
  blocked: { color: COLORS.danger, icon: "block-helper" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  urgent: { color: COLORS.danger, bg: COLORS.dangerLight },
  high: { color: COLORS.danger, bg: COLORS.dangerLight },
  medium: { color: COLORS.warning, bg: COLORS.warningLight },
  low: { color: COLORS.textSecondary, bg: COLORS.borderLight },
};

const FILTER_OPTIONS = ["all", "todo", "in_progress", "review", "done", "blocked"];

export default function WorkScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [refreshing, setRefreshing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<string>("all");

  const {
    data: projectsData,
    isLoading: projectsLoading,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectApi.getAll({ page: 1 }),
    enabled: activeTab === "projects",
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["tasks", taskFilter],
    queryFn: () =>
      taskApi.getAll({
        page: 1,
        status: taskFilter !== "all" ? taskFilter : undefined,
      }),
    enabled: activeTab === "tasks",
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "projects") await refetchProjects();
    else await refetchTasks();
    setRefreshing(false);
  }, [activeTab, refetchProjects, refetchTasks]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderProjectsTab = () => (
    <>
      {projectsLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <>
          {(projectsData?.data || []).map((project: any, idx: number) => {
            const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.active;
            return (
              <TouchableOpacity key={project._id || idx} activeOpacity={0.7}>
                <View style={styles.projectCard}>
                  <View style={[styles.projectAccent, { backgroundColor: status.color }]} />
                  <View style={styles.projectContent}>
                    <View style={styles.projectHeader}>
                      <Text style={styles.projectName} numberOfLines={1}>
                        {project.name}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: status.color + "15" }]}>
                        <MaterialCommunityIcons
                          name={status.icon as any}
                          size={13}
                          color={status.color}
                        />
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {(project.status || "unknown").replace("_", " ")}
                        </Text>
                      </View>
                    </View>

                    {project.description && (
                      <Text style={styles.projectDesc} numberOfLines={2}>
                        {project.description}
                      </Text>
                    )}

                    <View style={styles.projectMeta}>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons
                          name="calendar-clock"
                          size={14}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.metaText}>
                          {formatDate(project.endDate || project.dueDate)}
                        </Text>
                      </View>
                      {project.teamMembers && (
                        <View style={styles.metaItem}>
                          <MaterialCommunityIcons
                            name="account-group-outline"
                            size={14}
                            color={COLORS.textMuted}
                          />
                          <Text style={styles.metaText}>
                            {project.teamMembers.length} members
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {(!projectsData?.data || projectsData.data.length === 0) && (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="folder-open-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptySubtitle}>
                Projects assigned to you will appear here
              </Text>
            </View>
          )}
        </>
      )}
    </>
  );

  const renderTasksTab = () => (
    <>
      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map((status) => {
          const isActive = taskFilter === status;
          const config = status !== "all" ? TASK_STATUS[status] : null;
          return (
            <TouchableOpacity
              key={status}
              onPress={() => setTaskFilter(status)}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              activeOpacity={0.7}
            >
              {config && (
                <View style={[styles.filterDot, { backgroundColor: isActive ? COLORS.primary : config.color }]} />
              )}
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {status === "all"
                  ? "All"
                  : status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tasksLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <>
          {(tasksData?.data || []).map((task: any, idx: number) => {
            const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
            const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
            return (
              <TouchableOpacity key={task._id || idx} activeOpacity={0.7}>
                <View style={styles.taskCard}>
                  <View style={[styles.taskStatusIcon, { backgroundColor: status.color + "15" }]}>
                    <MaterialCommunityIcons
                      name={status.icon as any}
                      size={18}
                      color={status.color}
                    />
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {task.title || task.name}
                    </Text>
                    <Text style={styles.taskProject} numberOfLines={1}>
                      {task.project?.name || task.projectName || "No project"}
                    </Text>
                    <View style={styles.taskMeta}>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons
                          name="calendar-clock"
                          size={13}
                          color={COLORS.textMuted}
                        />
                        <Text style={styles.metaText}>
                          {formatDate(task.dueDate)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {priority && (
                    <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
                      <Text style={[styles.priorityText, { color: priority.color }]}>
                        {task.priority}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {(!tasksData?.data || tasksData.data.length === 0) && (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="checkbox-marked-circle-outline"
                size={48}
                color={COLORS.textMuted}
              />
              <Text style={styles.emptyTitle}>No tasks found</Text>
              <Text style={styles.emptySubtitle}>
                {taskFilter !== "all"
                  ? `No tasks with status "${taskFilter.replace("_", " ")}"`
                  : "Tasks assigned to you will appear here"}
              </Text>
            </View>
          )}
        </>
      )}
    </>
  );

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
            <Text style={styles.headerTitle}>Work</Text>
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "projects" && styles.tabBtnActive]}
                onPress={() => setActiveTab("projects")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="folder-outline"
                  size={16}
                  color={activeTab === "projects" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.tabBtnText, activeTab === "projects" && styles.tabBtnTextActive]}>
                  Projects
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "tasks" && styles.tabBtnActive]}
                onPress={() => setActiveTab("tasks")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="checkbox-marked-outline"
                  size={16}
                  color={activeTab === "tasks" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.tabBtnText, activeTab === "tasks" && styles.tabBtnTextActive]}>
                  Tasks
                </Text>
              </TouchableOpacity>
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
        {activeTab === "projects" ? renderProjectsTab() : renderTasksTab()}
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
    paddingBottom: SPACING.md,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
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
    paddingBottom: SPACING.xxl + 20,
  },
  loader: {
    marginVertical: SPACING.xxl,
  },
  // Projects
  projectCard: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm + 2,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  projectAccent: {
    width: 4,
  },
  projectContent: {
    flex: 1,
    padding: SPACING.md,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  projectName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  projectDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  projectMeta: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  // Filters
  filterScroll: {
    marginBottom: SPACING.md,
    maxHeight: 44,
  },
  filterContent: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  // Tasks
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm + 2,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  taskStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  taskProject: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  taskMeta: {
    flexDirection: "row",
    marginTop: SPACING.xs,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Empty
  emptyCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.xl + 8,
    backgroundColor: COLORS.surface,
    alignItems: "center",
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
});
