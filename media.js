const MediaPage = (function () {
  'use strict';

  const TMDB  = 'https://api.themoviedb.org/3';
  const IMG_P = 'https://image.tmdb.org/t/p/w342';
  const IMG_W = 'https://image.tmdb.org/t/p/w780';
  const TVZ   = 'https://api.tvmaze.com';

  const INDIAN_LANGS = new Set(['hi','te','ta','ml','kn','bn','mr','gu','pa','or','as','ur','si','ne']);
  const BAD_GENRES_TV = new Set(['Talk Show','News','Reality','Game Show','Award Show','Sports']);
  const MS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let _key      = localStorage.getItem('tmdb-api-key') || '';
  let _built    = false;
  let _loaded   = false;
  let _ytActive = null;

  let _days = {
    tv:       +( localStorage.getItem('md-tv')       || 7 ),
    trailers: +( localStorage.getItem('md-trailers')  || 7 ),
    theaters: +( localStorage.getItem('md-theaters')  || 30),
    digital:  +( localStorage.getItem('md-digital')   || 7 ),
  };

  // ── HELPERS ────────────────────────────────────────────────────────
  function saveDays() {
    Object.entries(_days).forEach(([k,v]) => localStorage.setItem(`md-${k}`, v));
  }

  function ago(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0,10);
  }

  function today() { return new Date().toISOString().slice(0,10); }

  function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s + 'T12:00:00');
    return isNaN(d) ? s : `${d.getDate()} ${MS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function strip(html) { return (html||'').replace(/<[^>]+>/g,''); }

  // ── TMDB FETCH ─────────────────────────────────────────────────────
  async function tget(path, params = {}) {
    if (!_key) return null;
    const u = new URL(`${TMDB}${path}`);
    u.searchParams.set('api_key', _key);
    u.searchParams.set('language', 'pt-PT');
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k,v));
    try {
      const r = await fetch(u, {cache:'no-store'});
      if (r.status === 401) return {_auth: true};
      if (!r.ok) return null;
      return r.json();
    } catch { return null; }
  }

  // ── TV EPISODES (TVmaze — no key needed) ──────────────────────────
  async function fetchTV(days) {
    const dates = [];
    for (let i = 0; i < Math.min(days, 14); i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0,10));
    }
    const reqs = dates.flatMap(date => [
      fetch(`${TVZ}/schedule?country=US&date=${date}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${TVZ}/schedule?country=GB&date=${date}`).then(r=>r.json()).catch(()=>[]),
      fetch(`${TVZ}/schedule/web?date=${date}`).then(r=>r.json()).catch(()=>[]),
    ]);
    const all = await Promise.all(reqs);
    const seen = new Set();
    const results = [];

    all.flat().forEach(ep => {
      if (!ep?.show || !ep?.airdate) return;
      const genres = ep.show.genres || [];
      if ([...genres].some(g => BAD_GENRES_TV.has(g))) return;
      if (!ep.show.rating?.average && !ep.show.image) return;
      const key = `${ep.show.id}-S${ep.season}E${ep.number}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(ep);
    });

    results.sort((a,b) => {
      const dd = (b.airstamp||b.airdate||'').localeCompare(a.airstamp||a.airdate||'');
      if (dd !== 0) return dd;
      return (b.show.rating?.average||0) - (a.show.rating?.average||0);
    });
    return results;
  }

  // ── TRAILERS (TMDB) ───────────────────────────────────────────────
  async function fetchTrailers(days) {
    if (!_key) return null;
    const since = ago(days);

    const [trendM, trendTV, upcoming] = await Promise.all([
      tget('/trending/movie/week'),
      tget('/trending/tv/week'),
      tget('/movie/upcoming', {region:'PT'}),
    ]);

    if (trendM?._auth) return {_auth: true};

    const items = [
      ...(trendM?.results  || []).map(m => ({...m, _mt:'movie'})),
      ...(trendTV?.results || []).map(t => ({...t, _mt:'tv'})),
      ...(upcoming?.results|| []).map(m => ({...m, _mt:'movie'})),
    ].filter(x => !INDIAN_LANGS.has(x.original_language));

    // Deduplicate
    const uniq = new Map();
    items.forEach(x => { const k=`${x._mt}-${x.id}`; if(!uniq.has(k)) uniq.set(k,x); });

    // Fetch videos for top 28 items
    const top = [...uniq.values()].slice(0,28);
    const vidResults = await Promise.all(
      top.map(item =>
        tget(`/${item._mt}/${item.id}/videos`, {language:'en-US'})
          .then(r => ({item, videos: r?.results || []}))
      )
    );

    const trailers = [];
    vidResults.forEach(({item, videos}) => {
      const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (!trailer) return;
      const pubDate = trailer.published_at?.slice(0,10) || item.release_date || item.first_air_date || '';
      if (pubDate && pubDate < since) return;
      trailers.push({item, trailer, pubDate});
    });

    trailers.sort((a,b) => (b.pubDate||'').localeCompare(a.pubDate||''));
    return trailers;
  }

  // ── PORTUGAL THEATERS (TMDB) ──────────────────────────────────────
  async function fetchTheaters(days) {
    if (!_key) return null;
    const since = ago(days);
    const out = [];

    for (let page = 1; page <= 4; page++) {
      const data = await tget('/discover/movie', {
        with_release_type: '3',
        'release_date.gte': since,
        'release_date.lte': today(),
        region: 'PT',
        sort_by: 'release_date.desc',
        page,
      });
      if (data?._auth) return {_auth: true};
      if (!data?.results?.length) break;
      data.results
        .filter(m => !INDIAN_LANGS.has(m.original_language))
        .forEach(m => out.push(m));
      if (page >= (data.total_pages||1)) break;
    }

    out.sort((a,b) => (b.release_date||'').localeCompare(a.release_date||''));
    return out;
  }

  // ── DIGITAL / BLU-RAY (TMDB) ──────────────────────────────────────
  async function fetchDigital(days) {
    if (!_key) return null;
    const since = ago(days);
    const out = [];

    for (let page = 1; page <= 3; page++) {
      const data = await tget('/discover/movie', {
        with_release_type: '4|5',
        'primary_release_date.gte': since,
        'primary_release_date.lte': today(),
        sort_by: 'primary_release_date.desc',
        page,
      });
      if (data?._auth) return {_auth: true};
      if (!data?.results?.length) break;
      data.results
        .filter(m => !INDIAN_LANGS.has(m.original_language))
        .forEach(m => out.push(m));
      if (page >= (data.total_pages||1)) break;
    }

    out.sort((a,b) => (b.release_date||'').localeCompare(a.release_date||''));
    return out;
  }

  // ── CARD TEMPLATES ─────────────────────────────────────────────────
  function tvCard(ep) {
    const s = ep.show;
    const img = s.image?.medium || s.image?.original || '';
    const net = s.network?.name || s.webChannel?.name || '';
    const rat = s.rating?.average;
    const sum = strip(s.summary||'').slice(0,130);
    const epN = `T${ep.season}E${String(ep.number||0).padStart(2,'0')}`;
    const genres = (s.genres||[]).slice(0,2);

    return `<div class="mc" data-type="tv">
      <div class="mc-img">${img ? `<img src="${esc(img)}" alt="${esc(s.name)}" loading="lazy">` : '<div class="mc-ph">📺</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb mb-tv">Série</span>
          ${genres.map(g=>`<span class="mb mb-genre">${esc(g)}</span>`).join('')}
          ${rat ? `<span class="mb mb-rat">⭐ ${rat}</span>` : ''}
        </div>
        <div class="mc-title">${esc(s.name)}</div>
        <div class="mc-sub">${epN}${ep.name ? ` · ${esc(ep.name)}` : ''}</div>
        ${sum ? `<div class="mc-desc">${esc(sum)}…</div>` : ''}
        <div class="mc-meta">
          ${net ? `<span>📡 ${esc(net)}</span>` : ''}
          <span>📅 ${fmtDate(ep.airdate)}</span>
          ${ep.runtime ? `<span>⏱ ${ep.runtime}min</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  function trailerCard(t) {
    const it = t.item;
    const img = it.poster_path ? `${IMG_P}${it.poster_path}` : '';
    const title = esc(it.title || it.name || '');
    const ov = strip(it.overview||'').slice(0,120);
    const rat = it.vote_average ? (+it.vote_average).toFixed(1) : null;
    const isTV = it._mt === 'tv';
    const date = it.release_date || it.first_air_date || '';

    return `<div class="mc mc-trailer" data-yt="${esc(t.trailer.key)}" data-title="${title}">
      <div class="mc-img mc-img-trailer">
        ${img ? `<img src="${esc(img)}" alt="${title}" loading="lazy">` : '<div class="mc-ph">🎬</div>'}
        <button class="mc-play" aria-label="Ver trailer">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb ${isTV ? 'mb-tv' : 'mb-movie'}">${isTV ? 'Série' : 'Filme'}</span>
          <span class="mb mb-trailer">Trailer</span>
          ${rat && +rat > 0 ? `<span class="mb mb-rat">⭐ ${rat}</span>` : ''}
        </div>
        <div class="mc-title">${title}</div>
        ${ov ? `<div class="mc-desc">${esc(ov)}…</div>` : ''}
        <div class="mc-meta">
          ${date ? `<span>📅 ${fmtDate(date)}</span>` : ''}
          <span>🌐 ${esc((it.original_language||'?').toUpperCase())}</span>
        </div>
      </div>
    </div>`;
  }

  function movieCard(movie, badge) {
    const img = movie.poster_path ? `${IMG_P}${movie.poster_path}` : '';
    const title = esc(movie.title || movie.name || '');
    const ov = strip(movie.overview||'').slice(0,120);
    const rat = movie.vote_average ? (+movie.vote_average).toFixed(1) : null;
    const date = movie.release_date || '';
    const isCinema = badge === 'Cinemas PT';

    return `<div class="mc" data-type="movie">
      <div class="mc-img">${img ? `<img src="${esc(img)}" alt="${title}" loading="lazy">` : '<div class="mc-ph">🎬</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb ${isCinema ? 'mb-cinema' : 'mb-digital'}">${badge}</span>
          <span class="mb mb-movie">Filme</span>
          ${rat && +rat > 0 ? `<span class="mb mb-rat">⭐ ${rat}</span>` : ''}
        </div>
        <div class="mc-title">${title}</div>
        ${ov ? `<div class="mc-desc">${esc(ov)}…</div>` : ''}
        <div class="mc-meta">
          ${date ? `<span>📅 ${fmtDate(date)}</span>` : ''}
          ${movie.original_language ? `<span>🌐 ${esc(movie.original_language.toUpperCase())}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  // ── SHARED UI HELPERS ──────────────────────────────────────────────
  function grid(cards, empty) {
    if (!cards?.length) return `<div class="media-empty">${empty||'Sem resultados.'}</div>`;
    return `<div class="media-grid">${cards.join('')}</div>`;
  }

  function noKeyMsg() {
    return `<div class="media-info-msg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
      </svg>
      Introduz a tua <strong>chave API TMDB</strong> no topo da página para ver este conteúdo.
      <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="media-ext-link">Obter chave gratuita →</a>
    </div>`;
  }

  function authErrMsg() {
    return `<div class="media-info-msg media-info-err">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Chave API inválida ou expirada. Verifica a chave TMDB.
    </div>`;
  }

  function loadingMsg(text) {
    return `<div class="media-loading"><div class="media-spinner"></div>${text}</div>`;
  }

  function setBadge(el, n) {
    const b = el?.querySelector('.media-count');
    if (b) b.textContent = n;
  }

  // ── SECTION LOADERS ────────────────────────────────────────────────
  function body(sid) {
    return document.querySelector(`[data-section="${sid}"] .media-section-body`);
  }
  function sectionEl(sid) {
    return document.querySelector(`[data-section="${sid}"]`);
  }

  async function loadTV() {
    const el = sectionEl('tv');
    const bd = body('tv');
    if (!bd) return;
    bd.innerHTML = loadingMsg('A carregar episódios…');
    const eps = await fetchTV(_days.tv);
    const top = eps.slice(0, 48);
    bd.innerHTML = grid(top.map(tvCard), `Nenhum episódio encontrado nos últimos ${_days.tv} dias.`);
    setBadge(el, top.length);
  }

  async function loadTrailers() {
    const el = sectionEl('trailers');
    const bd = body('trailers');
    if (!bd) return;
    if (!_key) { bd.innerHTML = noKeyMsg(); return; }
    bd.innerHTML = loadingMsg('A carregar trailers…');
    const data = await fetchTrailers(_days.trailers);
    if (data?._auth) { bd.innerHTML = authErrMsg(); return; }
    const top = (data||[]).slice(0,24);
    bd.innerHTML = grid(top.map(trailerCard), 'Nenhum trailer encontrado.');
    // Attach click handlers
    el?.querySelectorAll('.mc-trailer').forEach(card => {
      card.addEventListener('click', () => openYT(card.dataset.yt, card.dataset.title));
    });
    setBadge(el, top.length);
  }

  async function loadTheaters() {
    const el = sectionEl('theaters');
    const bd = body('theaters');
    if (!bd) return;
    if (!_key) { bd.innerHTML = noKeyMsg(); return; }
    bd.innerHTML = loadingMsg('A carregar filmes em exibição…');
    const data = await fetchTheaters(_days.theaters);
    if (data?._auth) { bd.innerHTML = authErrMsg(); return; }
    bd.innerHTML = grid((data||[]).map(m => movieCard(m,'Cinemas PT')), 'Nenhum filme em exibição encontrado.');
    setBadge(el, (data||[]).length);
  }

  async function loadDigital() {
    const el = sectionEl('digital');
    const bd = body('digital');
    if (!bd) return;
    if (!_key) { bd.innerHTML = noKeyMsg(); return; }
    bd.innerHTML = loadingMsg('A carregar lançamentos digitais…');
    const data = await fetchDigital(_days.digital);
    if (data?._auth) { bd.innerHTML = authErrMsg(); return; }
    bd.innerHTML = grid((data||[]).map(m => movieCard(m,'Digital / Blu-ray')), 'Nenhum lançamento encontrado.');
    setBadge(el, (data||[]).length);
  }

  const RELOAD = {tv: loadTV, trailers: loadTrailers, theaters: loadTheaters, digital: loadDigital};

  // ── YOUTUBE MODAL ──────────────────────────────────────────────────
  function openYT(key, title) {
    _ytActive = key;
    const m = document.getElementById('yt-modal');
    if (!m) return;
    m.querySelector('.yt-modal-title').textContent = title || 'Trailer';
    m.querySelector('.yt-frame').innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0"
               allow="autoplay;encrypted-media;fullscreen" allowfullscreen frameborder="0"></iframe>`;
    m.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeYT() {
    _ytActive = null;
    const m = document.getElementById('yt-modal');
    if (!m) return;
    m.classList.remove('show');
    m.querySelector('.yt-frame').innerHTML = '';
    document.body.style.overflow = '';
  }

  // ── BUILD HTML ─────────────────────────────────────────────────────
  function buildSection(id, icon, title, daysKey) {
    return `<div class="media-section" data-section="${id}">
      <div class="media-section-hdr">
        <div class="media-section-left">
          <span class="media-section-icon">${icon}</span>
          <span class="media-section-title">${title}</span>
          <span class="media-count">—</span>
        </div>
        <div class="media-section-ctrl">
          <span class="media-days-lbl">Últimos</span>
          <input type="number" class="media-days-in" min="1" max="180"
                 value="${_days[daysKey]}" data-key="${daysKey}" data-sid="${id}">
          <span class="media-days-lbl">dias</span>
          <button class="media-reload" data-sid="${id}" title="Recarregar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="media-section-body">${loadingMsg('A carregar…')}</div>
    </div>`;
  }

  function build() {
    const view = document.getElementById('view-media');
    if (!view || _built) return;
    _built = true;

    view.innerHTML = `
      <div class="view-inner">
        <div class="media-page-hdr">
          <div class="media-page-title">🎬 Entretenimento</div>
          <div class="media-key-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <span class="media-key-lbl">Chave TMDB:</span>
            <input type="password" id="media-key-in" class="media-key-in" placeholder="Cole aqui a chave API do TMDB…" value="${esc(_key)}" autocomplete="off">
            <button class="media-key-save" id="media-key-save">Guardar</button>
            <span class="media-key-st ${_key ? 'st-ok' : 'st-miss'}" id="media-key-st">${_key ? '✓' : '—'}</span>
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" class="media-key-help" title="Obter chave TMDB gratuita (requer conta gratuita)">Obter chave grátis →</a>
          </div>
        </div>

        ${buildSection('tv',       '📺', 'Episódios Recentes',     'tv'      )}
        ${buildSection('trailers', '🎬', 'Trailers em Destaque',   'trailers')}
        ${buildSection('theaters', '🍿', 'Cinemas em Portugal',    'theaters')}
        ${buildSection('digital',  '💿', 'Digital & Blu-ray',      'digital' )}
      </div>

      <div class="yt-modal" id="yt-modal">
        <div class="yt-backdrop"></div>
        <div class="yt-box">
          <div class="yt-hdr">
            <span class="yt-modal-title"></span>
            <button class="yt-close" id="yt-close">✕</button>
          </div>
          <div class="yt-frame"></div>
        </div>
      </div>`;

    // ── Wire events ──────────────────────────────────────────────────
    document.getElementById('media-key-save').addEventListener('click', saveKey);
    document.getElementById('media-key-in').addEventListener('keydown', e => { if (e.key==='Enter') saveKey(); });
    document.getElementById('yt-close').addEventListener('click', closeYT);
    document.querySelector('.yt-backdrop').addEventListener('click', closeYT);
    document.addEventListener('keydown', e => { if (e.key==='Escape' && _ytActive) closeYT(); });

    view.addEventListener('change', e => {
      const inp = e.target.closest('.media-days-in');
      if (!inp) return;
      const val = Math.max(1, Math.min(180, parseInt(inp.value)||7));
      inp.value = val;
      _days[inp.dataset.key] = val;
      saveDays();
    });

    view.addEventListener('click', e => {
      const btn = e.target.closest('.media-reload');
      if (btn) RELOAD[btn.dataset.sid]?.();
    });
  }

  function saveKey() {
    const inp = document.getElementById('media-key-in');
    if (!inp) return;
    _key = inp.value.trim();
    localStorage.setItem('tmdb-api-key', _key);
    const st = document.getElementById('media-key-st');
    if (st) {
      st.textContent = _key ? '✓' : '—';
      st.className = `media-key-st ${_key ? 'st-ok' : 'st-miss'}`;
    }
    loadTrailers();
    loadTheaters();
    loadDigital();
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────
  function show() {
    build();
    if (!_loaded) {
      _loaded = true;
      Promise.all([loadTV(), loadTrailers(), loadTheaters(), loadDigital()]);
    }
  }

  return { show };
})();
