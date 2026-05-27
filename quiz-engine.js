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

  /* ── Age helpers ── */
  function ageGroup(age) {
    const a = parseInt(age) || 8;
    if (a <= 7)  return 'very_easy';
    if (a <= 9)  return 'easy';
    if (a <= 12) return 'medium';
    return 'hard';
  }

  function optionCount(age) {
    const a = parseInt(age) || 8;
    if (a <= 7) return 2;
    if (a <= 9) return 3;
    return 4;
  }

  /* ── Quiz settings helpers ── */
  function getAge()  { return localStorage.getItem('quiz-age')  || '8'; }
  function getLang() { return localStorage.getItem('quiz-lang') || 'pt'; }

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
    ageGroup,
    optionCount,
    getAge,
    getLang,
    shuffle,
    pick,
    buildOptions,
    getHighscore,
    saveHighscore,
    markPlayed,
    getPlayed,
  };
})();
