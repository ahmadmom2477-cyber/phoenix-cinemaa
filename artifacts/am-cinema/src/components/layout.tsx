import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Search, Home, Grid3X3, Languages, Bookmark, Tv, Clapperboard, Info, LogOut, Layers, Film } from "lucide-react";
import { useSearchMedia, getSearchMediaQueryKey } from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/contexts/lang";
import { getWatchlist } from "@/hooks/use-watchlist";
import { useSubscription } from "@/hooks/use-subscription";

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang, isAr } = useLang();
  const { isActive, deactivate, expiresAt } = useSubscription();
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const navSearchRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const searchParams = { q: debouncedSearch };
  const { data: searchResults, isLoading: isSearchLoading } = useSearchMedia(
    searchParams,
    { query: { enabled: debouncedSearch.length > 2, queryKey: getSearchMediaQueryKey(searchParams) } }
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setWatchlistCount(getWatchlist().length);
    const interval = setInterval(() => setWatchlistCount(getWatchlist().length), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        navSearchRef.current?.focus();
        navSearchRef.current?.select();
        setIsSearchFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchFocused(false);
      setSearchQuery("");
    }
  };

  const isHome = location === "/";
  const isSearch = location.startsWith("/search");
  const isGenres = location.startsWith("/genre");
  const isMovies = location === "/movies";
  const isSeries = location === "/series";
  const isWatchlist = location === "/watchlist";
  const isCollections = location.startsWith("/collection");

  const navLinkCls = (active: boolean) =>
    `relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? "text-primary"
        : "text-muted-foreground hover:text-white/90"
    }`;

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background text-foreground relative selection:bg-primary/30 selection:text-primary"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Navbar */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${isScrolled ? "glass-panel" : "bg-transparent"}`} style={{ paddingTop: isScrolled ? "10px" : "16px", paddingBottom: isScrolled ? "10px" : "16px" }}>
        {/* 3-column grid: left | center(logo) | right — keeps logo truly centered on all screen sizes */}
        <div className="container max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-2" dir="ltr">

          {/* ── LEFT col: Desktop nav  /  Mobile: lang toggle ── */}
          <div className="flex items-center gap-1">
            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-0.5" dir={isAr ? "rtl" : "ltr"}>
              <Link href="/"><span className={navLinkCls(isHome)}>{t("الرئيسية", "Home")}{isHome && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
              <Link href="/movies"><span className={navLinkCls(isMovies)}>{t("أفلام", "Movies")}{isMovies && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
              <Link href="/series"><span className={navLinkCls(isSeries)}>{t("مسلسلات", "Series")}{isSeries && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
              <Link href="/collections"><span className={navLinkCls(isCollections)}>{t("المجموعات", "Collections")}{isCollections && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
              <Link href="/genres"><span className={navLinkCls(isGenres)}>{t("الفئات", "Genres")}{isGenres && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
              <Link href="/about"><span className={navLinkCls(location === "/about")}>{t("عن التطبيق", "About")}{location === "/about" && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}</span></Link>
            </nav>
            {/* Mobile: language toggle on the left */}
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="md:hidden flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-muted-foreground/70 hover:text-white transition-all text-xs font-semibold border border-white/[0.06]"
              title={t("Switch to English", "التبديل للعربية")}
            >
              <Languages size={14} />
            </button>
          </div>

          {/* ── CENTER col: Logo — always perfectly centered ── */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-1 ring-red-900/40 group-hover:ring-primary/60 group-hover:scale-105 transition-all duration-300 drop-shadow-[0_0_10px_rgba(220,38,38,0.45)]">
              <img src="/logo.png" alt="" className="w-full h-full object-cover" style={{ objectPosition: "50% 38%" }} />
            </div>
            <span className="font-serif text-xl font-semibold tracking-wide text-white select-none" dir={isAr ? "rtl" : "ltr"}>
              Phoenix<span className="text-gradient-red italic">Cinema</span>
            </span>
          </Link>

          {/* ── RIGHT col: Desktop search + controls / Mobile: watchlist + search ── */}
          <div className="flex items-center justify-end gap-2">

            {/* Desktop search bar */}
            <div className="flex-1 max-w-xs relative hidden md:block">
              <form onSubmit={handleSearchSubmit} className="relative group">
                <div className={`absolute -inset-px rounded-full transition-opacity duration-300 ${isSearchFocused ? "opacity-100 bg-primary/20 blur-xl" : "opacity-0"}`} />
                <div className={`relative flex items-center rounded-full px-4 py-2.5 overflow-hidden transition-all duration-300 ${isSearchFocused ? "bg-white/8 border border-primary/40 shadow-lg shadow-primary/10" : "bg-white/[0.06] border border-white/[0.08] hover:border-white/20"}`}>
                  <Search size={16} className={`mr-3 shrink-0 transition-colors duration-200 ${isSearchFocused ? "text-primary" : "text-muted-foreground/70"}`} />
                  <input
                    ref={navSearchRef}
                    type="text"
                    placeholder={t("ابحث عن أفلام، مسلسلات...", "Search movies, series...")}
                    className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-muted-foreground/50 font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    dir="auto"
                  />
                  <kbd className="shrink-0 hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground/30 border border-white/8">⌘K</kbd>
                </div>
                <AnimatePresence>
                  {isSearchFocused && debouncedSearch.length > 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute top-full mt-3 left-0 right-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/70 border border-white/8"
                      style={{ background: "rgba(12,12,12,0.92)", backdropFilter: "blur(24px)" }}
                    >
                      <div className="p-2" dir={isAr ? "rtl" : "ltr"}>
                        {isSearchLoading ? (
                          <div className="py-8 text-center text-muted-foreground/60 text-sm flex items-center justify-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            {t("جاري البحث...", "Searching...")}
                          </div>
                        ) : searchResults?.results?.length ? (
                          <div className="space-y-0.5">
                            {searchResults.results.slice(0, 5).map((result) => (
                              <Link key={result.imdbId} href={`/watch/${result.imdbId}`} className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-white/6 transition-colors group/item">
                                <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0 border border-white/8">
                                  {result.poster && result.poster !== "N/A" ? (
                                    <img src={result.poster} alt={result.title} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50"><Film size={14} /></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white/90 text-sm font-medium truncate group-hover/item:text-primary transition-colors">{result.title}</h4>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground/50 mt-0.5">
                                    <span>{result.year}</span>
                                    <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                                    <span className="capitalize">{result.type}</span>
                                  </div>
                                </div>
                              </Link>
                            ))}
                            <button type="button" onClick={() => setLocation(`/search?q=${encodeURIComponent(debouncedSearch)}`)} className="w-full py-2.5 text-xs text-primary/80 hover:text-primary hover:bg-primary/8 rounded-xl transition-colors mt-1 font-medium">
                              {t("عرض كل النتائج ←", `See all results for "${debouncedSearch}" →`)}
                            </button>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground/50 text-sm">
                            {t(`لا توجد نتائج لـ "${debouncedSearch}"`, `No results for "${debouncedSearch}"`)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>

            {/* Subscription expiry + Logout */}
            {isActive && (() => {
              const daysLeft = expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : null;
              const expiringSoon = daysLeft !== null && daysLeft <= 5;
              return (
                <div className="flex items-center gap-1.5">
                  {daysLeft !== null && (
                    <span title={t("تنتهي صلاحية اشتراكك قريباً", "Your subscription expires soon")} className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${expiringSoon ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-white/[0.04] border-white/8 text-muted-foreground/60"}`}>
                      {expiringSoon && <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />}
                      {daysLeft <= 0 ? t("آخر يوم", "Last day") : daysLeft === 1 ? t("يوم واحد", "1 day") : t(`${daysLeft} يوم`, `${daysLeft}d`)}
                    </span>
                  )}
                  <button
                    onClick={() => { if (logoutConfirm) { deactivate(); window.location.href = "/"; } else { setLogoutConfirm(true); setTimeout(() => setLogoutConfirm(false), 3000); } }}
                    title={logoutConfirm ? t("اضغط مجدداً للتأكيد", "Tap again to confirm") : t("تسجيل الخروج", "Sign out")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${logoutConfirm ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40" : "bg-white/[0.06] text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"}`}
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              );
            })()}

            {/* Watchlist */}
            <Link href="/watchlist" className="relative group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${isWatchlist ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-muted-foreground/70 hover:text-white hover:bg-white/10"}`}>
                <Bookmark size={16} />
              </div>
              {watchlistCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center shadow-md shadow-primary/40">
                  {watchlistCount > 9 ? "9+" : watchlistCount}
                </span>
              )}
            </Link>

            {/* Language toggle — desktop only (mobile has it on the left) */}
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-muted-foreground/70 hover:text-white transition-all duration-200 text-xs font-semibold border border-white/[0.06] hover:border-white/15"
              title={t("Switch to English", "التبديل للعربية")}
            >
              <Languages size={14} />
              <span>{lang === "ar" ? "EN" : "عر"}</span>
            </button>

            {/* Mobile search icon */}
            <Link href="/search" className="md:hidden">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors active:scale-95 text-muted-foreground/70 hover:text-white">
                <Search size={17} />
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full relative z-10 pb-[72px] md:pb-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-12 mt-16 relative z-10 hidden md:block" style={{ background: "rgba(6,6,6,0.8)" }}>
        <div className="container max-w-7xl mx-auto px-4 md:px-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 opacity-50 hover:opacity-90 transition-opacity group">
            <img src="/logo.png" alt="Phoenix Cinema" className="h-10 w-auto object-contain" />
          </Link>
          <p className="text-sm text-muted-foreground/40 max-w-sm mx-auto leading-relaxed mb-4">
            {t("تجربة سينمائية متميزة. اكتشاف منسق وواجهة غامرة وتشغيل سلس.", "Premium cinematic experience. Curated discovery, immersive interface, seamless streaming.")}
          </p>
          <Link href="/about" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-primary/70 transition-colors">
            {t("صُنع بـ ❤ بواسطة Abood", "Developed with ❤ by Abood")}
          </Link>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden" style={{ background: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-1 pt-2 pb-2">
          {[
            { href: "/", icon: Home, label: t("الرئيسية", "Home"), active: isHome },
            { href: "/movies", icon: Clapperboard, label: t("أفلام", "Movies"), active: isMovies },
            { href: "/series", icon: Tv, label: t("مسلسلات", "Series"), active: isSeries },
            { href: "/collections", icon: Layers, label: t("مجموعات", "Collections"), active: isCollections },
            { href: "/genres", icon: Grid3X3, label: t("الفئات", "Genres"), active: isGenres },
            { href: "/watchlist", icon: Bookmark, label: t("قائمتي", "Saved"), active: isWatchlist, badge: watchlistCount },
          ].map(({ href, icon: Icon, label, active, badge }) => (
            <Link key={href} href={href}>
              <div className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 ${active ? "text-primary" : "text-muted-foreground/60"}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : ""}`}>{label}</span>
                {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
                {badge !== undefined && badge > 0 && (
                  <span className="absolute top-0.5 right-1 min-w-[14px] h-[14px] px-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
