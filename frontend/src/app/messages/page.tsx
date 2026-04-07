"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth-context";
import { chatApi, hrApi, uploadFileWithProgress } from "@/lib/api";
import type { Conversation, ChatMessage, Employee, ChatSettings } from "@/lib/api";
import { useGlobalSocket } from "@/lib/socket-context";
import { useWebRTC } from "@/lib/hooks/useWebRTC";
import { useCallContext } from "@/lib/call-context";
import { CallControls, VideoCallWindow, PreCallPreview, CallFeedback } from "@/components/calling";
import {
  MessageContent, ThreadPanel, PresenceIndicator, StatusSetter,
  GlobalSearch, FileBrowser, PinnedMessages, BookmarksList, AiSummaryPanel, VoiceRecorder, LinkPreview,
  GifPicker,
  VoiceHuddle,
  ForwardModal,
} from "@/components/chat";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { toast } from "sonner";
import { useOfflineCache } from "@/lib/hooks/useOfflineCache";
import { useConversationDrafts } from "@/lib/hooks/useConversationDrafts";
import { getInitials, formatTime } from "@/lib/utils";

// ── Upload validation constants ──
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_PATTERNS = [
  /^image\//,
  /^video\//,
  /^audio\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats/,
  /^application\/vnd\.ms-/,
  /^text\//,
  /^application\/zip$/,
  /^application\/x-zip/,
  /^application\/json$/,
];

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.msi', '.ps1', '.sh', '.com', '.scr', '.pif', '.vbs', '.js', '.wsf'];

function isFileTypeAllowed(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) return false;
  // If MIME type is empty (unknown), allow as long as extension is not blocked
  if (!file.type) return true;
  return ALLOWED_MIME_PATTERNS.some(pattern => pattern.test(file.type));
}

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// getInitials and formatTime imported from @/lib/utils

// Check if a message contains only emoji characters (no text)
// Uses RegExp constructor to avoid TS compile-time flag restriction
const emojiStripRegex = new RegExp(
  "[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{1F1E0}-\\u{1F1FF}" +
  "\\u{2600}-\\u{27BF}\\u{FE00}-\\u{FE0F}\\u{200D}\\u{20E3}\\u{E0020}-\\u{E007F}" +
  "\\u{1F900}-\\u{1F9FF}\\u{1FA00}-\\u{1FA6F}\\u{1FA70}-\\u{1FAFF}\\u{2702}-\\u{27B0}" +
  "\\u{231A}-\\u{23F3}\\u{2328}\\u{23CF}\\u{23E9}-\\u{23F3}\\u{23F8}-\\u{23FA}" +
  "\\u{25AA}-\\u{25AB}\\u{25B6}\\u{25C0}\\u{25FB}-\\u{25FE}\\u{2934}-\\u{2935}" +
  "\\u{2B05}-\\u{2B07}\\u{2B1B}-\\u{2B1C}\\u{2B50}\\u{2B55}\\u{3030}\\u{303D}" +
  "\\u{3297}\\u{3299}\\s]",
  "gu"
);
function isEmojiOnly(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length === 0 || trimmed.length > 20) return false;
  const stripped = trimmed.replace(emojiStripRegex, "");
  return stripped.length === 0;
}

// Full emoji set organized by category
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥴", "😵", "🤯", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"],
  "Gestures": ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "❤️‍🔥", "❤️‍🩹", "💋", "💯", "💢", "💥", "💫", "💦", "💤"],
  "People": ["👶", "👧", "🧒", "👦", "👩", "🧑", "👨", "👩‍🦱", "🧑‍🦱", "👨‍🦱", "👩‍🦰", "🧑‍🦰", "👨‍🦰", "👱‍♀️", "👱", "👱‍♂️", "👩‍🦳", "🧑‍🦳", "👨‍🦳", "👩‍🦲", "🧑‍🦲", "👨‍🦲", "🧔‍♀️", "🧔", "🧔‍♂️", "👵", "🧓", "👴", "👲", "👳‍♀️", "👳", "👳‍♂️", "🧕", "👮‍♀️", "👮", "👷‍♀️", "👷", "💂‍♀️", "💂", "🕵️‍♀️", "🕵️"],
  "Nature": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🌸", "💐", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🍀", "🍁", "🍂", "🍃"],
  "Food": ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧅", "🍄", "🥜", "🫘", "🌰", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦀", "🦞", "🦐", "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "☕", "🍵", "🫖", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🍾", "🧊"],
  "Activities": ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🎯", "🎮", "🕹️", "🎰", "🎲", "🧩", "🎭", "🎨", "🎪", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎬", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️"],
  "Travel": ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🛵", "🚲", "🛴", "🛺", "✈️", "🛫", "🛬", "🚀", "🛸", "🚁", "⛵", "🚢", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🌍", "🌎", "🌏", "🌐", "🗺️", "🧭", "⛰️", "🏔️", "🌋", "🗻"],
  "Objects": ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "🎥", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑", "🔖", "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳️", "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝", "📁", "📂", "🗂️", "🗄️", "🔒", "🔓", "🔑", "🗝️"],
  "Symbols": ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🔶", "🔷", "🔸", "🔹", "❗", "❓", "❕", "❔", "‼️", "⁉️", "✅", "❌", "⭕", "🚫", "💯", "🔥", "⭐", "🌟", "✨", "⚡", "💥", "💫", "🎵", "🎶", "➕", "➖", "➗", "✖️", "♾️", "💲", "🔱", "🔰", "⚜️", "🔘", "🔳", "🔲", "▪️", "▫️", "◾", "◽", "◼️", "◻️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜"],
  "Flags": ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇪🇸", "🇮🇹", "🇯🇵", "🇰🇷", "🇨🇳", "🇮🇳", "🇧🇷", "🇲🇽", "🇷🇺", "🇿🇦", "🇳🇬", "🇪🇬", "🇸🇦", "🇦🇪", "🇹🇷", "🇮🇩", "🇹🇭", "🇻🇳", "🇵🇭", "🇸🇬", "🇲🇾", "🇳🇿", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇮🇪", "🇵🇹", "🇬🇷", "🇵🇱", "🇨🇭", "🇦🇹", "🇧🇪", "🇳🇱", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪"],
};

