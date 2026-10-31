/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — aplicação (interface + ligação entre vistas).

   mount(host) monta tudo dentro de `host` e devolve { pause, resume,
   dispose }. Tudo o que é estado vive no Studio (st-scene); a interface
   só lê e escreve nesse estado e pede um novo frame.
   ══════════════════════════════════════════════════════════════════════ */
import { Studio, SYNC, MAX_LIGHTS } from './st-scene.mjs';
import { Plan, ROLE_COLOR } from './st-plan.mjs';
import { PRESETS, DEFAULT_CAM, APERTURES, SHUTTERS, ISOS, FOCALS, fmtShutter, fmtF, fmtPower } from './st-presets.mjs';
import { MODIFIERS, SURFACES, PAPERS } from './st-gear.mjs';
import { ROLES, GELS, FULL_WS } from './st-lights.mjs';
import { THREE, clamp, ease, DEG } from './st-core.mjs';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 1) => (+v).toFixed(d).replace('.', ',');
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const nearestIdx = (arr, v, log = true) => { let bi = 0, bd = Infinity; arr.forEach((x, i) => { const d = Math.abs(log ? Math.log(x / v) : x - v); if (d < bd) { bd = d; bi = i; } }); return bi; };

const ICON = {
  eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3l18 18M10.6 5.6A10.6 10.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 6.5 10 6.5c1.7 0 3.2-.4 4.5-1"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  expand: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  swap: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/></svg>',
  plan: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="11" r="2.5"/><path d="M12 21v-4M6 7l3 2M18 7l-3 2"/></svg>',
};

