/* ══════════════════════════════════════════════════════════════════
   PARALLAX & DEPTH SYSTEM
   Subtle mouse/touch-driven depth on the wallpaper + background orbs.
   Premium defaults, always on. The only switch is the OS-level
   prefers-reduced-motion, which disables the effect entirely.
   The content layer is never transformed (keeps text pixel-crisp).
══════════════════════════════════════════════════════════════════ */
const ParallaxSystem = (function () {
  'use strict';

  let _tx = 0, _ty = 0;   // target (mouse/touch) -1..1
  let _cx = 0, _cy = 0;   // current (smoothed)
  let _raf = null;
  let _started = false;

  const _reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onMouseMove(e) {
    _tx = (e.clientX / window.innerWidth  - 0.5) * 2;
    _ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  function onTouchMove(e) {
    const t = e.touches[0];
    if (!t) return;
    _tx = (t.clientX / window.innerWidth  - 0.5) * 2;
    _ty = (t.clientY / window.innerHeight - 0.5) * 2;
  }

  function tick() {
    _raf = requestAnimationFrame(tick);

    if (_reduced()) {
      const wp = document.getElementById('bg-wallpaper');
      if (wp) wp.style.backgroundPosition = '';
      const canvas = document.querySelector('.bg-canvas');
      if (canvas) canvas.style.transform = '';
      _cx = 0; _cy = 0;
      return;
    }

    /* smooth lerp toward the pointer */
    _cx += (_tx - _cx) * 0.07;
    _cy += (_ty - _cy) * 0.07;

    /* Layer 0 — wallpaper: move via background-position (no z-index conflict) */
    const wp = document.getElementById('bg-wallpaper');
    if (wp) {
      const dx = _cx * 14, dy = _cy * 10;
      wp.style.backgroundPosition = `calc(50% + ${dx.toFixed(2)}px) calc(50% + ${dy.toFixed(2)}px)`;
    }

    /* Layer 1 — orbs canvas: transform the whole fixed container */
    const canvas = document.querySelector('.bg-canvas');
    if (canvas) {
      const dx = _cx * 22, dy = _cy * 16;
      canvas.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    }

    /* Layer 2 — content: intentionally NOT transformed (keeps text crisp). */
  }

  /* Kept for backwards-compat with any external callers (no-op now). */
  function update() {}

  function init() {
    if (_started) return;
    _started = true;
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    _raf = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { update };
})();
