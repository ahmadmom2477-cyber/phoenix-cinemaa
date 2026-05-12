import { Router } from "express";

const router = Router();

const ALLOWED_HOSTS = new Set([
  // Legacy allowed hosts
  "vidsrcme.ru", "vidsrc.to", "vsembed.ru", "2embed.cc", "www.2embed.cc",
  "vidsrc.me", "vidsrc.xyz", "vidsrc.net", "vidsrc.in",
  // Active providers
  "vidsrc.icu", "vidsrc.pm", "moviesapi.to", "anyembed.xyz",
  "www.vidsrc.icu", "www.vidsrc.pm", "www.vidsrc.net",
  "embed.su", "www.embed.su",
  "multiembed.mov", "www.multiembed.mov",
  "filemoon.sx", "www.filemoon.sx",
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

// ── Subtitle injection code (injected into proxied page) ──────────────────────
function buildSubtitleInjection(subtitleVttUrl: string): string {
  return `
<style id="__psx_style__">
  #__psx_sub__ {
    position: fixed !important;
    bottom: 9% !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    max-width: 88% !important;
    text-align: center !important;
    pointer-events: none !important;
    font-family: 'Arial', 'Helvetica', sans-serif !important;
    font-size: clamp(15px, 2.8vw, 26px) !important;
    font-weight: 700 !important;
    color: #fff !important;
    text-shadow: 2px 2px 5px #000, -1px -1px 3px #000, 0 0 10px rgba(0,0,0,0.9) !important;
    background: rgba(0,0,0,0.62) !important;
    padding: 5px 16px 7px !important;
    border-radius: 6px !important;
    line-height: 1.45 !important;
    letter-spacing: 0.015em !important;
    transition: opacity 0.12s !important;
    word-break: break-word !important;
  }
  #__psx_sub__:empty { opacity: 0 !important; }
</style>
<script id="__psx_inject__">
(function() {
  var VTT_URL = ${JSON.stringify(subtitleVttUrl)};
  var cues = [];
  var div = null;

  function toMs(t) {
    var parts = t.replace(',', '.').split(':');
    if (parts.length === 3) return (parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
    if (parts.length === 2) return (parseFloat(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
    return parseFloat(parts[0]) * 1000;
  }

  function parseVtt(text) {
    var result = [];
    var lines = text.split(/\\r?\\n/);
    var i = 0;
    while (i < lines.length) {
      var line = lines[i] || '';
      if (line.indexOf('-->') !== -1) {
        var arrow = line.indexOf('-->');
        var start = toMs(line.slice(0, arrow).trim());
        var endRaw = line.slice(arrow + 3).trim().split(' ')[0];
        var end = toMs(endRaw);
        var txt = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          var raw = lines[i].replace(/<[^>]+>/g, '');
          if (raw.trim()) txt.push(raw);
          i++;
        }
        if (txt.length) result.push({ start: start, end: end, text: txt.join('\\n') });
      } else { i++; }
    }
    return result;
  }

  function tryNativeTrack(blobUrl) {
    var videos = document.querySelectorAll('video');
    videos.forEach(function(v) {
      var old = v.querySelector('track[data-psx]');
      if (old) old.remove();
      var track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = blobUrl;
      track.label = 'Arabic';
      track.srclang = 'ar';
      track.default = true;
      track.setAttribute('data-psx', '1');
      v.appendChild(track);
      try {
        setTimeout(function() {
          if (v.textTracks && v.textTracks[0]) v.textTracks[0].mode = 'showing';
        }, 400);
      } catch(e) {}
    });
    return videos.length > 0;
  }

  function initOverlay() {
    div = document.getElementById('__psx_sub__');
    if (!div) {
      div = document.createElement('div');
      div.id = '__psx_sub__';
      document.body.appendChild(div);
    }
  }

  function startTimer() {
    setInterval(function() {
      if (!div || !cues.length) return;
      var video = document.querySelector('video');
      var elapsed;
      if (video && !isNaN(video.currentTime) && video.currentTime > 1) {
        elapsed = video.currentTime * 1000;
      } else {
        return;
      }
      var found = '';
      for (var i = 0; i < cues.length; i++) {
        if (elapsed >= cues[i].start && elapsed <= cues[i].end) {
          found = cues[i].text;
          break;
        }
      }
      if (div.innerHTML !== found.replace(/\\n/g, '<br>')) {
        div.innerHTML = found.replace(/\\n/g, '<br>');
      }
    }, 80);
  }

  fetch(VTT_URL, { cache: 'no-store' })
    .then(function(r) { return r.text(); })
    .then(function(text) {
      cues = parseVtt(text);
      var blob = new Blob([text], { type: 'text/vtt' });
      var blobUrl = URL.createObjectURL(blob);
      if (document.body) {
        initOverlay();
        tryNativeTrack(blobUrl);
        startTimer();
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          initOverlay();
          tryNativeTrack(blobUrl);
          startTimer();
        });
      }
      // Watch for video elements loaded later (HLS players)
      var obs = new MutationObserver(function() {
        var vids = document.querySelectorAll('video:not([data-psx-done])');
        if (vids.length) {
          vids.forEach(function(v) {
            v.setAttribute('data-psx-done', '1');
            var old = v.querySelector('track[data-psx]');
            if (old) old.remove();
            var t = document.createElement('track');
            t.kind = 'subtitles'; t.src = blobUrl;
            t.label = 'Arabic'; t.srclang = 'ar';
            t.default = true; t.setAttribute('data-psx', '1');
            v.appendChild(t);
            setTimeout(function() {
              if (v.textTracks && v.textTracks[0]) v.textTracks[0].mode = 'showing';
            }, 400);
          });
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    })
    .catch(function(e) { console.warn('[Phoenix Subtitle] Load error:', e); });
})();
</script>`;
}

// ── Ad-block injection ─────────────────────────────────────────────────────────
const AD_BLOCK_INJECTION = `
<script id="__enawi_adblock__">
(function() {
  'use strict';
  var BLOCKED = /exoclick|juicyads|trafficjunky|popads|popcash|propellerads|adsterra|clickadu|adcash|admaven|evadav|onclicka|onclickads|rotatemymoney|adjacency|adskeeper|bidvertiser|coinhive|cryptoloot|magsrv|hilltopads|revcontent|taboola|outbrain|pushground|richpush|push\\.house|megapu\\.sh|doubleclick|googlesyndication|adnxs|advertising\\.com|adtech\\.com|traffichaus|plugrush|ero-advertising|popunder|popcpm|mgid|moonet\\.co|fun-streams|cdnfile\\.info|adjungle|new-player\\.com|reliablewebserve|cdn77ads|flashtalking|mfadsrevenue|clkmon|exo\\.io/i;
  function isAd(url) {
    if (!url) return false;
    try { return BLOCKED.test(new URL(String(url)).hostname); } catch { return false; }
  }
  // Block ALL window.open — video players never need popups
  Object.defineProperty(window, 'open', { value: function() { return null; }, writable: false, configurable: false });
  // Block location hijacks
  var _href = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  try {
    Object.defineProperty(window.location, 'href', {
      set: function(v) { if (isAd(v)) return; if (_href && _href.set) _href.set.call(window.location, v); },
      get: function() { return _href && _href.get ? _href.get.call(window.location) : ''; },
      configurable: true
    });
  } catch(e) {}
  // Block assign/replace
  try {
    var _assign = location.assign.bind(location);
    var _replace = location.replace.bind(location);
    location.assign = function(u) { if (!isAd(u)) _assign(u); };
    location.replace = function(u) { if (!isAd(u)) _replace(u); };
  } catch(e) {}
  // Block fetch to ad domains
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    var url = (input instanceof Request) ? input.url : String(input);
    if (isAd(url)) return Promise.resolve(new Response('', { status: 200 }));
    return _fetch.apply(this, arguments);
  };
  // Block XHR
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url) {
    if (isAd(url)) { Object.defineProperty(this, '_blocked', { value: true }); return; }
    return _xhrOpen.apply(this, arguments);
  };
  var _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return _xhrSend.apply(this, arguments);
  };
  // Block createElement for ad scripts/iframes
  var _ce = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _ce(tag);
    var t = String(tag).toLowerCase();
    if (t === 'script' || t === 'iframe') {
      var desc = Object.getOwnPropertyDescriptor(t === 'script' ? HTMLScriptElement.prototype : HTMLIFrameElement.prototype, 'src');
      if (desc && desc.set) {
        Object.defineProperty(el, 'src', {
          set: function(v) { if (isAd(v)) { Object.defineProperty(el, '_blocked', { value: true }); return; } desc.set.call(el, v); },
          get: function() { return desc.get ? desc.get.call(el) : ''; },
          configurable: true
        });
      }
    }
    return el;
  };
  // MutationObserver: remove injected ad nodes
  var obs = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (!node || node.nodeType !== 1) return;
        var el = node;
        var src = el.src || el.href || '';
        if (isAd(src)) { el.remove(); }
        if ((el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') && isAd(src)) { el.remove(); }
        // Remove fixed overlay divs from ads
        if (el.tagName === 'DIV') {
          var s = el.style;
          if (s && s.position === 'fixed' && s.zIndex && parseInt(s.zIndex) > 9000) {
            var links = el.querySelectorAll('a[href]');
            if (links.length && isAd(links[0].href)) { el.remove(); }
          }
        }
      });
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  // Reclaim focus when popup steals it
  window.addEventListener('blur', function() {
    setTimeout(function() { try { window.focus(); } catch(e) {} }, 60);
    setTimeout(function() { try { window.focus(); } catch(e) {} }, 300);
  });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      setTimeout(function() { try { window.focus(); } catch(e) {} }, 100);
      setTimeout(function() { try { window.focus(); } catch(e) {} }, 600);
    }
  });
  // Block history manipulation by ads
  var _push = history.pushState.bind(history);
  var _rep = history.replaceState.bind(history);
  try {
    history.pushState = function(s, t, url) { if (url && isAd(String(url))) return; return _push(s, t, url); };
    history.replaceState = function(s, t, url) { if (url && isAd(String(url))) return; return _rep(s, t, url); };
  } catch(e) {}
  // Block document.write
  try { document.write = function() {}; document.writeln = function() {}; } catch(e) {}
})();
</script>
`;

function stripAdScripts(html: string): string {
  html = html.replace(/<script[^>]+src=["'][^"']*["'][^>]*>/gi, (match) => {
    if (AD_SCRIPT_PATTERN.test(match)) return "<!-- [phoenix-adblock] blocked -->";
    return match;
  });
  html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, inner) => {
    if (AD_SCRIPT_PATTERN.test(inner) && inner.length < 5000) return "<!-- [phoenix-adblock] blocked -->";
    return match;
  });
  return html;
}

