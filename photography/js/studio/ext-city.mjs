/* ══════════════════════════════════════════════════════════════════════
   Exterior — rua de cidade procedural (modelação própria, sem assets).

   Unidades: metros; luz em unidades fotométricas reais multiplicadas por
   K (o alvo HDR é half-float: um candeeiro de 10⁵ cd/m² não cabia).
     · luzes direcionais / hemisfério: lux · K
     · spots: candelas · K
     · superfícies emissivas (céu, lâmpadas, janelas): cd/m² · K
   Com estas unidades, um cartão de 18 % sob E lux devolve 0,18·E·K/π e a
   revelação (ext-optics) usa a mesma fórmula do fotómetro do Estúdio.

   Disposição: a rua corre ao longo de z (a câmara olha para −z). Faixa de
   rodagem |x| < 4,5 m, passeios até 7,5 m, fachadas em x = ±7,5. Cruzamento
   em z ≈ −60. O sujeito está no passeio da esquerda.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, RoundedBoxGeometry, canvasTex, noiseField, kelvinRGB, DEG, clamp } from './st-core.mjs';

export const K = 0.01;
const SHOP_L = 90;          // montra iluminada, cd/m²
export const SUBJECT = { x: -5.0, z: 0 };
const ROAD = 4.5, WALK = 7.5, Z_NEAR = 46, Z_FAR = -236, X_GAP = [-66, -54];

/* ── horas do dia ───────────────────────────────────────────────────── */
/* sun.E e sky.E em lux; luminâncias do céu em cd/m²; janelas/montras em cd/m² */
export const TIMES = {
  day: {
    name: 'Dia de sol', short: 'Dia', wb: 5600,
    sun: { E: 75000, k: 5800, el: 52, az: 118 }, skyE: 15000,
    zen: [[0.32, 0.5, 1.0], 3000], hor: [[0.86, 0.91, 1.0], 8000], gnd: [[0.4, 0.37, 0.33], 1400],
    fog: 0.0026, lamps: 0, win: 0, shop: 0.08, sign: 0.3, car: 0.08,
    blurb: 'Sol alto: ~75 000 lux diretos + ~15 000 do céu. Regra do "sol a 16": f/16, ISO 100, 1/100.',
  },
  golden: {
    name: 'Hora dourada', short: 'Dourada', wb: 5200,
    sun: { E: 6000, k: 2900, el: 5, az: -172 }, skyE: 1600,
    zen: [[0.36, 0.46, 0.85], 480], hor: [[1.0, 0.62, 0.34], 1700], gnd: [[0.45, 0.36, 0.3], 160],
    fog: 0.0022, lamps: 0, win: 0.06, shop: 0.4, sign: 0.6, car: 0.4,
    blurb: 'Sol rasante e quente (~2900 K) ao fundo da rua: contraluz e sombras longas. ~6000 lux.',
  },
  blue: {
    name: 'Hora azul', short: 'Azul', wb: 4300,
    sun: { E: 0, k: 9000, el: -5, az: -170 }, skyE: 6,
    zen: [[0.16, 0.28, 1.0], 1.1], hor: [[0.36, 0.46, 0.95], 2.6], gnd: [[0.3, 0.3, 0.32], 0.25],
    fog: 0.004, lamps: 1, win: 0.42, shop: 1, sign: 1, car: 1,
    blurb: 'O céu ainda azul equilibra as luzes já acesas. Pouca luz: ~20 lux no rosto.',
  },
  night: {
    name: 'Noite', short: 'Noite', wb: 3800,
    sun: { E: 0, k: 9000, el: -30, az: 0 }, skyE: 0.25,
    zen: [[0.28, 0.24, 0.32], 0.035], hor: [[0.95, 0.58, 0.3], 0.14], gnd: [[0.3, 0.28, 0.26], 0.02],
    fog: 0.0045, lamps: 1, win: 0.3, shop: 0.85, sign: 1, car: 1,
    blurb: 'Só luz artificial: candeeiros de sódio (laranja) e LED (branco), montras e faróis.',
  },
};

/* ── utilidades ─────────────────────────────────────────────────────── */
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rgbK = (k, L) => { const c = kelvinRGB(k); return new THREE.Color(c[0] * L * K, c[1] * L * K, c[2] * L * K); };
const tint = (rgb, L) => new THREE.Color(rgb[0] * L * K, rgb[1] * L * K, rgb[2] * L * K);
function dirFromSun(el, az) { return v3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG)).normalize(); }

/* ── texturas (canvas) ──────────────────────────────────────────────── */
/* Um "vão" de fachada (uma janela num andar) por textura; as UV da fachada
   contam vãos e andares, por isso floor(uv) identifica cada janela. A máscara
   (R = vidro, G = rugosidade) serve de emissiveMap e de roughnessMap. */
