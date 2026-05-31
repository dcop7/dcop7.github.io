const CACHE = 'dcop7-v24';
const STATIC = [
  '/',
  '/index.html',
  '/main.js',
  '/explorer.js',
  '/explorer-portugal.js',
  '/explorer-solar.js',
  '/ocorrencias.js',
  '/parallax.js',
  '/css/base.css',
  '/css/views/explorer.css',
  '/css/views/ocorrencias.css',
  '/data/countries.json',
  '/data/world-countries.geojson',
  '/data/pt-districts.geojson',
  '/nav.js',
  '/i18n.js',
  '/links-data.js',
  '/tools.js',
  '/visual.js',
  '/photography.js',
  '/settings.js',
  '/workout.js',
  '/media.js',
  '/cheatsheets.js',
  '/quiz-engine.js',
  '/quiz-data.js',
  '/quiz-providers.js',
  '/quiz-page.js',
  '/search.js',
  '/links-page.js',
  '/game-host.js',
  '/hangman.js',
  '/minesweeper.js',
  '/bomb.js',
  '/game-memory.js',
  '/game-tictactoe.js',
  '/game-shooting.js',
  '/game-reaction.js',
  '/game-neon.js',
  '/css/views/quiz.css',
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

  /* Code (HTML/JS/CSS) → NETWORK-FIRST so a deploy is seen immediately when
     online; cache is the offline fallback. Previously these were served
     cache-first, which made every deploy lag by a reload (the cause of
     "my fix doesn't show up"). */
  const isCode = e.request.mode === 'navigate' || /\.(?:js|css|html)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(e.request).then(res => _cachePut(e.request, res)).catch(() => caches.match(e.request))
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
