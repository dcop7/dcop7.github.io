/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — motor: renderer, submersível/câmara, ciclo, entrada.

   Exposição: a cena é desenhada já multiplicada pela exposição (a luz
   solar, os faróis e a bioluminescência recebem o fator), para que o
   alvo HDR em meia precisão trabalhe com valores ~1 tanto aos 5 m como
   aos 5 000 m. A exposição imita um olho/câmara que se adapta até um
   limite: abaixo de ~400 m a luz solar deixa de ser visível.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, KD, clamp, lerp, smooth, extinction, isMobile } from './o-core.mjs';
import { WU, makeBackdrop, makeSnow, makePost } from './o-water.mjs';

const EXPO_FLOOR = 0.0015, EXPO_K = 2.2;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Engine {
  constructor(host, { onFrame, onPick, onHover } = {}) {
    this.host = host; this.onFrame = onFrame; this.onPick = onPick; this.onHover = onHover;
    this.mobile = isMobile();
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.setClearColor(0, 1);
    r.domElement.className = 'oc-canvas';
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2000);
    this.scene.add(this.camera);
    this.backdrop = makeBackdrop(); this.scene.add(this.backdrop);
    this.snow = [
      makeSnow({ count: this.mobile ? 2600 : 7000, box: 26, size: 0.009, sink: 0.012, spark: 0.012, seed: 3 }),
      makeSnow({ count: this.mobile ? 500 : 1300, box: 60, size: 0.035, sink: 0.02, spark: 0.0, seed: 7 }),
    ];
    for (const s of this.snow) this.scene.add(s);

    /* submersível: posição, orientação, alvo */
    this.sub = { p: new THREE.Vector3(0, -4, 0), yaw: 0, pitch: 0.55, yawT: 0, pitchT: 0.55, v: new THREE.Vector3() };
    this.target = new THREE.Vector3(0, -4, 0);
    this.flight = null;
    this.floorAt = null;           /* (x, z) → cota do fundo, fornecida pelo fundo do mar */
    this.view = 'cockpit';          /* ou 'ext' */
    this.ext = { dist: 9, yaw: 2.4, pitch: 0.18 };
    this.lights = true; this.lightsK = 1; this._darkK = 0;
    this.sunK = 1;                  /* 1 = dia, ~0 = noite */
    this.paused = false;
    this.look = null;               /* ponto a olhar (seleção) */
    this.time = 0; this.dt = 0.016; this.relief = null; this.WU = WU;
    this.subModel = null;

    this._initPost();
    this._bindInput();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(host);
    this.resize();
    this._loop = this._loop.bind(this);
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  get depth() { return -this.sub.p.y; }

  _initPost() {
    const mob = this.mobile;
    this.depthTex = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mob ? 0 : 4, depthTexture: this.depthTex });
    const mk = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.rtV = mk(); this.bA = mk(); this.bB = mk(); this.bC = mk(); this.bD = mk();
    this.post = makePost(mob);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
    this._pScene = new THREE.Scene(); this._pScene.add(quad); this._pQuad = quad;
    this._pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const dpr = this.renderer.getPixelRatio(), W = Math.round(w * dpr), H = Math.round(h * dpr);
    this.hdr.setSize(W, H); this.rtV.setSize(W, H);
    this.bA.setSize(W >> 1, H >> 1); this.bB.setSize(W >> 1, H >> 1);
    this.bC.setSize(W >> 2, H >> 2); this.bD.setSize(W >> 2, H >> 2);
    this.w = w; this.h = h;
  }
  _pass(m, t) { this._pQuad.material = m; this.renderer.setRenderTarget(t); this.renderer.render(this._pScene, this._pCam); }

  /* ── navegação ── */
  goDepth(d, { instant = false } = {}) {
    const floor = this.floorAt ? -this.floorAt(this.target.x, this.target.z) : 11000;
    d = clamp(d, 1.5, floor - 2.2);
    const from = this.sub.p.y, to = -d;
    if (instant) { this.sub.p.y = to; this.target.y = to; this.flight = null; return; }
    const D = Math.abs(to - from);
    if (D > 60) this.flight = { from: this.sub.p.clone(), to: new THREE.Vector3(this.target.x, to, this.target.z), t: 0, dur: clamp(1.6 + Math.log10(D) * 1.7, 2, 8.5) };
    this.target.y = to;
  }
  goTo(x, z, d) { this.target.set(x, -d, z); const D = this.sub.p.distanceTo(this.target); this.flight = D > 3 ? { from: this.sub.p.clone(), to: this.target.clone(), t: 0, dur: clamp(1.6 + Math.log10(D + 1) * 1.7, 2, 9) } : null; }
  nudgeDepth(dd) { this.flight = null; const floor = this.floorAt ? -this.floorAt(this.target.x, this.target.z) : 11000; this.target.y = -clamp(-this.target.y + dd, 1.5, floor - 2.2); }

  _bindInput() {
    const el = this.renderer.domElement;
    let drag = null, moved = 0;
    el.addEventListener('pointerdown', e => { if (this.relief) return; drag = { x: e.clientX, y: e.clientY }; moved = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (this.relief) return;
      if (!drag) { this.onHover?.(this._ndc(e)); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (this.view === 'ext') { this.ext.yaw -= dx * 0.006; this.ext.pitch = clamp(this.ext.pitch + dy * 0.004, -1.2, 1.2); }
      else { this.sub.yawT -= dx * 0.0042; this.sub.pitchT = clamp(this.sub.pitchT + dy * 0.0035, -1.35, 1.45); this.look = null; }
    });
    el.addEventListener('pointerup', e => { if (drag && moved < 6) this.onPick?.(this._ndc(e)); drag = null; });
    el.addEventListener('pointercancel', () => { drag = null; });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.relief) return;
      if (this.view === 'ext' && e.ctrlKey) { this.ext.dist = clamp(this.ext.dist * Math.exp(e.deltaY * 0.001), 4, 40); return; }
      const d = this.depth, step = Math.max(2, d * 0.06);
      this.nudgeDepth(Math.sign(e.deltaY) * step * Math.min(3, Math.abs(e.deltaY) / 100));
    }, { passive: false });
    this._keys = new Set();
    this._kd = e => { if (e.target.closest?.('input,textarea,select')) return; if (!this.host.isConnected || this.host.offsetParent === null) return; this._keys.add(e.key.toLowerCase()); if (['arrowup', 'arrowdown', 'pageup', 'pagedown', ' '].includes(e.key.toLowerCase())) e.preventDefault(); };
    this._ku = e => this._keys.delete(e.key.toLowerCase());
    addEventListener('keydown', this._kd); addEventListener('keyup', this._ku);
    addEventListener('blur', () => this._keys.clear());
  }
  _ndc(e) { const r = this.renderer.domElement.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, cx: e.clientX - r.left, cy: e.clientY - r.top }; }

  _input(dt) {
    const K = this._keys; if (!K.size) return;
    const d = this.depth, vs = Math.max(3, d * 0.25) * dt;
    if (K.has('arrowdown') || K.has('pagedown') || K.has('s')) this.nudgeDepth(vs);
    if (K.has('arrowup') || K.has('pageup') || K.has('w')) this.nudgeDepth(-vs);
    const near = this.floorAt ? (-this.floorAt(this.sub.p.x, this.sub.p.z) - d) < 120 : false;
    const hs = (near ? 1.6 : 4) * dt * (K.has('shift') ? 4 : 1);
    const f = new THREE.Vector3(-Math.sin(this.sub.yaw), 0, -Math.cos(this.sub.yaw)), rt = new THREE.Vector3(-f.z, 0, f.x);
    if (K.has('a') || K.has('arrowleft')) { if (K.has('arrowleft')) this.sub.yawT += 1.2 * dt; else this.target.addScaledVector(rt, -hs); }
    if (K.has('d') || K.has('arrowright')) { if (K.has('arrowright')) this.sub.yawT -= 1.2 * dt; else this.target.addScaledVector(rt, hs); }
    if (K.has('q')) this.target.addScaledVector(f, hs);
    if (K.has('e')) this.target.addScaledVector(f, -hs);
    this.bounds && this.bounds(this.target);
  }

  setPaused(p) { this.paused = p; if (!p) { this._last = performance.now(); cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(this._loop); } }
  dispose() {
    cancelAnimationFrame(this._raf); this._ro.disconnect();
    removeEventListener('keydown', this._kd); removeEventListener('keyup', this._ku);
    this.renderer.dispose(); this.renderer.forceContextLoss?.();
  }

  _loop(now) {
    if (this.paused) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    this.dt = dt; this.time += dt;
    this.update(dt);
    this.render();
  }

  update(dt) {
    const S = this.sub;
    this._input(dt);
    const prev = S.p.clone();
    if (this.flight) {
      const F = this.flight; F.t += dt / F.dur;
      const k = ease(Math.min(1, F.t));
      S.p.lerpVectors(F.from, F.to, k);
      if (F.t >= 1) { this.flight = null; this.target.copy(F.to); }
    } else {
      const k = 1 - Math.exp(-dt * 2.2);
      S.p.lerp(this.target, k);
    }
    if (this.floorAt) {
      const fl = this.floorAt(S.p.x, S.p.z) + 1.6;
      if (S.p.y < fl) { S.p.y = fl; if (this.target.y < fl) this.target.y = fl; }
    }
    S.v.subVectors(S.p, prev).divideScalar(Math.max(dt, 1e-4));
    /* olhar: alvo selecionado tem prioridade */
    if (this.look) {
      const dx = this.look.x - S.p.x, dy = this.look.y - S.p.y, dz = this.look.z - S.p.z;
      S.yawT = Math.atan2(-dx, -dz); S.pitchT = clamp(Math.atan2(dy, Math.hypot(dx, dz)) * -1, -1.35, 1.45);
    }
    let dy = S.yawT - S.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const kr = 1 - Math.exp(-dt * 5);
    S.yaw += dy * kr; S.pitch += (S.pitchT - S.pitch) * kr;
    /* câmara */
    const cam = this.camera;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-S.pitch, S.yaw, 0, 'YXZ'));
    if (this.view === 'ext') {
      const E = this.ext;
      const o = new THREE.Vector3(Math.sin(E.yaw) * Math.cos(E.pitch), Math.sin(E.pitch), Math.cos(E.yaw) * Math.cos(E.pitch)).multiplyScalar(E.dist);
      cam.position.copy(S.p).add(o);
      if (this.floorAt) cam.position.y = Math.max(cam.position.y, this.floorAt(cam.position.x, cam.position.z) + 1);
      cam.position.y = Math.min(cam.position.y, -0.6);
      cam.lookAt(S.p);
    } else {
      cam.position.copy(S.p);
      cam.quaternion.copy(q);
    }
    cam.updateMatrixWorld();
    if (this.subModel) { this.subModel.position.copy(S.p); this.subModel.quaternion.copy(q); this.subModel.visible = this.view === 'ext'; }
    this.subQ = q;
    this.focusDist = this._focus();
    this.onFrame?.(dt);
  }
  /* distância ao fundo segundo a direção de vista (marcha simples) */
  _focus() {
    if (!this.floorAt) return 12;
    const c = this.camera.position, f = this._fv || (this._fv = new THREE.Vector3()); this.camera.getWorldDirection(f);
    let best = this.lookDist ?? 1e9;
    for (let t = 0.5; t < 30; t *= 1.25) { const x = c.x + f.x * t, y = c.y + f.y * t, z = c.z + f.z * t; if (y < this.floorAt(x, z)) { best = Math.min(best, t); break; } }
    return best > 1e8 ? 12 : best;
  }

  render() {
    if (this.relief) { this.relief.render(); return; }
    const r = this.renderer, cam = this.camera, d = Math.max(0, -cam.position.y);
    r.setClearColor(0, 1);
    /* ótica à profundidade da câmara */
    const ext = extinction(d); WU.uExt.value.set(ext[0], ext[1], ext[2]);
    const sunRaw = 3 * this.sunK;
    const amb = sunRaw * Math.exp(-KD[2] * d) * 0.25;
    const expo = EXPO_K / (amb + EXPO_FLOOR);
    this.expo = expo;
    WU.uSun.value.setScalar(sunRaw * expo);
    WU.uGlowK.value = expo * EXPO_FLOOR / EXPO_K;   /* 1 no escuro total */
    this.lightsK += ((this.lights ? 1 : 0) - this.lightsK) * Math.min(1, this.dt * 6);
    WU.uHLon.value = this.lightsK;
    /* faróis desligados no escuro: o olho adapta-se e a luz dos animais sobressai */
    this._darkK = (1 - this.lightsK) * EXPO_FLOOR / (amb * 4 + EXPO_FLOOR);
    WU.uGlowK.value *= 1 + 3 * this._darkK;
    /* exposição automática dos faróis: ajusta-se à distância do que está à frente (fundo ou animal) */
    const fd = clamp(this.focusDist ?? 12, 1, 22), gT = clamp((fd * fd + 4) / 30, 0.2, 14);
    this.hlGain = this.hlGain ? lerp(this.hlGain, gT, Math.min(1, this.dt * 2.5)) : gT;
    WU.uHLpow.value = 0.075 * 0.55 / EXPO_K * expo * this.hlGain;
    WU.uCaus.value = smooth(60, 0, d);
    WU.uTime.value = this.time;
    /* faróis presos ao submersível, em coordenadas de vista */
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const S = this.sub, q = this.subQ || cam.quaternion;
    const l0 = new THREE.Vector3(0.45, -0.3, -0.3).applyQuaternion(q).add(S.p).applyMatrix4(cam.matrixWorldInverse);
    const l1 = new THREE.Vector3(-0.45, -0.3, -0.3).applyQuaternion(q).add(S.p).applyMatrix4(cam.matrixWorldInverse);
    const ld = new THREE.Vector3(0, -0.12, -1).normalize().applyQuaternion(q).transformDirection(cam.matrixWorldInverse);
    /* vista exterior: um dos focos passa a ser a luz da câmara que filma o submersível */
    WU.uHLdir1.value.copy(ld);
    if (this.view === 'ext') { l0.add(l1).multiplyScalar(0.5); l1.set(0.3, 0.4, 0); WU.uHLdir1.value.set(0, 0, -1); }
    WU.uHLv0.value.copy(l0); WU.uHLv1.value.copy(l1); WU.uHLdirV.value.copy(ld);
    this.backdrop.position.copy(cam.position);
    const sp = Math.min(1, this.sub.v.length() / 3);
    WU.uSpark.value = lerp(WU.uSpark.value, sp, Math.min(1, this.dt * 3));
    for (const s of this.snow) { s.material.uniforms.uVel.value.copy(this.sub.v); s.material.uniforms.uAmb.value = 1; }
    this.snow[0].material.uniforms.uSparkF.value = lerp(0.006, 0.05, smooth(150, 900, d));
    /* cena → HDR → volume → bloom → ecrã */
    r.setRenderTarget(this.hdr); r.clear(); r.render(this.scene, cam);
    const P = this.post, V = P.vol.uniforms;
    V.tColor.value = this.hdr.texture; V.tDepth.value = this.depthTex;
    V.uInvProj.value.copy(cam.projectionMatrixInverse); V.uCamW.value.copy(cam.matrixWorld);
    V.uNear.value = cam.near; V.uFar.value = cam.far; V.uBeam.value = 1 / Math.sqrt(this.hlGain || 1); V.uShaft.value = this.sunK * smooth(260, 10, d);
    this._pass(P.vol, this.rtV);
    const b = P.bright, bl = P.blur;
    b.uniforms.t.value = this.rtV.texture; b.uniforms.texel.value.set(1 / this.rtV.width, 1 / this.rtV.height); b.uniforms.thr.value = lerp(0.9, 0.25, this._darkK); this._pass(b, this.bA);
    bl.uniforms.t.value = this.bA.texture; bl.uniforms.dir.value.set(1 / this.bA.width, 0); this._pass(bl, this.bB);
    bl.uniforms.t.value = this.bB.texture; bl.uniforms.dir.value.set(0, 1 / this.bA.height); this._pass(bl, this.bA);
    bl.uniforms.t.value = this.bA.texture; bl.uniforms.dir.value.set(1 / this.bC.width, 0); this._pass(bl, this.bC);
    bl.uniforms.t.value = this.bC.texture; bl.uniforms.dir.value.set(0, 1 / this.bC.height); this._pass(bl, this.bD);
    const f = P.final.uniforms; f.t.value = this.rtV.texture; f.b1.value = this.bA.texture; f.b2.value = this.bD.texture;
    f.grain.value = lerp(0.004, 0.018, smooth(150, 800, d)); f.exposure.value = 1; f.bloom.value = lerp(0.6, 1.6, this._darkK);
    /* adaptação cromática parcial (como o olho): só sobre a luz solar, não sobre os faróis */
    const ks = amb / (amb + EXPO_FLOOR), e0 = Math.exp(-KD[0] * d), e1 = Math.exp(-KD[1] * d), e2 = Math.exp(-KD[2] * d), em = Math.max(e0, e1, e2);
    const wb = x => lerp(1, Math.min(4, Math.pow(Math.max(x / em, 1e-6), -0.38)), ks);
    /* no escuro: equilíbrio de brancos para os faróis à distância de foco, como numa câmara de ROV */
    const fd2 = clamp(this.focusDist ?? 5, 1, 5) * 1.4, hw = k => Math.min(4, Math.exp(ext[k] * fd2 * 0.5) / Math.exp(ext[2] * fd2 * 0.5));
    const w0 = wb(e0) * lerp(hw(0), 1, ks), w1 = wb(e1) * lerp(hw(1), 1, ks), w2 = wb(e2), wn = (w0 * 0.2 + w1 * 0.7 + w2 * 0.1);
    f.wb.value.set(w0 / wn, w1 / wn, w2 / wn);
    this._pass(P.final, null);
  }

  /** projeta um ponto do mundo para píxeis do ecrã (ou null se atrás) */
  project(p) { const v = this._pv || (this._pv = new THREE.Vector3()); v.copy(p).project(this.camera); if (v.z > 1) return null; return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h, z: v.z }; }
}
