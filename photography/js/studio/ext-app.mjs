/* ══════════════════════════════════════════════════════════════════════
   Exterior — aplicação: uma rua de cidade para aprender o que o estúdio
   não mostra bem: profundidade de campo e bokeh com fundo longe, o
   obturador a congelar ou arrastar o movimento, o ISO à noite, o tremido
   e o balanço de brancos com luzes misturadas.

   A fotografia é o ecrã principal; a planta mostra onde está a zona nítida.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, DEG, clamp, kelvinRGB } from './st-core.mjs';
import { loadSubject } from './st-subject.mjs';
import { buildCity, TIMES, K, SUBJECT } from './ext-city.mjs';
import { createOptics } from './ext-optics.mjs';
import { cocFactor } from './st-post.mjs';
import { APERTURES, FOCALS, fmtF } from './st-presets.mjs';

export const SHUTTERS_X = [30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000];
export const ISOS_X = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600];
const COC_MM = 0.03;                 // círculo de confusão "aceitável" em full-frame
const CAR_V = 40 / 3.6;              // velocidade de referência para as contas (40 km/h)

export const fmtT = t => t >= 0.3 ? (Math.round(t * 10) / 10).toString().replace('.', ',') + ' s' : '1/' + Math.round(1 / t);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 1) => (+v).toFixed(d).replace('.', ',');
const nearestIdx = (arr, v) => { let bi = 0, bd = Infinity; arr.forEach((x, i) => { const d = Math.abs(Math.log(x / v)); if (d < bd) { bd = d; bi = i; } }); return bi; };
const fmtM = (m, fine = false) => !isFinite(m) ? '∞' : m >= 100 ? Math.round(m) + ' m' : m >= 10 ? num(m, 0) + ' m' : m >= 1 ? num(m, fine ? 2 : 1) + ' m' : Math.round(m * 100) + ' cm';
const fmtLux = e => e >= 1000 ? Math.round(e / 1000).toLocaleString('pt-PT') + ' 000 lux' : e >= 10 ? Math.round(e) + ' lux' : num(e, 1) + ' lux';

/* ── situações: cada uma ensina uma coisa ───────────────────────────── */
export const SCENES = [
  { id: 'bokeh', name: 'Retrato com bokeh', tod: 'blue', learn: 'Abertura',
    cam: { focal: 85, fnum: 1.8, mode: 'A', iso: 2500, dist: 2.4, az: 10, height: 1.5, orient: 'portrait', tripod: false, stab: true, focus: 'eye' },
    text: 'f/1,8 com o fundo longe: cada luz da rua vira um disco. Fecha para f/8 e vê os discos encolherem e ganharem a forma das lâminas do diafragma.' },
  { id: 'deep', name: 'Tudo nítido', tod: 'day', learn: 'Hiperfocal',
    cam: { focal: 24, fnum: 11, mode: 'A', iso: 100, dist: 3.4, az: 14, height: 1.55, orient: 'landscape', tripod: false, focus: 'hyper' },
    text: 'Grande-angular a f/11 focada na distância hiperfocal: do sujeito ao fundo da rua fica tudo aceitavelmente nítido. Liga a "zona nítida" para ver até onde vai.' },
  { id: 'freeze', name: 'Congelar o trânsito', tod: 'day', learn: 'Obturador rápido',
    cam: { focal: 35, fnum: 4, mode: 'S', shutter: 1 / 2000, iso: 200, dist: 9.5, az: 90, height: 1.5, orient: 'landscape', tripod: false, focus: 'eye' },
    text: 'Do outro lado da rua, a 1/2000 s: um carro a 40 km/h anda menos de 1 cm enquanto o obturador está aberto — fica parado na foto.' },
  { id: 'drag', name: 'Arrastar o movimento', tod: 'blue', learn: 'Obturador lento',
    cam: { focal: 35, fnum: 4, mode: 'S', shutter: 1 / 4, iso: 800, dist: 9.5, az: 90, height: 1.5, orient: 'landscape', tripod: true, focus: 'eye' },
    text: 'Tripé e 1/4 s: a pessoa, quieta, fica nítida; os carros viram borrões transparentes. Experimenta 1/60 e 1 s.' },
  { id: 'trails', name: 'Rastos de luz', tod: 'night', learn: 'Exposição longa',
    cam: { focal: 24, fnum: 8, mode: 'A', iso: 100, dist: 3.6, az: 16, height: 1.45, orient: 'landscape', tripod: true, focus: 'hyper' },
    text: 'Vários segundos de exposição: os carros quase desaparecem e ficam os faróis — brancos os que vêm, vermelhos os que vão.' },
  { id: 'highiso', name: 'Noite à mão', tod: 'night', learn: 'ISO',
    cam: { focal: 50, fnum: 2, mode: 'M', shutter: 1 / 60, isoAuto: true, dist: 2.6, az: 12, height: 1.5, orient: 'portrait', tripod: false, focus: 'eye' },
    text: 'Sem tripé a velocidade não pode descer muito, por isso o ISO automático sobe — e aparece o ruído, sobretudo nas sombras.' },
  { id: 'shake', name: 'Foto tremida', tod: 'night', learn: 'Tremido',
    cam: { focal: 85, fnum: 2.8, mode: 'S', shutter: 1 / 8, iso: 400, dist: 2.6, az: 12, height: 1.5, orient: 'portrait', tripod: false, stab: false, focus: 'eye' },
    text: 'Regra prática: à mão, não mais lento do que 1/focal (aqui 1/85 s). A 1/8 s tudo treme. Liga o estabilizador (≈4 stops) ou o tripé.' },
  { id: 'backlight', name: 'Contraluz dourada', tod: 'golden', learn: 'Medição',
    cam: { focal: 85, fnum: 2, mode: 'A', iso: 100, dist: 2.4, az: 4, height: 1.5, orient: 'portrait', tripod: false, focus: 'eye' },
    text: 'Sol baixo atrás da pessoa. O fotómetro mede a luz no rosto (na sombra), por isso o céu queima — é o "look" de fim de tarde. Liga as zebras.' },
];
const DEFAULT = { tod: 'blue', focal: 85, fnum: 1.8, shutter: 1 / 125, iso: 800, isoAuto: false, mode: 'A', wb: 4300, wbAuto: true, dist: 2.4, az: 10, height: 1.5, orient: 'portrait', focus: 'eye', focusD: 2.4, tripod: false, stab: false, traffic: true, zebra: false, peak: false };

