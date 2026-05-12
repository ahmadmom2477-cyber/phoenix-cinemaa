import { Router } from "express";

const router = Router();

const WEB_TRACKERS = [
  "wss://tracker.btorrent.xyz",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.fastcast.nz",
];

const YTS_MIRRORS = [
  "https://yts.mx",
  "https://yts.pm",
  "https://yts.torrent.wtf",
  "https://api.yts.nz",
];

const EZTV_MIRRORS = [
  "https://eztvx.to",
  "https://eztv.re",
  "https://eztv.tf",
];

const QUALITY_ORDER = ["1080p", "720p", "2160p", "480p", "360p", "sd"];

function rankQuality(raw: string): number {
  const q = raw.toLowerCase();
  for (let i = 0; i < QUALITY_ORDER.length; i++) {
    if (q.includes(QUALITY_ORDER[i])) return i;
  }
  return 99;
}

function buildMagnet(hash: string, name: string): string {
  const trackers = WEB_TRACKERS.map(encodeURIComponent).join("&tr=");
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}&tr=${trackers}`;
}

function addWebTrackers(magnet: string): string {
  return magnet + WEB_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

/* ── TorrentsDB ─────────────────────────────────────── */
interface TDBStream {
  infoHash?: string;
  name?: string;
  title?: string;
  seeders?: number;
  seeds?: number;
  quality?: string;
  behaviorHints?: { filename?: string };
}

async function fetchTorrentsDB(imdbId: string): Promise<{ magnet: string; label: string; seeds: number; quality: string } | null> {
  try {
    const url = `https://torrentsdb.com/stream/movie/${imdbId}.json`;
    console.log(`[torrent-stream] TorrentsDB fetch: ${url}`);
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000), headers: FETCH_HEADERS });
    if (!resp.ok) {
      console.warn(`[torrent-stream] TorrentsDB HTTP ${resp.status}`);
      return null;
    }
    const json = await resp.json() as { streams?: TDBStream[] };
    const streams = (json?.streams ?? []).filter((s) => !!s.infoHash);
    console.log(`[torrent-stream] TorrentsDB: ${streams.length} streams with infoHash`);
    if (!streams.length) return null;

    const enriched = streams.map((s) => {
      const seeds = s.seeders ?? s.seeds ?? (() => {
        const m = (s.title ?? s.name ?? "").match(/👤\s*(\d+)|seeds?\s*:?\s*(\d+)/i);
        return m ? parseInt(m[1] ?? m[2]) : 0;
      })();
      const rawText = [s.quality ?? "", s.name ?? "", s.title ?? ""].join(" ");
      const qm = rawText.match(/\b(2160p|4K|1080p|720p|480p|360p)\b/i);
      const quality = qm ? qm[1].replace(/^4k$/i, "2160p") : "SD";
      const filename = s.behaviorHints?.filename ?? s.name ?? "";
      const isMp4 = /\.mp4$/i.test(filename);
      /* TorrentsDB puts source name in `name` (e.g. "TorrentsDB\n1080p");
         use the passed movie title for the label instead */
      const nameClean = (s.title ?? s.name ?? "Unknown").replace(/\n.*/s, "").trim().slice(0, 60);
      return { stream: s, seeds, quality, isMp4, label: `${quality} · ${seeds} Seeds` };
    });

    enriched.sort((a, b) => {
      if (b.seeds !== a.seeds) return b.seeds - a.seeds;
      const qd = rankQuality(a.quality) - rankQuality(b.quality);
      if (qd !== 0) return qd;
      return (b.isMp4 ? 1 : 0) - (a.isMp4 ? 1 : 0);
    });

    const best = enriched[0];
    const magnet = buildMagnet(best.stream.infoHash!, best.stream.name ?? "Movie");
    console.log(`[torrent-stream] TorrentsDB selected: ${best.label}`);
    return { magnet, label: best.label, seeds: best.seeds, quality: best.quality };
  } catch (e) {
    console.warn("[torrent-stream] TorrentsDB error:", e);
    return null;
  }
}

/* ── YTS ─────────────────────────────────────────────── */
async function fetchYTS(imdbId: string, title: string): Promise<{ magnet: string; label: string; seeds: number; quality: string } | null> {
  for (const mirror of YTS_MIRRORS) {
    try {
      const resp = await fetch(`${mirror}/api/v2/movie_details.json?imdb_id=${imdbId}`, {
        signal: AbortSignal.timeout(8000),
        headers: FETCH_HEADERS,
      });
      if (!resp.ok) continue;
      const json = await resp.json() as { data?: { movie?: { torrents?: { quality: string; hash: string; seeds: number }[] } } };
      const torrents = json?.data?.movie?.torrents ?? [];
      if (!torrents.length) continue;

      console.log(`[torrent-stream] YTS (${mirror}): ${torrents.length} torrents`);

      const sorted = [...torrents].sort((a, b) => {
        if (b.seeds !== a.seeds) return b.seeds - a.seeds;
        return rankQuality(a.quality) - rankQuality(b.quality);
      });

      const best = sorted[0];
      const magnet = buildMagnet(best.hash, title || imdbId);
      const label = `${title || imdbId} · ${best.quality} · ${best.seeds} Seeds`;
      console.log(`[torrent-stream] YTS selected: ${label}`);
      return { magnet, label, seeds: best.seeds, quality: best.quality };
    } catch (e) {
      console.warn(`[torrent-stream] YTS ${mirror} error:`, e);
    }
  }
  return null;
}

