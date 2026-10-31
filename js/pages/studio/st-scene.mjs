/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — motor: cena, sujeito, câmara fotográfica, render.

   Dois pontos de vista partilham o mesmo canvas:
     · vista de estúdio (câmara livre, OrbitControls, exposição automática
       para se ver o espaço);
     · fotografia (a câmara no tripé, com focal/abertura/ISO/obturador,
       revelada por st-post.mjs).
   Só se renderiza quando algo muda (render a pedido) — parado, o estúdio
   não gasta GPU nem bateria.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, GLTFLoader, OrbitControls, TransformControls, RoomEnvironment, studioMaterial, canvasTex, noiseField, DEG, clamp, kelvinRGB } from './st-core.mjs';
import { buildCamera, buildBackdrop, buildRoom, PAPERS, initMaterials, MAT } from './st-gear.mjs';
import { StudioLight, updateBounce, dirFrom } from './st-lights.mjs';
import { createPost, cocFactor } from './st-post.mjs';

const BASE = '/assets/models/studio/';
export const SYNC = 1 / 200;                  // velocidade de sincronização típica
const ROOM_LUX = 45;                          // luz ambiente da sala (lâmpadas de serviço)

export class Studio {
  constructor(canvas, { mobile = false } = {}) {
    this.canvas = canvas;
    this.mobile = mobile;
    this.quality = { shadow: mobile ? 1024 : 2048, dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2) };
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(this.quality.dpr);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.autoClear = false;
    initMaterials();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
    pm.dispose();
    this.hemi = new THREE.HemisphereLight(0xdfe6ef, 0x3a3631, 0);
    this.scene.add(this.hemi);

    this.room = buildRoom(); this.scene.add(this.room);
    this.backdrop = buildBackdrop(); this.scene.add(this.backdrop);
    this.cameraRig = buildCamera(); this.scene.add(this.cameraRig);
    this.cameraRig.traverse(o => { if (o.isMesh) o.layers.set(31); o.userData.isCamera = true; });

    this.subject = new THREE.Group(); this.subject.name = 'subject';
    this.scene.add(this.subject);
    this.ref = { eyeL: [0.029, 1.51, 0.026], eyeR: [-0.029, 1.51, 0.026] };

    /* câmaras */
    this.edCam = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    this.edCam.position.set(-3.7, 2.6, 4.5);
    this.edCam.layers.enableAll();
    this.photoCam = new THREE.PerspectiveCamera(24, 2 / 3, 0.1, 40);
    this.photoCam.layers.enableAll();
    this.photoCam.layers.disable(31);                         // a câmara não se vê a si própria
    this.controls = new OrbitControls(this.edCam, canvas);
    this.controls.target.set(-0.15, 1.15, -0.35);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 0.6; this.controls.maxDistance = 9;
    this.controls.addEventListener('change', () => this.invalidate('view'));

    this.gizmo = new TransformControls(this.edCam, canvas);
    this.gizmo.setSize(mobile ? 1.1 : 0.8);
    this.gizmo.addEventListener('dragging-changed', e => { this.controls.enabled = !e.value; });
    this.gizmo.addEventListener('objectChange', () => this.onGizmo());
    this.scene.add(this.gizmo);       /* fica na camada 0: o raycaster interno do gizmo só vê essa */
    this.edCam.layers.enable(30);