function slider({ id, label, min, max, step, value, out, hint, disabled }) {
  return `<div class="sts-field${disabled ? ' is-auto' : ''}" data-f="${id}">
    <div class="sts-fl"><label for="ext-${id}">${label}</label><output id="ext-o-${id}">${out ?? value}</output></div>
    <input type="range" id="ext-${id}" min="${min}" max="${max}" step="${step}" value="${value}"${disabled ? ' disabled' : ''}>
    ${hint ? `<p class="sts-hint" id="ext-h-${id}">${hint}</p>` : ''}
  </div>`;
}
function chips(name, items, cur, attr = 'v') {
  return `<div class="sts-chips" role="radiogroup" aria-label="${esc(name)}">${items.map(([v, t, title]) =>
    `<button type="button" role="radio" class="sts-chip${v === cur ? ' on' : ''}" aria-checked="${v === cur}" data-${attr}="${v}"${title ? ` title="${esc(title)}"` : ''}>${t}</button>`).join('')}</div>`;
}

/* ═════════════════════════════════════════════════════════════════════ */
export async function mount(host) {
  const mobile = window.matchMedia('(max-width: 900px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  host.innerHTML = `
  <div class="sts sts-ext" data-mtab="presets" data-plan="on">
    <header class="sts-bar">
      <div class="ext-title"><b>Rua</b><span class="ext-tod-name"></span></div>
      <div class="sts-ab" role="group" aria-label="Antes e depois">
        <button class="sts-btn" data-act="shot" title="Outro instante: os carros mudam de sítio (Espaço)"><span>Novo disparo</span></button>
        <button class="sts-btn" data-act="snap" title="Guardar esta fotografia como referência A"><span>Fixar A</span></button>
        <button class="sts-btn" data-act="compare" disabled aria-pressed="false" title="Comparar a referência com a fotografia atual">A | B</button>
      </div>
    </header>

    <aside class="sts-left" aria-label="Situações e explicação">
      <section class="sts-sec sts-presets-sec" data-mpanel="presets">
        <h3 class="sts-h">Situações</h3>
        <div class="ext-scenes">${SCENES.map(s => `<button class="ext-scene" data-scene="${s.id}"><small>${esc(s.learn)}</small><b>${esc(s.name)}</b></button>`).join('')}</div>
        <h3 class="sts-h ext-h2">Hora do dia</h3>
        ${chips('Hora do dia', Object.entries(TIMES).map(([k, t]) => [k, t.short, t.name]), '', 'tod')}
        <div class="sts-tip ext-tip" aria-live="polite"></div>
      </section>
      <section class="sts-sec" data-mpanel="lights">
        <h3 class="sts-h">Nesta fotografia</h3>
        <div class="ext-explain" aria-live="polite"></div>
      </section>
    </aside>

    <main class="sts-stage ext-stage">
      <canvas class="sts-gl" tabindex="0" aria-label="Fotografia da rua. Clica num ponto para focar aí."></canvas>
      <div class="sts-plan-wrap ext-plan-wrap" data-mpanel="plan">
        <canvas class="sts-plan ext-plan" aria-label="Planta da rua vista de cima, com a câmara, o sujeito e a zona nítida. Clica para focar a essa distância."></canvas>
        <span class="sts-plan-lab">Planta · zona nítida</span>
      </div>
      <div class="sts-hud" aria-live="polite">
        <div class="sts-lcd"></div>
        <canvas class="sts-histo" width="128" height="40" aria-hidden="true"></canvas>
      </div>
      <div class="ext-progress" aria-hidden="true"><i></i></div>
      <p class="ext-focus-hint">Clica na foto para focar</p>
      <div class="sts-loading"><div class="sts-spin"></div><p>A construir a rua…</p></div>
    </main>

    <aside class="sts-right" aria-label="Câmara" data-mpanel="inspector">
      <div class="sts-insp ext-cam"></div>
    </aside>

    <nav class="sts-mtabs seg" role="tablist" aria-label="Painéis">
      <button class="seg-btn active" data-mtab="presets">Situações</button>
      <button class="seg-btn" data-mtab="lights">Explicação</button>
      <button class="seg-btn" data-mtab="inspector">Câmara</button>
      <button class="seg-btn" data-mtab="plan">Planta</button>
    </nav>
  </div>`;

  const root = host.querySelector('.sts-ext');
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const canvas = $('.sts-gl'), stage = $('.ext-stage');
  const fitHeight = () => {
    const top = root.getBoundingClientRect().top;
    root.style.height = mobile ? '' : Math.max(600, window.innerHeight - Math.max(0, top) - 14) + 'px';
  };
  fitHeight();

  /* ── motor ─────────────────────────────────────────────────────── */
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  /* a cena só é desenhada para alvos HDR lineares: com saída linear e sem tone mapping, a
     pré-compilação (alvo nulo) gera exatamente os mesmos programas que o render real */
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const city = buildCity(renderer, { mobile });
  const optics = createOptics(renderer, { mobile });
  const cam = new THREE.PerspectiveCamera(30, 2 / 3, 0.1, 1500);
  const s = { ...DEFAULT };
  let sceneId = null, t0 = 60, seed = Math.random();

  let subject = null, ref = { eyeL: [0.029, 1.51, 0.026], eyeR: [-0.029, 1.51, 0.026] };
  try {
    const sub = await loadSubject();
    subject = sub.group; if (sub.ref) ref = sub.ref;
    /* no estúdio o ambiente é a sala (desligado); aqui o céu ilumina a pessoa */
    subject.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 1; } });
    subject.position.set(SUBJECT.x, 0.15, SUBJECT.z);
    city.scene.add(subject);
  } catch (e) {
    console.error(e);
    $('.sts-loading').innerHTML = '<p>Não foi possível carregar a rua.</p>';
    return { pause() {}, resume() {}, dispose() { renderer.dispose(); host.innerHTML = ''; } };
  }

  /* ── geometria da câmara ───────────────────────────────────────── */
  const face = () => {
    const m = new THREE.Vector3((ref.eyeL[0] + ref.eyeR[0]) / 2, (ref.eyeL[1] + ref.eyeR[1]) / 2, (ref.eyeL[2] + ref.eyeR[2]) / 2);
    return m.applyAxisAngle(new THREE.Vector3(0, 1, 0), s.az * DEG).add(subject.position);
  };
  const sensorH = () => s.orient === 'portrait' ? 36 : 24;
  function placeCamera() {
    const F = face();
    subject.rotation.y = s.az * DEG;
    const C = F.clone().add(new THREE.Vector3(Math.sin(s.az * DEG), 0, Math.cos(s.az * DEG)).multiplyScalar(s.dist));
    C.x = clamp(C.x, -7.2, 7.2); C.y = s.height;
    cam.position.copy(C);
    const aim = F.clone(); aim.y -= s.orient === 'portrait' ? 0.1 : 0.25;
    cam.lookAt(aim);
    cam.fov = 2 * Math.atan(sensorH() / 2 / s.focal) / DEG;
    cam.aspect = s.orient === 'portrait' ? 2 / 3 : 3 / 2;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    return { F, C };
  }
  const viewDir = () => new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);

  /* ── ótica (lente fina) ────────────────────────────────────────── */
  const hyper = () => { const f = s.focal / 1000; return f * f / (s.fnum * COC_MM / 1000) + f; };
  function focusDist() {
    if (s.focus === 'hyper') return hyper();
    if (s.focus === 'eye') { const F = face(); return F.clone().sub(cam.position).dot(viewDir()); }
    return s.focusD;
  }
  function dofRange(sd) {
    const f = s.focal / 1000, H = hyper();
    const nearD = sd * (H - f) / (H + sd - 2 * f);
    const farD = sd < H ? sd * (H - f) / (H - sd) : Infinity;
    return [nearD, farD];
  }

  /* ── exposição ─────────────────────────────────────────────────── */
  function meter() {
    const { F, C } = placeCamera();
    const dome = C.clone().sub(F).normalize();
    return city.meterAt(F, dome);
  }
  const need = () => 250 * s.fnum * s.fnum / s.iso;          // lux·s para o rosto ficar "certo"
  function autoExpose(E) {
    const flags = [];
    if (s.mode === 'A') {
      const t = 250 * s.fnum * s.fnum / (s.iso * E);
      s.shutter = SHUTTERS_X[nearestIdx(SHUTTERS_X, clamp(t, 1 / 8000, 30))];
      if (t > 30.5) flags.push('A velocidade chegou a 30 s e ainda falta luz.');
      if (t < 1 / 8100) flags.push('Nem a 1/8000 s chega: fecha o diafragma ou baixa o ISO.');
    } else if (s.mode === 'S') {
      const n = Math.sqrt(E * s.shutter * s.iso / 250);
      s.fnum = APERTURES[nearestIdx(APERTURES, clamp(n, 1.4, 22))];
      if (n < 1.35) flags.push('A objetiva já está toda aberta (f/1,4) e falta luz: sobe o ISO ou abranda.');
      if (n > 23) flags.push('Fechada a f/22 ainda entra luz a mais: velocidade mais rápida ou filtro ND.');
    }
    if (s.mode === 'M' && s.isoAuto) {
      const iso = 250 * s.fnum * s.fnum / (E * s.shutter);
      s.iso = ISOS_X[nearestIdx(ISOS_X, clamp(iso, 100, 25600))];
      if (iso > 26000) flags.push('Mesmo a ISO 25 600 falta luz.');
    }
    return flags;
  }
  const exposureX = () => Math.PI * s.iso * s.shutter / (250 * s.fnum * s.fnum) / K;

  /* ── subexposições ─────────────────────────────────────────────── */
  let k = 0, N = 8, dirty = true, lastE = 0, flags = [], shake = null, lens = null;
  const PER_FRAME = mobile ? 1 : 2;
  function targetSamples() {
    const imgH = optics.size[1] || 800;
    const pxPerM = s.focal / sensorH() * imgH;               // píxeis por metro a 1 m
    let motion = 0;
    if (s.traffic) motion = 14 * s.shutter * pxPerM / 6;      // carro rápido a ~6 m
    const w = shakeOmega();
    if (w > 0) motion = Math.max(motion, w * s.shutter * s.focal / sensorH() * imgH * 1.2);
    return clamp(Math.ceil(motion / 2.5), mobile ? 6 : 10, mobile ? 40 : 96);
  }
  /* tremido: ~1,7°/s faz a regra 1/focal dar ~1 círculo de confusão; estabilizador = 4 stops */
  const shakeOmega = () => s.tripod ? 0 : 0.03 * (s.stab ? 1 / 16 : 1);

  function restart() {
    const E = meter();
    lastE = E;
    flags = autoExpose(E);
    const sd = focusDist();
    const imgH = optics.size[1];
    lens = {
      exposure: exposureX(), focusD: sd, fnum: s.fnum, near: cam.near, far: cam.far,
      /* raio do círculo de confusão em píxeis = metade do diâmetro da lente fina */
      cocK: cocFactor({ focal: s.focal, fnum: s.fnum, focus: sd, sensorH: sensorH(), imageH: imgH }) * 0.5,
      maxCoc: Math.min(optics.maxPt / 2 - 1, imgH * 0.09),
    };
    optics.setLens(lens);
    for (const m of city.plan.movers) m.car.visible = s.traffic;
    N = targetSamples(); k = 0;
    const a = Math.random() * Math.PI * 2;
    shake = { u: new THREE.Vector2(Math.cos(a), Math.sin(a)), b: Math.random() * 6 };
    dirty = false;
    panelsOnFrame();
  }

  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  function renderSub() {
    const { C } = placeCamera();
    const u = (k + 0.5 + (Math.random() - 0.5) * 0.9) / N;           // instante dentro do obturador (estratificado)
    city.setMoment(t0 + u * s.shutter, s.shutter / N);
    /* tremido: rotação que cresce com o tempo (deriva + um pouco de oscilação) */
    const w = shakeOmega();
    if (w > 0) {
      const tt = (u - 0.5) * s.shutter;
      const ang = w * tt, wob = w * 0.35 * s.shutter * Math.sin(u * 9.4 + shake.b);
      cam.rotateY(shake.u.x * ang - shake.u.y * wob);
      cam.rotateX(shake.u.y * ang + shake.u.x * wob);
    }
    /* antisserrilhado: desvio subpíxel do enquadramento */
    const [W, H] = optics.size;
    cam.setViewOffset(W, H, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, W, H);
    cam.updateMatrixWorld();
    if (k === 0 || s.traffic) renderer.shadowMap.needsUpdate = true;
    optics.subframe(city.scene, cam, k);
    cam.clearViewOffset();
    cam.position.copy(C);
    k++;
  }

  /* ── desenho ───────────────────────────────────────────────────── */
  let photoRect = null, W = 0, H = 0, raf = 0, paused = false, splitPos = 0.5, compare = false;
  function layout() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    renderer.setSize(W, H, false);
    const asp = s.orient === 'portrait' ? 2 / 3 : 3 / 2;
    /* a foto fica à direita da planta e acima do HUD */
    const padX = mobile ? 8 : 14, padT = mobile ? 8 : 14, padB = mobile ? 48 : 62;
    const reserveL = !mobile ? Math.min(300, Math.max(200, W * 0.27)) + 16 : 0;
    const aw = W - padX * 2 - reserveL, ah = H - padT - padB;
    let w = aw, h = w / asp; if (h > ah) { h = ah; w = h * asp; }
    const x = padX + reserveL + (aw - w) / 2, yTop = padT + (ah - h) / 2;
    photoRect = { x: Math.round(x), y: Math.round(H - yTop - h), w: Math.round(w), h: Math.round(h), top: Math.round(yTop) };
    /* resolução do render: a do ecrã, com teto */
    const cap = mobile ? 1100 : 1700, sc = Math.min(dpr, cap / Math.max(w, h));
    optics.resize(w * sc, h * sc);
    dirty = true;
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (paused) return;
    if (dirty) restart();
    if (k >= N && !needPresent) return;
    if (k < N) { for (let i = 0; i < PER_FRAME && k < N; i++) renderSub(); }
    optics.developTo({ exposure: lens.exposure, wb: wbGains(), noise: noiseAmp(), seed });
    renderer.setRenderTarget(null); renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
    renderer.setClearColor(0x08090b, 1); renderer.clear();
    optics.presentTo(photoRect, { split: compare ? splitPos : -1, zebra: s.zebra, peak: s.peak, dof: dofRange(lens.focusD) });
    needPresent = false;
    $('.ext-progress').style.setProperty('--p', (k / N).toFixed(3));
    $('.ext-progress').classList.toggle('on', N > 12 && k < N);
    if (k >= N) { clearTimeout(histT); histT = setTimeout(drawHisto, 120); }
  }
  let needPresent = true, histT = 0;
  function wbGains() {
    const k0 = s.wbAuto ? TIMES[s.tod].wb : s.wb;
    const c = kelvinRGB(k0);
    return [1 / c[0], 1 / c[1], 1 / c[2]];
  }
  const noiseAmp = () => s.iso <= 100 ? 0 : 0.06 * Math.log2(s.iso / 100) * (1 + Math.max(0, Math.log2(s.iso / 3200)) * 0.25);

  /* ── interface: câmara ─────────────────────────────────────────── */
  function cameraPanel() {
    const p = $('.ext-cam');
    const A = s.mode === 'S', T = s.mode === 'A', I = s.mode === 'M' && s.isoAuto;
    p.innerHTML = `
      <div class="sts-meter" id="ext-meter"></div>
      <div class="sts-field"><div class="sts-fl"><span>Modo</span></div>${chips('Modo', [['M', 'M · manual', 'Escolhes tudo'], ['A', 'A · abertura', 'Escolhes a abertura; a câmara escolhe a velocidade'], ['S', 'S · velocidade', 'Escolhes a velocidade; a câmara escolhe a abertura']], s.mode, 'mode')}</div>
      ${slider({ id: 'ap', label: 'Abertura' + (A ? ' <em>auto</em>' : ''), min: 0, max: APERTURES.length - 1, step: 1, value: nearestIdx(APERTURES, s.fnum), out: fmtF(s.fnum), disabled: A, hint: 'Número pequeno = mais luz e fundo mais desfocado.' })}
      ${slider({ id: 'sh', label: 'Velocidade' + (T ? ' <em>auto</em>' : ''), min: 0, max: SHUTTERS_X.length - 1, step: 1, value: nearestIdx(SHUTTERS_X, s.shutter), out: fmtT(s.shutter), disabled: T, hint: 'Rápida congela o movimento; lenta arrasta-o (e pede tripé).' })}
      ${slider({ id: 'iso', label: 'ISO' + (I ? ' <em>auto</em>' : ''), min: 0, max: ISOS_X.length - 1, step: 1, value: nearestIdx(ISOS_X, s.iso), out: s.iso, disabled: I, hint: 'Cada duplicação ganha 1 stop de luz e traz mais ruído.' })}
      <div class="sts-toggles ext-tg1"><label${s.mode !== 'M' ? ' class="is-dim"' : ''}><input type="checkbox" data-k="isoAuto"${s.isoAuto ? ' checked' : ''}${s.mode !== 'M' ? ' disabled' : ''}> ISO automático (no modo M)</label></div>
      ${slider({ id: 'wb', label: 'Balanço de brancos', min: 2000, max: 9000, step: 100, value: s.wbAuto ? TIMES[s.tod].wb : s.wb, out: s.wbAuto ? 'auto · ' + TIMES[s.tod].wb + ' K' : s.wb + ' K', hint: 'Valor baixo arrefece a imagem (corrige luz laranja); alto aquece-a.' })}
      <div class="sts-toggles"><label><input type="checkbox" data-k="wbAuto"${s.wbAuto ? ' checked' : ''}> Balanço automático</label></div>
      <div class="sts-sep"></div>
      ${slider({ id: 'focal', label: 'Distância focal', min: 0, max: FOCALS.length - 1, step: 1, value: nearestIdx(FOCALS, s.focal), out: s.focal + ' mm' })}
      <div class="sts-field"><div class="sts-fl"><span>Foco</span><output id="ext-o-fd">${fmtM(focusDist())}</output></div>${chips('Foco', [['eye', 'No olho'], ['hyper', 'Hiperfocal'], ['manual', 'Manual']], s.focus, 'focus')}</div>
      ${s.focus === 'manual' ? slider({ id: 'fd', label: 'Distância de foco', min: 0, max: 100, step: 0.5, value: fdToSlider(s.focusD), out: fmtM(s.focusD), hint: 'Também podes clicar na fotografia ou na planta.' }) : ''}
      <div class="sts-sep"></div>
      ${slider({ id: 'dist', label: 'Distância ao sujeito', min: 0.8, max: 12, step: 0.1, value: s.dist, out: num(s.dist, 1) + ' m' })}
      ${slider({ id: 'az', label: 'Ângulo da câmara', min: -30, max: 95, step: 1, value: s.az, out: s.az + '°', hint: '0° = de frente, ao longo do passeio; 90° = do outro lado da rua.' })}
      ${slider({ id: 'height', label: 'Altura da câmara', min: 0.4, max: 2.2, step: 0.05, value: s.height, out: num(s.height, 2) + ' m' })}
      <div class="sts-field"><div class="sts-fl"><span>Orientação</span></div>${chips('Orientação', [['portrait', 'Vertical'], ['landscape', 'Horizontal']], s.orient, 'orient')}</div>
      <div class="sts-toggles">
        <label><input type="checkbox" data-k="tripod"${s.tripod ? ' checked' : ''}> Tripé</label>
        <label${s.tripod ? ' class="is-dim"' : ''}><input type="checkbox" data-k="stab"${s.stab ? ' checked' : ''}${s.tripod ? ' disabled' : ''}> Estabilizador (≈4 stops)</label>
        <label><input type="checkbox" data-k="traffic"${s.traffic ? ' checked' : ''}> Trânsito</label>
        <label><input type="checkbox" data-k="peak"${s.peak ? ' checked' : ''}> Mostrar a zona nítida</label>
        <label><input type="checkbox" data-k="zebra"${s.zebra ? ' checked' : ''}> Zebras (realces queimados)</label>
      </div>
      <details class="sts-limits"><summary>O que esta simulação não faz</summary>
        <ul>
          <li>A rua, os carros e as luzes são modelação procedural própria; as intensidades são ordens de grandeza reais (lux e cd/m²), não medições de um sítio.</li>
          <li>A profundidade de campo usa a ótica fina num sensor full-frame (círculo de confusão de 0,03 mm). O bokeh tem forma de diafragma e "olho de gato", mas não há aberrações nem difração.</li>
          <li>O movimento é a média de várias subexposições; a pessoa está sempre quieta. O tremido é um modelo simples (≈1,7°/s à mão).</li>
          <li>O ruído é ilustrativo, não o perfil de um sensor real. O fotómetro mede a luz incidente no rosto, como no Estúdio.</li>
        </ul>
      </details>`;
    p.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
      const id = inp.id.replace('ext-', ''), v = +inp.value;
      if (id === 'ap') s.fnum = APERTURES[v];
      if (id === 'sh') s.shutter = SHUTTERS_X[v];
      if (id === 'iso') s.iso = ISOS_X[v];
      if (id === 'wb') { s.wb = v; s.wbAuto = false; const cb = p.querySelector('[data-k="wbAuto"]'); if (cb) cb.checked = false; }
      if (id === 'focal') s.focal = FOCALS[v];
      if (id === 'fd') s.focusD = sliderToFd(v);
      if (id === 'dist') s.dist = v;
      if (id === 'az') s.az = v;
      if (id === 'height') s.height = v;
      sceneId = null; markScene();
      dirty = true;
      outputs();
    }));
    p.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      s[cb.dataset.k] = cb.checked; sceneId = null; markScene();
      if (cb.dataset.k === 'zebra' || cb.dataset.k === 'peak') { needPresent = true; return; }
      dirty = true;
      if (cb.dataset.k === 'tripod' || cb.dataset.k === 'isoAuto' || cb.dataset.k === 'wbAuto') cameraPanel();
    }));
    p.querySelectorAll('.sts-chips').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('.sts-chip'); if (!b) return;
      if (b.dataset.mode) s.mode = b.dataset.mode;
      if (b.dataset.focus) { if (b.dataset.focus === 'manual' && s.focus !== 'manual') s.focusD = focusDist(); s.focus = b.dataset.focus; }
      if (b.dataset.orient) { s.orient = b.dataset.orient; layout(); }
      sceneId = null; markScene();
      dirty = true; restart(); cameraPanel();
    }));
    meterBox();
  }
  /* distância de foco num cursor logarítmico de 0,3 m a 200 m */
  const fdToSlider = d => clamp(Math.log(d / 0.3) / Math.log(200 / 0.3) * 100, 0, 100);
  const sliderToFd = v => 0.3 * Math.pow(200 / 0.3, v / 100);
  /* atualiza só os textos (sem refazer o painel enquanto se arrasta) */
  function outputs() {
    const set = (id, t) => { const o = $('#ext-o-' + id); if (o) o.innerHTML = t; };
    set('ap', fmtF(s.fnum)); set('sh', fmtT(s.shutter)); set('iso', s.iso);
    set('wb', s.wbAuto ? 'auto · ' + TIMES[s.tod].wb + ' K' : s.wb + ' K');
    set('focal', s.focal + ' mm'); set('fd', fmtM(s.focus === 'manual' ? s.focusD : focusDist()));
    set('dist', num(s.dist, 1) + ' m'); set('az', s.az + '°'); set('height', num(s.height, 2) + ' m');
    /* os valores automáticos mexem nos cursores desativados */
    const sv = (id, v) => { const i = $('#ext-' + id); if (i && i.disabled) i.value = v; };
    sv('ap', nearestIdx(APERTURES, s.fnum)); sv('sh', nearestIdx(SHUTTERS_X, s.shutter)); sv('iso', nearestIdx(ISOS_X, s.iso));
  }
  function meterBox() {
    const box = $('#ext-meter'); if (!box) return;
    const ev = Math.log2(lastE * s.shutter / need()), pos = clamp(isFinite(ev) ? ev : -3, -3, 3);
    const tip = flags.length ? `<p class="ext-flag">${esc(flags[0])}</p>` : '';
    box.innerHTML = `<div class="sts-mtop"><span class="sts-mlab">Fotómetro (luz no rosto)</span><b>${fmtLux(lastE)}</b></div>
      <div class="sts-evbar" role="img" aria-label="Exposição ${num(ev)} EV"><span style="left:${(pos + 3) / 6 * 100}%"></span>${[-3, -2, -1, 0, 1, 2, 3].map(x => `<i style="left:${(x + 3) / 6 * 100}%">${x > 0 ? '+' + x : x}</i>`).join('')}</div>
      ${s.mode === 'M' && !s.isoAuto ? `<button class="sts-btn sts-btn-sm" data-act="use-meter">Acertar a velocidade pela leitura</button>` : ''}${tip}`;
    const b = box.querySelector('[data-act="use-meter"]');
    if (b) b.onclick = () => { s.shutter = SHUTTERS_X[nearestIdx(SHUTTERS_X, clamp(250 * s.fnum * s.fnum / (s.iso * lastE), 1 / 8000, 30))]; dirty = true; restart(); cameraPanel(); };
  }

  /* ── explicação (o porquê do que se vê) ────────────────────────── */
  function explain() {
    const sd = lens?.focusD ?? focusDist(), [nd, fd] = dofRange(sd);
    const [, imgH] = optics.size;
    const f = s.focal / 1000, A = f / s.fnum;
    const cInf = A * f / Math.max(sd - f, 1e-3) * 1000;          // diâmetro no sensor (mm) de um ponto no infinito
    const bokehPct = cInf / sensorH() * 100;
    const moveCm = CAR_V * s.shutter * 100;
    const carPx = CAR_V * s.shutter * s.focal / (10 * sensorH()) * imgH;
    const handLimit = 1 / s.focal * (s.stab ? 16 : 1);
    const shakeRisk = !s.tripod && s.shutter > handLimit * 1.01;
    const stops = Math.log2(s.iso / 100);
    const lines = [];
    const fine = fd - nd < 1;
    lines.push(['Zona nítida', !isFinite(fd) ? `de ${fmtM(nd)} até ao infinito` : `de ${fmtM(nd, fine)} a ${fmtM(fd, fine)} (${fmtM(fd - nd)} de profundidade)`, `Foco a ${fmtM(sd)}; hiperfocal a ${fmtM(hyper())}. Abrir o diafragma, aproximar-se ou usar mais focal estreita esta zona.`]);
    lines.push(['Bokeh', bokehPct < 0.3 ? 'praticamente nenhum' : `uma luz ao fundo vira um disco com ~${num(bokehPct, bokehPct < 3 ? 1 : 0)} % da altura da foto`, s.fnum <= 2.8 ? 'Objetiva aberta: discos redondos, "olho de gato" nos cantos.' : s.fnum >= 5.6 ? 'Diafragma fechado: os discos ganham a forma das 7 lâminas.' : 'Entre aberto e fechado: discos já ligeiramente poligonais.']);
    lines.push(['Movimento', moveCm < 1 ? `um carro a 40 km/h anda ${num(moveCm * 10, 1)} mm — congelado` : `um carro a 40 km/h anda ${moveCm >= 100 ? num(moveCm / 100, 1) + ' m' : Math.round(moveCm) + ' cm'} durante a exposição`, carPx < 1.5 ? 'Abaixo de 1 píxel: nítido.' : `A 10 m da câmara, a passar de lado, isso são ~${Math.round(carPx)} px de arrasto.`]);
    lines.push(['Tremido', s.tripod ? 'tripé: nenhum' : shakeRisk ? `à mão a ${fmtT(s.shutter)} — mais lento do que 1/${Math.round(1 / handLimit)}: vai tremer` : `à mão, dentro do limite (1/${Math.round(1 / handLimit)} ou mais rápido)`, s.stab ? 'Estabilizador ligado: ~4 stops de margem.' : 'Regra prática: não mais lento do que 1/focal.']);
    lines.push(['Ruído', stops <= 0.2 ? 'ISO base: limpo' : `ISO ${s.iso} = ${num(stops, 1)} stops acima da base`, stops > 5 ? 'Muito ruído, sobretudo nas sombras.' : stops > 3 ? 'Ruído visível nas zonas escuras.' : 'Ainda discreto.']);
    lines.push(['Luz no rosto', fmtLux(lastE), TIMES[s.tod].blurb]);
    $('.ext-explain').innerHTML = `<dl class="ext-dl">${lines.map(([a, b, c]) => `<div><dt>${a}</dt><dd><b>${b}</b><span>${c}</span></dd></div>`).join('')}</dl>`;
  }

  function hud() {
    const ev = Math.log2(lastE * s.shutter / need());
    const evTxt = Math.abs(ev) < 0.05 ? '±0,0 EV' : (ev > 0 ? '+' : '−') + num(Math.abs(ev)) + ' EV';
    const evCls = Math.abs(ev) > 1 ? 'bad' : Math.abs(ev) > 0.35 ? 'warn' : 'ok';
    const auto = x => `<em class="ext-a">${x}</em>`;
    $('.sts-lcd').innerHTML = `<span>${fmtF(s.fnum)}${s.mode === 'S' ? auto('A') : ''}</span><span>${fmtT(s.shutter)}${s.mode === 'A' ? auto('A') : ''}</span><span>ISO ${s.iso}${s.mode === 'M' && s.isoAuto ? auto('A') : ''}</span><span>${s.focal} mm</span><span class="sts-ev ${evCls}" title="Exposição do rosto face à leitura do fotómetro">${evTxt}</span>`;
  }
  function panelsOnFrame() { hud(); explain(); meterBox(); outputs(); drawPlan(); $('.ext-tod-name').textContent = ' · ' + TIMES[s.tod].name; }

  function drawHisto() {
    const cv = $('.sts-histo'); if (!cv.offsetParent) return;
    const { buf, w, h } = optics.read();
    const bins = new Float32Array(64);
    for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) { const i = (y * w + x) * 4; bins[Math.min(63, (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) >> 2)]++; }
    const g = cv.getContext('2d'), CW = cv.width, CH = cv.height, mx = Math.max(...bins.slice(1, 63)) || 1;
    g.clearRect(0, 0, CW, CH); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(230,234,240,.85)';
    for (let i = 0; i < 64; i++) { const bh = Math.min(1, bins[i] / mx) * (CH - 2); g.fillRect(i * 2, CH - bh, 2, bh); }
  }

  /* ── planta ────────────────────────────────────────────────────── */
  const planCv = $('.ext-plan');
  let planMap = null;
  function drawPlan() {
    const wrap = $('.ext-plan-wrap'); if (!wrap.offsetParent) return;
    const r = wrap.getBoundingClientRect(), pr = Math.min(2, window.devicePixelRatio || 1);
    planCv.width = Math.round(r.width * pr); planCv.height = Math.round(r.height * pr);
    const g = planCv.getContext('2d'), PW = planCv.width, PH = planCv.height;
    const P = city.plan, { C } = placeCamera(), F = face();
    /* escala: x ∈ [−9, 9] m; z do lado da câmara até ~60 m à frente (o resto comprime) */
    const zc = Math.max(C.z, F.z) + 4, sx = PW / 19;
    const zz = z => { const d = zc - z; return PH - (d < 30 ? d : 30 + Math.sqrt(d - 30) * 4.2) * sx; };
    const xx = x => PW / 2 + x * sx;
    planMap = { zc, sx, PH, PW, pr };
    g.fillStyle = '#0e1013'; g.fillRect(0, 0, PW, PH);
    g.fillStyle = '#25272c'; g.fillRect(xx(-P.walk), 0, (2 * P.walk) * sx, PH);           // passeios
    g.fillStyle = '#17181b'; g.fillRect(xx(-P.road), 0, 2 * P.road * sx, PH);            // estrada
    g.fillStyle = '#35302a'; g.fillRect(0, 0, xx(-P.walk), PH); g.fillRect(xx(P.walk), 0, PW, PH);   // casas
    const yA = zz(P.gap[1]), yB = zz(P.gap[0]);
    g.fillStyle = '#17181b'; g.fillRect(0, yA, PW, yB - yA);
    for (const l of P.lamps) { const y = zz(l.z); if (y < 0 || y > PH) continue; g.fillStyle = l.k < 3000 ? '#ffb347' : '#e8f0ff'; g.beginPath(); g.arc(xx(l.x), y, 2.2 * pr, 0, 7); g.fill(); }
    /* carros no instante do disparo */
    for (const m of P.movers) { const y = zz(m.car.position.z); if (y < -10 || y > PH + 10) continue; g.fillStyle = m.dir > 0 ? '#dfe6ee' : '#ff5a4f'; g.fillRect(xx(m.x) - 0.9 * sx, y - 2.1 * sx * 0.5, 1.8 * sx, 2.1 * sx); }
    /* zona nítida: entre near e far ao longo do eixo, dentro do campo de visão */
    const dir = viewDir(), right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const hf = Math.tan((cam.fov * DEG) / 2) * cam.aspect;
    const sd = lens?.focusD ?? focusDist(), [nd, fdRaw] = dofRange(sd), fd = Math.min(fdRaw, 400);
    const pt = (d, side) => { const p = C.clone().addScaledVector(dir, d).addScaledVector(right, side * d * hf); return [xx(p.x), zz(p.z)]; };
    g.fillStyle = 'rgba(110, 230, 150, .22)';
    g.beginPath(); g.moveTo(...pt(nd, -1)); g.lineTo(...pt(fd, -1)); g.lineTo(...pt(fd, 1)); g.lineTo(...pt(nd, 1)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255, 196, 107, .5)'; g.lineWidth = 1 * pr;
    g.beginPath(); g.moveTo(xx(C.x), zz(C.z)); g.lineTo(...pt(400, -1)); g.moveTo(xx(C.x), zz(C.z)); g.lineTo(...pt(400, 1)); g.stroke();
    g.strokeStyle = '#7fdc9a'; g.lineWidth = 2 * pr;
    g.beginPath(); g.moveTo(...pt(sd, -1)); g.lineTo(...pt(sd, 1)); g.stroke();
    /* sujeito e câmara */
    g.fillStyle = '#d8b9a3'; g.beginPath(); g.arc(xx(F.x), zz(F.z), 4 * pr, 0, 7); g.fill();
    g.save(); g.translate(xx(C.x), zz(C.z)); g.rotate(Math.atan2(dir.x, -dir.z));
    g.fillStyle = '#ffc46b'; g.fillRect(-5 * pr, -3 * pr, 10 * pr, 7 * pr); g.fillRect(-2 * pr, -6 * pr, 4 * pr, 3 * pr); g.restore();
    g.font = `600 ${10.5 * pr}px system-ui, sans-serif`;
    const fine = fdRaw - nd < 1;
    const lab = !isFinite(fdRaw) ? `nítido de ${fmtM(nd)} a ∞` : `nítido: ${fmtM(nd, fine)} – ${fmtM(fdRaw, fine)}`;
    const tw = g.measureText(lab).width;
    g.fillStyle = 'rgba(12,13,16,.8)'; g.fillRect(6 * pr, PH - 24 * pr, tw + 10 * pr, 18 * pr);
    g.fillStyle = '#7fdc9a'; g.fillText(lab, 11 * pr, PH - 11 * pr);
  }
  planCv.addEventListener('click', e => {
    if (!planMap) return;
    const r = planCv.getBoundingClientRect(), { zc, sx, PH, PW, pr } = planMap;
    const px = (e.clientX - r.left) * pr, py = (e.clientY - r.top) * pr;
    const d = (PH - py) / sx, z = zc - (d < 30 ? d : 30 + Math.pow((d - 30) / 4.2, 2)), x = (px - PW / 2) / sx;
    const p = new THREE.Vector3(x, 1.2, z).sub(cam.position);
    const dist = p.dot(viewDir());
    if (dist > 0.3) setFocus(dist);
  });

  /* ── focar com um clique na fotografia ─────────────────────────── */
  const ray = new THREE.Raycaster();
  const targets = () => [...city.solids, ...(() => { const a = []; subject.traverse(o => { if (o.isMesh) a.push(o); }); return a; })()];
  canvas.addEventListener('click', e => {
    if (!photoRect || compareDrag) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const top = r.height - photoRect.y - photoRect.h;
    const u = (x - photoRect.x) / photoRect.w, v = (y - top) / photoRect.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    placeCamera();
    ray.setFromCamera(new THREE.Vector2(u * 2 - 1, -(v * 2 - 1)), cam);
    const hit = ray.intersectObjects(targets(), false)[0];
    const d = hit ? hit.point.clone().sub(cam.position).dot(viewDir()) : 400;
    setFocus(d);
  });
  function setFocus(d) {
    s.focus = 'manual'; s.focusD = clamp(d, 0.3, 400);
    sceneId = null; markScene(); dirty = true; cameraPanel();
    toast(`Foco a ${fmtM(s.focusD)}`);
  }
  /* A | B: arrastar a divisória */
  let compareDrag = false;
  canvas.addEventListener('pointerdown', e => {
    if (!compare) return;
    const r = canvas.getBoundingClientRect();
    const mv = ev => { splitPos = clamp((ev.clientX - r.left - photoRect.x) / photoRect.w, 0, 1); compareDrag = true; needPresent = true; };
    mv(e);
    const up = () => { window.removeEventListener('pointermove', mv); setTimeout(() => { compareDrag = false; }, 0); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up, { once: true });
  });

  let toastT = 0;
  function toast(msg) {
    let t = $('.sts-toast');
    if (!t) { t = document.createElement('div'); t.className = 'sts-toast'; t.setAttribute('role', 'status'); stage.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  }

  /* ── situações e hora do dia ───────────────────────────────────── */
  function markScene() {
    $$('.ext-scene').forEach(b => b.classList.toggle('on', b.dataset.scene === sceneId));
    $$('[data-tod]').forEach(b => { const on = b.dataset.tod === s.tod; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const sc = SCENES.find(x => x.id === sceneId);
    $('.ext-tip').innerHTML = sc ? `<b>${esc(sc.name)} <em>· ${esc(TIMES[sc.tod].name)}</em></b><p>${esc(sc.text)}</p>` : '';
  }
  function setTod(id) { s.tod = id; city.setTime(id); dirty = true; markScene(); }
  function applyScene(id) {
    const sc = SCENES.find(x => x.id === id); if (!sc) return;
    Object.assign(s, DEFAULT, { zebra: s.zebra, peak: s.peak, traffic: true }, sc.cam, { tod: sc.tod });
    if (sc.cam.iso === undefined && sc.cam.isoAuto) s.iso = 1600;
    sceneId = id;
    city.setTime(s.tod);
    newMoment();
    layout(); restart(); cameraPanel(); markScene();
  }
  $('.ext-scenes').addEventListener('click', e => { const b = e.target.closest('.ext-scene'); if (b) applyScene(b.dataset.scene); });
  $$('[data-tod]').forEach(b => b.addEventListener('click', () => { setTod(b.dataset.tod); sceneId = null; markScene(); }));
  /* um carro passa a meio da exposição: em frente ao sujeito (de lado) ou um pouco atrás dele (ao longo da rua) */
  function newMoment() { const side = s.az > 45; t0 = city.momentFor(SUBJECT.z - (side ? 0 : 6 + Math.random() * 14), Math.random, side ? -1 : 0) - s.shutter / 2; seed = Math.random(); }
  $('[data-act="shot"]').onclick = () => { newMoment(); dirty = true; };
  $('[data-act="snap"]').onclick = () => { optics.snapshot(); $('[data-act="compare"]').disabled = false; toast('Guardada como A. Muda algo e usa "A | B".'); };
  $('[data-act="compare"]').onclick = () => { compare = !compare; $('[data-act="compare"]').setAttribute('aria-pressed', compare); needPresent = true; };
  $$('.sts-mtabs .seg-btn').forEach(b => b.addEventListener('click', () => {
    root.dataset.mtab = b.dataset.mtab;
    $$('.sts-mtabs .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    if (b.dataset.mtab === 'plan') requestAnimationFrame(drawPlan);
  }));
  const onKey = e => {
    if (!root.isConnected || !root.offsetParent || e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' && document.activeElement === canvas) { e.preventDefault(); $('[data-act="shot"]').click(); }
  };
  document.addEventListener('keydown', onKey);

  /* ── arranque ──────────────────────────────────────────────────── */
  city.setTime(s.tod);
  const ro = new ResizeObserver(() => { fitHeight(); layout(); needPresent = true; });
  ro.observe(stage);
  layout();
  applyScene('bokeh');
  $('.sts-loading p').textContent = 'A preparar a luz…';
  try {
    placeCamera(); city.setMoment(t0, 0);
    renderer.setRenderTarget(null);
    await renderer.compileAsync(city.scene, cam);
  } catch (e) { console.warn('[ext] precompile', e); }
  $('.sts-loading').hidden = true;
  const io = new IntersectionObserver(es => { paused = !es[0].isIntersecting || document.hidden; if (!paused) needPresent = true; });
  io.observe(root);
  frame();
  window.__ext = { s, city, optics, renderer, cam, restart: () => { dirty = true; }, get k() { return k; }, get N() { return N; }, applyScene, setTod };

  return {
    pause() { paused = true; },
    resume() { paused = false; layout(); needPresent = true; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('keydown', onKey);
      optics.dispose(); city.scene.traverse(o => { o.geometry?.dispose?.(); }); renderer.dispose(); renderer.forceContextLoss(); host.innerHTML = '';
      if (window.__ext?.renderer === renderer) delete window.__ext;
    },
  };
}
