"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { authApi, aiApi } from "@/lib/api";
import type { User } from "@/lib/api";
import { toast } from "sonner";

// ── Types ──

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// ── Constants ──

const STORAGE_KEY = "nexora-chat-conversations";

const SYSTEM_MESSAGE = `You are Nexora AI, a smart assistant for IT project management.

CRITICAL RULES:
1. NEVER give a complete answer on the first response. ALWAYS ask 2-3 clarifying questions first.
2. When user says "help me plan a project" — ask: What type of project? Who is the client? What's the timeline? What's the team size?
3. When user says "write a task description" — ask: What's the task about? What feature/module? What's the acceptance criteria?
4. Only after getting answers, provide a detailed response.
5. Keep responses concise. Use bullet points.
6. Don't use markdown headers (###). Use bold text (**text**) for emphasis instead.
7. Don't use [brackets] for links. Just write the text naturally.
8. Format lists with simple dashes (-) not asterisks.
9. Be warm and conversational, use the user's name if known.

You're part of Nexora platform which has: Projects, Tasks, Boards, Attendance, Leaves, Timesheets, HR, Chat, Policies.`;

const SUGGESTED_PROMPTS = [
  "Help me plan a project",
  "Write a task description",
  "Summarize my tasks",
];

const LOADING_PHASES = [
  "Thinking...",
  "Analyzing...",
  "Processing...",
  "Crafting response...",
  "Almost there...",
];

// ── Helpers ──

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generateTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40).trim() + "...";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

// ── Markdown formatter ──

function formatAIContent(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, i) => {
    // Bold: **text**
    let formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Inline code: `code`
    formatted = formatted.replace(
      /`(.*?)`/g,
      '<code class="bg-[#E2E8F0] px-1 py-0.5 rounded text-[12px] font-mono">$1</code>'
    );

    // ## Header
    if (line.startsWith("## ")) {
      return (
        <p
          key={i}
          className="font-bold text-[15px] mt-3 mb-1"
          dangerouslySetInnerHTML={{ __html: formatted.slice(3) }}
        />
      );
    }

    // ### Header
    if (line.startsWith("### ")) {
      return (
        <p
          key={i}
          className="font-semibold text-[14px] mt-2 mb-1"
          dangerouslySetInnerHTML={{ __html: formatted.slice(4) }}
        />
      );
    }

    // Bullet points: - item or * item
    if (line.match(/^[\s]*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      return (
        <div
          key={i}
          className="flex gap-2"
          style={{ marginLeft: indent * 4 }}
        >
          <span className="text-[#2E86C1] mt-0.5 shrink-0">-</span>
          <span
            dangerouslySetInnerHTML={{
              __html: formatted.replace(/^[\s]*[-*]\s/, ""),
            }}
          />
        </div>
      );
    }

    // Numbered list: 1. item
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)?.[1];
      return (
        <div key={i} className="flex gap-2">
          <span className="text-[#2E86C1] font-medium shrink-0">{num}.</span>
          <span
            dangerouslySetInnerHTML={{
              __html: formatted.replace(/^\d+\.\s/, ""),
            }}
          />
        </div>
      );
    }

    // Empty line
    if (!line.trim()) return <div key={i} className="h-2" />;

    // Regular text
    return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
  });
}

