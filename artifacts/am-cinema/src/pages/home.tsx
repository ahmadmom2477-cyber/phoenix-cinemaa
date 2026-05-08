import { useState, useEffect } from "react";
import { useGetTrendingMovies, useGetTrendingSeries } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Play, TrendingUp, Tv, Film, Star, History, X, Sparkles, Grid3X3, ChevronRight, Info, Flame, Trophy, Clapperboard, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getWatchHistory, removeFromWatchHistory, type WatchHistoryItem } from "@/hooks/use-watch-history";
import { useLang } from "@/contexts/lang";
import { GENRES } from "@/data/genres-client";

interface MediaCardItem {
  imdbId: string;
  title: string;
  poster?: string | null;
  year?: string | null;
  imdbRating?: string | null;
  genre?: string | null;
  type?: string;
}

function SectionHeader({ icon, title, inline = false, href }: { icon: React.ReactNode; title: string; inline?: boolean; href?: string }) {
  const linkEl = href ? (
    <Link href={href} className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors font-medium shrink-0 ml-2">
      <span>الكل</span>
      <ChevronRight size={13} />
    </Link>
  ) : null;

  if (inline) return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2 className="text-lg sm:text-xl md:text-2xl font-serif font-semibold text-white">{title}</h2>
      {linkEl}
    </div>
  );
  return (
    <div className="flex items-center gap-2.5 mb-5 md:mb-6">
      {icon}
      <h2 className="text-lg sm:text-xl md:text-2xl font-serif font-semibold text-white">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-1" />
      {linkEl}
    </div>
  );
}

function FadeEdge() {
  return <div className="absolute top-0 right-0 bottom-0 w-12 md:w-20 bg-gradient-to-l from-background to-transparent pointer-events-none hidden sm:block" />;
}

function MediaCard({ item, i, size = "md" }: { item: MediaCardItem; i: number; size?: "sm" | "md" }) {
  const cardW = size === "sm"
    ? "w-[110px] sm:w-[130px] md:w-[160px]"
    : "w-[130px] sm:w-[155px] md:w-[200px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.35) }}
      className={`snap-start flex-shrink-0 ${cardW}`}
    >
      <Link href={`/watch/${item.imdbId}`} className="group block">
        <div className="relative aspect-[2/3] rounded-xl md:rounded-2xl overflow-hidden bg-white/[0.04] shadow-xl shadow-black/50 border border-white/[0.08] mb-2.5">
          {item.poster && item.poster !== "N/A" ? (
            <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {item.type === "series" ? <Tv size={28} /> : <Film size={28} />}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
              <Play fill="currentColor" size={16} className="ml-0.5" />
            </div>
          </div>
          {item.imdbRating && item.imdbRating !== "N/A" && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/10 text-[9px] md:text-[10px] font-bold text-primary">
              <Star size={7} fill="currentColor" />
              {item.imdbRating}
            </div>
          )}
          {item.type === "series" && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-primary/20 backdrop-blur-sm border border-primary/30 text-[8px] md:text-[9px] font-bold text-primary">
              TV
            </div>
          )}
        </div>
        <h3 className="text-white/90 font-medium text-xs md:text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors duration-200">{item.title}</h3>
        <p className="text-[10px] md:text-xs text-muted-foreground/60 mt-0.5">{item.year}</p>
      </Link>
    </motion.div>
  );
}

