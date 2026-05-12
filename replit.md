# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (unused; graceful skip if DATABASE_URL missing)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Enawi Cinema App

**Enawi Cinema** — dark-themed Arabic/English movie/TV streaming discovery app with red/black branding.

### Workflows
- **Frontend**: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/am-cinema run dev` (webview on port 5000)
- **API Server**: `PORT=8080 pnpm --filter @workspace/api-server run dev` (console on port 8080)
- Vite proxies `/api/*` to `http://localhost:8080` in dev

### Features
- Search for movies/shows via OMDB API (3 rotating keys: 6866d5b4, d19d0e5c, fccd07eb)
- 18 genre categories with emoji icons and Arabic/English names — each with carefully classified IMDB IDs
- Trending movies and series on home page
- **Continue Watching** row (localStorage, 30-day TTL, per-episode tracking, removable)
- **Personalized Recommendations** row based on watch history (genre-matched)
- **Subtitle overlay**: SRT parsed client-side (`src/utils/srt.ts`); timer-based (cross-origin iframe); controls: ±0.5s/±5s offset; **auto-search via sub-scene.com** (OpenSubtitles removed); keyword priority: iTunes > CimaNow > Netflix > Amazon > EgyBest > BluRay; ZIP extraction with windows-1256/UTF-8 detection; persistent cache at `data/subscene-id-cache.json`; homepage-based movie discovery (no Cloudflare); manual SRT upload still supported.
- **Watchlist** with localStorage persistence, badge count in navbar
- **Watch History** with progress tracking (localStorage)
- Multi-provider streaming: vidsrc.icu, vidsrc.pm, 2embed.cc, vidsrc.net (4 sources, **sandbox attribute removed** — replaced with JS-based ad blocking: window.open blocked, fetch/XHR intercepted for ad domains, location.href hijacks blocked, MutationObserver removes injected ad elements)
- **Subscription currency**: SAR (10 SAR ≈ $2.67 USD) — was AED
- Download links via torrent scraping
- **About page** (`/about`) — official logo, "Developed by Abood" card, app features grid

### UI / Design System
- Dark cinema theme — charcoal background (#080808), **Enawi red** primary (hsl 0 82% 50% ≈ #ff3232)
- Official Enawi Cinema logo PNG at `/logo.png` (red/black C+play icon with "enawi CINEMA") shown in navbar + footer
- Favicon: `/favicon.png`
- Fonts: Outfit (sans) + Playfair Display (serif)
- Glass navbar: `glass-panel` utility (rgba 10,10,10 0.72, blur 20px saturate 180%)
- Skeleton shimmer animation on loading cards
- `text-gradient-gold` / `text-gradient-red` utility for accent text (both render red gradient)
- `cinema-glow` utility for red glow effects
- Fully RTL-aware (Arabic/English toggle, `dir` on root layout)
- 5 switchable video sources (Source 1–5) on watch page
- **Keyboard navigation** for series (← prev episode, → next episode)
- **Arabic/English language toggle** with RTL/LTR switching (persisted to localStorage)
- **Auto Arabic subtitle fetch** from OpenSubtitles legacy API; user selects best option; backend downloads + decompresses .srt.gz; manual .srt upload fallback
- Watch progress tracking (per movie/episode, minute-level, saved every 60s)
- Episode grid with season tabs on watch page
- Direct MP4 download via dl.vidsrc.vip
- Torrent download panel (YTS for movies, EZTV for series)
- Ad-blocking service worker + click-guard overlay
- Mobile/tablet/TV responsive design; mobile bottom nav (Home, Movies, Series, Genres, Saved, About)

### Architecture
- **Frontend**: React 19 + Vite 7 + Tailwind 4 at `artifacts/am-cinema/`
- **Backend**: Express 5 API server at `artifacts/api-server/`
- **State**: TanStack Query for server state, localStorage for watch history/progress/lang

### Routes
- `/` — Home
- `/movies`, `/series` — Browse
- `/genres`, `/genre/:name` — Browse by genre
- `/watchlist` — Personal watchlist
- `/search?q=...` — Search
- `/watch/:imdbId` — Player page
- `/about` — About / Developer info

### API Routes
- `GET /api/search?q=...&type=&year=` — OMDB search
- `GET /api/media/:imdbId` — OMDB media detail
- `GET /api/trending/movies` — popular movies list
- `GET /api/trending/series` — popular TV series list
- `GET /api/genres` — list of all genres
- `GET /api/genre/:name?page=1&limit=20` — genre detail paginated
- `GET /api/downloads/:imdbId?type=&season=&episode=` — torrent links (YTS/EZTV)
- `POST /api/subtitles` + `GET /api/subtitles/:id.srt` — manual subtitle hosting (2h TTL)
- `GET /api/subtitles/search?imdbId=&season=&episode=&lang=ara` — OpenSubtitles search
- `POST /api/subtitles/fetch` — download + decompress .srt.gz from OpenSubtitles

### Video Sources (Source 1–4)
- Source 1: `vidsrc.icu`
- Source 2: `vidsrc.pm`
- Source 3: `2embed.cc`
- Source 4: `vidapi.ru` (vaplayer.ru) — **supports `sub_url` for external subtitle injection**

### OMDB Key Rotation
Three API keys rotated round-robin in `routes/search.ts` and `routes/genres.ts`:
`6866d5b4`, `d19d0e5c`, `fccd07eb`

### Genre Data
- Backend: `artifacts/api-server/src/data/genres.ts`
- Frontend (for client-side recommendations): `artifacts/am-cinema/src/data/genres-client.ts`

### External Services
- **OMDB API** (`https://www.omdbapi.com`) — movie/show details
- **OpenSubtitles legacy REST** (`https://rest.opensubtitles.org`) — Arabic subtitle search (no key needed; User-Agent: EnawiCinema v1.0)
- **Vidsrc / vsembed / 2embed / PlayIMDB** — video embed sources
- **YTS** (`yts.mx`) — movie torrent links
- **EZTV** (`eztvx.to`) — TV series torrent links

### Render Deployment
- `render.yaml` configures a single Node.js web service
- Build: compiles frontend + backend
- Serve: Express serves built frontend at `/`, API at `/api`
- Env vars needed: (OMDB keys are hardcoded with rotation; no env var required)

### Environment Variables
- `DATABASE_URL` (optional) — PostgreSQL; DB is unused currently
- `BASE_PATH` — URL prefix for the frontend (set to `/` in dev and prod)
