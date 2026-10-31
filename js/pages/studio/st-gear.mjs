/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — equipamento procedural (original, sem assets externos).

   Convenção: cada cabeça de luz é um Group cujo +Z aponta para o alvo; a
   origem do grupo é o CENTRO DA FACE QUE EMITE (difusor, boca do
   refletor, abertura da sombrinha). O corpo do flash fica atrás (−Z).
   Medidas em metros.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, RoundedBoxGeometry, studioMaterial, canvasTex, noiseField, DEG } from './st-core.mjs';

/* ── materiais partilhados ──────────────────────────────────────────── */
const std = (o, skin) => studioMaterial(new THREE.MeshStandardMaterial(o), { skin });
export const MAT = {};
export function initMaterials() {
  if (MAT.ready) return MAT;
  const brushed = canvasTex(256, 64, (g, w, h) => {
    const n = noiseField(w, h, 2, 9);
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 150 + n[i] * 40; im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
  }, { srgb: false, repeat: [1, 8] });
  Object.assign(MAT, {
    ready: true,
    powder: std({ color: 0x18191b, roughness: 0.55, metalness: 0.35 }),           // pintura epóxi preta
    alu: std({ color: 0xb9bcc0, roughness: 0.32, metalness: 1, roughnessMap: brushed }),
    chrome: std({ color: 0xdfe3e8, roughness: 0.12, metalness: 1 }),
    rubber: std({ color: 0x0c0c0d, roughness: 0.92, metalness: 0 }),
    plastic: std({ color: 0x232427, roughness: 0.48, metalness: 0 }),
    plasticLite: std({ color: 0x3a3c41, roughness: 0.42, metalness: 0 }),
    fabric: std({ color: 0x1c1d20, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    silver: std({ color: 0xcfd3d8, roughness: 0.28, metalness: 0.95, side: THREE.DoubleSide }),
    whiteIn: std({ color: 0xeeeeea, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }),
    gold: std({ color: 0xd9a441, roughness: 0.3, metalness: 1, side: THREE.DoubleSide }),
    knob: std({ color: 0x9a1b1b, roughness: 0.5, metalness: 0.1 }),               // manípulos vermelhos de tripé
    glass: std({ color: 0x05070a, roughness: 0.05, metalness: 0.2 }),
    label: std({ color: 0xd8dade, roughness: 0.5, metalness: 0 }),
  });
  return MAT;
}

/** Material da face que emite: cor HDR atualizada a cada frame. */
export function emitMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: true });
}