type TabFilter = "all" | "direct" | "group" | "channel";

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
  // Persist selected conversation across page refreshes
  useEffect(() => {
    if (activeId) localStorage.setItem("nexora_active_chat", activeId);
    else localStorage.removeItem("nexora_active_chat");
  }, [activeId]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, Employee>>({});
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Tab Unread Badge (favicon + document.title) ──
  useEffect(() => {
    if (!user) return;
    const totalUnread = conversations.reduce((count, convo) => {
      const participant = convo.participants.find((p) => p.userId === user._id);
      if (!participant?.lastReadAt || !convo.lastMessage?.sentAt) return count;
      if (new Date(convo.lastMessage.sentAt) > new Date(participant.lastReadAt)) {
        return count + 1;
      }
      return count;
    }, 0);

    document.title = totalUnread > 0 ? `(${totalUnread}) Nexora` : "Nexora";

    return () => {
      document.title = "Nexora";
    };
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
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const settingsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Calling state
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [showCallWindow, setShowCallWindow] = useState(false);
  const [callDisconnected, setCallDisconnected] = useState(false);
  const [showCallChat, setShowCallChat] = useState(false);
  const [callChatMsg, setCallChatMsg] = useState("");
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
  const [callStartTime, setCallStartTime] = useState<string | null>(null);
  const [showPreCallPreview, setShowPreCallPreview] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  // Forward message state
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);

  // Call feedback state
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
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Add people (convert direct to group)
  const [addPeopleMembers, setAddPeopleMembers] = useState<Employee[]>([]);
  const [savingConvert, setSavingConvert] = useState(false);

  // Thread panel
  const [threadMessage, setThreadMessage] = useState<ChatMessage | null>(null);

  // Status setter modal
  const [showStatusSetter, setShowStatusSetter] = useState(false);

  // Global search (Cmd+K)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  // Side panels
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  // Smart replies
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);
  const smartRepliesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Message scheduling
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const schedulePickerRef = useRef<HTMLDivElement>(null);

  // Read receipt detail popup
  const [readReceiptMsg, setReadReceiptMsg] = useState<string | null>(null);
  const [readReceiptData, setReadReceiptData] = useState<Array<{ userId: string; readAt: string }>>([]);
  const [readReceiptLoading, setReadReceiptLoading] = useState(false);
  const [readReceiptPos, setReadReceiptPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const readReceiptRef = useRef<HTMLDivElement>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // GIF picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const gifPickerRef = useRef<HTMLDivElement>(null);

  // File upload spinner
  const [isUploading, setIsUploading] = useState(false);

  // Drag-and-drop & upload progress
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; percent: number } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);

  // Socket state
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calling hooks
  const webrtc = useWebRTC();
  const signaling = useCallContext();

  // Stable callback refs — avoids re-subscribing socket handlers every render
  const webrtcRef = useRef(webrtc);
  const signalingRef = useRef(signaling);
  useEffect(() => { webrtcRef.current = webrtc; });
  useEffect(() => { signalingRef.current = signaling; });
  const { onOffer, onAnswerSdp, onIceCandidate, onEnded } = signaling;

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      (window as any).webrtc = webrtc;
    }
  }, [webrtc]);

  const rtcConfig = useMemo(
    () => ({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
      ],
    }),
    [],
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConvo = conversations.find((c) => c._id === activeId) || null;
  const callConversation =
    activeConvo ||
    (signaling.call?.conversationId
      ? conversations.find((c) => c._id === signaling.call?.conversationId) || null
      : null);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close GIF picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    if (showGifPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGifPicker]);

  // Sync call type for incoming calls
  useEffect(() => {
    if (signaling.call?.status === "ringing") {
      setCallType(signaling.call.type);
      if (signaling.call.conversationId) {
        setActiveId(signaling.call.conversationId);
      }
    }
  }, [signaling.call?.status, signaling.call?.type, signaling.call?.conversationId]);

  // Ringtones are handled globally by CallProvider

  // ── Offline Cache ──
  const offlineCache = useOfflineCache();

  // ── Conversation Drafts ──
  const drafts = useConversationDrafts();

  // ── Socket ──
  const { connected, emit, on, onlineUsers: onlineUserIds, presenceMap } = useGlobalSocket();

  // ── Control message handler — receives media state from remote peer via DataChannel ──
  const handleControlMessage = useCallback((msg: { type: string; hasVideo?: boolean }) => {
    if (msg.type === "media-state") {
      setRemoteHasVideo(!!msg.hasVideo);
    }
  }, []);

  // Reset remoteHasVideo when call ends
  useEffect(() => {
    if (!showCallWindow) setRemoteHasVideo(false);
  }, [showCallWindow]);

  // ── Cmd+K global search shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ── Load employees for name resolution ──
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await hrApi.getEmployees({ limit: "100" });
      // Filter out the logged-in user from chat contacts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emps = (res.data || []).filter((e: any) => e.email !== user?.email);
      setAllEmployees(emps);
      const map: Record<string, Employee> = {};
      for (const e of emps) {
        map[e.userId] = e;
        map[e._id] = e;
      }
      setEmployeeMap(map);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchEmployees();
  }, [user, fetchEmployees]);

  // ── Load chat settings ──
  useEffect(() => {
    if (!user) return;
    chatApi.getSettings().then((res) => {
      if (res.data) setChatSettings(res.data);
    }).catch(() => {});
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
      // Debounced save
      if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
      settingsDebounceRef.current = setTimeout(() => {
        chatApi.updateSettings(patch).catch(() => toast.error("Failed to save settings"));
      }, 600);
      return updated;
    });
  }, []);

  // ── Fetch conversations (with offline cache) ──
  const fetchConversations = useCallback(async () => {
    // Show cached conversations immediately while fetching from server
    if (offlineCache.isSupported) {
      try {
        const cached = await offlineCache.getCachedConversations();
        if (cached.length > 0) {
          setConversations(cached as Conversation[]);
          setLoadingConvos(false);
        }
      } catch {
        // IndexedDB read failed — continue to server fetch
      }
    }

    // Fetch from server if online
    if (navigator.onLine) {
      try {
        const res = await chatApi.getConversations();
        const data = res.data || [];
        setConversations(data);
        if (offlineCache.isSupported && data.length > 0) {
          offlineCache.cacheConversations(data).catch(() => {});
          offlineCache.setLastSyncTimestamp(new Date().toISOString()).catch(() => {});
        }
      } catch {
        // silent — API may not exist yet
      }
    }
    setLoadingConvos(false);
  }, [offlineCache]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  // ── Fetch messages for active conversation (with offline cache) ──
  const fetchMessages = useCallback(async (convoId: string) => {
    setLoadingMessages(true);

    // Show cached messages immediately
    if (offlineCache.isSupported) {
      try {
        const cached = await offlineCache.getCachedMessages(convoId, 100);
        if (cached.length > 0) {
          setMessages(cached as ChatMessage[]);
          setLoadingMessages(false);
        }
      } catch {
        // IndexedDB read failed
      }
    }

    // Fetch from server if online
    if (navigator.onLine) {
      try {
        const res = await chatApi.getMessages(convoId, { limit: "100" });
        const data = res.data || [];
        setMessages(data);
        chatApi.markAsRead(convoId).catch(() => {});
        if (offlineCache.isSupported && data.length > 0) {
          offlineCache.cacheMessages(convoId, data).catch(() => {});
        }
      } catch {
        if (!offlineCache.isSupported) setMessages([]);
      }
    }
    setLoadingMessages(false);
  }, [offlineCache]);

  // Save draft on conversation switch, restore on select
  const prevActiveIdForDraftRef = useRef<string | null>(null);
  useEffect(() => {
    // Save draft for previous conversation
    if (prevActiveIdForDraftRef.current && prevActiveIdForDraftRef.current !== activeId) {
      drafts.setDraft(prevActiveIdForDraftRef.current, input);
    }
    // Restore draft for newly selected conversation
    if (activeId) {
      const restored = drafts.getDraft(activeId);
      setInput(restored);
      fetchMessages(activeId);
    } else {
      setMessages([]);
    }
    prevActiveIdForDraftRef.current = activeId;
  }, [activeId, fetchMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Smart replies: fetch when conversation changes or new messages arrive ──
  useEffect(() => {
    setSmartReplies([]);
    if (!activeId || !user) return;
    if (smartRepliesTimerRef.current) clearTimeout(smartRepliesTimerRef.current);
    smartRepliesTimerRef.current = setTimeout(async () => {
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.senderId === user._id) { setSmartReplies([]); return; }
      setSmartRepliesLoading(true);
      try {
        const res = await chatApi.getSmartReplies(activeId);
        setSmartReplies(res.data?.replies || []);
      } catch { setSmartReplies([]); }
      finally { setSmartRepliesLoading(false); }
    }, 600);
    return () => { if (smartRepliesTimerRef.current) clearTimeout(smartRepliesTimerRef.current); };
  }, [activeId, messages[messages.length - 1]?._id, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delta sync on reconnect ──
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !prevConnectedRef.current && user) {
      // We just reconnected — refresh conversations and active messages
      fetchConversations();
      if (activeId) fetchMessages(activeId);
    }
    prevConnectedRef.current = connected;
  }, [connected, user, activeId, fetchConversations, fetchMessages]);

  // ── Socket: Join conversation room when active conversation changes ──
  useEffect(() => {
    if (!activeId || !connected) return;
    emit("conversation:join", { conversationId: activeId });
  }, [activeId, connected, emit]);

  // ── Socket: Listen for real-time events ──
  useEffect(() => {
    if (!connected) return;

    const cleanup1 = on("message:new", (msg: ChatMessage) => {
      // If message is in the active conversation, add to messages
      if (msg.conversationId === activeId) {
        setMessages((prev) => {
          // Avoid duplicates (message may already exist from REST response)
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      // Update conversation list's lastMessage
      setConversations((prev) =>
        prev.map((c) =>
          c._id === msg.conversationId
            ? { ...c, lastMessage: { content: msg.content, senderId: msg.senderId, sentAt: msg.createdAt } }
            : c
        )
      );
      // Cache incoming message to IndexedDB
      if (offlineCache.isSupported) {
        offlineCache.cacheMessages(msg.conversationId, [msg]).catch(() => {});
      }
    });

    const cleanup2 = on("message:edited", (msg: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    });

    const cleanup3 = on("message:deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true } : m)));
    });

    const cleanup4 = on("typing", ({ conversationId, userId, typing }: { conversationId: string; userId: string; typing: boolean }) => {
      if (conversationId === activeId) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (typing) next.add(userId);
          else next.delete(userId);
          return next;
        });
      }
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
    };
  }, [connected, on, activeId]);

  // ── Socket: Mark as read ──
  useEffect(() => {
    if (activeId && connected) {
      emit("message:read", { conversationId: activeId });
    }
  }, [activeId, connected, emit]);

  // ── Auto-scroll: instant on conversation switch, smooth on new messages ──
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!messages.length) return;
    const isConvoSwitch = prevActiveIdRef.current !== activeId;
    prevActiveIdRef.current = activeId;
    // Use instant scroll when opening a conversation, smooth for new messages
    messagesEndRef.current?.scrollIntoView({ behavior: isConvoSwitch ? "instant" : "smooth" });
  }, [messages.length, activeId]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // ── Schedule option helpers ──
  const getScheduleOptions = () => {
    const now = new Date();
    const laterToday = new Date(now);
    laterToday.setHours(laterToday.getHours() + 1, 0, 0, 0);
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(9, 0, 0, 0);
    const tomorrowAfternoon = new Date(now);
    tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
    tomorrowAfternoon.setHours(14, 0, 0, 0);
    const nextMonday = new Date(now);
    const daysUntilMonday = ((8 - nextMonday.getDay()) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return [
      { label: "Later today", sublabel: laterToday.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date: laterToday },
      { label: "Tomorrow morning", sublabel: "9:00 AM", date: tomorrowMorning },
      { label: "Tomorrow afternoon", sublabel: "2:00 PM", date: tomorrowAfternoon },
      { label: "Next Monday", sublabel: "Mon 9:00 AM", date: nextMonday },
    ];
  };
  const handleSelectSchedule = (date: Date) => {
    setScheduledAt(date);
    setShowSchedulePicker(false);
    setShowCustomSchedule(false);
  };
  const handleCustomScheduleConfirm = () => {
    if (!customDate || !customTime) { toast.error("Select both date and time"); return; }
    const dt = new Date(`${customDate}T${customTime}`);
    if (dt <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
    handleSelectSchedule(dt);
  };
  useEffect(() => {
    if (!showSchedulePicker) return;
    const handler = (e: MouseEvent) => {
      if (schedulePickerRef.current && !schedulePickerRef.current.contains(e.target as Node)) {
        setShowSchedulePicker(false);
        setShowCustomSchedule(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSchedulePicker]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (readReceiptRef.current && !readReceiptRef.current.contains(e.target as Node)) {
        setReadReceiptMsg(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Send message (REST only — socket receives the event back from backend) ──
  const handleSend = async () => {
    if (!input.trim() || !activeId) return;
    const content = input.trim();
    setInput("");
    if (scheduledAt) {
      try {
        await chatApi.scheduleMessage({ conversationId: activeId, content, scheduledAt: scheduledAt.toISOString() });
        const timeStr = scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        toast.success(`Message scheduled for ${timeStr}`);
        setScheduledAt(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to schedule message";
        toast.error(message);
      }
      return;
    }
    try {
      const res = await chatApi.sendMessage(activeId, content);
      if (res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === res.data!._id)) return prev;
          return [...prev, res.data!];
        });
      }
      drafts.clearDraft(activeId);
      fetchConversations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      toast.error(message);
    }
  };
  const handleReadReceiptClick = async (msgId: string, e: React.MouseEvent) => {
    if (!activeId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setReadReceiptPos({ top: rect.top - 8, left: rect.right + 8 });
    setReadReceiptMsg(msgId);
    setReadReceiptLoading(true);
    try {
      const res = await chatApi.getReadStatus(activeId);
      setReadReceiptData(res.data || []);
    } catch {
      setReadReceiptData([]);
    } finally {
      setReadReceiptLoading(false);
    }
  };

  // ── GIF send ──
  // Intentionally uses socket (not REST) for real-time delivery — GIFs are lightweight URL-only payloads.
  const handleGifSelect = useCallback((gifUrl: string) => {
    if (!activeId) return;
    emit("message:send", {
      conversationId: activeId,
      content: "GIF",
      type: "image",
      fileUrl: gifUrl,
      fileName: "gif",
    });
    setShowGifPicker(false);
    toast.success("GIF sent");
  }, [activeId, emit]);

  // ── Typing indicator ──
  const handleTyping = () => {
    if (activeId && connected) {
      emit("typing:start", { conversationId: activeId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emit("typing:stop", { conversationId: activeId });
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Upload file with progress and send as message ──
  const handleUploadAndSend = useCallback(async (file: File) => {
    if (!activeId) return;
    if (file.size === 0) {
      toast.error('Cannot send empty file');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`File "${file.name}" exceeds 25 MB limit`);
      return;
    }
    if (!isFileTypeAllowed(file)) {
      toast.error("File type not allowed");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const msgType = isImage ? "image" : isVideo ? "video" : "file";

    const abortController = new AbortController();
    uploadAbortRef.current = abortController;
    setUploadProgress({ fileName: file.name, percent: 0 });
    setIsUploading(true);

    try {
      const token = localStorage.getItem("accessToken") || "";
      const result = await uploadFileWithProgress(
        file,
        token,
        (percent) => setUploadProgress({ fileName: file.name, percent }),
        abortController.signal,
        activeId,
      );

      // Send message with uploaded file URL
      emit("message:send", {
        conversationId: activeId,
        content: file.name,
        type: msgType,
        fileUrl: result.url,
        fileName: file.name,
        fileSize: file.size,
        fileMimeType: file.type,
      });
      toast.success(`${isImage ? "Image" : isVideo ? "Video" : "File"} sent`);
      setUploadProgress({ fileName: file.name, percent: 100 });
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Upload cancelled");
      } else {
        toast.error(`Failed to upload "${file.name}"`);
      }
    } finally {
      setUploadProgress(null);
      setIsUploading(false);
      uploadAbortRef.current = null;
    }
  }, [activeId, emit]);

  // ── File upload (input handler) ──
  // Routes through handleUploadAndSend (XHR with progress) instead of reading as base64 DataURL
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    await handleUploadAndSend(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [activeId, handleUploadAndSend]);

  const handleCancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
  }, []);

  // Abort any in-flight upload on unmount
  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  // ── Drag-and-drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Process files sequentially so progress bar shows one at a time
    for (const file of files) {
      if (uploadAbortRef.current?.signal.aborted) break;
      await handleUploadAndSend(file);
    }
  }, [handleUploadAndSend]);

  // ── Clipboard paste for images ──
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!activeId) return;
    if (isUploading) return; // prevent parallel paste uploads
    const items = e.clipboardData?.items;
    if (!items) return;

    const EXT_MAP: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        // Check if clipboard also contains text
        const textContent = e.clipboardData.getData("text/plain");
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Give pasted images a meaningful name
          const ext = EXT_MAP[item.type] || 'png';
          const namedFile = new File([file], `pasted-image-${Date.now()}.${ext}`, { type: item.type });
          await handleUploadAndSend(namedFile);
        }
        // If there was also text content, insert it into the textarea
        if (textContent && textareaRef.current) {
          const ta = textareaRef.current;
          const start = ta.selectionStart ?? ta.value.length;
          const end = ta.selectionEnd ?? ta.value.length;
          const newValue = ta.value.slice(0, start) + textContent + ta.value.slice(end);
          setInput(newValue);
        }
        return; // Only handle first image
      }
    }
  }, [activeId, isUploading, handleUploadAndSend]);

  // ── Start direct conversation ──
  const handleStartDirect = async (emp: Employee) => {
    try {
      const res = await chatApi.createDirect(emp.userId);
      if (res.data) {
        setShowNewChatModal(false);
        await fetchConversations();
        setActiveId(res.data._id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create conversation";
      toast.error(message);
    }
  };

  // ── Create group ──
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Add at least one member");
      return;
    }
    setSavingGroup(true);
    try {
      const res = await chatApi.createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        memberIds: selectedMembers.map((m) => m.userId),
      });
      if (res.data) {
        setShowNewGroupModal(false);
        setGroupName("");
        setGroupDescription("");
        setSelectedMembers([]);
        await fetchConversations();
        setActiveId(res.data._id);
        toast.success("Group created");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create group";
      toast.error(message);
    } finally {
      setSavingGroup(false);
    }
  };

  // ── Create channel ──
  const handleCreateChannel = async () => {
    if (!channelName.trim()) {
      toast.error("Channel name is required");
      return;
    }
    setSavingChannel(true);
    try {
      const res = await chatApi.createChannel({
        name: channelName.trim(),
        description: channelDescription.trim() || undefined,
        memberIds: channelMembers.length > 0 ? channelMembers.map((m) => m.userId) : undefined,
      });
      if (res.data) {
        setShowNewChannelModal(false);
        setChannelName("");
        setChannelDescription("");
        setChannelMembers([]);
        setEmployeeSearch("");
        await fetchConversations();
        setActiveId(res.data._id);
        toast.success("Channel created");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create channel";
      toast.error(message);
    } finally {
      setSavingChannel(false);
    }
  };

  // ── Convert direct chat to group ──
  const handleConvertToGroup = async () => {
    if (!activeConvo || activeConvo.type !== "direct") return;
    if (addPeopleMembers.length === 0) {
      toast.error("Select at least one person to add");
      return;
    }
    setSavingConvert(true);
    try {
      // Build a default group name from all participants
      const existingNames = activeConvo.participants.map((p) => {
        const emp = employeeMap[p.userId];
        return emp ? emp.firstName : p.userId.slice(-4);
      });
      const newNames = addPeopleMembers.map((m) => m.firstName);
      const allNames = [...existingNames, ...newNames];
      const defaultGroupName = allNames.join(", ");

      const res = await chatApi.convertToGroup(
        activeConvo._id,
        addPeopleMembers.map((m) => m.userId),
        defaultGroupName,
      );
      if (res.data) {
        setShowAddPeopleModal(false);
        setAddPeopleMembers([]);
        setEmployeeSearch("");
        await fetchConversations();
        toast.success("Conversation converted to group");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add people";
      toast.error(message);
    } finally {
      setSavingConvert(false);
    }
  };

  // ── Conversation actions ──
  const handlePin = async () => {
    if (!activeId) return;
    try {
      await chatApi.togglePin(activeId);
      fetchConversations();
      setShowConvoMenu(false);
    } catch {
      toast.error("Failed to toggle pin");
    }
  };

  const handleMute = async () => {
    if (!activeId) return;
    try {
      await chatApi.toggleMute(activeId);
      fetchConversations();
      setShowConvoMenu(false);
    } catch {
      toast.error("Failed to toggle mute");
    }
  };

  const handleLeave = async () => {
    if (!activeId) return;
    try {
      await chatApi.leave(activeId);
      setActiveId(null);
      fetchConversations();
      setShowConvoMenu(false);
      toast.success("Left conversation");
    } catch {
      toast.error("Failed to leave");
    }
  };

  // ── Call handlers ──
  const getRecipientId = (): string | null => {
    if (!activeConvo || activeConvo.type !== "direct") return null;
    const other = activeConvo.participants.find((p) => p.userId !== user?._id);
    return other?.userId || null;
  };

  const handleInitiateCall = () => {
    const recipientId = getRecipientId();
    if (!recipientId) {
      toast.error("Can only call in direct conversations");
      return;
    }
    // Show pre-call preview instead of immediately calling
    setShowPreCallPreview(true);
  };

  const handlePreCallConfirm = async (settings: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    selectedAudioDeviceId?: string;
    selectedVideoDeviceId?: string;
  }) => {
    setShowPreCallPreview(false);
    const recipientId = getRecipientId();
    if (!recipientId) return;
    const recipientName = getEmployeeName(recipientId);
    try {
      setIsCaller(true);
      setCallType(settings.videoEnabled ? "video" : "audio");
      setIsAudioEnabled(settings.audioEnabled);
      setIsVideoEnabled(settings.videoEnabled);
      setCallStartTime(new Date().toISOString());
      webrtcInitializedRef.current = false;
      offerSentRef.current = false;
      const callId = await signaling.initiateCall(recipientId, settings.videoEnabled ? "video" : "audio", activeConvo?._id);
      if (!callId) {
        throw new Error("Unable to start call");
      }
      setShowCallWindow(true);
      toast.success(`Calling ${recipientName}...`);
    } catch (err) {
      setCallType(null);
      const message = err instanceof Error ? err.message : "Failed to initiate call";
      toast.error(message);
    }
  };

  // When a call is answered globally (via GlobalIncomingCall), open the call window here
  useEffect(() => {
    if (signaling.call?.status === "connected" && !showCallWindow && !isCaller) {
      setCallType(signaling.call.type);
      setIsAudioEnabled(true);
      setIsVideoEnabled(false);
      setCallStartTime(new Date().toISOString());
      setShowCallWindow(true);
      setIsCaller(false);
      if (signaling.call.conversationId) {
        setActiveId(signaling.call.conversationId);
      }
    }
  }, [signaling.call?.status, signaling.call?.type, signaling.call?.conversationId, showCallWindow, isCaller]);

  const handleToggleHold = () => {
    if (!signaling.call) return;
    if (isOnHold) {
      // Resume: restore previous media state
      webrtc.resumeCall(preHoldAudioState, preHoldVideoState);
      setIsAudioEnabled(preHoldAudioState);
      setIsVideoEnabled(preHoldVideoState);
      setIsOnHold(false);
      signaling.resumeCall();
    } else {
      // Hold: save current state, mute everything
      setPreHoldAudioState(isAudioEnabled);
      setPreHoldVideoState(isVideoEnabled);
      webrtc.holdCall();
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      setIsOnHold(true);
      signaling.holdCall();
    }
  };

  const handleEndCall = () => {
    setIsOnHold(false);
    try {
      webrtc.sendControl({ type: "media-state", hasVideo: false });
      signaling.endCall();
      webrtc.endCall();
      webrtcInitializedRef.current = false;
      offerSentRef.current = false;
      if (callDurationRef.current) clearTimeout(callDurationRef.current);
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      // Stop screen sharing if active
      screenShareStream?.getTracks().forEach((t) => t.stop());
      setScreenShareStream(null);
      setIsScreenSharing(false);
      setIsViewerAnnotating(false);
      // Exit fullscreen if active
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
      setFloatingEmojis([]);
      // Show "Call Disconnected" for a few seconds before closing
      setCallDisconnected(true);
      setTimeout(() => {
        setShowCallWindow(false);
        setCallDisconnected(false);
        setCallType(null);
        setCallDuration(0);
        setIsAudioEnabled(true);
        setIsVideoEnabled(false);
        setIsCaller(false);
        setCallStartTime(null);
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to end call";
      toast.error(message);
    }
  };

  // ── Recording handler ──
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      toast.success("Recording stopped — downloading file...");
    } else {
      // Start recording
      const streams: MediaStream[] = [];
      if (webrtc.localStream) streams.push(webrtc.localStream);
      if (webrtc.remoteStream) streams.push(webrtc.remoteStream);
      if (streams.length === 0) {
        toast.error("No active streams to record");
        return;
      }

      try {
        // Mix all audio + video tracks into one stream
        const mixedTracks: MediaStreamTrack[] = [];
        streams.forEach((s) => s.getTracks().forEach((t) => mixedTracks.push(t)));
        const combinedStream = new MediaStream(mixedTracks);

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : MediaRecorder.isTypeSupported("video/webm")
              ? "video/webm"
              : "audio/webm",
        });

        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const ext = recorder.mimeType.includes("video") ? "webm" : "webm";
          a.download = `nexora-call-recording-${new Date().toISOString().slice(0, 19)}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          recordedChunksRef.current = [];
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        toast.success("Recording started");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start recording";
        toast.error(message);
      }
    }
  }, [isRecording, webrtc.localStream, webrtc.remoteStream]);

  // ── Screen sharing handler ──
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing && screenShareStream) {
      await webrtc.stopScreenShare(screenShareStream);
      setScreenShareStream(null);
      setIsScreenSharing(false);
      setIsViewerAnnotating(false);
      toast.success("Screen sharing stopped");
    } else {
      const stream = await webrtc.startScreenShare();
      if (!stream) return; // user cancelled

      setScreenShareStream(stream);
      setIsScreenSharing(true);
      toast.success("Screen sharing started");

      // Auto-stop when user clicks "Stop sharing" in browser chrome
      stream.getVideoTracks()[0]?.addEventListener("ended", async () => {
        await webrtc.stopScreenShare(stream);
        setScreenShareStream(null);
        setIsScreenSharing(false);
        setIsViewerAnnotating(false);
      });
    }
  }, [isScreenSharing, screenShareStream, webrtc]);

  // ── Fullscreen handler ──
  const handleToggleFullscreen = useCallback(() => {
    const el = callWindowRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Listen for fullscreen exit via Escape
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  // ── Floating emoji reaction handler ──
  const handleEmojiReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 10 + Math.random() * 80; // random horizontal position 10%-90%
    setFloatingEmojis((prev) => [...prev, { id, emoji, x, startTime: Date.now() }]);
    // Remove after animation completes (3s)
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 3000);
  }, []);

  // ── Annotation clear handler ──
  const handleAnnotationClear = useCallback(() => {
    // Find the annotation canvas and clear it
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (canvas && (canvas as any).__clearCanvas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (canvas as any).__clearCanvas();
    }
  }, []);

  // ── Call duration timer ──
  useEffect(() => {
    if (signaling.call?.status === "connected" && showCallWindow) {
      callDurationRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callDurationRef.current) clearTimeout(callDurationRef.current);
    }
    return () => {
      if (callDurationRef.current) clearTimeout(callDurationRef.current);
    };
  }, [signaling.call?.status, showCallWindow]);

  // Stop local media when call is ended by remote party
  useEffect(() => {
    const unsubscribe = onEnded(() => {
      webrtcRef.current.endCall();
      webrtcInitializedRef.current = false;
      offerSentRef.current = false;
      if (offerRetryRef.current) {
        clearTimeout(offerRetryRef.current);
        offerRetryRef.current = null;
      }
      // Show "Call Disconnected" briefly before closing
      setCallDisconnected(true);
      setTimeout(() => {
        setShowCallWindow(false);
        setCallDisconnected(false);
        setCallType(null);
        setCallDuration(0);
        setIsAudioEnabled(true);
        setIsVideoEnabled(false);
        setIsCaller(false);
      }, 3000);
    });
    return unsubscribe;
  }, [onEnded]);

  // Attach remote audio stream (for both audio and video calls)
  useEffect(() => {
    if (remoteAudioRef.current && webrtc.remoteStream) {
      remoteAudioRef.current.srcObject = webrtc.remoteStream;
      remoteAudioRef.current.play?.().catch(() => {
        // Autoplay may be blocked; user gesture should resume playback.
      });
    }
    if (remoteAudioRef.current && !webrtc.remoteStream) {
      remoteAudioRef.current.srcObject = null;
    }
  }, [webrtc.remoteStream]);

  // ── WebRTC signaling ──
  // Uses refs so handlers always access latest functions without re-subscribing every render
  useEffect(() => {
    if (!signaling.connected) return;

    const unsubscribeOffer = onOffer(async (data) => {
      if (!data?.sdp) return;
      const w = webrtcRef.current;
      const s = signalingRef.current;
      // Use signaling ref for call type — callType from closure may be stale/null for receiver
      const isVideo = signalingRef.current.call?.type === "video" || callType === "video";
      if (!webrtcInitializedRef.current) {
        await w.initializeCall(rtcConfig, {
          media: { audio: true, video: isVideo },
          onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c),
          isInitiator: false,
          onControlMessage: handleControlMessage,
        });
        webrtcInitializedRef.current = true;
      }
      const answer = await w.createAnswer({ type: "offer", sdp: data.sdp });
      if (answer) s.sendAnswer(answer);
    });

    const unsubscribeAnswer = onAnswerSdp(async (data) => {
      if (!data?.sdp) return;
      await webrtcRef.current.setRemoteDescription({ type: "answer", sdp: data.sdp });
    });

    const unsubscribeIce = onIceCandidate(async (data) => {
      if (!data?.candidate) return;
      await webrtcRef.current.addIceCandidate(
        new RTCIceCandidate({
          candidate: data.candidate,
          sdpMLineIndex: data.sdpMLineIndex,
          sdpMid: data.sdpMid,
        }),
      );
    });

    return () => {
      unsubscribeOffer?.();
      unsubscribeAnswer?.();
      unsubscribeIce?.();
    };
  }, [signaling.connected, callType, rtcConfig, onOffer, onAnswerSdp, onIceCandidate]);

  // Initialize WebRTC once call is connected (caller only)
  // The receiver initializes in the onOffer handler to avoid a race condition
  // where both this effect and onOffer call initializeCall simultaneously.
  useEffect(() => {
    const status = signaling.call?.status;
    if (!showCallWindow || status !== "connected" || !isCaller) return;

    const w = webrtcRef.current;
    const media = { audio: isAudioEnabled, video: isVideoEnabled && callType === "video" };
    const initPromise = webrtcInitializedRef.current
      ? Promise.resolve()
      : w.initializeCall(rtcConfig, { media, onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c), isInitiator: true, onControlMessage: handleControlMessage }).then(() => {
          webrtcInitializedRef.current = true;
        });

    initPromise.then(async () => {
      if (!offerSentRef.current) {
        const offer = await webrtcRef.current.createOffer();
        if (offer) {
          signalingRef.current.sendOffer(offer);
          offerSentRef.current = true;
        }
      }
    });
  }, [signaling.call?.status, showCallWindow, isAudioEnabled, isVideoEnabled, callType, isCaller, rtcConfig]);

  // Pre-connect preview for caller (show local video while ringing)
  useEffect(() => {
    if (!showCallWindow) return;
    if (!isCaller) return;
    if (callType !== "video") return;
    if (webrtcInitializedRef.current) return;
    const media = { audio: true, video: true };
    webrtcRef.current.initializeCall(rtcConfig, { media, onIceCandidate: (c) => signalingRef.current.sendIceCandidate(c), isInitiator: true, onControlMessage: handleControlMessage }).then(() => {
      webrtcInitializedRef.current = true;
    });
  }, [showCallWindow, isCaller, callType, rtcConfig]);

  // Cleanup WebRTC on call end — respects callDisconnected delay
  useEffect(() => {
    const status = signaling.call?.status;
    if (!status) return;
    if (["ended", "rejected", "missed"].includes(status)) {
      webrtcRef.current.endCall();
      webrtcInitializedRef.current = false;
      offerSentRef.current = false;
      if (offerRetryRef.current) {
        clearTimeout(offerRetryRef.current);
        offerRetryRef.current = null;
      }
      // If callDisconnected is already showing, don't close immediately — the timeout handles it
      if (!callDisconnected) {
        setCallDisconnected(true);
        // Capture call info before clearing state
        const endedCallId = signaling.call?.callId;
        const endedDuration = signaling.call?.duration || callDuration;
        setTimeout(() => {
          setShowCallWindow(false);
          setCallDisconnected(false);
          setCallType(null);
          setCallDuration(0);
          setIsAudioEnabled(true);
          setIsVideoEnabled(false);
          setIsCaller(false);
          // Show feedback survey for calls > 10 seconds
          if (status === "ended" && endedDuration > 10 && endedCallId) {
            setFeedbackCallId(endedCallId);
            setFeedbackCallDuration(endedDuration);
            setShowCallFeedback(true);
          }
        }, 3000);
      }
    }
  }, [signaling.call?.status, callDisconnected, signaling.call?.callId, signaling.call?.duration, callDuration]);

  // If peer connection drops, force cleanup (e.g., remote ended without event)
  useEffect(() => {
    if (!showCallWindow) return;
    const state = webrtc.connectionState;
    const ice = webrtc.iceConnectionState;
    if (!state && !ice) return;

    const shouldCleanup = () => {
      webrtcRef.current.endCall();
      webrtcInitializedRef.current = false;
      offerSentRef.current = false;
      if (offerRetryRef.current) {
        clearTimeout(offerRetryRef.current);
        offerRetryRef.current = null;
      }
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      setShowCallWindow(false);
      setCallType(null);
      setCallDuration(0);
      setIsAudioEnabled(true);
      setIsVideoEnabled(false);
      setIsCaller(false);
    };

    const isDisconnected =
      state === "disconnected" ||
      ice === "disconnected" ||
      state === "failed" ||
      ice === "failed";

    if (state === "closed") {
      shouldCleanup();
      return;
    }

    if (isDisconnected) {
      if (signaling.call?.status === "connected" && isCaller && !iceRestartAttemptRef.current) {
        iceRestartAttemptRef.current = true;
        webrtcRef.current.restartIce().then((offer) => {
          if (offer) signalingRef.current.sendOffer(offer);
        });
        if (iceRestartResetRef.current) clearTimeout(iceRestartResetRef.current);
        iceRestartResetRef.current = setTimeout(() => {
          iceRestartAttemptRef.current = false;
        }, 10000);
      }
      if (!disconnectTimeoutRef.current) {
        disconnectTimeoutRef.current = setTimeout(() => {
          const w = webrtcRef.current;
          if (
            w.connectionState === "disconnected" ||
            w.connectionState === "failed" ||
            w.iceConnectionState === "disconnected" ||
            w.iceConnectionState === "failed"
          ) {
            shouldCleanup();
          } else if (disconnectTimeoutRef.current) {
            clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
        }, 20000);
      }
    } else {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      if (iceRestartResetRef.current) {
        clearTimeout(iceRestartResetRef.current);
        iceRestartResetRef.current = null;
      }
      iceRestartAttemptRef.current = false;
    }
  }, [showCallWindow, webrtc.connectionState, webrtc.iceConnectionState, signaling.call?.status, isCaller]);

  // Safety: ensure camera/mic stop when call window closes
  useEffect(() => {
    if (showCallWindow) return;
    webrtcRef.current.endCall();
    webrtcInitializedRef.current = false;
    offerSentRef.current = false;
    if (offerRetryRef.current) {
      clearTimeout(offerRetryRef.current);
      offerRetryRef.current = null;
    }
  }, [showCallWindow]);

  // Stop media on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      webrtcRef.current.endCall();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Monitor incoming calls ──
  useEffect(() => {
    if (signaling.isRinging && signaling.call?.type) {
      setCallType(signaling.call.type as "audio" | "video");
      setIsCaller(false);
    }
  }, [signaling.isRinging, signaling.call?.type]);

  // ── Name resolution helpers ──
  const getEmployeeName = (userId: string): string => {
    const emp = employeeMap[userId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return userId.slice(-6);
  };

  const getConversationDisplayName = (convo: Conversation): string => {
    if (convo.type === "direct") {
      const other = convo.participants.find((p) => p.userId !== user?._id);
      if (other) return getEmployeeName(other.userId);
      return convo.name || "Direct Message";
    }
    if (convo.type === "channel") return `# ${convo.name || "channel"}`;
    return convo.name || "Group";
  };

  const getParticipantNames = (convo: Conversation, max = 3): string => {
    const others = convo.participants
      .filter((p) => p.userId !== user?._id)
      .map((p) => {
        const emp = employeeMap[p.userId];
        return emp ? emp.firstName : p.userId.slice(-4);
      });
    if (others.length <= max) return others.join(", ");
    return others.slice(0, max).join(", ") + ` +${others.length - max}`;
  };

  const getConversationInitials = (convo: Conversation): string => {
    if (convo.type === "direct") {
      const other = convo.participants.find((p) => p.userId !== user?._id);
      if (other) {
        const emp = employeeMap[other.userId];
        if (emp) return getInitials(emp.firstName, emp.lastName);
      }
      return "DM";
    }
    return convo.name ? convo.name.slice(0, 2).toUpperCase() : "GR";
  };

  const getCallStatusLabel = () => {
    if (signaling.call?.status === "connected") return "Live";
    if (signaling.call?.status === "initiated") return "Calling";
    if (signaling.call?.status === "ringing") return "Ringing";
    return "Connecting";
  };

  // ── Check if other user in direct convo is online ──
  const isDirectConvoOnline = (convo: Conversation): boolean => {
    if (convo.type !== "direct") return false;
    const other = convo.participants.find((p) => p.userId !== user?._id);
    return other ? onlineUserIds.has(other.userId) : false;
  };

  // ── Typing indicator text ──
  const getTypingText = (): string | null => {
    if (typingUsers.size === 0) return null;
    const names = Array.from(typingUsers).map((uid) => {
      const emp = employeeMap[uid];
      return emp ? emp.firstName : uid.slice(-6);
    });
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  };

  // ── Filter & sort conversations (memoized) ──
  const filteredConversations = useMemo(() =>
    conversations
      .filter((c) => {
        if (tab !== "all" && c.type !== tab) return false;
        if (searchQuery) {
          const name = getConversationDisplayName(c).toLowerCase();
          return name.includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aTime = a.lastMessage?.sentAt || a.createdAt;
        const bTime = b.lastMessage?.sentAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    [conversations, tab, searchQuery, employeeMap, user?._id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Group messages by date (memoized) ──
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const dateKey = formatDateGroup(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateKey, messages: [msg] });
      }
    }
    return groups;
  }, [messages]);

  // ── Filtered employees for modals ──
  const MAX_EMPLOYEE_DISPLAY = 100;
  const filteredEmployeesAll = allEmployees.filter((e) => {
    if (e.userId === user?._id) return false;
    if (!employeeSearch) return true;
    const name = `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase();
    return name.includes(employeeSearch.toLowerCase());
  });
  const filteredEmployees = filteredEmployeesAll.slice(0, MAX_EMPLOYEE_DISPLAY);
  const truncatedEmployeeCount = filteredEmployeesAll.length - filteredEmployees.length;

  // ── Check unread ──
  const hasUnread = (convo: Conversation): boolean => {
    if (!user) return false;
    const participant = convo.participants.find((p) => p.userId === user._id);
    if (!participant?.lastReadAt || !convo.lastMessage?.sentAt) return false;
    return new Date(convo.lastMessage.sentAt) > new Date(participant.lastReadAt);
  };

  const typingText = getTypingText();

  // ── Read receipt ticks ──
  const getTickStatus = (msg: ChatMessage) => {
    if (chatSettings && !chatSettings.readReceipts.showOthersReadStatus) {
      // Single gray tick - sent
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1">{"\u2713"}</span>
      );
    }
    const otherParticipants = activeConvo?.participants.filter(p => p.userId !== user?._id) || [];
    const readCount = msg.readBy?.filter(r => r.userId !== user?._id).length || 0;

    if (readCount >= otherParticipants.length && otherParticipants.length > 0) {
      // All read - double blue ticks
      return (
        <span className="text-[10px] text-[#2E86C1] ml-1 tracking-[-3px] cursor-pointer hover:opacity-70" onClick={(e) => handleReadReceiptClick(msg._id, e)} title="See who read this">{"\u2713\u2713"}</span>
      );
    } else if (readCount > 0) {
      // Partially read - double gray ticks
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1 tracking-[-3px] cursor-pointer hover:opacity-70" onClick={(e) => handleReadReceiptClick(msg._id, e)} title="See who read this">{"\u2713\u2713"}</span>
      );
    } else {
      // Sent - single gray tick
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1">{"\u2713"}</span>
      );
    }
  };

  // ── Loading ──
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      {/* Offline banner */}
      {!offlineCache.isOnline && (
        <div className="ml-[260px] bg-amber-500 text-white text-center text-sm py-1.5 px-4 font-medium">
          You&apos;re offline — showing cached messages
        </div>
      )}

      <main className="ml-[260px] h-screen flex">
        {/* ── Left Panel: Conversation List ── */}
        <div className="w-[300px] border-r border-[#E2E8F0] bg-white flex flex-col h-full shrink-0">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-gradient-to-b from-white to-[#FAFBFC] shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#0F172A]">Chat</h2>
                <button
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  className={`p-1 rounded-lg transition-colors ${showSettingsPanel ? "bg-[#EBF5FF] text-[#2E86C1]" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`}
                  title="Chat Settings"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setShowNewChatModal(true); setEmployeeSearch(""); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors"
                  title="New Chat"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Chat
                </button>
                <button
                  onClick={() => { setShowNewGroupModal(true); setEmployeeSearch(""); setSelectedMembers([]); setGroupName(""); setGroupDescription(""); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors"
                  title="New Group"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Group
                </button>
                <button
                  onClick={() => { setShowNewChannelModal(true); setEmployeeSearch(""); setChannelMembers([]); setChannelName(""); setChannelDescription(""); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors"
                  title="New Channel"
                >
                  <span className="text-sm font-bold leading-none">#</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5 mb-2.5" role="tablist" aria-label="Conversation type filter">
              {(["all", "direct", "group", "channel"] as TabFilter[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors capitalize ${
                    tab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
                  }`}
                >
                  {t === "all" ? "All" : t === "direct" ? "Direct" : t === "group" ? "Groups" : "Channels"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* Conversation List */}
          <ErrorBoundary>
          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="py-2">
                <SkeletonLoader variant="conversation" count={8} />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-[#334155] mb-1">No conversations yet</p>
                <p className="text-[12px] text-[#94A3B8]">Start a conversation with a colleague</p>
                <button
                  onClick={() => { setShowNewChatModal(true); setEmployeeSearch(""); }}
                  className="mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors"
                >
                  New Chat
                </button>
              </div>
            ) : (
              filteredConversations.map((convo) => {
                const isActive = convo._id === activeId;
                const unread = hasUnread(convo);
                const displayName = getConversationDisplayName(convo);
                const initials = getConversationInitials(convo);
                const lastMsgTime = convo.lastMessage?.sentAt || convo.createdAt;
                const isOnline = isDirectConvoOnline(convo);

                return (
                  <button
                    key={convo._id}
                    onClick={() => { setActiveId(convo._id); setShowMembersPanel(false); setShowConvoMenu(false); }}
                    className={`w-full text-left px-3 py-3 transition-colors hover:bg-[#F1F5F9] ${
                      isActive ? "bg-[#EBF5FF] border-l-2 border-[#2E86C1]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar */}
                      <div className="relative shrink-0 group/convo">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold ${
                          convo.type === "direct" ? "bg-[#2E86C1]" : convo.type === "channel" ? "bg-[#7C3AED]" : "bg-[#0D9488]"
                        }`}>
                          {convo.type === "direct" ? initials : convo.type === "channel" ? (
                            <span className="text-sm font-bold">#</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </div>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full" />
                        )}
                        {/* Hover popup */}
                        {convo.type === "direct" && (() => {
                          const otherP = convo.participants.find((p) => p.userId !== user?._id);
                          const otherEmp = otherP ? employeeMap[otherP.userId] : null;
                          return (
                            <div className="absolute top-full left-0 mt-2 hidden group-hover/convo:block z-50 pointer-events-none">
                              <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                                <p className="text-[12px] font-semibold">{displayName}</p>
                                {otherEmp?.email && <p className="text-[10px] text-[#94A3B8]">{otherEmp.email}</p>}
                                {otherEmp?.location && <p className="text-[10px] text-[#94A3B8]">{otherEmp.location}</p>}
                                <div className="flex items-center gap-1 mt-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"}`} />
                                  <span className="text-[10px] text-[#94A3B8]">{isOnline ? "Online" : "Offline"}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            {convo.isPinned && (
                              <svg className="w-3 h-3 text-[#94A3B8] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a.75.75 0 01.75.75v.258a33.186 33.186 0 016.668.83.75.75 0 01-.336 1.461 31.28 31.28 0 00-1.103-.232l1.702 7.545a.75.75 0 01-.387.832A4.981 4.981 0 0115 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.77-7.849a31.743 31.743 0 00-3.339-.254V17.5h2.25a.75.75 0 010 1.5h-6a.75.75 0 010-1.5h2.25V4.509a31.743 31.743 0 00-3.339.254l1.77 7.849a.75.75 0 01-.387.832A4.981 4.981 0 015 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.702-7.545c-.372.07-.74.148-1.103.232a.75.75 0 01-.336-1.462 33.186 33.186 0 016.668-.829V2.75A.75.75 0 0110 2z" />
                              </svg>
                            )}
                            <p className={`text-[13px] font-medium truncate ${isActive ? "text-[#2E86C1]" : "text-[#0F172A]"}`}>
                              {displayName}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-[#94A3B8]">{timeAgo(lastMsgTime)}</span>
                            {unread && <span className="w-2 h-2 rounded-full bg-[#2E86C1]" />}
                          </div>
                        </div>
                        {convo.lastMessage ? (
                          <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                            {convo.lastMessage.senderId === user._id ? "You: " : ""}
                            {convo.lastMessage.content}
                          </p>
                        ) : convo.type !== "direct" ? (
                          <p className="text-[10px] text-[#CBD5E1] truncate mt-0.5">
                            {getParticipantNames(convo, 3)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          </ErrorBoundary>
        </div>

        {/* ── Middle Panel: Active Conversation ── */}
        <div
          className="flex-1 flex flex-col h-full bg-[#F8FAFC] min-w-0 relative"
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
            <>
              {/* Chat Header */}
              <div className="h-[60px] flex items-center justify-between px-5 border-b border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm ${
                      activeConvo.type === "direct" ? "bg-[#2E86C1]" : activeConvo.type === "channel" ? "bg-[#7C3AED]" : "bg-[#0D9488]"
                    }`}>
                      {activeConvo.type === "direct" ? getConversationInitials(activeConvo) : activeConvo.type === "channel" ? (
                        <span className="text-sm font-bold">#</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </div>
                    {activeConvo.type === "direct" && (() => {
                      const otherUserId = activeConvo.participants.find(p => p.userId !== user?._id)?.userId || "";
                      const presence = presenceMap.get(otherUserId);
                      const status = presence?.status || (onlineUserIds.has(otherUserId) ? "online" : "offline");
                      return status !== "offline" ? (
                        <PresenceIndicator status={status} size="md" className="absolute -bottom-0.5 -right-0.5" />
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{getConversationDisplayName(activeConvo)}</p>
                    <p className="text-[11px] text-[#94A3B8] truncate max-w-[300px]">
                      {activeConvo.type === "direct"
                        ? (() => {
                            const otherUserId = activeConvo.participants.find(p => p.userId !== user?._id)?.userId || "";
                            const presence = presenceMap.get(otherUserId);
                            if (presence?.customText) return presence.customText;
                            const status = presence?.status || (onlineUserIds.has(otherUserId) ? "online" : "offline");
                            return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
                          })()
                        : getParticipantNames(activeConvo, 4)
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {activeConvo.type === "direct" && (
                    <button
                      onClick={() => handleInitiateCall()}
                      disabled={showCallWindow}
                      className="p-2 text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                      title="Call"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </button>
                  )}
                  {activeConvo.type === "direct" && (
                    <button
                      onClick={() => { setShowAddPeopleModal(true); setAddPeopleMembers([]); setEmployeeSearch(""); }}
                      className="p-2 text-[#475569] hover:bg-[#F1F5F9] rounded-lg transition-colors"
                      title="Add People"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                  )}
                  {activeConvo.type !== "direct" && (
                    <button
                      onClick={() => setShowMembersPanel(!showMembersPanel)}
                      className={`p-2 rounded-lg transition-colors ${showMembersPanel ? "bg-[#EBF5FF] text-[#2E86C1]" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
                      title="Members"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                    </button>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setShowConvoMenu(!showConvoMenu)}
                      className="p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                      </svg>
                    </button>
                    {showConvoMenu && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-[#E2E8F0] py-1 z-50">
                        <button onClick={handlePin} className="w-full text-left px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                          {activeConvo.isPinned ? "Unpin" : "Pin"} conversation
                        </button>
                        <button onClick={handleMute} className="w-full text-left px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                          Mute conversation
                        </button>
                        {activeConvo.type !== "direct" && (
                          <button onClick={handleLeave} className="w-full text-left px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors">
                            Leave conversation
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <ErrorBoundary>
              <div
                className="flex-1 overflow-y-auto px-5 py-4"
                onClick={() => { setShowConvoMenu(false); }}
                style={{ backgroundColor: chatSettings?.appearance?.chatBgColor || "#F8FAFC" }}
              >
                {loadingMessages ? (
                  <div className="py-4">
                    <SkeletonLoader variant="message" count={5} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-[#EBF5FF] flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-[13px] text-[#94A3B8]">Send the first message</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedMessages.map((group) => (
                      <div key={group.date}>
                        {/* Date separator */}
                        <div className="flex items-center justify-center my-4">
                          <div className="bg-[#E2E8F0] h-px flex-1" />
                          <span className="px-3 text-[10px] font-medium text-[#94A3B8]">{group.date}</span>
                          <div className="bg-[#E2E8F0] h-px flex-1" />
                        </div>

                        <div className="space-y-2">
                          {group.messages.map((msg) => {
                            const isMe = msg.senderId === user._id;
                            const isSystem = msg.type === "system";
                            const isDeleted = msg.isDeleted;

                            if (isSystem) {
                              return (
                                <div key={msg._id} className="flex justify-center py-1">
                                  <p className="text-[11px] text-[#94A3B8] italic">{msg.content}</p>
                                </div>
                              );
                            }

                            return (
                              <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${!isMe && activeConvo.type !== "direct" ? "items-end gap-2" : ""}`}>
                                {/* Avatar with hover popup for other users in groups */}
                                {!isMe && activeConvo.type !== "direct" && (() => {
                                  const senderEmp = employeeMap[msg.senderId];
                                  const senderName = senderEmp ? `${senderEmp.firstName} ${senderEmp.lastName}` : msg.senderId.slice(-6);
                                  const senderInitials = senderEmp ? getInitials(senderEmp.firstName, senderEmp.lastName) : "??";
                                  const senderOnline = onlineUserIds.has(msg.senderId);
                                  return (
                                    <div className="relative group/avatar shrink-0">
                                      <div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[9px] font-semibold">
                                        {senderInitials}
                                      </div>
                                      {/* Hover popup */}
                                      <div className="absolute top-full left-0 mt-2 hidden group-hover/avatar:block z-50">
                                        <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                                          <p className="text-[12px] font-semibold">{senderName}</p>
                                          {senderEmp?.email && <p className="text-[10px] text-[#94A3B8]">{senderEmp.email}</p>}
                                          {senderEmp?.location && <p className="text-[10px] text-[#94A3B8]">{senderEmp.location}</p>}
                                          <div className="flex items-center gap-1 mt-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${senderOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"}`} />
                                            <span className="text-[10px] text-[#94A3B8]">{senderOnline ? "Online" : "Offline"}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="max-w-[70%]">
                                  {/* Sender name in groups */}
                                  {!isMe && activeConvo.type !== "direct" && (
                                    <p className="text-[11px] text-[#64748B] mb-0.5 ml-1">
                                      {getEmployeeName(msg.senderId)}
                                    </p>
                                  )}
                                  <div
                                    className={`px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${
                                      !isDeleted && msg.type === "text" && isEmojiOnly(msg.content)
                                        ? "text-[32px] !bg-transparent !px-1 !py-0"
                                        : chatSettings?.appearance?.fontSize === "small" ? "text-[12px]" : chatSettings?.appearance?.fontSize === "large" ? "text-[15px]" : "text-[13px]"
                                    } ${
                                      isDeleted
                                        ? "bg-[#F1F5F9] text-[#94A3B8] italic rounded-2xl"
                                        : isMe
                                          ? "rounded-2xl rounded-br-sm"
                                          : "rounded-2xl rounded-bl-sm"
                                    }`}
                                    style={
                                      !isDeleted && msg.type === "text" && isEmojiOnly(msg.content)
                                        ? undefined
                                        : isDeleted ? undefined : isMe
                                          ? { backgroundColor: chatSettings?.appearance?.myBubbleColor || "#2E86C1", color: chatSettings?.appearance?.myTextColor || "#FFFFFF" }
                                          : { backgroundColor: chatSettings?.appearance?.otherBubbleColor || "#F1F5F9", color: chatSettings?.appearance?.otherTextColor || "#334155" }
                                    }
                                  >
                                    {isDeleted ? "This message was deleted" : msg.type === "image" && msg.fileUrl ? (
                                      <div>
                                        <img src={msg.fileUrl} alt={msg.fileName || "Image"} className="max-w-full max-h-60 rounded-lg cursor-pointer" onClick={() => window.open(msg.fileUrl, "_blank")} />
                                        <div className="flex items-center justify-between mt-1">
                                          {msg.fileName && <p className="text-[10px] opacity-60 truncate">{msg.fileName}</p>}
                                          {!isMe && (
                                            <a href={msg.fileUrl} download={msg.fileName || "image"} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity ml-auto">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                              Download
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ) : msg.type === "video" && msg.fileUrl ? (
                                      <div>
                                        <video src={msg.fileUrl} controls className="max-w-full max-h-60 rounded-lg" />
                                        <div className="flex items-center justify-between mt-1">
                                          {msg.fileName && <p className="text-[10px] opacity-60 truncate">{msg.fileName}</p>}
                                          {!isMe && (
                                            <a href={msg.fileUrl} download={msg.fileName || "video"} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity ml-auto">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                              Download
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ) : msg.type === "audio" && msg.fileUrl ? (
                                      <div className="min-w-[240px]">
                                        <audio src={msg.fileUrl} controls className="w-full h-8" preload="metadata" />
                                        {msg.fileName && <p className="text-[10px] opacity-60 mt-1 truncate">{msg.fileName}</p>}
                                        {/* Voice transcription */}
                                        {msg.transcription ? (
                                          <div className="mt-1.5 px-2 py-1.5 bg-black/5 rounded-lg">
                                            <p className="text-[10px] font-medium opacity-50 mb-0.5">Transcription</p>
                                            <p className="text-[11px] opacity-80 leading-relaxed">{msg.transcription}</p>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={async () => {
                                              try {
                                                const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                                if (!SpeechRecognitionApi) { toast.error("Speech recognition not supported in this browser"); return; }
                                                toast.info("Transcribing voice message...");
                                                const audioEl = new Audio(msg.fileUrl);
                                                audioEl.crossOrigin = "anonymous";
                                                const audioCtx = new AudioContext();
                                                const source = audioCtx.createMediaElementSource(audioEl);
                                                const dest = audioCtx.createMediaStreamDestination();
                                                source.connect(dest);
                                                source.connect(audioCtx.destination);
                                                const recognition = new SpeechRecognitionApi();
                                                recognition.continuous = true;
                                                recognition.interimResults = false;
                                                recognition.lang = "en-US";
                                                let transcript = "";
                                                recognition.onresult = (event: any) => {
                                                  for (let i = event.resultIndex; i < event.results.length; i++) {
                                                    if (event.results[i].isFinal) transcript += event.results[i][0].transcript + " ";
                                                  }
                                                };
                                                recognition.onend = async () => {
                                                  audioCtx.close();
                                                  const text = transcript.trim() || "Unable to transcribe";
                                                  try {
                                                    await chatApi.transcribeVoiceMessage(msg._id, text);
                                                    setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, transcription: text } : m));
                                                    toast.success("Transcription saved");
                                                  } catch { toast.error("Failed to save transcription"); }
                                                };
                                                recognition.onerror = () => { audioCtx.close(); toast.error("Transcription failed"); };
                                                audioEl.onended = () => { setTimeout(() => recognition.stop(), 500); };
                                                recognition.start();
                                                audioEl.play();
                                              } catch { toast.error("Transcription failed"); }
                                            }}
                                            className="mt-1.5 flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] rounded-md transition-colors"
                                          >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                                            Transcribe
                                          </button>
                                        )}
                                      </div>
                                    ) : msg.type === "file" ? (
                                      <div className="py-1.5 min-w-[220px]">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-medium truncate">{msg.fileName || msg.content}</p>
                                            {msg.fileSize && <p className="text-[10px] opacity-60">{msg.fileSize >= 1024 * 1024 ? (msg.fileSize / (1024 * 1024)).toFixed(1) + " MB" : (msg.fileSize / 1024).toFixed(0) + " KB"}</p>}
                                          </div>
                                        </div>
                                        {!isMe && msg.fileUrl ? (
                                          <a
                                            href={msg.fileUrl}
                                            download={msg.fileName || "file"}
                                            className="flex items-center justify-center gap-1.5 mt-2 w-full px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
                                            title="Download file"
                                          >
                                            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                            <span className="text-[11px] font-medium opacity-70">Download</span>
                                          </a>
                                        ) : !isMe && !msg.fileUrl ? (
                                          <div className="flex items-center justify-center gap-1.5 mt-2 w-full px-3 py-2 rounded-lg bg-black/5 opacity-50">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                            <span className="text-[11px] font-medium">File shared</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <MessageContent content={msg.content} />
                                    )}
                                    {msg.isEdited && !isDeleted && (
                                      <span className="text-[10px] opacity-60 ml-1">(edited)</span>
                                    )}
                                  </div>
                                  {/* Thread reply count */}
                                  {!isDeleted && (msg as any).threadInfo?.replyCount > 0 && (
                                    <button
                                      onClick={() => setThreadMessage(msg)}
                                      className="flex items-center gap-1 mt-0.5 ml-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                      {(msg as any).threadInfo.replyCount} {(msg as any).threadInfo.replyCount === 1 ? "reply" : "replies"}
                                    </button>
                                  )}
                                  <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end mr-1" : "ml-1"}`}>
                                    <p className="text-[10px] text-[#94A3B8]">
                                      {formatTime(msg.createdAt)}
                                    </p>
                                    {isMe && getTickStatus(msg)}
                                    {/* Reply in thread action */}
                                    {!isDeleted && (
                                      <button
                                        onClick={() => setThreadMessage(msg)}
                                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                                        title="Reply in thread"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                      </button>
                                    )}
                                    {/* Forward message action */}
                                    {!isDeleted && (
                                      <button
                                        onClick={() => setForwardMessageId(msg._id)}
                                        className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
                                        title="Forward"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator — animated bubbles */}
                    {typingText && (
                      <div className="flex items-end gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#94A3B8] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
                          {Array.from(typingUsers)[0] ? getInitials(
                            employeeMap[Array.from(typingUsers)[0]]?.firstName || "?",
                            employeeMap[Array.from(typingUsers)[0]]?.lastName || ""
                          ) : "..."}
                        </div>
                        <div className="bg-[#F1F5F9] rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <p className="text-[10px] text-[#94A3B8] mt-1">{typingText}</p>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              </ErrorBoundary>

              {/* Upload progress bar */}
              {uploadProgress && (
                <div className="px-5 pb-1 bg-[#F8FAFC] shrink-0">
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-[#EBF5FF] border border-[#BFDBFE] rounded-xl">
                    <svg className="w-4 h-4 text-[#2E86C1] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-[#2E86C1] truncate">{uploadProgress.fileName}</span>
                        <span className="text-[10px] text-[#64748B] shrink-0 ml-2">{uploadProgress.percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#BFDBFE] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2E86C1] rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCancelUpload}
                      className="p-1 rounded hover:bg-blue-200/60 text-[#64748B] hover:text-red-500 transition-colors shrink-0"
                      title="Cancel upload"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              {/* Upload spinner (fallback for file input uploads without progress) */}
              {isUploading && !uploadProgress && (
                <div className="px-5 pb-1 bg-[#F8FAFC] shrink-0">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#EBF5FF] border border-[#BFDBFE] rounded-xl">
                    <svg className="w-4 h-4 text-[#2E86C1] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-[12px] font-medium text-[#2E86C1]">Uploading file...</span>
                  </div>
                </div>
              )}

              {/* Read Receipt Detail Popup */}
              {readReceiptMsg && (
                <div ref={readReceiptRef} className="fixed z-[60] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 px-3 w-[220px]" style={{ top: Math.min(readReceiptPos.top, typeof window !== "undefined" ? window.innerHeight - 200 : 400), left: Math.min(readReceiptPos.left, typeof window !== "undefined" ? window.innerWidth - 240 : 600) }}>
                  {readReceiptLoading ? (
                    <div className="flex items-center justify-center py-3"><svg className="w-5 h-5 text-[#2E86C1] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>
                  ) : activeConvo?.type === "direct" ? (
                    <div>
                      {readReceiptData.filter(r => r.userId !== user?._id).length > 0 ? (
                        <p className="text-[11px] text-[#334155]">Read {timeAgo(readReceiptData.filter(r => r.userId !== user?._id)[0]?.readAt)}</p>
                      ) : (
                        <p className="text-[11px] text-[#94A3B8]">Delivered</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                        Delivered to {activeConvo?.participants.filter(p => p.userId !== user?._id).length || 0}, Read by {readReceiptData.filter(r => r.userId !== user?._id).length}
                      </p>
                      <div className="max-h-[160px] overflow-y-auto space-y-1.5">
                        {readReceiptData.filter(r => r.userId !== user?._id).map((r) => {
                          const emp = employeeMap[r.userId];
                          const name = emp ? `${emp.firstName} ${emp.lastName}` : r.userId.slice(-6);
                          return (
                            <div key={r.userId} className="flex items-center justify-between">
                              <span className="text-[11px] text-[#334155] font-medium truncate">{name}</span>
                              <span className="text-[10px] text-[#94A3B8] shrink-0 ml-2">{timeAgo(r.readAt)}</span>
                            </div>
                          );
                        })}
                        {readReceiptData.filter(r => r.userId !== user?._id).length === 0 && (
                          <p className="text-[11px] text-[#94A3B8] italic">No one has read this yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice Huddle Widget (channels only) */}
              {activeConvo?.type === "channel" && user && (
                <VoiceHuddle
                  channelId={activeConvo._id}
                  currentUserId={user._id}
                  currentUserName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || "User"}
                />
              )}

              {/* Smart Reply Suggestions */}
              {smartReplies.length > 0 && (
                <div className="px-5 pb-1 pt-1 shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    {smartReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setInput(reply); setSmartReplies([]); textareaRef.current?.focus(); }}
                        className="px-3 py-1.5 text-[12px] text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] border border-[#BEE0F7] rounded-full transition-colors font-medium truncate max-w-[200px]"
                        title={reply}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="px-5 pb-4 pt-2 bg-gradient-to-t from-[#F1F5F9] to-[#F8FAFC] shrink-0">
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv" onChange={handleFileSelect} />
                <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm shadow-[#E2E8F0]/60">
                  <div className="flex items-end gap-1 px-3 py-2">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder={isUploading ? "Uploading file..." : "Type a message..."}
                      disabled={isUploading}
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus:outline-none py-1.5 max-h-[120px] disabled:opacity-50"
                    />
                    {/* Schedule message button */}
                    <div className="relative" ref={schedulePickerRef}>
                      <button onClick={() => setShowSchedulePicker(!showSchedulePicker)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${scheduledAt ? "bg-[#F59E0B] hover:bg-[#D97706] text-white" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`} title={scheduledAt ? `Scheduled: ${scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Schedule message"}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </button>
                      {showSchedulePicker && (
                        <div className="absolute bottom-full mb-2 right-0 w-[240px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 py-1">
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Schedule send</p>
                          {getScheduleOptions().map((opt) => (
                            <button key={opt.label} onClick={() => handleSelectSchedule(opt.date)} className="w-full flex items-center justify-between px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-[10px] text-[#94A3B8]">{opt.sublabel}</span>
                            </button>
                          ))}
                          <div className="h-px bg-[#E2E8F0] my-0.5" />
                          {!showCustomSchedule ? (
                            <button onClick={() => setShowCustomSchedule(true)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-[#2E86C1] hover:bg-[#EBF5FF] transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                              <span className="font-medium">Custom date &amp; time</span>
                            </button>
                          ) : (
                            <div className="px-3 py-2 space-y-2">
                              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1]" />
                              <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1]" />
                              <button onClick={handleCustomScheduleConfirm} className="w-full px-3 py-1.5 text-[11px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors">Set time</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Send / Schedule send button */}
                    <button onClick={handleSend} disabled={!input.trim() || isUploading} className={`w-8 h-8 flex items-center justify-center rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 ${scheduledAt ? "bg-[#F59E0B] hover:bg-[#D97706]" : "bg-[#2E86C1] hover:bg-[#2471A3]"}`} title={scheduledAt ? "Send scheduled message" : "Send message"}>
                      {scheduledAt ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                      )}
                    </button>
                  </div>
                  {/* Scheduled time indicator */}
                  {scheduledAt && (
                    <div className="flex items-center gap-1.5 px-3 py-1 border-t border-[#FEF3C7] bg-[#FFFBEB] rounded-b-2xl">
                      <svg className="w-3 h-3 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[11px] text-[#92400E] font-medium">Scheduling for: {scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <button onClick={() => setScheduledAt(null)} className="ml-auto p-0.5 rounded hover:bg-[#FDE68A] text-[#92400E] transition-colors" title="Cancel scheduling">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                  {/* Toolbar — Attachments, Emoji, Formatting */}
                  <div className="flex items-center gap-0.5 px-2 pb-1.5 pt-0.5 border-t border-[#F1F5F9]">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                      title="Attach file"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = "image/*";
                          fileInputRef.current.click();
                          fileInputRef.current.accept = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv";
                        }
                      }}
                      className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                      title="Send image"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    </button>
                    <div className="w-px h-4 bg-[#E2E8F0] mx-1" />
                    {/* Emoji picker button */}
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        className={`p-1.5 rounded-md transition-colors ${showEmojiPicker ? "text-[#2E86C1] bg-[#EBF5FF]" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`}
                        title="Emoji picker"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                        </svg>
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-full mb-2 right-0 w-[340px] max-h-[360px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
                          <div className="overflow-y-auto flex-1 p-3">
                            {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                              <div key={category} className="mb-3">
                                <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">{category}</p>
                                <div className="flex flex-wrap gap-0.5">
                                  {emojis.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => { setInput((prev) => prev + emoji); }}
                                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#F1F5F9] transition-colors text-lg"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* GIF picker button */}
                    <div className="relative" ref={gifPickerRef}>
                      <button
                        onClick={() => {
                          setShowGifPicker((prev) => !prev);
                          setShowEmojiPicker(false);
                        }}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                          showGifPicker
                            ? "text-[#2E86C1] bg-[#EBF5FF]"
                            : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"
                        }`}
                        title="GIF picker"
                      >
                        GIF
                      </button>
                      {showGifPicker && (
                        <div className="absolute bottom-full mb-2 right-0">
                          <GifPicker onSelect={handleGifSelect} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── Speed Dial / Recommended Contacts ── */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#EBF5FF] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-[#0F172A]">Start a Conversation</h2>
                  <p className="text-[13px] text-[#94A3B8] mt-1">Pick a colleague to chat with</p>
                </div>

                {/* Speed Dial — Quick contacts grid */}
                {allEmployees.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3 px-1">People</p>
                    <div className="grid grid-cols-4 gap-3">
                      {allEmployees
                        .filter(e => e.userId !== user?._id)
                        .slice(0, 8)
                        .map((emp) => {
                          const isOnline = onlineUserIds.has(emp.userId);
                          return (
                            <button
                              key={emp._id}
                              onClick={() => handleStartDirect(emp)}
                              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FF]/30 transition-all group"
                            >
                              <div className="relative">
                                <div className="w-11 h-11 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-sm font-semibold group-hover:scale-105 transition-transform">
                                  {getInitials(emp.firstName, emp.lastName)}
                                </div>
                                {isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full" />
                                )}
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

                {/* Quick actions */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => { setShowNewChatModal(true); setEmployeeSearch(""); }}
                    className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-xl transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New Chat
                  </button>
                  <button
                    onClick={() => { setShowNewGroupModal(true); setEmployeeSearch(""); setSelectedMembers([]); setGroupName(""); setGroupDescription(""); }}
                    className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Create Group
                  </button>
                  <button
                    onClick={() => { setShowNewChannelModal(true); setEmployeeSearch(""); setChannelMembers([]); setChannelName(""); setChannelDescription(""); }}
                    className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition-colors"
                  >
                    <span className="text-base font-bold leading-none">#</span>
                    Channel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel: Members (groups/channels only) ── */}
        {activeConvo && activeConvo.type !== "direct" && showMembersPanel && (
          <div className="w-[260px] border-l border-[#E2E8F0] bg-white flex flex-col h-full shrink-0">
            <div className="h-14 flex items-center justify-between px-4 border-b border-[#E2E8F0] shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-[#0F172A]">Members</h3>
                <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">
                  {activeConvo.participants.length}
                </span>
              </div>
              <button
                onClick={() => setShowMembersPanel(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {activeConvo.participants.map((p) => {
                const emp = employeeMap[p.userId];
                const name = emp ? `${emp.firstName} ${emp.lastName}` : p.userId.slice(-6);
                const initials = emp ? getInitials(emp.firstName, emp.lastName) : "??";
                const isOnline = onlineUserIds.has(p.userId);
                const roleBadge = p.role === "owner"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : p.role === "admin"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-gray-50 text-gray-600 border-gray-200";

                return (
                  <div key={p.userId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#F1F5F9]">
                    <div className="relative shrink-0 group/member">
                      <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold">
                        {initials}
                      </div>
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22C55E] border-2 border-white rounded-full" />
                      )}
                      {/* Hover popup */}
                      <div className="absolute top-full left-0 mt-2 hidden group-hover/member:block z-50">
                        <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                          <p className="text-[12px] font-semibold">{name}</p>
                          {emp?.email && <p className="text-[10px] text-[#94A3B8]">{emp.email}</p>}
                          {emp?.location && <p className="text-[10px] text-[#94A3B8]">{emp.location}</p>}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-medium capitalize">{p.role}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"}`} />
                            <span className="text-[10px] text-[#94A3B8]">{isOnline ? "Online" : "Offline"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#0F172A] truncate">{name}</p>
                      {emp?.email && <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>}
                    </div>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border capitalize ${roleBadge}`}>
                      {p.role}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => toast.info("Add member coming soon")}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
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
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Read Receipts */}
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Read Receipts</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[12px] text-[#334155]">Show when I&apos;ve read messages</span>
                    <button
                      onClick={() => updateChatSettings({ readReceipts: { showMyReadStatus: !chatSettings.readReceipts.showMyReadStatus } } as Partial<ChatSettings>)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.readReceipts.showMyReadStatus ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.readReceipts.showMyReadStatus ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[12px] text-[#334155]">Show read receipts from others</span>
                    <button
                      onClick={() => updateChatSettings({ readReceipts: { showOthersReadStatus: !chatSettings.readReceipts.showOthersReadStatus } } as Partial<ChatSettings>)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.readReceipts.showOthersReadStatus ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.readReceipts.showOthersReadStatus ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </label>
                </div>
              </div>

              {/* Appearance */}
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Appearance</h4>

                {/* Chat Background */}
                <div className="mb-3">
                  <p className="text-[11px] text-[#94A3B8] mb-1.5">Chat Background</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { color: "#F8FAFC", label: "Light" },
                      { color: "#1E293B", label: "Dark" },
                      { color: "#FEF3C7", label: "Warm" },
                      { color: "#ECFDF5", label: "Green" },
                      { color: "#EFF6FF", label: "Blue" },
                      { color: "#FDF2F8", label: "Pink" },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => updateChatSettings({ appearance: { chatBgColor: preset.color } } as Partial<ChatSettings>)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${chatSettings.appearance.chatBgColor === preset.color ? "border-[#2E86C1] scale-110" : "border-[#E2E8F0] hover:border-[#94A3B8]"}`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>

                {/* My Bubble Color */}
                <div className="mb-3">
                  <p className="text-[11px] text-[#94A3B8] mb-1.5">My Bubble Color</p>
                  <div className="flex flex-wrap gap-2">
                    {["#2E86C1", "#7C3AED", "#0D9488", "#D97706", "#DC2626", "#059669", "#4F46E5", "#DB2777"].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateChatSettings({ appearance: { myBubbleColor: color } } as Partial<ChatSettings>)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${chatSettings.appearance.myBubbleColor === color ? "border-[#0F172A] scale-110" : "border-transparent hover:border-[#94A3B8]"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <p className="text-[11px] text-[#94A3B8] mb-1.5">Font Size</p>
                  <div className="flex gap-1.5">
                    {(["small", "medium", "large"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => updateChatSettings({ appearance: { fontSize: size } } as Partial<ChatSettings>)}
                        className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-colors capitalize ${
                          chatSettings.appearance.fontSize === size
                            ? "bg-[#EBF5FF] text-[#2E86C1] border-[#2E86C1]"
                            : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Notifications</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[12px] text-[#334155]">Sound</span>
                    <button
                      onClick={() => updateChatSettings({ notifications: { sound: !chatSettings.notifications.sound } } as Partial<ChatSettings>)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.sound ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.sound ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[12px] text-[#334155]">Desktop notifications</span>
                    <button
                      onClick={() => updateChatSettings({ notifications: { desktop: !chatSettings.notifications.desktop } } as Partial<ChatSettings>)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.desktop ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.desktop ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[12px] text-[#334155]">Mute all</span>
                    <button
                      onClick={() => updateChatSettings({ notifications: { muteAll: !chatSettings.notifications.muteAll } } as Partial<ChatSettings>)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${chatSettings.notifications.muteAll ? "bg-[#EF4444]" : "bg-[#CBD5E1]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${chatSettings.notifications.muteAll ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </label>
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
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
              <h2 className="text-sm font-bold text-[#0F172A]">Start a conversation</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-3 border-b border-[#E2E8F0] shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  autoFocus
                  className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredEmployees.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[#94A3B8]">No employees found</p>
                </div>
              ) : (
                <>
                  {filteredEmployees.map((emp) => (
                    <button
                      key={emp._id}
                      onClick={() => handleStartDirect(emp)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-[11px] text-[#94A3B8] truncate">{emp.email}</p>
                      </div>
                    </button>
                  ))}
                  {truncatedEmployeeCount > 0 && (
                    <p className="text-center text-[12px] text-[#94A3B8] py-2">and {truncatedEmployeeCount} more &mdash; refine your search</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New Group Modal ── */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
              <h2 className="text-sm font-bold text-[#0F172A]">Create Group</h2>
              <button
                onClick={() => setShowNewGroupModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Group name */}
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Design Team"
                  className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What is this group about?"
                  className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
                />
              </div>

              {/* Selected members */}
              {selectedMembers.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1.5">
                    Selected ({selectedMembers.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMembers.map((m) => (
                      <span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EBF5FF] text-[#2E86C1] rounded-full text-[11px] font-medium">
                        {m.firstName} {m.lastName}
                        <button
                          onClick={() => setSelectedMembers((prev) => prev.filter((p) => p._id !== m._id))}
                          className="hover:text-red-500 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & add members */}
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Add Members</label>
                <div className="relative mb-2">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto border border-[#E2E8F0] rounded-lg">
                  {filteredEmployees
                    .filter((e) => !selectedMembers.some((s) => s._id === e._id))
                    .map((emp) => (
                      <button
                        key={emp._id}
                        onClick={() => setSelectedMembers((prev) => [...prev, emp])}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F1F5F9] transition-colors text-left border-b border-[#F1F5F9] last:border-b-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    ))}
                  {filteredEmployees.filter((e) => !selectedMembers.some((s) => s._id === e._id)).length === 0 && (
                    <div className="py-4 text-center">
                      <p className="text-[12px] text-[#94A3B8]">No more employees to add</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0">
              <button
                onClick={() => setShowNewGroupModal(false)}
                className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={savingGroup || !groupName.trim() || selectedMembers.length === 0}
                className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingGroup ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Channel Modal ── */}
      {showNewChannelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
              <h2 className="text-sm font-bold text-[#0F172A]">Create Channel</h2>
              <button
                onClick={() => setShowNewChannelModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#7C3AED]">#</span>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. announcements"
                    className="w-full h-9 pl-7 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  placeholder="What is this channel about?"
                  className="w-full h-9 px-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]"
                />
              </div>
              {channelMembers.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-[#334155] mb-1.5">Members ({channelMembers.length})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {channelMembers.map((m) => (
                      <span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F3E8FF] text-[#7C3AED] rounded-full text-[11px] font-medium">
                        {m.firstName} {m.lastName}
                        <button onClick={() => setChannelMembers((prev) => prev.filter((p) => p._id !== m._id))} className="hover:text-red-500 transition-colors">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-[#334155] mb-1">Add Members (optional)</label>
                <div className="relative mb-2">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#334155] placeholder:text-[#94A3B8]"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto border border-[#E2E8F0] rounded-lg">
                  {filteredEmployees.filter((e) => !channelMembers.some((s) => s._id === e._id)).map((emp) => (
                    <button key={emp._id} onClick={() => setChannelMembers((prev) => [...prev, emp])} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F1F5F9] transition-colors text-left border-b border-[#F1F5F9] last:border-b-0">
                      <div className="w-7 h-7 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>
                      </div>
                      <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                  ))}
                  {filteredEmployees.filter((e) => !channelMembers.some((s) => s._id === e._id)).length === 0 && (
                    <div className="py-4 text-center"><p className="text-[12px] text-[#94A3B8]">No more employees to add</p></div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0">
              <button onClick={() => setShowNewChannelModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button onClick={handleCreateChannel} disabled={savingChannel || !channelName.trim()} className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {savingChannel ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add People Modal (Convert Direct to Group) ── */}
      {showAddPeopleModal && activeConvo && activeConvo.type === "direct" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] shrink-0">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Add People</h2>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">This will convert the chat into a group</p>
              </div>
              <button onClick={() => setShowAddPeopleModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {addPeopleMembers.length > 0 && (
              <div className="px-5 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {addPeopleMembers.map((m) => (
                    <span key={m._id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#EBF5FF] text-[#2E86C1] rounded-full text-[11px] font-medium">
                      {m.firstName} {m.lastName}
                      <button onClick={() => setAddPeopleMembers((prev) => prev.filter((p) => p._id !== m._id))} className="hover:text-red-500 transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="px-5 py-3 shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search employees..." value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} autoFocus className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredEmployees
                .filter((e) => !activeConvo.participants.some((p) => p.userId === e.userId))
                .filter((e) => !addPeopleMembers.some((s) => s._id === e._id))
                .map((emp) => (
                  <button key={emp._id} onClick={() => setAddPeopleMembers((prev) => [...prev, emp])} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#F1F5F9] transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-semibold shrink-0">{getInitials(emp.firstName, emp.lastName)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>
                    </div>
                    <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  </button>
                ))}
              {filteredEmployees.filter((e) => !activeConvo.participants.some((p) => p.userId === e.userId)).filter((e) => !addPeopleMembers.some((s) => s._id === e._id)).length === 0 && (
                <div className="py-6 text-center"><p className="text-[12px] text-[#94A3B8]">No more employees to add</p></div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[#E2E8F0] shrink-0">
              <button onClick={() => setShowAddPeopleModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-medium text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button onClick={handleConvertToGroup} disabled={savingConvert || addPeopleMembers.length === 0} className="h-9 px-5 rounded-lg text-[13px] font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {savingConvert ? "Adding..." : `Add ${addPeopleMembers.length > 0 ? `(${addPeopleMembers.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming call modal is now handled globally by GlobalIncomingCall in layout */}

      {/* ── Pre-Call Preview Modal ── */}
      {showPreCallPreview && activeConvo && (
        <PreCallPreview
          recipientName={getEmployeeName(activeConvo.participants.find((p) => p.userId !== user?._id)?.userId || "")}
          callType="audio"
          onStartCall={handlePreCallConfirm}
          onCancel={() => setShowPreCallPreview(false)}
        />
      )}

      {/* ── Active Call Window (Overlay) ── */}
      {showCallWindow && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B1020]/80 via-[#0B1020]/70 to-[#101827]/80 backdrop-blur-sm" />
          <div ref={callWindowRef} className={`relative bg-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col border border-[#1F2A44] ${isFullscreen ? "w-full h-full" : "w-[92vw] max-w-5xl h-[88vh] rounded-3xl"}`}>
            {/* Call header with participant info */}
            <div className="h-16 bg-gradient-to-r from-[#0F172A] via-[#0B1220] to-[#0F172A] border-b border-[#1F2A44] flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold shadow-[0_0_0_3px_rgba(37,99,235,0.2)]">
                  {getInitials(
                    callConversation?.participants.find((p) => p.userId !== user?._id)?.userId
                      ? employeeMap[callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || ""]?.firstName || ""
                      : "",
                    callConversation?.participants.find((p) => p.userId !== user?._id)?.userId
                      ? employeeMap[callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || ""]?.lastName || ""
                      : ""
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white tracking-wide">{getEmployeeName(callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || "")}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {isVideoEnabled ? "Video" : "Audio"} Call {isRecording && <span className="text-red-400 ml-1">&#9679; REC</span>} {isScreenSharing && <span className="text-blue-400 ml-1">Sharing</span>} &#8226; {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, "0")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {getCallStatusLabel()}
                </span>
                {signaling.call?.status === "connected" && (
                  <span className="flex items-center gap-1.5 text-[10px] text-[#CBD5F5]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Encrypted
                  </span>
                )}
              </div>
              <button
                onClick={handleEndCall}
                className="w-10 h-10 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video/Audio + Chat row */}
            <div className="flex-1 flex min-h-0">
              {/* Video/Audio content */}
              <div className="flex-1 bg-gradient-to-br from-[#0B1220] via-[#0F172A] to-[#0B1220] relative">
                <audio ref={remoteAudioRef} autoPlay playsInline />
                {/* On Hold Overlay */}
                {isOnHold && signaling.call?.status === "connected" && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
                          <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
                        </svg>
                      </div>
                      <p className="text-white text-lg font-semibold">Call on Hold</p>
                      <p className="text-[#94A3B8] text-sm mt-1">Click Resume to continue</p>
                      <button
                        onClick={handleToggleHold}
                        className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                )}
                {callDisconnected ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </div>
                      <p className="text-white text-lg font-semibold">Call Disconnected</p>
                      <p className="text-[#94A3B8] text-sm mt-1">{callDuration > 0 ? `Duration: ${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, "0")}` : "Call ended"}</p>
                    </div>
                  </div>
                ) : webrtc.error ? (
                  <div className="flex items-center justify-center h-full px-8">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <p className="text-white text-base font-semibold mb-2">Call Failed</p>
                      <p className="text-[#94A3B8] text-sm leading-relaxed">{webrtc.error}</p>
                      <button onClick={handleEndCall} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">
                        Close
                      </button>
                    </div>
                  </div>
                ) : (signaling.call?.status === "initiated" || signaling.call?.status === "ringing") ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative mx-auto mb-6">
                        <div className="absolute inset-0 w-28 h-28 rounded-full bg-[#2563EB]/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-0 w-28 h-28 rounded-full bg-[#2563EB]/10 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
                        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center text-white text-3xl font-bold shadow-[0_0_60px_rgba(37,99,235,0.4)]">
                          {getInitials(
                            employeeMap[callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || ""]?.firstName || "",
                            employeeMap[callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || ""]?.lastName || ""
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-4">
                        <span className="text-white/80 text-sm font-medium">Calling</span>
                        <span className="flex gap-0.5 ml-0.5">
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "400ms" }} />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : isVideoEnabled || isScreenSharing || remoteHasVideo ? (
                  <VideoCallWindow
                    localStream={webrtc.localStream}
                    remoteStream={webrtc.remoteStream}
                    localUserName={user ? `${user.firstName} ${user.lastName}` : "You"}
                    remoteUserName={getEmployeeName(callConversation?.participants.find((p) => p.userId !== user?._id)?.userId || "")}
                    isAudioMuted={!isAudioEnabled}
                    screenShareStream={screenShareStream}
                    isScreenSharing={isScreenSharing}
                    isViewerAnnotating={isViewerAnnotating}
                    annotationColor={annotationColor}
                    annotationBrushSize={annotationBrushSize}
                    onAnnotationToggle={() => setIsViewerAnnotating(!isViewerAnnotating)}
                    onAnnotationColorChange={setAnnotationColor}
                    onAnnotationBrushSizeChange={setAnnotationBrushSize}
                    onAnnotationClear={handleAnnotationClear}
                    floatingEmojis={floatingEmojis}
                  />
                ) : (
                  /* Audio-only call view */
                  <div className="flex items-center justify-center h-full relative">
                    {(() => {
                      const remoteParticipants = (callConversation?.participants || []).filter((p) => p.userId !== user?._id);
                      const totalRemote = remoteParticipants.length;

                      // Grid layout for audio participants
                      const gridClass = totalRemote <= 1 ? "" : totalRemote === 2 ? "grid grid-cols-2 gap-6" : totalRemote <= 4 ? "grid grid-cols-2 gap-5" : "grid grid-cols-3 gap-4";
                      const avatarSize = totalRemote <= 1 ? "w-28 h-28" : totalRemote <= 3 ? "w-20 h-20" : "w-16 h-16";
                      const textSize = totalRemote <= 1 ? "text-4xl" : totalRemote <= 3 ? "text-2xl" : "text-xl";
                      const nameSize = totalRemote <= 1 ? "text-lg" : "text-sm";

                      if (totalRemote === 0) {
                        return (
                          <div className="text-center">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(37,99,235,0.35)]">
                              <span className="text-4xl font-bold text-white">?</span>
                            </div>
                            <p className="text-[#94A3B8] text-sm">Connecting...</p>
                          </div>
                        );
                      }

                      return (
                        <div className={totalRemote <= 1 ? "text-center" : gridClass}>
                          {remoteParticipants.map((p) => {
                            const emp = employeeMap[p.userId];
                            const firstName = emp?.firstName || "";
                            const lastName = emp?.lastName || "";
                            const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
                            const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
                            return (
                              <div key={p.userId} className="flex flex-col items-center">
                                <div className={`relative ${avatarSize} rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center mb-3 shadow-[0_0_40px_rgba(37,99,235,0.25)]`}>
                                  <span className="absolute inset-0 rounded-full border border-white/10 animate-pulse" />
                                  <span className={`${textSize} font-bold text-white relative z-10`}>{initials}</span>
                                </div>
                                <p className={`text-white font-semibold ${nameSize}`}>{name}</p>
                                <p className="text-[#94A3B8] text-xs mt-0.5">{Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, "0")}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Floating emojis overlay for audio calls too */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                      {floatingEmojis.map((e) => (
                        <div
                          key={e.id}
                          className="absolute text-4xl"
                          style={{
                            left: `${e.x}%`,
                            bottom: "10%",
                            animation: "float-up 3s ease-out forwards",
                          }}
                        >
                          {e.emoji}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* In-call chat panel — only shows messages from current call session */}
              {showCallChat && callConversation && (
                <div className="w-80 bg-[#111827] border-l border-[#1F2A44] flex flex-col">
                  <div className="h-12 px-4 flex items-center justify-between border-b border-[#1F2A44] shrink-0">
                    <span className="text-sm font-semibold text-white">Call Chat</span>
                    <button onClick={() => setShowCallChat(false)} className="p-1 rounded hover:bg-white/10 text-[#94A3B8]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                    {(() => {
                      // Only show messages sent during this call session
                      const callMessages = callStartTime
                        ? messages.filter((msg) => new Date(msg.createdAt) >= new Date(callStartTime))
                        : [];
                      if (callMessages.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-[#64748B] text-xs text-center">No messages during this call yet</p>
                          </div>
                        );
                      }
                      return callMessages.map((msg) => {
                        const isMe = msg.senderId === user?._id;
                        return (
                          <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${isMe ? "bg-[#2563EB] text-white" : "bg-[#1E293B] text-[#E2E8F0]"}`}>
                              {!isMe && <p className="text-[10px] text-[#60A5FA] font-medium mb-0.5">{getEmployeeName(msg.senderId)}</p>}
                              {msg.type === "file" && msg.fileUrl ? (
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="underline break-all">{msg.fileName || msg.content}</a>
                              ) : (
                                <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                              )}
                              <p className={`text-[9px] mt-0.5 ${isMe ? "text-blue-200" : "text-[#64748B]"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="p-2 border-t border-[#1F2A44] shrink-0">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!callChatMsg.trim() || !callConversation) return;
                      emit("message:send", { conversationId: callConversation._id, content: callChatMsg.trim(), type: "text" });
                      setCallChatMsg("");
                    }} className="flex gap-1.5">
                      <input
                        value={callChatMsg}
                        onChange={(e) => setCallChatMsg(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 h-8 px-3 bg-[#1E293B] border border-[#334155] rounded-lg text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#2563EB]"
                      />
                      <button type="submit" disabled={!callChatMsg.trim()} className="h-8 w-8 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 flex items-center justify-center text-white shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Controls bar */}
            <div className="h-20 bg-[#0B1220] border-t border-[#1F2A44] flex items-center justify-center gap-3 px-5">
              <CallControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                isRecording={isRecording}
                isScreenSharing={isScreenSharing}
                isFullscreen={isFullscreen}
                onToggleAudio={(enabled) => {
                  setIsAudioEnabled(enabled);
                  webrtc.toggleAudio(enabled);
                }}
                onToggleVideo={(enabled) => {
                  setIsVideoEnabled(enabled);
                  webrtc.toggleVideo(enabled);
                }}
                onToggleRecording={handleToggleRecording}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleFullscreen={handleToggleFullscreen}
                onAddParticipant={() => setShowAddParticipantModal(true)}
                onEndCall={handleEndCall}
                isOnHold={isOnHold}
                onToggleHold={handleToggleHold}
              />

              {/* Emoji reactions — opens from a React button */}
              <div className="relative group/emoji">
                <button
                  className="w-12 h-12 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors text-lg"
                  title="React"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                  </svg>
                </button>
                {/* Emoji popup - appears on hover */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/emoji:flex items-center gap-1 bg-[#1E293B] rounded-full px-3 py-2 shadow-xl border border-[#334155]">
                  {["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83C\uDF89", "\uD83D\uDC4F", "\uD83D\uDD25", "\uD83D\uDE22"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiReaction(emoji)}
                      className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-xl transition-all hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat toggle */}
              <button
                onClick={() => setShowCallChat(!showCallChat)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${showCallChat ? "bg-[#2563EB] text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
                title="Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Add Participant Modal (in-call) ── */}
          {showAddParticipantModal && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddParticipantModal(false)} />
              <div className="relative bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col border border-[#334155]">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#334155] shrink-0">
                  <h2 className="text-sm font-bold text-white">Add to Call</h2>
                  <button
                    onClick={() => setShowAddParticipantModal(false)}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-4 py-3 border-b border-[#334155] shrink-0">
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    autoFocus
                    className="w-full h-9 px-3 text-[13px] bg-[#0F172A] border border-[#334155] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] text-white placeholder:text-[#64748B]"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredEmployees
                    .filter((e) => !callConversation?.participants.some((p) => p.userId === e.userId))
                    .map((emp) => (
                      <button
                        key={emp._id}
                        onClick={() => {
                          signaling.inviteToCall(emp.userId);
                          toast.success(`${emp.firstName} invited to call`);
                          setShowAddParticipantModal(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{emp.email}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Thread panel (slides in from the right) */}
      {threadMessage && user && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <ThreadPanel
            rootMessage={threadMessage}
            employeeMap={employeeMap}
            currentUserId={user._id}
            onClose={() => setThreadMessage(null)}
            onReply={() => {
              // Refresh messages to update thread reply counts
              if (activeId) fetchMessages(activeId);
            }}
          />
        </div>
      )}

      {/* Status setter modal */}
      {showStatusSetter && (
        <StatusSetter
          currentStatus={presenceMap.get(user?._id || "")?.status || "online"}
          onClose={() => setShowStatusSetter(false)}
          onStatusChange={() => setShowStatusSetter(false)}
        />
      )}

      {/* Global search modal (Cmd+K) */}
      {showGlobalSearch && (
        <GlobalSearch
          onClose={() => setShowGlobalSearch(false)}
          onNavigate={(conversationId) => {
            setActiveId(conversationId);
            setShowGlobalSearch(false);
          }}
        />
      )}

      {/* File browser panel */}
      {showFileBrowser && activeId && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <FileBrowser conversationId={activeId} onClose={() => setShowFileBrowser(false)} />
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinnedMessages && activeId && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <PinnedMessages
            conversationId={activeId}
            onClose={() => setShowPinnedMessages(false)}
            onUnpin={() => { if (activeId) fetchMessages(activeId); }}
          />
        </div>
      )}

      {/* Bookmarks panel */}
      {showBookmarks && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <BookmarksList
            onClose={() => setShowBookmarks(false)}
            onNavigate={(conversationId) => {
              setActiveId(conversationId);
              setShowBookmarks(false);
            }}
          />
        </div>
      )}

      {/* AI Summary panel */}
      {showAiSummary && activeId && (
        <div className="fixed top-0 right-0 h-full z-40 shadow-2xl">
          <AiSummaryPanel conversationId={activeId} onClose={() => setShowAiSummary(false)} />
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardMessageId && (
        <ForwardModal
          messageId={forwardMessageId}
          onClose={() => setForwardMessageId(null)}
          employeeMap={employeeMap}
        />
      )}

      {/* Call Quality Feedback */}
      {showCallFeedback && feedbackCallId && (
        <CallFeedback
          callId={feedbackCallId}
          duration={feedbackCallDuration}
          onClose={() => { setShowCallFeedback(false); setFeedbackCallId(null); }}
        />
      )}

      {/* Float-up keyframe for emoji animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-200px) scale(1.3); opacity: 0.8; }
          100% { transform: translateY(-400px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
