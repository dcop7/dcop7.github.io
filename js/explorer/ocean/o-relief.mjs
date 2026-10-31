/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — vista "Relevo": a grelha regional GMRT como um bloco
   3D com exagero vertical, curvas de nível, as zonas pelágicas nas
   paredes e a posição do submersível. Controlo de órbita próprio.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, clamp, fmt, esc } from './o-core.mjs';
import { ZONES } from './o-content.mjs';

const KM = 1 / 1000;
const ZC = ZONES.map(z => new THREE.Color(z.color));

export class Relief {
  constructor(engine, site, sd, floor) {
    this.E = engine; this.site = site; this.sd = sd; this.F = floor;
    const g = sd.region, data = floor.region, box = g.box;
    const span = Math.max(g.W, g.H), relief = g.max - g.min;
    this.ve = clamp(Math.round(span * 0.12 / Math.max(relief, 1)), 1, 12);
    const VE = this.ve;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(42, engine.w / engine.h, 0.1, 5000);
    /* terreno */
    const nx = g.nx, nz = g.nz, pos = new Float32Array(nx * nz * 3), hs = new Float32Array(nx * nz);
    const ll = (c, r) => [box.w + (box.e - box.w) * c / (nx - 1), box.n - (box.n - box.s) * r / (nz - 1)];
    let k = 0;
    for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) {
      const [lon, lat] = ll(c, r), [x, z] = data.toWorld(lon, lat), h = floor.region(x, z);
      pos[k * 3] = x * KM; pos[k * 3 + 1] = h * KM * VE; pos[k * 3 + 2] = z * KM; hs[k] = h; k++;
    }
    const idx = []; for (let r = 0; r < nz - 1; r++) for (let c = 0; c < nx - 1; c++) { const a = r * nx + c, b = a + nx; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aH', new THREE.BufferAttribute(hs, 1)); geo.setIndex(idx); geo.computeVertexNormals();
    const tm = new THREE.ShaderMaterial({ toneMapped: false, extensions: { derivatives: true },
      uniforms: { uL: { value: new THREE.Vector3(-0.5, 0.75, -0.35).normalize() }, uMin: { value: g.min }, uMax: { value: g.max } },
      vertexShader: 'attribute float aH; varying float vH; varying vec3 vN; void main(){ vH = aH; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uL; uniform float uMin, uMax; varying float vH; varying vec3 vN;
vec3 pal(float d){ /* profundidade (m, positiva) → cor */
  vec3 a = vec3(0.62, 0.86, 0.93), b = vec3(0.26, 0.58, 0.78), c = vec3(0.13, 0.30, 0.58), e = vec3(0.10, 0.12, 0.34), f = vec3(0.10, 0.05, 0.16);
  return d < 1000.0 ? mix(a, b, d / 1000.0) : d < 4000.0 ? mix(b, c, (d - 1000.0) / 3000.0) : d < 6000.0 ? mix(c, e, (d - 4000.0) / 2000.0) : mix(e, f, clamp((d - 6000.0) / 5000.0, 0.0, 1.0));
}
void main(){
  float d = -vH; vec3 n = normalize(vN);
  float sh = clamp(dot(n, uL), 0.0, 1.0) * 0.85 + 0.25;
  vec3 col = pal(d) * sh;
  float s1 = d / 500.0, w1 = fwidth(s1); float l1 = 1.0 - smoothstep(0.0, w1 * 1.2, abs(fract(s1 + 0.5) - 0.5));
  float s2 = d / 100.0, w2 = fwidth(s2); float l2 = 1.0 - smoothstep(0.0, w2 * 1.0, abs(fract(s2 + 0.5) - 0.5));
  col = mix(col, col * 0.55, l1 * 0.8); col = mix(col, col * 0.82, l2 * 0.35 * smoothstep(3.0, 0.5, w2 * 10.0));
  gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}` });
    this.scene.add(new THREE.Mesh(geo, tm));
    /* paredes: água por zonas (de 0 até ao relevo) e rocha por baixo */
    const base = g.min * KM * VE - span * KM * 0.03;
    const water = [], rock = [];
    const edge = (list) => { for (let i = 0; i < list.length - 1; i++) { const [a, b] = [list[i], list[i + 1]]; const pa = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], pb = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]];
      water.push(pa[0], 0, pa[2], pb[0], 0, pb[2], pa[0], pa[1], pa[2], pb[0], 0, pb[2], pb[0], pb[1], pb[2], pa[0], pa[1], pa[2]);
      rock.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pa[0], base, pa[2], pb[0], pb[1], pb[2], pb[0], base, pb[2], pa[0], base, pa[2]); } };
    const top = [...Array(nx).keys()], bot = top.map(c => (nz - 1) * nx + c), lef = [...Array(nz).keys()].map(r => r * nx), rig = lef.map(i => i + nx - 1);
    edge(top); edge(bot.slice().reverse()); edge(lef.slice().reverse()); edge(rig);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(water, 3));
    const wm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, uniforms: { uVE: { value: VE }, uC: { value: ZC }, uZ: { value: ZONES.map(z => z.to) } },
      vertexShader: 'varying float vD; uniform float uVE; void main(){ vD = -position.y / uVE * 1000.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uC[5]; uniform float uZ[5]; varying float vD;
void main(){ vec3 c = uC[4]; for (int i = 4; i >= 0; i--) if (vD < uZ[i]) c = uC[i];
  float edgeL = 0.0; for (int i = 0; i < 4; i++) edgeL = max(edgeL, 1.0 - smoothstep(0.0, fwidth(vD) * 1.5, abs(vD - uZ[i])));
  gl_FragColor = vec4(mix(c, vec3(1.0), edgeL * 0.6), 0.34 + edgeL * 0.4);
#include <colorspace_fragment>
}` });
    this.scene.add(new THREE.Mesh(wg, wm));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rock, 3)); rg.computeVertexNormals();
    this.scene.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#3b2f27', side: THREE.DoubleSide, toneMapped: false })));
    /* contorno da superfície */
    const xs = [pos[0], pos[(nx - 1) * 3]], zs = [pos[2], pos[((nz - 1) * nx) * 3 + 2]];
    const sq = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xs[0], 0, zs[0]), new THREE.Vector3(xs[1], 0, zs[0]), new THREE.Vector3(xs[1], 0, zs[1]), new THREE.Vector3(xs[0], 0, zs[1]), new THREE.Vector3(xs[0], 0, zs[0])]);
    this.scene.add(new THREE.Line(sq, new THREE.LineBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.6, toneMapped: false })));
    /* coluna do mergulho e o submersível */
    const by = floor.region(0, 0) * KM * VE;
    const col = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, by, 0)]);
    this.scene.add(new THREE.Line(col, new THREE.LineBasicMaterial({ color: '#ffd27a', toneMapped: false })));
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(span * KM * 0.006, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb340', toneMapped: false }));
    this.scene.add(this.dot);
    this.bounds = { xs, zs, base, span: span * KM };
    /* órbita */
    this.o = { yaw: 0.7, pitch: 0.55, dist: span * KM * 1.25, t: new THREE.Vector3(0, base * 0.4, 0) };
    this._bind();
    /* rótulos */
    this.labels = document.createElement('div'); this.labels.className = 'oc-rlabels';
    engine.host.appendChild(this.labels);
    this.items = this._labelItems(data, hs, pos, nx, nz);
    this.labels.innerHTML = this.items.map((it, i) => `<span class="oc-rlab ${it.cls || ''}" data-i="${i}">${it.html}</span>`).join('') +
      `<div class="oc-rlegend"><strong>${esc(site.name)}</strong><span>Batimetria GMRT · ${fmt(g.W / 1000)} × ${fmt(g.H / 1000)} km · exagero vertical ×${VE}</span><span>Curvas de nível a cada 500 m · paredes: zonas pelágicas</span></div>`;
  }
  _labelItems(data, hs, pos, nx, nz) {
    let mi = 0, ma = 0; for (let i = 0; i < hs.length; i++) { if (hs[i] < hs[mi]) mi = i; if (hs[i] > hs[ma]) ma = i; }
    const P = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const { xs, zs, base } = this.bounds, VE = this.ve;
    const it = [
      { p: new THREE.Vector3(0, 0, 0), html: `<b>${esc(this.site.name)}</b>mergulho`, cls: 'is-site' },
      { p: P(mi), html: `mais fundo: ${fmt(-hs[mi])} m`, cls: 'is-pt' },
      { p: P(ma), html: `menos fundo: ${fmt(-hs[ma])} m`, cls: 'is-pt' },
      { p: new THREE.Vector3((xs[0] + xs[1]) / 2, 0, zs[0]), html: 'N ↑', cls: 'is-n' },
    ];
    for (const z of ZONES) { const mid = (z.from + Math.min(z.to, -this.sd.region.min)) / 2, th = (Math.min(z.to, -this.sd.region.min) - z.from) * VE / 1000 / this.bounds.span; if (z.from < -this.sd.region.min && th > 0.012) it.push({ p: new THREE.Vector3(xs[0], -mid * KM * VE, zs[1]), html: esc(z.name), cls: 'is-zone' }); }
    if (this.site.id === 'marianas') {
      it.push({ p: new THREE.Vector3(0, 0, zs[1] * 0.7), html: 'Placa do Pacífico<br><small>mergulha para norte</small>', cls: 'is-plate' });
      it.push({ p: new THREE.Vector3(0, 0, zs[0] * 0.7), html: 'Placa das Marianas', cls: 'is-plate' });
    }
    void base; void nx; void nz; void data;
    return it;
  }
  _bind() {
    const el = this.E.renderer.domElement; let d = null;
    this._pd = e => { d = { x: e.clientX, y: e.clientY, b: e.button }; };
    this._pm = e => { if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
      if (d.b === 2 || e.shiftKey) { const s = this.o.dist * 0.0015; const r = new THREE.Vector3(Math.cos(this.o.yaw), 0, -Math.sin(this.o.yaw)), f = new THREE.Vector3(Math.sin(this.o.yaw), 0, Math.cos(this.o.yaw)); this.o.t.addScaledVector(r, -dx * s).addScaledVector(f, -dy * s); }
      else { this.o.yaw -= dx * 0.006; this.o.pitch = clamp(this.o.pitch + dy * 0.005, 0.05, 1.5); } };
    this._pu = () => { d = null; };
    this._wh = e => { e.preventDefault(); e.stopImmediatePropagation(); this.o.dist = clamp(this.o.dist * Math.exp(e.deltaY * 0.001), this.bounds.span * 0.15, this.bounds.span * 4); };
    this._cm = e => e.preventDefault();
    el.addEventListener('pointerdown', this._pd); addEventListener('pointermove', this._pm); addEventListener('pointerup', this._pu);
    el.addEventListener('wheel', this._wh, { passive: false, capture: true }); el.addEventListener('contextmenu', this._cm);
  }
  marker(depth) { this.dot.position.set(this.E.sub.p.x * KM, -depth * KM * this.ve, this.E.sub.p.z * KM); }
  render() {
    const E = this.E, r = E.renderer, o = this.o;
    this.cam.aspect = E.w / E.h; this.cam.updateProjectionMatrix();
    this.cam.position.set(o.t.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, o.t.y + Math.sin(o.pitch) * o.dist, o.t.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    this.cam.lookAt(o.t);
    r.setRenderTarget(null); r.setClearColor(0x05070b, 1); r.clear(); r.render(this.scene, this.cam);
    const v = new THREE.Vector3();
    this.labels.querySelectorAll('.oc-rlab').forEach(el => { const p = this.items[+el.dataset.i].p; v.copy(p).project(this.cam); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; el.style.opacity = vis ? 1 : 0; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * E.w}px, ${(-v.y * 0.5 + 0.5) * E.h}px)`; });
  }
  dispose() {
    const el = this.E.renderer.domElement;
    el.removeEventListener('pointerdown', this._pd); removeEventListener('pointermove', this._pm); removeEventListener('pointerup', this._pu);
    el.removeEventListener('wheel', this._wh, { capture: true }); el.removeEventListener('contextmenu', this._cm);
    this.labels.remove();
    this.scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }
}
