/* ══════════════════════════════════════════════════════════════════
   Mundos de Pip — plataformas 2D.
   O Pip (uma raposa) atravessa 4 mundos × 2 níveis feitos à mão
   (js/games/platformer-levels.js): Prado, Deserto, Gelo e Castelo.

   Motor de tiles com rampas (45° e suaves) e embalo: a
   velocidade segue o chão, as descidas aceleram, as subidas travam,
   rolar (↓) mantém o embalo e derruba inimigos. Loops (com velocidade
   dá a volta, sem ela escorrega para trás), molas, aceleradores,
   plataformas móveis e que caem, rodas de cristais, lava. Caixas-surpresa,
   tijolos, blocos escondidos, paredes falsas e portas para zonas
   secretas, 3 penas douradas por nível, lanternas de controlo.
   Poderes: malagueta (bolas de fogo), cristal arco-íris (invencível),
   corações. Inimigos: lagartas, castanhas-espinhosas, abelhas, salpicos
   de lava e o Escaravelho-Rei no fim. Tudo desenho próprio.

   Coordenadas do mundo em px (tile = 32), y para baixo. Tudo é
   desenhado à mão em canvas 2D (tiles em cache), sem imagens.
══════════════════════════════════════════════════════════════════ */
const PlatformerGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2, TS = 32;
  const P = { g: 1900, jump: 735, cut: 330, acc: 1450, acc2: 520, dec: 2600, fric: 1500, air: 1150, walk: 250, run: 410, max: 860, slope: 1150, roll: 260 };
  const PW = 22, PH = 42, PHR = 26, PHC = 28;
  /* durante "↓ + salto" numa plataforma de passagem, as plataformas "=" deixam de segurar */
  let NO_OW = false;
  const LEVELS = typeof PIP_LEVELS !== 'undefined' ? PIP_LEVELS : [];

  /* ── temas (um por mundo) ── */
  const THEMES = [
    { id: 'prado', name: 'Prado Verde', sky: ['#4aa8f0', '#bfe6ff', '#e8f7ff'], cap: 'grass', top: '#7fd655', top2: '#3d962c', capHi: '#c8f590', fringe: '#2f7a22', dirt: '#9a6334', dirt2: '#6b4022', dirtHi: '#bd8550', edge: '#4a2a12', stone: '#b0b8c3', stone2: '#7b8592', far: '#8fb7dc', mid: '#5fae5c', midHi: '#82c978', near: '#3d8f45', nearHi: '#58ac55', trunk: '#6b4a2e', haze: 'rgba(220,242,255,.55)', cloud: true, fric: 1 },
    { id: 'deserto', name: 'Deserto Dourado', sky: ['#f7864a', '#ffd29a', '#fff0cf'], cap: 'sand', top: '#f9dc94', top2: '#dba552', capHi: '#fff3cf', fringe: '#c98d3e', dirt: '#d89a57', dirt2: '#a86b35', dirtHi: '#ecb877', edge: '#6e4119', stone: '#e0c08f', stone2: '#b48f5e', far: '#eaa77a', mid: '#dc9561', midHi: '#4f8a3e', near: '#b8743f', nearHi: '#c98652', trunk: '#7a5230', haze: 'rgba(255,225,180,.5)', sun: true, fric: 1 },
    { id: 'gelo', name: 'Picos Gelados', sky: ['#5f9fe8', '#cfe8ff', '#f2f9ff'], cap: 'snow', top: '#ffffff', top2: '#d3eafa', capHi: '#ffffff', fringe: '#e4f2fc', dirt: '#7dbde6', dirt2: '#4f8fc4', dirtHi: '#b3dcf5', edge: '#2f6699', stone: '#c3dcec', stone2: '#8db6d1', far: '#c4daf0', mid: '#5f9ab8', midHi: '#82b5cf', near: '#e9f4fb', nearHi: '#ffffff', trunk: '#5a4636', haze: 'rgba(235,246,255,.6)', snow: true, fric: .22 },
    { id: 'castelo', name: 'Castelo de Lava', sky: ['#1d0a1c', '#4c1626', '#7a2a1e'], cap: 'stone', top: '#7c8194', top2: '#4a4e5f', capHi: '#a9afc2', fringe: '#33364a', dirt: '#4a4f60', dirt2: '#2f3240', dirtHi: '#666c7e', edge: '#191a24', stone: '#737889', stone2: '#4d5163', far: '#3a1828', mid: '#28101e', midHi: '#3a1a2a', near: '#170910', nearHi: '#22101a', trunk: '#222', haze: 'rgba(120,30,30,.35)', lava: true, fric: 1 },
  ];

  /* ════════════════════════════════════════════════════════════════
     mapa
  ════════════════════════════════════════════════════════════════ */
  const SOLID = new Set(['#', '%', 'B', '?', 'P', '!', 'H', 'U', 'Q']);
  const SLOPE = { '/': 1, '\\': 1, a: 1, b: 1, c: 1, d: 1 };
  function hgt(ch, lx) {
    switch (ch) {
      case '/': return lx; case '\\': return TS - lx;
      case 'a': return lx / 2; case 'b': return TS / 2 + lx / 2;
      case 'c': return TS - lx / 2; case 'd': return TS / 2 - lx / 2;
    }
    return 0;
  }
  const ANG = { '/': -Math.PI / 4, '\\': Math.PI / 4, a: -Math.atan(.5), b: -Math.atan(.5), c: Math.atan(.5), d: Math.atan(.5) };

  function parse(L) {
    const rows = L.map.map(r => r.replace(/\s+$/, ''));
    const W = Math.max(...rows.map(r => r.length)), H = rows.length;
    const t = rows.map(r => r.padEnd(W, '.').split(''));
    const M = { W, H, t, obj: [], items: [], enemies: [], doors: {}, start: [2, H - 3], checks: [], goal: null, loops: [], boss: null };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = t[y][x], px = x * TS + TS / 2, py = (y + 1) * TS;
      const clear = () => { t[y][x] = '.'; };
      switch (ch) {
        case 'S': M.start = [px, py]; clear(); break;
        case 'o': M.items.push({ k: 'coin', x: px, y: py - TS / 2 }); clear(); break;
        case '*': M.items.push({ k: 'star', x: px, y: py - TS / 2 }); clear(); break;
        case 'e': M.enemies.push({ k: 'walker', x: px, y: py }); clear(); break;
        case 's': M.enemies.push({ k: 'spiky', x: px, y: py }); clear(); break;
        case 'f': M.enemies.push({ k: 'flyer', x: px, y: py - TS / 2 }); clear(); break;
        case 'l': M.enemies.push({ k: 'lavab', x: px, y: py }); t[y][x] = '~'; break;
        case 'W': M.boss = { x: px, y: py }; clear(); break;
        case 'u': M.obj.push({ k: 'spring', x: x * TS + 2, y: py - 18, w: TS - 4, h: 18 }); clear(); break;
        case 'R': M.obj.push({ k: 'pad', x: x * TS, y: py - 8, w: TS, h: 8 }); clear(); break;
        case 'K': M.checks.push({ x: px, y: py, on: false }); clear(); break;
        case 'G': M.goal = { x: px, y: py }; clear(); break;
        case 'O': M.loops.push({ cx: px, gy: py, R: 100 }); clear(); break;
        case 'm': M.obj.push({ k: 'plat', x: x * TS, y: py - TS, w: TS * 3, h: 14, ax: x * TS, ay: py - TS, dx: 1, dy: 0, range: TS * 4, sp: .55, ph: x * .3 }); clear(); break;
        case 'v': M.obj.push({ k: 'plat', x: x * TS, y: py - TS, w: TS * 3, h: 14, ax: x * TS, ay: py - TS, dx: 0, dy: 1, range: TS * 3.5, sp: .5, ph: x * .3 }); clear(); break;
        case 'x': M.obj.push({ k: 'crumb', x: x * TS, y: py - TS, w: TS, h: 14, ay: py - TS, st: 0 }); clear(); break;
        case 'T': M.obj.push({ k: 'firebar', x: px, y: py - TS / 2, n: 5, w: (x % 2 ? -1 : 1) * 1.7, a: x }); t[y][x] = 'U'; break;
        case 'X': case 'Y': case 'Z': (M.doors[ch] = M.doors[ch] || []).push({ x: px, y: py, id: ch }); clear(); break;
      }
    }
    M.doorList = Object.values(M.doors).flat();
    return M;
  }

  const tAt = (G, cx, cy) => { const M = G.M; if (cx < 0 || cx >= M.W) return '#'; if (cy < 0) return '.'; if (cy >= M.H) return '.'; return M.t[cy][cx]; };
  const solidAt = (G, cx, cy) => SOLID.has(tAt(G, cx, cy));

  /* superfície mais alta em [yTop, yBot] na coluna de x (tiles, rampas, plataformas de passagem) */
  function floorAt(G, x, yTop, yBot, prevY) {
    const cx = Math.floor(x / TS);
    const r0 = Math.floor(yTop / TS), r1 = Math.floor(yBot / TS);
    for (let r = r0; r <= r1; r++) {
      const ch = tAt(G, cx, r);
      let s = null, a = 0;
      if (SOLID.has(ch)) { s = r * TS; }
      else if (SLOPE[ch]) { s = (r + 1) * TS - hgt(ch, x - cx * TS); a = ANG[ch]; }
      else if (ch === '=' && !NO_OW) { if (prevY == null || prevY <= r * TS + 3) s = r * TS; }
      if (s !== null && s >= yTop - .01 && s <= yBot + .01) return { y: s, a, ch, r };
    }
    return null;
  }
  /* plataformas-objeto (móveis / que caem) por baixo dos pés */
  function platAt(G, x, yTop, yBot, prevY) {
    let best = null;
    G.M.obj.forEach(o => {
      if (o.k !== 'plat' && o.k !== 'crumb') return;
      if (o.k === 'crumb' && o.gone) return;
      if (x < o.x - 4 || x > o.x + o.w + 4) return;
      if (o.y >= yTop - .01 && o.y <= yBot + .01 && (prevY == null || prevY <= o.y + 4)) { if (!best || o.y < best.y) best = { y: o.y, a: 0, plat: o }; }
    });
    return best;
  }
  function ground(G, x, yTop, yBot, prevY) {
    const xs = [x - PW / 2 + 3, x, x + PW / 2 - 3];
    let best = null;
    xs.forEach((xx, i) => {
      const f = floorAt(G, xx, yTop, yBot, prevY);
      if (f && (!best || f.y < best.y - .5 || (Math.abs(f.y - best.y) < .5 && i === 1))) best = f;
    });
    /* em rampas, o sensor do meio manda (senão sobe "aos degraus") */
    const mid = floorAt(G, x, yTop, yBot, prevY);
    if (mid && SLOPE[mid.ch]) best = mid;
    const pl = platAt(G, x, yTop, yBot, prevY);
    if (pl && (!best || pl.y < best.y)) best = pl;
    return best;
  }
  /* parede: algum tile sólido a ocupar o corpo (sem contar os pés) */
  /* step: altura (px acima dos pés) que ainda se "sobe" a andar — no chão as
     rampas de 45° põem o tile sólido da coluna seguinte uns 11 px acima dos pés */
  function wallAt(G, x, y, h, step) {
    const cx = Math.floor(x / TS), lo = y - (step || 9);
    for (let yy = y - h + 3; yy <= lo; yy += 8) { if (solidAt(G, cx, Math.floor(yy / TS))) return true; }
    return solidAt(G, cx, Math.floor(lo / TS));
  }

  /* ════════════════════════════════════════════════════════════════
     estado
  ════════════════════════════════════════════════════════════════ */
  const SAVE = 'pip:save';
  function save() { try { return JSON.parse(localStorage.getItem(SAVE)) || { u: 1, s: {} }; } catch (e) { return { u: 1, s: {} }; } }
  function putSave(v) { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch (e) {} }

  function setup(api, o) {
    const li = Math.max(0, LEVELS.findIndex(l => l.id === o.mode));
    const L = LEVELS[li] || LEVELS[0];
    const M = parse(L);
    const th = THEMES[L.world] || THEMES[0];
    const G = {
      L, li, M, th, t: 0, time: 0, coins: 0, stars: [], kills: 0, deaths: 0, score: 0,
      p: null, cam: { x: 0, y: 0 }, z: 1, VW: 0, VH: 0, fx: [], balls: [], bumps: new Map(), pops: [], shake: 0,
      check: null, win: false, winT: 0, dead: false, deadT: 0, keys: {}, touch: false, fade: 0, fadeTo: null, boss: null,
      totalStars: M.items.filter(i => i.k === 'star').length,
    };
    M.enemies.forEach(e => Object.assign(e, { x0: e.x, y0: e.y, vx: -55, vy: 0, alive: true, on: false, t: Math.random() * 6, act: false, a: 0 }));
    if (M.boss) G.boss = { x: M.boss.x, y: M.boss.y, vx: -90, vy: 0, hp: 3, inv: 0, alive: true, on: false, t: 0, act: false, jumpT: 2 };
    /* células com objetos/portas/lanternas: sem adereços decorativos por cima */
    G.busy = new Set();
    const mark = (x, y) => { const cx = Math.floor(x / TS), cy = Math.floor(y / TS); for (let d = -1; d <= 1; d++) G.busy.add((cx + d) + ',' + cy); };
    M.obj.forEach(o => mark(o.x + (o.w || 0) / 2, (o.y + (o.h || 0)) + 1));
    M.checks.forEach(c => mark(c.x, c.y + 1)); M.doorList.forEach(d => mark(d.x, d.y + 1));
    if (M.goal) { mark(M.goal.x - 40, M.goal.y + 1); mark(M.goal.x, M.goal.y + 1); mark(M.goal.x + 40, M.goal.y + 1); }
    mark(M.start[0], M.start[1] + 1);
    spawn(G, M.start[0], M.start[1]);
    camera(G, api, 0, true);
    return G;
  }
  function spawn(G, x, y) {
    G.p = { x, y, vx: 0, vy: 0, gsp: 0, on: true, a: 0, face: 1, roll: false, crouch: false, hp: 3, inv: 1, star: 0, fire: G.p ? G.p.fire : false, jumpHeld: false, coyote: 0, buf: 0, holdT: 0, loop: null, plat: null, anim: 0, blink: 2, sq: 0, shootT: 0, door: null, ground: null, dHeld: false, dive: false, charge: 0, pounce: false, dropT: 0, idleT: 0, landT: 0 };
  }

  /* ════════════════════════════════════════════════════════════════
     entrada
  ════════════════════════════════════════════════════════════════ */
  function input(G, api) {
    const k = G.keys, I = { l: !!(k.ArrowLeft || k.a || k.A), r: !!(k.ArrowRight || k.d || k.D), u: !!(k.ArrowUp || k.w || k.W), d: !!(k.ArrowDown || k.s || k.S), j: !!(k[' '] || k.z || k.Z || k.k || k.K), f: !!(k.x || k.X || k.Shift || k.j || k.J) };
    /* toque: botões no ecrã (vários dedos ao mesmo tempo) */
    if (G.touch) {
      const B = buttons(G, api);
      api.ptrs.forEach(pt => {
        B.forEach(b => { if (Math.hypot(pt.x - b.x, pt.y - b.y) < b.r * 1.25) I[b.id] = true; });
      });
    }
    return I;
  }
  /* unidades lógicas por px de ecrã (os botões e o HUD têm tamanho fixo em px) */
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  function buttons(G, api) {
    const W = api.W, H = api.H, s = 34 * pxK(api);
    const by = H - s * 1.5;
    return [
      { id: 'l', x: s * 1.4, y: by, r: s, ic: '◀' },
      { id: 'r', x: s * 3.7, y: by, r: s, ic: '▶' },
      { id: 'd', x: s * 2.55, y: by - s * 1.3, r: s * .55, ic: '▼' },
      { id: 'j', x: W - s * 1.45, y: by, r: s * 1.12, ic: '⤒' },
      { id: 'f', x: W - s * 3.7, y: by + s * .35, r: s * .82, ic: '✦' },
      { id: 'u', x: W - s * 1.45, y: by - s * 2.3, r: s * .62, ic: '▲' },
    ];
  }

  /* ════════════════════════════════════════════════════════════════
     física do Pip
  ════════════════════════════════════════════════════════════════ */
  function stepPlayer(G, dt, api, I) {
    const p = G.p, th = G.th;
    p.inv = Math.max(0, p.inv - dt); p.star = Math.max(0, p.star - dt); p.shootT = Math.max(0, p.shootT - dt);
    p.coyote = Math.max(0, p.coyote - dt); p.buf = Math.max(0, p.buf - dt);
    p.sq += (0 - p.sq) * Math.min(1, dt * 12);
    const jumpPress = I.j && !p.jumpHeld; p.jumpHeld = I.j;
    const downPress = I.d && !p.dHeld; p.dHeld = I.d;
    if (jumpPress) p.buf = .12;
    p.dropT = Math.max(0, p.dropT - dt); p.landT = Math.max(0, p.landT - dt);
    const dir = (I.r ? 1 : 0) - (I.l ? 1 : 0);
    if (dir) p.face = dir;
    p.holdT = dir ? p.holdT + dt : 0;
    const top = p.holdT > .45 ? P.run : P.walk;
    /* disparo */
    if (I.f && p.fire && p.shootT <= 0 && G.balls.length < 2) { p.shootT = .3; G.balls.push({ x: p.x + p.face * 14, y: p.y - 24, vx: p.face * 540 + p.vx * .3, vy: 120, t: 0 }); api.sfx.tone(700, .08, 'square', .04, 0, 300); }

    /* ── loop ── */
    if (p.loop) {
      const L = p.loop, R = L.R;
      p.gsp += -P.g * Math.sin(L.th) * dt * .45;
      L.th += p.gsp / R * dt;
      const fast = p.gsp > Math.sqrt(P.g * R) * .7;
      if (L.th > Math.PI * .55 && L.th < Math.PI * 1.45 && !fast) {
        /* sem embalo: cai do loop */
        const tx = Math.cos(L.th), ty = -Math.sin(L.th);
        p.vx = tx * p.gsp; p.vy = ty * p.gsp; p.loop = null; p.on = false; p.a = 0; L.obj.cool = .6;
        return;
      }
      if (L.th <= 0) { p.loop = null; p.on = true; p.a = 0; p.x = L.obj.cx - 2; p.y = L.obj.gy; L.obj.cool = .5; return; }
      if (L.th >= TAU) { p.loop = null; p.on = true; p.a = 0; p.x = L.obj.cx + 6; p.y = L.obj.gy; L.obj.cool = .5; G.loops = (G.loops || 0) + 1; return; }
      const cy = L.obj.gy - R;
      p.x = L.obj.cx + Math.sin(L.th) * R; p.y = cy + Math.cos(L.th) * R;
      p.a = -L.th; p.anim += dt * Math.abs(p.gsp) / 18;
      return;
    }

    if (p.on) {
      /* ── no chão: velocidade ao longo do chão (gsp) ── */
      const fr = p.plat ? 1 : th.fric;
      if (p.roll) {
        p.gsp -= Math.sign(p.gsp) * Math.min(Math.abs(p.gsp), P.roll * dt);
        if (Math.abs(p.gsp) < 70) p.roll = false;
      } else if (dir) {
        if (Math.sign(p.gsp) === -dir && Math.abs(p.gsp) > 20) {
          p.gsp += dir * P.dec * fr * dt;   /* travar (com pó) */
          if (Math.abs(p.gsp) > 200 && Math.random() < .5) dust(G, p.x - p.face * 6, p.y, 1);
          p.skid = .15;
        } else if (Math.abs(p.gsp) < top) p.gsp += dir * (Math.abs(p.gsp) < P.walk ? P.acc : P.acc2) * (fr < 1 ? .45 : 1) * dt;
        else if (Math.abs(p.gsp) > top + 10) p.gsp -= Math.sign(p.gsp) * 240 * dt;
      } else {
        /* acima da corrida normal (embalo de rampas/aceleradores) perde-se devagar */
        p.gsp -= Math.sign(p.gsp) * Math.min(Math.abs(p.gsp), (Math.abs(p.gsp) > P.run ? 320 : P.fric * fr) * dt);
      }
      /* gravidade nas rampas: descidas aceleram, subidas travam (rolar: mais) */
      if (p.a) p.gsp += P.slope * Math.sin(p.a) * (p.roll ? 1.6 : 1) * dt;
      p.gsp = U.clamp(p.gsp, -P.max, P.max);
      p.skid = Math.max(0, (p.skid || 0) - dt);
      if (I.d && !p.roll && Math.abs(p.gsp) > 130) { p.roll = true; api.sfx.tone(300, .12, 'triangle', .05, 0, 600); }
      p.crouch = I.d && !p.roll && Math.abs(p.gsp) <= 130;
      if (p.crouch) {
        p.gsp -= Math.sign(p.gsp) * Math.min(Math.abs(p.gsp), P.fric * 2 * dt);
        /* agachado, a raposa prepara o "bote": ao fim de ~0,45 s o salto é mais alto */
        const was = p.charge;
        p.charge = Math.min(1, p.charge + dt / .45);
        if (was < 1 && p.charge >= 1) { api.sfx.tone(880, .09, 'triangle', .04, 0, 1320); sparkle(G, p.x - p.face * 4, p.y - 14, 6, '#fde68a'); }
      } else p.charge = Math.max(0, p.charge - dt * 4);
      /* salto (com tampão de 0,12 s e tempo de "coiote") */
      if (p.buf > 0) {
        p.buf = 0;
        /* ↓ + salto numa plataforma de passagem: desce através dela */
        if (I.d && p.ground && p.ground.ch === '=' && !p.plat) {
          p.on = false; p.crouch = false; p.charge = 0; p.dropT = .22; p.y += 3; p.vx = p.gsp; p.vy = 80; p.jumped = false; p.coyote = 0;
          api.sfx.tone(260, .1, 'triangle', .04, 0, 180);
          return;
        }
        const pounce = p.crouch && p.charge >= 1;
        p.on = false; p.roll = false; p.crouch = false; p.charge = 0;
        const c = Math.cos(p.a), s = Math.sin(p.a);
        p.vx = p.gsp * c; p.vy = p.gsp * s - P.jump * (pounce ? 1.17 : 1);
        p.jumped = true; p.sq = pounce ? -.34 : -.22; p.plat = null; p.pounce = pounce;
        if (pounce) { api.sfx.tone(392, .22, 'triangle', .06, 0, 1180); sparkle(G, p.x, p.y - 4, 10, '#fde68a'); dust(G, p.x, p.y, 6); api.vibe(10); }
        else api.sfx.tone(330, .14, 'triangle', .06, 0, 620);
        dust(G, p.x, p.y, 2);
        return;
      }
      /* andar ao longo do chão */
      const h = p.roll ? PHR : PH;
      let nx = p.x + p.gsp * Math.cos(p.a) * dt;
      if (p.plat) nx += p.plat.ddx || 0;
      const lead = nx + Math.sign(p.gsp || p.face) * PW / 2;
      if (p.gsp && wallAt(G, lead, p.y - 1, h, 21)) {
        nx = p.gsp > 0 ? Math.floor(lead / TS) * TS - PW / 2 - .01 : (Math.floor(lead / TS) + 1) * TS + PW / 2 + .01;
        if (Math.abs(p.gsp) > 500) { api.shake(4, .15); }
        p.gsp = 0;
      }
      const prevX = p.x;
      p.x = nx;
      const yRef = p.y + (p.plat ? (p.plat.ddy || 0) : 0);
      const gnd = ground(G, p.x, yRef - 22, yRef + 18 + Math.abs(p.gsp) * dt * 1.2, null);
      if (gnd) { p.y = gnd.y; p.a = gnd.a; p.plat = gnd.plat || null; p.ground = gnd; }
      else {
        p.on = false; p.coyote = .1; p.plat = null;
        p.vx = p.gsp * Math.cos(p.a); p.vy = p.gsp * Math.sin(p.a); p.a = 0;
      }
      /* entrar num loop (a correr para a direita) */
      G.M.loops.forEach(L => {
        if ((L.cool || 0) > 0) return;
        if (p.on && p.gsp > 120 && prevX < L.cx && p.x >= L.cx && Math.abs(p.y - L.gy) < 6) {
          p.loop = { obj: L, th: .02, R: L.R }; p.on = false; p.roll = false;
          api.sfx.tone(520, .3, 'triangle', .05, 0, 1040);
        }
      });
    } else {
      /* ── no ar ── */
      if (p.coyote > 0 && p.buf > 0 && !p.jumped) { p.buf = 0; p.vy = -P.jump; p.coyote = 0; p.jumped = true; api.sfx.tone(330, .14, 'triangle', .06, 0, 620); }
      /* ↓ no ar: mergulho de raposa (de cabeça, como a caçar na neve) — parte caixotes e derruba inimigos */
      if (downPress && !p.roll && !p.dive && p.dropT <= 0) {
        p.dive = true; p.pounce = false; p.vx *= .3; p.vy = Math.max(p.vy, 520);
        api.sfx.tone(700, .16, 'sawtooth', .035, 0, 160);
      }
      if (p.dive) {
        p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 300 * dt);
        p.vy = Math.min(p.vy + P.g * 1.5 * dt, 1300);
      } else {
        if (dir) { if (Math.abs(p.vx) < top || Math.sign(p.vx) !== dir) p.vx += dir * P.air * dt; }
        else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 120 * dt);
        if (!p.jumpHeld && p.vy < -P.cut && p.jumped && !p.pounce) p.vy = -P.cut;   /* salto variável */
        /* queda um pouco mais pesada que a subida; no topo do salto, com o botão premido, flutua um instante */
        const gk = p.vy > 0 ? 1.12 : (p.jumpHeld && Math.abs(p.vy) < 90 ? .6 : 1);
        p.vy = Math.min(p.vy + P.g * gk * dt, 1100);
      }
      const h = p.roll ? PHR : PH;
      /* horizontal */
      let nx = p.x + p.vx * dt;
      const lead = nx + Math.sign(p.vx) * PW / 2;
      if (p.vx && wallAt(G, lead, p.y, h)) { nx = p.vx > 0 ? Math.floor(lead / TS) * TS - PW / 2 - .01 : (Math.floor(lead / TS) + 1) * TS + PW / 2 + .01; p.vx = 0; }
      p.x = nx;
      /* vertical */
      const py = p.y; let ny = p.y + p.vy * dt;
      if (p.vy < 0) {
        /* teto: blocos batidos por baixo */
        const head = ny - h;
        const cxs = [p.x - PW / 2 + 3, p.x, p.x + PW / 2 - 3].map(xx => Math.floor(xx / TS)), cy = Math.floor(head / TS);
        let hit = false;
        cxs.forEach(cx => { const ch = tAt(G, cx, cy); if (SOLID.has(ch) || ch === 'h') hit = true; });
        if (hit) {
          const mc = Math.floor(p.x / TS);
          let bc = cxs.find(cx => cx === mc && (SOLID.has(tAt(G, cx, cy)) || tAt(G, cx, cy) === 'h'));
          if (bc == null) bc = cxs.find(cx => SOLID.has(tAt(G, cx, cy)) || tAt(G, cx, cy) === 'h');
          /* "corner correction": raspar a esquina de um bloco empurra para o lado */
          const onlyEdge = !SOLID.has(tAt(G, mc, cy)) && tAt(G, mc, cy) !== 'h';
          if (onlyEdge && Math.abs(p.vy) > 200) {
            const sx = bc < mc ? (bc + 1) * TS + PW / 2 + .1 : bc * TS - PW / 2 - .1;
            if (Math.abs(sx - p.x) < 10) { p.x = sx; p.y = ny; return; }
          }
          hitBlock(G, api, bc, cy);
          ny = (cy + 1) * TS + h + .01; p.vy = 0;
        }
        p.y = ny;
      } else {
        NO_OW = p.dropT > 0;
        let gnd = ground(G, p.x, py - 2, ny + 1, py);
        /* a cair contra uma rampa que sobe: os pés entram na rampa → pousa nela */
        if (!gnd) { const sl = floorAt(G, p.x, ny - 22, ny + 1); if (sl && SLOPE[sl.ch]) gnd = sl; }
        NO_OW = false;
        if (gnd && gnd.y >= py - 22) {
          const vyLand = p.vy;
          p.y = gnd.y; p.on = true; p.a = gnd.a; p.plat = gnd.plat || null; p.ground = gnd;
          /* aterrar: a velocidade passa a seguir o chão */
          p.gsp = p.vx * Math.cos(p.a) + p.vy * Math.sin(p.a) * .55;
          if (p.vy > 500) { p.sq = Math.min(.3, p.vy / 3500); dust(G, p.x, p.y, 5); }
          p.vy = 0; p.jumped = false; p.pounce = false; p.landT = .16;
          if (p.dive) { p.dive = false; p.gsp = 0; diveImpact(G, api, gnd, vyLand); return; }
          if (p.buf > 0) { p.buf = 0; p.on = false; p.vx = p.gsp * Math.cos(p.a); p.vy = p.gsp * Math.sin(p.a) - P.jump; p.jumped = true; api.sfx.tone(330, .14, 'triangle', .06, 0, 620); }
        } else p.y = ny;
      }
    }
    /* molas e aceleradores */
    G.M.obj.forEach(o => {
      if (o.k === 'spring') {
        if (p.x > o.x - 6 && p.x < o.x + o.w + 6 && p.y >= o.y - 2 && p.y <= o.y + o.h && (p.vy > 0 || (p.on && Math.abs(p.y - o.y) < 3))) {
          if (p.y > o.y + 10 && p.on) return;
          if (p.on) p.vx = p.gsp * Math.cos(p.a);
          p.y = o.y; p.vy = I.j ? -1320 : -1180; p.on = false; p.jumped = false; p.roll = false; p.plat = null; p.dive = false; p.pounce = false;
          o.anim = 1; api.sfx.tone(260, .25, 'sine', .07, 0, 900); api.vibe(15); G.springs = (G.springs || 0) + 1;
        }
      } else if (o.k === 'pad') {
        if (p.on && p.x > o.x && p.x < o.x + o.w && Math.abs(p.y - (o.y + o.h)) < 10) {
          if (p.gsp < 780) { p.gsp = 800; p.face = 1; o.anim = 1; api.sfx.noise(.25, .06, 0, 2200, 'highpass'); api.sfx.tone(440, .2, 'sawtooth', .04, 0, 1320); }
        }
      }
    });
    /* cair do mapa */
    if (p.y > G.M.H * TS + 80) die(G, api, 'fall');
    /* lava e picos */
    const cx = Math.floor(p.x / TS), cyF = Math.floor((p.y - 4) / TS);
    const chF = tAt(G, cx, cyF);
    if (chF === '~' && p.y - 4 > cyF * TS + 10) die(G, api, 'lava');
    if (chF === '^' && p.y - 2 > cyF * TS + 14) hurt(G, api, true);
    const chB = tAt(G, cx, Math.floor((p.y + 2) / TS));
    if (chB === '^' && p.on) hurt(G, api, true);
    p.anim += dt * (p.on ? Math.max(1.5, Math.abs(p.gsp) / 22) : 8);
    p.idleT = (p.on && !dir && !p.crouch && Math.abs(p.gsp) < 5) ? p.idleT + dt : 0;
  }

  function hitBlock(G, api, cx, cy) {
    if (cx == null) return;
    const M = G.M, ch = tAt(G, cx, cy);
    const key = cx + ',' + cy, X = cx * TS + TS / 2, Y = cy * TS;
    G.bumps.set(key, .2);
    /* inimigos em cima do bloco levam um toque */
    M.enemies.forEach(e => { if (e.alive && Math.abs(e.x - X) < TS && Math.abs(e.y - Y) < 6) killEnemy(G, api, e, true); });
    if (ch === '?' || ch === 'h' || ch === 'Q') {
      M.t[cy][cx] = 'U';
      if (ch === 'h') { for (let i = 0; i < 5; i++) G.pops.push({ x: X + (i - 2) * 10, y: Y - 10, vy: -520 - i * 30, t: 0 }); G.coins += 5; api.sfx.arp([988, 1319, 1568], .05, .1, 'square', .04); G.secrets = (G.secrets || 0) + 1; return; }
      G.pops.push({ x: X, y: Y - 8, vy: -560, t: 0 }); G.coins++; coinSfx(api);
      return;
    }
    if (ch === 'P' || ch === '!' || ch === 'H') {
      M.t[cy][cx] = 'U';
      const k = ch === 'P' ? (G.p.fire ? 'heart' : 'fire') : ch === '!' ? 'starp' : 'heart';
      M.items.push({ k, x: X, y: Y - TS / 2, rise: 1, vx: k === 'starp' ? 140 : 0, vy: 0 });
      api.sfx.arp([523, 659, 784], .06, .12, 'triangle', .06);
      return;
    }
    if (ch === 'B') {
      M.t[cy][cx] = '.';
      for (let i = 0; i < 4; i++) G.fx.push({ k: 'brick', x: X + (i % 2 ? 8 : -8), y: Y + 16 + (i > 1 ? 8 : -8), vx: (i % 2 ? 1 : -1) * U.rand(90, 160), vy: -U.rand(380, 560), r: 0, vr: U.rand(-10, 10), life: 1.2 });
      api.sfx.noise(.18, .08, 0, 900); G.score += 50;
      return;
    }
    api.sfx.tone(160, .06, 'square', .04);
  }

  function hurt(G, api, spike) {
    const p = G.p;
    if (p.inv > 0 || p.star > 0 || G.dead || G.win) return;
    p.hp--; p.inv = 1.6; p.roll = false; p.dive = false; p.charge = 0; p.crouch = false;
    p.vy = -460; p.on = false; p.vx = -p.face * 220; p.loop = null;
    api.shake(7, .3); api.vibe([40, 30, 40]); api.sfx.tone(220, .25, 'sawtooth', .06, 0, 110);
    if (p.hp <= 0) die(G, api, 'hp');
  }
  function die(G, api, why) {
    if (G.dead || G.win) return;
    G.dead = true; G.deadT = 0; G.why = why; G.deaths++;
    const p = G.p; p.vy = why === 'fall' ? 0 : -760; p.vx = 0;
    api.sfx.arp([494, 392, 330, 262], .1, .16, 'triangle', .07); api.vibe([80, 40, 80]);
  }

  function coinSfx(api) { api.sfx.tone(1568, .05, 'triangle', .05); api.sfx.tone(2093, .09, 'sine', .035, .035); }

  /* ════════════════════════════════════════════════════════════════
     mundo: objetos, inimigos, itens
  ════════════════════════════════════════════════════════════════ */
  function stepWorld(G, dt, api) {
    const p = G.p, M = G.M, camL = G.cam.x - 160, camR = G.cam.x + G.VW + 160;
    G.bumps.forEach((v, k) => { v -= dt; if (v <= 0) G.bumps.delete(k); else G.bumps.set(k, v); });
    M.loops.forEach(L => { if (L.cool > 0) L.cool -= dt; });
    /* plataformas */
    M.obj.forEach(o => {
      if (o.anim) o.anim = Math.max(0, o.anim - dt * 4);
      if (o.k === 'plat') {
        const k = Math.sin(G.t * o.sp * 2 + o.ph), nx = o.ax + o.dx * k * o.range, ny = o.ay + o.dy * k * o.range;
        o.ddx = nx - o.x; o.ddy = ny - o.y; o.x = nx; o.y = ny;
      } else if (o.k === 'crumb') {
        if (o.gone) { o.rt -= dt; o.y += o.fall * dt; o.fall += 1400 * dt; if (o.rt <= 0) { o.gone = false; o.y = o.ay; o.st = 0; o.fall = 0; } }
        else if (p.on && p.plat === o) { o.st += dt; if (o.st > .45) { o.gone = true; o.rt = 3; o.fall = 0; if (p.plat === o) { p.on = false; p.plat = null; p.vx = p.gsp; p.vy = 0; } api.sfx.noise(.2, .05, 0, 500); } }
        else o.st = Math.max(0, o.st - dt * .5);
      } else if (o.k === 'firebar') {
        o.a += o.w * dt;
        if (!G.dead) for (let i = 1; i <= o.n; i++) { const fx = o.x + Math.cos(o.a) * i * 15, fy = o.y + Math.sin(o.a) * i * 15; if (Math.abs(fx - p.x) < 12 + PW / 2 - 4 && fy > p.y - (p.crouch ? PHC : PH) + 4 && fy < p.y + 4) hurt(G, api); }
      }
    });
    /* inimigos */
    M.enemies.forEach(e => {
      if (!e.alive) { if (e.squash) e.squash -= dt; return; }
      if (!e.act) { if (e.x > camL && e.x < camR) e.act = true; else return; }
      e.t += dt;
      if (e.k === 'walker' || e.k === 'spiky') {
        /* seguem o chão como o Pip: sobem e descem rampas (a "parede" só conta acima de um degrau,
           porque numa rampa de 45° a terra da coluna seguinte fica ~13 px acima dos pés) */
        const nx = e.x + e.vx * dt, lead = nx + Math.sign(e.vx) * 13;
        const wall = wallAt(G, lead, e.y - 1, 24, e.on ? 21 : 9);
        const edge = e.on && !floorAt(G, lead, e.y - 22, e.y + 26);
        if (wall || edge) { e.vx = -e.vx; e.turn = .25; } else e.x = nx;
        e.turn = Math.max(0, (e.turn || 0) - dt);
        if (e.on) {
          const f = floorAt(G, e.x, e.y - 22, e.y + 20);
          if (f) { e.y = f.y; e.vy = 0; e.a += ((f.a || 0) - (e.a || 0)) * Math.min(1, dt * 14); }
          else e.on = false;
        } else {
          e.vy = Math.min(e.vy + P.g * dt, 900);
          const ny = e.y + e.vy * dt, f = floorAt(G, e.x, e.y - 6, ny + 1, e.y);
          if (f && e.vy >= 0) { e.y = f.y; e.vy = 0; e.on = true; e.a = f.a || 0; } else e.y = ny;
        }
        if (e.y > M.H * TS + 60) e.alive = false;
      } else if (e.k === 'flyer') {
        e.x = e.x0 + Math.sin(e.t * .9) * 70; e.y = e.y0 + Math.sin(e.t * 2.6) * 26; e.vx = Math.cos(e.t * .9);
      } else if (e.k === 'lavab') {
        e.cyc = (e.cyc || Math.random() * 2) + dt;
        if (e.cyc > 2.4) { e.cyc = 0; e.vy = -980; e.up = true; api && e.x > camL && e.x < camR && api.sfx.noise(.15, .03, 0, 400); }
        if (e.up) { e.vy += P.g * .85 * dt; e.y += e.vy * dt; if (e.y >= e.y0) { e.y = e.y0; e.up = false; } }
      }
      /* contacto com o Pip */
      if (G.dead) return;
      const ew = e.k === 'lavab' ? 20 : 26, eh = e.k === 'lavab' ? 22 : 26, ex = e.x, ey = e.k === 'flyer' ? e.y + 12 : e.y;
      if (e.k === 'lavab' && !e.up) return;
      const ph = p.roll ? PHR : p.crouch ? PHC : PH;
      if (Math.abs(p.x - ex) < (PW + ew) / 2 - 2 && p.y > ey - eh + 2 && p.y - ph < ey - 2) {
        if (p.star > 0) { killEnemy(G, api, e); return; }
        const stomp = !p.on && p.vy > 60 && p.y < ey - eh * .35 && e.k !== 'spiky' && e.k !== 'lavab';
        if (stomp) { killEnemy(G, api, e); p.dive = false; p.pounce = false; api.hitstop(.04); p.vy = p.jumpHeld ? -680 : -440; p.jumped = true; p.y = ey - eh; G.combo = (G.combo || 0) + 1; return; }
        if (p.roll && (e.k === 'walker' || e.k === 'flyer')) { killEnemy(G, api, e); return; }
        hurt(G, api);
      }
    });
    if (p.on) G.combo = 0;
    /* chefe */
    if (G.boss) stepBoss(G, dt, api);
    /* bolas de fogo */
    for (let i = G.balls.length - 1; i >= 0; i--) {
      const b = G.balls[i]; b.t += dt;
      b.vy += P.g * .8 * dt; b.x += b.vx * dt;
      if (solidAt(G, Math.floor(b.x / TS), Math.floor(b.y / TS))) { G.balls.splice(i, 1); puff(G, b.x, b.y); continue; }
      const ny = b.y + b.vy * dt, f = floorAt(G, b.x, b.y - 4, ny + 6, b.y);
      if (f && b.vy > 0) { b.y = f.y - 6; b.vy = -360; } else b.y = ny;
      let gone = b.t > 2.2 || b.y > M.H * TS;
      M.enemies.forEach(e => { if (!gone && e.alive && e.act && Math.abs(e.x - b.x) < 18 && Math.abs((e.k === 'flyer' ? e.y + 12 : e.y) - 12 - b.y) < 20) { killEnemy(G, api, e); gone = true; } });
      if (gone) { G.balls.splice(i, 1); puff(G, b.x, b.y); }
    }
    /* itens */
    M.items.forEach(it => {
      if (it.got) { it.t = (it.t || 0) + dt; return; }
      if (it.rise > 0) { it.rise = Math.max(0, it.rise - dt * 2.2); it.y -= TS * dt * 2.2; return; }
      if (it.k === 'starp' || (it.k === 'heart' && it.vx)) {
        it.vy = Math.min((it.vy || 0) + P.g * .9 * dt, 800); it.x += it.vx * dt;
        if (solidAt(G, Math.floor((it.x + Math.sign(it.vx) * 12) / TS), Math.floor((it.y) / TS))) it.vx = -it.vx;
        const ny = it.y + it.vy * dt, f = floorAt(G, it.x, it.y + 10, ny + 14, it.y + 12);
        if (f && it.vy > 0) { it.y = f.y - 14; it.vy = it.k === 'starp' ? -620 : 0; } else it.y = ny;
      }
      const ph = p.roll ? PHR : PH, r = it.k === 'star' ? 20 : 14;
      if (Math.abs(p.x - it.x) < PW / 2 + r && it.y > p.y - ph - r && it.y < p.y + r) collect(G, api, it);
    });
    for (let i = G.pops.length - 1; i >= 0; i--) { const c = G.pops[i]; c.t += dt; c.vy += P.g * dt; c.y += c.vy * dt; if (c.t > .5) G.pops.splice(i, 1); }
    /* bandeiras de controlo */
    M.checks.forEach(c => { if (!c.on && Math.abs(p.x - c.x) < 24 && p.y > c.y - 90 && p.y <= c.y + 4) { c.on = true; G.check = c; api.sfx.arp([659, 784, 988, 1319], .07, .14, 'triangle', .06); api.banner('Lanterna acesa!', 'Recomeças daqui'); } });
    /* meta */
    if (M.goal && !G.win && !G.dead && (!G.boss || !G.boss.alive) && Math.abs(p.x - M.goal.x) < 22 && p.y > M.goal.y - 300) winLevel(G, api);
    /* portas: ▲ para entrar */
    p.door = null;
    if (p.on) M.doorList.forEach(d => { if (Math.abs(p.x - d.x) < 16 && Math.abs(p.y - d.y) < 6) p.door = d; });
    /* partículas do mundo */
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.k === 'dust' ? 0 : P.g) * dt; if (f.r != null) f.r += (f.vr || 0) * dt; if (f.life <= 0) G.fx.splice(i, 1); }
  }

  function stepBoss(G, dt, api) {
    const B = G.boss, p = G.p, M = G.M;
    if (!B.alive) { B.t += dt; return; }
    if (!B.act) { if (B.x < G.cam.x + G.VW + 40) { B.act = true; api.banner('Escaravelho-Rei!', 'Salta-lhe em cima 3 vezes'); } else return; }
    B.t += dt; B.inv = Math.max(0, B.inv - dt); B.jumpT -= dt;
    const sp = 90 + (3 - B.hp) * 45;
    if (B.on) B.vx = Math.sign(p.x - B.x || 1) * sp;
    if (B.on && B.jumpT <= 0) { B.vy = -780; B.on = false; B.jumpT = 2.2 - (3 - B.hp) * .4; }
    B.vy = Math.min(B.vy + P.g * dt, 1000);
    const nx = B.x + B.vx * dt, lead = nx + Math.sign(B.vx) * 34;
    if (!solidAt(G, Math.floor(lead / TS), Math.floor((B.y - 20) / TS))) B.x = nx;
    const ny = B.y + B.vy * dt, f = floorAt(G, B.x, B.y - 6, ny + 1, B.y);
    if (f && B.vy >= 0) { if (!B.on && B.vy > 400) { api.shake(9, .3); dust(G, B.x - 20, f.y, 4); dust(G, B.x + 20, f.y, 4); } B.y = f.y; B.vy = 0; B.on = true; } else { B.y = ny; B.on = false; }
    if (G.dead) return;
    if (Math.abs(p.x - B.x) < 44 && p.y > B.y - 74 && p.y - PH < B.y - 4) {
      if (!p.on && p.vy > 60 && p.y < B.y - 46 && B.inv <= 0) {
        B.hp--; B.inv = 1.2; p.vy = -720; p.jumped = true;
        api.shake(10, .35); api.hitstop(.08); api.sfx.noise(.3, .1, 0, 300); api.sfx.tone(180, .3, 'square', .06, 0, 90);
        if (B.hp <= 0) { B.alive = false; B.t = 0; G.kills++; G.score += 2000; api.banner('Venceste o Escaravelho-Rei!', 'Corre para o arco da meta'); api.sfx.arp([523, 659, 784, 1047, 1319], .09, .2, 'triangle', .08); }
      } else if (B.inv <= 0 || p.star > 0) hurt(G, api);
    }
  }

  function killEnemy(G, api, e, fromBlock) {
    if (!e.alive) return;
    e.alive = false; e.squash = .5; e.flip = fromBlock || e.k !== 'walker'; G.kills++; G.score += 100 * Math.max(1, G.combo || 1);
    const X = sx(G, e.x), Y = sy(G, e.y - 14);
    api.burst(X, Y, 10, { color: '#fff', speed: 160, life: .45, gravity: 0 });
    api.float(X, Y - 18, '+' + 100 * Math.max(1, G.combo || 1), '#fde68a', 16);
    api.sfx.tone(600, .07, 'square', .05, 0, 200); api.sfx.noise(.08, .05, 0, 1200);
    api.vibe(12);
  }

  function collect(G, api, it) {
    it.got = true; it.t = 0;
    const p = G.p, X = sx(G, it.x), Y = sy(G, it.y);
    if (it.k === 'coin') { G.coins++; coinSfx(api); return; }
    if (it.k === 'star') {
      G.stars.push(it); G.score += 1000;
      api.sfx.arp([784, 988, 1175, 1568], .07, .18, 'triangle', .08); api.vibe([20, 30, 20]);
      api.burst(X, Y, 24, { color: '#fde047', speed: 240, life: .8, gravity: 0 });
      api.float(X, Y - 20, `★ ${G.stars.length}/${G.totalStars}`, '#fde047', 22);
      return;
    }
    api.sfx.arp([523, 784, 1047, 1568], .05, .14, 'triangle', .08);
    api.burst(X, Y, 16, { color: '#fff', speed: 200, life: .6, gravity: 0 });
    if (it.k === 'fire') { p.fire = true; api.float(X, Y - 20, 'Malagueta! (✦ / X)', '#fb923c', 18); }
    if (it.k === 'starp') { p.star = 9; api.float(X, Y - 20, 'Cristal: invencível!', '#e9d5ff', 18); }
    if (it.k === 'heart') { p.hp = Math.min(3, p.hp + 1); api.float(X, Y - 20, '+❤', '#f87171', 18); }
  }

  function winLevel(G, api) {
    G.win = true; G.winT = 0;
    api.sfx.arp([523, 659, 784, 1047, 784, 1047, 1319], .1, .2, 'triangle', .08);
    api.vibe([30, 40, 30, 40, 80]);
  }

  function finishLevel(G, api) {
    const L = G.L, par = L.par || 120;
    const timeB = Math.max(0, Math.round((par - G.time) * 20));
    const total = Math.max(0, G.coins * 10 + G.score + timeB - G.deaths * 250);
    const allStars = G.stars.length >= G.totalStars;
    const stars = 1 + (allStars ? 1 : 0) + (G.time <= par ? 1 : 0);
    const sv = save(); const prev = sv.s[L.id] || 0;
    sv.s[L.id] = Math.max(prev, stars); sv.u = Math.max(sv.u || 1, G.li + 2); putSave(sv);
    let rec = null;
    try { if (typeof GameProgress !== 'undefined') rec = GameProgress.record('platformer', { won: true, score: total, mode: L.id, meta: { stars, starCoins: G.stars.length, all: allStars, time: G.time, level: G.li + 1, world: L.world } }); } catch (e) {}
    const next = LEVELS[G.li + 1];
    const mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60);
    api.panel({
      icon: G.li === LEVELS.length - 1 ? '👑' : '🏁', title: G.li === LEVELS.length - 1 ? 'Salvaste os Mundos de Pip!' : 'Nível concluído!',
      big: total, stars,
      sub: (rec && rec.newBest ? '<div class="ak-rec">★ Novo recorde!</div>' : '') + `${L.name}`,
      stats: [['Tempo', `${mm}:${String(ss).padStart(2, '0')} / ${Math.floor(par / 60)}:${String(par % 60).padStart(2, '0')}`], ['Moedas', G.coins], ['Penas douradas', `${G.stars.length}/${G.totalStars}`], ['Quedas', G.deaths]],
      buttons: [
        ...(next ? [{ label: '▶ Próximo nível', primary: true, fn: () => api.play(next.id) }] : []),
        { label: '↺ Repetir', primary: !next, fn: () => api.play(L.id) },
        { label: 'Mapa dos mundos', fn: () => api.menu() },
      ],
    });
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  const sx = (G, x) => (x - G.cam.x) * G.z;
  const sy = (G, y) => (y - G.cam.y) * G.z;

  function camera(G, api, dt, snap) {
    const W = api.W, H = api.H, M = G.M, mapH = M.H * TS, mapW = M.W * TS;
    /* canvas ainda sem tamanho (arranque/redimensionar): não estragar a câmara com Infinity/NaN */
    if (!(W > 0 && H > 0 && isFinite(W) && isFinite(H))) return;
    if (!isFinite(G.cam.x) || !isFinite(G.cam.y)) snap = true;
    const zH = H / mapH, zW = W / (TS * 26);
    G.z = Math.min(W / (TS * 12), Math.max(zW, zH * .92));
    G.VW = W / G.z; G.VH = H / G.z;
    const p = G.p;
    G.look = U.lerp(G.look || 0, U.clamp((p.on ? p.gsp : p.vx) * .28, -150, 170), Math.min(1, (dt || 1) * 2.5));
    let tx = p.x - G.VW * .42 + G.look;
    tx = U.clamp(tx, 0, Math.max(0, mapW - G.VW));
    let ty;
    /* com botões de toque, o chão sobe acima deles (por baixo do mapa desenha-se mais terra) */
    const pad = G.touch ? 112 * pxK(api) / G.z : 0;
    /* ecrã alto (telemóvel na vertical): o mapa cabe todo — segue o Pip na vertical (mostra céu por cima
       em vez de uma parede de terra por baixo), sem passar do fundo do mapa */
    if (G.VH >= mapH) ty = U.clamp(p.y - G.VH * .62, -G.VH * .5, mapH - G.VH + pad);
    else {
      const want = p.y - G.VH * .58;
      ty = U.clamp(want, 0, mapH - G.VH + pad);
    }
    if (snap) { G.cam.x = tx; G.cam.y = ty; }
    else { G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 9); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * (p.on ? 5 : 3)); }
  }

  function update(G, dt, api) {
    G.t += dt;
    if (G.fade > 0) { G.fade -= dt; if (G.fadeTo && G.fade < .2) { const d = G.fadeTo; G.fadeTo = null; G.p.x = d.x; G.p.y = d.y; G.p.vx = G.p.vy = G.p.gsp = 0; camera(G, api, 0, true); } }
    if (G.win) {
      G.winT += dt;
      const p = G.p; p.gsp = 160; p.face = 1;
      if (p.on) { p.x += 160 * dt; const g = ground(G, p.x, p.y - 18, p.y + 20); if (g) p.y = g.y; }
      p.anim += dt * 7;
      if (Math.random() < dt * 6) { const X = U.rand(api.W * .2, api.W * .8), Y = U.rand(api.H * .15, api.H * .5); api.burst(X, Y, 22, { color: U.pick(['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c']), speed: 220, life: .9, gravity: 120 }); api.sfx.noise(.2, .04, 0, 1500); }
      stepWorld(G, dt, api); camera(G, api, dt);
      if (G.winT > 2.4 && !G.sent) { G.sent = true; finishLevel(G, api); }
      return;
    }
    if (G.dead) {
      G.deadT += dt;
      const p = G.p; if (G.why !== 'fall') { p.vy += P.g * dt; p.y += p.vy * dt; }
      stepWorld(G, dt, api);
      if (G.deadT > 1.5) {
        G.dead = false;
        const c = G.check, st = G.M.start;
        const fire = G.p.fire;
        spawn(G, c ? c.x : st[0], c ? c.y : st[1]); G.p.fire = fire; G.p.inv = 1.5;
        camera(G, api, 0, true);
      }
      return;
    }
    G.time += dt;
    const I = input(G, api);
    /* entrar numa porta */
    if (I.u && G.p.door && !G.fadeTo && G.fade <= 0) {
      const d = G.p.door, pair = (G.M.doors[d.id] || []).find(o => o !== d);
      if (pair) { G.fade = .55; G.fadeTo = pair; api.sfx.arp([392, 523], .08, .12, 'triangle', .06); G.doorsUsed = (G.doorsUsed || 0) + 1; }
    }
    if (G.fade > 0) return;
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) { stepPlayer(G, dt / n, api, I); if (G.dead) break; }
    stepWorld(G, dt, api);
    camera(G, api, dt);
  }

  function sparkle(G, x, y, n, col) { for (let i = 0; i < n; i++) { const a = U.rand(0, TAU), v = U.rand(60, 160); G.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: U.rand(.3, .55), s: U.rand(1.5, 3), c: col }); } }
  /* aterrar de um mergulho: onda de choque — parte caixotes / abre caixas por baixo dos pés, derruba inimigos ao lado */
  function diveImpact(G, api, gnd, vy) {
    const p = G.p;
    api.shake(5, .22); api.vibe(18);
    api.sfx.noise(.16, .07, 0, 700); api.sfx.tone(140, .14, 'square', .04, 0, 70);
    for (let i = 0; i < 12; i++) { const s = i < 6 ? -1 : 1; G.fx.push({ k: 'dust', x: p.x + s * U.rand(2, 10), y: p.y - 2, vx: s * U.rand(90, 220), vy: U.rand(-70, -10), life: U.rand(.3, .5), s: U.rand(3.5, 6.5) }); }
    p.sq = .32;
    if (gnd && gnd.r != null && !SLOPE[gnd.ch]) {
      const r = gnd.r, a = Math.floor((p.x - PW / 2 + 3) / TS), b = Math.floor((p.x + PW / 2 - 3) / TS);
      for (let cx = a; cx <= b; cx++) {
        const ch = tAt(G, cx, r);
        if (ch === 'B') { hitBlock(G, api, cx, r); p.on = false; p.vy = 60; p.dive = true; }
        else if (ch === '?' || ch === 'P' || ch === '!' || ch === 'H' || ch === 'Q') hitBlock(G, api, cx, r);
      }
    }
    G.M.enemies.forEach(e => {
      if (!e.alive || !e.act || e.k === 'lavab' || e.k === 'flyer') return;
      if (Math.abs(e.x - p.x) < 64 && Math.abs(e.y - p.y) < 24) { if (e.k === 'spiky') { e.vx = Math.sign(e.x - p.x || 1) * 55; e.vy = -260; e.on = false; } else killEnemy(G, api, e, true); }
    });
  }
  function dust(G, x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ k: 'dust', x: x + U.rand(-8, 8), y: y - 3, vx: U.rand(-70, 70), vy: U.rand(-60, -10), life: U.rand(.25, .45), s: U.rand(3, 6) }); }
  function puff(G, x, y) { for (let i = 0; i < 5; i++) G.fx.push({ k: 'dust', x, y, vx: U.rand(-80, 80), vy: U.rand(-80, 20), life: .3, s: 4 }); }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  /* Direção de arte: "livro ilustrado" — formas redondas, contorno castanho-escuro quente nas
     personagens, sombra em dois tons com a luz a vir de cima/esquerda, paletas por mundo.
     O terreno é desenhado como UMA superfície contínua (terra com padrão sem costuras + uma
     faixa de relva/areia/neve/pedra que segue o contorno), em vez de tile a tile — assim as
     rampas e os planaltos encaixam sem degraus nem "picos". */
  const _tc = new Map();
  const OUT = '#2a1406';
  /* tile em cache (blocos soltos: pedra, caixotes, caixas-surpresa, tábuas, picos) */
  function tileSprite(th, ch, mask) {
    const key = th.id + ch + mask;
    let c = _tc.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = TS * 2; const x = c.getContext('2d');
    x.scale(2, 2);
    const top = mask & 1;
    const rr = (a, b, w, h, rad) => U.rr(x, a, b, w, h, rad);
    if (ch === '%') {
      /* pedra talhada: bisel, juntas, fissura; neve ou musgo por cima */
      x.fillStyle = th.stone2; rr(0, 0, TS, TS, 5); x.fill();
      const g = x.createLinearGradient(0, 0, TS, TS); g.addColorStop(0, th.stone); g.addColorStop(1, th.stone2);
      x.fillStyle = g; rr(1.5, 1.5, TS - 3, TS - 4.5, 4); x.fill();
      x.fillStyle = 'rgba(255,255,255,.26)'; rr(3.5, 2.5, TS - 7, 2.6, 1.3); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.2; x.beginPath();
      x.moveTo(2, TS / 2); x.lineTo(TS - 2, TS / 2); x.moveTo(TS * .62, 2); x.lineTo(TS * .62, TS / 2); x.moveTo(TS * .3, TS / 2); x.lineTo(TS * .3, TS - 2); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.moveTo(2, TS / 2 + 1.3); x.lineTo(TS - 2, TS / 2 + 1.3); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1; x.beginPath(); x.moveTo(6, 6); x.lineTo(9, 9.5); x.lineTo(8, 13); x.moveTo(22, 21); x.lineTo(25, 24); x.stroke();
      x.strokeStyle = 'rgba(20,10,5,.5)'; x.lineWidth = 1.4; rr(.7, .7, TS - 1.4, TS - 1.4, 5); x.stroke();
      if (top && th.cap === 'snow') {
        x.fillStyle = '#fff'; x.strokeStyle = '#b9dcf2'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(-.5, 7); x.quadraticCurveTo(-.5, -1.5, 6, -1.5); x.lineTo(TS - 6, -1.5); x.quadraticCurveTo(TS + .5, -1.5, TS + .5, 7);
        for (let i = 6; i >= 0; i--) x.quadraticCurveTo(i * TS / 6 + TS / 12, 9.5, i * TS / 6, 7 + (i % 2 ? 1.5 : 0));
        x.fill(); x.stroke();
      } else if (top && th.cap === 'grass') {
        x.fillStyle = '#5aa83a'; [[4, 2.2], [11, 1.6], [24, 2.4]].forEach(([a, r]) => { x.beginPath(); x.arc(a, 1.5, r * 1.4, Math.PI, 0); x.fill(); });
      }
    } else if (ch === 'B') {
      /* caixote de madeira (parte-se por baixo ou com um mergulho por cima) */
      x.fillStyle = '#4a2a12'; rr(0, 0, TS, TS, 4); x.fill();
      const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, '#e2aa6c'); g.addColorStop(1, '#a86d38');
      x.fillStyle = g; rr(2, 2, TS - 4, TS - 4, 3); x.fill();
      x.strokeStyle = 'rgba(80,40,10,.35)'; x.lineWidth = 1; [9.5, 16, 22.5].forEach(yy => { x.beginPath(); x.moveTo(3, yy); x.lineTo(TS - 3, yy); x.stroke(); });
      x.strokeStyle = '#6b3d18'; x.lineWidth = 3.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(5, 5); x.lineTo(TS - 5, TS - 5); x.stroke();
      x.strokeStyle = '#c98a4e'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(5, 4); x.lineTo(TS - 5, TS - 6); x.stroke();
      x.fillStyle = '#7d4a20'; [[3, 3], [TS - 6, 3], [3, TS - 6], [TS - 6, TS - 6]].forEach(([a, b]) => { rr(a, b, 3, 3, 1); x.fill(); });
      x.fillStyle = '#d8d0c0'; [[4.5, 4.5], [TS - 4.5, 4.5], [4.5, TS - 4.5], [TS - 4.5, TS - 4.5]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, .9, 0, TAU); x.fill(); });
      x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(3, 2.5, TS - 6, 1.5);
    } else if (ch === '?') {
      /* caixa-surpresa: turquesa facetada com uma estrela dourada (desenho próprio) */
      x.fillStyle = '#063f3b'; rr(0, 0, TS, TS, 7); x.fill();
      const g = x.createLinearGradient(0, 0, TS, TS); g.addColorStop(0, '#6ff2dc'); g.addColorStop(1, '#0d8a80');
      x.fillStyle = g; rr(1.6, 1.6, TS - 3.2, TS - 4.2, 6); x.fill();
      x.fillStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.moveTo(3, 3); x.lineTo(TS - 3, 3); x.lineTo(TS / 2, TS / 2); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,40,40,.18)'; x.beginPath(); x.moveTo(3, TS - 4); x.lineTo(TS - 3, TS - 4); x.lineTo(TS / 2, TS / 2); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.55)'; rr(4, 3, 7, 2, 1); x.fill();
      x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.4 : 9.8; x.lineTo(TS / 2 + Math.cos(a) * r, TS / 2 + 1 + Math.sin(a) * r); } x.closePath();
      x.fillStyle = '#ffe14d'; x.fill(); x.strokeStyle = '#8a4b05'; x.lineWidth = 1.6; x.lineJoin = 'round'; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(TS / 2 - 2, TS / 2 - 2, 1.4, 0, TAU); x.fill();
    } else if (ch === 'U') {
      x.fillStyle = '#3d2710'; rr(0, 0, TS, TS, 6); x.fill(); x.fillStyle = '#8c6a44'; rr(1.6, 1.6, TS - 3.2, TS - 4.2, 5); x.fill();
      x.fillStyle = 'rgba(0,0,0,.16)'; rr(4, 4, TS - 8, TS - 9, 3); x.fill();
      [[5, 5], [TS - 7, 5], [5, TS - 8], [TS - 7, TS - 8]].forEach(([a, b]) => { x.fillStyle = '#4a3018'; x.beginPath(); x.arc(a + 1, b + 1, 1.4, 0, TAU); x.fill(); });
    } else if (ch === '=') {
      /* tábuas (prado/deserto/gelo) ou grade de ferro (castelo) */
      const cast = th.id === 'castelo';
      const g = x.createLinearGradient(0, 0, 0, 12); g.addColorStop(0, cast ? '#a3a9ba' : '#c99560'); g.addColorStop(1, cast ? '#5a5f71' : '#8a5b31');
      x.fillStyle = cast ? '#262935' : '#4a2a12'; rr(0, 0, TS, 12.5, 3); x.fill();
      x.fillStyle = g; rr(1, 1, TS - 2, 10, 2.5); x.fill();
      x.fillStyle = 'rgba(255,255,255,.32)'; x.fillRect(2, 1.6, TS - 4, 1.6);
      x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1; x.beginPath(); x.moveTo(TS / 2, 1.5); x.lineTo(TS / 2, 10.5); x.stroke();
      x.fillStyle = cast ? '#2e3240' : '#5a3a1a'; [5, TS - 5].forEach(a => { x.beginPath(); x.arc(a, 6, 1.2, 0, TAU); x.fill(); });
      if (th.cap === 'snow') { x.fillStyle = '#fff'; rr(0, -2.5, TS, 4.5, 2); x.fill(); }
    } else if (ch === '^') {
      /* picos de ferro com base escura — lê-se logo como perigo */
      x.fillStyle = '#3b3f4d'; rr(0, TS - 5, TS, 5, 2); x.fill();
      for (let i = 0; i < 4; i++) {
        const bx = i * 8;
        const g = x.createLinearGradient(bx, 0, bx + 8, 0); g.addColorStop(0, '#f1f4f8'); g.addColorStop(.5, '#b6bdc9'); g.addColorStop(1, '#6b7280');
        x.fillStyle = g; x.beginPath(); x.moveTo(bx + .5, TS - 4); x.lineTo(bx + 4, TS - 18); x.lineTo(bx + 7.5, TS - 4); x.closePath(); x.fill();
        x.strokeStyle = '#2b2f3a'; x.lineWidth = 1.1; x.lineJoin = 'round'; x.stroke();
      }
      x.fillStyle = '#dc2626'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(i * 8 + 4, TS - 17, 1, 0, TAU); x.fill(); }
    }
    _tc.set(key, c);
    return c;
  }

  /* padrão de terra/areia/gelo/rocha (128×128, sem costuras) */
  const _pat = new Map();
  function dirtPattern(ctx, th) {
    const k = th.id; let e = _pat.get(k);
    if (e && e.ctx === ctx) return e.p;
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    let s = 97 + th.id.length * 131; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    x.fillStyle = th.dirt; x.fillRect(0, 0, N, N);
    const wrap = fn => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } };
    /* estratos ondulados (período = N → sem costuras) */
    for (let i = 0; i < 4; i++) {
      const y0 = i * 32 + 12 + rnd() * 6, amp = 2 + rnd() * 3, ph = rnd() * TAU;
      x.strokeStyle = i % 2 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; x.lineWidth = 5 + rnd() * 3;
      x.beginPath(); for (let X = 0; X <= N; X += 4) x.lineTo(X, y0 + Math.sin(X / N * TAU * 2 + ph) * amp); x.stroke();
    }
    /* grão */
    for (let i = 0; i < 110; i++) { const a = rnd() * N, b = rnd() * N, r = .6 + rnd() * 1.1; x.fillStyle = rnd() < .6 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); }
    /* pedrinhas com contorno e brilho */
    for (let i = 0; i < 8; i++) {
      const a = rnd() * N, b = rnd() * N, rx = 2.5 + rnd() * 3.5, ry = 1.8 + rnd() * 2, rot = rnd() - .5;
      wrap(() => {
        x.fillStyle = th.dirt2; x.beginPath(); x.ellipse(a + .8, b + 1, rx + .9, ry + .9, rot, 0, TAU); x.fill();
        x.fillStyle = th.dirtHi; x.beginPath(); x.ellipse(a, b, rx, ry, rot, 0, TAU); x.fill();
        x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(a - rx * .35, b - ry * .4, rx * .35, ry * .3, rot, 0, TAU); x.fill();
      });
    }
    if (th.id === 'prado') {
      /* raízes finas */
      for (let i = 0; i < 5; i++) { const a = rnd() * N, b = rnd() * N, l = 10 + rnd() * 14, d = rnd() < .5 ? -1 : 1; wrap(() => { x.strokeStyle = 'rgba(70,40,15,.45)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + d * l * .5, b + l * .3, a + d * l * .2, b + l); x.stroke(); }); }
    } else if (th.id === 'deserto') {
      for (let i = 0; i < 3; i++) { const a = rnd() * N, b = rnd() * N; wrap(() => { x.strokeStyle = 'rgba(120,70,30,.35)'; x.lineWidth = 1.1; x.beginPath(); for (let k = 0; k < 18; k++) { const r = k * .35, an = k * .7; x.lineTo(a + Math.cos(an) * r, b + Math.sin(an) * r); } x.stroke(); }); }
    } else if (th.id === 'gelo') {
      for (let i = 0; i < 6; i++) { const a = rnd() * N, b = rnd() * N, l = 8 + rnd() * 12; wrap(() => { x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 1; x.beginPath(); x.moveTo(a, b); x.lineTo(a + l * .6, b + l * .3); x.lineTo(a + l * .5, b + l); x.stroke(); x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(a, b); x.lineTo(a + l * .6, b + l * .3); x.lineTo(a - l * .2, b + l * .6); x.fill(); }); }
    } else if (th.id === 'castelo') {
      for (let i = 0; i < 6; i++) { const a = rnd() * N, b = rnd() * N; wrap(() => { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 6, b + 4); x.lineTo(a + 4, b + 10); x.stroke(); }); }
      for (let i = 0; i < 10; i++) { const a = rnd() * N, b = rnd() * N; x.fillStyle = 'rgba(255,120,40,.55)'; x.beginPath(); x.arc(a, b, .9, 0, TAU); x.fill(); }
    }
    const p = ctx.createPattern(c, 'repeat');
    _pat.set(k, { ctx, p });
    return p;
  }

  function draw(G, ctx, W, H, api) {
    const th = G.th, z = G.z;
    if (!(W > 0 && H > 0 && isFinite(W) && isFinite(H) && G.z > 0)) return;   /* canvas ainda sem tamanho (arranque) */
    drawBG(G, ctx, W, H);
    ctx.save();
    ctx.scale(z, z); ctx.translate(-G.cam.x, -G.cam.y);
    const c0 = Math.floor(G.cam.x / TS) - 1, c1 = Math.ceil((G.cam.x + G.VW) / TS) + 1, r0 = Math.max(0, Math.floor(G.cam.y / TS) - 1), r1 = Math.min(G.M.H - 1, Math.ceil((G.cam.y + G.VH) / TS) + 1);
    /* por baixo do mapa: prolonga a última linha (terra / lava) */
    const below = Math.ceil((G.cam.y + G.VH) / TS) - G.M.H;
    if (below > 0) for (let x = c0; x <= c1; x++) {
      const ch = tAt(G, x, G.M.H - 1);
      if (ch === '~') { ctx.fillStyle = '#e2361a'; ctx.fillRect(x * TS - .5, G.M.H * TS, TS + 1, below * TS + 2); }
      else if (SOLID.has(ch) || ch === 'F' || SLOPE[ch]) { ctx.fillStyle = ch === '%' ? G.th.stone2 : dirtPattern(ctx, th); ctx.fillRect(x * TS - .5, G.M.H * TS - .5, TS + 1, below * TS + 2); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x * TS - .5, G.M.H * TS - .5, TS + 1, below * TS + 2); }
    }
    /* lava por trás */
    drawLava(G, ctx, c0, c1, r0, r1);
    G.M.loops.forEach(L => drawLoop(G, ctx, L, false));
    drawTerrain(G, ctx, c0, c1, r0, r1, false);
    drawTiles(G, ctx, c0, c1, r0, r1);
    drawObjects(G, ctx);
    drawItems(G, ctx);
    drawEnemies(G, ctx);
    if (G.boss) drawBoss(G, ctx);
    G.balls.forEach(b => {
      const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 14); g.addColorStop(0, '#fffbe0'); g.addColorStop(.35, '#ffb347'); g.addColorStop(.7, 'rgba(239,68,68,.6)'); g.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,60,.45)'; ctx.beginPath(); ctx.arc(b.x - Math.sign(b.vx) * 9, b.y + 2, 5, 0, TAU); ctx.fill();
    });
    drawPip(G, ctx);
    G.M.loops.forEach(L => drawLoop(G, ctx, L, true));
    /* paredes falsas por cima (ficam translúcidas quando o Pip está dentro) */
    drawFake(G, ctx, c0, c1, r0, r1);
    G.fx.forEach(f => {
      if (f.k === 'dust') { ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 2.4)); ctx.fillStyle = th.cap === 'snow' ? '#fff' : th.cap === 'stone' ? 'rgba(170,165,175,.9)' : 'rgba(245,235,215,.92)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (1.3 - f.life), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      else if (f.k === 'spark') { ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 3)); star(ctx, f.x, f.y, f.s * 1.6, f.c || '#fde68a'); ctx.globalAlpha = 1; }
      else if (f.k === 'brick') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.fillStyle = '#c48a52'; U.rr(ctx, -9, -3, 18, 6, 1.5); ctx.fill(); ctx.strokeStyle = '#4a2a12'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
    });
    G.pops.forEach(c => { const k = Math.abs(Math.cos(c.t * 18)); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 9 * k + 1, 11, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a5300'; ctx.lineWidth = 1.8; ctx.stroke(); });
    ctx.restore();
    /* desvanecer ao entrar em portas */
    if (G.fade > 0) { const k = G.fade > .35 ? 1 - (G.fade - .35) / .2 : G.fade / .35; ctx.fillStyle = `rgba(0,0,0,${U.clamp(k, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
    drawHUD(G, ctx, W, H, api);
  }

  /* ── fundo: céu, sol, nuvens e 3 camadas de paralaxe com detalhe próprio de cada mundo ── */
  function cloud(ctx, x, y, s, col, sh) {
    const bl = [[0, 0, 1], [1.1, -.45, 1.25], [2.25, -.1, 1.05], [3.1, .2, .8], [-.9, .25, .75]];
    ctx.fillStyle = sh; ctx.beginPath(); bl.forEach(([a, b, r]) => { ctx.moveTo(x + a * 22 * s + r * 24 * s, y + b * 22 * s + 5 * s); ctx.arc(x + a * 22 * s, y + b * 22 * s + 5 * s, r * 24 * s, 0, TAU); }); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); bl.forEach(([a, b, r]) => { ctx.moveTo(x + a * 22 * s + r * 22 * s, y + b * 22 * s); ctx.arc(x + a * 22 * s, y + b * 22 * s, r * 22 * s, 0, TAU); }); ctx.fill();
  }
  function drawBG(G, ctx, W, H) {
    const th = G.th, z = G.z, t = G.t;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(.6, th.sky[1]); g.addColorStop(1, th.sky[2] || th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const baseY = sy(G, G.M.H * TS) - 40 * z;
    const n1 = x => { const i = Math.floor(x), f = x - i, a = hsh(i), b = hsh(i + 1); return a + (b - a) * f * f * (3 - 2 * f); };
    /* sol / brilho */
    const sunX = W * .74, sunY = H * .2;
    if (th.id === 'castelo') {
      const lg = ctx.createLinearGradient(0, H * .35, 0, H); lg.addColorStop(0, 'rgba(255,90,40,0)'); lg.addColorStop(1, 'rgba(255,90,40,.4)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      const mg = ctx.createRadialGradient(W * .2, H * .18, 0, W * .2, H * .18, 90); mg.addColorStop(0, 'rgba(255,220,200,.9)'); mg.addColorStop(.25, 'rgba(255,170,140,.45)'); mg.addColorStop(1, 'rgba(255,120,90,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe3d0'; ctx.beginPath(); ctx.arc(W * .2, H * .18, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,60,60,.35)'; ctx.beginPath(); ctx.arc(W * .2 - 6, H * .18 - 4, 5, 0, TAU); ctx.arc(W * .2 + 7, H * .18 + 6, 3.5, 0, TAU); ctx.fill();
    } else {
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 220); sg.addColorStop(0, 'rgba(255,252,230,.95)'); sg.addColorStop(.12, 'rgba(255,240,190,.6)'); sg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      /* raios de luz a rodar devagar */
      ctx.save(); ctx.translate(sunX, sunY); ctx.rotate(t * .02); ctx.fillStyle = 'rgba(255,255,240,.06)';
      for (let i = 0; i < 9; i++) { ctx.rotate(TAU / 9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 1.2, -60); ctx.lineTo(W * 1.2, 60); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,253,240,.95)'; ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, TAU); ctx.fill();
    }
    /* nuvens (duas profundidades) */
    if (th.id !== 'castelo') for (let i = 0; i < 9; i++) {
      const far = i < 4, par = far ? .03 : .07, sp = far ? 4 : 9, span = W + 360;
      const cx = ((i * 233 - G.cam.x * par * z + t * sp) % span + span) % span - 180, cy = H * (far ? .1 + (i % 3) * .06 : .18 + (i * 37 % 25) / 100);
      cloud(ctx, cx, cy, far ? .6 : .9 + (i % 2) * .2, far ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.95)', th.id === 'deserto' ? 'rgba(240,170,120,.4)' : 'rgba(170,200,230,.45)');
    } else {
      /* fumo escuro a passar */
      for (let i = 0; i < 6; i++) { const span = W + 400, cx = ((i * 300 - G.cam.x * .05 * z + t * 6) % span + span) % span - 200; cloud(ctx, cx, H * (.08 + (i % 3) * .07), 1.1, 'rgba(60,20,35,.55)', 'rgba(20,5,15,.35)'); }
    }
    /* camada 1 (longe): montanhas / mesas / picos / vulcões */
    const off1 = G.cam.x * .06, sp1 = 340;
    const k0 = Math.floor((off1 - 300) / sp1), k1 = Math.ceil((off1 + W / z + 300) / sp1);
    for (let k = k0; k <= k1; k++) {
      const h = hsh(k * 7 + 3), px = (k * sp1 + h * 120 - off1) * z, hh = (150 + h * 140) * z, wd = (200 + h * 120) * z, by = baseY - 60 * z;
      if (th.id === 'deserto') {
        ctx.fillStyle = th.far; ctx.beginPath(); ctx.moveTo(px - wd * .6, by); ctx.lineTo(px - wd * .4, by - hh * .7); ctx.lineTo(px + wd * .35, by - hh * .7); ctx.lineTo(px + wd * .6, by); ctx.fill();
        ctx.strokeStyle = 'rgba(160,80,40,.25)'; ctx.lineWidth = 3 * z; for (let s = 1; s < 4; s++) { const yy = by - hh * .7 * s / 4; ctx.beginPath(); ctx.moveTo(px - wd * (.6 - .2 * s / 4) + 6, yy); ctx.lineTo(px + wd * (.6 - .25 * s / 4) - 6, yy); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,230,190,.35)'; ctx.beginPath(); ctx.moveTo(px - wd * .4, by - hh * .7); ctx.lineTo(px + wd * .35, by - hh * .7); ctx.lineTo(px + wd * .3, by - hh * .64); ctx.lineTo(px - wd * .42, by - hh * .64); ctx.fill();
      } else {
        const peak = th.id === 'castelo' ? .55 : .5, col = th.far;
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px - wd, by); ctx.quadraticCurveTo(px - wd * .3, by - hh * .55, px, by - hh); ctx.quadraticCurveTo(px + wd * .35, by - hh * .5, px + wd, by); ctx.fill();
        /* lado da sombra */
        ctx.fillStyle = 'rgba(0,20,60,.12)'; ctx.beginPath(); ctx.moveTo(px, by - hh); ctx.quadraticCurveTo(px + wd * .35, by - hh * .5, px + wd, by); ctx.lineTo(px + wd * .1, by); ctx.fill();
        if (th.id === 'castelo') {
          const gl = ctx.createRadialGradient(px, by - hh, 0, px, by - hh, 40 * z); gl.addColorStop(0, `rgba(255,120,40,${.55 + Math.sin(t * 2 + k) * .15})`); gl.addColorStop(1, 'rgba(255,80,30,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, by - hh, 40 * z, 0, TAU); ctx.fill();
        } else {
          /* neve no cume */
          ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.moveTo(px, by - hh);
          ctx.quadraticCurveTo(px - wd * .1, by - hh * .86, px - wd * .2, by - hh * (1 - peak * .45));
          for (let s = 0; s < 4; s++) ctx.lineTo(px - wd * .2 + (s + .5) * wd * .1, by - hh * (1 - peak * .45) + (s % 2 ? -6 : 6) * z);
          ctx.lineTo(px + wd * .2, by - hh * (1 - peak * .5)); ctx.quadraticCurveTo(px + wd * .1, by - hh * .86, px, by - hh); ctx.fill();
        }
      }
    }
    /* névoa de distância */
    const hz = ctx.createLinearGradient(0, baseY - 220 * z, 0, baseY); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, th.haze);
    ctx.fillStyle = hz; ctx.fillRect(0, baseY - 220 * z, W, 220 * z + 2); ctx.fillStyle = th.haze; ctx.fillRect(0, baseY, W, H);
    /* camada 2 (meio): colinas com árvores / dunas com cactos / pinhal / torres */
    const off2 = G.cam.x * .2, hill = u => baseY - (36 + n1(u / 170 + 40) * 80) * z;
    const lay = (off, col, f) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, f(x / z + off)); ctx.lineTo(W, H); ctx.fill(); };
    const sp2 = th.id === 'castelo' ? 150 : 64, j0 = Math.floor((off2 - 60) / sp2), j1 = Math.ceil((off2 + W / z + 60) / sp2);
    for (let j = j0; j <= j1; j++) {
      const h = hsh(j * 13 + 5); if (h < .35 && th.id !== 'castelo') continue;
      const u = j * sp2 + h * 30, px = (u - off2) * z, by = hill(u) + 6 * z;
      if (th.id === 'prado') {
        const r = (13 + h * 12) * z;
        ctx.fillStyle = th.trunk; ctx.fillRect(px - 2 * z, by - r * 1.4, 4 * z, r * 1.4);
        ctx.fillStyle = th.mid; ctx.beginPath(); [[0, 1.7, 1], [-.7, 1.25, .7], [.7, 1.3, .72]].forEach(([a, b, k]) => { ctx.moveTo(px + a * r + k * r, by - r * b); ctx.arc(px + a * r, by - r * b, r * k, 0, TAU); }); ctx.fill();
        ctx.fillStyle = th.midHi; ctx.beginPath(); ctx.arc(px - r * .3, by - r * 2, r * .5, 0, TAU); ctx.fill();
      } else if (th.id === 'gelo') {
        const r = (10 + h * 10) * z;
        ctx.fillStyle = th.mid; for (let s = 0; s < 3; s++) { const yy = by - s * r * .8; ctx.beginPath(); ctx.moveTo(px - r * (1 - s * .22), yy); ctx.lineTo(px, yy - r * 1.3); ctx.lineTo(px + r * (1 - s * .22), yy); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let s = 0; s < 3; s++) { const yy = by - s * r * .8 - r * 1.3; ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px - r * .32, yy + r * .42); ctx.lineTo(px + r * .32, yy + r * .42); ctx.fill(); }
      } else if (th.id === 'deserto') {
        if (h > .72) { ctx.fillStyle = th.midHi; const s = (.6 + h * .5) * z; ctx.fillRect(px - 4 * s, by - 46 * s, 8 * s, 48 * s); ctx.fillRect(px - 16 * s, by - 32 * s, 6 * s, 16 * s); ctx.fillRect(px - 16 * s, by - 20 * s, 14 * s, 6 * s); ctx.fillRect(px + 9 * s, by - 38 * s, 6 * s, 14 * s); ctx.fillRect(px + 3 * s, by - 28 * s, 12 * s, 6 * s); }
      } else {
        /* castelo: torres com janelas acesas */
        const tw = (20 + h * 16) * z, thh = (70 + h * 90) * z, tb = baseY + 10 * z;
        ctx.fillStyle = th.mid; ctx.fillRect(px - tw / 2, tb - thh, tw, thh);
        for (let m = 0; m < 3; m++) ctx.fillRect(px - tw / 2 + m * tw * .4, tb - thh - 7 * z, tw * .22, 7 * z);
        ctx.beginPath(); ctx.moveTo(px - tw * .6, tb - thh - 7 * z); ctx.lineTo(px, tb - thh - 40 * z); ctx.lineTo(px + tw * .6, tb - thh - 7 * z); ctx.fill();
        ctx.fillStyle = `rgba(255,190,90,${.65 + Math.sin(t * 3 + j) * .2})`; for (let w = 0; w < 3; w++) if (hsh(j * 3 + w) > .4) U.rr(ctx, px - 3 * z, tb - thh + (14 + w * 22) * z, 6 * z, 10 * z, 3 * z), ctx.fill();
      }
    }
    lay(off2, th.mid, hill);
    /* camada 3 (perto): arbustos / dunas / montes de neve / rochas */
    const off3 = G.cam.x * .38;
    if (th.id === 'prado' || th.id === 'gelo') {
      const sp3 = 46, a0 = Math.floor((off3 - 50) / sp3), a1 = Math.ceil((off3 + W / z + 50) / sp3);
      for (let j = a0; j <= a1; j++) {
        const h = hsh(j * 5 + 11), u = j * sp3, px = (u - off3) * z, r = (16 + h * 18) * z, by = baseY + 4 * z;
        ctx.fillStyle = th.near; ctx.beginPath(); ctx.moveTo(px - r, by - r * .5); ctx.arc(px, by - r * .5, r, Math.PI, 0); ctx.lineTo(px + r, by + 4 * z); ctx.lineTo(px - r, by + 4 * z); ctx.closePath(); ctx.moveTo(px + r * .1, by - r * .2); ctx.arc(px + r * .8, by - r * .2, r * .7, Math.PI, 0); ctx.lineTo(px + r * 1.5, by + 4 * z); ctx.lineTo(px + r * .1, by + 4 * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.nearHi; ctx.beginPath(); ctx.arc(px - r * .25, by - r * .75, r * .42, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = th.near; ctx.fillRect(0, baseY + 2 * z, W, H);
    } else lay(off3, th.near, u => baseY - (10 + n1(u / 80 + 90) * 36) * z);
    /* partículas de ambiente: pólen / pó / flocos / brasas */
    const amb = th.id === 'gelo' ? 40 : 18;
    for (let i = 0; i < amb; i++) {
      const sp = th.id === 'gelo' ? 26 + (i % 5) * 7 : 10 + (i % 4) * 5;
      let ax = ((i * 137.7 - G.cam.x * (.3 + (i % 3) * .1) * z + Math.sin(t * .7 + i) * 30) % (W + 40) + W + 40) % (W + 40) - 20;
      let ay = th.id === 'castelo' ? H - ((t * sp + i * 71) % (H + 40)) : ((t * sp + i * 71) % (H + 40)) - 20;
      if (th.id === 'gelo') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(ax, ay, 1.2 + (i % 3) * .7, 0, TAU); ctx.fill(); }
      else if (th.id === 'castelo') { ctx.fillStyle = `rgba(255,${140 + (i % 3) * 40},60,${.4 + (i % 3) * .2})`; ctx.fillRect(ax, ay, 2, 2); }
      else if (th.id === 'deserto') { ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.fillRect(ax, ay * .6 + H * .3, 1.6, 1.6); }
      else { ctx.fillStyle = 'rgba(255,255,220,.6)'; ctx.beginPath(); ctx.arc(ax, ay * .7 + H * .1, 1.3, 0, TAU); ctx.fill(); }
    }
  }
  /* hash inteiro → [0,1) (Math.imul: sem perder precisão com números grandes) */
  const hsh = n => { n = Math.imul((n | 0) ^ 61 ^ ((n | 0) >>> 16), 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };

  /* ── terreno contínuo ── */
  const isTerr = ch => ch === '#' || !!SLOPE[ch];
  const solidish = ch => SOLID.has(ch) || ch === 'F' || !!SLOPE[ch];
  function drawTerrain(G, ctx, c0, c1, r0, r1, fake) {
    const th = G.th, M = G.M, t = G.t, want = fake ? (ch => ch === 'F') : isTerr;
    const pth = new Path2D(), segs = [], eL = [], eR = [], eB = [], flats = [];
    for (let y = r0; y <= r1; y++) for (let x = Math.max(0, c0); x <= Math.min(M.W - 1, c1); x++) {
      const ch = tAt(G, x, y); if (!want(ch)) continue;
      const x0 = x * TS, y0 = y * TS, yb = y0 + TS;
      if (SLOPE[ch]) {
        const h0 = hgt(ch, 0), h1 = hgt(ch, TS);
        pth.moveTo(x0, yb + .5); pth.lineTo(x0, yb - h0); pth.lineTo(x0 + TS, yb - h1); pth.lineTo(x0 + TS, yb + .5); pth.closePath();
        segs.push([x0, yb - h0, x0 + TS, yb - h1, 1]);
        continue;
      }
      pth.rect(x0, y0, TS, TS);
      const up = !solidish(tAt(G, x, y - 1));
      if (up) { segs.push([x0, y0, x0 + TS, y0, 0]); if (tAt(G, x, y - 1) === '.') flats.push([x, y]); }
      if (x > 0 && !solidish(tAt(G, x - 1, y))) eL.push([x0, y0, up]);
      if (x < M.W - 1 && !solidish(tAt(G, x + 1, y))) eR.push([x0 + TS, y0, up]);
      if (y < M.H - 1 && !solidish(tAt(G, x, y + 1))) eB.push([x0, yb, x, y]);
    }
    if (!segs.length && !eL.length && !eR.length) { ctx.fillStyle = dirtPattern(ctx, th); ctx.fill(pth); return; }
    ctx.fillStyle = dirtPattern(ctx, th); ctx.fill(pth);
    /* sombra interior: debaixo da relva, nas faces da direita e por baixo das saliências */
    ctx.save(); ctx.clip(pth);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const segPath = off => { const p = new Path2D(); segs.forEach(s => { p.moveTo(s[0] - (s[4] ? .5 : 0), s[1] + off); p.lineTo(s[2] + (s[4] ? .5 : 0), s[3] + off); }); return p; };
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 22; ctx.stroke(segPath(14));
    eL.forEach(([x, y]) => { const g = ctx.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, th.dirtHi); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = .45; ctx.fillStyle = g; ctx.fillRect(x, y, 8, TS); ctx.globalAlpha = 1; });
    eR.forEach(([x, y]) => { const g = ctx.createLinearGradient(x - 10, 0, x, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); ctx.fillStyle = g; ctx.fillRect(x - 10, y, 10, TS); });
    eB.forEach(([x, y]) => { const g = ctx.createLinearGradient(0, y - 10, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(x, y - 10, TS, 10); });
    ctx.restore();
    /* contorno das arestas expostas */
    ctx.strokeStyle = th.edge; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath();
    eL.forEach(([x, y, up]) => { ctx.moveTo(x, y + (up ? 6 : 0)); ctx.lineTo(x, y + TS); });
    eR.forEach(([x, y, up]) => { ctx.moveTo(x, y + (up ? 6 : 0)); ctx.lineTo(x, y + TS); });
    eB.forEach(([x, y]) => { ctx.moveTo(x, y); ctx.lineTo(x + TS, y); });
    ctx.stroke();
    /* pendurados por baixo das saliências: raízes / sincelos / estalactites */
    eB.forEach(([x, y, cx, cy]) => {
      const h = hsh(cx * 31 + cy * 7);
      if (th.cap === 'grass') { ctx.strokeStyle = '#5a361a'; ctx.lineWidth = 1.4; for (let i = 0; i < 2; i++) { const rx = x + 6 + hsh(cx * 5 + i) * 20, l = 6 + hsh(cx + i * 9) * 10; ctx.beginPath(); ctx.moveTo(rx, y); ctx.quadraticCurveTo(rx + 3, y + l * .5, rx - 1 + Math.sin(t + rx) * 1.5, y + l); ctx.stroke(); } }
      else if (th.cap === 'snow' || th.cap === 'stone') {
        for (let i = 0; i < 3; i++) { if (hsh(cx * 3 + i) < .35) continue; const ix = x + 5 + i * 10, l = 6 + hsh(cx * 11 + i) * 9; ctx.fillStyle = th.cap === 'snow' ? 'rgba(220,240,255,.95)' : th.dirt2; ctx.strokeStyle = th.cap === 'snow' ? '#9ccbe8' : th.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix - 3, y - .5); ctx.lineTo(ix, y + l); ctx.lineTo(ix + 3, y - .5); ctx.fill(); ctx.stroke(); }
      }
    });
    /* adereços pousados no chão (atrás da faixa de relva, que lhes tapa a base) */
    if (!fake) flats.forEach(([cx, cy]) => { if (!G.busy || !G.busy.has(cx + ',' + cy)) prop(G, ctx, cx, cy); });
    /* faixa do topo */
    const cap = th.cap;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* franja recortada por baixo da faixa */
    const fr = cap === 'snow' ? 5.2 : cap === 'grass' ? 3.8 : cap === 'sand' ? 2.6 : 0;
    if (fr) {
      ctx.fillStyle = th.fringe; ctx.beginPath();
      segs.forEach(([ax, ay, bx, by], i) => { const n = 4; for (let k = 0; k < n; k++) { const f = (k + .5) / n, px = ax + (bx - ax) * f, py = ay + (by - ay) * f, r = fr * (.75 + hsh(Math.round(px) * 3) * .5); ctx.moveTo(px + r, py + 8); ctx.arc(px, py + 8, r, 0, TAU); } });
      ctx.fill();
    }
    ctx.strokeStyle = th.top2; ctx.lineWidth = cap === 'stone' ? 10 : 11; ctx.stroke(segPath(cap === 'stone' ? 4 : 3.5));
    ctx.strokeStyle = th.top; ctx.lineWidth = cap === 'stone' ? 5.5 : 6.5; ctx.stroke(segPath(1.6));
    ctx.strokeStyle = th.capHi; ctx.lineWidth = 1.5; ctx.globalAlpha = .9; ctx.stroke(segPath(-.7)); ctx.globalAlpha = 1;
    if (cap === 'stone') {
      /* juntas das lajes */
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      segs.forEach(([ax, ay, bx, by]) => { const mx = (ax + bx) / 2, my = (ay + by) / 2; ctx.moveTo(mx, my - 1); ctx.lineTo(mx, my + 8); }); ctx.stroke();
    }
    /* erva / tufos secos / brilhos da neve */
    if (cap === 'grass') {
      const b1 = new Path2D(), b2 = new Path2D();
      segs.forEach(([ax, ay, bx, by]) => {
        for (let px = ax + 2; px < bx; px += 4.3) {
          const h = hsh(Math.round(px * 7) + 1); if (h < .3) continue;
          const py = ay + (by - ay) * (px - ax) / (bx - ax), l = 3 + h * 6, lean = Math.sin(t * 2.1 + px * .05) * 1.6 + (h - .5) * 3;
          const P2 = h > .62 ? b1 : b2; P2.moveTo(px - 1.2, py + 1.5); P2.quadraticCurveTo(px + lean * .3, py - l * .5, px + lean, py - l); P2.quadraticCurveTo(px + lean * .4 + .6, py - l * .4, px + 1.2, py + 1.5);
        }
      });
      ctx.fillStyle = th.top2; ctx.fill(b2); ctx.fillStyle = th.capHi; ctx.fill(b1);
    } else if (cap === 'sand') {
      ctx.strokeStyle = '#b07a2f'; ctx.lineWidth = 1.1;
      segs.forEach(([ax, ay, bx, by]) => { const px = ax + 8 + hsh(Math.round(ax)) * 16; if (hsh(Math.round(ax) * 3) < .7) return; const py = ay + (by - ay) * (px - ax) / (bx - ax); ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(px, py + 1); ctx.lineTo(px + k * 2.2, py - 5 + Math.abs(k)); } ctx.stroke(); });
    } else if (cap === 'snow') {
      segs.forEach(([ax, ay, bx]) => { const px = ax + 6 + hsh(Math.round(ax) * 5) * 20, k = Math.sin(t * 3 + ax); if (k > .6) { ctx.fillStyle = `rgba(255,255,255,${(k - .6) * 2.5})`; star(ctx, px, ay + 2, 2.6, ctx.fillStyle); } });
    }
  }
  /* adereços do chão (decoração; não interferem com o jogo) */
  function prop(G, ctx, cx, cy) {
    const h = hsh(cx * 3 + cy * 1013 + 17), th = G.th; if (h > .32) return;
    const k = hsh(cx * 11 + cy * 7 + 5), x = cx * TS + 6 + hsh(cx * 7 + 1) * 20, y = cy * TS + 2, t = G.t, sw = Math.sin(t * 1.8 + cx) * .08;
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (th.id === 'prado') {
      if (k < .3) { /* papoila */
        ctx.rotate(sw); ctx.strokeStyle = '#3f8f2a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, -7, 0, -13); ctx.stroke();
        ctx.fillStyle = '#e8343f'; ctx.strokeStyle = '#7a1018'; ctx.lineWidth = .9; [[-2.8, -14], [2.8, -14], [0, -16.5], [0, -12]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 3, 0, TAU); ctx.fill(); ctx.stroke(); });
        ctx.fillStyle = '#e8343f'; ctx.beginPath(); ctx.arc(0, -14, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = '#1f1310'; ctx.beginPath(); ctx.arc(0, -14, 1.3, 0, TAU); ctx.fill();
      } else if (k < .5) { /* margarida */
        ctx.rotate(sw); ctx.strokeStyle = '#3f8f2a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, -9); ctx.stroke();
        ctx.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.beginPath(); ctx.ellipse(1 + Math.cos(a) * 2.6, -10 + Math.sin(a) * 2.6, 2, 1, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(1, -10, 1.5, 0, TAU); ctx.fill();
      } else if (k < .78) { /* arbusto */
        ctx.fillStyle = '#2f7a2a'; ctx.strokeStyle = '#1d4a16'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(-7, -5, 6.5, Math.PI * .8, Math.PI * 2.1); ctx.arc(1, -9, 8, Math.PI, 0); ctx.arc(9, -4, 6, Math.PI * 1.1, Math.PI * .25); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4fa63d'; ctx.beginPath(); ctx.arc(-1, -12, 3.5, 0, TAU); ctx.arc(-7, -8, 2.6, 0, TAU); ctx.fill();
        if (k > .65) { ctx.fillStyle = '#ef4444'; [[3, -7], [-4, -4], [7, -5]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 1.4, 0, TAU); ctx.fill(); }); }
      } else { /* cogumelo */
        ctx.fillStyle = '#f5ead7'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; U.rr(ctx, -1.8, -7, 3.6, 8, 1.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(-7, -6); ctx.quadraticCurveTo(-6, -14, 0, -14); ctx.quadraticCurveTo(6, -14, 7, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; [[-3, -9.5, 1.3], [2.5, -11, 1.1], [4, -7.5, .9]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, TAU); ctx.fill(); });
      }
    } else if (th.id === 'deserto') {
      if (k < .45) { /* cacto pequeno */
        ctx.fillStyle = '#4c9a3b'; ctx.strokeStyle = '#1f4a17'; ctx.lineWidth = 1.2;
        U.rr(ctx, -3, -16, 6, 17, 3); ctx.fill(); ctx.stroke(); U.rr(ctx, -9, -11, 4, 7, 2); ctx.fill(); ctx.stroke(); U.rr(ctx, -9, -6, 7, 3.4, 1.7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-1, -14); ctx.lineTo(-1, -2); ctx.stroke();
        if (k < .2) { ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(0, -17, 2.2, 0, TAU); ctx.fill(); }
      } else if (k < .75) { /* rochas */
        ctx.fillStyle = '#c08a58'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-6, -6); ctx.lineTo(0, -8); ctx.lineTo(6, -4); ctx.lineTo(8, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,240,210,.45)'; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(0, -8); ctx.lineTo(-1, -4); ctx.fill();
      } else { ctx.strokeStyle = '#a0702e'; ctx.lineWidth = 1.1; ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(0, 0); ctx.quadraticCurveTo(i * 2, -5, i * 3.5 + sw * 20, -9 + Math.abs(i)); } ctx.stroke(); }
    } else if (th.id === 'gelo') {
      if (k < .4) { /* pinheirinho com neve */
        ctx.fillStyle = '#2f6b55'; ctx.strokeStyle = '#173d30'; ctx.lineWidth = 1.1;
        for (let s = 0; s < 3; s++) { const yy = -2 - s * 5; ctx.beginPath(); ctx.moveTo(-7 + s * 1.6, yy); ctx.lineTo(0, yy - 8); ctx.lineTo(7 - s * 1.6, yy); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#fff'; for (let s = 0; s < 3; s++) { const yy = -2 - s * 5 - 8; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(-2.6, yy + 3.4); ctx.lineTo(2.6, yy + 3.4); ctx.fill(); }
      } else if (k < .7) { /* cristais de gelo */
        [[-3, -11, -.25], [2, -14, .1], [6, -8, .4]].forEach(([a, b, r]) => { ctx.save(); ctx.translate(a, 0); ctx.rotate(r); const g = ctx.createLinearGradient(-3, b, 3, 0); g.addColorStop(0, '#f0fbff'); g.addColorStop(1, '#7cc4ec'); ctx.fillStyle = g; ctx.strokeStyle = '#4a8fbf'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2.6, 1); ctx.lineTo(-2.6, b * .6); ctx.lineTo(0, b); ctx.lineTo(2.6, b * .6); ctx.lineTo(2.6, 1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
      } else { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#b6d9f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); }
    } else {
      if (k < .5) { /* cristais roxos a brilhar */
        const gl = ctx.createRadialGradient(0, -6, 0, 0, -6, 16); gl.addColorStop(0, `rgba(192,132,252,${.35 + Math.sin(t * 3 + cx) * .15})`); gl.addColorStop(1, 'rgba(192,132,252,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -6, 16, 0, TAU); ctx.fill();
        [[-4, -10, -.3], [1, -15, 0], [5, -9, .35]].forEach(([a, b, r]) => { ctx.save(); ctx.translate(a, 0); ctx.rotate(r); ctx.fillStyle = '#a855f7'; ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2.4, 1); ctx.lineTo(-2.4, b * .6); ctx.lineTo(0, b); ctx.lineTo(2.4, b * .6); ctx.lineTo(2.4, 1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-1.6, b * .6, 1, -b * .5); ctx.restore(); });
      } else { ctx.fillStyle = '#5b6070'; ctx.strokeStyle = '#1f2230'; ctx.lineWidth = 1.1; [[-5, -3, 4], [2, -4, 5], [7, -2, 3]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }); }
    }
    ctx.restore();
  }

  function drawTiles(G, ctx, c0, c1, r0, r1) {
    const th = G.th, M = G.M;
    for (let y = r0; y <= r1; y++) for (let x = Math.max(0, c0); x <= Math.min(M.W - 1, c1); x++) {
      const ch = tAt(G, x, y);
      if (ch === '.' || ch === '~' || ch === 'F' || ch === 'h' || ch === '#' || SLOPE[ch]) continue;
      const bump = G.bumps.get(x + ',' + y), by = bump ? -Math.sin((1 - bump / .2) * Math.PI) * 8 : 0;
      const mask = (ch === '%' || ch === '=') && !solidish(tAt(G, x, y - 1)) ? 1 : 0;
      const spr = tileSprite(th, ch === 'P' || ch === '!' || ch === 'H' || ch === 'Q' ? '?' : ch, mask);
      ctx.drawImage(spr, x * TS, y * TS + by, TS, TS);
      if (ch === '?' || ch === 'P' || ch === '!' || ch === 'H' || ch === 'Q') { /* brilho a correr */ const k = (G.t * .8 + x * .13) % 1; if (k < .25) { ctx.fillStyle = `rgba(255,255,255,${(1 - k * 4) * .35})`; U.rr(ctx, x * TS + 3, y * TS + 3 + by, TS - 6, TS - 7, 4); ctx.fill(); } }
    }
  }
  function drawFake(G, ctx, c0, c1, r0, r1) {
    const p = G.p, pc = Math.floor(p.x / TS), pr = Math.floor((p.y - 20) / TS);
    const inside = tAt(G, pc, pr) === 'F' || tAt(G, pc, pr + 1) === 'F';
    ctx.save(); ctx.globalAlpha = inside ? .35 : 1;
    drawTerrain(G, ctx, c0, c1, r0, r1, true);
    ctx.restore();
  }

  function drawLava(G, ctx, c0, c1, r0, r1) {
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
      if (tAt(G, x, y) !== '~') continue;
      const surf = tAt(G, x, y - 1) !== '~';
      const top = y * TS + (surf ? 8 + Math.sin(G.t * 3 + x) * 2 : 0);
      const g = ctx.createLinearGradient(0, y * TS, 0, (y + 1) * TS); g.addColorStop(0, '#ffb02e'); g.addColorStop(1, '#e2361a');
      ctx.fillStyle = g; ctx.fillRect(x * TS - .5, top, TS + 1, (y + 1) * TS - top + .5);
      if (surf) { ctx.fillStyle = '#ffe28a'; ctx.fillRect(x * TS, top, TS, 3); if (Math.sin(G.t * 2 + x * 7) > .95) { ctx.fillStyle = 'rgba(255,240,180,.8)'; ctx.beginPath(); ctx.arc(x * TS + 16, top - 3, 4, 0, TAU); ctx.fill(); } }
    }
  }
  function drawLoop(G, ctx, L, front) {
    const R = L.R, cx = L.cx, cy = L.gy - R;
    ctx.save();
    if (!front) {
      /* aro de madeira (tábuas) com uma trepadeira enrolada — por trás do Pip */
      ctx.lineWidth = 20; ctx.strokeStyle = '#6b4424'; ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, TAU); ctx.stroke();
      ctx.lineWidth = 14; ctx.strokeStyle = '#b07a46'; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(60,35,15,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1)); ctx.lineTo(cx + Math.cos(a) * (R + 15), cy + Math.sin(a) * (R + 15)); ctx.stroke(); }
      ctx.strokeStyle = '#3f9a3a'; ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k <= 96; k++) { const a = k / 96 * TAU, rr = R + 8 + Math.sin(a * 9) * 7; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.stroke();
      ctx.fillStyle = '#5fbf4a'; for (let k = 0; k < 18; k++) { const a = k / 18 * TAU + .1, rr = R + 8 + Math.sin(a * 9) * 7; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 5, 2.6, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, TAU); ctx.fill();
    } else {
      /* poste da frente (dá profundidade quando o Pip passa por trás) */
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R + 12, Math.PI * .4, Math.PI * .6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawObjects(G, ctx) {
    const M = G.M, th = G.th;
    M.obj.forEach(o => {
      if (o.k === 'spring') {
        const k = o.anim || 0, top = o.y + k * 8;
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const yy = U.lerp(top + 6, o.y + o.h, i / 4); ctx.lineTo(o.x + (i % 2 ? o.w - 6 : 6), yy); }
        ctx.stroke();
        const g = ctx.createLinearGradient(0, top, 0, top + 8); g.addColorStop(0, '#fb7185'); g.addColorStop(1, '#be123c');
        ctx.fillStyle = g; U.rr(ctx, o.x, top, o.w, 8, 3); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; U.rr(ctx, o.x + 2, o.y + o.h - 4, o.w - 4, 4, 2); ctx.fill();
      } else if (o.k === 'pad') {
        ctx.fillStyle = '#334155'; U.rr(ctx, o.x + 1, o.y, o.w - 2, o.h, 3); ctx.fill();
        for (let i = 0; i < 2; i++) { const a = ((G.t * 3 + i * .5) % 1); ctx.fillStyle = `rgba(250,204,21,${.4 + a * .6})`; ctx.beginPath(); const bx = o.x + 6 + i * 10 + a * 4; ctx.moveTo(bx, o.y + 1); ctx.lineTo(bx + 7, o.y + 4); ctx.lineTo(bx, o.y + 7); ctx.fill(); }
      } else if (o.k === 'plat' || o.k === 'crumb') {
        const shake = o.k === 'crumb' && o.st > 0 && !o.gone ? Math.sin(G.t * 60) * 1.5 : 0;
        if (o.k === 'crumb' && o.gone && o.y > o.ay + 400) return;
        const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
        if (o.k === 'crumb') { g.addColorStop(0, '#c9a577'); g.addColorStop(1, '#8a6a44'); } else { g.addColorStop(0, th.id === 'castelo' ? '#a7adbd' : '#e2e8f0'); g.addColorStop(1, th.id === 'castelo' ? '#5d6274' : '#94a3b8'); }
        ctx.fillStyle = g; U.rr(ctx, o.x + shake, o.y, o.w, o.h, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(o.x + 3 + shake, o.y + 1, o.w - 6, 2);
        if (o.k === 'crumb') { ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.moveTo(o.x + 10 + shake, o.y + 2); ctx.lineTo(o.x + 14 + shake, o.y + o.h - 2); ctx.moveTo(o.x + 22 + shake, o.y + 3); ctx.lineTo(o.x + 19 + shake, o.y + o.h - 3); ctx.stroke(); }
        else { ctx.fillStyle = '#facc15'; [o.x + 8, o.x + o.w - 8].forEach(bx => { ctx.beginPath(); ctx.arc(bx, o.y + o.h / 2, 2.5, 0, TAU); ctx.fill(); }); }
      } else if (o.k === 'firebar') {
        /* braço de pedra com cristais afiados a rodar */
        const ex = o.x + Math.cos(o.a) * o.n * 15, ey = o.y + Math.sin(o.a) * o.n * 15;
        ctx.strokeStyle = '#4b4f5e'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(ex, ey); ctx.stroke();
        for (let i = 1; i <= o.n; i++) {
          const fx = o.x + Math.cos(o.a) * i * 15, fy = o.y + Math.sin(o.a) * i * 15;
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(o.a + i);
          const g = ctx.createLinearGradient(-8, -8, 8, 8); g.addColorStop(0, '#e9d5ff'); g.addColorStop(.5, '#a855f7'); g.addColorStop(1, '#5b21b6');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.restore();
        }
      }
    });
    /* portas */
    M.doorList.forEach(d => {
      const x = d.x - 16, y = d.y - 52;
      ctx.fillStyle = '#3b2412'; U.rr(ctx, x - 3, y - 3, 38, 58, 14); ctx.fill();
      const g = ctx.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#8b5a2b'); g.addColorStop(1, '#6b4220');
      ctx.fillStyle = g; U.rr(ctx, x, y, 32, 52, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 16, y + 4); ctx.lineTo(x + 16, y + 50); ctx.stroke();
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(x + 25, y + 30, 2.5, 0, TAU); ctx.fill();
      if (G.p.door === d) { ctx.fillStyle = '#fff'; ctx.font = "800 13px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText(G.touch ? '▲ entrar' : '↑ entrar', d.x, y - 10 + Math.sin(G.t * 5) * 2); }
    });
    /* lanternas de controlo: acendem-se quando o Pip passa */
    M.checks.forEach(c => {
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(c.x - 3, c.y - 62, 6, 62);
      ctx.fillRect(c.x - 3, c.y - 62, 18, 4);
      ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x + 13, c.y - 58); ctx.lineTo(c.x + 13, c.y - 52); ctx.stroke();
      const sw = Math.sin(G.t * 2.5) * .08;
      ctx.save(); ctx.translate(c.x + 13, c.y - 52); ctx.rotate(sw);
      if (c.on) { const gl = ctx.createRadialGradient(0, 12, 2, 0, 12, 34); gl.addColorStop(0, 'rgba(255,214,120,.65)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 12, 34, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#3b2412'; ctx.fillRect(-7, 0, 14, 3); ctx.fillRect(-7, 21, 14, 3);
      ctx.fillStyle = c.on ? '#fde68a' : 'rgba(180,200,220,.45)'; ctx.fillRect(-6, 3, 12, 18);
      ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 1.5; ctx.strokeRect(-6, 3, 12, 18);
      if (c.on) { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.ellipse(0, 14, 2.5, 4 + Math.sin(G.t * 14) * .8, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    });
    /* meta: arco de madeira com flores e um sino */
    if (M.goal) {
      const gx = M.goal.x, gy = M.goal.y, open = !G.boss || !G.boss.alive;
      ctx.globalAlpha = open ? 1 : .35;
      const w = 74, h = 120;
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(gx - w / 2 - 6, gy - h, 12, h); ctx.fillRect(gx + w / 2 - 6, gy - h, 12, h);
      ctx.strokeStyle = '#8f5a2c'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(gx, gy - h, w / 2, Math.PI, 0); ctx.stroke();
      const fl = ['#f472b6', '#fde047', '#fb7185', '#c084fc', '#ffffff'];
      for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; ctx.fillStyle = fl[i % fl.length]; ctx.beginPath(); ctx.arc(gx + Math.cos(a) * w / 2, gy - h + Math.sin(a) * w / 2, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(gx + Math.cos(a) * w / 2, gy - h + Math.sin(a) * w / 2, 2, 0, TAU); ctx.fill(); }
      const ring = G.win ? Math.sin(G.winT * 18) * .5 * Math.max(0, 1 - G.winT / 2) : Math.sin(G.t * 2) * .06;
      ctx.save(); ctx.translate(gx, gy - h - w / 2 + 14); ctx.rotate(ring);
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 0); ctx.stroke();
      const bg = ctx.createLinearGradient(-10, 0, 10, 0); bg.addColorStop(0, '#fbbf24'); bg.addColorStop(1, '#b45309');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-9, 18); ctx.quadraticCurveTo(-9, 0, 0, 0); ctx.quadraticCurveTo(9, 0, 9, 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.arc(0, 19, 3, 0, TAU); ctx.fill();
      ctx.restore();
      if (open) { const gl = ctx.createRadialGradient(gx, gy - 50, 4, gx, gy - 50, 60); gl.addColorStop(0, 'rgba(255,248,200,.35)'); gl.addColorStop(1, 'rgba(255,248,200,0)'); ctx.fillStyle = gl; ctx.fillRect(gx - 60, gy - 110, 120, 110); }
      ctx.globalAlpha = 1;
    }
  }

  function drawItems(G, ctx) {
    G.M.items.forEach(it => {
      if (it.got) {
        if (it.t > .35) return;
        ctx.globalAlpha = 1 - it.t / .35; ctx.fillStyle = it.k === 'star' ? '#fde68a' : '#ffd34d';
        ctx.beginPath(); ctx.arc(it.x, it.y - it.t * 70, 8 + it.t * 30, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; return;
      }
      if (it.x < G.cam.x - 40 || it.x > G.cam.x + G.VW + 40) return;
      const bob = Math.sin(G.t * 3 + it.x * .05) * 2.5;
      if (it.k === 'coin') {
        const k = Math.abs(Math.cos(G.t * 3.2 + it.x * .02));
        const g = ctx.createLinearGradient(it.x - 8, it.y - 10, it.x + 8, it.y + 10); g.addColorStop(0, '#fff1a8'); g.addColorStop(.5, '#ffcc33'); g.addColorStop(1, '#d48a00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(it.x, it.y + bob, 9 * k + 1.5, 11, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a86b00'; ctx.lineWidth = 1.5; ctx.stroke();
        if (k > .5) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(it.x - 1.5 * k, it.y - 6 + bob, 3 * k, 12); }
      } else if (it.k === 'star') {
        /* pena dourada */
        ctx.save(); ctx.translate(it.x, it.y + bob); ctx.rotate(-.5 + Math.sin(G.t * 2) * .18);
        const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); halo.addColorStop(0, 'rgba(253,230,138,.55)'); halo.addColorStop(1, 'rgba(253,230,138,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
        feather(ctx, 0, 0, 18);
        ctx.restore();
      } else {
        const r = 14, y = it.y + (it.rise ? 0 : bob);
        ctx.save(); ctx.translate(it.x, y);
        if (it.k === 'fire') {
          /* malagueta */
          ctx.rotate(.5);
          const g = ctx.createLinearGradient(-4, -10, 6, 12); g.addColorStop(0, '#fb7185'); g.addColorStop(1, '#b91c1c');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, -8); ctx.quadraticCurveTo(-7, 6, 2, 14); ctx.quadraticCurveTo(6, 4, 5, -8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-2, -2, 1.5, 5, .1, 0, TAU); ctx.fill();
          ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.ellipse(0, -9, 6, 3, 0, 0, TAU); ctx.fill(); ctx.fillRect(-1, -15, 2, 6);
        }
        else if (it.k === 'starp') {
          /* cristal arco-íris */
          const hu = (G.t * 200) % 360, g = ctx.createLinearGradient(-10, -14, 10, 14);
          g.addColorStop(0, `hsl(${hu},95%,75%)`); g.addColorStop(.5, `hsl(${(hu + 120) % 360},95%,62%)`); g.addColorStop(1, `hsl(${(hu + 240) % 360},95%,55%)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, -4); ctx.lineTo(6, 14); ctx.lineTo(-6, 14); ctx.lineTo(-10, -4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(10, -4); ctx.moveTo(0, -15); ctx.lineTo(0, 14); ctx.stroke();
        }
        else if (it.k === 'heart') { ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-16, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 16, -2, 0, 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-5, -5, 3, 2, -.5, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    });
  }
  /* pena dourada (colecionável e HUD) */
  function feather(ctx, x, y, s, dim) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(-s * .4, -s, s * .4, s); g.addColorStop(0, dim ? '#fef3c7' : '#fff7d6'); g.addColorStop(.5, dim ? '#fde68a' : '#fbbf24'); g.addColorStop(1, dim ? '#e5d3a1' : '#b45309');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * .55, -s * .3, s * .12, s * .7); ctx.lineTo(-s * .12, s * .7); ctx.quadraticCurveTo(-s * .55, -s * .3, 0, -s); ctx.fill();
    ctx.strokeStyle = dim ? 'rgba(120,90,40,.4)' : '#92400e'; ctx.lineWidth = Math.max(1, s * .08); ctx.beginPath(); ctx.moveTo(0, -s * .85); ctx.lineTo(0, s); ctx.stroke();
    ctx.lineWidth = Math.max(.6, s * .04); for (let i = -2; i <= 3; i++) { const yy = i * s * .2; [-1, 1].forEach(k => { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(k * s * .26, yy - s * .16); ctx.stroke(); }); }
    ctx.restore();
  }
  function star(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  /* ── inimigos: mesmo traço das personagens (contorno quente + sombra em dois tons) ── */
  function ol(ctx, w) { ctx.strokeStyle = OUT; ctx.lineWidth = w || 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function eyeBall(ctx, x, y, r, lookX, lookY, angry) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.12, 0, 0, TAU); ctx.fill(); ol(ctx, 1.1);
    ctx.fillStyle = '#1b1008'; ctx.beginPath(); ctx.arc(x + lookX * r * .35, y + lookY * r * .3, r * .58, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + lookX * r * .35 + r * .2, y + lookY * r * .3 - r * .25, r * .2, 0, TAU); ctx.fill();
    if (angry) { ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 1.25 - angry * .6); ctx.lineTo(x + r * .9, y - r * .85); ctx.stroke(); }
  }
  function drawEnemies(G, ctx) {
    G.M.enemies.forEach(e => {
      if (!e.act && !(e.x > G.cam.x - 60 && e.x < G.cam.x + G.VW + 60)) return;
      if (!e.alive && !(e.squash > 0)) return;
      ctx.save(); ctx.translate(e.x, e.y);
      if (!e.alive) { if (e.flip) { ctx.translate(0, (.5 - e.squash) * 160); ctx.rotate(Math.PI); } else { ctx.scale(1.3, .35); } ctx.globalAlpha = Math.min(1, e.squash * 3); }
      const f = e.vx >= 0 ? 1 : -1, t = e.t;
      if (e.k === 'walker') {
        /* lagarta: 5 segmentos que ondulam (a onda corre para a frente), patinhas, cabeça grande */
        if (e.a) ctx.rotate(e.a);
        ctx.scale(f, 1);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(-2, 0, 20, 3, 0, 0, TAU); ctx.fill();
        const seg = [];
        for (let k = 0; k < 5; k++) { const hump = Math.max(0, Math.sin(t * 8 - k * 1.15)) * 4; seg.push([-17 + k * 5.6, -7 - hump, k]); }
        seg.forEach(([sx, sy, k]) => {
          ctx.fillStyle = '#284f12'; [-2.4, 2.4].forEach(d => { ctx.beginPath(); ctx.ellipse(sx + d + Math.sin(t * 8 - k) * 1.2, -1.2, 1.7, 1.3, 0, 0, TAU); ctx.fill(); });
          const g = ctx.createRadialGradient(sx - 2, sy - 3, 1, sx, sy, 8); g.addColorStop(0, k % 2 ? '#c8f07a' : '#b3e65c'); g.addColorStop(1, k % 2 ? '#5aa32a' : '#4b9422');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 6.6, 0, TAU); ctx.fill(); ol(ctx, 1.5);
          ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(sx - .5, sy - 4.2, 1.5, 0, TAU); ctx.fill();
        });
        const hb = Math.max(0, Math.sin(t * 8 - 5.6)) * 2.5, hx = 13, hy = -11 - hb;
        /* antenas */
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hx - 2, hy - 7); ctx.quadraticCurveTo(hx - 5, hy - 13, hx - 3 + Math.sin(t * 6) * 1.5, hy - 16); ctx.moveTo(hx + 3, hy - 7); ctx.quadraticCurveTo(hx + 4, hy - 13, hx + 7 + Math.sin(t * 6 + 1) * 1.5, hy - 15); ctx.stroke();
        ctx.fillStyle = '#f472b6'; [[hx - 3 + Math.sin(t * 6) * 1.5, hy - 16], [hx + 7 + Math.sin(t * 6 + 1) * 1.5, hy - 15]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 2.1, 0, TAU); ctx.fill(); ol(ctx, 1); });
        const hg = ctx.createRadialGradient(hx - 3, hy - 4, 1, hx, hy, 10); hg.addColorStop(0, '#dcf8a0'); hg.addColorStop(1, '#6dbb34');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, 8.4, 0, TAU); ctx.fill(); ol(ctx, 1.6);
        eyeBall(ctx, hx + 3, hy - 2, 3.1, 1, 0);
        ctx.fillStyle = 'rgba(244,114,182,.45)'; ctx.beginPath(); ctx.ellipse(hx + 5.5, hy + 3, 2.2, 1.3, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(hx + 4.5, hy + 2.6, 2.2, .3, Math.PI - .6); ctx.stroke();
      } else if (e.k === 'spiky') {
        /* ouriço de castanha: casca verde com espinhos (rola), castanha zangada a espreitar */
        if (e.a) ctx.rotate(e.a);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 3, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(0, -13); ctx.rotate(e.x / 13);
        ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, a2 = a + TAU / 36; ctx.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5); ctx.lineTo(Math.cos(a2) * 17.5, Math.sin(a2) * 17.5); } ctx.closePath();
        ctx.fillStyle = '#9acd4c'; ctx.fill(); ol(ctx, 1.3);
        const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, 12); g.addColorStop(0, '#b9e26a'); g.addColorStop(1, '#4e7d1b');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11.2, 0, TAU); ctx.fill(); ol(ctx, 1.4);
        ctx.restore();
        /* abertura com a castanha */
        ctx.scale(f, 1);
        ctx.fillStyle = '#26400c'; ctx.beginPath(); ctx.ellipse(3, -12, 7.5, 6, 0, 0, TAU); ctx.fill();
        const ng = ctx.createRadialGradient(1, -15, 1, 3, -12, 8); ng.addColorStop(0, '#c0703a'); ng.addColorStop(1, '#6b3412');
        ctx.fillStyle = ng; ctx.beginPath(); ctx.ellipse(3, -12, 6.2, 5, 0, 0, TAU); ctx.fill(); ol(ctx, 1.1);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(.5, -15, 2, 1, -.4, 0, TAU); ctx.fill();
        eyeBall(ctx, 1.2, -12.4, 1.8, 1, 0, 1); eyeBall(ctx, 5.4, -12.4, 1.8, 1, 0, 1);
      } else if (e.k === 'flyer') {
        /* abelha: corpo às riscas com contorno, ferrão, asas translúcidas a bater */
        ctx.translate(0, 12 + Math.sin(t * 9) * 1.2);
        const fl = e.vx >= 0 ? 1 : -1; ctx.scale(fl, 1);
        ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(0, 22, 9, 2.4, 0, 0, TAU); ctx.fill();
        const wf = Math.abs(Math.sin(t * 46));
        [[-4, -.45], [2, -.15]].forEach(([wx, r], i) => { ctx.save(); ctx.translate(wx, -12); ctx.rotate(r - wf * .35); ctx.scale(1, .45 + wf * .55); ctx.fillStyle = i ? 'rgba(235,248,255,.85)' : 'rgba(215,235,250,.7)'; ctx.beginPath(); ctx.ellipse(-2, -8, 5.5, 9, -.2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,90,120,.6)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); });
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-18, -3); ctx.lineTo(-12, -1); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(-2, -4, 11.5, 8.8, 0, 0, TAU); ctx.clip();
        const bg = ctx.createRadialGradient(-4, -8, 1, -2, -4, 12); bg.addColorStop(0, '#ffe680'); bg.addColorStop(1, '#f2a516');
        ctx.fillStyle = bg; ctx.fillRect(-15, -14, 26, 20);
        ctx.fillStyle = '#2b1d10'; [-8, -2.5].forEach(sx2 => { ctx.beginPath(); ctx.ellipse(sx2, -4, 2.2, 10, .12, 0, TAU); ctx.fill(); });
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(-2, -4, 11.5, 8.8, 0, 0, TAU); ol(ctx, 1.6);
        ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.arc(10, -5, 6.5, 0, TAU); ctx.fill(); ol(ctx, 1.5);
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(11, -11); ctx.quadraticCurveTo(12, -16, 15, -16); ctx.moveTo(13, -10); ctx.quadraticCurveTo(16, -13, 18, -12); ctx.stroke();
        eyeBall(ctx, 12, -6, 2.7, 1, .2, 1);
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; [-6, -1, 4].forEach((lx, i) => { ctx.beginPath(); ctx.moveTo(lx, 4); ctx.lineTo(lx - 1 + Math.sin(t * 7 + i) * 1.2, 8); ctx.stroke(); });
      } else if (e.k === 'lavab') {
        if (!e.up) { ctx.restore(); return; }
        /* salpico de lava: gota disforme com brilho e rasto (sem cara) */
        const gl = ctx.createRadialGradient(0, -12, 2, 0, -12, 30); gl.addColorStop(0, 'rgba(255,170,60,.55)'); gl.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -12, 30, 0, TAU); ctx.fill();
        const st = Math.max(.6, 1 - (e.vy || 0) / 2400), sq = 1 / st;
        ctx.save(); ctx.scale(sq * .9, st * 1.1);
        const g = ctx.createRadialGradient(-3, -16, 2, 0, -11, 15); g.addColorStop(0, '#fffbe0'); g.addColorStop(.35, '#fdba74'); g.addColorStop(1, '#c2410c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(10, -18, 12, -6, 0, -2); ctx.bezierCurveTo(-12, -6, -10, -18, 0, -26); ctx.fill();
        ctx.strokeStyle = '#7c1d06'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(253,186,116,.6)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.sin(t * 9 + i * 2) * 4, 4 + i * 7, 4.5 - i, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    });
  }
  function drawBoss(G, ctx) {
    const B = G.boss;
    if (!B.alive && B.t > 1.6) return;
    ctx.save(); ctx.translate(B.x, B.y);
    if (!B.alive) { ctx.globalAlpha = Math.max(0, 1 - B.t / 1.6); ctx.translate(0, B.t * 60); ctx.rotate(B.t * 2); }
    if (B.inv > 0 && Math.floor(G.t * 16) % 2) ctx.globalAlpha *= .4;
    const s = 2.6, f = B.vx > 0 ? 1 : -1, t = B.t, mad = 3 - B.hp;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 7, 0, 0, TAU); ctx.fill();
    ctx.scale(s * f, s);
    const lw = 1.5 / s * 1.6;
    /* patas (3 de cada lado; as de trás mais escuras) */
    [[-9, 0], [0, 1], [9, 2]].forEach(([lx, i]) => {
      const w = Math.sin(t * 11 + i * 2) * 2.4, w2 = Math.sin(t * 11 + i * 2 + Math.PI) * 2.4;
      ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx + 2, -7); ctx.lineTo(lx + 4 + w2, -3); ctx.lineTo(lx + 3 + w2, 0); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(lx, -6); ctx.lineTo(lx - 3 + w, -2.5); ctx.lineTo(lx - 2 + w, 0); ctx.stroke();
      ctx.strokeStyle = '#3730a3'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    /* carapaça */
    const g = ctx.createRadialGradient(-4, -17, 2, 0, -11, 18); g.addColorStop(0, '#a5b4fc'); g.addColorStop(.45, '#4338ca'); g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-2, -11, 15.5, 10.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
    ctx.strokeStyle = 'rgba(10,8,40,.6)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-2, -21.3); ctx.lineTo(-2, -1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-7, -16, 5, 2.2, -.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(3, -17, 3, 1.4, -.2, 0, TAU); ctx.fill();
    /* tórax + cabeça */
    ctx.fillStyle = '#312e81'; ctx.beginPath(); ctx.ellipse(12, -10, 5.5, 6.5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = '#272463'; ctx.beginPath(); ctx.arc(17, -9, 4.6, 0, TAU); ctx.fill(); ctx.stroke();
    /* chifre */
    ctx.fillStyle = '#1e1b4b'; ctx.beginPath(); ctx.moveTo(17, -13); ctx.quadraticCurveTo(25, -18, 23, -27); ctx.quadraticCurveTo(21, -20, 15, -14.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(165,180,252,.6)'; ctx.beginPath(); ctx.moveTo(18, -14.5); ctx.quadraticCurveTo(23, -18, 22.4, -24); ctx.lineTo(21.6, -21); ctx.fill();
    /* olho a brilhar (mais vermelho quando já levou pancada) */
    const ec = mad ? '#ef4444' : '#fde047';
    const eg = ctx.createRadialGradient(19, -9.5, 0, 19, -9.5, 4); eg.addColorStop(0, ec); eg.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(19, -9.5, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(19.3, -9.8, .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(16.5, -12.8); ctx.lineTo(21, -11.6); ctx.stroke();
    /* coroa de folhas */
    for (let i = -1; i <= 1; i++) { ctx.fillStyle = i ? '#16a34a' : '#22c55e'; ctx.beginPath(); ctx.ellipse(-2 + i * 5, -21.5 - (i ? 0 : 1.5), 2.2, 4.8, i * .5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#0b3d1b'; ctx.lineWidth = .7; ctx.stroke(); }
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(-2, -26.5, 1.4, 0, TAU); ctx.fill();
    ctx.restore();
    if (B.act && B.alive) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < B.hp ? '#ef4444' : 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(B.x - 16 + i * 16, B.y - 100, 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  }

  /* ── o Pip ──
     Raposa bípede, traço de livro ilustrado: contorno quente, sombra em dois tons, "meias" pretas,
     cauda farta com ponta branca e um lenço turquesa (a marca do Pip — fica cor de fogo com a
     malagueta). Rig simples: anca → coxa → canela, ombro → braço → antebraço (ângulos, 0 = para
     baixo, + = para a frente). A pose sai do estado físico; com os pés no chão, a anca ajusta-se
     para que o pé mais baixo toque sempre o chão (nada de pés enterrados nem a flutuar). */
  const FX = { fur: '#f2741f', furL: '#ffa24d', furD: '#c24e14', back: '#b5470f', cream: '#fff4e3', creamD: '#ecd3b2', sock: '#3b2416', ear: '#ffd6bd', eye: '#1d0e05' };
  const TH = 7.6, SH = 7.4, UA = 5.6, FA = 5.4;
  function legEnd(a1, a2) { return [Math.sin(a1) * TH + Math.sin(a1 + a2) * SH, Math.cos(a1) * TH + Math.cos(a1 + a2) * SH]; }
  function pipPose(G) {
    const p = G.p, t = G.t, speed = Math.abs(p.on ? p.gsp : p.vx);
    const P0 = { lean: 0, legs: [[.08, -.14], [-.1, -.1]], arms: [[.22, -.5], [-.18, -.45]], tail: -.5, tailW: 0, ears: 0, head: 0, eye: 'open', mouth: 'smile', brow: 0, rot: 0, air: !p.on, hipY: -17.5, scarf: speed };
    if (G.dead) { Object.assign(P0, { arms: [[2.8, -.3], [-2.7, .3]], legs: [[.6, -1], [-.5, -.8]], eye: 'x', mouth: 'o', ears: .8, air: true }); return P0; }
    if (G.win && p.on) {
      const hop = Math.abs(Math.sin(G.winT * 7));
      Object.assign(P0, { arms: [[2.85 - hop * .25, -.2], [-2.9 + hop * .2, .2]], eye: 'happy', mouth: 'open', tail: -.1 + Math.sin(t * 14) * .25, ears: -.15, lean: -.05 });
      const ph = p.anim; P0.legs = [[Math.sin(ph) * .5, -.3 - Math.max(0, Math.cos(ph)) * .8], [Math.sin(ph + Math.PI) * .5, -.3 - Math.max(0, Math.cos(ph + Math.PI)) * .8]];
      return P0;
    }
    if (p.inv > 1.25 && !p.star) { Object.assign(P0, { lean: -.32, arms: [[-2.2, .6], [-1.8, .7]], legs: [[.7, -.9], [.2, -.6]], eye: 'squint', mouth: 'o', ears: .9, tail: .4, air: !p.on }); return P0; }
    if (p.dive) {
      /* mergulho de cabeça: corpo na vertical, patas da frente esticadas para o chão, cauda a esvoaçar */
      Object.assign(P0, { rot: 1.38, arms: [[1.55, .05], [1.35, .1]], legs: [[-1.45, .35], [-1.2, .5]], tail: -.05 + Math.sin(t * 30) * .12, ears: .9, eye: 'focus', mouth: 'grit', brow: 1, air: true });
      return P0;
    }
    if (!p.on) {
      if (p.pounce && p.vy < 0) {
        /* bote: o corpo estica-se em arco para a frente */
        Object.assign(P0, { rot: -.5, lean: .2, arms: [[1.9, -.2], [1.6, -.1]], legs: [[-1.1, -.2], [-.8, -.4]], tail: .2, ears: .6, eye: 'focus', mouth: 'open', brow: 1 });
      } else if (p.vy < -160) {
        Object.assign(P0, { lean: .12, arms: [[2.45, -.45], [-1, .7]], legs: [[1.05, -1.75], [-.35, -.95]], tail: -.15, ears: .3, mouth: 'open' });
      } else if (p.vy < 160) {
        Object.assign(P0, { lean: .05, arms: [[1.7, -.25], [-1.35, .35]], legs: [[.6, -.7], [-.55, -.7]], tail: .1, ears: .1 });
      } else {
        const fl = Math.sin(t * 22) * .18;
        Object.assign(P0, { lean: -.05, arms: [[2.7 + fl, -.35], [-2.6 - fl, .35]], legs: [[.25, -.35], [-.2, -.45]], tail: .45, ears: -.25, eye: 'wide', mouth: 'o' });
      }
      return P0;
    }
    /* no chão */
    if (p.crouch) {
      const ch = p.charge, wig = ch > .2 ? Math.sin(t * (10 + ch * 16)) * (.12 + ch * .2) : 0;
      Object.assign(P0, { lean: .32, legs: [[1.28, -2.45], [1.12, -2.3]], arms: [[.75, -.2], [.55, -.1]], tail: -.2 + wig, ears: .35 + ch * .2, eye: ch >= 1 ? 'focus' : 'open', brow: ch >= 1 ? 1 : 0, head: .12 });
      return P0;
    }
    if (p.skid > 0 && speed > 60) {
      Object.assign(P0, { lean: -.35, legs: [[.85, -.1], [-.35, -.7]], arms: [[-1.4, .4], [-1.1, .5]], tail: .3, ears: .6, eye: 'wide', mouth: 'grit' });
      return P0;
    }
    if (speed > 20) {
      const ph = p.anim, sprint = speed > 470;
      const A = sprint ? 1.05 : U.clamp(speed / 430, .38, .9);
      const leg = o => [A * Math.sin(ph + o) * (sprint ? .95 : .85), -(.22 + (sprint ? 1.6 : 1.25) * A * Math.max(0, Math.cos(ph + o)))];
      P0.legs = [leg(0), leg(Math.PI)];
      if (sprint) P0.arms = [[-1.1 + Math.sin(ph) * .2, 1.3], [-1.3 - Math.sin(ph) * .2, 1.2]];
      else P0.arms = [[-A * 1.05 * Math.sin(ph), .85 + A * .5], [A * 1.05 * Math.sin(ph), .85 + A * .5]];
      P0.lean = Math.min(.42, speed / 1300) + (sprint ? .08 : 0);
      P0.tail = sprint ? .62 : -.25 + A * .5 + Math.sin(ph * 2) * .08;
      P0.ears = sprint ? .7 : A * .35;
      P0.head = -Math.abs(Math.sin(ph)) * .05;
      if (sprint) P0.mouth = 'grin';
      return P0;
    }
    /* parado: respira, abana a cauda, pisca; ao fim de uns segundos olha em volta e bate o pé */
    const br = Math.sin(t * 2.6);
    P0.arms = [[.18 + br * .03, -.5], [-.16 - br * .03, -.45]];
    P0.tail = -.5 + Math.sin(t * 2.1) * .14; P0.tailW = Math.sin(t * 2.1);
    P0.lean = br * .015;
    if (p.landT > 0) { const k = p.landT / .16; P0.legs = [[.45 * k, -.9 * k - .14], [.3 * k, -.8 * k - .1]]; }
    if (p.idleT > 3.5) {
      const it = p.idleT - 3.5, look = Math.sin(it * 1.3);
      P0.head = look * .14; P0.ears = Math.max(0, Math.sin(it * 5)) * .25;
      P0.tail = -.45 + Math.sin(t * 6) * .3;
      const tap = Math.max(0, Math.sin(it * 9));
      P0.legs = [[.08 + tap * .25, -.14 - tap * .35], [-.1, -.1]];
    }
    return P0;
  }
  function limb(ctx, x, y, a1, l1, a2, l2, w, c1, c2) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    return [fx, fy];
  }
  function paw(ctx, x, y, a, rx, ry, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(rx * .35, 0, rx, ry, 0, 0, TAU); ctx.fill(); ol(ctx, 1.3); ctx.restore(); }
  function foxEar(ctx, x, y, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-4.4, 1.5); ctx.quadraticCurveTo(-3.8, -8, -.3, -12.8); ctx.quadraticCurveTo(4.2, -7, 4.4, 1.5); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = FX.sock; ctx.fillRect(-6, -16, 12, 7.5); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-4.4, 1.5); ctx.quadraticCurveTo(-3.8, -8, -.3, -12.8); ctx.quadraticCurveTo(4.2, -7, 4.4, 1.5); ctx.closePath(); ol(ctx, 1.5);
    ctx.fillStyle = FX.ear; ctx.beginPath(); ctx.moveTo(-2.3, .5); ctx.quadraticCurveTo(-2, -5, -.3, -8); ctx.quadraticCurveTo(2.2, -4.5, 2.3, .5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function headPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9.6, 1.5);
    ctx.bezierCurveTo(-11.6, -6, -6, -11.2, 0, -10.6);
    ctx.bezierCurveTo(5, -10.3, 8.6, -7.2, 10, -3.8);
    ctx.quadraticCurveTo(14.6, -2.6, 17.6, -1);
    ctx.quadraticCurveTo(19, 1.2, 16.6, 2.5);
    ctx.quadraticCurveTo(10.5, 4.6, 5, 6.6);
    ctx.quadraticCurveTo(-1, 8.6, -5.8, 6.6);
    ctx.lineTo(-11.8, 7.2); ctx.lineTo(-8.9, 4.4); ctx.lineTo(-12.3, 2.8);
    ctx.closePath();
  }
  function foxTail(ctx, a, col, colD) {
    ctx.save(); ctx.rotate(a);
    const path = () => { ctx.beginPath(); ctx.moveTo(1, -3.6); ctx.bezierCurveTo(-6, -10.5, -16, -15.5, -25, -13.2); ctx.bezierCurveTo(-32.5, -11.6, -34.5, -4, -29, -.8); ctx.bezierCurveTo(-22, 4.2, -9, 6, 1, 3.6); ctx.closePath(); };
    path();
    const g = ctx.createLinearGradient(0, -12, 0, 6); g.addColorStop(0, FX.furL); g.addColorStop(.55, col); g.addColorStop(1, colD);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = FX.cream; ctx.beginPath(); ctx.ellipse(-31, -6.5, 8.5, 10, .3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,40,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.quadraticCurveTo(-14, -6, -19, -5); ctx.moveTo(-11, 2); ctx.quadraticCurveTo(-16, 0, -21, 1); ctx.stroke();
    ctx.restore();
    path(); ol(ctx, 1.6);
    /* recorte de pelo na ponta branca */
    ctx.strokeStyle = 'rgba(200,170,140,.8)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(-23.5, -12.5); ctx.lineTo(-22, -9); ctx.lineTo(-24.5, -7); ctx.lineTo(-22.5, -3.5); ctx.lineTo(-24.5, -.5); ctx.stroke();
    ctx.restore();
  }
  function drawPip(G, ctx) {
    const p = G.p, t = G.t;
    if (p.inv > 0 && !G.dead && !p.star && Math.floor(G.t * 20) % 2) return;
    const scarf = p.fire ? '#f97316' : '#14b8a6', scarfD = p.fire ? '#b4300b' : '#0d7d73';
    ctx.save();
    ctx.translate(p.x, p.y);
    if (G.dead) ctx.rotate(G.why === 'fall' ? 0 : Math.min(Math.PI, G.deadT * 6));
    if (p.loop) { ctx.translate(0, -PHR / 2); ctx.rotate(p.a); ctx.translate(0, PHR / 2); }
    else if (p.on && p.a) ctx.rotate(p.a * .6);
    /* sombra no chão */
    if (p.on && !p.loop) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 2.6, 0, 0, TAU); ctx.fill(); }
    const f = p.face, sq = p.sq;
    ctx.scale(f * (1 - sq * .5), 1 + sq);
    if (p.star > 0) { ctx.shadowColor = `hsl(${(G.t * 400) % 360},100%,60%)`; ctx.shadowBlur = 16; }
    /* aura do bote carregado */
    if (p.crouch && p.charge >= 1) { const k = .6 + Math.sin(t * 16) * .2, g = ctx.createRadialGradient(0, -14, 2, 0, -14, 30); g.addColorStop(0, `rgba(253,224,71,${.45 * k})`); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -14, 30, 0, TAU); ctx.fill(); }
    if (p.roll || p.loop || (!p.on && p.jumped && Math.abs(p.vx) > 330 && !p.pounce && !p.dive)) { drawPipBall(G, ctx, scarf); ctx.restore(); return; }
    const Q = pipPose(G);
    /* anca: no chão, o pé mais baixo assenta exatamente no chão */
    let hipY = Q.hipY;
    if (p.on && !G.dead) { const d = Math.max(legEnd(...Q.legs[0])[1], legEnd(...Q.legs[1])[1]); hipY = -2.6 - d; }
    if (Q.rot) { ctx.translate(0, -22); ctx.rotate(Q.rot); ctx.translate(0, 22); }
    /* rasto de velocidade */
    if (p.on && Math.abs(p.gsp) > 470) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const yy = -30 + i * 8 + Math.sin(t * 30 + i) * 1.5; ctx.beginPath(); ctx.moveTo(-16 - i * 5, yy); ctx.lineTo(-34 - i * 9, yy); ctx.stroke(); } }
    const hx = 0, hy = hipY;
    /* referencial do tronco (inclina à volta da anca) */
    const cl = Math.cos(Q.lean), sl = Math.sin(Q.lean);
    const T = (x, y) => [hx + x * cl - y * sl, hy + x * sl + y * cl];
    const [shx, shy] = T(1.6, -11.5), [nkx, nky] = T(1.2, -13), [hdx, hdy] = T(4.2, -20.5), [tlx, tly] = T(-6, -3.2);
    /* 1. braço e perna de trás (mais escuros) */
    const fa = limb(ctx, shx - 1.5, shy, Q.arms[1][0] + Q.lean, UA, Q.arms[1][1], FA, 3.4, FX.back, FX.sock);
    paw(ctx, fa[0], fa[1], 0, 2.2, 2, FX.sock);
    const fl = limb(ctx, hx - 1.8, hy, Q.legs[1][0], TH, Q.legs[1][1], SH, 4.2, FX.back, FX.sock);
    paw(ctx, fl[0], fl[1] + .3, Q.air ? Q.legs[1][0] + Q.legs[1][1] : 0, 3.6, 2.4, FX.sock);
    /* 2. pontas do lenço (esvoaçam para trás com a velocidade) */
    const sp = U.clamp(Q.scarf / 500, .15, 1);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const pts = [[nkx - 2.5, nky + .5]];
      for (let i = 1; i <= 4; i++) { const w = Math.sin(t * (9 + sp * 9) - i * 1.1 + k * 1.3) * (1 + i * .7) * (.4 + sp); pts.push([nkx - 2.5 - i * (3.4 + sp * 1.6), nky + .5 + i * (1.6 - sp * 1.2) + w + k * 2]); }
      ctx.strokeStyle = OUT; ctx.lineWidth = 5.6 - k; ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke();
      ctx.strokeStyle = k ? scarfD : scarf; ctx.lineWidth = 3 - k * .6; ctx.stroke();
    }
    /* 3. cauda */
    ctx.save(); ctx.translate(tlx, tly); ctx.scale(1, 1 + (Q.tailW || 0) * .04); foxTail(ctx, Q.tail + Q.lean * .5, FX.fur, FX.furD); ctx.restore();
    /* 4. perna da frente */
    const nl = limb(ctx, hx + 1.6, hy, Q.legs[0][0], TH, Q.legs[0][1], SH, 4.4, FX.fur, FX.sock);
    /* 5. tronco */
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(Q.lean);
    ctx.beginPath(); ctx.moveTo(-5.8, 1); ctx.bezierCurveTo(-8.8, -4, -7.4, -12, -2, -14.2); ctx.bezierCurveTo(3.5, -15.5, 7.6, -11, 7.2, -5); ctx.bezierCurveTo(7, -.5, 4, 2.6, -.5, 2.6); ctx.bezierCurveTo(-3.2, 2.6, -5, 2, -5.8, 1); ctx.closePath();
    const bg = ctx.createLinearGradient(-6, -14, 6, 2); bg.addColorStop(0, FX.furL); bg.addColorStop(.55, FX.fur); bg.addColorStop(1, FX.furD);
    ctx.fillStyle = bg; ctx.fill(); ol(ctx, 1.7);
    ctx.fillStyle = FX.cream; ctx.beginPath(); ctx.moveTo(1, -13); ctx.bezierCurveTo(6.6, -11, 6.8, -3, 3.2, .8); ctx.bezierCurveTo(.6, -2, -.4, -8, 1, -13); ctx.fill();
    ctx.restore();
    paw(ctx, nl[0], nl[1] + .3, Q.air ? Q.legs[0][0] + Q.legs[0][1] : 0, 3.8, 2.5, FX.sock);
    /* 6. cabeça */
    ctx.save(); ctx.translate(hdx, hdy); ctx.rotate(Q.lean * .45 + Q.head);
    foxEar(ctx, -4.2, -7.2, -.5 - Q.ears * .55, FX.furD);
    foxEar(ctx, 2.4, -8.6, .1 - Q.ears * .65, FX.fur);
    headPath(ctx);
    const hg = ctx.createRadialGradient(-2, -6, 1, 1, -1, 15); hg.addColorStop(0, FX.furL); hg.addColorStop(.6, FX.fur); hg.addColorStop(1, FX.furD);
    ctx.fillStyle = hg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = FX.cream; ctx.beginPath(); ctx.moveTo(20, .3); ctx.lineTo(12.5, .1); ctx.quadraticCurveTo(7, .6, 4.5, 2.2); ctx.quadraticCurveTo(0, 3.6, -4, 3.2); ctx.lineTo(-14, 2.6); ctx.lineTo(-14, 12); ctx.lineTo(20, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,60,10,.18)'; ctx.beginPath(); ctx.ellipse(-6, -2, 6, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
    headPath(ctx); ol(ctx, 1.7);
    /* nariz */
    ctx.fillStyle = FX.sock; ctx.beginPath(); ctx.ellipse(17.4, -.6, 2.3, 1.8, .2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(16.8, -1.3, .7, 0, TAU); ctx.fill();
    /* bochecha */
    ctx.fillStyle = 'rgba(255,120,120,.32)'; ctx.beginPath(); ctx.ellipse(7, 2.6, 2.6, 1.5, 0, 0, TAU); ctx.fill();
    /* boca */
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.1;
    if (Q.mouth === 'open' || Q.mouth === 'o') { ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.ellipse(13, 3.6, Q.mouth === 'o' ? 1.6 : 2.4, Q.mouth === 'o' ? 1.8 : 1.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else if (Q.mouth === 'grit') { ctx.beginPath(); ctx.moveTo(10.5, 3.4); ctx.lineTo(15, 2.8); ctx.stroke(); }
    else if (Q.mouth === 'grin') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, 2.8); ctx.quadraticCurveTo(13, 5.6, 15.8, 2.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(15.4, 2.6); ctx.quadraticCurveTo(13, 4.8, 10.6, 3.2); ctx.stroke(); }
    /* olho */
    p.blink -= 1 / 60; if (p.blink < -.12) p.blink = 2 + Math.random() * 3;
    const ex = 5, ey = -3.6;
    if (Q.eye === 'x') { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 2.4, ey - 2.4); ctx.lineTo(ex + 2.4, ey + 2.4); ctx.moveTo(ex + 2.4, ey - 2.4); ctx.lineTo(ex - 2.4, ey + 2.4); ctx.stroke(); }
    else if (Q.eye === 'happy') { ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(ex, ey + 1, 2.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (Q.eye === 'squint') { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 2.5, ey - 2); ctx.lineTo(ex + 1.5, ey); ctx.lineTo(ex - 2.5, ey + 2); ctx.stroke(); }
    else if (p.blink < 0 && Q.eye !== 'wide') { ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(ex - 2.6, ey + .5); ctx.quadraticCurveTo(ex, ey + 1.8, ex + 2.6, ey + .5); ctx.stroke(); }
    else {
      const ry = Q.eye === 'focus' ? 2.7 : Q.eye === 'wide' ? 4.1 : 3.7, rx = Q.eye === 'wide' ? 3.2 : 2.9;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); ctx.fill(); ol(ctx, 1.2);
      ctx.fillStyle = '#4a2410'; ctx.beginPath(); ctx.arc(ex + .9, ey + .2, 2.2, 0, TAU); ctx.fill();
      ctx.fillStyle = FX.eye; ctx.beginPath(); ctx.arc(ex + 1.1, ey + .3, 1.35, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.8, ey - .9, .85, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex + .2, ey + 1.2, .4, 0, TAU); ctx.fill();
    }
    /* sobrancelha */
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath();
    if (Q.brow) { ctx.moveTo(ex - 2.6, ey - 5.4); ctx.lineTo(ex + 2.8, ey - 4); } else { ctx.moveTo(ex - 2.4, ey - 5.2); ctx.quadraticCurveTo(ex, ey - 6.4, ex + 2.6, ey - 5.4); }
    ctx.stroke();
    ctx.restore();
    /* 7. nó do lenço (por cima do pescoço) */
    ctx.save(); ctx.translate(nkx, nky); ctx.rotate(Q.lean);
    U.rr(ctx, -5.6, -2.2, 11.2, 4.6, 2.2); ctx.fillStyle = scarf; ctx.fill(); ol(ctx, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-4.2, -1.5, 8, 1);
    ctx.beginPath(); ctx.arc(-4.4, .3, 2.2, 0, TAU); ctx.fillStyle = scarfD; ctx.fill(); ol(ctx, 1.2);
    ctx.restore();
    /* 8. braço da frente */
    const na = limb(ctx, shx + 1, shy, Q.arms[0][0] + Q.lean, UA, Q.arms[0][1], FA, 3.6, FX.fur, FX.sock);
    paw(ctx, na[0], na[1], 0, 2.3, 2.1, FX.sock);
    if (p.fire && !p.on) { ctx.fillStyle = `rgba(251,146,60,${.5 + Math.sin(t * 20) * .3})`; ctx.beginPath(); ctx.arc(na[0], na[1], 3.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (p.skid > 0 && p.on) dust(G, p.x + p.face * 8, p.y, 1);
  }
  /* enrolado como um novelo: a cauda dá a volta ao corpo, orelhas e lenço de fora */
  function drawPipBall(G, ctx, scarf) {
    const p = G.p, R = 12.5;
    ctx.translate(0, -13);
    if (Math.abs(p.on ? p.gsp : p.vx) > 300) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, R + 4 + i * 3, Math.PI * .7, Math.PI * 1.2 - i * .08); ctx.stroke(); } }
    ctx.rotate(p.anim * 1.4);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, R); g.addColorStop(0, FX.furL); g.addColorStop(.6, FX.fur); g.addColorStop(1, FX.furD);
    ctx.fillStyle = g; ctx.fill();
    /* orelhas */
    [[-.5, FX.furD], [.25, FX.fur]].forEach(([a, c]) => { ctx.save(); ctx.rotate(a - Math.PI / 2); ctx.translate(R - 2, 0); ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(-3.4, 2); ctx.lineTo(0, -6); ctx.lineTo(3.4, 2); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ol(ctx, 1.3); ctx.restore(); });
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = g; ctx.fill(); ol(ctx, 1.7);
    /* cauda em espiral com a ponta branca */
    ctx.beginPath(); ctx.moveTo(-R + 1.5, 3); ctx.bezierCurveTo(-R + 2, 12, 10, 12, 11, 2); ctx.bezierCurveTo(9, 7, -4, 9, -R + 1.5, 3); ctx.fillStyle = FX.furL; ctx.fill(); ol(ctx, 1.2);
    ctx.beginPath(); ctx.arc(9.6, 3.4, 3.4, 0, TAU); ctx.fillStyle = FX.cream; ctx.fill(); ol(ctx, 1.1);
    /* barriga e olho fechado */
    ctx.fillStyle = FX.cream; ctx.beginPath(); ctx.ellipse(2.5, -3, 4.5, 3.4, .4, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-3, -4, 2.4, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = scarf; ctx.beginPath(); ctx.arc(-6.5, 6, 2.6, 0, TAU); ctx.fill(); ol(ctx, 1.1);
  }

  function drawHUD(G, ctx, W, H, api) {
    const p = G.p;
    ctx.save();
    /* corações e moedas-estrela (por baixo do HUD do kit) */
    const k = pxK(api), y = 76 * k;
    ctx.save(); ctx.scale(k, k); ctx.translate(0, -y / k + 76);
    const W0 = W / k;
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 26, on = i < p.hp, y = 76;
      ctx.fillStyle = on ? '#f43f5e' : 'rgba(0,0,0,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.bezierCurveTo(x - 12, y - 2, x - 6, y - 11, x, y - 5); ctx.bezierCurveTo(x + 6, y - 11, x + 12, y - 2, x, y + 8); ctx.fill(); ctx.stroke();
    }
    for (let i = 0; i < G.totalStars; i++) { const x = W0 - 22 - (G.totalStars - 1 - i) * 26, y = 76; ctx.globalAlpha = i < G.stars.length ? 1 : .4; ctx.save(); ctx.translate(x, y); ctx.rotate(-.5); feather(ctx, 0, 0, 11, i >= G.stars.length); ctx.restore(); }
    ctx.globalAlpha = 1;
    if (p.fire) { ctx.font = '16px system-ui'; ctx.fillText('🔥', 100, 82); }
    if (p.star > 0) { ctx.fillStyle = '#fde047'; ctx.font = "800 13px 'Space Grotesk', system-ui"; ctx.fillText('★ ' + Math.ceil(p.star), 124, 81); }
    ctx.restore();
    /* comandos de toque */
    if (G.touch) {
      buttons(G, api).forEach(b => {
        if (b.id === 'u' && !p.door) return;
        if (b.id === 'f' && !p.fire) return;
        let on = false; api.ptrs.forEach(pt => { if (Math.hypot(pt.x - b.x, pt.y - b.y) < b.r * 1.25) on = true; });
        ctx.globalAlpha = on ? .55 : .3; ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = on ? .95 : .7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(b.r * .7)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.ic, b.x, b.y + 1);
      });
      ctx.globalAlpha = 1;
    } else if (G.time < 6 && G.li === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = "700 14px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
      ctx.fillText('← → mover · Espaço saltar · ↓ rolar (a correr) / agachar e dar o bote (parado) · ↓ no ar mergulhar · ↑ portas · X fogo', W / 2, H - 22);
    }
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     menu: mapa dos mundos
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html(bestOf) {
      const sv = save();
      return `<style>
.pp-worlds{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:4px 0 6px}
.pp-world{border-radius:16px;padding:12px;border:1px solid rgba(255,255,255,.1);position:relative;overflow:hidden}
.pp-world h4{margin:0 0 2px;font:800 .95rem 'Space Grotesk',system-ui;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.pp-world small{color:rgba(255,255,255,.85);font-size:.72rem}
.pp-lvls{display:flex;gap:8px;margin-top:10px}
.pp-lvl{flex:1;border:0;border-radius:12px;padding:9px 6px;background:rgba(0,0,0,.32);color:#fff;cursor:pointer;font:700 .8rem system-ui;transition:transform .15s,background .15s;text-align:center}
.pp-lvl:hover:not([disabled]){transform:translateY(-2px);background:rgba(0,0,0,.45)}
.pp-lvl[disabled]{opacity:.45;cursor:not-allowed}
.pp-lvl b{display:block;font-size:.95rem}.pp-lvl i{font-style:normal;color:#fde047;letter-spacing:1px}.pp-lvl em{display:block;font-style:normal;font-size:.68rem;opacity:.8;margin-top:2px}
</style><div class="pp-worlds">${THEMES.map((t, wi) => {
        const lv = LEVELS.filter(l => l.world === wi);
        return `<div class="pp-world" style="background:linear-gradient(160deg,${t.sky[0]},${t.mid} 70%,${t.near})">
          <h4>${wi + 1}. ${t.name}</h4><small>${['Rampas, loops e molas', 'Aceleradores e plataformas que caem', 'Gelo escorregadio', 'Lava, cristais e o Escaravelho-Rei'][wi]}</small>
          <div class="pp-lvls">${lv.map(l => { const idx = LEVELS.indexOf(l), lock = idx + 1 > (sv.u || 1), st = sv.s[l.id] || 0, b = bestOf(l.id);
            return `<button class="pp-lvl" data-lvl="${l.id}" ${lock ? 'disabled' : ''}><b>${lock ? '🔒' : wi + 1 + '-' + (lv.indexOf(l) + 1)}</b>${l.name}<em>${lock ? 'bloqueado' : `<i>${'★'.repeat(st)}<span style="opacity:.35">${'★'.repeat(3 - st)}</span></i>${b != null ? ' · ' + b : ''}`}</em></button>`; }).join('')}</div>
        </div>`; }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => start(b.dataset.lvl))); },
  };

  /* ════════════════════════════════════════════════════════════════
     teclado / toque
  ════════════════════════════════════════════════════════════════ */
  function key(G, e) {
    G.keys[e.key] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return true;
  }
  function keyup(G, e) { G.keys[e.key] = false; if (e.key === 'Shift') G.keys.Shift = false; }

  const KIT = ArcadeKit.create({
    id: 'platformer', title: 'Mundos de Pip', icon: '🦊', accent: '#f59e0b', accent2: '#22c55e', bg: '#5fbef7', aspect: 'wide', diff: false,
    tagline: 'Corre, salta e rola por 4 mundos — rampas, loops, molas, zonas secretas e o Escaravelho-Rei no fim.',
    view: { w: 960 }, picker, bestLabel: 'Recorde',
    how: [
      '<b>← →</b> para correr (manter acelera), <b>Espaço</b> para saltar — quanto mais tempo premes, mais alto. Salta em cima dos inimigos!',
      '<b>↓</b> a correr = <b>rolar</b>: as descidas dão embalo e derrubas lagartas e abelhas (as castanhas-espinhosas picam!). Com embalo dás a volta aos <b>loops</b>.',
      '<b>↓</b> parado = <b>agachar</b>: espera um instante e o salto seguinte é um <b>bote</b> bem mais alto. <b>↓</b> no ar = <b>mergulho</b> de cabeça: parte caixotes por baixo e derruba os inimigos à volta. <b>↓ + salto</b> numa tábua desce por ela.',
      'Bate por baixo nas <b>caixas-surpresa</b> (turquesa, com estrela). Procura as <b>3 penas douradas</b> de cada nível: há paredes falsas, blocos invisíveis e portas (<b>↑</b>) para zonas secretas.',
    ],
    controls: ['⌨️ ← → Espaço ↓ ↑ X', '👆 Botões no ecrã'],
    ready: { title: 'Toca para começar', hint: 'Toma o teu tempo: há segredos em todo o lado.' },
    setup, update, draw, key, keyup,
    down: (G, x, y, api, e) => { if (e && e.pointerType !== 'mouse') G.touch = true; },
    begin: (G, api) => { if (matchMedia('(pointer: coarse)').matches) G.touch = true; if (api.H > api.W * 1.15) api.banner('Dica: roda o telemóvel', 'Vês mais do nível'); },
    idle: (G, dt, api) => { G.t += dt; camera(G, api, dt, true); },
    hud: (G) => [['Mundo', `${G.L.world + 1}-${G.li % 2 + 1}`], ['Moedas', G.coins], ['Tempo', `${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}`]],
    pauseButtons: (G, api) => [{ label: 'Mapa dos mundos', fn: () => api.menu() }],
    achievements: [
      { id: 'pip.w1', name: 'Primeiros Saltos', icon: '🦊', desc: 'Conclui o Mundo 1 de Mundos de Pip.', test: c => ((c.result.meta || {}).level || 0) >= 2 },
      { id: 'pip.all', name: 'Herói dos Mundos', icon: '👑', desc: 'Vence o Escaravelho-Rei em Mundos de Pip.', test: c => ((c.result.meta || {}).level || 0) >= 8 },
      { id: 'pip.stars', name: 'Pena Dourada', icon: '🪶', desc: 'Apanha as 3 penas douradas de um nível.', test: c => !!(c.result.meta || {}).all },
      { id: 'pip.perfect', name: 'Três Estrelas', icon: '🌟', desc: 'Conclui um nível com ★★★.', test: c => ((c.result.meta || {}).stars || 0) >= 3 },
    ],
  });
  /* para testes (validação dos níveis) */
  KIT._parse = parse; KIT._levels = LEVELS; KIT._solid = ch => SOLID.has(ch); KIT._slope = ch => !!SLOPE[ch];
  return KIT;
})();
