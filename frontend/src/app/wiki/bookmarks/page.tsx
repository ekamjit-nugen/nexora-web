"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiBookmarkApi, wikiSpaceApi, WikiBookmark, WikiSpace } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { toast } from "sonner";

export default function WikiBookmarksPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<WikiBookmark[]>([]);
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        setLoading(true);
        const [bmRes, spRes] = await Promise.all([wikiBookmarkApi.getAll(), wikiSpaceApi.getAll()]);
        setBookmarks(Array.isArray(bmRes.data) ? bmRes.data : []);
        setSpaces(Array.isArray(spRes.data) ? spRes.data : []);
      } catch { toast.error("Failed to load bookmarks"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const spaceMap = new Map(spaces.map(s => [s._id, s]));

  const handleRemove = async (pageId: string) => {
    try {
      await wikiBookmarkApi.remove(pageId);
      setBookmarks(prev => prev.filter(b => b.pageId !== pageId));
      toast.success("Bookmark removed");
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Bookmarks</h1>
        <p className="text-sm text-[#64748B] mb-6">{bookmarks.length} saved page{bookmarks.length !== 1 ? "s" : ""}</p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-white rounded-xl shadow-sm border border-[#E2E8F0] animate-pulse" />)}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-16 text-[#94A3B8] text-sm">No bookmarks yet. Star pages to save them here.</div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map(bm => {
              const page = bm.page;
              if (!page) return null;
              const space = spaceMap.get(bm.spaceId);
              return (
                <div key={bm._id} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/wiki/${bm.spaceId}/${bm.pageId}`)}>
                  <span className="text-xl">{page.icon || "📄"}</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#0F172A]">{page.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {space && <span className="text-[10px] text-[#94A3B8]">{space.icon} {space.name}</span>}
                      {page.excerpt && <span className="text-[10px] text-[#94A3B8] truncate max-w-[300px]">{page.excerpt}</span>}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleRemove(bm.pageId); }}
                    className="p-1.5 rounded hover:bg-[#FEE2E2] text-[#94A3B8] hover:text-[#EF4444]" title="Remove bookmark">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
