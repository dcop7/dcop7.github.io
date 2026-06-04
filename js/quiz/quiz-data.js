/* ══════════════════════════════════════════════════════════════════
   QUIZ DATA — lazy loader for the split offline question database.

   New layout (preferred):  /quizzes/{category}/{lang}/{difficulty}.json
   Legacy layout (fallback): /quizzes/{difficulty}/{category}.json  (pt only)

   Files are fetched on demand (never bundled into the initial page), so the
   initial payload stays small and scales to thousands of questions. Each quiz
   ships its own per-language, per-difficulty data files inside the repo — no
   external API is ever called.

   Tiering (offline-first):
     1. in-memory cache   (instant, per session)
     2. sessionStorage    (survives view switches, per tab)
     3. network fetch      (the JSON file, then cached in both layers)
     4. caller's embedded fallback bank (handled by the provider)

   Question item shape:
     { q, a, opts:[4], exp, img?, imgType?('svg'|'img'|'flag'), imgCredit? }
   — `exp` is the per-question fact/info shown after answering.
══════════════════════════════════════════════════════════════════ */
const QuizData = (function () {
  'use strict';

  const BASE = 'quizzes';
  const DIFFS = ['easy', 'medium', 'hard'];

  const _mem = new Map();        // `${lang}/${category}/${difficulty}` -> items[]
  const _miss = new Set();       // keys known to be unavailable (avoid refetch)

  function _key(category, difficulty, lang) { return `${lang}/${category}/${difficulty}`; }

  function _fromSession(key) {
    try {
      const raw = sessionStorage.getItem('qd-' + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function _toSession(key, data) {
    try { sessionStorage.setItem('qd-' + key, JSON.stringify(data)); } catch {}
  }

  async function _fetchJson(url) {
    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) throw new Error('not-found');
    const data = await r.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    if (!items.length) throw new Error('empty');
    return items;
  }

  /* Load one category at one difficulty for one language. Tries the new
     per-quiz layout first, then the legacy flat layout (pt). Returns items[]
     or null (never throws). */
  async function loadBank(category, difficulty, lang) {
    if (!DIFFS.includes(difficulty)) difficulty = 'easy';
    lang = lang === 'en' ? 'en' : 'pt';
    const key = _key(category, difficulty, lang);

    if (_mem.has(key)) return _mem.get(key);
    if (_miss.has(key)) return null;

    const sess = _fromSession(key);
    if (sess) { _mem.set(key, sess); return sess; }

    /* Candidate URLs in priority order. The legacy flat layout only ever held
       pt content, so only try it for pt. */
    const urls = [`${BASE}/${category}/${lang}/${difficulty}.json`];
    if (lang === 'pt') urls.push(`${BASE}/${difficulty}/${category}.json`);

    for (const url of urls) {
      try {
        const items = await _fetchJson(url);
        _mem.set(key, items);
        _toSession(key, items);
        return items;
      } catch { /* try next candidate */ }
    }
    _miss.add(key);
    return null;
  }

  /* Validate a bank item is a well-formed 4-option question. */
  function _valid(it) {
    return it && it.q && it.a && Array.isArray(it.opts) &&
      it.opts.includes(it.a) && new Set(it.opts).size === it.opts.length;
  }

  /* Build engine-ready questions (always exactly 4 options) from bank items. */
  function buildFromBank(items, opts) {
    const { lang, count } = opts;
    const n = 4;
    /* Anti-repeat rotation: cycle through the whole bank before repeating. */
    const valid = items.filter(_valid);
    const key = `${opts.category || 'data'}-${opts.difficulty || 'easy'}`;
    const pool = QuizEngine.pickFresh(valid, count || 10, key);
    return pool.map((item, i) => {
      const distractors = item.opts.filter(o => o !== item.a);
      const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
      const out = {
        id: `qd-${i}`,
        question: item.q,
        options, correctIdx,
        explanation: item.exp || '',
        difficulty: opts.difficulty || 'easy',
        lang: lang || 'pt',
      };
      if (item.img) { out.image = item.img; out.imageType = item.imgType || 'svg'; }
      if (item.imgCredit) out.imageCredit = item.imgCredit;
      return out;
    });
  }

  return { loadBank, buildFromBank, DIFFS };
})();
