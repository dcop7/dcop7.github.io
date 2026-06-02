/* ══════════════════════════════════════════════════════════════════
   MILKY WAY EXPLORER — Three.js 3D galaxy: spiral arms, the Sun's
   position, notable stars/constellations, nearby galaxies and nebulae.
   Sibling of SolarExplorer; reuses the .ex-solar-* CSS for panel/controls.
══════════════════════════════════════════════════════════════════ */
const MilkyWayExplorer = (function () {
  'use strict';

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.min.js';

  /* ── The Milky Way itself (clicking the galactic core) ── */
  const GALAXY = {
    id: 'milkyway', name: 'Via Láctea', color: '#ffe2a8',
    info: { type: 'Galáxia espiral barrada', diameter: '~100 000 anos-luz', stars: '100–400 mil milhões', age: '~13,6 mil M anos', center: 'Sagittarius A* (buraco negro)', satellites: '~60 galáxias satélite' },
    facts: [
      'A nossa galáxia — uma espiral barrada com quatro braços principais.',
      'No centro está Sagittarius A*, um buraco negro supermassivo com ~4 milhões de massas solares.',
      'O Sol leva cerca de 225–250 milhões de anos a dar uma volta ao centro (um "ano galáctico").',
      'Faz parte do Grupo Local e irá fundir-se com Andrómeda dentro de ~4,5 mil milhões de anos.',
    ],
  };

  const SUN = {
    id: 'sun', name: 'Sol (Sistema Solar)', color: '#ffd24a', type: 'star',
    info: { type: 'Estrela G2V', location: 'Braço de Órion', distCenter: '~27 000 anos-luz', galacticYear: '~225 M anos', speed: '~828 000 km/h' },
    facts: [
      'A nossa estrela situa-se num braço secundário — o Braço de Órion (ou Local).',
      'Move-se a cerca de 230 km/s em torno do centro galáctico.',
      'Está a cerca de metade do raio do disco galáctico, longe do centro turbulento.',
    ],
  };

  /* Notable stars (each tagged with the constellation it belongs to). */
  const STARS = [
    { id: 'sirius', name: 'Sírio', constellation: 'Cão Maior', color: '#cfe5ff', type: 'star',
      info: { type: 'Estrela (sistema binário)', constellation: 'Cão Maior (Canis Major)', dist: '8,6 anos-luz', magnitude: '−1,46 (a mais brilhante)' },
      facts: ['A estrela mais brilhante do céu noturno.', 'Tem uma companheira anã branca, Sírio B.', 'Os egípcios baseavam o calendário no seu nascer heliacal.'] },
    { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orionte', color: '#ff9a5a', type: 'star',
      info: { type: 'Supergigante vermelha', constellation: 'Orionte (Orion)', dist: '~640 anos-luz', size: '~700× o raio do Sol' },
      facts: ['Marca o "ombro" de Orionte.', 'É candidata a explodir como supernova (em termos astronómicos, "em breve").', 'Em 2019–20 escureceu subitamente, por uma nuvem de poeira que expeliu.'] },
    { id: 'rigel', name: 'Rigel', constellation: 'Orionte', color: '#a9c7ff', type: 'star',
      info: { type: 'Supergigante azul', constellation: 'Orionte (Orion)', dist: '~860 anos-luz', luminosity: '~120 000× o Sol' },
      facts: ['Marca o "pé" de Orionte e é uma das estrelas mais luminosas conhecidas.'] },
    { id: 'vega', name: 'Vega', constellation: 'Lira', color: '#dbe8ff', type: 'star',
      info: { type: 'Estrela branca', constellation: 'Lira (Lyra)', dist: '25 anos-luz', magnitude: '0,03' },
      facts: ['Foi a estrela do norte há ~12 000 anos e voltará a sê-lo daqui a ~13 000.', 'Serve de referência para a escala de brilho das estrelas.'] },
    { id: 'polaris', name: 'Polaris (Estrela Polar)', constellation: 'Ursa Menor', color: '#fff3d6', type: 'star',
      info: { type: 'Supergigante (Cefeida)', constellation: 'Ursa Menor', dist: '~430 anos-luz', role: 'Estrela do Norte atual' },
      facts: ['Aponta quase exatamente para o polo norte celeste.', 'Por isso parece fixa enquanto o céu roda à sua volta.'] },
    { id: 'antares', name: 'Antares', constellation: 'Escorpião', color: '#ff7e5a', type: 'star',
      info: { type: 'Supergigante vermelha', constellation: 'Escorpião (Scorpius)', dist: '~550 anos-luz', size: '~700× o Sol' },
      facts: ['O seu nome significa "rival de Marte", pela cor avermelhada.', 'Marca o "coração" do Escorpião.'] },
    { id: 'proxima', name: 'Próxima Centauri', constellation: 'Centauro', color: '#ff8a6a', type: 'star',
      info: { type: 'Anã vermelha', constellation: 'Centauro', dist: '4,24 anos-luz (a mais próxima)', planets: 'Pelo menos 2 (incl. Proxima b)' },
      facts: ['A estrela mais próxima do Sol.', 'Tem um planeta na zona habitável, Proxima b.', 'Faz parte do sistema triplo Alpha Centauri.'] },
    { id: 'aldebaran', name: 'Aldebarã', constellation: 'Touro', color: '#ffb27a', type: 'star',
      info: { type: 'Gigante laranja', constellation: 'Touro (Taurus)', dist: '65 anos-luz' },
      facts: ['O "olho" do Touro.', 'Foi sobrevoada (à distância) pela sonda Pioneer 10, que a alcançará em ~2 M anos.'] },
  ];

  /* Other galaxies (placed beyond the Milky Way disc). */
  const GALAXIES = [
    { id: 'andromeda', name: 'Andrómeda (M31)', color: '#cdd9ff', type: 'galaxy',
      info: { type: 'Galáxia espiral', dist: '2,5 M anos-luz', diameter: '~220 000 anos-luz', stars: '~1 bilião' },
      facts: ['A galáxia grande mais próxima e o objeto mais distante visível a olho nu.', 'Aproxima-se de nós a 110 km/s — fundir-se-á com a Via Láctea.', 'É maior do que a nossa galáxia.'] },
    { id: 'triangulum', name: 'Triângulo (M33)', color: '#bfe0ff', type: 'galaxy',
      info: { type: 'Galáxia espiral', dist: '2,7 M anos-luz', diameter: '~60 000 anos-luz' },
      facts: ['A terceira maior galáxia do Grupo Local.', 'Em céus muito escuros pode ser vista a olho nu.'] },
    { id: 'lmc', name: 'Grande Nuvem de Magalhães', color: '#dfe6ff', type: 'galaxy',
      info: { type: 'Galáxia anã (satélite)', dist: '160 000 anos-luz', diameter: '~14 000 anos-luz' },
      facts: ['Galáxia satélite da Via Láctea, visível do hemisfério sul.', 'Alberga a Nebulosa da Tarântula, a maior região de formação estelar conhecida.'] },
    { id: 'smc', name: 'Pequena Nuvem de Magalhães', color: '#e6ecff', type: 'galaxy',
      info: { type: 'Galáxia anã (satélite)', dist: '200 000 anos-luz', diameter: '~7 000 anos-luz' },
      facts: ['A companheira mais pequena da Grande Nuvem de Magalhães.', 'Ajudou Henrietta Leavitt a descobrir a relação período–luminosidade das Cefeidas.'] },
    { id: 'whirlpool', name: 'Rodamoinho (M51)', color: '#cfe2ff', type: 'galaxy',
      info: { type: 'Galáxia espiral', dist: '23 M anos-luz', diameter: '~76 000 anos-luz' },
      facts: ['A primeira galáxia onde se reconheceu a estrutura espiral.', 'Interage com uma galáxia companheira mais pequena.'] },
    { id: 'sombrero', name: 'Sombreiro (M104)', color: '#ffe8c4', type: 'galaxy',
      info: { type: 'Galáxia espiral/lenticular', dist: '31 M anos-luz', diameter: '~50 000 anos-luz' },
      facts: ['A faixa de poeira que a atravessa dá-lhe a forma de um chapéu.', 'Tem um buraco negro central de ~1 mil milhões de massas solares.'] },
  ];

  /* Nebulae (placed within the galactic disc). */
  const NEBULAE = [
    { id: 'orion', name: 'Nebulosa de Órion (M42)', color: '#ff9ad2', type: 'nebula',
      info: { type: 'Nebulosa de emissão', dist: '1 344 anos-luz', diameter: '~24 anos-luz' },
      facts: ['Um berçário estelar visível a olho nu, na "espada" de Orionte.', 'Nela nascem milhares de estrelas novas.'] },
    { id: 'crab', name: 'Nebulosa do Caranguejo (M1)', color: '#a0e0ff', type: 'nebula',
      info: { type: 'Remanescente de supernova', dist: '6 500 anos-luz', age: '~970 anos' },
      facts: ['Os restos de uma supernova observada e registada em 1054.', 'No centro há um pulsar que gira 30 vezes por segundo.'] },
    { id: 'eagle', name: 'Nebulosa da Águia (M16)', color: '#b6ffce', type: 'nebula',
      info: { type: 'Região de formação estelar', dist: '5 700 anos-luz' },
      facts: ['Contém os "Pilares da Criação", imortalizados pelo Hubble.', 'Colunas de gás onde estão a nascer novas estrelas.'] },
    { id: 'ring', name: 'Nebulosa do Anel (M57)', color: '#9affd6', type: 'nebula',
      info: { type: 'Nebulosa planetária', dist: '2 300 anos-luz' },
      facts: ['O invólucro de gás expelido por uma estrela moribunda como o Sol.', 'Mostra o futuro distante do nosso próprio Sol.'] },
    { id: 'lagoon', name: 'Nebulosa da Lagoa (M8)', color: '#ffb0c4', type: 'nebula',
      info: { type: 'Nebulosa de emissão', dist: '4 100 anos-luz' },
      facts: ['Uma das poucas regiões de formação estelar visíveis a olho nu.', 'Situa-se na direção do centro galáctico, na constelação do Sagitário.'] },
  ];

  /* ── State ── */
  let _renderer = null, _scene = null, _camera = null, _raf = null;
  let _mounted = false, _container = null;
  let _glowTex = null;
  let _markers = [];        /* {mesh, data, type, pos, labelEl} */
  let _galaxyPoints = null;
  let _spinLayers = [];     /* everything that co-rotates with the disc */
  let _coreSprites = [];    /* layered core glow sprites (pulsing) */
  let _coreGlow = null;
  let _selBody = null;
  let _curTab = 'overview';
  let _rotate = true;
  let _labelsOn = true;

  /* Camera orbit (same scheme as the solar explorer) */
  let _camTheta = 0.6, _camPhi = 0.85, _camDist = 460;
  let _camThetaT = 0.6, _camPhiT = 0.85, _camDistT = 460;
  let _fx = 0, _fy = 0, _fz = 0, _fxT = 0, _fyT = 0, _fzT = 0;
  let _dragging = false, _lastX = 0, _lastY = 0;
  let _hovered = null;

  function _reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
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
        <div class="ex-solar-viewport" id="gx-viewport"></div>
        <div class="ex-solar-loading" id="gx-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-solar-loading-txt">A inicializar a Via Láctea 3D…</div>
        </div>
        <div class="ex-solar-controls">
          <button class="ex-solar-btn active" id="gx-rotate" title="Rotação automática">⟳</button>
          <button class="ex-solar-btn active" id="gx-labels" title="Mostrar/ocultar nomes">🏷</button>
          <div class="ex-solar-divider"></div>
          <button class="ex-solar-btn" id="gx-zoom-out" title="Afastar">−</button>
          <button class="ex-solar-btn" id="gx-zoom-in"  title="Aproximar">+</button>
          <button class="ex-solar-btn" id="gx-reset"    title="Repor">↺</button>
        </div>
        <div class="ex-solar-panel" id="gx-panel">
          <button class="ex-solar-panel-close" id="gx-panel-close" title="Fechar">✕</button>
          <div class="ex-solar-panel-header" id="gx-panel-header"></div>
          <div class="ex-solar-panel-tabs" id="gx-panel-tabs">
            <button class="ex-solar-panel-tab active" data-tab="overview">Geral</button>
            <button class="ex-solar-panel-tab" data-tab="facts">Curiosidades</button>
          </div>
          <div class="ex-solar-panel-body" id="gx-panel-body"></div>
        </div>
        <div class="ex-solar-hint" id="gx-hint">Selecciona um objeto · Arrasta para rodar · Scroll para zoom</div>
        <div class="ex-solar-credit">Distâncias e dados: valores astronómicos aproximados</div>
      </div>`;

    _mounted = true;
    _wireControls(container);
    _wirePanel(container);

    try {
      await _loadScript(THREE_CDN);
    } catch (e) {
      const ld = document.getElementById('gx-loading');
      if (ld) ld.innerHTML = `<div class="ex-error-icon">⚠</div><div class="ex-error-msg">Erro ao carregar Three.js.</div>`;
      return;
    }

    _buildScene(container);
    _buildLabels(container);
    document.getElementById('gx-loading')?.remove();
    _wirePointer(container);
    _start();
  }

  function resume() { if (!_raf && _mounted) _start(); }
  function stop() { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } }

  /* ═════════════════════════════ TEXTURES ═══════════════════════════ */
  function _glowTexture() {
    if (_glowTex) return _glowTex;
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _glowTex = new THREE.CanvasTexture(cv);
    return _glowTex;
  }

  /* ═════════════════════════════ SCENE ══════════════════════════════ */
  const GAL_R = 200;   /* galactic disc radius in scene units */

  function _buildScene(container) {
    const viewport = container.querySelector('#gx-viewport');
    const W = viewport.clientWidth || 800, H = viewport.clientHeight || 600;
    _markers = []; _spinLayers = []; _coreSprites = [];

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x03040a, 1);
    viewport.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x03040a);

    /* Distant background starfield. */
    const bgN = 6000, bgPos = new Float32Array(bgN * 3), bgCol = new Float32Array(bgN * 3);
    const sc = new THREE.Color();
    for (let i = 0; i < bgN; i++) {
      const r = 700 + Math.random() * 800, a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
      bgPos[i * 3]     = Math.cos(a) * Math.cos(e) * r;
      bgPos[i * 3 + 1] = Math.sin(e) * r;
      bgPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      /* faint colour scatter: mostly white, a few warm/cool stars. */
      const h = Math.random() < 0.85 ? 0 : (Math.random() < 0.5 ? 0.08 : 0.6);
      sc.setHSL(h, h ? 0.5 : 0, 0.7 + Math.random() * 0.3);
      bgCol[i * 3] = sc.r; bgCol[i * 3 + 1] = sc.g; bgCol[i * 3 + 2] = sc.b;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol, 3));
    _scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({ map: _glowTexture(), size: 2.2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));

    _scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    _camera = new THREE.PerspectiveCamera(55, W / H, 0.5, 5000);
    _updateCamera();

    _buildGalaxyHaze();
    _buildGalaxyDisc();
    _buildArmDust();
    _buildHIIRegions();
    _buildCoreGlow();
    _placeMarkers();

    new ResizeObserver(() => {
      if (!_renderer || !_camera) return;
      const el = container.querySelector('#gx-viewport');
      if (!el) return;
      const w = el.clientWidth, h = el.clientHeight;
      _camera.aspect = w / h; _camera.updateProjectionMatrix();
      _renderer.setSize(w, h);
    }).observe(viewport);
  }

  /* Gaussian-ish random in [-1,1] (sum of uniforms) — gives arms a soft, dense
     centre line that fades outward, rather than a uniform fuzzy band. */
  function _g() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  /* A soft round sprite (for nebula knots / haze), cached per-colour-less use. */
  function _sprite(color, scale, opacity, blend) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _glowTexture(), color, transparent: true, opacity,
      blending: blend == null ? THREE.AdditiveBlending : blend, depthWrite: false,
    }));
    sp.scale.setScalar(scale);
    return sp;
  }

  /* Procedural barred-spiral. A dense bulge, a central bar, and two main +
     two secondary logarithmic arms drawn as tight log spirals with a soft
     Gaussian cross-section. Two star layers (fine haze + sparse bright stars)
     give the disc depth; colours run warm-core → blue-white outer arms. */
  function _buildGalaxyDisc() {
    const cCore = new THREE.Color('#fff0c8'), cMid = new THREE.Color('#ffd2a0'),
          cArm = new THREE.Color('#bcd2ff'), cEdge = new THREE.Color('#8fb4ff');
    const tmp = new THREE.Color();
    /* main arms get more stars; secondaries are fainter. */
    const ARMS = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
    const ARM_W = [0.34, 0.34, 0.5, 0.5];   /* angular half-width of each arm */
    const WIND = 2.9;                         /* spiral tightness (b in r=e^(bθ)) */

    function fill(geo, N, sizeBias, brightness) {
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        let r, ang, t;
        const roll = Math.random();
        if (roll < 0.16) {
          /* Central bulge (slightly flattened, spheroidal) — spread out a bit
             so it reads as a glowing core rather than a blown-out white disc. */
          r = Math.pow(Math.random(), 1.4) * GAL_R * 0.3;
          ang = Math.random() * Math.PI * 2; t = r / GAL_R;
        } else if (roll < 0.26) {
          /* Central bar across the bulge. */
          const along = (Math.random() - 0.5) * GAL_R * 0.5;
          const wide = _g() * GAL_R * 0.06;
          const barA = 0.5;                    /* bar position angle */
          r = Math.hypot(along, wide);
          ang = Math.atan2(wide, along) + barA; t = r / GAL_R;
        } else {
          /* Spiral arm. */
          const ai = i % ARMS.length;
          t = Math.pow(Math.random(), 0.85);
          r = 16 + t * (GAL_R - 16);
          const base = ARMS[ai] + Math.log(r / 16) * WIND / 2.9;
          ang = base + _g() * ARM_W[ai] * (1 - t * 0.45);
        }
        const thick = (roll < 0.16 ? 16 : 5.5) * (1 - t * 0.7);
        pos[i * 3]     = Math.cos(ang) * r;
        pos[i * 3 + 1] = _g() * thick;
        pos[i * 3 + 2] = Math.sin(ang) * r;
        /* Colour by radius, with occasional warmer/cooler stars. */
        if (t < 0.18) tmp.copy(cCore);
        else if (t < 0.45) tmp.copy(cMid).lerp(cArm, (t - 0.18) / 0.27);
        else tmp.copy(cArm).lerp(cEdge, Math.min(1, (t - 0.45) / 0.55));
        const tw = (0.6 + Math.random() * 0.4) * brightness;
        col[i * 3] = tmp.r * tw; col[i * 3 + 1] = tmp.g * tw; col[i * 3 + 2] = tmp.b * tw;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }

    /* Layer 1 — dense fine haze (the bulk of the disc). */
    const g1 = new THREE.BufferGeometry(); fill(g1, 60000, 0, 0.85);
    _galaxyPoints = new THREE.Points(g1, new THREE.PointsMaterial({
      size: 1.1, sizeAttenuation: true, vertexColors: true, map: _glowTexture(),
      transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    _scene.add(_galaxyPoints); _spinLayers.push(_galaxyPoints);

    /* Layer 2 — sparse bright resolved stars (adds sparkle + depth). */
    const g2 = new THREE.BufferGeometry(); fill(g2, 9000, 0, 1.25);
    const bright = new THREE.Points(g2, new THREE.PointsMaterial({
      size: 2.6, sizeAttenuation: true, vertexColors: true, map: _glowTexture(),
      transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    _scene.add(bright); _spinLayers.push(bright);
  }

  /* Reddish-brown dust threaded between the arms — subtle additive tint that
     reads as the galaxy's dust lanes against the dark background. */
  function _buildArmDust() {
    const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const ARMS = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
    const cDust = new THREE.Color('#7a4a36');
    for (let i = 0; i < N; i++) {
      const ai = i % ARMS.length;
      const t = Math.pow(Math.random(), 0.8);
      const r = 22 + t * (GAL_R - 22);
      /* offset slightly inward of the bright arm → trailing dust lane. */
      const ang = ARMS[ai] + Math.log(r / 16) * 1.0 - 0.16 + _g() * 0.22;
      pos[i * 3]     = Math.cos(ang) * r;
      pos[i * 3 + 1] = _g() * 4;
      pos[i * 3 + 2] = Math.sin(ang) * r;
      const k = 0.5 + Math.random() * 0.5;
      col[i * 3] = cDust.r * k; col[i * 3 + 1] = cDust.g * k; col[i * 3 + 2] = cDust.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3.2, sizeAttenuation: true, vertexColors: true, map: _glowTexture(),
      transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    _scene.add(dust); _spinLayers.push(dust);
  }

  /* Glowing star-forming regions (HII) scattered along the arms — pink/teal
     additive blobs that give the spiral a vivid, premium look. */
  function _buildHIIRegions() {
    const group = new THREE.Group();
    const cols = ['#ff7eb6', '#ff9ecb', '#7fe3ff', '#b59bff', '#ffd27f'];
    const ARMS = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
    for (let i = 0; i < 60; i++) {
      const ai = i % ARMS.length;
      const t = 0.2 + Math.random() * 0.75;
      const r = 16 + t * (GAL_R - 16);
      const ang = ARMS[ai] + Math.log(r / 16) * 1.0 + (Math.random() - 0.5) * 0.3;
      const knot = _sprite(new THREE.Color(cols[i % cols.length]), 6 + Math.random() * 10, 0.55 + Math.random() * 0.3);
      knot.position.set(Math.cos(ang) * r, _g() * 4, Math.sin(ang) * r);
      group.add(knot);
    }
    _scene.add(group); _spinLayers.push(group);
  }

  /* A broad, faint diffuse halo behind the disc so the galaxy glows. */
  function _buildGalaxyHaze() {
    const haze = _sprite(new THREE.Color('#5566aa'), GAL_R * 3.4, 0.10);
    _scene.add(haze);
    const warm = _sprite(new THREE.Color('#ffcaa0'), GAL_R * 1.5, 0.16);
    _scene.add(warm);
  }

  /* Layered core glow (Sagittarius A* region): a tiny brilliant centre, a warm
     mid halo and a wide soft bloom — all gently pulsing. Also clickable. */
  function _buildCoreGlow() {
    _coreSprites = [];
    const layers = [
      { color: 0xfff2d4, scale: 15, opacity: 0.8 },
      { color: 0xffd591, scale: 46, opacity: 0.5 },
      { color: 0xffb25e, scale: 108, opacity: 0.28 },
    ];
    layers.forEach(l => {
      const sp = _sprite(new THREE.Color(l.color), l.scale, l.opacity);
      sp.userData.base = l.scale;
      _scene.add(sp); _coreSprites.push(sp);
    });
    _coreGlow = _coreSprites[1];
    /* Invisible-ish hit sphere at the core for clicking the galaxy itself. */
    const hit = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0 }));
    _scene.add(hit);
    _markers.push({ mesh: hit, data: GALAXY, type: 'core', pos: new THREE.Vector3(0, 0, 0) });
  }

  /* Place clickable markers: the Sun, notable stars, nebulae, other galaxies. */
  function _placeMarkers() {
    const glow = _glowTexture();
    const addMarker = (data, x, y, z, baseR, glowScale, flat) => {
      const col = new THREE.Color(data.color);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(baseR, 16, 16), new THREE.MeshBasicMaterial({ color: col }));
      mesh.position.set(x, y, z);
      if (flat) mesh.scale.set(1.6, 0.4, 1.6);   /* disc-like for galaxies */
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(glowScale);
      mesh.add(halo);
      _scene.add(mesh);
      _markers.push({ mesh, data, type: data.type, pos: mesh.position.clone(), halo });
    };

    /* Sun — on the Orion arm, ~62% out from the centre. */
    const sunR = GAL_R * 0.62, sunA = 0.9;
    const sx = Math.cos(sunA) * sunR, sz = Math.sin(sunA) * sunR;
    addMarker(SUN, sx, 2, sz, 2.0, 16);

    /* Notable stars — clustered near the Sun (our galactic neighbourhood). */
    STARS.forEach((s, i) => {
      const a = sunA + (i - STARS.length / 2) * 0.12;
      const r = sunR + (Math.random() - 0.5) * 36;
      addMarker(s, Math.cos(a) * r, (Math.random() - 0.5) * 10, Math.sin(a) * r, 1.4, 9);
    });

    /* Nebulae — scattered along the disc, within the arms. */
    NEBULAE.forEach((n, i) => {
      const a = (i / NEBULAE.length) * Math.PI * 2 + 0.6;
      const r = 55 + (i % 3) * 45;
      addMarker(n, Math.cos(a) * r, (Math.random() - 0.5) * 14, Math.sin(a) * r, 2.2, 16);
    });

    /* Other galaxies — well beyond the disc, above/below the plane. */
    GALAXIES.forEach((g, i) => {
      const a = (i / GALAXIES.length) * Math.PI * 2 + 0.3;
      const r = GAL_R + 120 + (i % 3) * 90;
      const y = (i % 2 ? 1 : -1) * (90 + (i % 3) * 60);
      addMarker(g, Math.cos(a) * r, y, Math.sin(a) * r, 6, 34, true);
    });
  }

  /* ═════════════════════════════ CAMERA ═════════════════════════════ */
  function _updateCamera() {
    if (!_camera) return;
    const x = _camDist * Math.sin(_camPhi) * Math.sin(_camTheta) + _fx;
    const y = _camDist * Math.cos(_camPhi) + _fy;
    const z = _camDist * Math.sin(_camPhi) * Math.cos(_camTheta) + _fz;
    _camera.position.set(x, y, z);
    _camera.lookAt(_fx, _fy, _fz);
  }
  function _focus(p, dist) { _fxT = p.x; _fyT = p.y; _fzT = p.z; _camDistT = dist; }

  /* ═════════════════════════════ ANIMATION ══════════════════════════ */
  function _start() {
    function tick() {
      _raf = requestAnimationFrame(tick);
      if (!_renderer || !_scene || !_camera) return;
      const spin = _rotate && !_reducedMotion();
      if (spin) _spinLayers.forEach(l => { l.rotation.y += 0.0004; });
      const pulse = 1 + Math.sin(performance.now() * 0.0012) * 0.06;
      _coreSprites.forEach(sp => sp.scale.setScalar(sp.userData.base * pulse));
      /* Idle camera drift while nothing is selected. */
      if (_selBody === null && !_dragging && spin) _camThetaT += 0.0004;

      const lf = 0.07;
      _camDist += (_camDistT - _camDist) * lf;
      _camTheta += (_camThetaT - _camTheta) * lf;
      _camPhi += (_camPhiT - _camPhi) * lf;
      _fx += (_fxT - _fx) * lf; _fy += (_fyT - _fy) * lf; _fz += (_fzT - _fz) * lf;
      _updateCamera();
      _updateLabels();
      _renderer.render(_scene, _camera);
    }
    _raf = requestAnimationFrame(tick);
  }

  /* ═════════════════════════════ LABELS ═════════════════════════════ */
  function _buildLabels(container) {
    const viewport = container.querySelector('#gx-viewport');
    if (!viewport) return;
    _markers.forEach(mk => {
      if (mk.type === 'core') return;   /* core labelled implicitly */
      const el = document.createElement('div');
      el.className = 'gx-label';
      el.textContent = mk.data.name;
      el.style.cssText = 'position:absolute;pointer-events:none;transform:translateX(-50%);white-space:nowrap;font-size:.66rem;font-family:var(--font-sans);font-weight:600;color:rgba(255,255,255,.72);text-shadow:0 1px 4px rgba(0,0,0,.9);z-index:5;transition:color .2s;';
      viewport.appendChild(el);
      mk.labelEl = el;
    });
  }

  function _updateLabels() {
    if (!_camera || !_renderer) return;
    const canvas = _renderer.domElement;
    const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
    const v = new THREE.Vector3();
    _markers.forEach(mk => {
      const el = mk.labelEl;
      if (!el) return;
      if (!_labelsOn) { el.style.display = 'none'; return; }
      mk.mesh.getWorldPosition(v); v.project(_camera);
      if (v.z > 1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = (v.x * 0.5 + 0.5) * W + 'px';
      el.style.top  = (-v.y * 0.5 + 0.5) * H - 12 + 'px';
      const hov = _hovered === mk;
      el.style.color = hov ? (mk.data.color || '#fff') : 'rgba(255,255,255,.7)';
    });
  }

  /* ═════════════════════════════ POINTER ════════════════════════════ */
  function _wirePointer(container) {
    const viewport = container.querySelector('#gx-viewport');
    if (!viewport) return;
    const canvas = () => viewport.querySelector('canvas');

    viewport.addEventListener('mousedown', e => { _dragging = true; _lastX = e.clientX; _lastY = e.clientY; });
    window.addEventListener('mousemove', e => {
      if (!_dragging) return;
      _camThetaT += (e.clientX - _lastX) * 0.005;
      _camPhiT = Math.max(0.15, Math.min(Math.PI - 0.15, _camPhiT + (e.clientY - _lastY) * 0.005));
      _lastX = e.clientX; _lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { _dragging = false; });

    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { _dragging = true; _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY; }
    }, { passive: true });
    viewport.addEventListener('touchmove', e => {
      if (!_dragging || e.touches.length !== 1) return;
      _camThetaT += (e.touches[0].clientX - _lastX) * 0.005;
      _camPhiT = Math.max(0.15, Math.min(Math.PI - 0.15, _camPhiT + (e.touches[0].clientY - _lastY) * 0.005));
      _lastX = e.touches[0].clientX; _lastY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', () => { _dragging = false; });

    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      _camDistT = Math.max(40, Math.min(1200, _camDistT + e.deltaY * 0.5));
    }, { passive: false });

    /* Hover highlight */
    viewport.addEventListener('pointermove', e => {
      if (_dragging || !_camera) return;
      const mk = _pick(e, viewport);
      if (mk !== _hovered) {
        _hovered = mk;
        viewport.style.cursor = mk ? 'pointer' : '';
      }
    });

    /* Click → select */
    viewport.addEventListener('click', e => {
      if (_dragging) return;
      const mk = _pick(e, viewport);
      if (mk) { _selBody = mk.data; _focus(mk.pos, mk.type === 'galaxy' ? 220 : 70); _openPanel(mk.data, container); }
      else { _selBody = null; container.querySelector('#gx-panel')?.classList.remove('open'); }
    });
  }

  function _pick(e, viewport) {
    const cvs = viewport.querySelector('canvas');
    if (!cvs) return null;
    const rect = cvs.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.params.Points = ray.params.Points || {};
    ray.setFromCamera(mouse, _camera);
    const hits = ray.intersectObjects(_markers.map(m => m.mesh), false);
    if (!hits.length) return null;
    return _markers.find(m => m.mesh === hits[0].object) || null;
  }

  /* ═════════════════════════════ CONTROLS ═══════════════════════════ */
  function _wireControls(container) {
    container.querySelector('#gx-rotate').onclick = e => {
      _rotate = !_rotate; e.currentTarget.classList.toggle('active', _rotate);
    };
    container.querySelector('#gx-labels').onclick = e => {
      _labelsOn = !_labelsOn; e.currentTarget.classList.toggle('active', _labelsOn);
    };
    container.querySelector('#gx-zoom-in').onclick  = () => { _camDistT = Math.max(40, _camDistT * 0.7); };
    container.querySelector('#gx-zoom-out').onclick = () => { _camDistT = Math.min(1200, _camDistT * 1.4); };
    container.querySelector('#gx-reset').onclick = () => {
      _camThetaT = 0.6; _camPhiT = 0.85; _camDistT = 460;
      _fxT = 0; _fyT = 0; _fzT = 0; _selBody = null;
      container.querySelector('#gx-panel')?.classList.remove('open');
    };
  }

  /* ═════════════════════════════ PANEL ══════════════════════════════ */
  function _wirePanel(container) {
    container.addEventListener('click', e => {
      const tab = e.target.closest('#gx-panel-tabs .ex-solar-panel-tab');
      if (!tab) return;
      container.querySelectorAll('#gx-panel-tabs .ex-solar-panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _curTab = tab.dataset.tab;
      _renderBody(container);
    });
    const close = container.querySelector('#gx-panel-close');
    if (close) close.onclick = () => { _selBody = null; container.querySelector('#gx-panel')?.classList.remove('open'); };
  }

  const LABELS = {
    type: 'Tipo', dist: 'Distância', diameter: 'Diâmetro', stars: 'Estrelas',
    age: 'Idade', center: 'Centro', satellites: 'Satélites', location: 'Localização',
    distCenter: 'Distância ao centro', galacticYear: 'Ano galáctico', speed: 'Velocidade',
    constellation: 'Constelação', magnitude: 'Magnitude', size: 'Tamanho',
    luminosity: 'Luminosidade', role: 'Função', planets: 'Planetas',
  };

  function _openPanel(body, container) {
    _curTab = 'overview';
    const hint = container.querySelector('#gx-hint'); if (hint) hint.style.display = 'none';
    const panel = container.querySelector('#gx-panel'); if (!panel) return;
    panel.classList.add('open');
    container.querySelectorAll('#gx-panel-tabs .ex-solar-panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'overview'));
    const el = container.querySelector('#gx-panel-header');
    if (el) el.innerHTML = `
      <div class="ex-solar-panel-color" style="background:${body.color || '#ffd700'}"></div>
      <div>
        <div class="ex-solar-panel-name">${body.name}</div>
        ${body.constellation ? `<div class="ex-solar-panel-type">Constelação: ${body.constellation}</div>`
          : body.info?.type ? `<div class="ex-solar-panel-type">${body.info.type}</div>` : ''}
      </div>`;
    _renderBody(container);
  }

  function _renderBody(container) {
    const bodyEl = container.querySelector('#gx-panel-body');
    const body = _selBody;
    if (!bodyEl || !body) return;
    if (_curTab === 'overview') {
      const rows = Object.entries(body.info || {}).map(([k, v]) =>
        `<div class="ex-solar-info-row"><span class="ex-solar-info-label">${LABELS[k] || k}</span><span>${v}</span></div>`).join('');
      bodyEl.innerHTML = `<div class="ex-solar-overview">${rows}</div>`;
    } else {
      const items = (body.facts || []).map(f => `<div class="ex-solar-fact-item">${f}</div>`).join('');
      bodyEl.innerHTML = `<div class="ex-solar-facts">${items || '<div class="ex-solar-empty">Sem dados.</div>'}</div>`;
    }
  }

  return { mount, resume, stop };
})();
