/* ══════════════════════════════════════════════════════════════════
   DemoLevels — níveis da Implosão (out/2026).

   Cada nível descreve-se com um construtor (B) que empilha blocos:
     B.box / B.cyl / B.wedge / B.hex      → um bloco
     B.tower / B.house / B.masonry / …    → estruturas inteiras
     B.deco(kind, x, z, o)                → cenário sem física (árvores, cones…)
   e devolve referências para a solução (`ref`), que o verificador em Node
   usa para provar que o nível tem solução dentro de ★★★.

   part: 's' estrutura a demolir · 'p' protegido (não pode ser tocado)
══════════════════════════════════════════════════════════════════ */
const DemoLevels = (function () {
  'use strict';

  /* ── construtor ── */
  function Builder() {
    const blocks = [], deco = [], statics = [];
    let grp = 0;
    const B = {
      blocks, decos: deco, statics,
      box(pos, size, mat, o) { blocks.push(Object.assign({ shape: 'box', pos, size, mat }, o || {})); return blocks.length - 1; },
      cyl(pos, d, h, mat, o) { blocks.push(Object.assign({ shape: 'cyl', pos, size: [d, h, d], mat }, o || {})); return blocks.length - 1; },
      wedge(pos, size, mat, o) { blocks.push(Object.assign({ shape: 'wedge', pos, size, mat }, o || {})); return blocks.length - 1; },
      deco(kind, x, z, o) { deco.push(Object.assign({ kind, x, z }, o || {})); },
      stat(pos, size, o) { statics.push(Object.assign({ pos, size }, o || {})); },
      grp() { return ++grp; },
    };

    /* prédio de pórtico: pilares + lajes + paredes de fachada
       o: fl pisos, nx/nz vãos, bay vão (m), h altura do piso, cs secção do pilar,
          col/slab/wall materiais, wall0 paredes no rés-do-chão, part, grp, tint */
    B.tower = (x, z, o) => {
      o = Object.assign({ fl: 3, nx: 2, nz: 2, bay: 3, h: 3, cs: .45, st: .3, wt: .22, col: 'concrete', slab: 'concrete', wall: 'facade', wall0: true, part: 's', split: 1, roof: false }, o);
      const W = o.nx * o.bay, D = o.nz * o.bay, x0 = x - W / 2, z0 = z - D / 2;
      const T = { cols: [], slabs: [], walls: [], W, D, H: o.fl * o.h, x, z };
      const po = { part: o.part, grp: o.grp, tint: o.tint };
      for (let f = 0; f < o.fl; f++) {
        const y0 = f * o.h, ch = o.h - o.st;
        const C = []; T.cols.push(C);
        for (let i = 0; i <= o.nx; i++) { C.push([]); for (let j = 0; j <= o.nz; j++) C[i].push(B.box([x0 + i * o.bay, y0 + ch / 2, z0 + j * o.bay], [o.cs, ch - .002, o.cs], o.col, po)); }
        /* lajes: um pedaço por "split" vãos */
        const S = []; T.slabs.push(S);
        const sp = o.split;
        for (let i = 0; i < o.nx; i += sp) for (let j = 0; j < o.nz; j += sp) {
          const ni = Math.min(sp, o.nx - i), nj = Math.min(sp, o.nz - j);
          const ex0 = i === 0 ? o.cs / 2 : 0, ex1 = i + ni === o.nx ? o.cs / 2 : 0;
          const ez0 = j === 0 ? o.cs / 2 : 0, ez1 = j + nj === o.nz ? o.cs / 2 : 0;
          const sx = ni * o.bay + ex0 + ex1, sz = nj * o.bay + ez0 + ez1;
          S.push(B.box([x0 + i * o.bay + ni * o.bay / 2 + (ex1 - ex0) / 2, y0 + ch + o.st / 2, z0 + j * o.bay + nj * o.bay / 2 + (ez1 - ez0) / 2], [sx - .004, o.st, sz - .004], o.slab, po));
        }
        /* paredes entre pilares no perímetro */
        const Wl = []; T.walls.push(Wl);
        if (o.wall && (f > 0 || o.wall0)) {
          const len = o.bay - o.cs - .02, wy = y0 + ch / 2;
          const wm = typeof o.wall === 'function' ? o.wall(f) : o.wall;
          for (let i = 0; i < o.nx; i++) {
            Wl.push(B.box([x0 + i * o.bay + o.bay / 2, wy, z0], [len, ch - .004, o.wt], wm, po));
            Wl.push(B.box([x0 + i * o.bay + o.bay / 2, wy, z0 + D], [len, ch - .004, o.wt], wm, po));
          }
          for (let j = 0; j < o.nz; j++) {
            Wl.push(B.box([x0, wy, z0 + j * o.bay + o.bay / 2], [o.wt, ch - .004, len], wm, po));
            Wl.push(B.box([x0 + W, wy, z0 + j * o.bay + o.bay / 2], [o.wt, ch - .004, len], wm, po));
          }
        }
      }
      if (o.roof) {   /* casota/depósito no telhado */
        T.roof = B.box([x, o.fl * o.h + .9, z], [Math.min(3, W * .4), 1.8, Math.min(3, D * .4)], o.roofMat || 'brick', po);
      }
      T.col = (f, i, j) => T.cols[f][i][j];
      return T;
    };

    /* casa: 4 paredes, laje entre pisos e telhado de duas águas (cunha) */
    B.house = (x, z, o) => {
      o = Object.assign({ w: 6, d: 5, fl: 1, h: 2.8, mat: 'plaster', roof: 'roof', part: 's', t: .25, rh: 2 }, o);
      const g = o.grp != null ? o.grp : B.grp();
      const po = { part: o.part, grp: g, tint: o.tint };
      const H = { walls: [], x, z, grp: g };
      for (let f = 0; f < o.fl; f++) {
        const y0 = f * o.h, wh = o.h - .2;
        /* frente/trás em dois painéis (porta/janela no meio da textura) */
        const hw = (o.w - .02) / 2;
        [-1, 1].forEach(s => {
          H.walls.push(B.box([x - hw / 2, y0 + wh / 2, z + s * (o.d / 2 - o.t / 2)], [hw - .01, wh - .004, o.t], o.mat, po));
          H.walls.push(B.box([x + hw / 2, y0 + wh / 2, z + s * (o.d / 2 - o.t / 2)], [hw - .01, wh - .004, o.t], o.mat, po));
          H.walls.push(B.box([x + s * (o.w / 2 - o.t / 2), y0 + wh / 2, z], [o.t, wh - .004, o.d - o.t * 2 - .02], o.mat, po));
        });
        H.top = B.box([x, y0 + wh + .1, z], [o.w, .2, o.d], f === o.fl - 1 ? 'wood' : 'concrete', po);
      }
      if (o.roof) H.roof = B.wedge([x, o.fl * o.h + o.rh / 2, z], [o.w + .3, o.rh, o.d + .3], o.roof, po);
      return H;
    };

    /* torre/caixa de alvenaria: fiadas de blocos desencontrados (cantos travados) */
    B.masonry = (x, z, o) => {
      o = Object.assign({ w: 4.8, d: 4.8, h: 7.2, bl: 1.2, bh: .6, t: .6, mat: 'brick', part: 's' }, o);
      const M = { rows: [] }, po = { part: o.part, grp: o.grp, tint: o.tint };
      const nRows = Math.round(o.h / o.bh);
      for (let r = 0; r < nRows; r++) {
        const y = r * o.bh + o.bh / 2, row = []; M.rows.push(row);
        const odd = r % 2;
        /* paredes x (frente/trás) a todo o comprimento em fiadas pares; z nas ímpares */
        const runX = (zc, full) => {
          const L = full ? o.w : o.w - 2 * o.t, n = Math.max(1, Math.round(L / o.bl)), bl = L / n;
          for (let k = 0; k < n; k++) row.push(B.box([x - L / 2 + bl * (k + .5), y, zc], [bl - .006, o.bh - .004, o.t], o.mat, po));
        };
        const runZ = (xc, full) => {
          const L = full ? o.d : o.d - 2 * o.t, n = Math.max(1, Math.round(L / o.bl)), bl = L / n;
          for (let k = 0; k < n; k++) row.push(B.box([xc, y, z - L / 2 + bl * (k + .5)], [o.t, o.bh - .004, bl - .006], o.mat, po));
        };
        runX(z - o.d / 2 + o.t / 2, !odd); runX(z + o.d / 2 - o.t / 2, !odd);
        runZ(x - o.w / 2 + o.t / 2, !!odd); runZ(x + o.w / 2 - o.t / 2, !!odd);
      }
      if (o.cap) M.cap = B.box([x, nRows * o.bh + .15, z], [o.w + .2, .3, o.d + .2], 'concrete', po);
      if (o.roof) M.roof = B.wedge([x, nRows * o.bh + (o.cap ? .3 : 0) + o.roof / 2, z], [o.w + .4, o.roof, o.d + .4], 'roof', po);
      return M;
    };

    /* muro simples de tijolo (aparelho desencontrado) ao longo de x */
    B.wall = (x, z, o) => {
      o = Object.assign({ len: 9.6, h: 3, bl: 1.2, bh: .6, t: .5, mat: 'brick', part: 's' }, o);
      const Wl = { rows: [] }, po = { part: o.part, grp: o.grp, tint: o.tint };
      const n = Math.round(o.h / o.bh);
      for (let r = 0; r < n; r++) {
        const row = []; Wl.rows.push(row);
        const off = r % 2 ? o.bl / 2 : 0, x0 = x - o.len / 2;
        let a = 0;
        while (a < o.len - .01) {
          const w = Math.min(a === 0 && off ? off : o.bl, o.len - a);
          row.push(B.box([x0 + a + w / 2, r * o.bh + o.bh / 2, z], [w - .006, o.bh - .004, o.t], o.mat, po));
          a += w;
        }
      }
      return Wl;
    };

    /* chaminé: plinto de 4 pilares (para se poder cortar de um lado) + anéis cilíndricos */
    B.chimney = (x, z, o) => {
      o = Object.assign({ h: 18, d0: 2.6, d1: 1.7, seg: 1.8, mat: 'brick', base: 2.4, part: 's' }, o);
      const C = { base: [], segs: [] }, po = { part: o.part, grp: o.grp, tint: o.tint };
      /* 4 pilares com um vão no meio: tirando os de um lado, o centro de massa fica sem apoio e tomba */
      const bw = o.d0 + .3, bh = o.base, q = bw * .36, c = bw / 2 - q / 2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => C.base.push(B.box([x + i * c, bh / 2, z + j * c], [q, bh - .004, q], o.baseMat || o.mat, po)));
      const n = Math.max(2, Math.round((o.h - bh) / o.seg));
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1), d = o.d0 + (o.d1 - o.d0) * t;
        C.segs.push(B.cyl([x, bh + k * o.seg + o.seg / 2, z], d, o.seg - .004, o.mat, po));
      }
      C.top = bh + n * o.seg;
      return C;
    };

    /* torre de água: 4 pernas de aço com travessas, depósito em cima */
    B.waterTower = (x, z, o) => {
      o = Object.assign({ h: 10, s: 4, leg: .4, part: 's' }, o);
      const po = { part: o.part, grp: o.grp };
      const W = { legs: [], braces: [] };
      const nseg = 2, sh = o.h / nseg;
      for (let k = 0; k < nseg; k++) {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => W.legs.push(B.box([x + i * o.s / 2, k * sh + sh / 2 - (k ? 0 : 0), z + j * o.s / 2], [o.leg, sh - .2 - .004, o.leg], 'steel', po)));
        /* travessas (assentam nas pernas, por cima de cada troço) */
        const by = k * sh + sh - .1;
        W.braces.push(B.box([x, by, z - o.s / 2], [o.s + o.leg, .2, o.leg], 'steel', po));
        W.braces.push(B.box([x, by, z + o.s / 2], [o.s + o.leg, .2, o.leg], 'steel', po));
        if (k === nseg - 1) W.braces.push(B.box([x, by + .2, z], [o.leg, .2, o.s + o.leg], 'steel', po));
      }
      W.floor = B.box([x, o.h + .3, z], [o.s + .8, .2, o.s + .8], 'steel', po);
      W.tank = B.cyl([x, o.h + .4 + 1.6, z], o.s + .6, 3.2, 'metal', po);
      W.cap = B.wedge([x, o.h + .4 + 3.2 + .5, z], [o.s + .2, 1, o.s + .2], 'metal', po);
      return W;
    };

    /* grua: mastro de troços de aço, lança e contrapeso */
    B.crane = (x, z, o) => {
      o = Object.assign({ h: 16, seg: 2, jib: 14, back: 5, dir: 1, part: 's' }, o);
      const po = { part: o.part, grp: o.grp };
      const K = { mast: [] };
      K.foot = B.box([x, .4, z], [2.6, .8, 2.6], 'steel', po);
      const n = Math.round(o.h / o.seg);
      /* o 1.º troço são duas pernas lado a lado: cortando a de um lado, a grua tomba para lá */
      K.legs = [-1, 1].map(sd => B.box([x + sd * .45, .8 + o.seg / 2, z], [.5, o.seg - .004, 1.4], 'steel', po));
      for (let k = 1; k < n; k++) K.mast.push(B.box([x, .8 + k * o.seg + o.seg / 2, z], [1.4, o.seg - .004, 1.4], 'steel', po));
      const top = .8 + n * o.seg;
      K.cab = B.box([x, top + .6, z], [2.4, 1.2, 2.4], 'metal', po);
      /* lança + contra-lança numa só viga (de −6 a +10), equilibrada pelo contrapeso */
      K.jib = B.box([x + o.dir * 2, top + 1.5, z], [16, .6, .9], 'metal', Object.assign({ lattice: 1 }, po));
      K.weight = B.box([x - o.dir * 5.2, top + 2.4, z], [1.4, 1.2, 1.4], 'concrete', po);
      return K;
    };

    /* contentor: caixa de chapa (dura de partir — empurra-se) */
    B.container = (x, y, z, o) => B.box([x, y + 1.3, z], o && o.rot ? [2.4, 2.6, 6] : [6, 2.6, 2.4], 'metal', Object.assign({ tint: ['#c2410c', '#1d4ed8', '#15803d', '#b91c1c', '#ca8a04', '#0e7490'][Math.floor(Math.abs(x * 7 + y * 3 + z * 5)) % 6] }, o));

    /* carro estacionado (protegido por defeito) */
    B.car = (x, z, o) => {
      o = Object.assign({ rot: 0, part: 'p' }, o);
      const g = o.grp != null ? o.grp : B.grp();
      return B.box([x, .75, z], o.rot ? [1.8, 1.5, 4.2] : [4.2, 1.5, 1.8], 'metal', { part: o.part, grp: g, car: o.kind || 'sedan', tint: o.tint || '#2f6fd0', rotY: 0 });
    };

    /* silo: anéis de betão empilhados com tampa */
    B.silo = (x, z, o) => {
      o = Object.assign({ h: 12, d: 4, seg: 2, part: 's' }, o);
      const po = { part: o.part, grp: o.grp };
      const S = { segs: [], legs: [] };
      /* pernas (como nos silos a sério): tirando as de um lado, tomba para lá */
      const lh = o.legs || 3, q = o.d * .3, c = o.d / 2 - q / 2;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([i, j]) => S.legs.push(B.box([x + i * c, lh / 2, z + j * c], [q, lh - .004, q], o.legMat || 'concrete', po)));
      const n = Math.round((o.h - lh) / o.seg);
      for (let k = 0; k < n; k++) S.segs.push(B.cyl([x, lh + k * o.seg + o.seg / 2, z], o.d, o.seg - .004, o.mat || 'concrete', po));
      S.cap = B.wedge([x, lh + n * o.seg + .5, z], [o.d * .9, 1, o.d * .9], 'metal', po);
      return S;
    };

    /* pirâmide em degraus */
    B.pyramid = (x, z, o) => {
      o = Object.assign({ n: 5, s: 1.6, h: 1.2, mat: 'stone', part: 's' }, o);
      const P = { layers: [] }, po = { part: o.part, grp: o.grp };
      for (let l = 0; l < o.n; l++) {
        const k = o.n - l, L = []; P.layers.push(L);
        for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) L.push(B.box([x + (i - (k - 1) / 2) * o.s, l * o.h + o.h / 2, z + (j - (k - 1) / 2) * o.s], [o.s - .006, o.h - .004, o.s - .006], o.mat, po));
      }
      return P;
    };

    /* ponte: tabuleiro em troços sobre pilares (opcionalmente sobre o rio) */
    B.bridge = (x0, x1, z, o) => {
      o = Object.assign({ y: 6, piers: 3, w: 4, t: .6, mat: 'concrete', part: 's', base: 0, abut: 0 }, o);
      const P = { piers: [], deck: [] }, po = { part: o.part, grp: o.grp };
      const span = (x1 - x0) / (o.piers + 1);
      /* encontros nas margens (assentam na margem, à altura `abut`) */
      if (o.abut != null) [x0 + .5, x1 - .5].forEach(ax => P.piers.push(B.box([ax, o.abut + (o.y - o.abut) / 2, z], [1, o.y - o.abut - .004, o.w - .6], 'stone', { part: 'n' })));
      for (let k = 1; k <= o.piers; k++) {
        const px = x0 + k * span, ph = o.y - o.base;
        P.piers.push(B.box([px, o.base + ph / 2, z], [1, ph - .004, o.w - .6], o.mat, po));
      }
      /* troços apoiados de pilar a pilar (e nas margens) */
      for (let k = 0; k <= o.piers; k++) {
        const a = x0 + k * span, b = a + span;
        P.deck.push(B.box([(a + b) / 2, o.y + o.t / 2, z], [span - .01, o.t, o.w], o.mat, po));
      }
      return P;
    };

    return B;
  }

  /* face de um bloco: ponto + normal locais (para a solução de referência) */
  function face(b, f, u, v) {
    const s = b.size, sh = b.shape;
    const hx = s[0] / 2, hy = s[1] / 2, hz = (sh === 'cyl' ? s[0] : s[2]) / 2;
    u = u || 0; v = v || 0;
    switch (f) {
      case '+x': return [[hx, v * hy, u * hz], [1, 0, 0]];
      case '-x': return [[-hx, v * hy, u * hz], [-1, 0, 0]];
      case '+z': return [[u * hx, v * hy, hz], [0, 0, 1]];
      case '-z': return [[u * hx, v * hy, -hz], [0, 0, -1]];
      case '+y': return [[u * hx, hy, v * hz], [0, 1, 0]];
      default: return [[u * hx, -hy, v * hz], [0, -1, 0]];
    }
  }

  /* temas dos mundos (o desenho usa-os) */
  const WORLDS = [
    { id: 'obra', name: 'Estaleiro', icon: '🚧', grad: ['#f59e0b', '#b45309'], sky: ['#8ec5ff', '#e9f3ff'], sun: '#fff1d6', ground: 'dirt', fog: '#cfe2f5', time: 'manhã' },
    { id: 'bairro', name: 'Bairro', icon: '🏘️', grad: ['#22c55e', '#166534'], sky: ['#6fb1ff', '#ffe9c9'], sun: '#ffe2b0', ground: 'grass', fog: '#e6dccb', time: 'tarde' },
    { id: 'porto', name: 'Porto', icon: '⚓', grad: ['#0ea5e9', '#075985'], sky: ['#9fb6c9', '#dfe6ec'], sun: '#f4f1ea', ground: 'asphalt', fog: '#c9d3dc', time: 'nublado', sea: true },
    { id: 'centro', name: 'Centro', icon: '🏙️', grad: ['#f97316', '#9a3412'], sky: ['#3d5a9e', '#ffb07a'], sun: '#ffc48a', ground: 'asphalt', fog: '#d8a88a', time: 'pôr do sol' },
    { id: 'industria', name: 'Indústria', icon: '🏭', grad: ['#a3a3a3', '#404040'], sky: ['#9aa6b2', '#e8dcc6'], sun: '#ffe7c2', ground: 'gravel', fog: '#cbc3b4', time: 'neblina' },
    { id: 'ruinas', name: 'Monumentos', icon: '🏛️', grad: ['#eab308', '#854d0e'], sky: ['#4aa3ff', '#fff3d6'], sun: '#fff6e0', ground: 'sand', fog: '#f0e0c0', time: 'meio-dia' },
  ];

  /* ════════════════════════════════════════════════════════════════
     níveis — line: altura da linha (m); pct: fração da estrutura que tem
     de ficar abaixo dela; kit: cargas disponíveis; money: orçamento;
     s3: custo máx. para ★★★ (s2 = ★★). ref: solução de referência.
  ════════════════════════════════════════════════════════════════ */
  const L = [];
  const lvl = (o) => L.push(o);

  /* ── 1. Estaleiro ── */
  lvl({ id: 'o1', w: 0, name: 'Primeiro Estrondo', tip: 'Toca num pilar para lhe pôr um petardo. Depois carrega em DETONAR.',
    kit: ['pet'], line: 1.2, pct: .85, money: 800, s2: 500, s3: 400,
    build(B) { const T = B.tower(0, 0, { fl: 1, nx: 1, nz: 1, bay: 3.2, wall: 'brick', h: 3 }); B.deco('cones', 6, 4); return { T }; },
    ref: (r, B) => [['pet', r.T.col(0, 0, 0), '+x'], ['pet', r.T.col(0, 1, 0), '-x'], ['pet', r.T.col(0, 0, 1), '+x'], ['pet', r.T.col(0, 1, 1), '-x']] });

  lvl({ id: 'o2', w: 0, name: 'Torre de Tijolo', tip: 'Os blocos de cima caem sozinhos se lhes tirares o apoio de baixo.',
    kit: ['pet'], line: 2, pct: .72, money: 900, s2: 600, s3: 400,
    build(B) { const M = B.masonry(0, 0, { w: 3.6, d: 3.6, h: 7.2, roof: 1.6 }); return { M }; },
    ref: (r) => [['pet', r.M.rows[0][0], '-z'], ['pet', r.M.rows[0][r.M.rows[0].length - 1], '+x'], ['pet', r.M.rows[1][1], '+z'], ['pet', r.M.rows[1][3], '-x']] });

  lvl({ id: 'o3', w: 0, name: 'Dois Andares', tip: 'Os pilares do rés-do-chão seguram tudo. Tira-os e o resto vem atrás.',
    kit: ['pet'], line: 1.5, pct: .85, money: 1400, s2: 1000, s3: 800,
    build(B) { const T = B.tower(0, 0, { fl: 2, nx: 2, nz: 1, wall0: false }); B.deco('cones', 8, 5); B.deco('barrier', -7, 5); return { T }; },
    ref: (r) => [0, 1, 2].flatMap(i => [['pet', r.T.col(0, i, 0), '+z'], ['pet', r.T.col(0, i, 1), '-z']]).slice(0, 6).concat([]).filter((_, k) => k !== 1 && k !== 4).concat([['pet', r.T.col(0, 1, 0), '+z'], ['pet', r.T.col(0, 1, 1), '-z']]) });

  lvl({ id: 'o4', w: 0, name: 'A Dinamite', tip: 'A dinamite rebenta com mais força e mais longe que o petardo — um cartucho bem posto pode partir dois pilares.',
    kit: ['pet', 'din'], line: 2, pct: .85, money: 2000, s2: 1300, s3: 1000,
    build(B) { const T = B.tower(0, 0, { fl: 3, nx: 2, nz: 2, wall0: false, bay: 2.8 }); return { T }; },
    ref: (r) => [['din', r.T.col(0, 0, 1), '+x'], ['din', r.T.col(0, 2, 1), '-x'], ['din', r.T.col(0, 1, 0), '+z'], ['din', r.T.col(0, 1, 2), '-z']] });

  lvl({ id: 'o5', w: 0, name: 'Cuidado com a Carrinha', tip: 'Os objetos com escudo verde não podem ser tocados. Faz o prédio cair para o outro lado: rebenta primeiro os pilares longe da carrinha.',
    kit: ['pet', 'din'], line: 2, pct: .8, money: 2200, s2: 1500, s3: 1100,
    build(B) { const T = B.tower(0, 0, { fl: 3, nx: 2, nz: 1, wall0: false }); B.car(0, 5.2, { kind: 'van', tint: '#f4f4f4' }); return { T }; },
    ref: (r) => [['din', r.T.col(0, 0, 0), '-z'], ['din', r.T.col(0, 1, 0), '-z'], ['din', r.T.col(0, 2, 0), '-z'], ['pet', r.T.col(0, 0, 1), '+x', .4], ['pet', r.T.col(0, 1, 1), '+z', .4], ['pet', r.T.col(0, 2, 1), '-x', .4]] });

