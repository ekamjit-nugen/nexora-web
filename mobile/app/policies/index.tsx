import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { policyApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const CATEGORY_COLORS: Record<string, string> = {
  attendance: COLORS.primary,
  leave: COLORS.success,
  conduct: COLORS.secondary,
  security: COLORS.danger,
  hr: COLORS.accent,
  general: COLORS.textSecondary,
};

const CATEGORY_ICONS: Record<string, string> = {
  attendance: "clock-check-outline",
  leave: "calendar-check-outline",
  conduct: "account-group-outline",
  security: "shield-lock-outline",
  hr: "badge-account-horizontal-outline",
  general: "file-document-outline",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category?.toLowerCase()] || COLORS.textSecondary;
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category?.toLowerCase()] || "file-document-outline";
}

function getCategoryLabel(category: string): string {
  return (category || "general")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PoliciesIndexScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: policiesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["policies", "applicable"],
    queryFn: () => policyApi.getApplicable(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const policies = policiesData?.data || [];

  const renderPolicyCard = ({ item }: { item: any }) => {
    const category = item.category || "general";
    const catColor = getCategoryColor(category);
    const isAcknowledged = !!item.acknowledged || !!item.acknowledgedAt;

    return (
      <TouchableOpacity
        style={styles.policyCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/policies/${item._id}`)}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconCircle, { backgroundColor: catColor + "15" }]}>
              <MaterialCommunityIcons
                name={getCategoryIcon(category) as any}
                size={20}
                color={catColor}
              />
            </View>
            <View style={styles.cardTitleArea}>
              <Text style={styles.policyTitle} numberOfLines={1}>
                {item.title || item.name}
              </Text>
              <View style={[styles.categoryBadge, { backgroundColor: catColor + "15" }]}>
                <Text style={[styles.categoryBadgeText, { color: catColor }]}>
                  {getCategoryLabel(category)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.policyDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.cardBottom}>
          {item.effectiveDate && (
            <View style={styles.dateRow}>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={13}
                color={COLORS.textMuted}
              />
              <Text style={styles.dateText}>
                Effective {formatDate(item.effectiveDate)}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isAcknowledged
                  ? COLORS.successLight
                  : COLORS.warningLight,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={isAcknowledged ? "check-circle" : "clock-outline"}
              size={14}
              color={isAcknowledged ? COLORS.success : COLORS.warning}
            />
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color: isAcknowledged ? COLORS.success : COLORS.warning,
                },
              ]}
            >
              {isAcknowledged ? "Acknowledged" : "Pending"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={48}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>No Policies</Text>
        <Text style={styles.emptyText}>
          There are no company policies available at the moment.
        </Text>
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
              <Text style={styles.headerTitle}>Company Policies</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={policies}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderPolicyCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
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
    marginBottom: SPACING.sm,
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
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  // Policy card
  policyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  cardTitleArea: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
    marginBottom: SPACING.xs,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  policyDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
});
