/* ══════════════════════════════════════════════════════════════════
   AUTO INTELLIGENCE (#autolab) — inteligência automóvel 100% DINÂMICA.
   Nada de base local: todos os dados de veículos chegam ao vivo de
   APIs públicas com CORS aberto e sem chaves:
     • Wikidata SPARQL  — marcas → modelos → gerações (datas, fotos,
       códigos), com pesquisa livre via wbsearchentities.
     • Wikipedia REST   — resumo/descrição da geração (pt → en).
     • NHTSA (EUA)      — recalls oficiais e queixas reais de donos por
       componente (para modelos também vendidos nos EUA).
   O localStorage serve apenas de CACHE com TTL (performance/offline),
   nunca de fonte. Modelos exclusivamente europeus mostram os factos
   Wikidata/Wikipedia e assinalam que a base dos EUA não os cobre.
══════════════════════════════════════════════════════════════════ */
const AutoLabPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const T = (en, pt) => (_lang() === 'en' ? en : pt);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ── cache (TTL) — é cache, não base de dados ─────────────────── */
  const TTL = 14 * 24 * 3600 * 1000;
  function cget(k) {
    try {
      const raw = localStorage.getItem('al2:' + k);
      if (!raw) return null;
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t > TTL) return null;
      return v;
    } catch (e) { return null; }
  }
  function cset(k, v) { try { localStorage.setItem('al2:' + k, JSON.stringify({ t: Date.now(), v })); } catch (e) {} }

  /* ── clientes de API ──────────────────────────────────────────── */
  const WDQS = 'https://query.wikidata.org/sparql';
  function sparql(query, ck) {
    const hit = ck && cget(ck);
    if (hit) return Promise.resolve(hit);
    const url = WDQS + '?format=json&query=' + encodeURIComponent(query);
    return fetch(url, { headers: { Accept: 'application/sparql-results+json' } })
      .then(r => { if (!r.ok) throw new Error('wdqs ' + r.status); return r.json(); })
      .then(d => { const rows = d.results.bindings; if (ck) cset(ck, rows); return rows; });
  }
  function wbSearch(term, limit) {
    const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&type=item'
      + '&language=' + (_lang() === 'en' ? 'en' : 'pt') + '&uselang=' + (_lang() === 'en' ? 'en' : 'pt')
      + '&limit=' + (limit || 10) + '&search=' + encodeURIComponent(term);
    return fetch(url).then(r => r.json()).then(d => d.search || []);
  }
  function wikiSummary(title, lang) {
    return fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      .then(r => { if (!r.ok) throw new Error('wiki ' + r.status); return r.json(); });
  }
  function nhtsa(kind, make, model, year) {
    const url = `https://api.nhtsa.gov/${kind}/${kind}ByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    return fetch(url).then(r => { if (!r.ok) throw new Error('nhtsa ' + r.status); return r.json(); });
  }

  const qid = uri => uri.split('/').pop();
  const commons = (file, w) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(decodeURIComponent(file.split('/').pop())) + '?width=' + (w || 480);
  const year = iso => (iso || '').slice(0, 4).replace(/^0+/, '') || null;

  /* ── limpeza da grelha de marcas: normalizar sufixos societários e
     descartar grupos/fábricas (a pesquisa livre continua a encontrar
     qualquer entidade — isto é só apresentação da grelha) ─────────── */
  const BRAND_SUFFIX = /\s+(motor company|motor corporation|motors?|company|cars|auto|automobiles?|automobili|automotive|s\.a\.|ag|gmbh|corporation|division)$/i;
  const BRAND_BLOCK = /^(general motors|stellantis|groupe?\b|grupo\b|british\b|fabryka|iran khodro|gaz|iso rivolta|autoeuropa|hqm|faw|leyland|rover group|jaguar land rover|mercedes-benz group|volkswagen group|ford europe|de dion)/i;
  function cleanBrands(list) {
    const map = {};
    list.forEach(b => {
      if (BRAND_BLOCK.test(b.label) || /^Q\d+$/.test(b.label)) return;
      const name = b.label.replace(BRAND_SUFFIX, '').trim();
      if (!name || BRAND_BLOCK.test(name)) return;
      const key = name.toLowerCase();
      if (!map[key] || b.n > map[key].n) map[key] = { id: b.id, label: name, n: b.n };
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }

  /* ── estado (pilha de navegação interna) ──────────────────────── */
  let _root = null, _built = false;
  let S = { page: 'home', brand: null, model: null, gen: null };

  /* ══ QUERIES ═════════════════════════════════════════════════════ */
  function qBrands() {
    return sparql(`SELECT ?b ?bLabel (MAX(?links) AS ?top) (COUNT(?m) AS ?n) WHERE {
      ?m wdt:P176 ?b ; wikibase:sitelinks ?links ; wdt:P31 wd:Q59773381 .
      FILTER(?links >= 12)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en" }
    } GROUP BY ?b ?bLabel ORDER BY DESC(?top) LIMIT 170`, 'brands2.' + _lang())
      .then(rows => cleanBrands(rows.map(r => ({ id: qid(r.b.value), label: r.bLabel.value, n: +r.n.value }))));
  }

  /* marca ⇄ grupo-mãe: o Wikidata atribui uns modelos à marca (T-Roc →
     Volkswagen) e outros ao grupo (Golf → Volkswagen Group) — expandir
     a consulta às entidades relacionadas por P749/P127 nas 2 direções */
  function expandBrand(brandId) {
    return sparql(`SELECT DISTINCT ?rel WHERE {
      { wd:${brandId} wdt:P749 ?rel } UNION { wd:${brandId} wdt:P127 ?rel }
      UNION { ?rel wdt:P749 wd:${brandId} } UNION { ?rel wdt:P127 wd:${brandId} }
    } LIMIT 8`, 'rel.' + brandId)
      .then(rows => [brandId, ...rows.map(r => qid(r.rel.value))])
      .catch(() => [brandId]);
  }

  function qModels(brandId, brandLabel) {
    const ck = 'models3.' + brandId + '.' + _lang();
    const hit = cget(ck);
    const run = hit ? Promise.resolve(hit) : expandBrand(brandId).then(ids => sparql(`SELECT ?m ?mLabel ?b ?type ?links ?img ?s1 ?s2 ?e1 ?e2 WHERE {
      VALUES ?b { ${ids.map(i => 'wd:' + i).join(' ')} }
      ?m wdt:P176 ?b ; wdt:P31 ?type ; wikibase:sitelinks ?links .
      VALUES ?type { wd:Q59773381 wd:Q3231690 }
      OPTIONAL { ?m wdt:P18 ?img }
      OPTIONAL { ?m wdt:P580 ?s1 } OPTIONAL { ?m wdt:P571 ?s2 }
      OPTIONAL { ?m wdt:P582 ?e1 } OPTIONAL { ?m wdt:P2669 ?e2 }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en" }
    }`).then(rows => { cset(ck, rows); return rows; }));
    /* 1ª palavra da marca para validar modelos vindos do grupo-mãe
       (evita que o VW Golf apareça na Seat via Volkswagen Group) */
    const bTok = (brandLabel || '').split(/[\s-]/)[0].toLowerCase();
    return run
      .then(rows => {
        const map = {};
        rows.forEach(r => {
          const viaSelf = qid(r.b.value) === brandId;
          if (!viaSelf && bTok && !r.mLabel.value.toLowerCase().includes(bTok)) return;
          const id = qid(r.m.value);
          const cur = map[id] || (map[id] = { id, label: r.mLabel.value, links: +r.links.value, series: false });
          if (r.type.value.endsWith('Q59773381')) cur.series = true;
          if (r.img && !cur.img) cur.img = r.img.value;
          const s = year(r.s1 && r.s1.value) || year(r.s2 && r.s2.value);
          const e = year(r.e1 && r.e1.value) || year(r.e2 && r.e2.value);
          if (s && (!cur.from || +s < +cur.from)) cur.from = s;
          if (e && (!cur.to || +e > +cur.to)) cur.to = e;
        });
        return Object.values(map)
          .filter(m => !/^Q\d+$/.test(m.label))
          .sort((a, b) => (b.series - a.series) || (b.links - a.links));
      });
  }

  function qGenerations(modelId, modelLabel) {
    const ck = 'gens.' + modelId + '.' + _lang();
    const hit = cget(ck);
    if (hit) return Promise.resolve(hit);
    /* passo 1: filhos diretos (P179 série / P279 subclasse) */
    const direct = sparql(`SELECT ?g ?gLabel ?links ?img ?s1 ?s2 ?e1 ?e2 ?apt ?aen WHERE {
      { ?g wdt:P179 wd:${modelId} } UNION { ?g wdt:P279 wd:${modelId} }
      ?g wikibase:sitelinks ?links .
      OPTIONAL { ?g wdt:P18 ?img }
      OPTIONAL { ?g wdt:P580 ?s1 } OPTIONAL { ?g wdt:P571 ?s2 }
      OPTIONAL { ?g wdt:P582 ?e1 } OPTIONAL { ?g wdt:P2669 ?e2 }
      OPTIONAL { ?apt schema:about ?g ; schema:isPartOf <https://pt.wikipedia.org/> }
      OPTIONAL { ?aen schema:about ?g ; schema:isPartOf <https://en.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en" }
    }`);
    /* passo 2: itens cujo nome começa pelo do modelo (Wikidata nem
       sempre liga as gerações à série) */
    const search = wbSearch(modelLabel, 20).catch(() => []);
    return Promise.all([direct, search]).then(([rows, found]) => {
      const map = {};
      rows.forEach(r => {
        const id = qid(r.g.value);
        const cur = map[id] || (map[id] = { id, label: r.gLabel.value, links: +r.links.value });
        if (r.img && !cur.img) cur.img = r.img.value;
        cur.from = cur.from || year(r.s1 && r.s1.value) || year(r.s2 && r.s2.value);
        cur.to = cur.to || year(r.e1 && r.e1.value) || year(r.e2 && r.e2.value);
        if (r.apt && !cur.apt) cur.apt = r.apt.value;
        if (r.aen && !cur.aen) cur.aen = r.aen.value;
      });
      const extra = found.filter(e =>
        e.id !== modelId && !map[e.id] &&
        (e.label || '').toLowerCase().startsWith(modelLabel.toLowerCase()) &&
        (e.label || '').length > modelLabel.length);
      if (!extra.length) return finishGens(map, ck);
      /* enriquecer os achados por pesquisa e validar que são carros */
      const values = extra.map(e => 'wd:' + e.id).join(' ');
      return sparql(`SELECT ?g ?gLabel ?links ?img ?s1 ?s2 ?e1 ?e2 ?apt ?aen WHERE {
        VALUES ?g { ${values} }
        ?g wdt:P31 ?t . VALUES ?t { wd:Q3231690 wd:Q59773381 }
        ?g wikibase:sitelinks ?links .
        OPTIONAL { ?g wdt:P18 ?img }
        OPTIONAL { ?g wdt:P580 ?s1 } OPTIONAL { ?g wdt:P571 ?s2 }
        OPTIONAL { ?g wdt:P582 ?e1 } OPTIONAL { ?g wdt:P2669 ?e2 }
        OPTIONAL { ?apt schema:about ?g ; schema:isPartOf <https://pt.wikipedia.org/> }
        OPTIONAL { ?aen schema:about ?g ; schema:isPartOf <https://en.wikipedia.org/> }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en" }
      }`).then(rows2 => {
        rows2.forEach(r => {
          const id = qid(r.g.value);
          const cur = map[id] || (map[id] = { id, label: r.gLabel.value, links: +r.links.value });
          if (r.img && !cur.img) cur.img = r.img.value;
          cur.from = cur.from || year(r.s1 && r.s1.value) || year(r.s2 && r.s2.value);
          cur.to = cur.to || year(r.e1 && r.e1.value) || year(r.e2 && r.e2.value);
          if (r.apt && !cur.apt) cur.apt = r.apt.value;
          if (r.aen && !cur.aen) cur.aen = r.aen.value;
        });
        return finishGens(map, ck);
      }).catch(() => finishGens(map, ck));
    });
  }
  function finishGens(map, ck) {
    const gens = Object.values(map)
      .filter(g => !/^Q\d+$/.test(g.label))
      .sort((a, b) => (+(a.from || 9999)) - (+(b.from || 9999)) || b.links - a.links);
    cset(ck, gens);
    return gens;
  }

  /* artigo/summary da geração quando chegámos por caminho sem sitelink */
  function qArticles(genId) {
    return sparql(`SELECT ?apt ?aen ?img ?s1 ?s2 ?e1 ?e2 WHERE {
      OPTIONAL { ?apt schema:about wd:${genId} ; schema:isPartOf <https://pt.wikipedia.org/> }
      OPTIONAL { ?aen schema:about wd:${genId} ; schema:isPartOf <https://en.wikipedia.org/> }
      OPTIONAL { wd:${genId} wdt:P18 ?img }
      OPTIONAL { wd:${genId} wdt:P580 ?s1 } OPTIONAL { wd:${genId} wdt:P571 ?s2 }
      OPTIONAL { wd:${genId} wdt:P582 ?e1 } OPTIONAL { wd:${genId} wdt:P2669 ?e2 }
    }`, 'art.' + genId);
  }

  /* ── NHTSA: recalls + queixas para anos-amostra da geração ────── */
  function carModelBase(label, brandLabel) {
    let s = label;
    if (brandLabel) s = s.replace(new RegExp('^' + brandLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '');
    s = s.replace(/\((.*?)\)/g, ' ')
      .replace(/\b(mk\.?\s?\d+|[ivxlc]{1,5}|w\d{3}|e\d{2,3}|f\d{2}|g\d{2}|b[5-9]|typ?e?\s?\w{1,4}|generation|geração|série|series|\d{4}(–|-)\d{0,4})\b/gi, ' ')
      .replace(/\s+/g, ' ').trim();
    return s || label;
  }
  function sampleYears(from, to) {
    const now = new Date().getFullYear();
    const f = +from || (to ? +to - 5 : now - 5);
    const t = Math.min(+to || now, now);
    const ys = new Set([f + 1, Math.round((f + t) / 2), t]);
    return [...ys].filter(y => y >= 1990 && y <= now);
  }
  function fetchNhtsa(make, model, from, to) {
    const ck = `nhtsa.${make}.${model}.${from}-${to}`.toLowerCase();
    const hit = cget(ck);
    if (hit) return Promise.resolve(hit);
    const years = sampleYears(from, to);
    const jobs = [];
    years.forEach(y => {
      jobs.push(nhtsa('recalls', make, model, y).then(d => ({ y, kind: 'r', d })).catch(() => null));
      jobs.push(nhtsa('complaints', make, model, y).then(d => ({ y, kind: 'c', d })).catch(() => null));
    });
    return Promise.all(jobs).then(rs => {
      const recalls = {}, comps = {}, meta = { years, fires: 0, crashes: 0, complaints: 0, samples: {} };
      rs.filter(Boolean).forEach(({ y, kind, d }) => {
        const list = d.results || [];
        if (kind === 'r') {
          list.forEach(r => {
            const key = r.NHTSACampaignNumber || (r.Component + r.ReportReceivedDate);
            if (!recalls[key]) recalls[key] = { comp: r.Component, date: r.ReportReceivedDate, sum: r.Summary, camp: r.NHTSACampaignNumber, rem: r.Remedy };
          });
        } else {
          meta.complaints += list.length;
          list.forEach(c => {
            const comp = (c.components || 'OUTRO').split(',')[0].trim();
            comps[comp] = (comps[comp] || 0) + 1;
            if (String(c.fire) === 'true' || c.fire === true) meta.fires++;
            if (String(c.crash) === 'true' || c.crash === true) meta.crashes++;
            if (!meta.samples[comp] && c.summary) meta.samples[comp] = String(c.summary).slice(0, 220);
          });
        }
      });
      const out = {
        recalls: Object.values(recalls).sort((a, b) => (b.date || '').split('/').reverse().join('') > (a.date || '').split('/').reverse().join('') ? 1 : -1),
        components: Object.entries(comps).sort((a, b) => b[1] - a[1]),
        meta,
      };
      cset(ck, out);
      return out;
    });
  }

  /* ══ RENDER ══════════════════════════════════════════════════════ */
  function shell() {
    return `
      <div class="view-inner al-wrap">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('autolab', 22)}</span>
          <div class="ph-titles"><h1 class="ph-title">Auto Intelligence</h1>
            <p class="ph-sub">${T('Live vehicle intelligence — Wikidata · Wikipedia · NHTSA, no local database', 'Inteligência automóvel em direto — Wikidata · Wikipedia · NHTSA, sem base de dados local')}</p></div>
        </div>
        <div id="al-crumbs" class="al-crumbs"></div>
        <div id="al-body"></div>
        <p class="al-foot">${T(
          'All vehicle data is fetched live from public APIs (Wikidata/Wikipedia for models and generations, NHTSA for official recalls and real owner complaints). US data may not cover Europe-only models. Always inspect the specific car.',
          'Todos os dados de veículos chegam ao vivo de APIs públicas (Wikidata/Wikipedia para modelos e gerações, NHTSA para recalls oficiais e queixas reais de donos). A base dos EUA pode não cobrir modelos exclusivamente europeus. Inspeciona sempre o carro específico.')}</p>
      </div>`;
  }

  function crumbs() {
    const el = _root.querySelector('#al-crumbs');
    const parts = [`<button class="al-crumb" data-nav="home">🏁 ${T('Brands', 'Marcas')}</button>`];
    if (S.brand) parts.push(`<button class="al-crumb" data-nav="models">${esc(S.brand.label)}</button>`);
    if (S.model) parts.push(`<button class="al-crumb" data-nav="gens">${esc(S.model.label)}</button>`);
    if (S.gen) parts.push(`<span class="al-crumb on">${esc(S.gen.label)}</span>`);
    el.innerHTML = parts.join('<span class="al-crumb-sep">›</span>');
    el.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      const nv = b.dataset.nav;
      if (nv === 'home') { S = { page: 'home', brand: null, model: null, gen: null }; renderHome(); }
      else if (nv === 'models') { S.model = null; S.gen = null; S.page = 'models'; renderModels(); }
      else if (nv === 'gens') { S.gen = null; S.page = 'gens'; renderGens(); }
    }));
  }

  const spinner = msg => `<div class="al-loading"><span class="al-spin"></span>${msg}</div>`;
  const errBox = (msg, retryId) => `<div class="al-empty"><span>⚠️</span><p>${msg}</p>${retryId ? `<button class="btn" id="${retryId}">↻ ${T('Retry', 'Tentar de novo')}</button>` : ''}</div>`;

  /* ── HOME: pesquisa livre + grelha de marcas ao vivo ──────────── */
  function renderHome() {
    S.page = 'home';
    crumbs();
    const body = _root.querySelector('#al-body');
    body.innerHTML = `
      <div class="al-search-wrap">
        <input id="al-q" class="al-search" type="search" autocomplete="off"
          placeholder="${T('Search any brand or model… (e.g. XC60, Giulia, Golf)', 'Pesquisa qualquer marca ou modelo… (ex: XC60, Giulia, Golf)')}">
        <div id="al-q-out" class="al-q-out" hidden></div>
      </div>
      <div class="al-sec-t">🏷️ ${T('Popular brands', 'Marcas populares')} <small>${T('live from Wikidata', 'ao vivo do Wikidata')}</small></div>
      <div id="al-brands">${spinner(T('Loading brands…', 'A carregar marcas…'))}</div>`;

    /* pesquisa livre — salta para marca OU diretamente para modelo */
    const q = body.querySelector('#al-q'), out = body.querySelector('#al-q-out');
    let deb = null;
    q.addEventListener('input', () => {
      clearTimeout(deb);
      const term = q.value.trim();
      if (term.length < 2) { out.hidden = true; return; }
      deb = setTimeout(() => {
        wbSearch(term, 8).then(rs => {
          const items = rs.filter(e => /car|automó|automob|vehículo|veículo|SUV|marca|brand|manufacturer|fabricante|modelo|model/i.test(e.description || '') || /^[A-Z]/.test(e.label || ''));
          if (!items.length) { out.hidden = true; return; }
          out.innerHTML = items.map(e => `
            <button class="al-q-row" data-id="${e.id}" data-label="${esc(e.label)}">
              <b>${esc(e.label)}</b><small>${esc(e.description || '')}</small>
            </button>`).join('');
          out.hidden = false;
          out.querySelectorAll('.al-q-row').forEach(b => b.addEventListener('click', () => {
            out.hidden = true; q.value = '';
            resolvePick(b.dataset.id, b.dataset.label);
          }));
        }).catch(() => { out.hidden = true; });
      }, 280);
    });
    document.addEventListener('click', e => { if (out && !out.contains(e.target) && e.target !== q) out.hidden = true; });

    qBrands().then(brands => {
      const el = body.querySelector('#al-brands');
      if (!el) return;
      el.innerHTML = `<div class="al-brand-grid">${brands.map(b => `
        <button class="al-brand" data-id="${b.id}" data-label="${esc(b.label)}">
          <span class="al-brand-mono">${esc(b.label.slice(0, 2).toUpperCase())}</span>
          <b>${esc(b.label)}</b>
        </button>`).join('')}</div>`;
      el.querySelectorAll('.al-brand').forEach(btn => btn.addEventListener('click', () => {
        S.brand = { id: btn.dataset.id, label: btn.dataset.label };
        S.model = null; S.gen = null;
        renderModels();
      }));
      if (typeof Motion !== 'undefined') Motion.stagger(el.querySelectorAll('.al-brand'), { step: 14 });
    }).catch(() => {
      const el = body.querySelector('#al-brands');
      if (el) { el.innerHTML = errBox(T('Could not reach Wikidata. Check connection.', 'Não foi possível contactar o Wikidata. Verifica a ligação.'), 'al-rt-b'); el.querySelector('#al-rt-b')?.addEventListener('click', renderHome); }
    });
  }

  /* resolve um resultado de pesquisa: é marca, série ou geração? */
  function resolvePick(id, label) {
    const body = _root.querySelector('#al-body');
    body.innerHTML = spinner(T('Identifying…', 'A identificar…'));
    sparql(`SELECT ?t WHERE { wd:${id} wdt:P31 ?t }`).then(rows => {
      const types = rows.map(r => qid(r.t.value));
      if (types.includes('Q59773381')) {           /* série → gerações */
        S.brand = S.brand || { id: null, label: '' };
        S.model = { id, label };
        renderGens();
      } else if (types.includes('Q3231690')) {     /* geração/modelo → dashboard */
        S.model = S.model || { id, label };
        S.gen = { id, label };
        renderDash();
      } else {                                     /* assume marca */
        S.brand = { id, label };
        S.model = null; S.gen = null;
        renderModels();
      }
    }).catch(() => { S.brand = { id, label }; renderModels(); });
  }

  /* ── MODELOS de uma marca ─────────────────────────────────────── */
  function renderModels() {
    S.page = 'models';
    crumbs();
    const body = _root.querySelector('#al-body');
    body.innerHTML = spinner(T('Loading models from Wikidata…', 'A carregar modelos do Wikidata…'));
    qModels(S.brand.id, S.brand.label).then(models => {
      if (!models.length) { body.innerHTML = errBox(T('No models found for this brand on Wikidata.', 'Nenhum modelo encontrado para esta marca no Wikidata.')); return; }
      body.innerHTML = `
        <input id="al-mf" class="al-search al-mf" type="search" placeholder="${T('Filter models…', 'Filtrar modelos…')}" autocomplete="off">
        <div class="al-model-grid">${models.map(m => `
          <button class="al-model" data-id="${m.id}" data-label="${esc(m.label)}" data-series="${m.series ? 1 : 0}" data-name="${esc(m.label.toLowerCase())}">
            <span class="al-model-img">${m.img ? `<img src="${commons(m.img, 320)}" alt="" loading="lazy" onerror="this.remove()">` : '🚗'}</span>
            <span class="al-model-body">
              <b>${esc(m.label)}</b>
              <small>${m.from ? m.from + '–' + (m.to || T('present', 'atual')) : ''}${m.series ? ` · ${T('generations', 'gerações')} →` : ''}</small>
            </span>
          </button>`).join('')}</div>`;
      const mf = body.querySelector('#al-mf');
      mf.addEventListener('input', () => {
        const t = mf.value.trim().toLowerCase();
        body.querySelectorAll('.al-model').forEach(el => { el.hidden = t && !el.dataset.name.includes(t); });
      });
      body.querySelectorAll('.al-model').forEach(btn => btn.addEventListener('click', () => {
        S.model = { id: btn.dataset.id, label: btn.dataset.label };
        if (btn.dataset.series === '1') renderGens();
        else { S.gen = { id: btn.dataset.id, label: btn.dataset.label }; renderDash(); }
      }));
      if (typeof Motion !== 'undefined') Motion.stagger(body.querySelectorAll('.al-model'), { step: 12 });
    }).catch(() => {
      body.innerHTML = errBox(T('Could not load models. Wikidata may be busy.', 'Não foi possível carregar os modelos. O Wikidata pode estar ocupado.'), 'al-rt-m');
      body.querySelector('#al-rt-m')?.addEventListener('click', renderModels);
    });
  }

  /* ── GERAÇÕES de um modelo ────────────────────────────────────── */
  function renderGens() {
    S.page = 'gens';
    crumbs();
    const body = _root.querySelector('#al-body');
    body.innerHTML = spinner(T('Finding generations…', 'A procurar gerações…'));
    qGenerations(S.model.id, S.model.label).then(gens => {
      if (!gens.length) {  /* modelo de geração única */
        S.gen = { id: S.model.id, label: S.model.label };
        renderDash();
        return;
      }
      body.innerHTML = `
        <div class="al-sec-t">📅 ${T('Pick the generation', 'Escolhe a geração')} <small>${T('the unit of analysis', 'a unidade de análise')}</small></div>
        <div class="al-gen-grid">${gens.map(g => `
          <button class="al-genc" data-id="${g.id}" data-label="${esc(g.label)}" data-from="${g.from || ''}" data-to="${g.to || ''}" data-apt="${esc(g.apt || '')}" data-aen="${esc(g.aen || '')}" data-img="${esc(g.img || '')}">
            <span class="al-genc-img">${g.img ? `<img src="${commons(g.img, 380)}" alt="" loading="lazy" onerror="this.remove()">` : '🚘'}</span>
            <span class="al-genc-body">
              <b>${esc(g.label)}</b>
              <small>${g.from ? g.from + ' – ' + (g.to || T('in production', 'em produção')) : T('dates unavailable', 'datas indisponíveis')}</small>
            </span>
          </button>`).join('')}</div>`;
      body.querySelectorAll('.al-genc').forEach(btn => btn.addEventListener('click', () => {
        S.gen = { id: btn.dataset.id, label: btn.dataset.label, from: btn.dataset.from || null, to: btn.dataset.to || null, apt: btn.dataset.apt || null, aen: btn.dataset.aen || null, img: btn.dataset.img || null };
        renderDash();
      }));
      if (typeof Motion !== 'undefined') Motion.stagger(body.querySelectorAll('.al-genc'), { step: 20 });
    }).catch(() => {
      body.innerHTML = errBox(T('Could not load generations.', 'Não foi possível carregar as gerações.'), 'al-rt-g');
      body.querySelector('#al-rt-g')?.addEventListener('click', renderGens);
    });
  }

  /* ── DASHBOARD de uma geração ─────────────────────────────────── */
  function renderDash() {
    S.page = 'dash';
    crumbs();
    const body = _root.querySelector('#al-body');
    const g = S.gen;
    body.innerHTML = `
      <div class="al-dash">
        <div class="al-hero" id="al-hero">
          <div class="al-hero-img" id="al-hero-img">${g.img ? `<img src="${commons(g.img, 640)}" alt="" onerror="this.remove()">` : ''}</div>
          <div class="al-hero-body">
            <h2>${esc(g.label)}</h2>
            <p class="al-hero-years" id="al-years">${g.from ? g.from + ' – ' + (g.to || T('in production', 'em produção')) : ''}</p>
            <div class="al-hero-sum" id="al-wiki">${spinner(T('Loading description…', 'A carregar descrição…'))}</div>
            <div class="al-hero-links" id="al-links"></div>
          </div>
        </div>
        <div class="al-sec"><div class="al-sec-t">📡 ${T('Real-world signals', 'Sinais do mundo real')} <small>NHTSA · ${T('live', 'em direto')}</small></div>
          <div id="al-signals">${spinner(T('Querying official recall & complaint databases…', 'A consultar bases oficiais de recalls e queixas…'))}</div>
        </div>
        <div class="al-sec" id="al-comp-sec" hidden><div class="al-sec-t">🔧 ${T('Most reported problems', 'Problemas mais reportados')} <small>${T('real owner complaints', 'queixas reais de donos')}</small></div>
          <div id="al-comps"></div>
        </div>
        <div class="al-sec" id="al-rec-sec" hidden><div class="al-sec-t">📋 ${T('Official recalls', 'Recalls oficiais')} <small>${T('with campaign number', 'com número de campanha')}</small></div>
          <div id="al-recalls"></div>
        </div>
      </div>`;

    /* 1) completar factos Wikidata (artigos/datas/foto) se vieram vazios */
    const haveArts = g.apt || g.aen;
    const artsP = haveArts ? Promise.resolve(null) : qArticles(g.id).then(rows => {
      /* os OPTIONAL podem chegar espalhados por várias linhas — fundir tudo */
      rows.forEach(r => {
        if (r.apt && !g.apt) g.apt = r.apt.value;
        if (r.aen && !g.aen) g.aen = r.aen.value;
        if (r.img && !g.img) g.img = r.img.value;
        if (!g.from) g.from = year(r.s1 && r.s1.value) || year(r.s2 && r.s2.value);
        if (!g.to) g.to = year(r.e1 && r.e1.value) || year(r.e2 && r.e2.value);
      });
      if (g.img) { const hi = body.querySelector('#al-hero-img'); if (hi && !hi.firstChild) hi.innerHTML = `<img src="${commons(g.img, 640)}" alt="" onerror="this.remove()">`; }
      const ye = body.querySelector('#al-years');
      if (ye && g.from) ye.textContent = g.from + ' – ' + (g.to || T('in production', 'em produção'));
    }).catch(() => null);

    /* 2) resumo Wikipedia (pt → en) */
    artsP.then(() => {
      const title = u => decodeURIComponent((u || '').split('/wiki/')[1] || '');
      const tryPt = g.apt ? wikiSummary(title(g.apt), 'pt') : Promise.reject();
      tryPt.catch(() => g.aen ? wikiSummary(title(g.aen), 'en') : Promise.reject())
        .then(s => {
          const el = body.querySelector('#al-wiki');
          if (el) el.textContent = s.extract || '';
          if (!g.img && s.thumbnail) { const hi = body.querySelector('#al-hero-img'); if (hi) hi.innerHTML = `<img src="${s.thumbnail.source}" alt="">`; }
        })
        .catch(() => { const el = body.querySelector('#al-wiki'); if (el) el.textContent = T('No encyclopedia article found for this generation.', 'Sem artigo de enciclopédia para esta geração.'); });

      /* ligações de evidência — geradas dinamicamente */
      const links = body.querySelector('#al-links');
      const wikiUrl = g.apt || g.aen;
      links.innerHTML = [
        wikiUrl ? `<a class="al-src" href="${esc(wikiUrl)}" target="_blank" rel="noopener">📖 Wikipedia</a>` : '',
        `<a class="al-src" href="https://www.wikidata.org/wiki/${g.id}" target="_blank" rel="noopener">🗃️ Wikidata</a>`,
        `<a class="al-src" href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">🇺🇸 NHTSA</a>`,
        `<a class="al-src" href="https://ec.europa.eu/safety-gate/" target="_blank" rel="noopener">🇪🇺 Safety Gate</a>`,
      ].filter(Boolean).join('');

      /* 3) NHTSA — sinais reais */
      const brandLabel = (S.brand && S.brand.label) || g.label.split(' ')[0];
      const modelBase = carModelBase((S.model && S.model.label) || g.label, brandLabel);
      fetchNhtsa(brandLabel, modelBase, g.from, g.to).then(d => renderSignals(d, brandLabel, modelBase)).catch(() => {
        const el = body.querySelector('#al-signals');
        if (el) el.innerHTML = errBox(T('Could not reach the NHTSA database.', 'Não foi possível contactar a base NHTSA.'));
      });
    });
  }

  function renderSignals(d, make, model) {
    const body = _root.querySelector('#al-body');
    const sig = body.querySelector('#al-signals');
    if (!sig) return;
    const m = d.meta;
    const none = !d.recalls.length && !m.complaints;
    if (none) {
      sig.innerHTML = `<div class="al-nodata">🌍 ${T(
        `No records for "${make} ${model}" in the US database — typical for Europe-only models. Use the EU Safety Gate link above for European recalls.`,
        `Sem registos para "${make} ${model}" na base dos EUA — normal em modelos exclusivamente europeus. Usa o Safety Gate 🇪🇺 acima para recalls europeus.`)}</div>`;
      return;
    }
    sig.innerHTML = `
      <div class="al-sig-grid">
        <div class="al-sig ${d.recalls.length ? 'warn' : 'good'}"><b>${d.recalls.length}</b><small>${T('official recalls', 'recalls oficiais')}</small></div>
        <div class="al-sig ${m.complaints > 60 ? 'warn' : ''}"><b>${m.complaints}</b><small>${T('owner complaints', 'queixas de donos')}</small></div>
        <div class="al-sig ${m.fires ? 'bad' : 'good'}"><b>${m.fires}</b><small>${T('fire reports', 'relatos de incêndio')}</small></div>
        <div class="al-sig ${m.crashes ? 'warn' : 'good'}"><b>${m.crashes}</b><small>${T('crash-linked', 'ligadas a acidente')}</small></div>
      </div>
      <p class="al-sig-note">${T('Sample years', 'Anos amostrados')}: ${m.years.join(', ')} · ${T('source', 'fonte')}: api.nhtsa.gov</p>`;

    /* componentes mais reportados */
    if (d.components.length) {
      const sec = body.querySelector('#al-comp-sec'), out = body.querySelector('#al-comps');
      sec.hidden = false;
      const max = d.components[0][1];
      out.innerHTML = d.components.slice(0, 8).map(([comp, n]) => `
        <div class="al-comp">
          <div class="al-comp-head"><b>${esc(compPt(comp))}</b><span>${n} ${T('reports', 'relatos')}</span></div>
          <div class="al-comp-bar"><i style="width:${Math.max(6, Math.round(n / max * 100))}%"></i></div>
          ${m.samples[comp] ? `<details class="al-comp-sample"><summary>${T('real complaint sample', 'exemplo real de queixa')}</summary><p>“${esc(m.samples[comp])}”</p></details>` : ''}
        </div>`).join('');
    }

    /* recalls oficiais */
    if (d.recalls.length) {
      const sec = body.querySelector('#al-rec-sec'), out = body.querySelector('#al-recalls');
      sec.hidden = false;
      out.innerHTML = d.recalls.slice(0, 10).map(r => `
        <details class="al-recall">
          <summary><span class="al-recall-badge">🔴 RECALL</span><b>${esc(compPt(r.comp))}</b><small>${esc(r.date || '')}${r.camp ? ' · ' + esc(r.camp) : ''}</small></summary>
          <p>${esc(r.sum || '')}</p>
          ${r.rem ? `<p class="al-recall-rem"><b>${T('Remedy', 'Correção')}:</b> ${esc(r.rem)}</p>` : ''}
        </details>`).join('');
    }
    if (typeof Motion !== 'undefined') Motion.stagger(body.querySelectorAll('.al-sig, .al-comp, .al-recall'), { step: 24 });
  }

  /* tradução rápida dos componentes NHTSA mais comuns */
  const COMP_PT = {
    'ENGINE': 'Motor', 'ENGINE AND ENGINE COOLING': 'Motor e refrigeração', 'FUEL/PROPULSION SYSTEM': 'Combustível/propulsão',
    'POWER TRAIN': 'Transmissão', 'ELECTRICAL SYSTEM': 'Sistema elétrico', 'AIR BAGS': 'Airbags',
    'SUSPENSION': 'Suspensão', 'STEERING': 'Direção', 'SERVICE BRAKES': 'Travões', 'SERVICE BRAKES, HYDRAULIC': 'Travões (hidráulicos)',
    'EXTERIOR LIGHTING': 'Iluminação exterior', 'STRUCTURE': 'Estrutura/carroçaria', 'VISIBILITY/WIPER': 'Visibilidade/escovas',
    'VISIBILITY': 'Visibilidade', 'SEATS': 'Bancos', 'SEAT BELTS': 'Cintos de segurança', 'EQUIPMENT': 'Equipamento',
    'VEHICLE SPEED CONTROL': 'Controlo de velocidade', 'WHEELS': 'Rodas', 'TIRES': 'Pneus', 'LATCHES/LOCKS/LINKAGES': 'Fechos/trincos',
    'BACK OVER PREVENTION': 'Câmara/deteção traseira', 'FORWARD COLLISION AVOIDANCE': 'Travagem autónoma', 'UNKNOWN OR OTHER': 'Outro/não especificado',
    'STEERING:COLUMN LOCKING:ANTI-THEFT DEVICE': 'Bloqueio da direção', 'FUEL SYSTEM, GASOLINE': 'Sistema de combustível (gasolina)', 'FUEL SYSTEM, DIESEL': 'Sistema de combustível (diesel)',
  };
  const compPt = c => (_lang() === 'en' ? c : (COMP_PT[c] || COMP_PT[(c || '').split(':')[0]] || c));

  /* ══ INIT ════════════════════════════════════════════════════════ */
  function show() {
    const view = document.getElementById('view-autolab');
    if (!view) return;
    if (_built) return;
    _built = true;
    _root = view;
    view.innerHTML = shell();
    renderHome();
    document.addEventListener('langchange', () => { if (_root) { _root.innerHTML = shell(); S = { page: 'home', brand: null, model: null, gen: null }; renderHome(); } });
  }

  return { show, _state: () => S };
})();
window.AutoLabPage = AutoLabPage;
