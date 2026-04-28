"use client";

import { useEffect, useRef, useState } from "react";

// Reads the JWT the same way the rest of the frontend does — straight
// from localStorage. The auth-context owns refresh; we just consume.
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

/**
 * Floating Nexora AI assistant.
 *
 * Renders as a circular button in the bottom-right corner. Click → panel
 * slides up with chat input + scrolling message list. Streams tokens
 * via the monolith's POST /api/v1/chatbot/stream SSE endpoint so the
 * reply appears character-by-character (typewriter feel).
 *
 * Tenant isolation: the JWT in `authApi` carries the user's
 * organizationId. The backend enforces tenant scope on every query —
 * we don't have to do anything client-side except send authenticated
 * requests.
 */

type Msg = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3015";

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

  // Only show the widget once a JWT is in localStorage. Poll every 5s
  // so the widget appears after login without a full page refresh.
  useEffect(() => {
    const check = () => setAuthed(Boolean(getAccessToken()));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
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
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text();
        appendToLast(
          `_Sorry, the assistant couldn't respond right now (${res.status}). ${errBody.slice(0, 200)}_`,
        );
        return;
      }

      // Parse SSE stream: lines like `data: {"chunk":"Hello"}\n\n`
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
      appendToLast(`\n_Sorry, network error: ${err?.message ?? "unknown"}_`);
    } finally {
      setBusy(false);
    }
  }

  function appendToLast(piece: string) {
    setMessages((m) => {
      if (m.length === 0) return m;
      const last = m[m.length - 1];
      if (last.role !== "assistant") return m;
      return [
        ...m.slice(0, -1),
        { ...last, content: last.content + piece },
      ];
    });
  }

  function reset() {
    setMessages([]);
    setConversationId(undefined);
  }

  if (!authed) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:scale-105 hover:bg-indigo-700 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        style={{ boxShadow: "0 8px 28px rgba(79, 70, 229, 0.35)" }}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-3 z-50 flex h-[70vh] max-h-[640px] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6 sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold leading-tight">Nexora Assistant</div>
              <div className="text-[11px] opacity-80">AI · Beta</div>
            </div>
            <button
              type="button"
              onClick={reset}
              title="New chat"
              className="rounded-md px-2 py-1 text-[12px] hover:bg-white/15"
            >
              New
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm">
                  Hi! I'm your Nexora assistant. I can answer questions about HR,
                  payroll, attendance, leave, projects, and how to use the
                  platform. Try one of these:
                </div>
                {[
                  "How do I generate a payslip?",
                  "What's the PF wage ceiling?",
                  "Steps to apply for leave",
                  "How is LOP calculated?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput(q);
                      setTimeout(send, 0);
                    }}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13px] leading-snug shadow-sm ${
                  m.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "bg-white text-slate-800"
                }`}
              >
                {m.content || (m.role === "assistant" && busy ? "…" : "")}
              </div>
            ))}
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
              placeholder="Ask anything…"
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
