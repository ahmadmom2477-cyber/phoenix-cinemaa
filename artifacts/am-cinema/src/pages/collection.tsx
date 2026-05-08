import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Film, Play, Star, ChevronLeft, Layers } from "lucide-react";
import { useLang } from "@/contexts/lang";
import { COLLECTIONS } from "@/data/collections-data";

interface MediaItem {
  imdbId: string;
  title: string;
  poster?: string | null;
  year?: string | null;
  imdbRating?: string | null;
  type?: string;
}

function MediaCard({ item, i }: { item: MediaItem; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.06 }}
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
              <Film size={32} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
              <Play fill="currentColor" size={20} className="ml-1" />
            </div>
          </div>
          {item.imdbRating && item.imdbRating !== "N/A" && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-primary">
              <Star size={9} fill="currentColor" />
              {item.imdbRating}
            </div>
          )}
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-medium text-white/90 uppercase tracking-wider">
            {item.year}
          </div>
        </div>
        <h3 className="text-white font-medium text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
      </Link>
    </motion.div>
  );
}

export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const { isAr } = useLang();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const collection = COLLECTIONS.find((c) => c.id === id);

  useEffect(() => {
    if (!collection) return;
    setLoading(true);
    setItems([]);

    Promise.allSettled(
      collection.imdbIds.map((imdbId) =>
        fetch(`/api/media/${imdbId}`)
          .then((r) => r.json())
          .then((d: MediaItem) => d)
      )
    ).then((results) => {
      const loaded = results
        .filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<MediaItem>).value?.imdbId)
        .map((r) => (r as PromiseFulfilledResult<MediaItem>).value);
      setItems(loaded);
      setLoading(false);
    });
  }, [id]);

  if (!collection) {
    return (
      <div className="flex-1 flex items-center justify-center pt-20">
        <div className="text-center">
          <Film size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-serif text-white mb-2">
            {isAr ? "المجموعة غير موجودة" : "Collection not found"}
          </h2>
          <Link href="/collections" className="text-primary hover:underline text-sm">
            {isAr ? "← العودة للمجموعات" : "← Back to Collections"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-12">
      <section className={`relative w-full pt-24 pb-12 overflow-hidden bg-gradient-to-br ${collection.color}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="container max-w-7xl mx-auto px-4 md:px-8 relative z-10">
          <Link
            href="/collections"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors mb-6"
          >
            <ChevronLeft size={16} />
            {isAr ? "المجموعات" : "Collections"}
          </Link>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-5xl">{collection.icon}</span>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-primary mb-2 uppercase tracking-widest">
                <Layers size={12} />
                {isAr ? "مجموعة" : "Collection"}
              </div>
              <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white leading-tight">
                {isAr ? collection.nameAr : collection.nameEn}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {collection.imdbIds.length} {isAr ? "عمل في هذه السلسلة" : "titles in this franchise"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto px-4 md:px-8 mt-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: collection.imdbIds.length }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item, i) => (
              <MediaCard key={item.imdbId} item={item} i={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