const STYLES = [
  { shutter: '#3d5e46', frame: '#f4f1ea', tiles: false, balcony: true },
  { shutter: '#6b4a32', frame: '#efe8da', tiles: false, balcony: false },
  { shutter: null, frame: '#f6f4ef', tiles: true, balcony: true },
  { shutter: '#2f4a63', frame: '#ece6d8', tiles: false, balcony: true },
  { shutter: null, frame: '#ddd6c8', tiles: false, balcony: false },
];
function bayTextures(style, i) {
  const S = 256;
  const col = canvasTex(S, S, (g, w, h) => {
    const n = noiseField(w, h, 24, 31 + i), f = noiseField(w, h, 3, 41 + i);
    const im = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) {
      let v = 228 - n[p] * 26 - f[p] * 12;
      if (style.tiles) {   /* azulejo: grelha de 16 px com motivo azul */
        const x = p % w, y = (p / w) | 0, tx = x % 16, ty = y % 16;
        const edge = tx < 1 || ty < 1;
        const motif = Math.abs(tx - 8) + Math.abs(ty - 8) < 4 || (tx - 8) * (tx - 8) + (ty - 8) * (ty - 8) > 44;
        const b = edge ? [200, 205, 208] : motif ? [70, 105, 170] : [236, 238, 240];
        im.data.set([b[0] - f[p] * 10, b[1] - f[p] * 10, b[2] - f[p] * 10, 255], p * 4); continue;
      }
      im.data.set([v, v * 0.985, v * 0.96, 255], p * 4);
    }
    g.putImageData(im, 0, 0);
    /* janela */
    const x0 = w * 0.3, x1 = w * 0.7, y0 = h * 0.16, y1 = h * 0.84;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 - 3, y1, x1 - x0 + 6, 9);               // sombra do peitoril
    g.fillStyle = style.frame; g.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
    g.fillStyle = '#e9e5dc'; g.fillRect(x0 - 10, y1 + 2, x1 - x0 + 20, 8);                // peitoril
    g.fillStyle = '#1b2026'; g.fillRect(x0, y0, x1 - x0, y1 - y0);                        // vidro
    g.fillStyle = 'rgba(160,180,200,.18)'; g.fillRect(x0, y0, (x1 - x0) * 0.5, (y1 - y0) * 0.45);
    g.fillStyle = style.frame;
    g.fillRect((x0 + x1) / 2 - 3, y0, 6, y1 - y0); g.fillRect(x0, y0 + (y1 - y0) * 0.36, x1 - x0, 5);
    if (style.shutter) {   /* portadas abertas */
      g.fillStyle = style.shutter;
      for (const sx of [x0 - 6 - (x1 - x0) * 0.5, x1 + 6]) {
        g.fillRect(sx, y0 - 6, (x1 - x0) * 0.5, y1 - y0 + 12);
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (let yy = y0; yy < y1; yy += 7) g.fillRect(sx + 3, yy, (x1 - x0) * 0.5 - 6, 2);
        g.fillStyle = style.shutter;
      }
    }
  }, { repeat: [1, 1] });
  const mask = canvasTex(S, S, (g, w, h) => {
    g.fillStyle = 'rgb(0,235,0)'; g.fillRect(0, 0, w, h);
    const x0 = w * 0.3, x1 = w * 0.7, y0 = h * 0.16, y1 = h * 0.84;
    g.fillStyle = 'rgb(255,25,0)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = 'rgb(0,200,0)'; g.fillRect((x0 + x1) / 2 - 3, y0, 6, y1 - y0); g.fillRect(x0, y0 + (y1 - y0) * 0.36, x1 - x0, 5);
  }, { srgb: false, repeat: [1, 1] });
  return { col, mask };
}
function shopTextures() {
  const W = 512, H = 256;
  const col = canvasTex(W, H, (g, w, h) => {
    const n = noiseField(w, h, 16, 7);
    const im = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { const v = 196 - n[p] * 30; im.data.set([v, v * 0.97, v * 0.92, 255], p * 4); }
    g.putImageData(im, 0, 0);
    g.fillStyle = '#5b5852'; g.fillRect(0, h * 0.88, w, h * 0.12);                       // soco de pedra
    g.fillStyle = '#2a2c2f'; g.fillRect(w * 0.06, h * 0.1, w * 0.88, h * 0.1);           // reclamo
    g.fillStyle = '#3a3226'; g.fillRect(w * 0.06, h * 0.24, w * 0.6, h * 0.62);           // caixilho
    g.fillStyle = '#20252b'; g.fillRect(w * 0.08, h * 0.27, w * 0.56, h * 0.56);          // montra
    g.fillStyle = 'rgba(255,255,255,.07)';
    for (let k = 0; k < 4; k++) g.fillRect(w * (0.12 + k * 0.13), h * 0.55, w * 0.08, h * 0.25);   // prateleiras
    g.fillStyle = '#3a3226'; g.fillRect(w * 0.7, h * 0.24, w * 0.24, h * 0.66);          // porta
    g.fillStyle = '#241f19'; g.fillRect(w * 0.72, h * 0.28, w * 0.2, h * 0.6);
  }, { repeat: [1, 1] });
  const mask = canvasTex(W, H, (g, w, h) => {
    g.fillStyle = 'rgb(0,230,0)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgb(255,30,0)'; g.fillRect(w * 0.08, h * 0.27, w * 0.56, h * 0.56);
    g.fillStyle = 'rgb(110,60,0)'; g.fillRect(w * 0.72, h * 0.28, w * 0.2, h * 0.3);
  }, { srgb: false, repeat: [1, 1] });
  return { col, mask };
}
function calcadaTexture() {
  /* calçada portuguesa: ondas de basalto sobre calcário, pedra a pedra */
  return canvasTex(512, 512, (g, w, h) => {
    const n = noiseField(w, h, 9, 5);
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / 9), cy = Math.floor(y / 9);
      const jit = ((cx * 7919 + cy * 104729) % 97) / 97;
      const wave = Math.sin((x / w) * Math.PI * 4 + Math.sin((y / h) * Math.PI * 2) * 0.6) * 0.5 + 0.5;
      const band = Math.abs(((y / h) * 4 + wave * 0.9) % 1 - 0.5) < 0.12;
      const gap = (x % 9 < 1 || y % 9 < 1) ? 0.55 : 1;
      const base = band ? 46 + jit * 16 : 168 + jit * 26 - n[y * w + x] * 20;
      const v = base * gap;
      im.data.set([v, v * 0.985, v * 0.95, 255], (y * w + x) * 4);
    }
    g.putImageData(im, 0, 0);
  }, { repeat: [1, 1] });
}
function asphaltTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const a = noiseField(w, h, 2, 61), b = noiseField(w, h, 40, 62);
    const im = g.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { const v = 52 + a[p] * 30 + b[p] * 16; im.data.set([v, v, v * 1.02, 255], p * 4); }
    g.putImageData(im, 0, 0);
  }, { repeat: [1, 1] });
}
function railingTexture() {
  return canvasTex(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#16181a';
    g.fillRect(0, 0, w, 6); g.fillRect(0, h - 5, w, 5);
    for (let x = 2; x < w; x += 10) g.fillRect(x, 0, 3, h);
  }, { repeat: [1, 1] });
}
function signTexture(text, fg, bg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'bold 86px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

/* janelas acesas: cada vão sorteia se está aceso e a cor (quente / TV) */
function litMaterial(base, uLit, seed) {
  const m = base.clone();
  m.userData.uSeed = { value: seed };
  m.onBeforeCompile = sh => {
    sh.uniforms.uLit = uLit; sh.uniforms.uSeed = m.userData.uSeed;
    sh.fragmentShader = 'uniform float uLit; uniform float uSeed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
        vec2 cWin = floor( vEmissiveMapUv + 1e-3 );
        float hW = fract( sin( dot( cWin + vec2( uSeed, uSeed * 1.7 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
        float onW = step( 1.0 - uLit, hW );
        vec3 tw = mix( vec3( 1.0, 0.6, 0.3 ), vec3( 1.0, 0.84, 0.62 ), fract( hW * 17.0 ) );
        if ( fract( hW * 53.0 ) > 0.9 ) tw = vec3( 0.55, 0.7, 1.0 );
        totalEmissiveRadiance *= emissiveColor.r * onW * tw * ( 0.45 + fract( hW * 31.0 ) );
      #endif`);
  };
  m.customProgramCacheKey = () => 'ext-lit';
  return m;
}

/* ── carros ─────────────────────────────────────────────────────────── */
const CAR_COLORS = ['#b8bcc2', '#1d2228', '#e9e9e6', '#7a1f22', '#28466e', '#3b3f45', '#9a9fa6', '#c9b28a', '#2d5a46', '#0f1115'];
function buildCar(colorHex, lampMats) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.32, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.04, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.8 });
  /* carroçaria em dois andares (capô/mala mais baixos), habitáculo com pilares na cor e vidros à volta */
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.62, 4.3, 3, 0.2), paint); body.position.y = 0.58;
  const belt = new THREE.Mesh(new RoundedBoxGeometry(1.74, 0.16, 2.5, 2, 0.06), paint); belt.position.set(0, 0.92, 0.2);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.5, 2.05, 3, 0.16), paint); cabin.position.set(0, 1.2, 0.25);
  g.add(body, belt, cabin);
  const sideG = new THREE.BoxGeometry(0.02, 0.34, 1.62);
  for (const sx of [-0.76, 0.76]) { const w = new THREE.Mesh(sideG, glass); w.position.set(sx, 1.22, 0.25); g.add(w); }
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.02, 0.62), glass); shield.position.set(0, 1.18, -0.88); shield.rotation.x = -0.98; g.add(shield);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.02, 0.5), glass); rear.position.set(0, 1.2, 1.36); rear.rotation.x = 1.1; g.add(rear);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.03), dark); grille.position.set(0, 0.58, -2.16); g.add(grille);
  const bump = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.12), dark); bump.position.set(0, 0.34, -2.12); g.add(bump);
  const bump2 = bump.clone(); bump2.position.z = 2.12; g.add(bump2);
  const wheelG = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18); wheelG.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.4], [0.82, 1.4]]) { const w = new THREE.Mesh(wheelG, dark); w.position.set(x, 0.33, z); g.add(w); }
  /* faróis à frente (−z) e farolins atrás (+z): malhas próprias, esticadas no rasto */
  const lamps = [];
  const lampG = new THREE.BoxGeometry(0.34, 0.13, 0.08);
  for (const sx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(lampG, lampMats.head); h.position.set(sx, 0.7, -2.16); g.add(h); lamps.push(h);
    const t = new THREE.Mesh(lampG, lampMats.tail); t.position.set(sx, 0.78, 2.16); g.add(t); lamps.push(t);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  lamps.forEach(l => { l.castShadow = false; l.userData.z0 = l.position.z; });
  g.userData.lamps = lamps;
  return g;
}

