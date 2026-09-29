/* ── CanvasEngine — responsive canvas + RAF game loop ── */
const CanvasEngine = (function () {
  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let _raf = null;
    let _running = false;
    let _lastTime = 0;
    let _observer = null;
    const _onResize = opts.onResize || null;
    /* maxDpr (opcional): telemóveis a 3× pintam 9× os píxeis de um ecrã
       normal; os jogos arcade limitam a 2 sem perda visível. */
    let _dpr = 1;

    function _scale() {
      _dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || Infinity);
      const rect = canvas.getBoundingClientRect();
      canvas.width  = Math.round(rect.width  * _dpr);
      canvas.height = Math.round(rect.height * _dpr);
      ctx.scale(_dpr, _dpr);
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
      if (opts.draw)   opts.draw(ctx, canvas.width / _dpr, canvas.height / _dpr);
      _raf = requestAnimationFrame(_tick);
    }

    return {
      ctx,
      get dpr()    { return _dpr; },
      get width()  { return canvas.width  / _dpr; },
      get height() { return canvas.height / _dpr; },
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
