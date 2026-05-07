import { Router } from "express";
import { SearchMediaQueryParams, GetMediaDetailsParams } from "@workspace/api-zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const router = Router();

// ── Cache setup ────────────────────────────────────────────────────────────
const __dirLocal = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirLocal, "..", "data");
const CACHE_FILE = join(DATA_DIR, "omdb-cache.json");

interface CacheEntry { data: unknown; expiresAt: number; }
let memCache: Map<string, CacheEntry> = new Map();

function loadCache() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(CACHE_FILE)) return;
    const obj = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(obj)) {
      if (v.expiresAt > now) memCache.set(k, v);
    }
  } catch {}
}

function saveCache() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const obj: Record<string, CacheEntry> = {};
    memCache.forEach((v, k) => { obj[k] = v; });
    writeFileSync(CACHE_FILE, JSON.stringify(obj));
  } catch {}
}

function getCached(key: string): unknown | null {
  const entry = memCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) { memCache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Save to disk asynchronously (fire and forget)
  setImmediate(() => saveCache());
}

loadCache();

// ── OMDB key management ────────────────────────────────────────────────────
const OMDB_BASE = "https://www.omdbapi.com";
const OMDB_KEYS = ["6866d5b4", "d19d0e5c", "fccd07eb", "e7f94365", "cae875d0", "eafc380f"];
let keyIndex = 0;
const KEY_HEALTH_FILE = join(DATA_DIR, "omdb-key-health.json");
const keyLimitedAt = new Map<string, number>(); // key → when it was rate-limited
const RESET_AFTER = 8 * 60 * 60 * 1000; // 8 hours

// Load persisted key health from disk
function loadKeyHealth() {
  try {
    if (!existsSync(KEY_HEALTH_FILE)) return;
    const obj = JSON.parse(readFileSync(KEY_HEALTH_FILE, "utf-8")) as Record<string, number>;
    const now = Date.now();
    for (const [key, ts] of Object.entries(obj)) {
      if (now - ts < RESET_AFTER) keyLimitedAt.set(key, ts); // still within reset window
    }
  } catch {}
}

function saveKeyHealth() {
  try {
    const obj: Record<string, number> = {};
    keyLimitedAt.forEach((ts, key) => { obj[key] = ts; });
    writeFileSync(KEY_HEALTH_FILE, JSON.stringify(obj));
  } catch {}
}

loadKeyHealth();

function getAvailableKey(): string | null {
  const now = Date.now();
  for (let i = 0; i < OMDB_KEYS.length; i++) {
    const key = OMDB_KEYS[keyIndex % OMDB_KEYS.length];
    keyIndex++;
    const limitedAt = keyLimitedAt.get(key);
    if (!limitedAt || now - limitedAt > RESET_AFTER) return key;
  }
  return null; // all rate-limited
}

function markKeyLimited(key: string) {
  keyLimitedAt.set(key, Date.now());
  setImmediate(() => saveKeyHealth());
}

const TTL_SEARCH = 60 * 60 * 1000;          // 1 hour
const TTL_MEDIA  = 7 * 24 * 60 * 60 * 1000; // 7 days
const TTL_TREND  = 2 * 60 * 60 * 1000;      // 2 hours

// ── Mappers ────────────────────────────────────────────────────────────────
function mapOmdbSearchItem(item: Record<string, string>) {
  return {
    imdbId: item["imdbID"] ?? "",
    title: item["Title"] ?? "",
    year: item["Year"] ?? "",
    type: item["Type"] ?? "movie",
    poster: item["Poster"] !== "N/A" ? item["Poster"] : null,
    rated: null, plot: null, genre: null, imdbRating: null, totalSeasons: null,
  };
}

function mapOmdbDetail(d: Record<string, string>) {
  return {
    imdbId: d["imdbID"] ?? "",
    title: d["Title"] ?? "",
    year: d["Year"] ?? "",
    type: d["Type"] ?? "movie",
    poster: d["Poster"] !== "N/A" ? d["Poster"] : null,
    rated: d["Rated"] !== "N/A" ? d["Rated"] : null,
    plot: d["Plot"] !== "N/A" ? d["Plot"] : null,
    genre: d["Genre"] !== "N/A" ? d["Genre"] : null,
    director: d["Director"] !== "N/A" ? d["Director"] : null,
    actors: d["Actors"] !== "N/A" ? d["Actors"] : null,
    imdbRating: d["imdbRating"] !== "N/A" ? d["imdbRating"] : null,
    runtime: d["Runtime"] !== "N/A" ? d["Runtime"] : null,
    totalSeasons: d["totalSeasons"] !== "N/A" ? d["totalSeasons"] : null,
    language: d["Language"] !== "N/A" ? d["Language"] : null,
    country: d["Country"] !== "N/A" ? d["Country"] : null,
    awards: d["Awards"] !== "N/A" ? d["Awards"] : null,
  };
}

