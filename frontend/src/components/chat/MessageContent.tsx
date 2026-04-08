"use client";

import { useMemo } from "react";

// Dynamic import to avoid SSR crash — jsdom not available on server
let DOMPurify: { sanitize: (html: string) => string } | null = null;
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DOMPurify = require("isomorphic-dompurify").default || require("isomorphic-dompurify");
}

/**
 * Renders rich message content (HTML from TipTap or plain text).
 * Handles markdown-like formatting, @mentions highlighting, and code blocks.
 */
interface MessageContentProps {
  content: string;
  isHtml?: boolean;
  className?: string;
}

export function MessageContent({ content, isHtml, className = "" }: MessageContentProps) {
  if (!content) return null;

  // Detect if content is HTML (from TipTap editor)
  const looksLikeHtml = isHtml || content.startsWith("<") || /<[a-z][\s\S]*>/i.test(content);

  if (looksLikeHtml) {
    // Highlight @mentions in HTML content
    const highlighted = content.replace(
      /@([a-f0-9]{24}|here|all|channel)/gi,
      '<span class="bg-blue-100 text-blue-700 px-0.5 rounded font-medium">@$1</span>'
    );

    return (
      <div
        className={`prose prose-sm max-w-none break-words
          prose-p:my-0.5 prose-p:leading-relaxed
          prose-ul:my-1 prose-ol:my-1
          prose-li:my-0
          prose-pre:my-1 prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-md prose-pre:text-xs
          prose-code:bg-slate-100 prose-code:text-pink-600 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
          prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:my-1 prose-blockquote:py-1
          prose-a:text-blue-500
          ${className}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify ? DOMPurify.sanitize(highlighted) : highlighted }}
      />
    );
  }

  // Plain text: render @mentions and basic formatting
  const parts = content.split(/(@[a-f0-9]{24}|@here|@all|@channel)/gi);

  return (
    <div className={`text-sm break-words whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        if (/^@([a-f0-9]{24}|here|all|channel)$/i.test(part)) {
          return (
            <span key={i} className="bg-blue-100 text-blue-700 px-0.5 rounded font-medium">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
