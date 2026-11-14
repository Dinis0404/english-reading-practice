// English Reading Lab — Service Worker：離線支援
// 策略：安裝時預緩存應用外殼與資料檔；資產用 stale-while-revalidate 更新；
// 頁面導航 network-first（有網時拿最新版，離線退回緩存）；跨域字體 cache-first。
const CACHE = "erp-v3-vocab";

const PRECACHE = [
  "./", "./index.html",
  "./css/app.css",
  "./js/config.js", "./js/util.js", "./js/ui.js", "./js/store.js", "./js/sync.js",
  "./js/dict.js", "./js/marks.js", "./js/backup.js", "./js/app.js",
  "./js/views/gate.js", "./js/views/home.js", "./js/views/run.js", "./js/views/review.js",
  "./js/views/history.js", "./js/views/settings.js", "./js/views/vocab.js",
  "./vendor/supabase.js",
  "./data/manifest.json", "./data/dict.json", "./data/forms.json",
  "./data/vocab/senior2.json",
  "./assets/icon.svg", "./assets/icon.png", "./assets/icon-512.png", "./assets/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 頁面導航：network-first，離線退回緩存的 index.html
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  // 跨域（Google Fonts 等）：cache-first
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })),
    );
    return;
  }

  // 同源資產：stale-while-revalidate
  e.respondWith(
    caches.match(req).then((hit) => {
      const update = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || update;
    }),
  );
});
