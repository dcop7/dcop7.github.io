/* ══════════════════════════════════════════════════════════════════
   GameProgress — unified progress layer for the Games section.
   Built on top of GameStorage (src/games/engine/storage.js) and adds:
     • per-game stats (plays, wins, losses, best score per mode, streak)
     • declarative achievements + toast notifications
     • a deterministic daily-challenge seed (same puzzle for everyone, per day)
     • a shared stats / achievements modal and hub badge helpers
   Everything lives in localStorage; degrades gracefully if storage is blocked.
══════════════════════════════════════════════════════════════════ */
const GameProgress = (function () {
  'use strict';

  const GKEY = 'gp:';                       /* global keys live here          */
  const hasGS = typeof GameStorage !== 'undefined';

  /* ── low-level storage ─────────────────────────────────────────── */
  function _gget(k, def) {
    try { const v = localStorage.getItem(GKEY + k); return v !== null ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function _gset(k, v) { try { localStorage.setItem(GKEY + k, JSON.stringify(v)); } catch (e) {} }

  function store(gameId) {
    if (hasGS) return GameStorage.forGame(gameId);
    /* minimal inline fallback mirroring GameStorage's shape */
    const p = `game:${gameId}`;
    const g = (k, d) => { try { const v = localStorage.getItem(`${p}:${k}`); return v !== null ? JSON.parse(v) : d; } catch (e) { return d; } };
    const s = (k, v) => { try { localStorage.setItem(`${p}:${k}`, JSON.stringify(v)); } catch (e) {} };
    return {
      getHighScore: (m = 'default') => g(`hs:${m}`, 0),
      setHighScore: (sc, m = 'default') => { const c = g(`hs:${m}`, 0); if (sc > c) { s(`hs:${m}`, sc); return true; } return false; },
      getStats: () => g('stats', {}),
      updateStats: (patch) => { const st = g('stats', {}); Object.assign(st, patch); s('stats', st); },
      getPref: (k, d) => g(`pref:${k}`, d), setPref: (k, v) => s(`pref:${k}`, v),
    };
  }

  /* ── dates / seeded RNG ────────────────────────────────────────── */
  function todayKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  /* 32-bit hash of a string → seed */
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dailySeed(salt) { return hashStr(todayKey() + ':' + (salt || '')); }
  /* mulberry32 — small, fast, deterministic PRNG returning [0,1) */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── streak (plays on consecutive days, any game) ──────────────── */
  function _bumpStreak() {
    const today = todayKey();
    const st = _gget('streak', { count: 0, last: null });
    if (st.last === today) return st.count;
    const y = new Date(); y.setDate(y.getDate() - 1);
    st.count = (st.last === todayKey(y)) ? st.count + 1 : 1;
    st.last = today;
    _gset('streak', st);
    return st.count;
  }
  function streak() { const st = _gget('streak', { count: 0, last: null }); return st.last === todayKey() ? st.count : 0; }

  /* ── achievements ──────────────────────────────────────────────── */
  /* defs: { [gameId|'_global']: [{ id, name, desc, icon, test(ctx) }] } */
  const _defs = {};
  function defineAchievements(gameId, list) {
    _defs[gameId] = (_defs[gameId] || []).concat(list || []);
  }
  function unlockedMap() { return _gget('ach', {}); }
  function isUnlocked(id) { return !!unlockedMap()[id]; }
  function achievementCount() { return Object.keys(unlockedMap()).length; }
  function totalAchievements() { return Object.values(_defs).reduce((n, l) => n + l.length, 0); }

  function _evaluate(gameId, ctx) {
    const map = unlockedMap();
    const pool = (_defs[gameId] || []).concat(_defs._global || []);
    const fresh = [];
    pool.forEach(a => {
      if (map[a.id]) return;
      let ok = false;
      try { ok = !!a.test(ctx); } catch (e) { ok = false; }
      if (ok) { map[a.id] = Date.now(); fresh.push(a); }
    });
    if (fresh.length) { _gset('ach', map); fresh.forEach((a, i) => setTimeout(() => toast(a, 'achievement'), i * 1600)); }
    return fresh;
  }

  /* ── per-game stats + record ───────────────────────────────────── */
  function stats(gameId) {
    const s = store(gameId).getStats() || {};
    return Object.assign({ plays: 0, wins: 0, losses: 0, best: {} }, s);
  }
  function bestScore(gameId, mode = 'default') { return (stats(gameId).best || {})[mode] ?? null; }

  /* result: { won?:bool, score?:num, mode?:str, lowerIsBetter?:bool, meta?:obj } */
  function record(gameId, result = {}) {
    const st = store(gameId);
    const s = stats(gameId);
    s.plays += 1;
    if (result.won === true) s.wins += 1;
    else if (result.won === false) s.losses += 1;
    s.last = todayKey();

    let newBest = false;
    if (typeof result.score === 'number' && isFinite(result.score)) {
      const mode = result.mode || 'default';
      s.best = s.best || {};
      const cur = s.best[mode];
      const better = cur == null || (result.lowerIsBetter ? result.score < cur : result.score > cur);
      if (better) { s.best[mode] = result.score; newBest = true; }
    }
    if (result.meta && typeof result.meta === 'object') Object.assign(s, result.meta);
    st.updateStats(s);

    const streakNow = _bumpStreak();
    _markPlayedToday(gameId);

    const ctx = { gameId, result, stats: s, streak: streakNow, distinctPlayed: distinctPlayedCount(), totalPlays: totalPlays() };
    const fresh = _evaluate(gameId, ctx);
    return { stats: s, newBest, streak: streakNow, achievements: fresh };
  }

  /* aggregate helpers (read every game's stats lazily via known ids) */
  let _ids = [];
  function registerIds(ids) { _ids = Array.from(new Set(_ids.concat(ids || []))); }
  function allStats() { const o = {}; _ids.forEach(id => { const s = stats(id); if (s.plays) o[id] = s; }); return o; }
  function distinctPlayedCount() { return Object.keys(allStats()).length; }
  function totalPlays() { return Object.values(allStats()).reduce((n, s) => n + (s.plays || 0), 0); }

  /* ── daily challenge bookkeeping ───────────────────────────────── */
  function _markPlayedToday(gameId) {
    const k = 'daily:' + todayKey();
    const d = _gget(k, {});
    d[gameId] = true;
    _gset(k, d);
  }
  function isDailyDone(gameId) { return !!_gget('daily:' + todayKey(), {})[gameId]; }

  /* ── shared UI (CSS injected once) ─────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('gp-css')) return;
    const s = document.createElement('style'); s.id = 'gp-css';
    s.textContent = `
.gp-toast-wrap{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;width:min(92vw,420px)}
.gp-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;width:100%;background:linear-gradient(135deg,rgba(20,22,40,.97),rgba(30,20,48,.97));border:1px solid var(--accent,#7c5cff);border-radius:14px;padding:12px 16px;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 24px rgba(124,92,255,.25);transform:translateY(20px);opacity:0;transition:transform .35s cubic-bezier(.2,1,.3,1),opacity .35s}
.gp-toast.show{transform:translateY(0);opacity:1}
.gp-toast-ico{font-size:1.9rem;flex:0 0 auto;filter:drop-shadow(0 0 8px var(--accent,#7c5cff))}
.gp-toast-body{min-width:0}
.gp-toast-kicker{font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#a98bff);font-weight:700}
.gp-toast-title{font-size:.95rem;font-weight:800;color:#fff;line-height:1.2}
.gp-toast-desc{font-size:.78rem;color:var(--muted,#9aa)}
@media (prefers-reduced-motion:reduce){.gp-toast{transition:opacity .2s}.gp-toast.show{transform:none}}

.gp-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.gp-badge{display:inline-flex;align-items:center;gap:4px;font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(124,92,255,.14);color:var(--accent,#a98bff);border:1px solid rgba(124,92,255,.3)}
.gp-badge.today{background:rgba(16,185,129,.14);color:#34d399;border-color:rgba(16,185,129,.32)}
.gp-badge.daily{background:rgba(245,158,11,.14);color:#fbbf24;border-color:rgba(245,158,11,.32)}

.gp-modal-back{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px}
.gp-modal{width:min(640px,96vw);max-height:86vh;overflow:auto;background:var(--card,#14162a);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:18px;padding:22px}
.gp-modal h2{margin:0 0 4px;font-size:1.3rem}
.gp-modal-sub{color:var(--muted,#9aa);font-size:.85rem;margin-bottom:16px}
.gp-modal-close{position:absolute;top:14px;right:16px}
.gp-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px}
.gp-stat-card{background:rgba(255,255,255,.04);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:12px;padding:12px}
.gp-stat-num{font-size:1.6rem;font-weight:900;color:var(--accent,#a98bff)}
.gp-stat-lbl{font-size:.72rem;color:var(--muted,#9aa);text-transform:uppercase;letter-spacing:.08em}
.gp-ach-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.gp-ach{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.03);border:1px solid var(--border,rgba(255,255,255,.06));border-radius:12px;padding:10px 12px}
.gp-ach.locked{opacity:.45;filter:grayscale(.7)}
.gp-ach-ico{font-size:1.6rem}
.gp-ach-name{font-weight:700;font-size:.86rem}
.gp-ach-desc{font-size:.72rem;color:var(--muted,#9aa)}`;
    document.head.appendChild(s);
  }

  let _toastWrap = null;
  function toast(a, kicker) {
    _injectCSS();
    if (!_toastWrap) {
      _toastWrap = document.createElement('div');
      _toastWrap.className = 'gp-toast-wrap';
      document.body.appendChild(_toastWrap);
    }
    const el = document.createElement('div');
    el.className = 'gp-toast';
    el.setAttribute('role', 'status');
    const icon = a.icon || '🏆';
    const title = a.name || a.title || 'Conquista!';
    const desc = a.desc || '';
    el.innerHTML = `<div class="gp-toast-ico">${icon}</div>
      <div class="gp-toast-body">
        <div class="gp-toast-kicker">${kicker === 'achievement' ? 'Conquista desbloqueada' : 'Jogos'}</div>
        <div class="gp-toast-title">${title}</div>
        ${desc ? `<div class="gp-toast-desc">${desc}</div>` : ''}
      </div>`;
    _toastWrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4200);
  }

  /* Render small hub-card badges for a game (best score / played today / daily) */
  function badgesHTML(gameId, opts = {}) {
    const s = stats(gameId);
    const out = [];
    if (s.plays) {
      const best = s.best && (s.best.default ?? Object.values(s.best)[0]);
      if (opts.bestLabel && best != null) out.push(`<span class="gp-badge">${opts.bestLabel}: ${best}</span>`);
      else if (s.wins) out.push(`<span class="gp-badge">🏆 ${s.wins}</span>`);
      else out.push(`<span class="gp-badge">▶ ${s.plays}</span>`);
    }
    if (isDailyDone(gameId)) out.push(`<span class="gp-badge today">✓ hoje</span>`);
    return out.length ? `<div class="gp-badges">${out.join('')}</div>` : '';
  }

  /* Full stats + achievements modal (opened from the hub) */
  function openStats() {
    _injectCSS();
    const back = document.createElement('div');
    back.className = 'gp-modal-back';
    const total = totalPlays(), distinct = distinctPlayedCount();
    const ach = unlockedMap();
    const allDefs = Object.values(_defs).flat();
    const achHTML = allDefs.length ? allDefs.map(a => `
      <div class="gp-ach ${ach[a.id] ? '' : 'locked'}">
        <div class="gp-ach-ico">${ach[a.id] ? (a.icon || '🏆') : '🔒'}</div>
        <div><div class="gp-ach-name">${a.name}</div><div class="gp-ach-desc">${a.desc || ''}</div></div>
      </div>`).join('') : '<p class="gp-modal-sub">Joga para desbloquear conquistas.</p>';
    back.innerHTML = `
      <div class="gp-modal" role="dialog" aria-modal="true" aria-label="Estatísticas e conquistas" style="position:relative">
        <button class="hf-new-btn gp-modal-close" id="gp-close" aria-label="Fechar">✕</button>
        <h2>📊 Progresso</h2>
        <div class="gp-modal-sub">O teu desempenho em todos os jogos</div>
        <div class="gp-stat-grid">
          <div class="gp-stat-card"><div class="gp-stat-num">${total}</div><div class="gp-stat-lbl">Jogos jogados</div></div>
          <div class="gp-stat-card"><div class="gp-stat-num">${distinct}</div><div class="gp-stat-lbl">Jogos diferentes</div></div>
          <div class="gp-stat-card"><div class="gp-stat-num">${streak()}</div><div class="gp-stat-lbl">Dias seguidos</div></div>
          <div class="gp-stat-card"><div class="gp-stat-num">${achievementCount()}/${totalAchievements()}</div><div class="gp-stat-lbl">Conquistas</div></div>
        </div>
        <h3 style="margin:0 0 10px;font-size:1rem">🏅 Conquistas</h3>
        <div class="gp-ach-list">${achHTML}</div>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    back.querySelector('#gp-close').addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  }

  /* ── global achievements ───────────────────────────────────────── */
  defineAchievements('_global', [
    { id: 'g.first',     name: 'Primeiro Jogo',   icon: '🎮', desc: 'Joga qualquer jogo.',                   test: c => c.totalPlays >= 1 },
    { id: 'g.explorer',  name: 'Explorador',      icon: '🧭', desc: 'Joga 5 jogos diferentes.',              test: c => c.distinctPlayed >= 5 },
    { id: 'g.collector', name: 'Colecionador',    icon: '🗂️', desc: 'Experimenta todos os jogos.',           test: c => c.distinctPlayed >= 13 },
    { id: 'g.dedicated', name: 'Dedicado',        icon: '🔥', desc: 'Joga 50 partidas no total.',            test: c => c.totalPlays >= 50 },
    { id: 'g.streak3',   name: 'Em Forma',        icon: '📅', desc: 'Joga 3 dias seguidos.',                 test: c => c.streak >= 3 },
    { id: 'g.streak7',   name: 'Imparável',       icon: '⚡', desc: 'Joga 7 dias seguidos.',                 test: c => c.streak >= 7 },
  ]);

  return {
    store, stats, allStats, bestScore, record,
    defineAchievements, isUnlocked, achievementCount, totalAchievements, unlockedMap,
    todayKey, dailySeed, rng, hashStr, streak,
    isDailyDone, registerIds, distinctPlayedCount, totalPlays,
    toast, badgesHTML, openStats,
  };
})();
