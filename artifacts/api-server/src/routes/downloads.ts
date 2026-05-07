import { Router } from "express";
import { GetDownloadLinksParams, GetDownloadLinksQueryParams } from "@workspace/api-zod";

const router = Router();

const TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://p4p.arenabg.com:1337",
  "udp://tracker.leechers-paradise.org:6969",
  "udp://9.rarbg.to:2710/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.tiny-vps.com:6969/announce",
  "udp://tracker.internetwarriors.net:1337/announce",
  "udp://tracker.pirateparty.gr:6969/announce",
].map(encodeURIComponent).join("&tr=");

function buildMagnet(hash: string, title: string): string {
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}&tr=${TRACKERS}`;
}

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!n || isNaN(n)) return "Unknown";
  const gb = n / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = n / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

interface YtsTorrent {
  quality: string;
  type: string;
  url: string;
  hash: string;
  size_bytes: number;
  seeds: number;
  peers: number;
}

interface EztvTorrent {
  filename: string;
  magnet_url: string;
  torrent_url?: string;
  size_bytes: number;
  seeds: number;
  peers: number;
  season: string;
  episode: string;
}

interface ApibayTorrent {
  name: string;
  info_hash: string;
  seeders: string;
  leechers: string;
  size: string;
  category: string;
}

const YTS_MIRRORS = [
  "https://yts.mx",
  "https://yts.pm",
  "https://yts.torrent.wtf",
  "https://api.yts.nz",
  "https://yts.world",
];

async function fetchYts(imdbId: string, title: string) {
  for (const mirror of YTS_MIRRORS) {
    try {
      const resp = await fetch(`${mirror}/api/v2/movie_details.json?imdb_id=${imdbId}`, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });
      if (!resp.ok) continue;
      const json = await resp.json() as { data?: { movie?: { torrents?: YtsTorrent[] } } };
      const torrents = json?.data?.movie?.torrents;
      if (!torrents?.length) continue;
      return torrents.map((t) => ({
        quality: t.quality,
        type: t.type,
        size: formatBytes(t.size_bytes),
        magnet: buildMagnet(t.hash, title || imdbId),
        torrentUrl: t.url,
        seeds: t.seeds,
        peers: t.peers,
        source: "yts" as const,
      }));
    } catch {
      // try next mirror
    }
  }
  return null;
}

async function fetchApibay(imdbId: string, title: string) {
  try {
    const resp = await fetch(`https://apibay.org/q.php?q=${encodeURIComponent(imdbId)}&cat=200,207,208`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.trim() === "...") return null;
    const json = JSON.parse(text) as ApibayTorrent[];
    if (!Array.isArray(json) || json.length === 0) return null;
    const filtered = json.filter((t) => parseInt(t.seeders ?? "0", 10) > 0);
    const ranked = filtered.sort((a, b) => parseInt(b.seeders, 10) - parseInt(a.seeders, 10));
    const top = ranked.slice(0, 6);

    const qualityRx = /\b(2160p|4K|1080p|720p|480p|360p)\b/i;
    return top.map((t) => {
      const qm = t.name.match(qualityRx);
      const quality = qm ? qm[1].replace(/^4k$/i, "2160p").toLowerCase() : "unknown";
      const encodingM = t.name.match(/\b(BluRay|BRRip|WEBRip|WEB-DL|HDTV|DVDRip|x264|x265|HEVC)\b/i);
      const encoding = encodingM ? encodingM[1].toLowerCase() : "web";
      return {
        quality,
        type: encoding,
        size: formatBytes(t.size),
        magnet: buildMagnet(t.info_hash, title || t.name),
        torrentUrl: null,
        seeds: parseInt(t.seeders, 10),
        peers: parseInt(t.leechers, 10),
        source: "tpb" as const,
      };
    });
  } catch {
    return null;
  }
}

const EZTV_MIRRORS = [
  "https://eztvx.to",
  "https://eztv.re",
  "https://eztv.tf",
];