const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
const tube = (r, h, mat, seg = 16) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
/** cilindro entre dois pontos */
function rod(a, b, r, mat, seg = 12) {
  const d = new THREE.Vector3().subVectors(b, a), m = tube(r, d.length(), mat, seg);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/* ══ TRIPÉ DE LUZ (com girafa opcional) ════════════════════════════════ */
export class LightStand {
  constructor() {
    initMaterials();
    this.group = new THREE.Group();
    this.group.name = 'stand';
    const g = this.group;
    /* base: cubo central, 3 pernas, 3 braçadeiras */
    this.hubY = 0.62;
    const hub = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 16), MAT.powder);
    hub.position.y = this.hubY; g.add(hub);
    const collar = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 16), MAT.powder);
    collar.position.y = 0.36; g.add(collar);
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3 + Math.PI / 6;
      const foot = new THREE.Vector3(Math.cos(a) * 0.52, 0.012, Math.sin(a) * 0.52);
      const top = new THREE.Vector3(Math.cos(a) * 0.03, this.hubY, Math.sin(a) * 0.03);
      g.add(rod(top, foot, 0.011, MAT.powder));
      const mid = top.clone().lerp(foot, 0.5);
      g.add(rod(new THREE.Vector3(Math.cos(a) * 0.025, 0.36, Math.sin(a) * 0.025), mid, 0.006, MAT.powder));
      const pad = mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.024, 12), MAT.rubber);
      pad.position.copy(foot); pad.position.y = 0.012; g.add(pad);
    }
    /* coluna telescópica: 3 secções */
    this.sections = [0.0165, 0.0135, 0.0108].map((r, i) => {
      const m = mesh(new THREE.CylinderGeometry(r, r, 1, 16), i === 0 ? MAT.powder : MAT.alu);
      g.add(m);
      const lock = mesh(new THREE.CylinderGeometry(r + 0.006, r + 0.006, 0.035, 14), MAT.plastic);
      const knob = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 10), MAT.knob);
      knob.rotation.z = Math.PI / 2;
      g.add(lock, knob);
      return { m, lock, knob, r };
    });
    this.spigot = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10), MAT.chrome);
    g.add(this.spigot);
    /* girafa */
    this.boom = new THREE.Group();
    this.boomBar = tube(0.014, 1, MAT.alu);
    this.boomBar.rotation.z = Math.PI / 2;
    this.weight = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 18), MAT.powder);
    this.weight.rotation.z = Math.PI / 2;
    const clamp = mesh(new RoundedBoxGeometry(0.06, 0.06, 0.06, 2, 0.01), MAT.plastic);
    this.boom.add(this.boomBar, this.weight, clamp);
    g.add(this.boom);
  }

  /** topo do tripé (ponto onde encaixa a cabeça ou a girafa) e alcance da girafa */
  set(top, boomReach = 0, boomDir = 0) {
    const H = Math.max(this.hubY + 0.25, top);
    const parts = this.sections.length, h0 = this.hubY - 0.05;
    const span = H - h0, seg = span / parts + 0.08;
    this.sections.forEach((s, i) => {
      const y0 = h0 + i * (span / parts) - (i ? 0.08 : 0);
      s.m.scale.y = seg; s.m.position.y = y0 + seg / 2;
      s.lock.position.y = y0 + seg - 0.02; s.knob.position.set(s.r + 0.012, y0 + seg - 0.02, 0);
    });
    this.spigot.position.y = H + 0.03;
    const on = boomReach > 0.05;
    this.boom.visible = on;
    if (on) {
      const back = 0.45;
      this.boom.position.y = H + 0.04;
      this.boom.rotation.y = boomDir;
      this.boomBar.scale.y = boomReach + back;
      this.boomBar.position.x = (boomReach - back) / 2;
      this.weight.position.x = -back + 0.06;
    }
    this.top = H;
  }
}

/* ══ CABEÇA DE FLASH (monobloco) ═══════════════════════════════════════ */
function strobeBody() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.062, 0.066, 0.24, 28), MAT.plastic);
  body.rotation.x = Math.PI / 2; body.position.z = -0.14; g.add(body);
  /* aletas de ventilação */
  for (let i = 0; i < 6; i++) {
    const f = mesh(new THREE.TorusGeometry(0.066, 0.0035, 6, 28), MAT.plasticLite, false);
    f.position.z = -0.2 + i * 0.016; g.add(f);
  }
  const back = mesh(new THREE.CylinderGeometry(0.066, 0.062, 0.025, 28), MAT.plasticLite);
  back.rotation.x = Math.PI / 2; back.position.z = -0.27; g.add(back);
  const panel = mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshBasicMaterial({ color: 0x223a4a }), false);
  panel.position.z = -0.2835; panel.rotation.y = Math.PI; g.add(panel);
  /* baioneta frontal + tubo de flash */
  const mount = mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.03, 28), MAT.alu);
  mount.rotation.x = Math.PI / 2; mount.position.z = -0.015; g.add(mount);
  const handle = mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 16, Math.PI), MAT.plastic);
  handle.position.set(0, 0.07, -0.15); handle.rotation.y = Math.PI / 2; g.add(handle);
  /* forquilha de montagem */
  const yoke = new THREE.Group();
  for (const s of [-1, 1]) {
    const arm = mesh(new RoundedBoxGeometry(0.012, 0.12, 0.04, 2, 0.004), MAT.powder);
    arm.position.set(s * 0.078, -0.05, 0); yoke.add(arm);
    const knob = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 14), MAT.knob);
    knob.rotation.z = Math.PI / 2; knob.position.set(s * 0.094, 0, 0); yoke.add(knob);
  }
  const bar = mesh(new RoundedBoxGeometry(0.168, 0.016, 0.04, 2, 0.004), MAT.powder);
  bar.position.y = -0.11; yoke.add(bar);
  yoke.position.z = -0.15;
  g.add(yoke);
  g.userData.yoke = yoke;
  return g;
}

