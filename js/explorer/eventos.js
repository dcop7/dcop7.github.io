/* ══════════════════════════════════════════════════════════════════
   EVENTOS — Descoberta de eventos em Portugal
   Multi-fonte, resiliente (uma fonte que falhe não derruba as outras):
     • AgendaLX   — agenda cultural de Lisboa (live, wp-json)
     • e-cultura  — destaques culturais nacionais (live)
     • Seed       — eventos/atrações recorrentes no repo (offline fallback)
   Mapa Leaflet de Portugal, geocodificação por concelho/cidade, filtros
   (cidade · distrito · raio · datas · categoria), distância (haversine),
   "perto de mim" (geolocalização do browser) e rail de descoberta.
   Sem chaves de API — todas as fontes são públicas. Segue o padrão de
   js/explorer/ocorrencias.js (mapa + multi-fonte + falha graciosa).
══════════════════════════════════════════════════════════════════ */
const EventosPage = (function () {
  'use strict';

  /* ── i18n ── */
  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);

  /* ── Sources ── */
  const AGENDALX_URL = 'https://www.agendalx.pt/wp-json/agendalx/v1/events?per_page=100';
  const ECULTURA_URL = 'https://www.e-cultura.pt/api';
  const SEED_URL     = 'data/events/seed.json';
  const NOCARTAZ_URL = 'data/events/nocartaz.json';
  const PLACES_URL   = 'data/events/pt-places.json';
  const TTL          = 30 * 60 * 1000;           /* 30 min cache */
  const HORIZON_DAYS = 366;                       /* how far ahead we keep events */

  const PROVIDERS = {
    agendalx: { name: 'AgendaLX', icon: '🎭', scope: () => _t('Lisbon cultural agenda', 'Agenda cultural de Lisboa'), url: 'https://www.agendalx.pt/' },
    nocartaz: { name: 'NoCartaz', icon: '🗓️', scope: () => _t('National agenda (snapshot)', 'Agenda nacional (snapshot)'), url: 'https://www.nocartaz.pt/' },
    ecultura: { name: 'e-cultura', icon: '🇵🇹', scope: () => _t('National cultural highlights', 'Destaques culturais nacionais'), url: 'https://www.e-cultura.pt/' },
    seed:     { name: _t('Curated guide', 'Guia curado'), icon: '⭐', scope: () => _t('Recurring events & landmarks (offline)', 'Eventos e marcos recorrentes (offline)'), url: null },
  };

  /* ── Categories (normalised target taxonomy) ── */
  const CATS = {
    musica:     { icon: '🎵', en: 'Music',           pt: 'Música',            color: '#8b5cf6' },
    cultura:    { icon: '🎭', en: 'Culture',         pt: 'Cultura',           color: '#ec4899' },
    gastronomia:{ icon: '🍷', en: 'Food & Drink',    pt: 'Gastronomia',       color: '#f59e0b' },
    desporto:   { icon: '⚽', en: 'Sport',           pt: 'Desporto',          color: '#22c55e' },
    familia:    { icon: '👨‍👩‍👧', en: 'Family',      pt: 'Família',           color: '#14b8a6' },
    educacao:   { icon: '📚', en: 'Education',       pt: 'Educação',          color: '#3b82f6' },
    tecnologia: { icon: '💻', en: 'Technology',      pt: 'Tecnologia',        color: '#06b6d4' },
    feiras:     { icon: '🛍️', en: 'Fairs & Markets', pt: 'Feiras e Mercados', color: '#a16207' },
    exposicoes: { icon: '🖼️', en: 'Exhibitions',     pt: 'Exposições',        color: '#d946ef' },
    outros:     { icon: '✨', en: 'Other',           pt: 'Outros',            color: '#64748b' },
  };
  const catLabel = (k) => _t((CATS[k] || CATS.outros).en, (CATS[k] || CATS.outros).pt);
  const catIcon  = (k) => (CATS[k] || CATS.outros).icon;
  const catColor = (k) => (CATS[k] || CATS.outros).color;

  /* Map a free-text label (PT/EN, slug or numeric) → category key. */
  const CAT_KW = [
    ['musica',      /m[uú]sic|concert|recital|jazz|fado|rock|dj|band|sinfon|orquestr|coro|festival de m/i],
    ['gastronomia', /gastronom|food|wine|vinh|petisc|sabores|degusta|cozinh|marisc|cervej|prova/i],
    ['desporto',    /desport|sport|corrida|maratona|futebol|ciclis|trail|caminhada|t[oó]rneio|race/i],
    ['familia',     /fam[ií]li|crian|infantil|kids|family|ocean[aá]rio|zoo|parque tem|pequenitos/i],
    ['educacao',    /educa|workshop|formaç|confer[eê]ncia|palestra|semin[aá]rio|aula|curso|ci[eê]ncia viva|conhecimento/i],
    ['tecnologia',  /tecnolog|technolog|digital|startup|inova|robot|gaming|web summit|hackathon|\bIA\b|\bAI\b/i],
    ['feiras',      /feira|mercad|market|fair|bazar|artesanat|velharia|antiguidad/i],
    ['exposicoes',  /exposi[cç]|exhibit|mostra|museu|museum|galeria|pintura|escultura|fotografia/i],
    ['cultura',     /cultur|teatro|theatre|dan[cç]|cinema|cine|patrim[oó]ni|hist[oó]ri|visita|palaci|castelo|mosteiro|igreja|literat|po[eé]si|dance/i],
  ];
  function classify(...texts) {
    const s = texts.filter(Boolean).join(' ');
    for (const [key, re] of CAT_KW) if (re.test(s)) return key;
    return 'outros';
  }

  /* ── Districts (Portuguese names) + centroids (fallback geocoding) ── */
  const DISTRICT_CENTROIDS = {
    'Aveiro': [40.64, -8.65], 'Beja': [37.96, -7.87], 'Braga': [41.55, -8.42],
    'Bragança': [40.67, -7.50], 'Castelo Branco': [39.83, -7.49], 'Coimbra': [40.21, -8.43],
    'Évora': [38.57, -7.91], 'Faro': [37.01, -7.93], 'Guarda': [40.53, -7.27],
    'Leiria': [39.74, -8.81], 'Lisboa': [38.72, -9.14], 'Porto': [41.16, -8.62],
    'Portalegre': [39.30, -8.57], 'Setúbal': [38.52, -8.89], 'Santarém': [39.23, -8.69],
    'Viana do Castelo': [41.69, -8.83], 'Viseu': [40.66, -7.91], 'Vila Real': [41.30, -7.74],
    'Madeira': [32.75, -17.00], 'Açores': [37.74, -25.67],
  };
  const DISTRICTS = Object.keys(DISTRICT_CENTROIDS);

  /* ── State ── */
  let _inited      = false;
  let _map         = null;
  let _markerLayer = null;
  let _districtLayer = null;
  let _events      = [];          /* aggregated, normalised, geocoded */
  let _filtered    = [];
  let _places      = null;        /* pt-places.json */
  let _prov        = { agendalx: { ok: null }, nocartaz: { ok: null }, ecultura: { ok: null }, seed: { ok: null } };
  let _userPt      = null;        /* {lat,lon,label} active reference point */
  let _gps         = null;        /* geolocation result */
  let _themeObs    = null;
  let _detail      = null;        /* currently open event */
  let _loading     = false;

  /* Filter state */
  const _f = {
    district: '',                 /* '' = all */
    city: 'Leiria',
    radius: 0,                    /* km; 0 = no limit (national) */
    range: '7d',                  /* today | weekend | 7d | 30d | all */
    cats: new Set(),              /* empty = all */
    freeOnly: false,
    showPermanent: false,         /* hide "always open" landmarks by default */
    query: '',
  };

  /* ════════════════════════════ HELPERS ════════════════════════════ */

  function _fetch(url, ms = 12000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' }).finally(() => clearTimeout(tid));
  }
  function _fromCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > TTL) return null;
      return data;
    } catch { return null; }
  }
  function _toCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  const norm = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  const esc = (s) => (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* e-cultura double-encodes HTML entities (e.g. &amp;aacute;). Decode twice, strip tags. */
  let _decoder = null;
  function decodeText(s) {
    if (!s) return '';
    if (!_decoder) _decoder = document.createElement('textarea');
    _decoder.innerHTML = s;
    let out = _decoder.value;
    _decoder.innerHTML = out;
    out = _decoder.value;
    return out.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function haversine(a, b, c, d) {
    const R = 6371, toR = (x) => x * Math.PI / 180;
    const dLat = toR(c - a), dLon = toR(d - b);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* Deterministic tiny jitter (±~0.02°) so events in the same place don't fully stack. */
  function jitter(seed) {
    let h = 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const f = (n) => ((Math.abs(h >> n) % 1000) / 1000 - 0.5) * 0.04;
    return [f(3), f(11)];
  }

  function geocode(concelho, district, seed) {
    let base = null;
    if (concelho && _places && _places[norm(concelho)]) base = _places[norm(concelho)];
    else if (district && _places && _places[norm(district)]) base = _places[norm(district)];
    else if (district && DISTRICT_CENTROIDS[district]) base = DISTRICT_CENTROIDS[district];
    if (!base) return null;
    const [jx, jy] = jitter(seed || concelho || district);
    return [base[0] + jx, base[1] + jy];
  }

  /* ── Date helpers ── */
  const DAY = 86400000;
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay   = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    const str = String(s).trim().replace(' ', 'T');
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }
  function dateWindow(range) {
    const now = new Date();
    const from = startOfDay(now);
    if (range === 'today') return { from, to: endOfDay(now) };
    if (range === 'weekend') {
      const dow = now.getDay();                 /* 0 Sun .. 6 Sat */
      const toSat = (6 - dow + 7) % 7;          /* days until Saturday */
      const sat = startOfDay(new Date(now.getTime() + (dow === 0 ? -1 : toSat) * DAY));
      const sun = endOfDay(new Date(sat.getTime() + DAY));
      return { from: dow === 0 ? from : sat, to: sun };
    }
    if (range === '30d') return { from, to: endOfDay(new Date(now.getTime() + 30 * DAY)) };
    if (range === 'all') return { from, to: endOfDay(new Date(now.getTime() + HORIZON_DAYS * DAY)) };
    return { from, to: endOfDay(new Date(now.getTime() + 7 * DAY)) }; /* 7d default */
  }
  /* Does an event's [start,end] interval intersect [from,to]? */
  function inWindow(ev, win) {
    const s = ev.start ? ev.start.getTime() : win.from.getTime();
    const e = ev.end ? ev.end.getTime() : s;
    return e >= win.from.getTime() && s <= win.to.getTime();
  }
  function fmtDate(d) {
    if (!d) return '';
    return d.toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' });
  }
  function fmtWhen(ev) {
    if (ev.permanent) return ev.hours ? ev.hours : _t('Always open', 'Sempre aberto');
    const s = ev.start, e = ev.end;
    if (!s) return '';
    const sameDay = e && startOfDay(s).getTime() === startOfDay(e).getTime();
    let out = fmtDate(s);
    if (e && !sameDay && e.getTime() - s.getTime() < 320 * DAY) out += ' – ' + fmtDate(e);
    else if (e && !sameDay) out = _t('Ongoing', 'A decorrer');
    if (ev.time) out += ' · ' + ev.time;
    return out;
  }

  /* ════════════════════════════ ADAPTERS ════════════════════════════ */
  /* Each returns a Promise<Array<normalisedEvent>>; failures are isolated. */

  async function srcAgendaLX() {
    const ckey = 'ev-agendalx';
    let raw = _fromCache(ckey);
    if (!raw) {
      const r = await _fetch(AGENDALX_URL);
      if (!r.ok) throw new Error('agendalx ' + r.status);
      raw = await r.json();
      _toCache(ckey, raw);
    }
    const out = [];
    for (const e of (raw || [])) {
      const occ = Array.isArray(e.occurences) ? e.occurences.filter(Boolean).sort() : [];
      const start = parseDate(occ[0] || e.StartDate);
      const end = parseDate(occ[occ.length - 1] || e.LastDate || occ[0] || e.StartDate);
      const venueObj = e.venue && typeof e.venue === 'object' ? Object.values(e.venue)[0] : null;
      const venue = venueObj ? venueObj.name : '';
      const catSlug = e.categories_name_list && typeof e.categories_name_list === 'object'
        ? Object.values(e.categories_name_list).map(c => c.name).join(' ') : '';
      out.push(normalise({
        id: 'alx-' + e.id,
        source: 'agendalx',
        title: decodeText(e.title && e.title.rendered ? e.title.rendered : e.title),
        lead: decodeText(e.subtitle || e.subject || ''),
        desc: decodeText(Array.isArray(e.description) ? e.description[0] : e.description),
        start, end,
        time: e.string_times || '',
        category: classify(catSlug, e.subject, e.title && e.title.rendered),
        venue, district: 'Lisboa', concelho: 'Lisboa',
        image: e.featured_media_large || '',
        url: e.link || 'https://www.agendalx.pt/',
        free: /gratuit|livre|free/i.test(e.price_cat || '') || e.price_val === '0',
        price: e.price_val && e.price_val !== '0' ? e.price_val + ' €' : '',
      }));
    }
    return out;
  }

  async function srcECultura() {
    const ckey = 'ev-ecultura';
    let raw = _fromCache(ckey);
    if (!raw) {
      const r = await _fetch(ECULTURA_URL);
      if (!r.ok) throw new Error('ecultura ' + r.status);
      raw = await r.json();
      _toCache(ckey, raw);
    }
    const out = [];
    for (const e of (raw || [])) {
      const start = parseDate(e.date_start);
      const end = parseDate(e.date_end) || start;
      const title = decodeText(e.title);
      const lead = decodeText(e.lead);
      /* e-cultura serves media cross-origin without CORS → browsers block it
         (ERR_BLOCKED_BY_ORB). Skip the image and use the category placeholder. */
      const img = '';
      out.push(normalise({
        id: 'ec-' + e.id,
        source: 'ecultura',
        title,
        lead,
        desc: decodeText(e.text),
        start, end,
        time: e.schedule ? decodeText(e.schedule) : '',
        category: classify(title, lead, e.text),
        venue: decodeText(e.location_title),
        district: (e.location_distrito || '').trim() || '',
        concelho: (e.location_concelho || '').trim() || '',
        address: decodeText(e.location_address),
        image: img,
        url: 'https://www.e-cultura.pt/agenda',
        free: e.free === '1' || e.price === '0.00',
        price: e.price && e.price !== '0.00' ? parseFloat(e.price).toFixed(0) + ' €' : '',
      }));
    }
    return out;
  }

  async function srcSeed() {
    const r = await _fetch(SEED_URL);
    if (!r.ok) throw new Error('seed ' + r.status);
    const data = await r.json();
    const now = new Date();
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * DAY);
    const out = [];
    for (const e of (data.events || [])) {
      const occ = expandRecurring(e.recurring, now, horizonEnd);
      for (let i = 0; i < occ.length; i++) {
        const o = occ[i];
        out.push(normalise({
          id: e.id + (occ.length > 1 ? '-' + i : ''),
          source: 'seed',
          title: e.title, lead: e.lead || '', desc: e.lead || '',
          start: o.start, end: o.end, permanent: o.permanent,
          time: '', hours: e.hours || '',
          category: norm(e.category) ? labelToKey(e.category) : classify(e.title, e.lead),
          venue: e.venue || '', district: e.district || '', concelho: e.concelho || '',
          image: e.image || '',
          url: e.url || '',
          free: !!e.free, price: e.price || '',
        }));
      }
    }
    return out;
  }

  async function srcNoCartaz() {
    const r = await _fetch(NOCARTAZ_URL);
    if (!r.ok) throw new Error('nocartaz ' + r.status);
    const data = await r.json();
    const out = [];
    for (const e of (data.events || [])) {
      const start = parseDate(e.start);
      out.push(normalise({
        id: e.id, source: 'nocartaz',
        title: e.title, lead: e.desc || '', desc: e.desc || '',
        start, end: start,
        category: classify(e.title, e.desc),
        venue: '', district: e.district || '', concelho: '',
        image: e.image || '',
        url: e.url || 'https://www.nocartaz.pt/',
        free: !!e.free, price: e.price || '',
      }));
    }
    return out;
  }

  /* PT/EN category label → key (for seed, which uses display labels). */
  function labelToKey(label) {
    const n = norm(label);
    for (const k in CATS) if (norm(CATS[k].pt) === n || norm(CATS[k].en) === n || k === n) return k;
    return classify(label);
  }

  /* Turn a recurring rule into concrete occurrences within [now, horizon]. */
  function expandRecurring(rule, now, horizon) {
    if (!rule || rule.type === 'permanent') {
      return [{ start: startOfDay(now), end: new Date(now.getTime() + HORIZON_DAYS * DAY), permanent: true }];
    }
    const out = [];
    if (rule.type === 'weekly') {
      const wd = rule.weekday;
      let d = startOfDay(now);
      d = new Date(d.getTime() + ((wd - d.getDay() + 7) % 7) * DAY);
      for (let i = 0; i < 10 && d <= horizon; i++) {
        out.push({ start: new Date(d), end: endOfDay(d) });
        d = new Date(d.getTime() + 7 * DAY);
      }
    } else if (rule.type === 'annual') {
      const m = (rule.month || 1) - 1, day = rule.day || 1;
      let y = now.getFullYear();
      let dt = new Date(y, m, day);
      if (endOfDay(dt) < startOfDay(now)) dt = new Date(y + 1, m, day);
      out.push({ start: startOfDay(dt), end: endOfDay(dt) });
    }
    return out.length ? out : [{ start: startOfDay(now), end: new Date(now.getTime() + HORIZON_DAYS * DAY), permanent: true }];
  }

  /* Normalise + geocode a raw event. */
  function normalise(e) {
    const coord = (typeof e.lat === 'number') ? [e.lat, e.lon] : geocode(e.concelho, e.district, e.id);
    return {
      id: e.id, source: e.source,
      title: e.title || '(sem título)',
      lead: e.lead || '', desc: e.desc || e.lead || '',
      start: e.start || null, end: e.end || e.start || null, permanent: !!e.permanent,
      time: e.time || '', hours: e.hours || '',
      category: e.category || 'outros',
      venue: e.venue || '', district: e.district || '', concelho: e.concelho || '',
      address: e.address || '',
      lat: coord ? coord[0] : null, lon: coord ? coord[1] : null,
      image: e.image || '',
      url: e.url || '',
      free: !!e.free, price: e.price || '',
      _added: e.source === 'seed' ? 2 : (e.source === 'agendalx' ? 1 : 0),
    };
  }

  /* ════════════════════════════ AGGREGATE ════════════════════════════ */

  async function ensurePlaces() {
    if (_places) return;
    try {
      const r = await _fetch(PLACES_URL);
      _places = r.ok ? await r.json() : {};
    } catch { _places = {}; }
  }

  async function aggregate() {
    await ensurePlaces();
    const tasks = [
      ['agendalx', srcAgendaLX],
      ['nocartaz', srcNoCartaz],
      ['ecultura', srcECultura],
      ['seed', srcSeed],
    ];
    const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
    let all = [];
    results.forEach((res, i) => {
      const key = tasks[i][0];
      if (res.status === 'fulfilled') { _prov[key] = { ok: true, n: res.value.length }; all = all.concat(res.value); }
      else { _prov[key] = { ok: false, err: String(res.reason).slice(0, 80) }; }
    });
    /* Dedupe by title+day+concelho. */
    const seen = new Set();
    const dedup = [];
    for (const e of all) {
      const k = norm(e.title) + '|' + (e.start ? startOfDay(e.start).getTime() : 0) + '|' + norm(e.concelho || e.district);
      if (seen.has(k)) continue;
      seen.add(k); dedup.push(e);
    }
    /* Keep all events (those without coordinates still list, just no map pin),
       sort by start date. */
    _events = dedup
      .sort((a, b) => (a.start ? a.start.getTime() : Infinity) - (b.start ? b.start.getTime() : Infinity));
    return _events;
  }

  /* ════════════════════════════ FILTERING ════════════════════════════ */

  function activePoint() {
    if (_gps) return { lat: _gps.lat, lon: _gps.lon, label: _t('your location', 'a tua localização') };
    const key = norm(_f.city);
    if (_places && _places[key]) return { lat: _places[key][0], lon: _places[key][1], label: _f.city };
    if (_f.district && DISTRICT_CENTROIDS[_f.district]) return { lat: DISTRICT_CENTROIDS[_f.district][0], lon: DISTRICT_CENTROIDS[_f.district][1], label: _f.district };
    return { lat: 39.744, lon: -8.807, label: 'Leiria' };
  }

  function withDistance(list) {
    const p = activePoint();
    return list.map(e => ({ ...e, dist: (e.lat != null) ? haversine(p.lat, p.lon, e.lat, e.lon) : null }));
  }

  function applyFilters() {
    const win = dateWindow(_f.range);
    const q = norm(_f.query);
    let list = _events.filter(e => {
      if (!_f.showPermanent && e.permanent) return false;
      if (_f.district && norm(e.district) !== norm(_f.district)) return false;
      if (_f.cats.size && !_f.cats.has(e.category)) return false;
      if (_f.freeOnly && !e.free) return false;
      if (!inWindow(e, win)) return false;
      if (q && !(norm(e.title).includes(q) || norm(e.venue).includes(q) || norm(e.concelho).includes(q) || norm(e.lead).includes(q))) return false;
      return true;
    });
    list = withDistance(list);
    if (_f.radius > 0) list = list.filter(e => e.dist == null || e.dist <= _f.radius);
    /* sort: distance when a radius/city focus matters, else date. */
    list.sort((a, b) => {
      if (_f.radius > 0 || _gps) return (a.dist ?? 9e9) - (b.dist ?? 9e9);
      return (a.start ? a.start.getTime() : 9e15) - (b.start ? b.start.getTime() : 9e15);
    });
    _filtered = list;
    return list;
  }

  /* ════════════════════════════ DISCOVERY ════════════════════════════ */
  /* Location-aware, date-relaxed rails so users discover even without filters. */
  function discovery() {
    const pool = _f.showPermanent ? _events : _events.filter(e => !e.permanent);
    const here = withDistance(pool);
    const future = here.filter(e => !e.start || e.end == null || e.end.getTime() >= Date.now());
    const hasImg = (e) => e.image && /^https?:/.test(e.image);

    const destaques = future.filter(e => hasImg(e) && (e.source !== 'seed' || e.permanent))
      .sort((a, b) => (a.dist ?? 9e9) - (b.dist ?? 9e9)).slice(0, 12);

    const perto = future.filter(e => e.dist != null)
      .sort((a, b) => a.dist - b.dist).slice(0, 12);

    const recentes = [...future].sort((a, b) =>
      (a.start ? a.start.getTime() : 9e15) - (b.start ? b.start.getTime() : 9e15)).slice(0, 12);

    /* "Populares": multi-day runs / landmarks / has image, near user. */
    const populares = future.filter(e => hasImg(e) || e.permanent || (e.end && e.start && e.end - e.start > 2 * DAY))
      .sort((a, b) => (a.dist ?? 9e9) - (b.dist ?? 9e9)).slice(0, 12);

    /* Suggestions by the user's active category filter (or a varied mix). */
    let sugestoes;
    if (_f.cats.size) sugestoes = future.filter(e => _f.cats.has(e.category)).sort((a, b) => (a.dist ?? 9e9) - (b.dist ?? 9e9)).slice(0, 12);
    else {
      const byCat = {}; sugestoes = [];
      for (const e of perto.concat(future)) { if (sugestoes.length >= 12) break; if ((byCat[e.category] = (byCat[e.category] || 0) + 1) <= 2) sugestoes.push(e); }
    }
    return { destaques, populares, recentes, perto, sugestoes };
  }

  /* ════════════════════════════ LEAFLET ════════════════════════════ */

  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        document.head.appendChild(Object.assign(document.createElement('link'), {
          rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
        }));
      }
      const s = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const _isDark = () => !document.body.classList.contains('light');

  function _initMap() {
    const el = document.getElementById('ev-map');
    if (!el || _map) return;
    _map = L.map(el, { center: [39.6, -8.0], zoom: 7, zoomControl: true, scrollWheelZoom: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(_map);
    _markerLayer = L.layerGroup().addTo(_map);
    _loadDistricts();
    _watchTheme();
  }

  async function _loadDistricts() {
    if (_districtLayer || !_map) return;
    try {
      const r = await _fetch('data/pt-districts.geojson');
      if (!r.ok) return;
      const geo = await r.json();
      _districtLayer = L.geoJSON(geo, {
        style: () => ({ color: _isDark() ? 'rgba(148,163,184,.35)' : 'rgba(71,85,105,.35)', weight: 1, fill: false }),
        interactive: false,
      }).addTo(_map);
      _districtLayer.bringToBack();
    } catch {}
  }
  function _watchTheme() {
    if (_themeObs) return;
    _themeObs = new MutationObserver(() => {
      if (_districtLayer) _districtLayer.setStyle({ color: _isDark() ? 'rgba(148,163,184,.35)' : 'rgba(71,85,105,.35)' });
    });
    _themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function renderMarkers(list) {
    if (!_markerLayer) return;
    _markerLayer.clearLayers();
    const bounds = [];
    for (const e of list) {
      if (e.lat == null) continue;
      const m = L.circleMarker([e.lat, e.lon], {
        radius: 6, color: '#fff', weight: 1.2, fillColor: catColor(e.category), fillOpacity: 0.92,
      });
      m.on('click', () => openDetail(e));
      m.bindTooltip(`${catIcon(e.category)} ${esc(e.title)}`, { direction: 'top' });
      m.addTo(_markerLayer);
      bounds.push([e.lat, e.lon]);
    }
    /* Add the active reference point. */
    const p = activePoint();
    L.circleMarker([p.lat, p.lon], { radius: 7, color: '#2563eb', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.5, className: 'ev-here' })
      .bindTooltip('📍 ' + esc(p.label), { direction: 'top' }).addTo(_markerLayer);
    if (bounds.length && !_detail) {
      try { _map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 }); } catch {}
    }
  }

  /* ════════════════════════════ RENDER ════════════════════════════ */

  function _buildShell(view) {
    const ranges = [
      ['today', _t('Today', 'Hoje')], ['weekend', _t('This weekend', 'Este fim de semana')],
      ['7d', _t('Next 7 days', 'Próximos 7 dias')], ['30d', _t('Next 30 days', 'Próximos 30 dias')],
      ['all', _t('All', 'Tudo')],
    ];
    const radii = [['0', _t('Nationwide', 'Todo o país')], ['10', '10 km'], ['25', '25 km'], ['50', '50 km'], ['100', '100 km'], ['200', '200 km']];
    view.innerHTML = `
      <div class="ev-wrap">
        <header class="ev-head">
          <div class="ev-head-main">
            <h1>📅 ${_t('Events in Portugal', 'Eventos em Portugal')}</h1>
            <p class="ev-sub">${_t('Discover events near you — concerts, culture, food, fairs and more.', 'Descobre o que se passa perto de ti — concertos, cultura, gastronomia, feiras e mais.')}</p>
          </div>
          <button class="ev-gps-btn" id="ev-gps" type="button">📍 ${_t('Near me', 'Perto de mim')}</button>
        </header>

        <div class="ev-filters" id="ev-filters">
          <label class="ev-fld"><span>${_t('District', 'Distrito')}</span>
            <select id="ev-district"><option value="">${_t('All districts', 'Todos os distritos')}</option>
              ${DISTRICTS.map(d => `<option value="${d}"${d === '' ? '' : ''}>${d}</option>`).join('')}
            </select></label>
          <label class="ev-fld"><span>${_t('City', 'Cidade')}</span>
            <input id="ev-city" type="text" list="ev-city-list" value="${esc(_f.city)}" placeholder="Leiria"/>
            <datalist id="ev-city-list"></datalist></label>
          <label class="ev-fld"><span>${_t('Radius', 'Raio')}</span>
            <select id="ev-radius">${radii.map(([v, l]) => `<option value="${v}"${v === String(_f.radius) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="ev-fld ev-fld-grow"><span>${_t('When', 'Quando')}</span>
            <div class="ev-chips" id="ev-range">${ranges.map(([v, l]) => `<button type="button" class="ev-chip${v === _f.range ? ' active' : ''}" data-range="${v}">${l}</button>`).join('')}</div>
          </label>
          <label class="ev-fld ev-fld-grow"><span>${_t('Search', 'Pesquisar')}</span>
            <input id="ev-q" type="search" placeholder="${_t('event, venue…', 'evento, local…')}"/></label>
        </div>

        <div class="ev-cats" id="ev-cats">
          ${Object.keys(CATS).map(k => `<button type="button" class="ev-cat" data-cat="${k}" style="--cc:${CATS[k].color}">${CATS[k].icon} ${catLabel(k)}</button>`).join('')}
          <button type="button" class="ev-cat ev-cat-free" id="ev-free">💶 ${_t('Free', 'Grátis')}</button>
          <button type="button" class="ev-cat ev-cat-perm" id="ev-perm" title="${_t('Museums, monuments and other always-open places', 'Museus, monumentos e outros locais sempre abertos')}">🏛️ ${_t('Always-open', 'Sempre abertos')}</button>
        </div>

        <div class="ev-body">
          <div class="ev-toolbar">
            <div class="ev-count" id="ev-count"></div>
            <div class="ev-vt" id="ev-vt">
              <button type="button" class="ev-vt-btn active" data-view="list">📋 ${_t('List', 'Lista')}</button>
              <button type="button" class="ev-vt-btn" data-view="map">🗺️ ${_t('Map', 'Mapa')}</button>
            </div>
          </div>
          <div class="ev-split ev-show-list">
            <div class="ev-list-col">
              <section class="ev-discovery" id="ev-discovery" hidden></section>
              <div class="ev-list" id="ev-list"></div>
            </div>
            <div class="ev-map-wrap"><div id="ev-map"></div></div>
          </div>
        </div>

        <footer class="ev-sources" id="ev-sources"></footer>
      </div>`;
  }

  function eventCard(e, compact) {
    const dist = e.dist != null ? `<span class="ev-c-dist">📍 ${e.dist < 1 ? '<1' : Math.round(e.dist)} km</span>` : '';
    const img = (e.image && /^https?:/.test(e.image))
      ? `<div class="ev-c-img" style="background-image:url('${esc(e.image)}')"></div>`
      : `<div class="ev-c-img ev-c-img-ph" style="--cc:${catColor(e.category)}">${catIcon(e.category)}</div>`;
    const where = esc(e.venue || e.concelho || e.district || 'Portugal');
    const price = e.free ? `<span class="ev-c-free">${_t('Free', 'Grátis')}</span>` : (e.price ? `<span class="ev-c-price">${esc(e.price)}</span>` : '');
    return `<article class="ev-card${compact ? ' ev-card-c' : ''}" data-id="${esc(e.id)}" tabindex="0">
      ${img}
      <div class="ev-c-body">
        <div class="ev-c-cat" style="--cc:${catColor(e.category)}">${catIcon(e.category)} ${catLabel(e.category)}</div>
        <h3 class="ev-c-title">${esc(e.title)}</h3>
        <div class="ev-c-meta"><span class="ev-c-when">🗓️ ${esc(fmtWhen(e))}</span></div>
        <div class="ev-c-meta"><span class="ev-c-where">📌 ${where}</span> ${dist}</div>
        ${compact ? '' : `<p class="ev-c-lead">${esc((e.lead || '').slice(0, 120))}${(e.lead || '').length > 120 ? '…' : ''}</p>`}
        <div class="ev-c-foot">${price}<span class="ev-c-src">${(PROVIDERS[e.source] || {}).icon || ''}</span></div>
      </div>
    </article>`;
  }

  function renderDiscovery() {
    const box = document.getElementById('ev-discovery');
    if (!box) return;
    /* Only show the discovery rails in the "broad" state (no narrowing search/filters). */
    const broad = !_f.query && !_f.district && _f.cats.size === 0;
    if (!broad) { box.hidden = true; box.innerHTML = ''; return; }
    const d = discovery();
    const rails = [
      ['⭐ ' + _t('Featured', 'Destaques'), d.destaques],
      ['📍 ' + _t('Near you', 'Perto de ti'), d.perto],
      ['🔥 ' + _t('Popular', 'Populares'), d.populares],
      ['🆕 ' + _t('Coming up', 'A chegar'), d.recentes],
      ['💡 ' + _t('Suggestions', 'Sugestões'), d.sugestoes],
    ].filter(([, l]) => l && l.length);
    if (!rails.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = rails.map(([title, list]) => `
      <div class="ev-rail">
        <h2 class="ev-rail-h">${title}</h2>
        <div class="ev-rail-track">${list.map(e => eventCard(e, true)).join('')}</div>
      </div>`).join('');
  }

  function skeletonHTML(n = 8) {
    const card = `<div class="ev-skel"><div class="ev-skel-img"></div><div class="ev-skel-body"><span class="ev-skel-ln ev-skel-ln-sm"></span><span class="ev-skel-ln"></span><span class="ev-skel-ln ev-skel-ln-md"></span></div></div>`;
    return `<div class="ev-loading-bar"><span class="ev-spinner"></span> ${_t('Searching events near you…', 'À procura de eventos perto de ti…')}</div>`
      + Array.from({ length: n }, () => card).join('');
  }

  function renderList() {
    const list = applyFilters();
    const wrap = document.getElementById('ev-list');
    const count = document.getElementById('ev-count');
    if (count) count.textContent = list.length
      ? `${list.length} ${list.length === 1 ? _t('event', 'evento') : _t('events', 'eventos')}`
      : '';
    if (wrap) {
      wrap.innerHTML = list.length
        ? list.slice(0, 200).map(e => eventCard(e)).join('')
        : `<div class="ev-empty">😕 ${_t('No events match these filters. Try a wider date range or radius.', 'Nenhum evento corresponde a estes filtros. Experimenta um intervalo de datas ou raio maior.')}</div>`;
    }
    renderMarkers(list);
    renderDiscovery();
    renderSources();
  }

  function renderSources() {
    const box = document.getElementById('ev-sources');
    if (!box) return;
    const items = Object.keys(PROVIDERS).map(k => {
      const p = PROVIDERS[k], st = _prov[k] || {};
      const dot = st.ok === true ? 'ok' : (st.ok === false ? 'err' : 'idle');
      const n = st.ok === true && st.n != null ? ` · ${st.n}` : '';
      const name = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name);
      return `<span class="ev-src-item"><span class="ev-src-dot ev-src-${dot}"></span>${p.icon} ${name}<small>${esc(p.scope())}${n}</small></span>`;
    }).join('');
    box.innerHTML = `<div class="ev-src-line">${_t('Sources', 'Fontes')}: ${items}</div>
      <div class="ev-src-note">${_t('Data fetched live; falls back to a curated offline guide if a source is unavailable.', 'Dados obtidos em direto; recorre a um guia curado offline se uma fonte estiver indisponível.')}</div>`;
  }

  function openDetail(e) {
    _detail = e;
    let panel = document.getElementById('ev-detail');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ev-detail';
      panel.className = 'ev-detail';
      document.getElementById('view-eventos').appendChild(panel);
    }
    const img = (e.image && /^https?:/.test(e.image))
      ? `<div class="ev-d-img" style="background-image:url('${esc(e.image)}')"></div>`
      : `<div class="ev-d-img ev-d-img-ph" style="--cc:${catColor(e.category)}">${catIcon(e.category)}</div>`;
    const rows = [
      ['🗓️', e.permanent ? _t('Always open', 'Sempre aberto') : fmtWhen(e)],
      e.hours ? ['🕒', e.hours] : null,
      ['📌', [e.venue, e.concelho, e.district].filter(Boolean).join(' · ')],
      e.address ? ['🏠', e.address] : null,
      e.dist != null ? ['📍', `${e.dist < 1 ? '<1' : Math.round(e.dist)} km ${_t('away', 'de distância')}`] : null,
      [catIcon(e.category), catLabel(e.category)],
      [e.free ? '💶' : (e.price ? '🎟️' : ''), e.free ? _t('Free admission', 'Entrada livre') : e.price],
    ].filter(r => r && r[1]);
    panel.innerHTML = `
      <div class="ev-d-card" role="dialog" aria-modal="true">
        <button class="ev-d-close" id="ev-d-close" aria-label="${_t('Close', 'Fechar')}">✕</button>
        ${img}
        <div class="ev-d-body">
          <div class="ev-c-cat" style="--cc:${catColor(e.category)}">${catIcon(e.category)} ${catLabel(e.category)}</div>
          <h2 class="ev-d-title">${esc(e.title)}</h2>
          ${e.lead ? `<p class="ev-d-lead">${esc(e.lead)}</p>` : ''}
          <ul class="ev-d-rows">${rows.map(([i, v]) => `<li><span>${i}</span> ${esc(v)}</li>`).join('')}</ul>
          ${e.desc && e.desc !== e.lead ? `<p class="ev-d-desc">${esc(e.desc.slice(0, 420))}${e.desc.length > 420 ? '…' : ''}</p>` : ''}
          <div class="ev-d-actions">
            ${e.url ? `<a class="ev-d-link" href="${esc(e.url)}" target="_blank" rel="noopener">${_t('Official page', 'Página oficial')} ↗</a>` : ''}
            ${e.lat != null ? `<button class="ev-d-map" id="ev-d-map">${_t('Show on map', 'Ver no mapa')}</button>` : ''}
          </div>
          <div class="ev-d-src">${_t('Source', 'Fonte')}: ${(PROVIDERS[e.source] || {}).icon || ''} ${esc((PROVIDERS[e.source] || {}).name || e.source)}</div>
        </div>
      </div>`;
    panel.classList.add('open');
    panel.onclick = (ev) => { if (ev.target === panel) closeDetail(); };
    document.getElementById('ev-d-close').onclick = closeDetail;
    const mb = document.getElementById('ev-d-map');
    if (mb) mb.onclick = () => { closeDetail(); _setMobileView('map'); try { _map.setView([e.lat, e.lon], 13, { animate: true }); } catch {} };
  }
  function closeDetail() {
    _detail = null;
    const p = document.getElementById('ev-detail');
    if (p) { p.classList.remove('open'); p.innerHTML = ''; }
  }

  /* ════════════════════════════ WIRING ════════════════════════════ */

  function _wire(view) {
    view.querySelector('#ev-district').addEventListener('change', (e) => { _f.district = e.target.value; renderList(); });
    const cityIn = view.querySelector('#ev-city');
    cityIn.addEventListener('change', (e) => { _f.city = e.target.value.trim() || 'Leiria'; _gps = null; renderList(); });
    view.querySelector('#ev-radius').addEventListener('change', (e) => { _f.radius = parseInt(e.target.value, 10) || 0; renderList(); });
    let qt;
    view.querySelector('#ev-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { _f.query = e.target.value; renderList(); }, 200); });
    view.querySelector('#ev-range').addEventListener('click', (e) => {
      const b = e.target.closest('.ev-chip'); if (!b) return;
      _f.range = b.dataset.range;
      view.querySelectorAll('#ev-range .ev-chip').forEach(x => x.classList.toggle('active', x === b));
      renderList();
    });
    view.querySelector('#ev-cats').addEventListener('click', (e) => {
      const b = e.target.closest('.ev-cat'); if (!b) return;
      if (b.id === 'ev-free') { _f.freeOnly = !_f.freeOnly; b.classList.toggle('active', _f.freeOnly); renderList(); return; }
      if (b.id === 'ev-perm') { _f.showPermanent = !_f.showPermanent; b.classList.toggle('active', _f.showPermanent); renderList(); return; }
      const k = b.dataset.cat;
      if (_f.cats.has(k)) _f.cats.delete(k); else _f.cats.add(k);
      b.classList.toggle('active', _f.cats.has(k));
      renderList();
    });
    view.querySelector('#ev-vt').addEventListener('click', (e) => {
      const b = e.target.closest('.ev-vt-btn'); if (!b) return;
      _setMobileView(b.dataset.view);
    });
    view.querySelector('#ev-list').addEventListener('click', (e) => {
      const c = e.target.closest('.ev-card'); if (!c) return;
      const ev = _findEvent(c.dataset.id); if (ev) openDetail(ev);
    });
    view.querySelector('#ev-list').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const c = e.target.closest('.ev-card'); if (!c) return;
      const ev = _findEvent(c.dataset.id); if (ev) openDetail(ev);
    });
    view.querySelector('#ev-discovery').addEventListener('click', (e) => {
      const c = e.target.closest('.ev-card'); if (!c) return;
      const ev = _findEvent(c.dataset.id); if (ev) openDetail(ev);
    });
    view.querySelector('#ev-gps').addEventListener('click', _locateMe);
    /* Populate the city datalist once we have places. */
    _fillCityList();
  }

  function _findEvent(id) { return _events.find(e => e.id === id); }

  function _fillCityList() {
    const dl = document.getElementById('ev-city-list');
    if (!dl || !_places) return;
    /* Offer the better-known places (cities present in cities.json + districts). */
    const names = Object.keys(_places).slice(0, 220).map(k => k.replace(/\b\w/g, c => c.toUpperCase()));
    dl.innerHTML = [...new Set(names)].sort().map(n => `<option value="${esc(n)}">`).join('');
  }

  function _setMobileView(v) {
    const split = document.querySelector('.ev-split');
    if (!split) return;
    split.classList.toggle('ev-show-list', v === 'list');
    split.classList.toggle('ev-show-map', v === 'map');
    document.querySelectorAll('#ev-vt .ev-vt-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'map') setTimeout(() => { try { _map.invalidateSize(); } catch {} }, 60);
  }

  function _locateMe() {
    const btn = document.getElementById('ev-gps');
    if (!navigator.geolocation) { _gpsFallback(btn); return; }
    btn.classList.add('ev-gps-loading'); btn.textContent = '⏳ ' + _t('Locating…', 'A localizar…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        _gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        btn.classList.remove('ev-gps-loading'); btn.classList.add('active'); btn.textContent = '📍 ' + _t('Near me', 'Perto de mim');
        if (!_f.radius) { _f.radius = 25; const rs = document.getElementById('ev-radius'); if (rs) rs.value = '25'; }
        renderList();
      },
      () => { _gpsFallback(btn); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }
  function _gpsFallback(btn) {
    if (btn) { btn.classList.remove('ev-gps-loading'); btn.textContent = '📍 ' + _t('Near me', 'Perto de mim'); }
    /* Fall back to the selected city (already the active point). */
    if (!_f.radius) { _f.radius = 25; const rs = document.getElementById('ev-radius'); if (rs) rs.value = '25'; }
    renderList();
  }

  /* ════════════════════════════ PUBLIC ════════════════════════════ */

  async function show() {
    const view = document.getElementById('view-eventos');
    if (!view) return;
    if (_inited) { setTimeout(() => { try { _map && _map.invalidateSize(); } catch {} }, 60); return; }

    _buildShell(view);
    _wire(view);
    const list = document.getElementById('ev-list');
    if (list) list.innerHTML = skeletonHTML();

    try { await _loadLeaflet(); _initMap(); } catch {}
    _loading = true;
    try {
      await aggregate();
    } catch (e) { /* aggregate already isolates per-source */ }
    _loading = false;
    _fillCityList();
    renderList();
    _inited = true;
  }

  return { show };
})();
