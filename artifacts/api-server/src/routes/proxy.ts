import { Router } from "express";

const router = Router();

const ALLOWED_HOSTS = new Set([
  "vidsrcme.ru",
  "vidsrc.to",
  "vsembed.ru",
  "2embed.cc",
  "www.2embed.cc",
  "vidsrc.me",
  "vidsrc.xyz",
  "vidsrc.net",
  "vidsrc.in",
]);

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.has(u.hostname) || [...ALLOWED_HOSTS].some(h => u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

const AD_SCRIPT_PATTERN = new RegExp(
  "(exoclick|juicyads|trafficjunky|popads|popcash|propellerads|adsterra|clickadu|adcash|admaven|" +
  "evadav|onclicka|onclickads|rotatemymoney|adjacency|adskeeper|bidvertiser|" +
  "coinhive|cryptoloot|magsrv|exo\\.io|hilltopads|revcontent|taboola|outbrain|" +
  "pushground|richpush|push\\.house|megapu\\.sh|doubleclick|googlesyndication|" +
  "adnxs|advertising\\.com|adtech\\.com|traffichaus|clkmon|plugrush|ero-advertising|" +
  "popunder|popcpm|mgid|moonet\\.co|fun-streams|cdnfile\\.info|adjungle|" +
  "new-player\\.com|reliablewebserve|cdn77ads|emonster|flashtalking|mfadsrevenue)",
  "i"
);

// Injected into the proxied page — runs before any other script
const AD_BLOCK_INJECTION = `
<script id="__enawi_adblock__">
(function() {
  'use strict';

  // ── Block list (domains) ──────────────────────────────────────────────────
  var BLOCKED = /exoclick|juicyads|trafficjunky|popads|popcash|propellerads|adsterra|clickadu|adcash|admaven|evadav|onclicka|onclickads|rotatemymoney|adjacency|adskeeper|bidvertiser|coinhive|cryptoloot|magsrv|hilltopads|revcontent|taboola|outbrain|pushground|richpush|push\\.house|megapu\\.sh|doubleclick|googlesyndication|adnxs|advertising\\.com|adtech\\.com|traffichaus|plugrush|ero-advertising|popunder|popcpm|mgid|moonet\\.co|fun-streams|cdnfile\\.info|adjungle|new-player\\.com|reliablewebserve|cdn77ads|flashtalking|mfadsrevenue|clkmon|exo\\.io/i;

  function isAdUrl(url) {
    if (!url) return false;
    try { return BLOCKED.test(new URL(String(url)).hostname); } catch { return false; }
  }

  // ── Block window.open (popups / popunders) ────────────────────────────────
  Object.defineProperty(window, 'open', {
    value: function(url, target, features) {
      if (!url || String(url).length < 4) return null;
      if (isAdUrl(url)) return null;
      // Block all new-tab opens (ads always use _blank)
      return null;
    },
    writable: false, configurable: false
  });

  // ── Block location hijacks ────────────────────────────────────────────────
  var _realHref = Object.getOwnPropertyDescriptor(window.location, 'href') ||
                  Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  try {
    Object.defineProperty(window.location, 'href', {
      set: function(v) {
        if (isAdUrl(v)) return;
        if (_realHref && _realHref.set) _realHref.set.call(window.location, v);
      },
      get: function() {
        return _realHref && _realHref.get ? _realHref.get.call(window.location) : '';
      },
      configurable: true
    });
  } catch(e) { /* location is sometimes non-configurable */ }

  // ── Intercept fetch ───────────────────────────────────────────────────────
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    var url = (input instanceof Request) ? input.url : String(input);
    if (isAdUrl(url)) return Promise.resolve(new Response('', { status: 200 }));
    return _fetch.apply(this, arguments);
  };

  // ── Intercept XMLHttpRequest ──────────────────────────────────────────────
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      Object.defineProperty(this, '_blocked', { value: true });
      return;
    }
    return _xhrOpen.apply(this, arguments);
  };
  var _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return _xhrSend.apply(this, arguments);
  };

  // ── Intercept dynamic script / iframe creation ────────────────────────────
  var _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _createElement(tag);
    var tagLc = String(tag).toLowerCase();
    if (tagLc === 'script') {
      var _setSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (_setSrc && _setSrc.set) {
        Object.defineProperty(el, 'src', {
          set: function(v) {
            if (isAdUrl(v)) { Object.defineProperty(el, '_blocked', { value: true }); return; }
            _setSrc.set.call(el, v);
          },
          get: function() { return _setSrc.get ? _setSrc.get.call(el) : ''; },
          configurable: true
        });
      }
      var _origAppend = el.append;
      // Block appendChild for blocked scripts
    }
    if (tagLc === 'iframe') {
      var _iframeSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
      if (_iframeSrc && _iframeSrc.set) {
        Object.defineProperty(el, 'src', {
          set: function(v) {
            if (isAdUrl(v)) return;
            _iframeSrc.set.call(el, v);
          },
          get: function() { return _iframeSrc.get ? _iframeSrc.get.call(el) : ''; },
          configurable: true
        });
      }
    }
    return el;
  };

  // ── MutationObserver: remove ad nodes after insertion ────────────────────
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (!node || node.nodeType !== 1) return;
        var el = node;
        var src = el.src || el.href || el.action || '';
        if (isAdUrl(src)) { el.remove(); return; }
        // Remove ad iframes / scripts by domain
        if ((el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') && isAdUrl(src)) {
          el.remove();
        }
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ── Refocus: reclaim focus when popup tries to steal it ──────────────────
  window.addEventListener('blur', function() {
    setTimeout(function() { try { window.focus(); } catch(e) {} }, 50);
  });

})();
</script>
`;

function stripAdScripts(html: string): string {
  // Remove <script src="ad-domain..."> tags
  html = html.replace(/<script[^>]+src=["'][^"']*["'][^>]*>/gi, (match) => {
    if (AD_SCRIPT_PATTERN.test(match)) return "<!-- [enawi-adblock] blocked -->";
    return match;
  });
  // Remove inline scripts that look like ad initialisation
  html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, inner) => {
    if (AD_SCRIPT_PATTERN.test(inner) && inner.length < 5000) return "<!-- [enawi-adblock] blocked -->";
    return match;
  });
  return html;
}