/* mini planta de cada esquema, desenhada a partir dos dados do esquema */
function presetIcon(p) {
  const S = 56, c = S / 2, cy = 30, k = 13;
  let out = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" aria-hidden="true">`;
  out += `<rect x="${c - 12}" y="3" width="24" height="2.5" rx="1" fill="#${({ white: 'ecebe6', black: '1a1a1c', charcoal: '3a3b3f', grey: '7b7d80' })[p.paper] || '777'}"/>`;
  for (const l of p.lights) {
    const r = Math.min(2.6, l.dist) * k * 0.62;
    const x = c + Math.sin(l.az * DEG) * r, y = cy + Math.cos(l.az * DEG) * r;
    const col = ROLE_COLOR[l.role] || '#fff';
    if (l.aim !== 'backdrop') out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${c}" y2="${cy}" stroke="${col}" stroke-opacity=".45" stroke-width="1.2"/>`;
    else out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x * 0.6 + c * 0.4).toFixed(1)}" y2="6" stroke="${col}" stroke-opacity=".45" stroke-width="1.2"/>`;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${l.role === 'bounce' ? 2.6 : 3.4}" fill="${l.role === 'bounce' ? 'none' : col}" stroke="${col}" stroke-width="1.2"/>`;
  }
  out += `<circle cx="${c}" cy="${cy}" r="4.2" fill="#d8b9a3"/><path d="M${c - 1.6} ${cy + 3.6} L${c} ${cy + 5.6} L${c + 1.6} ${cy + 3.6}" fill="#d8b9a3" transform="rotate(${-(p.yaw || 0)} ${c} ${cy})"/>`;
  out += `<rect x="${c - 3.5}" y="${S - 7}" width="7" height="5" rx="1" fill="none" stroke="#ffc46b" stroke-width="1.2"/>`;
  return out + '</svg>';
}

/* ── componentes de formulário ───────────────────────────────────────── */
function slider({ id, label, min, max, step, value, out, hint }) {
  return `<div class="sts-field" data-f="${id}">
    <div class="sts-fl"><label for="sts-${id}">${label}</label><output id="sts-o-${id}">${out ?? value}</output></div>
    <input type="range" id="sts-${id}" min="${min}" max="${max}" step="${step}" value="${value}">
    ${hint ? `<p class="sts-hint" id="sts-h-${id}">${hint}</p>` : ''}
  </div>`;
}
function chips(name, items, cur, cls = '') {
  return `<div class="sts-chips ${cls}" role="radiogroup" aria-label="${esc(name)}">${items.map(([v, t, title]) =>
    `<button type="button" role="radio" class="sts-chip${v === cur ? ' on' : ''}" aria-checked="${v === cur}" data-v="${v}"${title ? ` title="${esc(title)}"` : ''}>${t}</button>`).join('')}</div>`;
}

export async function mount(host) {
  const mobile = window.matchMedia('(max-width: 900px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  host.innerHTML = `
  <div class="sts" data-main="editor" data-mtab="presets">
    <header class="sts-bar">
      <div class="sts-views seg" role="tablist" aria-label="Vista principal">
        <button class="seg-btn active" role="tab" aria-selected="true" data-main="editor">Estúdio</button>
        <button class="seg-btn" role="tab" aria-selected="false" data-main="photo">Fotografia</button>
      </div>
      <div class="sts-ab" role="group" aria-label="Antes e depois">
        <button class="sts-btn" data-act="snap" title="Guardar a fotografia atual como referência (A)">${ICON.pin}<span>Fixar A</span></button>
        <button class="sts-btn" data-act="compare" disabled aria-pressed="false" title="Comparar a referência com a fotografia atual">A | B</button>
      </div>
      <button class="sts-btn sts-btn-acc" data-act="preview" title="Pré-visualizar só a fotografia (P)">${ICON.expand}<span>Pré-visualizar</span></button>
    </header>

    <aside class="sts-left" aria-label="Esquemas e luzes">
      <section class="sts-sec sts-presets-sec" data-mpanel="presets">
        <h3 class="sts-h">Esquemas de luz</h3>
        <div class="sts-presets">${PRESETS.map(p => `<button class="sts-preset" data-preset="${p.id}" title="${esc(p.hint)}">${presetIcon(p)}<span>${p.name}</span></button>`).join('')}</div>
        <div class="sts-tip" aria-live="polite"></div>
      </section>
      <section class="sts-sec" data-mpanel="lights">
        <div class="sts-h-row"><h3 class="sts-h">Luzes</h3>
          <div class="sts-add">
            <button class="sts-btn sts-btn-sm" data-act="add-menu" aria-haspopup="true" aria-expanded="false">${ICON.plus}<span>Adicionar</span></button>
            <div class="sts-menu" role="menu" hidden>
              ${['key', 'fill', 'rim', 'hair', 'bg', 'accent'].map(r => `<button role="menuitem" data-add="${r}"><i style="background:${ROLE_COLOR[r]}"></i>${ROLES[r].name}</button>`).join('')}
              <button role="menuitem" data-add="bounce"><i class="ring"></i>Rebatedor 5-em-1</button>
            </div>
          </div>
        </div>
        <ul class="sts-lights" role="listbox" aria-label="Luzes do estúdio"></ul>
        <p class="sts-empty" hidden>Sem luzes. Escolhe um esquema ou adiciona uma luz.</p>
      </section>
    </aside>

    <main class="sts-stage">
      <canvas class="sts-gl" tabindex="0" aria-label="Estúdio 3D. Arrasta para rodar a vista, roda para aproximar, clica num equipamento para o selecionar."></canvas>
      <button class="sts-inset" title="Trocar vistas"><span class="sts-inset-lab">${ICON.swap}<b>Fotografia</b></span></button>
      <div class="sts-plan-wrap" data-mpanel="plan">
        <canvas class="sts-plan" aria-label="Planta do estúdio vista de cima. Arrasta as luzes, a câmara ou a pega do sujeito."></canvas>
        <span class="sts-plan-lab">Planta</span>
        <button class="sts-ico sts-plan-x" aria-label="Esconder a planta">${ICON.close}</button>
      </div>
      <div class="sts-hud" aria-live="polite">
        <div class="sts-lcd"></div>
        <canvas class="sts-histo" width="128" height="40" aria-hidden="true"></canvas>
      </div>
      <button class="sts-plan-tog" title="Mostrar a planta (vista de cima)">${ICON.plan}<span>Planta</span></button>
      <div class="sts-split-hint" hidden>Arrasta na fotografia para mover a divisória · A à esquerda, atual à direita</div>
      <button class="sts-exit" data-act="preview" hidden>${ICON.close}<span>Sair</span></button>
      <div class="sts-loading"><div class="sts-spin"></div><p>A montar o estúdio…</p></div>
    </main>

    <aside class="sts-right" aria-label="Ajustes" data-mpanel="inspector">
      <div class="sts-tabs seg" role="tablist">
        <button class="seg-btn active" role="tab" data-tab="light">Luz</button>
        <button class="seg-btn" role="tab" data-tab="camera">Câmara</button>
        <button class="seg-btn" role="tab" data-tab="scene">Cena</button>
      </div>
      <div class="sts-insp" data-panel="light"></div>
      <div class="sts-insp" data-panel="camera" hidden></div>
      <div class="sts-insp" data-panel="scene" hidden></div>
    </aside>

    <nav class="sts-mtabs seg" role="tablist" aria-label="Painéis">
      <button class="seg-btn active" data-mtab="presets">Esquemas</button>
      <button class="seg-btn" data-mtab="lights">Luzes</button>
      <button class="seg-btn" data-mtab="inspector">Ajustes</button>
      <button class="seg-btn" data-mtab="plan">Planta</button>
    </nav>
  </div>`;

  const root = host.querySelector('.sts');
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const canvas = $('.sts-gl'), stage = $('.sts-stage');

  /* altura: ocupa o ecrã disponível a partir do topo do estúdio */
  const fitHeight = () => {
    if (root.classList.contains('is-preview')) { root.style.height = ''; return; }
    const top = root.getBoundingClientRect().top + (document.scrollingElement?.scrollTop || 0) * 0;
    const h = Math.max(mobile ? 0 : 600, window.innerHeight - Math.max(0, top) - 14);
    root.style.height = mobile ? '' : h + 'px';
  };
  fitHeight();

  const st = new Studio(canvas, { mobile });
  st.view.inset = true;
  let sel = null, curPreset = null, modified = false, tab = 'light';

  const resize = () => {
    fitHeight();
    const r = stage.getBoundingClientRect();
    st.view.insetRect = { right: 14, top: 14, w: Math.round(clamp(r.width * (mobile ? 0.3 : 0.24), 96, 290)) };
    st.view.photoPad = root.classList.contains('is-preview') ? 8 : 18;
    const pw = $('.sts-plan-wrap');
    st.view.reserve = root.classList.contains('is-preview') || mobile ? null
      : { left: root.dataset.plan === 'on' ? pw.offsetWidth + 18 : 0, right: st.view.insetRect.w + 22 };
    st.setSize(Math.max(2, r.width), Math.max(2, r.height));
    placeInset(); plan.draw();
  };
  const plan = new Plan($('.sts-plan'), st, {
    onSelect: l => select(l),
    onChange: () => { modified = true; syncInspector(); },
  });

  /* ── carregamento ───────────────────────────────────────────────── */
  try { await st.load(); }
  catch (e) {
    $('.sts-loading').innerHTML = `<p>Não foi possível carregar o sujeito 3D.</p><button class="sts-btn" data-act="retry">Tentar de novo</button>`;
    $('[data-act="retry"]').onclick = () => mount(host);
    console.error(e);
    return { pause() {}, resume() {}, dispose() {} };
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  resize();

  /* ── luzes: lista ───────────────────────────────────────────────── */
  const lightLabel = l => l.passive ? 'Rebatedor ' + SURFACES[l.s.surface].name.toLowerCase() : `${ROLES[l.s.role].short} · ${fmtPower(l.s.power)}`;
  function renderLights() {
    const ul = $('.sts-lights');
    for (const l of st.lights) l.label = lightLabel(l);
    ul.innerHTML = st.lights.map((l, i) => {
      const modName = l.passive ? 'Ø80 · passivo' : MODIFIERS[l.s.mod].short;
      return `<li role="option" aria-selected="${l === sel}" class="sts-li${l === sel ? ' on' : ''}${l.live ? '' : ' off'}" data-i="${i}" tabindex="0">
        <i class="sts-dot${l.passive ? ' ring' : ''}" style="--c:${ROLE_COLOR[l.s.role]}"></i>
        <span class="sts-li-t"><b>${ROLES[l.s.role].name}</b><small>${modName}${l.passive ? '' : ' · ' + fmtPower(l.s.power)}</small></span>
        <button class="sts-ico" data-li="solo" aria-pressed="${l.s.solo}" title="Isolar (só esta luz)">S</button>
        <button class="sts-ico" data-li="on" aria-pressed="${l.s.on}" title="${l.s.on ? 'Desligar' : 'Ligar'} (${i + 1})">${l.s.on ? ICON.eye : ICON.eyeOff}</button>
      </li>`;
    }).join('');
    $('.sts-empty').hidden = st.lights.length > 0;
    plan.draw();
  }
  $('.sts-lights').addEventListener('click', e => {
    const li = e.target.closest('.sts-li'); if (!li) return;
    const l = st.lights[+li.dataset.i];
    const b = e.target.closest('[data-li]');
    if (b?.dataset.li === 'on') { l.s.on = !l.s.on; st.invalidate('lights'); renderLights(); syncInspector(); return; }
    if (b?.dataset.li === 'solo') { const v = !l.s.solo; st.lights.forEach(x => (x.s.solo = false)); l.s.solo = v; st.invalidate('lights'); renderLights(); return; }
    select(l);
  });
  $('.sts-lights').addEventListener('keydown', e => {
    const li = e.target.closest('.sts-li'); if (!li) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st.lights[+li.dataset.i]); }
  });

  /* adicionar */
  const addBtn = $('[data-act="add-menu"]'), menu = $('.sts-menu');
  addBtn.onclick = () => { const o = menu.hidden; menu.hidden = !o; addBtn.setAttribute('aria-expanded', o); if (o) menu.querySelector('button').focus(); };
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    menu.hidden = true; addBtn.setAttribute('aria-expanded', 'false');
    const role = b.dataset.add;
    const D = {
      key: { mod: 'softbox', az: -45, el: 30, dist: 1.4, power: -2 },
      fill: { mod: 'octa', az: 45, el: 8, dist: 2.2, power: -4 },
      rim: { mod: 'strip', az: 145, el: 18, dist: 1.4, power: -3 },
      hair: { mod: 'grid', az: 170, el: 55, dist: 1.2, power: -4 },
      bg: { mod: 'grid', az: 175, el: -5, dist: 1.2, power: -3, aim: 'backdrop' },
      accent: { mod: 'snoot', az: 110, el: 20, dist: 1.6, power: -3 },
      bounce: { surface: 'silver', az: 60, el: -10, dist: 0.9 },
    }[role];
    if (st.lights.length >= MAX_LIGHTS) { toast(`Máximo de ${MAX_LIGHTS} luzes — cada uma custa um mapa de sombras.`); return; }
    const l = st.addLight({ role, ...D });
    modified = true; renderLights(); select(l);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.sts-add')) { menu.hidden = true; addBtn.setAttribute('aria-expanded', 'false'); } });

  /* ── seleção ────────────────────────────────────────────────────── */
  function select(l) {
    sel = l || null;
    plan.sel = sel;
    if (sel && st.view.main === 'editor') st.gizmo.attach(sel.handle); else st.gizmo.detach();
    st.invalidate('view');
    renderLights();
    if (sel) setTab('light');
    syncInspector(true);
  }
  /* clique na cena (sem arrastar) → raycast no equipamento */
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || st.gizmo.dragging) return;
    const L = st.lastLayout, r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = r.height - (e.clientY - r.top);
    if (!L?.editor) return;
    const R = L.editor;
    if (x < R.x || x > R.x + R.w || y < R.y || y > R.y + R.h) return;
    const ndc = new THREE.Vector2((x - R.x) / R.w * 2 - 1, (y - R.y) / R.h * 2 - 1);
    const ray = new THREE.Raycaster(); ray.layers.enableAll();
    ray.setFromCamera(ndc, st.edCam);
    const hits = ray.intersectObjects(st.lights.map(l => l.group), true);
    const hit = hits.find(h => h.object.userData.light);
    if (hit) select(hit.object.userData.light);
    else if (!st.gizmo.object || !hits.length) select(null);
  });

  /* ── vistas ─────────────────────────────────────────────────────── */
  const planOn = { editor: !mobile, photo: false };
  function syncPlan() {
    const on = planOn[st.view.main] && !root.classList.contains('is-preview');
    root.dataset.plan = on ? 'on' : 'off';
    if (on) setTimeout(() => plan.draw(), 20);
    st.view.reserve && resize();
  }
  $('.sts-plan-tog').onclick = () => { planOn[st.view.main] = true; syncPlan(); };
  $('.sts-plan-x').onclick = () => { planOn[st.view.main] = false; syncPlan(); };
  function setMain(v) {
    st.view.main = v;
    root.dataset.main = v;
    $$('.sts-views .seg-btn').forEach(b => { const on = b.dataset.main === v; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('.sts-inset-lab b').textContent = v === 'editor' ? 'Fotografia' : 'Estúdio';
    if (v !== 'editor') st.gizmo.detach(); else if (sel) st.gizmo.attach(sel.handle);
    st.controls.enabled = v === 'editor';
    st.invalidate('view'); placeInset(); syncPlan();
  }
  $$('.sts-views .seg-btn').forEach(b => b.onclick = () => setMain(b.dataset.main));
  $('.sts-inset').onclick = () => setMain(st.view.main === 'editor' ? 'photo' : 'editor');
  function placeInset() {
    const L = st.layout(), r = L[L.insetIs], b = $('.sts-inset');
    if (!r || root.classList.contains('is-preview')) { b.hidden = true; return; }
    b.hidden = false;
    Object.assign(b.style, { left: r.x + 'px', top: (st.H - r.y - r.h) + 'px', width: r.w + 'px', height: r.h + 'px' });
  }

  /* ── HUD + histograma + fotómetro ───────────────────────────────── */
  let histT = 0;
  function hud(m) {
    const c = st.cam;
    const ev = m.ev, evTxt = !isFinite(ev) ? 'sem luz' : Math.abs(ev) < 0.05 ? '±0,0 EV' : (ev > 0 ? '+' : '−') + num(Math.abs(ev)) + ' EV';
    const evCls = !isFinite(ev) || Math.abs(ev) > 1 ? 'bad' : Math.abs(ev) > 0.35 ? 'warn' : 'ok';
    const sync = c.shutter < SYNC ? `<span class="sts-warn" title="Acima da velocidade de sincronização (1/${Math.round(1 / SYNC)}), a cortina do obturador tapa parte do fotograma durante o flash.">sinc.!</span>` : '';
    $('.sts-lcd').innerHTML = `<span>${fmtF(c.fnum)}</span><span>${fmtShutter(c.shutter)}${sync}</span><span>ISO ${c.iso}</span><span>${c.focal} mm</span><span class="sts-ev ${evCls}" title="Diferença entre a exposição atual e a leitura do fotómetro (incidente, no rosto)">${evTxt}</span>`;
    clearTimeout(histT);
    histT = setTimeout(drawHisto, 260);
  }
  function drawHisto() {
    const cv = $('.sts-histo');
    if (!st.lastLayout?.photo || !cv.offsetParent) return;
    const px = st.readPhoto(); if (!px) return;
    const bins = new Float32Array(64), { buf, w, h } = px;
    let clip = 0, n = 0;
    for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4, l = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
      bins[Math.min(63, l >> 2)]++; n++; if (buf[i] > 250 || buf[i + 1] > 250 || buf[i + 2] > 250) clip++;
    }
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, mx = Math.max(...bins.slice(1, 63)) || 1;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(230,234,240,.85)';
    for (let i = 0; i < 64; i++) { const bh = Math.min(1, bins[i] / mx) * (H - 2); g.fillRect(i * 2, H - bh, 2, bh); }
    g.fillStyle = clip / n > 0.004 ? '#ff5d5d' : 'rgba(255,255,255,.15)'; g.fillRect(W - 3, 0, 3, H);
    cv.title = clip / n > 0.004 ? `Realces queimados: ${num(clip / n * 100)}% da imagem` : 'Histograma da fotografia';
  }

  /* ── inspector ──────────────────────────────────────────────────── */
  function setTab(t) {
    tab = t;
    $$('.sts-tabs .seg-btn').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $$('.sts-insp').forEach(p => (p.hidden = p.dataset.panel !== t));
    syncInspector(true);
  }
  $$('.sts-tabs .seg-btn').forEach(b => b.onclick = () => setTab(b.dataset.tab));

  const azText = a => { const x = Math.round(((a + 540) % 360) - 180); return x === 0 ? 'no eixo da câmara' : Math.abs(x) === 180 ? 'atrás do sujeito' : `${Math.abs(x)}° à ${x < 0 ? 'esquerda' : 'direita'}`; };
  const elText = e => e === 0 ? 'à altura dos olhos' : `${Math.abs(Math.round(e))}° ${e > 0 ? 'acima' : 'abaixo'}`;

  function lightPanel() {
    const p = $('[data-panel="light"]');
    if (!sel) { p.innerHTML = `<div class="sts-none"><p>Seleciona uma luz na lista, na planta ou clicando no equipamento.</p><p class="sts-hint">Dica: <kbd>1</kbd>–<kbd>8</kbd> ligam e desligam luzes · <kbd>P</kbd> pré-visualiza.</p></div>`; return; }
    const l = sel, s = l.s;
    const mods = Object.entries(MODIFIERS).map(([k, d]) => [k, d.short, d.name]);
    p.innerHTML = `
      <div class="sts-lhead"><i class="sts-dot${l.passive ? ' ring' : ''}" style="--c:${ROLE_COLOR[s.role]}"></i>
        <select class="sts-sel" data-k="role" aria-label="Função">${Object.entries(ROLES).filter(([k]) => (k === 'bounce') === l.passive).map(([k, r]) => `<option value="${k}"${k === s.role ? ' selected' : ''}>${r.name}</option>`).join('')}</select>
        <button class="sts-ico" data-act="toggle" aria-pressed="${s.on}" title="Ligar/desligar">${s.on ? ICON.eye : ICON.eyeOff}</button>
        <button class="sts-ico" data-act="del" title="Remover luz (Delete)">${ICON.trash}</button>
      </div>
      ${l.passive
        ? `<div class="sts-field"><div class="sts-fl"><span>Superfície</span></div>${chips('Superfície', Object.entries(SURFACES).map(([k, v]) => [k, v.name]), s.surface)}</div>
           <p class="sts-hint">Um rebatedor não tem potência própria: devolve parte da luz que recebe. Aproxima-o para encher mais as sombras.</p>`
        : `<div class="sts-field"><div class="sts-fl"><span>Modificador</span><output>${esc(MODIFIERS[s.mod].name)}</output></div>${chips('Modificador', mods, s.mod, 'sts-mods')}</div>
           ${slider({ id: 'power', label: 'Potência', min: -7, max: 0, step: 0.1, value: s.power, out: `${fmtPower(s.power)} · ${Math.round(FULL_WS * Math.pow(2, s.power))} Ws` })}`}
      ${slider({ id: 'dist', label: 'Distância ao rosto', min: 0.45, max: 5, step: 0.05, value: s.dist, out: num(s.dist, 2) + ' m', hint: '' })}
      ${slider({ id: 'az', label: 'Ângulo', min: -180, max: 180, step: 1, value: s.az, out: azText(s.az) })}
      ${slider({ id: 'el', label: 'Altura', min: -60, max: 80, step: 1, value: s.el, out: elText(s.el) })}
      ${slider({ id: 'feather', label: 'Feathering', min: -75, max: 75, step: 1, value: s.feather, out: s.feather ? `${Math.abs(s.feather)}° fora do alvo` : 'apontada ao alvo', hint: 'Rodar a luz para que o sujeito fique na borda do feixe: luz mais suave e menos queda para o fundo.' })}
      ${l.passive ? '' : `
      ${slider({ id: 'kelvin', label: 'Temperatura de cor', min: 2800, max: 9000, step: 100, value: s.kelvin, out: s.kelvin + ' K' })}
      <div class="sts-field"><div class="sts-fl"><label for="sts-gel">Gel</label></div>
        <select class="sts-sel" id="sts-gel" data-k="gel">${Object.entries(GELS).map(([k, g]) => `<option value="${k}"${k === s.gel ? ' selected' : ''}>${g.name}</option>`).join('')}</select></div>
      <div class="sts-field"><div class="sts-fl"><span>Apontar a</span></div>${chips('Apontar a', [['subject', 'Sujeito'], ['backdrop', 'Fundo']], s.aim)}</div>`}
      <div class="sts-readout" id="sts-light-read"></div>`;
    wireLight(p);
    lightReadout();
  }

  function lightReadout() {
    const box = $('#sts-light-read'); if (!box || !sel) return;
    const m = st.lastMeter; if (!m) return;
    const mine = m.per.find(x => x.light === sel)?.H || 0;
    const key = m.per.filter(x => x.light.s.role === 'key' && x.light !== sel).reduce((a, x) => Math.max(a, x.H), 0);
    const fn = Math.sqrt(mine * st.cam.iso / 250);
    let ratio = '';
    if (key > 0 && mine > 0) { const d = Math.log2(mine / key); ratio = `<span>${d >= 0 ? '+' : '−'}${num(Math.abs(d))} stops face à principal</span>`; }
    const d1 = Math.log2(1 / (sel.s.dist * sel.s.dist));
    box.innerHTML = mine > 0.5
      ? `<b>No rosto: ${fmtF(fn)}</b>${ratio}<span class="sts-hint">Lei do inverso do quadrado: a ${num(sel.s.dist, 2)} m chega ${num(Math.abs(d1))} stops ${d1 < 0 ? 'menos' : 'mais'} do que a 1 m.</span>`
      : `<b>No rosto: quase nada</b><span class="sts-hint">${sel.s.aim === 'backdrop' ? 'Esta luz está apontada ao fundo.' : 'Esta luz não chega ao rosto daqui (feixe, ângulo ou está desligada).'}</span>`;
  }

  function wireLight(p) {
    const l = sel;
    p.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.id.replace('sts-', '');
      l.s[k] = +inp.value;
      modified = true;
      st.invalidate('lights', { from: 'ui', light: l });
      updateLightOutputs();
      if (k === 'power') renderLights();
    }));
    p.querySelectorAll('select[data-k]').forEach(se => se.addEventListener('change', () => {
      l.s[se.dataset.k] = se.value; modified = true; st.invalidate('lights'); renderLights(); syncInspector(true);
    }));
    p.querySelectorAll('.sts-chips').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('.sts-chip'); if (!b) return;
      const key = g.getAttribute('aria-label') === 'Modificador' ? 'mod' : g.getAttribute('aria-label') === 'Superfície' ? 'surface' : 'aim';
      l.s[key] = b.dataset.v; modified = true;
      st.invalidate('lights'); renderLights(); syncInspector(true);
    }));
    p.querySelector('[data-act="toggle"]')?.addEventListener('click', () => { l.s.on = !l.s.on; st.invalidate('lights'); renderLights(); syncInspector(true); });
    p.querySelector('[data-act="del"]')?.addEventListener('click', () => removeSel());
  }
  function removeSel() { if (!sel) return; st.removeLight(sel); sel = null; plan.sel = null; modified = true; renderLights(); syncInspector(true); }

  function updateLightOutputs() {
    if (!sel || tab !== 'light') return;
    const s = sel.s, set = (id, t) => { const o = $('#sts-o-' + id); if (o) o.textContent = t; };
    const val = (id, v) => { const i = $('#sts-' + id); if (i && document.activeElement !== i) i.value = v; };
    if (!sel.passive) set('power', `${fmtPower(s.power)} · ${Math.round(FULL_WS * Math.pow(2, s.power))} Ws`);
    set('dist', num(s.dist, 2) + ' m'); set('az', azText(s.az)); set('el', elText(s.el));
    set('feather', s.feather ? `${Math.abs(s.feather)}° fora do alvo` : 'apontada ao alvo');
    set('kelvin', s.kelvin + ' K');
    ['power', 'dist', 'az', 'el', 'feather', 'kelvin'].forEach(k => val(k, s[k]));
    lightReadout();
  }

  function cameraPanel() {
    const p = $('[data-panel="camera"]'), c = st.cam;
    const ai = nearestIdx(APERTURES, c.fnum), si = nearestIdx(SHUTTERS, c.shutter), ii = nearestIdx(ISOS, c.iso), fi = nearestIdx(FOCALS, c.focal);
    p.innerHTML = `
      <div class="sts-meter" id="sts-meter"></div>
      ${slider({ id: 'ap', label: 'Abertura', min: 0, max: APERTURES.length - 1, step: 1, value: ai, out: fmtF(c.fnum), hint: 'Mais fechada (número maior) = menos luz do flash e mais profundidade de campo.' })}
      ${slider({ id: 'sh', label: 'Velocidade', min: 0, max: SHUTTERS.length - 1, step: 1, value: si, out: fmtShutter(c.shutter), hint: '&nbsp;' })}
      ${slider({ id: 'iso', label: 'ISO', min: 0, max: ISOS.length - 1, step: 1, value: ii, out: c.iso, hint: 'Cada duplicação ganha 1 stop e aumenta o ruído, sobretudo nas sombras.' })}
      ${slider({ id: 'wb', label: 'Balanço de brancos', min: 2800, max: 9000, step: 100, value: c.wb, out: c.wb + ' K', hint: 'Igual à temperatura dos flashes (5600 K) = branco neutro.' })}
      <div class="sts-sep"></div>
      ${slider({ id: 'focal', label: 'Distância focal', min: 0, max: FOCALS.length - 1, step: 1, value: fi, out: c.focal + ' mm' })}
      <div class="sts-field"><div class="sts-fl"><span>Enquadrar</span></div>${chips('Enquadrar', [['face', 'Rosto'], ['bust', 'Busto'], ['half', 'Meio corpo'], ['full', 'Corpo inteiro']], c.frame || '')}</div>
      ${slider({ id: 'cdist', label: 'Distância da câmara', min: 0.6, max: 6, step: 0.05, value: c.dist, out: num(c.dist, 2) + ' m', hint: 'A perspetiva (o tamanho do nariz face às orelhas) muda com a distância, não com a focal.' })}
      ${slider({ id: 'cheight', label: 'Altura da câmara', min: 0.5, max: 2.2, step: 0.01, value: c.height, out: num(c.height, 2) + ' m' })}
      <div class="sts-field"><div class="sts-fl"><span>Orientação</span></div>${chips('Orientação', [['portrait', 'Vertical'], ['landscape', 'Horizontal']], c.orient)}</div>
      <div class="sts-toggles">
        <label><input type="checkbox" data-k="dof"${c.dof ? ' checked' : ''}> Profundidade de campo</label>
        <label><input type="checkbox" data-k="zebra"${c.zebra ? ' checked' : ''}> Zebras (realces queimados)</label>
      </div>
      <details class="sts-limits"><summary>O que esta simulação não faz</summary>
        <ul>
          <li>A luz é um modelo aproximado: cada fonte é uma luz de área + um cone com sombra; a suavidade da sombra é estimada a partir do tamanho do modificador, não calculada por traçado de raios.</li>
          <li>Não há luz que ressalte de superfície em superfície — o "ressalto" da sala e do fundo é uma estimativa global.</li>
          <li>A potência dos flashes e a eficiência dos modificadores são ordens de grandeza plausíveis, não medições de equipamento real.</li>
          <li>A profundidade de campo usa a fórmula da ótica fina num sensor full-frame; não há difração, aberrações, vinhetagem real, nem forma de bokeh da objetiva.</li>
          <li>O ruído de ISO é ilustrativo, não o perfil de um sensor real. A faixa de sincronização é simplificada (sem HSS).</li>
        </ul>
      </details>`;
    const set = (id, t) => { const o = $('#sts-o-' + id); if (o) o.textContent = t; };
    const shHint = () => { const h = $('#sts-h-sh'); if (h) h.textContent = c.shutter < SYNC ? `Acima da sincronização (1/${Math.round(1 / SYNC)}): a cortina corta o flash — aparece uma faixa escura.` : c.shutter >= 1 / 30 ? 'Lenta: o flash não muda, mas a luz ambiente da sala começa a aparecer (arrastar o obturador).' : 'Com flash, a velocidade só controla a luz ambiente — o flash dura menos do que o obturador está aberto.'; };
    shHint();
    p.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const id = inp.id.replace('sts-', ''), v = +inp.value;
      if (id === 'ap') { c.fnum = APERTURES[v]; set('ap', fmtF(c.fnum)); }
      if (id === 'sh') { c.shutter = SHUTTERS[v]; set('sh', fmtShutter(c.shutter)); shHint(); }
      if (id === 'iso') { c.iso = ISOS[v]; set('iso', c.iso); }
      if (id === 'wb') { c.wb = v; set('wb', v + ' K'); }
      if (id === 'focal') { c.focal = FOCALS[v]; set('focal', c.focal + ' mm'); c.frame = null; }
      if (id === 'cdist') { c.dist = v; set('cdist', num(v, 2) + ' m'); c.frame = null; }
      if (id === 'cheight') { c.height = v; set('cheight', num(v, 2) + ' m'); }
      st.invalidate(id === 'ap' || id === 'sh' || id === 'iso' || id === 'wb' ? 'exposure' : 'camera');
    }));
    p.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { c[cb.dataset.k] = cb.checked; st.invalidate('exposure'); }));
    p.querySelectorAll('.sts-chips').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('.sts-chip'); if (!b) return;
      if (g.getAttribute('aria-label') === 'Orientação') c.orient = b.dataset.v;
      else frameTo(b.dataset.v);
      st.invalidate('camera'); cameraPanel();
    }));
    meterBox();
  }
  /* enquadramento: distância que põe a altura pedida no fotograma */
  function frameTo(kind) {
    const c = st.cam;
    const H = { face: 0.34, bust: 0.62, half: 1.0, full: 1.9 }[kind];
    const drop = { face: 0.03, bust: 0.12, half: 0.36, full: 0.72 }[kind];
    const sensor = c.orient === 'portrait' ? 36 : 24;
    c.dist = clamp(H * c.focal / sensor, 0.6, 6);
    c.aimDrop = drop; c.frame = kind;
    if (kind === 'full') c.height = 1.1; else if (kind === 'half') c.height = 1.35; else c.height = 1.48;
  }
  function meterBox() {
    const box = $('#sts-meter'); if (!box) return;
    const m = st.lastMeter; if (!m) return;
    const ev = m.ev, pos = clamp(isFinite(ev) ? ev : -3, -3, 3);
    box.innerHTML = `<div class="sts-mtop"><span class="sts-mlab">Fotómetro (incidente, no rosto)</span><b>${m.H > 0.5 ? fmtF(m.fnum) : '—'}</b></div>
      <div class="sts-evbar" role="img" aria-label="Exposição ${isFinite(ev) ? num(ev) : 'sem luz'} EV"><span style="left:${(pos + 3) / 6 * 100}%"></span>${[-3, -2, -1, 0, 1, 2, 3].map(x => `<i style="left:${(x + 3) / 6 * 100}%">${x > 0 ? '+' + x : x}</i>`).join('')}</div>
      <button class="sts-btn sts-btn-sm" data-act="use-meter"${m.H > 0.5 ? '' : ' disabled'}>Usar leitura (${m.H > 0.5 ? fmtF(APERTURES[nearestIdx(APERTURES, m.fnum)]) : '—'})</button>`;
    box.querySelector('[data-act="use-meter"]').onclick = () => { st.cam.fnum = APERTURES[nearestIdx(APERTURES, m.fnum)]; st.invalidate('exposure'); cameraPanel(); };
  }

  function scenePanel() {
    const p = $('[data-panel="scene"]');
    p.innerHTML = `
      <div class="sts-field"><div class="sts-fl"><span>Papel de fundo</span><output>${PAPERS[st.paper].name}</output></div>
        <div class="sts-swatches">${Object.entries(PAPERS).map(([k, v]) => `<button class="sts-sw${k === st.paper ? ' on' : ''}" data-paper="${k}" style="--c:${v.hex}" title="${v.name}" aria-label="${v.name}" aria-pressed="${k === st.paper}"></button>`).join('')}</div></div>
      ${slider({ id: 'bd', label: 'Distância ao fundo', min: 1.2, max: 4.5, step: 0.05, value: st.bdDist, out: num(st.bdDist, 2) + ' m', hint: 'Mais longe = o fundo recebe menos luz da principal e escurece (e desfoca mais).' })}
      ${slider({ id: 'yaw', label: 'Rotação do sujeito', min: -90, max: 90, step: 1, value: st.subj.yaw, out: st.subj.yaw ? `${Math.abs(st.subj.yaw)}° para a ${st.subj.yaw > 0 ? 'direita' : 'esquerda'}` : 'de frente', hint: 'Virar o rosto decide se a luz é larga (broad) ou curta (short).' })}
      <div class="sts-field"><div class="sts-fl"><span>Qualidade das sombras</span></div>${chips('Qualidade', [['1024', 'Normal'], ['2048', 'Alta']], String(st.quality.shadow))}</div>
      <p class="sts-hint">Sujeito: modelo humano sintético montado a partir de assets MakeHuman (CC0). Equipamento e estúdio: modelação procedural própria.</p>`;
    p.querySelectorAll('[data-paper]').forEach(b => b.onclick = () => { st.paper = b.dataset.paper; st.paperHex = PAPERS[st.paper].hex; modified = true; st.invalidate('scene'); scenePanel(); });
    p.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const v = +inp.value;
      if (inp.id === 'sts-bd') { st.bdDist = v; $('#sts-o-bd').textContent = num(v, 2) + ' m'; }
      else { st.subj.yaw = v; $('#sts-o-yaw').textContent = v ? `${Math.abs(v)}° para a ${v > 0 ? 'direita' : 'esquerda'}` : 'de frente'; }
      modified = true; st.invalidate('scene');
    }));
    p.querySelector('.sts-chips').addEventListener('click', e => {
      const b = e.target.closest('.sts-chip'); if (!b) return;
      st.quality.shadow = +b.dataset.v; st.lights.forEach(l => l.shadowSize(st.quality.shadow)); st.invalidate('lights'); scenePanel();
    });
  }

  function syncInspector(rebuild) {
    if (tab === 'light') { if (rebuild || !$('[data-panel="light"] .sts-field') !== !sel) lightPanel(); else updateLightOutputs(); }
    else if (tab === 'camera') { if (rebuild) cameraPanel(); else meterBox(); }
    else if (rebuild) scenePanel();
  }

  /* ── esquemas (com transição) ───────────────────────────────────── */
  const NUMK = ['az', 'el', 'dist', 'power', 'kelvin', 'feather', 'tilt'];
  let anim = null;
  function applyPreset(id, { instant = false } = {}) {
    const P = PRESETS.find(p => p.id === id); if (!P) return;
    curPreset = id; modified = false;
    const old = st.lights.slice();
    /* estrutura: reutiliza luzes por ordem; cria/remove as que faltam/sobram */
    const plan2 = P.lights.map((t, i) => {
      const target = { kelvin: 5600, gel: 'none', feather: 0, tilt: 0, aim: 'subject', on: true, solo: false, ...t };
      let l = old[i];
      const kindOk = l && (l.passive === (t.role === 'bounce'));
      if (!kindOk) { if (l) st.removeLight(l); l = st.addLight({ ...target, power: t.role === 'bounce' ? 0 : -9 }); l._fresh = true; }
      return { l, target };
    });
    old.slice(P.lights.length).forEach(l => st.removeLight(l));
    /* câmara e cena */
    Object.assign(st.cam, DEFAULT_CAM, { fnum: P.fnum, frame: 'bust', aimDrop: 0.12 }, P.cam || {});
    frameTo(P.frame || 'bust'); if (P.cam?.height) st.cam.height = P.cam.height;
    st.paper = P.paper; st.paperHex = PAPERS[P.paper].hex; st.bdDist = P.bdDist;
    const from = plan2.map(({ l }) => ({ ...l.s }));
    const fromYaw = st.subj.yaw;
    /* acerto de potência: aplica o estado final, mede, desloca em bloco */
    plan2.forEach(({ l, target }) => { Object.assign(l.s, target); if (!l.passive) l.s.power = target.power ?? 0; });
    st.subj.yaw = P.yaw || 0;
    st.updateScene();
    const m = st.meter();
    const need = 250 * P.fnum * P.fnum / st.cam.iso * Math.pow(2, P.ev || (P.id === 'rim' ? -0.6 : 0));
    const shift = m.H > 0 ? Math.log2(need / m.H) : 0;
    let maxP = -Infinity;
    plan2.forEach(({ l }) => { if (!l.passive) { l.s.power += shift; maxP = Math.max(maxP, l.s.power); } });
    if (maxP > 0) plan2.forEach(({ l }) => { if (!l.passive) l.s.power -= maxP; });   // não passa de 1/1: o fotómetro avisa
    plan2.forEach(({ l }) => { if (!l.passive) l.s.power = clamp(+l.s.power.toFixed(1), -7, 0); });
    const to = plan2.map(({ l }) => ({ ...l.s }));
    const toYaw = st.subj.yaw;
    select(null);
    $$('.sts-preset').forEach(b => b.classList.toggle('on', b.dataset.preset === id));
    showTip(P);
    if (instant || reduced()) { st.invalidate('lights'); renderLights(); syncInspector(true); return; }
    /* transição */
    plan2.forEach(({ l }, i) => { Object.assign(l.s, to[i]); NUMK.forEach(k => { if (!l._fresh) l.s[k] = from[i][k]; }); if (l._fresh && !l.passive) l.s.power = -9; });
    st.subj.yaw = fromYaw;
    const t0 = performance.now(), D = 700;
    anim = () => {
      const k = ease(Math.min(1, (performance.now() - t0) / D));
      plan2.forEach(({ l }, i) => {
        NUMK.forEach(key => {
          let a = l._fresh ? to[i][key] : from[i][key], b = to[i][key];
          if (key === 'power' && l._fresh) a = -9;
          if (key === 'az') { let d = ((b - a + 540) % 360) - 180; l.s.az = a + d * k; }
          else l.s[key] = a + (b - a) * k;
        });
      });
      st.subj.yaw = fromYaw + (toYaw - fromYaw) * k;
      st.invalidate('lights');
      if (k >= 1) { anim = null; plan2.forEach(({ l }, i) => { Object.assign(l.s, to[i]); delete l._fresh; }); renderLights(); syncInspector(true); }
    };
    renderLights(); syncInspector(true);
  }
  st.tick = () => { if (anim) anim(); };
  $('.sts-presets').addEventListener('click', e => { const b = e.target.closest('[data-preset]'); if (b) applyPreset(b.dataset.preset); });

  function showTip(P) {
    const tip = $('.sts-tip');
    const lp = P.lp && window.PhotoLightArt?.byId?.(P.lp);
    tip.innerHTML = `<b>${esc(P.name)}</b><p>${esc(P.hint)}</p>${lp ? `<p><span>O que procurar</span>${esc(lp.tell)}</p><p><span>Cuidado</span>${esc(lp.watch)}</p>` : ''}`;
  }

  /* ── A/B ────────────────────────────────────────────────────────── */
  const cmpBtn = $('[data-act="compare"]');
  $('[data-act="snap"]').onclick = () => { st.takeSnapshot(); afterSnap(); };
  function afterSnap() {
    cmpBtn.disabled = false;
    toast('Referência A guardada. Muda a luz e carrega em A | B para comparar.');
    if (st.view.split >= 0) st.invalidate('view');
  }
  cmpBtn.onclick = () => {
    const on = st.view.split < 0;
    st.view.split = on ? 0.5 : -1;
    cmpBtn.setAttribute('aria-pressed', on);
    cmpBtn.classList.toggle('on', on);
    $('.sts-split-hint').hidden = !on;
    if (on && st.view.main !== 'photo') setMain('photo');
    st.invalidate('view');
  };
  let splitDrag = false;
  const splitAt = e => {
    const L = st.lastLayout?.photo; if (!L) return false;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = r.height - (e.clientY - r.top);
    if (x < L.x || x > L.x + L.w || y < L.y || y > L.y + L.h) return false;
    st.view.split = clamp((x - L.x) / L.w, 0, 1); st.invalidate('view'); return true;
  };
  canvas.addEventListener('pointerdown', e => { if (st.view.split >= 0 && st.view.main === 'photo' && splitAt(e)) { splitDrag = true; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => { if (splitDrag) splitAt(e); });
  canvas.addEventListener('pointerup', () => (splitDrag = false));

  /* ── pré-visualização ───────────────────────────────────────────── */
  let prevMain = 'editor';
  function preview(on) {
    const is = root.classList.contains('is-preview');
    if (on === undefined) on = !is;
    if (on === is) return;
    if (on) { prevMain = st.view.main; setMain('photo'); st.view.inset = false; }
    root.classList.toggle('is-preview', on);
    $('.sts-exit').hidden = !on;
    if (on) { root.requestFullscreen?.().catch(() => {}); }
    else { if (document.fullscreenElement === root) document.exitFullscreen?.(); st.view.inset = true; setMain(prevMain); }
    setTimeout(resize, 30);
  }
  $$('[data-act="preview"]').forEach(b => b.onclick = () => preview());
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && root.classList.contains('is-preview')) preview(false); });

  /* ── teclado ────────────────────────────────────────────────────── */
  const onKey = e => {
    if (!root.isConnected || (!root.offsetParent && !root.classList.contains('is-preview'))) return;
    if (e.target.closest('input, select, textarea') && e.key !== 'Escape') return;
    if (e.key === 'Escape') { if (root.classList.contains('is-preview')) preview(false); else select(null); }
    else if (e.key === 'p' || e.key === 'P') preview();
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && (e.target.closest('.sts') || e.target === document.body)) { e.preventDefault(); removeSel(); }
    else if (/^[1-8]$/.test(e.key) && st.lights[+e.key - 1]) { const l = st.lights[+e.key - 1]; l.s.on = !l.s.on; st.invalidate('lights'); renderLights(); syncInspector(); }
  };
  document.addEventListener('keydown', onKey);

  /* ── painéis móveis ─────────────────────────────────────────────── */
  $$('.sts-mtabs .seg-btn').forEach(b => b.onclick = () => {
    root.dataset.mtab = b.dataset.mtab;
    $$('.sts-mtabs .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.mtab === 'plan') setTimeout(() => plan.draw(), 20);
  });

  /* ── avisos ─────────────────────────────────────────────────────── */
  let toastT;
  function toast(msg) {
    let t = $('.sts-toast');
    if (!t) { t = document.createElement('div'); t.className = 'sts-toast'; t.setAttribute('role', 'status'); stage.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
  }

  /* ── ligação ao motor ───────────────────────────────────────────── */
  let planT = 0;
  st.on((what, detail) => {
    if (what === 'compiling') { if (detail) toast('A preparar sombras para mais de 4 luzes (só desta vez)…'); return; }
    if (what === 'frame') {
      hud(detail);
      if (tab === 'camera') meterBox(); else if (tab === 'light') lightReadout();
      for (const l of st.lights) l.label = lightLabel(l);
      cancelAnimationFrame(planT); planT = requestAnimationFrame(() => plan.draw());
      return;
    }
    if (detail?.from === 'gizmo' || detail?.from === 'plan') { modified = true; updateLightOutputs(); }
    if (what === 'camera' && tab === 'camera' && detail?.from === 'plan') cameraPanel();
  });

  /* pausa quando o separador não está visível */
  const vis = () => { st.paused = document.hidden || !root.isConnected || (!root.offsetParent && !root.classList.contains('is-preview')); if (!st.paused) st.invalidate('view'); };
  document.addEventListener('visibilitychange', vis);
  const io = new IntersectionObserver(es => { st.paused = !es[0].isIntersecting || document.hidden; if (!st.paused) { resize(); st.invalidate('view'); } });
  io.observe(root);

  /* arranque: Rembrandt, já medido */
  st.paperHex = PAPERS[st.paper].hex;
  applyPreset('rembrandt', { instant: true });
  setTab('light');
  if (!mobile) select(st.lights[0]);
  syncPlan();
  $('.sts-loading p').textContent = 'A preparar a luz…';
  try { await st.precompile(); } catch (e) { console.warn('[studio] precompile', e); }
  $('.sts-loading').hidden = true;
  st.start();
  window.__studio = st;           // útil para testes e depuração

  return {
    studio: st,
    pause() { st.paused = true; },
    resume() { st.paused = false; resize(); st.invalidate('view'); },
    dispose() { ro.disconnect(); io.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', vis); st.dispose(); host.innerHTML = ''; },
  };
}
