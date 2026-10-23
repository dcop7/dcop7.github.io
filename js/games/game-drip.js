/* ══════════════════════════════════════════════════════════════════
   Gota a Gota (id drip) — puzzle de escavar para levar a água (out/2026).

   O Rebento, uma plantinha num vaso lá em baixo, tem sede. Escava a terra
   com o dedo (ou o rato) para a água lá chegar; liga as turbinas
   pelo caminho (estrelas) e cuidado com o lodo, a lava e o musgo.

   Camadas no palco do ArcadeKit:
     1. canvas de fundo (gruta e superfície, pintado uma vez por nível)
     2. canvas WebGL: o líquido — cada partícula pinta uma "mancha" numa
        textura a meia resolução e um segundo passo corta-a no limiar
        (metaballs), com normal pelo gradiente para o brilho e a orla
     3. canvas do kit: terra/pedra/musgo (imagem em cache, só se refaz a
        zona escavada), objetos, o Rebento, vapor e efeitos
   Motor (física, reações, objetos): DripSim (drip-sim.js).
══════════════════════════════════════════════════════════════════ */
const DripGame = (function () {
  'use strict';
  const ID = 'drip';
  const U = ArcadeKit.U;
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const D = () => DripSim;
  const LV = () => DripLevels.LEVELS;
  const VW = 480, VH = 720;
  const BRUSH = 15;

  const SKEY = 'drip:save';
  const save = () => { try { return Object.assign({ s: {} }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { s: {} }; } };
  const putSave = v => { try { localStorage.setItem(SKEY, JSON.stringify(v)); } catch (e) {} };
  const unlocked = (sv, i) => i === 0 || sv.s[LV()[i - 1].id] != null;

  function hash(n) { n = Math.imul(n ^ 0x27d4eb2d, 0x165667b1); n ^= n >>> 15; return ((Math.imul(n, 0x2c1b3c6d) >>> 0) % 10000) / 10000; }

  /* ════════════════════════════════════════════════════════════════
     texturas do terreno (ImageData 128² sem costuras)
  ════════════════════════════════════════════════════════════════ */
  let TEX = null;
  function texTile(draw) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); draw(x, 128);
    return x.getImageData(0, 0, 128, 128).data;
  }
  function wrapDraw(x, s, fn) { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } }
  function textures() {
    if (TEX) return TEX;
    TEX = {
      dirt: texTile((x, s) => {
        x.fillStyle = '#8a5a34'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 160; i++) { const cx = hash(i) * s, cy = hash(i + 50) * s, r = 4 + hash(i + 99) * 10; wrapDraw(x, s, () => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${hash(i + 7) < .5 ? '60,34,16' : '170,112,64'},.28)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }); }
        for (let i = 0; i < 46; i++) { const cx = hash(i + 300) * s, cy = hash(i + 400) * s, r = 1.5 + hash(i + 500) * 3.2; wrapDraw(x, s, () => { x.fillStyle = `hsl(${25 + hash(i) * 15},${18 + hash(i + 3) * 20}%,${38 + hash(i + 4) * 26}%)`; x.beginPath(); x.ellipse(cx, cy, r, r * .75, hash(i) * 3, 0, 7); x.fill(); x.fillStyle = 'rgba(255,240,220,.25)'; x.beginPath(); x.arc(cx - r * .3, cy - r * .3, r * .35, 0, 7); x.fill(); }); }
        const d = x.getImageData(0, 0, s, s), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (hash(i) - .5) * 18; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
      }),
      rock: texTile((x, s) => {
        x.fillStyle = '#6f6a66'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 26; i++) { const cx = hash(i + 11) * s, cy = hash(i + 61) * s, r = 10 + hash(i + 37) * 20; wrapDraw(x, s, () => { x.fillStyle = `hsl(${20 + hash(i) * 20},${6 + hash(i + 1) * 8}%,${38 + hash(i + 2) * 18}%)`; x.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, rr = r * (.7 + hash(i * 7 + k) * .35); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); x.strokeStyle = 'rgba(30,26,24,.5)'; x.lineWidth = 1.5; x.stroke(); }); }
        const d = x.getImageData(0, 0, s, s), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (hash(i + 9) - .5) * 22; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0);
      }),
      crack: texTile((x, s) => {
        x.fillStyle = '#857565'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 18; i++) { const cx = hash(i + 21) * s, cy = hash(i + 71) * s, r = 9 + hash(i + 47) * 14; wrapDraw(x, s, () => { x.fillStyle = `hsl(28,${10 + hash(i + 1) * 10}%,${42 + hash(i + 2) * 14}%)`; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }); }
        x.strokeStyle = 'rgba(25,18,12,.75)'; x.lineWidth = 2;
        for (let i = 0; i < 9; i++) { let px = hash(i + 5) * s, py = hash(i + 15) * s; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (hash(i * 9 + k) - .5) * 30; py += (hash(i * 9 + k + 3) - .5) * 30; x.lineTo(px, py); } x.stroke(); }
      }),
      moss: texTile((x, s) => {
        x.fillStyle = '#3f8f2f'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 220; i++) { const cx = hash(i + 800) * s, cy = hash(i + 900) * s, r = 2 + hash(i + 1000) * 6; wrapDraw(x, s, () => { x.fillStyle = `hsla(${95 + hash(i) * 30},${45 + hash(i + 1) * 25}%,${28 + hash(i + 2) * 26}%,.85)`; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }); }
        for (let i = 0; i < 30; i++) { const cx = hash(i + 1100) * s, cy = hash(i + 1200) * s; wrapDraw(x, s, () => { x.fillStyle = 'rgba(220,255,150,.55)'; x.beginPath(); x.arc(cx, cy, 1.4, 0, 7); x.fill(); }); }
      }),
    };
    return TEX;
  }

  /* ════════════════════════════════════════════════════════════════
     terreno em cache (ImageData a 1,5× a resolução lógica)
  ════════════════════════════════════════════════════════════════ */
  const RS = 1.5;
  function terrainInit(G) {
    const c = document.createElement('canvas'); c.width = VW * RS; c.height = VH * RS;
    G.tc = c; G.tx = c.getContext('2d'); G.img = G.tx.createImageData(c.width, c.height);
    paintTerrain(G, 0, 0, VW, VH);
  }
  /* pinta a região (em px lógicos) a partir dos campos */
  function paintTerrain(G, x0, y0, x1, y1) {
    const S = G.S, T = textures(), FS = D().FS, NX = D().NX, NY = D().NY;
    const img = G.img, P = img.data, W = img.width;
    const px0 = Math.max(0, Math.floor(x0 * RS)), py0 = Math.max(0, Math.floor(y0 * RS)), px1 = Math.min(W, Math.ceil(x1 * RS)), py1 = Math.min(img.height, Math.ceil(y1 * RS));
    const crack = S.crack;
    const samp = (arr, x, y) => {
      const fx = x / FS - .5, fy = y / FS - .5; let gx = Math.floor(fx), gy = Math.floor(fy); const tx = fx - gx, ty = fy - gy;
      const g0 = gx < 0 ? 0 : gx >= NX ? NX - 1 : gx, g1 = gx + 1 < 0 ? 0 : gx + 1 >= NX ? NX - 1 : gx + 1;
      const h0 = gy < 0 ? 0 : gy >= NY ? NY - 1 : gy, h1 = gy + 1 < 0 ? 0 : gy + 1 >= NY ? NY - 1 : gy + 1;
      return (arr[h0 * NX + g0] * (1 - tx) + arr[h0 * NX + g1] * tx) * (1 - ty) + (arr[h1 * NX + g0] * (1 - tx) + arr[h1 * NX + g1] * tx) * ty;
    };
    for (let py = py0; py < py1; py++) {
      const y = (py + .5) / RS;
      for (let px = px0; px < px1; px++) {
        const x = (px + .5) / RS, o = (py * W + px) * 4;
        if (y < D().TOP * D().CELL) { P[o + 3] = 0; continue; }
        const fr = samp(S.rock, x, y), fm = samp(S.moss, x, y), fd = samp(S.dirt, x, y);
        let tex, f, rimC, k;
        if (fr > .42 && fr >= fm) { f = fr; const cell = Math.floor(y / 20) * 24 + Math.floor(x / 20); tex = crack && crack.has(cell) ? T.crack : T.rock; rimC = [34, 28, 26]; k = 1; }
        else if (fm > .42) { f = fm; tex = T.moss; rimC = [22, 60, 16]; k = 2; }
        else if (fd > .42) { f = fd; tex = T.dirt; rimC = [52, 30, 14]; k = 0; }
        else { P[o + 3] = 0; continue; }
        const ti = (((py & 127) * 128) + (px & 127)) * 4;
        let r = tex[ti], g = tex[ti + 1], b = tex[ti + 2];
        /* orla escura + leve sombra interior (aspeto de "cortado") */
        const e = (f - .5) / .22;
        if (e < .35) { const m = Math.max(0, Math.min(1, (e + .1) / .45)); r = rimC[0] + (r - rimC[0]) * m * .6; g = rimC[1] + (g - rimC[1]) * m * .6; b = rimC[2] + (b - rimC[2]) * m * .6; }
        else if (e < 1.2) { const m = .78 + (e - .35) / .85 * .22; r *= m; g *= m; b *= m; }
        if (k === 0) { const v = .92 + Math.sin(y * .045 + Math.sin(x * .02) * 2) * .06; r *= v; g *= v; b *= v; }   /* estratos */
        P[o] = r; P[o + 1] = g; P[o + 2] = b;
        P[o + 3] = Math.max(0, Math.min(255, (f - .44) / .1 * 255));
      }
    }
    G.tx.putImageData(img, 0, 0, px0, py0, px1 - px0, py1 - py0);
  }

  /* ════════════════════════════════════════════════════════════════
     fundo (gruta + superfície)
  ════════════════════════════════════════════════════════════════ */
  function paintBG(G) {
    const st = G.api.stage, c = G.bg, dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = st.clientWidth, ch = st.clientHeight;
    c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
    const x = c.getContext('2d'), s = Math.min(cw / VW, ch / VH), ox = (cw - VW * s) / 2, oy = (ch - VH * s) / 2;
    G.view = { s, ox, oy, cw, ch, dpr };
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* moldura: terra escura à volta (letterbox) */
    x.fillStyle = '#2a1a10'; x.fillRect(0, 0, cw, ch);
    x.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const ch2 = G.L.chapter || 0;
    const caveTop = { 0: '#4a2e1c', 1: '#3a2a3a', 2: '#4a2318', 3: '#2c3440', 4: '#1f3a38', 5: '#3a2242', 6: '#4a1c22', 7: '#3e3220' }[ch2] || '#4a2e1c';
    const caveBot = { 0: '#26160c', 1: '#1d1420', 2: '#25100a', 3: '#151a22', 4: '#0e1e1c', 5: '#1c1022', 6: '#220c10', 7: '#1e180c' }[ch2] || '#26160c';
    const g = x.createLinearGradient(0, 40, 0, VH); g.addColorStop(0, caveTop); g.addColorStop(1, caveBot);
    x.fillStyle = g; x.fillRect(-VW, 40, VW * 3, VH + 200);
    /* estratos, raízes, pedrinhas e fósseis na parede do fundo */
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(0,0,0,${.06 + hash(i) * .06})`; x.beginPath(); const y0 = 70 + i * 74 + hash(i + 3) * 20; x.moveTo(-10, y0); for (let k = 0; k <= 12; k++) x.lineTo(k * 42, y0 + Math.sin(k * .9 + i) * 8); x.lineTo(VW + 10, y0 + 30); x.lineTo(-10, y0 + 30); x.fill(); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,220,180,${.04 + hash(i + 5) * .05})`; x.beginPath(); x.ellipse(hash(i) * VW, 60 + hash(i + 1) * (VH - 60), 2 + hash(i + 2) * 5, 1.5 + hash(i + 3) * 3, hash(i + 4) * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(80,50,28,.5)'; x.lineCap = 'round';
    for (let i = 0; i < 7; i++) { let px = hash(i + 60) * VW, py = 40; x.lineWidth = 3 - i * .2; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (hash(i * 8 + k) - .5) * 30; py += 14 + hash(i * 8 + k + 1) * 16; x.lineTo(px, py); } x.stroke(); }
    if (hash(G.li + 3) < .6) { const fx = 60 + hash(G.li) * 360, fy = 300 + hash(G.li + 1) * 300; x.strokeStyle = 'rgba(255,235,210,.08)'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k < 5; k++) x.arc(fx, fy, 6 + k * 4, k * .9, k * .9 + 3.6); x.stroke(); }
    /* superfície: céu + relva + jardim */
    const sky = x.createLinearGradient(0, 0, 0, 40); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#d8f1ff');
    x.fillStyle = sky; x.fillRect(-VW, -200, VW * 3, 240);
    x.fillStyle = '#ffffff'; [[60, 14], [300, 10], [420, 20]].forEach(([cx, cy]) => { x.globalAlpha = .8; x.beginPath(); x.arc(cx, cy, 8, 0, 7); x.arc(cx + 10, cy - 3, 10, 0, 7); x.arc(cx + 22, cy, 7, 0, 7); x.fill(); }); x.globalAlpha = 1;
    x.fillStyle = '#5aa63a'; x.fillRect(-VW, 32, VW * 3, 10);
    for (let i = 0; i < 120; i++) { x.strokeStyle = `hsl(${95 + hash(i) * 20},55%,${36 + hash(i + 1) * 16}%)`; x.lineWidth = 1.4; const gx = hash(i + 2) * VW; x.beginPath(); x.moveTo(gx, 36); x.quadraticCurveTo(gx + 2, 30, gx + (hash(i + 3) - .5) * 6, 24 + hash(i + 4) * 6); x.stroke(); }
    [[40, '#ff6fa8'], [120, '#ffd23f'], [380, '#b48bff'], [450, '#ff8a3d']].forEach(([fx, col], i) => { x.strokeStyle = '#3f8a2c'; x.lineWidth = 2; x.beginPath(); x.moveTo(fx, 36); x.lineTo(fx, 22); x.stroke(); x.fillStyle = col; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(fx + Math.cos(k * 1.256) * 3.5, 20 + Math.sin(k * 1.256) * 3.5, 2.6, 0, 7); x.fill(); } x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(fx, 20, 2, 0, 7); x.fill(); });
    /* regador e cerca */
    x.fillStyle = '#c9d6df'; U.rr(x, 220, 22, 22, 14, 3); x.fill(); x.strokeStyle = '#c9d6df'; x.lineWidth = 3; x.beginPath(); x.moveTo(242, 26); x.lineTo(256, 16); x.stroke();
    x.fillStyle = '#e8d2a8'; for (let i = 0; i < 6; i++) x.fillRect(150 + i * 10, 18, 5, 18); x.fillRect(148, 22, 60, 3); x.fillRect(148, 30, 60, 3);
    /* faixa de terra da superfície */
    x.fillStyle = '#6b4024'; x.fillRect(-VW, 38, VW * 3, 4);
    /* vinheta */
    const v = x.createRadialGradient(VW / 2, VH / 2, VH * .25, VW / 2, VH / 2, VH * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = v; x.fillRect(0, 40, VW, VH);
  }

  /* ════════════════════════════════════════════════════════════════
     líquido em WebGL (metaballs)
  ════════════════════════════════════════════════════════════════ */
  function glInit(G) {
    const cv = G.glc;
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    const splat = prog(`attribute vec3 a; uniform vec4 uV; uniform float uPs; varying float vT;
      void main(){ vT = a.z; vec2 p = (a.xy * uV.x + uV.yz); gl_Position = vec4(p.x * 2. - 1., 1. - p.y * 2., 0., 1.); gl_PointSize = uPs * (a.z > 1.5 ? 1.15 : 1.); }`,
    `precision mediump float; varying float vT;
      void main(){ vec2 c = gl_PointCoord * 2. - 1.; float r = dot(c, c); if (r > 1.) discard; float w = (1. - r); w = w * w * .62;
        gl_FragColor = vec4(vT < .5 ? w : 0., (vT > .5 && vT < 1.5) ? w : 0., vT > 1.5 ? w : 0., w); }`);
    const comp = prog(`attribute vec2 a; varying vec2 vU; void main(){ vU = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`,
    `precision mediump float; uniform sampler2D uF; uniform vec2 uPx; uniform float uT; varying vec2 vU;
      void main(){
        vec4 f = texture2D(uF, vU); float a = f.a;
        float al = smoothstep(.30, .40, a);
        if (al < .01) { gl_FragColor = vec4(0.); return; }
        float l = texture2D(uF, vU - vec2(uPx.x, 0.)).a, r = texture2D(uF, vU + vec2(uPx.x, 0.)).a;
        float d = texture2D(uF, vU - vec2(0., uPx.y)).a, u = texture2D(uF, vU + vec2(0., uPx.y)).a;
        vec3 n = normalize(vec3(l - r, d - u, .22));
        float tot = max(.001, f.r + f.g + f.b);
        float wW = f.r / tot, wP = f.g / tot, wL = f.b / tot;
        float depth = smoothstep(.36, 1.0, a);
        vec3 water = mix(vec3(.45, .82, 1.), vec3(.08, .45, .86), depth);
        vec3 poison = mix(vec3(.84, .5, 1.), vec3(.42, .12, .62), depth);
        float flick = .85 + .15 * sin(uT * 3. + vU.x * 40. + vU.y * 30.);
        vec3 lava = mix(vec3(1., .86, .3), vec3(.95, .32, .05), depth * .8) * flick;
        vec3 c = water * wW + poison * wP + lava * wL;
        /* superfície livre por cima: faixa mais clara + linha de brilho */
        float up1 = texture2D(uF, vU + vec2(0., 2.5 * uPx.y)).a, up2 = texture2D(uF, vU + vec2(0., 5. * uPx.y)).a;
        float surf = (1. - smoothstep(.3, .4, up2)) * (1. - wL);
        c = mix(c, c * 1.35 + vec3(.08, .1, .12), surf * .7);
        c += vec3(.55, .6, .65) * (1. - smoothstep(.3, .4, up1)) * (1. - wL) * .6;
        /* reflexos ondulantes no interior */
        float ca = sin(vU.x * 90. + uT * 2.1 + sin(vU.y * 70. - uT * 1.3) * 2.) * sin(vU.y * 80. + uT * 1.7);
        c += vec3(.05, .09, .12) * smoothstep(.55, 1., ca) * depth * (1. - wL) * (1. - wP * .6);
        float edge = 1. - smoothstep(.36, .5, a);
        c = mix(c, (wL > .5 ? vec3(.4, .1, .02) : c * .55), edge * .65);
        vec3 L = normalize(vec3(-.5, .7, .6));
        float spec = pow(max(0., dot(reflect(-L, n), vec3(0., 0., 1.))), 22.) * (1. - wL);
        c += spec * .75 + max(0., n.y) * .08 * (1. - wL);
        /* bolhas no lodo */
        if (wP > .5) { vec2 q = fract(vU * vec2(60., 90.) + vec2(0., uT * .2)) - .5; c += smoothstep(.12, .05, length(q)) * .18 * depth; }
        float A = al * mix(.9, 1., wL);
        gl_FragColor = vec4(c * A, A);
      }`);
    const fbo = gl.createFramebuffer(), tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pts = gl.createBuffer();
    return { gl, splat, comp, fbo, tex, quad, pts, tw: 0, th: 0, buf: new Float32Array(D().NX * 0 + 6000) };
  }
  function glDraw(G) {
    const R = G.glr; if (!R) return;
    const gl = R.gl, cv = G.glc, st = G.api.stage, v = G.view;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(st.clientWidth * dpr), H = Math.round(st.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const tw = Math.max(1, Math.round(W / 2)), th = Math.max(1, Math.round(H / 2));
    if (R.tw !== tw || R.th !== th) {
      R.tw = tw; R.th = th;
      gl.bindTexture(gl.TEXTURE_2D, R.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, R.tex, 0);
    }
    /* partículas (sem vapor: esse é desenhado em 2D) */
    const S = G.S; let k = 0; const B = R.buf.length < S.n * 3 ? (R.buf = new Float32Array(S.n * 3 + 300)) : R.buf;
    for (let i = 0; i < S.n; i++) { if (S.dead[i] || S.ty[i] === 3) continue; B[k++] = S.x[i]; B[k++] = S.y[i]; B[k++] = S.ty[i]; }
    const cnt = k / 3;
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.fbo); gl.viewport(0, 0, tw, th);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (cnt) {
      gl.useProgram(R.splat);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      /* lógicas → 0..1 do ecrã (no CPU: sem distorção de aspeto) */
      for (let i = 0; i < k; i += 3) { B[i] = (B[i] * v.s + v.ox) / v.cw; B[i + 1] = (B[i + 1] * v.s + v.oy) / v.ch; }
      gl.bindBuffer(gl.ARRAY_BUFFER, R.pts); gl.bufferData(gl.ARRAY_BUFFER, B.subarray(0, k), gl.DYNAMIC_DRAW);
      const la = gl.getAttribLocation(R.splat, 'a'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4f(gl.getUniformLocation(R.splat, 'uV'), 1, 0, 0, 0);
      gl.uniform1f(gl.getUniformLocation(R.splat, 'uPs'), 23 * v.s * dpr / 2);
      gl.drawArrays(gl.POINTS, 0, cnt);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!cnt) return;
    gl.useProgram(R.comp); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); const qa = gl.getAttribLocation(R.comp, 'a'); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.uniform1i(gl.getUniformLocation(R.comp, 'uF'), 0);
    gl.uniform2f(gl.getUniformLocation(R.comp, 'uPx'), 1 / tw, 1 / th);
    gl.uniform1f(gl.getUniformLocation(R.comp, 'uT'), G.t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ════════════════════════════════════════════════════════════════
     sessão
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const li = Math.max(0, Math.min(LV().length - 1, parseInt(o.mode, 10) || 0));
    const L = DripLevels.get(li);
    const G = { api, li, L, S: DripSim.create(L), t: 0, acc: 0, drink: 0, mood: 0, look: [0, 0], fx: [], steamFx: [], bloomFx: [], strokes: [], digT: 0, won: false, endT: 0 };
    G.S.ev.length = 0;
    return G;
  }
  function stageLayers(G, api) {
    const st = api.stage;
    const mk = (z) => { const c = document.createElement('canvas'); c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:${z}`; st.insertBefore(c, st.firstChild); return c; };
    G.glc = mk(0); G.bg = mk(0);
    st.insertBefore(G.bg, st.firstChild);
    const cv2 = st.querySelector('.ak-cv'); if (cv2) { cv2.style.position = 'absolute'; cv2.style.zIndex = '1'; }
    try { G.glr = glInit(G); } catch (e) { console.warn('[gota] WebGL', e); G.glr = null; }
    paintBG(G);
    terrainInit(G);
    /* botões do jogo */
    const ui = document.createElement('div'); ui.className = 'dr-ui';
    ui.innerHTML = `<button data-a="restart" aria-label="Recomeçar o nível" title="Recomeçar">↻</button><button data-a="hint" aria-label="Dica" title="Dica">💡</button>`;
    if (!document.getElementById('dr-css')) {
      const s = document.createElement('style'); s.id = 'dr-css';
      s.textContent = `.dr-ui{position:absolute;right:10px;bottom:12px;z-index:4;display:flex;flex-direction:column;gap:8px}
.dr-ui button{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(20,12,6,.6);color:#fff;font-size:1.1rem;cursor:pointer;backdrop-filter:blur(6px)}
.dr-ui button:hover{background:rgba(255,255,255,.15)}
.dr-tip{position:absolute;z-index:4;background:rgba(20,12,6,.72);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:12px;padding:6px 12px;font:600 .74rem ${FONT};text-align:center;pointer-events:none;transition:opacity .4s;line-height:1.3}`;
      document.head.appendChild(s);
    }
    st.appendChild(ui); G.ui = ui;
    ui.addEventListener('pointerdown', e => e.stopPropagation());
    ui.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'restart') api.restart();
      else if (b.dataset.a === 'hint') { G.hintT = 6; api.sfx.tone(880, .08, 'triangle', .05); }
    });
    if (G.L.tip) tip(G, G.L.tip, 6);
    /* 1.º nível: mostra logo o caminho a tracejado */
    if (G.li === 0) G.hintT = 5;
    G.ro = new ResizeObserver(() => { if (!G.dead) paintBG(G); }); G.ro.observe(st);
  }
  function tip(G, text, dur) {
    let el = G.api.stage.querySelector('.dr-tip');
    if (!el) { el = document.createElement('div'); el.className = 'dr-tip'; G.api.stage.appendChild(el); }
    el.innerHTML = text; el.style.opacity = 1;
    /* em baixo: na faixa livre sob o tabuleiro (telemóvel) ou entre o medidor do vaso e os botões */
    const st = G.api.stage, sc = Math.min(st.clientWidth / VW, st.clientHeight / VH), ox = (st.clientWidth - VW * sc) / 2, oy = (st.clientHeight - VH * sc) / 2;
    const free = oy >= 48;
    el.style.left = Math.round(free ? 10 : ox + 172 * sc) + 'px'; el.style.right = '62px'; el.style.bottom = Math.round(free ? 10 : oy + 8 * sc) + 'px';
    clearTimeout(G._tip); G._tip = setTimeout(() => { if (el.isConnected) el.style.opacity = 0; }, (dur || 4) * 1000);
    G.tipOn = true;
  }
  /* some pouco depois de se começar a escavar (a dica já foi lida no ecrã inicial) */
  function tipAway(G) {
    if (!G.tipOn) return; G.tipOn = false;
    clearTimeout(G._tip); G._tip = setTimeout(() => { const el = G.api.stage.querySelector('.dr-tip'); if (el) el.style.opacity = 0; }, 900);
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.bg) stageLayers(G, api);
    const S = G.S;
    G.acc = Math.min(G.acc + dt, .06);
    while (G.acc >= DripSim.DT) { DripSim.step(S); G.acc -= DripSim.DT; }
    if (S.dirty) {
      /* refaz só a zona tocada (marcada ao escavar); reações/comportas refazem tudo */
      const r = G.dirtyR; if (r) paintTerrain(G, r[0], r[1], r[2], r[3]); else paintTerrain(G, 0, 0, VW, VH);
      S.dirty = false; G.dirtyR = null;
    }
    events(G, api);
    /* o Rebento olha para a água mais próxima */
    const pot = S.pot, hx = pot.x + pot.w / 2, hy = pot.y - 2;
    let best = 1e9, bx = hx, by = hy - 60;
    for (let i = 0; i < S.n; i += 3) { if (S.dead[i] || S.ty[i] !== 0) continue; const d = (S.x[i] - hx) ** 2 + (S.y[i] - hy) ** 2; if (d < best) { best = d; bx = S.x[i]; by = S.y[i]; } }
    const ang = Math.atan2(by - hy, bx - hx), m = Math.min(1, Math.sqrt(best) / 80);
    G.look[0] += (Math.cos(ang) * 2.6 * m - G.look[0]) * Math.min(1, dt * 6); G.look[1] += (Math.sin(ang) * 2.6 * m - G.look[1]) * Math.min(1, dt * 6);
    G.near = Math.sqrt(best);
    G.drink = Math.max(0, G.drink - dt * 2.2);
    /* poison/lava perto → assustado */
    let danger = 1e9; for (let i = 0; i < S.n; i += 2) { if (S.dead[i] || (S.ty[i] !== 1 && S.ty[i] !== 2)) continue; danger = Math.min(danger, Math.hypot(S.x[i] - hx, S.y[i] - hy)); }
    G.scared = danger < 120;
    G.fx = G.fx.filter(f => (f.t += dt) < f.life);
    G.bloomFx = G.bloomFx.filter(f => (f.t += dt) < f.life);
    S.buds.forEach(b => {
      if (b.t > 0) b.t -= dt; if (b.state !== 'bud') b.anim = Math.min(1, (b.anim || 0) + dt * 2.5);
      /* a roda gira com cada gota que passa; ligada, gira sempre */
      b.w = b.state === 'bloom' ? (b.w || 0) + (9 - (b.w || 0)) * Math.min(1, dt * 3) : (b.w || 0) * Math.exp(-dt * 2.2);
      b.rot = (b.rot || 0) + b.w * dt;
    });
    S.switches.forEach(s => { if (s.on) s.anim = Math.min(1, (s.anim || 0) + dt * 3); });
    if (G.hintT > 0) G.hintT -= dt;
    /* fim */
    if (S.state === 'win' && !G.won) { G.won = true; G.endT = 0; api.sfx.win(); }
    if (G.won) { G.endT += dt; if (G.endT > 2.2 && !G.panel) finish(G, api, true); }
    if (S.state === 'fail' && !G.lost) { G.lost = true; G.endT = 0; api.sfx.lose(); api.vibe(80); }
    if (G.lost) { G.endT += dt; if (G.endT > 1.8 && !G.panel) finish(G, api, false); }
  }

  function events(G, api) {
    const S = G.S, sf = api.sfx;
    for (const e of S.ev) {
      if (e.t === 'drink') { G.drink = 1; if (Math.random() < .25) sf.tone(520 + Math.random() * 300, .06, 'sine', .04, 0, 820); }
      else if (e.t === 'sip') { sf.tone(900 + e.b.got * 60, .06, 'triangle', .04); e.b.w = Math.min(10, (e.b.w || 0) + 4); }
      else if (e.t === 'bloom') { sf.tone(110, .35, 'sawtooth', .04, 0, 330); sf.arp([523, 784, 1046], .05, .1, 'square', .05); api.vibe(20); G.bloomFx.push({ x: e.b.x, y: e.b.y - 34, t: 0, life: 1.2 }); api.burst(e.b.x, e.b.y - 34, 16, { colors: ['#ffe066', '#7ef0ff', '#ffffff'], speed: 170 }); }
      else if (e.t === 'wilt') { sf.tone(300, .3, 'sawtooth', .05, 0, 120); }
      else if (e.t === 'switch') { sf.tone(440, .08, 'square', .05); sf.tone(660, .1, 'square', .05, .08); sf.noise(.5, .05, .1, 600); }
      else if (e.t === 'valve') { sf.noise(.35, .05, 0, 900); sf.tone(330, .08, 'square', .04); }
      else if (e.t === 'boom') { sf.noise(.8, .2, 0, 200, 'lowpass'); sf.tone(70, .5, 'sine', .2, 0, 30); api.shake(10, .4); api.flash('#fff3d0', .12); api.burst(e.x, e.y, 40, { colors: ['#ffb347', '#ff6a1a', '#5a3a22', '#8a5a34'], speed: 300 }); G.fx.push({ k: 'ring', x: e.x, y: e.y, r: e.r, t: 0, life: .5 }); G.dirtyR = null; }
      else if (e.t === 'hiss') { if (Math.random() < .3) sf.noise(.3, .04, 0, 3000, 'highpass'); G.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, life: 1.1 }); G.dirtyR = null; }
      else if (e.t === 'fizz') { if (Math.random() < .3) sf.noise(.2, .04, 0, 4000, 'highpass'); G.fx.push({ k: 'fizz', x: e.x, y: e.y, t: 0, life: .7 }); }
      else if (e.t === 'boil') { if (Math.random() < .1) sf.noise(.2, .03, 0, 2500, 'highpass'); }
      else if (e.t === 'rain') { if (Math.random() < .15) sf.tone(1200 + Math.random() * 600, .04, 'sine', .02); }
      else if (e.t === 'slurp') { if (Math.random() < .2) sf.tone(220, .08, 'sine', .04, 0, 160); G.dirtyR = null; }
      else if (e.t === 'burn') { G.dirtyR = null; G.fx.push({ k: 'fizz', x: e.x, y: e.y, t: 0, life: .6 }); }
      else if (e.t === 'fire') { G.dirtyR = null; if (Math.random() < .2) sf.noise(.25, .03, 0, 1500); G.fx.push({ k: 'puff', x: e.x, y: e.y, t: 0, life: .9 }); }
    }
    S.ev.length = 0;
  }

  function finish(G, api, won) {
    G.panel = true;
    const S = G.S, stars = S.buds.filter(b => b.state === 'bloom').length;
    if (won) {
      const sv = save(); sv.s[G.L.id] = Math.max(sv.s[G.L.id] != null ? sv.s[G.L.id] : -1, stars); putSave(sv);
      try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: true, score: stars * 1000 + Math.max(0, 600 - Math.round(S.t * 10)), mode: G.L.id, meta: { stars, level: G.li + 1 } }); } catch (e) {}
    } else { try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: false, score: 0, mode: G.L.id }); } catch (e) {} }
    const next = LV()[G.li + 1];
    api.panel({
      icon: won ? (stars === 3 ? '⚡' : '🌱') : '💧', title: won ? (stars === 3 ? 'Energia total!' : 'O Rebento bebeu!') : 'Oh não…',
      stars: won ? stars : null,
      sub: won ? `${G.L.name}${stars < 3 ? '<br><small>Liga as 3 turbinas para ganhar ★★★</small>' : ''}` : S.failWhy,
      stats: won ? [['Turbinas', stars + '/3'], ['Tempo', Math.round(S.t) + ' s']] : null,
      buttons: [
        ...(won && next ? [{ label: '▶ Próximo nível', primary: true, fn: () => api.play(String(G.li + 1)) }] : []),
        { label: won ? '↺ Repetir' : '↺ Tentar de novo', primary: !won, fn: () => api.restart() },
        { label: 'Escolher nível', fn: () => api.menu() },
      ],
    });
  }

  /* ════════════════════════════════════════════════════════════════
     desenho (canvas do kit, coordenadas lógicas)
  ════════════════════════════════════════════════════════════════ */
  function draw(G, ctx, W, H, api) {
    if (!G.bg) return;
    glDraw(G);
    const S = G.S;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(G.tc, 0, 0, VW, VH);
    /* comportas e válvulas */
    S.gates.forEach(g => drawGate(ctx, G, g, false));
    S.valves.forEach(g => drawGate(ctx, G, g, true));
    S.heaters.forEach(h => drawHeater(ctx, G, h));
    S.conds.forEach(c => drawCond(ctx, G, c));
    S.spouts.forEach(sp => drawSpout(ctx, G, sp));
    S.switches.forEach(s => drawSwitch(ctx, G, s));
    S.bombs.forEach(b => b.live && drawBomb(ctx, G, b));
    S.buds.forEach(b => drawBud(ctx, G, b));
    drawRebento(ctx, G);
    /* musgo a arder */
    if (S.burning && S.burning.size) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let k = 0;
      S.burning.forEach((tm, i) => {
        if ((k++ & 1) && S.burning.size > 200) return;
        const x = (i % D().NX + .5) * D().FS, y = (Math.floor(i / D().NX) + .5) * D().FS, f = Math.sin(G.t * 30 + i) * .5 + .5;
        ctx.fillStyle = `rgba(255,${120 + f * 100 | 0},30,${.35 + f * .3})`; ctx.beginPath(); ctx.ellipse(x, y - 3 - f * 3, 3.5, 6 + f * 3, 0, 0, 7); ctx.fill();
      });
      ctx.restore();
    }
    /* vapor */
    ctx.save();
    for (let i = 0; i < S.n; i++) {
      if (S.dead[i] || S.ty[i] !== 3) continue;
      const a = Math.min(.55, S.life[i] * .12);
      ctx.globalAlpha = a; ctx.fillStyle = '#f4f8ff';
      ctx.beginPath(); ctx.arc(S.x[i], S.y[i], 6 + (i % 4), 0, 7); ctx.fill();
    }
    ctx.restore();
    /* efeitos */
    G.fx.forEach(f => {
      const k = f.t / f.life;
      if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,220,160,${1 - k})`; ctx.lineWidth = 6 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.3 + k * 1.1), 0, 7); ctx.stroke(); }
      else if (f.k === 'puff') { ctx.fillStyle = `rgba(240,240,240,${.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y - k * 30, 5 + k * 12, 0, 7); ctx.fill(); }
      else if (f.k === 'fizz') { ctx.fillStyle = `rgba(210,170,255,${.7 * (1 - k)})`; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(f.x + Math.sin(j * 2 + f.t * 9) * 6, f.y - k * 18 - j * 4, 2.2, 0, 7); ctx.fill(); } }
    });
    G.bloomFx.forEach(f => { const k = f.t / f.life; ctx.strokeStyle = `rgba(255,230,120,${1 - k})`; ctx.lineWidth = 3; for (let j = 0; j < 8; j++) { const a = j / 8 * 6.28 + k; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * (14 + k * 10), f.y + Math.sin(a) * (14 + k * 10)); ctx.lineTo(f.x + Math.cos(a) * (20 + k * 26), f.y + Math.sin(a) * (20 + k * 26)); ctx.stroke(); } });
    /* dica: caminho a tracejado */
    if (G.hintT > 0 && G.L.sol) {
      ctx.save(); ctx.globalAlpha = Math.min(1, G.hintT); ctx.setLineDash([10, 9]); ctx.lineDashOffset = -G.t * 40; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      G.L.sol.forEach(st => {
        if (st.d) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 5; ctx.beginPath(); st.d.forEach(([cx, cy], k) => { const x = cx * 20, y = (cy + 2) * 20; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
        if (st.tap) { const x = st.tap[0] * 20, y = (st.tap[1] + 2) * 20; ctx.setLineDash([]); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(G.t * 6) * 3, 0, 7); ctx.stroke(); ctx.setLineDash([10, 9]); }
      });
      ctx.restore();
    }
    /* medidor do vaso (canto) */
    const k = Math.min(1, S.fill / S.need);
    ctx.save(); ctx.translate(14, VH - 26);
    ctx.fillStyle = 'rgba(15,8,4,.6)'; U.rr(ctx, 0, 0, 150, 16, 8); ctx.fill();
    const gr = ctx.createLinearGradient(0, 0, 150, 0); gr.addColorStop(0, '#3fb6ff'); gr.addColorStop(1, '#7ef0ff');
    ctx.fillStyle = gr; U.rr(ctx, 2, 2, Math.max(8, 146 * k), 12, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💧 ' + Math.round(k * 100) + '%', 75, 8.5);
    ctx.restore();
  }

  /* ── o Rebento (plantinha num vaso de barro) ── */
  function drawRebento(ctx, G) {
    const S = G.S, p = S.pot, cx = p.x + p.w / 2, top = p.y + 6;
    const k = Math.min(1, S.fill / S.need), t = G.t;
    ctx.save();
    /* vaso */
    const pw = p.w + 10, ph = p.h + 18, x0 = cx - pw / 2;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(cx, top + ph + 2, pw * .5, 5, 0, 0, 7); ctx.fill();
    const pg = ctx.createLinearGradient(x0, 0, x0 + pw, 0); pg.addColorStop(0, '#9c4a25'); pg.addColorStop(.35, '#d8784a'); pg.addColorStop(.7, '#c0612f'); pg.addColorStop(1, '#7d3519');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(x0 + 4, top + 8); ctx.lineTo(x0 + pw - 4, top + 8); ctx.lineTo(x0 + pw - 12, top + ph); ctx.lineTo(x0 + 12, top + ph); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,20,8,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    /* terra do vaso (escurece com a água) */
    ctx.fillStyle = `rgb(${110 - k * 50},${70 - k * 32},${40 - k * 18})`; ctx.beginPath(); ctx.ellipse(cx, top + 6, pw * .46, 5, 0, 0, 7); ctx.fill();
    /* aro */
    ctx.fillStyle = '#c96a3a'; U.rr(ctx, x0 - 2, top - 2, pw + 4, 11, 4); ctx.fill(); ctx.strokeStyle = 'rgba(60,20,8,.6)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,180,.35)'; ctx.fillRect(x0 + 2, top, pw - 4, 2.5);
    /* símbolo de gota no vaso */
    ctx.fillStyle = 'rgba(255,240,220,.85)'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('♥', cx, top + 30);
    /* caule + folhas (crescem com a água) */
    const sway = Math.sin(t * 1.6) * 2 + (G.drink > 0 ? Math.sin(t * 18) * 1.5 : 0);
    const stemH = 14 + k * 16;
    const hx = cx + sway, hy = top - stemH;
    ctx.strokeStyle = '#3f8f2c'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, top + 4); ctx.quadraticCurveTo(cx - 3, top - stemH * .5, hx, hy + 10); ctx.stroke();
    const leaf = (side, sz, y) => { ctx.save(); ctx.translate(cx + side * 2, y); ctx.rotate(side * (.7 - (G.scared ? .4 : 0) + Math.sin(t * 2 + side) * .08)); ctx.fillStyle = '#5cbf3a'; ctx.beginPath(); ctx.ellipse(side * sz * .6, 0, sz * .7, sz * .32, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2f7a20'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * sz * 1.1, 0); ctx.stroke(); ctx.restore(); };
    leaf(-1, 9 + k * 6, top - 2); leaf(1, 9 + k * 6, top - 5);
    if (k > .5) { leaf(-1, 7 * (k - .5) * 2 + 2, top - stemH * .55); leaf(1, 7 * (k - .5) * 2 + 2, top - stemH * .6); }
    /* cabeça (semente redonda) */
    const R = 15;
    const hg = ctx.createRadialGradient(hx - 5, hy - 6, 2, hx, hy, R + 2); hg.addColorStop(0, '#b6f07a'); hg.addColorStop(1, '#4fa62f');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, R, R * .92, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2f6e1c'; ctx.lineWidth = 1.6; ctx.stroke();
    /* rebento no topo da cabeça / duas folhas novas quando ganha */
    if (G.won) {
      const b = Math.min(1, G.endT * 1.5);
      [-1, 1].forEach(sd => { ctx.save(); ctx.translate(hx, hy - R + 2); ctx.rotate(sd * (.55 + Math.sin(t * 3 + sd) * .08)); ctx.fillStyle = sd < 0 ? '#5cbf3a' : '#6fd04a'; ctx.beginPath(); ctx.ellipse(0, -9 * b, 4.5 * b, 9 * b, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2f7a20'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * b); ctx.stroke(); ctx.restore(); });
    } else { ctx.fillStyle = '#6fd04a'; ctx.beginPath(); ctx.ellipse(hx + 3, hy - R + 1, 5, 2.6, -.6, 0, 7); ctx.fill(); }
    /* olhos */
    const blink = (t % 3.7) < .12 || G.drink > .6;
    [-5.5, 5.5].forEach(ex => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hx + ex, hy - 1, 4.2, blink ? .8 : 5, 0, 0, 7); ctx.fill();
      if (!blink) { ctx.fillStyle = '#1c1c28'; ctx.beginPath(); ctx.arc(hx + ex + G.look[0], hy - 1 + G.look[1], 2.4, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + ex + G.look[0] - .8, hy - 2 + G.look[1], .8, 0, 7); ctx.fill(); }
    });
    /* bochechas e boca */
    ctx.fillStyle = 'rgba(255,120,120,.45)'; ctx.beginPath(); ctx.ellipse(hx - 9, hy + 5, 3, 1.8, 0, 0, 7); ctx.ellipse(hx + 9, hy + 5, 3, 1.8, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1c1c28'; ctx.lineWidth = 1.6; ctx.beginPath();
    if (G.lost) { ctx.arc(hx, hy + 10, 4, Math.PI * 1.15, Math.PI * 1.85); }
    else if (G.drink > 0 || G.won) { ctx.fillStyle = '#7a2230'; ctx.ellipse(hx, hy + 6, 3.4, 2.6 + G.drink, 0, 0, 7); ctx.fill(); }
    else if (G.scared) { ctx.ellipse(hx, hy + 7, 2, 2.6, 0, 0, 7); }
    else if (G.near < 90) { ctx.arc(hx, hy + 4, 4, .2, Math.PI - .2); }
    else { ctx.moveTo(hx - 3, hy + 6); ctx.quadraticCurveTo(hx, hy + 8, hx + 3, hy + 6); }
    ctx.stroke();
    /* "tenho sede" */
    if (!G.won && !G.lost && k < .05 && (t % 5) < 2.2 && G.t > 2) {
      ctx.fillStyle = 'rgba(255,255,255,.92)'; U.rr(ctx, hx + 14, hy - 34, 40, 20, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + 18, hy - 15); ctx.lineTo(hx + 12, hy - 8); ctx.lineTo(hx + 26, hy - 15); ctx.fill();
      ctx.fillStyle = '#3fb6ff'; ctx.beginPath(); ctx.moveTo(hx + 34, hy - 30); ctx.quadraticCurveTo(hx + 40, hy - 22, hx + 34, hy - 18); ctx.quadraticCurveTo(hx + 28, hy - 22, hx + 34, hy - 30); ctx.fill();
    }
    ctx.restore();
  }

  /* turbina: roda de pás que a água faz girar; ao ligar acende a lâmpada */
  function drawBud(ctx, G, b) {
    const t = G.t, on = b.state === 'bloom', dead = b.state === 'dead';
    const g = on ? 1 : b.got / b.need, rot = b.rot || 0;
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1.2, 1.2);
    if (b.t > 0) ctx.translate(Math.sin(b.t * 60) * 1.2, 0);
    if (on) { const a = b.anim || 1; ctx.scale(.85 + a * .15, .85 + a * .15); }
    /* brilho de fundo (ciano à espera, amarelo ligada) */
    ctx.fillStyle = dead ? 'rgba(0,0,0,.18)' : on ? `rgba(255,214,90,${.22 + Math.sin(t * 8 + b.x) * .06})` : `rgba(120,220,255,${.13 + Math.sin(t * 3 + b.x) * .05})`;
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
    /* poste + lâmpada por cima */
    ctx.strokeStyle = dead ? '#4a4038' : '#5d6b78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, -24); ctx.stroke();
    if (on) {
      const fl = .85 + Math.sin(t * 23 + b.x) * .08;
      const lg = ctx.createRadialGradient(0, -28, 1, 0, -28, 16); lg.addColorStop(0, `rgba(255,236,140,${.75 * fl})`); lg.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, -28, 16, 0, 7); ctx.fill();
    }
    ctx.fillStyle = dead ? '#3b342e' : on ? '#ffe680' : '#55606b'; ctx.beginPath(); ctx.arc(0, -28, 4.6, 0, 7); ctx.fill();
    ctx.strokeStyle = dead ? '#2a241f' : on ? '#e0a922' : '#2f3740'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#8a96a2'; ctx.fillRect(-2.6, -24.5, 5.2, 2.4);
    if (dead) { ctx.strokeStyle = '#a7b0b8'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-2, -31); ctx.lineTo(.5, -28); ctx.lineTo(-1, -25.5); ctx.stroke(); }
    /* raios da lâmpada acesa */
    if (on) { ctx.strokeStyle = 'rgba(255,230,120,.9)'; ctx.lineWidth = 1.6; for (let j = 0; j < 5; j++) { const a = -Math.PI / 2 + (j - 2) * .55, r0 = 8 + Math.sin(t * 10 + j) * 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, -28 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (r0 + 4), -28 + Math.sin(a) * (r0 + 4)); ctx.stroke(); } }
    /* caixa / eixo atrás da roda */
    ctx.fillStyle = dead ? '#3d342c' : '#46525e'; U.rr(ctx, -5, -12, 10, 6, 2); ctx.fill();
    /* roda de pás */
    ctx.save(); ctx.rotate(rot);
    const blade = dead ? '#5a4a3a' : on ? '#d9e3ea' : '#a9b6c2', edge = dead ? '#2e261f' : '#3c4752';
    /* raios + aro */
    ctx.strokeStyle = dead ? '#4a3c30' : '#7d8b98'; ctx.lineWidth = 1.6;
    for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); ctx.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5); ctx.stroke(); }
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, 7); ctx.stroke();
    /* pás à volta do aro */
    for (let j = 0; j < 8; j++) {
      if (dead && j === 3) continue;   /* pá partida */
      ctx.save(); ctx.rotate(j / 8 * Math.PI * 2);
      ctx.fillStyle = blade; U.rr(ctx, -2.6, 9.2, 5.2, 7, 1.2); ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = .9; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    /* cubo */
    ctx.fillStyle = dead ? '#3a2f26' : on ? '#ffcc3a' : '#7b8996'; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
    /* progresso (quanta água já passou) */
    if (!on && !dead && g > 0) { ctx.strokeStyle = '#7ad8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 17.5, -Math.PI / 2, -Math.PI / 2 + g * 6.28); ctx.stroke(); }
    /* avariada: fumo */
    if (dead) { for (let j = 0; j < 2; j++) { const k = ((t * .5 + j * .5 + b.x * .01) % 1); ctx.fillStyle = `rgba(90,90,90,${.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(Math.sin(k * 5 + j) * 3, -6 - k * 22, 3 + k * 5, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  const KEYC = { A: '#ef4444', B: '#f5b301', C: '#22c3e6', V: '#9aa7b4' };
  function drawGate(ctx, G, g, valve) {
    const x0 = g.cx0 * 20, y0 = g.cy0 * 20, w = (g.cx1 - g.cx0 + 1) * 20, h = (g.cy1 - g.cy0 + 1) * 20;
    const col = KEYC[g.key] || '#9aa7b4';
    ctx.save();
    const vis = 1 - g.open;
    if (vis > .01) {
      ctx.beginPath(); if (g.vert) ctx.rect(x0, y0 + h * g.open, w, h * vis); else ctx.rect(x0 + w * g.open, y0, w * vis, h); ctx.clip();
      const gr = ctx.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, '#5d6670'); gr.addColorStop(.5, '#aeb8c2'); gr.addColorStop(1, '#55606a');
      ctx.fillStyle = gr; ctx.fillRect(x0 + 1, y0, w - 2, h);
      ctx.fillStyle = col; const n = g.vert ? Math.max(1, Math.round(h / 20)) : Math.max(1, Math.round(w / 20));
      for (let i = 0; i < n; i++) { if (g.vert) { ctx.fillRect(x0 + 1, y0 + i * 20 + 8, w - 2, 4); } else ctx.fillRect(x0 + i * 20 + 8, y0, 4, h); }
      ctx.fillStyle = 'rgba(20,24,30,.6)'; for (let i = 0; i < n; i++) { const cx = g.vert ? x0 + w / 2 : x0 + i * 20 + 10, cy = g.vert ? y0 + i * 20 + 10 : y0 + h / 2; [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(cx + a * (g.vert ? w / 20 : 1) * .7, cy + b * .7, 1.3, 0, 7); ctx.fill(); }); }
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 1, y0, w - 2, h);
    }
    ctx.restore();
    if (valve) {
      /* volante para tocar */
      const cx = x0 + w / 2, cy = y0 + h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(g.open * 3.14 + (G.t % 1) * 0);
      ctx.strokeStyle = '#d93636'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
      ctx.lineWidth = 2.5; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(j * 1.57) * 10, Math.sin(j * 1.57) * 10); ctx.stroke(); }
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
      ctx.restore();
      if (g.open < .05 && (G.t % 2) < 1) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('toca', cx, cy - 16); }
    }
  }
  function drawSwitch(ctx, G, s) {
    const col = KEYC[s.key];
    ctx.save(); ctx.translate(s.x, s.y);
    /* copo/funil com a cor da comporta */
    ctx.fillStyle = '#3a4048'; ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(12, -8); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-12, -10, 24, 4);
    const k = s.on ? 1 : s.got / s.need;
    ctx.fillStyle = '#4fb6ff'; ctx.beginPath(); ctx.moveTo(-5 - 7 * k, 10 - 18 * k); ctx.lineTo(5 + 7 * k, 10 - 18 * k); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.on ? '✓' : s.key, 0, 2);
    ctx.restore();
  }
  function drawBomb(ctx, G, b) {
    const t = G.t;
    ctx.save(); ctx.translate(b.x, b.y);
    const pulse = 1 + Math.sin(t * 6) * .04; ctx.scale(pulse, pulse);
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 12); g.addColorStop(0, '#5a5f6a'); g.addColorStop(1, '#14161b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 2, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a808c'; ctx.fillRect(-3, -10, 6, 4);
    ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(5, -16, 9, -14); ctx.stroke();
    ctx.fillStyle = (t * 8) % 1 < .5 ? '#ffd24a' : '#ff6a1a'; ctx.beginPath(); ctx.arc(9, -14, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-4, -2, 3, 0, 7); ctx.fill();
    ctx.restore();
    if ((t % 2) < 1) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('toca', b.x, b.y - 20); }
  }
  function drawHeater(ctx, G, h) {
    const t = G.t;
    ctx.save();
    const g = ctx.createLinearGradient(0, h.y, 0, h.y + h.h); g.addColorStop(0, '#ff9a3a'); g.addColorStop(1, '#8a2a10');
    ctx.fillStyle = g; ctx.fillRect(h.x, h.y + h.h * .45, h.w, h.h * .55);
    ctx.strokeStyle = `rgba(255,200,90,${.6 + Math.sin(t * 5 + h.x) * .3})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(h.x + 3, h.y + h.h * .55 + i * 3); ctx.lineTo(h.x + h.w - 3, h.y + h.h * .55 + i * 3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,140,60,.18)'; ctx.fillRect(h.x - 2, h.y - 4, h.w + 4, h.h * .5);
    ctx.restore();
  }
  function drawCond(ctx, G, c) {
    const t = G.t, cx = c.x + c.w / 2, cy = c.y + c.h / 2 + Math.sin(t * 1.4 + c.x) * 1.2;
    ctx.save();
    ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(cx - 6, cy + 2, 6, 0, 7); ctx.arc(cx + 1, cy - 2, 8, 0, 7); ctx.arc(cx + 8, cy + 2, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#9fd8ff'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('❄', cx + 1, cy + 3);
    ctx.restore();
  }
  function drawSpout(ctx, G, sp) {
    ctx.save(); ctx.translate(sp.x, sp.y - 2);
    ctx.fillStyle = '#8c97a3'; ctx.fillRect(-7, -12, 14, 12); ctx.fillStyle = '#b9c3cc'; ctx.fillRect(-9, -2, 18, 6);
    ctx.fillStyle = sp.on && sp.left > 0 ? '#4fb6ff' : '#5a6470'; ctx.beginPath(); ctx.arc(0, -16, 4, 0, 7); ctx.fill();
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     ponteiro: escavar ao arrastar; tocar em bombas/válvulas
  ════════════════════════════════════════════════════════════════ */
  function digLine(G, x0, y0, x1, y1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
    let got = 0;
    for (let i = 0; i <= n; i++) got += DripSim.dig(G.S, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, BRUSH);
    if (got > 0) {
      const r = [Math.min(x0, x1) - BRUSH - 12, Math.min(y0, y1) - BRUSH - 12, Math.max(x0, x1) + BRUSH + 12, Math.max(y0, y1) + BRUSH + 12];
      G.dirtyR = G.dirtyR === undefined || G.dirtyR === null ? (G.S.dirty ? r : r) : [Math.min(G.dirtyR[0], r[0]), Math.min(G.dirtyR[1], r[1]), Math.max(G.dirtyR[2], r[2]), Math.max(G.dirtyR[3], r[3])];
      G.digT += got;
      if (G.digT > 1.2) { G.digT = 0; G.api.sfx.noise(.07, .05, 0, 500 + Math.random() * 400, 'lowpass'); }
      if (Math.random() < .5) G.api.burst(x1, y1, 2, { colors: ['#8a5a34', '#6b4024', '#a87a4e'], speed: 70, life: .5 });
    }
  }
  function down(G, x, y, api) {
    if (G.won || G.lost) return;
    const hit = DripSim.tap(G.S, x, y);
    if (hit) { G.pen = null; api.vibe(15); return; }
    G.pen = { x, y };
    tipAway(G);
    digLine(G, x, y, x, y);
  }
  function move(G, x, y, api, e, pressed) {
    if (!pressed || !G.pen || G.won || G.lost) return;
    digLine(G, G.pen.x, G.pen.y, x, y);
    G.pen.x = x; G.pen.y = y;
  }
  function up(G) { G.pen = null; }

  /* ════════════════════════════════════════════════════════════════
     menu (capítulos × níveis)
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const sv = save(), CHS = DripLevels.CHAPTERS;
      const tot = LV().reduce((s, l) => s + Math.max(0, sv.s[l.id] || 0), 0);
      return `<style>
.dr-m{display:grid;gap:14px}
.dr-c{border-radius:18px;padding:12px 12px 14px;color:#fff}
.dr-c h4{margin:0 0 8px;font:800 1rem ${FONT};display:flex;gap:8px;align-items:center}
.dr-c h4 small{margin-left:auto;font-size:.72rem;opacity:.85}
.dr-c p{margin:-4px 0 8px;font-size:.76rem;opacity:.85}
.dr-ls{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:7px}
.dr-l{aspect-ratio:1;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.22);border-radius:12px;color:#fff;font:800 1rem ${FONT};cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:transform .12s,background .12s}
.dr-l:hover:not([disabled]){transform:translateY(-2px);background:rgba(0,0,0,.34)}
.dr-l[disabled]{opacity:.42;cursor:not-allowed}
.dr-l i{font-style:normal;font-size:.56rem;letter-spacing:.5px}
.dr-tot{font:700 .82rem ${FONT};color:var(--muted,#9aa)}
</style><div class="dr-m"><div class="dr-tot">⚡ ${tot} / ${LV().length * 3} turbinas</div>${CHS.map((c, ci) => {
        const ls = LV().map((l, i) => ({ l, i })).filter(o => o.l.chapter === ci);
        const cs = ls.reduce((s, o) => s + Math.max(0, sv.s[o.l.id] || 0), 0);
        return `<div class="dr-c" style="background:linear-gradient(140deg,${c.grad[0]},${c.grad[1]})"><h4>${c.icon} ${c.name}<small>⚡ ${cs}/${ls.length * 3}</small></h4><p>${c.desc}</p><div class="dr-ls">${ls.map(({ l, i }) => {
          const lock = !unlocked(sv, i), st = sv.s[l.id];
          return `<button class="dr-l" data-m="${i}" ${lock ? 'disabled' : ''} title="${l.name}">${lock ? '🔒' : i + 1}<i>${lock ? '' : st == null ? '·' : '★'.repeat(st) + '<span style="opacity:.3">' + '★'.repeat(3 - st) + '</span>'}</i></button>`;
        }).join('')}</div></div>`;
      }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) start(b.dataset.m); })); },
  };

  let CUR = null;
  const spec = {
    id: ID, title: 'Gota a Gota', icon: '💧', accent: '#3fb6ff', accent2: '#7ef0a0', bg: '#2a1a10', transparent: true, diff: false,
    tagline: 'O Rebento tem sede! Escava a terra com o dedo para levar a água até ao vaso — e faz girar as turbinas pelo caminho. Cuidado com o lodo, a lava e o musgo guloso.',
    view: { w: VW, h: VH }, picker, cursor: 'crosshair',
    get ready() { const L = CUR || LV()[0]; return { title: (CUR ? 'Nível ' + (CUR.index + 1) + ' · ' : '') + L.name, hint: L.tip || 'Arrasta para escavar a terra.' }; },
    how: [
      'Arrasta o dedo (ou o rato) sobre a <b>terra castanha</b> para a escavar. A <b>pedra</b> cinzenta não se escava.',
      'Leva água suficiente até ao <b>vaso do Rebento</b> — o medidor em baixo mostra quanto falta.',
      'Faz passar água pelas 3 <b>turbinas</b> para as ligar e ganhar <b>★★★</b> (cada uma gasta um pouco de água!).',
      'O <b>lodo roxo</b> anula a água e faz mal ao Rebento; a <b>lava</b> com água vira <b>pedra</b> e vapor; o <b>musgo</b> bebe a água mas o lodo mata-o. Toca em <b>bombas</b> e <b>válvulas</b>; enche os copos coloridos para abrir as comportas da mesma cor.',
    ],
    controls: ['🖱️ arrastar = escavar', '👆 tocar = bomba / válvula', '↻ recomeçar · 💡 dica'],
    setup: (api, o) => { const G = setup(api, o); CUR = G.L; return G; },
    update, draw, down, move, up,
    destroy: G => { G.dead = 1; if (G.ro) G.ro.disconnect(); if (G.ui) G.ui.remove(); [G.bg, G.glc].forEach(c => c && c.remove()); const t = G.api && G.api.stage.querySelector('.dr-tip'); if (t) t.remove(); if (G.glr) { const e = G.glr.gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); } },
    hud: G => [['Nível', (G.li + 1) + '/' + LV().length], ['Vaso', Math.min(100, Math.round(G.S.fill / G.S.need * 100)) + '%'], ['Turbinas', G.S.buds.filter(b => b.state === 'bloom').length + '/' + G.S.buds.length]],
    pauseButtons: (G, api) => [{ label: 'Escolher nível', fn: () => api.menu() }],
    achievements: [
      { id: 'drip.first', name: 'Primeira Gota', icon: '💧', desc: 'Leva a água até ao Rebento pela primeira vez.', test: c => c.result.won },
      { id: 'drip.garden', name: 'Eletricista', icon: '⚡', desc: 'Completa um nível do Gota a Gota com as 3 turbinas ligadas.', test: c => c.result.won && (c.result.meta && c.result.meta.stars) === 3 },
    ],
  };
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = {
    LV,
    /* aplica a solução do nível (testes): traços/toques com t <= tt */
    apply(G, tt) { (G.L.sol || []).forEach(st => { if (st.done || (st.t || 0) > (tt == null ? 99 : tt)) return; st.done = 1; if (st.d) for (let k = 0; k < st.d.length - 1; k++) digLine(G, st.d[k][0] * 20, (st.d[k][1] + 2) * 20, st.d[k + 1][0] * 20, (st.d[k + 1][1] + 2) * 20); if (st.tap) DripSim.tap(G.S, st.tap[0] * 20, (st.tap[1] + 2) * 20); }); },
  };
  return KIT;
})();
