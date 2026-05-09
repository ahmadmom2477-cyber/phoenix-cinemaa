import { execSync } from "child_process";
import type { Browser, BrowserContext, Page } from "playwright";

// ── Resolve system Chromium path ─────────────────────────────────────────────
function getChromiumPath(): string {
  try { return execSync("which chromium", { encoding: "utf-8" }).trim(); } catch {}
  try { return execSync("which chromium-browser", { encoding: "utf-8" }).trim(); } catch {}
  return "/usr/bin/chromium";
}

const CHROMIUM_PATH = getChromiumPath();

// ── Singleton browser ─────────────────────────────────────────────────────────
let _browser: Browser | null = null;
let _launching = false;
let _launchWaiters: Array<(b: Browser) => void> = [];

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;
  if (_launching) {
    return new Promise<Browser>((resolve) => { _launchWaiters.push(resolve); });
  }
  _launching = true;
  try {
    const { chromium } = await import("playwright-extra");
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    chromium.use(StealthPlugin());
    _browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--disable-software-rasterizer", "--no-first-run",
        "--disable-extensions", "--disable-sync", "--log-level=3",
        "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
      ],
    });
    _browser.on("disconnected", () => { _browser = null; });
    const b = _browser;
    for (const r of _launchWaiters) r(b);
    _launchWaiters = [];
    return b;
  } finally {
    _launching = false;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

async function newPage(browser: Browser): Promise<Page> {
  const ctx: BrowserContext = await browser.newContext({
    userAgent: UA,
    locale: "en-US,en;q=0.9",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  return ctx.newPage();
}

async function closePage(page: Page) {
  try { await page.context().close(); } catch {}
}

// ── CF challenge detection (precise) ─────────────────────────────────────────
// Only detect REAL CF challenges — don't false-positive on page content
function isCfChallenge(html: string): boolean {
  if (html.length < 3000) return true; // real pages are bigger
  // CF challenge pages have a specific <title>
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.toLowerCase() ?? "";
  if (title.includes("just a moment") || title.includes("attention required")) return true;
  // CF challenge embeds turnstile script or specific challenge div
  if (html.includes("challenges.cloudflare.com/turnstile") && html.includes("cf-challenge")) return true;
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SubsceneMovieResult {
  movieId: number;
  title: string;
  year: string;
}

// ── Search sub-scene.com using Playwright ─────────────────────────────────────
// URL: /search?query=... (form: method=GET action=/search input name=query)
// CF challenge on this endpoint — Playwright stealth can solve Managed Challenge
// but NOT Interactive Challenge (turnstile). We try, then fall back gracefully.
export async function searchSubscene(query: string): Promise<SubsceneMovieResult[]> {
  const browser = await getBrowser();
  const page = await newPage(browser);
  const results: SubsceneMovieResult[] = [];

  try {
    const searchUrl = `https://sub-scene.com/search?query=${encodeURIComponent(query)}`;
    console.log(`[playwright] → ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    // Extra wait for CF Managed Challenge JS to complete
    await page.waitForTimeout(4000);

    const finalUrl = page.url();
    console.log(`[playwright] landed: ${finalUrl}`);

    const html = await page.content();
    const title = await page.title();
    console.log(`[playwright] title="${title}" htmlLen=${html.length}`);

    // If CF challenge, try waiting more
    if (isCfChallenge(html)) {
      console.log("[playwright] CF challenge detected, waiting extra 5s...");
      await page.waitForTimeout(5000);
      const html2 = await page.content();
      const title2 = await page.title();
      console.log(`[playwright] retry title="${title2}" htmlLen=${html2.length}`);
      if (isCfChallenge(html2)) {
        console.log("[playwright] still CF-blocked after retry");
        return results;
      }
      return parseSearchResults(html2, page);
    }

    return parseSearchResults(html, page);
  } catch (err) {
    console.error("[playwright] searchSubscene error:", (err as Error).message?.slice(0, 300));
    return results;
  } finally {
    await closePage(page);
  }
}

async function parseSearchResults(html: string, page: Page): Promise<SubsceneMovieResult[]> {
  const results: SubsceneMovieResult[] = [];

  // Log a snippet to diagnose structure
  console.log("[playwright] HTML snippet:", html.slice(0, 500).replace(/\s+/g, " "));

  // Check if redirected to homepage (no results / redirect)
  const finalUrl = page.url();
  if (finalUrl.endsWith("sub-scene.com/") || finalUrl.endsWith("sub-scene.com")) {
    console.log("[playwright] redirected to homepage, no results");
    return results;
  }

  // Direct redirect to movie page
  const directMatch = /\/subscene\/(\d+)/.exec(finalUrl);
  if (directMatch) {
    const movieId = parseInt(directMatch[1]);
    const rawTitle = await page.title();
    const yearM = /\((\d{4})\)/.exec(rawTitle);
    results.push({
      movieId,
      title: rawTitle.replace(/\s*\(\d{4}\)\s*|\s*subtitles.*$/i, "").trim(),
      year: yearM ? yearM[1] : "",
    });
    return results;
  }

  // Parse <a href="/subscene/{id}"> links from HTML
  const seen = new Set<number>();
  const re = /href="(https?:\/\/sub-scene\.com)?\/subscene\/(\d+)([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const movieId = parseInt(m[2]);
    const rest = m[3];
    if (!movieId || seen.has(movieId)) continue;
    // Skip language-specific links (/arabic, /english, etc.)
    if (/^\/(arabic|english|french|spanish|persian|turkish|hebrew|german|portuguese)/i.test(rest)) continue;
    seen.add(movieId);

    // Find the text near this href
    const idx = html.indexOf(m[0]);
    const chunk = html.slice(Math.max(0, idx - 50), idx + 300);
    const textM = />([^<]{2,100})</.exec(chunk.slice(chunk.indexOf(m[0].slice(0, 20))));
    const rawText = textM?.[1]?.trim() ?? "";
    const yearMatch = /\((\d{4})\)/.exec(rawText);

    results.push({
      movieId,
      title: rawText.replace(/\s*\(\d{4}\)\s*$/, "").trim() || `Movie ${movieId}`,
      year: yearMatch ? yearMatch[1] : "",
    });
  }

  // Also try DOM-level extraction
  if (results.length === 0) {
    try {
      const domRows = await page.$$eval("a[href*='/subscene/']", (anchors) =>
        anchors.map((a) => {
          const href = (a as HTMLAnchorElement).getAttribute("href") ?? "";
          const idM = /\/subscene\/(\d+)/.exec(href);
          if (!idM) return null;
          if (/\/(arabic|english|french|spanish|persian|turkish|german)/i.test(href)) return null;
          const text = a.textContent?.trim() ?? "";
          const yearM = /\((\d{4})\)/.exec(text);
          return { movieId: parseInt(idM[1]), title: text.replace(/\s*\(\d{4}\)\s*$/, "").trim(), year: yearM?.[1] ?? "" };
        }).filter(Boolean) as Array<{ movieId: number; title: string; year: string }>
      );
      const seenIds = new Set(results.map((r) => r.movieId));
      for (const r of domRows) {
        if (!seenIds.has(r.movieId)) { seenIds.add(r.movieId); results.push(r); }
      }
    } catch {}
  }

  console.log(`[playwright] parsed ${results.length} movie results`);
  return results.slice(0, 20);
}

// ── Warm up browser on startup ─────────────────────────────────────────────────
export function warmUpBrowser() {
  setImmediate(() => {
    getBrowser().catch((err) => {
      console.warn("[playwright] warm-up failed:", (err as Error).message ?? err);
    });
  });
}