lvl({ id: 'o6', w: 0, name: 'Muro da Obra', tip: 'Um muro comprido e duas torres de tijolo. Tudo ao chão!',
    kit: ['pet', 'din'], line: 1.2, pct: .75, money: 2400, s2: 1500, s3: 1000,
    build(B) { const M = B.wall(0, 0, { len: 10.8, h: 3.6 }); const A = B.masonry(-6.6, 0, { w: 2.4, d: 2.4, h: 6, roof: 1.2 }); const C = B.masonry(6.6, 0, { w: 2.4, d: 2.4, h: 6, roof: 1.2 }); B.deco('cones', -4, 5); return { M, A, C }; },
    ref: (r) => [['din', r.M.rows[0][4], '+z'], ['din', r.A.rows[0][0], '-z'], ['din', r.C.rows[0][0], '-z'], ['din', r.A.rows[0][1], '+z'], ['din', r.C.rows[0][1], '+z']] });

  /* ── 2. Bairro ── */
  lvl({ id: 'b1', w: 1, name: 'Casa Velha', tip: 'As casas dos vizinhos têm escudo: não lhes toques. Usa cargas pequenas.',
    kit: ['pet', 'din'], line: 1.6, pct: .7, money: 1500, s2: 1000, s3: 700,
    build(B) { const H = B.house(0, 0, { fl: 2, tint: '#f1e2c4' }); B.house(-9.5, 0, { part: 'p', tint: '#f7d7d0' }); B.house(9.5, 0, { part: 'p', tint: '#d6e8f5' }); B.deco('tree', 0, 8); B.deco('tree', -14, 7); return { H }; },
    ref: (r) => [['din', r.H.walls[0], '+z'], ['din', r.H.walls[3], '-z'], ['pet', r.H.walls[2], '-x']] });

  lvl({ id: 'b2', w: 1, name: 'Prédio de 4 Andares', tip: 'Num prédio alto, o peso dos pisos de cima faz o trabalho por ti.',
    kit: ['pet', 'din'], line: 3, pct: .85, money: 2600, s2: 1800, s3: 1250,
    build(B) { const T = B.tower(0, 0, { fl: 4, nx: 2, nz: 2, wall0: false, tint: '#e9d5b7', roof: true }); B.car(-9, 5, { tint: '#c0392b' }); B.deco('tree', 9, -6); B.deco('tree', 10, 5); return { T }; },
    ref: (r) => [['din', r.T.col(0, 1, 1), '+x'], ['din', r.T.col(0, 0, 0), '+x'], ['din', r.T.col(0, 2, 2), '-x'], ['din', r.T.col(0, 2, 0), '-x'], ['pet', r.T.col(0, 0, 2), '+x']] });

  lvl({ id: 'b3', w: 1, name: 'Chaminé da Padaria', tip: 'Para tombar uma chaminé, rebenta a base só de UM lado — cai para esse lado. A padaria fica do outro!',
    kit: ['pet', 'din'], line: 2.5, pct: .8, money: 1800, s2: 1100, s3: 700,
    build(B) { const C = B.chimney(0, 0, { h: 16 }); B.house(-7, 0, { part: 'p', w: 7, tint: '#f3c98b' }); B.deco('tree', 8, -6); return { C }; },
    ref: (r) => [['din', r.C.base[1], '+x'], ['din', r.C.base[3], '+x']] });

  lvl({ id: 'b4', w: 1, name: 'Garagem', tip: 'Um parque de estacionamento aberto: muitos pilares e lajes largas.',
    kit: ['pet', 'din'], line: 2.5, pct: .8, money: 3200, s2: 2300, s3: 1750,
    build(B) { const T = B.tower(0, 0, { fl: 3, nx: 3, nz: 2, wall: null, h: 2.8, bay: 3.4, split: 1 }); B.car(-1.7, 9, { tint: '#2d6a4f' }); B.car(4, 9, { tint: '#f1c40f' }); return { T }; },
    ref: (r) => [0, 1, 2, 3].map(i => ['din', r.T.col(0, i, 1), '+z']).concat([['pet', r.T.col(0, 0, 0), '+x'], ['pet', r.T.col(0, 3, 0), '-x'], ['pet', r.T.col(0, 1, 2), '-z']]) });

  lvl({ id: 'b5', w: 1, name: 'Torre do Relógio', tip: 'Alvenaria grossa: a dinamite parte vários blocos de uma vez.',
    kit: ['pet', 'din'], line: 3, pct: .8, money: 2400, s2: 1600, s3: 1000,
    build(B) { const M = B.masonry(0, 0, { w: 3.6, d: 3.6, h: 10.8, mat: 'stone', cap: true, roof: 2.4, bl: 1.2 }); B.house(-10.5, 0, { part: 'p', tint: '#e7d8c9' }); B.house(10.5, 0, { part: 'p', tint: '#d8e7c9' }); return { M }; },
    ref: (r) => [['din', r.M.rows[0][1], '-z'], ['din', r.M.rows[1][4], '+x'], ['din', r.M.rows[1][2], '-x'], ['pet', r.M.rows[0][4], '+z']] });

