"use client";

import { Fragment, ReactNode } from "react";
import Link from "next/link";

/**
 * Tiny zero-dep Markdown renderer for chatbot replies.
 *
 * Handles:
 *   #, ##, ### headings
 *   **bold**, *italic*
 *   `inline code`
 *   ```code blocks```
 *   - and * unordered lists
 *   1. ordered lists
 *   > blockquotes
 *   [link text](url)
 *   --- horizontal rules
 *   line breaks (single newlines become <br/>, blank lines split paragraphs)
 *
 * Skipped on purpose: tables, footnotes, images, HTML embedding.
 * If we ever need them, swap to react-markdown — but for chatbot
 * replies the above covers ~99% of formatting the LLM emits.
 *
 * Tailwind-styled to match the chat panel's typography.
 */

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "paragraph"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({
        kind: "heading",
        level: h[1].length as 1 | 2 | 3,
        text: h[2],
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    // Blockquote (consume consecutive `>` lines)
    if (line.startsWith("> ")) {
      const buf: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    // List (unordered or ordered) — consume contiguous list lines
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        ((ordered && /^\s*\d+\.\s+/.test(lines[i])) ||
          (!ordered && /^\s*[-*]\s+/.test(lines[i])))
      ) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — gather subsequent non-blank, non-special lines
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3} |```|>|[-*] |\d+\. |---+\s*$)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join(" ") });
  }

  return blocks;
}

/** Render inline Markdown (bold, italic, code, links) inside a paragraph. */
function renderInline(text: string, key: string): ReactNode {
  // Tokenise by code, then bold, then italic, then links. Order matters —
  // longer / more specific patterns win first.
  const out: ReactNode[] = [];
  let cursor = 0;
  // Combined regex: code | bold | italic | link
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text))) {
    if (m.index > cursor) {
      out.push(text.slice(cursor, m.index));
    }
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code
          key={`${key}-${idx++}`}
          className="rounded bg-slate-200/60 px-1 py-[1px] font-mono text-[12px] text-slate-800"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <strong key={`${key}-${idx++}`} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={`${key}-${idx++}`}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        // Internal app routes (start with `/` and not `//` for protocol-
        // relative) use Next.js client-side routing — no full page reload,
        // no new tab, no chat-panel teardown. The chat widget is mounted
        // globally in src/app/layout.tsx so it persists across navigations.
        const isInternal = href.startsWith("/") && !href.startsWith("//");
        if (isInternal) {
          out.push(
            <Link
              key={`${key}-${idx++}`}
              href={href}
              prefetch={false}
              className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-px font-medium text-indigo-700 transition hover:bg-indigo-100 hover:text-indigo-800"
            >
              {label}
              {/* tiny chevron so it's visually obvious this navigates */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>,
          );
        } else {
          out.push(
            <a
              key={`${key}-${idx++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline-offset-2 hover:underline"
            >
              {label}
            </a>,
          );
        }
      } else {
        out.push(tok);
      }
    }
    cursor = m.index + tok.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out.map((n, i) =>
    typeof n === "string" ? <Fragment key={`${key}-t-${i}`}>{n}</Fragment> : n,
  );
}

interface Props {
  source: string;
  /** Smaller variant for tight chat bubbles. */
  compact?: boolean;
}

export function MarkdownText({ source, compact }: Props) {
  const blocks = parseBlocks(source);

  return (
    <div
      className={
        compact
          ? "space-y-1.5 text-[13px] leading-snug"
          : "space-y-2 text-[14px] leading-relaxed"
      }
    >
      {blocks.map((b, idx) => {
        const k = `b-${idx}`;
        switch (b.kind) {
          case "heading": {
            const Tag = (`h${b.level + 2}` as unknown) as keyof JSX.IntrinsicElements; // h3..h5
            const cls =
              b.level === 1
                ? "text-[15px] font-semibold text-slate-900"
                : b.level === 2
                ? "text-[14px] font-semibold text-slate-900"
                : "text-[13.5px] font-semibold text-slate-800";
            return (
              <Tag key={k} className={`mt-1 ${cls}`}>
                {renderInline(b.text, k)}
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={k} className="text-slate-800">
                {renderInline(b.text, k)}
              </p>
            );
          case "list":
            return b.ordered ? (
              <ol key={k} className="ml-5 list-decimal space-y-1 marker:text-slate-400">
                {b.items.map((it, i) => (
                  <li key={`${k}-${i}`} className="text-slate-800">
                    {renderInline(it, `${k}-${i}`)}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={k} className="ml-5 list-disc space-y-1 marker:text-slate-400">
                {b.items.map((it, i) => (
                  <li key={`${k}-${i}`} className="text-slate-800">
                    {renderInline(it, `${k}-${i}`)}
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={k}
                className="rounded-r border-l-2 border-amber-400 bg-amber-50/60 px-3 py-1.5 text-[12.5px] text-amber-900"
              >
                {renderInline(b.text, k)}
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={k}
                className="overflow-x-auto rounded-md bg-slate-900 px-3 py-2 font-mono text-[12px] leading-snug text-slate-100"
              >
                <code>{b.text}</code>
              </pre>
            );
          case "rule":
            return <hr key={k} className="my-2 border-slate-200" />;
        }
      })}
    </div>
  );
}
