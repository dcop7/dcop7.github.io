/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — luzes.

   Modelo de energia (aproximado, mas coerente de ponta a ponta):
   · um flash de 400 Ws a plena potência, com refletor standard, dá f/32 a
     1 m com ISO 100 — ordem de grandeza típica de um monobloco;
   · a "intensidade" de cada luz guarda-se em cd·s (= lux·s a 1 m), e a
     iluminância cai com o inverso do quadrado da distância;
   · o modificador reparte essa energia entre a componente de área (o
     difusor, com o seu tamanho real) e a componente dura (cone), e tem
     uma eficiência relativa ao refletor nu.
   O fotómetro e o render usam os MESMOS números, por isso a leitura do
   fotómetro coincide com o que a fotografia mostra.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, kelvinRGB, DEG, clamp } from './st-core.mjs';
import { LightStand, buildHead, buildReflector, MODIFIERS, SURFACES } from './st-gear.mjs';

export const FULL_WS = 400;
const K_CDS = 2560 / FULL_WS;        // cd·s por Ws com refletor nu (f/32 a 1 m, ISO 100)
export const ROLES = {
  key:    { name: 'Principal', short: 'Chave' },
  fill:   { name: 'Preenchimento', short: 'Fill' },
  rim:    { name: 'Recorte', short: 'Recorte' },
  hair:   { name: 'Cabelo', short: 'Cabelo' },
  bg:     { name: 'Fundo', short: 'Fundo' },
  accent: { name: 'Acento', short: 'Acento' },
  bounce: { name: 'Rebatedor', short: 'Rebatedor' },
};
export const GELS = {
  none:   { name: 'Sem gel', rgb: null },
  cto:    { name: 'CTO ½ (quente)', k: 3800 },
  ctb:    { name: 'CTB ½ (frio)', k: 8000 },
  teal:   { name: 'Azul-petróleo', rgb: [0.12, 0.62, 0.72] },
  orange: { name: 'Laranja', rgb: [1, 0.42, 0.08] },
  red:    { name: 'Vermelho', rgb: [1, 0.08, 0.1] },
  magenta:{ name: 'Magenta', rgb: [0.85, 0.12, 0.75] },
  blue:   { name: 'Azul', rgb: [0.15, 0.3, 1] },
};
const v3 = () => new THREE.Vector3();
const _a = v3(), _b = v3(), _c = v3(), _d = v3();

/** Direção a partir do sujeito: az desde o eixo da câmara (+z) para a
 *  direita da câmara (+x); el acima da horizontal. */
export function dirFrom(az, el) {
  return new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG));
}

export class StudioLight {
  constructor(studio, s) {
    this.studio = studio;
    this.s = Object.assign({
      id: 'L' + Math.random().toString(36).slice(2, 7), role: 'key', mod: 'softbox', power: -2, kelvin: 5600, gel: 'none',
      on: true, solo: false, az: -45, el: 30, dist: 1.4, aim: 'subject', feather: 0, tilt: 0, surface: 'silver',
    }, s);
    this.passive = this.s.role === 'bounce';
    this.group = new THREE.Group();
    this.group.name = 'light-' + this.s.id;
    this.stand = new LightStand();
    this.group.add(this.stand.group);
    this.head = null;

    /* par de luzes */
    /* par de luzes emprestado de uma ranhura fixa do estúdio (ver Studio.slots) */
    this.slot = studio.takeSlot();
    this.spot = this.slot.spot;
    this.spot.shadow.bias = -0.00025;
    this.spot.shadow.normalBias = 0.0025;
    this.spot.shadow.camera.near = 0.15;
    this.spot.shadow.camera.far = 14;
    this.target = this.slot.target;
    this.rect = this.slot.rect;
    this.shadowSize(studio.quality.shadow);
    /* "pega" para o gizmo de transformação: coincide com a face emissora */
    this.handle = new THREE.Object3D();
    this.handle.userData.light = this;
    this.group.add(this.handle);
    this.build();
  }

  shadowSize(n) {
    this.spot.shadow.mapSize.set(n, n);
    if (this.spot.shadow.map) { this.spot.shadow.map.dispose(); this.spot.shadow.map = null; }
  }

  get def() { return this.passive ? { w: 0.8, h: 0.8, share: 0.6, beam: 55, pen: 1, round: true } : MODIFIERS[this.s.mod]; }

