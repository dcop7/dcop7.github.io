/* ── GameStorage — per-game highscore, level, and preferences ── */
const GameStorage = (function () {
  function forGame(gameId) {
    const prefix = `game:${gameId}`;

    function _key(k) { return `${prefix}:${k}`; }
    function _get(k, def) {
      try { const v = localStorage.getItem(_key(k)); return v !== null ? JSON.parse(v) : def; }
      catch { return def; }
    }
    function _set(k, v) {
      try { localStorage.setItem(_key(k), JSON.stringify(v)); } catch {}
    }

    return {
      getHighScore(mode = 'default') { return _get(`hs:${mode}`, 0); },
      setHighScore(score, mode = 'default') {
        const cur = _get(`hs:${mode}`, 0);
        if (score > cur) { _set(`hs:${mode}`, score); return true; }
        return false;
      },

      getLevel()        { return _get('level', 1); },
      setLevel(n)       { _set('level', n); },

      getPref(key, def) { return _get(`pref:${key}`, def); },
      setPref(key, val) { _set(`pref:${key}`, val); },

      getStats()        { return _get('stats', {}); },
      updateStats(patch) {
        const s = _get('stats', {});
        Object.assign(s, patch);
        _set('stats', s);
      },

      clear() {
        try {
          Object.keys(localStorage)
            .filter(k => k.startsWith(prefix))
            .forEach(k => localStorage.removeItem(k));
        } catch {}
      },
    };
  }

  return { forGame };
})();
