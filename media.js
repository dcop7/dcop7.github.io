const MediaPage = (function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────────
  const PROXY = u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;
  const TVZ   = 'https://api.tvmaze.com';
  const CINE  = 'https://v3-cinemeta.strem.io';
  const TMDB  = 'https://api.themoviedb.org/3';
  const IMG_P = 'https://image.tmdb.org/t/p/w342';
  const MS    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const BAD_TV  = new Set(['Talk Show','News','Reality','Game Show','Award Show','Sports']);
  const INDIAN  = new Set(['hi','te','ta','ml','kn','bn','mr','gu','pa','or','as','ur','si','ne']);

  // Major movie/trailer YouTube channels
  const YT_CHANNELS = [
    {id:'UCjmJDjT3AZYRNKYrB4dFtMQ', name:'Warner Bros.'},
    {id:'UCcgqSM4YEo5vVQpqwN-MaNw', name:'Universal Pictures'},
    {id:'UCivlGyO_A6Bz3Q3CrSBHnpg', name:'Sony Pictures'},
    {id:'UCbmNph6atAoGfqLoCL_duAg', name:'Movieclips Trailers'},
    {id:'UC9HBeMOED3d2hFVQ8NRjOSQ', name:'Paramount Pictures'},
    {id:'UCzWQYUVCpZqtN93H8RR44Qw', name:'20th Century Studios'},
    {id:'UCuTBDMCI-e9AqVlW2p6Tfrw', name:'Lionsgate Movies'},
    {id:'UCt5CTRd4vWV9fMbHuMFo5pQ', name:'A24'},
    {id:'UCWX3yGbODI3HHCIzFv_HAnA', name:'Netflix'},
    {id:'UC1-LD4lBEFJSrjYxNqP7TDg', name:'Disney'},
  ];

  // ── STATE ──────────────────────────────────────────────────────────
  let _built  = false;
  let _loaded = false;
  let _yt     = null;
  let _view   = localStorage.getItem('md-view')     || 'comfortable';
  let _key    = localStorage.getItem('tmdb-api-key') || '';

  const _days = {
    tv:       +(localStorage.getItem('md-tv')       || 7 ),
    trailers: +(localStorage.getItem('md-trailers') || 7 ),
    theaters: +(localStorage.getItem('md-theaters') || 30),
    digital:  +(localStorage.getItem('md-digital')  || 7 ),
  };

  const _open = {
    tv:       localStorage.getItem('md-open-tv')       !== 'false',
    trailers: localStorage.getItem('md-open-trailers') !== 'false',
    theaters: localStorage.getItem('md-open-theaters') !== 'false',
    digital:  localStorage.getItem('md-open-digital')  !== 'false',
  };

  // ── HELPERS ────────────────────────────────────────────────────────
  const ago   = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  const today = () => new Date().toISOString().slice(0,10);
  const esc   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const strip = h => (h||'').replace(/<[^>]+>/g,'');
  const clamp = (v,a,b) => Math.max(a, Math.min(b, +v||a));

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s.length===10 ? s+'T12:00:00' : s);
    return isNaN(d) ? '' : `${d.getDate()} ${MS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function abortFetch(ms) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  // ── TV EPISODES — TVmaze (free, no key) ────────────────────────────
  async function fetchTV(days) {
    const dates = [];
    for (let i = 0; i < Math.min(days, 14); i++) {
      const d = new Date(); d.setDate(d.getDate()-i);
      dates.push(d.toISOString().slice(0,10));
    }
    const batches = await Promise.all(
      dates.flatMap(date => [
        fetch(`${TVZ}/schedule?country=US&date=${date}`, {signal:abortFetch(6000)}).then(r=>r.json()).catch(()=>[]),
        fetch(`${TVZ}/schedule?country=GB&date=${date}`, {signal:abortFetch(6000)}).then(r=>r.json()).catch(()=>[]),
        fetch(`${TVZ}/schedule/web?date=${date}`,        {signal:abortFetch(6000)}).then(r=>r.json()).catch(()=>[]),
      ])
    );
    const seen = new Set();
    const out  = [];
    batches.flat().forEach(ep => {
      if (!ep?.show || !ep?.airdate) return;
      if ((ep.show.genres||[]).some(g => BAD_TV.has(g))) return;
      const k = `${ep.show.id}-S${ep.season}E${ep.number}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(ep);
    });
    out.sort((a,b) => {
      const d = (b.airstamp||b.airdate||'').localeCompare(a.airstamp||a.airdate||'');
      return d || (b.show.rating?.average||0)-(a.show.rating?.average||0);
    });
    return out;
  }

  // ── TRAILERS — YouTube RSS (free, via CORS proxy) ──────────────────
  async function ytRSS(channelId) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    let text = null;

    // Try direct first (works if YouTube sends CORS headers for this channel)
    try {
      const r = await fetch(url, {signal:abortFetch(4000)});
      if (r.ok) text = await r.text();
    } catch {}

    // Fallback: CORS proxy
    if (!text) {
      try {
        const r = await fetch(PROXY(url), {signal:abortFetch(8000)});
        if (r.ok) text = await r.text();
      } catch {}
    }
    if (!text) return [];

    const doc = new DOMParser().parseFromString(text, 'text/xml');
    return [...doc.querySelectorAll('entry')].map(e => {
      const raw = e.querySelector('id')?.textContent || '';
      const vid = raw.includes(':') ? raw.split(':').pop() : raw;
      return {
        vid,
        title:     e.querySelector('title')?.textContent?.trim() || '',
        published: (e.querySelector('published')?.textContent || '').slice(0,10),
        author:    e.querySelector('author name, name')?.textContent?.trim() || '',
        thumb:     e.querySelector('thumbnail')?.getAttribute('url') ||
                   (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : ''),
      };
    }).filter(v => v.vid && v.title);
  }

  async function fetchTrailers(days) {
    const since = ago(days);
    const feeds  = await Promise.all(YT_CHANNELS.map(ch => ytRSS(ch.id)));
    const seen   = new Set();
    const out    = [];
    feeds.flat().forEach(v => {
      if (!v.vid || seen.has(v.vid)) return;
      seen.add(v.vid);
      if (v.published && v.published < since) return;
      const lc = v.title.toLowerCase();
      if (!lc.includes('trailer') && !lc.includes('teaser') && !lc.includes('official')) return;
      out.push(v);
    });
    out.sort((a,b) => (b.published||'').localeCompare(a.published||''));
    return out;
  }

  // ── MOVIES — Cinemeta/Stremio (free, no key) ──────────────────────
  async function fetchCinemeta(skip = 0) {
    try {
      const url = `${CINE}/catalog/movie/top${skip?`/skip=${skip}`:''}.json`;
      const r   = await fetch(url, {signal:abortFetch(8000)});
      if (!r.ok) return [];
      const d = await r.json();
      return d.metas || [];
    } catch { return []; }
  }

  // ── TMDB — optional enhanced data ─────────────────────────────────
  async function tget(path, params={}) {
    if (!_key) return null;
    const u = new URL(`${TMDB}${path}`);
    u.searchParams.set('api_key', _key);
    u.searchParams.set('language', 'pt-PT');
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k,v));
    try {
      const r = await fetch(u, {cache:'no-store', signal:abortFetch(8000)});
      if (r.status===401) return {_auth:true};
      return r.ok ? r.json() : null;
    } catch { return null; }
  }

  async function fetchTMDB(type, days) {
    const since = ago(days);
    const opts  = type==='theaters'
      ? {with_release_type:'3','release_date.gte':since,'release_date.lte':today(),region:'PT',sort_by:'release_date.desc'}
      : {with_release_type:'4|5','primary_release_date.gte':since,'primary_release_date.lte':today(),sort_by:'primary_release_date.desc'};
    const out = [];
    for (let p=1; p<=4; p++) {
      const d = await tget('/discover/movie', {...opts, page:p});
      if (d?._auth) return {_auth:true};
      if (!d?.results?.length) break;
      d.results.filter(m => !INDIAN.has(m.original_language)).forEach(m => out.push(m));
      if (p >= (d.total_pages||1)) break;
    }
    return out;
  }

  // ── CARD TEMPLATES ─────────────────────────────────────────────────
  function tvCard(ep) {
    const s   = ep.show;
    const img = s.image?.medium || s.image?.original || '';
    const net = s.network?.name || s.webChannel?.name || '';
    const rat = s.rating?.average;
    const sum = strip(s.summary||'').slice(0,105);
    const epN = `T${ep.season}E${String(ep.number||0).padStart(2,'0')}`;
    return `<div class="mc" data-type="tv">
      <div class="mc-img">${img?`<img src="${esc(img)}" alt="${esc(s.name)}" loading="lazy">`:'<div class="mc-ph">📺</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb mb-tv">Série</span>
          ${(s.genres||[]).slice(0,2).map(g=>`<span class="mb mb-genre">${esc(g)}</span>`).join('')}
          ${rat?`<span class="mb mb-rat">★ ${rat}</span>`:''}
        </div>
        <div class="mc-title">${esc(s.name)}</div>
        <div class="mc-sub">${epN}${ep.name?` · ${esc(ep.name)}`:''}</div>
        <div class="mc-desc">${sum?esc(sum)+'…':''}</div>
        <div class="mc-meta">
          ${net?`<span>${esc(net)}</span>`:''}
          ${ep.airdate?`<span>${fmtDate(ep.airdate)}</span>`:''}
        </div>
      </div>
    </div>`;
  }

  function trailerCard(v) {
    const thumb = v.thumb || `https://i.ytimg.com/vi/${v.vid}/hqdefault.jpg`;
    const lc    = v.title.toLowerCase();
    const tag   = lc.includes('teaser')?'Teaser':lc.includes('trailer')?'Trailer':'Oficial';
    return `<div class="mc mc-trailer" data-yt="${esc(v.vid)}" data-title="${esc(v.title)}">
      <div class="mc-img mc-img-wide">
        <img src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy">
        <div class="mc-play"><svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>
      </div>
      <div class="mc-body">
        <div class="mc-badges"><span class="mb mb-trailer">${tag}</span></div>
        <div class="mc-title">${esc(v.title)}</div>
        <div class="mc-meta">
          ${v.author?`<span>${esc(v.author)}</span>`:''}
          ${v.published?`<span>${fmtDate(v.published)}</span>`:''}
        </div>
      </div>
    </div>`;
  }

  function cinemetaCard(m) {
    const img   = m.poster||'';
    const title = m.name||m.title||'';
    const year  = m.releaseInfo||m.year||'';
    const rat   = m.imdbRating||'';
    const desc  = strip(m.description||'').slice(0,105);
    return `<div class="mc" data-type="movie">
      <div class="mc-img">${img?`<img src="${esc(img)}" alt="${esc(title)}" loading="lazy">`:'<div class="mc-ph">🎬</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb mb-movie">Filme</span>
          ${(m.genres||[]).slice(0,2).map(g=>`<span class="mb mb-genre">${esc(g)}</span>`).join('')}
          ${rat?`<span class="mb mb-rat">★ ${rat}</span>`:''}
        </div>
        <div class="mc-title">${esc(title)}</div>
        ${year?`<div class="mc-sub">${esc(String(year))}</div>`:''}
        <div class="mc-desc">${desc?esc(desc)+'…':''}</div>
      </div>
    </div>`;
  }

  function tmdbCard(m, badge) {
    const img   = m.poster_path ? `${IMG_P}${m.poster_path}` : '';
    const title = m.title||m.name||'';
    const ov    = strip(m.overview||'').slice(0,105);
    const rat   = m.vote_average && +m.vote_average > 0 ? (+m.vote_average).toFixed(1) : null;
    const date  = m.release_date||'';
    return `<div class="mc" data-type="movie">
      <div class="mc-img">${img?`<img src="${esc(img)}" alt="${esc(title)}" loading="lazy">`:'<div class="mc-ph">🎬</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb ${badge==='Cinemas PT'?'mb-cinema':'mb-digital'}">${badge}</span>
          ${rat?`<span class="mb mb-rat">★ ${rat}</span>`:''}
        </div>
        <div class="mc-title">${esc(title)}</div>
        ${ov?`<div class="mc-desc">${esc(ov)}…</div>`:''}
        ${date?`<div class="mc-meta"><span>${fmtDate(date)}</span></div>`:''}
      </div>
    </div>`;
  }

  // ── UI HELPERS ─────────────────────────────────────────────────────
  const mkGrid = (cards, empty) =>
    cards?.length
      ? `<div class="media-grid">${cards.join('')}</div>`
      : `<div class="media-empty">${empty||'Sem resultados.'}</div>`;

  const mkLoad = txt =>
    `<div class="media-loading"><div class="media-spinner"></div>${txt}</div>`;

  const mkFreeNote = () =>
    `<div class="media-free-note">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Dados gerais — para informação de PT e datas exatas, configura a
      <button class="media-link-btn" onclick="document.getElementById('md-settings-panel').classList.toggle('open')">chave TMDB gratuita</button>.
    </div>`;

  function setBadge(sid, n) {
    const b = document.querySelector(`[data-section="${sid}"] .md-count`);
    if (b) { b.textContent = n>99?'99+':n; b.style.opacity = n?'1':'0.4'; }
  }

  function getBody(sid) { return document.querySelector(`[data-section="${sid}"] .md-body`); }

  // ── LOADERS ────────────────────────────────────────────────────────
  async function loadTV() {
    const bd = getBody('tv'); if (!bd) return;
    bd.innerHTML = mkLoad('A carregar episódios…');
    const eps = await fetchTV(_days.tv);
    const top = eps.slice(0, 60);
    bd.innerHTML = mkGrid(top.map(tvCard), `Nenhum episódio nos últimos ${_days.tv} dias.`);
    setBadge('tv', top.length);
  }

  async function loadTrailers() {
    const bd = getBody('trailers'); if (!bd) return;
    bd.innerHTML = mkLoad('A carregar trailers…');
    const vids = await fetchTrailers(_days.trailers);
    const top  = vids.slice(0, 30);
    bd.innerHTML = mkGrid(top.map(trailerCard), 'Nenhum trailer encontrado.<br><small style="color:var(--muted);font-size:.72rem">O proxy CORS pode estar indisponível.</small>');
    setBadge('trailers', top.length);
    bd.querySelectorAll('.mc-trailer').forEach(c =>
      c.addEventListener('click', () => openYT(c.dataset.yt, c.dataset.title))
    );
  }

  async function loadTheaters() {
    const bd = getBody('theaters'); if (!bd) return;
    bd.innerHTML = mkLoad('A carregar filmes em exibição…');

    if (_key) {
      const data = await fetchTMDB('theaters', _days.theaters);
      if (data?._auth) { bd.innerHTML = '<div class="media-err">Chave TMDB inválida.</div>'; return; }
      if (Array.isArray(data) && data.length) {
        bd.innerHTML = mkGrid(data.map(m=>tmdbCard(m,'Cinemas PT')), '');
        setBadge('theaters', data.length); return;
      }
    }

    // Free fallback: Cinemeta
    const metas = await fetchCinemeta(0);
    const yr    = new Date().getFullYear();
    const movies = metas.filter(m => +parseInt(m.releaseInfo||m.year||0) >= yr-1).slice(0, 20);
    bd.innerHTML = mkGrid(movies.map(cinemetaCard), 'Sem filmes encontrados.') + mkFreeNote();
    setBadge('theaters', movies.length);
  }

  async function loadDigital() {
    const bd = getBody('digital'); if (!bd) return;
    bd.innerHTML = mkLoad('A carregar lançamentos digitais…');

    if (_key) {
      const data = await fetchTMDB('digital', _days.digital);
      if (data?._auth) { bd.innerHTML = '<div class="media-err">Chave TMDB inválida.</div>'; return; }
      if (Array.isArray(data) && data.length) {
        bd.innerHTML = mkGrid(data.map(m=>tmdbCard(m,'Digital / Blu-ray')), '');
        setBadge('digital', data.length); return;
      }
    }

    const metas = await fetchCinemeta(20);
    const yr    = new Date().getFullYear();
    const movies = metas.filter(m => +parseInt(m.releaseInfo||m.year||0) >= yr-1).slice(0, 20);
    bd.innerHTML = mkGrid(movies.map(cinemetaCard), 'Sem lançamentos encontrados.') + mkFreeNote();
    setBadge('digital', movies.length);
  }

  const LOADERS = {tv:loadTV, trailers:loadTrailers, theaters:loadTheaters, digital:loadDigital};

  // ── YOUTUBE MODAL ──────────────────────────────────────────────────
  function openYT(key, title) {
    _yt = key;
    const m = document.getElementById('yt-modal');
    if (!m) return;
    m.querySelector('.yt-title').textContent = title || 'Trailer';
    m.querySelector('.yt-frame').innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0"
               allow="autoplay;encrypted-media;fullscreen" allowfullscreen frameborder="0"></iframe>`;
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeYT() {
    _yt = null;
    const m = document.getElementById('yt-modal');
    if (!m) return;
    m.classList.remove('show');
    m.querySelector('.yt-frame').innerHTML = '';
    document.body.style.overflow = '';
  }

  // ── COLLAPSE ───────────────────────────────────────────────────────
  function setCollapse(sid, open) {
    _open[sid] = open;
    localStorage.setItem(`md-open-${sid}`, open);
    const sec = document.querySelector(`[data-section="${sid}"]`);
    sec?.classList.toggle('md-collapsed', !open);
    sec?.querySelector('.md-toggle')?.setAttribute('aria-expanded', open);
  }

  // ── VIEW MODE ──────────────────────────────────────────────────────
  function applyView() {
    const page = document.getElementById('view-media');
    if (!page) return;
    page.classList.toggle('md-compact',    _view==='compact');
    page.classList.toggle('md-comfortable', _view==='comfortable');
    page.querySelectorAll('.md-vbtn[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === _view)
    );
  }

  // ── BUILD ──────────────────────────────────────────────────────────
  function mkSection(sid, icon, label, daysKey) {
    const open = _open[sid];
    return `<div class="md-section${open?'':' md-collapsed'}" data-section="${sid}">
      <div class="md-section-hdr">
        <button class="md-toggle" data-sid="${sid}" aria-expanded="${open}">
          <span class="md-s-icon">${icon}</span>
          <span class="md-s-label">${label}</span>
          <span class="md-count">—</span>
          <svg class="md-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="md-ctrl">
          <span class="md-ctrl-lbl">Últimos</span>
          <input class="md-days-in" type="number" min="1" max="180" value="${_days[daysKey]}" data-key="${daysKey}" data-sid="${sid}">
          <span class="md-ctrl-lbl">dias</span>
          <button class="md-reload" data-sid="${sid}" title="Recarregar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
      <div class="md-body">${mkLoad('A carregar…')}</div>
    </div>`;
  }

  function build() {
    const view = document.getElementById('view-media');
    if (!view || _built) return;
    _built = true;

    view.innerHTML = `
    <div class="view-inner md-page">

      <div class="md-page-hdr">
        <h1 class="md-page-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64A2.18 2.18 0 0 0 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2z"/><polygon points="10 15 15 12 10 9 10 15"/></svg>
          Entretenimento
        </h1>
        <div class="md-page-controls">
          <div class="md-view-toggle">
            <button class="md-vbtn${_view==='comfortable'?' active':''}" data-view="comfortable" title="Vista confortável">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              <span>Confortável</span>
            </button>
            <button class="md-vbtn${_view==='compact'?' active':''}" data-view="compact" title="Vista compacta">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
              <span>Compacta</span>
            </button>
          </div>
          <div class="md-tmdb-wrap">
            <button class="md-tmdb-btn" id="md-tmdb-btn" title="Configurar chave TMDB (opcional)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              TMDB
              <span class="md-key-dot${_key?' md-key-ok':''}"></span>
            </button>
            <div class="md-settings-panel" id="md-settings-panel">
              <div class="md-sp-hdr">
                <span class="md-sp-title">Chave TMDB</span>
                <span class="md-sp-badge">Opcional</span>
              </div>
              <p class="md-sp-desc">Desbloqueia dados precisos de cinemas portugueses e lançamentos digitais. É completamente gratuita — só precisas de criar uma conta TMDB.</p>
              <div class="md-sp-row">
                <input type="password" id="md-key-in" class="md-key-in" placeholder="Cole a chave API aqui…" value="${esc(_key)}" autocomplete="off">
                <button class="md-key-save" id="md-key-save">Guardar</button>
              </div>
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="md-sp-link">Obter chave gratuita em themoviedb.org →</a>
              <p class="md-sp-note">Sem chave, a secção Cinemas PT e Digital & Blu-ray mostra filmes populares recentes como alternativa.</p>
            </div>
          </div>
        </div>
      </div>

      ${mkSection('tv','📺','Episódios Recentes de TV','tv')}

      <div class="md-cols">
        ${mkSection('trailers','🎬','Trailers','trailers')}
        ${mkSection('theaters','🍿','Cinemas em Portugal','theaters')}
        ${mkSection('digital', '💿','Digital & Blu-ray','digital')}
      </div>

    </div>

    <div class="yt-modal" id="yt-modal">
      <div class="yt-backdrop"></div>
      <div class="yt-box">
        <div class="yt-hdr">
          <span class="yt-title"></span>
          <button class="yt-close" id="yt-close">✕</button>
        </div>
        <div class="yt-frame"></div>
      </div>
    </div>`;

    // View toggle
    view.querySelectorAll('.md-vbtn[data-view]').forEach(b =>
      b.addEventListener('click', () => {
        _view = b.dataset.view;
        localStorage.setItem('md-view', _view);
        applyView();
      })
    );

    // TMDB settings panel
    const tmdbBtn   = document.getElementById('md-tmdb-btn');
    const settingsP = document.getElementById('md-settings-panel');
    tmdbBtn?.addEventListener('click', e => { e.stopPropagation(); settingsP?.classList.toggle('open'); });
    document.addEventListener('click', e => {
      if (settingsP?.classList.contains('open') && !settingsP.contains(e.target) && !tmdbBtn?.contains(e.target))
        settingsP.classList.remove('open');
    });

    document.getElementById('md-key-save')?.addEventListener('click', saveKey);
    document.getElementById('md-key-in')?.addEventListener('keydown', e => { if(e.key==='Enter') saveKey(); });

    // Section events (collapse, reload, days)
    view.addEventListener('click', e => {
      const tog = e.target.closest('.md-toggle');
      if (tog) { setCollapse(tog.dataset.sid, !_open[tog.dataset.sid]); return; }
      const rel = e.target.closest('.md-reload');
      if (rel) LOADERS[rel.dataset.sid]?.();
    });

    view.addEventListener('change', e => {
      const inp = e.target.closest('.md-days-in');
      if (!inp) return;
      const v = clamp(parseInt(inp.value), 1, 180);
      inp.value = v;
      _days[inp.dataset.key] = v;
      localStorage.setItem(`md-${inp.dataset.key}`, v);
    });

    // YouTube modal
    document.getElementById('yt-close')?.addEventListener('click', closeYT);
    view.querySelector('.yt-backdrop')?.addEventListener('click', closeYT);
    document.addEventListener('keydown', e => { if(e.key==='Escape' && _yt) closeYT(); });

    applyView();
  }

  function saveKey() {
    _key = (document.getElementById('md-key-in')?.value||'').trim();
    localStorage.setItem('tmdb-api-key', _key);
    const dot = document.querySelector('.md-key-dot');
    if (dot) dot.className = `md-key-dot${_key?' md-key-ok':''}`;
    document.getElementById('md-settings-panel')?.classList.remove('open');
    loadTheaters();
    loadDigital();
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────
  function show() {
    build();
    if (!_loaded) {
      _loaded = true;
      loadTV();
      loadTrailers();
      loadTheaters();
      loadDigital();
    }
  }

  return { show };
})();
