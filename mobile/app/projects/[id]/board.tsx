import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  FlatList,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { boardApi, projectApi, taskApi } from "../../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../../lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

interface BoardColumn {
  _id?: string;
  id?: string;
  name: string;
  key: string;
  order: number;
  wipLimit?: number;
  statusMapping?: string[];
  color?: string;
  isDoneColumn?: boolean;
  isStartColumn?: boolean;
}

interface BoardTask {
  _id: string;
  taskKey?: string;
  title: string;
  status: string;
  priority: string;
  assigneeId?: string;
  assignee?: { firstName?: string; lastName?: string; email?: string };
  storyPoints?: number;
  dueDate?: string;
  columnId?: string;
  type?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  high: COLORS.danger,
  medium: COLORS.warning,
  low: COLORS.textSecondary,
  trivial: COLORS.textMuted,
};

const PRIORITY_ORDER = ["critical", "high", "medium", "low", "trivial"];

const DEFAULT_COLUMN_COLORS: string[] = [
  COLORS.textSecondary,
  COLORS.info,
  COLORS.warning,
  COLORS.success,
  COLORS.danger,
  COLORS.secondary,
];

type FilterType = "all" | "assignee" | "priority";
type FilterValue = string;

export default function BoardScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [selectedTaskColumnId, setSelectedTaskColumnId] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [filterValue, setFilterValue] = useState<FilterValue>("");

  // Fetch project details
  const { data: projectData } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectApi.getById(projectId!),
    enabled: !!projectId,
  });

  // Fetch board for this project
  const {
    data: boardsData,
    isLoading: boardLoading,
    refetch: refetchBoard,
  } = useQuery({
    queryKey: ["boards", projectId],
    queryFn: () => boardApi.getByProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch tasks for this project
  const {
    data: tasksData,
    isLoading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["board-tasks", projectId],
    queryFn: () => boardApi.getTasksByProject(projectId!),
    enabled: !!projectId,
  });

  const board = boardsData?.data?.[0] || boardsData?.[0];
  const allTasks: BoardTask[] = tasksData?.data || tasksData || [];
  const project = projectData?.data || projectData;

  // Fallback columns if no board exists
  const columns: BoardColumn[] = useMemo(() => {
    if (board?.columns?.length) {
      return [...board.columns].sort((a, b) => a.order - b.order);
    }
    // Default columns based on task statuses
    return [
      { name: "To Do", key: "todo", order: 0, isStartColumn: true },
      { name: "In Progress", key: "in_progress", order: 1 },
      { name: "In Review", key: "in_review", order: 2 },
      { name: "Done", key: "done", order: 3, isDoneColumn: true },
    ];
  }, [board]);

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, BoardTask[]> = {};

    columns.forEach((col) => {
      const colId = col._id || col.id || col.key;
      grouped[colId] = [];
    });

    allTasks.forEach((task) => {
      // Match task to column by columnId or status mapping
      let matched = false;
      for (const col of columns) {
        const colId = col._id || col.id || col.key;
        if (task.columnId && (task.columnId === col._id || task.columnId === col.id)) {
          grouped[colId]?.push(task);
          matched = true;
          break;
        }
        if (col.statusMapping?.includes(task.status)) {
          grouped[colId]?.push(task);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Fall back: match by column key === task status
        for (const col of columns) {
          const colId = col._id || col.id || col.key;
          if (col.key === task.status) {
            grouped[colId]?.push(task);
            matched = true;
            break;
          }
        }
      }
      // If still no match, put in first column
      if (!matched && columns.length > 0) {
        const firstColId = columns[0]._id || columns[0].id || columns[0].key;
        grouped[firstColId]?.push(task);
      }
    });

    return grouped;
  }, [allTasks, columns]);

  // Apply filters
  const filteredTasksByColumn = useMemo(() => {
    if (activeFilter === "all") return tasksByColumn;

    const filtered: Record<string, BoardTask[]> = {};
    for (const [colId, tasks] of Object.entries(tasksByColumn)) {
      filtered[colId] = tasks.filter((task) => {
        if (activeFilter === "priority" && filterValue) {
          return task.priority === filterValue;
        }
        if (activeFilter === "assignee" && filterValue) {
          return task.assigneeId === filterValue;
        }
        return true;
      });
    }
    return filtered;
  }, [tasksByColumn, activeFilter, filterValue]);

  // Get unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    allTasks.forEach((task) => {
      if (task.assigneeId && !seen.has(task.assigneeId)) {
        const name = task.assignee
          ? `${task.assignee.firstName || ""} ${task.assignee.lastName || ""}`.trim()
          : task.assigneeId.slice(-6);
        seen.set(task.assigneeId, { id: task.assigneeId, name: name || "Unknown" });
      }
    });
    return Array.from(seen.values());
  }, [allTasks]);

  // Move task mutation
  const moveTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      fromColumnId,
      toColumnId,
    }: {
      taskId: string;
      fromColumnId: string;
      toColumnId: string;
    }) => {
      if (board?._id) {
        return boardApi.moveTask(board._id, taskId, { fromColumnId, toColumnId });
      }
      // Fallback: find the target column's status key and update task status
      const targetCol = columns.find(
        (c) => (c._id || c.id || c.key) === toColumnId
      );
      const newStatus = targetCol?.statusMapping?.[0] || targetCol?.key || "todo";
      return taskApi.updateStatus(taskId, newStatus);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["boards", projectId] });
    },
  });

  const handleMoveTask = (targetColumnId: string) => {
    if (!selectedTask || !selectedTaskColumnId) return;
    moveTaskMutation.mutate({
      taskId: selectedTask._id,
      fromColumnId: selectedTaskColumnId,
      toColumnId: targetColumnId,
    });
    setActionSheetVisible(false);
    setSelectedTask(null);
    setSelectedTaskColumnId(null);
  };

  const handleLongPressTask = (task: BoardTask, columnId: string) => {
    setSelectedTask(task);
    setSelectedTaskColumnId(columnId);
    setActionSheetVisible(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBoard(), refetchTasks()]);
    setRefreshing(false);
  }, [refetchBoard, refetchTasks]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeColumnIndex && index >= 0 && index < columns.length) {
      setActiveColumnIndex(index);
    }
  };

  const scrollToColumn = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveColumnIndex(index);
  };

  const getColumnColor = (col: BoardColumn, index: number): string => {
    return col.color || DEFAULT_COLUMN_COLORS[index % DEFAULT_COLUMN_COLORS.length];
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const getInitials = (task: BoardTask): string => {
    if (task.assignee?.firstName) {
      return (
        (task.assignee.firstName[0] || "") + (task.assignee.lastName?.[0] || "")
      ).toUpperCase();
    }
    return "?";
  };

  const isLoading = boardLoading || tasksLoading;

  const renderTaskCard = (task: BoardTask, columnId: string) => (
    <TouchableOpacity
      key={task._id}
      style={styles.taskCard}
      activeOpacity={0.7}
      onPress={() => {
        Alert.alert("Task Details", "Task detail view coming in a future update.");
      }}
      onLongPress={() => handleLongPressTask(task, columnId)}
      delayLongPress={400}
    >
      {/* Task key */}
      {task.taskKey && (
        <Text style={styles.taskKey}>{task.taskKey}</Text>
      )}

      {/* Title */}
      <Text style={styles.taskTitle} numberOfLines={2}>
        {task.title}
      </Text>

      {/* Bottom row: priority, story points, due date, assignee */}
      <View style={styles.taskFooter}>
        <View style={styles.taskFooterLeft}>
          {/* Priority dot */}
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: PRIORITY_COLORS[task.priority] || COLORS.textMuted },
            ]}
          />

          {/* Story points */}
          {task.storyPoints != null && task.storyPoints > 0 && (
            <View style={styles.storyPointsBadge}>
              <Text style={styles.storyPointsText}>{task.storyPoints}</Text>
            </View>
          )}

          {/* Due date */}
          {task.dueDate && (
            <Text
              style={[
                styles.taskDueDate,
                isOverdue(task.dueDate) && styles.taskDueDateOverdue,
              ]}
            >
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          )}
        </View>

        {/* Assignee avatar */}
        {task.assigneeId && (
          <View style={styles.assigneeAvatar}>
            <Text style={styles.assigneeInitials}>{getInitials(task)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderColumn = (col: BoardColumn, index: number) => {
    const colId = col._id || col.id || col.key;
    const colTasks = filteredTasksByColumn[colId] || [];
    const colColor = getColumnColor(col, index);
    const isWipExceeded = col.wipLimit != null && col.wipLimit > 0 && colTasks.length > col.wipLimit;

    return (
      <View key={colId} style={styles.columnContainer}>
        <View style={styles.column}>
          {/* Column header */}
          <View style={styles.columnHeader}>
            <View style={styles.columnHeaderLeft}>
              <View style={[styles.columnColorDot, { backgroundColor: colColor }]} />
              <Text style={styles.columnName}>{col.name}</Text>
              <View style={styles.taskCountBadge}>
                <Text style={styles.taskCountText}>{colTasks.length}</Text>
              </View>
            </View>
            {col.wipLimit != null && col.wipLimit > 0 && (
              <View
                style={[
                  styles.wipBadge,
                  isWipExceeded && styles.wipBadgeExceeded,
                ]}
              >
                <MaterialCommunityIcons
                  name={isWipExceeded ? "alert" : "speedometer"}
                  size={12}
                  color={isWipExceeded ? COLORS.danger : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.wipText,
                    isWipExceeded && styles.wipTextExceeded,
                  ]}
                >
                  {colTasks.length}/{col.wipLimit}
                </Text>
              </View>
            )}
          </View>

          {/* Tasks list */}
          <ScrollView
            style={styles.columnTasksList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.columnTasksContent}
          >
            {colTasks.length > 0 ? (
              colTasks.map((task) => renderTaskCard(task, colId))
            ) : (
              <View style={styles.emptyColumn}>
                <MaterialCommunityIcons
                  name="inbox-outline"
                  size={32}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyColumnText}>No tasks</Text>
              </View>
            )}
          </ScrollView>
        </View>
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
            <View style={styles.headerRow}>
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

              <View style={styles.headerTitleBlock}>
                <Text style={styles.headerProjectName} numberOfLines={1}>
                  {project?.name || "Project"}
                </Text>
                <Text style={styles.headerBoardLabel}>Board</Text>
              </View>

              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setFilterVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={22}
                  color={activeFilter !== "all" ? COLORS.warning : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Column indicator dots */}
      {columns.length > 1 && (
        <View style={styles.dotIndicatorContainer}>
          {columns.map((col, idx) => (
            <TouchableOpacity
              key={col._id || col.id || col.key}
              onPress={() => scrollToColumn(idx)}
              style={styles.dotTouchArea}
            >
              <View
                style={[
                  styles.dot,
                  idx === activeColumnIndex && styles.dotActive,
                  idx === activeColumnIndex && {
                    backgroundColor: getColumnColor(col, idx),
                  },
                ]}
              />
              <Text
                style={[
                  styles.dotLabel,
                  idx === activeColumnIndex && styles.dotLabelActive,
                ]}
                numberOfLines={1}
              >
                {col.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Board content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading board...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          style={styles.boardScroll}
        >
          {columns.map((col, idx) => renderColumn(col, idx))}
        </ScrollView>
      )}

      {/* Move Task Bottom Sheet */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setActionSheetVisible(false)}
        >
          <View />
        </Pressable>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Move Task</Text>
          {selectedTask && (
            <Text style={styles.sheetTaskName} numberOfLines={2}>
              {selectedTask.title}
            </Text>
          )}
          <View style={styles.sheetDivider} />
          <Text style={styles.sheetSectionLabel}>Move to column:</Text>
          {columns.map((col, idx) => {
            const colId = col._id || col.id || col.key;
            const isCurrent = colId === selectedTaskColumnId;
            const colColor = getColumnColor(col, idx);
            return (
              <TouchableOpacity
                key={colId}
                style={[
                  styles.sheetOption,
                  isCurrent && styles.sheetOptionCurrent,
                ]}
                onPress={() => {
                  if (!isCurrent) handleMoveTask(colId);
                }}
                disabled={isCurrent || moveTaskMutation.isPending}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetOptionDot, { backgroundColor: colColor }]} />
                <Text
                  style={[
                    styles.sheetOptionText,
                    isCurrent && styles.sheetOptionTextCurrent,
                  ]}
                >
                  {col.name}
                </Text>
                {isCurrent && (
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color={COLORS.primary}
                  />
                )}
                {moveTaskMutation.isPending && !isCurrent && (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={() => setActionSheetVisible(false)}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Filter Bottom Sheet */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setFilterVisible(false)}
        >
          <View />
        </Pressable>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filter Tasks</Text>
          <View style={styles.sheetDivider} />

          {/* Clear filter */}
          <TouchableOpacity
            style={[styles.sheetOption, activeFilter === "all" && styles.sheetOptionCurrent]}
            onPress={() => {
              setActiveFilter("all");
              setFilterValue("");
              setFilterVisible(false);
            }}
          >
            <MaterialCommunityIcons name="filter-off" size={18} color={COLORS.textSecondary} />
            <Text style={styles.sheetOptionText}>Show all tasks</Text>
            {activeFilter === "all" && (
              <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>

          <View style={styles.sheetDivider} />
          <Text style={styles.sheetSectionLabel}>By Priority</Text>
          {PRIORITY_ORDER.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.sheetOption,
                activeFilter === "priority" && filterValue === p && styles.sheetOptionCurrent,
              ]}
              onPress={() => {
                setActiveFilter("priority");
                setFilterValue(p);
                setFilterVisible(false);
              }}
            >
              <View
                style={[styles.sheetOptionDot, { backgroundColor: PRIORITY_COLORS[p] }]}
              />
              <Text style={styles.sheetOptionText}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
              {activeFilter === "priority" && filterValue === p && (
                <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}

          {uniqueAssignees.length > 0 && (
            <>
              <View style={styles.sheetDivider} />
              <Text style={styles.sheetSectionLabel}>By Assignee</Text>
              {uniqueAssignees.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.sheetOption,
                    activeFilter === "assignee" && filterValue === a.id && styles.sheetOptionCurrent,
                  ]}
                  onPress={() => {
                    setActiveFilter("assignee");
                    setFilterValue(a.id);
                    setFilterVisible(false);
                  }}
                >
                  <View style={styles.sheetAssigneeIcon}>
                    <Text style={styles.sheetAssigneeInitial}>
                      {a.name[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text style={styles.sheetOptionText}>{a.name}</Text>
                  {activeFilter === "assignee" && filterValue === a.id && (
                    <MaterialCommunityIcons name="check" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={() => setFilterVisible(false)}
          >
            <Text style={styles.sheetCancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
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
    gap: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerProjectName: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.2,
  },
  headerBoardLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Dot indicators
  dotIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dotTouchArea: {
    alignItems: "center",
    paddingHorizontal: SPACING.xs + 2,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginBottom: 4,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  dotLabelActive: {
    color: COLORS.text,
    fontWeight: "700",
  },

  // Board scroll
  boardScroll: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Column
  columnContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  column: {
    flex: 1,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  columnHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  columnColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  taskCountBadge: {
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  taskCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  wipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.borderLight,
  },
  wipBadgeExceeded: {
    backgroundColor: COLORS.dangerLight,
  },
  wipText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  wipTextExceeded: {
    color: COLORS.danger,
    fontWeight: "700",
  },

  // Column tasks list
  columnTasksList: {
    flex: 1,
  },
  columnTasksContent: {
    padding: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },

  // Empty column
  emptyColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xxl,
  },
  emptyColumnText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Task card
  taskCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  taskKey: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
    letterSpacing: -0.1,
  },
  taskFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  taskFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storyPointsBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  storyPointsText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },
  taskDueDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  taskDueDateOverdue: {
    color: COLORS.danger,
    fontWeight: "700",
  },
  assigneeAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeInitials: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    maxHeight: "70%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.xs,
    letterSpacing: -0.3,
  },
  sheetTaskName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: 2,
  },
  sheetOptionCurrent: {
    backgroundColor: COLORS.primaryLight,
  },
  sheetOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
    flex: 1,
  },
  sheetOptionTextCurrent: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  sheetAssigneeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetAssigneeInitial: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  sheetCancel: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
});
