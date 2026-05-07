import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Bookmark, Film, Tv, Play, Star, Trash2, BookmarkX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/lang";
import { getWatchlist, removeFromWatchlist, type WatchlistItem } from "@/hooks/use-watchlist";

export default function WatchlistPage() {
  const { t } = useLang();
  const [items, setItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    setItems(getWatchlist());
  }, []);

  const handleRemove = (e: React.MouseEvent, imdbId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromWatchlist(imdbId);
    setItems(getWatchlist());
  };

  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Bookmark className="text-primary" size={28} />
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
            {t("قائمتي", "My Watchlist")}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {items.length > 0
            ? `${items.length} ${t("عنوان محفوظ", items.length === 1 ? "title saved" : "titles saved")}`
            : t("لم تحفظ أي عناوين بعد", "No titles saved yet")}
        </p>
      </div>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center text-center py-24"
        >
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-muted-foreground">
            <BookmarkX size={40} />
          </div>
          <h2 className="text-xl font-serif text-white mb-2">
            {t("قائمتك فارغة", "Your watchlist is empty")}
          </h2>
          <p className="text-muted-foreground max-w-sm mb-8">
            {t(
              'أضف أفلاماً ومسلسلات عن طريق الضغط على أيقونة الحفظ في صفحة المشاهدة',
              'Save movies and series by clicking the bookmark icon on any watch page'
            )}
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all hover:scale-105"
          >
            {t("استكشف المحتوى", "Browse Content")}
          </Link>
        </motion.div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {items.map((item, i) => (
              <motion.div
                key={item.imdbId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.05 }}
                className="relative group/card"
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
                        {item.type === "series" ? <Tv size={32} /> : <Film size={32} />}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        <Play fill="currentColor" size={20} className="ml-1" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-medium text-white/90 uppercase tracking-wider">
                      {item.type === "series" ? "TV" : "Film"}
                    </div>
                    {item.imdbRating && item.imdbRating !== "N/A" && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-primary">
                        <Star size={9} fill="currentColor" />
                        {item.imdbRating}
                      </div>
                    )}
                    <button
                      onClick={(e) => handleRemove(e, item.imdbId)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white/70 hover:text-red-400 hover:bg-black/90 transition-colors flex items-center justify-center opacity-0 group-hover/card:opacity-100"
                      title={t("إزالة من القائمة", "Remove from watchlist")}
                    >
                      <Trash2 size={12} />
                    </button>
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
      )}
    </div>
  );
}
