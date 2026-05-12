import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useGetMediaDetails, useGetDownloadLinks, getGetDownloadLinksQueryKey, getGetMediaDetailsQueryKey } from "@workspace/api-client-react";
import { Upload, ChevronLeft, Calendar, Star, Clock, Download, ExternalLink, ArrowDownToLine, X, Smartphone, Loader2, CheckCircle, ChevronRight, Keyboard, ArrowUpFromLine, FileDown, Copy, Check, Search as SearchIcon, Globe, Bookmark, BookmarkCheck, Play, Film, Tv, SkipForward, Maximize, Share2 } from "lucide-react";
import TorrentPlayer from "@/components/TorrentPlayer";
import { addToWatchHistory, saveWatchProgress, getWatchProgress } from "@/hooks/use-watch-history";
import { isInWatchlist, toggleWatchlist } from "@/hooks/use-watchlist";
import { GENRES } from "@/data/genres-client";
import { useLang } from "@/contexts/lang";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useSwipeBack } from "@/hooks/use-swipe-back";
import { useFreeTrial } from "@/hooks/use-free-trial";

const PROVIDERS = [
  {
    id: "vidsrcicu",
    label: "Source 1",
    buildUrl: (imdbId: string, type: string, season: string, episode: string) =>
      type === "series"
        ? `https://vidsrc.icu/embed/tv/${imdbId}/${season}/${episode}`
        : `https://vidsrc.icu/embed/movie/${imdbId}`,
  },
  {
    id: "vidsrcpm",
    label: "Source 2",
    buildUrl: (imdbId: string, type: string, season: string, episode: string) =>
      type === "series"
        ? `https://vidsrc.pm/embed/tv/${imdbId}/${season}/${episode}`
        : `https://vidsrc.pm/embed/movie/${imdbId}`,
  },
  {
    id: "twoembed",
    label: "Source 3",
    buildUrl: (imdbId: string, type: string, season: string, episode: string) =>
      type === "series"
        ? `https://www.2embed.cc/embedtv/${imdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${imdbId}`,
  },
  {
    id: "vidapiru",
    label: "Source 4",
    supportsSubUrl: true,
    buildUrl: (imdbId: string, type: string, season: string, episode: string) =>
      type === "series"
        ? `https://vaplayer.ru/embed/tv/${imdbId}/${season}/${episode}?ds_lang=off`
        : `https://vaplayer.ru/embed/movie/${imdbId}?ds_lang=off`,
  },
  {
    id: "webtorrent",
    label: "Player 5 🧲",
    isTorrent: true,
    buildUrl: () => "",
  },
];

interface SubtitleOption {
  id: string;
  fileId: string;
  fileName: string;
  downloadLink?: string;
  downloads: number;
  rating: number;
  language: string;
  hearingImpaired: boolean;
  aiTranslated?: boolean;
  comments?: string;
  fullSeason?: boolean;
  releaseName?: string;
}

/** Format subtitle label for display — converts raw API labels to readable Arabic/English */
function formatSubLabel(sub: SubtitleOption, index: number, lang: "ar" | "en"): string {
  const raw = sub.releaseName || sub.fileName || "";
  if (raw.includes("Green") || raw.includes("⭐")) {
    return lang === "ar" ? `✅ موثوقة` : `✅ Trusted`;
  }
  // Keyword-based label
  const KNOWN = ["Netflix", "Amazon", "iTunes", "CimaNow", "EgyBest", "BluRay", "DawoodTv", "Elzayady", "الأصلية"];
  for (const k of KNOWN) {
    if (raw.includes(k)) return k;
  }
  // Generic Arabic subtitle
  return lang === "ar" ? `ترجمة ${index + 1}` : `Subtitle ${index + 1}`;
}

function TorrentUrlCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} title={url} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

