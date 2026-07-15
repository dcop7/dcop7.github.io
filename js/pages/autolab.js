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
      /* mais recentes primeiro (Golf 8 no topo, Mk1 no fundo); sem data → fundo */
      .sort((a, b) => (+(b.from || 0)) - (+(a.from || 0)) || b.links - a.links);
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
  /* Reduzir "Honda Civic (eighth generation)" → "Civic" para consultar a
     NHTSA. CUIDADO: o antigo /[ivxlc]{1,5}/ apagava palavras reais feitas
     só de letras romanas (Civic = c-i-v-i-c!), deixando o modelo vazio.
     Agora só se remove um token que seja um algarismo romano VÁLIDO e que
     não seja o nome-base (nunca o 1.º token). */
  const ROMAN_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
  const GEN_WORD = /^(generation|geração|geracao|série|serie|series|mk\.?\d*|w\d{3}|e\d{2,3}|f\d{2}|g\d{2}|b[4-9]|typ|type)$/i;
  function carModelBase(label, brandLabel) {
    let s = label.replace(/\((.*?)\)/g, ' ');
    if (brandLabel) s = s.replace(new RegExp('^' + brandLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '');
    const toks = s.split(/\s+/).filter(Boolean);
    const kept = toks.filter((tok, i) => {
      if (GEN_WORD.test(tok)) return false;
      if (i > 0 && tok.length <= 4 && ROMAN_RE.test(tok)) return false;   // "Golf VII" → "Golf"
      if (/^\d{4}(?:[–\-—]\d{0,4})?$/.test(tok)) return false;             // intervalos de anos
      return true;
    });
    return kept.join(' ').trim() || s.trim() || label;
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

  /* ── FICHA TÉCNICA: infobox da Wikipedia (motores, cotas, peso…) ──
     O Wikidata quase não tem specs de automóveis; a riqueza (1.4/1.8 L,
     peso, dimensões, caixas) vive na infobox da Wikipedia. Aqui isolamos
     TODAS as {{Infobox automobile}} do artigo (um artigo-"gama" tem uma
     por carroçaria/mercado) e fundimos os campos. */
  function wikiText(title, lang) {
    return fetch(`https://${lang}.wikipedia.org/w/api.php?action=parse&format=json&origin=*&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`)
      .then(r => { if (!r.ok) throw new Error('wt ' + r.status); return r.json(); })
      .then(d => (d.parse && d.parse.wikitext && d.parse.wikitext['*']) || '');
  }
  function ibFindBoxes(wt) {
    const out = []; let i = 0;
    while (true) {
      const idx = wt.indexOf('{{Infobox automobile', i);
      if (idx < 0) break;
      let d = 0, j = idx, end = -1;
      while (j < wt.length - 1) {
        const two = wt.slice(j, j + 2);
        if (two === '{{') { d++; j += 2; continue; }
        if (two === '}}') { d--; j += 2; if (d === 0) { end = j; break; } continue; }
        j++;
      }
      if (end < 0) break;
      out.push(wt.slice(idx, end)); i = end;
    }
    return out;
  }
  /* separar campos |chave = valor ao nível 0 (ignorar | dentro de {{}}/[[]]) */
  function ibFields(box) {
    const inner = box.replace(/^\{\{Infobox automobile/i, '').replace(/\}\}$/, '');
    let d = 0, buf = ''; const parts = [];
    for (let k = 0; k < inner.length; k++) {
      const two = inner.slice(k, k + 2);
      if (two === '{{' || two === '[[') { d++; buf += two; k++; continue; }
      if (two === '}}' || two === ']]') { d--; buf += two; k++; continue; }
      if (inner[k] === '|' && d === 0) { parts.push(buf); buf = ''; continue; }
      buf += inner[k];
    }
    parts.push(buf);
    const f = {};
    parts.forEach(p => {
      const eq = p.indexOf('='); if (eq < 0) return;
      const k = p.slice(0, eq).trim().toLowerCase(), v = p.slice(eq + 1).trim();
      if (k && v) f[k] = v;
    });
    return f;
  }
  function wkResolve(x) {
    x = x.replace(/\{\{\s*(?:convert|cvt)\s*\|\s*([^|}]+)\|\s*([^|}]+)[^}]*\}\}/gi, '$1 $2');
    for (let n = 0; n < 3; n++) x = x.replace(/\[\[[^\[\]|]*\|([^\[\]]*)\]\]/g, '$1').replace(/\[\[([^\[\]]*)\]\]/g, '$1');
    return x;
  }
  function wkClean(x) {
    return wkResolve(x).replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/'{2,}/g, '').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  /* resolver wikilinks ANTES de dividir (os [[x|y]] têm | que não é separador) */
  function wkList(v) {
    const s = wkResolve(v)
      .replace(/\{\{\s*(?:ubl|unbulleted list|plainlist|flatlist|hlist)\s*\|?/gi, '\n')
      .replace(/\{\{[^{}]*\}\}/g, ' ').replace(/[{}]/g, '')
      .replace(/<br\s*\/?>/gi, '\n');
    const seen = [], out = [];
    s.split(/[\n*|]+/).forEach(part => {
      const c = wkClean(part);
      if (c.length > 1 && !/^[A-Za-z .()\/-]+:$/.test(c) && !seen.includes(c.toLowerCase())) { seen.push(c.toLowerCase()); out.push(c); }
    });
    return out;
  }
  /* extrair medidas convertendo CADA número pela sua própria unidade adjacente
     (evita anos de "(2006-08 sedan)" e misturas lb/kg). Limites por tipo. */
  const DIM_BOUNDS = { length: [2500, 6500], width: [1400, 2300], height: [1200, 2200], wheelbase: [1800, 3800], mass: [600, 3200] };
  function toMetric(str, kind) {
    if (!str) return null;
    const bounds = DIM_BOUNDS[kind]; if (!bounds) return null;
    const s = str.replace(/\([^)]*\)/g, ' ');   // fora anotações de carroçaria/ano
    const re = /(?:(\d[\d.,]*)\s*[-–—]\s*)?(\d[\d.,]*)\s*(mm|cm|in|lbs?|kg|t)\b/gi;
    const conv = (raw, u) => {
      let n = parseFloat(String(raw).replace(/,/g, '')); if (!isFinite(n)) return null;
      u = u.toLowerCase();
      if (kind === 'mass') { if (u === 'lb' || u === 'lbs') n *= 0.4536; else if (u === 't') n *= 1000; }
      else { if (u === 'in') n *= 25.4; else if (u === 'cm') n *= 10; }
      return n;
    };
    const vals = []; let m;
    while ((m = re.exec(s))) { [m[1], m[2]].forEach(x => { if (x == null) return; const n = conv(x, m[3]); if (n != null && n >= bounds[0] && n <= bounds[1]) vals.push(n); }); }
    if (!vals.length) return null;
    const mn = Math.round(Math.min(...vals)), mx = Math.round(Math.max(...vals));
    return (mn === mx ? mn : mn + '–' + mx) + (kind === 'mass' ? ' kg' : ' mm');
  }
  function pickYears(arr) {
    const ys = ((arr || []).join(' ').match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
    if (!ys.length) return null;
    const mn = Math.min(...ys), mx = Math.max(...ys);
    return mn === mx ? String(mn) : mn + '–' + mx;
  }
  function mergeSpecs(boxes) {
    const eng = [], tr = [], L = [], W = [], H = [], WB = [], WT = [], prod = [], cls = [], lay = [], des = [], asm = [];
    boxes.forEach(f => {
      if (f.engine) eng.push(...wkList(f.engine));
      if (f.transmission) tr.push(...wkList(f.transmission));
      if (f.length) L.push(wkClean(f.length));
      if (f.width) W.push(wkClean(f.width));
      if (f.height) H.push(wkClean(f.height));
      if (f.wheelbase) WB.push(wkClean(f.wheelbase));
      if (f.weight) WT.push(wkClean(f.weight));
      if (f.production) prod.push(wkClean(f.production));
      if (f.class) cls.push(...wkList(f.class));
      if (f.layout) lay.push(...wkList(f.layout));   // 1ª tracção (várias vêm em <br>)
      if (f.designer) des.push(wkClean(f.designer));
      if (f.assembly) asm.push(...wkList(f.assembly));
    });
    const uniq = a => [...new Set(a.map(x => x.trim()).filter(Boolean))];
    const first = a => uniq(a)[0] || null;
    return {
      engines: uniq(eng).slice(0, 16),
      transmissions: uniq(tr).slice(0, 8),
      length: toMetric(L.join(' '), 'length'), width: toMetric(W.join(' '), 'width'),
      height: toMetric(H.join(' '), 'height'), wheelbase: toMetric(WB.join(' '), 'wheelbase'),
      weight: toMetric(WT.join(' '), 'mass'), years: pickYears(prod),
      klass: first(cls), layout: first(lay), designer: first(des), assembly: first(asm),
    };
  }
  function fetchSpecs(g) {
    const ck = 'specs2.' + g.id + '.' + _lang();
    const hit = cget(ck); if (hit) return Promise.resolve(hit);
    const artTitle = u => decodeURIComponent((u || '').split('/wiki/')[1] || '').replace(/_/g, ' ');
    const ptT = artTitle(g.apt), enT = artTitle(g.aen);
    const grab = (t, l) => (t ? wikiText(t, l).then(wt => mergeSpecs(ibFindBoxes(wt).map(ibFields))).catch(() => null) : Promise.resolve(null));
    /* PT primeiro (utilizador em Portugal); se a infobox PT for pobre, EN */
    return grab(ptT, 'pt')
      .then(sp => (sp && sp.engines.length) ? sp : grab(enT, 'en').then(se => se || sp))
      .then(s => {
        s = s || mergeSpecs([]);
        return sparql(`SELECT ?prod WHERE { OPTIONAL { wd:${g.id} wdt:P1092 ?prod } }`, 'prod.' + g.id)
          .then(rows => { const p = rows[0] && rows[0].prod && rows[0].prod.value; if (p) s.produced = (+p).toLocaleString(_lang() === 'en' ? 'en-US' : 'pt-PT'); return s; })
          .catch(() => s);
      })
      .then(s => { cset(ck, s); return s; });
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
        <div class="al-sec" id="al-specs-sec"><div class="al-sec-t">🧾 ${T('Specs & engines', 'Ficha técnica & motores')} <small>${T('from the encyclopedia infobox', 'da ficha da enciclopédia')}</small></div>
          <div id="al-specs">${spinner(T('Reading the technical sheet…', 'A ler a ficha técnica…'))}</div>
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

      /* 3) ficha técnica + motores (infobox Wikipedia) */
      fetchSpecs(g).then(renderSpecs).catch(() => renderSpecs(null));

      /* 4) NHTSA — sinais reais */
      const brandLabel = (S.brand && S.brand.label) || g.label.split(' ')[0];
      const modelBase = carModelBase((S.model && S.model.label) || g.label, brandLabel);
      fetchNhtsa(brandLabel, modelBase, g.from, g.to).then(d => renderSignals(d, brandLabel, modelBase)).catch(() => {
        const el = body.querySelector('#al-signals');
        if (el) el.innerHTML = errBox(T('Could not reach the NHTSA database.', 'Não foi possível contactar a base NHTSA.'));
      });
    });
  }

  function renderSpecs(s) {
    const out = _root.querySelector('#al-specs'), sec = _root.querySelector('#al-specs-sec');
    if (!out || !sec) return;
    const rows = [];
    const add = (label, val) => { if (val) rows.push(`<div class="al-spec"><span>${label}</span><b>${esc(val)}</b></div>`); };
    if (s) {
      add(T('Years', 'Anos'), s.years);
      add(T('Segment', 'Segmento'), s.klass);
      add(T('Drivetrain', 'Tração'), s.layout);
      add(T('Length', 'Comprimento'), s.length);
      add(T('Width', 'Largura'), s.width);
      add(T('Height', 'Altura'), s.height);
      add(T('Wheelbase', 'Dist. entre eixos'), s.wheelbase);
      add(T('Kerb weight', 'Peso'), s.weight);
      add(T('Units produced', 'Unidades produzidas'), s.produced);
      add(T('Assembly', 'Montagem'), s.assembly);
      add(T('Design', 'Design'), s.designer);
    }
    const eng = (s && s.engines) || [], tr = (s && s.transmissions) || [];
    if (!rows.length && !eng.length) {
      out.innerHTML = `<div class="al-nodata">🧾 ${T('No structured technical sheet found for this generation. See the Wikipedia link above.', 'Sem ficha técnica estruturada para esta geração. Vê a ligação da Wikipedia acima.')}</div>`;
      return;
    }
    out.innerHTML = `
      ${rows.length ? `<div class="al-spec-grid">${rows.join('')}</div>` : ''}
      ${eng.length ? `<div class="al-eng"><div class="al-eng-h">⚙️ ${T('Engine line-up', 'Motorizações')} <small>${eng.length} ${T('variants', 'versões')}</small></div>
        <div class="al-eng-list">${eng.map(e => `<span class="al-eng-chip">${esc(e)}</span>`).join('')}</div></div>` : ''}
      ${tr.length ? `<div class="al-eng"><div class="al-eng-h">🔩 ${T('Transmissions', 'Caixas')}</div>
        <div class="al-eng-list">${tr.map(t => `<span class="al-eng-chip alt">${esc(t)}</span>`).join('')}</div></div>` : ''}`;
    if (typeof Motion !== 'undefined') Motion.stagger(_root.querySelectorAll('#al-specs .al-spec, #al-specs .al-eng-chip'), { step: 10 });
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
