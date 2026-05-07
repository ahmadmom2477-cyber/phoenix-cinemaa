const WATCHLIST_KEY = "enawi_watchlist";

export interface WatchlistItem {
  imdbId: string;
  title: string;
  poster: string | null;
  year: string | null;
  type: string;
  imdbRating?: string | null;
  addedAt: number;
}

export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchlistItem[];
  } catch {
    return [];
  }
}

export function isInWatchlist(imdbId: string): boolean {
  return getWatchlist().some((item) => item.imdbId === imdbId);
}

export function addToWatchlist(item: WatchlistItem): void {
  const list = getWatchlist();
  if (list.some((i) => i.imdbId === item.imdbId)) return;
  list.unshift({ ...item, addedAt: Date.now() });
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

export function removeFromWatchlist(imdbId: string): void {
  const list = getWatchlist().filter((i) => i.imdbId !== imdbId);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

export function toggleWatchlist(item: Omit<WatchlistItem, "addedAt">): boolean {
  if (isInWatchlist(item.imdbId)) {
    removeFromWatchlist(item.imdbId);
    return false;
  } else {
    addToWatchlist({ ...item, addedAt: Date.now() });
    return true;
  }
}
