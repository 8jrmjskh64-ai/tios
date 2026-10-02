/* Ti OS — service worker.
   Приложение: сеть, если есть; кэш, если нет. Шрифты: кэш навсегда. */
/* Имя кэша менять не нужно: стратегия «сначала сеть» сама подтягивает
   новый index.html при каждом онлайн-запуске. Этот файл больше не трогаем. */
const APP = "tios-app";
const FONT = "tios-font-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(APP)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== APP && k !== FONT).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  // Шрифты: сначала кэш, иначе скачать и положить в кэш.
  if (isFont) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(FONT).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Приложение: сначала сеть (чтобы обновления доезжали), иначе кэш.
  // cache:"no-store" — мимо браузерного кэша: GitHub Pages просит держать
  // файлы 10 минут, и без этого приложение ещё долго видело бы старую версию.
  const fresh = new Request(req.url, { cache: "no-store", credentials: "same-origin" });
  e.respondWith(
    fetch(fresh).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(APP).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req).then(hit => hit || caches.match("./index.html"))
    )
  );
});
