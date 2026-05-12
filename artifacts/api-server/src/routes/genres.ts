import { Router } from "express";
import { GENRES, getGenreById } from "../data/genres";
import {
  getCached, setCache, fetchMediaById, TTL_MEDIA,
  loadCache, loadKeyHealth,
} from "../utils/omdb";

loadCache();
loadKeyHealth();

const router = Router();

router.get("/genres", (_req, res) => {
  res.json(
    GENRES.map((g) => ({
      id: g.id,
      nameEn: g.nameEn,
      nameAr: g.nameAr,
      icon: g.icon,
      count: g.imdbIds.length,
    }))
  );
});

router.get("/genre/:name", async (req, res) => {
  const genre = getGenreById(req.params.name);
  if (!genre) {
    res.status(404).json({ error: "genre_not_found" });
    return;
  }

  const page  = Math.max(1, parseInt((req.query.page  as string) || "1",  10));
  const limit = Math.min(24, parseInt((req.query.limit as string) || "20", 10));
  const start = (page - 1) * limit;
  const ids   = genre.imdbIds.slice(start, start + limit);
  const total = genre.imdbIds.length;

  const cacheKey = `genre:${genre.id}:${page}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const results = await Promise.allSettled(ids.map((id) => fetchMediaById(id)));

  const items = results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => {
      const v = (r as PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchMediaById>>>>).value;
      return {
        imdbId: v.imdbId,
        title: v.title,
        year: v.year,
        type: v.type,
        poster: v.poster,
        imdbRating: v.imdbRating,
        genre: v.genre,
      };
    });

  const out = {
    genre: { id: genre.id, nameEn: genre.nameEn, nameAr: genre.nameAr, icon: genre.icon },
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  };

  if (items.length > 0) setCache(cacheKey, out, TTL_MEDIA);
  res.json(out);
});

export default router;
