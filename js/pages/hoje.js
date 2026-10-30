/* ══════════════════════════════════════════════════════════════════
   HOJE — o encontro diário: quiz do dia · piada do dia · jogo do dia
   ──────────────────────────────────────────────────────────────────
   Tudo determinístico pelo dia (AppTime.dayKey): quem abre a página no
   mesmo dia recebe as mesmas 5 perguntas, a mesma piada e o mesmo jogo,
   e à meia-noite (evento time:day) muda tudo sem recarregar.

   • Quiz — 5 temas diferentes, dificuldade a subir (fácil → difícil),
     lido diretamente dos bancos quizzes/<tema>/pt/<nível>.json. As
     respostas ficam em localStorage, por isso dá para sair a meio e
     voltar; no fim há grelha de resultado para partilhar.
   • Piada — o mesmo sorteio do Humor (Daily.jokeOfDay); as favoritas
     vão para a mesma chave `humor-favs`.
   • Jogo — GameProgress.dailyGameId(), o mesmo "Desafio Diário" do hub
     dos Jogos; fica concluído quando o jogo regista uma partida hoje.
   ══════════════════════════════════════════════════════════════════ */
const HojePage = (function () {
  'use strict';

  const KEY = 'hoje:v1';
  const KEEP_DAYS = 60;

  /* Temas que entram no sorteio (bancos de texto com ≥120 perguntas PT). */
  const TOPICS = [
    { id: 'gk',         icon: '🧠', name: 'Cultura Geral' },
    { id: 'history',    icon: '📜', name: 'História' },
    { id: 'science',    icon: '🔬', name: 'Ciência' },
    { id: 'portugal',   icon: '🏰', name: 'Portugal' },
    { id: 'geografia',  icon: '🌍', name: 'Geografia' },
    { id: 'animals',    icon: '🐾', name: 'Animais' },
    { id: 'body',       icon: '🫀', name: 'Corpo Humano' },
    { id: 'solar',      icon: '🚀', name: 'Espaço' },
    { id: 'sport',      icon: '⚽', name: 'Desporto' },
    { id: 'music',      icon: '🎵', name: 'Música' },
    { id: 'tecnologia', icon: '💻', name: 'Tecnologia' },
    { id: 'mitologia',  icon: '⚡', name: 'Mitologia' },
    { id: 'vehicles',   icon: '🚗', name: 'Transportes' },
  ];
  const LEVELS = ['easy', 'easy', 'medium', 'medium', 'hard'];
  const LEVEL_PT = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };

  /* Os 6 jogos do sorteio diário (nomes/descrições como no hub dos Jogos). */
  const GAME_META = {
    wordle:      { icon: '📝', name: 'Palavra do Dia',  desc: 'Descobre a palavra de 5 letras em 6 tentativas.' },
    minesweeper: { icon: '💣', name: 'Campo de Minas',  desc: 'Encontra as minas sem as detonar.' },
    memory:      { icon: '🃏', name: 'Memória',         desc: 'Encontra todos os pares de cartas.' },
    bomb:        { icon: '💥', name: 'Desarmar Bomba',  desc: 'Resolve os desafios antes que o tempo acabe.' },
    reaction:    { icon: '⚡', name: 'Teste de Reação', desc: 'Quanto tempo demoras a reagir?' },
    sudoku:      { icon: '9️⃣', name: 'Sudoku',          desc: 'Uma grelha com solução única — com notas e pistas.' },
  };

  let root = null, built = false;
  let dk = null;                 /* dia que está pintado */
  let quiz = null;               /* { qs:[…], loading, error } */
  let joke = null, jokeRiddle = false;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayKey = () => (typeof AppTime !== 'undefined' ? AppTime.dayKey() : new Date().toISOString().slice(0, 10));
  const now = () => (typeof AppTime !== 'undefined' ? AppTime.now() : new Date());

  /* ── estado guardado ───────────────────────────────────────────── */
  function loadState() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return s; } catch (e) {}
    return { days: {}, streak: { count: 0, last: null } };
  }
  function saveState(s) {
    const keys = Object.keys(s.days).sort();
    while (keys.length > KEEP_DAYS) delete s.days[keys.shift()];
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function dayState(s) { return (s.days[dk] = s.days[dk] || { answers: [] }); }

  function prevDayKey(k) {
    const [y, m, d] = k.split('-').map(Number);
    const t = new Date(y, m - 1, d - 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  /* Sequência = dias seguidos com o quiz do dia terminado. */
  function streakNow(s) {
    const st = s.streak || { count: 0, last: null };
    return (st.last === dk || st.last === prevDayKey(dk)) ? st.count : 0;
  }
  function bumpStreak(s) {
    const st = s.streak || { count: 0, last: null };
    if (st.last === dk) return;
    st.count = st.last === prevDayKey(dk) ? st.count + 1 : 1;
    st.last = dk;
    s.streak = st;
  }

  /* ── sorteios ──────────────────────────────────────────────────── */
  const GP = () => (typeof GameProgress !== 'undefined' ? GameProgress : null);
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const _banks = {};
  async function bank(topic, level) {
    const k = topic + '/' + level;
    if (!_banks[k]) {
      _banks[k] = fetch(`quizzes/${topic}/pt/${level}.json`)
        .then(r => (r.ok ? r.json() : []))
        .then(d => (Array.isArray(d) ? d : (d && d.questions) || []))
        .catch(() => []);
    }
    return _banks[k];
  }
  /* Só perguntas que este cartão sabe mostrar: 4 opções com a resposta
     entre elas, e imagem só dos tipos "bandeira" ou "foto". */
  const usable = q => q && q.q && Array.isArray(q.opts) && q.opts.length >= 2 && q.opts.includes(q.a)
    && (!q.img || q.imgType === 'flag' || q.imgType === 'img');

  async function buildQuiz() {
    const r = rng(hashStr(dk + ':quiz-do-dia'));
    const topics = shuffled(TOPICS, r);
    const qs = [];
    for (let i = 0; i < topics.length && qs.length < LEVELS.length; i++) {
      const level = LEVELS[qs.length];
      const pool = (await bank(topics[i].id, level)).filter(usable);
      if (!pool.length) continue;
      const q = pool[Math.floor(r() * pool.length)];
      qs.push({ ...q, topic: topics[i], level, opts: shuffled(q.opts, r) });
    }
    return qs;
  }

  /* ── shell ─────────────────────────────────────────────────────── */
  function dateLabel() {
    const s = now().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function untilMidnight() {
    const n = now(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    const mins = Math.max(1, Math.round((m - n) / 60000));
    const h = Math.floor(mins / 60), mm = mins % 60;
    return h ? `${h} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
  }

  function renderShell() {
    root.innerHTML = `
      <div class="view-inner hj">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('hoje', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">Hoje</h1>
            <p class="ph-sub"><span id="hj-date">${dateLabel()}</span> · um quiz, uma piada e um jogo — os mesmos para toda a gente, novos à meia-noite</p>
          </div>
          <div class="ph-actions" id="hj-progress"></div>
        </div>
        <div class="hj-grid">
          <section class="hj-card hj-quiz" id="hj-quiz" aria-labelledby="hj-quiz-ttl"></section>
          <section class="hj-card hj-joke" id="hj-joke" aria-labelledby="hj-joke-ttl"></section>
          <section class="hj-card hj-game" id="hj-game" aria-labelledby="hj-game-ttl"></section>
        </div>
        <div class="hj-more">
          <span class="hj-more-lbl">Também hoje</span>
          <a class="chip" href="#explorer/sky">🌙 O céu desta noite</a>
          <a class="chip" href="#explorer/explain">🧪 Explicações interativas</a>
          <a class="chip" href="#home">📜 Hoje na história</a>
          <span class="hj-next" id="hj-next">Novo dia daqui a ${untilMidnight()}</span>
        </div>
      </div>`;
  }

  function renderProgress() {
    const el = root && root.querySelector('#hj-progress');
    if (!el) return;
    const s = loadState(), d = s.days[dk] || {};
    const done = [!!d.quizDone, !!d.joke, gameDone()];
    const n = done.filter(Boolean).length;
    const st = streakNow(s);
    const C = 2 * Math.PI * 15;
    el.innerHTML = `
      <div class="hj-ring" role="img" aria-label="${n} de 3 feitos hoje">
        <svg viewBox="0 0 36 36" width="40" height="40" aria-hidden="true">
          <circle cx="18" cy="18" r="15" class="hj-ring-bg"/>
          <circle cx="18" cy="18" r="15" class="hj-ring-fg" stroke-dasharray="${(C * n / 3).toFixed(2)} ${C.toFixed(2)}"/>
        </svg>
        <span>${n}/3</span>
      </div>
      <div class="hj-prog-txt">
        <strong>${n === 3 ? 'Dia completo!' : n ? 'Bom ritmo' : 'Por fazer'}</strong>
        <small>${st > 1 ? `🔥 ${st} dias seguidos de quiz` : st ? '🔥 1.º dia da sequência de quiz' : 'Faz o quiz para começar uma sequência'}</small>
      </div>`;
  }

  /* ── QUIZ ──────────────────────────────────────────────────────── */
  async function renderQuiz() {
    const el = root.querySelector('#hj-quiz');
    if (!quiz) {
      el.innerHTML = `<div class="hj-kicker">🧠 Quiz do dia</div><div class="hj-loading">A preparar as perguntas…</div>`;
      const forDay = dk;
      const qs = await buildQuiz();
      if (forDay !== dk) return;
      quiz = { qs };
    }
    const qs = quiz.qs;
    if (!qs.length) {
      el.innerHTML = `<div class="hj-kicker">🧠 Quiz do dia</div>
        <div class="empty-state"><div class="es-title">Não foi possível carregar as perguntas</div>
        <div class="es-hint">Verifica a ligação e tenta outra vez.</div>
        <button class="btn btn-sm" id="hj-retry">Tentar outra vez</button></div>`;
      el.querySelector('#hj-retry').onclick = () => { quiz = null; Object.keys(_banks).forEach(k => delete _banks[k]); renderQuiz(); };
      return;
    }
    const s = loadState(), d = dayState(s);
    const answers = d.answers || [];
    if (d.quizDone || answers.length >= qs.length) return quizResult(el, qs, answers);
    if (!d.started) return quizIntro(el, qs);
    quizQuestion(el, qs, answers);
  }

  function quizIntro(el, qs) {
    el.innerHTML = `
      <div class="hj-kicker">🧠 Quiz do dia</div>
      <h2 class="hj-ttl" id="hj-quiz-ttl">${qs.length} perguntas, ${qs.length} temas</h2>
      <p class="hj-lead">Começa fácil e acaba difícil. Depois de responderes, aparece sempre uma curiosidade sobre a pergunta.</p>
      <ol class="hj-topics">
        ${qs.map((q, i) => `<li><span class="hj-t-ico">${q.topic.icon}</span><span>${esc(q.topic.name)}</span><small class="hj-lv hj-lv-${q.level}">${LEVEL_PT[q.level]}</small></li>`).join('')}
      </ol>
      <button class="btn btn-primary hj-start" id="hj-start">Começar o quiz</button>`;
    el.querySelector('#hj-start').onclick = () => {
      const s = loadState(); dayState(s).started = true; saveState(s);
      renderQuiz();
      el.querySelector('.hj-q')?.focus();
    };
  }

  function dots(qs, answers, cur) {
    return `<div class="hj-dots" aria-hidden="true">${qs.map((q, i) => {
      const a = answers[i];
      const cls = a == null ? (i === cur ? 'cur' : '') : (a === q.a ? 'ok' : 'bad');
      return `<span class="hj-dot ${cls}"></span>`;
    }).join('')}</div>`;
  }

  function qImage(q) {
    if (!q.img) return '';
    const cls = q.imgType === 'flag' ? 'hj-q-flag' : 'hj-q-photo';
    return `<img class="${cls}" src="${esc(q.img)}" alt="" loading="lazy" onerror="this.remove()">`;
  }

  /* Mostra a pergunta `answers.length` (ou a anterior, já respondida, se
     `reveal` vier com o índice — para o utilizador ler a curiosidade). */
  function quizQuestion(el, qs, answers, reveal) {
    const i = reveal != null ? reveal : answers.length;
    const q = qs[i];
    const picked = answers[i];
    const answered = picked != null;
    el.innerHTML = `
      <div class="hj-qhead">
        <div class="hj-kicker">🧠 Quiz do dia · ${i + 1}/${qs.length}</div>
        ${dots(qs, answers, i)}
      </div>
      <div class="hj-qmeta"><span>${q.topic.icon} ${esc(q.topic.name)}</span><small class="hj-lv hj-lv-${q.level}">${LEVEL_PT[q.level]}</small></div>
      <h2 class="hj-q" id="hj-quiz-ttl" tabindex="-1">${esc(q.q)}</h2>
      ${qImage(q)}
      <div class="hj-opts" role="group" aria-label="Opções de resposta">
        ${q.opts.map(o => {
          let cls = '';
          if (answered) cls = o === q.a ? ' ok' : (o === picked ? ' bad' : ' dim');
          return `<button class="hj-opt${cls}" data-opt="${esc(o)}"${answered ? ' disabled' : ''}>${esc(o)}</button>`;
        }).join('')}
      </div>
      <div class="hj-fact" id="hj-fact" aria-live="polite">${answered ? factHTML(q, picked) : ''}</div>
      ${answered ? `<div class="hj-qnav"><button class="btn btn-primary" id="hj-next-q">${i + 1 < qs.length ? 'Pergunta seguinte →' : 'Ver resultado'}</button></div>` : ''}`;

    el.querySelectorAll('.hj-opt:not([disabled])').forEach(b => b.addEventListener('click', () => {
      const s = loadState(), d = dayState(s);
      d.answers = (d.answers || []).slice(0, i);
      d.answers[i] = b.dataset.opt;
      if (d.answers.length >= qs.length) {
        d.quizDone = true;
        d.score = qs.reduce((n, qq, k) => n + (d.answers[k] === qq.a ? 1 : 0), 0);
        bumpStreak(s);
      }
      saveState(s);
      quizQuestion(el, qs, d.answers, i);
      renderProgress();
      el.querySelector('#hj-next-q')?.focus();
    }));
    el.querySelector('#hj-next-q')?.addEventListener('click', () => {
      const d = loadState().days[dk] || {};
      if (d.quizDone) quizResult(el, qs, d.answers || []);
      else { quizQuestion(el, qs, d.answers || []); el.querySelector('.hj-q')?.focus(); }
    });
  }

  function factHTML(q, picked) {
    const ok = picked === q.a;
    return `<div class="hj-verdict ${ok ? 'ok' : 'bad'}">${ok ? '✓ Certo!' : `✗ Era <strong>${esc(q.a)}</strong>`}</div>
      ${q.exp ? `<p class="hj-exp">💡 ${esc(q.exp)}</p>` : ''}`;
  }

  const grid = (qs, answers) => qs.map((q, i) => (answers[i] === q.a ? '🟩' : '🟥')).join('');
  const verdict = n => n === 5 ? 'Perfeito! Cinco em cinco.' : n === 4 ? 'Muito bem — só escapou uma.' : n === 3 ? 'Nada mal! Mais de metade.' : n === 2 ? 'Hoje estava difícil. Amanhã há mais.' : 'Dia de aprender coisas novas — vê as curiosidades em baixo.';

  function quizResult(el, qs, answers) {
    const n = qs.reduce((k, q, i) => k + (answers[i] === q.a ? 1 : 0), 0);
    el.innerHTML = `
      <div class="hj-kicker">🧠 Quiz do dia · concluído</div>
      <div class="hj-result">
        <div class="hj-score" id="hj-quiz-ttl"><strong>${n}</strong><span>/${qs.length}</span></div>
        <div>
          <div class="hj-grid-emoji" aria-label="${n} certas em ${qs.length}">${grid(qs, answers)}</div>
          <p class="hj-lead">${verdict(n)}</p>
        </div>
      </div>
      <div class="hj-actions">
        <button class="btn btn-primary" id="hj-share">Partilhar resultado</button>
        <a class="btn" href="#quiz">Mais quizzes →</a>
      </div>
      <details class="hj-review" open>
        <summary>Rever as respostas e curiosidades</summary>
        <ol>
          ${qs.map((q, i) => `<li class="${answers[i] === q.a ? 'ok' : 'bad'}">
            <div class="hj-rv-q">${q.topic.icon} ${esc(q.q)}</div>
            <div class="hj-rv-a">${answers[i] === q.a ? '✓' : `✗ ${esc(answers[i] || '—')} ·`} <strong>${esc(q.a)}</strong></div>
            ${q.exp ? `<div class="hj-rv-exp">💡 ${esc(q.exp)}</div>` : ''}
          </li>`).join('')}
        </ol>
      </details>`;
    el.querySelector('#hj-share').onclick = e => share(e.currentTarget, qs, answers, n);
  }

  async function share(btn, qs, answers, n) {
    const [y, m, d] = dk.split('-');
    const text = `Quiz do Dia · ${d}/${m}/${y}\n${grid(qs, answers)} ${n}/${qs.length}\nhttps://dcop7.github.io/#hoje`;
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = old; }, 1800);
    } catch (e) { /* partilha cancelada — nada a fazer */ }
  }

  /* ── PIADA ─────────────────────────────────────────────────────── */
  function jid(cat, j) {   /* o mesmo id por conteúdo que o Humor usa */
    const s = (j.t || '') + '|' + (j.q || '') + '|' + (j.a || '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return cat + '-' + (h >>> 0).toString(36);
  }
  let _hIndex = null, _hGroups = null;
  async function humorIndex() {
    if (!_hIndex) {
      const d = await fetch('data/humor/index.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
      _hIndex = (d && d.categories) || [];
      _hGroups = (d && d.groups) || [];
    }
    return _hIndex;
  }
  async function loadCat(id) {
    const d = await fetch(`data/humor/${id}.json`).then(r => (r.ok ? r.json() : [])).catch(() => []);
    return (Array.isArray(d) ? d : []).map(j => ({ ...j, cat: id, id: jid(id, j) }));
  }
  const favs = () => { try { return JSON.parse(localStorage.getItem('humor-favs')) || {}; } catch (e) { return {}; } };

  async function renderJoke() {
    const el = root.querySelector('#hj-joke');
    if (!joke) {
      el.innerHTML = `<div class="hj-kicker">😂 Piada do dia</div><div class="hj-loading">A escolher…</div>`;
      const forDay = dk;
      const idx = await humorIndex();
      const j = await Daily.jokeOfDay(idx, loadCat);
      if (forDay !== dk) return;
      if (!j) { el.innerHTML = `<div class="hj-kicker">😂 Piada do dia</div><div class="hj-loading">Sem piada hoje — tenta mais tarde.</div>`; return; }
      joke = j;
      const cat = idx.find(c => c.id === j.cat);
      jokeRiddle = !!cat && cat.group === 'enigmas';
      joke.catName = cat ? cat.name : '';
      joke.catIcon = cat ? cat.icon : '😂';
    }
    const j = joke;
    const d = (loadState().days[dk]) || {};
    const fav = !!favs()[j.id];
    const showAns = !jokeRiddle || d.revealed;
    el.innerHTML = `
      <div class="hj-kicker-row">
        <div class="hj-kicker">😂 Piada do dia</div>
        <button class="hj-star${fav ? ' on' : ''}" id="hj-star" aria-pressed="${fav}" title="${fav ? 'Tirar das favoritas' : 'Guardar nas favoritas do Humor'}" aria-label="Favorita">${fav ? '★' : '☆'}</button>
      </div>
      <span class="hj-tag">${j.catIcon} ${esc(j.catName)}</span>
      <h2 class="sr-only" id="hj-joke-ttl">Piada do dia</h2>
      ${j.q && j.a
        ? `<p class="hj-jq">${esc(j.q)}</p>
           ${showAns ? `<p class="hj-ja">${esc(j.a).replace(/\n/g, '<br>')}</p>` : `<button class="btn btn-sm" id="hj-reveal">Ver resposta 👀</button>`}`
        : `<p class="hj-jt">${esc(j.t || '').replace(/\n/g, '<br>')}</p>`}
      <div class="hj-react">
        ${d.joke
          ? `<span class="hj-reacted">${d.joke === 'lol' ? '😂 Deu para rir' : '😐 Fica para amanhã'}</span>`
          : `<span class="hj-react-q">Teve piada?</span>
             <button class="hj-rbtn" data-r="lol" aria-label="Teve piada">😂</button>
             <button class="hj-rbtn" data-r="meh" aria-label="Não teve piada">😐</button>`}
        <a class="hj-link" href="#humor">Mais piadas →</a>
      </div>`;

    el.querySelector('#hj-reveal')?.addEventListener('click', () => {
      const s = loadState(); dayState(s).revealed = true; saveState(s); renderJoke();
    });
    el.querySelectorAll('.hj-rbtn').forEach(b => b.addEventListener('click', () => {
      const s = loadState(); dayState(s).joke = b.dataset.r; saveState(s);
      renderJoke(); renderProgress();
    }));
    el.querySelector('#hj-star').addEventListener('click', () => {
      const f = favs();
      if (f[j.id]) delete f[j.id];
      else { const { catName, catIcon, ...plain } = j; f[j.id] = plain; }
      try { localStorage.setItem('humor-favs', JSON.stringify(f)); } catch (e) {}
      renderJoke();
    });
  }

  /* ── JOGO ──────────────────────────────────────────────────────── */
  const gameId = () => { const gp = GP(); return gp && gp.dailyGameId ? gp.dailyGameId(Object.keys(GAME_META)) : 'wordle'; };
  const gameDone = () => { const gp = GP(); return !!(gp && gp.isDailyDone(gameId())); };

  function renderGame() {
    const el = root.querySelector('#hj-game');
    const id = gameId(), g = GAME_META[id];
    const gp = GP();
    const st = gp ? gp.stats(id) : { plays: 0 };
    const done = gameDone();
    el.innerHTML = `
      <div class="hj-kicker">🎮 Jogo do dia${done ? ' · jogado ✓' : ''}</div>
      <div class="hj-game-row">
        <span class="hj-game-ico" aria-hidden="true">${g.icon}</span>
        <div>
          <h2 class="hj-ttl" id="hj-game-ttl">${esc(g.name)}</h2>
          <p class="hj-lead">${esc(g.desc)}</p>
        </div>
      </div>
      <p class="hj-game-stats">${st.plays ? `Já jogaste ${st.plays} ${st.plays === 1 ? 'vez' : 'vezes'}${st.wins ? ` · ${st.wins} ${st.wins === 1 ? 'vitória' : 'vitórias'}` : ''}.` : 'Ainda não jogaste este — hoje é o dia.'}</p>
      <div class="hj-actions">
        <a class="btn ${done ? '' : 'btn-primary'}" href="#games/${id}">${done ? 'Jogar outra vez' : 'Jogar agora →'}</a>
      </div>`;
  }

  /* ── ciclo de vida ─────────────────────────────────────────────── */
  function paint() {
    dk = dayKey();
    renderShell();
    renderProgress();
    renderQuiz();
    renderJoke();
    renderGame();
  }

  function show() {
    root = document.getElementById('view-hoje');
    if (!root) return;
    /* Ao voltar dos Jogos, o "jogado ✓" tem de aparecer sem recarregar. */
    if (built && dk === dayKey()) { renderGame(); renderProgress(); return; }
    built = true;
    quiz = null; joke = null;
    paint();
  }

  document.addEventListener('time:day', () => {
    if (!built) return;
    quiz = null; joke = null;
    if (root && root.classList.contains('active')) paint();
    else built = false;   /* repinta na próxima visita */
  });
  document.addEventListener('time:minute', () => {
    const el = root && root.querySelector('#hj-next');
    if (el) el.textContent = `Novo dia daqui a ${untilMidnight()}`;
  });

  return { show };
})();