lvl({ id: 'b6', w: 1, name: 'Moradia com Garagem', tip: 'Casa de dois pisos com garagem ao lado — e o carro do vizinho estacionado mesmo ali.',
    kit: ['pet', 'din'], line: 1.6, pct: .7, money: 2600, s2: 1700, s3: 1100,
    build(B) { const H = B.house(-1.5, 0, { fl: 2, w: 7, d: 6, tint: '#f6e7d0' }); const Gg = B.house(5.4, 0, { fl: 1, w: 4.4, d: 5, tint: '#e9e2d8', rh: 1.2 }); B.car(-1.5, 7.5, { tint: '#b3261e' }); B.deco('tree', -9, -4); B.deco('tree', 10, 5); return { H, Gg }; },
    ref: (r) => r.H.walls.slice(0, 6).map(id => ['din', id, '+y']).concat(r.H.walls.slice(6, 12).map(id => ['pet', id, '+y', .3]), r.Gg.walls.slice(0, 6).map(id => ['din', id, '+y'])) });

  /* ── 3. Porto ── */
  lvl({ id: 'p1', w: 2, name: 'Contentores', tip: 'Os contentores são de chapa: quase não partem. Usa o IMPULSO para os empurrar abaixo da linha.',
    kit: ['pet', 'din', 'imp'], line: 3, pct: .85, money: 1600, s2: 1000, s3: 600,
    build(B) { const s = []; for (let k = 0; k < 4; k++) s.push(B.container(0, k * 2.6, 0)); B.container(0, 0, 4, { part: 'p' }); return { s }; },
    ref: (r) => [['imp', r.s[2], '+z'], ['imp', r.s[3], '+z', .2]] });

  lvl({ id: 'p2', w: 2, name: 'A Grua', tip: 'O aço não parte com explosivos normais. A CARGA DE CORTE corta o troço onde a puseres.',
    kit: ['pet', 'din', 'cut'], line: 3, pct: .8, money: 1800, s2: 1100, s3: 700,
    build(B) { const K = B.crane(0, 0, { h: 16, dir: 1 }); B.container(-8, 0, 0, { part: 'p' }); B.container(-8, 2.6, 0, { part: 'p' }); return { K }; },
    ref: (r) => [['cut', r.K.legs[1], '+x']] });

  lvl({ id: 'p3', w: 2, name: 'Armazém do Cais', tip: 'Telhado leve, paredes de tijolo e pilares de betão — escolhe bem onde pôr cada carga.',
    kit: ['pet', 'din', 'cut'], line: 1.8, pct: .8, money: 3000, s2: 2100, s3: 1500,
    build(B) { const T = B.tower(0, 0, { fl: 1, nx: 4, nz: 2, bay: 3.5, h: 4.5, wall: 'brick', slab: 'metal', st: .25 }); B.container(0, 0, 8.5, { part: 'p' }); B.container(-7, 0, 8.5, { part: 'p' }); return { T }; },
    ref: (r) => [1, 3].flatMap(i => [['din', r.T.col(0, i, 1), '+x']]).concat([['din', r.T.col(0, 0, 0), '+x'], ['din', r.T.col(0, 4, 2), '-x'], ['pet', r.T.col(0, 2, 0), '-z'], ['pet', r.T.col(0, 2, 2), '+z']]) });

  lvl({ id: 'p4', w: 2, name: 'O Farol', tip: 'Tomba o farol para o mar (do lado de cá estão os barcos).',
    kit: ['pet', 'din', 'cut'], line: 3, pct: .8, money: 1800, s2: 1100, s3: 700,
    build(B) { const C = B.chimney(0, 0, { h: 18, d0: 3.2, d1: 2.4, mat: 'plaster', baseMat: 'stone', tint: '#f5f5f5' }); B.car(-7, -2, { kind: 'van', tint: '#e5e5e5' }); B.car(-7, 3, { tint: '#1f4e79' }); return { C }; },
    ref: (r) => [['cut', r.C.base[1], '+x'], ['cut', r.C.base[3], '+x']] });

  lvl({ id: 'p5', w: 2, name: 'Torre de Água', tip: 'Pernas de aço: só a carga de corte as parte. Corta as duas do mesmo lado.',
    kit: ['pet', 'din', 'cut'], line: 3, pct: .8, money: 2000, s2: 1300, s3: 1050,
    build(B) { const W = B.waterTower(0, 0, { h: 9 }); B.house(0, -10, { part: 'p', tint: '#dfe9f3' }); B.house(-11, 0, { part: 'p', tint: '#f3e3df' }); return { W }; },
    ref: (r) => [['cut', r.W.legs[1], '+x'], ['cut', r.W.legs[3], '+x'], ['cut', r.W.legs[5], '+x', .2], ['cut', r.W.legs[7], '+x', .2]] });

