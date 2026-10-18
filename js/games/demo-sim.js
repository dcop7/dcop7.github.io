/* ══════════════════════════════════════════════════════════════════
   DemoSim — núcleo da Implosão (out/2026): física, cargas, estilhaçar
   e avaliação. Não toca no three.js nem no DOM, para os níveis poderem
   ser verificados em Node (node_modules/.demo-check.cjs).

   Peças: cada bloco do nível é um corpo rígido do Rapier (caixa, cilindro
   ou cunha). Ao acumular dano (explosão ou impacto) parte-se em pedaços
   convexos — o poliedro é cortado por planos ao acaso e cada pedaço
   passa a ser um corpo novo com colisor convexo. Pedaços muito pequenos
   já não têm física: saem como "migalhas" para o desenho.

   Resistência: os blocos aguentam o próprio peso e o que têm em cima
   porque, ao construir, a física corre uns passos e cada peça regista a
   força estática máxima que sentiu — a resistência é o maior de
   (força estática × margem) e (peso × g's do material). Assim um pilar
   do rés-do-chão de um prédio alto não se parte sozinho, mas um piso a
   cair em cima dele parte.
══════════════════════════════════════════════════════════════════ */
const DemoSim = (function () {
  'use strict';

  /* materiais: densidade (t/m³), tenacidade (dano ÷), atrito, g's que aguenta,
     n.º de pedaços por m³, pedaços mín./máx. */
  const MATS = {
    brick:    { name: 'Tijolo',  rho: 1.9, tough: 1.0, fr: .8, g: 9,  per: 5,  kmin: 3, kmax: 8 },
    concrete: { name: 'Betão',   rho: 2.4, tough: 1.5, fr: .8, g: 11, per: 4,  kmin: 3, kmax: 9 },
    facade:   { name: 'Fachada', rho: 1.6, tough: .8,  fr: .7, g: 8,  per: 5,  kmin: 3, kmax: 8 },
    plaster:  { name: 'Reboco',  rho: 1.6, tough: .8,  fr: .7, g: 8,  per: 5,  kmin: 3, kmax: 7 },
    wood:     { name: 'Madeira', rho: .7,  tough: .6,  fr: .7, g: 9,  per: 3,  kmin: 2, kmax: 5, grain: true },
    glass:    { name: 'Vidro',   rho: 2.5, tough: .12, fr: .4, g: 3,  per: 40, kmin: 6, kmax: 12, shard: true, crumbAll: true },
    steel:    { name: 'Aço',     rho: 3.8, tough: 99,  fr: .55, g: 40, per: 2, kmin: 2, kmax: 3, cutTough: 1.1 },
    stone:    { name: 'Pedra',   rho: 2.6, tough: 2.0, fr: .9, g: 12, per: 4,  kmin: 3, kmax: 8 },
    roof:     { name: 'Telhado', rho: 1.4, tough: .7,  fr: .7, g: 8,  per: 5,  kmin: 3, kmax: 7 },
    metal:    { name: 'Chapa',   rho: 1.2, tough: 2.5, fr: .5, g: 20, per: 3,  kmin: 2, kmax: 4 },
  };

  /* cargas: r = raio (m), P = potência, push = empurrão, cut = dano extra no bloco onde está */
  const CHARGES = {
    pet: { name: 'Petardo',        cost: 100, r: 1.7, P: 1.0, push: .8 },
    din: { name: 'Dinamite',       cost: 250, r: 2.7, P: 1.7, push: 1.1 },
    cut: { name: 'Carga de corte', cost: 350, r: 1.1, P: .6,  push: .5, cut: 5 },
    imp: { name: 'Impulso',        cost: 200, r: 2.4, P: 0,   push: 2, dir: true },
    tnt: { name: 'Barril TNT',     cost: 700, r: 4.6, P: 2.8, push: 1.6 },
  };

  const TUNE = { imp: 1, g: 1.3, st: 2.5 };
  const MINV = .006;          /* m³: abaixo disto um pedaço é migalha (sem física) */
  const MAXB = 1150;          /* teto de corpos */
  const DT = 1 / 60;

  /* PRNG determinístico (os níveis têm de dar sempre o mesmo resultado) */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ── vetores/quaterniões mínimos ── */
  const v3 = (x, y, z) => ({ x, y, z });
  function qrot(q, v) {   /* roda v por q */
    const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z,
      iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
    return v3(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x);
  }
  const qinv = q => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
  const qyaw = a => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });

  /* ════════════════════════════════════════════════════════════════
     poliedros convexos (lista de faces com vértices em ordem CCW vista
     de fora) e corte por planos
  ════════════════════════════════════════════════════════════════ */
  function boxPoly(sx, sy, sz) {
    const x = sx / 2, y = sy / 2, z = sz / 2;
    const P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]];
    return F.map(f => ({ v: f.map(i => P[i].slice()), inner: 0 }));
  }
  /* cilindro de eixo y com n lados */
  function cylPoly(r, h, n) {
    n = n || 14; const y = h / 2, top = [], bot = [], faces = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; top.push([Math.cos(a) * r, y, -Math.sin(a) * r]); bot.push([Math.cos(a) * r, -y, -Math.sin(a) * r]); }
    faces.push({ v: top.map(p => p.slice()), inner: 0 });
    faces.push({ v: bot.slice().reverse().map(p => p.slice()), inner: 0 });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ v: [bot[i].slice(), bot[j].slice(), top[j].slice(), top[i].slice()], inner: 0 }); }
    return faces;
  }
  /* cunha (telhado): secção triangular em x/y, comprimento em z; cumeeira em cima */
  function wedgePoly(sx, sy, sz) {
    const x = sx / 2, y = sy / 2, z = sz / 2;
    const A = [-x, -y, -z], B = [x, -y, -z], C = [0, y, -z], D = [-x, -y, z], E = [x, -y, z], F = [0, y, z];
    return [
      { v: [A, C, B], inner: 0 }, { v: [D, E, F], inner: 0 },
      { v: [A, B, E, D], inner: 0 }, { v: [A, D, F, C], inner: 0 }, { v: [B, C, F, E], inner: 0 },
    ].map(f => ({ v: f.v.map(p => p.slice()), inner: 0 }));
  }

  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /* fica com o lado dot(n,p) <= d e fecha o corte com uma face "interior" */
  function clip(poly, n, d) {
    const out = [], cap = [];
    for (const f of poly) {
      const vs = f.v, res = [];
      for (let i = 0; i < vs.length; i++) {
        const a = vs[i], b = vs[(i + 1) % vs.length];
        const da = dot3(n, a) - d, db = dot3(n, b) - d;
        if (da <= 0) res.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          res.push(p); cap.push(p);
        }
      }
      if (res.length >= 3) out.push({ v: res, inner: f.inner });
    }
    if (cap.length >= 3) {
      /* pontos únicos, ordenados à volta do centro no plano do corte */
      const u = [];
      cap.forEach(p => { if (!u.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-6)) u.push(p); });
      if (u.length >= 3) {
        const c = [0, 0, 0]; u.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); c[0] /= u.length; c[1] /= u.length; c[2] /= u.length;
        const ax = Math.abs(n[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
        const t1 = norm(cross(n, ax)), t2 = cross(n, t1);
        u.sort((p, q) => Math.atan2(dot3(sub(p, c), t2), dot3(sub(p, c), t1)) - Math.atan2(dot3(sub(q, c), t2), dot3(sub(q, c), t1)));
        out.push({ v: u, inner: 1 });   /* CCW à volta de +n = normal para fora do lado que fica */
      }
    }
    return out;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function polyVerts(poly) {
    const u = [];
    poly.forEach(f => f.v.forEach(p => { if (!u.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-5)) u.push(p); }));
    return u;
  }
  /* volume e centroide (tetraedros a partir de um ponto interior) */
  function polyMass(poly) {
    const vs = polyVerts(poly); if (vs.length < 4) return { vol: 0, c: [0, 0, 0] };
    const o = [0, 0, 0]; vs.forEach(p => { o[0] += p[0]; o[1] += p[1]; o[2] += p[2]; }); o[0] /= vs.length; o[1] /= vs.length; o[2] /= vs.length;
    let V = 0; const c = [0, 0, 0];
    poly.forEach(f => {
      for (let i = 1; i < f.v.length - 1; i++) {
        const a = f.v[0], b = f.v[i], d = f.v[i + 1];
        const v = Math.abs(dot3(sub(a, o), cross(sub(b, o), sub(d, o)))) / 6;
        V += v; for (let k = 0; k < 3; k++) c[k] += v * (o[k] + a[k] + b[k] + d[k]) / 4;
      }
    });
    if (V > 0) { c[0] /= V; c[1] /= V; c[2] /= V; }
    return { vol: V, c };
  }
  function polyExtent(poly) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    poly.forEach(f => f.v.forEach(p => { for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } }));
    return { mn, mx, sz: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
  }

  /* parte um poliedro em k pedaços; o ponto de impacto (local) puxa cortes para perto */
  function fracture(poly, k, rnd, mat, hit) {
    let parts = [poly];
    let guard = 0;
    while (parts.length < k && guard++ < k * 4) {
      /* corta sempre o maior */
      let bi = 0, bv = -1, bm = null;
      parts.forEach((p, i) => { const m = polyMass(p); if (m.vol > bv) { bv = m.vol; bi = i; bm = m; } });
      const p = parts[bi], ex = polyExtent(p);
      /* normal: preferir cortar o eixo mais comprido (madeira: só de través) */
      const w = ex.sz.map(s => Math.pow(s, mat.grain ? 4 : 2) + .02);
      const ws = w[0] + w[1] + w[2];
      let n = [(rnd() - .5) * .8, (rnd() - .5) * .8, (rnd() - .5) * .8];
      let r = rnd() * ws, ax = r < w[0] ? 0 : r < w[0] + w[1] ? 1 : 2;
      n[ax] += rnd() < .5 ? 1.6 : -1.6;
      n = norm(n);
      let c = bm.c.slice();
      if (hit && rnd() < .5) for (let q = 0; q < 3; q++) c[q] += (hit[q] - c[q]) * .35;
      for (let q = 0; q < 3; q++) c[q] += (rnd() - .5) * ex.sz[q] * .3;
      const d = dot3(n, c);
      const A = clip(p, n, d), B = clip(p, n.map(x => -x), -d);
      const ma = polyMass(A).vol, mb = polyMass(B).vol;
      if (ma < bv * .06 || mb < bv * .06) continue;   /* lascas finíssimas: tenta outro corte */
      parts.splice(bi, 1, A, B);
    }
    return parts;
  }

  /* ════════════════════════════════════════════════════════════════
     simulação
  ════════════════════════════════════════════════════════════════ */
  function create(R, level, opts) {
    opts = opts || {};
    const world = new R.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = DT;
    try { world.integrationParameters.numSolverIterations = 6; } catch (e) {}
    const evq = new R.EventQueue(true);
    const rnd = rng(level.seed || 7);
    const S = {
      R, world, level, pieces: [], byCol: new Map(), charges: [], ev: [], t: 0, phase: 'plan',
      tBoom: 0, settleT: 0, lastBoomT: 0, V0: 0, lineY: level.line, nBodies: 0, crumbs: 0, groundY: 0, spent: 0,
    };

    /* chão (+ desníveis/obstáculos estáticos que o nível pedir) */
    if (!level.river) S.groundCol = world.createCollider(R.ColliderDesc.cuboid(400, .5, 400).setTranslation(0, -.5, 0).setFriction(.9)).handle;
    else S.groundCol = world.createCollider(R.ColliderDesc.cuboid(400, .5, 400).setTranslation(0, -level.river.depth - .5, 0).setFriction(.9)).handle;
    (level.statics || []).forEach(s => {
      const cd = R.ColliderDesc.cuboid(s.size[0] / 2, s.size[1] / 2, s.size[2] / 2).setTranslation(s.pos[0], s.pos[1], s.pos[2]).setFriction(.9);
      if (s.rotY) cd.setRotation(qyaw(s.rotY));
      world.createCollider(cd);
    });

    function colliderFor(p) {
      const m = MATS[p.mat];
      let cd;
      if (p.kind === 'block' && p.shape === 'box') cd = R.ColliderDesc.cuboid(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2);
      else if (p.kind === 'block' && p.shape === 'cyl') cd = R.ColliderDesc.cylinder(p.size[1] / 2, p.size[0] / 2);
      else {
        const vs = polyVerts(p.poly), arr = new Float32Array(vs.length * 3);
        vs.forEach((q, i) => { arr[i * 3] = q[0] - p.c[0]; arr[i * 3 + 1] = q[1] - p.c[1]; arr[i * 3 + 2] = q[2] - p.c[2]; });
        cd = R.ColliderDesc.convexHull(arr);
        if (!cd) { const e = polyExtent(p.poly); cd = R.ColliderDesc.cuboid(Math.max(.02, e.sz[0] / 2), Math.max(.02, e.sz[1] / 2), Math.max(.02, e.sz[2] / 2)); }
      }
      cd.setDensity(m.rho).setFriction(m.fr).setRestitution(.05);
      cd.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS);
      cd.setContactForceEventThreshold(opts.calib ? 0 : p.str || 1e9);
      return cd;
    }

    function addBody(p, pos, rot, lin, ang, sleeping) {
      const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(rot);
      if (lin) bd.setLinvel(lin.x, lin.y, lin.z);
      if (ang) bd.setAngvel(ang);
      if (sleeping) bd.setSleeping(true);
      p.body = world.createRigidBody(bd);
      p.col = world.createCollider(colliderFor(p), p.body);
      p.mass = p.body.mass();
      S.byCol.set(p.col.handle, p);
      S.nBodies++;
    }

    /* ── construir o nível ── */
    level.blocks.forEach((b, i) => {
      const shape = b.shape || 'box';
      const size = b.size;
      let vol = shape === 'box' ? size[0] * size[1] * size[2] : shape === 'cyl' ? Math.PI * (size[0] / 2) * (size[0] / 2) * size[1] : size[0] * size[1] * size[2] / 2;
      const p = {
        id: i, kind: 'block', shape, size, mat: b.mat, part: b.part || 's', grp: b.grp, tint: b.tint, vol, dmg: 0, gen: 0,
        alive: true, c: [0, 0, 0], poly: null, origin: i, pos0: v3(b.pos[0], b.pos[1], b.pos[2]),
      };
      if (shape === 'wedge') p.poly = wedgePoly(size[0], size[1], size[2]);
      if (p.part === 's') S.V0 += vol;
      S.pieces.push(p);
      addBody(p, p.pos0, b.rotY ? qyaw(b.rotY) : { x: 0, y: 0, z: 0, w: 1 }, null, null, false);
    });

    /* ── calibrar resistências: uns passos com eventos para medir o peso que cada peça aguenta ── */
    function calibrate() {
      const stat = new Map();
      world.forEachCollider(c => { const p = S.byCol.get(c.handle); if (p) c.setContactForceEventThreshold(0); });
      for (let i = 0; i < 40; i++) {
        world.step(evq);
        evq.drainContactForceEvents(e => {
          const f = e.totalForceMagnitude();
          [e.collider1(), e.collider2()].forEach(h => { const p = S.byCol.get(h); if (p && f > (stat.get(p) || 0)) stat.set(p, f); });
        });
      }
      S.pieces.forEach(p => {
        const m = MATS[p.mat];
        p.str = Math.max(p.mass * 9.81 * m.g * TUNE.g, (stat.get(p) || 0) * TUNE.st);
        p.col.setContactForceEventThreshold(p.str * .9);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, false); p.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        p.rest = p.body.translation();
        p.body.sleep();
      });
    }
    calibrate();

    /* ── cargas ── */
    function addCharge(type, pid, lp, ln, delay) {
      const p = S.pieces[pid]; if (!p || !p.alive || p.kind !== 'block') return null;
      const c = { id: S.charges.length ? S.charges[S.charges.length - 1].id + 1 : 1, type, pid, lp: lp.slice(), ln: ln.slice(), delay: delay || 0, done: false };
      S.charges.push(c);
      return c;
    }
    function removeCharge(id) { S.charges = S.charges.filter(c => c.id !== id); }
    const cost = () => S.charges.reduce((s, c) => s + CHARGES[c.type].cost, 0);

    /* posição/normal da carga no mundo (anda com o bloco) */
    function chargeWorld(c) {
      const p = S.pieces[c.pid];
      if (p && p.body && p.alive) {
        const t = p.body.translation(), q = p.body.rotation();
        const w = qrot(q, v3(c.lp[0], c.lp[1], c.lp[2]));
        const n = qrot(q, v3(c.ln[0], c.ln[1], c.ln[2]));
        c.wp = v3(t.x + w.x, t.y + w.y, t.z + w.z); c.wn = n;
      }
      return c;
    }

    function detonate() {
      if (S.phase !== 'plan') return;
      S.phase = 'boom'; S.tBoom = 0; S.spent = cost();
      S.charges.forEach(chargeWorld);
      S.pieces.forEach(p => { if (p.alive && p.body) p.body.wakeUp(); });
    }

    /* ── estilhaçar ── */
    /* rPulv: raio à volta da explosão onde o material fica em pó (não fica a fazer de apoio) */
    function shatter(p, hitW, blast, rPulv) {
      if (!p.alive || !p.body) return;
      const m = MATS[p.mat];
      const t = p.body.translation(), q = p.body.rotation(), lv = p.body.linvel(), av = p.body.angvel();
      /* poliedro no referencial do bloco de origem */
      let poly = p.poly;
      if (!poly) poly = p.shape === 'cyl' ? cylPoly(p.size[0] / 2, p.size[1], 14) : p.shape === 'wedge' ? wedgePoly(...p.size) : boxPoly(...p.size);
      /* ponto de impacto em coordenadas locais do bloco de origem */
      let hit = null;
      if (hitW) { const l = qrot(qinv(q), v3(hitW.x - t.x, hitW.y - t.y, hitW.z - t.z)); hit = [l.x + p.c[0], l.y + p.c[1], l.z + p.c[2]]; }
      const room = MAXB - S.nBodies;
      let k = Math.round(p.vol * m.per * (rPulv ? 1.6 : 1));
      k = Math.max(m.kmin, Math.min(m.kmax * (rPulv ? 2 : 1), k));
      if (room < 60) k = Math.min(k, 2);
      const parts = fracture(poly, k, rnd, m, hit);
      kill(p);
      const out = [];
      parts.forEach(pp => {
        const mm = polyMass(pp); if (mm.vol <= 0) return;
        /* centro do pedaço no mundo: t + q·(c_novo − c_velho) */
        const off = qrot(q, v3(mm.c[0] - p.c[0], mm.c[1] - p.c[1], mm.c[2] - p.c[2]));
        const pos = v3(t.x + off.x, t.y + off.y, t.z + off.z);
        const vel = v3(lv.x + av.y * off.z - av.z * off.y, lv.y + av.z * off.x - av.x * off.z, lv.z + av.x * off.y - av.y * off.x);
        const ch = {
          id: S.pieces.length, kind: 'chunk', shape: 'poly', mat: p.mat, part: p.part, grp: p.grp, tint: p.tint, vol: mm.vol, dmg: 0, gen: p.gen + 1,
          alive: true, c: mm.c, poly: pp, origin: p.origin, size: p.size, bshape: p.shape,
        };
        S.pieces.push(ch);
        const near = rPulv && hitW && Math.hypot(pos.x - hitW.x, pos.y - hitW.y, pos.z - hitW.z) < rPulv;
        if (m.crumbAll || near || mm.vol < MINV || S.nBodies >= MAXB || (p.gen >= 2 && mm.vol < MINV * 3)) {
          /* migalha: só desenho (sai disparada da explosão) */
          ch.alive = false; ch.crumb = true; S.crumbs++;
          if (hitW && blast) { let dx = pos.x - hitW.x, dy = pos.y - hitW.y + .4, dz = pos.z - hitW.z; const l = Math.hypot(dx, dy, dz) || 1; vel.x += dx / l * 9; vel.y += dy / l * 9; vel.z += dz / l * 9; }
          out.push(ch); ch.pos = pos; ch.rot = q; ch.vel = vel;
          return;
        }
        addBody(ch, pos, q, vel, av, false);
        ch.str = Math.max(ch.mass * 9.81 * m.g * 2, (p.str || 0) * mm.vol / p.vol * 1.6);
        ch.col.setContactForceEventThreshold(ch.str * .9);
        out.push(ch);
      });
      S.ev.push({ t: 'shatter', p, parts: out, at: hitW || v3(t.x, t.y, t.z), blast: !!blast });
    }
    function kill(p) {
      p.alive = false;
      if (p.body) {
        S.byCol.delete(p.col.handle);
        world.removeRigidBody(p.body);
        S.nBodies--;
        p.body = null; p.col = null;
      }
      /* acordar tudo à volta: sem isto os vizinhos podiam ficar a flutuar */
      S.pieces.forEach(o => { if (o.alive && o.body && o.body.isSleeping()) o.body.wakeUp(); });
    }

    /* ponto mais próximo do bloco ao centro da explosão (no mundo) e distância */
    function nearest(p, bp) {
      const t = p.body.translation(), q = p.body.rotation();
      const l = qrot(qinv(q), v3(bp.x - t.x, bp.y - t.y, bp.z - t.z));
      let hx, hy, hz;
      if (p.kind === 'block') { hx = p.size[0] / 2; hy = p.size[1] / 2; hz = (p.shape === 'cyl' ? p.size[0] : p.size[2]) / 2; }
      else { if (!p.ext) p.ext = polyExtent(p.poly); hx = p.ext.sz[0] / 2; hy = p.ext.sz[1] / 2; hz = p.ext.sz[2] / 2; }
      const cx = Math.max(-hx, Math.min(hx, l.x)), cy = Math.max(-hy, Math.min(hy, l.y)), cz = Math.max(-hz, Math.min(hz, l.z));
      const w = qrot(q, v3(cx, cy, cz));
      const np = v3(t.x + w.x, t.y + w.y, t.z + w.z);
      return { np, d: Math.hypot(bp.x - np.x, bp.y - np.y, bp.z - np.z), c: t };
    }

    function explode(c) {
      const C = CHARGES[c.type];
      chargeWorld(c);
      const bp = c.wp;
      c.done = true; S.lastBoomT = S.t;
      S.ev.push({ t: 'boom', type: c.type, p: bp, n: c.wn, r: C.r, id: c.id });
      const host = S.pieces[c.pid];
      /* 1) dano e estilhaçar */
      const hits = [];
      S.pieces.forEach(p => {
        if (!p.alive || !p.body) return;
        const nr = nearest(p, bp);
        if (nr.d > C.r) return;
        const k = 1 - nr.d / C.r, m = MATS[p.mat];
        let dmg = C.P * k * k / m.tough;
        if (C.cut && p === host) dmg += C.cut / (m.cutTough || m.tough);
        else if (C.cut && host && p.origin === host.origin) dmg += C.cut * .5 / (m.cutTough || m.tough);
        p.dmg += dmg;
        hits.push(p);
      });
      /* a carga de corte desfaz o bloco onde está (corta mesmo) */
      hits.forEach(p => { if (p.alive && p.dmg >= 1) shatter(p, bp, true, C.cut && p === host ? 99 : C.r * (p === host ? .75 : .45)); });
      /* 2) empurrão (também nos pedaços acabados de criar) */
      const dirN = C.dir && c.wn ? v3(-c.wn.x, -c.wn.y, -c.wn.z) : null;
      S.pieces.forEach(p => {
        if (!p.alive || !p.body) return;
        const nr = nearest(p, bp);
        const R2 = C.r * 1.35;
        if (nr.d > R2) return;
        const k = 1 - nr.d / R2;
        let dx = nr.c.x - bp.x, dy = nr.c.y - bp.y + .35, dz = nr.c.z - bp.z;
        const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
        if (dirN) { const wgt = p.origin === (host && host.origin) ? .9 : .55; dx = dx * (1 - wgt) + dirN.x * wgt; dy = dy * (1 - wgt) + dirN.y * wgt; dz = dz * (1 - wgt) + dirN.z * wgt; }
        const mass = p.mass || 1;
        /* peças pesadas mexem pouco (a explosão tira apoios, não atira prédios) */
        const dv = C.dir ? C.push * k * 10 / (1 + Math.sqrt(mass) * .6) : C.push * k * 10 / (1 + mass * .25);
        const J = mass * dv;
        p.body.applyImpulseAtPoint({ x: dx * J, y: dy * J, z: dz * J }, nr.np, true);
      });
    }

    /* ── passo fixo ── */
    function step() {
      S.t += DT;
      if (S.phase === 'boom' || S.phase === 'settle') {
        S.tBoom += DT;
        S.charges.forEach(c => { if (!c.done) { chargeWorld(c); if (S.tBoom >= c.delay) explode(c); } });
        if (S.charges.every(c => c.done) && S.phase === 'boom') S.phase = 'settle';
      }
      world.step(evq);
      if (S.phase === 'plan') { evq.clear && evq.clear(); return; }
      /* impactos: dano por força acima da resistência */
      const broke = [];
      evq.drainContactForceEvents(e => {
        const f = e.totalForceMagnitude();
        let any = null;
        const h1 = e.collider1(), h2 = e.collider2(), p1 = S.byCol.get(h1), p2 = S.byCol.get(h2);
        [h1, h2].forEach(h => {
          const p = S.byCol.get(h); if (!p || !p.alive) return;
          /* um protegido só se magoa com o que vem da demolição (não com o próprio assentar) */
          if (p.part === 'p') { const o = p === p1 ? p2 : p1; if (!o || o.part === 'p' || o.part === 'n') { any = p; return; } }
          /* pedaços de 2.ª geração já não partem por impacto (senão tudo vira pó) */
          if (f > p.str && p.gen < 2) {
            p.dmg += (f / p.str - 1) * TUNE.imp / Math.min(4, MATS[p.mat].tough);
            if (p.dmg >= 1 && !(p.mat === 'steel')) broke.push(p);
          }
          any = p;
        });
        if (any && f > any.mass * 9.81 * 6 && any.body) {
          const v = any.body.linvel(), sp = Math.hypot(v.x, v.y, v.z);
          if (sp > 2.2) S.ev.push({ t: 'hit', p: any.body.translation(), f, sp, mat: any.mat, vol: any.vol });
        }
      });
      broke.forEach(p => { if (p.alive && p.body) shatter(p, null, false); });
      /* fora do mundo */
      S.pieces.forEach(p => { if (p.alive && p.body && p.body.translation().y < -30) { kill(p); p.fell = true; } });
      /* assentou? */
      if (S.phase === 'settle') {
        let moving = 0;
        S.pieces.forEach(p => { if (p.alive && p.body && !p.body.isSleeping()) { const v = p.body.linvel(); if (v.x * v.x + v.y * v.y + v.z * v.z > .09) moving++; } });
        S.settleT = moving <= 2 ? S.settleT + DT : 0;
        if ((S.settleT > .8 && S.t - S.lastBoomT > 2.5) || S.t - S.lastBoomT > 14) S.phase = 'done';
      }
    }

    /* ── avaliação ── */
    function evaluate() {
      let up = 0;
      const dam = new Set();
      S.pieces.forEach(p => {
        if (p.part === 's') {
          if (p.alive && p.body && p.body.translation().y > S.lineY) up += p.vol;
        } else if (p.part === 'p') {
          let hurt = false;
          if (p.kind === 'block' && !p.alive && !p.fell) hurt = true;
          if (p.alive && p.body && p.kind === 'block') {
            const t = p.body.translation();
            if (Math.hypot(t.x - p.rest.x, t.y - p.rest.y, t.z - p.rest.z) > .35 || p.dmg > .3) hurt = true;
          }
          if (hurt) { dam.add(p.grp != null ? p.grp : 'p' + p.id); if (opts.why) opts.why(p); }
        }
      });
      const pct = S.V0 ? Math.max(0, Math.min(1, 1 - up / S.V0)) : 1;
      return { pct, damaged: [...dam], cost: S.phase === 'plan' ? cost() : S.spent };
    }

    Object.assign(S, { addCharge, removeCharge, cost, detonate, step, evaluate, chargeWorld, shatter });
    return S;
  }

  return { TUNE, create, MATS, CHARGES, DT, polyMass, polyExtent, boxPoly, cylPoly, wedgePoly, qrot, rng };
})();
if (typeof module !== 'undefined') module.exports = DemoSim;
