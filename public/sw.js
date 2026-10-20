// HubCheck service worker: keeps the app usable when the network drops.
//
//   App files (/_next/static/...)  cache first: file names change on every
//                                  deploy, so a cached file is never stale
//   Icons, manifest, /offline      cached when the worker installs
//   Pages you open (Home, Visits,  network first; the last copy is kept
//   each visit)                    on this device for offline reloads
//   Everything else                straight to the network, never cached:
//                                  saves (POST), login, report downloads,
//                                  Supabase data and photos
//
// Visit edits themselves are not stored here: autosave keeps unsaved
// changes in localStorage and syncs them when the connection returns.
//
// Change VERSION when you change this file; old caches are then deleted.
const VERSION = "v1";
const STATIC_CACHE = `hubcheck-static-${VERSION}`;
const PAGE_CACHE = `hubcheck-pages-${VERSION}`;

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Pages worth keeping for offline reloads: Home, the visits list and a visit.
const OFFLINE_PAGES = /^\/(visits(\/[0-9a-f-]{36})?)?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("hubcheck-") && ![STATIC_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // App files: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Full page loads (typing a URL, reload, opening the installed app).
  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  }
  // Anything else (in-app navigation data, report downloads...) goes to
  // the network untouched.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function page(request, url) {
  try {
    const response = await fetch(request);
    // Logged out (the login page loaded): forget the pages kept on this
    // device, so nobody else sees them.
    if (url.pathname === "/login" && response.ok) {
      await caches.delete(PAGE_CACHE);
    }
    // Keep a copy of real pages, not redirects to the login page.
    if (response.ok && !response.redirected && OFFLINE_PAGES.test(url.pathname)) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    // Offline: the last copy of this page, or the offline page.
    const cached = await caches.match(url.pathname, { cacheName: PAGE_CACHE });
    return cached ?? (await caches.match("/offline")) ?? Response.error();
  }
}
