"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string; dims: [number, number] };
    tinygif?: { url: string; dims: [number, number] };
  };
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY;

export function GifPicker({ onSelect }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(!!TENOR_API_KEY);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!TENOR_API_KEY) return;
    setLoading(true);
    try {
      const endpoint = searchQuery.trim()
        ? `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(searchQuery.trim())}&limit=20&media_filter=gif,tinygif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif,tinygif`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch GIFs");
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error("GIF fetch error:", err);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    fetchGifs("");
  }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGifs]);

  if (!TENOR_API_KEY) {
    return (
      <div className="w-[340px] max-h-[400px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 flex items-center justify-center p-8" aria-label="GIF picker">
        <p className="text-sm text-slate-400">GIF search unavailable</p>
      </div>
    );
  }

  return (
    <div className="w-[340px] max-h-[400px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden" aria-label="GIF picker">
      {/* Search input */}
      <div className="p-2.5 border-b border-[#E2E8F0] shrink-0" role="search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          aria-label="Search GIFs"
          className="w-full px-3 py-1.5 text-[13px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2E86C1] focus:ring-1 focus:ring-[#2E86C1]/20"
          autoFocus
        />
      </div>

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" style={{ height: 100 }} />
            ))}
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-[12px] text-[#94A3B8]">No GIFs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => {
              const thumb = gif.media_formats.tinygif?.url || gif.media_formats.gif?.url;
              const fullUrl = gif.media_formats.gif?.url || thumb;
              if (!thumb || !fullUrl) return null;
              return (
                <button
                  key={gif.id}
                  onClick={() => onSelect(fullUrl)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSelect(fullUrl); }}
                  className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[#2E86C1] transition-all focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  aria-label={query.trim() ? `GIF: ${query.trim()}` : "Trending GIF"}
                >
                  <img
                    src={thumb}
                    alt={gif.title || (query.trim() ? `GIF: ${query.trim()}` : "Trending GIF")}
                    className="w-full h-[100px] object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="px-3 py-1.5 border-t border-[#E2E8F0] shrink-0 flex items-center justify-center">
        <span className="text-[10px] text-[#94A3B8]">Powered by Tenor</span>
      </div>
    </div>
  );
}
