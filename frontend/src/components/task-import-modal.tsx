"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { taskApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface TaskImportModalProps {
  open: boolean;
  projectId: string;
  projectKey?: string;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedPreview {
  headers: string[];
  rows: string[][];
  isJira: boolean;
}

interface ImportResult {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

export function TaskImportModal({ open, projectId, projectKey, onClose, onImportComplete }: TaskImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setImporting(false);
    setProgress(0);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const parseCSVPreview = useCallback((content: string): ParsedPreview => {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [], isJira: false };

    const parseLine = (line: string): string[] => {
      const fields: string[] = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          fields.push(field.trim());
          field = "";
        } else {
          field += ch;
        }
      }
      fields.push(field.trim());
      return fields;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1, 6).map(l => parseLine(l));

    const lower = headers.map(h => h.toLowerCase().trim());
    const jiraIndicators = ["summary", "issue type", "issue key", "issue id", "reporter"];
    const isJira = jiraIndicators.filter(j => lower.includes(j)).length >= 2;

    return { headers, rows, isJira };
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) setPreview(parseCSVPreview(content));
    };
    reader.readAsText(selectedFile);
  }, [parseCSVPreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      handleFileSelect(f);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setProgress(20);
    try {
      setProgress(50);
      const res = await taskApi.importTasks(projectId, file, projectKey);
      setProgress(100);
      setResult(res.data);
      if (res.data.created > 0) {
        onImportComplete();
      }
    } catch (err: any) {
      setResult({ total: 0, created: 0, failed: 0, errors: [{ row: 0, reason: err.message || "Import failed" }] });
    } finally {
      setImporting(false);
    }
  }, [file, projectId, projectKey, onImportComplete]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await taskApi.getImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "task-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
  }, []);

  // Column mapping display
  const KNOWN_COLUMNS: Record<string, string> = {
    title: "Title", summary: "Title", description: "Description",
    type: "Type", "issue type": "Type", status: "Status",
    priority: "Priority", assignee: "Assignee",
    "story points": "Story Points", "due date": "Due Date",
    sprint: "Sprint", labels: "Labels",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">Import Tasks</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Upload a CSV file to create tasks in bulk</p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Download template link */}
          <div className="flex items-center gap-2 text-xs">
            <button onClick={handleDownloadTemplate} className="text-[#2E86C1] hover:underline flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download CSV Template
            </button>
            <span className="text-[#CBD5E1]">|</span>
            <span className="text-[#94A3B8]">Supports Jira CSV export format</span>
          </div>

          {/* Dropzone */}
          {!file && !result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#2E86C1] bg-blue-50"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
            >
              <svg className="w-10 h-10 mx-auto text-[#94A3B8] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-[#334155]">Drop your CSV file here</p>
              <p className="text-xs text-[#94A3B8] mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          )}

          {/* File selected - Preview */}
          {file && preview && !result && (
            <div className="space-y-3">
              {/* File info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <svg className="w-5 h-5 text-[#2E86C1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{file.name}</p>
                  <p className="text-[10px] text-[#94A3B8]">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="text-xs text-[#94A3B8] hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Jira detection */}
              {preview.isJira && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                  <svg className="w-4 h-4 text-[#2E86C1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-[#2E86C1]">Jira CSV detected -- columns auto-mapped</span>
                </div>
              )}

              {/* Column mapping */}
              <div>
                <p className="text-xs font-semibold text-[#334155] mb-2">Column Mapping</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.headers.map((h, i) => {
                    const mapped = KNOWN_COLUMNS[h.toLowerCase().trim()];
                    return (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-1 rounded-full ${
                          mapped
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-gray-50 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {h} {mapped ? `-> ${mapped}` : "(skipped)"}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Data preview */}
              {preview.rows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#334155] mb-2">
                    Preview ({preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""} shown)
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#F8FAFC]">
                          {preview.headers.map((h, i) => (
                            <th key={i} className="text-left px-2.5 py-2 font-semibold text-[#475569] whitespace-nowrap border-b border-[#E2E8F0]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2.5 py-1.5 text-[#334155] whitespace-nowrap max-w-[200px] truncate">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress bar during import */}
              {importing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-[#64748B]">
                    <span>Importing tasks...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full bg-[#2E86C1] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-4 rounded-xl ${
                result.failed === 0 && result.created > 0
                  ? "bg-emerald-50 border border-emerald-200"
                  : result.created === 0
                  ? "bg-red-50 border border-red-200"
                  : "bg-amber-50 border border-amber-200"
              }`}>
                {result.failed === 0 && result.created > 0 ? (
                  <svg className="w-6 h-6 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Created {result.created} task{result.created !== 1 ? "s" : ""}{result.failed > 0 ? `, ${result.failed} failed` : ""}
                  </p>
                  <p className="text-xs text-[#64748B]">{result.total} total rows processed</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1.5">Errors</p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 divide-y divide-red-100">
                    {result.errors.map((err, i) => (
                      <div key={i} className="px-3 py-2 text-xs text-red-700 bg-red-50/50">
                        <span className="font-medium">Row {err.row}:</span> {err.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          {result ? (
            <Button size="sm" onClick={handleClose} className="h-9 bg-[#2E86C1] hover:bg-[#2471A3]">
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleClose} className="h-9">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!file || importing}
                className="h-9 bg-[#2E86C1] hover:bg-[#2471A3] disabled:opacity-50"
              >
                {importing ? (
                  <span className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Import
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
