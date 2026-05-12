/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║               PHOENIX SUBTITLE API — Internal Module Guide               ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Discovery pipeline (IMDB ID → SRT file):                                ║
 * ║  1. Persistent IMDB→Subscene ID cache  (subscene-id-cache.json)          ║
 * ║  2. In-memory browse index (100 pages × ~50 entries, refreshed 30min)    ║
 * ║  3. Slug-based search  /subtitles/<slug>[-year]  (no Cloudflare gate)    ║
 * ║  4. Python scraper (sub finder/main.py) — green-first + keyword rank     ║
 * ║  5. Node.js regex fallback — direct HTML parse of subscene movie page    ║
 * ║                                                                           ║
 * ║  Keyword priority: iTunes > CimaNow > Netflix > Amazon > Disney >        ║
 * ║    EgyBest > WEB-DL > WEBRip > BluRay > BDRip > HDTV                    ║
 * ║                                                                           ║
 * ║  Encoding detection: UTF-8 → Windows-1256 → Latin-1 fallback             ║
 * ║  Subtitle storage: in-memory map, 8-hour TTL, auto-cleanup               ║
 * ║  Manual upload:  POST /api/subtitles  (plain text SRT, 5 MB limit)       ║
 * ║  Search:         GET  /api/subtitles/search?imdbId=&title=&year=         ║
 * ║  Fetch+extract:  POST /api/subtitles/fetch  { downloadLink }             ║
 * ║  Serve SRT:      GET  /api/subtitles/:id.srt                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { Router, text } from "express";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { gunzip } from "zlib";
import { promisify } from "util";
import { exec } from "child_process";
import AdmZip from "adm-zip";

const router = Router();
const gunzipAsync = promisify(gunzip);

// ── Paths ─────────────────────────────────────────────────────────────────────
const __dirLocal = dirname(fileURLToPath(import.meta.url));
const _distMode = __dirLocal.includes("/dist");
const DATA_DIR = _distMode
  ? join(__dirLocal, "..", "data")
  : join(__dirLocal, "..", "..", "data");
const CACHE_FILE = join(DATA_DIR, "subscene-id-cache.json");

// ── In-memory stores ──────────────────────────────────────────────────────────
const SUBTITLE_STORE = new Map<string, string>();
const DOWNLOAD_CACHE = new Map<string, string>();

// ── Subscene movie ID cache (IMDB ID → subscene movie ID, persisted) ─────────
let idCache: Record<string, number> = {};

function loadIdCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      idCache = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<string, number>;
    }
  } catch {}
}
function saveIdCache() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(idCache, null, 2));
  } catch {}
}
loadIdCache();

// ── Keyword priority ──────────────────────────────────────────────────────────
const KEYWORD_PRIORITY = [
  "iTunes", "CimaNow", "Netflix", "Amazon", "Disney",
  "EgyBest", "WEB-DL", "WEBRip", "BluRay", "BDRip", "HDTV",
];

function scoreByKeyword(name: string): number {
  const lower = name.toLowerCase();
  for (let i = 0; i < KEYWORD_PRIORITY.length; i++) {
    if (lower.includes(KEYWORD_PRIORITY[i].toLowerCase())) return KEYWORD_PRIORITY.length - i + 1;
  }
  return 0;
}

// ── Shared HTTP headers ───────────────────────────────────────────────────────
const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
};

// ── Title normalization ───────────────────────────────────────────────────────
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function titleSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const aWords = a.split(/\s+/);
  const bWords = new Set(b.split(/\s+/));
  const common = aWords.filter((w) => w.length > 2 && bWords.has(w)).length;
  const total = aWords.length + bWords.size;
  return total === 0 ? 0 : Math.round((common * 2 / total) * 100);
}

// ── Browse index ──────────────────────────────────────────────────────────────
interface BrowseEntry {
  movieId: number;
  title: string;
  titleNorm: string;
  year: string;
}