// ── Search ─────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const parseResult = SearchMediaQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: "invalid_params", message: "Missing required query parameter: q" });
    return;
  }

  const { q, type, year } = parseResult.data;
  const cacheKey = `search:${q}:${type ?? ""}:${year ?? ""}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  const key = getAvailableKey();
  if (!key) {
    res.status(503).json({ error: "rate_limited", message: "API limit reached, please try again later" });
    return;
  }

  const params = new URLSearchParams({ apikey: key, s: q });
  if (type) params.append("type", type);
  if (year) params.append("y", year);

  try {
    const response = await fetch(`${OMDB_BASE}/?${params.toString()}`);
    const data = await response.json() as Record<string, unknown>;

    if (data["Response"] === "False") {
      const err = data["Error"] as string ?? "";
      if (err.toLowerCase().includes("limit")) {
        markKeyLimited(key);
        res.status(503).json({ error: "rate_limited", message: "API limit reached, please try again later" });
        return;
      }
      const empty = { results: [], total: 0 };
      setCache(cacheKey, empty, TTL_SEARCH);
      res.json(empty);
      return;
    }

    const searchArr = (data["Search"] as Record<string, string>[]) ?? [];
    const total = parseInt((data["totalResults"] as string) ?? "0", 10);
    const result = { results: searchArr.map(mapOmdbSearchItem), total };
    setCache(cacheKey, result, TTL_SEARCH);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "OMDB search error");
    res.status(500).json({ error: "search_failed", message: "Failed to fetch search results" });
  }
});

// ── Media detail ───────────────────────────────────────────────────────────
router.get("/media/:imdbId", async (req, res) => {
  const parseResult = GetMediaDetailsParams.safeParse(req.params);
  if (!parseResult.success) {
    res.status(400).json({ error: "invalid_params", message: "Invalid IMDB ID" });
    return;
  }

  const { imdbId } = parseResult.data;
  const cacheKey = `media:${imdbId}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  const key = getAvailableKey();
  if (!key) {
    res.status(503).json({ error: "rate_limited", message: "API limit reached, please try again later" });
    return;
  }

  const params = new URLSearchParams({ apikey: key, i: imdbId, plot: "full" });

  try {
    const response = await fetch(`${OMDB_BASE}/?${params.toString()}`);
    const data = await response.json() as Record<string, string>;

    if (data["Response"] === "False") {
      const err = data["Error"] ?? "";
      if (err.toLowerCase().includes("limit")) {
        markKeyLimited(key);
        res.status(503).json({ error: "rate_limited", message: "API limit reached, please try again later" });
        return;
      }
      res.status(404).json({ error: "not_found", message: `No media found for IMDB ID: ${imdbId}` });
      return;
    }

    const result = mapOmdbDetail(data);
    setCache(cacheKey, result, TTL_MEDIA);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "OMDB media detail error");
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch media details" });
  }
});

// ── Trending helpers ───────────────────────────────────────────────────────
const POPULAR_MOVIES = [
  "tt0468569","tt1375666","tt0109830","tt0816692","tt0133093",
  "tt0137523","tt0245429","tt0120737","tt4154796","tt6751668",
];
const POPULAR_SERIES = [
  "tt0944947","tt0903747","tt0455275","tt4574334","tt1520211",
  "tt2861424","tt5753856","tt0386676","tt0108778","tt2707408",
];

async function fetchOmdbList(ids: string[]) {
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const ck = `media:${id}`;
      const cached = getCached(ck) as ReturnType<typeof mapOmdbDetail> | null;
      if (cached) {
        return {
          imdbId: cached.imdbId,
          title: cached.title,
          year: cached.year,
          type: cached.type,
          poster: cached.poster,
          rated: null, plot: null, genre: null, imdbRating: null, totalSeasons: null,
        };
      }

      const key = getAvailableKey();
      if (!key) return null;

      const params = new URLSearchParams({ apikey: key, i: id });
      const resp = await fetch(`${OMDB_BASE}/?${params.toString()}`);
      const data = await resp.json() as Record<string, string>;
      if (data["Response"] === "False") {
        if ((data["Error"] ?? "").toLowerCase().includes("limit")) markKeyLimited(key);
        return null;
      }
      // Cache full detail while we're at it
      setCache(ck, mapOmdbDetail(data), TTL_MEDIA);
      return mapOmdbSearchItem({
        imdbID: data["imdbID"], Title: data["Title"],
        Year: data["Year"], Type: data["Type"], Poster: data["Poster"],
      });
    })
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<ReturnType<typeof mapOmdbSearchItem>>).value);
}

router.get("/trending/movies", async (req, res) => {
  const ck = "trending:movies";
  const cached = getCached(ck);
  if (cached) { res.json(cached); return; }
  try {
    const results = await fetchOmdbList(POPULAR_MOVIES);
    const out = { results, total: results.length };
    if (results.length > 0) setCache(ck, out, TTL_TREND);
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "trending movies error");
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch trending movies" });
  }
});

router.get("/trending/series", async (req, res) => {
  const ck = "trending:series";
  const cached = getCached(ck);
  if (cached) { res.json(cached); return; }
  try {
    const results = await fetchOmdbList(POPULAR_SERIES);
    const out = { results, total: results.length };
    if (results.length > 0) setCache(ck, out, TTL_TREND);
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "trending series error");
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch trending series" });
  }
});

export default router;
