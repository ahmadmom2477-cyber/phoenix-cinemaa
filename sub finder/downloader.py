"""
Downloads and extracts Arabic subtitle links from a Subscene movie page.
Uses plain HTTP requests first (fast, no Cloudflare on /subscene/ pages).
Falls back to nodriver only if Cloudflare is encountered.
"""
import requests
import re
import sys
import subprocess
import os

KEYWORDS = ["DawoodTv", "Elzayady", "Netflix", "🅽🅴🆃🅵🅻🅸🆇", "CimaNow", "Amazon Prime", "iTunes", "EgyBest", "الأصلية"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,en;q=0.5",
    "Connection": "keep-alive",
}

def log(*args):
    print(*args, file=sys.stderr, flush=True)

def get_chromium_path():
    result = subprocess.run(["which", "chromium"], capture_output=True, text=True)
    path = result.stdout.strip()
    if path:
        return path
    for p in ["/run/current-system/sw/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser"]:
        if os.path.exists(p):
            return p
    return None

async def download_and_extract(url):
    log(f"Fetching subtitle page: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        html = resp.text

        if "Just a moment" in html or "cf-challenge" in html or "turnstile" in html.lower():
            log("Cloudflare detected, using nodriver browser fallback...")
            return await _extract_with_browser(url)

        result = _parse_subtitle_links(html)
        if result:
            return result

        log("No results from plain HTML parse, trying browser...")
        return await _extract_with_browser(url)

    except Exception as e:
        log(f"Plain request failed: {e}, trying browser...")
        return await _extract_with_browser(url)

def _parse_subtitle_links(html):
    unique_urls = set()
    green_results = []
    keyword_results = []

    # Match table rows
    row_pattern = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL | re.IGNORECASE)

    for row_match in row_pattern.finditer(html):
        row = row_match.group(1)

        if "arabic" not in row.lower():
            continue

        # Find subtitle link /subtitle/DIGITS
        link_match = re.search(r'href="(/subtitle/(\d+))"', row)
        if not link_match:
            continue

        sub_id = link_match.group(2)
        download_url = f"https://sub-scene.com/download/{sub_id}"

        if download_url in unique_urls:
            continue
        unique_urls.add(download_url)

        is_green = "positive-icon" in row

        # Extract row text for keyword matching
        row_text = re.sub(r'<[^>]+>', ' ', row)
        row_text = re.sub(r'\s+', ' ', row_text).strip()

        if is_green:
            green_results.append({"keyword": "⭐ Green/Trusted", "url": download_url})
            log(f"  Green: {download_url}")
        else:
            matched_keyword = None
            for keyword in KEYWORDS:
                if keyword.lower() in row_text.lower() or keyword in row_text:
                    matched_keyword = keyword
                    break
            if matched_keyword:
                keyword_results.append({"keyword": matched_keyword, "url": download_url})
                log(f"  Keyword [{matched_keyword}]: {download_url}")
            else:
                # Include unmatched Arabic subtitles as fallback (lower priority)
                keyword_results.append({"keyword": "Arabic", "url": download_url})
                log(f"  Generic Arabic: {download_url}")

    # Green subtitles first, then keyword-matched
    results = green_results[:]
    if not results:
        results = keyword_results[:6]

    log(f"Total: {len(results)} subtitles ({len(green_results)} green, {len(keyword_results)} keyword/generic)")
    return results if results else None

async def _extract_with_browser(url):
    browser = None
    try:
        import nodriver as uc
        chromium_path = get_chromium_path()
        log(f"Launching nodriver browser: {chromium_path}")

        browser = await uc.start(
            browser_executable_path=chromium_path,
            headless=True,
            sandbox=False,
            browser_args=[
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080",
                "--disable-extensions",
            ]
        )

        page = await browser.get(url)
        log("Waiting 30s for Cloudflare challenge...")
        await page.wait(30)

        html = await page.get_content()
        result = _parse_subtitle_links(html)

        if result:
            log(f"Browser found {len(result)} results")
            return result

        log("Browser extraction found no results")
        return None

    except Exception as e:
        log(f"Browser extraction error: {e}")
        return None
    finally:
        if browser:
            try:
                browser.stop()
            except:
                pass
