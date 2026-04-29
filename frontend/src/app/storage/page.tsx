"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RouteGuard } from "@/components/route-guard";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3015";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

interface FileRow {
  _id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  uploadedBy: string;
  uploadedByName?: string;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
}

interface Quota {
  quotaGb: number;
  quotaBytes: number;
  usedBytes: number;
  usedPercent: number;
  fileCount: number;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ""}`,
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body?.error?.message || body?.message || msg;
    } catch {}
    throw new Error(`${res.status} ${msg}`);
  }
  return res.json();
}

export default function StoragePage() {
  const { user, logout } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [q, f] = await Promise.all([
        api("/storage/quota"),
        api("/storage/files?limit=100"),
      ]);
      setQuota(q.data ?? q);
      const list = f.data ?? f;
      setFiles(Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load storage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUpload(file: File) {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File exceeds 100 MB limit");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/v1/storage/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `Upload failed (${res.status})`);
      }
      toast.success(`Uploaded ${file.name}`);
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(id: string, name: string) {
    try {
      const r = await api(`/storage/files/${id}/download`);
      const url = (r.data ?? r).url;
      // Open in a new tab — pre-signed S3 URL with limited TTL.
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await api(`/storage/files/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <RouteGuard minOrgRole="member">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#0F172A]">Cloud Storage</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Upload and manage files for your organisation. Storage is private to your tenant.
            </p>
          </div>

          {/* Quota card */}
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-5">
              {quota ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Storage used
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[#0F172A]">
                        {fmtBytes(quota.usedBytes)} <span className="text-slate-400">of</span> {quota.quotaGb} GB
                      </div>
                      <div className="text-xs text-slate-500">
                        {quota.fileCount} {quota.fileCount === 1 ? "file" : "files"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Free</div>
                      <div className="mt-1 text-xl font-semibold text-emerald-600">
                        {fmtBytes(quota.quotaBytes - quota.usedBytes)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${
                        quota.usedPercent > 90
                          ? "bg-red-500"
                          : quota.usedPercent > 70
                          ? "bg-amber-500"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${Math.min(100, quota.usedPercent)}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">Loading…</div>
              )}
            </CardContent>
          </Card>

          {/* Upload */}
          <div className="mb-4 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {uploading ? "Uploading…" : "+ Upload file"}
            </Button>
            <span className="text-xs text-slate-500">Up to 100 MB per file</span>
          </div>

          {/* Files table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Uploaded by</th>
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                  )}
                  {!loading && files.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No files yet. Click <strong>+ Upload file</strong> to add the first one.
                    </td></tr>
                  )}
                  {files.map((f) => (
                    <tr key={f._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-[#0F172A]">{f.name}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtBytes(f.sizeBytes)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{f.contentType}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{f.uploadedByName || f.uploadedBy.slice(0, 8) + "…"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(f.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownload(f._id, f.name)}
                          className="mr-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(f._id, f.name)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
    </RouteGuard>
  );
}
