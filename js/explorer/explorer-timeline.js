/* ══════════════════════════════════════════════════════════════════
   TIMELINE EXPLORER — Linha do Tempo horizontal, interativa, com zoom
   Do Big Bang ao presente. Eixo "deformado" (cada grande era tem espaço
   próprio) + pan/zoom (roda, arrasto, pinça, botões). Afastado mostra as
   eras e os marcos; ao aproximar revela mais eventos (zoom semântico).
   Orientada a dados (data/timeline.json) — nada hardcoded no código.
══════════════════════════════════════════════════════════════════ */
const TimelineExplorer = (function () {
  'use strict';

  let _data = null, _loaded = false, _root = null, _stage = null, _lastFocus = null, _escBound = false;
  let _cat = 'all', _q = '', _keyOnly = false;
  let _zoom = 1, _pan = 0, _stageW = 0;           // view transform
  const MINZ = 1, MAXZ = 420;
  let _nodes = [], _bands = [];                    // {e, el, x} / {era, el}
  let _rafLayout = 0, _ro = null, _mini = null, _miniView = null;
  const PRESENT = new Date().getFullYear();

  function _lang() { return typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'; }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nf = n => n.toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT');
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  let CATS = {};
  function _buildCats() {
    CATS = {
      universo: { emoji:'🌌', label:_t('Universe','Universo'),               color:'#8b5cf6' },
      solar:    { emoji:'☀️', label:_t('Solar System','Sistema Solar'),       color:'#f59e0b' },
      terra:    { emoji:'🌍', label:_t('Earth','Terra'),                     color:'#3b82f6' },
      vida:     { emoji:'🦠', label:_t('Life','Vida'),                       color:'#10b981' },
      dinos:    { emoji:'🦕', label:_t('Dinosaurs','Dinossauros'),           color:'#84cc16' },
      humana:   { emoji:'🦣', label:_t('Human evolution','Evolução Humana'), color:'#d97706' },
      civil:    { emoji:'🏺', label:_t('Ancient civilisations','Civilizações Antigas'), color:'#eab308' },
      mundial:  { emoji:'⚔️', label:_t('World history','História Mundial'),   color:'#ef4444' },
      portugal: { emoji:'🇵🇹', label:'Portugal',                             color:'#16a34a' },
      espaco:   { emoji:'🚀', label:_t('Space','Espaço'),                    color:'#06b6d4' },
      tech:     { emoji:'💻', label:_t('Technology','Tecnologia'),           color:'#6366f1' },
      medicina: { emoji:'🧬', label:_t('Medicine','Medicina'),              color:'#ec4899' },
      ambiente: { emoji:'🌱', label:_t('Environment','Ambiente'),            color:'#14b8a6' },
      cultura:  { emoji:'🎨', label:_t('Culture','Cultura'),                color:'#a855f7' },
    };
  }
  const cat = e => CATS[e.cat] || { emoji:'•', label:'', color:'#6366f1' };

  /* pt.wikipedia article titles where they differ from the event title; the
     rest fall back to the title. Used for the image + extract + link in the
     detail panel (fetched live, cached, no copyrighted image stored). */
  const WIKI = {
    'primeiras-particulas':'Nucleossíntese primordial', 'primeiros-atomos':'Recombinação (cosmologia)',
    'primeiras-estrelas':'População estelar', 'primeiras-galaxias':'Formação e evolução de galáxias',
    'via-lactea':'Via Láctea', 'formacao-sol':'Sol', 'sistema-solar':'Sistema Solar',
    'formacao-planetas':'Formação e evolução do Sistema Solar', 'formacao-asteroides':'Cintura de asteroides',
    'formacao-cometas':'Cometa', 'formacao-luas-anoes':'Planeta anão',
    'formacao-terra':'Terra', 'formacao-lua':'Lua', 'formacao-atmosfera':'Atmosfera terrestre',
    'formacao-oceanos':'Oceano', 'primeiros-continentes':'Crosta continental', 'rodinia':'Rodínia',
    'pangeia':'Pangeia', 'separacao-continentes':'Deriva continental', 'extincoes':'Extinção Permiano-Triássica',
    'idades-gelo':'Idade do gelo', 'primeira-vida':'Origem da vida', 'bacterias':'Bactéria',
    'fotossintese':'Fotossíntese', 'grande-oxidacao':'Grande Evento de Oxigenação', 'multicelulares':'Organismo multicelular',
    'cambriana':'Explosão cambriana', 'primeiros-peixes':'Peixe', 'primeiras-plantas':'Planta',
    'insetos':'Inseto', 'anfibios':'Anfíbio', 'repteis':'Réptil',
    'primeiros-dinossauros':'Dinossauro', 'primeiros-mamiferos':'Mamífero', 'grandes-sauropodes':'Sauropoda',
    'primeiras-aves':'Archaeopteryx', 't-rex':'Tyrannosaurus', 'triceratops':'Triceratops',
    'velociraptor':'Velociraptor', 'extincao-dinos':'Extinção do Cretáceo-Paleogeno',
    'australopithecus':'Australopithecus', 'homo-habilis':'Homo habilis', 'homo-erectus':'Homo erectus',
    'neandertais':'Homem de Neandertal', 'homo-sapiens':'Homo sapiens', 'arte-rupestre':'Arte rupestre',
    'mesopotamia':'Mesopotâmia', 'sumeria':'Suméria', 'egipto':'Antigo Egito', 'piramides':'Pirâmides do Egito',
    'babilonia':'Babilônia', 'fenicios':'Fenícios', 'grecia':'Grécia Antiga', 'partenon':'Partenon',
    'persas':'Império Aquemênida', 'china-antiga':'Dinastia Qin', 'imperio-romano':'Império Romano',
    'coliseu':'Coliseu', 'maia':'Civilização maia', 'inca':'Império Inca', 'asteca':'Astecas',
    'escrita':'História da escrita', 'papel':'Papel', 'medicina-antiga':'Trepanação',
    'queda-roma':'Queda do Império Romano do Ocidente', 'idade-media':'Idade Média', 'cruzadas':'Cruzada',
    'renascimento':'Renascimento', 'imprensa':'Imprensa', 'mona-lisa':'Mona Lisa',
    'descobrimentos':'Era dos descobrimentos', 'reforma':'Reforma Protestante', 'revolucao-cientifica':'Revolução Científica',
    'revolucao-industrial':'Revolução Industrial', 'primeira-guerra':'Primeira Guerra Mundial',
    'segunda-guerra':'Segunda Guerra Mundial', 'guerra-fria':'Guerra Fria', 'muro-berlim':'Queda do Muro de Berlim',
    'fundacao-portugal':'Tratado de Zamora', 'sao-mamede':'Batalha de São Mamede', 'aljubarrota':'Batalha de Aljubarrota',
    'conquista-ceuta':'Conquista de Ceuta', 'descobrimentos-pt':'Descobrimentos portugueses',
    'chegada-india':'Vasco da Gama', 'chegada-brasil':'Descobrimento do Brasil', 'restauracao':'Restauração da Independência',
    'terramoto-1755':'Sismo de Lisboa de 1755', 'invasoes-francesas':'Invasões Francesas',
    'republica':'Implantação da República Portuguesa', 'estado-novo':'Estado Novo (Portugal)',
    '25-abril':'Revolução dos Cravos', 'adesao-cee':'União Europeia', 'euro-pt':'Euro',
    'sputnik':'Sputnik 1', 'gagarin':'Iuri Gagarin', 'apollo-11':'Apollo 11', 'voyager-1':'Voyager 1',
    'voyager-2':'Voyager 2', 'space-shuttle':'Ônibus espacial', 'iss':'Estação Espacial Internacional',
    'curiosity':'Curiosity', 'perseverance':'Perseverance (sonda)', 'jwst':'Telescópio espacial James Webb',
    'maquina-vapor':'Máquina a vapor', 'eletricidade':'Lâmpada incandescente', 'telefone':'Telefone',
    'radio':'Rádio (comunicação)', 'automovel':'Automóvel', 'aviao':'Avião', 'televisao':'Televisão',
    'computador':'Computador', 'internet':'Internet', 'www':'World Wide Web', 'smartphone':'Smartphone',
    'ia':'Inteligência artificial', 'variola':'Varíola', 'microrganismos':'Louis Pasteur',
    'penicilina':'Penicilina', 'adn':'Ácido desoxirribonucleico', 'genoma':'Projeto Genoma Humano',
    'vacinas-mrna':'Vacina de RNA', 'pequena-idade-gelo':'Pequena Idade do Gelo', 'co2':'Dióxido de carbono',
    'acordo-paris':'Acordo de Paris', 'clima-extremo':'Eventos climáticos extremos', 'cinema':'Cinema',
    'streaming':'Streaming',
  };
  const wikiTitle = e => e.wiki || WIKI[e.id] || e.title;
  function wikiUrl(title) { return 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')); }

  /* Wikipedia REST summary → { thumb, extract, url }. Cached in sessionStorage. */
  async function wikiSummary(title) {
    const key = 'tl-wiki-' + title;
    try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    let out = { thumb: null, extract: null, url: null };
    try {
      const r = await fetch('https://pt.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
      if (r.ok) {
        const d = await r.json();
        if (d && d.type !== 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
          out = {
            thumb: (d.thumbnail && d.thumbnail.source) || null,
            extract: d.extract || null,
            url: (d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || null,
          };
        }
      }
    } catch (e) {}
    try { sessionStorage.setItem(key, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  /* Era bands shown across the top — give every era visible room. */
  function _eras() {
    return [
      { id:'universo',  from:-13.8e9, to:-4.6e9,  label:_t('Universe','Universo'),       emoji:'🌌', color:'#8b5cf6' },
      { id:'solar',     from:-4.6e9,  to:-3.8e9,  label:_t('Solar System','Sist. Solar'),emoji:'☀️', color:'#f59e0b' },
      { id:'vida',      from:-3.8e9,  to:-541e6,  label:_t('Early life','Vida primitiva'),emoji:'🦠', color:'#10b981' },
      { id:'complexa',  from:-541e6,  to:-66e6,   label:_t('Complex life','Vida complexa'),emoji:'🦕', color:'#84cc16' },
      { id:'mamiferos', from:-66e6,   to:-300e3,  label:_t('Mammals & humans','Mamíferos e humanos'), emoji:'🦣', color:'#d97706' },
      { id:'prehist',   from:-300e3,  to:-3000,   label:_t('Prehistory','Pré-história'),  emoji:'🏹', color:'#a16207' },
      { id:'historia',  from:-3000,   to:PRESENT, label:_t('History','História'),         emoji:'🏛', color:'#ef4444' },
    ];
  }

  /* Warped time→[0,1] mapping: piecewise-linear anchors so every era gets a
     fair slice of the axis (deep time doesn't collapse, modern doesn't vanish). */
  const ANCHORS = [
    [-13.8e9, 0], [-4.6e9, 0.20], [-3.8e9, 0.30], [-541e6, 0.45], [-252e6, 0.55],
    [-66e6, 0.65], [-2.5e6, 0.74], [-300e3, 0.80], [-10000, 0.88], [0, 0.93],
    [1500, 0.97], [1900, 0.99], [PRESENT, 1],
  ];
  function mapYear(y) {
    if (y <= ANCHORS[0][0]) return 0;
    if (y >= ANCHORS[ANCHORS.length - 1][0]) return 1;
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      const [y0, x0] = ANCHORS[i], [y1, x1] = ANCHORS[i + 1];
      if (y >= y0 && y <= y1) return x0 + (y - y0) / (y1 - y0) * (x1 - x0);
    }
    return 1;
  }

  function agoStr(y) {
    const a = PRESENT - y;
    if (a >= 1e9) return _t('', 'há ') + (a / 1e9).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) + _t(' billion years ago', ' mil milhões de anos');
    if (a >= 1e6) return _t('', 'há ') + Math.round(a / 1e6).toLocaleString('pt-PT') + _t(' million years ago', ' milhões de anos');
    if (a >= 1e4) return _t('', 'há ') + Math.round(a / 1e3).toLocaleString('pt-PT') + _t(' thousand years ago', ' mil anos');
    if (a > 1) return _t('', 'há ') + nf(a) + _t(' years ago', ' anos');
    if (a === 1) return _t('1 year ago', 'há 1 ano');
    return _t('this year', 'este ano');
  }
  function cardDate(y) {
    if (y < -10000) return agoStr(y);
    if (y < 0) return nf(Math.abs(y)) + ' ' + _t('BCE', 'a.C.');
    return String(y);
  }

  async function _ensure() {
    if (_loaded) return;
    try { const r = await fetch('data/timeline.json'); _data = r.ok ? await r.json() : []; }
    catch (e) { _data = []; }
    (_data || []).sort((a, b) => a.year - b.year);
    _loaded = true;
  }

  /* ── transform helpers (PAD keeps the first/last events off the edges) ── */
  const PAD = 78;
  const contentW = () => _stageW * _zoom;
  const trackW = () => Math.max(1, contentW() - 2 * PAD);
  const pos = y => PAD + mapYear(y) * trackW() + _pan;          // screen px for a year
  const worldAt = px => (px - _pan - PAD) / trackW();           // normalized [0,1] under px
  function clampPan() {
    const cw = contentW();
    _pan = (cw <= _stageW) ? (_stageW - cw) / 2 : clamp(_pan, _stageW - cw, 0);
  }

  /* ── build the stage once ── */
  function buildStage() {
    const eras = _eras();
    _stage.innerHTML = `
      <div class="tl-eras-layer" id="tl-eras-layer"></div>
      <div class="tl-axisline"></div>
      <div class="tl-nodes-layer" id="tl-nodes-layer"></div>
      <div class="tl-zoom" role="group" aria-label="${_t('Zoom','Zoom')}">
        <button class="tl-zb" id="tl-zin"  aria-label="${_t('Zoom in','Aproximar')}">+</button>
        <button class="tl-zb" id="tl-zout" aria-label="${_t('Zoom out','Afastar')}">−</button>
        <button class="tl-zb" id="tl-zreset" aria-label="${_t('Reset view','Repor vista')}">⤢</button>
      </div>
      <div class="tl-hint">${_t('Drag to pan · scroll / pinch to zoom · click an era or event','Arrasta para mover · roda / pinça para zoom · clica numa era ou evento')}</div>
      <div class="tl-mini" id="tl-mini" aria-hidden="true">
        <div class="tl-mini-eras" id="tl-mini-eras"></div>
        <div class="tl-mini-view" id="tl-mini-view"></div>
      </div>`;

    const eraLayer = _stage.querySelector('#tl-eras-layer');
    _bands = eras.map(era => {
      const el = document.createElement('button');
      el.className = 'tl-era';
      el.style.setProperty('--c', era.color);
      el.setAttribute('aria-label', era.label);
      el.innerHTML = `<span class="tl-era-lbl"><span class="tl-era-em">${era.emoji}</span>${esc(era.label)}</span>`;
      el.addEventListener('click', () => focusRange(era.from, era.to));
      eraLayer.appendChild(el);
      return { era, el };
    });

    const nodesLayer = _stage.querySelector('#tl-nodes-layer');
    _nodes = _data.map((e, i) => {
      const c = cat(e);
      const lane = i % 2 === 0 ? 'up' : 'down';
      const el = document.createElement('button');
      el.className = 'tl-node tl-node-' + lane + (e.key ? ' is-key' : '');
      el.style.setProperty('--c', c.color);
      el.dataset.id = e.id;
      el.setAttribute('aria-label', e.title + ' — ' + cardDate(e.year));
      el.innerHTML = `
        <span class="tl-node-card">
          <span class="tl-node-yr">${esc(cardDate(e.year))}</span>
          <span class="tl-node-ttl">${esc(e.title)}</span>
        </span>
        <span class="tl-node-stem"></span>
        <span class="tl-node-dot">${e.key ? '<span class="tl-node-em">' + c.emoji + '</span>' : ''}</span>`;
      el.addEventListener('click', () => { if (!_dragged) openDetail(e.id); });
      nodesLayer.appendChild(el);
      return { e, el };
    });

    _stage.querySelector('#tl-zin').onclick = () => zoomBy(1.6, _stageW / 2);
    _stage.querySelector('#tl-zout').onclick = () => zoomBy(1 / 1.6, _stageW / 2);
    _stage.querySelector('#tl-zreset').onclick = () => resetView();

    /* minimap: full timeline as era segments + a draggable viewport window */
    _mini = _stage.querySelector('#tl-mini');
    _miniView = _stage.querySelector('#tl-mini-view');
    const miniEras = _stage.querySelector('#tl-mini-eras');
    miniEras.innerHTML = eras.map(era => {
      const a = mapYear(era.from), b = mapYear(era.to);
      return `<span class="tl-mini-era" style="left:${a * 100}%;width:${(b - a) * 100}%;background:${era.color}"></span>`;
    }).join('');
    const miniGoTo = clientX => {
      const r = _mini.getBoundingClientRect();
      const w = clamp((clientX - r.left) / r.width, 0, 1);     // target centre (normalized)
      const tw = trackW();
      _pan = _stageW / 2 - PAD - w * tw;                        // centre that point
      clampPan(); scheduleLayout();
    };
    let miniDown = false;
    _mini.addEventListener('pointerdown', e => { miniDown = true; _mini.setPointerCapture?.(e.pointerId); miniGoTo(e.clientX); });
    _mini.addEventListener('pointermove', e => { if (miniDown) miniGoTo(e.clientX); });
    _mini.addEventListener('pointerup', () => { miniDown = false; });
    _mini.addEventListener('pointercancel', () => { miniDown = false; });

    _wireGestures();
  }

  /* ── layout (positions everything for the current zoom/pan) ── */
  function scheduleLayout() { if (!_rafLayout) _rafLayout = requestAnimationFrame(layout); }
  function layout() {
    _rafLayout = 0;
    if (!_stage) return;
    _stageW = _stage.clientWidth || _stageW;
    clampPan();
    const tw = trackW();

    /* era bands */
    _bands.forEach(({ era, el }) => {
      const x0 = pos(era.from);
      const x1 = pos(era.to);
      el.style.transform = `translateX(${x0}px)`;
      el.style.width = Math.max(0, x1 - x0) + 'px';
      el.classList.toggle('tl-off', !(x1 > -20 && x0 < _stageW + 20));
      el.classList.toggle('tl-narrow', (x1 - x0) < 70);
    });

    /* nodes — collision-managed label reveal per lane (semantic zoom) */
    const qn = norm(_q);
    const GAP = 124;
    let lastUp = -1e9, lastDown = -1e9;
    const ordered = _nodes.slice().sort((a, b) => a.e.year - b.e.year);
    ordered.forEach(n => {
      const e = n.e, el = n.el;
      const hiddenByMode = (_keyOnly && !e.key) || (_cat !== 'all' && e.cat !== _cat);
      if (hiddenByMode) { el.classList.add('tl-hidden'); return; }
      el.classList.remove('tl-hidden');
      const x = PAD + mapYear(e.year) * tw + _pan;
      const onScreen = x > -180 && x < _stageW + 180;
      el.style.transform = `translateX(${x}px)`;
      el.classList.toggle('tl-off', !onScreen);
      let dim = false;
      if (qn) {
        const hay = norm(e.title) + ' ' + norm(e.desc || '') + ' ' + norm(e.period || '') + ' ' + norm(cat(e).label);
        const hit = hay.includes(qn);
        el.classList.toggle('tl-hit', hit);
        dim = !hit;
      } else { el.classList.remove('tl-hit'); }
      el.classList.toggle('tl-dim', dim);
      let showLbl = false;
      if (onScreen) {
        const up = el.classList.contains('tl-node-up');
        const last = up ? lastUp : lastDown;
        if ((e.key || (qn && !dim)) && x - last > 76) showLbl = true;
        else if (x - last > GAP) showLbl = true;
        if (showLbl) { if (up) lastUp = x; else lastDown = x; }
      }
      el.classList.toggle('tl-lbl-on', showLbl);
    });

    updateMini();
  }

  /* ── minimap (overview scrubber at the bottom) ── */
  function updateMini() {
    if (!_miniView) return;
    const w0 = clamp(worldAt(0), 0, 1), w1 = clamp(worldAt(_stageW), 0, 1);
    const mw = _mini.clientWidth || 1;
    _miniView.style.left = (w0 * mw) + 'px';
    _miniView.style.width = Math.max(14, (w1 - w0) * mw) + 'px';
  }

  /* ── zoom / pan (PAD-aware: keep the point under anchorX fixed) ── */
  function zoomAt(newZoom, anchorX) {
    newZoom = clamp(newZoom, MINZ, MAXZ);
    const w = worldAt(anchorX);
    _zoom = newZoom;
    _pan = anchorX - PAD - w * trackW();
    clampPan();
    scheduleLayout();
  }
  function zoomBy(factor, anchorX) { animateZoom(clamp(_zoom * factor, MINZ, MAXZ), anchorX); }
  function resetView() { animateTo(MINZ, 0); }

  function animateZoom(targetZoom, anchorX) {
    const w = worldAt(anchorX);
    const twT = _stageW * targetZoom - 2 * PAD;
    animateTo(targetZoom, anchorX - PAD - w * twT);
  }
  function focusRange(fromY, toY) {
    const span = Math.max(1e-4, mapYear(toY) - mapYear(fromY));
    const targetZoom = clamp(0.82 / span, MINZ, MAXZ);
    const mid = (mapYear(fromY) + mapYear(toY)) / 2;
    const twT = _stageW * targetZoom - 2 * PAD;
    animateTo(targetZoom, _stageW / 2 - PAD - mid * twT);
  }
  function focusEvent(id) {
    const n = _nodes.find(x => x.e.id === id); if (!n) return;
    const targetZoom = Math.max(_zoom, 70);
    const twT = _stageW * targetZoom - 2 * PAD;
    animateTo(targetZoom, _stageW / 2 - PAD - mapYear(n.e.year) * twT);
  }
  let _anim = 0;
  function animateTo(targetZoom, targetPan) {
    cancelAnimationFrame(_anim);
    const z0 = _zoom, p0 = _pan, dur = 480, t0 = performance.now();
    /* clamp target pan against target zoom */
    const cwT = _stageW * targetZoom;
    targetPan = (cwT <= _stageW) ? (_stageW - cwT) / 2 : clamp(targetPan, _stageW - cwT, 0);
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = ease(t);
      _zoom = z0 + (targetZoom - z0) * k;
      _pan = p0 + (targetPan - p0) * k;
      layout();
      if (t < 1) _anim = requestAnimationFrame(step);
    };
    _anim = requestAnimationFrame(step);
  }

  /* ── gestures: drag-pan, wheel-zoom, pinch-zoom, keyboard ── */
  let _dragged = false;
  function _wireGestures() {
    let down = false, sx = 0, sp = 0, moved = 0;
    const pts = new Map();
    let pinchD0 = 0, pinchZ0 = 1, pinchCx = 0;

    _stage.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.tl-zoom') || ev.target.closest('.tl-mini')) return;
      pts.set(ev.pointerId, ev);
      _stage.setPointerCapture?.(ev.pointerId);
      if (pts.size === 1) { down = true; _dragged = false; moved = 0; sx = ev.clientX; sp = _pan; }
      else if (pts.size === 2) {
        const a = [...pts.values()];
        pinchD0 = Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY) || 1;
        pinchZ0 = _zoom;
        const r = _stage.getBoundingClientRect();
        pinchCx = (a[0].clientX + a[1].clientX) / 2 - r.left;
      }
      _stage.classList.add('tl-grabbing');
    });
    _stage.addEventListener('pointermove', ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, ev);
      if (pts.size >= 2) {
        const a = [...pts.values()];
        const d = Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY) || 1;
        zoomAt(pinchZ0 * (d / pinchD0), pinchCx);
        _dragged = true;
        return;
      }
      if (!down) return;
      const dx = ev.clientX - sx;
      moved += Math.abs(dx);
      if (Math.abs(ev.clientX - sx) > 5) _dragged = true;
      _pan = sp + dx;
      scheduleLayout();
    });
    const up = ev => {
      pts.delete(ev.pointerId);
      if (pts.size === 0) { down = false; _stage.classList.remove('tl-grabbing'); setTimeout(() => { _dragged = false; }, 0); }
    };
    _stage.addEventListener('pointerup', up);
    _stage.addEventListener('pointercancel', up);

    _stage.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = _stage.getBoundingClientRect();
      const ax = ev.clientX - r.left;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      zoomAt(_zoom * factor, ax);
    }, { passive: false });

    _stage.setAttribute('tabindex', '0');
    _stage.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { _pan -= _stageW * 0.15; scheduleLayout(); }
      else if (ev.key === 'ArrowLeft') { _pan += _stageW * 0.15; scheduleLayout(); }
      else if (ev.key === '+' || ev.key === '=') zoomBy(1.4, _stageW / 2);
      else if (ev.key === '-' || ev.key === '_') zoomBy(1 / 1.4, _stageW / 2);
      else return;
      ev.preventDefault();
    });
  }

  /* ── detail panel ── */
  function openDetail(id) {
    const e = (_data || []).find(x => x.id === id);
    if (!e || !_root) return;
    const d = _root.querySelector('#tl-detail'); if (!d) return;
    const c = cat(e);
    const related = (e.related || []).map(r => (_data || []).find(x => x.id === r)).filter(Boolean);
    const wTitle = wikiTitle(e);
    d.style.setProperty('--c', c.color);
    d.innerHTML = `
      <button class="tl-d-close" aria-label="${_t('Close','Fechar')}">✕</button>
      <div class="tl-d-media" id="tl-d-media">
        <div class="tl-d-media-ph"><span class="tl-d-emoji-big">${c.emoji}</span></div>
      </div>
      <div class="tl-d-head">
        <span class="tl-d-emoji">${c.emoji}</span>
        <div><span class="tl-d-cat">${esc(c.label)}</span><h2 class="tl-d-title" id="tl-d-title">${esc(e.title)}</h2></div>
      </div>
      <div class="tl-d-meta">
        <span>🕓 ${cardDate(e.year)}</span><span>⏳ ${agoStr(e.year)}</span>
        ${e.period ? `<span>📜 ${esc(e.period)}</span>` : ''}${e.place ? `<span>📍 ${esc(e.place)}</span>` : ''}
      </div>
      <p class="tl-d-desc">${esc(e.desc || '')}</p>
      ${e.fact ? `<div class="tl-d-fact"><strong>💡 ${_t('Did you know?','Curiosidade')}</strong> ${esc(e.fact)}</div>` : ''}
      <div class="tl-d-wiki" id="tl-d-wiki"></div>
      <a class="tl-d-wikilink" id="tl-d-wikilink" href="${wikiUrl(wTitle)}" target="_blank" rel="noopener">📖 ${_t('Read on Wikipedia','Ler na Wikipédia')} ↗</a>
      ${related.length ? `<div class="tl-d-rel-label">🔗 ${_t('Related events','Eventos relacionados')}</div>
        <div class="tl-d-rel">${related.map(r => `<button class="tl-chip" data-id="${esc(r.id)}" style="--c:${cat(r).color}"><span>${cat(r).emoji}</span>${esc(r.title)}</button>`).join('')}</div>` : ''}`;
    d.hidden = false; d.scrollTop = 0;
    d.querySelector('.tl-d-close').onclick = closeDetail;
    d.querySelectorAll('.tl-chip[data-id]').forEach(b => b.onclick = () => { focusEvent(b.dataset.id); openDetail(b.dataset.id); });
    _lastFocus = document.activeElement;
    requestAnimationFrame(() => d.querySelector('.tl-d-close')?.focus());

    /* fetch Wikipedia image + extract + canonical link (cached, non-blocking) */
    wikiSummary(wTitle).then(s => {
      if (!d.isConnected || d.hidden) return;
      if (s.thumb) {
        const media = d.querySelector('#tl-d-media');
        if (media) media.innerHTML = `<img src="${esc(s.thumb)}" alt="${esc(e.title)}" loading="lazy"><span class="tl-d-media-cr">Wikipédia</span>`;
      }
      if (s.extract && s.extract.length > (e.desc || '').length + 20) {
        const w = d.querySelector('#tl-d-wiki');
        if (w) w.innerHTML = `<p>${esc(s.extract)}</p>`;
      }
      if (s.url) { const a = d.querySelector('#tl-d-wikilink'); if (a) a.href = s.url; }
    });
  }
  function closeDetail() {
    const d = _root && _root.querySelector('#tl-detail');
    if (d) d.hidden = true;
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} _lastFocus = null; }
  }

  /* ── shell ── */
  function shell() {
    const cats = [['all', '🕓', _t('All', 'Todas')]].concat(Object.keys(CATS).map(k => [k, CATS[k].emoji, CATS[k].label]));
    return `
      <div class="tl-wrap tl-horizontal">
        <div class="tl-toolbar">
          <div class="tl-search">
            <span class="tl-search-ic" aria-hidden="true">🔍</span>
            <input id="tl-q" type="search" placeholder="${_t('Search events, people, periods…','Pesquisar eventos, pessoas, períodos…')}" autocomplete="off" aria-label="${_t('Search the timeline','Pesquisar na linha do tempo')}">
          </div>
          <button class="tl-btn" id="tl-today" hidden>📅 ${_t('Today','Hoje')}</button>
          <button class="tl-btn" id="tl-random">🎲 ${_t('Random','Aleatório')}</button>
          <button class="tl-btn" id="tl-key" aria-pressed="false">✨ ${_t('Highlights','Destaques')}</button>
        </div>
        <div class="tl-chips tl-cats" id="tl-cats" role="group" aria-label="${_t('Filter by category','Filtrar por categoria')}">
          ${cats.map(([id, em, lb]) => `<button class="tl-fchip${id === 'all' ? ' on' : ''}" data-cat="${id}"><span>${em}</span>${esc(lb)}</button>`).join('')}
        </div>
        <div class="tl-stage" id="tl-stage" aria-label="${_t('Interactive timeline','Linha do tempo interativa')}"></div>
        <div class="tl-detail" id="tl-detail" role="dialog" aria-modal="true" aria-labelledby="tl-d-title" hidden></div>
      </div>`;
  }

  function wire() {
    const r = _root;
    const q = r.querySelector('#tl-q');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => {
      _q = q.value.trim(); layout();
      if (_q) { const hit = _nodes.find(n => !n.el.classList.contains('tl-hidden') && n.el.classList.contains('tl-hit')); if (hit) focusEvent(hit.e.id); }
    }, 180); });
    r.querySelector('#tl-random').onclick = () => discoverRandom();
    r.querySelector('#tl-key').onclick = e => {
      _keyOnly = !_keyOnly;
      e.currentTarget.classList.toggle('on', _keyOnly);
      e.currentTarget.setAttribute('aria-pressed', _keyOnly ? 'true' : 'false');
      layout();
    };
    r.querySelector('#tl-cats').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      _cat = b.dataset.cat;
      r.querySelectorAll('#tl-cats [data-cat]').forEach(x => x.classList.toggle('on', x.dataset.cat === _cat));
      layout();
    });
    const todayBtn = r.querySelector('#tl-today');
    const md = String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const todays = (_data || []).filter(e => e.date === md);
    if (todays.length) {
      todayBtn.hidden = false;
      todayBtn.onclick = () => { focusEvent(todays[0].id); openDetail(todays[0].id); };
    }
    const det = r.querySelector('#tl-detail');
    det.addEventListener('click', e => { if (e.target === det) closeDetail(); });
    if (!_escBound) {
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !_root) return;
        const d = _root.querySelector('#tl-detail');
        if (d && !d.hidden) closeDetail();
      });
      _escBound = true;
    }
  }

  /* ── public ── */
  function mount(sub) {
    _root = sub;
    _buildCats();
    sub.innerHTML = shell();
    wire();
    _stage = sub.querySelector('#tl-stage');
    _ensure().then(() => {
      buildStage();
      _stageW = _stage.clientWidth || 800;
      _zoom = MINZ; _pan = 0;
      layout();
      if (_ro) _ro.disconnect();
      _ro = new ResizeObserver(() => { _stageW = _stage.clientWidth || _stageW; scheduleLayout(); });
      _ro.observe(_stage);
      /* gentle intro: ease in from a touch more zoomed-out feel */
      requestAnimationFrame(() => requestAnimationFrame(layout));
    });
  }
  function resume() {
    if (!_root) return;
    _root = document.getElementById('ex-sub-timeline') || _root;
    _stage = _root.querySelector('#tl-stage') || _stage;
    setTimeout(() => { if (_stage) { _stageW = _stage.clientWidth || _stageW; layout(); } }, 60);
  }
  function stop() { closeDetail(); }
  function discoverRandom() {
    _ensure().then(() => {
      if (!_data || !_data.length) return;
      const e = _data[Math.floor(Math.random() * _data.length)];
      if (_stage && _nodes.length) focusEvent(e.id);
      openDetail(e.id);
    });
  }

  return { mount, resume, stop, discoverRandom };
})();
