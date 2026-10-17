/* ══════════════════════════════════════════════════════════════════
   Operação Soneca — peças do mundo (out/2026)
   Texturas desenhadas em canvas (fachadas com janelas, portadas e
   floreiras, montras, tijolo, chapa ondulada, telha, pedra, calçada…),
   um "lote" que junta tudo o que é fixo numa malha por material (poucas
   chamadas de desenho) e prefabricados com pormenor: casas com rés-do-
   -chão comercial, varandas, cornijas e chaminés; armazéns, contentores,
   gruas, barcos, bancas de feira, igreja, fonte, palco, candeeiros,
   bancos, vedações, sebes, piscina, vivenda, helicóptero, comboio,
   bandeiras e fitas que ondulam ao vento. Cada peça sólida regista uma
   caixa de colisão (o dardo e a linha de vista usam-nas).
══════════════════════════════════════════════════════════════════ */
const SniperKit = (function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const W = () => SkyAceWorld;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ── aleatório determinístico ── */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ════════════════════════════════════════════════════════════════
     texturas (geradas uma vez)
  ════════════════════════════════════════════════════════════════ */
  let TX = null;
  function cv(w, h, draw, srgb, rep) { const t = W().canvasTex(w, h, draw, srgb); if (rep !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
  function noise(x, w, h, a, b, n) { for (let i = 0; i < (n || w * h / 6); i++) { const v = a + Math.random() * (b - a); x.fillStyle = `rgba(${v},${v},${v},${Math.random() * .25})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
  function textures() {
    if (TX) return TX;
    const T = {};
    const R = rng(42);
    /* janela de fachada clássica (célula 128×128 = 3 m × 3 m); atlas 4×4 para variar */
    const winCell = (x, ox, oy, kind, lit) => {
      x.fillStyle = '#f2f0ea'; x.fillRect(ox, oy, 128, 128);
      noise(x, 128, 128, 200, 255, 160); x.save(); x.translate(ox, oy);
      for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(120,110,100,${.015 + Math.sin(i * .3) * .01})`; x.fillRect(0, i, 128, 1); }
      x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, 122, 128, 6);
      const wx = 40, wy = 24, ww = 48, wh = 74;
      /* moldura de pedra, peitoril */
      x.fillStyle = '#e6e1d6'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 10); x.fillStyle = '#d4cec2'; x.fillRect(wx - 9, wy + wh + 2, ww + 18, 7);
      /* vidro com reflexo do céu e cortina */
      const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, '#5d7896'); g.addColorStop(.45, '#2a3a4e'); g.addColorStop(1, '#1b2533');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      if (kind === 1) { x.fillStyle = 'rgba(236,226,206,.85)'; x.fillRect(wx, wy, ww * .32, wh); x.fillRect(wx + ww * .68, wy, ww * .32, wh); }
      if (kind === 2) { x.fillStyle = 'rgba(240,236,228,.7)'; x.fillRect(wx, wy, ww, wh * .45); }
      x.fillStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.moveTo(wx + 6, wy + wh); x.lineTo(wx + 20, wy); x.lineTo(wx + 30, wy); x.lineTo(wx + 14, wy + wh); x.fill();
      x.fillStyle = '#efebe3'; x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy + wh * .38, ww, 4); x.strokeStyle = '#efebe3'; x.lineWidth = 3; x.strokeRect(wx + 1.5, wy + 1.5, ww - 3, wh - 3);
      /* portadas de lâminas (abertas, ou uma fechada) */
      const sh = (sx, closed) => { x.fillStyle = '#b9b4aa'; x.fillRect(sx, wy - 2, 22, wh + 4); for (let k = 0; k < wh; k += 5) { x.fillStyle = '#d6d1c7'; x.fillRect(sx + 2, wy + k, 18, 2); } x.strokeStyle = '#99948a'; x.lineWidth = 1; x.strokeRect(sx + .5, wy - 1.5, 21, wh + 3); };
      if (kind !== 3) { sh(wx - 24); sh(wx + ww + 2); } else { sh(wx + 2); sh(wx + ww - 24); }
      /* floreira em algumas */
      if (kind === 2) { x.fillStyle = '#8a5a3a'; x.fillRect(wx - 4, wy + wh + 4, ww + 8, 9); for (let k = 0; k < 9; k++) { x.fillStyle = ['#e2445c', '#f08bb0', '#ffd34d', '#3f8a3a'][k % 4]; x.beginPath(); x.arc(wx + k * 6, wy + wh + 2, 4, 0, TAU); x.fill(); } }
      x.restore();
      return lit;
    };
    const litMap = [];
    T.facade = cv(512, 512, x => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const k = Math.floor(R() * 4); winCell(x, i * 128, j * 128, k); litMap.push(R() < .4); } });
    T.facadeEm = cv(512, 512, x => { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (litMap[j * 4 + i]) { const g = x.createLinearGradient(0, j * 128 + 24, 0, j * 128 + 98); g.addColorStop(0, ['#ffd08a', '#ffe6b0', '#ffc070', '#d8e6ff'][(i + j) % 4]); g.addColorStop(1, '#a86a2a'); x.fillStyle = g; x.fillRect(i * 128 + 40, j * 128 + 24, 48, 74); } });
    /* fachada moderna (escritórios): faixas de vidro */
    T.office = cv(512, 512, x => {
      x.fillStyle = '#dcdcd8'; x.fillRect(0, 0, 512, 512); noise(x, 512, 512, 190, 240, 900);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const ox = i * 128, oy = j * 128; const g = x.createLinearGradient(ox, oy, ox + 128, oy + 128); g.addColorStop(0, '#7d97b2'); g.addColorStop(.5, '#34465c'); g.addColorStop(1, '#22303f'); x.fillStyle = g; x.fillRect(ox + 6, oy + 14, 116, 92); x.fillStyle = '#5a5f66'; x.fillRect(ox + 62, oy + 14, 4, 92); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(ox + 10, oy + 18, 30, 84); if (R() < .3) { x.fillStyle = 'rgba(230,230,220,.6)'; x.fillRect(ox + 6, oy + 14, 56, 40); } }
    });
    T.officeEm = cv(512, 512, x => { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (R() < .45) { x.fillStyle = R() < .5 ? '#fff0c8' : '#cfe0ff'; x.fillRect(i * 128 + 6, j * 128 + 14, 116, 92); } });
    /* montra de loja (4 m × 3,2 m) */
    T.shop = cv(512, 410, x => {
      x.fillStyle = '#f0ece4'; x.fillRect(0, 0, 512, 410); noise(x, 512, 410, 200, 250, 500);
      x.fillStyle = '#3a3f46'; x.fillRect(10, 80, 330, 300); const g = x.createLinearGradient(14, 84, 330, 376); g.addColorStop(0, '#6a8094'); g.addColorStop(.5, '#2c3846'); g.addColorStop(1, '#1d252e'); x.fillStyle = g; x.fillRect(16, 86, 318, 288);
      for (let k = 0; k < 7; k++) { x.fillStyle = ['#e6c27a', '#d86a5a', '#7ab4d8', '#f0e0b0', '#8ac070'][k % 5]; x.fillRect(30 + k * 42, 300 - (k % 3) * 22, 30, 74 + (k % 3) * 22); }
      x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(40, 374); x.lineTo(120, 86); x.lineTo(160, 86); x.lineTo(80, 374); x.fill();
      x.fillStyle = '#5a3a26'; x.fillRect(370, 90, 120, 300); x.fillStyle = '#6e4a32'; x.fillRect(380, 100, 100, 130); x.fillRect(380, 245, 100, 135); x.fillStyle = '#2a3542'; x.fillRect(392, 112, 76, 106); x.fillStyle = '#d8b860'; x.fillRect(462, 250, 8, 24);
      x.fillStyle = '#c8c2b6'; x.fillRect(0, 384, 512, 26);
    });
    /* porta de entrada de prédio (3 m) */
    T.door = cv(512, 512, x => {
      x.fillStyle = '#f0ece4'; x.fillRect(0, 0, 512, 512); noise(x, 512, 512, 200, 250, 600);
      x.fillStyle = '#ded8cc'; x.fillRect(176, 110, 160, 402); x.fillStyle = '#4a2e1e'; x.fillRect(192, 160, 128, 352);
      for (const [px, py] of [[204, 176], [262, 176], [204, 340], [262, 340]]) { x.fillStyle = '#5a3a28'; x.fillRect(px, py, 46, 150); x.strokeStyle = '#3a2416'; x.lineWidth = 3; x.strokeRect(px + 4, py + 4, 38, 142); }
      x.fillStyle = '#2a3646'; x.beginPath(); x.arc(256, 160, 64, Math.PI, 0); x.fill(); x.strokeStyle = '#ded8cc'; x.lineWidth = 6; for (let a = 0; a < 5; a++) { x.beginPath(); x.moveTo(256, 160); x.lineTo(256 + Math.cos(Math.PI + a * Math.PI / 4) * 64, 160 + Math.sin(Math.PI + a * Math.PI / 4) * 64); x.stroke(); }
      x.fillStyle = '#d8b860'; x.fillRect(300, 330, 8, 26);
      for (const ox of [40, 380]) { x.fillStyle = '#e6e1d6'; x.fillRect(ox - 6, 170, 104, 190); const g = x.createLinearGradient(ox, 176, ox + 92, 350); g.addColorStop(0, '#5d7896'); g.addColorStop(1, '#1b2533'); x.fillStyle = g; x.fillRect(ox, 176, 92, 178); x.fillStyle = '#e8e4dc'; x.fillRect(ox + 44, 176, 4, 178); for (let k = 0; k < 178; k += 18) x.fillRect(ox, 176 + k, 92, 3); }
      x.fillStyle = '#bdb6a8'; x.fillRect(0, 480, 512, 32);
    });
    T.brick = cv(256, 256, x => { x.fillStyle = '#c9c2b8'; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 16; j++) for (let i = -1; i < 9; i++) { const v = 150 + R() * 70; x.fillStyle = `rgb(${v + 30},${v * .55},${v * .42})`; x.fillRect(i * 32 + (j % 2) * 16 + 1, j * 16 + 1, 30, 14); } noise(x, 256, 256, 60, 140, 800); });
    T.corr = cv(128, 128, x => { for (let i = 0; i < 128; i++) { const v = 200 + Math.sin(i / 128 * TAU * 8) * 45; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 128); } noise(x, 128, 128, 120, 200, 300); x.fillStyle = 'rgba(80,60,40,.12)'; for (let k = 0; k < 6; k++) x.fillRect(Math.random() * 128, 0, 2, 128); });
    T.tiles = cv(256, 256, x => { x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 8; j++) for (let i = -1; i < 9; i++) { const v = 200 + R() * 55, ox = i * 32 + (j % 2) * 16, oy = j * 32; const g = x.createLinearGradient(ox, 0, ox + 32, 0); g.addColorStop(0, `rgb(${v * .7},${v * .7},${v * .7})`); g.addColorStop(.5, `rgb(${v},${v},${v})`); g.addColorStop(1, `rgb(${v * .62},${v * .62},${v * .62})`); x.fillStyle = g; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + 32, oy); x.lineTo(ox + 32, oy + 26); x.quadraticCurveTo(ox + 16, oy + 36, ox, oy + 26); x.fill(); } });
    T.planks = cv(256, 256, x => { for (let j = 0; j < 8; j++) { const v = 150 + R() * 60; x.fillStyle = `rgb(${v},${v * .72},${v * .48})`; x.fillRect(0, j * 32, 256, 31); for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(70,40,20,${R() * .2})`; x.fillRect(R() * 256, j * 32 + R() * 30, 30 + R() * 60, 1); } x.fillStyle = 'rgba(40,24,12,.6)'; x.fillRect(0, j * 32 + 31, 256, 1); } });
    T.stone = cv(256, 256, x => { x.fillStyle = '#8a857c'; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 8; j++) for (let i = -1; i < 6; i++) { const v = 170 + R() * 60, w = 40 + R() * 20; x.fillStyle = `rgb(${v},${v * .97},${v * .92})`; x.fillRect(i * 52 + (j % 2) * 24 + 2, j * 32 + 2, w, 28); } noise(x, 256, 256, 80, 200, 1500); });
    T.cobble = cv(256, 256, x => { x.fillStyle = '#6a6660'; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const v = 150 + R() * 70; x.fillStyle = `rgb(${v},${v * .97},${v * .93})`; x.beginPath(); x.ellipse(i * 16 + 8 + (j % 2) * 8 + R() * 2, j * 16 + 8 + R() * 2, 6.5 + R(), 6 + R(), R() * 3, 0, TAU); x.fill(); } });
    T.asphalt = cv(256, 256, x => { x.fillStyle = '#5a5c60'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 40, 140, 6000); for (let k = 0; k < 5; k++) { x.strokeStyle = 'rgba(30,30,30,.35)'; x.lineWidth = 1; x.beginPath(); let px = R() * 256, py = R() * 256; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += R() * 30 - 15; py += R() * 30 - 15; x.lineTo(px, py); } x.stroke(); } });
    T.concrete = cv(256, 256, x => { x.fillStyle = '#c4c0b8'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 120, 230, 3000); x.fillStyle = 'rgba(70,70,70,.45)'; x.fillRect(0, 0, 256, 2); x.fillRect(0, 0, 2, 256); for (let k = 0; k < 10; k++) { x.fillStyle = `rgba(90,80,60,${R() * .12})`; x.beginPath(); x.ellipse(R() * 256, R() * 256, 10 + R() * 30, 6 + R() * 20, R() * 3, 0, TAU); x.fill(); } });
    T.leaf = cv(128, 128, x => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, 128, 128); for (let k = 0; k < 900; k++) { const v = 110 + R() * 145; x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.ellipse(R() * 128, R() * 128, 2 + R() * 3, 1.5 + R() * 2, R() * 3, 0, TAU); x.fill(); } });
    T.grass = cv(256, 256, x => { x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 5000; k++) { const v = 150 + R() * 105; x.fillStyle = `rgba(${v},${v},${v},.6)`; x.fillRect(R() * 256, R() * 256, 1, 2 + R() * 4); } });
    T.detail = cv(256, 256, x => { x.fillStyle = '#e0e0e0'; x.fillRect(0, 0, 256, 256); for (let k = 0; k < 7000; k++) { const v = 170 + R() * 85; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1 + R() * 2); } });
    T.sand = cv(256, 256, x => { x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 170, 255, 9000); });
    T.rails = cv(64, 64, x => { x.fillStyle = '#6e6458'; x.fillRect(0, 0, 64, 64); noise(x, 64, 64, 60, 160, 900); });
    T.glass = null;
    TX = T; return T;
  }
  /* toldos às riscas e placas com texto (cache por cor/texto) */
  const _aw = new Map(), _sg = new Map();
  function awningTex(c) { if (_aw.has(c)) return _aw.get(c); const t = cv(128, 64, x => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f6f2ea' : c; x.fillRect(i * 16, 0, 16, 64); } x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 54, 128, 10); }); _aw.set(c, t); return t; }
  function signTex(text, bg, fg, w, h) {
    const k = text + bg + fg + w; if (_sg.has(k)) return _sg.get(k);
    const t = cv(w || 512, h || 96, (x, cw, ch) => { x.fillStyle = bg; x.fillRect(0, 0, cw, ch); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 4; x.strokeRect(6, 6, cw - 12, ch - 12); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.round(ch * .5)}px 'Space Grotesk', Georgia, serif`; x.fillText(text, cw / 2, ch / 2 + 2); }, true, false);
    _sg.set(k, t); return t;
  }

  /* ════════════════════════════════════════════════════════════════
     materiais
  ════════════════════════════════════════════════════════════════ */
  function materials(env) {
    const T = textures(), m = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMap: env, envMapIntensity: .35, roughness: .85 }, o));
    return {
      plain: m({}), facade: m({ map: T.facade, emissiveMap: T.facadeEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 }), office: m({ map: T.office, emissiveMap: T.officeEm, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: .4, metalness: .2, envMapIntensity: .9 }),
      shop: m({ map: T.shop }), door: m({ map: T.door }), brick: m({ map: T.brick }), corr: m({ map: T.corr, roughness: .55, metalness: .35 }), tiles: m({ map: T.tiles, roughness: .7 }),
      wood: m({ map: T.planks, roughness: .8 }), stone: m({ map: T.stone }), cobble: m({ map: T.cobble, roughness: .9 }), asphalt: m({ map: T.asphalt, roughness: .95 }), concrete: m({ map: T.concrete }), leaf: m({ map: T.leaf, roughness: .95 }),
      grass: m({ map: T.grass, roughness: 1 }), sand: m({ map: T.sand, roughness: 1 }), rails: m({ map: T.rails, roughness: .6, metalness: .4 }),
      metal: m({ roughness: .35, metalness: .75, envMapIntensity: .8 }), glass: m({ roughness: .05, metalness: .3, envMapIntensity: 1.4, transparent: true, opacity: .55, depthWrite: false }), glassS: m({ roughness: .06, metalness: .5, envMapIntensity: 1.2 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), cloth: m({ roughness: .95, side: THREE.DoubleSide }), paint: m({ roughness: .4, metalness: .1, envMapIntensity: .6 }),
    };
  }

  /* ════════════════════════════════════════════════════════════════
     geometrias com UV em metros ou em "janelas"
  ════════════════════════════════════════════════════════════════ */
  /* uv: 'win' → uma janela por ~3 m (atlas 4×4); número = metros por repetição */
  function boxGeo(w, h, d, uv) {
    const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      let a, b, L, H;
      if (ay > .5) { a = x + w / 2; b = z + d / 2; L = w; H = d; }
      else if (ax > .5) { a = (n.getX(i) > 0 ? d / 2 - z : z + d / 2); b = y + h / 2; L = d; H = h; }
      else { a = (n.getZ(i) > 0 ? x + w / 2 : w / 2 - x); b = y + h / 2; L = w; H = h; }
      if (uv === 'win') { const nu = Math.max(1, Math.round(L / 3)), nv = Math.max(1, Math.round(H / 3)); u.setXY(i, a / L * nu / 4, b / H * nv / 4); }
      else { const s = uv || 1; u.setXY(i, a / s, b / s); }
    }
    return g;
  }
  function planeGeo(w, h, su, sv) { const g = new THREE.PlaneGeometry(w, h), u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * (su || 1), u.getY(i) * (sv || 1)); return g; }
  /* telhado de duas águas: cumeeira ao longo de x */
  function gableGeo(w, d, h, over) {
    const x0 = -w / 2 - over, x1 = w / 2 + over, z0 = -d / 2 - over, z1 = d / 2 + over, sl = Math.hypot(d / 2 + over, h);
    const P = [], U = [];
    const quad = (a, b, c, e, ua) => { P.push(...a, ...b, ...c, ...a, ...c, ...e); U.push(...ua[0], ...ua[1], ...ua[2], ...ua[0], ...ua[2], ...ua[3]); };
    const s = 2;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x0, h, 0], [[0, 0], [(x1 - x0) / s, 0], [(x1 - x0) / s, sl / s], [0, sl / s]]);
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, 0], [x1, h, 0], [[0, 0], [(x1 - x0) / s, 0], [(x1 - x0) / s, sl / s], [0, sl / s]]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
    return g;
  }
  function gableEndGeo(w, d, h) {
    const P = [-w / 2, 0, d / 2, -w / 2, 0, -d / 2, -w / 2, h, 0, w / 2, 0, -d / 2, w / 2, 0, d / 2, w / 2, h, 0];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, .5, 0, 0, 1, 0, .5, .5], 2)); g.computeVertexNormals(); return g;
  }

  /* ════════════════════════════════════════════════════════════════
     lote: junta geometrias por material (posição, normal, uv, cor)
  ════════════════════════════════════════════════════════════════ */
  function Batch() {
    const by = new Map(); const _c = new THREE.Color();
    function add(mat, geo, m, color) {
      const q = geo.index ? geo.toNonIndexed() : geo; if (m) q.applyMatrix4(m);
      if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      _c.set(color || '#ffffff');
      let L = by.get(mat); if (!L) by.set(mat, L = { list: [], n: 0 });
      L.list.push([q, _c.r, _c.g, _c.b]); L.n += q.attributes.position.count;
      if (q !== geo) geo.dispose();
    }
    function build(scene, MT, o) {
      const out = [];
      by.forEach((L, key) => {
        const pos = new Float32Array(L.n * 3), nor = new Float32Array(L.n * 3), uv = new Float32Array(L.n * 2), col = new Float32Array(L.n * 3); let k = 0;
        L.list.forEach(([q, r, g, b]) => { const p = q.attributes.position, nn = q.attributes.normal, uu = q.attributes.uv, c = q.attributes.color; for (let i = 0; i < p.count; i++, k++) { pos[k * 3] = p.getX(i); pos[k * 3 + 1] = p.getY(i); pos[k * 3 + 2] = p.getZ(i); nor[k * 3] = nn.getX(i); nor[k * 3 + 1] = nn.getY(i); nor[k * 3 + 2] = nn.getZ(i); uv[k * 2] = uu.getX(i); uv[k * 2 + 1] = uu.getY(i); col[k * 3] = r * (c ? c.getX(i) : 1); col[k * 3 + 1] = g * (c ? c.getY(i) : 1); col[k * 3 + 2] = b * (c ? c.getZ(i) : 1); } q.dispose(); });
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, MT[key] || MT.plain);
        mesh.castShadow = !(o && o.noShadow && o.noShadow.includes(key)) && key !== 'glass' && key !== 'glow'; mesh.receiveShadow = true;
        if (key === 'glass') mesh.renderOrder = 2;
        scene.add(mesh); out.push(mesh);
      });
      by.clear(); return out;
    }
    return { add, build };
  }

  /* ════════════════════════════════════════════════════════════════
     construtor de nível: prefabricados + colisões
  ════════════════════════════════════════════════════════════════ */
  let _e, _q, _v, _s;   /* criados só depois de o three.js carregar */
  const MX = (x, y, z, ry, rx, rz, sx, sy, sz) => { if (!_e) { _e = new THREE.Euler(); _q = new THREE.Quaternion(); _v = new THREE.Vector3(); _s = new THREE.Vector3(); } return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0, 'YXZ')), _s.set(sx || 1, sy || 1, sz || 1)); };

  function Builder(scene, env, hAt, seed) {
    const MT = materials(env), B = Batch(), cols = [], anim = [], R = rng(seed || 1), extras = [];
    /* referencial local (x, z, rotação, chão) → mundo */
    function frame(x, z, yaw, y) { const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), y0 = y != null ? y : hAt(x, z); return { x, z, yaw: yaw || 0, y: y0, at(lx, ly, lz) { return [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c]; } }; }
    /* caixa no referencial F (centro em lx, ly + h/2, lz) */
    function box(F, mat, w, h, d, lx, ly, lz, color, o) {
      o = o || {}; const [x, y, z] = F.at(lx, ly + h / 2, lz), yaw = F.yaw + (o.ry || 0);
      B.add(mat, boxGeo(w, h, d, o.uv), MX(x, y, z, yaw, o.rx, o.rz), color);
      if (o.col) cols.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, c: Math.cos(yaw), s: Math.sin(yaw), k: o.col });
    }
    function geo(F, mat, g, lx, ly, lz, color, ry, rx, rz, sx, sy, sz) { const [x, y, z] = F.at(lx, ly, lz); B.add(mat, g, MX(x, y, z, F.yaw + (ry || 0), rx, rz, sx, sy, sz), color); }
    function collider(F, w, h, d, lx, ly, lz, k, ry) { const [x, y, z] = F.at(lx, ly + h / 2, lz), yaw = F.yaw + (ry || 0); cols.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, c: Math.cos(yaw), s: Math.sin(yaw), k: k || 'solid' }); }
    const pick = a => a[Math.floor(R() * a.length)];
    const WALLS = ['#f3e3c3', '#f2d0b8', '#e8eef0', '#f6e7a8', '#d9e6d0', '#f0c8b0', '#dfe4f0', '#f4f1ea', '#e8c9a0', '#cfe0e8'];

    /* ── prédio/casa urbana ── */
    function house(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), w = o.w || 9, d = o.d || 10, fl = o.floors || 3, wall = o.wall || pick(WALLS), H = 3.2 + (fl - 1) * 3;
      box(F, 'stone', w + .12, .5, d + .12, 0, -.3, 0, '#d8d2c6', { uv: 2 });
      box(F, 'facade', w, 3.2, d, 0, 0, 0, wall, { uv: 'win' });
      if (fl > 1) box(F, o.office ? 'office' : 'facade', w, H - 3.2, d, 0, 3.2, 0, wall, { uv: 'win' });
      collider(F, w, H, d, 0, 0, 0, 'wall');
      /* rés-do-chão: montra ou porta só na frente (+z) */
      const front = o.shop ? 'shop' : 'door', fw = o.shop ? Math.max(4, Math.round(w / 4) * 4) : 3;
      if (fw <= w) geo(F, front, planeGeo(Math.min(fw, w - .2), 3.2, o.shop ? Math.min(fw, w - .2) / 4 : 1, 1), 0, 1.6, d / 2 + .02, '#ffffff');
      /* cornijas por andar e remate */
      for (let f = 1; f < fl; f++) box(F, 'plain', w + .16, .16, d + .16, 0, 3.2 + (f - 1) * 3 - .08, 0, '#ece6da');
      box(F, 'plain', w + .3, .28, d + .3, 0, H - .1, 0, '#e6dfd2');
      /* toldo e letreiro */
      if (o.shop) {
        const aw = Math.min(w - .4, fw);
        const am = MT['aw:' + o.shop.c] || (MT['aw:' + o.shop.c] = new THREE.MeshStandardMaterial({ map: awningTex(o.shop.c), roughness: .9, side: THREE.DoubleSide, envMap: env, envMapIntensity: .3 }));
        geo(F, 'aw:' + o.shop.c, planeGeo(aw, 1.6, aw / 2, 1), 0, 2.85, d / 2 + .7, '#ffffff', 0, -1.1);
        box(F, 'metal', aw, .05, .05, 0, 2.5, d / 2 + 1.35, '#3a3a3a');
        if (o.shop.t) { const sm = new THREE.Mesh(planeGeo(Math.min(aw, 4.5), .7), new THREE.MeshStandardMaterial({ map: signTex(o.shop.t, o.shop.bg || '#1f3a5a', o.shop.fg || '#fff3d6'), roughness: .6, envMap: env, envMapIntensity: .3 })); const [x, y, z] = F.at(0, 3.55, d / 2 + .06); sm.position.set(x, y, z); sm.rotation.y = F.yaw; sm.receiveShadow = true; scene.add(sm); extras.push(sm); }
      }
      /* varandas de ferro na frente (andares de cima) */
      if (o.balc !== false && fl > 1) {
        const n = Math.max(1, Math.round(w / 3));
        for (let f = 1; f < fl; f++) for (let i = 0; i < n; i++) {
          if ((i + f) % 2 && !o.allBalc) continue;
          const lx = -w / 2 + (i + .5) * w / n, ly = 3.2 + (f - 1) * 3;
          box(F, 'stone', 1.7, .12, .75, lx, ly - .02, d / 2 + .37, '#e2ddd2');
          box(F, 'metal', 1.7, .05, .04, lx, ly + .95, d / 2 + .72, '#2c2f33');
          for (let k = 1; k < 8; k += 2) box(F, 'metal', .03, .95, .03, lx - .85 + k * .2125, ly + .05, d / 2 + .72, '#2c2f33');
          box(F, 'metal', 1.7, .04, .03, lx, ly + .5, d / 2 + .72, '#2c2f33');
          box(F, 'metal', .04, .95, .7, lx - .85, ly + .05, d / 2 + .37, '#2c2f33'); box(F, 'metal', .04, .95, .7, lx + .85, ly + .05, d / 2 + .37, '#2c2f33');
          if (R() < .35) for (let k = 0; k < 3; k++) geo(F, 'leaf', new THREE.IcosahedronGeometry(.18, 0), lx - .5 + k * .5, ly + .3, d / 2 + .55, pick(['#d84a6a', '#4a9a4a', '#e88ab0', '#3c8a40']));
        }
      }
      /* algeroz/tubo de queda nos cantos da frente */
      [-1, 1].forEach(sd => box(F, 'metal', .09, H, .09, sd * (w / 2 - .05), 0, d / 2 + .06, '#5a5f66'));
      /* cobertura */
      if (o.roof === 'flat' || o.office) {
        [[w, .9, .25, 0, d / 2 - .12], [w, .9, .25, 0, -d / 2 + .12], [.25, .9, d, w / 2 - .12, 0], [.25, .9, d, -w / 2 + .12, 0]].forEach(([a, b, c, lx, lz]) => box(F, 'plain', a, b, c, lx, H, lz, '#dcd6ca'));
        box(F, 'concrete', w - .5, .05, d - .5, 0, H, 0, '#a9a49a', { uv: 4 });
        collider(F, w, .9, d, 0, H, 0, 'wall');
        roofStuff(F, w, d, H, o);
      } else {
        const rh = Math.min(w, d) * .32, alongX = w >= d, rw = alongX ? w : d, rd = alongX ? d : w, ry = alongX ? 0 : Math.PI / 2;
        geo(F, 'tiles', gableGeo(rw, rd, rh, .4), 0, H, 0, o.roofC || pick(['#c4643a', '#b8583a', '#d07a4a', '#a8503a']), ry);
        geo(F, 'facade', gableEndGeo(rw, rd, rh), 0, H, 0, wall, ry);
        collider(F, alongX ? w : d, rh * .7, alongX ? d : w, 0, H, 0, 'wall', ry);
        if (o.chimney !== false) { const cx = (R() - .5) * w * .5, cz = (R() - .5) * d * .3; box(F, 'brick', .7, rh + 1.3, .7, cx, H, cz, '#ffffff', { uv: 1 }); box(F, 'plain', .9, .12, .9, cx, H + rh + 1.3, cz, '#6a6058'); if (o.smoke) anim.push({ k: 'smoke', p: F.at(cx, H + rh + 1.5, cz) }); }
      }
      return { H, F };
    }
    /* coisas nos telhados planos: AC, depósitos de água, antenas, estendais, claraboias */
    function roofStuff(F, w, d, H, o) {
      const n = Math.round(w * d / 40);
      for (let i = 0; i < n; i++) {
        const lx = (R() - .5) * (w - 3), lz = (R() - .5) * (d - 3), k = R();
        if (k < .4) { box(F, 'metal', 1.1, .8, .7, lx, H, lz, '#c9ccd0'); geo(F, 'metal', new THREE.CylinderGeometry(.28, .28, .05, 12), lx, H + .81, lz, '#4a4f55'); }
        else if (k < .55) { geo(F, 'metal', new THREE.CylinderGeometry(.8, .8, 1.6, 14), lx, H + 1.7, lz, '#d8dde2'); [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].forEach(([a, b]) => box(F, 'metal', .08, .9, .08, lx + a, H, lz + b, '#55595e')); collider(F, 1.6, 2.5, 1.6, lx, H, lz, 'tank'); }
        else if (k < .68) { geo(F, 'metal', new THREE.CylinderGeometry(.03, .03, 3, 4), lx, H + 1.5, lz, '#8a8f95'); for (let s = 0; s < 3; s++) box(F, 'metal', 1.2 - s * .3, .03, .03, lx, H + 2 + s * .4, lz, '#8a8f95'); }
        else if (k < .8) { box(F, 'glassS', 1.4, .35, 1.4, lx, H, lz, '#a8c4d8'); }
        else if (k < .9 && !o.noLaundry) { /* estendal com roupa (ondula ao vento) */
          box(F, 'metal', .05, 1.7, .05, lx - 1.5, H, lz, '#7a7f85'); box(F, 'metal', .05, 1.7, .05, lx + 1.5, H, lz, '#7a7f85');
          for (let s = 0; s < 4; s++) anim.push({ k: 'cloth', p: F.at(lx - 1.1 + s * .75, H + 1.62, lz), yaw: F.yaw, c: pick(['#e8e4dc', '#5a8ad8', '#e05a5a', '#f2d24a', '#7ac08a', '#f0a0c0']), w: .55, h: .7 + R() * .3 });
        } else { geo(F, 'metal', new THREE.SphereGeometry(.45, 12, 8, 0, TAU, 0, Math.PI / 2.4), lx, H + .6, lz, '#e6e8ea', R() * 6, -.9); box(F, 'metal', .06, .6, .06, lx, H, lz, '#7a7f85'); }
      }
      box(F, 'plain', 1.8, 2.3, 1.8, w / 2 - 1.4, H, -d / 2 + 1.4, '#cfc9bd'); box(F, 'metal', .9, 1.9, .05, w / 2 - 1.4, H, -d / 2 + 2.31, '#6a5040');
    }
    /* ── armazém do porto ── */
    function warehouse(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), w = o.w || 30, d = o.d || 18, h = o.h || 9, c = o.c || '#9fb4c4';
      box(F, 'concrete', w, 1.2, d, 0, 0, 0, '#bdb8ae', { uv: 4 });
      box(F, 'corr', w, h - 1.2, d, 0, 1.2, 0, c, { uv: 3 });
      collider(F, w, h, d, 0, 0, 0, 'wall');
      const rh = d * .18; geo(F, 'corr', gableGeo(w, d, rh, .5), 0, h, 0, '#8a929a'); geo(F, 'corr', gableEndGeo(w, d, rh), 0, h, 0, c);
      /* portões de enrolar e porta pequena */
      const nd = o.doors || 2;
      for (let i = 0; i < nd; i++) { const lx = -w / 2 + (i + .5) * w / nd; box(F, 'corr', 5.2, 5.5, .12, lx, 0, d / 2 + .02, o.doorC || '#d0d4d8', { uv: 1, ry: 0 }); box(F, 'plain', 5.6, .35, .3, lx, 5.5, d / 2 + .1, '#4a4f55'); box(F, 'plain', .2, 5.6, .25, lx - 2.7, 0, d / 2 + .08, '#f2c230'); box(F, 'plain', .2, 5.6, .25, lx + 2.7, 0, d / 2 + .08, '#f2c230'); }
      /* janelas altas em faixa */
      for (let i = 0; i < Math.floor(w / 4); i++) box(F, 'glassS', 2.4, 1, .1, -w / 2 + 2 + i * 4, h - 2.6, d / 2 + .03, '#7a98b0');
      if (o.sign) { const sm = new THREE.Mesh(planeGeo(Math.min(w * .6, 14), 1.6), new THREE.MeshStandardMaterial({ map: signTex(o.sign, o.signBg || '#24425e', '#ffffff'), roughness: .5, envMap: env, envMapIntensity: .3 })); const [x, y, z] = F.at(0, h - 1, d / 2 + .1); sm.position.set(x, y + .2, z); sm.rotation.y = F.yaw; scene.add(sm); extras.push(sm); }
      /* cais de carga com paletes e bidões */
      box(F, 'concrete', w * .5, 1.1, 3, -w * .2, 0, d / 2 + 1.5, '#b3aea4', { uv: 3 }); collider(F, w * .5, 1.1, 3, -w * .2, 0, d / 2 + 1.5, 'low');
      for (let i = 0; i < 4; i++) pallet(F, -w * .38 + i * 2.2, 1.1, d / 2 + 1.6);
      return F;
    }
    function pallet(F, lx, ly, lz) { box(F, 'wood', 1.2, .14, 1, lx, ly, lz, '#ffffff', { uv: 1 }); const k = R(); if (k < .6) { box(F, 'wood', 1.1, .7 + R() * .4, .9, lx, ly + .14, lz, '#ffffff', { uv: 1, col: 'crate' }); } else { [[-.3, -.25], [.3, -.25], [-.3, .25], [.3, .25]].forEach(([a, b]) => geo(F, 'paint', new THREE.CylinderGeometry(.28, .28, .88, 12), lx + a, ly + .58, lz + b, pick(['#2a64b8', '#c83a2a', '#3a8a4a']))); collider(F, 1.2, 1, 1, lx, ly, lz, 'barrel'); } }
    /* ── contentor ── */
    function container(x, z, yaw, y, c) {
      const F = frame(x, z, yaw, y);
      box(F, 'corr', 12.2, 2.6, 2.44, 0, 0, 0, c, { uv: .9, col: 'container' });
      box(F, 'plain', 12.3, .14, 2.5, 0, 2.52, 0, '#3a3e44'); box(F, 'plain', 12.3, .14, 2.5, 0, 0, 0, '#3a3e44');
      for (const e of [-1, 1]) { box(F, 'plain', .06, 2.5, 2.44, e * 6.1, .05, 0, '#2c3036'); for (let k = 0; k < 4; k++) box(F, 'metal', .05, 2.3, .05, e * 6.14, .15, -.8 + k * .53, '#8a8f95'); }
      return F;
    }
    /* ── grua de pórtico do cais ── */
    function crane(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), c = o.c || '#e8b030', H = o.h || 34;
      [[-7, -5], [7, -5], [-7, 5], [7, 5]].forEach(([a, b]) => { box(F, 'paint', 1.2, H, 1.2, a, 0, b, c, { col: 'crane' }); box(F, 'paint', 1.8, .8, 2.4, a, 0, b, '#3a3e44'); });
      box(F, 'paint', 16, 1.6, 1.4, 0, H * .45, -5, c); box(F, 'paint', 16, 1.6, 1.4, 0, H * .45, 5, c);
      for (const b of [-5, 5]) for (let k = 0; k < 6; k++) box(F, 'paint', .25, 7, .25, -6 + k * 2.4, H * .45 + 1.6, b, c, { rz: (k % 2 ? .45 : -.45) });
      box(F, 'paint', 2, 2, 60, 0, H, -14, c, { col: 'crane' }); box(F, 'paint', 1.5, 6, 1.5, 0, H + 2, -2, c);
      box(F, 'plain', 3.2, 2.6, 3.2, 3, H - 2.8, -16, '#f4f2ee'); box(F, 'glassS', 3.25, 1.2, 3.25, 3, H - 1.6, -16, '#6a8aa6');
      for (let k = 0; k < 4; k++) geo(F, 'metal', new THREE.CylinderGeometry(.03, .03, 14, 4), -.5 + k * .33, H - 7, -30, '#2a2a2a');
      box(F, 'paint', 3, .8, 2, 0, H - 14.8, -30, '#d03a2a');
      anim.push({ k: 'craneLight', p: F.at(0, H + 5.2, -2) });
      return F;
    }
    /* ── banca de feira ── */
    function stall(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), c = o.c || pick(['#d83a3a', '#2a8a4a', '#2a64c8', '#e8a020', '#8a3ab0']);
      box(F, 'wood', 3, .9, 1.4, 0, 0, .3, '#ffffff', { uv: 1, col: 'stall' });
      box(F, 'cloth', 3.1, .04, 1.5, 0, .9, .3, pick(['#f4efe6', '#e8f0f8', '#fff4d0']));
      [[-1.45, -.4], [1.45, -.4], [-1.45, 1], [1.45, 1]].forEach(([a, b]) => box(F, 'wood', .08, 2.6, .08, a, 0, b, '#8a6a4a'));
      const am = 'aw:' + c; if (!MT[am]) MT[am] = new THREE.MeshStandardMaterial({ map: awningTex(c), roughness: .9, side: THREE.DoubleSide, envMap: env, envMapIntensity: .3 });
      geo(F, am, planeGeo(3.3, 1.9, 1.6, 1), 0, 2.55, .3, '#ffffff', 0, -Math.PI / 2 + .18);
      /* mercadoria: fruta, pão, flores, frascos */
      const kind = o.kind || pick(['fruit', 'bread', 'flowers', 'jars', 'toys']);
      for (let i = 0; i < 18; i++) {
        const lx = -1.3 + (i % 6) * .52, lz = .0 + Math.floor(i / 6) * .38;
        if (kind === 'fruit') geo(F, 'paint', new THREE.SphereGeometry(.09, 8, 6), lx, .99, lz, pick(['#e83a2a', '#f2a020', '#9acc3a', '#f2d23a']));
        else if (kind === 'bread') geo(F, 'paint', new THREE.SphereGeometry(.12, 8, 6), lx, .98, lz, '#c88a4a', 0, 0, 0, 1.4, .6, 1);
        else if (kind === 'flowers') { geo(F, 'paint', new THREE.CylinderGeometry(.08, .06, .2, 8), lx, 1, lz, '#6a4a3a'); geo(F, 'leaf', new THREE.IcosahedronGeometry(.13, 0), lx, 1.18, lz, pick(['#e8508a', '#f4d03a', '#f07040', '#c060e0'])); }
        else if (kind === 'jars') geo(F, 'glassS', new THREE.CylinderGeometry(.06, .06, .16, 8), lx, 1, lz, pick(['#e0a030', '#c03a2a', '#8a4a1a']));
        else geo(F, 'paint', new THREE.BoxGeometry(.18, .18, .18), lx, 1, lz, pick(['#3a8ae8', '#e83a8a', '#f2d23a', '#3ad08a']));
      }
      if (o.t) { const sm = new THREE.Mesh(planeGeo(2.2, .45), new THREE.MeshStandardMaterial({ map: signTex(o.t, c, '#ffffff'), roughness: .6 })); const [x, y, z] = F.at(0, 1.55, 1.08); sm.position.set(x, y, z); sm.rotation.y = F.yaw; scene.add(sm); extras.push(sm); }
      return F;
    }
    /* ── igreja com torre sineira ── */
    function church(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), w = 12, d = 22, h = 10, wall = o.wall || '#f4f1ea';
      box(F, 'stone', w + .3, .8, d + .3, 0, -.3, 0, '#d8d2c6', { uv: 2 });
      box(F, 'plain', w, h, d, 0, 0, 0, wall); collider(F, w, h, d, 0, 0, 0, 'wall');
      geo(F, 'tiles', gableGeo(d, w, 4.5, .5), 0, h, 0, '#b8583a', Math.PI / 2); geo(F, 'plain', gableEndGeo(d, w, 4.5), 0, h, 0, wall, Math.PI / 2);
      /* frontão, porta em arco, rosácea, janelas altas */
      box(F, 'stone', 3.4, 5, .3, 0, 0, d / 2 + .1, '#cfc8ba', { uv: 2 }); box(F, 'wood', 2.4, 3.8, .2, 0, 0, d / 2 + .25, '#ffffff', { uv: 1 });
      geo(F, 'stone', new THREE.CylinderGeometry(1.2, 1.2, .3, 16, 1, false, 0, Math.PI), 0, 3.8, d / 2 + .1, '#cfc8ba', 0, Math.PI / 2, Math.PI / 2);
      geo(F, 'glassS', new THREE.CylinderGeometry(1.1, 1.1, .2, 16), 0, 7.5, d / 2 + .1, '#5a78b8', 0, Math.PI / 2); geo(F, 'stone', new THREE.TorusGeometry(1.15, .12, 6, 20), 0, 7.5, d / 2 + .25, '#cfc8ba');
      for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) box(F, 'glassS', .12, 3.4, 1.1, sd * (w / 2 + .02), 3.5, -7 + i * 4.6, '#4a6aa8');
      /* torre */
      const tx = w / 2 + 2.2, tz = d / 2 - 2.5, th = 22;
      box(F, 'plain', 4.4, th, 4.4, tx, 0, tz, wall); collider(F, 4.4, th + 7, 4.4, tx, 0, tz, 'wall');
      box(F, 'stone', 4.8, .4, 4.8, tx, th - 5.2, tz, '#cfc8ba', { uv: 2 }); box(F, 'stone', 4.8, .4, 4.8, tx, th, tz, '#cfc8ba', { uv: 2 });
      for (const [a, b, r] of [[0, 2.21, 0], [0, -2.21, 0], [2.21, 0, Math.PI / 2], [-2.21, 0, Math.PI / 2]]) { box(F, 'plain', 1.6, 3.2, .1, tx + a, th - 4.4, tz + b, '#2a2a30', { ry: r }); }
      geo(F, 'paint', new THREE.SphereGeometry(.9, 12, 8, 0, TAU, 0, Math.PI * .6), tx, th - 1.6, tz, '#c8a040', 0, Math.PI);
      geo(F, 'tiles', new THREE.ConeGeometry(3.4, 7, 4), tx, th + 3.9, tz, '#a84a30', Math.PI / 4);
      box(F, 'metal', .15, 1.6, .15, tx, th + 7.3, tz, '#3a3a3a'); box(F, 'metal', .9, .15, .15, tx, th + 8.1, tz, '#3a3a3a');
      /* relógio */
      const ck = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshStandardMaterial({ map: clockTex(), roughness: .5 })); const [cx, cy, cz] = F.at(tx, th - 8.5, tz + 2.23); ck.position.set(cx, cy, cz); ck.rotation.y = F.yaw; scene.add(ck); extras.push(ck);
      anim.push({ k: 'bell', p: F.at(tx, th - 1.6, tz) });
      return { F, tower: F.at(tx, th - 3, tz) };
    }
    let _clock = null;
    function clockTex() { if (_clock) return _clock; _clock = cv(128, 128, x => { x.fillStyle = '#f6f2e6'; x.beginPath(); x.arc(64, 64, 62, 0, TAU); x.fill(); x.strokeStyle = '#2a2a2a'; x.lineWidth = 5; x.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.fillStyle = '#222'; x.fillRect(64 + Math.cos(a) * 50 - 3, 64 + Math.sin(a) * 50 - 3, 6, 6); } x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64, 26); x.stroke(); x.lineWidth = 6; x.beginPath(); x.moveTo(64, 64); x.lineTo(92, 74); x.stroke(); }, true, false); return _clock; }
    /* ── fonte ── */
    function fountain(o) {
      const F = frame(o.x, o.z, 0, o.y);
      geo(F, 'stone', new THREE.CylinderGeometry(4, 4.2, .8, 8), 0, .4, 0, '#d6d0c4'); geo(F, 'paint', new THREE.CylinderGeometry(3.6, 3.6, .1, 24), 0, .72, 0, '#3a8ab0');
      geo(F, 'stone', new THREE.CylinderGeometry(.5, .7, 2.2, 10), 0, 1.6, 0, '#d6d0c4'); geo(F, 'stone', new THREE.CylinderGeometry(1.6, .5, .5, 12), 0, 2.8, 0, '#d6d0c4'); geo(F, 'stone', new THREE.SphereGeometry(.35, 10, 8), 0, 3.4, 0, '#d6d0c4');
      collider(F, 8, .8, 8, 0, 0, 0, 'low'); collider(F, 1.4, 3.4, 1.4, 0, 0, 0, 'solid');
      anim.push({ k: 'fountain', p: F.at(0, 3.5, 0) });
    }
    /* ── palco com colunas de som e luzes ── */
    function stage(o) {
      const F = frame(o.x, o.z, o.yaw, o.y);
      box(F, 'wood', 10, 1.2, 6, 0, 0, 0, '#ffffff', { uv: 2, col: 'low' });
      box(F, 'plain', 10, 5, .3, 0, 1.2, -2.9, '#2a3a6a');
      [[-5, -3], [5, -3], [-5, 3], [5, 3]].forEach(([a, b]) => box(F, 'metal', .2, 6.5, .2, a, 0, b, '#8a8f95'));
      box(F, 'metal', 10.4, .3, .3, 0, 6.5, -3, '#8a8f95'); box(F, 'metal', 10.4, .3, .3, 0, 6.5, 3, '#8a8f95'); box(F, 'metal', .3, .3, 6.4, -5, 6.5, 0, '#8a8f95'); box(F, 'metal', .3, .3, 6.4, 5, 6.5, 0, '#8a8f95');
      for (const s of [-1, 1]) { box(F, 'plain', 1, 2.2, .9, s * 5.8, 0, 2.5, '#1a1a1e', { col: 'solid' }); geo(F, 'metal', new THREE.CylinderGeometry(.3, .3, .05, 12), s * 5.8, 1.6, 2.97, '#3a3a40', 0, Math.PI / 2); }
      for (let i = 0; i < 6; i++) anim.push({ k: 'stagelight', p: F.at(-4 + i * 1.6, 6.3, 3), c: ['#ff4a8a', '#4ab0ff', '#ffd040', '#8aff6a', '#ff8a3a', '#c06aff'][i] });
      const bn = new THREE.Mesh(planeGeo(8, 1.4), new THREE.MeshStandardMaterial({ map: signTex(o.t || 'FESTA DA ALDEIA', '#c83a3a', '#fff6d0', 768, 128), roughness: .6, side: THREE.DoubleSide })); const [x, y, z] = F.at(0, 5.6, -2.7); bn.position.set(x, y, z); bn.rotation.y = F.yaw; scene.add(bn); extras.push(bn);
    }
    /* ── mobiliário urbano ── */
    function lamp(x, z, yaw, y, o) {
      const F = frame(x, z, yaw, y); o = o || {};
      geo(F, 'metal', new THREE.CylinderGeometry(.08, .12, 4.4, 8), 0, 2.2, 0, '#2c3036'); geo(F, 'metal', new THREE.CylinderGeometry(.18, .22, .4, 8), 0, .2, 0, '#2c3036');
      box(F, 'metal', .06, .06, 1, 0, 4.3, .45, '#2c3036'); geo(F, 'metal', new THREE.ConeGeometry(.32, .35, 8), 0, 4.22, .9, '#2c3036'); geo(F, 'glow', new THREE.SphereGeometry(.13, 8, 6), 0, 4.06, .9, '#ffe6b0');
      collider(F, .25, 4.4, .25, 0, 0, 0, 'pole');
      anim.push({ k: 'lamp', p: F.at(0, 4, .9) });
    }
    function bench(x, z, yaw, y) {
      const F = frame(x, z, yaw, y);
      for (let k = 0; k < 3; k++) box(F, 'wood', 1.8, .05, .12, 0, .45, -.15 + k * .15, '#ffffff', { uv: 1 });
      for (let k = 0; k < 2; k++) box(F, 'wood', 1.8, .12, .04, 0, .6 + k * .18, -.25, '#ffffff', { uv: 1, rx: -.15 });
      for (const s of [-.75, .75]) { box(F, 'metal', .06, .45, .5, s, 0, -.02, '#2c3036'); box(F, 'metal', .06, .5, .05, s, .45, -.27, '#2c3036'); }
      return F.at(0, .5, 0);
    }
    function bollard(x, z, y) { const F = frame(x, z, 0, y); geo(F, 'metal', new THREE.CylinderGeometry(.22, .28, .6, 10), 0, .3, 0, '#2a2e34'); geo(F, 'metal', new THREE.SphereGeometry(.26, 10, 6, 0, TAU, 0, Math.PI / 2), 0, .6, 0, '#2a2e34'); }
    function hedge(x, z, w, d, h, yaw, y) { const F = frame(x, z, yaw, y); box(F, 'leaf', w, h, d, 0, 0, 0, '#5a8a3a', { uv: 1.5, col: 'hedge' }); }
    function fence(x0, z0, x1, z1, y, c) {
      const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, F = frame((x0 + x1) / 2, (z0 + z1) / 2, yaw, y);
      for (let k = 0; k <= L / 2; k++) box(F, 'wood', .1, 1.1, .1, -L / 2 + k * 2, 0, 0, c || '#f4f1ea');
      box(F, 'wood', L, .1, .05, 0, .45, 0, c || '#f4f1ea'); box(F, 'wood', L, .1, .05, 0, .9, 0, c || '#f4f1ea');
    }
    function crate(x, z, yaw, y, s) { const F = frame(x, z, yaw, y); s = s || 1; box(F, 'wood', 1.1 * s, 1.1 * s, 1.1 * s, 0, 0, 0, '#ffffff', { uv: 1, col: 'crate' }); }
    /* ── piscina e espreguiçadeiras ── */
    function pool(o) {
      const F = frame(o.x, o.z, o.yaw, o.y), w = o.w || 12, d = o.d || 6;
      box(F, 'stone', w + 3, .15, d + 3, 0, -.15, 0, '#e8e2d6', { uv: 1 });
      box(F, 'paint', w, .05, d, 0, -.12, 0, '#2a9ad0');
      [[w + .6, .3, .3, 0, d / 2 + .15], [w + .6, .3, .3, 0, -d / 2 - .15], [.3, .3, d, w / 2 + .15, 0], [.3, .3, d, -w / 2 - .15, 0]].forEach(([a, b, c, lx, lz]) => box(F, 'stone', a, b, c, lx, -.15, lz, '#f4f1ea'));
      for (const s of [-1, 1]) { geo(F, 'metal', new THREE.TorusGeometry(.3, .03, 6, 12, Math.PI), w / 2 - .6, .2, s * .25 + d / 2 - .2, '#d8dde2', Math.PI / 2); }
      anim.push({ k: 'pool', p: F.at(0, -.05, 0), w, d, yaw: F.yaw });
    }
    function deckchair(x, z, yaw, y, c) {
      const F = frame(x, z, yaw, y);
      box(F, 'wood', .6, .06, 1.2, 0, .3, .1, '#ffffff', { uv: 1 }); box(F, 'wood', .6, .06, .7, 0, .5, -.6, '#ffffff', { uv: 1, rx: -.9 });
      box(F, 'cloth', .55, .04, 1.1, 0, .36, .1, c || '#f2f2f2'); for (const s of [-.27, .27]) { box(F, 'metal', .04, .3, .04, s, 0, .6, '#8a8f95'); box(F, 'metal', .04, .3, .04, s, 0, -.3, '#8a8f95'); }
      return F;
    }
    function umbrella(x, z, y, c) { const F = frame(x, z, 0, y); geo(F, 'metal', new THREE.CylinderGeometry(.04, .04, 2.5, 6), 0, 1.25, 0, '#d8d8d8'); geo(F, 'cloth', new THREE.ConeGeometry(1.6, .6, 8, 1, true), 0, 2.4, 0, c || '#e85a3a'); }
    /* ── vivenda moderna (vidro, madeira, betão branco) ── */
    function villa(o) {
      const F = frame(o.x, o.z, o.yaw, o.y);
      box(F, 'plain', 18, 3.4, 11, 0, 0, 0, '#f4f4f0'); collider(F, 18, 3.4, 11, 0, 0, 0, 'wall');
      box(F, 'glassS', 12, 2.8, .1, -2, .2, 5.52, '#5a7a98'); for (let i = 0; i < 6; i++) box(F, 'metal', .08, 2.8, .14, -8 + i * 2.4, .2, 5.55, '#2a2e34');
      box(F, 'wood', 5, 3.4, .2, 6.4, 0, 5.55, '#ffffff', { uv: 1.5 });
      box(F, 'plain', 20, .35, 13, 0, 3.4, .4, '#e8e8e4');
      box(F, 'plain', 11, 3.2, 9, 3, 3.75, -1, '#f4f4f0'); collider(F, 11, 3.2, 9, 3, 3.75, -1, 'wall');
      box(F, 'glassS', 9, 2.6, .1, 3, 4, 3.52, '#5a7a98'); box(F, 'plain', 12.5, .3, 10.5, 3, 6.95, -1, '#e8e8e4');
      box(F, 'glass', 9, 1, .06, -4.5, 3.75, 6.7, '#bcd8e8'); box(F, 'metal', 9, .06, .08, -4.5, 4.75, 6.7, '#c8ccd0');
      box(F, 'stone', 6, 1.2, 1.2, -6, 3.75, -5.5, '#9a9488', { uv: 1 }); geo(F, 'leaf', new THREE.IcosahedronGeometry(.6, 0), -7.5, 5.2, -5.5, '#4a8a3a'); geo(F, 'leaf', new THREE.IcosahedronGeometry(.5, 0), -5, 5.1, -5.5, '#5a9a4a');
      box(F, 'plain', 1.2, 1.8, 1.2, 6, 7.25, -3, '#d8d8d4'); box(F, 'metal', 2, .9, 1.2, 1, 7.25, -3, '#c9ccd0');
      return F;
    }
    /* ── heliporto e helicóptero (o rotor roda quando foge) ── */
    function helicopter(x, z, yaw, y) {
      const g = new THREE.Group(), mp = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? .35 : r, metalness: m == null ? .3 : m, envMap: env, envMapIntensity: .8 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 12), mp('#1a2a4a')); body.scale.set(1, .9, 1.6); body.position.y = 1.6; g.add(body);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10, 0, TAU, 0, Math.PI / 2), mp('#2a3a4a', .05, .6)); glass.position.set(0, 1.9, 1.2); glass.rotation.x = .9; glass.scale.set(1, 1, 1.2); g.add(glass);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(.18, .45, 6, 10), mp('#1a2a4a')); tail.rotation.x = Math.PI / 2; tail.position.set(0, 2, -4.6); g.add(tail);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.6, .9), mp('#d8a020')); fin.position.set(0, 2.6, -7.4); g.add(fin);
      [-1, 1].forEach(s => { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 4, 6), mp('#8a8f95')); sk.rotation.x = Math.PI / 2; sk.position.set(s * 1.1, .15, 0); g.add(sk); [-1, 1].forEach(t => { const st = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .9, 5), mp('#8a8f95')); st.position.set(s * 1.05, .55, t * 1); st.rotation.z = s * .3; g.add(st); }); });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .5, 8), mp('#3a3a3a')); mast.position.y = 3.1; g.add(mast);
      const rotor = new THREE.Group(); rotor.position.y = 3.35; g.add(rotor);
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.32, .05, 5.4), mp('#2a2a2a')); b.position.z = 2.7; const h = new THREE.Group(); h.rotation.y = i * Math.PI / 2; h.add(b); rotor.add(h); }
      const tr = new THREE.Group(); tr.position.set(.2, 2.6, -7.4); g.add(tr); for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, 1.4, .14), mp('#2a2a2a')); b.rotation.x = i * Math.PI / 2; tr.add(b); }
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.position.set(x, y != null ? y : hAt(x, z), z); g.rotation.y = yaw || 0; scene.add(g); extras.push(g);
      const F = frame(x, z, 0, y); geo(F, 'concrete', new THREE.CylinderGeometry(7, 7, .2, 24), 0, .1, 0, '#8a8f95'); geo(F, 'paint', new THREE.RingGeometry(5.2, 5.7, 32), 0, .22, 0, '#f2f2f2', 0, -Math.PI / 2);
      box(F, 'paint', .6, .02, 4, -1.2, .21, 0, '#f2f2f2'); box(F, 'paint', .6, .02, 4, 1.2, .21, 0, '#f2f2f2'); box(F, 'paint', 2.4, .02, .6, 0, .21, 0, '#f2f2f2');
      collider(F, 3.4, 3, 8, 0, 0, -1.5, 'heli', yaw);
      return { g, rotor, tail: tr };
    }
    /* ── barco de pesca (balança na água) ── */
    function boat(x, z, yaw, o) {
      o = o || {}; const g = new THREE.Group(), L = o.L || 9, hc = o.c || '#2a64b8';
      const s = new THREE.Shape(); s.moveTo(-L / 2, .3); s.quadraticCurveTo(-L / 2 + .3, -.9, -L / 2 + 1.5, -1); s.lineTo(L / 2 - 1.8, -1); s.quadraticCurveTo(L / 2 - .2, -.7, L / 2 + .5, .6); s.lineTo(-L / 2, .6);
      const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 2.8, bevelEnabled: true, bevelThickness: .25, bevelSize: .2, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: hc, roughness: .45, envMap: env, envMapIntensity: .6 }));
      hull.geometry.translate(0, 0, -1.4); hull.rotation.y = Math.PI / 2; g.add(hull);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, .18, L + .4), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: .5 })); stripe.position.y = .45; g.add(stripe);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.9, .1, L - .6), new THREE.MeshStandardMaterial({ map: textures().planks, color: '#d8b890', roughness: .8 })); deck.position.y = .55; g.add(deck);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: .5 })); cab.position.set(0, 1.4, -L * .12); g.add(cab);
      const cw = new THREE.Mesh(new THREE.BoxGeometry(2.05, .6, 2.25), new THREE.MeshStandardMaterial({ color: '#2a3a4a', roughness: .1, metalness: .5, envMap: env })); cw.position.set(0, 1.75, -L * .12); g.add(cw);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, .12, 2.5), new THREE.MeshStandardMaterial({ color: hc, roughness: .5 })); roof.position.set(0, 2.26, -L * .12); g.add(roof);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 5, 6), new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: .4, metalness: .6 })); mast.position.set(0, 3.2, L * .18); g.add(mast);
      const buoy = new THREE.Mesh(new THREE.TorusGeometry(.32, .09, 8, 16), new THREE.MeshStandardMaterial({ color: '#f25a2a', roughness: .5 })); buoy.position.set(1.46, 1.3, -L * .12); buoy.rotation.y = Math.PI / 2; g.add(buoy);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .5, 8), new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: .6 })); f.position.set(1.65, .2, -L * .3 + i * L * .3); g.add(f); }
      if (o.flag) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(.8, .5), new THREE.MeshStandardMaterial({ color: o.flag, side: THREE.DoubleSide })); fl.position.set(0, 5.4, L * .18 - .4); fl.rotation.y = Math.PI / 2; g.add(fl); }
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.position.set(x, 0, z); g.rotation.y = yaw || 0; scene.add(g); extras.push(g);
      cols.push({ x, y: .8, z, hx: 1.6, hy: 1.6, hz: L / 2, c: Math.cos(yaw || 0), s: Math.sin(yaw || 0), k: 'boat', dyn: g });
      anim.push({ k: 'boat', g, ph: R() * 6 });
      return g;
    }
    /* ── linha férrea, plataforma e comboio ── */
    function rails(x0, x1, z, y) {
      const F = frame((x0 + x1) / 2, z, 0, y), L = x1 - x0;
      box(F, 'stone', L, .25, 3.6, 0, 0, 0, '#8a8278', { uv: 2 });
      for (const s of [-.72, .72]) box(F, 'metal', L, .16, .08, 0, .45, s, '#9aa0a8');
      for (let k = 0; k < L / .7; k++) box(F, 'rails', .24, .14, 2.5, -L / 2 + k * .7, .25, 0, '#ffffff', { uv: 1 });
    }
    function train(o) {
      const g = new THREE.Group(), cars = o.n || 4, sm = (c, r, m, x) => Object.assign(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m || 0, envMap: env, envMapIntensity: .7 }), x || {});
      const M = { body: sm(o.c || '#2a5a9a', .35, .3), white: sm('#eef0f2', .4), dark: sm('#202428', .6), seat: sm('#8a2a3a', .8), seat2: sm('#2a4a8a', .8), floor: sm('#5a5048', .9),
        win: sm('#3a4a5a', .05, .4, { transparent: true, opacity: .28, depthWrite: false, emissive: new THREE.Color('#ffd89a'), emissiveIntensity: o.night ? .18 : 0 }), lamp: new THREE.MeshBasicMaterial({ color: o.night ? '#fff0c8' : '#d8d8d0', toneMapped: false }) };
      const seats = [];
      const B3 = (car, w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); car.add(me); return me; };
      for (let i = 0; i < cars; i++) {
        const cx = -i * 21, loco = i === 0, car = new THREE.Group(); car.position.x = cx; g.add(car);
        B3(car, 19, .7, 2.4, M.dark, 0, .75, 0);
        for (const wx of [-7, -5.6, 5.6, 7]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .2, 14), M.dark); w.rotation.x = Math.PI / 2; w.position.set(wx, .5, s * 1.05); car.add(w); }
        B3(car, 20, .25, 3.1, M.white, 0, 4.35, 0); B3(car, 19.6, .3, 2.3, M.white, 0, 4.6, 0);
        if (loco) {
          B3(car, 20, 3.2, 3, M.body, 0, 2.6, 0); B3(car, 20.02, .4, 3.04, M.white, 0, 2.2, 0);
          const n = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 12, 0, Math.PI), M.body); n.rotation.y = Math.PI / 2; n.scale.set(1.6, 1.05, 1); n.position.set(10, 2.6, 0); car.add(n);
          const ws = B3(car, .1, 1, 2.2, M.win, 11.1, 3.3, 0); ws.rotation.z = -.5; ws.material = sm('#1a2430', .05, .6);
          const hl = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6d0' })); hl.position.set(12.4, 1.9, 0); car.add(hl);
          for (let k = 0; k < 3; k++) for (const s of [-1, 1]) B3(car, 1.6, 1.1, .06, sm('#1a2430', .05, .5), -6 + k * 2.25, 3.05, s * 1.52);
        } else {
          /* casca com janelas abertas: banda de baixo, banda de cima, pilares, topos */
          B3(car, 20, .2, 2.9, M.floor, 0, 1.4, 0);
          for (const s of [-1, 1]) {
            B3(car, 20, 1.1, .08, M.body, 0, 1.95, s * 1.5); B3(car, 20.02, .3, .1, M.white, 0, 2.2, s * 1.5); B3(car, 20, .6, .08, M.body, 0, 3.9, s * 1.5);
            for (let k = 0; k <= 8; k++) B3(car, k === 0 || k === 8 ? 1.2 : .65, 1.1, .08, M.body, -8 - 1.125 + k * 2.25 + (k === 0 ? -.3 : k === 8 ? .3 : 0), 3.05, s * 1.5);
            for (let k = 0; k < 8; k++) { B3(car, 1.6, 1.1, .03, M.win, -8 + k * 2.25, 3.05, s * 1.53); B3(car, .5, .9, .9, k % 2 ? M.seat : M.seat2, -8 + k * 2.25, 1.95, s * .85); B3(car, .14, .7, .9, k % 2 ? M.seat : M.seat2, -8 + k * 2.25 - .28, 2.6, s * .85); if (s > 0) seats.push([cx - 8 + k * 2.25, 1.75, .85]); }
          }
          B3(car, .1, 3, 3, M.body, -10, 2.9, 0); B3(car, .1, 3, 3, M.body, 10, 2.9, 0);
          for (const s of [-1, 1]) B3(car, 1.1, 2.4, .1, M.white, 9 - .2, 2.6, s * 1.5);
          B3(car, 18, .05, .35, M.lamp, 0, 4.18, 0);
        }
        Arcade3D.mergeStatic(car);
      }
      g.traverse(m => { if (m.isMesh) { m.castShadow = m.material !== M.win; m.receiveShadow = true; } });
      scene.add(g); extras.push(g);
      return { g, seats, len: cars * 21 };
    }
    /* ── bandeiras e fitas de bandeirinhas (ondulam ao vento) ── */
    function flag(x, z, y, h, colors) {
      const F = frame(x, z, 0, y); geo(F, 'metal', new THREE.CylinderGeometry(.05, .07, h, 6), 0, h / 2, 0, '#d8dde2'); geo(F, 'metal', new THREE.SphereGeometry(.09, 8, 6), 0, h + .05, 0, '#d8b860');
      const cvs = cv(128, 80, (x2) => { const n = colors.length; colors.forEach((c, i) => { x2.fillStyle = c; x2.fillRect(i * 128 / n, 0, 128 / n + 1, 80); }); }, true, false);
      const gm = new THREE.PlaneGeometry(1.8, 1.1, 12, 4); gm.translate(.9, 0, 0);
      const m = new THREE.Mesh(gm, new THREE.MeshStandardMaterial({ map: cvs, side: THREE.DoubleSide, roughness: .9 })); m.castShadow = true;
      const [px, py, pz] = F.at(0, h - .6, 0); m.position.set(px, py, pz); scene.add(m); extras.push(m);
      anim.push({ k: 'flag', m, base: gm.attributes.position.array.slice() });
    }
    function bunting(pts, colors) {
      const flags = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / .55);
        for (let k = 0; k <= n; k++) { const t = k / n, sag = Math.sin(t * Math.PI) * L * .07; flags.push([lerp(ax, bx, t), lerp(ay, by, t) - sag, lerp(az, bz, t), Math.atan2(bx - ax, bz - az)]); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-.17, 0, 0, .17, 0, 0, 0, -.42, 0], 3)); g.computeVertexNormals();
      const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .8 }), flags.length); const c = new THREE.Color();
      flags.forEach((f, i) => { im.setMatrixAt(i, MX(f[0], f[1], f[2], f[3] + Math.PI / 2)); im.setColorAt(i, c.set(colors[i % colors.length])); });
      im.castShadow = true; scene.add(im); extras.push(im);
      /* o fio */
      pts.slice(0, -1).forEach((p, i) => { const q = pts[i + 1], L = Math.hypot(q[0] - p[0], q[2] - p[2]), N = 10, P = []; for (let k = 0; k <= N; k++) { const t = k / N; P.push(new THREE.Vector3(lerp(p[0], q[0], t), lerp(p[1], q[1], t) - Math.sin(t * Math.PI) * L * .07 + .02, lerp(p[2], q[2], t))); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: '#f4f1ea' })); scene.add(l); extras.push(l); });
      anim.push({ k: 'bunting', im, flags });
    }
    /* ── piso: retângulos de asfalto, calçada, relva, betão (assentes no chão) ── */
    function ground(mat, x, z, w, d, yaw, y, color, s) {
      const F = frame(x, z, yaw, y), g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * w / (s || 4), u.getY(i) * d / (s || 4));
      B.add(mat, g, MX(F.x, F.y + .03, F.z, F.yaw), color || '#ffffff');
    }
    function roadMarks(x0, z0, x1, z1, y) { const L = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0); for (let k = 2; k < L - 2; k += 6) { const t = k / L; const g = new THREE.PlaneGeometry(.15, 3); g.rotateX(-Math.PI / 2); B.add('plain', g, MX(lerp(x0, x1, t), (y || 0) + .06, lerp(z0, z1, t), yaw), '#f2f0e6'); } }
    function crossing(x, z, yaw, y, w) { const F = frame(x, z, yaw, y); for (let k = 0; k < (w || 8) / 1; k++) { const g = new THREE.PlaneGeometry(.5, 3); g.rotateX(-Math.PI / 2); B.add('plain', g, MX(...F.at(-(w || 8) / 2 + k + .5, .065, 0), F.yaw), '#f4f2ea'); } }
    function quay(x, z, w, d, y) { const F = frame(x, z, 0, y); box(F, 'concrete', w, 3.2, d, 0, -3.2 + .02, 0, '#bdb8ae', { uv: 4 }); box(F, 'stone', w, 3.6, .6, 0, -3.6, -d / 2 - .3, '#9a948a', { uv: 2 }); for (let k = 0; k < w / 12; k++) { bollard(x - w / 2 + 6 + k * 12, z - d / 2 + .6, y); box(frame(x - w / 2 + 6 + k * 12 + 3, z - d / 2 - .7, 0, y - 1.6), 'plain', .9, 1.3, .45, 0, 0, 0, '#2a2a2a'); } box(F, 'paint', w, .05, .22, 0, 0, -d / 2 + 1.6, '#f2c230'); }

    /* ── árvores instanciadas (balançam ao vento por shader) ── */
    function trees(list, uWind, uTime) {
      const kinds = {}; list.forEach(t => (kinds[t.k || 'leaf'] = kinds[t.k || 'leaf'] || []).push(t));
      const out = [];
      Object.entries(kinds).forEach(([k, L]) => {
        const geoT = W().treeGeo(k === 'cypress' ? 'pine' : k), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, envMap: env, envMapIntensity: .25 });
        mat.onBeforeCompile = sh => {
          sh.uniforms.uWind = uWind; sh.uniforms.uTime = uTime;
          sh.vertexShader = 'uniform vec2 uWind; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
            #ifdef USE_INSTANCING
              float ph = instanceMatrix[3].x * .21 + instanceMatrix[3].z * .17;
              float k = max(0., position.y - 2.5) * .016;
              float gust = .6 + .4 * sin(uTime * .9 + ph * .3);
              transformed.x += (uWind.x * .07 * gust + sin(uTime * 1.9 + ph) * .1 * length(uWind) * .12 + sin(uTime * 3.1 + ph * 2.) * .03) * k * 6.;
              transformed.z += (uWind.y * .07 * gust + cos(uTime * 1.6 + ph) * .1 * length(uWind) * .12) * k * 6.;
            #endif`);
        };
        const im = new THREE.InstancedMesh(geoT, mat, L.length), c = new THREE.Color();
        L.forEach((t, i) => { const s = t.s || 1; im.setMatrixAt(i, MX(t.x, t.y != null ? t.y : hAt(t.x, t.z), t.z, t.r != null ? t.r : R() * TAU, 0, 0, s * (k === 'cypress' ? .55 : 1), s * (k === 'cypress' ? 1.3 : 1), s * (k === 'cypress' ? .55 : 1))); im.setColorAt(i, c.set(t.c || (k === 'pine' || k === 'cypress' ? '#3f6a3a' : k === 'palm' ? '#5aa04a' : ['#5f8a3a', '#6c9a40', '#4f7d34', '#7aa04a'][i % 4]))); { const nw = k === 'cypress' ? 1 : k === 'palm' ? .5 : k === 'pine' ? 2 : 2.4, ty = (t.y != null ? t.y : hAt(t.x, t.z)); if (s > .3) cols.push({ x: t.x, y: ty + (k === 'palm' ? 9 : 6.5) * s * (k === 'cypress' ? 1.3 : 1), z: t.z, hx: nw * s, hy: 4.5 * s, hz: nw * s, c: 1, s: 0, k: 'tree' }); } });
        im.castShadow = true; im.receiveShadow = true; scene.add(im); out.push(im); extras.push(im);
      });
      return out;
    }

    /* ── navio porta-contentores atracado ── */
    function ship(o) {
      const F = frame(o.x, o.z, o.yaw, 0), L = o.L || 120, Wd = o.w || 20, Hh = 11;
      const sh = new THREE.Shape(); sh.moveTo(-L / 2, -Wd / 2); sh.lineTo(L / 2 - 18, -Wd / 2); sh.quadraticCurveTo(L / 2 - 2, -Wd / 2 + 2, L / 2, 0); sh.quadraticCurveTo(L / 2 - 2, Wd / 2 - 2, L / 2 - 18, Wd / 2); sh.lineTo(-L / 2, Wd / 2); sh.lineTo(-L / 2, -Wd / 2);
      const hull = new THREE.ExtrudeGeometry(sh, { depth: Hh, bevelEnabled: false }); hull.rotateX(-Math.PI / 2); hull.translate(0, -4, 0);
      const hp = hull.attributes.position, hc = new Float32Array(hp.count * 3), red = new THREE.Color('#9a2a22'), top = new THREE.Color(o.c || '#1f3a5a'), wl = new THREE.Color('#f2f2f2');
      for (let i = 0; i < hp.count; i++) { const y = hp.getY(i), c = y < .2 ? red : y < 1 ? wl : top; hc[i * 3] = c.r; hc[i * 3 + 1] = c.g; hc[i * 3 + 2] = c.b; }
      hull.setAttribute('color', new THREE.BufferAttribute(hc, 3));
      geo(F, 'paint', hull, 0, 0, 0, '#ffffff');
      box(F, 'concrete', L - 22, .2, Wd - 1, -8, Hh - 4, 0, '#7a6a5a', { uv: 3 });
      { const [x, y, z] = F.at(0, (Hh - 4) / 2 - 1, 0); cols.push({ x, y, z, hx: L / 2, hy: (Hh + 2) / 2, hz: Wd / 2, c: Math.cos(F.yaw), s: Math.sin(F.yaw), k: 'wall' }); }
      /* contentores no convés */
      const CC = ['#c83a2a', '#2a64b8', '#3a8a4a', '#e8a020', '#8a3ab0', '#d8d8d0', '#2a8a8a', '#b8582a', '#f2f2f2'];
      for (let bay = 0; bay < Math.floor((L - 50) / 13); bay++) for (let row = 0; row < Math.floor((Wd - 2) / 2.5); row++) { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) { const lx = -L / 2 + 30 + bay * 13, lz = -Wd / 2 + 2.2 + row * 2.5; const [x, , z] = F.at(lx, 0, lz); const C = frame(x, z, F.yaw + Math.PI / 2, Hh - 3.8 + k * 2.6); box(C, 'corr', 2.44, 2.6, 12.2, 0, 0, 0, pick(CC), { uv: .9 }); } }
      { const [x, y, z] = F.at(5, Hh + 1, 0); cols.push({ x, y, z, hx: L / 2 - 25, hy: 5, hz: Wd / 2 - 1, c: Math.cos(F.yaw), s: Math.sin(F.yaw), k: 'container' }); }
      /* superestrutura na popa */
      const sx = -L / 2 + 11;
      box(F, 'office', 14, 15, Wd - 4, sx, Hh - 4, 0, '#f4f4f0', { uv: 'win', col: 'wall' });
      box(F, 'plain', 4, 2.6, Wd + 4, sx + 5, Hh + 11, 0, '#f4f4f0'); box(F, 'glassS', .1, 1.4, Wd + 3.8, sx + 7.02, Hh + 12, 0, '#3a5a78');
      geo(F, 'paint', new THREE.CylinderGeometry(2.2, 2.6, 7, 14), sx - 3, Hh + 14.5, 0, '#c83a2a'); geo(F, 'paint', new THREE.CylinderGeometry(2.25, 2.25, 1.4, 14), sx - 3, Hh + 18.3, 0, '#1a1a1a');
      geo(F, 'metal', new THREE.CylinderGeometry(.15, .15, 9, 6), sx + 2, Hh + 17, 0, '#e8e8e8'); box(F, 'metal', .3, .3, 4, sx + 2, Hh + 20, 0, '#e8e8e8');
      anim.push({ k: 'smoke', p: F.at(sx - 3, Hh + 19.2, 0), big: 1 });
      if (o.name) { const sm = new THREE.Mesh(planeGeo(22, 2.4), new THREE.MeshStandardMaterial({ map: signTex(o.name, '#1f3a5a', '#f4f1ea', 768, 96), roughness: .6 })); const [x, y, z] = F.at(L / 2 - 34, 4.2, Wd / 2 + .05); sm.position.set(x, y, z); sm.rotation.y = F.yaw; scene.add(sm); extras.push(sm); }
      return F;
    }
    /* ── camião (cabine + atrelado) ── */
    function truck(x, z, yaw, y, c, cargo) {
      const F = frame(x, z, yaw, y);
      box(F, 'paint', 2.5, 2.6, 2.3, 0, .9, 6.2, c || '#e8e8e8', { col: 'car' }); box(F, 'glassS', 2.3, 1, .1, 0, 2.2, 7.36, '#2a3a4a'); box(F, 'plain', 2.5, .4, .3, 0, .7, 7.4, '#2a2a2a');
      box(F, 'plain', 2.4, .5, 12, 0, .9, -.5, '#3a3a3a');
      if (cargo !== false) box(F, 'corr', 2.44, 2.6, 12, 0, 1.4, -.8, cargo || pick(['#c83a2a', '#2a64b8', '#3a8a4a', '#e8a020']), { uv: .9, col: 'car' });
      for (const wz of [6, 3.6, -3.5, -5]) for (const sd of [-1, 1]) geo(F, 'plain', new THREE.CylinderGeometry(.5, .5, .4, 12), sd * 1.1, .5, wz, '#1a1a1a', 0, 0, Math.PI / 2);
    }
    /* ── empilhador (grupo próprio: o jogo anima-o) ── */
    function forklift(x, z, yaw, y) {
      const g = new THREE.Group(), m = c => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: .2, envMap: env, envMapIntensity: .6 });
      const add = (geo2, c, px, py, pz) => { const me = new THREE.Mesh(geo2, m(c)); me.position.set(px, py, pz); me.castShadow = true; g.add(me); return me; };
      add(new THREE.BoxGeometry(1.2, .9, 2), '#f2b020', 0, .8, 0); add(new THREE.BoxGeometry(1.2, .6, .6), '#3a3a3a', 0, .7, -1.1);
      for (const [a, b] of [[-.55, .7], [.55, .7], [-.55, -.7], [.55, -.7]]) add(new THREE.BoxGeometry(.06, 1.4, .06), '#2a2a2a', a, 1.9, b);
      add(new THREE.BoxGeometry(1.2, .06, 1.5), '#2a2a2a', 0, 2.6, 0);
      add(new THREE.BoxGeometry(.9, 2.6, .12), '#3a3a3a', 0, 1.5, 1.15); const fk = add(new THREE.BoxGeometry(.9, .06, 1.1), '#3a3a3a', 0, .3, 1.7);
      for (const [a, b] of [[-.55, .7], [.55, .7], [-.55, -.7], [.55, -.7]]) { const w = add(new THREE.CylinderGeometry(.3, .3, .25, 12), '#1a1a1a', a, .3, b); w.rotation.z = Math.PI / 2; }
      const pal = add(new THREE.BoxGeometry(1, .9, 1), '#b88a5a', 0, .8, 1.75);
      g.position.set(x, y != null ? y : hAt(x, z), z); g.rotation.y = yaw || 0; scene.add(g); extras.push(g);
      return { g, forks: fk, pal };
    }
    function lightTower(x, z, y) { const F = frame(x, z, 0, y); geo(F, 'metal', new THREE.CylinderGeometry(.25, .45, 26, 8), 0, 13, 0, '#8a8f95'); box(F, 'metal', 4, .3, .3, 0, 26, 0, '#6a6f75'); for (let i = 0; i < 4; i++) { box(F, 'metal', .8, .6, .3, -1.5 + i, 26.3, .2, '#3a3a3a'); geo(F, 'glow', new THREE.PlaneGeometry(.6, .4), -1.5 + i, 26.6, .37, '#fff6d8'); } collider(F, .8, 26, .8, 0, 0, 0, 'pole'); anim.push({ k: 'lamp', p: F.at(0, 26.4, .5), big: 1 }); }
    /* tralha do cais: redes, cabos enrolados, boias, caixas de peixe, bidões */
    function clutter(x, z, y, kind) {
      const F = frame(x, z, R() * 6, y);
      if (kind === 'nets') { for (let k = 0; k < 3; k++) geo(F, 'leaf', new THREE.IcosahedronGeometry(1.1, 1), rand(-1, 1), .3, rand(-1, 1), pick(['#2a5a3a', '#3a4a6a', '#5a4a2a']), R(), 0, 0, 1.4, .45, 1.1); for (let k = 0; k < 4; k++) geo(F, 'paint', new THREE.SphereGeometry(.2, 8, 6), rand(-1.5, 1.5), .5, rand(-1.5, 1.5), '#ff7a20'); }
      else if (kind === 'rope') { for (let k = 0; k < 4; k++) geo(F, 'paint', new THREE.TorusGeometry(.5, .1, 6, 16), 0, .1 + k * .17, 0, '#c8b080', 0, Math.PI / 2); }
      else if (kind === 'fish') { for (let k = 0; k < 12; k++) box(F, 'paint', .8, .3, .5, (k % 3) * .85 - .85, Math.floor(k / 6) * .3, (Math.floor(k / 3) % 2) * .55, pick(['#2a64b8', '#e83a2a', '#f2f2f2', '#3a8a4a'])); }
      else if (kind === 'buoys') { for (let k = 0; k < 6; k++) geo(F, 'paint', new THREE.SphereGeometry(.45, 10, 8), (k % 3) * .9 - .9, .45 + Math.floor(k / 3) * .7, 0, pick(['#ff6a1a', '#f2f2f2', '#e83a2a'])); }
      else if (kind === 'barrels') { for (let k = 0; k < 5; k++) geo(F, 'paint', new THREE.CylinderGeometry(.3, .3, .9, 12), (k % 3) * .7 - .7, .45, Math.floor(k / 3) * .7, pick(['#2a64b8', '#c83a2a', '#3a8a4a', '#e8b030'])); collider(F, 2.2, 1, 1.5, 0, 0, 0, 'barrel'); }
    }
    /* rochas (ninho na montanha, encostas) */
    function rock(x, z, s, y, c) { const F = frame(x, z, R() * 6, y); geo(F, 'stone', new THREE.IcosahedronGeometry(s, 1), 0, s * .35, 0, c || '#9a948a', R() * 3, R(), R(), 1.3, .7, 1); }
    /* quiosque de jornais / bilhetes */
    function kiosk(x, z, yaw, y, t, c) { const F = frame(x, z, yaw, y); box(F, 'plain', 2.6, 2.6, 2, 0, 0, 0, c || '#2a6a4a', { col: 'solid' }); box(F, 'glassS', 2.2, 1.1, .05, 0, 1.1, 1.01, '#3a5a78'); box(F, 'plain', 3, .2, 2.4, 0, 2.6, .1, '#f2f2f2'); if (t) { const sm = new THREE.Mesh(planeGeo(2.4, .45), new THREE.MeshStandardMaterial({ map: signTex(t, c || '#2a6a4a', '#ffffff'), roughness: .6 })); const [px, py, pz] = F.at(0, 2.35, 1.02); sm.position.set(px, py, pz); sm.rotation.y = F.yaw; scene.add(sm); extras.push(sm); } }
    function plank(x0, z0, x1, z1, y) { const L = Math.hypot(x1 - x0, z1 - z0), F = frame((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), y); box(F, 'wood', 1, .08, L, 0, 0, 0, '#ffffff', { uv: 1 }); }
    function canopy(x, z, w, d, y, h, c) { const F = frame(x, z, 0, y); for (let i = 0; i <= w / 8; i++) geo(F, 'metal', new THREE.CylinderGeometry(.12, .12, h, 8), -w / 2 + i * 8, h / 2, 0, '#5a6a7a'); box(F, 'metal', w + 1, .25, d, 0, h, 0, c || '#3a4a5a'); box(F, 'glassS', w, .06, d - 1, 0, h + .26, 0, '#8ab0c8'); collider(F, w, .4, d, 0, h, 0, 'roof'); }
    function sign(x, y, z, yaw, t, bg, fg, w, h) { const sm = new THREE.Mesh(planeGeo(w || 4, h || .8), new THREE.MeshStandardMaterial({ map: signTex(t, bg || '#1f3a5a', fg || '#ffffff', 512, 96), roughness: .5 })); sm.position.set(x, y, z); sm.rotation.y = yaw || 0; scene.add(sm); extras.push(sm); return sm; }
    function finish() { const meshes = B.build(scene, MT); return { meshes, cols, anim, extras, MT }; }
    return { ship, truck, forklift, lightTower, clutter, rock, kiosk, plank, canopy, sign, frame, box, geo, collider, house, warehouse, container, crane, stall, church, fountain, stage, lamp, bench, bollard, hedge, fence, crate, pallet, pool, deckchair, umbrella, villa, helicopter, boat, rails, train, flag, bunting, ground, roadMarks, crossing, quay, trees, finish, R, pick, MT, WALLS };
  }

  /* ════════════════════════════════════════════════════════════════
     terreno: colinas, montanhas ao fundo, zonas aplanadas, cores
  ════════════════════════════════════════════════════════════════ */
  function Terrain(o) {
    const P = W().perlin(o.seed || 3), P2 = W().perlin((o.seed || 3) + 9), S = o.size || 3600, N = o.n || 240, C = S / N, X0 = (o.cx || 0) - S / 2, Z0 = (o.cz || 0) - S / 2;
    const fb = (x, z, oc) => { let a = 1, f = 1, s = 0, t = 0; for (let i = 0; i < oc; i++) { s += P(x * f, z * f) * a; t += a; a *= .5; f *= 2.05; } return s / t; };
    const flats = o.flats || [];
    function raw(x, z) {
      let h = (o.base || 0) + fb(x / 520, z / 520, 5) * (o.hills || 18) + fb(x / 90, z / 90, 3) * (o.bump || 1.2);
      if (o.mtn) { const d = Math.hypot(x - (o.mtn.x || 0), z - (o.mtn.z || 0)); const k = clamp((d - o.mtn.r0) / (o.mtn.r1 - o.mtn.r0), 0, 1); h += k * k * (o.mtn.h || 300) * (.55 + .45 * Math.abs(P2(x / 700, z / 700))) + k * Math.abs(fb(x / 260, z / 260, 4)) * (o.mtn.h || 300) * .5; }
      if (o.fn) h = o.fn(x, z, h, fb);
      /* zonas aplanadas (retângulos rodados com transição suave) */
      for (const f of flats) {
        const c = Math.cos(f.r || 0), s = Math.sin(f.r || 0), lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
        const dx = Math.max(0, Math.abs(lx) - f.w / 2), dz = Math.max(0, Math.abs(lz) - f.d / 2), d = Math.hypot(dx, dz), k = 1 - clamp(d / (f.f || 30), 0, 1);
        const ks = k * k * (3 - 2 * k); h = lerp(h, f.h, ks);
      }
      return h;
    }
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = raw(X0 + i * C, Z0 + j * C);
    /* altura com a mesma triangulação do PlaneGeometry */
    function hAt(x, z) {
      const fx = (x - X0) / C, fz = (z - Z0) / C, i = clamp(Math.floor(fx), 0, N - 1), j = clamp(Math.floor(fz), 0, N - 1), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
      const a = H[j * (N + 1) + i], b = H[j * (N + 1) + i + 1], c = H[(j + 1) * (N + 1) + i], d = H[(j + 1) * (N + 1) + i + 1];
      return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    }
    function mesh(env) {
      const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2); g.translate(X0 + S / 2, 0, Z0 + S / 2);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), pal = o.pal || {};
      const cG = new THREE.Color(pal.grass || '#6a8f3e'), cG2 = new THREE.Color(pal.grass2 || '#86a24a'), cD = new THREE.Color(pal.dirt || '#9a8460'), cR = new THREE.Color(pal.rock || '#7f786c'), cS = new THREE.Color(pal.sand || '#d8c89a'), cSn = new THREE.Color('#f2f4f8'), cF = new THREE.Color(pal.forest || '#46703a');
      for (let k = 0; k < p.count; k++) {
        const j = Math.floor(k / (N + 1)), i = k % (N + 1), h = H[k]; p.setY(k, h);
        const hx = H[j * (N + 1) + Math.min(N, i + 1)] - H[j * (N + 1) + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * (N + 1) + i] - H[Math.max(0, j - 1) * (N + 1) + i], sl = Math.hypot(hx, hz) / (2 * C);
        const n = P2(p.getX(k) / 60, p.getZ(k) / 60) * .5 + .5;
        c.copy(cG).lerp(cG2, n); if (n > .72) c.lerp(cF, (n - .72) * 2.5);
        if (h < (o.sandH != null ? o.sandH : 1.6)) c.lerp(cS, clamp(((o.sandH != null ? o.sandH : 1.6) - h) / 1.5, 0, 1));
        c.lerp(cD, clamp((sl - .25) * 2.5, 0, .7)); c.lerp(cR, clamp((sl - .55) * 2.2, 0, 1));
        if (o.snow && h > o.snow) c.lerp(cSn, clamp((h - o.snow) / 60, 0, 1) * (1 - clamp((sl - .8) * 2, 0, .6)));
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      const t = textures().detail; t.repeat.set(S / 6, S / 6);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: t, roughness: .96, envMap: env, envMapIntensity: .2 }));
      m.receiveShadow = true; return m;
    }
    return { hAt, mesh, S, raw };
  }

  return { Builder, Terrain, textures, materials, boxGeo, planeGeo, signTex, awningTex, rng, MX };
})();
