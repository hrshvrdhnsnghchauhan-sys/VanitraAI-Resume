// Vanitra AI Resume — production service worker.
// Strategy: network-first for navigations (fresh SSR HTML) with cached-home
// offline fallback; cache-first for immutable hashed /assets/ files.
const CACHE_NAME = "vanitra-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest"]).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: fresh HTML first, cached home page when offline. Only the
  // root path is stored under the "/" key so visiting /dashboard or /login
  // can never overwrite the offline home fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (url.pathname === "/") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Hashed static assets are immutable: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && url.pathname.includes("/assets/")) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
        }
        return res;
      });
    }),
  );
});