/* ── geometrias de modificadores ─────────────────────────────────────── */
/** Tronco de pirâmide de N lados: boca de trás r0 (circunscrito) → frente (w,h) */
function frustum(n, back, front, depth, rot = 0) {
  const pos = [], idx = [];
  const ring = (z, rx, ry) => {
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2;
      pos.push(Math.cos(a) * rx, Math.sin(a) * ry, z);
    }
  };
  ring(-depth, back[0], back[1]); ring(0, front[0], front[1]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, j, n + j, i, n + j, n + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function polygon(n, rx, ry, rot = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * Math.PI * 2;
    i ? s.lineTo(Math.cos(a) * rx, Math.sin(a) * ry) : s.moveTo(Math.cos(a) * rx, Math.sin(a) * ry);
  }
  return new THREE.ShapeGeometry(s);
}
/** costura/aro à volta da boca */
function rim(n, rx, ry, mat, rot = 0, r = 0.01) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = rot + i / n * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, 0)); }
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), n * 4, r, 6, false), mat);
}

function softboxGeo(n, w, h, depth, rot) {
  const g = new THREE.Group();
  /* para um retângulo os cantos estão a 45°; o raio circunscrito é w/√2 */
  const k = n === 4 ? Math.SQRT2 : 1 / Math.cos(Math.PI / n);
  const front = [w / 2 * k, h / 2 * k], back = [0.085 * k, 0.085 * k];
  const shell = mesh(frustum(n, back, front, depth, rot), MAT.fabric);
  const inner = mesh(frustum(n, back.map(x => x * 0.97), front.map(x => x * 0.97), depth * 0.98, rot), MAT.silver, false);
  inner.position.z = -0.004;
  const diff = mesh(polygon(n, front[0] * 0.985, front[1] * 0.985, rot), emitMaterial(), false);
  diff.position.z = 0.002; diff.name = 'emit';
  const lip = rim(n, front[0], front[1], MAT.fabric, rot, 0.012);
  /* varetas (visíveis por fora) */
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * Math.PI * 2;
    g.add(rod(new THREE.Vector3(Math.cos(a) * back[0], Math.sin(a) * back[1], -depth), new THREE.Vector3(Math.cos(a) * front[0], Math.sin(a) * front[1], 0), 0.005, MAT.fabric, 6));
  }
  const ring = mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, n === 4 ? 4 : 24, 1, true), MAT.powder);
  ring.rotation.x = Math.PI / 2; ring.rotation.y = n === 4 ? Math.PI / 4 : 0; ring.position.z = -depth;
  g.add(shell, inner, diff, lip, ring);
  g.userData.backZ = -depth;
  return g;
}

function dishGeo(radius, depth, interior, withDeflector) {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(0.07 + (radius - 0.07) * t, -depth * (1 - t * t * 0.15) * (1 - t)));
  }
  const lathe = new THREE.LatheGeometry(prof, 48);
  /* a lathe gira à volta de Y com a boca em y=0 e o fundo em y=−depth;
     +90° em X leva y→z: fundo atrás (−Z), boca virada ao sujeito */
  const outer = mesh(lathe, interior === 'silver' ? MAT.alu : MAT.plasticLite);
  outer.rotation.x = Math.PI / 2;
  /* o interior é a superfície que brilha quando o flash dispara */
  const inner = mesh(lathe.clone().scale(0.995, 1, 0.995), emitMaterial(), false);
  inner.name = 'emit-soft'; inner.rotation.x = Math.PI / 2; inner.position.z = 0.002;
  const lip = mesh(new THREE.TorusGeometry(radius, 0.008, 8, 48), MAT.alu);
  g.add(outer, inner, lip);
  const emit = mesh(new THREE.CircleGeometry(radius * 0.99, 48), emitMaterial(), false);
  emit.name = 'emit'; emit.position.z = -0.01;
  emit.material.transparent = true; emit.material.opacity = 0.0;   // boca aberta: brilha só via a luz e o interior
  g.add(emit);
  if (withDeflector) {
    const defl = mesh(new THREE.CylinderGeometry(radius * 0.26, radius * 0.26, 0.006, 32), MAT.silver);
    defl.rotation.x = Math.PI / 2; defl.position.z = -depth * 0.35; g.add(defl);
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * Math.PI / 3;
      g.add(rod(new THREE.Vector3(Math.cos(a) * radius * 0.2, Math.sin(a) * radius * 0.2, -depth * 0.35), new THREE.Vector3(Math.cos(a) * 0.06, Math.sin(a) * 0.06, -depth * 0.85), 0.003, MAT.chrome, 6));
    }
  }
  /* tubo de flash visível no fundo */
  const tubeM = mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 24), emitMaterial(), false);
  tubeM.name = 'emit-core'; tubeM.position.z = -depth * 0.9;
  g.add(tubeM);
  g.userData.backZ = -depth;
  return g;
}

