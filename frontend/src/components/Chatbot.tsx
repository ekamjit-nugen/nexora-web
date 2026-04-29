"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownText } from "./MarkdownText";

/**
 * Floating Nexora AI assistant ("Nexie").
 *
 * Renders as a circular button bottom-right. Click → slide-up panel
 * with a chat thread. Streams replies via the monolith's
 * `POST /api/v1/chatbot/stream` SSE endpoint for a typewriter effect.
 *
 * Tenant isolation: the JWT in localStorage carries organizationId.
 * The backend enforces tenant scope on every query — we don't have to
 * do anything client-side except send authenticated requests.
 *
 * Replies are rendered as Markdown via <MarkdownText/>, so headings,
 * bold, lists, code blocks, and blockquotes all look right.
 */

type Msg = { role: "user" | "assistant"; content: string };

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3015";

const SUGGESTED_PROMPTS = [
  "How do I generate a payslip?",
  "What's the PF wage ceiling?",
  "Show me my team's attendance for today",
  "How is LOP calculated?",
  "Walk me through running monthly payroll",
];

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [authed, setAuthed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Show widget only once the user is logged in. Polls localStorage
  // every 5s to catch login without a full page refresh.
  useEffect(() => {
    const check = () => setAuthed(Boolean(getAccessToken()));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;

    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setBusy(true);

    try {
      const token = getAccessToken();
      if (!token) {
        appendToLast("_Please log in to chat with the assistant._");
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/chatbot/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text();
        appendToLast(
          `_The assistant couldn't reply right now (${res.status}). ${errBody.slice(0, 200)}_`,
        );
        return;
      }

      // Parse the SSE stream of `data: {"chunk":"..."}\n\n` events.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const line = evt.trim().replace(/^data:\s*/, "");
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.conversationId && !conversationId) {
              setConversationId(obj.conversationId);
            }
            if (obj.chunk) appendToLast(obj.chunk);
            if (obj.error) appendToLast(`\n_Error: ${obj.error}_`);
            if (obj.done) return;
          } catch {
            // ignore malformed line
          }
        }
      }
    } catch (err: any) {
      appendToLast(`\n_Network error: ${err?.message ?? "unknown"}_`);
    } finally {
      setBusy(false);
    }
  }

  function appendToLast(piece: string) {
    setMessages((m) => {
      if (m.length === 0) return m;
      const last = m[m.length - 1];
      if (last.role !== "assistant") return m;
      return [...m.slice(0, -1), { ...last, content: last.content + piece }];
    });
  }

  function reset() {
    setMessages([]);
    setConversationId(undefined);
  }

  if (!authed) return null;

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Floating button — gradient orb with subtle pulse when closed. */}
      <button
        type="button"
        aria-label={open ? "Close Nexie" : "Open Nexie"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 sm:bottom-6 sm:right-6"
        style={{
          background: open
            ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
            : "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
          boxShadow: "0 12px 32px rgba(99, 102, 241, 0.45)",
        }}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="h-6 w-6"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // A friendly little "spark" icon — feels more "AI assistant"
          // than a chat bubble.
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
            <path d="M12 2l1.94 5.26L19 9l-5.06 1.74L12 16l-1.94-5.26L5 9l5.06-1.74L12 2zm6 12l1.06 2.88L22 18l-2.94 1.12L18 22l-1.06-2.88L14 18l2.94-1.12L18 14zM6 14l1.06 2.88L10 18l-2.94 1.12L6 22l-1.06-2.88L2 18l2.94-1.12L6 14z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-3 z-50 flex h-[75vh] max-h-[680px] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6 sm:w-[400px]">
          {/* Header — gradient with avatar and subtitle */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3.5 text-white">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2l1.94 5.26L19 9l-5.06 1.74L12 16l-1.94-5.26L5 9l5.06-1.74L12 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold leading-tight">Nexie</div>
              <div className="text-[11px] opacity-80">
                Your Nexora assistant · Online
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              title="New chat"
              className="rounded-md px-2 py-1 text-[11px] font-medium hover:bg-white/15"
            >
              New
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-4 py-4"
          >
            {!hasMessages && (
              <div className="space-y-3">
                {/* Welcome card */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
                  <div className="text-[13px] font-semibold text-indigo-900">
                    Hi there 👋 I'm Nexie.
                  </div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-indigo-800/80">
                    Ask me anything about HR, payroll, leave, attendance, or
                    how to use Nexora. I know your team's setup and current
                    payroll cycle, so I can answer with your real numbers.
                  </div>
                </div>

                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Try one of these
                </div>
                {SUGGESTED_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLast = i === messages.length - 1;
              const isStreamingAssistant = !isUser && busy && isLast;
              return (
                <div
                  key={i}
                  className={
                    isUser
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3 py-2 text-[13px] leading-snug text-white shadow-sm"
                      : "max-w-[90%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-slate-200"
                  }
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  ) : m.content ? (
                    <MarkdownText source={m.content} compact />
                  ) : (
                    // Empty assistant message + busy = typing dots.
                    isStreamingAssistant && (
                      <div className="flex items-center gap-1 py-1.5">
                        <span className="block h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:0ms]" />
                        <span className="block h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="block h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexie anything…"
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
