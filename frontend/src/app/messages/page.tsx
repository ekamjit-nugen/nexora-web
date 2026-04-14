"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { chatApi, hrApi, uploadFileWithProgress } from "@/lib/api";
import type { Conversation, ChatMessage, Employee, ChatSettings } from "@/lib/api";
import { useGlobalSocket } from "@/lib/socket-context";
import { useWebRTC } from "@/lib/hooks/useWebRTC";
import { useCallContext, type AnnotationStroke } from "@/lib/call-context";

// VideoCallWindow attaches imperative annotation methods onto its internal canvas
// element. We look them up via this structural type instead of using `as any`.
interface AnnotationCanvas extends HTMLCanvasElement {
  __clearCanvas?: () => void;
  __drawRemoteStroke?: (stroke: AnnotationStroke) => void;
}
function getAnnotationCanvas(): AnnotationCanvas | null {
  return document.querySelector<HTMLCanvasElement>("canvas") as AnnotationCanvas | null;
}
import {
  ThreadPanel, StatusSetter,
  GlobalSearch, FileBrowser, PinnedMessages, BookmarksList, AiSummaryPanel,
  VoiceHuddle, ForwardModal,
  ConversationSidebar, ChatHeader, MessageList, ChatInput, CallOverlay,
} from "@/components/chat";
import { GuestAccessPanel } from "@/components/chat/GuestAccessPanel";
import type { TabFilter } from "@/components/chat";
import { toast } from "sonner";
import { useOfflineCache } from "@/lib/hooks/useOfflineCache";
import { useConversationDrafts } from "@/lib/hooks/useConversationDrafts";
import { getInitials } from "@/lib/utils";

// ── Upload validation constants ──
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_PATTERNS = [
  /^image\//, /^video\//, /^audio\//, /^application\/pdf$/,
  /^application\/msword$/, /^application\/vnd\.openxmlformats/,
  /^application\/vnd\.ms-/, /^text\//, /^application\/zip$/,
  /^application\/x-zip/, /^application\/json$/,
];

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.msi', '.ps1', '.sh', '.com', '.scr', '.pif', '.vbs', '.js', '.wsf'];

function isFileTypeAllowed(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) return false;
  if (!file.type) return true;
  return ALLOWED_MIME_PATTERNS.some(pattern => pattern.test(file.type));
}

// ── Page ──

