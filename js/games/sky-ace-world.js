/* ══════════════════════════════════════════════════════════════════
   Ás dos Céus — o mundo 3D (out/2026)
   Tudo gerado aqui, sem modelos nem texturas externas:
     • terreno procedural (ruído de Perlin + máscaras por tipo de mapa),
       com cores por altura/declive, textura de pormenor, árvores e vilas
       instanciadas; a altura para a física usa a MESMA triangulação
     • céu em shader (gradiente, sol, estrelas, aurora) também usado como
       mapa de ambiente (reflexos na água e na fuselagem)
     • água com mapa de normais animado, nuvens instanciadas (1 draw call)
     • caças, drones, unidades de terra, navios e a Fortaleza Celeste
     • efeitos: partículas em Points (fumo e fogo), rastos em fita,
       traçadoras instanciadas, destroços e explosões
   Escala: 1 unidade = 1 metro. O mapa tem 24 km de lado, mar à volta.
   Modelos: nariz para +Z, cima +Y, asa direita para −X.
══════════════════════════════════════════════════════════════════ */
const SkyAceWorld = (function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const SIZE = 24000;
  const UNDER = 1.8;   /* fundo do mar visual = altura × UNDER (só abaixo de 0) */

  /* ── aleatório com semente e ruído de Perlin 2D ── */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function perlin(seed) {
    const r = rng(seed), P = new Uint16Array(512), GX = new Float32Array(256), GY = new Float32Array(256), perm = [];
    for (let i = 0; i < 256; i++) { const a = r() * TAU; GX[i] = Math.cos(a); GY[i] = Math.sin(a); perm.push(i); }
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
      const g = (ix, iy, dx, dy) => { const h = P[P[ix] + iy]; return GX[h] * dx + GY[h] * dy; };
      const u = fade(xf), v = fade(yf);
      const a = lerp(g(X, Y, xf, yf), g(X + 1, Y, xf - 1, yf), u), b = lerp(g(X, Y + 1, xf, yf - 1), g(X + 1, Y + 1, xf - 1, yf - 1), u);
      return lerp(a, b, v) * 1.41;
    };
  }
  const fbm = (n, x, y, o) => { let a = 1, f = 1, s = 0, t = 0; for (let i = 0; i < o; i++) { s += n(x * f, y * f) * a; t += a; a *= .5; f *= 2.03; } return s / t; };
  const ridged = (n, x, y, o) => { let a = 1, f = 1, s = 0, t = 0, w = 1; for (let i = 0; i < o; i++) { let v = 1 - Math.abs(n(x * f, y * f)); v *= v; v *= w; w = clamp(v * 1.7, 0, 1); s += v * a; t += a; a *= .5; f *= 2.1; } return s / t; };

  /* ════════════════════════════════════════════════════════════════
     mapas e céus
  ════════════════════════════════════════════════════════════════ */
  const PAL = {
    temperate: { sand: '#d9c79a', grass: '#5f8a3a', grass2: '#7c9a45', forest: '#3d6b2e', rock: '#7d7468', rock2: '#5e5850', snow: '#f4f6fa', seabed: '#1f5a66', snowLine: 1100, tree: 'leaf' },
    alpine: { sand: '#b9b29a', grass: '#56803a', grass2: '#6f8f4a', forest: '#2f5530', rock: '#7a7570', rock2: '#57534f', snow: '#f7f9fc', seabed: '#24515e', snowLine: 1250, tree: 'pine' },
    tropic: { sand: '#efe0b0', grass: '#4f9a3c', grass2: '#76b04a', forest: '#2f7a35', rock: '#6f6a5f', rock2: '#4f4b44', snow: '#e8e8e0', seabed: '#1aa3a6', snowLine: 9999, tree: 'palm' },
    rocky: { sand: '#bdb39a', grass: '#59744a', grass2: '#6d7f55', forest: '#3e5a3a', rock: '#6c6a66', rock2: '#4b4a48', snow: '#eef0f3', seabed: '#244b58', snowLine: 900, tree: 'pine' },
    desert: { sand: '#d8a86a', grass: '#b98a52', grass2: '#c99a60', forest: '#8a6a3a', rock: '#b4562f', rock2: '#8a3b22', snow: '#f0d6b0', seabed: '#2a6f73', snowLine: 9999, tree: 'rock', strata: true },
    arctic: { sand: '#a7a9ab', grass: '#8d9a8f', grass2: '#a8b3ab', forest: '#2f4a40', rock: '#5d6670', rock2: '#3e454e', snow: '#eef4fb', seabed: '#14354a', snowLine: 250, tree: 'pine' },
  };
  const MAPS = {
    coast: { name: 'Costa Dourada', seed: 11, kind: 'coast', maxH: 1150, pal: 'temperate', water: '#1a5874', shallow: '#3aa39b', towns: 4 },
    alps: { name: 'Cordilheira Branca', seed: 23, kind: 'alps', maxH: 2300, pal: 'alpine', water: '#1c4a60', shallow: '#3f8c88', towns: 3 },
    isles: { name: 'Arquipélago Esmeralda', seed: 37, kind: 'isles', maxH: 820, pal: 'tropic', water: '#0f6f86', shallow: '#36cfc0', towns: 3 },
    ocean: { name: 'Mar Cinzento', seed: 41, kind: 'ocean', maxH: 620, pal: 'rocky', water: '#21495a', shallow: '#4a8783', towns: 1 },
    canyon: { name: 'Desfiladeiro Rubro', seed: 53, kind: 'canyon', maxH: 900, pal: 'desert', water: '#265f72', shallow: '#56a597', towns: 1 },
    arctic: { name: 'Fiorde Boreal', seed: 67, kind: 'arctic', maxH: 1500, pal: 'arctic', water: '#112f42', shallow: '#2f6a78', towns: 1 },
  };
  /* cores em sRGB (o three converte para linear) */
  const SKIES = {
    morning: { name: 'Manhã', top: '#3a74c4', hor: '#f2d6b4', bot: '#90a9be', sun: '#ffdcae', sunDir: [.55, .22, -.8], sunI: 2.6, hemiSky: '#bcd2ef', hemiGnd: '#6b5a48', hemi: 1.1, fog: '#d8d2c8', fogNear: 2500, fogFar: 26000, exp: 1.0, cloud: '#fff6ec', cloudShade: '#a9b2c2', clouds: 70 },
    noon: { name: 'Meio-dia', top: '#1f63c9', hor: '#b9d4ee', bot: '#8aa4bc', sun: '#fff6e6', sunDir: [.3, .85, -.42], sunI: 2.8, hemiSky: '#c9dcf4', hemiGnd: '#5d5a4a', hemi: 1.2, fog: '#c3d5e6', fogNear: 3000, fogFar: 30000, exp: .95, cloud: '#ffffff', cloudShade: '#b2bccb', clouds: 80 },
    sunset: { name: 'Pôr do sol', top: '#26336c', hor: '#ff9a5a', bot: '#5a4a5c', sun: '#ffb26a', sunDir: [-.82, .07, -.56], sunI: 2.4, hemiSky: '#ffb991', hemiGnd: '#3d3040', hemi: .95, fog: '#d99779', fogNear: 2000, fogFar: 24000, exp: 1.05, cloud: '#ffc9a0', cloudShade: '#7d6880', clouds: 75 },
    overcast: { name: 'Nublado', noFlare: 1, top: '#66778a', hor: '#b5bec6', bot: '#7d8790', sun: '#e9eef3', sunDir: [.2, .7, .5], sunI: 1.3, hemiSky: '#c5cfd8', hemiGnd: '#4e5257', hemi: 1.5, fog: '#a9b3bb', fogNear: 1200, fogFar: 17000, exp: 1.05, cloud: '#e7ebef', cloudShade: '#868f99', clouds: 150, layer: true },
    afternoon: { name: 'Tarde', top: '#2d6bc0', hor: '#f1cfa3', bot: '#a4927e', sun: '#ffe2b5', sunDir: [-.45, .45, .7], sunI: 2.7, hemiSky: '#d9d3c4', hemiGnd: '#7a5338', hemi: 1.1, fog: '#e2c9a6', fogNear: 2600, fogFar: 27000, exp: .98, cloud: '#fff4e2', cloudShade: '#b59f8f', clouds: 40 },
    night: { name: 'Noite boreal', top: '#030616', hor: '#12284a', bot: '#081222', sun: '#9cb8ff', sunDir: [.35, .5, .78], sunI: .9, hemiSky: '#4e6aa8', hemiGnd: '#101826', hemi: .9, fog: '#0f2240', fogNear: 1800, fogFar: 20000, exp: 1.25, cloud: '#6d82a8', cloudShade: '#1d2740', clouds: 45, stars: 1, aurora: 1, moon: 1 },
  };

  /* ════════════════════════════════════════════════════════════════
     terreno
  ════════════════════════════════════════════════════════════════ */
  /* trajeto do desfiladeiro (mapa canyon): x em função de z */
  const canyonX = z => Math.sin(z * TAU / 13000) * 2300 + Math.sin(z * TAU / 4100 + 1.3) * 650;
  const canyonSlope = z => Math.cos(z * TAU / 13000) * 2300 * TAU / 13000 + Math.cos(z * TAU / 4100 + 1.3) * 650 * TAU / 4100;

  Object.values(SKIES).forEach(s => { s.fog = s.hor; });

  function heightFn(map) {
    const n1 = perlin(map.seed), n2 = perlin(map.seed + 101), n3 = perlin(map.seed + 202), n4 = perlin(map.seed + 303);
    const H = map.maxH, kind = map.kind;
    return function (x, z) {
      const u = x / SIZE, v = z / SIZE, d = Math.hypot(u, v);
      const wx = fbm(n3, u * 2 + 7.1, v * 2 + 3.3, 3) * .12, wz = fbm(n3, u * 2 - 4.2, v * 2 + 9.7, 3) * .12;
      const base = fbm(n1, (u + wx) * 3.1, (v + wz) * 3.1, 5);
      const det = fbm(n2, u * 24, v * 24, 4);
      let c, h;
      if (kind === 'canyon') {
        /* planalto em socalcos, cortado por um desfiladeiro sinuoso */
        c = .9 - d * .5 + base * .25;
        const p = 420 + fbm(n2, u * 5, v * 5, 4) * 260 + ridged(n4, u * 6, v * 6, 4) * 160;
        const ter = Math.floor(p / 55) * 55, tf = (p - ter) / 55;
        let hp = ter + sstep(.55, 1, tf) * 55 + det * 6;
        const k = canyonSlope(z), dc = Math.abs(x - canyonX(z)) / Math.sqrt(1 + k * k);
        const w = 210 + fbm(n4, v * 9, 1.7, 3) * 120;
        const floor = 55 + det * 10 + fbm(n2, v * 14, 5.5, 3) * 25;
        const carve = 1 - sstep(w * .55, w * 1.35, dc);
        hp = lerp(hp, floor, carve);
        /* ravinas laterais */
        const rv = ridged(n3, u * 9, v * 9, 3);
        hp -= sstep(.82, .97, rv) * 140 * (1 - carve);
        const edge = sstep(.5, .43, Math.max(Math.abs(u), Math.abs(v)));
        c = lerp(-.4, c, edge);
        h = c > 0 ? hp * sstep(0, .2, c) : c * 260;
        return h;
      }
      if (kind === 'coast') c = -v * 2.4 + .22 + base * .75 - Math.max(0, d - .38) * 3;
      else if (kind === 'alps') c = .95 - d * 1.55 + base * .5;
      else if (kind === 'isles') c = base * 1.5 + .12 - d * .95;
      else if (kind === 'ocean') c = base * 1.35 - .3 - d * .35;
      else c = .75 - d * 1.2 + base * .6;   /* arctic */
      const edge = sstep(.5, .42, Math.max(Math.abs(u), Math.abs(v)));
      c = lerp(-.45, c, edge);
      const hills = (fbm(n2, u * 7, v * 7, 5) * .5 + .5) * (kind === 'alps' ? 380 : 170);
      let rg = ridged(n4, (u + wx) * (kind === 'alps' ? 4.2 : 5.5), (v + wz) * (kind === 'alps' ? 4.2 : 5.5), 6);
      rg = rg * rg;
      const mm = sstep(kind === 'isles' ? .22 : .12, kind === 'alps' ? .45 : .65, c);
      if (kind === 'arctic') {
        /* fiordes: canais estreitos de mar entre as montanhas */
        const fj = ridged(n3, u * 4.5 + 3, v * 4.5 - 2, 3);
        c -= sstep(.78, .95, fj) * .9;
      }
      if (c <= 0) return Math.max(-260, c * 280);
      h = 6 + sstep(0, .12, c) * (hills + det * 14) + rg * H * mm + c * 30;
      return h * sstep(0, .06, c) + (1 - sstep(0, .06, c)) * c * 40;
    };
  }

  /* grelha de alturas (mesma triangulação do PlaneGeometry) */
  function heightGrid(map, seg) {
    const fn = heightFn(map), n = seg + 1, step = SIZE / seg, data = new Float32Array(n * n), h0 = -SIZE / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = fn(h0 + i * step, h0 + j * step);
    function at(x, z) {
      const gx = (x - h0) / step, gz = (z - h0) / step;
      if (gx < 0 || gz < 0 || gx >= seg || gz >= seg) return -280;
      const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * n + i;
      const ha = data[k], hb = data[k + n], hc = data[k + n + 1], hd = data[k + 1];
      return fx + fz <= 1 ? ha + (hd - ha) * fx + (hb - ha) * fz : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
    }
    /* normal aproximada (para declives) */
    function slope(x, z) { const e = step; const dx = at(x + e, z) - at(x - e, z), dz = at(x, z + e) - at(x, z - e); return 1 / Math.sqrt(1 + (dx * dx + dz * dz) / (4 * e * e)); }
    return { data, n, step, seg, fn, at, slope };
  }

  /* procura um sítio em terra plana (ou em mar fundo) perto de (x,z) */
  function findSite(hg, x, z, o = {}) {
    const want = o.water ? 'water' : 'land', r0 = o.r || 0, rn = rng(o.seed || (Math.abs(x * 7 + z * 13) | 0) + 1);
    for (let k = 0; k < 400; k++) {
      const a = rn() * TAU, rr = r0 + k * (o.stepR || 35) * rn();
      const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, h = hg.at(px, pz);
      if (Math.abs(px) > SIZE * .44 || Math.abs(pz) > SIZE * .44) continue;
      if (want === 'water' ? h < (o.depth || -25) : (h > (o.minH != null ? o.minH : 8) && h < (o.maxH || 5000) && hg.slope(px, pz) > (o.flat || .93))) return { x: px, z: pz, y: Math.max(0, h) };
    }
    return { x, z, y: Math.max(0, hg.at(x, z)) };
  }

  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /* ruído de gradiente periódico e isotrópico (células quadradas em todas as oitavas: sem "veios") */
  function pnoise(N, octs, seed) {
    const out = new Float32Array(N * N), r = rng(seed || 5), fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    octs.forEach(([g, amp]) => {
      const ang = new Float32Array(g * g).map(() => r() * TAU), c = N / g;
      const gr = (i, j, dx, dy) => { const a = ang[(j % g) * g + (i % g)]; return Math.cos(a) * dx + Math.sin(a) * dy; };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i / c, y = j / c, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, u = fade(fx), v = fade(fy);
        out[j * N + i] += lerp(lerp(gr(x0, y0, fx, fy), gr(x0 + 1, y0, fx - 1, fy), u), lerp(gr(x0, y0 + 1, fx, fy - 1), gr(x0 + 1, y0 + 1, fx - 1, fy - 1), u), v) * amp;
      }
    });
    return out;
  }
  /* textura de pormenor do chão (multiplica as cores de vértice): manchas de várias escalas, tufos e pedrinhas;
     no shader passa pelo Arcade3D.noTile, por isso não se vê a repetição */
  let _detail = null;
  function detailTex(rep) {
    if (!_detail) {
      const N = 256, n = pnoise(N, [[4, 1], [8, .6], [16, .4], [32, .25], [64, .16]], 5), r = rng(19);
      _detail = canvasTex(N, N, (x) => {
        const img = x.createImageData(N, N), d = img.data;
        for (let k = 0; k < N * N; k++) { const g = clamp(.84 + n[k] * .22 + (r() - .5) * .06, 0, 1) * 255; d[k * 4] = g; d[k * 4 + 1] = g * (1.005 + n[k] * .01); d[k * 4 + 2] = g * .985; d[k * 4 + 3] = 255; }
        x.putImageData(img, 0, 0);
        for (let i = 0; i < 900; i++) { const v = r() < .55 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${.05 + r() * .07})`; const px = r() * N, py = r() * N, s = .8 + r() * 2.2; x.fillRect(px, py, s, s); x.fillRect(px - N, py, s, s); x.fillRect(px, py - N, s, s); }
      });
      _detail.wrapS = _detail.wrapT = THREE.RepeatWrapping; _detail.anisotropy = 8; _detail.userData.shared = true;
    }
    const t = _detail.clone(); t.needsUpdate = true; t.repeat.set(rep || 220, rep || 220);
    return t;
  }

  function buildTerrain(map, hg, quality) {
    const pal = PAL[map.pal], seg = hg.seg;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, hg.data[k]);
    geo.computeVertexNormals();
    const nor = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color(), t = new THREE.Color();
    const C = {}; Object.keys(pal).forEach(k => { if (typeof pal[k] === 'string' && pal[k][0] === '#') C[k] = new THREE.Color(pal[k]); });
    const nz = perlin(map.seed + 7);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), ny = nor.getY(k);
      const v = nz(x / 900, z / 900) * .5 + nz(x / 170, z / 170) * .25;
      if (y < 2) { c.copy(C.sand).lerp(C.seabed, sstep(1, -60, y)); }
      else if (y < 14 + v * 8 && ny > .9) c.copy(C.sand);
      else {
        c.copy(C.grass).lerp(C.grass2, clamp(v + .5, 0, 1));
        if (v > .12 && y < 900) c.lerp(C.forest, sstep(.12, .35, v) * .8);
        const rk = sstep(.86, .7, ny);
        t.copy(C.rock).lerp(C.rock2, clamp(.5 - v, 0, 1));
        if (pal.strata) { const s = Math.sin(y * .09 + v * 2) * .5 + .5; t.lerp(C.sand, s * .45); }
        c.lerp(t, Math.max(rk, sstep(pal.snowLine * .75, pal.snowLine * 1.15, y) * .6 * (pal.snowLine < 9000 ? 1 : 0)));
        if (pal.strata) c.lerp(t, sstep(.97, .88, ny));
        const sn = sstep(pal.snowLine + v * 120, pal.snowLine + 160 + v * 120, y) * sstep(.55, .75, ny);
        c.lerp(C.snow, sn);
      }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    /* debaixo de água o fundo desce mais depressa: a costa deixa de ser quase paralela à água (menos tremido ao longe) */
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); if (y < 0) pos.setY(k, y * UNDER); }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = Arcade3D.noTile(new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex(), roughness: .96, metalness: 0, envMapIntensity: .35 }), { macro: .2, wide: .45 });
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true;
    mesh.name = 'terrain';
    return mesh;
  }

  /* junta geometrias (com cores de vértice) numa só */
  function mergeGeos(list) {
    let n = 0; const parts = list.map(([g, color, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m); n += q.attributes.position.count; return [q, new THREE.Color(color)]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    parts.forEach(([q, c]) => { const p = q.attributes.position, nn = q.attributes.normal; for (let i = 0; i < p.count; i++, o++) { pos[o * 3] = p.getX(i); pos[o * 3 + 1] = p.getY(i); pos[o * 3 + 2] = p.getZ(i); nor[o * 3] = nn.getX(i); nor[o * 3 + 1] = nn.getY(i); nor[o * 3 + 2] = nn.getZ(i); col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b; } q.dispose(); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));

  function treeGeo(kind) {
    if (kind === 'pine') return mergeGeos([[new THREE.CylinderGeometry(.5, .7, 4, 5), '#5a3d28', M4(0, 2, 0)], [new THREE.ConeGeometry(3.6, 8, 7), '#ffffff', M4(0, 7, 0)], [new THREE.ConeGeometry(2.7, 6, 7), '#ffffff', M4(0, 11, 0)], [new THREE.ConeGeometry(1.7, 4.5, 7), '#ffffff', M4(0, 14.3, 0)]]);
    if (kind === 'palm') return mergeGeos([[new THREE.CylinderGeometry(.35, .55, 11, 5), '#7a5a3a', M4(0, 5.5, 0, 0, 0, .1)], ...[0, 1, 2, 3, 4].map(i => [new THREE.ConeGeometry(1.2, 6, 4), '#ffffff', M4(Math.cos(i * 1.256) * 2.4, 10.6, Math.sin(i * 1.256) * 2.4, Math.sin(i * 1.256) * 1.2, 0, -Math.cos(i * 1.256) * 1.2, 1, 1, .4)])]);
    if (kind === 'rock') return mergeGeos([[new THREE.IcosahedronGeometry(4, 0), '#ffffff', M4(0, 1.5, 0, 0, 0, 0, 1.3, .7, 1)], [new THREE.IcosahedronGeometry(2.5, 0), '#ffffff', M4(3, 1, 1.5, .5, .3, 0)]]);
    return mergeGeos([[new THREE.CylinderGeometry(.6, .8, 5, 5), '#5c4030', M4(0, 2.5, 0)], [new THREE.IcosahedronGeometry(4.2, 0), '#ffffff', M4(0, 8, 0, 0, 0, 0, 1, 1.15, 1)], [new THREE.IcosahedronGeometry(3, 0), '#ffffff', M4(2, 6.5, 1, .4, .2, 0)]]);
  }
  /* árvores e rochas instanciadas */
  function buildFlora(map, hg, count) {
    const pal = PAL[map.pal], kind = pal.tree, geo = treeGeo(kind);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0, flatShading: true, envMapIntensity: .3 });
    const im = new THREE.InstancedMesh(geo, mat, count), r = rng(map.seed * 3 + 1), forest = perlin(map.seed + 44), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const base = new THREE.Color(kind === 'rock' ? pal.rock : pal.forest), alt = new THREE.Color(kind === 'rock' ? pal.rock2 : pal.grass);
    let n = 0;
    for (let tries = 0; tries < count * 14 && n < count; tries++) {
      const x = (r() - .5) * SIZE * .9, z = (r() - .5) * SIZE * .9, h = hg.at(x, z);
      if (h < 12 || h > (kind === 'rock' ? 2000 : Math.min(1300, pal.snowLine + 100))) continue;
      const fo = forest(x / 1400, z / 1400) + forest(x / 400, z / 400) * .3;
      if (fo < (kind === 'rock' ? .05 : -.05) || hg.slope(x, z) < .86) continue;
      /* em grupos: várias à volta */
      const g = 1 + Math.floor(r() * 6);
      for (let k = 0; k < g && n < count; k++) {
        const px = x + (r() - .5) * 90, pz = z + (r() - .5) * 90, ph = hg.at(px, pz);
        if (ph < 10) continue;
        const sc = (kind === 'rock' ? 1.2 + r() * 3 : .8 + r() * .8);
        q.setFromAxisAngle(up, r() * TAU); s.set(sc, sc * (kind === 'rock' ? .6 + r() * .6 : .85 + r() * .4), sc); p.set(px, ph - .5, pz);
        m.compose(p, q, s); im.setMatrixAt(n, m);
        c.copy(base).lerp(alt, r() * .6); if (kind === 'pine' && ph > pal.snowLine - 150) c.lerp(new THREE.Color('#dfe8ee'), .4);
        im.setColorAt(n, c); n++;
      }
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true; im.frustumCulled = false;
    return im;
  }
  /* vilas: casas e torres em caixas instanciadas */
  function buildTowns(map, hg, n) {
    const r = rng(map.seed * 7 + 3), box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: .8, metalness: .05, envMapIntensity: .4 });
    const im = new THREE.InstancedMesh(box, mat, n * 90), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const cols = map.pal === 'arctic' ? ['#c44b3c', '#3d5a80', '#e6c36a', '#e9edf1'] : map.pal === 'desert' ? ['#d9b98a', '#c9a070', '#e8d5b0'] : ['#e8e2d6', '#d8c9b0', '#c97a5a', '#f1ece4', '#a9b4bd'];
    let k = 0; const towns = [];
    for (let t = 0; t < n; t++) {
      const site = findSite(hg, (r() - .5) * SIZE * .7, (r() - .5) * SIZE * .7, { minH: 6, maxH: 400, flat: .97, seed: t * 31 + 7 });
      towns.push(site);
      const ang = r() * Math.PI;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      for (let b = 0; b < 90; b++) {
        const rr = Math.pow(r(), .7) * 520, a = r() * TAU;
        const x = site.x + Math.cos(a) * rr, z = site.z + Math.sin(a) * rr, h = hg.at(x, z);
        if (h < 3 || hg.slope(x, z) < .95) continue;
        const core = 1 - rr / 520, tall = r() < core * .25;
        const w = 10 + r() * 14, d = 10 + r() * 16, hh = tall ? 25 + r() * 55 : 6 + r() * 9;
        m.compose(new THREE.Vector3(x, h - 1, z), q, new THREE.Vector3(w, hh, d)); im.setMatrixAt(k, m);
        c.set(tall ? '#9aa6b2' : cols[Math.floor(r() * cols.length)]); im.setColorAt(k, c); k++;
      }
    }
    im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.receiveShadow = true; im.frustumCulled = false;
    return { mesh: im, towns };
  }

  /* ════════════════════════════════════════════════════════════════
     céu (cúpula em shader) e ambiente
  ════════════════════════════════════════════════════════════════ */
  const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`;
  const SKY_FS = `
    uniform vec3 uTop, uHor, uBot, uSun, uSunDir; uniform float uStars, uAurora, uTime, uMoon;
    varying vec3 vDir;
    float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHor, uTop, 1. - pow(1. - clamp(h, 0., 1.), 3.2));
      col = mix(col, uBot, smoothstep(-0.12, -0.6, h));
      float sd = max(dot(d, normalize(uSunDir)), 0.);
      if (uMoon > .5) {
        col += uSun * (smoothstep(.9994, .9997, sd) * 2.2 + pow(sd, 120.) * .25);
      } else {
        col += uSun * (smoothstep(.9990, .9995, sd) * 14. + pow(sd, 260.) * 1.3 + pow(sd, 18.) * .32 + pow(sd, 3.) * .1 * (1.-clamp(h*2.,0.,1.)));
      }
      if (uStars > .5) {
        vec3 q = floor(d * 420.); float s = hash(q);
        float tw = .6 + .4 * sin(uTime * 2. + s * 50.);
        col += vec3(.85,.9,1.) * step(.9975, s) * smoothstep(0.02, .3, h) * tw * 1.4;
      }
      if (uAurora > .5 && h > 0.) {
        float band = sin(d.x * 5.5 + uTime * .05 + sin(d.z * 3.1 + uTime * .08) * 2.2);
        float a = smoothstep(.55, 1., band) * smoothstep(.04, .2, h) * (1. - smoothstep(.45, .85, h));
        float curtain = .55 + .45 * sin(d.x * 60. + d.z * 40. + uTime * .6);
        col += mix(vec3(.1, 1., .55), vec3(.6, .2, 1.), smoothstep(.15, .5, h)) * a * curtain * 1.1;
      }
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function skyMesh(sky) {
    const u = {
      uTop: { value: new THREE.Color(sky.top) }, uHor: { value: new THREE.Color(sky.hor) }, uBot: { value: new THREE.Color(sky.bot) },
      uSun: { value: new THREE.Color(sky.sun) }, uSunDir: { value: new THREE.Vector3(...sky.sunDir).normalize() },
      uStars: { value: sky.stars ? 1 : 0 }, uAurora: { value: sky.aurora ? 1 : 0 }, uTime: { value: 0 }, uMoon: { value: sky.moon ? 1 : 0 },
    };
    const m = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    m.renderOrder = -10; m.frustumCulled = false;
    return m;
  }
  function skyEnv(renderer, sky) {
    const s = new THREE.Scene(), m = skyMesh(sky);
    m.material.uniforms.uStars.value = 0; m.material.uniforms.uAurora.value = 0;
    s.add(m);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, 0, .1, 2000).texture; pm.dispose();
    m.geometry.dispose(); m.material.dispose();
    return tex;
  }

  /* o: { tile, chop, clear, foam, shallow, depth: { fn, x, z, size, res }, size (lado do plano), at: [x, z] } — ver Arcade3D.water */
  function buildWater(map, env, o = {}) {
    const mat = Arcade3D.water({ color: map.water, shallow: o.shallow || map.shallow || '#3aa6a0', tile: o.tile || 48, chop: o.chop, clear: o.clear || 5, foam: o.foam, env, depth: o.depth, opacity: o.opacity });
    const sz = o.size || 300000, m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz, 1, 1), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0; m.receiveShadow = true;
    if (o.at) m.position.set(o.at[0], 0, o.at[1]);
    m.renderOrder = 1;
    return m;
  }
  /* mapa do fundo do mar do Ás dos Céus (com o mesmo afundamento visual do terreno) */
  const seaDepth = hg => ({ fn: (x, z) => { const h = hg.at(x, z); return h < 0 ? h * UNDER : h; }, x: 0, z: 0, size: SIZE * 1.04, res: 512 });

  /* ════════════════════════════════════════════════════════════════
     nuvens — quadrados virados para a câmara, instanciados
  ════════════════════════════════════════════════════════════════ */
  function puffTex() {
    return canvasTex(256, 256, (x, w, h) => {
      const r = rng(31);
      for (let i = 0; i < 34; i++) {
        const a = r() * TAU, d = Math.pow(r(), .6) * 70, cx = 128 + Math.cos(a) * d, cy = 136 + Math.sin(a) * d * .7, rr = 30 + r() * 50;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(.6, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
    });
  }
  const CLOUD_VS = `
    attribute vec3 iOff; attribute vec2 iScl; attribute float iA;
    uniform float uNear, uFar; varying vec2 vUv; varying float vA, vFog, vY;
    void main(){
      vec4 mv = viewMatrix * vec4(iOff, 1.);
      float c = cos(iScl.y), s = sin(iScl.y);
      vec2 p = vec2(position.x*c - position.y*s, position.x*s + position.y*c) * iScl.x;
      mv.xy += p;
      float dist = length(mv.xyz);
      vFog = smoothstep(uNear, uFar, dist);
      vA = iA * smoothstep(iScl.x * .18, iScl.x * .75, dist);
      vUv = uv; vY = position.y + .5;
      gl_Position = projectionMatrix * mv;
    }`;
  const CLOUD_FS = `
    uniform sampler2D map; uniform vec3 uLit, uShade, uFog; varying vec2 vUv; varying float vA, vFog, vY;
    void main(){
      vec4 t = texture2D(map, vUv);
      vec3 col = mix(uShade, uLit, clamp(vY * 1.1 + t.r * .25 - .05, 0., 1.));
      col = mix(col, uFog, vFog * .85);
      gl_FragColor = vec4(col, t.a * vA * (1. - vFog * .5));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  /* o: { area, alt: [min, max], R: [min, max], n } — por omissão, a escala do Ás dos Céus */
  function buildClouds(sky, seed, scale, o = {}) {
    const r = rng(seed * 5 + 9), puffs = [], area = o.area || SIZE * 1.3, alt = o.alt || (sky.layer ? [1700, 2200] : [1300, 3000]), RR = o.R || [260, 910];
    const nC = Math.round((o.n || sky.clouds) * scale);
    for (let i = 0; i < nC; i++) {
      const cx = (r() - .5) * area, cz = (r() - .5) * area, cy = alt[0] + r() * (alt[1] - alt[0]);
      const R = RR[0] + r() * (RR[1] - RR[0]), k = 5 + Math.floor(r() * (sky.layer ? 7 : 10));
      for (let j = 0; j < k; j++) {
        const a = r() * TAU, d = r() * R;
        puffs.push({ x: cx + Math.cos(a) * d, y: cy + (r() - .3) * R * .35, z: cz + Math.sin(a) * d * .8, s: R * (.55 + r() * .7), rot: r() * TAU, a: .85 + r() * .15 });
      }
    }
    const n = puffs.length, g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.PlaneGeometry(1, 1));
    const off = new Float32Array(n * 3), scl = new Float32Array(n * 2), al = new Float32Array(n);
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 3)); g.setAttribute('iScl', new THREE.InstancedBufferAttribute(scl, 2)); g.setAttribute('iA', new THREE.InstancedBufferAttribute(al, 1));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: puffTex() }, uLit: { value: new THREE.Color(sky.cloud) }, uShade: { value: new THREE.Color(sky.cloudShade) }, uFog: { value: new THREE.Color(sky.fog) }, uNear: { value: sky.fogNear * 1.4 }, uFar: { value: sky.fogFar * 1.25 } },
      vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
    const order = puffs.map((p, i) => i);
    /* ordena de trás para a frente (a cada poucos frames) */
    function sort(cam) {
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
      puffs.forEach(p => { p.d = (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2; });
      order.sort((a, b) => puffs[b].d - puffs[a].d);
      for (let i = 0; i < n; i++) { const p = puffs[order[i]]; off[i * 3] = p.x; off[i * 3 + 1] = p.y; off[i * 3 + 2] = p.z; scl[i * 2] = p.s; scl[i * 2 + 1] = p.rot; al[i] = p.a; }
      g.attributes.iOff.needsUpdate = g.attributes.iScl.needsUpdate = g.attributes.iA.needsUpdate = true;
    }
    /* quanto a câmara está "dentro" de uma nuvem (0..1) */
    function inside(p) {
      let k = 0;
      for (let i = 0; i < n; i++) { const q = puffs[i], dx = q.x - p.x, dy = (q.y - p.y) * 1.6, dz = q.z - p.z, rr = q.s * .32; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < rr * rr) k = Math.max(k, 1 - Math.sqrt(d2) / rr); }
      return k;
    }
    return { mesh, sort, inside, puffs };
  }

  /* ════════════════════════════════════════════════════════════════
     materiais e texturas dos aviões
  ════════════════════════════════════════════════════════════════ */
  let _panel = null;
  function panelTex() {
    if (_panel) return _panel;
    _panel = canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      const r = rng(4);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${r() * .035})`; x.fillRect(r() * w, r() * h, 2 + r() * 30, 2 + r() * 30); }
      x.strokeStyle = 'rgba(0,0,0,.13)'; x.lineWidth = 1.2;
      for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * 64 + .5); x.lineTo(w, i * 64 + .5); x.stroke(); }
      for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { const xx = (i * 128 + (j % 2) * 64) + .5; x.beginPath(); x.moveTo(xx, j * 64); x.lineTo(xx, j * 64 + 64); x.stroke(); }
      x.fillStyle = 'rgba(0,0,0,.18)';
      for (let j = 0; j < 8; j++) for (let i = 0; i < 64; i++) x.fillRect(i * 8 + 2, j * 64 + 4, 1.4, 1.4);
    });
    _panel.wrapS = _panel.wrapT = THREE.RepeatWrapping; _panel.anisotropy = 4;
    return _panel;
  }
  const _mc = new Map();
  function jmat(key, make) { let m = _mc.get(key); if (!m) { m = make(); m.userData.shared = true; _mc.set(key, m); } return m; }
  function bodyMat(color, env, wing) {
    return jmat('body:' + color + (wing ? ':w' : '') + (env ? env.uuid : ''), () => {
      const t = panelTex().clone(); t.needsUpdate = true; if (wing) t.repeat.set(.16, .16); else t.repeat.set(2, 1);
      return new THREE.MeshPhysicalMaterial({ color, map: t, metalness: .38, roughness: .4, clearcoat: .45, clearcoatRoughness: .25, envMap: env, envMapIntensity: .95 });
    });
  }
  const plainMat = (color, env, o) => jmat('plain:' + color + JSON.stringify(o || {}) + (env ? env.uuid : ''), () => new THREE.MeshStandardMaterial(Object.assign({ color, metalness: .4, roughness: .45, envMap: env, envMapIntensity: .9 }, o || {})));
  const glowM = (color, op) => jmat('glow:' + color + ':' + (op || 1), () => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: op != null, opacity: op != null ? op : 1, depthWrite: op == null, blending: op != null ? THREE.AdditiveBlending : THREE.NormalBlending }));

  /* asa (forma no plano XZ: pontos [x, z]) com espessura */
  function planform(pts, th, bevel) {
    const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
    const b = bevel != null ? bevel : th * .45;
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.01, th - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b * .9, bevelSegments: 2, curveSegments: 2 });
    g.rotateX(Math.PI / 2); g.translate(0, th / 2 - b, 0);
    return g;
  }
  /* deriva (forma no plano ZY: pontos [z, y]) */
  function finform(pts, th) {
    const s = new THREE.Shape(); pts.forEach(([z, y], i) => (i ? s.lineTo(-z, y) : s.moveTo(-z, y)));
    const b = th * .4;
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.01, th - b * 2), bevelEnabled: true, bevelThickness: b, bevelSize: b * .8, bevelSegments: 2, curveSegments: 2 });
    g.rotateY(Math.PI / 2); g.translate(-th / 2 + b, 0, 0);
    return g;
  }
  const mirrorX = g => { const c = g.clone(); c.scale(-1, 1, 1); /* inverte as faces */ const idx = c.index; if (idx) { for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i); idx.setX(i, idx.getX(i + 2)); idx.setX(i + 2, a); } } else { const p = c.attributes.position, nn = c.attributes.normal, uv = c.attributes.uv; for (let i = 0; i < p.count; i += 3) { [p, nn, uv].forEach(at => { if (!at) return; for (let k = 0; k < at.itemSize; k++) { const a = at.array[i * at.itemSize + k]; at.array[i * at.itemSize + k] = at.array[(i + 2) * at.itemSize + k]; at.array[(i + 2) * at.itemSize + k] = a; } }); } } return c; };
  function lathe(prof, seg, sx, sy) {
    const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(Math.max(.001, r), z)), seg || 18);
    g.rotateX(Math.PI / 2); g.scale(sx || 1, sy || 1, 1);
    return g;
  }
  /* inverte o perfil (lathe gira "para dentro" se z decrescer) */
  const prof = pts => pts.slice().sort((a, b) => a[1] - b[1]);

  function addMesh(grp, geo, mat, x, y, z, o) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    if (o) { if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...o.s); }
    m.castShadow = true; m.receiveShadow = true; grp.add(m); return m;
  }

  /* míssil (para os aviões e para voar) */
  let _mslGeo = null;
  function missileMesh(env, color) {
    const g = new THREE.Group();
    if (!_mslGeo) {
      _mslGeo = {
        body: lathe(prof([[0, 1.9], [.09, 1.65], [.13, 1.3], [.13, -1.6], [.11, -1.75]]), 10),
        fin: planform([[.1, -1.0], [.42, -1.45], [.42, -1.7], [.1, -1.7]], .03, .01),
        can: planform([[.1, 1.0], [.26, .82], [.26, .62], [.1, .62]], .025, .008),
      };
      Object.values(_mslGeo).forEach(q => { q.userData.shared = true; });
    }
    addMesh(g, _mslGeo.body, plainMat(color || '#e9edf2', env, { metalness: .3, roughness: .35 }));
    for (let i = 0; i < 4; i++) { const f = addMesh(g, _mslGeo.fin, plainMat('#9aa3ad', env)); f.rotation.z = i * Math.PI / 2 + Math.PI / 4; const c = addMesh(g, _mslGeo.can, plainMat('#9aa3ad', env)); c.rotation.z = i * Math.PI / 2 + Math.PI / 4; }
    const band = addMesh(g, new THREE.CylinderGeometry(.135, .135, .12, 10), plainMat('#f59e0b', env, { metalness: .1 }), 0, 0, 1.05, { rx: Math.PI / 2 }); void band;
    return g;
  }

  /* referências às peças animáveis: por nome (o clone() do three copia o userData
     por JSON, por isso não pode levar objetos 3D) */
  function tag(g, U) {
    const meta = {};
    Object.keys(U).forEach(k => {
      const v = U[k];
      if (Array.isArray(v)) { if (v.length && v[0] && v[0].isVector3) meta[k] = v.map(p => [p.x, p.y, p.z]); else v.forEach(o => { if (o && o.isObject3D) o.name = 'a:' + k; }); }
      else if (v && v.isObject3D) v.name = 'o:' + k;
      else if (v && typeof v === 'object') Object.keys(v).forEach(q => { if (v[q] && v[q].isObject3D) v[q].name = 's:' + k + '.' + q; });
    });
    g.userData = meta;
  }
  function refs(g) {
    const R = { nozzles: [], flames: [], rails: [], lights: [], glow: [], engines: [], surf: {} };
    g.traverse(o => {
      const nm = o.name; if (!nm || nm[1] !== ':') return;
      const t = nm[0], key = nm.slice(2);
      if (t === 'a') (R[key] = R[key] || []).push(o);
      else if (t === 'o') R[key] = o;
      else if (t === 's') { const [a, b] = key.split('.'); (R[a] = R[a] || {})[b] = o; }
    });
    Object.assign(R, g.userData || {});
    return R;
  }

  /* ════════════════════════════════════════════════════════════════
     caças
  ════════════════════════════════════════════════════════════════ */
  const JETS = {
    falcon: {
      fus: [[0, 8.4], [.28, 7.7], [.55, 6.6], [.78, 5.2], [.92, 3.6], [1.0, 1.6], [1.02, -.5], [1.0, -3], [.92, -5.2], [.82, -6.6], [.78, -7.1]],
      wing: [[.8, 2.4], [5.6, -2.3], [5.6, -3.5], [.8, -4.6]], wingY: -.12, wth: .26,
      lerx: [[.75, 4.6], [1.6, 2.0], [.8, 1.0]],
      stab: [[.7, -5.1], [3.3, -6.7], [3.3, -7.6], [.7, -7.4]], stabY: -.05,
      tail: [[-3.9, .5], [-6.4, 3.9], [-7.4, 3.9], [-7.3, .5]], tails: [[.95, -.27]], tailY: .45,
      canopy: [0, .78, 4.0, .55, .52, 1.9], intake: [1.05, -.3, 1.4, .72, .95, 3.4], noz: [[.52, -7.3, .5], [-.52, -7.3, .5]],
      rails: [[3.9, -.42, -1.2], [-3.9, -.42, -1.2]], tips: [5.6, -.12, -3.0], sx: 1.18, sy: .82,
    },
    wasp: {
      fus: [[0, 8.0], [.26, 7.3], [.52, 6.2], [.74, 4.8], [.86, 3.2], [.92, 1.2], [.94, -1], [.9, -3.5], [.8, -5.6], [.66, -6.9], [.62, -7.2]],
      wing: [[.75, 1.5], [5.2, -4.3], [5.2, -5.0], [.75, -5.6]], wingY: -.2, wth: .24,
      canard: [[.7, 4.4], [2.1, 3.3], [2.1, 2.8], [.7, 2.9]],
      stab: null,
      tail: [[-3.4, .55], [-6.4, 4.1], [-7.3, 4.1], [-7.0, .55]], tails: [[0, 0]], tailY: .45,
      canopy: [0, .74, 3.7, .5, .5, 1.8], intake: [0, -.85, 1.4, .9, .7, 3.4], noz: [[0, -7.4, .58]],
      rails: [[3.4, -.48, -2.6], [-3.4, -.48, -2.6]], tips: [5.2, -.2, -4.6], sx: 1.12, sy: .86,
    },
    thunder: {
      fus: [[0, 9.6], [.3, 8.8], [.62, 7.6], [.9, 6.0], [1.08, 4.0], [1.2, 1.6], [1.24, -1], [1.22, -4], [1.12, -6.3], [1.0, -7.8], [.96, -8.2]],
      wing: [[1.0, 2.6], [6.6, -1.8], [6.6, -3.0], [1.0, -5.0]], wingY: -.05, wth: .3,
      lerx: [[.95, 5.2], [1.9, 2.4], [1.0, 1.4]],
      stab: [[.9, -5.6], [4.0, -7.5], [4.0, -8.5], [.9, -8.3]], stabY: -.05,
      tail: [[-4.2, .55], [-7.0, 4.4], [-8.0, 4.4], [-8.0, .55]], tails: [[1.2, -.2]], tailY: .55,
      canopy: [0, .9, 4.6, .6, .58, 2.4], intake: [1.32, -.25, 1.6, .85, 1.1, 4.0], noz: [[.62, -8.4, .6], [-.62, -8.4, .6]],
      rails: [[4.4, -.45, -1.0], [-4.4, -.45, -1.0]], tips: [6.6, -.05, -2.4], sx: 1.2, sy: .82,
    },
  };
  const LIVERY = {
    falcon: { body: '#8d98a4', belly: '#b7c0c9', accent: '#2f6fdb', dark: '#2a2e35' },
    wasp: { body: '#353c46', belly: '#4b535e', accent: '#f5b301', dark: '#1d2026' },
    thunder: { body: '#3f526e', belly: '#6c7d95', accent: '#ff7a1a', dark: '#22262d' },
  };

  /* ── tinta dos caças: material físico com verniz e cores de vértice (dois tons cima/baixo, radome,
        painel anti-reflexo, pontas coloridas, metal queimado junto às tubeiras) sobre a textura de painéis ── */
  function paintMat(env) {
    return jmat('paint' + (env ? env.uuid : ''), () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, map: panelTex(), metalness: .25, roughness: .48, clearcoat: .14, clearcoatRoughness: .35, envMap: env, envMapIntensity: .7 }));
  }
  /* põe cor por vértice: fn(cor, x, y, z, nx, ny, nz); uvK escala as UV (a textura de painéis tem ~4 m) */
  function paintGeo(g, fn, uvK) {
    g = g.index ? g.toNonIndexed() : g.clone();
    const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uvK && g.attributes.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvK, uv.getY(i) * uvK); }
    return g;
  }
  /* insígnias e números (atlas em canvas): roseta fictícia do esquadrão "Ás" + número de cauda */
  function decalMat(num, env) {
    return jmat('dec' + num + (env ? env.uuid : ''), () => {
      const t = canvasTex(512, 256, (x) => {
        const c = 128;
        x.fillStyle = '#16305e'; x.beginPath(); x.arc(c, c, 120, 0, TAU); x.fill();
        x.fillStyle = '#f4f1e8'; x.beginPath(); x.arc(c, c, 92, 0, TAU); x.fill();
        x.fillStyle = '#1e4fa8'; x.beginPath(); x.arc(c, c, 80, 0, TAU); x.fill();
        x.fillStyle = '#f5c242'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 30 : 70; x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } x.closePath(); x.fill();
        x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.stroke();
        x.font = '900 170px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 12; x.strokeStyle = 'rgba(10,14,20,.85)'; x.strokeText(num, 384, 136); x.fillStyle = '#f2f2ee'; x.fillText(num, 384, 136);
      });
      t.anisotropy = 4;
      return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .04, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: .45, metalness: .15, envMap: env });
    });
  }
  function decal(g, mat, rect, w, h, x, y, z, rx, ry, rz) {
    const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * rect[2], rect[1] + uv.getY(i) * rect[3]);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.renderOrder = 2; m.receiveShadow = true; g.add(m); return m;
  }

  /* fuselagem em "loft": secções superelípticas ao longo de z — nariz com arestas (chines), corpo largo onde
     nasce a asa, lombada atrás da cabine e barriga mais chata. Devolve a geometria e a forma de cada secção. */
  function fusLoft(J) {
    const pts = J.fus.map(([r, z]) => new THREE.Vector2(z, r)).sort((a, b) => b.x - a.x);
    const smp = new THREE.SplineCurve(pts).getPoints(260), z0 = pts[0].x, z1 = pts[pts.length - 1].x;
    const rAt = z => { for (let i = 1; i < smp.length; i++) if (smp[i].x <= z) { const a = smp[i - 1], b = smp[i], t = (z - a.x) / ((b.x - a.x) || -1e-6); return Math.max(0, a.y + (b.y - a.y) * t); } return smp[smp.length - 1].y; };
    const cz = J.canopy[2], cl = J.canopy[5], wLE = J.wing[0][1], wTE = J.wing[3][1];
    const shape = z => {
      const r = rAt(z), nose = sstep(z0, z0 - 3.2, z);
      const blend = sstep(wLE + 1.8, wLE - .2, z) * sstep(wTE - 1.5, wTE + .3, z);
      const spine = sstep(cz - cl * .2, cz - cl * 1.15, z) * (1 - sstep(-3, -6.6, z));
      return { w: r * J.sx * (1 + .13 * blend), h: r * J.sy * (1 + .3 * spine), hb: r * J.sy * .88, p: 2 + .85 * nose * (1 - .6 * sstep(-3.5, -7, z)) };
    };
    const g = sloft(shape, z0, z1, 70, 36, 1.12);
    /* x da pele a uma altura y numa secção z (para encostar insígnias) */
    const skinX = (z, y) => { const S = shape(z), hh = y >= 0 ? S.h : S.hb, q = Math.min(.98, Math.abs(y) / hh); return S.w * Math.pow(1 - Math.pow(q, S.p), 1 / S.p); };
    return { g, shape, skinX, z0, z1 };
  }
  /* malha em loft genérica: shape(z) → { w, h, hb, p, y? } (meias-larguras, expoente da superelipse) */
  function sloft(shape, z0, z1, NZ, NR, k) {
    const P = [], UV = [], idx = [];
    for (let i = 0; i <= NZ; i++) {
      const z = z0 + (z1 - z0) * Math.pow(i / NZ, k || 1), S = shape(z), e = 2 / S.p, yc = S.y || 0;
      for (let j = 0; j <= NR; j++) {
        const a = j / NR * TAU, c = Math.cos(a), s = Math.sin(a);
        P.push(S.w * Math.sign(c) * Math.pow(Math.abs(c), e), yc + (s >= 0 ? S.h : S.hb) * Math.sign(s) * Math.pow(Math.abs(s), e), z);
        UV.push(j / NR * 2.4, z / 4.2);
      }
    }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NR; j++) { const a = i * (NR + 1) + j, b = a + NR + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(idx); g.computeVertexNormals();
    /* costura: as duas cópias do ângulo 0 ficam com a mesma normal */
    const n = g.attributes.normal;
    for (let i = 0; i <= NZ; i++) { const a = i * (NR + 1), b = a + NR; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), zz = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, zz) || 1; n.setXYZ(a, x / l, y / l, zz / l); n.setXYZ(b, x / l, y / l, zz / l); }
    return g;
  }

  const JET_NUM = { falcon: '01', wasp: '07', thunder: '23' };
  function buildJet(type, env, livery) {
    const J = JETS[type], L = livery || LIVERY[type], g = new THREE.Group(), U = { nozzles: [], flames: [], rails: [], surf: {}, lights: [] };
    const paint = paintMat(env), dark = plainMat(L.dark, env, { metalness: .75, roughness: .35 }), acc = plainMat(L.accent, env, { metalness: .2, roughness: .4 });
    const cTop = new THREE.Color(L.body), cBot = new THREE.Color(L.belly), cAcc = new THREE.Color(L.accent), cRad = new THREE.Color('#4d535b').lerp(cTop, .2), cBurn = new THREE.Color('#4a4640'), cEdge = new THREE.Color('#70767e'), cGlare = cTop.clone().multiplyScalar(.45);
    const twoTone = (c, ny) => c.copy(cBot).lerp(cTop, sstep(-.45, .2, ny));
    /* fuselagem */
    const F = fusLoft(J), [cx, cy, cz, cw, ch, cl] = J.canopy;
    const fg = paintGeo(F.g, (c, x, y, z, nx, ny) => {
      twoTone(c, ny);
      c.lerp(cGlare, (ny > .3 ? 1 : 0) * sstep(cz + cl * 1.9, cz + cl * 1.3, z) * sstep(cz + cl * .4, cz + cl * .9, z) * .8);
      c.lerp(cRad, sstep(F.z0 - 1.75, F.z0 - 1.55, z));
      if (z < F.z0 - 1.78 && z > F.z0 - 2.0) c.copy(cAcc);
      c.lerp(cBurn, sstep(F.z1 + 1.6, F.z1 + .2, z) * .75);
    });
    addMesh(g, fg, paint);
    /* tampa escura na cauda (por baixo das tubeiras) */
    const Se = F.shape(F.z1 + .01); addMesh(g, new THREE.CircleGeometry(1, 28), dark, 0, 0, F.z1 + .02, { ry: Math.PI, s: [Se.w, Se.h, 1] });
    /* sonda pitot no nariz */
    addMesh(g, new THREE.CylinderGeometry(.018, .03, 1.1, 6), plainMat('#c9ced4', env, { metalness: .9, roughness: .25 }), 0, 0, F.z0 + .45, { rx: Math.PI / 2 });
    /* asas, extensões, ailerons, estabilizadores, canards: cima na cor do corpo, baixo mais claro, bordo de ataque cinza, pontas na cor de destaque */
    const tipX = J.wing[1][0];
    const wingPaint = gg => paintGeo(gg, (c, x, y, z, nx, ny, nz) => { twoTone(c, ny); c.lerp(cEdge, sstep(.45, .85, nz) * .55); }, .16);
    const surfPaint = gg => paintGeo(gg, (c, x, y, z, nx, ny, nz) => { twoTone(c, ny); c.lerp(cEdge, sstep(.45, .85, nz) * .5); }, .16);
    const wg = planform(J.wing, J.wth);
    addMesh(g, wingPaint(wg), paint, 0, J.wingY, 0); addMesh(g, wingPaint(mirrorX(wg)), paint, 0, J.wingY, 0);
    /* pontas das asas na cor de destaque (peça à parte: as faces da asa são só 2 triângulos, a cor não ficava na ponta) */
    { const xa = tipX - .75, t = (xa - J.wing[0][0]) / (tipX - J.wing[0][0]), tg = planform([[xa, lerp(J.wing[0][1], J.wing[1][1], t) - .02], [tipX + .02, J.wing[1][1] - .02], [tipX + .02, J.wing[2][1] + .02], [xa, lerp(J.wing[3][1], J.wing[2][1], t) + .02]], J.wth + .02, .01);
      addMesh(g, tg, acc, 0, J.wingY, 0); addMesh(g, mirrorX(tg), acc, 0, J.wingY, 0); }
    if (J.lerx) { const lg = planform(J.lerx, .12, .04); addMesh(g, surfPaint(lg), paint, 0, J.wingY + .06, 0); addMesh(g, surfPaint(mirrorX(lg)), paint, 0, J.wingY + .06, 0); }
    const te0 = J.wing[J.wing.length - 1], te1 = J.wing[2], sl = (te1[1] - te0[1]) / (te1[0] - te0[0]);
    const ax = lerp(te0[0], te1[0], .5), az = te0[1] + sl * (ax - te0[0]), aL = te1[0] - ax - .3;
    const ail = planform([[0, .1], [aL, sl * aL + .1], [aL, sl * aL - .6], [0, -.6]], J.wth * .7, .03);
    [1, -1].forEach(sd => {
      const piv = new THREE.Group(); piv.position.set(sd * ax, J.wingY, az); g.add(piv);
      addMesh(piv, surfPaint(sd > 0 ? ail : mirrorX(ail)), paint);
      U.surf[sd > 0 ? 'ailL' : 'ailR'] = piv;
    });
    if (J.canard) { const cg = planform(J.canard, .12, .04); [1, -1].forEach(sd => { const piv = new THREE.Group(); piv.position.set(0, .05, J.canard[2][1]); g.add(piv); addMesh(piv, surfPaint(sd > 0 ? cg : mirrorX(cg)), paint, 0, 0, -J.canard[2][1]); U.surf[sd > 0 ? 'canL' : 'canR'] = piv; }); }
    if (J.stab) {
      const sg = planform(J.stab, .16, .05), pz = (J.stab[0][1] + J.stab[3][1]) / 2;
      [1, -1].forEach(sd => { const piv = new THREE.Group(); piv.position.set(0, J.stabY, pz); g.add(piv); addMesh(piv, surfPaint(sd > 0 ? sg : mirrorX(sg)), paint, 0, 0, -pz); U.surf[sd > 0 ? 'stabL' : 'stabR'] = piv; });
    }
    /* insígnias nas asas (por cima) */
    const wbb = new THREE.Box3().setFromBufferAttribute(wg.attributes.position), wy = J.wingY + wbb.max.y + .004, dm = decalMat(JET_NUM[type] || '01', env);
    { const xs = tipX * .6, t = (xs - J.wing[0][0]) / (tipX - J.wing[0][0]), le = lerp(J.wing[0][1], J.wing[1][1], t), te = lerp(J.wing[3][1], J.wing[2][1], t), zz = (le + te) / 2 - .1;
      [1, -1].forEach(sd => decal(g, dm, [0, 0, .5, 1], 1.15, 1.15, sd * xs, wy, zz, -Math.PI / 2)); }
    /* insígnias nos lados da fuselagem */
    { const zz = Math.min(J.tail[0][0] + 1.3, J.wing[3][1] + 1.2), yy = .2, xs = F.skinX(zz, yy) + .012;
      [1, -1].forEach(sd => decal(g, dm, [0, 0, .5, 1], .78, .78, sd * xs, yy, zz, 0, sd * Math.PI / 2)); }
    /* derivas: lados na cor do corpo, faixa no topo e número de cauda */
    const fin = paintGeo(finform(J.tail, .18), (c, x, y, z, nx, ny, nz) => { c.copy(cTop); c.lerp(cEdge, sstep(.45, .85, nz) * .5); c.lerp(cBurn, sstep(J.tail[0][1] + .5, J.tail[0][1], y) * .15); }, .16);
    J.tails.forEach(([tx, cant]) => {
      [1, -1].forEach(sd => {
        if (tx === 0 && sd < 0) return;
        const piv = new THREE.Group(); piv.position.set(sd * tx, J.tailY, 0); piv.rotation.z = sd * cant; g.add(piv);
        addMesh(piv, fin, paint);
        const top = J.tail[1][1];
        const stripe = finform([[J.tail[1][0] + .1, top - .9], [J.tail[1][0], top], [J.tail[2][0], top], [J.tail[2][0] + .05, top - .9]], .2);
        addMesh(piv, stripe, acc);
        const yy = J.tail[0][1] + (top - J.tail[0][1]) * .38, k = (yy - J.tail[0][1]) / (top - J.tail[0][1]), le = lerp(J.tail[0][0], J.tail[1][0], k), te = lerp(J.tail[3][0], J.tail[2][0], k);
        [1, -1].forEach(s2 => { if (tx !== 0 && s2 !== sd) return; decal(piv, dm, [.5, 0, .5, 1], 1.15, .58, s2 * .1, yy, (le + te) / 2, 0, s2 * Math.PI / 2); });
      });
    });
    /* cabine: bolha em gota de vidro fumado (reflete o céu), arcos da armação, piloto de capacete, banco e painel */
    const cp = []; for (let i = 0; i <= 18; i++) { const t = i / 18, r = t < .38 ? Math.pow(Math.sin(t / .38 * Math.PI / 2), .75) : Math.pow(Math.cos((t - .38) / .62 * Math.PI / 2), .55); cp.push([r, cz + cl - t * 2 * cl]); }
    const rC = t => t < .38 ? Math.pow(Math.sin(t / .38 * Math.PI / 2), .75) : Math.pow(Math.cos((t - .38) / .62 * Math.PI / 2), .55);
    const glass = jmat('glass' + (env ? env.uuid : ''), () => new THREE.MeshPhysicalMaterial({ color: '#1d3346', metalness: .25, roughness: .03, clearcoat: 1, clearcoatRoughness: .02, envMap: env, envMapIntensity: 2.4, transparent: true, opacity: .5, depthWrite: false }));
    const can = addMesh(g, lathe(prof(cp), 30, cw, ch), glass, cx, cy, 0); can.renderOrder = 3; can.castShadow = false;
    const frameM = plainMat('#23272d', env, { metalness: .6, roughness: .4 });
    [.3, .74].forEach(t => { const r = rC(t) * .985; addMesh(g, new THREE.TorusGeometry(1, .022, 6, 24, Math.PI), frameM, cx, cy, cz + cl - t * 2 * cl, { s: [cw * r, ch * r, 1] }); });
    addMesh(g, new THREE.SphereGeometry(1, 20, 10), plainMat('#2a2f37', env, { metalness: .2, roughness: .8 }), cx, cy - .04, cz - .1, { s: [cw * .86, .2, cl * .86] });
    const helm = addMesh(g, new THREE.SphereGeometry(.19, 16, 12), plainMat('#e8eaee', env, { metalness: .1, roughness: .35 }), cx, cy + .26, cz - .05);
    addMesh(g, new THREE.SphereGeometry(.17, 14, 10), plainMat('#3a2c12', env, { metalness: .9, roughness: .08 }), cx, cy + .25, cz + .04, { s: [.92, .62, .7] });
    addMesh(g, Arcade3D.roundBox(.04), plainMat('#1d2025', env, { metalness: .2, roughness: .7 }), cx, cy + .12, cz - .38, { s: [.46, .62, .16] });
    addMesh(g, Arcade3D.roundBox(.03), plainMat('#1d2025', env, { metalness: .2, roughness: .7 }), cx, cy + .12, cz + cl * .55, { s: [.5, .14, .22] });
    void helm;
    /* entradas de ar: carenagem pintada, lábio metálico e interior escuro */
    if (J.intake) {
      const [ix, iy, iz, w, h, l] = J.intake;
      /* carenagem com boca arredondada que se afunila para trás e se funde na fuselagem */
      const ig = sloft(z => { const t = clamp((iz + l / 2 - z) / l, 0, 1); return { w: w / 2 * (1 - .45 * t * t), h: h / 2 * (1 - .3 * t * t), hb: h / 2 * (1 - .3 * t * t), p: 3.2 }; }, iz + l / 2, iz - l / 2, 14, 24);
      const ib = paintGeo(ig, (c, x, y, z, nx, ny) => twoTone(c, ny * .7 - .15), .5);
      (ix === 0 ? [0] : [ix, -ix]).forEach(x => {
        addMesh(g, ib, paint, x, iy - h / 2, 0);
        addMesh(g, new THREE.TorusGeometry(.5, .06, 6, 20), plainMat('#9aa1a9', env, { metalness: .85, roughness: .3 }), x, iy - h / 2, iz + l / 2 - .01, { s: [w * .95, h * .82, 1] });
        addMesh(g, new THREE.PlaneGeometry(w * .86, h * .74), plainMat('#07090c', env, { metalness: 0, roughness: 1 }), x, iy - h / 2, iz + l / 2 - .06);
      });
    }
    /* antenas (lombada e barriga) */
    const blade = planform([[0, .25], [0, -.15], [.32, -.22], [.3, .02]], .025, .006);
    addMesh(g, blade, dark, 0, F.shape(cz - cl * 1.6).h + .01, cz - cl * 1.6, { rz: Math.PI / 2 });
    addMesh(g, blade, dark, 0, -F.shape(-1).hb - .01, -1, { rz: -Math.PI / 2 });
    /* tubeiras: anel exterior em pétalas, metal azulado do calor, interior escuro com o brilho do motor */
    const flameGeo = new THREE.ConeGeometry(1, 1, 14, 1, true); flameGeo.rotateX(-Math.PI / 2); flameGeo.translate(0, 0, -.5);
    const petM = plainMat('#5d636c', env, { metalness: .9, roughness: .32 }), heat = plainMat('#5a5f7a', env, { metalness: .95, roughness: .25 }), innerM = plainMat('#121418', env, { metalness: .4, roughness: .7, side: THREE.DoubleSide });
    J.noz.forEach(([nx, nz, nr]) => {
      const pg = new THREE.CylinderGeometry(nr * .86, nr * 1.02, 1.5, 32, 2, true), pp = pg.attributes.position;
      for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getZ(i), pp.getX(i)), k = 1 + .045 * Math.sign(Math.cos(a * 16)) * (pp.getY(i) < 0 ? 1 : .3); pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
      pg.computeVertexNormals();
      addMesh(g, pg, petM, nx, 0, nz - .1, { rx: Math.PI / 2 });
      addMesh(g, new THREE.CylinderGeometry(nr * 1.02, nr * 1.04, .35, 32, 1, true), heat, nx, 0, nz + .62, { rx: Math.PI / 2 });
      addMesh(g, new THREE.CylinderGeometry(nr * .8, nr * .62, 1.2, 20, 1, true), innerM, nx, 0, nz, { rx: Math.PI / 2 });
      addMesh(g, new THREE.CircleGeometry(nr * .64, 20), glowM('#ff8a3a'), nx, 0, nz + .5, { ry: Math.PI });
      const f1 = new THREE.Mesh(flameGeo, glowM('#ffb36b', .42)); f1.position.set(nx, 0, nz - .6); f1.scale.set(nr * .62, nr * .62, 3); g.add(f1);
      const f2 = new THREE.Mesh(flameGeo, glowM('#7ab8ff', .45)); f2.position.set(nx, 0, nz - .6); f2.scale.set(nr * .4, nr * .4, 1.6); g.add(f2);
      U.flames.push(f1, f2);
      const spr = new THREE.Sprite(Arcade3D.glowSprite('#ff9a4a')); spr.position.set(nx, 0, nz - .9); spr.scale.setScalar(nr * 5); g.add(spr); U.nozzles.push(spr);
    });
    /* mísseis nos carris */
    J.rails.forEach(([rx, ry, rz]) => {
      addMesh(g, Arcade3D.roundBox(.05), dark, rx, ry + .16, rz - .2, { s: [.12, .2, 2.4] });
      const m = missileMesh(env); m.position.set(rx, ry - .02, rz); g.add(m); U.rails.push(m);
    });
    /* luzes de navegação e de formação */
    const [tx, ty, tz] = J.tips;
    [[tx, '#ff3b3b'], [-tx, '#3bff7a']].forEach(([x, c]) => { const s = new THREE.Sprite(Arcade3D.glowSprite(c)); s.position.set(x, ty, tz); s.scale.setScalar(1.2); g.add(s); U.lights.push(s); });
    U.wingtips = [new THREE.Vector3(tx, ty, tz), new THREE.Vector3(-tx, ty, tz)];
    Arcade3D.outline(g, { px: 1.1, min: 60 });
    tag(g, U);
    return g;
  }

  /* drones inimigos — sem cabine, com o "olho" do sensor aceso */
  function buildDrone(kind, env) {
    const g = new THREE.Group(), U = { nozzles: [], flames: [], lights: [] };
    const ace = kind === 'ace';
    const col = ace ? '#d7dbe2' : kind === 'scout' ? '#e8e3d8' : '#3a3e46', glow = ace ? '#c35bff' : kind === 'scout' ? '#ff9a2a' : '#ff3b3b';
    const body = bodyMat(col, env), wing = bodyMat(col, env, true), dark = plainMat('#1b1d22', env, { metalness: .7, roughness: .35 });
    if (kind === 'scout') {
      /* drone-alvo de treino: corpo cilíndrico laranja e branco */
      addMesh(g, lathe(prof([[0, 3.2], [.35, 2.6], [.45, 1.5], [.45, -2.4], [.3, -2.8]]), 14), body);
      addMesh(g, new THREE.CylinderGeometry(.46, .46, .9, 14), plainMat('#ff7a1a', env, { metalness: .1 }), 0, 0, .6, { rx: Math.PI / 2 });
      const w = planform([[.4, .6], [3.4, -.2], [3.4, -.9], [.4, -1.0]], .14, .04); addMesh(g, w, wing); addMesh(g, mirrorX(w), wing);
      const t = finform([[-1.4, .3], [-2.4, 1.6], [-2.9, 1.6], [-2.8, .3]], .12); addMesh(g, t, plainMat('#ff7a1a', env, { metalness: .1 }));
      const s = new THREE.Sprite(Arcade3D.glowSprite('#ffb04a')); s.position.set(0, 0, -2.9); s.scale.setScalar(2.2); g.add(s); U.nozzles.push(s);
      Arcade3D.outline(g, { px: 1.1, min: 60 }); tag(g, U); return g;
    }
    if (kind === 'heavy') {
      /* cargueiro: asa voadora grande com 4 motores */
      const w = planform([[0, 14], [34, -6], [34, -10], [8, -6], [0, -12]], 2.4, .8); addMesh(g, w, wing); addMesh(g, mirrorX(w), wing);
      addMesh(g, lathe(prof([[0, 16], [2.5, 12], [4, 6], [4.2, -4], [3, -11]]), 18, 1.6, .7), body);
      [-20, -9, 9, 20].forEach(x => { addMesh(g, new THREE.CylinderGeometry(1.4, 1.6, 7, 14), dark, x, -1.6, -1, { rx: Math.PI / 2 }); const s = new THREE.Sprite(Arcade3D.glowSprite(glow)); s.position.set(x, -1.6, -5); s.scale.setScalar(6); g.add(s); U.nozzles.push(s); });
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glowM(glow)); eye.position.set(0, .4, 15.2); eye.scale.set(1.6, .6, .6); g.add(eye);
      [[34, '#ff3b3b'], [-34, '#3bff7a']].forEach(([x, c]) => { const s = new THREE.Sprite(Arcade3D.glowSprite(c)); s.position.set(x, 0, -8); s.scale.setScalar(4); g.add(s); U.lights.push(s); });
      Arcade3D.outline(g, { px: 1.1, min: 60 }); tag(g, U); return g;
    }
    /* caça-drone: asa em delta misturada, cauda em V */
    addMesh(g, lathe(prof([[0, 6.5], [.4, 5.6], [.85, 3.8], [1.05, 1.2], [1.05, -2.5], [.8, -5.2], [.6, -5.8]]), 18, 1.5, .62), body);
    const w = planform([[.9, 3.6], [6.4, -3.2], [6.4, -4.2], [3.5, -3.6], [.9, -5.4]], .32, .1); addMesh(g, w, wing); addMesh(g, mirrorX(w), wing);
    const t = finform([[-3.2, .2], [-5.4, 2.6], [-6.3, 2.6], [-5.9, .2]], .16);
    [1, -1].forEach(sd => { const piv = new THREE.Group(); piv.position.set(sd * .9, .35, 0); piv.rotation.z = sd * -.62; g.add(piv); addMesh(piv, t, wing); });
    /* faixa de sensores e "olho" */
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), glowM(glow)); eye.position.set(0, .3, 4.2); eye.scale.set(.55, .14, .5); g.add(eye);
    addMesh(g, Arcade3D.roundBox(.05), dark, 0, .38, 1.2, { s: [.9, .12, 3.6] });
    if (ace) { const st = planform([[.9, 2.6], [6.0, -3.0], [6.0, -3.4], [.9, -1.6]], .05, .01); const sm = glowM(glow, .9); addMesh(g, st, sm, 0, .2, 0); addMesh(g, mirrorX(st), sm, 0, .2, 0); }
    addMesh(g, new THREE.CylinderGeometry(.5, .6, 1.2, 14, 1, true), dark, 0, 0, -5.6, { rx: Math.PI / 2 });
    const s = new THREE.Sprite(Arcade3D.glowSprite(glow)); s.position.set(0, 0, -6.4); s.scale.setScalar(3.2); g.add(s); U.nozzles.push(s);
    [[6.4, '#ff3b3b'], [-6.4, '#3bff7a']].forEach(([x, c]) => { const sp = new THREE.Sprite(Arcade3D.glowSprite(c)); sp.position.set(x, 0, -3.8); sp.scale.setScalar(1.3); g.add(sp); U.lights.push(sp); });
    U.wingtips = [new THREE.Vector3(6.4, 0, -3.8), new THREE.Vector3(-6.4, 0, -3.8)];
    Arcade3D.outline(g, { px: 1.1, min: 60 }); tag(g, U);
    return g;
  }

  /* balão de treino */
  function buildBalloon(env) {
    const g = new THREE.Group();
    const tex = canvasTex(256, 128, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ef4444'; x.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
    addMesh(g, new THREE.SphereGeometry(9, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: .5, metalness: 0, envMap: env }), 0, 6, 0, { s: [1, 1.15, 1] });
    addMesh(g, new THREE.CylinderGeometry(.08, .08, 14, 4), plainMat('#cccccc', env), 0, -7, 0);
    addMesh(g, Arcade3D.roundBox(.2), plainMat('#8a6a4a', env, { metalness: 0 }), 0, -14, 0, { s: [2, 1.4, 2] });
    return g;
  }

  /* ════════════════════════════════════════════════════════════════
     unidades de terra e navios
  ════════════════════════════════════════════════════════════════ */
  function buildGround(kind, env) {
    const g = new THREE.Group(), U = { spin: null, aim: null, glow: [] };
    const olive = plainMat('#5d6550', env, { metalness: .2, roughness: .7 }), grey = plainMat('#7c838c', env, { metalness: .35, roughness: .55 }), dark = plainMat('#2a2d33', env, { metalness: .5, roughness: .5 }), conc = plainMat('#a5a39b', env, { metalness: 0, roughness: .9 });
    const rb = Arcade3D.roundBox(.12);
    if (kind === 'radar') {
      addMesh(g, new THREE.CylinderGeometry(9, 10, 3, 16), conc, 0, 1.5, 0);
      addMesh(g, new THREE.CylinderGeometry(1.4, 2, 16, 10), grey, 0, 10, 0);
      const piv = new THREE.Group(); piv.position.set(0, 19, 0); g.add(piv);
      const dish = new THREE.SphereGeometry(9, 20, 10, 0, TAU, 0, .9); dish.scale(1, .45, 1); dish.rotateX(Math.PI / 2);
      addMesh(piv, dish, plainMat('#d8dde3', env, { side: THREE.DoubleSide, metalness: .3 }), 0, 1, -1, { rx: -.25 });
      addMesh(piv, rb, dark, 0, 0, 0, { s: [3, 2, 3] });
      const l = new THREE.Sprite(Arcade3D.glowSprite('#ff3b3b')); l.position.set(0, 26, 0); l.scale.setScalar(5); g.add(l); U.glow.push(l);
      U.spin = piv;
    } else if (kind === 'sam') {
      addMesh(g, rb, olive, 0, 1.6, 0, { s: [7, 2.4, 13] });
      [-3.5, 0, 3.5].forEach(z => [-3.2, 3.2].forEach(x => addMesh(g, new THREE.CylinderGeometry(1.1, 1.1, .8, 10), dark, x, .9, z, { rz: Math.PI / 2 })));
      const piv = new THREE.Group(); piv.position.set(0, 3.2, -1); g.add(piv);
      const rack = new THREE.Group(); rack.rotation.x = -.6; piv.add(rack);
      [[-1, .5], [1, .5], [-1, 1.7], [1, 1.7]].forEach(([x, y]) => addMesh(rack, new THREE.CylinderGeometry(.55, .55, 7, 10), grey, x, y, 2.5, { rx: Math.PI / 2 }));
      U.aim = piv;
    } else if (kind === 'aa') {
      addMesh(g, new THREE.CylinderGeometry(5, 6, 2, 12), conc, 0, 1, 0);
      const piv = new THREE.Group(); piv.position.set(0, 3, 0); g.add(piv);
      addMesh(piv, rb, olive, 0, 0, 0, { s: [4.4, 2.6, 4.4] });
      const bar = new THREE.Group(); bar.position.set(0, .6, 0); bar.rotation.x = -.8; piv.add(bar);
      [-.7, .7].forEach(x => addMesh(bar, new THREE.CylinderGeometry(.22, .22, 6, 8), dark, x, 0, 3, { rx: Math.PI / 2 }));
      U.aim = piv;
    } else if (kind === 'depot') {
      [[-9, 0], [0, 0], [9, 0], [-4.5, 10], [4.5, 10]].forEach(([x, z]) => { addMesh(g, new THREE.CylinderGeometry(4, 4, 7, 16), plainMat('#c9ccc9', env, { metalness: .5 }), x, 3.5, z); addMesh(g, new THREE.SphereGeometry(4, 16, 8, 0, TAU, 0, Math.PI / 2), plainMat('#c9ccc9', env, { metalness: .5 }), x, 7, z, { s: [1, .35, 1] }); });
      addMesh(g, rb, conc, 0, .2, 4, { s: [30, .4, 24] });
    } else if (kind === 'hangar') {
      const h = new THREE.CylinderGeometry(14, 14, 36, 20, 1, false, 0, Math.PI); h.rotateZ(Math.PI / 2); h.rotateY(Math.PI / 2);
      addMesh(g, h, grey, 0, 0, 0);
      addMesh(g, new THREE.PlaneGeometry(22, 12), dark, 0, 6, 18.05);
    } else if (kind === 'tower') {
      addMesh(g, new THREE.CylinderGeometry(1, 3.5, 48, 4), grey, 0, 24, 0);
      addMesh(g, rb, dark, 0, 48, 0, { s: [6, 4, 6] });
      [0, 1, 2].forEach(i => { const s = new THREE.Sprite(Arcade3D.glowSprite('#ff3b3b')); s.position.set(0, 16 + i * 16, 0); s.scale.setScalar(4); g.add(s); U.glow.push(s); });
    } else if (kind === 'core') {
      /* núcleo do gerador (missão do desfiladeiro) */
      addMesh(g, new THREE.CylinderGeometry(26, 30, 8, 24), conc, 0, 4, 0);
      [0, 1, 2, 3, 4, 5].forEach(i => { const a = i / 6 * TAU; addMesh(g, rb, grey, Math.cos(a) * 22, 14, Math.sin(a) * 22, { s: [4, 22, 4] }); });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 16), glowM('#57e3ff')); orb.position.y = 22; g.add(orb); U.glow.push(orb);
      const halo = new THREE.Sprite(Arcade3D.glowSprite('#57e3ff')); halo.position.y = 22; halo.scale.setScalar(70); g.add(halo); U.glow.push(halo);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 1, 8, 40), glowM('#9af0ff')); ring.position.y = 22; ring.rotation.x = Math.PI / 2; g.add(ring); U.spin = ring;
    } else if (kind === 'ship') {
      const s = new THREE.Shape(); s.moveTo(0, 62); s.quadraticCurveTo(9, 30, 9, 0); s.lineTo(8, -48); s.lineTo(-8, -48); s.lineTo(-9, 0); s.quadraticCurveTo(-9, 30, 0, 62);
      const hull = new THREE.ExtrudeGeometry(s, { depth: 9, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 }); hull.rotateX(Math.PI / 2); hull.translate(0, 5, 0);
      addMesh(g, hull, plainMat('#59616b', env, { metalness: .3, roughness: .6 }));
      addMesh(g, rb, plainMat('#79828d', env), 0, 8, -4, { s: [12, 8, 26] });
      addMesh(g, rb, plainMat('#79828d', env), 0, 14, -8, { s: [8, 6, 10] });
      addMesh(g, new THREE.CylinderGeometry(.6, .9, 20, 6), dark, 0, 26, -8);
      const piv = new THREE.Group(); piv.position.set(0, 36, -8); g.add(piv);
      addMesh(piv, rb, plainMat('#d8dde3', env), 0, 0, 0, { s: [9, 1.6, 1.2] }); U.spin = piv;
      const t = new THREE.Group(); t.position.set(0, 7, 28); g.add(t);
      addMesh(t, new THREE.CylinderGeometry(3, 3.6, 3, 12), plainMat('#79828d', env), 0, 0, 0);
      addMesh(t, new THREE.CylinderGeometry(.5, .5, 9, 8), dark, 0, 1, 4.5, { rx: Math.PI / 2 });
      U.aim = t;
      const l = new THREE.Sprite(Arcade3D.glowSprite('#ff3b3b')); l.position.set(0, 37.5, -8); l.scale.setScalar(4); g.add(l); U.glow.push(l);
    }
    tag(g, U);
    return g;
  }

  /* a Fortaleza Celeste (chefe): asa voadora enorme, 4 motores-alvo e um núcleo */
  function buildFortress(env) {
    const g = new THREE.Group(), U = { engines: [], core: null, glow: [], nozzles: [] };
    const hull = bodyMat('#5a6270', env, true), dark = plainMat('#22262c', env, { metalness: .7, roughness: .3 }), trim = glowM('#ff4d6d');
    const w = planform([[0, 95], [150, -20], [150, -42], [60, -30], [0, -60]], 14, 4);
    addMesh(g, w, hull); addMesh(g, mirrorX(w), hull);
    addMesh(g, lathe(prof([[0, 100], [14, 80], [26, 40], [30, 0], [26, -40], [16, -64]]), 24, 1.5, .55), bodyMat('#666f7d', env));
    /* luzes ao longo do bordo de ataque */
    [1, -1].forEach(sd => { for (let i = 0; i < 12; i++) { const t = i / 11, s = new THREE.Sprite(Arcade3D.glowSprite('#ff4d6d')); s.position.set(sd * t * 150, 2, 95 - t * 115); s.scale.setScalar(9); g.add(s); U.glow.push(s); } });
    const strip = planform([[0, 96], [150, -19], [150, -21], [0, 92]], 1, .2); addMesh(g, strip, trim, 0, 7, 0); addMesh(g, mirrorX(strip), trim, 0, 7, 0);
    [-105, -55, 55, 105].forEach((x, i) => {
      const e = new THREE.Group(); e.position.set(x, -9, -18 + Math.abs(x) * .1); g.add(e);
      addMesh(e, new THREE.CylinderGeometry(9, 10, 40, 18), dark, 0, 0, 0, { rx: Math.PI / 2 });
      addMesh(e, new THREE.TorusGeometry(9.6, 1.4, 8, 24), plainMat('#5b616b', env), 0, 0, 19);
      const f = new THREE.Mesh(new THREE.CircleGeometry(8, 20), glowM('#ff7a3a')); f.position.z = -20.1; f.rotation.y = Math.PI; e.add(f);
      const s = new THREE.Sprite(Arcade3D.glowSprite('#ff7a3a')); s.position.z = -26; s.scale.setScalar(40); e.add(s); U.nozzles.push(s);
      U.engines.push(e);
    });
    const core = new THREE.Group(); core.position.set(0, 18, 10); g.add(core);
    addMesh(core, new THREE.SphereGeometry(16, 24, 12, 0, TAU, 0, Math.PI / 2), plainMat('#1a2a3a', env, { metalness: .9, roughness: .1, envMapIntensity: 1.5 }));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 12), glowM('#ff2d55')); orb.position.y = 3; core.add(orb); U.glow.push(orb);
    U.core = core; U.orb = orb;
    /* torres de canhão (decorativas) */
    [[-70, 0], [70, 0], [-30, 50], [30, 50]].forEach(([x, z]) => { addMesh(g, new THREE.CylinderGeometry(4, 5, 4, 10), dark, x, 9, z); addMesh(g, new THREE.CylinderGeometry(.8, .8, 10, 6), dark, x, 11, z + 5, { rx: Math.PI / 2 }); });
    tag(g, U);
    return g;
  }

  /* anel de passagem (treino, desfiladeiro, voo livre) */
  function buildRing(r) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 2.6, 10, 48), new THREE.MeshBasicMaterial({ color: '#5cf2ff', toneMapped: false, transparent: true, opacity: .9 }));
    g.add(m);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(r * .82, .8, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(inner);
    g.userData = { ring: m, inner };
    return g;
  }

  /* ════════════════════════════════════════════════════════════════
     efeitos
  ════════════════════════════════════════════════════════════════ */
  function softTex(kind) {
    return canvasTex(128, 128, (x, w, h) => {
      if (kind === 'smoke') {
        const r = rng(13);
        for (let i = 0; i < 18; i++) {
          const a = r() * TAU, d = r() * 26, cx = 64 + Math.cos(a) * d, cy = 64 + Math.sin(a) * d, rr = 18 + r() * 26;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
          const v = 200 + Math.floor(r() * 55);
          g.addColorStop(0, `rgba(${v},${v},${v},.42)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
          x.fillStyle = g; x.fillRect(0, 0, w, h);
        }
      } else {
        const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.75)'); g.addColorStop(.45, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }
    }, false);
  }
  const PT_VS = `
    attribute float aSize; attribute vec4 aCol; attribute float aRot;
    uniform float uScale, uNear, uFar; varying vec4 vCol; varying float vRot, vFog;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      gl_PointSize = aSize <= 0. ? 0. : clamp(aSize * uScale / max(d, .5), 1., 900.);
      vCol = aCol; vRot = aRot; vFog = smoothstep(uNear, uFar, d);
    }`;
  const PT_FS = `
    uniform sampler2D map; uniform vec3 uFog, uLight; uniform float uAdd;
    varying vec4 vCol; varying float vRot, vFog;
    void main(){
      vec2 c = gl_PointCoord - .5; float cs = cos(vRot), sn = sin(vRot);
      vec2 uv = vec2(c.x*cs - c.y*sn, c.x*sn + c.y*cs) + .5;
      vec4 t = texture2D(map, uv);
      vec3 col; float a;
      if (uAdd > .5) { col = vCol.rgb * t.r; a = t.a * vCol.a * (1. - vFog); }
      else { col = mix(vCol.rgb * uLight * (.72 + .28 * t.r), uFog, vFog); a = t.a * vCol.a; }
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function particles(scene, cap, additive, sky) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 4), siz = new Float32Array(cap), rot = new Float32Array(cap);
    const mk = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', mk(pos, 3)); geo.setAttribute('aCol', mk(col, 4)); geo.setAttribute('aSize', mk(siz, 1)); geo.setAttribute('aRot', mk(rot, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softTex(additive ? 'glow' : 'smoke') }, uScale: { value: 500 }, uNear: { value: sky.fogNear }, uFar: { value: sky.fogFar }, uFog: { value: new THREE.Color(sky.fog) }, uLight: { value: new THREE.Color(1, 1, 1) }, uAdd: { value: additive ? 1 : 0 } },
      vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 8 : 7; scene.add(pts);
    /* estado: x y z vx vy vz life max s0 s1 r g b r1 g1 b1 a0 drag grav rot rotv */
    const F = 21, st = new Float32Array(cap * F);
    let next = 0, hi = 0;
    const c0 = new THREE.Color(), c1 = new THREE.Color();
    function spawn(o) {
      const i = next; next = (next + 1) % cap; if (i >= hi) hi = i + 1;
      const b = i * F;
      st[b] = o.x; st[b + 1] = o.y; st[b + 2] = o.z; st[b + 3] = o.vx || 0; st[b + 4] = o.vy || 0; st[b + 5] = o.vz || 0;
      st[b + 6] = st[b + 7] = o.life || 1; st[b + 8] = o.s0 || 4; st[b + 9] = o.s1 != null ? o.s1 : (o.s0 || 4);
      c0.set(o.c0 || '#ffffff'); c1.set(o.c1 || o.c0 || '#ffffff');
      if (o.k) { c0.multiplyScalar(o.k); c1.multiplyScalar(o.k); }
      st[b + 10] = c0.r; st[b + 11] = c0.g; st[b + 12] = c0.b; st[b + 13] = c1.r; st[b + 14] = c1.g; st[b + 15] = c1.b;
      st[b + 16] = o.a != null ? o.a : 1; st[b + 17] = o.drag || 0; st[b + 18] = o.grav || 0; st[b + 19] = o.rot != null ? o.rot : Math.random() * TAU; st[b + 20] = o.rotv || 0;
    }
    function update(dt) {
      for (let i = 0; i < hi; i++) {
        const b = i * F;
        if (st[b + 6] <= 0) { siz[i] = 0; continue; }
        st[b + 6] -= dt;
        const l = Math.max(0, st[b + 6]), t = 1 - l / st[b + 7], dr = Math.max(0, 1 - st[b + 17] * dt);
        st[b + 3] *= dr; st[b + 4] = st[b + 4] * dr - st[b + 18] * dt; st[b + 5] *= dr;
        st[b] += st[b + 3] * dt; st[b + 1] += st[b + 4] * dt; st[b + 2] += st[b + 5] * dt; st[b + 19] += st[b + 20] * dt;
        pos[i * 3] = st[b]; pos[i * 3 + 1] = st[b + 1]; pos[i * 3 + 2] = st[b + 2];
        siz[i] = l > 0 ? lerp(st[b + 8], st[b + 9], 1 - (1 - t) * (1 - t)) : 0;
        col[i * 4] = lerp(st[b + 10], st[b + 13], t); col[i * 4 + 1] = lerp(st[b + 11], st[b + 14], t); col[i * 4 + 2] = lerp(st[b + 12], st[b + 15], t);
        col[i * 4 + 3] = st[b + 16] * (additive ? (1 - t) : Math.min(1, t * 8) * (1 - t * t));
        rot[i] = st[b + 19];
      }
      geo.setDrawRange(0, hi);
      geo.attributes.position.needsUpdate = geo.attributes.aCol.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aRot.needsUpdate = true;
    }
    return { spawn, update, mat, points: pts };
  }

  /* fita (rastos de condensação, rastos de vórtice) */
  const RB_VS = `attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
  const RB_FS = `uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * uOp);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
  function ribbon(scene, n, width, color, life, additive) {
    const pos = new Float32Array(n * 2 * 3), al = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aA', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(color) }, uOp: { value: 1 } }, vertexShader: RB_VS, fragmentShader: RB_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 6; scene.add(mesh);
    const P = []; let acc = 0;
    const v = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3(), toC = new THREE.Vector3();
    return {
      mesh,
      push(x, y, z, on, dt) {
        acc += dt;
        if (P.length && acc < .03) { const p = P[0]; p.x = x; p.y = y; p.z = z; p.on = Math.max(p.on, on); return; }
        acc = 0; P.unshift({ x, y, z, t: 0, on }); if (P.length > n) P.pop();
      },
      update(cam, dt) {
        P.forEach(p => { p.t += dt; });
        while (P.length && P[P.length - 1].t > life) P.pop();
        for (let i = 0; i < n; i++) {
          const p = P[Math.min(i, P.length - 1)];
          if (!p) { al[i * 2] = al[i * 2 + 1] = 0; continue; }
          const q = P[Math.min(i + 1, P.length - 1)], o = P[Math.min(Math.max(i - 1, 0), P.length - 1)];
          dir.set(o.x - q.x, o.y - q.y, o.z - q.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
          toC.set(cam.position.x - p.x, cam.position.y - p.y, cam.position.z - p.z);
          side.crossVectors(dir, toC).normalize();
          const k = i < P.length ? 1 - p.t / life : 0, w = width * (.4 + (1 - k) * 1.2);
          v.set(p.x, p.y, p.z);
          pos[i * 6] = v.x + side.x * w; pos[i * 6 + 1] = v.y + side.y * w; pos[i * 6 + 2] = v.z + side.z * w;
          pos[i * 6 + 3] = v.x - side.x * w; pos[i * 6 + 4] = v.y - side.y * w; pos[i * 6 + 5] = v.z - side.z * w;
          const a = i < P.length ? k * k * p.on * Math.min(1, i / 3) : 0; al[i * 2] = al[i * 2 + 1] = a;
        }
        geo.attributes.position.needsUpdate = geo.attributes.aA.needsUpdate = true;
      },
      clear() { P.length = 0; },
    };
  }

  /* traçadoras: caixas finas instanciadas, viradas para a velocidade */
  function tracers(scene, cap) {
    const g = new THREE.BoxGeometry(.32, .32, 1);
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#ffd38a', toneMapped: false }), cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0; scene.add(im);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), f = new THREE.Vector3(0, 0, 1), d = new THREE.Vector3();
    const c = new THREE.Color();
    return {
      im,
      set(list) {
        const n = Math.min(cap, list.length);
        for (let i = 0; i < n; i++) {
          const b = list[i]; d.set(b.vx, b.vy, b.vz); const sp = d.length(); d.multiplyScalar(1 / (sp || 1));
          q.setFromUnitVectors(f, d); p.set(b.x - d.x * 9, b.y - d.y * 9, b.z - d.z * 9); s.set(b.w || 1, b.w || 1, 18);
          m.compose(p, q, s); im.setMatrixAt(i, m); c.set(b.c || '#ffd38a'); im.setColorAt(i, c);
        }
        im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      },
    };
  }

  return {
    V: 3,   /* sobe quando a API muda — os jogos que dependem dela verificam */
    SIZE, MAPS, SKIES, PAL, JETS, LIVERY, rng, perlin, canyonX,
    heightGrid, findSite, buildTerrain, buildFlora, buildTowns, skyMesh, skyEnv, buildWater, seaDepth, detailTex, pnoise, buildClouds,
    buildJet, buildDrone, buildBalloon, buildGround, buildFortress, buildRing, missileMesh, refs, particles, ribbon, tracers, mergeGeos, canvasTex, M4, treeGeo, puffTex, softTex, sstep, glowM, plainMat, bodyMat, planform, lathe, prof, addMesh,
  };
})();
