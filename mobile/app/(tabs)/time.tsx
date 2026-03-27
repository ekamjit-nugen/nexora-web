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
  Button,
  ActivityIndicator,
  TextInput,
  Portal,
  Modal,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { attendanceApi, leaveApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

type Tab = "attendance" | "leaves";

export default function TimeScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("attendance");
  const [refreshing, setRefreshing] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);

  // Leave form state
  const [leaveType, setLeaveType] = useState("casual");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveError, setLeaveError] = useState("");

  // Queries
  const {
    data: todayData,
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => attendanceApi.getToday(),
    enabled: activeTab === "attendance",
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["attendance", "history"],
    queryFn: () => attendanceApi.getHistory({ page: 1, limit: 20 }),
    enabled: activeTab === "attendance",
  });

  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: () => leaveApi.getBalance(),
    enabled: activeTab === "leaves",
  });

  const {
    data: myLeavesData,
    isLoading: leavesLoading,
    refetch: refetchLeaves,
  } = useQuery({
    queryKey: ["leaves", "my"],
    queryFn: () => leaveApi.getMyLeaves({ page: 1 }),
    enabled: activeTab === "leaves",
  });

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: () => attendanceApi.checkIn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceApi.checkOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const applyLeaveMutation = useMutation({
    mutationFn: (data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => leaveApi.apply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setLeaveModalVisible(false);
      resetLeaveForm();
    },
    onError: (err: any) => {
      setLeaveError(err.message || "Failed to apply leave");
    },
  });

  const resetLeaveForm = () => {
    setLeaveType("casual");
    setLeaveReason("");
    setLeaveStart("");
    setLeaveEnd("");
    setLeaveError("");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === "attendance") {
      await Promise.all([refetchToday(), refetchHistory()]);
    } else {
      await Promise.all([refetchBalance(), refetchLeaves()]);
    }
    setRefreshing(false);
  }, [activeTab, refetchToday, refetchHistory, refetchBalance, refetchLeaves]);

  const today = todayData?.data;
  const isCheckedIn =
    today?.status === "checked_in" ||
    today?.sessions?.some((s: any) => s.checkIn && !s.checkOut);

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return COLORS.success;
      case "pending": return COLORS.warning;
      case "rejected": return COLORS.danger;
      case "cancelled": return COLORS.textMuted;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status: string): any => {
    switch (status) {
      case "approved": return "check-circle";
      case "pending": return "clock-outline";
      case "rejected": return "close-circle";
      case "cancelled": return "cancel";
      default: return "help-circle-outline";
    }
  };

  const handleApplyLeave = () => {
    setLeaveError("");
    if (!leaveStart || !leaveEnd) {
      setLeaveError("Please enter start and end dates (YYYY-MM-DD)");
      return;
    }
    if (!leaveReason.trim()) {
      setLeaveError("Please enter a reason");
      return;
    }
    applyLeaveMutation.mutate({
      leaveType,
      startDate: leaveStart,
      endDate: leaveEnd,
      reason: leaveReason.trim(),
    });
  };

  const renderAttendanceTab = () => (
    <>
      {/* Today's Status */}
      <View style={[styles.card, styles.todayCard]}>
        <View style={styles.todayHeader}>
          <View style={styles.todayTitleRow}>
            <MaterialCommunityIcons name="calendar-today" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Today</Text>
          </View>
          <View style={[styles.statusPill, isCheckedIn ? styles.pillActive : styles.pillInactive]}>
            <View style={[styles.statusDot, { backgroundColor: isCheckedIn ? COLORS.success : COLORS.textMuted }]} />
            <Text style={[styles.statusPillText, { color: isCheckedIn ? COLORS.success : COLORS.textMuted }]}>
              {isCheckedIn ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {todayLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <MaterialCommunityIcons name="login" size={16} color={COLORS.success} />
                <Text style={styles.timeLabel}>In</Text>
                <Text style={styles.timeValue}>
                  {formatTime(today?.sessions?.[0]?.checkIn)}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeBlock}>
                <MaterialCommunityIcons name="logout" size={16} color={COLORS.danger} />
                <Text style={styles.timeLabel}>Out</Text>
                <Text style={styles.timeValue}>
                  {formatTime(today?.sessions?.[today?.sessions?.length - 1]?.checkOut)}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeBlock}>
                <MaterialCommunityIcons name="timer-sand" size={16} color={COLORS.accent} />
                <Text style={styles.timeLabel}>Hours</Text>
                <Text style={styles.timeValue}>
                  {today?.totalHours ? `${today.totalHours.toFixed(1)}h` : "--"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate()}
              disabled={checkInMutation.isPending || checkOutMutation.isPending}
              activeOpacity={0.8}
              style={[styles.clockBtn, isCheckedIn ? styles.clockOutBtn : styles.clockInBtn]}
            >
              {(checkInMutation.isPending || checkOutMutation.isPending) ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={isCheckedIn ? "stop-circle-outline" : "play-circle-outline"}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.clockBtnText}>
                    {isCheckedIn ? "Clock Out" : "Clock In"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Sessions */}
      {today?.sessions && today.sessions.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="format-list-bulleted" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Today's Sessions</Text>
          </View>
          {today.sessions.map((session: any, idx: number) => (
            <View key={idx} style={styles.sessionRow}>
              <View style={styles.sessionBullet}>
                <View style={[styles.sessionDot, { backgroundColor: session.checkOut ? COLORS.success : COLORS.primary }]} />
                {idx < today.sessions.length - 1 && <View style={styles.sessionLine} />}
              </View>
              <View style={styles.sessionContent}>
                <Text style={styles.sessionLabel}>Session {idx + 1}</Text>
                <Text style={styles.sessionTime}>
                  {formatTime(session.checkIn)} — {session.checkOut ? formatTime(session.checkOut) : "ongoing"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* History */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="history" size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Recent History</Text>
        </View>
        {historyLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : (
          <>
            {(historyData?.data || []).slice(0, 10).map((record: any, idx: number) => (
              <View key={record._id || idx} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <MaterialCommunityIcons name="calendar-blank" size={16} color={COLORS.textMuted} />
                  <Text style={styles.historyDate}>
                    {formatDate(record.date || record.createdAt)}
                  </Text>
                </View>
                <View style={styles.historyHoursBadge}>
                  <Text style={styles.historyHours}>
                    {record.totalHours ? `${record.totalHours.toFixed(1)}h` : "--"}
                  </Text>
                </View>
              </View>
            ))}
            {(!historyData?.data || historyData.data.length === 0) && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No attendance records yet</Text>
              </View>
            )}
          </>
        )}
      </View>
    </>
  );

  const renderLeavesTab = () => (
    <>
      {/* Balance Cards */}
      <View style={styles.card}>
        <View style={styles.balanceHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="scale-balance" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Leave Balance</Text>
          </View>
          <TouchableOpacity
            onPress={() => setLeaveModalVisible(true)}
            style={styles.applyBtn}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {balanceLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : (
          <View style={styles.balanceGrid}>
            {(balanceData?.data || []).map((item: any, idx: number) => {
              const colors = [COLORS.primary, COLORS.success, COLORS.accent, COLORS.secondary, COLORS.warning, COLORS.danger, COLORS.info];
              const c = colors[idx % colors.length];
              return (
                <View key={idx} style={styles.balanceItem}>
                  <Text style={[styles.balanceNumber, { color: c }]}>
                    {item.remaining ?? item.balance ?? "--"}
                  </Text>
                  <Text style={styles.balanceLabel} numberOfLines={1}>
                    {item.type || item.leaveType || "Leave"}
                  </Text>
                  <Text style={styles.balanceTotal}>
                    of {item.total ?? item.annualAllocation ?? "--"}
                  </Text>
                </View>
              );
            })}
            {(!balanceData?.data || balanceData.data.length === 0) && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-remove-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No leave balances available</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* My Leaves */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="file-document-outline" size={18} color={COLORS.primary} />
          <Text style={styles.cardTitle}>My Requests</Text>
        </View>

        {leavesLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : (
          <>
            {(myLeavesData?.data || []).map((leave: any, idx: number) => {
              const statusColor = getStatusColor(leave.status);
              return (
                <View key={leave._id || idx} style={styles.leaveRow}>
                  <View style={[styles.leaveIconCircle, { backgroundColor: statusColor + "15" }]}>
                    <MaterialCommunityIcons
                      name={getStatusIcon(leave.status)}
                      size={18}
                      color={statusColor}
                    />
                  </View>
                  <View style={styles.leaveInfo}>
                    <Text style={styles.leaveType}>
                      {leave.leaveType || leave.type}
                    </Text>
                    <Text style={styles.leaveDates}>
                      {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                    </Text>
                  </View>
                  <View style={[styles.leaveStatusBadge, { backgroundColor: statusColor + "15" }]}>
                    <Text style={[styles.leaveStatusText, { color: statusColor }]}>
                      {leave.status}
                    </Text>
                  </View>
                </View>
              );
            })}
            {(!myLeavesData?.data || myLeavesData.data.length === 0) && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="file-document-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No leave requests yet</Text>
              </View>
            )}
          </>
        )}
      </View>
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
            <Text style={styles.headerTitle}>Time</Text>
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "attendance" && styles.tabBtnActive]}
                onPress={() => setActiveTab("attendance")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color={activeTab === "attendance" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.tabBtnText, activeTab === "attendance" && styles.tabBtnTextActive]}>
                  Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "leaves" && styles.tabBtnActive]}
                onPress={() => setActiveTab("leaves")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={16}
                  color={activeTab === "leaves" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.tabBtnText, activeTab === "leaves" && styles.tabBtnTextActive]}>
                  Leaves
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
        {activeTab === "attendance" ? renderAttendanceTab() : renderLeavesTab()}
      </ScrollView>

      {/* Apply Leave Modal */}
      <Portal>
        <Modal
          visible={leaveModalVisible}
          onDismiss={() => { setLeaveModalVisible(false); resetLeaveForm(); }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply Leave</Text>
            <TouchableOpacity onPress={() => { setLeaveModalVisible(false); resetLeaveForm(); }}>
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <TextInput
            label="Leave Type"
            value={leaveType}
            onChangeText={setLeaveType}
            mode="outlined"
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            left={<TextInput.Icon icon="tag-outline" />}
            theme={{ roundness: RADIUS.md }}
          />

          <TextInput
            label="Start Date (YYYY-MM-DD)"
            value={leaveStart}
            onChangeText={setLeaveStart}
            mode="outlined"
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            placeholder="2026-03-27"
            left={<TextInput.Icon icon="calendar-start" />}
            theme={{ roundness: RADIUS.md }}
          />

          <TextInput
            label="End Date (YYYY-MM-DD)"
            value={leaveEnd}
            onChangeText={setLeaveEnd}
            mode="outlined"
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            placeholder="2026-03-28"
            left={<TextInput.Icon icon="calendar-end" />}
            theme={{ roundness: RADIUS.md }}
          />

          <TextInput
            label="Reason"
            value={leaveReason}
            onChangeText={setLeaveReason}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            left={<TextInput.Icon icon="text" />}
            theme={{ roundness: RADIUS.md }}
          />

          {leaveError ? (
            <Text style={styles.modalError}>{leaveError}</Text>
          ) : null}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => { setLeaveModalVisible(false); resetLeaveForm(); }}
              style={styles.modalBtnOutline}
              textColor={COLORS.textSecondary}
              theme={{ roundness: RADIUS.md }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleApplyLeave}
              loading={applyLeaveMutation.isPending}
              disabled={applyLeaveMutation.isPending}
              style={styles.modalBtnFill}
              theme={{ roundness: RADIUS.md }}
            >
              Submit
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
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  todayCard: {},
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  todayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  pillActive: {
    backgroundColor: COLORS.successLight,
  },
  pillInactive: {
    backgroundColor: COLORS.borderLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  timeSep: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  timeLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 48,
    borderRadius: RADIUS.md,
  },
  clockInBtn: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  clockOutBtn: {
    backgroundColor: COLORS.danger,
    ...SHADOWS.colored(COLORS.danger),
  },
  clockBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sessionRow: {
    flexDirection: "row",
    marginBottom: SPACING.xs,
  },
  sessionBullet: {
    alignItems: "center",
    width: 24,
    marginRight: SPACING.sm,
    paddingTop: 6,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  sessionContent: {
    flex: 1,
    paddingBottom: SPACING.sm,
  },
  sessionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  historyDate: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
  },
  historyHoursBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  historyHours: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  balanceItem: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
  },
  balanceNumber: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "capitalize",
    marginTop: 2,
    fontWeight: "500",
  },
  balanceTotal: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  leaveIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveInfo: {
    flex: 1,
  },
  leaveType: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  leaveDates: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveStatusBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  leaveStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
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
  modalError: {
    fontSize: 13,
    color: COLORS.danger,
    marginBottom: SPACING.sm,
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
  modalBtnFill: {
    backgroundColor: COLORS.primary,
  },
});