lvl({ id: 'p6', w: 2, name: 'Gruas Gémeas', tip: 'Duas gruas, uma de cada lado dos contentores do cliente. Cada uma tem de cair para fora!',
    kit: ['pet', 'din', 'cut', 'imp'], line: 3, pct: .75, money: 3000, s2: 2000, s3: 1400,
    build(B) { const K1 = B.crane(-7, 0, { h: 14, dir: -1 }); const K2 = B.crane(7, 0, { h: 14, dir: 1 }); B.container(0, 0, 0, { part: 'p', grp: 1, rot: 1 }); B.container(0, 2.6, 0, { part: 'p', grp: 1, rot: 1 }); return { K1, K2 }; },
    ref: (r) => [['cut', r.K1.legs[0], '-x'], ['cut', r.K2.legs[1], '+x']] });

  /* ── 4. Centro ── */
  lvl({ id: 'c1', w: 3, name: 'Torre de Vidro', tip: 'Fachada de vidro: estilhaça com tudo. O que conta são os pilares.',
    kit: ['pet', 'din', 'cut'], line: 4, pct: .85, money: 3600, s2: 2600, s3: 2000,
    build(B) { const T = B.tower(0, 0, { fl: 7, nx: 2, nz: 2, wall: f => f % 2 ? 'glass' : 'glass', wall0: false, wt: .12, roof: true }); B.car(-8, -6, {}); B.car(8, 6, { tint: '#8e44ad' }); return { T }; },
    ref: (r) => [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2], [1, 1], [0, 1]].map(([i, j]) => ['din', r.T.col(0, i, j), j === 2 ? '-z' : '+z']) });

  lvl({ id: 'c2', w: 3, name: 'As Gémeas', tip: 'Dois prédios, uma só detonação. Os temporizadores ajudam a coordenar.',
    kit: ['pet', 'din', 'cut'], line: 3, pct: .85, money: 4400, s2: 3200, s3: 2500,
    build(B) { const A = B.tower(-5, 0, { fl: 5, nx: 1, nz: 2, wall0: false, tint: '#d9c3a5' }); const C = B.tower(5, 0, { fl: 5, nx: 1, nz: 2, wall0: false, tint: '#c3d1d9' }); B.car(0, 8, {}); return { A, C }; },
    ref: (r) => [r.A, r.C].flatMap(T => [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].map(([i, j]) => ['din', T.col(0, i, j), '+z'])).slice(0, 10) });

  lvl({ id: 'c3', w: 3, name: 'Entre Vizinhos', tip: 'Prédio entalado entre dois protegidos: tem de cair para dentro de si próprio. Rebenta primeiro o centro.',
    kit: ['pet', 'din', 'cut'], line: 3, pct: .75, money: 3800, s2: 2700, s3: 2100,
    build(B) { const T = B.tower(0, 0, { fl: 6, nx: 2, nz: 2, bay: 2.6, wall0: false, tint: '#e8d1c0' }); B.tower(-10, 0, { fl: 3, nx: 1, nz: 2, bay: 2.6, part: 'p', grp: B.grp(), tint: '#cfd8e3' }); B.tower(10, 0, { fl: 3, nx: 1, nz: 2, bay: 2.6, part: 'p', grp: B.grp(), tint: '#d8e3cf' }); return { T }; },
    ref: (r) => [['din', r.T.col(0, 1, 1), '+z'], ['din', r.T.col(0, 1, 0), '+z', .25], ['din', r.T.col(0, 1, 2), '-z', .25], ['din', r.T.col(0, 0, 1), '+x', .5], ['din', r.T.col(0, 2, 1), '-x', .5], ['pet', r.T.col(0, 0, 0), '+x', .7], ['pet', r.T.col(0, 2, 2), '-x', .7], ['pet', r.T.col(0, 0, 2), '+x', .7], ['pet', r.T.col(0, 2, 0), '-x', .7]] });

  lvl({ id: 'c4', w: 3, name: 'Arranha-céus', tip: 'Dez andares! O barril de TNT rebenta tudo à volta — mas é caro.',
    kit: ['pet', 'din', 'cut', 'tnt'], line: 5, pct: .85, money: 5000, s2: 3600, s3: 2800,
    build(B) { const T = B.tower(0, 0, { fl: 10, nx: 2, nz: 2, wall: f => (f % 3 === 0 ? 'facade' : 'glass'), wt: .14, wall0: false, roof: true, split: 2 }); B.car(-9, 7, { tint: '#16a085' }); return { T }; },
    ref: (r) => [['tnt', r.T.col(0, 1, 1), '+x'], ['din', r.T.col(0, 0, 0), '+x'], ['din', r.T.col(0, 2, 2), '-x'], ['din', r.T.col(0, 2, 0), '-x'], ['din', r.T.col(0, 0, 2), '+x']] });

  lvl({ id: 'c5', w: 3, name: 'Hotel Panorama', tip: 'Largo e alto. Faz cair primeiro um lado e deixa o resto tombar por cima.',
    kit: ['pet', 'din', 'cut', 'tnt'], line: 4, pct: .85, money: 5600, s2: 4000, s3: 3200,
    build(B) { const T = B.tower(0, 0, { fl: 7, nx: 4, nz: 1, bay: 3, wall0: false, tint: '#f0e6d2', roof: true }); B.house(0, -9, { part: 'p', w: 8, tint: '#dcdcdc' }); return { T }; },
    ref: (r) => [0, 1, 2, 3, 4].flatMap(i => [['din', r.T.col(0, i, 1), '-z', i * .12], ['pet', r.T.col(0, i, 0), '+z', .35 + i * .12]]).slice(0, 10).filter((c, k) => !(k === 3 || k === 7)).concat([]) });

