/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — service worker (âmbito /productivity/)
   ──────────────────────────────────────────────────────────────────
   Mesmo desenho do SW da Fotografia: para páginas em /productivity/ o
   browser escolhe o registo de âmbito mais específico (este), e este SW
   controla todos os pedidos dessas páginas — incluindo /js/core/i18n.js,
   /js/vendor/anime.min.js e /css/components.css, partilhados com o portal.

   Caches: só "prod-*". O activate apaga apenas caches prod-* antigas (o
   portal apaga só dcop7-*, a Fotografia só foto-*).

   Estratégias:
   • código (HTML/JS/CSS/navegação) → rede primeiro com cache:'reload';
     cache só quando offline;
   • Google Fonts → cache primeiro;
   • o resto (ícones) → cache primeiro + revalidação em fundo.
   Não há dados remotos: o mundo de exemplo vive no código e no
   localStorage do visitante. Mudar CACHE quando muda código.
   ══════════════════════════════════════════════════════════════════ */
const CACHE = 'prod-v2';
const FONTS = 'prod-fonts-v1';

const STATIC = [
  '/productivity/',
  '/productivity/index.html',
  '/productivity/manifest.webmanifest',
  '/productivity/icon.svg',
  '/productivity/icon-192.png',
  '/productivity/css/pr-tokens.css',
  '/productivity/css/pr-ui.css',
  '/productivity/css/pr-learn.css',
  '/productivity/css/pr-notion.css',
  '/productivity/css/pr-explore.css',
  '/productivity/css/pr-apply.css',
  '/productivity/css/pr-mind.css',
  '/productivity/js/pr-i18n.js',
  '/productivity/js/pr-core.js',
  '/productivity/js/pr-seed.js',
  '/productivity/js/pr-world.js',
  '/productivity/js/pr-learn-content.js',
  '/productivity/js/pr-mind-content.js',
  '/productivity/js/pr-learn.js',
  '/productivity/js/pr-notion.js',
  '/productivity/js/pr-capture.js',
  '/productivity/js/pr-tools-data.js',
  '/productivity/js/pr-explore.js',
  '/productivity/js/pr-week.js',
  '/productivity/js/pr-apply.js',
  '/productivity/js/pr-mind.js',
  '/productivity/js/pr-mind-dir.js',
  '/productivity/js/pr-app.js',
  '/productivity/js/pr-shell.js',
  '/js/core/i18n.js',
  '/js/vendor/anime.min.js',
  '/css/components.css',
];

self.addEventListener('install', e => {
  /* um a um: com addAll, um único 404 rejeita a instalação inteira */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(rs => {
        rs.forEach((r, i) => { if (r.status === 'rejected') console.warn('[prod-sw] precache falhou:', STATIC[i]); });
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('prod-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(cacheName, req, res) {
  if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
    const clone = res.clone();
    caches.open(cacheName).then(c => c.put(req, clone));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => put(FONTS, req, res)).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  const isNav = req.mode === 'navigate';
  const isCode = isNav || /\.(?:m?js|css|html|webmanifest|json)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => put(CACHE, req, res))
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (isNav ? caches.match('/productivity/') : undefined))
          .then(hit => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => put(CACHE, req, res)).catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
