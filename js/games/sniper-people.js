/* ══════════════════════════════════════════════════════════════════
   Operação Soneca — gente articulada (out/2026)
   Cada pessoa é um esqueleto simples (anca, coluna, cabeça, ombros,
   cotovelos, joelhos, tornozelos) com dezenas de peças; para caberem
   centenas no ecrã, cada TIPO de peça é UMA InstancedMesh (cor por
   instância) e as matrizes saem de cinemática direta a cada frame.
   Peças torneadas (tronco, braços e pernas com músculo), cara com
   olhos de íris e brilho, nariz, orelhas e bochechas; mãos com dedos,
   sapatos com sola e atacadores; camisa com colarinho e botões.
   Variantes (cabelos, chapéus, bigodes, óculos, coletes, gravatas,
   adereços, espingarda de dardos dos guardas) só ocupam "lugares" nas
   pessoas que as usam. Os braços têm IK de dois ossos para agarrar a
   espingarda (ao peito, a apontar) ou o volante.
   Poses: andar (passada calculada para os pés não escorregarem),
   correr, conversar, telefone, café, dançar, sentar, conduzir,
   palmas, tocar, binóculos, rádio, braços cruzados, apanhar sol,
   abanar alguém, susto, sono (bocejo, pernas a ceder, cair de lado,
   dormir enroscado com a respiração a mexer o peito).
   Medidas: 1 unidade = 1 m, adulto ≈ 1,75 m, frente para +Z.
══════════════════════════════════════════════════════════════════ */
const SniperPeople = (function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  /* ── geometrias (pivô na articulação de cima; o membro estende-se para −Y) ── */
  let GEO = null;
  function M(x, y, z, rx, ry, rz, sx, sy, sz) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)); }
  /* junta geometrias com cor por vértice (branco = tingido pela cor da instância); espelhos invertem a ordem dos triângulos */
  function merge(list) {
    let n = 0; const parts = list.map(([g, c, m]) => {
      const q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m);
      if (m && m.determinant() < 0) { const p = q.attributes.position, nn = q.attributes.normal; for (let i = 0; i < p.count; i += 3) { for (const a of [p, nn]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); } } }
      n += q.attributes.position.count; return [q, new THREE.Color(c || '#ffffff')];
    });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    parts.forEach(([q, c]) => { const p = q.attributes.position, nn = q.attributes.normal; for (let i = 0; i < p.count; i++, o++) { pos[o * 3] = p.getX(i); pos[o * 3 + 1] = p.getY(i); pos[o * 3 + 2] = p.getZ(i); nor[o * 3] = nn.getX(i); nor[o * 3 + 1] = nn.getY(i); nor[o * 3 + 2] = nn.getZ(i); col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b; } q.dispose(); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); return g;
  }
  const S = (r, w, h, a, b, c, d) => new THREE.SphereGeometry(r, w || 12, h || 9, a, b, c, d);
  const C = (rt, rb, h, s, open) => new THREE.CylinderGeometry(rt, rb, h, s || 10, 1, !!open);
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  /* peça torneada: perfil [[raio, y]…] (qualquer ordem), achatada em z */
  function lathe(pts, seg, zs, open) {
    const p = pts.slice().sort((a, b) => a[1] - b[1]).map(([r, y]) => new THREE.Vector2(Math.max(open ? r : 0, r), y));
    const g = new THREE.LatheGeometry(p, seg || 14); if (zs && zs !== 1) g.scale(1, 1, zs); g.computeVertexNormals(); return g;
  }
  /* perfil do tronco (raio por altura) — os coletes e as riscas seguem-no */
  const TORSO = [[.150, 0], [.153, .04], [.147, .12], [.151, .2], [.162, .29], [.171, .36], [.172, .41], [.164, .455], [.138, .49], [.088, .515], [.045, .526], [.001, .529]];
  const TZ = .64;
  function torsoR(y) { for (let i = 1; i < TORSO.length; i++) if (y <= TORSO[i][1]) { const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i]; return lerp(r0, r1, (y - y0) / (y1 - y0)); } return 0; }
  const band = (y0, y1, off, seg) => lathe([[torsoR(y0) + off, y0], [torsoR((y0 + y1) / 2) + off, (y0 + y1) / 2], [torsoR(y1) + off, y1]], seg || 16, TZ, true);
  const zf = (y, off) => (torsoR(y) + (off || 0)) * TZ;
  /* cabeça: esfera com maxilar, queixo e nuca */
  function headGeo() {
    const g = S(.106, 18, 13), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ny = y / .106;
      const jaw = clamp((.25 - ny) / 1.25, 0, 1);
      x *= 1 - .2 * jaw; z *= 1 - .06 * jaw; if (z > 0 && ny < -.2) z += .012 * jaw;
      if (z < 0) z *= 1.06 + .04 * clamp(ny, 0, 1);
      y *= 1.1; p.setXYZ(i, x * .95, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  function geos() {
    if (GEO) return GEO;
    const G = {};
    /* tronco torneado com camisa: colarinho, carcela, botões, bolso e bainha */
    G.torso = merge([
      [lathe(TORSO, 16, TZ), 0],
      [S(.068, 10, 7), 0, M(.152, .448, 0, 0, 0, 0, 1, .82, 1)], [S(.068, 10, 7), 0, M(-.152, .448, 0, 0, 0, 0, 1, .82, 1)],
      [new THREE.TorusGeometry(.058, .017, 4, 12), '#e6e6e6', M(0, .508, .006, Math.PI / 2 - .25, 0, 0, 1, .82, 1)],
      [B(.024, .4, .008), '#d2d2d2', M(0, .29, zf(.29, .002))],
      ...[.16, .25, .34, .43].map(y => [S(.0075, 4, 3), '#8a8a8a', M(0, y, zf(y, .006))]),
      [B(.07, .075, .008), '#cfcfcf', M(.075, .37, zf(.37, -.004) - .003, 0, .32)],
      [band(.0, .035, .004), '#d8d8d8'],
    ]);
    G.pelvis = merge([[lathe([[.151, .1], [.155, .05], [.152, -.01], [.135, -.06], [.08, -.095], [.001, -.105]], 16, .72), 0], [B(.02, .1, .008), '#c8c8c8', M(0, .0, .108, .1)]]);
    G.belt = merge([[band(.07, .1, .006, 18), '#ffffff', M(0, -.005, 0, 0, 0, 0, 1.02, 1, 1.12)], [B(.045, .032, .012), '#d6b45a', M(0, .08, .115)]]);
    G.neck = merge([[C(.045, .053, .1, 12), 0, M(0, .05, 0)]]);
    /* cabeça: crânio, nariz, orelhas, bochechas */
    G.head = merge([[headGeo(), 0, M(0, .105, 0)], [S(.021, 8, 6), 0, M(0, .092, .104, -.35, 0, 0, 1, 1.3, 1.35)], [S(.012, 5, 3), 0, M(.013, .075, .106, 0, 0, 0, 1, .7, 1)], [S(.012, 5, 3), 0, M(-.013, .075, .106, 0, 0, 0, 1, .7, 1)],
      [S(.025, 8, 6), 0, M(.1, .1, -.004, 0, 0, 0, .42, 1, .78)], [S(.025, 8, 6), 0, M(-.1, .1, -.004, 0, 0, 0, .42, 1, .78)], [S(.012, 5, 3), '#c89890', M(.104, .1, .0, 0, 0, 0, .4, .9, .6)], [S(.012, 5, 3), '#c89890', M(-.104, .1, .0, 0, 0, 0, .4, .9, .6)],
      [S(.026, 8, 5), '#ffd2c8', M(.058, .072, .075, 0, 0, 0, 1, .7, .45)], [S(.026, 8, 5), '#ffd2c8', M(-.058, .072, .075, 0, 0, 0, 1, .7, .45)]]);
    /* olhos: branco + brilho (tinge com eyeW), íris + pupila (tinge com a cor dos olhos) */
    G.eyes = merge([[S(.0168, 8, 6), '#ffffff', M(.036, .118, .086, 0, 0, 0, 1, 1, .72)], [S(.0168, 8, 6), '#ffffff', M(-.036, .118, .086, 0, 0, 0, 1, 1, .72)], [S(.0032, 4, 3), '#ffffff', M(.041, .124, .1095)], [S(.0032, 4, 3), '#ffffff', M(-.031, .124, .1095)]]);
    G.pupils = merge([[S(.0105, 7, 5), '#ffffff', M(.036, .118, .0985, 0, 0, 0, 1, 1, .5)], [S(.0105, 7, 5), '#ffffff', M(-.036, .118, .0985, 0, 0, 0, 1, 1, .5)], [S(.0058, 5, 4), '#151515', M(.036, .118, .1035, 0, 0, 0, 1, 1, .5)], [S(.0058, 5, 4), '#151515', M(-.036, .118, .1035, 0, 0, 0, 1, 1, .5)]]);
    G.brows = merge([[C(.0055, .0055, .044, 6), 0, M(.037, .147, .095, 0, 0, Math.PI / 2 - .14)], [C(.0055, .0055, .044, 6), 0, M(-.037, .147, .095, 0, 0, Math.PI / 2 + .14)]]);
    G.mouth = merge([[S(.019, 8, 5), 0, M(0, .058, .097, 0, 0, 0, 1.25, .34, .5)]]);
    /* pálpebras de cima (cor da pele): fecham por cima do olho a pestanejar e a dormir */
    G.lids = merge([[S(.0182, 9, 6), 0, M(.036, 0, .087, 0, 0, 0, 1.06, 1, .78)], [S(.0182, 9, 6), 0, M(-.036, 0, .087, 0, 0, 0, 1.06, 1, .78)]]);
    /* saia evasê (pivô na cintura) */
    G.skirt = merge([[new THREE.LatheGeometry([[.255, -.445], [.262, -.43], [.235, -.3], [.19, -.1], [.168, .02], [.163, .075]].map(([r, y]) => new THREE.Vector2(r, y)), 18), 0, M(0, 0, 0, 0, 0, 0, 1, 1, .82)], [new THREE.TorusGeometry(.258, .012, 4, 18), '#e8e8e8', M(0, -.43, 0, Math.PI / 2, 0, 0, 1, .82, 1)]]);
    /* cabelos */
    const cap = (o) => [S(.114, 16, 8, 0, TAU, 0, Math.PI * (o || .52)), 0, M(0, .116, -.008, -.18, 0, 0, .98, 1.05, 1.06)];
    const fringe = [0, 1, 2, 3].map(k => [S(.04, 6, 4), 0, M(-.05 + k * .033, .19 - Math.abs(k - 1.5) * .006, .075, -.6, 0, (k - 1.5) * .25, 1.1, .5, .8)]);
    const hs = [cap(), [S(.1, 12, 8, 0, TAU, Math.PI * .4, Math.PI * .35), 0, M(0, .1, -.03, 0, 0, 0, .96, 1, 1)], [B(.016, .045, .03), 0, M(.097, .085, .03)], [B(.016, .045, .03), 0, M(-.097, .085, .03)]];
    G.hair_short_h = merge(hs);
    G.hair_short = merge([cap(), ...fringe, [S(.1, 12, 8, 0, TAU, Math.PI * .4, Math.PI * .35), 0, M(0, .1, -.03, 0, 0, 0, .96, 1, 1)], [B(.016, .045, .03), 0, M(.097, .085, .03)], [B(.016, .045, .03), 0, M(-.097, .085, .03)]]);
    G.hair_long = merge([cap(.55), ...fringe, [S(.11, 14, 10, 0, TAU, Math.PI * .45, Math.PI * .55), 0, M(0, .03, -.02, 0, 0, 0, 1.02, 1.6, .95)], [S(.05, 10, 8), 0, M(.085, .0, .03, 0, 0, .1, .7, 2.2, .9)], [S(.05, 10, 8), 0, M(-.085, .0, .03, 0, 0, -.1, .7, 2.2, .9)], [S(.1, 12, 8), 0, M(0, -.12, -.07, 0, 0, 0, 1, .55, .45)]]);
    G.hair_long_h = merge([cap(.55), [S(.11, 14, 10, 0, TAU, Math.PI * .45, Math.PI * .55), 0, M(0, .03, -.02, 0, 0, 0, 1.02, 1.6, .95)], [S(.05, 10, 8), 0, M(.085, .0, .03, 0, 0, .1, .7, 2.2, .9)], [S(.05, 10, 8), 0, M(-.085, .0, .03, 0, 0, -.1, .7, 2.2, .9)], [S(.1, 12, 8), 0, M(0, -.12, -.07, 0, 0, 0, 1, .55, .45)]]);
    G.hair_pony_h = merge([cap(), [C(.032, .012, .22, 8), 0, M(0, .05, -.15, .45)], [S(.03, 8, 6), 0, M(0, .145, -.13)]]);
    G.hair_bun = merge([cap(), ...fringe.slice(1, 3), [S(.05, 12, 9), 0, M(0, .19, -.095)], [new THREE.TorusGeometry(.03, .008, 5, 12), '#c8c8c8', M(0, .18, -.085, 1.1)]]);
    const curls = []; for (let i = 0; i < 20; i++) { const a = i * 2.4, b = .15 + (i % 7) / 7 * 1.15; curls.push([S(.045, 6, 4), 0, M(Math.cos(a) * Math.sin(b) * .108, .13 + Math.cos(b) * .1, Math.sin(a) * Math.sin(b) * .108 - .015)]); }
    G.hair_curly = merge([[S(.112, 12, 8), 0, M(0, .13, -.015, 0, 0, 0, 1, .9, 1)], ...curls]);
    G.hair_pony = merge([cap(), ...fringe, [S(.022, 8, 6), '#c8c8c8', M(0, .14, -.12)], [C(.032, .012, .22, 8), 0, M(0, .05, -.15, .45)], [S(.03, 8, 6), 0, M(0, .145, -.13)]]);
    /* chapéus */
    G.hat_cap = merge([[S(.118, 16, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .13, 0, 0, 0, 0, 1, .82, 1.04)], [C(.1, .1, .012, 14), 0, M(0, .135, .1, -.08, 0, 0, .9, 1, .78)], [S(.012, 6, 5), 0, M(0, .228, 0)], [C(.119, .119, .02, 16, true), '#bdbdbd', M(0, .14, 0, 0, 0, 0, 1, 1, 1.04)]]);
    G.hat_fedora = merge([[C(.085, .105, .11, 14), 0, M(0, .22, 0, 0, 0, 0, 1, 1, .92)], [C(.19, .19, .012, 18), 0, M(0, .165, 0, 0, 0, 0, 1, 1, .92)], [C(.107, .107, .025, 14), '#333333', M(0, .18, 0, 0, 0, 0, 1, 1, .93)], [S(.03, 8, 6), 0, M(0, .27, 0, 0, 0, 0, 2.2, .5, 1.5)]]);
    G.hat_beanie = merge([[S(.122, 16, 9, 0, TAU, 0, Math.PI / 2), 0, M(0, .145, -.01, -.12, 0, 0, 1, 1.05, 1.05)], [new THREE.TorusGeometry(.117, .02, 6, 18), 0, M(0, .15, -.01, Math.PI / 2 - .12, 0, 0, 1, 1.05, 1)], [S(.032, 8, 6), 0, M(0, .28, -.03)]]);
    G.hat_top = merge([[C(.098, .098, .22, 16), 0, M(0, .29, 0)], [C(.17, .17, .012, 18), 0, M(0, .18, 0)], [C(.1, .1, .035, 16), '#c03030', M(0, .205, 0)]]);
    G.hat_straw = merge([[C(.24, .25, .012, 20), 0, M(0, .165, 0)], [C(.09, .11, .09, 14), 0, M(0, .21, 0)], [C(.112, .112, .02, 14), '#b03a2a', M(0, .18, 0)]]);
    G.hat_hard = merge([[S(.125, 16, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .135, 0, 0, 0, 0, 1, .9, 1.06)], [C(.14, .14, .01, 16), 0, M(0, .14, .015, 0, 0, 0, 1, 1, 1.05)], [B(.02, .03, .2), 0, M(0, .245, 0)]]);
    G.hat_beret = merge([[S(.125, 16, 6, 0, TAU, 0, Math.PI / 2), 0, M(.015, .17, 0, 0, 0, -.25, 1.05, .45, 1.05)], [S(.012, 6, 5), 0, M(.04, .225, 0)]]);
    G.hat_chef = merge([[C(.11, .1, .1, 14), 0, M(0, .22, 0)], [S(.13, 14, 9), 0, M(0, .31, 0, 0, 0, 0, 1, .7, 1)]]);
    /* boné de guarda com emblema dourado */
    G.hat_guard = merge([[S(.12, 16, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .13, 0, 0, 0, 0, 1, .7, 1.04)], [C(.123, .118, .05, 16), 0, M(0, .155, 0, 0, 0, 0, 1, 1, 1.04)], [C(.1, .1, .012, 14, false), '#3a3a3a', M(0, .135, .1, -.15, 0, 0, .95, 1, .7)], [S(.016, 8, 6), '#ffd23a', M(0, .17, .121, 0, 0, 0, 1, 1, .4)], [C(.124, .124, .012, 16, true), '#d83a3a', M(0, .175, 0, 0, 0, 0, 1, 1, 1.04)]]);
    /* bigode à "Liga dos Bigodes" (pontas enroladas) e barba */
    G.mustache = merge([[S(.03, 10, 6), 0, M(.026, .068, .104, 0, 0, -.35, 1.5, .55, .6)], [S(.03, 10, 6), 0, M(-.026, .068, .104, 0, 0, .35, 1.5, .55, .6)], [new THREE.TorusGeometry(.012, .006, 5, 8), 0, M(.068, .08, .096, 0, .3, 0)], [new THREE.TorusGeometry(.012, .006, 5, 8), 0, M(-.068, .08, .096, 0, -.3, 0)]]);
    G.beard = merge([[S(.085, 14, 9, 0, TAU, Math.PI / 2, Math.PI / 2), 0, M(0, .075, .03, .25, 0, 0, 1.1, 1.05, 1)], [S(.03, 8, 6), 0, M(0, .066, .102, 0, 0, 0, 1.6, .5, .6)]]);
    G.glasses = merge([[C(.026, .026, .008, 14), 0, M(.038, .12, .108, Math.PI / 2)], [C(.026, .026, .008, 14), 0, M(-.038, .12, .108, Math.PI / 2)], [B(.03, .006, .006), 0, M(0, .125, .108)], [B(.006, .006, .11), 0, M(.1, .122, .05)], [B(.006, .006, .11), 0, M(-.1, .122, .05)]]);
    /* sobreposições do tronco (seguem o perfil) */
    G.tie = merge([[B(.035, .03, .02), 0, M(0, .46, zf(.46, .008))], [B(.045, .3, .012), 0, M(0, .29, zf(.36, .006), -.06)], [new THREE.ConeGeometry(.026, .05, 4), 0, M(0, .12, zf(.15, .008), Math.PI, Math.PI / 4)]]);
    G.lapel = merge([[B(.06, .26, .012), 0, M(.056, .35, zf(.36, .006), 0, 0, .3)], [B(.06, .26, .012), 0, M(-.056, .35, zf(.36, .006), 0, 0, -.3)], [B(.085, .14, .014), '#ffffff', M(0, .44, zf(.44, .002))], [band(.03, .12, .008), 0], [B(.012, .012, .006), '#d8d8d8', M(.09, .37, zf(.37, .012) + .003)]]);
    G.vest = merge([[band(.07, .43, .008), 0], [band(.22, .25, .012), '#e8eef2'], [band(.33, .36, .012), '#e8eef2']]);
    G.stripes = merge([0, 1, 2, 3, 4, 5].map(i => [band(.05 + i * .075, .08 + i * .075, .005), 0]));
    G.apron = merge([[B(.26, .48, .015), 0, M(0, .12, zf(.2, .012))], [band(.06, .085, .01), 0], [B(.13, .14, .012), 0, M(0, .36, zf(.36, .006))]]);
    G.backpack = merge([[B(.26, .32, .13), 0, M(0, .28, -.16)], [B(.2, .12, .05), 0, M(0, .2, -.235)], [B(.03, .3, .02), '#3a3a3a', M(.08, .3, .02, -.1)], [B(.03, .3, .02), '#3a3a3a', M(-.08, .3, .02, -.1)]]);
    G.collar = merge([[new THREE.TorusGeometry(.065, .018, 6, 14), 0, M(0, .5, .005, Math.PI / 2, 0, 0, 1, .7, 1)]]);
    /* farda dos guardas: braçadeira vermelha e cinto com bolsas */
    G.uniform = merge([[band(.05, .1, .009), '#2a2a2a'], [B(.05, .05, .03), '#3a3a3a', M(.09, .07, zf(.07, .014))], [B(.05, .05, .03), '#3a3a3a', M(-.09, .07, zf(.07, .014))], [B(.06, .04, .008), '#ffd23a', M(-.07, .4, zf(.4, .006), 0, -.35)], [B(.012, .3, .012), '#2a2a2a', M(.05, .3, zf(.3, .008), 0, 0, -.55)]]);
    G.armband = merge([[C(.06, .056, .05, 12, true), 0, M(0, -.1, 0)]]);
    /* braços e pernas torneados */
    G.uarm = merge([[lathe([[.001, .048], [.04, .036], [.056, .006], [.055, -.05], [.051, -.12], [.046, -.2], [.042, -.27], [.038, -.295], [.001, -.302]], 12), 0]]);
    G.farm = merge([[lathe([[.001, .03], [.039, .017], [.043, 0], [.046, -.05], [.043, -.11], [.036, -.2], [.031, -.25], [.001, -.262]], 12), 0]]);
    const fingers = [-1.5, -.5, .5, 1.5].map(k => [C(.0105, .009, .06, 5, true), 0, M(k * .0175, -.095 + Math.abs(k) * .004, .008, .28, 0, 0)]);
    const tips = [-1.5, -.5, .5, 1.5].map(k => [S(.0095, 5, 3), 0, M(k * .0175, -.124 + Math.abs(k) * .005, .017)]);
    const hand = [[S(.041, 8, 6), 0, M(0, -.048, 0, 0, 0, 0, .9, 1, .5)], ...fingers, ...tips, [C(.012, .01, .05, 5, true), 0, M(.035, -.05, .022, .4, 0, -.7)], [S(.011, 5, 3), 0, M(.05, -.068, .03)]];
    G.hand = merge(hand);
    G.handL = merge(hand.map(([g, c, m]) => [g, c, new THREE.Matrix4().makeScale(-1, 1, 1).multiply(m)]));
    G.thigh = merge([[lathe([[.001, .035], [.07, .018], [.079, 0], [.081, -.06], [.075, -.16], [.067, -.28], [.059, -.38], [.054, -.43], [.001, -.442]], 14), 0]]);
    G.shin = merge([[lathe([[.001, .025], [.054, .012], [.057, 0], [.055, -.04], [.06, -.12], [.055, -.2], [.046, -.3], [.04, -.4], [.001, -.425]], 14), 0]]);
    G.shoe = merge([[S(.052, 10, 7), 0, M(0, -.03, .055, 0, 0, 0, .95, .78, 2.1)], [S(.05, 8, 6), 0, M(0, -.03, -.02, 0, 0, 0, .95, .85, 1)], [B(.085, .024, .27), '#3a3a3a', M(0, -.064, .045)], [S(.044, 8, 4), '#3a3a3a', M(0, -.064, .17, 0, 0, 0, .98, .27, .9)], [B(.03, .006, .075), '#e0e0e0', M(0, .006, .06, -.25)]]);
    G.sleeve = merge([[C(.06, .052, .17, 9), 0, M(0, -.075, 0)]]);
    /* adereços (na mão direita) */
    G.p_phone = merge([[B(.036, .072, .01), 0, M(0, -.08, .03)], [B(.03, .06, .002), '#2a6dd8', M(0, -.08, .036)]]);
    G.p_cup = merge([[C(.03, .024, .08, 10), 0, M(0, -.08, .04)], [C(.032, .032, .01, 10), '#5a3a24', M(0, -.042, .04)]]);
    G.p_ice = merge([[new THREE.ConeGeometry(.026, .09, 8), '#d9a35a', M(0, -.06, .045, Math.PI)], [S(.032, 8, 6), 0, M(0, -.005, .045)]]);
    G.p_radio = merge([[B(.045, .09, .03), 0, M(0, -.08, .03)], [C(.004, .004, .07, 4), 0, M(.012, -.005, .03)]]);
    G.p_case = merge([[B(.4, .28, .09), 0, M(0, -.22, 0)], [B(.12, .03, .02), '#222222', M(0, -.065, 0)], [B(.04, .03, .095), '#d8c070', M(.12, -.1, 0)], [B(.04, .03, .095), '#d8c070', M(-.12, -.1, 0)]]);
    G.p_light = merge([[C(.022, .018, .16, 8), 0, M(0, -.06, .06, Math.PI / 2)], [C(.03, .022, .03, 8), '#fff6c0', M(0, -.06, .15, Math.PI / 2)]]);
    G.p_balloon = merge([[C(.003, .003, 1.1, 3), '#dddddd', M(0, .5, 0)], [S(.16, 14, 10), 0, M(0, 1.15, 0, 0, 0, 0, 1, 1.15, 1)]]);
    G.p_guitar = merge([[S(.16, 12, 8), 0, M(0, -.05, .14, Math.PI / 2, 0, 0, 1, .4, 1)], [S(.12, 12, 8), 0, M(.13, -.05, .14, Math.PI / 2, 0, 0, 1, .4, 1)], [B(.5, .04, .02), '#3a2412', M(-.3, -.05, .15)]]);
    G.p_bino = merge([[C(.025, .028, .1, 8), 0, M(.035, -.03, .06, Math.PI / 2)], [C(.025, .028, .1, 8), 0, M(-.035, -.03, .06, Math.PI / 2)], [B(.05, .02, .03), 0, M(0, -.03, .06)]]);
    G.p_broom = merge([[C(.012, .012, 1.3, 6), '#a07848', M(0, -.25, .05)], [B(.25, .08, .05), '#c8a050', M(0, -.9, .05)]]);
    /* espingarda de dardos dos guardas (cores próprias: a instância fica branca). Cano para +z, centro entre o punho e o guarda-mão */
    const dk = '#2c3036', ol = '#4a5640';
    G.p_rifle = merge([
      [B(.042, .11, .2), ol, M(0, -.03, -.36, .12)], [B(.046, .12, .03), '#1a1a1a', M(0, -.045, -.465, .12)],
      [B(.05, .075, .3), dk, M(0, 0, -.1)], [B(.034, .095, .045), dk, M(0, -.075, -.15, .35)], [new THREE.TorusGeometry(.022, .005, 4, 10, Math.PI), dk, M(0, -.045, -.09, 0, Math.PI / 2, Math.PI)],
      [B(.032, .12, .05), '#ffb020', M(0, -.085, -.01, -.22)], [B(.056, .062, .24), ol, M(0, -.006, .16)],
      [C(.012, .012, .32, 8), dk, M(0, .005, .42, Math.PI / 2)], [C(.022, .022, .06, 10), '#ff7a1a', M(0, .005, .6, Math.PI / 2)],
      [C(.022, .022, .2, 10), '#1f2226', M(0, .068, -.08, Math.PI / 2)], [C(.026, .022, .04, 10), '#1f2226', M(0, .068, .03, Math.PI / 2)], [C(.019, .019, .005, 10), '#4a8ac8', M(0, .068, .051, Math.PI / 2)],
      [B(.01, .03, .03), dk, M(0, .035, -.06)], [B(.01, .03, .03), dk, M(0, .035, -.11)],
    ]);
    G.dart = merge([[C(.006, .006, .12, 6), '#c9d4dc', M(0, .06, 0)], [new THREE.ConeGeometry(.02, .05, 6), '#ff3d6e', M(0, .14, 0)], [C(.008, .008, .03, 6), '#ffd040', M(0, .03, 0)]]);
    GEO = G; return G;
  }

  /* ── catálogo de peças: geometria, material, articulação e de onde vem a cor ── */
  const PARTS = [
    ['pelvis', 'pelvis', 'cloth', 'pants'], ['belt', 'belt', 'cloth', 'belt', 1], ['torso', 'torso', 'cloth', 'shirt'], ['neck', 'neck', 'skin', 'skin'], ['head', 'head', 'skin', 'skin'],
    ['eyes', 'eyes', 'eye', 'eyeW'], ['pupils', 'pupils', 'eye', 'eyeC'], ['lids', 'lids', 'skin', 'skin'], ['brows', 'brows', 'hair', 'hair'], ['mouth', 'mouth', 'dark', 'lip'],
    ['uarmL', 'uarm', 'cloth', 'sleeveC'], ['uarmR', 'uarm', 'cloth', 'sleeveC'], ['farmL', 'farm', 'skin', 'farmC'], ['farmR', 'farm', 'skin', 'farmC'], ['handL', 'handL', 'skin', 'handC'], ['handR', 'hand', 'skin', 'handC'],
    ['thighL', 'thigh', 'cloth', 'pants'], ['thighR', 'thigh', 'cloth', 'pants'], ['shinL', 'shin', 'cloth', 'shinC'], ['shinR', 'shin', 'cloth', 'shinC'], ['shoeL', 'shoe', 'shoe', 'shoes'], ['shoeR', 'shoe', 'shoe', 'shoes'],
  ];
  /* opcionais: [chave, geometria, material, cor, articulação] */
  const OPT = {
    hair: { short: 'hair_short', long: 'hair_long', bun: 'hair_bun', curly: 'hair_curly', pony: 'hair_pony', short_h: 'hair_short_h', long_h: 'hair_long_h', pony_h: 'hair_pony_h' },
    hat: { cap: 'hat_cap', fedora: 'hat_fedora', beanie: 'hat_beanie', top: 'hat_top', straw: 'hat_straw', hard: 'hat_hard', beret: 'hat_beret', chef: 'hat_chef', guard: 'hat_guard' },
    face: { mustache: 'mustache', beard: 'beard' },
    glasses: { sun: 'glasses' },
    over: { tie: 'tie', lapel: 'lapel', vest: 'vest', stripes: 'stripes', apron: 'apron', backpack: 'backpack', collar: 'collar', uniform: 'uniform' },
    band: { red: 'armband' },
    prop: { phone: 'p_phone', cup: 'p_cup', ice: 'p_ice', radio: 'p_radio', case: 'p_case', light: 'p_light', balloon: 'p_balloon', guitar: 'p_guitar', bino: 'p_bino', broom: 'p_broom' },
    gun: { rifle: 'p_rifle' },
    skirt: { a: 'skirt' },
  };

  /* ── materiais ── */
  function mats(env) {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMap: env || null, envMapIntensity: .55 }, o));
    return {
      cloth: std({ roughness: .84 }), skin: std({ roughness: .5 }), hair: std({ roughness: .55 }), dark: std({ roughness: .4 }), eye: std({ roughness: .12 }),
      shoe: std({ roughness: .4, metalness: .1 }), prop: std({ roughness: .45, metalness: .15 }), gloss: std({ roughness: .3, metalness: .2 }), gun: std({ roughness: .5, metalness: .35 }),
    };
  }

  /* ── IK de dois ossos (braço) no referencial da coluna ── */
  const UA = .29, FA = .26 + .05;
  let _ik = null;
  function ik2(sx, sy, sz, tx, ty, tz, px, py, pz, out) {
    if (!_ik) _ik = { t: new THREE.Vector3(), h: new THREE.Vector3(), e: new THREE.Vector3(), p: new THREE.Vector3(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), n: new THREE.Vector3(), c: new THREE.Vector3() };
    const K = _ik, t = K.t.set(tx - sx, ty - sy, tz - sz), d = clamp(t.length(), .08, UA + FA - .004);
    const cosI = clamp((UA * UA + FA * FA - d * d) / (2 * UA * FA), -1, 1), eb = Math.PI - Math.acos(cosI);
    K.h.set(0, -UA - FA * Math.cos(eb), FA * Math.sin(eb)).normalize(); t.normalize();
    K.q1.setFromUnitVectors(K.h, t);
    const e = K.e.set(0, -UA, 0).applyQuaternion(K.q1), p = K.p.set(px, py, pz);
    e.addScaledVector(t, -e.dot(t)); p.addScaledVector(t, -p.dot(t));
    if (e.lengthSq() > 1e-8 && p.lengthSq() > 1e-8) { const a = Math.atan2(K.c.crossVectors(e, p).dot(t), e.dot(p)); K.q2.setFromAxisAngle(t, a); out.q.multiplyQuaternions(K.q2, K.q1); } else out.q.copy(K.q1);
    out.eb = eb; return out;
  }
  /* poses da espingarda no referencial da coluna: centro, cano (+z), topo (+y) */
  const GUN = {
    held: { c: [.04, .22, .22], d: [-.52, .76, .2], up: [.15, 0, -1] },
    back: { c: [.0, .27, -.165], d: [.5, .84, 0], up: [0, .1, -1] },
  };
  const GRIP = [0, -.08, -.14], FORE = [0, -.04, .17];

  /* ── multidão: as InstancedMesh e os lugares de cada pessoa ── */
  function Crowd(scene, cap, env) {
    const G = geos(), MT = mats(env), meshes = {};
    const mk = (key, geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); scene.add(m); meshes[key] = m; return m; };
    PARTS.forEach(([k, g, mt]) => mk(k, G[g], MT[mt], cap));
    Object.entries(OPT).forEach(([grp, v]) => Object.entries(v).forEach(([name, g]) => mk(grp + ':' + name, G[g], grp === 'prop' ? MT.prop : grp === 'gun' ? MT.gun : grp === 'hair' || grp === 'face' ? MT.hair : grp === 'glasses' ? MT.gloss : MT.cloth, grp === 'band' ? cap * 2 : cap)));
    const dartM = mk('dart', G.dart, MT.prop, cap * 3);
    /* sombra de contacto debaixo de cada pessoa (à noite e com o céu nublado o sol quase não faz sombra e a gente parecia a flutuar) */
    const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.55, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    const blobG = new THREE.PlaneGeometry(1, 1); blobG.rotateX(-Math.PI / 2);
    const blobM = new THREE.InstancedMesh(blobG, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }), cap);
    blobM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); blobM.frustumCulled = false; blobM.renderOrder = 1; blobM.count = 0; scene.add(blobM); meshes.blob = blobM;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const people = [];
    const col = new THREE.Color();
    /* cada pessoa recebe o seu índice em cada malha que usa */
    function add(P) {
      P.slots = {}; P.ix = people.length; people.push(P);
      PARTS.forEach(([k]) => { const m = meshes[k]; P.slots[k] = m.count++; });
      P.slots.blob = meshes.blob.count++;
      Object.keys(OPT).forEach(grp => { let v = P.look[grp]; if (grp === 'hair' && P.look.hat && meshes['hair:' + v + '_h']) v += '_h'; if (v && meshes[grp + ':' + v]) { const m = meshes[grp + ':' + v]; P.slots[grp] = [m, m.count++]; if (grp === 'band') P.slots.band2 = [m, m.count++]; } });
      paint(P);
      return P;
    }
    function paint(P) {
      const L = P.look;
      const cs = { pants: L.pants, belt: L.belt || '#2a2420', shirt: L.shirt, skin: L.skin, eyeW: '#f4f1ea', eyeC: L.eyeC || '#4a3220', hair: L.hairC, lip: '#8a3a3a',
        sleeveC: L.shirt, farmC: L.long ? L.shirt : L.skin, handC: L.gloves || L.skin, shinC: L.shorts ? L.skin : L.pants, shoes: L.shoes || '#2b2622' };
      PARTS.forEach(([k, , , ck]) => { col.set(cs[ck] || '#ffffff'); meshes[k].setColorAt(P.slots[k], col); });
      Object.keys(OPT).forEach(grp => { const s = P.slots[grp]; if (!s) return; const c = grp === 'gun' ? '#ffffff' : grp === 'band' ? (L.bandC || '#d8302a') : L[grp + 'C'] || (grp === 'hair' || grp === 'face' ? L.hairC : grp === 'glasses' ? '#15171c' : grp === 'skirt' ? L.pants : '#ffffff'); col.set(c); s[0].setColorAt(s[1], col); if (grp === 'band') s[0].setColorAt(P.slots.band2[1], col); });
      Object.values(meshes).forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    }

    /* ── cinemática direta ── */
    const J = {}; ['root', 'hip', 'spine', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'anL', 'anR', 'tmp', 'leaf', 'gun'].forEach(k => { J[k] = new THREE.Matrix4(); });
    const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
    const _gm = new THREE.Matrix4(), _gx = new THREE.Vector3(), _gy = new THREE.Vector3(), _gz = new THREE.Vector3(), _gp = new THREE.Vector3(), _ikL = { q: new THREE.Quaternion(), eb: 0 }, _ikR = { q: new THREE.Quaternion(), eb: 0 };
    function loc(out, par, x, y, z, rx, ry, rz, order) { _e.set(rx || 0, ry || 0, rz || 0, order || 'ZYX'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); return out.multiplyMatrices(par, _m); }
    function leafS(par, sx, sy, sz) { _m.makeScale(sx, sy, sz); return J.leaf.multiplyMatrices(par, _m); }
    function put(P, k, m) { meshes[k].setMatrixAt(P.slots[k], m); }
    function putOpt(P, grp, m) { const s = P.slots[grp]; if (s) s[0].setMatrixAt(s[1], m); }
    /* matriz da espingarda (referencial da coluna) a partir de centro, direção do cano e "topo" */
    function gunLocal(c, d, up) {
      _gz.set(d[0], d[1], d[2]).normalize(); _gy.set(up[0], up[1], up[2]); _gx.crossVectors(_gy, _gz).normalize(); _gy.crossVectors(_gz, _gx);
      _gm.makeBasis(_gx, _gy, _gz).setPosition(c[0], c[1], c[2]); return _gm;
    }
    const _a = new THREE.Vector3(), _b = new THREE.Vector3();

    /* pose → matrizes de todas as peças; guarda as articulações (caixas de colisão) */
    function pose(P, Q) {
      const s = P.s || 1, L = P.look, bd = L.build || 1, fem = L.fem ? 1 : 0;
      _e.set(0, P.yaw, 0); _q.setFromEuler(_e); _p.set(P.x, P.y + (Q.lift || 0) * s, P.z); _s.set(s, s, s); J.root.compose(_p, _q, _s);
      /* deitar: roda à volta dos pés (cai para o lado ou de costas) */
      if (Q.rollZ || Q.rollX) loc(J.root, J.root, 0, 0, 0, Q.rollX || 0, 0, Q.rollZ || 0, 'XYZ');
      const hipY = .93 - (Q.drop || 0) + (Q.bob || 0);
      loc(J.hip, J.root, Q.sway || 0, hipY, Q.hipZ || 0, Q.lean || 0, Q.twist || 0, Q.side || 0, 'YXZ');
      /* corpo feminino: ancas um pouco mais largas, ombros e cintura mais estreitos */
      put(P, 'pelvis', leafS(J.hip, bd * (1 + fem * .07), 1, bd));
      put(P, 'belt', leafS(J.hip, bd * (1 + fem * .04), 1, bd));
      if (P.slots.skirt) { const fa = ((Q.lHip || 0) + (Q.rHip || 0)) / 2, sp = Math.abs((Q.lHip || 0) - (Q.rHip || 0)); _m.compose(_p.set(0, 0, 0), _q.setFromEuler(_e.set(-clamp(fa, -.4, 1.6) * .62, 0, 0)), _s.set(bd * (1 + fem * .05), 1 - Math.min(.25, Math.max(0, fa) * .12), bd * (1 + sp * .45 + Math.max(0, fa) * .25))); J.tmp.multiplyMatrices(J.hip, _m); putOpt(P, 'skirt', J.tmp); }
      loc(J.spine, J.hip, 0, .06, 0, Q.spine || 0, Q.spineY || 0, Q.spineZ || 0, 'YXZ');
      const bw = bd * (1 + (Q.breath || 0) * .03) * (1 - fem * .07), bdp = bd * (L.belly || 1) * (1 + (Q.breath || 0) * .05) * (1 - fem * .04);
      put(P, 'torso', leafS(J.spine, bw, 1, bdp));
      putOpt(P, 'over', J.leaf);
      loc(J.neck, J.spine, 0, .49, .005, Q.neckP || 0, 0, 0);
      put(P, 'neck', J.neck);
      loc(J.head, J.neck, 0, .08, 0, Q.headP || 0, Q.headY || 0, Q.headR || 0, 'YXZ');
      put(P, 'head', J.head); putOpt(P, 'hair', J.head); putOpt(P, 'face', J.head); putOpt(P, 'glasses', J.head);
      if (!P.hatOff) putOpt(P, 'hat', J.head); else { const s2 = P.slots.hat; if (s2) s2[0].setMatrixAt(s2[1], zero); }
      /* olhos abertos; a pálpebra desce por cima (antes o olho achatava e parecia uma risca) */
      const eo = clamp(Q.eyes == null ? 1 : Q.eyes, 0, 1.2), lk = clamp(1 - eo, 0, 1);
      put(P, 'eyes', J.head); put(P, 'pupils', J.head);
      if (lk < .02) put(P, 'lids', zero); else { _m.compose(_p.set(0, .118 + .0172 * (1 - lk), 0), _q.identity(), _s.set(1, lk + .02, 1)); J.tmp.multiplyMatrices(J.head, _m); put(P, 'lids', J.tmp); }
      put(P, 'brows', J.head);
      const yo = Q.yawn || 0; _m.compose(_p.set(0, -.058 * yo * 3.5, 0), _q.identity(), _s.set(1 + yo * .2, 1 + yo * 3.5, 1)); J.tmp.multiplyMatrices(J.head, _m); put(P, 'mouth', J.tmp);
      /* espingarda: ao peito, às costas ou a apontar → as mãos vão ao punho e ao guarda-mão */
      let ikR = Q.ikR, ikL = Q.ikL;
      if (P.slots.gun) {
        const gm = Q.gun || 'back';
        let Mg;
        if (gm === 'aim') { const p = Q.aimP || 0, d = [-.08, Math.sin(p), Math.cos(p)]; Mg = gunLocal([.13 + d[0] * .46, .45 + d[1] * .46, .05 + d[2] * .46], d, [0, 1, 0]); }
        else { const g = GUN[gm] || GUN.back; Mg = gunLocal(g.c, g.d, g.up); }
        J.gun.multiplyMatrices(J.spine, Mg); putOpt(P, 'gun', J.gun);
        if (gm !== 'back') { _a.set(GRIP[0], GRIP[1], GRIP[2]).applyMatrix4(Mg); _b.set(FORE[0], FORE[1], FORE[2]).applyMatrix4(Mg); ikR = [_a.x, _a.y, _a.z]; ikL = [_b.x, _b.y, _b.z]; }
      }
      /* braços: flexão (x) e abdução (z); cotovelo dobra para a frente — ou IK para um alvo */
      const arm = (side, sh, el, ha, kU, kF, kH, f, ab, tw, eb, wr, tgt, pole, IK) => {
        const sx = side * .185 * bd * (1 - fem * .08);
        if (tgt) { ik2(sx, .44, 0, tgt[0], tgt[1], tgt[2], pole[0], pole[1], pole[2], IK); _p.set(sx, .44, 0); _s.set(1, 1, 1); _m.compose(_p, IK.q, _s); J[sh].multiplyMatrices(J.spine, _m); eb = IK.eb; }
        else loc(J[sh], J.spine, sx, .44, 0, -f, tw * side, side * ab, 'ZYX');
        put(P, kU, J[sh]);
        loc(J[el], J[sh], 0, -.29, 0, -eb, 0, 0);
        put(P, kF, J[el]);
        loc(J[ha], J[el], 0, -.26, 0, wr || 0, 0, 0);
        put(P, kH, J[ha]);
      };
      arm(-1, 'shL', 'elL', 'haL', 'uarmL', 'farmL', 'handL', Q.lSh || 0, (Q.lAb || 0) + .06, Q.lTw || 0, Q.lEl || 0, Q.lWr, ikL, [-.5, -.5, -.15], _ikL);
      arm(1, 'shR', 'elR', 'haR', 'uarmR', 'farmR', 'handR', Q.rSh || 0, (Q.rAb || 0) + .06, Q.rTw || 0, Q.rEl || 0, Q.rWr, ikR, [.5, -.6, -.2], _ikR);
      if (P.slots.band) { loc(J.tmp, J.shL, 0, 0, 0); putOpt(P, 'band', J.tmp); const s3 = P.slots.band2; loc(J.leaf, J.shR, 0, 0, 0); s3[0].setMatrixAt(s3[1], J.leaf); }
      if (L.prop === 'balloon') { _p.setFromMatrixPosition(J.haR); _e.set(Math.sin(P.t * 1.3 + P.seed) * .12, 0, Math.sin(P.t * .9 + P.seed) * .15); _q.setFromEuler(_e); _s.set(s, s, s); J.tmp.compose(_p, _q, _s); putOpt(P, 'prop', J.tmp); }
      else putOpt(P, 'prop', J.haR);
      /* pernas: anca (x), abdução (z), joelho dobra para trás, pé compensa */
      const leg = (side, hp, kn, an, kT, kS, kF, f, ab, kb, fa) => {
        loc(J[hp], J.hip, side * (.092 + fem * .008), -.03, 0, -f, 0, side * ab, 'ZYX');
        put(P, kT, J[hp]);
        loc(J[kn], J[hp], 0, -.43, 0, kb, 0, 0);
        put(P, kS, J[kn]);
        loc(J[an], J[kn], 0, -.42, 0, fa, 0, 0);
        put(P, kF, J[an]);
      };
      leg(-1, 'hpL', 'knL', 'anL', 'thighL', 'shinL', 'shoeL', Q.lHip || 0, Q.lHab || 0, Q.lKn || 0, Q.lFt != null ? Q.lFt : (Q.lKn || 0) - (Q.lHip || 0));
      leg(1, 'hpR', 'knR', 'anR', 'thighR', 'shinR', 'shoeR', Q.rHip || 0, Q.rHab || 0, Q.rKn || 0, Q.rFt != null ? Q.rFt : (Q.rKn || 0) - (Q.rHip || 0));
      /* articulações no mundo (colisão do dardo) */
      const W = P.j || (P.j = {});
      const wp = (k, m, ox, oy, oz) => { const v = W[k] || (W[k] = new THREE.Vector3()); v.set(ox || 0, oy || 0, oz || 0).applyMatrix4(m); return v; };
      wp('head', J.head, 0, .1, .01); wp('hat', J.head, 0, .2, 0); wp('neck', J.neck); wp('hip', J.hip); wp('chest', J.spine, 0, .3, 0);
      wp('shL', J.shL); wp('shR', J.shR); wp('elL', J.elL); wp('elR', J.elR); wp('haL', J.haL, 0, -.05, 0); wp('haR', J.haR, 0, -.05, 0);
      wp('knL', J.knL); wp('knR', J.knR); wp('anL', J.anL); wp('anR', J.anR); wp('hpL', J.hpL); wp('hpR', J.hpR);
      /* sombra de contacto: por baixo da anca, mais comprida se estiver deitado; quem vai sentado num veículo não tem */
      if (Q.noBlob) meshes.blob.setMatrixAt(P.slots.blob, zero);
      else { const hx = W.hip.x, hz = W.hip.z, lying = (Q.rollZ || Q.rollX) ? 1 : 0, sz = (.62 + lying * .5) * s, a = P.yaw + (Q.rollZ ? Math.PI / 2 : 0); _q.setFromEuler(_e.set(0, a, 0)); _m.compose(_p.set(hx, P.y + .04, hz), _q, _s.set(sz * (lying ? .75 : 1), 1, sz * (lying ? 2 : 1))); meshes.blob.setMatrixAt(P.slots.blob, _m); }
      /* dardos espetados acompanham a peça onde acertaram */
      if (P.darts) P.darts.forEach(d => { const base = J[d.j] || J.spine; _m.compose(_p.set(d.lx, d.ly, d.lz), _q.setFromEuler(_e.set(d.rx, d.ry, d.rz)), _s.set(1, 1, 1)); J.tmp.multiplyMatrices(base, _m); dartM.setMatrixAt(d.slot, J.tmp); });
    }
    function hide(P) {
      PARTS.forEach(([k]) => meshes[k].setMatrixAt(P.slots[k], zero));
      meshes.blob.setMatrixAt(P.slots.blob, zero);
      Object.keys(OPT).forEach(g => putOpt(P, g, zero));
      if (P.slots.band2) P.slots.band2[0].setMatrixAt(P.slots.band2[1], zero);
      if (P.darts) P.darts.forEach(d => dartM.setMatrixAt(d.slot, zero));
    }
    /* espetar um dardo: guarda a posição relativa à articulação mais próxima */
    const _inv = new THREE.Matrix4(), _v = new THREE.Vector3();
    function stick(P, joint, wx, wy, wz, dx, dy, dz) {
      P.darts = P.darts || [];
      if (dartM.count >= cap * 3) return;
      const jm = J[joint] || J.spine;
      pose(P, P.q || {});   /* matrizes atuais desta pessoa */
      _inv.copy(jm).invert();
      _v.set(wx, wy, wz).applyMatrix4(_inv);
      /* orientação: o dardo aponta para trás da direção de voo (penas para fora) */
      const dir = new THREE.Vector3(-dx, -dy, -dz).normalize().transformDirection(_inv);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), e = new THREE.Euler().setFromQuaternion(q);
      P.darts.push({ j: joint, lx: _v.x, ly: _v.y, lz: _v.z, rx: e.x, ry: e.y, rz: e.z, slot: dartM.count++ });
    }
    function flush() { Object.values(meshes).forEach(m => { m.instanceMatrix.needsUpdate = true; }); }
    return { add, pose, hide, flush, stick, people, meshes, paint, joints: J };
  }

  /* ════════════════════════════════════════════════════════════════
     animações → pose (Q). t = tempo da pessoa; P.anim guarda fases
  ════════════════════════════════════════════════════════════════ */
  const ampOf = v => { const run = clamp((v - 2.2) / 2, 0, 1); return [run, lerp(.42, .72, run) * clamp(v / 1.3, .35, 1.1)]; };
  /* metros por ciclo de passada (dois passos): o pé de apoio fica parado no chão */
  function stride(v) { const [run, a] = ampOf(v); return 4 * .88 * Math.sin(a) * (1 + run * .3); }
  function walk(Q, ph, v) {
    const [run, a] = ampOf(v), s = Math.sin(ph), c = Math.cos(ph);
    Q.lHip = s * a; Q.rHip = -s * a;
    Q.lKn = .1 + Math.pow(Math.max(0, c), 1.3) * lerp(.85, 1.6, run) * clamp(v / 1.3, .4, 1.1);
    Q.rKn = .1 + Math.pow(Math.max(0, -c), 1.3) * lerp(.85, 1.6, run) * clamp(v / 1.3, .4, 1.1);
    Q.lFt = Q.lKn - Q.lHip * 1.05 - .05; Q.rFt = Q.rKn - Q.rHip * 1.05 - .05;
    Q.lSh = -s * lerp(.38, .85, run) * clamp(v / 1.3, .3, 1); Q.rSh = s * lerp(.38, .85, run) * clamp(v / 1.3, .3, 1);
    Q.lEl = lerp(.2, 1.45, run) + Math.max(0, -s) * .25; Q.rEl = lerp(.2, 1.45, run) + Math.max(0, s) * .25;
    Q.bob = Math.abs(c) * lerp(.025, .06, run) - lerp(.01, .05, run);
    Q.twist = s * lerp(.07, .12, run); Q.spineY = -s * .08;
    Q.lean = lerp(.04, .2, run); Q.side = c * .02;
    Q.headP = -Q.lean * .6;
  }
  function idle(Q, t, seed, P) {
    const b = Math.sin(t * 1.4 + seed) * .5 + .5;
    Q.breath = b; Q.bob = -.005 + b * .004;
    const w = Math.sin(t * .23 + seed * 3);           /* troca o peso de perna */
    Q.side = w * .025; Q.sway = w * .02; Q.lHab = .05 + Math.max(0, w) * .04; Q.rHab = .05 + Math.max(0, -w) * .04;
    Q.lKn = Math.max(0, -w) * .14; Q.rKn = Math.max(0, w) * .14; Q.lHip = Q.lKn * .4; Q.rHip = Q.rKn * .4;
    Q.lSh = .04; Q.rSh = .04; Q.lEl = .18; Q.rEl = .18; Q.lAb = .04; Q.rAb = .04;
    Q.headY = Math.sin(t * .31 + seed * 5) * .35 + Math.sin(t * .07 + seed) * .2; Q.headP = Math.sin(t * .19 + seed * 2) * .08;
  }
  /* atividades em pé (sobrepõem-se ao idle) */
  const ACT = {
    talk(Q, t, s) { Q.rSh = .35 + Math.sin(t * 2.3 + s) * .25; Q.rEl = 1 + Math.sin(t * 3.1 + s) * .35; Q.rTw = -.3; Q.lSh = .15 + Math.max(0, Math.sin(t * 1.7 + s * 2)) * .4; Q.lEl = .7; Q.headR = Math.sin(t * 1.3 + s) * .06; Q.headP = Math.sin(t * 2.7 + s) * .05; Q.yawn = .05 + Math.abs(Math.sin(t * 8.3 + s)) * .14 * (Math.sin(t * .9 + s) > -.3 ? 1 : 0); },
    listen(Q, t, s) { Q.lSh = .1; Q.lEl = .25; Q.headP = .05 + Math.max(0, Math.sin(t * .9 + s)) * .12 * Math.max(0, Math.sin(t * 6)); },
    phone(Q, t, s) { Q.rSh = .35; Q.rAb = .55; Q.rEl = 2.35; Q.rTw = -.5; Q.headR = .12; Q.lSh = .1 + Math.max(0, Math.sin(t * 1.5 + s)) * .3; Q.lEl = .9; Q.headY *= .3; Q.yawn = Math.sin(t * .7 + s) > 0 ? .04 + Math.abs(Math.sin(t * 9 + s)) * .12 : 0; },
    cup(Q, t, s) { const sip = Math.max(0, Math.sin(t * .5 + s)) > .93 ? 1 : 0, k = Q._cup = lerp(Q._cup || 0, sip, .1); Q.rSh = .55 + k * .5; Q.rEl = 1.5 + k * .6; Q.rTw = -.2; Q.headP = -k * .25; },
    ice(Q, t, s) { const lick = Math.max(0, Math.sin(t * .8 + s)); Q.rSh = .6 + lick * .25; Q.rEl = 1.6 + lick * .4; Q.rTw = -.25; Q.headP = -lick * .1; },
    arms(Q) { Q.lSh = .55; Q.rSh = .55; Q.lEl = 2; Q.rEl = 2; Q.lAb = -.25; Q.rAb = -.25; Q.lTw = .4; Q.rTw = .4; },
    hips(Q) { Q.lAb = .5; Q.rAb = .5; Q.lEl = 1.7; Q.rEl = 1.7; Q.lSh = -.2; Q.rSh = -.2; Q.lTw = -.7; Q.rTw = -.7; },
    back(Q) { Q.lSh = -.3; Q.rSh = -.3; Q.lEl = .9; Q.rEl = .9; Q.lAb = .1; Q.rAb = .1; Q.lTw = .6; Q.rTw = .6; },
    bino(Q, t, s) { Q.lSh = 1.15; Q.rSh = 1.15; Q.lAb = -.3; Q.rAb = -.3; Q.lEl = 2.05; Q.rEl = 2.05; Q.lTw = .3; Q.rTw = .3; Q.headY = Math.sin(t * .25 + s) * .5; Q.spineY = Q.headY * .5; Q.headP = -.05; },
    radio(Q, t, s) { Q.lSh = .4; Q.lAb = .6; Q.lEl = 2.4; Q.lTw = .5; Q.headR = -.12; Q.rSh = .3 + Math.sin(t * 2 + s) * .1; Q.rEl = .9; },
    clap(Q, t, s) { const c = Math.abs(Math.sin(t * 5.5 + s)); Q.lSh = .7; Q.rSh = .7; Q.lEl = 1.25; Q.rEl = 1.25; Q.lAb = -.35 + c * .3; Q.rAb = -.35 + c * .3; Q.lTw = .5; Q.rTw = .5; Q.headP = -.08; Q.bob += Math.abs(Math.sin(t * 2.75 + s)) * .015; },
    cheer(Q, t, s) { const c = Math.sin(t * 4 + s); Q.lSh = 2.6 + c * .25; Q.rSh = 2.6 - c * .25; Q.lAb = .25; Q.rAb = .25; Q.lEl = .3; Q.rEl = .3; Q.headP = -.2; Q.bob += Math.abs(c) * .03; Q.yawn = .3; },
    dance(Q, t, s) {
      const b = t * 4.2 + s, k = Math.sin(b), k2 = Math.sin(b * .5);
      Q.bob = -.03 + Math.abs(k) * .06; Q.lKn = .2 + Math.max(0, k) * .35; Q.rKn = .2 + Math.max(0, -k) * .35; Q.lHip = Q.lKn * .45; Q.rHip = Q.rKn * .45;
      Q.side = k2 * .08; Q.sway = k2 * .05; Q.twist = k2 * .2;
      Q.lSh = 1.3 + Math.sin(b + 1) * 1; Q.rSh = 1.3 + Math.sin(b + 2.5) * 1; Q.lAb = .4 + k2 * .2; Q.rAb = .4 - k2 * .2; Q.lEl = .6 + Math.max(0, k) * .8; Q.rEl = .6 + Math.max(0, -k) * .8;
      Q.headR = k2 * .15; Q.headP = -.1 + Math.abs(k) * .1; Q.headY = Math.sin(b * .25) * .3;
    },
    wave(Q, t, s) { Q.rSh = 2.5; Q.rAb = .3 + Math.sin(t * 7 + s) * .25; Q.rEl = .5; Q.headP = -.1; },
    guitar(Q, t, s) { Q.lSh = .55; Q.lAb = .15; Q.lEl = 1.1; Q.lTw = .9; Q.rSh = .4; Q.rEl = 1.5 + Math.sin(t * 11 + s) * .18; Q.rTw = .5; Q.headP = .15 + Math.abs(Math.sin(t * 2.6 + s)) * .1; Q.bob += Math.abs(Math.sin(t * 2.6 + s)) * .012; Q.lKn = Math.max(0, Math.sin(t * 2.6 + s)) * .2; },
    drum(Q, t, s) { const a = Math.sin(t * 9 + s), b = Math.sin(t * 9 + s + 2); Q.lSh = .65 + a * .35; Q.rSh = .65 + b * .35; Q.lEl = 1.2 - a * .3; Q.rEl = 1.2 - b * .3; Q.lTw = .3; Q.rTw = .3; Q.headP = .1 + Math.abs(a) * .1; },
    sing(Q, t, s) { Q.rSh = 1.2; Q.rEl = 2; Q.rTw = -.2; Q.lSh = .5 + Math.max(0, Math.sin(t * 1.3 + s)) * 1.6; Q.lAb = .5; Q.lEl = .3; Q.headP = -.15; Q.yawn = .25 + Math.abs(Math.sin(t * 7 + s)) * .2; },
    sweep(Q, t, s) { const k = Math.sin(t * 2.4 + s); Q.rSh = .7 + k * .35; Q.rEl = .4; Q.rTw = -.6; Q.lSh = .9 + k * .3; Q.lEl = .6; Q.lTw = .4; Q.spine = .25; Q.twist = k * .25; Q.headP = .2; },
    point(Q, t, s) { Q.rSh = 1.45; Q.rAb = .1; Q.rEl = .05; Q.headP = -.05; Q.lSh = .1; Q.lEl = .4; },
    look(Q, t, s) { Q.headY = Math.sin(t * .6 + s) * .9; Q.spineY = Q.headY * .25; Q.lAb = .5; Q.rAb = .5; Q.lEl = 1.7; Q.rEl = 1.7; Q.lSh = -.2; Q.rSh = -.2; Q.lTw = -.7; Q.rTw = -.7; },
    vendor(Q, t, s) { const k = Math.max(0, Math.sin(t * .9 + s)); Q.rSh = .5 + k * .7; Q.rEl = .9 - k * .5; Q.lSh = .4; Q.lEl = 1.2; Q.spine = .1; Q.headY = Math.sin(t * .4 + s) * .4; },
    light(Q, t, s) { Q.rSh = 1.2 + Math.sin(t * .7 + s) * .15; Q.rEl = .3; Q.rTw = Math.sin(t * .5 + s) * .3; Q.headY = Math.sin(t * .5 + s) * .35; Q.spineY = Q.headY * .5; },
    case(Q) { Q.rSh = 0; Q.rEl = .05; Q.rAb = .12; },
    balloon(Q) { Q.rSh = .9; Q.rEl = .5; Q.rTw = -.2; },
    /* ao volante: as mãos no aro (IK) e a cabeça a olhar a estrada */
    drive(Q, t, s) { const st = Math.sin(t * .7 + s) * .03; Q.ikR = [.15, .34 + st, .37]; Q.ikL = [-.15, .34 - st, .37]; Q.headY = Math.sin(t * .4 + s) * .25; Q.headP = .05; Q.spine = -.1; },
    /* nadar de bruços (só o tronco fora de água) */
    swim(Q, t, s) { const k = t * 2.2 + s, a = Math.sin(k); Q.lSh = 1.5 + a * .25; Q.rSh = 1.5 + a * .25; Q.lAb = .3 + Math.max(0, a) * .9; Q.rAb = .3 + Math.max(0, a) * .9; Q.lEl = .4 + Math.max(0, -a) * 1.2; Q.rEl = .4 + Math.max(0, -a) * 1.2; Q.lTw = -.6; Q.rTw = -.6; Q.headP = -.25; Q.bob += Math.sin(k * 2) * .04; Q.spine = .2; },
    /* de joelhos a escavar (castelos de areia, bonecos de neve) */
    dig(Q, t, s) { const k = Math.sin(t * 3.1 + s); Q.rSh = .9 + k * .45; Q.rEl = .5 + Math.max(0, -k) * .7; Q.lSh = .7 - k * .3; Q.lEl = .8; Q.lTw = .3; Q.rTw = .3; Q.headP = .45; Q.spine = .35; },
    /* tiques de quem está parado (o jogo mistura-os por cima da pose, de vez em quando) */
    watch(Q, t, s) { Q.lSh = .95; Q.lAb = -.1; Q.lEl = 1.9; Q.lTw = .9; Q.headP = .35; Q.headY = .18; },
    scratch(Q, t, s) { Q.rSh = 2.5; Q.rAb = .35; Q.rEl = 2.2; Q.rTw = -.4; Q.headR = -.12; Q.headP = .1; Q.rWr = Math.sin(t * 14) * .3; },
    stretch(Q, t, s) { Q.lSh = 2.9; Q.rSh = 2.9; Q.lAb = .15; Q.rAb = .15; Q.lEl = .4; Q.rEl = .4; Q.headP = -.3; Q.spine = -.12; Q.yawn = .7; Q.eyes = .35; },
    shrug(Q, t, s) { Q.lSh = .25; Q.rSh = .25; Q.lAb = .35; Q.rAb = .35; Q.lEl = 1.4; Q.rEl = 1.4; Q.lTw = -.9; Q.rTw = -.9; Q.headR = .14; Q.neckP = -.05; },
    /* guarda de sentinela: espingarda ao peito a rodar a cabeça */
    guard(Q, t, s) { Q.headY = Math.sin(t * .45 + s) * .7; Q.spineY = Q.headY * .2; Q.gun = 'held'; },
  };
  /* sentado (banco, cadeira, esplanada) */
  function sit(Q, t, s, act) {
    Q.drop = .45; Q.lHip = 1.5; Q.rHip = 1.5; Q.lKn = 1.5; Q.rKn = 1.5; Q.lFt = 0; Q.rFt = 0; Q.lHab = .12; Q.rHab = .1; Q.hipZ = -.05;
    Q.spine = -.08; Q.lSh = .3; Q.rSh = .3; Q.lEl = .9; Q.rEl = .9; Q.lTw = .2; Q.rTw = .2;
    Q.breath = Math.sin(t * 1.3 + s) * .5 + .5; Q.headY = Math.sin(t * .2 + s) * .4;
    if (act && ACT[act] && act !== 'dance') { ACT[act](Q, t, s); Q.lHip = 1.5; Q.rHip = 1.5; Q.lKn = 1.5; Q.rKn = 1.5; Q.lFt = 0; Q.rFt = 0; }
  }
  /* deitado de costas (espreguiçadeira) */
  function recline(Q, t, s, k) {
    sit(Q, t, s); Q.rollX = -1.15 * (k == null ? 1 : k); Q.lift = .47; Q.lHip = .35; Q.rHip = .35; Q.lKn = .3; Q.rKn = .5; Q.lFt = .2; Q.rFt = .2;
    Q.lSh = 2.7; Q.rSh = 2.7; Q.lEl = 2.2; Q.rEl = 2.2; Q.lAb = .5; Q.rAb = .5; Q.headP = .5; Q.headY = Math.sin(t * .15 + s) * .25;
  }
  /* cair a dormir: k = 0..1 (atingido → bocejo → pernas cedem → no chão) */
  function sleepPose(Q, P, t) {
    const k = P.sleepT, side = P.fallSide || 1;
    if (k < .35) {                                     /* susto: mão ao sítio do dardo */
      const a = k / .35;
      Q.lean = -.08 * a; Q.headP = -.15 * a; Q.eyes = 1.2; Q.yawn = .3 * a;
      Q.lSh = .7 * a; Q.lEl = 1.9 * a; Q.lAb = -.2 * a; Q.rSh = .2; Q.rEl = .5;
      return;
    }
    if (k < 1.5) {                                     /* sonolento: bocejo grande, cambaleia */
      const a = (k - .35) / 1.15, w = Math.sin(k * 5.5);
      Q.yawn = Math.sin(clamp(a * 1.6, 0, 1) * Math.PI); Q.eyes = lerp(.9, .25, a) + Math.max(0, Math.sin(k * 9)) * .2;
      Q.lSh = lerp(.7, 2.8, Math.min(1, a * 2)) * (1 - Math.max(0, a - .6) * 2.2); Q.rSh = lerp(.2, 2.8, Math.min(1, a * 2)) * (1 - Math.max(0, a - .6) * 2.2);
      Q.lEl = .5; Q.rEl = .5; Q.lAb = .3; Q.rAb = .3;
      Q.headP = lerp(-.25, .45, a); Q.headR = w * .15 * a; Q.side = w * .07 * a; Q.sway = w * .05 * a;
      Q.lKn = a * .5; Q.rKn = a * .45; Q.lHip = a * .25; Q.rHip = a * .2; Q.drop = a * .12;
      return;
    }
    /* a cair e a dormir enroscado de lado */
    const f = ease(clamp((k - 1.5) / .55, 0, 1)), bounce = k > 2.05 && k < 2.35 ? Math.sin((k - 2.05) / .3 * Math.PI) * .04 : 0;
    Q.rollZ = side * f * Math.PI / 2 * .97; Q.lift = f * .17 + bounce;
    Q.eyes = .05; Q.yawn = 0;
    Q.lHip = lerp(.25, .95, f); Q.rHip = lerp(.2, .7, f); Q.lKn = lerp(.5, 1.5, f); Q.rKn = lerp(.45, 1.2, f); Q.drop = .12 * (1 - f);
    /* braço de baixo dobrado como almofada, o de cima solto à frente */
    const lo = side > 0 ? 'r' : 'l', hi = side > 0 ? 'l' : 'r';
    Q[lo + 'Sh'] = lerp(0, 2.4, f); Q[lo + 'El'] = lerp(.5, 2.1, f); Q[lo + 'Ab'] = .1; Q[lo + 'Tw'] = .5;
    Q[hi + 'Sh'] = lerp(0, .9, f); Q[hi + 'El'] = lerp(.5, 1.1, f); Q[hi + 'Ab'] = -.1 * f;
    Q.headR = side * f * .35; Q.headP = .2 * f; Q.spine = .2 * f;
    Q.breath = Math.sin(t * 1.1) * .5 + .5; Q.bob = 0; Q.yawn = f * (.06 + Q.breath * .12);
    /* de vez em quando mexe-se a dormir (encolhe a perna de cima) */
    const tw = Math.max(0, Math.sin(t * .23 + (P.seed || 0))) ; if (tw > .96) { const k = (tw - .96) / .04; Q[hi + 'Sh'] += k * .3; Q.lHip += k * .15; }
    if (P.sitting) { Q.drop = .45 * (1 - f); }
  }
  /* guarda a abanar um colega adormecido (agachado) */
  function shake(Q, t) {
    Q.drop = .42; Q.lHip = 1.6; Q.rHip = .6; Q.lKn = 2.3; Q.rKn = 1.9; Q.rFt = -.2; Q.lFt = .1; Q.lean = .5;
    const s = Math.sin(t * 13); Q.lSh = 1.25 + s * .15; Q.rSh = 1.25 - s * .15; Q.lEl = .5; Q.rEl = .5; Q.headP = .5;
  }
  function crouch(Q, t, s) {
    Q.drop = .38; Q.lHip = 1.4; Q.rHip = .4; Q.lKn = 2.2; Q.rKn = 1.7; Q.lFt = .1; Q.lean = .25; Q.lSh = .4; Q.rSh = .4; Q.lEl = .8; Q.rEl = .8;
    Q.headY = Math.sin(t * .8 + s) * .6;
  }

  return { Crowd, walk, stride, idle, ACT, sit, recline, sleepPose, shake, crouch, geos, OPT };
})();
