/* ══════════════════════════════════════════════════════════════════════
   Universo observável — interface (Explorar › Universo).
   mount(host) / resume() / stop(). Ver u-engine.mjs para a navegação e
   data/universe/SOURCES.md para dados e licenças.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, AU, LY, PC, KPC, MPC, MSUN, D2R, radec, smooth, clamp, lerp, comovingMpc, lookbackGyr, fmtDist, distLines, fmtLightTime, fmtMass, sig, words, niceLength, bvToKelvin, fetchJSON, norm, esc, S_MIN, S_MAX } from './u-core.mjs';
import { Engine } from './u-engine.mjs';
import { createSolarLayer, createSmallBodyLayer, createShellLayer, bodyPos } from './u-near.mjs';
import { createStarLayer, createExoLayer } from './u-stars.mjs';
import { createVolumeLayer, createTracerLayer, createImpostorLayer, diskAxes, typeTile, loadGalaxyData, GC_POS } from './u-galaxy.mjs';
import { createGalaxyCloudLayer, createClusterLayer, createRingsLayer, createCMBLayer } from './u-cosmos.mjs';

const PLANETS = new Set(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
const KIND = { obs: ['Observado', 'is-obs'], calc: ['Calculado', 'is-calc'], model: ['Modelo', 'is-model'], hyp: ['Hipotético', 'is-hyp'] };
const LINK = { solar: ['explorer/solar', 'Abrir no Sistema Solar detalhado'], galaxy: ['explorer/galaxy', 'Abrir no mapa da Via Láctea'] };
const SRC_TXT = { p: 'paralaxe trigonométrica (CNS3 / BSC5)', k: 'valor da literatura recente', s: 'estimada pelo tipo espectral (±30–50%)' };
const SPEEDS = [0, 1, 30, 365.25];
const SPEED_TXT = ['Pausa', '1 dia/s', '1 mês/s', '1 ano/s'];

let app = null;
export function mount(host) { if (app) { app.dispose(); } app = new App(host); window.__uv = app; return app; }
export function resume() { app?.engine.setPaused(false); }
export function stop() { app?.engine.setPaused(true); }

class App {
  constructor(host) {
    this.host = host;
    host.innerHTML = TEMPLATE;
    this.root = host.querySelector('.uv');
    this.$ = s => this.root.querySelector(s);
    this.byId = new Map();
    this.index = [];
    this.compare = ['earth', 'sun', 'betelgeuse', 'milkyway', 'localgroup', 'laniakea', 'observable'];
    this.metric = 'size';
    this.tour = null;
    this.init().catch(e => { console.error('[universo]', e); this.$('.uv-loading').innerHTML = `<p>Não foi possível carregar o Universo.</p><button class="btn" type="button">Tentar de novo</button>`; this.$('.uv-loading button').onclick = () => mount(host); });
  }

  async init() {
    const stage = this.$('.uv-stage');
    const E = this.engine = new Engine(stage.querySelector('.uv-gl'), {
      onPick: (o, info) => this.onPick(o, info),
      onFrame: ctx => this.onFrame(ctx),
      anchor: (s, jd) => this.anchor(s, jd),
    });
    E.onArrive = o => { if (this.tour) this.$('.uv-tour').classList.remove('is-flying'); void o; };
    const cat = this.cat = await fetchJSON('/data/universe/objects.json');
    const [mwData, galData] = await Promise.all([fetchJSON('/data/universe/mw.json'), loadGalaxyData()]);

    /* ── camadas (ordem = ordem de desenho dentro de cada renderOrder) ── */
    const L = this.layers = {};
    L.cmb = E.addLayer(createCMBLayer(E));
    L.deep = E.addLayer(createGalaxyCloudLayer(E, { id: 'deep', name: 'Galáxias distantes e quasares (SDSS)', source: 'SDSS DR18 — galáxias vermelhas 0,2 < z < 0,8 e quasares até z ≈ 7', file: '/data/universe/deep.bin', scale: 10000, mode: 2, range: [24.9, 27.6], size: 1.5, gain: 0.32 }));
    L.sdss = E.addLayer(createGalaxyCloudLayer(E, { id: 'sdss', name: 'Galáxias do SDSS (z < 0,2)', source: 'Sloan Digital Sky Survey DR18 (domínio público) — 1 em cada 3 fibras', file: '/data/universe/sdss.bin', scale: 1000, mode: 1, range: [23.9, 26.9], size: 1.4, gain: 0.3, limit: 130000 }));
    L.zcat = E.addLayer(createGalaxyCloudLayer(E, { id: 'zcat', name: 'Galáxias próximas (CfA ZCAT)', source: 'CfA Redshift Catalog (Huchra et al., versão 1995, via NASA HEASARC)', file: '/data/universe/gal-local.bin', scale: 450, mode: 0, range: [23.1, 25.25], size: 1.9, gain: 0.6 }));
    L.clusters = E.addLayer(createClusterLayer(E));
    L.rings = E.addLayer(createRingsLayer(E));
    L.volume = E.addLayer(createVolumeLayer(E, mwData));
    L.stars = E.addLayer(createStarLayer(E));
    L.exo = E.addLayer(createExoLayer(E));
    L.tracers = E.addLayer(createTracerLayer(E, mwData));
    L.lg = E.addLayer(this.lgLayer(galData.lg));
    L.named = E.addLayer(this.namedGalaxyLayer(galData.gal));
    L.small = E.addLayer(createSmallBodyLayer(E));
    L.helio = E.addLayer(createShellLayer(E, { id: 'helio', name: 'Heliopausa (~121 UA)', kind: 'model', source: 'Distância medida pelas Voyager; forma esquemática', rIn: 118 * AU, rOut: 122 * AU, color: '#6fb0ff', range: [12.6, 15.0], strength: 0.25 }));
    L.oort = E.addLayer(createShellLayer(E, { id: 'oort', name: 'Nuvem de Oort (hipotética)', kind: 'hyp', source: 'Nunca observada — deduzida das órbitas dos cometas de longo período', rIn: 2000 * AU, rOut: 100000 * AU, color: '#9fb7ff', range: [14.6, 17.2], strength: 0.12 }));
    L.solar = E.addLayer(createSolarLayer(E));
    L.curated = E.addLayer(this.curatedLabelLayer());

    await L.stars.load();
    this.buildCatalog(mwData, galData);
    this.buildUI();

    /* início: Terra e Lua, ou o objeto do URL */
    const m = /^#explorer\/universe\/([\w:-]+)/.exec(location.hash);
    const start = (m && this.byId.get(m[1])) || null;
    E.F = [...bodyPos('earth', E.time.jd)];
    E.s = E.sT = 10.6; E.yaw = E.yawT = -0.9; E.pitch = E.pitchT = 0.42;
    if (start) this.select(start, { fly: true });
    else E.focus(this.byId.get('earth'), { s: 8.95 });
    this.ready = true;
    this.$('.uv-loading').hidden = true;
  }

  /* ── âncoras por escala ── */
  anchor(s, jd) {
    const earth = bodyPos('earth', jd), gc = GC_POS, lg = this.byId.get('localgroup')?.getPos() || gc;
    let p = earth;
    p = mix(p, [0, 0, 0], smooth(9.75, 10.6, s));
    p = mix(p, gc, smooth(19.7, 20.7, s));
    p = mix(p, lg, smooth(21.9, 22.6, s));
    p = mix(p, [0, 0, 0], smooth(23.3, 24.2, s));
    return p;
  }

  /* ═════════════════════ camadas que dependem do catálogo ═════════════════════ */
  lgLayer(lg) {
    const items = [], objs = [];
    for (const g of lg) {
      const [name, x, y, z, d, vh, Mv, PA, e, rh, MHI, feh, amb, ra, dec] = g;
      if (['LMC', 'SMC', 'Triangulum'].includes(name)) { objs.push(this._lgObj(g)); continue; }
      const r = Math.max(rh || 200, 60) / 1000 * 2.2; /* kpc: ~2× raio de meia-luz */
      /* brilho superficial: luminosidade / área (as anãs esferoidais são quase invisíveis) */
      const lum = Mv == null ? 0.05 : clamp(Math.pow(10, -0.4 * (Mv + 14)) / (r * r) * 0.35, 0.015, 1.4);
      const [a1, a2] = diskAxes(ra, dec, PA || 0, 1 - (e || 0), r);
      items.push({ pos: [x, y, z], ax1: a1, ax2: a2, col: [1.0, 0.85, 0.66, lum], tex: -1 });
      objs.push(this._lgObj(g));
    }
    const layer = createImpostorLayer(this.engine, { id: 'lg', name: 'Galáxias do Grupo Local', kind: 'obs', source: 'McConnachie 2012 (AJ 144, 4), atualização de 2019 — posições, distâncias e raios', range: [19.6, 24.4], unit: KPC, items, minPx: 2.2 });
    layer.objs = objs;
    layer.labels = (ctx, out, op) => {
      for (const o of objs) {
        const d = this.engine.distTo(o.getPos());
        if (d > ctx.R * 4) continue;
        const big = ['Triangulum', 'LMC', 'SMC', 'M32', 'NGC205', 'NGC6822', 'IC1613', 'SagittariusdSph', 'Fornax', 'Sculptor', 'NGC3109', 'NGC55', 'NGC300'].includes(o.lgName);
        if (!big && ctx.s > 22.3) continue;
        out.push({ text: o.name, pos: o.getPos(), prio: big ? 45 : 20, obj: o, cls: 'is-gal', alpha: op });
      }
    };
    layer.pick = (ctx, x, y) => this.engine.pickNear(objs, x, y, 12);
    return layer;
  }
  _lgObj(g) {
    const [name, x, y, z, d, vh, Mv, PA, e, rh, MHI, feh, amb] = g;
    const pretty = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/(\D)(\d+)$/, '$1 $2').replace(/\((\d+)\)/, ' $1').replace(/dSph$/, ' (anã esferoidal)').replace(/dIrr$/, ' (anã irregular)').replace('Andromeda ', 'Andrómeda ').replace(/^Triangulum$/, 'Galáxia do Triângulo');
    return { id: 'lg:' + name, lgName: name, name: pretty.trim(), cat: amb ? 'Galáxia anã ou enxame (natureza incerta)' : 'Galáxia do Grupo Local', kind: 'obs', layer: 'lg', lg: { dkpc: d, vh, Mv, rh, MHI, feh }, view: Math.log10(Math.max(rh || 300, 300) * PC * 30), getPos: () => [x * KPC, y * KPC, z * KPC] };
  }
  namedGalaxyLayer(gal) {
    const curatedByRc3 = new Map(this.cat.objects.filter(o => o.rc3).map(o => [o.rc3, o]));
    const items = [], objs = [];
    for (const g of gal) {
      const [name, alt, x, y, z, d, , T, diamKpc, ba, pa, bt, ra, dec, v, morph, d25am] = g;
      const cur = curatedByRc3.get(name);
      if (!cur && !(v > 1500)) continue;
      const dMpc = cur ? cur.pos.mpc : d;
      const pos = radec(ra, dec, dMpc * 1000); /* kpc */
      const rKpc = d25am ? dMpc * 1000 * (d25am / 60 * D2R) / 2 : Math.max(diamKpc / 2, 3);
      const tile = typeTile(T, morph);
      const [a1, a2] = tile < 0 ? [[rKpc * 0.8, 0, 0], [0, rKpc * 0.8 * Math.max(ba, 0.4), 0]] : diskAxes(ra, dec, pa, ba, rKpc);
      items.push({ pos, ax1: a1, ax2: a2, col: tile < 0 ? [1.0, 0.8, 0.6, 0.9] : [1, 1, 1, 1.1], tex: tile });
      const o = { id: cur ? cur.id : 'rc3:' + name, name: cur ? cur.n : name, aka: [name, ...alt.split(' · ')], cat: cur?.cat || morphName(T, morph), kind: 'obs', layer: 'named', rc3: { T, morph, ba, pa, bt, v, diamKpc: rKpc * 2, dSrc: cur ? 'curated' : 'z' }, view: Math.log10(rKpc * KPC * 9), getPos: () => [pos[0] * KPC, pos[1] * KPC, pos[2] * KPC], r: rKpc * KPC };
      objs.push(o);
    }
    const layer = createImpostorLayer(this.engine, { id: 'named', name: 'Galáxias brilhantes (RC3)', kind: 'obs', source: 'Third Reference Catalogue of Bright Galaxies (de Vaucouleurs et al. 1991) — orientação e diâmetro medidos; imagem = tipo genérico', range: [21.7, 25.6], unit: KPC, items, minPx: 1.8 });
    layer.objs = objs;
    layer.labels = (ctx, out, op) => {
      for (const o of objs) {
        const d = this.engine.distTo(o.getPos());
        const cur = !o.id.startsWith('rc3:');
        if (d > ctx.R * (cur ? 6 : 1.4) || (!cur && ctx.s > 24)) continue;
        out.push({ text: o.name, pos: o.getPos(), prio: cur ? 48 : 14, obj: o, cls: 'is-gal', alpha: op });
      }
    };
    layer.pick = (ctx, x, y) => this.engine.pickNear(objs, x, y, 10);
    return layer;
  }
  curatedLabelLayer() {
    const self = this;
    return {
      id: 'curated', name: 'Estruturas com nome', kind: 'obs', labelsOn: true,
      labels(ctx, out, op) {
        for (const o of self.cat.objects) {
          const ob = self.byId.get(o.id); if (!ob || ob.layer === 'stars' || PLANETS.has(o.id)) continue;
          const v = ob.view ?? 20, gal = /Galáxia|galáxia/.test(o.cat || '');
          if (ctx.s < v - 1.6 || ctx.s > v + (gal ? 2.1 : 1.3)) continue;
          if (o.pos.origin) continue;
          out.push({ text: o.n, pos: ob.getPos(), prio: 60, obj: ob, cls: 'is-struct', alpha: op });
        }
      },
      pick(ctx, x, y) { return self.engine.pickNear([...self.byId.values()].filter(o => o.cur && o.layer !== 'stars' && !PLANETS.has(o.id) && !o.cur.pos.origin && Math.abs(ctx.s - (o.view ?? 20)) < 1.6), x, y, 14); },
    };
  }

  /* ═════════════════════ catálogo ═════════════════════ */
  buildCatalog(mw, gd) {
    const L = this.layers, add = o => { if (!o || !o.id || this.byId.has(o.id)) return; this.byId.set(o.id, o); this.index.push(o); };
    /* curados */
    for (const c of this.cat.objects) {
      const o = { id: c.id, name: c.n, aka: c.aka || [], cat: c.cat, kind: c.kind, cur: c, r: c.r, view: c.view, layer: 'curated', link: c.link };
      const P = c.pos;
      if (P.body) { o.getPos = jd => bodyPos(P.body, jd ?? this.engine.time.jd); o.layer = 'solar'; o.r = o.r || L.solar.objs[P.body]?.r; if (o.view == null) o.view = P.body === 'sun' ? 12.85 : Math.log10((c.r || 1e7) * 6); }
      else if (P.star || P.gl) { const s = P.star ? L.stars.findHR(P.star) : L.stars.findGl(P.gl); if (!s) continue; o.getPos = s.getPos; o.star = s.star; o.view = o.view ?? 16.6; o.layer = 'stars'; }
      else if (P.exo) { o.pending = 'exo'; o.exoName = P.exo; o.getPos = () => this._exoPos(o); o.view = o.view ?? 16.6; }
      else if (P.gc) { const g = mw.gcs.find(x => x[0] === P.gc); if (!g) continue; const p = [g[2] * KPC, g[3] * KPC, g[4] * KPC]; o.getPos = () => p; o.view = o.view ?? 19.1; o.gc = { feh: g[5], mv: g[6] }; }
      else if (P.lg) { const g = gd.lg.find(x => x[0] === P.lg); if (!g) continue; const p = [g[1] * KPC, g[2] * KPC, g[3] * KPC]; o.getPos = () => p; o.lg = this._lgObj(g).lg; }
      else if (P.origin) { o.getPos = () => [0, 0, 0]; o.noFocus = false; }
      else {
        const d = P.ly ? P.ly * LY : P.kpc ? P.kpc * KPC : P.mpc ? P.mpc * MPC : P.z != null ? comovingMpc(P.z) * MPC : 0;
        const p = radec(P.ra, P.dec, d); o.getPos = () => p; if (P.z != null) o.z = P.z;
        if (o.view == null) o.view = Math.log10(Math.max(d * 0.05, (c.r || 0) * 4, 1e15));
      }
      add(o);
    }
    for (const id of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon']) if (this.byId.get(id)) this.byId.get(id).view = Math.log10(L.solar.objs[id].r * 7);
    this.byId.get('earth').view = 7.45;
    /* estrelas com nome, enxames, Grupo Local, galáxias RC3, Abell */
    for (const s of L.stars.objs) if (!s.lite) add(s);
    for (const g of L.tracers.objs.gcs) add(g);
    for (const g of L.tracers.objs.ocs) add(g);
    for (const g of L.lg.objs) add(g);
    for (const g of L.named.objs) add(g);
    L.clusters.load().then(() => L.clusters.objs.forEach(add));
    /* exoplanetas e pequenos corpos: só quando forem pedidos (pesquisa / camada) */
    this._ensureExo = () => L.exo.load().then(() => L.exo.objs.forEach(add));
    L.small.load().then(() => {
      for (const [i, name, H, cls] of L.small.named) add({ id: 'sb:' + name, name, cat: cls === 'TNO' ? 'Objeto transneptuniano' : cls === 'TJN' ? 'Asteroide troiano' : 'Asteroide', kind: 'obs', layer: 'smallbody', sb: { H, cls }, view: 10.6, getPos: jd => L.small.posOf(i, jd ?? this.engine.time.jd) });
      L.small.craftObjs.forEach(c => { c.view = 13.4; add(c); });
    });
  }
  _exoPos(o) { const h = this.layers.exo.find(o.exoName); return h ? h.getPos() : [0, 0, 0]; }

  /* ═════════════════════ interface ═════════════════════ */
  buildUI() {
    const $ = this.$;
    /* régua das escalas */
    const rail = $('.uv-rail-track');
    const pct = s => (1 - (s - S_MIN) / (S_MAX - S_MIN)) * 100;
    const TICK = { 7: '10 000 km', 9: '1 milhão de km', 11: '0,7 UA', 13: '67 UA', 16: '0,1 ano-luz', 18: '106 anos-luz', 20: '10 600 a.-l.', 22: '1 milhão a.-l.', 24: '106 milhões a.-l.', 26: '10,6 mil milhões a.-l.' };
    let ticks = '';
    /* o texto de um risco cede o lugar ao nome de um nível que lhe fique em cima */
    const free = s => !this.cat.levels.some(l => Math.abs(l.s - s) < 0.6);
    for (let s = 7; s <= 27; s++) ticks += `<span class="uv-tick${TICK[s] ? ' is-major' : ''}" style="top:${pct(s)}%"><i>10<sup>${s}</sup> m</i>${TICK[s] && free(s) ? `<em>${TICK[s]}</em>` : ''}</span>`;
    rail.insertAdjacentHTML('beforeend', ticks);
    $('.uv-levels').innerHTML = this.cat.levels.map((l, i) => `<button type="button" class="uv-level" data-i="${i}" style="top:${pct(l.s)}%"><b>${esc(l.n)}</b></button>`).join('');
    $('.uv-levels').addEventListener('click', e => { const b = e.target.closest('.uv-level'); if (b) this.goLevel(+b.dataset.i); });
    $('.uv-chips').innerHTML = this.cat.levels.map((l, i) => `<button type="button" class="chip uv-chip" data-i="${i}">${esc(l.n)}</button>`).join('');
    $('.uv-chips').addEventListener('click', e => { const b = e.target.closest('.uv-chip'); if (b) this.goLevel(+b.dataset.i); });
    /* arrastar na régua = escolher a escala */
    const knob = $('.uv-knob');
    const setFromY = y => { const r = rail.getBoundingClientRect(); const t = clamp((y - r.top) / r.height, 0, 1); this.engine.cancelFlight(); this.engine.sT = S_MAX - t * (S_MAX - S_MIN); this.engine.invalidate(); };
    rail.addEventListener('pointerdown', e => { if (e.target.closest('.uv-level')) return; rail.setPointerCapture(e.pointerId); setFromY(e.clientY); const mv = ev => setFromY(ev.clientY); rail.addEventListener('pointermove', mv); rail.addEventListener('pointerup', () => rail.removeEventListener('pointermove', mv), { once: true }); });
    knob.addEventListener('keydown', e => { const d = { ArrowUp: 0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key]; if (d) { e.preventDefault(); this.engine.cancelFlight(); this.engine.sT = clamp(this.engine.sT + d, S_MIN, S_MAX); this.engine.invalidate(); } });

    /* pesquisa */
    const inp = $('.uv-search input'), list = $('.uv-results');
    let sel = -1, cur = [];
    const render = () => { list.innerHTML = cur.map((o, i) => `<li role="option" id="uvr-${i}" aria-selected="${i === sel}" data-i="${i}"><b>${esc(o.name)}</b><small>${esc(o.cat || '')}${o.aka?.length ? ' · ' + esc(o.aka.filter(Boolean).slice(0, 2).join(', ')) : ''}</small></li>`).join(''); list.hidden = !cur.length; inp.setAttribute('aria-expanded', String(!!cur.length)); inp.setAttribute('aria-activedescendant', sel >= 0 ? 'uvr-' + sel : ''); };
    inp.addEventListener('focus', () => this._ensureExo?.(), { once: true });
    inp.addEventListener('input', () => { cur = this.search(inp.value); sel = cur.length ? 0 : -1; render(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(cur.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter' && cur[sel]) { this.select(cur[sel], { fly: true }); inp.value = ''; cur = []; render(); inp.blur(); }
      else if (e.key === 'Escape') { inp.value = ''; cur = []; render(); }
    });
    list.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); this.select(cur[+li.dataset.i], { fly: true }); inp.value = ''; cur = []; render(); inp.blur(); } });
    inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));

    /* botões do topo */
    const pop = name => { for (const p of ['tours', 'layers', 'compare', 'about']) { const el = $('.uv-pop-' + p); const open = p === name && el.hidden; el.hidden = !open; $(`[data-pop="${p}"]`)?.setAttribute('aria-expanded', String(open)); } if (name === 'compare') this.renderCompare(); if (name === 'layers') this.renderLayers(); };
    this.pop = pop;
    this.root.querySelectorAll('[data-pop]').forEach(b => b.addEventListener('click', () => pop(b.dataset.pop)));
    this.root.querySelectorAll('.uv-pop .uv-x').forEach(b => b.addEventListener('click', () => pop(null)));
    $('.uv-pop-tours .uv-tour-list').innerHTML = this.cat.tours.map(t => `<li><button type="button" class="uv-tour-btn" data-t="${t.id}"><b>${esc(t.n)}</b><small>${esc(t.d)} · ${t.steps.length} passos</small></button></li>`).join('');
    $('.uv-pop-tours').addEventListener('click', e => { const b = e.target.closest('.uv-tour-btn'); if (b) { pop(null); this.startTour(b.dataset.t); } });
    $('.uv-tour .uv-tour-prev').onclick = () => this.tourStep(-1);
    $('.uv-tour .uv-tour-next').onclick = () => this.tourStep(1);
    $('.uv-tour .uv-tour-stop').onclick = () => this.endTour();
    $('.uv-panel .uv-x').onclick = () => this.closePanel();
    this.root.querySelectorAll('.uv-metric button').forEach(b => b.addEventListener('click', () => { this.metric = b.dataset.m; this.renderCompare(); }));
    /* tempo */
    let sp = 0;
    $('.uv-time-play').onclick = () => { sp = (sp + 1) % SPEEDS.length; this.engine.time.speed = SPEEDS[sp]; $('.uv-time-play').textContent = SPEED_TXT[sp]; $('.uv-time-play').setAttribute('aria-pressed', String(sp > 0)); };
    $('.uv-time-now').onclick = () => { this.engine.time.jd = Date.now() / 86400000 + 2440587.5; sp = 0; this.engine.time.speed = 0; $('.uv-time-play').textContent = SPEED_TXT[0]; this.engine.invalidate(); };
    /* teclado: Escape fecha */
    this._onKey = e => { if (e.key === 'Escape' && this.root.isConnected) { if (this.tour) this.endTour(); else if (!this.$('.uv-panel').hidden) this.closePanel(); else pop(null); } };
    window.addEventListener('keydown', this._onKey);
    this._vis = new IntersectionObserver(([en]) => { if (this.engine && !this._stopped) this.engine.setPaused(!en.isIntersecting); });
    this._vis.observe(this.root);
  }

  goLevel(i) {
    const l = this.cat.levels[i];
    const f = l.focus === 'origin' ? { id: 'origin', getPos: () => [0, 0, 0], noFocus: true } : this.byId.get(l.focus);
    this.engine.focus(f, { s: l.s, pitch: i >= 3 ? 0.62 : undefined });
    this.closePanel();
  }

  search(q) {
    const n = norm(q); if (n.length < 2) return [];
    const res = [];
    for (const o of this.index) {
      const names = [o.name, ...(o.aka || [])].filter(Boolean).map(norm);
      let sc = 0;
      for (const nm of names) { if (nm === n) sc = Math.max(sc, 100); else if (nm.startsWith(n)) sc = Math.max(sc, 60 - nm.length * 0.1); else if (nm.includes(' ' + n)) sc = Math.max(sc, 48); else if (nm.includes(n)) sc = Math.max(sc, 20); }
      /* objetos com ficha curada passam à frente de homónimos de catálogo (Andrómeda ≠ Andrómeda I) */
      if (sc) res.push([sc + (o.cur ? 26 : 0) + (o.named ? 6 : 0), o]);
    }
    return res.sort((a, b) => b[0] - a[0]).slice(0, 9).map(r => r[1]);
  }

  onPick(o, info = {}) {
    if (!o) { if (!info.label) this.closePanel(); return; }
    this.select(o, { fly: !!info.dbl });
  }

  select(o, { fly = false } = {}) {
    if (o.pending === 'exo' && !this.layers.exo.find(o.exoName)) { this._ensureExo().then(() => this.select(o, { fly })); return; }
    this.selected = o;
    if (fly) this.engine.focus(o, { s: o.view ?? this.engine.s });
    this.renderPanel(o);
    if (!o.point && !/^(star\d|abell|maser|oc:|sb:)/.test(o.id)) history.replaceState(null, '', '#explorer/universe/' + o.id);
  }

  closePanel() { this.$('.uv-panel').hidden = true; this.selected = null; this.root.classList.remove('has-panel'); }

  /* ── painel de informação ── */
  renderPanel(o) {
    const E = this.engine, jd = E.time.jd, p = o.getPos(jd), earth = bodyPos('earth', jd);
    const dE = Math.hypot(p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]);
    const c = o.cur || {};
    const [kTxt, kCls] = KIND[o.kind] || KIND.obs;
    const rows = [];
    const row = (k, v) => rows.push(`<div class="uv-row"><dt>${k}</dt><dd>${v}</dd></div>`);
    const z = o.z;
    if (o.id !== 'earth') {
      if (z != null) {
        const dc = comovingMpc(z) * MPC, lb = lookbackGyr(z);
        row('Redshift', `z = ${sig(z, 3)}`);
        row('Distância (comóvel)', `${fmtDist(dc)} <small>· ${sig(dc / MPC, 3)} Mpc</small>`);
        row('A luz partiu há', `${sig(lb, 3)} mil milhões de anos <small>(o Universo tinha ${sig(13.79 - lb, 3)} mil M anos)</small>`);
      } else if (!o.pos?.origin && !c.pos?.origin) {
        row('Distância à Terra', distLines(dE).map((t, i) => i ? `<small>${t}</small>` : t).join('<br>'));
        row('A luz demora', fmtLightTime(dE));
      }
    }
    if (o.star) {
      const s = o.star, T = bvToKelvin(s.bv);
      if (s.sp) row('Tipo espectral', esc(s.sp));
      row('Temperatura', `~${words(Math.round(T / 100) * 100)} K`);
      row('Magnitude (da Terra)', `${sig(s.V, 3)} <small>${s.V < 6.5 ? 'visível a olho nu' : 'precisa de binóculos ou telescópio'}</small>`);
      row('Luminosidade visual', `${sig(Math.pow(10, -0.4 * (s.mv - 4.83)), 2)} × Sol`);
      row('Distância medida por', SRC_TXT[s.src] || '—');
    }
    if (o.exo) {
      row('Temperatura da estrela', o.exo.teff ? `${words(o.exo.teff)} K` : '—');
      const M = o.exo.methods, inv = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
      const METH = { Transit: 'trânsito', 'Radial Velocity': 'velocidade radial', Imaging: 'imagem direta', Microlensing: 'microlente', 'Transit Timing Variations': 'variação dos trânsitos', 'Pulsar Timing': 'pulsar', Astrometry: 'astrometria' };
      rows.push(`<table class="uv-planets"><caption>Planetas conhecidos</caption><thead><tr><th>Planeta</th><th>Raio</th><th>Período</th><th>Descoberta</th></tr></thead><tbody>${o.exo.planets.map(pl => `<tr><td>${esc(pl[0])}</td><td>${pl[1] ? sig(pl[1], 2) + ' R⊕' : pl[2] ? '≈' + sig(pl[2], 2) + ' M⊕' : '—'}</td><td>${pl[3] ? (pl[3] < 2 ? sig(pl[3] * 24, 3) + ' h' : sig(pl[3], 3) + ' d') : '—'}</td><td>${pl[5] || '—'} <small>${METH[inv[pl[6]]] || ''}</small></td></tr>`).join('')}</tbody></table>`);
    }
    if (o.gc) { row('Metalicidade [Fe/H]', sig(o.gc.feh, 2) + ' <small>(muito pobre em metais = muito antigo)</small>'); row('Magnitude absoluta', sig(o.gc.mv, 3)); }
    if (o.oc && o.oc.logAge) row('Idade', `${words(Math.pow(10, o.oc.logAge) / 1e6, 2)} milhões de anos`);
    if (o.maser) { row('Braço', ({ Per: 'Perseu', Loc: 'Local', SgN: 'Sagitário-Carena (norte)', SgS: 'Sagitário-Carena (sul)', ScN: 'Escudo-Centauro (norte)', ScS: 'Escudo-Centauro (sul)', Out: 'Exterior', OSC: 'Exterior-Escudo-Centauro', Nor: 'Norma', CtN: 'Escudo-Centauro', CrN: 'Carena', LoS: 'Local (esporão)', AqS: 'Esporão de Áquila', '3kN': '3 kpc (perto)', '3kF': '3 kpc (longe)', GC: 'Centro galáctico' })[o.maser.arm] || o.maser.arm); row('Erro da paralaxe', `${Math.round(o.maser.err * 100)}%`); }
    if (o.lg) { if (o.lg.Mv != null) row('Magnitude absoluta', sig(o.lg.Mv, 3)); if (o.lg.rh) row('Raio de meia-luz', `${words(o.lg.rh * 3.2616)} anos-luz`); if (o.lg.vh != null) row('Velocidade radial', `${o.lg.vh > 0 ? '+' : ''}${sig(o.lg.vh, 3)} km/s <small>${o.lg.vh < 0 ? '(aproxima-se do Sol)' : '(afasta-se do Sol)'}</small>`); }
    if (o.rc3) {
      row('Tipo (RC3)', esc(morphName(o.rc3.T, o.rc3.morph)) + (o.rc3.morph ? ` <small>${esc(o.rc3.morph.replace(/\./g, '').trim())}</small>` : ''));
      row('Diâmetro (isofota D25)', `${words(o.rc3.diamKpc * 3261.6)} anos-luz`);
      row('Velocidade de recessão', `${words(o.rc3.v)} km/s`);
      row('Distância', o.rc3.dSrc === 'curated' ? 'medição moderna (cefeides, TRGB ou masers)' : 'pelo redshift e a lei de Hubble (±10–20%)');
    }
    if (o.sb) row('Magnitude absoluta H', sig(o.sb.H, 3));
    if (o.point) row('Levantamento', esc(o.survey));
    const size = c.r || (o.layer === 'solar' ? o.r : null);
    if (size) row('Diâmetro', `${fmtDist(2 * size)}`);
    if (c.m || c.msun) row('Massa', fmtMass(c.m || c.msun * MSUN));
    const facts = (c.f || []).map(f => `<li>${esc(f)}</li>`).join('');
    const extra = o.point ? `<p class="uv-note">Cada ponto é uma galáxia medida. A distância vem do redshift; dentro dos enxames, o movimento das galáxias estica-os ao longo da linha de visão ("dedos de Deus").</p>` : '';
    const link = c.link && LINK[c.link] ? `<a class="btn btn-sm" href="#${LINK[c.link][0]}">${LINK[c.link][1]}</a>` : '';
    const inCmp = this.compare.includes(o.id);
    this.$('.uv-panel-body').innerHTML = `
      <header><span class="uv-kind ${kCls}">${kTxt}</span><h2>${esc(o.name)}</h2><p class="uv-cat">${esc(o.cat || '')}</p></header>
      <dl class="uv-rows">${rows.join('')}</dl>
      ${facts ? `<ul class="uv-facts">${facts}</ul>` : ''}${extra}
      ${c.d ? `<p class="uv-disc"><b>Descoberta:</b> ${esc(c.d)}</p>` : ''}
      <p class="uv-src"><b>Fonte:</b> ${esc(c.src || this.layerSource(o))}</p>
      <div class="uv-actions"><button type="button" class="btn btn-primary btn-sm uv-go">Ir até lá</button>${o.cur ? `<button type="button" class="btn btn-sm uv-cmp" aria-pressed="${inCmp}">${inCmp ? '✓ Na comparação' : '+ Comparar'}</button>` : ''}${link}</div>`;
    this.$('.uv-panel').hidden = false; this.root.classList.add('has-panel');
    this.$('.uv-go').onclick = () => this.engine.focus(o, { s: o.view ?? this.engine.s });
    const cb = this.$('.uv-cmp'); if (cb) cb.onclick = () => { const i = this.compare.indexOf(o.id); if (i >= 0) this.compare.splice(i, 1); else this.compare.push(o.id); this.renderPanel(o); if (!this.$('.uv-pop-compare').hidden) this.renderCompare(); };
  }
  layerSource(o) { const L = Object.values(this.layers).find(l => l.id === o.layer); return L?.source || 'ver Créditos'; }

  /* ── comparação (escala logarítmica, assumida) ── */
  renderCompare() {
    const E = this.engine, jd = E.time.jd, earth = bodyPos('earth', jd);
    const items = this.compare.map(id => this.byId.get(id)).filter(Boolean).map(o => {
      const c = o.cur || {};
      const p = o.getPos(jd);
      let v = null;
      if (this.metric === 'size') v = c.r ? 2 * c.r : null;
      else if (this.metric === 'mass') v = c.m || (c.msun ? c.msun * MSUN : null);
      else v = o.id === 'earth' ? null : c.pos?.origin ? (c.r || null) : Math.hypot(p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]);
      return { o, v };
    }).filter(x => x.v > 0).sort((a, b) => a.v - b.v);
    const box = this.$('.uv-compare-chart');
    this.root.querySelectorAll('.uv-metric button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === this.metric)));
    if (items.length < 2) { box.innerHTML = '<p class="uv-note">Junta pelo menos dois objetos com este valor conhecido (botão "+ Comparar" no painel de cada objeto).</p>'; return; }
    const lo = Math.floor(Math.log10(items[0].v)), hi = Math.ceil(Math.log10(items.at(-1).v));
    const W = 410, rowH = 26, pad = 126, H = items.length * rowH + 34;
    const x = v => pad + (Math.log10(v) - lo) / (hi - lo) * (W - pad - 10);
    const fmtV = v => this.metric === 'mass' ? fmtMass(v) : fmtDist(v);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparação em escala logarítmica">`;
    const step = Math.max(1, Math.ceil((hi - lo) / 8));
    for (let k = lo; k <= hi; k += step) svg += `<line x1="${x(10 ** k)}" x2="${x(10 ** k)}" y1="4" y2="${H - 22}" class="uv-grid"/><text x="${x(10 ** k)}" y="${H - 8}" class="uv-axis">10<tspan dy="-5" font-size="8">${k}</tspan></text>`;
    items.forEach((it, i) => {
      const y = 8 + i * rowH;
      svg += `<text x="${pad - 8}" y="${y + 13}" class="uv-bar-name" text-anchor="end">${esc(it.o.name.length > 16 ? it.o.name.slice(0, 15).trim() + '…' : it.o.name)}</text><rect x="${pad}" y="${y + 3}" width="${Math.max(2, x(it.v) - pad)}" height="14" rx="3" class="uv-bar"/><text x="${Math.min(x(it.v) + 6, W - 4)}" y="${y + 14}" class="uv-bar-val" ${x(it.v) > W - 110 ? 'text-anchor="end" dx="-12" fill="#111"' : ''}>${esc(fmtV(it.v))}</text>`;
    });
    svg += '</svg>';
    const a = items.at(-1), b = items[0];
    box.innerHTML = svg + `<p class="uv-note">Escala logarítmica: cada divisão vale ×${step === 1 ? 10 : '10<sup>' + step + '</sup>'} ${this.metric === 'mass' ? '(kg)' : '(metros)'}. ${{ size: 'Do menor ao maior', mass: 'Do mais leve ao mais maciço', dist: 'Do mais perto ao mais longe' }[this.metric] || 'Do primeiro ao último'} (${esc(b.o.name)} → ${esc(a.o.name)}): ~${words(a.v / b.v, 2)} vezes.</p>
      <ul class="uv-cmp-list">${this.compare.map(id => this.byId.get(id)).filter(Boolean).map(o => `<li>${esc(o.name)} <button type="button" class="uv-cmp-rm" data-id="${o.id}" aria-label="Retirar ${esc(o.name)}">×</button></li>`).join('')}</ul>`;
    box.querySelectorAll('.uv-cmp-rm').forEach(btn => btn.onclick = () => { this.compare = this.compare.filter(i => i !== btn.dataset.id); this.renderCompare(); });
  }

  /* ── camadas ── */
  renderLayers() {
    const L = this.layers;
    const rows = [
      ['solar', L.solar], ['small', L.small], ['helio', L.helio], ['oort', L.oort], ['stars', L.stars], ['cons', null, 'Figuras das constelações', 'calc'], ['src', null, 'Cor das estrelas pela origem da distância', 'calc'], ['exo', L.exo],
      ['volume', L.volume], ['tracers', L.tracers], ['lg', L.lg], ['named', L.named], ['zcat', L.zcat], ['clusters', L.clusters], ['sdss', L.sdss], ['deep', L.deep], ['rings', L.rings], ['cmb', L.cmb],
    ];
    this.$('.uv-layer-list').innerHTML = rows.map(([k, lay, nm, kind]) => {
      const on = k === 'cons' ? L.stars.consOn : k === 'src' ? !!L.stars.srcMode : lay.enabled;
      const [kt, kc] = KIND[kind || lay.kind] || KIND.obs;
      return `<li><label><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span><b>${esc(nm || lay.name)}</b><small>${esc(lay?.source || '')}</small></span><em class="uv-kind ${kc}">${kt}</em></label></li>`;
    }).join('');
    this.$('.uv-layer-list').onchange = e => {
      const k = e.target.dataset.k, on = e.target.checked;
      if (k === 'cons') L.stars.consOn = on; else if (k === 'src') L.stars.srcMode = on;
      else { const lay = L[k]; lay.enabled = on; if (k === 'exo' && on) this._ensureExo(); }
      this.engine.invalidate();
    };
  }

  /* ── viagens ── */
  startTour(id) {
    const t = this.cat.tours.find(x => x.id === id); if (!t) return;
    this.tour = { t, i: -1 };
    this.closePanel();
    this.$('.uv-tour').hidden = false; this.root.classList.add('in-tour');
    this.$('.uv-tour-title').textContent = t.n;
    this.tourStep(1);
  }
  tourStep(d) {
    const T = this.tour; if (!T) return;
    T.i = clamp(T.i + d, 0, T.t.steps.length - 1);
    const st = T.t.steps[T.i];
    const o = st.go === 'origin' ? { id: 'origin', getPos: () => [0, 0, 0], noFocus: true } : this.byId.get(st.go);
    if (T.t.id === 'parallax' && T.i === 3) this.layers.stars.srcMode = true;
    if (o) { this.$('.uv-tour').classList.add('is-flying'); this.engine.focus(o, { s: st.s, pitch: st.pitch }); }
    this.$('.uv-tour-text').textContent = st.t;
    this.$('.uv-tour-count').textContent = `${T.i + 1} / ${T.t.steps.length}`;
    this.$('.uv-tour-prev').disabled = T.i === 0;
    this.$('.uv-tour-next').textContent = T.i === T.t.steps.length - 1 ? 'Terminar' : 'Seguinte';
    if (d > 0 && T.i === T.t.steps.length - 1 && T._last) this.endTour();
    T._last = T.i === T.t.steps.length - 1;
  }
  endTour() { this.tour = null; this.$('.uv-tour').hidden = true; this.root.classList.remove('in-tour'); this.layers.stars.srcMode = false; }

  /* ── HUD por frame ── */
  onFrame(ctx) {
    if (!this.ready) return;
    const $ = this.$;
    /* rótulos 3D não nascem por baixo da régua, do HUD, da legenda nem do painel */
    this._bf = (this._bf || 0) + 1;
    if (this._bf % 20 === 1) {
      const cr = this.engine.canvas.getBoundingClientRect();
      this.engine.blocked = [...this.root.querySelectorAll('.uv-rail, .uv-hud, .uv-legend, .uv-top, .uv-panel, .uv-tour')].filter(el => !el.hidden && el.offsetParent).map(el => { const r = el.getBoundingClientRect(); return { x0: r.left - cr.left, y0: r.top - cr.top, x1: r.right - cr.left, y1: r.bottom - cr.top }; });
    }
    const knob = $('.uv-knob');
    const t = (1 - (ctx.s - S_MIN) / (S_MAX - S_MIN)) * 100;
    knob.style.top = t + '%';
    knob.setAttribute('aria-valuenow', ctx.s.toFixed(2));
    knob.setAttribute('aria-valuetext', `Distância da câmara ao foco: ${fmtDist(ctx.R)}`);
    /* nível atual */
    const lv = this.cat.levels.findIndex(l => ctx.s >= l.range[0] && ctx.s < l.range[1]);
    /* a frase do nível só fala do que se vê quando o foco é o desse nível (perto de Andrómeda não se descreve a Via Láctea) */
    const fo = this.engine.focusObj, l = this.cat.levels[lv];
    const own = !!l && (!fo || fo.id === l.focus || fo.id === 'sun' || fo.id === 'earth' && l.id === 'earth');
    if (lv !== this._lv || own !== this._own) {
      this._lv = lv; this._own = own;
      this.root.querySelectorAll('.uv-level, .uv-chip').forEach(b => b.classList.toggle('is-on', +b.dataset.i === lv));
      $('.uv-level-name').textContent = l ? (own ? l.n : 'Escala: ' + l.n) : '';
      $('.uv-level-hint').textContent = l && own ? l.hint : '';
    }
    /* barra de escala (linear, no plano do foco) */
    const mpp = 2 * ctx.R * Math.tan(25 * D2R) / ctx.h;
    const nl = niceLength(mpp * 130);
    const px = nl.meters / mpp;
    $('.uv-scalebar i').style.width = px.toFixed(1) + 'px';
    $('.uv-scalebar b').textContent = nl.text;
    $('.uv-fov').textContent = `Largura do ecrã ≈ ${fmtDist(mpp * ctx.w, 2)}`;
    /* avisos de representação */
    const notes = [];
    if (ctx.s > 9.9 && ctx.s < 14.8) notes.push('Planetas: marcadores maiores do que o tamanho real');
    if (ctx.s > 16.6 && ctx.s < 20.4) notes.push('Brilho das estrelas realçado para se verem de longe');
    if (ctx.s > 19.2 && ctx.s < 23.8) notes.push('Discos galácticos: modelo, não fotografia');
    if (ctx.s > 21.8 && ctx.s < 25.6) notes.push('Galáxias pequenas desenhadas com tamanho mínimo');
    if (ctx.s > 23.8) notes.push('Distâncias pelo redshift; cunhas = zona do céu observada');
    const nt = notes.join(' · ');
    if (nt !== this._nt) { this._nt = nt; $('.uv-notes').textContent = nt; $('.uv-notes').hidden = !nt; }
    /* camadas visíveis e a sua natureza */
    const vis = Object.values(this.layers).filter(L => L.opacity > 0.3 && L.kind && L.id !== 'curated' && L.id !== 'rings');
    const key = vis.map(L => L.id).join();
    if (key !== this._legKey) {
      this._legKey = key;
      $('.uv-legend').innerHTML = vis.map(L => { const [kt, kc] = KIND[L.kind]; return `<li><em class="uv-kind ${kc}">${kt}</em>${esc(L.name)}</li>`; }).join('');
    }
    /* tempo (só no Sistema Solar) */
    const showT = ctx.s < 14.8;
    if (showT !== this._showT) { this._showT = showT; $('.uv-time').hidden = !showT; }
    if (showT) { const d = new Date((ctx.jd - 2440587.5) * 86400000); const ds = d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }); if (ds !== this._ds) { this._ds = ds; $('.uv-time-date').textContent = ds; } }
    /* painel: distância atualizada se o tempo corre */
    if (this.selected && this.engine.time.speed && (this._pt = (this._pt || 0) + 1) % 20 === 0) this.renderPanel(this.selected);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this._vis?.disconnect();
    this.engine?.dispose();
    this.host.innerHTML = '';
  }
}

