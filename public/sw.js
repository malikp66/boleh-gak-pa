// Cache tampilan aplikasi supaya tetap terbuka walau sinyal putus.
// Panggilan /api/* dan halaman login tidak pernah di-cache (data keluarga tidak disimpan di HP).
const CACHE = "boleh-gak-ya-v2-4";

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

// ---------------------------------------------------------------- notifikasi pengingat
self.addEventListener("push", (e) => {
  let data = { title: "Boleh Gak, Ya?", body: "", url: "/" };
  try { data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
    tag: data.tag, renotify: Boolean(data.tag), data: { url: data.url || "/", nudge: data.nudge }, lang: "id",
    actions: data.nudge ? [{ action: "nudge", title: "🔔 Ingatkan" }] : [],
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // tombol "Ingatkan" langsung mengirim bel tanpa membuka aplikasi
  if (e.action === "nudge" && e.notification.data?.nudge) {
    e.waitUntil(
      fetch("/api/nudge", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: e.notification.data.nudge }),
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => self.registration.showNotification(ok ? "🔔 Sudah diingatkan" : "Belum terkirim", {
          body: ok ? `${d.nama} akan menerima pengingat di HP-nya.` : d.error || "Coba lagi dari aplikasi.",
          icon: "/icons/icon-192.png", tag: "bel-hasil", lang: "id",
        }))
        .catch(() => {}),
    );
    return;
  }
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin)) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
