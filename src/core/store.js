/* ── Store — unified localStorage abstraction with pub/sub ── */
const Store = (function () {
  const _mem = {};
  const _subs = {};

  function _notify(key, val) {
    (_subs[key] || []).forEach(fn => fn(val));
    (_subs['*'] || []).forEach(fn => fn(key, val));
  }

  return {
    get(key, def) {
      if (key in _mem) return _mem[key];
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return def;
        return JSON.parse(raw);
      } catch { return def; }
    },

    set(key, val) {
      _mem[key] = val;
      try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
      _notify(key, val);
    },

    del(key) {
      delete _mem[key];
      try { localStorage.removeItem(key); } catch {}
      _notify(key, undefined);
    },

    on(key, fn) {
      if (!_subs[key]) _subs[key] = [];
      _subs[key].push(fn);
    },

    off(key, fn) {
      if (!_subs[key]) return;
      _subs[key] = _subs[key].filter(f => f !== fn);
    },

    /* namespaced access: Store.ns('games').get('level', 0) */
    ns(prefix) {
      const wrap = k => `${prefix}:${k}`;
      return {
        get:  (k, d)  => Store.get(wrap(k), d),
        set:  (k, v)  => Store.set(wrap(k), v),
        del:  (k)     => Store.del(wrap(k)),
        on:   (k, fn) => Store.on(wrap(k), fn),
        off:  (k, fn) => Store.off(wrap(k), fn),
      };
    },
  };
})();