function mix(a, b, t) { return t <= 0 ? a : t >= 1 ? b : [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function morphName(T, m = '') {
  if (T <= -3.5) return 'Galáxia elíptica';
  if (T < 0.5) return 'Galáxia lenticular';
  if (T >= 9.5) return 'Galáxia irregular';
  return /B/.test(m.slice(0, 3)) ? 'Galáxia espiral barrada' : 'Galáxia espiral';
}

const TEMPLATE = `
<section class="uv" aria-label="Universo observável — exploração em 3D">
  <div class="uv-stage">
    <div class="uv-gl"></div>
    <div class="uv-top">
      <div class="uv-title"><h2>Universo observável</h2><p><span class="uv-level-name"></span><span class="uv-level-hint"></span></p></div>
      <div class="uv-search" role="combobox" aria-haspopup="listbox">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Procurar: Andrómeda, Betelgeuse, Coma…" aria-label="Procurar objetos" aria-controls="uv-results" aria-autocomplete="list" aria-expanded="false" autocomplete="off">
        <ul class="uv-results" id="uv-results" role="listbox" hidden></ul>
      </div>
      <div class="uv-actions-top">
        <button type="button" class="btn btn-sm" data-pop="tours" aria-expanded="false">Viagens</button>
        <button type="button" class="btn btn-sm" data-pop="compare" aria-expanded="false">Comparar</button>
        <button type="button" class="btn btn-sm" data-pop="layers" aria-expanded="false">Camadas</button>
        <button type="button" class="btn btn-sm btn-ghost" data-pop="about" aria-expanded="false" aria-label="Sobre os dados">ⓘ</button>
      </div>
    </div>
    <div class="uv-chips" role="group" aria-label="Escalas"></div>
    <nav class="uv-rail" aria-label="Escala">
      <div class="uv-rail-track">
        <div class="uv-levels"></div>
        <div class="uv-knob" role="slider" tabindex="0" aria-label="Escala (logarítmica)" aria-valuemin="${S_MIN}" aria-valuemax="${S_MAX}"></div>
      </div>
      <p class="uv-rail-note">Escala logarítmica: cada risco ×10</p>
    </nav>
    <div class="uv-hud">
      <div class="uv-scalebar"><i></i><b></b></div>
      <p class="uv-fov"></p>
      <p class="uv-notes" hidden></p>
      <div class="uv-time" hidden><span class="uv-time-date"></span><button type="button" class="btn btn-sm uv-time-play" aria-pressed="false">Pausa</button><button type="button" class="btn btn-sm btn-ghost uv-time-now">Hoje</button></div>
    </div>
    <ul class="uv-legend" aria-label="O que estás a ver"></ul>
    <aside class="uv-panel" hidden aria-live="polite"><button type="button" class="uv-x" aria-label="Fechar">×</button><div class="uv-panel-body"></div></aside>
    <div class="uv-pop uv-pop-tours" hidden><header><h3>Viagens</h3><button type="button" class="uv-x" aria-label="Fechar">×</button></header><ul class="uv-tour-list"></ul></div>
    <div class="uv-pop uv-pop-layers" hidden><header><h3>Camadas</h3><button type="button" class="uv-x" aria-label="Fechar">×</button></header><ul class="uv-layer-list"></ul></div>
    <div class="uv-pop uv-pop-compare" hidden><header><h3>Comparar</h3><button type="button" class="uv-x" aria-label="Fechar">×</button></header>
      <div class="seg uv-metric" role="group" aria-label="Grandeza"><button type="button" data-m="size">Tamanho</button><button type="button" data-m="dist">Distância</button><button type="button" data-m="mass">Massa</button></div>
      <div class="uv-compare-chart"></div></div>
    <div class="uv-pop uv-pop-about" hidden><header><h3>Sobre os dados</h3><button type="button" class="uv-x" aria-label="Fechar">×</button></header>
      <div class="uv-about">
        <p><b>Observado:</b> posições e distâncias medidas (estrelas, enxames, masers, galáxias, quasares, fundo cósmico). <b>Calculado:</b> obtido de medições por um modelo físico simples (órbitas, horizontes). <b>Modelo:</b> reconstrução do que não podemos fotografar (o disco da Via Láctea visto de fora). <b>Hipotético:</b> previsto mas nunca observado (Nuvem de Oort).</p>
        <p><b>Escala:</b> o zoom é logarítmico — cada risco da régua é ×10 — mas a imagem que vês em cada momento é linear: a barra de escala é verdadeira.</p>
        <p><b>Distâncias cosmológicas:</b> para galáxias distantes usa-se a distância comóvel (hoje), a partir do redshift, com ΛCDM e H₀ = 67,7 km/s/Mpc (Planck 2018). A luz viajou menos do que isso — o espaço expandiu-se pelo caminho.</p>
        <p><b>Simplificações:</b> estrelas sem paralaxe fiável têm distância estimada pelo tipo espectral; galáxias pequenas e planetas têm um tamanho mínimo no ecrã; galáxias RC3 usam uma imagem-tipo com a orientação e o tamanho medidos; não há movimento das estrelas ao longo do tempo; a heliopausa é esférica por simplificação.</p>
        <p><b>Fontes:</b> NASA HEASARC (CNS3, BSC5, Harris, Dias, Abell, ZCAT, RC3) · SDSS DR18 · NASA Exoplanet Archive · JPL SBDB e Horizons · WMAP/LAMBDA · McConnachie 2012 · Reid et al. 2019 · texturas NASA e Solar System Scope (CC BY 4.0). Pormenores em <code>data/universe/SOURCES.md</code>.</p>
      </div></div>
    <div class="uv-tour" hidden role="region" aria-label="Viagem guiada"><p class="uv-tour-title"></p><p class="uv-tour-text" aria-live="polite"></p>
      <div class="uv-tour-nav"><span class="uv-tour-count"></span><button type="button" class="btn btn-sm btn-ghost uv-tour-stop">Sair</button><button type="button" class="btn btn-sm uv-tour-prev">Anterior</button><button type="button" class="btn btn-sm btn-primary uv-tour-next">Seguinte</button></div></div>
    <div class="uv-loading"><div class="uv-spinner" aria-hidden="true"></div><p>A carregar catálogos…</p></div>
  </div>
</section>`;
