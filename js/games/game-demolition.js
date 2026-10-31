/* ══════════════════════════════════════════════════════════════════
   Implosão (id demolition) — puzzle de demolição em 3D (out/2026).

   Põe cargas nos pilares e paredes, carrega em DETONAR e vê se o prédio
   fica abaixo da linha vermelha — sem tocar no que tem escudo verde e
   dentro do orçamento (o custo dá as estrelas).

   Peças:
     • DemoSim   (demo-sim.js)    → física Rapier, cargas, estilhaçar, avaliação
     • DemoLevels (demo-levels.js) → níveis e mundos
     • aqui: desenho three.js, câmara, interface, efeitos, som, repetição

   Desenho dos blocos: um InstancedMesh por (forma × material) com textura
   procedimental em mapeamento triplanar no espaço LOCAL do bloco (os tijolos
   ficam à escala certa em qualquer tamanho e não "escorregam" quando o bloco
   se mexe). Os pedaços partidos são todos escritos numa geometria dinâmica
   por material a cada frame (posições/normais transformadas no CPU) e usam o
   mesmo shader, com as faces do corte a cor de "interior" do material.
══════════════════════════════════════════════════════════════════ */
const DemolitionGame = (function () {
  'use strict';
  const ID = 'demolition';
  const U = ArcadeKit.U;
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const LV = () => DemoLevels.LEVELS;
  const CH = () => DemoSim.CHARGES;

  /* ── progresso ── */
  const SKEY = 'demo:save';
  function save() { try { return Object.assign({ s: {}, c: {} }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { s: {}, c: {} }; } }
  function putSave(v) { try { localStorage.setItem(SKEY, JSON.stringify(v)); } catch (e) {} }
  const unlocked = (sv, i) => i === 0 || (sv.s[LV()[i - 1].id] || 0) > 0;

  /* ── física (Rapier, carregado a pedido) ── */
  const RSRC = 'js/vendor/rapier3d.min.js';
  let _rp = null;
  function loadPhysics() {
    if (_rp) return _rp;
    _rp = new Promise((res, rej) => {
      const go = () => window.RAPIER.init().then(() => res(window.RAPIER), rej);
      if (window.RAPIER) return go();
      const s = Object.assign(document.createElement('script'), { src: RSRC });
      s.onload = go; s.onerror = () => { _rp = null; rej(new Error('rapier')); };
      document.head.appendChild(s);
    });
    return _rp;
  }

  /* ════════════════════════════════════════════════════════════════
     texturas procedimentais (canvas) — alfa = máscara de pintura (tint)
  ════════════════════════════════════════════════════════════════ */
  const _tex = {};
  function hash(n) { n = Math.imul(n ^ 0x27d4eb2d, 0x165667b1); n ^= n >>> 15; return ((Math.imul(n, 0x2c1b3c6d) >>> 0) % 10000) / 10000; }
  function canvasTex(key, size, draw, o) {
    if (_tex[key]) return _tex[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); draw(x, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (o && o.noMip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
    return (_tex[key] = t);
  }
  /* grão: ruído por pixel aplicado por cima */
  function grain(x, s, amt, seed) {
    const d = x.getImageData(0, 0, s, s), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const n = (hash(i + seed) - .5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
    x.putImageData(d, 0, 0);
  }
  function blotches(x, s, n, col, rmin, rmax, seed, a) {
    for (let i = 0; i < n; i++) {
      const cx = hash(seed + i * 3) * s, cy = hash(seed + i * 3 + 1) * s, r = rmin + hash(seed + i * 3 + 2) * (rmax - rmin);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
      x.fillStyle = g;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.save(); x.translate(ox, oy); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); }
    }
  }
  /* cada textura cobre `m` metros (uScl = 1/m no shader) */
  const TEX = {
    brick: { m: 2, draw(x, s) {
      x.fillStyle = '#b9b2a6'; x.fillRect(0, 0, s, s);
      const rows = 26, bh = s / rows, bw = s / 8;
      for (let r = 0; r < rows; r++) for (let k = -1; k < 9; k++) {
        const ox = r % 2 ? bw / 2 : 0, h = hash(r * 31 + k * 7 + 3);
        const L = 34 + h * 12, sat = 48 + hash(r * 13 + k) * 18, hue = 8 + hash(r * 5 + k * 11) * 16;
        x.fillStyle = `hsl(${hue},${sat}%,${h < .08 ? L - 14 : L}%)`;
        x.fillRect(k * bw + ox + 2, r * bh + 2, bw - 4, bh - 4);
        x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(k * bw + ox + 2, r * bh + 2, bw - 4, 2);
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(k * bw + ox + 2, r * bh + bh - 4, bw - 4, 2);
      }
      grain(x, s, 26, 11); blotches(x, s, 10, 'rgba(40,30,20,A)', 30, 90, 5, .12);
    } },
    concrete: { m: 2.4, draw(x, s) {
      x.fillStyle = '#a7a59e'; x.fillRect(0, 0, s, s);
      blotches(x, s, 40, 'rgba(120,118,110,A)', 10, 60, 2, .35); blotches(x, s, 25, 'rgba(200,198,190,A)', 10, 50, 9, .3);
      x.strokeStyle = 'rgba(70,68,62,.35)'; x.lineWidth = 2;
      [0, s / 2].forEach(v => { x.beginPath(); x.moveTo(0, v + 1); x.lineTo(s, v + 1); x.stroke(); x.beginPath(); x.moveTo(v + 1, 0); x.lineTo(v + 1, s); x.stroke(); });
      x.fillStyle = 'rgba(60,58,52,.5)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(s / 8 + i * s / 4, s / 8 + j * s / 4, 3, 0, 7); x.fill(); }
      for (let i = 0; i < 14; i++) { const cx = hash(i + 77) * s; const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(60,55,45,.18)'); g.addColorStop(1, 'rgba(60,55,45,0)'); x.fillStyle = g; x.fillRect(cx, hash(i + 5) * s * .5, 3 + hash(i) * 6, s * .5); }
      grain(x, s, 22, 3);
    } },
    /* fachada: reboco pintável (alfa 1) com janela no centro do bloco (alfa 0 = não pinta) */
    facade: { m: 3, center: true, draw(x, s) { facadeDraw(x, s, { ww: .44, wh: .48, cy: .52, shutters: false, frame: '#e8e6e0' }); } },
    plaster: { m: 2.6, center: true, draw(x, s) { facadeDraw(x, s, { ww: .36, wh: .42, cy: .5, shutters: true, frame: '#f7f4ec' }); } },
    wood: { m: 1.6, draw(x, s) {
      const n = 8, w = s / n;
      for (let k = 0; k < n; k++) {
        const L = 38 + hash(k * 3) * 14;
        x.fillStyle = `hsl(28,45%,${L}%)`; x.fillRect(k * w, 0, w, s);
        x.strokeStyle = `hsla(25,50%,${L - 14}%,.5)`; x.lineWidth = 1.2;
        for (let g = 0; g < 7; g++) { x.beginPath(); const ox = k * w + 4 + hash(k * 11 + g) * (w - 8); x.moveTo(ox, 0); for (let y = 0; y <= s; y += 16) x.lineTo(ox + Math.sin(y * .02 + g + k) * 3, y); x.stroke(); }
        x.fillStyle = 'rgba(20,10,0,.55)'; x.fillRect(k * w, 0, 2, s);
        if (hash(k + 40) < .5) { const ky = hash(k + 9) * s; x.fillStyle = 'rgba(60,30,10,.6)'; x.beginPath(); x.ellipse(k * w + w / 2, ky, 5, 9, 0, 0, 7); x.fill(); }
      }
      grain(x, s, 18, 21);
    } },
    glass: { m: 3, center: true, draw(x, s) {
      const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#9fd2e8'); g.addColorStop(.5, '#5d93b5'); g.addColorStop(1, '#a8d8ec');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(s * .1, s); x.lineTo(s * .35, 0); x.lineTo(s * .45, 0); x.lineTo(s * .2, s); x.fill();
      x.fillStyle = '#2b3440'; x.fillRect(0, 0, s, 10); x.fillRect(0, 0, 10, s); x.fillRect(s / 2 - 4, 0, 8, s);
    } },
    steel: { m: 1.5, draw(x, s) {
      x.fillStyle = '#d7d9dc'; x.fillRect(0, 0, s, s);
      blotches(x, s, 26, 'rgba(120,90,60,A)', 6, 30, 4, .25);
      x.fillStyle = 'rgba(40,40,40,.55)';
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.arc(s * (.0625 + i / 8), j ? s * .94 : s * .06, 4, 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 3; x.strokeRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${.1 + hash(i) * .2})`; x.lineWidth = 1; x.beginPath(); const a = hash(i + 3) * s, b = hash(i + 7) * s; x.moveTo(a, b); x.lineTo(a + 20, b + 6); x.stroke(); }
      grain(x, s, 14, 8);
    } },
    stone: { m: 4.8, draw(x, s) {
      x.fillStyle = '#857a68'; x.fillRect(0, 0, s, s);
      const rows = 4, rh = s / rows;
      for (let r = 0; r < rows; r++) {
        let px = r % 2 ? -s * .12 : 0;
        while (px < s) {
          const w = s * (.18 + hash(r * 17 + Math.floor(px)) * .14), L = 62 + hash(r * 7 + Math.floor(px * 3)) * 12;
          x.fillStyle = `hsl(${36 + hash(Math.floor(px) + r) * 8},${18 + hash(r + px) * 10}%,${L}%)`;
          x.fillRect(px + 3, r * rh + 3, w - 6, rh - 6);
          x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 3, r * rh + 3, w - 6, 3);
          px += w;
        }
      }
      grain(x, s, 30, 13); blotches(x, s, 14, 'rgba(60,70,40,A)', 20, 70, 31, .14);
    } },
    roof: { m: 2, draw(x, s) {
      const rows = 10, rh = s / rows, cols = 8, cw = s / cols;
      x.fillStyle = '#7a3018'; x.fillRect(0, 0, s, s);
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const L = 40 + hash(r * 9 + k) * 12;
        const g = x.createLinearGradient(k * cw, 0, k * cw + cw, 0);
        g.addColorStop(0, `hsl(14,62%,${L - 12}%)`); g.addColorStop(.5, `hsl(16,64%,${L + 6}%)`); g.addColorStop(1, `hsl(14,62%,${L - 14}%)`);
        x.fillStyle = g; x.fillRect(k * cw + 1, r * rh, cw - 2, rh - 3);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(k * cw, r * rh + rh - 4, cw, 4);
      }
      grain(x, s, 20, 17);
    } },
    metal: { m: 2, draw(x, s) {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s);
      for (let k = 0; k < 16; k++) { const g = x.createLinearGradient(k * s / 16, 0, (k + 1) * s / 16, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.35, 'rgba(255,255,255,.25)'); g.addColorStop(.7, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); x.fillStyle = g; x.fillRect(k * s / 16, 0, s / 16, s); }
      blotches(x, s, 16, 'rgba(110,60,30,A)', 8, 40, 51, .3);
      grain(x, s, 16, 23);
    } },
  };
  function facadeDraw(x, s, o) {
    x.clearRect(0, 0, s, s);
    x.fillStyle = 'rgba(236,230,218,1)'; x.fillRect(0, 0, s, s);
    blotches(x, s, 18, 'rgba(200,190,170,A)', 20, 80, 41, .35);
    grain(x, s, 12, 29);
    /* janela (centrada no bloco) */
    const ww = s * o.ww, wh = s * o.wh, wx = s / 2 - ww / 2, wy = s * o.cy - wh / 2;
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(wx - 10, wy - 10, ww + 20, wh + 26); x.restore();
    x.fillStyle = o.frame; x.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
    const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, '#9cc4dc'); g.addColorStop(.55, '#38556e'); g.addColorStop(1, '#6f97b2');
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.moveTo(wx + ww * .1, wy + wh); x.lineTo(wx + ww * .45, wy); x.lineTo(wx + ww * .6, wy); x.lineTo(wx + ww * .25, wy + wh); x.fill();
    x.fillStyle = o.frame; x.fillRect(wx + ww / 2 - 5, wy, 10, wh); x.fillRect(wx, wy + wh * .4 - 4, ww, 8);
    x.fillStyle = '#d8d2c6'; x.fillRect(wx - 16, wy + wh + 8, ww + 32, 12);
    if (o.shutters) { x.fillStyle = '#2f6b4f'; [wx - 10 - ww * .32, wx + ww + 10].forEach(sx => { x.fillRect(sx, wy - 10, ww * .32, wh + 20); x.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 9; k++) x.fillRect(sx + 3, wy - 6 + k * (wh + 12) / 9, ww * .32 - 6, 3); x.fillStyle = '#2f6b4f'; }); }
  }
  /* cor das faces de corte (interior) */
  const INNER = { brick: '#a65a3f', concrete: '#8f8c84', facade: '#bdb5a6', plaster: '#cfc6b6', wood: '#c69455', glass: '#bfe3f2', steel: '#6c7178', stone: '#a89878', roof: '#a8502c', metal: '#6f6f6f' };
  const TINT = { brick: '#ffffff', concrete: '#ffffff', facade: '#e9d9bf', plaster: '#f4efe6', wood: '#ffffff', glass: '#ffffff', steel: '#8fa0b0', stone: '#ffffff', roof: '#ffffff', metal: '#b4552c' };

  /* ── material com mapeamento triplanar local + máscara de pintura + faces de corte ── */
  const _mats = {};
  function blockMat(mat) {
    if (_mats[mat]) return _mats[mat];
    const T = TEX[mat] || TEX.concrete;
    const glass = mat === 'glass';
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff', roughness: mat === 'steel' ? .42 : mat === 'metal' ? .5 : glass ? .06 : mat === 'wood' ? .78 : .88,
      metalness: mat === 'steel' ? .55 : mat === 'metal' ? .35 : glass ? .6 : 0,
      transparent: glass, opacity: glass ? .62 : 1, depthWrite: !glass, envMapIntensity: glass ? 1.6 : .8,
    });
    const tex = canvasTex('dm:' + mat, 512, T.draw);
    const uni = { uTex: { value: tex }, uScl: { value: 1 / T.m }, uOff: { value: T.center ? .5 : 0 }, uInner: { value: new THREE.Color(INNER[mat] || '#888') } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 aTint; attribute vec3 aLoc; attribute vec3 aLocN; attribute float aIn;
varying vec3 vTint; varying vec3 vLoc; varying vec3 vLocN; varying float vIn;`).replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 dmS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLoc = position * dmS; vLocN = normal; vIn = 0.;
#else
  vLoc = aLoc; vLocN = aLocN; vIn = aIn;
#endif
  vTint = aTint;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D uTex; uniform float uScl; uniform float uOff; uniform vec3 uInner;
varying vec3 vTint; varying vec3 vLoc; varying vec3 vLocN; varying float vIn;`).replace('#include <map_fragment>', `
  vec3 dmB = pow(abs(normalize(vLocN + 1e-5)), vec3(6.)); dmB /= dot(dmB, vec3(1.));
  vec3 dmP = vLoc * uScl + uOff;
  vec4 dmT = texture2D(uTex, dmP.zy) * dmB.x + texture2D(uTex, dmP.xz) * dmB.y + texture2D(uTex, dmP.xy) * dmB.z;
  vec3 dmC = mix(dmT.rgb, dmT.rgb * vTint, dmT.a);
  float dmN = fract(sin(dot(floor(vLoc * 9.), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  dmC = mix(dmC, uInner * (.78 + dmN * .34) * mix(vec3(1.), vTint, .25), vIn);
  diffuseColor.rgb *= dmC;`);
    };
    m.customProgramCacheKey = () => 'dmblk' + mat;
    return (_mats[mat] = m);
  }

  /* ── geometrias unitárias ── */
  let GEO = null;
  function geos() {
    if (GEO) return GEO;
    const box = Arcade3D.roundBox(.035);
    const cyl = new THREE.CylinderGeometry(.5, .5, 1, 22, 1);
    /* cunha unitária igual à wedgePoly do DemoSim (cumeeira em +y, comprimento em z) */
    const P = DemoSim.wedgePoly(1, 1, 1), pos = [], nrm = [];
    P.forEach(f => {
      const a = f.v[0], b = f.v[1], c = f.v[2];
      const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).normalize();
      for (let i = 1; i < f.v.length - 1; i++) [f.v[0], f.v[i], f.v[i + 1]].forEach(v => { pos.push(...v); nrm.push(n.x, n.y, n.z); });
    });
    const wedge = new THREE.BufferGeometry();
    wedge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wedge.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    [cyl, wedge].forEach(g => { g.userData.shared = true; });
    return (GEO = { box, cyl, wedge });
  }

  /* ════════════════════════════════════════════════════════════════
     partículas em "billboard" instanciado (pó, fumo, fogo, faíscas)
  ════════════════════════════════════════════════════════════════ */
  function puffTex() {
    return canvasTex('dm:puff', 128, (x, s) => {
      x.clearRect(0, 0, s, s);
      for (let i = 0; i < 26; i++) {
        const a = hash(i) * 6.28, r = hash(i + 9) * s * .26, cx = s / 2 + Math.cos(a) * r, cy = s / 2 + Math.sin(a) * r, rr = s * (.12 + hash(i + 5) * .2);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, s, s);
      }
      const d = x.getImageData(0, 0, s, s), p = d.data;
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const i = (yy * s + xx) * 4, dx = xx / s - .5, dy = yy / s - .5, f = Math.max(0, 1 - Math.hypot(dx, dy) * 2.1); p[i + 3] = Math.min(255, p[i + 3] * f * 1.6); p[i] = p[i + 1] = p[i + 2] = 255; }
      x.putImageData(d, 0, 0);
    }, { noMip: false });
  }
  function fireTex() {
    return canvasTex('dm:fire', 128, (x, s) => {
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,240,200,.9)'); g.addColorStop(.6, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    });
  }
  function billboards(scene, n, o) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const iP = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3), iS = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2), iC = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    [iP, iS, iC].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iP', iP); g.setAttribute('iS', iS); g.setAttribute('iC', iC);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: o.map }, uSun: { value: new THREE.Vector3(.4, .8, .3) } },
      vertexShader: `attribute vec3 iP; attribute vec2 iS; attribute vec4 iC; varying vec2 vUv; varying vec4 vC; varying float vL;
        uniform vec3 uSun;
        void main(){ vUv = uv; vC = iC; vec4 mv = modelViewMatrix * vec4(iP, 1.); float c = cos(iS.y), s = sin(iS.y);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iS.x;
          vL = .72 + .28 * (q.y / max(iS.x, .01) + .5);
          mv.xy += q; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vC; varying float vL;
        void main(){ vec4 t = texture2D(map, vUv); float a = t.a * vC.a; if (a < .004) discard; gl_FragColor = vec4(vC.rgb * ${o.add ? '1.' : 'vL'}, a); }`,
      transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !o.add,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = o.add ? 12 : 10;
    scene.add(mesh);
    const P = [];
    return {
      mesh, P,
      add(p) { if (P.length >= n) P.shift(); P.push(p); return p; },
      update(dt) {
        let k = 0;
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.t += dt;
          if (p.t >= p.life) { P.splice(i, 1); continue; }
          const drag = Math.exp(-(p.drag || 1.5) * dt);
          p.vx *= drag; p.vy = p.vy * drag + (p.g || 0) * dt; p.vz *= drag;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.y < p.floor) { p.y = p.floor; p.vy = Math.abs(p.vy) * .2; }
          p.rot += (p.spin || 0) * dt;
        }
        for (const p of P) {
          const u = p.t / p.life;
          const sz = p.s0 + (p.s1 - p.s0) * (1 - (1 - u) * (1 - u));
          const a = p.a * (u < p.fin ? u / p.fin : 1) * (1 - Math.pow(u, p.fout || 1.6));
          iP.array[k * 3] = p.x; iP.array[k * 3 + 1] = p.y; iP.array[k * 3 + 2] = p.z;
          iS.array[k * 2] = sz; iS.array[k * 2 + 1] = p.rot;
          let r = p.r, gg = p.gC, b = p.b;
          if (p.ramp) { const t = Math.min(1, u * p.ramp); r = 1 + (p.r - 1) * t; gg = .85 + (p.gC - .85) * t; b = .55 + (p.b - .55) * t; }
          iC.array[k * 4] = r; iC.array[k * 4 + 1] = gg; iC.array[k * 4 + 2] = b; iC.array[k * 4 + 3] = a;
          k++;
        }
        g.instanceCount = k;
        iP.needsUpdate = iS.needsUpdate = iC.needsUpdate = true;
      },
      clear() { P.length = 0; g.instanceCount = 0; },
    };
  }
  const part = (o) => Object.assign({ t: 0, life: 2, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, a: 1, fin: .08, rot: Math.random() * 6.28, spin: (Math.random() - .5) * .6, r: 1, gC: 1, b: 1, floor: .2, drag: 1.5 }, o);

  /* ════════════════════════════════════════════════════════════════
     sessão: G
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const li = Math.max(0, Math.min(LV().length - 1, parseInt(o.mode, 10) || 0));
    const L = DemoLevels.build(li);
    const G = {
      api, li, L, D: LV()[li], phase: 'load', t: 0, ok: false, sel: L.kit[L.kit.length > 1 ? 1 : 0],
      plan: [], cam: { yaw: -.75, pitch: .38, dist: 30, tx: 0, ty: 6, tz: 0, fov: 45, shx: 0, shy: 0 }, pick: null, hover: null,
      meter: 0, msg: '', msgT: 0, speed: 1, rec: null, slow: 0,
    };
    Promise.all([Arcade3D.load(), loadPhysics()]).then(([, R]) => {
      if (G.dead) return;
      try {
        G.R = R; build3D(G, api); newSim(G);
        /* só arranca com os shaders compilados (sem congelar a página: ver Arcade3D.warm) */
        Arcade3D.warm(G.r3.scene, G.r3.cam).then(() => { if (!G.dead && G.r3) { G.ok = true; G.phase = 'intro'; G.introT = 0; } });
      }
      catch (e) { console.warn('[implosão] falhou', e); G.fail3d = 'Erro: ' + (e && e.message || e); }
    }).catch(e => { G.fail3d = 'Não foi possível carregar o motor 3D/física.'; console.warn(e); });
    return G;
  }

  /* ── simulação nova (início e "tentar de novo") ── */
  function newSim(G) {
    if (G.S) { try { G.S.world.free(); } catch (e) {} }
    G.S = DemoSim.create(G.R, G.L);
    G.plan.forEach(c => { const n = G.S.addCharge(c.type, c.pid, c.lp, c.ln, c.delay); c.sid = n && n.id; });
    resetRender(G);
  }

  /* ════════════════════════════════════════════════════════════════
     cena 3D
  ════════════════════════════════════════════════════════════════ */
  function build3D(G, api) {
    const W = G.L.world;
    if (!_m) { _m = new THREE.Matrix4(); _q = new THREE.Quaternion(); _p = new THREE.Vector3(); _s = new THREE.Vector3(); _ndc = new THREE.Vector2(); }
    const r = Arcade3D.attach(api.stage);
    const { scene, sun, hemi } = Arcade3D.stdScene({ sky: W.sky[1], ground: '#5b5246', hemi: 1.05, sun: W.sun, sunI: 2.6, fillI: .45 });
    const cam = new THREE.PerspectiveCamera(45, 1, .3, 1600);
    scene.fog = new THREE.Fog(W.fog, 90, 640);
    const r3 = G.r3 = { renderer: r, scene, sun, hemi, cam, env: scene.environment, inst: {}, dyn: {}, chargeObjs: new Map(), ray: new THREE.Raycaster() };

    /* céu: esfera com gradiente + sol */
    const skyM = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(W.sky[0]) }, hor: { value: new THREE.Color(W.sky[1]) }, fogc: { value: new THREE.Color(W.fog) }, sunD: { value: new THREE.Vector3(-.35, .55, .5).normalize() }, sunC: { value: new THREE.Color(W.sun) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top, hor, fogc, sunD, sunC; varying vec3 vD;
        void main(){ float y = vD.y; vec3 c = mix(hor, top, pow(clamp(y, 0., 1.), .55)); c = mix(c, fogc, smoothstep(.06, -.04, y));
          float s = max(0., dot(vD, sunD)); c += sunC * (pow(s, 900.) * 3. + pow(s, 12.) * .25);
          gl_FragColor = vec4(c, 1.); }`,
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), skyM); sky.renderOrder = -10; scene.add(sky); r3.sky = sky;

    /* enquadrar a estrutura */
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    G.L.blocks.forEach(b => { if ((b.part || 's') !== 's') return; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.pos[k] - b.size[k] / 2); mx[k] = Math.max(mx[k], b.pos[k] + b.size[k] / 2); } });
    G.box = { mn, mx, cx: (mn[0] + mx[0]) / 2, cz: (mn[2] + mx[2]) / 2, h: mx[1], span: Math.max(mx[0] - mn[0], mx[2] - mn[2], mx[1] * .9) };
    buildGround(G);
    buildBackdrop(G);
    buildBlocks(G);
    buildLine(G);
    r3.fx = { dust: billboards(scene, 2600, { map: puffTex() }), fire: billboards(scene, 700, { map: fireTex(), add: true }) };
    r3.flash = new THREE.PointLight('#ffb25c', 0, 60, 1.6); scene.add(r3.flash);
    r3.crumbs = crumbSystem(G);
    /* realce do bloco por baixo do cursor + pré-visualização do raio */
    const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffe066', transparent: true, opacity: .9, depthTest: false }));
    hl.renderOrder = 20; hl.visible = false; scene.add(hl); r3.hl = hl;
    const rs = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#ff7a3a', transparent: true, opacity: .1, depthWrite: false }));
    rs.visible = false; rs.renderOrder = 15; scene.add(rs); r3.rs = rs;
    r3.ghost = new THREE.Group(); r3.ghost.visible = false; scene.add(r3.ghost);

    const c = G.cam;
    c.tx = G.box.cx; c.tz = G.box.cz; c.ty = Math.max(2.5, G.box.h * .42);
    c.dist = Math.max(16, G.box.span * 1.65 + 8); c.dist0 = c.dist;
    Arcade3D.sunAt(sun, c.tx, 0, c.tz, Math.max(30, G.box.span * 1.6 + 14), [-.35, .62, .5]);
  }

  function groundTex(kind) {
    return canvasTex('dm:g:' + kind, 512, (x, s) => {
      const base = { dirt: '#8a7457', grass: '#5d7e3a', asphalt: '#5b5d61', gravel: '#8b8579', sand: '#d8c08c' }[kind] || '#777';
      x.fillStyle = base; x.fillRect(0, 0, s, s);
      if (kind === 'grass') { for (let i = 0; i < 9000; i++) { x.fillStyle = `hsla(${80 + hash(i) * 30},${40 + hash(i + 1) * 20}%,${26 + hash(i + 2) * 22}%,.55)`; x.fillRect(hash(i + 3) * s, hash(i + 4) * s, 1.5, 4 + hash(i + 5) * 5); } }
      else { for (let i = 0; i < 7000; i++) { const L = hash(i) < .5 ? 'rgba(0,0,0,' : 'rgba(255,255,255,'; x.fillStyle = L + (.05 + hash(i + 1) * .12) + ')'; const r = .6 + hash(i + 2) * (kind === 'gravel' ? 3 : 1.6); x.beginPath(); x.arc(hash(i + 3) * s, hash(i + 4) * s, r, 0, 7); x.fill(); } }
      blotches(x, s, 18, 'rgba(0,0,0,A)', 30, 110, 61, .12); blotches(x, s, 12, 'rgba(255,255,255,A)', 30, 90, 71, .07);
    });
  }
  function buildGround(G) {
    const { scene } = G.r3, W = G.L.world, Lr = G.L.river;
    const t = groundTex(W.ground).clone(); t.needsUpdate = true; t.repeat.set(140, 140);
    const gm = Arcade3D.noTile(new THREE.MeshStandardMaterial({ map: t, roughness: .95 }), { macro: .3 });
    const mkPlane = (w, d, x, z, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gm); m.rotation.x = -Math.PI / 2; m.position.set(x, y || 0, z); m.receiveShadow = true; scene.add(m); return m; };
    if (!Lr) mkPlane(1400, 1400, 0, 0);
    else {
      /* margens + leito + água */
      const d = Lr.depth, bw = 700;
      const L1 = mkPlane(bw, 1400, Lr.x0 - bw / 2, 0), L2 = mkPlane(bw, 1400, Lr.x1 + bw / 2, 0);
      t.repeat.set(70, 140);
      const bankM = new THREE.MeshStandardMaterial({ map: groundTex('gravel'), roughness: 1, color: '#9a9080' });
      [[Lr.x0, 1], [Lr.x1, -1]].forEach(([x, s]) => { const w = new THREE.Mesh(new THREE.BoxGeometry(.6, d, 1400), bankM); w.position.set(x + s * .3 - s * .3, -d / 2, 0); w.receiveShadow = true; scene.add(w); });
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(Lr.x1 - Lr.x0, 1400), new THREE.MeshStandardMaterial({ color: '#4c4536', roughness: 1 })); bed.rotation.x = -Math.PI / 2; bed.position.set((Lr.x0 + Lr.x1) / 2, -d, 0); scene.add(bed);
      const wm = Arcade3D.water({ color: '#2f5d6a', deep: '#173a45' });
      const wa = new THREE.Mesh(new THREE.PlaneGeometry(Lr.x1 - Lr.x0, 1400), wm); wa.rotation.x = -Math.PI / 2; wa.position.set((Lr.x0 + Lr.x1) / 2, -d * .45, 0); scene.add(wa);
      G.r3.water = wm;
    }
    /* mar ao fundo (porto) */
    if (W.sea) {
      const wm = Arcade3D.water({ color: '#3b6a7a', deep: '#1c3d4a' });
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), wm); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -.6, -760); scene.add(sea);
      const quay = new THREE.Mesh(new THREE.BoxGeometry(1400, 1.2, 1.2), new THREE.MeshStandardMaterial({ map: canvasTex('dm:concrete', 512, TEX.concrete.draw), color: '#cfcac0' })); quay.position.set(0, -.6, -60); scene.add(quay);
      G.r3.sea = wm;
      /* chão acaba no cais */
      scene.children.filter(o => o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material === gm).forEach(o => { o.geometry.dispose(); o.geometry = new THREE.PlaneGeometry(1400, 760); o.position.z = 320; });
    }
    /* estaleiro: placa de gravilha/betão por baixo da estrutura */
    const B = G.L.blocks.filter(b => (b.part || 's') === 's');
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    B.forEach(b => { x0 = Math.min(x0, b.pos[0] - b.size[0] / 2); x1 = Math.max(x1, b.pos[0] + b.size[0] / 2); z0 = Math.min(z0, b.pos[2] - b.size[2] / 2); z1 = Math.max(z1, b.pos[2] + b.size[2] / 2); });
    if (!Lr) {
      const pt = groundTex(W.ground === 'asphalt' ? 'gravel' : W.ground === 'grass' ? 'dirt' : 'gravel').clone(); pt.needsUpdate = true;
      const pw = x1 - x0 + 10, pd = z1 - z0 + 10; pt.repeat.set(pw / 10, pd / 10);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshStandardMaterial({ map: pt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: '#d8d0c4' }));
      pad.rotation.x = -Math.PI / 2; pad.position.set((x0 + x1) / 2, .01, (z0 + z1) / 2); pad.receiveShadow = true; scene.add(pad);
      /* vedação de obra à volta (com abertura para a câmara) */
      const fence = new THREE.MeshStandardMaterial({ color: '#e8eef2', metalness: .6, roughness: .35 });
      const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, 2, .06), fence, 200); let k = 0;
      const net = canvasTex('dm:net', 128, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = 'rgba(230,236,240,.85)'; x.lineWidth = 2; for (let i = -s; i < s * 2; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s, s); x.stroke(); x.beginPath(); x.moveTo(i + s, 0); x.lineTo(i, s); x.stroke(); } });
      const nm = new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .5, metalness: .4 });
      const dummy = new THREE.Object3D();
      const fx0 = x0 - 8, fx1 = x1 + 8, fz0 = z0 - 8, fz1 = z1 + 8;
      const side = (ax, az, bx, bz) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.5));
        for (let i = 0; i <= n && k < 200; i++) { dummy.position.set(ax + (bx - ax) * i / n, 1, az + (bz - az) * i / n); dummy.updateMatrix(); fm.setMatrixAt(k++, dummy.matrix); }
        const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.8), nm); net.repeat && (p.material.map.repeat.set(len / 1, 1.8)); p.position.set((ax + bx) / 2, 1, (az + bz) / 2); p.rotation.y = -Math.atan2(bz - az, bx - ax); scene.add(p);
      };
      if (!G.L.noFence) { side(fx0, fz0, fx1, fz0); side(fx0, fz0, fx0, fz1); side(fx1, fz0, fx1, fz1); }
      fm.count = k; fm.castShadow = true; scene.add(fm);
    }
    /* cenário do nível (árvores, cones, barreiras) */
    G.L.deco.forEach(d => decoObj(G, d));
  }

  /* árvores/palmeiras/cones/barreiras simples mas bonitos */
  function decoObj(G, d) {
    const { scene } = G.r3;
    const grp = new THREE.Group(); grp.position.set(d.x, 0, d.z); scene.add(grp);
    const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
    if (d.kind === 'tree') {
      const tr = sh(new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: .9 }))); tr.position.y = 1.3; grp.add(tr);
      const lm = new THREE.MeshStandardMaterial({ color: '#4f7a34', roughness: .85, flatShading: true });
      [[0, 3.4, 0, 1.9], [.9, 3, .3, 1.3], [-.8, 3.1, -.4, 1.4], [.1, 4.3, -.2, 1.3]].forEach(([x, y, z, r]) => { const b = sh(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lm)); b.position.set(x, y, z); grp.add(b); });
    } else if (d.kind === 'palm') {
      const tm = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: .9 });
      for (let i = 0; i < 9; i++) { const s = sh(new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, .7, 7), tm)); s.position.set(i * .05, .35 + i * .66, 0); s.rotation.z = -i * .02; grp.add(s); }
      const lm = new THREE.MeshStandardMaterial({ color: '#3f7f2e', roughness: .8, side: THREE.DoubleSide });
      for (let i = 0; i < 8; i++) { const l = sh(new THREE.Mesh(new THREE.PlaneGeometry(.7, 3.2), lm)); l.position.set(.45, 6, 0); l.rotation.set(1.1, i / 8 * 6.28, 0, 'YXZ'); l.translateY(1.4); grp.add(l); }
    } else if (d.kind === 'cones') {
      const cm = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: .6 }), wm = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: .6 });
      for (let i = 0; i < 4; i++) { const c = sh(new THREE.Mesh(new THREE.ConeGeometry(.22, .7, 12), cm)); c.position.set(i * 1.3, .35, (i % 2) * .4); grp.add(c); const b = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, .12, 12), wm); b.position.set(i * 1.3, .45, (i % 2) * .4); grp.add(b); }
    } else if (d.kind === 'barrier') {
      const t = canvasTex('dm:barrier', 128, (x, s) => { for (let i = -4; i < 8; i++) { x.fillStyle = i % 2 ? '#d62828' : '#f8f8f8'; x.beginPath(); x.moveTo(i * 24, 0); x.lineTo(i * 24 + 24, 0); x.lineTo(i * 24 + 24 + s, s); x.lineTo(i * 24 + s, s); x.fill(); } });
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: .6 });
      for (let i = 0; i < 3; i++) { const b = sh(new THREE.Mesh(new THREE.BoxGeometry(2, .5, .12), m)); b.position.set(i * 2.2, .8, 0); grp.add(b); [-.9, .9].forEach(o => { const l = sh(new THREE.Mesh(new THREE.BoxGeometry(.08, 1, .5), new THREE.MeshStandardMaterial({ color: '#555' }))); l.position.set(i * 2.2 + o, .5, 0); grp.add(l); }); }
    }
  }

  /* fundo: cidade/colinas ao longe (instanciado), por mundo */
  function buildBackdrop(G) {
    const { scene } = G.r3, W = G.L.world;
    const rnd = DemoSim.rng(91 + G.li);
    /* fachada ao longe: 8 janelas × 16 pisos por "azulejo" (16 m × 51 m, escala do shader abaixo) */
    const cityTex = canvasTex('dm:city', 256, (x, s) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s);
      for (let r = 0; r < 16; r++) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, r * 16 + 14, s, 2); for (let k = 0; k < 8; k++) { const h = hash(r * 8 + k); x.fillStyle = h < .18 ? '#f3dfa6' : h < .3 ? '#8aa0b4' : '#3e4a58'; x.fillRect(k * 32 + 7, r * 16 + 3, 18, 9); } }
    });
    const n = W.id === 'centro' ? 150 : W.id === 'ruinas' ? 0 : 90;
    if (n) {
      const m = new THREE.MeshStandardMaterial({ map: cityTex, roughness: .8 });
      /* janelas à escala do prédio (a textura repete-se pelo tamanho de cada instância) */
      m.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
  vec3 cS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  float cW = abs(normal.x) > .5 ? cS.z : cS.x, cH = abs(normal.y) > .5 ? cS.z : cS.y;
  vMapUv = uv * vec2(cW / 16., cH / 51.) * (abs(normal.y) > .5 ? 0. : 1.);`);
      };
      m.customProgramCacheKey = () => 'dmcity';
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m, n), d = new THREE.Object3D(), col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.28, R = 190 + rnd() * 190;
        if (W.sea && Math.sin(a) < -.2) { i--; continue; }
        const h = W.id === 'centro' ? 18 + rnd() * rnd() * 110 : 8 + rnd() * 26;
        d.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R * (W.sea ? 1 : 1)); d.scale.set(14 + rnd() * 20, h, 14 + rnd() * 20); d.rotation.y = rnd() * 3; d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        if (rnd() < .3) col.setHSL(.56 + rnd() * .06, .18 + rnd() * .15, .42 + rnd() * .15); else col.setHSL(.06 + rnd() * .08, .1 + rnd() * .18, .48 + rnd() * .26);
        im.setColorAt(i, col);
      }
      scene.add(im);
    }
    /* colinas suaves */
    const hm = new THREE.MeshStandardMaterial({ color: W.ground === 'sand' ? '#c9a878' : '#6f8752', roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = rnd() * 6.28; if (W.sea && Math.sin(a) < 0) continue;
      const R = 420 + rnd() * 240, h = 40 + rnd() * 90;
      const c = new THREE.Mesh(new THREE.ConeGeometry(110 + rnd() * 140, h, 9, 1), hm); c.position.set(Math.cos(a) * R, h / 2 - 4, Math.sin(a) * R); scene.add(c);
    }
    /* árvores à volta (instanciadas): tronco + duas copas */
    const nt = W.id === 'centro' ? 30 : 80;
    const leafC = W.ground === 'sand' ? '#7c8a3a' : '#456b2e';
    const tr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: leafC, flatShading: true, roughness: .9 }), nt * 2);
    const tk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .2, 1, 6), new THREE.MeshStandardMaterial({ color: '#5e4430', roughness: .95 }), nt);
    const d = new THREE.Object3D(), col = new THREE.Color(); let k = 0, kk = 0;
    for (let i = 0; i < nt; i++) {
      const a = rnd() * 6.28, R = 45 + rnd() * 90; const x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (W.sea && z < -40) continue; if (G.L.river && x > G.L.river.x0 - 4 && x < G.L.river.x1 + 4) continue;
      const s = 1.4 + rnd() * 2, th = s * 1.3;
      d.position.set(x, th / 2, z); d.scale.set(s, th, s); d.rotation.set(0, 0, 0); d.updateMatrix(); tk.setMatrixAt(kk++, d.matrix);
      d.position.set(x, th + s * .9, z); d.scale.set(s, s * 1.25, s); d.rotation.y = rnd() * 3; d.updateMatrix(); tr.setMatrixAt(k, d.matrix); col.set(leafC).offsetHSL((rnd() - .5) * .04, 0, (rnd() - .5) * .08); tr.setColorAt(k++, col);
      d.position.set(x + s * .35, th + s * 1.7, z - s * .2); d.scale.set(s * .7, s * .85, s * .7); d.updateMatrix(); tr.setMatrixAt(k, d.matrix); tr.setColorAt(k++, col);
    }
    tr.count = k; tk.count = kk; tr.castShadow = tk.castShadow = true; scene.add(tr, tk);
  }

  /* ── linha alvo: moldura vermelha à altura da linha + régua ── */
  function buildLine(G) {
    const { scene } = G.r3, b = G.box, y = G.L.line;
    const grp = new THREE.Group(); scene.add(grp); G.r3.line = grp;
    const pad = 2.2, x0 = b.mn[0] - pad, x1 = b.mx[0] + pad, z0 = b.mn[2] - pad, z1 = b.mx[2] + pad;
    const stripe = canvasTex('dm:stripe', 128, (x, s) => { x.clearRect(0, 0, s, s); for (let i = -s; i < s * 2; i += 32) { x.fillStyle = 'rgba(255,60,60,.9)'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 16, 0); x.lineTo(i + 16 - s, s); x.lineTo(i - s, s); x.fill(); } });
    const fm = new THREE.MeshBasicMaterial({ map: stripe, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), fm); fill.rotation.x = -Math.PI / 2; fill.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    stripe.repeat.set((x1 - x0) / 3, (z1 - z0) / 3); fill.renderOrder = 8; grp.add(fill);
    const em = new THREE.MeshBasicMaterial({ color: '#ff3b3b', toneMapped: false, transparent: true, opacity: .95 });
    const bar = (len, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, .09, .09), em); m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); };
    bar(x1 - x0, (x0 + x1) / 2, z0, 0); bar(x1 - x0, (x0 + x1) / 2, z1, 0); bar(z1 - z0, x0, (z0 + z1) / 2, Math.PI / 2); bar(z1 - z0, x1, (z0 + z1) / 2, Math.PI / 2);
    /* postes nos cantos com a altura */
    const pm = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: .5 });
    [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, y, 6), pm); p.position.set(x, y / 2, z); p.castShadow = true; grp.add(p); });
    const lbl = canvasTex('dm:linelbl:' + y, 256, (x, s) => { x.clearRect(0, 0, s, s); U.rr(x, 6, s * .34, s - 12, s * .32, 16); x.fillStyle = 'rgba(200,30,30,.92)'; x.fill(); x.fillStyle = '#fff'; x.font = `800 ${s * .15}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LINHA ' + String(y).replace('.', ',') + ' m', s / 2, s / 2 + 2); }, { noMip: true });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lbl, depthTest: false, transparent: true, toneMapped: false, sizeAttenuation: false })); sp.scale.set(.16, .16, 1); sp.center.set(.5, .2); sp.position.set(x0, y, z1); sp.renderOrder = 21; grp.add(sp);
    G.r3.lineM = [fm, em];
  }

  /* ── blocos instanciados ── */
  function buildBlocks(G) {
    const { scene } = G.r3, gs = geos();
    const by = {};
    G.L.blocks.forEach((b, i) => {
      if (b.car) return;
      const k = (b.shape || 'box') + '|' + b.mat;
      (by[k] = by[k] || []).push(i);
    });
    G.slot = new Array(G.L.blocks.length);
    Object.keys(by).forEach(k => {
      const [shape, mat] = k.split('|'), ids = by[k];
      const im = new THREE.InstancedMesh(gs[shape], blockMat(mat), ids.length);
      const tint = new Float32Array(ids.length * 3), c = new THREE.Color();
      ids.forEach((id, j) => { const b = G.L.blocks[id]; c.set(b.tint || TINT[mat] || '#ffffff'); if (!b.tint && (mat === 'facade' || mat === 'plaster')) c.offsetHSL(0, 0, (hash(id) - .5) * .06); tint[j * 3] = c.r; tint[j * 3 + 1] = c.g; tint[j * 3 + 2] = c.b; G.slot[id] = { im, j }; });
      im.geometry = im.geometry.clone(); im.geometry.userData.shared = false;
      im.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.userData.ids = ids;
      scene.add(im);
      G.r3.inst[k] = im;
    });
    /* carros protegidos: modelo partilhado */
    G.cars = [];
    G.L.blocks.forEach((b, i) => {
      if (!b.car) return;
      const len = Math.max(b.size[0], b.size[2]);
      const m = Arcade3D.car({ type: b.car, color: b.tint, len: len * 1.02 });
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      if (b.size[2] > b.size[0]) m.userData.rotY = Math.PI / 2; else m.userData.rotY = 0;
      G.r3.scene.add(m); G.cars.push({ id: i, m, hy: b.size[1] / 2 });
    });
    /* escudos sobre os protegidos */
    const groups = new Map();
    G.L.blocks.forEach((b, i) => { if (b.part !== 'p') return; const g = b.grp != null ? b.grp : 'p' + i; const e = groups.get(g) || { ids: [], top: -1e9, x: 0, z: 0, n: 0 }; e.ids.push(i); e.top = Math.max(e.top, b.pos[1] + b.size[1] / 2); e.x += b.pos[0]; e.z += b.pos[2]; e.n++; groups.set(g, e); });
    G.shields = [];
    groups.forEach((e, g) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: shieldTex(false), depthTest: false, transparent: true, toneMapped: false }));
      sp.scale.set(1.6, 1.6, 1); sp.position.set(e.x / e.n, e.top + 1.4, e.z / e.n); sp.renderOrder = 22; G.r3.scene.add(sp);
      G.shields.push({ g, sp, ids: e.ids, y: e.top + 1.4 });
    });
  }
  function shieldTex(bad) {
    return canvasTex('dm:shield' + (bad ? 'x' : ''), 128, (x, s) => {
      x.clearRect(0, 0, s, s);
      x.beginPath(); x.moveTo(s / 2, s * .1); x.lineTo(s * .85, s * .24); x.quadraticCurveTo(s * .85, s * .7, s / 2, s * .92); x.quadraticCurveTo(s * .15, s * .7, s * .15, s * .24); x.closePath();
      x.fillStyle = bad ? '#e53935' : '#22c55e'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#fff'; x.stroke();
      x.strokeStyle = '#fff'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath();
      if (bad) { x.moveTo(s * .36, s * .36); x.lineTo(s * .64, s * .64); x.moveTo(s * .64, s * .36); x.lineTo(s * .36, s * .64); }
      else { x.moveTo(s * .34, s * .5); x.lineTo(s * .46, s * .62); x.lineTo(s * .67, s * .38); }
      x.stroke();
    }, { noMip: true });
  }

  /* ── migalhas: pedrinhas/estilhaços sem física a sério (só gravidade e chão) ── */
  function crumbSystem(G) {
    const { scene } = G.r3, N = 1600;
    const geo = new THREE.IcosahedronGeometry(.5, 0);
    const m = new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true });
    const im = new THREE.InstancedMesh(geo, m, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.castShadow = true; im.frustumCulled = false; scene.add(im);
    /* cor por instância criada já: se só aparecer no 1.º destroço, o shader muda e o jogo para ~0,1 s */
    im.setColorAt(0, new THREE.Color(1, 1, 1));
    const gm = new THREE.MeshStandardMaterial({ color: '#cfefff', roughness: .05, metalness: .8, transparent: true, opacity: .75, envMapIntensity: 2 });
    const gi = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.5), gm, 900); gi.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gi.count = 0; gi.frustumCulled = false; scene.add(gi);
    const P = [], Q = [], d = new THREE.Object3D(), col = new THREE.Color();
    const sys = {
      add(o, glass) { const L = glass ? Q : P; if (L.length >= (glass ? 900 : N)) L.shift(); L.push(o); },
      update(dt, ground) {
        [[P, im], [Q, gi]].forEach(([L, mesh]) => {
          let k = 0;
          for (const p of L) {
            if (!p.rest) {
              p.vy -= 9.81 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.wx * dt; p.ry += p.wy * dt;
              const gy = ground(p.x, p.z) + p.s * .35;
              if (p.y < gy) { p.y = gy; p.vy = -p.vy * .3; p.vx *= .55; p.vz *= .55; p.wx *= .5; p.wy *= .5; if (Math.abs(p.vy) < .6 && Math.hypot(p.vx, p.vz) < .4) p.rest = 1; }
            }
            d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx, p.ry, 0); d.scale.set(p.s, p.s * (p.flat || .8), p.s); d.updateMatrix();
            mesh.setMatrixAt(k, d.matrix); if (mesh === im) { col.set(p.c); mesh.setColorAt(k, col); }
            k++;
          }
          mesh.count = k; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        });
      },
      clear() { P.length = 0; Q.length = 0; im.count = 0; gi.count = 0; },
    };
    return sys;
  }

  /* ════════════════════════════════════════════════════════════════
     pedaços partidos: geometria dinâmica por material
  ════════════════════════════════════════════════════════════════ */
  function chunkGeo(p) {
    if (p.geo) return p.geo;
    const pos = [], nrm = [], loc = [];
    const inn = [];
    p.poly.forEach(f => {
      const a = f.v[0], b = f.v[1], c = f.v[2];
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (let i = 1; i < f.v.length - 1; i++) [f.v[0], f.v[i], f.v[i + 1]].forEach(v => {
        pos.push(v[0] - p.c[0], v[1] - p.c[1], v[2] - p.c[2]); nrm.push(nx, ny, nz); loc.push(v[0], v[1], v[2]); inn.push(f.inner ? 1 : 0);
      });
    });
    return (p.geo = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), loc: new Float32Array(loc), inn: new Float32Array(inn), n: pos.length / 3 });
  }
  function dynMesh(G, mat) {
    let d = G.r3.dyn[mat];
    if (d) return d;
    const cap = 90000;
    const g = new THREE.BufferGeometry();
    const A = (n, k) => { const a = new THREE.BufferAttribute(new Float32Array(n * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', A(cap, 3)); g.setAttribute('normal', A(cap, 3)); g.setAttribute('aLoc', A(cap, 3)); g.setAttribute('aLocN', A(cap, 3)); g.setAttribute('aIn', A(cap, 1)); g.setAttribute('aTint', A(cap, 3));
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, blockMat(mat)); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    G.r3.scene.add(m);
    return (G.r3.dyn[mat] = { m, g, cap, list: [] });
  }

  /* repor o desenho (nível novo ou "tentar de novo") */
  function resetRender(G) {
    const r3 = G.r3; if (!r3) return;
    Object.values(r3.dyn).forEach(d => { d.list = []; d.g.setDrawRange(0, 0); });
    r3.fx.dust.clear(); r3.fx.fire.clear(); r3.crumbs.clear();
    G.chunks = [];
    syncBlocks(G, true);
    syncCharges(G);
    G.shields.forEach(s => { s.bad = false; s.sp.material.map = shieldTex(false); });
    G.r3.lineM[1].color.set('#ff3b3b');
  }

  /* temporários (o THREE só existe depois do load: nada de `new THREE` ao nível do módulo) */
  let _m, _q, _p, _s, _ndc;
  /* transformação de uma peça: corpo vivo ou quadro da repetição */
  function xf(G, p) {
    if (G.replay) { const f = G.replay.cur; const k = f && f.map.get(p.id); if (k == null) return null; const a = f.tr; return { x: a[k], y: a[k + 1], z: a[k + 2], qx: a[k + 3], qy: a[k + 4], qz: a[k + 5], qw: a[k + 6] }; }
    if (!p.alive || !p.body) return null;
    const t = p.body.translation(), q = p.body.rotation();
    return { x: t.x, y: t.y, z: t.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
  }
  function syncBlocks(G, force) {
    const S = G.S; if (!S) return;
    const touched = new Set();
    for (let i = 0; i < G.L.blocks.length; i++) {
      const p = S.pieces[i], sl = G.slot[i];
      const t = xf(G, p);
      if (sl) {
        if (!t) { if (!sl.hidden || force) { _m.makeScale(0, 0, 0); sl.im.setMatrixAt(sl.j, _m); sl.hidden = true; touched.add(sl.im); } continue; }
        if (!force && !G.replay && p.body.isSleeping() && sl.done) continue;
        sl.hidden = false; sl.done = p.body && p.body.isSleeping();
        const b = G.L.blocks[i];
        _p.set(t.x, t.y, t.z); _q.set(t.qx, t.qy, t.qz, t.qw); _s.set(b.size[0], b.size[1], (b.shape === 'cyl' ? b.size[0] : b.size[2]));
        _m.compose(_p, _q, _s); sl.im.setMatrixAt(sl.j, _m); touched.add(sl.im);
      }
    }
    touched.forEach(im => { im.instanceMatrix.needsUpdate = true; });
    G.cars.forEach(c => {
      const t = xf(G, S.pieces[c.id]); if (!t) { c.m.visible = false; return; }
      c.m.visible = true; c.m.position.set(t.x, t.y - c.hy, t.z); c.m.quaternion.set(t.qx, t.qy, t.qz, t.qw);
      if (c.m.userData.rotY) c.m.rotateY(c.m.userData.rotY);
    });
  }
  function syncChunks(G) {
    const r3 = G.r3, S = G.S;
    Object.values(r3.dyn).forEach(d => { d.n = 0; });
    const col = new THREE.Color();
    for (const p of G.chunks) {
      const t = xf(G, p); if (!t) continue;
      const d = dynMesh(G, p.mat), gg = chunkGeo(p);
      if (d.n + gg.n > d.cap) continue;
      const P = d.g.attributes.position.array, N = d.g.attributes.normal.array, Lc = d.g.attributes.aLoc.array, LN = d.g.attributes.aLocN.array, I = d.g.attributes.aIn.array, T = d.g.attributes.aTint.array;
      const qx = t.qx, qy = t.qy, qz = t.qz, qw = t.qw;
      /* matriz de rotação do quaternião */
      const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
      const m00 = 1 - 2 * (yy + zz), m01 = 2 * (xy - wz), m02 = 2 * (xz + wy), m10 = 2 * (xy + wz), m11 = 1 - 2 * (xx + zz), m12 = 2 * (yz - wx), m20 = 2 * (xz - wy), m21 = 2 * (yz + wx), m22 = 1 - 2 * (xx + yy);
      if (!p.tc) { col.set(p.tint || TINT[p.mat] || '#fff'); p.tc = [col.r, col.g, col.b]; }
      let o = d.n * 3;
      for (let v = 0; v < gg.n; v++, o += 3) {
        const a = gg.pos[v * 3], b = gg.pos[v * 3 + 1], c = gg.pos[v * 3 + 2];
        P[o] = t.x + m00 * a + m01 * b + m02 * c; P[o + 1] = t.y + m10 * a + m11 * b + m12 * c; P[o + 2] = t.z + m20 * a + m21 * b + m22 * c;
        const na = gg.nrm[v * 3], nb = gg.nrm[v * 3 + 1], nc = gg.nrm[v * 3 + 2];
        N[o] = m00 * na + m01 * nb + m02 * nc; N[o + 1] = m10 * na + m11 * nb + m12 * nc; N[o + 2] = m20 * na + m21 * nb + m22 * nc;
        Lc[o] = gg.loc[v * 3]; Lc[o + 1] = gg.loc[v * 3 + 1]; Lc[o + 2] = gg.loc[v * 3 + 2];
        LN[o] = na; LN[o + 1] = nb; LN[o + 2] = nc;
        T[o] = p.tc[0]; T[o + 1] = p.tc[1]; T[o + 2] = p.tc[2];
        I[d.n + v] = gg.inn[v];
      }
      d.n += gg.n;
    }
    Object.values(r3.dyn).forEach(d => {
      d.g.setDrawRange(0, d.n);
      ['position', 'normal', 'aLoc', 'aLocN', 'aIn', 'aTint'].forEach(k => { const a = d.g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges ? (a.clearUpdateRanges(), a.addUpdateRange(0, d.n * a.itemSize)) : (a.updateRange.count = d.n * a.itemSize); });
    });
  }

  /* ── modelos das cargas (costas na superfície, frente = +z = normal) ── */
  const _cm = {};
  const cmat = (k, o) => _cm[k] || (_cm[k] = new THREE.MeshStandardMaterial(Object.assign({ roughness: .55 }, o)));
  function chargeModel(type) {
    const g = new THREE.Group(), add = (geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; g.add(o); return o; };
    const red = cmat('red', { color: '#c62828' }), tape = cmat('tape', { color: '#1b1b1b', roughness: .8 }), box = cmat('box', { color: '#2f3440', metalness: .3 });
    if (type === 'pet') {
      add(new THREE.CylinderGeometry(.06, .06, .32, 12), red, 0, 0, .07, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(.008, .008, .12, 5), tape, .2, .02, .07, 0, 0, 1.2);
    } else if (type === 'din') {
      [[-.07, 0], [.07, 0], [0, .11]].forEach(([x, y]) => add(new THREE.CylinderGeometry(.065, .065, .42, 12), red, 0, x, .08 + y * .7, 0, 0, Math.PI / 2));
      add(new THREE.CylinderGeometry(.11, .11, .06, 14), tape, -.09, 0, .1, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(.11, .11, .06, 14), tape, .09, 0, .1, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(.14, .1, .06), box, 0, -.02, .22);
    } else if (type === 'cut') {
      const y = cmat('cutY', { color: '#f5c518', roughness: .5 });
      add(new THREE.BoxGeometry(.56, .1, .08), cmat('cutG', { color: '#5c6470', metalness: .5, roughness: .4 }), 0, 0, .04);
      for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.05, .102, .082), i % 2 ? tape : y, -.22 + i * .11, 0, .04);
    } else if (type === 'imp') {
      const b = cmat('imp', { color: '#1d6fd6', metalness: .4, roughness: .35 });
      add(new THREE.CylinderGeometry(.13, .13, .36, 16), b, 0, 0, .22, Math.PI / 2);
      add(new THREE.ConeGeometry(.13, .14, 16), cmat('impC', { color: '#cfd8e3', metalness: .7 }), 0, 0, .02, -Math.PI / 2);
      add(new THREE.TorusGeometry(.13, .02, 6, 16), cmat('impR', { color: '#f5f5f5' }), 0, 0, .3);
    } else if (type === 'tnt') {
      const lbl = canvasTex('dm:tnt', 128, (x, s) => { x.fillStyle = '#c0261f'; x.fillRect(0, 0, s, s); x.fillStyle = '#1a1a1a'; x.fillRect(0, s * .12, s, s * .1); x.fillRect(0, s * .78, s, s * .1); x.fillStyle = '#fff'; x.font = `900 ${s * .3}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TNT', s / 2, s / 2); });
      const bm = new THREE.MeshStandardMaterial({ map: lbl, roughness: .5, metalness: .2 });
      add(new THREE.CylinderGeometry(.32, .32, .8, 22), bm, 0, 0, .34);
      [-.32, .32].forEach(y => add(new THREE.TorusGeometry(.325, .025, 6, 22), tape, 0, y, .34, Math.PI / 2));
    }
    /* LED a piscar */
    const led = new THREE.Sprite(Arcade3D.glowSprite('#ff3030')); led.scale.setScalar(.22); led.position.set(0, .12, type === 'tnt' ? .7 : .2); g.add(led); g.userData.led = led;
    return g;
  }
  function timerTex(d) {
    return canvasTex('dm:tm:' + d, 128, (x, s) => { x.clearRect(0, 0, s, s); U.rr(x, 10, 34, s - 20, 60, 16); x.fillStyle = 'rgba(15,18,28,.88)'; x.fill(); x.strokeStyle = '#ffd24a'; x.lineWidth = 4; x.stroke(); x.fillStyle = '#ffd24a'; x.font = `800 40px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+' + String(d).replace('.', ',') + 's', s / 2, 66); }, { noMip: true });
  }
  /* põe/atualiza os modelos das cargas planeadas */
  function syncCharges(G) {
    const r3 = G.r3, S = G.S, live = new Set();
    S.charges.forEach(c => {
      if (c.done) return;
      live.add(c.id);
      let o = r3.chargeObjs.get(c.id);
      if (!o || o.userData.type !== c.type) {
        if (o) r3.scene.remove(o);
        o = chargeModel(c.type); o.userData.type = c.type; r3.scene.add(o); r3.chargeObjs.set(c.id, o);
        o.userData.pop = 0;
      }
      S.chargeWorld(c);
      if (!c.wp) return;
      o.position.set(c.wp.x, c.wp.y, c.wp.z);
      _p.set(c.wn.x, c.wn.y, c.wn.z);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _p);
      if (Math.abs(c.wn.y) < .7) { /* manter "de pé" em paredes */ const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), _p.clone().negate(), up); o.quaternion.setFromRotationMatrix(m); }
      /* temporizador */
      if (c.delay > 0) {
        if (!o.userData.tm || o.userData.tmD !== c.delay) { if (o.userData.tm) o.remove(o.userData.tm); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: timerTex(c.delay), depthTest: false, transparent: true, toneMapped: false })); sp.scale.set(.9, .9, 1); sp.position.set(0, .55, .3); sp.renderOrder = 23; o.add(sp); o.userData.tm = sp; o.userData.tmD = c.delay; }
      } else if (o.userData.tm) { o.remove(o.userData.tm); o.userData.tm = null; }
    });
    r3.chargeObjs.forEach((o, id) => { if (!live.has(id)) { r3.scene.remove(o); r3.chargeObjs.delete(id); } });
  }

  /* ════════════════════════════════════════════════════════════════
     interface (DOM por cima do palco)
  ════════════════════════════════════════════════════════════════ */
  const ICONS = {
    pet: '<svg viewBox="0 0 40 40"><rect x="6" y="16" width="26" height="9" rx="4" fill="#d32f2f"/><rect x="6" y="16" width="26" height="3" rx="1.5" fill="#ff6b6b" opacity=".6"/><path d="M32 20 q4-1 4-6" stroke="#333" stroke-width="2" fill="none"/><circle cx="36" cy="13" r="2.4" fill="#ffb300"/></svg>',
    din: '<svg viewBox="0 0 40 40"><g fill="#d32f2f"><rect x="5" y="20" width="28" height="8" rx="4"/><rect x="5" y="11" width="28" height="8" rx="4"/><rect x="5" y="29" width="28" height="8" rx="4" opacity=".0"/></g><rect x="11" y="9" width="5" height="21" fill="#1b1b1b"/><rect x="23" y="9" width="5" height="21" fill="#1b1b1b"/><rect x="14" y="2" width="12" height="7" rx="2" fill="#39404d"/><circle cx="23" cy="5.5" r="1.6" fill="#ff3d3d"/></svg>',
    cut: '<svg viewBox="0 0 40 40"><rect x="3" y="15" width="34" height="10" rx="2" fill="#5c6470"/><g fill="#f5c518"><rect x="5" y="15" width="5" height="10"/><rect x="15" y="15" width="5" height="10"/><rect x="25" y="15" width="5" height="10"/></g><path d="M8 31 l24 0" stroke="#ffd54a" stroke-width="2" stroke-dasharray="3 3"/></svg>',
    imp: '<svg viewBox="0 0 40 40"><rect x="9" y="8" width="16" height="24" rx="6" fill="#1d6fd6"/><path d="M25 14 l9 6 l-9 6z" fill="#cfd8e3"/><path d="M3 20 h6" stroke="#9ec5ff" stroke-width="3" stroke-linecap="round"/></svg>',
    tnt: '<svg viewBox="0 0 40 40"><rect x="9" y="5" width="22" height="30" rx="4" fill="#c0261f"/><rect x="9" y="9" width="22" height="3" fill="#1a1a1a"/><rect x="9" y="28" width="22" height="3" fill="#1a1a1a"/><text x="20" y="23.5" font-size="8" font-weight="900" text-anchor="middle" fill="#fff" font-family="sans-serif">TNT</text></svg>',
  };
  const DESC = { pet: 'Pequeno e preciso', din: 'Forte, apanha vizinhos', cut: 'Corta aço e pilares', imp: 'Empurra sem partir', tnt: 'Rebenta tudo à volta' };
  const fmtE = v => v.toLocaleString('pt-PT') + ' €';

  function buildUI(G, api) {
    const st = api.stage;
    if (!document.getElementById('dm-css')) {
      const s = document.createElement('style'); s.id = 'dm-css';
      s.textContent = `
.dm-ui{position:absolute;inset:0;z-index:3;pointer-events:none;font-family:${FONT};color:#fff}
.dm-goal{position:absolute;left:10px;top:60px;pointer-events:none;background:rgba(12,14,24,.62);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:9px 12px;min-width:170px;max-width:240px;font-size:.78rem;line-height:1.35}
.dm-goal b{font-size:.92rem}
.dm-goal .bar{height:7px;border-radius:9px;background:rgba(255,255,255,.14);margin-top:6px;overflow:hidden;position:relative}
.dm-goal .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:9px;background:linear-gradient(90deg,#22c55e,#a3e635);transition:width .25s}
.dm-goal .bar.cost i{background:linear-gradient(90deg,#fbbf24,#f97316)}
.dm-goal .bar u{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;opacity:.8}
.dm-goal small{display:block;color:rgba(255,255,255,.7);font-size:.68rem;margin-top:3px}
.dm-goal .stars{letter-spacing:2px;font-size:.8rem}
.dm-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;gap:8px;padding:10px;pointer-events:none;background:linear-gradient(0deg,rgba(0,0,0,.55),transparent)}
.dm-kit{display:flex;gap:6px;flex:1;overflow-x:auto;pointer-events:auto;scrollbar-width:none;padding-bottom:2px}
.dm-kit::-webkit-scrollbar{display:none}
.dm-k{flex:0 0 auto;width:86px;border:1px solid rgba(255,255,255,.16);background:rgba(14,16,26,.72);backdrop-filter:blur(6px);border-radius:14px;padding:6px 6px 7px;color:#fff;font:inherit;cursor:pointer;text-align:center;transition:transform .12s,border-color .12s,background .12s}
.dm-k:hover{transform:translateY(-2px)}
.dm-k.on{border-color:#ffb020;background:rgba(255,176,32,.2);box-shadow:0 0 0 1px #ffb020 inset}
.dm-k svg{width:34px;height:34px;display:block;margin:0 auto}
.dm-k b{display:block;font-size:.72rem;margin-top:2px;white-space:nowrap}
.dm-k small{display:block;font-size:.66rem;color:#ffd27a;font-weight:700}
.dm-go{pointer-events:auto;flex:0 0 auto;width:96px;height:96px;border-radius:50%;border:4px solid #fff3;background:radial-gradient(circle at 35% 30%,#ff6b5a,#c4121a 62%,#7d0a10);color:#fff;font:800 .82rem ${FONT};letter-spacing:.06em;cursor:pointer;box-shadow:0 8px 26px rgba(196,18,26,.55),0 0 0 6px rgba(0,0,0,.25);display:grid;place-items:center;transition:transform .12s}
.dm-go:hover{transform:scale(1.05)}
.dm-go:disabled{filter:grayscale(.8) brightness(.7);cursor:not-allowed}
.dm-go span{display:block;font-size:1.6rem;line-height:1}
.dm-side{position:absolute;right:10px;top:60px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.dm-sb{width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(12,14,24,.62);color:#fff;font-size:1.05rem;cursor:pointer;backdrop-filter:blur(6px);display:grid;place-items:center}
.dm-sb:hover{background:rgba(255,255,255,.14)}
.dm-sb.on{border-color:#ffb020;color:#ffb020}
.dm-pop{position:absolute;pointer-events:auto;transform:translate(-50%,-110%);background:rgba(14,16,26,.94);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:6px;box-shadow:0 12px 30px rgba(0,0,0,.45);min-width:200px}
.dm-pop .row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.dm-pop small{font-size:.66rem;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.08em;margin-right:4px}
.dm-pop button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;border-radius:9px;padding:5px 8px;font:700 .74rem ${FONT};cursor:pointer}
.dm-pop button.on{background:#ffb020;color:#141414;border-color:#ffb020}
.dm-pop button.del{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.6)}
.dm-msg{position:absolute;left:50%;top:18%;transform:translateX(-50%);background:rgba(12,14,24,.82);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:9px 14px;font-size:.86rem;max-width:min(440px,86%);text-align:center;pointer-events:none;transition:opacity .3s;line-height:1.35}
.dm-count{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font:900 6rem ${FONT};color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.6),0 0 40px #ff5a2a;pointer-events:none}
.dm-live{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(12,14,24,.72);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;font-size:.84rem;pointer-events:auto;display:flex;gap:12px;align-items:center;backdrop-filter:blur(6px)}
.dm-live button{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:4px 10px;font:700 .76rem ${FONT};cursor:pointer}
.dm-live button.on{background:#ffb020;color:#141414}
.dm-tut{position:absolute;pointer-events:none;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:3px solid #ffd24a;box-shadow:0 0 0 6px rgba(255,210,74,.25);animation:dmTut 1.2s ease-in-out infinite}
@keyframes dmTut{0%,100%{transform:scale(.8);opacity:.6}50%{transform:scale(1.1);opacity:1}}
@media (max-width:640px){.dm-goal small:last-child{display:none}.dm-msg{top:auto;bottom:128px;font-size:.78rem}.dm-k{width:70px;padding:5px 4px}.dm-k svg{width:28px;height:28px}.dm-k b{font-size:.64rem}.dm-go{width:78px;height:78px;font-size:.7rem}.dm-goal{top:56px;min-width:140px;font-size:.72rem;padding:7px 9px}.dm-count{font-size:4rem}}
@media (prefers-reduced-motion:reduce){.dm-tut{animation:none}}`;
      document.head.appendChild(s);
    }
    const ui = document.createElement('div'); ui.className = 'dm-ui';
    ui.innerHTML = `
      <div class="dm-goal"></div>
      <div class="dm-side">
        <button class="dm-sb" data-a="undo" title="Tirar a última carga" aria-label="Desfazer">↶</button>
        <button class="dm-sb" data-a="clear" title="Tirar todas as cargas" aria-label="Limpar cargas">🧹</button>
        <button class="dm-sb" data-a="view" title="Repor a câmara" aria-label="Repor câmara">🎥</button>
        <button class="dm-sb" data-a="hint" title="Dica" aria-label="Dica">💡</button>
      </div>
      <div class="dm-bar">
        <div class="dm-kit">${G.L.kit.map(k => `<button class="dm-k" data-k="${k}" title="${CH()[k].name} — ${DESC[k]}">${ICONS[k]}<b>${CH()[k].name}</b><small>${fmtE(CH()[k].cost)}</small></button>`).join('')}</div>
        <button class="dm-go" data-a="go" aria-label="Detonar"><div><span>💥</span>DETONAR</div></button>
      </div>
      <div class="dm-msg" style="opacity:0"></div>`;
    st.appendChild(ui);
    G.ui = ui;
    ui.addEventListener('pointerdown', e => e.stopPropagation());
    ui.addEventListener('click', e => {
      const k = e.target.closest('[data-k]');
      if (k) { G.sel = k.dataset.k; api.sfx.click(); refreshUI(G); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'go') detonate(G, api);
      else if (act === 'undo') { if (G.phase === 'plan' && G.plan.length) { const c = G.plan.pop(); G.S.removeCharge(c.sid); closePop(G); syncCharges(G); api.sfx.tone(300, .06, 'square', .05); refreshUI(G); } }
      else if (act === 'clear') { if (G.phase === 'plan') { G.plan.forEach(c => G.S.removeCharge(c.sid)); G.plan = []; closePop(G); syncCharges(G); refreshUI(G); } }
      else if (act === 'view') { const c = G.cam; c.yaw = -.75; c.pitch = .38; c.dist = c.dist0; c.ty = Math.max(2.5, G.box.h * .42); c.tx = G.box.cx; c.tz = G.box.cz; }
      else if (act === 'hint') showHint(G, api);
      else if (act === 'slow') { G.slowOn = !G.slowOn; a.classList.toggle('on', G.slowOn); }
      else if (act === 'skip') { G.fast = !G.fast; a.classList.toggle('on', G.fast); }
    });
    refreshUI(G);
  }

  function refreshUI(G) {
    if (!G.ui) return;
    const L = G.L, cost = G.S ? G.S.cost() : 0, money = L.money;
    G.ui.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === G.sel));
    const stars = cost <= L.s3 ? 3 : cost <= L.s2 ? 2 : 1;
    const pr = Math.min(1, cost / money);
    G.ui.querySelector('.dm-goal').innerHTML = `
      <b>${esc(G.D.name)}</b>
      <small>Abaixo da linha: <b style="color:#fff">${Math.round(L.pct * 100)}%</b> da estrutura${G.shields.length ? ' · 🛡 não tocar' : ''}</small>
      <div class="bar cost"><i style="width:${pr * 100}%"></i><u style="left:${L.s3 / money * 100}%"></u><u style="left:${L.s2 / money * 100}%"></u></div>
      <small>Gasto ${fmtE(cost)} de ${fmtE(money)} · <span class="stars">${'★'.repeat(stars)}<span style="opacity:.3">${'★'.repeat(3 - stars)}</span></span></small>
      <small style="opacity:.75">★★★ até ${fmtE(L.s3)} · ★★ até ${fmtE(L.s2)}</small>`;
    const go = G.ui.querySelector('.dm-go'); if (go) go.disabled = !G.plan.length || G.phase !== 'plan';
    G.ui.querySelector('.dm-bar').style.display = G.phase === 'plan' || G.phase === 'intro' ? '' : 'none';
    G.ui.querySelector('.dm-side').style.display = G.phase === 'plan' || G.phase === 'intro' ? '' : 'none';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(G, text, dur) {
    if (!G.ui) return;
    const m = G.ui.querySelector('.dm-msg'); m.innerHTML = text; m.style.opacity = 1;
    clearTimeout(G._tt); G._tt = setTimeout(() => { if (m.isConnected) m.style.opacity = 0; }, (dur || 2.6) * 1000);
  }

  /* popover de uma carga já posta: atraso e remover */
  function openPop(G, c) {
    closePop(G);
    const pop = document.createElement('div'); pop.className = 'dm-pop';
    const D = [0, .25, .5, 1, 1.5, 2];
    pop.innerHTML = `<div class="row"><small>${CH()[c.type].name}</small></div>
      <div class="row"><small>Atraso</small>${D.map(d => `<button data-d="${d}" class="${d === c.delay ? 'on' : ''}">${d ? '+' + String(d).replace('.', ',') + 's' : 'já'}</button>`).join('')}</div>
      <div class="row"><button class="del" data-del="1">🗑 Tirar</button><button data-x="1">✓ OK</button></div>`;
    G.ui.appendChild(pop); G.pop = { el: pop, c };
    pop.addEventListener('pointerdown', e => e.stopPropagation());
    pop.addEventListener('click', e => {
      const d = e.target.closest('[data-d]');
      if (d) { c.delay = +d.dataset.d; const sc = G.S.charges.find(q => q.id === c.sid); if (sc) sc.delay = c.delay; syncCharges(G); openPop(G, c); G.api.sfx.tone(700 + c.delay * 300, .05, 'square', .05); return; }
      if (e.target.closest('[data-del]')) { G.plan = G.plan.filter(q => q !== c); G.S.removeCharge(c.sid); syncCharges(G); refreshUI(G); G.api.sfx.tone(260, .08, 'square', .05); }
      closePop(G);
    });
    placePop(G);
  }
  function closePop(G) { if (G.pop) { G.pop.el.remove(); G.pop = null; } }
  function placePop(G) {
    if (!G.pop) return;
    const sc = G.S.charges.find(q => q.id === G.pop.c.sid); if (!sc || !sc.wp) return closePop(G);
    const v = new THREE.Vector3(sc.wp.x, sc.wp.y, sc.wp.z).project(G.r3.cam);
    const st = G.api.stage;
    let x = (v.x + 1) / 2 * st.clientWidth, y = (1 - v.y) / 2 * st.clientHeight;
    x = U.clamp(x, 110, st.clientWidth - 110); y = U.clamp(y, 150, st.clientHeight);
    G.pop.el.style.left = x + 'px'; G.pop.el.style.top = y + 'px';
  }

  /* dica: mostra onde ia uma carga da solução */
  function showHint(G, api) {
    if (G.phase !== 'plan') return;
    const sol = DemoLevels.refCharges(G.L);
    const miss = sol.find(s => !G.plan.some(c => c.pid === s.id));
    if (!miss) { toast(G, 'As cargas já estão nos sítios certos — experimenta <b>DETONAR</b>! Se falhar, ajusta os atrasos.'); return; }
    G.hintAt = { id: miss.id, t: 5, type: miss.type, lp: miss.lp };
    toast(G, `Dica: experimenta <b>${CH()[miss.type].name}</b> no bloco que está a piscar${miss.delay ? ` (com +${String(miss.delay).replace('.', ',')}s)` : ''}.`, 5);
  }

  /* ════════════════════════════════════════════════════════════════
     colocar cargas (raycast)
  ════════════════════════════════════════════════════════════════ */
  function pickAt(G, sx, sy) {
    const r3 = G.r3, st = G.api.stage;
    _ndc.set(sx / st.clientWidth * 2 - 1, -(sy / st.clientHeight) * 2 + 1);
    r3.ray.setFromCamera(_ndc, r3.cam);
    /* cargas primeiro (para as poder editar) */
    const cobjs = [...r3.chargeObjs.values()];
    const hc = r3.ray.intersectObjects(cobjs, true)[0];
    if (hc) { let o = hc.object; while (o.parent && !r3.chargeObjs.has(keyOf(r3, o))) o = o.parent; const id = keyOf(r3, o); if (id != null) return { charge: id }; }
    const meshes = Object.values(r3.inst);
    const h = r3.ray.intersectObjects(meshes, false)[0];
    if (!h || h.instanceId == null) return null;
    const id = h.object.userData.ids[h.instanceId];
    const p = G.S.pieces[id]; if (!p || !p.alive) return null;
    /* ponto e normal no referencial do bloco */
    const t = p.body.translation(), q = p.body.rotation();
    _q.set(q.x, q.y, q.z, q.w).invert();
    const lp = h.point.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(_q);
    const n = h.face.normal.clone();
    const b = G.L.blocks[id];
    if ((b.shape || 'box') === 'box') { const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)], k = a.indexOf(Math.max(...a)); n.set(k === 0 ? Math.sign(n.x) : 0, k === 1 ? Math.sign(n.y) : 0, k === 2 ? Math.sign(n.z) : 0); }
    else if (b.shape === 'cyl') { if (Math.abs(n.y) < .7) { n.y = 0; n.normalize(); } else n.set(0, Math.sign(n.y), 0); }
    const hs = [b.size[0] / 2, b.size[1] / 2, (b.shape === 'cyl' ? b.size[0] : b.size[2]) / 2];
    lp.x = U.clamp(lp.x, -hs[0], hs[0]); lp.y = U.clamp(lp.y, -hs[1], hs[1]); lp.z = U.clamp(lp.z, -hs[2], hs[2]);
    return { id, lp: [lp.x, lp.y, lp.z], ln: [n.x, n.y, n.z], point: h.point, part: b.part || 's' };
  }
  function keyOf(r3, o) { for (const [id, m] of r3.chargeObjs) if (m === o) return id; return null; }

  function placeAt(G, api, sx, sy) {
    const h = pickAt(G, sx, sy);
    if (!h) { closePop(G); return; }
    if (h.charge != null) { const c = G.plan.find(q => q.sid === h.charge); if (c) openPop(G, c); return; }
    closePop(G);
    if (h.part === 'p') { toast(G, '🛡 Isso está protegido — não pode levar cargas (nem ser atingido!).'); api.sfx.tone(180, .12, 'square', .05); return; }
    const C = CH()[G.sel];
    if (G.S.cost() + C.cost > G.L.money) { toast(G, `Orçamento esgotado: faltam ${fmtE(G.S.cost() + C.cost - G.L.money)}.`); api.sfx.tone(160, .15, 'sawtooth', .05); return; }
    if (G.plan.length >= 24) { toast(G, 'Máximo de 24 cargas.'); return; }
    const sc = G.S.addCharge(G.sel, h.id, h.lp, h.ln, 0);
    if (!sc) return;
    const c = { type: G.sel, pid: h.id, lp: h.lp, ln: h.ln, delay: 0, sid: sc.id };
    G.plan.push(c);
    syncCharges(G);
    const o = G.r3.chargeObjs.get(sc.id); if (o) o.userData.pop = .001;
    api.sfx.tone(520, .05, 'square', .05); api.sfx.tone(780, .06, 'triangle', .05, .04);
    api.vibe(12);
    if (G.hintAt && G.hintAt.id === h.id) G.hintAt = null;
    if (G.tut === 1) G.tut = 2;
    refreshUI(G);
  }

  /* ════════════════════════════════════════════════════════════════
     detonar → simular → avaliar
  ════════════════════════════════════════════════════════════════ */
  function detonate(G, api) {
    if (G.phase !== 'plan' || !G.plan.length) return;
    closePop(G);
    G.phase = 'count'; G.countT = 0; G.countN = 4;
    G.r3.hl.visible = G.r3.rs.visible = G.r3.ghost.visible = false;
    refreshUI(G);
    /* sirene de obra: três toques antes da explosão (como nas demolições a sério) */
    horn(api, 0); horn(api, .8); horn(api, 1.6);
  }
  function horn(api, w) { api.sfx.tone(233, .55, 'sawtooth', .06, w); api.sfx.tone(311, .55, 'square', .03, w); }

  function startBoom(G, api) {
    G.phase = 'boom'; G.boomT = 0;
    /* gravação para a repetição: quadros a 30 Hz */
    G.rec = { frames: [], booms: [], shat: [] };
    G.S.detonate();
    const c = G.ui.querySelector('.dm-count'); if (c) c.remove();
    const live = document.createElement('div'); live.className = 'dm-live';
    live.innerHTML = `<span>Abaixo da linha <b class="dm-pct">0%</b></span><button data-a="slow" class="${G.slowOn ? 'on' : ''}">🐢 Lento</button><button data-a="skip">⏩ Rápido</button>`;
    G.ui.appendChild(live);
  }

  /* efeitos dos eventos do DemoSim */
  function handleEvents(G, api, replay) {
    const S = G.S, fx = G.r3.fx;
    const evs = replay ? replay : S.ev.splice(0);
    for (const e of evs) {
      if (e.t === 'boom') {
        const C = CH()[e.type], big = e.type === 'tnt' ? 1.8 : e.type === 'din' ? 1.2 : e.type === 'imp' ? .7 : .8;
        if (!replay && G.rec) G.rec.booms.push({ f: G.rec.frames.length, e });
        const o = G.r3.chargeObjs.get(e.id); if (o) { G.r3.scene.remove(o); G.r3.chargeObjs.delete(e.id); }
        if (e.type === 'imp') {
          for (let i = 0; i < 24; i++) fx.dust.add(part({ x: e.p.x, y: e.p.y, z: e.p.z, vx: U.rand(-6, 6), vy: U.rand(-2, 5), vz: U.rand(-6, 6), s0: .5, s1: 3, life: 1.4, a: .5, r: .85, gC: .9, b: 1 }));
          api.sfx.noise(.45, .12, 0, 500); api.sfx.tone(90, .3, 'sine', .1, 0, 50);
        } else {
          /* bola de fogo + núcleo + faíscas + fumo */
          fx.fire.add(part({ x: e.p.x, y: e.p.y, z: e.p.z, s0: .5, s1: C.r * 2.6 * big, life: .5, a: 1, fin: .02, r: 1, gC: .55, b: .18, ramp: 3, fout: 1.2, spin: 0 }));
          for (let i = 0; i < 10 * big; i++) fx.fire.add(part({ x: e.p.x, y: e.p.y, z: e.p.z, vx: U.rand(-8, 8) * big, vy: U.rand(-2, 9) * big, vz: U.rand(-8, 8) * big, s0: C.r * .8, s1: C.r * 1.6, life: U.rand(.35, .7), a: .85, r: 1, gC: .45, b: .1, ramp: 2.5, drag: 4 }));
          for (let i = 0; i < 26 * big; i++) fx.fire.add(part({ x: e.p.x, y: e.p.y, z: e.p.z, vx: U.rand(-16, 16), vy: U.rand(-4, 18), vz: U.rand(-16, 16), s0: .16, s1: .05, life: U.rand(.5, 1.3), a: 1, r: 1, gC: .7, b: .3, g: -9.81, drag: .8, spin: 0 }));
          for (let i = 0; i < 14 * big; i++) fx.dust.add(part({ x: e.p.x + U.rand(-.5, .5), y: e.p.y, z: e.p.z + U.rand(-.5, .5), vx: U.rand(-3, 3), vy: U.rand(1, 5), vz: U.rand(-3, 3), s0: C.r * .7, s1: C.r * 2.8, life: U.rand(2.5, 5), a: .55, r: .22, gC: .2, b: .19, fin: .1, drag: 1.2 }));
          G.r3.flash.position.set(e.p.x, e.p.y + .5, e.p.z); G.r3.flash.intensity = 3500 * big; G.flashT = .25;
          /* anel de choque no chão */
          ring(G, e.p, C.r * 2.4 * big);
          boomSound(api, big);
          api.shake(6 * big, .5); api.vibe(40);
        }
        if (!replay && !G.slowDone && !api.reduced) { G.slowDone = true; G.slow = 1.1; }
      } else if (e.t === 'shatter') {
        if (!replay && G.rec) G.rec.shat.push({ f: G.rec.frames.length, e });
        const m = e.p.mat, glass = m === 'glass';
        e.parts.forEach(ch => {
          if (ch.crumb) {
            /* migalhas: pedrinhas a voar */
            const n = glass ? 3 : 1;
            for (let i = 0; i < n; i++) G.r3.crumbs.add({ x: ch.pos.x + U.rand(-.2, .2), y: ch.pos.y, z: ch.pos.z + U.rand(-.2, .2), vx: ch.vel.x + U.rand(-3, 3), vy: ch.vel.y + U.rand(0, 4), vz: ch.vel.z + U.rand(-3, 3), rx: 0, ry: 0, wx: U.rand(-9, 9), wy: U.rand(-9, 9), s: Math.cbrt(ch.vol) * (glass ? .9 : 1.3) + .05, c: INNER[m] || '#888', flat: glass ? .25 : .7 }, glass);
          } else if (!replay) G.chunks.push(ch);
        });
        /* pó (proporcional ao volume) */
        const n = glass ? 2 : Math.min(10, 2 + e.p.vol * 3);
        for (let i = 0; i < n; i++) fx.dust.add(part({ x: e.at.x + U.rand(-.6, .6), y: e.at.y + U.rand(-.5, .5), z: e.at.z + U.rand(-.6, .6), vx: U.rand(-1.5, 1.5), vy: U.rand(0, 1.8), vz: U.rand(-1.5, 1.5), s0: 1, s1: 3.5 + e.p.vol * .6, life: U.rand(3, 6), a: glass ? .15 : .42, r: dustC(m)[0], gC: dustC(m)[1], b: dustC(m)[2], fin: .15, drag: 1 }));
        if (glass) { api.sfx.noise(.25, .05, 0, 5200, 'highpass'); for (let i = 0; i < 3; i++) api.sfx.tone(2500 + Math.random() * 3000, .07, 'sine', .02, i * .03); }
        else if (!e.blast) crumbleSound(api, e.p.vol);
      } else if (e.t === 'hit') {
        if (Math.random() < .35) {
          const c = dustC(e.mat);
          fx.dust.add(part({ x: e.p.x, y: Math.max(.3, e.p.y - .4), z: e.p.z, vx: U.rand(-2, 2), vy: U.rand(0, 1.2), vz: U.rand(-2, 2), s0: 1.2, s1: 3 + Math.min(5, e.vol), life: U.rand(2.5, 5), a: .32, r: c[0], gC: c[1], b: c[2], fin: .12, drag: 1.1 }));
        }
        if (Math.random() < .2) crumbleSound(api, Math.min(3, e.vol));
      }
    }
  }
  const DUSTC = { brick: [.62, .5, .42], concrete: [.66, .64, .6], facade: [.72, .69, .63], plaster: [.78, .75, .7], wood: [.55, .45, .33], glass: [.85, .9, .95], steel: [.5, .5, .5], stone: [.74, .68, .56], roof: [.6, .42, .33], metal: [.5, .48, .45] };
  const dustC = m => DUSTC[m] || [.6, .6, .6];
  function ring(G, p, R) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff2d6', transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, .06, p.z); G.r3.scene.add(m);
    (G.rings = G.rings || []).push({ m, t: 0, R });
  }
  function boomSound(api, big) {
    api.sfx.noise(1.4 * big, .22, 0, 160, 'lowpass');
    api.sfx.tone(62, .9 * big, 'sine', .22, 0, 28);
    api.sfx.noise(.35, .12, 0, 2400);
    api.sfx.noise(1.8, .05, .15, 700, 'lowpass');
  }
  let _crT = 0;
  function crumbleSound(api, vol) { const now = performance.now(); if (now - _crT < 70) return; _crT = now; api.sfx.noise(.4 + Math.min(.8, vol * .2), Math.min(.09, .03 + vol * .02), 0, 260 + Math.random() * 300, 'lowpass'); }

  /* percentagem abaixo da linha agora (para o contador ao vivo) */
  function livePct(G) { return G.S.evaluate().pct; }

  function finish(G, api) {
    G.phase = 'eval'; G.evalT = 0;
    const ev = G.S.evaluate();
    G.res = ev;
    const L = G.L;
    const ok = ev.pct >= L.pct - 1e-6 && !ev.damaged.length;
    G.won = ok;
    /* destacar o que foi danificado */
    G.shields.forEach(s => { if (ev.damaged.includes(s.g)) { s.bad = true; s.sp.material.map = shieldTex(true); s.sp.material.needsUpdate = true; } });
    G.r3.lineM[1].color.set(ok ? '#22e36a' : '#ff3b3b');
    const live = G.ui.querySelector('.dm-live'); if (live) live.remove();
  }

  function showResult(G, api) {
    G.phase = 'result';
    const L = G.L, ev = G.res, ok = G.won, cost = ev.cost;
    const stars = ok ? (cost <= L.s3 ? 3 : cost <= L.s2 ? 2 : 1) : 0;
    const sv = save();
    if (ok) {
      sv.s[G.D.id] = Math.max(sv.s[G.D.id] || 0, stars);
      sv.c[G.D.id] = Math.min(sv.c[G.D.id] || 1e9, cost);
      putSave(sv);
      try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: true, score: stars * 1000 + Math.max(0, L.money - cost), mode: G.D.id, meta: { stars, level: G.li + 1 } }); } catch (e) {}
      api.sfx.win();
    } else {
      try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: false, score: 0, mode: G.D.id }); } catch (e) {}
      api.sfx.lose();
    }
    const next = LV()[G.li + 1];
    const why = !ok ? (ev.damaged.length ? 'Atingiste algo protegido 🛡. Faz a estrutura cair para o outro lado (usa atrasos) ou usa cargas mais pequenas.' : `Ficou ${Math.round((1 - ev.pct) * 100)}% acima da linha — faltam ${Math.max(1, Math.round((L.pct - ev.pct) * 100))} pontos. Tira mais apoios em baixo.`) : '';
    api.panel({
      icon: ok ? (stars === 3 ? '🏆' : '💥') : '🧱', title: ok ? 'Demolição perfeita!'.replace('perfeita', stars === 3 ? 'perfeita' : 'concluída') : 'Ainda de pé…',
      stars: ok ? stars : null,
      sub: ok ? `${esc(G.D.name)} · gastaste <b>${fmtE(cost)}</b>${stars < 3 ? `<br><small>★★★ com ${fmtE(L.s3)} ou menos</small>` : ''}` : why,
      stats: [['Abaixo da linha', Math.round(ev.pct * 100) + '%'], ['Meta', Math.round(L.pct * 100) + '%'], ['Cargas', G.plan.length], ['Custo', fmtE(cost)]],
      buttons: [
        ...(ok && next ? [{ label: '▶ Próximo nível', primary: true, fn: () => api.play(String(G.li + 1)) }] : []),
        { label: ok ? '↺ Tentar melhor (mesmas cargas)' : '↺ Tentar de novo (mesmas cargas)', primary: !ok, fn: () => retry(G, api) },
        { label: '🎬 Ver repetição', fn: () => { api.resume(); startReplay(G, api); } },
        { label: 'Escolher nível', fn: () => api.menu() },
      ],
    });
  }

  function retry(G, api) {
    api.resume();
    G.replay = null; G.rec = null; G.slowDone = false; G.won = false; G.res = null;
    (G.rings || []).forEach(r => G.r3.scene.remove(r.m)); G.rings = [];
    newSim(G);
    G.phase = 'plan';
    const live = G.ui.querySelector('.dm-live'); if (live) live.remove();
    refreshUI(G);
    toast(G, 'As cargas ficaram onde estavam. Ajusta e volta a detonar!');
  }

  /* ── repetição: os quadros gravados, câmara lenta e câmara de cinema ── */
  function record(G) {
    const S = G.S, map = new Map(), arr = [];
    S.pieces.forEach(p => { if (p.alive && p.body) { const t = p.body.translation(), q = p.body.rotation(); map.set(p.id, arr.length); arr.push(t.x, t.y, t.z, q.x, q.y, q.z, q.w); } });
    G.rec.frames.push({ map, tr: new Float32Array(arr), t: G.boomT });
  }
  function startReplay(G, api) {
    if (!G.rec || !G.rec.frames.length) return;
    G.replay = { k: 0, t: 0, cur: G.rec.frames[0], bi: 0, si: 0, prevPhase: G.phase, yaw0: G.cam.yaw };
    G.phase = 'replay';
    G.r3.fx.dust.clear(); G.r3.fx.fire.clear(); G.r3.crumbs.clear();
    const live = document.createElement('div'); live.className = 'dm-live'; live.innerHTML = `<span>🎬 Repetição em câmara lenta</span><button data-a="endrep">Saltar ⏭</button>`;
    live.querySelector('[data-a=endrep]').addEventListener('click', () => endReplay(G, api));
    G.ui.appendChild(live);
  }
  function endReplay(G, api) {
    const live = G.ui.querySelector('.dm-live'); if (live) live.remove();
    G.replay = null; G.phase = 'result-wait'; G.evalT = 99;
    syncBlocks(G, true);
    showResult(G, api);
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.ok) return;
    if (!G.ui) buildUI(G, api);
    const c = G.cam;
    if (G.phase === 'intro') {
      G.introT += dt;
      const k = Math.min(1, G.introT / 2.4), e = 1 - Math.pow(1 - k, 3);
      c.yaw = -.75 - (1 - e) * 1.6; c.dist = c.dist0 * (1 + (1 - e) * .35); c.pitch = .38 + (1 - e) * .15;
      if (k >= 1) {
        G.phase = 'plan'; refreshUI(G);
        if (G.li === 0) G.tut = 1;
        if (G.D.tip) toast(G, '💡 ' + G.D.tip, 6);
      }
    }
    if (G.phase === 'count') {
      G.countT += dt;
      const n = 3 - Math.floor(G.countT / .8);
      if (n !== G.countN && n >= 1) {
        G.countN = n;
        let el = G.ui.querySelector('.dm-count'); if (!el) { el = document.createElement('div'); el.className = 'dm-count'; G.ui.appendChild(el); }
        el.textContent = n; el.animate && el.animate([{ transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        api.sfx.tone(880, .1, 'square', .06);
      }
      if (G.countT >= 2.4) startBoom(G, api);
    }
    if (G.phase === 'boom') {
      /* física a passo fixo; câmara lenta logo a seguir à 1.ª explosão */
      if (G.slow > 0) G.slow -= dt;
      let k = G.fast ? 3 : 1;
      if (G.slowOn) k *= .3; else if (G.slow > 0) k *= .38;
      G.acc = (G.acc || 0) + dt * k;
      let n = 0;
      const t0 = performance.now();
      while (G.acc >= DemoSim.DT && n < 4) {
        G.S.step(); G.acc -= DemoSim.DT; n++; G.boomT += DemoSim.DT;
        handleEvents(G, api);
        if ((G.stepN = (G.stepN || 0) + 1) % 2 === 0) record(G);
        if (G.S.phase === 'done') break;
        if (performance.now() - t0 > 28) { G.acc = 0; break; }   /* aparelho lento: abranda em vez de engasgar */
      }
      const pe = G.ui.querySelector('.dm-pct');
      if (pe && (G.stepN % 6 === 0)) pe.textContent = Math.round(livePct(G) * 100) + '%';
      if (G.S.phase === 'done' || G.boomT > 18) { record(G); finish(G, api); }
    }
    if (G.phase === 'eval') {
      G.evalT += dt;
      if (G.evalT > 1.4) showResult(G, api);
    }
    if (G.phase === 'replay') {
      const R = G.replay, F = G.rec.frames;
      R.t += dt * .5;
      while (R.k < F.length - 1 && F[R.k + 1].t <= R.t) R.k++;
      R.cur = F[R.k];
      const fi = R.k;
      while (R.bi < G.rec.booms.length && G.rec.booms[R.bi].f <= fi) { handleEvents(G, api, [G.rec.booms[R.bi].e]); R.bi++; }
      while (R.si < G.rec.shat.length && G.rec.shat[R.si].f <= fi) { handleEvents(G, api, [G.rec.shat[R.si].e]); R.si++; }
      c.yaw = R.yaw0 + R.t * .25; c.pitch = .16 + R.t * .01;
      if (R.k >= F.length - 1) { R.end = (R.end || 0) + dt; if (R.end > 1.2) endReplay(G, api); }
    }
    /* efeitos */
    G.r3.fx.dust.update(dt * (G.slow > 0 && !G.replay ? .5 : 1)); G.r3.fx.fire.update(dt);
    G.r3.crumbs.update(dt, () => 0);
    if (G.flashT > 0) { G.flashT -= dt; G.r3.flash.intensity *= Math.exp(-dt * 14); if (G.flashT <= 0) G.r3.flash.intensity = 0; }
    (G.rings || []).forEach(r => { r.t += dt; const k = r.t / .7; r.m.scale.setScalar(1 + k * r.R); r.m.material.opacity = .55 * (1 - k); });
    if (G.rings) G.rings = G.rings.filter(r => { if (r.t > .7) { G.r3.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; } return true; });
    if (G.hintAt) G.hintAt.t -= dt;
    /* teclado: rodar câmara */
    const K = G.keys || {};
    if (K.ArrowLeft || K.a) c.yaw += dt * 1.4; if (K.ArrowRight || K.d) c.yaw -= dt * 1.4;
    if (K.ArrowUp || K.w) c.pitch = U.clamp(c.pitch + dt, .05, 1.35); if (K.ArrowDown || K.s) c.pitch = U.clamp(c.pitch - dt, .05, 1.35);
  }

  function draw(G, ctx, W, H, api) {
    if (G.fail3d) { ctx.fillStyle = '#10141f'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffd9b0'; ctx.font = `600 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Este jogo precisa de WebGL (3D).', W / 2, H / 2); ctx.font = `500 13px ${FONT}`; ctx.fillText(G.fail3d, W / 2, H / 2 + 24); return; }
    if (!G.ok) {
      ctx.fillStyle = 'rgba(10,12,20,.4)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('A preparar o estaleiro…', W / 2, H / 2);
      const a = G.t * 4; ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2, H / 2 + 34, 14, a, a + 4.2); ctx.stroke();
      return;
    }
    const r3 = G.r3, c = G.cam, cam = r3.cam;
    const asp = Arcade3D.fit(api.stage, cam);
    /* câmara orbital (em ecrã vertical afasta-se para caber a largura) */
    const [sx, sy] = api.shakeXY;
    const dist = c.dist * (asp < 1.15 ? Math.pow(1.15 / asp, .8) : 1);
    const cp = Math.cos(c.pitch), x = c.tx + Math.sin(c.yaw) * cp * dist, z = c.tz + Math.cos(c.yaw) * cp * dist, y = Math.max(.6, c.ty + Math.sin(c.pitch) * dist);
    cam.position.set(x + sx * .04, y + sy * .04, z);
    cam.lookAt(c.tx, c.ty, c.tz);
    /* blocos, pedaços, cargas */
    syncBlocks(G, G.phase === 'replay');
    if (G.phase === 'boom' || G.phase === 'replay' || G.phase === 'eval' || G.chunks.length) syncChunks(G);
    if (G.phase === 'plan' || G.phase === 'count' || G.phase === 'intro') syncCharges(G);
    r3.chargeObjs.forEach(o => {
      if (o.userData.led) o.userData.led.visible = (G.t * (G.phase === 'count' ? 8 : 2)) % 1 < .5;
      if (o.userData.pop > 0) { o.userData.pop += 1 / 60; const k = Math.min(1, o.userData.pop / .22); o.scale.setScalar(1 + Math.sin(k * Math.PI) * .45); if (k >= 1) { o.userData.pop = 0; o.scale.setScalar(1); } }
    });
    /* escudos a flutuar */
    G.shields.forEach((s, i) => { s.sp.position.y = s.y + Math.sin(G.t * 2 + i) * .15; s.sp.material.opacity = s.bad ? .6 + Math.sin(G.t * 10) * .4 : .95; });
    /* linha a pulsar */
    r3.lineM[0].opacity = .14 + Math.sin(G.t * 3) * .05;
    /* dica: bloco a piscar */
    if (G.hintAt && G.hintAt.t > 0 && G.S.pieces[G.hintAt.id].alive) {
      const b = G.L.blocks[G.hintAt.id], t = G.S.pieces[G.hintAt.id].body.translation();
      r3.hl.visible = (G.t * 4) % 1 < .6; r3.hl.position.set(t.x, t.y, t.z); r3.hl.scale.set(b.size[0] + .08, b.size[1] + .08, (b.shape === 'cyl' ? b.size[0] : b.size[2]) + .08); r3.hl.quaternion.identity(); r3.hl.material.color.set('#4ade80');
    } else if (G.phase === 'plan' && G.hover) {
      const hv = G.hover, b = G.L.blocks[hv.id], p = G.S.pieces[hv.id];
      if (p && p.alive) {
        const t = p.body.translation(), q = p.body.rotation();
        r3.hl.visible = true; r3.hl.position.set(t.x, t.y, t.z); r3.hl.quaternion.set(q.x, q.y, q.z, q.w); r3.hl.scale.set(b.size[0] + .06, b.size[1] + .06, (b.shape === 'cyl' ? b.size[0] : b.size[2]) + .06);
        r3.hl.material.color.set(hv.part === 'p' ? '#ff4d4d' : '#ffe066');
        r3.rs.visible = hv.part !== 'p'; r3.rs.position.copy(hv.point); r3.rs.scale.setScalar(CH()[G.sel].r);
      }
    } else { r3.hl.visible = false; r3.rs.visible = false; }
    if (G.phase !== 'plan') r3.rs.visible = false;
    if (r3.water) Arcade3D.waterTick(r3.water, G.t, cam);
    if (r3.sea) Arcade3D.waterTick(r3.sea, G.t, cam);
    placePop(G);
    r3.renderer.render(r3.scene, cam);
    /* tutorial: anel a apontar para um pilar no 1.º nível */
    if (G.tut === 1 && G.phase === 'plan') {
      const sol = DemoLevels.refCharges(G.L)[0];
      if (sol) {
        const t = G.S.pieces[sol.id].body.translation();
        const v = new THREE.Vector3(t.x, t.y, t.z).project(cam);
        const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
        const k = (G.t * 1.2) % 1;
        ctx.strokeStyle = `rgba(255,210,74,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, 18 + k * 22, 0, 7); ctx.stroke();
        ctx.fillStyle = '#ffd24a'; ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText('Toca aqui', px, py - 46); ctx.fillText('Toca aqui', px, py - 46);
      }
    }
  }

  /* ── ponteiro: arrastar = rodar câmara; toque curto = pôr carga; dois dedos = zoom ── */
  function down(G, x, y, api, e) {
    if (!G.ok) return;
    const st = api.stage, r = st.getBoundingClientRect();
    const px = e && e.clientX != null ? e.clientX - r.left : x, py = e && e.clientY != null ? e.clientY - r.top : y;
    G.drag = { x0: px, y0: py, x: px, y: py, moved: 0, yaw: G.cam.yaw, pitch: G.cam.pitch, btn: e && e.button };
    if (api.ptrs.size >= 2) { const pts = [...api.ptrs.values()]; G.pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), dist: G.cam.dist, ty: G.cam.ty, my: (pts[0].y + pts[1].y) / 2 }; }
  }
  function move(G, x, y, api, e, pressed) {
    if (!G.ok) return;
    const st = api.stage, r = st.getBoundingClientRect();
    const px = e && e.clientX != null ? e.clientX - r.left : x, py = e && e.clientY != null ? e.clientY - r.top : y;
    if (G.pinch && api.ptrs.size >= 2) {
      const pts = [...api.ptrs.values()], d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), my = (pts[0].y + pts[1].y) / 2;
      G.cam.dist = U.clamp(G.pinch.dist * G.pinch.d / Math.max(10, d), 6, 160);
      G.cam.ty = U.clamp(G.pinch.ty + (my - G.pinch.my) * .05, 1, G.box.h + 4);
      if (G.drag) G.drag.moved = 99;
      return;
    }
    if (pressed && G.drag) {
      const dx = px - G.drag.x, dy = py - G.drag.y; G.drag.x = px; G.drag.y = py;
      G.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (G.drag.moved > 6) {
        if (G.drag.btn === 2 || (e && e.shiftKey)) { G.cam.ty = U.clamp(G.cam.ty + dy * .04, 1, G.box.h + 4); }
        else { G.cam.yaw -= dx * .0065; G.cam.pitch = U.clamp(G.cam.pitch + dy * .005, .04, 1.35); }
        G.hover = null;
      }
      return;
    }
    /* rato sem botão: pré-visualizar onde a carga vai */
    if (G.phase === 'plan' && (!e || e.pointerType === 'mouse')) {
      const h = pickAt(G, px, py);
      G.hover = h && h.id != null ? h : null;
      api.stage.style.cursor = h ? (h.charge != null ? 'pointer' : h.part === 'p' ? 'not-allowed' : 'crosshair') : 'grab';
    }
  }
  function up(G, x, y, api, e) {
    if (!G.ok) return;
    if (G.pinch && api.ptrs.size < 2) { G.pinch = null; }
    const d = G.drag; G.drag = null;
    if (!d || d.moved > 8) return;
    if (G.phase === 'plan') placeAt(G, api, d.x0, d.y0);
  }
  function wheel(G, e) { if (!G.ok) return; G.cam.dist = U.clamp(G.cam.dist * Math.exp(e.deltaY * .0012), 6, 160); }
  function key(G, e) {
    G.keys = G.keys || {};
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { G.keys[k] = 1; return true; }
    if (G.phase === 'plan') {
      const n = parseInt(k, 10); if (n >= 1 && n <= G.L.kit.length) { G.sel = G.L.kit[n - 1]; refreshUI(G); return true; }
      if (k === 'Enter') { detonate(G, G.api); return true; }
      if (k === 'z' || k === 'Backspace') { G.ui && G.ui.querySelector('[data-a=undo]').click(); return true; }
    }
    if (k === '+' || k === '=') { G.cam.dist = Math.max(6, G.cam.dist * .9); return true; }
    if (k === '-') { G.cam.dist = Math.min(160, G.cam.dist * 1.1); return true; }
  }
  function keyup(G, e) { if (!G.keys) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; delete G.keys[k]; }

  /* ════════════════════════════════════════════════════════════════
     menu: mundos × níveis
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const sv = save(), W = DemoLevels.WORLDS;
      const tot = LV().reduce((s, l) => s + (sv.s[l.id] || 0), 0);
      return `<style>
.dm-m{display:grid;gap:14px}
.dm-w{border-radius:18px;padding:12px 12px 14px;color:#fff;position:relative;overflow:hidden}
.dm-w h4{margin:0 0 8px;font:800 1rem ${FONT};display:flex;align-items:center;gap:8px}
.dm-w h4 small{margin-left:auto;font-size:.72rem;opacity:.85}
.dm-ls{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
.dm-l{border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.24);border-radius:12px;padding:8px 9px;color:#fff;font:inherit;text-align:left;cursor:pointer;transition:transform .12s,background .12s;min-height:66px}
.dm-l:hover:not([disabled]){transform:translateY(-2px);background:rgba(0,0,0,.36)}
.dm-l[disabled]{opacity:.45;cursor:not-allowed}
.dm-l small{display:block;font:700 .62rem ${FONT};opacity:.75;letter-spacing:.08em}
.dm-l b{display:block;font-size:.8rem;line-height:1.2;margin:2px 0 3px}
.dm-l i{font-style:normal;font-size:.72rem;letter-spacing:1px}
.dm-tot{font:700 .82rem ${FONT};color:var(--muted,#9aa);margin:2px 2px 0}
</style><div class="dm-m"><div class="dm-tot">⭐ ${tot} / ${LV().length * 3} estrelas</div>${W.map((w, wi) => {
        const ls = LV().map((l, i) => ({ l, i })).filter(o => o.l.w === wi);
        if (!ls.length) return '';
        const ws = ls.reduce((s, o) => s + (sv.s[o.l.id] || 0), 0);
        return `<div class="dm-w" style="background:linear-gradient(140deg,${w.grad[0]},${w.grad[1]})"><h4>${w.icon} ${w.name}<small>⭐ ${ws}/${ls.length * 3}</small></h4><div class="dm-ls">${ls.map(({ l, i }) => {
          const lock = !unlocked(sv, i), st = sv.s[l.id] || 0;
          return `<button class="dm-l" data-m="${i}" ${lock ? 'disabled' : ''}><small>NÍVEL ${i + 1}${lock ? ' · 🔒' : ''}</small><b>${esc(l.name)}</b><i>${lock ? '' : '★'.repeat(st) + '<span style="opacity:.3">' + '★'.repeat(3 - st) + '</span>'}</i></button>`;
        }).join('')}</div></div>`;
      }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) start(b.dataset.m); })); },
  };

  let CUR = null;
  const spec = {
    id: ID, title: 'Implosão', icon: '💥', accent: '#ff7a1a', accent2: '#ffd04a', bg: '#1a1f2b', aspect: 'wide', transparent: true, diff: false,
    tagline: 'Puzzle de demolição em 3D: põe as cargas nos sítios certos, carrega em DETONAR e vê o prédio vir abaixo — sem tocar nos vizinhos e sem estourar o orçamento.',
    view: { w: 960 }, picker, cursor: 'grab',
    get ready() { const L = CUR || LV()[0]; return { title: L.name, hint: (L.tip || '') + '<br><small style="opacity:.75">Arrasta para rodar a câmara · toca num bloco para pôr a carga escolhida.</small>' }; },
    how: [
      'Escolhe uma carga em baixo e <b>toca num pilar ou parede</b> para a colocar. Arrasta para rodar a câmara; roda do rato ou dois dedos para aproximar.',
      'Carrega em <b>DETONAR</b>: a estrutura tem de ficar com a percentagem pedida <b>abaixo da linha vermelha</b>.',
      'Não toques no que tem <b>escudo verde</b> 🛡. Toca numa carga já posta para lhe dar um <b>atraso</b> — rebentar primeiro um lado faz o prédio tombar para lá.',
      'Cada carga custa dinheiro: gasta pouco para ganhar <b>★★★</b>. Petardo (pequeno), Dinamite (forte), Carga de corte (parte aço), Impulso (empurra) e Barril TNT (enorme).',
    ],
    controls: ['🖱️ arrastar = rodar · roda = zoom', '🖱️ direito/Shift = subir/descer', '⌨️ 1–5 carga · Enter detonar · Z desfazer'],
    setup: (api, o) => { const G = setup(api, o); CUR = G.D; G.api = api; return G; },
    begin: (G, api) => {
      if (!G._wheel) { G._wheel = e => { e.preventDefault(); wheel(G, e); }; api.stage.addEventListener('wheel', G._wheel, { passive: false }); }
    },
    update, draw, down, move, up, key, keyup,
    resize: () => {},
    destroy: G => {
      G.dead = 1;
      if (G._wheel && G.api) G.api.stage.removeEventListener('wheel', G._wheel);
      if (G.ui) G.ui.remove();
      if (G.S) { try { G.S.world.free(); } catch (e) {} G.S = null; }
      if (G.r3) { Arcade3D.disposeOwn(G.r3.scene); Arcade3D.detach(); G.r3 = null; }
    },
    hud: G => [['Nível', (G.li + 1) + '/' + LV().length], ['Cargas', G.plan.length], ['Gasto', G.S ? fmtE(G.S.cost()) : '—']],
    pauseButtons: (G, api) => [{ label: 'Escolher nível', fn: () => api.menu() }],
    achievements: [
      { id: 'demo.first', name: 'Primeiro Estrondo', icon: '💥', desc: 'Completa o primeiro nível da Implosão.', test: c => c.result.won },
      { id: 'demo.three', name: 'Engenheiro de Explosivos', icon: '🏆', desc: 'Completa um nível da Implosão com ★★★.', test: c => c.result.won && (c.result.meta && c.result.meta.stars) === 3 },
    ],
  };
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = {
    LV, build: i => DemoLevels.build(i),
    /* põe a solução de referência (testes) */
    plan(G) { DemoLevels.refCharges(G.L).forEach(c => { const sc = G.S.addCharge(c.type, c.id, c.lp, c.ln, c.delay); G.plan.push({ type: c.type, pid: c.id, lp: c.lp, ln: c.ln, delay: c.delay, sid: sc.id }); }); syncCharges(G); refreshUI(G); },
    go(G) { detonate(G, G.api); },
    replay(G) { G.api.resume(); startReplay(G, G.api); },
    retry(G) { retry(G, G.api); },
  };
  return KIT;
})();
