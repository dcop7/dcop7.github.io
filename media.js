const MediaPage = (function () {
  'use strict';

  const TVZ  = 'https://api.tvmaze.com';
  const CINE = 'https://v3-cinemeta.strem.io';
  const PROXY = u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;

  const MS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const GOOD_GENRES = new Set([
    'Action','Adventure','Animation','Anime','Comedy','Crime','Drama',
    'Espionage','Family','Fantasy','History','Horror','Legal',
    'Martial Arts','Medical','Mystery','Romance','Science-Fiction',
    'Supernatural','Thriller','War','Western','Automobile',
  ]);
  const BAD_GENRES = new Set([
    'Talk Show','News','Reality','Game Show','Award Show','Sports','Food','Travel','Nature','Music',
  ]);
  const BAD_TYPES = new Set([
    'Talk Show','News','Reality','Documentary','Sports','Variety',
    'Panel Show','Award Show','Game Show',
  ]);

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

  let _built  = false;
  let _loaded = false;
  let _yt     = null;
  let _view   = localStorage.getItem('md-view') || 'compact';

  const _days = {
    tv:       +(localStorage.getItem('md-tv')       || 7),
    theaters: +(localStorage.getItem('md-theaters') || 30),
    digital:  +(localStorage.getItem('md-digital')  || 7),
  };
  const _open = {
    tv:       localStorage.getItem('md-open-tv')       !== 'false',
    theaters: localStorage.getItem('md-open-theaters') !== 'false',
    digital:  localStorage.getItem('md-open-digital')  !== 'false',
  };

  const ago   = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  const esc   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const strip = h => (h||'').replace(/<[^>]+>/g,'');
  const clamp = (v,a,b) => Math.max(a, Math.min(b, +v||a));
  const T     = (key, vars) => typeof I18n !== 'undefined' ? I18n.t(key, vars) : key;

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s.length===10 ? s+'T12:00:00' : s);
    if (isNaN(d)) return '';
    const lang = typeof I18n !== 'undefined' ? I18n.getLang() : 'en';
    const msArr = lang === 'pt' ? MS_PT : MS_EN;
    return lang === 'pt'
      ? `${d.getDate()} ${msArr[d.getMonth()]} ${d.getFullYear()}`
      : `${msArr[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function abortFetch(ms) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  // ── TV ─────────────────────────────────────────────────────────────
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
      const showType = ep.show.type || '';
      if (BAD_TYPES.has(showType)) return;
      const genres = ep.show.genres || [];
      if (genres.some(g => BAD_GENRES.has(g))) return;
      if (genres.length > 0 && !genres.some(g => GOOD_GENRES.has(g))) return;
      const k = `${ep.show.id}-S${ep.season}E${ep.number}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(ep);
    });
    out.sort((a,b) => {
      const d = (b.airstamp||b.airdate||'').localeCompare(a.airstamp||a.airdate||'');
      return d || (b.show.rating?.average||0) - (a.show.rating?.average||0);
    });
    return out;
  }

  // ── TRAILERS ───────────────────────────────────────────────────────
  async function ytRSS(channelId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    // Primary: rss2json.com converts YouTube Atom feed to JSON (no CORS issues)
    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=15`;
      const r = await fetch(url, {signal: abortFetch(9000)});
      if (r.ok) {
        const data = await r.json();
        if (data.status === 'ok' && data.items?.length) {
          return data.items.map(item => {
            const vid = item.link?.split('v=')[1]?.split('&')[0] ||
                        item.guid?.split('v=')[1]?.split('&')[0] || '';
            return {
              vid,
              title:     item.title?.trim() || '',
              published: (item.pubDate || '').slice(0, 10),
              author:    item.author || data.feed?.title || '',
              thumb:     vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '',
            };
          }).filter(v => v.vid && v.title);
        }
      }
    } catch {}

    // Fallback: raw XML via CORS proxies
    const proxies = [
      `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`,
      PROXY(feedUrl),
    ];
    for (const proxyUrl of proxies) {
      try {
        const r = await fetch(proxyUrl, {signal: abortFetch(10000)});
        if (!r.ok) continue;
        const text = await r.text();
        if (!text?.includes('<entry>')) continue;
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const entries = [...doc.querySelectorAll('entry')];
        if (!entries.length) continue;
        return entries.map(e => {
          const raw = e.querySelector('id')?.textContent || '';
          const vid = raw.split(':').pop();
          return {
            vid,
            title:     e.querySelector('title')?.textContent?.trim() || '',
            published: (e.querySelector('published')?.textContent || '').slice(0, 10),
            author:    e.querySelector('author name')?.textContent?.trim() || '',
            thumb:     vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '',
          };
        }).filter(v => v.vid && v.title);
      } catch {}
    }
    return [];
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
      if (!lc.includes('trailer') && !lc.includes('teaser') && !lc.includes('official') &&
          !lc.includes('clip') && !lc.includes('featurette')) return;
      out.push(v);
    });
    out.sort((a,b) => (b.published||'').localeCompare(a.published||''));
    return out;
  }

  // ── MOVIES ─────────────────────────────────────────────────────────
  async function fetchCinemeta(skip = 0) {
    try {
      const url = `${CINE}/catalog/movie/top${skip ? `/skip=${skip}` : ''}.json`;
      const r   = await fetch(url, {signal:abortFetch(8000)});
      if (!r.ok) return [];
      const d = await r.json();
      return d.metas || [];
    } catch { return []; }
  }

  // ── CARDS ──────────────────────────────────────────────────────────
  function imdbBadge(id) {
    if (!id) return '';
    const href = `https://www.imdb.com/title/${String(id).startsWith('tt') ? id : 'tt'+id}`;
    return `<a class="mc-imdb" href="${esc(href)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">IMDb ↗</a>`;
  }

  function tvCard(ep) {
    const s   = ep.show;
    const img = s.image?.medium || s.image?.original || '';
    const net = s.network?.name || s.webChannel?.name || '';
    const rat = s.rating?.average;
    const sum = strip(s.summary||'').slice(0,100);
    const epN = `S${ep.season}E${String(ep.number||0).padStart(2,'0')}`;
    const imdb = s.externals?.imdb || '';
    return `<div class="mc" data-type="tv">
      <div class="mc-img">${img ? `<img src="${esc(img)}" alt="${esc(s.name)}" loading="lazy">` : '<div class="mc-ph">📺</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb mb-tv">${T('md.series')}</span>
          ${(s.genres||[]).slice(0,2).map(g=>`<span class="mb mb-genre">${esc(g)}</span>`).join('')}
          ${rat ? `<span class="mb mb-rat">★ ${rat}</span>` : ''}
        </div>
        <div class="mc-title">${esc(s.name)}</div>
        <div class="mc-sub">${epN}${ep.name ? ` · ${esc(ep.name)}` : ''}</div>
        <div class="mc-desc">${sum ? esc(sum)+'…' : ''}</div>
        <div class="mc-meta">
          ${net ? `<span>${esc(net)}</span>` : ''}
          ${ep.airdate ? `<span>${fmtDate(ep.airdate)}</span>` : ''}
          ${imdbBadge(imdb)}
        </div>
      </div>
    </div>`;
  }

  function trailerCard(v) {
    const lc  = v.title.toLowerCase();
    const tag = lc.includes('teaser') ? T('md.teaser') : lc.includes('trailer') ? T('md.trailer') : T('md.official');
    return `<div class="mc mc-trailer" data-yt="${esc(v.vid)}" data-title="${esc(v.title)}">
      <div class="mc-img mc-img-wide">
        <img src="${esc(v.thumb)}" alt="${esc(v.title)}" loading="lazy">
        <div class="mc-play"><svg width="26" height="26" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div>
      </div>
      <div class="mc-body">
        <div class="mc-badges"><span class="mb mb-trailer">${tag}</span></div>
        <div class="mc-title">${esc(v.title)}</div>
        <div class="mc-meta">
          ${v.author ? `<span>${esc(v.author)}</span>` : ''}
          ${v.published ? `<span>${fmtDate(v.published)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  function cinemetaCard(m, badgeKey) {
    const img   = m.poster||'';
    const title = m.name||m.title||'';
    const year  = m.releaseInfo||m.year||'';
    const rat   = m.imdbRating||'';
    const desc  = strip(m.description||'').slice(0,100);
    const imdb  = m.id?.startsWith('tt') ? m.id : '';
    const cls   = badgeKey === 'md.cinemas' ? 'mb-cinema' : 'mb-digital';
    return `<div class="mc" data-type="movie">
      <div class="mc-img">${img ? `<img src="${esc(img)}" alt="${esc(title)}" loading="lazy">` : '<div class="mc-ph">🎬</div>'}</div>
      <div class="mc-body">
        <div class="mc-badges">
          <span class="mb ${cls}">${T(badgeKey)}</span>
          ${(m.genres||[]).slice(0,2).map(g=>`<span class="mb mb-genre">${esc(g)}</span>`).join('')}
          ${rat ? `<span class="mb mb-rat">★ ${rat}</span>` : ''}
        </div>
        <div class="mc-title">${esc(title)}</div>
        ${year ? `<div class="mc-sub">${esc(String(year))}</div>` : ''}
        <div class="mc-desc">${desc ? esc(desc)+'…' : ''}</div>
        <div class="mc-meta">${imdbBadge(imdb)}</div>
      </div>
    </div>`;
  }

  // ── UI HELPERS ─────────────────────────────────────────────────────
  const mkGrid = (cards, empty) =>
    cards?.length
      ? `<div class="media-grid">${cards.join('')}</div>`
      : `<div class="media-empty">${empty || '—'}</div>`;

  const mkLoad = txt =>
    `<div class="media-loading"><div class="media-spinner"></div>${txt}</div>`;

  function setBadge(sid, n) {
    const b = document.querySelector(`[data-section="${sid}"] .md-count`);
    if (b) { b.textContent = n > 99 ? '99+' : n; b.style.opacity = n ? '1' : '0.4'; }
  }

  function getBody(sid) { return document.querySelector(`[data-section="${sid}"] .md-body`); }

  // ── LOADERS ────────────────────────────────────────────────────────
  async function loadTV() {
    const bd = getBody('tv'); if (!bd) return;
    bd.innerHTML = mkLoad(T('md.loadingEp'));
    const eps = await fetchTV(_days.tv);
    const top = eps.slice(0, 80);
    bd.innerHTML = mkGrid(top.map(tvCard), T('md.noEp', {n: _days.tv}));
    setBadge('tv', top.length);
  }

  async function loadTrailers() {
    const bd = getBody('trailers'); if (!bd) return;
    bd.innerHTML = mkLoad(T('md.loadingTr'));
    const vids = await fetchTrailers(_days.trailers);
    const top  = vids.slice(0, 30);
    bd.innerHTML = mkGrid(top.map(trailerCard), T('md.noTrailers'));
    setBadge('trailers', top.length);
    bd.querySelectorAll('.mc-trailer').forEach(c =>
      c.addEventListener('click', () => openYT(c.dataset.yt, c.dataset.title))
    );
  }

  async function loadTheaters() {
    const bd = getBody('theaters'); if (!bd) return;
    bd.innerHTML = mkLoad(T('md.loadingTh'));
    const metas  = await fetchCinemeta(0);
    const yr     = new Date().getFullYear();
    const movies = metas.filter(m => +parseInt(m.releaseInfo||m.year||0) >= yr-1).slice(0, 30);
    bd.innerHTML  = mkGrid(movies.map(m => cinemetaCard(m, 'md.cinemas')), T('md.noMovies'));
    setBadge('theaters', movies.length);
  }

  async function loadDigital() {
    const bd = getBody('digital'); if (!bd) return;
    bd.innerHTML = mkLoad(T('md.loadingDg'));
    const metas  = await fetchCinemeta(20);
    const yr     = new Date().getFullYear();
    const movies = metas.filter(m => +parseInt(m.releaseInfo||m.year||0) >= yr-1).slice(0, 30);
    bd.innerHTML  = mkGrid(movies.map(m => cinemetaCard(m, 'md.digital2')), T('md.noReleases'));
    setBadge('digital', movies.length);
  }

  const LOADERS = {tv:loadTV, theaters:loadTheaters, digital:loadDigital};

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
    page.classList.toggle('md-compact',      _view === 'compact');
    page.classList.toggle('md-comfortable',  _view === 'comfortable');
    page.classList.toggle('md-ultracompact', _view === 'ultracompact');
    page.querySelectorAll('.md-vbtn[data-view]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === _view)
    );
  }

  // ── BUILD ──────────────────────────────────────────────────────────
  function mkSection(sid, icon, labelKey, daysKey) {
    const open = _open[sid];
    return `<div class="md-section${open ? '' : ' md-collapsed'}" data-section="${sid}">
      <div class="md-section-hdr">
        <button class="md-toggle" data-sid="${sid}" aria-expanded="${open}">
          <span class="md-s-icon">${icon}</span>
          <span class="md-s-label">${T(labelKey)}</span>
          <span class="md-count">—</span>
          <svg class="md-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="md-ctrl">
          <input class="md-days-in" type="number" min="1" max="180" value="${_days[daysKey]}" data-key="${daysKey}" data-sid="${sid}" title="${T('md.last')} N ${T('md.days')}">
          <span class="md-ctrl-lbl">d</span>
          <button class="md-reload" data-sid="${sid}" title="${T('md.reload')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>
      <div class="md-body">${mkLoad(T('md.loadingEp'))}</div>
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
          ${T('md.title')}
        </h1>
        <div class="md-view-toggle">
          <button class="md-vbtn${_view==='comfortable'?' active':''}" data-view="comfortable" title="${T('md.comfortable')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            <span>${T('md.comfortable')}</span>
          </button>
          <button class="md-vbtn${_view==='compact'?' active':''}" data-view="compact" title="${T('md.compact')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
            <span>${T('md.compact')}</span>
          </button>
          <button class="md-vbtn${_view==='ultracompact'?' active':''}" data-view="ultracompact" title="${T('md.ultracompact')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            <span>${T('md.ultracompact')}</span>
          </button>
        </div>
      </div>

      <div class="md-cols">
        ${mkSection('tv',       '📺','md.tv',       'tv')}
        ${mkSection('theaters', '🍿','md.theaters',  'theaters')}
        ${mkSection('digital',  '💿','md.digital',   'digital')}
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

    view.querySelectorAll('.md-vbtn[data-view]').forEach(b =>
      b.addEventListener('click', () => {
        _view = b.dataset.view;
        localStorage.setItem('md-view', _view);
        applyView();
      })
    );

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

    document.getElementById('yt-close')?.addEventListener('click', closeYT);
    view.querySelector('.yt-backdrop')?.addEventListener('click', closeYT);
    document.addEventListener('keydown', e => { if (e.key==='Escape' && _yt) closeYT(); });

    applyView();
  }

  function show() {
    build();
    if (!_loaded) {
      _loaded = true;
      loadTV();
      loadTheaters();
      loadDigital();
    }
  }

  document.addEventListener('langchange', () => {
    _built  = false;
    _loaded = false;
    const view = document.getElementById('view-media');
    if (view) view.innerHTML = '';
    if (view?.classList.contains('active')) show();
  });

  return { show };
})();
