/* ══════════════════════════════════════════════════════════════════
   NETWORK LAB (#netlab) — IPs, redes, geolocalização e infraestrutura.
   Frontend-only, sem chaves: os dados de IP vêm do ipwho.is (CORS *,
   sem auth); a latência é medida no browser por timing de fetch; a
   deteção de VPN é uma HEURÍSTICA honesta (fuso do dispositivo vs fuso
   do IP + tipo de ligação). O mapa é um "scanner tático" em canvas
   (CanvasEngine + costas do data/world-countries.geojson já em cache).
   Histórico e cache do último resultado em localStorage → funciona
   parcialmente offline (mostra o último scan sem rede).
   Fontes avaliadas: ipwho.is (escolhida — CORS, ASN/ISP/cidade/coords),
   ipapi.co (rate-limit apertado), Cloudflare trace (sem CORS), ipify
   (só o IP — usada em best-effort para o IPv6).
══════════════════════════════════════════════════════════════════ */
const NetLabPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const T = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let _root = null, _eng = null, _geo = null, _cur = null, _built = false;

  /* ── storage ── */
  const HKEY = 'netlab:history', CKEY = 'netlab:last';
  function history() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
  function pushHistory(d) {
    if (!d || !d.ip) return;
    let h = history().filter(x => x.ip !== d.ip);
    h.unshift({ ip: d.ip, city: d.city, country: d.country, cc: d.country_code, org: (d.connection && d.connection.org) || d.org, flag: d.flag && d.flag.emoji, ts: Date.now(), self: !!d._self });
    h = h.slice(0, 12);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) {}
  }

  /* ── data ── */
  async function lookup(ip) {
    const url = 'https://ipwho.is/' + (ip ? encodeURIComponent(ip) : '');
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (!d || d.success === false) throw new Error(d && d.message || 'lookup failed');
    return d;
  }
  async function fetchSelf() {
    const d = await lookup('');
    d._self = true;
    /* best-effort: IPv6 distinto via api64.ipify (degrada em silêncio) */
    try {
      const c = new AbortController(); setTimeout(() => c.abort(), 3500);
      const v6 = await fetch('https://api64.ipify.org?format=json', { signal: c.signal }).then(r => r.json());
      if (v6 && v6.ip && v6.ip.includes(':') && v6.ip !== d.ip) d._ipv6 = v6.ip;
    } catch (e) {}
    return d;
  }

  /* ── latency probes (round-trip via no-cors fetch; min de 3) ── */
  const PROBES = [
    { id: 'eu',   label: T('Europe', 'Europa'),        url: 'https://www.cloudflare.com/cdn-cgi/trace' },
    { id: 'gh',   label: 'GitHub',                       url: 'https://github.com/favicon.ico' },
    { id: 'goog', label: 'Google',                       url: 'https://www.google.com/favicon.ico' },
    { id: 'wiki', label: 'Wikimedia',                    url: 'https://www.wikipedia.org/favicon.ico' },
  ];
  async function probe(url) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        const c = new AbortController(); const to = setTimeout(() => c.abort(), 4000);
        await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: c.signal });
        clearTimeout(to);
        best = Math.min(best, performance.now() - t0);
      } catch (e) { /* opaque errors still time out or resolve */ }
    }
    return best === Infinity ? null : Math.round(best);
  }
  async function runProbes() {
    const grid = _root.querySelector('#nl-lat-grid');
    if (!grid) return;
    for (const p of PROBES) {
      const cell = grid.querySelector(`[data-probe="${p.id}"] .nl-lat-val`);
      const ms = await probe(p.url);
      if (!cell) continue;
      if (ms == null) { cell.textContent = '—'; continue; }
      const q = ms < 60 ? 'good' : ms < 160 ? 'ok' : 'slow';
      cell.textContent = ms + ' ms';
      cell.className = 'nl-lat-val ' + q;
      cell.closest('[data-probe]').querySelector('.nl-lat-bar span').style.width = Math.min(100, ms / 3) + '%';
      cell.closest('[data-probe]').querySelector('.nl-lat-bar span').dataset.q = q;
    }
  }

  /* ── VPN / proxy heuristic (honest, browser-side) ── */
  function analyzeMasking(d) {
    const flags = [];
    let risk = 0;
    try {
      const brTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (d.timezone && d.timezone.id && brTz && d.timezone.id !== brTz) {
        flags.push({ k: T('Timezone mismatch', 'Fuso horário difere'), v: `${brTz} ≠ ${d.timezone.id}`, bad: true });
        risk += 55;
      } else if (d.timezone && d.timezone.id) {
        flags.push({ k: T('Timezone', 'Fuso horário'), v: T('matches device', 'coincide com o dispositivo'), bad: false });
      }
    } catch (e) {}
    const conn = d.connection || {};
    const org = ((conn.org || conn.isp || '') + '').toLowerCase();
    if (/vpn|proxy|hosting|datacenter|data center|cloud|ovh|hetzner|digitalocean|amazon|google llc|microsoft|linode|vultr|leaseweb/.test(org)) {
      flags.push({ k: T('Network type', 'Tipo de rede'), v: T('hosting/datacenter (not a home ISP)', 'alojamento/datacenter (não é um ISP doméstico)'), bad: true });
      risk += 40;
    } else if (conn.org || conn.isp) {
      flags.push({ k: T('Network type', 'Tipo de rede'), v: T('consumer ISP', 'ISP de consumidor'), bad: false });
    }
    const lang = (navigator.language || '').slice(0, 2).toLowerCase();
    const cc = (d.country_code || '').toLowerCase();
    const langCountry = { pt: 'pt', en: 'gb', es: 'es', fr: 'fr', de: 'de', it: 'it', nl: 'nl' };
    if (lang && cc && langCountry[lang] && langCountry[lang] !== cc && !(lang === 'en')) {
      flags.push({ k: T('Browser language', 'Idioma do browser'), v: `${lang.toUpperCase()} vs ${cc.toUpperCase()}`, bad: true });
      risk += 10;
    }
    risk = Math.min(100, risk);
    const verdict = risk >= 55 ? { lbl: T('Likely masked', 'Provavelmente mascarado'), cls: 'bad' }
      : risk >= 25 ? { lbl: T('Possibly masked', 'Possivelmente mascarado'), cls: 'warn' }
      : { lbl: T('Looks direct', 'Parece ligação direta'), cls: 'good' };
    return { risk, verdict, flags };
  }

  /* ── equirectangular projection helpers ── */
  const proj = (lon, lat, w, h) => [((+lon + 180) / 360) * w, ((90 - +lat) / 180) * h];

  async function ensureGeo() {
    if (_geo) return _geo;
    try {
      const g = await fetch('data/world-countries.geojson').then(r => r.json());
      /* pré-projetar rings grandes uma vez (ignora ilhas minúsculas p/ perf) */
      const rings = [];
      (g.features || []).forEach(f => {
        const geom = f.geometry; if (!geom) return;
        const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
        polys.forEach(poly => poly.forEach(ring => { if (ring.length > 8) rings.push(ring); }));
      });
      _geo = rings;
    } catch (e) { _geo = []; }
    return _geo;
  }

  /* ── radar canvas ── */
  function startRadar(lat, lon) {
    stopRadar();
    const cv = _root.querySelector('#nl-radar'); if (!cv || typeof CanvasEngine === 'undefined') return;
    let sweep = 0, t = 0, off = null, ow = 0, oh = 0;
    const accent = () => getComputedStyle(document.body).getPropertyValue('--accent-rgb').trim() || '56,189,248';

    function buildOffscreen(w, h) {
      off = document.createElement('canvas'); off.width = w; off.height = h; ow = w; oh = h;
      const c = off.getContext('2d');
      c.strokeStyle = 'rgba(' + accent() + ',.28)'; c.lineWidth = 0.7;
      (_geo || []).forEach(ring => {
        c.beginPath();
        ring.forEach((pt, i) => { const [x, y] = proj(pt[0], pt[1], w, h); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.stroke();
      });
      /* graticule */
      c.strokeStyle = 'rgba(' + accent() + ',.10)'; c.lineWidth = 0.5;
      for (let LON = -150; LON <= 150; LON += 30) { const [x] = proj(LON, 0, w, h); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let LAT = -60; LAT <= 60; LAT += 30) { const [, y] = proj(0, LAT, w, h); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    }

    _eng = CanvasEngine.create(cv, {
      update: dt => { sweep += dt * 0.9; t += dt; },
      draw: (ctx, w, h) => {
        if (!off || ow !== Math.round(w) || oh !== Math.round(h)) buildOffscreen(Math.round(w), Math.round(h));
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(3,8,18,.9)'; ctx.fillRect(0, 0, w, h);
        if (off) ctx.drawImage(off, 0, 0, w, h);
        const [mx, my] = proj(lon, lat, w, h);
        /* radar sweep from the marker */
        const R = Math.hypot(w, h);
        const a = sweep % (Math.PI * 2);
        const grad = ctx.createConicGradient ? ctx.createConicGradient(a, mx, my) : null;
        if (grad) {
          grad.addColorStop(0, 'rgba(' + accent() + ',.35)');
          grad.addColorStop(0.08, 'rgba(' + accent() + ',0)');
          grad.addColorStop(1, 'rgba(' + accent() + ',0)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.fill();
        }
        /* rings + marker */
        ctx.strokeStyle = 'rgba(' + accent() + ',.5)';
        for (let i = 0; i < 3; i++) {
          const pr = ((t * 40 + i * 55) % 165);
          ctx.globalAlpha = 1 - pr / 165; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(mx, my, pr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f2b344';
        ctx.beginPath(); ctx.arc(mx, my, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(242,179,68,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my); ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();
      },
    });
    _eng.start();
  }
  function stopRadar() { if (_eng) { _eng.destroy(); _eng = null; } }

  /* ── render ── */
  function kv(k, v, cls) { return `<div class="nl-kv ${cls || ''}"><span class="nl-kv-k">${k}</span><span class="nl-kv-v">${v == null || v === '' ? '—' : v}</span></div>`; }

  function renderResult(d) {
    _cur = d;
    if (d._self) { try { localStorage.setItem(CKEY, JSON.stringify(d)); } catch (e) {} pushHistory(d); }
    const conn = d.connection || {};
    const m = analyzeMasking(d);
    const panel = _root.querySelector('#nl-result');
    panel.innerHTML = `
      <div class="nl-ipcard ${d._self ? 'self' : ''}">
        <div class="nl-ipcard-top">
          <span class="nl-ipflag">${(d.flag && d.flag.emoji) || '🌐'}</span>
          <div>
            <div class="nl-ip">${esc(d.ip)}</div>
            <div class="nl-ip-sub">${esc([d.city, d.region, d.country].filter(Boolean).join(' · '))}</div>
          </div>
          <span class="nl-ip-tag">${d._self ? T('YOUR IP', 'O TEU IP') : d.type || 'IP'}</span>
        </div>
        <div class="nl-kv-grid">
          ${kv('ISP', esc(conn.isp || conn.org))}
          ${kv('ASN', conn.asn ? 'AS' + conn.asn : '—')}
          ${kv(T('Organisation', 'Organização'), esc(conn.org))}
          ${kv(T('Type', 'Tipo'), esc(d.type))}
          ${d._ipv6 ? kv('IPv6', esc(d._ipv6)) : ''}
          ${kv(T('Coordinates', 'Coordenadas'), d.latitude != null ? `${(+d.latitude).toFixed(3)}, ${(+d.longitude).toFixed(3)}` : '—')}
          ${kv(T('Timezone', 'Fuso horário'), esc(d.timezone && d.timezone.id))}
          ${kv(T('Postal', 'Código postal'), esc(d.postal))}
          ${kv(T('EU member', 'Membro da UE'), d.is_eu != null ? (d.is_eu ? '🇪🇺 ' + T('Yes', 'Sim') : T('No', 'Não')) : '—')}
          ${kv(T('Currency', 'Moeda'), esc(d.currency && d.currency.code))}
        </div>
      </div>
      <div class="nl-masking ${m.verdict.cls}">
        <div class="nl-masking-head">
          <span class="nl-shield">${m.verdict.cls === 'good' ? '🛡️' : m.verdict.cls === 'warn' ? '🕵️' : '🚨'}</span>
          <div><b>${m.verdict.lbl}</b><small>${T('VPN / proxy heuristic', 'Heurística de VPN / proxy')}</small></div>
          <div class="nl-risk"><div class="nl-risk-ring" style="--p:${m.risk}"><span>${m.risk}</span></div></div>
        </div>
        <div class="nl-masking-flags">${m.flags.map(f => `<div class="nl-mflag ${f.bad ? 'bad' : 'ok'}"><span>${f.bad ? '⚠' : '✓'}</span>${f.k}: <b>${esc(f.v)}</b></div>`).join('')}</div>
      </div>`;
    startRadar(d.latitude || 0, d.longitude || 0);
    renderHistory();
  }

  function renderHistory() {
    const el = _root.querySelector('#nl-history'); if (!el) return;
    const h = history();
    if (!h.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="nl-hist-title">${T('Recent lookups', 'Consultas recentes')}</div>
      <div class="nl-hist-list">${h.map(x => `
        <button class="nl-hist-item" data-ip="${esc(x.ip)}">
          <span>${x.flag || '🌐'}</span>
          <span class="nl-hist-ip">${esc(x.ip)}${x.self ? ' <i>•</i>' : ''}</span>
          <span class="nl-hist-loc">${esc([x.city, x.country].filter(Boolean).join(', '))}</span>
        </button>`).join('')}</div>`;
    el.querySelectorAll('.nl-hist-item').forEach(b => b.addEventListener('click', () => doLookup(b.dataset.ip)));
  }

  async function doLookup(ip) {
    const panel = _root.querySelector('#nl-result');
    panel.innerHTML = `<div class="nl-loading"><span class="nl-spin"></span>${T('Scanning', 'A analisar')} ${esc(ip) || T('your connection', 'a tua ligação')}…</div>`;
    try {
      const d = ip ? await lookup(ip) : await fetchSelf();
      renderResult(d);
    } catch (e) {
      panel.innerHTML = `<div class="nl-error">⚠ ${T('Lookup failed', 'Falha na consulta')} — ${esc(String(e.message || e))}. <button class="chip" id="nl-retry">${T('Retry', 'Tentar de novo')}</button></div>`;
      panel.querySelector('#nl-retry')?.addEventListener('click', () => doLookup(ip));
    }
  }

  function show() {
    const view = document.getElementById('view-netlab');
    if (!view) return;
    if (_built) { if (_cur) startRadar(_cur.latitude || 0, _cur.longitude || 0); return; }
    _built = true;
    view.innerHTML = `
      <div class="view-inner nl-wrap">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('netlab', 22)}</span>
          <div class="ph-titles"><h1 class="ph-title">Network Lab</h1>
            <p class="ph-sub">${T('Your public IP, network, geolocation and infrastructure — on a live tactical map', 'O teu IP público, rede, geolocalização e infraestrutura — num mapa tático em tempo real')}</p></div>
        </div>
        <div class="nl-search">
          <input id="nl-input" class="nl-in" type="text" inputmode="numeric" placeholder="${T('Look up any IP (e.g. 1.1.1.1)…', 'Pesquisar qualquer IP (ex.: 1.1.1.1)…')}" aria-label="IP">
          <button class="btn btn-primary" id="nl-go">${T('Scan', 'Analisar')}</button>
          <button class="btn" id="nl-me">${T('My IP', 'O meu IP')}</button>
        </div>
        <div class="nl-grid">
          <div class="nl-radar-wrap"><canvas id="nl-radar"></canvas><div class="nl-radar-scan">${T('SCANNING', 'A VARRER')}</div></div>
          <div id="nl-result"></div>
        </div>
        <div class="nl-latency">
          <div class="nl-sec-title">📡 ${T('Latency probe', 'Sonda de latência')} <small>${T('approx. round-trip from your browser', 'ida-e-volta aprox. do teu browser')}</small></div>
          <div class="nl-lat-grid" id="nl-lat-grid">
            ${PROBES.map(p => `<div class="nl-lat-cell" data-probe="${p.id}"><div class="nl-lat-lbl">${p.label}</div><div class="nl-lat-val">…</div><div class="nl-lat-bar"><span data-q="ok"></span></div></div>`).join('')}
          </div>
        </div>
        <div id="nl-history"></div>
        <p class="nl-foot">${T('IP data by ipwho.is · geolocation is approximate (city-level) · masking detection is heuristic.', 'Dados de IP por ipwho.is · geolocalização aproximada (ao nível da cidade) · deteção de mascaramento é heurística.')}</p>
      </div>`;
    view.querySelector('#nl-go').addEventListener('click', () => { const v = view.querySelector('#nl-input').value.trim(); if (v) doLookup(v); });
    view.querySelector('#nl-input').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) doLookup(v); } });
    view.querySelector('#nl-me').addEventListener('click', () => doLookup(''));
    _root = view;

    /* mostra logo o último scan (offline) e depois refresca */
    try { const last = JSON.parse(localStorage.getItem(CKEY) || 'null'); if (last) renderResult(last); } catch (e) {}
    ensureGeo().then(() => { if (_cur) startRadar(_cur.latitude || 0, _cur.longitude || 0); });
    doLookup('');
    runProbes();
  }

  /* pausa o radar ao sair da secção (poupa GPU) */
  document.addEventListener('routechange', e => { if ((e.detail || '') !== 'netlab') stopRadar(); else if (_cur) startRadar(_cur.latitude || 0, _cur.longitude || 0); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopRadar(); else if (_root && document.getElementById('view-netlab')?.classList.contains('active') && _cur) startRadar(_cur.latitude || 0, _cur.longitude || 0); });

  /* hook de teste (_netlab_harness): injeta um payload ipwho de exemplo
     para verificar o caminho de sucesso sem depender da rede/rate-limit */
  function _render(d) { if (_root) renderResult(d); }

  return { show, _render };
})();
window.NetLabPage = NetLabPage;
