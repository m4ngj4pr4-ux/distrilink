// public/sw.js — Service Worker for DistriLink Sales PWA
// Cache-first untuk static assets, Network-first untuk API/pages

const CACHE_NAME = "distrilink-v1";

// Core assets yang harus di-cache saat install
const PRECACHE_URLS = [
  "/sales",
  "/sales/login",
  "/sales/toko",
  "/sales/transaksi",
  "/sales/distribusi",
  "/sales/profil",
  "/icon.png",
  "/icon-sales.png",
  "/manifest-sales.json",
];

// Install: Precache halaman-halaman utama
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Precache partial fail (non-critical):", err);
      });
    })
  );
  // Aktifkan langsung tanpa menunggu tab lama ditutup
  self.skipWaiting();
});

// Activate: Bersihkan cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (POST, PUT, etc. untuk Firebase)
  if (event.request.method !== "GET") return;

  // Skip Firebase/Firestore requests (dihandle oleh IndexedDB persistence)
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com")
  ) {
    return;
  }

  // Static assets (JS, CSS, images, fonts): Cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|webp)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Offline — return nothing for assets
            return new Response("", { status: 503 });
          });
      })
    );
    return;
  }

  // HTML pages: Network-first with cache fallback
  if (event.request.headers.get("accept")?.includes("text/html") ||
      url.pathname.startsWith("/sales")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache halaman yang berhasil di-fetch
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: coba ambil dari cache
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Fallback ke halaman sales utama jika halaman spesifik tidak ada di cache
            return caches.match("/sales");
          });
        })
    );
    return;
  }
});
