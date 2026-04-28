import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Hero } from "../../components/Hero";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { timesheetApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

function getWeekBounds(date: Date): { start: string; end: string; label: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const label = `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    label,
  };
}

export default function CreateTimesheetScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  const weeks = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const bounds = getWeekBounds(d);
      result.push({
        ...bounds,
        title: i === 0 ? "Current Week" : i === 1 ? "Last Week" : `${i} Weeks Ago`,
      });
    }
    return result;
  }, []);

  const createMutation = useMutation({
    mutationFn: () => {
      const week = weeks[selectedWeekIndex];
      return timesheetApi.create({
        period: {
          startDate: week.start,
          endDate: week.end,
          type: "weekly",
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      const newId = res?.data?._id;
      if (newId) {
        router.replace(`/timesheets/${newId}`);
      } else {
        router.back();
      }
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to create timesheet");
    },
  });

  return (
    <View style={styles.container}>
      <Hero title="New Timesheet" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="calendar-week" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Select Week</Text>
          </View>

          {weeks.map((week, idx) => (
            <TouchableOpacity
              key={week.start}
              style={[
                styles.weekOption,
                selectedWeekIndex === idx && styles.weekOptionSelected,
                idx < weeks.length - 1 && styles.weekOptionBorder,
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedWeekIndex(idx)}
            >
              <View style={styles.weekRadio}>
                <View
                  style={[
                    styles.weekRadioOuter,
                    selectedWeekIndex === idx && styles.weekRadioOuterSelected,
                  ]}
                >
                  {selectedWeekIndex === idx && <View style={styles.weekRadioInner} />}
                </View>
              </View>
              <View style={styles.weekInfo}>
                <Text style={[styles.weekTitle, selectedWeekIndex === idx && styles.weekTitleSelected]}>
                  {week.title}
                </Text>
                <Text style={styles.weekDates}>{week.label}</Text>
              </View>
              {idx === 0 && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected Summary */}
        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryText}>
              A weekly timesheet will be created for{" "}
              <Text style={styles.summaryBold}>{weeks[selectedWeekIndex].label}</Text>.
            </Text>
            <Text style={styles.summarySubtext}>
              You can auto-populate entries from your tasks after creation.
            </Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createBtn, createMutation.isPending && styles.createBtnDisabled]}
          activeOpacity={0.8}
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="plus-circle" size={20} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create Timesheet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  weekOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  weekOptionSelected: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  weekOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  weekRadio: {
    width: 24,
    alignItems: "center",
  },
  weekRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRadioOuterSelected: {
    borderColor: COLORS.primary,
  },
  weekRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  weekInfo: {
    flex: 1,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  weekTitleSelected: {
    color: COLORS.primary,
  },
  weekDates: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  currentBadge: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.success,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  summaryBold: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  summarySubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    ...SHADOWS.colored(COLORS.primary),
  },
  createBtnDisabled: {
    opacity: 0.7,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
