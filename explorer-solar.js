/* ══════════════════════════════════════════════════════════════════
   SOLAR EXPLORER — Canvas-based Solar System visualizer
══════════════════════════════════════════════════════════════════ */
const SolarExplorer = (function () {
  'use strict';

  const PLANETS = [
    { id: 'mercury', name: 'Mercúrio',  color: '#b5b5b5', r: 4,   orbit: 0.38, period: 88,    info: { dist: '0.39 UA', radius: '2 439 km', period: '88 dias',   temp: '−170 / +430°C', moons: '0', gravity: '3.7 m/s²' } },
    { id: 'venus',   name: 'Vénus',     color: '#e8cda0', r: 9,   orbit: 0.58, period: 225,   info: { dist: '0.72 UA', radius: '6 051 km', period: '225 dias',  temp: '+465°C',          moons: '0', gravity: '8.9 m/s²' } },
    { id: 'earth',   name: 'Terra',     color: '#4b9cd3', r: 10,  orbit: 0.73, period: 365,   info: { dist: '1.00 UA', radius: '6 371 km', period: '365 dias',  temp: '−89 / +56°C',    moons: '1', gravity: '9.8 m/s²' } },
    { id: 'mars',    name: 'Marte',     color: '#c1440e', r: 6,   orbit: 0.88, period: 687,   info: { dist: '1.52 UA', radius: '3 389 km', period: '687 dias',  temp: '−125 / +20°C',   moons: '2', gravity: '3.7 m/s²' } },
    { id: 'jupiter', name: 'Júpiter',   color: '#c88b3a', r: 22,  orbit: 1.05, period: 4333,  info: { dist: '5.20 UA', radius: '69 911 km',period: '11.9 anos', temp: '−108°C',          moons: '95', gravity: '24.8 m/s²' } },
    { id: 'saturn',  name: 'Saturno',   color: '#e4d191', r: 18,  orbit: 1.22, period: 10759, info: { dist: '9.58 UA', radius: '58 232 km',period: '29.5 anos', temp: '−178°C',          moons: '146',gravity: '10.4 m/s²' } },
    { id: 'uranus',  name: 'Urano',     color: '#7de8e8', r: 14,  orbit: 1.37, period: 30687, info: { dist: '19.2 UA', radius: '25 362 km',period: '84 anos',   temp: '−220°C',          moons: '27', gravity: '8.7 m/s²' } },
    { id: 'neptune', name: 'Neptuno',   color: '#5b86e5', r: 13,  orbit: 1.52, period: 60190, info: { dist: '30.1 UA', radius: '24 622 km',period: '165 anos',  temp: '−218°C',          moons: '16', gravity: '11.2 m/s²' } },
  ];

  const SUN = { name: 'Sol', color: '#ffd700', info: { type: 'Estrela G2V', radius: '696 340 km', temp: '5 500°C superf.', age: '4.6 mil M anos', dist: '—', moons: '—', gravity: '274 m/s²' } };

  /* state */
  let _raf    = null;
  let _canvas = null;
  let _ctx    = null;
  let _speed  = 1;
  let _paused = false;
  let _t      = 0;
  let _sel    = null;
  let _angles = PLANETS.map(() => Math.random() * Math.PI * 2);
  let _mounted = false;

  /* ── Build HTML ── */
  function mount(container) {
    container.innerHTML = `
      <div class="ex-solar-wrap">
        <canvas id="ex-solar-canvas"></canvas>
        <div class="ex-solar-controls">
          <button class="ex-solar-btn" id="ss-slower" title="Mais lento">⏪</button>
          <button class="ex-solar-btn" id="ss-pause"  title="Pausar">⏸</button>
          <span  class="ex-solar-speed" id="ss-speed">1×</span>
          <button class="ex-solar-btn" id="ss-faster" title="Mais rápido">⏩</button>
          <button class="ex-solar-btn" id="ss-reset"  title="Repor">↺</button>
        </div>
        <div class="ex-solar-info" id="ss-info"></div>
      </div>`;

    _canvas = container.querySelector('#ex-solar-canvas');
    _ctx    = _canvas.getContext('2d');
    _mounted = true;
    _wireControls(container);
    _wireClick(container);
    _resize();
    window.addEventListener('resize', _resize);
    _start();
  }

  function resume() {
    if (!_raf && _mounted) _start();
  }

  function stop() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  }

  function _wireControls(container) {
    container.querySelector('#ss-slower').onclick = () => { _speed = Math.max(0.25, _speed / 2); _updateSpeedLabel(container); };
    container.querySelector('#ss-faster').onclick = () => { _speed = Math.min(64, _speed * 2);   _updateSpeedLabel(container); };
    container.querySelector('#ss-reset').onclick  = () => {
      _angles = PLANETS.map(() => Math.random() * Math.PI * 2);
      _t = 0; _speed = 1; _updateSpeedLabel(container);
    };
    container.querySelector('#ss-pause').onclick  = e => {
      _paused = !_paused;
      e.currentTarget.textContent = _paused ? '▶' : '⏸';
    };
  }

  function _updateSpeedLabel(container) {
    const sp = container.querySelector('#ss-speed');
    if (sp) sp.textContent = _speed < 1 ? `${_speed}×` : `${_speed}×`;
  }

  function _wireClick(container) {
    _canvas.addEventListener('click', e => {
      const rect = _canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      const W    = rect.width, H = rect.height;
      const cx   = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) * 0.44;

      /* Check sun */
      if (Math.hypot(mx - cx, my - cy) < 28) {
        _showInfo(SUN, container);
        return;
      }

      /* Check planets */
      for (let i = 0; i < PLANETS.length; i++) {
        const p   = PLANETS[i];
        const or  = p.orbit * maxR;
        const ang = _angles[i];
        const px  = cx + or * Math.cos(ang);
        const py  = cy + or * Math.sin(ang);
        if (Math.hypot(mx - px, my - py) <= p.r + 6) {
          _showInfo(p, container);
          _sel = i;
          return;
        }
      }
      /* Dismiss */
      _sel = null;
      const info = container.querySelector('#ss-info');
      if (info) info.classList.remove('show');
    });
  }

  function _showInfo(body, container) {
    const info = container.querySelector('#ss-info');
    if (!info) return;
    const rows = Object.entries(body.info).map(([k, v]) => {
      const label = ({ dist: 'Distância', radius: 'Raio', period: 'Período', temp: 'Temperatura', moons: 'Luas', gravity: 'Gravidade', type: 'Tipo', age: 'Idade' })[k] || k;
      return `<div class="ex-solar-info-row"><span class="ex-solar-info-label">${label}</span><span>${v}</span></div>`;
    }).join('');
    info.innerHTML = `<div class="ex-solar-info-name">${body.name}</div>${rows}`;
    info.classList.add('show');
  }

  function _resize() {
    if (!_canvas) return;
    const rect  = _canvas.getBoundingClientRect();
    const dpr   = window.devicePixelRatio || 1;
    _canvas.width  = rect.width  * dpr;
    _canvas.height = rect.height * dpr;
  }

  function _start() {
    const dpr = window.devicePixelRatio || 1;

    function tick() {
      _raf = requestAnimationFrame(tick);
      if (!_canvas || !_ctx) return;

      const W  = _canvas.width  / dpr;
      const H  = _canvas.height / dpr;
      const cx = W / 2, cy = H / 2;
      const maxR = Math.min(W, H) * 0.44;

      _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _ctx.clearRect(0, 0, W, H);

      /* Starfield (seeded, static) */
      _drawStars(W, H);

      /* Orbit rings */
      PLANETS.forEach(p => {
        _ctx.beginPath();
        _ctx.arc(cx, cy, p.orbit * maxR, 0, Math.PI * 2);
        _ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        _ctx.lineWidth   = 0.5;
        _ctx.stroke();
      });

      /* Saturn rings */
      const satI = 5;
      const satOr  = PLANETS[satI].orbit * maxR;
      const satAng = _angles[satI];
      const satX   = cx + satOr * Math.cos(satAng);
      const satY   = cy + satOr * Math.sin(satAng);
      _ctx.save();
      _ctx.translate(satX, satY);
      _ctx.scale(1, 0.3);
      _ctx.beginPath();
      _ctx.arc(0, 0, PLANETS[satI].r + 10, 0, Math.PI * 2);
      _ctx.strokeStyle = 'rgba(228,209,145,0.5)';
      _ctx.lineWidth   = 5;
      _ctx.stroke();
      _ctx.restore();

      /* Sun */
      const sunGlow = _ctx.createRadialGradient(cx, cy, 0, cx, cy, 36);
      sunGlow.addColorStop(0, '#fff9c4');
      sunGlow.addColorStop(0.3, '#ffd700');
      sunGlow.addColorStop(0.7, '#ff8c00');
      sunGlow.addColorStop(1, 'rgba(255,100,0,0)');
      _ctx.beginPath();
      _ctx.arc(cx, cy, 36, 0, Math.PI * 2);
      _ctx.fillStyle = sunGlow;
      _ctx.fill();

      /* Planets */
      PLANETS.forEach((p, i) => {
        if (!_paused) {
          const baseSpeed = 0.0002 * _speed;
          _angles[i] += baseSpeed * (365 / p.period);
        }
        const or  = p.orbit * maxR;
        const px  = cx + or * Math.cos(_angles[i]);
        const py  = cy + or * Math.sin(_angles[i]);

        /* Glow */
        const glow = _ctx.createRadialGradient(px, py, 0, px, py, p.r * 2.2);
        glow.addColorStop(0, p.color);
        glow.addColorStop(1, 'transparent');
        _ctx.beginPath();
        _ctx.arc(px, py, p.r * 2.2, 0, Math.PI * 2);
        _ctx.fillStyle = glow;
        _ctx.fill();

        /* Body */
        _ctx.beginPath();
        _ctx.arc(px, py, p.r, 0, Math.PI * 2);
        _ctx.fillStyle = p.color;
        _ctx.fill();

        /* Selected ring */
        if (_sel === i) {
          _ctx.beginPath();
          _ctx.arc(px, py, p.r + 5, 0, Math.PI * 2);
          _ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          _ctx.lineWidth   = 1.5;
          _ctx.stroke();
        }

        /* Label */
        if (maxR > 200) {
          _ctx.fillStyle    = 'rgba(255,255,255,0.55)';
          _ctx.font         = `${Math.max(9, Math.min(11, W / 80))}px Inter, sans-serif`;
          _ctx.textAlign    = 'center';
          _ctx.fillText(p.name, px, py + p.r + 13);
        }
      });

      _t++;
    }

    _raf = requestAnimationFrame(tick);
  }

  /* Simple seeded starfield */
  const _stars = Array.from({ length: 200 }, (_, i) => ({
    x: (Math.sin(i * 127.3) * 0.5 + 0.5),
    y: (Math.cos(i * 83.7)  * 0.5 + 0.5),
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