/* ═════════════════════════════════════════════════════════════════════ */
export function buildCity(renderer, { mobile = false } = {}) {
  const R = rng(20261031);
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const fog = new THREE.FogExp2(0x000000, 0.004); scene.fog = fog;
  const solids = [];            // para o raycast do foco e a visibilidade do sol

  /* ── céu ── */
  const skyU = { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunDir: { value: v3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: new THREE.Color() } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 zen, hor, gnd, sunDir, sunCol, glow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.42)) : mix(hor, gnd, clamp(-h * 6.0, 0.0, 1.0));
        float m = max(dot(d, sunDir), 0.0);
        c += glow * (pow(m, 8.0) * 0.6 + pow(m, 64.0) * 2.0);
        if (m > 0.99996) c += sunCol;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10; sky.userData.noFocus = true;
  scene.add(sky);

  /* ── chão: estrada, passeios, lancis ── */
  const asph = asphaltTexture(); asph.wrapS = asph.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: asph, roughness: 0.86 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, Z_NEAR - Z_FAR + 80), roadMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, (Z_NEAR + Z_FAR) / 2);
  { const uv = ground.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 400 / 6, uv.getY(i) * (Z_NEAR - Z_FAR + 80) / 6); }
  ground.receiveShadow = true; root.add(ground); solids.push(ground);
  const cal = calcadaTexture(); cal.wrapS = cal.wrapT = THREE.RepeatWrapping;
  const walkMat = new THREE.MeshStandardMaterial({ map: cal, roughness: 0.62 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.7 });
  const segs = [[Z_NEAR, X_GAP[1]], [X_GAP[0], Z_FAR]];
  for (const side of [-1, 1]) for (const [za, zb] of segs) {
    const len = za - zb;
    const g = new THREE.BoxGeometry(WALK - ROAD, 0.15, len);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (WALK - ROAD) / 2.4, uv.getY(i) * len / 2.4);
    const w = new THREE.Mesh(g, walkMat); w.position.set(side * (ROAD + WALK) / 2, 0.075, (za + zb) / 2); w.receiveShadow = true; root.add(w); solids.push(w);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, len), curbMat); c.position.set(side * (ROAD + 0.09), 0.08, (za + zb) / 2); c.receiveShadow = true; root.add(c);
  }
  /* marcas: tracejado central, passadeira */
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.6 });
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 3), paint, 60);
  let di = 0; const dm = new THREE.Matrix4();
  for (let z = Z_NEAR - 2; z > Z_FAR && di < 60; z -= 7.5) { if (z < X_GAP[1] + 6 && z > X_GAP[0] - 6) continue; dm.makeRotationX(-Math.PI / 2).setPosition(0, 0.012, z); dash.setMatrixAt(di++, dm); }
  dash.count = di; dash.receiveShadow = true; root.add(dash);
  const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 3.2), paint, 16);
  for (let i = 0; i < 16; i++) { dm.makeRotationX(-Math.PI / 2).setPosition(-ROAD + 0.5 + i * 0.56, 0.013, X_GAP[1] + 3.4); zebra.setMatrixAt(i, dm); }
  zebra.count = 16; zebra.receiveShadow = true; root.add(zebra);

  /* ── edifícios ── */
  const PALETTE = ['#ead9b4', '#e9c3b3', '#c8d6e2', '#f0ebe2', '#d9a46b', '#bccaa8', '#f1d5cf', '#d8c39c', '#e3e0d6'];
  const bays = STYLES.map(bayTextures);
  bays.forEach(b => { for (const t of [b.col, b.mask]) t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const shopT = shopTextures(); for (const t of [shopT.col, shopT.mask]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const railT = railingTexture(); railT.wrapS = THREE.RepeatWrapping;
  const uWin = { value: 0 }, uShop = { value: 0 };
  const winEmissive = [], shopMats = [];
  const bodyMats = new Map();
  const balcSlab = [], balcRail = [];
  const cornMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a4a35, roughness: 0.85 });
  const shopFronts = [];        // para a luz de montra e os reclamos

  function building(face, axis, sideSign, along0, width, floors, style, colorHex) {
    /* face: posição do plano da fachada (x se axis='x', z se axis='z');
       sideSign: para onde a fachada olha (+1/−1 no eixo) */
    const H0 = 4.2, FH = 3.15, H = H0 + floors * FH, depth = 12;
    const st = STYLES[style], tex = bays[style];
    const tintC = new THREE.Color(colorHex);
    if (!bodyMats.has(colorHex)) bodyMats.set(colorHex, new THREE.MeshStandardMaterial({ color: tintC, roughness: 0.9 }));
    const bodyMat = bodyMats.get(colorHex);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, H, depth), bodyMat);
    body.position.set(0, H / 2, -depth / 2 - 0.02);
    g.add(body);
    const nb = Math.max(1, Math.round(width / 3.3));
    const facadeBase = new THREE.MeshStandardMaterial({ map: tex.col, color: st.tiles ? 0xffffff : tintC, roughnessMap: tex.mask, roughness: 1, metalness: 0, emissiveMap: tex.mask, emissive: 0xffffff, emissiveIntensity: 0 });
    const fm = litMaterial(facadeBase, uWin, R() * 100);
    winEmissive.push(fm);
    const fg = new THREE.PlaneGeometry(width, floors * FH);
    { const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * nb, uv.getY(i) * floors); }
    const facade = new THREE.Mesh(fg, fm); facade.position.set(0, H0 + floors * FH / 2, 0); g.add(facade);
    /* rés-do-chão: lojas */
    const ns = Math.max(1, Math.round(width / 4.6));
    const sm = litMaterial(new THREE.MeshStandardMaterial({ map: shopT.col, color: 0xffffff, roughnessMap: shopT.mask, roughness: 1, emissiveMap: shopT.mask, emissive: 0xffffff, emissiveIntensity: 0 }), uShop, R() * 100);
    shopMats.push(sm);
    const sg = new THREE.PlaneGeometry(width, H0);
    { const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ns, uv.getY(i)); }
    const shop = new THREE.Mesh(sg, sm); shop.position.set(0, H0 / 2, 0); g.add(shop);
    /* friso e cornija */
    const fr = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.25), cornMat); fr.position.set(0, H0, 0.1); g.add(fr);
    const co = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.42, 0.55), cornMat); co.position.set(0, H + 0.2, 0.2); g.add(co);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(width, 1.6, 4), roofMat); roof.position.set(0, H + 0.9, -2.4); roof.rotation.x = -0.5; g.add(roof);
    /* orientação: a fachada local olha para +z */
    /* axis 'x': fachada no plano x = face, ocupa z ∈ [along0 − width, along0];
       axis 'z': fachada no plano z = face, ocupa x ∈ [along0, along0 + width] */
    if (axis === 'x') { g.rotation.y = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2; g.position.set(face, 0, along0 - width / 2); }
    else { g.rotation.y = sideSign > 0 ? 0 : Math.PI; g.position.set(along0 + width / 2, 0, face); }
    g.updateMatrixWorld(true);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; solids.push(o); } });
    root.add(g);
    /* varandas (instanciadas) */
    if (st.balcony) for (let f = 1; f < floors; f++) for (let b = 0; b < nb; b++) {
      if (R() < 0.35) continue;
      const lx = -width / 2 + (b + 0.5) * width / nb, ly = H0 + f * FH + 0.02;
      const m = new THREE.Matrix4().makeTranslation(lx, ly, 0.32).premultiply(g.matrixWorld);
      balcSlab.push(m);
      balcRail.push(new THREE.Matrix4().makeTranslation(lx, ly + 0.5, 0.62).premultiply(g.matrixWorld));
    }
    shopFronts.push({ g, width, H0 });
    return g;
  }
  function row(axis, face, sideSign, a, b) {
    let p = a;
    while (p > b + 3) {
      const w = Math.min(6 + R() * 6, p - b);
      building(face, axis, sideSign, p, w, 2 + Math.floor(R() * 4), Math.floor(R() * STYLES.length), PALETTE[Math.floor(R() * PALETTE.length)]);
      p -= w;
    }
  }
  /* fachadas ao longo da rua (a da esquerda olha para +x, a da direita para −x) */
  row('x', -WALK, 1, Z_NEAR, X_GAP[1]); row('x', -WALK, 1, X_GAP[0], Z_FAR + 4);
  row('x', WALK, -1, Z_NEAR, X_GAP[1]); row('x', WALK, -1, X_GAP[0], Z_FAR + 4);
  /* fundo da rua e rua transversal (só as fachadas que a câmara vê, viradas para +z) */
  for (const [x0, x1] of [[-46, -WALK - 0.5], [WALK + 0.5, 46]]) {
    let x = x0; while (x < x1 - 2) { const w = Math.min(x1 - x, 6 + R() * 5); building(X_GAP[0] - 0.5, 'z', 1, x, w, 2 + Math.floor(R() * 4), Math.floor(R() * STYLES.length), PALETTE[Math.floor(R() * PALETTE.length)]); x += w; }
  }
  { let x = -30; while (x < 30) { const w = 7 + R() * 5; building(Z_FAR, 'z', 1, x, w, 3 + Math.floor(R() * 4), Math.floor(R() * STYLES.length), PALETTE[Math.floor(R() * PALETTE.length)]); x += w; } }
  const slabM = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.8 });
  const railM = new THREE.MeshStandardMaterial({ map: railT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 });
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.12, 0.62), slabM, balcSlab.length);
  const rails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.7, 0.95), railM, balcRail.length);
  balcSlab.forEach((m, i) => slabs.setMatrixAt(i, m)); balcRail.forEach((m, i) => rails.setMatrixAt(i, m));
  slabs.castShadow = rails.castShadow = true; slabs.receiveShadow = rails.receiveShadow = true;
  root.add(slabs, rails);

  /* ── candeeiros: os do lado esquerdo são LED (4000 K), os da direita sódio (2100 K) ── */
  const lamps = [];
  for (let z = 6; z > Z_FAR + 8; z -= 16) if (z > X_GAP[1] + 3 || z < X_GAP[0] - 3) lamps.push({ x: -WALK + 0.9, z, side: -1, k: 4000 });
  for (let z = -2; z > Z_FAR + 8; z -= 16) if (z > X_GAP[1] + 3 || z < X_GAP[0] - 3) lamps.push({ x: WALK - 0.9, z, side: 1, k: 2100 });
  const poleM = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.45, metalness: 0.6 });
  const poleG = new THREE.CylinderGeometry(0.07, 0.11, 7.2, 10); poleG.translate(0, 3.6, 0);
  const armG = new THREE.BoxGeometry(1.9, 0.08, 0.08); armG.translate(0.95, 0, 0);
  const headG = new RoundedBoxGeometry(0.7, 0.16, 0.34, 2, 0.06);
  const bulbG = new THREE.BoxGeometry(0.52, 0.03, 0.22);
  const poles = new THREE.InstancedMesh(poleG, poleM, lamps.length);
  const arms = new THREE.InstancedMesh(armG, poleM, lamps.length);
  const heads = new THREE.InstancedMesh(headG, poleM, lamps.length);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const bulbs = new THREE.InstancedMesh(bulbG, bulbMat, lamps.length);
  const LAMP_L = 9e4, LAMP_CD = 2200;            // luminância da lente (cd/m²), intensidade para baixo (cd)
  lamps.forEach((l, i) => {
    const toRoad = -l.side;     // braço sobre a estrada
    const m = new THREE.Matrix4();
    m.makeTranslation(l.x, 0, l.z); poles.setMatrixAt(i, m);
    m.makeRotationY(toRoad > 0 ? 0 : Math.PI).setPosition(l.x, 7.1, l.z); arms.setMatrixAt(i, m);
    l.head = v3(l.x + toRoad * 1.8, 7.0, l.z);
    m.makeTranslation(l.head.x, l.head.y, l.head.z); heads.setMatrixAt(i, m);
    m.makeTranslation(l.head.x, l.head.y - 0.09, l.head.z); bulbs.setMatrixAt(i, m);
  });
  poles.castShadow = arms.castShadow = heads.castShadow = true;
  root.add(poles, arms, heads, bulbs);
  /* poças de luz no chão dos candeeiros longe da câmara (os perto são luzes reais) */
  const poolMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uI; varying vec2 vUv; varying vec3 vC; void main(){ vec2 p = vUv * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
      /* E(r) = I·h/(h²+r²)^(3/2), normalizado no centro; 0,3 de albedo */
      float e = pow(1.0 / (1.0 + r2 * 2.6), 1.5) * (1.0 - r2 * r2);
      gl_FragColor = vec4(vC * e * uI, 1.0); }`,
  });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), poolMat, lamps.length);
  pools.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lamps.length * 3), 3);
  lamps.forEach((l, i) => {
    const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2).scale(v3(13, 13, 1)).setPosition(l.head.x, 0.17, l.z);
    pools.setMatrixAt(i, m);
    const c = kelvinRGB(l.k); pools.instanceColor.setXYZ(i, c[0], c[1], c[2]);
    bulbs.setColorAt(i, rgbK(l.k, LAMP_L));
  });
  pools.frustumCulled = false; pools.userData.noFocus = true; root.add(pools);

  /* iluminações penduradas sobre a rua (catenárias) e lanternas de fachada:
     pontos de luz pequenos e a meia altura — as fontes clássicas de bokeh */
  const deco = [];      // { p: Vector3, k, r, L }
  for (let z = -7; z > -150; z -= 11) {
    if (z < X_GAP[1] + 4 && z > X_GAP[0] - 4) continue;
    const y0 = 6.4, sag = 0.9;
    for (let x = -WALK + 0.3; x <= WALK - 0.3; x += 0.36) {
      const u = (x + WALK) / (2 * WALK), y = y0 - sag * 4 * u * (1 - u);
      deco.push({ p: v3(x, y, z + Math.sin(x * 1.3) * 0.05), k: 2400, r: 0.035, L: 6e3 });
    }
  }
  for (const side of [-1, 1]) for (let z = side < 0 ? 3 : -4; z > Z_FAR + 10; z -= 11.5) {
    if (z < X_GAP[1] + 3 && z > X_GAP[0] - 3) continue;
    if (side < 0 && Math.abs(z - SUBJECT.z) < 2.5) continue;
    deco.push({ p: v3(side * (WALK - 0.42), 4.25, z), k: 2200, r: 0.15, L: 4e3, lantern: true });
  }
  const decoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const decoMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), decoMat, deco.length);
  deco.forEach((d, i) => { decoMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(d.r, d.r * (d.lantern ? 1.25 : 1), d.r).setPosition(d.p)); decoMesh.setColorAt(i, rgbK(d.k, d.L)); });
  root.add(decoMesh);
  /* fio das iluminações e braço das lanternas */
  const wireM = new THREE.LineBasicMaterial({ color: 0x0b0b0c });
  const wirePts = [];
  for (let i = 1; i < deco.length; i++) if (!deco[i].lantern && !deco[i - 1].lantern && deco[i].p.z === deco[i - 1].p.z) wirePts.push(deco[i - 1].p.clone().add(v3(0, 0.04, 0)), deco[i].p.clone().add(v3(0, 0.04, 0)));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), wireM));
  const brk = deco.filter(d => d.lantern);
  const brkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.05, 0.05), poleM, brk.length);
  brk.forEach((d, i) => brkMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(d.p.x - Math.sign(d.p.x) * 0.2, d.p.y + 0.3, d.p.z)));
  root.add(brkMesh);

  /* luzes reais: os 4 candeeiros mais próximos do sujeito (o mais próximo com sombra) */
  const near = [...lamps].sort((a, b) => Math.hypot(a.x - SUBJECT.x, a.z - SUBJECT.z) - Math.hypot(b.x - SUBJECT.x, b.z - SUBJECT.z)).slice(0, 4);
  const lampLights = near.map((l, i) => {
    const s = new THREE.SpotLight(0xffffff, 0, 0, 1.22, 0.75, 2);
    s.position.copy(l.head).add(v3(0, -0.12, 0));
    s.target.position.set(l.head.x, 0, l.head.z);
    s.castShadow = i === 0;
    if (s.castShadow) { s.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02; s.shadow.camera.near = 0.3; s.shadow.camera.far = 30; s.shadow.radius = 3; }
    root.add(s, s.target);
    l.real = true;
    return { s, l };
  });
  /* poças só nos candeeiros sem luz real */
  lamps.forEach((l, i) => { if (l.real) pools.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); });

  /* sol */
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  const SM = mobile ? 2048 : 4096;
  sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 320 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
  sun.target.position.set(SUBJECT.x, 0, SUBJECT.z - 12);
  root.add(sun, sun.target);

  /* luz de montra atrás/ao lado do sujeito (área real, quente) */
  const shopLight = new THREE.RectAreaLight(0xffffff, 0, 3.0, 1.8);
  shopLight.position.set(-WALK + 0.05, 1.7, SUBJECT.z - 3.5);
  shopLight.lookAt(0, 1.7, SUBJECT.z - 3.5);
  root.add(shopLight);

  /* ── mobiliário: pilaretes, semáforos, reclamos ── */
  const bolM = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.5, metalness: 0.4 });
  const bolG = new THREE.CylinderGeometry(0.075, 0.09, 0.92, 10); bolG.translate(0, 0.46 + 0.15, 0);
  const bolPos = [];
  for (const side of [-1, 1]) for (let z = Z_NEAR - 4; z > Z_FAR + 6; z -= 2.2) {
    if (z < X_GAP[1] + 1 && z > X_GAP[0] - 1) continue;
    if (side < 0 && Math.abs(z - SUBJECT.z) < 1.4) continue;
    if (lamps.some(l => l.side === side && Math.abs(l.z - z) < 1.1)) continue;
    bolPos.push([side * (ROAD + 0.42), z]);
  }
  const bol = new THREE.InstancedMesh(bolG, bolM, bolPos.length);
  bolPos.forEach(([x, z], i) => bol.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, z)));
  bol.castShadow = true; bol.receiveShadow = true; root.add(bol);

  const signs = [];   // { mat, rgb, L } emissivos que acendem ao fim do dia
  /* farmácia: cruz verde em bandeira, perpendicular à fachada da esquerda */
  for (const [zc, L] of [[-27, 1400], [-118, 1400]]) {
    const cross = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.2)), b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.62));
    const mat = new THREE.MeshBasicMaterial({ color: 0, toneMapped: false }); a.material = b.material = mat;
    cross.add(a, b); cross.position.set(-WALK + 0.75, 3.7, zc); root.add(cross);
    signs.push({ mat, rgb: [0.12, 1, 0.3], L });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.05), poleM); arm.position.set(-WALK + 0.38, 4.05, zc); root.add(arm);
  }
  /* "CAFÉ" e "PASTELARIA" em néon */
  for (const [txt, x, z, rot, rgb] of [['CAFÉ', WALK - 0.06, -19, -Math.PI / 2, [1, 0.25, 0.18]], ['PASTELARIA', -WALK + 0.06, -47, Math.PI / 2, [1, 0.72, 0.35]], ['HOTEL', WALK - 0.06, -96, -Math.PI / 2, [0.4, 0.75, 1]]]) {
    const t = signTexture(txt, '#ffffff', '#000000');
    const mat = new THREE.MeshBasicMaterial({ map: t, color: 0, toneMapped: false, transparent: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(txt.length > 6 ? 3.6 : 2.0, 0.55), mat);
    m.position.set(x, 4.55, z); m.rotation.y = rot; root.add(m);
    signs.push({ mat, rgb, L: 700 });
  }
  /* semáforos no cruzamento (verde para quem segue rua acima) */
  const tlG = new THREE.Group();
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.4, 8), poleM); pole.position.set(side * (ROAD + 0.5), 1.7, X_GAP[1] + 1.2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.25), bolM); box.position.set(side * (ROAD + 0.5), 3.15, X_GAP[1] + 1.2);
    tlG.add(pole, box);
    for (const [dy, rgb, on] of [[0.3, [1, 0.12, 0.08], 0], [0, [1, 0.6, 0.05], 0], [-0.3, [0.1, 1, 0.55], 1]]) {
      const mat = new THREE.MeshBasicMaterial({ color: 0, toneMapped: false });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), mat); l.position.set(side * (ROAD + 0.5), 3.15 + dy, X_GAP[1] + 1.33); tlG.add(l);
      signs.push({ mat, rgb, L: on ? 2500 : 30, always: true });
    }
  }
  root.add(tlG);

  /* ── carros ── */
  const headMat = new THREE.MeshBasicMaterial({ color: 0, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0, toneMapped: false });
  const movers = [];
  const LEN = Z_NEAR - Z_FAR + 30;
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;           // +1 vem para a câmara (faixa da direita), −1 afasta-se
    const lm = { head: headMat.clone(), tail: tailMat.clone() };
    const car = buildCar(CAR_COLORS[i % CAR_COLORS.length], lm);
    car.rotation.y = dir > 0 ? Math.PI : 0;        // frente do carro (−z local) no sentido da marcha
    root.add(car);
    movers.push({ car, lm, dir, x: dir > 0 ? 1.75 : -1.75, z0: Z_NEAR - (i * 0.5 + R() * 0.35) * LEN / 5, v: 8.5 + R() * 5.5 });
  }
  /* estacionados (lado direito, longe do sujeito) */
  const offLamp = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.15, metalness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const car = buildCar(CAR_COLORS[(i * 3 + 2) % CAR_COLORS.length], { head: offLamp, tail: offLamp });
    car.position.set(ROAD - 1.15, 0, -14 - i * 7.8 - (i > 3 ? 18 : 0)); car.rotation.y = Math.PI;
    root.add(car); car.traverse(o => { if (o.isMesh) solids.push(o); });
  }

  /* ── ambiente (reflexos + luz do céu) por hora do dia ── */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = {};
  function envFor(id) {
    if (envCache[id]) return envCache[id];
    const s2 = new THREE.Scene();
    const sk = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone()); s2.add(sk);
    sk.material.uniforms = THREE.UniformsUtils.clone(skyU);
    sk.material.uniforms.sunCol.value.setRGB(0, 0, 0);      // o sol direto já é a DirectionalLight
    envCache[id] = pmrem.fromScene(s2, 0, 0.1, 100).texture;
    sk.geometry.dispose(); sk.material.dispose();
    return envCache[id];
  }

  /* ── hora do dia ── */
  let cur = null;
  function setTime(id) {
    const T = TIMES[id]; cur = id;
    const sd = dirFromSun(T.sun.el, T.sun.az);
    skyU.sunDir.value.copy(sd);
    skyU.zen.value.copy(tint(T.zen[0], T.zen[1]));
    skyU.hor.value.copy(tint(T.hor[0], T.hor[1]));
    skyU.gnd.value.copy(tint(T.gnd[0], T.gnd[1]));
    const sunUp = T.sun.el > 0 && T.sun.E > 0;
    /* disco solar: a luminância real (~10⁹ cd/m²) não cabe; basta que sature */
    skyU.sunCol.value.copy(sunUp ? rgbK(T.sun.k, 4e6) : new THREE.Color(0, 0, 0));
    skyU.glow.value.copy(sunUp ? rgbK(T.sun.k, T.hor[1] * 1.3) : new THREE.Color(0, 0, 0));
    scene.environment = envFor(id);
    scene.environmentIntensity = 1;
    fog.color.copy(tint(T.hor[0], T.hor[1] * 0.85));
    fog.density = T.fog;
    sun.intensity = sunUp ? T.sun.E * K : 0;
    sun.color.setRGB(...kelvinRGB(T.sun.k));
    sun.position.copy(sun.target.position).addScaledVector(sd, 160);
    /* candeeiros */
    bulbMat.color.setRGB(T.lamps, T.lamps, T.lamps);
    decoMat.color.setRGB(T.lamps, T.lamps, T.lamps);
    poolMat.uniforms.uI.value = T.lamps * LAMP_CD / (7 * 7) * 0.3 / Math.PI * K;
    for (const { s, l } of lampLights) { s.intensity = T.lamps * LAMP_CD * K; s.color.setRGB(...kelvinRGB(l.k)); }
    /* janelas e montras */
    uWin.value = T.win; uShop.value = T.shop > 0.5 ? 0.62 : 0.4;
    for (const m of winEmissive) { m.emissive.copy(rgbK(3000, 35)); m.emissiveIntensity = T.win > 0 ? 1 : 0; }
    for (const m of shopMats) { m.emissive.copy(rgbK(3300, SHOP_L * T.shop)); m.emissiveIntensity = T.shop > 0 ? 1 : 0; }
    shopLight.color.setRGB(...kelvinRGB(3300)); shopLight.intensity = SHOP_L * T.shop * K;
    for (const s of signs) { const L = s.L * (s.always ? 1 : T.sign); s.mat.color.setRGB(s.rgb[0] * L * K, s.rgb[1] * L * K, s.rgb[2] * L * K); }
    /* faróis: médios à noite, luzes diurnas de dia */
    headMat.color.copy(rgbK(5500, 6e4 * T.car)); { const L = 1800 * Math.max(0.15, T.car) * K; tailMat.color.setRGB(L, 0.04 * L, 0.03 * L); }
    for (const m of movers) { m.lm.head.color.copy(headMat.color); m.lm.tail.color.copy(tailMat.color); m.headC = headMat.color.clone(); m.tailC = tailMat.color.clone(); }
  }

  /** posiciona os carros no instante t (s); dt = duração da subexposição (rasto dos faróis) */
  function setMoment(t, dt = 0) {
    for (const m of movers) {
      const z = ((m.z0 + m.dir * m.v * t - Z_FAR + 15) % LEN + LEN) % LEN + Z_FAR - 15;
      m.car.position.set(m.x, 0, z);
      /* faróis esticados ao longo do percurso da subexposição, com a energia conservada */
      const len = 0.08, k = (len + m.v * dt) / len;
      for (const l of m.car.userData.lamps) { l.scale.z = k; }
      m.lm.head.color.copy(m.headC).multiplyScalar(1 / k); m.lm.tail.color.copy(m.tailC).multiplyScalar(1 / k);
    }
  }

  /** instante em que um carro ao acaso passa em z (para haver sempre trânsito no enquadramento) */
  function momentFor(z, rnd = Math.random, dir = 0) {
    const pool = dir ? movers.filter(m => m.dir === dir) : movers;
    const m = pool[Math.floor(rnd() * pool.length)];
    const base = ((((z - m.z0) * m.dir) % LEN) + LEN) % LEN / m.v;
    return base + LEN / m.v * (1 + Math.floor(rnd() * 3));
  }

  /** iluminância incidente (lux) num domo em `p` virado para `dome` — o fotómetro */
  const ray = new THREE.Raycaster();
  function meterAt(p, dome) {
    const T = TIMES[cur];
    let E = 0;
    const sd = dirFromSun(T.sun.el, T.sun.az);
    if (T.sun.el > 0 && T.sun.E > 0) {
      ray.set(p, sd); ray.far = 400;
      const hit = ray.intersectObjects(solids, false).length > 0;
      if (!hit) E += T.sun.E * Math.max(0, (1 + dome.dot(sd)) / 2);
    }
    /* céu: um domo vertical numa rua estreita vê ~1/3 do céu */
    E += T.skyE * 0.34;
    if (T.lamps > 0) for (const l of lamps) {
      const d = v3(l.head.x - p.x, l.head.y - 0.1 - p.y, l.head.z - p.z), r = d.length();
      if (r > 45) continue;
      d.divideScalar(r);
      const down = Math.max(0, -d.y);                 // luminária virada para baixo (~coseno)
      E += T.lamps * LAMP_CD * Math.pow(down, 0.6) / (r * r) * Math.max(0, (1 + dome.dot(d)) / 2);
    }
    /* montra e chão iluminado */
    E += SHOP_L * T.shop * 3 * 1.8 * 0.15 / 12;
    return E;
  }

  /* dados para a planta 2D */
  const plan = {
    road: ROAD, walk: WALK, gap: X_GAP, zNear: Z_NEAR, zFar: Z_FAR,
    lamps: lamps.map(l => ({ x: l.head.x, z: l.z, k: l.k })),
    movers,
  };

  return { scene, root, sky, sun, solids, lamps, setTime, setMoment, momentFor, meterAt, plan, get time() { return cur; } };
}
