import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { Text, TextInput, Button, ActivityIndicator, Switch } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { leaveApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

const LEAVE_TYPES = [
  { key: "casual", label: "Casual", icon: "beach", color: COLORS.primary },
  { key: "sick", label: "Sick", icon: "hospital-box-outline", color: COLORS.danger },
  { key: "earned", label: "Earned", icon: "star-outline", color: COLORS.success },
  { key: "comp_off", label: "Comp Off", icon: "swap-horizontal", color: COLORS.secondary },
  { key: "wfh", label: "WFH", icon: "home-outline", color: COLORS.accent },
  { key: "lop", label: "LOP", icon: "alert-circle-outline", color: COLORS.warning },
];

const HALF_DAY_OPTIONS = [
  { key: "first_half", label: "First Half" },
  { key: "second_half", label: "Second Half" },
];

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ApplyLeaveScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [leaveType, setLeaveType] = useState("casual");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState("");
  const [halfDayEnabled, setHalfDayEnabled] = useState(false);
  const [halfDayPart, setHalfDayPart] = useState("first_half");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [error, setError] = useState("");

  // Fetch balance
  const { data: balanceData } = useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: () => leaveApi.getBalance(),
  });

  const selectedBalance = useMemo(() => {
    const balances = balanceData?.data || [];
    return balances.find(
      (b: any) => (b.type || b.leaveType) === leaveType
    );
  }, [balanceData, leaveType]);

  const remaining = selectedBalance?.remaining ?? selectedBalance?.balance ?? null;

  // Days calculation
  const dayCount = useMemo(() => {
    if (halfDayEnabled) return 0.5;
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diffDays, 1);
  }, [startDate, endDate, halfDayEnabled]);

  // Mutation
  const applyMutation = useMutation({
    mutationFn: (data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason: string;
      halfDay?: { enabled: boolean; date?: string; half?: string };
    }) => leaveApi.apply(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      Alert.alert("Success", "Leave request submitted successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      setError(err.message || "Failed to apply leave");
    },
  });

  const validate = (): boolean => {
    setError("");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      setError("Start date cannot be in the past");
      return false;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date");
      return false;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for your leave");
      return false;
    }
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters");
      return false;
    }
    if (remaining !== null && dayCount > remaining) {
      setError(`Insufficient balance. You have ${remaining} day(s) remaining`);
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload: any = {
      leaveType,
      startDate: formatDateForApi(startDate),
      endDate: halfDayEnabled ? formatDateForApi(startDate) : formatDateForApi(endDate),
      reason: reason.trim(),
    };

    if (halfDayEnabled) {
      payload.halfDay = {
        enabled: true,
        date: formatDateForApi(startDate),
        half: halfDayPart,
      };
    }

    applyMutation.mutate(payload);
  };

  const onStartDateChange = (_: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selectedDate) {
      setStartDate(selectedDate);
      if (selectedDate > endDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const onEndDateChange = (_: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const selectedTypeInfo = LEAVE_TYPES.find((t) => t.key === leaveType);

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
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Apply Leave</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Leave Type Selector */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="tag-outline" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Leave Type</Text>
            </View>
            <View style={styles.typeGrid}>
              {LEAVE_TYPES.map((type) => {
                const isSelected = leaveType === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeBtn,
                      isSelected && { backgroundColor: type.color + "15", borderColor: type.color },
                    ]}
                    onPress={() => setLeaveType(type.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={20}
                      color={isSelected ? type.color : COLORS.textMuted}
                    />
                    <Text
                      style={[
                        styles.typeBtnText,
                        isSelected && { color: type.color, fontWeight: "700" },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {remaining !== null && (
              <View style={[styles.balanceHint, { backgroundColor: (selectedTypeInfo?.color || COLORS.primary) + "10" }]}>
                <MaterialCommunityIcons name="information-outline" size={16} color={selectedTypeInfo?.color || COLORS.primary} />
                <Text style={[styles.balanceHintText, { color: selectedTypeInfo?.color || COLORS.primary }]}>
                  {remaining} day(s) available
                </Text>
              </View>
            )}
          </View>

          {/* Date Selection */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="calendar-range" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Duration</Text>
              {!halfDayEnabled && (
                <View style={styles.dayCountBadge}>
                  <Text style={styles.dayCountText}>{dayCount} day{dayCount !== 1 ? "s" : ""}</Text>
                </View>
              )}
            </View>

            {/* Half Day Toggle */}
            <View style={styles.halfDayRow}>
              <View style={styles.halfDayLabel}>
                <MaterialCommunityIcons name="clock-fast" size={18} color={COLORS.textSecondary} />
                <Text style={styles.halfDayText}>Half Day</Text>
              </View>
              <Switch
                value={halfDayEnabled}
                onValueChange={setHalfDayEnabled}
                color={COLORS.primary}
              />
            </View>

            {halfDayEnabled && (
              <View style={styles.halfDayOptions}>
                {HALF_DAY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.halfDayBtn,
                      halfDayPart === opt.key && styles.halfDayBtnActive,
                    ]}
                    onPress={() => setHalfDayPart(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.halfDayBtnText,
                        halfDayPart === opt.key && styles.halfDayBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Start Date */}
            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateFieldLeft}>
                <MaterialCommunityIcons name="calendar-start" size={20} color={COLORS.primary} />
                <View>
                  <Text style={styles.dateFieldLabel}>
                    {halfDayEnabled ? "Date" : "Start Date"}
                  </Text>
                  <Text style={styles.dateFieldValue}>{formatDateDisplay(startDate)}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={onStartDateChange}
              />
            )}

            {/* End Date (not for half day) */}
            {!halfDayEnabled && (
              <>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setShowEndPicker(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateFieldLeft}>
                    <MaterialCommunityIcons name="calendar-end" size={20} color={COLORS.danger} />
                    <View>
                      <Text style={styles.dateFieldLabel}>End Date</Text>
                      <Text style={styles.dateFieldValue}>{formatDateDisplay(endDate)}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>

                {showEndPicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={startDate}
                    onChange={onEndDateChange}
                  />
                )}
              </>
            )}
          </View>

          {/* Reason */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="text" size={18} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Reason</Text>
            </View>
            <TextInput
              value={reason}
              onChangeText={(text) => { setReason(text); setError(""); }}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Describe the reason for your leave..."
              style={styles.reasonInput}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              theme={{ roundness: RADIUS.md }}
            />
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={applyMutation.isPending}
            activeOpacity={0.85}
            style={[styles.submitBtn, applyMutation.isPending && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.submitBtnGradient}
            >
              {applyMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    ...SHADOWS.sm,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  // Type grid
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  balanceHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.md,
  },
  balanceHintText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Half day
  halfDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  halfDayLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  halfDayText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  halfDayOptions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  halfDayBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  halfDayBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  halfDayBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  halfDayBtnTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  // Date fields
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  dateFieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  dateFieldLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateFieldValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 2,
  },
  dayCountBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  dayCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  // Reason
  reasonInput: {
    backgroundColor: COLORS.surface,
  },
  // Error
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerLight,
    marginBottom: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: "500",
  },
  // Submit
  submitBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...SHADOWS.colored(COLORS.primary),
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
