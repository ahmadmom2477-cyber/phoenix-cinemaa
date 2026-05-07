import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, "..", "data");
const CACHE_FILE = join(DATA_DIR, "omdb-cache.json");
const KEY_HEALTH_FILE = join(DATA_DIR, "omdb-key-health.json");

export const OMDB_BASE = "https://www.omdbapi.com";
const OMDB_KEYS = ["6866d5b4", "d19d0e5c", "fccd07eb", "e7f94365", "cae875d0", "eafc380f"];

const RESET_AFTER = 8 * 60 * 60 * 1000;
const keyLimitedAt = new Map<string, number>();
let keyIndex = 0;

interface CacheEntry { data: unknown; expiresAt: number; }
const memCache = new Map<string, CacheEntry>();

export const TTL_SEARCH = 60 * 60 * 1000;
export const TTL_MEDIA  = 7 * 24 * 60 * 60 * 1000;
export const TTL_TREND  = 2 * 60 * 60 * 1000;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadCache() {
  try {
    ensureDataDir();
    if (!existsSync(CACHE_FILE)) return;
    const obj = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [k, v] of Object.entries(obj)) {
      if (v.expiresAt > now) memCache.set(k, v);
    }
  } catch {}
}

export function saveCache() {
  try {
    ensureDataDir();
    const obj: Record<string, CacheEntry> = {};
    memCache.forEach((v, k) => { obj[k] = v; });
    writeFileSync(CACHE_FILE, JSON.stringify(obj));
  } catch {}
}

export function getCached(key: string): unknown | null {
  const entry = memCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) { memCache.delete(key); return null; }
  return entry.data;
}

export function setCache(key: string, data: unknown, ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  setImmediate(() => saveCache());
}

export function loadKeyHealth() {
  try {
    if (!existsSync(KEY_HEALTH_FILE)) return;
    const obj = JSON.parse(readFileSync(KEY_HEALTH_FILE, "utf-8")) as Record<string, number>;
    const now = Date.now();
    for (const [key, ts] of Object.entries(obj)) {
      if (now - ts < RESET_AFTER) keyLimitedAt.set(key, ts);
    }
  } catch {}
}

export function saveKeyHealth() {
  try {
    const obj: Record<string, number> = {};
    keyLimitedAt.forEach((ts, key) => { obj[key] = ts; });
    writeFileSync(KEY_HEALTH_FILE, JSON.stringify(obj));
  } catch {}
}

export function getAvailableKey(): string | null {
  const now = Date.now();
  for (let i = 0; i < OMDB_KEYS.length; i++) {
    const key = OMDB_KEYS[keyIndex % OMDB_KEYS.length];
    keyIndex++;
    const limitedAt = keyLimitedAt.get(key);
    if (!limitedAt || now - limitedAt > RESET_AFTER) return key;
  }
  return null;
}

export function markKeyLimited(key: string) {
  keyLimitedAt.set(key, Date.now());
  setImmediate(() => saveKeyHealth());
}

export function mapOmdbSearchItem(item: Record<string, string>) {
  return {
    imdbId: item["imdbID"] ?? "",
    title: item["Title"] ?? "",
    year: item["Year"] ?? "",
    type: item["Type"] ?? "movie",
    poster: item["Poster"] !== "N/A" ? item["Poster"] : null,
    rated: null, plot: null, genre: null, imdbRating: null, totalSeasons: null,
  };
}

export function mapOmdbDetail(d: Record<string, string>) {
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

export async function fetchMediaById(imdbId: string): Promise<ReturnType<typeof mapOmdbDetail> | null> {
  const cacheKey = `media:${imdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as ReturnType<typeof mapOmdbDetail>;

  const key = getAvailableKey();
  if (!key) return null;

  try {
    const params = new URLSearchParams({ apikey: key, i: imdbId, plot: "full" });
    const resp = await fetch(`${OMDB_BASE}/?${params}`, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json() as Record<string, string>;

    if (data["Response"] === "False") {
      if ((data["Error"] ?? "").toLowerCase().includes("limit")) markKeyLimited(key);
      return null;
    }

    const result = mapOmdbDetail(data);
    setCache(cacheKey, result, TTL_MEDIA);
    return result;
  } catch {
    return null;
  }
}