function umbrellaGeo(radius, kind) {
  /* refletora: a copa abre PARA o sujeito, o flash dispara para dentro dela;
     de transparência: a copa abre para o flash e a luz atravessa o tecido */
  const g = new THREE.Group();
  const ribs = 16, depth = radius * 0.42;
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(radius * t, -depth * (1 - t * t))); }
  const geo = new THREE.LatheGeometry(prof, ribs * 3);
  /* festões entre varetas */
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const sc = Math.abs(Math.cos(a * ribs / 2));
    p.setY(i, p.getY(i) + (1 - sc) * 0.03 * (r / radius) * (kind === 'through' ? -1 : 1));
  }
  geo.computeVertexNormals();
  const shoot = kind === 'through';
  /* na de transparência é o próprio tecido que brilha */
  const canopy = mesh(geo, shoot ? emitMaterial() : MAT.fabric);
  if (shoot) canopy.name = 'emit';
  canopy.rotation.x = shoot ? -Math.PI / 2 : Math.PI / 2;     // refletora: côncava para o sujeito; transparência: cúpula para o sujeito
  g.add(canopy);
  if (!shoot) {
    const lining = mesh(geo.clone().scale(0.99, 0.99, 0.99), emitMaterial(), false);
    lining.name = 'emit'; lining.rotation.x = Math.PI / 2; lining.position.z = 0.004; g.add(lining);
  }
  for (let i = 0; i < ribs; i++) {
    const a = i / ribs * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, r = radius * t, y = -depth * (1 - t * t); pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, shoot ? -y : y)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0035, 5), MAT.powder));
  }
  const shaft = rod(new THREE.Vector3(0, 0, shoot ? depth + 0.05 : -depth - 0.02), new THREE.Vector3(0, 0, shoot ? -0.55 : 0.18), 0.004, MAT.chrome, 8);
  g.add(shaft);

  /* o flash fica atrás (de transparência) ou de costas, no foco (refletora) */
  g.userData.bodyZ = shoot ? -0.55 : -depth * 0.25;
  g.userData.bodyFlip = !shoot;
  g.userData.backZ = shoot ? -0.55 : -depth;
  return g;
}

