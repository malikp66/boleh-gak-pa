// Cache tampilan aplikasi supaya tetap terbuka walau sinyal putus.
// Panggilan /api/* dan halaman login tidak pernah di-cache (data keluarga tidak disimpan di HP).
const CACHE = "boleh-gak-pa-v2-1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/login")) return;
  // network-first: selalu versi terbaru, jatuh ke cache saat offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/"))),
  );
});
