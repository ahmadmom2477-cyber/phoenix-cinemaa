import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useSearchMedia, getSearchMediaQueryKey } from "@workspace/api-client-react";
import { Film, Search, X, TrendingUp, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_SEARCHES = [
  { label: "Action", query: "action" },
  { label: "Thriller", query: "thriller" },
  { label: "Sci-Fi", query: "science fiction" },
  { label: "Horror", query: "horror" },
  { label: "Comedy", query: "comedy" },
  { label: "Drama", query: "drama" },
  { label: "Documentary", query: "documentary" },
  { label: "Animation", query: "animation" },
];

const TRENDING_PICKS = [
  { title: "Breaking Bad", imdbId: "tt0903747" },
  { title: "Inception", imdbId: "tt1375666" },
  { title: "The Dark Knight", imdbId: "tt0468569" },
  { title: "Game of Thrones", imdbId: "tt0944947" },
  { title: "Interstellar", imdbId: "tt0816692" },
  { title: "Peaky Blinders", imdbId: "tt2442560" },
];

type FilterType = "all" | "movie" | "series";
type FilterDecade = "all" | "2020s" | "2010s" | "2000s" | "1990s" | "1980s";
type FilterRating = "all" | "5" | "6" | "7" | "8" | "9";

interface MediaResult {
  imdbId: string;
  poster?: string | null;
  title: string;
  type: string;
  year: string;
  imdbRating?: string | null;
}

function matchesDecade(year: string, decade: FilterDecade): boolean {
  if (decade === "all") return true;
  const y = parseInt(year?.split("–")[0] ?? "0", 10);
  if (decade === "2020s") return y >= 2020;
  if (decade === "2010s") return y >= 2010 && y < 2020;
  if (decade === "2000s") return y >= 2000 && y < 2010;
  if (decade === "1990s") return y >= 1990 && y < 2000;
  if (decade === "1980s") return y >= 1980 && y < 1990;
  return true;
}

function matchesRating(rating: string | null | undefined, minRating: FilterRating): boolean {
  if (minRating === "all") return true;
  const r = parseFloat(rating ?? "0");
  return r >= parseFloat(minRating);
}

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const rawSearch = useSearch();
  const q = new URLSearchParams(rawSearch).get("q") || "";

  const [inputValue, setInputValue] = useState(q);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterDecade, setFilterDecade] = useState<FilterDecade>("all");
  const [filterRating, setFilterRating] = useState<FilterRating>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInputValue(q); }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const mediaSearchParams = { q };
  const { data, isLoading } = useSearchMedia(
    mediaSearchParams,
    { query: { enabled: !!q, queryKey: getSearchMediaQueryKey(mediaSearchParams) } }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setLocation(`/search?q=${encodeURIComponent(inputValue.trim())}`);
    }
  };

  const allResults: MediaResult[] = data?.results
    ? Array.from(new Map(data.results.map((r: MediaResult) => [r.imdbId, r])).values())
    : [];

  const filtered = allResults.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (!matchesDecade(item.year, filterDecade)) return false;
    if (!matchesRating(item.imdbRating, filterRating)) return false;
    return true;
  });

  const hasActiveFilters = filterType !== "all" || filterDecade !== "all" || filterRating !== "all";

  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-8 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 gap-3 focus-within:border-primary/40 transition-colors">
            <Search size={18} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search movies, series, or directors..."
              className="bg-transparent border-none outline-none text-sm md:text-base w-full text-white placeholder:text-muted-foreground/60"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus={!q}
            />
            {inputValue && (
              <button type="button" onClick={() => setInputValue("")} className="text-muted-foreground hover:text-white transition-colors shrink-0 p-1">
                <X size={16} />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground/50 border border-white/10 shrink-0">⌘K</kbd>
          </div>
        </form>

        {/* Filter bar */}
        {q && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${hasActiveFilters ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"}`}
            >
              <SlidersHorizontal size={12} />
              Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => { setFilterType("all"); setFilterDecade("all"); setFilterRating("all"); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-colors"
              >
                <X size={10} /> Clear filters
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {q && showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                {/* Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Type</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "movie", "series"] as FilterType[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setFilterType(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${filterType === v ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"}`}
                      >
                        {v === "all" ? "All" : v === "movie" ? "Movies" : "Series"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Decade */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Era</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "2020s", "2010s", "2000s", "1990s", "1980s"] as FilterDecade[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setFilterDecade(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterDecade === v ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"}`}
                      >
                        {v === "all" ? "Any Era" : v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Min Rating</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "5", "6", "7", "8", "9"] as FilterRating[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setFilterRating(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterRating === v ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"}`}
                      >
                        {v === "all" ? "Any" : `★ ${v}+`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {q && (
          <div className="mt-4">
            <h1 className="text-xl md:text-3xl font-serif font-semibold text-white">
              Results for <span className="text-primary">"{q}"</span>
            </h1>
            {filtered.length > 0 && (
              <p className="text-muted-foreground text-sm mt-1">
                {filtered.length} title{filtered.length !== 1 ? "s" : ""}
                {hasActiveFilters ? " (filtered)" : " found"}
              </p>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !q ? (
        <div className="space-y-12">
          <section>
            <h2 className="text-lg font-serif font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Browse by genre
            </h2>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((s) => (
                <button
                  key={s.query}
                  onClick={() => setLocation(`/search?q=${encodeURIComponent(s.query)}`)}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-primary/20 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-serif font-semibold text-white mb-4 flex items-center gap-2">
              <Film size={18} className="text-primary" />
              Curated picks
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TRENDING_PICKS.map((pick, i) => (
                <motion.div key={pick.imdbId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.06 }}>
                  <Link href={`/watch/${pick.imdbId}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Film size={14} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors truncate">{pick.title}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="text-center pt-4">
            <p className="text-muted-foreground/50 text-sm">Search for any movie or TV series to get started.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 text-muted-foreground">
            <Film size={32} />
          </div>
          <h2 className="text-xl font-serif text-white mb-2">
            {allResults.length === 0 ? "No results found" : "No results match your filters"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            {allResults.length === 0
              ? `We couldn't find anything matching "${q}". Try different keywords.`
              : "Try adjusting or clearing the filters above."}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={() => { setFilterType("all"); setFilterDecade("all"); setFilterRating("all"); }}
              className="px-5 py-2 rounded-full bg-primary/20 border border-primary/40 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
            >
              Clear all filters
            </button>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {POPULAR_SEARCHES.slice(0, 4).map((s) => (
                <button key={s.query} onClick={() => setLocation(`/search?q=${encodeURIComponent(s.query)}`)} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-primary/20 hover:border-primary/40 hover:text-primary transition-colors">
                  Try: {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {filtered.map((item, i) => (
            <motion.a
              href={`/watch/${item.imdbId}`}
              key={item.imdbId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group flex flex-col gap-2"
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-xl shadow-black/40 border border-white/10 active:scale-95 transition-transform">
                {item.poster && item.poster !== "N/A" ? (
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film size={32} /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-medium text-white/90 uppercase tracking-wider">
                  {item.type}
                </div>
                {item.imdbRating && item.imdbRating !== "N/A" && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-semibold text-primary">
                    ★ {item.imdbRating}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-white font-medium text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-muted-foreground text-xs mt-0.5">{item.year}</p>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}
