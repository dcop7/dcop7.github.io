/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — interface (Explorar › Oceano).
   mount(host) / resume() / stop(). Dados e licenças: data/ocean/SOURCES.md.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, clamp, lerp, smooth, fmt, esc, fetchJSON, fetchI16, pressureDbar, profAt, lightFrac } from './o-core.mjs';
import { ZONES, zoneAt, MARKERS, SITES, SPECIES, FEATURES, DISCOVERIES, REFS } from './o-content.mjs';
import { Engine } from './o-engine.mjs';
import { Seafloor } from './o-floor.mjs';
import { Life } from './o-life.mjs';
import { buildSub } from './o-fauna.mjs';
import { Relief } from './o-relief.mjs';
import { Sound } from './o-sound.mjs';

const SPEEDS = [{ v: 0.75, t: 'Real' }, { v: 20, t: '×25' }, { v: 160, t: '×200' }];
const RANK = { species: 'espécie', genus: 'género', family: 'família', order: 'ordem', class: 'classe', superfamily: 'superfamília' };
const MODE_TXT = { benthic: 'no fundo', nearfloor: 'junto ao fundo', fixed: 'fixo no fundo', tripod: 'pousado no fundo', bed: 'nas fontes hidrotermais', swarm: 'em enxame', surface: 'à superfície' };

let app = null;
export function mount(host) { if (app) app.dispose(); app = new App(host); window.__oc = app; return app; }
export function resume() { app?.engine?.setPaused(false); }
export function stop() { app?.engine?.setPaused(true); app?.sound?.mute(true); }

const TEMPLATE = `
<div class="oc">
  <div class="oc-stage">
    <div class="oc-gl"></div>
    <div class="oc-vign"></div>
    <div class="oc-zone" aria-live="polite"><span class="oc-zone-k"></span><strong class="oc-zone-n"></strong><span class="oc-zone-r"></span></div>
    <div class="oc-card" aria-hidden="true"><span class="oc-card-k"></span><strong class="oc-card-n"></strong><span class="oc-card-r"></span></div>
    <div class="oc-rail" role="slider" tabindex="0" aria-label="Profundidade" aria-valuemin="0" aria-valuemax="11000" aria-valuenow="0"><div class="oc-rail-track"></div><div class="oc-rail-now"><span></span></div></div>
    <dl class="oc-read"></dl>
    <div class="oc-tip" hidden></div>
    <div class="oc-hint"></div>
    <div class="oc-bar" role="toolbar" aria-label="Controlo do mergulho">
      <button type="button" class="oc-b oc-go" data-a="go" aria-pressed="false"><span class="oc-ic">▼</span><span class="oc-bt">Descer</span></button>
      <div class="oc-speed" role="group" aria-label="Velocidade">${SPEEDS.map((s, i) => `<button type="button" data-s="${i}" aria-pressed="${i === 1}">${s.t}</button>`).join('')}</div>
      <button type="button" class="oc-b" data-a="lights" aria-pressed="true" title="Faróis (L)"><span class="oc-ic">◉</span><span class="oc-bt">Faróis</span></button>
      <button type="button" class="oc-b" data-a="night" aria-pressed="false" title="Dia / noite"><span class="oc-ic">☾</span><span class="oc-bt">Noite</span></button>
      <button type="button" class="oc-b" data-a="view" aria-pressed="false" title="Ver o submersível de fora (V)"><span class="oc-ic">⬚</span><span class="oc-bt">Exterior</span></button>
      <button type="button" class="oc-b" data-a="relief" aria-pressed="false" title="Relevo do fundo (batimetria real)"><span class="oc-ic">⛰</span><span class="oc-bt">Relevo</span></button>
      <button type="button" class="oc-b" data-a="sound" aria-pressed="false" title="Som ambiente"><span class="oc-ic">♪</span><span class="oc-bt">Som</span></button>
      <button type="button" class="oc-b oc-pbtn" data-a="panel" aria-pressed="true" title="Painel de informação"><span class="oc-ic">☰</span><span class="oc-bt">Info</span></button>
    </div>
    <div class="oc-intro">
      <div class="oc-intro-in">
        <p class="oc-kicker">Explorar · Oceano profundo</p>
        <h2>Até ao fundo do mar</h2>
        <p class="oc-lead">Escolhe um mergulho. A descida passa pelas cinco zonas do oceano, com o relevo real do fundo e os animais que vivem a cada profundidade.</p>
        <div class="oc-sites">${SITES.map(s => `<button type="button" class="oc-site" data-site="${s.id}"><span class="oc-site-k">${esc(s.kind)}</span><strong>${esc(s.name)}</strong><span class="oc-site-p">${esc(s.place)}</span><span class="oc-site-d" data-d="${s.id}"></span></button>`).join('')}</div>
        <p class="oc-fine">Os animais são reconstruções ilustrativas em 3D; profundidades, temperaturas e relevo vêm de dados científicos (ver Fontes).</p>
      </div>
    </div>
    <div class="oc-loading"><p>A preparar o mergulho…</p></div>
  </div>
  <aside class="oc-panel" aria-label="Informação">
    <div class="oc-tabs" role="tablist">
      <button role="tab" data-t="here" aria-selected="true">Aqui</button>
      <button role="tab" data-t="sp" aria-selected="false">Espécie</button>
      <button role="tab" data-t="site" aria-selected="false">Local</button>
      <button role="tab" data-t="hist" aria-selected="false">Descobertas</button>
      <button role="tab" data-t="src" aria-selected="false">Fontes</button>
    </div>
    <div class="oc-pbody"></div>
  </aside>
</div>`;