lvl({ id: 'c6', w: 3, name: 'Torres em L', tip: 'Dois prédios encostados em L. Faz cair um para dentro do outro.',
    kit: ['pet', 'din', 'cut', 'tnt'], line: 4, pct: .85, money: 5000, s2: 3500, s3: 2500,
    build(B) { const A = B.tower(-3, 0, { fl: 6, nx: 2, nz: 1, bay: 3, wall0: false, tint: '#d8c9b0' }); const C = B.tower(4.5, 3, { fl: 8, nx: 1, nz: 3, bay: 3, wall0: false, tint: '#b9c7d6', roof: true }); B.car(-9, 9, { tint: '#2f855a' }); return { A, C }; },
    ref: (r) => [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]].map(([i, j]) => ['din', r.A.col(0, i, j), '+z']).concat([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]].map(([i, j]) => ['din', r.C.col(0, i, j), '+x', .4])) });

  /* ── 5. Indústria ── */
  lvl({ id: 'i1', w: 4, name: 'Chaminé Gigante', tip: 'Trinta metros de tijolo. Escolhe o lado com espaço para ela cair.',
    kit: ['pet', 'din', 'cut', 'tnt'], line: 4, pct: .8, money: 2400, s2: 1500, s3: 1000,
    build(B) { const C = B.chimney(0, 0, { h: 30, d0: 3.4, d1: 2, seg: 2 }); B.tower(0, -9, { fl: 1, nx: 3, nz: 1, h: 4, wall: 'brick', part: 'p', grp: B.grp(), slab: 'metal', st: .2 }); B.tower(-10, 4, { fl: 1, nx: 1, nz: 2, h: 4, wall: 'brick', part: 'p', grp: B.grp(), slab: 'metal', st: .2 }); return { C }; },
    ref: (r) => [['din', r.C.base[2], '+z'], ['din', r.C.base[3], '+z'], ['pet', r.C.base[3], '+x']] });

  lvl({ id: 'i2', w: 4, name: 'Pórtico de Aço', tip: 'Estrutura toda em aço: só cortes. Quantos cortes são mesmo precisos?',
    kit: ['pet', 'din', 'cut'], line: 2.5, pct: .8, money: 3000, s2: 2200, s3: 1600,
    build(B) { const T = B.tower(0, 0, { fl: 3, nx: 2, nz: 1, bay: 4, h: 3.5, col: 'steel', cs: .4, slab: 'metal', st: .25, wall: null }); return { T }; },
    ref: (r) => [['cut', r.T.col(0, 0, 0), '+x'], ['cut', r.T.col(0, 1, 0), '+x'], ['cut', r.T.col(0, 2, 0), '-x'], ['cut', r.T.col(0, 0, 1), '+x', .3], ['cut', r.T.col(0, 1, 1), '+x', .3], ['cut', r.T.col(0, 2, 1), '-x', .3]] });

  lvl({ id: 'i3', w: 4, name: 'Silos', tip: 'Três silos lado a lado. Um a cair pode derrubar o seguinte… efeito dominó!',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 3, pct: .7, money: 3000, s2: 2000, s3: 1300,
    build(B) { const S = [-5, 0, 5].map(x => B.silo(x, 0, { h: 14, d: 4 })); B.tower(15, 0, { fl: 1, nx: 1, nz: 2, h: 4, wall: 'brick', part: 'p', grp: B.grp(), slab: 'metal', st: .2 }); return { S }; },
    ref: (r) => [['din', r.S[2].legs[0], '-x'], ['din', r.S[2].legs[2], '-x'], ['din', r.S[1].legs[0], '-x', .5], ['din', r.S[1].legs[2], '-x', .5], ['din', r.S[0].legs[0], '-x', 1], ['din', r.S[0].legs[2], '-x', 1]] });

  lvl({ id: 'i4', w: 4, name: 'Fábrica Velha', tip: 'Naves de tijolo e uma chaminé no meio. Tudo abaixo da linha!',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 2.2, pct: .8, money: 5000, s2: 3600, s3: 2700,
    build(B) { const T = B.tower(-4, 0, { fl: 1, nx: 3, nz: 2, bay: 3.2, h: 4.5, wall: 'brick', slab: 'metal', st: .25 }); const C = B.chimney(6, 0, { h: 18 }); B.car(-4, 9, { kind: 'van' }); return { T, C }; },
    ref: (r) => [['din', r.T.col(0, 1, 1), '+x'], ['din', r.T.col(0, 2, 1), '-x'], ['din', r.T.col(0, 0, 0), '+x'], ['din', r.T.col(0, 3, 2), '-x'], ['din', r.C.base[1], '+x'], ['din', r.C.base[3], '+x']] });

  lvl({ id: 'i5', w: 4, name: 'Ponte Ferroviária', tip: 'Rebenta os pilares e o tabuleiro cai ao rio.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: .5, pct: .7, money: 3200, s2: 2300, s3: 1600, river: { x0: -12, x1: 12, depth: 5, bank: 0 },
    build(B) { const P = B.bridge(-14, 14, 0, { y: 4, piers: 3, base: -5 }); return { P }; },
    ref: (r) => [['din', r.P.piers[2], '+x'], ['din', r.P.piers[3], '+x'], ['din', r.P.piers[4], '-x'], ['pet', r.P.deck[0], '+y'], ['pet', r.P.deck[3], '+y']] });