function bareGeo(kind) {
  const g = new THREE.Group();
  const r = 0.09, depth = 0.13;
  const prof = [new THREE.Vector2(0.075, -depth), new THREE.Vector2(0.08, -depth * 0.8), new THREE.Vector2(r, 0)];
  const lathe = new THREE.LatheGeometry(prof, 32);
  const shell = mesh(lathe, MAT.alu); shell.rotation.x = Math.PI / 2;
  const inner = mesh(lathe.clone().scale(0.985, 1, 0.985), emitMaterial(), false); inner.rotation.x = Math.PI / 2; inner.name = 'emit-soft';
  g.add(shell, inner);
  const core = mesh(new THREE.SphereGeometry(0.03, 16, 12), emitMaterial(), false);
  core.name = 'emit-core'; core.position.z = -depth * 0.75; g.add(core);
  if (kind === 'grid') {
    const hex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2a2a2c'; c.lineWidth = 3;
      const s = 16;
      for (let y = 0; y < h + s; y += s * 1.5) for (let x = 0; x < w + s; x += s * Math.sqrt(3)) {
        const ox = ((y / (s * 1.5)) % 2) * s * Math.sqrt(3) / 2;
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(x + ox + Math.cos(a) * s, y + Math.sin(a) * s); }
        c.closePath(); c.stroke();
      }
    });
    const grid = mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: hex, roughness: 0.6, metalness: 0.5 }), false);
    grid.position.z = 0.003; g.add(grid);
    g.add(rim(32, r, r, MAT.powder, 0, 0.008));
  }
  if (kind === 'snoot') {
    const sn = mesh(new THREE.CylinderGeometry(0.03, r * 0.95, 0.22, 24, 1, true), MAT.powder);
    sn.rotation.x = Math.PI / 2; sn.position.z = 0.11; g.add(sn);
    g.userData.frontZ = 0.22;
  }
  g.userData.backZ = -depth;
  return g;
}

/* ══ CATÁLOGO DE MODIFICADORES ═════════════════════════════════════════
   size: lado/diâmetro do difusor (m) · share: fração da energia na luz de
   área · eff: eficiência relativa ao refletor nu · beam: semi-ângulo do
   feixe da componente dura (°) · pen: penumbra do cone · soft: raio do
   filtro de sombra por metro de tamanho aparente.
   Valores escolhidos para dar ordens de grandeza plausíveis, não medidos
   em equipamento real. */
export const MODIFIERS = {
  softbox:  { name: 'Softbox 60×90', short: 'Softbox', w: 0.6, h: 0.9, share: 0.9, eff: 0.32, beam: 70, pen: 1, build: () => softboxGeo(4, 0.6, 0.9, 0.38, Math.PI / 4) },
  octa:     { name: 'Octabox Ø120', short: 'Octabox', w: 1.2, h: 1.2, share: 0.92, eff: 0.26, beam: 75, pen: 1, round: true, build: () => softboxGeo(8, 1.2, 1.2, 0.5, Math.PI / 8) },
  strip:    { name: 'Stripbox 30×120', short: 'Stripbox', w: 0.3, h: 1.2, share: 0.88, eff: 0.27, beam: 70, pen: 1, build: () => softboxGeo(4, 0.3, 1.2, 0.3, Math.PI / 4) },
  umbrella: { name: 'Sombrinha refletora prateada Ø105', short: 'Sombrinha', w: 1.05, h: 1.05, share: 0.7, eff: 0.42, beam: 62, pen: 0.9, round: true, build: () => umbrellaGeo(0.525, 'silver') },
  through:  { name: 'Sombrinha de transparência Ø105', short: 'Transparência', w: 1.05, h: 1.05, share: 0.85, eff: 0.34, beam: 85, pen: 1, round: true, spill: true, build: () => umbrellaGeo(0.525, 'through') },
  dish:     { name: 'Beauty dish Ø55', short: 'Beauty dish', w: 0.55, h: 0.55, share: 0.45, eff: 0.55, beam: 42, pen: 0.7, round: true, build: () => dishGeo(0.275, 0.13, 'silver', true) },
  bare:     { name: 'Refletor standard 18 cm', short: 'Refletor nu', w: 0.18, h: 0.18, share: 0, eff: 1, beam: 38, pen: 0.45, round: true, build: () => bareGeo('bare') },
  grid:     { name: 'Refletor + grelha 20°', short: 'Grelha', w: 0.18, h: 0.18, share: 0, eff: 0.7, beam: 14, pen: 0.55, round: true, build: () => bareGeo('grid') },
  snoot:    { name: 'Snoot', short: 'Snoot', w: 0.06, h: 0.06, share: 0, eff: 0.55, beam: 7, pen: 0.5, round: true, build: () => bareGeo('snoot') },
};

