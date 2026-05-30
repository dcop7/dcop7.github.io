/* ══════════════════════════════════════════════════════════════════
   QUIZ DATA — lazy loader for the split offline question database.

   The database lives under /quizzes/{easy,medium,hard}/{category}.json
   and is fetched on demand (never bundled into the initial page), so the
   initial payload stays small and scales to thousands of questions.

   Tiering (offline-first):
     1. in-memory cache   (instant, per session)
     2. sessionStorage    (survives view switches, per tab)
     3. network fetch      (the JSON file, then cached in both layers)
     4. caller's embedded fallback bank (handled by the provider)

   Question item shape (pt-PT):
     { q, a, opts:[4], exp, img?, imgType?('svg'|'img'|'flag'), imgCredit? }
══════════════════════════════════════════════════════════════════ */
const QuizData = (function () {
  'use strict';

  const BASE = 'quizzes';
  const DIFFS = ['easy', 'medium', 'hard'];

  const _mem = new Map();        // `${difficulty}/${category}` -> items[]
  const _miss = new Set();       // keys known to be unavailable (avoid refetch)

  function _key(category, difficulty) { return `${difficulty}/${category}`; }

  function _fromSession(key) {
    try {
      const raw = sessionStorage.getItem('qd-' + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function _toSession(key, data) {
    try { sessionStorage.setItem('qd-' + key, JSON.stringify(data)); } catch {}
  }

  /* Load one category at one difficulty. Returns items[] or null (never throws). */
  async function loadBank(category, difficulty) {
    if (!DIFFS.includes(difficulty)) difficulty = 'easy';
    const key = _key(category, difficulty);

    if (_mem.has(key)) return _mem.get(key);
    if (_miss.has(key)) return null;

    const sess = _fromSession(key);
    if (sess) { _mem.set(key, sess); return sess; }

    try {
      const r = await fetch(`${BASE}/${difficulty}/${category}.json`, { cache: 'force-cache' });
      if (!r.ok) throw new Error('not-found');
      const data = await r.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      if (!items.length) throw new Error('empty');
      _mem.set(key, items);
      _toSession(key, items);
      return items;
    } catch {
      _miss.add(key);
      return null;
    }
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
    const pool = QuizEngine.shuffle(items.filter(_valid)).slice(0, count || 10);
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
