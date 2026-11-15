/* ══════════════════════════════════════════════════════════════════
   DCOP7 Photography — service worker (âmbito /photography/)
   ──────────────────────────────────────────────────────────────────
   Convive com o /sw.js do portal: para páginas em /photography/ o browser
   escolhe o registo com o âmbito MAIS específico, este. Um SW controla
   TODOS os pedidos da página que controla — por isso os /data/photo/*.json
   e /assets/photo/* também passam por aqui, mesmo estando fora da pasta.

   Caches: só "foto-*". O activate apaga apenas caches foto-* antigas (e o
   do portal apaga apenas dcop7-*) — antes, o portal apagava TODAS as
   caches que não fossem a sua, o que limparia esta a cada versão nova.

   Estratégias (iguais às do portal, que foram afinadas com dor):
   • código (HTML/JS/CSS/navegação) → rede primeiro com cache:'reload'
     (o GitHub Pages serve código com max-age=600); cache só offline;
   • *.json (/data/photo e o índice de assets) → rede primeiro;
   • imagens e o resto → cache primeiro + revalidação em fundo;
   • tipos de letra → alojados em /photography/fonts/ (precache); o ramo
     das Google Fonts fica só para caches antigas.
   Mudar CACHE quando muda código para forçar o precache novo.
   ══════════════════════════════════════════════════════════════════ */
const CACHE = 'foto-v3';
const FONTS = 'foto-fonts-v1';

const STATIC = [
  '/photography/',
  '/photography/index.html',
  '/photography/manifest.webmanifest',
  '/photography/icon.svg',
  '/photography/icon-192.png',
  '/photography/fonts/fonts.css',
  '/photography/fonts/ibm-plex-mono-400-latin.woff2',
  '/photography/fonts/ibm-plex-mono-500-latin.woff2',
  '/photography/fonts/ibm-plex-mono-600-latin.woff2',
  '/photography/fonts/instrument-sans-400-700-latin.woff2',
  '/photography/fonts/instrument-serif-400-latin.woff2',
  '/photography/fonts/instrument-serif-italic-400-latin.woff2',
  '/photography/css/ph-chapters.css',
  '/photography/css/ph-desk.css',
  '/photography/css/ph-lab.css',
  '/photography/css/ph-tokens.css',
  '/photography/css/ph-ui.css',
  '/photography/css/photo-cheats.css',
  '/photography/css/photo-genre.css',
  '/photography/css/photo-learn.css',
  '/photography/css/photo-studio.css',
  '/photography/js/ph-desk.js',
  '/photography/js/ph-exif.js',
  '/photography/js/ph-icons.js',
  '/photography/js/ph-instruments.js',
  '/photography/js/ph-lab-worker.js',
  '/photography/js/ph-search.js',
  '/photography/js/ph-shell.js',
  '/photography/js/ph-sim.js',
  '/photography/js/photo-cards.js',
  '/photography/js/photo-cheats.js',
  '/photography/js/photo-editlab.js',
  '/photography/js/photo-illus.js',
  '/photography/js/photo-lab.js',
  '/photography/js/photo-learn.js',
  '/photography/js/photo-lightart.js',
  '/photography/js/photo-mannequin.js',
  '/photography/js/photography.js',
  '/photography/js/studio/ext-app.mjs',
  '/photography/js/studio/ext-city.mjs',
  '/photography/js/studio/ext-optics.mjs',
  '/photography/js/studio/st-app.mjs',
  '/photography/js/studio/st-core.mjs',
  '/photography/js/studio/st-gear.mjs',
  '/photography/js/studio/st-lights.mjs',
  '/photography/js/studio/st-plan.mjs',
  '/photography/js/studio/st-post.mjs',
  '/photography/js/studio/st-presets.mjs',
  '/photography/js/studio/st-scene.mjs',
  '/photography/js/studio/st-subject.mjs',
  '/data/photo/cheats-genre.json',
  '/data/photo/cheats.json',
  '/data/photo/colour.json',
  '/data/photo/craft.json',
  '/data/photo/edit.json',
  '/data/photo/equipment.json',
  '/data/photo/gear.json',
  '/data/photo/genres.json',
  '/data/photo/know.json',
  '/data/photo/lab.json',
  '/data/photo/looks.json',
  '/data/photo/own.json',
  '/data/photo/profiles.json',
  '/data/photo/read.json',
  '/data/photo/techniques.json',
  '/data/photo/vision.json',
  '/assets/photo/index.json',
  '/assets/photo/site/site-hero-own.webp',
  '/assets/photo/site/site-hero-own-m.webp',
  '/assets/photo/site/site-area-fotografar.webp',
  '/assets/photo/site/site-area-aprender.webp',
  '/assets/photo/site/site-area-editar.webp',
  '/assets/photo/site/lab-studio.webp',
  '/assets/photo/site/lab-street.webp',
  '/assets/photo/own/own-15.webp',
  '/assets/photo/own/own-18.webp',
  '/assets/photo/own/t/own-18.webp',
  '/assets/photo/own/t/own-16.webp',
];

self.addEventListener('install', e => {
  /* um a um: com addAll, um único 404 rejeita a instalação inteira */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(STATIC.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(rs => {
        rs.forEach((r, i) => { if (r.status === 'rejected') console.warn('[foto-sw] precache falhou:', STATIC[i]); });
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('foto-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(cacheName, req, res) {
  if (res && (res.status === 200 && (res.type === 'basic' || res.type === 'cors'))) {
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
  const isCode = isNav || /\.(?:m?js|css|html|webmanifest)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => put(CACHE, req, res))
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (isNav ? caches.match('/photography/') : undefined))
          .then(hit => hit || Response.error()))
    );
    return;
  }

  /* qualquer JSON (dados + assets/photo/index.json, que muda quando entram
     imagens novas) → rede primeiro */
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => put(CACHE, req, res))
        .catch(() => caches.match(req).then(hit => hit || Response.error()))
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