/** Monta a cabeça completa (modificador + corpo do flash) para um id. */
export function buildHead(modId) {
  initMaterials();
  const def = MODIFIERS[modId];
  const g = new THREE.Group();
  const mod = def.build();
  g.add(mod);
  const body = strobeBody();
  const bz = mod.userData.bodyZ ?? mod.userData.backZ ?? -0.1;
  body.position.z = bz + (mod.userData.bodyFlip ? 0.0 : 0);
  if (mod.userData.bodyFlip) { body.rotation.y = Math.PI; body.position.z = bz - 0.04; }
  g.add(body);
  g.userData.pivotZ = bz + (mod.userData.bodyFlip ? 0.11 : -0.15);   // onde a forquilha agarra
  /* No three r160 o mapa de sombras testa as camadas da câmara de VISTA,
     não as da câmara de sombra — não dá para excluir a cabeça só da sua
     própria luz. Sem isto, uma sombrinha tapava o próprio flash. As
     cabeças não projetam sombra; os tripés e girafas continuam a projetar. */
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  g.userData.emit = [];
  g.traverse(o => { if (o.name.startsWith('emit')) g.userData.emit.push(o); });
  return g;
}

/* ══ REFLETOR 5-EM-1 (rebatedor passivo) ═══════════════════════════════ */
export const SURFACES = {
  white:  { name: 'Branco', rho: 0.8, tint: [1, 1, 1], gloss: 0, mat: () => MAT.whiteIn },
  silver: { name: 'Prateado', rho: 0.9, tint: [1, 1, 1], gloss: 1, mat: () => MAT.silver },
  gold:   { name: 'Dourado', rho: 0.8, tint: [1.0, 0.78, 0.45], gloss: 1, mat: () => MAT.gold },
};
export function buildReflector(surface = 'silver') {
  initMaterials();
  const g = new THREE.Group();
  const disc = mesh(new THREE.CircleGeometry(0.4, 48), SURFACES[surface].mat(), false);
  disc.name = 'surface';
  const back = mesh(new THREE.CircleGeometry(0.4, 48), MAT.fabric);
  back.rotation.y = Math.PI; back.position.z = -0.003;
  const hoop = mesh(new THREE.TorusGeometry(0.4, 0.008, 8, 48), MAT.fabric);
  /* braço de suporte: agarra o aro em dois pontos */
  const arm = rod(new THREE.Vector3(-0.42, 0, -0.03), new THREE.Vector3(0.42, 0, -0.03), 0.006, MAT.alu);
  g.add(disc, back, hoop, arm);
  g.userData.pivotZ = -0.05;
  g.userData.emit = [];
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/* ══ CÂMARA + TRIPÉ ════════════════════════════════════════════════════ */
export function buildCamera() {
  initMaterials();
  const rig = new THREE.Group();          // posição = sensor; +Z aponta para o sujeito
  const cam = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(0.134, 0.098, 0.068, 4, 0.012), MAT.plastic);
  body.position.z = -0.01; cam.add(body);
  const grip = mesh(new RoundedBoxGeometry(0.034, 0.088, 0.052, 4, 0.014), MAT.rubber);
  grip.position.set(-0.055, -0.004, 0.012); cam.add(grip);
  const hump = mesh(new RoundedBoxGeometry(0.06, 0.04, 0.06, 3, 0.01), MAT.plastic);
  hump.position.set(0, 0.06, -0.012); cam.add(hump);
  const shoe = mesh(new THREE.BoxGeometry(0.022, 0.006, 0.02), MAT.alu);
  shoe.position.set(0, 0.083, -0.012); cam.add(shoe);
  const dial = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.01, 18), MAT.plasticLite);
  dial.position.set(0.042, 0.054, -0.01); cam.add(dial);
  const screen = mesh(new THREE.PlaneGeometry(0.075, 0.05), MAT.glass, false);
  screen.position.set(0.008, -0.004, -0.0445); screen.rotation.y = Math.PI; cam.add(screen);
  /* objetiva: só o corpo; o comprimento cresce com a focal (setFocal) */
  const lens = new THREE.Group();
  const mount = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 32), MAT.alu);
  mount.rotation.x = Math.PI / 2; mount.position.z = 0.03; lens.add(mount);
  const barrel = mesh(new THREE.CylinderGeometry(0.036, 0.034, 1, 32), MAT.plastic);
  barrel.rotation.x = Math.PI / 2; lens.add(barrel);
  const ring = mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 1, 48), MAT.rubber);
  ring.rotation.x = Math.PI / 2; lens.add(ring);
  const hood = mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.04, 32, 1, true), MAT.plastic);
  hood.rotation.x = Math.PI / 2; lens.add(hood);
  const glass = mesh(new THREE.CircleGeometry(0.03, 32), MAT.glass, false);
  lens.add(glass);
  const band = mesh(new THREE.CylinderGeometry(0.0362, 0.0362, 0.003, 32), MAT.knob);
  band.rotation.x = Math.PI / 2; lens.add(band);
  cam.add(lens);
  cam.userData.setFocal = f => {
    const L = 0.05 + Math.min(0.17, (f - 24) / 176 * 0.15);
    barrel.scale.y = L; barrel.position.z = 0.036 + L / 2;
    ring.scale.y = L * 0.35; ring.position.z = 0.036 + L * 0.55;
    hood.position.z = 0.036 + L + 0.02; glass.position.z = 0.036 + L - 0.002;
    band.position.z = 0.036 + L * 0.9;
  };
  cam.userData.setFocal(85);
  rig.add(cam);

  /* tripé: cabeça de rótula + coluna + 3 pernas de 3 secções */
  const tri = new THREE.Group();
  const head = mesh(new THREE.SphereGeometry(0.028, 18, 14), MAT.alu); tri.add(head);
  const plate = mesh(new RoundedBoxGeometry(0.06, 0.012, 0.07, 2, 0.003), MAT.powder);
  plate.position.y = 0.03; tri.add(plate);
  const col = tube(0.013, 1, MAT.alu); tri.add(col);
  const apex = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.05, 18), MAT.powder); tri.add(apex);
  const legs = [0, 1, 2].map(k => {
    const a = k * 2 * Math.PI / 3 + Math.PI / 2;
    const segs = [0.014, 0.011, 0.0085].map((r, i) => tube(r, 1, i ? MAT.alu : MAT.powder, 10));
    segs.forEach(s => tri.add(s));
    return { a, segs };
  });
  rig.add(tri);
  rig.userData.cam = cam;
  /** h = altura do sensor; pitch em rad */
  rig.userData.setPose = (h, pitch) => {
    cam.rotation.x = -pitch;
    tri.position.y = -0.075;                     // a rótula fica por baixo da câmara
    head.position.y = 0;
    const apexY = -Math.max(0.15, h - 0.075 - 0.62) * 0.45 - 0.08;
    col.scale.y = -apexY; col.position.y = apexY / 2;
    apex.position.y = apexY;
    const legTop = h - 0.075 + apexY;           // altura absoluta do topo das pernas
    for (const L of legs) {
      const spread = Math.min(0.75, legTop * 0.42);
      const top = new THREE.Vector3(Math.cos(L.a) * 0.035, apexY, Math.sin(L.a) * 0.035);
      const foot = new THREE.Vector3(Math.cos(L.a) * spread, -(h - 0.075), Math.sin(L.a) * spread);
      L.segs.forEach((s, i) => {
        const a = top.clone().lerp(foot, i / 3 - (i ? 0.02 : 0)), b = top.clone().lerp(foot, (i + 1) / 3);
        const d = new THREE.Vector3().subVectors(b, a);
        s.scale.y = d.length(); s.position.copy(a).addScaledVector(d, 0.5);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      });
    }
  };
  rig.userData.setPose(1.5, 0);
  return rig;
}

