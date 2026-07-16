/* ══════════════════════════════════════════════════════════════════
   FitnessPage — secção "🤸 Fitness". Data-driven: categorias em
   data/fitness/index.json, movimentos em data/fitness/movements.json e
   planos (sequências de referências a movimentos) em data/fitness/plans.json.
   Imagens geradas localmente (ComfyUI) em assets/fitness/<id>.jpg.
   Player guiado: barra de duração por alongamento + progresso global,
   beeps opcionais nos últimos 3 s e sinal forte no fim de cada segmento.
   100% offline; sons por WebAudio (sem ficheiros).
══════════════════════════════════════════════════════════════════ */
const FitnessPage = (function () {
  'use strict';

  const BASE = 'data/fitness/';
  const IMG  = 'assets/fitness/';
  let root, data = null;              /* {index, moves:{id→m}, plans:[…]} */
  let player = null;                  /* estado do player ativo */
  let wakeLock = null;

  /* prefs + stats (localStorage) */
  const P = {
    get snd()   { return load('fit:snd', true); },  set snd(v)   { save('fit:snd', v); },
    get beep3() { return load('fit:beep3', true); },set beep3(v) { save('fit:beep3', v); },
  };
  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lang = () => (typeof I18n !== 'undefined' && I18n.getLang() === 'en') ? 'en' : 'pt';
  const LOC = o => (o && typeof o === 'object') ? (o[lang()] || o.pt || '') : (o || '');
  const T = (pt, en) => lang() === 'en' ? en : pt;
  const fmt = x => { const s = Math.max(0, Math.round(x)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  async function getJSON(url) { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  async function loadData() {
    if (data) return data;
    const [idx, mv, pl] = await Promise.all([
      getJSON(BASE + 'index.json'), getJSON(BASE + 'movements.json'), getJSON(BASE + 'plans.json')]);
    const moves = {};
    ((mv && mv.movements) || []).forEach(m => { moves[m.id] = m; });
    data = { index: idx || { categories: [], safety: {} }, moves, plans: (pl && pl.plans) || [] };
    return data;
  }

  /* ── plano → fila de segmentos ─────────────────────────────────── */
  function holdFor(plan, id) { return (plan.overrides && plan.overrides[id]) || plan.holdSec; }

  function buildQueue(plan, moves) {
    const q = [{ t: 'prep', sec: plan.prepSec || 10 }];
    plan.items.forEach((id, i) => {
      const m = moves[id]; if (!m) return;
      const sides = m.bilateral ? ['r', 'l'] : [null];
      sides.forEach((side, si) => {
        q.push({ t: 'work', id, side, sec: holdFor(plan, id) });
        const last = i === plan.items.length - 1 && si === sides.length - 1;
        if (!last) q.push({ t: 'rest', sec: si < sides.length - 1 ? (plan.sideRestSec || 5) : (plan.moveRestSec || 10) });
      });
    });
    /* preview do próximo em cada descanso/prep */
    q.forEach((s, i) => { if (s.t !== 'work') s.next = q.slice(i + 1).find(x => x.t === 'work') || null; });
    return q;
  }
  const queueDuration = q => q.reduce((a, s) => a + s.sec, 0);
  const planDuration = plan => queueDuration(buildQueue(plan, data.moves));
  const planSegments = plan => buildQueue(plan, data.moves).filter(s => s.t === 'work').length;

  /* ── lifecycle ─────────────────────────────────────────────────── */
  function show(sub) {
    root = document.getElementById('view-fitness');
    if (!root) return;
    loadData().then(() => { sub ? renderPlan(sub) : renderHome(); });
  }

  /* ── landing ───────────────────────────────────────────────────── */
  function renderHome() {
    const cats = data.index.categories || [];
    const safety = data.index.safety ? (data.index.safety[lang()] || data.index.safety.pt || []) : [];
    root.innerHTML = `
      <div class="view-inner">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('fitness', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">Fitness</h1>
            <p class="ph-sub">${T('Planos guiados de alongamento — escolhe a duração e segue o ritmo', 'Guided stretching plans — pick a duration and follow the pace')}</p>
          </div>
        </div>
        <div class="fit-cats">
          ${cats.map(c => `
            <div class="fit-cat${c.available ? '' : ' off'}">
              <span class="fit-cat-ico">${c.icon || '🤸'}</span>
              <span class="fit-cat-body">
                <span class="fit-cat-name">${esc(LOC(c.name))}${c.available ? '' : ` <span class="fit-soon">${T('em breve', 'soon')}</span>`}</span>
                <span class="fit-cat-desc">${esc(LOC(c.desc))}</span>
              </span>
            </div>`).join('')}
        </div>
        <div class="fit-plans">
          ${data.plans.map(p => {
            const dur = planDuration(p), segs = planSegments(p);
            return `
            <a class="fit-plan" href="#fitness/${p.id}">
              <span class="fit-plan-img"><img src="${IMG}tronco-lateral.jpg" alt="" loading="lazy" onerror="this.remove()"></span>
              <span class="fit-plan-body">
                <span class="fit-plan-name">${esc(LOC(p.name))}</span>
                <span class="fit-plan-desc">${esc(LOC(p.desc))}</span>
                <span class="fit-plan-meta">
                  <span class="chip">⏱ ${fmt(dur)}</span>
                  <span class="chip">${p.items.length} ${T('exercícios', 'exercises')}</span>
                  <span class="chip">${segs} ${T('alongamentos', 'stretches')}</span>
                  <span class="chip">${p.holdSec}s/${T('lado', 'side')}</span>
                </span>
              </span>
            </a>`;
          }).join('')}
        </div>
        <div class="fit-safety">
          <h3>${T('Regras gerais', 'General rules')}</h3>
          <ul>${safety.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>
      </div>`;
  }

  /* ── detalhe do plano ──────────────────────────────────────────── */
  function renderPlan(id) {
    const plan = data.plans.find(p => p.id === id);
    if (!plan) { renderHome(); return; }
    const dur = planDuration(plan), segs = planSegments(plan);
    root.innerHTML = `
      <div class="view-inner">
        <div class="page-head">
          <button class="btn fit-back" id="fit-back" aria-label="${T('Voltar', 'Back')}">←</button>
          <div class="ph-titles">
            <h1 class="ph-title">${esc(LOC(plan.name))}</h1>
            <p class="ph-sub">${esc(LOC(plan.desc))} · ⏱ ${fmt(dur)} · ${segs} ${T('alongamentos', 'stretches')} · ${plan.holdSec}s/${T('lado', 'side')}</p>
          </div>
          <button class="btn primary fit-start" id="fit-start">▶ ${T('Começar', 'Start')}</button>
        </div>
        <div class="fit-list">
          ${plan.items.map((mid, i) => {
            const m = data.moves[mid]; if (!m) return '';
            return `
            <div class="fit-mv">
              <span class="fit-mv-n">${i + 1}</span>
              <span class="fit-mv-img"><img src="${IMG}${mid}.jpg" alt="${esc(LOC(m.name))}" loading="lazy" onerror="this.remove()"></span>
              <span class="fit-mv-body">
                <span class="fit-mv-name">${esc(LOC(m.name))}
                  ${m.bilateral ? `<span class="fit-badge">${T('2 lados', '2 sides')} · ${holdFor(plan, mid)}s ${T('cada', 'each')}</span>`
                                : `<span class="fit-badge">${holdFor(plan, mid)}s</span>`}
                </span>
                <span class="fit-mv-area">${esc(LOC(m.area))}</span>
                <ol class="fit-mv-steps">${(m.steps[lang()] || m.steps.pt).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
              </span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    root.querySelector('#fit-back').addEventListener('click', () => Nav.go('fitness'));
    root.querySelector('#fit-start').addEventListener('click', () => startPlayer(plan));
  }

  /* ── áudio (WebAudio, sem ficheiros) ───────────────────────────── */
  let _ac = null;
  function ac() { if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (_ac && _ac.state === 'suspended') _ac.resume(); return _ac; }
  function tone(freq, dur, delay, type, gain) {
    const c = ac(); if (!c || !P.snd) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain || .22, t0);
    g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + .05);
  }
  const sTick   = () => tone(880, .09, 0, 'square', .15);              /* últimos 3 s */
  const sEnd    = () => { tone(587, .16, 0, 'sine', .3); tone(392, .4, .14, 'sine', .34); };  /* fim de alongamento — forte */
  const sGo     = () => tone(988, .14, 0, 'sine', .26);                /* começa o próximo */
  const sFinish = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .28, i * .16, 'sine', .3));

  /* ── wake lock ─────────────────────────────────────────────────── */
  async function lockScreen() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) {} }
  function unlockScreen() { try { wakeLock?.release(); } catch (e) {} wakeLock = null; }
  document.addEventListener('visibilitychange', () => { if (player && document.visibilityState === 'visible') lockScreen(); });

  /* ── player ────────────────────────────────────────────────────── */
  function startPlayer(plan) {
    const q = buildQueue(plan, data.moves);
    player = {
      plan, q, i: 0, total: queueDuration(q),
      done: 0,                 /* segundos completados nos segmentos anteriores */
      endAt: 0, remain: q[0].sec, paused: false, lastBeep: -1,
    };
    const el = document.createElement('div');
    el.className = 'fit-player'; el.id = 'fit-player';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', LOC(plan.name));
    document.body.appendChild(el);
    document.body.classList.add('fit-playing');
    player.el = el;
    lockScreen();
    ac();                       /* desbloqueia o áudio no gesto do clique */
    enterSeg(0);
    player.timer = setInterval(tick, 100);
    document.addEventListener('keydown', onKeys);
  }

  function speed() { return FitnessPage._speed || 1; }

  function enterSeg(i) {
    const p = player; if (!p) return;
    p.i = i;
    p.done = p.q.slice(0, i).reduce((a, s) => a + s.sec, 0);
    const seg = p.q[i];
    p.remain = seg.sec;
    p.endAt = performance.now() + seg.sec * 1000 / speed();
    p.lastBeep = -1;
    renderSeg();
  }

  function tick() {
    const p = player; if (!p || p.paused) return;
    const seg = p.q[p.i];
    const remainMs = p.endAt - performance.now();
    const remain = Math.max(0, Math.ceil(remainMs * speed() / 1000));
    if (remain !== p.remain) {
      p.remain = remain;
      /* beeps nos últimos 3 s (opção) — só em segmentos de alongamento/preparação */
      if (P.beep3 && remain >= 1 && remain <= 3 && seg.t !== 'rest' && p.lastBeep !== remain) { p.lastBeep = remain; sTick(); }
      updateClock();
    }
    if (remainMs <= 0) {
      if (seg.t === 'work') sEnd(); else sGo();
      if (p.i + 1 < p.q.length) enterSeg(p.i + 1);
      else finish();
    } else {
      updateBars();
    }
  }

  function segTitle(seg) {
    if (!seg) return '';
    if (seg.t === 'prep') return T('Prepara-te', 'Get ready');
    if (seg.t === 'rest') return T('Descansa', 'Rest');
    const m = data.moves[seg.id];
    return LOC(m.name);
  }
  const sideLabel = s => s === 'r' ? T('Lado direito', 'Right side') : s === 'l' ? T('Lado esquerdo', 'Left side') : '';

  function renderSeg() {
    const p = player, seg = p.q[p.i];
    const workIdx = p.q.slice(0, p.i + 1).filter(s => s.t === 'work').length;
    const workTot = p.q.filter(s => s.t === 'work').length;
    const m = seg.t === 'work' ? data.moves[seg.id] : (seg.next ? data.moves[seg.next.id] : null);
    const phase = seg.t === 'work' ? T('Alonga', 'Stretch') : seg.t === 'prep' ? T('Prepara-te', 'Get ready') : T('Descansa', 'Rest');
    const showSide = seg.t === 'work' ? seg.side : (seg.next && seg.next.side);

    p.el.innerHTML = `
      <div class="fit-pl-top">
        <button class="fit-pl-btn" id="flp-close" title="Esc">✕</button>
        <span class="fit-pl-title">${esc(LOC(p.plan.name))}</span>
        <span class="fit-pl-count-lbl">${seg.t === 'work' ? workIdx : Math.min(workIdx + 1, workTot)}/${workTot}</span>
        <span class="fit-pl-sp"></span>
        <button class="fit-pl-btn tgl${P.snd ? ' on' : ''}" id="flp-snd" title="${T('Som', 'Sound')}">${P.snd ? '🔊' : '🔇'}</button>
        <button class="fit-pl-btn tgl${P.beep3 ? ' on' : ''}" id="flp-b3" title="${T('Apitar últimos 3 s', 'Beep last 3 s')}">3s</button>
      </div>
      <div class="fit-pl-main ${seg.t}">
        <div class="fit-pl-media">
          ${m ? `<img src="${IMG}${m.id}.jpg" alt="${esc(LOC(m.name))}" onerror="this.remove()">` : `<div class="fit-pl-noimg">🧘</div>`}
          <span class="fit-pl-phase ${seg.t}">${phase}</span>
          ${showSide ? `<span class="fit-pl-side">${sideLabel(showSide)}</span>` : ''}
        </div>
        <div class="fit-pl-info">
          <h2 class="fit-pl-name">${seg.t === 'work' ? esc(segTitle(seg)) : (m ? `${T('A seguir', 'Up next')}: ${esc(LOC(m.name))}` : esc(segTitle(seg)))}</h2>
          <div class="fit-pl-clock" id="flp-clock">${p.remain}</div>
          <div class="fit-pl-bar"><i id="flp-bar"></i></div>
          ${m ? `<ol class="fit-pl-steps">${(m.steps[lang()] || m.steps.pt).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          <div class="fit-pl-ctl">
            <button class="fit-pl-btn big" id="flp-prev" title="←">⏮</button>
            <button class="fit-pl-btn big primary" id="flp-pause" title="${T('Espaço', 'Space')}">${p.paused ? '▶' : '❚❚'}</button>
            <button class="fit-pl-btn big" id="flp-next" title="→">⏭</button>
          </div>
        </div>
      </div>
      <div class="fit-pl-global"><i id="flp-glob"></i><span id="flp-globtxt"></span></div>`;

    p.el.querySelector('#flp-close').addEventListener('click', stopPlayer);
    p.el.querySelector('#flp-pause').addEventListener('click', togglePause);
    p.el.querySelector('#flp-prev').addEventListener('click', () => jump(-1));
    p.el.querySelector('#flp-next').addEventListener('click', () => jump(1));
    p.el.querySelector('#flp-snd').addEventListener('click', function () { P.snd = !P.snd; this.classList.toggle('on', P.snd); this.textContent = P.snd ? '🔊' : '🔇'; });
    p.el.querySelector('#flp-b3').addEventListener('click', function () { P.beep3 = !P.beep3; this.classList.toggle('on', P.beep3); });
    updateBars(); updateClock();
  }

  function updateClock() {
    const el = document.getElementById('flp-clock');
    if (el) el.textContent = player.remain;
  }
  function updateBars() {
    const p = player; if (!p) return;
    const seg = p.q[p.i];
    const elapsedSeg = seg.sec - Math.max(0, (p.endAt - performance.now()) * speed() / 1000);
    const bar = document.getElementById('flp-bar');
    if (bar) bar.style.width = `${Math.min(100, elapsedSeg / seg.sec * 100)}%`;
    const g = document.getElementById('flp-glob');
    const done = p.done + elapsedSeg;
    if (g) g.style.width = `${Math.min(100, done / p.total * 100)}%`;
    const gt = document.getElementById('flp-globtxt');
    if (gt) gt.textContent = `${fmt(done)} / ${fmt(p.total)}`;
  }

  function togglePause() {
    const p = player; if (!p) return;
    if (p.paused) { p.endAt = performance.now() + p.remainMs; p.paused = false; }
    else { p.remainMs = Math.max(0, p.endAt - performance.now()); p.paused = true; }
    const b = document.getElementById('flp-pause');
    if (b) b.textContent = p.paused ? '▶' : '❚❚';
  }
  function jump(dir) {
    const p = player; if (!p) return;
    /* salta para o segmento de alongamento anterior/seguinte */
    let i = p.i + dir;
    while (i > 0 && i < p.q.length && p.q[i].t === 'rest') i += dir;
    if (i >= p.q.length) { finish(); return; }
    p.paused = false;
    enterSeg(Math.max(0, i));
  }
  function onKeys(e) {
    if (!player) return;
    if (e.key === 'Escape') { e.preventDefault(); stopPlayer(); }
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); jump(1); }
  }

  function finish() {
    const p = player; if (!p) return;
    clearInterval(p.timer);
    sFinish();
    const mins = Math.round(p.total / 60);
    const st = load('fit:stats', { sessions: 0, minutes: 0, streak: 0, last: '' });
    const today = new Date().toISOString().slice(0, 10);
    if (st.last !== today) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      st.streak = st.last === y ? st.streak + 1 : 1;
      st.last = today;
    }
    st.sessions += 1; st.minutes += mins;
    save('fit:stats', st);
    p.el.innerHTML = `
      <div class="fit-pl-done">
        <div class="fit-pl-done-ico">🎉</div>
        <h2>${T('Plano concluído!', 'Plan complete!')}</h2>
        <p>${esc(LOC(p.plan.name))} · ${fmt(p.total)}</p>
        <div class="fit-pl-done-stats">
          <span class="chip">🔥 ${st.streak} ${T('dias seguidos', 'day streak')}</span>
          <span class="chip">✅ ${st.sessions} ${T('sessões', 'sessions')}</span>
          <span class="chip">⏱ ${st.minutes} min ${T('no total', 'total')}</span>
        </div>
        <button class="btn primary" id="flp-done">${T('Fechar', 'Close')}</button>
      </div>`;
    p.el.querySelector('#flp-done').addEventListener('click', stopPlayer);
    player.finished = true;
  }

  function stopPlayer() {
    if (!player) return;
    clearInterval(player.timer);
    document.removeEventListener('keydown', onKeys);
    player.el.remove();
    document.body.classList.remove('fit-playing');
    unlockScreen();
    player = null;
  }

  document.addEventListener('langchange', () => {
    if (root && root.classList.contains('active') && data) {
      const h = location.hash.slice(1);
      const sub = h.startsWith('fitness/') ? h.slice(8) : null;
      sub ? renderPlan(sub) : renderHome();
    }
  });

  return { show, _get: () => ({ data, player }), _speed: 0 };
})();
