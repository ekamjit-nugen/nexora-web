"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── IndexedDB Wrapper (no external dependencies) ──

const DB_NAME = "nexora-cache";
const DB_VERSION = 1;

const STORES = {
  conversations: "conversations",
  messages: "messages",
  syncMeta: "syncMeta",
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.conversations)) {
        db.createObjectStore(STORES.conversations, { keyPath: "_id" });
      }

      if (!db.objectStoreNames.contains(STORES.messages)) {
        const msgStore = db.createObjectStore(STORES.messages, { keyPath: "_id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
        msgStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.syncMeta)) {
        db.createObjectStore(STORES.syncMeta);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txWrite(db: IDBDatabase, storeName: string): { store: IDBObjectStore; tx: IDBTransaction } {
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  return { store, tx };
}

function txRead(db: IDBDatabase, storeName: string): { store: IDBObjectStore; tx: IDBTransaction } {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return { store, tx };
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ── Cache Operations ──

async function cacheConversations(conversations: any[]): Promise<void> {
  const db = await openDB();
  const { store, tx } = txWrite(db, STORES.conversations);
  for (const convo of conversations) {
    store.put(convo);
  }
  await promisifyTransaction(tx);
  db.close();
}

async function getCachedConversations(): Promise<any[]> {
  const db = await openDB();
  const { store } = txRead(db, STORES.conversations);
  const result = await promisifyRequest(store.getAll());
  db.close();
  return result;
}

async function cacheMessages(conversationId: string, messages: any[]): Promise<void> {
  const db = await openDB();
  const { store, tx } = txWrite(db, STORES.messages);
  for (const msg of messages) {
    // Ensure conversationId is stored on the message for indexing
    store.put({ ...msg, conversationId: msg.conversationId || conversationId });
  }
  await promisifyTransaction(tx);
  db.close();
}

async function getCachedMessages(conversationId: string, limit = 100): Promise<any[]> {
  const db = await openDB();
  const { store } = txRead(db, STORES.messages);
  const index = store.index("conversationId");
  const results: any[] = [];

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(conversationId), "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        db.close();
        // Return in chronological order (oldest first)
        resolve(results.reverse());
      }
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function getLastSyncTimestamp(): Promise<string | null> {
  const db = await openDB();
  const { store } = txRead(db, STORES.syncMeta);
  const result = await promisifyRequest(store.get("lastSyncTimestamp"));
  db.close();
  return result ?? null;
}

async function setLastSyncTimestamp(ts: string): Promise<void> {
  const db = await openDB();
  const { store, tx } = txWrite(db, STORES.syncMeta);
  store.put(ts, "lastSyncTimestamp");
  await promisifyTransaction(tx);
  db.close();
}

async function clearCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.conversations, STORES.messages, STORES.syncMeta],
    "readwrite"
  );
  tx.objectStore(STORES.conversations).clear();
  tx.objectStore(STORES.messages).clear();
  tx.objectStore(STORES.syncMeta).clear();
  await promisifyTransaction(tx);
  db.close();
}

// ── Hook ──

interface OfflineCacheHook {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether IndexedDB is supported */
  isSupported: boolean;
  /** Cache a list of conversations to IndexedDB */
  cacheConversations: (conversations: any[]) => Promise<void>;
  /** Get all cached conversations from IndexedDB */
  getCachedConversations: () => Promise<any[]>;
  /** Cache messages for a conversation */
  cacheMessages: (conversationId: string, messages: any[]) => Promise<void>;
  /** Get cached messages for a conversation */
  getCachedMessages: (conversationId: string, limit?: number) => Promise<any[]>;
  /** Get the last sync timestamp for delta sync */
  getLastSyncTimestamp: () => Promise<string | null>;
  /** Set the last sync timestamp after successful sync */
  setLastSyncTimestamp: (ts: string) => Promise<void>;
  /** Clear all cached data */
  clearCache: () => Promise<void>;
}

export function useOfflineCache(): OfflineCacheHook {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const isSupported =
    typeof window !== "undefined" && "indexedDB" in window;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    isSupported,
    cacheConversations,
    getCachedConversations,
    cacheMessages,
    getCachedMessages,
    getLastSyncTimestamp,
    setLastSyncTimestamp,
    clearCache,
  };
}
