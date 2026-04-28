import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
} from "react-native";
import {
  Text,
  Button,
  ActivityIndicator,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { attendanceApi, notificationApi, projectApi, taskApi, leaveApi } from "../../lib/api";
import { captureLocation } from "../../lib/location";
import { COLORS, SPACING, RADIUS, SHADOWS, SURFACES } from "../../lib/theme";

const { width } = Dimensions.get("window");

// Quick actions are role-aware. Admin/owner doesn't clock in or apply
// for leave personally — they review the team's. Each tile gets its
// own curated tone from the theme palette so the row reads as a
// vibrant set rather than 4 identical neutral buttons.
type QuickAction = { key: string; icon: any; label: string; tone: { bg: string; fg: string } };

const EMPLOYEE_QUICK_ACTIONS: QuickAction[] = [
  { key: "time",       icon: "timer-outline",                     label: "Log Time",    tone: COLORS.toneIndigo },
  { key: "leave",      icon: "calendar-plus",                     label: "Apply Leave", tone: COLORS.toneEmerald },
  { key: "my-tasks",   icon: "clipboard-check-outline",           label: "My Tasks",    tone: COLORS.toneViolet },
  { key: "directory",  icon: "account-group-outline",             label: "Directory",   tone: COLORS.toneTeal },
];

const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { key: "approvals",  icon: "checkbox-marked-circle-plus-outline", label: "Approvals", tone: COLORS.toneAmber },
  { key: "my-tasks",   icon: "clipboard-check-outline",             label: "My Tasks",  tone: COLORS.toneViolet },
  { key: "directory",  icon: "account-group-outline",               label: "Team",      tone: COLORS.toneTeal },
  { key: "policies",   icon: "shield-check-outline",                label: "Policies",  tone: COLORS.toneIndigo },
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
  const queryClient = useQueryClient();
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
  // Backend returns { checkedIn, hasOpenSession, sessions[], firstClockIn,
  // record, totalHoursToday, ... }. Sessions are raw attendance docs whose
  // fields are `checkInTime`/`checkOutTime`/`totalWorkingHours` — the
  // mobile UI used to look for camelCase short forms (`checkIn`/`checkOut`)
  // which never existed, so isCheckedIn was always false.
  const isCheckedIn = !!(today?.hasOpenSession || (today?.checkedIn && !today?.checkedOut));

  // Live ticking timer — re-renders every second while clocked in.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isCheckedIn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn]);

  const liveHours = (() => {
    const sessions: any[] = today?.sessions || [];
    const closedHours = sessions
      .filter((s) => s.checkOutTime)
      .reduce((sum, s) => sum + (s.totalWorkingHours || 0), 0);
    const openSession = sessions.find((s) => s.checkInTime && !s.checkOutTime);
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
      const location = await captureLocation();
      if (isCheckedIn) {
        await attendanceApi.checkOut(location ? { location } : undefined);
      } else {
        await attendanceApi.checkIn(location ? { location } : undefined);
      }
      // AWAIT the refetch — the check-in/out response is a raw attendance
      // doc, but the today-status query expects a composite shape. We
      // can't optimistically write the cache without putting the wrong
      // shape in. Awaiting the refetch costs one round-trip but ensures
      // `isCheckedIn` flips correctly before the next render.
      await queryClient.invalidateQueries({ queryKey: ["attendance", "today"] });
      await refetchToday();
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
        {/* ── Hero gradient card ────────────────────────────────────
            Indigo → violet, deeper than the old generic blue→purple.
            Holds the greeting, an inline org chip, and (for employees)
            an inline today snapshot so the highest-frequency action
            sits within the most visually anchored surface. */}
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroWrapper}>
            <LinearGradient
              colors={SURFACES.heroGradient as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Decorative blob — just enough texture to keep the
                  hero from reading flat. Pure CSS, no image. */}
              <View style={styles.heroBlob} />

              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroGreeting}>{getGreeting()}</Text>
                  <Text style={styles.heroName}>
                    {user?.firstName || "User"}
                  </Text>
                  {currentOrg && (
                    <View style={styles.heroOrgChip}>
                      <MaterialCommunityIcons
                        name="office-building-outline"
                        size={11}
                        color="rgba(255,255,255,0.85)"
                      />
                      <Text style={styles.heroOrgChipText} numberOfLines={1}>
                        {currentOrg.name}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.heroIconBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push("/notifications")}
                  >
                    <MaterialCommunityIcons
                      name="bell-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                    {unreadCount > 0 && (
                      <View style={styles.heroBellBadge}>
                        <Text style={styles.heroBellBadgeText}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.heroAvatar}>
                    {(user as any)?.avatar ? (
                      <Image
                        source={{ uri: (user as any).avatar }}
                        style={styles.heroAvatarImage}
                      />
                    ) : (
                      <Text style={styles.heroAvatarText}>
                        {(user?.firstName?.[0] || "U").toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Inline today snapshot for employees — admins skip
                  this since they don't clock in personally. */}
              {showAttendanceCard && (
                <View style={styles.heroSnapshot}>
                  <View style={styles.heroSnapItem}>
                    <Text style={styles.heroSnapLabel}>In</Text>
                    <Text style={styles.heroSnapValue}>
                      {formatTime(today?.sessions?.[0]?.checkInTime || today?.firstClockIn)}
                    </Text>
                  </View>
                  <View style={styles.heroSnapDivider} />
                  <View style={styles.heroSnapItem}>
                    <Text style={styles.heroSnapLabel}>Out</Text>
                    <Text style={styles.heroSnapValue}>
                      {formatTime(today?.sessions?.[today?.sessions?.length ? today.sessions.length - 1 : 0]?.checkOutTime)}
                    </Text>
                  </View>
                  <View style={styles.heroSnapDivider} />
                  <View style={styles.heroSnapItem}>
                    <Text style={styles.heroSnapLabel}>Hours</Text>
                    <Text style={styles.heroSnapValue}>
                      {/* Live ticker — counts up every second while clocked
                          in. Falls back to the closed-session total when
                          not. */}
                      {isCheckedIn || liveHours > 0 ? formatHM(liveHours) : "—"}
                    </Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </View>
        </SafeAreaView>

        {/* Content area */}
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
                      {formatTime(today?.sessions?.[0]?.checkInTime || today?.firstClockIn)}
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
                        today?.sessions?.[today?.sessions?.length ? today.sessions.length - 1 : 0]?.checkOutTime
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
                      {/* Live ticker — see liveHours computation above. */}
                      {isCheckedIn || liveHours > 0 ? formatHM(liveHours) : "--"}
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

          {/* Quick Actions — admin/owner gets the approval-flavoured set,
              everyone else gets the personal-attendance set. */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {(isAdminOrOwner ? ADMIN_QUICK_ACTIONS : EMPLOYEE_QUICK_ACTIONS).map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionCard}
                activeOpacity={0.7}
                onPress={() => {
                  if (action.key === "leave") router.push("/leave/apply");
                  else if (action.key === "time") router.push("/(tabs)/time");
                  else if (action.key === "projects") router.push("/projects");
                  else if (action.key === "directory") router.push("/directory");
                  else if (action.key === "approvals") router.push("/approvals" as any);
                  else if (action.key === "policies") router.push("/policies");
                  else if (action.key === "my-tasks") router.push("/my-tasks" as any);
                }}
              >
                {/* Tone-tinted icon. Each action draws from the
                    curated COLORS.tone* palette in the theme so the
                    row reads as a vibrant, cohesive family rather
                    than a row of grey buttons. */}
                <View style={[styles.actionIcon, { backgroundColor: action.tone.bg }]}>
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={22}
                    color={action.tone.fg}
                  />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overview Stats — neutral cards, but the BIG NUMBER is
              tone-coloured so the trio scans quickly. Each tone is from
              the curated palette so they look like one family. */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: COLORS.toneIndigo.fg }]}>{projectsData?.data?.length ?? "—"}</Text>
              <Text style={styles.statLabel}>Active Projects</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: COLORS.toneViolet.fg }]}>
                {tasksData?.data
                  ? (tasksData.data.overdue?.length || 0) + (tasksData.data.dueToday?.length || 0) + (tasksData.data.inProgress?.length || 0) + (tasksData.data.readyToStart?.length || 0)
                  : "—"}
              </Text>
              <Text style={styles.statLabel}>Open Tasks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: COLORS.toneEmerald.fg }]}>
                {(() => {
                  // Sum across all leave types. The backend uses `available`
                  // (canonical), older shapes used `remaining` / `balance`.
                  // Pick the first one that's a number for each row.
                  const data = leaveBalanceData?.data as any;
                  if (!data) return "—";
                  const sumOf = (rows: any[]) =>
                    rows.reduce((sum: number, b: any) => {
                      const n = b?.available ?? b?.remaining ?? b?.balance ?? 0;
                      return sum + (typeof n === "number" ? n : 0);
                    }, 0);
                  if (Array.isArray(data)) return sumOf(data);
                  if (Array.isArray(data.balances)) return sumOf(data.balances);
                  if (typeof data === "object") {
                    return Object.values(data).reduce((sum: number, v: any) => {
                      if (typeof v === "number") return sum + v;
                      if (v && typeof v === "object") {
                        const n = v?.available ?? v?.remaining ?? v?.balance;
                        if (typeof n === "number") return sum + n;
                      }
                      return sum;
                    }, 0);
                  }
                  return "—";
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
  // ─── Hero gradient card ──────────────────────────────────────────
  heroWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    overflow: "hidden",
    // Indigo glow ties the hero into the rest of the screen.
    ...SHADOWS.colored(COLORS.primaryDark),
  },
  // Decorative blob — soft white ellipse top-right adds depth without
  // requiring an image asset.
  heroBlob: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroGreeting: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
    marginTop: 2,
  },
  heroOrgChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
    maxWidth: width * 0.55,
  },
  heroOrgChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 0.1,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroBellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  heroBellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.32)",
    overflow: "hidden",
  },
  heroAvatarImage: {
    width: "100%",
    height: "100%",
  },
  heroAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Inline today snapshot in the hero — glass row with In / Out / Hours.
  heroSnapshot: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: SPACING.lg,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroSnapItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  heroSnapDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 4,
  },
  heroSnapLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroSnapValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  // ─── Content area ────────────────────────────────────────────────
  contentArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  // ─── Cards ────────────────────────────────────────────────────────
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  attendanceCard: {
    marginBottom: SPACING.lg,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  attendanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.2,
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
    backgroundColor: COLORS.surfaceMuted,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
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
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  // ─── CTAs — gradient on the primary action ───────────────────────
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
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  // ─── Section heading ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
    textTransform: "uppercase",
  },
  // ─── Quick actions — coloured tone tiles ──────────────────────────
  quickActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  // Tone is applied inline (action.tone.bg / .fg) so each tile gets
  // its own personality from the curated palette.
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  // ─── Stat strip — neutral cards with tinted big numbers ───────────
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
});
