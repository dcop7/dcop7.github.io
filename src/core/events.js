/* ── Events — lightweight event bus ── */
const Events = (function () {
  const _bus = {};

  return {
    on(event, fn) {
      if (!_bus[event]) _bus[event] = [];
      _bus[event].push({ fn, once: false });
      return () => Events.off(event, fn);
    },

    once(event, fn) {
      if (!_bus[event]) _bus[event] = [];
      _bus[event].push({ fn, once: true });
    },

    off(event, fn) {
      if (!_bus[event]) return;
      _bus[event] = _bus[event].filter(h => h.fn !== fn);
    },

    emit(event, ...args) {
      if (!_bus[event]) return;
      const handlers = _bus[event].slice();
      _bus[event] = _bus[event].filter(h => !h.once);
      handlers.forEach(h => h.fn(...args));
    },

    clear(event) {
      if (event) delete _bus[event];
      else Object.keys(_bus).forEach(k => delete _bus[k]);
    },
  };
})();
