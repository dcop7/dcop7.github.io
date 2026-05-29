/* ══════════════════════════════════════════════════════════════════
   SOLAR EXPLORER — Canvas-based Solar System visualizer
══════════════════════════════════════════════════════════════════ */
const SolarExplorer = (function () {
  'use strict';

  const PLANETS = [
    {
      id: 'mercury', name: 'Mercúrio', color: '#b5b5b5', r: 4, orbit: 0.38, period: 88,
      info: { dist: '0.39 UA', radius: '2 439 km', period: '88 dias', temp: '−170 / +430°C', moons: '0', gravity: '3.7 m/s²' },
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
      id: 'venus', name: 'Vénus', color: '#e8cda0', r: 9, orbit: 0.58, period: 225,
      info: { dist: '0.72 UA', radius: '6 051 km', period: '225 dias', temp: '+465°C', moons: '0', gravity: '8.9 m/s²' },
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
      id: 'earth', name: 'Terra', color: '#4b9cd3', r: 10, orbit: 0.73, period: 365,
      info: { dist: '1.00 UA', radius: '6 371 km', period: '365 dias', temp: '−89 / +56°C', moons: '1', gravity: '9.8 m/s²' },
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
      id: 'mars', name: 'Marte', color: '#c1440e', r: 6, orbit: 0.88, period: 687,
      info: { dist: '1.52 UA', radius: '3 389 km', period: '687 dias', temp: '−125 / +20°C', moons: '2', gravity: '3.7 m/s²' },
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
      id: 'jupiter', name: 'Júpiter', color: '#c88b3a', r: 22, orbit: 1.05, period: 4333,
      info: { dist: '5.20 UA', radius: '69 911 km', period: '11.9 anos', temp: '−108°C', moons: '95', gravity: '24.8 m/s²' },
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
      id: 'saturn', name: 'Saturno', color: '#e4d191', r: 18, orbit: 1.22, period: 10759,
      info: { dist: '9.58 UA', radius: '58 232 km', period: '29.5 anos', temp: '−178°C', moons: '146', gravity: '10.4 m/s²' },
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
      id: 'uranus', name: 'Urano', color: '#7de8e8', r: 14, orbit: 1.37, period: 30687,
      info: { dist: '19.2 UA', radius: '25 362 km', period: '84 anos', temp: '−220°C', moons: '27', gravity: '8.7 m/s²' },
      moonList: [
        { name: 'Titânia', dist: '435 910 km', period: '8.7 dias', r: '789 km' },
        { name: 'Oberão', dist: '583 520 km', period: '13.5 dias', r: '761 km' },
        { name: 'Umbriel', dist: '266 000 km', period: '4.1 dias', r: '585 km' },
        { name: 'Ariel', dist: '191 020 km', period: '2.5 dias', r: '579 km' },
      ],
      facts: [
        'Roda de lado — o eixo está inclinado 98° em relação ao plano orbital.',
        'As suas luas têm nomes de personagens de Shakespeare e Alexander Pope.',
        'Registou −224°C, os ventos mais frios do Sistema Solar.',
        'Possui 13 anéis estreitos, descobertos por ocultação estelar em 1977.',
      ],
      compare: { size: 4.01, gravity: 0.89, distance: 19.2, period: 84 },
    },
    {
      id: 'neptune', name: 'Neptuno', color: '#5b86e5', r: 13, orbit: 1.52, period: 60190,
      info: { dist: '30.1 UA', radius: '24 622 km', period: '165 anos', temp: '−218°C', moons: '16', gravity: '11.2 m/s²' },
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

  /* ── state ── */
  let _raf     = null;
  let _canvas  = null;
  let _ctx     = null;
  let _speed   = 1;
  let _paused  = false;
  let _t       = 0;
  let _sel     = null;   /* number | 'sun' | null */
  let _angles  = PLANETS.map(() => Math.random() * Math.PI * 2);
  let _mounted = false;
  let _zoom    = 1;
  let _zoomTarget = 1;
  let _curTab  = 'overview';

  /* ── Build HTML ── */
  function mount(container) {
    container.innerHTML = `
      <div class="ex-solar-wrap">
        <canvas id="ex-solar-canvas"></canvas>
        <div class="ex-solar-controls">
          <button class="ex-solar-btn" id="ss-slower" title="Mais lento">⏪</button>
          <button class="ex-solar-btn" id="ss-pause"  title="Pausar/Continuar">⏸</button>
          <span  class="ex-solar-speed" id="ss-speed">1×</span>
          <button class="ex-solar-btn" id="ss-faster" title="Mais rápido">⏩</button>
          <button class="ex-solar-btn" id="ss-reset"  title="Repor">↺</button>
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
            <button class="ex-solar-panel-tab" data-tab="facts">Curiosidades</button>
            <button class="ex-solar-panel-tab" data-tab="compare">Comparar</button>
          </div>
          <div class="ex-solar-panel-body" id="ss-panel-body"></div>
        </div>
        <div class="ex-solar-hint" id="ss-hint">Clica num planeta para explorar · Scroll para zoom</div>
      </div>`;

    _canvas  = container.querySelector('#ex-solar-canvas');
    _ctx     = _canvas.getContext('2d');
    _mounted = true;
    _wireControls(container);
    _wireClick(container);
    _wirePanelTabs(container);
    _resize();
    window.addEventListener('resize', _resize);
    _start();
  }

  function resume() { if (!_raf && _mounted) _start(); }

  function stop() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  }

  /* ── Controls ── */
  function _wireControls(container) {
    container.querySelector('#ss-slower').onclick  = () => { _speed = Math.max(0.25, _speed / 2); _updateSpeedLabel(container); };
    container.querySelector('#ss-faster').onclick  = () => { _speed = Math.min(64,   _speed * 2); _updateSpeedLabel(container); };
    container.querySelector('#ss-zoom-in').onclick  = () => { _zoomTarget = Math.min(3, _zoomTarget * 1.4); };
    container.querySelector('#ss-zoom-out').onclick = () => { _zoomTarget = Math.max(0.4, _zoomTarget / 1.4); };
    container.querySelector('#ss-reset').onclick    = () => {
      _angles = PLANETS.map(() => Math.random() * Math.PI * 2);
      _t = 0; _speed = 1; _zoom = 1; _zoomTarget = 1;
      _updateSpeedLabel(container);
    };
    container.querySelector('#ss-pause').onclick = e => {
      _paused = !_paused;
      e.currentTarget.textContent = _paused ? '▶' : '⏸';
    };
  }

  function _updateSpeedLabel(container) {
    const sp = container.querySelector('#ss-speed');
    if (sp) sp.textContent = `${_speed}×`;
  }

  /* ── Panel tabs ── */
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
      _sel = null;
      container.querySelector('#ss-panel')?.classList.remove('open');
    };
  }

  /* ── Canvas click ── */
  function _wireClick(container) {
    _canvas.addEventListener('click', e => {
      const rect = _canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      const W    = rect.width, H = rect.height;
      const cx   = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) * 0.44 * _zoom;

      if (Math.hypot(mx - cx, my - cy) < 28 * _zoom) {
        _sel = 'sun';
        _openPanel(SUN, container);
        return;
      }
      for (let i = 0; i < PLANETS.length; i++) {
        const p  = PLANETS[i];
        const or = p.orbit * maxR;
        const px = cx + or * Math.cos(_angles[i]);
        const py = cy + or * Math.sin(_angles[i]);
        if (Math.hypot(mx - px, my - py) <= p.r * _zoom + 8) {
          _sel = i;
          _openPanel(p, container);
          return;
        }
      }
      _sel = null;
      container.querySelector('#ss-panel')?.classList.remove('open');
    });

    _canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 / 1.15 : 1.15;
      _zoomTarget = Math.max(0.4, Math.min(3, _zoomTarget * delta));
    }, { passive: false });
  }

  function _openPanel(body, container) {
    const hint = container.querySelector('#ss-hint');
    if (hint) hint.style.display = 'none';
    const panel = container.querySelector('#ss-panel');
    if (!panel) return;
    panel.classList.add('open');
    _curTab = 'overview';
    container.querySelectorAll('.ex-solar-panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'overview'));
    const moonTab    = panel.querySelector('[data-tab="moons"]');
    const compareTab = panel.querySelector('[data-tab="compare"]');
    const hasMoons   = body.moonList !== undefined;
    const hasCompare = body.compare !== undefined;
    if (moonTab)    moonTab.style.display    = hasMoons   ? '' : 'none';
    if (compareTab) compareTab.style.display = hasCompare ? '' : 'none';
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

  function _renderPanelBody(container) {
    const bodyEl = container.querySelector('#ss-panel-body');
    if (!bodyEl) return;
    const body = _sel === 'sun' ? SUN : (_sel !== null ? PLANETS[_sel] : null);
    if (!body) return;

    if (_curTab === 'overview') {
      const rows = Object.entries(body.info).map(([k, v]) => {
        const label = ({ dist: 'Distância ao Sol', radius: 'Raio médio', period: 'Período orbital', temp: 'Temperatura', moons: 'Nº de luas', gravity: 'Gravidade', type: 'Tipo', age: 'Idade' })[k] || k;
        return `<div class="ex-solar-info-row"><span class="ex-solar-info-label">${label}</span><span>${v}</span></div>`;
      }).join('');
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
      const shown = body.moonList.length;
      const total = parseInt(body.info?.moons || 0);
      const more  = total > shown ? `<div class="ex-solar-moons-more">+ ${total - shown} luas menores catalogadas</div>` : '';
      bodyEl.innerHTML = `<div class="ex-solar-moons">${items}${more}</div>`;

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

  /* ── Resize ── */
  function _resize() {
    if (!_canvas) return;
    const rect = _canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    _canvas.width  = rect.width  * dpr;
    _canvas.height = rect.height * dpr;
  }

  /* ── Animation loop ── */
  function _start() {
    const dpr = window.devicePixelRatio || 1;

    function tick() {
      _raf = requestAnimationFrame(tick);
      if (!_canvas || !_ctx) return;

      _zoom += (_zoomTarget - _zoom) * 0.08;

      const W  = _canvas.width  / dpr;
      const H  = _canvas.height / dpr;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) * 0.44 * _zoom;

      _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _ctx.clearRect(0, 0, W, H);

      _drawStars(W, H);

      /* Orbit rings */
      PLANETS.forEach(p => {
        _ctx.beginPath();
        _ctx.arc(cx, cy, p.orbit * maxR, 0, Math.PI * 2);
        _ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        _ctx.lineWidth   = 0.5;
        _ctx.stroke();
      });

      /* Saturn's rings */
      const satI   = 5;
      const satOr  = PLANETS[satI].orbit * maxR;
      const satX   = cx + satOr * Math.cos(_angles[satI]);
      const satY   = cy + satOr * Math.sin(_angles[satI]);
      _ctx.save();
      _ctx.translate(satX, satY);
      _ctx.scale(1, 0.3);
      _ctx.beginPath();
      _ctx.arc(0, 0, (PLANETS[satI].r + 10) * _zoom, 0, Math.PI * 2);
      _ctx.strokeStyle = 'rgba(228,209,145,0.5)';
      _ctx.lineWidth   = 5 * _zoom;
      _ctx.stroke();
      _ctx.restore();

      /* Sun */
      const sunR    = 28 * _zoom;
      const sunGlow = _ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 1.3);
      sunGlow.addColorStop(0, '#fff9c4');
      sunGlow.addColorStop(0.3, '#ffd700');
      sunGlow.addColorStop(0.7, '#ff8c00');
      sunGlow.addColorStop(1, 'rgba(255,100,0,0)');
      _ctx.beginPath();
      _ctx.arc(cx, cy, sunR * 1.3, 0, Math.PI * 2);
      _ctx.fillStyle = sunGlow;
      _ctx.fill();

      if (_sel === 'sun') {
        _ctx.beginPath();
        _ctx.arc(cx, cy, sunR + 5, 0, Math.PI * 2);
        _ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        _ctx.lineWidth   = 1.5;
        _ctx.stroke();
      }

      /* Planets */
      PLANETS.forEach((p, i) => {
        if (!_paused) {
          _angles[i] += 0.0002 * _speed * (365 / p.period);
        }
        const or = p.orbit * maxR;
        const px = cx + or * Math.cos(_angles[i]);
        const py = cy + or * Math.sin(_angles[i]);
        const pr = p.r * _zoom;

        const glow = _ctx.createRadialGradient(px, py, 0, px, py, pr * 2.2);
        glow.addColorStop(0, p.color);
        glow.addColorStop(1, 'transparent');
        _ctx.beginPath();
        _ctx.arc(px, py, pr * 2.2, 0, Math.PI * 2);
        _ctx.fillStyle = glow;
        _ctx.fill();

        _ctx.beginPath();
        _ctx.arc(px, py, pr, 0, Math.PI * 2);
        _ctx.fillStyle = p.color;
        _ctx.fill();

        if (_sel === i) {
          _ctx.beginPath();
          _ctx.arc(px, py, pr + 5, 0, Math.PI * 2);
          _ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          _ctx.lineWidth   = 1.5;
          _ctx.stroke();
        }

        if (maxR > 150) {
          _ctx.fillStyle  = 'rgba(255,255,255,0.55)';
          _ctx.font       = `${Math.max(9, Math.min(11, W / 80))}px Inter, sans-serif`;
          _ctx.textAlign  = 'center';
          _ctx.fillText(p.name, px, py + pr + 13);
        }
      });

      _t++;
    }

    _raf = requestAnimationFrame(tick);
  }

  /* Seeded starfield */
  const _stars = Array.from({ length: 200 }, (_, i) => ({
    x: Math.sin(i * 127.3) * 0.5 + 0.5,
    y: Math.cos(i * 83.7)  * 0.5 + 0.5,
    s: 0.4 + (i % 5) * 0.3,
    a: 0.2 + (i % 7) * 0.1,
  }));

  function _drawStars(W, H) {
    _stars.forEach(s => {
      _ctx.beginPath();
      _ctx.arc(s.x * W, s.y * H, s.s, 0, Math.PI * 2);
      _ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      _ctx.fill();
    });
  }

  return { mount, resume, stop };
})();