class App {
  constructor(host) {
    this.host = host; host.innerHTML = TEMPLATE;
    this.root = host.querySelector('.oc'); this.$ = s => this.root.querySelector(s);
    this.speed = 1; this.auto = false; this.tab = 'here'; this.sel = null; this.zone = null; this.siteId = null;
    this.init().catch(e => { console.error('[oceano]', e); this.$('.oc-loading').innerHTML = '<p>Não foi possível carregar o Oceano.</p><button class="btn" type="button">Tentar de novo</button>'; this.$('.oc-loading').classList.add('is-on'); this.$('.oc-loading button').onclick = () => mount(host); });
  }

  async init() {
    const [sd, taxa] = await Promise.all([fetchJSON('/data/ocean/sites.json'), fetchJSON('/data/ocean/taxa.json')]);
    this.sd = new Map(sd.sites.map(s => [s.id, s])); this.taxa = taxa;
    for (const s of SITES) { const el = this.$(`[data-d="${s.id}"]`); if (el) el.textContent = `fundo a ${fmt(this.sd.get(s.id).bottom)} m`; }
    const E = this.engine = new Engine(this.$('.oc-gl'), { onFrame: dt => this.frame(dt), onPick: p => this.onPick(p), onHover: p => this.onHover(p) });
    E.subModel = buildSub(); E.scene.add(E.subModel); E.subModel.visible = false;
    this.sound = new Sound();
    if (E.mobile) { this.root.classList.add('is-nopanel'); this.$('[data-a=panel]').setAttribute('aria-pressed', 'false'); }
    this.bindUI();
    this.buildRail();
    this.renderPanel();
    const m = /^#explorer\/ocean\/(\w+)/.exec(location.hash);
    if (m && SITES.some(s => s.id === m[1])) this.startSite(m[1]);
    else { this.$('.oc-intro').classList.add('is-on'); E.sub.p.set(0, -6, 0); E.target.set(0, -6, 0); E.sub.pitchT = E.sub.pitch = -0.6; this.root.classList.add('is-intro'); }
  }

  async startSite(id) {
    const S = SITES.find(s => s.id === id), D = this.sd.get(id), E = this.engine;
    this.$('.oc-intro').classList.remove('is-on'); this.root.classList.remove('is-intro');
    this.$('.oc-loading').classList.add('is-on');
    const [gl, gr] = await Promise.all([fetchI16(`/data/ocean/${id}-local.bin`), fetchI16(`/data/ocean/${id}-region.bin`)]);
    this.floor?.dispose(); this.life?.dispose(); this.relief?.dispose(); this.relief = null;
    this.site = S; this.siteData = D; this.siteId = id; this._whale = false; this.tab = 'here';
    this.floor = new Seafloor(E, S, D, gl, gr);
    E.floorAt = this.floor.heightAt;
    const local = D.local, bx = local.W * 0.5, bz = local.H * 0.5;
    E.bounds = t => { t.x = clamp(t.x, -bx * 0.9, bx * 0.9); t.z = clamp(t.z, -bz * 0.9, bz * 0.9); };
    const species = SPECIES.filter(sp => sp.sites === '*' || sp.sites.includes(id));
    this.species = species;
    this.life = new Life(E, this.floor, S, species);
    E.sub.p.set(0, -3, 0); E.target.set(0, -3, 0); E.flight = null; E.sub.pitchT = 0.15; E.sub.yawT = 0.4;
    if (E.mobile) this.root.classList.add('is-nopanel');
    /* aquece os shaders: todos os programas compilam já, sem engasgos durante a descida */
    try { await E.renderer.compileAsync(E.scene, E.camera); } catch { /* sem KHR_parallel: compila no primeiro frame */ }
    this.$('.oc-loading').classList.remove('is-on');
    if (!location.hash.startsWith('#explorer/ocean/' + id)) history.replaceState(null, '', '#explorer/ocean/' + id);
    this.buildRail(); this.renderPanel();
    this.setAuto(true);
    this.hint('Arrasta para olhar · roda ou ↑↓ para mudar a profundidade · clica num animal para o conhecer');
  }

  /* ── ciclo ── */
  frame(dt) {
    const E = this.engine;
    if (!this.site) return;
    if (this.auto && !E.flight) {
      const floor = -this.floor.heightAt(E.target.x, E.target.z) - 4;
      const v = SPEEDS[this.speed].v * (E.depth > floor - 120 ? clamp((floor - E.depth) / 120, 0.06, 1) : 1);
      E.target.y = Math.max(-floor, E.target.y - v * dt);
      if (E.depth >= floor - 0.5) { this.setAuto(false); if (!this.sel) { E.look = null; E.sub.pitchT = 0.6; } this.hint('Chegaste ao fundo. Usa A/D e Q/E (ou as setas) para te deslocares junto ao fundo.'); }
    }
    this.floor.update();
    this.life.update(dt);
    /* encontro: um cachalote a caçar atravessa a vista uma vez por mergulho, na zona do crepúsculo */
    if (this.auto && !this._whale && E.depth > 520 && E.depth < 900 && this.species.some(s => s.id === 'physeter')) {
      this._whale = true; const a = this.life.spawnHero();
      if (a) { this.setAuto(false); this.select(a); this.hint('Um cachalote a caçar lulas na zona do crepúsculo.'); const site = this.site; setTimeout(() => { if (this.site !== site || (this.sel && this.sel !== a)) return; this.select(null); E.sub.pitchT = 0.55; if (this.tab === 'sp') { this.tab = 'here'; this.renderPanel(); } this.setAuto(true); }, 14000); }
    }
    if (this.relief) this.relief.marker(E.depth);
    this.sound.update(E.depth, this.floor.vents.length ? Math.min(...this.floor.vents.map(v => Math.hypot(v.x - E.sub.p.x, v.z - E.sub.p.z))) : 1e9, E.sub.v.length());
    this._hud = (this._hud || 0) + dt;
    if (this._hud > 0.1) { this._hud = 0; this.hud(); }
    if (this.sel) this.placeTip(this.sel);
    const na = this.life.nearestAhead();
    E.lookDist = this.sel ? this.sel.p.distanceTo(E.camera.position) : na;
  }

