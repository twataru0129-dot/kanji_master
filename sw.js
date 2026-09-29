/*
 * Service Worker（オフライン対応）
 * ・キャッシュ名にアプリのバージョンを含めるので、APP_VERSION を上げると自動で入れかわります。
 * ・HTML/JS/CSS は「ネットワーク優先」（更新がすぐ反映される）、
 *   失敗したときだけキャッシュを使います（オフラインでも動く）。
 */
importScripts('js/version.js');

const CACHE_NAME = 'kanji-master-' + self.KanjiApp.APP_VERSION;

const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'css/screens.css',
  'css/kids.css',
  'css/effects.css',
  'css/print.css',
  'css/sakura.css',
  'app.js',
  'manifest.webmanifest',
  'js/version.js',
  'js/utils.js',
  'js/storage.js',
  'js/kanji-db.js',
  'js/profiles.js',
  'js/proficiency.js',
  'js/history.js',
  'js/romaji.js',
  'js/quiz.js',
  'js/achievements.js',
  'js/medals.js',
  'js/sound.js',
  'js/learning.js',
  'js/print.js',
  'js/sakura.js',
  'js/ui.js',
  'js/kana-pad.js',
  'js/level-picker.js',
  'js/sakura-ui.js',
  'js/router.js',
  'js/screens/profiles.js',
  'js/screens/home.js',
  'js/screens/quiz.js',
  'js/screens/zukan.js',
  'js/screens/records.js',
  'js/screens/titles.js',
  'js/screens/settings.js',
  'js/screens/print.js',
  'js/screens/sakura.js',
  'js/screens/about.js',
  'data/kanji-grade1.js',
  'data/kanji-grade2.js',
  'data/kanji-grade3.js',
  'data/kanji-grade4.js',
  'data/kanji-grade5.js',
  'data/kanji-grade6.js',
  'data/kanji-junior1.js',
  'data/kanji-junior2.js',
  'data/kanji-junior3.js',
  'data/sources.js',
  'js/reading-data.js',
  'data/sentences.js',
  'data/life-kanji.js',
  'data/sakura-kanji.js',
  'assets/sakura/sakura-emblem.png',
  'assets/sakura/sakura-emblem-192.png',
  'assets/icons/kanji-icon-192.png',
  'assets/icons/kanji-icon-512.png',
  'assets/icons/kanji-favicon-32.png',
  'assets/icons/kanji-apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kanji-master-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
