/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — o fundo do mar.

   Relevo = batimetria GMRT real (grelha local de ~30 m e regional de
   ~300–800 m, interpolação bicúbica) + pormenor procedural abaixo da
   resolução dos dados (sedimento, blocos de rocha), assinalado na UI como
   tal. A malha visível é uma grelha de 1,5 m que acompanha a câmara e é
   reconstruída aos bocados, sem engasgos.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, D2R, clamp, lerp, smooth, fbm, vnoise, rng, WATER_PARS } from './o-core.mjs';
import { waterify, WU } from './o-water.mjs';
import { getModel } from './o-fauna.mjs';

const R_EARTH = 6371008.8;

/* ── amostrador de uma grelha Int16 em coordenadas do mundo ── */
function gridSampler(data, meta, origin) {
  const { nx, nz, box } = meta;
  const lat0 = origin.lat, lon0 = origin.lon, kx = Math.cos(lat0 * D2R) * R_EARTH * D2R, kz = R_EARTH * D2R;
  const at = (c, r) => data[clamp(r, 0, nz - 1) * nx + clamp(c, 0, nx - 1)];
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const f = (x, z) => {
    const lon = lon0 + x / kx, lat = lat0 - z / kz;
    const fc = (lon - box.w) / (box.e - box.w) * (nx - 1), fr = (box.n - lat) / (box.n - box.s) * (nz - 1);
    const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r;
    const row = k => cr(at(c - 1, r + k), at(c, r + k), at(c + 1, r + k), at(c + 2, r + k), u);
    return cr(row(-1), row(0), row(1), row(2), v);
  };
  /* distância (m) ao bordo da caixa, negativa fora */
  f.inside = (x, z) => {
    const lon = lon0 + x / kx, lat = lat0 - z / kz;
    return Math.min((lon - box.w) * kx, (box.e - lon) * kx, (lat - box.s) * kz, (box.n - lat) * kz);
  };
  f.toWorld = (lon, lat) => [(lon - lon0) * kx, -(lat - lat0) * kz];
  f.toGeo = (x, z) => [lon0 + x / kx, lat0 - z / kz];
  return f;
}

/* pormenor por tipo de fundo — tudo abaixo da resolução da batimetria */
const DETAIL = {
  marianas: (x, z) => fbm(x / 14, z / 14, 3) * 0.7 + fbm(x / 2.2, z / 2.2, 2) * 0.08,
  rainbow: (x, z) => { const r = 1 - Math.abs(fbm(x / 18, z / 18, 3)); return r * r * 3.2 + fbm(x / 3, z / 3, 3) * 0.6 + Math.max(0, vnoise(x / 1.4, z / 1.4) - 0.55) * 0.9; },
  ccz: (x, z) => fbm(x / 9, z / 9, 3) * 0.25 + fbm(x / 1.5, z / 1.5, 2) * 0.03,
};
const PALETTE = {
  marianas: { sed: '#8f8a7c', sed2: '#b3ab98', rock: '#4c4a46', grain: 0.12 },
  rainbow: { sed: '#4d4135', sed2: '#62503b', rock: '#221d19', grain: 0.3 },
  ccz: { sed: '#7d6a52', sed2: '#a08a6a', rock: '#3a3028', grain: 0.1 },
};

export class Seafloor {
  constructor(engine, site, sdata, gl, gr) {
    this.E = engine; this.site = site; this.sd = sdata;
    const L = sdata.local, dive = L.dive;
    const lon = L.box.w + (L.box.e - L.box.w) * dive[0] / (L.nx - 1), lat = L.box.n - (L.box.n - L.box.s) * dive[1] / (L.nz - 1);
    this.origin = { lat, lon };
    this.local = gridSampler(gl, L, this.origin);
    this.region = gridSampler(gr, sdata.region, this.origin);
    this.detail = DETAIL[site.id];
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.vents = [];
    this.heightAt = this.heightAt.bind(this);
    this.baseAt = this.baseAt.bind(this);
    /* chaminés antes da malha: o monte de sulfuretos entra no relevo */
    if (site.id === 'rainbow') this._placeVents();
    this._initMesh();
    this._initProps();
  }
  /** batimetria (m, negativo) sem pormenor */
  baseAt(x, z) {
    const d = this.local.inside(x, z);
    if (d > 400) return this.local(x, z);
    const r = this.region(x, z);
    if (d < 0) return r;
    return lerp(r, this.local(x, z), smooth(0, 400, d));
  }
  heightAt(x, z) {
    let h = this.baseAt(x, z) + this.detail(x, z);
    for (const v of this.vents) { const d = Math.hypot(x - v.x, z - v.z); if (d < v.mound) h += v.mh * (1 - smooth(0, v.mound, d)); }
    return h;
  }
  get bottom() { return -this.heightAt(0, 0); }