let browseIndex: BrowseEntry[] = [];
let browseIndexedAt = 0;
let browseIndexPromise: Promise<void> | null = null;
// How many pages to load — 100 pages × ~50 entries = ~5000 movies
const BROWSE_PAGES = 100;

async function parseBrowsePage(page: number): Promise<BrowseEntry[]> {
  const url = page === 1
    ? "https://sub-scene.com/browse/latest/film"
    : `https://sub-scene.com/browse/latest/film/page/${page}`;
  try {
    const res = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.includes("Just a moment") || html.includes("cf-challenge")) return [];

    const entries: BrowseEntry[] = [];
    const seen = new Set<number>();
    // Each row: /subscene/{movieId}/{lang} … subtitle link with title (year)
    const rowRe = /href="\/subscene\/(\d+)\/[^"]*"[\s\S]{0,400}?href="\/subtitle\/\d+">([\s\S]{0,200}?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(html)) !== null) {
      const movieId = parseInt(m[1]);
      if (!movieId || seen.has(movieId)) continue;
      const rawTitle = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const yearMatch = /\((\d{4})\)/.exec(rawTitle);
      const year = yearMatch ? yearMatch[1] : "";
      const title = rawTitle.replace(/\(\d{4}\)\s*$/, "").trim();
      if (!title) continue;
      seen.add(movieId);
      entries.push({ movieId, title, titleNorm: normTitle(title), year });
    }
    return entries;
  } catch {
    return [];
  }
}

function refreshBrowseIndex(): Promise<void> {
  const now = Date.now();
  if (browseIndexedAt > 0 && now - browseIndexedAt < 30 * 60 * 1000) return Promise.resolve();
  if (browseIndexPromise) return browseIndexPromise;

  browseIndexPromise = (async () => {
    try {
      const all: BrowseEntry[] = [];
      for (let page = 1; page <= BROWSE_PAGES; page++) {
        const entries = await parseBrowsePage(page);
        if (entries.length === 0 && page > 3) break;
        for (const e of entries) {
          if (!all.find((x) => x.movieId === e.movieId)) all.push(e);
        }
        // Small delay to be polite
        if (page < BROWSE_PAGES) await new Promise((r) => setTimeout(r, 120));
      }
      if (all.length > 0) {
        browseIndex = all;
        browseIndexedAt = Date.now();
        console.log(`[subtitles] browse index built: ${all.length} movies`);
      }
    } finally {
      browseIndexPromise = null;
    }
  })();

  return browseIndexPromise;
}

function searchBrowseIndex(title: string, year?: string): BrowseEntry | null {
  const norm = normTitle(title);
  let bestEntry: BrowseEntry | null = null;
  let bestScore = -1;
  for (const entry of browseIndex) {
    let score = titleSimilarity(norm, entry.titleNorm);
    if (year && entry.year === year) score += 15;
    else if (year && entry.year && Math.abs(parseInt(entry.year) - parseInt(year)) === 1) score += 5;
    if (score > bestScore && score >= 65) { bestScore = score; bestEntry = entry; }
  }
  return bestEntry;
}

