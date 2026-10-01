/* ══════════════════════════════════════════════════════════════════
   Fuga na Selva — corrida sem fim em 2D (inspirada em Banana Kong).
   O Kiko corre sozinho; uma avalanche de bananas vem atrás dele. Salta
   (duplo salto), desliza por baixo de troncos, agarra-te às lianas para
   atravessar rios, usa o ARRANQUE (barra de bananas) para partir pedras
   e fugir à onda. Cada tropeção deixa a onda aproximar-se; se te apanha,
   acabou. Cair num rio também.
   Mundo gerado por troços (padrões justos, calculados pela velocidade),
   4 ambientes que se sucedem (selva, templo ao pôr do sol, selva de
   noite, caverna de cristais) e power-ups: escudo, íman, folha-planador
   e bananas a dobrar. Modo diário: o mesmo percurso para toda a gente.

   Coordenadas do mundo: y para baixo, chão em y = 0 (o céu é negativo).
   O desenho é todo procedimental (canvas 2D), sem imagens.
══════════════════════════════════════════════════════════════════ */
const RunnerGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const GRAV = 2300, JUMP = 860, JUMP2 = 760, PH = 72, PW = 36, SH = 34;
  const ANCHOR_Y = -430;
  const DIFF = {
    easy:   { v0: 320, vMax: 560, acc: 5,   dens: .7,  hit: .3,  rec: .07 },
    medium: { v0: 370, vMax: 650, acc: 6.5, dens: 1,   hit: .38, rec: .055 },
    hard:   { v0: 420, vMax: 740, acc: 8,   dens: 1.25, hit: .46, rec: .045 },
  };
  const BIOMES = [
    { id: 'selva', name: 'Selva', sky: ['#7cc8f2', '#d9f2ff'], sun: '#fff7d1', far: '#79a9a0', mid: '#3f7d5a', near: '#24573d', haze: 'rgba(214,240,255,', grass: '#62c23d', grass2: '#3f9a2a', dirt: '#6d4527', dirt2: '#55341c', water: '#2f9fd6', rays: .16 },
    { id: 'templo', name: 'Templo ao Pôr do Sol', sky: ['#f7845a', '#ffd9a0'], sun: '#fff0c0', far: '#b2717a', mid: '#7a4655', near: '#4a2a3a', haze: 'rgba(255,214,170,', grass: '#9cb04a', grass2: '#6f8a32', dirt: '#8c7360', dirt2: '#6a5444', water: '#d97a5a', rays: .2, ruins: true },
    { id: 'noite', name: 'Selva de Noite', sky: ['#0b1636', '#24406e'], sun: '#e8f0ff', far: '#1c3352', mid: '#132a3f', near: '#0b1c2a', haze: 'rgba(120,160,220,', grass: '#3f8f5a', grass2: '#2a6a40', dirt: '#3a2f2a', dirt2: '#2a221e', water: '#1f4f8a', rays: 0, moon: true, flies: true },
    { id: 'caverna', name: 'Caverna de Cristal', sky: ['#160c24', '#2d1b45'], sun: '#a78bfa', far: '#2a1a40', mid: '#211433', near: '#150c22', haze: 'rgba(167,139,250,', grass: '#5b4a7a', grass2: '#45386a', dirt: '#3b2f4f', dirt2: '#2c233b', water: '#2ad1c9', rays: 0, cave: true },
  ];
  const BIOME_M = 900;   /* metros por ambiente */

  /* ── sprites em cache (bananas) ── */
  let _ban = null;
  function bananaSprite() {
    if (_ban) return _ban;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.translate(32, 32); x.rotate(-.5);
    x.beginPath(); x.moveTo(-22, -6); x.quadraticCurveTo(0, 26, 24, -8); x.quadraticCurveTo(2, 10, -22, -6); x.closePath();
    const g = x.createLinearGradient(0, -10, 0, 18); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ffd43b'); g.addColorStop(1, '#e0a000');
    x.fillStyle = g; x.fill(); x.strokeStyle = '#a86b00'; x.lineWidth = 1.6; x.stroke();
    x.fillStyle = '#5a3a10'; x.fillRect(-25, -9, 5, 5); x.fillRect(22, -11, 4, 4);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-12, 0); x.quadraticCurveTo(0, 10, 12, 0); x.stroke();
    return (_ban = c);
  }

  /* ── ruído determinístico para o cenário ── */
  const hash = n => { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; };
  function vnoise(x) { const i = Math.floor(x), f = x - i, a = hash(i), b = hash(i + 1); const t = f * f * (3 - 2 * f); return a + (b - a) * t; }

  /* ════════════════════════════════════════════════════════════════
     estado
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const cfg = DIFF[o.diff] || DIFF.medium;
    const daily = o.mode === 'daily';
    const GP = typeof GameProgress !== 'undefined' ? GameProgress : null;
    const rnd = daily && GP ? GP.rng(GP.dailySeed('runner')) : Math.random;
    const G = {
      cfg, rnd, daily, t: 0, v: cfg.v0, dist: 0, bananas: 0, combo: 0, comboT: 0,
      p: { x: 0, y: 0, vx: cfg.v0, vy: 0, on: true, jumps: 0, slideT: 0, dashT: 0, swing: null, inv: 0, shield: false, magT: 0, glideT: 0, x2T: 0, tumble: 0, run: 0, sq: 0, coyote: 0, plat: null, released: 0 },
      energy: .35, gap: 1, slowT: 0, dead: false, deathT: 0, why: '',
      ground: [{ x0: -2000, x1: 900 }], plats: [], vines: [], obs: [], items: [], decor: [], fx: [], leaves: [],
      genX: 900, camX: -200, camY: -400, zoom: 1, VW: 800, VH: 560, biome: 0, biomeK: 0, shake: 0,
      ges: null, smashed: 0, swings: 0, best: null,
    };
    for (let i = 0; i < 6; i++) G.items.push({ x: 300 + i * 50, y: -40, k: 'banana' });
    return G;
  }

  /* ════════════════════════════════════════════════════════════════
     gerador de troços
  ════════════════════════════════════════════════════════════════ */
  function gen(G) {
    const r = G.rnd, R = (a, b) => a + r() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), pick = a => a[Math.floor(r() * a.length)];
    const v = Math.max(G.v, G.cfg.v0) * 1.05, D = v * (2 * JUMP / GRAV);   /* distância de um salto à velocidade atual */
    const m = G.genX / 50, d = G.cfg.dens;
    let x = G.genX;
    const ground = (a, b) => { const last = G.ground[G.ground.length - 1]; if (last && a <= last.x1 + 1) last.x1 = Math.max(last.x1, b); else G.ground.push({ x0: a, x1: b }); };
    const ban = (bx, by) => G.items.push({ x: bx, y: by, k: 'banana' });
    const arcB = (x0, x1, h, n, base) => { for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : .5; ban(U.lerp(x0, x1, t), (base || -38) - Math.sin(t * Math.PI) * h); } };
    const lineB = (x0, x1, y, n) => { for (let i = 0; i < n; i++) ban(U.lerp(x0, x1, n > 1 ? i / (n - 1) : .5), y); };
    const deco = (x0, x1) => { for (let dx = x0 + R(20, 120); dx < x1 - 30; dx += R(120, 320)) G.decor.push({ x: dx, k: pick(['fern', 'fern', 'flower', 'mush', 'stone', 'tuft']), s: R(.7, 1.25), h: r() }); };
    const power = (px, py) => { const k = pick(['shield', 'magnet', 'glide', 'x2', 'bunch', 'bunch']); G.items.push({ x: px, y: py, k }); };

    const pool = [['run', 3]];
    if (m > 8) pool.push(['rocks', 3 * d]);
    if (m > 20) pool.push(['pit', 2.5 * d], ['log', 2 * d]);
    if (m > 40) pool.push(['plats', 1.6], ['boulder', 1.4 * d], ['birds', 1.4 * d], ['thorns', 1.5 * d]);
    if (m > 60) pool.push(['vines', 1.8]);
    if (m > 140) pool.push(['combo', 1.6 * d]);
    let tot = pool.reduce((s, p) => s + p[1], 0), q = r() * tot, kind = 'run';
    for (const [k, w] of pool) { q -= w; if (q <= 0) { kind = k; break; } }
    if (kind === G.lastKind && kind !== 'run' && r() < .6) kind = 'run';
    G.lastKind = kind;

    if (kind === 'run') {
      const L = R(380, 700); ground(x, x + L); deco(x, x + L);
      if (r() < .7) arcB(x + 80, x + L - 80, r() < .5 ? 0 : R(40, 90), RI(5, 9));
      if (r() < .12 * (m > 30 ? 1 : 0)) power(x + L / 2, -120);
      x += L;
    } else if (kind === 'rocks') {
      const n = RI(1, m > 80 ? 3 : 2), gapR = Math.max(D * .85, 240);
      ground(x, x + 160 + n * gapR + 120);
      for (let i = 0; i < n; i++) {
        const rx = x + 160 + i * gapR + R(-20, 20), w = R(46, 70), h = R(38, 56);
        G.obs.push({ x: rx, y: -h, w, h, k: 'rock', seed: r() });
        arcB(rx - D * .35 + w / 2, rx + D * .35 + w / 2, 130, 5);
      }
      x += 160 + n * gapR + 120; deco(x - 200, x);
    } else if (kind === 'pit') {
      const w = U.clamp(R(.38, .62) * D * (d > 1 ? 1.08 : 1), 110, 330);
      ground(x, x + 200); arcB(x + 200 - D * .18, x + 200 + w + D * .18, 135, 6);
      G.pits = (G.pits || 0) + 1;
      x += 200 + w; ground(x, x + 220); deco(x + 40, x + 200); x += 220;
    } else if (kind === 'log') {
      ground(x, x + 520);
      const lx = x + 260;
      G.obs.push({ x: lx, y: -210, w: 90, h: 210 - 44, k: 'log', seed: r() });
      lineB(lx - 60, lx + 150, -18, 6);
      x += 520;
    } else if (kind === 'thorns') {
      const L = 520; ground(x, x + L);
      const tx = x + 200, w = R(80, 130);
      G.obs.push({ x: tx, y: -40, w, h: 40, k: 'thorn', seed: r() });
      if (r() < .6) { G.plats.push({ x: tx - 60, y: -150, w: w + 120, k: 'branch' }); lineB(tx - 40, tx + w + 40, -190, 5); }
      else arcB(tx - D * .3, tx + w + D * .3, 140, 6);
      x += L;
    } else if (kind === 'boulder') {
      const L = 700; ground(x, x + L);
      G.obs.push({ x: x + L - 100, y: -38, w: 76, h: 76, k: 'boulder', roll: R(140, 210), rot: 0, seed: r() });
      lineB(x + 120, x + 400, -150, 5);
      x += L;
    } else if (kind === 'birds') {
      const L = 640; ground(x, x + L);
      const n = RI(1, 2);
      for (let i = 0; i < n; i++) {
        const low = r() < .55;
        G.obs.push({ x: x + 300 + i * 220, y: low ? -96 : -210, w: 46, h: 30, k: 'bird', fly: R(90, 150), seed: r() });
        if (low) lineB(x + 220 + i * 220, x + 380 + i * 220, -18, 4); else lineB(x + 220 + i * 220, x + 380 + i * 220, -40, 4);
      }
      x += L; deco(x - L, x);
    } else if (kind === 'plats') {
      /* degraus de ramos por cima de um barranco */
      /* distâncias proporcionais à velocidade: tempo no ar ≈ 0,5 s até aterrar */
      ground(x, x + 160);
      let px = x + 160 + v * R(.12, .2), py = -R(105, 135);
      const n = RI(3, 5);
      for (let i = 0; i < n; i++) {
        const w = v * R(.48, .66) + 50;
        G.plats.push({ x: px, y: py, w, k: G.biome % 2 ? 'stone' : 'branch' });
        lineB(px + 30, px + w - 30, py - 40, 3);
        if (i === Math.floor(n / 2) && r() < .5) power(px + w / 2, py - 120);
        px += w + v * R(.2, .32); py = U.clamp(py + R(-60, 55), -230, -100);
      }
      x = px + 20; ground(x - 40, x + 260); x += 260;
    } else if (kind === 'vines') {
      ground(x, x + 220);
      const n = RI(2, 4), S = U.clamp(v * .72, 270, 380);
      let ax = x + 220 + 80;
      for (let i = 0; i < n; i++) {
        G.vines.push({ x: ax, y: ANCHOR_Y, len: R(250, 285), sway: r() * 6 });
        arcB(ax + 40, ax + S - 40, 60, 4, -300);
        ax += S;
      }
      x = ax - S + 260; ground(x, x + 280); deco(x + 30, x + 260); x += 280;
    } else if (kind === 'combo') {
      /* rocha → buraco → tronco baixo */
      ground(x, x + 260);
      G.obs.push({ x: x + 130, y: -46, w: 54, h: 46, k: 'rock', seed: r() });
      const w = U.clamp(D * .45, 120, 260);
      x += 260 + w; ground(x, x + 600);
      G.obs.push({ x: x + 300, y: -210, w: 90, h: 166, k: 'log', seed: r() });
      lineB(x + 230, x + 460, -18, 5);
      x += 600;
    }
    G.genX = x;
  }

  /* ════════════════════════════════════════════════════════════════
     física
  ════════════════════════════════════════════════════════════════ */
  const onGroundAt = (G, x) => G.ground.some(s => x >= s.x0 && x <= s.x1);
  function supportAt(G, p) {
    /* devolve a altura do apoio por baixo dos pés (0 = chão), ou null */
    const xs = [p.x - PW * .32, p.x + PW * .32];
    let best = null;
    if (xs.some(x => onGroundAt(G, x))) best = 0;
    G.plats.forEach(pl => { if (xs.some(x => x >= pl.x && x <= pl.x + pl.w)) { if (best === null || pl.y < best) { if (p.y <= pl.y + 2) best = pl.y; } } });
    return best;
  }

  function jump(G, api, full) {
    const p = G.p;
    if (G.dead) return;
    /* no toque o salto sai ao levantar o dedo: aí é sempre o salto inteiro
       (a altura variável é só para quem mantém a tecla/botão premido) */
    p.full = !!full;
    if (p.swing) { release(G, api, true); return; }
    if (p.on || p.coyote > 0) { p.vy = -JUMP; p.on = false; p.coyote = 0; p.jumps = 1; p.slideT = 0; p.sq = -.25; sfxJump(api, 0); dust(G, p.x, p.y, 6); return; }
    if (p.jumps < 2 || p.glideT > 0) { p.vy = -JUMP2; p.jumps = 2; p.sq = -.2; sfxJump(api, 1); flip(G); return; }
  }
  function flip(G) { G.p.flip = 1; }
  function slide(G, api) {
    const p = G.p; if (G.dead || p.swing) return;
    if (p.on) { if (p.slideT <= 0) api.sfx.noise(.18, .05, 0, 900); p.slideT = .62; }
    else { p.vy = Math.max(p.vy, 1100); p.dive = true; api.sfx.tone(500, .12, 'triangle', .05, 0, 180); }
  }
  function dash(G, api) {
    const p = G.p; if (G.dead || p.dashT > 0 || G.energy < .34) return;
    G.energy -= .34; p.dashT = .55; p.inv = Math.max(p.inv, .6);
    if (p.swing) release(G, api, true);
    if (!p.on) p.vy = Math.min(p.vy, -120);
    G.gap = Math.min(1, G.gap + .12);
    api.sfx.noise(.3, .08, 0, 1800, 'highpass'); api.sfx.tone(220, .25, 'sawtooth', .05, 0, 660); api.vibe(25);
  }
  function release(G, api, byTap) {
    const p = G.p, s = p.swing; if (!s) return;
    const L = s.L, th = s.th, w = s.w;
    let vx = w * L * Math.cos(th), vy = -w * L * Math.sin(th);
    vx = Math.max(vx, G.v * 1.12); vy = Math.min(vy, -470 - (byTap && th > .35 ? 80 : 0));
    p.vx = vx; p.vy = vy; p.swing = null; p.released = .25; p.jumps = 1; p.on = false;
    s.vine.cool = .6; s.vine.w = s.w;
    api.sfx.tone(660, .14, 'triangle', .07, 0, 990);
    G.swings++;
  }

  function hurt(G, api, o) {
    const p = G.p;
    if (p.inv > 0) return;
    if (p.shield) { p.shield = false; p.inv = 1.1; smash(G, api, o, '#7dd3fc'); api.sfx.tone(880, .2, 'square', .05, 0, 330); api.float(sx(G, p.x), sy(G, p.y - PH) - 10, 'Escudo!', '#7dd3fc', 18); return; }
    p.inv = 1.3; p.tumble = .55; G.slowT = .9; G.combo = 0;
    G.gap -= G.cfg.hit;
    api.shake(10, .35); api.hitstop(.07); api.vibe([50, 30, 60]);
    api.sfx.noise(.25, .1, 0, 300, 'lowpass'); api.sfx.tone(160, .3, 'sawtooth', .07, 0, 70);
    if (o) o.hit = 1;
    if (G.gap <= 0) die(G, api, 'wave');
  }
  function smash(G, api, o, col) {
    if (!o || o.dead) return;
    o.dead = true; G.smashed++;
    const X = sx(G, o.x + o.w / 2), Y = sy(G, o.y + o.h / 2);
    api.burst(X, Y, 16, { color: col || '#d6c3a5', speed: 260, life: .7, gravity: 900, shape: 'square', size: 4 });
    api.sfx.noise(.2, .09, 0, 600); api.shake(5, .18);
    G.score = (G.score || 0) + 50;
    api.float(X, Y - 20, '+50', '#fde68a', 18);
  }
  function die(G, api, why) {
    if (G.dead) return;
    G.dead = true; G.why = why; G.deathT = 0;
    api.vibe([80, 40, 120]);
    if (why === 'pit') {
      api.sfx.noise(.4, .1, 0, 700); api.sfx.tone(300, .5, 'sine', .07, 0, 60);
      const X = sx(G, G.p.x), Y = sy(G, 36);
      api.burst(X, Y, 22, { color: '#bae6fd', speed: 260, life: .8, gravity: 900 });
    }
  }

  function step(G, dt, api) {
    const p = G.p, c = G.cfg;
    /* velocidade base: cresce com a distância */
    G.v = Math.min(c.vMax, c.v0 + G.dist * c.acc / 10);
    const vRun = G.v * (G.slowT > 0 ? .62 : 1) * (p.dashT > 0 ? 1.55 : 1);
    G.slowT = Math.max(0, G.slowT - dt);
    p.inv = Math.max(0, p.inv - dt); p.slideT = Math.max(0, p.slideT - dt); p.dashT = Math.max(0, p.dashT - dt);
    p.magT = Math.max(0, p.magT - dt); p.glideT = Math.max(0, p.glideT - dt); p.x2T = Math.max(0, p.x2T - dt);
    p.tumble = Math.max(0, p.tumble - dt); p.released = Math.max(0, p.released - dt); p.coyote = Math.max(0, p.coyote - dt);
    p.sq += (0 - p.sq) * Math.min(1, dt * 10);
    if (p.flip) p.flip = Math.max(0, p.flip - dt * 2.6);
    G.vines.forEach(vn => {
      vn.cool = Math.max(0, (vn.cool || 0) - dt);
      /* liana solta: pêndulo amortecido com uma brisa ligeira */
      if (!(p.swing && p.swing.vine === vn)) { vn.w = ((vn.w || 0) - (GRAV * .78 / vn.len) * Math.sin(vn.th || 0) * dt + Math.sin(G.t * 1.3 + vn.sway) * .08 * dt) * (1 - 1.1 * dt); vn.th = (vn.th || 0) + vn.w * dt; }
    });

    const x0 = p.x;
    if (p.swing) {
      /* pêndulo: θ'' = −(g/L)·sin θ, com um empurrão para a frente */
      const s = p.swing;
      s.w += (-(GRAV * .78 / s.L) * Math.sin(s.th) + .9) * dt;
      s.th += s.w * dt;
      s.vine.th = s.th;
      const hx = s.vine.x + Math.sin(s.th) * s.L, hy = s.vine.y + Math.cos(s.th) * s.L;
      p.x = hx; p.y = hy + PH - 8;
      if (s.th > .82 || s.w < 0) release(G, api, false);
    } else {
      /* horizontal: corre à velocidade da pista (depois de uma liana, abranda até ela) */
      p.vx += (vRun - p.vx) * Math.min(1, dt * (p.vx > vRun ? 1.6 : 6));
      p.x += p.vx * dt;
      /* vertical */
      const glide = p.glideT > 0;
      const g = glide ? 520 : GRAV * (p.vy < 0 && !G.holdJ && !p.full ? 1.25 : 1);
      p.vy += g * dt;
      if (glide) p.vy = Math.min(p.vy, G.holdJ ? -60 : 110);
      const yPrev = p.y;
      p.y += p.vy * dt;
      /* aterrar: chão e plataformas (só por cima) */
      const sup = supportAt(G, { x: p.x, y: yPrev });
      if (p.vy >= 0 && sup !== null && yPrev <= sup + 1 && p.y >= sup) {
        if (!p.on) { p.sq = Math.min(.35, p.vy / 2600); if (p.vy > 600) dust(G, p.x, sup, 8); if (p.dive) { api.shake(3, .12); p.dive = false; } }
        p.y = sup; p.vy = 0; p.on = true; p.jumps = 0;
      } else if (p.on && (sup === null || Math.abs(p.y - sup) > 2)) {
        p.on = false; p.coyote = .09;
      }
      /* parede do barranco: abaixo da relva não se atravessa a terra */
      if (p.y > 8) G.ground.forEach(sg => { if (p.x < sg.x0 && p.x + PW / 2 > sg.x0) { p.x = sg.x0 - PW / 2; p.vx = 0; } });
      /* cair num rio */
      if (p.y > 140) {
        if (p.shield) { p.shield = false; p.vy = -1250; p.y = 100; p.inv = 1.2; api.sfx.tone(880, .2, 'square', .05, 0, 330); }
        else die(G, api, 'pit');
      }
      /* agarrar uma liana (no ar, mãos perto da corda) */
      if (!p.on && p.released <= 0 && !G.dead) {
        const hx = p.x, hy = p.y - PH + 8;
        for (const vn of G.vines) {
          if (vn.cool > 0) continue;
          const bx = vn.x + Math.sin(vn.th || 0) * vn.len, by = vn.y + Math.cos(vn.th || 0) * vn.len;
          const dd = U.segDist(hx, hy, vn.x, vn.y, bx, by);
          if (dd < 34 && hy > vn.y + 60) {
            const L = U.clamp(Math.hypot(hx - vn.x, hy - vn.y), 120, vn.len);
            const th = Math.atan2(hx - vn.x, hy - vn.y);
            let w = (p.vx * Math.cos(th) - p.vy * Math.sin(th)) / L;
            const need = 2 * GRAV * .78 / L * (Math.cos(th) - Math.cos(.82));
            w = Math.max(w, Math.sqrt(Math.max(0, need) + 2.2));
            p.swing = { vine: vn, L, th, w }; p.on = false; p.dive = false; p.glideT = Math.min(p.glideT, 0);
            api.sfx.tone(392, .1, 'triangle', .06, 0, 523); api.vibe(15);
            break;
          }
        }
      }
    }
    G.dist += Math.max(0, p.x - x0) / 50;
    if (p.on && !p.swing) p.run += dt * vRun / 34;

    /* bananas e power-ups */
    const pTop = p.y - (p.slideT > 0 ? SH : PH), pcx = p.x, pcy = (p.y + pTop) / 2;
    G.items.forEach(it => {
      if (it.got) { it.t = (it.t || 0) + dt; return; }
      if (p.magT > 0 && it.k === 'banana') {
        const dx = pcx - it.x, dy = pcy - it.y, dd = Math.hypot(dx, dy);
        if (dd < 230) { const k = Math.min(1, dt * 9); it.x += dx * k; it.y += dy * k; }
      }
      if (Math.abs(it.x - pcx) < 30 + (it.k === 'banana' ? 0 : 6) && it.y > pTop - 26 && it.y < p.y + 18) collect(G, api, it);
    });
    G.comboT = Math.max(0, G.comboT - dt); if (G.comboT <= 0) G.combo = 0;

    /* obstáculos */
    const box = { x0: p.x - PW / 2 + 5, x1: p.x + PW / 2 - 5, y0: pTop + 6, y1: p.y - 2 };
    G.obs.forEach(o => {
      if (o.dead) return;
      if (o.k === 'boulder' && o.x - G.camX < G.VW + 120) { o.x -= o.roll * dt; o.rot -= o.roll * dt / 38; }
      if (o.k === 'bird' && o.x - G.camX < G.VW + 120) { o.x -= o.fly * dt; o.fl = (o.fl || 0) + dt * 14; }
      if (o.hit) o.hit = Math.max(0, o.hit - dt * 3);
      const ob = o.k === 'boulder' ? { x0: o.x + 8, x1: o.x + o.w - 8, y0: o.y + 8, y1: o.y + o.h } : o.k === 'thorn' ? { x0: o.x + 8, x1: o.x + o.w - 8, y0: o.y + 10, y1: o.y + o.h } : { x0: o.x + 4, x1: o.x + o.w - 4, y0: o.y + 4, y1: o.y + o.h - 2 };
      if (box.x1 > ob.x0 && box.x0 < ob.x1 && box.y1 > ob.y0 && box.y0 < ob.y1) {
        if (p.dashT > 0 && o.k !== 'log') smash(G, api, o);
        else if (p.inv <= 0) { if (p.dashT > 0) p.inv = .3; else hurt(G, api, o); }
      }
      /* passou rente: pequeno bónus */
      if (!o.passed && o.x + o.w < p.x - 20) { o.passed = true; if (!o.hit && o.k !== 'log' && Math.abs(p.y - o.y) < 120) { G.score = (G.score || 0) + 10; } }
    });

    /* a onda: recupera devagar, mais depressa a arrancar */
    if (!G.dead) G.gap = Math.min(1, G.gap + c.rec * dt * (p.dashT > 0 ? 3 : 1));
    if (p.dashT > 0 && Math.random() < .7) api.spark({ x: sx(G, p.x - 16), y: sy(G, p.y - PH / 2 + U.rand(-14, 14)), vx: -300, vy: U.rand(-30, 30), life: .3, size: 3, color: '#fde047', gravity: 0 });

    /* gerar mais mundo / limpar o que ficou para trás */
    while (G.genX < G.camX + G.VW + 900) gen(G);
    const cut = G.camX - 600;
    if (G.ground.length > 2 && G.ground[0].x1 < cut) G.ground.shift();
    const keep = a => a.filter(o => (o.x + (o.w || 0) + 200) > cut);
    if ((G.cleanT = (G.cleanT || 0) + dt) > 1) { G.cleanT = 0; G.plats = keep(G.plats); G.vines = keep(G.vines); G.obs = keep(G.obs); G.items = G.items.filter(i => !(i.got && i.t > 1) && i.x > cut); G.decor = keep(G.decor); }

    /* ambiente pela distância */
    const bi = Math.floor(G.dist / BIOME_M) % BIOMES.length;
    if (bi !== G.biome) { G.biome = bi; G.biomeK = 0; api.banner(BIOMES[bi].name, Math.floor(G.dist) + ' m'); api.sfx.arp([523, 659, 784], .08, .2, 'triangle', .06); }
    G.biomeK = Math.min(1, G.biomeK + dt / 2.5);
  }

  function collect(G, api, it) {
    const p = G.p;
    it.got = true; it.t = 0;
    const X = sx(G, it.x), Y = sy(G, it.y);
    if (it.k === 'banana' || it.k === 'bunch') {
      const n = it.k === 'bunch' ? 10 : 1, mul = p.x2T > 0 ? 2 : 1;
      G.bananas += n * mul; G.combo++; G.comboT = .6;
      G.energy = Math.min(1, G.energy + (it.k === 'bunch' ? .3 : .018));
      const nt = 9 + Math.min(10, G.combo % 12);
      api.sfx.tone(MemoNote(nt), .07, 'triangle', .05);
      if (it.k === 'bunch') { api.float(X, Y - 10, '+' + 10 * mul + ' 🍌', '#fde047', 20); api.burst(X, Y, 14, { color: '#fde047', speed: 180, life: .6, gravity: 300 }); }
      else if (Math.random() < .4) api.spark({ x: X, y: Y, vx: U.rand(-60, 60), vy: U.rand(-120, -40), life: .4, size: 2.5, color: '#fff7b0', gravity: 300 });
      return;
    }
    api.sfx.arp([523, 784, 1047], .06, .16, 'triangle', .08); api.vibe(20);
    api.burst(X, Y, 18, { color: '#fff', speed: 200, life: .6, gravity: 0 });
    if (it.k === 'shield') { p.shield = true; api.float(X, Y - 14, 'Escudo', '#7dd3fc', 20); }
    if (it.k === 'magnet') { p.magT = 9; api.float(X, Y - 14, 'Íman', '#f472b6', 20); }
    if (it.k === 'glide') { p.glideT = 6; p.vy = Math.min(p.vy, -500); p.on = false; api.float(X, Y - 14, 'Planador', '#86efac', 20); spawnSkyTrail(G, p.x + 200); }
    if (it.k === 'x2') { p.x2T = 10; api.float(X, Y - 14, 'Bananas ×2', '#fde047', 20); }
  }
  /* nota musical para a fila de bananas (pentatónica) */
  function MemoNote(i) { const P = [261.63, 293.66, 329.63, 392, 440]; return P[i % 5] * Math.pow(2, Math.floor(i / 5)); }
  function spawnSkyTrail(G, x) { for (let i = 0; i < 26; i++) G.items.push({ x: x + i * 60, y: -300 - Math.sin(i * .5) * 60, k: 'banana' }); }

  function dust(G, x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ x: x + U.rand(-14, 14), y: y - 3, vx: U.rand(-140, 40), vy: U.rand(-90, -20), life: U.rand(.3, .55), r: U.rand(3, 7), k: 'dust' }); }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  const sx = (G, x) => (x - G.camX) * G.zoom;
  const sy = (G, y) => (y - G.camY) * G.zoom;

  function camera(G, api, dt, snap) {
    const W = api.W, H = api.H;
    G.zoom = Math.min(H / 560, W / 520);
    G.VW = W / G.zoom; G.VH = H / G.zoom;
    const p = G.p;
    const tx = p.x - G.VW * (G.VW < 640 ? .2 : .26);
    G.camX = snap ? tx : G.camX + (tx - G.camX) * Math.min(1, dt * 10);
    const base = -(G.VH - 120);
    const ty = Math.min(base, p.y - PH - G.VH * .32);
    G.camY = snap ? ty : G.camY + (ty - G.camY) * Math.min(1, dt * 4);
  }

  function update(G, dt, api) {
    G.t += dt;
    camera(G, api, dt);
    if (G.dead) {
      G.deathT += dt;
      const p = G.p;
      if (G.why === 'wave') { p.x += 40 * dt; }
      else { p.vy += GRAV * dt; p.y += p.vy * dt; }
      fxStep(G, dt);
      if (G.deathT > 1.2 && !G.overSent) { G.overSent = true; finish(G, api); }
      return;
    }
    /* sub-passos: a velocidade é alta */
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) { step(G, dt / n, api); if (G.dead) break; }
    fxStep(G, dt);
  }
  function fxStep(G, dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; if (f.life <= 0) G.fx.splice(i, 1); }
    /* folhas a cair à frente (primeiro plano) */
    if (Math.random() < dt * 1.4) G.leaves.push({ x: G.camX + G.VW * U.rand(.3, 1.2), y: G.camY - 30, vx: U.rand(-120, -40), vy: U.rand(40, 90), r: U.rand(0, 6), vr: U.rand(-3, 3), s: U.rand(.7, 1.4) });
    for (let i = G.leaves.length - 1; i >= 0; i--) { const l = G.leaves[i]; l.x += l.vx * dt; l.y += l.vy * dt; l.r += l.vr * dt; l.vx += Math.sin(G.t * 2 + i) * 20 * dt; if (l.y > G.camY + G.VH + 40) G.leaves.splice(i, 1); }
  }

  function finish(G, api) {
    const m = Math.floor(G.dist);
    try { const k = 'runner:bananas'; localStorage.setItem(k, String((+localStorage.getItem(k) || 0) + G.bananas)); } catch (e) {}
    api.over({
      score: m, won: false, icon: G.why === 'pit' ? '💦' : '🍌',
      title: G.why === 'pit' ? 'Splash! Caíste ao rio' : 'A onda de bananas apanhou-te!',
      stats: [['Distância', m + ' m'], ['Bananas', G.bananas], ['Pedras partidas', G.smashed], ['Lianas', G.swings]],
      meta: { bananas: G.bananas, swings: G.swings, smashed: G.smashed },
    });
  }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  function mixC(a, b, k) {
    const h = c => { c = c.replace('#', ''); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
  }
  /* cor do ambiente atual, a fundir com o anterior durante a transição */
  function bc(G, key) { const b = BIOMES[G.biome], a = BIOMES[(G.biome + BIOMES.length - 1) % BIOMES.length]; return G.biomeK >= 1 || G.dist < 50 ? b[key] : mixC(a[key], b[key], U.ease(G.biomeK)); }

  function draw(G, ctx, W, H, api) {
    if (!G.started) { camera(G, api, 0, true); G.started = true; }
    const z = G.zoom, B = BIOMES[G.biome];
    /* céu */
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, bc2(G, 0)); sky.addColorStop(1, bc2(G, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    /* sol / lua */
    const sunX = W * .74, sunY = H * .2 + (G.camY + 400) * z * .05;
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 180 * z);
    sg.addColorStop(0, B.moon ? 'rgba(232,240,255,.95)' : B.cave ? 'rgba(167,139,250,.35)' : 'rgba(255,250,220,1)');
    sg.addColorStop(.12, B.moon ? 'rgba(232,240,255,.5)' : B.cave ? 'rgba(167,139,250,.12)' : 'rgba(255,240,180,.6)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    if (B.moon) { ctx.fillStyle = '#eef4ff'; ctx.beginPath(); ctx.arc(sunX, sunY, 26 * z, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(11,22,54,.9)'; ctx.beginPath(); ctx.arc(sunX + 10 * z, sunY - 6 * z, 24 * z, 0, TAU); ctx.fill(); }
    if (B.moon || B.cave) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) { const x = (hash(i * 7) * W * 1.3 - G.camX * z * .02) % W, y = hash(i * 13) * H * .55; ctx.globalAlpha = .3 + .5 * Math.abs(Math.sin(G.t * 1.5 + i)); ctx.fillRect((x + W) % W, y, 1.6, 1.6); } ctx.globalAlpha = 1; }
    /* camadas de paralaxe */
    layer(G, ctx, W, H, .1, bc(G, 'far'), 'hills', 210);
    haze(G, ctx, W, H, .32);
    layer(G, ctx, W, H, .28, bc(G, 'mid'), B.ruins ? 'ruins' : B.cave ? 'stal' : 'trees', 170);
    haze(G, ctx, W, H, .2);
    layer(G, ctx, W, H, .6, bc(G, 'near'), B.cave ? 'crystal' : 'canopy', 120);
    /* raios de luz */
    if (B.rays) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const bx = ((i * 380 - G.camX * z * .2) % (W + 600) + W + 600) % (W + 600) - 300, a = B.rays * (.5 + .5 * Math.sin(G.t * .7 + i * 2));
        const g = ctx.createLinearGradient(bx, 0, bx + 220, H); g.addColorStop(0, `rgba(255,248,220,${a})`); g.addColorStop(1, 'rgba(255,248,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 90, 0); ctx.lineTo(bx + 330, H); ctx.lineTo(bx + 160, H); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    ctx.save(); ctx.scale(z, z); ctx.translate(-G.camX, -G.camY);
    const vx0 = G.camX - 60, vx1 = G.camX + G.VW + 60;
    drawWater(G, ctx, vx0, vx1);
    drawVines(G, ctx, vx0, vx1);
    drawGround(G, ctx, vx0, vx1);
    G.decor.forEach(d => { if (d.x > vx0 && d.x < vx1) drawDecor(G, ctx, d); });
    G.plats.forEach(pl => { if (pl.x + pl.w > vx0 && pl.x < vx1) drawPlat(G, ctx, pl); });
    G.obs.forEach(o => { if (!o.dead && o.x + o.w > vx0 && o.x < vx1) drawObs(G, ctx, o); });
    drawItems(G, ctx, vx0, vx1);
    G.fx.forEach(f => { ctx.globalAlpha = Math.max(0, f.life * 2); ctx.fillStyle = 'rgba(230,220,200,.8)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - f.life), 0, TAU); ctx.fill(); });
    ctx.globalAlpha = 1;
    drawMonkey(G, ctx);
    /* folhas em primeiro plano */
    G.leaves.forEach(l => { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r); ctx.scale(l.s, l.s); ctx.fillStyle = B.cave ? 'rgba(167,139,250,.55)' : B.moon ? 'rgba(60,110,80,.8)' : 'rgba(70,140,60,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke(); ctx.restore(); });
    if (B.flies) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const fx = G.camX + ((hash(i * 31) * 1600 - G.camX * .1) % 1600 + 1600) % 1600 * G.VW / 1600, fy = G.camY + G.VH * (.3 + hash(i * 17) * .6) + Math.sin(G.t * 1.3 + i) * 14; ctx.globalAlpha = .4 + .6 * Math.max(0, Math.sin(G.t * 3 + i * 1.7)); ctx.fillStyle = '#d9f99d'; ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, TAU); ctx.fill(); } ctx.restore(); ctx.globalAlpha = 1; }
    ctx.restore();

    drawWave(G, ctx, W, H);
    /* velocidade: linhas no arranque */
    if (G.p.dashT > 0) { ctx.save(); ctx.globalAlpha = .35 * (G.p.dashT / .55); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = hash(i + Math.floor(G.t * 20)) * H, x = hash(i * 3 + Math.floor(G.t * 20)) * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 120, y); ctx.stroke(); } ctx.restore(); }
    /* vinheta */
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.max(W, H) * .78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, B.cave || B.moon ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawUI(G, ctx, W, H, api);
  }
  function bc2(G, i) {
    const b = BIOMES[G.biome], a = BIOMES[(G.biome + BIOMES.length - 1) % BIOMES.length];
    return G.biomeK >= 1 || G.dist < 50 ? b.sky[i] : mixC(a.sky[i], b.sky[i], U.ease(G.biomeK));
  }
  function haze(G, ctx, W, H, a) {
    const g = ctx.createLinearGradient(0, H * .3, 0, H); g.addColorStop(0, BIOMES[G.biome].haze + '0)'); g.addColorStop(1, BIOMES[G.biome].haze + a + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* silhuetas de paralaxe, geradas por ruído (em coordenadas de ecrã).
     Cada camada tem a sua "linha de chão": as mais distantes ficam mais
     perto do horizonte e mexem-se menos (na horizontal e na vertical). */
  function layer(G, ctx, W, H, par, col, kind, amp) {
    const z = G.zoom, off = G.camX * par;
    const gL = sy(G, 0) * par + H * .84 * (1 - par) - (1 - par) * 70 * z;
    ctx.fillStyle = col;
    if (kind === 'hills') {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) { const wx = (x / z + off) / 300; ctx.lineTo(x, gL - (vnoise(wx) * .7 + vnoise(wx * 2.3) * .3) * amp * z); }
      ctx.lineTo(W, H); ctx.fill();
      return;
    }
    /* faixa de base (arbustos) */
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) { const wx = (x / z + off) / 70; ctx.lineTo(x, gL - (10 + vnoise(wx) * 22) * z); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    const cell = kind === 'canopy' ? 230 : kind === 'trees' ? 120 : 140;
    const i0 = Math.floor(off / cell) - 1, i1 = Math.ceil((off + W / z) / cell) + 1;
    for (let i = i0; i <= i1; i++) {
      const hs = hash(i * 977 + kind.length * 131), hs2 = hash(i * 331 + 7);
      const x = (i * cell - off + hs * cell * .5) * z, h = (.55 + hs * .7) * amp * z;
      if (kind === 'trees') {
        ctx.fillRect(x - 4 * z, gL - h, 8 * z, h);
        const r = (30 + hs2 * 22) * z, ty = gL - h;
        ctx.beginPath(); ctx.arc(x, ty, r, 0, TAU); ctx.arc(x - r * .75, ty + r * .45, r * .7, 0, TAU); ctx.arc(x + r * .8, ty + r * .4, r * .68, 0, TAU); ctx.arc(x + r * .1, ty - r * .55, r * .6, 0, TAU); ctx.fill();
      } else if (kind === 'canopy') {
        /* primeiro plano: arbustos grandes e, de vez em quando, um tronco alto com liana */
        for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 40 * z, br = (26 + hash(i * 17 + k) * 26) * z; ctx.beginPath(); ctx.arc(bx, gL - br * .35, br, Math.PI, 0); ctx.fill(); }
        if (hs > .55) {
          ctx.fillRect(x + 50 * z, 0, 26 * z, gL);
          ctx.strokeStyle = col; ctx.lineWidth = 4 * z;
          ctx.beginPath(); ctx.moveTo(x + 76 * z, gL * .18); ctx.quadraticCurveTo(x + 120 * z, gL * .45, x + 96 * z, gL * .62); ctx.stroke();
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + 63 * z + (k % 2 ? 18 : -18) * z, gL * (.12 + k * .1), 22 * z, 9 * z, k % 2 ? .5 : -.5, 0, TAU); ctx.fill(); }
        }
      } else if (kind === 'ruins') {
        if (hs2 < .22) continue;
        const w = (22 + hs2 * 46) * z, ch = h * (.55 + hash(i * 53) * .7);
        ctx.fillRect(x - w / 2, gL - ch, w, ch);
        ctx.fillRect(x - w / 2 - 6 * z, gL - ch - 8 * z, w + 12 * z, 10 * z);
        if (hs2 > .55) { ctx.beginPath(); ctx.moveTo(x - w / 2 - 8 * z, gL - ch - 8 * z); ctx.lineTo(x, gL - ch - 34 * z); ctx.lineTo(x + w / 2 + 8 * z, gL - ch - 8 * z); ctx.fill(); }
        else if (hs2 < .25) { ctx.fillRect(x + w / 2 + 14 * z, gL - ch * .6, w * .6, ch * .6); }
      } else if (kind === 'stal') {
        ctx.beginPath(); ctx.moveTo(x - 16 * z, 0); ctx.lineTo(x, h * .7); ctx.lineTo(x + 16 * z, 0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 20 * z, gL); ctx.lineTo(x + 4 * z, gL - h * .55); ctx.lineTo(x + 22 * z, gL); ctx.fill();
      } else if (kind === 'crystal') {
        for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 40 * z, br = (24 + hash(i * 17 + k) * 22) * z; ctx.beginPath(); ctx.arc(bx, gL - br * .3, br, Math.PI, 0); ctx.fill(); }
        if (hs > .4) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const ch = (60 + hs2 * 70) * z, cg = ctx.createLinearGradient(0, gL - ch, 0, gL);
          cg.addColorStop(0, 'rgba(94,234,212,.6)'); cg.addColorStop(1, 'rgba(167,139,250,.08)');
          ctx.fillStyle = cg;
          [[-14, 1], [6, .7], [22, .5]].forEach(([dx, k]) => { ctx.beginPath(); ctx.moveTo(x + (dx - 9) * z, gL); ctx.lineTo(x + dx * z, gL - ch * k); ctx.lineTo(x + (dx + 9) * z, gL); ctx.fill(); });
          ctx.restore(); ctx.fillStyle = col;
        }
      }
    }
  }

  function drawWater(G, ctx, x0, x1) {
    const B = BIOMES[G.biome];
    const g = ctx.createLinearGradient(0, 20, 0, 200); g.addColorStop(0, B.water); g.addColorStop(1, '#0b1f33');
    ctx.fillStyle = g; ctx.fillRect(x0, 34, x1 - x0, 400);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(x0 / 20) * 20; x < x1; x += 20) { const y = 36 + Math.sin(x * .05 + G.t * 3) * 3; if (x === Math.floor(x0 / 20) * 20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }

  function drawGround(G, ctx, x0, x1) {
    const B = BIOMES[G.biome];
    G.ground.forEach(s => {
      if (s.x1 < x0 || s.x0 > x1) return;
      const a = Math.max(s.x0, x0 - 20), b = Math.min(s.x1, x1 + 20);
      const dg = ctx.createLinearGradient(0, 0, 0, 260); dg.addColorStop(0, bc(G, 'dirt')); dg.addColorStop(1, bc(G, 'dirt2'));
      ctx.fillStyle = dg;
      U.rr(ctx, a, 0, b - a, 420, 10); ctx.fill();
      /* pedrinhas na terra */
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      for (let x = Math.ceil(a / 46) * 46; x < b - 10; x += 46) { const h1 = hash(Math.floor(x)); ctx.beginPath(); ctx.ellipse(x + h1 * 20, 40 + h1 * 90, 7 + h1 * 6, 4 + h1 * 3, 0, 0, TAU); ctx.fill(); }
      /* relva com bordo ondulado */
      ctx.fillStyle = bc(G, 'grass2'); U.rr(ctx, a - 2, -4, b - a + 4, 22, 8); ctx.fill();
      ctx.fillStyle = bc(G, 'grass');
      ctx.beginPath(); ctx.moveTo(a - 2, 12);
      for (let x = a; x <= b; x += 12) ctx.lineTo(x, 10 + Math.sin(x * .3) * 3);
      ctx.lineTo(b + 2, 12); ctx.lineTo(b + 2, -4); ctx.lineTo(a - 2, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(a, -4, b - a, 3);
      /* tufos na beira */
      if (s.x0 > x0 - 20) { ctx.fillStyle = bc(G, 'grass'); ctx.beginPath(); ctx.ellipse(s.x0 + 4, 4, 12, 10, 0, 0, TAU); ctx.fill(); }
      if (s.x1 < x1 + 20) { ctx.fillStyle = bc(G, 'grass'); ctx.beginPath(); ctx.ellipse(s.x1 - 4, 4, 12, 10, 0, 0, TAU); ctx.fill(); }
      if (B.cave) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(45,212,191,.12)'; ctx.fillRect(a, -4, b - a, 4); ctx.restore(); }
    });
  }

  function drawDecor(G, ctx, d) {
    const B = BIOMES[G.biome];
    ctx.save(); ctx.translate(d.x, 0); ctx.scale(d.s, d.s);
    if (d.k === 'fern') { ctx.strokeStyle = B.cave ? '#7c6aa8' : B.moon ? '#2f7a4a' : '#3f9a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(i * 10, -26, i * 18, -30 + Math.abs(i) * 6 + Math.sin(G.t * 2 + d.x) * 2); ctx.stroke(); } }
    else if (d.k === 'flower') { ctx.strokeStyle = '#3f9a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke(); const fc = ['#f472b6', '#fde047', '#f87171', '#c084fc'][Math.floor(d.h * 4)]; ctx.fillStyle = fc; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.26) * 5, -24 + Math.sin(i * 1.26) * 5, 4, 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff7ad'; ctx.beginPath(); ctx.arc(0, -24, 3, 0, TAU); ctx.fill(); }
    else if (d.k === 'mush') { ctx.fillStyle = '#f5ecd7'; ctx.fillRect(-3, -12, 6, 12); ctx.fillStyle = B.cave ? '#2dd4bf' : '#ef4444'; ctx.beginPath(); ctx.ellipse(0, -12, 11, 7, 0, Math.PI, 0); ctx.fill(); if (B.cave || B.moon) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(45,212,191,.25)'; ctx.beginPath(); ctx.arc(0, -12, 20, 0, TAU); ctx.fill(); ctx.restore(); } }
    else if (d.k === 'stone') { ctx.fillStyle = '#7b7f8a'; ctx.beginPath(); ctx.ellipse(0, -5, 14, 9, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(-4, -9, 5, 2, -.3, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = bc(G, 'grass'); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 4 - 2, 0); ctx.lineTo(i * 5, -12 - Math.abs(2 - Math.abs(i)) * 4); ctx.lineTo(i * 4 + 2, 0); ctx.fill(); } }
    ctx.restore();
  }

  function drawPlat(G, ctx, pl) {
    if (pl.k === 'stone') {
      const g = ctx.createLinearGradient(0, pl.y, 0, pl.y + 26); g.addColorStop(0, '#b9ad9c'); g.addColorStop(1, '#6e6355');
      ctx.fillStyle = g; U.rr(ctx, pl.x, pl.y, pl.w, 26, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; for (let x = pl.x + 40; x < pl.x + pl.w - 10; x += 40) { ctx.beginPath(); ctx.moveTo(x, pl.y + 2); ctx.lineTo(x, pl.y + 24); ctx.stroke(); }
      ctx.fillStyle = 'rgba(120,180,80,.8)'; ctx.fillRect(pl.x + 4, pl.y - 2, pl.w - 8, 5);
    } else {
      const g = ctx.createLinearGradient(0, pl.y, 0, pl.y + 20); g.addColorStop(0, '#9a6a3c'); g.addColorStop(1, '#5c3a1e');
      ctx.fillStyle = g; U.rr(ctx, pl.x, pl.y, pl.w, 20, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x + 12, pl.y + 8); ctx.lineTo(pl.x + pl.w - 12, pl.y + 9); ctx.stroke();
      ctx.fillStyle = '#4caf50'; for (let x = pl.x + 10; x < pl.x + pl.w; x += 36) { ctx.beginPath(); ctx.ellipse(x, pl.y - 2, 10, 5, -.3, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(pl.x + pl.w / 2, 2, pl.w * .45, 6, 0, 0, TAU); ctx.fill();
  }

  function drawVines(G, ctx, x0, x1) {
    G.vines.forEach(vn => {
      if (vn.x < x0 - 300 || vn.x > x1 + 300) return;
      const held = G.p.swing && G.p.swing.vine === vn;
      const th = vn.th || 0, L = held ? G.p.swing.L : vn.len;
      const bx = vn.x + Math.sin(th) * L, by = vn.y + Math.cos(th) * L;
      /* ramo onde a liana está presa */
      ctx.fillStyle = '#5c3a1e'; U.rr(ctx, vn.x - 70, vn.y - 14, 140, 18, 9); ctx.fill();
      ctx.fillStyle = '#2f7a3a'; [-50, -10, 30, 60].forEach((dx, i) => { ctx.beginPath(); ctx.ellipse(vn.x + dx, vn.y - 18, 30, 16, 0, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const mx = (vn.x + bx) / 2 + Math.cos(th) * 10, my = (vn.y + by) / 2;
      ctx.beginPath(); ctx.moveTo(vn.x, vn.y); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
      ctx.strokeStyle = '#6cc04a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vn.x - 1, vn.y); ctx.quadraticCurveTo(mx - 1, my, bx - 1, by); ctx.stroke();
      ctx.fillStyle = '#4caf50'; for (let k = .2; k < 1; k += .2) { const lx = U.lerp(vn.x, bx, k), ly = U.lerp(vn.y, by, k); ctx.beginPath(); ctx.ellipse(lx + 6, ly, 7, 3.5, .6, 0, TAU); ctx.fill(); }
      /* indicação suave de "agarra aqui" */
      if (!G.p.swing && bx > G.p.x) { ctx.globalAlpha = .35 + .25 * Math.sin(G.t * 6); ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 12, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    });
  }

  function drawObs(G, ctx, o) {
    ctx.save();
    if (o.hit) { ctx.translate(Math.sin(G.t * 60) * 3 * o.hit, 0); }
    if (o.k === 'rock') {
      const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h); g.addColorStop(0, '#a3a3ad'); g.addColorStop(1, '#4b4b57');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(o.x + o.w * .08, o.y + o.h * .35); ctx.lineTo(o.x + o.w * .4, o.y); ctx.lineTo(o.x + o.w * .78, o.y + o.h * .12); ctx.lineTo(o.x + o.w, o.y + o.h * .6); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(o.x + o.w * .4, o.y + 2); ctx.lineTo(o.x + o.w * .7, o.y + o.h * .15); ctx.lineTo(o.x + o.w * .45, o.y + o.h * .4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(76,175,80,.85)'; ctx.beginPath(); ctx.ellipse(o.x + o.w * .3, o.y + o.h * .2, 10, 5, -.4, 0, TAU); ctx.fill();
    } else if (o.k === 'log') {
      /* tronco atravessado entre duas árvores — só passa a deslizar */
      /* dois troncos de árvore que sobem até fora do ecrã */
      [o.x - 22, o.x + o.w + 2].forEach((tx, i) => {
        const tg = ctx.createLinearGradient(tx, 0, tx + 20, 0); tg.addColorStop(0, '#6b4424'); tg.addColorStop(1, '#3d2614');
        ctx.fillStyle = tg; ctx.fillRect(tx, -1200, 20, 1200);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; for (let y = -40; y > -900; y -= 70) { ctx.beginPath(); ctx.moveTo(tx + 4, y); ctx.lineTo(tx + 14, y - 22); ctx.stroke(); }
        ctx.fillStyle = '#2f7a3a'; ctx.beginPath(); ctx.ellipse(tx + 10 + (i ? 14 : -14), o.y - 30 - i * 40, 20, 8, i ? .5 : -.5, 0, TAU); ctx.fill();
      });
      const ly = o.y + o.h - 46;
      const g = ctx.createLinearGradient(0, ly, 0, ly + 46); g.addColorStop(0, '#a8743f'); g.addColorStop(1, '#5c3a1e');
      ctx.fillStyle = g; U.rr(ctx, o.x - 26, ly, o.w + 52, 46, 22); ctx.fill();
      ctx.fillStyle = '#d8b07a'; ctx.beginPath(); ctx.ellipse(o.x + o.w + 26, ly + 23, 10, 22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(o.x + o.w + 26, ly + 23, 5, 12, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(o.x - 10, ly + 15); ctx.lineTo(o.x + o.w + 10, ly + 18); ctx.moveTo(o.x, ly + 31); ctx.lineTo(o.x + o.w, ly + 29); ctx.stroke();
      ctx.fillStyle = '#3f8a2a'; ctx.beginPath(); ctx.ellipse(o.x + 20, ly - 2, 18, 7, -.2, 0, TAU); ctx.fill();
      /* sinal "desliza" (setas) */
      ctx.globalAlpha = .5 + .3 * Math.sin(G.t * 6); ctx.fillStyle = '#fde68a'; ctx.font = '700 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⇩', o.x + o.w / 2, ly + 66); ctx.globalAlpha = 1;
    } else if (o.k === 'thorn') {
      ctx.fillStyle = '#2f5e2a';
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h, o.w / 2, o.h, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e5e7eb';
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i + .5) / 9 * Math.PI, rx = o.x + o.w / 2 + Math.cos(a) * o.w / 2, ry = o.y + o.h + Math.sin(a) * o.h; ctx.beginPath(); ctx.moveTo(rx - 4, ry + 3); ctx.lineTo(rx + Math.cos(a) * 12, ry + Math.sin(a) * 12); ctx.lineTo(rx + 4, ry + 3); ctx.fill(); }
      ctx.fillStyle = '#ef4444'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(o.x + o.w * (.2 + i * .2), o.y + o.h * .55 + (i % 2) * 6, 3.5, 0, TAU); ctx.fill(); }
    } else if (o.k === 'boulder') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, r = o.w / 2;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, 2, r, 7, 0, 0, TAU); ctx.fill();
      ctx.translate(cx, cy); ctx.rotate(o.rot);
      const g = ctx.createRadialGradient(-r * .3, -r * .4, 4, 0, 0, r); g.addColorStop(0, '#b8a68f'); g.addColorStop(1, '#5d4e3d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-r * .2, -r * .1, r * .45, .3, 2.2); ctx.moveTo(r * .3, r * .3); ctx.lineTo(r * .7, r * .1); ctx.stroke();
      if (o.x - G.p.x < 500 && o.x > G.p.x) { ctx.rotate(-o.rot); ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 3; i++) ctx.fillRect(r + 6 + i * 10, -r * .5 + i * 12, 14, 3); }
    } else if (o.k === 'bird') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, f = Math.sin(o.fl || 0);
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(6, -2 - f * 22); ctx.lineTo(14, -4); ctx.fill();
      ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(30, 4); ctx.lineTo(16, 6); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(-19, -3); ctx.lineTo(-28, 0); ctx.lineTo(-19, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-11, -4, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-12, -4, 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawItems(G, ctx, x0, x1) {
    const spr = bananaSprite();
    G.items.forEach(it => {
      if (it.x < x0 || it.x > x1) return;
      if (it.got) {
        if (it.t > .3) return;
        ctx.globalAlpha = 1 - it.t / .3; const s = 1 + it.t * 3;
        ctx.drawImage(spr, it.x - 16 * s, it.y - 16 * s - it.t * 60, 32 * s, 32 * s); ctx.globalAlpha = 1; return;
      }
      const bob = Math.sin(G.t * 4 + it.x * .02) * 3;
      if (it.k === 'banana') { ctx.drawImage(spr, it.x - 16, it.y - 16 + bob, 32, 32); return; }
      /* power-ups: bolha brilhante com ícone */
      const r = 22, y = it.y + bob;
      ctx.save();
      const halo = ctx.createRadialGradient(it.x, y, 4, it.x, y, r * 2);
      const col = { shield: '125,211,252', magnet: '244,114,182', glide: '134,239,172', x2: '253,224,71', bunch: '253,224,71' }[it.k];
      halo.addColorStop(0, `rgba(${col},.55)`); halo.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(it.x, y, r * 2, 0, TAU); ctx.fill();
      if (it.k === 'bunch') { for (let i = 0; i < 4; i++) ctx.drawImage(spr, it.x - 18 + i * 6 - 6, y - 18 + Math.abs(i - 1.5) * 3, 34, 34); ctx.restore(); return; }
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(it.x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.font = '22px system-ui, "Segoe UI Emoji", "Apple Color Emoji"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText({ shield: '🛡️', magnet: '🧲', glide: '🍃', x2: '✖️' }[it.k], it.x, y + 1);
      if (it.k === 'x2') { ctx.fillStyle = '#422006'; ctx.font = '800 13px system-ui'; ctx.fillText('2', it.x + 9, y + 10); }
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(it.x - 8, y - 10, 6, 3, -.5, 0, TAU); ctx.fill();
      ctx.restore();
    });
  }

  /* ── o Kiko (macaco) ── */
  function drawMonkey(G, ctx) {
    const p = G.p, slide = p.slideT > 0 && p.on, air = !p.on && !p.swing;
    const body = '#8b5a2b', bodyD = '#6b4220', face = '#f2c48d', run = p.run;
    ctx.save();
    if (p.inv > 0 && !p.shield && Math.floor(G.t * 18) % 2 && !G.dead) ctx.globalAlpha = .45;
    /* sombra no chão */
    const sup = supportAt(G, p);
    if (sup !== null && !G.dead) { const h = Math.max(0, sup - p.y); ctx.fillStyle = `rgba(0,0,0,${.22 * Math.max(.2, 1 - h / 300)})`; ctx.beginPath(); ctx.ellipse(p.x, sup + 1, 22 * Math.max(.4, 1 - h / 400), 5, 0, 0, TAU); ctx.fill(); }
    ctx.translate(p.x, p.y);
    if (p.swing) { ctx.translate(0, -PH + 8); ctx.rotate(-p.swing.th); ctx.translate(0, PH - 8); }
    if (p.tumble > 0) { ctx.translate(0, -PH / 2); ctx.rotate((1 - p.tumble / .55) * TAU * -.6); ctx.translate(0, PH / 2); }
    if (p.flip > 0) { ctx.translate(0, -PH / 2); ctx.rotate((1 - p.flip) * TAU); ctx.translate(0, PH / 2); }
    if (G.dead && G.why === 'wave') { ctx.rotate(Math.min(1.2, G.deathT * 3)); }
    const sq = p.sq; ctx.scale(1 - sq * .5, 1 + sq);
    if (slide) {
      /* deitado a deslizar */
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-4, -16, 30, 14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(-2, -12, 18, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(22, -22, 15, 0, TAU); ctx.fill();
      drawFace(ctx, 24, -22, 1);
      ctx.strokeStyle = body; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-28, -14); ctx.quadraticCurveTo(-46, -30, -38, -40); ctx.stroke();
      if (Math.random() < .5) G.fx.push({ x: p.x - 30, y: p.y - 4, vx: -80, vy: -40, life: .3, r: 4, k: 'dust' });
      ctx.restore(); return;
    }
    const sw = Math.sin(run * 2.1), sw2 = Math.cos(run * 2.1);
    /* cauda */
    ctx.strokeStyle = body; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -26); ctx.bezierCurveTo(-34, -24 + sw * 4, -38, -50, -26 + sw2 * 3, -56); ctx.stroke();
    /* pernas */
    const legA = air ? (p.vy < 0 ? -.8 : .4) : sw * .9, legB = air ? (p.vy < 0 ? .5 : -.3) : -sw * .9;
    limb(ctx, -6, -22, legB, 20, bodyD, 8); limb(ctx, 6, -22, legA, 20, body, 8);
    /* corpo */
    const bob = p.on ? Math.abs(sw) * 2.5 : 0;
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -36 - bob, 17, 21, .08, 0, TAU); ctx.fill();
    ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(4, -32 - bob, 9, 13, .1, 0, TAU); ctx.fill();
    /* braços */
    const armA = p.swing ? -2.9 : air ? -2.3 + Math.sin(G.t * 20) * .1 : -sw * 1.1, armB = p.swing ? -2.6 : air ? -2.0 : sw * 1.1;
    limb(ctx, -8, -46 - bob, armB, 22, bodyD, 7);
    /* cabeça */
    const hy = -64 - bob;
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(2, hy, 17, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-14, hy - 2, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(-14, hy - 2, 3.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, hy + 3, 11, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, hy - 5, 9, 6, 0, 0, TAU); ctx.fill();
    drawFace(ctx, 8, hy, 0, G.p.tumble > 0 || G.dead);
    limb(ctx, 8, -46 - bob, armA, 22, body, 7);
    if (p.glideT > 0) { /* folha-planador por cima */ ctx.save(); ctx.translate(4, -110 - bob); ctx.rotate(Math.sin(G.t * 3) * .08); ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(0, 0, 46, 14, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(44, 0); for (let i = -3; i <= 3; i++) { ctx.moveTo(i * 12, 0); ctx.lineTo(i * 12 + 6, -10); } ctx.stroke(); ctx.restore(); }
    ctx.restore();
    /* escudo */
    if (p.shield) { ctx.save(); ctx.globalAlpha = .35 + .15 * Math.sin(G.t * 6); ctx.strokeStyle = '#7dd3fc'; ctx.fillStyle = 'rgba(125,211,252,.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - PH / 2, 50, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (p.magT > 0) { ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -G.t * 40; ctx.beginPath(); ctx.arc(p.x, p.y - PH / 2, 90 + Math.sin(G.t * 4) * 6, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  function limb(ctx, x, y, a, len, col, w) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    const mx = x + Math.sin(a) * len * .55, my = y + Math.cos(a) * len * .55, ex = mx + Math.sin(a * .6) * len * .5, ey = my + Math.cos(a * .6) * len * .5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#f2c48d'; ctx.beginPath(); ctx.arc(ex, ey, w * .55, 0, TAU); ctx.fill();
  }
  function drawFace(ctx, x, y, side, hurtF) {
    ctx.fillStyle = '#1f130a';
    if (hurtF) { ctx.lineWidth = 2; ctx.strokeStyle = '#1f130a'; [[-4, -6], [5, -6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(x + dx - 2, y + dy - 2); ctx.lineTo(x + dx + 2, y + dy + 2); ctx.moveTo(x + dx + 2, y + dy - 2); ctx.lineTo(x + dx - 2, y + dy + 2); ctx.stroke(); }); }
    else { ctx.beginPath(); ctx.ellipse(x - 3, y - 6, 2.4, 3.2, 0, 0, TAU); ctx.ellipse(x + 6, y - 6, 2.4, 3.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 8, 1.2, 1.2); ctx.fillRect(x + 6, y - 8, 1.2, 1.2); }
    ctx.fillStyle = '#1f130a'; ctx.beginPath(); ctx.arc(x + 5, y + 1, 1.2, 0, TAU); ctx.arc(x + 9, y + 1, 1.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1f130a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x + 6, y + 4, 4, .2, Math.PI - .4); ctx.stroke();
  }

  /* ── a onda de bananas (coordenadas de ecrã) ── */
  function drawWave(G, ctx, W, H) {
    const z = G.zoom, px = sx(G, G.p.x), gy = sy(G, 0);
    const front = U.lerp(px - 40 * z, -60 * z, U.clamp(G.gap, 0, 1)) + (G.dead && G.why === 'wave' ? G.deathT * 120 : 0);
    if (front < -50 * z) return;
    const spr = bananaSprite(), hgt = (230 + Math.sin(G.t * 2) * 12) * z;
    ctx.save();
    const glow = ctx.createLinearGradient(front - 200 * z, 0, front + 60 * z, 0);
    glow.addColorStop(0, 'rgba(255,214,59,.0)'); glow.addColorStop(.7, 'rgba(255,214,59,.18)'); glow.addColorStop(1, 'rgba(255,214,59,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, front + 60 * z, H);
    for (let i = 0; i < 70; i++) {
      const hx = hash(i * 13), hy = hash(i * 29);
      const k = Math.pow(hy, .8);
      const edge = front - (1 - Math.cos(k * Math.PI / 2)) * 140 * z;
      const x = edge - hx * 260 * z + Math.sin(G.t * 6 + i) * 6 * z, y = gy - k * hgt + Math.cos(G.t * 5 + i * 2) * 5 * z;
      if (x < -40) continue;
      const s = (34 + hx * 18) * z;
      ctx.save(); ctx.translate(x, y); ctx.rotate(G.t * (2 + hx * 3) * (i % 2 ? 1 : -1) + i);
      ctx.drawImage(spr, -s / 2, -s / 2, s, s); ctx.restore();
    }
    ctx.restore();
    /* aviso quando está perto */
    if (G.gap < .45 && !G.dead) { ctx.fillStyle = `rgba(239,68,68,${.18 + .12 * Math.sin(G.t * 10)})`; ctx.fillRect(0, 0, 14, H); }
  }

  function drawUI(G, ctx, W, H, api) {
    /* barra de arranque */
    const x = 16, y = H - 34, w = Math.min(170, W * .32);
    ctx.save();
    U.rr(ctx, x, y, w, 16, 8); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    const full = G.energy >= .34;
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#facc15'); g.addColorStop(1, '#fb923c');
    U.rr(ctx, x + 2, y + 2, Math.max(0, (w - 4) * G.energy), 12, 6); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; [1 / 3, 2 / 3].forEach(k => { ctx.beginPath(); ctx.moveTo(x + w * k, y + 3); ctx.lineTo(x + w * k, y + 13); ctx.stroke(); });
    ctx.fillStyle = '#fff'; ctx.font = "800 11px 'Space Grotesk', system-ui"; ctx.textBaseline = 'bottom';
    ctx.fillText(full ? 'ARRANQUE PRONTO ➜' : 'ARRANQUE', x + 2, y - 3);
    /* power-ups ativos */
    let ix = W - 16;
    [['🛡️', G.p.shield ? 1 : 0, '#7dd3fc'], ['🧲', G.p.magT / 9, '#f472b6'], ['🍃', G.p.glideT / 6, '#86efac'], ['✖️2', G.p.x2T / 10, '#fde047']].forEach(([ic, k, col]) => {
      if (k <= 0) return;
      ix -= 40;
      ctx.beginPath(); ctx.arc(ix + 18, y + 4, 17, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ix + 18, y + 4, 17, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, k)); ctx.stroke();
      ctx.font = '15px system-ui, "Segoe UI Emoji"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(ic, ix + 18, y + 5);
    });
    /* combo */
    if (G.combo >= 8) { ctx.textAlign = 'center'; ctx.font = "800 16px 'Space Grotesk', system-ui"; ctx.fillStyle = '#fde047'; ctx.textBaseline = 'alphabetic'; ctx.fillText('🍌 ×' + G.combo, W / 2, H - 22); }
    ctx.restore();
    /* dica inicial */
    if (G.dist < 14 && !G.dead) {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = "700 14px 'Space Grotesk', system-ui"; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
      const touch = G.touch;
      ctx.fillText(touch ? 'Toca: saltar (2× = duplo) · Desliza ↓: deslizar · Desliza →: arranque' : 'Espaço/↑: saltar (2× duplo) · ↓: deslizar · →/Shift: arranque', W / 2, 96);
      ctx.restore();
    }
  }

  /* ════════════════════════════════════════════════════════════════
     controlos: toque (gestos) e teclado
  ════════════════════════════════════════════════════════════════ */
  function down(G, x, y, api, e) {
    G.touch = e && e.pointerType !== 'mouse';
    G.ges = { x, y, t: G.t, done: false };
    G.holdJ = true;
    if (!G.touch) jump(G, api);   /* rato: clique = salto imediato */
  }
  function move(G, x, y, api, e, isDown) {
    const g = G.ges; if (!g || g.done || !isDown) return;
    const dx = x - g.x, dy = y - g.y;
    if (Math.hypot(dx, dy) > 26) {
      g.done = true;
      if (Math.abs(dy) > Math.abs(dx)) { if (dy > 0) slide(G, api); else if (G.touch) jump(G, api, true); }
      else if (dx > 0) dash(G, api);
    }
  }
  function up(G, x, y, api) {
    const g = G.ges; G.holdJ = false; G.ges = null;
    if (g && !g.done && G.touch) jump(G, api, true);
  }
  function key(G, e, api) {
    const k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) jump(G, api); G.holdJ = true; return true; }
    if (k === 'ArrowDown' || k === 's' || k === 'S') { slide(G, api); return true; }
    if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'Shift') { dash(G, api); return true; }
  }
  function keyup(G, e) { const k = e.key; if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') G.holdJ = false; }

  function sfxJump(api, n) { api.sfx.tone(n ? 520 : 380, .12, 'triangle', .06, 0, n ? 880 : 640); }

  return ArcadeKit.create({
    id: 'runner', title: 'Fuga na Selva', icon: '🐒', accent: '#84cc16', accent2: '#facc15', bg: '#0b1f12', aspect: 'wide',
    tagline: 'Corre, salta, desliza e balança nas lianas — a avalanche de bananas vem aí!',
    view: { w: 1000 }, bestLabel: 'Recorde', scoreFmt: v => v + ' m',
    modes: [
      { id: 'run', icon: '🐒', name: 'Corrida', desc: 'Sem fim: até onde chegas antes de a onda te apanhar?' },
      { id: 'daily', icon: '📅', name: 'Percurso do Dia', desc: 'O mesmo percurso para toda a gente, hoje.' },
    ],
    how: [
      '<b>Toca</b> (ou Espaço) para saltar — no ar, outra vez para o <b>duplo salto</b>. Mantém premido para saltar mais alto.',
      '<b>Desliza para baixo</b> (↓) para passar por baixo dos troncos — no ar, cai a pique. <b>Desliza para a direita</b> (→ ou Shift) para o <b>arranque</b>: parte pedras e afasta a onda (gasta bananas).',
      'Salta para as <b>lianas</b> para atravessar os rios — o Kiko agarra-se sozinho; toca para te largares mais cedo. Cada tropeção deixa a onda aproximar-se!',
    ],
    controls: ['👆 Tocar · deslizar ↓ →', '⌨️ Espaço ↓ →', '🖱️ Clique = saltar'],
    ready: { title: 'Toca para começar a correr', hint: 'Apanha bananas para encher a barra de arranque.' },
    setup, update, draw, down, move, up, key, keyup,
    idle: (G, dt, api) => { G.t += dt; camera(G, api, dt, true); G.p.run += dt * 2; },
    after: (G, dt, api) => { G.t += dt; fxStep(G, dt); },
    begin: (G, api) => { if (api.H > api.W * 1.15) api.banner('Dica: roda o telemóvel', 'Vês mais caminho à frente'); },
    hud: (G, api) => [['Distância', Math.floor(G.dist) + ' m'], ['Bananas', G.bananas], ['Recorde', api.best != null ? api.best + ' m' : '—']],
    achievements: [
      { id: 'run.500', name: 'Pernas de Macaco', icon: '🐒', desc: 'Corre 500 m na Fuga na Selva.', test: c => (c.result.score || 0) >= 500 },
      { id: 'run.2000', name: 'Rei da Selva', icon: '👑', desc: 'Corre 2000 m na Fuga na Selva.', test: c => (c.result.score || 0) >= 2000 },
      { id: 'run.ban', name: 'Bananeiro', icon: '🍌', desc: 'Apanha 300 bananas numa só corrida.', test: c => ((c.result.meta || {}).bananas || 0) >= 300 },
      { id: 'run.tarzan', name: 'Tarzan', icon: '🌿', desc: 'Balança em 15 lianas numa corrida.', test: c => ((c.result.meta || {}).swings || 0) >= 15 },
    ],
  });
})();