  hud() {
    const E = this.engine, d = E.depth, D = this.siteData, S = this.site;
    const z = zoneAt(d);
    if (z !== this.zone) { const first = !this.zone; this.zone = z; this.zoneCard(z, first); if (this.tab === 'here') this.renderPanel(); }
    const p = pressureDbar(d, S.lat), bar = p / 10 + 1.013;
    const t = profAt(D.prof, d, 't'), o = profAt(D.prof, d, 'o'), last = D.prof.filter(q => q.src === 'woa').pop();
    const calc = d > last.z;
    const lf = lightFrac(d) * (E.sunK > 0.5 ? 1 : 2.5e-6);
    const alt = this.floor.alt;
    const rows = [
      ['Profundidade', `${fmt(d)} m`, ''],
      ['Pressão', `${fmt(bar, bar < 10 ? 1 : 0)} bar`, `≈ ${fmt(bar * 1.0197, bar < 10 ? 1 : 0)} kg em cada cm² · calculada`],
      ['Temperatura', `${fmt(t, 1)} °C`, calc ? 'calculada (compressão adiabática)' : 'WOA23 · média anual'],
      ['Luz solar', lf > 1e-3 ? `${fmt(lf * 100, lf > 0.01 ? 1 : 2)} %` : lf > 1e-13 ? `10<sup>${Math.round(Math.log10(lf * 100))}</sup> %` : '0 %', E.sunK > 0.5 ? 'da superfície · modelo' : 'luar · modelo'],
      ['Oxigénio', `${fmt(o)} µmol/kg`, calc ? 'valor WOA mais fundo, mantido' : 'WOA23 · média anual'],
    ];
    if (alt < 400) rows.push(['Acima do fundo', `${fmt(alt, alt < 10 ? 1 : 0)} m`, 'batimetria GMRT + pormenor']);
    this.$('.oc-read').innerHTML = rows.map(([k, v, s]) => `<div><dt>${k}</dt><dd><b>${v}</b>${s ? `<small>${s}</small>` : ''}</dd></div>`).join('');
    const rail = this.$('.oc-rail'); rail.setAttribute('aria-valuenow', Math.round(d)); rail.setAttribute('aria-valuetext', `${fmt(d)} metros`);
    const now = this.$('.oc-rail-now'); now.style.top = (this.railY(d) * 100) + '%'; now.querySelector('span').textContent = `${fmt(d)} m`;
    this.$('.oc-zone-k').textContent = z.alias; this.$('.oc-zone-n').textContent = z.name; this.$('.oc-zone-r').textContent = `${fmt(z.from)}–${fmt(z.to)} m`;
    if (this.tab === 'here') this.updateHereCounts();
  }

  zoneCard(z, first) {
    const c = this.$('.oc-card');
    this.$('.oc-card-k').textContent = z.alias; this.$('.oc-card-n').textContent = 'Zona ' + z.name.toLowerCase(); this.$('.oc-card-r').textContent = `${fmt(z.from)} – ${fmt(z.to)} m`;
    if (z.id === 'hadal') this.$('.oc-card-n').textContent = 'Zona hadal';
    c.classList.remove('is-on'); void c.offsetWidth; c.classList.add('is-on');
    clearTimeout(this._cardT); this._cardT = setTimeout(() => c.classList.remove('is-on'), first ? 2600 : 3600);
  }
  hint(t) { const h = this.$('.oc-hint'); h.textContent = t; h.classList.add('is-on'); clearTimeout(this._hT); this._hT = setTimeout(() => h.classList.remove('is-on'), 7000); }

  /* ── régua de profundidade ── */
  railMax() { return this.siteData ? Math.max(this.siteData.bottom, 2500) : 11000; }
  railY(d) { const M = this.railMax(); return Math.sqrt(clamp(d / M, 0, 1)); }
  railD(y) { return y * y * this.railMax(); }
  buildRail() {
    const tr = this.$('.oc-rail-track'), M = this.railMax();
    const zs = ZONES.filter(z => z.from < M).map(z => { const h = this.railY(Math.min(z.to, M)) - this.railY(z.from); return `<div class="oc-rz" style="top:${this.railY(z.from) * 100}%;height:${h * 100}%;--c:${z.color}">${h > 0.1 ? `<span>${esc(z.name)}</span>` : ''}</div>`; }).join('');
    const ticks = [0, 200, 500, 1000, 2000, 4000, 6000, 8000, 10000].filter(t => t <= M).map(t => `<div class="oc-rt" style="top:${this.railY(t) * 100}%"><span>${fmt(t)}</span></div>`).join('');
    const mk = MARKERS.filter(m => m.d <= M).map(m => `<button type="button" class="oc-rm" style="top:${this.railY(m.d) * 100}%" data-d="${m.d}" title="${esc(fmt(m.d) + ' m — ' + m.t)}" aria-label="${esc(fmt(m.d) + ' metros: ' + m.t)}"></button>`).join('');
    const bot = this.siteData ? `<div class="oc-rbot" style="top:${this.railY(this.siteData.bottom) * 100}%"><span>fundo ${fmt(this.siteData.bottom)} m</span></div>` : '';
    tr.innerHTML = zs + ticks + mk + bot;
  }

