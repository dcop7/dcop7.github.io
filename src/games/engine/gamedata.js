/* ══════════════════════════════════════════════════════════════════
   GameData — shared loader for per-game external data.
   Each refactored game keeps its engine in js/games/ and its data in
   games/<id>/config.json (difficulty params) + games/<id>/i18n.json
   ({ pt:{...}, en:{...} } UI strings). Both load lazily, are cached by the
   service worker, and every game embeds a fallback so it never breaks offline.
══════════════════════════════════════════════════════════════════ */
const GameData = (function () {
  'use strict';
  const _cache = {};

  async function load(id) {
    if (_cache[id]) return _cache[id];
    const out = { config: null, i18n: null };
    const grab = url => fetch(url, { cache: 'force-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
    try {
      const [c, i] = await Promise.all([
        grab(`games/${id}/config.json`),
        grab(`games/${id}/i18n.json`),
      ]);
      out.config = c; out.i18n = i;
    } catch (e) { /* keep nulls → game uses its embedded fallback */ }
    _cache[id] = out;
    return out;
  }

  function lang() { return (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'pt'; }

  function difficulty() {
    try {
      if (typeof GameHost !== 'undefined' && GameHost.getDifficulty) return GameHost.getDifficulty();
      const d = localStorage.getItem('quiz-difficulty');
      return (d === 'easy' || d === 'medium' || d === 'hard') ? d : 'medium';
    } catch (e) { return 'medium'; }
  }

  /* Build a translator from an embedded { pt:{}, en:{} } fallback; call
     `use(external)` to layer the loaded i18n on top for the current language. */
  function translator(fallback) {
    let strings = fallback[lang()] || fallback.pt || {};
    const t = k => (strings[k] != null ? strings[k] : k);
    t.use = ext => { if (ext && ext[lang()]) strings = Object.assign({}, fallback[lang()] || {}, ext[lang()]); else strings = fallback[lang()] || fallback.pt || {}; };
    return t;
  }

  return { load, lang, difficulty, translator };
})();