lvl({ id: 'i6', w: 4, name: 'Depósito Gigante', tip: 'Um depósito enorme sobre pernas de betão, entre dois armazéns. Só há uma direção segura.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 4.5, pct: .7, money: 3200, s2: 2200, s3: 1500,
    build(B) { const S = B.silo(0, 0, { h: 13, d: 7, seg: 2.2, legs: 3.5, legMat: 'brick' }); B.tower(-12, 0, { fl: 1, nx: 2, nz: 2, h: 4, wall: 'brick', part: 'p', grp: B.grp(), slab: 'metal', st: .2 }); B.tower(12, 0, { fl: 1, nx: 2, nz: 2, h: 4, wall: 'brick', part: 'p', grp: B.grp(), slab: 'metal', st: .2 }); return { S }; },
    ref: (r) => [['din', r.S.legs[2], '+z'], ['din', r.S.legs[3], '+z']] });

  /* ── 6. Monumentos ── */
  lvl({ id: 'r1', w: 5, name: 'Pirâmide', tip: 'Pedra maciça, pesada e teimosa. O TNT no sítio certo resolve.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 2.5, pct: .75, money: 3200, s2: 2200, s3: 1400,
    build(B) { const P = B.pyramid(0, 0, { n: 5, s: 1.6, h: 1.2 }); B.deco('palm', 8, 6); B.deco('palm', -9, -5); return { P }; },
    ref: (r) => [['tnt', r.P.layers[1][4], '+y'], ['din', r.P.layers[0][12], '+y', .2]] });

  lvl({ id: 'r2', w: 5, name: 'Torre do Castelo', tip: 'Muralha grossa de pedra e uma torre de vigia. Os ninhos de cegonha… esses estão protegidos.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 3, pct: .8, money: 3600, s2: 2500, s3: 1800,
    build(B) { const M = B.masonry(0, 0, { w: 4.8, d: 4.8, h: 12, mat: 'stone', bl: 1.6, bh: .8, t: .8, cap: true }); B.deco('tree', 8, 5); return { M }; },
    ref: (r) => [['tnt', r.M.rows[0][1], '-z'], ['din', r.M.rows[1][5], '+x'], ['din', r.M.rows[1][3], '-x']] });

  lvl({ id: 'r4', w: 5, name: 'Arco Antigo', tip: 'Dois pilares grossos e um lintel pesado. Tira um pilar e o resto vem atrás.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 2, pct: .75, money: 2800, s2: 1900, s3: 1300,
    build(B) { const A = B.masonry(-4, 0, { w: 2.4, d: 2.4, h: 7.2, mat: 'stone', bl: 1.2 }); const C = B.masonry(4, 0, { w: 2.4, d: 2.4, h: 7.2, mat: 'stone', bl: 1.2 }); const L = B.box([0, 7.2 + .6, 0], [11, 1.2, 2.6], 'stone'); const T = B.box([0, 7.2 + 1.2 + .5, 0], [7, 1, 2.2], 'stone'); B.deco('palm', 9, 6); B.deco('palm', -10, -5); return { A, C, L, T }; },
    ref: (r) => [['din', r.A.rows[0][0], '-z'], ['din', r.A.rows[0][1], '+z'], ['din', r.C.rows[0][0], '-z'], ['din', r.C.rows[0][1], '+z']] });

