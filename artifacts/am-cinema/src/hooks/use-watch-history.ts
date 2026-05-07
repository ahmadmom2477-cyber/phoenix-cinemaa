const STORAGE_KEY = "enawi_watch_history";
const PROGRESS_KEY = "enawi_watch_progress";
const MAX_ITEMS = 30;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface WatchHistoryItem {
  imdbId: string;
  title: string;
  poster: string | null;
  type: string;
  year: string | null;
  season?: string;
  episode?: string;
  watchedAt: number;
  genres?: string[];
}

export interface WatchProgress {
  imdbId: string;
  season?: string;
  episode?: string;
  minutePosition: number;
  durationMinutes?: number;
  updatedAt: number;
}

function loadHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items: WatchHistoryItem[] = JSON.parse(raw);
    const cutoff = Date.now() - TTL_MS;
    return items.filter((i) => i.watchedAt > cutoff);
  } catch {
    return [];
  }
}

function saveHistory(items: WatchHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

function loadProgress(): Record<string, WatchProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, WatchProgress>;
  } catch {
    return {};
  }
}

function saveProgress(data: Record<string, WatchProgress>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch {}
}

function progressKey(imdbId: string, season?: string, episode?: string): string {
  if (season && episode) return `${imdbId}_s${season}_e${episode}`;
  return imdbId;
}

export function addToWatchHistory(item: Omit<WatchHistoryItem, "watchedAt">): void {
  const items = loadHistory().filter((i) => i.imdbId !== item.imdbId);
  saveHistory([{ ...item, watchedAt: Date.now() }, ...items]);
}

export function removeFromWatchHistory(imdbId: string): void {
  saveHistory(loadHistory().filter((i) => i.imdbId !== imdbId));
}

export function getWatchHistory(): WatchHistoryItem[] {
  return loadHistory();
}

export function saveWatchProgress(
  imdbId: string,
  minutePosition: number,
  season?: string,
  episode?: string,
  durationMinutes?: number
): void {
  const data = loadProgress();
  const key = progressKey(imdbId, season, episode);
  data[key] = { imdbId, season, episode, minutePosition, durationMinutes, updatedAt: Date.now() };
  saveProgress(data);
}

export function getWatchProgress(
  imdbId: string,
  season?: string,
  episode?: string
): WatchProgress | null {
  const data = loadProgress();
  const key = progressKey(imdbId, season, episode);
  return data[key] ?? null;
}

export function getRecommendations(limit = 10): string[] {
  const history = loadHistory();
  if (!history.length) return [];

  const genreCount: Record<string, number> = {};
  for (const item of history) {
    for (const g of item.genres ?? []) {
      genreCount[g] = (genreCount[g] ?? 0) + 1;
    }
  }

  const watchedIds = new Set(history.map((h) => h.imdbId));
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  return topGenres.slice(0, limit).map((g) => g);
}