  /** (re)constrói a cabeça quando muda o modificador */
  build() {
    if (this.head) { this.group.remove(this.head); this.head.traverse(o => { o.geometry?.dispose?.(); }); }
    this.head = this.passive ? buildReflector(this.s.surface) : buildHead(this.s.mod);
    this.head.traverse(o => { o.userData.light = this; });
    this.group.add(this.head);
    this.stand.group.traverse(o => { o.userData.light = this; });
    /* (a cabeça não projeta sombra — ver buildHead; os tripés sim) */
    this._modBuilt = this.passive ? 'refl-' + this.s.surface : this.s.mod;
    this.dirty = true;
  }

  /** Energia útil no eixo (cd·s). Rebatedores calculam-na à parte. */
  get output() {
    if (this.passive) return this._bounceI || 0;
    return FULL_WS * Math.pow(2, this.s.power) * K_CDS * this.def.eff;
  }

  /** cor linear da luz (temperatura × gel), normalizada à luminância */
  color() {
    const s = this.s;
    let c = kelvinRGB(s.kelvin);
    const gel = GELS[s.gel];
    if (gel?.k) c = kelvinRGB(s.kelvin * gel.k / 5600);
    else if (gel?.rgb) {
      const r = gel.rgb.map(x => x * x);       // gel ≈ filtro: sRGB → linear
      const lum = 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
      c = c.map((x, i) => x * r[i] / lum * 0.35);   // géis comem ~1,5 stops
    }
    if (this.passive) { const t = SURFACES[s.surface].tint; c = this._bounceRGB ? this._bounceRGB.map((x, i) => x * t[i]) : c; }
    return c;
  }

  /** Posições derivadas do estado. */
  layout() {
    const st = this.studio, s = this.s;
    const face = st.facePoint(_a);
    const pos = face.clone().addScaledVector(dirFrom(s.az, s.el), s.dist);
    pos.y = Math.max(0.35, pos.y);
    let aim = s.aim === 'backdrop' ? st.backdropPoint(_b) : face.clone();
    /* feathering: rodar o eixo para fora do sujeito (yaw) e inclinar (pitch) */
    const toAim = _c.subVectors(aim, pos);
    const yaw = Math.atan2(toAim.x, toAim.z) + s.feather * DEG;
    const len = toAim.length(), horiz = Math.hypot(toAim.x, toAim.z);
    const pitch = Math.atan2(toAim.y, horiz) + s.tilt * DEG;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    aim = pos.clone().addScaledVector(dir, Math.max(0.5, len));
    return { pos, aim, dir, face };
  }

  update() {
    const s = this.s;
    if (this._modBuilt !== (this.passive ? 'refl-' + s.surface : s.mod)) this.build();
    const { pos, aim, dir } = this.layout();
    this.pos = pos; this.dir = dir; this.aimPoint = aim;
    this.head.position.copy(pos);
    this.head.lookAt(aim);
    this.handle.position.copy(pos);

    /* tripé: a forquilha agarra atrás da face emissora; girafa quando a
       luz está à frente do sujeito e alta (senão o tripé entra no retrato) */
    const pivot = _d.set(0, 0, this.head.userData.pivotZ ?? -0.15).applyQuaternion(this.head.quaternion).add(pos);
    const az = ((s.az % 360) + 540) % 360 - 180;
    const needBoom = !this.passive && Math.abs(az) < 40 && s.el > 18 && s.aim === 'subject';
    const low = pivot.y < 0.9;
    if (needBoom) {
      const out = new THREE.Vector3(pivot.x, 0, pivot.z);
      const side = Math.sign(pivot.x || -1);
      const base = new THREE.Vector3(pivot.x + side * 1.1, 0, pivot.z + 0.15);
      this.stand.group.position.copy(base);
      const reach = Math.hypot(pivot.x - base.x, pivot.z - base.z);
      this.stand.set(pivot.y - 0.04, reach, Math.atan2(-(pivot.z - base.z), pivot.x - base.x));
      void out;
    } else {
      this.stand.group.position.set(pivot.x, 0, pivot.z);
      this.stand.set(low ? 0.9 : pivot.y - 0.12, 0, 0);
    }
    this.stand.group.visible = !low || needBoom;

    /* parâmetros óticos */
    const d = this.def;
    const share = d.share;
    this.spot.position.copy(pos).addScaledVector(dir, -0.02);
    this.target.position.copy(aim);
    this.spot.angle = clamp(d.beam * DEG, 0.05, 1.45);
    this.spot.penumbra = d.pen;
    /* o frustum da sombra cobre ~1,1 m à volta do alvo, qualquer que seja o feixe */
    const dist = pos.distanceTo(aim);
    const need = Math.atan(1.1 / Math.max(0.3, dist));
    this.spot.shadow.focus = clamp(need / this.spot.angle, 0.2, 1);
    /* penumbra ∝ tamanho aparente da fonte (em texels do mapa de sombra) */
    const size = Math.max(d.w, d.h);
    const texelsPerM = this.spot.shadow.mapSize.x / (2 * Math.tan(this.spot.angle * this.spot.shadow.focus) * dist);
    this.spot.shadow.radius = clamp(size / dist * 0.022 * texelsPerM, 1, 22);

    this.rect.width = d.round ? d.w * 0.886 : d.w;
    this.rect.height = d.round ? d.h * 0.886 : d.h;
    this.rect.position.copy(pos).addScaledVector(dir, 0.004);
    this.rect.lookAt(aim);
    this.share = share;
    this.dirty = false;
  }

