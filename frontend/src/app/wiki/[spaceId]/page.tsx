"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiSpaceApi, wikiPageApi, WikiSpace, WikiTreeNode } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function TreeItem({ node, depth, onSelect }: { node: WikiTreeNode; depth: number; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[#F1F5F9] cursor-pointer group transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node._id)}
      >
        {hasChildren && (
          <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} className="w-4 h-4 flex items-center justify-center text-[#94A3B8] hover:text-[#334155]">
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <span className="text-sm">{node.icon || "📄"}</span>
        <span className="text-xs font-medium text-[#334155] truncate flex-1">{node.title}</span>
        {node.isPinned && <span className="text-[9px] text-[#F59E0B]">★</span>}
      </div>
      {expanded && hasChildren && node.children.map(child => (
        <TreeItem key={child._id} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function SpacePage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const spaceId = params.spaceId as string;

  const [space, setSpace] = useState<WikiSpace | null>(null);
  const [tree, setTree] = useState<WikiTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [spaceRes, treeRes] = await Promise.all([
        wikiSpaceApi.get(spaceId),
        wikiSpaceApi.getTree(spaceId),
      ]);
      setSpace(spaceRes.data as any);
      setTree(Array.isArray(treeRes.data) ? treeRes.data : []);
    } catch { toast.error("Failed to load space"); }
    finally { setLoading(false); }
  }, [spaceId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const handleCreatePage = async () => {
    if (!newTitle) { toast.error("Title is required"); return; }
    try {
      const res = await wikiPageApi.create({ spaceId, title: newTitle, status: "draft" });
      toast.success("Page created");
      setShowCreate(false);
      setNewTitle("");
      router.push(`/wiki/${spaceId}/${(res.data as any)._id}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleSelectPage = (pageId: string) => {
    router.push(`/wiki/${spaceId}/${pageId}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] flex">
        {/* Wiki Sidebar */}
        <div className="w-[280px] border-r border-[#E2E8F0] bg-white min-h-screen p-4">
          <button onClick={() => router.push("/wiki")} className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            All Spaces
          </button>

          {space && (
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
              <span className="text-xl">{space.icon}</span>
              <h2 className="text-sm font-bold text-[#0F172A] truncate">{space.name}</h2>
            </div>
          )}

          <Button onClick={() => setShowCreate(!showCreate)} className="w-full bg-[#2E86C1] text-white text-xs mb-3 h-8">
            + New Page
          </Button>

          {showCreate && (
            <div className="mb-3 flex gap-1">
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Page title..." className="text-xs h-8"
                onKeyDown={e => e.key === "Enter" && handleCreatePage()} />
              <Button onClick={handleCreatePage} className="bg-[#10B981] text-white text-xs h-8 px-2">Go</Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-[#F1F5F9] rounded animate-pulse" />)}
            </div>
          ) : tree.length > 0 ? (
            <div className="space-y-0.5">
              {tree.map(node => <TreeItem key={node._id} node={node} depth={0} onSelect={handleSelectPage} />)}
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8] text-center py-8">No pages yet. Create your first page above.</p>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto text-center py-20">
            <span className="text-6xl mb-4 block">{space?.icon || "📚"}</span>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{space?.name || "Loading..."}</h1>
            {space?.description && <p className="text-sm text-[#64748B] mb-6">{space.description}</p>}
            <p className="text-sm text-[#94A3B8]">Select a page from the sidebar or create a new one to get started.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
