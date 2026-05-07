import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useLang } from "@/contexts/lang";
import { Grid3X3 } from "lucide-react";

interface GenreMeta {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  count: number;
}

export default function Genres() {
  const { t, isAr } = useLang();
  const [genres, setGenres] = useState<GenreMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/genres")
      .then((r) => r.json())
      .then((data: GenreMeta[]) => { setGenres(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-10 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-white flex items-center gap-3 mb-3">
          <Grid3X3 className="text-primary" size={36} />
          {t("تصفح حسب الفئة", "Browse by Genre")}
        </h1>
        <p className="text-muted-foreground text-base">
          {t("اختر فئتك المفضلة واستمتع بمئات الأفلام والمسلسلات المصنفة بدقة", "Choose your favourite genre and explore hundreds of curated titles.")}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {genres.map((genre, i) => (
            <motion.div
              key={genre.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <Link href={`/genre/${genre.id}`}>
                <div className="group relative h-32 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer overflow-hidden active:scale-95">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="text-4xl">{genre.icon}</span>
                  <span className="text-white font-semibold text-sm md:text-base group-hover:text-primary transition-colors">
                    {isAr ? genre.nameAr : genre.nameEn}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {genre.count}+ {t("عنوان", "titles")}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
