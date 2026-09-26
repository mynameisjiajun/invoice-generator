// Service worker for the invoice app (/invoices_login only — the public
// portfolio is never controlled by it). Registered by
// src/components/ServiceWorker.tsx in production builds.
//
// Goal: the app opens even with bad or no signal (e.g. at a shoot).
//   • Pages:    network first; if the network hasn't answered in 3s (or is
//               down), show the last copy of that page.
//   • /_next/static: hashed and immutable, so cache first.
//   • Supabase data (GET /rest/v1): network first; the cached copy is used
//               ONLY when the network fails outright, never on slowness, so
//               a slow connection can't show stale paid/unpaid states.
//   • Everything else (POSTs, auth, Gmail, uploads) passes straight through.
// Signing out posts {type: "clear-data"} so no client data stays on the device.

const VERSION = "v1";
const PAGES = `inv-pages-${VERSION}`;
const STATIC = `inv-static-${VERSION}`;
const DATA = `inv-data-${VERSION}`;
const NAV_TIMEOUT_MS = 3000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, STATIC, DATA]);
    for (const key of await caches.keys()) {
      if (key.startsWith("inv-") && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-data") {
    event.waitUntil(Promise.all([caches.delete(DATA), caches.delete(PAGES)]));
  }
});

const cacheable = (res) => res && res.ok && !res.redirected && res.type !== "opaqueredirect";

async function pageFirstNetwork(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((res) => {
    if (cacheable(res)) cache.put(request, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const winner = await Promise.race([network, timeout]);
    if (winner) return winner;
    // Slow network: serve the saved page if there is one, else keep waiting.
    return (await cache.match(request)) || (await network);
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) cache.put(request, res.clone());
  return res;
}

async function dataNetworkFirst(request) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(request);
    if (cacheable(res)) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith("/invoices_login")) {
    event.respondWith(pageFirstNetwork(request));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(staticCacheFirst(request));
    return;
  }
  if (url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/")) {
    event.respondWith(dataNetworkFirst(request));
  }
});