function torrentQuality(filename: string): string {
  const m = filename.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
  if (!m) return "SD";
  return m[1].replace(/^4k$/i, "2160p").toLowerCase();
}

async function fetchEztv(numericImdbId: string, season?: string, episode?: string) {
  for (const mirror of EZTV_MIRRORS) {
    try {
      const url = `${mirror}/api/get-torrents?imdb_id=${numericImdbId}&limit=100`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });
      if (!resp.ok) continue;

      const json = await resp.json() as { torrents?: EztvTorrent[] };
      const all = json?.torrents ?? [];
      if (!all.length) continue;

      const toLink = (t: EztvTorrent) => ({
        quality: torrentQuality(t.filename),
        type: "hdtv",
        size: formatBytes(t.size_bytes),
        magnet: t.magnet_url,
        torrentUrl: t.torrent_url ?? null,
        seeds: t.seeds,
        peers: t.peers,
        source: "eztv" as const,
      });

      if (season && episode) {
        const episodeTorrents = all.filter(
          (t) => String(t.season) === String(season) && String(t.episode) === String(episode)
        );
        if (episodeTorrents.length > 0) return episodeTorrents.map(toLink);
        const seasonTorrents = all.filter((t) => String(t.season) === String(season));
        if (seasonTorrents.length > 0) return seasonTorrents.map(toLink);
      }

      return all.map(toLink);
    } catch {
      // try next mirror
    }
  }
  return null;
}

router.get("/downloads/:imdbId", async (req, res) => {
  // Downloads are disabled by default; enable with ENABLE_DOWNLOADS=true env var
  if (process.env["ENABLE_DOWNLOADS"] !== "true") {
    return res.status(404).json({ links: [], available: false, error: "downloads_disabled" });
  }

  const paramsResult = GetDownloadLinksParams.safeParse(req.params);
  const queryResult = GetDownloadLinksQueryParams.safeParse(req.query);

  if (!paramsResult.success) {
    res.status(400).json({ error: "invalid_params", message: "Invalid IMDB ID" });
    return;
  }

  const { imdbId } = paramsResult.data;
  const { type, season, episode } = queryResult.success ? queryResult.data : {};
  const titleParam = (req.query["title"] as string | undefined) ?? "";
  const numericId = imdbId.replace(/^tt/, "");
  const isSeries = type === "series";

  if (isSeries) {
    const links = await fetchEztv(numericId, season, episode);
    if (links && links.length > 0) {
      const seen = new Map<string, typeof links[number]>();
      for (const l of links) {
        const key = l.quality.toLowerCase();
        const existing = seen.get(key);
        if (!existing || (l.seeds ?? 0) > (existing.seeds ?? 0)) seen.set(key, l);
      }
      const qualityOrder = ["2160p", "1080p", "720p", "480p", "360p", "sd"];
      const deduped = Array.from(seen.values()).sort((a, b) => {
        const ai = qualityOrder.indexOf(a.quality.toLowerCase());
        const bi = qualityOrder.indexOf(b.quality.toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      res.json({ links: deduped, available: true, source: "eztv", browseUrl: `https://eztvx.to/search/${numericId}` });
    } else {
      res.json({ links: [], available: false, source: "eztv", browseUrl: `https://eztvx.to/search/${numericId}` });
    }
    return;
  }

  const [ytsLinks, tpbLinks] = await Promise.all([
    fetchYts(imdbId, titleParam || imdbId),
    fetchApibay(imdbId, titleParam || imdbId),
  ]);

  const links = ytsLinks ?? tpbLinks;

  if (links && links.length > 0) {
    res.json({
      links,
      available: true,
      source: ytsLinks ? "yts" : "tpb",
      browseUrl: `https://yts.mx/browse-movies?query_term=${imdbId}`,
    });
  } else {
    res.json({
      links: [],
      available: false,
      source: "yts",
      browseUrl: `https://yts.mx/browse-movies?query_term=${encodeURIComponent(titleParam || imdbId)}`,
    });
  }
});

export default router;
