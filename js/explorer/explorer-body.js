/* ══════════════════════════════════════════════════════════════════
   EXPLORER · CORPO HUMANO  (3D Human Body Explorer)
   A navigable three.js body: rotate / zoom, toggle layers
   (Skin · Skeleton · Muscles · Organs · Circulation), watch blood
   flow through the vessels, click organs for info, and a 3D DNA helix.
   Built procedurally — no external models, works offline.
══════════════════════════════════════════════════════════════════ */
const HumanBodyExplorer = (function () {
  'use strict';

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.min.js';

  /* ── DOM / scene state ── */
  let _host = null, _vp = null, _info = null;
  let _renderer = null, _scene = null, _camera = null, _raf = null;
  let _mounted = false, _built = false;
  let _topic = 'anatomia';

  /* groups by layer */
  const G = { skin:null, skeleton:null, muscles:null, organs:null, vessels:null, dna:null, senses:null };
  let _organMeshes = [];      /* {mesh, key, baseEmissive} for picking + focus */
  let _heart = null, _lungs = [], _dnaGroup = null;
  let _flowTex = [];          /* {tex, dir} animated blood-flow textures */
  let _senseMarkers = [];

  /* layer visibility */
  const _layers = { skin:true, skeleton:false, muscles:false, organs:true, vessels:false };

  /* camera (spherical around a focus point) */
  let _az = 0.6, _pol = 1.32, _dist = 38, _focusY = 9;
  let _azT = 0.6, _polT = 1.32, _distT = 38, _focusYT = 9;
  let _autoSpin = true;

  /* picking */
  let _selected = null, _hovered = null;

  /* ── i18n ── */
  function _lang() { return (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'); }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }

  /* ════════════════════════════════ CONTENT ════════════════════════ */
  /* Organ info (reused in the side panel). */
  const ORGANS = {
    cerebro: { emoji:'🧠', color:0xf6a8c8, name:_=>_t('Brain','Cérebro'), sub:_=>_t('Control centre','Centro de comando'),
      desc:_=>_t('A 1.4 kg organ of ~86 billion neurons that controls everything you think, feel and do — using less power than a light bulb.','Um órgão de 1,4 kg com ~86 mil milhões de neurónios que controla tudo o que pensas, sentes e fazes — usando menos energia que uma lâmpada.'),
      stats:[['~86 mil M',_=>_t('neurons','neurónios')],['~20 W',_=>_t('power','consumo')]],
      facts:[_=>_t('Neurons fire signals at up to 430 km/h.','Os neurónios disparam sinais até 430 km/h.'),_=>_t('It is about 73% water.','É cerca de 73% água.')] },
    coracao: { emoji:'❤️', color:0xe23b50, name:_=>_t('Heart','Coração'), sub:_=>_t('The pump','A bomba'),
      desc:_=>_t('A fist-sized muscle with four chambers. It beats ~100 000 times a day, pushing blood through 100 000 km of vessels.','Um músculo do tamanho do punho com quatro câmaras. Bate ~100 000 vezes por dia, empurrando sangue por 100 000 km de vasos.'),
      stats:[['~70',_=>_t('beats / min','batim. / min')],['4',_=>_t('chambers','câmaras')]],
      facts:[_=>_t('It pumps about 7 500 L of blood a day.','Bombeia cerca de 7 500 L de sangue por dia.')] },
    pulmoes: { emoji:'🫁', color:0xf07a8c, name:_=>_t('Lungs','Pulmões'), sub:_=>_t('Gas exchange','Trocas gasosas'),
      desc:_=>_t('Two spongy organs holding ~300 million tiny air sacs (alveoli) where oxygen enters the blood. You breathe ~20 000 times a day.','Dois órgãos esponjosos com ~300 milhões de sacos de ar (alvéolos) onde o oxigénio entra no sangue. Respiras ~20 000 vezes por dia.'),
      stats:[['~300M',_=>_t('alveoli','alvéolos')],['~6 L',_=>_t('capacity','capacidade')]],
      facts:[_=>_t('Unfolded, the alveoli would cover a tennis court.','Desdobrados, os alvéolos cobririam um campo de ténis.')] },
    figado: { emoji:'🟤', color:0x9a4b32, name:_=>_t('Liver','Fígado'), sub:_=>_t('The chemist','O químico'),
      desc:_=>_t('Your largest internal organ. It filters toxins, stores energy and makes bile to digest fats — handling 500+ jobs.','O teu maior órgão interno. Filtra toxinas, armazena energia e produz bílis para digerir gorduras — com mais de 500 funções.'),
      stats:[['500+',_=>_t('jobs','funções')],['~1.5 kg',_=>_t('weight','peso')]],
      facts:[_=>_t('It can regrow from as little as 25% of itself.','Regenera a partir de apenas 25% de si mesmo.')] },
    estomago: { emoji:'🫙', color:0xe79a6a, name:_=>_t('Stomach','Estômago'), sub:_=>_t('The mixer','O misturador'),
      desc:_=>_t('A muscular bag that churns food in acid strong enough to dissolve metal, killing most germs.','Um saco muscular que mistura a comida em ácido forte o suficiente para dissolver metal, matando a maioria dos germes.'),
      stats:[['pH ~2',_=>_t('acidity','acidez')]],
      facts:[_=>_t('Its lining is renewed every few days so it doesn’t digest itself.','O seu revestimento renova-se a cada poucos dias para não se digerir.')] },
    intestinos: { emoji:'🌀', color:0xe7a07a, name:_=>_t('Intestines','Intestinos'), sub:_=>_t('~7.5 m long','~7,5 m de comprimento'),
      desc:_=>_t('The small intestine absorbs nutrients across millions of folds; the large intestine reclaims water. Home to your microbiome.','O intestino delgado absorve nutrientes através de milhões de pregas; o grosso recupera água. Lar do teu microbioma.'),
      stats:[['~7.5 m',_=>_t('length','comprimento')]],
      facts:[_=>_t('It hosts trillions of helpful bacteria.','Alberga biliões de bactérias úteis.')] },
    rins: { emoji:'🫘', color:0x8e4a44, name:_=>_t('Kidneys','Rins'), sub:_=>_t('The filters','Os filtros'),
      desc:_=>_t('Two bean-shaped filters that clean your entire blood supply ~40 times a day, making urine and balancing your body’s water and salts.','Dois filtros em forma de feijão que limpam todo o teu sangue ~40 vezes por dia, produzindo urina e equilibrando a água e os sais do corpo.'),
      stats:[['~1 M',_=>_t('filters each','filtros cada')]],
      facts:[_=>_t('They filter ~180 litres of blood every day.','Filtram ~180 litros de sangue por dia.')] },
  };

  const SENSES = {
    visao:   { emoji:'👁️', color:0x38bdf8, name:_=>_t('Sight','Visão'), sub:_=>_t('Eyes','Olhos'),
      desc:_=>_t('Eyes catch light and the brain builds it into images — about 80% of what we learn comes through vision.','Os olhos captam a luz e o cérebro transforma-a em imagens — cerca de 80% do que aprendemos entra pela visão.') },
    audicao: { emoji:'👂', color:0xfbbf24, name:_=>_t('Hearing','Audição'), sub:_=>_t('Ears','Ouvidos'),
      desc:_=>_t('Ears turn vibrations in the air into sound, and also keep you balanced through fluid-filled loops inside.','Os ouvidos transformam vibrações do ar em som e mantêm-te equilibrado através de canais cheios de líquido.') },
    olfato:  { emoji:'👃', color:0x34d399, name:_=>_t('Smell','Olfato'), sub:_=>_t('Nose','Nariz'),
      desc:_=>_t('The nose detects thousands of chemicals in the air. Smell is tightly wired to memory and emotion.','O nariz deteta milhares de químicos no ar. O olfato está fortemente ligado à memória e à emoção.') },
    paladar: { emoji:'👅', color:0xfb7185, name:_=>_t('Taste','Paladar'), sub:_=>_t('Tongue','Língua'),
      desc:_=>_t('Taste buds sense five basics — sweet, salty, sour, bitter and umami. Most "flavour" is actually smell.','As papilas sentem cinco sabores — doce, salgado, ácido, amargo e umami. Grande parte do "sabor" é olfato.') },
  };

  const TOPICS = [
    { id:'anatomia',   ic:'🧍', name:_=>_t('Anatomy','Anatomia') },
    { id:'esqueleto',  ic:'🦴', name:_=>_t('Skeleton','Esqueleto') },
    { id:'circulacao', ic:'🫀', name:_=>_t('Circulation','Circulação') },
    { id:'respiracao', ic:'🫁', name:_=>_t('Breathing','Respiração') },
    { id:'digestao',   ic:'🍎', name:_=>_t('Digestion','Digestão') },
    { id:'cerebro',    ic:'🧠', name:_=>_t('Brain','Cérebro') },
    { id:'sentidos',   ic:'👁️', name:_=>_t('Senses','Sentidos') },
    { id:'celulas',    ic:'🧬', name:_=>_t('Cells & DNA','Células e DNA') },
  ];

  /* Per-topic preset: layers, camera, which organs to spotlight, intro card. */
  const PRESETS = {
    anatomia:   { layers:{skin:1,skeleton:0,muscles:0,organs:1,vessels:0}, focusY:9,  dist:38, spotlight:null,
      intro:{ emoji:'🧍', name:_=>_t('Anatomy','Anatomia'), sub:_=>_t('The whole body','O corpo inteiro'),
        desc:_=>_t('Rotate and zoom the body. Use the buttons on the left to peel away layers — skin, skeleton, muscles, organs and the blood vessels.','Roda e aproxima o corpo. Usa os botões à esquerda para revelar camadas — pele, esqueleto, músculos, órgãos e os vasos sanguíneos.'),
        stats:[['~37 bi',_=>_t('cells','células')],['206',_=>_t('bones','ossos')],['~640',_=>_t('muscles','músculos')]],
        facts:[_=>_t('Tap any organ to learn what it does.','Toca em qualquer órgão para saber o que faz.')] } },
    esqueleto:  { layers:{skin:1,skeleton:1,muscles:0,organs:0,vessels:0}, focusY:9,  dist:38, spotlight:null,
      intro:{ emoji:'🦴', name:_=>_t('Skeleton','Esqueleto'), sub:_=>_t('206 bones','206 ossos'),
        desc:_=>_t('The frame that supports and protects you, lets you move and makes blood inside its marrow.','A estrutura que te suporta, protege, te deixa mover e fabrica sangue na sua medula.'),
        stats:[['206',_=>_t('bones','ossos')],['~15%',_=>_t('of weight','do peso')]],
        facts:[_=>_t('Babies are born with ~300 bones; many fuse with age.','Os bebés nascem com ~300 ossos; muitos fundem-se com a idade.'),_=>_t('Bone is stronger than steel by weight.','O osso é, por peso, mais forte que o aço.')] } },
    circulacao: { layers:{skin:1,skeleton:0,muscles:0,organs:1,vessels:1}, focusY:9,  dist:36, spotlight:['coracao'],
      intro:{ emoji:'🫀', name:_=>_t('Circulation','Circulação'), sub:_=>_t('Watch the blood flow','Vê o sangue a circular'),
        desc:_=>_t('The heart and a 100 000 km network of vessels carry oxygen and food to every cell. Red = arteries (oxygen-rich), blue = veins (returning).','O coração e uma rede de 100 000 km de vasos levam oxigénio e alimento a cada célula. Vermelho = artérias (ricas em oxigénio), azul = veias (de retorno).'),
        stats:[['100 000 km',_=>_t('of vessels','de vasos')],['~5 L',_=>_t('of blood','de sangue')]],
        facts:[_=>_t('Blood completes a full lap of the body in ~1 minute.','O sangue dá uma volta completa ao corpo em ~1 minuto.')] } },
    respiracao: { layers:{skin:1,skeleton:0,muscles:0,organs:1,vessels:0}, focusY:11, dist:26, spotlight:['pulmoes'],
      intro:{ emoji:'🫁', name:_=>_t('Breathing','Respiração'), sub:_=>_t('Respiratory system','Sistema respiratório'),
        desc:_=>_t('You breathe ~20 000 times a day, swapping carbon dioxide for the oxygen every cell needs. Watch the lungs expand and contract.','Respiras ~20 000 vezes por dia, trocando dióxido de carbono pelo oxigénio que cada célula precisa. Vê os pulmões a expandir e contrair.'),
        stats:[['~20 000',_=>_t('breaths / day','respirações / dia')],['~6 L',_=>_t('capacity','capacidade')]],
        facts:[_=>_t('Unfolded, the alveoli would cover a tennis court.','Desdobrados, os alvéolos cobririam um campo de ténis.')] } },
    digestao:   { layers:{skin:1,skeleton:0,muscles:0,organs:1,vessels:0}, focusY:8,  dist:24, spotlight:['estomago','figado','intestinos'],
      intro:{ emoji:'🍎', name:_=>_t('Digestion','Digestão'), sub:_=>_t('Digestive system','Sistema digestivo'),
        desc:_=>_t('A ~9 metre journey that turns food into the fuel and building blocks every cell needs. Tap the stomach, liver or intestines.','Uma viagem de ~9 metros que transforma comida no combustível e nos blocos que cada célula precisa. Toca no estômago, fígado ou intestinos.'),
        stats:[['~9 m',_=>_t('total length','comprimento')],['24–72 h',_=>_t('to digest','para digerir')]],
        facts:[_=>_t('Most digestion happens in the small intestine.','A maior parte da digestão ocorre no intestino delgado.')] } },
    cerebro:    { layers:{skin:1,skeleton:0,muscles:0,organs:1,vessels:0}, focusY:15, dist:13, spotlight:['cerebro'],
      intro:ORGANS.cerebro },
    sentidos:   { layers:{skin:1,skeleton:0,muscles:0,organs:0,vessels:0}, focusY:15, dist:12, spotlight:null, senses:true,
      intro:{ emoji:'👁️', name:_=>_t('Senses','Sentidos'), sub:_=>_t('Windows to the world','Janelas para o mundo'),
        desc:_=>_t('Five senses feed your brain a constant stream of the world. Tap a glowing marker on the head to explore each one.','Cinco sentidos alimentam o teu cérebro com um fluxo constante do mundo. Toca num marcador luminoso na cabeça para explorar cada um.'),
        facts:[_=>_t('About 80% of what you learn comes through sight.','Cerca de 80% do que aprendes entra pela visão.')] } },
    celulas:    { layers:{skin:0,skeleton:0,muscles:0,organs:0,vessels:0}, focusY:9, dist:26, dna:true, spotlight:null,
      intro:{ emoji:'🧬', name:_=>_t('Cells & DNA','Células e DNA'), sub:_=>_t('The building blocks','Os blocos da vida'),
        desc:_=>_t('Every part of you is built from ~37 trillion cells, and each one runs on instructions written in DNA — 2 metres of it coiled in every nucleus.','Tudo em ti é feito de ~37 biliões de células, e cada uma funciona com instruções escritas no DNA — 2 metros dele enrolados em cada núcleo.'),
        stats:[['~37 bi',_=>_t('cells','células')],['3 mil M',_=>_t('base pairs','pares de bases')]],
        facts:[_=>_t('All your DNA uncoiled would reach the Sun and back ~300 times.','Todo o teu DNA esticado iria ao Sol e voltava ~300 vezes.'),_=>_t('Humans share ~99.9% of their DNA.','Os humanos partilham ~99,9% do DNA.')] } },
  };

  const LAYER_BTNS = [
    { id:'skin',     ic:'🧍', color:'#fca5a5', name:_=>_t('Skin','Pele') },
    { id:'muscles',  ic:'💪', color:'#f43f5e', name:_=>_t('Muscles','Músculos') },
    { id:'skeleton', ic:'🦴', color:'#e2e8f0', name:_=>_t('Bones','Ossos') },
    { id:'organs',   ic:'🫀', color:'#fb7185', name:_=>_t('Organs','Órgãos') },
    { id:'vessels',  ic:'🩸', color:'#ef4444', name:_=>_t('Circulation','Circulação') },
  ];

  /* ════════════════════════════════ THREE LOAD ═════════════════════ */
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.THREE) { resolve(); return; }
      if (document.querySelector(`script[src="${src}"]`)) {
        const ex = document.querySelector(`script[src="${src}"]`);
        ex.addEventListener('load', resolve); ex.addEventListener('error', reject);
        if (window.THREE) resolve();
        return;
      }
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ════════════════════════════════ MATERIALS ══════════════════════ */
  function _organMat(color) {
    return new THREE.MeshStandardMaterial({
      color, roughness: 0.55, metalness: 0.0,
      emissive: new THREE.Color(color).multiplyScalar(0.18),
      transparent: true, opacity: 1,
    });
  }

  /* Repeating stripe texture → scrolled along vessels to fake blood flow. */
  function _flowTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 4;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0.0, '#3a0a10'); g.addColorStop(0.35, '#ffffff');
    g.addColorStop(0.5, '#ffd0d0'); g.addColorStop(0.65, '#ffffff'); g.addColorStop(1.0, '#3a0a10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* ════════════════════════════════ BODY PARTS ═════════════════════ */
  /* Coordinate system: Y up, feet at y≈0, head top y≈17, +Z = front. */

  function _capsule(r, len, mat) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 18), mat); }
  function _sphere(r, mat, seg) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg||24, seg||24), mat); }

  /* Humanoid silhouette shared by skin (translucent) & muscles (red). */
  function _humanoid(mat, sc) {
    const g = new THREE.Group();
    const add = (m, x, y, z, rz) => { m.position.set(x, y, z); if (rz) m.rotation.z = rz; g.add(m); return m; };
    // head + neck
    add(_sphere(1.45 * sc, mat), 0, 15.1, 0).scale.set(1, 1.08, 0.92);
    add(_capsule(0.5 * sc, 0.7, mat), 0, 13.7, 0);
    // torso (flattened front-back)
    add(_capsule(1.7 * sc, 2.6, mat), 0, 11, 0.05).scale.set(1.12, 1, 0.62);
    // pelvis
    add(_sphere(1.5 * sc, mat), 0, 8.1, 0).scale.set(1.05, 0.8, 0.62);
    // arms (upper + fore + hand), splayed slightly
    [[-1, 0.16], [1, -0.16]].forEach(([s, rz]) => {
      add(_capsule(0.46 * sc, 2.2, mat), s * 2.25, 11.3, 0, rz);
      add(_capsule(0.4 * sc, 2.2, mat), s * 2.65, 8.6, 0, rz * 0.6);
      add(_sphere(0.46 * sc, mat), s * 2.8, 6.7, 0);
    });
    // legs (thigh + shin + foot)
    [-1, 1].forEach(s => {
      add(_capsule(0.78 * sc, 2.6, mat), s * 0.9, 5.6, 0);
      add(_capsule(0.55 * sc, 2.9, mat), s * 0.98, 2.1, 0);
      const f = add(_sphere(0.6 * sc, mat), s * 0.98, 0.35, 0.4); f.scale.set(0.8, 0.55, 1.5);
    });
    return g;
  }

  function _buildSkin() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf3c6a0, roughness: 0.85, metalness: 0,
      transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide,
    });
    const g = _humanoid(mat, 1);
    g.traverse(m => { if (m.isMesh) m.renderOrder = 20; });
    return g;
  }

  function _buildMuscles() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb33b3b, roughness: 0.6, metalness: 0,
      emissive: 0x3a0d0d, transparent: true, opacity: 0.96,
    });
    const g = _humanoid(mat, 0.9);
    // subtle striation lines on torso for a more muscular read
    return g;
  }

  function _buildSkeleton() {
    const bone = new THREE.MeshStandardMaterial({ color: 0xf2efe2, roughness: 0.5, metalness: 0.05, emissive: 0x1a1812 });
    const g = new THREE.Group();
    const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
    // skull + jaw
    add(_sphere(1.18, bone, 28), 0, 15.2, 0.05).scale.set(0.95, 1.05, 0.95);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), bone), 0, 14.4, 0.35).scale.set(0.85, 0.55, 0.7);
    // spine
    for (let i = 0; i < 16; i++) {
      const y = 13.2 - i * 0.34;
      const v = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 12), bone), 0, y, -0.15 + Math.sin(i * 0.4) * 0.05);
    }
    // ribcage — open elliptical arcs around the chest
    for (let i = 0; i < 7; i++) {
      const y = 12.6 - i * 0.32;
      const r = 1.45 + Math.sin((i / 7) * Math.PI) * 0.55;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 8, 28, Math.PI * 1.25), bone);
      rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.875;
      rib.scale.set(1, 0.62, 1);
      add(rib, 0, y, -0.1);
    }
    // sternum
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.2), bone), 0, 11.5, 1.05);
    // clavicles
    [-1, 1].forEach(s => { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 10), bone), s * 0.9, 12.9, 0.7); c.rotation.z = Math.PI / 2; });
    // pelvis
    const pel = add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.32, 10, 24), bone), 0, 8.1, 0); pel.rotation.x = Math.PI / 2; pel.scale.set(1.1, 0.7, 0.7);
    // limbs (long bones)
    [[-1, 0.16], [1, -0.16]].forEach(([s, rz]) => {
      const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 3.0, 12), bone), s * 2.25, 11.3, 0); h.rotation.z = rz * 1.2;
      const f = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 2.6, 12), bone), s * 2.6, 8.5, 0); f.rotation.z = rz * 0.6;
    });
    [-1, 1].forEach(s => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 3.6, 12), bone), s * 0.9, 5.6, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 3.4, 12), bone), s * 0.95, 2.1, 0);
    });
    return g;
  }

  function _buildOrgans() {
    const g = new THREE.Group();
    _organMeshes = [];
    const place = (mesh, key, x, y, z) => {
      mesh.position.set(x, y, z);
      mesh.userData.key = key;
      mesh.userData.baseEmissive = mesh.material.emissive.clone();
      g.add(mesh); _organMeshes.push({ mesh, key });
      return mesh;
    };

    // brain
    const brain = _sphere(1.0, _organMat(ORGANS.cerebro.color), 28); brain.scale.set(1, 0.92, 1.05);
    place(brain, 'cerebro', 0, 15.2, 0.1);

    // heart (two merged spheres + a cone tip)
    const hg = new THREE.Group();
    const hm = _organMat(ORGANS.coracao.color);
    const h1 = _sphere(0.62, hm); h1.position.set(-0.32, 0.2, 0);
    const h2 = _sphere(0.62, hm); h2.position.set(0.32, 0.2, 0);
    const h3 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 18), hm); h3.position.set(0, -0.55, 0); h3.rotation.x = Math.PI; h3.rotation.z = 0.25;
    hg.add(h1, h2, h3);
    hg.traverse(m => { if (m.isMesh) { m.userData.key = 'coracao'; m.userData.baseEmissive = hm.emissive.clone(); _organMeshes.push({ mesh: m, key: 'coracao' }); } });
    hg.position.set(0.35, 11.3, 0.55); hg.scale.setScalar(0.95);
    g.add(hg); _heart = hg;

    // lungs (two lobes)
    _lungs = [];
    [-1, 1].forEach(s => {
      const lobe = _sphere(0.95, _organMat(ORGANS.pulmoes.color)); lobe.scale.set(0.8, 1.5, 0.7);
      place(lobe, 'pulmoes', s * 1.25, 11.6, 0.15);
      _lungs.push(lobe);
    });
    // trachea
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 10), _organMat(0xef9aa8));
    place(tr, 'pulmoes', 0, 12.9, 0.2);

    // liver (large wedge, right side = viewer left)
    const liver = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 20), _organMat(ORGANS.figado.color));
    liver.scale.set(1.25, 0.6, 0.7); liver.rotation.z = -0.2;
    place(liver, 'figado', -0.6, 9.7, 0.5);

    // stomach (curved bean)
    const stomach = _sphere(0.78, _organMat(ORGANS.estomago.color)); stomach.scale.set(0.9, 1.25, 0.8); stomach.rotation.z = 0.5;
    place(stomach, 'estomago', 0.75, 9.6, 0.5);

    // intestines — a coiled tube in the lower abdomen
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const ang = t * Math.PI * 6;
      const rr = 1.05 * (1 - t * 0.45);
      pts.push(new THREE.Vector3(Math.cos(ang) * rr, 7.0 + t * 1.5, 0.55 + Math.sin(ang) * 0.35));
    }
    const gut = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.34, 8), _organMat(ORGANS.intestinos.color));
    place(gut, 'intestinos', 0, 0, 0);

    // kidneys (behind)
    [-1, 1].forEach(s => {
      const k = _sphere(0.42, _organMat(ORGANS.rins.color)); k.scale.set(0.8, 1.2, 0.7);
      place(k, 'rins', s * 0.95, 9.1, -0.55);
    });

    return g;
  }

  function _buildVessels() {
    const g = new THREE.Group();
    _flowTex = [];
    const mkTube = (points, radius, color, dir) => {
      const tex = _flowTexture();
      const len = new THREE.CatmullRomCurve3(points).getLength();
      tex.repeat.set(Math.max(2, len / 2.2), 1);
      const mat = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.4, metalness: 0.1, emissive: new THREE.Color(color).multiplyScalar(0.25) });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, radius, 8), mat);
      g.add(tube); _flowTex.push({ tex, dir });
      return tube;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const RED = 0xe23b3b, BLUE = 0x3b6ee2;

    // ARTERIES (red) — aorta core + branches, flowing away from heart
    mkTube([V(0.3,11.3,0.4), V(0.2,12.6,0.2), V(0,13.6,0), V(0,14.6,0.1)], 0.16, RED, -1);          // up to head
    mkTube([V(0.3,11.0,0.4), V(0.15,9.5,0.25), V(0,8.2,0.1), V(0,7.2,0)], 0.18, RED, -1);            // descending aorta
    mkTube([V(0,7.4,0), V(-0.7,6.6,0), V(-0.85,4,0), V(-0.9,1,0)], 0.14, RED, -1);                   // left leg
    mkTube([V(0,7.4,0), V(0.7,6.6,0), V(0.85,4,0), V(0.9,1,0)], 0.14, RED, -1);                      // right leg
    mkTube([V(0.4,12.4,0.2), V(-1.4,12.4,0.1), V(-2.3,11,0), V(-2.6,8.6,0)], 0.12, RED, -1);         // left arm
    mkTube([V(0.4,12.4,0.2), V(1.4,12.4,0.1), V(2.3,11,0), V(2.6,8.6,0)], 0.12, RED, -1);            // right arm

    // VEINS (blue) — parallel, slightly offset, flowing back to heart
    mkTube([V(-0.35,14.6,-0.1), V(-0.3,13.6,-0.1), V(-0.4,12.6,0.05), V(-0.45,11.4,0.3)], 0.16, BLUE, 1);
    mkTube([V(-0.5,7.2,-0.1), V(-0.45,8.4,0), V(-0.4,9.6,0.1), V(-0.45,11.0,0.3)], 0.18, BLUE, 1);
    mkTube([V(-1.2,1,-0.1), V(-1.15,4,-0.05), V(-0.95,6.6,-0.05), V(-0.5,7.4,-0.05)], 0.14, BLUE, 1);
    mkTube([V(1.2,1,-0.1), V(1.15,4,-0.05), V(0.95,6.6,-0.05), V(0.4,7.4,-0.05)], 0.14, BLUE, 1);
    mkTube([V(-2.7,8.6,-0.1), V(-2.4,11,-0.1), V(-1.5,12.2,-0.05), V(-0.5,12.2,0.1)], 0.12, BLUE, 1);
    mkTube([V(2.7,8.6,-0.1), V(2.4,11,-0.1), V(1.5,12.2,-0.05), V(0.5,12.2,0.1)], 0.12, BLUE, 1);

    return g;
  }

  function _buildDNA() {
    const g = new THREE.Group();
    const N = 34, R = 2.2, step = 0.62;
    const cols = [0xf43f5e, 0x22d3ee, 0xa855f7, 0x22c55e];
    const strandMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.2, emissive: 0x223344 });
    for (let i = 0; i < N; i++) {
      const a = i * 0.42;
      const y = i * step - (N * step) / 2;
      const ax = Math.cos(a) * R, az = Math.sin(a) * R;
      const bx = Math.cos(a + Math.PI) * R, bz = Math.sin(a + Math.PI) * R;
      const sa = _sphere(0.32, strandMat, 16); sa.position.set(ax, y, az); g.add(sa);
      const sb = _sphere(0.32, strandMat, 16); sb.position.set(bx, y, bz); g.add(sb);
      // rung (base pair)
      const mid = new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2);
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, R * 2, 8),
        new THREE.MeshStandardMaterial({ color: cols[i % 4], emissive: new THREE.Color(cols[i % 4]).multiplyScalar(0.4), roughness: 0.4 }));
      rung.position.copy(mid);
      rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ax - bx, 0, az - bz).normalize());
      g.add(rung);
    }
    g.position.set(0, 9, 0);
    return g;
  }

  /* ════════════════════════════════ SCENE ══════════════════════════ */
  function _bgTexture() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0d1326'); g.addColorStop(0.5, '#080b16'); g.addColorStop(1, '#05060d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 256);
    return new THREE.CanvasTexture(c);
  }

  function _buildScene() {
    const W = _vp.clientWidth || 800, H = _vp.clientHeight || 600;
    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    _renderer.setSize(W, H);
    if (THREE.SRGBColorSpace) _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _vp.appendChild(_renderer.domElement);

    _scene = new THREE.Scene();
    _scene.background = _bgTexture();

    _camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 400);

    // lighting — soft studio setup
    _scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff1e6, 1.5); key.position.set(8, 16, 14); _scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.7); fill.position.set(-12, 6, 8); _scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff8fa3, 0.8); rim.position.set(0, 10, -14); _scene.add(rim);

    // build layer groups
    G.skin = _buildSkin();
    G.muscles = _buildMuscles();
    G.skeleton = _buildSkeleton();
    G.organs = _buildOrgans();
    G.vessels = _buildVessels();
    G.dna = _buildDNA();
    G.senses = _buildSenseMarkers();
    Object.values(G).forEach(grp => grp && _scene.add(grp));

    // soft ground shadow disc
    const disc = new THREE.Mesh(new THREE.CircleGeometry(5, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; _scene.add(disc);

    new ResizeObserver(() => _resize()).observe(_vp);
    _built = true;
  }

  function _buildSenseMarkers() {
    const g = new THREE.Group();
    _senseMarkers = [];
    const add = (key, x, y, z) => {
      const m = _sphere(0.22, new THREE.MeshStandardMaterial({ color: SENSES[key].color, emissive: new THREE.Color(SENSES[key].color).multiplyScalar(0.6), roughness: 0.3 }), 16);
      m.position.set(x, y, z); m.userData.sense = key; g.add(m); _senseMarkers.push(m);
    };
    add('visao', -0.45, 15.4, 1.15); add('visao', 0.45, 15.4, 1.15);
    add('audicao', -1.25, 15.1, 0.1); add('audicao', 1.25, 15.1, 0.1);
    add('olfato', 0, 14.9, 1.35);
    add('paladar', 0, 14.4, 1.2);
    return g;
  }

  /* ════════════════════════════════ CAMERA / CONTROLS ══════════════ */
  function _updateCamera() {
    const sp = Math.sin(_pol), cp = Math.cos(_pol);
    _camera.position.set(_dist * sp * Math.sin(_az), _dist * cp + _focusY, _dist * sp * Math.cos(_az));
    _camera.lookAt(0, _focusY, 0);
  }

  function _wireControls() {
    let drag = false, lx = 0, ly = 0, moved = 0;
    _vp.addEventListener('pointerdown', e => {
      drag = true; moved = 0; lx = e.clientX; ly = e.clientY; _autoSpin = false;
      _vp.classList.add('grabbing'); _vp.setPointerCapture?.(e.pointerId);
    });
    _vp.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      _azT -= dx * 0.008;
      _polT = Math.max(0.25, Math.min(Math.PI - 0.25, _polT - dy * 0.008));
    });
    const end = e => {
      if (!drag) return;
      drag = false; _vp.classList.remove('grabbing');
      if (moved < 6) _pick(e);   // treat as a click
    };
    _vp.addEventListener('pointerup', end);
    _vp.addEventListener('pointerleave', () => { drag = false; _vp.classList.remove('grabbing'); });
    _vp.addEventListener('wheel', e => {
      e.preventDefault();
      _distT = Math.max(7, Math.min(70, _distT * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });
  }

  function _pick(e) {
    if (!_camera) return;
    const r = _vp.getBoundingClientRect();
    const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, _camera);

    if (G.senses.visible) {
      const hit = ray.intersectObjects(_senseMarkers, false)[0];
      if (hit) { _showSense(hit.object.userData.sense); return; }
    }
    const targets = _organMeshes.filter(o => o.mesh.visible && G.organs.visible).map(o => o.mesh);
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit) _selectOrgan(hit.object.userData.key);
  }

  /* ════════════════════════════════ INFO PANEL ═════════════════════ */
  function _infoHTML(p) {
    const stats = (p.stats || []).map(([v, l]) => `<div class="hb-stat"><div class="hb-stat-v">${v}</div><div class="hb-stat-l">${l()}</div></div>`).join('');
    const facts = (p.facts || []).map(f => `<li>${f()}</li>`).join('');
    return `
      <div class="hb-info-hd"><span class="hb-info-emoji">${p.emoji}</span>
        <div><div class="hb-info-ttl">${p.name()}</div><div class="hb-info-sub">${p.sub()}</div></div></div>
      <div class="hb-info-desc">${p.desc()}</div>
      ${stats ? `<div class="hb-info-stats">${stats}</div>` : ''}
      ${facts ? `<ul class="hb-info-facts">${facts}</ul>` : ''}`;
  }

  function _selectOrgan(key) {
    _selected = key;
    if (_info) _info.innerHTML = _infoHTML(ORGANS[key]);
    _organMeshes.forEach(o => {
      const on = o.key === key;
      o.mesh.material.emissive.copy(o.mesh.userData.baseEmissive || new THREE.Color(0));
      if (on) o.mesh.material.emissive.addScalar(0.35);
    });
  }

  function _showSense(key) {
    if (_info) _info.innerHTML = _infoHTML(SENSES[key]);
    _senseMarkers.forEach(m => m.scale.setScalar(m.userData.sense === key ? 1.6 : 1));
  }

  /* ════════════════════════════════ TOPIC / LAYERS ═════════════════ */
  function _syncLayerButtons() {
    _host.querySelectorAll('.hb3d-layer-btn').forEach(b => b.classList.toggle('on', !!_layers[b.dataset.layer]));
  }

  function _applyLayers() {
    if (G.skin)     G.skin.visible = !!_layers.skin && !G.dna.visible;
    if (G.muscles)  G.muscles.visible = !!_layers.muscles && !G.dna.visible;
    if (G.skeleton) G.skeleton.visible = !!_layers.skeleton && !G.dna.visible;
    if (G.organs)   G.organs.visible = !!_layers.organs && !G.dna.visible;
    if (G.vessels)  G.vessels.visible = !!_layers.vessels && !G.dna.visible;
  }

  function _spotlight(keys) {
    // dim non-spotlit organs; null = all full
    _organMeshes.forEach(o => {
      const full = !keys || keys.includes(o.key);
      o.mesh.material.opacity = full ? 1 : 0.12;
      o.mesh.material.depthWrite = full;
    });
  }

  function _applyTopic(id, instant) {
    _topic = id;
    const p = PRESETS[id]; if (!p) return;
    _host.querySelectorAll('.hb-topic').forEach(b => b.classList.toggle('active', b.dataset.id === id));

    G.dna.visible = !!p.dna;
    G.senses.visible = !!p.senses;
    Object.assign(_layers, p.layers);
    _applyLayers();
    _syncLayerButtons();
    _spotlight(p.spotlight);

    _selected = null;
    if (_info) _info.innerHTML = _infoHTML(p.intro);

    _focusYT = p.focusY; _distT = p.dist;
    _azT = 0.55; _polT = 1.32; _autoSpin = true;
    if (instant) { _focusY = _focusYT; _dist = _distT; _az = _azT; _pol = _polT; }
  }

  /* ════════════════════════════════ ANIMATION ══════════════════════ */
  function _resize() {
    if (!_renderer || !_camera || !_vp) return;
    const W = _vp.clientWidth, H = _vp.clientHeight;
    if (!W || !H) return;
    _renderer.setSize(W, H); _camera.aspect = W / H; _camera.updateProjectionMatrix();
  }

  let _t0 = 0;
  function _tick(ts) {
    _raf = requestAnimationFrame(_tick);
    const t = ts * 0.001; if (!_t0) _t0 = t; const dt = Math.min(0.05, t - _t0); _t0 = t;

    // smooth camera
    const lf = 1 - Math.pow(0.0001, dt);
    if (_autoSpin) _azT += dt * 0.12;
    _az += (_azT - _az) * lf; _pol += (_polT - _pol) * lf;
    _dist += (_distT - _dist) * lf; _focusY += (_focusYT - _focusY) * lf;
    _updateCamera();

    // heartbeat
    if (_heart && _heart.visible) { const b = 1 + Math.max(0, Math.sin(t * 5.0)) * 0.09; _heart.scale.setScalar(0.95 * b); }
    // breathing
    if (G.organs && G.organs.visible) { const br = 1 + Math.sin(t * 1.4) * 0.06; _lungs.forEach(l => l.scale.set(0.8, 1.5 * br, 0.7)); }
    // blood flow
    if (G.vessels && G.vessels.visible) _flowTex.forEach(f => { f.tex.offset.x -= f.dir * dt * 0.55; });
    // DNA spin
    if (G.dna && G.dna.visible) G.dna.rotation.y = t * 0.5;

    _renderer.render(_scene, _camera);
  }

  function _start() { if (!_raf) { _t0 = 0; _tick(performance.now()); } }

  /* ════════════════════════════════ PUBLIC ═════════════════════════ */
  async function mount(host) {
    host.innerHTML = `
      <div class="hb-wrap">
        <nav class="hb-topics">
          ${TOPICS.map(t => `<button class="hb-topic ${t.id==='anatomia'?'active':''}" data-id="${t.id}">
            <span class="hb-topic-ic">${t.ic}</span>${t.name()}</button>`).join('')}
        </nav>
        <div class="hb-diagram">
          <div class="hb3d-stage">
            <div class="hb3d-viewport" id="hb3d-vp"></div>
            <div class="hb3d-layers" id="hb3d-layers">
              ${LAYER_BTNS.map(l => `<button class="hb3d-layer-btn" data-layer="${l.id}" style="--ld:${l.color}">
                <span class="dot"></span>${l.ic} ${l.name()}</button>`).join('')}
            </div>
            <div class="hb3d-foot">
              <span class="hb3d-hint">${_t('Drag to rotate · scroll to zoom · tap an organ','Arrasta para rodar · scroll para zoom · toca num órgão')}</span>
              <button class="hb3d-reset" id="hb3d-reset">↺ ${_t('Reset','Repor')}</button>
            </div>
            <div class="hb3d-loading" id="hb3d-loading">
              <div class="ex-loading-spinner"></div>
              <div>${_t('Loading 3D body…','A carregar o corpo 3D…')}</div>
            </div>
          </div>
          <aside class="hb-info" id="hb-info"></aside>
        </div>
      </div>`;

    _host = host.querySelector('.hb-wrap');
    _vp = host.querySelector('#hb3d-vp');
    _info = host.querySelector('#hb-info');
    _mounted = true;

    // topic + layer wiring
    _host.querySelector('.hb-topics').addEventListener('click', e => {
      const b = e.target.closest('.hb-topic'); if (b) _applyTopic(b.dataset.id);
    });
    _host.querySelector('#hb3d-layers').addEventListener('click', e => {
      const b = e.target.closest('.hb3d-layer-btn'); if (!b) return;
      _layers[b.dataset.layer] = !_layers[b.dataset.layer];
      _applyLayers(); _syncLayerButtons();
    });
    _host.querySelector('#hb3d-reset').addEventListener('click', () => _applyTopic(_topic));

    try {
      await _loadScript(THREE_CDN);
      if (!window.THREE) throw new Error('THREE missing');
    } catch (e) {
      const l = host.querySelector('#hb3d-loading');
      if (l) l.innerHTML = `<div class="ex-error-icon">⚠</div><div>${_t('Could not load the 3D engine.','Não foi possível carregar o motor 3D.')}</div>`;
      return;
    }

    _buildScene();
    _wireControls();
    _applyTopic(_topic || 'anatomia', true);
    host.querySelector('#hb3d-loading')?.remove();
    _start();
  }

  function resume() { if (_mounted && _built && !_raf) _start(); setTimeout(_resize, 60); }
  function stop()   { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } }

  return { mount, resume, stop };
})();
