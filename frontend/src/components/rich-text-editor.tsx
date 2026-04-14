"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useCallback, useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  editable?: boolean;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-all ${
        active
          ? "bg-[#2E86C1] text-white"
          : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  minHeight = "300px",
  editable = true,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "bg-[#1E293B] text-[#E2E8F0] rounded-lg p-4 font-mono text-sm my-3" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-[#2E86C1] pl-4 italic text-[#64748B] my-3" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-6 space-y-1 my-2" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-6 space-y-1 my-2" } },
        horizontalRule: { HTMLAttributes: { class: "border-[#E2E8F0] my-4" } },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: "rounded-lg max-w-full my-3 border border-[#E2E8F0]" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#2E86C1] underline cursor-pointer" } }),
      Underline,
      TaskList.configure({ HTMLAttributes: { class: "space-y-1 my-2" } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: "flex items-start gap-2" } }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none text-[#0F172A] leading-relaxed`,
        style: `min-height: ${minHeight}`,
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const files = Array.from(event.dataTransfer.files);
          files.forEach((file) => handleFileInsert(file));
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file) { handleFileInsert(file); return true; }
            }
          }
        }
        return false;
      },
    },
  });

  // Sync external content changes (e.g. async data load, template selection)
  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleFileInsert = useCallback((file: File) => {
    if (!editor) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          editor.chain().focus().setImage({ src: reader.result }).run();
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          editor.chain().focus().insertContent(
            `<div class="my-3"><video controls class="rounded-lg max-w-full border border-[#E2E8F0]" src="${reader.result}"></video><p class="text-xs text-[#94A3B8] mt-1">${file.name}</p></div>`
          ).run();
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Generic file — show as attachment card
      const size = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      editor.chain().focus().insertContent(
        `<div class="flex items-center gap-3 p-3 my-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] max-w-sm"><span class="text-sm font-medium text-[#334155]">${file.name}</span><span class="text-xs text-[#94A3B8]">${size}</span></div>`
      ).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={`rounded-xl border ${isDragging ? "border-[#2E86C1] bg-[#EBF5FB]" : "border-[#E2E8F0]"} bg-white overflow-hidden transition-colors`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={() => setIsDragging(false)}
    >
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[#E2E8F0] bg-[#FAFBFC] flex-wrap">
          {/* Text style */}
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m-2 0h4m6-16h-4" /></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 20h14" /></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 4H9a3 3 0 100 6h6a3 3 0 110 6H8M4 12h16" /></svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

          {/* Headings */}
          <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <span className="text-[11px] font-bold">H1</span>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <span className="text-[11px] font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <span className="text-[11px] font-bold">H3</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

          {/* Lists */}
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /><circle cx="2" cy="6" r="1" fill="currentColor" /><circle cx="2" cy="12" r="1" fill="currentColor" /><circle cx="2" cy="18" r="1" fill="currentColor" /></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 6h13M7 12h13M7 18h13" /><text x="1" y="8" fontSize="7" fill="currentColor" fontWeight="bold">1</text><text x="1" y="14" fontSize="7" fill="currentColor" fontWeight="bold">2</text><text x="1" y="20" fontSize="7" fill="currentColor" fontWeight="bold">3</text></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

          {/* Blocks */}
          <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" /></svg>
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 12h18" /></svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-[#E2E8F0] mx-1" />

          {/* Link & Media */}
          <ToolbarButton active={editor.isActive("link")} onClick={addLink} title="Add Link">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Upload Image/File">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </ToolbarButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileInsert(file);
              e.target.value = "";
            }}
          />

          <div className="flex-1" />

          {/* Undo/Redo */}
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m16-7l-4-4m4 4l-4 4" /></svg>
          </ToolbarButton>
        </div>
      )}

      {/* Editor content */}
      <div className="px-5 py-4">
        <EditorContent editor={editor} />
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="px-5 pb-4">
          <div className="border-2 border-dashed border-[#2E86C1] rounded-lg p-6 text-center bg-[#EBF5FB]/50">
            <svg className="w-8 h-8 text-[#2E86C1] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-[13px] font-medium text-[#2E86C1]">Drop files here</p>
            <p className="text-[11px] text-[#64748B]">Images, videos, documents</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comment Editor with @mentions ──

interface CommentEditorProps {
  onSubmit: (html: string) => void;
  employees: Array<{ _id: string; userId?: string; firstName: string; lastName: string; email: string }>;
  userInitials: string;
  submitting?: boolean;
}

export function CommentEditor({ onSubmit, employees, userInitials, submitting }: CommentEditorProps) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (value: string) => {
    setText(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ") || afterAt.split(" ").length <= 2) {
        if (afterAt.length < 30 && !afterAt.includes("\n")) {
          setShowMentions(true);
          setMentionFilter(afterAt.toLowerCase());
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const insertMention = (emp: { firstName: string; lastName: string }) => {
    const lastAt = text.lastIndexOf("@");
    const before = text.slice(0, lastAt);
    setText(`${before}@${emp.firstName} ${emp.lastName} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
  };

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(mentionFilter)
  ).slice(0, 6);

  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-1">
        {userInitials}
      </div>
      <div className="flex-1 relative">
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#2E86C1] focus-within:border-transparent transition-all">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Add a comment... Type @ to mention someone"
            rows={3}
            className="w-full px-4 py-3 text-[13px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none resize-none border-0"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-[#F1F5F9] bg-[#FAFBFC]">
            <p className="text-[10px] text-[#94A3B8]">
              <kbd className="px-1 py-0.5 rounded bg-[#F1F5F9] text-[10px] font-mono">Enter</kbd> to post
              <span className="mx-1">&middot;</span>
              <kbd className="px-1 py-0.5 rounded bg-[#F1F5F9] text-[10px] font-mono">@</kbd> to mention
            </p>
            <button onClick={handleSubmit} disabled={!text.trim() || submitting}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${text.trim() ? "bg-[#2E86C1] text-white hover:bg-[#2471A3]" : "bg-[#F1F5F9] text-[#CBD5E1] cursor-not-allowed"}`}>
              {submitting ? "Posting..." : "Comment"}
            </button>
          </div>
        </div>

        {/* @mention dropdown */}
        {showMentions && filtered.length > 0 && (
          <div className="absolute left-0 bottom-full mb-1.5 w-72 bg-white rounded-xl border border-[#E2E8F0] shadow-xl z-20 py-1 max-h-[240px] overflow-y-auto">
            <p className="px-3 py-1.5 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Team Members</p>
            {filtered.map((emp) => (
              <button key={emp._id} onClick={() => insertMention(emp)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F8FAFC] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
                  <p className="text-[10px] text-[#94A3B8] truncate">{emp.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Render comment with highlighted @mentions ──

export function CommentContent({ text }: { text: string }) {
  const parts = text.split(/(@[\w]+ [\w]+)/g);
  return (
    <p className="text-[13px] text-[#475569] whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-semibold text-[#2E86C1] bg-[#EBF5FB] px-1 py-0.5 rounded text-[12px]">{part}</span>
        ) : (
          part
        )
      )}
    </p>
  );
}
