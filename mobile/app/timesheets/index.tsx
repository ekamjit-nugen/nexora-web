import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  FAB,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { timesheetApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

type Tab = "my" | "pending";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  draft: { label: "Draft", color: COLORS.textSecondary, bg: COLORS.borderLight, icon: "pencil-outline" },
  submitted: { label: "Submitted", color: COLORS.warning, bg: COLORS.warningLight, icon: "clock-outline" },
  approved: { label: "Approved", color: COLORS.success, bg: COLORS.successLight, icon: "check-circle" },
  rejected: { label: "Rejected", color: COLORS.danger, bg: COLORS.dangerLight, icon: "close-circle" },
  revision_requested: { label: "Revision", color: COLORS.warning, bg: COLORS.warningLight, icon: "alert-circle-outline" },
};

function formatWeekLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} - ${endStr}`;
}

export default function TimesheetsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("my");
  const [refreshing, setRefreshing] = useState(false);

  const isManager = user?.roles?.some((r: string) =>
    ["admin", "manager", "hr_manager", "org_admin"].includes(r)
  );

  const {
    data: statsData,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["timesheets", "stats"],
    queryFn: () => timesheetApi.getStats(),
  });

  const {
    data: myData,
    isLoading: myLoading,
    refetch: refetchMy,
  } = useQuery({
    queryKey: ["timesheets", "my"],
    queryFn: () => timesheetApi.getMyTimesheets(),
    enabled: activeTab === "my",
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["timesheets", "pending"],
    queryFn: () => timesheetApi.getPending(),
    enabled: activeTab === "pending" && !!isManager,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStats(),
      activeTab === "my" ? refetchMy() : refetchPending(),
    ]);
    setRefreshing(false);
  }, [activeTab, refetchStats, refetchMy, refetchPending]);

  const stats = statsData?.data;
  const timesheets = activeTab === "my" ? myData?.data : pendingData?.data;
  const isLoading = activeTab === "my" ? myLoading : pendingLoading;

  const renderStatsRow = () => {
    const items = [
      { label: "Total", value: stats?.total ?? "--", color: COLORS.primary, icon: "file-document-outline" },
      { label: "Pending", value: stats?.pending ?? "--", color: COLORS.warning, icon: "clock-outline" },
      { label: "Approved", value: stats?.approved ?? "--", color: COLORS.success, icon: "check-circle-outline" },
      { label: "Hours", value: stats?.hoursThisWeek != null ? `${stats.hoursThisWeek}h` : "--", color: COLORS.accent, icon: "timer-outline" },
    ];

    return (
      <View style={styles.statsRow}>
        {items.map((item) => (
          <View key={item.label} style={styles.statCard}>
            <View style={[styles.statIconCircle, { backgroundColor: item.color + "15" }]}>
              <MaterialCommunityIcons name={item.icon as any} size={16} color={item.color} />
            </View>
            <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderTimesheetCard = ({ item }: { item: any }) => {
    const cfg = statusConfig[item.status] || statusConfig.draft;
    const startDate = item.period?.startDate || item.startDate;
    const endDate = item.period?.endDate || item.endDate;
    const weekLabel = startDate && endDate ? formatWeekLabel(startDate, endDate) : "Unknown period";
    const totalHours = item.totalHours ?? item.entries?.reduce((sum: number, e: any) => sum + (e.hours || 0), 0) ?? 0;
    const entryCount = item.entries?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.timesheetCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/timesheets/${item._id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardWeekRow}>
            <MaterialCommunityIcons name="calendar-week" size={16} color={COLORS.primary} />
            <Text style={styles.cardWeekText}>{weekLabel}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <MaterialCommunityIcons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardStat}>
            <MaterialCommunityIcons name="timer-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.cardStatText}>{totalHours.toFixed(1)}h total</Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            <MaterialCommunityIcons name="format-list-numbered" size={14} color={COLORS.textMuted} />
            <Text style={styles.cardStatText}>{entryCount} entries</Text>
          </View>
        </View>

        {activeTab === "pending" && item.employee && (
          <View style={styles.cardFooter}>
            <View style={styles.employeeAvatar}>
              <Text style={styles.employeeAvatarText}>
                {(item.employee.firstName?.[0] || "").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.employeeName}>
              {item.employee.firstName} {item.employee.lastName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name={activeTab === "my" ? "file-document-outline" : "clipboard-check-outline"}
        size={48}
        color={COLORS.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === "my" ? "No timesheets yet" : "No pending reviews"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "my"
          ? "Create a timesheet to start tracking your hours"
          : "All timesheets have been reviewed"}
      </Text>
    </View>
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
            <View style={styles.headerTopRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Timesheets</Text>
              <View style={{ width: 36 }} />
            </View>

            {isManager && (
              <View style={styles.tabSwitcher}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "my" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("my")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={16}
                    color={activeTab === "my" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                  />
                  <Text style={[styles.tabBtnText, activeTab === "my" && styles.tabBtnTextActive]}>
                    My Timesheets
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "pending" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("pending")}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={16}
                    color={activeTab === "pending" ? COLORS.primary : "rgba(255,255,255,0.7)"}
                  />
                  <Text style={[styles.tabBtnText, activeTab === "pending" && styles.tabBtnTextActive]}>
                    Pending Review
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={timesheets || []}
        keyExtractor={(item) => item._id}
        renderItem={renderTimesheetCard}
        ListHeaderComponent={renderStatsRow}
        ListEmptyComponent={isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : renderEmpty()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        color="#FFFFFF"
        onPress={() => router.push("/timesheets/create")}
      />
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
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
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
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  tabBtnTextActive: {
    color: COLORS.primary,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    alignItems: "center",
    ...SHADOWS.sm,
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  timesheetCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  cardWeekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  cardWeekText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  cardStatText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  cardStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  employeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  employeeAvatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  employeeName: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  loader: {
    marginVertical: SPACING.xxl,
  },
  fab: {
    position: "absolute",
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    ...SHADOWS.colored(COLORS.primary),
  },
});