lvl({ id: 'r5', w: 5, name: 'Aqueduto', tip: 'Uma fila de arcos de pedra. Um efeito dominó bem pensado poupa muito dinheiro.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 2.5, pct: .75, money: 3600, s2: 2500, s3: 1800,
    build(B) { const P = B.bridge(-18, 18, 0, { y: 7, piers: 5, w: 2.6, t: 1, mat: 'brick', abut: 0 }); return { P }; },
    ref: (r) => [2, 3, 4, 5, 6].map((k, i) => ['din', r.P.piers[k], '+x', i * .25]) });

lvl({ id: 'r6', w: 5, name: 'Coliseu', tip: 'Um anel de pilares de pedra com lintéis por cima. Faz o anel todo vir abaixo.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 2.5, pct: .8, money: 5000, s2: 3500, s3: 2500,
    build(B) {
      const N = 10, R = 9, P = [], Ls = [];
      for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; P.push(B.box([Math.cos(a) * R, 3, Math.sin(a) * R], [1.6, 6 - .004, 1.6], 'brick', { rotY: -a })); }
      for (let k = 0; k < N; k++) { const a = (k + .5) / N * Math.PI * 2, len = 2 * R * Math.sin(Math.PI / N) - .9; Ls.push(B.box([Math.cos(a) * R * Math.cos(Math.PI / N), 6.5, Math.sin(a) * R * Math.cos(Math.PI / N)], [1.4, 1, len], 'brick', { rotY: -a })); }
      B.deco('palm', 15, 8); B.deco('palm', -15, -7); return { P, Ls };
    },
    ref: (r) => r.P.map((id, k) => ['din', id, '+x', k * .1]) });

