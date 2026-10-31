/* ══════════════════════════════════════════════════════════════════════
   Universo observável — motor multi-escala.

   • Renderização relativa à câmara: o JS guarda posições em metros (doubles);
     a cada frame cada camada recebe (origem − câmara) / R e escala unidade/R,
     onde R = 10^s é a distância da câmara ao foco. O GPU trabalha sempre com
     números ~1, por isso a precisão é igual na Terra e no fundo cósmico.
   • Navegação: s (log10 de R em metros) é contínuo; a roda/pinça muda s de
     forma logarítmica. Dentro da imagem, as distâncias são LINEARES.
   • Foco: um objeto escolhido, ou uma "âncora" que depende da escala (Terra →
     Sol → centro galáctico → Grupo Local → nós). Muda suavemente.
   • Voos: caminho ótimo zoom-pan de van Wijk & Nuij (2003): afasta, desloca,
     aproxima — o mesmo princípio para ir da Lua a Andrómeda.
   • Referencial da órbita: eclíptico perto do Sol, galáctico a partir das
     estrelas (rotação suave entre s≈14 e 16).
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, clamp, smooth, band, frameFromPole, POLE_ECL, POLE_GAL, VERNAL, S_MIN, S_MAX, isMobile } from './u-core.mjs';

const RHO = 1.42;

export class Engine {
  constructor(host, { onPick, onFrame, anchor } = {}) {
    this.host = host;
    this.mobile = isMobile();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'uv-canvas';
    host.appendChild(this.canvas);
    this.blocked = [];
    this.labelsEl = document.createElement('div');
    this.labelsEl.className = 'uv-labels';
    host.appendChild(this.labelsEl);

    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.mobile, logarithmicDepthBuffer: true, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-7, 1e9);
    this.scene.add(this.camera);

    this.layers = [];
    this.onPick = onPick; this.onFrame = onFrame; this.anchor = anchor;
    /* estado de navegação */
    this.F = [0, 0, 0];            /* foco (m) */
    this.s = 9; this.sT = 9;
    this.yaw = -0.6; this.pitch = 0.35; this.yawT = this.yaw; this.pitchT = this.pitch;
    this.focusObj = null; this._lastTarget = null;
    this.flight = null;
    this.qEcl = frameFromPole(POLE_ECL, VERNAL);
    this.qGal = frameFromPole(POLE_GAL, [1, 0, 0]);
    this.qFrame = new THREE.Quaternion();
    this.C = [0, 0, 0];
    this.time = { jd: Date.now() / 86400000 + 2440587.5, speed: 0 };
    this.dirty = true; this.paused = false;
    this._v = new THREE.Vector3(); this._m = new THREE.Matrix4();
    this._labelPool = []; this._raf = 0; this._t = performance.now();
    this.ctx = { engine: this, C: this.C, R: 1, s: 9, k: 1, w: 1, h: 1, pxPerRad: 1, dpr: 1, mobile: this.mobile, jd: this.time.jd };

    this._initPost();
    this._bindInput();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(host);
    this.resize();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  addLayer(layer) { this.layers.push(layer); if (layer.group) this.scene.add(layer.group); layer.enabled = layer.enabled !== false; this.dirty = true; return layer; }
  invalidate() { this.dirty = true; }
  get R() { return Math.pow(10, this.s); }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    Object.assign(this.ctx, { w, h, dpr: this.renderer.getPixelRatio(), pxPerRad: h / (2 * Math.tan(this.camera.fov * Math.PI / 360)) });
    for (const L of this.layers) L.resize?.(this.ctx);
    this._resizePost();
    this.dirty = true;
  }

  /* ── pós-processamento: cena em HDR linear → bloom leve → ACES + sRGB ── */
  _initPost() {
    const mk = (s = 1) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: s === 1, samples: s === 1 && !this.mobile ? 4 : 0 });
    this.hdr = mk(1); this.bA = mk(0.5); this.bB = mk(0.5); this.bC = mk(0.25); this.bD = mk(0.25);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    this._pScene = new THREE.Scene(); this._pScene.add(quad); this._pQuad = quad;
    this._pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this._mBright = new THREE.ShaderMaterial({ vertexShader: V, uniforms: { t: { value: null }, texel: { value: new THREE.Vector2() } },
      fragmentShader: 'uniform sampler2D t; uniform vec2 texel; varying vec2 vUv; void main(){ vec3 c = vec3(0.0); for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) c += texture2D(t, vUv + vec2(i,j)*texel).rgb; c /= 9.0; float l = max(max(c.r,c.g),c.b); gl_FragColor = vec4(c * smoothstep(0.55, 2.2, l), 1.0); }' });
    this._mBlur = new THREE.ShaderMaterial({ vertexShader: V, uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
      fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir*1.385).rgb + texture2D(t, vUv - dir*1.385).rgb) * 0.316; c += (texture2D(t, vUv + dir*3.231).rgb + texture2D(t, vUv - dir*3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
    this._mFinal = new THREE.ShaderMaterial({ vertexShader: V, uniforms: { t: { value: null }, b1: { value: null }, b2: { value: null }, bloom: { value: 0.55 }, exposure: { value: 1.0 } },
      fragmentShader: `uniform sampler2D t, b1, b2; uniform float bloom, exposure; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb + (texture2D(b1, vUv).rgb * 0.6 + texture2D(b2, vUv).rgb * 0.9) * bloom; gl_FragColor = vec4(c * exposure, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}` });
  }
  _resizePost() {
    if (!this.hdr) return;
    const W = Math.max(1, Math.round(this.ctx.w * this.ctx.dpr)), H = Math.max(1, Math.round(this.ctx.h * this.ctx.dpr));
    this.hdr.setSize(W, H);
    this.bA.setSize(W >> 1, H >> 1); this.bB.setSize(W >> 1, H >> 1);
    this.bC.setSize(W >> 2, H >> 2); this.bD.setSize(W >> 2, H >> 2);
  }
  _pass(mat, target) { this._pQuad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this._pScene, this._pCam); }
  _post() {
    const r = this.renderer;
    const b = this._mBright, bl = this._mBlur;
    b.uniforms.t.value = this.hdr.texture; b.uniforms.texel.value.set(1 / this.hdr.width, 1 / this.hdr.height); this._pass(b, this.bA);
    bl.uniforms.t.value = this.bA.texture; bl.uniforms.dir.value.set(1 / this.bA.width, 0); this._pass(bl, this.bB);
    bl.uniforms.t.value = this.bB.texture; bl.uniforms.dir.value.set(0, 1 / this.bA.height); this._pass(bl, this.bA);
    bl.uniforms.t.value = this.bA.texture; bl.uniforms.dir.value.set(1 / this.bC.width, 0); this._pass(bl, this.bC);
    bl.uniforms.t.value = this.bC.texture; bl.uniforms.dir.value.set(0, 1 / this.bC.height); this._pass(bl, this.bD);
    const f = this._mFinal; f.uniforms.t.value = this.hdr.texture; f.uniforms.b1.value = this.bA.texture; f.uniforms.b2.value = this.bD.texture;
    this._pass(f, null);
    void r;
  }

  /* ── posições ── */
  toRender(p, out = new THREE.Vector3()) { const k = 1 / this.ctx.R; return out.set((p[0] - this.C[0]) * k, (p[1] - this.C[1]) * k, (p[2] - this.C[2]) * k); }
  setGroup(g, origin, unit) {
    const k = 1 / this.ctx.R;
    g.position.set((origin[0] - this.C[0]) * k, (origin[1] - this.C[1]) * k, (origin[2] - this.C[2]) * k);
    g.scale.setScalar(unit * k);
    g.updateMatrixWorld(true);
  }
  /** projeta um ponto do mundo (m) para píxeis; null se atrás da câmara */
  project(p) {
    const v = this.toRender(p, this._v);
    v.applyMatrix4(this.camera.matrixWorldInverse);
    if (v.z > -1e-9) return null;
    const dist = -v.z;
    v.applyMatrix4(this.camera.projectionMatrix);
    if (Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
    return { x: (v.x + 1) / 2 * this.ctx.w, y: (1 - v.y) / 2 * this.ctx.h, dist: dist * this.ctx.R };
  }
  /** distância (m) da câmara a um ponto */
  distTo(p) { return Math.hypot(p[0] - this.C[0], p[1] - this.C[1], p[2] - this.C[2]); }

  /* ── foco e voos ── */
  focus(obj, { s, fly = true, yaw, pitch } = {}) {
    const target = { obj, s: s ?? obj.view ?? this.s, yaw, pitch };
    if (!fly || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.focusObj = obj && obj.getPos ? obj : null; this._lastTarget = null;
      const p = obj.getPos(this.time.jd); this.F = [...p]; this.s = this.sT = target.s;
      if (yaw != null) this.yaw = this.yawT = yaw; if (pitch != null) this.pitch = this.pitchT = pitch;
      this.dirty = true; return;
    }
    this.flight = this._planFlight(target);
  }
  _planFlight(tg) {
    const p1 = tg.obj.getPos(this.time.jd);
    const c0 = [...this.F], w0 = this.R, w1 = Math.pow(10, tg.s);
    const du = [p1[0] - c0[0], p1[1] - c0[1], p1[2] - c0[2]];
    const u1 = Math.hypot(...du);
    let S, path;
    if (u1 < 1e-9 * Math.max(w0, w1)) {
      const k = Math.sign(w1 - w0) || 1;
      S = Math.abs(Math.log(w1 / w0)) / RHO;
      path = t => ({ u: 0, w: w0 * Math.exp(k * RHO * t * S) });
    } else {
      const r2 = RHO * RHO, r4 = r2 * r2;
      const b0 = (w1 * w1 - w0 * w0 + r4 * u1 * u1) / (2 * w0 * r2 * u1);
      const b1 = (w1 * w1 - w0 * w0 - r4 * u1 * u1) / (2 * w1 * r2 * u1);
      const r0 = -Math.asinh(b0), rr1 = -Math.asinh(b1);
      S = (rr1 - r0) / RHO;
      /* metade inicial avaliada a partir do início, a final a partir do fim (estabilidade numérica) */
      const fromStart = sd => ({ u: w0 / r2 * (Math.cosh(r0) * Math.tanh(RHO * sd + r0) - Math.sinh(r0)), w: w0 * Math.cosh(r0) / Math.cosh(RHO * sd + r0) });
      const rb0 = -Math.asinh((w0 * w0 - w1 * w1 + r4 * u1 * u1) / (2 * w1 * r2 * u1));
      const fromEnd = sd => ({ u: u1 - w1 / r2 * (Math.cosh(rb0) * Math.tanh(RHO * sd + rb0) - Math.sinh(rb0)), w: w1 * Math.cosh(rb0) / Math.cosh(RHO * sd + rb0) });
      path = t => (t < 0.5 ? fromStart(t * S) : fromEnd((1 - t) * S));
    }
    const dur = clamp(0.5 * S + 0.8, 1.1, 7.5);
    return { tg, c0, w0, u1, du, path, dur, t: 0, yaw0: this.yaw, pitch0: this.pitch };
  }
  cancelFlight() { if (this.flight) { this.sT = this.s; this.flight = null; } }

  /* ── ciclo ── */
  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, (now - this._t) / 1000); this._t = now;
    if (this.paused) return;
    if (this.time.speed) { this.time.jd += this.time.speed * dt; this.dirty = true; }
    const moved = this._updateNav(dt);
    if (!moved && !this.dirty) return;
    this.dirty = false;
    this._frame(dt);
  }

  _updateNav(dt) {
    let moved = false;
    const jd = this.time.jd;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
      const { u, w } = f.path(e);
      const p1 = f.tg.obj.getPos(jd);
      const k = f.u1 > 0 ? u / f.u1 : 1;
      /* o alvo pode mexer-se (planetas): interpola até à posição atual */
      this.F = [f.c0[0] + (p1[0] - f.c0[0]) * k, f.c0[1] + (p1[1] - f.c0[1]) * k, f.c0[2] + (p1[2] - f.c0[2]) * k];
      this.s = this.sT = Math.log10(w);
      if (f.tg.yaw != null) this.yaw = this.yawT = f.yaw0 + (f.tg.yaw - f.yaw0) * e;
      if (f.tg.pitch != null) this.pitch = this.pitchT = f.pitch0 + (f.tg.pitch - f.pitch0) * e;
      if (f.t >= 1) {
        this.flight = null;
        this.focusObj = f.tg.obj.getPos && !f.tg.obj.noFocus ? f.tg.obj : null;
        this._lastTarget = null;
        this.onArrive?.(f.tg.obj);
      }
      moved = true;
    } else {
      const sMin = this.focusObj?.r ? Math.max(S_MIN, Math.log10(this.focusObj.r * 1.7)) : S_MIN;
      this.sT = clamp(this.sT, sMin, S_MAX);
      if (Math.abs(this.sT - this.s) > 1e-5) { this.s += (this.sT - this.s) * (1 - Math.exp(-dt * 7)); moved = true; }
      else this.s = this.sT;
      /* largar o foco quando nos afastamos muito da escala do objeto */
      if (this.focusObj && this.s > (this.focusObj.sMax ?? (this.focusObj.view ?? 10) + 2.2)) { this.focusObj = null; this._lastTarget = null; this.onRelease?.(); }
      const target = this.focusObj ? this.focusObj.getPos(jd) : this.anchor(this.s, jd);
      if (this._lastTarget) { for (let i = 0; i < 3; i++) this.F[i] += target[i] - this._lastTarget[i]; }
      const dF = Math.hypot(target[0] - this.F[0], target[1] - this.F[1], target[2] - this.F[2]);
      if (dF > this.R * 1e-6) {
        const a = 1 - Math.exp(-dt * 3.2);
        for (let i = 0; i < 3; i++) this.F[i] += (target[i] - this.F[i]) * a;
        moved = true;
      } else this.F = [...target];
      this._lastTarget = [...target];
    }
    if (Math.abs(this.yawT - this.yaw) > 1e-5 || Math.abs(this.pitchT - this.pitch) > 1e-5) {
      const a = 1 - Math.exp(-dt * 10);
      this.yaw += (this.yawT - this.yaw) * a; this.pitch += (this.pitchT - this.pitch) * a; moved = true;
    }
    if (this._auto && !this.flight && !this._dragging) { this.yawT += dt * 0.03; moved = true; }
    return moved;
  }

  _frame(dt) {
    const R = Math.pow(10, this.s);
    /* referencial da órbita: eclíptico → galáctico */
    const t = smooth(14.0, 16.3, this.s);
    this.qFrame.slerpQuaternions(this.qEcl, this.qGal, t);
    const cp = Math.cos(this.pitch);
    const d = new THREE.Vector3(cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), Math.sin(this.pitch)).applyQuaternion(this.qFrame);
    const up = new THREE.Vector3(0, 0, 1).applyQuaternion(this.qFrame);
    this.C[0] = this.F[0] + d.x * R; this.C[1] = this.F[1] + d.y * R; this.C[2] = this.F[2] + d.z * R;
    this._m.lookAt(new THREE.Vector3(0, 0, 0), d.clone().negate(), up);
    this.camera.quaternion.setFromRotationMatrix(this._m);
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    const ctx = Object.assign(this.ctx, { R, s: this.s, k: 1 / R, jd: this.time.jd, dt, C: this.C, F: this.F, viewDir: d, up });
    for (const L of this.layers) {
      const op = L.enabled ? (L.range ? band(this.s, L.range[0], L.range[1], L.fade ?? 0.35) : 1) : 0;
      L.opacity = op;
      const vis = op > 0.003;
      if (L.group) L.group.visible = vis;
      if (vis || L.alwaysUpdate) L.update?.(ctx, op);
    }
    for (const L of this.layers) if (L.opacity > 0.003) L.prepare?.(this.renderer, ctx);
    this.renderer.setRenderTarget(this.hdr);
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
    this._post();
    this._labels(ctx);
    this.onFrame?.(ctx);
  }

  /* ── rótulos HTML com anti-sobreposição ── */
  _labels(ctx) {
    const items = [];
    for (const L of this.layers) if (L.opacity > 0.25 && L.labels && L.labelsOn !== false) L.labels(ctx, items, L.opacity);
    items.sort((a, b) => b.prio - a.prio);
    const placed = [...this.blocked], max = this.mobile ? 18 : 34;  /* blocked: zonas ocupadas pela interface */
    let n = 0;
    for (const it of items) {
      if (n >= max) break;
      const p = it.px || this.project(it.pos);
      if (!p) continue;
      if (p.x < 4 || p.y < 4 || p.x > ctx.w - 4 || p.y > ctx.h - 4) continue;
      const w = it.text.length * 6.6 + 16, h = 18;
      const box = { x0: p.x + 6, y0: p.y - h / 2, x1: p.x + 6 + w, y1: p.y + h / 2 };
      if (placed.some(b => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      placed.push(box);
      let el = this._labelPool[n];
      if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'uv-label'; this.labelsEl.appendChild(el); this._labelPool[n] = el; el.addEventListener('click', e => { e.stopPropagation(); const o = el._obj; if (o) this.onPick?.(o, { label: true }); }); }
      if (el.textContent !== it.text) el.textContent = it.text;
      el.className = 'uv-label ' + (it.cls || '');
      el._obj = it.obj || null;
      el.tabIndex = it.obj ? 0 : -1;
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      el.style.opacity = it.alpha ?? 1;
      el.hidden = false;
      n++;
    }
    for (let i = n; i < this._labelPool.length; i++) this._labelPool[i].hidden = true;
  }

  /* ── entrada ── */
  _bindInput() {
    const c = this.canvas;
    const ptrs = new Map();
    let down = null, pinch0 = 0;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
      this._dragging = true; this._auto = false;
    });
    c.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (down) down.moved += Math.abs(dx) + Math.abs(dy);
        if (down && down.moved < 4) return;
        this.cancelFlight();
        this.yawT -= dx * 0.0055; this.pitchT = clamp(this.pitchT + dy * 0.0055, -1.52, 1.52);
        this.dirty = true;
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0 && d > 0) { this.cancelFlight(); this.sT -= Math.log10(d / pinch0) * 1.6; pinch0 = d; if (down) down.moved = 99; }
      }
    });
    const up = e => {
      const wasOne = ptrs.size === 1;
      ptrs.delete(e.pointerId);
      if (!ptrs.size) this._dragging = false;
      if (wasOne && down && down.moved < 5 && performance.now() - down.t < 450 && e.type === 'pointerup') {
        const r = c.getBoundingClientRect();
        this._click(e.clientX - r.left, e.clientY - r.top, e.detail >= 2);
      }
      if (!ptrs.size) down = null;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.cancelFlight(); this._auto = false;
      const k = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0016;
      this.sT += clamp(e.deltaY * k, -0.6, 0.6);
      this.dirty = true;
    }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
    this._onKey = e => {
      if (!this.host.isConnected || this.paused || e.target.closest?.('input, textarea, select')) return;
      if (!this.host.closest('.uv')?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const k = e.key; let used = true;
      if (k === 'ArrowLeft') this.yawT += 0.12; else if (k === 'ArrowRight') this.yawT -= 0.12;
      else if (k === 'ArrowUp') this.pitchT = clamp(this.pitchT + 0.1, -1.52, 1.52); else if (k === 'ArrowDown') this.pitchT = clamp(this.pitchT - 0.1, -1.52, 1.52);
      else if (k === '+' || k === '=') { this.cancelFlight(); this.sT -= 0.25; } else if (k === '-' || k === '_') { this.cancelFlight(); this.sT += 0.25; }
      else used = false;
      if (used) { e.preventDefault(); this.dirty = true; }
    };
    window.addEventListener('keydown', this._onKey);
  }

  _click(x, y, dbl) {
    let best = null;
    for (const L of this.layers) {
      if (L.opacity < 0.2 || !L.pick) continue;
      const h = L.pick(this.ctx, x, y);
      if (h && (!best || h.d2 < best.d2)) best = h;
    }
    this.onPick?.(best ? best.obj : null, { dbl, x, y });
  }

  pickNear(list, x, y, maxPx = 14) {
    let best = null;
    for (const o of list) {
      const p = this.project(o.getPos(this.time.jd)); if (!p) continue;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 < maxPx * maxPx && (!best || d2 < best.d2)) best = { obj: o, d2 };
    }
    return best;
  }

  setPaused(p) { this.paused = p; if (!p) { this._t = performance.now(); this.dirty = true; } }
  dispose() {
    cancelAnimationFrame(this._raf); this._ro.disconnect(); window.removeEventListener('keydown', this._onKey);
    for (const L of this.layers) L.dispose?.();
    for (const t of [this.hdr, this.bA, this.bB, this.bC, this.bD]) t?.dispose();
    this.renderer.dispose();
  }
}
