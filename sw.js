const CACHE = 'dcop7-v2';
const STATIC = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
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
  '/command-palette.js',
  '/search.js',
  '/links-page.js',
  '/game-host.js',
  '/hangman.js',
  '/minesweeper.js',
  '/bomb.js',
  '/game-memory.js',
  '/game-tictactoe.js',
  '/game-wordle.js',
  '/game-shooting.js',
  '/game-reaction.js',
  '/game-neon.js',
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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