export default function Watch() {
  const { t, lang } = useLang();
  const params = useParams();
  const imdbId = params.imdbId as string;
  const [, setLocation] = useLocation();

  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const [clickGuardActive, setClickGuardActive] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [subtitleFileName, setSubtitleFileName] = useState("");
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleError, setSubtitleError] = useState("");

  const [autoSubLoading, setAutoSubLoading] = useState(false);
  const [autoSubOptions, setAutoSubOptions] = useState<SubtitleOption[]>([]);
  const [autoSubFetchedFor, setAutoSubFetchedFor] = useState("");
  const [showAutoSubPanel, setShowAutoSubPanel] = useState(false);
  const [applyingSubId, setApplyingSubId] = useState<string | null>(null);
  const [autoSubStatus, setAutoSubStatus] = useState<"idle" | "applied" | "none">("idle");
  const autoSubAppliedRef = useRef<string>("");
  const [srtDownloadUrl, setSrtDownloadUrl] = useState<string | null>(null);
  const [source4AutoLoading, setSource4AutoLoading] = useState(false);
  const source4AutoAppliedRef = useRef<string>("");
  const [inWatchlist, setInWatchlist] = useState(false);
  const [autoRetryCountdown, setAutoRetryCountdown] = useState<number | null>(null);
  const autoRetryCountRef = useRef(0);
  const [srtDownloadName, setSrtDownloadName] = useState("");
  const [similarItems, setSimilarItems] = useState<{ imdbId: string; title: string; poster?: string | null; year?: string | null; imdbRating?: string | null; type?: string }[]>([]);

  // Track exactly when the player was activated (click guard dismissed)
  const playerActivatedAtRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // Keep screen awake while video is active
  useWakeLock(!clickGuardActive);

  // Swipe right from left edge to go back
  useSwipeBack(() => window.history.back());

  // Free trial — record this movie when player is activated
  const { recordWatch } = useFreeTrial();
  // Unique ID per embed source change — prevents double-counting rapid re-clicks
  const watchSessionIdRef = useRef<string>("");

  const handleFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    try { navigator.vibrate?.(20); } catch {}
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {
        // iOS fallback — try on the iframe directly
        const iframe = el.querySelector("iframe") as HTMLIFrameElement & {
          webkitRequestFullscreen?: () => void;
        };
        iframe?.webkitRequestFullscreen?.();
      });
    }
  };

  const handleShare = async () => {
    try { navigator.vibrate?.(20); } catch {}
    const url = window.location.href;
    const text = media?.title
      ? `${t(`شاهد "${media.title}" على Phoenix Cinema`, `Watch "${media.title}" on Phoenix Cinema`)}`
      : "Phoenix Cinema";
    if (navigator.share) {
      await navigator.share({ title: media?.title ?? "Phoenix Cinema", text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  useEffect(() => {
    const AD_DOMAINS = /exoclick|juicyads|trafficjunky|popads|popcash|propellerads|adsterra|clickadu|adcash|admaven|evadav|onclicka|onclickads|bidvertiser|coinhive|magsrv|hilltopads|revcontent|taboola|outbrain|pushground|richpush|push\.house|megapu\.sh|doubleclick|googlesyndication|adnxs|advertising\.com|adtech\.com|traffichaus|plugrush|ero-advertising|popunder|popcpm|mgid|moonet\.co|fun-streams|cdnfile\.info|adjungle|new-player\.com|reliablewebserve|cdn77ads|flashtalking|mfadsrevenue|clkmon|exo\.io|rotatemymoney|adskeeper/i;

    function isAd(url?: string | URL | null): boolean {
      if (!url) return false;
      try { return AD_DOMAINS.test(new URL(String(url)).hostname); } catch { return false; }
    }

    // Block ALL new-window / popup attempts — on a video player page no popup is ever legitimate
    const originalOpen = window.open.bind(window);
    window.open = function () { return null; };

    // Block location.href hijacks to ad domains
    const locDesc = Object.getOwnPropertyDescriptor(Location.prototype, "href");
    if (locDesc?.set) {
      try {
        Object.defineProperty(window.location, "href", {
          set(v: string) {
            if (isAd(v)) return;
            locDesc.set!.call(window.location, v);
          },
          get() {
            return locDesc.get!.call(window.location);
          },
          configurable: true,
        });
      } catch {}
    }

    // Prevent the embed from hijacking the top-level page via assign/replace
    const origAssign = window.location.assign.bind(window.location);
    const origReplace = window.location.replace.bind(window.location);
    try {
      window.location.assign = (url: string | URL) => {
        if (isAd(url)) return;
        origAssign(url);
      };
      window.location.replace = (url: string | URL) => {
        if (isAd(url)) return;
        origReplace(url);
      };
    } catch {}

    // Block fetch to ad domains at the parent level too
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = input instanceof Request ? input.url : String(input);
      if (isAd(url)) return Promise.resolve(new Response("", { status: 200 }));
      return origFetch(input, init);
    };

    // Block XMLHttpRequest to ad domains — root-cause interception
    const OrigXHR = window.XMLHttpRequest;
    class BlockedXHR extends OrigXHR {
      private _blockedUrl = "";
      open(method: string, url: string | URL, ...rest: Parameters<XMLHttpRequest["open"]> extends [string, string | URL, ...infer R] ? R : never) {
        const urlStr = String(url);
        if (isAd(urlStr)) { this._blockedUrl = urlStr; return; }
        super.open(method, url as string, ...(rest as [boolean?, string?, string?]));
      }
      send(body?: Document | XMLHttpRequestBodyInit | null) {
        if (this._blockedUrl) return;
        super.send(body);
      }
    }
    // @ts-ignore — replace globally
    window.XMLHttpRequest = BlockedXHR;

    // Block document.write — ads often inject via document.write
    try {
      document.write = () => {};
      document.writeln = () => {};
    } catch {}

    // Block history-manipulation redirects ads use
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);
    try {
      history.pushState = function(state, title, url) {
        if (url && isAd(String(url))) return;
        return origPushState(state, title, url);
      };
      history.replaceState = function(state, title, url) {
        if (url && isAd(String(url))) return;
        return origReplaceState(state, title, url);
      };
    } catch {}

    // Reclaim focus aggressively if something tries to open a new tab/popup
    const onVisibilityChange = () => {
      if (document.hidden) {
        // Immediate + delayed reclaim
        try { window.focus(); } catch {}
        setTimeout(() => { try { window.focus(); } catch {} }, 150);
        setTimeout(() => { try { window.focus(); } catch {} }, 500);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Also catch blur events — popunders often steal focus on blur
    const onBlur = () => {
      setTimeout(() => { try { window.focus(); } catch {} }, 100);
    };
    window.addEventListener("blur", onBlur);

    // Remove injected ad iframes/scripts from the page root
    const domObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          const el = node as HTMLElement & { src?: string; href?: string };
          const src = el.src ?? el.getAttribute?.("src") ?? "";
          if (isAd(src)) { node.remove(); return; }
          if ((node.tagName === "IFRAME" || node.tagName === "SCRIPT") && isAd(src)) {
            node.remove();
          }
          // Remove injected full-page overlay divs from ad scripts
          if (node.tagName === "DIV") {
            const style = (node as HTMLDivElement).style;
            if (style?.position === "fixed" && style?.zIndex && parseInt(style.zIndex) > 9000) {
              const links = (node as HTMLDivElement).querySelectorAll("a[href]");
              if (links.length > 0 && isAd((links[0] as HTMLAnchorElement).href)) {
                node.remove();
              }
            }
          }
        });
      }
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.open = originalOpen;
      window.fetch = origFetch;
      // @ts-ignore
      window.XMLHttpRequest = OrigXHR;
      try {
        history.pushState = origPushState;
        history.replaceState = origReplaceState;
      } catch {}
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      domObserver.disconnect();
    };
  }, []);

  const { data: media, isLoading, error: mediaError } = useGetMediaDetails(imdbId, {
    query: { enabled: !!imdbId, queryKey: getGetMediaDetailsQueryKey(imdbId) },
  });

  useEffect(() => {
    if (!imdbId) return;
    setInWatchlist(isInWatchlist(imdbId));
    autoRetryCountRef.current = 0;
  }, [imdbId]);

  useEffect(() => {
    if (!media) return;
    addToWatchHistory({
      imdbId: media.imdbId,
      title: media.title,
      poster: media.poster ?? null,
      type: media.type,
      year: media.year ?? null,
      season: media.type === "series" ? season : undefined,
      episode: media.type === "series" ? episode : undefined,
      genres: media.genre ? media.genre.split(",").map((g: string) => g.trim()) : [],
    });

    const stored = getWatchProgress(media.imdbId,
      media.type === "series" ? season : undefined,
      media.type === "series" ? episode : undefined
    );
    if (stored && stored.minutePosition > 0) {
      console.info(`[PhoenixCinema] Resuming at ${stored.minutePosition} min`);
    }
  }, [media, season, episode]);

  useEffect(() => {
    if (!media) return;
    const key = `${imdbId}_${season}_${episode}`;
    const timer = setInterval(() => {
      saveWatchProgress(media.imdbId, Math.floor(Date.now() / 60000) % 1440,
        media.type === "series" ? season : undefined,
        media.type === "series" ? episode : undefined
      );
    }, 60000);
    return () => clearInterval(timer);
  }, [media, imdbId, season, episode]);

  // Fetch similar content by genre
  useEffect(() => {
    if (!media?.genre) return;
    const firstGenre = media.genre.split(",")[0].trim().toLowerCase();
    const matchedGenre = GENRES.find((g) =>
      g.nameEn.toLowerCase() === firstGenre || g.id === firstGenre
    );
    if (!matchedGenre) return;
    setSimilarItems([]);
    fetch(`/api/genre/${matchedGenre.id}?page=1&limit=14`)
      .then((r) => r.json())
      .then((d: { items: typeof similarItems }) => {
        const filtered = (d.items ?? []).filter((item) => item.imdbId !== imdbId).slice(0, 12);
        setSimilarItems(filtered);
      })
      .catch(() => {});
  }, [media, imdbId]);

  // Reset subtitle state when media/episode changes
  useEffect(() => {
    if (!media || !imdbId) return;
    const fetchKey = `${imdbId}_${season}_${episode}`;
    if (autoSubAppliedRef.current === fetchKey) return;
    setSubtitleUrl(null);
    setSubtitleFileName("");
    setSubtitleError("");
    setAutoSubStatus("idle");
    setAutoSubOptions([]);
    setAutoSubFetchedFor("");
    setShowAutoSubPanel(false);
    setSrtDownloadUrl(null);
    setSrtDownloadName("");
    source4AutoAppliedRef.current = "";
    autoSubAppliedRef.current = fetchKey;
  }, [imdbId, season, episode]);

  // Source 4 auto-subtitle: search + pick first + inject via sub_url
  useEffect(() => {
    if (providerId !== "vidapiru") return;
    if (!media || !imdbId) return;
    if (autoSubStatus === "applied") return;
    const key = `${imdbId}_${season}_${episode}`;
    if (source4AutoAppliedRef.current === key) return;
    source4AutoAppliedRef.current = key;

    let cancelled = false;
    (async () => {
      setSource4AutoLoading(true);
      try {
        const params = new URLSearchParams({ imdbId });
        if (media.title) params.append("title", media.title);
        if (media.year) params.append("year", media.year);
        if (media.type === "series") { params.append("season", season); params.append("episode", episode); }
        const searchRes = await fetch(`/api/subtitles/search?${params}`);
        if (cancelled) return;
        const searchData = await searchRes.json() as { subtitles: SubtitleOption[] };
        const subs = searchData.subtitles ?? [];
        if (subs.length === 0) return;
        const best = subs[0];
        const fetchRes = await fetch("/api/subtitles/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ downloadLink: best.downloadLink || best.fileId }),
        });
        if (cancelled) return;
        const fetchData = await fetchRes.json() as { id?: string; url?: string };
        if (!fetchRes.ok || (!fetchData.id && !fetchData.url)) return;
        const id = fetchData.id || fetchData.url?.match(/\/([^/]+)\.srt/)?.[1];
        const publicUrl = id ? `${window.location.origin}/api/subtitles/${id}.srt` : fetchData.url!;
        if (cancelled) return;
        setSubtitleUrl(publicUrl);
        setSubtitleFileName(formatSubLabel(best, 0, lang));
        setSrtDownloadUrl(publicUrl);
        setSrtDownloadName(`${formatSubLabel(best, 0, lang)}.srt`);
        setAutoSubStatus("applied");
      } catch { /* silent */ } finally {
        if (!cancelled) setSource4AutoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [providerId, imdbId, season, episode, media, autoSubStatus, lang]);

  const fetchAutoSubtitles = useCallback(async () => {
    if (!imdbId) return;
    const fetchKey = `${imdbId}_${season}_${episode}`;
    if (autoSubFetchedFor === fetchKey && autoSubOptions.length > 0) {
      setShowAutoSubPanel(true);
      return;
    }
    setAutoSubLoading(true);
    setShowAutoSubPanel(true);
    setAutoSubOptions([]);
    try {
      const params = new URLSearchParams({ imdbId });
      if (media?.title) params.append("title", media.title);
      if (media?.year) params.append("year", media.year);
      if (media?.type === "series") { params.append("season", season); params.append("episode", episode); }
      const res = await fetch(`/api/subtitles/search?${params}`);
      const data = await res.json() as { subtitles: SubtitleOption[] };
      setAutoSubOptions(data.subtitles ?? []);
      setAutoSubFetchedFor(fetchKey);
    } catch {
      setAutoSubOptions([]);
    } finally {
      setAutoSubLoading(false);
    }
  }, [imdbId, season, episode, media, autoSubFetchedFor, autoSubOptions.length]);

  const applyAutoSubtitle = async (sub: SubtitleOption) => {
    setApplyingSubId(sub.id);
    setSubtitleError("");
    try {
      const link = sub.downloadLink || sub.fileId;
      const res = await fetch("/api/subtitles/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadLink: link }),
      });
      const json = await res.json() as { id?: string; url?: string; error?: string };
      if (!res.ok || (!json.id && !json.url)) {
        const msg = json.error ?? t("تعذّر تحميل الترجمة، جرّب خياراً آخر", "Failed to load subtitle, try another option");
        setSubtitleError(msg);
        return;
      }
      const id = json.id || json.url?.match(/\/([^/]+)\.srt/)?.[1];
      const publicUrl = id
        ? `${window.location.origin}/api/subtitles/${id}.srt`
        : json.url!;
      const subIndex = autoSubOptions.findIndex((s) => s.id === sub.id);
      const label = formatSubLabel(sub, subIndex >= 0 ? subIndex : 0, lang);
      setSubtitleUrl(publicUrl);
      setSubtitleFileName(label);
      setSrtDownloadUrl(publicUrl);
      setSrtDownloadName(`${label}.srt`);
      setSubtitleError("");
      setAutoSubStatus("applied");
      setShowAutoSubPanel(false);
    } catch {
      setSubtitleError(t("تعذّر الاتصال بالخادم، حاول مجدداً", "Connection error, please try again"));
    } finally {
      setApplyingSubId(null);
    }
  };

  const downloadParams = {
    type: media?.type as "movie" | "series" | undefined,
    season: media?.type === "series" ? season : undefined,
    episode: media?.type === "series" ? episode : undefined,
    title: media?.title,
  };
  const { data: downloads, isLoading: downloadsLoading } = useGetDownloadLinks(
    imdbId, downloadParams,
    { query: { enabled: !!media, queryKey: getGetDownloadLinksQueryKey(imdbId, downloadParams) } }
  );

  const isSeries = media?.type === "series";
  const totalSeasons = media?.totalSeasons ? parseInt(media.totalSeasons, 10) : 1;
  const episodeCount = 50;

  const activeProvider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
  const isTorrentMode = !!(activeProvider as { isTorrent?: boolean }).isTorrent;

  const embedUrl = (() => {
    if (isTorrentMode) return "";
    const base = activeProvider.buildUrl(imdbId, media?.type ?? "movie", season, episode);
    if ((activeProvider as { supportsSubUrl?: boolean }).supportsSubUrl && subtitleUrl) {
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}sub_url=${encodeURIComponent(subtitleUrl)}&sub_label=${encodeURIComponent("عربي")}&sub_lang=ar&sub_default=true&ds_lang=`;
    }
    return base;
  })();

  useEffect(() => {
    if (isTorrentMode) {
      setClickGuardActive(false);
      return;
    }
    setClickGuardActive(true);
    playerActivatedAtRef.current = null; // reset on source/episode change
    watchSessionIdRef.current = crypto.randomUUID(); // fresh ID per embed source
  }, [embedUrl, isTorrentMode]);

  // Reset playerActivatedAt when episode/source changes
  useEffect(() => {
    playerActivatedAtRef.current = null;
  }, [imdbId, season, episode]);

  // Auto-retry: if player isn't activated within 10s, switch to next source (max 2 times)
  // Skip auto-retry when in torrent mode
  useEffect(() => {
    if (isTorrentMode) { setAutoRetryCountdown(null); return; }
    if (!clickGuardActive) { setAutoRetryCountdown(null); return; }
    const iframeSources = PROVIDERS.filter((p) => !(p as { isTorrent?: boolean }).isTorrent);
    if (autoRetryCountRef.current >= iframeSources.length - 1) return;
    setAutoRetryCountdown(10);
    const interval = setInterval(() => {
      setAutoRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          autoRetryCountRef.current += 1;
          const currentIndex = iframeSources.findIndex((p) => p.id === providerId);
          const nextProvider = iframeSources[(currentIndex + 1) % iframeSources.length];
          setProviderId(nextProvider.id);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { clearInterval(interval); };
  }, [embedUrl, clickGuardActive, isTorrentMode]);

  const prevEpisode = useCallback(() => {
    const ep = parseInt(episode, 10);
    if (ep > 1) { setEpisode(String(ep - 1)); return; }
    const s = parseInt(season, 10);
    if (s > 1) { setSeason(String(s - 1)); setEpisode("50"); }
  }, [episode, season]);

  const nextEpisode = useCallback(() => {
    const ep = parseInt(episode, 10);
    if (ep < episodeCount) { setEpisode(String(ep + 1)); return; }
    const s = parseInt(season, 10);
    if (s < totalSeasons) { setSeason(String(s + 1)); setEpisode("1"); }
  }, [episode, season, totalSeasons]);

  useEffect(() => {
    if (!isSeries) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); prevEpisode(); }
      if (e.key === "ArrowRight") { e.preventDefault(); nextEpisode(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSeries, prevEpisode, nextEpisode]);

  useEffect(() => {
    if (!episodeListRef.current) return;
    const active = episodeListRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [episode, season]);

  const directDownloadUrl = isSeries
    ? `https://dl.vidsrc.vip/tv/${imdbId}/${season}/${episode}`
    : `https://dl.vidsrc.vip/movie/${imdbId}`;

  const handleSubtitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubtitleError("");
    setSubtitleLoading(true);
    setSubtitleFileName(file.name);
    try {
      const text = await file.text();
      const res = await fetch("/api/subtitles", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { id } = await res.json() as { id: string };
      const url = `${window.location.origin}/api/subtitles/${id}.srt`;
      setSubtitleUrl(url);
      setSrtDownloadUrl(url);
      setSrtDownloadName(file.name.endsWith(".srt") ? file.name : `${file.name}.srt`);
      setAutoSubStatus("applied");
    } catch {
      setSubtitleError(t("تعذّر رفع الترجمة، حاول مجدداً", "Could not upload subtitle. Try again."));
      setSubtitleFileName("");
    } finally {
      setSubtitleLoading(false);
    }
  };

  const clearSubtitle = () => {
    setSubtitleUrl(null);
    setSubtitleFileName("");
    setSubtitleError("");
    setAutoSubStatus("idle");
    setSrtDownloadUrl(null);
    setSrtDownloadName("");
    autoSubAppliedRef.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pt-24 px-4 md:px-8 max-w-7xl mx-auto w-full animate-pulse">
        <div className="w-full aspect-video bg-white/5 rounded-2xl mb-8" />
        <div className="h-10 bg-white/5 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/5 rounded w-2/3 mb-2" />
        <div className="h-4 bg-white/5 rounded w-1/2 mb-8" />
      </div>
    );
  }

  if (!media) {
    const isRateLimited = (mediaError as { status?: number } | null)?.status === 503;
    return (
      <div className="flex-1 flex items-center justify-center pt-24">
        <div className="text-center px-4">
          <div className="text-5xl mb-5">{isRateLimited ? "⏳" : "🎬"}</div>
          <h2 className="text-2xl font-serif mb-2">
            {isRateLimited
              ? t("الخدمة مؤقتاً غير متاحة", "Service temporarily unavailable")
              : t("المحتوى غير موجود", "Media not found")}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
            {isRateLimited
              ? t("تم الوصول للحد اليومي لمزوّد البيانات. يُرجى المحاولة بعد بضع ساعات أو اختيار محتوى آخر.",
                  "Daily API limit reached. Please try again in a few hours or browse other content.")
              : t("لم يتم العثور على المحتوى المطلوب", "The requested title could not be located.")}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => setLocation("/")} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors font-medium">
              {t("العودة للرئيسية", "Return Home")}
            </button>
            {isRateLimited && (
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-white/10 text-white rounded-full hover:bg-white/15 transition-colors font-medium">
                {t("إعادة المحاولة", "Try Again")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-20 md:pt-24 pb-8 md:pb-12 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6 self-start group">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} />
        </div>
        <span className="text-sm font-medium">{t("رجوع", "Back")}</span>
      </button>

      {/* Provider Switcher */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mr-1 shrink-0">{t("المصدر:", "Source:")}</span>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProviderId(p.id)}
            className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-colors border active:scale-95 shrink-0 ${
              providerId === p.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            {p.label}
            {p.supportsSubUrl && (
              <span className="absolute -top-1.5 -end-1.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" title={t("يدعم الترجمة العربية التلقائية", "Supports auto Arabic subtitles")} />
            )}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline shrink-0">{t("إن لم يعمل مصدر، جرّب آخر", "If one source doesn't load, try another")}</span>
      </div>

      {/* Source 4 recommendation / auto-loading banner */}
      {isTorrentMode ? (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 text-xs">
          <span className="text-lg">🧲</span>
          <span className="text-primary/90 flex-1">{t("Player 5 يبث مباشرة من التورنت — جودة عالية بدون خوادم وسيطة", "Player 5 streams directly via WebTorrent — high quality, no intermediate servers")}</span>
        </div>
      ) : providerId !== "vidapiru" ? (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-green-500/8 border border-green-500/20 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-green-300/90 flex-1">{t("المصدر رقم 4 هو الأفضل حالياً — يحمّل الترجمة العربية تلقائياً", "Source 4 is currently the best — loads Arabic subtitles automatically")}</span>
          <button
            onClick={() => setProviderId("vidapiru")}
            className="px-2 py-0.5 rounded-lg bg-green-500/20 hover:bg-green-500/35 text-green-300 font-semibold transition-colors shrink-0"
          >
            {t("تبديل", "Switch")}
          </button>
        </div>
      ) : source4AutoLoading ? (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 text-xs">
          <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          <span className="text-primary/90 flex-1">{t("جارٍ البحث عن أفضل ترجمة عربية وتحميلها…", "Searching for the best Arabic subtitle and loading it…")}</span>
        </div>
      ) : null}

      {/* Subtitle ready — download to load into player */}
      {autoSubStatus === "applied" && srtDownloadUrl && (
        <div className="mb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-xs">
            <CheckCircle size={12} className="text-green-400 shrink-0" />
            <span className="text-green-300 font-medium truncate flex-1">{subtitleFileName || t("ترجمة جاهزة", "Subtitle ready")}</span>
            <a
              href={srtDownloadUrl}
              download={srtDownloadName || "subtitle.srt"}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/20 hover:bg-green-500/35 text-green-300 font-semibold transition-colors shrink-0"
              title={t("تحميل ملف SRT لتحميله في المشغّل", "Download SRT to load into player")}
            >
              <ArrowDownToLine size={11} />
              {t("تحميل SRT", "Download SRT")}
            </a>
            <button onClick={clearSubtitle} className="text-white/40 hover:text-white/80 transition-colors shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* Player */}
      <div ref={playerRef} className="relative w-full aspect-video bg-black rounded-xl md:rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 mb-2">
        {isTorrentMode ? (
          <TorrentPlayer
            key={`${imdbId}-${season}-${episode}`}
            imdbId={imdbId}
            type={media?.type === "series" ? "series" : "movie"}
            season={season}
            episode={episode}
            title={media?.title}
          />
        ) : (
          <>
            <iframe
              key={embedUrl}
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {/* Mobile fullscreen button — visible only when player is active */}
            {!clickGuardActive && (
              <button
                onClick={handleFullscreen}
                className="absolute top-3 end-3 z-30 md:hidden w-9 h-9 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all active:scale-90"
                title={t("ملء الشاشة", "Fullscreen")}
              >
                <Maximize size={16} />
              </button>
            )}
            {clickGuardActive && (
              <div className="absolute inset-0 z-10 cursor-pointer flex flex-col items-center justify-center gap-4" onClick={() => { setClickGuardActive(false); setAutoRetryCountdown(null); playerActivatedAtRef.current = Date.now(); recordWatch(imdbId, watchSessionIdRef.current); }}>
                <div className="text-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-3 mx-auto">
                    <Play fill="currentColor" size={28} className="text-primary ml-1" />
                  </div>
                  <p className="text-white/80 text-sm font-medium">{t("انقر لتفعيل المشغّل", "Click to activate player")}</p>
                </div>
                {autoRetryCountdown !== null && autoRetryCountRef.current < PROVIDERS.filter((p) => !(p as { isTorrent?: boolean }).isTorrent).length - 1 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 pointer-events-none">
                    <SkipForward size={14} className="text-primary" />
                    <span className="text-xs text-white/70">
                      {t(`التبديل للمصدر التالي في ${autoRetryCountdown}s`, `Auto-switching in ${autoRetryCountdown}s`)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Series Episode nav bar */}
      {isSeries && (
        <div className="flex items-center justify-between gap-2 mb-6 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <button onClick={prevEpisode} disabled={episode === "1" && season === "1"} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0" title={t("الحلقة السابقة (←)", "Previous episode (←)")}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-white/80 truncate">S{season.padStart(2,"0")} E{episode.padStart(2,"0")}</span>
          <button onClick={nextEpisode} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors shrink-0" title={t("الحلقة التالية (→)", "Next episode (→)")}>
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setShowShortcuts(!showShortcuts)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors shrink-0 hidden md:flex" title={t("اختصارات لوحة المفاتيح", "Keyboard shortcuts")}>
            <Keyboard size={16} />
          </button>
        </div>
      )}

      {showShortcuts && (
        <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-muted-foreground grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2"><kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white">←</kbd> {t("الحلقة السابقة", "Previous episode")}</div>
          <div className="flex items-center gap-2"><kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white">→</kbd> {t("الحلقة التالية", "Next episode")}</div>
        </div>
      )}

      {/* Meta + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex items-start gap-3 mb-3 md:mb-4">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-serif font-semibold text-white leading-tight flex-1">{media.title}</h1>
              <div className="flex items-center gap-2 shrink-0 mt-1">
                {/* Native share button */}
                <button
                  onClick={handleShare}
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-all active:scale-95 flex items-center justify-center"
                  title={t("مشاركة", "Share")}
                >
                  <Share2 size={15} />
                </button>
                {/* Watchlist */}
                <button
                  onClick={() => {
                    try { navigator.vibrate?.(20); } catch {}
                    const added = toggleWatchlist({
                      imdbId: media.imdbId,
                      title: media.title,
                      poster: media.poster ?? null,
                      year: media.year ?? null,
                      type: media.type,
                      imdbRating: media.imdbRating ?? null,
                    });
                    setInWatchlist(added);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all active:scale-95 ${
                    inWatchlist
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white"
                  }`}
                  title={inWatchlist ? t("إزالة من القائمة", "Remove from watchlist") : t("أضف للقائمة", "Add to watchlist")}
                >
                  {inWatchlist ? (
                    <><BookmarkCheck size={16} /><span className="hidden sm:inline">{t("في قائمتي", "Saved")}</span></>
                  ) : (
                    <><Bookmark size={16} /><span className="hidden sm:inline">{t("أضف للقائمة", "Watchlist")}</span></>
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium mb-6">
              {media.year && <div className="flex items-center gap-1.5"><Calendar size={14} className="text-primary" /><span>{media.year}</span></div>}
              {media.runtime && <div className="flex items-center gap-1.5"><Clock size={14} className="text-primary" /><span>{media.runtime}</span></div>}
              {media.imdbRating && <div className="flex items-center gap-1.5"><Star size={14} className="text-primary fill-primary/20" /><span className="text-white">{media.imdbRating}</span></div>}
              {media.rated && <div className="px-2 py-0.5 rounded text-xs border border-white/20 text-white/70">{media.rated}</div>}
            </div>
            <p className="text-lg text-white/80 leading-relaxed">{media.plot}</p>
          </div>

          <div className="space-y-6 pt-6 border-t border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {media.director && (
                <div>
                  <h3 className="text-sm text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{t("المخرج", "Director")}</h3>
                  <p className="text-white">{media.director}</p>
                </div>
              )}
              {media.actors && (
                <div>
                  <h3 className="text-sm text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{t("الممثلون", "Cast")}</h3>
                  <p className="text-white leading-relaxed">{media.actors}</p>
                </div>
              )}
              {media.genre && (
                <div className="md:col-span-2">
                  <h3 className="text-sm text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{t("الفئة", "Genre")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {media.genre.split(",").map((g: string) => {
                      const genre = g.trim();
                      return (
                        <Link key={genre} href={`/search?q=${encodeURIComponent(genre)}`} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-primary/20 hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
                          {genre}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {media.language && (
                <div>
                  <h3 className="text-sm text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{t("اللغة", "Language")}</h3>
                  <p className="text-white">{media.language}</p>
                </div>
              )}
              {media.awards && media.awards !== "N/A" && (
                <div className="md:col-span-2">
                  <h3 className="text-sm text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{t("الجوائز", "Awards")}</h3>
                  <p className="text-white/80 text-sm">{media.awards}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Series Episode Selector */}
          {isSeries && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <h3 className="text-lg font-serif font-semibold text-white mb-4">{t("الحلقات", "Episodes")}</h3>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
                {Array.from({ length: isNaN(totalSeasons) ? 1 : totalSeasons }).map((_, i) => {
                  const s = String(i + 1);
                  return (
                    <button key={s} onClick={() => { setSeason(s); setEpisode("1"); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 border ${season === s ? "bg-primary text-primary-foreground border-primary" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white"}`}
                    >
                      S{s.padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
              <div ref={episodeListRef} className="grid grid-cols-5 gap-1.5 max-h-52 overflow-y-auto scrollbar-hide">
                {Array.from({ length: episodeCount }).map((_, i) => {
                  const ep = String(i + 1);
                  const isActive = episode === ep;
                  return (
                    <button key={ep} data-active={isActive} onClick={() => setEpisode(ep)}
                      className={`aspect-square rounded-lg text-xs font-semibold transition-colors border ${isActive ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white"}`}
                    >
                      {ep}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Phoenix Subtitle API */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-serif font-semibold text-white flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                Phoenix Subtitle API
              </h3>
              {autoSubStatus === "applied" && subtitleUrl && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-semibold px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {t("نشطة", "Active")}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {t("ترجمات عربية من Subscene — اضغط لاستخراجها، ثم اختر الأنسب لإصدار الفيديو", "Arabic subtitles from Subscene — press to extract, then pick the one matching your release")}
            </p>

            {/* Subtitle ready — download and load into player */}
            {autoSubStatus === "applied" && srtDownloadUrl && (
              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                  <span className="text-xs text-green-300 font-medium truncate flex-1">{subtitleFileName}</span>
                  <button onClick={clearSubtitle} className="text-muted-foreground hover:text-white transition-colors shrink-0" title={t("إزالة الترجمة", "Remove subtitle")}><X size={14} /></button>
                </div>
                <a
                  href={srtDownloadUrl}
                  download={srtDownloadName || "subtitle.srt"}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm font-semibold transition-colors"
                >
                  <ArrowDownToLine size={14} />
                  {t("تحميل SRT — ثم افتحه داخل المشغّل", "Download SRT — then load into player")}
                </a>
              </div>
            )}
            {autoSubStatus === "none" && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-muted-foreground">{t("لم تُوجد ترجمات عربية — جرّب رفع ملف .srt يدوياً", "No Arabic subtitles found — try uploading an .srt file manually")}</p>
              </div>
            )}

            <button
              onClick={fetchAutoSubtitles}
              disabled={autoSubLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-primary font-medium transition-colors group disabled:opacity-50 mb-2"
            >
              {autoSubLoading ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}
              {t("استخراج الترجمة", "Extract Subtitles")}
            </button>

            {/* Auto sub options panel */}
            {showAutoSubPanel && (
              <div className="mt-3 space-y-1.5">
                {autoSubLoading ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-2">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    {t("جاري البحث...", "Searching...")}
                  </div>
                ) : autoSubOptions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">{t("لم تُوجد ترجمات عربية لهذا العنوان", "No Arabic subtitles found for this title")}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{t("جرّب رفع ملف .srt يدوياً أدناه", "Try uploading an .srt file manually below")}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      {autoSubOptions.length} {t("ترجمة — اختر الأنسب لإصدار الفيديو لديك:", "subtitles — pick one matching your video release:")}
                    </p>
                    {autoSubOptions.map((sub, idx) => (
                      <button
                        key={sub.id}
                        onClick={() => applyAutoSubtitle(sub)}
                        disabled={applyingSubId === sub.id}
                        className="w-full flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 text-right transition-colors disabled:opacity-60"
                      >
                        {applyingSubId === sub.id ? (
                          <Loader2 size={14} className="animate-spin text-primary mt-0.5 shrink-0" />
                        ) : (
                          <FileDown size={14} className="text-primary mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{formatSubLabel(sub, idx, lang)}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              ⬇ {sub.downloads.toLocaleString()}
                            </span>
                            {sub.rating > 0 && <span className="text-[10px] text-yellow-400/70">★{sub.rating.toFixed(1)}</span>}
                            {sub.hearingImpaired && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20">HI</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    <button onClick={() => setShowAutoSubPanel(false)} className="w-full text-xs text-muted-foreground hover:text-white py-1.5 transition-colors">{t("إخفاء القائمة", "Hide list")}</button>
                  </>
                )}
              </div>
            )}

            {subtitleError && <p className="text-xs text-red-400 mt-2 text-center">{subtitleError}</p>}

            {/* Manual upload fallback */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-muted-foreground mb-2">{t("أو ارفع ملف .srt يدوياً:", "Or upload an .srt file manually:")}</p>
              <input type="file" accept=".srt" ref={fileInputRef} onChange={handleSubtitleUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={subtitleLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {subtitleLoading ? <Loader2 size={14} className="animate-spin text-primary" /> : <ArrowUpFromLine size={14} className="text-primary" />}
                {t("رفع ملف .srt", "Upload .srt File")}
              </button>
            </div>
          </div>

          {/* Direct Download */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-serif font-semibold text-white mb-1 flex items-center gap-2">
              <Smartphone size={18} className="text-primary" />
              {t("تحميل مباشر", "Direct Download")}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {t("MP4 مباشر - يعمل على جميع الأجهزة بدون برامج torrent", "Direct MP4 — works on all devices. No torrent client needed.")}
            </p>
            <a href={directDownloadUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-primary font-medium text-sm transition-colors group">
              <ArrowDownToLine size={16} className="group-hover:-translate-y-0.5 transition-transform" />
              {isSeries ? `${t("تحميل", "Download")} S${season}E${episode} (MP4)` : t("تحميل الفيلم (MP4)", "Download Movie (MP4)")}
            </a>
          </div>

          {/* Torrent Downloads */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-serif font-semibold text-white mb-1 flex items-center gap-2">
              <Download size={18} className="text-primary" />
              {t("روابط التورنت", "Torrent Links")}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{t("لأعلى جودة فيديو متاحة", "For highest available video quality.")}</p>
            {downloadsLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                {t("جاري التحميل...", "Loading...")}
              </div>
            ) : downloads?.links?.length ? (
              <div className="space-y-2">
                {downloads.links.slice(0, 6).map((link: { url: string; quality: string; source: string }, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                    <ExternalLink size={12} className="text-primary shrink-0" />
                    <span className="text-xs text-white font-semibold shrink-0">{link.quality}</span>
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{link.source}</span>
                    <TorrentUrlCopy url={link.url} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">{t("لا توجد روابط تورنت متاحة", "No torrent links available")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Similar Content */}
      {similarItems.length > 0 && (
        <div className="mt-16 pt-8 border-t border-white/5">
          <h2 className="text-xl md:text-2xl font-serif font-semibold text-white mb-6 flex items-center gap-2">
            <Film className="text-primary" size={22} />
            {t("محتوى مشابه", "More Like This")}
          </h2>
          <div className="relative">
            <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {similarItems.map((item, i) => (
                <div key={item.imdbId} className="snap-start flex-shrink-0 w-[140px] md:w-[180px]">
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
                          {item.type === "series" ? <Tv size={28} /> : <Film size={28} />}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <Play fill="currentColor" size={16} className="ml-0.5" />
                        </div>
                      </div>
                      {item.imdbRating && item.imdbRating !== "N/A" && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-semibold text-primary">
                          <Star size={8} fill="currentColor" />
                          {item.imdbRating}
                        </div>
                      )}
                    </div>
                    <h3 className="text-white font-medium text-xs leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-[10px] mt-0.5">{item.year}</p>
                  </Link>
                </div>
              ))}
            </div>
            <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none hidden md:block" />
          </div>
        </div>
      )}
    </div>
  );
}
