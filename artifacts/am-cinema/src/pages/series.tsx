import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Tv, Play, Star, TrendingUp, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useGetTrendingSeries } from "@workspace/api-client-react";
import { useLang } from "@/contexts/lang";
import { GENRES } from "@/data/genres-client";

interface MediaItem {
  imdbId: string;
  title: string;
  poster?: string | null;
  year?: string | null;
  imdbRating?: string | null;
  type?: string;
}

function SeriesCard({ item, i }: { item: MediaItem; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.06 }}
      className="snap-start flex-shrink-0 w-[150px] md:w-[200px]"
    >
      <Link href={`/watch/${item.imdbId}`} className="group block">
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-xl shadow-black/40 mb-3">
          {item.poster && item.poster !== "N/A" ? (
            <img
              src={item.poster}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Tv size={32} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <Play fill="currentColor" size={20} className="ml-1" />
            </div>
          </div>
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-medium text-white/90 uppercase tracking-wider">
            TV
          </div>
          {item.imdbRating && item.imdbRating !== "N/A" && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-primary">
              <Star size={9} fill="currentColor" />
              {item.imdbRating}
            </div>
          )}
        </div>
        <h3 className="text-white font-medium text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-muted-foreground text-xs mt-0.5">{item.year}</p>
      </Link>
    </motion.div>
  );
}

function GenreRow({ genreId }: { genreId: string }) {
  const { isAr } = useLang();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const genre = GENRES.find((g) => g.id === genreId);

  useEffect(() => {
    if (!genre) return;
    setLoading(true);
    fetch(`/api/genre/${genreId}?page=1&limit=12`)
      .then((r) => r.json())
      .then((d: { items: MediaItem[] }) => {
        setItems((d.items ?? []).filter((item) => item.type === "series"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [genreId]);

  if (!genre || (!loading && items.length === 0)) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-serif font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">{genre.icon}</span>
          {isAr ? genre.nameAr : genre.nameEn}
        </h2>
        <Link
          href={`/genre/${genreId}`}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
        >
          {isAr ? "الكل" : "See all"}
          <ChevronRight size={16} />
        </Link>
      </div>
      <div className="relative">
        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="min-w-[150px] md:min-w-[200px] aspect-[2/3] bg-white/5 rounded-xl animate-pulse flex-shrink-0" />
              ))
            : items.map((item, i) => <SeriesCard key={item.imdbId} item={item} i={i} />)}
        </div>
        <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none hidden md:block" />
      </div>
    </section>
  );
}

const SERIES_GENRES = ["drama", "crime", "thriller", "comedy", "fantasy", "mystery", "history", "documentary"];

export default function SeriesPage() {
  const { t } = useLang();
  const { data: trending, isLoading } = useGetTrendingSeries();
  const hero = trending?.results?.[0];

  return (
    <div className="flex-1 flex flex-col pb-20">
      {/* Hero */}
      <section className="relative w-full h-[45vh] min-h-[340px] flex items-end pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-black z-0">
          {hero?.poster && hero.poster !== "N/A" ? (
            <img src={hero.poster} alt="Hero" className="w-full h-full object-cover opacity-35 object-top" />
          ) : (
            <div className="w-full h-full bg-white/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        </div>
        <div className="container max-w-7xl mx-auto px-4 md:px-8 relative z-10 w-full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-primary mb-4 uppercase tracking-widest">
              <Tv size={14} />
              <span>{t("مسلسلات", "Series")}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-4 leading-tight">
              {t("استكشف المسلسلات", "Explore Series")}
            </h1>
            {hero && (
              <Link
                href={`/watch/${hero.imdbId}`}
                className="inline-flex items-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/20"
              >
                <Play fill="currentColor" size={16} />
                <span>{t("شاهد الآن", "Watch Now")}: {hero.title}</span>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-16">
        {/* Trending */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="text-primary" size={22} />
            <h2 className="text-xl md:text-2xl font-serif font-semibold text-white">
              {t("مسلسلات رائجة", "Trending Series")}
            </h2>
          </div>
          <div className="relative">
            <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="min-w-[150px] md:min-w-[200px] aspect-[2/3] bg-white/5 rounded-xl animate-pulse flex-shrink-0" />
                  ))
                : trending?.results?.map((series, i) => <SeriesCard key={series.imdbId} item={series} i={i} />)}
            </div>
            <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none hidden md:block" />
          </div>
        </section>

        {SERIES_GENRES.map((gId) => (
          <GenreRow key={gId} genreId={gId} />
        ))}
      </div>
    </div>
  );
}
