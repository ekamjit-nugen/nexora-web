import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { notificationApi } from "../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../lib/theme";
import { Hero } from "../components/Hero";

const NOTIFICATION_TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }
> = {
  assignment: { icon: "account-plus-outline", color: COLORS.primary, bg: COLORS.primaryLight },
  comment: { icon: "message-text-outline", color: COLORS.accent, bg: COLORS.accentLight },
  due_date: { icon: "clock-alert-outline", color: COLORS.warning, bg: COLORS.warningLight },
  overdue: { icon: "alert-circle-outline", color: COLORS.danger, bg: COLORS.dangerLight },
  status: { icon: "arrow-right-circle-outline", color: COLORS.info, bg: COLORS.infoLight },
  sprint: { icon: "flag-outline", color: COLORS.secondary, bg: COLORS.secondaryLight },
  mention: { icon: "at", color: COLORS.primary, bg: COLORS.primaryLight },
};

const DEFAULT_TYPE_CONFIG = {
  icon: "bell-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
  color: COLORS.textSecondary,
  bg: COLORS.borderLight,
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 1 }) => notificationApi.getNotifications(pageParam, 20),
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data || []);
  }, [data]);

  const unreadCount = unreadData?.data?.count ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationTap = useCallback(
    (notification: any) => {
      if (!notification.read) {
        markReadMutation.mutate(notification._id || notification.id);
      }

      const entityType = notification.entityType || notification.type;
      const entityId = notification.entityId || notification.referenceId;

      if (!entityId) return;

      if (entityType === "sprint" || entityType === "project") {
        router.push(`/projects/${notification.projectId || entityId}/board`);
      } else {
        // task, comment, assignment, due_date, overdue, status, mention — no task detail route yet
        Alert.alert("Notification", notification.message || notification.body || "Tap a project notification to navigate.");
      }
    },
    [markReadMutation, router]
  );

  const handleMarkAllRead = useCallback(() => {
    if (unreadCount > 0) {
      markAllReadMutation.mutate();
    }
  }, [unreadCount, markAllReadMutation]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderNotification = useCallback(
    ({ item }: { item: any }) => {
      const typeKey = item.type || "default";
      const config = NOTIFICATION_TYPE_CONFIG[typeKey] || DEFAULT_TYPE_CONFIG;
      const isUnread = !item.read;

      return (
        <TouchableOpacity
          style={[styles.notificationCard, isUnread && styles.notificationUnread]}
          activeOpacity={0.7}
          onPress={() => handleNotificationTap(item)}
        >
          {isUnread && <View style={styles.unreadDot} />}
          <View style={[styles.typeIconContainer, { backgroundColor: config.bg }]}>
            <MaterialCommunityIcons
              name={config.icon}
              size={20}
              color={config.color}
            />
          </View>
          <View style={styles.notificationContent}>
            <Text
              style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.message || item.body}
            </Text>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.createdAt || item.timestamp)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleNotificationTap]
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={56}
            color={COLORS.success}
          />
        </View>
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptySubtitle}>
          No notifications to show right now.
        </Text>
      </View>
    );
  }, [isLoading]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={styles.container}>
      <Hero
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        showBack
        right={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllPill}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <Text style={styles.markAllPillText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <SafeAreaView edges={[]} style={styles.safeArea}>

        {/* Notification List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item: any, index: number) => item._id || item.id || String(index)}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.listContentEmpty,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Glass action pill on the hero gradient — for "Mark all read".
  markAllPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  markAllPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  markAllButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  markAllTextDisabled: {
    color: COLORS.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingVertical: SPACING.sm,
  },
  listContentEmpty: {
    flex: 1,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  notificationUnread: {
    backgroundColor: COLORS.primaryLight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    position: "absolute",
    left: SPACING.sm,
    top: SPACING.md + 6,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 2,
  },
  notificationTitleUnread: {
    fontWeight: "700",
  },
  notificationBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  notificationTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: SPACING.lg + 40 + SPACING.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingVertical: SPACING.lg,
    alignItems: "center",
  },
});
