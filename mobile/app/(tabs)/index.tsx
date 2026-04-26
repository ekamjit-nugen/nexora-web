import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { attendanceApi, notificationApi, projectApi, taskApi, leaveApi } from "../../lib/api";
import { captureLocation } from "../../lib/location";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const { width } = Dimensions.get("window");

const QUICK_ACTIONS = [
  { key: "time", icon: "timer-outline" as const, label: "Log Time", color: COLORS.primary, bg: COLORS.primaryLight },
  { key: "leave", icon: "calendar-plus" as const, label: "Apply Leave", color: COLORS.success, bg: COLORS.successLight },
  { key: "projects", icon: "folder-outline" as const, label: "Projects", color: COLORS.accent, bg: COLORS.accentLight },
  { key: "directory", icon: "account-group-outline" as const, label: "Directory", color: COLORS.secondary, bg: COLORS.secondaryLight },
];

export default function HomeScreen() {
  const { user, currentOrg, orgRole, isFeatureEnabled } = useAuth();
  // Admin/owner doesn't track personal attendance — they manage the
  // team's. The attendance card is hidden for them; the home screen
  // becomes a team-overview snapshot. Mirrors web dashboard logic.
  const isAdminOrOwner =
    !!user?.roles?.some((r: string) => ["admin", "super_admin"].includes(r.toLowerCase())) ||
    orgRole === "owner" || orgRole === "admin";
  const showAttendanceCard = !isAdminOrOwner && isFeatureEnabled("attendance");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  const {
    data: todayData,
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => attendanceApi.getToday(),
    retry: 1,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: projectsData } = useQuery({ queryKey: ["projects"], queryFn: () => projectApi.getAll(), retry: 1 });
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "my-work"], queryFn: () => taskApi.getMyWork(), retry: 1 });
  const { data: leaveBalanceData } = useQuery({ queryKey: ["leaves", "balance"], queryFn: () => leaveApi.getBalance(), retry: 1 });

  const unreadCount = unreadData?.data?.count ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchToday();
    setRefreshing(false);
  }, [refetchToday]);

  const today = todayData?.data;
  const isCheckedIn = today?.status === "checked_in" || today?.sessions?.some(
    (s: any) => s.checkIn && !s.checkOut
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const handleClockAction = async () => {
    if (clockLoading) return;
    setClockLoading(true);
    try {
      // Best-effort GPS fix. Null → user denied permission or device
      // can't get a position; check-in still proceeds with the IP
      // captured server-side. The admin attendance UI flags
      // no-location records explicitly so they're easy to spot.
      const location = await captureLocation();
      if (isCheckedIn) {
        await attendanceApi.checkOut(location ? { location } : undefined);
      } else {
        await attendanceApi.checkIn(location ? { location } : undefined);
      }
      refetchToday();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to record attendance. Please try again.");
    } finally {
      setClockLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={["top"]}>
            <View style={styles.headerContent}>
              <View style={styles.greetingRow}>
                <View style={styles.greetingText}>
                  <Text style={styles.greeting}>{getGreeting()},</Text>
                  <Text style={styles.userName}>
                    {user?.firstName || "User"}
                  </Text>
                  <Text style={styles.date}>{formatDate()}</Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.bellButton}
                    activeOpacity={0.7}
                    onPress={() => router.push("/notifications")}
                  >
                    <MaterialCommunityIcons
                      name="bell-outline"
                      size={24}
                      color="#FFFFFF"
                    />
                    {unreadCount > 0 && (
                      <View style={styles.bellBadge}>
                        <Text style={styles.bellBadgeText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {(user?.firstName?.[0] || "U").toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              {currentOrg && (
                <View style={styles.orgChip}>
                  <MaterialCommunityIcons
                    name="office-building-outline"
                    size={13}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text style={styles.orgChipText}>{currentOrg.name}</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Content area with overlap */}
        <View style={styles.contentArea}>
          {/* Attendance Card — shown only to users who clock in. Admin/
              owner skips this; the rest of the home screen still
              renders below (Quick Actions, recent activity, etc.). */}
          {showAttendanceCard && (
          <View style={[styles.card, styles.attendanceCard]}>
            <View style={styles.attendanceHeader}>
              <View style={styles.attendanceTitleRow}>
                <MaterialCommunityIcons
                  name="clock-check-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Today's Attendance</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  isCheckedIn ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isCheckedIn ? COLORS.success : COLORS.textMuted },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: isCheckedIn ? COLORS.success : COLORS.textMuted },
                  ]}
                >
                  {isCheckedIn ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            {todayLoading ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={styles.loader}
              />
            ) : (
              <>
                <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                    <MaterialCommunityIcons
                      name="login"
                      size={18}
                      color={COLORS.success}
                    />
                    <Text style={styles.timeLabel}>Check In</Text>
                    <Text style={styles.timeValue}>
                      {formatTime(today?.sessions?.[0]?.checkIn)}
                    </Text>
                  </View>
                  <View style={styles.timeSep} />
                  <View style={styles.timeBlock}>
                    <MaterialCommunityIcons
                      name="logout"
                      size={18}
                      color={COLORS.danger}
                    />
                    <Text style={styles.timeLabel}>Check Out</Text>
                    <Text style={styles.timeValue}>
                      {formatTime(
                        today?.sessions?.[today?.sessions?.length ? today.sessions.length - 1 : 0]?.checkOut
                      )}
                    </Text>
                  </View>
                  <View style={styles.timeSep} />
                  <View style={styles.timeBlock}>
                    <MaterialCommunityIcons
                      name="timer-sand"
                      size={18}
                      color={COLORS.accent}
                    />
                    <Text style={styles.timeLabel}>Total</Text>
                    <Text style={styles.timeValue}>
                      {today?.totalHours
                        ? `${Math.floor(today.totalHours)}h ${Math.round(
                            (today.totalHours % 1) * 60
                          )}m`
                        : "--"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleClockAction}
                  activeOpacity={0.8}
                  disabled={clockLoading}
                  style={[
                    styles.clockButton,
                    isCheckedIn ? styles.clockOutButton : styles.clockInButton,
                    clockLoading && { opacity: 0.7 },
                  ]}
                >
                  {clockLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialCommunityIcons
                      name={isCheckedIn ? "stop-circle-outline" : "play-circle-outline"}
                      size={22}
                      color="#FFFFFF"
                    />
                  )}
                  <Text style={styles.clockButtonText}>
                    {clockLoading ? "Please wait..." : isCheckedIn ? "Clock Out" : "Clock In"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          )}

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => {
                  if (action.key === "leave") router.push("/leave/apply");
                  else if (action.key === "time") router.push("/(tabs)/time");
                  else if (action.key === "projects") router.push("/projects");
                  else if (action.key === "directory") router.push("/directory");
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={22}
                    color={action.color}
                  />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overview Stats */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
              <Text style={[styles.statNumber, { color: COLORS.primary }]}>{projectsData?.data?.length ?? "--"}</Text>
              <Text style={styles.statLabel}>Active Projects</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: COLORS.accent }]}>
              <Text style={[styles.statNumber, { color: COLORS.accent }]}>
                {tasksData?.data
                  ? (tasksData.data.overdue?.length || 0) + (tasksData.data.dueToday?.length || 0) + (tasksData.data.inProgress?.length || 0) + (tasksData.data.readyToStart?.length || 0)
                  : "--"}
              </Text>
              <Text style={styles.statLabel}>Open Tasks</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: COLORS.success }]}>
              <Text style={[styles.statNumber, { color: COLORS.success }]}>
                {(() => {
                  const data = leaveBalanceData?.data as any;
                  if (!data) return "--";
                  // Handle array format: [{ remaining: n, ... }]
                  if (Array.isArray(data)) {
                    return data.reduce((sum: number, b: any) => sum + (b.remaining ?? b.balance ?? 0), 0);
                  }
                  // Handle nested array: { balances: [...] }
                  if (Array.isArray(data.balances)) {
                    return data.balances.reduce((sum: number, b: any) => sum + (b.remaining ?? b.balance ?? 0), 0);
                  }
                  // Handle object format: { casual: 10, sick: 5, ... }
                  if (typeof data === "object") {
                    return Object.values(data).reduce((sum: number, v: any) => {
                      if (typeof v === "number") return sum + v;
                      if (v && typeof v === "object" && typeof v.remaining === "number") return sum + v.remaining;
                      return sum;
                    }, 0);
                  }
                  return "--";
                })()}
              </Text>
              <Text style={styles.statLabel}>Leaves Left</Text>
            </View>
          </View>
        </View>
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
    paddingBottom: SPACING.xxl + 20,
  },
  headerGradient: {
    paddingBottom: SPACING.xxl + 20,
  },
  headerContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingText: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
  },
  userName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  date: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(37, 99, 235, 0.9)",
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  orgChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  orgChipText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  contentArea: {
    marginTop: -SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  attendanceCard: {
    marginBottom: SPACING.lg,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md + 4,
  },
  attendanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  statusActive: {
    backgroundColor: COLORS.successLight,
  },
  statusInactive: {
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md + 4,
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  timeSep: {
    width: 1,
    height: 44,
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
    letterSpacing: -0.3,
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  clockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 50,
    borderRadius: RADIUS.md,
  },
  clockInButton: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  clockOutButton: {
    backgroundColor: COLORS.danger,
    ...SHADOWS.colored(COLORS.danger),
  },
  clockButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
  },
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.sm,
    ...SHADOWS.sm,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    ...SHADOWS.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
});