  /* ── controlos ── */
  bindUI() {
    const R = this.root, E = this.engine;
    R.querySelectorAll('.oc-site').forEach(b => b.onclick = () => this.startSite(b.dataset.site));
    R.querySelector('.oc-bar').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s != null) { this.speed = +b.dataset.s; R.querySelectorAll('.oc-speed button').forEach(x => x.setAttribute('aria-pressed', x === b)); if (!this.auto) this.setAuto(true); return; }
      const a = b.dataset.a;
      if (a === 'go') this.setAuto(!this.auto);
      if (a === 'lights') { E.lights = !E.lights; b.setAttribute('aria-pressed', E.lights); if (!E.lights && E.depth > 800) this.hint('Faróis desligados: à volta, só a luz dos próprios animais.'); }
      if (a === 'night') { const n = E.sunK > 0.5; E.sunK = n ? 2.5e-6 : 1; b.setAttribute('aria-pressed', n); this.hint(n ? 'Noite: muitos peixes-lanterna e outros animais sobem para perto da superfície para comer.' : 'Dia: os migradores voltam a descer para a zona do crepúsculo.'); }
      if (a === 'view') { E.view = E.view === 'ext' ? 'cockpit' : 'ext'; b.setAttribute('aria-pressed', E.view === 'ext'); }
      if (a === 'relief') this.toggleRelief();
      if (a === 'sound') { const on = this.sound.toggle(); b.setAttribute('aria-pressed', on); }
      if (a === 'panel') { const on = R.classList.toggle('is-nopanel'); b.setAttribute('aria-pressed', !on); setTimeout(() => E.resize(), 260); }
    });
    R.querySelector('.oc-tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { this.tab = b.dataset.t; this.renderPanel(); } });
    R.querySelector('.oc-pbody').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, v = b.dataset.v;
      if (act === 'sp') { this.showSpecies(v); }
      if (act === 'see') this.goSee(v);
      if (act === 'poi') this.goPoi(+v);
      if (act === 'site') { this.startSite(v); }
      if (act === 'whale') { const a = this.life.spawnHero(); if (a) this.select(a); }
    });
    /* régua: clicar ou arrastar */
    const rail = R.querySelector('.oc-rail');
    const at = e => { const r = rail.getBoundingClientRect(); return this.railD(clamp((e.clientY - r.top) / r.height, 0, 1)); };
    rail.addEventListener('pointerdown', e => {
      if (!this.site) return;
      const m = e.target.closest('.oc-rm'); this.setAuto(false);
      if (m) { E.goDepth(+m.dataset.d); this.hint(m.title); return; }
      rail.setPointerCapture(e.pointerId); E.goDepth(at(e)); rail._drag = true;
    });
    rail.addEventListener('pointermove', e => { if (rail._drag) { E.flight = null; E.target.y = -clamp(at(e), 1.5, -this.floor.heightAt(E.target.x, E.target.z) - 2.2); } });
    rail.addEventListener('pointerup', () => { rail._drag = false; });
    rail.addEventListener('keydown', e => { const k = e.key; const d = E.depth; let n = null; if (k === 'ArrowDown') n = d + Math.max(10, d * 0.1); if (k === 'ArrowUp') n = d - Math.max(10, d * 0.1); if (k === 'PageDown') n = d + 1000; if (k === 'PageUp') n = d - 1000; if (k === 'Home') n = 0; if (k === 'End') n = 11000; if (n != null) { e.preventDefault(); e.stopPropagation(); this.setAuto(false); E.goDepth(n); } });
    this._kd = e => { if (!this.root.isConnected || this.root.offsetParent === null || e.target.closest('input,textarea')) return; const k = e.key.toLowerCase(); if (k === 'l') R.querySelector('[data-a=lights]').click(); if (k === 'v') R.querySelector('[data-a=view]').click(); if (k === ' ') { e.preventDefault(); this.setAuto(!this.auto); } if (k === 'escape' && this.sel) this.select(null); if (['w', 's', 'arrowup', 'arrowdown', 'pageup', 'pagedown'].includes(k)) this.setAuto(false); };
    addEventListener('keydown', this._kd);
    E.renderer.domElement.addEventListener('wheel', () => this.setAuto(false), { passive: true });
  }
  setAuto(on) {
    this.auto = on && !!this.site;
    const b = this.$('.oc-go'); b.setAttribute('aria-pressed', this.auto);
    b.querySelector('.oc-bt').textContent = this.auto ? 'Parar' : 'Descer'; b.querySelector('.oc-ic').textContent = this.auto ? '❚❚' : '▼';
  }

  /* ── seleção de animais ── */
  onPick(p) {
    if (!this.life || this.relief) return;
    const a = this.life.pick(p);
    this.select(a);
  }
  onHover(p) {
    if (!this.life || this.relief || this.sel) return;
    const a = this.life.pick(p), tip = this.$('.oc-tip');
    this.engine.renderer.domElement.style.cursor = a ? 'pointer' : '';
    if (!a) { tip.hidden = true; return; }
    tip.hidden = false; tip.innerHTML = `<strong>${esc(a.sp.pt)}</strong><em>${esc(a.sp.sci)}</em>`;
    tip.style.transform = `translate(${p.cx + 14}px, ${p.cy + 10}px)`;
  }
  select(a) {
    this.sel = a; this.life.selected = a;
    const tip = this.$('.oc-tip');
    if (!a) { this.engine.look = null; tip.hidden = true; tip.classList.remove('is-sel'); return; }
    this.engine.look = a.p; this.setAuto(false);
    tip.hidden = false; tip.classList.add('is-sel');
    tip.innerHTML = `<strong>${esc(a.sp.pt)}</strong><em>${esc(a.sp.sci)}</em><span>Clica noutro sítio ou Esc para largar</span>`;
    this.showSpecies(a.sp.id, false);
  }
  placeTip(a) {
    const s = this.engine.project(a.p), tip = this.$('.oc-tip');
    if (!s || a.p.distanceTo(this.engine.camera.position) > 60) { this.select(null); return; }
    const r = Math.max(24, a.size * 0.6 * this.engine.h / (2 * Math.tan(this.engine.camera.fov * Math.PI / 360)) / Math.max(0.5, a.p.distanceTo(this.engine.camera.position)));
    tip.style.transform = `translate(${s.x + r}px, ${s.y - r - 20}px)`;
  }
  goSee(id) {
    const sp = SPECIES.find(s => s.id === id), E = this.engine; if (!sp) return;
    const floorD = -this.floor.heightAt(E.target.x, E.target.z);
    const benthic = ['benthic', 'tripod', 'fixed', 'bed', 'nearfloor', 'swarm'].includes(sp.mode);
    let d = benthic ? floorD - 2.5 : clamp((sp.core[0] + sp.core[1]) / 2, sp.depth[0] + 1, floorD - 5);
    if (sp.mode === 'surface') d = 2.5;
    if (benthic && (floorD < sp.depth[0] || floorD > sp.depth[1])) {
      /* encosta da fossa: procura um ponto do fundo dentro da faixa da espécie */
      const poi = this.findFloorAt((sp.core[0] + sp.core[1]) / 2);
      if (poi) { E.goTo(poi[0], poi[1], -this.floor.heightAt(poi[0], poi[1]) - 2.5); this.after(() => this.summonSel(id)); this.setAuto(false); return; }
    }
    this.setAuto(false);
    E.goDepth(d);
    this.after(() => this.summonSel(id));
  }
  /* depuração: um exemplar parado, de lado, a k× o seu tamanho */
  debugPose(id, k = 4, yaw = 0) {
    for (const P of this.life.pools) P.agents = P.agents.filter(x => !x.frozen);
    const a = this.life.summon(id); if (!a) return 'none';
    const E = this.engine, f = new THREE.Vector3(); E.camera.getWorldDirection(f);
    a.p.copy(E.camera.position).addScaledVector(f, Math.max(1.3, a.size * k)); a.frozen = true; a.pinned = true; a.yaw = E.sub.yaw + yaw; a.pitch = 0;
    this.select(null); return a.size;
  }
  summonSel(id) { const a = this.life.summon(id); if (a) this.select(a); else this.hint('Não há nenhum exemplar por perto — tenta de novo daqui a pouco.'); }
  after(fn) { const E = this.engine, chk = () => { if (!E.flight && Math.abs(E.sub.p.y - E.target.y) < 3) fn(); else setTimeout(chk, 200); }; setTimeout(chk, 300); }
  findFloorAt(depth) {
    let best = null, bd = 1e9;
    for (let r = 200; r < 60000 && !best; r *= 1.35) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = -this.floor.baseAt(x, z); if (Math.abs(h - depth) < bd && Math.abs(h - depth) < 150) { bd = Math.abs(h - depth); best = [x, z]; }
    }
    return best;
  }
  pois() {
    const id = this.siteId, B = this.siteData.bottom;
    const out = [{ t: `Fundo · ${fmt(B)} m`, x: 0, z: 0 }];
    if (id === 'marianas') { const p = this.findFloorAt(7500); if (p) out.push({ t: 'Encosta da fossa · ~7 500 m (zona dos peixes-caracol)', x: p[0], z: p[1] }); }
    if (id === 'rainbow') { const v = this.floor.vents; out.push({ t: 'Chaminés ativas', x: v[0].x - 6, z: v[0].z + 8 }); out.push({ t: 'Campo de mexilhões', x: v[2].x + 9, z: v[2].z }); }
    if (id === 'ccz') { const p = this.findFloorAt(B - 120); if (p) out.push({ t: 'Encosta de uma colina abissal', x: p[0], z: p[1] }); }
    return out;
  }
  goPoi(i) { const p = this.pois()[i]; if (!p) return; this.setAuto(false); this.engine.goTo(p.x, p.z, -this.floor.heightAt(p.x, p.z) - 3); }

  /* ── relevo ── */
  toggleRelief() {
    const b = this.$('[data-a=relief]');
    if (this.relief) { this.relief.dispose(); this.relief = null; this.engine.relief = null; b.setAttribute('aria-pressed', false); this.root.classList.remove('is-relief'); return; }
    if (!this.site) return;
    this.relief = new Relief(this.engine, this.site, this.siteData, this.floor);
    this.engine.relief = this.relief; b.setAttribute('aria-pressed', true); this.root.classList.add('is-relief');
    this.hint('Relevo real (GMRT). Arrasta para rodar, roda do rato para aproximar, botão direito para deslocar.');
  }

  /* ── painel ── */
  renderPanel() {
    this.root.querySelectorAll('.oc-tabs [data-t]').forEach(b => b.setAttribute('aria-selected', b.dataset.t === this.tab));
    const P = this.$('.oc-pbody');
    const f = { here: () => this.pHere(), sp: () => this.pSpecies(), site: () => this.pSite(), hist: () => this.pHist(), src: () => this.pSrc() }[this.tab];
    P.innerHTML = f(); P.scrollTop = 0;
  }
  pHere() {
    if (!this.site) return `<p class="oc-p">Escolhe um local para começar o mergulho.</p>${this.siteButtons()}`;
    const d = this.engine.depth, z = zoneAt(d), floorD = -this.floor.heightAt(this.engine.sub.p.x, this.engine.sub.p.z);
    const near = (floorD - d) < 60;
    const list = this.species.filter(sp => { const benth = ['benthic', 'tripod', 'fixed', 'bed', 'nearfloor', 'swarm'].includes(sp.mode); return benth ? floorD >= sp.depth[0] && floorD <= sp.depth[1] && (near || d > sp.depth[0] - 200) : d >= sp.depth[0] - 50 && d <= sp.depth[1] + 50; });
    const others = this.species.filter(sp => !list.includes(sp));
    const row = sp => `<li><button type="button" data-act="sp" data-v="${sp.id}" class="oc-sprow"><span class="oc-dot" data-n="${sp.id}"></span><span><strong>${esc(sp.pt)}</strong><em>${esc(sp.sci)}</em></span><small>${fmt(sp.depth[0])}–${fmt(sp.depth[1])} m${MODE_TXT[sp.mode] ? ' · ' + MODE_TXT[sp.mode] : ''}</small></button></li>`;
    const feats = FEATURES.filter(f => f.site === this.siteId);
    return `<section class="oc-sec"><p class="oc-kicker">${esc(z.alias)} · ${fmt(z.from)}–${fmt(z.to)} m</p><h3>Zona ${esc(z.id === 'hadal' ? 'hadal' : z.name.toLowerCase())}</h3><p class="oc-p">${esc(z.text)}</p></section>
      <section class="oc-sec"><h4>Vida a esta profundidade <small>(${list.length})</small></h4>${list.length ? `<ul class="oc-splist">${list.map(row).join('')}</ul>` : '<p class="oc-p oc-muted">Nenhuma das espécies destacadas vive aqui.</p>'}
      ${d > 300 && d < 1300 && this.species.some(s => s.id === 'physeter') ? '<button type="button" class="btn oc-mini" data-act="whale">Esperar por um cachalote</button>' : ''}</section>
      <section class="oc-sec"><h4>Noutras profundidades</h4><ul class="oc-splist oc-dim">${others.map(row).join('')}</ul></section>
      <section class="oc-sec"><h4>Neste local</h4>${feats.map(f => `<details class="oc-feat"><summary>${esc(f.name)}</summary><p class="oc-p">${esc(f.text)}</p>${this.refList(f.refs)}</details>`).join('')}
      <div class="oc-pois">${this.pois().map((p, i) => `<button type="button" class="btn oc-mini" data-act="poi" data-v="${i}">Ir: ${esc(p.t)}</button>`).join('')}</div></section>`;
  }
  updateHereCounts() {
    const c = this.life?.counts() || {};
    this.root.querySelectorAll('.oc-dot[data-n]').forEach(el => el.classList.toggle('is-vis', (c[el.dataset.n] || 0) > 0));
  }
  showSpecies(id, switchTab = true) { this.spId = id; if (switchTab || this.tab === 'sp' || true) { this.tab = 'sp'; this.renderPanel(); } }
  pSpecies() {
    const sp = SPECIES.find(s => s.id === this.spId);
    if (!sp) return '<p class="oc-p oc-muted">Clica num animal ou escolhe um da lista em «Aqui».</p>';
    const tx = this.taxa[sp.id] || {}, ob = tx.obis || {};
    const reg = this.site && ob.occ ? ob.occ[this.siteId] : null;
    const hist = this.histogram(ob.depth || [], sp.depth);
    const benth = MODE_TXT[sp.mode] ? ` · ${MODE_TXT[sp.mode]}` : '';
    return `<section class="oc-sec"><p class="oc-kicker">${esc(RANK[sp.rank] || sp.rank)}${sp.biolum ? ' · bioluminescente' : ''}</p><h3>${esc(sp.pt)}</h3><p class="oc-sci"><em>${esc(tx.name || sp.sci)}</em> ${esc(tx.auth || '')}</p>
      ${tx.cls?.length ? `<p class="oc-cls">${tx.cls.map(esc).join(' › ')}</p>` : ''}
      <p class="oc-p">${esc(sp.text)}</p>
      <dl class="oc-facts"><div><dt>Habitat típico</dt><dd>${fmt(sp.depth[0])}–${fmt(sp.depth[1])} m${benth}</dd></div><div><dt>Mais comum</dt><dd>${fmt(sp.core[0])}–${fmt(sp.core[1])} m${sp.night ? ` (de noite ${fmt(sp.night[0])}–${fmt(sp.night[1])} m)` : ''}</dd></div><div><dt>Tamanho do modelo</dt><dd>${sp.size >= 1 ? fmt(sp.size, 1) + ' m' : fmt(sp.size * 100) + ' cm'}</dd></div></dl>
      <button type="button" class="btn oc-mini" data-act="see" data-v="${sp.id}">Ir ver ${this.site ? 'neste mergulho' : ''}</button></section>
      <section class="oc-sec"><h4>Registos documentados (OBIS)</h4>
      <p class="oc-p">${fmt(ob.rec)} registos de ${fmt(ob.ds)} conjuntos de dados${ob.yr ? `, de ${ob.yr[0]} a ${ob.yr[1]}` : ''}.${reg != null && this.site ? ` Na região deste mergulho (${esc(this.site.basinName)}): <strong>${fmt(reg)}</strong>.` : ''}</p>
      ${hist}
      ${reg === 0 ? '<p class="oc-note">Sem registos OBIS nesta região: a presença aqui vem da literatura citada abaixo. As bases de dados do mar profundo têm grandes lacunas.</p>' : ''}
      <p class="oc-note">A profundidade dos registos é a que os autores indicaram (às vezes a da rede ou a do fundo). Há erros de identificação e de profundidade, por isso os valores extremos não são fiáveis.</p></section>
      <section class="oc-sec"><h4>O modelo 3D</h4><p class="oc-p"><span class="oc-badge is-model">Reconstrução ilustrativa</span> Modelo procedural feito para este site a partir de descrições e fotografias científicas. Não é uma digitalização de um exemplar; proporções e cores são aproximadas. A densidade de animais na cena está exagerada para serem vistos numa descida curta.</p></section>
      <section class="oc-sec"><h4>Referências</h4>${this.refList(sp.refs)}
      <p class="oc-links">${tx.aphia ? `<a href="https://www.marinespecies.org/aphia.php?p=taxdetails&id=${tx.aphia}" target="_blank" rel="noopener">WoRMS (AphiaID ${tx.aphia})</a>` : ''}${tx.aphia ? `<a href="https://obis.org/taxon/${tx.aphia}" target="_blank" rel="noopener">OBIS</a>` : ''}<a href="https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(sp.sci)}" target="_blank" rel="noopener">Wikipédia</a></p></section>`;
  }
  histogram(bins, range) {
    if (!bins.length) return '';
    /* agrupa os escalões variáveis do OBIS em faixas fixas na escala da régua */
    const edges = [0, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000];
    const sum = new Array(edges.length - 1).fill(0);
    for (const [from, n] of bins) { let k = edges.findIndex((e, i) => from >= e && from < edges[i + 1]); if (k < 0) k = sum.length - 1; sum[k] += n; }
    const mx = Math.max(1, ...sum), tot = sum.reduce((a, b) => a + b, 0);
    if (!tot) return '<p class="oc-p oc-muted">Os registos não têm profundidade.</p>';
    const label = (a, b) => b <= 1000 ? `${a}–${b} m` : `${a / 1000}–${b / 1000} km`;
    return `<figure class="oc-hist" aria-label="Registos OBIS por faixa de profundidade"><ol>${sum.map((n, i) => { const inR = edges[i + 1] > range[0] && edges[i] < range[1]; return `<li class="${inR ? 'in' : ''}"><span class="oc-hl">${label(edges[i], edges[i + 1])}</span><span class="oc-hb"><i style="width:${(n / mx * 100).toFixed(1)}%"></i></span><span class="oc-hn">${fmt(n)}</span></li>`; }).join('')}</ol>
      <figcaption>Registos com profundidade (${fmt(tot)}). A cor mais forte marca o habitat típico.</figcaption></figure>`;
  }
  pSite() {
    if (!this.site) return this.siteButtons();
    const S = this.site, D = this.siteData;
    const zrow = ZONES.map(z => { const o = D.obis[z.id]; return `<li><span class="oc-zsw" style="--c:${z.color}"></span><strong>${esc(z.name)}</strong><span>${fmt(o.n)} espécies</span>${o.top.length ? `<small>${o.top.slice(0, 4).map(t => `<em>${esc(t.sci)}</em>`).join(', ')}</small>` : ''}</li>`; }).join('');
    return `<section class="oc-sec"><p class="oc-kicker">${esc(S.kind)} · ${fmt(Math.abs(S.lat), 2)}° ${S.lat >= 0 ? 'N' : 'S'}, ${fmt(Math.abs(S.lon), 2)}° ${S.lon >= 0 ? 'E' : 'W'}</p><h3>${esc(S.name)}</h3><p class="oc-p">${esc(S.text)}</p>
      <dl class="oc-facts"><div><dt>Fundo neste ponto (GMRT)</dt><dd>${fmt(D.bottom)} m</dd></div>${S.official ? `<div><dt>Medição de referência</dt><dd>${fmt(S.official)} ± 6 m</dd></div>` : ''}<div><dt>Pressão no fundo</dt><dd>≈ ${fmt(D.pBottom / 10 + 1)} bar</dd></div><div><dt>Temperatura no fundo</dt><dd>${fmt(profAt(D.prof, D.bottom, 't'), 2)} °C</dd></div></dl></section>
      <section class="oc-sec"><h4>Temperatura e oxigénio</h4>${this.profileChart()}</section>
      <section class="oc-sec"><h4>Espécies registadas no OBIS na região</h4><p class="oc-p oc-muted">${esc(S.basinName)} — número de espécies com registos em cada zona.</p><ul class="oc-zlist">${zrow}</ul>
      <p class="oc-note">Há muito menos registos em profundidade do que à superfície: reflete sobretudo o esforço de amostragem, não só a biodiversidade.</p></section>
      <section class="oc-sec"><h4>Outros mergulhos</h4>${this.siteButtons(S.id)}</section>`;
  }
  siteButtons(skip) { return `<div class="oc-pois">${SITES.filter(s => s.id !== skip).map(s => `<button type="button" class="btn oc-mini" data-act="site" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div>`; }
  profileChart() {
    const D = this.siteData, P = D.prof.filter(p => p.z <= D.bottom + 1), W = 300, H = 230, L = 34, T = 18, B = 14, Rr = 10;
    const maxZ = D.bottom, y = z => T + Math.sqrt(z / maxZ) * (H - T - B);
    const tMax = Math.ceil(Math.max(...P.map(p => p.t)) / 5) * 5, oMax = Math.ceil(Math.max(...P.map(p => p.o).filter(isFinite)) / 50) * 50;
    const xt = t => L + t / tMax * (W - L - Rr), xo = o => L + o / oMax * (W - L - Rr);
    const path = (f, k) => P.filter(p => isFinite(p[k])).map((p, i) => `${i ? 'L' : 'M'}${f(p[k]).toFixed(1)},${y(p.z).toFixed(1)}`).join('');
    const ticks = [0, 200, 1000, 2000, 4000, 6000, 8000, 10000].filter(z => z <= maxZ);
    const calc = P.find(p => p.src === 'calc');
    return `<figure class="oc-prof"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil de temperatura e oxigénio">
      ${ticks.map(z => `<line x1="${L}" x2="${W - Rr}" y1="${y(z)}" y2="${y(z)}" class="g"/><text x="${L - 4}" y="${y(z) + 3}" text-anchor="end">${fmt(z)}</text>`).join('')}
      ${calc ? `<rect x="${L}" y="${y(calc.z)}" width="${W - L - Rr}" height="${y(maxZ) - y(calc.z)}" class="calc"/>` : ''}
      <path d="${path(xo, 'o')}" class="o"/><path d="${path(xt, 't')}" class="t"/>
      <line class="now" x1="${L}" x2="${W - Rr}" y1="${y(this.engine.depth)}" y2="${y(this.engine.depth)}"/>
      <text x="${xt(tMax)}" y="11" text-anchor="end" class="tl">${tMax} °C</text><text x="${L}" y="11" class="ol">0 – ${oMax} µmol/kg O₂</text>
    </svg><figcaption><span class="k t"></span>Temperatura <span class="k o"></span>Oxigénio dissolvido. World Ocean Atlas 2023 (média anual, célula de 1°)${calc ? '; faixa sombreada: abaixo de 5 500 m, temperatura calculada por compressão adiabática (θ constante)' : ''}. Escala vertical comprimida.</figcaption></figure>`;
  }
  pHist() {
    return `<section class="oc-sec"><h3>Descobertas</h3><ol class="oc-time">${DISCOVERIES.map(d => `<li><strong>${d.y}</strong><p>${esc(d.t)}</p>${this.refList([d.ref], true)}</li>`).join('')}</ol></section>`;
  }
  pSrc() {
    const used = Object.entries(REFS);
    return `<section class="oc-sec"><h3>Dados, licenças e limites</h3>
      <ul class="oc-src">
        <li><strong>Batimetria</strong> — GMRT v4 (Lamont-Doherty Earth Observatory), CC BY 4.0. Grelha local de ~30–60 m e regional de 300–800 m, sem alterações além de reamostragem.</li>
        <li><strong>Temperatura, salinidade, oxigénio</strong> — World Ocean Atlas 2023 (NOAA NCEI), domínio público. Médias anuais na célula de 1° mais próxima.</li>
        <li><strong>Pressão</strong> — calculada com a fórmula de Saunders (1981) para um oceano-padrão; no fundo das fossas o erro pode ser de algumas dezenas de dbar.</li>
        <li><strong>Temperatura abaixo de 5 500 m</strong> — calculada: temperatura potencial constante e aquecimento por compressão (UNESCO 1983). Dá ~2,5 °C no fundo da Challenger Deep, de acordo com as medições publicadas.</li>
        <li><strong>Luz solar</strong> — modelo de atenuação para água oceânica muito límpida (Kd azul = 0,022 m⁻¹). Em águas mais turvas a luz acaba bem antes.</li>
        <li><strong>Taxonomia</strong> — WoRMS (CC BY 4.0), consultado em ${esc(this.sd?.size ? '' : '')}out. 2026.</li>
        <li><strong>Registos de espécies</strong> — OBIS (IOC-UNESCO). Cada conjunto de dados tem a sua licença (CC0, CC BY ou CC BY-NC); aqui só se mostram contagens agregadas.</li>
        <li><strong>Animais</strong> — modelos 3D procedurais feitos para este site (sem modelos de terceiros). São reconstruções ilustrativas.</li>
        <li><strong>Relevo fino</strong> — abaixo da resolução da batimetria o fundo tem pormenor procedural (sedimento, blocos, montes de sulfuretos) que não corresponde a medições.</li>
        <li><strong>Densidades</strong> — a quantidade de animais à volta do submersível é exagerada de propósito; as faixas de profundidade seguem a literatura.</li>
        <li><strong>Cores</strong> — a perda de vermelho com a distância e a profundidade segue a ótica da água; a exposição imita uma câmara que se adapta até um limite.</li>
      </ul></section>
      <section class="oc-sec"><h4>Referências</h4><ol class="oc-refs">${used.map(([k, r]) => `<li id="ocr-${k}">${esc(r.c)} <a href="${esc(r.u)}" target="_blank" rel="noopener">ligação</a></li>`).join('')}</ol></section>`;
  }
  refList(ids, inline = false) {
    const items = (ids || []).map(k => REFS[k]).filter(Boolean);
    if (!items.length) return '';
    return `<ul class="oc-rl${inline ? ' is-inline' : ''}">${items.map(r => `<li><a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.c)}</a></li>`).join('')}</ul>`;
  }

  dispose() {
    removeEventListener('keydown', this._kd);
    this.sound?.dispose(); this.relief?.dispose(); this.life?.dispose(); this.floor?.dispose(); this.engine?.dispose();
    this.host.innerHTML = '';
  }
}
