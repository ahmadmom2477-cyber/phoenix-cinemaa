"""
Finds the Subscene movie page URL given a movie name.
Strategy (no Cloudflare bypass needed):
  1. OMDB API → title + year
  2. Try /subtitles/<slug> (no Cloudflare protection)
  3. Fallback: nodriver browser search as last resort
"""
import requests
import re
import sys
import subprocess
import os
from urllib.parse import quote

OMDB_KEYS = ["6866d5b4", "d19d0e5c", "fccd07eb"]

def log(*args):
    print(*args, file=sys.stderr, flush=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

def get_chromium_path():
    result = subprocess.run(["which", "chromium"], capture_output=True, text=True)
    path = result.stdout.strip()
    if path:
        return path
    for p in ["/run/current-system/sw/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser"]:
        if os.path.exists(p):
            return p
    return None

def make_slug(title):
    """Convert movie title to Subscene URL slug."""
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug

def _subscene_id_from_html(html):
    """Extract the first /subscene/<id> link from page HTML."""
    links = re.findall(r'href="(/subscene/(\d+)[^"]*)"', html)
    if links:
        return "https://sub-scene.com" + links[0][0], int(links[0][1])
    return None, None

async def get_movie_url(movie_name):
    """Main entry: movie name → Subscene movie page URL."""
    try:
        # 1. OMDB lookup for canonical title + year
        for key in OMDB_KEYS:
            try:
                api_url = f"http://www.omdbapi.com/?t={quote(movie_name)}&apikey={key}"
                log(f"OMDB lookup: {movie_name} (key: {key})")
                resp = requests.get(api_url, timeout=15)
                data = resp.json()
                if data.get("Response") == "True":
                    break
            except Exception:
                continue

        title = data.get("Title", movie_name)
        year = data.get("Year", "")
        imdb_id = data.get("imdbID", "")
        log(f"Resolved: title={title}, year={year}, imdbID={imdb_id}")

        # 2. Try slug-based URL (no Cloudflare protection on this endpoint)
        url = await _find_by_slug(title, year)
        if url:
            return url

        # 3. Fallback: nodriver browser search (Cloudflare bypass)
        if imdb_id:
            log("Slug search failed, trying browser search...")
            return await _find_with_browser(f"https://sub-scene.com/search?query={imdb_id}")

        return None

    except Exception as e:
        log(f"searcher error: {e}")
        return None

async def _find_by_slug(title, year=""):
    """Try /subtitles/<slug> and /subtitles/<slug>-<year> — no Cloudflare."""
    slug = make_slug(title)
    candidates = [f"https://sub-scene.com/subtitles/{slug}"]
    if year:
        clean_year = re.sub(r"[^0-9]", "", year)[:4]
        if clean_year:
            candidates.insert(0, f"https://sub-scene.com/subtitles/{slug}-{clean_year}")

    for url in candidates:
        try:
            log(f"Trying slug URL: {url}")
            resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)

            if resp.status_code == 200 and "Just a moment" not in resp.text:
                movie_url, movie_id = _subscene_id_from_html(resp.text)
                if movie_url:
                    log(f"Found via slug: {movie_url} (id={movie_id})")
                    return movie_url
        except Exception as e:
            log(f"Slug URL error for {url}: {e}")

    log("No result from slug search")
    return None

async def _find_with_browser(search_url):
    """Last resort: nodriver browser to bypass Cloudflare on search page."""
    browser = None
    try:
        import nodriver as uc
        chromium_path = get_chromium_path()
        log(f"Using nodriver with chromium at: {chromium_path}")

        browser = await uc.start(
            browser_executable_path=chromium_path,
            headless=True,
            sandbox=False,
            browser_args=[
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--blink-settings=imagesEnabled=false",
                "--disable-extensions",
            ]
        )

        page = await browser.get(search_url)
        log("Waiting 30s for Cloudflare challenge...")
        await page.wait(30)

        html = await page.get_content()
        movie_url, _ = _subscene_id_from_html(html)
        if movie_url:
            log(f"Found via browser: {movie_url}")
            return movie_url

        anchors = await page.select_all("a")
        for a in anchors:
            href = a.attrs.get("href", "")
            if re.search(r"/subscene/\d+", href):
                url = "https://sub-scene.com" + href if href.startswith("/") else href
                log(f"Found via browser anchor: {url}")
                return url

        log("No subscene link found after browser search")
        return None

    except Exception as e:
        log(f"Browser search error: {e}")
        return None
    finally:
        if browser:
            try:
                browser.stop()
            except:
                pass
