"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiSearchApi, wikiSpaceApi, WikiPage, WikiSpace } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function WikiSearchPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiPage[]>([]);
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [spaceFilter, setSpaceFilter] = useState("");
  const [searchMode, setSearchMode] = useState<"text" | "ai">("text");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    wikiSpaceApi.getAll().then(res => setSpaces(Array.isArray(res.data) ? res.data : [])).catch(() => {});
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const spaceMap = new Map(spaces.map(s => [s._id, s]));

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      setSearched(true);
      let res;
      if (searchMode === "ai") {
        res = await wikiSearchApi.semanticSearch(query, spaceFilter || undefined);
      } else {
        const params: Record<string, string> = { q: query };
        if (spaceFilter) params.spaceId = spaceFilter;
        res = await wikiSearchApi.search(params);
      }
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">Search Wiki</h1>
        <p className="text-sm text-[#64748B] mb-6">Search across all published pages</p>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages..."
            className="text-sm flex-1" onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <select value={spaceFilter} onChange={e => setSpaceFilter(e.target.value)}
            className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white w-48">
            <option value="">All Spaces</option>
            {spaces.map(s => <option key={s._id} value={s._id}>{s.icon} {s.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden">
            <button onClick={() => setSearchMode("text")}
              className={`px-3 py-2 text-xs font-medium ${searchMode === "text" ? "bg-[#2E86C1] text-white" : "bg-white text-[#64748B]"}`}>
              Text
            </button>
            <button onClick={() => setSearchMode("ai")}
              className={`px-3 py-2 text-xs font-medium ${searchMode === "ai" ? "bg-[#8B5CF6] text-white" : "bg-white text-[#64748B]"}`}>
              AI Search
            </button>
          </div>
          <Button onClick={handleSearch} disabled={loading} className="bg-[#2E86C1] text-white text-sm">
            {loading ? "..." : "Search"}
          </Button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 animate-pulse">
                <div className="h-4 bg-[#E2E8F0] rounded w-64 mb-2" />
                <div className="h-3 bg-[#E2E8F0] rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(page => {
              const space = spaceMap.get(page.spaceId);
              return (
                <div key={page._id} onClick={() => router.push(`/wiki/${page.spaceId}/${page._id}`)}
                  className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 hover:shadow-md hover:border-[#2E86C1] cursor-pointer transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{page.icon || "📄"}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-[#0F172A]">{page.title}</h3>
                        {page.isPinned && <span className="text-xs text-[#F59E0B]">★</span>}
                      </div>
                      {page.excerpt && <p className="text-xs text-[#64748B] line-clamp-2">{page.excerpt}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {space && <span className="text-[10px] text-[#94A3B8]">{space.icon} {space.name}</span>}
                        {page.tags?.length > 0 && page.tags.slice(0, 3).map(t => (
                          <span key={t} className="px-1.5 py-0 bg-[#F1F5F9] text-[#334155] rounded text-[9px]">{t}</span>
                        ))}
                        <span className="text-[10px] text-[#94A3B8] ml-auto">v{page.version}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {searched && results.length === 0 && (
              <div className="text-center py-16 text-[#94A3B8] text-sm">
                No results found for &quot;{query}&quot;
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