/* ── APIBay/TPB ──────────────────────────────────────── */
async function fetchAPIBay(imdbId: string, title: string): Promise<{ magnet: string; label: string; seeds: number; quality: string } | null> {
  try {
    const resp = await fetch(`https://apibay.org/q.php?q=${encodeURIComponent(imdbId)}&cat=200,207,208`, {
      signal: AbortSignal.timeout(8000),
      headers: FETCH_HEADERS,
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.trim() === "...") return null;

    const list = JSON.parse(text) as { name: string; info_hash: string; seeders: string }[];
    const withSeeds = list.filter((t) => parseInt(t.seeders) > 0);
    if (!withSeeds.length) return null;

    withSeeds.sort((a, b) => {
      const qd = rankQuality(a.name) - rankQuality(b.name);
      if (qd !== 0) return qd;
      return parseInt(b.seeders) - parseInt(a.seeders);
    });

    const best = withSeeds[0];
    const qm = best.name.match(/\b(2160p|1080p|720p|480p)\b/i);
    const quality = qm?.[1] ?? "HD";
    const magnet = buildMagnet(best.info_hash, title || best.name);
    const label = `${best.name.slice(0, 50)} · ${quality} · ${best.seeders} Seeds`;
    console.log(`[torrent-stream] APIBay selected: ${label}`);
    return { magnet, label, seeds: parseInt(best.seeders), quality };
  } catch (e) {
    console.warn("[torrent-stream] APIBay error:", e);
    return null;
  }
}

/* ── EZTV ────────────────────────────────────────────── */
async function fetchEZTV(numericId: string, season?: string, episode?: string): Promise<{ magnet: string; label: string; seeds: number; quality: string } | null> {
  for (const mirror of EZTV_MIRRORS) {
    try {
      const resp = await fetch(`${mirror}/api/get-torrents?imdb_id=${numericId}&limit=100`, {
        signal: AbortSignal.timeout(10000),
        headers: FETCH_HEADERS,
      });
      if (!resp.ok) continue;

      const json = await resp.json() as { torrents?: { filename: string; magnet_url: string; seeds: number; season: string; episode: string }[] };
      let torrents = json?.torrents ?? [];
      if (!torrents.length) continue;

      console.log(`[torrent-stream] EZTV (${mirror}): ${torrents.length} torrents`);

      if (season && episode) {
        const ep = torrents.filter((t) => String(t.season) === season && String(t.episode) === episode);
        if (ep.length > 0) torrents = ep;
      }

      torrents.sort((a, b) => {
        const qd = rankQuality(a.filename) - rankQuality(b.filename);
        if (qd !== 0) return qd;
        return (b.seeds ?? 0) - (a.seeds ?? 0);
      });

      const best = torrents[0];
      const qm = best.filename.match(/\b(2160p|1080p|720p|480p)\b/i);
      const quality = qm?.[1] ?? "HD";
      const label = `S${season ?? "?"}E${episode ?? "?"} · ${quality} · ${best.seeds ?? 0} Seeds`;
      const magnet = addWebTrackers(best.magnet_url);
      console.log(`[torrent-stream] EZTV selected: ${label}`);
      return { magnet, label, seeds: best.seeds ?? 0, quality };
    } catch (e) {
      console.warn(`[torrent-stream] EZTV ${mirror} error:`, e);
    }
  }
  return null;
}

/* ── Route: GET /api/torrent-stream/:imdbId ───────────── */
router.get("/torrent-stream/:imdbId", async (req, res) => {
  const imdbId = req.params["imdbId"] ?? "";
  const type = (req.query["type"] as string) ?? "movie";
  const season = req.query["season"] as string | undefined;
  const episode = req.query["episode"] as string | undefined;
  const title = (req.query["title"] as string) ?? imdbId;

  if (!imdbId.match(/^tt\d+$/)) {
    res.status(400).json({ error: "invalid_imdb_id" });
    return;
  }

  console.log(`[torrent-stream] Request: ${imdbId} type=${type} s=${season} e=${episode}`);

  let result: { magnet: string; label: string; seeds: number; quality: string } | null = null;

  if (type === "series") {
    const numericId = imdbId.replace(/^tt/, "");
    result = await fetchEZTV(numericId, season, episode);
  } else {
    /* Try sources in order: TorrentsDB → YTS → APIBay */
    result = await fetchTorrentsDB(imdbId);
    if (!result) result = await fetchYTS(imdbId, title);
    if (!result) result = await fetchAPIBay(imdbId, title);
  }

  if (!result) {
    console.error(`[torrent-stream] No source found for ${imdbId}`);
    res.status(404).json({ error: "no_source", message: "عذراً، لا توجد مصادر تورنت متاحة حالياً لهذا الفيلم" });
    return;
  }

  console.log(`[torrent-stream] ✓ Returning magnet for ${imdbId}: ${result.label}`);
  res.json(result);
});

export default router;
