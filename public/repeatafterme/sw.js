// Network-first, scoped to /repeatafterme only — mirrors Health Dashboard/vitaldash-app's
// public/sw.js. Deliberately doesn't precache a fixed asset list: Next.js's build
// output has hashed filenames that change every deploy, so trying to know them ahead
// of time at SW-install time would go stale immediately. Instead it caches
// successful GET responses as they're fetched, so a repeat visit — or opening the
// app while offline after at least one prior visit — serves from cache. Actual
// learner data (decks, settings, SRS progress) doesn't need this: that's IndexedDB,
// already offline-capable since Sprint 2.

const CACHE_NAME = "repeatafterme-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("repeatafterme-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/repeatafterme")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
