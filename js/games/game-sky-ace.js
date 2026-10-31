/* ══════════════════════════════════════════════════════════════════
   Ás dos Céus — combate aéreo em 3D (out/2026)
   Campanha de 6 missões, Arena (vagas sem fim) e Voo livre, em 6 mapas
   procedurais de 24 km (ver sky-ace-world.js). Os inimigos são drones
   autónomos, sem piloto: nada de sangue, só faíscas, fumo e destroços.

   Voo: modelo arcade com energia — a velocidade cai a subir e cresce a
   picar; a curva máxima está limitada a G (travar aperta a curva), há
   perda de sustentação abaixo da velocidade mínima. Pilotagem Normal
   (inclina e curva sozinho, nivela ao largar) ou Especialista (rolamento
   direto). Armas: metralhadora com aquecimento e mira de avanço, mísseis
   com bloqueio (2 carris que recarregam), arma especial do avião
   (multi-alvo / alta manobra / bombas guiadas) e flares contra mísseis.
   Comandos: teclado, comando (Gamepad API) e toque.
══════════════════════════════════════════════════════════════════ */
const SkyAceGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2, DEG = Math.PI / 180, G0 = 9.81;
  const clamp = U.clamp, lerp = U.lerp, rand = U.rand;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const W = () => SkyAceWorld;
  const ID = 'sky-ace';

  /* ════════════════════════════════════════════════════════════════
     aviões, armas, inimigos, dificuldade
  ════════════════════════════════════════════════════════════════ */
  const PLANES = {
    falcon: { name: 'Falcão', role: 'Polivalente', desc: 'Equilibrado em tudo. A arma especial bloqueia até 4 alvos aéreos de uma vez.',
      cruise: 200, max: 390, min: 78, pitch: 1.0, roll: 3.4, yaw: .3, gmax: 17, hp: 100, msl: 72, sp: 'mlaa', spN: 16, stat: [4, 4, 3, 4] },
    wasp: { name: 'Vespa', role: 'Interceção', desc: 'O mais rápido e ágil, mas menos resistente. Míssil especial de alta manobra.',
      cruise: 210, max: 410, min: 72, pitch: 1.18, roll: 4.3, yaw: .36, gmax: 19.5, hp: 80, msl: 64, sp: 'qaam', spN: 14, stat: [5, 5, 2, 3] },
    thunder: { name: 'Trovão', role: 'Ataque', desc: 'Pesado e blindado, com mais mísseis. Bombas guiadas para alvos em terra e no mar.',
      cruise: 195, max: 370, min: 84, pitch: .86, roll: 2.8, yaw: .27, gmax: 15, hp: 135, msl: 88, sp: 'bomb', spN: 16, stat: [3, 3, 5, 5] },
  };
  const SPECIAL = { mlaa: { name: 'Multi-alvo', short: 'MLAA' }, qaam: { name: 'Alta manobra', short: 'QAAM' }, bomb: { name: 'Bombas guiadas', short: 'BMB' } };
  const DIFF = {
    easy: { dmg: .55, aiTurn: .78, aiCd: 1.7, aiLock: 1.9, eMsl: 1.0, flak: 120, gcas: true, lockT: .32, detect: .55, regen: 1, dodgeE: .65, dodgeP: 1.15 },
    medium: { dmg: 1, aiTurn: 1, aiCd: 1, aiLock: 1.3, eMsl: 1.28, flak: 80, gcas: false, lockT: .45, detect: 1, regen: 0, dodgeE: 1, dodgeP: 1 },
    hard: { dmg: 1.4, aiTurn: 1.16, aiCd: .7, aiLock: .95, eMsl: 1.5, flak: 55, gcas: false, lockT: .55, detect: 1.6, regen: 0, dodgeE: 1.25, dodgeP: .8 },
  };
  /* tipos de inimigo — todos autónomos (sem piloto) */
  const ET = {
    scout: { name: 'DRONE-ALVO', hp: 40, pts: 300, air: 1, speed: 125, turn: .35, r: 8, wander: 1 },
    balloon: { name: 'BALÃO', hp: 14, pts: 150, air: 1, fixed: 1, r: 13 },
    fighter: { name: 'DRONE-C', hp: 100, pts: 400, air: 1, speed: 200, turn: .62, r: 10, arm: 1, evade: .9, dodge: .24 },
    ace: { name: 'ESPECTRO', hp: 220, pts: 1000, air: 1, speed: 228, turn: .86, r: 10, arm: 1, evade: 2.4, flares: 1, ace: 1, dodge: .4 },
    heavy: { name: 'CARGUEIRO', hp: 340, pts: 700, air: 1, speed: 120, turn: .16, r: 32, cruise: 1, size: 4 },
    radar: { name: 'RADAR', hp: 120, pts: 300, r: 16 },
    sam: { name: 'SAM', hp: 110, pts: 350, r: 11, sam: 1 },
    aa: { name: 'ANTIAÉREA', hp: 80, pts: 200, r: 8, aa: 1 },
    depot: { name: 'DEPÓSITO', hp: 160, pts: 250, r: 20 },
    tower: { name: 'ANTENA', hp: 90, pts: 200, r: 10 },
    core: { name: 'NÚCLEO', hp: 700, pts: 2500, r: 32, size: 6 },
    ship: { name: 'NAVIO-DRONE', hp: 320, pts: 800, r: 45, sam: 1, aa: 1, ship: 1, size: 4 },
    fort: { name: 'FORTALEZA', hp: 1, pts: 0, r: 150, noTarget: 1, speed: 62, turn: .06 },
    engine: { name: 'MOTOR', hp: 480, pts: 1200, r: 18, size: 4 },
    fcore: { name: 'NÚCLEO', hp: 950, pts: 5000, r: 15, size: 8 },
  };

  /* ════════════════════════════════════════════════════════════════
     missões (texto pt-PT) — posições em metros; y do ar é absoluto
     (nunca abaixo de 400 m acima do chão); terra: procura-se um sítio
     plano perto do ponto pedido
  ════════════════════════════════════════════════════════════════ */
  const SENA = 'SENA · Controlo', IRIS = 'ÍRIS · Aurora 2';
  const canyonPts = () => { const X = W().canyonX, out = []; for (let z = 8300; z >= -5600; z -= 1550) out.push([X(z), 0, z, 'canyon']); return out; };
  const MISSIONS = [
    { id: 'm1', name: 'Primeiro Voo', map: 'coast', sky: 'morning', time: 900, par: 4200, start: [0, 760, 10100, 0],
      brief: 'Treino ao nascer do sol sobre a Costa Dourada: anéis, drones-alvo e balões.',
      phases: [
        { obj: 'Passa pelos anéis', rings: [[0, 720, 8400], [650, 820, 7000], [1500, 950, 5700], [1100, 1060, 4400], [-150, 960, 3400], [-1200, 860, 2500]],
          radio: [[SENA, 'Bom dia, Ás. Hoje é só treino: começa por passar pelos anéis.'], [SENA, 'W e S sobem e descem o nariz, A e D fazem a curva. Shift acelera, Z trava — travar aperta a curva.']] },
        { obj: 'Destrói os drones-alvo', spawn: [{ t: 'scout', n: 6, at: [0, 1300, -400], r: 1700 }], goal: 'all',
          radio: [[SENA, 'Seis drones-alvo à tua frente. Põe um dentro do círculo, espera que o losango fique vermelho e dispara com Espaço.'], [IRIS, 'Relaxa, estes não respondem. Usa o R para trocar de alvo.']] },
        { obj: 'Rebenta os balões de treino', spawn: [{ t: 'balloon', n: 8, at: [0, 0, -2600], r: 2600, agl: [140, 340] }], goal: 'all',
          radio: [[SENA, 'Agora os balões, mais em baixo, junto à costa. A metralhadora (F ou clique) chega: põe o nariz no círculo de mira.']] },
      ],
      end: [[SENA, 'Voo impecável. Bem-vindo à esquadrilha Aurora, Ás.']] },
    { id: 'm2', name: 'Muralha de Radares', map: 'alps', sky: 'noon', time: 960, par: 6800, start: [0, 2900, 10300, 0],
      brief: 'Três bases de radar escondidas nos vales da Cordilheira Branca, protegidas por SAM e antiaérea.',
      phases: [
        { obj: 'Destrói os radares e as baterias SAM', goal: 'tgt', spawn: [
          { t: 'radar', n: 1, at: [-3400, 0, -1800], tgt: 1 }, { t: 'sam', n: 1, at: [-3400, 0, -1800], r: 500, tgt: 1 }, { t: 'aa', n: 2, at: [-3400, 0, -1800], r: 700 },
          { t: 'radar', n: 1, at: [3200, 0, -3600], tgt: 1 }, { t: 'sam', n: 2, at: [3200, 0, -3600], r: 550, tgt: 1 }, { t: 'aa', n: 2, at: [3200, 0, -3600], r: 700 },
          { t: 'radar', n: 1, at: [600, 0, 1800], tgt: 1 }, { t: 'sam', n: 1, at: [600, 0, 1800], r: 500, tgt: 1 }, { t: 'aa', n: 2, at: [600, 0, 1800], r: 650 }, { t: 'tower', n: 2, at: [600, 0, 1800], r: 300 }],
          radio: [[SENA, 'Aurora 1, a rede de radares cobre os vales. Destrói os três radares e as baterias SAM marcadas TGT.'], [IRIS, 'Cuidado com os SAM — se ouvires o alarme, curva com força e larga flares (B).']] },
        { obj: 'Interceta os caças-drone', goal: 'all', spawn: [{ t: 'fighter', n: 4, at: [0, 3200, -10000], r: 500 }],
          radio: [[SENA, 'Contactos a norte! Quatro caças-drone vêm a caminho.'], [IRIS, 'Fica comigo, Ás. Já não estão às cegas.']] },
      ],
      end: [[SENA, 'Radares em silêncio. Bom trabalho, Aurora.']] },
    { id: 'm3', name: 'Enxame ao Pôr do Sol', map: 'isles', sky: 'sunset', time: 960, par: 9000, start: [-9200, 1700, 7600, 48],
      brief: 'Um enxame de drones cruza o Arquipélago Esmeralda. No fim do dia, chegam os Espectros.',
      phases: [
        { obj: 'Abate o primeiro enxame', goal: 'all', spawn: [{ t: 'fighter', n: 4, at: [-2200, 1900, 1200], r: 600 }, { t: 'fighter', n: 2, at: [1500, 2300, -2000], r: 400 }],
          radio: [[SENA, 'Seis drones sobre as ilhas. Limpa o céu, Ás.'], [IRIS, 'Que pôr do sol... depois admiramos. Agora, foco!']] },
        { obj: 'Derruba os cargueiros', goal: 'tgt', spawn: [{ t: 'heavy', n: 2, at: [5000, 1500, -5000], r: 500, tgt: 1, orbit: 5200 }, { t: 'fighter', n: 4, escort: 1, at: [5000, 1800, -5000], r: 300 }],
          radio: [[SENA, 'Dois cargueiros-drone com escolta a circular sobre o arquipélago. Os cargueiros são a prioridade.'], [IRIS, 'São lentos mas aguentam vários mísseis.']] },
        { obj: 'Enfrenta os Espectros', goal: 'all', spawn: [{ t: 'ace', n: 2, at: [0, 3200, -9500], r: 300 }, { t: 'fighter', n: 2, at: [600, 3000, -9800], r: 300 }],
          radio: [[SENA, 'Atenção: dois drones de elite — os Espectros. Esquivam-se e largam flares.'], [IRIS, 'Trava para apertar a curva e espera que eles errem. Tu consegues.']] },
      ],
      end: [[IRIS, 'Espectros no mar! Isso é que foi voar, Ás.']] },
    { id: 'm4', name: 'Frota Fantasma', map: 'ocean', sky: 'overcast', time: 780, par: 7800, start: [0, 1300, 10300, 0],
      brief: 'Uma frota de navios-drone ruma ao porto da Ilha Sentinela. Não a deixes chegar.',
      phases: [
        { obj: 'Afunda os navios-drone antes que cheguem ao porto', goal: 'tgt', ships: { dest: [2600, 0, 9400] }, spawn: [
          { t: 'ship', n: 5, at: [-1600, 0, -7200], r: 900, tgt: 1, water: 1 }, { t: 'fighter', n: 4, at: [0, 1500, -4500], r: 600 }, { t: 'heavy', n: 1, at: [-3000, 1300, -2000], orbit: 4200 }],
          radio: [[SENA, 'Cinco navios-drone a caminho do porto, a sul. Se um lá chegar, falhamos.'], [IRIS, 'Os navios disparam mísseis e antiaérea. Ataca de lado, baixo e rápido.']] },
        { obj: 'Defende o céu da ilha', goal: 'all', spawn: [{ t: 'fighter', n: 3, at: [0, 2200, -9500], r: 400 }, { t: 'ace', n: 1, at: [0, 2500, -9800] }],
          radio: [[SENA, 'Frota neutralizada! Mas vem aí uma vaga aérea com um Espectro.']] },
      ],
      end: [[SENA, 'O porto está seguro. A Sentinela agradece, Aurora.']] },
    { id: 'm5', name: 'Desfiladeiro Rubro', map: 'canyon', sky: 'afternoon', time: 720, par: 6400, start: 'canyon',
      brief: 'Voa baixo pelo desfiladeiro, por baixo do teto do radar, e destrói o núcleo do gerador.',
      ceiling: 470,
      phases: [
        { obj: 'Passa pelos anéis abaixo do teto do radar', rings: canyonPts, ringR: 75,
          spawn: [{ t: 'aa', n: 6, canyonRim: 1 }],
          radio: [[SENA, 'O radar cobre tudo acima de 470 metros. Fica dentro do desfiladeiro e passa pelos anéis.'], [IRIS, 'Se o medidor do radar encher, somos descobertos. Trava nas curvas!']] },
        { obj: 'Destrói o núcleo do gerador', goal: 'tgt', spawn: [{ t: 'core', n: 1, at: 'canyonEnd', tgt: 1 }, { t: 'sam', n: 2, at: 'canyonEnd', r: 700, tgt: 1 }],
          radio: [[SENA, 'O núcleo está no fim do desfiladeiro. Dá-lhe com tudo.']] },
        { obj: 'Sai do desfiladeiro: sobe acima de 1800 m', goal: 'climb', climb: 1800, noCeil: 1, spawn: [{ t: 'fighter', n: 3, at: [0, 2400, 9000], r: 400 }],
          radio: [[SENA, 'Núcleo em baixo! O radar já não importa — sobe, sobe!'], [IRIS, 'Caças a chegar por trás. Ganha altitude!']] },
      ],
      end: [[SENA, 'Gerador desligado e tu inteiro. Voo de mestre.']] },
    { id: 'm6', name: 'Fortaleza Celeste', map: 'arctic', sky: 'night', time: 1200, par: 14000, start: [0, 2300, 10300, 0],
      brief: 'Sob a aurora do Fiorde Boreal, a Fortaleza Celeste — uma asa-drone gigante — lança o último ataque.',
      phases: [
        { obj: 'Abre caminho pela escolta', goal: 'all', spawn: [{ t: 'fighter', n: 4, at: [0, 2400, -2500], r: 700 }, { t: 'ace', n: 2, at: [2200, 3000, -6000], r: 300 }],
          radio: [[SENA, 'Aurora, esta é a última. Primeiro, a escolta.'], [IRIS, 'A aurora dá-nos luz. Vamos acabar com isto.']] },
        { obj: 'Destrói os 4 motores da Fortaleza', goal: 'tgt', fortress: 1,
          radio: [[SENA, 'Ali está ela: a Fortaleza Celeste. O núcleo tem escudo — destrói primeiro os quatro motores.'], [IRIS, 'Ela lança drones e dispara de todo o lado. Não fiques parado na traseira dela!']] },
        { obj: 'O escudo caiu: destrói o núcleo', goal: 'tgt', fcore: 1,
          radio: [[SENA, 'Motores abaixo, escudo em baixo! O núcleo está exposto — agora!']] },
      ],
      end: [[SENA, 'A Fortaleza caiu. Céu limpo sobre o fiorde.'], [IRIS, 'Ás dos Céus. Não há outro nome para ti.']] },
  ];
  const FREE_SKY = { coast: 'morning', alps: 'noon', isles: 'sunset', ocean: 'overcast', canyon: 'afternoon', arctic: 'night' };

  /* ── gravação ── */
  const SAVE = 'skyace:save';
  const save = () => { try { return Object.assign({ u: 1, r: {}, plane: 'falcon', ctrl: 'std', inv: false, q: 'auto' }, JSON.parse(localStorage.getItem(SAVE)) || {}); } catch (e) { return { u: 1, r: {}, plane: 'falcon', ctrl: 'std', inv: false, q: 'auto' }; } };
  const putSave = v => { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch (e) {} };
  let CHECKPOINT = null;
  let PITCH = null;   /* escolha do eixo também em memória (se o browser não gravar) */   /* {mode, phase} — recomeçar na fase onde falhaste */

  /* ── vetores temporários (criados depois de o three.js carregar) ── */
  let V1, V2, V3, V4, V5, Q1, Q2, M1, UP, E1;
  function initTmp() { if (V1) return; V1 = new THREE.Vector3(); V2 = new THREE.Vector3(); V3 = new THREE.Vector3(); V4 = new THREE.Vector3(); V5 = new THREE.Vector3(); Q1 = new THREE.Quaternion(); Q2 = new THREE.Quaternion(); M1 = new THREE.Matrix4(); UP = new THREE.Vector3(0, 1, 0); E1 = new THREE.Euler(); }
  const hdgVec = (deg, out) => out.set(Math.sin(deg * DEG), 0, -Math.cos(deg * DEG));
  /* orientação a partir da direção e do pranchamento (bank > 0 = asa direita em baixo) */
  function orient(q, f, bank) {
    V4.copy(UP).addScaledVector(f, -f.dot(UP)); if (V4.lengthSq() < 1e-6) V4.set(0, 0, 1).addScaledVector(f, -f.z); V4.normalize();
    V4.applyAxisAngle(f, bank);
    V5.crossVectors(V4, f).normalize();
    M1.makeBasis(V5, V4, f); q.setFromRotationMatrix(M1);
  }
  const angTo = (f, from, to) => { V3.subVectors(to, from); const d = V3.length(); return d < 1e-3 ? 0 : Math.acos(clamp(f.dot(V3) / d, -1, 1)); };
  function turnToward(f, want, max) {
    const d = clamp(f.dot(want), -1, 1), a = Math.acos(d);
    if (a < 1e-5) return 0;
    V3.crossVectors(f, want); if (V3.lengthSq() < 1e-10) V3.set(0, 1, 0); V3.normalize();
    f.applyAxisAngle(V3, Math.min(a, max)).normalize();
    return a;
  }
  const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ════════════════════════════════════════════════════════════════
     construção da partida
  ════════════════════════════════════════════════════════════════ */
  function parseMode(mode) {
    mode = mode || 'm1';
    if (mode === 'arena') { const maps = Object.keys(FREE_SKY), m = maps[Math.floor(Math.random() * maps.length)]; return { kind: 'arena', map: m, sky: FREE_SKY[m], name: 'Arena', start: [0, 1900, 9800, 0] }; }
    if (mode.startsWith('free-')) { const m = mode.slice(5); return { kind: 'free', map: W().MAPS[m] ? m : 'coast', sky: FREE_SKY[m] || 'noon', name: 'Voo livre', start: [0, 1400, 9800, 0] }; }
    const M = MISSIONS.find(x => x.id === mode) || MISSIONS[0];
    return Object.assign({ kind: 'mission' }, M);
  }

  function setup(api, o) {
    const sv = save(), M = parseMode(o.mode), D = DIFF[o.diff || 'medium'] || DIFF.medium;
    const G = {
      M, D, diff: o.diff || 'medium', mode: o.mode || 'm1', sv, t: 0, time: 0, ok: false, fail: null,
      plane: PLANES[sv.plane] ? sv.plane : 'falcon', ctrl: sv.ctrl, inv: (PITCH || sv.pitch || 'sim') === 'arcade', help: sv.help !== false,
      keys: {}, act: {}, in: { pitch: 0, roll: 0, yaw: 0, boost: 0, brake: 0, gun: 0 }, mouseGun: false, touch: false, tp: {}, pad: null, padPrev: [],
      ents: [], msls: [], bullets: [], flares: [], rings: [], ringI: 0, feed: [], radio: [], radioT: 0, say: null,
      score: 0, kills: 0, gunKills: 0, hits: 0, shots: 0, dmgTaken: 0, phase: -1, phaseT: 0, nextPhaseT: -1, wave: 0, waveT: 0,
      cam: { mode: 0, look: 0, tgtCam: 0, fov: 62 }, detect: 0, outT: 0, won: false, winT: 0, endT: 0, cp: 0,
      warn: { msl: 0, lock: 0, pull: 0 }, beepT: 0, lockBeepT: 0, fxFrame: 0, perf: { acc: 0, n: 0, q: 1 },
    };
    if (CHECKPOINT && CHECKPOINT.mode === G.mode && M.kind === 'mission') { G.cp = CHECKPOINT.phase; }
    CHECKPOINT = null;
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build(G, api); } catch (e) { console.warn('[ás dos céus] 3D falhou', e); G.fail3d = true; } }).catch(() => { G.fail3d = true; });
    return G;
  }

  function quality(G) {
    const q = G.sv.q === 'auto' ? (Arcade3D.coarse() ? 'low' : 'high') : G.sv.q;
    return q === 'low' ? { seg: 200, trees: 3500, clouds: .6, dpr: 1.25, smoke: 3500, fire: 2000, shadows: false } : { seg: 340, trees: 9000, clouds: 1, dpr: 1.75, smoke: 7000, fire: 4000, shadows: true };
  }

  function build(G, api) {
    initTmp();
    const Wd = W(), map = Wd.MAPS[G.M.map], sky = Wd.SKIES[G.M.sky], Q = quality(G);
    const renderer = Arcade3D.attach(api.stage);
    renderer.toneMappingExposure = sky.exp;
    const scene = new THREE.Scene();
    const env = Wd.skyEnv(renderer, sky);
    scene.environment = env;
    scene.fog = new THREE.Fog(sky.fog, sky.fogNear, sky.fogFar);
    const hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGnd, sky.hemi);
    const sun = new THREE.DirectionalLight(sky.sun, sky.sunI);
    const sunDir = new THREE.Vector3(...sky.sunDir).normalize();
    if (Q.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; }
    scene.add(hemi, sun, sun.target);
    const flash = new THREE.PointLight('#ffb070', 0, 900, 1.2); scene.add(flash);
    const cam = new THREE.PerspectiveCamera(62, 1, 1.5, 160000);
    const hg = Wd.heightGrid(map, Q.seg);
    const skyM = Wd.skyMesh(sky); scene.add(skyM);
    const terrain = Wd.buildTerrain(map, hg); scene.add(terrain);
    const water = Wd.buildWater(map, env, { depth: Wd.seaDepth(hg) }); scene.add(water);
    scene.add(Wd.buildFlora(map, hg, Q.trees));
    const towns = Wd.buildTowns(map, hg, map.towns); scene.add(towns.mesh);
    const clouds = Wd.buildClouds(sky, map.seed, Q.clouds); scene.add(clouds.mesh);
    const smoke = Wd.particles(scene, Q.smoke, false, sky), fire = Wd.particles(scene, Q.fire, true, sky);
    const lum = new THREE.Color(sky.hemiSky).lerp(new THREE.Color(sky.sun), .5).multiplyScalar(sky.stars ? .45 : 1.05); smoke.mat.uniforms.uLight.value.copy(lum);
    const tracers = Wd.tracers(scene, 360);
    G.r3 = { renderer, scene, cam, sun, sunDir, hemi, flash, hg, sky, map, env, skyM, terrain, water, clouds, smoke, fire, tracers, Q, proto: {}, pool: [], debris: [], dpr: 0, w: 0, h: 0 };
    /* avião do jogador */
    const P = G.P = makePlayer(G);
    const st = G.M.start === 'canyon' ? canyonStart() : G.M.start;
    P.pos.set(st[0], st[1], st[2]); hdgVec(st[3], P.fwd); orient(P.q, P.fwd, 0);
    if (G.M.start === 'canyon') P.pos.y = Math.max(hg.at(P.pos.x, P.pos.z), 0) + 150;
    syncPlayer(P);
    scene.add(P.mesh);
    P.trails = [Wd.ribbon(scene, 60, .5, '#ffffff', 1.4, false), Wd.ribbon(scene, 60, .5, '#ffffff', 1.4, false)];
    G.cam.pos = P.pos.clone().addScaledVector(P.fwd, -40).add(new THREE.Vector3(0, 8, 0)); G.cam.q = P.q.clone();
    G.cam.intro = 0;
    /* missão */
    if (G.M.kind === 'mission') { G.phase = G.cp - 1; nextPhase(G, api, true); }
    else if (G.M.kind === 'arena') { G.wave = 0; G.waveT = 2.5; radio(G, SENA, 'Arena aberta. As vagas não param — aguenta o mais que puderes.'); }
    else { freeRings(G); radio(G, SENA, 'Voo livre em ' + map.name + '. Explora à vontade — há anéis para quem quiser.'); }
    /* só arranca com os shaders compilados (sem congelar a página: ver Arcade3D.warm) */
    Arcade3D.warm(scene, cam).then(() => { if (!G.dead && G.r3) G.ok = true; });
    audioInit(G);
  }
  function canyonStart() { const X = W().canyonX, z = 9900, sl = (X(z - 50) - X(z + 50)) / 100; return [X(z), 0, z, Math.atan2(sl, 1) / DEG]; }

  function makePlayer(G) {
    const S = PLANES[G.plane], mesh = W().buildJet(G.plane, G.r3.env), R = W().refs(mesh);
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = G.r3.Q.shadows; o.receiveShadow = true; } });
    return {
      S, mesh, R, pos: new THREE.Vector3(), q: new THREE.Quaternion(), fwd: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3(-1, 0, 0), vel: new THREE.Vector3(),
      speed: S.cruise, wp: 0, wr: 0, wy: 0, g: 1, hp: S.hp, hpMax: S.hp, msl: S.msl, sp: S.spN, heat: 0, over: 0, rails: [0, 0], railI: 0, spCd: 0, gunT: 0,
      wpn: 'msl', target: null, lock: 0, lockCand: null, mlocks: new Map(), dead: false, alive: true, flareCd: 0, hitT: 0, gcas: 0, stall: 0, ab: 0, inv: 0, deadT: 0, smokeT: 0,
    };
  }
  function syncPlayer(P) {
    P.fwd.set(0, 0, 1).applyQuaternion(P.q); P.up.set(0, 1, 0).applyQuaternion(P.q); P.right.crossVectors(P.fwd, P.up);
    P.vel.copy(P.fwd).multiplyScalar(P.speed);
  }

  /* ── unidades ── */
  function proto(G, k) {
    const r3 = G.r3, Wd = W();
    if (r3.proto[k]) return r3.proto[k];
    let m;
    if (k === 'fighter' || k === 'ace' || k === 'scout' || k === 'heavy') m = Wd.buildDrone(k, r3.env);
    else if (k === 'balloon') m = Wd.buildBalloon(r3.env);
    else if (k === 'fort') m = Wd.buildFortress(r3.env);
    else m = Wd.buildGround(k === 'ship' ? 'ship' : k, r3.env);
    if (k !== 'fort') m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    return (r3.proto[k] = m);
  }
  function addEnt(G, k, x, y, z, o = {}) {
    const T = ET[k], mesh = proto(G, k).clone(), R = W().refs(mesh);
    const e = { id: G.ents.length + 1, k, T, tgt: !!o.tgt, ph: G.phase, alive: true, hp: T.hp, pos: new THREE.Vector3(x, y, z), fwd: new THREE.Vector3(), vel: new THREE.Vector3(), speed: T.speed || 0, bank: 0, q: new THREE.Quaternion(), mesh, R, r: T.r, ground: !T.air, ai: { state: T.arm ? 'engage' : 'patrol', t: 0, lock: 0, cd: rand(3, 8), flareCd: 0, flakT: rand(0, 1), side: 1, dive: 0, jinkP: rand(0, TAU) }, base: y, phs: rand(0, TAU) };
    hdgVec(o.hdg != null ? o.hdg : rand(0, 360), e.fwd);
    if (o.escort) e.ai.escort = o.escort;
    if (o.orbit) { e.ai.orbit = o.orbit; e.ai.dir = Math.random() < .5 ? 1 : -1; }
    if (T.wander || o.home) e.ai.home = new THREE.Vector3(x, y, z);
    if (k === 'ship') { e.speed = 13; if (o.dest) e.ai.dest = new THREE.Vector3(...o.dest); }
    if (T.air) { e.vel.copy(e.fwd).multiplyScalar(e.speed); orient(e.q, e.fwd, 0); }
    else { e.q.setFromAxisAngle(UP, Math.atan2(e.fwd.x, e.fwd.z)); }
    mesh.position.copy(e.pos); mesh.quaternion.copy(e.q);
    if (!T.air && k !== 'fort' && k !== 'engine' && k !== 'fcore') { e.yoff = Math.min(T.r * .5, 12); e.pos.y += e.yoff; }
    G.r3.scene.add(mesh);
    G.ents.push(e);
    return e;
  }
  function spawnGroup(G, s) {
    const hg = G.r3.hg, Wd = W(), out = [];
    const n = s.n || 1;
    let at = s.at;
    if (at === 'canyonEnd') { const z = -7300; at = [Wd.canyonX(z), 0, z]; }
    for (let i = 0; i < n; i++) {
      const T = ET[s.t];
      if (s.canyonRim) {
        /* antiaéreas na orla do desfiladeiro */
        const z = 7000 - i * (13000 / n), side = i % 2 ? 1 : -1, x0 = Wd.canyonX(z) + side * 520;
        const site = Wd.findSite(hg, x0, z, { r: 0, minH: 250, flat: .9, seed: i * 17 + 3 });
        out.push(addEnt(G, s.t, site.x, site.y, site.z));
        continue;
      }
      const a = (i / n) * TAU + rand(-.4, .4), rr = (s.r || 0) * (n > 1 ? .5 + Math.random() * .5 : 0);
      const x = at[0] + Math.cos(a) * rr, z = at[2] + Math.sin(a) * rr;
      if (T.air) {
        let y = at[1] || 1500;
        if (s.agl) { y = Math.max(0, hg.at(x, z)) + rand(s.agl[0], s.agl[1]); }
        else y = Math.max(y + rand(-120, 120), Math.max(0, hg.at(x, z)) + 420);
        const e = addEnt(G, s.t, x, y, z, { tgt: s.tgt, orbit: s.orbit, hdg: Math.atan2(G.P.pos.x - x, -(G.P.pos.z - z)) / DEG + rand(-30, 30) });
        if (s.agl) e.base = y;
        out.push(e);
      } else {
        const site = Wd.findSite(hg, x, z, s.water ? { water: 1, depth: -20, seed: i * 31 + 5 } : { r: 0, minH: s.minH || 10, flat: s.t === 'core' ? .9 : .93, seed: i * 13 + 11 + Math.round(at[0]) });
        out.push(addEnt(G, s.t, site.x, s.water ? 0 : site.y, site.z, { tgt: s.tgt, dest: s.dest, hdg: rand(0, 360) }));
      }
    }
    if (s.escort) { const lead = G.ents.filter(e => e.alive && e.k === 'heavy'); out.forEach((e, i) => { if (lead.length) { e.ai.escort = lead[i % lead.length]; e.ai.slot = i; } }); }
    return out;
  }

  /* ── fases da missão ── */
  function nextPhase(G, api, first) {
    const M = G.M; G.phase++;
    const ph = M.phases[G.phase];
    if (!ph) return win(G, api);
    G.phaseT = 0; G.nextPhaseT = -1;
    if (ph.spawn) ph.spawn.forEach(s => { const list = spawnGroup(G, s); if (M.phases[G.phase].ships && s.t === 'ship') list.forEach(e => { e.ai.dest = new THREE.Vector3(...M.phases[G.phase].ships.dest); }); });
    if (ph.rings) setRings(G, typeof ph.rings === 'function' ? ph.rings() : ph.rings, ph.ringR);
    else if (G.rings.length) { G.rings.forEach(r => G.r3.scene.remove(r.mesh)); G.rings = []; G.ringI = 0; }
    if (ph.fortress) spawnFortress(G);
    if (ph.fcore && G.fort) { const c = G.fort.parts.find(p => p.k === 'fcore'); if (c) { c.shield = false; c.noTarget = false; c.tgt = true; c.ph = G.phase; } }
    (ph.radio || []).forEach(([who, txt]) => radio(G, who, txt));
    if (!first) { G.say = { t: 'OBJETIVO ATUALIZADO', s: ph.obj, life: 2.6, c: '#ffd34d' }; sfx(api, 'obj'); }
    else G.say = { t: (M.name || '').toUpperCase(), s: ph.obj, life: 3.2, c: '#9dffbe' };
    if (first && G.cp > 0) radio(G, SENA, 'A retomar a partir do último objetivo.');
  }
  function phaseDone(G) {
    const ph = G.M.phases[G.phase]; if (!ph) return false;
    if (ph.rings && !ph.goal) return G.rings.length > 0 && G.ringI >= G.rings.length;
    const mine = G.ents.filter(e => e.ph === G.phase && !e.T.noTarget);
    if (ph.goal === 'all') return mine.every(e => !e.alive);
    if (ph.goal === 'tgt') return mine.filter(e => e.tgt).every(e => !e.alive);
    if (ph.goal === 'climb') return G.P.pos.y > ph.climb;
    return false;
  }
  function setRings(G, list, rr) {
    const sc = G.r3.scene, hg = G.r3.hg;
    G.rings.forEach(r => sc.remove(r.mesh)); G.rings = []; G.ringI = 0;
    list.forEach((p, i) => {
      let [x, y, z] = p;
      if (p[3] === 'canyon') y = Math.max(0, hg.at(x, z)) + 95;
      const m = W().buildRing(rr || 85); m.position.set(x, y, z); sc.add(m);
      G.rings.push({ pos: new THREE.Vector3(x, y, z), n: new THREE.Vector3(), r: rr || 85, mesh: m });
    });
    /* cada anel vira-se para o seguinte (o primeiro, para o jogador) */
    G.rings.forEach((r, i) => {
      const a = i > 0 ? G.rings[i - 1].pos : G.P.pos, b = G.rings[i + 1] ? G.rings[i + 1].pos : null;
      r.n.subVectors(r.pos, a); if (b) r.n.add(V1.subVectors(b, r.pos)); r.n.y *= .3; r.n.normalize();
      r.mesh.lookAt(V1.copy(r.pos).add(r.n));
    });
  }
  function freeRings(G) {
    const hg = G.r3.hg, list = []; let x = 0, z = 8000, h = 0;
    for (let i = 0; i < 14; i++) { h += rand(-50, 50); x += Math.sin(h * DEG) * 1300; z -= Math.cos(h * DEG) * 1300; x = clamp(x, -9000, 9000); z = clamp(z, -9000, 9000); list.push([x, Math.max(0, hg.at(x, z)) + rand(260, 900), z]); }
    setRings(G, list, 90);
  }

  /* ── a Fortaleza Celeste ── */
  function spawnFortress(G) {
    const f = addEnt(G, 'fort', 0, 1900, -8800, { hdg: 90 });
    f.mesh.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    f.ai.orbit = 4300; f.ai.dir = 1; f.speed = 62; f.parts = [];
    const R = f.R;
    R.engines.forEach((eng, i) => {
      const p = addEnt(G, 'engine', 0, 0, 0, { tgt: true }); G.r3.scene.remove(p.mesh); p.mesh = eng; p.local = eng.position.clone(); p.fort = f; f.parts.push(p);
    });
    const c = addEnt(G, 'fcore', 0, 0, 0, {}); G.r3.scene.remove(c.mesh); c.mesh = R.core; c.local = R.core.position.clone().add(new THREE.Vector3(0, 6, 0)); c.fort = f; c.shield = true; c.noTarget = true; f.parts.push(c);
    G.fort = f; f.fortT = { msl: 6, launch: 20, flak: 1 };
  }

  /* ════════════════════════════════════════════════════════════════
     entrada
  ════════════════════════════════════════════════════════════════ */
  const K = (G, ...codes) => codes.some(c => G.keys[c]);
  function readInput(G, api, dt) {
    const I = G.in, T = G.tp;
    let pitch = 0, roll = 0, yaw = 0, boost = 0, brake = 0, gun = 0;
    if (K(G, 'KeyW', 'ArrowUp')) pitch -= 1; if (K(G, 'KeyS', 'ArrowDown')) pitch += 1;
    if (K(G, 'KeyA', 'ArrowLeft')) roll -= 1; if (K(G, 'KeyD', 'ArrowRight')) roll += 1;
    if (K(G, 'KeyQ')) yaw -= 1; if (K(G, 'KeyE')) yaw += 1;
    if (K(G, 'ShiftLeft', 'ShiftRight')) boost = 1; if (K(G, 'KeyZ')) brake = 1;
    if (K(G, 'KeyF') || G.mouseGun) gun = 1;
    /* toque */
    if (T.stick) { roll += T.stick.vx; pitch += T.stick.vy; }
    if (T.gun) gun = 1; if (T.boost) boost = 1; if (T.brake) brake = 1;
    /* comando */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find(p => p && p.connected);
    if (pad) {
      const dz = v => (Math.abs(v) < .14 ? 0 : (v - Math.sign(v) * .14) / .86);
      roll += dz(pad.axes[0] || 0); pitch += dz(pad.axes[1] || 0);
      const b = i => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
      const pr = i => b(i) > .5 && !G.padPrev[i];
      boost = Math.max(boost, b(7)); brake = Math.max(brake, b(6));
      yaw += b(5) - b(4);
      if (b(2) > .5) gun = 1;
      if (pr(0)) G.act.fire = 1;
      if (pr(3)) G.act.target = 1;
      if (pr(1)) G.act.wpn = 1;
      if (pr(13)) G.act.flare = 1;
      if (pr(8)) G.act.cam = 1;
      G.cam.padTgt = b(12) > .5;
      G.cam.lookX = dz(pad.axes[2] || 0); G.cam.lookY = dz(pad.axes[3] || 0);
      G.padPrev = pad.buttons.map(x => x.pressed);
      G.pad = pad.id;
    }
    if (G.inv) pitch = -pitch;   /* arcada: ↑/W (e alavanca para cima) sobem o nariz */
    const k = Math.min(1, dt * 10);
    I.pitch += (clamp(pitch, -1, 1) - I.pitch) * k; I.roll += (clamp(roll, -1, 1) - I.roll) * k; I.yaw += (clamp(yaw, -1, 1) - I.yaw) * k;
    I.boost = boost; I.brake = brake; I.gun = gun;
  }
  function key(G, e) {
    const c = e.code || '';
    G.keys[c] = true;
    if (!e.repeat) {
      if (c === 'Space') G.act.fire = 1;
      else if (c === 'KeyX') G.act.wpn = 1;
      else if (c === 'KeyR') G.act.target = 1;
      else if (c === 'KeyC') G.act.cam = 1;
      else if (c === 'KeyB') G.act.flare = 1;
      else if (c === 'KeyH') { G.help = !G.help; const sv = save(); sv.help = G.help; putSave(sv); }
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) return true;
  }
  function keyup(G, e) { if (!e.code) { G.keys = {}; G.mouseGun = false; return; } G.keys[e.code] = false; }

  /* toque: alavanca à esquerda, botões à direita (coordenadas em px CSS) */
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  function touchBtns(G, api) {
    const k = pxK(api), w = api.W / k, h = api.H / k, s = Math.min(1, Math.max(.8, Math.min(w, h) / 420));
    return [
      { id: 'fire', x: w - 74 * s, y: h - 92 * s, r: 40 * s, ic: 'MSL' },
      { id: 'gun', x: w - 168 * s, y: h - 62 * s, r: 34 * s, ic: 'GUN', hold: 1 },
      { id: 'wpn', x: w - 56 * s, y: h - 186 * s, r: 23 * s, ic: 'SP' },
      { id: 'target', x: w - 124 * s, y: h - 168 * s, r: 25 * s, ic: 'ALVO' },
      { id: 'flare', x: w - 200 * s, y: h - 146 * s, r: 23 * s, ic: 'FLR' },
      { id: 'boost', x: 46 * s, y: h - 250 * s, r: 26 * s, ic: '▲', hold: 1 },
      { id: 'brake', x: 46 * s, y: h - 186 * s, r: 26 * s, ic: '▼', hold: 1 },
      { id: 'cam', x: w - 34 * s, y: h * .42, r: 19 * s, ic: 'CAM' },
      { id: 'full', x: w - 34 * s, y: h * .42 - 46 * s, r: 19 * s, ic: '⛶' },
    ];
  }
  function down(G, x, y, api, e) {
    if (!G.ok) return;
    const k = pxK(api), cx = x / k, cy = y / k, id = e && e.pointerId != null ? e.pointerId : 1;
    if (e && e.pointerType === 'mouse') {
      const hb = G.helpBox;
      if (e.button === 0 && hb && cx >= hb.x && cx <= hb.x + hb.w && cy >= hb.y && cy <= hb.y + hb.h) { G.help = !G.help; const sv = save(); sv.help = G.help; putSave(sv); return; }
      if (e.button === 2) G.act.fire = 1; else if (e.button === 0) G.mouseGun = true;
      return;
    }
    G.touch = true;
    const b = touchBtns(G, api).find(b => Math.hypot(cx - b.x, cy - b.y) < b.r * 1.25);
    if (b) { if (b.hold) G.tp[b.id] = id; else G.act[b.id] = 1; G.tp['tap_' + b.id] = .15; return; }
    if (cx < api.W / k * .5 && !G.tp.stick) G.tp.stick = { id, ox: cx, oy: cy, x: cx, y: cy, vx: 0, vy: 0 };
  }
  function move(G, x, y, api, e) {
    const k = pxK(api), id = e && e.pointerId != null ? e.pointerId : 1, s = G.tp.stick;
    if (s && s.id === id) {
      const cx = x / k, cy = y / k, dx = cx - s.ox, dy = cy - s.oy, d = Math.hypot(dx, dy), m = 62;
      s.x = cx; s.y = cy; s.vx = clamp(dx / m, -1, 1); s.vy = clamp(dy / m, -1, 1);
      if (d > m * 1.6) { s.ox += dx / d * (d - m * 1.6); s.oy += dy / d * (d - m * 1.6); }
    }
  }
  function up(G, x, y, api, e) {
    const id = e && e.pointerId != null ? e.pointerId : 1;
    if (e && e.pointerType === 'mouse') { G.mouseGun = false; return; }
    if (G.tp.stick && G.tp.stick.id === id) G.tp.stick = null;
    ['gun', 'boost', 'brake'].forEach(b => { if (G.tp[b] === id) G.tp[b] = null; });
  }

  /* ════════════════════════════════════════════════════════════════
     voo do jogador
  ════════════════════════════════════════════════════════════════ */
  function fly(G, h, api) {
    const P = G.P, S = P.S, I = G.in, hg = G.r3.hg;
    let pitch = I.pitch, roll = I.roll, yaw = I.yaw;
    const bank = Math.atan2(-P.right.y, P.up.y);
    /* fora da área: o avião volta sozinho */
    const far = Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z));
    if (far > 10800 && !G.won) G.outT += h; else G.outT = Math.max(0, G.outT - h * 2);
    let auto = null;
    if (G.outT > 8) { V1.set(-P.pos.x, 0, -P.pos.z).normalize(); auto = V1; }
    /* Auto-GCAS (fácil): impede de bater no chão */
    const look = Math.max(0, hg.at(P.pos.x + P.vel.x * 2.2, P.pos.z + P.vel.z * 2.2)), gnd = Math.max(0, hg.at(P.pos.x, P.pos.z));
    const tti = P.vel.y < -1 ? (P.pos.y - Math.max(look, gnd) - 40) / -P.vel.y : 99;
    G.warn.pull = tti < 3.6 && P.pos.y - gnd < 900 ? 1 : 0;
    P.gcas = 0;
    if (G.D.gcas && (tti < 2.2 || P.pos.y - Math.max(look, gnd) < 45)) { P.gcas = 1; roll = clamp(-bank * 2, -1, 1); pitch = Math.abs(bank) < 1.2 ? 1 : 0; }
    if (auto) { V2.copy(P.fwd).setY(0).normalize(); const side = Math.sign(V2.x * auto.z - V2.z * auto.x) || 1; roll = -side * .9; pitch = .4; }
    /* velocidade (motor + gravidade) */
    const tgt = I.boost ? S.max : I.brake ? S.min + 30 : S.cruise;
    const acc = I.boost ? 60 : I.brake ? 75 : 30;
    P.speed += clamp(tgt - P.speed, -acc * h, acc * h);
    P.speed -= G0 * P.fwd.y * .9 * h;
    P.speed = clamp(P.speed, 35, S.max * 1.18);
    P.ab = lerp(P.ab, I.boost ? 1 : 0, Math.min(1, h * 4));
    /* comandos */
    const auth = .3 + .7 * sstep(30, 115, P.speed);
    const gLim = S.gmax * G0 / Math.max(P.speed, 40);
    const prMax = Math.min(S.pitch, gLim) * auth;
    let wpT, wrT, wyT;
    if (G.ctrl === 'std' && !P.gcas && !auto) {
      const want = roll * 1.25, vert = Math.abs(P.fwd.y) > .88;
      if (vert) wrT = roll;
      else if (Math.abs(roll) < .05 && Math.abs(pitch) > .4) wrT = 0;          /* a fazer um loop: não nivelar */
      else wrT = clamp((want - bank) * 3, -1, 1);
      /* curva coordenada: rodar em torno da vertical = puxar (sen φ) + guinar (cos φ) — não sobe nem desce */
      const om = vert ? 0 : Math.abs(roll) * prMax * (.35 + .65 * sstep(0, .6, Math.abs(bank)));
      const sb = Math.sin(bank), cb = Math.cos(bank);
      wpT = clamp(pitch * prMax * (pitch < 0 ? .62 : 1) + (cb > 0 ? om * Math.abs(sb) : 0), -prMax * .62, prMax);
      wyT = yaw * S.yaw * auth + (cb > 0 ? om * cb * Math.sign(roll) : 0);
    } else { wpT = pitch * prMax * (pitch < 0 ? .62 : 1); wrT = roll; wyT = yaw * S.yaw * auth; }
    const k = Math.min(1, h * 6.5);
    P.wp += (wpT - P.wp) * k; P.wr += (wrT * S.roll * auth - P.wr) * Math.min(1, h * 9); P.wy += (wyT - P.wy) * k;
    E1.set(-P.wp * h, -P.wy * h, P.wr * h, 'XYZ'); Q1.setFromEuler(E1); P.q.multiply(Q1);
    /* perda de sustentação: o nariz cai */
    P.stall = sstep(S.min + 8, S.min - 22, P.speed);
    if (P.stall > 0) { V2.crossVectors(P.fwd, V3.set(0, -1, 0)); if (V2.lengthSq() > 1e-6) { V2.normalize(); Q1.setFromAxisAngle(V2, P.stall * .9 * h); P.q.premultiply(Q1); } }
    P.q.normalize();
    syncPlayer(P);
    P.g = lerp(P.g, 1 + P.wp * P.speed / G0 * .55, Math.min(1, h * 5));
    const prev = V5.copy(P.pos);
    P.pos.addScaledVector(P.vel, h);
    if (P.pos.y > 9000) P.pos.y = 9000;
    /* anéis */
    ringCheck(G, prev, api);
    /* colisões */
    const gh = hg.at(P.pos.x, P.pos.z);
    if (P.pos.y < Math.max(gh, 0) + 2.5) return crash(G, api, gh < 0 ? 'água' : 'chão');
    if (G.fort && G.fort.alive && fortHit(G, P.pos)) return crash(G, api, 'fortaleza');
    /* teto de radar (desfiladeiro) */
    const ph = G.M.phases && G.M.phases[G.phase];
    if (G.M.ceiling && ph && !ph.noCeil && !G.won) {
      if (P.pos.y > G.M.ceiling) G.detect = Math.min(1, G.detect + h / 4.2 * G.D.detect); else G.detect = Math.max(0, G.detect - h * .18);
      if (G.detect >= 1) failMission(G, api, 'Fomos detetados pelo radar.');
    } else G.detect = Math.max(0, G.detect - h * .5);
    /* rastos de condensação nas pontas das asas */
    const wt = P.R.wingtips || [[5, 0, -3], [-5, 0, -3]], vap = sstep(4.2, 7, P.g) + (P.pos.y > 7000 ? .5 : 0);
    P.trails.forEach((t, i) => { V1.set(...wt[i]).applyQuaternion(P.q).add(P.pos); t.push(V1.x, V1.y, V1.z, vap, h); });
  }
  function ringCheck(G, prev, api) {
    const r = G.rings[G.ringI]; if (!r) return;
    const P = G.P, a = V1.subVectors(prev, r.pos).dot(r.n), b = V2.subVectors(P.pos, r.pos).dot(r.n);
    if (a < 0 && b >= 0) {
      const t = a / (a - b); V3.copy(prev).lerp(P.pos, t);
      if (V3.distanceTo(r.pos) < r.r) {
        r.mesh.visible = false; G.ringI++; G.score += 200; sfx(api, 'ring');
        api.float(api.W / 2, api.H * .38, '+200', '#6fe8ff', 22);
        burst(G, r.pos, '#6fe8ff', 30, 40);
      }
    }
  }
  function fortHit(G, p) {
    const f = G.fort; V1.copy(p).sub(f.pos).applyQuaternion(Q2.copy(f.q).invert());
    const ax = Math.abs(V1.x);
    return ax < 150 && Math.abs(V1.y) < 12 && V1.z < 95 - ax * .77 && V1.z > -60 + ax * .27;
  }
  function crash(G, api, what) {
    const P = G.P; if (P.dead) return;
    if (G.won) { P.pos.y += 3; return; }
    P.hp = 0; die(G, api, what === 'água' ? 'O caça caiu ao mar. Ejeção bem-sucedida.' : 'O caça despenhou-se. Ejeção bem-sucedida.');
  }
  function die(G, api, why) {
    const P = G.P; if (P.dead) return;
    P.dead = true; P.alive = false; P.deadT = 0; P.why = why;
    boom(G, P.pos, 3, api, true);
    P.mesh.visible = false;
    wreck(G, P.pos, P.vel, 2);
    api.shake(14, .6); api.flash('#ffffff', .25);
    G.say = { t: 'CAÇA PERDIDO', s: 'Ejeção bem-sucedida — o piloto está a salvo.', life: 4, c: '#ff5149' };
  }

  /* ════════════════════════════════════════════════════════════════
     armas do jogador
  ════════════════════════════════════════════════════════════════ */
  const WPN = {
    msl: { cone: 16 * DEG, range: 3000, lockT: 1, turn: 2.25, max: 640, life: 9, fuse: 16, dmg: 100, reload: 3.2 },
    qaam: { cone: 52 * DEG, range: 3300, lockT: .9, turn: 4.4, max: 600, life: 11, fuse: 17, dmg: 110, reload: 5 },
    mlaa: { cone: 38 * DEG, range: 4600, lockT: 1.7, turn: 2.6, max: 650, life: 10, fuse: 17, dmg: 100, reload: 7 },
  };
  function targetable(e) { return e.alive && !e.T.noTarget && !e.noTarget; }
  function pickTarget(G, cycle) {
    const P = G.P;
    const list = G.ents.filter(e => targetable(e) && e.pos.distanceTo(P.pos) < 16000)
      .map(e => ({ e, s: angTo(P.fwd, P.pos, e.pos) / DEG + e.pos.distanceTo(P.pos) / 220 - (e.tgt ? 18 : 0) }))
      .sort((a, b) => a.s - b.s).map(x => x.e);
    if (!list.length) { P.target = null; return; }
    if (cycle && P.target) { const i = list.indexOf(P.target); P.target = list[(i + 1) % list.length]; }
    else P.target = list[0];
  }
  function weapons(G, h, api) {
    const P = G.P, A = G.act, D = G.D;
    if (A.target) pickTarget(G, true);
    if (!P.target || !P.target.alive || P.target.noTarget) { P.targetT = (P.targetT || 0) + h; if (P.targetT > .45) { pickTarget(G, false); P.targetT = 0; } }
    if (A.wpn) { P.wpn = P.wpn === 'msl' ? 'sp' : 'msl'; P.lock = 0; P.lockCand = null; P.mlocks.clear(); sfx(api, 'switch'); }
    if (A.cam) { G.cam.mode = (G.cam.mode + 1) % 2; }
    if (A.full) toggleFull(api);
    if (A.flare && P.flareCd <= 0) dropFlares(G, P, api);
    P.flareCd -= h;
    /* recarga dos carris */
    for (let i = 0; i < 2; i++) { P.rails[i] = Math.max(0, P.rails[i] - h); if (P.R.rails[i]) P.R.rails[i].visible = P.rails[i] <= 0 && P.msl > i; }
    P.spCd = Math.max(0, P.spCd - h);
    /* metralhadora */
    P.over = Math.max(0, P.over - h); P.heat = Math.max(0, P.heat - h * (P.over > 0 ? .55 : .4));
    if (G.in.gun && P.over <= 0) {
      P.gunT -= h;
      while (P.gunT <= 0) {
        P.gunT += 1 / 17;
        for (let s = -1; s <= 1; s += 2) {
          V1.copy(P.fwd).multiplyScalar(1080).add(P.vel);
          V1.x += rand(-6, 6); V1.y += rand(-6, 6); V1.z += rand(-6, 6);
          V2.copy(P.pos).addScaledVector(P.fwd, 9).addScaledVector(P.right, s * .7);
          G.bullets.push({ x: V2.x, y: V2.y, z: V2.z, vx: V1.x, vy: V1.y, vz: V1.z, life: 1.5, own: 'p', c: '#ffd38a' });
        }
        G.shots++;
        P.heat += .03; if (P.heat >= 1) { P.over = 1.6; G.say = { t: 'METRALHADORA SOBREAQUECIDA', life: 1.2, c: '#ffd34d', small: 1 }; }
        if (Math.random() < .5) sfx(api, 'gun');
        fire(G, V2.copy(P.pos).addScaledVector(P.fwd, 10), '#ffcf7a', 1, 2, .05);
      }
    } else P.gunT = 0;
    /* procura de alvo (bloqueio) */
    const kind = P.wpn === 'sp' ? P.S.sp : 'msl';
    if (kind === 'bomb') { P.lock = 0; P.lockCand = null; }
    else if (kind === 'mlaa') {
      const Wp = WPN.mlaa, seen = new Set();
      G.ents.forEach(e => { if (!targetable(e) || !e.T.air) return; const d = e.pos.distanceTo(P.pos); if (d < Wp.range && angTo(P.fwd, P.pos, e.pos) < Wp.cone) seen.add(e); });
      [...P.mlocks.keys()].forEach(e => { if (!seen.has(e)) P.mlocks.delete(e); });
      [...seen].sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)).slice(0, 4).forEach(e => P.mlocks.set(e, Math.min(1, (P.mlocks.get(e) || 0) + h / (Wp.lockT * D.lockT))));
      [...P.mlocks.keys()].forEach((e, i) => { if (i >= 4) P.mlocks.delete(e); });
    } else {
      const Wp = WPN[kind]; let cand = null;
      const inCone = e => targetable(e) && e.pos.distanceTo(P.pos) < Wp.range && angTo(P.fwd, P.pos, e.pos) < Wp.cone;
      if (P.target && inCone(P.target)) cand = P.target;
      else { let best = Wp.cone; G.ents.forEach(e => { if (!inCone(e)) return; const a = angTo(P.fwd, P.pos, e.pos); if (a < best) { best = a; cand = e; } }); }
      if (cand !== P.lockCand) { P.lockCand = cand; P.lock = 0; }
      if (cand) { const was = P.lock; P.lock = Math.min(1, P.lock + h / (Wp.lockT * D.lockT)); if (was < 1 && P.lock >= 1) sfx(api, 'locked'); }
    }
    /* disparo */
    if (A.fire) {
      if (P.wpn === 'msl') fireStd(G, api);
      else fireSpecial(G, api, kind);
    }
  }
  function toggleFull(api) {
    const st = api.stage;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (st.requestFullscreen) st.requestFullscreen().then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
    } catch (e) {}
  }
  function railPos(G, i, out) { const P = G.P, rp = W().JETS[G.plane].rails[i]; return out.set(rp[0], rp[1], rp[2]).applyQuaternion(P.q).add(P.pos); }
  function fireStd(G, api) {
    const P = G.P;
    if (P.msl <= 0) { G.say = { t: 'SEM MÍSSEIS', life: 1, c: '#ff5149', small: 1 }; return; }
    let i = P.railI; if (P.rails[i] > 0) i = 1 - i; if (P.rails[i] > 0) return;
    const tgt = P.lock >= 1 ? P.lockCand : null;
    launch(G, 'p', railPos(G, i, V1), P.fwd, P.speed, tgt, WPN.msl);
    P.rails[i] = WPN.msl.reload; P.railI = 1 - i; P.msl--;
    sfx(api, 'launch');
  }
  function fireSpecial(G, api, kind) {
    const P = G.P;
    if (P.sp <= 0) { G.say = { t: 'ARMA ESPECIAL ESGOTADA', life: 1, c: '#ff5149', small: 1 }; return; }
    if (P.spCd > 0) return;
    if (kind === 'bomb') {
      const b = launch(G, 'p', V1.copy(P.pos).addScaledVector(P.up, -1.6), P.fwd, P.speed, null, null, 'bomb');
      b.vel = P.vel.clone().addScaledVector(P.up, -6);
      b.tgt = (P.target && !P.target.T.air && P.target.alive) ? P.target : null;
      P.sp--; P.spCd = 1.6; sfx(api, 'bomb'); return;
    }
    if (kind === 'mlaa') {
      const locked = [...P.mlocks.entries()].filter(([, v]) => v >= 1).map(([e]) => e);
      const list = locked.length ? locked : [null];
      list.slice(0, Math.min(4, P.sp)).forEach((e, i) => { launch(G, 'p', railPos(G, i % 2, V1).addScaledVector(P.up, -.4 * Math.floor(i / 2)), P.fwd, P.speed, e, WPN.mlaa); P.sp--; });
      P.spCd = WPN.mlaa.reload; P.mlocks.clear(); sfx(api, 'launch'); sfx(api, 'launch2'); return;
    }
    const tgt = P.lock >= 1 ? P.lockCand : null;
    launch(G, 'p', railPos(G, P.railI, V1), P.fwd, P.speed, tgt, WPN.qaam);
    P.sp--; P.spCd = WPN.qaam.reload; sfx(api, 'launch');
  }
  /* míssil (ou bomba) — owner 'p' jogador, 'e' inimigos */
  function launch(G, own, pos, dir, speed, tgt, Wp, kind) {
    const m = { own, kind: kind || 'msl', pos: pos.clone(), dir: dir.clone(), speed: speed + 10, age: 0, tgt, W: Wp || WPN.msl, life: (Wp || WPN.msl).life, mesh: mslMesh(G), smokeT: 0 };
    if (kind === 'bomb') { m.mesh.scale.set(2.2, 2.2, 1.2); m.life = 30; }
    else m.mesh.scale.set(1, 1, 1);
    m.mesh.position.copy(m.pos); m.mesh.visible = true;
    G.msls.push(m);
    return m;
  }
  function mslMesh(G) {
    const r3 = G.r3, free = r3.pool.find(m => !m.visible);
    if (free) return free;
    const m = W().missileMesh(r3.env);
    const s = new THREE.Sprite(Arcade3D.glowSprite('#ffc27a')); s.position.z = -2; s.scale.setScalar(4); s.name = 'motor'; m.add(s);
    r3.scene.add(m); r3.pool.push(m);
    return m;
  }
  function dropFlares(G, who, api) {
    const isP = who === G.P;
    for (let i = 0; i < 6; i++) {
      const v = who.vel.clone().multiplyScalar(.35).add(V1.set(rand(-40, 40), rand(-30, 10), rand(-40, 40)));
      G.flares.push({ pos: who.pos.clone(), vel: v, life: 3.2, alive: true, own: isP ? 'p' : 'e' });
    }
    /* mísseis a perseguir quem largou os flares podem ser enganados */
    G.msls.forEach(m => {
      if (m.tgt === who && m.kind !== 'bomb' && Math.random() < (isP ? .7 : .35)) { const f = G.flares[G.flares.length - 1 - Math.floor(Math.random() * 6)]; m.tgt = f; }
    });
    if (isP) { G.P.flareCd = 6; sfx(api, 'flare'); }
  }

  /* ════════════════════════════════════════════════════════════════
     IA
  ════════════════════════════════════════════════════════════════ */
  function aiAir(G, e, h, api) {
    const T = e.T, P = G.P, ai = e.ai, D = G.D, hg = G.r3.hg;
    if (T.fixed) { e.pos.y = e.base + Math.sin(G.time * .6 + e.phs) * 4; e.mesh.position.copy(e.pos); e.mesh.rotation.y += h * .2; return; }
    const want = V2; let spd = T.speed;
    ai.t -= h; ai.flareCd -= h;
    const toP = V1.subVectors(P.pos, e.pos), dist = toP.length();
    /* ameaça: míssil do jogador a perseguir-me */
    let threat = null;
    if (T.evade) for (const m of G.msls) if (m.own === 'p' && m.tgt === e && m.pos.distanceTo(e.pos) < 1700) { threat = m; break; }
    if (!ai.breakD) ai.breakD = T.ace ? rand(450, 750) : rand(500, 1400);
    if (threat && ai.state !== 'evade' && threat.pos.distanceTo(e.pos) < ai.breakD && Math.random() < h * T.evade * 4) {
      ai.breakD = 0;
      ai.state = 'evade'; ai.t = rand(1.6, 3); ai.side = Math.random() < .5 ? 1 : -1; ai.dive = rand(-.5, .3);
      if (T.flares && ai.flareCd <= 0 && Math.random() < .7) { dropFlares(G, e, api); ai.flareCd = 7; }
    }
    if (ai.escort && ai.escort.alive && ai.state !== 'evade' && dist > 2600) {
      const L = ai.escort, sl = ai.slot || 0;
      V3.crossVectors(L.fwd, UP).normalize();
      want.copy(L.pos).addScaledVector(V3, (sl % 2 ? 1 : -1) * (90 + 60 * Math.floor(sl / 2))).addScaledVector(L.fwd, -120 - 50 * sl).add(V4.set(0, 30 * sl, 0)).sub(e.pos);
      const dd = want.length(); want.normalize(); spd = L.speed + clamp(dd * .2, -40, 90);
    } else if (ai.orbit) {
      V3.set(e.pos.x, 0, e.pos.z); const rr = V3.length() || 1;
      want.set(-e.pos.z * ai.dir, 0, e.pos.x * ai.dir).normalize().addScaledVector(V3.normalize(), -(rr - ai.orbit) / ai.orbit * 2.5);
      want.y = clamp((e.base - e.pos.y) / 400, -.3, .3); want.normalize();
      if (e.k === 'fort') spd = e.speed;
    } else if (ai.state === 'evade') {
      const los = threat ? V3.subVectors(e.pos, threat.pos).normalize() : e.fwd;
      want.crossVectors(los, UP); if (want.lengthSq() < 1e-4) want.set(1, 0, 0); want.normalize().multiplyScalar(ai.side); want.y += ai.dive; want.normalize();
      spd = T.speed * 1.3;
      if (ai.t <= 0) ai.state = T.arm ? 'engage' : 'patrol';
    } else if (ai.state === 'patrol' || !T.arm) {
      const home = ai.home || e.pos;
      if (!ai.wp || e.pos.distanceTo(ai.wp) < 350) ai.wp = new THREE.Vector3(home.x + rand(-1800, 1800), clamp(home.y + rand(-250, 250), Math.max(0, hg.at(home.x, home.z)) + 400, 6000), home.z + rand(-1800, 1800));
      want.subVectors(ai.wp, e.pos).normalize();
      if (T.arm && dist < 6000) ai.state = 'engage';
    } else if (ai.state === 'extend') {
      want.copy(e.fwd); want.y = .12; want.normalize(); spd = T.speed * 1.25;
      if (ai.t <= 0) ai.state = 'engage';
    } else {
      /* perseguição com avanço; ziguezagues para não ser alvo fácil */
      const tl = clamp(dist / 520, 0, 1.6);
      want.copy(P.pos).addScaledVector(P.vel, tl).sub(e.pos).normalize();
      V3.crossVectors(want, UP); if (V3.lengthSq() > 1e-4) want.addScaledVector(V3.normalize(), Math.sin(G.time * .7 + ai.jinkP) * .22);
      want.normalize();
      if (dist < 260 && !P.dead) { ai.state = 'extend'; ai.t = rand(2.2, 4); }
      spd = dist > 1600 ? T.speed * 1.15 : T.speed;
      if (P.dead) { ai.state = 'patrol'; ai.home = e.pos.clone(); }
    }
    /* chão, limites e teto */
    const ahead = Math.max(0, hg.at(e.pos.x + e.fwd.x * e.speed * 3, e.pos.z + e.fwd.z * e.speed * 3)), here = Math.max(0, hg.at(e.pos.x, e.pos.z));
    const clr = e.pos.y - Math.max(ahead, here);
    if (clr < 320 && e.k !== 'fort') { want.y = Math.max(want.y, clr < 150 ? .8 : .45); want.normalize(); }
    if (e.pos.y > 7000) { want.y = Math.min(want.y, -.2); want.normalize(); }
    if (Math.max(Math.abs(e.pos.x), Math.abs(e.pos.z)) > 10500) { V3.set(-e.pos.x, 0, -e.pos.z).normalize(); want.lerp(V3, .6).normalize(); }
    /* virar com limite */
    V4.copy(e.fwd);
    turnToward(e.fwd, want, T.turn * D.aiTurn * (ai.state === 'evade' ? 1.25 : 1) * h);
    V3.crossVectors(V4, e.fwd); const yawRate = -V3.y / h;
    const bankT = e.k === 'fort' ? clamp(Math.atan(yawRate * e.speed / G0), -.25, .25) : clamp(Math.atan(yawRate * e.speed / G0), -1.35, 1.35);
    e.bank += (bankT - e.bank) * Math.min(1, h * 3);
    e.speed += clamp(spd - e.speed, -35 * h, 35 * h);
    e.vel.copy(e.fwd).multiplyScalar(e.speed);
    e.pos.addScaledVector(e.vel, h);
    orient(e.q, e.fwd, e.bank);
    if (e.pos.y < here + 6 && e.k !== 'fort') { kill(G, e, api, 'crash'); return; }
    /* disparo de mísseis contra o jogador */
    if (T.arm && !P.dead && !G.won) {
      ai.cd -= h;
      const ang = angTo(e.fwd, e.pos, P.pos);
      if (dist < 2900 && ang < 20 * DEG && ai.state === 'engage') { ai.lock += h; G.warn.lock = Math.max(G.warn.lock, .3); }
      else ai.lock = Math.max(0, ai.lock - h);
      if (ai.lock > D.aiLock && ai.cd <= 0) {
        launch(G, 'e', V3.copy(e.pos).addScaledVector(e.fwd, 9), e.fwd, e.speed, P, { turn: 1.3 * D.eMsl, max: 520, life: 12, fuse: 13, dmg: 30 });
        ai.cd = rand(8, 12) * D.aiCd * (T.ace ? .7 : 1); ai.lock = 0;
        radioOnce(G, 'mslwarn', IRIS, 'Míssil no teu encalço! Curva e larga flares!');
      }
    }
    smokeIfHurt(G, e, h);
  }
  function smokeIfHurt(G, e, h) {
    if (e.hp > e.T.hp * .5) return;
    e.smT = (e.smT || 0) - h; if (e.smT > 0) return; e.smT = .05;
    smokeP(G, V3.copy(e.pos).addScaledVector(e.fwd, -e.r * .6), '#3a3a3a', 5 + e.r * .4, 22 + e.r, 2.2, .6);
  }

  function aiGround(G, e, h, api) {
    const P = G.P, T = e.T, R = e.R, D = G.D, hg = G.r3.hg;
    if (R.spin) R.spin.rotation.y += h * 1.1;
    if (e.k === 'ship') {
      if (e.ai.dest) {
        V3.subVectors(e.ai.dest, e.pos).setY(0); const dd = V3.length(); V3.normalize();
        /* terra à frente? desvia */
        const ah = hg.at(e.pos.x + e.fwd.x * 260, e.pos.z + e.fwd.z * 260);
        if (ah > -6) V3.copy(e.fwd).applyAxisAngle(UP, .9);
        turnToward(e.fwd, V3, .05 * h);
        e.fwd.y = 0; e.fwd.normalize();
        if (dd < 700 && G.M.kind === 'mission' && !G.won) failMission(G, api, 'Um navio-drone chegou ao porto.');
      }
      e.pos.addScaledVector(e.fwd, e.speed * h); e.pos.y = e.yoff || 0; e.vel.copy(e.fwd).multiplyScalar(e.speed);
      e.q.setFromAxisAngle(UP, Math.atan2(e.fwd.x, e.fwd.z));
      Q1.setFromAxisAngle(V3.set(0, 0, 1), Math.sin(G.time * .6 + e.phs) * .02); e.q.multiply(Q1);
      if (G.fxFrame % 3 === 0) { V3.copy(e.pos).addScaledVector(e.fwd, -40); smokeP(G, V3, '#e8eef2', 6, 26, 2.4, .18, true); }
    }
    if (P.dead || G.won) return;
    const dist = e.pos.distanceTo(P.pos);
    if (R.aim && dist < 6000) { V3.subVectors(P.pos, e.pos); const yaw = Math.atan2(V3.x, V3.z) - (e.k === 'ship' ? Math.atan2(e.fwd.x, e.fwd.z) : 0); R.aim.rotation.y = lerp(R.aim.rotation.y, yaw, Math.min(1, h * 2)); }
    const agl = P.pos.y - Math.max(0, hg.at(P.pos.x, P.pos.z));
    if (T.sam) {
      e.ai.cd -= h;
      if (dist < 5200 && agl > 60) { e.ai.lock += h; if (e.ai.lock > .6) G.warn.lock = Math.max(G.warn.lock, .5); } else e.ai.lock = Math.max(0, e.ai.lock - h);
      if (e.ai.lock > 2.4 * D.aiLock && e.ai.cd <= 0) {
        V3.subVectors(P.pos, e.pos).normalize(); V3.y += .6; V3.normalize();
        launch(G, 'e', V4.copy(e.pos).add(V1.set(0, 8, 0)), V3, 40, P, { turn: 1.15 * D.eMsl, max: 560, life: 13, fuse: 14, dmg: 32 });
        e.ai.cd = rand(9, 13) * D.aiCd; e.ai.lock = 0;
        smokeP(G, V4, '#d8d8d8', 20, 60, 2.5, .8);
        radioOnce(G, 'samwarn', SENA, 'SAM lançado! Larga flares ou mergulha e curva.');
      }
    }
    if (T.aa && dist < 2700) {
      e.ai.flakT -= h;
      if (e.ai.flakT <= 0) {
        e.ai.flakT = rand(.45, .9) * (D.aiCd > 1 ? 1.4 : 1);
        const err = D.flak * (dist / 2000 + .4);
        V3.copy(P.pos).addScaledVector(P.vel, rand(.4, .9)).add(V4.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(err));
        flak(G, V3, api);
      }
    }
  }
  function flak(G, p, api) {
    const P = G.P;
    smokeP(G, p, '#2b2b2b', 14, 46, 2.6, .9);
    fire(G, p, '#ffcf7a', 2, 26, .25);
    const d = p.distanceTo(P.pos);
    if (d < 30 && !P.dead) { damageP(G, 5 * G.D.dmg, api); }
    if (d < 900 && Math.random() < .5) sfx(api, 'flak', 1 - d / 900);
  }

  function fortress(G, f, h, api) {
    aiAir(G, f, h, api);
    f.mesh.position.copy(f.pos); f.mesh.quaternion.copy(f.q);
    f.mesh.updateMatrixWorld(true);
    f.parts.forEach(p => {
      if (!p.local) return;
      p.pos.copy(p.local).applyMatrix4(f.mesh.matrixWorld); p.vel.copy(f.vel); p.fwd.copy(f.fwd);
      if (p.alive && p.k === 'engine' && G.fxFrame % 2 === 0) fire(G, V3.copy(p.pos).addScaledVector(f.fwd, -30), '#ff8a4a', 1, 26, .25);
      if (!p.alive && p.k === 'engine' && G.fxFrame % 2 === 0) { smokeP(G, p.pos, '#262626', 20, 80, 3, .7); fire(G, p.pos, '#ff7a2a', 2, 24, .35); }
    });
    if (f.R.orb) { const c = f.parts.find(p => p.k === 'fcore'); f.R.orb.scale.setScalar(c && c.shield ? .6 + Math.sin(G.time * 3) * .05 : 1 + Math.sin(G.time * 9) * .15); }
    const P = G.P, D = G.D, FT = f.fortT;
    if (f.dying != null) {
      f.dying += h;
      if (Math.random() < h * 7) { V3.copy(f.pos).add(V4.set(rand(-140, 140), rand(-10, 20), rand(-50, 80)).applyQuaternion(f.q)); boom(G, V3, rand(3, 6), api); }
      f.base -= h * 45;
      if (f.dying > 5) { boom(G, f.pos, 10, api); f.alive = false; f.mesh.visible = false; }
      return;
    }
    if (P.dead || G.won) return;
    const dist = f.pos.distanceTo(P.pos);
    FT.msl -= h; FT.launch -= h; FT.flak -= h;
    if (FT.msl <= 0 && dist < 5500) {
      FT.msl = rand(5, 8) * D.aiCd;
      V3.copy(f.pos).add(V4.set(rand(-60, 60), 14, rand(0, 50)).applyQuaternion(f.q));
      V4.subVectors(P.pos, V3).normalize();
      launch(G, 'e', V3, V4, 80, P, { turn: 1.2 * D.eMsl, max: 540, life: 13, fuse: 14, dmg: 30 });
      radioOnce(G, 'fortmsl', IRIS, 'Ela também dispara mísseis — mantém-te em movimento!');
    }
    if (FT.flak <= 0 && dist < 2600) { FT.flak = rand(.35, .7); V3.copy(P.pos).addScaledVector(P.vel, rand(.3, .8)).add(V4.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(D.flak * (.5 + dist / 2200))); flak(G, V3, api); }
    if (FT.launch <= 0) {
      FT.launch = 34;
      const alive = G.ents.filter(e => e.alive && e.fromFort).length;
      if (alive < 3) {
        for (let i = 0; i < 2; i++) { V3.copy(f.pos).add(V4.set(i ? 40 : -40, -20, -40).applyQuaternion(f.q)); const d = addEnt(G, 'fighter', V3.x, V3.y, V3.z, {}); d.fwd.copy(f.fwd); d.fromFort = true; d.ph = -1; }
        radioOnce(G, 'fortlaunch', SENA, 'A Fortaleza está a lançar drones!', 60);
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     projéteis
  ════════════════════════════════════════════════════════════════ */
  function missiles(G, h, api) {
    const hg = G.r3.hg, P = G.P;
    for (let i = G.msls.length - 1; i >= 0; i--) {
      const m = G.msls[i]; m.age += h; m.life -= h;
      let done = false;
      if (m.kind === 'bomb') {
        m.vel.y -= G0 * h; m.vel.multiplyScalar(1 - h * .05);
        if (m.tgt && m.tgt.alive) { V1.subVectors(m.tgt.pos, m.pos); V1.y = 0; const d = V1.length(); const tt = Math.max(.3, (m.pos.y - m.tgt.pos.y) / Math.max(30, -m.vel.y)); V2.set(m.vel.x, 0, m.vel.z); V1.multiplyScalar(1 / tt).sub(V2); V1.clampLength(0, 40 * h); m.vel.add(V1); void d; }
        m.pos.addScaledVector(m.vel, h); m.dir.copy(m.vel).normalize();
        const gy = Math.max(0, hg.at(m.pos.x, m.pos.z));
        if (m.pos.y <= gy + 1) {
          m.pos.y = gy; boom(G, m.pos, 3, api);
          G.ents.forEach(e => { if (e.alive && !e.T.air) { const d = e.pos.distanceTo(m.pos); if (d < 70 + e.r) hit(G, e, 300 * (1 - d / (140 + e.r)), 'bomb', api); } });
          if (G.fort) G.fort.parts.forEach(p => { if (p.alive && p.pos.distanceTo(m.pos) < 40) hit(G, p, 200, 'bomb', api); });
          done = true;
        }
        if (G.fxFrame % 2 === 0) smokeP(G, m.pos, '#9a9a9a', 2, 8, 1, .4);
      } else {
        const Wp = m.W;
        m.speed = Math.min(Wp.max, m.speed + (m.age < 2.2 ? 260 : -15) * h);
        const t = m.tgt;
        if (t && t.alive && m.age > .12) {
          const d = m.pos.distanceTo(t.pos), close = Math.max(120, m.speed - (t.vel ? t.vel.dot(m.dir) : 0)), tgo = d / close;
          V1.copy(t.pos); if (t.vel) V1.addScaledVector(t.vel, tgo * .85);
          V1.sub(m.pos).normalize();
          const off = Math.acos(clamp(m.dir.dot(V1), -1, 1));
          if (off > 1.35 && m.age > .5) { m.tgt = null; if (m.own === 'p') floatMsg(G, api, 'FALHOU', '#cfd8dc'); }
          else turnToward(m.dir, V1, Wp.turn * h * (m.age < .4 ? .3 : 1));
        }
        if (t && t.alive && !m.rolled && m.pos.distanceTo(t.pos) < 150) {
          m.rolled = true;
          let pd = 0;
          if (m.own === 'p' && t.T && t.T.dodge) {
            pd = t.T.dodge * (t.ai.state === 'evade' ? 1 : .35) * (m.W === WPN.qaam ? .45 : 1) * G.D.dodgeE;
            if (t.fwd && m.dir.dot(t.fwd) < -.5) pd += .15;              /* de frente: mais difícil */
          } else if (m.own === 'e' && t === P) {
            const perp = 1 - Math.abs(m.dir.dot(P.fwd));
            pd = sstep(2.5, 7, P.g) * (.35 + .65 * perp) * .78 * G.D.dodgeP;
          }
          if (Math.random() < pd) { m.ignore = t; m.tgt = null; V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).cross(m.dir).normalize(); m.dir.addScaledVector(V1, .22).normalize(); floatMsg(G, api, m.own === 'p' ? 'FALHOU' : 'ESQUIVA!', m.own === 'p' ? '#cfd8dc' : '#9dffbe'); }
        }
        V5.copy(m.pos);
        m.pos.addScaledVector(m.dir, m.speed * h);
        /* espoleta de proximidade: aproximação máxima no segmento */
        if (m.own === 'p') {
          for (const e of G.ents) {
            if (!e.alive || e.T.noTarget || e === m.ignore) continue;
            const r = Math.max(Wp.fuse, e.r * .9);
            if (segDist(V5, m.pos, e.pos) < r) { if (e.shield) { floatMsg(G, api, 'ESCUDO', '#ff8aa0'); boom(G, m.pos, 1.5, api); } else hit(G, e, Wp.dmg, 'msl', api); done = true; break; }
          }
        } else if (t) {
          const isP = t === P;
          if (t.alive && segDist(V5, m.pos, t.pos) < (Wp.fuse || 13)) {
            if (isP) { if (!P.dead && !G.won) damageP(G, Wp.dmg * G.D.dmg, api, true); boom(G, m.pos, 1.6, api); }
            else { t.life = 0; boom(G, m.pos, 1, api); }
            done = true;
          }
        }
        const gy = hg.at(m.pos.x, m.pos.z);
        if (!done && m.pos.y < Math.max(0, gy)) {
          boom(G, m.pos, 1.4, api); done = true;
          if (m.own === 'p') G.ents.forEach(e => { if (e.alive && !e.T.air && !e.T.noTarget && !e.shield) { const d = e.pos.distanceTo(m.pos); if (d < 34 + e.r) hit(G, e, m.W.dmg * (1 - d / (68 + e.r * 2)), 'msl', api); } });
        }
        if (!done && m.life <= 0) { boom(G, m.pos, .8, api); done = true; }
        /* fumo do motor */
        m.smokeT -= h;
        if (m.smokeT <= 0 && m.age < 6) { m.smokeT = .016; smokeP(G, V1.copy(m.pos).addScaledVector(m.dir, -2.2), m.own === 'p' ? '#e9e9e9' : '#d9d0c8', 2.4, 10 + m.age * 1.2, 2.4 + rand(0, 1), .55); }
        if (m.age < 6) fire(G, V1.copy(m.pos).addScaledVector(m.dir, -2.4), '#ffd08a', 1, 3.2, .06);
      }
      m.mesh.position.copy(m.pos); Q1.setFromUnitVectors(V1.set(0, 0, 1), m.dir); m.mesh.quaternion.copy(Q1);
      const mo = m.mesh.getObjectByName('motor'); if (mo) mo.visible = m.kind !== 'bomb' && m.age < 6;
      if (done) { m.mesh.visible = false; G.msls.splice(i, 1); }
    }
  }
  function segDist(a, b, p) {
    V2.subVectors(b, a); const l2 = V2.lengthSq();
    let t = l2 > 0 ? V3.subVectors(p, a).dot(V2) / l2 : 0; t = clamp(t, 0, 1);
    return V3.copy(a).addScaledVector(V2, t).distanceTo(p);
  }
  function bullets(G, h, api) {
    const hg = G.r3.hg, list = G.bullets;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]; b.life -= h;
      V1.set(b.x, b.y, b.z); b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      let dead = b.life <= 0;
      if (!dead && b.own === 'p') {
        for (const e of G.ents) {
          if (!e.alive || e.T.noTarget) continue;
          if (Math.abs(e.pos.x - b.x) > 140 || Math.abs(e.pos.z - b.z) > 140) continue;
          V4.set(b.x, b.y, b.z); if (segDist(V1, V4, e.pos) < e.r + 1.5) { if (e.shield) { fire(G, V4.set(b.x, b.y, b.z), '#ff8aa0', 2, 6, .2); } else hit(G, e, e.T.air ? 7 : 9, 'gun', api); dead = true; break; }
        }
      }
      if (!dead && b.y < Math.max(0, hg.at(b.x, b.z))) { dead = true; if (Math.random() < .35) { smokeP(G, V4.set(b.x, b.y, b.z), b.y < 1 ? '#e6eef2' : '#9a8a72', 3, 12, 1, .5); } }
      if (dead) list.splice(i, 1);
    }
    G.r3.tracers.set(list);
  }
  function flaresStep(G, h) {
    for (let i = G.flares.length - 1; i >= 0; i--) {
      const f = G.flares[i]; f.life -= h; f.vel.y -= 12 * h; f.vel.multiplyScalar(1 - h * .8); f.pos.addScaledVector(f.vel, h);
      fire(G, f.pos, '#fff2c0', 1, 9, .12); if (G.fxFrame % 2) smokeP(G, f.pos, '#dddddd', 2, 7, 1.2, .35);
      if (f.life <= 0) { f.alive = false; G.flares.splice(i, 1); }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     dano, abates, explosões
  ════════════════════════════════════════════════════════════════ */
  function hit(G, e, dmg, src, api) {
    if (!e.alive) return;
    e.hp -= dmg;
    if (src !== 'gun' || Math.random() < .3) fire(G, e.pos, '#ffd28a', src === 'gun' ? 3 : 10, src === 'gun' ? 6 : 18, .3);
    if (src === 'gun') G.hits++;
    if (e.hp <= 0) kill(G, e, api, src);
    else if (src !== 'gun') { floatMsg(G, api, 'ATINGIDO', '#ffd34d'); boom(G, e.pos, 1.2, api); }
  }
  function kill(G, e, api, src) {
    if (!e.alive) return;
    e.alive = false;
    const T = e.T, sz = T.size || (T.air ? 2 : 2.4);
    if (src !== 'crash' || T.air) { G.score += T.pts; G.kills++; if (src === 'gun') G.gunKills++; }
    boom(G, e.pos, sz, api);
    if (T.air && !T.fixed && e.k !== 'heavy') { wreck(G, e.pos, e.vel, 1, e); }
    else if (e.k === 'engine') { e.mesh.visible = false; }
    else if (e.k === 'fcore') { e.mesh.visible = false; G.fort.dying = 0; }
    else if (e.k === 'heavy') { wreck(G, e.pos, e.vel, 3, e); }
    else { e.mesh.visible = false; if (!T.air) scorch(G, e); }
    G.feed.unshift({ t: `${T.name} DESTRUÍDO`, p: '+' + T.pts, life: 4 }); if (G.feed.length > 5) G.feed.pop();
    if (src !== 'crash') { G.say = { t: 'DESTRUÍDO', life: 1.1, c: '#9dffbe', kill: 1 }; sfx(api, 'kill'); }
    if (G.P.target === e) { G.P.target = null; G.P.targetT = .2; }
    if (e.k === 'engine' && G.fort && G.fort.parts.filter(p => p.k === 'engine' && p.alive).length === 0) { /* escudo cai (a fase seguinte expõe o núcleo) */ }
    /* comentários da rádio */
    if (G.kills === 1 && G.M.kind === 'mission') radioOnce(G, 'first', IRIS, 'Bom tiro, Ás!');
    if (T.ace) radioOnce(G, 'ace' + e.id, IRIS, 'Espectro abatido! Não acredito!');
  }
  /* destroços que caem a arder (as peças do drone) */
  function wreck(G, pos, vel, n, e) {
    if (e && e.mesh) { e.wreck = { t: 0, v: vel.clone().multiplyScalar(.7), spin: rand(-3, 3), roll: rand(1, 4) * (Math.random() < .5 ? -1 : 1) }; }
    for (let i = 0; i < n * 4; i++) {
      const d = G.r3.debris.find(x => !x.visible) || newDebris(G);
      d.position.copy(pos); d.visible = true; d.scale.setScalar(rand(.6, 1.8) * (n > 2 ? 2.5 : 1));
      d.userData.v = vel.clone().multiplyScalar(.5).add(V1.set(rand(-60, 60), rand(-20, 60), rand(-60, 60)));
      d.userData.w = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)); d.userData.t = 0;
    }
  }
  function newDebris(G) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rand(.8, 2.5), rand(.2, .7), rand(.8, 3)), new THREE.MeshStandardMaterial({ color: '#2d3036', roughness: .7, metalness: .5 }));
    G.r3.scene.add(m); G.r3.debris.push(m); return m;
  }
  function scorch(G, e) { smokeP(G, e.pos, '#202020', 20, 70, 6, .8); e.burnT = 14; }

  function damageP(G, dmg, api, msl) {
    const P = G.P; if (P.dead || G.won) return;
    P.hp -= dmg; G.dmgTaken += dmg; P.hitT = .5;
    api.shake(msl ? 12 : 4, msl ? .45 : .2); api.flash('#ff3b2b', msl ? .2 : .07);
    if (msl) { sfx(api, 'hitme'); floatMsg(G, api, 'DANO', '#ff5149'); api.vibe && api.vibe(80); }
    if (P.hp <= 0) die(G, api, 'O teu caça ficou fora de combate. Ejeção bem-sucedida.');
  }

  function fire(G, p, col, n, size, life) {
    const F = G.r3.fire;
    for (let i = 0; i < n; i++) F.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1) * size, vy: rand(-1, 1) * size, vz: rand(-1, 1) * size, life: life * rand(.6, 1.2), s0: size * .6, s1: size * 1.4, c0: col, c1: '#ff4a10', k: 1.6, drag: 3 });
  }
  function smokeP(G, p, col, s0, s1, life, a, light) {
    G.r3.smoke.spawn({ x: p.x + rand(-1, 1), y: p.y + rand(-1, 1), z: p.z + rand(-1, 1), vx: rand(-2, 2), vy: rand(0, 3), vz: rand(-2, 2), life: life * rand(.8, 1.2), s0, s1, c0: col, c1: light ? col : '#444444', a, drag: .5, grav: -1.5, rotv: rand(-.4, .4) });
  }
  function burst(G, p, col, n, sp) { for (let i = 0; i < n; i++) G.r3.fire.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1) * sp, vy: rand(-1, 1) * sp, vz: rand(-1, 1) * sp, life: rand(.5, 1), s0: 5, s1: 1, c0: col, k: 1.4, drag: 1.5 }); }
  function boom(G, p, size, api, me) {
    const r3 = G.r3, F = r3.fire, S = r3.smoke, s = size;
    for (let i = 0; i < 10 + s * 8; i++) F.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1) * 22 * s, vy: rand(-1, 1) * 22 * s, vz: rand(-1, 1) * 22 * s, life: rand(.35, .8) + s * .05, s0: 6 * s, s1: 20 * s, c0: '#fff1c2', c1: '#ff5a1a', k: 2.2, drag: 4 });
    for (let i = 0; i < 6 + s * 6; i++) S.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1) * 10 * s, vy: rand(-.5, 1.2) * 10 * s, vz: rand(-1, 1) * 10 * s, life: rand(2.2, 4) + s * .2, s0: 8 * s, s1: 34 * s, c0: '#5a524c', c1: '#2e2c2b', a: .85, drag: 1.2, grav: -3, rotv: rand(-.5, .5) });
    for (let i = 0; i < 14 + s * 6; i++) F.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-1, 1) * 90, vy: rand(-.5, 1) * 90, vz: rand(-1, 1) * 90, life: rand(.5, 1.1), s0: 1.6, s1: .4, c0: '#ffe2a0', k: 2, drag: 1.2, grav: 30 });
    r3.flash.position.copy(p); r3.flash.intensity = Math.max(r3.flash.intensity, 40 * s * s); r3.flash.distance = 260 * s;
    const P = G.P, d = p.distanceTo(P.pos);
    if (!me && d < 600) api.shake(clamp((600 - d) / 40 * s * .5, 1, 12), .35);
    if (d < 6000) sfx(api, 'boom', clamp(1 - d / 6000, .1, 1) * Math.min(1, s / 3 + .4));
  }

  /* ════════════════════════════════════════════════════════════════
     missão: vitória, derrota, rádio, arena
  ════════════════════════════════════════════════════════════════ */
  function radio(G, who, txt) { G.radio.push({ who, txt, life: 3 + txt.length / 22, t: 0 }); }
  function radioOnce(G, key, who, txt, cool) { G.saidT = G.saidT || {}; if (G.saidT[key] != null && (cool == null || G.time - G.saidT[key] < cool)) return; G.saidT[key] = G.time; radio(G, who, txt); }
  function floatMsg(G, api, t, c) { api.float(api.W / 2, api.H * .58, t, c, 18); }
  function rankOf(r) { return r >= 1.5 ? 'S' : r >= 1.28 ? 'A' : r >= 1.08 ? 'B' : 'C'; }

  function win(G, api) {
    if (G.won || G.P.dead) return;
    G.won = true; G.winT = 0; G.P.inv = 1;
    (G.M.end || []).forEach(([w, t]) => radio(G, w, t));
    G.say = { t: 'MISSÃO CUMPRIDA', s: G.M.name, life: 5, c: '#9dffbe', big: 1 };
    sfx(api, 'win');
    G.msls.forEach(m => { if (m.own === 'e') m.tgt = null; });
  }
  function results(G, api) {
    const M = G.M, P = G.P, par = M.par;
    const timeBonus = Math.round(Math.max(0, M.time - G.time) / M.time * par * .9);
    const dmgPen = Math.round(G.dmgTaken * par * .0035);
    const score = Math.max(0, G.score + timeBonus - dmgPen);
    const rank = rankOf(score / par);
    const sv = save(), idx = MISSIONS.findIndex(x => x.id === M.id), prev = sv.r[M.id + ':' + G.diff] || {};
    const ord = { S: 4, A: 3, B: 2, C: 1 };
    sv.r[M.id + ':' + G.diff] = { rank: (ord[rank] > (ord[prev.rank] || 0)) ? rank : prev.rank, score: Math.max(prev.score || 0, score) };
    sv.u = Math.max(sv.u || 1, idx + 2); putSave(sv);
    let rec = null;
    try { if (typeof GameProgress !== 'undefined') rec = GameProgress.record(ID, { won: true, score, mode: M.id + '-' + G.diff, meta: { mission: idx + 1, rank, all: idx + 1 >= MISSIONS.length } }); } catch (e) {}
    const next = MISSIONS[idx + 1];
    const acc = G.shots ? Math.round(G.hits / (G.shots * 2) * 100) : 0;
    api.panel({
      icon: rank === 'S' ? '🏅' : '🛩️', title: `${M.name} — missão cumprida`, big: score,
      sub: (rec && rec.newBest ? '<div class="ak-rec">★ Novo recorde!</div>' : '') + `<span class="sa-rank r${rank}">${rank}</span> Classificação`,
      stats: [['Abates', G.kills], ['Pontos de combate', G.score], ['Bónus de tempo', '+' + timeBonus], ['Dano sofrido', Math.round(G.dmgTaken) + '%'], ['Pontaria', acc + '%'], ['Tempo', fmtT(G.time)]],
      html: `<style>.sa-rank{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;font:900 1.6rem 'Space Grotesk',system-ui;margin-right:8px;vertical-align:middle;background:#1f2937;color:#e5e7eb;box-shadow:inset 0 0 0 2px rgba(255,255,255,.15)}.sa-rank.rS{background:linear-gradient(135deg,#fde047,#f59e0b);color:#3b2600}.sa-rank.rA{background:linear-gradient(135deg,#86efac,#22c55e);color:#052e16}.sa-rank.rB{background:linear-gradient(135deg,#93c5fd,#3b82f6);color:#0b1f4a}</style>`,
      buttons: [
        ...(next ? [{ label: '▶ Missão seguinte', primary: true, fn: () => api.play(next.id) }] : []),
        { label: '↺ Repetir missão', primary: !next, fn: () => api.play(M.id) },
        { label: 'Hangar', fn: () => api.menu() },
      ],
    });
  }
  function failMission(G, api, why) {
    if (G.failed || G.won) return;
    G.failed = why; G.endT = 0;
    G.say = { t: 'MISSÃO FALHADA', s: why, life: 4, c: '#ff5149', big: 1 };
    sfx(api, 'fail');
  }
  function endFail(G, api) {
    const M = G.M, why = G.failed || G.P.why || '';
    if (M.kind === 'arena') {
      api.over({ won: G.wave >= 5, score: G.score, title: `Arena — vaga ${G.wave}`, icon: '🛩️', sub: why, stats: [['Vaga', G.wave], ['Abates', G.kills], ['Tempo', fmtT(G.time)]], meta: { wave: G.wave } });
      return;
    }
    if (M.kind === 'free') { respawn(G); return; }
    try { if (typeof GameProgress !== 'undefined') GameProgress.record(ID, { won: false, score: 0, mode: M.id + '-' + G.diff, meta: {} }); } catch (e) {}
    let ph = Math.max(0, G.phase); if (M.phases[ph] && M.phases[ph].fcore) ph--;
    api.panel({
      icon: '🪂', title: 'Missão falhada', sub: why,
      stats: [['Objetivo', (M.phases[ph] || {}).obj || '—'], ['Abates', G.kills], ['Tempo', fmtT(G.time)]],
      buttons: [
        ...(ph > 0 ? [{ label: `↻ Retomar no objetivo ${ph + 1}`, primary: true, fn: () => { CHECKPOINT = { mode: M.id, phase: ph }; api.play(M.id); } }] : []),
        { label: '↺ Recomeçar a missão', primary: ph === 0, fn: () => api.play(M.id) },
        { label: 'Hangar', fn: () => api.menu() },
      ],
    });
  }
  function respawn(G) {
    const P = G.P, st = G.M.start;
    P.dead = false; P.alive = true; P.hp = P.hpMax; P.speed = P.S.cruise; P.mesh.visible = true; P.why = null;
    P.pos.set(st[0], st[1], st[2]); hdgVec(st[3], P.fwd); orient(P.q, P.fwd, 0); syncPlayer(P);
    P.trails.forEach(t => t.clear()); G.sent = 0; G.endT = 0; G.cam.q.copy(P.q); G.say = null;
  }
  function arena(G, h, api) {
    const alive = G.ents.filter(e => e.alive && !e.T.fixed).length;
    if (alive === 0 && G.waveT <= 0) {
      G.waveT = 4;
      if (G.wave > 0) { const P = G.P; P.hp = Math.min(P.hpMax, P.hp + 25); P.msl = Math.min(P.S.msl, P.msl + 24); P.sp = Math.min(P.S.spN, P.sp + 4); G.say = { t: `VAGA ${G.wave} SUPERADA`, s: 'Reparações e munições a bordo.', life: 2.6, c: '#9dffbe' }; }
    }
    if (G.waveT > 0) {
      G.waveT -= h;
      if (G.waveT <= 0) {
        G.wave++;
        const n = G.wave, P = G.P;
        hdgVec(rand(0, 360), V1);
        const cx = clamp(P.pos.x + V1.x * 5000, -8000, 8000), cz = clamp(P.pos.z + V1.z * 5000, -8000, 8000), alt = clamp(P.pos.y + 300, 1400, 4000);
        spawnGroup(G, { t: 'fighter', n: Math.min(8, 1 + n), at: [cx, alt, cz], r: 700 });
        if (n >= 4) spawnGroup(G, { t: 'ace', n: Math.min(3, Math.floor((n - 1) / 3)), at: [-cx, alt + 400, -cz], r: 300 });
        if (n % 3 === 0) spawnGroup(G, { t: 'heavy', n: 1, at: [cx * .5, 1500, cz * .5], orbit: 4500 });
        if (n >= 2 && n % 2 === 0) spawnGroup(G, { t: 'sam', n: 1 + Math.floor(n / 4), at: [rand(-5000, 5000), 0, rand(-5000, 5000)], r: 1500 });
        G.say = { t: `VAGA ${n}`, s: `${Math.min(8, 1 + n)} caças-drone${n >= 4 ? ' + Espectros' : ''}`, life: 2.4, c: '#ffd34d' };
        sfx(api, 'obj');
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt;
    if (!G.ok || G.freeze) return;
    readInput(G, api, dt);
    const n = Math.max(1, Math.ceil(dt / (1 / 60))), h = dt / n;
    for (let i = 0; i < n; i++) step(G, h, api);
    G.act = {};
    fxStep(G, dt);
  }
  function step(G, h, api) {
    const P = G.P;
    G.time += h; G.fxFrame++;
    G.warn.lock = Math.max(0, G.warn.lock - h * 2);
    if (!P.dead) { fly(G, h, api); if (!P.dead) weapons(G, h, api); }
    else { P.deadT += h; G.endT += 0; }
    G.ents.forEach(e => {
      if (e.wreck) { wreckStep(G, e, h, api); return; }
      if (!e.alive) { if (e.burnT > 0) { e.burnT -= h; if (G.fxFrame % 4 === 0) { smokeP(G, e.pos, '#2a2a2a', 10, 60, 5, .6); fire(G, e.pos, '#ff7a2a', 1, 8, .4); } } return; }
      if (e.k === 'fort') fortress(G, e, h, api);
      else if (e.fort) { /* peças da fortaleza: posicionadas pela fortaleza */ }
      else if (e.T.air) aiAir(G, e, h, api);
      else aiGround(G, e, h, api);
    });
    missiles(G, h, api); bullets(G, h, api); flaresStep(G, h);
    debrisStep(G, h);
    if (P.hitT > 0) P.hitT -= h;
    if (!P.dead && P.hp < P.hpMax * .4 && G.fxFrame % 3 === 0) smokeP(G, V1.copy(P.pos).addScaledVector(P.fwd, -8), '#3a3a3a', 3, 18, 1.8, .55);
    if (G.D.regen && !P.dead && P.hitT <= 0) P.hp = Math.min(P.hpMax, P.hp + h * .6);
    /* missão */
    const M = G.M;
    if (M.kind === 'mission' && !G.won && !G.failed && !P.dead) {
      if (G.time > M.time) failMission(G, api, 'O tempo da missão esgotou-se.');
      else if (G.nextPhaseT < 0 && phaseDone(G)) { G.nextPhaseT = 2.4; }
      if (G.nextPhaseT > 0) { G.nextPhaseT -= h; if (G.nextPhaseT <= 0) { G.nextPhaseT = -1; nextPhase(G, api); } }
    }
    if (M.kind === 'arena' && !P.dead) arena(G, h, api);
    if (M.kind === 'free' && G.ringI >= G.rings.length && G.rings.length && !G.freeDone) { G.freeDone = 1; G.say = { t: 'PERCURSO COMPLETO', s: 'Todos os anéis em ' + fmtT(G.time), life: 4, c: '#6fe8ff' }; }
    if (G.won) { G.winT += h; if (G.winT > 6 && !G.sent) { G.sent = 1; results(G, api); } }
    if ((G.failed || P.dead) && !G.won) { G.endT += h; if (G.endT > 3.4 && !G.sent) { G.sent = 1; endFail(G, api); } }
    /* avisos */
    let mw = 0;
    G.msls.forEach(m => { if (m.own === 'e' && m.tgt === P) { const d = m.pos.distanceTo(P.pos); if (d < 4500) mw = Math.max(mw, 1 - d / 4500 + .2); } });
    G.warn.msl = mw;
    if (G.say) { G.say.life -= h; if (G.say.life <= 0) G.say = null; }
    G.feed.forEach(f => { f.life -= h; }); G.feed = G.feed.filter(f => f.life > 0);
    if (G.radio.length) { const r = G.radio[0]; if (r.t === 0) sfx(api, 'radio'); r.t += h; if (r.t > r.life) G.radio.shift(); }
    /* sons de aviso */
    G.beepT -= h;
    if (mw > 0 && G.beepT <= 0) { sfx(api, 'mslwarn'); G.beepT = lerp(.4, .09, clamp(mw, 0, 1)); }
    else if (G.warn.lock > 0 && G.beepT <= 0) { sfx(api, 'lockwarn'); G.beepT = .5; }
    G.lockBeepT -= h;
    if (!P.dead && P.lockCand && P.lock < 1 && G.lockBeepT <= 0) { sfx(api, 'lockbeep'); G.lockBeepT = .14; }
    if (!P.dead && P.lockCand && P.lock >= 1 && G.lockBeepT <= 0) { sfx(api, 'lockon'); G.lockBeepT = .075; }
  }
  function wreckStep(G, e, h, api) {
    const w = e.wreck, hg = G.r3.hg;
    w.t += h; w.v.y -= G0 * 1.6 * h; w.v.multiplyScalar(1 - h * .2);
    e.pos.addScaledVector(w.v, h);
    Q1.setFromEuler(E1.set(w.spin * h * .3, w.spin * h, w.roll * h)); e.q.multiply(Q1);
    if (G.fxFrame % 2 === 0) { fire(G, e.pos, '#ff9a3a', 2, 6 + e.r * .4, .25); smokeP(G, e.pos, '#2d2b2a', 5 + e.r * .3, 24 + e.r, 2.6, .75); }
    if (e.pos.y < Math.max(0, hg.at(e.pos.x, e.pos.z)) + 2 || w.t > 9) { boom(G, e.pos, e.k === 'heavy' ? 4 : 1.6, api); e.wreck = null; e.mesh.visible = false; if (e.pos.y > 1) scorch(G, e); }
  }
  function debrisStep(G, h) {
    G.r3.debris.forEach(d => {
      if (!d.visible) return; const u = d.userData; u.t += h; u.v.y -= G0 * h; d.position.addScaledVector(u.v, h); d.rotation.x += u.w.x * h; d.rotation.y += u.w.y * h; d.rotation.z += u.w.z * h;
      if (G.fxFrame % 3 === 0) smokeP(G, d.position, '#3a3836', 2, 9, 1.4, .5);
      if (u.t > 5 || d.position.y < Math.max(0, G.r3.hg.at(d.position.x, d.position.z))) d.visible = false;
    });
  }
  function fxStep(G, dt) {
    const r3 = G.r3;
    r3.smoke.update(dt); r3.fire.update(dt);
    r3.flash.intensity *= Math.max(0, 1 - dt * 7);
    if (G.P.trails) G.P.trails.forEach(t => t.update(r3.cam, dt));
  }
  /* durante o "toca para começar": voo em linha reta e câmara de apresentação */
  function idle(G, dt, api) {
    if (!G.ok) return;
    const P = G.P; G.t += dt; G.cam.intro += dt;
    P.pos.addScaledVector(P.vel, dt * .0);
    G.ents.forEach(e => { if (e.alive && e.k === 'radar' && e.R.spin) e.R.spin.rotation.y += dt; });
    fxStep(G, dt);
  }
  function after(G, dt, api) { if (!G.ok) return; G.t += dt; const n = Math.max(1, Math.ceil(dt / (1 / 60))); for (let i = 0; i < n; i++) { G.ents.forEach(e => { if (e.wreck) wreckStep(G, e, dt / n, api); }); debrisStep(G, dt / n); } fxStep(G, dt); }

  /* ════════════════════════════════════════════════════════════════
     desenho 3D
  ════════════════════════════════════════════════════════════════ */
  function fit(G, api) {
    const r3 = G.r3, R = r3.renderer, st = api.stage, w = st.clientWidth || 1, hh = st.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, r3.Q.dpr) * G.perf.q;
    if (w !== r3.w || hh !== r3.h || Math.abs(dpr - r3.dpr) > .01) {
      r3.w = w; r3.h = hh; r3.dpr = dpr; R.setPixelRatio(dpr); R.setSize(w, hh, false); Arcade3D.outlineRes(w * dpr, hh * dpr);
      r3.cam.aspect = w / hh; r3.cam.updateProjectionMatrix();
    }
  }
  function camera(G, dt, api) {
    const r3 = G.r3, cam = r3.cam, P = G.P, C = G.cam;
    const k = 1 - Math.exp(-dt * 5.5);
    let fov = 60 + P.ab * 9 + (P.speed - P.S.cruise) / 40;
    const tgtView = (K(G, 'KeyT') || C.padTgt) && P.target && P.target.alive;
    if (C.fixed) {
      /* câmara fixa (capturas para a capa / testes) */
      cam.position.copy(C.fixed.pos); cam.up.set(0, 1, 0); cam.lookAt(C.fixed.look); fov = C.fixed.fov || 50;
    } else if (api.state === 'ready' || !G.ok) {
      /* apresentação: a câmara gira à volta do caça */
      const a = C.intro * .32 + 2.4, d = 26 + Math.sin(C.intro * .4) * 5;
      cam.position.set(P.pos.x + Math.sin(a) * d, P.pos.y + 4 + Math.sin(C.intro * .5) * 3, P.pos.z + Math.cos(a) * d);
      cam.up.set(0, 1, 0); cam.lookAt(P.pos); fov = 50;
    } else if (P.dead) {
      C.q.slerp(P.q, k * .3);
      V1.set(0, 0, 1).applyQuaternion(C.q);
      const wr = V2.copy(P.pos);
      cam.position.lerp(V3.copy(wr).addScaledVector(V1, -60).add(V4.set(0, 25, 0)), k * .5);
      cam.up.set(0, 1, 0); cam.lookAt(wr);
    } else if (tgtView) {
      V1.subVectors(P.target.pos, P.pos); const d = V1.length(); V1.normalize();
      V2.copy(P.pos).addScaledVector(V1, -26).addScaledVector(P.up, 7);
      C.pos.lerp(V2, k * 1.5); cam.position.copy(C.pos);
      cam.up.copy(P.up); cam.lookAt(V3.copy(P.pos).addScaledVector(V1, Math.min(d, 400)));
      C.q.copy(P.q);
    } else if (C.mode === 1) {
      /* cabine */
      const cp = W().JETS[G.plane].canopy;
      cam.position.copy(P.pos).addScaledVector(P.fwd, cp[2] + .4).addScaledVector(P.up, cp[1] + .55);
      cam.quaternion.copy(P.q).multiply(Q1.setFromAxisAngle(UP, Math.PI));
      C.q.copy(P.q); C.pos.copy(cam.position);
      fov = 66 + P.ab * 6;
    } else {
      /* perseguição com atraso: vê-se o avião a rodar */
      C.q.slerp(P.q, Math.min(1, dt * (4.2 + P.speed / 120)));
      const lx = C.lookX || 0, ly = C.lookY || 0;
      V1.set(0, 0, 1).applyQuaternion(C.q); V2.set(0, 1, 0).applyQuaternion(C.q);
      const back = 25 + P.ab * 4 - (P.speed - P.S.cruise) * .004;
      V3.copy(V1).multiplyScalar(-back).addScaledVector(V2, 5.6);
      if (lx || ly) { Q2.setFromAxisAngle(V2, -lx * Math.PI * .9); V3.applyQuaternion(Q2); V3.addScaledVector(V2, -ly * 12); }
      C.pos.copy(P.pos).add(V3);
      const [sx, sy] = api.shakeXY, sh = (P.ab * .06 + (P.hitT > 0 ? .4 : 0));
      cam.position.copy(C.pos).add(V4.set(rand(-1, 1) * sh + sx * .02, rand(-1, 1) * sh + sy * .02, 0));
      cam.up.copy(V2);
      cam.lookAt(V4.copy(P.pos).addScaledVector(V1, 40).addScaledVector(V2, 3.4));
    }
    /* nunca por baixo do relevo (despistes, desfiladeiro) */
    if (!C.fixed && C.mode !== 1) { const gy = Math.max(0, G.r3.hg.at(cam.position.x, cam.position.z)) + (P.dead ? 25 : 3); if (cam.position.y < gy) { cam.position.y = gy; if (P.dead) cam.lookAt(P.pos); } }
    if (cam.aspect < 1 && !C.fixed) fov += (1 - cam.aspect) * 26;
    C.fov = lerp(C.fov, fov, Math.min(1, dt * 3));
    if (Math.abs(cam.fov - C.fov) > .05) { cam.fov = C.fov; cam.updateProjectionMatrix(); }
    P.mesh.visible = !P.dead && !(C.mode === 1 && !tgtView && api.state !== 'ready');
  }
  function draw(G, ctx, Wl, Hl, api) {
    if (!G.ok || !G.r3) {
      const k = pxK(api); ctx.save(); ctx.scale(k, k); const w = Wl / k, h = Hl / k;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1830'); g.addColorStop(1, '#30476a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8f1ff'; ctx.font = "700 16px 'Space Grotesk', system-ui"; ctx.textAlign = 'center';
      ctx.fillText(G.fail3d ? 'Este jogo precisa de WebGL (3D).' : 'A preparar o voo…', w / 2, h / 2);
      if (!G.fail3d) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h / 2 + 34, 12, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#9dffbe'; ctx.beginPath(); ctx.arc(w / 2, h / 2 + 34, 12, G.t * 5, G.t * 5 + 1.6); ctx.stroke(); }
      ctx.restore(); return;
    }
    const r3 = G.r3, dt = Math.min(.05, G.lastT ? (performance.now() - G.lastT) / 1000 : .016); G.lastT = performance.now();
    perf(G, dt);
    fit(G, api);
    const P = G.P, cam = r3.cam;
    /* modelos */
    P.mesh.position.copy(P.pos); P.mesh.quaternion.copy(P.q);
    animJet(G, P, dt);
    G.ents.forEach(e => {
      if (e.fort) return;
      if (!e.alive && !e.wreck) return;
      e.mesh.position.copy(e.pos); e.mesh.quaternion.copy(e.q); if (e.yoff) e.mesh.position.y -= e.yoff;
      const R = e.R;
      if (R.nozzles) R.nozzles.forEach((s, i) => { s.scale.setScalar((e.k === 'heavy' ? 6 : 3.2) * (1 + Math.sin(G.t * 40 + i) * .08)); });
      if (R.lights) R.lights.forEach(s => { s.visible = Math.floor(G.t * 1.2 + e.id * .3) % 2 === 0; });
    });
    camera(G, dt, api);
    cam.updateMatrixWorld();
    r3.skyM.position.copy(cam.position); r3.skyM.material.uniforms.uTime.value = G.t;
    Arcade3D.waterTick(r3.water.material, G.t, cam);
    /* sol e sombra seguem o jogador */
    r3.sun.position.copy(P.pos).addScaledVector(r3.sunDir, 400); r3.sun.target.position.copy(P.pos);
    if (r3.Q.shadows) { const c = r3.sun.shadow.camera; c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 50; c.far = 800; c.updateProjectionMatrix(); }
    if (G.fxFrame - (r3.cloudSortF || -99) > 12) { r3.clouds.sort(cam); r3.cloudSortF = G.fxFrame; }
    const ppu = r3.renderer.domElement.height / (2 * Math.tan(cam.fov * DEG / 2));
    r3.smoke.mat.uniforms.uScale.value = ppu; r3.fire.mat.uniforms.uScale.value = ppu;
    r3.renderer.render(r3.scene, cam);
    G.cloudIn = r3.clouds.inside(cam.position);
    hud(G, ctx, Wl, Hl, api, dt);
    audioUpdate(G, api);
  }
  /* superfícies de comando, chama, luzes */
  function animJet(G, P, dt) {
    const R = P.R, s = R.surf || {}, I = G.in;
    const ail = clamp(P.wr / P.S.roll, -1, 1) * .35, el = clamp(P.wp / P.S.pitch, -1, 1) * .3;
    if (s.ailL) s.ailL.rotation.x = -ail; if (s.ailR) s.ailR.rotation.x = ail;
    if (s.stabL) s.stabL.rotation.x = el - ail * .4; if (s.stabR) s.stabR.rotation.x = el + ail * .4;
    if (s.canL) s.canL.rotation.x = -el * .8; if (s.canR) s.canR.rotation.x = -el * .8;
    const ab = P.ab, thr = I.brake ? .2 : .55;
    R.flames.forEach((f, i) => { const fl = 1 + Math.sin(G.t * 60 + i * 1.7) * .08; const base = i % 2 ? .4 + ab * 1.4 : .3 + ab * 3.2; f.scale.z = base * fl * (ab > .05 ? 1 : thr); f.visible = ab > .05 || i % 2 === 1; });
    R.nozzles.forEach(sp => sp.scale.setScalar((.9 + ab * 6.5) * (1 + Math.sin(G.t * 50) * .05)));
    R.lights.forEach((l, i) => { l.visible = (Math.floor(G.t * 1.4) % 2 === 0) || G.r3.sky.stars; });
  }
  function perf(G, dt) {
    const p = G.perf; p.acc += dt; p.n++;
    if (p.acc > 2.5) {
      const avg = p.acc / p.n;
      if (avg > .026 && p.q > .6) p.q = Math.max(.6, p.q - .15);
      else if (avg < .014 && p.q < 1) p.q = Math.min(1, p.q + .1);
      p.acc = 0; p.n = 0;
    }
  }

  /* ════════════════════════════════════════════════════════════════
     HUD (canvas 2D, coordenadas em px CSS)
  ════════════════════════════════════════════════════════════════ */
  const HC = '#9dffbe', HD = 'rgba(157,255,190,.55)', RED = '#ff5149', YEL = '#ffd34d', CY = '#6fe8ff';
  const MONO = "ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace";
  function hud(G, ctx, Wl, Hl, api, dt) {
    const k = pxK(api), w = Wl / k, h = Hl / k, r3 = G.r3, cam = r3.cam, P = G.P;
    ctx.save(); ctx.scale(k, k);
    const proj = (p, out) => { V1.copy(p).applyMatrix4(cam.matrixWorldInverse); const z = V1.z; V1.applyMatrix4(cam.projectionMatrix); out.x = (V1.x + 1) / 2 * w; out.y = (1 - V1.y) / 2 * h; out.front = z < 0; out.cz = z; return out; };
    const sp = {}, sp2 = {};
    /* reflexo do sol e vinheta */
    lensFlare(G, ctx, w, h, proj);
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .45, w / 2, h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.32 + (P.hitT > 0 ? .1 : 0)})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    if (P.hitT > 0 || (P.hp < P.hpMax * .3 && !P.dead)) { const a = P.hitT > 0 ? P.hitT * .7 : (.12 + Math.sin(G.t * 5) * .06); const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .7); rg.addColorStop(0, 'rgba(255,40,30,0)'); rg.addColorStop(1, `rgba(255,40,30,${a})`); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h); }
    if (G.cloudIn > 0) { ctx.fillStyle = `rgba(${r3.sky.stars ? '120,135,165' : '240,244,248'},${Math.min(.85, G.cloudIn * 1.4)})`; ctx.fillRect(0, 0, w, h); }
    if (G.noHud) { ctx.restore(); return; }
    if (api.state === 'ready') { cinematic(G, ctx, w, h); ctx.restore(); return; }
    if (G.cam.mode === 1 && !P.dead) cockpit(G, ctx, w, h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 3;
    const sm = Math.min(w, h) < 520;
    if (!P.dead && !G.won || G.won && G.winT < 1.5) {
      targets(G, ctx, w, h, proj, sp, sp2, sm);
      nose(G, ctx, w, h, proj, sp, sm);
      tapes(G, ctx, w, h, sm);
      radar(G, ctx, w, h, sm);
      weaponsPanel(G, ctx, w, h, sm);
      warnings(G, ctx, w, h, proj, sm);
    }
    messages(G, ctx, w, h, sm);
    if (G.touch && !P.dead) touchUI(G, ctx, w, h, api);
    else if (!P.dead) helpPanel(G, ctx, w, h, sm);
    ctx.restore();
  }
  /* lista de comandos à esquerda (PC); H ou clique no título esconde/mostra */
  function helpPanel(G, ctx, w, h, sm) {
    const x = sm ? 12 : 22, y = sm ? 110 : 118, bw = 176;
    ctx.save(); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
    const head = (open) => {
      ctx.fillStyle = 'rgba(4,16,10,.55)'; U.rr(ctx, x, y, bw, 22, 8); ctx.fill();
      ctx.font = `700 10px ${MONO}`; ctx.fillStyle = HC; ctx.textAlign = 'left';
      ctx.fillText((open ? '▾ ' : '▸ ') + 'COMANDOS', x + 9, y + 15);
      ctx.fillStyle = HD; ctx.textAlign = 'right'; ctx.fillText(open ? 'H esconde' : 'H mostra', x + bw - 9, y + 15);
      G.helpBox = { x, y, w: bw, h: 22 };
    };
    const up = G.inv ? '↑ / W' : '↓ / S', dn = G.inv ? '↓ / S' : '↑ / W';
    const rows = [['PILOTAR'], [up, 'sobe o nariz'], [dn, 'desce o nariz'], ['← → · A D', G.ctrl === 'std' ? 'curva' : 'roda'], ['Q · E', 'leme'], ['Shift', 'acelera'], ['Z', 'trava · curva fechada'],
      ['COMBATE'], ['Espaço · btn dir.', 'míssil'], ['F · clique', 'metralhadora'], ['X', 'arma especial'], ['R', 'trocar de alvo'], ['B', 'flares'],
      ['CÂMARA'], ['C', 'cabine / exterior'], ['T (manter)', 'olhar o alvo'], ['P · Esc', 'pausa']];
    const lh = 14.5, hh = rows.length * lh + 14;
    const room = h - (sm ? 54 : 74) * 2 - 60 - y - 22;
    if (!G.help || hh > room) { head(false); ctx.restore(); return; }
    head(true);
    ctx.fillStyle = 'rgba(4,16,10,.42)'; U.rr(ctx, x, y + 26, bw, hh, 8); ctx.fill();
    let yy = y + 26 + 15;
    rows.forEach(r => {
      if (r.length === 1) { ctx.font = `800 9px ${MONO}`; ctx.fillStyle = 'rgba(157,255,190,.6)'; ctx.textAlign = 'left'; ctx.fillText(r[0], x + 9, yy); }
      else { ctx.font = `700 10px ${MONO}`; ctx.fillStyle = HC; ctx.textAlign = 'left'; ctx.fillText(r[0], x + 9, yy); ctx.font = `500 10px 'Space Grotesk', system-ui`; ctx.fillStyle = 'rgba(235,245,240,.9)'; ctx.textAlign = 'right'; ctx.fillText(r[1], x + bw - 9, yy); }
      yy += lh;
    });
    ctx.restore();
  }
  function cinematic(G, ctx, w, h) {
    const bh = Math.min(70, h * .1);
    ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `700 11px ${MONO}`; ctx.textAlign = 'left';
    const M = G.M, map = W().MAPS[M.map], sky = W().SKIES[M.sky];
    ctx.fillText(`${map.name.toUpperCase()} · ${sky.name.toUpperCase()} · ${PLANES[G.plane].name.toUpperCase()}`, 18, h - bh / 2 + 4);
    ctx.textAlign = 'right'; ctx.fillText(G.diff === 'easy' ? 'FÁCIL' : G.diff === 'hard' ? 'DIFÍCIL' : 'NORMAL', w - 18, h - bh / 2 + 4);
  }
  function cockpit(G, ctx, w, h) {
    ctx.save();
    ctx.fillStyle = '#0d1014';
    /* armação da cobertura */
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * .09, 0); ctx.quadraticCurveTo(w * .03, h * .3, 0, h * .55); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w * .91, 0); ctx.quadraticCurveTo(w * .97, h * .3, w, h * .55); ctx.fill();
    ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(w * .07, 0); ctx.quadraticCurveTo(w / 2, h * .05, w * .93, 0); ctx.stroke();
    /* painel */
    const ph = h * .2;
    const g = ctx.createLinearGradient(0, h - ph, 0, h); g.addColorStop(0, '#1b1f25'); g.addColorStop(1, '#0a0c0f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h - ph * .7); ctx.quadraticCurveTo(w / 2, h - ph * 1.35, w, h - ph * .7); ctx.lineTo(w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(157,255,190,.18)'; ctx.lineWidth = 1; ctx.stroke();
    /* combinador do HUD */
    ctx.strokeStyle = 'rgba(160,200,190,.25)'; ctx.lineWidth = 2; ctx.strokeRect(w / 2 - 150, h / 2 - 150, 300, 260);
    ctx.restore();
  }
  function lensFlare(G, ctx, w, h, proj) {
    const r3 = G.r3, cam = r3.cam, s = r3.sky;
    if (s.moon || s.noFlare || G.cloudIn > .3) return;
    V2.copy(cam.position).addScaledVector(r3.sunDir, 10000);
    const p = proj(V2, {}); if (!p.front || p.x < -200 || p.x > w + 200 || p.y < -200 || p.y > h + 200) return;
    /* tapado pelo relevo? */
    const hg = r3.hg; for (let i = 1; i <= 10; i++) { V3.copy(cam.position).addScaledVector(r3.sunDir, i * 700); if (hg.at(V3.x, V3.z) > V3.y) return; }
    const vis = clamp(1 - Math.hypot(p.x - w / 2, p.y - h / 2) / (Math.max(w, h) * .9), 0, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const col = s.name === 'Pôr do sol' ? [255, 170, 110] : [255, 236, 200];
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 220); g.addColorStop(0, `rgba(${col},${.55 * vis + .2})`); g.addColorStop(.25, `rgba(${col},${.16 * vis})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(p.x - 220, p.y - 220, 440, 440);
    const dx = w / 2 - p.x, dy = h / 2 - p.y;
    [[.35, 26, [120, 200, 255], .1], [.62, 14, [255, 200, 120], .14], [.9, 44, [140, 255, 200], .06], [1.25, 20, [255, 140, 200], .1], [1.6, 70, [120, 160, 255], .05]].forEach(([t, r, c, a]) => {
      const x = p.x + dx * t * 2, y = p.y + dy * t * 2, gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(${c},${a * vis * 1.6})`); gg.addColorStop(.7, `rgba(${c},${a * vis})`); gg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    });
    ctx.strokeStyle = `rgba(${col},${.12 * vis})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - 260, p.y); ctx.lineTo(p.x + 260, p.y); ctx.stroke();
    ctx.restore();
  }
  function targets(G, ctx, w, h, proj, sp, sp2, sm) {
    const P = G.P;
    ctx.font = `600 ${sm ? 9 : 10}px ${MONO}`; ctx.textAlign = 'center';
    const taken = [];
    const free = (x, y) => { if (taken.some(([a, b]) => Math.abs(a - x) < 52 && Math.abs(b - y) < 26)) return false; taken.push([x, y]); return true; };
    const order = G.ents.filter(targetable).sort((a, b) => (b === P.target) - (a === P.target) || (b.tgt - a.tgt) || a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos));
    order.forEach(e => {
      if (!targetable(e)) return;
      const d = e.pos.distanceTo(P.pos); if (d > 14000) return;
      const p = proj(e.pos, sp); if (!p.front || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) return;
      const sel = e === P.target, locked = (P.lockCand === e && P.lock >= 1) || (P.mlocks.get(e) >= 1);
      const s = clamp(e.r * 900 / d, sel ? 13 : 9, 46);
      const col = locked ? RED : e.tgt ? YEL : (e.T.air ? HC : '#c7f9da');
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sel ? 2 : 1.3;
      if (e.T.air) {
        const c = s * .45; ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { ctx.moveTo(p.x + a * s, p.y + b * s - b * c); ctx.lineTo(p.x + a * s, p.y + b * s); ctx.lineTo(p.x + a * s - a * c, p.y + b * s); });
        ctx.stroke();
      } else { ctx.beginPath(); ctx.rect(p.x - s, p.y - s, s * 2, s * 2); ctx.globalAlpha = .9; ctx.stroke(); ctx.globalAlpha = 1; }
      if (sel) { ctx.beginPath(); ctx.moveTo(p.x, p.y - s - 4); ctx.lineTo(p.x - 5, p.y - s - 11); ctx.lineTo(p.x + 5, p.y - s - 11); ctx.closePath(); ctx.fill(); }
      const lab = (sel || d < 4000 || e.tgt) && free(p.x, p.y);
      if (e.tgt && (lab || sel)) { ctx.fillStyle = YEL; ctx.fillText('TGT', p.x, p.y - s - (sel ? 15 : 5)); }
      if (lab) { ctx.fillStyle = col; ctx.fillText(e.T.name, p.x, p.y + s + 11); ctx.fillText((d / 1000).toFixed(1), p.x, p.y + s + 22); }
      if (e.shield) { ctx.strokeStyle = '#ff8aa0'; ctx.beginPath(); ctx.arc(p.x, p.y, s + 6, 0, TAU); ctx.stroke(); }
      /* mira de avanço da metralhadora */
      if (sel && d < 1700 && e.T.air) {
        let t = d / 1080;
        for (let i = 0; i < 2; i++) { V2.subVectors(e.pos, P.pos).addScaledVector(e.vel, t).addScaledVector(P.vel, -t); t = V2.length() / 1080; }
        V2.normalize(); V3.copy(P.pos).addScaledVector(V2, 2000);
        const q = proj(V3, sp2);
        if (q.front) { ctx.strokeStyle = HC; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(q.x, q.y, 1.6, 0, TAU); ctx.fillStyle = HC; ctx.fill(); }
      }
    });
    /* seta para o alvo fora do ecrã / para o anel seguinte */
    const offArrow = (pos, col, label) => {
      const p = proj(pos, sp);
      if (p.front && p.x > 30 && p.x < w - 30 && p.y > 60 && p.y < h - 30) return;
      V1.copy(pos).applyMatrix4(G.r3.cam.matrixWorldInverse);
      let ax = V1.x, ay = -V1.y; if (V1.z > 0 && Math.abs(ax) + Math.abs(ay) < 1e-3) ay = 1;
      const a = Math.atan2(ay, ax), R = Math.min(w, h) * .36, x = w / 2 + Math.cos(a) * R, y = h / 2 + Math.sin(a) * R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, -9); ctx.lineTo(0, 0); ctx.lineTo(-4, 9); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = col; ctx.fillText(label, x - Math.cos(a) * 22, y - Math.sin(a) * 22 + 4);
    };
    if (P.target && P.target.alive) offArrow(P.target.pos, P.target.tgt ? YEL : HC, (P.target.pos.distanceTo(P.pos) / 1000).toFixed(1));
    const ring = G.rings[G.ringI];
    if (ring) {
      offArrow(ring.pos, CY, (ring.pos.distanceTo(P.pos) / 1000).toFixed(1));
      G.rings.forEach((r, i) => { const m = r.mesh.userData; if (!m.ring) return; const on = i === G.ringI; m.ring.material.color.set(on ? '#5cf2ff' : '#2b8fa0'); m.ring.material.opacity = on ? .95 : .35; m.inner.visible = on; if (on) r.mesh.rotation.z += .02; });
      const p = proj(ring.pos, sp);
      if (p.front) { ctx.strokeStyle = CY; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, 10 + Math.sin(G.t * 6) * 2, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    }
    /* mísseis inimigos: setas vermelhas à volta do centro */
    G.msls.forEach(m => {
      if (m.own !== 'e' || m.tgt !== P) return;
      V1.copy(m.pos).applyMatrix4(G.r3.cam.matrixWorldInverse);
      const a = Math.atan2(-V1.y, V1.x), R = Math.min(w, h) * .2, x = w / 2 + Math.cos(a) * R, y = h / 2 + Math.sin(a) * R;
      const p = proj(m.pos, sp);
      if (p.front && p.x > 0 && p.x < w && p.y > 0 && p.y < h) { ctx.strokeStyle = RED; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU); ctx.stroke(); ctx.fillStyle = RED; ctx.fillText('MSL', p.x, p.y - 11); }
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = RED; ctx.globalAlpha = .6 + Math.sin(G.t * 20) * .4; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    });
  }
  function nose(G, ctx, w, h, proj, sp, sm) {
    const P = G.P, cam = G.r3.cam;
    V2.copy(P.pos).addScaledVector(P.fwd, 2000);
    const n = proj(V2, sp); if (!n.front) return;
    const nx = n.x, ny = n.y;
    /* escada de inclinação */
    let hx = P.fwd.x, hz = P.fwd.z; const hl = Math.hypot(hx, hz); if (hl < 1e-4) { hx = 0; hz = 1; } else { hx /= hl; hz /= hl; }
    const rx = -hz, rz = hx;
    const pitchNow = Math.asin(clamp(P.fwd.y, -1, 1)) / DEG;
    ctx.font = `600 9px ${MONO}`; ctx.textAlign = 'center';
    for (let a = -80; a <= 80; a += 10) {
      if (Math.abs(a - pitchNow) > 28) continue;
      const r = a * DEG, cr = Math.cos(r) * 3000, L = a === 0 ? 700 : 380;
      const cx0 = P.pos.x + hx * cr, cy0 = P.pos.y + Math.sin(r) * 3000, cz0 = P.pos.z + hz * cr;
      const pa = proj(V3.set(cx0 + rx * L, cy0, cz0 + rz * L), {}), pb = proj(V3.set(cx0 - rx * L, cy0, cz0 - rz * L), {});
      const pc = proj(V3.set(cx0, cy0, cz0), {});
      if (!pa.front || !pb.front) continue;
      if (Math.hypot(pc.x - nx, pc.y - ny) > (sm ? 120 : 170)) continue;
      ctx.strokeStyle = a === 0 ? HC : HD; ctx.lineWidth = a === 0 ? 1.4 : 1.1;
      ctx.setLineDash(a < 0 ? [5, 4] : []);
      const gx = (pb.x - pa.x) * .36, gy = (pb.y - pa.y) * .36;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pa.x + gx, pa.y + gy); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pb.x - gx, pb.y - gy); ctx.stroke();
      ctx.setLineDash([]);
      if (a !== 0) { ctx.fillStyle = HD; ctx.fillText(String(a), pa.x - (pb.x - pa.x) * .1, pa.y - (pb.y - pa.y) * .1 + 3); }
    }
    /* marca do nariz (W) */
    ctx.strokeStyle = HC; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(nx - 22, ny); ctx.lineTo(nx - 10, ny); ctx.lineTo(nx - 5, ny + 6); ctx.lineTo(nx, ny); ctx.lineTo(nx + 5, ny + 6); ctx.lineTo(nx + 10, ny); ctx.lineTo(nx + 22, ny); ctx.stroke();
    /* círculo do buscador e losango de bloqueio */
    const kind = P.wpn === 'sp' ? P.S.sp : 'msl';
    const fovR = Math.tan(cam.fov * DEG / 2), rpx = c => Math.tan(c) / fovR * h / 2;
    if (kind === 'bomb') {
      /* ponto de impacto previsto */
      let x = P.pos.x, y = P.pos.y, z = P.pos.z, vx = P.vel.x, vy = P.vel.y - 6, vz = P.vel.z; const hg = G.r3.hg;
      for (let i = 0; i < 300; i++) { vy -= G0 * .1; x += vx * .1; y += vy * .1; z += vz * .1; if (y < Math.max(0, hg.at(x, z))) break; }
      const ip = proj(V2.set(x, Math.max(0, hg.at(x, z)), z), {});
      if (ip.front) { ctx.strokeStyle = YEL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(nx, ny + 8); ctx.lineTo(ip.x, ip.y - 10); ctx.stroke(); ctx.beginPath(); ctx.arc(ip.x, ip.y, 10, 0, TAU); ctx.moveTo(ip.x - 16, ip.y); ctx.lineTo(ip.x + 16, ip.y); ctx.stroke(); ctx.fillStyle = YEL; ctx.fillText('IMPACTO', ip.x, ip.y + 22); }
    } else if (kind === 'mlaa') {
      ctx.strokeStyle = HD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(nx, ny, rpx(WPN.mlaa.cone), 0, TAU); ctx.stroke();
      P.mlocks.forEach((v, e) => { const p = proj(e.pos, {}); if (!p.front) return; const s = lerp(26, 11, v); ctx.strokeStyle = v >= 1 ? RED : HC; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath(); ctx.stroke(); });
    } else {
      const Wp = WPN[kind];
      ctx.strokeStyle = 'rgba(157,255,190,.32)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(nx, ny, rpx(Wp.cone), 0, TAU); ctx.stroke();
      if (P.lockCand) {
        const p = proj(P.lockCand.pos, {});
        if (p.front) {
          const lk = P.lock >= 1, s = lk ? 12 : lerp(28, 13, P.lock);
          ctx.strokeStyle = lk ? RED : HC; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath(); ctx.stroke();
          if (lk) { ctx.fillStyle = RED; ctx.font = `700 10px ${MONO}`; ctx.fillText('BLOQUEADO', p.x, p.y - s - 6); }
        }
      }
    }
  }
  function tapes(G, ctx, w, h, sm) {
    const P = G.P, cx = w / 2, cy = h / 2, off = Math.min(250, w * .3), bw = sm ? 58 : 66, bh = 24;
    const kmh = Math.round(P.speed * 3.6), alt = Math.round(P.pos.y);
    ctx.font = `700 ${sm ? 12 : 14}px ${MONO}`; ctx.textAlign = 'center';
    const box = (x, val, lab, unit, step, raw) => {
      ctx.strokeStyle = HC; ctx.lineWidth = 1.4;
      /* fita */
      ctx.save(); ctx.beginPath(); ctx.rect(x - bw / 2 - 14, cy - 90, bw + 28, 180); ctx.clip();
      const base = Math.floor(raw / step) * step;
      for (let i = -5; i <= 5; i++) {
        const v = base + i * step, y = cy - (v - raw) / step * 18;
        ctx.strokeStyle = HD; ctx.beginPath(); const sx = x < cx ? x + bw / 2 + 4 : x - bw / 2 - 4; ctx.moveTo(sx, y); ctx.lineTo(sx + (x < cx ? 8 : -8), y); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(5,20,12,.35)'; ctx.fillRect(x - bw / 2, cy - bh / 2, bw, bh); ctx.strokeStyle = HC; ctx.strokeRect(x - bw / 2, cy - bh / 2, bw, bh);
      ctx.fillStyle = HC; ctx.fillText(String(val), x, cy + 5);
      ctx.font = `600 9px ${MONO}`; ctx.fillStyle = HD; ctx.fillText(lab + ' ' + unit, x, cy - bh / 2 - 6); ctx.font = `700 ${sm ? 12 : 14}px ${MONO}`;
    };
    box(cx - off, kmh, 'VEL', 'km/h', 50, kmh);
    box(cx + off, alt, 'ALT', 'm', 100, alt);
    /* G, acelerador */
    ctx.font = `600 10px ${MONO}`; ctx.fillStyle = P.g > 7 ? YEL : HD; ctx.textAlign = 'center';
    ctx.fillText(`G ${P.g.toFixed(1)}`, cx - off, cy + bh / 2 + 16);
    const th = G.in.boost ? 1 : G.in.brake ? .15 : .55;
    ctx.fillStyle = HD; ctx.fillRect(cx - off - bw / 2 - 12, cy - 40, 4, 80); ctx.fillStyle = G.in.boost ? '#ffb36b' : HC; ctx.fillRect(cx - off - bw / 2 - 12, cy + 40 - 80 * th, 4, 80 * th);
    if (P.ab > .3) { ctx.fillStyle = '#ffb36b'; ctx.fillText('PÓS-COMB.', cx - off, cy + bh / 2 + 28); }
    else if (G.in.brake) { ctx.fillStyle = HC; ctx.fillText('TRAVÃO', cx - off, cy + bh / 2 + 28); }
    /* altura ao solo */
    const agl = P.pos.y - Math.max(0, G.r3.hg.at(P.pos.x, P.pos.z));
    if (agl < 600) { ctx.fillStyle = agl < 150 ? YEL : HD; ctx.fillText(`R ${Math.round(agl)}`, cx + off, cy + bh / 2 + 16); }
    /* rumo */
    const hdg = (Math.atan2(P.fwd.x, -P.fwd.z) / DEG + 360) % 360, ty = sm ? 62 : 70, tw = Math.min(300, w * .5);
    ctx.save(); ctx.beginPath(); ctx.rect(cx - tw / 2, ty - 16, tw, 30); ctx.clip();
    ctx.strokeStyle = HD; ctx.fillStyle = HD; ctx.lineWidth = 1.2; ctx.font = `600 10px ${MONO}`;
    for (let d = Math.floor((hdg - 40) / 5) * 5; d <= hdg + 40; d += 5) {
      const x = cx + (d - hdg) * tw / 80, dd = ((d % 360) + 360) % 360;
      ctx.beginPath(); ctx.moveTo(x, ty + 8); ctx.lineTo(x, ty + (dd % 10 === 0 ? 1 : 4)); ctx.stroke();
      if (dd % 30 === 0) { const L = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' }[dd] || String(dd / 10).padStart(2, '0'); ctx.fillText(L, x, ty - 4); }
    }
    ctx.restore();
    ctx.fillStyle = HC; ctx.beginPath(); ctx.moveTo(cx, ty + 10); ctx.lineTo(cx - 5, ty + 16); ctx.lineTo(cx + 5, ty + 16); ctx.closePath(); ctx.fill();
    ctx.font = `700 11px ${MONO}`; ctx.fillText(String(Math.round(hdg)).padStart(3, '0'), cx, ty + 28);
  }
  function radar(G, ctx, w, h, sm) {
    const P = G.P, R = G.touch ? 44 : sm ? 54 : 74, x0 = R + (sm ? 16 : 24), y0 = G.touch ? 64 + R : h - R - (sm ? 16 : 24), range = 7000;
    const hx = P.fwd.x, hz = P.fwd.z, hl = Math.hypot(hx, hz) || 1, fx = hx / hl, fz = hz / hl;
    const toR = (px, pz, out) => { const dx = px - P.pos.x, dz = pz - P.pos.z; out.x = (dx * -fz + dz * fx); out.y = -(dx * fx + dz * fz); out.d = Math.hypot(out.x, out.y); const s = R / range; out.x *= s; out.y *= s; if (out.d * s > R - 4) { const k = (R - 4) / (out.d * s); out.x *= k; out.y *= k; out.edge = 1; } else out.edge = 0; return out; };
    ctx.save();
    ctx.fillStyle = 'rgba(4,16,10,.55)'; ctx.beginPath(); ctx.arc(x0, y0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = HD; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0, y0, R, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x0, y0, R / 2, 0, TAU); ctx.globalAlpha = .4; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x0, y0, R, 0, TAU); ctx.clip();
    /* varrimento */
    const sw = (G.t * 1.6) % TAU; const g = ctx.createConicGradient ? ctx.createConicGradient(sw - .9, x0, y0) : null;
    if (g) { g.addColorStop(0, 'rgba(157,255,190,0)'); g.addColorStop(.14, 'rgba(157,255,190,.16)'); g.addColorStop(.145, 'rgba(157,255,190,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - R, y0 - R, R * 2, R * 2); }
    /* limites da área */
    ctx.strokeStyle = 'rgba(255,81,73,.5)'; ctx.setLineDash([3, 3]); ctx.beginPath();
    [[-11000, -11000], [11000, -11000], [11000, 11000], [-11000, 11000], [-11000, -11000]].forEach(([px, pz], i) => { const dx = px - P.pos.x, dz = pz - P.pos.z, s = R / range; const xx = x0 + (dx * -fz + dz * fx) * s, yy = y0 - (dx * fx + dz * fz) * s; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }); ctx.stroke(); ctx.setLineDash([]);
    const o = {};
    G.rings.forEach((r, i) => { if (i < G.ringI) return; toR(r.pos.x, r.pos.z, o); ctx.strokeStyle = i === G.ringI ? CY : 'rgba(111,232,255,.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x0 + o.x, y0 + o.y, i === G.ringI ? 4 : 2.5, 0, TAU); ctx.stroke(); });
    G.ents.forEach(e => {
      if (!e.alive || e.fort) return;
      toR(e.pos.x, e.pos.z, o);
      const x = x0 + o.x, y = y0 + o.y, col = e === P.target ? '#ffffff' : e.tgt ? YEL : e.k === 'fort' ? '#ff8aa0' : RED;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (e.k === 'fort') { ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke(); return; }
      if (e.T.air && !e.T.fixed) {
        const rx = e.fwd.x * -fz + e.fwd.z * fx, ry = -(e.fwd.x * fx + e.fwd.z * fz);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(rx, -ry)); ctx.beginPath(); ctx.moveTo(0, -4.5); ctx.lineTo(3.2, 3.5); ctx.lineTo(-3.2, 3.5); ctx.closePath(); ctx.fill(); ctx.restore();
      } else { ctx.fillRect(x - 2.5, y - 2.5, 5, 5); }
      if (e.tgt) { ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 5, 10, 10); }
    });
    G.msls.forEach(m => { if (m.own !== 'e') return; toR(m.pos.x, m.pos.z, o); ctx.fillStyle = Math.floor(G.t * 10) % 2 ? RED : '#ffffff'; ctx.beginPath(); ctx.arc(x0 + o.x, y0 + o.y, 2, 0, TAU); ctx.fill(); });
    ctx.restore();
    /* o jogador */
    ctx.fillStyle = HC; ctx.beginPath(); ctx.moveTo(x0, y0 - 6); ctx.lineTo(x0 + 4.5, y0 + 4); ctx.lineTo(x0, y0 + 2); ctx.lineTo(x0 - 4.5, y0 + 4); ctx.closePath(); ctx.fill();
    ctx.font = `600 9px ${MONO}`; ctx.fillStyle = HD; ctx.textAlign = 'left'; ctx.fillText('7 km', x0 + R * .72, y0 - R + 6);
    /* dano */
    const dmg = Math.round((1 - Math.max(0, P.hp) / P.hpMax) * 100), dc = dmg > 60 ? RED : dmg > 30 ? YEL : HC;
    ctx.font = `700 ${sm ? 11 : 12}px ${MONO}`; ctx.fillStyle = dc; ctx.textAlign = 'left';
    const dx = G.touch ? x0 - R : x0 + R + 12, dy = G.touch ? y0 + R + 30 : y0 + R - 4;
    ctx.fillText(`DANO ${dmg}%`, dx, dy);
    const bw = sm ? 70 : 90; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(dx, dy - 18, bw, 5); ctx.fillStyle = dc; ctx.fillRect(dx, dy - 18, bw * Math.max(0, P.hp) / P.hpMax, 5);
  }
  function weaponsPanel(G, ctx, w, h, sm) {
    const P = G.P, x = w - (sm ? 16 : 26), y = h - (sm ? 22 : 30), lh = sm ? 15 : 17;
    const touchOff = 0;
    if (G.touch) {
      /* uma linha ao centro, por baixo de tudo */
      const sp = SPECIAL[P.S.sp];
      ctx.font = `700 11px ${MONO}`; ctx.textAlign = 'center';
      const txt = `${P.wpn === 'msl' ? '▶' : ' '}MSL ${P.msl}   ${P.wpn === 'sp' ? '▶' : ' '}${sp.short} ${P.sp}   GUN ${P.over > 0 ? 'QUENTE' : '∞'}`;
      const narrow = w < 560, tw = ctx.measureText(txt).width + 18, bx = narrow ? w - 12 - tw : w / 2 - tw / 2, by = narrow ? 126 : h - 30;
      ctx.fillStyle = 'rgba(4,16,10,.5)'; U.rr(ctx, bx, by, tw, 20, 8); ctx.fill();
      ctx.fillStyle = P.over > 0 ? YEL : HC; ctx.fillText(txt, bx + tw / 2, by + 14);
    } else {
    ctx.font = `700 ${sm ? 11 : 13}px ${MONO}`; ctx.textAlign = 'right';
    const sp = SPECIAL[P.S.sp];
    const rows = [
      ['GUN', P.over > 0 ? 'QUENTE' : '∞', 'gun'],
      ['MSL', String(P.msl), 'msl'],
      [sp.short, String(P.sp), 'sp'],
    ];
    rows.forEach(([a, b, id], i) => {
      const yy = y - (rows.length - 1 - i) * lh - touchOff, on = (id === 'msl' && P.wpn === 'msl') || (id === 'sp' && P.wpn === 'sp');
      ctx.fillStyle = on ? HC : HD;
      ctx.fillText(`${on ? '▶ ' : ''}${a}  ${b}`, x, yy);
    });
    /* calor da metralhadora e carris */
    const gy = y - 2 * lh - touchOff - 12;
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x - 60, gy, 60, 3); ctx.fillStyle = P.over > 0 ? RED : P.heat > .7 ? YEL : HC; ctx.fillRect(x - 60, gy, 60 * Math.min(1, P.heat), 3);
    for (let i = 0; i < 2; i++) { const r = P.rails[i], cx = x - 8 - i * 14, cy = y - lh - touchOff + 8; ctx.fillStyle = r <= 0 && P.msl > i ? HC : 'rgba(157,255,190,.2)'; ctx.fillRect(cx - 4, cy, 8, 3); if (r > 0) { ctx.fillStyle = HD; ctx.fillRect(cx - 4, cy, 8 * (1 - r / WPN.msl.reload), 3); } }
    if (P.wpn === 'sp' && P.spCd > 0) { ctx.fillStyle = HD; ctx.fillText(`a recarregar ${P.spCd.toFixed(1)}s`, x, y + (sm ? 12 : 14) - touchOff); }
    }
    /* pontos e tempo */
    ctx.textAlign = 'right'; ctx.font = `700 ${sm ? 11 : 12}px ${MONO}`; ctx.fillStyle = HC;
    const M = G.M, ty = sm ? 92 : 100;
    if (M.kind === 'mission') { const left = M.time - G.time; ctx.fillStyle = left < 60 ? (Math.floor(G.t * 2) % 2 ? RED : YEL) : HC; ctx.fillText(`TEMPO ${fmtT(left)}`, x, ty); }
    else if (M.kind === 'arena') ctx.fillText(`VAGA ${G.wave}`, x, ty);
    ctx.fillStyle = HC; ctx.fillText(`PONTOS ${G.score}`, x, ty + 16);
    /* lista de abates */
    ctx.font = `600 ${sm ? 9 : 10}px ${MONO}`;
    G.feed.forEach((f, i) => { ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = HC; ctx.fillText(`${f.t}  ${f.p}`, x, ty + 36 + i * 13); });
    ctx.globalAlpha = 1;
  }
  function warnings(G, ctx, w, h, proj, sm) {
    const P = G.P, cx = w / 2, blink = Math.floor(G.t * 6) % 2 === 0;
    ctx.textAlign = 'center';
    let y = h * .3;
    const big = (t, col, sub) => {
      ctx.font = `800 ${sm ? 16 : 20}px ${MONO}`; const tw = ctx.measureText(t).width + 26;
      ctx.fillStyle = col === RED ? 'rgba(80,0,0,.4)' : 'rgba(60,40,0,.35)'; ctx.fillRect(cx - tw / 2, y - 20, tw, 28);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.strokeRect(cx - tw / 2, y - 20, tw, 28);
      ctx.fillStyle = col; ctx.fillText(t, cx, y + 1);
      if (sub) { ctx.font = `600 10px ${MONO}`; ctx.fillText(sub, cx, y + 20); }
      y += sub ? 46 : 38;
    };
    if (G.warn.msl > 0 && (blink || G.warn.msl > .8)) big('MÍSSIL', RED, 'CURVA · FLARES (B)');
    else if (G.warn.lock > 0 && blink) big('AVISO · BLOQUEIO', YEL);
    if (G.warn.pull && !P.gcas) big('SOBE!', RED);
    if (P.gcas) big('AUTO-GCAS', YEL);
    if (P.stall > .2) big('PERDA DE SUSTENTAÇÃO', YEL, 'ACELERA · BAIXA O NARIZ');
    if (G.outT > 0) big(G.outT > 8 ? 'A REGRESSAR À ÁREA' : 'A SAIR DA ÁREA DE MISSÃO', YEL, G.outT <= 8 ? `regresso automático em ${Math.ceil(8 - G.outT)} s` : null);
    if (G.M.ceiling && G.detect > 0) {
      const bw = 180, bx = cx - bw / 2, by = sm ? 96 : 104;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(bx, by, bw, 8); ctx.fillStyle = G.detect > .7 ? RED : YEL; ctx.fillRect(bx, by, bw * G.detect, 8);
      ctx.strokeStyle = HD; ctx.strokeRect(bx, by, bw, 8);
      ctx.font = `700 10px ${MONO}`; ctx.fillStyle = G.detect > .7 ? RED : YEL; ctx.fillText(P.pos.y > G.M.ceiling ? 'RADAR: DESCE ABAIXO DE ' + G.M.ceiling + ' m!' : 'RADAR', cx, by - 5);
    }
    void proj;
  }
  function messages(G, ctx, w, h, sm) {
    const cx = w / 2, M = G.M;
    /* objetivo */
    if (M.kind === 'mission' && M.phases[G.phase] && !G.won) {
      const ph = M.phases[G.phase], mine = G.ents.filter(e => e.ph === G.phase && (ph.goal === 'tgt' ? e.tgt : !e.T.noTarget));
      let cnt = '';
      if (ph.goal === 'tgt' || ph.goal === 'all') cnt = ` (${mine.filter(e => !e.alive).length}/${mine.length})`;
      else if (ph.rings) cnt = ` (${G.ringI}/${G.rings.length})`;
      else if (ph.goal === 'climb') cnt = ` (${Math.round(G.P.pos.y)}/${ph.climb} m)`;
      ctx.font = `700 ${sm ? 11 : 12}px 'Space Grotesk', system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = YEL;
      if (G.touch && w < 560) { ctx.textAlign = 'left'; wrap(ctx, '▸ ' + ph.obj + cnt, w - 140).slice(0, 2).forEach((l, i) => ctx.fillText(l, 124, 160 + i * 15)); }
      else if (G.touch) { ctx.textAlign = 'center'; ctx.fillText('▸ ' + ph.obj + cnt, w / 2, sm ? 96 : 104); }
      else ctx.fillText('▸ ' + ph.obj + cnt, sm ? 12 : 22, sm ? 92 : 100);
    } else if (M.kind === 'free' && G.rings.length) {
      ctx.font = `700 12px 'Space Grotesk', system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = CY; ctx.fillText(`▸ Anéis ${G.ringI}/${G.rings.length}`, sm ? 12 : 22, sm ? 92 : 100);
    }
    /* mensagem central */
    const s = G.say;
    if (s) {
      const a = Math.min(1, s.life * 2.5);
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      if (s.kill) { ctx.font = `800 ${sm ? 15 : 18}px ${MONO}`; ctx.fillStyle = HC; ctx.fillText(s.t, cx, h * .42); }
      else if (s.small) { ctx.font = `700 12px ${MONO}`; ctx.fillStyle = s.c; ctx.fillText(s.t, cx, h * .66); }
      else {
        const y = G.touch && w < 560 ? h * .44 : Math.max(s.big ? h * .36 : h * .24, 134);
        ctx.font = `800 ${s.big ? (sm ? 26 : 38) : (sm ? 17 : 22)}px 'Space Grotesk', system-ui`; ctx.fillStyle = s.c;
        ctx.fillText(s.t, cx, y);
        if (s.s) { ctx.font = `600 ${sm ? 12 : 14}px 'Space Grotesk', system-ui`; ctx.fillStyle = '#ffffff'; ctx.fillText(s.s, cx, y + (s.big ? 30 : 24)); }
      }
      ctx.globalAlpha = 1;
    }
    /* rádio */
    const r = G.radio[0];
    if (r) {
      const a = Math.min(1, r.t * 4, (r.life - r.t) * 3), mw = G.touch ? Math.min(560, w * .55) : Math.min(560, w - 30);
      const shown = r.txt.slice(0, Math.floor(r.t * 55));
      ctx.font = `600 ${sm ? 12 : 13}px 'Space Grotesk', system-ui`;
      const lines = wrap(ctx, shown, (G.touch ? Math.min(mw, w * .55) : mw) - 28), lh = sm ? 16 : 18, bh = 26 + lines.length * lh;
      const y = G.touch ? (w < 560 ? 196 : sm ? 112 : 120) : h - (sm ? 150 : 128) - bh;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(6,12,20,.68)'; U.rr(ctx, cx - mw / 2, y, mw, bh, 10); ctx.fill();
      ctx.fillStyle = r.who.startsWith('ÍRIS') ? '#ffb3c7' : CY; ctx.font = `800 10px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('◉ ' + r.who, cx - mw / 2 + 14, y + 16);
      ctx.fillStyle = '#eef6ff'; ctx.font = `600 ${sm ? 12 : 13}px 'Space Grotesk', system-ui`;
      lines.forEach((l, i) => ctx.fillText(l, cx - mw / 2 + 14, y + 34 + i * lh));
      ctx.globalAlpha = 1;
    }
  }
  function wrap(ctx, t, mw) { const out = []; let cur = ''; t.split(' ').forEach(wd => { const n = cur ? cur + ' ' + wd : wd; if (ctx.measureText(n).width > mw && cur) { out.push(cur); cur = wd; } else cur = n; }); if (cur) out.push(cur); return out; }
  function touchUI(G, ctx, w, h, api) {
    ctx.save(); ctx.shadowBlur = 0;
    const s = G.tp.stick;
    if (s) {
      ctx.globalAlpha = .3; ctx.fillStyle = '#04110a'; ctx.beginPath(); ctx.arc(s.ox, s.oy, 62, 0, TAU); ctx.fill();
      ctx.globalAlpha = .8; ctx.strokeStyle = HC; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = HC; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(s.ox + s.vx * 52, s.oy + s.vy * 52, 22, 0, TAU); ctx.fill();
    } else if (w >= 560) { ctx.globalAlpha = .5; ctx.fillStyle = '#fff'; ctx.font = "600 12px 'Space Grotesk', system-ui"; ctx.textAlign = 'left'; ctx.fillText('arrasta aqui para pilotar', 96, h - 44); }
    touchBtns(G, api).forEach(b => {
      const on = G.tp[b.id] || G.tp['tap_' + b.id] > 0;
      ctx.globalAlpha = on ? .62 : .34; ctx.fillStyle = '#04110a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = .9; ctx.strokeStyle = b.id === 'fire' && G.P.lock >= 1 ? RED : HC; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = `800 ${Math.round(b.r * .42)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.id === 'wpn' ? (G.P.wpn === 'sp' ? 'MSL' : SPECIAL[G.P.S.sp].short) : b.ic, b.x, b.y + 1);
      ctx.textBaseline = 'alphabetic';
    });
    Object.keys(G.tp).forEach(k => { if (k.startsWith('tap_')) G.tp[k] -= .016; });
    ctx.restore();
  }

  /* ════════════════════════════════════════════════════════════════
     som: motor contínuo (Web Audio próprio) + efeitos do kit
  ════════════════════════════════════════════════════════════════ */
  function audioInit(G) {
    G.au = null;
  }
  function audioMake(G) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < n; i++) { const wv = Math.random() * 2 - 1; last = (last + .02 * wv) / 1.02; d[i] = last * 3.5; }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const eg = ac.createGain(); eg.gain.value = 0;
      const wsrc = ac.createBufferSource(); wsrc.buffer = buf; wsrc.loop = true; wsrc.playbackRate.value = 1.7;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .6;
      const wg = ac.createGain(); wg.gain.value = 0;
      const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70; const og = ac.createGain(); og.gain.value = 0; const olp = ac.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 260;
      const master = ac.createGain(); master.gain.value = .0001;
      src.connect(lp); lp.connect(eg); eg.connect(master); wsrc.connect(bp); bp.connect(wg); wg.connect(master); osc.connect(olp); olp.connect(og); og.connect(master); master.connect(ac.destination);
      src.start(); wsrc.start(); osc.start();
      G.au = { ac, lp, eg, wg, bp, osc, og, master };
    } catch (e) { G.au = false; }
  }
  function audioUpdate(G, api) {
    const on = ArcadeKit.soundOn() && api.state === 'play' && !G.P.dead && !document.hidden;
    if (on && G.au == null) audioMake(G);
    const A = G.au; if (!A) return;
    const t = A.ac.currentTime, P = G.P;
    if (A.ac.state === 'suspended' && on) A.ac.resume();
    A.master.gain.setTargetAtTime(on ? .5 : 0, t, .15);
    if (!on) return;
    const thr = G.in.boost ? 1 : G.in.brake ? .25 : .55, sp = P.speed / P.S.max;
    A.lp.frequency.setTargetAtTime(250 + thr * 900 + P.ab * 600, t, .2);
    A.eg.gain.setTargetAtTime(.1 + thr * .16 + P.ab * .12, t, .2);
    A.osc.frequency.setTargetAtTime(55 + thr * 50 + P.ab * 25, t, .3); A.og.gain.setTargetAtTime(.025 + P.ab * .02, t, .3);
    A.wg.gain.setTargetAtTime(.02 + sp * .09 + Math.max(0, P.g - 4) * .015, t, .2); A.bp.frequency.setTargetAtTime(600 + sp * 900, t, .3);
  }
  function audioStop(G) { if (G.au) { try { G.au.ac.close(); } catch (e) {} G.au = null; } }
  function sfx(api, k, v) {
    const s = api.sfx; v = v == null ? 1 : v;
    if (k === 'gun') s.noise(.05, .045, 0, 2400, 'bandpass');
    else if (k === 'launch') { s.noise(.7, .07, 0, 700, 'lowpass'); s.tone(240, .5, 'sawtooth', .025, 0, 90); }
    else if (k === 'launch2') s.noise(.6, .05, .08, 900, 'lowpass');
    else if (k === 'bomb') s.tone(500, .35, 'sine', .04, 0, 160);
    else if (k === 'lockbeep') s.tone(1050, .045, 'square', .018);
    else if (k === 'lockon') s.tone(1500, .06, 'square', .016);
    else if (k === 'locked') s.tone(1500, .12, 'square', .03);
    else if (k === 'mslwarn') s.tone(1750, .06, 'square', .035);
    else if (k === 'lockwarn') s.tone(880, .12, 'triangle', .03);
    else if (k === 'boom') { s.noise(.9, .14 * v, 0, 320, 'lowpass'); s.tone(85, .5, 'sine', .08 * v, 0, 35); }
    else if (k === 'flak') s.noise(.25, .07 * v, 0, 600, 'lowpass');
    else if (k === 'hitme') { s.noise(.3, .12, 0, 900); s.tone(140, .3, 'sawtooth', .05, 0, 60); }
    else if (k === 'kill') s.arp([880, 1320], .06, .1, 'triangle', .05);
    else if (k === 'ring') s.arp([988, 1319, 1760], .05, .12, 'triangle', .05);
    else if (k === 'flare') s.noise(.4, .05, 0, 2000, 'highpass');
    else if (k === 'switch') s.tone(700, .05, 'square', .025);
    else if (k === 'radio') { s.tone(2300, .03, 'square', .015); s.noise(.08, .02, .03, 3000, 'bandpass'); }
    else if (k === 'obj') s.arp([660, 880, 1100], .08, .14, 'triangle', .05);
    else if (k === 'win') s.arp([523, 659, 784, 1047, 1319], .12, .3, 'triangle', .07);
    else if (k === 'fail') s.arp([440, 349, 262], .16, .3, 'triangle', .06);
  }

  /* ════════════════════════════════════════════════════════════════
     menu: hangar, campanha, arena, voo livre
  ════════════════════════════════════════════════════════════════ */
  function planeSVG(type) {
    const J = W().JETS[type], s = 7, pts = [];
    const fus = J.fus, wing = J.wing, tail = J.stab || J.canard;
    const P = (x, z) => `${(60 + x * s).toFixed(1)},${(64 - z * s).toFixed(1)}`;
    const side = (arr, sg) => arr.map(([x, z]) => P(sg * x, z)).join(' ');
    const body = fus.map(([r, z]) => P(r * J.sx, z)).concat(fus.slice().reverse().map(([r, z]) => P(-r * J.sx, z))).join(' ');
    pts.push(`<polygon points="${side(wing, 1)}"/><polygon points="${side(wing, -1)}"/>`);
    if (J.stab) pts.push(`<polygon points="${side(J.stab, 1)}"/><polygon points="${side(J.stab, -1)}"/>`);
    if (J.canard) pts.push(`<polygon points="${side(J.canard, 1)}"/><polygon points="${side(J.canard, -1)}"/>`);
    pts.push(`<polygon points="${body}"/>`);
    void tail;
    return `<svg viewBox="0 0 120 128" aria-hidden="true"><g fill="currentColor">${pts.join('')}</g><ellipse cx="60" cy="${(64 - J.canopy[2] * s).toFixed(1)}" rx="${(J.canopy[3] * s).toFixed(1)}" ry="${(J.canopy[5] * s * .8).toFixed(1)}" fill="#0b1220" opacity=".75"/></svg>`;
  }
  const picker = {
    html() {
      const sv = save(), diff = (typeof GameHost !== 'undefined' && GameHost.diffGet) ? GameHost.diffGet(ID, 'medium') : 'medium';
      const maps = W().MAPS, skies = W().SKIES;
      const bestArena = (typeof GameProgress !== 'undefined') ? GameProgress.bestScore(ID, 'arena-' + diff) : null;
      const MC = { coast: ['#f6c47c', '#3f86c4'], alps: ['#e8f1ff', '#2c6fb8'], isles: ['#ff9a5a', '#26336c'], ocean: ['#b5bec6', '#4a5a6c'], canyon: ['#f1cfa3', '#b4562f'], arctic: ['#3bd18a', '#030616'] };
      return `<style>
.sa{display:grid;gap:18px;margin:2px 0 4px}
.sa h4{margin:0 0 8px;font:800 .78rem 'Space Grotesk',system-ui;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
.sa-planes{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.sa-pl{position:relative;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px 12px 96px;min-height:112px;background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.015));color:inherit;text-align:left;cursor:pointer;font:inherit;transition:border-color .15s,transform .15s,background .15s}
.sa-pl:hover{transform:translateY(-2px)}
.sa-pl[aria-pressed="true"]{border-color:var(--ak);background:linear-gradient(160deg,color-mix(in srgb,var(--ak) 22%,transparent),rgba(255,255,255,.02));box-shadow:0 0 0 1px var(--ak) inset}
.sa-pl svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:82px;height:88px;color:#c7d2de}
.sa-pl[aria-pressed="true"] svg{color:#fff}
.sa-pl b{display:block;font:800 1rem 'Space Grotesk',system-ui}.sa-pl em{font-style:normal;font-size:.72rem;opacity:.65;letter-spacing:.06em;text-transform:uppercase}
.sa-pl p{margin:4px 0 6px;font-size:.78rem;line-height:1.3;opacity:.82}
.sa-st{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:.66rem;opacity:.85;align-items:center}
.sa-st i{display:flex;gap:2px}.sa-st i span{width:12px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)}.sa-st i span.on{background:var(--ak)}
.sa-ms{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.sa-m{position:relative;border:0;border-radius:16px;padding:14px 14px 12px;min-height:118px;color:#fff;text-align:left;cursor:pointer;font:inherit;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s}
.sa-m:hover:not([disabled]){transform:translateY(-3px)}
.sa-m[disabled]{opacity:.45;cursor:not-allowed}
.sa-m::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.55));pointer-events:none}
.sa-m>*{position:relative;z-index:1}
.sa-m small{display:block;font:700 .66rem 'Space Grotesk',system-ui;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.sa-m b{display:block;font:800 1.06rem 'Space Grotesk',system-ui;margin:2px 0 4px;text-shadow:0 2px 8px rgba(0,0,0,.4)}
.sa-m p{margin:0;font-size:.76rem;line-height:1.3;opacity:.92;max-width:92%}
.sa-m .rk{position:absolute;right:10px;top:10px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font:900 1rem 'Space Grotesk',system-ui;background:rgba(0,0,0,.35);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.sa-m .rk.S{background:linear-gradient(135deg,#fde047,#f59e0b);color:#3b2600}.sa-m .rk.A{background:linear-gradient(135deg,#86efac,#22c55e);color:#052e16}.sa-m .rk.B{background:linear-gradient(135deg,#93c5fd,#3b82f6);color:#0b1f4a}
.sa-x{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.sa-card{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px;background:rgba(255,255,255,.03)}
.sa-card b{font:800 .98rem 'Space Grotesk',system-ui}.sa-card p{margin:3px 0 10px;font-size:.78rem;opacity:.8}
.sa-chips{display:flex;flex-wrap:wrap;gap:6px}
.sa-chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;border-radius:999px;padding:6px 11px;font:700 .76rem 'Space Grotesk',system-ui;cursor:pointer}
.sa-chip:hover{border-color:var(--ak)}.sa-chip.on{background:var(--ak);border-color:var(--ak);color:#04121f}
.sa-go{border:0;border-radius:12px;padding:10px 16px;font:800 .88rem 'Space Grotesk',system-ui;background:var(--ak);color:#04121f;cursor:pointer}
.sa-opt{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center;font-size:.8rem}
.sa-opt>div{display:flex;gap:8px;align-items:center}
</style><div class="sa">
  <section><h4>Hangar</h4><div class="sa-planes">${Object.keys(PLANES).map(k => { const p = PLANES[k]; return `<button class="sa-pl" data-pl="${k}" aria-pressed="${sv.plane === k}">${planeSVG(k)}<em>${p.role}</em><b>${p.name}</b><p>${p.desc}</p><div class="sa-st">${['Velocidade', 'Manobra', 'Blindagem', 'Armas'].map((l, i) => `<span>${l}</span><i>${[1, 2, 3, 4, 5].map(n => `<span class="${n <= p.stat[i] ? 'on' : ''}"></span>`).join('')}</i>`).join('')}</div></button>`; }).join('')}</div></section>
  <section><h4>Campanha</h4><div class="sa-ms">${MISSIONS.map((m, i) => { const lock = i + 1 > (sv.u || 1), r = (sv.r[m.id + ':' + diff] || {}).rank, c = MC[m.map];
        return `<button class="sa-m" data-m="${m.id}" ${lock ? 'disabled' : ''} style="background:linear-gradient(150deg,${c[0]},${c[1]})"><small>Missão ${i + 1} · ${maps[m.map].name} · ${skies[m.sky].name}</small><b>${lock ? '🔒 ' : ''}${m.name}</b><p>${m.brief}</p>${r ? `<span class="rk ${r}">${r}</span>` : ''}</button>`; }).join('')}</div></section>
  <section class="sa-x">
    <div class="sa-card"><b>Arena</b><p>Vagas de drones sem fim, num mapa ao acaso. Entre vagas recebes reparações e munições.${bestArena != null ? ` Recorde: <b>${bestArena}</b>.` : ''}</p><button class="sa-go" data-m="arena">▶ Entrar na arena</button></div>
    <div class="sa-card"><b>Voo livre</b><p>Sem inimigos: explora os seis mapas e faz o percurso de anéis.</p><div class="sa-chips">${Object.keys(maps).map(k => `<button class="sa-chip" data-m="free-${k}">${maps[k].name}</button>`).join('')}</div></div>
  </section>
  <section><h4>Opções de voo</h4><div class="sa-opt">
    <div>Pilotagem <span class="sa-chips"><button class="sa-chip ${sv.ctrl === 'std' ? 'on' : ''}" data-ctrl="std" title="Inclina e curva sozinho; nivela ao largar">Normal</button><button class="sa-chip ${sv.ctrl === 'exp' ? 'on' : ''}" data-ctrl="exp" title="A/D rodam o avião; W/S puxam o nariz">Especialista</button></span></div>
    <div>Subir o nariz <span class="sa-chips"><button class="sa-chip ${(PITCH || sv.pitch || 'sim') === 'arcade' ? 'on' : ''}" data-pitch="arcade" title="↑ ou W sobe, ↓ ou S desce">Arcada (↑ / W)</button><button class="sa-chip ${(PITCH || sv.pitch || 'sim') === 'sim' ? 'on' : ''}" data-pitch="sim" title="Como num avião: ↓ ou S puxa o manche e sobe">Avião (↓ / S)</button></span></div>
    <div>Gráficos <span class="sa-chips">${[['auto', 'Auto'], ['high', 'Alta'], ['low', 'Leve']].map(([k, l]) => `<button class="sa-chip ${sv.q === k ? 'on' : ''}" data-q="${k}">${l}</button>`).join('')}</span></div>
  </div></section>
</div>`;
    },
    wire(el, start) {
      const setOn = (sel, attr, val) => el.querySelectorAll(sel).forEach(b => b.classList.toggle('on', b.dataset[attr] === val));
      el.querySelectorAll('[data-pl]').forEach(b => b.addEventListener('click', () => { const sv = save(); sv.plane = b.dataset.pl; putSave(sv); el.querySelectorAll('[data-pl]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
      el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => start(b.dataset.m)));
      el.querySelectorAll('[data-ctrl]').forEach(b => b.addEventListener('click', () => { const sv = save(); sv.ctrl = b.dataset.ctrl; putSave(sv); setOn('[data-ctrl]', 'ctrl', sv.ctrl); }));
      el.querySelectorAll('[data-pitch]').forEach(b => b.addEventListener('click', () => { const sv = save(); sv.pitch = PITCH = b.dataset.pitch; putSave(sv); setOn('[data-pitch]', 'pitch', sv.pitch); }));
      el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { const sv = save(); sv.q = b.dataset.q; putSave(sv); setOn('[data-q]', 'q', sv.q); }));
    },
  };

  let curMode = 'm1';
  const spec = {
    id: ID, title: 'Ás dos Céus', icon: '🛩️', accent: '#5cc8ff', accent2: '#9dffbe', bg: '#0b1830', aspect: 'wide', transparent: true,
    tagline: 'Combate aéreo em 3D: 6 missões, 3 caças, mísseis com bloqueio e drones que não perdoam.',
    view: { w: 960 }, picker,
    get ready() {
      const M = parseMode(curMode);
      if (M.kind === 'arena') return { title: 'Arena', hint: 'Vagas de drones sem fim. Toca ou carrega em Espaço para descolar.' };
      if (M.kind === 'free') return { title: 'Voo livre · ' + W().MAPS[M.map].name, hint: 'Sem inimigos. Toca ou carrega em Espaço para descolar.' };
      return { title: `Missão ${MISSIONS.indexOf(MISSIONS.find(m => m.id === M.id)) + 1} · ${M.name}`, hint: M.brief + ' Toca ou carrega em Espaço para descolar.' };
    },
    how: [
      '<b>↑ / W</b> desce o nariz e <b>↓ / S</b> sobe, como num avião (há a opção "Arcada", ao contrário), <b>← → / A D</b> fazem a curva (em Especialista rodam o avião), <b>Q / E</b> leme. <b>Shift</b> pós-combustão, <b>Z</b> travão — travar aperta a curva. A lista de comandos fica à esquerda durante o voo (<b>H</b> esconde).',
      'Põe o alvo no círculo até o losango ficar <b>vermelho</b> (bloqueado) e dispara o <b>míssil</b> com <b>Espaço</b> (ou botão direito). <b>F</b> / clique: metralhadora — aponta à mira de avanço. <b>X</b> troca para a arma especial, <b>R</b> troca de alvo.',
      'Alarme de míssil? <b>Curva com força</b> no último instante e larga <b>flares</b> (B). <b>C</b> muda a câmara (cabine), mantém <b>T</b> para olhar o alvo. Também dá com comando (gamepad) e no telemóvel.',
    ],
    controls: ['⌨️ setas / WASD · Q E · Shift Z', '🚀 Espaço · F · X · R · B', '⌨️ H mostra os comandos', '🎮 comando', '👆 alavanca + botões'],
    setup: (api, o) => { curMode = o.mode || 'm1'; return setup(api, o); },
    update, draw, idle, after, down, move, up, key, keyup,
    begin: (G) => { if (matchMedia('(pointer: coarse)').matches) G.touch = true; },
    destroy: G => { audioStop(G); if (G.r3) { G.r3.renderer.toneMappingExposure = 1.08; G.r3.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.userData.shared) return; ['map', 'normalMap'].forEach(k => m[k] && m[k].dispose()); if (m.uniforms && m.uniforms.map && m.uniforms.map.value) m.uniforms.map.value.dispose(); }); }); Arcade3D.disposeOwn(G.r3.scene); G.r3.env && G.r3.env.dispose(); Arcade3D.detach(); G.r3 = null; } },
    hud: G => {
      const M = G.M;
      if (M.kind === 'arena') return [['Vaga', G.wave], ['Pontos', G.score], ['Abates', G.kills]];
      if (M.kind === 'free') return [['Mapa', W().MAPS[M.map].name], ['Anéis', G.ringI + '/' + G.rings.length]];
      const left = G.ents.filter(e => e.alive && e.tgt).length;
      return [['Missão', (MISSIONS.indexOf(MISSIONS.find(m => m.id === M.id)) + 1) + '/' + MISSIONS.length], ['Pontos', G.score], ['Alvos TGT', left]];
    },
    pauseButtons: (G, api) => [
      { label: G.inv ? 'Eixo: Arcada (↑ sobe) — trocar' : 'Eixo: Avião (↑ desce) — trocar', fn: () => { G.inv = !G.inv; PITCH = G.inv ? 'arcade' : 'sim'; const sv = save(); sv.pitch = PITCH; putSave(sv); api.resume(); } },
      { label: 'Ecrã inteiro', fn: () => { toggleFull(api); api.resume(); } },
    ],
    achievements: [
      { id: 'ace.1', name: 'Asas de Aurora', icon: '🛩️', desc: 'Cumpre a primeira missão do Ás dos Céus.', test: c => ((c.result.meta || {}).mission || 0) >= 1 },
      { id: 'ace.all', name: 'Ás dos Céus', icon: '👑', desc: 'Derruba a Fortaleza Celeste e cumpre as 6 missões.', test: c => !!(c.result.meta || {}).all },
      { id: 'ace.s', name: 'Classificação S', icon: '🏅', desc: 'Termina uma missão com classificação S.', test: c => (c.result.meta || {}).rank === 'S' },
      { id: 'ace.arena', name: 'Sobrevivente', icon: '🔥', desc: 'Chega à vaga 10 na Arena.', test: c => ((c.result.meta || {}).wave || 0) >= 10 },
    ],
  };
  const KIT = ArcadeKit.create(spec);
  /* ganchos de teste (harness headless) */
  KIT._dbg = { MISSIONS, PLANES, ET, WPN, parse: parseMode };
  KIT._dbgAdd = (G, k, x, y, z, hdg) => addEnt(G, k, x, y, z, { hdg });
  KIT._dbgLaunch = (G, pos, dir, speed, tgt) => launch(G, 'e', pos, dir, speed, tgt, { turn: 1.3 * G.D.eMsl, max: 520, life: 12, fuse: 13, dmg: 30 });
  return KIT;
})();
