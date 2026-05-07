import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import {
  Film, Code2, Heart, Settings2, Layers, Subtitles,
  Bookmark, Search, Globe, Zap, BadgeDollarSign, Play,
} from "lucide-react";
import { useLang } from "@/contexts/lang";

const WHY_US = [
  {
    icon: Layers,
    titleAr: "5 مصادر تشغيل مختلفة",
    titleEn: "5 Streaming Sources",
    descAr: "إذا انقطع مصدر، نتحول للتالي تلقائياً — لا توقف ولا تقطع أثناء المشاهدة.",
    descEn: "If one source fails, we switch automatically — zero interruptions.",
  },
  {
    icon: BadgeDollarSign,
    titleAr: "3 مشاهدات مجانية ثم 10 ريال فقط",
    titleEn: "3 Free Watches — then just 10 SAR",
    descAr: "جرّب التطبيق قبل الاشتراك. وعند الاشتراك السعر رمزي للغاية مقارنة بالمنافسين.",
    descEn: "Try before you subscribe. The price is unbeatable compared to competitors.",
  },
  {
    icon: Globe,
    titleAr: "عربي وإنجليزي بالكامل",
    titleEn: "Full Arabic & English Support",
    descAr: "الواجهة والمحتوى يدعمان اللغتين — لكل المستخدمين.",
    descEn: "The interface and content support both languages for all users.",
  },
  {
    icon: Subtitles,
    titleAr: "ترجمات تلقائية + رفع يدوي",
    titleEn: "Auto-subtitles + Manual Upload",
    descAr: "ترجمة تلقائية للأفلام، أو ارفع ملف SRT خاص بك في ثوانٍ.",
    descEn: "Auto-subtitles for movies, or upload your own SRT file in seconds.",
  },
  {
    icon: Search,
    titleAr: "بحث فوري وفلترة متقدمة",
    titleEn: "Instant Search & Advanced Filters",
    descAr: "ابحث عن أي فيلم أو مسلسل بالعربي أو الإنجليزي فورياً.",
    descEn: "Search any movie or series in Arabic or English instantly.",
  },
  {
    icon: Bookmark,
    titleAr: "قائمة مشاهدة شخصية",
    titleEn: "Personal Watchlist",
    descAr: "احفظ ما تريد مشاهدته وارجع إليه في أي وقت من أي جهاز.",
    descEn: "Save what you want to watch and come back anytime.",
  },
  {
    icon: Zap,
    titleAr: "سريع وخفيف على أي جهاز",
    titleEn: "Fast on Any Device",
    descAr: "مُحسَّن للجوال والحاسوب — يعمل بسلاسة حتى على الإنترنت البطيء.",
    descEn: "Optimized for mobile & desktop — smooth even on slow connections.",
  },
  {
    icon: Play,
    titleAr: "أفلام ومسلسلات بلا حدود",
    titleEn: "Unlimited Movies & Series",
    descAr: "آلاف الأفلام والمسلسلات من جميع الأنواع والفئات، محدَّثة باستمرار.",
    descEn: "Thousands of movies and series across all genres, constantly updated.",
  },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

export default function About() {
  const { t, isAr } = useLang();

  return (
    <div className="flex-1 flex flex-col items-center pt-28 pb-24 px-4 md:px-8">
      <div className="w-full max-w-2xl mx-auto">

        {/* Logo + title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center mb-10"
        >
          <img src="/logo.png" alt="Phoenix Cinema" className="w-40 h-40 object-contain mb-5 drop-shadow-2xl" />
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-white text-center mb-2 tracking-tight">
            Phoenix<span className="text-primary italic">Cinema</span>
          </h1>
          <p className="text-muted-foreground text-center text-sm md:text-base max-w-xs leading-relaxed">
            {t("تجربة سينمائية غامرة، مصممة بعناية وشغف", "An immersive cinematic experience, crafted with care and passion.")}
          </p>
        </motion.div>

        {/* Why us heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-5 text-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold uppercase tracking-widest">
            {t("لماذا نحن؟", "Why Us?")}
          </span>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10"
        >
          {WHY_US.map(({ icon: Icon, titleAr, titleEn, descAr, descEn }, i) => (
            <motion.div
              key={i}
              variants={item}
              className="group flex gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-primary/35 hover:bg-primary/[0.05] transition-all duration-200"
            >
              <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <Icon size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold leading-tight mb-1">
                  {isAr ? titleAr : titleEn}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isAr ? descAr : descEn}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Developer card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mb-10 rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(220,38,38,0.04) 100%)",
            border: "1px solid rgba(220,38,38,0.25)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(220,38,38,0.08)_0%,_transparent_60%)]" />
          <div className="relative p-7 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-1">
              <Code2 size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-widest font-medium mb-1">
                {t("صُنع بـ", "Developed by")}
              </p>
              <h2 className="text-3xl font-serif font-bold text-white">enawi 🐦‍🔥</h2>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
              <Heart size={13} className="text-primary" fill="currentColor" />
              <span>{t("صُنع بشغف لعشاق السينما", "Built with passion for cinema lovers")}</span>
            </div>
          </div>
        </motion.div>

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center space-y-2 text-xs text-muted-foreground/40"
        >
          <p>Phoenix Cinema — v2.0</p>
          <p>{t("جميع المحتويات مستضافة من مصادر خارجية", "All content is hosted by third-party providers")}</p>
          <div className="pt-4">
            <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:bg-primary/90 transition-all hover:scale-105">
              <Film size={15} />
              {t("ابدأ المشاهدة", "Start Watching")}
            </Link>
          </div>
          <div className="pt-5">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors text-[11px]">
              <Settings2 size={11} />
              {t("لوحة الإدارة", "Admin Panel")}
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
