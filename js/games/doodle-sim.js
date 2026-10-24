/* ══════════════════════════════════════════════════════════════════
   Traço a Traço — motor (out/2026). Sem DOM nem canvas: corre também
   em Node, onde o verificador de níveis aplica as soluções.

   Física: planck.js (porta do Box2D, MIT, js/vendor/planck.min.js).
   Coordenadas dos níveis em px lógicos (480×720, y para baixo);
   o mundo físico usa metros (SC px = 1 m) com a gravidade para +y.

   Cada traço do jogador vira um corpo rígido: uma linha aberta é uma
   cadeia de caixas finas com círculos nas juntas; uma linha fechada é
   preenchida (triangulação por "ear clipping"). Pinos prendem peças
   ao fundo ou umas às outras; cordas ligam dois pontos com folga.
══════════════════════════════════════════════════════════════════ */
const DoodleSim = (function () {
  'use strict';
  const PL = () => (typeof planck !== 'undefined' ? planck : globalThis.planck);
  const SC = 30, DT = 1 / 60, VW = 480, VH = 720;
  const THICK = 8;          /* espessura do traço (px) */
  const DOT_R = 7;          /* um toque com o lápis = bolinha */
  const OUT = { x0: -80, x1: VW + 80, y1: VH + 60 };

  const MATS = {
    ink:    { d: 1,   f: .6,  r: .08 },
    ground: { d: 0,   f: .7,  r: .05 },
    wood:   { d: .7,  f: .6,  r: .08 },
    ice:    { d: .9,  f: .015, r: .02 },
    rubber: { d: 1,   f: .9,  r: .9 },
    metal:  { d: 3.5, f: .4,  r: .04 },
    ball:   { d: 1,   f: .5,  r: .25 },
    rock:   { d: 2.5, f: .6,  r: .05 },
    egg:    { d: .8,  f: .7,  r: .05 },
  };

  const v = (x, y) => ({ x: x / SC, y: y / SC });
  const px = p => [p.x * SC, p.y * SC];

  /* aleatório com semente (pedras que caem, variações do verificador) */
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5 >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }
  function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; }

  /* ── geometria ── */
  function area(P) { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function pathLen(P) { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return l; }
  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  /* Ramer–Douglas–Peucker */
  function simplify(P, eps) {
    if (P.length < 3) return P.slice();
    const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
    const st = [[0, P.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = segDist(P[i], P[a], P[b]); if (d > md) { md = d; mi = i; } }
      if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return P.filter((_, i) => keep[i]);
  }
  function inTri(p, a, b, c) {
    const s = (q, r, t) => (r[0] - q[0]) * (t[1] - q[1]) - (r[1] - q[1]) * (t[0] - q[0]);
    const d1 = s(a, b, p), d2 = s(b, c, p), d3 = s(c, a, p);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function segX(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function simple(P) {
    const n = P.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false;
    }
    return true;
  }
  /* triangulação por orelhas; devolve null se o polígono não for simples */
  function earclip(P0) {
    let P = P0.slice();
    if (area(P) < 0) P.reverse();
    const out = []; let guard = 0;
    while (P.length > 3 && guard++ < 5000) {
      let cut = false;
      for (let i = 0; i < P.length; i++) {
        const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length];
        const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (cr <= 1e-6) continue;
        let ok = true;
        for (const q of P) { if (q === a || q === b || q === c) continue; if (inTri(q, a, b, c)) { ok = false; break; } }
        if (!ok) continue;
        out.push([a, b, c]); P.splice(i, 1); cut = true; break;
      }
      if (!cut) return null;
    }
    if (P.length === 3) out.push(P);
    return out;
  }
  const triArea = t => Math.abs(area(t));

  /* ════════════════════════════════════════════════════════════════
     mundo
  ════════════════════════════════════════════════════════════════ */
  function create(L, opts) {
    opts = opts || {};
    const pl = PL();
    const w = new pl.World({ gravity: { x: 0, y: 10 } });
    const S = {
      L, w, pl, t: 0, started: false, won: false, lost: false, winT: 0, failWhy: '',
      items: [], pins: [], ropes: [], strokes: 0, ink: 0, inkMax: L.ink || 1000,
      pinsMax: L.pins || 0, ropesMax: L.ropes || 0,
      nodraw: [], stars: [], cups: [], gates: [], spawners: [], movers: [],
      ev: [], q: [], hold: 0, seed: (opts.seed || 0) + hashStr(L.id || 'x'), frame: 0,
    };
    S.rnd = rng(S.seed);
    S.ground = w.createBody();
    w.on('begin-contact', c => S.q.push(c));
    (L.objs || []).forEach(o => addObj(S, o));
    return S;
  }

  function fixDef(mat, extra) { const m = MATS[mat] || MATS.ground; return Object.assign({ density: m.d, friction: m.f, restitution: m.r }, extra || {}); }

  /* item = algo que se desenha e que tem um corpo (ou vários dados de desenho) */
  function item(S, o) { S.items.push(o); return o; }

  function boxShape(pl, cx, cy, w, h, a) { return new pl.Box(w / 2 / SC, h / 2 / SC, v(cx, cy), a || 0); }

  function addObj(S, o) {
    const pl = S.pl, w = S.w;
    switch (o.k) {
      case 'ground': {
        const tris = earclip(o.pts);
        (tris || []).forEach(t => { if (triArea(t) > 2) S.ground.createFixture(new pl.Polygon(t.map(p => v(p[0], p[1]))), fixDef(o.mat || 'ground', { userData: { it: null, mat: o.mat || 'ground' } })); });
        item(S, { k: 'ground', b: null, pts: o.pts, mat: o.mat || 'ground', static: true });
        break;
      }
      case 'rect': {   /* bloco fixo (x,y = centro) */
        const it = item(S, { k: 'rect', b: null, x: o.x, y: o.y, w: o.w, h: o.h, a: o.a || 0, mat: o.mat || 'ground', static: true });
        S.ground.createFixture(boxShape(pl, o.x, o.y, o.w, o.h, o.a), fixDef(it.mat, { userData: { it, mat: it.mat } }));
        break;
      }
      case 'spikes': { /* fila de picos com a base em y */
        const it = item(S, { k: 'spikes', b: null, x: o.x, y: o.y, w: o.w, dir: o.dir || 'up', static: true });
        const h = 14, cx = o.x + o.w / 2;
        const sh = it.dir === 'down' ? boxShape(pl, cx, o.y + h / 2, o.w, h) : boxShape(pl, cx, o.y - h / 2, o.w, h);
        S.ground.createFixture(sh, fixDef('ground', { userData: { it, kill: true } }));
        break;
      }
      case 'ball': case 'egg': case 'crate': case 'plank': {
        const egg = o.k === 'egg';
        const role = o.role || (egg ? 'egg' : o.k === 'ball' ? 'ball' : '');
        const mat = o.mat || (egg ? 'egg' : o.k === 'ball' ? 'ball' : 'wood');
        const b = w.createBody({ type: 'dynamic', position: v(o.x, o.y), angle: o.a || 0, bullet: o.k === 'ball' });
        const it = item(S, { k: o.k, b, role, mat, r: o.r || (egg ? 13 : 15), w: o.w, h: o.h, id: o.id });
        const ud = { it, mat };
        if (o.k === 'ball') b.createFixture(new pl.Circle(it.r / SC), fixDef(mat, { userData: ud }));
        else if (egg) {
          const P = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, ry = Math.sin(a) < 0 ? 17 : 13; P.push(v(Math.cos(a) * 12.5, Math.sin(a) * ry)); }
          b.createFixture(new pl.Polygon(P), fixDef(mat, { userData: ud }));
        } else b.createFixture(boxShape(pl, 0, 0, o.w, o.h), fixDef(mat, { userData: ud }));
        /* abas nas pontas da tábua (seguram o que está em cima até ao lançamento) */
        if (o.k === 'plank' && o.lip) { it.lip = o.lip; if (o.lip.includes('l')) b.createFixture(boxShape(pl, -o.w / 2 + 3, -o.h / 2 - 8, 6, 16), fixDef(mat, { userData: ud })); if (o.lip.includes('r')) b.createFixture(boxShape(pl, o.w / 2 - 3, -o.h / 2 - 8, 6, 16), fixDef(mat, { userData: ud })); }
        if (o.k === 'plank' && o.pivot) {
          it.pivot = o.pivot; it.post = o.post || 26;
          S.w.createJoint(new pl.RevoluteJoint({ collideConnected: true }, S.ground, b, v(o.pivot[0], o.pivot[1])));
        }
        if (o.fixed) b.setType('static');
        break;
      }
      case 'mover': {  /* plataforma que vai e vem (cinemática) */
        const b = w.createBody({ type: 'kinematic', position: v(o.x, o.y) });
        const it = item(S, { k: 'mover', b, w: o.w, h: o.h, x0: o.x, y0: o.y, dx: o.dx || 0, dy: o.dy || 0, per: o.per || 3, mat: o.mat || 'wood' });
        b.createFixture(boxShape(pl, 0, 0, o.w, o.h), fixDef(it.mat, { userData: { it, mat: it.mat } }));
        S.movers.push(it);
        break;
      }
      case 'star': S.stars.push(item(S, { k: 'star', x: o.x, y: o.y, r: o.r || 18, got: false })); break;
      case 'cup': {    /* copo em U: x = centro, y = fundo */
        const it = item(S, { k: 'cup', x: o.x, y: o.y, w: o.w || 90, h: o.h || 70, static: true });
        const t = 8, ww = it.w, hh = it.h;
        [[o.x - ww / 2 + t / 2, o.y - hh / 2, t, hh], [o.x + ww / 2 - t / 2, o.y - hh / 2, t, hh], [o.x, o.y - t / 2, ww, t]]
          .forEach(r => S.ground.createFixture(boxShape(pl, r[0], r[1], r[2], r[3]), fixDef('ground', { userData: { it, mat: 'ground' } })));
        it.inner = [o.x - ww / 2 + t, o.y - hh - 6, o.x + ww / 2 - t, o.y - t];
        S.cups.push(it);
        break;
      }
      case 'nodraw': S.nodraw.push(item(S, { k: 'nodraw', x: o.x, y: o.y, w: o.w, h: o.h })); break;
      case 'gate': {   /* porta fixa que abre quando algo pesa no botão */
        const it = item(S, { k: 'gate', x: o.x, y: o.y, w: o.w, h: o.h, btn: o.btn, open: 0, static: true });
        it.fix = S.ground.createFixture(boxShape(pl, o.x, o.y, o.w, o.h), fixDef('metal', { userData: { it, mat: 'metal' } }));
        const bw = o.btn.w || 44;
        it.sensor = S.ground.createFixture(boxShape(pl, o.btn.x, o.btn.y - 5, bw - 6, 10), { isSensor: true, userData: { it, button: true } });
        S.ground.createFixture(boxShape(pl, o.btn.x, o.btn.y + 2, bw, 4), fixDef('metal', { userData: { it: null, mat: 'metal' } }));
        S.gates.push(it);
        break;
      }
      case 'rocks': S.spawners.push(Object.assign({ done: false }, o)); break;
      case 'line': item(S, { k: 'line', y: o.y, label: o.label || '' }); break;
      case 'pin': addPin(S, o.x, o.y, true); break;
    }
  }

  /* ── consultas ── */
  function fixturesAt(S, x, y, r) {
    const out = [], p = v(x, y), rr = (r || 0) / SC;
    S.w.queryAABB({ lowerBound: { x: p.x - rr - .01, y: p.y - rr - .01 }, upperBound: { x: p.x + rr + .01, y: p.y + rr + .01 } }, f => {
      if (f.isSensor()) return true;
      const pts = rr ? [p, { x: p.x + rr, y: p.y }, { x: p.x - rr, y: p.y }, { x: p.x, y: p.y + rr }, { x: p.x, y: p.y - rr }] : [p];
      if (pts.some(q => f.testPoint(q))) out.push(f);
      return true;
    });
    return out;
  }
  /* pode-se desenhar neste ponto? (nada por baixo, fora das zonas proibidas) */
  function blocked(S, x, y) {
    if (x < 4 || x > VW - 4 || y < 4 || y > VH - 4) return 'edge';
    for (const z of S.nodraw) if (Math.abs(x - z.x) < z.w / 2 + THICK / 2 && Math.abs(y - z.y) < z.h / 2 + THICK / 2) return 'zone';
    if (fixturesAt(S, x, y, THICK / 2 + 1).length) return 'body';
    for (const st of S.stars) if (Math.hypot(x - st.x, y - st.y) < st.r) return 'star';
    return null;
  }
  const inkLeft = S => Math.max(0, S.inkMax - S.ink);

  /* ════════════════════════════════════════════════════════════════
     ações do jogador
  ════════════════════════════════════════════════════════════════ */
  /* traço → corpo. pts = [[x,y],…] já validados pelo jogo (sem colisões). */
  function addStroke(S, pts0, opts) {
    opts = opts || {};
    const pl = S.pl;
    if (!pts0 || !pts0.length) return null;
    let len = pathLen(pts0);
    if (len > inkLeft(S) + .5) return null;
    let pts = simplify(pts0, 1.2);
    let eps = 1.2; while (pts.length > 48) { eps *= 1.5; pts = simplify(pts0, eps); }
    const [ox, oy] = pts[0];
    const b = S.w.createBody({ type: 'dynamic', position: v(ox, oy), bullet: true });
    const it = item(S, { k: 'stroke', b, role: 'ink', mat: 'ink', col: opts.col != null ? opts.col : S.strokes, n: S.strokes });
    const ud = { it, mat: 'ink' };
    const local = pts.map(p => [p[0] - ox, p[1] - oy]);
    const closed = pts0.length > 6 && len > 70 && Math.hypot(pts0[0][0] - pts0[pts0.length - 1][0], pts0[0][1] - pts0[pts0.length - 1][1]) < 24;
    let filled = false;
    if (len < 6) {
      it.dot = DOT_R; len = 12;
      b.createFixture(new pl.Circle(DOT_R / SC), fixDef('ink', { userData: ud }));
    } else {
      if (closed) {
        let P = local.slice(); if (Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 24) P.pop();
        if (P.length >= 3 && Math.abs(area(P)) > 500 && simple(P)) {
          const tris = earclip(P);
          if (tris && tris.length) {
            tris.forEach(t => { if (triArea(t) > 3) b.createFixture(new pl.Polygon(t.map(p => v(p[0], p[1]))), fixDef('ink', { userData: ud })); });
            filled = true; it.poly = P;
          }
        }
      }
      if (!filled) {
        for (let i = 1; i < local.length; i++) {
          const a = local[i - 1], c = local[i], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (l < .5) continue;
          b.createFixture(boxShape(pl, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, l, THICK, Math.atan2(c[1] - a[1], c[0] - a[0])), fixDef('ink', { userData: ud }));
        }
        local.forEach(p => b.createFixture(new pl.Circle(v(p[0], p[1]), THICK / 2 / SC), fixDef('ink', { userData: ud })));
      }
      it.line = local;
    }
    S.ink += len; S.strokes++;
    /* pinos soltos por baixo do traço prendem-no ao fundo */
    S.pins.forEach(pn => {
      if (pn.free && hitsPoint(it, pn.x, pn.y)) { pn.joints++; pn.free = false; pn.on = it; pn.joint = S.w.createJoint(new pl.RevoluteJoint({ collideConnected: true }, S.ground, b, v(pn.x, pn.y))); }
    });
    S.ev.push({ t: 'stroke', it });
    return it;
  }
  function hitsPoint(it, x, y) {
    const b = it.b, p = b.getPosition(), a = b.getAngle(), c = Math.cos(-a), s = Math.sin(-a);
    const lx = (x / SC - p.x) * SC, ly = (y / SC - p.y) * SC, qx = lx * c - ly * s, qy = lx * s + ly * c;
    if (it.dot) return Math.hypot(qx, qy) <= it.dot + 2;
    if (it.poly) { let ins = false; const P = it.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > qy) !== (P[j][1] > qy) && qx < (P[j][0] - P[i][0]) * (qy - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) ins = !ins; if (ins) return true; }
    const P = it.line; for (let i = 1; i < P.length; i++) if (segDist([qx, qy], P[i - 1], P[i]) <= THICK / 2 + 3) return true;
    return P.length === 1 && Math.hypot(qx - P[0][0], qy - P[0][1]) <= THICK / 2 + 3;
  }
  function dynItemsAt(S, x, y) {
    const seen = new Set();
    fixturesAt(S, x, y, 3).forEach(f => { const it = f.getUserData() && f.getUserData().it; if (it && it.b && it.b.getType() === 'dynamic') seen.add(it); });
    return [...seen];
  }
  /* pino: prende peça(s) ao fundo / entre si, ou fica à espera de um traço */
  function addPin(S, x, y, pre) {
    if (!pre && S.pins.filter(p => !p.pre).length >= S.pinsMax) return null;
    const pl = S.pl;
    const its = dynItemsAt(S, x, y).filter(it => it.role !== 'hero' && it.role !== 'hero2' && it.role !== 'egg');
    const pn = { x, y, pre: !!pre, free: false, joints: 0, on: null };
    if (its.length >= 2) {
      pn.joint = S.w.createJoint(new pl.RevoluteJoint({}, its[its.length - 2].b, its[its.length - 1].b, v(x, y)));
      pn.on = its[its.length - 1]; pn.joints = 1; pn.link = true;
    } else if (its.length === 1) {
      pn.joint = S.w.createJoint(new pl.RevoluteJoint({ collideConnected: true }, S.ground, its[0].b, v(x, y)));
      pn.on = its[0]; pn.joints = 1;
    } else {
      if (fixturesAt(S, x, y, 0).length) return null;   /* em cima de uma bola, do chão… */
      pn.free = true;
    }
    if (pn.on) { const b = pn.on.b, p = b.getPosition(), a = b.getAngle(), c = Math.cos(-a), s = Math.sin(-a), lx = x - p.x * SC, ly = y - p.y * SC; pn.lx = lx * c - ly * s; pn.ly = lx * s + ly * c; }
    S.pins.push(pn);
    S.ev.push({ t: 'pin', pn });
    return pn;
  }
  /* um pino preso ao fundo não se mexe; um que une duas peças anda com elas */
  function pinPos(pn) {
    if (!pn.link || !pn.on || !pn.on.b) return [pn.x, pn.y];
    const b = pn.on.b, p = b.getPosition(), a = b.getAngle();
    return [p.x * SC + pn.lx * Math.cos(a) - pn.ly * Math.sin(a), p.y * SC + pn.lx * Math.sin(a) + pn.ly * Math.cos(a)];
  }
  /* o que o lápis consegue de facto desenhar: pontos a cada 4 px, pára no
     primeiro ponto bloqueado ou quando a tinta acaba (igual no jogo e nos testes) */
  function trace(S, pts) {
    const out = []; let ink = inkLeft(S), why = null;
    for (let i = 0; i < pts.length && !why; i++) {
      const p = pts[i], q = out.length ? out[out.length - 1] : null;
      const d = q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : 0, n = q ? Math.max(1, Math.ceil(d / 4)) : 1;
      for (let k = 1; k <= n; k++) {
        const x = q ? q[0] + (p[0] - q[0]) * k / n : p[0], y = q ? q[1] + (p[1] - q[1]) * k / n : p[1];
        const l = out.length ? Math.hypot(x - out[out.length - 1][0], y - out[out.length - 1][1]) : 0;
        if (l > ink) { why = 'ink'; break; }
        const bl = blocked(S, x, y); if (bl) { why = bl; break; }
        ink -= l; out.push([x, y]);
      }
    }
    return { pts: out, why };
  }
  /* corda entre dois pontos: cada ponta agarra o que lá estiver (ou fica pregada ao fundo) */
  function addRope(S, a, c) {
    if (S.ropes.length >= S.ropesMax) return null;
    const pl = S.pl, len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 20 || len > inkLeft(S) + .5) return null;
    const end = p => { const its = dynItemsAt(S, p[0], p[1]); return its.length ? its[its.length - 1] : null; };
    const A = end(a), B = end(c);
    if (!A && !B) return null;
    if (A && B && A === B) return null;
    const bA = A ? A.b : S.ground, bB = B ? B.b : S.ground;
    const j = S.w.createJoint(new pl.RopeJoint({ maxLength: len / SC, localAnchorA: bA.getLocalPoint(v(a[0], a[1])), localAnchorB: bB.getLocalPoint(v(c[0], c[1])), collideConnected: true }, bA, bB));
    const r = { j, A, B, len, a: a.slice(), c: c.slice() };
    S.ropes.push(r); S.ink += len; S.strokes++;
    S.ev.push({ t: 'rope', r });
    return r;
  }
  function ropeEnds(r) { const j = r.j; return [px(j.getAnchorA()), px(j.getAnchorB())]; }

  function start(S) { if (S.started) return; S.started = true; S.ev.push({ t: 'start' }); }

  /* ════════════════════════════════════════════════════════════════
     passo
  ════════════════════════════════════════════════════════════════ */
  function step(S) {
    if (!S.started || S.done) return;
    const pl = S.pl, L = S.L;
    S.t += DT; S.frame++;
    S.movers.forEach(m => {
      const k = Math.PI * 2 / m.per, ph = S.t * k;
      m.b.setLinearVelocity({ x: m.dx / SC * k * Math.cos(ph) / 2, y: m.dy / SC * k * Math.cos(ph) / 2 });
    });
    S.spawners.forEach(sp => {
      if (sp.done || S.t < (sp.t || 0)) return; sp.done = true;
      for (let i = 0; i < (sp.n || 4); i++) {
        const x = sp.x0 + (sp.x1 - sp.x0) * (sp.n > 1 ? i / (sp.n - 1) : .5) + (S.rnd() - .5) * 10, y = sp.y - S.rnd() * 60 - i * 26;
        const r = 9 + S.rnd() * 6, P = [];
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (.78 + S.rnd() * .3); P.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
        const b = S.w.createBody({ type: 'dynamic', position: v(x, y), angle: S.rnd() * 6, bullet: true });
        const it = item(S, { k: 'rock', b, role: 'rock', mat: 'rock', poly: P });
        b.createFixture(new pl.Polygon(P.map(p => v(p[0], p[1]))), fixDef('rock', { userData: { it, mat: 'rock' } }));
      }
      S.ev.push({ t: 'rocks' });
    });
    /* transformações antes do passo: o desenho interpola entre as duas */
    for (const it of S.items) if (it.b && !it.gone) { const p = it.b.getPosition(); it.p0 = [p.x * SC, p.y * SC, it.b.getAngle()]; }
    S.w.step(DT, 10, 4);

    /* contactos (registados durante o passo, tratados aqui) */
    const q = S.q; S.q = [];
    for (const c of q) {
      if (!c.isTouching || !c.isTouching()) continue;
      const fa = c.getFixtureA(), fb = c.getFixtureB(), ua = fa.getUserData() || {}, ub = fb.getUserData() || {};
      const ia = ua.it, ib = ub.it;
      const pair = (x, y) => (ia && ia.role === x && ib && ib.role === y) || (ia && ia.role === y && ib && ib.role === x);
      if (ua.button || ub.button) {
        const g = (ua.button ? ua : ub).it, other = ua.button ? fb : fa;
        if (!g.open && other.getBody().getType() === 'dynamic') { g.open = S.t; S.ev.push({ t: 'gate', g }); }
        continue;
      }
      if (ua.kill || ub.kill) {
        const o = ua.kill ? ib : ia;
        if (o && (o.role === 'hero' || o.role === 'hero2' || o.role === 'egg')) fail(S, o.role === 'egg' ? 'O ovo partiu-se nos picos!' : 'A bola rebentou nos picos!', o);
        continue;
      }
      if (L.goal === 'touch' && pair('hero', 'hero2')) win(S, { x: (ia.b.getPosition().x + ib.b.getPosition().x) / 2 * SC, y: (ia.b.getPosition().y + ib.b.getPosition().y) / 2 * SC });
      if (pair('egg', 'rock')) fail(S, 'Uma pedra acertou no ovo!', ia.role === 'egg' ? ia : ib);
    }
    /* portas: abrem devagar e saem do caminho */
    S.gates.forEach(g => { if (g.open && g.fix) { S.ground.destroyFixture(g.fix); g.fix = null; } });

    /* objetivos */
    const heroes = S.items.filter(it => it.role === 'hero' || it.role === 'hero2' || it.role === 'egg');
    if (!S.won && !S.lost) {
      if (L.goal === 'star') {
        for (const st of S.stars) {
          if (st.got) continue;
          for (const h of heroes) { const p = h.b.getPosition(); if (Math.hypot(p.x * SC - st.x, p.y * SC - st.y) < st.r + h.r) { st.got = true; S.ev.push({ t: 'star', st }); } }
        }
        if (S.stars.length && S.stars.every(s => s.got)) win(S, S.stars[S.stars.length - 1]);
      } else if (L.goal === 'cup') {
        const need = L.need || heroes.length || 1;
        let n = 0;
        S.cups.forEach(cp => { cp.n = 0; S.items.forEach(it => { if (!it.b || (it.role !== 'hero' && it.role !== 'ball')) return; const p = it.b.getPosition(), x = p.x * SC, y = p.y * SC; if (x > cp.inner[0] && x < cp.inner[2] && y > cp.inner[1] && y < cp.inner[3]) cp.n++; }); n += cp.n; });
        S.hold = n >= need ? S.hold + DT : 0;
        if (S.hold >= .8) win(S, S.cups[0] ? { x: S.cups[0].x, y: S.cups[0].y - S.cups[0].h / 2 } : null);
      } else if (L.goal === 'off') {
        const tg = S.items.filter(it => it.role === 'target');
        if (tg.length && tg.every(it => it.b.getPosition().y * SC > (L.offY || VH))) win(S, null);
      } else if (L.goal === 'protect') {
        if (S.t >= (L.hold || 6)) win(S, heroes[0] ? { x: heroes[0].b.getPosition().x * SC, y: heroes[0].b.getPosition().y * SC } : null);
      }
    }
    /* fora do ecrã */
    for (const it of S.items) {
      if (!it.b || it.gone) continue;
      const p = it.b.getPosition(), x = p.x * SC, y = p.y * SC;
      if (y > OUT.y1 || x < OUT.x0 || x > OUT.x1) {
        if (it.role === 'hero' || it.role === 'hero2' || it.role === 'egg') { if (!S.won) fail(S, it.role === 'egg' ? 'O ovo caiu!' : 'A bola caiu para fora!', it); }
        else if (it.role !== 'target' && y > OUT.y1 + 200) { S.w.destroyBody(it.b); it.gone = true; }
      }
    }
    if (S.won && S.t - S.winT > 1.2) S.done = true;
  }
  function win(S, at) { if (S.won || S.lost) return; S.won = true; S.winT = S.t; S.ev.push({ t: 'win', at }); }
  function fail(S, why, it) { if (S.won || S.lost) return; S.lost = true; S.failWhy = why; S.ev.push({ t: 'fail', why, it }); }

  /* tudo parado sem ganhar? (para sugerir recomeçar) */
  function settled(S) {
    let b = S.w.getBodyList();
    for (; b; b = b.getNext()) if (b.getType() === 'dynamic' && b.isAwake()) return false;
    return S.movers.length === 0;
  }

  function stars(S) {
    const par = S.L.par || [99, 1e9];
    return 1 + (S.strokes <= par[0] ? 1 : 0) + (S.ink <= par[1] ? 1 : 0);
  }

  /* aplica uma ação gravada (traço / pino / corda) — usada pelo desfazer e pelos testes */
  function apply(S, a) {
    if (a.d) { const tr = trace(S, a.d); return tr.pts.length ? addStroke(S, tr.pts) : null; }
    if (a.pin) return addPin(S, a.pin[0], a.pin[1]);
    if (a.rope) return addRope(S, a.rope[0], a.rope[1]);
    return null;
  }

  return { create, step, start, trace, addStroke, addPin, addRope, apply, blocked, inkLeft, settled, stars, pinPos, ropeEnds, hitsPoint, simplify, pathLen, earclip,
    SC, DT, VW, VH, THICK, DOT_R, MATS, rng };
})();
if (typeof module !== 'undefined') module.exports = DoodleSim;
