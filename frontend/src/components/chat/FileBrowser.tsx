"use client";

import { useState, useEffect, useCallback } from "react";

interface MediaFile {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageUrl?: string;
  createdAt: string;
  uploadedBy: string;
  processing?: {
    status: string;
    thumbnail?: { storageKey: string };
  };
}

interface FileBrowserProps {
  conversationId: string;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
  return "📎";
}

const FILTER_OPTIONS = [
  { value: "", label: "All files" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "application/pdf", label: "PDFs" },
];

export function FileBrowser({ conversationId, onClose }: FileBrowserProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005";
      const token = localStorage.getItem("accessToken");
      const qs = filter ? `&type=${filter}` : "";
      const res = await fetch(
        `${API_BASE}/api/v1/media/conversations/${conversationId}/files?limit=100${qs}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const data = await res.json();
      setFiles(data.data || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, filter]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[360px] min-w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Shared Files</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-slate-100">
        <div className="flex gap-1 overflow-x-auto">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                filter === value ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No files shared yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {files.map((file) => (
              <div key={file._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="text-xl shrink-0">{getFileIcon(file.mimeType)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 truncate">{file.originalName}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)} &middot; {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {file.storageUrl && (
                  <a
                    href={file.storageUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={file.originalName}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 shrink-0"
                    title="Download"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
