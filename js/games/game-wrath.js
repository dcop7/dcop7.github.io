/* ══════════════════════════════════════════════════════════════════
   Fúria Divina — sandbox de destruição em 3D (out/2026)
   Sem objetivos, sem derrotas, sem pressa: uma cidade costeira enorme
   (baixa com arranha-céus, bairros, parque, estádio, torre de TV, porto,
   praia, montanhas e um vulcão) e uma paleta de poderes divinos com
   intensidade 1–5. Os edifícios desmoronam aos pedaços, há pó, fogo que
   se propaga, carros e gente que fogem (ninguém morre: as pessoas
   escapam), e no fim pode-se restaurar tudo e recomeçar.

   Técnica: cada estilo de edifício é UMA InstancedMesh de caixas; as
   fachadas (janelas, vidro refletor, luzes de noite) saem de um shader
   em coordenadas do mundo, por isso escalar a caixa não estica as janelas.
   Destroços = InstancedMesh com física simples; partículas, céu e água
   vêm de sky-ace-world.js. Interface em DOM por cima do palco.
══════════════════════════════════════════════════════════════════ */
const WrathGame = (function () {
  'use strict';
  const Ut = ArcadeKit.U, TAU = Math.PI * 2;
  const clamp = Ut.clamp, lerp = Ut.lerp, rand = Ut.rand;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const W = () => SkyAceWorld;
  const ID = 'divine-wrath';

  /* mundo */
  const WS = 3600, TN = 180, TC = WS / TN, T0 = -WS / 2;
  const PITCH = 100, ROAD = 14, CX0 = -1000, CX1 = 1000, CZ0 = -800, CZ1 = 600, COAST = 760;
  const VOLC = [-760, -1180], VOLC_H = 520;

  /* poderes */
  const POW = [
    { id: 'meteor', name: 'Meteoro', ic: '☄️', g: 'Céu', desc: 'Um meteoro cai onde clicares. Intensidade = tamanho.' },
    { id: 'shower', name: 'Chuva de meteoros', ic: '🌠', g: 'Céu', desc: 'Dezenas de pedras do céu à volta do ponto.' },
    { id: 'lightning', name: 'Tempestade', ic: '⚡', g: 'Céu', desc: 'Nuvens negras e raios que incendeiam tudo.' },
    { id: 'tornado', name: 'Tornado', ic: '🌪️', g: 'Céu', desc: 'Um tornado errante que levanta carros e destroços.' },
    { id: 'rain', name: 'Chuva', ic: '🌧️', g: 'Céu', desc: 'Chuva calma que apaga os incêndios.' },
    { id: 'quake', name: 'Terramoto', ic: '〰️', g: 'Terra', desc: 'Sismo com epicentro no clique. Intensidade = magnitude.' },
    { id: 'volcano', name: 'Vulcão', ic: '🌋', g: 'Terra', desc: 'Acorda o vulcão: lava, bombas de lava e cinza.' },
    { id: 'fissure', name: 'Fenda', ic: '⚡', g: 'Terra', desc: 'Abre uma fenda no chão por onde arrastares.', drag: 1 },
    { id: 'tsunami', name: 'Tsunami', ic: '🌊', g: 'Água', desc: 'Uma onda gigante vinda do mar.' },
    { id: 'flood', name: 'Subir o mar', ic: '💧', g: 'Água', desc: 'O nível do mar sobe (e volta a descer).' },
    { id: 'fire', name: 'Incêndio', ic: '🔥', g: 'Divino', desc: 'Pega fogo onde clicares. O fogo espalha-se.' },
    { id: 'fist', name: 'Punho divino', ic: '✊', g: 'Divino', desc: 'Um punho do céu esmaga o chão.' },
    { id: 'laser', name: 'Raio de luz', ic: '🔆', g: 'Divino', desc: 'Arrasta para cortar a cidade com um feixe.', drag: 1 },
    { id: 'blackhole', name: 'Buraco negro', ic: '🕳️', g: 'Divino', desc: 'Engole destroços, carros e edifícios.' },
    { id: 'zerog', name: 'Gravidade zero', ic: '🪐', g: 'Divino', desc: 'Tudo o que está solto flutua.' },
  ];
  /* ícone do Fenda diferente do da tempestade */
  POW.find(p => p.id === 'fissure').ic = '🪨';

  /* estilos de edifício: cor da parede, vidro, % de vidro, janela [largura, andar], telhado */
  const STY = [
    { name: 'vidro', walls: ['#3d5566', '#2f4a5a', '#45606e', '#5a6d78'], glass: '#7fb4cc', mix: .92, win: [3, 3.6], roof: '#3a3f45', rough: .3, metal: .3 },
    { name: 'betão', walls: ['#cfc6b6', '#bdb3a2', '#d8d2c6', '#a9a399'], glass: '#3b4a56', mix: .85, win: [3.4, 3.2], roof: '#6e6a62', rough: .8, metal: 0 },
    { name: 'tijolo', walls: ['#9c5a43', '#8a4c38', '#a86b50', '#7d4a3a'], glass: '#2e3a44', mix: .85, win: [3.2, 3.2], roof: '#4a3a34', rough: .85, metal: 0 },
    { name: 'moderno', walls: ['#eceae4', '#f2f0ea', '#dfe3e6', '#e8e1d4'], glass: '#4f7184', mix: .9, win: [4, 3.6], roof: '#7a7e82', rough: .55, metal: .05 },
    { name: 'casa', walls: ['#f1e6cf', '#e9d7b7', '#d9e2e6', '#f0d6c4', '#e2ead6'], glass: '#3b4a56', mix: .8, win: [3.6, 3], roof: '#a14a34', rough: .85, metal: 0 },
  ];

  /* ════════════════════════════════════════════════════════════════
     terreno: cidade plana, praia a sul, montanhas e vulcão a norte
  ════════════════════════════════════════════════════════════════ */
  function heightFn(seed) {
    const Wd = W(), n1 = Wd.perlin(seed), n2 = Wd.perlin(seed + 3);
    return (x, z) => {
      /* costa: o mar começa por volta de z = COAST, com recortes */
      const coast = COAST + n1(x / 520, 3.3) * 60 + n2(x / 160, 9) * 14;
      let h = 4 + n2(x / 300, z / 300) * 1.2;
      const toSea = z - coast;
      if (toSea > 0) h = lerp(h, -28, sstep(0, 150, toSea));
      else h = lerp(h, 1.2, sstep(-60, 0, toSea));
      /* montanhas a norte e a oeste */
      const north = sstep(-760, -1200, z), west = sstep(-1050, -1500, x), east = sstep(1050, 1500, x);
      const hills = (n1(x / 380, z / 380) * .5 + .5) * 260 + Math.pow(1 - Math.abs(n2(x / 420, z / 420)), 3) * 260;
      h += Math.max(north, west * .8, east * .7) * hills;
      /* vulcão */
      const dv = Math.hypot(x - VOLC[0], z - VOLC[1]);
      h += VOLC_H * Math.pow(Math.max(0, 1 - dv / 620), 1.7) - (dv < 70 ? (70 - dv) * 1.3 : 0);
      /* a cidade é plana */
      const inCity = sstep(-60, 40, Math.min(x - CX0 + 60, CX1 + 60 - x, z - CZ0 + 60, CZ1 + 140 - z));
      return lerp(h, 4, inCity * (toSea > -30 ? 0 : 1));
    };
  }

  /* ════════════════════════════════════════════════════════════════
     shaders das fachadas (injetados no MeshStandardMaterial)
  ════════════════════════════════════════════════════════════════ */
  function facadeMat(G, sty) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: sty.rough, metalness: sty.metal, envMapIntensity: 1 });
    const U = { uGlass: { value: new THREE.Color(sty.glass) }, uMix: { value: sty.mix }, uWin: { value: new THREE.Vector2(sty.win[0], sty.win[1]) }, uNight: G.uNight, uLit: { value: new THREE.Color('#ffd79a') }, uRoof: { value: new THREE.Color(sty.roof) } };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vLP; varying vec3 vSC; varying vec3 vLN; varying float vID;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vLP = position; vLN = normal; vID = float(gl_InstanceID);
        #ifdef USE_INSTANCING
          vSC = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #else
          vSC = vec3(1.);
        #endif`);
      sh.fragmentShader = 'varying vec3 vLP; varying vec3 vSC; varying vec3 vLN; varying float vID; uniform vec3 uGlass; uniform float uMix; uniform vec2 uWin; uniform float uNight; uniform vec3 uLit; uniform vec3 uRoof; float gWin; float gH;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 P = vLP * vSC; float roof = step(.5, abs(vLN.y));
          vec2 fu = abs(vLN.x) > .5 ? vec2(P.z, P.y) : vec2(P.x, P.y);
          vec2 cell = fu / uWin; vec2 f = fract(cell);
          float shop = step(P.y, 4.2);
          float win = (1. - roof) * step(.18, f.x) * step(f.x, .82) * mix(step(.24, f.y) * step(f.y, .8), step(.08, P.y) * step(P.y, 3.4), shop) * step(1.4, P.y) * step(P.y, vSC.y - .9);
          gH = fract(sin(dot(floor(cell) + vID * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb = mix(diffuseColor.rgb, uRoof * (.75 + .25 * gH), roof);
          diffuseColor.rgb *= 1. - .08 * step(.92, f.y) * (1. - roof);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass * (.7 + .5 * gH), win * uMix);
          gWin = win * uMix;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, .05, gWin);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, .55, gWin);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uLit * gWin * step(.5, gH) * uNight * (.7 + 1.1 * fract(gH * 13.));');
    };
    mat.customProgramCacheKey = () => 'facade';
    return mat;
  }

  /* ════════════════════════════════════════════════════════════════
     construção do mundo
  ════════════════════════════════════════════════════════════════ */
  function setup(api, o) {
    const big = (o.mode || 'big') === 'big' && !Arcade3D.coarse();
    const G = {
      api, t: 0, time: 0, ok: false, big, seed: 7,
      builds: [], cars: [], people: [], trees: [], haz: [], fires: new Set(), panic: [],
      stats: { destroyed: 0, damage: 0, cars: 0, fires: 0, biggest: 0, quakes: 0 },
      pow: 'meteor', lvl: 3, speed: 1, paused: false, tod: 1, cine: false,
      cam: { x: 0, z: 150, yaw: 0.35, pitch: .62, dist: 900, tdist: 900, tx: 0, tz: 150 },
      keys: {}, ptr: { ok: false }, shake: 0, uNight: { value: 0 }, sea: 0, seaT: 0, falling: [], tp: new Map(), msg: [],
    };
    if (typeof SkyAceWorld === 'undefined' || !(SkyAceWorld.V >= 3)) { G.fail3d = true; G.failMsg = 'O browser usou uma versão antiga do jogo — recarrega a página (Ctrl+Shift+R).'; return G; }
    Arcade3D.load().then(() => { try { build(G, api); } catch (e) { console.warn('[fúria] 3D falhou', e); G.fail3d = true; G.failMsg = 'Erro: ' + (e && e.message || e); } }).catch(() => { G.fail3d = true; G.failMsg = 'Não foi possível carregar o motor 3D.'; });
    return G;
  }

  const TODS = ['morning', 'noon', 'sunset', 'night'];
  function build(G, api) {
    if (!_col.c) _col.c = new THREE.Color();
    const Wd = W(), coarse = Arcade3D.coarse();
    const renderer = Arcade3D.attach(api.stage);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(48, 1, 2, 30000);
    const hemi = new THREE.HemisphereLight('#fff', '#555', 1), sun = new THREE.DirectionalLight('#fff', 2.5);
    sun.castShadow = true; const sm = coarse ? 1024 : 4096; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -.0004; sun.shadow.normalBias = 1.2;
    scene.add(hemi, sun, sun.target);
    const flash = new THREE.PointLight('#ffb070', 0, 900, 1.2); scene.add(flash);
    G.r3 = { renderer, scene, cam, hemi, sun, flash, coarse, dpr: 0, w: 0, h: 0 };
    /* terreno */
    const hf = heightFn(G.seed);
    G.h = new Float32Array((TN + 1) * (TN + 1)); G.h0 = null;
    for (let j = 0; j <= TN; j++) for (let i = 0; i <= TN; i++) G.h[j * (TN + 1) + i] = hf(T0 + i * TC, T0 + j * TC);
    G.h0 = G.h.slice();
    G.scorch = new Float32Array(G.h.length);
    G.r3.terrain = terrainMesh(G); scene.add(G.r3.terrain);
    /* céu e luz conforme a hora */
    setTod(G, 1, true);
    /* água */
    const water = Wd.buildWater({ water: '#1c5f78' }, G.r3.env); water.material.normalMap.repeat.set(5000, 5000); scene.add(water); G.r3.water = water;
    /* cidade */
    genCity(G);
    buildCityMeshes(G);
    /* partículas */
    const pk = { fogNear: 1200, fogFar: 9000, fog: '#c9d3dc' };
    G.r3.smoke = Wd.particles(scene, coarse ? 4000 : 9000, false, pk); G.r3.fire = Wd.particles(scene, coarse ? 3000 : 6000, true, pk);
    G.r3.clouds = Wd.buildClouds(Wd.SKIES.noon, 5, coarse ? .6 : 1, { area: 6000, alt: [900, 1500], R: [140, 360], n: 34 }); scene.add(G.r3.clouds.mesh);
    debrisSetup(G);
    syncSkyFx(G);
    G.ok = true;
    say(G, 'Fúria Divina', 'Escolhe um poder à esquerda e clica na cidade.', 4);
  }

  function terrainMesh(G) {
    const geo = new THREE.PlaneGeometry(WS, WS, TN, TN); geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const tex = W().canvasTex(128, 128, x => { const img = x.createImageData(128, 128), d = img.data; for (let k = 0; k < d.length; k += 4) { const v = 210 + Math.random() * 45; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255; } x.putImageData(img, 0, 0); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(160, 160);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: .95, metalness: 0, envMapIntensity: .3 }));
    m.receiveShadow = true; G.tm = m;
    refreshTerrain(G);
    return m;
  }
  function refreshTerrain(G) {
    const geo = G.tm.geometry, pos = geo.attributes.position, col = geo.attributes.color, c = new THREE.Color(), n1 = G.noise || (G.noise = W().perlin(G.seed + 11));
    const C = { asph: new THREE.Color('#4a4d52'), sand: new THREE.Color('#dcc996'), grass: new THREE.Color('#5f8a3c'), grass2: new THREE.Color('#7c9a48'), rock: new THREE.Color('#857b6e'), ash: new THREE.Color('#4a423d'), snow: new THREE.Color('#eef2f6'), sea: new THREE.Color('#2a5e66'), burnt: new THREE.Color('#231d1a'), lava: new THREE.Color('#ff4a12') };
    for (let k = 0; k < pos.count; k++) pos.setY(k, G.h[k]);
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), y = G.h[k], ny = nor.getY(k), v = n1(x / 200, z / 200) * .5 + .5;
      const city = x > CX0 - 20 && x < CX1 + 20 && z > CZ0 - 20 && z < CZ1 + 20;
      if (y < .8) c.copy(C.sand).lerp(C.sea, sstep(.5, -10, y));
      else if (city && y < 9) c.copy(C.asph);
      else if (y < 7 && z > COAST - 140) c.copy(C.sand);
      else { c.copy(C.grass).lerp(C.grass2, v); c.lerp(C.rock, Math.min(1, sstep(.88, .7, ny) + sstep(200, 380, y) * .7)); const dv = Math.hypot(x - VOLC[0], z - VOLC[1]); c.lerp(C.ash, sstep(300, 90, dv) * .85); c.lerp(C.snow, sstep(430, 470, y) * sstep(.7, .85, ny) * (dv > 200 ? 1 : 0)); }
      const sc = G.scorch[k]; if (sc > 0) c.lerp(sc > 1.5 ? C.lava : C.burnt, Math.min(1, sc > 1.5 ? (sc - 1.5) * 2 : sc));
      col.setXYZ(k, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; geo.computeBoundingSphere();
    G.dirtyT = false;
  }
  function hAt(G, x, z) {
    const gx = clamp((x - T0) / TC, 0, TN - 1e-4), gz = clamp((z - T0) / TC, 0, TN - 1e-4), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, h = G.h, w = TN + 1, k = j * w + i;
    return lerp(lerp(h[k], h[k + 1], fx), lerp(h[k + w], h[k + w + 1], fx), fz);
  }
  function forVerts(x, z, r, fn) {
    const i0 = Math.max(0, Math.floor((x - r - T0) / TC)), i1 = Math.min(TN, Math.ceil((x + r - T0) / TC)), j0 = Math.max(0, Math.floor((z - r - T0) / TC)), j1 = Math.min(TN, Math.ceil((z + r - T0) / TC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const vx = T0 + i * TC, vz = T0 + j * TC, d = Math.hypot(vx - x, vz - z); if (d <= r) fn(j * (TN + 1) + i, d); }
  }

  /* hora do dia: céu, luzes, nevoeiro, janelas acesas */
  function setTod(G, i, first) {
    const Wd = W(), r3 = G.r3, sky = Object.assign({}, Wd.SKIES[TODS[i]]);
    sky.fogNear = 1400; sky.fogFar = 11000;
    G.tod = i; G.sky = sky;
    if (r3.skyM) { r3.scene.remove(r3.skyM); r3.skyM.geometry.dispose(); r3.skyM.material.dispose(); }
    r3.skyM = Wd.skyMesh(sky); r3.scene.add(r3.skyM);
    if (r3.env) r3.env.dispose();
    r3.env = Wd.skyEnv(r3.renderer, sky); r3.scene.environment = r3.env;
    r3.scene.fog = new THREE.Fog(sky.hor, sky.fogNear, sky.fogFar);
    r3.hemi.color.set(sky.hemiSky); r3.hemi.groundColor.set(sky.hemiGnd); r3.hemi.intensity = sky.hemi;
    r3.sun.color.set(sky.sun); r3.sun.intensity = sky.sunI * (sky.stars ? .8 : 1);
    r3.sunDir = new THREE.Vector3(...sky.sunDir).normalize();
    r3.renderer.toneMappingExposure = sky.exp;
    G.uNight.value = sky.stars ? 1 : TODS[i] === 'sunset' ? .35 : 0;
    if (r3.water) r3.water.material.envMap = r3.env;
    if (!first) syncSkyFx(G);
  }
  function syncSkyFx(G) {
    const r3 = G.r3, sky = G.sky;
    if (r3.smoke) { const night = !!sky.stars; r3.smoke.mat.uniforms.uLight.value.set(night ? .45 : 1, night ? .48 : 1, night ? .6 : 1); r3.smoke.mat.uniforms.uFog.value.set(sky.hor); r3.fire.mat.uniforms.uFog.value.set(sky.hor); }
    if (r3.clouds) { const u = r3.clouds.mesh.material.uniforms; u.uLit.value.set(sky.cloud); u.uShade.value.set(sky.cloudShade); u.uFog.value.set(sky.hor); }
    if (r3.lamps) r3.lamps.visible = G.uNight.value > .3;
    if (r3.heads) r3.heads.visible = G.uNight.value > .3;
  }

  /* ════════════════════════════════════════════════════════════════
     cidade (geração)
  ════════════════════════════════════════════════════════════════ */
  function genCity(G) {
    const rn = W().rng(G.seed * 31 + 7), Wd = W();
    G.blocks = [];
    const nx = Math.round((CX1 - CX0) / PITCH), nz = Math.round((CZ1 - CZ0) / PITCH);
    G.grid = { nx, nz };
    const down = [60, -120];
    for (let bj = 0; bj < nz; bj++) for (let bi = 0; bi < nx; bi++) {
      const x0 = CX0 + bi * PITCH + ROAD / 2, z0 = CZ0 + bj * PITCH + ROAD / 2, sz = PITCH - ROAD, cx = x0 + sz / 2, cz = z0 + sz / 2;
      const d = Math.hypot(cx - down[0], (cz - down[1]) * 1.25);
      let zone = d < 300 ? 'down' : d < 620 ? 'mid' : 'res';
      if (bj === nz - 1 || cz > 480) zone = cz > 520 ? 'port' : zone === 'down' ? 'mid' : zone;
      const B = { bi, bj, x0, z0, sz, cx, cz, zone };
      G.blocks.push(B);
    }
    /* quarteirões especiais */
    const at = (bi, bj) => G.blocks.find(b => b.bi === bi && b.bj === bj);
    const pk = [at(7, 5), at(8, 5), at(7, 6), at(8, 6)]; pk.forEach(b => { if (b) b.zone = 'park'; });
    const st = at(14, 4); if (st) st.zone = 'stadium';
    G.blocks.forEach(b => { if (b.zone === 'res' && rn() < .09) b.zone = 'park'; if (b.zone === 'mid' && rn() < .05) b.zone = 'park'; });
    /* lotes e edifícios */
    const addB = (x, z, w, d, h, sty, rot) => {
      const b = { id: G.builds.length, x, z, w, d, h, h0: h, sty, rot: rot || 0, y: 4, col: STY[sty].walls[Math.floor(rn() * STY[sty].walls.length)], hp: 0, alive: true, state: 'ok', burn: 0, dmg: 0 };
      b.max = b.hp = 40 + Math.sqrt(w * d) * 3 + h * 2.2;
      G.builds.push(b); return b;
    };
    G.blocks.forEach(B => {
      const { x0, z0, sz, zone } = B, pad = 4;
      if (zone === 'down') {
        const n = rn() < .3 ? 1 : 2, cell = (sz - pad * 2) / n;
        for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
          const w = cell * (.62 + rn() * .3), dd = cell * (.62 + rn() * .3), dist = Math.hypot(B.cx - down[0], B.cz - down[1]);
          const h = (60 + Math.pow(rn(), 1.6) * 190) * (1.15 - dist / 400) + (n === 1 ? 40 : 0);
          addB(x0 + pad + cell * (a + .5), z0 + pad + cell * (c + .5), w, dd, Math.max(40, h), rn() < .65 ? 0 : 3);
          if (n === 1) { const base = addB(x0 + pad + cell * .5, z0 + pad + cell * .5, cell * .92, cell * .92, 14, 3); void base; }
        }
      } else if (zone === 'mid') {
        const n = 3, cell = (sz - pad * 2) / n;
        for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
          if (a === 1 && c === 1 && rn() < .6) continue;
          const w = cell * (.7 + rn() * .25), dd = cell * (.7 + rn() * .25), h = 12 + Math.pow(rn(), 1.4) * 48;
          addB(x0 + pad + cell * (a + .5), z0 + pad + cell * (c + .5), w, dd, h, rn() < .45 ? 1 : rn() < .6 ? 2 : 3);
        }
      } else if (zone === 'res') {
        const n = 4, cell = (sz - pad * 2) / n;
        for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
          if ((a === 1 || a === 2) && (c === 1 || c === 2)) { if (rn() < .7) G.trees.push({ x: x0 + pad + cell * (a + .5) + rand(-4, 4), z: z0 + pad + cell * (c + .5) + rand(-4, 4), s: rand(.7, 1.1) }); continue; }
          const w = 8 + rn() * 4, dd = 8 + rn() * 4, h = 5.5 + rn() * 3.5;
          const b = addB(x0 + pad + cell * (a + .5), z0 + pad + cell * (c + .5), w, dd, h, 4, rn() < .5 ? 0 : Math.PI / 2); b.roof = 2.4 + rn() * 1.6;
        }
      } else if (zone === 'port') {
        for (let k = 0; k < 3; k++) addB(x0 + pad + 14 + k * 27, B.cz - 18, 22, 34, 10 + rn() * 4, 1);
        B.containers = true;
      } else if (zone === 'park') {
        for (let k = 0; k < 26; k++) G.trees.push({ x: x0 + rand(6, sz - 6), z: z0 + rand(6, sz - 6), s: rand(.8, 1.3) });
        B.green = true;
      } else if (zone === 'stadium') B.green = true;
    });
    /* árvores nas montanhas e na periferia */
    const fz = Wd.perlin(3);
    for (let k = 0; k < (G.big ? 2600 : 1200); k++) {
      const x = rand(-1700, 1700), z = rand(-1700, 700);
      const city = x > CX0 - 30 && x < CX1 + 30 && z > CZ0 - 30 && z < CZ1 + 30;
      const h = hAt(G, x, z); if (city || h < 6 || h > 330 || Math.hypot(x - VOLC[0], z - VOLC[1]) < 380) continue;
      if (fz(x / 160, z / 160) < -.1) continue;
      G.trees.push({ x, z, s: rand(1.2, 2.2), wild: 1 });
    }
    /* pontos especiais: torre de TV e estádio */
    const pb = at(8, 5); if (pb) { const t = addB(pb.x0, pb.z0, 14, 14, 270, 3); t.tower = 1; }
    if (st) { const s = addB(st.cx, st.cz, 74, 60, 18, 1); s.stadium = 1; }
  }

  function buildCityMeshes(G) {
    const r3 = G.r3, scene = r3.scene, Wd = W(), c = new THREE.Color();
    /* passeios: um bloco claro por quarteirão (por cima do asfalto do terreno) */
    const side = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: '#b9b5ac', roughness: .9 }), G.blocks.length);
    G.blocks.forEach((B, i) => { side.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(B.cx, 3.7, B.cz), new THREE.Quaternion(), new THREE.Vector3(B.sz, .6, B.sz))); });
    side.receiveShadow = true; scene.add(side);
    /* relva dos parques e estádio */
    const greens = G.blocks.filter(b => b.green);
    const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: '#5f9a42', roughness: .95 }), Math.max(1, greens.length));
    greens.forEach((B, i) => gm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(B.cx, 3.8, B.cz), new THREE.Quaternion(), new THREE.Vector3(B.sz - 6, .65, B.sz - 6))));
    gm.receiveShadow = true; scene.add(gm);
    /* marcas da estrada (tracejado central) */
    const marks = [];
    for (let i = 0; i <= G.grid.nx; i++) for (let z = CZ0 + 10; z < CZ1; z += 9) marks.push([CX0 + i * PITCH, z, 0]);
    for (let j = 0; j <= G.grid.nz; j++) for (let x = CX0 + 10; x < CX1; x += 9) marks.push([x, CZ0 + j * PITCH, 1]);
    const mm = new THREE.InstancedMesh(new THREE.PlaneGeometry(.35, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d9d4c0' }), marks.length);
    marks.forEach(([x, z, r], i) => mm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 4.06, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r ? Math.PI / 2 : 0), new THREE.Vector3(1, 1, 1))));
    scene.add(mm);
    /* edifícios: uma InstancedMesh por estilo */
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    r3.bm = STY.map((sty, si) => {
      const list = G.builds.filter(b => b.sty === si);
      const m = new THREE.InstancedMesh(box, facadeMat(G, sty), Math.max(1, list.length));
      list.forEach((b, i) => { b.mi = i; m.setColorAt(i, c.set(b.col)); });
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
      return m;
    });
    /* telhados das casas */
    const rs = new THREE.Shape(); rs.moveTo(-.5, 0); rs.lineTo(.5, 0); rs.lineTo(0, 1); rs.lineTo(-.5, 0);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -.5);
    const houses = G.builds.filter(b => b.roof);
    r3.roofs = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ roughness: .8 }), Math.max(1, houses.length));
    houses.forEach((b, i) => { b.ri = i; r3.roofs.setColorAt(i, c.set(['#a14a34', '#8a3b2a', '#5a4a42', '#6e3b30', '#7a5a3a'][i % 5])); });
    r3.roofs.castShadow = true; r3.roofs.frustumCulled = false; scene.add(r3.roofs);
    /* torre de TV e estádio: malhas próprias */
    G.builds.forEach(b => {
      if (b.tower) {
        const g = new THREE.Group(), wm = Wd.plainMat('#e7e9ec', null, { metalness: .2, roughness: .5 }), rm = Wd.plainMat('#d94a3a', null, { metalness: .1 });
        Wd.addMesh(g, new THREE.CylinderGeometry(3, 6, 230, 16), wm, 0, 115, 0);
        Wd.addMesh(g, new THREE.SphereGeometry(13, 20, 14), Wd.plainMat('#3c5566', null, { metalness: .6, roughness: .15 }), 0, 205, 0, { s: [1, .7, 1] });
        Wd.addMesh(g, new THREE.CylinderGeometry(15, 15, 3, 20), wm, 0, 196, 0);
        Wd.addMesh(g, new THREE.CylinderGeometry(.8, 1.4, 40, 8), rm, 0, 250, 0);
        const l = new THREE.Sprite(Arcade3D.glowSprite('#ff3b3b')); l.position.y = 272; l.scale.setScalar(10); g.add(l);
        g.position.set(b.x, 4, b.z); scene.add(g); b.mesh = g;
      } else if (b.stadium) {
        const g = new THREE.Group(), cm = Wd.plainMat('#d8d6d0', null, { metalness: 0, roughness: .8 });
        const ring = new THREE.LatheGeometry([new THREE.Vector2(30, 0), new THREE.Vector2(44, 18), new THREE.Vector2(46, 18), new THREE.Vector2(46, 0)], 40); ring.scale(1, 1, .82);
        Wd.addMesh(g, ring, cm, 0, 0, 0);
        Wd.addMesh(g, new THREE.CylinderGeometry(30, 30, .5, 40), Wd.plainMat('#3f9a3a', null, { metalness: 0, roughness: .9 }), 0, .3, 0, { s: [1, 1, .82] });
        Wd.addMesh(g, new THREE.TorusGeometry(46, 1.2, 6, 40), Wd.plainMat('#c23b3b', null, { metalness: .2 }), 0, 18.5, 0, { rx: Math.PI / 2, s: [1, .82, 1] });
        g.position.set(b.x, 4, b.z); scene.add(g); b.mesh = g;
      }
    });
    G.builds.forEach(b => syncB(G, b));
    /* contentores e gruas no porto */
    const conts = [];
    G.blocks.filter(b => b.containers).forEach(B => { for (let k = 0; k < 40; k++) conts.push([B.x0 + rand(6, B.sz - 6), B.cz + rand(10, 38), Math.floor(rand(0, 3))]); });
    r3.cont = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.5).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ roughness: .6, metalness: .3 }), Math.max(1, conts.length));
    conts.forEach(([x, z, s], i) => { r3.cont.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 4 + s * 2.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rand(0, 1)) * Math.PI / 2), new THREE.Vector3(1, 1, 1))); r3.cont.setColorAt(i, c.set(['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#909497'][i % 6])); });
    r3.cont.castShadow = true; scene.add(r3.cont); G.conts = conts.map(([x, z, s]) => ({ x, z, s, alive: true }));
    G.blocks.filter(b => b.containers).slice(0, 4).forEach((B, k) => {
      const g = new THREE.Group(), m = Wd.plainMat('#e2a51c', null, { metalness: .3, roughness: .5 });
      [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, z]) => Wd.addMesh(g, new THREE.BoxGeometry(1.5, 34, 1.5), m, x, 17, z));
      Wd.addMesh(g, new THREE.BoxGeometry(2.4, 2.4, 60), m, 0, 35, 12);
      g.position.set(B.cx + 20, 4, B.z0 + B.sz + 18); scene.add(g);
    });
    /* árvores */
    const tg = Wd.treeGeo('leaf');
    r3.trees = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }), Math.max(1, G.trees.length));
    G.trees.forEach((t, i) => { t.i = i; t.alive = true; t.burn = 0; r3.trees.setColorAt(i, c.set(t.wild ? '#3a6b2c' : '#4a8a36').lerp(new THREE.Color('#9ab84a'), rand(0, .5))); });
    r3.trees.castShadow = true; r3.trees.frustumCulled = false; scene.add(r3.trees); treesSync(G);
    /* carros e pessoas */
    genTraffic(G);
    /* barcos */
    r3.boats = [];
    for (let k = 0; k < 7; k++) { const g = boatMesh(G, k); const x = -900 + k * 290 + rand(-60, 60), z = COAST + 200 + rand(0, 500); g.position.set(x, 0, z); g.rotation.y = rand(0, TAU); scene.add(g); r3.boats.push({ g, x, z, a: g.rotation.y, v: rand(2, 5), vy: 0, y: 0 }); }
    /* candeeiros de rua (só de noite) */
    const lamps = [];
    for (let i = 0; i <= G.grid.nx; i++) for (let z = CZ0 + 25; z < CZ1; z += 50) lamps.push(CX0 + i * PITCH + 7.5, 12, z);
    for (let j = 0; j <= G.grid.nz; j++) for (let x = CX0 + 25; x < CX1; x += 50) lamps.push(x, 12, CZ0 + j * PITCH + 7.5);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
    r3.lamps = new THREE.Points(lg, new THREE.PointsMaterial({ map: Arcade3D.glowTex(), color: '#ffcf8a', size: 18, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(r3.lamps);
    /* grelha espacial dos edifícios */
    G.bgrid = new Map(); G.builds.forEach(b => { const k = gkey(b.x, b.z); (G.bgrid.get(k) || G.bgrid.set(k, []).get(k)).push(b); });
  }
  const gkey = (x, z) => Math.floor((x + 2000) / 60) * 1000 + Math.floor((z + 2000) / 60);
  function buildsNear(G, x, z, r, fn) {
    const i0 = Math.floor((x - r + 2000) / 60), i1 = Math.floor((x + r + 2000) / 60), j0 = Math.floor((z - r + 2000) / 60), j1 = Math.floor((z + r + 2000) / 60);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = G.bgrid.get(i * 1000 + j); if (a) for (const b of a) { if (!b.alive) continue; const d = Math.max(0, Math.hypot(b.x - x, b.z - z) - Math.max(b.w, b.d) * .5); if (d <= r) fn(b, d); } }
  }
  function boatMesh(G, k) {
    const Wd = W(), g = new THREE.Group();
    const hull = Wd.plainMat(['#7a2b2b', '#2b4a7a', '#2b6a4a', '#5a5a5a'][k % 4], null, { metalness: .2, roughness: .6 });
    Wd.addMesh(g, new THREE.BoxGeometry(14, 6, 70), hull, 0, 1, 0);
    Wd.addMesh(g, new THREE.BoxGeometry(12, 8, 12), Wd.plainMat('#eeeeee', null, { metalness: .1 }), 0, 8, -26);
    for (let i = 0; i < 6; i++) Wd.addMesh(g, new THREE.BoxGeometry(12, 2.6, 2.5), Wd.plainMat(['#c0392b', '#2471a3', '#d68910'][i % 3], null, { metalness: .2 }), 0, 5.3, -12 + i * 6);
    return g;
  }

  /* matriz de um edifício (com colapso, inclinação e tremor) */
  const _M = {};
  function syncB(G, b) {
    if (!_M.m) { _M.m = new THREE.Matrix4(); _M.q = new THREE.Quaternion(); _M.e = new THREE.Euler(); _M.p = new THREE.Vector3(); _M.s = new THREE.Vector3(); }
    const { m, q, e, p, s } = _M, r3 = G.r3;
    if (b.mesh) {
      if (b.mi != null && !b.zeroed) { b.zeroed = 1; s.set(0, 0, 0); m.compose(p.set(0, -50, 0), q.identity(), s); r3.bm[b.sty].setMatrixAt(b.mi, m); r3.bm[b.sty].instanceMatrix.needsUpdate = true; }
      b.mesh.visible = b.state !== 'gone';
      b.mesh.position.set(b.x + (b.sway || 0) * 4, 4 - (b.sink || 0), b.z); b.mesh.rotation.set(b.tilt ? b.tilt[0] : 0, 0, b.tilt ? b.tilt[1] : 0);
      return;
    }
    if (b.state === 'gone') s.set(0, 0, 0); else s.set(b.w, Math.max(.1, b.h), b.d);
    e.set((b.tilt ? b.tilt[0] : 0), b.rot, (b.tilt ? b.tilt[1] : 0) + (b.sway || 0) * .02); q.setFromEuler(e);
    p.set(b.x, b.y - (b.sink || 0), b.z); m.compose(p, q, s);
    r3.bm[b.sty].setMatrixAt(b.mi, m); r3.bm[b.sty].instanceMatrix.needsUpdate = true;
    if (b.roof != null && b.ri != null) {
      if (b.state === 'gone' || b.h < b.h0 * .8) s.set(0, 0, 0); else s.set(b.w + .8, b.roof, b.d + .8);
      p.set(b.x, b.y - (b.sink || 0) + b.h, b.z); m.compose(p, q, s); r3.roofs.setMatrixAt(b.ri, m); r3.roofs.instanceMatrix.needsUpdate = true;
    }
  }
  function tintB(G, b, c) { if (b.mesh || !G.r3.bm[b.sty].instanceColor) return; G.r3.bm[b.sty].setColorAt(b.mi, c); G.r3.bm[b.sty].instanceColor.needsUpdate = true; }
  function treesSync(G) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
    G.trees.forEach(t => {
      e.set(t.fall || 0, t.i * 1.7, 0); q.setFromEuler(e); s.setScalar(t.alive ? t.s : 0); p.set(t.x, hAt(G, t.x, t.z) - .3, t.z); m.compose(p, q, s); G.r3.trees.setMatrixAt(t.i, m);
      if (t.burnt && !t.tinted) { t.tinted = 1; G.r3.trees.setColorAt(t.i, c.set('#2a2420')); }
    });
    G.r3.trees.instanceMatrix.needsUpdate = true; if (G.r3.trees.instanceColor) G.r3.trees.instanceColor.needsUpdate = true;
  }

  /* ════════════════════════════════════════════════════════════════
     trânsito e peões
  ════════════════════════════════════════════════════════════════ */
  function genTraffic(G) {
    const Wd = W(), r3 = G.r3, scene = r3.scene, c = new THREE.Color();
    const nCars = G.big ? 900 : 380, nPeople = G.big ? 2600 : 1000;
    const M4 = Wd.M4;
    const carGeo = Wd.mergeGeos([[new THREE.BoxGeometry(1.9, .8, 4.4), '#ffffff', M4(0, .75, 0)], [new THREE.BoxGeometry(1.7, .7, 2.3), '#1b2430', M4(0, 1.45, -.2)], ...[[-.95, 1.3], [.95, 1.3], [-.95, -1.3], [.95, -1.3]].map(([x, z]) => [new THREE.CylinderGeometry(.36, .36, .3, 8), '#151515', M4(x, .36, z, 0, 0, Math.PI / 2)])]);
    r3.cars = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .4 }), nCars);
    r3.cars.castShadow = true; r3.cars.frustumCulled = false; r3.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(r3.cars);
    const cols = ['#c0392b', '#e5e7e9', '#1b2631', '#2e86c1', '#7f8c8d', '#f1c40f', '#ecf0f1', '#145a32', '#5b2c6f', '#a04000'];
    for (let i = 0; i < nCars; i++) {
      const horiz = Math.random() < .5, line = horiz ? Math.floor(rand(0, G.grid.nz + 1)) : Math.floor(rand(0, G.grid.nx + 1));
      const dir = Math.random() < .5 ? 1 : -1;
      const car = { i, horiz, line, dir, s: horiz ? rand(CX0, CX1) : rand(CZ0, CZ1), v: rand(9, 15), alive: true, fly: 0, x: 0, y: 4, z: 0, a: 0, wreck: 0 };
      G.cars.push(car); r3.cars.setColorAt(i, c.set(cols[i % cols.length]));
    }
    /* faróis (pontos) de noite */
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nCars * 3), 3).setUsage(THREE.DynamicDrawUsage));
    r3.heads = new THREE.Points(hg, new THREE.PointsMaterial({ map: Arcade3D.glowTex(), color: '#fff2d0', size: 9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    r3.heads.frustumCulled = false; scene.add(r3.heads);
    /* peões nos passeios */
    const pg = Wd.mergeGeos([[new THREE.CylinderGeometry(.32, .38, 1.3, 6), '#ffffff', M4(0, 1.05, 0)], [new THREE.SphereGeometry(.26, 8, 6), '#e0b090', M4(0, 1.95, 0)], [new THREE.CylinderGeometry(.12, .12, .8, 5), '#333333', M4(-.15, .4, 0)], [new THREE.CylinderGeometry(.12, .12, .8, 5), '#333333', M4(.15, .4, 0)]]);
    pg.scale(1.6, 1.6, 1.6);
    r3.ppl = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), nPeople);
    r3.ppl.frustumCulled = false; r3.ppl.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(r3.ppl);
    const pc = ['#d35400', '#2980b9', '#27ae60', '#8e44ad', '#c0392b', '#f39c12', '#16a085', '#2c3e50', '#ecf0f1', '#e84393'];
    const blocks = G.blocks.filter(b => b.zone !== 'port');
    for (let i = 0; i < nPeople; i++) {
      const B = blocks[Math.floor(Math.random() * blocks.length)], per = B.sz * 4;
      G.people.push({ i, B, s: rand(0, per), v: rand(1.2, 1.8) * (Math.random() < .5 ? 1 : -1), x: 0, z: 0, alive: true, run: 0, fx: 0, fz: 0, home: 1, anim: rand(0, 6) });
      r3.ppl.setColorAt(i, c.set(pc[i % pc.length]));
    }
  }
  const lanePos = (car) => {
    if (car.horiz) return [car.s, CZ0 + car.line * PITCH + car.dir * 3.4];
    return [CX0 + car.line * PITCH - car.dir * 3.4, car.s];
  };
  function trafficStep(G, dt) {
    const r3 = G.r3, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
    const hp = r3.heads.geometry.attributes.position, night = G.uNight.value > .3;
    for (const car of G.cars) {
      if (!car.alive) { s.set(0, 0, 0); m.compose(p.set(0, -100, 0), q, s); r3.cars.setMatrixAt(car.i, m); s.set(1, 1, 1); hp.setXYZ(car.i, 0, -100, 0); continue; }
      if (car.fly) {
        car.vy -= 22 * dt; car.x += car.vx * dt; car.y += car.vy * dt; car.z += car.vz * dt; car.rx += car.wx * dt; car.rz += car.wz * dt;
        G.haz.forEach(hz => hz.pull && hz.pull(G, car, dt));
        const gy = Math.max(hAt(G, car.x, car.z), G.sea);
        if (car.y < gy + .2) { car.y = gy + .2; if (Math.abs(car.vy) > 6) { car.vy *= -.3; car.vx *= .6; car.vz *= .6; car.wx *= .5; car.wz *= .5; } else { car.fly = 0; car.wreck = 1; car.vx = car.vz = car.vy = 0; } if (car.y < G.sea + .5 && G.sea > 1) car.float = 1; }
        e.set(car.rx, car.a, car.rz); q.setFromEuler(e); m.compose(p.set(car.x, car.y, car.z), q, s); r3.cars.setMatrixAt(car.i, m); hp.setXYZ(car.i, 0, -100, 0);
        continue;
      }
      if (car.wreck) {
        if (car.float && G.sea > car.y) car.y = lerp(car.y, G.sea, dt);
        e.set(car.rx || 0, car.a, car.rz || 0); q.setFromEuler(e); m.compose(p.set(car.x, car.y, car.z), q, s); r3.cars.setMatrixAt(car.i, m); hp.setXYZ(car.i, 0, -100, 0); continue;
      }
      /* fugir do perigo: acelera */
      let v = car.v, danger = 0;
      for (const pz of G.panic) { const [cx, cz] = lanePos(car), d = Math.hypot(cx - pz.x, cz - pz.z); if (d < pz.r * 2.5) danger = 1; }
      if (danger) v *= 2.2;
      car.s += car.dir * v * dt;
      /* chegada a um cruzamento: continuar ou virar */
      const lim0 = car.horiz ? CX0 : CZ0, lim1 = car.horiz ? CX1 : CZ1;
      const nearX = Math.round((car.s - lim0) / PITCH), crossS = lim0 + nearX * PITCH;
      if (Math.abs(car.s - crossS) < v * dt * 1.01 && car.lastX !== crossS + (car.horiz ? 0 : .5)) {
        car.lastX = crossS + (car.horiz ? 0 : .5);
        if (Math.random() < .35) { const [cx, cz] = lanePos(car); car.horiz = !car.horiz; car.line = car.horiz ? Math.round((cz - CZ0) / PITCH) : Math.round((cx - CX0) / PITCH); car.s = car.horiz ? cx : cz; car.dir = Math.random() < .5 ? 1 : -1; car.lastX = car.s + (car.horiz ? 0 : .5); }
      }
      if (car.s < lim0 || car.s > lim1) { car.dir *= -1; car.s = clamp(car.s, lim0, lim1); }
      const [x, z] = lanePos(car);
      car.x = x; car.z = z; car.y = Math.max(4, hAt(G, x, z)); car.a = car.horiz ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      q.setFromAxisAngle(up, car.a); m.compose(p.set(x, car.y, z), q, s); r3.cars.setMatrixAt(car.i, m);
      if (night) hp.setXYZ(car.i, x + Math.sin(car.a) * 2.4, car.y + .9, z + Math.cos(car.a) * 2.4); else hp.setXYZ(car.i, 0, -100, 0);
      /* inundação: o carro flutua e é arrastado */
      if (G.sea > car.y + .6) { car.wreck = 1; car.float = 1; car.rx = rand(-.3, .3); car.rz = rand(-.3, .3); }
    }
    r3.cars.instanceMatrix.needsUpdate = true; hp.needsUpdate = true;
    /* peões */
    for (const pp of G.people) {
      if (!pp.alive) { if (pp.hid !== 1) { pp.hid = 1; s.set(0, 0, 0); m.compose(p.set(0, -100, 0), q, s); r3.ppl.setMatrixAt(pp.i, m); s.set(1, 1, 1); } continue; }
      pp.anim += dt * 8;
      let fleeing = null;
      for (const pz of G.panic) { const d = Math.hypot(pp.x - pz.x, pp.z - pz.z); if (d < pz.r * 2.2 && (!fleeing || d < fleeing.d)) fleeing = { pz, d }; }
      if (fleeing) {
        /* corre para longe; quem fica no centro do perigo "escapa" (desaparece) — ninguém morre aqui */
        const dx = pp.x - fleeing.pz.x, dz = pp.z - fleeing.pz.z, d = fleeing.d || 1;
        pp.x += dx / d * 6 * dt; pp.z += dz / d * 6 * dt; pp.run = 1; pp.fa = Math.atan2(dx, dz);
        if (d < fleeing.pz.r * .6) { pp.alive = false; G.stats.evac = (G.stats.evac || 0) + 1; burstP(G, pp.x, 6, pp.z, '#ffffff', 2); continue; }
      } else if (pp.run) {
        pp.run = Math.max(0, pp.run - dt * .2);
        if (pp.run <= 0) { const B = pp.B; pp.x = clamp(pp.x, B.x0, B.x0 + B.sz); pp.z = clamp(pp.z, B.z0, B.z0 + B.sz); }
      } else {
        const B = pp.B, L = B.sz; pp.s = (pp.s + pp.v * dt + L * 4) % (L * 4);
        const k = Math.floor(pp.s / L), f = pp.s % L, o = 2.2;
        const pts = [[B.x0 + f, B.z0 + o], [B.x0 + L - o, B.z0 + f], [B.x0 + L - f, B.z0 + L - o], [B.x0 + o, B.z0 + L - f]][k];
        pp.fa = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][k] + (pp.v < 0 ? Math.PI : 0);
        pp.x = pts[0]; pp.z = pts[1];
      }
      const y = Math.max(4.32, hAt(G, pp.x, pp.z)) + (pp.run ? Math.abs(Math.sin(pp.anim * 1.6)) * .3 : 0);
      if (G.sea > y + 1) { pp.alive = false; continue; }
      q.setFromAxisAngle(up, pp.fa || 0); m.compose(p.set(pp.x, y, pp.z), q, s); r3.ppl.setMatrixAt(pp.i, m);
    }
    r3.ppl.instanceMatrix.needsUpdate = true;
  }
  /* carro atirado pelo ar */
  function throwCar(G, car, vx, vy, vz) {
    if (!car.alive) return;
    if (!car.counted) { car.counted = 1; G.stats.cars++; }
    car.fly = 1; car.wreck = 0; car.vx = vx; car.vy = vy; car.vz = vz; car.rx = car.rx || 0; car.rz = car.rz || 0; car.wx = rand(-6, 6); car.wz = rand(-6, 6);
  }
  function carsNear(G, x, z, r, fn) { for (const c of G.cars) if (c.alive) { const d = Math.hypot(c.x - x, c.z - z); if (d < r) fn(c, d); } }

  /* ════════════════════════════════════════════════════════════════
     destroços (InstancedMesh com física simples)
  ════════════════════════════════════════════════════════════════ */
  function debrisSetup(G) {
    const cap = G.big ? 5000 : 2200;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .9, metalness: .05 }), cap);
    m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0;
    m.setColorAt(0, new THREE.Color('#888'));
    G.r3.scene.add(m); G.r3.deb = m;
    G.deb = []; G.debCap = cap; G.debNext = 0;
  }
  function spawnDebris(G, x, y, z, s, vx, vy, vz, col) {
    if (G.budD <= 0) return; G.budD--;
    const cap = G.debCap; let i;
    if (G.deb.length < cap) { i = G.deb.length; G.deb.push({}); } else { i = G.debNext; G.debNext = (G.debNext + 1) % cap; }
    const d = G.deb[i];
    Object.assign(d, { x, y, z, vx, vy, vz, sx: s * rand(.5, 1.4), sy: s * rand(.3, .9), sz: s * rand(.5, 1.4), rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), wx: rand(-4, 4), wy: rand(-4, 4), wz: rand(-4, 4), sleep: 0, life: 0, fire: Math.random() < .12 ? rand(2, 6) : 0 });
    G.r3.deb.setColorAt(i, _col.set(col || '#8a8680').multiplyScalar(rand(.6, 1)));
    G.r3.deb.instanceColor.needsUpdate = true;
    G.debDirty = 1;
  }
  const _col = { set() { return this.c.set(...arguments); }, c: null };
  function debrisStep(G, dt) {
    const m = _M.m || new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const zg = G.haz.some(h => h.k === 'zerog'), pulls = G.haz.filter(h => h.pull);
    let moved = false;
    for (let i = 0; i < G.deb.length; i++) {
      const d = G.deb[i];
      if (d.sleep && !zg && (!pulls.length || !pulls.some(h => h.near(d)))) continue;
      d.life += dt;
      d.vy -= (zg ? -2 : 22) * dt;
      for (const h of pulls) h.pull(G, d, dt);
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const gy = Math.max(hAt(G, d.x, d.z), G.sea > 0 ? G.sea - .3 : -40) + d.sy * .5;
      if (d.y < gy) {
        d.y = gy; d.vy *= -.25; d.vx *= .55; d.vz *= .55; d.wx *= .5; d.wy *= .5; d.wz *= .5;
        if (Math.abs(d.vy) < 1.5 && Math.hypot(d.vx, d.vz) < 1.2) { d.vy = d.vx = d.vz = 0; d.wx = d.wy = d.wz = 0; if (!zg) d.sleep = 1; }
      }
      if (zg && d.y > 300) d.vy = Math.min(d.vy, 0);
      if (d.fire > 0) { d.fire -= dt; if (Math.random() < .3) G.r3.fire.spawn({ x: d.x, y: d.y, z: d.z, vy: 3, life: .4, s0: d.sx * 1.5, s1: d.sx * .5, c0: '#ffb050', c1: '#ff4010', k: 1.6 }); }
      e.set(d.rx, d.ry, d.rz); q.setFromEuler(e); s.set(d.sx, d.sy, d.sz); p.set(d.x, d.y, d.z); m.compose(p, q, s); G.r3.deb.setMatrixAt(i, m); moved = true;
    }
    G.r3.deb.count = G.deb.length;
    if (moved || G.debDirty) { G.r3.deb.instanceMatrix.needsUpdate = true; G.debDirty = 0; }
  }

  /* ════════════════════════════════════════════════════════════════
     dano, colapso, fogo
  ════════════════════════════════════════════════════════════════ */
  const VALUE = b => Math.round(b.w * b.d * b.h * 380);
  function damage(G, b, amt, from, kind) {
    if (!b.alive || b.state === 'falling' || b.state === 'gone') return;
    b.hp -= amt; b.dmg = Math.max(b.dmg, 1 - b.hp / b.max);
    if (!b.mesh) tintB(G, b, _col.set(b.col).lerp(new THREE.Color('#2d2723'), Math.min(.75, b.dmg * .8)));
    if (b.hp <= 0) collapse(G, b, from, kind);
    else if (b.dmg > .45 && !b.part && b.h > 18 && !b.mesh) partial(G, b, from);
  }
  /* parte de cima cai */
  function partial(G, b, from) {
    b.part = 1;
    const cut = b.h * rand(.35, .6), top = b.h - cut;
    const n = Math.min(26, 4 + Math.round(b.w * b.d * cut / 2600));
    for (let k = 0; k < n; k++) {
      const ox = rand(-b.w / 2, b.w / 2), oz = rand(-b.d / 2, b.d / 2), oy = top + rand(0, cut);
      const dx = from ? Math.sign(b.x - from[0]) : rand(-1, 1), dz = from ? Math.sign(b.z - from[1]) : rand(-1, 1);
      spawnDebris(G, b.x + ox, b.y + oy, b.z + oz, rand(2, 5), dx * rand(2, 10) + rand(-3, 3), rand(-2, 6), dz * rand(2, 10) + rand(-3, 3), b.col);
    }
    b.h = top; syncB(G, b);
    dust(G, b.x, b.y + top, b.z, Math.sqrt(b.w * b.d) * .9, 6);
    sfx(G, 'crumble', b);
  }
  function collapse(G, b, from, kind) {
    if (b.state === 'falling' || b.state === 'gone') return;
    b.state = 'falling'; b.fallT = 0; b.hp = 0;
    const away = from ? Math.atan2(b.z - from[1], b.x - from[0]) : rand(0, TAU);
    b.fallDir = [Math.sin(away) * rand(.3, .9), -Math.cos(away) * rand(.3, .9)];
    b.fallDur = clamp(1.2 + b.h / 60, 1.2, 4.5);
    G.stats.destroyed++; G.stats.damage += VALUE(b);
    G.falling.push(b);
    sfx(G, b.h > 40 ? 'collapse' : 'crumble', b);
  }
  function fallStep(G, dt) {
    for (let i = G.falling.length - 1; i >= 0; i--) {
      const b = G.falling[i]; b.fallT += dt;
      const k = b.fallT / b.fallDur, e2 = k * k;
      b.sink = e2 * b.h * .95; b.tilt = [b.fallDir[0] * e2 * .5, b.fallDir[1] * e2 * .5];
      /* pedaços a soltarem-se e pó na base */
      const area = b.w * b.d;
      if (Math.random() < Math.min(1, area / 500 + .2)) {
        const yy = b.y + rand(0, Math.max(1, b.h - b.sink));
        spawnDebris(G, b.x + rand(-b.w / 2, b.w / 2), yy, b.z + rand(-b.d / 2, b.d / 2), rand(1.5, 4.5) * (b.h > 50 ? 1.4 : 1), rand(-6, 6) + b.fallDir[0] * 8, rand(0, 4), rand(-6, 6) - b.fallDir[1] * 8, b.col);
      }
      if (Math.random() < .55) dust(G, b.x + rand(-b.w / 2, b.w / 2), b.y + 2, b.z + rand(-b.d / 2, b.d / 2), Math.sqrt(area) * .7 + 6, 3);
      if (b.fallT >= b.fallDur) {
        b.state = 'gone'; b.alive = false; G.falling.splice(i, 1);
        const n = Math.min(40, 6 + Math.round(area * b.h / 9000));
        for (let k2 = 0; k2 < n; k2++) spawnDebris(G, b.x + rand(-b.w / 2, b.w / 2), b.y + rand(0, 6), b.z + rand(-b.d / 2, b.d / 2), rand(2, 5) * (b.h > 50 ? 1.3 : 1), rand(-5, 5), rand(0, 5), rand(-5, 5), b.col);
        for (let k2 = 0; k2 < 5; k2++) dust(G, b.x + rand(-b.w, b.w) * .6, b.y + 3, b.z + rand(-b.d, b.d) * .6, Math.sqrt(area) * 1.2 + 10, 9);
        G.shake = Math.max(G.shake, clamp(b.h / 40, .5, 4) * clamp(1 - Math.hypot(b.x - G.cam.x, b.z - G.cam.z) / 1500, .1, 1));
        if (b.burn) { G.fires.delete(b); b.burn = 0; }
      }
      syncB(G, b);
    }
  }
  function ignite(G, b) {
    if (!b.alive || b.state !== 'ok' || b.burn > 0) return;
    b.burn = rand(18, 40); G.fires.add(b); G.stats.fires++;
  }
  function fireStep(G, dt) {
    const raining = G.haz.some(h => h.k === 'rain');
    for (const b of G.fires) {
      if (!b.alive || b.state !== 'ok') { G.fires.delete(b); continue; }
      b.burn -= dt * (raining ? 6 : 1);
      if (b.burn <= 0) { G.fires.delete(b); b.burn = 0; continue; }
      damage(G, b, dt * b.max * .02, null, 'fire');
      const n = b.h > 40 ? 3 : 1;
      for (let k = 0; k < n; k++) if (Math.random() < .7) {
        const side = Math.floor(rand(0, 4)), y = b.y + rand(2, Math.max(3, b.h));
        const ox = side < 2 ? (side ? 1 : -1) * b.w / 2 : rand(-b.w / 2, b.w / 2), oz = side >= 2 ? (side === 2 ? 1 : -1) * b.d / 2 : rand(-b.d / 2, b.d / 2);
        G.r3.fire.spawn({ x: b.x + ox, y, z: b.z + oz, vx: rand(-1, 1), vy: rand(3, 7), vz: rand(-1, 1), life: rand(.6, 1.3), s0: 5, s1: 12, c0: '#ffd27a', c1: '#ff3a0a', k: 1.8, drag: .5 });
      }
      if (Math.random() < .2) smokeCol(G, b.x, b.y + b.h, b.z, Math.sqrt(b.w * b.d) * .5 + 6);
      /* propagação (vento de leste), lenta */
      if (Math.random() < dt * .12) buildsNear(G, b.x + 8, b.z, 24, (o) => { if (o !== b && Math.random() < .22) ignite(G, o); });
      G.trees.forEach(t => { if (t.alive && !t.burnt && Math.abs(t.x - b.x) < 30 && Math.abs(t.z - b.z) < 30 && Math.random() < dt * .3) { t.burnt = 1; G.treeDirty = 1; } });
    }
  }

  /* ════════════════════════════════════════════════════════════════
     poderes
  ════════════════════════════════════════════════════════════════ */
  function usePower(G, x, z, x2, z2) {
    const L = G.lvl, k = G.pow, y = hAt(G, x, z);
    sfx(G, 'cast');
    switch (k) {
      case 'meteor': meteor(G, x, z, L, true); break;
      case 'shower': G.haz.push(showerHaz(G, x, z, L)); break;
      case 'lightning': G.haz.push(stormHaz(G, x, z, L)); break;
      case 'tornado': G.haz.push(tornadoHaz(G, x, z, L)); break;
      case 'rain': G.haz.push(rainHaz(G, x, z, L)); break;
      case 'quake': G.haz.push(quakeHaz(G, x, z, L)); G.stats.quakes++; break;
      case 'volcano': if (!G.haz.some(h => h.k === 'volcano')) G.haz.push(volcanoHaz(G, L)); else say(G, 'O vulcão já está ativo', '', 1.5); G.cam.tx = lerp(G.cam.tx, VOLC[0], .4); break;
      case 'fissure': fissure(G, x, z, x2, z2, L); break;
      case 'tsunami': if (!G.haz.some(h => h.k === 'tsunami')) G.haz.push(tsunamiHaz(G, x, L)); break;
      case 'flood': G.haz.push(floodHaz(G, L)); break;
      case 'fire': { buildsNear(G, x, z, 6 + L * 6, b => ignite(G, b)); G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < 10 + L * 6) { t.burnt = 1; G.treeDirty = 1; } }); fireballFx(G, x, y + 2, z, 6 + L * 3); break; }
      case 'fist': G.haz.push(fistHaz(G, x, z, L)); break;
      case 'laser': G.haz.push(laserHaz(G, x, z, x2, z2, L)); break;
      case 'blackhole': G.haz.push(holeHaz(G, x, z, L)); break;
      case 'zerog': G.haz.push({ k: 'zerog', t: 0, life: 6 + L * 2, step(G, dt) { if (this.t < .1) { G.deb.forEach(d => { d.sleep = 0; d.vy += rand(4, 12); d.wx = rand(-2, 2); d.wy = rand(-2, 2); }); G.cars.forEach(c => { if (c.alive && Math.random() < .2 + L * .1) throwCar(G, c, rand(-3, 3), rand(6, 14), rand(-3, 3)); }); } } }); break;
    }
  }
  /* explosão genérica: destrói por raio, atira carros, pó e fogo */
  function blast(G, x, y, z, R, power, opt = {}) {
    buildsNear(G, x, z, R, (b, d) => {
      const f = 1 - d / R;
      damage(G, b, b.max * (opt.mult || 2.4) * Math.pow(f, 1.3) * power, [x, z], 'blast');
      if (opt.fire && f > .3 && Math.random() < f) ignite(G, b);
    });
    carsNear(G, x, z, R * 1.2, (c, d) => { const f = 1 - d / (R * 1.2), dx = c.x - x, dz = c.z - z, dd = d || 1; throwCar(G, c, dx / dd * 40 * f * power, 10 + 30 * f * power, dz / dd * 40 * f * power); });
    G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < R) { t.fall = rand(.8, 1.5); if (opt.fire) t.burnt = 1; G.treeDirty = 1; } });
    G.deb.forEach(d => { const dd = Math.hypot(d.x - x, d.z - z); if (dd < R * 1.3) { const f = 1 - dd / (R * 1.3); d.sleep = 0; d.vx += (d.x - x) / (dd || 1) * 30 * f; d.vz += (d.z - z) / (dd || 1) * 30 * f; d.vy += 18 * f; } });
    G.r3.flash.position.set(x, y + R * .5, z); G.r3.flash.intensity = Math.max(G.r3.flash.intensity, Math.min(4e4, R * R * .8)); G.r3.flash.distance = R * 6;
    G.stats.biggest = Math.max(G.stats.biggest, Math.round(R));
    G.shake = Math.max(G.shake, clamp(R / 30, 1, 10) * clamp(1 - Math.hypot(x - G.cam.x, z - G.cam.z) / 2500, .2, 1));
    G.panic.push({ x, z, r: R * 1.4, t: 6 });
  }
  function meteor(G, x, z, L, big) {
    const R = [10, 22, 40, 70, 130][L - 1] * (big ? 1 : .35);
    const from = [x + rand(-1, 1) * 800, 2200, z - 1200 + rand(-200, 200)];
    G.haz.push({ k: 'meteor', t: 0, life: big ? 2.6 : 1.8, x, z, R, from, big, L,
      step(G, dt) {
        const k = Math.min(1, this.t / this.life), px = lerp(this.from[0], this.x, k), pz = lerp(this.from[2], this.z, k), py = lerp(this.from[1], hAt(G, this.x, this.z), k * k * .3 + k * .7);
        const s = Math.max(3, this.R * .18);
        for (let i = 0; i < (this.big ? 6 : 2); i++) G.r3.fire.spawn({ x: px + rand(-s, s) * .3, y: py, z: pz + rand(-s, s) * .3, vx: rand(-4, 4), vy: rand(-2, 4), vz: rand(-4, 4), life: rand(.3, .8), s0: s * 2.2, s1: s * .6, c0: '#fff0c0', c1: '#ff5a10', k: 2.2 });
        if (this.big && Math.random() < .8) G.r3.smoke.spawn({ x: px, y: py, z: pz, vx: rand(-2, 2), vy: rand(-1, 2), vz: rand(-2, 2), life: rand(3, 6), s0: s * 1.5, s1: s * 5, c0: '#5a514a', c1: '#3a3633', a: .7, drag: .3, rotv: rand(-.4, .4) });
        if (this.t >= this.life) impact(G, this.x, this.z, this.R, this.big);
      } });
    G.panic.push({ x, z, r: R * 1.5, t: 4 });
  }
  function impact(G, x, z, R, big) {
    const y = hAt(G, x, z);
    blast(G, x, y, z, R * 3, 1, { fire: true });
    /* cratera */
    const cr = R * .9;
    forVerts(x, z, cr * 1.6, (k, d) => { const f = d / cr; G.h[k] += f < 1 ? -(1 - f * f) * cr * .35 : Math.max(0, 1 - (f - 1) / .6) * cr * .08; if (G.h0[k] > 2) G.h[k] = Math.max(G.h[k], .8); G.scorch[k] = Math.max(G.scorch[k], Math.max(0, 1 - f * .7)); });
    G.dirtyT = true;
    fireballFx(G, x, y + 4, z, R * .8);
    for (let i = 0; i < (big ? 50 : 10); i++) spawnDebris(G, x + rand(-R, R) * .3, y + 4, z + rand(-R, R) * .3, rand(2, 5) * (R > 60 ? 2 : 1), rand(-1, 1) * R * .9, rand(15, 40) + R * .3, rand(-1, 1) * R * .9, '#5a4a3a');
    shockRing(G, x, y + 3, z, R * 3);
    if (big) { G.r3.flashUI = Math.min(1, R / 90); sfx(G, 'boom', { x, z }, R); }
    else sfx(G, 'thud', { x, z });
  }
  function fireballFx(G, x, y, z, s) {
    const F = G.r3.fire, Sm = G.r3.smoke;
    for (let i = 0; i < 40 + s; i++) F.spawn({ x, y, z, vx: rand(-1, 1) * s, vy: rand(0, 1.4) * s, vz: rand(-1, 1) * s, life: rand(.5, 1.2), s0: s * .8, s1: s * 1.8, c0: '#fff2c4', c1: '#ff4a10', k: 2.2, drag: 2.5 });
    for (let i = 0; i < 20 + s * .6; i++) Sm.spawn({ x, y, z, vx: rand(-1, 1) * s * .4, vy: rand(.2, 1) * s * .5, vz: rand(-1, 1) * s * .4, life: rand(4, 8), s0: s * .7, s1: s * 2.4, c0: '#5c544c', c1: '#3c3834', a: .85, drag: .6, grav: -2, rotv: rand(-.3, .3) });
  }
  function shockRing(G, x, y, z, R) {
    for (let i = 0; i < 70; i++) { const a = i / 70 * TAU; G.r3.smoke.spawn({ x: x + Math.cos(a) * 4, y, z: z + Math.sin(a) * 4, vx: Math.cos(a) * R * .9, vy: 1, vz: Math.sin(a) * R * .9, life: 1.6, s0: R * .08, s1: R * .25, c0: '#c9bca8', c1: '#9a9080', a: .6, drag: 1.6 }); }
  }
  function dust(G, x, y, z, s, up) { if (G.budS <= 0) return; G.budS--; G.r3.smoke.spawn({ x, y, z, vx: rand(-1, 1) * s * .15, vy: rand(0, up), vz: rand(-1, 1) * s * .15, life: rand(4, 8), s0: s * .5, s1: s * 1.6, c0: '#b8ab98', c1: '#8e877c', a: .8, drag: .5, grav: -.6, rotv: rand(-.3, .3) }); }
  function smokeCol(G, x, y, z, s) { if (G.budS <= 0) return; G.budS--; G.r3.smoke.spawn({ x: x + rand(-3, 3), y, z: z + rand(-3, 3), vx: rand(2, 5), vy: rand(6, 12), vz: rand(-1, 1), life: rand(5, 9), s0: s * .35, s1: s * 2, c0: '#625a52', c1: '#7a736b', a: .5, drag: .2, grav: -.5, rotv: rand(-.2, .2) }); }
  function burstP(G, x, y, z, c, n) { for (let i = 0; i < n; i++) G.r3.fire.spawn({ x, y, z, vx: rand(-3, 3), vy: rand(2, 6), vz: rand(-3, 3), life: .5, s0: 2, s1: .4, c0: c, k: 1.4 }); }

  function showerHaz(G, x, z, L) {
    return { k: 'shower', t: 0, life: 6 + L * 2, acc: 0, step(G, dt) { this.acc += dt * (2 + L * 2.2); while (this.acc > 1) { this.acc--; const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (150 + L * 90); meteor(G, x + Math.cos(a) * r, z + Math.sin(a) * r, Math.min(5, Math.max(1, Math.round(rand(1, L)))), false); } } };
  }
  function stormHaz(G, x, z, L) {
    return { k: 'lightning', t: 0, life: 14 + L * 3, acc: 0, bolts: [],
      step(G, dt) {
        const fade = Math.min(1, this.t / 2, (this.life - this.t) / 2);
        for (let i = 0; i < 4; i++) G.r3.smoke.spawn({ x: x + rand(-1, 1) * (260 + L * 40), y: 640 + rand(-30, 60), z: z + rand(-1, 1) * (260 + L * 40), vx: rand(-4, 4), vy: rand(-1, 1), vz: rand(-4, 4), life: rand(5, 8), s0: 120, s1: 220, c0: '#4a4e58', c1: '#353840', a: .45 * fade, drag: .2, rotv: rand(-.1, .1) });
        this.acc += dt * (.8 + L * .9);
        while (this.acc > 1) {
          this.acc--;
          const bx = x + rand(-1, 1) * (180 + L * 40), bz = z + rand(-1, 1) * (180 + L * 40);
          let hit = null; buildsNear(G, bx, bz, 30, b => { if (!hit || b.h > hit.h) hit = b; });
          const tx = hit ? hit.x : bx, tz = hit ? hit.z : bz, ty = hit ? hit.y + hit.h : hAt(G, bx, bz);
          this.bolts.push({ x: tx, y: ty, z: tz, t: 0 });
          if (hit) { damage(G, hit, hit.max * (.15 + L * .06), [tx, tz]); if (Math.random() < .5 + L * .08) ignite(G, hit); }
          G.r3.flash.position.set(tx, ty + 60, tz); G.r3.flash.intensity = 1.8e4; G.r3.flash.distance = 700;
          G.r3.flashUI = Math.max(G.r3.flashUI || 0, .12);
          burstP(G, tx, ty, tz, '#cfe8ff', 14);
          sfx(G, 'thunder', { x: tx, z: tz });
        }
        if (G.fxFrame % 2 === 0) for (let i = 0; i < 6; i++) G.r3.smoke.spawn({ x: x + rand(-250, 250), y: 620, z: z + rand(-250, 250), vx: 0, vy: -150, vz: 0, life: 3.5, s0: .9, s1: .9, c0: '#9fb0c0', a: .4 });
        this.bolts = this.bolts.filter(b => (b.t += dt) < .35);
        G.boltsDraw = (G.boltsDraw || []).concat(this.bolts.map(b => ({ x: b.x, y: b.y, z: b.z, top: 640 })));
      },
      end() {} };
  }
  function rainHaz(G, x, z, L) {
    return { k: 'rain', t: 0, life: 12 + L * 4,
      step(G, dt) { const c = G.cam; for (let i = 0; i < 18; i++) G.r3.smoke.spawn({ x: c.tx + rand(-700, 700), y: 500, z: c.tz + rand(-700, 700), vx: -6, vy: -130, vz: 0, life: 3.8, s0: 1.2, s1: 1.2, c0: '#b8c8d8', a: .45 }); } };
  }
  function tornadoHaz(G, x, z, L) {
    const R = 16 + L * 9, g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#7d7466', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * (.35 + i * .2), R * (.25 + i * .19), 30, 20, 1, true), mat); m.position.y = 15 + i * 28; g.add(m); }
    G.r3.scene.add(g);
    const H = {
      k: 'tornado', t: 0, life: 18 + L * 5, x, z, a: rand(0, TAU), R, g, mat,
      near(d) { return Math.hypot(d.x - this.x, d.z - this.z) < this.R * 3; },
      pull(G, o, dt) {
        const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz);
        if (d > this.R * 3.2) return;
        const f = 1 - d / (this.R * 3.2);
        o.vx += (dx / (d || 1) * 30 + -dz / (d || 1) * 60) * f * dt; o.vz += (dz / (d || 1) * 30 + dx / (d || 1) * 60) * f * dt; o.vy += (24 + 20 * L * .2) * f * dt * 2.2;
        o.sleep = 0;
      },
      step(G, dt) {
        this.a += Math.sin(this.t * .7) * dt * .6; this.x += Math.cos(this.a) * (10 + L * 2) * dt; this.z += Math.sin(this.a) * (10 + L * 2) * dt;
        this.x = clamp(this.x, -1500, 1500); this.z = clamp(this.z, -1300, COAST + 100);
        const y = Math.max(0, hAt(G, this.x, this.z)), fade = Math.min(1, this.t / 2, (this.life - this.t) / 2);
        this.g.position.set(this.x, y, this.z); this.g.scale.set(fade, Math.max(.05, fade), fade); this.g.children.forEach((c, i) => { c.rotation.y += dt * (3 + i * .4); c.position.x = Math.sin(this.t * 2 + i) * i * 1.2; });
        for (let i = 0; i < 7; i++) { const a = rand(0, TAU), hh = rand(0, 260), r = this.R * (.4 + hh / 140); G.r3.smoke.spawn({ x: this.x + Math.cos(a) * r, y: y + hh, z: this.z + Math.sin(a) * r, vx: -Math.sin(a) * 40, vy: 8, vz: Math.cos(a) * 40, life: 1.4, s0: this.R * .5, s1: this.R * 1.1, c0: '#8a8072', a: .5 * fade }); }
        G.panic.push({ x: this.x, z: this.z, r: this.R * 3, t: .5 });
        buildsNear(G, this.x, this.z, this.R * 1.4, (b, d) => { damage(G, b, b.max * dt * (.25 + L * .12) * (1 - d / (this.R * 1.4)), [this.x, this.z]); if (Math.random() < dt * 4) spawnDebris(G, b.x, b.y + Math.min(b.h, 30) * Math.random(), b.z, rand(1, 3), rand(-10, 10), rand(5, 15), rand(-10, 10), b.col); });
        carsNear(G, this.x, this.z, this.R * 2.2, c => { if (!c.fly) throwCar(G, c, rand(-8, 8), rand(14, 26), rand(-8, 8)); });
        G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - this.x, t.z - this.z) < this.R * 1.6) { t.alive = false; G.treeDirty = 1; spawnDebris(G, t.x, hAt(G, t.x, t.z) + 4, t.z, 2, rand(-5, 5), 18, rand(-5, 5), '#4a3a2a'); } });
      },
      end(G) { G.r3.scene.remove(this.g); },
    };
    return H;
  }
  function quakeHaz(G, x, z, L) {
    const mag = 5 + L * .8, R = 140 + L * 170;
    say(G, `Sismo de magnitude ${mag.toFixed(1)}`, '', 2.5);
    /* fendas no chão a partir do epicentro */
    for (let k = 0; k < 2 + L; k++) { const a = rand(0, TAU), len = R * rand(.3, .7); fissure(G, x, z, x + Math.cos(a) * len, z + Math.sin(a) * len, Math.max(1, L - 2), true); }
    return { k: 'quake', t: 0, life: 5 + L * 1.6, x, z, R,
      step(G, dt) {
        const fade = Math.min(1, this.t, (this.life - this.t) / 1.5);
        G.shake = Math.max(G.shake, (1 + L * 1.4) * fade);
        G.panic.push({ x, z, r: R, t: .3 });
        buildsNear(G, x, z, R, (b, d) => {
          const f = 1 - d / R, tall = clamp(b.h / 80, .3, 1.8);
          b.sway = Math.sin(this.t * 9 + b.id) * f * tall * fade * L * .4;
          damage(G, b, b.max * dt * f * f * (.05 + L * L * .022) * tall * fade, [x, z]);
          if (!b.mesh && b.state === 'ok') syncB(G, b);
          if (Math.random() < dt * f * L * .3) dust(G, b.x + rand(-b.w / 2, b.w / 2), b.y + 2, b.z + rand(-b.d / 2, b.d / 2), 10, 3);
        });
        if (Math.random() < dt * 3) carsNear(G, x, z, R * .5, c => { if (Math.random() < .05 * L) throwCar(G, c, rand(-3, 3), rand(3, 8), rand(-3, 3)); });
      },
      end(G) { buildsNear(G, x, z, R, b => { b.sway = 0; if (b.state === 'ok') syncB(G, b); }); } };
  }
  function fissure(G, x, z, x2, z2, L, silent) {
    const len = Math.hypot(x2 - x, z2 - z) || 1, n = Math.ceil(len / 6), w = 6 + L * 4;
    let px = x, pz = z;
    for (let i = 0; i <= n; i++) {
      const t = i / n, jx = lerp(x, x2, t) + rand(-1, 1) * w * .4, jz = lerp(z, z2, t) + rand(-1, 1) * w * .4;
      forVerts(jx, jz, w, (k, d) => { const floor = G.h0[k] > 2 ? .8 : -30; G.h[k] = Math.max(floor, G.h[k] - (1 - d / w) * (4 + L * 3)); G.scorch[k] = Math.max(G.scorch[k], (1 - d / w) * .95); });
      buildsNear(G, jx, jz, w, b => damage(G, b, b.max * (.3 + L * .15), [px, pz]));
      carsNear(G, jx, jz, w * 1.2, c => throwCar(G, c, rand(-2, 2), 6, rand(-2, 2)));
      if (i % 3 === 0) dust(G, jx, hAt(G, jx, jz) + 2, jz, 12 + L * 3, 4);
      px = jx; pz = jz;
    }
    G.dirtyT = true;
    if (!silent) { G.shake = Math.max(G.shake, 2 + L); sfx(G, 'rumble', { x, z }); }
  }
  function volcanoHaz(G, L) {
    const top = [VOLC[0], hAt(G, VOLC[0], VOLC[1]) + 10, VOLC[1]];
    say(G, 'O vulcão acordou!', '', 3);
    sfx(G, 'rumble', { x: top[0], z: top[2] });
    const flows = [];
    return { k: 'volcano', t: 0, life: 35 + L * 10, acc: 0, bombs: 0, flows,
      step(G, dt) {
        const fade = Math.min(1, this.t / 3, (this.life - this.t) / 6);
        G.shake = Math.max(G.shake, .8 * fade);
        for (let i = 0; i < 3 + L; i++) G.r3.fire.spawn({ x: top[0] + rand(-20, 20), y: top[1], z: top[2] + rand(-20, 20), vx: rand(-25, 25), vy: rand(60, 110) * fade, vz: rand(-25, 25), life: rand(1.5, 3), s0: 14, s1: 6, c0: '#fff0b0', c1: '#ff3010', k: 2, grav: 30 });
        for (let i = 0; i < 2; i++) G.r3.smoke.spawn({ x: top[0] + rand(-30, 30), y: top[1] + 30, z: top[2] + rand(-30, 30), vx: rand(5, 18), vy: rand(40, 70), vz: rand(-8, 8), life: rand(12, 20), s0: 60, s1: 260, c0: '#2e2926', c1: '#4a4440', a: .85 * fade, drag: .15, grav: -1, rotv: rand(-.1, .1) });
        /* rios de lava a descer a encosta */
        this.acc += dt * (.6 + L * .5) * fade;
        while (this.acc > 1) { this.acc--; const a = rand(0, TAU); flows.push({ x: top[0] + Math.cos(a) * 40, z: top[2] + Math.sin(a) * 40, life: 25 + L * 6, v: 0 }); }
        for (let i = flows.length - 1; i >= 0; i--) {
          const f = flows[i]; f.life -= dt;
          const e = 6, gx = hAt(G, f.x + e, f.z) - hAt(G, f.x - e, f.z), gz = hAt(G, f.x, f.z + e) - hAt(G, f.x, f.z - e), gl = Math.hypot(gx, gz) || 1;
          f.v = lerp(f.v, clamp(gl * 2.2, 4, 28), dt);
          f.x -= gx / gl * f.v * dt + rand(-1, 1) * dt * 6; f.z -= gz / gl * f.v * dt + rand(-1, 1) * dt * 6;
          const fy = hAt(G, f.x, f.z);
          if (G.fxFrame % 2 === 0) G.r3.fire.spawn({ x: f.x, y: fy + 2, z: f.z, vx: rand(-2, 2), vy: rand(1, 4), vz: rand(-2, 2), life: rand(.8, 1.6), s0: 14, s1: 8, c0: '#ffb040', c1: '#c02008', k: 1.9 });
          forVerts(f.x, f.z, 22, (k, d) => { G.scorch[k] = Math.max(G.scorch[k], 1.5 + (1 - d / 22) * .6); });
          buildsNear(G, f.x, f.z, 18, b => { ignite(G, b); damage(G, b, b.max * dt * .25, [f.x, f.z]); });
          G.trees.forEach(t => { if (t.alive && !t.burnt && Math.abs(t.x - f.x) < 20 && Math.abs(t.z - f.z) < 20) { t.burnt = 1; G.treeDirty = 1; } });
          carsNear(G, f.x, f.z, 16, c => { c.wreck = 1; });
          G.panic.push({ x: f.x, z: f.z, r: 40, t: .3 });
          if (f.life <= 0 || fy < G.sea + .5) { if (fy < G.sea + .5) for (let k = 0; k < 6; k++) G.r3.smoke.spawn({ x: f.x, y: G.sea + 2, z: f.z, vx: rand(-3, 3), vy: rand(6, 14), vz: rand(-3, 3), life: 3, s0: 10, s1: 30, c0: '#e8ecef', a: .7 }); flows.splice(i, 1); }
        }
        if (G.fxFrame % 20 === 0) G.dirtyT = true;
        /* bombas de lava sobre a cidade */
        this.bombs += dt * (.3 + L * .35) * fade;
        while (this.bombs > 1) { this.bombs--; const tx = VOLC[0] + rand(200, 900) * (Math.random() < .7 ? 1 : .5), tz = VOLC[1] + rand(300, 1100); G.haz.push(bombHaz(G, top, tx, tz)); }
      },
      end(G) { G.scorch.forEach((v, k) => { if (v > 1.5) G.scorch[k] = 1; }); G.dirtyT = true; } };
  }
  function bombHaz(G, top, tx, tz) {
    const T = rand(4, 6);
    return { k: 'bomb', t: 0, life: T, step(G, dt) {
      const k = this.t / T, x = lerp(top[0], tx, k), z = lerp(top[2], tz, k), y = lerp(top[1], hAt(G, tx, tz), k) + Math.sin(k * Math.PI) * 500;
      G.r3.fire.spawn({ x, y, z, life: .5, s0: 10, s1: 3, c0: '#ffe0a0', c1: '#ff3010', k: 2 });
      if (Math.random() < .5) G.r3.smoke.spawn({ x, y, z, vx: 0, vy: 2, vz: 0, life: 3, s0: 6, s1: 18, c0: '#3a3430', a: .6 });
      if (this.t >= this.life) { blast(G, tx, hAt(G, tx, tz), tz, 34, .8, { fire: true }); fireballFx(G, tx, hAt(G, tx, tz) + 3, tz, 14); sfx(G, 'thud', { x: tx, z: tz }); }
    } };
  }
  function tsunamiHaz(G, x, L) {
    const H = [8, 16, 26, 40, 60][L - 1];
    /* a onda: uma faixa curva que avança do mar para norte */
    const geo = new THREE.PlaneGeometry(WS, 1, 120, 12); const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { const u = pos.getY(k) + .5; pos.setY(k, Math.sin(u * Math.PI) * (u < .6 ? 1 : 1.1) ); pos.setZ(k, -u * 1); }
    geo.rotateX(0);
    const mat = new THREE.MeshStandardMaterial({ color: '#2f7f92', roughness: .15, metalness: .1, transparent: true, opacity: .92, side: THREE.DoubleSide, envMap: G.r3.env });
    const wave = new THREE.Mesh(geo, mat); G.r3.scene.add(wave);
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), G.r3.water.material); G.r3.scene.add(flood);
    say(G, 'Tsunami!', `Onda de ${H} m a chegar da costa`, 3);
    sfx(G, 'wave', { x, z: COAST });
    return { k: 'tsunami', t: 0, life: 70, H, front: COAST + 900, wave, flood, fl: 0,
      step(G, dt) {
        const sp = 32 + L * 6;
        if (this.front > CZ0 - 300 && this.t < 40) this.front -= sp * dt;
        const inland = Math.max(0, COAST - this.front);
        const hgt = this.H * clamp((COAST + 900 - this.front) / 600, .2, 1) * Math.max(.12, 1 - inland / 1000) * (this.t < 40 ? 1 : Math.max(0, 1 - (this.t - 40) / 6));
        if (hgt < 3 && inland > 100 && this.t < 40) this.t = 40;
        this.wave.position.set(0, 0, this.front); this.wave.scale.set(1, hgt + 1, hgt * 2.6 + 10);
        this.wave.visible = hgt > 1;
        /* nível da água atrás da frente */
        const target = this.t < 40 ? hgt * .55 : Math.max(0, this.fl - dt * 1.2);
        this.fl = this.t < 40 ? lerp(this.fl, target, dt * .8) : target;
        this.flood.position.set(0, this.fl + .2, (this.front + COAST + 1600) / 2); this.flood.scale.set(WS, 1, Math.max(1, COAST + 1600 - this.front));
        this.flood.visible = this.fl > .5;
        /* espuma na crista */
        for (let i = 0; i < 16; i++) G.r3.smoke.spawn({ x: rand(-1500, 1500), y: hgt + 2, z: this.front + rand(-6, 6), vx: rand(-2, 2), vy: rand(2, 8), vz: -sp * .6, life: 1.6, s0: 10, s1: 26, c0: '#f4f8fa', a: .8, drag: .4 });
        G.panic.push({ x: G.cam.tx, z: this.front - 150, r: 260, t: .3 });
        /* a frente bate nos edifícios, carros e destroços */
        if (this.t < 40) {
          G.builds.forEach(b => { if (b.alive && b.state === 'ok' && Math.abs(b.z + b.d / 2 - this.front) < sp * dt * 1.5 + 3 && b.y < hgt) { const over = hgt / Math.max(4, b.h); damage(G, b, b.max * clamp(over * .9 + .15, .1, 1.6) * (b.mesh ? .2 : 1), [b.x, this.front + 50]); } });
          G.cars.forEach(c => { if (c.alive && Math.abs(c.z - this.front) < 25 && c.y < hgt) { c.fly = 0; c.wreck = 1; c.float = 1; c.carry = 1; } if (c.carry && c.wreck) { c.z -= sp * dt * .8; c.y = lerp(c.y, this.fl, dt * 2); c.rx = Math.sin(this.t + c.i) * .5; c.a += dt * .7; if (this.t > 40) c.carry = 0; } });
          G.deb.forEach(d => { if (Math.abs(d.z - this.front) < 40) { d.sleep = 0; d.vz -= sp * dt * 1.5; d.vy += 4 * dt; } });
          G.people.forEach(p => { if (p.alive && p.z > this.front - 60) p.alive = false; });
          G.r3.boats.forEach(bt => { if (Math.abs(bt.z - this.front) < 60 && !bt.surf) bt.surf = 1; if (bt.surf && this.t < 40) { bt.z = Math.min(bt.z, this.front + 20); bt.y = hgt * .8; bt.g.rotation.x = -.25; } });
        }
      },
      end(G) { G.r3.scene.remove(this.wave); G.r3.scene.remove(this.flood); this.wave.geometry.dispose(); this.wave.material.dispose(); G.r3.boats.forEach(bt => { bt.surf = 0; bt.g.rotation.x = 0; bt.y = Math.max(0, bt.y); }); } };
  }
  function floodHaz(G, L) {
    const H = [2, 5, 9, 14, 22][L - 1];
    say(G, 'O mar está a subir', `+${H} m`, 2.5);
    return { k: 'flood', t: 0, life: 40, H,
      step(G, dt) { const k = this.t < 12 ? this.t / 12 : this.t > 28 ? Math.max(0, (this.life - this.t) / 12) : 1; G.seaBase = this.H * sstep(0, 1, k); if (!G.haz.some(h => h.k === 'tsunami')) G.sea = G.seaBase; G.panic.push({ x: 0, z: COAST - 200, r: 200 + G.seaBase * 30, t: .3 }); },
      end(G) { G.seaBase = 0; G.sea = 0; } };
  }
  function fistHaz(G, x, z, L) {
    const R = 14 + L * 10, g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#f2d0a8', roughness: .55, metalness: .05, emissive: '#ffb36b', emissiveIntensity: .25, transparent: true, opacity: .92 });
    W().addMesh(g, new THREE.BoxGeometry(R * 1.6, R * 1.2, R * 1.3), m, 0, 0, 0);
    for (let i = 0; i < 4; i++) W().addMesh(g, new THREE.CylinderGeometry(R * .2, R * .2, R * .6, 10), m, -R * .6 + i * R * .4, -R * .55, R * .35, { rx: Math.PI / 2 });
    W().addMesh(g, new THREE.CylinderGeometry(R * .55, R * .6, R * 6, 14), m, 0, R * 3.5, 0);
    G.r3.scene.add(g);
    const y0 = hAt(G, x, z);
    return { k: 'fist', t: 0, life: 2.4, g, m, hit: false,
      step(G, dt) {
        const t = this.t, y = t < .9 ? lerp(y0 + 900, y0 + R * .7, sstep(0, .9, t) ** 2) : t < 1.3 ? y0 + R * .7 : lerp(y0 + R * .7, y0 + 900, sstep(1.3, 2.4, t));
        this.g.position.set(x, y, z); this.m.opacity = t > 1.6 ? Math.max(0, 1 - (t - 1.6) / .8) * .92 : .92;
        if (!this.hit && t >= .9) { this.hit = true; blast(G, x, y0, z, R * 2.2, 1.6, { mult: 2.2 }); forVerts(x, z, R * 1.2, (k, d) => { G.h[k] -= (1 - d / (R * 1.2)) * R * .25; }); G.dirtyT = true; shockRing(G, x, y0 + 2, z, R * 3); for (let i = 0; i < 6; i++) dust(G, x + rand(-R, R), y0 + 3, z + rand(-R, R), R * 1.2, 6); sfx(G, 'boom', { x, z }, R); }
      },
      end(G) { G.r3.scene.remove(this.g); } };
  }
  function laserHaz(G, x, z, x2, z2, L) {
    const w = 6 + L * 4, beam = new THREE.Mesh(new THREE.CylinderGeometry(w * .5, w * .7, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(w * .2, w * .25, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })); beam.add(core);
    G.r3.scene.add(beam);
    const len = Math.hypot(x2 - x, z2 - z), T = Math.max(1.2, len / (120 + L * 30));
    return { k: 'laser', t: 0, life: T + .6, beam,
      step(G, dt) {
        const k = Math.min(1, this.t / T), px = lerp(x, x2, k), pz = lerp(z, z2, k), py = hAt(G, px, pz);
        this.beam.position.set(px, py + 600, pz); this.beam.scale.set(1, 1200, 1); this.beam.material.opacity = this.t > T ? Math.max(0, 1 - (this.t - T) / .6) * .85 : .85;
        if (this.t <= T) {
          forVerts(px, pz, w * 1.4, (vk, d) => { G.h[vk] = Math.max(G.h0[vk] > 2 ? .8 : -30, G.h[vk] - dt * 30 * (1 - d / (w * 1.4))); G.scorch[vk] = Math.max(G.scorch[vk], 1.4); });
          buildsNear(G, px, pz, w * 1.3, b => { damage(G, b, b.max * dt * 3, [px, pz]); ignite(G, b); });
          carsNear(G, px, pz, w * 1.6, c => throwCar(G, c, rand(-10, 10), 25, rand(-10, 10)));
          for (let i = 0; i < 6; i++) G.r3.fire.spawn({ x: px + rand(-w, w), y: py + 1, z: pz + rand(-w, w), vx: rand(-14, 14), vy: rand(8, 26), vz: rand(-14, 14), life: rand(.3, .8), s0: 5, s1: 1, c0: '#fff4c2', c1: '#ff7a1a', k: 2.2, grav: 20 });
          if (Math.random() < .6) smokeCol(G, px, py + 4, pz, w * 2);
          G.panic.push({ x: px, z: pz, r: 60, t: .3 });
          if (G.fxFrame % 4 === 0) G.dirtyT = true;
        }
      },
      end(G) { G.r3.scene.remove(this.beam); G.dirtyT = true; } };
  }
  function holeHaz(G, x, z, L) {
    const y = hAt(G, x, z) + 70 + L * 15, R = 120 + L * 70;
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' }));
    const disk = new THREE.Mesh(new THREE.RingGeometry(1.3, 3.2, 64), new THREE.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    disk.rotation.x = Math.PI / 2 - .35; core.add(disk);
    core.position.set(x, y, z); G.r3.scene.add(core);
    sfx(G, 'hole', { x, z });
    return { k: 'blackhole', t: 0, life: 12 + L * 3, core, disk, R, eaten: 0,
      near(d) { return Math.hypot(d.x - x, d.z - z) < this.R; },
      pull(G, o, dt) {
        const dx = x - o.x, dy = y - o.y, dz = z - o.z, d = Math.hypot(dx, dy, dz);
        if (d > this.R * 1.3 || this.t > this.life - 1) return;
        const f = (1 - d / (this.R * 1.3)) * 140 * Math.min(1, this.t / 2);
        o.vx += dx / d * f * dt; o.vy += dy / d * f * dt + 20 * dt; o.vz += dz / d * f * dt;
        o.vx += -dz / d * f * .6 * dt; o.vz += dx / d * f * .6 * dt;
        o.sleep = 0;
        if (d < 10) { o.x = rand(-5000, 5000); o.y = -500; o.vx = o.vy = o.vz = 0; o.alive = o.alive === undefined ? undefined : false; this.eaten++; }
      },
      step(G, dt) {
        const grow = Math.min(1, this.t / 2) * (this.t > this.life - 1 ? Math.max(0, this.life - this.t) : 1), s = 6 + L * 3;
        this.core.scale.setScalar(s * grow + .01); this.disk.rotation.z += dt * 3;
        G.panic.push({ x, z, r: this.R, t: .3 });
        buildsNear(G, x, z, this.R * .7, (b, d) => { damage(G, b, b.max * dt * .6 * (1 - d / (this.R * .7)), [x, z]); if (Math.random() < dt * 6) spawnDebris(G, b.x + rand(-b.w / 2, b.w / 2), b.y + rand(0, b.h), b.z + rand(-b.d / 2, b.d / 2), rand(1.5, 4), 0, 6, 0, b.col); });
        carsNear(G, x, z, this.R * .9, c => { if (!c.fly) throwCar(G, c, 0, 8, 0); });
        G.trees.forEach(t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < this.R * .6) { t.alive = false; G.treeDirty = 1; spawnDebris(G, t.x, hAt(G, t.x, t.z) + 4, t.z, 2, 0, 10, 0, '#3e6b2a'); } });
        for (let i = 0; i < 6; i++) { const a = rand(0, TAU), r = rand(20, 60); G.r3.fire.spawn({ x: x + Math.cos(a) * r, y: y + rand(-4, 4), z: z + Math.sin(a) * r, vx: -Math.sin(a) * 60 - Math.cos(a) * 20, vy: 0, vz: Math.cos(a) * 60 - Math.sin(a) * 20, life: .7, s0: 4, s1: 1, c0: '#ffd08a', c1: '#ff4a10', k: 1.8 }); }
        if (this.t > this.life - 1 && !this.boom) { this.boom = 1; fireballFx(G, x, y, z, 40); G.r3.flashUI = .8; sfx(G, 'boom', { x, z }, 80); }
      },
      end(G) { G.r3.scene.remove(this.core); } };
  }

  /* restaurar a cidade */
  function restore(G) {
    G.haz.forEach(h => h.end && h.end(G)); G.haz = []; G.panic = []; G.fires.clear(); G.falling = [];
    G.h.set(G.h0); G.scorch.fill(0); refreshTerrain(G);
    G.builds.forEach(b => { b.alive = true; b.state = 'ok'; b.h = b.h0; b.hp = b.max; b.dmg = 0; b.part = 0; b.burn = 0; b.sink = 0; b.tilt = null; b.sway = 0; b.rise = 1; tintB(G, b, _col.set(b.col)); syncB(G, b); });
    G.deb.length = 0; G.r3.deb.count = 0;
    G.cars.forEach(c => { c.alive = true; c.fly = 0; c.wreck = 0; c.float = 0; c.carry = 0; c.rx = c.rz = 0; });
    G.people.forEach(p => { p.alive = true; p.run = 0; p.hid = 0; });
    G.trees.forEach(t => { t.alive = true; t.burnt = 0; t.tinted = 0; t.fall = 0; G.r3.trees.setColorAt(t.i, _col.set(t.wild ? '#3a6b2c' : '#4a8a36')); }); treesSync(G);
    G.r3.boats.forEach(bt => { bt.y = 0; bt.surf = 0; bt.g.rotation.x = 0; });
    G.sea = 0; G.seaBase = 0;
    say(G, 'Cidade restaurada', 'Tudo como novo — podes recomeçar.', 2.5);
    sfx(G, 'restore');
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.ok) return;
    G.fxFrame = (G.fxFrame || 0) + 1;
    camKeys(G, dt);
    if (G.paused) { uiTick(G); return; }
    dt = Math.min(dt, .05) * G.speed;
    G.time += dt;
    if (!G.falling) G.falling = [];
    G.boltsDraw = []; G.budD = G.big ? 90 : 45; G.budS = G.big ? 60 : 30;
    G.panic = G.panic.filter(p => (p.t -= dt) > 0);
    for (let i = G.haz.length - 1; i >= 0; i--) { const h = G.haz[i]; h.t += dt; h.step(G, dt); if (h.t >= h.life) { h.end && h.end(G); G.haz.splice(i, 1); } }
    fallStep(G, dt); fireStep(G, dt); debrisStep(G, dt); trafficStep(G, dt);
    G.r3.boats.forEach(bt => { if (!bt.surf) { bt.a += dt * .03; bt.x += Math.cos(bt.a) * bt.v * dt; bt.z += Math.sin(bt.a) * bt.v * dt; bt.y = lerp(bt.y, Math.max(G.sea, 0), dt); } bt.g.position.set(bt.x, bt.y + Math.sin(G.t + bt.x) * .4, bt.z); bt.g.rotation.y = -bt.a + Math.PI / 2; });
    if (G.treeDirty && G.fxFrame % 4 === 0) { G.treeDirty = 0; treesSync(G); }
    if (G.dirtyT && G.fxFrame % 4 === 0) refreshTerrain(G);
    G.r3.smoke.update(dt); G.r3.fire.update(dt);
    G.r3.flash.intensity *= Math.max(0, 1 - dt * 6);
    G.shake = Math.max(0, G.shake - dt * 3);
    if (G.r3.flashUI) G.r3.flashUI = Math.max(0, G.r3.flashUI - dt * 1.5);
    /* reconstrução animada */
    G.builds.forEach(b => { if (b.rise) { b.rise = Math.max(0, b.rise - dt * .8); if (b.rise > 0 && !b.mesh) { b.sink = b.rise * b.h; syncB(G, b); } else if (b.rise === 0) { b.sink = 0; syncB(G, b); b.rise = 0; } } });
    G.msg.forEach(m => { m.life -= dt; }); G.msg = G.msg.filter(m => m.life > 0);
    uiTick(G);
  }
  function camKeys(G, dt) {
    const k = G.keys, c = G.cam, sp = c.dist * 1.1 * dt;
    let mx = 0, mz = 0;
    if (k.KeyW || k.ArrowUp) mz -= 1; if (k.KeyS || k.ArrowDown) mz += 1; if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyQ) c.yaw += dt * 1.2; if (k.KeyE) c.yaw -= dt * 1.2;
    if (k.KeyR) c.pitch = clamp(c.pitch + dt * .6, .12, 1.45); if (k.KeyF) c.pitch = clamp(c.pitch - dt * .6, .12, 1.45);
    if (mx || mz) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); c.tx += (mx * co + mz * s) * sp; c.tz += (-mx * s + mz * co) * sp; G.cine = false; }
    if (G.cine) { c.yaw += dt * .08; c.tdist = lerp(c.tdist, 1300 + Math.sin(G.t * .1) * 400, dt * .2); c.pitch = lerp(c.pitch, .35 + Math.sin(G.t * .07) * .12, dt * .3); }
    c.tx = clamp(c.tx, -1700, 1700); c.tz = clamp(c.tz, -1700, 1500);
    c.dist = lerp(c.dist, c.tdist, Math.min(1, dt * 5)); c.x = lerp(c.x, c.tx, Math.min(1, dt * 6)); c.z = lerp(c.z, c.tz, Math.min(1, dt * 6));
  }

  /* ════════════════════════════════════════════════════════════════
     desenho
  ════════════════════════════════════════════════════════════════ */
  function draw(G, ctx, Wl, Hl, api) {
    const k = pxK(api);
    if (!G.ok) {
      ctx.save(); ctx.scale(k, k); const w = Wl / k, h = Hl / k;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a1a12'); g.addColorStop(1, '#5a2a14'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = "700 16px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText(G.fail3d ? 'Não foi possível arrancar o 3D' : 'A construir a cidade…', w / 2, h / 2);
      if (G.fail3d) { ctx.font = "500 13px 'Space Grotesk', system-ui"; ctx.fillStyle = '#ffd9b0'; ctx.fillText(G.failMsg || 'Este jogo precisa de WebGL (3D).', w / 2, h / 2 + 26); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('Se o erro persistir, recarrega a página com Ctrl+Shift+R.', w / 2, h / 2 + 46); }
      ctx.restore(); return;
    }
    const r3 = G.r3, cam = r3.cam, c = G.cam;
    fit(G, api);
    const gy = Math.max(4, hAt(G, c.x, c.z)), sh = G.shake;
    cam.position.set(c.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist + rand(-sh, sh), gy + Math.sin(c.pitch) * c.dist + rand(-sh, sh), c.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist + rand(-sh, sh));
    const cmin = Math.max(G.sea, hAt(G, cam.position.x, cam.position.z)) + 8; if (cam.position.y < cmin) cam.position.y = cmin;
    cam.lookAt(c.x, gy + c.dist * .04, c.z); cam.updateMatrixWorld();
    r3.skyM.position.copy(cam.position); r3.skyM.material.uniforms.uTime.value = G.t;
    r3.water.position.y = G.sea;
    const nm = r3.water.material.normalMap; nm.offset.x = (G.t * .005) % 1; nm.offset.y = (G.t * .003) % 1;
    /* sombra acompanha a vista */
    const ext = clamp(c.dist * .7, 200, 1400);
    r3.sun.position.set(c.x + r3.sunDir.x * 2500, r3.sunDir.y * 2500 + 50, c.z + r3.sunDir.z * 2500); r3.sun.target.position.set(c.x, 0, c.z);
    const scm = r3.sun.shadow.camera; scm.left = -ext; scm.right = ext; scm.top = ext; scm.bottom = -ext; scm.near = 100; scm.far = 6000; scm.updateProjectionMatrix();
    if (G.fxFrame % 20 === 0) r3.clouds.sort(cam);
    drawBolts(G);
    const ppu = r3.renderer.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360));
    r3.smoke.mat.uniforms.uScale.value = ppu; r3.fire.mat.uniforms.uScale.value = ppu;
    r3.renderer.render(r3.scene, cam);
    hud(G, ctx, Wl, Hl, api);
  }
  function fit(G, api) {
    const r3 = G.r3, st = api.stage, w = st.clientWidth || 1, h = st.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, r3.coarse ? 1.4 : 1.8);
    if (w !== r3.w || h !== r3.h || dpr !== r3.dpr) { r3.w = w; r3.h = h; r3.dpr = dpr; r3.renderer.setPixelRatio(dpr); r3.renderer.setSize(w, h, false); r3.cam.aspect = w / h; r3.cam.updateProjectionMatrix(); }
  }
  function drawBolts(G) {
    const r3 = G.r3;
    (r3.bl || []).forEach(l => { r3.scene.remove(l); l.geometry.dispose(); }); r3.bl = [];
    (G.boltsDraw || []).forEach(b => {
      const pts = []; let x = b.x + rand(-60, 60), z = b.z + rand(-60, 60);
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(lerp(x, b.x, t) + rand(-12, 12) * (1 - t), lerp(b.top, b.y, t), lerp(z, b.z, t) + rand(-12, 12) * (1 - t))); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), r3.blm || (r3.blm = new THREE.LineBasicMaterial({ color: '#eef8ff', toneMapped: false })));
      r3.scene.add(l); r3.bl.push(l);
    });
  }
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  function hud(G, ctx, Wl, Hl, api) {
    const k = pxK(api); ctx.save(); ctx.scale(k, k); const w = Wl / k, h = Hl / k;
    if (G.r3.flashUI > 0) { ctx.fillStyle = `rgba(255,248,230,${G.r3.flashUI * .8})`; ctx.fillRect(0, 0, w, h); }
    /* alvo do poder */
    if (G.ptr.ok && !G.ptr.overUi) {
      const v = new THREE.Vector3(G.ptr.wx, hAt(G, G.ptr.wx, G.ptr.wz) + 2, G.ptr.wz).project(G.r3.cam);
      if (v.z < 1) {
        const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, P = POW.find(p => p.id === G.pow);
        ctx.strokeStyle = 'rgba(255,190,120,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x - 8, y); ctx.moveTo(x + 8, y); ctx.lineTo(x + 22, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 8); ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 22); ctx.stroke();
        ctx.font = `700 11px ${FONT}`; ctx.fillStyle = '#ffd9b0'; ctx.textAlign = 'center'; ctx.fillText(`${P.name} · ${G.lvl}`, x, y + 36);
      }
      if (G.drag) {
        const a = new THREE.Vector3(G.drag.x, hAt(G, G.drag.x, G.drag.z) + 2, G.drag.z).project(G.r3.cam), b = new THREE.Vector3(G.ptr.wx, hAt(G, G.ptr.wx, G.ptr.wz) + 2, G.ptr.wz).project(G.r3.cam);
        ctx.strokeStyle = '#ffb36b'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo((a.x + 1) / 2 * w, (1 - a.y) / 2 * h); ctx.lineTo((b.x + 1) / 2 * w, (1 - b.y) / 2 * h); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    /* mensagens */
    G.msg.slice(-2).forEach((m, i) => {
      ctx.globalAlpha = Math.min(1, m.life * 2); ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
      ctx.font = `800 ${w < 600 ? 18 : 24}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(m.t, w / 2, h * .2 + i * 50);
      if (m.s) { ctx.font = `600 13px ${FONT}`; ctx.fillStyle = '#ffe2c4'; ctx.fillText(m.s, w / 2, h * .2 + i * 50 + 22); }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    });
    ctx.restore();
  }
  function say(G, t, s, life) { G.msg = G.msg || []; G.msg.push({ t, s, life: life || 2 }); if (G.msg.length > 3) G.msg.shift(); }

  /* ════════════════════════════════════════════════════════════════
     interface em DOM (paleta de poderes, intensidade, tempo, números)
  ════════════════════════════════════════════════════════════════ */
  function buildUI(G, api) {
    const st = api.stage;
    const ui = document.createElement('div'); ui.className = 'fw-ui';
    ui.innerHTML = `<style>
.fw-ui{position:absolute;inset:0;pointer-events:none;z-index:3;font-family:'Space Grotesk',system-ui,sans-serif;color:#fff}
.fw-ui>*{pointer-events:auto}
.fw-pal{position:absolute;left:10px;top:64px;bottom:76px;width:184px;overflow-y:auto;scrollbar-width:thin;display:flex;flex-direction:column;gap:3px;padding:8px;border-radius:16px;background:rgba(14,10,8,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08)}
.fw-g{font:800 .6rem 'Space Grotesk';letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin:6px 4px 2px}
.fw-b{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#fff;font:600 .8rem 'Space Grotesk';text-align:left;padding:6px 8px;border-radius:10px;cursor:pointer}
.fw-b:hover{background:rgba(255,255,255,.08)}.fw-b.on{background:linear-gradient(135deg,#ff7a3a,#d6452a);box-shadow:0 4px 14px rgba(255,90,40,.35)}
.fw-b span{font-size:1.1rem;width:22px;text-align:center}
.fw-bot{position:absolute;left:204px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;border-radius:16px;background:rgba(14,10,8,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08)}
.fw-lv{display:flex;align-items:center;gap:6px;font:700 .75rem 'Space Grotesk'}
.fw-lv button{width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font:800 .85rem 'Space Grotesk';cursor:pointer}
.fw-lv button.on{background:#ff7a3a;border-color:#ff7a3a}
.fw-sp{flex:1}
.fw-t{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:6px 10px;font:700 .75rem 'Space Grotesk';cursor:pointer;white-space:nowrap}
.fw-t:hover{border-color:#ff9a5a}.fw-t.on{background:rgba(255,122,58,.3);border-color:#ff7a3a}
.fw-st{position:absolute;right:10px;top:64px;padding:10px 12px;border-radius:14px;background:rgba(14,10,8,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:600 .74rem 'Space Grotesk';display:grid;grid-template-columns:auto auto;gap:3px 12px;min-width:170px}
.fw-st b{text-align:right;font-weight:800}
.fw-tip{position:absolute;left:204px;bottom:66px;font:600 .74rem 'Space Grotesk';color:#ffe2c4;text-shadow:0 1px 4px rgba(0,0,0,.7);pointer-events:none}
.fw-ui.compact .fw-pal{width:62px;top:58px;bottom:116px;padding:5px}.fw-ui.compact .fw-b{padding:6px;justify-content:center}.fw-ui.compact .fw-b em,.fw-ui.compact .fw-g{display:none}.fw-ui.compact .fw-bot{left:80px;bottom:8px;gap:5px;padding:6px}.fw-ui.compact .fw-st{top:58px;font-size:.66rem;min-width:0;padding:7px 9px}.fw-ui.compact .fw-tip{left:80px;bottom:104px;right:10px}.fw-ui.compact .fw-t{padding:5px 7px;font-size:.68rem}
</style>
<div class="fw-pal" role="toolbar" aria-label="Poderes">${['Céu', 'Terra', 'Água', 'Divino'].map(g => `<div class="fw-g">${g}</div>${POW.filter(p => p.g === g).map(p => `<button class="fw-b${p.id === G.pow ? ' on' : ''}" data-p="${p.id}" title="${p.desc}"><span>${p.ic}</span><em style="font-style:normal">${p.name}</em></button>`).join('')}`).join('')}</div>
<div class="fw-tip"></div>
<div class="fw-bot">
  <div class="fw-lv">Intensidade ${[1, 2, 3, 4, 5].map(n => `<button data-l="${n}" class="${n === G.lvl ? 'on' : ''}">${n}</button>`).join('')}</div>
  <span class="fw-sp"></span>
  <button class="fw-t" data-a="pause">⏸ Pausa</button>
  <button class="fw-t" data-a="slow">🐢 Câmara lenta</button>
  <button class="fw-t" data-a="tod">🌗 Hora do dia</button>
  <button class="fw-t" data-a="cine">🎥 Cinema</button>
  <button class="fw-t" data-a="restore">♻️ Restaurar</button>
</div>
<div class="fw-st"></div>`;
    st.appendChild(ui); G.ui = ui;
    const tip = ui.querySelector('.fw-tip');
    const setTip = () => { const P = POW.find(p => p.id === G.pow); tip.textContent = `${P.ic} ${P.name} — ${P.desc}${P.drag ? '' : ' Clica no mapa.'}`; };
    setTip();
    ui.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { G.pow = b.dataset.p; ui.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b)); setTip(); sfx(G, 'ui'); }));
    ui.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => { G.lvl = +b.dataset.l; ui.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('on', x === b)); sfx(G, 'ui'); }));
    ui.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a; sfx(G, 'ui');
      if (a === 'pause') { G.paused = !G.paused; b.classList.toggle('on', G.paused); b.textContent = G.paused ? '▶ Continuar' : '⏸ Pausa'; }
      else if (a === 'slow') { G.speed = G.speed === 1 ? .25 : 1; b.classList.toggle('on', G.speed < 1); }
      else if (a === 'tod') { setTod(G, (G.tod + 1) % TODS.length); }
      else if (a === 'cine') { G.cine = !G.cine; b.classList.toggle('on', G.cine); }
      else if (a === 'restore') restore(G);
    }));
    ui.querySelectorAll('button').forEach(b => { b.addEventListener('pointerenter', () => { G.ptr.overUi = true; }); b.addEventListener('pointerleave', () => { G.ptr.overUi = false; }); });
    ui.querySelector('.fw-pal').addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  }
  function uiTick(G) {
    if (!G.ui || G.fxFrame % 10) return;
    const st = G.api.stage; G.ui.classList.toggle('compact', st.clientWidth < 760 || st.clientHeight < 540);
    const s = G.stats, fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' mil M€' : n >= 1e6 ? (n / 1e6).toFixed(0) + ' M€' : n + ' €';
    const total = G.builds.length, up = G.builds.filter(b => b.alive).length;
    G.ui.querySelector('.fw-st').innerHTML = `<span>Edifícios de pé</span><b>${Math.round(up / total * 100)}%</b><span>Destruídos</span><b>${s.destroyed}</b><span>Danos</span><b>${fmt(s.damage)}</b><span>Carros arrastados</span><b>${s.cars}</b><span>Incêndios ativos</span><b>${G.fires.size}</b><span>Pessoas em fuga</span><b>${G.people.filter(p => p.run).length}</b>`;
  }

  /* ════════════════════════════════════════════════════════════════
     entrada
  ════════════════════════════════════════════════════════════════ */
  function pickGround(G, cx, cy, api) {
    const k = pxK(api), w = api.W / k, h = api.H / k, cam = G.r3.cam;
    const v = new THREE.Vector3((cx / w) * 2 - 1, -(cy / h) * 2 + 1, .5).unproject(cam).sub(cam.position).normalize(), o = cam.position;
    let t = 0, prev = 0, step = 6;
    for (let i = 0; i < 1500; i++) { t += step; step *= 1.004; const x = o.x + v.x * t, y = o.y + v.y * t, z = o.z + v.z * t; if (y < Math.max(hAt(G, x, z), G.sea)) { let a = prev, b = t; for (let k2 = 0; k2 < 14; k2++) { const m = (a + b) / 2; if (o.y + v.y * m < Math.max(hAt(G, o.x + v.x * m, o.z + v.z * m), G.sea)) b = m; else a = m; } return [o.x + v.x * b, o.z + v.z * b]; } prev = t; }
    return null;
  }
  function down(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    G.tp = G.tp || new Map();
    if (e && e.pointerType === 'mouse' && e.button !== 0) { G.orbit = { cx, cy, yaw: G.cam.yaw, pitch: G.cam.pitch }; return; }
    G.tp.set(id, { x: cx, y: cy, x0: cx, y0: cy, t: performance.now() });
    if (G.tp.size === 2) { const [a, b] = [...G.tp.values()]; G.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), dist: G.cam.tdist, yaw: G.cam.yaw }; G.drag = null; return; }
    const P = POW.find(p => p.id === G.pow);
    const gp = pickGround(G, cx, cy, api);
    if (P.drag && gp) G.drag = { x: gp[0], z: gp[1] };
  }
  function move(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    if (!(e && e.pointerType !== 'mouse' && !G.tp.size)) { const gp = pickGround(G, cx, cy, api); G.ptr.ok = !!gp; if (gp) { G.ptr.wx = gp[0]; G.ptr.wz = gp[1]; } }
    if (G.orbit) { G.cam.yaw = G.orbit.yaw - (cx - G.orbit.cx) * .006; G.cam.pitch = clamp(G.orbit.pitch + (cy - G.orbit.cy) * .004, .12, 1.45); G.cine = false; return; }
    const t = G.tp && G.tp.get(id); if (!t) return;
    const dx = cx - t.x, dy = cy - t.y; t.x = cx; t.y = cy;
    if (G.tp.size >= 2 && G.pinch) { const [a, b] = [...G.tp.values()], d = Math.hypot(a.x - b.x, a.y - b.y), an = Math.atan2(b.y - a.y, b.x - a.x); G.cam.tdist = clamp(G.pinch.dist * G.pinch.d / Math.max(20, d), 120, 3200); G.cam.yaw = G.pinch.yaw - (an - G.pinch.a); t.moved = true; return; }
    if (Math.hypot(cx - t.x0, cy - t.y0) > 10) t.moved = true;
    const P = POW.find(p => p.id === G.pow);
    if (t.moved && !P.drag) { const s = G.cam.dist * .0016, sn = Math.sin(G.cam.yaw), co = Math.cos(G.cam.yaw); G.cam.tx -= (dx * co + dy * sn) * s; G.cam.tz -= (-dx * sn + dy * co) * s; G.cine = false; }
  }
  function up(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    if (G.orbit && (!e || e.pointerType !== 'mouse' || e.button !== 0)) { G.orbit = null; return; }
    const t = G.tp && G.tp.get(id); if (G.tp) G.tp.delete(id);
    if (G.tp && G.tp.size < 2) G.pinch = null;
    if (!t) return;
    const P = POW.find(p => p.id === G.pow), gp = pickGround(G, cx, cy, api);
    if (P.drag) { if (G.drag && gp) usePower(G, G.drag.x, G.drag.z, gp[0], gp[1]); G.drag = null; return; }
    if (t.moved || !gp) return;
    usePower(G, gp[0], gp[1]);
  }
  function key(G, e) {
    const c = e.code || ''; G.keys[c] = true;
    if (!e.repeat) {
      if (c.startsWith('Digit')) { const n = +c.slice(5); if (n >= 1 && n <= 5) { G.lvl = n; G.ui && G.ui.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('on', +x.dataset.l === n)); } }
      if (c === 'KeyT') setTod(G, (G.tod + 1) % TODS.length);
      if (c === 'KeyC') { G.cine = !G.cine; }
      if (c === 'Backspace') restore(G);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(c)) return true;
  }
  function keyup(G, e) { if (!e.code) { G.keys = {}; return; } G.keys[e.code] = false; }

  /* ════════════════════════════════════════════════════════════════
     som
  ════════════════════════════════════════════════════════════════ */
  function sfx(G, k, at, size) {
    const s = G.api.sfx; let v = 1;
    if (at) { const d = Math.hypot(at.x - G.cam.x, at.z - G.cam.z); v = clamp(1 - d / (G.cam.dist * 3 + 800), .05, 1); }
    if (k === 'ui') s.tone(620, .04, 'triangle', .025);
    else if (k === 'cast') s.tone(240, .25, 'sine', .04, 0, 120);
    else if (k === 'boom') { const sz = Math.min(1.5, (size || 40) / 60); s.noise(1.6 + sz, .18 * v, 0, 260, 'lowpass'); s.tone(55, 1.4, 'sine', .14 * v * sz, 0, 25); }
    else if (k === 'thud') s.noise(.6, .07 * v, 0, 380, 'lowpass');
    else if (k === 'collapse') { s.noise(2.6, .1 * v, 0, 240, 'lowpass'); s.noise(1.6, .05 * v, .2, 1200); }
    else if (k === 'crumble') s.noise(1, .05 * v, 0, 700, 'lowpass');
    else if (k === 'thunder') { s.noise(1.4, .12 * v, 0, 380, 'lowpass'); s.tone(60, .9, 'sine', .06 * v, 0, 30); }
    else if (k === 'rumble') s.noise(3, .1 * v, 0, 140, 'lowpass');
    else if (k === 'wave') s.noise(4, .1 * v, 0, 420, 'lowpass');
    else if (k === 'hole') s.tone(90, 3, 'sawtooth', .04, 0, 30);
    else if (k === 'restore') s.arp([392, 523, 659, 784], .09, .22, 'triangle', .05);
  }

  /* ════════════════════════════════════════════════════════════════
     registo no kit
  ════════════════════════════════════════════════════════════════ */
  const picker = {
    html() {
      const coarse = (typeof Arcade3D !== 'undefined' && Arcade3D.coarse()) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
      return `<style>
.fw-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.fw-c{position:relative;border:0;border-radius:18px;padding:18px 16px;min-height:140px;color:#fff;font:inherit;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s}
.fw-c:hover{transform:translateY(-3px)}.fw-c small{display:block;font:700 .66rem 'Space Grotesk';letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.fw-c b{display:block;font:800 1.15rem 'Space Grotesk';margin:3px 0 6px}.fw-c p{margin:0;font-size:.8rem;line-height:1.35;opacity:.92}
</style><div class="fw-m">
  <button class="fw-c" data-m="big" style="background:linear-gradient(150deg,#ff8a3a,#5a1e10)"><small>Recomendado em computador</small><b>☄️ Cidade grande</b><p>~1900 edifícios, 900 carros e 2600 pessoas. Cheio de pormenor para ver tudo a acontecer.</p></button>
  <button class="fw-c" data-m="lite" style="background:linear-gradient(150deg,#3a8aff,#10225a)"><small>${coarse ? 'Recomendado neste aparelho' : 'Para máquinas mais modestas'}</small><b>🏙️ Cidade leve</b><p>A mesma cidade, com menos trânsito, gente e destroços — corre bem em telemóveis e portáteis.</p></button>
</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => start(b.dataset.m))); },
  };
  const spec = {
    id: ID, title: 'Fúria Divina', icon: '☄️', accent: '#ff7a3a', accent2: '#ffd34d', bg: '#2a1a12', aspect: 'wide', transparent: true, diff: false,
    tagline: 'Um sandbox para descarregar o stress: uma cidade enorme e 15 poderes divinos. Sem objetivos, sem derrotas — só causa e efeito.',
    view: { w: 960 }, picker, cursor: 'crosshair',
    ready: { title: 'A cidade é tua', hint: 'Escolhe um poder, a intensidade (1–5) e clica no mapa. Arrasta para mover a câmara, roda do rato para aproximar, botão direito para rodar.' },
    how: [
      'Escolhe um <b>poder</b> na paleta da esquerda e a <b>intensidade</b> (1–5 ou teclas 1–5) e <b>clica</b> na cidade. A Fenda e o Raio de luz fazem-se a <b>arrastar</b>.',
      '<b>Arrasta</b> (ou WASD) para mover a câmara, <b>roda do rato</b> para aproximar, <b>botão direito</b> (ou Q/E, R/F) para rodar e inclinar. No telemóvel: um dedo move, dois aproximam e rodam.',
      'Usa a <b>câmara lenta</b>, muda a <b>hora do dia</b> (T) para ver a cidade à noite, liga o modo <b>cinema</b> (C) e, quando quiseres, <b>restaura</b> a cidade (⌫) e recomeça.',
    ],
    controls: ['🖱️ clique = poder · arrastar = mover', '🖱️ direito = rodar · roda = zoom', '⌨️ 1–5 · WASD · T · C · ⌫'],
    setup: (api, o) => { const G = setup(api, o); const wait = () => { if (G.ok) { buildUI(G, api); wireWheel(G, api); } else if (!G.fail3d && !G.dead) setTimeout(wait, 100); }; wait(); return G; },
    update, draw, down, move, up, key, keyup,
    destroy: G => { G.dead = 1; if (G._wheel) G._wheel(); if (G.ui) G.ui.remove(); if (G.r3) { G.haz.forEach(h => h.end && h.end(G)); G.r3.renderer.toneMappingExposure = 1.08; Arcade3D.disposeOwn(G.r3.scene); G.r3.env && G.r3.env.dispose(); Arcade3D.detach(); G.r3 = null; } },
    hud: G => [['Destruídos', G.stats.destroyed], ['Danos', G.stats.damage >= 1e9 ? (G.stats.damage / 1e9).toFixed(1) + ' mM€' : Math.round(G.stats.damage / 1e6) + ' M€'], ['Poder', (POW.find(p => p.id === G.pow) || {}).name || '']],
    pauseButtons: (G, api) => [{ label: 'Ecrã inteiro', fn: () => { full(api); api.resume(); } }, { label: 'Terminar e ver o resumo', fn: () => summary(G, api) }],
    achievements: [
      { id: 'wrath.100', name: 'Mão Pesada', icon: '☄️', desc: 'Derruba 100 edifícios numa sessão da Fúria Divina.', test: c => (c.result.score || 0) >= 100 },
      { id: 'wrath.1000', name: 'Apocalipse', icon: '🌋', desc: 'Derruba 1000 edifícios numa sessão da Fúria Divina.', test: c => (c.result.score || 0) >= 1000 },
    ],
  };
  function full(api) { try { if (document.fullscreenElement) document.exitFullscreen(); else api.stage.requestFullscreen && api.stage.requestFullscreen().catch(() => {}); } catch (e) {} }
  function summary(G, api) {
    const s = G.stats;
    try { GameProgress.record(ID, { won: true, score: s.destroyed, mode: 'sandbox', meta: {} }); } catch (e) {}
    api.panel({ icon: '☄️', title: 'Fim da sessão', big: s.destroyed, sub: 'edifícios derrubados',
      stats: [['Danos', s.damage >= 1e9 ? (s.damage / 1e9).toFixed(1) + ' mil M€' : Math.round(s.damage / 1e6) + ' M€'], ['Carros arrastados', s.cars], ['Incêndios', s.fires], ['Sismos', s.quakes]],
      buttons: [{ label: '↺ Cidade nova', primary: true, fn: () => api.restart() }, { label: 'Menu', fn: () => api.menu() }] });
  }
  function wireWheel(G, api) {
    const st = api.stage; if (!st) return;
    const fn = e => { if (!G.ok || (G.ui && G.ui.querySelector('.fw-pal').contains(e.target))) return; e.preventDefault(); G.cam.tdist = clamp(G.cam.tdist * (e.deltaY > 0 ? 1.12 : .89), 120, 3200); G.cine = false; };
    st.addEventListener('wheel', fn, { passive: false });
    G._wheel = () => st.removeEventListener('wheel', fn);
  }
  const KIT = ArcadeKit.create(spec);
  KIT._dbg = { usePower, restore, POW, setTod };
  return KIT;
})();
