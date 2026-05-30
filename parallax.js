/* ══════════════════════════════════════════════════════════════════
   PARALLAX & DEPTH SYSTEM
   Layers: wallpaper (bg-pos) → orbs (transform) → content (subtle)
   Respects prefers-reduced-motion and user settings.
══════════════════════════════════════════════════════════════════ */
const ParallaxSystem = (function () {
  'use strict';

  const KEYS = {
    parallax:   'parallax-enabled',
    bgEffects:  'bg-effects',
    motion:     'motion-pref',
    perf:       'perf-mode',
  };

  let _tx = 0, _ty = 0;   // target (mouse/touch) -1..1
  let _cx = 0, _cy = 0;   // current (smoothed)
  let _raf = null;
  let _started = false;

  /* ── Cached settings (refreshed by update()) ── */
  let _cfg = { parallax: true, bgEffects: 'medium', reduced: false, perf: false };

  function _loadCfg() {
    _cfg.parallax  = localStorage.getItem(KEYS.parallax)  !== 'false';
    _cfg.bgEffects = localStorage.getItem(KEYS.bgEffects)  || 'medium';
    _cfg.reduced   = localStorage.getItem(KEYS.motion) === 'reduced'
                     || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    _cfg.perf      = localStorage.getItem(KEYS.perf) === 'true';
  }

  /* keep aliases for clarity inside tick */
  function isParallaxEnabled()  { return _cfg.parallax; }
  function getBgEffects()       { return _cfg.bgEffects; }
  function isMotionReduced()    { return _cfg.reduced; }
  function isPerfMode()         { return _cfg.perf; }

  /* ── Apply bg-effects body class ── */
  function applyBgEffects() {
    const v = getBgEffects();
    ['bg-effects-disabled','bg-effects-low','bg-effects-medium','bg-effects-high']
      .forEach(c => document.body.classList.remove(c));
    document.body.classList.add('bg-effects-' + v);
  }

  function applyMotion() {
    document.body.classList.toggle('motion-reduced', isMotionReduced());
  }

  function applyPerfMode() {
    document.body.classList.toggle('perf-mode', isPerfMode());
  }

  function applyAll() {
    applyBgEffects();
    applyMotion();
    applyPerfMode();
    document.body.classList.toggle('parallax-off', !isParallaxEnabled());
  }

  /* ── Input tracking ── */
  function onMouseMove(e) {
    _tx = (e.clientX / window.innerWidth  - 0.5) * 2;  // -1..1
    _ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    if (!t) return;
    _tx = (t.clientX / window.innerWidth  - 0.5) * 2;
    _ty = (t.clientY / window.innerHeight - 0.5) * 2;
  }

  /* ── Intensity map ── */
  const INTENSITY = { disabled: 0, low: 0.4, medium: 1, high: 1.7 };

  /* ── Animation tick ── */
  function tick() {
    _raf = requestAnimationFrame(tick);

    const reduced  = isMotionReduced();
    const enabled  = isParallaxEnabled();
    const bgfx     = getBgEffects();
    const perf     = isPerfMode();
    const intensity = INTENSITY[bgfx] ?? 1;

    if (!enabled || reduced || bgfx === 'disabled') {
      /* reset transforms cleanly */
      const wp = document.getElementById('bg-wallpaper');
      if (wp) wp.style.backgroundPosition = '';
      const canvas = document.querySelector('.bg-canvas');
      if (canvas) canvas.style.transform = '';
      _cx = 0; _cy = 0;
      return;
    }

    /* smooth lerp */
    const lf = perf ? 0.14 : 0.07;
    _cx += (_tx - _cx) * lf;
    _cy += (_ty - _cy) * lf;

    /* Layer 0 – wallpaper: move via background-position (no z-index conflict) */
    const wp = document.getElementById('bg-wallpaper');
    if (wp) {
      const dx = _cx * 14 * intensity;
      const dy = _cy * 10 * intensity;
      wp.style.backgroundPosition = `calc(50% + ${dx.toFixed(2)}px) calc(50% + ${dy.toFixed(2)}px)`;
    }

    /* Layer 1 – orbs canvas: transform the whole fixed container */
    const canvas = document.querySelector('.bg-canvas');
    if (canvas) {
      const dx = _cx * 22 * intensity;
      const dy = _cy * 16 * intensity;
      canvas.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    }

    /* Layer 2 – content: intentionally NOT transformed.
       Parallaxing the content layer requires promoting it to a GPU
       compositing layer (will-change/transform), which disables LCD
       sub-pixel antialiasing and softens text. Depth is carried by the
       wallpaper + orb layers above; content text is kept pixel-crisp. */
  }

  /* ── Public update (called when settings change) ── */
  function update() {
    _loadCfg();
    applyAll();
    /* clear content layer transforms immediately */
    document.querySelectorAll('.view-inner, .qp-page').forEach(el => {
      el.style.transform = '';
      el.style.willChange = '';
    });
  }

  /* ── Init ── */
  function init() {
    if (_started) return;
    _started = true;

    _loadCfg();
    applyAll();

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    _raf = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { update, applyBgEffects, applyAll };
})();
