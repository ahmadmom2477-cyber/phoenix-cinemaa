import { Router } from "express";

const router = Router();

const TMDB_KEY = "c2e22bfce33e878dc66b0e332749c8d1";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const MOVIE_GENRE_IDS: Record<string, number> = {
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
  documentary: 99, drama: 18, fantasy: 14, history: 36, horror: 27,
  mystery: 9648, romance: 10749, scifi: 878, thriller: 53, war: 10752,
  family: 10751,
};

const TV_GENRE_IDS: Record<string, number> = {
  action: 10759, animation: 16, comedy: 35, crime: 80, documentary: 99,
  drama: 18, family: 10751, fantasy: 10765, history: 36, mystery: 9648,
  scifi: 10765, thriller: 53, war: 10768, romance: 10749,
};

interface DiscoverItem {
  imdbId: string;
  title: string;
  poster: string | null;
  year: string | null;
  imdbRating: string | null;
  type: "movie" | "series";
  overview?: string;
}

const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL = 30 * 60 * 1000;

async function tmdbFetch(path: string): Promise<unknown> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, at: Date.now() });
  if (cache.size > 1000) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return data;
}

router.get("/tmdb/discover", async (req, res) => {
  try {
    const rawType = req.query.type as string;
    const type: "movie" | "tv" = rawType === "tv" ? "tv" : "movie";
    const genre = (req.query.genre as string) ?? "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    const genreId = type === "movie" ? MOVIE_GENRE_IDS[genre] : TV_GENRE_IDS[genre];

    const params = new URLSearchParams({
      language: "ar-SA",
      sort_by: "popularity.desc",
      page: String(page),
      include_adult: "false",
    });
    if (genreId) params.set("with_genres", String(genreId));

    const discoverData = await tmdbFetch(`/discover/${type}?${params}`) as {
      results: Array<{
        id: number;
        title?: string;
        name?: string;
        original_title?: string;
        original_name?: string;
        poster_path: string | null;
        release_date?: string;
        first_air_date?: string;
        vote_average?: number;
        overview?: string;
      }>;
      total_pages: number;
      page: number;
    };

    const results = discoverData.results ?? [];

    const enriched = await Promise.all(
      results.map(async (item): Promise<DiscoverItem | null> => {
        try {
          let imdbId: string | null = null;

          if (type === "movie") {
            const detail = await tmdbFetch(`/movie/${item.id}?language=en-US`) as { imdb_id?: string };
            imdbId = detail.imdb_id ?? null;
          } else {
            const ext = await tmdbFetch(`/tv/${item.id}/external_ids`) as { imdb_id?: string };
            imdbId = ext.imdb_id ?? null;
          }

          if (!imdbId) return null;

          const title = type === "movie"
            ? (item.title || item.original_title || "")
            : (item.name || item.original_name || "");

          const year = type === "movie"
            ? (item.release_date?.split("-")[0] ?? null)
            : (item.first_air_date?.split("-")[0] ?? null);

          const rating = item.vote_average
            ? String(Math.round(item.vote_average * 10) / 10)
            : null;

          return {
            imdbId,
            title,
            poster: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
            year,
            imdbRating: rating,
            type: type === "tv" ? "series" : "movie",
            overview: item.overview || undefined,
          };
        } catch {
          return null;
        }
      })
    );

    const items = enriched.filter((x): x is DiscoverItem => x !== null);

    res.json({
      items,
      page: discoverData.page,
      total_pages: discoverData.total_pages,
    });
  } catch (err) {
    req.log?.warn?.({ err }, "TMDB discover error");
    res.status(502).json({ error: "TMDB discover failed", items: [], page: 1, total_pages: 1 });
  }
});

router.get("/tmdb/trending", async (req, res) => {
  try {
    const rawType = req.query.type as string;
    const type: "movie" | "tv" = rawType === "tv" ? "tv" : "movie";

    const trendingData = await tmdbFetch(`/trending/${type}/week?language=ar-SA`) as {
      results: Array<{
        id: number;
        title?: string;
        name?: string;
        original_title?: string;
        original_name?: string;
        poster_path: string | null;
        release_date?: string;
        first_air_date?: string;
        vote_average?: number;
        overview?: string;
      }>;
    };

    const results = (trendingData.results ?? []).slice(0, 20);

    const enriched = await Promise.all(
      results.map(async (item): Promise<DiscoverItem | null> => {
        try {
          let imdbId: string | null = null;
          if (type === "movie") {
            const detail = await tmdbFetch(`/movie/${item.id}?language=en-US`) as { imdb_id?: string };
            imdbId = detail.imdb_id ?? null;
          } else {
            const ext = await tmdbFetch(`/tv/${item.id}/external_ids`) as { imdb_id?: string };
            imdbId = ext.imdb_id ?? null;
          }
          if (!imdbId) return null;

          const title = type === "movie"
            ? (item.title || item.original_title || "")
            : (item.name || item.original_name || "");
          const year = type === "movie"
            ? (item.release_date?.split("-")[0] ?? null)
            : (item.first_air_date?.split("-")[0] ?? null);

          return {
            imdbId,
            title,
            poster: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
            year,
            imdbRating: item.vote_average ? String(Math.round(item.vote_average * 10) / 10) : null,
            type: type === "tv" ? "series" : "movie",
          };
        } catch {
          return null;
        }
      })
    );

    const items = enriched.filter((x): x is DiscoverItem => x !== null);
    res.json({ items });
  } catch (err) {
    req.log?.warn?.({ err }, "TMDB trending error");
    res.status(502).json({ error: "TMDB trending failed", items: [] });
  }
});

export default router;
