import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Star, ChevronLeft, Loader2, Play } from "lucide-react";
import { useLang } from "@/contexts/lang";

interface MediaItem {
  imdbId: string;
  title: string;
  year: string;
  type: string;
  poster: string | null;
  imdbRating: string | null;
  genre: string | null;
}

interface GenreResponse {
  genre: { id: string; nameEn: string; nameAr: string; icon: string };
  items: MediaItem[];
  total: number;
  page: number;
  pages: number;
}

export default function Genre() {
  const { name } = useParams<{ name: string }>();
  const { t, isAr } = useLang();
  const [data, setData] = useState<GenreResponse | null>(null);
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setAllItems([]);
    setPage(1);
    fetch(`/api/genre/${name}?page=1&limit=20`)
      .then((r) => r.json())
      .then((d: GenreResponse) => {
        setData(d);
        setAllItems(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [name]);

  const loadMore = () => {
    if (!data || page >= data.pages) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    fetch(`/api/genre/${name}?page=${nextPage}&limit=20`)
      .then((r) => r.json())
      .then((d: GenreResponse) => {
        setAllItems((prev) => [...prev, ...d.items]);
        setData(d);
        setPage(nextPage);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="h-12 w-48 bg-white/5 rounded-xl animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center pt-24">
        <div className="text-center">
          <p className="text-muted-foreground">{t("الفئة غير موجودة", "Genre not found")}</p>
          <Link href="/genres" className="text-primary hover:underline mt-2 block">{t("العودة للفئات", "Back to genres")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6 self-start group"
      >
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </div>
        <span className="text-sm font-medium">{t("رجوع", "Back")}</span>
      </button>

      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-white flex items-center gap-3 mb-2">
          <span className="text-4xl">{data.genre.icon}</span>
          {isAr ? data.genre.nameAr : data.genre.nameEn}
        </h1>
        <p className="text-muted-foreground">
          {data.total} {t("عنوان مصنف بدقة", "carefully classified titles")}
        </p>
      </div>

      <AnimatePresence>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
          {allItems.map((item, i) => (
            <motion.div
              key={item.imdbId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 10) * 0.05 }}
            >
              <Link href={`/watch/${item.imdbId}`} className="group block">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-xl shadow-black/40 mb-3 active:scale-95 transition-transform">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Film size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <Play fill="currentColor" size={18} className="ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-medium text-white/90 uppercase tracking-wider">
                    {item.type}
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
          ))}
        </div>
      </AnimatePresence>

      {data && page < data.pages && (
        <div className="flex justify-center mt-10">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-medium transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <><Loader2 size={16} className="animate-spin" /> {t("جاري التحميل...", "Loading...")}</>
            ) : (
              t("تحميل المزيد", "Load More")
            )}
          </button>
        </div>
      )}
    </div>
  );
}