// ── Main discovery: IMDB ID → subscene movie ID ───────────────────────────────
/** Convert title to Subscene slug: lowercase, spaces→hyphens, strip non-alphanum */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Try /subtitles/<slug> or /subtitles/<slug>-<year> — no Cloudflare on these pages */
async function findBySlug(title: string, year?: string): Promise<number | null> {
  const slug = titleToSlug(title);
  const candidates: string[] = [];
  if (year) candidates.push(`https://sub-scene.com/subtitles/${slug}-${year}`);
  candidates.push(`https://sub-scene.com/subtitles/${slug}`);

  for (const url of candidates) {
    try {
      const resp = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(12000), redirect: "follow" });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.includes("Just a moment") || html.includes("cf-challenge")) continue;
      // Find first /subscene/<id> link
      const m = html.match(/href="\/subscene\/(\d+)/);
      if (m) {
        const id = parseInt(m[1]);
        console.log(`[subtitles] slug found movieId=${id} via ${url}`);
        return id;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function findSubsceneId(imdbId: string, title: string, year?: string): Promise<number | null> {
  // 1. Persistent cache
  if (idCache[imdbId]) return idCache[imdbId];

  // 2. Build/refresh browse index (non-blocking: start but don't wait for completion)
  refreshBrowseIndex().catch(() => {});

  // 3. Search browse index (if already built)
  if (browseIndex.length > 0) {
    const found = searchBrowseIndex(title, year);
    if (found) {
      idCache[imdbId] = found.movieId;
      setImmediate(() => saveIdCache());
      return found.movieId;
    }
  }

  // 4. Slug-based search (no Cloudflare, works for any movie)
  const slugId = await findBySlug(title, year);
  if (slugId) {
    idCache[imdbId] = slugId;
    setImmediate(() => saveIdCache());
    return slugId;
  }

  // 5. Wait for browse index to finish if still building, then retry
  if (browseIndexPromise) {
    await browseIndexPromise.catch(() => {});
    const found = searchBrowseIndex(title, year);
    if (found) {
      idCache[imdbId] = found.movieId;
      setImmediate(() => saveIdCache());
      return found.movieId;
    }
  }

  return null;
}

// ── Parse Arabic subtitles from subscene movie page ───────────────────────────
interface SubEntry { subtitleId: number; name: string; score: number }

async function fetchArabicSubs(movieId: number): Promise<SubEntry[]> {
  const url = `https://sub-scene.com/subscene/${movieId}`;
  try {
    const res = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.includes("Just a moment") || html.includes("challenge-running")) return [];

    const entries: SubEntry[] = [];
    const seen = new Set<number>();
    const segments = html.split(/(?=href="\/subtitle\/\d+")/i);
    for (const seg of segments) {
      const idMatch = /href="\/subtitle\/(\d+)"/i.exec(seg);
      if (!idMatch) continue;
      const subtitleId = parseInt(idMatch[1]);
      if (!subtitleId || seen.has(subtitleId)) continue;
      if (!/arabic/i.test(seg.slice(0, 1000))) continue;
      seen.add(subtitleId);
      const nameMatch =
        /class="[^"]*new[^"]*"[^>]*>\s*([^<]{2,120})\s*</i.exec(seg) ||
        /class="[^"]*name[^"]*"[^>]*>\s*([^<]{2,120})\s*</i.exec(seg);
      const name = nameMatch ? nameMatch[1].trim() : `Subtitle ${subtitleId}`;
      entries.push({ subtitleId, name, score: scoreByKeyword(name) });
    }
    entries.sort((a, b) => b.score - a.score || b.subtitleId - a.subtitleId);
    return entries;
  } catch {
    return [];
  }
}

// ── SRT encoding detection & decode ──────────────────────────────────────────
function decodeSrtBuffer(buf: Buffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch {}
  try { return new TextDecoder("windows-1256").decode(buf); } catch {}
  return buf.toString("latin1");
}

// ── ZIP extraction — picks best SRT using adm-zip ─────────────────────────────
function extractBestSrtFromZip(buf: Buffer): string | null {
  try {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith(".srt") && !e.isDirectory);
    if (entries.length === 0) return null;
    const scored = entries.map((e) => ({
      entry: e,
      score: scoreByKeyword(e.entryName),
      colored: /colou?red/i.test(e.entryName),
    }));
    scored.sort((a, b) => {
      if (a.colored !== b.colored) return a.colored ? 1 : -1;
      return b.score - a.score;
    });
    const data = scored[0].entry.getData();
    return decodeSrtBuffer(data);
  } catch { return null; }
}

