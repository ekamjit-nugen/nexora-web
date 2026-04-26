import { Tabs } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, View, StyleSheet, Platform, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { COLORS, SHADOWS } from "../../lib/theme";
import { notificationApi } from "../../lib/api";

export default function TabsLayout() {
  const { user, loading, isFeatureEnabled } = useAuth();
  const router = useRouter();

  // Per-tenant gating. Each tab maps to a feature; setting `href: null`
  // on the screen options hides the tab from the bar without
  // unmounting the route, which keeps deep-linking from a notification
  // intact (e.g. a stale "Tasks" notification deep-links cleanly even
  // if Tasks is later disabled — the screen still loads, it just
  // doesn't appear in the bottom bar). Time tab covers both
  // attendance + leaves; show it if either is enabled.
  const showTime = isFeatureEnabled("attendance") || isFeatureEnabled("leaves");
  const showWork = isFeatureEnabled("tasks");
  const showChat = isFeatureEnabled("chat");

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 30000,
    enabled: !!user,
    retry: 1,
  });

  const unreadCount = unreadData?.data?.count ?? 0;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/(auth)/login");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: COLORS.tabBar,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
          ...SHADOWS.md,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
          tabBarBadgeStyle: unreadCount > 0 ? styles.tabBadge : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-variant" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="time"
        options={{
          title: "Time",
          tabBarLabel: "Time",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clock-outline" size={24} color={color} />
          ),
          href: showTime ? "/time" : null,
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: "Work",
          tabBarLabel: "Work",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="briefcase-outline" size={24} color={color} />
          ),
          href: showWork ? "/work" : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat-outline" size={24} color={color} />
          ),
          href: showChat ? "/chat" : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  tabBadge: {
    backgroundColor: COLORS.danger,
    fontSize: 10,
    fontWeight: "700",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
  },
});