export default function MessagesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Data
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexora_active_chat") || null;
    }
    return null;
  });
  useEffect(() => {
    if (activeId) localStorage.setItem("nexora_active_chat", activeId);
    else localStorage.removeItem("nexora_active_chat");
  }, [activeId]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, Employee>>({});
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Tab Unread Badge ──
  useEffect(() => {
    if (!user) return;
    const totalUnread = conversations.reduce((count, convo) => {
      const participant = convo.participants.find((p) => p.userId === user._id);
      if (!participant?.lastReadAt || !convo.lastMessage?.sentAt) return count;
      if (new Date(convo.lastMessage.sentAt) > new Date(participant.lastReadAt)) return count + 1;
      return count;
    }, 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) Nexora` : "Nexora";
    return () => { document.title = "Nexora"; };
  }, [conversations, user]);

  // UI state
  const [tab, setTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [input, setInput] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showConvoMenu, setShowConvoMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showGuestPanel, setShowGuestPanel] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Calling state
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [showCallWindow, setShowCallWindow] = useState(false);
  const [callDisconnected, setCallDisconnected] = useState(false);
  const [showCallChat, setShowCallChat] = useState(false);
  const [callChatMsg, setCallChatMsg] = useState("");
  const [callChatMessages, setCallChatMessages] = useState<Array<{ id: string; senderId: string; content: string; createdAt: string }>>([]);
  const [callChatUnread, setCallChatUnread] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isCaller, setIsCaller] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isViewerAnnotating, setIsViewerAnnotating] = useState(false);
  const [annotationColor, setAnnotationColor] = useState("#FF3B30");
  const [annotationBrushSize, setAnnotationBrushSize] = useState(3);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number; startTime: number }>>([]);
  const [remotePointers, setRemotePointers] = useState<Array<{ userId: string; name: string; x: number; y: number; color: string }>>([]);
  const [callStartTime, setCallStartTime] = useState<string | null>(null);
  const [showPreCallPreview, setShowPreCallPreview] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [showCallFeedback, setShowCallFeedback] = useState(false);
  const [feedbackCallId, setFeedbackCallId] = useState<string | null>(null);
  const [feedbackCallDuration, setFeedbackCallDuration] = useState(0);
  const [preHoldAudioState, setPreHoldAudioState] = useState(true);
  const [preHoldVideoState, setPreHoldVideoState] = useState(false);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const callWindowRef = useRef<HTMLDivElement>(null);
  const callDurationRef = useRef<NodeJS.Timeout | null>(null);
  const webrtcInitializedRef = useRef(false);
  const offerSentRef = useRef(false);
  const offerRetryRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iceRestartAttemptRef = useRef(false);
  const iceRestartResetRef = useRef<NodeJS.Timeout | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // New group form
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

  // Channel form
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelMembers, setChannelMembers] = useState<Employee[]>([]);
  const [savingChannel, setSavingChannel] = useState(false);

  // Add people
  const [addPeopleMembers, setAddPeopleMembers] = useState<Employee[]>([]);
  const [savingConvert, setSavingConvert] = useState(false);

  // Thread panel
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null);

  // Status setter modal
  const [showStatusSetter, setShowStatusSetter] = useState(false);

  // Global search
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Side panels
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);

  // Smart replies
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const smartRepliesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Schedule
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Read receipt popup
  const [readReceiptMsg, setReadReceiptMsg] = useState<string | null>(null);
  const [readReceiptData, setReadReceiptData] = useState<Array<{ userId: string; readAt: string }>>([]);
  const [readReceiptLoading, setReadReceiptLoading] = useState(false);
  const [readReceiptPos, setReadReceiptPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const readReceiptRef = useRef<HTMLDivElement>(null);

  // File upload
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);

  // Socket
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calling hooks
  const webrtc = useWebRTC();
  const signaling = useCallContext();
  const webrtcRef = useRef(webrtc);
  const signalingRef = useRef(signaling);
  useEffect(() => { webrtcRef.current = webrtc; });
  useEffect(() => { signalingRef.current = signaling; });
  const { onOffer, onAnswerSdp, onIceCandidate, onEnded } = signaling;

  const rtcConfig = useMemo(
    () => ({ iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] }),
    [],
  );

  const activeConvo = conversations.find((c) => c._id === activeId) || null;
  const callConversation = activeConvo || (signaling.call?.conversationId ? conversations.find((c) => c._id === signaling.call?.conversationId) || null : null);

  // ── Offline Cache & Drafts ──
  const offlineCache = useOfflineCache();
  const drafts = useConversationDrafts();

  // ── Socket ──
  const { connected, emit, on, onlineUsers: onlineUserIds, presenceMap } = useGlobalSocket();

  // ── Control message handler ──
  const handleControlMessage = useCallback((msg: { type: string; hasVideo?: boolean }) => {
    if (msg.type === "media-state") setRemoteHasVideo(!!msg.hasVideo);
  }, []);

  useEffect(() => { if (!showCallWindow) setRemoteHasVideo(false); }, [showCallWindow]);

  // ── Cmd+K global search shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowGlobalSearch(prev => !prev); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Auth guard ──
  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);

  // ── Load employees ──
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await hrApi.getEmployees({ limit: "100" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emps = (res.data || []).filter((e: any) => e.email !== user?.email);
      setAllEmployees(emps);
      const map: Record<string, Employee> = {};
      for (const e of emps) { map[e.userId] = e; map[e._id] = e; }
      setEmployeeMap(map);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { if (user) fetchEmployees(); }, [user, fetchEmployees]);

  // ── Load chat settings ──
  useEffect(() => {
    if (!user) return;
    chatApi.getSettings().then((res) => { if (res.data) setChatSettings(res.data); }).catch(() => {});
  }, [user]);

  const updateChatSettings = useCallback((patch: Partial<ChatSettings>) => {
    setChatSettings((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        readReceipts: { ...prev.readReceipts, ...(patch.readReceipts || {}) },
        appearance: { ...prev.appearance, ...(patch.appearance || {}) },
        notifications: { ...prev.notifications, ...(patch.notifications || {}) },
      };
      if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
      settingsDebounceRef.current = setTimeout(() => {
        chatApi.updateSettings(patch).catch(() => toast.error("Failed to save settings"));
      }, 600);
      return updated;
    });
  }, []);

  // ── Fetch conversations (with offline cache) ──
  const offlineCacheRef = useRef(offlineCache);
  offlineCacheRef.current = offlineCache;

  const fetchConversations = useCallback(async () => {
    const cache = offlineCacheRef.current;
    if (cache.isSupported) {
      try {
        const cached = await cache.getCachedConversations();
        if (cached.length > 0) { setConversations(cached as Conversation[]); setLoadingConvos(false); }
      } catch { /* IndexedDB read failed */ }
    }
    if (navigator.onLine) {
      try {
        const res = await chatApi.getConversations();
        const data = res.data || [];
        setConversations(data);
        if (cache.isSupported && data.length > 0) {
          cache.cacheConversations(data).catch(() => {});
          cache.setLastSyncTimestamp(new Date().toISOString()).catch(() => {});
        }
      } catch { /* silent */ }
    }
    setLoadingConvos(false);
  }, []);

  useEffect(() => { if (user) fetchConversations(); }, [user, fetchConversations]);

  // ── Fetch messages ──
  const fetchMessages = useCallback(async (convoId: string) => {
    const cache = offlineCacheRef.current;
    setLoadingMessages(true);
    if (cache.isSupported) {
      try {
        const cached = await cache.getCachedMessages(convoId, 100);
        if (cached.length > 0) { setMessages(cached as ChatMessage[]); setLoadingMessages(false); }
      } catch { /* IndexedDB read failed */ }
    }
    if (navigator.onLine) {
      try {
        const res = await chatApi.getMessages(convoId, { limit: "100" });
        const data = res.data || [];
        setMessages(data);
        chatApi.markAsRead(convoId).catch(() => {});
        if (cache.isSupported && data.length > 0) cache.cacheMessages(convoId, data).catch(() => {});
      } catch { if (!cache.isSupported) setMessages([]); }
    }
    setLoadingMessages(false);
  }, []);

  // Save/restore drafts on conversation switch
  const prevActiveIdForDraftRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveIdForDraftRef.current && prevActiveIdForDraftRef.current !== activeId) {
      drafts.setDraft(prevActiveIdForDraftRef.current, input);
    }
    if (activeId) { const restored = drafts.getDraft(activeId); setInput(restored); fetchMessages(activeId); }
    else setMessages([]);
    prevActiveIdForDraftRef.current = activeId;
  }, [activeId, fetchMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Smart replies ──
  useEffect(() => {
    setSmartReplies([]);
    if (!activeId || !user) return;
    if (smartRepliesTimerRef.current) clearTimeout(smartRepliesTimerRef.current);
    smartRepliesTimerRef.current = setTimeout(async () => {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.senderId === user._id) { setSmartReplies([]); return; }
      try { const res = await chatApi.getSmartReplies(activeId); setSmartReplies(res.data?.replies || []); }
      catch { setSmartReplies([]); }
    }, 600);
    return () => { if (smartRepliesTimerRef.current) clearTimeout(smartRepliesTimerRef.current); };
  }, [activeId, messages[messages.length - 1]?._id, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delta sync on reconnect ──
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !prevConnectedRef.current && user) { fetchConversations(); if (activeId) fetchMessages(activeId); }
    prevConnectedRef.current = connected;
  }, [connected, user, activeId, fetchConversations, fetchMessages]);

  // ── Socket events ──
  useEffect(() => {
    if (!activeId || !connected) return;
    emit("conversation:join", { conversationId: activeId });
  }, [activeId, connected, emit]);

  useEffect(() => {
    if (!connected) return;
    const cleanup1 = on("message:new", (msg: ChatMessage) => {
      if (msg.conversationId === activeId) {
        setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]);
      }
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === msg.conversationId);
        if (!exists) {
          // New conversation not in list yet — refetch
          fetchConversations();
          return prev;
        }
        return prev.map((c) =>
          c._id === msg.conversationId ? { ...c, lastMessage: { content: msg.content, senderId: msg.senderId, sentAt: msg.createdAt } } : c
        );
      });
      if (offlineCache.isSupported) offlineCache.cacheMessages(msg.conversationId, [msg]).catch(() => {});
    });
    const cleanup2 = on("message:edited", (msg: ChatMessage) => { setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m))); });
    const cleanup3 = on("message:deleted", ({ messageId }: { messageId: string }) => { setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m))); });
    const cleanup4 = on("typing", ({ conversationId, userId, typing }: { conversationId: string; userId: string; typing: boolean }) => {
      if (conversationId === activeId) {
        setTypingUsers((prev) => { const next = new Set(prev); if (typing) next.add(userId); else next.delete(userId); return next; });
      }
    });
    // When a new conversation is created by another user, refetch conversation list
    const cleanup5 = on("conversation:new", () => { fetchConversations(); });
    return () => { cleanup1(); cleanup2(); cleanup3(); cleanup4(); cleanup5(); };
  }, [connected, on, activeId, fetchConversations]);

  useEffect(() => { if (activeId && connected) emit("message:read", { conversationId: activeId }); }, [activeId, connected, emit]);

  // ── Read receipt outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (readReceiptRef.current && !readReceiptRef.current.contains(e.target as Node)) setReadReceiptMsg(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Send message ──
  const handleSend = async () => {
    if (!input.trim() || !activeId) return;
    const content = input.trim();
    setInput("");
    if (scheduledAt) {
      try {
        await chatApi.scheduleMessage({ conversationId: activeId, content, scheduledAt: scheduledAt.toISOString() });
        toast.success(`Message scheduled for ${scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
        setScheduledAt(null);
      } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to schedule message"); }
      return;
    }
    try {
      const res = await chatApi.sendMessage(activeId, content);
      if (res.data) setMessages((prev) => prev.some((m) => m._id === res.data!._id) ? prev : [...prev, res.data!]);
      drafts.clearDraft(activeId);
      fetchConversations();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send message"); }
  };

  const handleReadReceiptClick = async (msgId: string, e: React.MouseEvent) => {
    if (!activeId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setReadReceiptPos({ top: rect.top - 8, left: rect.right + 8 });
    setReadReceiptMsg(msgId);
    setReadReceiptLoading(true);
    try { const res = await chatApi.getReadStatus(activeId); setReadReceiptData(res.data || []); }
    catch { setReadReceiptData([]); }
    finally { setReadReceiptLoading(false); }
  };

  // ── GIF send ──
  const handleGifSelect = useCallback((gifUrl: string) => {
    if (!activeId) return;
    emit("message:send", { conversationId: activeId, content: "GIF", type: "image", fileUrl: gifUrl, fileName: "gif" });
    toast.success("GIF sent");
  }, [activeId, emit]);

  // ── Typing indicator ──
  const handleTyping = () => {
    if (activeId && connected) {
      emit("typing:start", { conversationId: activeId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => emit("typing:stop", { conversationId: activeId }), 3000);
    }
  };

  // ── Upload with progress ──
  const handleUploadAndSend = useCallback(async (file: File) => {
    if (!activeId) return;
    if (file.size === 0) { toast.error('Cannot send empty file'); return; }
    if (file.size > MAX_UPLOAD_SIZE) { toast.error(`File "${file.name}" exceeds 25 MB limit`); return; }
    if (!isFileTypeAllowed(file)) { toast.error("File type not allowed"); return; }
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const msgType = isImage ? "image" : isVideo ? "video" : "file";
    const abortController = new AbortController();
    uploadAbortRef.current = abortController;
    setUploadProgress({ fileName: file.name, percent: 0 });
    setIsUploading(true);
    try {
      const token = localStorage.getItem("accessToken") || "";
      const result = await uploadFileWithProgress(file, token, (percent) => setUploadProgress({ fileName: file.name, percent }), abortController.signal, activeId);
      emit("message:send", { conversationId: activeId, content: file.name, type: msgType, fileUrl: result.url, fileName: file.name, fileSize: file.size, fileMimeType: file.type });
      toast.success(`${isImage ? "Image" : isVideo ? "Video" : "File"} sent`);
      setUploadProgress({ fileName: file.name, percent: 100 });
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") toast.info("Upload cancelled");
      else toast.error(`Failed to upload "${file.name}"`);
    } finally { setUploadProgress(null); setIsUploading(false); uploadAbortRef.current = null; }
  }, [activeId, emit]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    await handleUploadAndSend(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [activeId, handleUploadAndSend]);

  const handleCancelUpload = useCallback(() => { uploadAbortRef.current?.abort(); }, []);

  useEffect(() => { return () => { uploadAbortRef.current?.abort(); }; }, []);

  // ── Drag-and-drop ──
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (e.dataTransfer.types.includes("Files")) setIsDragging(true); }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); } }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); dragCounterRef.current = 0; setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) { if (uploadAbortRef.current?.signal.aborted) break; await handleUploadAndSend(file); }
  }, [handleUploadAndSend]);

  // ── Clipboard paste ──
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!activeId || isUploading) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const EXT_MAP: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const textContent = e.clipboardData.getData("text/plain");
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const ext = EXT_MAP[item.type] || 'png';
          const namedFile = new File([file], `pasted-image-${Date.now()}.${ext}`, { type: item.type });
          await handleUploadAndSend(namedFile);
        }
        if (textContent && textareaRef.current) {
          const ta = textareaRef.current;
          const start = ta.selectionStart ?? ta.value.length;
          const end = ta.selectionEnd ?? ta.value.length;
          setInput(ta.value.slice(0, start) + textContent + ta.value.slice(end));
        }
        return;
      }
    }
  }, [activeId, isUploading, handleUploadAndSend]);

  // ── Start direct conversation ──
  const handleStartDirect = async (emp: Employee) => {
    try {
      const res = await chatApi.createDirect(emp.userId);
      if (res.data) { setShowNewChatModal(false); await fetchConversations(); setActiveId(res.data._id); }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create conversation"); }
  };

  // ── Create group ──
  const handleCreateGroup = async () => {
    if (!groupName.trim()) { toast.error("Group name is required"); return; }
    if (selectedMembers.length === 0) { toast.error("Add at least one member"); return; }
    setSavingGroup(true);
    try {
      const res = await chatApi.createGroup({ name: groupName.trim(), description: groupDescription.trim() || undefined, memberIds: selectedMembers.map((m) => m.userId) });
      if (res.data) { setShowNewGroupModal(false); setGroupName(""); setGroupDescription(""); setSelectedMembers([]); await fetchConversations(); setActiveId(res.data._id); toast.success("Group created"); }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create group"); }
    finally { setSavingGroup(false); }
  };

  // ── Create channel ──
  const handleCreateChannel = async () => {
    if (!channelName.trim()) { toast.error("Channel name is required"); return; }
    setSavingChannel(true);
    try {
      const res = await chatApi.createChannel({ name: channelName.trim(), description: channelDescription.trim() || undefined, memberIds: channelMembers.length > 0 ? channelMembers.map((m) => m.userId) : undefined });
      if (res.data) { setShowNewChannelModal(false); setChannelName(""); setChannelDescription(""); setChannelMembers([]); setEmployeeSearch(""); await fetchConversations(); setActiveId(res.data._id); toast.success("Channel created"); }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create channel"); }
    finally { setSavingChannel(false); }
  };

  // ── Convert direct chat to group ──
  const handleConvertToGroup = async () => {
    if (!activeConvo || activeConvo.type !== "direct" || addPeopleMembers.length === 0) { toast.error("Select at least one person to add"); return; }
    setSavingConvert(true);
    try {
      const existingNames = activeConvo.participants.map((p) => { const emp = employeeMap[p.userId]; return emp ? emp.firstName : p.userId.slice(-4); });
      const newNames = addPeopleMembers.map((m) => m.firstName);
      const defaultGroupName = [...existingNames, ...newNames].join(", ");
      const res = await chatApi.convertToGroup(activeConvo._id, addPeopleMembers.map((m) => m.userId), defaultGroupName);
      if (res.data) { setShowAddPeopleModal(false); setAddPeopleMembers([]); setEmployeeSearch(""); await fetchConversations(); toast.success("Conversation converted to group"); }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add people"); }
    finally { setSavingConvert(false); }
  };

  // ── Conversation actions ──
  const handlePin = async () => { if (!activeId) return; try { await chatApi.togglePin(activeId); fetchConversations(); setShowConvoMenu(false); } catch { toast.error("Failed to toggle pin"); } };
  const handleMute = async () => { if (!activeId) return; try { await chatApi.toggleMute(activeId); fetchConversations(); setShowConvoMenu(false); } catch { toast.error("Failed to toggle mute"); } };
  const handleLeave = async () => { if (!activeId) return; try { await chatApi.leave(activeId); setActiveId(null); fetchConversations(); setShowConvoMenu(false); toast.success("Left conversation"); } catch { toast.error("Failed to leave"); } };

  // ── Call handlers ──
  const getRecipientId = (): string | null => {
    if (!activeConvo || activeConvo.type !== "direct") return null;
    return activeConvo.participants.find((p) => p.userId !== user?._id)?.userId || null;
  };

  const getEmployeeName = (userId: string): string => {
    const emp = employeeMap[userId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return userId.slice(-6);
  };

  const handleInitiateCall = () => {
    if (!getRecipientId()) { toast.error("Can only call in direct conversations"); return; }
    setShowPreCallPreview(true);
  };

  const handlePreCallConfirm = async (settings: { audioEnabled: boolean; videoEnabled: boolean; selectedAudioDeviceId?: string; selectedVideoDeviceId?: string }) => {
    setShowPreCallPreview(false);
    const recipientId = getRecipientId();
    if (!recipientId) return;
    try {
      setIsCaller(true); setCallType(settings.videoEnabled ? "video" : "audio"); setIsAudioEnabled(settings.audioEnabled); setIsVideoEnabled(settings.videoEnabled); setCallStartTime(new Date().toISOString());
      webrtcInitializedRef.current = false; offerSentRef.current = false;
      const callId = await signaling.initiateCall(recipientId, settings.videoEnabled ? "video" : "audio", activeConvo?._id);
      if (!callId) throw new Error("Unable to start call");
      setShowCallWindow(true); toast.success(`Calling ${getEmployeeName(recipientId)}...`);
    } catch (err) { setCallType(null); toast.error(err instanceof Error ? err.message : "Failed to initiate call"); }
  };

  // Sync call type for incoming calls
  useEffect(() => {
    if (signaling.call?.status === "ringing") { setCallType(signaling.call.type); if (signaling.call.conversationId) setActiveId(signaling.call.conversationId); }
  }, [signaling.call?.status, signaling.call?.type, signaling.call?.conversationId]);

  // Open call window when answered globally
  useEffect(() => {
    if (signaling.call?.status === "connected" && !showCallWindow && !isCaller) {
      setCallType(signaling.call.type); setIsAudioEnabled(true); setIsVideoEnabled(false); setCallStartTime(new Date().toISOString()); setShowCallWindow(true); setIsCaller(false);
      if (signaling.call.conversationId) setActiveId(signaling.call.conversationId);
    }
  }, [signaling.call?.status, signaling.call?.type, signaling.call?.conversationId, showCallWindow, isCaller]);

  const handleToggleHold = () => {
    if (!signaling.call) return;
    if (isOnHold) { webrtc.resumeCall(preHoldAudioState, preHoldVideoState); setIsAudioEnabled(preHoldAudioState); setIsVideoEnabled(preHoldVideoState); setIsOnHold(false); signaling.resumeCall(); }
    else { setPreHoldAudioState(isAudioEnabled); setPreHoldVideoState(isVideoEnabled); webrtc.holdCall(); setIsAudioEnabled(false); setIsVideoEnabled(false); setIsOnHold(true); signaling.holdCall(); }
  };

  const handleEndCall = () => {
    setIsOnHold(false);
    try {
      webrtc.sendControl({ type: "media-state", hasVideo: false }); signaling.endCall(); webrtc.endCall();
      webrtcInitializedRef.current = false; offerSentRef.current = false;
      if (callDurationRef.current) clearTimeout(callDurationRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      setIsRecording(false); screenShareStream?.getTracks().forEach((t) => t.stop()); setScreenShareStream(null); setIsScreenSharing(false); setIsViewerAnnotating(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setIsFullscreen(false); setFloatingEmojis([]);
      setCallDisconnected(true);
      setTimeout(() => { setShowCallWindow(false); setCallDisconnected(false); setCallType(null); setCallDuration(0); setIsAudioEnabled(true); setIsVideoEnabled(false); setIsCaller(false); setCallStartTime(null); }, 3000);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to end call"); }
  };

  // ── Recording handler ──
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      setIsRecording(false); toast.success("Recording stopped — downloading file...");
    } else {
      const streams: MediaStream[] = [];
      if (webrtc.localStream) streams.push(webrtc.localStream);
      if (webrtc.remoteStream) streams.push(webrtc.remoteStream);
      if (streams.length === 0) { toast.error("No active streams to record"); return; }
      try {
        const mixedTracks: MediaStreamTrack[] = []; streams.forEach((s) => s.getTracks().forEach((t) => mixedTracks.push(t)));
        const combinedStream = new MediaStream(mixedTracks);
        const recorder = new MediaRecorder(combinedStream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "audio/webm" });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorder.onstop = () => { const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `nexora-call-recording-${new Date().toISOString().slice(0, 19)}.webm`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); recordedChunksRef.current = []; };
        recorder.start(1000); mediaRecorderRef.current = recorder; setIsRecording(true); toast.success("Recording started");
      } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to start recording"); }
    }
  }, [isRecording, webrtc.localStream, webrtc.remoteStream]);

  // ── Screen sharing ──
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenShareStream) {
      await webrtc.stopScreenShare(screenShareStream); setScreenShareStream(null); setIsScreenSharing(false); setIsViewerAnnotating(false); toast.success("Screen sharing stopped");
    } else {
      const stream = await webrtc.startScreenShare();
      if (!stream) return;
      setScreenShareStream(stream); setIsScreenSharing(true); toast.success("Screen sharing started");
      stream.getVideoTracks()[0]?.addEventListener("ended", async () => { await webrtc.stopScreenShare(stream); setScreenShareStream(null); setIsScreenSharing(false); setIsViewerAnnotating(false); });
    }
  }, [isScreenSharing, screenShareStream, webrtc]);

  // ── Fullscreen ──
  const handleToggleFullscreen = useCallback(() => {
    const el = callWindowRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    else document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
  }, []);

  useEffect(() => { const h = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);

  // ── Emoji reaction ──
  const handleEmojiReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`; const x = 10 + Math.random() * 80;
    setFloatingEmojis((prev) => [...prev, { id, emoji, x, startTime: Date.now() }]);
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 3000);
  }, []);

  // ── Annotation broadcast & receive ──
  const handleAnnotationStroke = useCallback((stroke: { fromX: number; fromY: number; toX: number; toY: number; color: string; brushSize: number }) => {
    signaling.sendAnnotationStroke(stroke);
  }, [signaling]);

  const handleAnnotationClear = useCallback(() => {
    const canvas = getAnnotationCanvas();
    canvas?.__clearCanvas?.();
    signaling.sendAnnotationClear();
  }, [signaling]);

  // Listen for remote annotation strokes and clears
  useEffect(() => {
    const cleanupStroke = signaling.onAnnotationStroke((data) => {
      const canvas = getAnnotationCanvas();
      canvas?.__drawRemoteStroke?.(data);
    });
    const cleanupClear = signaling.onAnnotationClear(() => {
      const canvas = getAnnotationCanvas();
      canvas?.__clearCanvas?.();
    });
    return () => { cleanupStroke(); cleanupClear(); };
  }, [signaling]);

  // ── Remote pointer handling ──
  const handlePointerMove = useCallback((x: number, y: number) => {
    signaling.sendPointer(x, y);
  }, [signaling]);

  const handlePointerLeave = useCallback(() => {
    signaling.sendPointerHide();
  }, [signaling]);

  // Listen for remote pointers
  useEffect(() => {
    const cleanupPointer = signaling.onPointer((data) => {
      const emp = employeeMap[data.from];
      const name = emp ? `${emp.firstName} ${emp.lastName}` : data.from.slice(-6);
      const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"];
      const color = colors[data.from.charCodeAt(0) % colors.length];
      setRemotePointers((prev) => {
        const filtered = prev.filter((p) => p.userId !== data.from);
        return [...filtered, { userId: data.from, name, x: data.x, y: data.y, color }];
      });
    });
    const cleanupHide = signaling.onPointerHide((data) => {
      setRemotePointers((prev) => prev.filter((p) => p.userId !== data.from));
    });
    return () => { cleanupPointer(); cleanupHide(); };
  }, [signaling, employeeMap]);

  // ── Ephemeral in-call chat ──
  const showCallChatRef = useRef(showCallChat);
  showCallChatRef.current = showCallChat;

  useEffect(() => {
    const cleanup = signaling.onCallChat((msg) => {
      setCallChatMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      // Increment unread if panel is closed and message is from someone else
      if (!showCallChatRef.current && msg.senderId !== user?._id) {
        setCallChatUnread((prev) => prev + 1);
      }
    });
    return cleanup;
  }, [signaling, user?._id]);

  // Clear call chat when call ends
  useEffect(() => {
    if (!showCallWindow) {
      setCallChatMessages([]);
      setCallChatUnread(0);
      setShowCallChat(false);
    }
  }, [showCallWindow]);

  // ── Call duration timer ──
  useEffect(() => {
    if (signaling.call?.status === "connected" && showCallWindow) { callDurationRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000); }
    else { if (callDurationRef.current) clearTimeout(callDurationRef.current); }
    return () => { if (callDurationRef.current) clearTimeout(callDurationRef.current); };
  }, [signaling.call?.status, showCallWindow]);

  // ── Stop local media when call ended by remote ──
  useEffect(() => {
    const unsubscribe = onEnded(() => {
      webrtcRef.current.endCall(); webrtcInitializedRef.current = false; offerSentRef.current = false;
      if (offerRetryRef.current) { clearTimeout(offerRetryRef.current); offerRetryRef.current = null; }
      setCallDisconnected(true);
      setTimeout(() => { setShowCallWindow(false); setCallDisconnected(false); setCallType(null); setCallDuration(0); setIsAudioEnabled(true); setIsVideoEnabled(false); setIsCaller(false); }, 3000);
    });
    return unsubscribe;
  }, [onEnded]);

  // ── Attach remote audio ──
  useEffect(() => {
    if (remoteAudioRef.current && webrtc.remoteStream) { remoteAudioRef.current.srcObject = webrtc.remoteStream; remoteAudioRef.current.play?.().catch(() => {}); }
    if (remoteAudioRef.current && !webrtc.remoteStream) remoteAudioRef.current.srcObject = null;
  }, [webrtc.remoteStream]);

  // ── WebRTC signaling ──
  useEffect(() => {
    if (!signaling.connected) return;
    const unsubscribeOffer = onOffer(async (data) => {
      if (!data?.sdp) return;
      const w = webrtcRef.current; const s = signalingRef.current;
      const isVideo = signalingRef.current.call?.type === "video" || callType === "video";
      if (!webrtcInitializedRef.current) { await w.initializeCall(rtcConfig, { media: { audio: true, video: isVideo }, onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c), isInitiator: false, onControlMessage: handleControlMessage }); webrtcInitializedRef.current = true; }
      const answer = await w.createAnswer({ type: "offer", sdp: data.sdp }); if (answer) s.sendAnswer(answer);
    });
    const unsubscribeAnswer = onAnswerSdp(async (data) => { if (!data?.sdp) return; await webrtcRef.current.setRemoteDescription({ type: "answer", sdp: data.sdp }); });
    const unsubscribeIce = onIceCandidate(async (data) => { if (!data?.candidate) return; await webrtcRef.current.addIceCandidate(new RTCIceCandidate({ candidate: data.candidate, sdpMLineIndex: data.sdpMLineIndex, sdpMid: data.sdpMid })); });
    return () => { unsubscribeOffer?.(); unsubscribeAnswer?.(); unsubscribeIce?.(); };
  }, [signaling.connected, callType, rtcConfig, onOffer, onAnswerSdp, onIceCandidate]);

  // ── Initialize WebRTC (caller) ──
  useEffect(() => {
    const status = signaling.call?.status;
    if (!showCallWindow || status !== "connected" || !isCaller) return;
    const w = webrtcRef.current;
    const media = { audio: isAudioEnabled, video: isVideoEnabled && callType === "video" };
    const initPromise = webrtcInitializedRef.current ? Promise.resolve()
      : w.initializeCall(rtcConfig, { media, onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c), isInitiator: true, onControlMessage: handleControlMessage }).then(() => { webrtcInitializedRef.current = true; });
    initPromise.then(async () => { if (!offerSentRef.current) { const offer = await webrtcRef.current.createOffer(); if (offer) { signalingRef.current.sendOffer(offer); offerSentRef.current = true; } } });
  }, [signaling.call?.status, showCallWindow, isAudioEnabled, isVideoEnabled, callType, isCaller, rtcConfig]);

  // ── Pre-connect preview for caller ──
  useEffect(() => {
    if (!showCallWindow || !isCaller || callType !== "video" || webrtcInitializedRef.current) return;
    webrtcRef.current.initializeCall(rtcConfig, { media: { audio: true, video: true }, onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c), isInitiator: true, onControlMessage: handleControlMessage }).then(() => { webrtcInitializedRef.current = true; });
  }, [showCallWindow, isCaller, callType, rtcConfig]);

  // ── Cleanup WebRTC on call end ──
  useEffect(() => {
    const status = signaling.call?.status;
    if (!status) return;
    if (["ended", "rejected", "missed"].includes(status)) {
      webrtcRef.current.endCall(); webrtcInitializedRef.current = false; offerSentRef.current = false;
      if (offerRetryRef.current) { clearTimeout(offerRetryRef.current); offerRetryRef.current = null; }
      if (!callDisconnected) {
        setCallDisconnected(true);
        const endedCallId = signaling.call?.callId; const endedDuration = signaling.call?.duration || callDuration;
        setTimeout(() => {
          setShowCallWindow(false); setCallDisconnected(false); setCallType(null); setCallDuration(0); setIsAudioEnabled(true); setIsVideoEnabled(false); setIsCaller(false);
          if (status === "ended" && endedDuration > 10 && endedCallId) { setFeedbackCallId(endedCallId); setFeedbackCallDuration(endedDuration); setShowCallFeedback(true); }
        }, 3000);
      }
    }
  }, [signaling.call?.status, callDisconnected, signaling.call?.callId, signaling.call?.duration, callDuration]);

  // ── Peer connection drop cleanup ──
  useEffect(() => {
    if (!showCallWindow) return;
    const state = webrtc.connectionState; const ice = webrtc.iceConnectionState;
    if (!state && !ice) return;
    const shouldCleanup = () => {
      webrtcRef.current.endCall(); webrtcInitializedRef.current = false; offerSentRef.current = false;
      if (offerRetryRef.current) { clearTimeout(offerRetryRef.current); offerRetryRef.current = null; }
      if (disconnectTimeoutRef.current) { clearTimeout(disconnectTimeoutRef.current); disconnectTimeoutRef.current = null; }
      setShowCallWindow(false); setCallType(null); setCallDuration(0); setIsAudioEnabled(true); setIsVideoEnabled(false); setIsCaller(false);
    };
    const isDisconnected = state === "disconnected" || ice === "disconnected" || state === "failed" || ice === "failed";
    if (state === "closed") { shouldCleanup(); return; }
    if (isDisconnected) {
      if (signaling.call?.status === "connected" && isCaller && !iceRestartAttemptRef.current) {
        iceRestartAttemptRef.current = true;
        webrtcRef.current.restartIce().then((offer) => { if (offer) signalingRef.current.sendOffer(offer); });
        if (iceRestartResetRef.current) clearTimeout(iceRestartResetRef.current);
        iceRestartResetRef.current = setTimeout(() => { iceRestartAttemptRef.current = false; }, 10000);
      }
      if (!disconnectTimeoutRef.current) {
        disconnectTimeoutRef.current = setTimeout(() => {
          const w = webrtcRef.current;
          if (w.connectionState === "disconnected" || w.connectionState === "failed" || w.iceConnectionState === "disconnected" || w.iceConnectionState === "failed") shouldCleanup();
          else if (disconnectTimeoutRef.current) { clearTimeout(disconnectTimeoutRef.current); disconnectTimeoutRef.current = null; }
        }, 20000);
      }
    } else {
      if (disconnectTimeoutRef.current) { clearTimeout(disconnectTimeoutRef.current); disconnectTimeoutRef.current = null; }
      if (iceRestartResetRef.current) { clearTimeout(iceRestartResetRef.current); iceRestartResetRef.current = null; }
      iceRestartAttemptRef.current = false;
    }
  }, [showCallWindow, webrtc.connectionState, webrtc.iceConnectionState, signaling.call?.status, isCaller]);

  // ── Safety: stop media when call window closes ──
  useEffect(() => {
    if (showCallWindow) return;
    webrtcRef.current.endCall(); webrtcInitializedRef.current = false; offerSentRef.current = false;
    if (offerRetryRef.current) { clearTimeout(offerRetryRef.current); offerRetryRef.current = null; }
  }, [showCallWindow]);

  useEffect(() => { const h = () => webrtcRef.current.endCall(); window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, []);

  useEffect(() => { if (signaling.isRinging && signaling.call?.type) { setCallType(signaling.call.type as "audio" | "video"); setIsCaller(false); } }, [signaling.isRinging, signaling.call?.type]);

  // ── Typing indicator text ──
  const getTypingText = (): string | null => {
    if (typingUsers.size === 0) return null;
    const names = Array.from(typingUsers).map((uid) => { const emp = employeeMap[uid]; return emp ? emp.firstName : uid.slice(-6); });
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  };

  // ── Filtered employees for modals ──
  const MAX_EMPLOYEE_DISPLAY = 100;
  const filteredEmployeesAll = allEmployees.filter((e) => {
    if (e.userId === user?._id) return false;
    if (!employeeSearch) return true;
    return `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(employeeSearch.toLowerCase());
  });
  const filteredEmployees = filteredEmployeesAll.slice(0, MAX_EMPLOYEE_DISPLAY);
  const truncatedEmployeeCount = filteredEmployeesAll.length - filteredEmployees.length;

  const typingText = getTypingText();

  // ── Loading ──
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] flex flex-col">
      <Sidebar user={user} onLogout={logout} />

      {/* Offline banner */}
      {!offlineCache.isOnline && (
        <div className="ml-[260px] bg-amber-500 text-white text-center text-sm py-1.5 px-4 font-medium shrink-0">
          You&apos;re offline — showing cached messages
        </div>
      )}

      <main className="ml-[260px] flex-1 flex min-h-0 h-full">
        {/* ── Left Panel: Conversation List ── */}
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setShowMembersPanel(false); setShowConvoMenu(false); }}
          onCreateChat={() => { setShowNewChatModal(true); setEmployeeSearch(""); }}
          onCreateGroup={() => { setShowNewGroupModal(true); setEmployeeSearch(""); setSelectedMembers([]); setGroupName(""); setGroupDescription(""); }}
          onCreateChannel={() => { setShowNewChannelModal(true); setEmployeeSearch(""); setChannelMembers([]); setChannelName(""); setChannelDescription(""); }}
          onToggleSettings={() => setShowSettingsPanel(!showSettingsPanel)}
          showSettingsPanel={showSettingsPanel}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          tab={tab}
          onTabChange={setTab}
          user={user}
          employeeMap={employeeMap}
          onlineUserIds={onlineUserIds}
          loadingConvos={loadingConvos}
        />

        {/* ── Middle Panel: Active Conversation ── */}
        <div
          className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0 min-h-0 overflow-hidden relative"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay */}
          {isDragging && activeConvo && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg backdrop-blur-[2px] pointer-events-none">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-blue-700">Drop files here</p>
                  <p className="text-xs text-blue-500 mt-0.5">Files will be uploaded and shared</p>
                </div>
              </div>
            </div>
          )}

          {activeConvo ? (
            <div className="flex flex-col flex-1 min-h-0 h-full">
              <ChatHeader
                conversation={activeConvo}
                user={user}
                employeeMap={employeeMap}
                onlineUserIds={onlineUserIds}
                presenceMap={presenceMap}
                showCallWindow={showCallWindow}
                showMembersPanel={showMembersPanel}
                showConvoMenu={showConvoMenu}
                onInitiateCall={handleInitiateCall}
                onAddPeople={() => { setShowAddPeopleModal(true); setAddPeopleMembers([]); setEmployeeSearch(""); }}
                onToggleMembers={() => setShowMembersPanel(!showMembersPanel)}
                onToggleConvoMenu={() => setShowConvoMenu(!showConvoMenu)}
                onPin={handlePin}
                onMute={handleMute}
                onLeave={handleLeave}
              />

              <MessageList
                messages={messages}
                conversation={activeConvo}
                user={user}
                employeeMap={employeeMap}
                onlineUserIds={onlineUserIds}
                chatSettings={chatSettings}
                loadingMessages={loadingMessages}
                typingText={typingText}
                typingUsers={typingUsers}
                activeId={activeId}
                onThreadOpen={setThreadMessage}
                onForward={setForwardMessageId}
                onCloseConvoMenu={() => setShowConvoMenu(false)}
                onReadReceiptClick={handleReadReceiptClick}
                setMessages={setMessages}
              />

              {/* Read Receipt Detail Popup */}
              {readReceiptMsg && (
                <div ref={readReceiptRef} className="fixed z-[60] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 px-3 w-[220px]" style={{ top: Math.min(readReceiptPos.top, typeof window !== "undefined" ? window.innerHeight - 200 : 400), left: Math.min(readReceiptPos.left, typeof window !== "undefined" ? window.innerWidth - 240 : 600) }}>
                  {readReceiptLoading ? (
                    <div className="flex items-center justify-center py-3"><svg className="w-5 h-5 text-[#2E86C1] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>
                  ) : activeConvo?.type === "direct" ? (
                    <div>{readReceiptData.filter(r => r.userId !== user?._id).length > 0 ? <p className="text-[11px] text-[#334155]">Read {(() => { const diff = Date.now() - new Date(readReceiptData.filter(r => r.userId !== user?._id)[0]?.readAt).getTime(); const mins = Math.floor(diff / 60000); if (mins < 1) return "now"; if (mins < 60) return mins + "m"; return Math.floor(mins / 60) + "h"; })()}</p> : <p className="text-[11px] text-[#94A3B8]">Delivered</p>}</div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">Delivered to {activeConvo?.participants.filter(p => p.userId !== user?._id).length || 0}, Read by {readReceiptData.filter(r => r.userId !== user?._id).length}</p>
                      <div className="max-h-[160px] overflow-y-auto space-y-1.5">
                        {readReceiptData.filter(r => r.userId !== user?._id).map((r) => { const emp = employeeMap[r.userId]; const name = emp ? `${emp.firstName} ${emp.lastName}` : r.userId.slice(-6); return (<div key={r.userId} className="flex items-center justify-between"><span className="text-[11px] text-[#334155] font-medium truncate">{name}</span></div>); })}
                        {readReceiptData.filter(r => r.userId !== user?._id).length === 0 && <p className="text-[11px] text-[#94A3B8] italic">No one has read this yet</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice Huddle Widget (channels only) */}
              {activeConvo?.type === "channel" && user && (
                <VoiceHuddle channelId={activeConvo._id} currentUserId={user._id} currentUserName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "User"} />
              )}

              <ChatInput
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onTyping={handleTyping}
                onFileSelect={handleFileSelect}
                onGifSelect={handleGifSelect}
                onPaste={handlePaste}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                onCancelUpload={handleCancelUpload}
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                smartReplies={smartReplies}
                onSmartReplySelect={(reply) => { setInput(reply); setSmartReplies([]); textareaRef.current?.focus(); }}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                members={(activeConvo?.participants || [])
                  .filter((p) => p.userId !== user?._id)
                  .map((p) => {
                    const emp = employeeMap[p.userId];
                    return { userId: p.userId, firstName: emp?.firstName || "", lastName: emp?.lastName || "" };
                  })
                  .filter((m) => m.firstName || m.lastName)
                }
              />
            </div>
          ) : (
            /* ── Speed Dial / Recommended Contacts ── */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#EBF5FF] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-[#0F172A]">Start a Conversation</h2>
                  <p className="text-[13px] text-[#94A3B8] mt-1">Pick a colleague to chat with</p>
                </div>
                {allEmployees.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 px-1">People</p>
                    <div className="grid grid-cols-4 gap-3">
                      {allEmployees.filter(e => e.userId !== user?._id).slice(0, 8).map((emp) => {
                        const isOnline = onlineUserIds.has(emp.userId);
                        return (
                          <button key={emp._id} onClick={() => handleStartDirect(emp)} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FF]/30 transition-all group">
                            <div className="relative">
                              <div className="w-11 h-11 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-sm font-semibold group-hover:scale-105 transition-transform">{getInitials(emp.firstName, emp.lastName)}</div>
                              {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full" />}
                            </div>
                            <div className="text-center min-w-0 w-full">
                              <p className="text-[12px] font-medium text-[#334155] truncate group-hover:text-[#2E86C1]">{emp.firstName}</p>
                              <p className="text-[10px] text-[#94A3B8] truncate">{emp.lastName}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => { setShowNewChatModal(true); setEmployeeSearch(""); }} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-xl transition-colors shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    New Chat
                  </button>
                  <button onClick={() => { setShowNewGroupModal(true); setEmployeeSearch(""); setSelectedMembers([]); setGroupName(""); setGroupDescription(""); }} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Create Group
                  </button>
                  <button onClick={() => { setShowNewChannelModal(true); setEmployeeSearch(""); setChannelMembers([]); setChannelName(""); setChannelDescription(""); }} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition-colors">
                    <span className="text-base font-bold leading-none">#</span>
                    Channel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Members ── */}
        {activeConvo && activeConvo.type !== "direct" && showMembersPanel && (
          <div className="w-[260px] border-l border-[#E2E8F0] bg-white flex flex-col h-full shrink-0">
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#E2E8F0] shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-[#0F172A]">Members</h3>
                <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">{activeConvo.participants.length}</span>
              </div>
              <button onClick={() => setShowMembersPanel(false)} className="p-1 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {activeConvo.participants.map((p) => {
                const emp = employeeMap[p.userId]; const name = emp ? `${emp.firstName} ${emp.lastName}` : p.userId.slice(-6);
                const initials = emp ? getInitials(emp.firstName, emp.lastName) : "??"; const isOnline = onlineUserIds.has(p.userId);
                const roleBadge = p.role === "owner" ? "bg-purple-50 text-purple-700 border-purple-200" : p.role === "admin" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200";
                return (
                  <div key={p.userId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#F1F5F9]">
                    <div className="relative shrink-0"><div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold">{initials}</div>{isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22C55E] border-2 border-white rounded-full" />}</div>
                    <div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-[#0F172A] truncate">{name}</p>{emp?.email && <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>}</div>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${roleBadge}`}>{p.role}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-[#E2E8F0]">
              <button onClick={() => toast.info("Add member coming soon")} className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Member
              </button>
            </div>
          </div>
        )}

        {/* ── Right Panel: Chat Settings ── */}
        {showSettingsPanel && chatSettings && (
          <div className="w-[300px] border-l border-[#E2E8F0] bg-white flex flex-col h-full shrink-0">
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#E2E8F0] shrink-0">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Chat Settings</h3>
              <button onClick={() => setShowSettingsPanel(false)} className="p-1 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Read Receipts</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] text-[#334155]">Show when I&apos;ve read messages</span><button onClick={() => updateChatSettings({ readReceipts: { showMyReadStatus: !chatSettings.readReceipts.showMyReadStatus } } as Partial<ChatSettings>)} className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.readReceipts.showMyReadStatus ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.readReceipts.showMyReadStatus ? "left-[18px]" : "left-0.5"}`} /></button></label>
                  <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] text-[#334155]">Show read receipts from others</span><button onClick={() => updateChatSettings({ readReceipts: { showOthersReadStatus: !chatSettings.readReceipts.showOthersReadStatus } } as Partial<ChatSettings>)} className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.readReceipts.showOthersReadStatus ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.readReceipts.showOthersReadStatus ? "left-[18px]" : "left-0.5"}`} /></button></label>
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Appearance</h4>
                <div className="mb-3"><p className="text-[11px] text-[#94A3B8] mb-1.5">Chat Background</p><div className="flex flex-wrap gap-2">{[{ color: "#F8FAFC", label: "Light" }, { color: "#1E293B", label: "Dark" }, { color: "#FEF3C7", label: "Warm" }, { color: "#ECFDF5", label: "Green" }, { color: "#EFF6FF", label: "Blue" }, { color: "#FDF2F8", label: "Pink" }].map((preset) => (<button key={preset.color} onClick={() => updateChatSettings({ appearance: { chatBgColor: preset.color } } as Partial<ChatSettings>)} className={`w-8 h-8 rounded-lg border-2 transition-all ${chatSettings.appearance.chatBgColor === preset.color ? "border-[#2E86C1] scale-110" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`} style={{ backgroundColor: preset.color }} title={preset.label} />))}</div></div>
                <div className="mb-3"><p className="text-[11px] text-[#94A3B8] mb-1.5">My Bubble Color</p><div className="flex flex-wrap gap-2">{["#2E86C1", "#7C3AED", "#0D9488", "#D97706", "#DC2626", "#059669", "#4F46E5", "#DB2777"].map((color) => (<button key={color} onClick={() => updateChatSettings({ appearance: { myBubbleColor: color } } as Partial<ChatSettings>)} className={`w-8 h-8 rounded-lg border-2 transition-all ${chatSettings.appearance.myBubbleColor === color ? "border-[#0F172A] scale-110" : "border-transparent hover:border-[#94A3B8]"}`} style={{ backgroundColor: color }} />))}</div></div>
                <div><p className="text-[11px] text-[#94A3B8] mb-1.5">Font Size</p><div className="flex gap-1.5">{(["small", "medium", "large"] as const).map((size) => (<button key={size} onClick={() => updateChatSettings({ appearance: { fontSize: size } } as Partial<ChatSettings>)} className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors capitalize ${chatSettings.appearance.fontSize === size ? "bg-[#EBF5FF] text-[#2E86C1] border-[#2E86C1]" : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}>{size}</button>))}</div></div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Notifications</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] text-[#334155]">Sound</span><button onClick={() => updateChatSettings({ notifications: { sound: !chatSettings.notifications.sound } } as Partial<ChatSettings>)} className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.sound ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.sound ? "left-[18px]" : "left-0.5"}`} /></button></label>
                  <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] text-[#334155]">Desktop notifications</span><button onClick={() => updateChatSettings({ notifications: { desktop: !chatSettings.notifications.desktop } } as Partial<ChatSettings>)} className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.desktop ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.desktop ? "left-[18px]" : "left-0.5"}`} /></button></label>
                  <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] text-[#334155]">Mute all</span><button onClick={() => updateChatSettings({ notifications: { muteAll: !chatSettings.notifications.muteAll } } as Partial<ChatSettings>)} className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.muteAll ? "bg-[#EF4444]" : "bg-[#CBD5E1]"}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.muteAll ? "left-[18px]" : "left-0.5"}`} /></button></label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── New Chat Modal ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0"><h2 className="text-sm font-bold text-[#0F172A]">Start a conversation</h2><button onClick={() => setShowNewChatModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="px-5 py-3 border-b border-[#E2E8F0] shrink-0"><div className="relative"><svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Search employees..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} autoFocus className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" /></div></div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredEmployees.length === 0 ? <div className="py-8 text-center"><p className="text-[13px] text-[#94A3B8]">No employees found</p></div> : (
                <>{filteredEmployees.map((emp) => (<button key={emp._id} onClick={() => handleStartDirect(emp)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left"><div className="w-9 h-9 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p><p className="text-[11px] text-[#94A3B8] truncate">{emp.email}</p></div></button>))}{truncatedEmployeeCount > 0 && <p className="text-center text-[12px] text-[#94A3B8] py-2">and {truncatedEmployeeCount} more &mdash; refine your search</p>}</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New Group Modal ── */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0"><h2 className="text-sm font-bold text-[#0F172A]">Create Group</h2><button onClick={() => setShowNewGroupModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Group Name</label><input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Design Team" className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" /></div>
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Description (optional)</label><input type="text" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="What is this group about?" className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" /></div>
              {selectedMembers.length > 0 && <div><label className="block text-[12px] font-medium text-[#334155] mb-1.5">Selected ({selectedMembers.length})</label><div className="flex flex-wrap gap-1.5">{selectedMembers.map((m) => (<span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EBF5FF] text-[#2E86C1] rounded-full text-[11px] font-medium">{m.firstName} {m.lastName}<button onClick={() => setSelectedMembers((prev) => prev.filter((p) => p._id !== m._id))} className="hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></span>))}</div></div>}
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Add Members</label><div className="relative mb-2"><svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Search employees..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" /></div><div className="max-h-[200px] overflow-y-auto border border-[#E2E8F0] rounded-lg">{filteredEmployees.filter((e) => !selectedMembers.some((s) => s._id === e._id)).map((emp) => (<button key={emp._id} onClick={() => setSelectedMembers((prev) => [...prev, emp])} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F1F5F9] transition-colors text-left border-b border-[#F1F5F9] last:border-b-0"><div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p><p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p></div><svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>))}{filteredEmployees.filter((e) => !selectedMembers.some((s) => s._id === e._id)).length === 0 && <div className="py-4 text-center"><p className="text-[12px] text-[#94A3B8]">No more employees to add</p></div>}</div></div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0"><button onClick={() => setShowNewGroupModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button><button onClick={handleCreateGroup} disabled={savingGroup || !groupName.trim() || selectedMembers.length === 0} className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{savingGroup ? "Creating..." : "Create"}</button></div>
          </div>
        </div>
      )}

      {/* ── New Channel Modal ── */}
      {showNewChannelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0"><h2 className="text-sm font-bold text-[#0F172A]">Create Channel</h2><button onClick={() => setShowNewChannelModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Channel Name</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#7C3AED]">#</span><input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. announcements" className="w-full h-9 pl-7 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]" /></div></div>
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Description (optional)</label><input type="text" value={channelDescription} onChange={(e) => setChannelDescription(e.target.value)} placeholder="What is this channel about?" className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]" /></div>
              {channelMembers.length > 0 && <div><label className="block text-[12px] font-medium text-[#334155] mb-1.5">Members ({channelMembers.length})</label><div className="flex flex-wrap gap-1.5">{channelMembers.map((m) => (<span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F3E8FF] text-[#7C3AED] rounded-full text-[11px] font-medium">{m.firstName} {m.lastName}<button onClick={() => setChannelMembers((prev) => prev.filter((p) => p._id !== m._id))} className="hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></span>))}</div></div>}
              <div><label className="block text-[12px] font-medium text-[#334155] mb-1">Add Members (optional)</label><div className="relative mb-2"><svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Search employees..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]" /></div><div className="max-h-[200px] overflow-y-auto border border-[#E2E8F0] rounded-lg">{filteredEmployees.filter((e) => !channelMembers.some((s) => s._id === e._id)).map((emp) => (<button key={emp._id} onClick={() => setChannelMembers((prev) => [...prev, emp])} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F1F5F9] transition-colors text-left border-b border-[#F1F5F9] last:border-b-0"><div className="w-7 h-7 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p><p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p></div><svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>))}{filteredEmployees.filter((e) => !channelMembers.some((s) => s._id === e._id)).length === 0 && <div className="py-4 text-center"><p className="text-[12px] text-[#94A3B8]">No more employees to add</p></div>}</div></div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0"><button onClick={() => setShowNewChannelModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button><button onClick={handleCreateChannel} disabled={savingChannel || !channelName.trim()} className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{savingChannel ? "Creating..." : "Create Channel"}</button></div>
          </div>
        </div>
      )}

      {/* ── Add People Modal ── */}
      {showAddPeopleModal && activeConvo && activeConvo.type === "direct" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0"><div><h2 className="text-sm font-bold text-[#0F172A]">Add People</h2><p className="text-[11px] text-[#94A3B8] mt-0.5">This will convert the chat into a group</p></div><button onClick={() => setShowAddPeopleModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            {addPeopleMembers.length > 0 && <div className="px-5 pt-3"><div className="flex flex-wrap gap-1.5">{addPeopleMembers.map((m) => (<span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EBF5FF] text-[#2E86C1] rounded-full text-[11px] font-medium">{m.firstName} {m.lastName}<button onClick={() => setAddPeopleMembers((prev) => prev.filter((p) => p._id !== m._id))} className="hover:text-red-500 transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></span>))}</div></div>}
            <div className="px-5 py-3 shrink-0"><div className="relative"><svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Search employees..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} autoFocus className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" /></div></div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">{filteredEmployees.filter((e) => !activeConvo.participants.some((p) => p.userId === e.userId)).filter((e) => !addPeopleMembers.some((s) => s._id === e._id)).map((emp) => (<button key={emp._id} onClick={() => setAddPeopleMembers((prev) => [...prev, emp])} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left"><div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p><p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p></div><svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></button>))}{filteredEmployees.filter((e) => !activeConvo.participants.some((p) => p.userId === e.userId)).filter((e) => !addPeopleMembers.some((s) => s._id === e._id)).length === 0 && <div className="py-6 text-center"><p className="text-[12px] text-[#94A3B8]">No more employees to add</p></div>}</div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0"><button onClick={() => setShowAddPeopleModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button><button onClick={handleConvertToGroup} disabled={savingConvert || addPeopleMembers.length === 0} className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{savingConvert ? "Adding..." : `Add ${addPeopleMembers.length > 0 ? `(${addPeopleMembers.length})` : ""}`}</button></div>
          </div>
        </div>
      )}

      {/* ── Call Overlay ── */}
      <CallOverlay
        showPreCallPreview={showPreCallPreview}
        preCallRecipientName={getEmployeeName(activeConvo?.participants.find((p) => p.userId !== user?._id)?.userId || "")}
        onPreCallConfirm={handlePreCallConfirm}
        onPreCallCancel={() => setShowPreCallPreview(false)}
        showCallWindow={showCallWindow}
        callConversation={callConversation}
        user={user}
        employeeMap={employeeMap}
        callType={callType}
        callDuration={callDuration}
        callDisconnected={callDisconnected}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isRecording={isRecording}
        isScreenSharing={isScreenSharing}
        isFullscreen={isFullscreen}
        isOnHold={isOnHold}
        isViewerAnnotating={isViewerAnnotating}
        annotationColor={annotationColor}
        annotationBrushSize={annotationBrushSize}
        screenShareStream={screenShareStream}
        floatingEmojis={floatingEmojis}
        remoteHasVideo={remoteHasVideo}
        webrtcLocalStream={webrtc.localStream}
        webrtcRemoteStream={webrtc.remoteStream}
        webrtcError={webrtc.error}
        signalingCallStatus={signaling.call?.status}
        showCallChat={showCallChat}
        callChatMsg={callChatMsg}
        callChatMessages={callChatMessages}
        callStartTime={callStartTime}
        onCallChatMsgChange={setCallChatMsg}
        callChatUnread={callChatUnread}
        onCallChatToggle={() => { setShowCallChat(!showCallChat); if (!showCallChat) setCallChatUnread(0); }}
        onCallChatSend={(msg) => { signaling.sendCallChat(msg); }}
        onEndCall={handleEndCall}
        onToggleAudio={(enabled) => { setIsAudioEnabled(enabled); webrtc.toggleAudio(enabled); }}
        onToggleVideo={(enabled) => { setIsVideoEnabled(enabled); webrtc.toggleVideo(enabled); }}
        onToggleRecording={handleToggleRecording}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleHold={handleToggleHold}
        onAddParticipant={() => setShowAddParticipantModal(true)}
        onEmojiReaction={handleEmojiReaction}
        onAnnotationToggle={() => setIsViewerAnnotating(!isViewerAnnotating)}
        onAnnotationColorChange={setAnnotationColor}
        onAnnotationBrushSizeChange={setAnnotationBrushSize}
        onAnnotationClear={handleAnnotationClear}
        onAnnotationStroke={handleAnnotationStroke}
        remotePointers={remotePointers}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        showAddParticipantModal={showAddParticipantModal}
        onCloseAddParticipant={() => setShowAddParticipantModal(false)}
        filteredEmployees={filteredEmployees}
        employeeSearch={employeeSearch}
        onEmployeeSearchChange={setEmployeeSearch}
        onInviteToCall={(userId) => signaling.inviteToCall(userId)}
        showCallFeedback={showCallFeedback}
        feedbackCallId={feedbackCallId}
        feedbackCallDuration={feedbackCallDuration}
        onCloseCallFeedback={() => { setShowCallFeedback(false); setFeedbackCallId(null); }}
        callWindowRef={callWindowRef}
        remoteAudioRef={remoteAudioRef}
      />

      {/* Thread panel */}
      {threadMessage && user && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <ThreadPanel rootMessage={threadMessage} employeeMap={employeeMap} currentUserId={user._id} onClose={() => setThreadMessage(null)} onReply={() => { if (activeId) fetchMessages(activeId); }} />
        </div>
      )}

      {/* Status setter modal */}
      {showStatusSetter && <StatusSetter currentStatus={presenceMap.get(user?._id || "")?.status || "online"} onClose={() => setShowStatusSetter(false)} onStatusChange={() => setShowStatusSetter(false)} />}

      {/* Global search modal */}
      {showGlobalSearch && <GlobalSearch onClose={() => setShowGlobalSearch(false)} onNavigate={(conversationId) => { setActiveId(conversationId); setShowGlobalSearch(false); }} />}

      {/* File browser panel */}
      {showFileBrowser && activeId && <div className="fixed top-0 right-0 h-full z-40 shadow-2xl"><FileBrowser conversationId={activeId} onClose={() => setShowFileBrowser(false)} /></div>}

      {/* Pinned messages panel */}
      {showPinnedMessages && activeId && <div className="fixed top-0 right-0 h-full z-40 shadow-2xl"><PinnedMessages conversationId={activeId} onClose={() => setShowPinnedMessages(false)} onUnpin={() => { if (activeId) fetchMessages(activeId); }} /></div>}

      {/* Bookmarks panel */}
      {showBookmarks && <div className="fixed top-0 right-0 h-full z-40 shadow-2xl"><BookmarksList onClose={() => setShowBookmarks(false)} onNavigate={(conversationId) => { setActiveId(conversationId); setShowBookmarks(false); }} /></div>}

      {/* AI Summary panel */}
      {showAiSummary && activeId && <div className="fixed top-0 right-0 h-full z-40 shadow-2xl"><AiSummaryPanel conversationId={activeId} onClose={() => setShowAiSummary(false)} /></div>}

      {/* Guest Access panel */}
      {showGuestPanel && activeId && conversations.find(c => c._id === activeId) && <div className="fixed top-0 right-0 h-full z-40 shadow-2xl"><GuestAccessPanel conversation={conversations.find(c => c._id === activeId)!} employeeMap={employeeMap} currentUserId={(user as any)?._id || (user as any)?.userId || ""} onClose={() => setShowGuestPanel(false)} onConversationUpdate={(updated: any) => setConversations(prev => prev.map(c => c._id === updated._id ? updated : c))} /></div>}

      {/* Forward Message Modal */}
      {forwardMessageId && <ForwardModal messageId={forwardMessageId} onClose={() => setForwardMessageId(null)} employeeMap={employeeMap} />}
    </div>
  );
}