/* ══ FUNDO DE PAPEL + SALA ═════════════════════════════════════════════ */
export const PAPERS = {
  white:    { name: 'Branco', hex: '#f1f0ec' },
  grey:     { name: 'Cinzento médio', hex: '#7b7d80' },
  charcoal: { name: 'Antracite', hex: '#2c2d30' },
  black:    { name: 'Preto', hex: '#0d0d0e' },
  teal:     { name: 'Azul petróleo', hex: '#24535a' },
  wine:     { name: 'Bordô', hex: '#5a2029' },
  sand:     { name: 'Areia', hex: '#b8a68a' },
};

export function buildBackdrop() {
  initMaterials();
  const g = new THREE.Group();
  const W = 2.72, H = 2.75, R = 0.75, run = 1.4;
  /* perfil: topo → vertical → curva → chão (Shape extrudida ao longo de X) */
  const pts = [];
  const N = 40;
  pts.push([0, H]);
  pts.push([0, R]);
  for (let i = 1; i <= N; i++) { const a = (i / N) * Math.PI / 2; pts.push([R - Math.cos(a) * R, R - Math.sin(a) * R]); }
  pts.push([R + run, 0]);
  const pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (const x of [-W / 2, W / 2]) { pos.push(x, pts[i][1] + 0.002, pts[i][0]); uv.push(x / W + 0.5, acc / 3); }
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const tex = canvasTex(512, 512, (c, w, h) => {
    const n = noiseField(w, h, 64, 3), f = noiseField(w, h, 3, 4);
    const im = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 236 + n[i] * 14 + f[i] * 5; im.data.set([v, v, v, 255], i * 4); }
    c.putImageData(im, 0, 0);
  }, { repeat: [1, 1] });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const paperMat = studioMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.93, metalness: 0, side: THREE.DoubleSide }));
  const paper = mesh(geo, paperMat, false);
  paper.receiveShadow = true;
  g.add(paper);
  /* rolo + suportes */
  const roll = mesh(new THREE.CylinderGeometry(0.055, 0.055, W, 32), paperMat);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, H + 0.03, 0.02); g.add(roll);
  const bar = tube(0.014, W + 0.5, MAT.alu); bar.rotation.z = Math.PI / 2; bar.position.set(0, H + 0.03, 0.02); g.add(bar);
  for (const s of [-1, 1]) {
    const st = new LightStand(); st.set(H + 0.02); st.group.position.set(s * (W / 2 + 0.2), 0, 0.02); g.add(st.group);
  }
  g.userData.paper = paperMat;
  g.userData.setColor = hex => { paperMat.color.set(hex); };
  return g;
}

