import React, { useState, useCallback, useEffect } from "react";
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
import { useRouter } from "expo-router";
import { attendanceApi, leaveApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { captureLocation } from "../../lib/location";
import { COLORS, SPACING, RADIUS, SHADOWS, SURFACES } from "../../lib/theme";

type Tab = "attendance" | "leaves";

export default function TimeScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, orgRole } = useAuth();
  // Admin/owner: hide Clock-In button + Apply-Leave FAB (backend rejects
  // both for them with 403). Show pending-approval queues instead so
  // the Time tab stays useful rather than a dead-end.
  const isAdminOrOwner =
    !!user?.roles?.some((r: string) => ["admin", "super_admin"].includes(r.toLowerCase())) ||
    orgRole === "owner" || orgRole === "admin";
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

  // Pending team leaves — only fetched for admin/owner so we don't
  // do a useless 403'd call for regular employees.
  const {
    data: pendingApprovalsData,
    refetch: refetchPendingApprovals,
  } = useQuery({
    queryKey: ["leaves", "pending-approval-count"],
    queryFn: () => leaveApi.getAll({ page: 1, status: "pending" }),
    enabled: isAdminOrOwner,
  });
  const pendingApprovalsCount = pendingApprovalsData?.data?.length ?? 0;

  // Mutations. Both clock-in/out fire `captureLocation()` first so
  // the server-side record carries lat/lng when the user has granted
  // permission, and falls back to a no-location record otherwise.
  //
  // After the call we AWAIT a refetch of the today-status shape rather
  // than optimistically writing the cache: the check-in/out endpoint
  // returns the raw attendance DOC, but the today-status response is a
  // composite (`{ checkedIn, hasOpenSession, sessions, totalHoursToday,
  // ... }`). Writing the doc into the today-status cache slot would put
  // the wrong shape in there and the next render would think the user
  // hadn't clocked in. Awaiting the refetch is slower (one extra round
  // trip) but produces the correct shape every time.
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const location = await captureLocation();
      return attendanceApi.checkIn(location ? { location } : undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });
      await refetchToday();
    },
    onError: async (err: any) => {
      // Surface server errors instead of silently dropping them. Also force
      // a refetch so the UI re-syncs with reality (e.g. backend says
      // "already clocked in" → cache was stale, refetch updates it so the
      // button flips correctly).
      Alert.alert("Couldn't clock in", err?.message || "Please try again.");
      await refetchToday();
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const location = await captureLocation();
      return attendanceApi.checkOut(location ? { location } : undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });
      await refetchToday();
    },
    onError: async (err: any) => {
      Alert.alert("Couldn't clock out", err?.message || "Please try again.");
      await refetchToday();
    },
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
  // Backend (attendance-service getTodayStatus) returns:
  //   { checkedIn, checkedOut, hasOpenSession, record, sessions[],
  //     totalHoursToday, sessionCount, firstClockIn }
  // Sessions are raw attendance docs whose timestamps are `checkInTime` /
  // `checkOutTime` (NOT `checkIn` / `checkOut`). The mobile UI used to
  // look for the wrong field names so isCheckedIn was always false — the
  // user could clock in repeatedly because the UI never noticed.
  const isCheckedIn = !!(today?.hasOpenSession || (today?.checkedIn && !today?.checkedOut));

  // Live ticking elapsed-time. While the user is clocked in we re-render
  // every second so the "Hours" cell counts up in real-time.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isCheckedIn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn]);

  const liveHours = (() => {
    // Server already includes the running open-session time in
    // totalHoursToday — but only as of when the request was issued.
    // To keep the second-by-second tick smooth between fetches, derive
    // closed-hours separately + add elapsed-since-open-checkIn live.
    const closedSessions: any[] = (today?.sessions || []).filter((s: any) => s.checkOutTime);
    const closedHours = closedSessions.reduce((sum, s) => sum + (s.totalWorkingHours || 0), 0);
    const openSession = (today?.sessions || []).find((s: any) => s.checkInTime && !s.checkOutTime);
    if (!openSession) return closedHours;
    const startedAt = new Date(openSession.checkInTime).getTime();
    return closedHours + (now - startedAt) / 3_600_000;
  })();
  const formatHM = (hours: number) => {
    const totalSec = Math.max(0, Math.floor(hours * 3600));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
                  {formatTime(today?.sessions?.[0]?.checkInTime || today?.firstClockIn)}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeBlock}>
                <MaterialCommunityIcons name="logout" size={16} color={COLORS.danger} />
                <Text style={styles.timeLabel}>Out</Text>
                <Text style={styles.timeValue}>
                  {formatTime(today?.sessions?.[today?.sessions?.length - 1]?.checkOutTime || today?.record?.checkOutTime)}
                </Text>
              </View>
              <View style={styles.timeSep} />
              <View style={styles.timeBlock}>
                <MaterialCommunityIcons name="timer-sand" size={16} color={COLORS.accent} />
                <Text style={styles.timeLabel}>Hours</Text>
                <Text style={styles.timeValue}>
                  {/* Live ticker — counts up every second while clocked in.
                      `liveHours` includes server-calculated totalHours +
                      seconds since the current open session's check-in. */}
                  {isCheckedIn || liveHours > 0 ? formatHM(liveHours) : "—"}
                </Text>
              </View>
            </View>

            {/* Admin/owner sees a "review approvals" CTA instead of clock-in
                — they can't clock in for themselves anyway. */}
            {isAdminOrOwner ? (
              <TouchableOpacity
                onPress={() => router.push("/approvals" as any)}
                activeOpacity={0.8}
                style={[styles.clockBtn, styles.clockInBtn]}
              >
                <MaterialCommunityIcons
                  name="checkbox-marked-circle-plus-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.clockBtnText}>
                  Review Approvals{pendingApprovalsCount > 0 ? ` (${pendingApprovalsCount})` : ""}
                </Text>
              </TouchableOpacity>
            ) : (
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
            )}
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
                <View style={[styles.sessionDot, { backgroundColor: session.checkOutTime ? COLORS.success : COLORS.primary }]} />
                {idx < today.sessions.length - 1 && <View style={styles.sessionLine} />}
              </View>
              <View style={styles.sessionContent}>
                <Text style={styles.sessionLabel}>Session {idx + 1}</Text>
                <Text style={styles.sessionTime}>
                  {formatTime(session.checkInTime)} — {session.checkOutTime ? formatTime(session.checkOutTime) : "ongoing"}
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
                    {/* History rows are raw attendance docs — backend
                        field is `totalWorkingHours`, not `totalHours`. */}
                    {(record.totalWorkingHours || record.totalHours) ? `${(record.totalWorkingHours || record.totalHours).toFixed(1)}h` : "--"}
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
      {/* Admin/owner approvals card — only on the Leaves sub-tab so the
          admin lands here naturally when reviewing the team. Tapping
          jumps straight to the pending-approval queue. */}
      {isAdminOrOwner && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.card}
          onPress={() => router.push("/approvals" as any)}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="checkbox-marked-circle-plus-outline" size={18} color={COLORS.warning} />
              <Text style={styles.cardTitle}>Pending Approvals</Text>
            </View>
            <View style={[styles.applyBtn, { backgroundColor: COLORS.warning }]}>
              <Text style={styles.applyBtnText}>{pendingApprovalsCount}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>
            {pendingApprovalsCount === 0
              ? "All caught up — no leave requests need your review."
              : `Tap to review ${pendingApprovalsCount} pending leave request${pendingApprovalsCount === 1 ? "" : "s"}.`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Balance Cards */}
      <View style={styles.card}>
        <View style={styles.balanceHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="scale-balance" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Leave Balance</Text>
          </View>
          {/* Hide Apply for admin/owner — backend rejects 403 and the
              error toast confused early test users. */}
          {!isAdminOrOwner && (
            <TouchableOpacity
              onPress={() => setLeaveModalVisible(true)}
              style={styles.applyBtn}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          )}
        </View>

        {balanceLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : (() => {
          // The leave-service returns balance as `{ balances: [...] }` —
          // not a plain array. Defensively handle every shape we've seen
          // in the wild (object-with-balances, plain array, object-map of
          // type→count) so a stale-shape response can't crash the screen.
          const raw: any = balanceData?.data;
          const list: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.balances)
            ? raw.balances
            : raw && typeof raw === "object"
            ? Object.entries(raw)
                .filter(([, v]) => typeof v === "number" || (v && typeof v === "object"))
                .map(([type, v]: [string, any]) => ({
                  leaveType: type,
                  available: typeof v === "number" ? v : v?.available ?? v?.remaining ?? 0,
                  opening: typeof v === "object" ? v?.opening ?? v?.total ?? v?.annualAllocation ?? 0 : 0,
                }))
            : [];
          if (list.length === 0) {
            return (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-remove-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No leave balances available</Text>
              </View>
            );
          }
          return (
            <View style={styles.balanceGrid}>
              {list.map((item: any, idx: number) => {
                const colors = [COLORS.primary, COLORS.success, COLORS.accent, COLORS.secondary, COLORS.warning, COLORS.danger, COLORS.info];
                const c = colors[idx % colors.length];
                // Backend uses `available`/`opening` for actual records; older
                // shapes used `remaining`/`total`/`annualAllocation`. Try all.
                const remaining = item.available ?? item.remaining ?? item.balance ?? "--";
                const total = item.opening ?? item.total ?? item.annualAllocation ?? null;
                const label = item.type || item.leaveType || "Leave";
                return (
                  <View key={idx} style={styles.balanceItem}>
                    <Text style={[styles.balanceNumber, { color: c }]}>{remaining}</Text>
                    <Text style={styles.balanceLabel} numberOfLines={1}>{label}</Text>
                    {total !== null && (
                      <Text style={styles.balanceTotal}>of {total}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}
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
      {/* Compact hero — gradient strip with title + segmented control.
          Smaller than the Home hero (this isn't the page's primary
          surface), but ties the screen visually to the rest of the app. */}
      <SafeAreaView edges={["top"]}>
        <LinearGradient
          colors={SURFACES.heroGradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroStrip}
        >
          <View style={styles.heroBlob} />
          <Text style={styles.heroTitle}>Time</Text>
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "attendance" && styles.tabBtnActive]}
              onPress={() => setActiveTab("attendance")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === "attendance" && styles.tabBtnTextActive]}>
                Attendance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "leaves" && styles.tabBtnActive]}
              onPress={() => setActiveTab("leaves")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === "leaves" && styles.tabBtnTextActive]}>
                Leaves
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

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
  // ─── Hero strip ──────────────────────────────────────────────────
  heroStrip: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    overflow: "hidden",
  },
  heroBlob: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  // ─── Segmented control on gradient — translucent track ───────────
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.md,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm + 2,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: -0.1,
  },
  tabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 20,
  },
  // ─── Cards — bordered + subtle shadow for depth ──────────────────
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
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
    alignItems: "stretch",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  timeSep: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
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
    letterSpacing: -0.2,
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
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    ...SHADOWS.colored(COLORS.primary),
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.1,
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
