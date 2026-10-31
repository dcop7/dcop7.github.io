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

  /* mundo: o tamanho depende do modo (cidade ou região com aldeias) */
  let WS = 4800, TN = 210, TC = WS / TN, T0 = -WS / 2;
  const ROAD = 14, COAST = 1000;
  const CX0 = -1500, CX1 = 1500, CZ0 = -1150, CZ1 = 920;
  const VOLC = [-950, -1850], VOLC_H = 560;
  const RIVER_W = 84, riverX = z => 140 + Math.sin(z / 430) * 210 + Math.sin(z / 170 + 1.3) * 40;
  const HILL = [-720, -400, 330, 80];
  const AIRPORT = { x: -2020, z0: -650, z1: 850, w: 64 };
  const VILLAGES = [[-3000, -700], [2900, -500], [-2400, -2300], [2100, -2500], [400, -2900], [-3300, 600], [3300, 500]];
  function setWorld(region) { WS = region ? 8400 : 4800; TN = region ? 300 : 210; TC = WS / TN; T0 = -WS / 2; }

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
    { name: 'casario', walls: ['#f3c9a8', '#f7e2a2', '#a8d4e2', '#f2b8b5', '#d9e8c3', '#fdfaf2', '#e8c6e0', '#f5d0a0'], glass: '#3b4a56', mix: .82, win: [2.6, 3.1], roof: '#b5532f', rough: .85, metal: 0 },
    { name: 'industrial', walls: ['#9aa1a6', '#8b9196', '#b0a99a', '#7f8a8f'], glass: '#4a5a66', mix: .35, win: [7, 5], roof: '#5d6266', rough: .7, metal: .25 },
    { name: 'vidro escuro', walls: ['#1f2a33', '#26323b', '#2b2f3a'], glass: '#2d4c5e', mix: .95, win: [2.6, 3.8], roof: '#2a2d30', rough: .25, metal: .4 },
  ];

  /* ════════════════════════════════════════════════════════════════
     terreno: cidade plana com uma colina e um rio, praia a sul,
     montanhas e vulcão a norte; no modo Região, campo ondulado e aldeias
  ════════════════════════════════════════════════════════════════ */
  function heightFn(seed, region) {
    const Wd = W(), n1 = Wd.perlin(seed), n2 = Wd.perlin(seed + 3), n3 = Wd.perlin(seed + 9);
    const base = (x, z) => {
      const coast = COAST + n1(x / 520, 3.3) * 60 + n2(x / 160, 9) * 14;
      let h = 4 + n2(x / 300, z / 300) * 1.2;
      const toSea = z - coast;
      h += sstep(0, 300, Math.max(CX0 - x, x - CX1, CZ0 - z)) * (n3(x / 650, z / 650) * .5 + .5) * (region ? 110 : 45);
      if (toSea > 0) h = lerp(h, -28, sstep(0, 150, toSea));
      else h = lerp(h, 1.2, sstep(-60, 0, toSea));
      const north = region ? sstep(-3000, -3900, z) : sstep(-1300, -1900, z);
      const east = region ? sstep(3500, 4100, x) : sstep(1900, 2350, x), west = region ? sstep(-3500, -4100, x) : 0;
      const hills = (n1(x / 380, z / 380) * .5 + .5) * 260 + Math.pow(1 - Math.abs(n2(x / 420, z / 420)), 3) * 260;
      h += Math.max(north, east * .8, west * .8) * hills;
      const dv = Math.hypot(x - VOLC[0], z - VOLC[1]);
      h += VOLC_H * Math.pow(Math.max(0, 1 - dv / 650), 1.7) - (dv < 70 ? (70 - dv) * 1.3 : 0);
      const inCity = sstep(-80, 40, Math.min(x - CX0 + 80, CX1 + 80 - x, z - CZ0 + 80, CZ1 + 170 - z));
      const air = sstep(-140, 0, Math.min(x - (AIRPORT.x - 260), AIRPORT.x + 360 - x, z - (AIRPORT.z0 - 200), AIRPORT.z1 + 160 - z));
      h = lerp(h, 4, Math.max(inCity, air) * (toSea > -30 ? 0 : 1));
      return [h, toSea];
    };
    const vill = region ? VILLAGES.map(([x, z]) => [x, z, Math.max(8, base(x, z)[0])]) : [];
    return (x, z) => {
      let [h, toSea] = base(x, z);
      for (const [vx, vz, vh] of vill) { const d = Math.hypot(x - vx, z - vz); if (d < 260) h = lerp(h, vh, 1 - sstep(140, 260, d)); }
      const dh = Math.hypot(x - HILL[0], z - HILL[1]);
      h += HILL[3] * Math.pow(Math.max(0, 1 - dh / HILL[2]), 1.6);
      if (z > -2100 && toSea < 40) { const d = Math.abs(x - riverX(z)); const k = 1 - sstep(RIVER_W / 2 - 10, RIVER_W / 2 + 26, d); if (k > 0) h = lerp(h, -5, k); }
      return h;
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
    const mode = o.mode === 'big' ? 'city' : (o.mode || 'city'), region = mode === 'region', big = mode !== 'lite' && !Arcade3D.coarse();
    setWorld(region);
    const G = {
      api, t: 0, time: 0, ok: false, big, region, seed: 7, fields: [], anims: [], bridges: [], paths: [],
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
    const hf = heightFn(G.seed, G.region);
    G.h = new Float32Array((TN + 1) * (TN + 1)); G.h0 = null;
    for (let j = 0; j <= TN; j++) for (let i = 0; i <= TN; i++) G.h[j * (TN + 1) + i] = hf(T0 + i * TC, T0 + j * TC);
    G.h0 = G.h.slice();
    G.scorch = new Float32Array(G.h.length);
    G.r3.terrain = terrainMesh(G); scene.add(G.r3.terrain);
    /* céu e luz conforme a hora */
    setTod(G, 1, true);
    /* água */
    const water = Wd.buildWater({ water: '#1a5a74', shallow: '#3ea7a0' }, G.r3.env, { tile: 30, clear: 4, depth: seaDepth(G) }); scene.add(water); G.r3.water = water;
    /* cidade */
    genCity(G);
    buildCityMeshes(G);
    /* partículas */
    const pk = { fogNear: 1200, fogFar: 9000, fog: '#c9d3dc' };
    G.r3.smoke = Wd.particles(scene, coarse ? 4000 : 9000, false, pk); G.r3.fire = Wd.particles(scene, coarse ? 3000 : 6000, true, pk);
    G.r3.clouds = Wd.buildClouds(Wd.SKIES.noon, 5, coarse ? .6 : 1, { area: 6000, alt: [900, 1500], R: [140, 360], n: 34 }); scene.add(G.r3.clouds.mesh);
    debrisSetup(G);
    syncSkyFx(G);
    /* só arranca com os shaders compilados (sem congelar a página: ver Arcade3D.warm) */
    Arcade3D.warm(scene, cam).then(() => { if (!G.dead && G.r3) G.ok = true; });
    say(G, 'Fúria Divina', 'Escolhe um poder à esquerda e clica na cidade.', 4);
  }

  /* fundo do mar para a água (cor de baixio, espuma na praia, borda transparente) — refeito quando o terreno muda */
  const seaDepth = G => ({ fn: (x, z) => hAt(G, x, z), x: 0, z: 0, size: WS, res: 256 });
  function terrainMesh(G) {
    const geo = new THREE.PlaneGeometry(WS, WS, TN, TN); geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const tex = W().detailTex(WS / 30);
    const m = new THREE.Mesh(geo, Arcade3D.noTile(new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: .95, metalness: 0, envMapIntensity: .3 }), { macro: .2, wide: .45 }));
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
      else if (city && y < 9) c.copy(C.grass).lerp(C.asph, .25).lerp(C.sand, .15 + v * .15);
      else if (y < 7 && z > COAST - 140) c.copy(C.sand);
      else { c.copy(C.grass).lerp(C.grass2, v); c.lerp(C.rock, Math.min(1, sstep(.88, .7, ny) + sstep(200, 380, y) * .7)); const dv = Math.hypot(x - VOLC[0], z - VOLC[1]); c.lerp(C.ash, sstep(300, 90, dv) * .85); c.lerp(C.snow, sstep(430, 470, y) * sstep(.7, .85, ny) * (dv > 200 ? 1 : 0)); }
      const sc = G.scorch[k]; if (sc > 0) c.lerp(sc > 1.5 ? C.lava : C.burnt, Math.min(1, sc > 1.5 ? (sc - 1.5) * 2 : sc));
      col.setXYZ(k, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; geo.computeBoundingSphere();
    G.dirtyT = false; G.wdDirty = true;
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
    if (r3.pondM) r3.pondM.envMap = r3.env;
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
     cidade (geração): ruas irregulares, bairros com caráter próprio,
     rio com pontes, colina com castelo, zona industrial, porto, praia,
     parque de diversões, estádios, museus, monumentos e aeroporto;
     no modo Região, aldeias, campos e um parque eólico à volta
  ════════════════════════════════════════════════════════════════ */
  function genCity(G) {
    const rn = W().rng(G.seed * 31 + 7), Wd = W(), R = () => rn();
    /* ruas: quarteirões pequenos no centro, maiores na periferia */
    const mk = (a0, a1, c) => { const out = [a0]; let a = a0; while (a < a1 - 70) { a += clamp(78 + Math.abs(a - c) * .045, 80, 150) * (.9 + R() * .22); out.push(Math.min(a, a1)); } return out; };
    const xs = G.xs = mk(CX0, CX1, 380), zs = G.zs = mk(CZ0, CZ1, -100);
    const nx = xs.length - 1, nz = zs.length - 1;
    const riverD = (x, z) => Math.abs(x - riverX(z));
    /* quarteirões e bairros */
    G.blocks = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = xs[i] + ROAD / 2, x1 = xs[i + 1] - ROAD / 2, z0 = zs[j] + ROAD / 2, z1 = zs[j + 1] - ROAD / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      if (riverD(cx, cz) < RIVER_W / 2 + w * .5 + 4) { if (riverD(cx, cz) < RIVER_W / 2 + 18) continue; }
      const B = { i, j, x0, z0, w, d, sz: Math.min(w, d), cx, cz, zone: zoneAt(cx, cz, w, R) };
      const dC0 = Math.hypot(cx - 200, (cz + 100) * 1.25), edge = Math.min(cx - CX0, CX1 - cx, cz - CZ0);
      if ((B.zone === 'sprawl' || B.zone === 'res') && (R() < (dC0 - 950) / 650 || (edge < 260 && R() < .55))) B.zone = R() < .5 ? 'void' : 'grove';
      if (riverD(cx, cz) < RIVER_W / 2 + w * .5 + 6) B.zone = 'riverside';
      B.y = Math.min(hAt(G, x0, z0), hAt(G, x1, z0), hAt(G, x0, z1), hAt(G, x1, z1));
      B.slope = Math.max(hAt(G, x0, z0), hAt(G, x1, z0), hAt(G, x0, z1), hAt(G, x1, z1)) - B.y;
      G.blocks.push(B);
    }
    /* lugares especiais: o quarteirão mais perto de cada ponto */
    const taken = new Set();
    const claim = (x, z, zone, n) => {
      const c = G.blocks.filter(b => !taken.has(b) && b.zone !== 'riverside' && b.zone !== 'port' && b.slope < 6).sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z))[0];
      if (!c) return null;
      const set = [c];
      if (n > 1) G.blocks.forEach(b => { if (b !== c && !taken.has(b) && Math.abs(b.i - c.i) <= 1 && Math.abs(b.j - c.j) <= 1 && b.i >= c.i && b.j >= c.j && set.length < n && b.zone !== 'riverside') set.push(b); });
      set.forEach(b => { b.zone = zone; taken.add(b); }); c.main = 1;
      return c;
    };
    claim(640, 260, 'park', 4); claim(990, 330, 'stadium'); claim(-1080, -470, 'arena'); claim(-300, 150, 'museum'); claim(330, 470, 'modern');
    claim(-420, 430, 'cathedral'); claim(-120, 600, 'plaza'); claim(-880, 790, 'fun', 4); claim(1240, 120, 'factory'); claim(1330, 300, 'factory');
    claim(1250, 520, 'tanks'); claim(1380, -120, 'silos'); claim(70, -480, 'plaza'); claim(-1250, 200, 'school');
    /* lotes */
    const addB = (x, z, w, d, h, sty, rot, y) => {
      const b = { id: G.builds.length, x, z, w, d, h, h0: h, sty, rot: rot || 0, y: y != null ? y : groundUnder(G, x, z, w, d), col: STY[sty].walls[Math.floor(R() * STY[sty].walls.length)], hp: 0, alive: true, state: 'ok', burn: 0, dmg: 0 };
      b.max = b.hp = 40 + Math.sqrt(w * d) * 3 + h * 2.2;
      G.builds.push(b); return b;
    };
    G.addB = addB;
    const tree = (x, z, s, kind) => G.trees.push({ x, z, s: s || rand(.8, 1.2), kind });
    const grid = (B, nx2, nz2, pad, fn) => { const cw = (B.w - pad * 2) / nx2, cd = (B.d - pad * 2) / nz2; for (let a = 0; a < nx2; a++) for (let c = 0; c < nz2; c++) fn(B.x0 + pad + cw * (a + .5), B.z0 + pad + cd * (c + .5), cw, cd, a, c); };
    G.blocks.forEach(B => {
      const { x0, z0, w, d, zone } = B, dC = Math.hypot(B.cx - 380, (B.cz + 90) * 1.15);
      if (zone === 'cbd' || zone === 'cbd2') {
        const n = w * d > 8800 ? 2 : 1, m = d > w * 1.4 ? 2 : n;
        grid(B, n, m, 5, (x, z, cw, cd) => {
          const peak = zone === 'cbd' ? clamp(1.25 - dC / 330, .25, 1.25) : .7;
          const h = (55 + Math.pow(R(), 1.5) * 210) * peak + 30;
          const sty = R() < .42 ? 0 : R() < .55 ? 7 : 3;
          const b = addB(x, z, cw * (.6 + R() * .32), cd * (.6 + R() * .32), h, sty);
          if (h > 120 && R() < .5) { const t = addB(x, z, b.w * .62, b.d * .62, h * rand(.12, .25), sty, 0, b.y + h); t.cap = 1; }
          if (R() < .5) addB(x, z, cw * .94, cd * .94, rand(8, 14), 3);
        });
      } else if (zone === 'mid') {
        const nx2 = Math.max(2, Math.round(w / 30)), nz2 = Math.max(2, Math.round(d / 30));
        grid(B, nx2, nz2, 4, (x, z, cw, cd, a, c) => { if (a > 0 && a < nx2 - 1 && c > 0 && c < nz2 - 1 && R() < .6) { tree(x, z); return; } addB(x, z, cw * (.72 + R() * .24), cd * (.72 + R() * .24), 14 + Math.pow(R(), 1.3) * 52, [1, 2, 3, 0, 1, 2][Math.floor(R() * 6)]); });
      } else if (zone === 'old') {
        /* casario da baixa antiga: frentes contínuas de prédios estreitos coloridos com telhados de telha */
        const dep = 14;
        const row = (len, place) => { let s = 2; while (s < len - 6) { const fw = rand(8, 13); place(s + fw / 2, fw); s += fw + .3; } };
        row(w, (s, fw) => { const b = addB(x0 + s, z0 + dep / 2 + 2, fw, dep, rand(10, 21), 5); b.roof = rand(2.4, 3.4); });
        row(w, (s, fw) => { const b = addB(x0 + s, z0 + d - dep / 2 - 2, fw, dep, rand(10, 21), 5); b.roof = rand(2.4, 3.4); });
        row(d - dep * 2 - 6, (s, fw) => { const b = addB(x0 + dep / 2 + 2, z0 + dep + 3 + s, dep, fw, rand(10, 19), 5, 0); b.roof = rand(2.4, 3.2); });
        row(d - dep * 2 - 6, (s, fw) => { const b = addB(x0 + w - dep / 2 - 2, z0 + dep + 3 + s, dep, fw, rand(10, 19), 5, 0); b.roof = rand(2.4, 3.2); });
        if (w > 50) tree(B.cx, B.cz, 1.1);
      } else if (zone === 'res' || zone === 'hillres' || zone === 'sprawl') {
        if (zone === 'res' && R() < .16 && B.slope < 4) { grid(B, 2, 2, 6, (x, z, cw, cd) => addB(x, z, cw * .7, cd * .7, rand(12, 26), R() < .5 ? 1 : 2)); return; }
        const nx2 = Math.max(2, Math.round(w / 21)), nz2 = Math.max(2, Math.round(d / 21));
        grid(B, nx2, nz2, 3, (x, z, cw, cd, a, c) => {
          const inner = a > 0 && a < nx2 - 1 && c > 0 && c < nz2 - 1;
          if (inner || (zone === 'sprawl' && R() < .45)) { if (R() < .75) tree(x + rand(-3, 3), z + rand(-3, 3)); return; }
          const b = addB(x, z, rand(8, 12), rand(8, 11), rand(5.5, 9), 4, R() < .5 ? 0 : Math.PI / 2); b.roof = rand(2.4, 4);
          if (R() < .35) tree(x + cw * .35, z + cd * .35, .8);
        });
      } else if (zone === 'industrial') {
        grid(B, w > 90 ? 2 : 1, 2, 6, (x, z, cw, cd) => { if (R() < .2) return; addB(x, z, cw * .85, cd * .8, rand(9, 16), 6); });
      } else if (zone === 'port') {
        const n = Math.max(2, Math.floor(w / 30));
        for (let k = 0; k < n; k++) addB(x0 + 14 + k * (w - 20) / n, B.cz - d * .25, 22, d * .35, rand(10, 14), 1);
        B.containers = true;
      } else if (zone === 'beach') {
        grid(B, 3, 2, 8, (x, z, cw, cd, a) => { if (a === 1) { addB(x, z, 10, 8, 4.5, 3); } else tree(x, z, rand(.9, 1.3), 'palm'); });
        B.umbrellas = true;
      } else if (zone === 'riverside') {
        for (let k = 0; k < Math.round(w * d / 260); k++) { const x = x0 + rand(4, w - 4), z = z0 + rand(4, d - 4); if (riverD(x, z) > RIVER_W / 2 + 6) tree(x, z, rand(.8, 1.2)); }
        B.green = true;
      } else if (zone === 'park' || zone === 'hillpark') {
        for (let k = 0; k < Math.round(w * d / 300); k++) tree(x0 + rand(6, w - 6), z0 + rand(6, d - 6), rand(.8, 1.4));
        B.green = true;
      } else if (zone === 'grove') {
        for (let k = 0; k < Math.round(w * d / 220); k++) tree(x0 + rand(3, w - 3), z0 + rand(3, d - 3), rand(.9, 1.5));
        B.bare = true;
      } else if (zone === 'void') { B.bare = true; if (R() < .4) G.fields.push({ x: B.cx, z: B.cz, w: w - 6, d: d - 6, r: 0, c: ['#a8c060', '#d8c070', '#7fa04a', '#c8a050'][Math.floor(R() * 4)] }); }
      else B.green = zone !== 'plaza';
      if (B.slope > 2.5) { B.bare = true; B.green = false; }
    });
    /* arredores: árvores nas encostas */
    const fz = Wd.perlin(3), half = WS / 2 - 100;
    for (let k = 0; k < (G.region ? 7000 : G.big ? 3200 : 1500); k++) {
      const x = rand(-half, half), z = rand(-half, COAST - 100);
      if (x > CX0 - 40 && x < CX1 + 40 && z > CZ0 - 40 && z < CZ1 + 40) continue;
      if (Math.abs(x - AIRPORT.x) < 380 && z > AIRPORT.z0 - 260 && z < AIRPORT.z1 + 200) continue;
      const h = hAt(G, x, z); if (h < 6 || h > 360 || Math.hypot(x - VOLC[0], z - VOLC[1]) < 400) continue;
      if (fz(x / 180, z / 180) < -.05) continue;
      G.trees.push({ x, z, s: rand(1.2, 2.2), wild: 1, kind: h > 160 ? 'pine' : undefined });
    }
  }
  function zoneAt(cx, cz, w, R) {
    if (cz > COAST - 175) return (cx > 260 && cx < 1420) ? 'port' : 'beach';
    const dh = Math.hypot(cx - HILL[0], cz - HILL[1]);
    if (dh < HILL[2] * .45) return 'hillpark';
    if (dh < HILL[2] * .95) return 'hillres';
    if (cx > 1150 && cz > -260 && cz < 760) return 'industrial';
    const dC = Math.hypot(cx - 380, (cz + 90) * 1.15);
    if (dC < 300) return 'cbd';
    if (Math.hypot(cx - 950, cz + 720) < 250) return 'cbd2';
    if (cx < riverX(cz) - 50 && Math.hypot(cx + 160, cz - 330) < 440) return 'old';
    if (dC < 680) return 'mid';
    if (dC > 1300) return R() < .55 ? 'sprawl' : 'res';
    return 'res';
  }
  function groundUnder(G, x, z, w, d) { return Math.min(hAt(G, x - w / 2, z - d / 2), hAt(G, x + w / 2, z - d / 2), hAt(G, x - w / 2, z + d / 2), hAt(G, x + w / 2, z + d / 2), hAt(G, x, z)); }

  /* ── edifícios especiais (malhas próprias, destrutíveis como um todo) ── */
  function special(G, kind, x, z, o = {}) {
    const Wd = W(), g = new THREE.Group(), M = (c, p) => Wd.plainMat(c, null, Object.assign({ metalness: .1, roughness: .7 }, p || {}));
    const add = (geo, mat, px, py, pz, opt) => Wd.addMesh(g, geo, mat, px, py, pz, opt);
    let w = 30, d = 30, h = 20, anim = null;
    const stone = M('#e4dccb'), white = M('#f2f0ea'), dark = M('#3a3d42'), red = M('#c23b2f'), glass = M('#2f4f62', { metalness: .6, roughness: .12 });
    if (kind === 'stadium' || kind === 'arena') {
      const r = kind === 'arena' ? 36 : 46, k = kind === 'arena' ? 1 : .82;
      const ring = new THREE.LatheGeometry([new THREE.Vector2(r - 16, 0), new THREE.Vector2(r - 2, 20), new THREE.Vector2(r, 20), new THREE.Vector2(r, 0)], 48); ring.scale(1, 1, k);
      add(ring, M('#d8d6d0'), 0, 0, 0);
      if (kind === 'arena') add(new THREE.SphereGeometry(r, 32, 12, 0, TAU, 0, Math.PI / 2), M('#e8eef2', { metalness: .4, roughness: .3 }), 0, 18, 0, { s: [1, .3, 1] });
      else { add(new THREE.CylinderGeometry(r - 16, r - 16, .5, 40), M('#3f9a3a'), 0, .3, 0, { s: [1, 1, k] }); add(new THREE.TorusGeometry(r, 1.2, 6, 48), red, 0, 20.5, 0, { rx: Math.PI / 2, s: [1, k, 1] }); [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + .6; add(new THREE.CylinderGeometry(.6, .8, 34, 6), dark, Math.cos(a) * (r + 3), 17, Math.sin(a) * (r + 3) * k); const l = new THREE.Sprite(Arcade3D.glowSprite('#fff6d8')); l.position.set(Math.cos(a) * (r + 3), 35, Math.sin(a) * (r + 3) * k); l.scale.setScalar(10); g.add(l); }); }
      w = r * 2; d = r * 2 * k; h = 22;
    } else if (kind === 'museum') {
      add(new THREE.BoxGeometry(46, 3, 30), stone, 0, 1.5, 0);
      add(new THREE.BoxGeometry(40, 14, 22), stone, 0, 10, -2);
      for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(.9, 1, 13, 10), white, -17.5 + i * 5, 9.5, 10.5);
      const ped = new THREE.CylinderGeometry(1, 1, 44, 3, 1); ped.rotateZ(Math.PI / 2); ped.rotateX(Math.PI / 2); ped.scale(1, 5, 7);
      add(ped, stone, 0, 19, 4);
      add(new THREE.BoxGeometry(44, 1.2, 26), stone, 0, 16.6, 0);
      add(new THREE.SphereGeometry(7, 20, 10, 0, TAU, 0, Math.PI / 2), M('#6f9a8a', { metalness: .5 }), 0, 17, -4);
      w = 46; d = 30; h = 24;
    } else if (kind === 'modern') {
      add(new THREE.BoxGeometry(34, 12, 26), white, 0, 6, 0);
      add(new THREE.BoxGeometry(26, 10, 20), glass, 6, 17, -3, { ry: .25 });
      add(new THREE.TorusGeometry(18, 2.4, 10, 40, Math.PI), M('#dfe6ea', { metalness: .3, roughness: .3 }), -2, 12, 0, { s: [1, .8, 2.2] });
      w = 40; d = 30; h = 26;
    } else if (kind === 'cathedral') {
      add(new THREE.BoxGeometry(18, 18, 46), stone, 0, 9, 0);
      const rf = new THREE.CylinderGeometry(1, 1, 46, 3, 1); rf.rotateX(Math.PI / 2); rf.scale(10.5, 7, 1); add(rf, M('#7a6a5a'), 0, 21.5, 0);
      [-6.5, 6.5].forEach(x2 => { add(new THREE.BoxGeometry(8, 34, 8), stone, x2, 17, 22); add(new THREE.ConeGeometry(5.6, 14, 4), M('#5f6a6a', { metalness: .4 }), x2, 41, 22, { ry: Math.PI / 4 }); });
      add(new THREE.CircleGeometry(3.4, 20), glass, 0, 22, 23.1);
      add(new THREE.BoxGeometry(30, 14, 12), stone, 0, 7, -8);
      w = 30; d = 50; h = 48;
    } else if (kind === 'arch') {
      [-9, 9].forEach(x2 => add(new THREE.BoxGeometry(7, 26, 10), stone, x2, 13, 0));
      add(new THREE.BoxGeometry(26, 8, 10), stone, 0, 29, 0); add(new THREE.BoxGeometry(27, 1.2, 11), M('#cfc5b2'), 0, 33.6, 0);
      w = 26; d = 10; h = 34;
    } else if (kind === 'obelisk') {
      add(new THREE.BoxGeometry(8, 3, 8), stone, 0, 1.5, 0);
      const ob = new THREE.CylinderGeometry(1.4, 2.6, 40, 4); ob.rotateY(Math.PI / 4); add(ob, M('#d8cfbd'), 0, 23, 0);
      add(new THREE.ConeGeometry(2, 3, 4), M('#e2c26a', { metalness: .7, roughness: .3 }), 0, 44.5, 0, { ry: Math.PI / 4 });
      w = 8; d = 8; h = 46;
    } else if (kind === 'statue') {
      add(new THREE.BoxGeometry(6, 8, 6), stone, 0, 4, 0);
      const br = M('#4f7f6a', { metalness: .6, roughness: .4 });
      add(new THREE.CylinderGeometry(1.2, 1.6, 6, 8), br, 0, 11, 0); add(new THREE.SphereGeometry(1.1, 10, 8), br, 0, 15, 0); add(new THREE.CylinderGeometry(.35, .35, 5, 6), br, 1.2, 15.5, 0, { rz: -.5 });
      w = 6; d = 6; h = 17;
    } else if (kind === 'castle') {
      const st2 = M('#b8ab94');
      [[-22, 0, 2, 44], [22, 0, 2, 44], [0, -22, 44, 2], [0, 22, 44, 2]].forEach(([px, pz, ww, dd]) => add(new THREE.BoxGeometry(ww, 10, dd), st2, px, 5, pz));
      [[-22, -22], [22, -22], [-22, 22], [22, 22]].forEach(([px, pz]) => { add(new THREE.CylinderGeometry(4, 4.5, 16, 12), st2, px, 8, pz); add(new THREE.ConeGeometry(5, 7, 12), red, px, 19.5, pz); });
      add(new THREE.BoxGeometry(14, 22, 14), st2, 0, 11, 0); add(new THREE.BoxGeometry(2, 10, .2), red, 0, 27, 0);
      w = 50; d = 50; h = 26;
    } else if (kind === 'lighthouse') {
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(3.4 - i * .3, 3.6 - i * .3, 5, 14), i % 2 ? red : white, 0, 2.5 + i * 5, 0);
      add(new THREE.CylinderGeometry(2.4, 2.4, 3, 12), glass, 0, 31.5, 0); add(new THREE.ConeGeometry(2.8, 3, 12), red, 0, 34.5, 0);
      const l = new THREE.Sprite(Arcade3D.glowSprite('#fff2c0')); l.position.y = 31.5; l.scale.setScalar(14); g.add(l);
      w = 8; d = 8; h = 36;
    } else if (kind === 'ferris') {
      [-5, 5].forEach(pz => { add(new THREE.CylinderGeometry(.8, 1, 46, 6), white, -9, 21, pz, { rz: -.42 }); add(new THREE.CylinderGeometry(.8, 1, 46, 6), white, 9, 21, pz, { rz: .42 }); });
      const wheel = new THREE.Group(); wheel.position.y = 42; g.add(wheel);
      Wd.addMesh(wheel, new THREE.TorusGeometry(30, .7, 6, 48), white, 0, 0, 0); Wd.addMesh(wheel, new THREE.TorusGeometry(29, .4, 6, 48), M('#e44a8a'), 0, 0, 2.5);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; Wd.addMesh(wheel, new THREE.CylinderGeometry(.25, .25, 30, 4), white, Math.cos(a) * 15, Math.sin(a) * 15, 0, { rz: a + Math.PI / 2 }); }
      const cabs = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, cb = Wd.addMesh(wheel, new THREE.BoxGeometry(3, 3.2, 3), M(['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'][i % 4]), Math.cos(a) * 30, Math.sin(a) * 30 - 2.5, 0); cabs.push(cb); }
      anim = dt => { wheel.rotation.z += dt * .12; cabs.forEach(cb => { cb.rotation.z = -wheel.rotation.z; }); };
      w = 64; d = 14; h = 74;
    } else if (kind === 'coaster') {
      const pts = []; for (let i = 0; i < 80; i++) { const t = i / 80 * TAU; pts.push(new THREE.Vector3(Math.cos(t) * 34 + Math.sin(t * 3) * 6, 8 + Math.sin(t * 2) * 7 + Math.max(0, Math.sin(t + 1)) * 14, Math.sin(t) * 20)); }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      add(new THREE.TubeGeometry(curve, 300, .8, 6, true), M('#e11d48', { metalness: .4 }), 0, 0, 0);
      for (let i = 0; i < 24; i++) { const p = curve.getPoint(i / 24); add(new THREE.CylinderGeometry(.35, .35, p.y, 5), white, p.x, p.y / 2, p.z); }
      const train = new THREE.Group(); g.add(train); for (let i = 0; i < 4; i++) Wd.addMesh(train, new THREE.BoxGeometry(2.2, 1.6, 3.6), M('#facc15'), 0, 1.2, -i * 4.2);
      let u = 0; const tmp = new THREE.Vector3();
      anim = dt => { u = (u + dt * .06) % 1; const p = curve.getPoint(u); curve.getPoint((u + .01) % 1, tmp); train.position.copy(p); train.lookAt(tmp); };
      w = 84; d = 52; h = 30;
    } else if (kind === 'carousel') {
      add(new THREE.CylinderGeometry(10, 10, 1.2, 24), white, 0, .6, 0);
      const top = new THREE.Group(); g.add(top);
      Wd.addMesh(top, new THREE.ConeGeometry(11.5, 6, 16), M('#f97316'), 0, 10, 0); Wd.addMesh(top, new THREE.CylinderGeometry(1, 1, 8, 8), M('#fde68a', { metalness: .6 }), 0, 4.5, 0);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; Wd.addMesh(top, new THREE.CylinderGeometry(.15, .15, 7, 4), M('#fde68a', { metalness: .6 }), Math.cos(a) * 7.5, 4.5, Math.sin(a) * 7.5); Wd.addMesh(top, new THREE.BoxGeometry(1, 1.6, 2.8), M(['#ffffff', '#f472b6', '#60a5fa'][i % 3]), Math.cos(a) * 7.5, 3, Math.sin(a) * 7.5, { ry: -a }); }
      anim = dt => { top.rotation.y += dt * .6; };
      w = 22; d = 22; h = 13;
    } else if (kind === 'tent') {
      add(new THREE.CylinderGeometry(14, 14, 7, 20), M('#fafafa'), 0, 3.5, 0); add(new THREE.ConeGeometry(16, 12, 20), red, 0, 13, 0);
      w = 30; d = 30; h = 19;
    } else if (kind === 'chimney') {
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(2.2 - i * .12, 2.4 - i * .12, 10, 12), i % 2 ? red : white, 0, 5 + i * 10, 0);
      anim = (dt, gg) => { if (Math.random() < dt * 6) gg.r3.smoke.spawn({ x: x + rand(-1, 1), y: (o.y || 4) + 62, z: z + rand(-1, 1), vx: rand(2, 5), vy: rand(4, 8), vz: rand(-1, 1), life: rand(8, 12), s0: 4, s1: 24, c0: '#d8d4cc', c1: '#a8a49c', a: .55, drag: .2, grav: -.4, rotv: rand(-.2, .2) }); };
      w = 6; d = 6; h = 62;
    } else if (kind === 'silos') {
      for (let i = 0; i < 4; i++) { add(new THREE.CylinderGeometry(5, 5, 28, 16), M('#cfd4d8', { metalness: .5, roughness: .4 }), -15 + i * 10, 14, 0); add(new THREE.SphereGeometry(5, 16, 8, 0, TAU, 0, Math.PI / 2), M('#cfd4d8', { metalness: .5 }), -15 + i * 10, 28, 0); }
      w = 42; d = 12; h = 33;
    } else if (kind === 'tanks') {
      [[-14, -10], [14, -10], [0, 14]].forEach(([px, pz]) => add(new THREE.CylinderGeometry(11, 11, 12, 24), M('#eef0f0', { metalness: .4, roughness: .35 }), px, 6, pz));
      w = 50; d = 46; h = 12;
    } else if (kind === 'tvtower') {
      add(new THREE.CylinderGeometry(3, 6, 230, 16), M('#e7e9ec', { metalness: .2, roughness: .5 }), 0, 115, 0);
      add(new THREE.SphereGeometry(13, 20, 14), glass, 0, 205, 0, { s: [1, .7, 1] }); add(new THREE.CylinderGeometry(15, 15, 3, 20), white, 0, 196, 0);
      add(new THREE.CylinderGeometry(.8, 1.4, 40, 8), red, 0, 250, 0);
      const l = new THREE.Sprite(Arcade3D.glowSprite('#ff3b3b')); l.position.y = 272; l.scale.setScalar(10); g.add(l);
      w = 14; d = 14; h = 270;
    } else if (kind === 'school') {
      add(new THREE.BoxGeometry(50, 10, 14), M('#e9d3a8'), 0, 5, -10); add(new THREE.BoxGeometry(14, 10, 30), M('#e9d3a8'), -18, 5, 6);
      add(new THREE.BoxGeometry(24, .3, 16), M('#c0603a'), 10, .2, 10);
      w = 52; d = 40; h = 11;
    } else if (kind === 'terminal') {
      add(new THREE.BoxGeometry(60, 14, 160), glass, 0, 7, 0);
      add(new THREE.CylinderGeometry(1, 1, 160, 3, 1, false, 0, Math.PI), M('#e6e9ec', { metalness: .4, roughness: .3 }), 0, 14, 0, { rx: Math.PI / 2, s: [34, 1, 6] });
      w = 64; d = 160; h = 22;
    } else if (kind === 'ctower') {
      add(new THREE.CylinderGeometry(3, 4, 46, 12), white, 0, 23, 0); add(new THREE.CylinderGeometry(7, 5, 6, 12), glass, 0, 49, 0); add(new THREE.CylinderGeometry(7.5, 7.5, 1, 12), dark, 0, 52.5, 0);
      w = 14; d = 14; h = 53;
    } else if (kind === 'hangar') {
      const hg = new THREE.CylinderGeometry(22, 22, 50, 20, 1, false, 0, Math.PI); hg.rotateZ(Math.PI / 2); hg.rotateY(Math.PI / 2);
      add(hg, M('#9aa3ab', { metalness: .5, roughness: .4 }), 0, 0, 0);
      w = 44; d = 50; h = 22;
    } else if (kind === 'turbine') {
      add(new THREE.CylinderGeometry(1.2, 2.2, 70, 10), white, 0, 35, 0); add(new THREE.BoxGeometry(3, 3, 8), white, 0, 71, 0);
      const rot = new THREE.Group(); rot.position.set(0, 71, 4.2); g.add(rot);
      for (let i = 0; i < 3; i++) Wd.addMesh(rot, new THREE.BoxGeometry(1.6, 28, .4), white, 0, 14, 0).parent.children[i].rotation.set(0, 0, 0);
      rot.children.forEach((b2, i) => { b2.position.set(Math.sin(i * TAU / 3) * 14, Math.cos(i * TAU / 3) * 14, 0); b2.rotation.z = -i * TAU / 3; });
      anim = dt => { rot.rotation.z += dt * 1.4; };
      w = 6; d = 6; h = 100;
    } else if (kind === 'church') {
      add(new THREE.BoxGeometry(10, 9, 20), white, 0, 4.5, 0);
      const rf = new THREE.CylinderGeometry(1, 1, 20, 3, 1); rf.rotateX(Math.PI / 2); rf.scale(6.2, 4, 1); add(rf, M('#b5532f'), 0, 11, 0);
      add(new THREE.BoxGeometry(5, 18, 5), white, 0, 9, 11); add(new THREE.ConeGeometry(3.6, 6, 4), M('#b5532f'), 0, 21, 11, { ry: Math.PI / 4 });
      w = 12; d = 26; h = 24;
    } else if (kind === 'barn') {
      add(new THREE.BoxGeometry(14, 8, 22), M('#9b2f24'), 0, 4, 0);
      const rf = new THREE.CylinderGeometry(1, 1, 22, 3, 1); rf.rotateX(Math.PI / 2); rf.scale(8.4, 4.4, 1); add(rf, M('#4a4a4a'), 0, 10, 0);
      w = 14; d = 22; h = 14;
    }
    const y = o.y != null ? o.y : groundUnder(G, x, z, w * .6, d * .6);
    g.position.set(x, y, z); if (o.rot) g.rotation.y = o.rot;
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    G.r3.scene.add(g);
    const b = { id: G.builds.length, x, z, w, d, h, h0: h, sty: 3, rot: o.rot || 0, y, col: '#cccccc', hp: 0, alive: true, state: 'ok', burn: 0, dmg: 0, mesh: g, special: kind };
    b.max = b.hp = (60 + Math.sqrt(w * d) * 4 + h * 2.4) * (o.tough || 1);
    if (anim) G.anims.push({ b, fn: anim });
    G.builds.push(b);
    return b;
  }
  function planeMesh(G, col) {
    const Wd = W(), g = new THREE.Group(), body = Wd.plainMat(col || '#f2f4f6', null, { metalness: .4, roughness: .35 }), dark = Wd.plainMat('#2a2f36', null, { metalness: .5 });
    Wd.addMesh(g, new THREE.CylinderGeometry(2.4, 2.4, 40, 14), body, 0, 0, 0, { rx: Math.PI / 2 });
    Wd.addMesh(g, new THREE.SphereGeometry(2.4, 12, 8), body, 0, 0, 20, { s: [1, 1, 1.8] });
    Wd.addMesh(g, new THREE.ConeGeometry(2.4, 8, 12), body, 0, .6, -24, { rx: -Math.PI / 2 });
    Wd.addMesh(g, new THREE.BoxGeometry(38, .6, 7), body, 0, -.8, 1);
    Wd.addMesh(g, new THREE.BoxGeometry(14, .5, 4), body, 0, 1, -22);
    Wd.addMesh(g, new THREE.BoxGeometry(.5, 8, 6), Wd.plainMat('#2f6fdb', null, { metalness: .2 }), 0, 5, -23);
    [-9, 9].forEach(x => Wd.addMesh(g, new THREE.CylinderGeometry(1.2, 1.2, 5, 10), dark, x, -2.4, 3, { rx: Math.PI / 2 }));
    return g;
  }

  /* pontes sobre o rio, aeroporto, aldeias e campos */
  function genExtras(G) {
    const Wd = W(), scene = G.r3.scene, R = W().rng(G.seed * 13 + 5);
    G.bridges = [];
    const deck = Wd.plainMat('#6b6f74', null, { metalness: .2, roughness: .8 }), rail = Wd.plainMat('#d8d6d0', null, { metalness: .3 }), cable = Wd.plainMat('#e7e9ec', null, { metalness: .6, roughness: .3 });
    const mid = G.zs.reduce((b, z, j) => (Math.abs(z + 60) < Math.abs(G.zs[b] + 60) ? j : b), 0);
    G.zs.forEach((z, j) => {
      if (z > COAST - 40 || (j % 2 && j !== mid)) return;
      const xr = riverX(z), L = RIVER_W + 60, g = new THREE.Group();
      Wd.addMesh(g, new THREE.BoxGeometry(L, 1.6, 16), deck, 0, 0, 0);
      Wd.addMesh(g, new THREE.BoxGeometry(L, 1.2, .6), rail, 0, 1.4, 7.7); Wd.addMesh(g, new THREE.BoxGeometry(L, 1.2, .6), rail, 0, 1.4, -7.7);
      [-1, 0, 1].forEach(k => Wd.addMesh(g, new THREE.CylinderGeometry(1.6, 2, 10, 10), rail, k * 26, -5.6, 0));
      if (j === mid) {
        /* ponte principal: atirantada, com dois mastros */
        [-22, 22].forEach(px => { Wd.addMesh(g, new THREE.BoxGeometry(3, 60, 3), cable, px, 30, 8.6); Wd.addMesh(g, new THREE.BoxGeometry(3, 60, 3), cable, px, 30, -8.6); for (let k = 1; k <= 6; k++) [-1, 1].forEach(sg => [8.6, -8.6].forEach(pz => { const len = Math.hypot(k * 6, 54 - k * 6); const c = Wd.addMesh(g, new THREE.CylinderGeometry(.18, .18, len, 4), cable, px + sg * k * 3, 30 - k * 3 + 2, pz); c.rotation.z = sg * Math.atan2(k * 6, 54 - k * 6); })); });
      } else if (j % 4 === 0) {
        const arc = new THREE.TorusGeometry(L / 2 - 6, .9, 6, 32, Math.PI); Wd.addMesh(g, arc, rail, 0, 0, 8.2); Wd.addMesh(g, arc, rail, 0, 0, -8.2);
      }
      g.position.set(xr, 6, z); g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g);
      G.bridges.push({ z, x0: xr - L / 2, x1: xr + L / 2, y: 6.9, g });
    });
    /* aeroporto: pista, caminho, terminal, torre, hangares e aviões */
    const A = AIRPORT, ax = A.x, alen = A.z1 - A.z0, acz = (A.z0 + A.z1) / 2;
    const runTex = Wd.canvasTex(64, 1024, (x, w, h) => { x.fillStyle = '#3c3f44'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8e8e8'; for (let y = 40; y < h - 40; y += 64) x.fillRect(w / 2 - 1.5, y, 3, 30); x.fillRect(4, 0, 2, h); x.fillRect(w - 6, 0, 2, h); for (let i = 0; i < 6; i++) { x.fillRect(10 + i * 8, 6, 4, 24); x.fillRect(10 + i * 8, h - 30, 4, 24); } });
    const run = new THREE.Mesh(new THREE.PlaneGeometry(A.w, alen).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: runTex, roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    run.position.set(ax, 4.2, acz); run.receiveShadow = true; scene.add(run);
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(24, alen * .8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    taxi.position.set(ax + 110, 4.15, acz); scene.add(taxi);
    special(G, 'terminal', ax + 200, acz - 60, { y: 4 }); special(G, 'ctower', ax + 180, acz + 120, { y: 4 });
    special(G, 'hangar', ax + 180, A.z0 + 120, { y: 4 }); special(G, 'hangar', ax + 180, A.z0 + 190, { y: 4 });
    G.planes = [];
    for (let i = 0; i < 4; i++) { const p = planeMesh(G, ['#f2f4f6', '#f2f4f6', '#e8eef7', '#fdfcf8'][i]); p.position.set(ax + 150, 7, acz - 140 + i * 55); p.rotation.y = -Math.PI / 2; scene.add(p); }
    const fly = planeMesh(G); scene.add(fly); G.flyer = { g: fly, t: rand(0, 30) };
    /* estrada do aeroporto (liga à cidade) */
    const zr = G.zs[Math.floor(G.zs.length * .55)];
    G.paths = [[[CX0, zr], [CX0 - 200, zr + 30], [ax + 260, acz + 40]]];
    /* aldeias, campos, estradas rurais e parque eólico (modo Região) */
    if (G.region) {
      VILLAGES.forEach((v, vi) => {
        const [vx, vz] = v;
        special(G, 'church', vx, vz);
        for (let k = 0; k < 34; k++) { const a = rand(0, TAU), r = rand(18, 120); const x = vx + Math.cos(a) * r, z = vz + Math.sin(a) * r; if (Math.abs(hAt(G, x, z) - hAt(G, vx, vz)) > 14) continue; const b = G.addB(x, z, rand(8, 12), rand(8, 11), rand(5.5, 8), 4, R() < .5 ? 0 : Math.PI / 2); b.roof = rand(2.4, 3.6); }
        for (let k = 0; k < 2; k++) special(G, 'barn', vx + rand(-200, 200), vz + rand(-200, 200));
        for (let k = 0; k < 22; k++) { const a = rand(0, TAU), r = rand(150, 420); G.fields.push({ x: vx + Math.cos(a) * r, z: vz + Math.sin(a) * r, w: rand(50, 110), d: rand(40, 90), r: rand(0, 3), c: ['#a8c060', '#d8c070', '#7fa04a', '#c8a050', '#90b858'][k % 5] }); }
        /* estrada até à cidade */
        const tx = clamp(vx, CX0, CX1), tz = clamp(vz, CZ0, CZ1), pts = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([lerp(vx, tx, t) + (i % 8 ? rand(-60, 60) : 0), lerp(vz, tz, t) + (i % 8 ? rand(-60, 60) : 0)]); }
        G.paths.push(pts);
        void vi;
      });
      for (let k = 0; k < 9; k++) { const x = 2400 + k * 140, z = -1500 + Math.sin(k) * 120; special(G, 'turbine', x, z); }
    }
    /* estradas fora da grelha: fita de asfalto a seguir o relevo */
    const rm = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    G.paths.forEach(pts => {
      const P = [], wdt = 7;
      for (let i = 0; i < pts.length - 1; i++) { const [ax2, az2] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax2, bz - az2) / 12); for (let k = 0; k < n; k++) P.push([lerp(ax2, bx, k / n), lerp(az2, bz, k / n)]); }
      P.push(pts[pts.length - 1]);
      const pos = [], idx = [];
      P.forEach(([x, z], i) => { const q = P[Math.min(i + 1, P.length - 1)], p0 = P[Math.max(i - 1, 0)]; let dx = q[0] - p0[0], dz = q[1] - p0[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const y = Math.max(hAt(G, x, z), 1) + .35; pos.push(x - dz * wdt, y, z + dx * wdt, x + dz * wdt, y, z - dx * wdt); if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rm); m.receiveShadow = true; scene.add(m);
      pts.dense = P;
    });
  }

  /* troços de rua utilizáveis: fora do rio (exceto nas pontes) e em chão plano (a colina não tem ruas) */
  function roadNet(G) {
    const xs = G.xs, zs = G.zs, flat = (x, z) => Math.abs(hAt(G, x, z) - 4) < 1.3;
    const hasBridge = z => G.bridges.some(b => Math.abs(b.z - z) < 1);
    G.hBr = zs.map(() => []);
    G.hOK = zs.map((z, j) => xs.slice(0, -1).map((x, i) => {
      const rx = riverX(z), cross = rx + RIVER_W / 2 + 8 > x && rx - RIVER_W / 2 - 8 < xs[i + 1];
      G.hBr[j][i] = false;
      if (cross && !hasBridge(z)) return false;
      for (let t = 0; t <= 1.001; t += .25) { const px = lerp(x, xs[i + 1], t); if (Math.abs(px - rx) > RIVER_W / 2 + 10 && !flat(px, z)) return false; }
      return true;
    }));
    G.vOK = xs.map(x => zs.slice(0, -1).map((z, j) => { for (let t = 0; t <= 1.001; t += .1) { const pz = lerp(z, zs[j + 1], t); if (Math.abs(x - riverX(pz)) < RIVER_W / 2 + 8 || !flat(x, pz)) return false; } return true; }));
  }
  function buildCityMeshes(G) {
    const r3 = G.r3, scene = r3.scene, Wd = W(), c = new THREE.Color(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3();
    /* passeios / chão de cada quarteirão (cor conforme o bairro) */
    const PLATE = { cbd: '#c3c0b8', cbd2: '#c3c0b8', mid: '#bdb9b0', old: '#d9cdb4', res: '#b9b5ac', hillres: '#b9b5ac', sprawl: '#b9b5ac', industrial: '#9ea09d', port: '#a7a8a5', beach: '#e6d8b0', plaza: '#ddd2bc' };
    const plates = G.blocks.filter(B => !B.green && !B.bare);
    const side = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ roughness: .9 }), Math.max(1, plates.length));
    plates.forEach((B, i) => { side.setMatrixAt(i, M4.compose(V.set(B.cx, B.y - .3, B.cz), Q.identity(), S.set(B.w, .9 + B.slope, B.d))); side.setColorAt(i, c.set(PLATE[B.zone] || '#b9b5ac')); });
    side.receiveShadow = true; scene.add(side);
    const greens = G.blocks.filter(B => B.green && !B.bare);
    const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ roughness: .95 }), Math.max(1, greens.length));
    greens.forEach((B, i) => { gm.setMatrixAt(i, M4.compose(V.set(B.cx, B.y - .2, B.cz), Q.identity(), S.set(B.w - 4, .85 + B.slope, B.d - 4))); gm.setColorAt(i, c.set(B.zone === 'riverside' ? '#6aa04a' : '#5f9a42')); });
    gm.receiveShadow = true; scene.add(gm);
    /* lagos nos parques */
    G.blocks.filter(B => B.zone === 'park' && B.main).forEach(B => { const p = new THREE.Mesh(new THREE.CircleGeometry(18, 28).rotateX(-Math.PI / 2), r3.pondM || (r3.pondM = Arcade3D.water({ color: '#2a6a72', shallow: '#3f8f86', tile: 9, chop: .6, foam: 0, env: r3.env }))); p.position.set(B.cx + 10, B.y + .75, B.cz - 8); p.scale.set(1.4, 1, 1); scene.add(p); });
    /* edifícios especiais */
    G.anims = [];
    const at = zone => G.blocks.filter(B => B.zone === zone && B.main);
    at('stadium').forEach(B => special(G, 'stadium', B.cx, B.cz, { tough: 1.4 }));
    at('arena').forEach(B => special(G, 'arena', B.cx, B.cz, { tough: 1.3 }));
    at('museum').forEach(B => special(G, 'museum', B.cx, B.cz, { rot: Math.PI }));
    at('modern').forEach(B => special(G, 'modern', B.cx, B.cz));
    at('cathedral').forEach(B => special(G, 'cathedral', B.cx, B.cz, { tough: 1.3 }));
    at('school').forEach(B => special(G, 'school', B.cx, B.cz));
    at('plaza').forEach((B, k) => { special(G, k ? 'statue' : 'obelisk', B.cx, B.cz); for (let i = 0; i < 6; i++) G.trees.push({ x: B.x0 + 6 + (i % 3) * (B.w - 12) / 2, z: i < 3 ? B.z0 + 6 : B.z0 + B.d - 6, s: .9 }); });
    at('fun').forEach(B => { special(G, 'ferris', B.cx - 30, B.cz - 10); special(G, 'coaster', B.cx + 50, B.cz + 30); special(G, 'carousel', B.cx - 30, B.cz + 50); special(G, 'tent', B.cx + 60, B.cz - 40); });
    at('factory').forEach(B => { special(G, 'chimney', B.cx + B.w * .3, B.cz - B.d * .3, { y: B.y }); G.addB(B.cx - 8, B.cz + 6, B.w * .6, B.d * .5, rand(12, 18), 6); });
    at('tanks').forEach(B => special(G, 'tanks', B.cx, B.cz));
    at('silos').forEach(B => special(G, 'silos', B.cx, B.cz));
    const pk = at('park')[0]; if (pk) special(G, 'tvtower', pk.x0 + 10, pk.z0 + 10, { tough: 2 });
    special(G, 'castle', HILL[0], HILL[1], { tough: 2 });
    special(G, 'arch', G.xs[G.xs.findIndex(x => x > 430)] || 430, G.zs[G.zs.findIndex(z => z > 170)] || 170, { y: 4 });
    const port = G.blocks.filter(B => B.zone === 'port').sort((a, b) => b.cx - a.cx)[0];
    if (port) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 160), Wd.plainMat('#8a8478', null, { roughness: .9 })); pier.position.set(port.cx, 2.5, COAST + 70); pier.receiveShadow = true; scene.add(pier);
      special(G, 'lighthouse', port.cx, COAST + 140, { y: 4 });
    }
    genExtras(G);
    roadNet(G);
    /* ruas: um troço de asfalto por quarteirão (só onde é plano e fora do rio) + tracejado */
    const segs = [], marks = [];
    G.zs.forEach((z, j) => G.xs.slice(0, -1).forEach((x, i) => { if (G.hOK[j][i] && !G.hBr[j][i]) { segs.push([(x + G.xs[i + 1]) / 2, z, G.xs[i + 1] - x + ROAD, ROAD]); for (let t = x + 8; t < G.xs[i + 1] - 4; t += 9) marks.push([t, z, 1]); } }));
    G.xs.forEach((x, i) => G.zs.slice(0, -1).forEach((z, j) => { if (G.vOK[i][j]) { segs.push([x, (z + G.zs[j + 1]) / 2, ROAD, G.zs[j + 1] - z + ROAD]); for (let t = z + 8; t < G.zs[j + 1] - 4; t += 9) marks.push([x, t, 0]); } }));
    const rdm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: .92 }), Math.max(1, segs.length));
    segs.forEach(([x, z, w, d], i) => rdm.setMatrixAt(i, M4.compose(V.set(x, 3.75, z), Q.identity(), S.set(w, .4, d))));
    rdm.receiveShadow = true; scene.add(rdm);
    const mm = new THREE.InstancedMesh(new THREE.PlaneGeometry(.35, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#d9d4c0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), Math.max(1, marks.length));
    marks.forEach(([x, z, r], i) => mm.setMatrixAt(i, M4.compose(V.set(x, 4.17, z), Q.setFromAxisAngle(V.set(0, 1, 0), r ? Math.PI / 2 : 0), S.set(1, 1, 1))));
    scene.add(mm);
    /* edifícios normais: uma InstancedMesh por estilo */
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
    r3.bm = STY.map((sty, si) => {
      const list = G.builds.filter(b => b.sty === si && !b.mesh);
      const m = new THREE.InstancedMesh(box, facadeMat(G, sty), Math.max(1, list.length));
      list.forEach((b, i) => { b.mi = i; m.setColorAt(i, c.set(b.col)); });
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
      return m;
    });
    /* telhados de duas águas (moradias e casario antigo) */
    const rs = new THREE.Shape(); rs.moveTo(-.5, 0); rs.lineTo(.5, 0); rs.lineTo(0, 1); rs.lineTo(-.5, 0);
    const rg = new THREE.ExtrudeGeometry(rs, { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -.5);
    const roofed = G.builds.filter(b => b.roof);
    r3.roofs = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ roughness: .8 }), Math.max(1, roofed.length));
    roofed.forEach((b, i) => { b.ri = i; r3.roofs.setColorAt(i, c.set(b.sty === 5 ? ['#b5532f', '#c0613a', '#a84a2c', '#c86a40'][i % 4] : ['#a14a34', '#8a3b2a', '#5a4a42', '#6e3b30', '#7a5a3a'][i % 5])); });
    r3.roofs.castShadow = true; r3.roofs.frustumCulled = false; scene.add(r3.roofs);
    G.builds.forEach(b => syncB(G, b));
    /* contentores e gruas no porto */
    const conts = [];
    G.blocks.filter(b => b.containers).forEach(B => { for (let k = 0; k < Math.round(B.w * .5); k++) conts.push([B.x0 + rand(6, B.w - 6), B.cz + rand(4, B.d / 2 - 4), Math.floor(rand(0, 3))]); });
    r3.cont = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.5).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ roughness: .6, metalness: .3 }), Math.max(1, conts.length));
    conts.forEach(([x, z, s], i) => { r3.cont.setMatrixAt(i, M4.compose(V.set(x, 4.3 + s * 2.6, z), Q.setFromAxisAngle(V.set(0, 1, 0), Math.round(rand(0, 1)) * Math.PI / 2), S.set(1, 1, 1))); r3.cont.setColorAt(i, c.set(['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#909497'][i % 6])); });
    r3.cont.castShadow = true; scene.add(r3.cont); G.conts = conts.map(([x, z, s]) => ({ x, z, s, alive: true }));
    G.blocks.filter(b => b.containers).slice(0, 5).forEach(B => {
      const g = new THREE.Group(), m = Wd.plainMat('#e2a51c', null, { metalness: .3, roughness: .5 });
      [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, z]) => Wd.addMesh(g, new THREE.BoxGeometry(1.5, 34, 1.5), m, x, 17, z));
      Wd.addMesh(g, new THREE.BoxGeometry(2.4, 2.4, 60), m, 0, 35, 12);
      g.position.set(B.cx + 20, 4, B.z0 + B.d + 18); scene.add(g);
    });
    /* chapéus de sol na praia */
    const umbs = [];
    G.blocks.filter(b => b.umbrellas).forEach(B => { for (let k = 0; k < 22; k++) umbs.push([B.x0 + rand(4, B.w - 4), B.z0 + B.d + rand(14, 70)]); });
    for (let k = 0; k < 160; k++) { const x = rand(CX0 - 300, 200), z = COAST + rand(-60, 20); if (hAt(G, x, z) > .8 && hAt(G, x, z) < 4) umbs.push([x, z]); }
    if (umbs.length) {
      const ug = Wd.mergeGeos([[new THREE.ConeGeometry(2.4, 1.2, 10), '#ffffff', Wd.M4(0, 2.6, 0)], [new THREE.CylinderGeometry(.06, .06, 2.6, 4), '#dddddd', Wd.M4(0, 1.3, 0)]]);
      const um = new THREE.InstancedMesh(ug, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 }), umbs.length);
      umbs.forEach(([x, z], i) => { um.setMatrixAt(i, M4.compose(V.set(x, hAt(G, x, z), z), Q.identity(), S.set(1, 1, 1))); um.setColorAt(i, c.set(['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#ffffff'][i % 6])); });
      scene.add(um);
    }
    /* campos de cultivo (modo Região) */
    if (G.fields.length) {
      const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.MeshStandardMaterial({ roughness: .95 }), G.fields.length);
      G.fields.forEach((f, i) => { fm.setMatrixAt(i, M4.compose(V.set(f.x, hAt(G, f.x, f.z) - .4, f.z), Q.setFromAxisAngle(V.set(0, 1, 0), f.r), S.set(f.w, 1, f.d))); fm.setColorAt(i, c.set(f.c)); });
      fm.receiveShadow = true; scene.add(fm);
    }
    /* árvores (folhosas, pinheiros e palmeiras) */
    const kinds = { leaf: G.trees.filter(t => !t.kind), pine: G.trees.filter(t => t.kind === 'pine'), palm: G.trees.filter(t => t.kind === 'palm') };
    r3.treeMeshes = {};
    Object.keys(kinds).forEach(kk => {
      const list = kinds[kk]; if (!list.length) return;
      const m = new THREE.InstancedMesh(Wd.treeGeo(kk), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }), list.length);
      list.forEach((t, i) => { t.i = i; t.m = m; t.alive = true; t.burn = 0; m.setColorAt(i, c.set(t.wild ? '#3a6b2c' : '#4a8a36').lerp(new THREE.Color('#9ab84a'), rand(0, .5))); });
      m.castShadow = true; m.frustumCulled = false; scene.add(m); r3.treeMeshes[kk] = m;
    });
    r3.trees = r3.treeMeshes.leaf;
    treesSync(G);
    /* carros e pessoas */
    genTraffic(G);
    /* barcos */
    r3.boats = [];
    for (let k = 0; k < 8; k++) { const g = boatMesh(G, k); const x = -1100 + k * 330 + rand(-60, 60), z = COAST + 260 + rand(0, 600); g.position.set(x, 0, z); g.rotation.y = rand(0, TAU); scene.add(g); r3.boats.push({ g, x, z, a: g.rotation.y, v: rand(2, 5), vy: 0, y: 0 }); }
    /* candeeiros de rua (só de noite) */
    const lamps = [];
    G.xs.forEach(x => { for (let z = CZ0 + 25; z < CZ1; z += 48) if (Math.abs(x - riverX(z)) > RIVER_W / 2 + 6) lamps.push(x + 7.5, hAt(G, x, z) + 8, z); });
    G.zs.forEach(z => { for (let x = CX0 + 25; x < CX1; x += 48) if (Math.abs(x - riverX(z)) > RIVER_W / 2 + 6) lamps.push(x, hAt(G, x, z) + 8, z + 7.5); });
    (G.bridges || []).forEach(br => { for (let x = br.x0; x < br.x1; x += 24) lamps.push(x, br.y + 7, br.z + 8, x, br.y + 7, br.z - 8); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
    r3.lamps = new THREE.Points(lg, new THREE.PointsMaterial({ map: Arcade3D.glowTex(), color: '#ffcf8a', size: 16, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(r3.lamps);
    /* grelha espacial dos edifícios */
    G.bgrid = new Map(); G.builds.forEach(b => { const k = gkey(b.x, b.z); (G.bgrid.get(k) || G.bgrid.set(k, []).get(k)).push(b); });
  }
  const gkey = (x, z) => Math.floor((x + 5000) / 60) * 1000 + Math.floor((z + 5000) / 60);
  function buildsNear(G, x, z, r, fn) {
    const i0 = Math.floor((x - r + 5000) / 60), i1 = Math.floor((x + r + 5000) / 60), j0 = Math.floor((z - r + 5000) / 60), j1 = Math.floor((z + r + 5000) / 60);
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
      b.mesh.position.set(b.x + (b.sway || 0) * 4, (b.y != null ? b.y : 4) - (b.sink || 0), b.z); b.mesh.rotation.set(b.tilt ? b.tilt[0] : 0, 0, b.tilt ? b.tilt[1] : 0);
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
      if (!t.m) return;
      e.set(t.fall || 0, t.i * 1.7, 0); q.setFromEuler(e); s.setScalar(t.alive ? t.s : 0); p.set(t.x, hAt(G, t.x, t.z) - .3, t.z); m.compose(p, q, s); t.m.setMatrixAt(t.i, m);
      if (t.burnt && !t.tinted) { t.tinted = 1; t.m.setColorAt(t.i, c.set('#2a2420')); }
    });
    Object.values(G.r3.treeMeshes || {}).forEach(tm => { tm.instanceMatrix.needsUpdate = true; if (tm.instanceColor) tm.instanceColor.needsUpdate = true; });
  }

  /* ════════════════════════════════════════════════════════════════
     trânsito e peões
  ════════════════════════════════════════════════════════════════ */
  function genTraffic(G) {
    const Wd = W(), r3 = G.r3, scene = r3.scene, c = new THREE.Color(), xs = G.xs, zs = G.zs;
    /* troços das ruas utilizáveis: o rio corta-os, exceto onde há ponte */
    const pathsN = (G.paths || []).length;
    const nGrid = G.big ? (G.region ? 1000 : 1100) : 420, nPath = pathsN * (G.big ? 10 : 5), nCars = nGrid + nPath, nPeople = G.big ? 3200 : 1200;
    const M4 = Wd.M4;
    const carGeo = Wd.mergeGeos([[new THREE.BoxGeometry(1.9, .8, 4.4), '#ffffff', M4(0, .75, 0)], [new THREE.BoxGeometry(1.7, .7, 2.3), '#1b2430', M4(0, 1.45, -.2)], ...[[-.95, 1.3], [.95, 1.3], [-.95, -1.3], [.95, -1.3]].map(([x, z]) => [new THREE.CylinderGeometry(.36, .36, .3, 8), '#151515', M4(x, .36, z, 0, 0, Math.PI / 2)])]);
    r3.cars = new THREE.InstancedMesh(carGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .4 }), nCars);
    r3.cars.castShadow = true; r3.cars.frustumCulled = false; r3.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(r3.cars);
    const cols = ['#c0392b', '#e5e7e9', '#1b2631', '#2e86c1', '#7f8c8d', '#f1c40f', '#ecf0f1', '#145a32', '#5b2c6f', '#a04000'];
    for (let i = 0; i < nGrid; i++) {
      let car = null;
      for (let tries = 0; tries < 30 && !car; tries++) {
        const horiz = Math.random() < .5, line = Math.floor(rand(0, (horiz ? zs : xs).length)), arr = horiz ? xs : zs, seg = Math.floor(rand(0, arr.length - 1));
        if (!(horiz ? G.hOK[line][seg] : G.vOK[line][seg])) continue;
        const dir = Math.random() < .5 ? 1 : -1;
        car = { i, horiz, line, dir, s: rand(arr[seg], arr[seg + 1]), ni: dir > 0 ? seg + 1 : seg, v: rand(9, 15), alive: true, fly: 0, x: 0, y: 4, z: 0, a: 0, wreck: 0 };
      }
      if (!car) car = { i, horiz: true, line: 0, dir: 1, s: xs[0], ni: 1, v: 10, alive: true, fly: 0, x: 0, y: 4, z: 0, a: 0, wreck: 0 };
      G.cars.push(car); r3.cars.setColorAt(i, c.set(cols[i % cols.length]));
    }
    /* carros nas estradas fora da grelha (aeroporto, aldeias) */
    (G.paths || []).forEach((pts, pi) => { const P = pts.dense; for (let k = 0; k < nPath / Math.max(1, pathsN); k++) { const i = G.cars.length; G.cars.push({ i, path: P, k: rand(0, P.length - 1), dir: Math.random() < .5 ? 1 : -1, v: rand(12, 20), alive: true, fly: 0, x: P[0][0], y: 4, z: P[0][1], a: 0, wreck: 0 }); r3.cars.setColorAt(i, c.set(cols[(i + pi) % cols.length])); } });
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
    const blocks = G.blocks.filter(b => b.zone !== 'port' && b.zone !== 'industrial');
    const wsum = blocks.reduce((a, b) => a + (b.zone === 'cbd' || b.zone === 'old' || b.zone === 'fun' || b.zone === 'beach' ? 3 : 1), 0);
    const pick = () => { let r = Math.random() * wsum; for (const b of blocks) { r -= (b.zone === 'cbd' || b.zone === 'old' || b.zone === 'fun' || b.zone === 'beach' ? 3 : 1); if (r <= 0) return b; } return blocks[0]; };
    for (let i = 0; i < nPeople; i++) {
      const B = pick(), per = (B.w + B.d) * 2;
      G.people.push({ i, B, s: rand(0, per), v: rand(1.2, 1.8) * (Math.random() < .5 ? 1 : -1), x: B.cx, z: B.cz, alive: true, run: 0, home: 1, anim: rand(0, 6) });
      r3.ppl.setColorAt(i, c.set(pc[i % pc.length]));
    }
  }
  const lanePos = (G, car) => car.horiz ? [car.s, G.zs[car.line] + car.dir * 3.4] : [G.xs[car.line] - car.dir * 3.4, car.s];
  /* cruzamento: seguir em frente, virar ou dar a volta (nunca para dentro do rio) */
  function decide(G, car) {
    const A = car.horiz ? G.xs : G.zs, B = car.horiz ? G.zs : G.xs, okA = car.horiz ? G.hOK : G.vOK, okB = car.horiz ? G.vOK : G.hOK;
    const i = car.ni, j = car.line, opts = [];
    const si = car.dir > 0 ? i : i - 1;
    if (si >= 0 && si < A.length - 1 && okA[j][si]) opts.push('S', 'S', 'S');
    if (j > 0 && okB[i] && okB[i][j - 1]) opts.push('-');
    if (j < B.length - 1 && okB[i] && okB[i][j]) opts.push('+');
    const o = opts.length ? opts[Math.floor(Math.random() * opts.length)] : 'U';
    if (o === 'S') car.ni = i + car.dir;
    else if (o === 'U') { car.dir *= -1; car.ni = i + car.dir; }
    else { car.horiz = !car.horiz; car.line = i; car.s = B[j]; car.dir = o === '+' ? 1 : -1; car.ni = j + car.dir; }
  }
  function trafficStep(G, dt) {
    const r3 = G.r3, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler(), up = new THREE.Vector3(0, 1, 0);
    const hp = r3.heads.geometry.attributes.position, night = G.uNight.value > .3;
    /* grelha de pânico (células de 80 m): cada carro/peão só testa as zonas da sua célula */
    const pg = new Map(), pk = (x, z) => Math.floor((x + 6000) / 80) * 1000 + Math.floor((z + 6000) / 80);
    for (const pz of G.panic) { const R = pz.r * 2.5, i0 = Math.floor((pz.x - R + 6000) / 80), i1 = Math.floor((pz.x + R + 6000) / 80), j0 = Math.floor((pz.z - R + 6000) / 80), j1 = Math.floor((pz.z + R + 6000) / 80); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i * 1000 + j; (pg.get(k) || pg.set(k, []).get(k)).push(pz); } }
    const NONE = [], panicAt = (x, z) => pg.get(pk(x, z)) || NONE;
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
      let v = car.v, x, z;
      for (const pz of panicAt(car.x, car.z)) if (Math.hypot(car.x - pz.x, car.z - pz.z) < pz.r * 2.5) { v *= 2.2; break; }
      if (car.path) {
        /* estrada fora da grelha: vai e volta */
        const P = car.path, k0 = Math.floor(clamp(car.k, 0, P.length - 2)), a = P[k0], b = P[k0 + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        car.k += car.dir * v * dt / L;
        if (car.k >= P.length - 1) { car.k = P.length - 1.001; car.dir = -1; } if (car.k <= 0) { car.k = 0; car.dir = 1; }
        const f = car.k - k0, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
        x = lerp(a[0], b[0], clamp(f, 0, 1)) - dz * car.dir * 3; z = lerp(a[1], b[1], clamp(f, 0, 1)) + dx * car.dir * 3;
        car.a = Math.atan2(dx * car.dir, dz * car.dir);
        car.y = Math.max(hAt(G, x, z), 1) + .35;
      } else {
        const arr = car.horiz ? G.xs : G.zs, tgt = arr[car.ni];
        car.s += car.dir * v * dt;
        if (tgt == null || (car.dir > 0 && car.s >= tgt) || (car.dir < 0 && car.s <= tgt)) { if (tgt != null) car.s = tgt; else { car.dir *= -1; car.ni = clamp(car.ni + car.dir * 2, 0, arr.length - 1); } decide(G, car); }
        [x, z] = lanePos(G, car);
        car.a = car.horiz ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
        const gy = hAt(G, x, z);
        car.y = gy < 3 && car.horiz ? 6.85 : Math.max(gy, 1);
      }
      car.x = x; car.z = z;
      q.setFromAxisAngle(up, car.a); m.compose(p.set(x, car.y, z), q, s); r3.cars.setMatrixAt(car.i, m);
      if (night) hp.setXYZ(car.i, x + Math.sin(car.a) * 2.4, car.y + .9, z + Math.cos(car.a) * 2.4); else hp.setXYZ(car.i, 0, -100, 0);
      /* inundação: o carro flutua e é arrastado */
      if (G.sea > car.y + .6) { car.wreck = 1; car.float = 1; car.rx = rand(-.3, .3); car.rz = rand(-.3, .3); }
    }
    r3.cars.instanceMatrix.needsUpdate = true; hp.needsUpdate = true;
    /* peões: à volta do quarteirão, a fugir do perigo */
    for (const pp of G.people) {
      if (!pp.alive) { if (pp.hid !== 1) { pp.hid = 1; s.set(0, 0, 0); m.compose(p.set(0, -100, 0), q, s); r3.ppl.setMatrixAt(pp.i, m); s.set(1, 1, 1); } continue; }
      pp.anim += dt * 8;
      let fleeing = null;
      for (const pz of panicAt(pp.x, pp.z)) { const d = Math.hypot(pp.x - pz.x, pp.z - pz.z); if (d < pz.r * 2.2 && (!fleeing || d < fleeing.d)) fleeing = { pz, d }; }
      const B = pp.B;
      if (fleeing) {
        const dx = pp.x - fleeing.pz.x, dz = pp.z - fleeing.pz.z, d = fleeing.d || 1;
        pp.x += dx / d * 6 * dt; pp.z += dz / d * 6 * dt; pp.run = 1; pp.fa = Math.atan2(dx, dz);
        if (d < fleeing.pz.r * .6) { pp.alive = false; G.stats.evac = (G.stats.evac || 0) + 1; burstP(G, pp.x, hAt(G, pp.x, pp.z) + 2, pp.z, '#ffffff', 2); continue; }
      } else if (pp.run) {
        pp.run = Math.max(0, pp.run - dt * .2);
        if (pp.run <= 0) { pp.x = clamp(pp.x, B.x0, B.x0 + B.w); pp.z = clamp(pp.z, B.z0, B.z0 + B.d); }
      } else {
        const w = B.w, d = B.d, per = (w + d) * 2, o = 2.2;
        pp.s = (pp.s + pp.v * dt + per) % per;
        let sx, sz, fa; const t = pp.s;
        if (t < w) { sx = B.x0 + t; sz = B.z0 + o; fa = Math.PI / 2; }
        else if (t < w + d) { sx = B.x0 + w - o; sz = B.z0 + (t - w); fa = 0; }
        else if (t < 2 * w + d) { sx = B.x0 + w - (t - w - d); sz = B.z0 + d - o; fa = -Math.PI / 2; }
        else { sx = B.x0 + o; sz = B.z0 + d - (t - 2 * w - d); fa = Math.PI; }
        pp.x = sx; pp.z = sz; pp.fa = fa + (pp.v < 0 ? Math.PI : 0);
      }
      const y = Math.max(B.y + .62, hAt(G, pp.x, pp.z)) + (pp.run ? Math.abs(Math.sin(pp.anim * 1.6)) * .3 : 0);
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
  /* grelhas espaciais (células de 60 m): árvores fixas; carros refeitos a cada frame */
  function cellsNear(map, x, z, r, fn) { const i0 = Math.floor((x - r + 6000) / 60), i1 = Math.floor((x + r + 6000) / 60), j0 = Math.floor((z - r + 6000) / 60), j1 = Math.floor((z + r + 6000) / 60); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = map.get(i * 1000 + j); if (a) for (const o of a) fn(o); } }
  const ckey = (x, z) => Math.floor((x + 6000) / 60) * 1000 + Math.floor((z + 6000) / 60);
  function treesNear(G, x, z, r, fn) { if (!G.tgrid) { G.tgrid = new Map(); G.trees.forEach(t => { const k = ckey(t.x, t.z); (G.tgrid.get(k) || G.tgrid.set(k, []).get(k)).push(t); }); } cellsNear(G.tgrid, x, z, r, fn); }
  function carsNear(G, x, z, r, fn) {
    if (G.cgridF !== G.fxFrame) { G.cgridF = G.fxFrame; const m = G.cgrid || (G.cgrid = new Map()); m.forEach(a => { a.length = 0; }); for (const c of G.cars) if (c.alive) { const k = ckey(c.x, c.z); (m.get(k) || m.set(k, []).get(k)).push(c); } }
    cellsNear(G.cgrid, x, z, r, c => { if (!c.alive) return; const d = Math.hypot(c.x - x, c.z - z); if (d < r) fn(c, d); });
  }

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
      treesNear(G, b.x, b.z, 45, t => { if (t.alive && !t.burnt && Math.abs(t.x - b.x) < 30 && Math.abs(t.z - b.z) < 30 && Math.random() < dt * .3) { t.burnt = 1; G.treeDirty = 1; } });
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
      case 'fire': { buildsNear(G, x, z, 6 + L * 6, b => ignite(G, b)); treesNear(G, x, z, 10 + L * 6, t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < 10 + L * 6) { t.burnt = 1; G.treeDirty = 1; } }); fireballFx(G, x, y + 2, z, 6 + L * 3); break; }
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
    treesNear(G, x, z, R, t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < R) { t.fall = rand(.8, 1.5); if (opt.fire) t.burnt = 1; G.treeDirty = 1; } });
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
        this.x = clamp(this.x, -WS / 2 + 200, WS / 2 - 200); this.z = clamp(this.z, -WS / 2 + 200, COAST + 100);
        const y = Math.max(0, hAt(G, this.x, this.z)), fade = Math.min(1, this.t / 2, (this.life - this.t) / 2);
        this.g.position.set(this.x, y, this.z); this.g.scale.set(fade, Math.max(.05, fade), fade); this.g.children.forEach((c, i) => { c.rotation.y += dt * (3 + i * .4); c.position.x = Math.sin(this.t * 2 + i) * i * 1.2; });
        for (let i = 0; i < 7; i++) { const a = rand(0, TAU), hh = rand(0, 260), r = this.R * (.4 + hh / 140); G.r3.smoke.spawn({ x: this.x + Math.cos(a) * r, y: y + hh, z: this.z + Math.sin(a) * r, vx: -Math.sin(a) * 40, vy: 8, vz: Math.cos(a) * 40, life: 1.4, s0: this.R * .5, s1: this.R * 1.1, c0: '#8a8072', a: .5 * fade }); }
        G.panic.push({ x: this.x, z: this.z, r: this.R * 3, t: .5 });
        buildsNear(G, this.x, this.z, this.R * 1.4, (b, d) => { damage(G, b, b.max * dt * (.25 + L * .12) * (1 - d / (this.R * 1.4)), [this.x, this.z]); if (Math.random() < dt * 4) spawnDebris(G, b.x, b.y + Math.min(b.h, 30) * Math.random(), b.z, rand(1, 3), rand(-10, 10), rand(5, 15), rand(-10, 10), b.col); });
        carsNear(G, this.x, this.z, this.R * 2.2, c => { if (!c.fly) throwCar(G, c, rand(-8, 8), rand(14, 26), rand(-8, 8)); });
        treesNear(G, this.x, this.z, this.R * 1.6, t => { if (t.alive && Math.hypot(t.x - this.x, t.z - this.z) < this.R * 1.6) { t.alive = false; G.treeDirty = 1; spawnDebris(G, t.x, hAt(G, t.x, t.z) + 4, t.z, 2, rand(-5, 5), 18, rand(-5, 5), '#4a3a2a'); } });
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
          treesNear(G, f.x, f.z, 30, t => { if (t.alive && !t.burnt && Math.abs(t.x - f.x) < 20 && Math.abs(t.z - f.z) < 20) { t.burnt = 1; G.treeDirty = 1; } });
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
        treesNear(G, x, z, this.R * .6, t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < this.R * .6) { t.alive = false; G.treeDirty = 1; spawnDebris(G, t.x, hAt(G, t.x, t.z) + 4, t.z, 2, 0, 10, 0, '#3e6b2a'); } });
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
    G.trees.forEach(t => { t.alive = true; t.burnt = 0; t.tinted = 0; t.fall = 0; if (t.m) t.m.setColorAt(t.i, _col.set(t.wild ? '#3a6b2c' : '#4a8a36')); }); treesSync(G);
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
    /* zonas de pânico: os perigos empurram uma por frame — fundir as repetidas (senão são centenas e o trânsito testa todas) */
    const pm = new Map();
    for (const p of G.panic) { if ((p.t -= dt) <= 0) continue; const k = Math.round(p.x / 40) + ',' + Math.round(p.z / 40) + ',' + Math.round(p.r / 25); const o = pm.get(k); if (!o || o.t < p.t) pm.set(k, p); }
    G.panic = [...pm.values()];
    for (let i = G.haz.length - 1; i >= 0; i--) { const h = G.haz[i]; h.t += dt; h.step(G, dt); if (h.t >= h.life) { h.end && h.end(G); G.haz.splice(i, 1); } }
    fallStep(G, dt); fireStep(G, dt); debrisStep(G, dt); trafficStep(G, dt);
    G.r3.boats.forEach(bt => { if (!bt.surf) { bt.a += dt * .03; bt.x += Math.cos(bt.a) * bt.v * dt; bt.z += Math.sin(bt.a) * bt.v * dt; bt.y = lerp(bt.y, Math.max(G.sea, 0), dt); } bt.g.position.set(bt.x, bt.y + Math.sin(G.t + bt.x) * .4, bt.z); bt.g.rotation.y = -bt.a + Math.PI / 2; });
    G.anims.forEach(a => { if (a.b.alive && a.b.state === 'ok') a.fn(dt, G); });
    flyerStep(G, dt);
    if (G.treeDirty && G.fxFrame % 4 === 0) { G.treeDirty = 0; treesSync(G); }
    if (G.dirtyT && G.fxFrame % 4 === 0) refreshTerrain(G);
    if (G.wdDirty && G.r3.water && G.t - (G.wdT || -9) > 1) { G.wdDirty = false; G.wdT = G.t; Arcade3D.waterDepth(G.r3.water.material, seaDepth(G)); }
    G.r3.smoke.update(dt); G.r3.fire.update(dt);
    G.r3.flash.intensity *= Math.max(0, 1 - dt * 6);
    G.shake = Math.max(0, G.shake - dt * 3);
    if (G.r3.flashUI) G.r3.flashUI = Math.max(0, G.r3.flashUI - dt * 1.5);
    /* reconstrução animada */
    G.builds.forEach(b => { if (b.rise) { b.rise = Math.max(0, b.rise - dt * .8); if (b.rise > 0 && !b.mesh) { b.sink = b.rise * b.h; syncB(G, b); } else if (b.rise === 0) { b.sink = 0; syncB(G, b); b.rise = 0; } } });
    G.msg.forEach(m => { m.life -= dt; }); G.msg = G.msg.filter(m => m.life > 0);
    uiTick(G);
  }
  /* um avião descola, dá uma volta larga e aterra (ciclo de 70 s) */
  function flyerStep(G, dt) {
    const F = G.flyer; if (!F) return;
    F.t = (F.t + dt) % 70;
    const A = AIRPORT, t = F.t, g = F.g;
    let x = A.x, y = 7, z = A.z1 - 40, yaw = Math.PI, pitch = 0, roll = 0;
    if (t < 14) { const k = t / 14; z = lerp(A.z1 - 40, A.z0 + 200, k * k); }
    else if (t < 22) { const k = (t - 14) / 8; z = lerp(A.z0 + 200, A.z0 - 500, k); y = 7 + k * k * 140; pitch = .22; }
    else if (t < 52) { const k = (t - 22) / 30, a = Math.PI + k * TAU; x = A.x - 900 + Math.cos(a) * -900 - 900 * 0; z = lerp(A.z0 - 500, A.z1 + 300, .5) + Math.sin(a) * 1100; y = 150 + Math.sin(k * Math.PI) * 220; yaw = a + Math.PI / 2; roll = -.35; x = A.x - 900 - Math.cos(a) * 900; }
    else { const k = (t - 52) / 18; x = A.x; z = lerp(A.z1 + 800, A.z1 - 40, k); y = lerp(150, 7, Math.min(1, k * 1.3)); yaw = Math.PI; pitch = k < .75 ? -.06 : 0; }
    g.position.set(x, y, z); g.rotation.set(pitch, yaw, roll, 'YXZ');
  }
  function camKeys(G, dt) {
    const k = G.keys, c = G.cam, sp = c.dist * 1.1 * dt;
    let mx = 0, mz = 0;
    if (k.KeyW || k.ArrowUp) mz -= 1; if (k.KeyS || k.ArrowDown) mz += 1; if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyQ) c.yaw += dt * 1.2; if (k.KeyE) c.yaw -= dt * 1.2;
    if (k.KeyR) c.pitch = clamp(c.pitch + dt * .6, .12, 1.45); if (k.KeyF) c.pitch = clamp(c.pitch - dt * .6, .12, 1.45);
    if (mx || mz) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); c.tx += (mx * co + mz * s) * sp; c.tz += (-mx * s + mz * co) * sp; G.cine = false; }
    if (G.cine) { c.yaw += dt * .08; c.tdist = lerp(c.tdist, 1300 + Math.sin(G.t * .1) * 400, dt * .2); c.pitch = lerp(c.pitch, .35 + Math.sin(G.t * .07) * .12, dt * .3); }
    c.tx = clamp(c.tx, -WS / 2 + 200, WS / 2 - 200); c.tz = clamp(c.tz, -WS / 2 + 200, COAST + 500);
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
    cam.lookAt(c.x, gy + c.dist * .04, c.z);
    /* plano próximo proporcional à distância: sem isto, água e praia (quase coplanares) piscam ao longe */
    const near = clamp(c.dist * .012, 2.5, 30); if (Math.abs(cam.near - near) > near * .1) { cam.near = near; cam.far = 22000; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    r3.skyM.position.copy(cam.position); r3.skyM.material.uniforms.uTime.value = G.t;
    r3.water.position.y = G.sea;
    Arcade3D.waterTick(r3.water.material, G.t, cam); if (r3.pondM) Arcade3D.waterTick(r3.pondM, G.t, cam);
    /* sombra acompanha a vista */
    /* sombras estáveis: tamanho em degraus e centro alinhado à grelha de texels (não cintilam ao mover a câmara) */
    const ext = clamp(Math.ceil(c.dist * .7 / 150) * 150, 300, 1500), texel = ext * 2 / r3.sun.shadow.mapSize.x * 4;
    const sx = Math.round(c.x / texel) * texel, sz = Math.round(c.z / texel) * texel;
    r3.sun.position.set(sx + r3.sunDir.x * 2500, r3.sunDir.y * 2500 + 50, sz + r3.sunDir.z * 2500); r3.sun.target.position.set(sx, 0, sz);
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
.fw-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.fw-c{position:relative;border:0;border-radius:18px;padding:18px 16px;min-height:150px;color:#fff;font:inherit;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s}
.fw-c:hover{transform:translateY(-3px)}.fw-c small{display:block;font:700 .66rem 'Space Grotesk';letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.fw-c b{display:block;font:800 1.15rem 'Space Grotesk';margin:3px 0 6px}.fw-c p{margin:0;font-size:.8rem;line-height:1.35;opacity:.92}
</style><div class="fw-m">
  <button class="fw-c" data-m="city" style="background:linear-gradient(150deg,#ff8a3a,#5a1e10)"><small>Recomendado em computador</small><b>☄️ Cidade</b><p>Baixa de arranha-céus, casario antigo colorido, rio com pontes, colina com castelo, estádios, museus, catedral, parque de diversões, fábricas, porto, praia e aeroporto.</p></button>
  <button class="fw-c" data-m="region" style="background:linear-gradient(150deg,#3aa86a,#0e3a24)"><small>Mundo maior · para máquinas fortes</small><b>🏞️ Região com aldeias</b><p>A mesma cidade num mundo quase quatro vezes maior: aldeias com igreja e campos, estradas rurais, quintas e um parque eólico.</p></button>
  <button class="fw-c" data-m="lite" style="background:linear-gradient(150deg,#3a8aff,#10225a)"><small>${coarse ? 'Recomendado neste aparelho' : 'Para máquinas mais modestas'}</small><b>🏙️ Cidade leve</b><p>A cidade completa, com menos trânsito, gente e destroços — corre bem em telemóveis e portáteis.</p></button>
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
