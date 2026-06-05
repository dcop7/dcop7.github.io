/* ══════════════════════════════════════════════════════════════════
   SOLAR EXPLORER — Three.js 3D Solar System
══════════════════════════════════════════════════════════════════ */
const SolarExplorer = (function () {
  'use strict';

  const THREE_CDN  = 'https://unpkg.com/three@0.160.0/build/three.min.js';
  /* Local planet textures — Solar System Scope (CC BY 4.0). Replaces the old
     unpkg path which 404'd (planets showed only a flat colour). */
  const TEX_BASE   = 'assets/planets/';
  const RING_TEX   = 'assets/planets/saturn-ring.png';
  const SUN_TEX    = 'assets/planets/sun.jpg';
  /* (Removed external space background texture — unverifiable licence.
     The scene uses a solid colour + a locally-generated starfield instead.) */

  /* ── Planet data ── */
  const PLANETS = [
    {
      id: 'mercury', name: 'Mercúrio', color: '#b5b5b5', textureFile: 'mercury_1024.jpg', rocky: true,
      displayR: 2.2, orbitR: 30, period: 88,
      info: { dist: '0.39 UA', radius: '2 439 km', mass: '3.30 × 10²³ kg', period: '88 dias', day: '176 dias T.', temp: '−170 / +430°C', moons: '0', gravity: '3.7 m/s²', atmos: 'Ínfima (Na, O₂, H₂)' },
      moonList: [],
      facts: [
        'O planeta mais pequeno do Sistema Solar desde a reclassificação de Plutão em 2006.',
        'Variação de temperatura de 600°C — a maior do Sistema Solar.',
        'Um ano em Mercúrio (88 dias) é mais curto do que um dia (176 dias terrestres).',
        'A sua superfície é coberta de crateras de impacto, semelhante à Lua.',
      ],
      compare: { size: 0.38, gravity: 0.38, distance: 0.39, period: 0.24 },
    },
    {
      id: 'venus', name: 'Vénus', color: '#e8cda0', textureFile: 'venus_2048.jpg',
      displayR: 3.8, orbitR: 45, period: 225,
      info: { dist: '0.72 UA', radius: '6 051 km', mass: '4.87 × 10²⁴ kg', period: '225 dias', day: '243 dias T.', temp: '+465°C', moons: '0', gravity: '8.9 m/s²', atmos: 'Densa (CO₂ 96%, N₂)' },
      moonList: [],
      facts: [
        'O planeta mais quente, apesar de Mercúrio estar mais perto do Sol.',
        'Roda ao contrário — o Sol nasce a oeste e põe-se a este.',
        'Um dia venusiano (243 dias) é mais longo do que um ano (225 dias).',
        'A pressão atmosférica na superfície é 90× maior do que na Terra.',
      ],
      compare: { size: 0.95, gravity: 0.91, distance: 0.72, period: 0.62 },
    },
    {
      id: 'earth', name: 'Terra', color: '#4b9cd3', textureFile: 'earth_atmos_2048.jpg',
      displayR: 4, orbitR: 60, period: 365,
      info: { dist: '1.00 UA', radius: '6 371 km', mass: '5.97 × 10²⁴ kg', period: '365 dias', day: '23 h 56 min', temp: '−89 / +56°C', moons: '1', gravity: '9.8 m/s²', atmos: 'N₂ 78%, O₂ 21%' },
      moonList: [
        { name: 'Lua', dist: '384 400 km', period: '27.3 dias', r: '1 737 km' },
      ],
      facts: [
        'O único planeta conhecido com vida e com água líquida estável na superfície.',
        '71% da superfície está coberta por oceanos.',
        'O campo magnético terrestre desvia partículas solares prejudiciais.',
        'A Lua estabiliza o eixo de rotação da Terra, tornando o clima previsível.',
      ],
      compare: { size: 1, gravity: 1, distance: 1, period: 1 },
    },
    {
      id: 'mars', name: 'Marte', color: '#c1440e', textureFile: 'mars_1024.jpg', rocky: true,
      displayR: 2.8, orbitR: 80, period: 687,
      info: { dist: '1.52 UA', radius: '3 389 km', mass: '6.39 × 10²³ kg', period: '687 dias', day: '24 h 37 min', temp: '−125 / +20°C', moons: '2', gravity: '3.7 m/s²', atmos: 'Fina (CO₂ 95%)' },
      moonList: [
        { name: 'Fobos', dist: '9 376 km', period: '7.7 horas', r: '11 km' },
        { name: 'Deimos', dist: '23 458 km', period: '30.3 horas', r: '6 km' },
      ],
      facts: [
        'Lar do Olympus Mons, o maior vulcão do Sistema Solar (21 km de altura).',
        'Um dia marciano (sol) dura 24 h e 37 min — quase igual ao terrestre.',
        'As suas duas luas foram provavelmente asteroides capturados.',
        'Evidências de antigas redes fluviais foram descobertas na superfície.',
      ],
      compare: { size: 0.53, gravity: 0.38, distance: 1.52, period: 1.88 },
    },
    {
      id: 'jupiter', name: 'Júpiter', color: '#c88b3a', textureFile: 'jupiter_2048.jpg',
      displayR: 10, orbitR: 115, period: 4333,
      info: { dist: '5.20 UA', radius: '69 911 km', mass: '1.90 × 10²⁷ kg', period: '11.9 anos', day: '9 h 56 min', temp: '−108°C', moons: '95', gravity: '24.8 m/s²', atmos: 'H₂ 90%, He 10%' },
      moonList: [
        { name: 'Io', dist: '421 700 km', period: '1.8 dias', r: '1 822 km' },
        { name: 'Europa', dist: '671 000 km', period: '3.6 dias', r: '1 561 km' },
        { name: 'Ganímedes', dist: '1 070 400 km', period: '7.2 dias', r: '2 634 km' },
        { name: 'Calisto', dist: '1 882 700 km', period: '16.7 dias', r: '2 410 km' },
      ],
      facts: [
        'O maior planeta: cabem 1 321 Terras no seu interior.',
        'A Grande Mancha Vermelha é uma tempestade com mais de 300 anos de registos.',
        'Ganímedes é maior do que o planeta Mercúrio.',
        'Europa pode ter um oceano de água líquida sob a sua crosta gelada.',
      ],
      compare: { size: 11.2, gravity: 2.53, distance: 5.2, period: 11.86 },
    },
    {
      id: 'saturn', name: 'Saturno', color: '#e4d191', textureFile: 'saturn_2048.jpg',
      displayR: 8.5, orbitR: 150, period: 10759, hasRings: true,
      info: { dist: '9.58 UA', radius: '58 232 km', mass: '5.68 × 10²⁶ kg', period: '29.5 anos', day: '10 h 33 min', temp: '−178°C', moons: '146', gravity: '10.4 m/s²', atmos: 'H₂ 96%, He 3%' },
      moonList: [
        { name: 'Titã', dist: '1 221 870 km', period: '15.9 dias', r: '2 575 km' },
        { name: 'Réia', dist: '527 068 km', period: '4.5 dias', r: '764 km' },
        { name: 'Jápeto', dist: '3 560 820 km', period: '79.3 dias', r: '736 km' },
        { name: 'Encélado', dist: '238 020 km', period: '1.4 dias', r: '252 km' },
      ],
      facts: [
        'Os anéis estendem-se até 282 000 km, mas têm apenas ~1 km de espessura.',
        'É o planeta menos denso do Sistema Solar — flutuaria na água.',
        'Titã tem lagos de metano líquido e uma atmosfera espessa de azoto.',
        'Encélado expulsa géiseres de água que alimentam o anel E de Saturno.',
      ],
      compare: { size: 9.45, gravity: 1.07, distance: 9.58, period: 29.46 },
    },
    {
      id: 'uranus', name: 'Urano', color: '#7de8e8', textureFile: 'uranus_2048.jpg',
      displayR: 6, orbitR: 185, period: 30687,
      info: { dist: '19.2 UA', radius: '25 362 km', mass: '8.68 × 10²⁵ kg', period: '84 anos', day: '17 h 14 min', temp: '−220°C', moons: '27', gravity: '8.7 m/s²', atmos: 'H₂, He, CH₄ (azul-esverdeado)' },
      moonList: [
        { name: 'Titânia', dist: '435 910 km', period: '8.7 dias', r: '789 km' },
        { name: 'Oberão', dist: '583 520 km', period: '13.5 dias', r: '761 km' },
        { name: 'Umbriel', dist: '266 000 km', period: '4.1 dias', r: '585 km' },
        { name: 'Ariel', dist: '191 020 km', period: '2.5 dias', r: '579 km' },
      ],
      facts: [
        'Rota de lado — o eixo está inclinado 98° em relação ao plano orbital.',
        'As suas luas têm nomes de personagens de Shakespeare e Alexander Pope.',
        'Registou −224°C, os ventos mais frios do Sistema Solar.',
        'Possui 13 anéis estreitos, descobertos por ocultação estelar em 1977.',
      ],
      compare: { size: 4.01, gravity: 0.89, distance: 19.2, period: 84 },
    },
    {
      id: 'neptune', name: 'Neptuno', color: '#5b86e5', textureFile: 'neptune_2048.jpg',
      displayR: 5.5, orbitR: 220, period: 60190,
      info: { dist: '30.1 UA', radius: '24 622 km', mass: '1.02 × 10²⁶ kg', period: '165 anos', day: '16 h 6 min', temp: '−218°C', moons: '16', gravity: '11.2 m/s²', atmos: 'H₂, He, CH₄ (azul profundo)' },
      moonList: [
        { name: 'Tritão', dist: '354 759 km', period: '−5.9 dias', r: '1 353 km' },
        { name: 'Proteu', dist: '117 647 km', period: '1.1 dias', r: '210 km' },
        { name: 'Nereida', dist: '5 513 400 km', period: '360 dias', r: '170 km' },
      ],
      facts: [
        'Ventos de até 2 100 km/h — os mais rápidos do Sistema Solar.',
        'Tritão orbita ao contrário e aproxima-se lentamente; desintegrará em ~3,6 Ga.',
        'Foi o único planeta descoberto por previsão matemática, antes de ser observado.',
        'A Grande Mancha Escura (1989) desapareceu em poucos anos, ao contrário de Júpiter.',
      ],
      compare: { size: 3.88, gravity: 1.14, distance: 30.1, period: 165 },
    },
  ];

  const SUN = {
    name: 'Sol', color: '#ffd700',
    info: { type: 'Estrela G2V', radius: '696 340 km', temp: '5 500°C (superfície)', age: '4,6 mil M anos', gravity: '274 m/s²' },
    facts: [
      'Contém 99,86% de toda a massa do Sistema Solar.',
      'A luz do Sol demora ~8 minutos e 20 segundos a chegar à Terra.',
      'Converte ~4 milhões de toneladas de matéria em energia por segundo por fusão nuclear.',
      'Daqui a ~5 mil milhões de anos, expandirá para gigante vermelha, engolindo Mercúrio e Vénus.',
    ],
  };

  /* ── Comets (real, clickable). Orbit params (a,b,inc,phase,speed) are
     scene-decorative; info/facts are factual. ── */
  const COMETS = [
    {
      id: 'halley', name: 'Halley (1P/Halley)', color: '#bfe3ff',
      a: 300, b: 120, inc: 0.55, phase: 0.0, speed: 0.00055, tailLen: 95,
      info: { type: 'Cometa periódico', period: '76 anos', perihelion: '0,59 UA', aphelion: '35 UA', nucleus: '15 × 8 km', composition: 'Gelo, poeira, CO₂', origin: 'Nuvem de Oort (tipo Halley)', lastSeen: '1986', nextSeen: '2061' },
      facts: [
        'O cometa mais famoso — observado desde, pelo menos, 240 a.C.',
        'Foi o primeiro cometa cujo retorno foi previsto (por Edmond Halley, em 1705).',
        'A sonda Giotto (ESA) fotografou o seu núcleo de perto em 1986.',
        'Origina as chuvas de meteoros das Eta Aquáridas (Maio) e Oriónidas (Outubro).',
      ],
    },
    {
      id: 'halebopp', name: 'Hale-Bopp (C/1995 O1)', color: '#dbe6ff',
      a: 460, b: 150, inc: 0.9, phase: 1.7, speed: 0.00028, tailLen: 130,
      info: { type: 'Cometa de longo período', period: '~2 530 anos', perihelion: '0,91 UA', nucleus: '~60 km', composition: 'Gelo, poeira (duas caudas distintas)', origin: 'Nuvem de Oort', lastSeen: '1997', nextSeen: '~4385' },
      facts: [
        'Um dos cometas mais brilhantes do século XX — visível a olho nu durante 18 meses.',
        'O seu núcleo, com ~60 km, é dos maiores alguma vez medidos.',
        'Exibiu claramente duas caudas: uma de poeira (amarelada) e outra de iões (azul).',
      ],
    },
    {
      id: 'neowise', name: 'NEOWISE (C/2020 F3)', color: '#ffe7c0',
      a: 540, b: 130, inc: 1.25, phase: 3.3, speed: 0.00022, tailLen: 120,
      info: { type: 'Cometa de longo período', period: '~6 800 anos', perihelion: '0,29 UA', nucleus: '~5 km', composition: 'Gelo, poeira', origin: 'Nuvem de Oort', lastSeen: '2020', nextSeen: '~8800' },
      facts: [
        'O cometa mais brilhante visível do hemisfério norte desde o Hale-Bopp.',
        'Descoberto pelo telescópio espacial NEOWISE (NASA) em Março de 2020.',
        'Mostrou uma cauda de sódio, um fenómeno raro registado em poucos cometas.',
      ],
    },
    {
      id: 'encke', name: 'Encke (2P/Encke)', color: '#cfe0c8',
      a: 150, b: 70, inc: 0.3, phase: 4.7, speed: 0.0013, tailLen: 55,
      info: { type: 'Cometa periódico', period: '3,3 anos', perihelion: '0,34 UA', aphelion: '4,1 UA', nucleus: '~4,8 km', composition: 'Gelo, poeira', origin: 'Família de Júpiter', lastSeen: '2023', nextSeen: '2027' },
      facts: [
        'Tem o período orbital conhecido mais curto de qualquer cometa: apenas 3,3 anos.',
        'Está associado à chuva de meteoros das Táuridas.',
        'O segundo cometa a ter o seu regresso previsto, depois do Halley.',
      ],
    },
    {
      id: 'churyumov', name: '67P/Churyumov–Gerasimenko', color: '#c9c4b8',
      a: 210, b: 95, inc: 0.18, phase: 2.4, speed: 0.0009, tailLen: 60,
      info: { type: 'Cometa periódico', period: '6,4 anos', perihelion: '1,24 UA', aphelion: '5,7 UA', nucleus: '~4,3 km (bilobado)', composition: 'Gelo, poeira, compostos orgânicos', origin: 'Família de Júpiter', lastSeen: '2021', nextSeen: '2028' },
      facts: [
        'O primeiro cometa onde uma sonda entrou em órbita e pousou um módulo.',
        'A missão Rosetta (ESA) orbitou-o e o módulo Philae pousou no núcleo em 2014.',
        'Tem forma de "pato de borracha", com dois lóbulos ligados por um pescoço.',
      ],
    },
  ];

  /* ── Large/named asteroids (clickable, orbit within the belt). ── */
  const BIG_ASTEROIDS = [
    { id: 'ceres', name: 'Ceres', color: '#9fa3a8', orbitR: 99, displayR: 1.7,
      info: { type: 'Planeta anão', dist: '2,77 UA', radius: '473 km', period: '4,6 anos', day: '9 horas', moons: '0', composition: 'Rocha, gelo de água' },
      facts: ['O maior objeto da cintura de asteroides e o único planeta anão da cintura.', 'Contém cerca de um terço de toda a massa da cintura.', 'A sonda Dawn (NASA) orbitou-o entre 2015 e 2018, revelando depósitos de sais brilhantes.'] },
    { id: 'vesta', name: 'Vesta', color: '#c8bda6', orbitR: 92, displayR: 1.2,
      info: { type: 'Asteroide (protoplaneta)', dist: '2,36 UA', radius: '263 km', period: '3,6 anos', day: '5,3 horas', composition: 'Rocha basáltica' },
      facts: ['O segundo corpo mais massivo da cintura e, por vezes, visível a olho nu.', 'Visitado pela sonda Dawn (NASA) em 2011–2012.', 'Muitos meteoritos HED encontrados na Terra têm origem em Vesta.'] },
    { id: 'pallas', name: 'Pallas', color: '#a6a29a', orbitR: 106, displayR: 1.1,
      info: { type: 'Asteroide', dist: '2,77 UA', radius: '256 km', period: '4,6 anos', day: '7,8 horas', composition: 'Silicatos' },
      facts: ['O terceiro maior asteroide, com uma órbita muito inclinada (~35°).', 'Foi o segundo asteroide a ser descoberto, em 1802.'] },
    { id: 'hygiea', name: 'Hígia', color: '#8f9298', orbitR: 112, displayR: 1.0,
      info: { type: 'Asteroide', dist: '3,14 UA', radius: '217 km', period: '5,6 anos', day: '13,8 horas', composition: 'Carbonáceo escuro' },
      facts: ['O quarto maior objeto da cintura e possivelmente quase esférico.', 'Poderá vir a ser reclassificado como planeta anão.'] },
  ];

  /* ── Earth satellites (clickable: ISS, Hubble). ── */
  const SATELLITES = [
    { id: 'iss', name: 'Estação Espacial Internacional', color: 0xffffff, dist: 5.1, inc: 0.9, speed: 0.05,
      info: { type: 'Estação espacial', dist: '~420 km', period: '92 minutos', speed: '27 600 km/h', crew: '7 tripulantes' },
      facts: ['O maior objeto humano em órbita — visível a olho nu como um ponto brilhante.', 'Dá uma volta à Terra a cada ~92 minutos (16 amanheceres por dia).', 'Habitada continuamente desde Novembro de 2000.'] },
    { id: 'hubble', name: 'Telescópio Espacial Hubble', color: 0xcfd6e0, dist: 5.6, inc: 0.45, speed: 0.044,
      info: { type: 'Telescópio espacial', dist: '~540 km', period: '95 minutos', launch: '1990', operator: 'NASA / ESA' },
      facts: ['Em órbita desde 1990, revolucionou a astronomia moderna.', 'As suas imagens ajudaram a medir a idade e a expansão do Universo.', 'Foi reparado e atualizado por missões tripuladas dos vaivéns espaciais.'] },
  ];

  /* ── Module state ── */
  let _renderer   = null;
  let _scene      = null;
  let _camera     = null;
  let _raf        = null;
  let _mounted    = false;
  let _container  = null;

  /* Planet meshes */
  let _sunMesh    = null;
  let _planetMeshes = [];   /* parallel to PLANETS */
  let _angles     = PLANETS.map(() => Math.random() * Math.PI * 2);

  /* Camera orbit */
  let _camTheta   = 0.3;
  let _camPhi     = 1.1;
  let _camDist    = 280;
  let _camDistT   = 280;
  let _camThetaT  = 0.3;
  let _camPhiT    = 1.1;
  let _camFocusX  = 0;
  let _camFocusY  = 0;
  let _camFocusZ  = 0;
  let _camFocusXT = 0;
  let _camFocusYT = 0;
  let _camFocusZT = 0;

  /* Animation */
  let _speed   = 1;
  let _paused  = false;
  let _orbitLines    = [];
  let _orbitsVisible = true;
  let _moons         = [];     /* clickable moon meshes: {mesh, planetIdx, angle, dist, speed, color, data} */
  let _selMoon       = null;
  let _selBody       = null;    /* body object backing the tabbed panel (planet/sun/comet/asteroid/satellite) */
  let _earthClouds   = null;   /* Earth cloud shell (toggleable) */
  let _cloudsOn      = true;
  let _earthDN       = null;   /* Earth day/night shader uniforms */
  let _earthMesh     = null;
  let _comets        = [];     /* [{ data, head, ion, dust, angle, ... }] */
  let _beltPoints    = null;   /* rotating asteroid-belt Points */
  let _asteroids     = [];     /* named clickable asteroids: {mesh, data, angle, orbitR, speed} */
  let _satellites    = [];     /* Earth satellites: {mesh, data, angle, dist, inc, speed} */
  let _glowTex       = null;   /* shared soft radial-glow texture (coma, etc.) */
  let _sunCorona     = null;
  let _maxAniso      = 8;       /* GPU max anisotropy → sharper planet textures */

  /* Earth day/night: blend day + night (city lights) textures by the angle to
     the Sun (at the origin). World-space normal so it works with tilt + spin. */
  const EARTH_VERT = `
    varying vec2 vUv; varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const EARTH_FRAG = `
    uniform sampler2D dayTex; uniform sampler2D nightTex; uniform vec3 sunDir;
    varying vec2 vUv; varying vec3 vWorldNormal;
    void main() {
      float intensity = dot(normalize(vWorldNormal), normalize(sunDir));
      float blend = smoothstep(-0.10, 0.18, intensity);
      vec3 day   = texture2D(dayTex, vUv).rgb;
      vec3 night = texture2D(nightTex, vUv).rgb * 1.5;   /* boost city lights */
      gl_FragColor = vec4(mix(night, day, blend), 1.0);
    }`;

  /* Respect the user's reduced-motion preference (app setting or OS).
     When reduced, planets hold position/spin but the scene still renders
     and stays fully interactive (drag, zoom, selection). */
  function _reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  /* Quality factor (1 = full; lower on small / low-end devices) → fewer belt
     rocks + stars and a capped pixel ratio, so it stays fluid on phones. */
  function _quality() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    if (small && (lowMem || lowCpu)) return 0.35;
    if (small) return 0.5;
    if (lowMem || lowCpu) return 0.72;
    return 1;
  }
  let _q = 1;
  function _pixelRatio() { return Math.min(window.devicePixelRatio || 1, _q < 0.5 ? 1.25 : 1.75); }
  let _sel     = null;    /* index | 'sun' | null */
  let _curTab  = 'overview';

  /* Drag state */
  let _dragging = false;
  let _lastX    = 0;
  let _lastY    = 0;

  /* Label overlays */
  let _labelEls   = [];   /* HTML divs, parallel to PLANETS + sun */
  let _sunLabelEl = null;
  let _hovered    = null; /* index | 'sun' | null */
  let _autoOpenDone = false;

  /* ═════════════════════════════ LOAD THREE ═════════════════════════ */
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ═════════════════════════════ MOUNT ══════════════════════════════ */
  async function mount(container) {
    _container = container;
    container.innerHTML = `
      <div class="ex-solar-wrap">
        <div class="ex-solar-viewport" id="ss-viewport"></div>
        <div class="ex-solar-loading" id="ss-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-solar-loading-txt">A inicializar Sistema Solar 3D…</div>
        </div>
        <div class="ex-solar-controls">
          <button class="ex-solar-btn" id="ss-slower" title="Mais lento">⏪</button>
          <button class="ex-solar-btn" id="ss-pause"  title="Pausar/Continuar">⏸</button>
          <span  class="ex-solar-speed" id="ss-speed">1×</span>
          <button class="ex-solar-btn" id="ss-faster" title="Mais rápido">⏩</button>
          <button class="ex-solar-btn" id="ss-reset"  title="Repor">↺</button>
          <div class="ex-solar-divider"></div>
          <button class="ex-solar-btn active" id="ss-orbits" title="Mostrar/ocultar órbitas">🛰</button>
          <button class="ex-solar-btn active" id="ss-clouds" title="Nuvens da Terra">☁</button>
          <div class="ex-solar-divider"></div>
          <button class="ex-solar-btn" id="ss-zoom-out" title="Afastar">−</button>
          <button class="ex-solar-btn" id="ss-zoom-in"  title="Aproximar">+</button>
        </div>
        <div class="ex-solar-panel" id="ss-panel">
          <button class="ex-solar-panel-close" id="ss-panel-close" title="Fechar">✕</button>
          <div class="ex-solar-panel-header" id="ss-panel-header"></div>
          <div class="ex-solar-panel-tabs" id="ss-panel-tabs">
            <button class="ex-solar-panel-tab active" data-tab="overview">Geral</button>
            <button class="ex-solar-panel-tab" data-tab="moons">Luas</button>
            <button class="ex-solar-panel-tab" data-tab="exploration">Exploração</button>
            <button class="ex-solar-panel-tab" data-tab="facts">Curiosidades</button>
            <button class="ex-solar-panel-tab" data-tab="compare">Comparar</button>
          </div>
          <div class="ex-solar-panel-body" id="ss-panel-body"></div>
        </div>
        <div class="ex-solar-hint" id="ss-hint">Selecciona um corpo celeste para explorar · Arrasta para rodar · Scroll para zoom</div>
        <div class="ex-solar-credit">Texturas: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> · CC BY 4.0</div>
      </div>`;

    _mounted = true;
    _wireControls(container);
    _wirePanelTabs(container);

    try {
      await _loadScript(THREE_CDN);
    } catch (e) {
      document.getElementById('ss-loading').innerHTML = `
        <div class="ex-error-icon">⚠</div>
        <div class="ex-error-msg">Erro ao carregar Three.js.</div>`;
      return;
    }

    _buildScene(container);
    _buildLabels(container);
    document.getElementById('ss-loading')?.remove();
    _wirePointer(container);
    _wireHover(container);
    _start();

    /* Neutral start — nothing selected. A gentle cinematic camera drift
       (handled in the animation tick while _sel === null) makes it feel alive
       without auto-selecting any body. */
  }

  function resume() { if (!_raf && _mounted) _start(); }

  function stop() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    /* Labels are inside ex-sub which goes display:none — no explicit cleanup needed */
  }

  /* ═════════════════════════════ SCENE ══════════════════════════════ */
  function _buildScene(container) {
    const viewport = container.querySelector('#ss-viewport');
    const W = viewport.clientWidth  || 800;
    const H = viewport.clientHeight || 600;
    _orbitLines = [];   /* reset so re-mounts don't keep stale orbit refs */
    _earthDN = null; _earthMesh = null; _sunCorona = null;
    _comets = []; _asteroids = []; _satellites = []; _beltPoints = null;

    /* Renderer */
    _q = _quality();
    _renderer = new THREE.WebGLRenderer({ antialias: _q >= 0.7, alpha: false });
    _renderer.setPixelRatio(_pixelRatio());
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x000005, 1);
    try { _maxAniso = _renderer.capabilities.getMaxAnisotropy() || 8; } catch (_) {}
    viewport.appendChild(_renderer.domElement);

    /* Scene */
    _scene = new THREE.Scene();

    /* Space background — the real Milky Way star sky (ESO/S.Brunier panorama,
       CC-BY 4.0, bundled locally). This is exactly the right viewpoint: from
       inside the Solar System we look out at our own galaxy. Solid colour shows
       until the texture loads, and stays as the fallback if it fails. */
    _scene.background = new THREE.Color(0x05060f);
    new THREE.TextureLoader().load('assets/space/milkyway.jpg', tex => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = _maxAniso || 1;
      _scene.background = tex;
    }, undefined, () => {});

    /* Starfield */
    const starCount = Math.round(5000 * _q);
    const starPos   = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 2000;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    _scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true })));

    /* Lighting — neutral mid-ambient + non-decaying point sun so outer planets stay legible */
    _scene.add(new THREE.AmbientLight(0x404050, 1.4));
    const sunLight = new THREE.PointLight(0xfff5e0, 4.5, 0, 0);
    sunLight.position.set(0, 0, 0);
    _scene.add(sunLight);

    /* Camera */
    _camera = new THREE.PerspectiveCamera(55, W / H, 0.5, 3000);
    _updateCamera();

    /* Sun — textured surface (CC BY 4.0); falls back to flat gold if it fails. */
    const sunGeo  = new THREE.SphereGeometry(8, 48, 48);
    const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    new THREE.TextureLoader().load(SUN_TEX, tex => {
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = _maxAniso; sunMat.map = tex; sunMat.color.set(0xffffff); sunMat.needsUpdate = true;
    }, undefined, () => { sunMat.color.set(0xffd700); });
    _sunMesh = new THREE.Mesh(sunGeo, sunMat);
    _scene.add(_sunMesh);

    /* Sun glow (additive sprite) */
    const glowGeo = new THREE.SphereGeometry(12, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.15, side: THREE.FrontSide });
    _scene.add(new THREE.Mesh(glowGeo, glowMat));

    /* Orbit lines */
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 });
    PLANETS.forEach(p => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * p.orbitR, 0, Math.sin(a) * p.orbitR));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const loop = new THREE.LineLoop(orbitGeo, orbitMat);
      loop.visible = _orbitsVisible;
      _orbitLines.push(loop);
      _scene.add(loop);
    });

    /* Real axial tilts (degrees) — gives the planets and rings a believable
       3D pose instead of a flat plane. Uranus famously rolls on its side. */
    const AXIAL_TILT = {
      mercury: 0.03, venus: 177.4, earth: 23.4, mars: 25.2,
      jupiter: 3.1, saturn: 26.7, uranus: 97.8, neptune: 28.3,
    };

    /* Planet meshes */
    const loader = new THREE.TextureLoader();
    _planetMeshes = PLANETS.map(p => {
      const geo = new THREE.SphereGeometry(p.displayR, 48, 48);
      /* Baseline emissive in the planet's own colour keeps it visible even on the dark side. */
      const baseEmissive = new THREE.Color(p.color).multiplyScalar(0.18);
      const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(p.color), emissive: baseEmissive, shininess: 15 });
      loader.load(
        TEX_BASE + p.textureFile,
        tex => {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = _maxAniso; mat.map = tex;
          /* Surface relief for the cratered rocky worlds — reuse the colour map
             as a bump map so craters/ridges catch the sunlight near the
             terminator (gas giants stay smooth). */
          if (p.rocky) { mat.bumpMap = tex; mat.bumpScale = 0.06; }
          mat.needsUpdate = true;
        },
        undefined,
        () => {}
      );
      const mesh = new THREE.Mesh(geo, mat);
      /* Apply axial tilt about the Z axis so rotation + rings look correct. */
      mesh.rotation.z = (AXIAL_TILT[p.id] || 0) * Math.PI / 180;
      _scene.add(mesh);

      /* Earth gets a soft blue atmosphere shell + a toggleable cloud layer. */
      if (p.id === 'earth') {
        const atmGeo = new THREE.SphereGeometry(p.displayR * 1.07, 48, 48);
        const atmMat = new THREE.MeshBasicMaterial({ color: 0x4a93ff, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false });
        mesh.add(new THREE.Mesh(atmGeo, atmMat));

        /* Clouds: white-on-black texture used as map + alphaMap so only the
           clouds show. Hidden until the texture loads (avoids a white shell). */
        const cloudMat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.9, depthWrite: false });
        _earthClouds = new THREE.Mesh(new THREE.SphereGeometry(p.displayR * 1.025, 48, 48), cloudMat);
        _earthClouds.visible = false;
        new THREE.TextureLoader().load('assets/planets/earth-clouds.jpg', tex => {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = _maxAniso; cloudMat.map = tex; cloudMat.alphaMap = tex; cloudMat.needsUpdate = true;
          _earthClouds.visible = _cloudsOn;
        }, undefined, () => {});
        mesh.add(_earthClouds);

        /* Day/night shader — swaps in once BOTH day + night maps have loaded. */
        const uniforms = { dayTex: { value: null }, nightTex: { value: null }, sunDir: { value: new THREE.Vector3(1, 0, 0) } };
        const tl = new THREE.TextureLoader();
        let loaded = 0;
        const onLoad = () => {
          if (++loaded < 2) return;
          mesh.material = new THREE.ShaderMaterial({ uniforms, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG });
          _earthDN = uniforms; _earthMesh = mesh;
        };
        tl.load('assets/planets/earth_atmos_2048.jpg', t => { if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = _maxAniso; uniforms.dayTex.value = t; onLoad(); }, undefined, () => {});
        tl.load('assets/planets/earth-night.jpg',     t => { if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = _maxAniso; uniforms.nightTex.value = t; onLoad(); }, undefined, () => {});
      }

      /* Saturn rings — tilt with the planet so they read as a 3D ring system. */
      if (p.hasRings) {
        const inner = p.displayR * 1.28, outer = p.displayR * 2.35;
        const ringGeo = new THREE.RingGeometry(inner, outer, 160);
        /* Remap UVs radially so the ring texture's gradient (inner→outer gaps,
           Cassini division) maps across the ring's width. */
        const pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v3.fromBufferAttribute(pos, i);
          uv.setXY(i, (v3.length() - inner) / (outer - inner), 0.5);
        }
        const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false });
        new THREE.TextureLoader().load(RING_TEX, tex => {
          if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = _maxAniso; ringMat.map = tex; ringMat.alphaMap = tex; ringMat.needsUpdate = true;
        }, undefined, () => { ringMat.color = new THREE.Color(0xd8b878); ringMat.opacity = 0.7; });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;   /* lie in the planet's equatorial plane */
        mesh.add(ring);                   /* inherits the planet's axial tilt */
      }

      return mesh;
    });

    /* Asteroid belt between Mars and Jupiter + named clickable asteroids. */
    _buildAsteroidBelt(PLANETS);
    _buildNamedAsteroids();

    /* Clickable major moons orbiting their planets. */
    _buildMoons();

    /* Satellites orbiting Earth (ISS, Hubble + decorative GPS/geo ring). */
    _buildSatellites();

    /* Subtle Sun corona (additive shell that gently pulses) + comets. */
    _buildSunCorona();
    _buildComets();

    /* ResizeObserver */
    new ResizeObserver(() => {
      if (!_renderer || !_camera) return;
      const el = container.querySelector('#ss-viewport');
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      _camera.aspect = w / h;
      _camera.updateProjectionMatrix();
      _renderer.setSize(w, h);
    }).observe(viewport);
  }

  /* Soft radial-gradient texture (white core → transparent) reused for comet
     comae, sun glow and nebulae. Generated once, on a small canvas. */
  function _glowTexture() {
    if (_glowTex) return _glowTex;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _glowTex = new THREE.CanvasTexture(cv);
    return _glowTex;
  }

  /* Asteroid belt between Mars and Jupiter — denser, with size/colour variation,
     a believable vertical spread and a clear (Kirkwood-style) inner/outer falloff.
     Stored so it rotates slowly in the animation loop. */
  function _buildAsteroidBelt(PLANETS) {
    const mars = PLANETS.find(p => p.id === 'mars');
    const jup  = PLANETS.find(p => p.id === 'jupiter');
    if (!mars || !jup) return;
    const rMin = mars.orbitR + 5, rMax = jup.orbitR - 6;
    const N = Math.round(2800 * _q);
    const palette = [
      [0.60, 0.56, 0.48], [0.52, 0.47, 0.40], [0.70, 0.64, 0.54],
      [0.45, 0.42, 0.40], [0.66, 0.58, 0.46],
    ];
    /* Real 3D rocks instead of flat square points: a single chunky low-poly
       geometry instanced N times with per-rock position, rotation, non-uniform
       scale and a greyish-brown tint. Far more believable than dots. */
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      /* Bias toward the middle of the belt (denser core, sparse edges). */
      const t = (Math.random() + Math.random()) / 2;
      const r = rMin + t * (rMax - rMin);
      const spread = 2 + (r - rMin) / (rMax - rMin) * 3;
      dummy.position.set(Math.cos(a) * r, (Math.random() - 0.5) * spread, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = 0.28 + Math.pow(Math.random(), 2.2) * 1.0;        /* mostly small, a few larger */
      dummy.scale.set(s * (0.7 + Math.random() * 0.6), s * (0.7 + Math.random() * 0.6), s * (0.7 + Math.random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = palette[(Math.random() * palette.length) | 0];
      color.setRGB(c[0], c[1], c[2]); mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    _beltPoints = mesh;
    _scene.add(_beltPoints);
  }

  /* Named asteroids (Ceres, Vesta…) as small clickable bodies in the belt. */
  function _buildNamedAsteroids() {
    _asteroids = [];
    BIG_ASTEROIDS.forEach(a => {
      const geo = new THREE.SphereGeometry(a.displayR, 16, 16);
      const mat = new THREE.MeshPhongMaterial({ color: a.color, emissive: new THREE.Color(a.color).multiplyScalar(0.2), shininess: 6 });
      const mesh = new THREE.Mesh(geo, mat);
      _scene.add(mesh);
      _asteroids.push({ mesh, data: a, angle: Math.random() * Math.PI * 2, orbitR: a.orbitR, speed: 0.0004 + Math.random() * 0.0003 });
    });
  }

  /* Earth satellites: ISS + Hubble (clickable) plus a decorative geostationary
     ring and a small GPS cluster. They are attached to the Earth mesh so they
     follow it around its orbit. */
  function _buildSatellites() {
    _satellites = [];
    const earthIdx = PLANETS.findIndex(p => p.id === 'earth');
    const earth = _planetMeshes[earthIdx];
    if (!earth) return;
    const R = PLANETS[earthIdx].displayR;

    SATELLITES.forEach(s => {
      const mesh = _buildSatModel(s);
      _scene.add(mesh);
      _satellites.push({ mesh, data: s, angle: Math.random() * Math.PI * 2, dist: s.dist, inc: s.inc, speed: s.speed });
    });

    /* Decorative geostationary ring (thin line in Earth's equatorial plane). */
    const geoPts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      geoPts.push(new THREE.Vector3(Math.cos(a) * R * 1.9, 0, Math.sin(a) * R * 1.9));
    }
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(geoPts),
      new THREE.LineBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.35 }),
    );
    earth.add(ring);

    /* Constellation of small satellites on inclined orbits (GPS-like) — actual
       mini-sat models rather than dots. Attached to Earth so they follow it. */
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, inc = (Math.random() - 0.5) * 1.1, r = R * (2.1 + Math.random() * 0.5);
      const mini = _buildMiniSat();
      mini.position.set(Math.cos(a) * r, Math.sin(inc) * r * 0.7, Math.sin(a) * r);
      earth.add(mini);
    }
  }

  /* A small but recognisable satellite model (so ISS/Hubble don't read as
     little moons): a body with gold solar panels, plus an invisible hit-sphere
     for easy clicking. The group carries userData.satId. */
  function _buildSatModel(s) {
    const g = new THREE.Group();
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x2b6cb0, side: THREE.DoubleSide });

    if (s.id === 'hubble') {
      /* Cylindrical telescope body + open aperture + two small wings. */
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.0, 18), new THREE.MeshBasicMaterial({ color: 0xcdd3dd }));
      tube.rotation.z = Math.PI / 2; g.add(tube);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 18), new THREE.MeshBasicMaterial({ color: 0x1b1f2a }));
      rim.rotation.z = Math.PI / 2; rim.position.x = 0.5; g.add(rim);
      [-1, 1].forEach(sgn => {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), panelMat);
        wing.position.z = sgn * 0.5; g.add(wing);
      });
    } else {
      /* ISS: silver central trusses + four long gold solar arrays. */
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xe7edf6 }));
      g.add(body);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.0), new THREE.MeshBasicMaterial({ color: 0xb8c0cc }));
      g.add(truss);
      [-0.75, -0.25, 0.25, 0.75].forEach(z => {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ color: 0xffc861, side: THREE.DoubleSide }));
        panel.position.z = z; g.add(panel);
      });
    }

    /* Invisible, larger sphere makes the tiny model easy to hover/click. */
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    g.add(hit);

    g.scale.setScalar(0.62);          /* smaller, less moon-like */
    g.rotation.set(0.4, 0.6, 0);      /* a pleasant fixed attitude */
    g.userData.satId = s.id;
    return g;
  }

  /* A tiny decorative satellite (body + two solar wings) for the surrounding
     constellation — recognisable as a mini-sat rather than a bare dot. */
  function _buildMiniSat() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xdfe6f0 }));
    g.add(body);
    [-1, 1].forEach(sgn => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ color: 0x6aa6e6, side: THREE.DoubleSide }));
      panel.position.x = sgn * 0.2; g.add(panel);
    });
    g.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    return g;
  }

  /* Build small clickable moons orbiting each planet (from its moonList). */
  const _MOON_COLOR = { 'Io': 0xe6d27a, 'Europa': 0xeae6dc, 'Lua': 0xcfd2d6, 'Titã': 0xd9a441, 'Tritão': 0xc8d6e6 };
  function _buildMoons() {
    _moons = [];
    PLANETS.forEach((p, pi) => {
      (p.moonList || []).forEach((m, k) => {
        const color = _MOON_COLOR[m.name] || 0xc2c7cf;
        const mr = Math.max(0.5, Math.min(1.6, p.displayR * 0.16));
        const geo = new THREE.SphereGeometry(mr, 20, 20);
        const mat = new THREE.MeshPhongMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.15), shininess: 8 });
        /* Earth's Moon gets the real lunar texture (CC BY 4.0). */
        if (m.name === 'Lua') {
          new THREE.TextureLoader().load('assets/planets/moon.jpg', tex => {
            if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = _maxAniso; mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
          }, undefined, () => {});
        }
        const mesh = new THREE.Mesh(geo, mat);
        _scene.add(mesh);
        _moons.push({
          mesh, planetIdx: pi, data: m, color,
          angle: Math.random() * Math.PI * 2,
          dist:  p.displayR * 1.7 + k * (p.displayR * 0.5 + 1.4),
          speed: 0.012 + k * 0.004,
        });
      });
    });
  }

  /* Soft additive corona around the Sun — gently pulses (subtle solar activity). */
  function _buildSunCorona() {
    const geo = new THREE.SphereGeometry(10.5, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
    _sunCorona = new THREE.Mesh(geo, mat);
    _scene.add(_sunCorona);
  }

  /* Detailed comets: each has a glowing coma (sprite), a solid nucleus, a
     straight blue ion tail and a wider, slightly fanned pale dust tail — both
     pointing anti-sunward. The nucleus mesh is clickable (userData.cometId). */
  function _buildComets() {
    _comets = [];
    const glow = _glowTexture();
    COMETS.forEach(c => {
      const col = new THREE.Color(c.color);

      /* Nucleus (clickable) */
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 14, 14),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      head.userData.cometId = c.id;
      _scene.add(head);

      /* Coma: soft additive glow sprite around the nucleus. */
      const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      coma.scale.setScalar(7);
      head.add(coma);

      const ionN = Math.round(c.tailLen * 0.6);
      const dustN = Math.round(c.tailLen * 0.9);
      const ionGeo = new THREE.BufferGeometry();
      ionGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ionN * 3), 3));
      const ion = new THREE.Points(ionGeo, new THREE.PointsMaterial({ color: 0x8fc4ff, size: 1.4, transparent: true, opacity: 0.6, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false }));

      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustN * 3), 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xf3e6c8, size: 1.9, transparent: true, opacity: 0.42, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false }));

      _scene.add(ion); _scene.add(dust);
      _comets.push({ data: c, head, coma, ion, dust, ionN, dustN, angle: c.phase, a: c.a, b: c.b, inc: c.inc, speed: c.speed, tailLen: c.tailLen });
    });
  }

  /* ═════════════════════════════ CAMERA ═════════════════════════════ */
  function _updateCamera() {
    if (!_camera) return;
    const x = _camDist * Math.sin(_camPhi) * Math.sin(_camTheta) + _camFocusX;
    const y = _camDist * Math.cos(_camPhi) + _camFocusY;
    const z = _camDist * Math.sin(_camPhi) * Math.cos(_camTheta) + _camFocusZ;
    _camera.position.set(x, y, z);
    _camera.lookAt(_camFocusX, _camFocusY, _camFocusZ);
  }

  function _focusPlanet(idx) {
    const p = PLANETS[idx];
    const mesh = _planetMeshes[idx];
    if (!mesh) return;
    _camFocusXT = mesh.position.x;
    _camFocusYT = 0;
    _camFocusZT = mesh.position.z;
    _camDistT   = p.displayR * 8;
  }

  function _focusSun() {
    _camFocusXT = 0; _camFocusYT = 0; _camFocusZT = 0;
    _camDistT   = 50;
  }

  function _focusVec(x, y, z, dist) {
    _camFocusXT = x; _camFocusYT = y; _camFocusZT = z;
    _camDistT = dist;
  }

  /* ═════════════════════════════ ANIMATION ══════════════════════════ */
  function _start() {
    function tick() {
      _raf = requestAnimationFrame(tick);
      if (!_renderer || !_scene || !_camera) return;

      /* Update planet positions (frozen under reduced-motion / pause) */
      const animate = !_paused && !_reducedMotion();
      PLANETS.forEach((p, i) => {
        if (animate) _angles[i] += 0.0003 * _speed * (365 / p.period);
        const mesh = _planetMeshes[i];
        if (mesh) {
          mesh.position.x = Math.cos(_angles[i]) * p.orbitR;
          mesh.position.z = Math.sin(_angles[i]) * p.orbitR;
          /* Spin about the planet's own (tilted) axis, preserving axial tilt. */
          if (animate) mesh.rotateY(0.002 * _speed);
        }
      });

      /* Position moons around their (now-moved) planets. */
      for (const mo of _moons) {
        const pm = _planetMeshes[mo.planetIdx];
        if (!pm) continue;
        if (animate) mo.angle += mo.speed * _speed * 0.1;
        mo.mesh.position.set(
          pm.position.x + Math.cos(mo.angle) * mo.dist,
          pm.position.y + Math.sin(mo.angle) * mo.dist * 0.18,
          pm.position.z + Math.sin(mo.angle) * mo.dist,
        );
      }

      /* Earth day/night: sun sits at the origin, so the direction to the Sun
         from Earth is simply -position. Update the shader's sun vector. */
      if (_earthDN && _earthMesh) {
        _earthDN.sunDir.value.set(-_earthMesh.position.x, -_earthMesh.position.y, -_earthMesh.position.z).normalize();
      }

      const t = performance.now() * 0.001;

      /* Subtle solar activity: corona gently breathes in scale + opacity. */
      if (_sunCorona) {
        const pulse = 1 + Math.sin(t * 1.3) * 0.04;
        _sunCorona.scale.setScalar(pulse);
        _sunCorona.material.opacity = 0.15 + Math.sin(t * 1.3) * 0.05;
      }

      /* Asteroid belt slowly precesses (visible only when animating). */
      if (_beltPoints && animate) _beltPoints.rotation.y += 0.00012 * _speed;

      /* Named asteroids orbit within the belt. */
      for (const as of _asteroids) {
        if (animate) { as.angle += as.speed * _speed; as.mesh.rotateY(0.004 * _speed); }
        as.mesh.position.set(Math.cos(as.angle) * as.orbitR, Math.sin(as.angle * 1.7) * 2, Math.sin(as.angle) * as.orbitR);
      }

      /* Earth satellites orbit the (now-moved) Earth on inclined planes. */
      if (_satellites.length) {
        const ei = PLANETS.findIndex(p => p.id === 'earth');
        const em = _planetMeshes[ei];
        if (em) {
          for (const s of _satellites) {
            if (animate) s.angle += s.speed * _speed;
            const cx = Math.cos(s.angle) * s.dist;
            const cz = Math.sin(s.angle) * s.dist;
            s.mesh.position.set(
              em.position.x + cx,
              em.position.y + Math.sin(s.angle) * s.dist * Math.sin(s.inc),
              em.position.z + cz * Math.cos(s.inc),
            );
          }
        }
      }

      /* Comets: glide along inclined ellipses; ion tail straight anti-sunward,
         dust tail wider and slightly fanned. Both fade with distance. */
      for (const cm of _comets) {
        if (animate) cm.angle += cm.speed * _speed;
        const a = cm.angle;
        const hx = Math.cos(a) * cm.a;
        const hz = Math.sin(a) * cm.b;
        const hy = Math.sin(a) * cm.a * cm.inc;
        cm.head.position.set(hx, hy, hz);
        const dir = cm.head.position.clone().normalize();   /* anti-sunward */
        /* Ion tail — narrow, straight. */
        const ip = cm.ion.geometry.attributes.position;
        for (let k = 0; k < cm.ionN; k++) {
          const f = k / cm.ionN;
          ip.setXYZ(k,
            hx + dir.x * f * cm.tailLen + (Math.random() - 0.5) * f * 3,
            hy + dir.y * f * cm.tailLen + (Math.random() - 0.5) * f * 3,
            hz + dir.z * f * cm.tailLen + (Math.random() - 0.5) * f * 3);
        }
        ip.needsUpdate = true;
        /* Dust tail — shorter, wider, curved opposite the motion direction. */
        const dp = cm.dust.geometry.attributes.position;
        const tang = new THREE.Vector3(-Math.sin(a) * cm.a, Math.cos(a) * cm.a * cm.inc, Math.cos(a) * cm.b).normalize();
        for (let k = 0; k < cm.dustN; k++) {
          const f = k / cm.dustN;
          dp.setXYZ(k,
            hx + dir.x * f * cm.tailLen * 0.8 - tang.x * f * cm.tailLen * 0.25 + (Math.random() - 0.5) * f * 6,
            hy + dir.y * f * cm.tailLen * 0.8 - tang.y * f * cm.tailLen * 0.25 + (Math.random() - 0.5) * f * 6,
            hz + dir.z * f * cm.tailLen * 0.8 - tang.z * f * cm.tailLen * 0.25 + (Math.random() - 0.5) * f * 6);
        }
        dp.needsUpdate = true;
      }

      /* Cinematic idle drift: while nothing is selected (and the user isn't
         dragging), slowly orbit the camera so the scene feels alive. */
      if (_sel === null && !_dragging && animate) {
        _camThetaT += 0.0006;
      }

      /* Lerp camera towards target */
      const lf = 0.06;
      _camDist   += (_camDistT   - _camDist)   * lf;
      _camTheta  += (_camThetaT  - _camTheta)  * lf;
      _camPhi    += (_camPhiT    - _camPhi)    * lf;
      _camFocusX += (_camFocusXT - _camFocusX) * lf;
      _camFocusY += (_camFocusYT - _camFocusY) * lf;
      _camFocusZ += (_camFocusZT - _camFocusZ) * lf;
      _updateCamera();
      _updateLabels();

      _renderer.render(_scene, _camera);
    }
    _raf = requestAnimationFrame(tick);
  }

  /* ═════════════════════════════ LABELS ════════════════════════════ */
  function _buildLabels(container) {
    const viewport = container.querySelector('#ss-viewport');
    if (!viewport) return;
    _labelEls = PLANETS.map(p => {
      const el = document.createElement('div');
      el.className = 'ss-planet-label';
      el.textContent = p.name;
      el.dataset.idx = PLANETS.indexOf(p);
      el.style.cssText = 'position:absolute;pointer-events:none;transform:translateX(-50%);white-space:nowrap;font-size:.7rem;font-family:var(--font-sans);font-weight:600;color:rgba(255,255,255,.7);text-shadow:0 1px 4px rgba(0,0,0,.8);transition:color .2s,font-size .15s;z-index:5;';
      viewport.appendChild(el);
      return el;
    });
    _sunLabelEl = document.createElement('div');
    _sunLabelEl.className = 'ss-planet-label';
    _sunLabelEl.textContent = '☀ Sol';
    _sunLabelEl.style.cssText = 'position:absolute;pointer-events:none;transform:translateX(-50%);white-space:nowrap;font-size:.75rem;font-family:var(--font-sans);font-weight:700;color:rgba(255,215,0,.9);text-shadow:0 1px 6px rgba(255,140,0,.6);z-index:5;';
    viewport.appendChild(_sunLabelEl);
  }

  function _updateLabels() {
    if (!_camera || !_renderer) return;
    const canvas = _renderer.domElement;
    const W = canvas.clientWidth  || canvas.width;
    const H = canvas.clientHeight || canvas.height;

    const project = (wx, wy, wz) => {
      const v = new THREE.Vector3(wx, wy, wz).project(_camera);
      return {
        x: (v.x * 0.5 + 0.5) * W,
        y: (-v.y * 0.5 + 0.5) * H,
        behind: v.z > 1,
      };
    };

    PLANETS.forEach((p, i) => {
      const el  = _labelEls[i];
      const mesh = _planetMeshes[i];
      if (!el || !mesh) return;
      const sc = project(mesh.position.x, mesh.position.y + p.displayR * 1.5, mesh.position.z);
      if (sc.behind) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = sc.x + 'px';
      el.style.top  = sc.y + 'px';
      const isHov = _hovered === i;
      el.style.color    = isHov ? p.color : 'rgba(255,255,255,.65)';
      el.style.fontSize = isHov ? '.8rem' : '.7rem';
    });

    if (_sunLabelEl && _sunMesh) {
      const sc = project(0, 10, 0);
      if (sc.behind) { _sunLabelEl.style.display = 'none'; }
      else {
        _sunLabelEl.style.display = '';
        _sunLabelEl.style.left = sc.x + 'px';
        _sunLabelEl.style.top  = sc.y + 'px';
      }
    }
  }

  /* Hover: raycasting on pointermove for glow effect */
  function _wireHover(container) {
    const viewport = container.querySelector('#ss-viewport');
    if (!viewport) return;
    viewport.addEventListener('pointermove', e => {
      if (_dragging || !_camera || !_renderer) return;
      const rect = _renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left)  / rect.width)  * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, _camera);

      const prevHov = _hovered;

      /* Check sun */
      if (ray.intersectObject(_sunMesh).length) {
        _hovered = 'sun';
        viewport.style.cursor = 'pointer';
      } else {
        const hits = ray.intersectObjects(_planetMeshes, false);
        if (hits.length) {
          _hovered = _planetMeshes.indexOf(hits[0].object);
          viewport.style.cursor = 'pointer';
        } else {
          _hovered = null;
          viewport.style.cursor = '';
        }
      }

      /* Apply/remove emissive glow */
      if (prevHov !== _hovered) {
        _planetMeshes.forEach((m, i) => {
          m.material.emissive?.set(new THREE.Color(PLANETS[i].color).multiplyScalar(_hovered === i ? 0.45 : 0.18));
        });
        if (_sunMesh) _sunMesh.material.color?.set(_hovered === 'sun' ? 0xffee44 : 0xffd700);
      }
    });
  }

  /* ═════════════════════════════ POINTER ════════════════════════════ */
  function _wirePointer(container) {
    const viewport = container.querySelector('#ss-viewport');
    if (!viewport) return;
    const canvas = () => viewport.querySelector('canvas');

    /* Drag to orbit */
    viewport.addEventListener('mousedown', e => {
      _dragging = true; _lastX = e.clientX; _lastY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!_dragging) return;
      const dx = e.clientX - _lastX;
      const dy = e.clientY - _lastY;
      _camThetaT += dx * 0.005;
      _camPhiT    = Math.max(0.2, Math.min(Math.PI - 0.2, _camPhiT + dy * 0.005));
      _lastX = e.clientX; _lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { _dragging = false; });

    /* Touch: one finger orbits, two fingers pinch-to-zoom. */
    let _pinch = 0;
    const _dist2 = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        _dragging = true; _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        _dragging = false; _pinch = _dist2(e);
      }
    }, { passive: true });
    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && _pinch) {
        const d = _dist2(e);
        _camDistT = Math.max(20, Math.min(600, _camDistT * (_pinch / d)));
        _pinch = d; return;
      }
      if (!_dragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - _lastX;
      const dy = e.touches[0].clientY - _lastY;
      _camThetaT += dx * 0.005;
      _camPhiT    = Math.max(0.2, Math.min(Math.PI - 0.2, _camPhiT + dy * 0.005));
      _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', e => { _dragging = false; if (e.touches.length < 2) _pinch = 0; });

    /* Scroll to zoom */
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      _camDistT = Math.max(20, Math.min(600, _camDistT + e.deltaY * 0.3));
    }, { passive: false });

    /* Click: pick planet */
    viewport.addEventListener('click', e => {
      if (_dragging) return;
      const cvs = canvas();
      if (!cvs) return;
      const rect = cvs.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(mouse, _camera);

      /* Check sun */
      const sunHits = ray.intersectObject(_sunMesh);
      if (sunHits.length) {
        _sel = 'sun';
        _focusSun();
        _openPanel(SUN, container);
        return;
      }

      /* Check moons (small, in front of their planet) */
      if (_moons.length) {
        const moonHits = ray.intersectObjects(_moons.map(m => m.mesh), false);
        if (moonHits.length) {
          const mo = _moons.find(m => m.mesh === moonHits[0].object);
          if (mo) { _openMoonPanel(mo, container); return; }
        }
      }

      /* Check Earth satellites (ISS, Hubble) — models are Groups, so recurse
         and match the hit back to its owning satellite group. */
      if (_satellites.length) {
        const satHits = ray.intersectObjects(_satellites.map(s => s.mesh), true);
        if (satHits.length) {
          let o = satHits[0].object; while (o && o.userData?.satId == null && o.parent) o = o.parent;
          const s = _satellites.find(x => x.mesh === o);
          if (s) {
            _sel = 'other';
            const ei = PLANETS.findIndex(p => p.id === 'earth');
            _focusPlanet(ei);
            _openPanel({ ...s.data, color: '#' + s.data.color.toString(16).padStart(6, '0') }, container);
            return;
          }
        }
      }

      /* Check comets (nucleus meshes) */
      if (_comets.length) {
        const cHits = ray.intersectObjects(_comets.map(c => c.head), false);
        if (cHits.length) {
          const cm = _comets.find(x => x.head === cHits[0].object);
          if (cm) {
            _sel = 'other';
            const h = cm.head.position;
            _focusVec(h.x, h.y, h.z, 90);
            _openPanel(cm.data, container);
            return;
          }
        }
      }

      /* Check named asteroids (Ceres, Vesta…) */
      if (_asteroids.length) {
        const aHits = ray.intersectObjects(_asteroids.map(a => a.mesh), false);
        if (aHits.length) {
          const as = _asteroids.find(x => x.mesh === aHits[0].object);
          if (as) {
            _sel = 'other';
            const p = as.mesh.position;
            _focusVec(p.x, p.y, p.z, 42);
            _openPanel(as.data, container);
            return;
          }
        }
      }

      /* Check planets */
      const planetHits = ray.intersectObjects(_planetMeshes, false);
      if (planetHits.length) {
        const idx = _planetMeshes.indexOf(planetHits[0].object);
        if (idx >= 0) {
          _sel = idx;
          _focusPlanet(idx);
          _openPanel(PLANETS[idx], container);
          return;
        }
      }

      /* Click empty: deselect */
      _sel = null; _selMoon = null; _selBody = null;
      container.querySelector('#ss-panel')?.classList.remove('open');
    });
  }

  /* ═════════════════════════════ CONTROLS ═══════════════════════════ */
  function _wireControls(container) {
    container.querySelector('#ss-slower').onclick = () => {
      _speed = Math.max(0.25, _speed / 2);
      _updateSpeedLabel(container);
    };
    container.querySelector('#ss-faster').onclick = () => {
      _speed = Math.min(1000, _speed * 2);
      _updateSpeedLabel(container);
    };
    container.querySelector('#ss-orbits').onclick = e => {
      _orbitsVisible = !_orbitsVisible;
      _orbitLines.forEach(l => { l.visible = _orbitsVisible; });
      e.currentTarget.classList.toggle('active', _orbitsVisible);
    };
    container.querySelector('#ss-clouds').onclick = e => {
      _cloudsOn = !_cloudsOn;
      if (_earthClouds && _earthClouds.material.map) _earthClouds.visible = _cloudsOn;
      e.currentTarget.classList.toggle('active', _cloudsOn);
    };
    container.querySelector('#ss-zoom-in').onclick  = () => { _camDistT = Math.max(20, _camDistT * 0.7); };
    container.querySelector('#ss-zoom-out').onclick = () => { _camDistT = Math.min(600, _camDistT * 1.4); };
    container.querySelector('#ss-reset').onclick = () => {
      _angles   = PLANETS.map(() => Math.random() * Math.PI * 2);
      _speed    = 1;
      _camThetaT = 0.3; _camPhiT = 1.1; _camDistT = 280;
      _camFocusXT = 0; _camFocusYT = 0; _camFocusZT = 0;
      _sel = null; _selBody = null;
      container.querySelector('#ss-panel')?.classList.remove('open');
      _updateSpeedLabel(container);
    };
    container.querySelector('#ss-pause').onclick = e => {
      _paused = !_paused;
      e.currentTarget.textContent = _paused ? '▶' : '⏸';
    };
  }

  function _updateSpeedLabel(container) {
    const el = container.querySelector('#ss-speed');
    if (el) el.textContent = `${_speed}×`;
  }

  /* ═════════════════════════════ PANEL ══════════════════════════════ */
  function _wirePanelTabs(container) {
    container.addEventListener('click', e => {
      const tab = e.target.closest('.ex-solar-panel-tab');
      if (!tab) return;
      container.querySelectorAll('.ex-solar-panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _curTab = tab.dataset.tab;
      _renderPanelBody(container);
    });
    const closeBtn = container.querySelector('#ss-panel-close');
    if (closeBtn) closeBtn.onclick = () => {
      _sel = null; _selMoon = null; _selBody = null;
      const tabs = container.querySelector('#ss-panel-tabs');
      if (tabs) tabs.style.display = '';   /* restore for next planet/sun */
      container.querySelector('#ss-panel')?.classList.remove('open');
    };
  }

  /* Simple info panel for a clicked moon (no tabs — focuses its planet). */
  function _openMoonPanel(mo, container) {
    _sel = null; _selMoon = mo;
    const hint = container.querySelector('#ss-hint');
    if (hint) hint.style.display = 'none';
    const panel = container.querySelector('#ss-panel');
    if (!panel) return;
    panel.classList.add('open');
    const tabs = container.querySelector('#ss-panel-tabs');
    if (tabs) tabs.style.display = 'none';
    _focusPlanet(mo.planetIdx);   /* bring its planet into view so the moon is visible */
    const planet = PLANETS[mo.planetIdx];
    _renderPanelHeader({ name: mo.data.name, color: '#' + mo.color.toString(16).padStart(6, '0'), info: { type: `Lua de ${planet.name}` } }, container);
    const b = container.querySelector('#ss-panel-body');
    if (b) b.innerHTML = `<div class="ex-solar-overview">
      <div class="ex-solar-info-row"><span class="ex-solar-info-label">Planeta</span><span>${planet.name}</span></div>
      <div class="ex-solar-info-row"><span class="ex-solar-info-label">Distância ao planeta</span><span>${mo.data.dist}</span></div>
      <div class="ex-solar-info-row"><span class="ex-solar-info-label">Período orbital</span><span>${mo.data.period}</span></div>
      <div class="ex-solar-info-row"><span class="ex-solar-info-label">Raio</span><span>${mo.data.r}</span></div>
    </div>`;
  }

  function _openPanel(body, container) {
    _selMoon = null;
    _selBody = body;
    const hint = container.querySelector('#ss-hint');
    if (hint) hint.style.display = 'none';
    const panel = container.querySelector('#ss-panel');
    if (!panel) return;
    panel.classList.add('open');
    const tabs = container.querySelector('#ss-panel-tabs');
    if (tabs) tabs.style.display = '';   /* restore tabs (hidden by moon panel) */
    _curTab = 'overview';
    container.querySelectorAll('.ex-solar-panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'overview'));
    const moonTab    = panel.querySelector('[data-tab="moons"]');
    const compareTab = panel.querySelector('[data-tab="compare"]');
    const explTab    = panel.querySelector('[data-tab="exploration"]');
    if (moonTab)    moonTab.style.display    = body.moonList !== undefined ? '' : 'none';
    if (compareTab) compareTab.style.display = body.compare  !== undefined ? '' : 'none';
    const missionKey = (body === SUN) ? 'sun' : body.id;
    if (explTab)    explTab.style.display    = (MISSIONS[missionKey] ? '' : 'none');
    _renderPanelHeader(body, container);
    _renderPanelBody(container);
  }

  function _renderPanelHeader(body, container) {
    const el = container.querySelector('#ss-panel-header');
    if (!el) return;
    el.innerHTML = `
      <div class="ex-solar-panel-color" style="background:${body.color || '#ffd700'}"></div>
      <div>
        <div class="ex-solar-panel-name">${body.name}</div>
        ${body.info?.type ? `<div class="ex-solar-panel-type">${body.info.type}</div>` : ''}
      </div>`;
  }

  /* Verified space-mission history per body (well-known facts). */
  const MISSIONS = {
    sun: ['SOHO (NASA/ESA) — observatório solar desde 1995', 'Parker Solar Probe (NASA) — a sonda que mais se aproxima da coroa solar', 'Solar Orbiter (ESA/NASA) — imagens de perto, incluindo os polos'],
    mercury: ['Mariner 10 (NASA, 1974–75) — primeiras imagens de perto', 'MESSENGER (NASA) — em órbita 2011–2015', 'BepiColombo (ESA/JAXA) — a caminho, chegada prevista 2026'],
    venus: ['Mariner 2 (NASA, 1962) — 1ª sonda a passar por outro planeta', 'Programa Venera (URSS) — pousagens na superfície nos anos 1970', 'Magellan (NASA) — mapeamento por radar (1990–94)', 'Akatsuki (JAXA) — em órbita desde 2015'],
    earth: ['Milhares de satélites em órbita terrestre', 'Estação Espacial Internacional (ISS) — tripulada desde 2000', 'Programa Apollo — única presença humana fora da Terra (na Lua, 1969–72)'],
    mars: ['Viking 1 e 2 (NASA, 1976) — primeiras pousagens bem-sucedidas', 'Curiosity (NASA) — rover desde 2012', 'Perseverance + helicóptero Ingenuity (NASA) — desde 2021', 'Mars Express (ESA), Hope (EAU), Tianwen-1 (China)'],
    jupiter: ['Pioneer 10/11 e Voyager 1/2 — sobrevoos nos anos 1970', 'Galileo (NASA) — em órbita 1995–2003, com sonda atmosférica', 'Juno (NASA) — em órbita desde 2016', 'JUICE (ESA) e Europa Clipper (NASA) — a caminho das luas geladas'],
    saturn: ['Pioneer 11 e Voyager 1/2 — sobrevoos', 'Cassini–Huygens (NASA/ESA) — em órbita 2004–2017', 'Huygens (ESA) — pousou em Titã em 2005, a pousagem mais distante de sempre'],
    uranus: ['Voyager 2 (NASA, 1986) — a única nave a visitar Urano'],
    neptune: ['Voyager 2 (NASA, 1989) — a única nave a visitar Neptuno'],
    /* Comets */
    halley: ['Giotto (ESA, 1986) — passou a ~600 km do núcleo', '"Armada do Halley": Vega 1/2 (URSS) e Suisei/Sakigake (Japão)'],
    churyumov: ['Rosetta (ESA) — primeira sonda a orbitar um cometa (2014–2016)', 'Philae (ESA) — primeiro módulo a pousar num núcleo cometário (2014)'],
    encke: ['Observado por inúmeras campanhas terrestres e pela sonda Deep Impact (2007)'],
    /* Large asteroids */
    ceres: ['Dawn (NASA) — em órbita 2015–2018, com motor iónico'],
    vesta: ['Dawn (NASA) — em órbita 2011–2012'],
  };

  function _renderPanelBody(container) {
    const bodyEl = container.querySelector('#ss-panel-body');
    if (!bodyEl) return;
    const body = _selBody;
    if (!body) return;

    if (_curTab === 'overview') {
      const LABELS = {
        dist: 'Distância ao Sol', radius: 'Raio médio', mass: 'Massa',
        period: 'Período orbital', day: 'Duração do dia',
        temp: 'Temperatura', moons: 'Nº de luas', gravity: 'Gravidade superficial',
        atmos: 'Atmosfera', type: 'Tipo', age: 'Idade',
        perihelion: 'Periélio (mín.)', aphelion: 'Afélio (máx.)', nucleus: 'Núcleo',
        composition: 'Composição', origin: 'Origem', lastSeen: 'Última passagem',
        nextSeen: 'Próxima passagem', speed: 'Velocidade', crew: 'Tripulação',
        launch: 'Lançamento', operator: 'Operador',
      };
      const rows = Object.entries(body.info).map(([k, v]) =>
        `<div class="ex-solar-info-row">
           <span class="ex-solar-info-label">${LABELS[k] || k}</span>
           <span>${v}</span>
         </div>`
      ).join('');
      bodyEl.innerHTML = `<div class="ex-solar-overview">${rows}</div>`;

    } else if (_curTab === 'moons') {
      if (!body.moonList?.length) {
        bodyEl.innerHTML = `<div class="ex-solar-empty">Este corpo não tem luas conhecidas.</div>`;
        return;
      }
      const items = body.moonList.map(m => `
        <div class="ex-solar-moon-item">
          <div class="ex-solar-moon-name">${m.name}</div>
          <div class="ex-solar-moon-stats">
            <span>Dist: ${m.dist}</span>
            <span>Período: ${m.period}</span>
            <span>Raio: ${m.r}</span>
          </div>
        </div>`).join('');
      const total = parseInt(body.info?.moons || 0);
      const more  = total > body.moonList.length
        ? `<div class="ex-solar-moons-more">+ ${total - body.moonList.length} luas menores catalogadas</div>` : '';
      bodyEl.innerHTML = `<div class="ex-solar-moons">${items}${more}</div>`;

    } else if (_curTab === 'exploration') {
      const key = (body === SUN) ? 'sun' : body.id;
      const list = MISSIONS[key] || [];
      const items = list.map(m => `<div class="ex-solar-fact-item">🛰 ${m}</div>`).join('');
      bodyEl.innerHTML = `<div class="ex-solar-facts">${items || '<div class="ex-solar-empty">Sem missões registadas.</div>'}</div>`;

    } else if (_curTab === 'facts') {
      const items = (body.facts || []).map(f => `<div class="ex-solar-fact-item">${f}</div>`).join('');
      bodyEl.innerHTML = `<div class="ex-solar-facts">${items || '<div class="ex-solar-empty">Sem dados disponíveis.</div>'}</div>`;

    } else if (_curTab === 'compare') {
      const c = body.compare;
      if (!c) { bodyEl.innerHTML = ''; return; }
      const bars = [
        { label: 'Tamanho (raio)', val: c.size,     unit: '× Terra', max: 12,  decimals: 2 },
        { label: 'Gravidade',      val: c.gravity,   unit: '× Terra', max: 3,   decimals: 2 },
        { label: 'Distância Sol',  val: c.distance,  unit: ' UA',     max: 32,  decimals: 1 },
        { label: 'Ano planetário', val: c.period,    unit: ' anos T.', max: 180, decimals: 2 },
      ].map(b => {
        const pct      = Math.min(100, (b.val / b.max) * 100).toFixed(1);
        const earthPct = Math.min(100, (1 / b.max) * 100).toFixed(1);
        return `<div class="ex-solar-bar-item">
          <div class="ex-solar-bar-label">${b.label}</div>
          <div class="ex-solar-bar-track">
            <div class="ex-solar-bar-fill" style="width:${pct}%;background:${body.color || '#ffd700'}88"></div>
            <div class="ex-solar-bar-earth" style="left:${earthPct}%" title="Terra"></div>
          </div>
          <div class="ex-solar-bar-val">${b.val}${b.unit}</div>
        </div>`;
      }).join('');
      bodyEl.innerHTML = `<div class="ex-solar-compare">
        <div class="ex-solar-compare-legend">
          <span class="ex-solar-compare-dot" style="background:${body.color || '#ffd700'}88"></span>${body.name}
          <span class="ex-solar-compare-dot earth"></span>Terra
        </div>
        ${bars}
      </div>`;
    }
  }

  return { mount, resume, stop };
})();
