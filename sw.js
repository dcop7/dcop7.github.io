const CACHE = 'dcop7-v72';
const STATIC = [
  '/',
  '/index.html',
  '/i18n.js',
  '/css/base.css',
  '/css/views/explorer.css',
  '/css/views/explorer-body.css',
  '/css/views/ocorrencias.css',
  '/css/views/quiz.css',
  '/data/countries.json',
  '/data/world-countries.geojson',
  '/data/pt-districts.geojson',
  /* Core */
  '/js/core/main.js',
  '/js/core/nav.js',
  '/js/core/search.js',
  '/js/core/settings.js',
  '/js/core/parallax.js',
  /* Explorer */
  '/js/explorer/explorer.js',
  '/js/explorer/pt-concelhos-info.js',
  '/js/explorer/explorer-portugal.js',
  '/js/explorer/explorer-solar.js',
  '/js/explorer/explorer-galaxy.js',
  '/js/explorer/explorer-realtime.js',
  '/js/explorer/explorer-body.js',
  '/js/explorer/ocorrencias.js',
  /* Pages */
  '/js/pages/links-data.js',
  '/js/pages/links-page.js',
  '/js/pages/tools.js',
  '/js/pages/visual.js',
  '/js/pages/photography.js',
  '/js/pages/workout.js',
  '/js/pages/media.js',
  '/js/pages/cheatsheets.js',
  /* Quiz */
  '/js/quiz/quiz-engine.js',
  '/js/quiz/quiz-data.js',
  '/js/quiz/quiz-providers.js',
  '/js/quiz/quiz-page.js',
  /* Games (most-used preloaded; rest cached on demand) */
  '/js/games/game-host.js',
  '/js/games/hangman.js',
  '/games/hangman/config.json',
  '/games/hangman/pt/words.json',
  '/games/hangman/en/words.json',
  '/js/games/minesweeper.js',
  '/js/games/bomb.js',
  '/js/games/game-memory.js',
  '/js/games/game-tictactoe.js',
  '/js/games/game-shooting.js',
  '/js/games/game-reaction.js',
  '/js/games/game-neon.js',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function _cachePut(req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    const clone = res.clone();
    caches.open(CACHE).then(c => c.put(req, clone));
  }
  return res;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  /* Code (HTML/JS/CSS) → NETWORK-FIRST, and crucially with cache:'reload' so the
     request bypasses the browser's HTTP cache and always revalidates with the
     server. GitHub Pages serves code with max-age=600, so a plain fetch() could
     keep returning a 10-min-stale file even on a hard reload — which is exactly
     why fixes appeared "not to show up" on the live site. Cache is offline
     fallback only. */
  const isCode = e.request.mode === 'navigate' || /\.(?:js|css|html)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .then(res => _cachePut(e.request, res))
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* Data / images / fonts → cache-first (stale-while-revalidate): fast and
     they change rarely or are content-versioned. */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => _cachePut(e.request, res)).catch(() => cached);
      return cached || fresh;
    })
  );
});