lvl({ id: 'r3', w: 5, name: 'Mega Torre', tip: 'A obra final: catorze andares no meio da cidade. Mostra o que aprendeste.',
    kit: ['pet', 'din', 'cut', 'imp', 'tnt'], line: 6, pct: .85, money: 7000, s2: 5200, s3: 4200,
    build(B) { const T = B.tower(0, 0, { fl: 14, nx: 2, nz: 2, bay: 3.2, wall: f => (f % 2 ? 'glass' : 'facade'), wt: .14, wall0: false, roof: true, split: 2, h: 3.1 }); B.tower(-17, 0, { fl: 4, nx: 1, nz: 2, part: 'p', grp: B.grp(), tint: '#d6c7b2' }); B.car(12, 12, {}); return { T }; },
    ref: (r) => [['tnt', r.T.col(0, 1, 1), '+x'], ['tnt', r.T.col(1, 1, 1), '+x', .5], ['din', r.T.col(0, 2, 0), '-x'], ['din', r.T.col(0, 2, 2), '-x'], ['din', r.T.col(0, 0, 0), '+x', .3], ['din', r.T.col(0, 0, 2), '+x', .3]] });

  /* soluções verificadas pelo solucionador (node_modules/.demo-solve.cjs): a mais barata que ainda
     resolve com as cargas noutros pontos das faces. par = custo para ★★★; dão também as dicas. */
  const SOLS = {
    p2: { par: 350, sol: [['cut', 2, '+x', 0]] },
    p6: { par: 700, sol: [['cut', 1, '-x', 0], ['cut', 14, '+x', 0]] },
    b1: { par: 1200, sol: [['pet', 0, '-z', 0], ['din', 1, '-z', 0], ['din', 2, '-x', 0], ['din', 3, '+z', 0], ['pet', 4, '+z', 0], ['din', 5, '+x', 0]] },
    b2: { par: 750, sol: [['din', 6, '-z', 0], ['din', 7, '+x', 0], ['din', 8, '+z', 0]] },
    b3: { par: 200, sol: [['pet', 1, '+x', 0], ['pet', 3, '+x', 0]] },
    b4: { par: 500, sol: [['din', 7, '+z', 0], ['din', 10, '+z', 0]] },
    b5: { par: 1000, sol: [['din', 16, '-x', 0], ['din', 17, '+x', 0], ['din', 18, '+x', 0], ['din', 19, '+x', 0]] },
    b6: { par: 550, sol: [['pet', 10, '+y', 0.3], ['pet', 11, '+y', 0.3], ['pet', 12, '+y', 0.3], ['din', 20, '+y', 0]] },
    c1: { par: 750, sol: [['din', 2, '-z', 0], ['din', 5, '-z', 0], ['din', 4, '+z', 0]] },
    c2: { par: 1000, sol: [['din', 2, '+z', 0], ['din', 5, '+z', 0], ['din', 67, '+z', 0], ['din', 68, '+z', 0]] },
    c3: { par: 1000, sol: [['din', 3, '-z', 0], ['din', 4, '+x', 0], ['din', 5, '+z', 0], ['din', 8, '+z', 0]] },
    c4: { par: 750, sol: [['din', 6, '-z', 0], ['din', 7, '+x', 0], ['din', 8, '+z', 0]] },
    c5: { par: 750, sol: [['din', 5, '-z', 0.24], ['din', 7, '-z', 0.36], ['din', 9, '-z', 0.48]] },
    c6: { par: 1250, sol: [['din', 3, '+z', 0], ['din', 5, '+z', 0], ['din', 83, '+x', 0.4], ['din', 80, '+x', 0.4], ['din', 84, '+x', 0.4]] },
    i1: { par: 350, sol: [['pet', 2, '+z', 0], ['din', 3, '+z', 0]] },
    i2: { par: 700, sol: [['cut', 3, '+x', 0.3], ['cut', 5, '-x', 0.3]] },
    i3: { par: 750, sol: [['din', 22, '-x', 0], ['din', 24, '-x', 0], ['din', 13, '-x', 0.5]] },
    i4: { par: 200, sol: [['pet', 29, '+x', 0], ['pet', 31, '+x', 0]] },
    i5: { par: 250, sol: [['din', 4, '-x', 0]] },
    i6: { par: 500, sol: [['din', 2, '+z', 0], ['din', 3, '+z', 0]] },
    o1: { par: 200, sol: [['pet', 2, '-x', 0], ['pet', 1, '+x', 0]] },
    o2: { par: 800, sol: [['pet', 12, '+z', 0], ['pet', 13, '+z', 0], ['pet', 14, '-x', 0], ['pet', 15, '-x', 0], ['pet', 16, '-x', 0], ['pet', 17, '+x', 0], ['pet', 18, '+x', 0], ['pet', 19, '+x', 0]] },
    o3: { par: 400, sol: [['pet', 2, '+z', 0], ['pet', 3, '-z', 0], ['pet', 2, '+z', 0], ['pet', 3, '-z', 0]] },
    o4: { par: 750, sol: [['din', 4, '+x', 0], ['din', 5, '+z', 0], ['din', 7, '+x', 0]] },
    o5: { par: 500, sol: [['din', 2, '-z', 0], ['din', 4, '-z', 0]] },
    o6: { par: 500, sol: [['din', 58, '+z', 0], ['din', 119, '+z', 0]] },
    p1: { par: 200, sol: [['imp', 2, '+z', 0]] },
    p3: { par: 1500, sol: [['din', 28, '+z', 0], ['din', 30, '+x', 0], ['din', 31, '-x', 0], ['din', 32, '+x', 0], ['din', 33, '-x', 0], ['din', 34, '+x', 0]] },
    p4: { par: 700, sol: [['cut', 1, '+x', 0], ['cut', 3, '+x', 0]] },
    p5: { par: 700, sol: [['cut', 1, '+x', 0], ['cut', 9, '+x', 0.2]] },
    r1: { par: 700, sol: [['tnt', 29, '+y', 0]] },
    r2: { par: 1200, sol: [['tnt', 1, '-z', 0], ['din', 15, '+x', 0], ['din', 13, '-x', 0]] },
    r3: { par: 750, sol: [['din', 3, '-z', 0], ['din', 6, '-z', 0], ['din', 7, '+x', 0]] },
    r4: { par: 1000, sol: [['din', 0, '-z', 0], ['din', 1, '+z', 0], ['din', 72, '-z', 0], ['din', 73, '+z', 0]] },
    r5: { par: 850, sol: [['din', 3, '+x', 0.25], ['pet', 4, '+x', 0.5], ['din', 5, '+x', 0.75], ['din', 6, '+x', 1]] },
    r6: { par: 2000, sol: [['din', 2, '+x', 0.2], ['din', 3, '+x', 0.30000000000000004], ['din', 4, '+x', 0.4], ['din', 5, '+x', 0.5], ['din', 6, '+x', 0.6000000000000001], ['din', 7, '+x', 0.7000000000000001], ['din', 8, '+x', 0.8], ['din', 9, '+x', 0.9]] },
  };

  /* monta um nível: blocos + referências */
  function build(i) {
    const D = L[i], B = Builder();
    const refs = D.build(B);
    const S = SOLS[D.id], up = (v, k) => Math.ceil(v / k) * k;
    /* estrelas e orçamento a partir da solução verificada */
    const eco = S ? { s3: S.par, s2: up(S.par * 1.5, 50), money: Math.max(up(S.par * 2.6, 100), S.par + 500) } : {};
    /* semente pelo id (não pela posição na lista: inserir níveis não pode mudar as fraturas dos outros) */
    let hs = 7; for (const ch of D.id) hs = (Math.imul(hs, 31) + ch.charCodeAt(0)) >>> 0;
    return Object.assign({}, D, eco, { index: i, blocks: B.blocks, deco: B.decos, statics: river(D, B.statics), refs, seed: 1000 + hs % 9973, world: WORLDS[D.w] });
  }
  /* rio: duas margens + leito (o chão infinito sai) */
  function river(D, st) {
    if (!D.river) return st;
    const R = D.river;
    return st.concat([
      { pos: [R.x0 - 100, -R.depth / 2, 0], size: [200, R.depth, 400], bank: 1 },
      { pos: [R.x1 + 100, -R.depth / 2, 0], size: [200, R.depth, 400], bank: 1 },
    ]);
  }
  /* solução de referência → cargas [tipo, peça, ponto, normal, atraso] */
  function refCharges(lv) {
    const S = SOLS[lv.id];
    if (S) return S.sol.map(([type, id, f, delay]) => { const fc = face(lv.blocks[id], f, 0, -.3); return { type, id, lp: fc[0], ln: fc[1], delay: delay || 0 }; });
    if (!lv.ref) return [];
    return lv.ref(lv.refs).map(([type, id, f, delay, u, v]) => { const fc = face(lv.blocks[id], f, u, v); return { type, id, lp: fc[0], ln: fc[1], delay: delay || 0 }; });
  }

  return { LEVELS: L, WORLDS, SOLS, build, refCharges, face };
})();
if (typeof module !== 'undefined') module.exports = DemoLevels;
