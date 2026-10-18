/* ══════════════════════════════════════════════════════════════════
   DripSim — motor do Gota a Gota (out/2026): água em partículas,
   terra escavável e as reações entre líquidos. Sem DOM nem canvas, para
   os níveis serem verificados em Node (node_modules/.drip-check.cjs).

   Líquido: partículas com "relaxação de densidade dupla" (Clavet et al.
   2005) — pressão normal + pressão "de perto" que dá tensão superficial e
   gotas redondas — e viscosidade por pares (a lava é espessa).

   Terreno: grelha fina (célula de 5 px) com três campos 0..1 — terra,
   pedra e musgo — mais as comportas. As partículas colidem com o campo
   interpolado (iso 0,5), por isso o contorno que se desenha é o mesmo
   que segura a água.

   Reações: água + lava → pedra + vapor · água + lodo → somem os dois ·
   lodo mata o musgo · água alimenta o musgo (que cresce) · vapor sobe e
   vira chuva nas nuvens frias · placas quentes fervem a água.
══════════════════════════════════════════════════════════════════ */
const DripSim = (function () {
  'use strict';
  const CELL = 20, SUB = 4, FS = CELL / SUB;       /* célula do mapa 20 px; grelha fina 5 px */
  const COLS = 24, ROWS = 36, TOP = 2;             /* as 2 primeiras linhas são a superfície (decoração) */
  const PW = COLS * CELL, PH = ROWS * CELL;
  const NX = COLS * SUB, NY = ROWS * SUB;
  const MAXP = 1800;
  const H = 11, H2 = H * H;                         /* raio de interação */
  const WATER = 0, POISON = 1, LAVA = 2, STEAM = 3;
  const TYPES = [
    { rho0: 2.1, k: .16, kn: .55, sig: .08, beta: .02, g: 1 },     /* água */
    { rho0: 2.1, k: .15, kn: .5,  sig: .35, beta: .05, g: 1 },     /* lodo (mais espesso) */
    { rho0: 2.2, k: .14, kn: .45, sig: 1.1, beta: .12, g: .85 },   /* lava (espessa) */
    { rho0: 1.0, k: .05, kn: .1,  sig: .05, beta: 0,   g: -.32 },  /* vapor (sobe) */
  ];
  const G = 980, DT = 1 / 120;

  function create(level) {
    const S = {
      level, t: 0, state: 'play', fill: 0, need: level.need || 60, dugCells: 0,
      dirt: new Float32Array(NX * NY), rock: new Float32Array(NX * NY), moss: new Float32Array(NX * NY), gate: new Float32Array(NX * NY),
      n: 0, x: new Float32Array(MAXP), y: new Float32Array(MAXP), vx: new Float32Array(MAXP), vy: new Float32Array(MAXP),
      px: new Float32Array(MAXP), py: new Float32Array(MAXP), ty: new Uint8Array(MAXP), life: new Float32Array(MAXP), dead: new Uint8Array(MAXP),
      pot: null, buds: [], switches: [], gates: [], valves: [], bombs: [], spouts: [], heaters: [], conds: [],
      ev: [], dirty: true, counts: [0, 0, 0, 0], lost: 0, failWhy: '',
    };
    /* aleatório com semente (o verificador repete o nível com sementes diferentes) */
    let sd = (level.rseed != null ? level.rseed : level.seed || 1) >>> 0;
    S.rnd = () => { sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    parse(S, level);
    return S;
  }

  /* ── mapa ASCII → campos + objetos ── */
  function parse(S, L) {
    const rows = L.map;
    const at = (cx, cy) => { const r = rows[cy - TOP]; return r ? (r[cx] || ' ') : ' '; };
    const fillCell = (arr, cx, cy, v) => { for (let j = 0; j < SUB; j++) for (let i = 0; i < SUB; i++) arr[(cy * SUB + j) * NX + cx * SUB + i] = v; };
    const gatesBy = {};
    for (let cy = TOP; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      const c = at(cx, cy), x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
      if (c === '#') fillCell(S.dirt, cx, cy, 1);
      else if (c === 'R') fillCell(S.rock, cx, cy, 1);
      else if (c === 'k') { fillCell(S.rock, cx, cy, 1); (S.crack = S.crack || new Set()).add(cy * COLS + cx); }
      else if (c === 'm') fillCell(S.moss, cx, cy, 1);
      else if (c === 'w' || c === 'p' || c === 'l') {
        const ty = c === 'w' ? WATER : c === 'p' ? POISON : LAVA;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) add(S, cx * CELL + 2.5 + i * 5 + (j % 2) * 1.2, cy * CELL + 2.5 + j * 5, ty);
      } else if (c === 'G') { if (!S.pot) S.pot = { cx, cy, x: cx * CELL, y: cy * CELL, w: CELL * 3, h: CELL * 2 }; }
      else if (c === 'F') S.buds.push({ x, y, r: 13, got: 0, need: 7, state: 'bud', t: 0 });
      else if (c === 'X') S.bombs.push({ x, y, r: 12, live: true, rad: 46 });
      else if (c === 'H') S.heaters.push({ x: cx * CELL, y: cy * CELL, w: CELL, h: CELL });
      else if (c === 'C') S.conds.push({ x: cx * CELL, y: cy * CELL, w: CELL, h: CELL });
      else if (c === 'O') S.spouts.push({ x, y, left: L.spout || 160, rate: 30, acc: 0, on: !L.spoutKey });
      else if (c >= 'a' && c <= 'c') S.switches.push({ x, y, r: 12, key: c.toUpperCase(), got: 0, need: L.swNeed || 8, on: false });
      else if (c >= 'A' && c <= 'C') { (gatesBy[c] = gatesBy[c] || []).push([cx, cy]); }
      else if (c === 'V') { (gatesBy.V = gatesBy.V || []).push([cx, cy]); }
    }
    /* comportas: um retângulo por grupo de células ligadas com a mesma letra */
    Object.keys(gatesBy).forEach(k => {
      const left = gatesBy[k].slice();
      while (left.length) {
        const cs = [left.pop()];
        for (let q = 0; q < cs.length; q++) for (let j = left.length - 1; j >= 0; j--) if (Math.abs(left[j][0] - cs[q][0]) + Math.abs(left[j][1] - cs[q][1]) === 1) cs.push(left.splice(j, 1)[0]);
        mkGate(k, cs);
      }
    });
    function mkGate(k, cs) {
      let x0 = 99, y0 = 99, x1 = -1, y1 = -1; cs.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const g = { key: k, cx0: x0, cy0: y0, cx1: x1, cy1: y1, open: 0, target: 0, valve: k === 'V', vert: (y1 - y0) >= (x1 - x0) };
      (g.valve ? S.valves : S.gates).push(g);
      setGate(S, g);
    }
    smooth(S.dirt, 1); roughen(S.rock, S.level.seed || 3); roughen(S.moss, (S.level.seed || 3) + 11);
    S.need = L.need || 60;
    if (!S.pot) S.pot = { cx: 10, cy: 33, x: 200, y: 660, w: 60, h: 40 };
  }
  /* bordas orgânicas */
  function smooth(a, n) {
    const t = new Float32Array(a.length);
    for (let k = 0; k < n; k++) {
      for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
        let s = 0, c = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= NX || yy >= NY) { s += a[y * NX + x]; c++; continue; } s += a[yy * NX + xx]; c++; }
        t[y * NX + x] = s / c;
      }
      a.set(t);
    }
  }
  /* pedra: bordas irregulares que só crescem PARA FORA — uma parede de 1 célula nunca fica com buracos */
  function roughen(a, seed) {
    const o = a.slice();
    smooth(a, 1);
    for (let i = 0; i < a.length; i++) {
      if (o[i] >= 1) { a[i] = 1; continue; }
      if (a[i] > 0) { const h = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; a[i] = Math.min(.9, Math.max(0, a[i] * 1.2 + ((h - Math.floor(h)) - .5) * .3)); }
    }
  }
  function setGate(S, g) {
    /* campo da comporta: aberta = recolhe a partir de uma ponta */
    const x0 = g.cx0 * SUB, x1 = (g.cx1 + 1) * SUB, y0 = g.cy0 * SUB, y1 = (g.cy1 + 1) * SUB;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const f = g.vert ? (y - y0) / (y1 - y0) : (x - x0) / (x1 - x0);
      S.gate[y * NX + x] = f >= g.open ? 1 : 0;
    }
    S.dirty = true;
  }

  function add(S, x, y, ty, vx, vy) {
    let i = -1;
    if (S.n < MAXP) i = S.n++;
    else { for (let k = 0; k < S.n; k++) if (S.dead[k]) { i = k; break; } if (i < 0) return -1; }
    S.x[i] = S.px[i] = x; S.y[i] = S.py[i] = y; S.vx[i] = vx || 0; S.vy[i] = vy || 0; S.ty[i] = ty; S.dead[i] = 0; S.life[i] = ty === STEAM ? 7 + S.rnd() * 3 : 0;
    return i;
  }
  function kill(S, i) { S.dead[i] = 1; }

  /* ── campo sólido (bilinear) ── */
  function cellV(S, gx, gy) {
    if (gx < 0 || gx >= NX) return 1;
    if (gy < 0) return 0;
    if (gy >= NY) return 1;
    const i = gy * NX + gx;
    const a = S.dirt[i], b = S.rock[i], c = S.moss[i], d = S.gate[i];
    return a > b ? (a > c ? (a > d ? a : d) : c > d ? c : d) : (b > c ? (b > d ? b : d) : c > d ? c : d);
  }
  function solid(S, x, y) {
    const fx = x / FS - .5, fy = y / FS - .5, gx = Math.floor(fx), gy = Math.floor(fy), tx = fx - gx, ty = fy - gy;
    const a = cellV(S, gx, gy), b = cellV(S, gx + 1, gy), c = cellV(S, gx, gy + 1), d = cellV(S, gx + 1, gy + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /* ── escavar: círculo com borda suave ── */
  function dig(S, x, y, r) {
    if (S.state !== 'play') return 0;
    const g0x = Math.max(0, Math.floor((x - r - FS) / FS)), g1x = Math.min(NX - 1, Math.ceil((x + r + FS) / FS));
    const g0y = Math.max(TOP * SUB, Math.floor((y - r - FS) / FS)), g1y = Math.min(NY - 1, Math.ceil((y + r + FS) / FS));
    let got = 0;
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const cx = (gx + .5) * FS, cy = (gy + .5) * FS, d = Math.hypot(cx - x, cy - y);
      const v = Math.min(1, Math.max(0, (d - r) / (FS * 1.4) + .5));
      const i = gy * NX + gx;
      if (S.dirt[i] > v) { got += S.dirt[i] - v; S.dirt[i] = v; }
    }
    if (got > 0) { S.dirty = true; S.dugCells += got; }
    return got;
  }
  /* pedra/terra nova (lava solidificada) */
  function deposit(S, x, y, r, arr) {
    const g0x = Math.max(0, Math.floor((x - r) / FS)), g1x = Math.min(NX - 1, Math.ceil((x + r) / FS));
    const g0y = Math.max(0, Math.floor((y - r) / FS)), g1y = Math.min(NY - 1, Math.ceil((y + r) / FS));
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      const d = Math.hypot((gx + .5) * FS - x, (gy + .5) * FS - y), v = Math.min(1, Math.max(0, 1.2 - d / r));
      const i = gy * NX + gx; if (arr[i] < v) arr[i] = v;
    }
    S.dirty = true;
  }

  /* ── toque: válvulas e bombas ── */
  function tap(S, x, y) {
    if (S.state !== 'play') return null;
    for (const b of S.bombs) if (b.live && Math.hypot(b.x - x, b.y - y) < 26) { boom(S, b); return { bomb: b }; }
    for (const v of S.valves) {
      const x0 = v.cx0 * CELL - 10, x1 = (v.cx1 + 1) * CELL + 10, y0 = v.cy0 * CELL - 10, y1 = (v.cy1 + 1) * CELL + 10;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) { v.target = v.target ? 0 : 1; S.ev.push({ t: 'valve', v }); return { valve: v }; }
    }
    return null;
  }
  function boom(S, b) {
    b.live = false;
    const R = b.rad;
    for (let gy = 0; gy < NY; gy++) for (let gx = 0; gx < NX; gx++) {
      const d = Math.hypot((gx + .5) * FS - b.x, (gy + .5) * FS - b.y); if (d > R + FS) continue;
      const v = Math.min(1, Math.max(0, (d - R) / (FS * 1.5) + .5)), i = gy * NX + gx;
      if (S.dirt[i] > v) S.dirt[i] = v;
      /* pedra rachada parte; pedra normal não */
      const cell = Math.floor(gy / SUB) * COLS + Math.floor(gx / SUB);
      if (S.crack && S.crack.has(cell) && S.rock[i] > v) S.rock[i] = v;
      if (S.moss[i] > v) S.moss[i] = v;
    }
    for (let i = 0; i < S.n; i++) { if (S.dead[i]) continue; const dx = S.x[i] - b.x, dy = S.y[i] - b.y, d = Math.hypot(dx, dy); if (d < R * 1.6 && d > 0) { const f = (1 - d / (R * 1.6)) * 520; S.vx[i] += dx / d * f; S.vy[i] += dy / d * f; } }
    S.dirty = true;
    S.ev.push({ t: 'boom', x: b.x, y: b.y, r: R });
  }

  /* ── vizinhança por grelha ── */
  const GS = H, GX = Math.ceil(PW / GS) + 1, GY = Math.ceil(PH / GS) + 1;
  const head = new Int32Array(GX * GY), next = new Int32Array(MAXP);
  const nbI = new Int32Array(MAXP * 40), nbQ = new Float32Array(MAXP * 40), nbC = new Int32Array(MAXP);
  function neighbours(S) {
    head.fill(-1);
    for (let i = 0; i < S.n; i++) { if (S.dead[i]) continue; const c = Math.min(GY - 1, Math.max(0, Math.floor(S.y[i] / GS))) * GX + Math.min(GX - 1, Math.max(0, Math.floor(S.x[i] / GS))); next[i] = head[c]; head[c] = i; }
    for (let i = 0; i < S.n; i++) {
      nbC[i] = 0; if (S.dead[i]) continue;
      const cx = Math.min(GX - 1, Math.max(0, Math.floor(S.x[i] / GS))), cy = Math.min(GY - 1, Math.max(0, Math.floor(S.y[i] / GS)));
      for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= GX || yy >= GY) continue;
        for (let j = head[yy * GX + xx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = S.x[j] - S.x[i], dy = S.y[j] - S.y[i], d2 = dx * dx + dy * dy;
          if (d2 < H2 && nbC[i] < 40) { const k = i * 40 + nbC[i]++; nbI[k] = j; nbQ[k] = 1 - Math.sqrt(d2) / H; }
        }
      }
    }
  }

  /* ── reações entre líquidos ── */
  function react(S, i, j, q) {
    const a = S.ty[i], b = S.ty[j];
    if (a === b || q < .3) return;
    const pair = (u, v) => (a === u && b === v) || (a === v && b === u);
    if (pair(WATER, LAVA)) {
      const w = a === WATER ? i : j, l = a === LAVA ? i : j;
      S.ty[w] = STEAM; S.life[w] = 6 + S.rnd() * 3; S.vy[w] = -120;
      deposit(S, S.x[l], S.y[l], 6.5, S.rock); kill(S, l);
      S.ev.push({ t: 'hiss', x: S.x[l], y: S.y[l] });
    } else if (pair(WATER, POISON)) {
      kill(S, i); kill(S, j); S.ev.push({ t: 'fizz', x: S.x[i], y: S.y[i] });
    } else if (pair(LAVA, POISON)) {
      const p = a === POISON ? i : j; S.ty[p] = STEAM; S.life[p] = 2; S.ev.push({ t: 'fizz', x: S.x[p], y: S.y[p] });
    }
  }

  function step(S) {
    S.t += DT;
    const n = S.n, X = S.x, Y = S.y, VX = S.vx, VY = S.vy, PX = S.px, PY = S.py, T = S.ty, DEAD = S.dead;
    /* torneiras */
    S.spouts.forEach(sp => {
      if (!sp.on || sp.left <= 0) return;
      sp.acc += DT * sp.rate;
      while (sp.acc >= 1 && sp.left > 0) { sp.acc -= 1; sp.left--; add(S, sp.x + (S.rnd() - .5) * 6, sp.y + 8, WATER, (S.rnd() - .5) * 20, 120); }
    });
    /* comportas a abrir/fechar */
    S.gates.concat(S.valves).forEach(g => { const tg = g.target; if (g.open !== tg) { g.open += Math.sign(tg - g.open) * Math.min(Math.abs(tg - g.open), DT * 2.2); setGate(S, g); } });
    /* gravidade + viscosidade por pares (com a vizinhança anterior) */
    for (let i = 0; i < n; i++) {
      if (DEAD[i]) continue;
      VY[i] += G * TYPES[T[i]].g * DT;
      if (T[i] === STEAM) { VX[i] += (S.rnd() - .5) * 60 * DT * 10; S.life[i] -= DT; if (S.life[i] <= 0) kill(S, i); }
    }
    neighbours(S);
    for (let i = 0; i < n; i++) {
      if (DEAD[i]) continue;
      const ti = TYPES[T[i]];
      for (let c = 0; c < nbC[i]; c++) {
        const k = i * 40 + c, j = nbI[k], q = nbQ[k];
        if (DEAD[j]) continue;
        if (T[i] !== T[j]) { react(S, i, j, q); if (DEAD[i]) break; continue; }
        const dx = X[j] - X[i], dy = Y[j] - Y[i], d = Math.hypot(dx, dy) || 1e-4, ux = dx / d, uy = dy / d;
        const u = (VX[i] - VX[j]) * ux + (VY[i] - VY[j]) * uy;
        /* o impulso viscoso nunca pode inverter a velocidade relativa (senão explode) */
        if (u > 0) { const I = Math.min(u * .45, q * (ti.sig * u + ti.beta * u * u) * .5); VX[i] -= I * ux; VY[i] -= I * uy; VX[j] += I * ux; VY[j] += I * uy; }
      }
    }
    /* avançar */
    for (let i = 0; i < n; i++) { if (DEAD[i]) continue; PX[i] = X[i]; PY[i] = Y[i]; X[i] += VX[i] * DT; Y[i] += VY[i] * DT; }
    /* relaxação de densidade dupla — reaproveita a vizinhança (recalcula só as distâncias) */
    const rho = S._rho || (S._rho = new Float32Array(MAXP)), rhoN = S._rhoN || (S._rhoN = new Float32Array(MAXP));
    rho.fill(0, 0, n); rhoN.fill(0, 0, n);
    for (let i = 0; i < n; i++) {
      if (DEAD[i]) continue;
      for (let c = 0; c < nbC[i]; c++) {
        const k = i * 40 + c, j = nbI[k]; if (DEAD[j]) { nbQ[k] = 0; continue; }
        const ddx = X[j] - X[i], ddy = Y[j] - Y[i], d2 = ddx * ddx + ddy * ddy;
        const q = d2 < H2 ? 1 - Math.sqrt(d2) / H : 0; nbQ[k] = q; if (q <= 0) continue;
        const w = T[i] === T[j] ? 1 : .6, q2 = q * q * w, q3 = q2 * q;
        rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
      }
    }
    for (let i = 0; i < n; i++) {
      if (DEAD[i]) continue;
      const ti = TYPES[T[i]];
      const P = ti.k * (rho[i] - ti.rho0), Pn = ti.kn * rhoN[i];
      for (let c = 0; c < nbC[i]; c++) {
        const k = i * 40 + c, j = nbI[k], q = nbQ[k]; if (q <= 0 || DEAD[j]) continue;
        const dx = X[j] - X[i], dy = Y[j] - Y[i], d = Math.hypot(dx, dy) || 1e-4;
        const D = (P * q + Pn * q * q) * H * .5;
        const mx = dx / d * D * .5, my = dy / d * D * .5;
        X[j] += mx; Y[j] += my; X[i] -= mx; Y[i] -= my;
      }
    }
    /* colisão com o terreno */
    for (let i = 0; i < n; i++) {
      if (DEAD[i]) continue;
      if (!(X[i] === X[i]) || !(Y[i] === Y[i]) || !isFinite(X[i] + Y[i])) { kill(S, i); continue; }
      if (X[i] < 3) X[i] = 3; if (X[i] > PW - 3) X[i] = PW - 3;
      if (Y[i] > PH - 3) Y[i] = PH - 3;
      if (Y[i] < TOP * CELL + 2 && T[i] === STEAM) { Y[i] = TOP * CELL + 2; }
      for (let it = 0; it < 3; it++) {
        const f = solid(S, X[i], Y[i]);
        if (f <= .5) break;
        const e = 1.6, gx = solid(S, X[i] + e, Y[i]) - solid(S, X[i] - e, Y[i]), gy = solid(S, X[i], Y[i] + e) - solid(S, X[i], Y[i] - e);
        const gl = Math.hypot(gx, gy);
        if (gl < 1e-5) { X[i] = PX[i]; Y[i] = PY[i]; break; }
        const push = Math.min(6, (f - .5) / (gl / (2 * e)) + .15);
        X[i] -= gx / gl * push; Y[i] -= gy / gl * push;
      }
      /* velocidade a partir da posição; atrito ao tocar no chão */
      let vx = (X[i] - PX[i]) / DT, vy = (Y[i] - PY[i]) / DT;
      const sp = Math.hypot(vx, vy), cap = 900;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      VX[i] = vx; VY[i] = vy;
    }
    interact(S);
    /* musgo cresce devagar quando bebe; e arde se lhe pegaram fogo */
    if (S.mossGrow > 0) growMoss(S);
    burnStep(S);
    S.counts = [0, 0, 0, 0];
    for (let i = 0; i < S.n; i++) if (!DEAD[i]) S.counts[T[i]]++;
    /* fim? */
    if (S.state === 'play') {
      if (S.fill >= S.need) { S.state = 'win'; S.ev.push({ t: 'win' }); }
      else {
        const avail = S.counts[WATER] + S.counts[STEAM] * (S.conds.length ? .8 : 0) + S.spouts.reduce((s, sp) => s + sp.left, 0);
        if (avail + S.fill < S.need) { S.hopeless = (S.hopeless || 0) + DT; if (S.hopeless > 1.6) { S.state = 'fail'; S.failWhy = 'Ficaste sem água suficiente.'; S.ev.push({ t: 'fail', why: 'dry' }); } }
        else S.hopeless = 0;
      }
    }
  }

  /* ── objetos: vaso, turbinas, interruptores, placas, nuvens, musgo ── */
  function interact(S) {
    const pot = S.pot;
    S.mossCap = Math.min(6, (S.mossCap || 0) + DT * 18);
    for (let i = 0; i < S.n; i++) {
      if (S.dead[i]) continue;
      const x = S.x[i], y = S.y[i], t = S.ty[i];
      /* boca do vaso: a parte de cima do retângulo */
      if (pot && x > pot.x + 4 && x < pot.x + pot.w - 4 && y > pot.y + 2 && y < pot.y + pot.h) {
        if (t === WATER) { S.fill++; kill(S, i); S.ev.push({ t: 'drink', x, y }); continue; }
        if ((t === POISON || t === LAVA) && S.state === 'play') { S.state = 'fail'; S.failWhy = t === POISON ? 'O lodo chegou ao Rebento!' : 'A lava chegou ao Rebento!'; S.ev.push({ t: 'fail', why: t === POISON ? 'poison' : 'lava' }); kill(S, i); continue; }
      }
      for (const b of S.buds) {
        if (b.state !== 'bud') continue;
        const dx = x - b.x, dy = y - b.y; if (dx * dx + dy * dy > (b.r + 3) * (b.r + 3)) continue;
        if (t === WATER) { b.got++; kill(S, i); b.t = .25; if (b.got >= b.need) { b.state = 'bloom'; S.ev.push({ t: 'bloom', b }); } else S.ev.push({ t: 'sip', b }); }
        else if (t === POISON || t === LAVA) { b.state = 'dead'; S.ev.push({ t: 'wilt', b }); if (t === POISON) kill(S, i); }
        break;
      }
      if (S.dead[i]) continue;
      for (const sw of S.switches) {
        if (sw.on) continue;
        const dx = x - sw.x, dy = y - sw.y; if (dx * dx + dy * dy > (sw.r + 3) * (sw.r + 3)) continue;
        if (t === WATER || t === POISON) { sw.got++; kill(S, i); if (sw.got >= sw.need) { sw.on = true; S.gates.forEach(g => { if (g.key === sw.key) g.target = 1; }); S.spouts.forEach(sp => { if (S.level.spoutKey === sw.key) sp.on = true; }); S.ev.push({ t: 'switch', sw }); } }
        break;
      }
      if (S.dead[i]) continue;
      if (t === WATER) for (const h of S.heaters) if (x > h.x - 2 && x < h.x + h.w + 2 && y > h.y - 6 && y < h.y + h.h) { S.ty[i] = STEAM; S.life[i] = 8 + S.rnd() * 3; S.vy[i] = -160; S.ev.push({ t: 'boil', x, y }); break; }
      if (t === STEAM) for (const c of S.conds) if (x > c.x - 4 && x < c.x + c.w + 4 && y > c.y - 4 && y < c.y + c.h + 8) { S.ty[i] = WATER; S.vy[i] = 60; S.ev.push({ t: 'rain', x, y }); break; }
      /* musgo: a água é bebida (e o musgo cresce), o lodo mata-o, a lava queima-o */
      if (t !== STEAM) {
        const gx = Math.floor(x / FS), gy = Math.floor(y / FS);
        let hit = -1;
        for (let j = -1; j <= 1 && hit < 0; j++) for (let k = -1; k <= 1; k++) { const xx = gx + k, yy = gy + j; if (xx < 0 || yy < 0 || xx >= NX || yy >= NY) continue; if (S.moss[yy * NX + xx] > .45) { hit = yy * NX + xx; break; } }
        if (hit >= 0) {
          /* o musgo bebe até ~18 gotas por segundo (o resto escorre por ele) */
          if (t === WATER) { if (S.mossCap >= 1) { S.mossCap--; kill(S, i); S.mossGrow = Math.min(6, (S.mossGrow || 0) + .35); S.mossAt = hit; S.ev.push({ t: 'slurp', x, y }); } }
          else if (t === LAVA) ignite(S, hit);
          else { clearMoss(S, hit % NX, Math.floor(hit / NX), 5); S.ev.push({ t: 'burn', x, y }); }
        }
      }
    }
  }
  /* fogo: a lava pega fogo ao musgo e as chamas alastram por toda a mancha */
  function ignite(S, i) {
    if (!S.burning) S.burning = new Map();
    if (!S.burning.has(i) && S.moss[i] > .45) { S.burning.set(i, .35 + S.rnd() * .25); if (S.rnd() < .3) S.ev.push({ t: 'fire', x: (i % NX + .5) * FS, y: (Math.floor(i / NX) + .5) * FS }); }
  }
  function burnStep(S) {
    if (!S.burning || !S.burning.size) return;
    const add = [];
    S.burning.forEach((tm, i) => {
      const left = tm - DT;
      if (left <= 0) { S.moss[i] = 0; S.burning.delete(i); S.dirty = true; return; }
      S.burning.set(i, left);
      if (S.rnd() < DT * 9) { const x = i % NX, y = Math.floor(i / NX); [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].forEach(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < NX && yy < NY) add.push(yy * NX + xx); }); }
    });
    add.forEach(k => ignite(S, k));
  }
  function clearMoss(S, gx, gy, r) {
    for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) { const xx = gx + k, yy = gy + j; if (xx < 0 || yy < 0 || xx >= NX || yy >= NY) continue; if (k * k + j * j <= r * r) S.moss[yy * NX + xx] = 0; }
    S.dirty = true;
  }
  function growMoss(S) {
    /* cada gota bebida faz crescer (devagar) uma célula vizinha vazia ao acaso */
    let tries = 0;
    while (S.mossGrow >= 1 && tries++ < 3) {
      const i = S.mossAt, x = i % NX, y = Math.floor(i / NX);
      const dx = Math.floor(S.rnd() * 5) - 2, dy = Math.floor(S.rnd() * 5) - 2, xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < TOP * SUB || xx >= NX || yy >= NY) continue;
      const k = yy * NX + xx;
      if (S.moss[k] < 1 && cellV(S, xx, yy) < .5) { S.moss[k] = 1; S.mossGrow -= 1; S.mossAt = k; S.dirty = true; break; }
      else if (S.moss[k] > .5) S.mossAt = k;
    }
    S.mossGrow = Math.max(0, S.mossGrow - DT * .2);
  }

  return { create, step, dig, tap, solid, CELL, SUB, FS, COLS, ROWS, TOP, PW, PH, NX, NY, WATER, POISON, LAVA, STEAM, DT, H };
})();
if (typeof module !== 'undefined') module.exports = DripSim;
