/* ══════════════════════════════════════════════════════════════════
   QUIZ ENGINE — provider registry, caching, helpers, highscores
══════════════════════════════════════════════════════════════════ */
const QuizEngine = (function () {
  'use strict';

  const _providers = {};
  const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 h

  /* ── Cache ── */
  function getCache(key) {
    try {
      const raw = localStorage.getItem('qc-' + key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem('qc-' + key, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  }

  /* ── Provider registry ── */
  function register(id, provider) { _providers[id] = provider; }

  async function getQuestions(providerId, opts) {
    const p = _providers[providerId];
    if (!p) throw new Error('Unknown quiz provider: ' + providerId);
    return p.getQuestions(opts);
  }

  /* ── Difficulty model ──────────────────────────────────────────────
     The quiz uses three difficulty levels — 'easy' | 'medium' | 'hard'
     (Fácil / Médio / Difícil) — instead of age groups. Knowledge varies
     too much between users for age to be a good proxy.
  ── */
  const DIFFICULTIES = ['easy', 'medium', 'hard'];

  function getDifficulty() {
    const d = localStorage.getItem('quiz-difficulty');
    return DIFFICULTIES.includes(d) ? d : 'easy';
  }
  function setDifficulty(d) {
    if (DIFFICULTIES.includes(d)) localStorage.setItem('quiz-difficulty', d);
  }

  /* Numeric rank 1..3 — used to filter banks tagged with `d` (1/2/3). */
  function diffRank(d) { return d === 'hard' ? 3 : d === 'medium' ? 2 : 1; }

  /* Compatibility shim: legacy providers were written against a numeric
     `age`. We derive a representative age from the chosen difficulty so
     those providers keep selecting the right tier with no rewrite, while
     the entire user-facing model is difficulty-based. */
  function diffToLegacyAge(d) { return d === 'hard' ? 14 : d === 'medium' ? 11 : 8; }

  /* Multiple-choice is standardised: every quiz always offers exactly 4
     options (1 correct + 3 plausible distractors). */
  function optionCount() { return 4; }

  /* ── Quiz settings helpers ── */
  function getLang() { return localStorage.getItem('quiz-lang') || 'pt'; }

  /* Number of questions per round — user-selectable, applies to every quiz. */
  const COUNTS = [5, 10, 15, 20, 25, 30];
  function getCount() {
    const n = parseInt(localStorage.getItem('quiz-count') || '10', 10);
    return COUNTS.includes(n) ? n : 10;
  }
  function setCount(n) { if (COUNTS.includes(n)) localStorage.setItem('quiz-count', String(n)); }

  /* ── Mixed rounds (a whole group, or every topic) ───────────────────
     Pull questions from several providers and blend them into one round.
     We fetch a small share from each provider (shuffled, capped) so even
     "all topics" stays fast, then de-dupe by question text and trim. */
  async function getMixedQuestions(providers, opts) {
    const count = opts.count || 10;
    const list = shuffle(providers.slice());
    const per = Math.max(1, Math.ceil(count / Math.min(list.length, count)));
    let all = [];
    for (const p of list) {
      if (all.length >= count * 2) break;          // enough material gathered
      try {
        const qs = await getQuestions(p, { ...opts, count: per + 1 });
        if (qs && qs.length) all = all.concat(qs);
      } catch (e) { /* skip a failing provider, keep the round alive */ }
    }
    const seen = new Set(), uniq = [];
    for (const q of shuffle(all)) {
      const k = q.question;
      if (!seen.has(k)) { seen.add(k); uniq.push(q); }
    }
    return uniq.slice(0, count);
  }

  /* ── Array utilities ── */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n) {
    return shuffle(arr).slice(0, n);
  }

  /* ── Anti-repeat rotation ───────────────────────────────────────────
     Pick `n` items from `pool` while avoiding the ones served most recently
     for `key`, so the player cycles through (almost) the entire bank before
     anything repeats — even a modest bank then feels fresh. Falls back to the
     full pool once everything has been seen. `idOf` maps an item to a stable id
     (defaults to its question text). State persists in localStorage per key. */
  function pickFresh(pool, n, key, idOf) {
    const id = idOf || (it => (it && (it.q || it.question || it.id || JSON.stringify(it))));
    if (!Array.isArray(pool) || pool.length === 0) return [];
    n = Math.min(n, pool.length);
    const lsKey = 'qrot-' + key;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(lsKey) || '[]') || []; } catch (e) {}
    const recentSet = new Set(recent);
    let avail = pool.filter(it => !recentSet.has(id(it)));
    if (avail.length < n) { avail = pool.slice(); recent = []; } // cycled through → reset
    const chosen = shuffle(avail).slice(0, n);
    /* Remember enough recent ids that we exhaust the pool before repeating. */
    const cap = Math.max(0, pool.length - n);
    const updated = [...chosen.map(id), ...recent].slice(0, cap);
    try { localStorage.setItem(lsKey, JSON.stringify(updated)); } catch (e) {}
    return chosen;
  }

  /* ── Build answer options ─────────────────────────────────────────
     Given a correct answer and pool of distractors, return shuffled
     options array with correctIdx pointing to the right answer.
  ── */
  function buildOptions(correct, distractors, count) {
    const pool = distractors.filter(d => d !== correct);
    const chosen = pick(pool, count - 1);
    const options = shuffle([correct, ...chosen]);
    return { options, correctIdx: options.indexOf(correct) };
  }

  /* ── Highscores ── */
  function getHighscore(quizId) {
    try { return parseInt(localStorage.getItem('qhs-' + quizId) || '0') || 0; }
    catch { return 0; }
  }

  function saveHighscore(quizId, score) {
    try {
      if (score > getHighscore(quizId)) localStorage.setItem('qhs-' + quizId, score);
    } catch {}
  }

  /* ── Completion tracking ── */
  function markPlayed(quizId) {
    try {
      const key = 'qplayed-' + quizId;
      const count = parseInt(localStorage.getItem(key) || '0') + 1;
      localStorage.setItem(key, count);
    } catch {}
  }

  function getPlayed(quizId) {
    try { return parseInt(localStorage.getItem('qplayed-' + quizId) || '0') || 0; }
    catch { return 0; }
  }

  return {
    register,
    getQuestions,
    getCache,
    setCache,
    DIFFICULTIES,
    getDifficulty,
    setDifficulty,
    diffRank,
    diffToLegacyAge,
    optionCount,
    getLang,
    COUNTS,
    getCount,
    setCount,
    getMixedQuestions,
    shuffle,
    pick,
    pickFresh,
    buildOptions,
    getHighscore,
    saveHighscore,
    markPlayed,
    getPlayed,
  };
})();
