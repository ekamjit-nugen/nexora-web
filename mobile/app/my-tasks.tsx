import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  TextInput,
  ActivityIndicator,
  Portal,
  Modal,
  Switch,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { taskApi, employeeApi } from "../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../lib/theme";
import { Hero } from "../components/Hero";

// ─────────────────────────────────────────────────────────────────────────────
// My Tasks — personal todo list scoped to the current user.
//
// Backed by GET /tasks/personal + POST /tasks (with isPersonal=true). These
// are tasks with no project attached: a lightweight productivity surface
// that lets a user track their own work without setting up a board, sprint,
// or project structure. Optional collaborators field lets the user invite
// teammates to specific items.
//
// Why a dedicated screen rather than reusing /tasks: that surface is the
// project-task index and assumes a projectId filter; this is the user's
// "my todos" — different mental model, different empty/error states.
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_TONES: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: COLORS.dangerLight,  fg: COLORS.danger,  label: "Critical" },
  high:     { bg: "#FFEDD5",            fg: "#C2410C",      label: "High" },
  medium:   { bg: COLORS.toneIndigo.bg, fg: COLORS.toneIndigo.fg, label: "Medium" },
  low:      { bg: COLORS.surfaceMuted,  fg: COLORS.textSecondary, label: "Low" },
  trivial:  { bg: COLORS.surfaceMuted,  fg: COLORS.textMuted, label: "Trivial" },
};

const STATUS_FLOW: Record<string, { next: string; nextLabel: string; color: string }> = {
  backlog:     { next: "in_progress", nextLabel: "Start",    color: COLORS.textSecondary },
  todo:        { next: "in_progress", nextLabel: "Start",    color: COLORS.textSecondary },
  in_progress: { next: "done",        nextLabel: "Complete", color: COLORS.warning },
  in_review:   { next: "done",        nextLabel: "Complete", color: COLORS.warning },
  blocked:     { next: "in_progress", nextLabel: "Resume",   color: COLORS.danger },
  done:        { next: "todo",        nextLabel: "Reopen",   color: COLORS.success },
  cancelled:   { next: "todo",        nextLabel: "Reopen",   color: COLORS.textMuted },
};

function formatDueDate(d?: string): { label: string; color: string } {
  if (!d) return { label: "No due date", color: COLORS.textMuted };
  const due = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: `Overdue · ${Math.abs(diff)}d`, color: COLORS.danger };
  if (diff === 0) return { label: "Due today", color: COLORS.warning };
  if (diff === 1) return { label: "Due tomorrow", color: COLORS.warning };
  if (diff < 7) return { label: `Due in ${diff}d`, color: COLORS.textSecondary };
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    color: COLORS.textSecondary,
  };
}

