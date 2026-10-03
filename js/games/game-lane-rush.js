/* ══════════════════════════════════════════════════════════════════
   Faixa Rápida (Lane Rush) — estrada de 3, 4 ou 5 faixas; troca de faixa
   para fugir às obras e ao trânsito enquanto a velocidade não pára de
   subir. A viagem atravessa o país: começa no campo (aldeia, quintas,
   fardos de palha, tratores), passa por uma vila (casas com telhado de
   barro, calçada, cafés), entra na cidade ao pôr do sol (prédios,
   autocarros, táxis) e acaba na metrópole de noite.

   Trânsito com cabeça: os carros travam atrás de obras e de carros mais
   lentos (e ligam os quatro piscas se pararem), mudam de faixa com pisca
   — que se desliga quando acabam a manobra — e nunca entram na única
   faixa livre de uma fila de obstáculos (há sempre caminho).
   Power-ups: escudo (aguenta uma batida), invencível (passa por tudo)
   e íman (puxa as moedas das faixas ao lado).

   Lógica em "z" (distância à frente do carro, 0 = jogador); em 3D cada z
   vale ZS unidades e a estrada corre para −z. Sem WebGL há um desenho
   2D simples.
══════════════════════════════════════════════════════════════════ */
const LaneRushGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const ZMAX = 80, LW = 3.3, ZS = 1.6, PL = 3.9 / ZS;
  /* v em unidades/s (km/h = v·6) */
  const DIFF = {
    easy:   { v0: 12, vMax: 30, acc: .14, tMin: 1.0, block: .45 },
    medium: { v0: 14, vMax: 36, acc: .19, tMin: .82, block: .65 },
    hard:   { v0: 17, vMax: 44, acc: .26, tMin: .66, block: .85 },
  };
  /* a viagem: distâncias (m) e luz/cor de cada etapa */
  const BIOMES = [
    { id: 'campo', name: 'Campo', sub: 'Aldeia das Papoilas', at: 0, sky: ['#3f8fdd', '#bfe0f7'], fog: '#cfe5f4', sun: '#fff1d6', sunI: 2.7, hemi: 1.05, hs: '#e8f3ff', hg: '#556b2f', dir: [.55, 1, .3], ground: '#5d8f3a', exp: 1.05 },
    { id: 'vila', name: 'Vila', sub: 'Vila Nova de Cima', at: 1200, sky: ['#3d8ee0', '#d8ecfb'], fog: '#dbe9f4', sun: '#fff6e6', sunI: 2.8, hemi: 1.1, hs: '#eef5ff', hg: '#6b6250', dir: [-.45, 1, .35], ground: '#7a8a5a', exp: 1.05 },
    { id: 'cidade', name: 'Cidade', sub: 'ao pôr do sol', at: 2800, sky: ['#3d5a8f', '#f3a96f'], fog: '#e3ad8a', sun: '#ffb877', sunI: 2.3, hemi: .85, hs: '#ffd9b8', hg: '#4b4038', dir: [-.85, .45, -.75], ground: '#6b6764', exp: 1.1 },
    { id: 'noite', name: 'Metrópole', sub: 'de noite', at: 4600, sky: ['#03060f', '#18244a'], fog: '#111a33', sun: '#a9bcff', sunI: .55, hemi: .42, hs: '#6f86c9', hg: '#151320', dir: [.35, 1, .2], ground: '#2b2a33', exp: 1.25, night: true },
  ];
  const bioAt = d => { let i = 0; BIOMES.forEach((b, k) => { if (d >= b.at) i = k; }); return i; };
  /* trânsito por etapa: tipo e peso */
  const TRAFFIC = {
    campo: [['hatch', 3], ['sedan', 2], ['van', 2], ['suv', 1], ['tractor', 1.4]],
    vila: [['hatch', 3], ['sedan', 3], ['van', 1.5], ['taxi', 1], ['suv', 1.5]],
    cidade: [['sedan', 3], ['taxi', 2], ['bus', 1.2], ['suv', 1.5], ['police', .6], ['truck', 1], ['hatch', 2]],
    noite: [['sedan', 3], ['taxi', 2.4], ['bus', 1], ['suv', 1.5], ['police', .8], ['truck', .8], ['sport', 1]],
  };
  const VLEN = { bus: 8.2, truck: 6.6, tractor: 3.6, van: 4.3 };
  const OBST = { campo: ['hay', 'cones', 'bar', 'hay'], vila: ['bar', 'cones', 'crate'], cidade: ['jersey', 'bar', 'cones'], noite: ['jersey', 'bar', 'cones'] };
  const OLEN = { bar: .5, cones: 1.3, hay: 1.1, crate: 1.0, jersey: .8 };
  const PAINT = ['#f8fafc', '#cbd5e1', '#1f2937', '#111827', '#1e3a8a', '#b91c1c', '#6b7280', '#d6c7a1', '#0f766e', '#7c2d12', '#334155', '#e2e8f0'];
  const pickW = (list, rnd) => { const tot = list.reduce((s, x) => s + x[1], 0); let q = rnd() * tot; for (const x of list) { q -= x[1]; if (q <= 0) return x[0]; } return list[0][0]; };

  function setup(api, o) {
    const N = U.clamp(parseInt(o.mode, 10) || 3, 3, 5), cfg = DIFF[o.diff] || DIFF.medium;
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { const G = api.G3; if (G && !G.r3) try { build3D(G, api); } catch (e) { console.warn('[faixa] 3D falhou', e); } }).catch(() => {});
    const start = Math.floor((N - 1) / 2);
    return api.G3 = {
      cfg, N, C: (N - 1) / 2, lane: start, px: start, tilt: 0, lastFree: start,
      v: cfg.v0, dist: 0, time: 0,
      objs: [], rinfo: [], nextRow: 30, rows: 0,
      score: 0, coins: 0, nears: 0, smashed: 0, shield: false, shieldFx: 0, star: 0, mag: 0,
      over: false, boom: null, bio: 0, bioShown: 0, signAt: 1,
    };
  }

  /* ════════════════════════════════════════════════════════════════
     geração de filas
  ════════════════════════════════════════════════════════════════ */
  const isSolid = o => !o.dead && !o.fly && (o.t === 'car' || OLEN[o.t] != null);
  function carInLane(G, l) { return G.objs.some(o => o.t === 'car' && !o.fly && o.z > -3 && (Math.abs(o.lane - l) < .75 || Math.abs(o.to - l) < .75)); }
  function mkCar(G, kind, lane, z, cf) {
    const len = (VLEN[kind] || 3.9) / ZS;
    const color = kind === 'taxi' ? '#facc15' : kind === 'police' ? '#f8fafc' : kind === 'bus' ? '#1d4ed8' : kind === 'tractor' ? '#15803d' : U.pick(PAINT);
    return { t: 'car', kind, lane, to: lane, z, len, cf, spd: G.v * cf, color, sig: 0, lc: false, haz: false, brake: false, noLC: kind === 'bus' || kind === 'tractor' || kind === 'truck' };
  }
  function spawnRow(G) {
    const N = G.N, z = ZMAX, bio = BIOMES[bioAt(G.dist + ZMAX * .8)].id, rnd = Math.random;
    const near = l => [l - 1, l, l + 1].filter(x => x >= 0 && x < N);
    const cand = near(G.lastFree).filter(l => !carInLane(G, l));
    const p = Math.min(1, G.time / 100);
    let k = G.rows < 3 ? (G.rows === 1 ? 'coins' : 'block') : pickW([['block', 4], ['traffic', 2.4 + p * 1.5], ['coins', 1.2], ['convoy', p * 1.2 * (N > 3 ? 1.3 : 1)]], rnd);
    if ((k === 'block' || k === 'convoy') && !cand.length) k = 'coins';
    G.rows++;
    if (k === 'block') {
      const F = U.pick(cand);
      const nMax = N - 1, nb = Math.max(1, Math.min(nMax, 1 + Math.floor(rnd() * nMax * (G.cfg.block * (.45 + .55 * p) + .15))));
      const others = [...Array(N).keys()].filter(l => l !== F).sort(() => rnd() - .5).slice(0, nb);
      const kind = U.pick(OBST[bio]);
      others.forEach(l => G.objs.push({ t: kind, lane: l, z, len: OLEN[kind], seed: rnd() }));
      G.rinfo.push({ z, F });
      G.lastFree = F;
      if (rnd() < .55) for (let i = 0; i < 3; i++) G.objs.push({ t: 'coin', lane: F, z: z + 2.5 + i * 2.4 });
      if (rnd() < .09) G.objs.push({ t: U.pick(G.shield ? ['star', 'mag'] : ['shield', 'star', 'mag']), lane: F, z: z - 3 });
    } else if (k === 'convoy') {
      const F = U.pick(cand), cf = U.rand(.3, .42), kind = U.pick(['sedan', 'hatch', 'suv']);
      let first = null;
      [...Array(N).keys()].filter(l => l !== F).forEach(l => { const c = mkCar(G, kind === 'suv' && rnd() < .5 ? 'van' : kind, l, z, cf); c.noLC = true; G.objs.push(c); first = first || c; });
      G.rinfo.push({ ref: first, F });
      G.lastFree = F;
    } else if (k === 'traffic') {
      const n = Math.min(N - 1, 1 + (rnd() < .35 + p * .3 ? 1 : 0) + (N === 5 && rnd() < .3 ? 1 : 0));
      const lanes = [...Array(N).keys()].filter(l => !G.objs.some(o => o.t === 'car' && o.z > ZMAX - 10 && Math.abs(o.lane - l) < .8)).sort(() => rnd() - .5).slice(0, n);
      lanes.forEach(l => { const kind = pickW(TRAFFIC[bio], rnd); G.objs.push(mkCar(G, kind, l, z + rnd() * 6, kind === 'tractor' ? .16 : kind === 'bus' || kind === 'truck' ? U.rand(.26, .34) : U.rand(.3, .52))); });
    } else {
      const l = rnd() < .6 ? G.lastFree : U.randi(0, N - 1);
      for (let i = 0; i < 5; i++) G.objs.push({ t: 'coin', lane: l, z: z + i * 2.4 });
      if (rnd() < .07) G.objs.push({ t: U.pick(['shield', 'star', 'mag']), lane: l, z: z + 14 });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     trânsito: travar, mudar de faixa com pisca, nunca fechar o caminho
  ════════════════════════════════════════════════════════════════ */
  function freeForLC(G, c, Y) {
    if (Y < 0 || Y >= G.N) return false;
    if (c.z < 16) return false;                                              /* não corta à frente do jogador */
    for (const r of G.rinfo) { const rz = r.ref ? r.ref.z : r.z; if (r.F === Y && rz > c.z - 8) return false; }
    for (const o of G.objs) {
      if (o === c || !isSolid(o)) continue;
      const lo = o.lc ? Math.min(o.lane, o.to) : o.lane, hi = o.lc ? Math.max(o.lane, o.to) : o.lane;
      if (Y < lo - .8 || Y > hi + .8) continue;
      if (o.z + o.len / 2 > c.z - c.len / 2 - 6 && o.z - o.len / 2 < c.z + c.len / 2 + 10) return false;
    }
    return true;
  }
  function tryLC(G, c, pref) {
    const opts = pref ? [c.lane + pref, c.lane - pref] : [c.lane - 1, c.lane + 1].sort(() => Math.random() - .5);
    for (const Y of opts) if (freeForLC(G, c, Y)) { c.to = Y; c.lc = true; c.sig = .75; return true; }
    return false;
  }
  function stepTraffic(G, dt) {
    for (const c of G.objs) {
      if (c.t !== 'car' || c.fly) continue;
      /* veículo/obstáculo da frente (na faixa onde está e na faixa para onde vai) */
      let lead = null, gap = Infinity;
      for (const o of G.objs) {
        if (o === c || !isSolid(o) || o.z <= c.z) continue;
        const same = Math.abs(o.lane - c.lane) < .8 || (c.lc && Math.abs(o.lane - c.to) < .8) || (o.lc && Math.abs(o.to - c.lane) < .8 && Math.abs(o.lane - c.lane) < 1.2);
        if (!same) continue;
        const g = (o.z - o.len / 2) - (c.z + c.len / 2);
        if (g < gap) { gap = g; lead = o; }
      }
      const leadSpd = lead ? (lead.t === 'car' ? lead.spd : 0) : Infinity;
      /* obras à frente: muda de faixa se der; senão trava */
      if (!c.lc && !c.noLC && lead && lead.t !== 'car' && gap < 22) tryLC(G, c);
      else if (!c.lc && !c.noLC && lead && lead.t === 'car' && lead.spd < c.spd - 2 && gap < 14 && Math.random() < dt * 1.5) tryLC(G, c);
      else if (!c.lc && !c.noLC && c.z > 24 && c.z < ZMAX - 4 && Math.random() < dt * .05) tryLC(G, c);
      /* velocidade */
      const cruise = G.v * c.cf;
      let want = cruise;
      if (lead) want = Math.min(cruise, Math.max(0, leadSpd + (gap - 1.4) * 1.8));
      c.brake = want < c.spd - .6;
      c.spd += U.clamp(want - c.spd, -34 * dt, 9 * dt);
      c.z += (c.spd - G.v) * dt;
      if (lead) { const lim = lead.z - lead.len / 2 - c.len / 2 - .35; if (c.z > lim) { c.z = lim; c.spd = Math.min(c.spd, leadSpd); } }
      c.haz = c.spd < .6 && !!lead && lead.t !== 'car';
      /* manobra: pisca primeiro, depois desliza; o pisca desliga quando acaba */
      if (c.lc) {
        if (c.sig > 0) c.sig -= dt;
        else {
          const d = c.to - c.lane, st = Math.min(Math.abs(d), dt * 1.7);
          c.lane += Math.sign(d) * st;
          if (Math.abs(c.to - c.lane) < .005) { c.lane = c.to; c.lc = false; }
        }
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     jogador
  ════════════════════════════════════════════════════════════════ */
  function steer(G, d, api) {
    if (G.over) return;
    const nl = U.clamp(G.lane + d, 0, G.N - 1);
    if (nl === G.lane) { G.tilt = d * .5; api.sfx.tone(160, .04, 'square', .03); return; }
    G.lane = nl;
    api.sfx.noise(.06, .03, 0, 2200, 'highpass'); api.sfx.tone(d < 0 ? 520 : 600, .05, 'triangle', .035, 0, d < 0 ? 420 : 760);
  }

  function crash(G, api, o) {
    if (G.star > 0) { smash(G, api, o); return; }
    if (G.shield) {
      G.shield = false; G.shieldFx = 1; smash(G, api, o, true);
      api.shake(6, .2); api.flash('#67e8f9', .15); api.sfx.noise(.2, .12, 0, 1800);
      api.float(...P2(api, G, G.px, 0, 70), 'Escudo!', '#67e8f9', 20);
      return;
    }
    G.over = true;
    const [x, y] = P2(api, G, G.px, 0, 20);
    G.boom = { x, y, t: 0, side: Math.sign(G.px - o.lane) || (Math.random() < .5 ? -1 : 1) };
    for (let i = 0; i < 36; i++) api.spark({ x, y, vx: U.rand(-320, 320), vy: U.rand(-380, 60), color: U.pick(['#fbbf24', '#fb923c', '#e5e7eb', '#fff']), size: U.rand(2, 5), life: U.rand(.5, 1), gravity: 600 });
    api.shake(14, .45); api.flash('#ffffff', .2); api.vibe([60, 40, 100]);
    api.sfx.noise(.5, .22, 0, 400, 'lowpass'); api.sfx.tone(160, .4, 'sawtooth', .07, 0, 50);
    api.over({ score: G.score, won: false, delay: 1300, title: 'Batida!', icon: '💥',
      stats: [['Distância', Math.floor(G.dist) + ' m'], ['Chegaste a', BIOMES[G.bio].name], ['Velocidade', Math.round(G.v * 6) + ' km/h'], ['Moedas', G.coins], ['Por um triz', G.nears]],
      meta: { dist: Math.floor(G.dist), lanes: G.N } });
  }
  /* invencível/escudo: o obstáculo voa para o lado */
  function smash(G, api, o, quiet) {
    o.fly = { t: 0, vx: (Math.sign(o.lane - G.px) || (Math.random() < .5 ? -1 : 1)) * U.rand(5, 9), vy: U.rand(6, 10), vr: U.rand(-6, 6) };
    G.smashed++; if (!quiet) { G.score += 10; api.float(...P2(api, G, o.lane, 0, 60), '+10', '#fde047', 16); }
    api.shake(5, .15); api.sfx.noise(.18, .08, 0, 900); api.vibe(20);
  }

  function update(G, dt, api) {
    if (G.over) { if (G.boom) G.boom.t += dt; return; }
    const n = Math.ceil(dt / (1 / 120)), h = dt / n;
    for (let s = 0; s < n && !G.over; s++) step(G, h, api);
    G.score = Math.floor(G.dist / 2) + G.coins * 5 + G.nears * 3 + G.smashed * 10;
    /* etapa da viagem */
    const bi = bioAt(G.dist);
    if (bi !== G.bioShown) { G.bioShown = bi; G.bio = bi; api.banner(BIOMES[bi].name, BIOMES[bi].sub); api.sfx.arp([523, 659, 784, 1047], .07, .14, 'triangle', .06); }
  }
  function step(G, dt, api) {
    const c = G.cfg;
    G.time += dt;
    G.v = Math.min(c.vMax, G.v + c.acc * dt);
    const dz = G.v * dt;
    G.dist += dz * .8;
    G.px = U.lerp(G.px, G.lane, Math.min(1, dt * 14));
    G.tilt = U.lerp(G.tilt, (G.lane - G.px) * 1.4, Math.min(1, dt * 12));
    G.shieldFx = Math.max(0, G.shieldFx - dt * 2);
    G.star = Math.max(0, G.star - dt); G.mag = Math.max(0, G.mag - dt);
    G.nextRow -= dz;
    if (G.nextRow <= 0) {
      spawnRow(G);
      const T = Math.max(c.tMin, 1.45 - G.time * .006);
      G.nextRow = G.v * T + U.rand(0, 4);
    }
    if (Math.floor(G.dist / 500) > Math.floor((G.dist - dz * .8) / 500)) { api.banner(Math.floor(G.dist / 500) * 500 + ' m', 'Mais rápido!'); api.sfx.arp([523, 784], .07, .1, 'triangle', .06); }
    /* mundo parado (obras, moedas, o que voa) anda para trás */
    for (const o of G.objs) if (o.t !== 'car' || o.fly) o.z -= dz;
    for (const r of G.rinfo) if (!r.ref) r.z -= dz;
    stepTraffic(G, dt);
    /* colisões e apanhar */
    const pz0 = -PL / 2, pz1 = PL / 2;
    for (let i = G.objs.length - 1; i >= 0; i--) {
      const o = G.objs[i];
      if (o.fly) { o.fly.t += dt; o.lane += o.fly.vx * dt / LW; if (o.fly.t > 1.2) G.objs.splice(i, 1); continue; }
      const dl = Math.abs(o.lane - G.px);
      if (o.t === 'coin' || o.t === 'shield' || o.t === 'star' || o.t === 'mag') {
        if (o.t === 'coin' && G.mag > 0 && dl < 1.7 && o.z < 12 && o.z > -1) { o.lane += (G.px - o.lane) * Math.min(1, dt * 9); o.z -= o.z * Math.min(1, dt * 5); }
        if (Math.abs(o.z) < 1.4 && dl < .62) {
          G.objs.splice(i, 1);
          if (o.t === 'coin') { G.coins++; api.sfx.tone(988, .06, 'sine', .07); api.sfx.tone(1319, .08, 'sine', .05, .05); api.float(...P2(api, G, o.lane, 0, 60), '+5', '#fde047', 16); }
          else if (o.t === 'shield') { G.shield = true; api.sfx.arp([660, 880, 1100], .05, .1, 'sine', .07); api.banner('Escudo', 'Aguenta uma batida'); }
          else if (o.t === 'star') { G.star = 6; api.sfx.arp([523, 659, 784, 1047, 1319], .05, .12, 'triangle', .07); api.banner('Invencível!', '6 segundos — passa por tudo'); }
          else { G.mag = 8; api.sfx.arp([440, 660, 880], .05, .1, 'square', .05); api.banner('Íman', 'As moedas vêm ter contigo'); }
          continue;
        }
        if (o.z < -6) G.objs.splice(i, 1);
        continue;
      }
      if (dl < .62 && o.z + o.len / 2 > pz0 && o.z - o.len / 2 < pz1) { crash(G, api, o); if (G.over) return; continue; }
      if (!o.passed && o.z + o.len / 2 < pz0) {
        o.passed = true;
        if (dl < 1.25 && dl >= .62 && G.star <= 0) { G.nears++; api.float(...P2(api, G, G.px, 0, 80), 'Por um triz +3', '#a5f3fc', 15); }
      }
      if (o.z < -14 || (o.t === 'car' && o.z > ZMAX + 30)) G.objs.splice(i, 1);
    }
    G.rinfo = G.rinfo.filter(r => (r.ref ? (G.objs.includes(r.ref) && r.ref.z > -4) : r.z > -4));
  }

  /* ponto no ecrã (lógico) de uma faixa/distância, `up` px acima — em 3D projeta pela câmara */
  let cur3 = null;
  const laneW = (G, l) => (l - G.C) * LW;
  function P2(api, G, lane, z, up) {
    if (cur3) { const p = Arcade3D.toScreen(cur3.cam, laneW(G, lane), 1, -z * ZS, api.W, api.H); return [p.x, p.y - up * .5]; }
    return [lane2x(api, G, lane, z), rowY(api, z) - up];
  }

  /* ════════════════════════════════════════════════════════════════
     3D — modelos (geometria juntada por material: poucas chamadas de desenho)
  ════════════════════════════════════════════════════════════════ */
  const _g = {};
  const BG = {
    box: () => _g.box || (_g.box = new THREE.BoxGeometry(1, 1, 1)),
    cyl: () => _g.cyl || (_g.cyl = new THREE.CylinderGeometry(.5, .5, 1, 12)),
    cyl6: () => _g.cyl6 || (_g.cyl6 = new THREE.CylinderGeometry(.5, .5, 1, 6)),
    cone: () => _g.cone || (_g.cone = new THREE.ConeGeometry(.5, 1, 10)),
    ico: () => _g.ico || (_g.ico = new THREE.IcosahedronGeometry(.5, 1)),
    sph: () => _g.sph || (_g.sph = new THREE.SphereGeometry(.5, 12, 8)),
    prism: () => { if (_g.prism) return _g.prism; const s = new THREE.Shape(); s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(0, 1); s.lineTo(-.5, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -.5); return (_g.prism = g); },
  };
  const VM = {};
  function vmat(k) {
    if (VM[k]) return VM[k];
    const m = k === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
      : k === 'glass' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .08, metalness: .7 })
        : k === 'metal' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .7 })
          : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: .02 });
    m.userData.shared = true; return (VM[k] = m);
  }
  function builder() {
    const parts = {}, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const add = (geo, col, x, y, z, rx, ry, rz, sx, sy, sz, k) => { E.set(rx || 0, ry || 0, rz || 0); Q.setFromEuler(E); P.set(x, y, z); S.set(sx, sy, sz); M4.compose(P, Q, S); (parts[k || 'std'] || (parts[k || 'std'] = [])).push([geo, col, M4.clone()]); };
    return {
      add,
      box: (w, h, d, x, y, z, col, ry, k) => add(BG.box(), col, x, y + h / 2, z, 0, ry, 0, w, h, d, k),
      cyl: (r, h, x, y, z, col, k, seg) => add(seg === 6 ? BG.cyl6() : BG.cyl(), col, x, y + h / 2, z, 0, 0, 0, r * 2, h, r * 2, k),
      cone: (r, h, x, y, z, col, k) => add(BG.cone(), col, x, y + h / 2, z, 0, 0, 0, r * 2, h, r * 2, k),
      ico: (r, x, y, z, col, sy, k) => add(BG.ico(), col, x, y, z, 0, 0, 0, r * 2, r * 2 * (sy || 1), r * 2, k),
      sph: (r, x, y, z, col, k) => add(BG.sph(), col, x, y, z, 0, 0, 0, r * 2, r * 2, r * 2, k),
      roof: (w, h, d, x, y, z, col, ry) => add(BG.prism(), col, x, y, z, 0, ry || 0, 0, w, h, d),
      build(shadow) {
        const g = new THREE.Group();
        Object.keys(parts).forEach(k => {
          let n = 0; const list = parts[k].map(([geo, col, m]) => { const c = (geo.index ? geo.toNonIndexed() : geo.clone()); c.applyMatrix4(m); n += c.attributes.position.count; return [c, new THREE.Color(col)]; });
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cl = new Float32Array(n * 3); let o = 0;
          list.forEach(([c, col]) => { pos.set(c.attributes.position.array, o); nor.set(c.attributes.normal.array, o); for (let i = 0; i < c.attributes.position.count; i++) { cl[o + i * 3] = col.r; cl[o + i * 3 + 1] = col.g; cl[o + i * 3 + 2] = col.b; } o += c.attributes.position.count * 3; c.dispose(); });
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
          const mesh = new THREE.Mesh(geo, vmat(k)); mesh.castShadow = shadow !== false && k !== 'glow'; mesh.receiveShadow = true; g.add(mesh);
        });
        return g;
      },
    };
  }
  const _tx = {};
  function ctex(key, w, h, paint, rep) {
    if (_tx[key]) return _tx[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.userData.shared = true; return (_tx[key] = t);
  }
  const rng = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);

  /* ── texturas ── */
  const T = {
    asphalt: () => ctex('asphalt', 256, 512, (x, w, h) => {
      x.fillStyle = '#3c3f45'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16000; i++) { const v = Math.random(); x.fillStyle = v < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.07)'; x.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); }
      /* remendos e fissuras */
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(20,20,24,.18)'; x.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 20 + Math.random() * 50); }
      x.strokeStyle = 'rgba(15,15,18,.5)'; x.lineWidth = 1.2; for (let i = 0; i < 6; i++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += Math.random() * 16 - 8; py += Math.random() * 14; x.lineTo(px, py); } x.stroke(); }
    }, true),
    grass: () => ctex('grass', 256, 256, (x, w, h) => {
      x.fillStyle = '#5b8f38'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(120,170,70,.25)' : 'rgba(40,80,25,.22)'; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 12 + Math.random() * 25, Math.random() * 3, 0, TAU); x.fill(); }
      for (let i = 0; i < 6000; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(170,215,110,.35)' : 'rgba(30,70,20,.3)'; x.fillRect(Math.random() * w, Math.random() * h, 1, 2.5); }
      for (let i = 0; i < 30; i++) { x.fillStyle = ['#f8fafc', '#facc15', '#ef4444', '#c084fc'][i % 4]; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, true),
    field: () => ctex('field', 256, 256, (x, w, h) => {
      x.fillStyle = '#b08a4a'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(120,90,40,.5)' : 'rgba(210,180,110,.35)'; x.fillRect(i * 16, 0, 9, h); }
      for (let i = 0; i < 3000; i++) { x.fillStyle = 'rgba(90,70,30,.25)'; x.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
    }, true),
    crops: () => ctex('crops', 256, 256, (x, w, h) => {
      x.fillStyle = '#7a5a30'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { x.fillStyle = '#4f8a2e'; x.fillRect(i * 16 + 2, 0, 11, h); for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(150,200,90,.6)'; x.fillRect(i * 16 + 3 + Math.random() * 8, Math.random() * h, 2, 3); } }
    }, true),
    calcada: () => ctex('calcada', 256, 256, (x, w, h) => {
      /* calçada portuguesa: pedra branca com ondas de basalto */
      x.fillStyle = '#e9e4da'; x.fillRect(0, 0, w, h);
      for (let yy = 0; yy < h; yy += 7) for (let xx = (yy / 7) % 2 * 3.5; xx < w; xx += 7) { x.fillStyle = `rgba(${Math.random() < .5 ? '180,170,155' : '255,255,250'},.45)`; x.fillRect(xx, yy, 6, 6); }
      x.strokeStyle = '#2b2b2e'; x.lineWidth = 14; x.lineCap = 'round';
      for (let k = 0; k < 2; k++) { x.beginPath(); for (let yy = -10; yy <= h + 10; yy += 4) x.lineTo(w / 2 + Math.sin(yy / h * TAU + k * Math.PI) * w * .32, yy); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1; for (let yy = 0; yy < h; yy += 7) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
    }, true),
    pavement: () => ctex('pavement', 256, 256, (x, w, h) => {
      x.fillStyle = '#a8a39c'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      x.strokeStyle = 'rgba(60,58,55,.45)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
    }, true),
    plaza: () => ctex('plaza', 256, 256, (x, w, h) => {
      x.fillStyle = '#7d7a76'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      x.strokeStyle = 'rgba(40,40,40,.35)'; x.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); }
    }, true),
    stripes: () => ctex('stripes', 256, 64, (x, w, h) => { x.fillStyle = '#f8fafc'; x.fillRect(0, 0, w, h); x.fillStyle = '#dc2626'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, h); x.fill(); } x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 4; x.strokeRect(0, 0, w, h); }),
    straw: () => ctex('straw', 128, 128, (x, w, h) => { x.fillStyle = '#d9b45a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.strokeStyle = Math.random() < .5 ? 'rgba(150,110,40,.5)' : 'rgba(255,235,160,.5)'; x.lineWidth = 1; x.beginPath(); const px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); x.lineTo(px + Math.random() * 10 - 5, py + Math.random() * 4); x.stroke(); } }, true),
    strawEnd: () => ctex('strawEnd', 128, 128, (x) => { x.fillStyle = '#c9a24c'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(120,85,30,.6)'; x.lineWidth = 2; x.beginPath(); for (let a = 0; a < 40; a += .1) { const r = a * 1.5; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke(); }),
    wood: () => ctex('crateWood', 128, 128, (x, w, h) => { x.fillStyle = '#b98246'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(60,30,10,.6)'; x.fillRect(0, i * 32, w, 2); } for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(90,50,20,.3)'; x.beginPath(); const y0 = Math.random() * h; x.moveTo(0, y0); x.bezierCurveTo(40, y0 + 3, 80, y0 - 3, w, y0); x.stroke(); } x.strokeStyle = '#6b3d16'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.stroke(); }),
    concrete: () => ctex('concrete', 128, 64, (x, w, h) => { x.fillStyle = '#d4d2cc'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)'; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } x.fillStyle = '#dc2626'; x.fillRect(0, h * .55, w / 2, h * .2); x.fillStyle = '#f8fafc'; x.fillRect(w / 2, h * .55, w / 2, h * .2); }),
    coin: () => ctex('coinFace', 256, 256, (x, w, h) => {
      const c = w / 2, g = x.createRadialGradient(c * .7, c * .6, 10, c, c, c); g.addColorStop(0, '#fff3b0'); g.addColorStop(.5, '#f6c445'); g.addColorStop(1, '#b8860b');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(120,80,0,.7)'; x.lineWidth = 6; x.beginPath(); x.arc(c, c, c * .82, 0, TAU); x.stroke();
      x.strokeStyle = 'rgba(255,250,210,.8)'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, c * .78, 0, TAU); x.stroke();
      for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; x.fillStyle = 'rgba(120,80,0,.55)'; x.beginPath(); x.arc(c + Math.cos(a) * c * .9, c + Math.sin(a) * c * .9, 3, 0, TAU); x.fill(); }
      /* estrela em relevo: sombra + luz */
      const star = (dx, dy, col) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? c * .25 : c * .55; x.lineTo(c + dx + Math.cos(a) * r, c + dy + Math.sin(a) * r); } x.closePath(); x.fill(); };
      star(4, 5, 'rgba(110,70,0,.65)'); star(-2, -2, '#fff6c8'); star(0, 0, '#f2b92e');
    }),
    coinEdge: () => ctex('coinEdge', 256, 16, (x, w, h) => { x.fillStyle = '#d9a72a'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { x.fillStyle = 'rgba(110,70,0,.55)'; x.fillRect(i, 0, 2, h); } }),
    facade: (key, wall, win, lit) => ctex('fac:' + key + (lit ? 'L' : ''), 128, 128, (x, w, h) => {
      x.fillStyle = lit ? '#000000' : wall; x.fillRect(0, 0, w, h);
      if (!lit) { for (let i = 0; i < 300; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 60, w, 4); x.fillRect(0, 124, w, 4); }
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const wx = 14 + c * 64, wy = 12 + r * 64;
        if (lit) { if (Math.random() < .55) { const g = x.createLinearGradient(wx, wy, wx + 36, wy + 38); g.addColorStop(0, '#ffe7a8'); g.addColorStop(1, '#e8a23b'); x.fillStyle = g; x.fillRect(wx, wy, 36, 38); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(wx + 17, wy, 2, 38); x.fillRect(wx, wy + 18, 36, 2); } continue; }
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(wx - 3, wy - 3, 42, 44);
        const g = x.createLinearGradient(wx, wy, wx + 36, wy + 38); g.addColorStop(0, win); g.addColorStop(1, '#0e1726');
        x.fillStyle = g; x.fillRect(wx, wy, 36, 38);
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(wx + 3, wy + 3, 10, 30);
        x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(wx + 17, wy, 2, 38); x.fillRect(wx, wy + 18, 36, 2);
      }
    }, true),
    sign: (txt, sub) => ctex('sign:' + txt, 512, 192, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d4ed8'; x.fillRect(10, 10, w - 20, h - 20);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(22, 22, w - 44, h - 44);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = "800 64px 'Space Grotesk', system-ui"; x.fillText(txt, w / 2, h * .44);
      x.font = '600 30px system-ui'; x.fillText(sub, w / 2, h * .75);
    }),
  };

  /* ── modelos do cenário (a fachada fica virada para +x; do outro lado da estrada roda-se 180°) ── */
  function mTree(seed, kind) {
    const r = rng(seed * 997 + 3), B = builder(), s = .8 + r() * .6;
    if (kind === 'pine') { B.cyl(.18 * s, 2 * s, 0, 0, 0, '#5b3a22'); for (let k = 0; k < 4; k++) B.cone((1.6 - k * .32) * s, 1.8 * s, 0, (1.4 + k * 1.05) * s, 0, k % 2 ? '#2f6b3d' : '#285e35'); return B.build(); }
    if (kind === 'orange') { B.cyl(.16 * s, 1.4 * s, 0, 0, 0, '#5b3a22'); B.ico(1.3 * s, 0, 2.2 * s, 0, '#2f7a32', .9); B.ico(.9 * s, .6 * s, 2.7 * s, .3, '#3d8f3a'); for (let k = 0; k < 9; k++) { const a = r() * TAU, e = r() * 1.2; B.sph(.13, Math.cos(a) * 1.15 * s, (2.1 + e * .5) * s, Math.sin(a) * 1.15 * s, '#f59e0b'); } return B.build(); }
    if (kind === 'cypress') { B.cyl(.14 * s, .6 * s, 0, 0, 0, '#5b3a22'); B.ico(.75 * s, 0, 2.6 * s, 0, '#244f2f', 3.6); return B.build(); }
    const greens = ['#3d7a2f', '#4a8a36', '#2f6b28', '#5a9a3e'];
    B.cyl(.22 * s, 2.2 * s, 0, 0, 0, '#5b3a22'); B.cyl(.12 * s, 1, .45 * s, 1.6 * s, 0, '#5b3a22');
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + r(), d = k ? 1 * s : 0; B.ico((k ? 1.1 : 1.5) * s, Math.cos(a) * d, (k ? 2.8 : 3.4) * s + r() * .5, Math.sin(a) * d, greens[(k + Math.floor(r() * 4)) % 4]); }
    return B.build();
  }
  function mHouse(seed, night, rural) {
    const r = rng(seed * 131 + 7), B = builder();
    const walls = rural ? ['#f5f1e8', '#efe6d2', '#f8f4ec'] : ['#f5f1e8', '#f3e3b5', '#e9d5c0', '#d6e6f2', '#f0d0c8', '#f8f4ec'];
    const wall = walls[Math.floor(r() * walls.length)], trim = r() < .5 ? '#1d4ed8' : r() < .5 ? '#ca8a04' : '#7c3a1d';
    const w = 6 + r() * 3, d = 6 + r() * 2, floors = rural ? 1 : 1 + (r() < .55 ? 1 : 0), h = floors * 3.1;
    B.box(w, h, d, 0, 0, 0, wall);
    B.box(w + .1, .45, d + .1, 0, 0, 0, trim);                      /* rodapé pintado */
    B.box(w + .5, .18, d + .5, 0, h, 0, '#e5e0d6');                 /* beirado */
    B.roof(w + .6, 1.9, d + .9, 0, h + .18, 0, '#c2562a', Math.PI / 2);
    B.add(BG.box(), '#a8461f', 0, h + .2 + 1.86, 0, 0, Math.PI / 2, 0, d + .95, .12, .25);   /* cumeeira */
    if (r() < .7) B.box(.7, 1.6, .7, w * .25, h + .6, d * .15, wall);  /* chaminé */
    /* fachada (+x): janelas com portadas, porta, varandas */
    const fx = w / 2 + .03;
    for (let f = 0; f < floors; f++) {
      const n = f === 0 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const zz = (k - (n - 1) / 2) * (d / n), yy = .9 + f * 3.1;
        if (f === 0 && k === n - 1) { B.box(.1, 2.2, 1.1, fx, 0, zz, '#6b3a1d'); B.box(.12, .1, 1.3, fx + .02, 2.2, zz, '#e5e0d6'); continue; }
        B.box(.06, 1.5, 1.05, fx, yy, zz, night && r() < .6 ? '#ffd98a' : '#21324a', 0, night ? 'glow' : 'glass');
        B.box(.1, .12, 1.25, fx + .02, yy - .06, zz, '#e5e0d6');
        [-1, 1].forEach(sd => B.box(.08, 1.5, .48, fx + .04, yy, zz + sd * .8, trim));
        if (f > 0 && r() < .4) { B.box(.7, .08, 1.5, fx + .35, yy - .1, zz, '#2b2b2b'); for (let b = 0; b < 5; b++) B.box(.04, .8, .04, fx + .68, yy - .05, zz - .65 + b * .32, '#2b2b2b'); }
      }
    }
    if (rural && r() < .6) { B.box(.3, .9, 2.5, w / 2 + 2, 0, -d / 2 + 1.2, '#e5e0d6'); B.ico(.6, w / 2 + 1.4, .6, d / 2 - .4, '#4a8a36'); }
    return B.build();
  }
  function mBarn(seed) {
    const r = rng(seed * 71 + 1), B = builder(), w = 7, d = 9, h = 4;
    B.box(w, h, d, 0, 0, 0, '#9f2a1d'); for (let k = 0; k < 12; k++) B.box(w + .04, h, .06, 0, 0, -d / 2 + k * d / 11, '#7f1d12');
    B.roof(w + .8, 2.6, d + .4, 0, h, 0, '#5b5b5b', Math.PI / 2);
    B.box(.1, 3, 3, w / 2 + .03, 0, 0, '#f5f1e8'); B.box(.12, 2.6, .12, w / 2 + .05, .2, 0, '#9f2a1d');
    for (let k = 0; k < 3; k++) B.cyl(.75, 1.5, w / 2 + 2 + r() * 2, 0, -2 + k * 1.7, '#d9b45a');
    return B.build();
  }
  function mWindmill() {
    const B = builder();
    B.cyl(1.8, 7, 0, 0, 0, '#f5f1e8'); B.cyl(1.95, .3, 0, 0, 0, '#c9c2b5');
    B.cone(2.1, 2.2, 0, 7, 0, '#8a5a34'); B.box(.1, 1.8, .9, 1.8, 0, 0, '#5b3a22');
    B.box(.08, .8, .6, 1.77, 3.5, 0, '#21324a', 0, 'glass');
    const g = B.build(), sails = builder();
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; sails.add(BG.box(), '#6b4a2e', 0, Math.sin(a) * 2.5, Math.cos(a) * 2.5, a, 0, 0, .12, .12, 5); sails.add(BG.box(), '#f8fafc', 0, Math.sin(a) * 2.6 + Math.cos(a) * .6, Math.cos(a) * 2.6 - Math.sin(a) * .6, a, 0, 0, .04, 1.1, 3.8); }
    const s = sails.build(); s.position.set(2.1, 6.4, 0); g.add(s); g.userData.sails = s;
    return g;
  }
  function mFence(len) {
    const B = builder();
    for (let k = 0; k <= 4; k++) B.box(.16, 1.2, .16, 0, 0, -len / 2 + k * len / 4, '#7a5a3a');
    [.45, .9].forEach(y => B.box(.08, .12, len, .04, y, 0, '#94704b'));
    return B.build();
  }
  function mPole() { const B = builder(); B.cyl(.13, 8, 0, 0, 0, '#5b4632'); B.box(.14, .14, 2.2, 0, 7.3, 0, '#5b4632'); [-.9, .9].forEach(z => B.cyl(.06, .2, 0, 7.4, z, '#dbeafe')); return B.build(); }
  function mCow(seed) {
    const r = rng(seed * 17 + 5), B = builder(), brown = r() < .4;
    const base = brown ? '#7a4a2a' : '#f5f5f4', spot = brown ? '#5a3418' : '#1c1917';
    B.box(1.9, .95, .85, 0, .75, 0, base);
    for (let k = 0; k < 4; k++) B.box(.5 + r() * .4, .5, .87, -.6 + r() * 1.2, .9 + r() * .3, 0, spot);
    [[-.7, -.3], [-.7, .3], [.7, -.3], [.7, .3]].forEach(([x, z]) => B.box(.2, .78, .2, x, 0, z, base));
    B.box(.6, .55, .5, 1.15, 1.2, 0, base); B.box(.25, .3, .46, 1.48, 1.08, 0, '#f2b6b0');
    [-.2, .2].forEach(z => B.box(.06, .14, .06, 1.1, 1.75, z, '#e7e5e4'));
    B.box(.08, .6, .08, -1, 1.1, 0, base);
    return B.build();
  }
  function mHayRow() { const B = builder(); for (let k = 0; k < 3; k++) B.add(BG.cyl(), '#d9b45a', 0, .7, -2 + k * 2, Math.PI / 2, 0, 0, 1.4, 1.2, 1.4); return B.build(); }
  function mLamp(night, city) {
    const B = builder();
    B.cyl(.09, city ? 7 : 5, 0, 0, 0, '#2b2f36', 'metal'); B.cyl(.18, .4, 0, 0, 0, '#2b2f36', 'metal');
    if (city) { B.box(1.6, .12, .12, .75, 6.9, 0, '#2b2f36', 0, 'metal'); B.box(.6, .16, .4, 1.45, 6.75, 0, night ? '#fff1c4' : '#e2e8f0', 0, night ? 'glow' : 'std'); }
    else { B.box(.9, .12, .12, .4, 4.9, 0, '#2b2f36', 0, 'metal'); B.add(BG.cyl6(), '#1f2937', .8, 4.75, 0, 0, 0, 0, .6, .5, .6, 'metal'); B.add(BG.cyl6(), night ? '#ffd98a' : '#e8e2c8', .8, 4.45, 0, 0, 0, 0, .45, .3, .45, night ? 'glow' : 'glass'); }
    const g = B.build();
    if (night) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#ffcf7a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .9 })); s.position.set(city ? 1.45 : .8, city ? 6.6 : 4.4, 0); s.scale.set(5, 5, 1); g.add(s); }
    return g;
  }
  function mBench() { const B = builder(); B.box(.5, .08, 1.8, 0, .45, 0, '#7a5230'); B.box(.08, .5, 1.8, -.22, .55, 0, '#7a5230'); [-.75, .75].forEach(z => B.box(.45, .45, .08, 0, 0, z, '#2b2f36')); return B.build(); }
  function mCafe(seed, night) {
    const r = rng(seed * 53 + 9), g = mHouse(seed, night, false), B = builder();
    const cols = ['#dc2626', '#16a34a', '#1d4ed8', '#ca8a04'], c = cols[Math.floor(r() * 4)];
    for (let k = 0; k < 8; k++) B.add(BG.box(), k % 2 ? '#f8fafc' : c, 4.6, 3.05, -3 + k * .8, 0, 0, -.35, 1.6, .06, .8);
    for (let k = 0; k < 2; k++) { const z = -1.5 + k * 2.8; B.cyl(.45, .05, 5.5, .75, z, '#e5e7eb', 'metal'); B.cyl(.05, .75, 5.5, 0, z, '#374151', 'metal'); B.add(BG.cone(), cols[(k + 1) % 4], 5.5, 2.3, z, 0, 0, 0, 2.2, .5, 2.2); B.cyl(.04, 2.1, 5.5, 0, z, '#e5e7eb'); }
    g.add(B.build()); return g;
  }
  function mChurch(night) {
    const B = builder();
    B.box(8, 6, 11, 0, 0, 0, '#f8f6f0'); B.roof(8.6, 3, 11.4, 0, 6, 0, '#c2562a', Math.PI / 2);
    B.box(3.2, 13, 3.2, 0, 0, -6.5, '#f8f6f0'); B.add(BG.cone(), '#c2562a', 0, 14.2, -6.5, 0, Math.PI / 4, 0, 4.4, 2.4, 4.4);
    B.box(.12, 1.6, 1.2, 1.62, 9.5, -6.5, '#2b2b2e'); B.sph(.4, 1.5, 9.4, -6.5, '#b88a2b', 'metal');
    B.box(.12, 3, 2, 4.05, 0, 0, '#6b3a1d'); B.add(BG.cyl(), night ? '#ffd98a' : '#6b8fbf', 4.05, 4.2, 0, 0, 0, Math.PI / 2, 1.2, .1, 1.2, night ? 'glow' : 'glass');
    B.box(.12, .15, 1.6, 0, 16.4, -6.5, '#3f3f46'); B.box(.12, 1.2, .15, 0, 15.9, -6.5, '#3f3f46');
    return B.build();
  }
  function mBuilding(seed, night, tall) {
    const r = rng(seed * 211 + 13);
    const pal = [['#c9b9a6', '#2a3a52'], ['#e5ded3', '#334155'], ['#9ca3af', '#1f2937'], ['#d8c3a5', '#3b4b63'], ['#b4c1cc', '#1e293b'], ['#e7d0b8', '#2f3e55'], ['#8e98a6', '#141c2b']];
    const [wall, win] = pal[Math.floor(r() * pal.length)];
    const w = 8 + r() * 4, d = 9 + r() * 4, h = tall ? 26 + r() * 40 : 12 + r() * 18;
    const fac = T.facade('b' + wall, wall, win, false);
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(nrm.getX(i)) > .5 ? d : w; uv.setXY(i, uv.getX(i) * ax / 7, uv.getY(i) * h / 6.4); }
    const side = night ? new THREE.MeshStandardMaterial({ map: fac, emissive: '#ffffff', emissiveMap: T.facade('b' + wall, wall, win, true), emissiveIntensity: .9, roughness: .75 }) : new THREE.MeshStandardMaterial({ map: fac, roughness: .75, metalness: .05 });
    const roof = Arcade3D.std('#5b5f66', { roughness: .9 });
    const m = new THREE.Mesh(geo, [side, side, roof, roof, side, side]); m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true;
    const g = new THREE.Group(); g.add(m);
    const B = builder();
    B.box(w + .2, .6, d + .2, 0, h, 0, '#6b7280');                           /* platibanda */
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) B.box(1.2, .9, 1.6, (r() - .5) * (w - 2), h, (r() - .5) * (d - 2), '#d1d5db', 0, 'metal');
    if (r() < .4) B.cyl(.9, 2, w * .2, h, -d * .2, '#94a3b8', 'metal');
    B.box(.3, 3.4, d + .2, w / 2 + .1, 0, 0, '#3f3f46');                       /* rés-do-chão com montra */
    B.box(.12, 2.6, d * .7, w / 2 + .3, .4, 0, night ? '#fde68a' : '#24364d', 0, night ? 'glow' : 'glass');
    const aw = ['#b91c1c', '#065f46', '#1e40af', '#92400e'][Math.floor(r() * 4)];
    B.add(BG.box(), aw, w / 2 + .9, 3.3, 0, 0, 0, -.3, 1.5, .1, d * .72);
    if (night && tall) B.box(.3, .3, .3, 0, h + .6, 0, '#ef4444', 0, 'glow');
    g.add(B.build());
    return g;
  }
  function mBusStop(night) {
    const B = builder();
    B.box(1.6, .1, 3.6, 0, 2.5, 0, '#cbd5e1', 0, 'metal'); [-1.6, 1.6].forEach(z => B.box(.1, 2.5, .1, -.7, 0, z, '#64748b', 0, 'metal'));
    B.box(.05, 2, 3.2, -.75, .3, 0, '#9cc9e8', 0, 'glass'); B.box(.5, .08, 2.4, -.4, .5, 0, '#64748b');
    B.box(.1, 1.6, .9, -.7, .6, 1.2, night ? '#fef3c7' : '#f8fafc', 0, night ? 'glow' : 'std');
    return B.build();
  }
  function mSignPole() { const B = builder(); B.cyl(.07, 3, 0, 0, 0, '#9ca3af', 'metal'); B.add(BG.cyl(), '#dc2626', .02, 2.6, 0, 0, 0, Math.PI / 2, .9, .06, .9); B.add(BG.cyl(), '#f8fafc', .05, 2.6, 0, 0, 0, Math.PI / 2, .66, .02, .66); return B.build(); }
  function mPlanter(seed) { const g = new THREE.Group(), B = builder(); B.box(1.4, .6, 1.4, 0, 0, 0, '#8b8680'); const t = mTree(seed, 'tree'); t.scale.setScalar(.7); t.position.y = .5; g.add(B.build(), t); return g; }
  /* placa de entrada na etapa */
  function mEntrySign(bi) {
    const b = BIOMES[bi], g = new THREE.Group(), B = builder();
    [-1.6, 1.6].forEach(z => B.cyl(.08, 3.2, 0, 0, z, '#9ca3af', 'metal'));
    g.add(B.build());
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshStandardMaterial({ map: T.sign(b.name.toUpperCase(), b.sub), roughness: .5 }));
    pm.position.set(.06, 3.1, 0); pm.rotation.y = Math.PI / 2; pm.castShadow = true; g.add(pm);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), Arcade3D.std('#9ca3af')); back.position.set(.02, 3.1, 0); back.rotation.y = -Math.PI / 2; g.add(back);
    return g;
  }

  /* ── obstáculos, moedas, power-ups ── */
  function mObstacle(kind) {
    const g = new THREE.Group();
    if (kind === 'bar') {
      const B = builder();
      [-1.25, 1.25].forEach(x => { B.add(BG.box(), '#e5e7eb', x, .55, -.25, .3, 0, 0, .12, 1.15, .12, 'metal'); B.add(BG.box(), '#e5e7eb', x, .55, .25, -.3, 0, 0, .12, 1.15, .12, 'metal'); });
      B.box(.18, .14, .3, -1.25, 1.62, 0, '#f59e0b');
      g.add(B.build());
      const sm = Arcade3D.std('#f8fafc'), st = new THREE.MeshStandardMaterial({ map: T.stripes(), roughness: .4 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.9, .5, .06), [sm, sm, sm, sm, st, st]);
      board.position.y = 1.1; board.castShadow = true; g.add(board);
      const b2 = board.clone(); b2.position.y = .45; b2.scale.set(1, .7, 1); g.add(b2);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), Arcade3D.glowMat('#ffb020')); lamp.position.set(-1.25, 1.85, 0); g.add(lamp);
      const gl = new THREE.Sprite(Arcade3D.glowSprite('#ffb020')); gl.position.copy(lamp.position); gl.scale.set(1.4, 1.4, 1); g.add(gl); g.userData.blink = gl;
    } else if (kind === 'cones') {
      const B = builder();
      [-1, 0, 1].forEach((x, i) => { const z = (i - 1) * .7; B.box(.6, .06, .6, x, 0, z, '#1f2937'); B.cone(.26, .9, x, .06, z, '#f97316'); B.add(BG.cyl(), '#f8fafc', x, .45, z, 0, 0, 0, .34, .12, .34); B.add(BG.cyl(), '#f8fafc', x, .7, z, 0, 0, 0, .22, .1, .22); });
      g.add(B.build());
    } else if (kind === 'hay') {
      const side = new THREE.MeshStandardMaterial({ map: T.straw(), roughness: 1 }), end = new THREE.MeshStandardMaterial({ map: T.strawEnd(), roughness: 1 });
      [[-.7, .78, 0], [.75, .78, .1], [0, 2.1, .05]].forEach(([x, y, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.78, .78, 1.3, 20), [side, end, end]); m.rotation.z = Math.PI / 2; m.rotation.y = .1; m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); });
    } else if (kind === 'crate') {
      const mt = new THREE.MeshStandardMaterial({ map: T.wood(), roughness: .8 });
      const B = builder(); B.box(2.6, .2, 1.4, 0, 0, 0, '#8a5a2c'); g.add(B.build());
      [[-.65, .2, 0, 1.2], [.65, .2, .05, 1.2], [0, 1.4, 0, 1.05]].forEach(([x, y, z, s]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mt); m.position.set(x, y + s / 2, z); m.rotation.y = (x + z) * .3; m.castShadow = m.receiveShadow = true; g.add(m); });
    } else if (kind === 'jersey') {
      const s = new THREE.Shape(); s.moveTo(-.33, 0); s.lineTo(.33, 0); s.lineTo(.3, .12); s.lineTo(.14, .3); s.lineTo(.12, .85); s.lineTo(-.12, .85); s.lineTo(-.14, .3); s.lineTo(-.3, .12); s.lineTo(-.33, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 1.45, bevelEnabled: false }); geo.translate(0, 0, -.725);
      const mt = new THREE.MeshStandardMaterial({ map: T.concrete(), roughness: .9 });
      [-.75, .75].forEach(x => { const m = new THREE.Mesh(geo, mt); m.rotation.y = Math.PI / 2; m.position.x = x; m.castShadow = m.receiveShadow = true; g.add(m); });
    }
    return g;
  }
  function mCoin() {
    const g = new THREE.Group();
    const face = new THREE.MeshStandardMaterial({ map: T.coin(), bumpMap: T.coin(), bumpScale: 2.5, metalness: .9, roughness: .22 }), edge = new THREE.MeshStandardMaterial({ map: T.coinEdge(), metalness: .9, roughness: .25 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .12, 32), [edge, face, face]); m.rotation.x = Math.PI / 2; m.castShadow = true; g.add(m);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#fde68a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .35 })); s.scale.set(1.6, 1.6, 1); g.add(s);
    return g;
  }
  function mPower(kind) {
    const g = new THREE.Group(), col = kind === 'shield' ? '#38bdf8' : kind === 'star' ? '#facc15' : '#ef4444';
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .05, 8, 40), Arcade3D.glowMat(col)); ring.rotation.x = Math.PI / 2; ring.position.y = .05; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 1.5; g.add(beam);
    const icon = new THREE.Group(); icon.position.y = 1.3; g.add(icon); g.userData.icon = icon;
    if (kind === 'shield') {
      const s = new THREE.Shape(); s.moveTo(0, .6); s.quadraticCurveTo(.4, .5, .5, .45); s.quadraticCurveTo(.5, -.2, 0, -.6); s.quadraticCurveTo(-.5, -.2, -.5, .45); s.quadraticCurveTo(-.4, .5, 0, .6);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: .6, roughness: .2, emissive: '#0369a1', emissiveIntensity: .4 })); m.geometry.center(); icon.add(m);
      const c = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .05), Arcade3D.std('#f8fafc')); c.position.z = .12; icon.add(c); const c2 = c.clone(); c2.rotation.z = Math.PI / 2; icon.add(c2);
    } else if (kind === 'star') {
      const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .25 : .62; const x = Math.cos(a) * r, y = -Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .14, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#facc15', metalness: .7, roughness: .2, emissive: '#b45309', emissiveIntensity: .5 })); m.geometry.center(); icon.add(m);
    } else {
      const m = new THREE.Mesh(new THREE.TorusGeometry(.38, .14, 10, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: .4, roughness: .3 })); m.rotation.z = Math.PI; icon.add(m);
      [-.38, .38].forEach(x => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .3, 12), Arcade3D.std('#e5e7eb', { metalness: .9, roughness: .2 })); t.position.set(x, .15, 0); icon.add(t); });
    }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .5 })); gl.scale.set(2.6, 2.6, 1); gl.position.y = 1.3; g.add(gl);
    return g;
  }
  /* veículos especiais (autocarro, camião, trator) com piscas e luzes como os carros; frente para −z */
  function mVehicle(kind, color) {
    const g = new THREE.Group(), B = builder(), wheels = [];
    const wheel = (x, z, r, w, rim) => { const wg = new THREE.Group(); wg.position.set(x, r, z); const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), Arcade3D.std('#16181d', { roughness: .85 })); t.rotation.z = Math.PI / 2; t.castShadow = true; wg.add(t); const rm = new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r * .6, w + .02, 12), Arcade3D.std(rim || '#cbd5e1', { metalness: .8, roughness: .3 })); rm.rotation.z = Math.PI / 2; wg.add(rm); for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(w + .04, r * .2, r * 1.1), Arcade3D.std('#475569', { metalness: .6 })); sp.rotation.x = k / 4 * Math.PI; wg.add(sp); } g.add(wg); wheels.push(wg); };
    let L, W2, front, rear, lampY;
    if (kind === 'bus') {
      L = 8.2; W2 = 2.5; const H = 3.1;
      B.box(W2, H - .5, L, 0, .45, 0, color); B.box(W2 + .02, .25, L, 0, .45, 0, '#f8fafc');
      B.box(W2 + .02, 1.1, L - 1.6, 0, 1.55, .4, '#1b2636', 0, 'glass');
      B.box(W2 - .2, 1.3, .05, 0, 1.3, -L / 2 - .01, '#1b2636', 0, 'glass');
      B.box(W2 + .02, .12, L, 0, H - .1, 0, '#e5e7eb');
      B.box(W2 * .7, .3, .05, 0, H - .5, -L / 2 - .02, '#111827'); B.box(W2 * .5, .16, .06, 0, H - .43, -L / 2 - .03, '#fbbf24', 0, 'glow');
      [-1, 1].forEach(sd => B.box(.05, 2, .9, sd * (W2 / 2 + .01), .5, -L / 2 + 1.4, '#1b2636', 0, 'glass'));
      wheel(-W2 / 2 + .15, -L / 2 + 1.6, .5, .3); wheel(W2 / 2 - .15, -L / 2 + 1.6, .5, .3); wheel(-W2 / 2 + .15, L / 2 - 1.8, .5, .3); wheel(W2 / 2 - .15, L / 2 - 1.8, .5, .3);
      front = -L / 2 - .04; rear = L / 2 + .04; lampY = .8;
    } else if (kind === 'truck') {
      L = 6.6; W2 = 2.4; const H = 3.3;
      B.box(W2, 2.2, 1.9, 0, .5, -L / 2 + .95, color); B.box(W2 - .1, .9, .05, 0, 1.7, -L / 2 - .01, '#1b2636', 0, 'glass');
      [-1, 1].forEach(sd => B.box(.05, .8, 1, sd * (W2 / 2 + .01), 1.7, -L / 2 + .9, '#1b2636', 0, 'glass'));
      B.box(W2 + .05, H - .6, L - 2.1, 0, .6, .95, '#e5e7eb'); for (let k = 0; k < 6; k++) B.box(W2 + .08, H - .7, .05, 0, .65, -1.4 + k * .9, '#cbd5e1');
      B.box(W2, .3, L, 0, .3, 0, '#1f2937');
      wheel(-W2 / 2 + .15, -L / 2 + .9, .52, .32); wheel(W2 / 2 - .15, -L / 2 + .9, .52, .32); wheel(-W2 / 2 + .15, L / 2 - 1.2, .52, .32); wheel(W2 / 2 - .15, L / 2 - 1.2, .52, .32);
      front = -L / 2 - .02; rear = L / 2 + .04; lampY = .75;
    } else {
      L = 3.6; W2 = 1.9;
      B.box(1, .9, 2.2, 0, .9, -.5, color); B.box(.9, .4, .8, 0, 1.2, -1.45, color);
      B.box(1.6, .1, 1.5, 0, 2.55, .7, '#f8fafc'); [[-.7, .15], [.7, .15], [-.7, 1.35], [.7, 1.35]].forEach(([x, z]) => B.box(.07, 1.5, .07, x, 1.1, z, '#1f2937', 0, 'metal'));
      B.box(1.4, 1.1, .05, 0, 1.3, .1, '#9cc9e8', 0, 'glass'); B.box(.16, 1, .16, .35, 1.6, -1.3, '#374151', 0, 'metal');
      B.box(1.2, .55, 1.3, 0, .9, .75, '#d4d4d8');
      wheel(-.9, .75, .78, .5, '#facc15'); wheel(.9, .75, .78, .5, '#facc15'); wheel(-.75, -1.2, .45, .32, '#facc15'); wheel(.75, -1.2, .45, .32, '#facc15');
      front = -1.85; rear = 1.4; lampY = 1.1;
      const lt = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), Arcade3D.glowMat('#ffb020')); lt.position.set(0, 2.72, .7); g.add(lt); g.userData.beacon = lt;
    }
    g.add(B.build());
    const amber = Arcade3D.glowMat('#ffb020'), blinkL = [], blinkR = [];
    [[front, -1], [rear, -1], [front, 1], [rear, 1]].forEach(([z, sd]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, .06), amber); m.position.set(sd * (W2 / 2 - .12), lampY + .25, z); m.visible = false; g.add(m); (sd < 0 ? blinkL : blinkR).push(m); });
    const spr = (col, x, y, z, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); m.position.set(x, y, z); m.scale.set(s, s, 1); g.add(m); return m; };
    [-1, 1].forEach(sd => { const t = new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .06), Arcade3D.glowMat('#ef1d3a')); t.position.set(sd * (W2 / 2 - .25), lampY, rear); g.add(t); const h = new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .06), Arcade3D.glowMat('#fffbe6')); h.position.set(sd * (W2 / 2 - .25), lampY, front); g.add(h); });
    Object.assign(g.userData, { wheels, blinkL, blinkR, tailGlow: [-1, 1].map(sd => spr('#ff2040', sd * (W2 / 2 - .25), lampY, rear + .05, .7)), headGlow: [-1, 1].map(sd => spr('#fff4d0', sd * (W2 / 2 - .25), lampY, front - .05, .6)), big: true });
    return g;
  }
  /* carro do trânsito: Arcade3D.car com a frente para −z.
     No Arcade3D.car o "blinkL" é o lado +z do modelo; com a frente para −z isso fica à direita. */
  function mTraffic(o) {
    if (o.kind === 'bus' || o.kind === 'truck' || o.kind === 'tractor') return mVehicle(o.kind, o.color);
    const c = Arcade3D.car({ type: o.kind, color: o.color, len: o.kind === 'van' ? 4.3 : 3.9, forward: '-z', night: true });
    const u = c.userData, L = u.blinkL; u.blinkL = u.blinkR; u.blinkR = L;
    return c;
  }

  /* ════════════════════════════════════════════════════════════════
     cena 3D
  ════════════════════════════════════════════════════════════════ */
  const TILE = 12;                        /* comprimento de um bloco de chão (z) */
  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const { scene, sun, hemi } = Arcade3D.stdScene({ sky: '#e8f3ff', ground: '#556b2f', hemi: 1.05, sun: '#fff1d6', sunI: 2.6, fillI: .25, normalBias: .04 });
    sun.shadow.bias = -.0004;
    const fill = scene.children.find(c => c.isDirectionalLight && c !== sun);
    const cam = new THREE.PerspectiveCamera(58, 1, .3, 900);
    scene.fog = new THREE.Fog('#cfe5f4', 70, ZMAX * ZS * 1.08);
    /* céu: cúpula com cor por vértice (mistura entre etapas) */
    const skyG = new THREE.SphereGeometry(500, 32, 16), skyC = new Float32Array(skyG.attributes.position.count * 3);
    skyG.setAttribute('color', new THREE.BufferAttribute(skyC, 3));
    const sky = new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; scene.add(sky);
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#fff3d0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); sunSpr.scale.set(120, 120, 1); sunSpr.renderOrder = -9; scene.add(sunSpr);
    const stars = (() => { const n = 500, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = .1 + Math.random() * 1.3; p.set([Math.cos(a) * Math.cos(e) * 450, Math.sin(e) * 450, Math.sin(a) * Math.cos(e) * 450], i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, transparent: true, opacity: 0, fog: false, depthWrite: false })); })();
    stars.renderOrder = -9; scene.add(stars);
    /* fundo distante: colinas e linha de prédios (anéis com textura) */
    const ring = (key, paint, h, y) => { const t = ctex(key, 2048, 256, paint, true); t.repeat.set(3, 1); t.wrapT = THREE.ClampToEdgeWrapping; const m = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, h, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.position.y = y; m.renderOrder = -8; scene.add(m); return m; };
    const hills = ring('hills', (x, w, h) => { [['#8fb2cf', 90, 60, .006], ['#6a9a78', 150, 45, .011], ['#4f8052', 200, 30, .02]].forEach(([c, base, amp, f]) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, h); for (let X = 0; X <= w; X += 8) x.lineTo(X, base - Math.sin(X * f) * amp - Math.sin(X * f * 2.7 + 1) * amp * .4); x.lineTo(w, h); x.fill(); }); }, 120, 40);
    const skyline = ring('skyline', (x, w, h) => { let X = 0; while (X < w) { const bw = 20 + Math.random() * 50, bh = 60 + Math.random() * 170; const c = 95 + Math.random() * 30; x.fillStyle = `rgb(${c},${c + 8},${c + 22})`; x.fillRect(X, h - bh, bw, bh); X += bw + Math.random() * 6; } }, 140, 50);
    const skylineN = ring('skylineN', (x, w, h) => { let X = 0; while (X < w) { const bw = 20 + Math.random() * 50, bh = 60 + Math.random() * 170; x.fillStyle = '#0b1022'; x.fillRect(X, h - bh, bw, bh); for (let yy = h - bh + 6; yy < h - 4; yy += 7) for (let xx = X + 4; xx < X + bw - 4; xx += 6) if (Math.random() < .35) { x.fillStyle = Math.random() < .8 ? 'rgba(255,214,140,.9)' : 'rgba(170,210,255,.9)'; x.fillRect(xx, yy, 3, 3); } if (Math.random() < .3) { x.fillStyle = '#ef4444'; x.fillRect(X + bw / 2, h - bh - 4, 3, 3); } X += bw + Math.random() * 6; } }, 140, 50);
    /* chão de fundo (preenche ao longe) */
    const base = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#5d8f3a', roughness: 1 }));
    base.rotation.x = -Math.PI / 2; base.position.y = -.08; base.receiveShadow = true; scene.add(base);
    /* estrada: asfalto a correr, linhas das bermas e tracejado das faixas */
    const roadW = G.N * LW + 1.4, roadL = ZMAX * ZS * 1.12 + 30;
    const atL = T.asphalt().clone(); atL.needsUpdate = true; atL.wrapS = atL.wrapT = THREE.RepeatWrapping; atL.repeat.set(1, roadL / 22);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, roadL), new THREE.MeshStandardMaterial({ map: atL, roughness: .82, metalness: .05 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, .01, -roadL / 2 + 22); road.receiveShadow = true; scene.add(road);
    const lineM = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: .5, emissive: '#ffffff', emissiveIntensity: .05 });
    [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.PlaneGeometry(.16, roadL), lineM); e.rotation.x = -Math.PI / 2; e.position.set(sd * (G.N * LW / 2 + .25), .02, -roadL / 2 + 22); e.receiveShadow = true; scene.add(e); });
    const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(.14, 3), lineM, (G.N - 1) * 22); dash.frustumCulled = false; dash.receiveShadow = true; scene.add(dash);
    /* jogador */
    const player = Arcade3D.car({ type: 'sport', color: '#c8102e', len: 3.95, wid: .47, forward: '-z', rim: '#d4d4d8', night: true });
    { const u = player.userData, L = u.blinkL; u.blinkL = u.blinkR; u.blinkR = L; }
    scene.add(player);
    const head = new THREE.SpotLight('#fff1d0', 0, 60, .55, .5, 1.2); head.position.set(0, .8, -1.8); head.target.position.set(0, 0, -20); player.add(head, head.target);
    const shieldM = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7, 2), new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: .3, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, wireframe: true }));
    shieldM.scale.set(1, .6, 1.3); scene.add(shieldM);
    const starAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: '#fde047', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); starAura.scale.set(7, 4, 1); scene.add(starAura);
    G.r3 = { renderer, scene, sun, hemi, fill, cam, sky, skyC, sunSpr, stars, hills, skyline, skylineN, base, road, atL, dash, player, head, shieldM, starAura,
      pool: Arcade3D.pool(scene), m4: new THREE.Matrix4(), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), v: new THREE.Vector3(), sc: new THREE.Vector3(1, 1, 1),
      scn: [], next: [[0, 0], [0, 0]], tiles: [], tileNext: -2, scroll: 0, lastDist: 0, cx: 0, lean: 0, skyKey: '' };
    api.stage.style.background = '#9cc9ef';
  }

  /* ── cenário: blocos de chão + duas "filas" de adereços por lado (junto à berma e afastados) ── */
  function sceneryStep(G, dz) {
    const R = G.r3;
    R.scn.forEach(s => { s.z -= dz; }); R.tiles.forEach(t => { t.z -= dz; }); R.tileNext -= dz;
    R.next.forEach(a => { a[0] -= dz; a[1] -= dz; });
    R.scn = R.scn.filter(s => s.z > -16); R.tiles = R.tiles.filter(t => t.z > -TILE - 4);
    const far = ZMAX * 1.12;
    while (R.tileNext < far) { const bi = bioAt(G.dist + R.tileNext * .8); R.tiles.push({ z: R.tileNext, bi, field: bi === 0 && Math.random() < .5 ? (Math.random() < .5 ? 'field' : 'crops') : null }); R.tileNext += TILE; }
    /* placa de entrada quando a próxima etapa aparece no horizonte */
    if (G.signAt < BIOMES.length && G.dist + far * .8 >= BIOMES[G.signAt].at) { R.scn.push({ kind: 'entry', bi: G.signAt, side: 1, z: far, x: G.N * LW / 2 + 2.4, seed: 0 }); G.signAt++; }
    for (let side = 0; side < 2; side++) {
      const sd = side ? 1 : -1, edge = G.N * LW / 2 + 1.1;
      /* junto à berma */
      while (R.next[side][0] < far) {
        const z = R.next[side][0], bi = bioAt(G.dist + z * .8), b = BIOMES[bi].id, r = Math.random();
        let item, step;
        if (b === 'campo') { if (r < .55) { item = { kind: 'fence', x: edge + 1.6 }; step = 8.2; } else if (r < .8) { item = { kind: 'pole', x: edge + 2 }; step = 9; } else { item = { kind: 'cypress', x: edge + 2.4 }; step = 4; } }
        else if (b === 'vila') { if (r < .7) { item = { kind: 'lamp', x: edge + .9 }; step = 11; } else if (r < .85) { item = { kind: 'bench', x: edge + 1.7 }; step = 6; } else { item = { kind: 'orange', x: edge + 2.1 }; step = 6; } }
        else { if (r < .65) { item = { kind: 'lampC', x: edge + .8 }; step = 12; } else if (r < .78) { item = { kind: 'busstop', x: edge + 2.2 }; step = 7; } else if (r < .9) { item = { kind: 'planter', x: edge + 2.8 }; step = 7; } else { item = { kind: 'signpole', x: edge + .8 }; step = 7; } }
        item.side = sd; item.z = z; item.bi = bi; item.seed = Math.floor(Math.random() * 6); R.scn.push(item);
        R.next[side][0] += step / ZS * (item.kind === 'fence' ? 1 : .8 + Math.random() * .4);
      }
      /* afastados: casas, prédios, quintas, árvores */
      while (R.next[side][1] < far) {
        const z = R.next[side][1], bi = bioAt(G.dist + z * .8), b = BIOMES[bi].id, r = Math.random();
        let item, step;
        if (b === 'campo') {
          if (r < .45) { item = { kind: r < .3 ? 'tree' : 'pine', x: edge + 5 + Math.random() * 18 }; step = 4 + Math.random() * 6; }
          else if (r < .62) { item = { kind: 'farm', x: edge + 10 + Math.random() * 6 }; step = 14; }
          else if (r < .72) { item = { kind: 'barn', x: edge + 14 + Math.random() * 6 }; step = 14; }
          else if (r < .84) { item = { kind: 'cow', x: edge + 6 + Math.random() * 10 }; step = 3; }
          else if (r < .93) { item = { kind: 'hayrow', x: edge + 8 + Math.random() * 10 }; step = 6; }
          else { item = { kind: 'windmill', x: edge + 18 + Math.random() * 8 }; step = 16; }
        } else if (b === 'vila') {
          if (r < .7) { item = { kind: 'house', x: edge + 7.4 }; step = 9.5 + Math.random() * 1.5; }
          else if (r < .82) { item = { kind: 'cafe', x: edge + 7.4 }; step = 10.5; }
          else if (r < .9) { item = { kind: 'church', x: edge + 10 }; step = 14; }
          else { item = { kind: 'orange', x: edge + 5.2 }; step = 5; }
        } else { item = { kind: b === 'noite' && r < .6 ? 'tower' : 'bldg', x: edge + 12 }; step = 13 + Math.random() * 2; }
        item.side = sd; item.z = z; item.bi = bi; item.seed = Math.floor(Math.random() * 8); R.scn.push(item);
        R.next[side][1] += step / ZS;
      }
    }
  }
  function modelFor(R, s, night) {
    const key = s.kind + ':' + s.seed + (night ? 'N' : '') + (s.kind === 'entry' ? s.bi : '');
    return R.pool.get(key, () => {
      switch (s.kind) {
        case 'tree': case 'pine': case 'orange': case 'cypress': return mTree(s.seed + 1, s.kind);
        case 'fence': return mFence(8.2);
        case 'pole': return mPole();
        case 'farm': return mHouse(s.seed + 40, night, true);
        case 'barn': return mBarn(s.seed);
        case 'cow': return mCow(s.seed);
        case 'hayrow': return mHayRow();
        case 'windmill': return mWindmill();
        case 'lamp': return mLamp(night, false);
        case 'lampC': return mLamp(night, true);
        case 'bench': return mBench();
        case 'house': return mHouse(s.seed, night, false);
        case 'cafe': return mCafe(s.seed, night);
        case 'church': return mChurch(night);
        case 'bldg': return mBuilding(s.seed + 5, night, false);
        case 'tower': return mBuilding(s.seed + 50, night, true);
        case 'busstop': return mBusStop(night);
        case 'planter': return mPlanter(s.seed);
        case 'signpole': return mSignPole();
        case 'entry': return mEntrySign(s.bi);
      }
      return new THREE.Group();
    });
  }
  /* bloco de chão de um lado (desenhado para o lado +x; o outro lado é espelhado) */
  function tileModel(R, G, t) {
    const b = BIOMES[t.bi].id, key = 'tile:' + b + (t.field || '') + ':' + G.N;
    return R.pool.get(key, () => {
      const g = new THREE.Group(), L = TILE * ZS + .05, edge = G.N * LW / 2 + .7;
      const plane = (w, tex, x, y, rep, col) => { const tx = tex.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(w / rep, L / rep); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), new THREE.MeshStandardMaterial({ map: tx, roughness: .95, color: col || '#ffffff' })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, 0); m.receiveShadow = true; g.add(m); return m; };
      const B = builder();
      if (b === 'campo') {
        B.box(1.1, .02, L, edge + .55, 0, 0, '#8a7a5a');                 /* berma de terra */
        plane(10, T.grass(), edge + 6.1, .01, 8);
        plane(40, t.field ? T[t.field]() : T.grass(), edge + 31, 0, t.field ? 10 : 8);
      } else if (b === 'vila') {
        B.box(.3, .18, L, edge + .15, 0, 0, '#d6d3d1');                 /* lancil */
        B.box(3.2, .17, L, edge + 1.9, 0, 0, '#cfc9be');
        plane(3.2, T.calcada(), edge + 1.9, .175, 3.2);
        plane(40, T.grass(), edge + 23.5, 0, 8, '#c8b9a0');
      } else {
        B.box(.3, .2, L, edge + .15, 0, 0, '#c4c0ba');
        B.box(5, .19, L, edge + 2.8, 0, 0, '#a8a39c');
        plane(5, T.pavement(), edge + 2.8, .195, 2.5);
        plane(40, T.plaza(), edge + 25.3, 0, 6, b === 'noite' ? '#6b6b78' : '#ffffff');
      }
      g.add(B.build(false));
      return g;
    });
  }
  /* altura do passeio em cada etapa (adereços de rua assentam nele) */
  const KERB = { campo: 0, vila: .18, cidade: .2, noite: .2 };
  const ONKERB = new Set(['lamp', 'lampC', 'bench', 'busstop', 'planter', 'signpole']);

  function lerpC(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }
  function draw3D(G, ctx, W, H, api) {
    const R = G.r3; cur3 = R;
    const asp = Arcade3D.fit(api.stage, R.cam);
    const dz = Math.max(0, (G.dist - R.lastDist) / .8); R.lastDist = G.dist;
    sceneryStep(G, dz);
    const { m4, v } = R, P = R.pool, t = api.t;
    /* luz/cores: mistura entre a etapa anterior e a atual (250 m de transição) */
    const bi = bioAt(G.dist), b1 = BIOMES[bi], b0 = BIOMES[Math.max(0, bi - 1)], k = bi ? U.clamp((G.dist - b1.at) / 250, 0, 1) : 1;
    const mix = key => lerpC(b0[key], b1[key], k), mixN = key => U.lerp(b0[key], b1[key], k);
    const night = U.lerp(b0.night ? 1 : 0, b1.night ? 1 : 0, k);
    const skyKey = bi + ':' + Math.round(k * 40);
    if (R.skyKey !== skyKey) {
      R.skyKey = skyKey;
      const top = new THREE.Color(lerpC(b0.sky[0], b1.sky[0], k)), hor = new THREE.Color(lerpC(b0.sky[1], b1.sky[1], k)), p = R.sky.geometry.attributes.position, c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 500; c.copy(hor).lerp(top, Math.pow(U.clamp(y, 0, 1), .55)); R.skyC[i * 3] = c.r; R.skyC[i * 3 + 1] = c.g; R.skyC[i * 3 + 2] = c.b; }
      R.sky.geometry.attributes.color.needsUpdate = true;
      R.scene.fog.color.set(mix('fog')); R.base.material.color.set(mix('ground'));
      R.hemi.color.set(mix('hs')); R.hemi.groundColor.set(mix('hg')); R.hemi.intensity = mixN('hemi');
      R.sun.color.set(mix('sun')); R.sun.intensity = mixN('sunI');
      if (R.fill) R.fill.intensity = .25 * (1 - night);
      R.renderer.toneMappingExposure = mixN('exp');
      R.stars.material.opacity = night * .9;
      R.sunSpr.material.color.set(night > .5 ? '#cfd9ff' : mix('sun')); R.sunSpr.scale.setScalar(night > .5 ? 50 : 130);
      const city = bi >= 2 ? (bi === 2 ? k : 1) : 0;
      R.hills.material.opacity = 1 - city; R.skyline.material.opacity = city * (1 - night); R.skylineN.material.opacity = night;
      R.hills.visible = R.hills.material.opacity > .01; R.skyline.visible = R.skyline.material.opacity > .01; R.skylineN.visible = night > .01;
      api.stage.style.background = lerpC(b0.sky[1], b1.sky[1], k);
    }
    /* câmara: atrás e acima do carro; recua com mais faixas e em ecrãs ao alto */
    const px = laneW(G, G.px), port = asp < .8 ? (.8 - asp) * 2.2 : 0, wide = (G.N - 3) * .5;
    R.cx = U.lerp(R.cx, px * .62, .12);
    const kv = (G.v - G.cfg.v0) / (G.cfg.vMax - G.cfg.v0), [shx, shy] = api.shakeXY;
    R.cam.position.set(R.cx + shx * .02, 4.4 + wide * 1.4 + port * 2.6 + shy * .02, 9.6 + wide * 2.2 + port * 3.2 + kv * .8);
    R.cam.lookAt(R.cx * .85, 1, -16);
    R.lean = U.lerp(R.lean, (G.lane - G.px) * .5, .25);
    R.cam.rotateZ(R.lean * .05);
    R.cam.fov = 56 + kv * 10 + port * 8 + wide * 2; R.cam.updateProjectionMatrix();
    const dir = b1.dir.map((d, i) => U.lerp(b0.dir[i], d, k));
    Arcade3D.sunAt(R.sun, R.cx, 0, -20, 34, dir);
    R.sunSpr.position.set(R.cam.position.x + dir[0] * 380, Math.max(40, dir[1] * 300), R.cam.position.z - 300 * Math.sign(-dir[2] || 1));
    R.sky.position.set(R.cam.position.x, 0, R.cam.position.z); R.stars.position.copy(R.sky.position);
    [R.hills, R.skyline, R.skylineN].forEach(m => { m.position.x = R.cam.position.x; m.position.z = R.cam.position.z - 60; });
    R.base.position.x = R.cam.position.x; R.base.position.z = -200;
    /* estrada a correr */
    R.scroll = (R.scroll + dz * ZS / 22) % 1; R.atL.offset.y = R.scroll;
    let n = 0;
    const dashPer = 9 / ZS, off = ((G.dist / .8) % dashPer + dashPer) % dashPer;
    for (let l = 0; l < G.N - 1; l++) for (let zz = -4 - off; zz < ZMAX * 1.1 && n < R.dash.count; zz += dashPer) { v.set(laneW(G, l + .5), .025, -zz * ZS); m4.compose(v, R.q, R.sc); R.dash.setMatrixAt(n++, m4); }
    R.dash.count = n; R.dash.instanceMatrix.needsUpdate = true;
    P.begin();
    /* chão em blocos (as etapas chegam do horizonte) */
    R.tiles.forEach(tl => [-1, 1].forEach(sd => { const m = tileModel(R, G, tl); m.position.set(0, 0, -(tl.z + TILE / 2) * ZS); m.scale.x = sd; }));
    /* cenário */
    R.scn.forEach(s => {
      const m = modelFor(R, s, BIOMES[s.bi].night);
      m.position.set(s.side * s.x, ONKERB.has(s.kind) ? KERB[BIOMES[s.bi].id] : 0, -s.z * ZS);
      m.rotation.set(0, s.side > 0 ? Math.PI : 0, 0);
      if (s.kind === 'cow') m.rotation.y += s.seed;
      if (s.kind === 'tree' || s.kind === 'pine' || s.kind === 'cypress') m.rotation.y = s.seed * 1.3;
      if (m.userData.sails) m.userData.sails.rotation.x = t * .8;
    });
    /* objetos */
    const blink = Math.floor(t * 3) % 2 === 0;
    for (const o of G.objs) {
      if (o.z < -12 || o.z > ZMAX * 1.12) continue;
      const x = laneW(G, o.lane), z = -o.z * ZS;
      if (o.t === 'coin') { const m = P.get('coin', mCoin); m.position.set(x, 1 + Math.sin(t * 4 + o.z) * .12, z); m.rotation.y = t * 3 + o.z; continue; }
      if (o.t === 'shield' || o.t === 'star' || o.t === 'mag') { const m = P.get('pw:' + o.t, () => mPower(o.t)); m.position.set(x, 0, z); m.userData.icon.rotation.y = t * 2; m.userData.icon.position.y = 1.3 + Math.sin(t * 3) * .15; continue; }
      let m;
      if (o.t === 'car') {
        m = P.get('car:' + o.kind + ':' + o.color, () => mTraffic(o));
        const u = m.userData, on = (o.lc || o.haz) && blink;
        (u.blinkL || []).forEach(b => { b.visible = on && (o.haz || o.to < o.lane); });
        (u.blinkR || []).forEach(b => { b.visible = on && (o.haz || o.to > o.lane); });
        (u.tailGlow || []).forEach(s2 => { s2.material.opacity = o.brake || o.haz ? 1 : .3 + night * .4; s2.scale.setScalar((o.brake || o.haz ? .2 : .12) * (u.big ? 4 : 1)); });
        (u.headGlow || []).forEach(s2 => { s2.material.opacity = .12 + night * .88; });
        const wr = u.big ? .5 : (u.r || .074) * 3.9, ws = o.spd * ZS / wr * .016;
        (u.wheels || []).forEach(w => { if (u.big) w.rotation.x -= ws; else w.rotation.z -= ws; });
        if (u.siren) { u.siren[0].visible = blink; u.siren[1].visible = !blink; }
        if (u.beacon) u.beacon.visible = blink;
        m.rotation.set(0, o.lc && o.sig <= 0 ? (o.to - o.lane > 0 ? -1 : 1) * .1 : 0, 0);
      } else {
        m = P.get('ob:' + o.t, () => mObstacle(o.t));
        if (m.userData.blink) m.userData.blink.visible = blink;
        m.rotation.set(0, 0, 0);
      }
      m.position.set(x, 0, z);
      if (o.fly) { const f = o.fly; m.position.y = Math.max(0, f.vy * f.t - 9 * f.t * f.t); m.rotation.set(f.vr * f.t * .5, f.vr * f.t, f.vr * f.t * .7); }
    }
    P.end();
    /* jogador */
    const pl = R.player, pu = pl.userData;
    pl.position.set(px, 0, 0);
    pl.rotation.set(0, -R.lean * .45, 0);
    pu.chassis.rotation.x = R.lean * .06;
    if (G.boom) { const bt = G.boom.t; pl.rotation.y = G.boom.side * Math.min(2.4, bt * 5); pl.position.x += G.boom.side * Math.min(2, bt * 4); pl.position.y = Math.max(0, Math.sin(Math.min(1, bt * 2) * Math.PI) * .5); }
    else pu.wheels.forEach(w => { w.rotation.z -= G.v * ZS / (pu.r * 3.95) * .016; });
    pu.front.forEach(f => { f.rotation.y = (G.lane - G.px) * .35; });
    const chg = Math.abs(G.lane - G.px) > .08;
    pu.blinkL.forEach(b => { b.visible = chg && G.lane < G.px && blink; }); pu.blinkR.forEach(b => { b.visible = chg && G.lane > G.px && blink; });
    pu.headGlow.forEach(s2 => { s2.material.opacity = .15 + night * .85; }); pu.tailGlow.forEach(s2 => { s2.material.opacity = .3 + night * .4; });
    R.head.intensity = night * 70;
    R.shieldM.visible = !G.boom && (G.shield || G.shieldFx > 0);
    R.shieldM.position.set(px, .9, 0); R.shieldM.material.opacity = G.shield ? .3 + .14 * Math.sin(t * 6) : G.shieldFx * .8; R.shieldM.rotation.y = t * .6;
    R.starAura.visible = G.star > 0 && !G.boom; R.starAura.position.set(px, 1, 0); R.starAura.material.color.setHSL((t * .8) % 1, .9, .6); R.starAura.material.opacity = .45 + Math.sin(t * 12) * .15;
    pu.paint.emissive.setHSL((t * .8) % 1, .9, .4); pu.paint.emissiveIntensity = G.star > 0 ? .5 : 0;
    R.renderer.render(R.scene, R.cam);
    hud2D(G, ctx, W, H, api, kv);
  }

  /* HUD 2D: power-ups com tempo, linhas de velocidade, dica de toque */
  function hud2D(G, ctx, W, H, api, kv) {
    if (kv > .35 && !G.over) {
      ctx.strokeStyle = `rgba(255,255,255,${(kv - .35) * .3})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) { const a = (i * 2.4 + api.t * 9) % 1, sd = i % 2 ? 1 : -1, xx = W / 2 + sd * (W * .32 + a * W * .25), yy = H * .45 + a * H * .5; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + sd * 18, yy + 44); ctx.stroke(); }
    }
    const pw = [];
    if (G.shield) pw.push(['🛡️', 1, '#38bdf8']);
    if (G.star > 0) pw.push(['⭐', G.star / 6, '#facc15']);
    if (G.mag > 0) pw.push(['🧲', G.mag / 8, '#ef4444']);
    pw.forEach(([ic, k, col], i) => {
      const x = 30 + i * 48, y = H - 34;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x, y, 19, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, k)); ctx.stroke();
      ctx.font = '17px system-ui, "Segoe UI Emoji", "Apple Color Emoji"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(ic, x, y + 1);
    });
    if (G.time < 4 && !G.over) {
      ctx.font = "700 13px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const msg = 'Toca à esquerda ou à direita do carro (ou desliza)';
      const w = Math.min(W - 20, ctx.measureText(msg).width + 24);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; U.rr(ctx, W / 2 - w / 2, H - 78, w, 26, 13); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(msg, W / 2, H - 65, W - 30);
    }
  }

  function destroy(G) {
    const R = G.r3; if (!R) return;
    cur3 = null;
    Arcade3D.disposeOwn(R.scene);
    Arcade3D.detach(); G.r3 = null;
  }

  /* ── desenho 2D (sem WebGL) ── */
  const F2 = 7, LANE2 = 112;
  const scale = z => F2 / (Math.max(z, -F2 + .5) + F2);
  function rowY(api, z) { const hz = api.H * .34, by = api.H - 96; return hz + (by - hz) * scale(z); }
  function lane2x(api, G, l, z) { return api.W / 2 + (l - G.C) * LANE2 * (3 / G.N) * scale(z); }
  function draw(G, ctx, W, H, api) {
    if (G.r3) { draw3D(G, ctx, W, H, api); return; }
    cur3 = null;
    const hz = H * .34, bi = BIOMES[bioAt(G.dist)];
    const sky = ctx.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, bi.sky[0]); sky.addColorStop(1, bi.sky[1]); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = bi.ground; ctx.fillRect(0, hz, W, H - hz);
    const hw = z => LANE2 * 1.55 * scale(z), zF = ZMAX, zN = -2.5;
    ctx.fillStyle = '#3c3f45'; ctx.beginPath(); ctx.moveTo(W / 2 - hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + hw(zF), rowY(api, zF)); ctx.lineTo(W / 2 + hw(zN), rowY(api, zN)); ctx.lineTo(W / 2 - hw(zN), rowY(api, zN)); ctx.closePath(); ctx.fill();
    G.objs.filter(o => o.z > -3 && o.z < ZMAX).sort((a, b) => b.z - a.z).forEach(o => {
      const s = scale(o.z), x = lane2x(api, G, o.lane, o.z), y = rowY(api, o.z);
      ctx.fillStyle = o.t === 'coin' ? '#fbbf24' : o.t === 'car' ? o.color : o.t === 'shield' || o.t === 'star' || o.t === 'mag' ? '#22d3ee' : '#f97316';
      const w = (o.t === 'coin' ? 20 : 90) * s * (3 / G.N), h = (o.t === 'coin' ? 20 : 44) * s;
      ctx.fillRect(x - w / 2, y - h, w, h);
    });
    if (!G.boom) { const x = lane2x(api, G, G.px, 0), y = rowY(api, 0); ctx.fillStyle = '#c8102e'; U.rr(ctx, x - 40 * (3 / G.N), y - 40, 80 * (3 / G.N), 38, 10); ctx.fill(); }
    hud2D(G, ctx, W, H, api, (G.v - G.cfg.v0) / (G.cfg.vMax - G.cfg.v0));
  }

  /* ── controlos: toque/clique em relação ao carro (não ao meio do ecrã) ou deslizar; teclado ── */
  const carScreenX = (G, api) => P2(api, G, G.px, 0, 0)[0];
  return ArcadeKit.create({
    id: 'lane-rush', title: 'Faixa Rápida', icon: '🏎️',
    accent: '#ef4444', accent2: '#22d3ee', bg: '#0b1220', transparent: true, destroy,
    tagline: 'Do campo à cidade sem tirar o pé: foge às obras e ao trânsito numa estrada de 3, 4 ou 5 faixas.',
    view: { w: 400 },
    modes: [
      { id: '3', icon: '🛣️', name: '3 faixas', desc: 'A estrada clássica.' },
      { id: '4', icon: '🛣️', name: '4 faixas', desc: 'Mais espaço — e mais trânsito.' },
      { id: '5', icon: '🛣️', name: '5 faixas', desc: 'Autoestrada larga, cheia de carros.' },
    ],
    how: [
      '<b>Toca à esquerda ou à direita do carro</b> (ou desliza o dedo) para mudar de faixa. No teclado: ← →.',
      'A viagem começa no <b>campo</b>, passa por uma <b>vila</b>, entra na <b>cidade</b> ao pôr do sol e acaba na <b>metrópole</b> de noite.',
      'Foge às obras, aos fardos e ao trânsito: os carros com <b>pisca</b> vão mudar de faixa e os que têm os <b>quatro piscas</b> estão parados.',
      'Power-ups: 🛡️ <b>escudo</b> (aguenta uma batida), ⭐ <b>invencível</b> (6 s a passar por tudo) e 🧲 <b>íman</b> (puxa as moedas).',
    ],
    controls: ['👆 Tocar / deslizar', '🖱️ Clique esq./dir. do carro', '⌨️ ← →'],
    ready: { title: 'Toca para arrancar', hint: 'Toca de um lado ou do outro do carro para trocar de faixa.' },
    setup, update, draw,
    down: (G, x, y) => { G.sw = { x, y, done: false }; },
    move: (G, x, y, api, e, isDown) => {
      const s = G.sw; if (!s || s.done || !isDown) return;
      if (Math.abs(x - s.x) > 26 && Math.abs(x - s.x) > Math.abs(y - s.y)) { s.done = true; steer(G, x > s.x ? 1 : -1, api); }
    },
    up: (G, x, y, api) => { const s = G.sw; G.sw = null; if (!s || s.done) return; steer(G, s.x < carScreenX(G, api) ? -1 : 1, api); },
    key: (G, e, api) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steer(G, -1, api); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steer(G, 1, api); return true; }
    },
    hud: G => [['Pontos', G.score], ['km/h', Math.round(G.v * 6)], ['🪙', G.coins]],
    achievements: [
      { id: 'lr.1k',  name: 'Na Autoestrada', icon: '🏎️', desc: 'Percorre 1000 m na Faixa Rápida.', test: c => ((c.result.meta || {}).dist || 0) >= 1000 },
      { id: 'lr.3k',  name: 'Até à Cidade',   icon: '🌆', desc: 'Chega à cidade na Faixa Rápida (3000 m).', test: c => ((c.result.meta || {}).dist || 0) >= 3000 },
      { id: 'lr.500', name: 'Pé no Fundo',    icon: '🔥', desc: 'Faz 500 pontos na Faixa Rápida.', test: c => (c.result.score || 0) >= 500 },
      { id: 'lr.night', name: 'Luzes da Metrópole', icon: '🌃', desc: 'Chega à metrópole de noite na Faixa Rápida (4600 m).', test: c => ((c.result.meta || {}).dist || 0) >= 4600 },
    ],
  });
})();
