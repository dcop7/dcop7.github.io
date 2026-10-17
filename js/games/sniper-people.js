/* ══════════════════════════════════════════════════════════════════
   Operação Soneca — gente articulada (out/2026)
   Cada pessoa é um esqueleto simples (anca, coluna, cabeça, ombros,
   cotovelos, joelhos, tornozelos) com dezenas de peças; para caberem
   centenas no ecrã, cada TIPO de peça é UMA InstancedMesh (cor por
   instância) e as matrizes saem de cinemática direta a cada frame.
   Variantes (cabelos, chapéus, bigodes, óculos, coletes, gravatas,
   adereços) só ocupam "lugares" nas pessoas que as usam.
   Poses: andar, correr, conversar, telefone, café, dançar, sentar,
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
  function M(x, y, z, rx, ry, rz, sx, sy, sz) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); }
  /* junta geometrias com cor por vértice (branco = tingido pela cor da instância) */
  function merge(list) {
    let n = 0; const parts = list.map(([g, c, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m); n += q.attributes.position.count; return [q, new THREE.Color(c || '#ffffff')]; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    parts.forEach(([q, c]) => { const p = q.attributes.position, nn = q.attributes.normal; for (let i = 0; i < p.count; i++, o++) { pos[o * 3] = p.getX(i); pos[o * 3 + 1] = p.getY(i); pos[o * 3 + 2] = p.getZ(i); nor[o * 3] = nn.getX(i); nor[o * 3 + 1] = nn.getY(i); nor[o * 3 + 2] = nn.getZ(i); col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b; } q.dispose(); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); return g;
  }
  const S = (r, w, h, a, b, c, d) => new THREE.SphereGeometry(r, w || 12, h || 9, a, b, c, d);
  const C = (rt, rb, h, s, open) => new THREE.CylinderGeometry(rt, rb, h, s || 10, 1, !!open);
  const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  function geos() {
    if (GEO) return GEO;
    const G = {};
    /* tronco: elíptico, ombros arredondados, peito ligeiramente mais largo */
    G.torso = merge([[C(.165, .148, .5, 14), 0, M(0, .25, 0, 0, 0, 0, 1, 1, .62)], [S(.07), 0, M(.15, .45, 0, 0, 0, 0, 1, .8, 1)], [S(.07), 0, M(-.15, .45, 0, 0, 0, 0, 1, .8, 1)], [S(.155, 14, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .47, 0, 0, 0, 0, 1.05, .32, .62)], [C(.148, .155, .08, 14), 0, M(0, .02, 0, 0, 0, 0, 1, 1, .66)]]);
    G.pelvis = merge([[C(.155, .14, .17, 12), 0, M(0, .01, 0, 0, 0, 0, 1, 1, .7)], [S(.14, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), 0, M(0, -.07, 0, 0, 0, 0, 1.05, .45, .72)]]);
    G.belt = merge([[C(.158, .158, .035, 14, true), '#ffffff', M(0, .08, 0, 0, 0, 0, 1, 1, .7)], [B(.045, .03, .01), '#d6b45a', M(0, .08, .112)]]);
    G.neck = C(.046, .054, .1, 8).translate(0, .05, 0);
    /* cabeça: crânio, nariz, orelhas, queixo */
    G.head = merge([[S(.106, 16, 12), 0, M(0, .105, 0, 0, 0, 0, .94, 1.1, 1)], [S(.06, 10, 8), 0, M(0, .045, .045, 0, 0, 0, 1.1, .7, 1)], [S(.02, 8, 6), 0, M(0, .095, .1, -.3, 0, 0, 1, 1.25, 1.35)], [S(.024, 8, 6), 0, M(.1, .1, 0, 0, 0, 0, .45, 1, .8)], [S(.024, 8, 6), 0, M(-.1, .1, 0, 0, 0, 0, .45, 1, .8)]]);
    G.eyes = merge([[S(.0155, 8, 6), '#ffffff', M(.036, .118, .088, 0, 0, 0, 1, 1, .7)], [S(.0155, 8, 6), '#ffffff', M(-.036, .118, .088, 0, 0, 0, 1, 1, .7)]]);
    G.pupils = merge([[S(.009, 6, 5), 0, M(.036, .118, .099)], [S(.009, 6, 5), 0, M(-.036, .118, .099)]]);
    G.brows = merge([[B(.042, .009, .012), 0, M(.037, .146, .094, 0, 0, -.12)], [B(.042, .009, .012), 0, M(-.037, .146, .094, 0, 0, .12)]]);
    G.mouth = B(.042, .009, .01).translate(0, .058, .098);
    /* cabelos */
    G.hair_short = merge([[S(.113, 14, 9, 0, TAU, 0, Math.PI * .52), 0, M(0, .115, -.008, -.18, 0, 0, .98, 1.05, 1.06)], [S(.1, 10, 8, 0, TAU, Math.PI * .4, Math.PI * .35), 0, M(0, .1, -.03, 0, 0, 0, .96, 1, 1)]]);
    G.hair_long = merge([[S(.115, 14, 9, 0, TAU, 0, Math.PI * .55), 0, M(0, .113, -.006, -.15, 0, 0, .99, 1.06, 1.06)], [B(.2, .26, .07), 0, M(0, .0, -.07)], [S(.1, 10, 8), 0, M(0, -.12, -.075, 0, 0, 0, 1, .5, .4)]]);
    G.hair_bun = merge([[S(.113, 14, 9, 0, TAU, 0, Math.PI * .52), 0, M(0, .115, -.006, -.18, 0, 0, .98, 1.05, 1.06)], [S(.048, 10, 8), 0, M(0, .19, -.09)]]);
    G.hair_curly = merge([[new THREE.IcosahedronGeometry(.128, 1), 0, M(0, .13, -.015, 0, 0, 0, 1, .92, 1)]]);
    G.hair_pony = merge([[S(.113, 14, 9, 0, TAU, 0, Math.PI * .52), 0, M(0, .115, -.006, -.18, 0, 0, .98, 1.05, 1.06)], [C(.03, .012, .2, 6), 0, M(0, .06, -.13, .5)]]);
    /* chapéus */
    G.hat_cap = merge([[S(.118, 14, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .13, 0, 0, 0, 0, 1, .82, 1.04)], [C(.1, .1, .012, 12), 0, M(0, .135, .1, 0, 0, 0, .9, 1, .75)], [S(.012, 6, 5), 0, M(0, .228, 0)]]);
    G.hat_fedora = merge([[C(.085, .105, .11, 12), 0, M(0, .22, 0, 0, 0, 0, 1, 1, .92)], [C(.19, .19, .012, 16), 0, M(0, .165, 0, 0, 0, 0, 1, 1, .92)], [C(.107, .107, .025, 12), '#333333', M(0, .18, 0, 0, 0, 0, 1, 1, .93)]]);
    G.hat_beanie = merge([[S(.122, 14, 9, 0, TAU, 0, Math.PI / 2), 0, M(0, .12, -.005, -.1, 0, 0, 1, 1.18, 1.05)], [new THREE.TorusGeometry(.115, .018, 6, 16), 0, M(0, .13, -.005, Math.PI / 2 - .1, 0, 0, 1, 1.05, 1)], [S(.03, 8, 6), 0, M(0, .27, -.02)]]);
    G.hat_top = merge([[C(.098, .098, .22, 14), 0, M(0, .29, 0)], [C(.17, .17, .012, 16), 0, M(0, .18, 0)], [C(.1, .1, .035, 14), '#c03030', M(0, .205, 0)]]);
    G.hat_straw = merge([[C(.24, .25, .012, 18), 0, M(0, .165, 0)], [C(.09, .11, .09, 12), 0, M(0, .21, 0)], [C(.112, .112, .02, 12), '#b03a2a', M(0, .18, 0)]]);
    G.hat_hard = merge([[S(.125, 14, 8, 0, TAU, 0, Math.PI / 2), 0, M(0, .135, 0, 0, 0, 0, 1, .9, 1.06)], [C(.14, .14, .01, 14), 0, M(0, .14, .015, 0, 0, 0, 1, 1, 1.05)], [B(.02, .03, .2), 0, M(0, .245, 0)]]);
    G.hat_beret = merge([[S(.125, 14, 6, 0, TAU, 0, Math.PI / 2), 0, M(.015, .17, 0, 0, 0, -.25, 1.05, .45, 1.05)], [S(.012, 6, 5), 0, M(.04, .225, 0)]]);
    G.hat_chef = merge([[C(.11, .1, .1, 12), 0, M(0, .22, 0)], [S(.13, 12, 8), 0, M(0, .31, 0, 0, 0, 0, 1, .7, 1)]]);
    /* bigode à "Liga dos Bigodes" (pontas enroladas) e barba */
    G.mustache = merge([[S(.03, 8, 6), 0, M(.026, .068, .104, 0, 0, -.35, 1.5, .55, .6)], [S(.03, 8, 6), 0, M(-.026, .068, .104, 0, 0, .35, 1.5, .55, .6)], [new THREE.TorusGeometry(.012, .006, 5, 8), 0, M(.068, .08, .096, 0, .3, 0)], [new THREE.TorusGeometry(.012, .006, 5, 8), 0, M(-.068, .08, .096, 0, -.3, 0)]]);
    G.beard = merge([[S(.085, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), 0, M(0, .075, .03, .25, 0, 0, 1.1, 1.05, 1)]]);
    G.glasses = merge([[C(.026, .026, .008, 12), 0, M(.038, .12, .108, Math.PI / 2)], [C(.026, .026, .008, 12), 0, M(-.038, .12, .108, Math.PI / 2)], [B(.03, .006, .006), 0, M(0, .125, .108)], [B(.006, .006, .11), 0, M(.1, .122, .05)], [B(.006, .006, .11), 0, M(-.1, .122, .05)]]);
    /* sobreposições do tronco */
    G.tie = merge([[B(.035, .03, .02), 0, M(0, .44, .1)], [B(.045, .3, .012), 0, M(0, .27, .103, 0, 0, 0, 1, 1, 1)], [new THREE.ConeGeometry(.026, .05, 4), 0, M(0, .1, .103, Math.PI, Math.PI / 4)]]);
    G.lapel = merge([[B(.06, .26, .012), 0, M(.055, .34, .101, 0, 0, .3)], [B(.06, .26, .012), 0, M(-.055, .34, .101, 0, 0, -.3)], [B(.085, .14, .014), '#ffffff', M(0, .43, .098)]]);
    G.vest = merge([[C(.172, .156, .36, 14, true), 0, M(0, .25, 0, 0, 0, 0, 1, 1, .64)], [C(.174, .158, .035, 14, true), '#e8eef2', M(0, .22, 0, 0, 0, 0, 1, 1, .645)], [C(.174, .158, .035, 14, true), '#e8eef2', M(0, .33, 0, 0, 0, 0, 1, 1, .645)]]);
    G.stripes = merge([0, 1, 2, 3, 4, 5].map(i => [C(.168, .162, .03, 14, true), 0, M(0, .06 + i * .075, 0, 0, 0, 0, 1, 1, .632)]));
    G.apron = merge([[B(.26, .5, .015), 0, M(0, .12, .11)], [B(.3, .015, .2), 0, M(0, .35, .02)]]);
    G.backpack = merge([[B(.26, .32, .13), 0, M(0, .28, -.16)], [B(.2, .12, .05), 0, M(0, .2, -.235)]]);
    G.collar = merge([[new THREE.TorusGeometry(.065, .018, 6, 14), 0, M(0, .5, .005, Math.PI / 2, 0, 0, 1, .7, 1)]]);
    /* braços e pernas */
    G.uarm = merge([[S(.055, 10, 8), 0, M(0, -.005, 0)], [C(.05, .042, .29, 9), 0, M(0, -.145, 0)]]);
    G.farm = merge([[S(.043, 8, 6), 0, M(0, 0, 0)], [C(.042, .033, .26, 9), 0, M(0, -.13, 0)]]);
    G.hand = merge([[S(.04, 8, 6), 0, M(0, -.045, 0, 0, 0, 0, .78, 1.2, .55)], [S(.014, 6, 5), 0, M(.025, -.035, .018, 0, 0, 0, 1, 1.5, 1)]]);
    G.thigh = merge([[S(.075, 10, 8), 0, M(0, 0, 0)], [C(.075, .058, .43, 10), 0, M(0, -.215, 0)]]);
    G.shin = merge([[S(.058, 9, 7), 0, M(0, 0, 0)], [C(.058, .043, .42, 10), 0, M(0, -.21, 0)]]);
    G.shoe = merge([[B(.095, .075, .24), 0, M(0, -.035, .045)], [S(.05, 9, 7), 0, M(0, -.035, .14, 0, 0, 0, .95, .75, 1)], [B(.1, .02, .27), '#3a3a3a', M(0, -.07, .055)]]);
    G.sleeve = merge([[C(.06, .052, .17, 9), 0, M(0, -.075, 0)]]);
    /* adereços (na mão direita) */
    G.p_phone = merge([[B(.036, .072, .01), 0, M(0, -.08, .03)], [B(.03, .06, .002), '#2a6dd8', M(0, -.08, .036)]]);
    G.p_cup = merge([[C(.03, .024, .08, 10), 0, M(0, -.08, .04)], [C(.032, .032, .01, 10), '#5a3a24', M(0, -.042, .04)]]);
    G.p_ice = merge([[new THREE.ConeGeometry(.026, .09, 8), '#d9a35a', M(0, -.06, .045, Math.PI)], [S(.032, 8, 6), 0, M(0, -.005, .045)]]);
    G.p_radio = merge([[B(.045, .09, .03), 0, M(0, -.08, .03)], [C(.004, .004, .07, 4), 0, M(.012, -.005, .03)]]);
    G.p_case = merge([[B(.4, .28, .09), 0, M(0, -.22, 0)], [B(.12, .03, .02), '#222222', M(0, -.065, 0)], [B(.04, .03, .095), '#d8c070', M(.12, -.1, 0)], [B(.04, .03, .095), '#d8c070', M(-.12, -.1, 0)]]);
    G.p_light = merge([[C(.022, .018, .16, 8), 0, M(0, -.06, .06, Math.PI / 2)], [C(.03, .022, .03, 8), '#fff6c0', M(0, -.06, .15, Math.PI / 2)]]);
    G.p_balloon = merge([[C(.003, .003, 1.1, 3), '#dddddd', M(0, .5, 0)], [S(.16, 12, 10), 0, M(0, 1.15, 0, 0, 0, 0, 1, 1.15, 1)]]);
    G.p_guitar = merge([[S(.16, 12, 8), 0, M(0, -.05, .14, Math.PI / 2, 0, 0, 1, .4, 1)], [S(.12, 12, 8), 0, M(.13, -.05, .14, Math.PI / 2, 0, 0, 1, .4, 1)], [B(.5, .04, .02), '#3a2412', M(-.3, -.05, .15)]]);
    G.p_bino = merge([[C(.025, .028, .1, 8), 0, M(.035, -.03, .06, Math.PI / 2)], [C(.025, .028, .1, 8), 0, M(-.035, -.03, .06, Math.PI / 2)], [B(.05, .02, .03), 0, M(0, -.03, .06)]]);
    G.p_broom = merge([[C(.012, .012, 1.3, 6), '#a07848', M(0, -.25, .05)], [B(.25, .08, .05), '#c8a050', M(0, -.9, .05)]]);
    G.dart = merge([[C(.006, .006, .12, 6), '#c9d4dc', M(0, .06, 0)], [new THREE.ConeGeometry(.02, .05, 6), '#ff3d6e', M(0, .14, 0)], [C(.008, .008, .03, 6), '#ffd040', M(0, .03, 0)]]);
    GEO = G; return G;
  }

  /* ── catálogo de peças: geometria, material, articulação e de onde vem a cor ── */
  const PARTS = [
    ['pelvis', 'pelvis', 'cloth', 'pants'], ['belt', 'belt', 'cloth', 'belt', 1], ['torso', 'torso', 'cloth', 'shirt'], ['neck', 'neck', 'skin', 'skin'], ['head', 'head', 'skin', 'skin'],
    ['eyes', 'eyes', 'eye', 'eyeW'], ['pupils', 'pupils', 'dark', 'eyeC'], ['brows', 'brows', 'hair', 'hair'], ['mouth', 'mouth', 'dark', 'lip'],
    ['uarmL', 'uarm', 'cloth', 'sleeveC'], ['uarmR', 'uarm', 'cloth', 'sleeveC'], ['farmL', 'farm', 'skin', 'farmC'], ['farmR', 'farm', 'skin', 'farmC'], ['handL', 'hand', 'skin', 'handC'], ['handR', 'hand', 'skin', 'handC'],
    ['thighL', 'thigh', 'cloth', 'pants'], ['thighR', 'thigh', 'cloth', 'pants'], ['shinL', 'shin', 'cloth', 'shinC'], ['shinR', 'shin', 'cloth', 'shinC'], ['shoeL', 'shoe', 'shoe', 'shoes'], ['shoeR', 'shoe', 'shoe', 'shoes'],
  ];
  /* opcionais: [chave, geometria, material, cor, articulação] */
  const OPT = {
    hair: { short: 'hair_short', long: 'hair_long', bun: 'hair_bun', curly: 'hair_curly', pony: 'hair_pony' },
    hat: { cap: 'hat_cap', fedora: 'hat_fedora', beanie: 'hat_beanie', top: 'hat_top', straw: 'hat_straw', hard: 'hat_hard', beret: 'hat_beret', chef: 'hat_chef' },
    face: { mustache: 'mustache', beard: 'beard' },
    glasses: { sun: 'glasses' },
    over: { tie: 'tie', lapel: 'lapel', vest: 'vest', stripes: 'stripes', apron: 'apron', backpack: 'backpack', collar: 'collar' },
    prop: { phone: 'p_phone', cup: 'p_cup', ice: 'p_ice', radio: 'p_radio', case: 'p_case', light: 'p_light', balloon: 'p_balloon', guitar: 'p_guitar', bino: 'p_bino', broom: 'p_broom' },
  };
  const SLOT_OF = { hair: 'head', hat: 'head', face: 'head', glasses: 'head', over: 'torso', prop: 'handR' };

  /* ── materiais ── */
  function mats(env) {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMap: env || null, envMapIntensity: .5 }, o));
    return {
      cloth: std({ roughness: .86 }), skin: std({ roughness: .55 }), hair: std({ roughness: .62 }), dark: std({ roughness: .4 }), eye: std({ roughness: .2 }),
      shoe: std({ roughness: .42, metalness: .1 }), prop: std({ roughness: .45, metalness: .15 }), gloss: std({ roughness: .3, metalness: .2 }),
    };
  }

  /* ── multidão: as InstancedMesh e os lugares de cada pessoa ── */
  function Crowd(scene, cap, env) {
    const G = geos(), MT = mats(env), meshes = {}, groups = [];
    const mk = (key, geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); scene.add(m); meshes[key] = m; return m; };
    PARTS.forEach(([k, g, mt]) => mk(k, G[g], MT[mt], cap));
    Object.entries(OPT).forEach(([grp, v]) => Object.entries(v).forEach(([name, g]) => mk(grp + ':' + name, G[g], grp === 'prop' ? MT.prop : grp === 'hair' || grp === 'face' ? MT.hair : grp === 'glasses' ? MT.gloss : grp === 'hat' ? MT.cloth : MT.cloth, cap)));
    const dartM = mk('dart', G.dart, MT.prop, cap * 3);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const people = [];
    const col = new THREE.Color();
    /* cada pessoa recebe o seu índice em cada malha que usa */
    function add(P) {
      P.slots = {}; P.ix = people.length; people.push(P);
      PARTS.forEach(([k]) => { const m = meshes[k]; P.slots[k] = m.count++; });
      Object.keys(OPT).forEach(grp => { const v = P.look[grp]; if (v && meshes[grp + ':' + v]) { const m = meshes[grp + ':' + v]; P.slots[grp] = [m, m.count++]; } });
      paint(P);
      return P;
    }
    function paint(P) {
      const L = P.look;
      const cs = { pants: L.pants, belt: L.belt || '#2a2420', shirt: L.shirt, skin: L.skin, eyeW: '#f4f1ea', eyeC: L.eyeC || '#2a1c12', hair: L.hairC, lip: '#7a3a34',
        sleeveC: L.shirt, farmC: L.long ? L.shirt : L.skin, handC: L.gloves || L.skin, shinC: L.shorts ? L.skin : L.pants, shoes: L.shoes || '#2b2622' };
      PARTS.forEach(([k, , , ck]) => { col.set(cs[ck] || '#ffffff'); meshes[k].setColorAt(P.slots[k], col); });
      Object.keys(OPT).forEach(grp => { const s = P.slots[grp]; if (!s) return; const c = L[grp + 'C'] || (grp === 'hair' || grp === 'face' ? L.hairC : grp === 'glasses' ? '#15171c' : '#ffffff'); col.set(c); s[0].setColorAt(s[1], col); });
      Object.values(meshes).forEach(m => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    }

    /* ── cinemática direta ── */
    const J = {}; ['root', 'hip', 'spine', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'anL', 'anR', 'tmp', 'leaf'].forEach(k => { J[k] = new THREE.Matrix4(); });
    const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
    function loc(out, par, x, y, z, rx, ry, rz, order) { _e.set(rx || 0, ry || 0, rz || 0, order || 'ZYX'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); return out.multiplyMatrices(par, _m); }
    function leafS(par, sx, sy, sz) { _m.makeScale(sx, sy, sz); return J.leaf.multiplyMatrices(par, _m); }
    function put(P, k, m) { meshes[k].setMatrixAt(P.slots[k], m); }
    function putOpt(P, grp, m) { const s = P.slots[grp]; if (s) s[0].setMatrixAt(s[1], m); }

    /* pose → matrizes de todas as peças; guarda as articulações (caixas de colisão) */
    function pose(P, Q) {
      const s = P.s || 1, L = P.look;
      _e.set(0, P.yaw, 0); _q.setFromEuler(_e); _p.set(P.x, P.y + (Q.lift || 0) * s, P.z); _s.set(s, s, s); J.root.compose(_p, _q, _s);
      /* deitar: roda à volta dos pés (cai para o lado ou de costas) */
      if (Q.rollZ || Q.rollX) loc(J.root, J.root, 0, 0, 0, Q.rollX || 0, 0, Q.rollZ || 0, 'XYZ');
      const hipY = .93 - (Q.drop || 0) + (Q.bob || 0);
      loc(J.hip, J.root, Q.sway || 0, hipY, Q.hipZ || 0, Q.lean || 0, Q.twist || 0, Q.side || 0, 'YXZ');
      put(P, 'pelvis', leafS(J.hip, L.build || 1, 1, L.build || 1));
      put(P, 'belt', leafS(J.hip, L.build || 1, 1, L.build || 1));
      loc(J.spine, J.hip, 0, .06, 0, Q.spine || 0, Q.spineY || 0, Q.spineZ || 0, 'YXZ');
      const bw = (L.build || 1) * (1 + (Q.breath || 0) * .03), bd = (L.build || 1) * (L.belly || 1) * (1 + (Q.breath || 0) * .05);
      put(P, 'torso', leafS(J.spine, bw, 1, bd));
      putOpt(P, 'over', J.leaf);
      loc(J.neck, J.spine, 0, .49, .005, Q.neckP || 0, 0, 0);
      put(P, 'neck', J.neck);
      loc(J.head, J.neck, 0, .08, 0, Q.headP || 0, Q.headY || 0, Q.headR || 0, 'YXZ');
      put(P, 'head', J.head); putOpt(P, 'hair', J.head); putOpt(P, 'face', J.head); putOpt(P, 'glasses', J.head);
      if (!P.hatOff) putOpt(P, 'hat', J.head); else { const s2 = P.slots.hat; if (s2) s2[0].setMatrixAt(s2[1], zero); }
      const eo = clamp(Q.eyes == null ? 1 : Q.eyes, .08, 1);
      _m.compose(_p.set(0, .118 * (1 - eo), 0), _q.identity(), _s.set(1, eo, 1)); J.tmp.multiplyMatrices(J.head, _m); put(P, 'eyes', J.tmp); put(P, 'pupils', eo < .3 ? zero : J.tmp);
      put(P, 'brows', J.head);
      const yo = Q.yawn || 0; _m.compose(_p.set(0, -.058 * yo * 3.5, 0), _q.identity(), _s.set(1 + yo * .2, 1 + yo * 3.5, 1)); J.tmp.multiplyMatrices(J.head, _m); put(P, 'mouth', J.tmp);
      /* braços: flexão (x) e abdução (z); cotovelo dobra para a frente */
      const arm = (side, sh, el, ha, kU, kF, kH, f, ab, tw, eb, wr) => {
        loc(J[sh], J.spine, side * .185 * (L.build || 1), .44, 0, -f, tw * side, side * ab, 'ZYX');
        put(P, kU, J[sh]);
        loc(J[el], J[sh], 0, -.29, 0, -eb, 0, 0);
        put(P, kF, J[el]);
        loc(J[ha], J[el], 0, -.26, 0, wr || 0, 0, 0);
        put(P, kH, J[ha]);
      };
      arm(-1, 'shL', 'elL', 'haL', 'uarmL', 'farmL', 'handL', Q.lSh || 0, (Q.lAb || 0) + .06, Q.lTw || 0, Q.lEl || 0, Q.lWr);
      arm(1, 'shR', 'elR', 'haR', 'uarmR', 'farmR', 'handR', Q.rSh || 0, (Q.rAb || 0) + .06, Q.rTw || 0, Q.rEl || 0, Q.rWr);
      if (L.prop === 'balloon') { _p.setFromMatrixPosition(J.haR); _e.set(Math.sin(P.t * 1.3 + P.seed) * .12, 0, Math.sin(P.t * .9 + P.seed) * .15); _q.setFromEuler(_e); _s.set(s, s, s); J.tmp.compose(_p, _q, _s); putOpt(P, 'prop', J.tmp); }
      else putOpt(P, 'prop', J.haR);
      /* pernas: anca (x), abdução (z), joelho dobra para trás, pé compensa */
      const leg = (side, hp, kn, an, kT, kS, kF, f, ab, kb, fa) => {
        loc(J[hp], J.hip, side * .092, -.03, 0, -f, 0, side * ab, 'ZYX');
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
      /* dardos espetados acompanham a peça onde acertaram */
      if (P.darts) P.darts.forEach(d => { const base = J[d.j] || J.spine; _m.compose(_p.set(d.lx, d.ly, d.lz), _q.setFromEuler(_e.set(d.rx, d.ry, d.rz)), _s.set(1, 1, 1)); J.tmp.multiplyMatrices(base, _m); dartM.setMatrixAt(d.slot, J.tmp); });
    }
    function hide(P) {
      PARTS.forEach(([k]) => meshes[k].setMatrixAt(P.slots[k], zero));
      Object.keys(OPT).forEach(g => putOpt(P, g, zero));
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
  const Z = () => ({});
  function walk(Q, ph, v) {
    const run = clamp((v - 2.2) / 2, 0, 1), a = lerp(.42, .72, run) * clamp(v / 1.3, .35, 1.1), s = Math.sin(ph), c = Math.cos(ph);
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
    talk(Q, t, s) { Q.rSh = .35 + Math.sin(t * 2.3 + s) * .25; Q.rEl = 1 + Math.sin(t * 3.1 + s) * .35; Q.rTw = -.3; Q.lSh = .15 + Math.max(0, Math.sin(t * 1.7 + s * 2)) * .4; Q.lEl = .7; Q.headR = Math.sin(t * 1.3 + s) * .06; Q.headP = Math.sin(t * 2.7 + s) * .05; },
    listen(Q, t, s) { Q.lSh = .1; Q.lEl = .25; Q.headP = .05 + Math.max(0, Math.sin(t * .9 + s)) * .12 * Math.max(0, Math.sin(t * 6)); },
    phone(Q, t, s) { Q.rSh = .35; Q.rAb = .55; Q.rEl = 2.35; Q.rTw = -.5; Q.headR = .12; Q.lSh = .1 + Math.max(0, Math.sin(t * 1.5 + s)) * .3; Q.lEl = .9; Q.headY *= .3; },
    cup(Q, t, s) { const sip = Math.max(0, Math.sin(t * .5 + s)) > .93 ? 1 : 0, k = Q._cup = lerp(Q._cup || 0, sip, .1); Q.rSh = .55 + k * .5; Q.rEl = 1.5 + k * .6; Q.rTw = -.2; Q.headP = -k * .25; },
    ice(Q, t, s) { const lick = Math.max(0, Math.sin(t * .8 + s)); Q.rSh = .6 + lick * .25; Q.rEl = 1.6 + lick * .4; Q.rTw = -.25; Q.headP = -lick * .1; },
    arms(Q) { Q.lSh = .55; Q.rSh = .55; Q.lEl = 2; Q.rEl = 2; Q.lAb = -.25; Q.rAb = -.25; Q.lTw = .4; Q.rTw = .4; },
    hips(Q) { Q.lAb = .5; Q.rAb = .5; Q.lEl = 1.7; Q.rEl = 1.7; Q.lSh = -.2; Q.rSh = -.2; Q.lTw = -.7; Q.rTw = -.7; },
    back(Q) { Q.lSh = -.3; Q.rSh = -.3; Q.lEl = .9; Q.rEl = .9; Q.lAb = .1; Q.rAb = .1; Q.lTw = .6; Q.rTw = .6; },
    bino(Q, t, s) { Q.lSh = 1.15; Q.rSh = 1.15; Q.lAb = -.3; Q.rAb = -.3; Q.lEl = 2.05; Q.rEl = 2.05; Q.lTw = .3; Q.rTw = .3; Q.headY = Math.sin(t * .25 + s) * .5; Q.spineY = Q.headY * .5; Q.headP = -.05; },
    radio(Q, t, s) { Q.lSh = .4; Q.lAb = .6; Q.lEl = 2.4; Q.lTw = .5; Q.headR = -.12; Q.rSh = .3 + Math.sin(t * 2 + s) * .1; Q.rEl = .9; },
    clap(Q, t, s) { const c = Math.abs(Math.sin(t * 5.5 + s)); Q.lSh = .7; Q.rSh = .7; Q.lEl = 1.25; Q.rEl = 1.25; Q.lAb = -.35 + c * .3; Q.rAb = -.35 + c * .3; Q.lTw = .5; Q.rTw = .5; Q.headP = -.08; Q.bob += Math.abs(Math.sin(t * 2.75 + s)) * .015; },
    cheer(Q, t, s) { const c = Math.sin(t * 4 + s); Q.lSh = 2.6 + c * .25; Q.rSh = 2.6 - c * .25; Q.lAb = .25; Q.rAb = .25; Q.lEl = .3; Q.rEl = .3; Q.headP = -.2; Q.bob += Math.abs(c) * .03; },
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
    sit(Q, t, s); Q.rollX = -1.15 * (k == null ? 1 : k); Q.lift = .55; Q.lHip = .35; Q.rHip = .35; Q.lKn = .3; Q.rKn = .5; Q.lFt = .2; Q.rFt = .2;
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
    Q.breath = Math.sin(t * 1.1) * .5 + .5; Q.bob = 0;
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

  return { Crowd, walk, idle, ACT, sit, recline, sleepPose, shake, crouch, geos, OPT };
})();
