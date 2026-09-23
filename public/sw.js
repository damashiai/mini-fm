/* MiniFM service worker — app-shell caching ONLY.
 * Audio files and API responses are never cached here; streaming uses
 * short-lived Supabase signed URLs and must always hit the network. */
const CACHE = "minifm-shell-v1";
const SHELL = ["/", "/explore", "/charts", "/library", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never intercept: API calls, audio/CDN streams, Next internals.
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    /\.(mp3|m4a|wav|ogg|flac|webm|aac)$/i.test(url.pathname)
  ) {
    return;
  }
  // Same-origin navigations: network-first, fall back to cached shell.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match("/"))),
    );
  }
});