export function buildRoom() {
  initMaterials();
  const g = new THREE.Group();
  /* betão afagado: manchas largas + grão fino + juntas */
  const S = 1024;
  const col = canvasTex(S, S, (c, w, h) => {
    const n1 = noiseField(w, h, 160, 11), n2 = noiseField(w, h, 22, 12), n3 = noiseField(w, h, 2, 13);
    const im = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 62 + n1[i] * 26 + n2[i] * 10 + n3[i] * 8;
      im.data.set([v, v * 0.985, v * 0.96, 255], i * 4);
    }
    c.putImageData(im, 0, 0);
    c.strokeStyle = 'rgba(20,20,20,.55)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  }, { repeat: [5, 5] });
  const rough = canvasTex(256, 256, (c, w, h) => {
    const n = noiseField(w, h, 40, 21);
    const im = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 120 + n[i] * 90; im.data.set([v, v, v, 255], i * 4); }
    c.putImageData(im, 0, 0);
  }, { srgb: false, repeat: [8, 8] });
  const floorMat = studioMaterial(new THREE.MeshStandardMaterial({ map: col, roughnessMap: rough, roughness: 1, metalness: 0, envMapIntensity: 0.4 }));
  const floor = mesh(new THREE.PlaneGeometry(16, 16), floorMat, false);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wallMat = studioMaterial(new THREE.MeshStandardMaterial({ color: 0x46484c, roughness: 0.95, metalness: 0 }));
  const walls = mesh(new THREE.BoxGeometry(16, 5, 16), wallMat, false);
  walls.material.side = THREE.BackSide; walls.position.y = 2.5; walls.receiveShadow = true;
  g.add(walls);
  /* calhas de teto (dão escala ao espaço) */
  for (const z of [-3, 0, 3]) { const r = tube(0.03, 15, MAT.powder); r.rotation.z = Math.PI / 2; r.position.set(0, 4.6, z); g.add(r); }
  return g;
}
