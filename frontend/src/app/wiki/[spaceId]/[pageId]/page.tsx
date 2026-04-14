"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiSpaceApi, wikiPageApi, wikiBookmarkApi, WikiSpace, WikiPage, WikiTreeNode } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function TreeItem({ node, depth, activeId, onSelect }: { node: WikiTreeNode; depth: number; activeId: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;
  const isActive = node._id === activeId;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${isActive ? "bg-[#DBEAFE] text-[#1E40AF]" : "hover:bg-[#F1F5F9] text-[#334155]"}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node._id)}
      >
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} className="w-4 h-4 flex items-center justify-center text-[#94A3B8]">
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        ) : <div className="w-4" />}
        <span className="text-sm">{node.icon || "📄"}</span>
        <span className="text-xs font-medium truncate flex-1">{node.title}</span>
      </div>
      {expanded && hasChildren && node.children.map(child => (
        <TreeItem key={child._id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function WikiPageEditorPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const spaceId = params.spaceId as string;
  const pageId = params.pageId as string;

  const [space, setSpace] = useState<WikiSpace | null>(null);
  const [tree, setTree] = useState<WikiTreeNode[]>([]);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [isBookmarked, setIsBookmarked] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [spaceRes, treeRes, pageRes, bookmarksRes] = await Promise.allSettled([
        wikiSpaceApi.get(spaceId),
        wikiSpaceApi.getTree(spaceId),
        wikiPageApi.get(pageId),
        wikiBookmarkApi.getAll(),
      ]);
      if (spaceRes.status === "fulfilled") setSpace(spaceRes.value.data as any);
      if (treeRes.status === "fulfilled") setTree(Array.isArray(treeRes.value.data) ? treeRes.value.data : []);
      if (pageRes.status === "fulfilled") {
        const p = pageRes.value.data as any;
        setPage(p);
        setEditTitle(p.title);
        setEditContent(p.content || "");
      }
      if (bookmarksRes.status === "fulfilled") {
        const bms = Array.isArray(bookmarksRes.value.data) ? bookmarksRes.value.data : [];
        setIsBookmarked(bms.some((b: any) => b.pageId === pageId));
      }
    } catch { toast.error("Failed to load page"); }
    finally { setLoading(false); }
  }, [spaceId, pageId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const handleSave = async () => {
    if (!page) return;
    try {
      setSaving(true);
      const res = await wikiPageApi.update(pageId, { title: editTitle, content: editContent, changeSummary: changeSummary || undefined });
      setPage(res.data as any);
      setIsEditing(false);
      setChangeSummary("");
      toast.success("Page saved (v" + ((res.data as any).version) + ")");
      // Refresh tree
      const treeRes = await wikiSpaceApi.getTree(spaceId);
      setTree(Array.isArray(treeRes.data) ? treeRes.data : []);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!page) return;
    try {
      const res = await wikiPageApi.update(pageId, { status: "published" });
      setPage(res.data as any);
      toast.success("Page published");
    } catch { toast.error("Failed to publish"); }
  };

  const handleToggleBookmark = async () => {
    try {
      if (isBookmarked) { await wikiBookmarkApi.remove(pageId); setIsBookmarked(false); toast.success("Bookmark removed"); }
      else { await wikiBookmarkApi.add(pageId); setIsBookmarked(true); toast.success("Page bookmarked"); }
    } catch { toast.error("Failed"); }
  };

  const handleTogglePin = async () => {
    if (!page) return;
    try {
      const res = await wikiPageApi.togglePin(pageId);
      setPage(res.data as any);
      toast.success((res.data as any).isPinned ? "Pinned" : "Unpinned");
    } catch { toast.error("Failed"); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this page and all its children?")) return;
    try {
      await wikiPageApi.delete(pageId);
      toast.success("Page deleted");
      router.push(`/wiki/${spaceId}`);
    } catch { toast.error("Failed"); }
  };

  const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
    draft: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
    published: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
    archived: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] flex">
        {/* Wiki Tree Sidebar */}
        <div className="w-[260px] border-r border-[#E2E8F0] bg-white min-h-screen p-3 overflow-y-auto">
          <button onClick={() => router.push("/wiki")} className="text-[10px] text-[#94A3B8] hover:text-[#2E86C1] mb-2 flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Spaces
          </button>
          {space && (
            <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-[#E2E8F0]">
              <span>{space.icon}</span>
              <span className="text-xs font-bold text-[#0F172A] truncate">{space.name}</span>
            </div>
          )}
          {tree.map(node => (
            <TreeItem key={node._id} node={node} depth={0} activeId={pageId} onSelect={id => router.push(`/wiki/${spaceId}/${id}`)} />
          ))}
        </div>

        {/* Page Content */}
        <div className="flex-1 min-h-screen">
          {loading ? (
            <div className="p-8 max-w-4xl mx-auto animate-pulse">
              <div className="h-8 bg-[#E2E8F0] rounded w-64 mb-4" />
              <div className="h-4 bg-[#E2E8F0] rounded w-full mb-2" />
              <div className="h-4 bg-[#E2E8F0] rounded w-3/4" />
            </div>
          ) : page ? (
            <div className="max-w-4xl mx-auto p-8">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[page.status]?.bg} ${STATUS_BADGE[page.status]?.text}`}>
                    {page.status.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">v{page.version}</span>
                  {page.isPinned && <span className="text-xs text-[#F59E0B]" title="Pinned">★</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleToggleBookmark} className={`p-1.5 rounded hover:bg-[#F1F5F9] ${isBookmarked ? "text-[#2E86C1]" : "text-[#94A3B8]"}`} title="Bookmark">
                    <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  </button>
                  <button onClick={handleTogglePin} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#94A3B8]" title="Pin">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  </button>
                  <button onClick={() => router.push(`/wiki/${spaceId}/${pageId}/history`)} className="text-xs text-[#64748B] hover:text-[#2E86C1] px-2 py-1 rounded hover:bg-[#F1F5F9]">History</button>
                  {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} className="bg-[#2E86C1] text-white text-xs h-8">Edit</Button>
                  ) : (
                    <>
                      <Button onClick={() => { setIsEditing(false); setEditTitle(page.title); setEditContent(page.content); }} className="bg-[#F1F5F9] text-[#334155] text-xs h-8">Cancel</Button>
                      <Button onClick={handleSave} disabled={saving} className="bg-[#10B981] text-white text-xs h-8">{saving ? "Saving..." : "Save"}</Button>
                    </>
                  )}
                  {page.status === "draft" && <Button onClick={handlePublish} className="bg-[#8B5CF6] text-white text-xs h-8">Publish</Button>}
                  <button onClick={handleDelete} className="p-1.5 rounded hover:bg-[#FEE2E2] text-[#94A3B8] hover:text-[#EF4444]" title="Delete">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {isEditing ? (
                /* Edit Mode */
                <div>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="text-2xl font-bold border-0 border-b border-[#E2E8F0] rounded-none px-0 mb-4 focus-visible:ring-0 text-[#0F172A]"
                    placeholder="Page title" />
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full min-h-[500px] p-4 border border-[#E2E8F0] rounded-xl text-sm font-mono text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] resize-y"
                    placeholder="Write your content here... (HTML/Markdown supported)"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Input value={changeSummary} onChange={e => setChangeSummary(e.target.value)}
                      placeholder="Change summary (optional)" className="text-xs flex-1" />
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl">{page.icon}</span>
                    <h1 className="text-2xl font-bold text-[#0F172A]">{page.title}</h1>
                  </div>
                  {page.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {page.tags.map(t => <span key={t} className="px-2 py-0.5 bg-[#F1F5F9] text-[#334155] rounded text-[10px] font-medium">{t}</span>)}
                    </div>
                  )}
                  <div className="text-[10px] text-[#94A3B8] mb-6">
                    Last edited {new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {page.lastEditedBy && ` by ${page.lastEditedBy}`}
                  </div>
                  {page.content ? (
                    <div className="prose prose-sm max-w-none text-[#334155]" dangerouslySetInnerHTML={{ __html: page.content }} />
                  ) : (
                    <p className="text-sm text-[#94A3B8] italic">This page is empty. Click Edit to add content.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center py-20 text-[#94A3B8]">Page not found</div>
          )}
        </div>
      </main>
    </div>
  );
}