    /* moldura da câmara (o que entra na fotografia) */
    this.frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.55 }));
    this.frustum.layers.set(30); this.frustum.frustumCulled = false;
    this.scene.add(this.frustum);

    this.lights = [];
    this.cam = { focal: 85, fnum: 8, iso: 100, shutter: 1 / 125, wb: 5600, dist: 2.2, height: 1.48, az: 0, orient: 'portrait', aimDrop: 0.07, dof: true, zebra: false };
    this.subj = { yaw: 0 };
    this.paper = 'grey'; this.bdDist = 2.6;

    this.post = createPost();
    this.view = { main: 'editor', inset: true, split: -1, frame: null };
    this._dirty = true; this._shadowsDirty = true;
    this.listeners = new Set();
    this._raf = 0;
    this.stats = { frames: 0, ms: 0 };
  }

  /* ── carregamento do sujeito ──────────────────────────────────────── */
  async load(onProgress) {
    const tl = new THREE.TextureLoader();
    const tex = (n, srgb = true) => new Promise(res => tl.load(BASE + 'tex/' + n + '.webp', t => {
      t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; onProgress?.(); res(t);
    }, undefined, () => res(null)));
    const [gltf, skin, eye, hair, brows, lashes, clothes, clothesN, clothesAO, shoes] = await Promise.all([
      new GLTFLoader().loadAsync(BASE + 'subject.glb'),
      tex('skin'), tex('eye'), tex('hair'), tex('brows'), tex('lashes'), tex('clothes'), tex('clothes-n', false), tex('clothes-ao', false), tex('shoes'),
    ]);
    const ex = gltf.scene.userData || {};
    if (ex.ref) this.ref = ex.ref;
    /* poros: mapa de normais procedural muito fino, repetido */
    const pores = canvasTex(256, 256, (c, w, h) => {
      const n = noiseField(w, h, 2, 77), m = noiseField(w, h, 6, 78);
      const im = c.createImageData(w, h);
      const H = (x, y) => n[((y + h) % h) * w + ((x + w) % w)] * 0.7 + m[((y + h) % h) * w + ((x + w) % w)] * 0.3;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
        const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1, l = Math.hypot(nx, ny, nz);
        im.data.set([(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, 255], (y * w + x) * 4);
      }
      c.putImageData(im, 0, 0);
    }, { srgb: false, repeat: [24, 24] });
    const M = {
      body: studioMaterial(new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.5, normalMap: pores, normalScale: new THREE.Vector2(0.06, 0.06), sheen: 0.25, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.55, 0.38, 0.33), envMapIntensity: 0 }), { skin: true }),
      eyes: studioMaterial(new THREE.MeshStandardMaterial({ map: eye, roughness: 0.35, envMapIntensity: 0 })),
      cornea: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.035, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0 }),
      hair: studioMaterial(new THREE.MeshStandardMaterial({ map: hair, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.42, envMapIntensity: 0 })),
      brows: studioMaterial(new THREE.MeshStandardMaterial({ map: brows, transparent: true, depthWrite: false, roughness: 0.7, envMapIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 })),
      lashes: studioMaterial(new THREE.MeshStandardMaterial({ map: lashes, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0 })),
      clothes: studioMaterial(new THREE.MeshStandardMaterial({ map: clothes, normalMap: clothesN, aoMap: clothesAO, aoMapIntensity: 0.8, roughness: 0.88, envMapIntensity: 0 })),
      shoes: studioMaterial(new THREE.MeshStandardMaterial({ map: shoes, roughness: 0.55, envMapIntensity: 0 })),
    };
    /* a córnea só soma especular: shading normal mas sem sombra própria */
    studioMaterial(M.cornea);
    this.subjectMats = M;
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      o.material = M[o.name] || M.body;
      o.castShadow = !['cornea', 'brows', 'lashes'].includes(o.name);
      o.receiveShadow = true;
      o.userData.subject = true;
      if (o.name === 'brows' || o.name === 'lashes') o.renderOrder = 2;
      if (o.name === 'cornea') o.renderOrder = 3;
    });
    this.subject.add(gltf.scene);
    this.invalidate('subject');
  }

  /* ── geometria de referência ──────────────────────────────────────── */
  /** ponto entre os olhos (alvo das luzes e do foco) em coordenadas do mundo */
  facePoint(out = new THREE.Vector3()) {
    const [l, r] = [this.ref.eyeL, this.ref.eyeR];
    out.set((l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2 - 0.02);
    return out.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.subj.yaw * DEG);
  }
  eyeWorld(which, out = new THREE.Vector3()) {
    const e = this.ref[which === 'R' ? 'eyeR' : 'eyeL'];
    return out.set(e[0], e[1], e[2] + 0.012).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.subj.yaw * DEG);
  }
  backdropPoint(out = new THREE.Vector3()) { return out.set(0, 1.25, -this.bdDist + 0.05); }

  /* ── luzes ─────────────────────────────────────────────────────────── */
  addLight(state) {
    const l = new StudioLight(this, state);
    this.lights.push(l);
    this.scene.add(l.group);
    this.invalidate('lights');
    return l;
  }
  removeLight(l) {
    if (this.gizmo.object === l.handle) this.gizmo.detach();
    l.dispose();
    this.lights = this.lights.filter(x => x !== l);
    this.invalidate('lights');
  }
  clearLights() { [...this.lights].forEach(l => this.removeLight(l)); }

  /** Gizmo moveu a luz → converte para az/el/dist relativos ao sujeito */
  onGizmo() {
    const l = this.gizmo.object?.userData.light;
    if (!l) return;
    const face = this.facePoint();
    const v = new THREE.Vector3().subVectors(l.handle.position, face);
    const d = clamp(v.length(), 0.45, 6);
    v.normalize();
    l.s.dist = +d.toFixed(2);
    l.s.el = +(Math.asin(clamp(v.y, -1, 1)) / DEG).toFixed(1);
    l.s.az = +(Math.atan2(v.x, v.z) / DEG).toFixed(1);
    this.invalidate('lights', { from: 'gizmo', light: l });
  }

  /* ── estado ────────────────────────────────────────────────────────── */
  invalidate(what = 'view', detail) {
    this._dirty = true;
    if (what !== 'view') this._shadowsDirty = true;
    if (what !== 'view') for (const fn of this.listeners) fn(what, detail);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /* ── exposição ─────────────────────────────────────────────────────── */
  /** iluminância incidente no rosto (domo virado à câmara), por luz */
  meter() {
    const face = this.facePoint();
    const camPos = this.cameraRig.position;
    const dome = new THREE.Vector3().subVectors(camPos, face).normalize();
    const per = this.lights.map(l => ({ light: l, H: l.illuminanceAt(face, dome) }));
    const H = per.reduce((a, x) => a + x.H, 0);
    const c = this.cam;
    const ambH = ROOM_LUX * c.shutter;
    const need = 250 * c.fnum * c.fnum / c.iso;           // lux·s para exposição "correta"
    const total = H * this.syncFraction() + ambH;
    return {
      per, H, ambH,
      ev: total > 0 ? Math.log2(total / need) : -Infinity,
      fnum: Math.sqrt(Math.max(1e-6, total) * c.iso / 250),
    };
  }
  /** fração do fotograma que recebe o flash (cortina) */
  syncFraction() { return this.cam.shutter > SYNC * 1.0001 ? 1 : this.cam.shutter / SYNC; }

  /** energia que ressalta pela sala (enche um pouco as sombras) */
  bounceLevel() {
    const pap = { white: 0.05, sand: 0.035, grey: 0.022, teal: 0.016, wine: 0.014, charcoal: 0.01, black: 0.007 }[this.paper] ?? 0.02;
    let tot = 0;
    for (const l of this.lights) if (l.live && !l.passive) tot += l.output;
    return tot * pap / 4;      // "lux·s" médios devolvidos pela sala (ordem de grandeza)
  }

  /* ── atualização ───────────────────────────────────────────────────── */
  updateScene() {
    const c = this.cam;
    /* sujeito */
    this.subject.rotation.y = this.subj.yaw * DEG;
    /* fundo */
    this.backdrop.position.z = -this.bdDist;
    this.backdrop.userData.setColor(PAPERS[this.paper]?.hex || '#777');
    /* luzes: primeiro as ativas, depois os rebatedores (dependem delas) */
    for (const l of this.lights) l.update();
    for (const l of this.lights) if (l.passive) updateBounce(l, this.lights);
    /* câmara fotográfica */
    const face = this.facePoint();
    const dir = dirFrom(c.az, 0);
    const pos = face.clone().addScaledVector(dir, c.dist); pos.y = c.height;
    const aim = face.clone(); aim.y -= c.aimDrop;
    this.photoCam.position.copy(pos);
    this.photoCam.lookAt(aim);
    const sensorH = c.orient === 'portrait' ? 36 : 24;
    this.photoCam.fov = 2 * Math.atan(sensorH / 2 / c.focal) / DEG;
    this.photoCam.aspect = c.orient === 'portrait' ? 2 / 3 : 3 / 2;
    this.photoCam.near = 0.08; this.photoCam.far = 30;
    this.photoCam.updateProjectionMatrix();
    this.photoCam.updateMatrixWorld();
    this.cameraRig.position.copy(pos);
    this.cameraRig.rotation.set(0, Math.atan2(aim.x - pos.x, aim.z - pos.z), 0);
    const pitch = Math.atan2(aim.y - pos.y, Math.hypot(aim.x - pos.x, aim.z - pos.z));
    this.cameraRig.userData.setPose(pos.y, pitch);
    this.cameraRig.userData.cam.userData.setFocal(c.focal);
    if (c.orient === 'landscape') this.cameraRig.userData.cam.rotation.z = 0; else this.cameraRig.userData.cam.rotation.z = Math.PI / 2;
    this.updateFrustum();
  }

  updateFrustum() {
    const cam = this.photoCam, d = Math.min(this.cam.dist + 0.6, 4.5);
    const h = Math.tan(cam.fov * DEG / 2) * d, w = h * cam.aspect;
    const P = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => new THREE.Vector3(x, y, -d).applyMatrix4(cam.matrixWorld));
    const O = cam.position;
    const pts = [];
    for (let i = 0; i < 4; i++) pts.push(O, P[i], P[i], P[(i + 1) % 4]);
    this.frustum.geometry.setFromPoints(pts);
  }

  /** prepara intensidades para um ponto de vista ('editor' | 'photo') */
  applyExposure(kind, meter) {
    const c = this.cam;
    for (const l of this.lights) l.applyIntensity();
    /* balanço de brancos: divide pela cor da temperatura escolhida */
    const wb = kelvinRGB(c.wb);
    const wbFix = [1 / wb[0], 1 / wb[1], 1 / wb[2]];
    for (const l of this.lights) {
      l.spot.color.multiply(new THREE.Color(wbFix[0], wbFix[1], wbFix[2]));
      l.rect.color.multiply(new THREE.Color(wbFix[0], wbFix[1], wbFix[2]));
    }
    const bounce = this.bounceLevel();
    let amb;
    if (kind === 'photo') {
      const syncF = this.syncFraction();
      amb = bounce * syncF + ROOM_LUX * c.shutter;
    } else {
      /* vista de estúdio: luz de serviço ~3,5 stops abaixo do rosto */
      amb = bounce + Math.max(meter.H, 50) * 0.2;
    }
    const roomK = kelvinRGB(4300);
    this.hemi.color.setRGB(roomK[0] * wbFix[0], roomK[1] * wbFix[1], roomK[2] * wbFix[2]);
    this.hemi.groundColor.setRGB(0.3 * wbFix[0], 0.28 * wbFix[1], 0.26 * wbFix[2]);
    this.hemi.intensity = amb;
    /* reflexos de ambiente no equipamento: acompanham o nível ambiente */
    const envI = amb / Math.PI * 0.6;
    for (const k of ['powder', 'alu', 'chrome', 'plastic', 'plasticLite', 'silver', 'gold', 'glass', 'rubber']) MAT[k].envMapIntensity = envI;
    this.room.traverse(o => { if (o.isMesh) o.material.envMapIntensity = envI * 0.5; });
    return amb;
  }

  /* ── render ────────────────────────────────────────────────────────── */
  setSize(w, h) {
    this.W = w; this.H = h;
    this.renderer.setSize(w, h, false);
    this.edCam.aspect = w / h; this.edCam.updateProjectionMatrix();
    this._dirty = true;
  }

  /** retângulo (px CSS, origem em baixo-esquerda) da fotografia dentro de uma área */
  fitPhoto(x, y, w, h, pad = 0) {
    const a = this.photoCam.aspect;
    let pw = w - pad * 2, ph = pw / a;
    if (ph > h - pad * 2) { ph = h - pad * 2; pw = ph * a; }
    return { x: x + (w - pw) / 2, y: y + (h - ph) / 2, w: pw, h: ph };
  }

  ensureTargets(w, h) {
    const dpr = this.renderer.getPixelRatio();
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    if (this.hdr && this.hdr.width === W && this.hdr.height === H) return;
    this.hdr?.dispose(); this.out?.dispose();
    const depth = new THREE.DepthTexture(W, H); depth.type = THREE.UnsignedIntType;
    this.hdr = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: depth, samples: this.mobile ? 0 : 4 });
    this.out = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType });
  }

  copySnap(from) {
    const p = this.post.present;
    p.uniforms.tA.value = (from || this.out).texture; p.uniforms.split.value = -1; p.uniforms.zebra.value = 0;
    this.post.run(this.renderer, p, this.snap);
    this.renderer.setRenderTarget(null);
  }
  /** Guarda a fotografia atual como referência A — revelada à resolução
   *  máxima que o palco permite, para não ficar pixelizada quando a vista
   *  cresce (pré-visualização em ecrã inteiro). */
  takeSnapshot() {
    this.updateScene();
    const meter = this.meter();
    const big = this.fitPhoto(0, 0, Math.max(this.W, 900 * this.photoCam.aspect), Math.max(this.H, 900));
    if (this._shadowsDirty) { this.renderer.shadowMap.needsUpdate = true; this._shadowsDirty = false; }
    this.renderPhoto(big, meter);
    this.snap?.dispose();
    this.snap = new THREE.WebGLRenderTarget(this.out.width, this.out.height);
    this.copySnap();
    this.hasSnap = true;
    this._dirty = true;
  }

  /** desenha a fotografia no alvo `out` (sem apresentar) */
  renderPhoto(rect, meter) {
    const r = this.renderer, c = this.cam;
    this.ensureTargets(rect.w, rect.h);
    this.applyExposure('photo', meter);
    this.gizmo.visible = false; this.frustum.visible = false;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.hdr);
    r.setClearColor(0x000000, 1); r.clear();
    r.render(this.scene, this.photoCam);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    /* revelação */
    const d = this.post.develop.uniforms;
    d.tColor.value = this.hdr.texture; d.tDepth.value = this.hdr.depthTexture;
    d.near.value = this.photoCam.near; d.far.value = this.photoCam.far;
    d.res.value.set(this.hdr.width, this.hdr.height);
    const focus = this.photoCam.position.distanceTo(this.eyeWorld(this.cam.az > 0 ? 'R' : 'L'));
    d.focusD.value = focus;
    d.cocK.value = cocFactor({ focal: c.focal, fnum: c.fnum, focus, sensorH: c.orient === 'portrait' ? 36 : 24, imageH: this.hdr.height }) * focus;
    d.maxCoc.value = Math.min(28, this.hdr.height * 0.035);
    d.dofOn.value = c.dof ? 1 : 0;
    d.exposure.value = Math.PI * c.iso / (250 * c.fnum * c.fnum);
    d.band.value = this.syncFraction();
    d.noise.value = c.iso <= 100 ? 0.0 : 0.05 * Math.log2(c.iso / 100);
    const prevExp = r.toneMappingExposure; r.toneMappingExposure = 1;
    this.post.run(r, this.post.develop, this.out);
    r.toneMappingExposure = prevExp;
  }

  presentPhoto(rect) {
    const r = this.renderer, p = this.post.present.uniforms;
    p.tA.value = this.out.texture;
    p.tB.value = this.hasSnap && this.snap ? this.snap.texture : this.out.texture;
    p.split.value = this.hasSnap && this.view.split >= 0 ? this.view.split : -1;
    p.res.value.set(rect.w, rect.h);
    p.zebra.value = this.cam.zebra ? 1 : 0;
    r.setRenderTarget(null);
    r.setViewport(rect.x, rect.y, rect.w, rect.h);
    r.setScissor(rect.x, rect.y, rect.w, rect.h);
    r.setScissorTest(true);
    this.post.run(r, this.post.present, null);
    r.setScissorTest(false);
  }

  renderEditor(rect, meter) {
    const r = this.renderer;
    this.applyExposure('editor', meter);
    this.gizmo.visible = !!this.gizmo.object; this.frustum.visible = true;
    r.toneMappingExposure = Math.PI / Math.max(60, meter.H) * 1.05;
    r.setRenderTarget(null);
    r.setViewport(rect.x, rect.y, rect.w, rect.h);
    r.setScissor(rect.x, rect.y, rect.w, rect.h);
    r.setScissorTest(true);
    r.setClearColor(0x0b0c0e, 1); r.clear();
    this.edCam.aspect = rect.w / rect.h; this.edCam.updateProjectionMatrix();
    r.render(this.scene, this.edCam);
    r.setScissorTest(false);
  }

  /** layout: devolve os retângulos (px CSS, origem em baixo) das duas vistas */
  layout() {
    const W = this.W, H = this.H, v = this.view;
    const full = { x: 0, y: 0, w: W, h: H };
    const ins = v.insetRect || { right: 16, top: 16, w: Math.round(Math.min(W * 0.26, 300)) };
    const iw = ins.w, ih = Math.round(iw / this.photoCam.aspect);
    const inset = { x: W - ins.right - iw, y: H - ins.top - ih, w: iw, h: ih };
    if (v.main === 'photo') {
      /* a fotografia fica entre a planta (esquerda) e a miniatura (direita) quando há espaço */
      const rl = v.reserve?.left || 0, rr = v.inset ? (v.reserve?.right || 0) : 0;
      const useR = W - rl - rr > 360;
      return { photo: this.fitPhoto(useR ? rl : 0, 0, useR ? W - rl - rr : W, H, v.photoPad ?? 18), editor: v.inset ? inset : null, insetIs: 'editor' };
    }
    return { editor: full, photo: v.inset ? { ...inset, h: Math.round(iw / this.photoCam.aspect) } : null, insetIs: 'photo' };
  }

  frame() {
    this._raf = requestAnimationFrame(() => this.frame());
    if (this.paused) return;
    const ctl = this.controls.update();
    if (this.tick) this.tick();
    if (!this._dirty && !ctl) return;
    const t0 = performance.now();
    this._dirty = false;
    this.updateScene();
    const meter = this.meter();
    this.lastMeter = meter;
    if (this._shadowsDirty) { this.renderer.shadowMap.needsUpdate = true; this._shadowsDirty = false; }
    const L = this.lastLayout = this.layout();
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setScissorTest(false);
    r.setClearColor(0x08090b, 1); r.clear();
    /* a fotografia primeiro (renderiza para alvo próprio) e depois o estúdio */
    if (L.photo) this.renderPhoto(L.photo, meter);
    if (L.editor) this.renderEditor(L.editor, meter);
    if (L.photo) this.presentPhoto(L.photo);
    this.stats.frames++; this.stats.ms = performance.now() - t0;
    for (const fn of this.listeners) fn('frame', meter);
  }

  start() { if (!this._raf) this.frame(); }
  stop() { cancelAnimationFrame(this._raf); this._raf = 0; }

  /** leitura de píxeis da fotografia (para histograma) — amostrada */
  readPhoto(maxW = 120) {
    if (!this.out) return null;
    const w = this.out.width, h = this.out.height, step = Math.max(1, Math.floor(w / maxW));
    const buf = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(this.out, 0, 0, w, h, buf);
    return { buf, w, h, step };
  }

  dispose() {
    this.stop();
    this.controls.dispose(); this.gizmo.dispose();
    this.scene.traverse(o => { o.geometry?.dispose?.(); });
    this.hdr?.dispose(); this.out?.dispose(); this.snap?.dispose();
    this.renderer.dispose();
  }
}