router.get("/proxy/embed", async (req, res) => {
  const urlParam = req.query["url"] as string | undefined;

  if (!urlParam) {
    res.status(400).send("Missing url parameter");
    return;
  }

  if (!isAllowedUrl(urlParam)) {
    res.status(403).send("URL not allowed");
    return;
  }

  let origin: string;
  try {
    origin = new URL(urlParam).origin;
  } catch {
    res.status(400).send("Invalid URL");
    return;
  }

  try {
    const response = await fetch(urlParam, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": origin + "/",
        "Origin": origin,
      },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") ?? "text/html";
    let html = await response.text();

    // Strip known ad scripts from the HTML
    html = stripAdScripts(html);

    // Inject our ad-blocking script as the very first thing in <head>
    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + AD_BLOCK_INJECTION);
    } else if (html.includes("<head ")) {
      html = html.replace(/<head[^>]*>/, (m) => m + AD_BLOCK_INJECTION);
    } else {
      html = AD_BLOCK_INJECTION + html;
    }

    res.setHeader("Content-Type", contentType);
    res.removeHeader("X-Frame-Options");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    res.status(200).send(html);
  } catch (err) {
    req.log.error({ err }, "proxy/embed fetch error");
    res.status(502).send("Failed to fetch embed");
  }
});

// Legacy proxy endpoint (kept for backward compat)
router.get("/proxy", async (req, res) => {
  const url = req.query["url"] as string | undefined;
  if (!url) { res.status(400).json({ error: "missing_url" }); return; }
  if (!isAllowedUrl(url)) { res.status(403).json({ error: "forbidden" }); return; }
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const contentType = response.headers.get("content-type") ?? "text/html";
    const body = await response.text();
    res.setHeader("Content-Type", contentType);
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).send(body);
  } catch (err) {
    req.log.error({ err }, "proxy fetch error");
    res.status(500).json({ error: "proxy_failed" });
  }
});

export default router;
