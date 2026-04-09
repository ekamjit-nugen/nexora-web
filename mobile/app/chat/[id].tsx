import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi } from "../../lib/api";
import { chatSocket } from "../../lib/socket";
import { useAuth } from "../../lib/auth-context";
import { COLORS, SPACING, RADIUS, SHADOWS } from "../../lib/theme";

interface Message {
  _id: string;
  content: string;
  type?: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  conversationId: string;
  createdAt: string;
  readBy?: string[];
  replyTo?: Message;
}

interface Conversation {
  _id: string;
  name: string;
  type: string;
  participants: Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }>;
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

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isSameDay(d1: string, d2: string): boolean {
  return new Date(d1).toDateString() === new Date(d2).toDateString();
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimeouts = useRef<NodeJS.Timeout[]>([]);
  const isTypingRef = useRef(false);

  // Fetch conversation details
  const { data: conversationData } = useQuery({
    queryKey: ["chat", "conversation", id],
    queryFn: () => chatApi.getConversation(id!),
    enabled: !!id,
  });

  const conversation: Conversation | null = conversationData?.data || null;

  // Fetch messages
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["chat", "messages", id],
    queryFn: () => chatApi.getMessages(id!, { limit: 50 }),
    enabled: !!id,
  });

  // Set initial messages from query
  useEffect(() => {
    if (messagesData?.data) {
      setMessages(messagesData.data);
    }
  }, [messagesData]);

  // Mark conversation as read
  useEffect(() => {
    if (id) {
      chatApi.markAsRead(id).catch(() => {});
    }
  }, [id]);

  // Socket connection and events
  useEffect(() => {
    if (!id) return;

    chatSocket.connect();
    chatSocket.joinConversation(id);

    const unsubNewMessage = chatSocket.on("message:new", (message: Message) => {
      if (message.conversationId === id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [message, ...prev];
        });
        chatApi.markAsRead(id).catch(() => {});
        // Invalidate conversation list to update last message
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }
    });

    const unsubTypingStart = chatSocket.on(
      "typing:start",
      (data: { userId: string; userName: string; conversationId: string }) => {
        if (data.conversationId === id && data.userId !== user?._id) {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.set(data.userId, data.userName);
            return next;
          });
          // Auto-clear after 3 seconds
          const timeoutId = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              next.delete(data.userId);
              return next;
            });
          }, 3000);
          typingClearTimeouts.current.push(timeoutId);
        }
      }
    );

    const unsubTypingStop = chatSocket.on(
      "typing:stop",
      (data: { userId: string; conversationId: string }) => {
        if (data.conversationId === id) {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
        }
      }
    );

    return () => {
      chatSocket.leaveConversation(id);
      unsubNewMessage();
      unsubTypingStart();
      unsubTypingStop();
      typingClearTimeouts.current.forEach(clearTimeout);
      typingClearTimeouts.current = [];
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [id, user?._id, queryClient]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !id || sending) return;

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    // Stop typing indicator
    if (isTypingRef.current) {
      chatSocket.stopTyping(id);
      isTypingRef.current = false;
    }

    // Optimistic update
    const optimisticMessage: Message = {
      _id: `temp-${Date.now()}`,
      content,
      type: "text",
      sender: {
        _id: user?._id || "",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
      },
      conversationId: id,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMessage, ...prev]);

    try {
      const res = await chatApi.sendMessage(id, content);
      if (res.data) {
        setMessages((prev) =>
          prev.map((m) => (m._id === optimisticMessage._id ? res.data : m))
        );
      }
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m._id !== optimisticMessage._id));
    } finally {
      setSending(false);
    }
  }, [inputText, id, sending, user, queryClient]);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (!id) return;

      if (text.length > 0 && !isTypingRef.current) {
        chatSocket.sendTyping(id);
        isTypingRef.current = true;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current && id) {
          chatSocket.stopTyping(id);
          isTypingRef.current = false;
        }
      }, 2000);
    },
    [id]
  );

  // Get conversation display name
  const getDisplayName = (): string => {
    if (!conversation) return "Chat";
    if (conversation.type === "direct" && conversation.participants) {
      const other = conversation.participants.find((p) => p._id !== user?._id);
      if (other) return `${other.firstName} ${other.lastName}`;
    }
    return conversation.name || "Chat";
  };

  const displayName = getDisplayName();
  const avatarColor = getAvatarColor(displayName);

  // Build typing indicator text
  const typingText = (() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  })();

  // Message list is inverted, so messages array is newest-first
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [messages]
  );

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.sender?._id === user?._id;
    const isSystem = item.type === "system";

    // Date separator: since list is inverted, check the NEXT item (older message)
    const nextMessage = sortedMessages[index + 1];
    const showDateSeparator =
      !nextMessage || !isSameDay(item.createdAt, nextMessage.createdAt);

    // Show sender name in groups (not DMs)
    const showSenderName =
      conversation?.type !== "direct" && !isOwnMessage && !isSystem;

    // Check if previous message (newer) is from same sender
    const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
    const isConsecutive =
      prevMessage &&
      prevMessage.sender?._id === item.sender?._id &&
      isSameDay(prevMessage.createdAt, item.createdAt);

    if (isSystem) {
      return (
        <View>
          {showDateSeparator && (
            <View style={styles.dateSeparator}>
              <View style={styles.dateLine} />
              <Text style={styles.dateText}>{formatDateSeparator(item.createdAt)}</Text>
              <View style={styles.dateLine} />
            </View>
          )}
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const senderName = item.sender
      ? `${item.sender.firstName} ${item.sender.lastName}`
      : "Unknown";
    const senderColor = getAvatarColor(senderName);

    return (
      <View>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDateSeparator(item.createdAt)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View
          style={[
            styles.messageRow,
            isOwnMessage ? styles.messageRowOwn : styles.messageRowOther,
            isConsecutive && { marginTop: 2 },
          ]}
        >
          {/* Avatar for other users */}
          {!isOwnMessage && !isConsecutive ? (
            <View
              style={[
                styles.messageAvatar,
                { backgroundColor: senderColor + "18" },
              ]}
            >
              <Text style={[styles.messageAvatarText, { color: senderColor }]}>
                {getInitials(senderName)}
              </Text>
            </View>
          ) : !isOwnMessage ? (
            <View style={styles.messageAvatarPlaceholder} />
          ) : null}

          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther,
            ]}
          >
            {showSenderName && !isConsecutive && (
              <Text style={[styles.senderName, { color: senderColor }]}>
                {senderName}
              </Text>
            )}
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.messageTextOwn : styles.messageTextOther,
              ]}
            >
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  isOwnMessage ? styles.messageTimeOwn : styles.messageTimeOther,
                ]}
              >
                {formatMessageTime(item.createdAt)}
              </Text>
              {isOwnMessage && (
                <MaterialCommunityIcons
                  name={
                    item.readBy && item.readBy.length > 1
                      ? "check-all"
                      : "check"
                  }
                  size={14}
                  color={
                    item.readBy && item.readBy.length > 1
                      ? "#93C5FD"
                      : "rgba(255,255,255,0.6)"
                  }
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [user, sortedMessages, conversation]);

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
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View
              style={[
                styles.headerAvatar,
                { backgroundColor: avatarColor + "30" },
              ]}
            >
              <Text style={[styles.headerAvatarText, { color: "#FFFFFF" }]}>
                {getInitials(displayName)}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName}
              </Text>
              {conversation?.type === "direct" && (
                <Text style={styles.headerStatus}>
                  {typingText || "Tap for info"}
                </Text>
              )}
              {conversation?.type !== "direct" && (
                <Text style={styles.headerStatus}>
                  {typingText ||
                    `${conversation?.participants?.length || 0} members`}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.headerAction} onPress={() => Alert.alert("Coming Soon", "Voice calls will be available in a future update.")}>
              <MaterialCommunityIcons name="phone-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loadingMessages ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <MaterialCommunityIcons
                  name="chat-plus-outline"
                  size={48}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyMessagesText}>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        {/* Typing indicator */}
        {typingText && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{typingText}</Text>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={() => Alert.alert("Coming Soon", "File attachments will be available in a future update.")}>
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={24}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={4000}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendButton,
              inputText.trim()
                ? styles.sendButtonActive
                : styles.sendButtonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={inputText.trim() ? "#FFFFFF" : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
        <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: SPACING.sm,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerStatus: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  headerAction: {
    padding: SPACING.sm,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginHorizontal: SPACING.md,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 3,
    maxWidth: "85%",
  },
  messageRowOwn: {
    alignSelf: "flex-end",
  },
  messageRowOther: {
    alignSelf: "flex-start",
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.xs,
    marginTop: 2,
  },
  messageAvatarText: {
    fontSize: 11,
    fontWeight: "700",
  },
  messageAvatarPlaceholder: {
    width: 30,
    marginRight: SPACING.xs,
  },
  messageBubble: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 2,
    paddingBottom: SPACING.xs + 2,
    maxWidth: "100%",
  },
  messageBubbleOwn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.xs,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.xs,
    ...SHADOWS.sm,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: "#FFFFFF",
  },
  messageTextOther: {
    color: COLORS.text,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 3,
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeOwn: {
    color: "rgba(255,255,255,0.6)",
  },
  messageTimeOther: {
    color: COLORS.textMuted,
  },
  systemMessage: {
    alignSelf: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  systemMessageText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
  emptyMessages: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xxl,
    // Since list is inverted, we rotate to display correctly
    transform: [{ scaleY: -1 }],
  },
  emptyMessagesText: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  typingContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  typingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  attachButton: {
    padding: SPACING.sm,
    marginBottom: 2,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? SPACING.sm : SPACING.xs,
    maxHeight: 120,
    marginHorizontal: SPACING.xs,
  },
  textInput: {
    fontSize: 15,
    color: COLORS.text,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.borderLight,
  },
  bottomSafe: {
    backgroundColor: COLORS.surface,
  },
});