export default function MyTasksScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"open" | "done">("open");

  const {
    data: tasksData,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["tasks", "personal"],
    queryFn: () => taskApi.getPersonal(),
    retry: 1,
  });

  const allTasks: any[] = Array.isArray(tasksData?.data) ? tasksData.data : [];
  const tasks = allTasks.filter((t) =>
    filter === "done"
      ? t.status === "done" || t.status === "cancelled"
      : t.status !== "done" && t.status !== "cancelled",
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ─── Create modal ────────────────────────────────────────────────
  const [createVisible, setCreateVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"critical" | "high" | "medium" | "low" | "trivial">("medium");
  const [dueDate, setDueDate] = useState("");
  const [includeCollaborators, setIncludeCollaborators] = useState(false);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  // Lazy-load directory only when the collaborator section is opened —
  // most personal tasks won't need the picker.
  const { data: directoryData } = useQuery({
    queryKey: ["employees", "directory"],
    queryFn: () => employeeApi.getAll({ page: 1 }),
    enabled: createVisible && includeCollaborators,
    retry: 1,
  });
  const employees: any[] = Array.isArray(directoryData?.data) ? directoryData.data : [];

  useEffect(() => {
    if (createVisible) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setIncludeCollaborators(false);
      setCollaboratorIds([]);
      setFormError("");
    }
  }, [createVisible]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof taskApi.createPersonal>[0]) =>
      taskApi.createPersonal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "personal"] });
      setCreateVisible(false);
    },
    onError: (err: any) =>
      setFormError(err?.message || "Failed to create task. Try again."),
  });

  const handleCreate = () => {
    setFormError("");
    if (title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }
    const payload: Parameters<typeof taskApi.createPersonal>[0] = {
      title: title.trim(),
      priority,
    };
    if (description.trim()) payload.description = description.trim();
    if (dueDate.trim()) {
      // Validate YYYY-MM-DD; let server reject other shapes.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
        setFormError("Due date must be in YYYY-MM-DD format.");
        return;
      }
      payload.dueDate = dueDate.trim();
    }
    if (includeCollaborators && collaboratorIds.length > 0) {
      payload.collaborators = collaboratorIds;
    }
    createMutation.mutate(payload);
  };

  // ─── Status toggle ───────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      taskApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "personal"] }),
    onError: (err: any) =>
      Alert.alert("Couldn't update", err?.message || "Please try again."),
  });

  const advanceStatus = (task: any) => {
    const flow = STATUS_FLOW[task.status] || STATUS_FLOW.todo;
    updateMutation.mutate({ id: task._id, status: flow.next });
  };

  // ─── Delete ──────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "personal"] }),
    onError: (err: any) =>
      Alert.alert("Couldn't delete", err?.message || "Please try again."),
  });

  const confirmDelete = (task: any) => {
    Alert.alert(
      "Delete task?",
      `"${task.title}" will be removed.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(task._id),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Hero
        title="My Tasks"
        subtitle={
          isLoading
            ? "Loading…"
            : `${allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length} open`
        }
        showBack
      />

      {/* Filter pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, filter === "open" && styles.filterPillActive]}
          onPress={() => setFilter("open")}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterPillText, filter === "open" && styles.filterPillTextActive]}>
            Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterPill, filter === "done" && styles.filterPillActive]}
          onPress={() => setFilter("done")}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterPillText, filter === "done" && styles.filterPillTextActive]}>
            Done
          </Text>
        </TouchableOpacity>
      </View>

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
          <View style={[styles.card, styles.errorRow]}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color={COLORS.danger}
            />
            <Text style={styles.errorText}>
              {(error as any)?.message || "Couldn't load tasks. Pull to retry."}
            </Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name={filter === "done" ? "check-decagram" : "clipboard-text-outline"}
              size={48}
              color={filter === "done" ? COLORS.success : COLORS.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {filter === "done" ? "Nothing completed yet" : "No tasks yet"}
            </Text>
            <Text style={styles.emptyBody}>
              {filter === "done"
                ? "Tasks you complete will show up here."
                : "Tap the + button to add your first personal task. No project, no client — just you and your todo."}
            </Text>
          </View>
        ) : (
          tasks.map((task: any) => {
            const tone = PRIORITY_TONES[task.priority] || PRIORITY_TONES.medium;
            const flow = STATUS_FLOW[task.status] || STATUS_FLOW.todo;
            const due = formatDueDate(task.dueDate);
            const isComplete = task.status === "done" || task.status === "cancelled";
            return (
              <View key={task._id} style={styles.taskCard}>
                <TouchableOpacity
                  style={styles.checkBtn}
                  onPress={() => advanceStatus(task)}
                  activeOpacity={0.7}
                  disabled={updateMutation.isPending}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      isComplete && styles.checkCircleDone,
                    ]}
                  >
                    {isComplete && (
                      <MaterialCommunityIcons
                        name="check"
                        size={14}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.taskBody}>
                  <Text
                    style={[
                      styles.taskTitle,
                      isComplete && styles.taskTitleDone,
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  {task.description ? (
                    <Text style={styles.taskDesc} numberOfLines={2}>
                      {task.description}
                    </Text>
                  ) : null}
                  <View style={styles.taskMeta}>
                    <View style={[styles.priorityChip, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.priorityText, { color: tone.fg }]}>
                        {tone.label}
                      </Text>
                    </View>
                    {task.dueDate ? (
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons
                          name="calendar-outline"
                          size={12}
                          color={due.color}
                        />
                        <Text style={[styles.metaText, { color: due.color }]}>
                          {due.label}
                        </Text>
                      </View>
                    ) : null}
                    {Array.isArray(task.collaborators) && task.collaborators.length > 0 ? (
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons
                          name="account-multiple-outline"
                          size={12}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.metaText}>
                          {task.collaborators.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => confirmDelete(task)}
                  style={styles.deleteBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name="dots-horizontal"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Add button — gradient pill matching the global CTA tone. */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => setCreateVisible(true)}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          <Text style={styles.fabText}>New Task</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── Create modal ────────────────────────────────────────── */}
      <Portal>
        <Modal
          visible={createVisible}
          onDismiss={() => !createMutation.isPending && setCreateVisible(false)}
          contentContainerStyle={styles.modalCard}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity
                onPress={() => !createMutation.isPending && setCreateVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 480 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                label="Title"
                value={title}
                onChangeText={setTitle}
                mode="outlined"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                left={<TextInput.Icon icon="format-title" />}
                theme={{ roundness: RADIUS.md }}
                maxLength={120}
                autoFocus
              />
              <TextInput
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                multiline
                numberOfLines={3}
                left={<TextInput.Icon icon="text" />}
                theme={{ roundness: RADIUS.md }}
              />
              <TextInput
                label="Due Date (YYYY-MM-DD)"
                value={dueDate}
                onChangeText={setDueDate}
                mode="outlined"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                left={<TextInput.Icon icon="calendar" />}
                placeholder="Optional · 2026-05-15"
                theme={{ roundness: RADIUS.md }}
                keyboardType="numbers-and-punctuation"
              />

              {/* Priority chips */}
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {(["critical", "high", "medium", "low"] as const).map((p) => {
                  const t = PRIORITY_TONES[p];
                  const active = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityOption,
                        active && { backgroundColor: t.fg },
                      ]}
                      onPress={() => setPriority(p)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.priorityOptionText,
                          { color: active ? "#FFFFFF" : t.fg },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Collaborators toggle */}
              <View style={styles.collabHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Add collaborators</Text>
                  <Text style={styles.fieldCaption}>
                    Optional — share this task with teammates so they can
                    view, comment, and update status.
                  </Text>
                </View>
                <Switch
                  value={includeCollaborators}
                  onValueChange={(v) => {
                    setIncludeCollaborators(v);
                    if (!v) setCollaboratorIds([]);
                  }}
                  trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={COLORS.borderLight}
                />
              </View>

              {includeCollaborators && (
                <View style={styles.collabPicker}>
                  {employees.length === 0 ? (
                    <Text style={styles.collabEmpty}>Loading directory…</Text>
                  ) : (
                    employees.slice(0, 30).map((emp: any) => {
                      const id = emp.userId || emp._id;
                      if (!id) return null;
                      const selected = collaboratorIds.includes(id);
                      const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[
                            styles.collabRow,
                            selected && styles.collabRowActive,
                          ]}
                          onPress={() =>
                            setCollaboratorIds((prev) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <View style={styles.collabAvatar}>
                            <Text style={styles.collabAvatarText}>
                              {(fullName[0] || "?").toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.collabName}>{fullName}</Text>
                            <Text style={styles.collabEmail} numberOfLines={1}>
                              {emp.email || ""}
                            </Text>
                          </View>
                          {selected && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={20}
                              color={COLORS.primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {formError ? (
                <Text style={styles.errorMsg}>{formError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !createMutation.isPending && setCreateVisible(false)}
                disabled={createMutation.isPending}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  createMutation.isPending && { opacity: 0.6 },
                ]}
                onPress={handleCreate}
                disabled={createMutation.isPending}
                activeOpacity={0.85}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
  // ─── Filter ──────────────────────────────────────────────────────
  filterRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  // ─── List ────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl + 60,
  },
  center: {
    paddingVertical: SPACING.xxl,
    alignItems: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xl + 8,
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs + 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  // ─── Task card ───────────────────────────────────────────────────
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm + 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  checkBtn: {
    paddingTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: COLORS.textMuted,
  },
  taskDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xs + 2,
    marginTop: SPACING.sm,
  },
  priorityChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  deleteBtn: {
    padding: SPACING.xs,
  },
  // ─── FAB ─────────────────────────────────────────────────────────
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
  // ─── Modal ───────────────────────────────────────────────────────
  modalCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  input: {
    marginBottom: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  fieldCaption: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs + 2,
    marginBottom: SPACING.sm,
  },
  priorityOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priorityOptionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  collabHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SPACING.sm,
  },
  collabPicker: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    maxHeight: 220,
  },
  collabEmpty: {
    padding: SPACING.md,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  collabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  collabRowActive: {
    backgroundColor: COLORS.primaryLight,
  },
  collabAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  collabAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  collabName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  collabEmail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  errorMsg: {
    fontSize: 13,
    color: COLORS.danger,
    marginTop: SPACING.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  saveBtn: {
    paddingHorizontal: SPACING.lg + 4,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.colored(COLORS.primary),
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
});
