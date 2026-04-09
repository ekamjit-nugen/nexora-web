import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import {
  Text,
  Searchbar,
  ActivityIndicator,
  Badge,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { chatApi } from "../../lib/api";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

interface Conversation {
  _id: string;
  name: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  isGroup?: boolean;
  participants?: { firstName: string; lastName: string }[];
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

export default function ChatScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: conversationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => chatApi.getConversations(),
    retry: 1,
  });

  const conversations: Conversation[] = conversationsData?.data || [];

  const filteredConversations = conversations.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unreadCount || 0) > 0;
    const avatarColor = getAvatarColor(item.name);

    return (
      <TouchableOpacity activeOpacity={0.6} style={styles.conversationRow} onPress={() => router.push(`/chat/${item._id}`)}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + "18" }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>
              {getInitials(item.name)}
            </Text>
          </View>
          {item.isGroup && (
            <View style={styles.groupBadge}>
              <MaterialCommunityIcons name="account-multiple" size={10} color="#FFFFFF" />
            </View>
          )}
          {hasUnread && (
            <Badge style={styles.unreadBadge} size={18}>
              {item.unreadCount}
            </Badge>
          )}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.conversationName, hasUnread && styles.conversationNameUnread]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.conversationTime, hasUnread && { color: COLORS.primary }]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>
          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
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
            <Text style={styles.headerTitle}>Chat</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search conversations..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          elevation={0}
          icon={() => <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} />}
          theme={{ roundness: RADIUS.md }}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversation}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="chat-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? "Try a different search term"
              : "Start chatting with your team from the web app.\nConversations will appear here."}
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
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
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
    paddingBottom: SPACING.xxl + 20,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatarContainer: {
    marginRight: SPACING.md,
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
  },
  groupBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: COLORS.primary,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  conversationNameUnread: {
    fontWeight: "700",
  },
  conversationTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  lastMessageUnread: {
    color: COLORS.text,
    fontWeight: "500",
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
