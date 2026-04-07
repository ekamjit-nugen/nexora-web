/**
 * Tests for useOfflineCache hook
 *
 * Uses fake-indexeddb to provide an in-memory IndexedDB implementation
 * so we can verify cache operations without a real browser database.
 */
import "fake-indexeddb/auto"; // patches globalThis.indexedDB
import { renderHook, act } from "@testing-library/react";
import { useOfflineCache } from "../useOfflineCache";

// Reset the IndexedDB between tests so each test starts clean
beforeEach(async () => {
  const dbs = await indexedDB.databases?.();
  if (dbs) {
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  }
});

describe("useOfflineCache", () => {
  // ── cacheConversations / getCachedConversations ──

  it("cacheConversations stores conversations and getCachedConversations retrieves them", async () => {
    const { result } = renderHook(() => useOfflineCache());

    const conversations = [
      { _id: "c1", name: "General", updatedAt: "2026-01-01" },
      { _id: "c2", name: "Random", updatedAt: "2026-01-02" },
    ];

    await act(async () => {
      await result.current.cacheConversations(conversations);
    });

    let cached: unknown[] = [];
    await act(async () => {
      cached = await result.current.getCachedConversations();
    });

    expect(cached).toHaveLength(2);
    expect(cached).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: "c1", name: "General" }),
        expect.objectContaining({ _id: "c2", name: "Random" }),
      ]),
    );
  });

  it("getCachedConversations returns an empty array when nothing is cached", async () => {
    const { result } = renderHook(() => useOfflineCache());

    let cached: unknown[] = [];
    await act(async () => {
      cached = await result.current.getCachedConversations();
    });

    expect(cached).toEqual([]);
  });

  // ── cacheMessages / getCachedMessages ──

  it("cacheMessages stores messages by conversationId and getCachedMessages retrieves them", async () => {
    const { result } = renderHook(() => useOfflineCache());

    const messages = [
      { _id: "m1", conversationId: "c1", body: "Hello", createdAt: "2026-01-01T10:00:00Z" },
      { _id: "m2", conversationId: "c1", body: "World", createdAt: "2026-01-01T10:01:00Z" },
    ];

    await act(async () => {
      await result.current.cacheMessages("c1", messages);
    });

    let cached: unknown[] = [];
    await act(async () => {
      cached = await result.current.getCachedMessages("c1");
    });

    expect(cached).toHaveLength(2);
    expect(cached[0]).toEqual(expect.objectContaining({ _id: "m1" }));
    expect(cached[1]).toEqual(expect.objectContaining({ _id: "m2" }));
  });

  it("getCachedMessages returns empty array for unknown conversationId", async () => {
    const { result } = renderHook(() => useOfflineCache());

    let cached: unknown[] = [];
    await act(async () => {
      cached = await result.current.getCachedMessages("nonexistent");
    });

    expect(cached).toEqual([]);
  });

  it("getCachedMessages does not return messages from a different conversation", async () => {
    const { result } = renderHook(() => useOfflineCache());

    await act(async () => {
      await result.current.cacheMessages("c1", [
        { _id: "m1", conversationId: "c1", body: "hi", createdAt: "2026-01-01T10:00:00Z" },
      ]);
      await result.current.cacheMessages("c2", [
        { _id: "m2", conversationId: "c2", body: "yo", createdAt: "2026-01-01T10:00:00Z" },
      ]);
    });

    let cached: unknown[] = [];
    await act(async () => {
      cached = await result.current.getCachedMessages("c1");
    });

    expect(cached).toHaveLength(1);
    expect(cached[0]).toEqual(expect.objectContaining({ _id: "m1" }));
  });

  // ── getLastSyncTimestamp / setLastSyncTimestamp ──

  it("getLastSyncTimestamp returns null when no timestamp is set", async () => {
    const { result } = renderHook(() => useOfflineCache());

    let ts: string | null = "not-null";
    await act(async () => {
      ts = await result.current.getLastSyncTimestamp();
    });

    expect(ts).toBeNull();
  });

  it("setLastSyncTimestamp persists and getLastSyncTimestamp retrieves it", async () => {
    const { result } = renderHook(() => useOfflineCache());

    await act(async () => {
      await result.current.setLastSyncTimestamp("2026-04-07T00:00:00Z");
    });

    let ts: string | null = null;
    await act(async () => {
      ts = await result.current.getLastSyncTimestamp();
    });

    expect(ts).toBe("2026-04-07T00:00:00Z");
  });

  it("setLastSyncTimestamp overwrites previous value", async () => {
    const { result } = renderHook(() => useOfflineCache());

    await act(async () => {
      await result.current.setLastSyncTimestamp("2026-01-01T00:00:00Z");
      await result.current.setLastSyncTimestamp("2026-06-01T00:00:00Z");
    });

    let ts: string | null = null;
    await act(async () => {
      ts = await result.current.getLastSyncTimestamp();
    });

    expect(ts).toBe("2026-06-01T00:00:00Z");
  });

  // ── clearCache ──

  it("clearCache empties all stores", async () => {
    const { result } = renderHook(() => useOfflineCache());

    await act(async () => {
      await result.current.cacheConversations([{ _id: "c1", name: "test" }]);
      await result.current.cacheMessages("c1", [
        { _id: "m1", conversationId: "c1", body: "hi", createdAt: "2026-01-01T10:00:00Z" },
      ]);
      await result.current.setLastSyncTimestamp("2026-01-01T00:00:00Z");
    });

    await act(async () => {
      await result.current.clearCache();
    });

    let convos: unknown[] = [];
    let msgs: unknown[] = [];
    let ts: string | null = "something";
    await act(async () => {
      convos = await result.current.getCachedConversations();
      msgs = await result.current.getCachedMessages("c1");
      ts = await result.current.getLastSyncTimestamp();
    });

    expect(convos).toEqual([]);
    expect(msgs).toEqual([]);
    expect(ts).toBeNull();
  });

  // ── isOnline ──

  it("isOnline reflects navigator.onLine initially", () => {
    // jsdom defaults navigator.onLine to true
    const { result } = renderHook(() => useOfflineCache());
    expect(result.current.isOnline).toBe(true);
  });

  it("isOnline updates when offline/online events fire", () => {
    const { result } = renderHook(() => useOfflineCache());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });

  // ── isSupported ──

  it("isSupported returns true when IndexedDB is available", () => {
    const { result } = renderHook(() => useOfflineCache());
    expect(result.current.isSupported).toBe(true);
  });
});