function ContinueWatchingRow() {
  const { t } = useLang();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  useEffect(() => { setHistory(getWatchHistory()); }, []);
  const handleRemove = (e: React.MouseEvent, imdbId: string) => {
    e.preventDefault(); e.stopPropagation();
    removeFromWatchHistory(imdbId); setHistory(getWatchHistory());
  };
  if (history.length === 0) return null;
  return (
    <section>
      <SectionHeader icon={<History size={18} className="text-primary" />} title={t("متابعة المشاهدة", "Continue Watching")} />
      <div className="relative">
        <div className="flex overflow-x-auto gap-3 md:gap-4 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <AnimatePresence>
            {history.map((item, i) => (
              <motion.div key={item.imdbId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35, delay: i * 0.04 }} className="snap-start flex-shrink-0 w-[130px] sm:w-[155px] md:w-[200px] relative group/card">
                <Link href={`/watch/${item.imdbId}`} className="group block">
                  <div className="relative aspect-[2/3] rounded-xl md:rounded-2xl overflow-hidden bg-white/5 shadow-xl shadow-black/60 border border-white/8 mb-2.5">
                    {item.poster && item.poster !== "N/A" ? (
                      <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film size={28} /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/40">
                        <Play fill="currentColor" size={16} className="ml-0.5" />
                      </div>
                    </div>
                    {item.type === "series" && item.season && item.episode && (
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[9px] font-bold text-white border border-white/10">
                        S{item.season.padStart(2,"0")} E{item.episode.padStart(2,"0")}
                      </div>
                    )}
                    <button onClick={(e) => handleRemove(e, item.imdbId)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/80 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black transition-colors flex items-center justify-center opacity-0 group-hover/card:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                  <h3 className="text-white font-medium text-xs md:text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-0.5">{item.year}</p>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <FadeEdge />
      </div>
    </section>
  );
}

function RecommendationsRow() {
  const { t } = useLang();
  const history = getWatchHistory();
  const [recItems, setRecItems] = useState<MediaCardItem[]>([]);
  useEffect(() => {
    if (history.length === 0) return;
    const watchedIds = new Set(history.map((h) => h.imdbId));
    const genreIds: string[] = [];
    for (const genre of GENRES) {
      const unwatched = genre.imdbIds.filter((id) => !watchedIds.has(id));
      genreIds.push(...unwatched.slice(0, 4));
      if (genreIds.length >= 16) break;
    }
    const ids = genreIds.slice(0, 16);
    if (ids.length === 0) return;
    Promise.allSettled(ids.map((id) => fetch(`/api/media/${id}`).then((r) => r.json()))).then((results) => {
      const items: MediaCardItem[] = [];
      for (const r of results) { if (r.status === "fulfilled" && r.value?.imdbId) items.push(r.value as MediaCardItem); }
      setRecItems(items);
    });
  }, []);
  if (history.length === 0 || recItems.length === 0) return null;
  return (
    <section>
      <SectionHeader icon={<Sparkles size={18} className="text-primary" />} title={t("موصى به لك", "Recommended for You")} />
      <div className="relative">
        <div className="flex overflow-x-auto gap-3 md:gap-5 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {recItems.map((item, i) => <MediaCard key={item.imdbId} item={item} i={i} />)}
        </div>
        <FadeEdge />
      </div>
    </section>
  );
}

function GenresGrid() {
  const { t, isAr } = useLang();
  const [showAll, setShowAll] = useState(false);
  const visibleGenres = showAll ? GENRES : GENRES.slice(0, 12);
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <SectionHeader icon={<Grid3X3 size={18} className="text-primary" />} title={t("تصفح حسب الفئة", "Browse by Genre")} inline />
        <Link href="/genres" className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors font-medium group">
          {t("صفحة الفئات", "All Genres")}
          <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-3">
        {visibleGenres.map((genre, i) => (
          <motion.div key={genre.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link href={`/genre/${genre.id}`}>
              <div className="flex flex-col items-center gap-1.5 md:gap-2.5 p-2 md:p-4 rounded-xl md:rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-primary/50 hover:bg-primary/[0.08] transition-all duration-300 cursor-pointer active:scale-95 group">
                <span className="text-xl md:text-2xl lg:text-3xl leading-none">{genre.icon}</span>
                <span className="text-[9px] md:text-[11px] text-white/70 group-hover:text-primary transition-colors text-center leading-tight font-medium">{isAr ? genre.nameAr : genre.nameEn}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {!showAll && GENRES.length > 12 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white hover:bg-white/8 transition-colors"
        >
          {t(`عرض كل الفئات (${GENRES.length})`, `Show all genres (${GENRES.length})`)}
        </button>
      )}
    </section>
  );
}

function QuickNav() {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap gap-2 md:gap-3">
      <Link href="/search?q=action" className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 transition-all text-xs text-white/70 hover:text-primary font-medium active:scale-95">
        <Flame size={12} className="text-orange-400" />
        {t("أكشن", "Action")}
      </Link>
      <Link href="/search?q=drama" className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 transition-all text-xs text-white/70 hover:text-primary font-medium active:scale-95">
        <Clapperboard size={12} className="text-blue-400" />
        {t("دراما", "Drama")}
      </Link>
      <Link href="/search?q=comedy" className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 transition-all text-xs text-white/70 hover:text-primary font-medium active:scale-95">
        <Sparkles size={12} className="text-yellow-400" />
        {t("كوميديا", "Comedy")}
      </Link>
      <Link href="/search?q=thriller" className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/10 transition-all text-xs text-white/70 hover:text-primary font-medium active:scale-95">
        <Layers size={12} className="text-purple-400" />
        {t("إثارة", "Thriller")}
      </Link>
      <Link href="/genres" className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-muted-foreground hover:text-white font-medium active:scale-95">
        <ChevronRight size={12} />
        {t("المزيد", "More")}
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="snap-start flex-shrink-0 w-[130px] sm:w-[155px] md:w-[200px]">
      <div className="aspect-[2/3] rounded-xl md:rounded-2xl bg-white/5 animate-pulse mb-2.5 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/3 to-transparent skeleton-shimmer" />
      </div>
      <div className="h-3 bg-white/5 rounded-full animate-pulse mb-2 w-4/5" />
      <div className="h-2.5 bg-white/5 rounded-full animate-pulse w-1/2" />
    </div>
  );
}

export default function Home() {
  const { t } = useLang();
  const { data: trendingMovies, isLoading: isMoviesLoading } = useGetTrendingMovies();
  const { data: trendingSeries, isLoading: isSeriesLoading } = useGetTrendingSeries();

  const heroMovie = trendingMovies?.results?.[0];
  const heroGenres = heroMovie?.genre?.split(",").slice(0, 3).map((g: string) => g.trim()) ?? [];

  const topMovies = trendingMovies?.results?.filter((_: MediaCardItem, i: number) => i > 0 && i <= 10) ?? [];
  const topSeries = trendingSeries?.results?.slice(0, 10) ?? [];

  return (
    <div className="flex-1 flex flex-col pb-20">
      {/* ── Hero ── */}
      <section className="relative w-full h-[52vh] sm:h-[65vh] md:h-[72vh] min-h-[380px] sm:min-h-[480px] md:min-h-[560px] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-background">
          {heroMovie?.poster && heroMovie.poster !== "N/A" ? (
            <>
              <img
                src={heroMovie.poster}
                alt="Hero"
                className="w-full h-full object-cover object-top opacity-45 scale-105"
                style={{ filter: "blur(1.5px)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-background/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-background via-background to-primary/5" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(var(--color-primary-raw,251,191,36),0.06)_0%,_transparent_60%)]" />
        </div>

        <div className="container max-w-7xl mx-auto px-4 md:px-8 relative z-10 w-full pb-10 md:pb-20">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }} className="max-w-2xl">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 backdrop-blur-md border border-primary/25 text-[10px] md:text-xs font-semibold text-primary mb-3 md:mb-5 uppercase tracking-widest">
              <TrendingUp size={11} />
              <span>{t("الأكثر مشاهدة", "Trending Now")}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-serif font-bold text-white mb-2 md:mb-4 leading-[1.05] tracking-tight line-clamp-2">
              {heroMovie ? heroMovie.title : t("تجربة سينمائية غامرة", "Immersive Cinematic Experience")}
            </h1>

            {heroMovie && (
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3 md:mb-5">
                {heroMovie.year && (
                  <span className="text-xs md:text-sm text-white/60 font-medium">{heroMovie.year}</span>
                )}
                {heroMovie.imdbRating && heroMovie.imdbRating !== "N/A" && (
                  <div className="flex items-center gap-1 text-xs md:text-sm font-semibold text-primary">
                    <Star size={11} fill="currentColor" />
                    <span>{heroMovie.imdbRating}</span>
                    <span className="text-white/30 font-normal">/10</span>
                  </div>
                )}
                {heroGenres.map((g: string) => (
                  <span key={g} className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/60 font-medium">
                    {g}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm md:text-base text-white/60 mb-5 md:mb-8 max-w-xl leading-relaxed line-clamp-2">
              {heroMovie?.plot ?? t("ادخل إلى عالم الأفلام واستمتع بأروع القصص السينمائية", "Step into a private screening room. Discover and stream the world's most captivating stories.")}
            </p>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {heroMovie ? (
                <>
                  <Link
                    href={`/watch/${heroMovie.imdbId}`}
                    className="inline-flex items-center gap-2 md:gap-3 px-5 md:px-7 py-2.5 md:py-3.5 bg-primary text-primary-foreground rounded-full font-semibold text-sm hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/25 active:scale-100"
                  >
                    <Play fill="currentColor" size={14} />
                    <span>{t("شاهد الآن", "Watch Now")}</span>
                  </Link>
                  <Link
                    href={`/watch/${heroMovie.imdbId}`}
                    className="inline-flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3.5 bg-white/8 hover:bg-white/14 border border-white/12 rounded-full text-white/80 hover:text-white font-medium text-sm transition-all backdrop-blur-sm"
                  >
                    <Info size={13} />
                    <span>{t("تفاصيل", "Details")}</span>
                  </Link>
                </>
              ) : (
                <div className="flex gap-2">
                  <div className="h-10 w-32 bg-white/8 rounded-full animate-pulse" />
                  <div className="h-10 w-24 bg-white/5 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="container max-w-7xl mx-auto px-4 md:px-8 mt-8 md:mt-12 space-y-12 md:space-y-20 relative z-20">

        {/* Quick Nav tags */}
        <div>
          <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-3">{t("تصفح سريع", "Quick Browse")}</p>
          <QuickNav />
        </div>

        <ContinueWatchingRow />
        <RecommendationsRow />

        {/* Trending Movies */}
        <section>
          <SectionHeader
            icon={<Flame size={18} className="text-orange-400" />}
            title={t("أفلام رائجة", "Trending Movies")}
            href="/search?q=trending+movies"
          />
          <div className="relative">
            <div className="flex overflow-x-auto gap-3 md:gap-5 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {isMoviesLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                : trendingMovies?.results?.map((movie: MediaCardItem, i: number) => <MediaCard key={movie.imdbId} item={movie} i={i} />)
              }
            </div>
            <FadeEdge />
          </div>
        </section>

        {/* Trending Series */}
        <section>
          <SectionHeader
            icon={<TrendingUp size={18} className="text-blue-400" />}
            title={t("مسلسلات رائجة", "Trending Series")}
            href="/search?q=trending+series"
          />
          <div className="relative">
            <div className="flex overflow-x-auto gap-3 md:gap-5 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {isSeriesLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                : trendingSeries?.results?.map((series: MediaCardItem, i: number) => <MediaCard key={series.imdbId} item={series} i={i} />)
              }
            </div>
            <FadeEdge />
          </div>
        </section>

        {/* Top Rated Movies (from trending, rated 8+) */}
        {topMovies.filter((m: MediaCardItem) => parseFloat(m.imdbRating ?? "0") >= 7.5).length > 0 && (
          <section>
            <SectionHeader
              icon={<Trophy size={18} className="text-yellow-400" />}
              title={t("أعلى تقييماً", "Top Rated")}
            />
            <div className="relative">
              <div className="flex overflow-x-auto gap-3 md:gap-5 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {topMovies
                  .filter((m: MediaCardItem) => parseFloat(m.imdbRating ?? "0") >= 7.5)
                  .sort((a: MediaCardItem, b: MediaCardItem) => parseFloat(b.imdbRating ?? "0") - parseFloat(a.imdbRating ?? "0"))
                  .map((movie: MediaCardItem, i: number) => <MediaCard key={movie.imdbId} item={movie} i={i} />)
                }
              </div>
              <FadeEdge />
            </div>
          </section>
        )}

        {/* All Genres Grid */}
        <GenresGrid />

        {/* Featured Series */}
        {topSeries.filter((s: MediaCardItem) => parseFloat(s.imdbRating ?? "0") >= 7.5).length > 0 && (
          <section>
            <SectionHeader
              icon={<Tv size={18} className="text-purple-400" />}
              title={t("مسلسلات مميزة", "Featured Series")}
            />
            <div className="relative">
              <div className="flex overflow-x-auto gap-3 md:gap-5 pb-5 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                {topSeries
                  .filter((s: MediaCardItem) => parseFloat(s.imdbRating ?? "0") >= 7.5)
                  .sort((a: MediaCardItem, b: MediaCardItem) => parseFloat(b.imdbRating ?? "0") - parseFloat(a.imdbRating ?? "0"))
                  .map((series: MediaCardItem, i: number) => <MediaCard key={series.imdbId} item={series} i={i} />)
                }
              </div>
              <FadeEdge />
            </div>
          </section>
        )}

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-3 md:gap-6 py-8 md:py-10 border-t border-b border-white/5"
        >
          {[
            { num: "+١٠٠٠", label: t("فيلم ومسلسل", "Movies & Series"), icon: "🎬" },
            { num: "٥", label: t("مصادر تشغيل", "Streaming Sources"), icon: "📡" },
            { num: "٢٤/٧", label: t("متاح دائماً", "Always Available"), icon: "⚡" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-xl md:text-3xl mb-1">{stat.icon}</div>
              <div className="text-lg md:text-2xl font-bold text-white font-serif">{stat.num}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