  /** intensidade efetiva (considera on/solo) */
  get live() {
    const st = this.studio;
    if (!this.s.on) return false;
    const anySolo = st.lights.some(l => l.s.solo);
    return anySolo ? this.s.solo : true;
  }

  /** Aplica intensidades (cd·s) às luzes three.js. */
  applyIntensity() {
    const I = this.live ? this.output : 0;
    const c = this.color();
    this.spot.color.setRGB(c[0], c[1], c[2]);
    this.rect.color.setRGB(c[0], c[1], c[2]);
    this.spot.intensity = I * (1 - this.share);
    const A = this.rect.width * this.rect.height;
    this.rect.intensity = I * this.share / A;
    /* superfícies emissoras: luminância do difusor (HDR) */
    const L = this.share > 0 ? I * this.share / A : I / 0.01;
    for (const m of this.head.userData.emit || []) {
      const k = m.name === 'emit-core' ? (this.share > 0 ? L * 3 : L) : m.name === 'emit-soft' ? L * (this.share > 0 ? 0.6 : 0.004) : L;
      m.material.color.setRGB(c[0] * k, c[1] * k, c[2] * k);
      m.visible = I > 0 || m.name !== 'emit-core';
      if (I <= 0) m.material.color.setRGB(0.02, 0.02, 0.02);
    }
  }

  /** Iluminância (lux·s) que esta luz entrega num ponto p com normal n
   *  (n = null → esfera de fotómetro virada para nDome). Sem oclusão. */
  illuminanceAt(p, nDome) {
    if (!this.live || !this.pos) return 0;
    const I = this.output;
    const toP = _a.subVectors(p, this.pos); const d = Math.max(0.05, toP.length()); toP.divideScalar(d);
    const cosE = Math.max(0, toP.dot(this.dir));
    /* componente de área: emissor lambertiano */
    const area = this.share * cosE;
    /* componente dura: cone com penumbra */
    const ang = Math.acos(Math.min(1, cosE)), outer = this.spot.angle, inner = outer * (1 - this.spot.penumbra);
    const cone = ang <= inner ? 1 : ang >= outer ? 0 : 1 - (ang - inner) / (outer - inner);
    const hard = (1 - this.share) * cone * cone;
    const toL = _b.copy(toP).negate();
    const cosR = nDome ? (1 + toL.dot(nDome)) / 2 : 1;          // domo de fotómetro
    return I * (area + hard) / (d * d) * Math.max(0, cosR);
  }

  dispose() {
    this.group.removeFromParent();
    this.studio.releaseSlot(this.slot);
    this.group.traverse(o => { o.geometry?.dispose?.(); });
  }
}

/** Rebatedor: calcula o que recebe das luzes ativas e devolve-o (passivo). */
export function updateBounce(refl, lights) {
  if (!refl.pos) return;
  const n = refl.dir;
  let E = 0; const rgb = [0, 0, 0];
  for (const l of lights) {
    if (l === refl || l.passive || !l.live) continue;
    /* iluminância na face do disco (só conta luz que chega pela frente) */
    const toL = _c.subVectors(l.pos, refl.pos).normalize();
    const cosR = toL.dot(n);
    if (cosR <= 0) continue;
    const e = l.illuminanceAt(refl.pos, null) * cosR;
    const c = l.color();
    E += e; rgb[0] += e * c[0]; rgb[1] += e * c[1]; rgb[2] += e * c[2];
  }
  const surf = SURFACES[refl.s.surface];
  /* disco Ø80: intensidade no eixo ≈ L·A, L = ρE/π; o prateado concentra (×2) */
  const A = Math.PI * 0.4 * 0.4;
  refl._bounceI = surf.rho * E / Math.PI * A * (surf.gloss ? 2.2 : 1);
  refl._bounceRGB = E > 0 ? rgb.map(x => x / E) : [1, 1, 1];
  refl.share = surf.gloss ? 0.55 : 0.95;
}
