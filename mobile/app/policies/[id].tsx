import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Hero } from "../../components/Hero";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
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

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category?.toLowerCase()] || COLORS.textSecondary;
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

export default function PolicyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: policyData,
    isLoading,
  } = useQuery({
    queryKey: ["policies", id],
    queryFn: () => policyApi.getById(id!),
    enabled: !!id,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => policyApi.acknowledge(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies", id] });
      queryClient.invalidateQueries({ queryKey: ["policies", "applicable"] });
      Alert.alert("Success", "Policy acknowledged successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to acknowledge policy.");
    },
  });

  const handleAcknowledge = () => {
    Alert.alert(
      "Acknowledge Policy",
      "By acknowledging, you confirm that you have read and understood this policy.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I Acknowledge",
          onPress: () => acknowledgeMutation.mutate(),
        },
      ]
    );
  };

  const policy = policyData?.data;
  const isAcknowledged = !!policy?.acknowledged || !!policy?.acknowledgedAt;
  const category = policy?.category || "general";
  const catColor = getCategoryColor(category);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Hero title="Policy" showBack />
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      </View>
    );
  }

  if (!policy) {
    return (
      <View style={styles.container}>
        <Hero title="Policy" showBack />
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="file-remove-outline"
            size={48}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyTitle}>Policy Not Found</Text>
          <Text style={styles.emptyText}>
            This policy may have been removed or is no longer available.
          </Text>
        </View>
      </View>
    );
  }

  // Split content into paragraphs for rendering
  const contentParagraphs = (policy.content || policy.body || "")
    .split(/\n\n+/)
    .filter((p: string) => p.trim());

  return (
    <View style={styles.container}>
      <Hero title={policy.title || policy.name || "Policy"} showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Badges row */}
        <View style={styles.badgesRow}>
          <View
            style={[styles.categoryBadge, { backgroundColor: catColor + "15" }]}
          >
            <Text style={[styles.categoryBadgeText, { color: catColor }]}>
              {getCategoryLabel(category)}
            </Text>
          </View>
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

        {/* Meta info card */}
        <View style={styles.metaCard}>
          {policy.effectiveDate && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.metaLabel}>Effective Date</Text>
              <Text style={styles.metaValue}>
                {formatDate(policy.effectiveDate)}
              </Text>
            </View>
          )}
          {policy.version && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name="tag-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.metaLabel}>Version</Text>
              <Text style={styles.metaValue}>{policy.version}</Text>
            </View>
          )}
          {isAcknowledged && (policy.acknowledgedAt || policy.acknowledgedDate) && (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={16}
                color={COLORS.success}
              />
              <Text style={styles.metaLabel}>Acknowledged On</Text>
              <Text style={[styles.metaValue, { color: COLORS.success }]}>
                {formatDate(policy.acknowledgedAt || policy.acknowledgedDate)}
              </Text>
            </View>
          )}
        </View>

        {/* Policy content */}
        <View style={styles.contentCard}>
          {policy.description && (
            <Text style={styles.descriptionText}>{policy.description}</Text>
          )}
          {contentParagraphs.map((paragraph: string, index: number) => (
            <Text key={index} style={styles.contentParagraph}>
              {paragraph.trim()}
            </Text>
          ))}
          {contentParagraphs.length === 0 && !policy.description && (
            <Text style={styles.noContentText}>
              No policy content available.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Acknowledge button */}
      {!isAcknowledged && (
        <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.acknowledgeBtn}
            activeOpacity={0.85}
            onPress={handleAcknowledge}
            disabled={acknowledgeMutation.isPending}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.acknowledgeBtnGradient}
            >
              {acknowledgeMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.acknowledgeBtnText}>I Acknowledge</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
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
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    flex: 1,
    textAlign: "center",
    marginHorizontal: SPACING.sm,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  // Badges
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
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
  // Meta card
  metaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
    flex: 1,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  // Content card
  contentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  descriptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  contentParagraph: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  noContentText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: SPACING.lg,
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  acknowledgeBtn: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...SHADOWS.colored(COLORS.primary),
  },
  acknowledgeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  acknowledgeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
    paddingHorizontal: SPACING.lg,
  },
});
