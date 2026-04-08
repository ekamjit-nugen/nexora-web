"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

// Static curated GIF collection — no API key required
const GIF_CATEGORIES: Record<string, Array<{ url: string; thumb: string; alt: string }>> = {
  "Reactions": [
    { url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif", thumb: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200w.gif", alt: "Thumbs up" },
    { url: "https://media.giphy.com/media/l0HlvtIPdijJT1Eqc/giphy.gif", thumb: "https://media.giphy.com/media/l0HlvtIPdijJT1Eqc/200w.gif", alt: "Clapping" },
    { url: "https://media.giphy.com/media/3oz8xRF0v9WMAUNG1O/giphy.gif", thumb: "https://media.giphy.com/media/3oz8xRF0v9WMAUNG1O/200w.gif", alt: "Mind blown" },
    { url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif", thumb: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/200w.gif", alt: "Wow" },
    { url: "https://media.giphy.com/media/XRB1uf2F9bGOA/giphy.gif", thumb: "https://media.giphy.com/media/XRB1uf2F9bGOA/200w.gif", alt: "Excited" },
    { url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", thumb: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif", alt: "Facepalm" },
    { url: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif", thumb: "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/200w.gif", alt: "Shocked" },
    { url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif", thumb: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200w.gif", alt: "Thinking" },
  ],
  "Celebrate": [
    { url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif", thumb: "https://media.giphy.com/media/g9582DNuQppxC/200w.gif", alt: "Party" },
    { url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", thumb: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif", alt: "Confetti" },
    { url: "https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif", thumb: "https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/200w.gif", alt: "Cheers" },
    { url: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif", thumb: "https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif", alt: "Dance" },
    { url: "https://media.giphy.com/media/s2qXK8wKkNmmQ/giphy.gif", thumb: "https://media.giphy.com/media/s2qXK8wKkNmmQ/200w.gif", alt: "High five" },
    { url: "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif", thumb: "https://media.giphy.com/media/11sBLVxNs7v6WA/200w.gif", alt: "Celebration" },
  ],
  "Funny": [
    { url: "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif", thumb: "https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif", alt: "Funny" },
    { url: "https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif", thumb: "https://media.giphy.com/media/ZqlvCTNHpqrio/200w.gif", alt: "Laughing" },
    { url: "https://media.giphy.com/media/Q7ozWVYCR0nyW2rvPW/giphy.gif", thumb: "https://media.giphy.com/media/Q7ozWVYCR0nyW2rvPW/200w.gif", alt: "LOL" },
    { url: "https://media.giphy.com/media/3oEjHI8WJv4x6UPDB6/giphy.gif", thumb: "https://media.giphy.com/media/3oEjHI8WJv4x6UPDB6/200w.gif", alt: "Haha" },
    { url: "https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/giphy.gif", thumb: "https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/200w.gif", alt: "ROFL" },
    { url: "https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/giphy.gif", thumb: "https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/200w.gif", alt: "Hilarious" },
  ],
  "Love": [
    { url: "https://media.giphy.com/media/l0HlNQ03J5JxX2rTO/giphy.gif", thumb: "https://media.giphy.com/media/l0HlNQ03J5JxX2rTO/200w.gif", alt: "Heart" },
    { url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif", thumb: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif", alt: "Love" },
    { url: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif", thumb: "https://media.giphy.com/media/M90mJvfWfd5mbUuULX/200w.gif", alt: "Hug" },
    { url: "https://media.giphy.com/media/3oEjI4sFlp73fvEYgw/giphy.gif", thumb: "https://media.giphy.com/media/3oEjI4sFlp73fvEYgw/200w.gif", alt: "Kiss" },
    { url: "https://media.giphy.com/media/l4pTdcifPZLpDjL1e/giphy.gif", thumb: "https://media.giphy.com/media/l4pTdcifPZLpDjL1e/200w.gif", alt: "Grateful" },
    { url: "https://media.giphy.com/media/xTiTnMjBKwMG2NVtPW/giphy.gif", thumb: "https://media.giphy.com/media/xTiTnMjBKwMG2NVtPW/200w.gif", alt: "Thank you" },
  ],
  "Work": [
    { url: "https://media.giphy.com/media/BpGWitbFZflfSUYuZ9/giphy.gif", thumb: "https://media.giphy.com/media/BpGWitbFZflfSUYuZ9/200w.gif", alt: "Coding" },
    { url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", thumb: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif", alt: "Typing" },
    { url: "https://media.giphy.com/media/3o7btNhMBytxAM6YBa/giphy.gif", thumb: "https://media.giphy.com/media/3o7btNhMBytxAM6YBa/200w.gif", alt: "Working" },
    { url: "https://media.giphy.com/media/l46CyJmS9KUbokzsI/giphy.gif", thumb: "https://media.giphy.com/media/l46CyJmS9KUbokzsI/200w.gif", alt: "Busy" },
    { url: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif", thumb: "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/200w.gif", alt: "Done" },
    { url: "https://media.giphy.com/media/l0Iy69RBORbNJn9ew/giphy.gif", thumb: "https://media.giphy.com/media/l0Iy69RBORbNJn9ew/200w.gif", alt: "Coffee" },
  ],
  "Greetings": [
    { url: "https://media.giphy.com/media/Vbtc9VG51NtzT1Qnv1/giphy.gif", thumb: "https://media.giphy.com/media/Vbtc9VG51NtzT1Qnv1/200w.gif", alt: "Hello" },
    { url: "https://media.giphy.com/media/3ornk57KwDXf81rjWM/giphy.gif", thumb: "https://media.giphy.com/media/3ornk57KwDXf81rjWM/200w.gif", alt: "Hi" },
    { url: "https://media.giphy.com/media/42D3CxaINsAFemFuId/giphy.gif", thumb: "https://media.giphy.com/media/42D3CxaINsAFemFuId/200w.gif", alt: "Wave" },
    { url: "https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif", thumb: "https://media.giphy.com/media/ASd0Ukj0y3qMM/200w.gif", alt: "Goodbye" },
    { url: "https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/giphy.gif", thumb: "https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/200w.gif", alt: "Good morning" },
    { url: "https://media.giphy.com/media/KzDqC8LvVC4lshCcGK/giphy.gif", thumb: "https://media.giphy.com/media/KzDqC8LvVC4lshCcGK/200w.gif", alt: "Good night" },
  ],
  "Animals": [
    { url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif", thumb: "https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif", alt: "Cat typing" },
    { url: "https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif", thumb: "https://media.giphy.com/media/mCRJDo24UvJMA/200w.gif", alt: "Dog" },
    { url: "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif", thumb: "https://media.giphy.com/media/mlvseq9yvZhba/200w.gif", alt: "Cat" },
    { url: "https://media.giphy.com/media/W80Y9y1XwiL84/giphy.gif", thumb: "https://media.giphy.com/media/W80Y9y1XwiL84/200w.gif", alt: "Puppy" },
    { url: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif", thumb: "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/200w.gif", alt: "Cute animal" },
    { url: "https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/giphy.gif", thumb: "https://media.giphy.com/media/cfuL5gqFDreXxkWQ4o/200w.gif", alt: "Panda" },
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  Reactions: "😮",
  Celebrate: "🎉",
  Funny: "😂",
  Love: "❤️",
  Work: "💼",
  Greetings: "👋",
  Animals: "🐶",
};

// Optional: Tenor API search for custom queries
const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY;

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string };
    tinygif?: { url: string };
  };
}

export function GifPicker({ onSelect }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Reactions");
  const [searchResults, setSearchResults] = useState<Array<{ url: string; thumb: string; alt: string }> | null>(null);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search with Tenor API if available, otherwise filter built-in
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }

    // If Tenor API key is available, use it for search
    if (TENOR_API_KEY) {
      setLoading(true);
      try {
        const res = await fetch(
          `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(q.trim())}&limit=20&media_filter=gif,tinygif`
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || []).map((gif: TenorGif) => ({
            url: gif.media_formats.gif?.url || gif.media_formats.tinygif?.url || "",
            thumb: gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || "",
            alt: gif.title || q,
          })).filter((g: { url: string }) => g.url);
          setSearchResults(results);
          setLoading(false);
          return;
        }
      } catch { /* fall through to local search */ }
      setLoading(false);
    }

    // Local search: filter built-in GIFs by category name or alt text
    const lq = q.toLowerCase();
    const results: Array<{ url: string; thumb: string; alt: string }> = [];
    for (const [cat, gifs] of Object.entries(GIF_CATEGORIES)) {
      if (cat.toLowerCase().includes(lq)) {
        results.push(...gifs);
      } else {
        results.push(...gifs.filter((g) => g.alt.toLowerCase().includes(lq)));
      }
    }
    setSearchResults(results.length > 0 ? results : []);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, handleSearch]);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const displayGifs = searchResults !== null ? searchResults : GIF_CATEGORIES[category] || [];

  return (
    <>
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={TENOR_API_KEY ? "Search GIFs..." : "Search categories..."}
            className="w-full h-8 pl-8 pr-3 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
          />
        </div>
      </div>

      {/* Category tabs */}
      {searchResults === null && (
        <div className="flex items-center gap-0.5 px-2 pb-1 shrink-0 overflow-x-auto scrollbar-none">
          {Object.keys(GIF_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`p-1.5 rounded-lg text-sm transition-colors shrink-0 ${category === cat ? "bg-[#EBF5FF]" : "hover:bg-[#F1F5F9]"}`}
              title={cat}
            >
              {CATEGORY_ICONS[cat] || "?"}
            </button>
          ))}
        </div>
      )}

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
        {loading ? (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#F1F5F9] rounded-lg animate-pulse" style={{ height: 100 }} />
            ))}
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#94A3B8] text-[12px]">
            No GIFs found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {displayGifs.map((gif, i) => (
              <button
                key={`${gif.url}-${i}`}
                onClick={() => onSelect(gif.url)}
                className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[#2E86C1] active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
              >
                <img
                  src={gif.thumb}
                  alt={gif.alt}
                  className="w-full h-[100px] object-cover bg-[#F1F5F9]"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#F1F5F9] flex items-center justify-between shrink-0">
        <span className="text-[10px] text-[#94A3B8]">{searchResults !== null ? "Search results" : category}</span>
        <span className="text-[10px] text-[#CBD5E1]">Click to send</span>
      </div>
    </>
  );
}
