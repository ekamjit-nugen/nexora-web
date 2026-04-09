import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { Text, TextInput, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { employeeApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const AVATAR_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const getInitials = (firstName?: string, lastName?: string) => {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
};

export default function DirectoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(text.trim());
    }, 300);
  }, []);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["directory", "employees", debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      employeeApi.getAll({ page: pageParam, search: debouncedSearch || undefined }),
    getNextPageParam: (lastPage: any) => {
      const pagination = lastPage?.pagination;
      if (pagination && pagination.page < pagination.totalPages) {
        return pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const employees = useMemo(
    () => data?.pages?.flatMap((page: any) => page.data || []) || [],
    [data]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderEmployee = useCallback(
    ({ item }: { item: any }) => {
      const fullName = `${item.firstName || ""} ${item.lastName || ""}`.trim();
      const avatarColor = getAvatarColor(fullName || "U");
      const initials = getInitials(item.firstName, item.lastName);

      return (
        <TouchableOpacity style={styles.employeeCard} activeOpacity={0.7} onPress={() => Alert.alert(item.firstName + " " + item.lastName, item.email || "No email available")}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + "20" }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>
              {initials}
            </Text>
          </View>
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName} numberOfLines={1}>
              {fullName || "Unknown"}
            </Text>
            <View style={styles.employeeMeta}>
              {item.department && (
                <View style={styles.departmentBadge}>
                  <Text style={styles.departmentText} numberOfLines={1}>
                    {item.department}
                  </Text>
                </View>
              )}
              {(item.role || item.designation) && (
                <Text style={styles.roleText} numberOfLines={1}>
                  {item.designation || item.role}
                </Text>
              )}
            </View>
            {item.email && (
              <View style={styles.emailRow}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={13}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emailText} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    []
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="account-search-outline"
          size={48}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>No Employees Found</Text>
        <Text style={styles.emptyText}>
          {debouncedSearch
            ? "Try adjusting your search query."
            : "The employee directory is empty."}
        </Text>
      </View>
    );
  }, [isLoading, debouncedSearch]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <ActivityIndicator
        size="small"
        color={COLORS.primary}
        style={styles.footerLoader}
      />
    );
  }, [isFetchingNextPage]);

  const keyExtractor = useCallback(
    (item: any, index: number) => item._id || item.id || String(index),
    []
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
              <Text style={styles.headerTitle}>Directory</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={COLORS.textMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, department, role..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={handleSearchChange}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            mode="flat"
            dense
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setDebouncedSearch("");
                if (debounceRef.current) clearTimeout(debounceRef.current);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={employees}
          renderItem={renderEmployee}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
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
    paddingTop: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  // Search
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "transparent",
    height: 44,
    paddingHorizontal: 0,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // List
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    flexGrow: 1,
  },
  // Employee card
  employeeCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: "center",
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
  },
  employeeInfo: {
    flex: 1,
    gap: 3,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  employeeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  departmentBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs - 1,
    borderRadius: RADIUS.sm,
  },
  departmentText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: 1,
  },
  emailText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACING.xl + SPACING.md,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
    textAlign: "center",
  },
  // Footer loader
  footerLoader: {
    marginVertical: SPACING.lg,
  },
});
