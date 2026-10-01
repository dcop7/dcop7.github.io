/* ══════════════════════════════════════════════════════════════════
   Mundos de Pip — plataformas 2D (inspirado em Super Mario e Sonic).
   O Pip (uma raposa) atravessa 4 mundos × 2 níveis feitos à mão
   (js/games/platformer-levels.js): Prado, Deserto, Gelo e Castelo.

   Motor de tiles com rampas (45° e suaves) e embalo à Sonic: a
   velocidade segue o chão, as descidas aceleram, as subidas travam,
   rolar (↓) mantém o embalo e derruba inimigos. Loops (com velocidade
   dá a volta, sem ela escorrega para trás), molas, aceleradores,
   plataformas móveis e que caem, barras de fogo, lava. Blocos "?",
   tijolos, blocos escondidos, paredes falsas e portas para zonas
   secretas, 3 moedas-estrela por nível, bandeiras de controlo.
   Poderes: flor de fogo (bolas de fogo), estrela (invencível),
   corações. Inimigos: bolotas, ouriços, abelhas, bolas de lava e o
   Rei Bolota no fim.

   Coordenadas do mundo em px (tile = 32), y para baixo. Tudo é
   desenhado à mão em canvas 2D (tiles em cache), sem imagens.
══════════════════════════════════════════════════════════════════ */
const PlatformerGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2, TS = 32;
  const P = { g: 1900, jump: 735, cut: 330, acc: 1450, acc2: 520, dec: 2600, fric: 1500, air: 1150, walk: 250, run: 410, max: 860, slope: 1150, roll: 260 };
  const PW = 22, PH = 42, PHR = 26;
  const LEVELS = typeof PIP_LEVELS !== 'undefined' ? PIP_LEVELS : [];

  /* ── temas (um por mundo) ── */
  const THEMES = [
    { id: 'prado', name: 'Prado Verde', sky: ['#5fbef7', '#d6f1ff'], top: '#5fd03b', top2: '#3c9e27', dirt: '#8f5d33', dirt2: '#6c4425', stone: '#a3acb7', stone2: '#7b8592', far: '#9fd99b', mid: '#6cc070', near: '#3f9a4a', cloud: true, fric: 1 },
    { id: 'deserto', name: 'Deserto Dourado', sky: ['#ff9d5c', '#ffe5b0'], top: '#f7d37c', top2: '#e1ae4c', dirt: '#d39a55', dirt2: '#b27838', stone: '#d9b98a', stone2: '#b48f5e', far: '#f2b98a', mid: '#e09a62', near: '#b8743f', sun: true, pyr: true, fric: 1 },
    { id: 'gelo', name: 'Picos Gelados', sky: ['#7db7f5', '#eaf6ff'], top: '#f4fbff', top2: '#cbe6f7', dirt: '#86c9ee', dirt2: '#5a9fcf', stone: '#b9d7ea', stone2: '#8db6d1', far: '#cfe3f5', mid: '#a9cbe8', near: '#7fb0d8', snow: true, mount: true, fric: .22 },
    { id: 'castelo', name: 'Castelo de Lava', sky: ['#2b0f24', '#6b1f22'], top: '#8b8f9f', top2: '#666b7c', dirt: '#555a6c', dirt2: '#3f4354', stone: '#6d7283', stone2: '#4d5163', far: '#3a1a2a', mid: '#2a1220', near: '#1c0c16', lava: true, towers: true, fric: 1 },
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
      else if (ch === '=') { if (prevY == null || prevY <= r * TS + 3) s = r * TS; }
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
    M.enemies.forEach(e => Object.assign(e, { x0: e.x, y0: e.y, vx: -55, vy: 0, alive: true, on: false, t: Math.random() * 6, act: false }));
    if (M.boss) G.boss = { x: M.boss.x, y: M.boss.y, vx: -90, vy: 0, hp: 3, inv: 0, alive: true, on: false, t: 0, act: false, jumpT: 2 };
    spawn(G, M.start[0], M.start[1]);
    camera(G, api, 0, true);
    return G;
  }
  function spawn(G, x, y) {
    G.p = { x, y, vx: 0, vy: 0, gsp: 0, on: true, a: 0, face: 1, roll: false, crouch: false, hp: 3, inv: 1, star: 0, fire: G.p ? G.p.fire : false, jumpHeld: false, coyote: 0, buf: 0, holdT: 0, loop: null, plat: null, anim: 0, blink: 2, sq: 0, shootT: 0, door: null, ground: null };
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
    if (jumpPress) p.buf = .12;
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
      if (p.crouch) p.gsp -= Math.sign(p.gsp) * Math.min(Math.abs(p.gsp), P.fric * 2 * dt);
      /* salto (com tampão de 0,12 s e tempo de "coiote") */
      if (p.buf > 0) {
        p.buf = 0; p.on = false; p.roll = false; p.crouch = false;
        const c = Math.cos(p.a), s = Math.sin(p.a);
        p.vx = p.gsp * c; p.vy = p.gsp * s - P.jump;
        p.jumped = true; p.sq = -.22; p.plat = null;
        api.sfx.tone(392, .1, 'square', .045, 0, 784);
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
      if (p.coyote > 0 && p.buf > 0 && !p.jumped) { p.buf = 0; p.vy = -P.jump; p.coyote = 0; p.jumped = true; api.sfx.tone(392, .1, 'square', .045, 0, 784); }
      if (dir) { if (Math.abs(p.vx) < top || Math.sign(p.vx) !== dir) p.vx += dir * P.air * dt; }
      else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 120 * dt);
      if (!p.jumpHeld && p.vy < -P.cut && p.jumped) p.vy = -P.cut;   /* salto variável */
      p.vy = Math.min(p.vy + P.g * dt, 1100);
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
        let gnd = ground(G, p.x, py - 2, ny + 1, py);
        /* a cair contra uma rampa que sobe: os pés entram na rampa → pousa nela */
        if (!gnd) { const sl = floorAt(G, p.x, ny - 22, ny + 1); if (sl && SLOPE[sl.ch]) gnd = sl; }
        if (gnd && gnd.y >= py - 22) {
          p.y = gnd.y; p.on = true; p.a = gnd.a; p.plat = gnd.plat || null; p.ground = gnd;
          /* aterrar: a velocidade passa a seguir o chão */
          p.gsp = p.vx * Math.cos(p.a) + p.vy * Math.sin(p.a) * .55;
          if (p.vy > 500) { p.sq = Math.min(.3, p.vy / 3500); dust(G, p.x, p.y, 5); }
          p.vy = 0; p.jumped = false;
          if (p.buf > 0) { p.buf = 0; p.on = false; p.vx = p.gsp * Math.cos(p.a); p.vy = p.gsp * Math.sin(p.a) - P.jump; p.jumped = true; api.sfx.tone(392, .1, 'square', .045, 0, 784); }
        } else p.y = ny;
      }
    }
    /* molas e aceleradores */
    G.M.obj.forEach(o => {
      if (o.k === 'spring') {
        if (p.x > o.x - 6 && p.x < o.x + o.w + 6 && p.y >= o.y - 2 && p.y <= o.y + o.h && (p.vy > 0 || (p.on && Math.abs(p.y - o.y) < 3))) {
          if (p.y > o.y + 10 && p.on) return;
          if (p.on) p.vx = p.gsp * Math.cos(p.a);
          p.y = o.y; p.vy = I.j ? -1320 : -1180; p.on = false; p.jumped = false; p.roll = false; p.plat = null;
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
    p.hp--; p.inv = 1.6; p.roll = false;
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

  function coinSfx(api) { api.sfx.tone(988, .06, 'square', .035); api.sfx.tone(1319, .14, 'square', .035, .06); }

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
        if (!G.dead) for (let i = 1; i <= o.n; i++) { const fx = o.x + Math.cos(o.a) * i * 15, fy = o.y + Math.sin(o.a) * i * 15; if (Math.abs(fx - p.x) < 12 + PW / 2 - 4 && fy > p.y - PH + 4 && fy < p.y + 4) hurt(G, api); }
      }
    });
    /* inimigos */
    M.enemies.forEach(e => {
      if (!e.alive) { if (e.squash) e.squash -= dt; return; }
      if (!e.act) { if (e.x > camL && e.x < camR) e.act = true; else return; }
      e.t += dt;
      if (e.k === 'walker' || e.k === 'spiky') {
        e.vy = Math.min(e.vy + P.g * dt, 900);
        const nx = e.x + e.vx * dt, lead = nx + Math.sign(e.vx) * 13;
        const wall = solidAt(G, Math.floor(lead / TS), Math.floor((e.y - 10) / TS));
        const edge = e.on && !floorAt(G, lead, e.y - 4, e.y + 10);
        if (wall || edge) e.vx = -e.vx; else e.x = nx;
        const ny = e.y + e.vy * dt, f = floorAt(G, e.x, e.y - 6, ny + 1, e.y);
        if (f && e.vy >= 0) { e.y = f.y; e.vy = 0; e.on = true; } else { e.y = ny; e.on = false; }
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
      const ph = p.roll ? PHR : PH;
      if (Math.abs(p.x - ex) < (PW + ew) / 2 - 2 && p.y > ey - eh + 2 && p.y - ph < ey - 2) {
        if (p.star > 0) { killEnemy(G, api, e); return; }
        const stomp = !p.on && p.vy > 60 && p.y < ey - eh * .35 && e.k !== 'spiky' && e.k !== 'lavab';
        if (stomp) { killEnemy(G, api, e); p.vy = p.jumpHeld ? -680 : -440; p.jumped = true; p.y = ey - eh; G.combo = (G.combo || 0) + 1; return; }
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
    M.checks.forEach(c => { if (!c.on && Math.abs(p.x - c.x) < 24 && p.y > c.y - 90 && p.y <= c.y + 4) { c.on = true; G.check = c; api.sfx.arp([659, 784, 988, 1319], .07, .14, 'triangle', .06); api.banner('Bandeira!', 'Recomeças daqui'); } });
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
    if (!B.act) { if (B.x < G.cam.x + G.VW + 40) { B.act = true; api.banner('Rei Bolota!', 'Salta-lhe em cima 3 vezes'); } else return; }
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
        if (B.hp <= 0) { B.alive = false; B.t = 0; G.kills++; G.score += 2000; api.banner('Venceste o Rei Bolota!', 'Corre para a bandeira'); api.sfx.arp([523, 659, 784, 1047, 1319], .09, .2, 'triangle', .08); }
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
    if (it.k === 'fire') { p.fire = true; api.float(X, Y - 20, 'Fogo! (✦ / X)', '#fb923c', 18); }
    if (it.k === 'starp') { p.star = 9; api.float(X, Y - 20, 'Invencível!', '#fde047', 18); }
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
      stats: [['Tempo', `${mm}:${String(ss).padStart(2, '0')} / ${Math.floor(par / 60)}:${String(par % 60).padStart(2, '0')}`], ['Moedas', G.coins], ['Moedas-estrela', `${G.stars.length}/${G.totalStars}`], ['Quedas', G.deaths]],
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
    if (G.VH >= mapH) ty = mapH - G.VH + pad;
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

  function dust(G, x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ k: 'dust', x: x + U.rand(-8, 8), y: y - 3, vx: U.rand(-70, 70), vy: U.rand(-60, -10), life: U.rand(.25, .45), s: U.rand(3, 6) }); }
  function puff(G, x, y) { for (let i = 0; i < 5; i++) G.fx.push({ k: 'dust', x, y, vx: U.rand(-80, 80), vy: U.rand(-80, 20), life: .3, s: 4 }); }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  const _tc = new Map();
  /* tile em cache (32×32 + margem): tipo × máscara de vizinhos ar (cima, esq, dir, baixo) */
  function tileSprite(th, ch, mask, vr) {
    vr = vr || 0;
    const key = th.id + ch + mask + ':' + vr;
    let c = _tc.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = TS * 2; const x = c.getContext('2d');
    x.scale(2, 2);
    const top = mask & 1, l = mask & 2, r = mask & 4, bot = mask & 8;
    const rr = (a, b, w, h, rad) => U.rr(x, a, b, w, h, rad);
    if (ch === '#') {
      /* cor lisa (um gradiente por tile fazia riscas entre linhas) */
      x.fillStyle = th.dirt;
      x.beginPath(); x.moveTo(l && top ? 6 : 0, 0); x.lineTo(r && top ? TS - 6 : TS, 0); x.quadraticCurveTo(TS, 0, TS, r && top ? 6 : 0); x.lineTo(TS, TS); x.lineTo(0, TS); x.lineTo(0, l && top ? 6 : 0); x.quadraticCurveTo(0, 0, l && top ? 6 : 0, 0); x.fill();
      /* textura: pedrinhas e veios */
      x.fillStyle = 'rgba(0,0,0,.13)';
      for (let i = 0; i < 3; i++) { const hx = ((i * 37 + vr * 13 + th.id.length * 11) % 26) + 3, hy = ((i * 53 + vr * 7) % 22) + 6; x.beginPath(); x.ellipse(hx, hy, 2.5 + (i + vr) % 2, 1.8, 0, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.07)';
      x.beginPath(); x.ellipse(((vr * 19) % 24) + 4, ((vr * 11) % 20) + 8, 2, 1.2, 0, 0, TAU); x.fill();
      if (top) {
        /* camada de cima: relva / areia / neve / pedra */
        const tg = x.createLinearGradient(0, 0, 0, 12); tg.addColorStop(0, th.top); tg.addColorStop(1, th.top2);
        x.fillStyle = tg;
        x.beginPath(); x.moveTo(0, 0); x.lineTo(TS, 0); x.lineTo(TS, 9);
        for (let i = 8; i >= 0; i--) x.lineTo(i * 4, 9 + (i % 2 ? 3 : 0) + (th.snow ? 2 : 0));
        x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, TS, 2);
        if (th.id === 'prado') { x.strokeStyle = th.top2; x.lineWidth = 1; for (let i = 3; i < TS; i += 7) { x.beginPath(); x.moveTo(i, 1); x.lineTo(i - 1, -3); x.stroke(); } }
      }
      if (l) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, top ? 8 : 0, 2, TS); }
      if (r) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(TS - 2, top ? 8 : 0, 2, TS); }
      if (bot) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, TS - 3, TS, 3); }
    } else if (ch === '%' || ch === 'F') {
      const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, th.stone); g.addColorStop(1, th.stone2);
      x.fillStyle = g; rr(.5, .5, TS - 1, TS - 1, 4); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, TS / 2); x.lineTo(TS, TS / 2); x.moveTo(TS / 2, 0); x.lineTo(TS / 2, TS / 2); x.moveTo(TS / 4, TS / 2); x.lineTo(TS / 4, TS); x.moveTo(TS * .75, TS / 2); x.lineTo(TS * .75, TS); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(2, 1, TS - 4, 2);
      if (top && th.snow) { x.fillStyle = '#fff'; rr(0, -1, TS, 7, 3); x.fill(); }
    } else if (ch === 'B') {
      const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, '#d9824a'); g.addColorStop(1, '#a8552a');
      x.fillStyle = g; x.fillRect(0, 0, TS, TS);
      x.strokeStyle = '#6e3518'; x.lineWidth = 1.5;
      x.beginPath(); [8, 16, 24].forEach(yy => { x.moveTo(0, yy); x.lineTo(TS, yy); });
      for (let rI = 0; rI < 4; rI++) { const off = rI % 2 ? 8 : 0; for (let xx = off; xx < TS; xx += 16) { x.moveTo(xx, rI * 8); x.lineTo(xx, rI * 8 + 8); } }
      x.stroke(); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(0, 0, TS, 2);
    } else if (ch === '?' || ch === 'P' || ch === '!' || ch === 'H' || ch === 'Q') {
      const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, '#ffd34d'); g.addColorStop(1, '#e09412');
      x.fillStyle = '#8a5200'; rr(0, 0, TS, TS, 5); x.fill();
      x.fillStyle = g; rr(1.5, 1.5, TS - 3, TS - 4, 4); x.fill();
      x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(4, 3, TS - 8, 2);
      [[4, 4], [TS - 6, 4], [4, TS - 7], [TS - 6, TS - 7]].forEach(([a, b]) => { x.fillStyle = '#9a5c00'; x.fillRect(a, b, 2, 2); });
      x.fillStyle = '#fff'; x.strokeStyle = '#8a5200'; x.lineWidth = 2.5; x.font = '900 20px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.strokeText('?', TS / 2, TS / 2 + 1); x.fillText('?', TS / 2, TS / 2 + 1);
    } else if (ch === 'U') {
      x.fillStyle = '#6b4a2a'; rr(0, 0, TS, TS, 5); x.fill(); x.fillStyle = '#8c6a44'; rr(2, 2, TS - 4, TS - 5, 4); x.fill();
      [[5, 5], [TS - 7, 5], [5, TS - 8], [TS - 7, TS - 8]].forEach(([a, b]) => { x.fillStyle = '#4a3018'; x.fillRect(a, b, 2, 2); });
    } else if (ch === '=') {
      const g = x.createLinearGradient(0, 0, 0, 12); g.addColorStop(0, th.id === 'castelo' ? '#9aa0b0' : '#b98652'); g.addColorStop(1, th.id === 'castelo' ? '#5d6274' : '#7a5230');
      x.fillStyle = g; rr(0, 0, TS, 12, 3); x.fill(); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(1, 1, TS - 2, 2);
      x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.moveTo(TS - .5, 1); x.lineTo(TS - .5, 11); x.stroke();
      if (th.snow) { x.fillStyle = '#fff'; rr(0, -2, TS, 5, 2); x.fill(); }
    } else if (ch === '^') {
      x.fillStyle = '#d1d5db'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 8, TS); x.lineTo(i * 8 + 4, TS - 16); x.lineTo(i * 8 + 8, TS); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 8 + 4, TS - 16); x.lineTo(i * 8 + 8, TS); x.lineTo(i * 8 + 5, TS); x.fill(); }
    }
    _tc.set(key, c);
    return c;
  }

  function draw(G, ctx, W, H, api) {
    const th = G.th, z = G.z;
    drawBG(G, ctx, W, H);
    ctx.save();
    ctx.scale(z, z); ctx.translate(-G.cam.x, -G.cam.y);
    const c0 = Math.floor(G.cam.x / TS) - 1, c1 = Math.ceil((G.cam.x + G.VW) / TS) + 1, r0 = Math.max(0, Math.floor(G.cam.y / TS) - 1), r1 = Math.min(G.M.H - 1, Math.ceil((G.cam.y + G.VH) / TS) + 1);
    /* por baixo do mapa: prolonga a última linha (terra / lava) */
    const below = Math.ceil((G.cam.y + G.VH) / TS) - G.M.H;
    if (below > 0) for (let x = c0; x <= c1; x++) {
      const ch = tAt(G, x, G.M.H - 1);
      if (ch === '~') { ctx.fillStyle = '#e2361a'; ctx.fillRect(x * TS - .5, G.M.H * TS, TS + 1, below * TS + 2); }
      else if (SOLID.has(ch) || ch === 'F') { ctx.fillStyle = ch === '%' ? G.th.stone2 : G.th.dirt; ctx.fillRect(x * TS - .5, G.M.H * TS, TS + 1, below * TS + 2); }
    }
    /* lava por trás */
    drawLava(G, ctx, c0, c1, r0, r1);
    G.M.loops.forEach(L => drawLoop(G, ctx, L, false));
    drawTiles(G, ctx, c0, c1, r0, r1);
    drawObjects(G, ctx);
    drawItems(G, ctx);
    drawEnemies(G, ctx);
    if (G.boss) drawBoss(G, ctx);
    G.balls.forEach(b => { const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 12); g.addColorStop(0, '#fff7c2'); g.addColorStop(.4, '#fb923c'); g.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, TAU); ctx.fill(); });
    drawPip(G, ctx);
    G.M.loops.forEach(L => drawLoop(G, ctx, L, true));
    /* paredes falsas por cima (ficam translúcidas quando o Pip está dentro) */
    drawFake(G, ctx, c0, c1, r0, r1);
    G.fx.forEach(f => {
      if (f.k === 'dust') { ctx.globalAlpha = Math.max(0, f.life * 2.4); ctx.fillStyle = th.snow ? '#fff' : 'rgba(240,230,210,.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.s * (1.3 - f.life), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      else if (f.k === 'brick') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.fillStyle = '#c96a36'; ctx.fillRect(-7, -5, 14, 10); ctx.strokeStyle = '#6e3518'; ctx.strokeRect(-7, -5, 14, 10); ctx.restore(); }
    });
    G.pops.forEach(c => { const k = Math.abs(Math.cos(c.t * 18)); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 9 * k + 1, 11, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b07400'; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.restore();
    /* desvanecer ao entrar em portas */
    if (G.fade > 0) { const k = G.fade > .35 ? 1 - (G.fade - .35) / .2 : G.fade / .35; ctx.fillStyle = `rgba(0,0,0,${U.clamp(k, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
    drawHUD(G, ctx, W, H, api);
  }

  function drawBG(G, ctx, W, H) {
    const th = G.th, z = G.z;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const baseY = sy(G, G.M.H * TS) - 40 * z;
    if (th.sun) { const sg = ctx.createRadialGradient(W * .7, H * .25, 0, W * .7, H * .25, 160); sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(.18, 'rgba(255,230,160,.7)'); sg.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H); }
    if (th.lava) { const lg = ctx.createLinearGradient(0, H * .5, 0, H); lg.addColorStop(0, 'rgba(255,90,40,0)'); lg.addColorStop(1, 'rgba(255,90,40,.35)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); }
    /* nuvens */
    if (th.cloud || th.snow) for (let i = 0; i < 7; i++) {
      const cx = ((i * 260 - G.cam.x * .08 * z + G.t * 8) % (W + 300) + W + 300) % (W + 300) - 150, cy = H * (.12 + (i * 37 % 30) / 100);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, TAU); ctx.arc(cx + 28, cy - 10, 32, 0, TAU); ctx.arc(cx + 60, cy, 24, 0, TAU); ctx.fill();
    }
    if (th.lava) { ctx.fillStyle = 'rgba(255,200,150,.5)'; for (let i = 0; i < 30; i++) { const ex = ((i * 97 - G.cam.x * .2 * z) % W + W) % W, ey = H - ((G.t * 30 + i * 53) % H); ctx.globalAlpha = .3 + (i % 3) * .2; ctx.fillRect(ex, ey, 2, 2); } ctx.globalAlpha = 1; }
    /* silhuetas */
    const lay = (par, col, f) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); const off = G.cam.x * par; for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, f((x / z + off))); ctx.lineTo(W, H); ctx.fill(); };
    const n1 = x => { const i = Math.floor(x), t = x - i, a = hsh(i), b = hsh(i + 1); return a + (b - a) * t * t * (3 - 2 * t); };
    if (th.mount) {
      lay(.1, th.far, x => baseY - 120 * z - Math.abs(((x / 260) % 2 + 2) % 2 - 1) * 260 * z * (.6 + n1(Math.floor(x / 520)) * .5));
      ctx.fillStyle = 'rgba(255,255,255,.5)';
    } else if (th.pyr) {
      lay(.08, th.far, x => { const k = ((x % 700) + 700) % 700; return baseY - 80 * z - Math.max(0, 230 - Math.abs(k - 350) * .9) * z; });
    } else if (th.towers) {
      lay(.1, th.far, x => { const k = Math.floor(x / 90), h = hsh(k); return baseY - (90 + (h > .6 ? 200 : h > .3 ? 120 : 60)) * z; });
    } else lay(.1, th.far, x => baseY - (70 + n1(x / 300) * 150) * z);
    lay(.25, th.mid, x => baseY - (40 + n1(x / 160 + 40) * 90) * z);
    if (th.id === 'deserto') { /* cactos */ for (let i = 0; i < 8; i++) { const cx = ((i * 230 - G.cam.x * .4 * z) % (W + 200) + W + 200) % (W + 200) - 100, cy = baseY - 30 * z; ctx.fillStyle = th.near; ctx.fillRect(cx - 6 * z, cy - 60 * z, 12 * z, 64 * z); ctx.fillRect(cx - 22 * z, cy - 40 * z, 8 * z, 22 * z); ctx.fillRect(cx - 22 * z, cy - 24 * z, 20 * z, 8 * z); } }
    lay(.4, th.near, x => baseY - (12 + n1(x / 70 + 90) * 40) * z);
  }
  const hsh = n => { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; };

  function drawTiles(G, ctx, c0, c1, r0, r1) {
    const th = G.th, M = G.M;
    const air = (cx, cy) => { if (cy >= M.H) return false; const ch = tAt(G, cx, cy); return !(SOLID.has(ch) || ch === 'F' || SLOPE[ch]); };
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
      const ch = tAt(G, x, y);
      if (ch === '.' || ch === '~' || ch === 'F' || ch === 'h') continue;
      const bump = G.bumps.get(x + ',' + y), by = bump ? -Math.sin((1 - bump / .2) * Math.PI) * 8 : 0;
      if (SLOPE[ch]) { drawSlope(G, ctx, ch, x, y); continue; }
      if (x < 0 || x >= M.W) continue;
      const mask = (air(x, y - 1) ? 1 : 0) | (air(x - 1, y) ? 2 : 0) | (air(x + 1, y) ? 4 : 0) | (air(x, y + 1) ? 8 : 0);
      const spr = tileSprite(th, ch === 'P' || ch === '!' || ch === 'H' || ch === 'Q' ? '?' : ch, ch === '#' || ch === '%' || ch === '=' ? mask : 0, ch === '#' ? (x * 7 + y * 13) % 4 : 0);
      ctx.drawImage(spr, x * TS, y * TS + by, TS, TS);
      if (ch === '?' || ch === 'P' || ch === '!' || ch === 'H') { /* brilho a correr */ const k = (G.t * .8 + x * .13) % 1; if (k < .25) { ctx.fillStyle = `rgba(255,255,255,${(1 - k * 4) * .35})`; ctx.fillRect(x * TS + 3, y * TS + 3 + by, TS - 6, TS - 7); } }
    }
  }
  function drawSlope(G, ctx, ch, cx, cy) {
    const th = G.th, x0 = cx * TS, yb = (cy + 1) * TS;
    const h0 = hgt(ch, 0), h1 = hgt(ch, TS);
    const g = ctx.createLinearGradient(0, yb - TS, 0, yb); g.addColorStop(0, th.dirt); g.addColorStop(1, th.dirt2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - .5, yb + .5); ctx.lineTo(x0 - .5, yb - h0); ctx.lineTo(x0 + TS + .5, yb - h1); ctx.lineTo(x0 + TS + .5, yb + .5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = th.top2; ctx.lineWidth = 10; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x0 - .5, yb - h0 + 4.5); ctx.lineTo(x0 + TS + .5, yb - h1 + 4.5); ctx.stroke();
    ctx.strokeStyle = th.top; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 - .5, yb - h0 + 2.5); ctx.lineTo(x0 + TS + .5, yb - h1 + 2.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, yb - h0 + .5); ctx.lineTo(x0 + TS, yb - h1 + .5); ctx.stroke();
  }
  function drawFake(G, ctx, c0, c1, r0, r1) {
    const th = G.th, p = G.p, pc = Math.floor(p.x / TS), pr = Math.floor((p.y - 20) / TS);
    let inside = tAt(G, pc, pr) === 'F' || tAt(G, pc, pr + 1) === 'F';
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
      if (tAt(G, x, y) !== 'F') continue;
      ctx.globalAlpha = inside ? .35 : 1;
      ctx.drawImage(tileSprite(th, '#', (tAt(G, x, y - 1) === '.' ? 1 : 0)), x * TS, y * TS, TS, TS);
    }
    ctx.globalAlpha = 1;
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
      /* pista do loop: anel axadrezado por trás do Pip */
      ctx.lineWidth = 22; ctx.strokeStyle = G.th.dirt2; ctx.beginPath(); ctx.arc(cx, cy, R + 11, 0, TAU); ctx.stroke();
      const n = 28;
      for (let i = 0; i < n; i++) { ctx.strokeStyle = i % 2 ? G.th.top : G.th.top2; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R + 4, i / n * TAU, (i + 1) / n * TAU); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, TAU); ctx.fill();
    } else {
      /* lábio da frente (dá profundidade quando o Pip passa por trás) */
      ctx.strokeStyle = G.th.top2; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R + 13, Math.PI * .38, Math.PI * .62); ctx.stroke();
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
        for (let i = 1; i <= o.n; i++) { const fx = o.x + Math.cos(o.a) * i * 15, fy = o.y + Math.sin(o.a) * i * 15; const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 11); g.addColorStop(0, '#fff7c2'); g.addColorStop(.45, '#fb923c'); g.addColorStop(1, 'rgba(239,68,68,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 11, 0, TAU); ctx.fill(); }
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
    /* bandeiras de controlo */
    M.checks.forEach(c => {
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(c.x - 2, c.y - 70, 4, 70);
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(c.x, c.y - 72, 5, 0, TAU); ctx.fill();
      const fy = c.on ? c.y - 66 : c.y - 24, wv = Math.sin(G.t * 6) * 3;
      ctx.fillStyle = c.on ? '#22c55e' : '#ef4444'; ctx.beginPath(); ctx.moveTo(c.x + 2, fy); ctx.quadraticCurveTo(c.x + 16, fy + 4 + wv, c.x + 30, fy + 8); ctx.lineTo(c.x + 2, fy + 18); ctx.fill();
    });
    /* meta */
    if (M.goal) {
      const gx = M.goal.x, gy = M.goal.y, open = !G.boss || !G.boss.alive;
      ctx.globalAlpha = open ? 1 : .35;
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(gx - 3, gy - 260, 6, 260);
      ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(gx, gy - 262, 8, 0, TAU); ctx.fill();
      const fy = G.win ? Math.min(gy - 40, gy - 250 + G.winT * 120) : gy - 250, wv = Math.sin(G.t * 5) * 4;
      ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(gx + 3, fy); ctx.quadraticCurveTo(gx + 26, fy + 8 + wv, gx + 48, fy + 14); ctx.lineTo(gx + 3, fy + 30); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🦊', gx + 20, fy + 20);
      ctx.fillStyle = G.th.stone2; ctx.fillRect(gx - 14, gy - 10, 28, 10);
      ctx.globalAlpha = 1;
    }
  }

  function drawItems(G, ctx) {
    G.M.items.forEach(it => {
      if (it.got) {
        if (it.t > .35) return;
        ctx.globalAlpha = 1 - it.t / .35; ctx.fillStyle = it.k === 'star' ? '#fde047' : '#ffd34d';
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
        ctx.save(); ctx.translate(it.x, it.y + bob); ctx.rotate(Math.sin(G.t * 2) * .15);
        const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 30); halo.addColorStop(0, 'rgba(253,224,71,.6)'); halo.addColorStop(1, 'rgba(253,224,71,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
        ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); ctx.stroke();
        star(ctx, 0, 0, 10, '#fff7c2');
        ctx.restore();
      } else {
        const r = 14, y = it.y + (it.rise ? 0 : bob);
        ctx.save(); ctx.translate(it.x, y);
        if (it.k === 'fire') { ctx.fillStyle = '#22c55e'; ctx.fillRect(-2, 2, 4, 12); ['#ef4444', '#fb923c', '#fde047'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -2, 11 - i * 3.5, 0, TAU); ctx.fill(); }); ctx.fillStyle = '#111'; ctx.fillRect(-4, -4, 2, 4); ctx.fillRect(2, -4, 2, 4); }
        else if (it.k === 'starp') { ctx.rotate(G.t * 6); star(ctx, 0, 0, r, `hsl(${(G.t * 300) % 360},95%,60%)`); }
        else if (it.k === 'heart') { ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-16, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 16, -2, 0, 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-5, -5, 3, 2, -.5, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    });
  }
  function star(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  function drawEnemies(G, ctx) {
    G.M.enemies.forEach(e => {
      if (!e.act && !(e.x > G.cam.x - 60 && e.x < G.cam.x + G.VW + 60)) return;
      if (!e.alive && !(e.squash > 0)) return;
      ctx.save(); ctx.translate(e.x, e.y);
      if (!e.alive) { if (e.flip) { ctx.translate(0, (.5 - e.squash) * 160); ctx.rotate(Math.PI); } else { ctx.scale(1.3, .35); } ctx.globalAlpha = Math.min(1, e.squash * 3); }
      const dirF = e.vx > 0 ? -1 : 1, step = Math.sin(e.t * 10);
      if (e.k === 'walker') {
        /* bolota com chapéu */
        ctx.fillStyle = '#3f2a14'; ctx.fillRect(-9, -4 + step, 6, 5); ctx.fillRect(3, -4 - step, 6, 5);
        const g = ctx.createRadialGradient(-4, -18, 2, 0, -12, 16); g.addColorStop(0, '#d9a066'); g.addColorStop(1, '#8a5a2b');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -13, 13, 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(0, -23, 14, 6, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-1.5, -32, 3, 5);
        ctx.strokeStyle = '#3f2a14'; ctx.lineWidth = 1; for (let i = -10; i <= 10; i += 5) { ctx.beginPath(); ctx.moveTo(i, -28); ctx.lineTo(i + 2, -23); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-4 * dirF - 1, -14, 3.5, 4.5, 0, 0, TAU); ctx.ellipse(4 * dirF - 1, -14, 3.5, 4.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-4 * dirF - 2 * dirF, -13, 1.8, 0, TAU); ctx.arc(4 * dirF - 2 * dirF, -13, 1.8, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(-2, -18); ctx.moveTo(8, -20); ctx.lineTo(2, -18); ctx.stroke();
      } else if (e.k === 'spiky') {
        ctx.fillStyle = '#334155';
        for (let i = 0; i < 9; i++) { const a = Math.PI + (i + .5) / 9 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a - .18) * 12, -12 + Math.sin(a - .18) * 12); ctx.lineTo(Math.cos(a) * 22, -12 + Math.sin(a) * 22); ctx.lineTo(Math.cos(a + .18) * 12, -12 + Math.sin(a + .18) * 12); ctx.fill(); }
        ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.ellipse(0, -11, 15, 11, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f5d0a9'; ctx.beginPath(); ctx.ellipse(-dirF * 10, -8, 7, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-dirF * 9, -11, 1.8, 0, TAU); ctx.arc(-dirF * 16, -7, 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1f2937'; ctx.fillRect(-8, -2 + step, 5, 3); ctx.fillRect(3, -2 - step, 5, 3);
      } else if (e.k === 'flyer') {
        ctx.translate(0, 12);
        const wf = Math.sin(e.t * 40) * .6;
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.save(); ctx.rotate(-.4 + wf); ctx.beginPath(); ctx.ellipse(-4, -14, 7, 11, 0, 0, TAU); ctx.fill(); ctx.restore(); ctx.save(); ctx.rotate(.4 - wf); ctx.beginPath(); ctx.ellipse(4, -14, 7, 11, 0, 0, TAU); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(0, -6, 13, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1f2937'; ctx.fillRect(-5, -15, 4, 18); ctx.fillRect(3, -15, 4, 18);
        ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(18, -4); ctx.lineTo(12, -2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -9, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -9, 1.8, 0, TAU); ctx.fill();
      } else if (e.k === 'lavab') {
        if (!e.up) { ctx.restore(); return; }
        const g = ctx.createRadialGradient(-3, -16, 2, 0, -11, 16); g.addColorStop(0, '#fff3b0'); g.addColorStop(.4, '#fb923c'); g.addColorStop(1, '#dc2626');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -11, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(251,146,60,.5)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(Math.sin(e.t * 9 + i) * 5, 6 + i * 6, 5 - i, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#111'; ctx.fillRect(-6, -14, 3, 5); ctx.fillRect(3, -14, 3, 5);
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
    const s = 2.6, f = B.vx > 0 ? -1 : 1, step = Math.sin(B.t * 8);
    ctx.scale(s, s);
    ctx.fillStyle = '#3f2a14'; ctx.fillRect(-10, -4 + step, 7, 5); ctx.fillRect(3, -4 - step, 7, 5);
    const g = ctx.createRadialGradient(-4, -18, 2, 0, -12, 16); g.addColorStop(0, '#e0a870'); g.addColorStop(1, '#7a4a20');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -13, 14, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-7, -33); ctx.lineTo(-3, -26); ctx.lineTo(0, -35); ctx.lineTo(3, -26); ctx.lineTo(7, -33); ctx.lineTo(10, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-4 * f - 1, -14, 3.5, 4, 0, 0, TAU); ctx.ellipse(4 * f - 1, -14, 3.5, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(-4 * f - 2 * f, -13.5, 1.8, 0, TAU); ctx.arc(4 * f - 2 * f, -13.5, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-9, -21); ctx.lineTo(-2, -18); ctx.moveTo(9, -21); ctx.lineTo(2, -18); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(6, -7); ctx.lineTo(4, -4); ctx.lineTo(2, -6); ctx.lineTo(0, -4); ctx.lineTo(-2, -6); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (B.act && B.alive) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < B.hp ? '#ef4444' : 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(B.x - 16 + i * 16, B.y - 100, 5, 0, TAU); ctx.fill(); } }
  }

  /* ── o Pip (raposa) ── */
  function drawPip(G, ctx) {
    const p = G.p;
    if (p.inv > 0 && !G.dead && Math.floor(G.t * 20) % 2) return;
    const fur = '#f97316', furD = '#c2410c', cream = '#fff4e2', dark = '#3b1d0b';
    ctx.save();
    ctx.translate(p.x, p.y);
    if (G.dead) ctx.rotate(G.why === 'fall' ? 0 : Math.min(Math.PI, G.deadT * 6));
    if (p.loop) { ctx.translate(0, -PHR / 2); ctx.rotate(p.a); ctx.translate(0, PHR / 2); }
    else if (p.on && p.a) ctx.rotate(p.a * .7);
    const f = p.face, sq = p.sq;
    ctx.scale(f * (1 - sq * .5), 1 + sq);
    if (p.star > 0) { ctx.shadowColor = `hsl(${(G.t * 400) % 360},100%,60%)`; ctx.shadowBlur = 18; }
    const speed = Math.abs(p.on ? p.gsp : p.vx);
    if (p.roll || p.loop || (!p.on && p.jumped && Math.abs(p.vx) > 330)) {
      /* bola a rolar (com cauda em espiral) */
      ctx.rotate(p.anim * 1.4);
      const g = ctx.createRadialGradient(-4, -17, 2, 0, -13, 15); g.addColorStop(0, '#fdba74'); g.addColorStop(1, furD);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -13, 13, 0, TAU); ctx.fill();
      ctx.strokeStyle = cream; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -13, 8, 0, 4); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(9, -22); ctx.lineTo(14, -26); ctx.lineTo(12, -18); ctx.fill();
      ctx.restore(); return;
    }
    const run = p.on && speed > 20, sprint = speed > 470, air = !p.on;
    const ph = p.anim, sw = Math.sin(ph), sw2 = Math.cos(ph);
    const crouch = p.crouch ? 10 : 0;
    /* cauda */
    ctx.save(); ctx.translate(-9, -16 + crouch * .6); ctx.rotate(air ? -.3 : -.7 - sw * .15 + (sprint ? .6 : 0));
    const tg = ctx.createLinearGradient(-26, 0, 0, 0); tg.addColorStop(0, cream); tg.addColorStop(.35, fur); tg.addColorStop(1, furD);
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-10, -12, -28, -10, -30, 2); ctx.bezierCurveTo(-24, 10, -8, 8, 0, 4); ctx.fill();
    ctx.restore();
    /* pernas */
    if (sprint) {
      /* rodas de pernas (desfoque à Sonic) */
      ctx.strokeStyle = 'rgba(194,65,12,.55)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, -6, 9, 6, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(Math.cos(ph * 2) * 8, -6 + Math.sin(ph * 2) * 5, 3.5, 0, TAU); ctx.arc(-Math.cos(ph * 2) * 8, -6 - Math.sin(ph * 2) * 5, 3.5, 0, TAU); ctx.fill();
    } else {
      const la = air ? (p.vy < 0 ? -.6 : .35) : run ? sw * .85 : 0, lb = air ? (p.vy < 0 ? .5 : -.25) : run ? -sw * .85 : 0;
      leg(ctx, -4, -12 + crouch, lb, furD, dark); leg(ctx, 4, -12 + crouch, la, fur, dark);
    }
    /* corpo */
    const bob = run ? Math.abs(sw2) * 2 : Math.sin(G.t * 2.4) * .8;
    ctx.save(); ctx.translate(0, -21 + crouch - bob); ctx.rotate(sprint ? .28 : run ? .1 : 0);
    const bg = ctx.createLinearGradient(-10, -10, 10, 10); bg.addColorStop(0, '#fb923c'); bg.addColorStop(1, furD);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = cream; ctx.beginPath(); ctx.ellipse(3, 3, 6, 8, .2, 0, TAU); ctx.fill();
    /* braço */
    const aa = air ? -2.2 : run ? -sw * 1 : .2;
    ctx.save(); ctx.translate(2, -4); ctx.rotate(aa); ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke(); ctx.fillStyle = cream; ctx.beginPath(); ctx.arc(0, 11, 3, 0, TAU); ctx.fill(); ctx.restore();
    /* cabeça */
    ctx.translate(3, -14);
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(-11, -18); ctx.lineTo(-2, -9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(4, -20); ctx.lineTo(9, -6); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-10.5, -15); ctx.lineTo(-11, -18); ctx.lineTo(-7, -12); ctx.fill(); ctx.beginPath(); ctx.moveTo(3.5, -17); ctx.lineTo(4, -20); ctx.lineTo(6.5, -14); ctx.fill();
    const hg = ctx.createRadialGradient(-2, -6, 2, 0, -2, 13); hg.addColorStop(0, '#fdba74'); hg.addColorStop(1, fur);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, -2, 11, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = cream; ctx.beginPath(); ctx.moveTo(-1, 0); ctx.quadraticCurveTo(8, -3, 15, 2); ctx.quadraticCurveTo(10, 8, 0, 7); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(15, 1.5, 2.6, 0, TAU); ctx.fill();
    /* olho (pisca) */
    p.blink -= 1 / 60; if (p.blink < -.12) p.blink = 2 + Math.random() * 3;
    if (G.dead) { ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(7, -2); ctx.moveTo(7, -7); ctx.lineTo(2, -2); ctx.stroke(); }
    else if (p.blink < 0) { ctx.strokeStyle = dark; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(8, -4); ctx.stroke(); }
    else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(5, -5, 3.6, 4.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(6, -4.8, 2.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(6.4, -6.6, 1.2, 1.2); }
    ctx.restore();
    if (p.fire) { ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(-2, -26 + crouch - bob, 2.5 + Math.sin(G.t * 12), 0, TAU); ctx.fill(); }
    ctx.restore();
    if (p.skid > 0 && p.on) dust(G, p.x + p.face * 8, p.y, 1);
  }
  function leg(ctx, x, y, a, col, dark) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(1.5, 11, 4.5, 2.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
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
    for (let i = 0; i < G.totalStars; i++) { const x = W0 - 22 - (G.totalStars - 1 - i) * 26, y = 76; ctx.globalAlpha = i < G.stars.length ? 1 : .35; ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); star(ctx, x, y, 7, i < G.stars.length ? '#fde047' : '#fef9c3'); }
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
      ctx.fillText('← → mover · Espaço saltar (mais tempo = mais alto) · ↓ rolar · ↑ portas · X fogo', W / 2, H - 22);
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
          <h4>${wi + 1}. ${t.name}</h4><small>${['Rampas, loops e molas', 'Aceleradores e plataformas que caem', 'Gelo escorregadio', 'Lava, barras de fogo e o Rei Bolota'][wi]}</small>
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
    tagline: 'Corre, salta e rola por 4 mundos — rampas, loops, molas, zonas secretas e o Rei Bolota no fim.',
    view: { w: 960 }, picker, bestLabel: 'Recorde',
    how: [
      '<b>← →</b> para correr (manter acelera), <b>Espaço</b> para saltar — quanto mais tempo premes, mais alto. Salta em cima dos inimigos!',
      '<b>↓</b> a correr = <b>rolar</b>: as descidas dão embalo e derrubas bolotas e abelhas (os ouriços picam!). Com embalo dás a volta aos <b>loops</b>.',
      'Bate nos blocos <b>?</b> por baixo. Procura as <b>3 moedas-estrela</b> de cada nível: há paredes falsas, blocos invisíveis e portas (<b>↑</b>) para zonas secretas.',
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
      { id: 'pip.all', name: 'Herói dos Mundos', icon: '👑', desc: 'Vence o Rei Bolota em Mundos de Pip.', test: c => ((c.result.meta || {}).level || 0) >= 8 },
      { id: 'pip.stars', name: 'Caçador de Estrelas', icon: '⭐', desc: 'Apanha as 3 moedas-estrela de um nível.', test: c => !!(c.result.meta || {}).all },
      { id: 'pip.perfect', name: 'Três Estrelas', icon: '🌟', desc: 'Conclui um nível com ★★★.', test: c => ((c.result.meta || {}).stars || 0) >= 3 },
    ],
  });
  /* para testes (validação dos níveis) */
  KIT._parse = parse; KIT._levels = LEVELS; KIT._solid = ch => SOLID.has(ch); KIT._slope = ch => !!SLOPE[ch];
  return KIT;
})();