  /* ── malha que segue a câmara ── */
  _initMesh() {
    const mob = this.E.mobile;
    this.N = mob ? 150 : 230; this.S = mob ? 2 : 1.5;
    const N = this.N, n = N * N;
    const g = new THREE.BufferGeometry();
    this._pos = [new Float32Array(n * 3), new Float32Array(n * 3)];
    this._nrm = [new Float32Array(n * 3), new Float32Array(n * 3)];
    this._col = [new Float32Array(n * 3), new Float32Array(n * 3)];
    g.setAttribute('position', new THREE.BufferAttribute(this._pos[0], 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this._nrm[0], 3));
    g.setAttribute('color', new THREE.BufferAttribute(this._col[0], 3));
    const idx = new Uint32Array((N - 1) * (N - 1) * 6); let k = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + N; idx[k++] = a; idx[k++] = b; idx[k++] = a + 1; idx[k++] = b; idx[k++] = b + 1; idx[k++] = a + 1; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const P = PALETTE[this.site.id];
    const mat = waterify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), {
      key: 'floor',
      fragPars: `float fh(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5), c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fgrain(vec2 p){ return fh(p*3.1)*0.5 + fh(p*7.3)*0.3 + fh(p*17.0)*0.2; }`,
      colorFrag: `{ vec3 wpc = cameraPosition + vWRel; diffuseColor.rgb *= 1.0 - ${P.grain.toFixed(2)} + ${(P.grain * 2).toFixed(2)} * fgrain(wpc.xz); }`,
      normalFrag: `{ vec3 wpn = cameraPosition + vWRel; float hb = fgrain(wpn.xz * 1.3) * 0.05 + fh(wpn.xz * 0.6) * 0.06;
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hb), dhy = dFdy(hb);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
  vec3 gr = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - gr); }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.group.add(this.mesh);
    this._cur = 0; this._job = null; this._center = null;
    this.colors = { sed: new THREE.Color(P.sed), sed2: new THREE.Color(P.sed2), rock: new THREE.Color(P.rock) };
  }
  *_build(cx, cz, slot) {
    const N = this.N, S = this.S, half = (N - 1) * S / 2;
    const pos = this._pos[slot], nrm = this._nrm[slot], col = this._col[slot];
    const C = this.colors, tmp = new THREE.Color();
    const H = new Float32Array((N + 2) * (N + 2));
    for (let j = -1; j <= N; j++) {
      for (let i = -1; i <= N; i++) H[(j + 1) * (N + 2) + (i + 1)] = this.heightAt(cx - half + i * S, cz - half + j * S);
      if (j % 24 === 0) yield;
    }
    const h = (i, j) => H[(j + 1) * (N + 2) + (i + 1)];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = (j * N + i) * 3, x = cx - half + i * S, z = cz - half + j * S, y = h(i, j);
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        let nx = h(i - 1, j) - h(i + 1, j), nz = h(i, j - 1) - h(i, j + 1), ny = 2 * S; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        nrm[k] = nx; nrm[k + 1] = ny; nrm[k + 2] = nz;
        const slope = 1 - ny;
        tmp.copy(C.sed).lerp(C.sed2, vnoise(x / 6, z / 6) * 0.7).lerp(C.rock, smooth(0.08, 0.35, slope + (vnoise(x / 3, z / 3) - 0.5) * 0.15));
        for (const v of this.vents) {
          const d = Math.hypot(x - v.x, z - v.z);
          if (d < v.mound * 1.3) tmp.lerp(new THREE.Color('#231a13'), 0.75 * (1 - smooth(0, v.mound * 1.3, d)));
          if (d < 9) { const m = vnoise(x * 0.9 + v.x, z * 0.9) > 0.45 ? 1 : 0; tmp.lerp(new THREE.Color(m ? '#e8dcb0' : '#b4782e'), (1 - smooth(2, 9, d)) * 0.75); }
        }
        col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
      }
      if (j % 30 === 0) yield;
    }
  }
  update() {
    const cam = this.E.camera.position, sub = this.E.sub.p;
    const alt = sub.y - this.heightAt(sub.x, sub.z);
    const near = alt < 450 || cam.y - this.heightAt(cam.x, cam.z) < 450;
    this.near = near; this.alt = alt;
    if (!near) { this.mesh.visible = false; this._center = null; for (const p of this.props) p.mesh.visible = false; return; }
    const step = this.S * 16;
    const cx = Math.round(cam.x / step) * step, cz = Math.round(cam.z / step) * step;
    if (!this._job && (!this._center || Math.hypot(cx - this._center[0], cz - this._center[1]) > step * 2.5)) {
      const slot = 1 - this._cur; this._job = { it: this._build(cx, cz, slot), slot, c: [cx, cz] };
      if (!this._center) { while (!this._job.it.next().done); this._swap(); }
    }
    if (this._job) { const t0 = performance.now(); while (performance.now() - t0 < 4) if (this._job.it.next().done) { this._swap(); break; } }
    this.mesh.visible = !!this._center;
    for (const p of this.props) this._updateProp(p);
  }
  _swap() {
    const j = this._job, g = this.mesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(this._pos[j.slot], 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this._nrm[j.slot], 3));
    g.setAttribute('color', new THREE.BufferAttribute(this._col[j.slot], 3));
    this._cur = j.slot; this._center = j.c; this._job = null;
  }

  /* ── fontes hidrotermais (Rainbow): chaminés de sulfuretos com fumo negro ── */
  _placeVents() {
    const R = rng(1997);
    const spots = [[6, -14], [-10, -22], [18, -30], [-4, -40], [-22, -8], [26, -12], [8, -55], [-30, -34]];
    for (const [x, z] of spots) {
      const hgt = 4 + R() * 11;
      this.vents.push({ x: x + (R() - 0.5) * 4, z: z + (R() - 0.5) * 4, h: hgt, r: 0.6 + R() * 0.7, mound: 7 + R() * 6, mh: 1.5 + R() * 2.5, seed: R() * 100 });
    }
  }
  _ventMeshes() {
    const mats = waterify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), { key: 'vent' });
    const R = rng(365);
    const spire = (v, h, r0, ox, oz, tilt, seed) => {
      const ns = 40, pts = [];
      for (let i = 0; i <= ns; i++) { const t = i / ns; pts.push(new THREE.Vector2(r0 * (1.5 - 1.05 * Math.pow(t, 0.8)) * (0.85 + 0.3 * vnoise(t * 5 + seed, seed)), t * h)); }
      pts.push(new THREE.Vector2(r0 * 0.25, h - 0.05), new THREE.Vector2(0.001, h - 0.4));
      const g = new THREE.LatheGeometry(pts, 26);
      const p = g.attributes.position, cl = [], c = new THREE.Color();
      const BLK = new THREE.Color('#15120f'), RUST = new THREE.Color('#7c3f17'), OCH = new THREE.Color('#a8662a'), GRY = new THREE.Color('#6d6862'), WHT = new THREE.Color('#cfc7b4');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = y / h;
        const bump = 0.7 + 0.45 * vnoise(a * 2.2 + seed, y * 0.8) + 0.3 * vnoise(a * 6 + seed, y * 2.6) + 0.12 * vnoise(a * 15, y * 7);
        const fl = Math.max(0, Math.sin(y * 1.1 + seed * 3 + vnoise(a * 2, y) * 2) - 0.9) * 10 * (1 - t);
        const k = bump * (1 + fl * 0.45);
        p.setX(i, x * k + ox * t * t); p.setZ(i, z * k + oz * t * t); p.setY(i, y + tilt * x);
        c.copy(BLK).lerp(RUST, smooth(0.45, 0.8, vnoise(a * 3 + seed, y * 1.4)) * (1 - t) * 0.9).lerp(OCH, smooth(0.7, 0.9, vnoise(a * 5, y * 3)) * (1 - t) * 0.6);
        c.lerp(GRY, smooth(0.6, 0.95, t) * 0.7).lerp(WHT, smooth(0.62, 0.8, vnoise(a * 4 + seed, y * 2.2)) * smooth(0.55, 0.9, t) * 0.7);
        if (fl > 0.1) c.lerp(OCH, 0.5);
        cl.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mats); m.position.set(v.x + ox * 0.0, v.base, v.z); this.group.add(m);
      return new THREE.Vector3(v.x + ox, v.base + h, v.z + oz);
    };
    for (const v of this.vents) {
      v.base = this.heightAt(v.x, v.z) - 0.5;
      const top = spire(v, v.h, v.r, (R() - 0.5) * 0.8, (R() - 0.5) * 0.8, 0, v.seed);
      v.top = top; v.tops = [top];
      const nb = 1 + Math.floor(R() * 3);
      for (let k = 0; k < nb; k++) {
        const a = R() * 6.283, d = v.r * (0.6 + R() * 0.6), h = v.h * (0.3 + R() * 0.45);
        const vv = { x: v.x + Math.cos(a) * d, z: v.z + Math.sin(a) * d, base: v.base + 0.2 };
        v.tops.push(spire(vv, h, v.r * (0.35 + R() * 0.25), Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0, v.seed + k * 7));
      }
      for (const t of v.tops) { const pl = makePlume(t, v.r * 0.5); this.group.add(pl); (v.plumes = v.plumes || []).push(pl); }
      v.plume = v.plumes[0];
    }
  }

  /* ── objetos espalhados em células à volta da câmara ── */
  _initProps() {
    this.props = [];
    const id = this.site.id, mob = this.E.mobile;
    if (id === 'rainbow') this._ventMeshes();
    const rock = (seed, det = 1) => { const g = new THREE.SphereGeometry(0.5, 8 + det * 4, 6 + det * 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.75 + vnoise(v.x * 3 + seed, v.y * 3 + v.z * 2) * 0.5); p.setXYZ(i, v.x, v.y * 0.7, v.z); } g.computeVertexNormals(); return g; };
    const colorize = (g, a, b) => { const p = g.attributes.position, c = []; const A = new THREE.Color(a), B = new THREE.Color(b), t = new THREE.Color(); for (let i = 0; i < p.count; i++) { t.copy(A).lerp(B, vnoise(p.getX(i) * 9, p.getY(i) * 9 + p.getZ(i) * 5)); c.push(t.r, t.g, t.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
    const rmat = () => waterify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { key: 'rock' });
    if (id === 'ccz') {
      /* nódulos polimetálicos: ~5–10 cm, meio enterrados, a cobrir boa parte do fundo */
      this.props.push(this._scatter({ geo: colorize(rock(3, 1), '#0e0c0b', '#2c241e'), mat: rmat(), cell: 2, r: mob ? 16 : 22, per: mob ? 18 : 34, size: [0.035, 0.11], sink: 0.22, max: mob ? 10000 : 30000, seed: 11 }));
      this.props.push(this._scatter({ geo: getModel('xeno').geo, mat: getModel('xeno').mat, cell: 6, r: 40, per: 0.5, size: [0.06, 0.14], sink: 0.1, max: 600, seed: 12, model: true }));
    } else if (id === 'rainbow') {
      this.props.push(this._scatter({ geo: colorize(rock(5, 1), '#1a1715', '#4a3424'), mat: rmat(), cell: 3, r: 40, per: 3, size: [0.15, 1.1], sink: 0.3, max: 4000, seed: 21 }));
      this.props.push(this._scatter({ geo: colorize(rock(9, 0), '#15110e', '#5a3a20'), mat: rmat(), cell: 1.5, r: 22, per: 5, size: [0.05, 0.25], sink: 0.2, max: 8000, seed: 23, near: this.vents, nearR: [0, 18] }));
      this.props.push(this._scatter({ geo: getModel('mussel').geo, mat: getModel('mussel').mat, cell: 1.5, r: 30, per: 6, size: [0.06, 0.1], sink: 0.02, max: mob ? 5000 : 12000, seed: 22, model: true, near: this.vents, nearR: [3, 16] }));
    } else {
      this.props.push(this._scatter({ geo: colorize(rock(7, 1), '#55524c', '#7a756b'), mat: rmat(), cell: 6, r: 40, per: 0.3, size: [0.1, 0.4], sink: 0.4, max: 800, seed: 31 }));
      this.props.push(this._scatter({ geo: getModel('xeno').geo, mat: getModel('xeno').mat, cell: 7, r: 40, per: 0.35, size: [0.05, 0.12], sink: 0.1, max: 400, seed: 32, model: true }));
    }
  }
  _scatter(o) {
    const mesh = new THREE.InstancedMesh(o.geo, o.mat, o.max);
    mesh.count = 0; mesh.frustumCulled = false; mesh.visible = false;
    if (o.model) { const a = new Float32Array(o.max * 4); for (let i = 0; i < o.max; i++) a[i * 4] = i * 1.37; mesh.geometry = o.geo.clone(); mesh.geometry.setAttribute('aInst', new THREE.InstancedBufferAttribute(a, 4)); }
    this.group.add(mesh);
    return { ...o, mesh, key: null };
  }
  _updateProp(p) {
    const c = this.E.camera.position;
    const cx = Math.floor(c.x / p.cell), cz = Math.floor(c.z / p.cell), key = cx + ',' + cz;
    p.mesh.visible = true;
    if (p.key === key) return;
    p.key = key;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    const R = Math.ceil(p.r / p.cell); let n = 0;
    for (let j = -R; j <= R && n < p.max; j++) for (let i = -R; i <= R && n < p.max; i++) {
      const gx = cx + i, gz = cz + j;
      if ((i * i + j * j) * p.cell * p.cell > p.r * p.r) continue;
      const r = rng((gx * 73856093) ^ (gz * 19349663) ^ p.seed);
      const cnt = Math.floor(p.per + r());
      for (let k = 0; k < cnt && n < p.max; k++) {
        const x = (gx + r()) * p.cell, z = (gz + r()) * p.cell;
        if (p.near) { let ok = false; for (const vt of p.near) { const d = Math.hypot(x - vt.x, z - vt.z); if (d > p.nearR[0] && d < p.nearR[1] && r() < 1.2 - d / p.nearR[1]) { ok = true; break; } } if (!ok) continue; }
        const sz = lerp(p.size[0], p.size[1], r() ** 2);
        v.set(x, this.heightAt(x, z) - sz * p.sink, z);
        e.set((r() - 0.5) * 0.6, r() * 6.283, (r() - 0.5) * 0.6); q.setFromEuler(e); s.setScalar(sz);
        m.compose(v, q, s); p.mesh.setMatrixAt(n++, m);
      }
    }
    p.mesh.count = n; p.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.E.scene.remove(this.group); this.group.traverse(o => { o.geometry?.dispose(); }); }
}

/* fumo negro: billboards com ruído, normal (não aditivo) — escurece o que está atrás */
function makePlume(top, r) {
  const count = 220;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(count * 4); for (let i = 0; i < count * 4; i++) a[i] = Math.random();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    uniforms: { ...WU, uTop: { value: top.clone() }, uR: { value: r } }, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`attribute vec4 aSeed; uniform vec3 uTop; uniform float uR, uTime; varying vec2 vQ; varying float vA; varying vec3 vW;
void main(){
  float life = fract(aSeed.x + uTime * (0.05 + aSeed.y * 0.03));
  float h = life * life * 18.0 + life * 5.0;
  float spread = uR * 0.25 + h * 0.2;
  vec3 c = uTop + vec3(sin(aSeed.z * 40.0 + uTime * 0.7 + h * 0.5) * spread, h, cos(aSeed.w * 37.0 + uTime * 0.6 + h * 0.4) * spread);
  c.x += h * 0.25;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  float s = 0.18 + h * 0.3;
  mv.xy += position.xy * s;
  vQ = position.xy; vA = (1.0 - life) * smoothstep(0.0, 0.04, life); vW = c;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`varying vec2 vQ; varying float vA; varying vec3 vW;
${WATER_PARS}
void main(){
  float r = length(vQ); if (r > 1.0) discard;
  vec3 rel = vW - cameraPosition; float d = length(rel);
  vec3 lit = vec3(0.0);
  vec3 pv = (viewMatrix * vec4(vW, 1.0)).xyz;
  if (uHLon > 0.01) for (int i = 0; i < 2; i++) { vec3 lp = i == 0 ? uHLv0 : uHLv1; vec3 l = lp - pv; float dl = length(l); lit += smoothstep(0.55, 0.9, dot(-l / dl, i == 0 ? uHLdirV : uHLdir1)) * exp(-uExt * dl) / (dl * dl + 4.0); }
  vec3 col = vec3(0.2, 0.18, 0.16) * lit * uHLpow * uHLon;
  vec3 T = exp(-uExt * d);
  col = col * T + veilAt(rel / d, vW.y) * (1.0 - T);
  gl_FragColor = vec4(col, (1.0 - r * r) * vA * 0.8);
}`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 4;
  return mesh;
}