// ── Main proxy + subtitle injection endpoint ───────────────────────────────────
router.get("/proxy/embed", async (req, res) => {
  const urlParam = req.query["url"] as string | undefined;
  const subId = req.query["sub"] as string | undefined;

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Referer": origin + "/",
        "Origin": origin,
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") ?? "text/html";
    let html = await response.text();

    // Strip known ad scripts
    html = stripAdScripts(html);

    // Inject <base> tag to fix relative URLs in embed page
    const baseTag = `<base href="${origin}/">`;

    // Build injection block
    let injection = baseTag + "\n" + AD_BLOCK_INJECTION;

    // If a subtitle ID is provided, also inject subtitle loading script
    if (subId && /^[a-f0-9\-]{8,}$/i.test(subId)) {
      // Build absolute VTT URL using the request host
      const host = `${req.protocol}://${req.get("host")}`;
      const vttUrl = `${host}/api/subtitles/${subId}.vtt`;
      injection += "\n" + buildSubtitleInjection(vttUrl);
    }

    // Inject into <head> or prepend
    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + injection);
    } else if (html.match(/<head[^>]*>/)) {
      html = html.replace(/<head[^>]*>/, (m) => m + injection);
    } else {
      html = injection + html;
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

// ── Legacy proxy endpoint ──────────────────────────────────────────────────────
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