// ── Page ──

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // ── Auth ──

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }
    authApi
      .me()
      .then((res) => {
        if (res.data) setUser(res.data);
        else router.push("/login");
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── Load conversations ──

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  // ── Save conversations ──

  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // ── Auto-scroll ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages?.length, isResponding]);

  // ── Auto-resize textarea ──

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // ── Cleanup loading interval ──

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, []);

  // ── Handlers ──

  const startLoadingPhases = useCallback(() => {
    let idx = 0;
    setLoadingPhase(LOADING_PHASES[0]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_PHASES.length;
      setLoadingPhase(LOADING_PHASES[idx]);
    }, 2500);
  }, []);

  const stopLoadingPhases = useCallback(() => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
    setLoadingPhase("");
  }, []);

  const handleNewChat = useCallback(() => {
    const convo: Conversation = {
      id: generateId(),
      title: "New Conversation",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setInput("");
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        saveConversations(next);
        return next;
      });
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isResponding) return;

      let convoId = activeId;
      let isNew = false;

      // Create new conversation if none active
      if (!convoId) {
        const convo: Conversation = {
          id: generateId(),
          title: generateTitle(content),
          messages: [],
          createdAt: new Date().toISOString(),
        };
        convoId = convo.id;
        isNew = true;
        setConversations((prev) => [convo, ...prev]);
        setActiveId(convo.id);
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      // Update title if first message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convoId) return c;
          const updated = { ...c, messages: [...c.messages, userMsg] };
          if (c.messages.length === 0 || isNew) {
            updated.title = generateTitle(content);
          }
          return updated;
        })
      );

      setInput("");
      setIsResponding(true);
      startLoadingPhases();

      try {
        // Build message history for AI
        const currentConvo = isNew
          ? { messages: [] as Message[] }
          : conversations.find((c) => c.id === convoId);
        const history = [
          { role: "system", content: SYSTEM_MESSAGE },
          ...(currentConvo?.messages || []).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: content.trim() },
        ];

        // Create a placeholder assistant message for streaming
        const aiMsgId = generateId();
        const aiMsg: Message = {
          id: aiMsgId,
          role: "assistant",
          content: "",
          thinking: "",
          timestamp: new Date().toISOString(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convoId ? { ...c, messages: [...c.messages, aiMsg] } : c
          )
        );

        // Stream response via SSE
        const token = localStorage.getItem("accessToken");
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
        const response = await fetch(apiBase + "/api/v1/ai/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify({ messages: history, temperature: 0.7, maxTokens: 2048 }),
        });

        if (!response.ok) throw new Error("AI service unavailable");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let thinkingText = "";
        let contentText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "thinking") {
                  thinkingText += parsed.text;
                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id !== convoId) return c;
                      return {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === aiMsgId ? { ...m, thinking: thinkingText } : m
                        ),
                      };
                    })
                  );
                } else if (parsed.type === "content" || parsed.text) {
                  const text = parsed.text || "";
                  contentText += text;
                  // Stop loading phases once content starts arriving
                  if (contentText.length === text.length) {
                    stopLoadingPhases();
                  }
                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id !== convoId) return c;
                      return {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === aiMsgId ? { ...m, content: contentText } : m
                        ),
                      };
                    })
                  );
                }

                if (parsed.error) throw new Error(parsed.error);
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // If streaming returned nothing, fall back to non-streaming
        if (!contentText) {
          const res = await aiApi.chat(history);
          const fallbackText = res.data?.text || "I couldn't generate a response. Please try again.";
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convoId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsgId ? { ...m, content: fallbackText } : m
                ),
              };
            })
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to get response from AI";
        toast.error(message);
        // Remove the empty assistant message on error
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convoId) return c;
            return { ...c, messages: c.messages.filter((m) => m.content !== "") };
          })
        );
      } finally {
        setIsResponding(false);
        stopLoadingPhases();
        textareaRef.current?.focus();
      }
    },
    [activeId, conversations, isResponding, startLoadingPhases, stopLoadingPhases]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  };

  // ── Loading ──

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2E86C1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="ml-[260px] h-screen flex">
        {/* ── Left Panel: Conversation List ── */}
        <div className="w-[300px] border-r border-[#E2E8F0] bg-white flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E2E8F0] shrink-0">
            <h2 className="text-sm font-semibold text-[#0F172A]">Messages</h2>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-[#94A3B8]">No conversations yet</p>
              </div>
            ) : (
              conversations.map((convo) => {
                const isActive = convo.id === activeId;
                const lastMsg = convo.messages[convo.messages.length - 1];
                return (
                  <button
                    key={convo.id}
                    onClick={() => setActiveId(convo.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#F1F5F9] transition-colors group ${
                      isActive ? "bg-[#EBF5FF]" : "hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-[13px] font-medium truncate flex-1 ${
                          isActive ? "text-[#2E86C1]" : "text-[#0F172A]"
                        }`}
                      >
                        {convo.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-[#94A3B8]">
                          {formatDate(convo.createdAt)}
                        </span>
                        <button
                          onClick={(e) => handleDeleteConversation(convo.id, e)}
                          className="p-0.5 rounded text-[#94A3B8] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {lastMsg && (
                      <p className="text-[12px] text-[#94A3B8] truncate mt-0.5">
                        {lastMsg.role === "user" ? "You: " : "AI: "}
                        {lastMsg.content}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Active Chat ── */}
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC]">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-16 flex items-center px-6 border-b border-[#E2E8F0] bg-white shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">{activeConversation.title}</p>
                  <p className="text-[11px] text-[#94A3B8]">Nexora AI Assistant</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {activeConversation.messages.length === 0 && !isResponding && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-[#EBF5FF] flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="text-[13px] text-[#94A3B8]">Send a message to start the conversation</p>
                    </div>
                  </div>
                )}

                {activeConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center mr-2.5 mt-1 shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                        </svg>
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      {/* Thinking phase display */}
                      {msg.role === "assistant" && msg.thinking && (
                        <details className="mb-2">
                          <summary className="text-[11px] text-[#94A3B8] cursor-pointer hover:text-[#64748B] flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Thought for {Math.ceil(msg.thinking.length / 50)}s
                          </summary>
                          <div className="mt-1.5 text-[11px] text-[#94A3B8] bg-[#F8FAFC] rounded-lg p-2.5 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                            {msg.thinking}
                          </div>
                        </details>
                      )}

                      <div
                        className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#2E86C1] text-white rounded-2xl rounded-br-sm whitespace-pre-wrap"
                            : "bg-[#F1F5F9] text-[#334155] rounded-2xl rounded-bl-sm"
                        }`}
                      >
                        {msg.role === "assistant"
                          ? formatAIContent(msg.content)
                          : msg.content}
                      </div>
                      <p
                        className={`text-[10px] text-[#94A3B8] mt-1 ${
                          msg.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Typing indicator with loading phases */}
                {isResponding && (
                  <div className="flex items-end gap-2.5 max-w-[70%]">
                    <div className="w-7 h-7 rounded-full bg-[#2E86C1] flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                    <div className="bg-[#F1F5F9] text-[#334155] rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-[#2E86C1] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#2E86C1] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#2E86C1] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-[12px] text-[#94A3B8] italic">{loadingPhase || "Thinking..."}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-6 pb-4 pt-2 bg-[#F8FAFC] shrink-0">
                <div className="flex items-end gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={isResponding}
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus:outline-none disabled:opacity-50 py-1.5 max-h-[120px]"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isResponding}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── Empty State ── */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-[#EBF5FF] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#0F172A] mb-1">Nexora AI Assistant</h2>
                <p className="text-[13px] text-[#64748B] mb-6">
                  Ask me anything about projects, tasks, HR, or get help with your work
                </p>

                <div className="flex flex-col gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        handleNewChat();
                        // Use setTimeout to ensure state updates before sending
                        setTimeout(() => sendMessage(prompt), 50);
                      }}
                      className="w-full px-4 py-2.5 text-[13px] text-[#334155] bg-white border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] hover:border-[#CBD5E1] transition-colors text-left"
                    >
                      <span className="text-[#2E86C1] mr-2">&#8594;</span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
