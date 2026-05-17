/* ── CanvasEngine — responsive canvas + RAF game loop ── */
const CanvasEngine = (function () {
  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let _raf = null;
    let _running = false;
    let _lastTime = 0;
    let _observer = null;
    const _onResize = opts.onResize || null;

    function _scale() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      if (_onResize) _onResize(rect.width, rect.height);
    }

    _scale();

    if (window.ResizeObserver) {
      _observer = new ResizeObserver(_scale);
      _observer.observe(canvas);
    }

    function _tick(ts) {
      if (!_running) return;
      const dt = Math.min((ts - _lastTime) / 1000, 0.05);
      _lastTime = ts;
      if (opts.update) opts.update(dt);
      if (opts.draw)   opts.draw(ctx, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      _raf = requestAnimationFrame(_tick);
    }

    return {
      ctx,
      get width()  { return canvas.width  / (window.devicePixelRatio || 1); },
      get height() { return canvas.height / (window.devicePixelRatio || 1); },
      start() {
        if (_running) return;
        _running = true;
        _lastTime = performance.now();
        _raf = requestAnimationFrame(_tick);
      },
      stop() {
        _running = false;
        if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
      },
      destroy() {
        this.stop();
        if (_observer) _observer.disconnect();
      },
      clear(color = null) {
        const w = this.width, h = this.height;
        if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); }
        else ctx.clearRect(0, 0, w, h);
      },
    };
  }

  return { create };
})();
