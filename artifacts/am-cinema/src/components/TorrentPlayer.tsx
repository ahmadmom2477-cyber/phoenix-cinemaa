import { useEffect, useRef, useState } from "react";
import { Loader2, Wifi, Users, AlertCircle, Zap, BarChart2, Magnet } from "lucide-react";
import type WebTorrentType from "webtorrent";

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

interface TorrentPlayerProps {
  imdbId: string;
  type: "movie" | "series";
  season?: string;
  episode?: string;
  title?: string;
}

type Phase = "fetching" | "connecting" | "streaming" | "error";

/* ══════════════════════════════════════════════════════════
   TorrentPlayer — uses /api/torrent-stream (server-side proxy)
   to bypass CORS on TorrentsDB / YTS / EZTV / APIBay
══════════════════════════════════════════════════════════ */
export default function TorrentPlayer({ imdbId, type, season, episode, title }: TorrentPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<InstanceType<typeof WebTorrentType> | null>(null);

  const [phase, setPhase] = useState<Phase>("fetching");
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [peers, setPeers] = useState(0);
  const [error, setError] = useState("");
  const [magnetUrl, setMagnetUrl] = useState<string | null>(null);
  const [selectionLabel, setSelectionLabel] = useState("");
  const [statsVisible, setStatsVisible] = useState(true);

  /* ── Step 1: ask backend for best magnet link ── */
  useEffect(() => {
    let cancelled = false;

    async function fetchMagnet() {
      try {
        const params = new URLSearchParams({ type, title: title ?? imdbId });
        if (season) params.set("season", season);
        if (episode) params.set("episode", episode);

        const url = `/api/torrent-stream/${imdbId}?${params}`;
        console.log(`[Player5] Calling backend: ${url}`);

        const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const json = await resp.json() as {
          magnet?: string;
          label?: string;
          seeds?: number;
          quality?: string;
          error?: string;
          message?: string;
        };

        if (!resp.ok || !json.magnet) {
          const msg = json.message ?? json.error ?? "لا توجد مصادر تورنت متاحة حالياً لهذا الفيلم";
          console.error(`[Player5] Backend error (${resp.status}):`, msg);
          if (!cancelled) {
            setPhase("error");
            setError(msg);
          }
          return;
        }

        console.log(`[Player5] ✓ Got magnet from backend`);
        console.log(`[Player5] Label: ${json.label}`);
        console.log(`[Player5] Seeds: ${json.seeds} | Quality: ${json.quality}`);
        console.log(`[Player5] Magnet: ${json.magnet}`);

        if (!cancelled) {
          setSelectionLabel(json.label ?? `${json.quality ?? "HD"} · ${json.seeds ?? 0} Seeds`);
          setMagnetUrl(json.magnet);
        }
      } catch (e) {
        console.error("[Player5] Fetch error:", e);
        if (!cancelled) {
          setPhase("error");
          setError("عذراً، لا توجد مصادر تورنت متاحة حالياً لهذا الفيلم");
        }
      }
    }

    fetchMagnet();
    return () => { cancelled = true; };
  }, [imdbId, type, season, episode, title]);

  /* ── Step 2: connect WebTorrent once magnet is ready ── */
  useEffect(() => {
    if (!magnetUrl) return;

    let cancelled = false;
    let statsInterval: ReturnType<typeof setInterval> | null = null;
    setPhase("connecting");

    async function startTorrent() {
      try {
        const WebTorrent = (await import("webtorrent")).default;
        const client = new WebTorrent();
        clientRef.current = client;

        console.log("[Player5] Adding magnet to WebTorrent...");

        client.add(magnetUrl!, (torrent) => {
          if (cancelled) return;

          /* Prefer .mp4, fallback to any video */
          const file =
            torrent.files.find((f) => /\.mp4$/i.test(f.name)) ??
            torrent.files.find((f) => /\.(mkv|webm|avi|mov)$/i.test(f.name));

          if (!file) {
            const names = torrent.files.map((f) => f.name).join(", ");
            console.error(`[Player5] No video file found. Files: ${names}`);
            if (!cancelled) {
              setPhase("error");
              setError("لم يتم العثور على ملف فيديو داخل التورنت");
            }
            return;
          }

          console.log(`[Player5] ✓ Streaming file: ${file.name}`);
          setPhase("streaming");

          if (videoRef.current) {
            file.renderTo(videoRef.current, { autoplay: true });
          }

          statsInterval = setInterval(() => {
            if (cancelled) return;
            setProgress(torrent.progress);
            setDownloadSpeed(torrent.downloadSpeed);
            setPeers(torrent.numPeers);
          }, 1000);

          torrent.on("done", () => {
            if (statsInterval) clearInterval(statsInterval);
            setProgress(1);
            console.log("[Player5] ✓ Download complete");
          });
        });

        client.on("error", (err) => {
          console.error("[Player5] WebTorrent client error:", err);
          if (!cancelled) {
            setPhase("error");
            setError(String(err));
          }
        });
      } catch (e) {
        console.error("[Player5] Failed to initialize WebTorrent:", e);
        if (!cancelled) {
          setPhase("error");
          setError(String(e));
        }
      }
    }

    startTorrent();

    return () => {
      cancelled = true;
      if (statsInterval) clearInterval(statsInterval);
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
        console.log("[Player5] WebTorrent client destroyed");
      }
    };
  }, [magnetUrl]);

  /* ── Auto-hide stats bar after 6s of streaming ── */
  useEffect(() => {
    if (phase !== "streaming") return;
    const timer = setTimeout(() => setStatsVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [phase]);

  /* ══════════ Render ══════════ */
  return (
    <div className="relative w-full h-full bg-black" onMouseMove={() => setStatsVisible(true)}>
      <video
        ref={videoRef}
        id="torrent-canvas"
        className="w-full h-full"
        controls
        autoPlay
        playsInline
      />

      {/* ── Loading overlay ── */}
      {(phase === "fetching" || phase === "connecting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 gap-5 z-20 px-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
              style={{ animationDuration: "0.7s" }}
            />
          </div>

          <div className="text-center">
            <p className="text-white font-semibold text-sm mb-1">
              {phase === "fetching" ? "جاري البحث عن أفضل مصدر..." : "جاري الاتصال بالـ Peers..."}
            </p>
            <p className="text-white/40 text-xs">
              {phase === "fetching"
                ? "TorrentsDB · YTS · TPB · EZTV"
                : "Connecting via WebTorrent (WebRTC)"}
            </p>
          </div>

          {/* Show selection label as soon as a source is picked */}
          {selectionLabel && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/25 max-w-xs text-center">
              <Magnet size={12} className="text-primary shrink-0" />
              <span className="text-primary text-xs font-medium leading-snug break-all">
                {selectionLabel}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Error overlay ── */}
      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 gap-4 z-20 p-6">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-white font-semibold text-base mb-2">تعذّر تشغيل التورنت</p>
            <p className="text-red-300/80 text-sm bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20 leading-relaxed">
              {error}
            </p>
          </div>
          <p className="text-white/30 text-xs text-center">جرّب مصدراً آخر (Source 1–4) أو عُد لاحقاً</p>
        </div>
      )}

      {/* ── Streaming stats overlay ── */}
      {phase === "streaming" && (
        <div
          className={`absolute top-0 left-0 right-0 z-10 transition-opacity duration-700 pointer-events-none ${
            statsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-start gap-2 flex-wrap p-3">
            {/* Source label */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-medium text-white/90 max-w-[260px]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span className="truncate">{selectionLabel || "WebTorrent"}</span>
            </div>

            {/* Download speed */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-white/70">
              <Zap size={10} className="text-primary" />
              {formatSpeed(downloadSpeed)}
            </div>

            {/* Peers */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-white/70">
              <Users size={10} className="text-blue-400" />
              {peers} {peers === 1 ? "peer" : "peers"}
            </div>

            {/* Cache % */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-white/70">
              <BarChart2 size={10} className="text-yellow-400" />
              {(progress * 100).toFixed(1)}% cached
            </div>

            {/* Searching for peers warning */}
            {peers === 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-yellow-500/30 text-[11px] text-yellow-300/80">
                <Wifi size={10} />
                Searching for peers…
              </div>
            )}
          </div>

          {/* Buffer progress bar */}
          {progress > 0 && progress < 1 && (
            <div className="mx-3 mb-1">
              <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(progress * 100, 2)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
