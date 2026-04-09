import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Text, Searchbar } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi, employeeApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  position?: string;
  avatar?: string;
}

const AVATAR_COLORS = [
  "#2563EB", "#7C3AED", "#0EA5E9", "#10B981",
  "#F59E0B", "#EF4444", "#EC4899", "#6366F1",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function NewChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ["employees", searchQuery],
    queryFn: () => employeeApi.getAll({ search: searchQuery || undefined }),
    retry: 1,
  });

  const employees: Employee[] = (employeesData?.data || []).filter(
    (e: Employee) => e._id !== user?._id
  );

  const handleSelectEmployee = useCallback(
    async (employee: Employee) => {
      if (creating) return;
      setCreating(employee._id);

      try {
        const res = await chatApi.createDirectConversation(employee._id);
        const conversation = res.data;
        if (conversation?._id) {
          router.replace(`/chat/${conversation._id}`);
        }
      } catch {
        // Creation may fail if conversation already exists, try navigating anyway
        setCreating(null);
      }
    },
    [creating, router]
  );

  const renderEmployee = ({ item }: { item: Employee }) => {
    const fullName = `${item.firstName} ${item.lastName}`;
    const avatarColor = getAvatarColor(fullName);
    const isCreating = creating === item._id;

    return (
      <TouchableOpacity
        activeOpacity={0.6}
        style={styles.employeeRow}
        onPress={() => handleSelectEmployee(item)}
        disabled={!!creating}
      >
        <View style={[styles.avatar, { backgroundColor: avatarColor + "18" }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>
            {getInitials(fullName)}
          </Text>
        </View>

        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName} numberOfLines={1}>
            {fullName}
          </Text>
          {(item.position || item.department) && (
            <Text style={styles.employeeRole} numberOfLines={1}>
              {[item.position, item.department].filter(Boolean).join(" · ")}
            </Text>
          )}
          <Text style={styles.employeeEmail} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        {isCreating ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <MaterialCommunityIcons
            name="message-plus-outline"
            size={22}
            color={COLORS.primary}
          />
        )}
      </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Message</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search people..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          elevation={0}
          icon={() => (
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={COLORS.textMuted}
            />
          )}
          theme={{ roundness: RADIUS.md }}
          autoFocus
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : employees.length > 0 ? (
        <FlatList
          data={employees}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployee}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />
      ) : (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons
              name="account-search-outline"
              size={36}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No people found" : "Search for a colleague"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? "Try a different name or email"
              : "Find someone to start a conversation with"}
          </Text>
        </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.background,
  },
  searchBar: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    height: 46,
    ...SHADOWS.sm,
  },
  searchInput: {
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  employeeInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  employeeRole: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  employeeEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
});
