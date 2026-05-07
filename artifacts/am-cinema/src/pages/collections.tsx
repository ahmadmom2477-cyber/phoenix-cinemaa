import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Layers } from "lucide-react";
import { useLang } from "@/contexts/lang";
import { COLLECTIONS, type Collection } from "@/data/collections-data";

interface MediaItem {
  imdbId: string;
  poster?: string | null;
}

function CollectionCard({ col }: { col: Collection }) {
  const { isAr } = useLang();
  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    const first3 = col.imdbIds.slice(0, 3);
    Promise.allSettled(
      first3.map((id) =>
        fetch(`/api/media/${id}`)
          .then((r) => r.json())
          .then((d: { poster?: string | null }) => d.poster || null)
      )
    ).then((results) => {
      const urls = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => (r as PromiseFulfilledResult<string>).value);
      setPosters(urls);
    });
  }, [col.id]);

  return (
    <Link href={`/collection/${col.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className={`group relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br ${col.color} p-5 cursor-pointer hover:border-white/20 transition-all hover:scale-[1.02]`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-3xl mb-2 block">{col.icon}</span>
            <h3 className="text-white font-serif font-bold text-lg leading-tight">
              {isAr ? col.nameAr : col.nameEn}
            </h3>
            <p className="text-muted-foreground text-xs mt-1">
              {col.imdbIds.length} {isAr ? "عمل" : "titles"}
            </p>
          </div>
          <ChevronRight size={18} className="text-white/30 group-hover:text-white/70 transition-colors mt-1" />
        </div>
        <div className="flex gap-2">
          {posters.slice(0, 3).map((poster, i) => (
            <div
              key={i}
              className="flex-1 aspect-[2/3] rounded-lg overflow-hidden bg-white/5"
              style={{ transform: `rotate(${(i - 1) * 2}deg)` }}
            >
              <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
          {posters.length === 0 &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 aspect-[2/3] rounded-lg bg-white/5 animate-pulse" />
            ))}
        </div>
      </motion.div>
    </Link>
  );
}

export default function CollectionsPage() {
  const { t } = useLang();
  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-primary mb-4 uppercase tracking-widest">
          <Layers size={12} />
          {t("المجموعات", "Collections")}
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3">
          {t("مجموعات الأفلام", "Movie Collections")}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl">
          {t("اكتشف أشهر سلاسل الأفلام في مكان واحد", "Discover the most iconic film franchises in one place")}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {COLLECTIONS.map((col) => (
          <CollectionCard key={col.id} col={col} />
        ))}
      </div>
    </div>
  );
}
