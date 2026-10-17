/* ══════════════════════════════════════════════════════════════════
   Operação Soneca — jogo de atirador furtivo SEM violência (out/2026)
   A agente Coruja tem uma espingarda de dardos de sono: quem leva um
   dardo boceja, cambaleia e adormece enroscado no chão a ressonar.
   Nada de sangue nem feridos — a graça está na pontaria.

   Jogabilidade inspirada nos grandes jogos de atirador:
     • mira com 3 ampliações, oscilação da respiração e do coração,
       sustentar a respiração (Shift), queda do dardo e vento;
     • telémetro e zeragem (Z), pontos de referência na retícula;
     • binóculos (B) para identificar e marcar alvos;
     • câmara do dardo em câmara lenta nos tiros bons;
     • guardas que notam colegas a dormir e dardos a cair perto,
       alarme, alvos que fogem (lancha, carro, helicóptero, comboio);
     • 5 missões com mundos próprios: cais, festa da aldeia, telhados
       ao pôr do sol, vivenda nas montanhas e estação à meia-noite.

   Ficheiros: sniper-people.js (gente articulada), sniper-kit.js
   (texturas, prédios, adereços, terreno) e este (jogo e missões).
   Usa sky-ace-world.js (céu, água, nuvens, partículas) e Arcade3D.
══════════════════════════════════════════════════════════════════ */
const SniperGame = (function () {
  'use strict';
  const Ut = ArcadeKit.U, TAU = Math.PI * 2;
  const clamp = Ut.clamp, lerp = Ut.lerp, rand = Ut.rand;
  const ID = 'sniper', SAVE = 'sniper:prog';
  const GRAV = 9.81, DART_V = 380, WIND_K = .5, FOV = 58, ZOOMS = [4, 8, 14], BINO = 6;
  const W = () => SkyAceWorld, K = () => SniperKit, PP = () => SniperPeople;
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const _v1 = { x: 0, y: 0, z: 0 };
  let _v3 = null, _v4 = null;

  /* ── progresso ── */
  function prog() { try { return Object.assign({ u: 0, s: {}, b: {} }, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) { return { u: 0, s: {}, b: {} }; } }
  function saveProg(p) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e) {} }

  /* ════════════════════════════════════════════════════════════════
     roupa e aspeto
  ════════════════════════════════════════════════════════════════ */
  const SKIN = ['#f3cfb3', '#eabf9b', '#d9a47e', '#c08660', '#9a6440', '#734a32', '#f6dcc6'];
  const HAIRC = ['#2a1c12', '#3e2a1a', '#6a4426', '#a0703a', '#d8b070', '#1a1a1a', '#8a8a8a', '#b0502a', '#e0e0d8'];
  const SHIRT = ['#e8e4dc', '#4a7ab8', '#c83a3a', '#3a8a5a', '#e8b030', '#8a5ab0', '#f08aa0', '#5ab0c8', '#f2f2f2', '#d86a3a', '#6a8a3a', '#2a4a7a', '#e0d0a0'];
  const PANTS = ['#3a4a6a', '#2a3a5a', '#a89a70', '#3a3a3e', '#6a5a4a', '#4a5a3a', '#8a8a8a', '#283040'];
  function outfit(R, kind, o) {
    const pick = a => a[Math.floor(R() * a.length)], L = { skin: pick(SKIN), hairC: pick(HAIRC), shirt: pick(SHIRT), pants: pick(PANTS), shoes: pick(['#2b2622', '#5a3a26', '#e8e8e8', '#3a3a4a']), build: .92 + R() * .2, belly: 1 + R() * .15 };
    const fem = R() < .48;
    L.hair = fem ? pick(['long', 'bun', 'pony', 'long', 'curly']) : pick(['short', 'short', 'curly', null, 'short']);
    if (!fem && R() < .25) L.face = pick(['beard', 'mustache']);
    L.long = R() < .35;
    if (kind === 'guard') Object.assign(L, { shirt: '#23262c', pants: '#1d2026', long: true, over: 'lapel', glasses: 'sun', hair: 'short', hat: R() < .3 ? 'cap' : null, hatC: '#1d2026', shoes: '#111111', build: 1.05 + R() * .1, belly: 1, face: R() < .4 ? 'mustache' : null });
    /* capangas da Liga: farda azul-ardósia, boné com emblema, braçadeira vermelha e espingarda de dardos (ponta laranja) */
    if (kind === 'henchman') Object.assign(L, { shirt: '#3a4a66', pants: '#28303e', long: true, over: 'uniform', overC: '#3a4a66', band: 'red', bandC: '#e0342c', gun: 'rifle', glasses: R() < .5 ? 'sun' : null, hair: 'short', hat: 'guard', hatC: '#2c3548', shoes: '#151515', gloves: '#2a2a2a', build: 1.04 + R() * .1, belly: 1, face: R() < .45 ? 'mustache' : null });
    if (kind === 'worker') Object.assign(L, { hat: 'hard', hatC: pick(['#f2c230', '#f0f0f0', '#f27a20']), over: 'vest', overC: '#ff7a1a', long: R() < .5, pants: pick(['#3a4a6a', '#4a4a4a']) });
    if (kind === 'vendor') Object.assign(L, { over: 'apron', overC: pick(['#f4f1ea', '#e8d0a0', '#a0c8e8']), hat: R() < .4 ? 'straw' : null, hatC: '#e0c880' });
    if (kind === 'villager') { if (R() < .3) Object.assign(L, { hat: pick(['straw', 'cap', 'beret', 'fedora']), hatC: pick(['#e0c880', '#c83a3a', '#2a2a3a', '#5a4a3a']) }); }
    if (kind === 'kid') Object.assign(L, { build: .85, belly: 1, face: null, shorts: R() < .6, hat: R() < .3 ? 'cap' : null, hatC: pick(['#e83a3a', '#3a8ae8', '#f2c230']) });
    if (kind === 'tourist') Object.assign(L, { shorts: R() < .5, hat: R() < .4 ? pick(['straw', 'cap']) : null, hatC: pick(['#e0c880', '#f2f2f2']), over: R() < .4 ? 'backpack' : null, overC: pick(['#c83a3a', '#2a64b8', '#3a8a4a']) });
    if (kind === 'chef') Object.assign(L, { shirt: '#f4f4f0', over: 'apron', overC: '#f4f4f0', hat: 'chef', hatC: '#f8f8f8', long: true });
    if (kind === 'fisher') Object.assign(L, { shirt: pick(['#f2c230', '#2a64b8']), long: true, hat: 'beanie', hatC: pick(['#c83a3a', '#2a3a5a']), pants: '#2a3a4a', face: R() < .5 ? 'beard' : null });
    return Object.assign(L, o || {});
  }

  /* ════════════════════════════════════════════════════════════════
     missões
  ════════════════════════════════════════════════════════════════ */
  const LEVELS = [];
  /* ── 1. Cais do Nevoeiro ── */
  LEVELS.push({
    id: 'cais', name: 'Cais do Nevoeiro', icon: '⚓', tod: 'morning', grad: ['#7fa6c8', '#2a4a6a'],
    brief: 'A Liga dos Bigodes escondeu o Bolo-Rei roubado num contentor do cais. Adormece os guardas e depois o Chefe Bigodes, antes que fuja de lancha.',
    wind: [1, 2.5], windDir: 1.2, darts: 16,
    nest: { x: 0, y: 40, z: 0, yaw: 0, yawR: 1.15, pMin: -.55, pMax: .2, look: [0, 4, -215] },
    fog: [260, 2300],
    terrain: { seed: 11, hills: 12, base: 3, size: 4200, n: 260, pal: { grass: '#6f8f48', grass2: '#8aa35a', sand: '#d8c89a' },
      fn: (x, z, h) => { if (z < -306) h = Math.min(h, -12 + (z < -1300 ? (z + 1300) * -0.2 + Math.max(0, Math.sin(x / 300)) * 60 : 0)); if (z < -1500) h = Math.max(h, 40 + Math.sin(x / 400) * 50 + Math.sin(x / 130) * 12); const nh = 30 - Math.hypot(x, z - 10) * .12; return Math.max(h, nh); },
      flats: [{ x: 0, z: -205, w: 470, d: 200, h: 3.5, f: 20 }, { x: 0, z: -80, w: 520, d: 60, h: 3.5, f: 40 }, { x: 0, z: 0, w: 22, d: 22, h: 16, f: 25 }] },
    build(B, G) {
      const P = [], y = 3.5;
      B.quay(0, -205, 470, 200, y);
      B.ground('asphalt', 0, -90, 520, 14, 0, y, '#ffffff', 6); B.roadMarks(-255, -90, 255, -90, y);
      B.ground('concrete', 0, -75, 520, 6, 0, y + .02, '#d8d2c6', 3);
      /* armazéns */
      B.warehouse({ x: -130, z: -138, w: 44, d: 22, h: 11, c: '#9fb4c4', sign: 'ARMAZÉM 7', doors: 3 });
      B.warehouse({ x: 120, z: -140, w: 38, d: 20, h: 10, c: '#c4a88a', sign: 'LOTA DO PEIXE', signBg: '#7a2a1a', doors: 2, doorC: '#e8e0d0' });
      /* contentores (pilhas com corredores) */
      const CC = ['#c83a2a', '#2a64b8', '#3a8a4a', '#e8a020', '#8a3ab0', '#d8d8d0', '#2a8a8a', '#b8582a'];
      [[-50, -205, 3], [-50, -225, 2], [-24, -205, 1], [10, -215, 3], [10, -238, 2], [45, -205, 2], [45, -232, 1], [-50, -250, 1], [80, -215, 1]].forEach(([x, z, n], i) => { for (let k = 0; k < n; k++) B.container(x, z + (k % 2 ? .2 : 0), k % 2 ? .02 : 0, y + k * 2.62, CC[(i * 3 + k) % CC.length]); });
      B.container(-80, -262, Math.PI / 2, y, '#c83a2a');
      /* parque de contentores dos lados (deixa corredores para as patrulhas) */
      [-150, -125, 100, 125, 150].forEach((x, i) => [-200, -222, -244].forEach((z, j) => { const n = 1 + Math.floor(B.R() * 4); for (let k = 0; k < n; k++) B.container(x, z + (k % 2 ? .25 : 0), k % 2 ? .02 : 0, y + k * 2.62, CC[(i * 5 + j * 3 + k) % CC.length]); }));
      for (let i = 0; i < 8; i++) B.ground('concrete', rand(-200, 200), rand(-290, -160), rand(6, 14), rand(4, 9), rand(0, 3), y + .012, B.pick(['#d8cfc0', '#c8c4bc', '#bfb8ae']), 3);
      B.crane({ x: 150, z: -283, yaw: 0, y, h: 34, c: '#e8b030' }); B.crane({ x: -190, z: -283, yaw: 0, y, h: 30, c: '#d8582a' });
      for (let i = 0; i < 14; i++) B.pallet(B.frame(-170 + B.R() * 340, -160 - B.R() * 120, B.R() * 3, y), 0, 0, 0);
      for (let i = 0; i < 10; i++) B.lamp(-200 + i * 44, -292, Math.PI, y);
      for (let i = 0; i < 9; i++) B.lamp(-220 + i * 55, -98, 0, y);
      /* navio porta-contentores atracado, camiões, empilhadores, torres de luz, tralha */
      B.ship({ x: 130, z: -320, yaw: 0, L: 132, w: 22, name: 'BIGODE EXPRESS', c: '#1f3a5a' });
      B.truck(-100, -172, Math.PI / 2, y, '#e8e8e8'); B.truck(-100, -182, Math.PI / 2, y, '#2a64b8', '#d8d8d0'); B.truck(70, -170, -Math.PI / 2, y, '#c83a2a', false); B.truck(150, -178, -Math.PI / 2, y, '#f2f2f2');
      [[-120, -232], [80, -190], [-10, -165], [160, -250]].forEach(([x, z]) => B.lightTower(x, z, y));
      [[-160, -295, 'nets'], [-120, -296, 'rope'], [-80, -295, 'buoys'], [-30, -296, 'nets'], [95, -160, 'fish'], [110, -160, 'fish'], [135, -158, 'barrels'], [-160, -160, 'barrels'], [-20, -232, 'barrels'], [65, -262, 'rope']].forEach(([x, z, k]) => B.clutter(x, z, y, k));
      for (let i = 0; i < 6; i++) { B.ground('plain', -200 + i * 80, -268, 50, .25, 0, y + .01, '#f2c230'); B.ground('plain', -200 + i * 80, -150, 50, .25, 0, y + .01, '#f2c230'); }
      for (let i = 0; i < 9; i++) B.ground('plain', -40 + i * 12, -280, .2, 6, 0, y + .01, '#f4f2ea');
      for (let i = 0; i < 6; i++) B.ground('glassS', rand(-180, 180), rand(-280, -160), rand(2, 5), rand(1.5, 3), rand(0, 3), y + .015, '#5a6a78', 2);
      G.movers = [B.forklift(-60, -170, 0, y), B.forklift(40, -260, 0, y)].map((fk, i) => ({ fk, path: i ? [[30, -262], [30, -195], [80, -195]] : [[-150, -168], [-62, -168], [-62, -240]], s: 0, v: 3, ping: true }));
      /* casario do cais (atrás da estrada) e um café com esplanada */
      [[-230, -48], [-200, -46], [-170, -50], [-140, -47], [160, -48], [190, -50], [222, -46]].forEach(([x, z], i) => B.house({ x, z, yaw: 0, w: 12 + (i % 3) * 3, d: 12, floors: 2 + (i % 2), y, shop: i === 3 ? { c: '#2a64b8', t: 'CAFÉ DO PORTO' } : i === 5 ? { c: '#c83a3a', t: 'PEIXARIA' } : null, smoke: i % 3 === 0 }));
      /* esplanada do café: mesas com chapéu de sol (as cadeiras aparecem debaixo de quem se senta) */
      for (let i = 0; i < 4; i++) { B.cafeTable(-152 + i * 5, -66, y); B.umbrella(-152 + i * 5, -66, y, ['#e85a3a', '#2a8ae8', '#f2c230', '#3a8a4a'][i]); }
      /* farol no molhe */
      const F = B.frame(240, -360, 0, 0); B.box(F, 'stone', 20, 4, 70, 0, -4, 25, '#9a948a', { uv: 2 }); B.geo(F, 'paint', new THREE.CylinderGeometry(2.2, 3, 18, 16), 0, 9, 0, '#f4f1ea'); for (let k = 0; k < 3; k++) B.geo(F, 'paint', new THREE.CylinderGeometry(2.25 + k * .0, 2.6 - k * .2, 2, 16), 0, 3 + k * 5, 0, '#d83a2a'); B.geo(F, 'glassS', new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12), 0, 19.2, 0, '#fff4c0'); B.geo(F, 'paint', new THREE.ConeGeometry(2, 1.6, 12), 0, 21.2, 0, '#d83a2a'); B.collider(F, 5, 22, 5, 0, 0, 0, 'wall');
      /* torre de água do ninho (onde está a Coruja) */
      const N = B.frame(0, 2, 0, 16); [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([a, b]) => B.box(N, 'metal', .5, 22, .5, a, 0, b, '#6a7078')); B.geo(N, 'metal', new THREE.CylinderGeometry(5, 5, 4, 20), 0, 24.3, 0, '#8a9aa8'); B.box(N, 'wood', 9, .2, 9, 0, 22, 0, '#ffffff', { uv: 1 }); for (let k = 0; k < 4; k++) { B.box(N, 'metal', 9, .06, .06, 0, 23, -4.5, '#3a3a3a'); }
      B.box(N, 'metal', 9, .06, .06, 0, 23.1, -4.4, '#3a3a3a'); B.box(N, 'metal', .08, 1.1, .08, -4.4, 22, -4.4, '#3a3a3a'); B.box(N, 'metal', .08, 1.1, .08, 4.4, 22, -4.4, '#3a3a3a');
      /* árvores na encosta */
      const T = []; for (let i = 0; i < 260; i++) { const x = rand(-900, 900), z = rand(-40, 600); if (Math.hypot(x, z) < 30 || Math.abs(z + 80) < 30) continue; T.push({ x, z, k: B.R() < .5 ? 'pine' : 'leaf', s: .7 + B.R() * .6 }); }
      for (let i = 0; i < 120; i++) T.push({ x: rand(-1800, 1800), z: rand(-2400, -1600), k: 'pine', s: 1 + B.R() });
      G.treeList = T;
      /* barcos */
      G.boats = [[-175, -311, .05, '#2a64b8'], [-135, -311.5, -.03, '#c83a2a'], [-95, -311, .04, '#3a8a4a'], [-55, -312, -.06, '#e8a020'], [35, -311, .02, '#2a8a8a']].map(([x, z, r, c]) => B.boat(x, z, Math.PI / 2 + r, { c, flag: '#f4f1ea' }));
      G.escapeBoat = B.boat(0, -309, Math.PI / 2, { c: '#7a3ab0', speed: true });
      /* gente */
      const R = B.R;
      const gp = [[[-60, -195], [-60, -262], [-36, -262], [-36, -195]], [[25, -196], [60, -196], [60, -250], [25, -250]], [[-90, -180], [-10, -180]], [[30, -270], [-30, -270], [-30, -290], [30, -290]]];
      gp.forEach((path, i) => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman'), beh: { type: 'patrol', path: path.map(p => [p[0], p[1], 3 + R() * 4, ['look', 'arms', 'radio', 'bino'][Math.floor(R() * 4)]]) }, aware: true }));
      P.push({ role: 'guard', tag: 'guard', name: 'Vigia', look: outfit(R, 'henchman'), beh: { type: 'stand', x: 10, z: -215, y: y + 3 * 2.62, yaw: Math.PI * .1, act: 'bino', turn: 1 }, aware: true, range: 55 });
      P.push({ role: 'boss', tag: 'boss', name: 'Chefe Bigodes', look: outfit(R, 'guard', { shirt: '#5a2a6a', pants: '#3a1a4a', over: 'lapel', overC: '#ffffff', hat: 'fedora', hatC: '#2a1a2a', face: 'mustache', hairC: '#1a1a1a', glasses: null, build: 1.15, belly: 1.25, prop: 'case', propC: '#6a3a1a' }), beh: { type: 'path', path: [[-115.3, -126.5], [-114, -123], [-100, -123], [-100, -160], [-75, -195], [-75, -280], [-20, -285], [0, -302]], speed: 1.25, end: (G, P) => boatEscape(G, P) }, hidden: true, vip: true, aware: true });
      for (let i = 0; i < 6; i++) P.push({ role: 'civ', tag: 'worker', name: 'Estivador', look: outfit(R, 'worker'), beh: { type: 'wander', area: [-200, -275, 200, -150], acts: ['talk', 'arms', 'cup', 'hips', 'point'] } });
      for (let i = 0; i < 3; i++) P.push({ role: 'civ', tag: 'fisher', name: 'Pescador', look: outfit(R, 'fisher'), beh: { type: 'stand', x: -150 + i * 45 + 20, z: -296, yaw: Math.PI + rand(-.4, .4), act: ['talk', 'arms', 'cup'][i] } });
      for (let i = 0; i < 6; i++) P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, 'tourist'), beh: { type: 'sit', x: -152 + (i % 4) * 5, z: i < 4 ? -66.78 : -65.22, yaw: i < 4 ? 0 : Math.PI, act: ['cup', 'talk', 'phone', 'listen'][i % 4] } });
      for (let i = 0; i < 6; i++) P.push({ role: 'civ', tag: 'civ', name: 'Transeunte', look: outfit(R, R() < .5 ? 'tourist' : 'villager'), beh: { type: 'path', path: i % 2 ? [[-250, -75], [250, -75]] : [[250, -77], [-250, -77]], loop: 'ping', speed: rand(1.1, 1.6), act: R() < .3 ? 'phone' : null } });
      /* patos de borracha escondidos */
      /* patos onde o ninho os vê (verificado por raio a partir do ninho): em cima de um contentor, a boiar ao largo e na cumeeira da lota */
      G.collect = { kind: 'duck', name: 'patos de borracha', list: [[-24, y + 2.62 + .02, -205], [-60, 0, -372], [120, y + 10 + 3.6 + .05, -140]] };
      G.carsDef = [{ path: [[-260, -92], [260, -92]], loop: 'ping', n: 3, speed: 9 }];
      G.birds = { n: 26, kind: 'gull', centers: [[0, 22, -240], [-140, 18, -290], [150, 26, -210]], perch: [[-50, y + 3 * 2.62, -205], [45, y + 2 * 2.62, -205], [-150, y + .9, -295], [10, y + 2.62 + 2.6, -238]] };
      return P;
    },
    onAlarm(G) { const b = G.people.find(p => p.tag === 'boss'); if (b && b.beh) b.beh.speed = 3.4; },
    objectives: [
      { id: 'mark', text: 'Usa os binóculos (B) para marcar os guardas', opt: true, check: G => G.people.filter(p => p.tag === 'guard' && p.marked).length >= 3 },
      { id: 'guards', text: 'Adormece os 5 guardas do cais', check: G => G.people.filter(p => p.tag === 'guard' && p.sleep).length >= 5, prog: G => G.people.filter(p => p.tag === 'guard' && p.sleep).length + '/5' },
      { id: 'boss', text: 'Adormece o Chefe Bigodes antes de chegar à lancha', after: 'guards', onShow: G => reveal(G, 'boss', 'O Chefe Bigodes saiu do armazém!'), check: G => G.people.some(p => p.tag === 'boss' && p.sleep) },
      { id: 'collect', text: 'Encontra 3 patos de borracha', opt: true, check: G => G.got >= 3, prog: G => G.got + '/3' },
    ],
  });

  /* ── 2. Festa na Aldeia ── */
  LEVELS.push({
    id: 'aldeia', name: 'Festa na Aldeia', icon: '🎪', tod: 'afternoon', grad: ['#f2c27a', '#8a4a2a'],
    brief: 'Um gatuno da Liga anda a roubar carteiras na festa. Encontra-o com os binóculos — camisola às riscas e gorro — e adormece-o. Cuidado com a multidão!',
    wind: [2, 4], windDir: -.6, darts: 15, timer: 300,
    nest: { x: 0, y: 52, z: 0, yaw: 0, yawR: 1, pMin: -.5, pMax: .15, look: [0, 21, -222] },
    fog: [380, 3200],
    terrain: { seed: 23, hills: 26, base: 18, size: 4200, n: 260, pal: { grass: '#7a9a48', grass2: '#a0aa58', dirt: '#a88a5a' },
      fn: (x, z, h) => Math.max(h, 40 - Math.hypot(x, z) * .1) + (Math.hypot(x, z + 200) > 900 ? (Math.hypot(x, z + 200) - 900) * .12 : 0),
      flats: [{ x: 0, z: -222, w: 170, d: 120, h: 20, f: 50 }, { x: 0, z: 0, w: 20, d: 20, h: 40, f: 30 }] },
    build(B, G) {
      const P = [], y = 20, R = B.R, cz = -222;
      B.ground('cobble', 0, cz, 66, 46, 0, y, '#ffffff', 3);
      B.ground('cobble', 0, cz + 40, 10, 40, 0, y, '#e8e0d0', 3); B.ground('cobble', 70, cz, 80, 9, 0, y, '#e8e0d0', 3); B.ground('cobble', -70, cz + 6, 80, 9, 0, y, '#e8e0d0', 3);
      B.fountain({ x: 0, z: cz + 4, y });
      B.stage({ x: 0, z: cz - 19, yaw: 0, y, t: 'FESTA DE S. BIGODE' });
      B.church({ x: -46, z: cz - 6, yaw: Math.PI / 2, y });
      /* casas a toda a volta (o lado de baixo fica aberto para a Coruja ver) */
      const WL = B.WALLS;
      for (let i = 0; i < 6; i++) B.house({ x: -24 + i * 10 - 4, z: cz - 34, yaw: 0, w: 9.6, d: 10, floors: 2 + (i % 2), y, wall: WL[(i * 3) % WL.length], shop: i === 1 ? { c: '#c83a3a', t: 'PADARIA' } : i === 4 ? { c: '#2a8a4a', t: 'MERCEARIA' } : null, smoke: i === 2 });
      for (let i = 0; i < 4; i++) B.house({ x: 40, z: cz - 18 + i * 11, yaw: -Math.PI / 2, w: 10.5, d: 10, floors: 2 + ((i + 1) % 2), y, wall: WL[(i * 5 + 2) % WL.length], shop: i === 2 ? { c: '#2a64b8', t: 'TASCA' } : null });
      for (let i = 0; i < 5; i++) B.house({ x: -70 - (i % 2) * 2, z: cz - 40 + i * 13, yaw: Math.PI / 2, w: 12, d: 10, floors: 2, y, wall: WL[(i * 7) % WL.length] });
      for (let i = 0; i < 7; i++) { const x = 60 + i * 13; B.house({ x, z: cz - 12, yaw: 0, w: 11, d: 9, floors: 2, y: y - Math.max(0, i - 3) * 0, wall: WL[(i * 2 + 1) % WL.length] }); B.house({ x, z: cz + 14, yaw: Math.PI, w: 11, d: 9, floors: 1 + (i % 2), y, wall: WL[(i * 4) % WL.length] }); }
      /* bancas, toldos, mesas, bandeirinhas */
      const st = [[-28, cz + 16, Math.PI / 2, 'fruit', 'FRUTA'], [-28, cz + 6, Math.PI / 2, 'bread', 'BOLOS'], [-28, cz - 4, Math.PI / 2, 'flowers'], [28, cz + 16, -Math.PI / 2, 'jars', 'MEL'], [28, cz + 6, -Math.PI / 2, 'toys', 'BRINQUEDOS'], [28, cz - 4, -Math.PI / 2, 'fruit'], [-12, cz + 20, Math.PI, 'bread', 'FARTURAS'], [12, cz + 20, Math.PI, 'flowers']];
      st.forEach(([x, z, r, k, t]) => B.stall({ x, z, yaw: r, y, kind: k, t }));
      G.balloonSpots = st.map(([x, z, r]) => [x + Math.sin(r) * -1.6, y + 3.2, z + Math.cos(r) * -1.6]);
      for (let i = 0; i < 4; i++) { B.cafeTable(-14 + i * 9, cz + 28, y); B.umbrella(-14 + i * 9, cz + 28, y, ['#e85a3a', '#2a8ae8', '#f2c230', '#3a8a4a'][i]); }
      for (let i = 0; i < 8; i++) B.bench(-30 + i * 8.5, cz + 32, Math.PI, y);
      const bc = ['#e83a3a', '#f2c230', '#3a8ae8', '#3ac05a', '#f08ab0', '#f4f1ea'];
      B.bunting([[-34, y + 7, cz - 28], [34, y + 7, cz + 20]], bc); B.bunting([[34, y + 7, cz - 28], [-34, y + 7, cz + 20]], bc); B.bunting([[-34, y + 6.5, cz - 6], [34, y + 6.5, cz - 6]], bc);
      B.flag(-20, cz + 22, y, 9, ['#2a8a4a', '#d83a2a']); B.flag(20, cz + 22, y, 9, ['#2a64b8', '#f4f1ea', '#2a64b8']);
      for (let i = 0; i < 10; i++) B.lamp(-32 + i * 7, cz + 24, Math.PI, y);
      /* moinho (ninho da Coruja) */
      const N = B.frame(0, 4, 0, 40); B.geo(N, 'plain', new THREE.CylinderGeometry(3.6, 4.6, 12, 16), 0, 6, 0, '#f4f1ea'); B.geo(N, 'tiles', new THREE.ConeGeometry(4.2, 3.4, 16), 0, 13.7, 0, '#8a5a3a');
      G.mill = { x: 0, y: 40 + 13, z: 7.2 };
      /* vinhas e oliveiras nas encostas */
      const T = [];
      for (let r = 0; r < 26; r++) for (let k = 0; k < 40; k++) { const x = -420 + k * 6 + (r % 2) * 3, z = 60 + r * 7; T.push({ x: x, z, k: 'leaf', s: .16 + R() * .05, c: '#5a8a2a' }); const x2 = 160 + k * 6, z2 = -120 - r * 6; if (z2 > -170) T.push({ x: x2, z: z2, k: 'leaf', s: .15, c: '#6a9a3a' }); }
      for (let i = 0; i < 380; i++) { const x = rand(-1200, 1200), z = rand(-1500, 700); if (Math.abs(x) < 110 && z > cz - 60 && z < cz + 50) continue; if (Math.hypot(x, z) < 30) continue; if (Math.abs(x) < 140 && Math.abs(z - cz) < 70) continue; T.push({ x, z, k: R() < .3 ? 'cypress' : 'leaf', s: .6 + R() * .6, c: R() < .5 ? '#7a9050' : null }); }
      for (let i = 0; i < 6; i++) T.push({ x: -58 + i * 2, z: cz + 30 + (i % 2) * 3, k: 'cypress', s: .7 });
      G.treeList = T;
      /* gente: banda, público a dançar, bancas, mesas, crianças */
      [['sing', 0, null], ['guitar', -2.5, 'guitar'], ['guitar', 2.5, 'guitar'], ['drum', 0, null]].forEach(([a, dx, pr], i) => P.push({ role: 'civ', tag: 'band', name: 'Músico', look: outfit(R, 'villager', { prop: pr, propC: '#c8783a', shirt: ['#c83a3a', '#2a2a2a', '#f2c230', '#2a64b8'][i] }), beh: { type: 'stand', x: dx, z: cz - 19 + (i === 3 ? -1.8 : .8), y: y + 1.2, yaw: 0, act: a } }));
      for (let i = 0; i < 24; i++) { const a = R() * TAU, r = 3 + R() * 9; P.push({ role: 'civ', tag: 'civ', name: 'Festeiro', look: outfit(R, R() < .2 ? 'kid' : 'villager'), s: undefined, beh: { type: 'dance', x: Math.cos(a) * r * 1.3, z: cz - 8 + Math.sin(a) * r * .6, yaw: Math.PI + rand(-.5, .5), act: R() < .75 ? 'dance' : R() < .5 ? 'clap' : 'cheer' } }); }
      st.forEach(([x, z, r], i) => P.push({ role: 'civ', tag: 'vendor', name: 'Vendedor', look: outfit(R, 'vendor'), beh: { type: 'stand', x: x - Math.sin(r) * .7, z: z - Math.cos(r) * .7, yaw: r, act: 'vendor' } }));
      for (let i = 0; i < 8; i++) P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, 'villager'), beh: { type: 'sit', x: -14 + (i % 4) * 9 + (i < 4 ? -.78 : .78), z: cz + 28, yaw: i < 4 ? Math.PI / 2 : -Math.PI / 2, act: ['cup', 'talk', 'ice', 'listen'][i % 4] } });
      for (let i = 0; i < 18; i++) { const kid = R() < .3; P.push({ role: 'civ', tag: 'civ', name: kid ? 'Criança' : 'Visitante', look: outfit(R, kid ? 'kid' : R() < .5 ? 'tourist' : 'villager', { prop: kid && R() < .6 ? 'balloon' : R() < .25 ? 'ice' : R() < .2 ? 'phone' : null, propC: ['#e83a3a', '#3a8ae8', '#f2c230', '#3ac05a'][i % 4] }), s: kid ? .62 + R() * .1 : undefined, beh: { type: 'wander', area: [-26, cz - 12, 26, cz + 24], acts: ['talk', 'look', 'clap', 'cup', 'listen', 'point'], speed: kid ? 1.7 : undefined } }); }
      for (let i = 0; i < 3; i++) P.push({ role: 'civ', tag: 'civ', name: 'Idoso', look: outfit(R, 'villager', { hairC: '#d8d8d0', hat: R() < .5 ? 'beret' : 'fedora', hatC: '#2a2a3a' }), beh: { type: 'sit', bench: true, x: -30 + i * 8.5 + (i % 2 ? .4 : -.4), z: cz + 32, yaw: Math.PI, act: ['listen', 'talk', 'arms'][i] } });
      /* o gatuno das riscas e os vigias de boné vermelho */
      P.push({ role: 'thief', tag: 'thief', name: 'Gatuno das Riscas', look: outfit(R, 'villager', { shirt: '#f4f1ea', over: 'stripes', overC: '#1a1a1a', hat: 'beanie', hatC: '#1a1a1a', face: 'mustache', hairC: '#1a1a1a', pants: '#2a2a3a', long: true }), beh: { type: 'wander', area: [-24, cz - 10, 24, cz + 22], acts: ['look', 'hips', 'point', 'phone'], speed: 1.15, pick: true }, aware: true, vip: true, range: 22 });
      [[-30, cz + 26, .7], [31, cz - 24, -2.4]].forEach(([x, z, yaw]) => P.push({ role: 'guard', tag: 'lookout', name: 'Vigia', look: outfit(R, 'villager', { hat: 'cap', hatC: '#d82a2a', face: 'mustache', shirt: '#2a2a3a', glasses: 'sun', gun: 'rifle', band: 'red', bandC: '#e0342c', long: true }), beh: { type: 'stand', x, z, yaw, act: 'arms', turn: 1 }, aware: true, range: 38 }));
      G.escape = [[30, cz + 2], [60, cz + 1], [140, cz + 1], [180, cz + 1]];
      G.escapePath = P => [[P.x, P.z]].concat(G.escape);
      G.collect = { kind: 'balloon', name: 'balões', list: G.balloonSpots.slice(0, 6) };
      G.birds = { n: 18, kind: 'pigeon', centers: [[0, y, cz + 10]] };
      G.bellAt = [-46 + 0, y + 20.4, cz - 6 + 7.8];
      return P;
    },
    objectives: [
      { id: 'find', text: 'Encontra o gatuno das riscas com os binóculos (B)', check: G => G.people.some(p => p.tag === 'thief' && (p.marked || p.sleep)) },
      { id: 'thief', text: 'Adormece o gatuno antes que fuja', check: G => G.people.some(p => p.tag === 'thief' && p.sleep), timer: true },
      { id: 'look', text: 'Adormece os 2 vigias de boné vermelho', opt: true, check: G => G.people.filter(p => p.tag === 'lookout' && p.sleep).length >= 2, prog: G => G.people.filter(p => p.tag === 'lookout' && p.sleep).length + '/2' },
      { id: 'collect', text: 'Rebenta 6 balões das bancas', opt: true, check: G => G.got >= 6, prog: G => G.got + '/6' },
    ],
  });


  /* ── 3. Telhados ao Pôr do Sol ── */
  LEVELS.push({
    id: 'telhados', name: 'Telhados ao Pôr do Sol', icon: '🌇', tod: 'sunset', grad: ['#ff9a5a', '#4a2a5a'],
    brief: 'Bigodes Júnior leva a Receita Secreta numa mala pelos telhados. Adormece-o — mas há vigias com binóculos nos prédios à volta. Se derem o alarme, foge de carro!',
    wind: [3, 5], windDir: 2.2, darts: 16,
    nest: { x: 0, y: 64, z: 0, yaw: 0, yawR: 1.05, pMin: -.6, pMax: .2, look: [0, 18, -300] },
    fog: [420, 3400],
    terrain: { seed: 31, hills: 6, base: 2, size: 4400, n: 220, pal: { grass: '#6a7a4a', grass2: '#7a8a52' }, flats: [{ x: 0, z: -230, w: 1300, d: 700, h: 2, f: 80 }],
      fn: (x, z, h) => h + Math.max(0, Math.hypot(x, z + 230) - 1100) * .18 },
    build(B, G) {
      const P = [], y = 2, R = B.R, WL = B.WALLS;
      /* torre do ninho */
      B.house({ x: 0, z: 9, yaw: 0, w: 26, d: 21, floors: 20, y, office: true, noLaundry: true });
      /* grelha de ruas: avenidas ao longo de x (z fixo) e ruas ao longo de z */
      const ZS = [-40, -110, -190, -260, -345, -420, -500], XS = [-330, -230, -130, -45, 45, 130, 230, 330];
      ZS.forEach(z => { B.ground('asphalt', 0, z, 760, 13, 0, y, '#ffffff', 6); B.roadMarks(-380, z, 380, z, y); B.ground('concrete', 0, z - 8.5, 760, 4, 0, y + .02, '#cfcabe', 2); B.ground('concrete', 0, z + 8.5, 760, 4, 0, y + .02, '#cfcabe', 2); });
      XS.forEach(x => { B.ground('asphalt', x, -270, 13, 560, 0, y + .01, '#ffffff', 6); B.roadMarks(x, -540, x, 0, y); });
      ZS.forEach(z => XS.forEach(x => B.crossing(x + 10, z, Math.PI / 2, y, 8)));
      /* quarteirões: prédios a toda a volta do quarteirão, alturas variadas */
      const target = { x0: -45, x1: 45, z0: -345, z1: -260 };
      for (let bi = 0; bi < ZS.length - 1; bi++) for (let bj = 0; bj < XS.length - 1; bj++) {
        const z0 = ZS[bi + 1] + 11, z1 = ZS[bi] - 11, x0 = XS[bj] + 11, x1 = XS[bj + 1] - 11;
        if (x0 === target.x0 + 11 && z0 === target.z0 + 11) continue;
        if (z1 > -60 && Math.abs((x0 + x1) / 2) < 60) continue;
        const near = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2 + 300);
        const fl = () => near < 160 ? 5 + Math.floor(R() * 4) : 3 + Math.floor(R() * 7);
        /* frente para as avenidas (z) */
        for (let x = x0; x < x1 - 8; ) { const w = Math.min(x1 - x, 12 + Math.floor(R() * 10)); B.house({ x: x + w / 2, z: z1 - 7, yaw: 0, w: w - .2, d: 14, floors: fl(), y, roof: R() < .75 ? 'flat' : 'gable', balc: near < 230, wall: WL[Math.floor(R() * WL.length)], shop: R() < .4 ? { c: B.pick(['#c83a3a', '#2a64b8', '#2a8a4a', '#e8a020', '#5a3a8a']), t: B.pick(['CAFÉ', 'FARMÁCIA', 'LIVROS', 'PADARIA', 'FLORES', 'GELADOS', 'SAPATOS', null]) } : null, office: R() < .15 }); x += w; }
        for (let x = x0; x < x1 - 8; ) { const w = Math.min(x1 - x, 12 + Math.floor(R() * 10)); B.house({ x: x + w / 2, z: z0 + 7, yaw: Math.PI, w: w - .2, d: 14, floors: fl(), y, roof: R() < .75 ? 'flat' : 'gable', balc: false, wall: WL[Math.floor(R() * WL.length)] }); x += w; }
      }
      /* o quarteirão-alvo: quatro prédios de 6 pisos com telhados ligados por pranchas */
      const H6 = 3.2 + 5 * 3, ry = y + H6 + .05;
      [[-22, -282, 40, 22], [22, -282, 42, 22], [22, -322, 42, 24], [-22, -322, 40, 24]].forEach(([x, z, w, d], i) => B.house({ x, z, yaw: [0, 0, Math.PI, Math.PI][i], w: w - 1, d, floors: 6, y, roof: 'flat', wall: ['#e8c9a0', '#cfe0e8', '#f2d0b8', '#e8eef0'][i], shop: i < 2 ? { c: ['#2a8a4a', '#c83a3a'][i], t: ['MERCADO', 'PIZZARIA'][i] } : null }));
      B.plank(-2, -282, 2, -282, ry); B.plank(-2, -322, 2, -322, ry); B.plank(-22, -293.5, -22, -310, ry); B.plank(22, -293.5, 22, -310, ry);
      /* gnomos nos telhados (brindes) */
      G.collect = { kind: 'gnome', name: 'gnomos', list: [[-30, ry, -281], [31, ry, -330], [-150, y + 3.2 + 4 * 3 + .05 + .6, -229]] };
      /* árvores nas avenidas */
      const T = []; ZS.forEach(z => { for (let x = -360; x < 360; x += 16) if (Math.abs(x - Math.round(x / 100) * 100) > 14) T.push({ x: x + 3, z: z - 8.6, k: 'leaf', s: .5 + R() * .15 }); });
      for (let i = 0; i < 300; i++) { const a = R() * TAU, r = 900 + R() * 900; T.push({ x: Math.cos(a) * r, z: -230 + Math.sin(a) * r, k: R() < .5 ? 'pine' : 'leaf', s: .8 + R() * .7 }); }
      G.treeList = T;
      for (let i = 0; i < 14; i++) B.lamp(-330 + i * 50, -251, 0, y);
      /* gente na rua */
      for (let i = 0; i < 26; i++) { const z = B.pick(ZS.slice(1, 5)) + (R() < .5 ? -8.6 : 8.6), dir = R() < .5; P.push({ role: 'civ', tag: 'civ', name: 'Transeunte', look: outfit(R, B.pick(['tourist', 'villager', 'villager']), { prop: R() < .3 ? 'phone' : R() < .15 ? 'case' : R() < .1 ? 'ice' : null }), beh: { type: 'path', path: dir ? [[-320, z], [320, z]] : [[320, z], [-320, z]], loop: 'ping', speed: rand(1, 1.6), act: 'phone' }, s: R() < .1 ? .65 : undefined }); }
      for (let i = 0; i < 4; i++) { B.cafeTable(-36 + i * 3, -250.8, y); if (i % 2 === 0) B.umbrella(-34.5 + i * 3, -250.8, y, ['#2a8a4a', '#c83a3a'][i / 2]); }
      for (let i = 0; i < 8; i++) P.push({ role: 'civ', tag: 'civ', name: 'Cliente', look: outfit(R, 'villager'), beh: { type: 'sit', x: -36 + (i % 4) * 3, z: Math.floor(i / 4) ? -250.02 : -251.58, yaw: Math.floor(i / 4) ? Math.PI : 0, act: ['cup', 'talk', 'phone', 'listen'][i % 4] } });
      /* vigias nos telhados à volta (binóculos) */
      const roofsY = (f) => y + 3.2 + (f - 1) * 3 + .05;
      G.spotters = [[-90, -246, 0, 7], [95, -246, 0, 8], [-100, -352, Math.PI, 6], [100, -352, Math.PI, 7], [-14, -312, Math.PI * .8, 6], [14, -290, Math.PI * .1, 6]];
      P.push(...G.spotters.slice(4).map(([x, z, yaw]) => ({ role: 'guard', tag: 'guard', name: 'Vigia', look: outfit(R, 'henchman'), beh: { type: 'stand', x, z, y: ry, yaw, act: 'bino', turn: 1 }, aware: true, range: 55 })));
      /* estafeta da mala e o comprador */
      P.push({ role: 'boss', tag: 'courier', name: 'Bigodes Júnior', look: outfit(R, 'guard', { shirt: '#c83a3a', over: 'lapel', overC: '#ffffff', hat: 'fedora', hatC: '#1a1a1a', face: 'mustache', glasses: null, prop: 'case', propC: '#3a2a1a' }), beh: { type: 'seq', speed: 1.3, steps: [{ go: [-30, -276] }, { do: 'look', d: 6 }, { go: [-22, -296] }, { go: [-22, -312] }, { go: [-30, -330] }, { do: 'phone', d: 8 }, { go: [0, -322] }, { go: [26, -322] }, { go: [30, -312] }, { go: [22, -296] }, { go: [24, -278] }, { do: 'talk', d: 9, yaw: Math.PI / 2 }, { go: [0, -282] }] }, y: ry, vip: true, aware: true, range: 40 });
      P.push({ role: 'guard', tag: 'buyer', name: 'Comprador', look: outfit(R, 'guard', { shirt: '#2a4a3a', hat: 'fedora', hatC: '#3a3a2a' }), beh: { type: 'stand', x: 32, z: -278, y: ry, yaw: -Math.PI / 2, act: 'arms', turn: 0 }, aware: true, range: 45 });
      for (const p of P) if (p.beh && p.beh.y == null && (p.tag === 'courier')) p.beh.y = ry;
      /* trânsito */
      G.carsDef = [{ path: [[-370, -253], [370, -253]], loop: 'ping', n: 5, speed: 10 }, { path: [[-370, -183], [370, -183]], loop: 'ping', n: 4, speed: 11 }, { path: [[-38, -520], [-38, -20]], loop: 'ping', n: 3, speed: 9, lane: 2.2 }, { path: [[138, -520], [138, -20]], loop: 'ping', n: 3, speed: 9 }];
      G.carsDef.push({ path: [[52, -300], [52, -352], [240, -352], [380, -352]], n: 1, speed: 13, tag: 'escape', type: 'sport', color: '#1a1a1a', parked: true, at: 0 });
      G.birds = { n: 16, kind: 'pigeon', centers: [[-30, ry, -300], [30, ry, -300]] };
      G.birds.roof = true;
      G.courierRoofY = ry;
      return P;
    },
    onAlarm(G) {
      const C = G.people.find(p => p.tag === 'courier' && !p.sleep); if (!C) return;
      C.fleeing = true; C.beh = { type: 'path', speed: 3.8, path: [[C.x, C.z], [36, -292]], end: (G, P) => { P.hidden = true; G.courierDown = 6; } }; C.wi = 1;
    },
    script(G, dt) {
      if (G.courierDown > 0) { G.courierDown -= dt; if (G.courierDown <= 0) { const C = G.people.find(p => p.tag === 'courier'); C.hidden = false; C.fy = null; C.x = 46; C.z = -294; C.beh = { type: 'path', speed: 3.6, path: [[46, -294], [52, -298]], end: (G, P) => { const car = G.cars.find(c => c.tag === 'escape'); P.beh = { type: 'ride', obj: car.g, seat: car.seat, rot: Math.PI / 2, act: 'drive' }; P.marked = true; setPip(G, P, 'Bigodes Júnior meteu-se no carro preto!', 4, 3); car.go = true; car.parked = false; car.v = 0; car.carrier = P; car.onEnd = G => fail(G, 'Bigodes Júnior fugiu de carro!'); G.obj.find(o => o.id === 'tires').shown = true; hint(G, 'Fugiu para o carro preto — fura-lhe os pneus!', 3, true); } }; C.wi = 1; } }
      const car = G.cars.find(c => c.tag === 'escape');
      if (car && car.go && car.flat >= 2 && car.v < .3 && car.carrier) { const C = car.carrier; car.carrier = null; C.hidden = false; C.sitting = false; C.x = car.x + 2; C.z = car.z + 1; C.fy = null; C.beh = { type: 'path', speed: 3.4, path: [[C.x, C.z], [C.x + 10, C.z], [380, C.z]], end: 'escape' }; C.wi = 1; hint(G, 'Saiu do carro a correr — agora!', 2.5, true); }
    },
    objectives: [
      { id: 'courier', text: 'Adormece Bigodes Júnior (mala castanha)', check: G => G.people.some(p => p.tag === 'courier' && p.sleep) },
      { id: 'tires', text: 'Fura 2 pneus do carro de fuga', after: '__never', opt: true, check: G => { const c = G.cars.find(c => c.tag === 'escape'); return c && c.flat >= 2; } },
      { id: 'spot', text: 'Adormece os 2 vigias e o comprador sem alarme', opt: true, check: G => !G.alarm && G.people.filter(p => (p.tag === 'guard' || p.tag === 'buyer') && p.sleep).length >= 3 },
      { id: 'collect', text: 'Encontra 3 gnomos nos telhados', opt: true, check: G => G.got >= 3, prog: G => G.got + '/3' },
    ],
  });

  /* ── 4. Vila do Barão ── */
  LEVELS.push({
    id: 'vila', name: 'Vila do Barão', icon: '🏔️', tod: 'noon', grad: ['#7ac8f0', '#2a5a3a'],
    brief: 'O Barão Bigodes apanha sol na vila do outro lado do vale, a mais de 500 m. Vento forte nas montanhas: mede a distância, acerta a zeragem e conta com o desvio. Se houver alarme, foge de helicóptero!',
    wind: [4, 7], windDir: 1.57, darts: 14,
    nest: { x: 0, y: 151.8, z: 0, yaw: 0, yawR: .7, pMin: -.4, pMax: .2, look: [0, 98, -520] },
    fog: [700, 5200],
    terrain: { seed: 47, hills: 30, base: 60, size: 5200, n: 300, snow: 330, pal: { grass: '#6a8f3a', grass2: '#8aa04a', rock: '#8a8278', forest: '#3a6a30' },
      fn: (x, z, h, fb) => { const valley = Math.exp(-Math.pow((z + 260) / 120, 2)); let v = h - valley * 70; if (z < -640) { const k = Math.min(1, (-640 - z) / 900); v += k * k * 420 * (.55 + .45 * Math.abs(fb(x / 320, z / 320, 4))) + k * (1 - Math.abs(fb(x / 160 + 3, z / 160, 3))) * 90; } if (z > 160) v += (z - 160) * .25; return v; },
      flats: [{ x: 0, z: -525, w: 120, d: 70, h: 95, f: 60 }, { x: 0, z: 0, w: 16, d: 16, h: 150.2, f: 70 }, { x: 0, z: -260, w: 2600, d: 50, h: 4, f: 60 }],
      sandH: 5 },
    build(B, G) {
      const P = [], y = 95, R = B.R;
      /* rio no fundo do vale (água num canal) */
      G.waterY = 5.5;
      B.ground('grass', 0, -525, 110, 64, 0, y, '#7aa84a', 3);
      B.villa({ x: 0, z: -540, yaw: 0, y });
      B.pool({ x: 0, z: -518, w: 14, d: 6, yaw: 0, y });
      const chairs = [[-9, -510], [-6.5, -510], [6.5, -510], [9, -510]].map(([x, z], i) => { B.deckchair(x, z, Math.PI, y + .02, ['#f2f2f2', '#2a8ae8', '#f2f2f2', '#e8503a'][i]); return [x, z]; });
      B.umbrella(-7.7, -508, y, '#e8503a'); B.umbrella(7.7, -508, y, '#2a8ae8');
      B.box(B.frame(-14, -515, Math.PI / 2, y), 'wood', 4, 1.1, .8, 0, 0, 0, '#ffffff', { uv: 1, col: 'solid' }); B.box(B.frame(-14, -515, Math.PI / 2, y), 'stone', 4.2, .1, 1, 0, 1.1, 0, '#e8e2d6');
      /* sebes, relva, cipestres, palmeiras */
      B.hedge(-22, -492, 26, 1.2, 1.1, 0, y); B.hedge(22, -492, 26, 1.2, 1.1, 0, y); B.hedge(-36, -520, 1.2, 56, 1.6, 0, y); B.hedge(36, -540, 1.2, 30, 1.6, 0, y);
      const T = [];
      [-34, -28, -22, 22, 28, 34].forEach(x => T.push({ x, z: -495, y, k: 'cypress', s: .55 }));
      [[-20, -505], [20, -505], [-26, -530], [26, -500]].forEach(([x, z]) => T.push({ x, z, y, k: 'palm', s: .7 }));
      /* heliporto */
      const H = B.helicopter(46, -522, -Math.PI / 2, y); G.heli = H;
      /* garagem e carros */
      B.box(B.frame(-46, -540, 0, y), 'plain', 14, 3.4, 9, 0, 0, 0, '#ecece8', { col: 'wall' }); B.box(B.frame(-46, -540, 0, y), 'corr', 12, 2.8, .1, 0, 0, 4.52, '#c8ccd0', { uv: 1 });
      G.carsDef = [{ path: [[-52, -528], [-30, -528]], n: 1, parked: true, type: 'sport', color: '#d82a2a' }, { path: [[-40, -528], [-20, -528]], n: 1, parked: true, type: 'suv', color: '#1a1a1a' }];
      /* portão, guarita e estrada em curvas pela encosta */
      B.box(B.frame(-30, -492, 0, y), 'stone', 2, 2.4, 2, 0, 0, 0, '#d8d2c6', { col: 'wall' }); B.box(B.frame(-30, -492, 0, y), 'tiles', 2.4, .3, 2.4, 0, 2.4, 0, '#b8583a');
      for (let k = 0; k < 8; k++) { const z = -490 + k * 28, x = -40 + Math.sin(k * 1.3) * 30; B.ground('asphalt', x, z, 8, 30, Math.sin(k * 1.3) * .5, B.frame(x, z).y, '#ffffff', 6); }
      /* rochas no ninho (deitado numa saliência) */
      [[-4.5, -2.5, .9], [4.2, -3, .8], [-6.5, 1, 1.2], [6, 1.5, 1.1], [-2.5, -4.2, .45], [2.8, -4.6, .5]].forEach(([x, z, s]) => B.rock(x, z, s, 149.9));
      for (let i = 0; i < 40; i++) B.rock(rand(-400, 400), rand(-700, 200), rand(2, 7));
      /* floresta nas encostas */
      for (let i = 0; i < 900; i++) { const x = rand(-1600, 1600), z = rand(-1100, 700); if (Math.abs(x) < 80 && Math.abs(z + 525) < 60) continue; if (Math.hypot(x, z) < 40) continue; if (Math.abs(z + 260) < 30) continue; T.push({ x, z, k: R() < .7 ? 'pine' : 'leaf', s: .7 + R() * .8 }); }
      G.treeList = T;
      G.collect = { kind: 'gnome', gold: true, name: 'gnomos dourados', list: [[-46, y + 3.45, -538], [-30, y + 2.72, -492], [-12, y + 7.3, -545]] };
      /* gente */
      const baron = { role: 'boss', tag: 'baron', name: 'Barão Bigodes', look: outfit(R, 'tourist', { shirt: '#f2a020', over: null, shorts: true, hat: 'top', hatC: '#1a1a1a', face: 'mustache', hairC: '#2a1a1a', glasses: 'sun', build: 1.12, belly: 1.35, skin: '#f0c8a8', shoes: '#f2f2f2' }), vip: true, aware: true, range: 30,
        beh: { type: 'seq', speed: 1.1, steps: [{ recline: 1, x: -9, z: -510, yaw: Math.PI, d: 45 }, { go: [-12, -514] }, { do: 'cup', d: 14, yaw: -Math.PI / 2 }, { go: [-4, -512.8] }, { do: 'look', d: 8 }, { go: [5, -523] }, { do: 'phone', d: 12 }, { go: [-9, -511] }] } };
      P.push(baron);
      const gp = [[[-30, -498, 4, 'look'], [30, -498, 4, 'arms']], [[-32, -535, 3, 'look'], [-32, -505, 3, 'radio']], [[36, -505, 4, 'bino'], [52, -510, 4, 'look'], [52, -534, 3, 'arms']], [[-26, -492, 6, 'arms'], [-34, -488, 5, 'look']], [[18, -530, 4, 'look'], [-18, -530, 4, 'radio']]];
      gp.forEach(path => P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman'), beh: { type: 'patrol', path }, aware: true, range: 36 }));
      P.push({ role: 'guard', tag: 'guard', name: 'Vigia do terraço', look: outfit(R, 'henchman'), beh: { type: 'stand', x: 6, z: -536, y: y + 7.3, yaw: 0, act: 'bino', turn: 1 }, aware: true, range: 60 });
      P.push({ role: 'civ', tag: 'civ', name: 'Mordomo', look: outfit(R, 'guard', { shirt: '#f4f4f0', over: 'lapel', overC: '#1a1a1a', glasses: null, hairC: '#d8d8d0' }), beh: { type: 'seq', speed: 1, steps: [{ go: [-2, -524] }, { do: 'vendor', d: 6 }, { go: [-13, -514] }, { do: 'talk', d: 8, yaw: Math.PI / 2 }, { go: [-6, -528] }, { do: 'arms', d: 10 }] } });
      P.push({ role: 'civ', tag: 'civ', name: 'Jardineiro', look: outfit(R, 'villager', { hat: 'straw', hatC: '#e0c880', prop: 'broom', over: 'apron', overC: '#3a6a3a' }), beh: { type: 'seq', steps: [{ go: [20, -500] }, { do: 'sweep', d: 14 }, { go: [-20, -500] }, { do: 'sweep', d: 14 }] } });
      P.push({ role: 'civ', tag: 'civ', name: 'Limpa-piscinas', look: outfit(R, 'tourist', { prop: 'broom', shorts: true, hat: 'cap', hatC: '#2a8ae8' }), beh: { type: 'seq', steps: [{ go: [-6, -513] }, { do: 'sweep', d: 12, yaw: Math.PI }, { go: [6, -513] }, { do: 'sweep', d: 12, yaw: Math.PI }] } });
      P.push({ role: 'civ', tag: 'civ', name: 'Convidada', look: outfit(R, 'tourist', { hair: 'long', shirt: '#e85a8a', glasses: 'sun', hat: 'straw', hatC: '#f2e0b0' }), beh: { type: 'recline', x: 6.5, z: -510, yaw: Math.PI } });
      G.escapePath = P => [[P.x, P.z], [30, -516], [44, -520]];
      G.escapeEnd = (G, P) => { P.hidden = true; G.heliGo = 0; hint(G, 'O Barão entrou no helicóptero — vai descolar!', 3, true); };
      G.birds = { n: 4, kind: 'gull', centers: [[0, 180, -400]] };
      return P;
    },
    extra(G) {
      /* o rio no vale: um plano de água próprio à altura do canal */
      const wm = G.r3.water.material.clone(); wm.normalMap = G.r3.water.material.normalMap; wm.color = new THREE.Color('#3a7a8a');
      const g = new THREE.PlaneGeometry(4000, 70); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, wm); m.position.set(0, 5.5, -260); m.renderOrder = 1; G.r3.scene.add(m);
    },
    script(G, dt) {
      const B = G.people.find(p => p.tag === 'baron');
      if (G.heliGo != null) {
        G.heliGo += dt; const h = G.heli; h.rotor.rotation.y += dt * Math.min(30, G.heliGo * 3); h.tail.rotation.x += dt * 40;
        if (G.heliGo > 12) { h.g.position.y += dt * Math.min(8, (G.heliGo - 12) * 2); h.g.rotation.z = Math.sin(G.t) * .03; }
        if (G.heliGo > 18) fail(G, 'O Barão fugiu de helicóptero!');
      }
    },
    objectives: [
      { id: 'baron', text: 'Adormece o Barão Bigodes (cartola e camisa laranja)', check: G => G.people.some(p => p.tag === 'baron' && p.sleep) },
      { id: 'guards', text: 'Adormece os 6 guardas sem alarme', opt: true, check: G => !G.alarm && G.people.filter(p => p.tag === 'guard' && p.sleep).length >= 6, prog: G => G.people.filter(p => p.tag === 'guard' && p.sleep).length + '/6' },
      { id: 'collect', text: 'Acerta em 3 gnomos dourados', opt: true, check: G => G.got >= 3, prog: G => G.got + '/3' },
    ],
  });

  /* ── 5. Comboio da Meia-Noite ── */
  LEVELS.push({
    id: 'estacao', name: 'Comboio da Meia-Noite', icon: '🚂', tod: 'night', grad: ['#2a3a7a', '#0a0e22'],
    brief: 'A Madame Bigodes vai apanhar o comboio da meia-noite com o Bolo-Rei. Adormece-a antes de o comboio partir — no cais ou pela janela. Usa a visão noturna (N).',
    wind: [1, 3], windDir: -2.4, darts: 16,
    nest: { x: 0, y: 35.2, z: -6, yaw: 0, yawR: 1.1, pMin: -.55, pMax: .2, look: [0, 3, -200] },
    fog: [300, 2600],
    terrain: { seed: 59, hills: 14, base: 2, size: 4200, n: 220, pal: { grass: '#4a6a3a', grass2: '#5a7a42' }, flats: [{ x: 0, z: -200, w: 900, d: 160, h: 2, f: 60 }, { x: 0, z: 0, w: 20, d: 20, h: 3, f: 40 }],
      fn: (x, z, h) => h + Math.max(0, Math.hypot(x, z + 200) - 700) * .12 },
    build(B, G) {
      const P = [], y = 2, R = B.R;
      /* silo do ninho */
      const N = B.frame(0, 4, 0, 3); B.geo(N, 'metal', new THREE.CylinderGeometry(5, 5, 28, 20), 0, 14, 0, '#9aa4ac'); B.geo(N, 'metal', new THREE.ConeGeometry(5.2, 3, 20), 0, 29.5, 0, '#8a949c'); B.box(N, 'metal', 4, .15, 4, 0, 30.4, -5, '#5a5f66'); B.box(N, 'metal', 4, 1, .06, 0, 30.5, -7, '#3a3a3a');
      /* linhas, cais, coberturas */
      B.rails(-450, 450, -197, y); B.rails(-450, 450, -205, y);
      B.box(B.frame(0, -190.5, 0, y), 'concrete', 220, 1, 6, 0, 0, 0, '#bdb8ae', { uv: 3, col: 'low' }); B.box(B.frame(0, -187.7, 0, y), 'paint', 220, .02, .35, 0, 1, 0, '#f2c230');
      B.box(B.frame(0, -212, 0, y), 'concrete', 220, 1, 8, 0, 0, 0, '#bdb8ae', { uv: 3, col: 'low' });
      B.canopy(-60, -212, 80, 7, y + 1, 4.2, '#2a3a4a'); B.canopy(60, -212, 80, 7, y + 1, 4.2, '#2a3a4a');
      /* edifício da estação */
      B.house({ x: 0, z: -228, yaw: 0, w: 46, d: 12, floors: 2, y, wall: '#f2e2c0', roof: 'gable', roofC: '#8a3a2a', chimney: false });
      B.sign(0, y + 7.2, -221.9, 0, 'ESTAÇÃO DE VALE BIGODE', '#1f3a5a', '#f6e8b8', 16, 1.4);
      B.house({ x: -60, z: -228, yaw: 0, w: 26, d: 12, floors: 1, y, wall: '#e8d8b8', shop: { c: '#2a64b8', t: 'BILHETES' } }); B.house({ x: 60, z: -228, yaw: 0, w: 26, d: 12, floors: 1, y, wall: '#e8d8b8', shop: { c: '#c83a3a', t: 'CAFETARIA' } });
      for (let i = 0; i < 12; i++) { B.lamp(-100 + i * 18, -188.4, Math.PI, y + 1); B.lamp(-100 + i * 18, -209.5, 0, y + 1); }
      for (let i = 0; i < 8; i++) B.bench(-90 + i * 25, -192.4, 0, y + 1);
      for (let i = 0; i < 6; i++) B.bench(-80 + i * 32, -214.5, Math.PI, y + 1);
      B.kiosk(40, -191.5, 0, y + 1, 'JORNAIS', '#2a6a4a'); B.kiosk(-40, -214, Math.PI, y + 1, 'PIPOCAS', '#c83a3a');
      /* vila à volta e estrada */
      B.ground('asphalt', 0, -170, 900, 12, 0, y, '#ffffff', 6); B.roadMarks(-450, -170, 450, -170, y);
      const WL = B.WALLS;
      for (let i = 0; i < 16; i++) { const x = -300 + i * 40; if (Math.abs(x) < 60) continue; B.house({ x, z: -150, yaw: 0, w: 14, d: 12, floors: 2 + (i % 3), y, wall: WL[i % WL.length], smoke: i % 4 === 0 }); }
      for (let i = 0; i < 14; i++) { const x = -280 + i * 42; B.house({ x, z: -262, yaw: Math.PI, w: 15, d: 12, floors: 2 + (i % 2), y, wall: WL[(i * 3) % WL.length] }); }
      const T = []; for (let i = 0; i < 500; i++) { const x = rand(-1500, 1500), z = rand(-1200, 600); if (Math.abs(z + 200) < 90 && Math.abs(x) < 500) continue; if (Math.hypot(x, z) < 30) continue; T.push({ x, z, k: R() < .6 ? 'pine' : 'leaf', s: .7 + R() * .6 }); }
      G.treeList = T;
      G.collect = { kind: 'lantern', name: 'lanternas', list: [[-75, y + 4.6, -209], [78, y + 4.8, -209], [-160, y + 8, -140]] };
      /* gente: viajantes, guardas com lanternas, revisor */
      for (let i = 0; i < 10; i++) P.push({ role: 'civ', tag: 'civ', name: 'Viajante', look: outfit(R, R() < .5 ? 'tourist' : 'villager', { prop: R() < .4 ? 'case' : R() < .4 ? 'phone' : null, over: R() < .3 ? 'backpack' : null, overC: '#3a5a8a', long: true }), beh: { type: 'stand', x: -95 + i * 19 + rand(-3, 3), z: -190 + rand(-1.5, 1.5), y: y + 1, yaw: Math.PI + rand(-.4, .4), act: B.pick(['phone', 'arms', 'look', 'listen']) } });
      for (let i = 0; i < 6; i++) P.push({ role: 'civ', tag: 'civ', name: 'Viajante', look: outfit(R, 'villager', { long: true }), beh: { type: 'sit', bench: true, x: -90 + i * 25 + (i % 2 ? .6 : -.6), z: -192.4, y: y + 1, yaw: 0, act: B.pick(['phone', 'listen', 'cup']) } });
      P.forEach(p => { if (p.beh.type === 'sit') p.beh.y = y + 1; });
      P.push({ role: 'civ', tag: 'civ', name: 'Revisor', look: outfit(R, 'guard', { shirt: '#2a3a6a', hat: 'cap', hatC: '#2a3a6a', glasses: null, over: null }), beh: { type: 'path', path: [[-60, -189], [70, -189]], loop: 'ping', speed: 1 }, y: y + 1 });
      for (let i = 0; i < 6; i++) { const z = i < 3 ? -189.5 : -212, x0 = -100 + (i % 3) * 70; P.push({ role: 'guard', tag: 'guard', name: 'Guarda', look: outfit(R, 'henchman', { prop: 'light', propC: '#3a3a3a' }), beh: { type: 'patrol', path: [[x0, z, 4, 'light'], [x0 + 45, z, 4, 'light']], speed: 1.1 }, aware: true, range: 30 }); }
      P.forEach(p => { if (p.tag === 'guard' || p.name === 'Revisor') p.beh.y = y + 1; });
      P.push({ role: 'boss', tag: 'madame', name: 'Madame Bigodes', look: outfit(R, 'tourist', { hair: 'bun', hairC: '#c8c8c0', shirt: '#7a2a8a', long: true, face: 'mustache', hat: 'beret', hatC: '#c83a5a', glasses: 'sun', prop: 'case', propC: '#d8a040', build: 1.05 }), beh: { type: 'stand', x: 12, z: -190.5, y: y + 1, yaw: Math.PI, act: 'arms' }, vip: true, aware: true, range: 25 });
      [[9.5, -190, 'light'], [14.5, -190.2, 'radio']].forEach(([x, z, a]) => P.push({ role: 'guard', tag: 'body', name: 'Guarda-costas', look: outfit(R, 'henchman', { build: 1.2, prop: a === 'light' ? 'light' : null }), beh: { type: 'stand', x, z, y: y + 1, yaw: Math.PI, act: a, turn: 1 }, aware: true, range: 34 }));
      G.carsDef = [{ path: [[-440, -168], [440, -168]], loop: 'ping', n: 3, speed: 10 }];
      G.night = true;
      return P;
    },
    extra(G) {
      const K2 = K().Builder(G.r3.scene, G.r3.env, G.hAt, 5);
      const tr = K2.train({ n: 4, c: '#2a4a8a', night: true }); K2.finish();
      G.train = { g: tr.g, seats: tr.seats, len: tr.len, x: 900, v: 0, st: 'wait', t: 0 };
      tr.g.position.set(900, 2, -197);
      /* luzes a sério ao longo do cais (sem sombras) */
      for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ffcf90', 60, 34, 1.4); l.position.set(-90 + i * 36, 7, -199); G.r3.scene.add(l); }
      G.r3.hemi.intensity *= 1.35;
    },
    script(G, dt) {
      const T = G.train; if (!T) return; T.t += dt;
      const M = G.people.find(p => p.tag === 'madame');
      if (T.st === 'wait' && T.t > 18) { T.st = 'arrive'; T.v = 22; hint(G, '🚂 O comboio está a chegar!', 3, true); }
      if (T.st === 'arrive') { const stop = 70; T.v = Math.max(1.2, Math.min(22, (T.x - stop) * .35)); T.x -= T.v * dt; if (T.x <= stop + .05) { T.x = stop; T.st = 'stop'; T.t = 0; G.trainLeft = 75; } }
      if (T.st === 'stop') {
        G.trainLeft -= dt;
        if (M && !M.sleep && !M.boarded && !M.walking && T.t > 3) {
          /* a porta da carruagem mais próxima e um lugar à janela dessa carruagem */
          let ci = 1; for (let i = 1; i < 4; i++) if (Math.abs(T.x - i * 21 + 9 - M.x) < Math.abs(T.x - ci * 21 + 9 - M.x)) ci = i;
          const dx = T.x - ci * 21 + 9, si = (ci - 1) * 8 + 3;
          M.walking = true; M.beh = { type: 'path', speed: 1.25, path: [[M.x, M.z], [M.x, -192.6], [dx, -193.2]], end: (G, P) => { P.boarded = true; P.seatI = si; P.beh = { type: 'ride', obj: T.g, seat: [0, 1.92, .85], yaw: Math.PI / 2, act: 'listen' }; sfx(G, 'obj'); hint(G, 'A Madame entrou no comboio — procura-a pelas janelas!', 3, true); } }; M.wi = 1;
        }
        if (G.trainLeft <= 0) { T.st = 'leave'; T.v = 0; hint(G, '🚂 O comboio partiu!', 2.5, true); }
      }
      if (T.st === 'leave') { T.v = Math.min(26, T.v + dt * 1.6); T.x -= T.v * dt; if (M && !M.sleep && M.boarded && T.x < -60) fail(G, 'A Madame Bigodes fugiu de comboio!'); }
      T.g.position.x = T.x;
      if (M && M.boarded) { const s = T.seats[M.seatI]; M.beh.seat = [s[0] + .05, 1.92, s[2]]; if (!G.trainLight) { G.trainLight = new THREE.PointLight('#ffe0a8', 40, 9, 1.5); G.r3.scene.add(G.trainLight); } G.trainLight.position.set(M.x, 6, M.z); }
      /* lanternas dos guardas: brilho no chão à frente */
      G.people.forEach(p => { if (p.look.prop !== 'light') return; if (!p.lamp) { p.lamp = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18), new THREE.MeshBasicMaterial({ map: Arcade3D.glowTex(), color: '#fff2c0', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); p.lamp.rotation.x = -Math.PI / 2; G.r3.scene.add(p.lamp); p.lampS = new THREE.Sprite(Arcade3D.glowSprite('#fff6d0')); p.lampS.scale.setScalar(1.2); G.r3.scene.add(p.lampS); }
        const on = !p.sleep && !p.hidden; p.lamp.visible = p.lampS.visible = on; if (!on) return;
        const a = p.yaw + (p.headYaw || 0) * .5; p.lamp.position.set(p.x + Math.sin(a) * 4.5, p.y + .06, p.z + Math.cos(a) * 4.5); if (p.j) p.lampS.position.copy(p.j.haR); });
    },
    objectives: [
      { id: 'madame', text: 'Adormece a Madame Bigodes antes de o comboio partir', check: G => G.people.some(p => p.tag === 'madame' && p.sleep), prog: G => G.trainLeft > 0 && G.train.st === 'stop' ? '⏱ ' + Math.ceil(G.trainLeft) + ' s' : '' },
      { id: 'guards', text: 'Adormece os 8 guardas', opt: true, check: G => G.people.filter(p => (p.tag === 'guard' || p.tag === 'body') && p.sleep).length >= 8, prog: G => G.people.filter(p => (p.tag === 'guard' || p.tag === 'body') && p.sleep).length + '/8' },
      { id: 'collect', text: 'Apaga 3 lanternas de papel', opt: true, check: G => G.got >= 3, prog: G => G.got + '/3' },
    ],
  });

  /* revelar uma personagem escondida (sai de um edifício) */
  function reveal(G, tag, msg) { G.people.forEach(p => { if (p.tag === tag && p.hidden) { p.hidden = false; p.mode = null; p.marked = true; setPip(G, p, msg || p.name, 5, 2); } }); if (msg) hint(G, msg + ' Segue a seta amarela.', 4, true); }

  /* ════════════════════════════════════════════════════════════════
     arranque
  ════════════════════════════════════════════════════════════════ */
  let LAST = 0;
  function setup(api, o) {
    const li = clamp(+(o.mode || LAST) || 0, 0, LEVELS.length - 1); LAST = li;
    const L = LEVELS[li];
    const G = {
      api, li, L, diff: o.diff || 'medium', t: 0, ok: false, dead: false,
      yaw: L.nest.yaw, pitch: -.12, fov: FOV, scope: 0, zi: 0, bino: false, breath: 1, holding: false, gasp: 0, sway: { x: 0, y: 0 }, recoil: 0, bolt: 0,
      ammo: L.darts, mag: Math.min(5, L.darts), reload: 0, zero: 100, range: 0, darts: [], stuck: [], hats: [], fx: [],
      people: [], cars: [], targets: [], got: 0, alarm: false, alarmT: 0, sus: 0, score: 0, stats: { shots: 0, hits: 0, sleeps: 0, civ: 0, longest: 0, hats: 0 },
      obj: [], done: false, failed: false, hints: [], keys: {}, timeScale: 1, cam: null, lock: false, touch: false, nv: false,
      wind: { x: 0, z: 0, s: 0, dir: 0 }, emotes: [],
    };
    const ws = G.diff === 'easy' ? 0 : rand(L.wind[0], L.wind[1]) * (G.diff === 'hard' ? 1.35 : 1);
    G.wind.base = ws; G.wind.dir = L.windDir + rand(-.3, .3);
    if (typeof SkyAceWorld === 'undefined' || !(SkyAceWorld.V >= 3) || typeof SniperKit === 'undefined' || typeof SniperPeople === 'undefined') { G.fail3d = true; G.failMsg = 'O browser usou uma versão antiga do jogo — recarrega a página (Ctrl+Shift+R).'; return G; }
    Arcade3D.load().then(() => { try { build(G, api); } catch (e) { console.warn('[soneca] 3D falhou', e); G.fail3d = true; G.failMsg = 'Erro: ' + (e && e.message || e); } }).catch(() => { G.fail3d = true; G.failMsg = 'Não foi possível carregar o motor 3D.'; });
    return G;
  }

  function build(G, api) {
    const L = G.L, Wd = W(), coarse = Arcade3D.coarse();
    if (!_v3) { _v3 = new THREE.Vector3(); _v4 = new THREE.Vector3(); }
    const renderer = Arcade3D.attach(api.stage);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(FOV, 1, .3, 9000);
    const sky = Object.assign({}, Wd.SKIES[L.tod]); sky.fogNear = L.fog[0]; sky.fogFar = L.fog[1]; sky.aurora = 0;
    const hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGnd, sky.hemi), sun = new THREE.DirectionalLight(sky.sun, sky.sunI);
    sun.castShadow = true; const sm = coarse ? 1536 : 3072; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -.0003; sun.shadow.normalBias = .04;
    scene.add(hemi, sun, sun.target);
    const skyM = Wd.skyMesh(sky); scene.add(skyM);
    const env = Wd.skyEnv(renderer, sky); scene.environment = env;
    scene.fog = new THREE.Fog(sky.hor, sky.fogNear, sky.fogFar);
    renderer.toneMappingExposure = sky.exp;
    const uTime = { value: 0 }, uWind = { value: new THREE.Vector2() };
    G.r3 = { renderer, scene, cam, hemi, sun, skyM, env, sky, coarse, sunDir: new THREE.Vector3(...sky.sunDir).normalize(), uTime, uWind, night: !!sky.stars };
    /* terreno, água */
    const T = K().Terrain(L.terrain); G.T = T; G.hAt = T.hAt;
    scene.add(T.mesh(env));
    /* água: plano próprio de 16 km em grelha e UV pequenos (no plano de 300 km os UV enormes perdiam precisão e a ondulação tremia) */
    const water = Wd.buildWater({ water: L.water || '#2a6a80' }, env); water.geometry.dispose(); water.geometry = new THREE.PlaneGeometry(16000, 16000, 24, 24); water.position.set(L.nest.x, 0, L.nest.z - 800);
    water.material.normalMap.repeat.set(16000 / 14, 16000 / 14); water.material.normalScale.set(.22, .22); scene.add(water); G.r3.water = water;
    /* mundo */
    const B = K().Builder(scene, env, T.hAt, 7 + G.li * 13);
    const specs = L.build(B, G);
    const lk0 = L.nest.look || [0, 0, -200];
    if (G.treeList) B.trees(G.treeList, uWind, uTime, [[L.nest.x, L.nest.z, 420], [lk0[0], lk0[2], 380]]);
    /* quem está sentado tem cadeira por baixo (os bancos de jardim já existem) */
    specs.forEach(s => { const b = s.beh; if (b && b.type === 'sit' && !b.bench) B.chair(b.x, b.z, b.yaw || 0, b.y != null ? b.y : T.hAt(b.x, b.z)); });
    const fin = B.finish(); G.cols = fin.cols; G.anim = fin.anim; G.MT = fin.MT;
    if (G.r3.night) { ['facade', 'office'].forEach(k => { G.MT[k].emissiveIntensity = 1.2; }); }
    colGrid(G);
    /* partículas, nuvens */
    const pk = { fogNear: sky.fogNear, fogFar: sky.fogFar, fog: sky.hor };
    G.r3.smoke = Wd.particles(scene, coarse ? 1500 : 3000, false, pk); G.r3.spark = Wd.particles(scene, coarse ? 800 : 1600, true, pk);
    G.r3.clouds = Wd.buildClouds(sky, 3 + G.li, .8, { area: 7000, alt: [700, 1300], R: [120, 300], n: sky.stars ? 10 : 26 }); scene.add(G.r3.clouds.mesh);
    /* gente */
    const nDrivers = (G.carsDef || []).reduce((a, d) => a + (d.parked ? 0 : d.n), 0) + (G.movers || []).length;
    G.crowd = PP().Crowd(scene, specs.length + 4 + nDrivers, env);
    const R = K().rng(99 + G.li);
    specs.forEach((s, i) => spawnPerson(G, s, R, i));
    /* carros (com condutor ao volante), empilhadores, aves, alvos extra */
    if (G.carsDef) G.carsDef.forEach(d => carsAlong(G, d));
    G.cars.forEach(C => { if (C.parked) return; spawnPerson(G, { role: 'civ', tag: 'driver', name: 'Condutor', look: outfit(R, R() < .5 ? 'tourist' : 'villager', { hat: null, prop: null, over: null, long: true }), beh: { type: 'ride', obj: C.g, seat: C.seat, rot: Math.PI / 2, act: 'drive' }, s: .95 }, R, G.people.length); });
    (G.movers || []).forEach(M => spawnPerson(G, { role: 'civ', tag: 'driver', name: 'Operador', look: outfit(R, 'worker'), beh: { type: 'ride', obj: M.fk.g, seat: M.fk.seat, rot: 0, act: 'drive' }, s: .95 }, R, G.people.length));
    if (G.birds) birdsSetup(G, G.birds);
    collectSetup(G);
    bellSetup(G);
    if (L.extra) L.extra(G, B);
    /* espingarda na primeira pessoa (cena à parte, por cima) */
    rifleSetup(G);
    /* objetivos */
    G.obj = L.objectives.map(o => Object.assign({ done: false, shown: !o.after }, o));
    G.timer = L.timer || 0;
    sprites(G);
    const lk = G.L.nest.look; if (lk) { const n = G.L.nest, dx = lk[0] - n.x, dy = lk[1] - n.y, dz = lk[2] - n.z; G.yaw = Math.atan2(-dx, -dz); G.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
    G.nestX = G.L.nest.x; G.nestZ = G.L.nest.z;
    G.ok = true;
  }

  /* ── grelha de colisões (caixas orientadas) ── */
  function colGrid(G) {
    const g = new Map(), cs = 24;
    G.cols.forEach((c, i) => { const r = Math.hypot(c.hx, c.hz) + 1; for (let x = Math.floor((c.x - r) / cs); x <= Math.floor((c.x + r) / cs); x++) for (let z = Math.floor((c.z - r) / cs); z <= Math.floor((c.z + r) / cs); z++) { const k = x * 4096 + z; (g.get(k) || g.set(k, []).get(k)).push(c); } });
    G.cg = g; G.cgs = cs;
  }
  /* segmento × caixa orientada (método das lajes no referencial da caixa) → t ∈ [0,1] ou −1 */
  function segBox(ax, ay, az, bx, by, bz, c) {
    const dx0 = ax - c.x, dz0 = az - c.z, dx1 = bx - c.x, dz1 = bz - c.z;
    const lax = dx0 * c.c - dz0 * c.s, laz = dx0 * c.s + dz0 * c.c, lbx = dx1 * c.c - dz1 * c.s, lbz = dx1 * c.s + dz1 * c.c;
    const la = [lax, ay - c.y, laz], d = [lbx - lax, by - ay, lbz - laz], h = [c.hx, c.hy, c.hz];
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (la[k] < -h[k] || la[k] > h[k]) return -1; continue; }
      let ta = (-h[k] - la[k]) / d[k], tb = (h[k] - la[k]) / d[k]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
    }
    return t0;
  }
  function segWorld(G, ax, ay, az, bx, by, bz, skip) {
    const cs = G.cgs, seen = new Set(); let best = -1, bc = null;
    const x0 = Math.floor(Math.min(ax, bx) / cs), x1 = Math.floor(Math.max(ax, bx) / cs), z0 = Math.floor(Math.min(az, bz) / cs), z1 = Math.floor(Math.max(az, bz) / cs);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { /* segmento longo: parte-o */ const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (cs * 8)); for (let i = 0; i < n; i++) { const r = segWorld(G, lerp(ax, bx, i / n), lerp(ay, by, i / n), lerp(az, bz, i / n), lerp(ax, bx, (i + 1) / n), lerp(ay, by, (i + 1) / n), lerp(az, bz, (i + 1) / n), skip); if (r) { r.t = (i + r.t) / n; return r; } } return null; }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const a = G.cg.get(x * 4096 + z); if (!a) continue; for (const c of a) { if (seen.has(c) || c.gone || (skip && skip(c))) continue; seen.add(c); const t = segBox(ax, ay, az, bx, by, bz, c); if (t >= 0 && (best < 0 || t < best)) { best = t; bc = c; } } }
    if (G.dyn) for (const c of G.dyn) { const t = segBox(ax, ay, az, bx, by, bz, c); if (t >= 0 && (best < 0 || t < best)) { best = t; bc = c; } }
    return bc ? { t: best, c: bc } : null;
  }
  /* linha de vista (olhos → alvo), ignora árvores baixas e coisas pequenas */
  function los(G, a, b) { const r = segWorld(G, a.x, a.y, a.z, b.x, b.y, b.z, c => c.k === 'pole' || c.k === 'barrel' || c.k === 'crate' || c.k === 'low'); return !r; }

  /* ════════════════════════════════════════════════════════════════
     pessoas
  ════════════════════════════════════════════════════════════════ */
  function spawnPerson(G, s, R, i) {
    const b = s.beh || {}, P = Object.assign({ id: i, s: s.s || (s.look && s.look.build > 1.1 ? 1.04 : .94 + R() * .12), seed: R() * 100, t: R() * 50, yaw: b.yaw || 0, ph: R() * TAU, spd: 0, sleep: false, sleepT: 0, sus: 0, q: {} }, s);
    const st0 = b.steps && b.steps.find(q => q.go || q.x != null);
    if (b.x != null) { P.x = b.x; P.z = b.z; } else if (st0) { P.x = st0.go ? st0.go[0] : st0.x; P.z = st0.go ? st0.go[1] : st0.z; } else if (b.path) { P.x = b.path[0][0]; P.z = b.path[0][1]; P.wi = 1; } else if (b.area) { P.x = rand(b.area[0], b.area[2]); P.z = rand(b.area[1], b.area[3]); } else { P.x = 0; P.z = 0; }
    P.fy = b.y; P.y = b.y != null ? b.y : G.hAt(P.x, P.z);
    P.home = { x: P.x, z: P.z, yaw: P.yaw };
    G.crowd.add(P); G.people.push(P);
    return P;
  }
  const isAwake = P => !P.sleep && !P.hidden;
  /* ponto de chegada: anda, vira-se suavemente, evita outros */
  function moveTo(G, P, tx, tz, spd, dt) {
    const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz);
    if (d < .35) { P.spd = lerp(P.spd, 0, dt * 6); return true; }
    const want = Math.atan2(dx, dz); P.yaw += Ut.angDiff(want, P.yaw) * Math.min(1, dt * 5);
    P.spd = lerp(P.spd, spd, dt * 3);
    const f = Math.max(0, Math.cos(Ut.angDiff(want, P.yaw)));
    P.x += Math.sin(P.yaw) * P.spd * f * dt; P.z += Math.cos(P.yaw) * P.spd * f * dt;
    return false;
  }
  function think(G, P, dt) {
    const b = P.beh || {};
    P.t += dt;
    if (P.hidden) return;
    if (P.sleep) { P.sleepT += dt; P.spd = 0; if (P.sleepT > 2.4 && Math.random() < dt * .6) emote(G, P, 'z'); if (P.sleepT > 2.4 && Math.random() < dt * .08) snore(G, P); if (b.type === 'ride') { const a = P.act; ride(P, b); P.act = a; } return; }
    /* estados de reação (por cima do comportamento normal) */
    if (P.react) {
      const r = P.react; r.t += dt;
      if (r.k === 'look') { P.mode = 'idle'; P.act = 'look'; lookAt(P, r.x, r.z, dt); if (r.t > r.d) P.react = null; return; }
      if (r.k === 'hat') { P.mode = 'idle'; P.act = r.t < 1.5 ? 'hips' : 'look'; if (r.t > 4) P.react = null; return; }
      if (r.k === 'go') {   /* guarda vai ver o colega que adormeceu */
        const T = r.who; const dx = T.x - P.x, dz = T.z - P.z, d = Math.hypot(dx, dz);
        if (d > 1.6) { P.mode = 'walk'; moveTo(G, P, T.x - dx / d * 1.1, T.z - dz / d * 1.1, r.run ? 3.6 : 2.2, dt); if (r.t > 40) P.react = null; return; }
        r.k = 'shake'; r.t = 0; emote(G, P, '!');
      }
      if (r.k === 'shake') { P.mode = 'shake'; P.yaw += Ut.angDiff(Math.atan2(r.who.x - P.x, r.who.z - P.z), P.yaw) * dt * 4; if (r.t > 2.6) { r.k = 'radio'; r.t = 0; emote(G, P, 'radio'); sfx(G, 'radio'); setPip(G, P, `${P.name} está a chamar pelo rádio!`, 3.2, 2); } return; }
      if (r.k === 'radio') { P.mode = 'idle'; P.act = 'radio'; if (r.t > 3.2) { P.react = null; G.alarmBy = P; G.alarmByT = 7; raiseAlarm(G, P.name + ' deu o alarme!'); setPip(G, P, `🚨 ${P.name} deu o alarme!`, 3.5, 3); } return; }
      if (r.k === 'spot') { P.mode = 'idle'; P.act = 'point'; lookAt(P, r.x, r.z, dt); if (r.t > 1.4) { r.k = 'go'; r.t = 0; r.run = true; } return; }
      if (r.k === 'check') { const d = Math.hypot(r.x - P.x, r.z - P.z); if (d > 2) { P.mode = 'walk'; moveTo(G, P, r.x, r.z, 2.4, dt); return; } P.mode = 'idle'; P.act = 'look'; if (r.t > 12) P.react = null; return; }
    }
    if (G.alarm && P.role === 'guard' && !b.alarmPath) { P.mode = 'crouch'; lookAt(P, G.nestX, G.nestZ, dt * .5); return; }
    if (G.alarm && (P.vip) && G.escapePath && !P.fleeing) { P.fleeing = true; P.beh = { type: 'path', path: G.escapePath(P), speed: 4.2, end: G.escapeEnd || 'escape' }; P.wi = 0; emote(G, P, '!'); }
    switch (b.type) {
      case 'patrol': {
        const w = b.path[P.wi % b.path.length];
        if (P.wait > 0) { P.wait -= dt; P.mode = 'idle'; P.act = w[3] || 'look'; if (b.turn) P.yaw += dt * .3; return; }
        if (moveTo(G, P, w[0], w[1], b.speed || 1.25, dt)) { P.wait = w[2] || 3; P.wi++; }
        P.mode = 'walk'; break;
      }
      case 'path': {
        const pth = b.path; if (P.wi == null) P.wi = 1;
        if (P.wi >= pth.length) {
          if (b.loop === 'ping') { pth.reverse(); P.wi = 1; }
          else if (b.end === 'escape') { escaped(G, P); return; }
          else if (typeof b.end === 'function') { const fn = b.end; b.end = null; fn(G, P); return; }
          else { P.mode = 'idle'; return; }
        }
        const w = pth[P.wi]; P.mode = 'walk';
        if (moveTo(G, P, w[0], w[1], b.speed || 1.3, dt)) P.wi++;
        if (b.act) P.walkAct = b.act;
        break;
      }
      case 'wander': {
        if (P.wait > 0) { P.wait -= dt; P.mode = 'idle'; if (P.lookP) lookAt(P, P.lookP.x, P.lookP.z, dt); return; }
        if (!P.tgt) { const a = b.area; for (let k = 0; k < 8; k++) { const x = rand(a[0], a[2]), z = rand(a[1], a[3]); if (!G.people.some(o => o !== P && o.mode !== 'walk' && Math.hypot(o.x - x, o.z - z) < 1.2)) { P.tgt = [x, z]; break; } } if (!P.tgt) P.tgt = [P.x, P.z]; }
        P.mode = 'walk';
        if (moveTo(G, P, P.tgt[0], P.tgt[1], b.speed || 1.2, dt)) {
          P.tgt = null; P.wait = rand(3, 11); P.act = b.acts[Math.floor(Math.random() * b.acts.length)];
          /* o gatuno para atrás de alguém a "pescar" carteiras */
          if (b.pick) { const v = G.people.find(o => o !== P && o.role === 'civ' && isAwake(o) && Math.hypot(o.x - P.x, o.z - P.z) < 6); if (v) { P.act = 'look'; P.lookP = v; P.tgt = [v.x - Math.sin(v.yaw) * .9, v.z - Math.cos(v.yaw) * .9]; P.wait = 0; } else P.lookP = null; }
          else { const o = G.people.find(o => o !== P && isAwake(o) && Math.hypot(o.x - P.x, o.z - P.z) < 3); P.lookP = o || null; if (o && P.act === 'look') P.act = 'talk'; }
        }
        break;
      }
      case 'stand': P.mode = 'idle'; P.act = b.act; if (b.turn) { P.yaw = b.yaw + Math.sin(P.t * .12 + P.seed) * 1.1; } else P.yaw = lerp(P.yaw, b.yaw, dt * 2); P.x = lerp(P.x, b.x, dt * 2); P.z = lerp(P.z, b.z, dt * 2); break;
      case 'dance': P.mode = 'idle'; P.act = b.act; P.yaw = b.yaw + Math.sin(P.t * .5 + P.seed) * .4; P.x = b.x + Math.sin(P.t * .3 + P.seed) * .4; P.z = b.z + Math.cos(P.t * .25 + P.seed) * .3; break;
      case 'sit': P.mode = 'sit'; P.act = b.act; P.x = b.x; P.z = b.z; P.yaw = b.yaw; P.sitting = true; break;
      case 'recline': P.mode = 'recline'; P.x = b.x; P.z = b.z; P.yaw = b.yaw; break;
      case 'seat': P.mode = 'sit'; P.act = b.act || 'listen'; P.sitting = true; break;
      case 'seq': {   /* passos: {go:[x,z]} anda até lá; {do:'cup', d} fica; {recline/sit, x, z, yaw, d} */
        const st = b.steps[(P.si || 0) % b.steps.length];
        if (st.go) { P.mode = 'walk'; P.sitting = false; if (moveTo(G, P, st.go[0], st.go[1], st.speed || b.speed || 1.2, dt)) { P.si = (P.si || 0) + 1; P.st0 = P.t; } break; }
        if (P.st0 == null) P.st0 = P.t;
        if (st.recline) { P.mode = 'recline'; P.x = st.x; P.z = st.z; P.yaw = st.yaw; }
        else if (st.sit) { P.mode = 'sit'; P.sitting = true; P.act = st.act; P.x = st.x; P.z = st.z; P.yaw = st.yaw; }
        else { P.mode = 'idle'; P.act = st.do; if (st.yaw != null) P.yaw += Ut.angDiff(st.yaw, P.yaw) * dt * 3; }
        if (P.t - P.st0 > (st.d || 10)) { P.si = (P.si || 0) + 1; P.st0 = null; P.sitting = false; }
        break;
      }
      case 'ride': ride(P, b); break;
    }
  }
  /* sentado num veículo (comboio, carro, empilhador, barco); rot = o veículo pode rodar */
  function ride(P, b) {
    const o = b.obj, sp = b.seat; P.mode = 'sit'; P.act = b.act || 'listen'; P.sitting = true;
    if (b.rot != null) { const a = o.rotation.y, c = Math.cos(a), sn = Math.sin(a), k = o.scale.x; P.x = o.position.x + (sp[0] * c + sp[2] * sn) * k; P.z = o.position.z + (-sp[0] * sn + sp[2] * c) * k; P.fy = o.position.y + sp[1] * k - .48 * (P.s || 1); P.yaw = a + b.rot; }
    else { P.x = o.position.x + sp[0]; P.fy = o.position.y + sp[1]; P.z = o.position.z + sp[2]; P.yaw = b.yaw || 0; }
  }
  function lookAt(P, x, z, dt) { P.yaw += Ut.angDiff(Math.atan2(x - P.x, z - P.z), P.yaw) * Math.min(1, dt * 3); }

  /* ── consciência dos guardas: colegas a dormir à vista ── */
  function awareness(G) {
    const sleepers = G.people.filter(p => p.sleep && p.sleepT > 1.2 && !p.found && !p.hidden);
    if (!sleepers.length && !G.people.some(p => p.sus > 0)) return;
    const range = G.diff === 'hard' ? 1.25 : G.diff === 'easy' ? .75 : 1;
    G.people.forEach(P => {
      if (!P.aware || !isAwake(P) || (P.react && P.react.k !== 'look') || G.distract > 0) return;
      const eye = { x: P.x, y: P.y + 1.6 * P.s, z: P.z }, R = (P.range || 34) * range;
      for (const S of sleepers) {
        const d = Math.hypot(S.x - P.x, S.z - P.z); if (d > R) continue;
        const ang = Math.abs(Ut.angDiff(Math.atan2(S.x - P.x, S.z - P.z), P.yaw + (P.headYaw || 0)));
        if (ang > 1.15 && d > 4) continue;
        if (!los(G, eye, { x: S.x, y: S.y + .35, z: S.z })) continue;
        S.found = true; P.react = { k: 'spot', t: 0, who: S, x: S.x, z: S.z }; emote(G, P, '!'); sfx(G, 'spot'); P.marked = true; setPip(G, P, `${P.name} viu ${S.vip ? S.name : 'um colega'} a dormir!`, 4, 1);
        if (!G.alarm) hint(G, `${P.name} viu ${S.vip ? S.name : 'alguém'} a dormir! Adormece-o antes que dê o alarme.`, 3.5, true);
        break;
      }
    });
  }
  function raiseAlarm(G, msg) {
    if (G.alarm || G.done || G.failed) return;
    G.alarm = true; G.alarmT = 0; G.sus = 1; sfx(G, 'alarm'); hint(G, '🚨 ' + msg, 4, true); G.api.flash('#ff3030', .25);
    G.people.forEach(p => { if (p.role === 'guard' && isAwake(p)) emote(G, p, '!'); });
    if (G.L.onAlarm) G.L.onAlarm(G);
  }
  function escaped(G, P) { if (G.done || G.failed) return; P.hidden = true; fail(G, `${P.name} fugiu!`); }
  /* o chefe salta para a lancha e arranca para o largo (ainda dá para o adormecer a bordo) */
  function boatEscape(G, P) {
    const b = G.escapeBoat; if (!b) { escaped(G, P); return; }
    P.beh = { type: 'ride', obj: b, seat: b.userData.seat, rot: Math.PI, act: 'drive' }; P.fleeing = true; P.marked = true;
    const c = G.cols.find(q => q.dyn === b); if (c) c.gone = true;
    G.boatRun = { t: 0, P, v: 0, b }; hint(G, `${P.name} saltou para a lancha — adormece-o antes que se afaste!`, 3.5, true); setPip(G, P, `${P.name} vai fugir de lancha!`, 4, 3);
  }
  function boatUpdate(G, dt) {
    const R = G.boatRun; if (!R) return; const b = R.b, P = R.P; R.t += dt;
    const go = !P.sleep && R.t > 1.2; R.v = go ? Math.min(11, R.v + dt * 2.6) : Math.max(0, R.v - dt * 2.5);
    if (go) b.rotation.y += Ut.angDiff(0, b.rotation.y) * Math.min(1, dt * .6);
    const a = b.rotation.y; b.position.x += -Math.sin(a) * R.v * dt; b.position.z += -Math.cos(a) * R.v * dt;
    if (R.v > 2 && Math.random() < dt * 30) G.r3.smoke.spawn({ x: b.position.x + Math.sin(a) * 4, y: .3, z: b.position.z + Math.cos(a) * 4, vx: rand(-1, 1), vy: rand(.5, 1.5), vz: rand(-1, 1), life: rand(1, 2), s0: .5, s1: 2.4, c0: '#f2f8ff', a: .55, drag: 1 });
    G.dyn && G.dyn.push({ x: b.position.x, y: .3, z: b.position.z, hx: 1.35, hy: .85, hz: 4, c: Math.cos(a), s: Math.sin(a), k: 'boat' });
    if (!P.sleep && R.t > 17) fail(G, `${P.name} fugiu de lancha!`);
  }

  /* ════════════════════════════════════════════════════════════════
     dardos: balística (queda, vento), colisões, câmara do dardo
  ════════════════════════════════════════════════════════════════ */
  function windAt(G, t) { const w = G.wind, g = 1 + Math.sin(t * .37) * .25 + Math.sin(t * 1.3 + 1) * .1; return { x: Math.sin(w.dir) * w.base * g, z: Math.cos(w.dir) * w.base * g, s: w.base * g }; }
  /* direção da mira (com oscilação) e ângulo de zeragem */
  function aimDir(G, out, withSway) {
    const yw = G.yaw + (withSway ? G.sway.x : 0), pt = G.pitch + (withSway ? G.sway.y : 0);
    out.x = -Math.sin(yw) * Math.cos(pt); out.y = Math.sin(pt); out.z = -Math.cos(yw) * Math.cos(pt); return out;
  }
  const zeroAng = Z => Math.atan(GRAV * Z / (2 * DART_V * DART_V));
  function launchVel(G, dir, Z) {
    /* sobe o cano o ângulo de zeragem (à volta do eixo horizontal à direita) */
    const a = zeroAng(Z), hz = Math.hypot(dir.x, dir.z) || 1, ux = dir.x / hz, uz = dir.z / hz, p = Math.asin(clamp(dir.y, -1, 1)) + a;
    return { x: ux * Math.cos(p) * DART_V, y: Math.sin(p) * DART_V, z: uz * Math.cos(p) * DART_V };
  }
  function fire(G) {
    if (!G.ok || G.done || G.failed || G.dcam) return;
    if (G.reload > 0 || G.bolt > 0) return;
    if (G.mag <= 0) { sfx(G, 'empty'); if (G.ammo > 0) startReload(G); else hint(G, 'Sem dardos!', 2); return; }
    G.mag--; G.ammo--; G.stats.shots++;
    const d = aimDir(G, { x: 0, y: 0, z: 0 }, true);
    if (!G.scope) { const sp = .03; d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.z += rand(-sp, sp); }
    const Z = G.diff === 'easy' ? Math.max(30, G.range || 100) : G.zero;
    const v = launchVel(G, d, Z), c = G.r3.cam.position;
    const dart = { p: { x: c.x + d.x * .6, y: c.y + d.y * .6 - .05, z: c.z + d.z * .6 }, v, t: 0, trail: [], alive: true, from: { x: c.x, y: c.y, z: c.z } };
    G.darts.push(dart);
    G.recoil = 1; G.bolt = .95; sfx(G, 'shot'); setTimeout(() => sfx(G, 'bolt'), 420);
    G.api.shake(3, .15);
    /* câmara do dardo: prevê se vai acertar em alguém importante (ou longe) */
    const pr = predict(G, dart);
    if (pr && pr.P && G.camMode !== 'off' && (pr.P.vip || pr.d > 140 || lastOf(G, pr.P) || G.camMode === 'all') && !pr.P.sleep) {
      G.dcam = { dart, t: 0, hitT: pr.t, P: pr.P, ang: rand(-1, 1), side: Math.random() < .5 ? -1 : 1, d: pr.d };
    }
    if (G.mag <= 0 && G.ammo > 0) setTimeout(() => startReload(G), 700);
    G.firstShot = true;
  }
  function lastOf(G, P) { const o = G.obj.find(o => o.shown && !o.done && !o.opt); return o && o.id && P.tag && (o.id === P.tag || o.id === P.tag + 's'); }
  function startReload(G) { if (G.reload > 0 || G.ammo <= 0 || G.mag >= Math.min(5, G.ammo)) return; G.reload = 1.8; sfx(G, 'reload'); }
  /* simulação de um passo do dardo */
  function dartStep(G, D, dt) {
    const w = windAt(G, G.t);
    D.v.y -= GRAV * dt; D.v.x += w.x * WIND_K * dt; D.v.z += w.z * WIND_K * dt;
    const a = D.p, bx = a.x + D.v.x * dt, by = a.y + D.v.y * dt, bz = a.z + D.v.z * dt;
    return [a.x, a.y, a.z, bx, by, bz];
  }
  /* capsula (segmento p–q, raio r) × segmento a–b → t ou −1 */
  function segSegDist(ax, ay, az, bx, by, bz, px, py, pz, qx, qy, qz) {
    const d1x = bx - ax, d1y = by - ay, d1z = bz - az, d2x = qx - px, d2y = qy - py, d2z = qz - pz, rx = ax - px, ry = ay - py, rz = az - pz;
    const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
    let s, t; const c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
    s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = e > 1e-9 ? (b * s + f) / e : 0;
    if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    const dx = ax + d1x * s - (px + d2x * t), dy = ay + d1y * s - (py + d2y * t), dz = az + d1z * s - (pz + d2z * t);
    return [Math.sqrt(dx * dx + dy * dy + dz * dz), s];
  }
  const BODY = [['head', 'head', null, .135, 'head'], ['chest', 'hip', 'neck', .2, 'spine'], ['thighL', 'hpL', 'knL', .085, 'hpL'], ['thighR', 'hpR', 'knR', .085, 'hpR'], ['shinL', 'knL', 'anL', .07, 'knL'], ['shinR', 'knR', 'anR', .07, 'knR'], ['uarmL', 'shL', 'elL', .065, 'shL'], ['uarmR', 'shR', 'elR', .065, 'shR'], ['farmL', 'elL', 'haL', .055, 'elL'], ['farmR', 'elR', 'haR', .055, 'elR']];
  function hitPeople(G, a, shift) {
    let best = null;
    for (const P of G.people) {
      if (P.hidden || !P.j) continue;
      const ox = shift ? (P.vx || 0) * shift : 0, oz = shift ? (P.vz || 0) * shift : 0;
      const dr = Ut.segDist(P.x + ox, P.z + oz, a[0], a[2], a[3], a[5]); if (dr > 2.4) continue;
      const J = P.j;
      /* chapéu (por cima da cabeça) */
      if (P.look.hat && !P.hatOff && J.hat) { const [d, s] = segSegDist(a[0], a[1], a[2], a[3], a[4], a[5], J.hat.x + ox, J.hat.y, J.hat.z + oz, J.hat.x + ox, J.hat.y + .01, J.hat.z + oz); if (d < .14 && (!best || s < best.s)) best = { P, part: 'hat', s, joint: 'head' }; }
      for (const [nm, j1, j2, r, jt] of BODY) {
        const p = J[j1], q = j2 ? J[j2] : J[j1]; if (!p || !q) continue;
        const [d, s] = segSegDist(a[0], a[1], a[2], a[3], a[4], a[5], p.x + ox, p.y, p.z + oz, q.x + ox, q.y + (j2 ? 0 : .01), q.z + oz);
        if (d < r * P.s && (!best || s < best.s - .0001)) best = { P, part: nm, s, joint: jt };
      }
    }
    return best;
  }
  /* previsão para a câmara (pessoas extrapoladas pela velocidade) */
  function predict(G, D0) {
    const D = { p: Object.assign({}, D0.p), v: Object.assign({}, D0.v) }, dt = 1 / 240;
    for (let t = 0; t < 4; t += dt) {
      const a = dartStep(G, D, dt);
      const h = hitPeople(G, a, t);
      const w = segWorld(G, a[0], a[1], a[2], a[3], a[4], a[5]);
      if (h && (!w || h.s <= w.t)) return { P: h.P, t, d: Math.hypot(a[0] - D0.p.x, a[2] - D0.p.z) };
      if (w || a[4] < G.hAt(a[3], a[5]) || a[4] < -1) return null;
      D.p.x = a[3]; D.p.y = a[4]; D.p.z = a[5];
    }
    return null;
  }
  /* trajetória para o ponto de impacto (ajuda no modo fácil) */
  function impactPoint(G) {
    const d = aimDir(G, { x: 0, y: 0, z: 0 }, true), Z = G.diff === 'easy' ? Math.max(30, G.range || 100) : G.zero, v = launchVel(G, d, Z), c = G.r3.cam.position;
    const D = { p: { x: c.x, y: c.y, z: c.z }, v }, dt = 1 / 60;
    for (let t = 0; t < 4; t += dt) { const a = dartStep(G, D, dt); const w = segWorld(G, a[0], a[1], a[2], a[3], a[4], a[5]); if (w) return { x: lerp(a[0], a[3], w.t), y: lerp(a[1], a[4], w.t), z: lerp(a[2], a[5], w.t) }; if (a[4] < G.hAt(a[3], a[5])) return { x: a[3], y: G.hAt(a[3], a[5]), z: a[5] }; D.p.x = a[3]; D.p.y = a[4]; D.p.z = a[5]; }
    return null;
  }
  function dartsUpdate(G, dt) {
    for (const D of G.darts) {
      if (!D.alive) continue;
      const n = Math.max(1, Math.ceil(dt * 240));
      for (let i = 0; i < n && D.alive; i++) {
        const sdt = dt / n; D.t += sdt;
        const a = dartStep(G, D, sdt);
        const h = hitPeople(G, a, 0), w = segWorld(G, a[0], a[1], a[2], a[3], a[4], a[5]);
        const tg = hitTargets(G, a);
        const cand = [h && { k: 'p', s: h.s, h }, w && { k: 'w', s: w.t, w }, tg && { k: 't', s: tg.s, tg }].filter(Boolean).sort((x, y) => x.s - y.s)[0];
        const gy = G.hAt(a[3], a[5]);
        if (cand) {
          const s = cand.s, px = lerp(a[0], a[3], s), py = lerp(a[1], a[4], s), pz = lerp(a[2], a[5], s);
          D.alive = false; D.hitAt = { x: px, y: py, z: pz };
          if (cand.k === 'p') hitPerson(G, D, cand.h, px, py, pz);
          else if (cand.k === 't') { cand.tg.T.hit(G, cand.tg.T, px, py, pz); G.stats.hits++; }
          else hitWorld(G, D, px, py, pz, cand.w.c);
        } else if (a[4] < gy) { const s = (a[1] - G.hAt(a[0], a[2])) / Math.max(1e-3, (a[1] - G.hAt(a[0], a[2])) - (a[4] - gy)); D.alive = false; const px = lerp(a[0], a[3], s), pz = lerp(a[2], a[5], s); D.hitAt = { x: px, y: G.hAt(px, pz), z: pz }; hitWorld(G, D, px, G.hAt(px, pz), pz, null); }
        else if (a[4] < 0 && G.hAt(a[3], a[5]) < 0) { D.alive = false; D.hitAt = { x: a[3], y: 0, z: a[5] }; splash(G, a[3], a[5]); nearMiss(G, a[3], a[5]); }
        else { D.p.x = a[3]; D.p.y = a[4]; D.p.z = a[5]; if (D.t > 5) D.alive = false; }
        /* passa rente a alguém → susto */
      }
      D.trail.push([D.p.x, D.p.y, D.p.z]); if (D.trail.length > 40) D.trail.shift();
    }
    G.darts = G.darts.filter(D => D.alive || (G.dcam && G.dcam.dart === D));
  }
  function hitPerson(G, D, h, x, y, z) {
    const P = h.P, dist = Math.hypot(x - D.from.x, z - D.from.z);
    if (h.part === 'hat') { knockHat(G, P, D); return; }
    G.stats.hits++;
    G.crowd.stick(P, h.joint, x, y, z, D.v.x, D.v.y, D.v.z);
    if (P.sleep) { float3(G, x, y + .6, z, 'Já está a dormir!', '#cfd8ff'); return; }
    const moving = P.spd > .6;
    P.sleep = true; P.sleepT = 0; P.fallSide = Math.random() < .5 ? -1 : 1; P.react = null; P.mode = null;
    G.stats.sleeps++; G.stats.longest = Math.max(G.stats.longest, dist);
    sfx(G, 'hit'); setTimeout(() => sfx(G, 'yawn'), 500);
    burst(G, x, y, z, '#ffd6f0', 8);
    if (P.role === 'civ') {
      G.stats.civ++; G.score = Math.max(0, G.score - 200);
      float3(G, x, y + .8, z, 'Ups! Um civil a fazer a sesta  −200', '#ff8a8a');
      hint(G, ['Esse era um civil inocente!', 'Ups — um civil! Mais cuidado.', 'Outro civil a dormir… à terceira a missão falha!'][Math.min(2, G.stats.civ - 1)], 3, true);
      if (G.stats.civ >= 3) fail(G, 'Adormeceste demasiados civis.');
      return;
    }
    let pts = P.vip ? 500 : 100, tags = [];
    pts += Math.round(dist * .6); tags.push(Math.round(dist) + ' m');
    if (moving) { pts += 60; tags.push('em movimento'); }
    if (h.part === 'head') { pts += 40; tags.push('na mouche'); }
    if (dist > 300) { pts += 120; tags.push('longa distância'); }
    G.score += pts;
    float3(G, x, y + .8, z, `Zzz… +${pts}`, '#fff2a8', 26); float3(G, x, y + .2, z, tags.join(' · '), '#ffffff', 15);
    /* quem estava perto reage (civis espantados, guardas alerta) */
    G.people.forEach(o => { if (o === P || !isAwake(o)) return; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < 7 && !o.react) { o.react = { k: 'look', t: 0, d: 3 + Math.random() * 3, x: P.x, z: P.z }; if (o.role === 'civ' && Math.random() < .5) emote(G, o, '?'); } });
  }
  function knockHat(G, P, D) {
    if (P.hatOff) return;
    P.hatOff = true; G.stats.hats++; G.stats.hits++; G.score += 75;
    const geo = PP().geos()['hat_' + P.look.hat]; if (!geo) return;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: P.look.hatC || '#ffffff', vertexColors: true, roughness: .8 })); m.castShadow = true;
    const J = P.j.head; m.position.set(J.x, J.y - .08, J.z); m.scale.setScalar(P.s); G.r3.scene.add(m);
    const s = 1 / DART_V * 5; G.hats.push({ m, v: { x: D.v.x * s, y: 3.5, z: D.v.z * s }, w: { x: rand(-8, 8), y: rand(-6, 6), z: rand(-8, 8) }, t: 0 });
    float3(G, J.x, J.y + .6, J.z, 'Chapéu ao ar! +75', '#ffe08a', 20); sfx(G, 'pop');
    P.react = { k: 'hat', t: 0 }; emote(G, P, '?');
    if (P.aware) { P.sus = Math.min(1, P.sus + .45); G.sus = Math.max(G.sus, P.sus); }
  }
  function hitWorld(G, D, x, y, z, c) {
    sfx(G, 'thunk', { x, z });
    dust(G, x, y, z, c && (c.k === 'tree' || c.k === 'hedge') ? '#6a8a4a' : '#d8d0c0');
    /* dardo espetado */
    const m = new THREE.Mesh(PP().geos().dart, G.dartMat || (G.dartMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 })));
    const dir = new THREE.Vector3(-D.v.x, -D.v.y, -D.v.z).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.position.set(x, y, z); m.scale.setScalar(1.3); G.r3.scene.add(m); G.stuck.push(m);
    if (c && c.dyn) c.dyn.attach(m);
    nearMiss(G, x, z);
  }
  function nearMiss(G, x, z) {
    G.people.forEach(P => {
      if (!isAwake(P)) return;
      const d = Math.hypot(P.x - x, P.z - z);
      if (d < 4.5) {
        if (!P.react) P.react = { k: 'look', t: 0, d: 4, x, z };
        emote(G, P, '?');
        if (P.aware) { P.sus = Math.min(1, P.sus + (d < 2 ? .45 : .3)); G.sus = Math.max(G.sus, P.sus); if (P.sus >= .85 && !G.alarm) { P.react = { k: 'check', t: 0, x, z }; hint(G, `${P.name} desconfiou e foi ver o que caiu ali…`, 3); } }
      }
    });
    scareBirds(G, x, z);
  }
  /* alvos extra: patos, balões, sinos, pneus */
  function hitTargets(G, a) {
    let best = null;
    for (const T of G.targets) {
      if (T.done) continue; const p = T.pos(G, T);
      const [d, s] = segSegDist(a[0], a[1], a[2], a[3], a[4], a[5], p.x, p.y, p.z, p.x, p.y + .01, p.z);
      if (d < T.r && (!best || s < best.s)) best = { T, s };
    }
    return best;
  }
  function collectSetup(G) {
    const C = G.collect; if (!C) return;
    const scene = G.r3.scene;
    C.list.forEach(([x, y, z], i) => {
      let m, r = .45, pos;
      if (C.kind === 'duck') {
        m = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: '#ffd21a', roughness: .35 }), bk = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: .4 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), mat); body.scale.set(1.25, .85, 1); m.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 9), mat); head.position.set(.22, .3, 0); m.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(.07, .16, 8), bk); beak.rotation.z = -Math.PI / 2; beak.position.set(.42, .28, 0); m.add(beak);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(.1, .18, 6), mat); tail.rotation.z = Math.PI / 2 + .6; tail.position.set(-.38, .12, 0); m.add(tail);
        [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 5), new THREE.MeshBasicMaterial({ color: '#111' })); e.position.set(.33, .36, s * .1); m.add(e); });
        m.scale.setScalar(1.5); r = .5;
      } else if (C.kind === 'balloon') {
        m = new THREE.Group(); const c = ['#ff3a5a', '#3a8aff', '#ffd23a', '#3ad07a', '#c05aff', '#ff8a3a'][i % 6];
        const b = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), new THREE.MeshStandardMaterial({ color: c, roughness: .2, metalness: .1, envMap: G.r3.env })); b.scale.y = 1.18; m.add(b);
        const kn = new THREE.Mesh(new THREE.ConeGeometry(.06, .1, 6), b.material); kn.position.y = -.52; kn.rotation.x = Math.PI; m.add(kn);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.6, 3), new THREE.MeshBasicMaterial({ color: '#eeeeee' })); st.position.y = -1.35; m.add(st);
        r = .5;
      } else if (C.kind === 'gnome') {
        m = new THREE.Group(); const gold = C.gold, mt = c => new THREE.MeshStandardMaterial({ color: gold ? '#e8c050' : c, roughness: gold ? .25 : .6, metalness: gold ? .9 : 0, envMap: G.r3.env });
        const bd = new THREE.Mesh(new THREE.ConeGeometry(.28, .6, 10), mt('#2a64b8')); bd.position.y = .3; m.add(bd);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), mt('#f3cfb3')); hd.position.y = .68; m.add(hd);
        const bdd = new THREE.Mesh(new THREE.ConeGeometry(.14, .28, 8), mt('#f4f4f4')); bdd.position.set(0, .56, .08); bdd.rotation.x = Math.PI; m.add(bdd);
        const ht = new THREE.Mesh(new THREE.ConeGeometry(.17, .45, 10), mt('#d82a2a')); ht.position.y = .95; m.add(ht);
        m.scale.setScalar(1.6); r = .6;
      } else if (C.kind === 'lantern') {
        m = new THREE.Group(); const c = ['#ff5a3a', '#ffb03a', '#ff3a7a'][i % 3];
        const b = new THREE.Mesh(new THREE.SphereGeometry(.4, 14, 10), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); b.scale.y = 1.25; m.add(b);
        const sp = new THREE.Sprite(Arcade3D.glowSprite(c)); sp.scale.setScalar(2.4); m.add(sp);
        r = .5;
      }
      m.position.set(x, y, z); m.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(m);
      /* brilho que pisca de vez em quando para os brindes se encontrarem com os binóculos */
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#fff6c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); gl.position.set(x, y + .5, z); gl.renderOrder = 15; scene.add(gl);
      const T = { m, r, gl, base: { x, y, z }, ph: i * 1.7, pos(G, T) { return T.m.position; }, hit: collectHit };
      G.targets.push(T);
    });
  }
  function bellSetup(G) {
    if (!G.bellAt) return; const [x, y, z] = G.bellAt;
    G.targets.push({ r: 1.1, bell: true, p: new THREE.Vector3(x, y, z), pos(G, T) { return T.p; }, hit(G, T) {
      sfx(G, 'bell'); G.distract = 7; G.stats.hits++; float3(G, x, y + 1.5, z, 'DONG! Todos a olhar para o sino', '#ffe08a', 18);
      G.people.forEach(P => { if (isAwake(P) && !(P.react && P.react.k !== 'look')) P.react = { k: 'look', t: 0, d: 6 + Math.random() * 2, x, z }; });
      scareBirds(G, x, z); if (!G.bellHint) { G.bellHint = 1; hint(G, 'O sino distrai toda a gente durante alguns segundos!', 3); } } });
  }
  function collectHit(G, T) {
    T.done = true; G.got++; T.m.visible = false; if (T.gl) T.gl.visible = false;
    const p = T.m.position, C = G.collect;
    confetti(G, p.x, p.y, p.z); sfx(G, C.kind === 'duck' ? 'quack' : C.kind === 'balloon' ? 'pop' : 'chime');
    G.score += 150; float3(G, p.x, p.y + .6, p.z, `${['Quack!', 'Pop!', 'Gnomo!', 'Lanterna!'][['duck', 'balloon', 'gnome', 'lantern'].indexOf(C.kind)] || 'Boa!'} +150  (${G.got}/${C.list.length})`, '#a8f0ff', 20);
    if (C.kind === 'balloon') nearMiss(G, p.x, p.z);
  }

  /* ════════════════════════════════════════════════════════════════
     carros, aves, efeitos
  ════════════════════════════════════════════════════════════════ */
  function pathLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
  function pathAt(P, s) { for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (s <= l || i === P.length - 1) { const k = clamp(s / l, 0, 1); return [lerp(P[i - 1][0], P[i][0], k), lerp(P[i - 1][1], P[i][1], k), P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]]; } s -= l; } return [P[0][0], P[0][1], 1, 0]; }
  const CARC = ['#c83a2a', '#2a64b8', '#f2f2f2', '#2a2a2e', '#8a8f95', '#e8b030', '#3a8a5a', '#6a2a8a', '#d86a2a'];
  function carsAlong(G, d) {
    const L = pathLen(d.path);
    for (let i = 0; i < d.n; i++) {
      const type = d.type || ['sedan', 'hatch', 'suv', 'van', 'sedan', 'taxi'][Math.floor(Math.random() * 6)];
      const g = Arcade3D.car({ type, color: d.color || CARC[Math.floor(Math.random() * CARC.length)], len: type === 'van' ? 4.9 : 4.4 });
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      G.r3.scene.add(g);
      /* vidros escurecidos de fábrica → vidro fumado transparente para se ver quem conduz */
      g.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0x0b1424) m.material = G.carGlass || (G.carGlass = new THREE.MeshPhysicalMaterial({ color: '#2a3a4c', metalness: .3, roughness: .05, clearcoat: 1, transparent: true, opacity: .42, depthWrite: false, envMap: G.r3.env })); });
      const hs = { suv: .17, van: .2 }[type] || .13;
      const C = { g, type, seat: [-.02, hs, -.095], path: d.path, L, s: (L / d.n) * i + rand(0, 6), dir: 1, ping: d.loop === 'ping', v: d.speed || 9, vmax: d.speed || 9, lane: d.lane != null ? d.lane : 2.2, stop: d.stop, tag: d.tag, flat: 0, parked: d.parked };
      if (d.parked) { C.s = d.at || 0; C.v = 0; }
      G.cars.push(C);
      /* pneus como alvos (para o carro de fuga) */
      if (d.tag) g.userData.wheels.forEach((w, k) => G.targets.push({ r: .45, car: C, w, pos(G, T) { return T.w.getWorldPosition(T._p || (T._p = new THREE.Vector3())); }, hit(G, T) { T.done = true; T.car.flat++; sfx(G, 'pss'); dust(G, T._p.x, T._p.y, T._p.z, '#ffffff'); G.score += 120; float3(G, T._p.x, T._p.y + 1, T._p.z, 'Pneu furado! +120', '#ffe08a', 20); T.w.scale.y = .7; } }));
    }
  }
  function carsUpdate(G, dt) {
    G.dyn = G.dyn || [];
    G.dyn.length = 0;
    for (const C of G.cars) {
      if (C.parked && !C.go) { place(C); continue; }
      /* abranda atrás de outro carro ou de pessoas na passadeira */
      let want = C.vmax * (C.flat ? Math.max(0, 1 - C.flat * .6) : 1);
      if (C.flat >= 2) want = 0;
      for (const o of G.cars) if (o !== C && o.path === C.path && o.dir === C.dir) { const ds = (o.s - C.s) * C.dir; if (ds > 0 && ds < 11) want = Math.min(want, o.v * .9); }
      C.v = lerp(C.v, want, dt * (want < C.v ? 2.5 : .8));
      C.s += C.v * C.dir * dt;
      if (C.ping) { if (C.s > C.L) { C.s = C.L; C.dir = -1; } if (C.s < 0) { C.s = 0; C.dir = 1; } }
      else if (C.s > C.L) { if (C.onEnd) { C.onEnd(G, C); C.onEnd = null; } C.s = C.loop ? C.s - C.L : C.L; if (!C.loop) C.v = 0; }
      place(C, dt);
    }
    function place(C, dt) {
      const [x, z, dx, dz] = pathAt(C.path, C.s), l = Math.hypot(dx, dz) || 1, ux = dx / l * C.dir, uz = dz / l * C.dir;
      const px = x + uz * -C.lane * -1 * (C.ping ? 1 : 0) * 1 + (C.ping ? -uz * C.lane : 0), pz = z + (C.ping ? ux * C.lane : 0);
      const y = G.hAt(px, pz);
      C.g.position.set(px, y, pz); C.g.rotation.y = Math.atan2(-uz, ux);
      if (dt) C.g.userData.wheels.forEach(w => { w.rotation.z -= C.v * dt / (.35); });
      C.x = px; C.z = pz; C.yaw = Math.atan2(ux, uz);
      G.dyn.push({ x: px, y: y + .8, z: pz, hx: 1, hy: .8, hz: 2.2, c: Math.cos(C.yaw), s: Math.sin(C.yaw), k: 'car' });
    }
  }
  function moversUpdate(G, dt) {
    (G.movers || []).forEach(M => {
      const L = M.L || (M.L = pathLen(M.path));
      if (M.pause > 0) { M.pause -= dt; M.fk.forks.position.y = .3 + Math.sin(clamp(1 - M.pause / 3, 0, 1) * Math.PI) * .9; return; }
      M.s += M.v * dt * (M.dir || 1);
      if (M.s > L || M.s < 0) { M.dir = -(M.dir || 1); M.s = clamp(M.s, 0, L); M.pause = 3; }
      const [x, z, dx, dz] = pathAt(M.path, M.s), d = M.dir || 1;
      M.fk.g.position.set(x, G.hAt(x, z), z); M.fk.g.rotation.y = Math.atan2(dx * d, dz * d);
      G.dyn && G.dyn.push({ x, y: G.hAt(x, z) + 1.3, z, hx: .7, hy: 1.3, hz: 1.4, c: 1, s: 0, k: 'car' });
    });
  }
  /* aves: gaivotas a planar, pombos no chão que levantam voo */
  function birdsSetup(G, o) {
    const gull = o.kind === 'gull', k = gull ? 1.5 : .8, M4 = W().M4;
    const bg = W().mergeGeos([[new THREE.SphereGeometry(.12 * k, 10, 8), gull ? '#f6f6f4' : '#8a92a4', M4(0, 0, 0, 0, 0, 0, 1, .85, 2.3)], [new THREE.SphereGeometry(.075 * k, 8, 6), gull ? '#f6f6f4' : '#4a5468', M4(0, .07 * k, .26 * k)], [new THREE.ConeGeometry(.022 * k, .09 * k, 6), gull ? '#f2c230' : '#3a3a3a', M4(0, .06 * k, .36 * k, Math.PI / 2)], [new THREE.ConeGeometry(.06 * k, .16 * k, 4), gull ? '#c8ccd0' : '#5a6478', M4(0, 0, -.3 * k, -Math.PI / 2)]]);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .12 * k, 0, 0, -.1 * k, .78 * k, .03, -.06 * k, .78 * k, .03, -.06 * k, 0, 0, -.1 * k, .5 * k, .02, -.14 * k], 3)); wg.computeVertexNormals();
    const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), mw = new THREE.MeshStandardMaterial({ color: gull ? '#eef0f2' : '#7a8496', roughness: .8, side: THREE.DoubleSide });
    const n = o.n, body = new THREE.InstancedMesh(bg, mt, n), wl = new THREE.InstancedMesh(wg, mw, n), wr = new THREE.InstancedMesh(wg, mw, n);
    [body, wl, wr].forEach(m => { m.castShadow = false; m.frustumCulled = false; G.r3.scene.add(m); });
    G.birdM = { body, wl, wr, list: [] };
    for (let i = 0; i < n; i++) {
      const cc = o.centers[i % o.centers.length];
      /* gaivotas: umas a planar baixo por cima do cais, outras pousadas nos cabeços e nos contentores */
      if (o.kind === 'gull' && i % 4 === 3 && o.perch) { const pp = o.perch[i % o.perch.length]; G.birdM.list.push({ fly: false, x: pp[0] + rand(-1, 1), y: pp[1], z: pp[2] + rand(-.5, .5), yaw: Math.random() * TAU, peck: Math.random() * 6, c: [pp[0], pp[1] + 12, pp[2]], flap: 0 }); }
      else if (o.kind === 'gull') G.birdM.list.push({ fly: true, c: cc, r: 14 + Math.random() * 34, a: Math.random() * TAU, h: cc[1] + rand(-10, 6), sp: rand(.15, .3) * (Math.random() < .5 ? -1 : 1), flap: Math.random() * 6 });
      else G.birdM.list.push({ fly: false, x: cc[0] + rand(-14, 14), y: cc[1], z: cc[2] + rand(-8, 8), yaw: Math.random() * TAU, peck: Math.random() * 6, c: cc, flap: 0 });
    }
  }
  function scareBirds(G, x, z) { if (!G.birdM) return; G.birdM.list.forEach(b => { const bx = b.fly ? b.c[0] + Math.cos(b.a) * b.r : b.x, bz = b.fly ? b.c[2] + Math.sin(b.a) * b.r : b.z; if (Math.hypot(bx - x, bz - z) < 18) { if (!b.fly) { b.fly = true; b.take = 0; b.a = Math.random() * TAU; b.r = 0; b.h = b.y; b.sp = rand(.4, .7); } else b.sp *= 1.6; b.scared = 3; } }); if (G.birdM.list.length) sfx(G, 'flap', { x, z }); }
  function birdsUpdate(G, dt) {
    const B = G.birdM; if (!B) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), w = new THREE.Matrix4();
    B.list.forEach((b, i) => {
      let x, y, z, yaw, flap = 0, roll = 0;
      if (b.fly) {
        if (b.take != null) { b.take += dt; b.r = Math.min(30, b.r + dt * 9); b.h += dt * Math.max(0, 6 - b.take); if (b.take > 8) { b.take = null; } }
        if (b.scared) b.scared = Math.max(0, b.scared - dt);
        b.a += b.sp * dt * (b.scared ? 2 : 1); x = b.c[0] + Math.cos(b.a) * b.r; z = b.c[2] + Math.sin(b.a) * b.r; y = b.h + Math.sin(b.a * 3) * 2;
        yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * Math.sign(b.sp)) + Math.PI / 2 * 0; yaw = Math.atan2(-Math.sin(b.a) * b.sp, Math.cos(b.a) * b.sp);
        b.flap += dt * (b.scared || b.take != null ? 14 : 5); flap = (b.take != null || b.scared || Math.sin(b.flap * .2) > .3) ? Math.sin(b.flap) * .7 : .15; roll = -Math.sign(b.sp) * .3;
      } else {
        b.peck += dt; x = b.x; y = b.y + .07 + Math.max(0, Math.sin(b.peck * 3)) * .0; z = b.z; yaw = b.yaw; roll = 0; if (Math.sin(b.peck * 2.3 + i) > .7) roll = .0; if (Math.random() < dt * .3) b.yaw += rand(-1, 1);
        if (Math.random() < dt * .4) { b.x += Math.sin(b.yaw) * .2; b.z += Math.cos(b.yaw) * .2; }
        flap = -.15;
      }
      e.set(0, yaw, roll, 'YXZ'); q.setFromEuler(e); p.set(x, y, z); m.compose(p, q, s.set(1, 1, 1)); B.body.setMatrixAt(i, m);
      w.makeRotationZ(flap); w.premultiply(m); B.wr.setMatrixAt(i, w);
      w.makeRotationZ(Math.PI - flap); w.premultiply(m); B.wl.setMatrixAt(i, w);
    });
    B.body.instanceMatrix.needsUpdate = B.wl.instanceMatrix.needsUpdate = B.wr.instanceMatrix.needsUpdate = true;
  }
  function burst(G, x, y, z, c, n) { for (let i = 0; i < n; i++) G.r3.spark.spawn({ x, y, z, vx: rand(-2, 2), vy: rand(0, 3), vz: rand(-2, 2), life: .6, s0: .25, s1: 0, c0: c, a: .9, grav: 3 }); }
  function dust(G, x, y, z, c) { for (let i = 0; i < 7; i++) G.r3.smoke.spawn({ x, y: y + .1, z, vx: rand(-1, 1), vy: rand(.4, 1.6), vz: rand(-1, 1), life: rand(.8, 1.6), s0: .3, s1: 1.4, c0: c, a: .55, drag: 1.5 }); }
  function splash(G, x, z) { for (let i = 0; i < 14; i++) G.r3.smoke.spawn({ x, y: .2, z, vx: rand(-1.2, 1.2), vy: rand(2, 5), vz: rand(-1.2, 1.2), life: rand(.6, 1), s0: .25, s1: .6, c0: '#eaf6ff', a: .8, grav: 9 }); sfx(G, 'splash', { x, z }); }
  function confetti(G, x, y, z) { const C = ['#ff3a5a', '#3a8aff', '#ffd23a', '#3ad07a', '#c05aff']; for (let i = 0; i < 26; i++) G.r3.spark.spawn({ x, y, z, vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3), life: rand(.8, 1.4), s0: .18, s1: .1, c0: C[i % 5], a: 1, grav: 5, drag: 1 }); }
  function snore(G, P) { /* bolha de sono discreta */ }

  /* ── emoções por cima das cabeças (Z, !, ?, rádio) ── */
  let _emoTex = {};
  function emoTex(k) {
    if (_emoTex[k]) return _emoTex[k];
    const t = W().canvasTex(128, 128, x => {
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (k === 'z') { x.font = "900 96px 'Space Grotesk', system-ui"; x.lineWidth = 10; x.strokeStyle = '#1a2a5a'; x.strokeText('Z', 64, 66); x.fillStyle = '#cfe0ff'; x.fillText('Z', 64, 66); }
      else { const bg = k === '!' ? '#ffcf2a' : k === '?' ? '#ffffff' : '#7ae0ff'; x.fillStyle = bg; x.beginPath(); x.arc(64, 60, 46, 0, TAU); x.fill(); x.beginPath(); x.moveTo(50, 98); x.lineTo(64, 122); x.lineTo(76, 98); x.fill(); x.fillStyle = '#1a1a2a'; x.font = "900 70px 'Space Grotesk', system-ui"; x.fillText(k === 'radio' ? '📻' : k, 64, 64); }
    });
    return (_emoTex[k] = t);
  }
  function sprites(G) { G.emoPool = Arcade3D.pool(G.r3.scene); }
  function emote(G, P, k) {
    if (k === 'z' && G.emotes.filter(e => e.P === P).length > 2) return;
    if (k !== 'z') G.emotes = G.emotes.filter(e => e.P !== P || e.k === 'z');
    G.emotes.push({ P, k, t: 0, life: k === 'z' ? 2.6 : 2.2, dx: rand(-.15, .15) });
  }
  function emotesDraw(G) {
    const pool = G.emoPool; pool.begin();
    const cam = G.r3.cam, tf = Math.tan(cam.fov * Math.PI / 360);
    G.emotes = G.emotes.filter(e => (e.t += G.dtv) < e.life);
    for (const e of G.emotes) {
      const P = e.P; if (P.hidden || !P.j) continue;
      const h = P.j.head, k = e.t / e.life;
      const sp = pool.get('emo:' + e.k, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex(e.k), transparent: true, depthWrite: false, fog: false })));
      const x = h.x + e.dx + (e.k === 'z' ? Math.sin(e.t * 2) * .2 : 0), y = h.y + .45 + (e.k === 'z' ? e.t * .6 : Math.min(.2, e.t)), z = h.z;
      const d = Math.hypot(x - cam.position.x, y - cam.position.y, z - cam.position.z), sc = Math.max(.42, d * tf * .045) * (e.k === 'z' ? .8 + k * .6 : (e.t < .15 ? e.t / .15 : 1));
      sp.position.set(x, y + sc * .4, z); sp.scale.set(sc, sc, 1); sp.material.opacity = e.k === 'z' ? Math.sin(k * Math.PI) : Math.min(1, (1 - k) * 4); sp.renderOrder = 20;
    }
    pool.end();
  }
  /* textos que sobem: guardados em 3D e desenhados no HUD */
  function float3(G, x, y, z, text, color, size) { G.fx.push({ x, y, z, text, color, size: size || 18, t: 0 }); }

  /* ── câmara de vigilância no canto: mostra quem fez alguma coisa importante (viu um colega a dormir,
        está a usar o rádio, deu o alarme, apareceu o chefe, fugiu) — prioridade maior substitui a menor ── */
  function setPip(G, P, label, d, pri) {
    if (G.pip && G.pip.pri > (pri || 1) && G.pip.t < G.pip.d) return;
    G.pip = { P, label, d: d || 4, t: 0, pri: pri || 1, a: null };
  }
  const _pc = {};
  function pipRender(G, ren) {
    const pp = G.pip, P = pp.P; if (pp.t > pp.d || !P.j || P.hidden) { G.pip = null; return; }
    const r3 = G.r3, W = r3.w, H = r3.h, pw = Math.round(G.touch ? clamp(W * .22, 140, 220) : clamp(W * .28, 160, 320)), ph = Math.round(pw * .6), px = G.touch ? W - pw - 14 : 14, py = G.touch ? 142 : Math.round(Math.max(170, H * .42));
    const pc = r3.pipCam || (r3.pipCam = new THREE.PerspectiveCamera(36, 1, .3, 4000)); pc.aspect = pw / ph;
    const c = P.j.chest, base = Math.atan2(G.L.nest.x - c.x, G.L.nest.z - c.z);
    /* escolhe um ângulo com o alvo à vista (do lado do ninho primeiro) e mantém-no */
    if (pp.a == null) { pp.a = base + .5; for (const da of [.5, -.5, 1.1, -1.1, 0, 1.7, -1.7, Math.PI]) { const a = base + da; _pc.x = c.x + Math.sin(a) * 6.5; _pc.y = c.y + 2.4; _pc.z = c.z + Math.cos(a) * 6.5; if (los(G, _pc, c)) { pp.a = a; break; } } }
    const a = pp.a + pp.t * .05; pc.position.set(c.x + Math.sin(a) * 6.5, c.y + 2.4, c.z + Math.cos(a) * 6.5); pc.lookAt(c.x, c.y - .15, c.z); pc.updateProjectionMatrix(); pc.updateMatrixWorld();
    const y0 = H - py - ph; ren.setScissorTest(true); ren.setScissor(px, y0, pw, ph); ren.setViewport(px, y0, pw, ph);
    const au = ren.shadowMap.autoUpdate; ren.shadowMap.autoUpdate = false; const e = ren.toneMappingExposure; ren.toneMappingExposure = r3.sky.exp * (G.r3.night ? 2.2 : 1);
    ren.clearDepth(); ren.render(r3.scene, pc);
    ren.toneMappingExposure = e; ren.shadowMap.autoUpdate = au; ren.setScissorTest(false); ren.setViewport(0, 0, W, H);
    pp.rect = [px, py, pw, ph];
  }
  function pipHud(G, ctx) {
    const pp = G.pip; if (!pp || !pp.rect) return; const [x, y, w, h] = pp.rect, k = clamp(Math.min(pp.t * 6, (pp.d - pp.t) * 4), 0, 1);
    ctx.clearRect(x, y, w, h);   /* destapa a imagem 3D da câmara (a máscara da mira pinta o ecrã todo de preto) */
    ctx.globalAlpha = k; ctx.strokeStyle = pp.pri >= 3 ? '#ff4a4a' : '#ffcf2a'; ctx.lineWidth = 3; Ut.rr(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(8,14,22,.78)'; ctx.fillRect(x, y + h - 24, w, 24);
    ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(x + 12, y + 12, 4.5, 0, TAU); ctx.globalAlpha = k * (Math.sin(G.t * 8) > 0 ? 1 : .35); ctx.fill(); ctx.globalAlpha = k;
    ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('CÂMARA', x + 21, y + 16);
    ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(pp.label, x + w / 2, y + h - 8, w - 12);
    ctx.globalAlpha = 1;
  }
  /* quem está a caminho de dar o alarme: marcador vermelho por cima da cabeça (ou seta na borda do ecrã) com o que está a fazer */
  const THREAT = { spot: 'viu alguém a dormir!', go: 'vai ver o colega…', shake: 'a acordar o colega…', radio: 'a chamar pelo rádio!', check: 'desconfiado…' };
  function threats(G, ctx, w, h) {
    const cam = G.r3.cam, v = _v3;
    for (const P of G.people) {
      let txt = null, prog = 0, red = false, arrowOnly = false;
      if (isAwake(P) && P.react && THREAT[P.react.k]) { txt = THREAT[P.react.k]; red = P.react.k !== 'check'; prog = P.react.k === 'radio' ? P.react.t / 3.2 : P.react.k === 'shake' ? P.react.t / 2.6 : 0; }
      else if (G.alarmBy === P && G.alarmByT > 0) { txt = 'deu o alarme'; red = true; }
      else if (P.vip && P.marked && !P.sleep && !P.hidden) { txt = P.fleeing ? 'a fugir!' : 'alvo'; arrowOnly = !P.fleeing; }
      if (!txt || !P.j) continue;
      v.set(P.j.head.x, P.j.head.y + .7, P.j.head.z).project(cam);
      const behind = v.z > 1; let sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h; if (behind) { sx = w - sx; sy = h - sy; }
      const col = red ? '#ff4a4a' : '#ffcf2a', pulse = 1 + Math.sin(G.t * 9) * .12;
      const off = behind || sx < 20 || sx > w - 20 || sy < 70 || sy > h - 30;
      if (off) {
        const cx = w / 2, cy = h / 2, a = Math.atan2(sy - cy, sx - cx), R = Math.min(w, h) * .44, ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16 * pulse, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
        ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const lx = ex - Math.cos(a) * 26, ly = ey - Math.sin(a) * 22 + 4; ctx.strokeText(P.name, lx, ly); ctx.fillStyle = col; ctx.fillText(P.name, lx, ly);
        continue;
      }
      if (arrowOnly) continue;
      const r = 11 * pulse; ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 10, r, 0, TAU); ctx.fill(); ctx.stroke();
      if (prog > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy - 10, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1)); ctx.stroke(); }
      ctx.fillStyle = '#1a1a1a'; ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(red ? '!' : '★', sx, sy - 5);
      ctx.font = `800 11px ${FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; const t2 = `${P.name} — ${txt}`; ctx.strokeText(t2, sx, sy - 27); ctx.fillStyle = col; ctx.fillText(t2, sx, sy - 27);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     espingarda na primeira pessoa
  ════════════════════════════════════════════════════════════════ */
  function rifleSetup(G) {
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, .02, 10);
    sc.add(new THREE.HemisphereLight('#eef4ff', '#4a4038', 1.4)); const dl = new THREE.DirectionalLight('#fff6e6', 1.6); dl.position.set(1, 2, 1); sc.add(dl);
    sc.environment = G.r3.env;
    const g = new THREE.Group(), M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? .4 : r, metalness: m == null ? .5 : m, envMap: G.r3.env, envMapIntensity: .9 });
    const dark = M('#23262b', .35, .7), olive = M('#4a5a3a', .6, .1), orange = M('#ff7a1a', .4, .1), wood = M('#6a4a2e', .55, 0), glove = M('#2a2a2e', .8, 0), lens = M('#1a3a5a', .02, .9);
    const add = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); g.add(m); return m; };
    add(new THREE.BoxGeometry(.07, .09, .62), olive, 0, 0, 0);
    add(new THREE.CylinderGeometry(.016, .016, .7, 12), dark, 0, .02, -.62, Math.PI / 2);
    add(new THREE.CylinderGeometry(.026, .026, .1, 12), orange, 0, .02, -.95, Math.PI / 2);
    add(new THREE.CylinderGeometry(.03, .03, .34, 16), dark, 0, .1, -.04, Math.PI / 2);
    add(new THREE.CylinderGeometry(.04, .03, .07, 16), dark, 0, .1, -.24, Math.PI / 2); add(new THREE.CylinderGeometry(.036, .03, .06, 16), dark, 0, .1, .15, Math.PI / 2);
    add(new THREE.CylinderGeometry(.032, .032, .01, 16), lens, 0, .1, -.278, Math.PI / 2);
    add(new THREE.CylinderGeometry(.012, .012, .05, 8), dark, 0, .145, -.05); add(new THREE.CylinderGeometry(.012, .012, .05, 8), dark, .045, .1, -.05, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(.06, .14, .3), wood, 0, -.05, .42, -.18); add(new THREE.BoxGeometry(.065, .16, .05), dark, 0, -.06, .58, -.18);
    add(new THREE.BoxGeometry(.05, .12, .06), wood, 0, -.1, .14, .3);
    add(new THREE.BoxGeometry(.05, .1, .09), dark, 0, -.08, -.08);
    const bolt = add(new THREE.CylinderGeometry(.009, .009, .07, 8), dark, .05, .02, .08, 0, 0, Math.PI / 2); add(new THREE.SphereGeometry(.016, 8, 6), dark, .085, .02, .08);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(.006, .006, .22, 6), dark, s * .03, -.11, -.5, .3, 0, s * .25);
    /* luvas */
    add(new THREE.SphereGeometry(.05, 10, 8), glove, .0, -.1, .17).scale.set(1, 1.2, 1.5);
    add(new THREE.SphereGeometry(.05, 10, 8), glove, -.0, -.045, -.32).scale.set(1.3, .9, 1.7);
    add(new THREE.CylinderGeometry(.045, .05, .3, 10), M('#3a4a32', .8, 0), -.08, -.12, -.15, 1.1, 0, .5);
    g.scale.setScalar(.72); sc.add(g); g.position.set(.24, -.2, -.5);
    G.fp = { scene: sc, cam, g, bolt };
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt; if (!G.ok) return;
    const real = dt;
    /* câmara do dardo: o tempo abranda (e para perto do impacto) */
    let ts = 1;
    if (G.dcam) {
      const D = G.dcam; D.t += real;
      if (D.dart.alive) { const left = D.hitT - D.dart.t; ts = left > .06 ? clamp(D.hitT / 2.2, .05, .45) : .05; }
      else { D.after = (D.after || 0) + real; ts = .35; if (D.after > 2.3) G.dcam = null; }
      if (D.t > 9) G.dcam = null;
    }
    G.timeScale = lerp(G.timeScale, ts, Math.min(1, real * 12));
    dt = Math.min(dt, .05) * G.timeScale; G.dtv = dt;
    G.gt = (G.gt || 0) + dt;
    G.r3.uTime.value += dt;
    const w = windAt(G, G.gt); G.r3.uWind.value.set(w.x, w.z);
    /* mira: oscilação (respiração + coração), sustentar a respiração */
    aimUpdate(G, real);
    if (G.reload > 0) { G.reload -= real; if (G.reload <= 0) { const n = Math.min(5, G.ammo); G.mag = n; sfx(G, 'bolt'); } }
    if (G.bolt > 0) G.bolt = Math.max(0, G.bolt - real);
    G.recoil = Math.max(0, G.recoil - real * 4);
    /* telémetro: distância ao que está na mira */
    if ((G.fxFrame = (G.fxFrame || 0) + 1) % 6 === 0) G.range = rangeAt(G);
    /* pessoas */
    G.people.forEach(P => { const ox = P.x, oz = P.z; think(G, P, dt); P.vx = (P.x - ox) / Math.max(1e-4, dt); P.vz = (P.z - oz) / Math.max(1e-4, dt); P.y = P.fy != null ? P.fy : G.hAt(P.x, P.z); });
    separate(G, dt);
    if (G.fxFrame % 15 === 0) awareness(G);
    G.distract = Math.max(0, (G.distract || 0) - dt);
    G.sus = Math.max(G.alarm ? 1 : 0, G.sus - dt * .03); G.people.forEach(p => { p.sus = Math.max(0, p.sus - dt * .03); });
    dartsUpdate(G, dt);
    carsUpdate(G, dt);
    moversUpdate(G, dt);
    boatUpdate(G, dt);
    birdsUpdate(G, dt);
    hatsUpdate(G, dt);
    animsUpdate(G, dt);
    G.targets.forEach(T => {
      if (T.m && !T.done) { T.m.position.y = T.base.y + Math.sin(G.gt * 1.6 + T.ph) * (G.collect.kind === 'duck' ? .06 : .15); T.m.rotation.y += dt * .4; }
      if (T.gl) { if (T.done) { T.gl.visible = false; return; } const c = G.r3.cam.position, d = Math.hypot(T.base.x - c.x, T.base.y - c.y, T.base.z - c.z), k = Math.max(0, Math.sin(G.gt * 2.4 + T.ph * 2)); T.gl.visible = k > .55; T.gl.position.y = T.m.position.y + .5; T.gl.scale.setScalar(Math.max(1, d * Math.tan(G.r3.cam.fov * Math.PI / 360) * .05) * (k - .5) * 2); }
    });
    G.r3.smoke.update(dt); G.r3.spark.update(dt);
    if (G.L.script) G.L.script(G, dt);
    objectives(G, dt);
    if (G.timer > 0 && !G.done && !G.failed) { G.timer -= dt; if (G.timer <= 0) { const tob = G.obj.find(o => o.timer && !o.done); if (tob) { const thief = G.people.find(p => p.vip && isAwake(p)); if (thief && G.escape) { thief.fleeing = true; thief.beh = { type: 'path', path: G.escape.slice(), speed: 3.2, end: 'escape' }; thief.wi = 0; hint(G, 'O tempo acabou — o gatuno está a fugir!', 3, true); } else fail(G, 'O tempo acabou.'); } } }
    G.hints.forEach(h => { h.t += real; }); G.hints = G.hints.filter(h => h.t < h.d);
    if (G.pip) G.pip.t += real; if (G.alarmByT > 0) G.alarmByT -= real;
    G.fx.forEach(f => { f.t += real; }); G.fx = G.fx.filter(f => f.t < 1.8);
    if (G.endT != null) { G.endT -= real; if (G.endT <= 0) { G.endT = null; finish(G, api); } }
  }
  /* pessoas não se atravessam */
  function separate(G, dt) {
    const L = G.people.filter(p => !p.hidden && !p.sleep && p.mode === 'walk');
    for (const a of L) for (const b of G.people) { if (a === b || b.hidden) continue; const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), r = b.sleep ? .9 : .55; if (d < r && d > 1e-3) { const k = (r - d) * .5; a.x += dx / d * k; a.z += dz / d * k; } }
  }
  function aimUpdate(G, dt) {
    const sc = G.scope || G.bino;
    /* respiração: inspira/expira devagar; Shift sustém por ~5 s */
    if (G.holding && G.breath > 0 && !G.gasp) { G.breath = Math.max(0, G.breath - dt / 5.5); if (G.breath <= 0) { G.gasp = 2.2; sfx(G, 'gasp'); } }
    else { G.breath = Math.min(1, G.breath + dt / 3.2); }
    if (G.gasp) G.gasp = Math.max(0, G.gasp - dt);
    const hold = G.holding && G.breath > 0 && !G.gasp, st = G.diff === 'easy' ? .55 : G.diff === 'hard' ? 1.35 : 1;
    const amp = (sc ? .0042 : .006) * st * (hold ? .12 : 1) * (G.gasp ? 2.4 : 1);
    G.swT = (G.swT || 0) + dt;
    const t = G.swT, hb = Math.pow(Math.max(0, Math.sin(t * 7.2)), 12) * .25;
    const tx = (Math.sin(t * .63) * .7 + Math.sin(t * 1.37 + 1.1) * .35 + Math.sin(t * 2.9) * .12) * amp, ty = (Math.sin(t * .91 + 2) * .55 + Math.sin(t * .27) * .45 + hb) * amp;
    G.sway.x = lerp(G.sway.x, tx, Math.min(1, dt * 6)); G.sway.y = lerp(G.sway.y, ty, Math.min(1, dt * 6));
    /* teclas para olhar (acessibilidade) */
    const k = G.keys, sp = (G.fov / FOV) * 1.1 * dt;
    if (k.ArrowLeft) G.yaw += sp; if (k.ArrowRight) G.yaw -= sp; if (k.ArrowUp) G.pitch += sp * .8; if (k.ArrowDown) G.pitch -= sp * .8;
    clampView(G);
    /* ampliação suave */
    const target = G.bino ? FOV / BINO : G.scope ? FOV / ZOOMS[G.zi] : FOV;
    G.fov = lerp(G.fov, target, Math.min(1, dt * 10));
  }
  function clampView(G) { const n = G.L.nest; G.yaw = clamp(G.yaw, n.yaw - n.yawR, n.yaw + n.yawR); G.pitch = clamp(G.pitch, n.pMin, n.pMax); }
  function rangeAt(G) {
    const d = aimDir(G, { x: 0, y: 0, z: 0 }, false), c = G.r3.cam.position, far = 1500;
    const w = segWorld(G, c.x, c.y, c.z, c.x + d.x * far, c.y + d.y * far, c.z + d.z * far);
    let best = w ? w.t * far : far;
    /* chão: marcha ao longo do raio */
    for (let s = 2; s < best; s += Math.max(1, s * .02)) { const x = c.x + d.x * s, y = c.y + d.y * s, z = c.z + d.z * s; if (y < Math.max(0, G.hAt(x, z))) { best = s; break; } }
    /* pessoas */
    for (const P of G.people) { if (P.hidden || !P.j) continue; const [dd, s] = segSegDist(c.x, c.y, c.z, c.x + d.x * far, c.y + d.y * far, c.z + d.z * far, P.j.hip.x, P.j.hip.y, P.j.hip.z, P.j.head.x, P.j.head.y, P.j.head.z); if (dd < .35 && s * far < best) { best = s * far; G.aimP = P; } }
    return best < far ? best : 0;
  }
  function hatsUpdate(G, dt) {
    G.hats.forEach(h => { if (h.rest) return; h.t += dt; h.v.y -= 9.8 * dt; h.m.position.x += h.v.x * dt; h.m.position.y += h.v.y * dt; h.m.position.z += h.v.z * dt; h.m.rotation.x += h.w.x * dt; h.m.rotation.y += h.w.y * dt; h.m.rotation.z += h.w.z * dt; const gy = Math.max(G.hAt(h.m.position.x, h.m.position.z), 0) + .05; if (h.m.position.y < gy) { h.m.position.y = gy; if (h.v.y < -2) { h.v.y *= -.3; h.v.x *= .5; h.v.z *= .5; h.w.x *= .4; h.w.z *= .4; } else { h.rest = true; h.m.rotation.x = 0; h.m.rotation.z = Math.PI * (Math.random() < .5 ? 1 : 0) * .0; } } });
  }
  /* animações do mundo: fumo, bandeiras, roupa, fonte, barcos, luzes */
  function animsUpdate(G, dt) {
    const t = G.gt, w = windAt(G, t), ws = Math.max(.6, w.s), wa = Math.atan2(w.x, w.z);
    if (G.cloth && G.cloth.dirty) { G.cloth.im.instanceMatrix.needsUpdate = true; G.cloth.dirty = false; }
    for (const a of G.anim) {
      if (a.k === 'smoke') { if (Math.random() < dt * (a.big ? 9 : 6)) G.r3.smoke.spawn({ x: a.p[0], y: a.p[1], z: a.p[2], vx: w.x * .6 + rand(-.2, .2), vy: rand(.8, 1.4) * (a.big ? 2 : 1), vz: w.z * .6 + rand(-.2, .2), life: rand(4, 7) * (a.big ? 1.6 : 1), s0: a.big ? 2 : .6, s1: a.big ? 14 : 4, c0: a.big ? '#8a8a8a' : '#c8c8c8', a: .35, drag: .2 }); }
      else if (a.k === 'fountain') { for (let i = 0; i < 3; i++) if (Math.random() < dt * 30) { const an = Math.random() * TAU; G.r3.smoke.spawn({ x: a.p[0], y: a.p[1], z: a.p[2], vx: Math.cos(an) * 1.1, vy: rand(2.5, 3.2), vz: Math.sin(an) * 1.1, life: 1.1, s0: .14, s1: .28, c0: '#e8f6ff', a: .7, grav: 9.8 }); } }
      else if (a.k === 'boat') { a.g.position.y = Math.sin(t * .9 + a.ph) * .18 - .05; a.g.rotation.z = Math.sin(t * .7 + a.ph) * .035; a.g.rotation.x = Math.sin(t * .55 + a.ph * 2) * .02; }
      else if (a.k === 'flag') { const p = a.m.geometry.attributes.position, b = a.base; for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1], k = x / 1.8; p.setZ(i, Math.sin(x * 3 - t * (3 + ws)) * .12 * k * (.6 + ws * .15) + Math.sin(y * 4 + t * 2) * .03 * k); } p.needsUpdate = true; a.m.geometry.computeVertexNormals(); a.m.rotation.y = wa - Math.PI / 2; }
      else if (a.k === 'cloth') {
        /* roupa a secar: TODAS numa só malha instanciada (eram centenas de malhas → centenas de chamadas de desenho) */
        const C = G.cloth || (G.cloth = clothSetup(G));
        if (G.fxFrame % 2 === 0) { const e = C.e.set(Math.sin(t * (1.5 + ws * .3) + a.ph) * .08 * ws + Math.cos(a.yaw - wa) * ws * .05, a.yaw, 0, 'YXZ'); C.q.setFromEuler(e); C.m.compose(C.v.set(...a.p), C.q, C.s.set(a.w, a.h, 1)); C.im.setMatrixAt(a.ci, C.m); C.dirty = true; }
      }
      else if (a.k === 'lamp' && G.r3.night) { if (!a.s) { a.s = new THREE.Sprite(Arcade3D.glowSprite('#ffc878')); a.s.scale.setScalar(3.2); a.s.position.set(...a.p); G.r3.scene.add(a.s); const d = new THREE.Mesh(new THREE.CircleGeometry(5, 20), new THREE.MeshBasicMaterial({ map: Arcade3D.glowTex(), color: '#ffb860', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); d.rotation.x = -Math.PI / 2; d.position.set(a.p[0], G.hAt(a.p[0], a.p[2]) + .08, a.p[2]); G.r3.scene.add(d); } }
      else if (a.k === 'stagelight') { if (!a.s) { a.s = new THREE.Sprite(Arcade3D.glowSprite(a.c)); a.s.position.set(...a.p); G.r3.scene.add(a.s); } const k = .5 + .5 * Math.sin(t * 3 + a.p[0]); a.s.scale.setScalar(1.2 + k * 1.4); }
      else if (a.k === 'craneLight') { if (!a.s) { a.s = new THREE.Sprite(Arcade3D.glowSprite('#ff3a2a')); a.s.position.set(...a.p); G.r3.scene.add(a.s); } a.s.scale.setScalar(Math.sin(t * 3) > .6 ? 3 : .01); }
      else if (a.k === 'bunting' && G.fxFrame % 2 === 0) { const m4 = a._m || (a._m = new THREE.Matrix4()), q = a._q || (a._q = new THREE.Quaternion()), e2 = a._e || (a._e = new THREE.Euler()), v = a._v || (a._v = new THREE.Vector3()), one = a._s || (a._s = new THREE.Vector3(1, 1, 1)); a.flags.forEach((f, i) => { const sw = Math.sin(t * (2.2 + ws * .4) + i * .7) * (.15 + ws * .06) + ws * .05; e2.set(sw * Math.cos(f[3] - wa), f[3] + Math.PI / 2, 0, 'YXZ'); q.setFromEuler(e2); m4.compose(v.set(f[0], f[1], f[2]), q, one); a.im.setMatrixAt(i, m4); }); a.im.instanceMatrix.needsUpdate = true; }
      else if (a.k === 'pool' && !a.m) { const g = new THREE.PlaneGeometry(a.w - .04, a.d - .04); g.rotateX(-Math.PI / 2); const wm = G.r3.water.material.clone(); wm.color = new THREE.Color('#5ad0f0'); wm.opacity = .62; wm.normalMap = G.r3.water.material.normalMap; a.m = new THREE.Mesh(g, wm); a.m.position.set(...a.p); a.m.position.y -= .07; a.m.rotation.y = a.yaw; a.m.renderOrder = 2; G.r3.scene.add(a.m); }
    }
  }

  function clothSetup(G) {
    const L = G.anim.filter(a => a.k === 'cloth'), g = new THREE.PlaneGeometry(1, 1, 2, 3); g.translate(0, -.5, 0);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .9 }), Math.max(1, L.length)), c = new THREE.Color();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    L.forEach((a, i) => { a.ci = i; a.ph = Math.random() * 6; im.setColorAt(i, c.set(a.c)); m.compose(new THREE.Vector3(...a.p), q.setFromEuler(e.set(0, a.yaw, 0)), new THREE.Vector3(a.w, a.h, 1)); im.setMatrixAt(i, m); });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; G.r3.scene.add(im);
    return { im, e: new THREE.Euler(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), m: new THREE.Matrix4(), dirty: false };
  }
  /* ── objetivos, fim e falha ── */
  function objectives(G, dt) {
    if (G.done || G.failed) return;
    for (const o of G.obj) {
      if (!o.shown) { const dep = G.obj.find(x => x.id === o.after); if (dep && dep.done) { o.shown = true; if (o.onShow) o.onShow(G); sfx(G, 'obj'); } else continue; }
      if (!o.done && o.check(G)) { o.done = true; sfx(G, 'obj'); if (!o.opt) hint(G, '✔ ' + o.text, 3); else { G.score += 250; hint(G, '★ Extra: ' + o.text + ' (+250)', 3); } }
    }
    if (G.obj.filter(o => !o.opt).every(o => o.done)) { G.done = true; G.endT = 2.6; hint(G, 'Missão cumprida!', 3, true); sfx(G, 'win'); G.api.slowmo(.5, 1.2); }
  }
  function fail(G, why) { if (G.done || G.failed) return; G.failed = why; G.endT = 2.2; hint(G, '✖ ' + why, 3, true); }
  function finish(G, api) {
    if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) {}
    const s = G.stats, acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    if (G.failed) { api.over({ won: false, score: 0, record: false, icon: '💤', title: 'Missão falhada', sub: G.failed, stats: [['Adormecidos', s.sleeps], ['Pontaria', acc + '%'], ['Civis', s.civ]] }); return; }
    const stealth = !G.alarm, extra = G.obj.filter(o => o.opt && o.done).length;
    let score = G.score + (stealth ? 300 : 0) + Math.round(acc * 3) + Math.max(0, G.ammo) * 20;
    const stars = 1 + (stealth && s.civ === 0 ? 1 : 0) + (acc >= 60 && extra >= 1 ? 1 : 0);
    const p = prog(); p.u = Math.max(p.u, Math.min(LEVELS.length - 1, G.li + 1)); p.s[G.L.id] = Math.max(p.s[G.L.id] || 0, stars); p.b[G.L.id] = Math.max(p.b[G.L.id] || 0, score); saveProg(p);
    api.over({ won: true, score, stars, icon: '🦉', title: 'Missão cumprida!', sub: `${G.L.name}${stealth ? ' · sem alarme' : ''}`,
      stats: [['Adormecidos', s.sleeps], ['Pontaria', acc + '%'], ['Tiro mais longo', Math.round(s.longest) + ' m'], ['Chapéus ao ar', s.hats], ['Brindes', G.got + '/' + (G.collect ? G.collect.list.length : 0)], ['Civis', s.civ]],
      html: G.li < LEVELS.length - 1 ? `<p style="margin:.4rem 0 0;font-size:.85rem;opacity:.85">Próxima missão desbloqueada: <b>${LEVELS[G.li + 1].name}</b></p>` : '<p style="margin:.4rem 0 0;font-size:.85rem;opacity:.85">A Liga dos Bigodes está toda a dormir. 🦉💤</p>' });
  }
  function hint(G, text, d, big) { G.hints = G.hints.filter(h => h.text !== text); G.hints.push({ text, t: 0, d: d || 3, big }); if (G.hints.length > 3) G.hints.shift(); }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  function draw(G, ctx, Wl, Hl, api) {
    if (!G.ok) {
      const k = pxK(api), w = Wl / k, h = Hl / k; ctx.save(); ctx.scale(k, k);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2a3a'); g.addColorStop(1, '#0a1018'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 16px ${FONT}`; ctx.fillText(G.fail3d ? 'Não foi possível arrancar o 3D' : 'A preparar a missão…', w / 2, h / 2);
      if (G.fail3d) { ctx.font = `500 13px ${FONT}`; ctx.fillStyle = '#ffd9b0'; ctx.fillText(G.failMsg || 'Este jogo precisa de WebGL (3D).', w / 2, h / 2 + 26); }
      else { ctx.font = `500 13px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(G.L.name, w / 2, h / 2 + 24); }
      ctx.restore(); return;
    }
    const r3 = G.r3, cam = r3.cam, n = G.L.nest;
    fit(G, api);
    let dcam = G.dcam;
    if (G.dbgCam) { const b = G.dbgCam; cam.position.set(...b.p); cam.up.set(0, 1, 0); cam.lookAt(...b.l); cam.fov = b.fov || 40; cam.near = b.near || .1; cam.updateProjectionMatrix(); }
    else if (dcam) dartCam(G, cam);
    else {
      cam.position.set(n.x, n.y, n.z);
      const d = aimDir(G, _v1, true), sh = api.shakeXY;
      cam.up.set(0, 1, 0); cam.lookAt(n.x + d.x * 10 + sh[0] * .002, n.y + d.y * 10 + G.recoil * .25 + sh[1] * .002, n.z + d.z * 10);
      if (Math.abs(cam.fov - G.fov) > .01) { cam.fov = G.fov; cam.updateProjectionMatrix(); }
      /* plano de recorte próximo: quanto mais ampliado, mais longe (a precisão da profundidade cresce com ele e acaba o "tremer" ao longe) */
      const near = G.scope ? [2, 3.5, 5][G.zi] : G.bino ? 3 : .6; if (cam.near !== near) { cam.near = near; cam.updateProjectionMatrix(); }
    }
    cam.updateMatrixWorld();
    /* pessoas: poses */
    const PPx = PP(), Q0 = {};
    for (const P of G.people) {
      if (P.hidden) { if (!P._hid) { G.crowd.hide(P); P._hid = true; } continue; }
      P._hid = false;
      const Q = pose(G, P, PPx);
      P.q = Q; G.crowd.pose(P, Q);
    }
    G.crowd.flush();
    emotesDraw(G);
    /* céu, água, sombras à volta do ponto de mira */
    r3.skyM.position.copy(cam.position); r3.skyM.material.uniforms.uTime.value = G.t;
    const nm = r3.water.material.normalMap; nm.offset.x = (G.gt * .004) % 1; nm.offset.y = (G.gt * .0025) % 1;
    /* sombras: a caixa de sombra segue o ponto de mira em degraus (tamanho) e encaixa na grelha de texels NO ESPAÇO DA LUZ
       — antes encaixava em x/z do mundo e as bordas das sombras "nadavam" ao mexer a mira */
    const ap = G.dbgCam ? { x: G.dbgCam.l[0], y: G.dbgCam.l[1], z: G.dbgCam.l[2] } : dcam ? (dcam.dart.hitAt || dcam.dart.p) : aimGround(G), ext = clamp((G.range || 120) * Math.tan(cam.fov * Math.PI / 360) * 1.6, 30, 260);
    const ext2 = ext < 60 ? 40 : ext < 120 ? 90 : ext < 190 ? 160 : 260, texel = ext2 * 2 / r3.sun.shadow.mapSize.x;
    if (!r3.lb) { const f = r3.sunDir.clone().negate(), up = Math.abs(f.y) > .99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), rx = new THREE.Vector3().crossVectors(up, f).normalize(); r3.lb = { rx, ry: new THREE.Vector3().crossVectors(f, rx).normalize(), f }; }
    const lb = r3.lb, apv = _v3.set(ap.x, ap.y || 0, ap.z), u = Math.round(apv.dot(lb.rx) / texel) * texel, v = Math.round(apv.dot(lb.ry) / texel) * texel, w0 = apv.dot(lb.f);
    const ctr = _v4.copy(lb.rx).multiplyScalar(u).addScaledVector(lb.ry, v).addScaledVector(lb.f, w0);
    r3.sun.position.copy(ctr).addScaledVector(r3.sunDir, 600); r3.sun.target.position.copy(ctr);
    if (r3.ext2 !== ext2) { r3.ext2 = ext2; const scm = r3.sun.shadow.camera; scm.left = -ext2; scm.right = ext2; scm.top = ext2; scm.bottom = -ext2; scm.near = 10; scm.far = 1600; scm.updateProjectionMatrix(); r3.sun.shadow.normalBias = .02 + texel * .6; r3.sun.shadow.bias = -.0002; }
    if (G.fxFrame % 30 === 0) r3.clouds.sort(cam);
    const ppu = r3.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    r3.smoke.mat.uniforms.uScale.value = ppu; r3.spark.mat.uniforms.uScale.value = ppu;
    /* rasto do dardo */
    trailDraw(G);
    /* visão noturna */
    const nv = G.nv && (G.scope || G.bino) && !dcam;
    r3.renderer.toneMappingExposure = r3.sky.exp * (nv ? 5 : 1);
    const ren = r3.renderer;
    ren.autoClear = false; ren.clear();
    ren.render(r3.scene, cam);
    if (G.pip && !dcam && !G.dbgCam) pipRender(G, ren);
    /* espingarda (só sem mira) */
    if (!G.scope && !G.bino && !dcam && !G.dbgCam) {
      const fp = G.fp; fp.cam.aspect = cam.aspect; fp.cam.updateProjectionMatrix();
      const b = G.bolt > 0 ? Math.sin((1 - G.bolt / .95) * Math.PI) : 0, rl = G.reload > 0 ? Math.sin(clamp(1 - G.reload / 1.8, 0, 1) * Math.PI) : 0;
      fp.g.position.set(.24 + G.sway.x * 3, -.2 - G.sway.y * 3 - rl * .12 - b * .02, -.5 + G.recoil * .05);
      fp.g.rotation.set(G.recoil * .12 + rl * .5, b * .1, -rl * .4);
      fp.bolt.rotation.x = b * 1.2;
      ren.clearDepth(); ren.render(fp.scene, fp.cam);
    }
    ren.autoClear = true;
    hud(G, ctx, Wl, Hl, api);
  }
  function aimGround(G) { const c = G.r3.cam.position, d = aimDir(G, { x: 0, y: 0, z: 0 }, false), r = G.range || 150; return { x: c.x + d.x * r, y: c.y + d.y * r, z: c.z + d.z * r }; }
  function fit(G, api) {
    const r3 = G.r3, st = api.stage, w = st.clientWidth || 1, h = st.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, r3.coarse ? 1.5 : 1.75);
    if (w !== r3.w || h !== r3.h || dpr !== r3.dpr) { r3.w = w; r3.h = h; r3.dpr = dpr; r3.renderer.setPixelRatio(dpr); r3.renderer.setSize(w, h, false); r3.cam.aspect = w / h; r3.cam.updateProjectionMatrix(); }
  }
  /* câmara que segue o dardo e roda à volta dele */
  function dartCam(G, cam) {
    const D = G.dcam, dt = D.dart, p = dt.alive ? dt.p : dt.hitAt || dt.p, v = dt.v, sp = Math.hypot(v.x, v.y, v.z) || 1, ux = v.x / sp, uy = v.y / sp, uz = v.z / sp;
    if (dt.alive) {
      /* atrás e ao lado do dardo; perto do fim a câmara abre para o lado e vira-se para o alvo */
      const k = clamp(dt.t / Math.max(.05, D.hitT), 0, 1), e = k * k, rx = -uz, rz = ux, rl = Math.hypot(rx, rz) || 1;
      const back = lerp(2.3, 1.7, e), side = lerp(.32, .62, e) * D.side, up = lerp(.22, .3, e) + Math.sin(D.t * 1.3) * .05;
      cam.position.set(p.x - ux * back + rx / rl * side, p.y - uy * back + up, p.z - uz * back + rz / rl * side);
      const T = D.P && D.P.j ? D.P.j.chest : null, ah = 12;
      const lx = p.x + ux * ah, ly = p.y + uy * ah, lz = p.z + uz * ah;
      if (T) cam.lookAt(lerp(lx, T.x, e), lerp(ly, T.y, e), lerp(lz, T.z, e)); else cam.lookAt(lx, ly, lz);
      if (Math.random() < .7) G.r3.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, life: .5, s0: .04, s1: .25, c0: '#ffffff', a: .25 });
      D.last = cam.position.clone();
      if (cam.fov !== 42) { cam.fov = 42; cam.updateProjectionMatrix(); }
    } else {
      /* depois do impacto: orbita devagar a ver o alvo a adormecer */
      const P = D.P, c = P && P.j ? P.j.chest : p, k = D.after || 0;
      if (!D.orb) D.orb = { a: Math.atan2(D.last.x - c.x, D.last.z - c.z), r: 3.4 };
      const a = D.orb.a + k * .35, r = D.orb.r + k * .4;
      cam.position.set(c.x + Math.sin(a) * r, c.y + 1 + k * .25, c.z + Math.cos(a) * r);
      cam.lookAt(c.x, c.y - .2, c.z);
    }
    if (cam.near !== .15) { cam.near = .15; cam.updateProjectionMatrix(); }
  }
  function trailDraw(G) {
    const r3 = G.r3;
    if (!r3.trail) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)); r3.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 })); r3.trail.frustumCulled = false; r3.scene.add(r3.trail); r3.dartM = new THREE.Mesh(PP().geos().dart, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4 })); r3.dartM.scale.setScalar(1.4); r3.scene.add(r3.dartM); }
    const D = G.darts.find(d => d.alive);
    r3.trail.visible = !!D && !!G.dcam; r3.dartM.visible = !!D;
    if (!D) return;
    const a = r3.trail.geometry.attributes.position; D.trail.forEach((p, i) => a.setXYZ(i, p[0], p[1], p[2])); for (let i = D.trail.length; i < 40; i++) a.setXYZ(i, D.p.x, D.p.y, D.p.z); a.needsUpdate = true; r3.trail.geometry.setDrawRange(0, Math.max(2, D.trail.length));
    r3.dartM.position.set(D.p.x, D.p.y, D.p.z); r3.dartM.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-D.v.x, -D.v.y, -D.v.z).normalize());
  }
  /* atividades que precisam das mãos: a espingarda vai para as costas */
  const GUN_HANDS = { radio: 1, bino: 1, point: 1, light: 1, talk: 1, cup: 1, phone: 1, vendor: 1, sweep: 1, wave: 1, cheer: 1, clap: 1, drive: 1 };
  /* pose de cada pessoa a partir do estado */
  function pose(G, P, X) {
    const Q = {}, t = P.t, s = P.seed;
    if (P.sleep) {
      if (P.sitting && P.mode !== 'walk') { X.sit(Q, t, s); const k = clamp(P.sleepT / 1.6, 0, 1); Q.headP = .7 * k; Q.headR = .35 * k * P.fallSide; Q.side = .18 * k * P.fallSide; Q.eyes = 1 - k * .95; Q.yawn = Math.sin(clamp(P.sleepT / 1.2, 0, 1) * Math.PI); Q.lSh = .1; Q.rSh = .1; Q.lEl = .3; Q.rEl = .3; Q.breath = Math.sin(t * 1.1) * .5 + .5; }
      else X.sleepPose(Q, P, t);
      return Q;
    }
    const gun = P.look.gun;
    if (P.mode === 'walk') {
      /* a fase da passada avança com a distância real percorrida: os pés não escorregam */
      const vr = Math.hypot(P.vx || 0, P.vz || 0); P.vs = lerp(P.vs || vr, Math.min(vr, 7), .2);
      const v = Math.max(.3, P.vs); P.ph = (P.ph + v * G.dtv / (X.stride(v) * (P.s || 1)) * TAU) % (TAU * 64); X.walk(Q, P.ph, v);
      const pr = P.look.prop; if (pr === 'case') X.ACT.case(Q); else if (pr === 'light') X.ACT.light(Q, t, s); else if (pr === 'balloon') X.ACT.balloon(Q); else if (P.walkAct === 'phone' && pr === 'phone') { Q.rSh = .35; Q.rAb = .55; Q.rEl = 2.35; Q.rTw = -.5; }
      if (gun) Q.gun = pr === 'light' ? 'back' : 'held';
    } else if (P.mode === 'sit') X.sit(Q, t, s, P.act);
    else if (P.mode === 'recline') X.recline(Q, t, s);
    else if (P.mode === 'shake') X.shake(Q, t);
    else if (P.mode === 'crouch') {
      X.crouch(Q, t, s);
      /* alarme: de joelho, a apontar a espingarda para o ninho */
      if (gun) { const n = G.L.nest, d = Math.hypot(n.x - P.x, n.z - P.z); Q.gun = 'aim'; Q.aimP = clamp(Math.atan2(n.y - P.y - 1.1, d) + (Q.lean || 0), -.6, 1.1); Q.headY = 0; Q.headP = -.1; }
    }
    else { X.idle(Q, t, s, P); const a = P.act || 'listen'; if (X.ACT[a]) X.ACT[a](Q, t, s); const pr = P.look.prop; if (pr === 'balloon' && a !== 'dance') X.ACT.balloon(Q); if (pr === 'light') X.ACT.light(Q, t, s); if (gun) Q.gun = GUN_HANDS[a] || pr === 'light' ? 'back' : 'held'; }
    /* cabeça para onde olha (quem fala com alguém) */
    if (P.lookP && P.mode !== 'walk' && !P.lookP.hidden) { const a = Ut.angDiff(Math.atan2(P.lookP.x - P.x, P.lookP.z - P.z), P.yaw); Q.headY = clamp(a, -1.1, 1.1); }
    P.headYaw = Q.headY || 0;
    return Q;
  }

  /* ── HUD em 2D ── */
  function hud(G, ctx, Wl, Hl, api) {
    const k = pxK(api), w = Wl / k, h = Hl / k, cam = G.r3.cam; ctx.save(); ctx.scale(k, k);
    const proj = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(cam); return v.z < 1 ? { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h } : null; };
    if (G.dcam) {
      const bar = h * .1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar);
      ctx.fillStyle = '#fff'; ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('CÂMARA DO DARDO  ·  ' + Math.round(G.dcam.d) + ' m', 16, h - bar / 2 + 4);
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `600 11px ${FONT}`; ctx.fillText('clica para saltar', w - 16, h - bar / 2 + 4);
      floats(G, ctx, proj); hints(G, ctx, w, h); ctx.restore(); return;
    }
    /* marcadores dos alvos marcados */
    for (const P of G.people) {
      if (!P.marked || P.hidden || !P.j) continue;
      const p = proj(P.j.head.x, P.j.head.y + .55, P.j.head.z); if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
      const c = P.sleep ? '#8ab0ff' : P.vip ? '#ffcf2a' : P.role === 'civ' ? '#9aa4b0' : '#ff5a4a', s = 7;
      ctx.fillStyle = c; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s * 1.4); ctx.lineTo(p.x + s, p.y - s * 1.4); ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.stroke(); ctx.fill();
      if (G.scope || G.bino || P.vip) { ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeText(P.sleep ? 'a dormir' : P.name, p.x, p.y - s * 1.4 - 5); ctx.fillText(P.sleep ? 'a dormir' : P.name, p.x, p.y - s * 1.4 - 5); }
    }
    floats(G, ctx, proj);
    if (G.scope || G.bino) scopeHud(G, ctx, w, h, proj); else hipHud(G, ctx, w, h);
    threats(G, ctx, w, h); pipHud(G, ctx);
    /* objetivos (canto superior esquerdo) */
    const ob = G.obj.filter(o => o.shown);
    ctx.font = `600 12px ${FONT}`; let bw = 0; ob.forEach(o => { bw = Math.max(bw, ctx.measureText(o.text + (o.prog ? '  ' + o.prog(G) : '')).width); });
    const ox = 12, oy = 58, bx = Math.min(bw + 40, w * .55);
    ctx.fillStyle = 'rgba(8,14,22,.55)'; Ut.rr(ctx, ox, oy, bx, 14 + ob.length * 19 + (G.timer > 0 ? 18 : 0), 10); ctx.fill();
    ob.forEach((o, i) => { const y = oy + 19 + i * 19; ctx.fillStyle = o.done ? '#7ae08a' : o.opt ? '#c8d0dc' : '#ffffff'; ctx.textAlign = 'left'; ctx.fillText((o.done ? '✔ ' : o.opt ? '☆ ' : '▸ ') + o.text + (o.prog && !o.done ? '  ' + o.prog(G) : ''), ox + 10, y, bx - 18); });
    if (G.timer > 0) { const y = oy + 19 + ob.length * 19, m = Math.floor(G.timer / 60), s = Math.floor(G.timer % 60); ctx.fillStyle = G.timer < 30 ? '#ff8a7a' : '#ffd88a'; ctx.fillText(`⏱ ${m}:${String(s).padStart(2, '0')}`, ox + 10, y); }
    /* alerta */
    if (G.alarm || G.sus > .05) {
      const cx = w / 2, y = 58, bwid = 150;
      ctx.fillStyle = 'rgba(8,14,22,.55)'; Ut.rr(ctx, cx - bwid / 2 - 8, y - 4, bwid + 16, 26, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.15)'; Ut.rr(ctx, cx - bwid / 2, y + 10, bwid, 6, 3); ctx.fill();
      ctx.fillStyle = G.alarm ? (Math.sin(G.t * 10) > 0 ? '#ff3030' : '#ff8a30') : '#ffb02a'; Ut.rr(ctx, cx - bwid / 2, y + 10, bwid * (G.alarm ? 1 : G.sus), 6, 3); ctx.fill();
      ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(G.alarm ? 'ALARME!' : 'SUSPEITA', cx, y + 6);
    }
    /* vento */
    const wd = windAt(G, G.gt), wx = w - 56, wy = 92, rel = Math.atan2(wd.x, wd.z) - (G.yaw);
    ctx.fillStyle = 'rgba(8,14,22,.55)'; ctx.beginPath(); ctx.arc(wx, wy, 28, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(Math.PI - rel); ctx.fillStyle = wd.s < .2 ? '#7a8490' : '#9ae0ff'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(7, 4); ctx.lineTo(2, 2); ctx.lineTo(2, 14); ctx.lineTo(-2, 14); ctx.lineTo(-2, 2); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(wd.s < .2 ? 'sem vento' : 'vento ' + wd.s.toFixed(1) + ' m/s', wx, wy + 44);
    /* dardos */
    const dx = w - 18, dy = h - 26;
    ctx.textAlign = 'right'; ctx.font = `800 14px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(`${G.mag} | ${Math.max(0, G.ammo - G.mag)}`, dx, dy);
    for (let i = 0; i < 5; i++) { const x = dx - 70 - i * 11; ctx.fillStyle = i < G.mag ? '#ff4a7a' : 'rgba(255,255,255,.2)'; ctx.fillRect(x, dy - 14, 4, 13); ctx.fillStyle = i < G.mag ? '#ffd040' : 'rgba(255,255,255,.15)'; ctx.fillRect(x, dy - 4, 4, 3); }
    if (G.reload > 0) { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(dx - 120, dy + 6, 120, 4); ctx.fillStyle = '#ffd040'; ctx.fillRect(dx - 120, dy + 6, 120 * (1 - G.reload / 1.8), 4); ctx.font = `600 10px ${FONT}`; ctx.fillText('a recarregar', dx, dy - 22); }
    if (!G.lock && !G.touch && !Arcade3D.coarse() && !G.noLockHint) { ctx.textAlign = 'center'; ctx.font = `700 13px ${FONT}`; ctx.fillStyle = 'rgba(0,0,0,.5)'; Ut.rr(ctx, w / 2 - 130, h - 92, 260, 28, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('Clica no ecrã para controlar a mira', w / 2, h - 73); }
    hints(G, ctx, w, h);
    ctx.restore();
  }
  function floats(G, ctx, proj) {
    ctx.textAlign = 'center';
    G.fx.forEach(f => { const p = proj(f.x, f.y, f.z); if (!p) return; const k = f.t / 1.8; ctx.globalAlpha = Math.min(1, (1 - k) * 3); ctx.font = `800 ${f.size}px ${FONT}`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)'; const y = p.y - k * 40; ctx.strokeText(f.text, p.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, y); });
    ctx.globalAlpha = 1;
  }
  function hints(G, ctx, w, h) {
    G.hints.forEach((hn, i) => {
      const a = Math.min(1, hn.t * 5, (hn.d - hn.t) * 2.5), y = h * (hn.big ? .3 : .78) + i * 30 * (hn.big ? 1 : -1);
      ctx.globalAlpha = a; ctx.font = `${hn.big ? 800 : 700} ${hn.big ? 18 : 14}px ${FONT}`; ctx.textAlign = 'center';
      const tw = Math.min(w - 30, ctx.measureText(hn.text).width + 30); ctx.fillStyle = 'rgba(8,14,22,.6)'; Ut.rr(ctx, w / 2 - tw / 2, y - (hn.big ? 18 : 15), tw, hn.big ? 30 : 26, 9); ctx.fill();
      ctx.fillStyle = hn.big ? '#ffe9a8' : '#fff'; ctx.fillText(hn.text, w / 2, y + (hn.big ? 3 : 2), w - 40);
    });
    ctx.globalAlpha = 1;
  }
  function hipHud(G, ctx, w, h) {
    const cx = w / 2, cy = h / 2, g = 8 + G.recoil * 10;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath();
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([a, b]) => { ctx.moveTo(cx + a * g, cy + b * g); ctx.lineTo(cx + a * (g + 8), cy + b * (g + 8)); }); ctx.stroke();
    ctx.fillStyle = '#ff4a6a'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
    if (!G.firstShot) { ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(G.touch ? '🔭 para a mira · 👁 binóculos' : 'Botão direito = mira  ·  B = binóculos  ·  Shift = suster a respiração', cx, h - 40); }
  }
  /* luneta / binóculos */
  function scopeHud(G, ctx, w, h, proj) {
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .46, bino = G.bino;
    /* visão noturna */
    if (G.nv) { ctx.fillStyle = 'rgba(40,255,90,.22)'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = .08; for (let y = 0; y < h; y += 3) { ctx.fillStyle = '#000'; ctx.fillRect(0, y, w, 1); } ctx.globalAlpha = 1; }
    ctx.save(); ctx.fillStyle = '#000';
    if (bino) {
      const mc = G._mask || (G._mask = document.createElement('canvas')), k2 = ctx.getTransform().a;
      if (mc.width !== Math.round(w * k2) || mc.height !== Math.round(h * k2)) { mc.width = Math.round(w * k2); mc.height = Math.round(h * k2); const m = mc.getContext('2d'); m.scale(k2, k2); m.fillStyle = '#000'; m.fillRect(0, 0, w, h); m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.ellipse(cx - R * .52, cy, R * .62, R * .7, 0, 0, TAU); m.fill(); m.beginPath(); m.ellipse(cx + R * .52, cy, R * .62, R * .7, 0, 0, TAU); m.fill(); m.globalCompositeOperation = 'source-over'; const vg2 = m.createRadialGradient(cx, cy, R * .5, cx, cy, R * 1.3); vg2.addColorStop(0, 'rgba(0,0,0,0)'); vg2.addColorStop(1, 'rgba(0,0,0,.6)'); m.fillStyle = vg2; m.fillRect(0, 0, w, h); }
      ctx.drawImage(mc, 0, 0, w, h);
    } else { ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(cx, cy, R, 0, TAU); ctx.fill('evenodd'); }
    const vg = ctx.createRadialGradient(cx, cy, R * .78, cx, cy, R * 1.02); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)');
    if (!bino) { ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,170,220,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R - 1.5, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const ppm = (h / 2) / Math.tan(G.r3.cam.fov * Math.PI / 360) * .001;   /* píxeis por miliradiano */
    if (!bino) {
      /* retícula duplex com pontos de referência (mil-dots) */
      ctx.strokeStyle = '#0a0a0a'; ctx.fillStyle = '#0a0a0a';
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx - R * .45, cy); ctx.moveTo(cx + R * .45, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy + R); ctx.lineTo(cx, cy + R * .45); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy - R * .45); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - R * .45, cy); ctx.lineTo(cx + R * .45, cy); ctx.moveTo(cx, cy - R * .45); ctx.lineTo(cx, cy + R * .45); ctx.stroke();
      for (let m = 1; m <= 10; m++) { const d = m * ppm * 2; if (d > R * .45) break; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.arc(cx + a * d, cy + b * d, m % 5 ? 1.8 : 2.6, 0, TAU); ctx.fill(); } }
      ctx.font = `600 9px ${FONT}`; ctx.textAlign = 'left'; for (let m = 1; m <= 5; m++) { const d = m * 2 * ppm * 2; if (d > R * .45) break; ctx.fillText(String(m * 2 * 2), cx + 4, cy + d + 3); }
      ctx.fillStyle = '#ff2a4a'; ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, TAU); ctx.fill();
      /* ponto de impacto previsto (fácil) */
      if (G.diff === 'easy') { if (G.fxFrame % 3 === 0) G.ip = impactPoint(G); if (G.ip) { const p = proj(G.ip.x, G.ip.y, G.ip.z); if (p) { ctx.strokeStyle = '#ff3a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.stroke(); } } }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14); ctx.stroke();
      /* marcar quem está no centro */
      const P = G.aimP && G.range && G.aimP.j ? G.aimP : null; let tgt = null;
      if (P) { const p = proj(P.j.chest.x, P.j.chest.y, P.j.chest.z); if (p && Math.hypot(p.x - cx, p.y - cy) < 40) tgt = P; }
      if (tgt) { G.markT = (G.markP === tgt ? G.markT : 0) + G.dtv / Math.max(.05, G.timeScale); G.markP = tgt; const k = Math.min(1, G.markT / .45); ctx.strokeStyle = tgt.role === 'civ' ? '#c8d0dc' : '#ffcf2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke(); if (k >= 1 && !tgt.marked) { tgt.marked = true; sfx(G, 'mark'); } ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(tgt.marked ? `${tgt.name}${tgt.role === 'civ' ? ' (civil)' : ''}` : 'a identificar…', cx, cy + 48); }
      else { G.markT = 0; G.markP = null; }
      const C = G.collect; if (C && !tgt) { const nm = { duck: '🦆 Pato de borracha', balloon: '🎈 Balão', gnome: '🧙 Gnomo', lantern: '🏮 Lanterna' }[C.kind] || 'Brinde';
        for (const T of G.targets) { if (T.done || !T.m) continue; const p = proj(T.m.position.x, T.m.position.y, T.m.position.z); if (p && Math.hypot(p.x - cx, p.y - cy) < 46) { ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#a8f0ff'; ctx.fillText(nm + ' — acerta-lhe com um dardo!', cx, cy + 48); ctx.strokeStyle = '#a8f0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.stroke(); break; } } }
    }
    /* leituras */
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = '#d8ffd8'; ctx.textAlign = 'center';
    const by = cy + R * (bino ? .78 : .74), rng = G.range ? Math.round(G.range) + ' m' : '— m';
    if (bino) ctx.fillText(`${BINO}×  ·  ${rng}`, cx, by);
    else ctx.fillText(`${ZOOMS[G.zi]}×   ·   ${rng}   ·   zero ${G.diff === 'easy' ? 'auto' : G.zero + ' m'}`, cx, by);
    /* respiração */
    if (!bino) {
      const ax = cx - R * .62, ay = cy + R * .62; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(ax, ay, 14, 0, TAU); ctx.stroke();
      ctx.strokeStyle = G.gasp ? '#ff6a5a' : G.holding ? '#9ae0ff' : '#ffffff'; ctx.beginPath(); ctx.arc(ax, ay, 14, -Math.PI / 2, -Math.PI / 2 + TAU * G.breath); ctx.stroke();
      ctx.font = `600 9px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(G.touch ? '🫁' : 'Shift', ax, ay + 3);
    }
    if (G.L.tod === 'night' && !G.touch) { ctx.font = `600 10px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('N = visão noturna', cx, cy - R * .8); }
  }

  /* ════════════════════════════════════════════════════════════════
     entrada: rato com captura do ponteiro, toque, teclado
  ════════════════════════════════════════════════════════════════ */
  function cvOf(api) { return api.stage && api.stage.querySelector('.ak-cv'); }
  function lockReq(G, api) { const c = cvOf(api); if (!c || !c.requestPointerLock || Arcade3D.coarse()) return; try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; } }
  function lookBy(G, dx, dy, k) { const s = (G.fov / FOV) * (k || .0022); G.yaw -= dx * s; G.pitch -= dy * s; clampView(G); }
  function down(G, x, y, api, e) {
    if (!G.ok) return;
    if (G.dcam) { G.dcam = null; return; }
    const mouse = !e || e.pointerType === 'mouse';
    if (!mouse) { G.touch = true; G.drag = { x, y, id: e.pointerId }; return; }
    if (!G.lock && !G.noLock) { lockReq(G, api); return; }
    if (e.button === 2) { toggleScope(G); return; }
    if (e.button === 0) { if (G.lock) fire(G); else G.drag = { x, y, x0: x, y0: y, mouse: true }; }
  }
  function move(G, x, y, api, e) {
    if (!G.ok) return;
    if (G.lock && e && e.movementX != null) { lookBy(G, e.movementX, e.movementY); return; }
    if (G.drag && (!e || e.pointerId === G.drag.id || G.drag.mouse)) { const k = 1 / pxK(api); lookBy(G, (x - G.drag.x) * k, (y - G.drag.y) * k, .0034); G.drag.x = x; G.drag.y = y; }
  }
  function up(G, x, y, api, e) {
    if (G.drag && G.drag.mouse && Math.hypot(x - G.drag.x0, y - G.drag.y0) < 6) fire(G);
    G.drag = null;
  }
  function toggleScope(G) { if (G.bino) G.bino = false; G.scope = G.scope ? 0 : 1; sfx(G, 'scope'); }
  function key(G, e) {
    const c = e.code || ''; G.keys[c] = true;
    if (!G.ok) return;
    if (G.dcam && (c === 'Space' || c === 'Enter')) { G.dcam = null; return true; }
    if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'Space') G.holding = true;
    if (e.repeat) return ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c);
    if (c === 'KeyB') { G.bino = !G.bino; if (G.bino) G.scope = 0; sfx(G, 'scope'); }
    if (c === 'KeyF' || c === 'KeyX') toggleScope(G);
    if (c === 'KeyZ') measure(G);
    if (c === 'KeyR') startReload(G);
    if (c === 'KeyN') { G.nv = !G.nv; sfx(G, 'scope'); }
    if (c === 'KeyQ' || c === 'Minus' || c === 'NumpadSubtract') zoom(G, -1);
    if (c === 'KeyE' || c === 'Equal' || c === 'NumpadAdd') zoom(G, 1);
    if (c === 'KeyC') { G.camMode = G.camMode === 'off' ? 'on' : G.camMode === 'on' ? 'all' : 'off'; hint(G, 'Câmara do dardo: ' + ({ off: 'desligada', on: 'tiros bons', all: 'sempre' })[G.camMode], 1.6); }
    if (c === 'Enter' && G.lock) fire(G);
    return ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c);
  }
  function keyup(G, e) { if (!e.code) { G.keys = {}; G.holding = false; return; } G.keys[e.code] = false; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') G.holding = false; }
  function zoom(G, d) { if (!G.scope) { if (d > 0) { G.scope = 1; sfx(G, 'scope'); } return; } const z = clamp(G.zi + d, 0, ZOOMS.length - 1); if (z !== G.zi) { G.zi = z; sfx(G, 'zoom'); } else if (d < 0) { G.scope = 0; sfx(G, 'scope'); } }
  function measure(G) { if (G.diff === 'easy') { hint(G, 'No modo fácil a zeragem é automática.', 1.8); return; } const r = G.range; if (!r) { hint(G, 'Aponta para algo para medir a distância', 1.8); return; } G.zero = clamp(Math.round(r / 25) * 25, 50, 900); sfx(G, 'zoom'); hint(G, `Zeragem: ${G.zero} m`, 1.4); }
  /* botões de toque (DOM por cima do palco) */
  function buildUI(G, api) {
    const st = api.stage; if (!st || G.ui) return;
    const ui = document.createElement('div'); ui.className = 'sn-ui';
    ui.innerHTML = `<style>
.sn-ui{position:absolute;inset:0;pointer-events:none;z-index:3;font-family:${FONT}}
.sn-ui button{pointer-events:auto;position:absolute;border:0;border-radius:50%;background:rgba(10,16,24,.55);color:#fff;font:800 13px ${FONT};backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.35);touch-action:none;-webkit-user-select:none;user-select:none}
.sn-ui button.on{background:rgba(255,160,40,.8)}
.sn-ui .fire{width:84px;height:84px;right:22px;bottom:70px;background:rgba(255,70,110,.78);font-size:15px}
.sn-ui .sc{width:56px;height:56px;right:118px;bottom:84px}.sn-ui .zi{width:44px;height:44px;right:30px;bottom:166px}.sn-ui .zo{width:44px;height:44px;right:84px;bottom:156px}
.sn-ui .br{width:56px;height:56px;left:20px;bottom:76px}.sn-ui .bn{width:48px;height:48px;left:24px;bottom:146px}.sn-ui .zr{width:44px;height:44px;left:84px;bottom:90px}.sn-ui .nv{width:44px;height:44px;left:84px;bottom:146px}
@media (pointer:fine){.sn-ui:not(.touch) button{display:none}}
@media (max-height:520px){.sn-ui .fire{width:66px;height:66px;bottom:16px;right:14px}.sn-ui .sc{width:46px;height:46px;bottom:22px;right:88px}.sn-ui .zi{width:38px;height:38px;bottom:92px;right:20px}.sn-ui .zo{width:38px;height:38px;bottom:92px;right:64px}.sn-ui .br{width:48px;height:48px;bottom:18px;left:14px}.sn-ui .bn{width:40px;height:40px;bottom:76px;left:18px}.sn-ui .zr{width:38px;height:38px;bottom:24px;left:70px}.sn-ui .nv{width:38px;height:38px;bottom:76px;left:66px}}
</style>
<button class="fire" data-b="fire">DISPARA</button><button class="sc" data-b="scope">🔭</button><button class="zi" data-b="zin">＋</button><button class="zo" data-b="zout">－</button>
<button class="br" data-b="breath">🫁</button><button class="bn" data-b="bino">👁</button><button class="zr" data-b="zero">📏</button>${G.L.tod === 'night' ? '<button class="nv" data-b="nv">🌙</button>' : ''}`;
    st.appendChild(ui); G.ui = ui;
    const on = (b, fn, upFn) => { const el = ui.querySelector(`[data-b="${b}"]`); if (!el) return; el.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); G.touch = true; ui.classList.add('touch'); fn(el); }); if (upFn) ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, ev => { ev.preventDefault(); upFn(el); })); };
    on('fire', () => { if (G.dcam) G.dcam = null; else fire(G); });
    on('scope', el => { toggleScope(G); el.classList.toggle('on', !!G.scope); });
    on('zin', () => zoom(G, 1)); on('zout', () => zoom(G, -1));
    on('breath', el => { G.holding = true; el.classList.add('on'); }, el => { G.holding = false; el.classList.remove('on'); });
    on('bino', el => { G.bino = !G.bino; if (G.bino) G.scope = 0; el.classList.toggle('on', G.bino); sfx(G, 'scope'); });
    on('zero', () => measure(G)); on('nv', el => { G.nv = !G.nv; el.classList.toggle('on', G.nv); });
    if (Arcade3D.coarse()) { ui.classList.add('touch'); G.touch = true; }
    /* roda do rato = ampliação; captura do ponteiro */
    const wh = e => { if (!G.ok) return; e.preventDefault(); zoom(G, e.deltaY < 0 ? 1 : -1); };
    st.addEventListener('wheel', wh, { passive: false });
    const plc = () => { const l = document.pointerLockElement === cvOf(api); if (G.lock && !l && !G.done && !G.failed && api.state === 'play') { const pb = st.querySelector('[data-a="pause"]'); pb && pb.click(); } G.lock = l; };
    document.addEventListener('pointerlockchange', plc);
    G._off = () => { st.removeEventListener('wheel', wh); document.removeEventListener('pointerlockchange', plc); };
  }

  /* ════════════════════════════════════════════════════════════════
     som (sintetizado)
  ════════════════════════════════════════════════════════════════ */
  function sfx(G, k, at) {
    const s = G.api.sfx; let v = 1;
    if (at && G.r3) { const d = Math.hypot(at.x - G.r3.cam.position.x, at.z - G.r3.cam.position.z); v = clamp(1 - d / 600, .15, 1); }
    if (k === 'shot') { s.noise(.12, .12, 0, 1800, 'highpass'); s.tone(180, .1, 'triangle', .05, 0, 90); s.noise(.25, .04, .02, 600, 'lowpass'); }
    else if (k === 'bolt') { s.tone(1400, .03, 'square', .03); s.tone(900, .04, 'square', .03, .09); }
    else if (k === 'reload') { s.tone(700, .04, 'square', .03); s.tone(1100, .03, 'square', .03, .3); s.tone(500, .05, 'square', .03, .9); }
    else if (k === 'empty') s.tone(1600, .02, 'square', .03);
    else if (k === 'scope') s.tone(2200, .02, 'sine', .02);
    else if (k === 'zoom') s.tone(1600, .03, 'triangle', .025);
    else if (k === 'hit') { s.tone(520, .08, 'sine', .07, 0, 880); s.tone(1240, .05, 'sine', .03, .05); }
    else if (k === 'yawn') { s.tone(320, .7, 'sine', .05, 0, 170); s.tone(400, .5, 'triangle', .025, .1, 220); }
    else if (k === 'thunk') s.noise(.12, .08 * v, 0, 500, 'lowpass');
    else if (k === 'splash') s.noise(.35, .07 * v, 0, 1400);
    else if (k === 'pop') { s.noise(.08, .1, 0, 2500, 'highpass'); s.tone(900, .06, 'sine', .04, 0, 300); }
    else if (k === 'quack') { s.tone(560, .12, 'sawtooth', .05, 0, 420); s.tone(520, .12, 'sawtooth', .05, .16, 380); }
    else if (k === 'chime') s.arp([1047, 1319, 1568], .06, .2, 'triangle', .05);
    else if (k === 'mark') s.tone(1760, .05, 'sine', .04);
    else if (k === 'spot') s.tone(880, .15, 'square', .03, 0, 1320);
    else if (k === 'radio') { s.noise(.5, .04, 0, 2200); s.tone(1200, .08, 'square', .02, .1); }
    else if (k === 'alarm') { for (let i = 0; i < 4; i++) s.tone(660, .35, 'sawtooth', .05, i * .7, 990); }
    else if (k === 'obj') s.arp([659, 880], .08, .15, 'triangle', .05);
    else if (k === 'win') s.arp([523, 659, 784, 1047, 1319], .1, .25, 'triangle', .06);
    else if (k === 'gasp') s.noise(.5, .05, 0, 800);
    else if (k === 'flap') s.noise(.3, .03 * v, 0, 1800);
    else if (k === 'pss') s.noise(.8, .06, 0, 3000, 'highpass');
    else if (k === 'bell') { s.tone(392, 2.2, 'sine', .12, 0, 388); s.tone(784, 1.6, 'sine', .05); s.tone(1176, 1, 'sine', .03); }
  }

  /* ════════════════════════════════════════════════════════════════
     registo no kit
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const p = prog();
      return `<style>
.sn-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.sn-c{position:relative;border:0;border-radius:18px;padding:16px 14px 14px;min-height:150px;color:#fff;font:inherit;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s}
.sn-c:hover:not([disabled]){transform:translateY(-3px)}.sn-c[disabled]{cursor:not-allowed;filter:grayscale(.8) brightness(.7)}
.sn-c small{display:block;font:700 .64rem 'Space Grotesk';letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.sn-c b{display:block;font:800 1.08rem 'Space Grotesk';margin:3px 0 6px}.sn-c p{margin:0;font-size:.76rem;line-height:1.35;opacity:.92}
.sn-c .st{position:absolute;top:12px;right:12px;font-size:.8rem;letter-spacing:1px}.sn-c .ic{position:absolute;right:10px;bottom:6px;font-size:2.4rem;opacity:.35}
</style><div class="sn-m">${LEVELS.map((L, i) => { const lock = i > p.u, st = p.s[L.id] || 0; return `<button class="sn-c" data-m="${i}" ${lock ? 'disabled' : ''} style="background:linear-gradient(150deg,${L.grad[0]},${L.grad[1]})"><small>Missão ${i + 1}${lock ? ' · 🔒' : ''}</small><b>${L.name}</b><p>${L.brief.split('. ')[0]}.</p><span class="st">${lock ? '' : '⭐'.repeat(st) + '<span style="opacity:.3">' + '⭐'.repeat(3 - st) + '</span>'}</span><span class="ic">${L.icon}</span></button>`; }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) start(b.dataset.m); })); },
  };
  let CUR = LEVELS[0];
  const spec = {
    id: ID, title: 'Operação Soneca', icon: '🦉', accent: '#ff4a7a', accent2: '#ffd040', bg: '#14202a', aspect: 'wide', transparent: true, defDiff: 'medium',
    tagline: 'Atirador furtivo sem violência: a agente Coruja põe a Liga dos Bigodes a dormir com dardos de sono. Vento, queda do dardo, binóculos e câmara do dardo em câmara lenta.',
    view: { w: 960 }, picker, cursor: 'crosshair',
    get ready() { return { title: CUR.name, hint: CUR.brief + '<br><small style="opacity:.75">Clica para começar — o rato passa a controlar a mira (Esc liberta).</small>' }; },
    how: [
      'Olha à volta com o <b>rato</b> (ou a arrastar no telemóvel). <b>Botão direito</b> abre a <b>mira</b>, a <b>roda</b> muda a ampliação (4×, 8×, 14×) e o <b>clique</b> dispara um dardo de sono.',
      'Usa os <b>binóculos (B)</b> para encontrar e marcar alvos: mantém a pessoa no centro até ficar marcada. Os civis <b>não</b> se adormecem!',
      'O dardo <b>cai</b> com a distância e o <b>vento</b> desvia-o: mede a distância e acerta a zeragem com <b>Z</b>, usa os pontos da retícula e <b>sustém a respiração</b> com <b>Shift</b>.',
      'Os guardas notam colegas a dormir e dardos a cair perto — se derem o <b>alarme</b>, o alvo foge. Tiros bons ganham a <b>câmara do dardo</b> (C muda).',
    ],
    controls: ['🖱️ mover = olhar · clique = disparar', '🖱️ direito = mira · roda = zoom', '⌨️ B · Shift · Z · R · C · N'],
    setup: (api, o) => { const G = setup(api, o); CUR = G.L; const wait = () => { if (G.ok) buildUI(G, api); else if (!G.fail3d && !G.dead) setTimeout(wait, 100); }; wait(); return G; },
    begin: (G, api) => {
      if (!Arcade3D.coarse()) lockReq(G, api);
      /* telemóvel: ecrã inteiro e na horizontal (o palco não cabe com o cabeçalho do site) */
      else { try { const st = api.stage; if (st.requestFullscreen && !document.fullscreenElement) st.requestFullscreen().then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {} }
      hint(G, G.L.brief, 6, true);
    },
    update, draw, down, move, up, key, keyup,
    destroy: G => { G.dead = 1; if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) {} if (G._off) G._off(); if (G.ui) G.ui.remove(); if (G.r3) { G.r3.renderer.toneMappingExposure = 1.08; G.r3.renderer.autoClear = true; Arcade3D.disposeOwn(G.r3.scene); if (G.fp) Arcade3D.disposeOwn(G.fp.scene); G.r3.env && G.r3.env.dispose(); Arcade3D.detach(); G.r3 = null; } },
    hud: G => [['Missão', (G.li + 1) + '/' + LEVELS.length], ['Pontos', G.score], ['Dardos', G.ammo]],
    pauseButtons: (G, api) => [{ label: 'Ecrã inteiro', fn: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else api.stage.requestFullscreen && api.stage.requestFullscreen().catch(() => {}); } catch (e) {} api.resume(); } }, { label: 'Escolher missão', fn: () => api.menu() }],
    achievements: [
      { id: 'sniper.first', name: 'Boa Noite', icon: '🦉', desc: 'Completa a primeira missão da Operação Soneca.', test: c => c.result.won },
      { id: 'sniper.ghost', name: 'Fantasma', icon: '👻', desc: 'Completa uma missão da Operação Soneca sem alarme e sem civis a dormir (3 estrelas).', test: c => c.result.won && (c.result.score || 0) > 2000 },
    ],
  };
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = { LEVELS, fire, predict, hitPeople, measure, impactPoint, raiseAlarm };
  return KIT;
})();
