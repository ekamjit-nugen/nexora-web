"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiPageApi, WikiPage, WikiPageVersion } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PageHistoryPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const spaceId = params.spaceId as string;
  const pageId = params.pageId as string;

  const [page, setPage] = useState<WikiPage | null>(null);
  const [versions, setVersions] = useState<WikiPageVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WikiPageVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        setLoading(true);
        const [pageRes, versionsRes] = await Promise.all([
          wikiPageApi.get(pageId),
          wikiPageApi.getVersions(pageId),
        ]);
        setPage(pageRes.data as any);
        setVersions((versionsRes as any).data || []);
      } catch { toast.error("Failed to load history"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user, pageId]);

  if (authLoading || !user) return null;

  const handleViewVersion = async (version: number) => {
    try {
      const res = await wikiPageApi.getVersion(pageId, version);
      setSelectedVersion(res.data as any);
    } catch { toast.error("Failed to load version"); }
  };

  const handleRestore = async (version: number) => {
    if (!confirm(`Restore page to version ${version}? Current content will be saved as a new version.`)) return;
    try {
      await wikiPageApi.restoreVersion(pageId, version);
      toast.success(`Restored to version ${version}`);
      router.push(`/wiki/${spaceId}/${pageId}`);
    } catch { toast.error("Failed to restore"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        <button onClick={() => router.push(`/wiki/${spaceId}/${pageId}`)}
          className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-4 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Page
        </button>

        <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Version History</h1>
        {page && <p className="text-sm text-[#64748B] mb-6">{page.icon} {page.title} — current v{page.version}</p>}

        {loading ? (
          <div className="text-center py-20 text-[#94A3B8]">Loading...</div>
        ) : (
          <div className="flex gap-6">
            {/* Version List */}
            <div className="w-[320px] shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                {versions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#94A3B8]">No previous versions</div>
                ) : versions.map(v => (
                  <div key={v.version}
                    onClick={() => handleViewVersion(v.version)}
                    className={`p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${selectedVersion?.version === v.version ? "bg-[#EFF6FF]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#0F172A]">Version {v.version}</span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {v.changeSummary && <p className="text-xs text-[#64748B] mt-1">{v.changeSummary}</p>}
                    {v.editedBy && <p className="text-[10px] text-[#94A3B8] mt-1">by {v.editedBy}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Version Preview */}
            <div className="flex-1">
              {selectedVersion ? (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <h2 className="text-lg font-semibold text-[#0F172A]">{selectedVersion.title}</h2>
                      <p className="text-xs text-[#64748B]">Version {selectedVersion.version} — {new Date(selectedVersion.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                    <Button onClick={() => handleRestore(selectedVersion.version)} className="bg-[#F59E0B] text-white text-xs">
                      Restore This Version
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none text-[#334155]" dangerouslySetInnerHTML={{ __html: selectedVersion.content }} />
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center text-[#94A3B8] text-sm">
                  Select a version from the list to preview
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