// ── Download + extract subtitle ───────────────────────────────────────────────
async function downloadAndExtract(subtitleId: string): Promise<string | null> {
  const downloadUrl = `https://sub-scene.com/download/${subtitleId}`;
  try {
    const r = await fetch(downloadUrl, {
      headers: { ...HTTP_HEADERS, Accept: "application/octet-stream,*/*", Referer: `https://sub-scene.com/subtitle/${subtitleId}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const magic = buf.subarray(0, 4);
    const isZip = magic[0] === 0x50 && magic[1] === 0x4b;
    const isGzip = magic[0] === 0x1f && magic[1] === 0x8b;
    if (isZip) return extractBestSrtFromZip(buf);
    if (isGzip) {
      try { return decodeSrtBuffer(await gunzipAsync(buf)); } catch {}
    }
    const text = decodeSrtBuffer(buf);
    if (text.includes("-->")) return text;
    return null;
  } catch { return null; }
}

// ── SRT helpers ───────────────────────────────────────────────────────────────
function storeSrt(content: string): string {
  const id = randomUUID();
  SUBTITLE_STORE.set(id, content);
  const timer = setTimeout(() => SUBTITLE_STORE.delete(id), 8 * 60 * 60 * 1000);
  if (timer && typeof timer === "object") (timer as NodeJS.Timeout).unref?.();
  return id;
}

function msToSrtTime(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000), rem = ms % 1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(rem).padStart(3,"0")}`;
}

function srtTimeToMs(t: string): number {
  const parts = t.split(":");
  if (parts.length < 3) return 0;
  const [h, m, sMsRaw] = parts, [s, ms = "0"] = sMsRaw.split(",");
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 + parseInt(ms);
}

function shiftSrt(content: string, offsetSec: number): string {
  if (offsetSec === 0) return content;
  const offsetMs = Math.round(offsetSec * 1000);
  return content.replace(
    /(\d{1,2}:\d{2}:\d{2},\d{3}) --> (\d{1,2}:\d{2}:\d{2},\d{3})/g,
    (_, start, end) => `${msToSrtTime(srtTimeToMs(start) + offsetMs)} --> ${msToSrtTime(srtTimeToMs(end) + offsetMs)}`
  );
}

// ── Python subtitle search ─────────────────────────────────────────────────────
const execAsync = promisify(exec);
const PYTHON_SEARCH_CACHE = new Map<string, { data: { keyword: string; url: string }[]; at: number }>();
const PYTHON_CACHE_TTL = 30 * 60 * 1000;

// Resolve path to Python CLI script (workspace root / sub finder / main.py)
const PYTHON_SCRIPT = (() => {
  const candidates = [
    resolve(process.cwd(), "sub finder/main.py"),
    resolve(__dirLocal, "../../../../sub finder/main.py"),
    resolve(__dirLocal, "../../../sub finder/main.py"),
    resolve(__dirLocal, "../../../../../../sub finder/main.py"),
  ];
  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch {}
  }
  // fallback: assume cwd is workspace root
  return resolve(process.cwd(), "sub finder/main.py");
})();

async function runPythonSearch(subsceneUrl: string): Promise<{ keyword: string; url: string }[] | null> {
  const cacheKey = subsceneUrl.toLowerCase().trim();
  const cached = PYTHON_SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < PYTHON_CACHE_TTL) {
    console.log(`[subtitles/python] cache hit: ${cacheKey}`);
    return cached.data;
  }

  // Pass URL directly to Python — no Cloudflare bypass needed for /subscene/ pages
  const safeUrl = subsceneUrl.replace(/["`\\$]/g, "");
  const cmd = `python3 "${PYTHON_SCRIPT}" --url "${safeUrl}"`;
  console.log(`[subtitles/python] running: ${cmd}`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 200000, // 3.3 minutes
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    if (stderr?.trim()) {
      console.log(`[subtitles/python] stderr: ${stderr.trim().slice(-600)}`);
    }

    // The Python script prints JSON as the last line to stdout
    const lines = stdout.trim().split("\n").filter((l) => l.trim().startsWith("{"));
    const jsonLine = lines[lines.length - 1];
    if (!jsonLine) { console.warn("[subtitles/python] no JSON output"); return null; }

    const parsed = JSON.parse(jsonLine) as { status: string; data?: { keyword: string; url: string }[]; message?: string };
    if (parsed.status === "success" && Array.isArray(parsed.data) && parsed.data.length > 0) {
      PYTHON_SEARCH_CACHE.set(cacheKey, { data: parsed.data, at: Date.now() });
      console.log(`[subtitles/python] found ${parsed.data.length} subtitles`);
      return parsed.data;
    }
    console.warn(`[subtitles/python] no results: ${parsed.message ?? "unknown"}`);
    return null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[subtitles/python] exec error: ${msg.slice(0, 300)}`);
    return null;
  }
}

// ── Kick off browse index build on startup ────────────────────────────────────
setImmediate(() => { refreshBrowseIndex().catch(() => {}); });

// ══════════════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════════════

router.post("/subtitles", text({ type: "*/*", limit: "5mb" }), (req, res) => {
  const content = req.body;
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Invalid subtitle content" }); return;
  }
  res.json({ id: storeSrt(content) });
});

router.get("/subtitles/search", async (req, res) => {
  const imdbId = req.query.imdbId as string | undefined;
  const title = (req.query.title as string | undefined) ?? imdbId ?? "";
  const year = req.query.year as string | undefined;
  if (!title) { res.status(400).json({ error: "Missing title or imdbId" }); return; }

  // ── Step 1: Find Subscene movie ID via browse index (fast, no Cloudflare) ──
  if (!imdbId) { res.json({ subtitles: [], source: "subscene", found: false }); return; }

  let movieId: number | null = null;
  try {
    req.log.info({ imdbId, title, year, browseIndexSize: browseIndex.length }, "finding subscene movieId");
    movieId = await findSubsceneId(imdbId, title, year);
    req.log.info({ movieId }, "subscene movieId resolved");
  } catch (err) {
    req.log.warn({ err }, "findSubsceneId failed");
  }

  if (!movieId) { res.json({ subtitles: [], source: "subscene", found: false }); return; }

  const subsceneMovieUrl = `https://sub-scene.com/subscene/${movieId}`;

  // ── Step 2: Python extracts subtitle links (green-first + keyword matching) ─
  try {
    req.log.info({ subsceneMovieUrl }, "python subtitle extraction starting");
    const pythonResults = await runPythonSearch(subsceneMovieUrl);

    if (pythonResults && pythonResults.length > 0) {
      req.log.info({ count: pythonResults.length }, "python subtitle extraction succeeded");

      const GREEN_SCORE = 10;
      const KEYWORD_SCORE = 6;
      const GENERIC_SCORE = 3;

      res.json({
        subtitles: pythonResults.map((item, i) => {
          const isGreen = item.keyword.includes("Green");
          const isGeneric = item.keyword === "Arabic";
          const score = isGreen ? GREEN_SCORE : isGeneric ? GENERIC_SCORE : KEYWORD_SCORE;
          return {
            id: `py_${i}`,
            fileId: `py_${i}`,
            fileName: item.keyword,
            releaseName: item.keyword,
            downloadLink: item.url,
            language: "Arabic",
            score,
            downloads: 0,
            rating: score,
            hearingImpaired: false,
            comments: item.keyword,
          };
        }),
        source: "python",
        found: true,
      });
      return;
    }
    req.log.info("python returned no results, falling back to Node.js regex parsing");
  } catch (err) {
    req.log.warn({ err }, "python subtitle extraction failed, falling back");
  }

  // ── Step 3: Fallback — Node.js regex-based parsing ────────────────────────
  try {
    const subs = await fetchArabicSubs(movieId);
    req.log.info({ subsCount: subs.length }, "fetchArabicSubs fallback");

    if (subs.length === 0) { res.json({ subtitles: [], source: "subscene", found: false }); return; }

    res.json({
      subtitles: subs.slice(0, 25).map((s) => ({
        id: String(s.subtitleId),
        fileId: String(s.subtitleId),
        fileName: s.name,
        releaseName: s.name,
        downloadLink: String(s.subtitleId),
        language: "Arabic",
        score: s.score,
        downloads: 0,
        rating: s.score,
        hearingImpaired: false,
        comments: s.score > 0
          ? (KEYWORD_PRIORITY.find((k) => s.name.toLowerCase().includes(k.toLowerCase())) ?? "")
          : "",
      })),
      source: "subscene",
      found: true,
    });
  } catch (err) {
    req.log.error({ err }, "subtitle search error");
    res.json({ subtitles: [], source: "subscene", found: false });
  }
});

router.post("/subtitles/fetch", async (req, res) => {
  const body = req.body as { fileId?: string; downloadLink?: string };
  const rawId = body.downloadLink || body.fileId;
  if (!rawId) { res.status(400).json({ error: "Missing fileId or downloadLink" }); return; }
  const subtitleId = String(rawId).replace(/\D/g, "");
  if (!subtitleId) { res.status(400).json({ error: "Invalid subtitle ID" }); return; }

  const cacheKey = `sub_${subtitleId}`;
  if (DOWNLOAD_CACHE.has(cacheKey)) {
    const cachedId = DOWNLOAD_CACHE.get(cacheKey)!;
    if (SUBTITLE_STORE.has(cachedId)) {
      const host = `${req.protocol}://${req.get("host")}`;
      res.json({ id: cachedId, url: `${host}/api/subtitles/${cachedId}.srt`, cached: true }); return;
    }
    DOWNLOAD_CACHE.delete(cacheKey);
  }

  try {
    const srt = await downloadAndExtract(subtitleId);
    if (!srt?.trim()) { res.status(502).json({ error: "Could not extract subtitle from download" }); return; }
    const id = storeSrt(srt);
    DOWNLOAD_CACHE.set(cacheKey, id);
    if (DOWNLOAD_CACHE.size > 800) {
      const k = DOWNLOAD_CACHE.keys().next().value;
      if (k !== undefined) DOWNLOAD_CACHE.delete(k);
    }
    const host = `${req.protocol}://${req.get("host")}`;
    res.json({ id, url: `${host}/api/subtitles/${id}.srt` });
  } catch (err) {
    req.log.error({ err }, "subtitle fetch error");
    res.status(502).json({ error: "Failed to process subtitle" });
  }
});

// ── SRT → WebVTT converter ────────────────────────────────────────────────────
function srtToVtt(srt: string): string {
  const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n{2,}/);
  const vttBlocks: string[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    // Skip sequence number line if it's just digits
    const start = /^\d+$/.test(lines[0]) ? 1 : 0;
    const timeLineIdx = lines.findIndex((l, i) => i >= start && /-->/.test(l));
    if (timeLineIdx < 0) continue;
    const timeLine = lines[timeLineIdx].replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    const text = lines.slice(timeLineIdx + 1).join("\n").trim();
    if (!text) continue;
    vttBlocks.push(`${timeLine}\n${text}`);
  }
  return `WEBVTT\n\n${vttBlocks.join("\n\n")}`;
}

router.options("/subtitles/:filename", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.sendStatus(204);
});

// Serve as WebVTT (for native HTML5 <track> element)
router.get("/subtitles/:id.vtt", (req, res) => {
  const id = req.params.id;
  const rawContent = SUBTITLE_STORE.get(id);
  if (!rawContent) { res.status(404).send("Not found"); return; }
  const vtt = srtToVtt(rawContent);
  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Cache-Control", "no-cache");
  res.send(vtt);
});

// Serve as plain SRT
router.get("/subtitles/:filename", (req, res) => {
  const id = req.params.filename.replace(/\.srt$/i, "");
  const rawContent = SUBTITLE_STORE.get(id);
  if (!rawContent) { res.status(404).send("Not found"); return; }
  const offsetParam = req.query.offset;
  const offsetSec = offsetParam ? parseFloat(offsetParam as string) : 0;
  const content = Number.isFinite(offsetSec) && offsetSec !== 0 ? shiftSrt(rawContent, offsetSec) : rawContent;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Cache-Control", "no-cache");
  res.send(content);
});

export default router;
