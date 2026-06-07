/* ══════════════════════════════════════════════════════════════════
   QUIZ PAGE — browse, categories, and gameplay
══════════════════════════════════════════════════════════════════ */
const QuizPage = (function () {
  'use strict';

  const T = k => (typeof I18n !== 'undefined' ? I18n.t(k) : k);
  const TL = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');

  /* ── Category & quiz registry ── */
  const CATEGORIES = [
    {
      id: 'imagens', icon: '📸', labelKey: 'quiz.cat.imagens',
      quizzes: [
        { id: 'prof-img',      icon: '👷', labelPt: 'Adivinha a Profissão', labelEn: 'Guess the Profession', provider: 'prof-img',      count: 10 },
        { id: 'animais-img',   icon: '🦁', labelPt: 'Adivinha o Animal',    labelEn: 'Guess the Animal',     provider: 'animais-img',   count: 10 },
        { id: 'planetas-img',  icon: '🪐', labelPt: 'Adivinha o Astro',     labelEn: 'Guess the Planet',     provider: 'planetas-img',  count: 8  },
        { id: 'alimentos-img', icon: '🍓', labelPt: 'Adivinha o Alimento',  labelEn: 'Guess the Food',       provider: 'alimentos-img', count: 10 },
        { id: 'orgaos-img',    icon: '🫀', labelPt: 'Adivinha o Órgão',     labelEn: 'Guess the Organ',      provider: 'orgaos-img',    count: 8  },
        { id: 'desporto-img',  icon: '🏅', labelPt: 'Adivinha o Desporto',  labelEn: 'Guess the Sport',      provider: 'desporto-img',  count: 10 },
        { id: 'mitos-img',     icon: '🏛️', labelPt: 'Adivinha o Mito',      labelEn: 'Guess the Myth',       provider: 'mitos-img',     count: 8  },
      ]
    },
    {
      id: 'geografia', icon: '🌍', labelKey: 'quiz.cat.geografia',
      quizzes: [
        { id: 'geografia',  icon: '🌐', labelPt: 'Geografia Mundial',       labelEn: 'World Geography',          provider: 'geografia-pt', count: 10 },
        { id: 'flags',      icon: '🚩', labelPt: 'Bandeiras do Mundo',      labelEn: 'Flags of the World',       provider: 'flags',     count: 10 },
        { id: 'flags-eu',   icon: '🇪🇺', labelPt: 'Bandeiras da Europa',     labelEn: 'Flags of Europe',          provider: 'flags-europa', count: 8 },
        { id: 'capitals',   icon: '🏛️', labelPt: 'Capitais do Mundo',        labelEn: 'World Capitals',           provider: 'capitals',  count: 10 },
        { id: 'continents', icon: '🗺️', labelPt: 'Continentes',              labelEn: 'Continents',               provider: 'continents',count: 10 },
        { id: 'population', icon: '👥', labelPt: 'Maior População',           labelEn: 'Larger Population',        provider: 'population',count: 10 },
        { id: 'monuments',  icon: '🗼', labelPt: 'Monumentos Famosos',        labelEn: 'Famous Monuments',         provider: 'monumentos-img', count: 8 },
      ]
    },
    {
      id: 'natureza', icon: '🌿', labelKey: 'quiz.cat.natureza',
      quizzes: [
        { id: 'space',    icon: '🚀', labelPt: 'Espaço e Planetas',  labelEn: 'Space & Planets',  provider: 'solar-pt', count: 10 },
        { id: 'animals',  icon: '🐾', labelPt: 'Animais',            labelEn: 'Animals',          provider: 'animals', count: 10 },
        { id: 'body',     icon: '🫀', labelPt: 'Corpo Humano',       labelEn: 'Human Body',       provider: 'body',    count: 10 },
        { id: 'science',  icon: '🔬', labelPt: 'Ciência',            labelEn: 'Science',          provider: 'science', count: 10 },
      ]
    },
    {
      id: 'escola', icon: '📚', labelKey: 'quiz.cat.escola',
      quizzes: [
        { id: 'math',        icon: '🔢', labelPt: 'Matemática Rápida', labelEn: 'Quick Maths',       provider: 'math',         count: 10 },
        { id: 'timestables', icon: '✖️', labelPt: 'Tabuada',           labelEn: 'Times Tables',      provider: 'timestables',  count: 10 },
        { id: 'clocks',      icon: '🕐', labelPt: 'Que Horas São?',    labelEn: 'What Time Is It?',  provider: 'clocks',       count: 8  },
        { id: 'spelling',    icon: '✍️', labelPt: 'Ortografia PT',     labelEn: 'PT Spelling',       provider: 'spelling-pt',  count: 10, onlyLang: 'pt' },
        { id: 'vocaben',     icon: '🔤', labelPt: 'Inglês Básico',     labelEn: 'Basic English',     provider: 'vocabulary-en',count: 8  },
      ]
    },
    {
      id: 'cultura', icon: '🎓', labelKey: 'quiz.cat.cultura',
      quizzes: [
        { id: 'gk',          icon: '🧠', labelPt: 'Cultura Geral',    labelEn: 'General Knowledge',  provider: 'general-knowledge', count: 10 },
        { id: 'mythology',   icon: '⚡', labelPt: 'Mitologia',         labelEn: 'Mythology',          provider: 'mythology', count: 10 },
        { id: 'history',     icon: '📜', labelPt: 'História',          labelEn: 'History',            provider: 'history',   count: 10 },
        { id: 'leiria',      icon: '🏰', labelPt: 'Leiria',            labelEn: 'Leiria',             provider: 'leiria',    count: 8  },
        { id: 'sport',       icon: '⚽', labelPt: 'Desporto',          labelEn: 'Sport',              provider: 'sport',     count: 10 },
        { id: 'music',       icon: '🎵', labelPt: 'Música',            labelEn: 'Music',              provider: 'music',     count: 10 },
        { id: 'professions', icon: '👷', labelPt: 'Profissões',        labelEn: 'Professions',        provider: 'professions',count: 10 },
        { id: 'vehicles',    icon: '🚗', labelPt: 'Transportes',       labelEn: 'Transport',          provider: 'vehicles',  count: 10 },
        { id: 'food',        icon: '🍎', labelPt: 'Alimentos',         labelEn: 'Food',               provider: 'food',      count: 10 },
        { id: 'portugal',    icon: '🇵🇹', labelPt: 'Portugal',          labelEn: 'Portugal',           provider: 'portugal-quiz', count: 8 },
        { id: 'car-brands',  icon: '🏎️', labelPt: 'Marcas de Automóveis', labelEn: 'Car Brands',      provider: 'car-brands', count: 8 },
        { id: 'f1',          icon: '🏁', labelPt: 'Fórmula 1',         labelEn: 'Formula 1',          provider: 'f1',         count: 8 },
      ]
    },
    {
      id: 'visual', icon: '🎨', labelKey: 'quiz.cat.visual',
      quizzes: [
        { id: 'emoji',    icon: '😊', labelPt: 'Quiz de Emojis',     labelEn: 'Emoji Quiz',      provider: 'emoji',          count: 10 },
        { id: 'colours',  icon: '🎨', labelPt: 'Cores',              labelEn: 'Colours',         provider: 'colours',        count: 10 },
        { id: 'sinais',   icon: '🚦', labelPt: 'Sinais de Trânsito', labelEn: 'Traffic Signs',   provider: 'sinais-transito', count: 8 },
        { id: 'symbols',  icon: '🔣', labelPt: 'Símbolos',           labelEn: 'Symbols',         provider: 'symbols',        count: 8 },
        { id: 'car-logos',icon: '🚘', labelPt: 'Logótipos de Automóveis', labelEn: 'Car Logos',  provider: 'car-logos',      count: 8 },
        { id: 'apps',     icon: '📱', labelPt: 'Apps e Redes Sociais', labelEn: 'Apps & Social',  provider: 'apps',           count: 8 },
      ]
    },
    {
      id: 'tecnologia', icon: '💻', labelKey: 'quiz.cat.tecnologia',
      quizzes: [
        { id: 'tech',        icon: '🖥️', labelPt: 'Tecnologia e Computadores', labelEn: 'Technology & Computers', provider: 'technology',    count: 10 },
        { id: 'tecnologia',  icon: '🧠', labelPt: 'Tecnologia (PT)',           labelEn: 'Technology (PT)',        provider: 'tecnologia-pt', count: 10 },
        { id: 'tech-logos',  icon: '🔣', labelPt: 'Logótipos Tecnológicos',    labelEn: 'Tech Logos',             provider: 'tech-logos',    count: 8  },
      ]
    },
  ];

  /* ── State ── */
  let _el     = null;
  let _state  = 'browse'; // 'browse' | 'playing' | 'result'
  let _quiz   = null;     // active quiz definition
  let _qs     = [];       // loaded questions
  let _qIdx   = 0;        // current question index
  let _score  = 0;
  let _chosen = -1;       // selected answer idx (-1 = not yet)
  let _search = '';
  let _startTime = 0;     // round start (ms) for the live timer
  let _timerId   = 0;     // setInterval handle
  let _elapsed   = 0;     // final round duration (s), for the result screen

  /* ── Getters ── */
  function getDifficulty() { return QuizEngine.getDifficulty(); }
  function getLang()       { return QuizEngine.getLang(); }

  /* ── Entry point ── */
  function show(sub) {
    _el = document.getElementById('view-quiz');
    if (!_el) return;
    if (sub) {
      const id = sub.split('/').pop();
      const quiz = resolveQuiz(id);
      if (quiz) { startQuiz(quiz); return; }
    }
    renderBrowse();
  }

  function findQuiz(id) {
    for (const cat of CATEGORIES)
      for (const q of cat.quizzes)
        if (q.id === id) return q;
    return null;
  }

  /* Resolve a deep-link id to a quiz def — single topic, a whole group
     ("mix-<catId>"), or every topic ("mix-all"). */
  function resolveQuiz(id) {
    if (id === 'mix-all') return allQuiz();
    if (id && id.indexOf('mix-') === 0) {
      const cat = CATEGORIES.find(c => 'mix-' + c.id === id);
      if (cat) return groupQuiz(cat);
    }
    return findQuiz(id);
  }

  /* Providers available in the current language. */
  function providersIn(quizzes) {
    const ql = getLang() === 'pt' ? 'pt' : 'en';
    return quizzes.filter(q => !q.onlyLang || q.onlyLang === ql).map(q => q.provider);
  }

  /* Composite quiz: every topic across all groups. */
  function allQuiz() {
    const providers = [];
    CATEGORIES.forEach(c => providersIn(c.quizzes).forEach(p => providers.push(p)));
    return { id: 'mix-all', icon: '🎲', labelPt: 'Todos os Temas', labelEn: 'All Topics', providers, mixed: true };
  }
  /* Composite quiz: all topics within one group. */
  function groupQuiz(cat) {
    const label = T(cat.labelKey) || cat.labelKey;
    return { id: 'mix-' + cat.id, icon: cat.icon, labelPt: label, labelEn: label, providers: providersIn(cat.quizzes), mixed: true };
  }

  /* ══════════════════════════════════════════════════════════════════
     BROWSE  — category cards
  ══════════════════════════════════════════════════════════════════ */
  function renderBrowse() {
    _state = 'browse';
    const diff = getDifficulty();
    const lang = getLang();
    const ql   = lang === 'pt' ? 'pt' : 'en';

    const DIFFS = [
      { id: 'easy',   pt: 'Fácil',   en: 'Easy'   },
      { id: 'medium', pt: 'Médio',   en: 'Medium' },
      { id: 'hard',   pt: 'Difícil', en: 'Hard'   },
    ];
    const count = QuizEngine.getCount();

    _el.innerHTML = `
      <div class="qp-page">
        <div class="qp-hero">
          <div class="qp-hero-inner">
            <h1 class="qp-title">🧩 Quizzes</h1>
            <p class="qp-sub">${lang === 'pt' ? 'Aprender a brincar' : 'Learning through play'}</p>
            <div class="qp-inline-settings">
              <div class="qp-is-row">
                <span class="qp-is-lbl">${lang === 'pt' ? 'Dificuldade' : 'Difficulty'}</span>
                <div class="qp-is-diffs" id="qp-is-diffs">
                  ${DIFFS.map(d =>
                    `<button class="qp-is-btn qp-is-diff-${d.id}${diff===d.id?' active':''}" data-diff="${d.id}">${ql==='pt'?d.pt:d.en}</button>`
                  ).join('')}
                </div>
              </div>
              <div class="qp-is-row">
                <span class="qp-is-lbl">${lang === 'pt' ? 'Perguntas' : 'Questions'}</span>
                <div class="qp-is-counts" id="qp-is-counts">
                  ${QuizEngine.COUNTS.map(n =>
                    `<button class="qp-is-btn${count===n?' active':''}" data-count="${n}">${n}</button>`
                  ).join('')}
                </div>
              </div>
              <div class="qp-is-row">
                <span class="qp-is-lbl">${lang === 'pt' ? 'Língua' : 'Language'}</span>
                <div class="qp-is-langs" id="qp-is-langs">
                  <button class="qp-is-btn${lang==='pt'?' active':''}" data-lang="pt">🇵🇹 PT</button>
                  <button class="qp-is-btn${lang==='en'?' active':''}" data-lang="en">🇬🇧 EN</button>
                </div>
              </div>
            </div>
            <button class="qp-play-all" id="qp-play-all">
              🎲 ${lang === 'pt' ? 'Jogar com Todos os Temas' : 'Play All Topics'}
            </button>
            <input type="search" class="qp-search" id="qp-search" placeholder="${lang === 'pt' ? 'Pesquisar quizzes…' : 'Search quizzes…'}" value="${_search}" autocomplete="off"/>
          </div>
        </div>
        <div class="qp-cats" id="qp-cats"></div>
      </div>`;

    /* Difficulty selector */
    _el.querySelectorAll('#qp-is-diffs .qp-is-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.diff;
        QuizEngine.setDifficulty(d);
        _el.querySelectorAll('#qp-is-diffs .qp-is-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCats(getLang() === 'pt' ? 'pt' : 'en');
        document.dispatchEvent(new CustomEvent('quizsettingschange', { detail: { difficulty: d } }));
      });
    });

    /* Question-count selector */
    _el.querySelectorAll('#qp-is-counts .qp-is-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.count, 10);
        QuizEngine.setCount(n);
        _el.querySelectorAll('#qp-is-counts .qp-is-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    /* Language selector */
    _el.querySelectorAll('#qp-is-langs .qp-is-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const l = btn.dataset.lang;
        localStorage.setItem('quiz-lang', l);
        renderBrowse();
        document.dispatchEvent(new CustomEvent('quizsettingschange', { detail: { lang: l } }));
      });
    });

    /* Play across every topic */
    _el.querySelector('#qp-play-all')?.addEventListener('click', () => Nav.go('quiz/mix-all'));

    const searchInput = _el.querySelector('#qp-search');
    searchInput?.addEventListener('input', () => {
      _search = searchInput.value;
      renderCats(ql);
    });

    renderCats(ql);
  }

  function renderCats(ql) {
    const container = _el?.querySelector('#qp-cats');
    if (!container) return;
    const q = _search.toLowerCase().trim();

    const html = CATEGORIES.map(cat => {
      const filtered = cat.quizzes.filter(quiz => {
        if (quiz.onlyLang && quiz.onlyLang !== ql) return false;
        const label = ql === 'pt' ? quiz.labelPt : quiz.labelEn;
        if (!q) return true;
        return label.toLowerCase().includes(q) || cat.labelKey.toLowerCase().includes(q);
      });
      if (!filtered.length) return '';

      const cards = filtered.map(quiz => {
        const label = ql === 'pt' ? quiz.labelPt : quiz.labelEn;
        const hs    = QuizEngine.getHighscore(quiz.id);
        const played = QuizEngine.getPlayed(quiz.id);
        return `<button class="qc-card" data-quiz="${quiz.id}" title="${label}">
          <img class="qc-card-img" src="assets/quiz/${quiz.id}.jpg" alt="" loading="lazy" onerror="this.remove()">
          <div class="qc-card-icon">${quiz.icon}</div>
          <div class="qc-card-label">${label}</div>
          ${hs > 0 ? `<div class="qc-card-hs">⭐ ${hs}</div>` : ''}
          ${played > 0 ? `<div class="qc-card-played">${played}×</div>` : ''}
        </button>`;
      }).join('');

      const catLabel = T(cat.labelKey) || cat.labelKey;
      const showGroup = filtered.length > 1;
      return `<div class="qp-cat-section">
        <div class="qp-cat-header">
          <span class="qp-cat-icon">${cat.icon}</span>
          <span class="qp-cat-name">${catLabel}</span>
          ${showGroup ? `<button class="qp-group-play" data-group="${cat.id}" title="${ql === 'pt' ? 'Jogar todo o grupo' : 'Play the whole group'}">▶ ${ql === 'pt' ? 'Grupo' : 'Group'}</button>` : ''}
        </div>
        <div class="qp-cat-grid">${cards}</div>
      </div>`;
    }).join('');

    container.innerHTML = html || `<div class="qp-empty">${ql === 'pt' ? 'Nenhum quiz encontrado.' : 'No quizzes found.'}</div>`;

    container.querySelectorAll('.qc-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if (findQuiz(btn.dataset.quiz)) Nav.go('quiz/' + btn.dataset.quiz);
      });
    });
    container.querySelectorAll('.qp-group-play').forEach(btn => {
      btn.addEventListener('click', () => Nav.go('quiz/mix-' + btn.dataset.group));
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GAMEPLAY
  ══════════════════════════════════════════════════════════════════ */
  async function startQuiz(quiz) {
    _state  = 'playing';
    _quiz   = quiz;
    _qIdx   = 0;
    _score  = 0;
    _chosen = -1;
    _qs     = [];
    stopTimer();

    renderLoading();

    try {
      const difficulty = getDifficulty();
      const lang = getLang();
      const count = QuizEngine.getCount();
      const opts = {
        difficulty, lang, count,
        /* legacy compatibility shim for providers still written against age */
        age: QuizEngine.diffToLegacyAge(difficulty),
      };
      _qs = quiz.providers
        ? await QuizEngine.getMixedQuestions(quiz.providers, opts)
        : await QuizEngine.getQuestions(quiz.provider, opts);
      if (!_qs || !_qs.length) throw new Error('empty');
      startTimer();
      renderQuestion();
    } catch (e) {
      renderError(e.message || '');
    }
  }

  /* ── Round timer (shown live in the quiz header) ── */
  function startTimer() { stopTimer(); _startTime = Date.now(); _timerId = setInterval(updateTimer, 1000); }
  function stopTimer()  { if (_timerId) { clearInterval(_timerId); _timerId = 0; } }
  function fmtTime(s)   { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateTimer() {
    const el = _el && _el.querySelector('#qg-timer');
    if (!el || !_startTime) return;
    el.textContent = '⏱ ' + fmtTime(Math.floor((Date.now() - _startTime) / 1000));
  }
  function diffLabel() {
    const d = getDifficulty(), lang = getLang();
    const M = { easy: ['Fácil', 'Easy'], medium: ['Médio', 'Medium'], hard: ['Difícil', 'Hard'] };
    return (M[d] || M.easy)[lang === 'pt' ? 0 : 1];
  }

  function renderLoading() {
    const lang = getLang();
    _el.innerHTML = `
      <div class="qg-wrap">
        <div class="qg-loader">
          <div class="qg-spinner"></div>
          <p>${lang === 'pt' ? 'A carregar perguntas…' : 'Loading questions…'}</p>
        </div>
      </div>`;
  }

  function renderError(msg) {
    const lang = getLang();
    _el.innerHTML = `
      <div class="qg-wrap">
        <div class="qg-error">
          <div class="qg-error-icon">⚠️</div>
          <p>${lang === 'pt' ? 'Não foi possível carregar as perguntas.' : 'Failed to load questions.'}</p>
          ${msg ? `<p class="qg-error-detail">${msg}</p>` : ''}
          <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.5rem">
            <button class="qg-btn qg-btn-ghost" id="qg-back-err">${lang === 'pt' ? 'Voltar' : 'Back'}</button>
            <button class="qg-btn" id="qg-retry-err">${lang === 'pt' ? 'Tentar novamente' : 'Try again'}</button>
          </div>
        </div>
      </div>`;
    _el.querySelector('#qg-back-err')?.addEventListener('click', () => Nav.go('quiz'));
    _el.querySelector('#qg-retry-err')?.addEventListener('click', () => startQuiz(_quiz));
  }

  /* Render a question's media. Inline SVG is trusted (authored locally);
     image types ('img' photo, 'logo' brand mark) point at LOCAL assets
     under quizzes/assets/ (populated by the fetch script) or a verified
     reusable URL. They lazy-load and fall back to a labelled placeholder
     if the asset is unavailable, so layouts never break and we never show
     a broken image. Optional `imageCredit` shows attribution. */
  function renderImage(q) {
    const t = q.imageType;
    if (t === 'flag') {
      return `<img class="qg-flag" src="${q.image}" alt="" loading="lazy"
                onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'qg-img-ph',textContent:'🏳️'}))"/>`;
    }
    if (t === 'logo') {
      /* Logos render on a light tile so monochrome marks stay visible. */
      const credit = q.imageCredit
        ? `<span class="qg-img-credit">${q.imageCredit}</span>` : '';
      return `<div class="qg-logo-tile"><img class="qg-logo" src="${q.image}" alt="" loading="lazy"
                onerror="this.closest('.qg-logo-tile').replaceWith(Object.assign(document.createElement('div'),{className:'qg-img-ph',textContent:'🔳'}))"/></div>${credit}`;
    }
    if (t === 'img') {
      const credit = q.imageCredit
        ? `<span class="qg-img-credit">${q.imageCredit}</span>` : '';
      return `<img class="qg-photo" src="${q.image}" alt="" loading="lazy"
                onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'qg-img-ph',textContent:'🖼️'}))"/>${credit}`;
    }
    /* 'svg' or inline markup — authored locally, safe to inject. */
    return q.image;
  }

  function renderQuestion() {
    const q    = _qs[_qIdx];
    const lang = getLang();
    const n    = _qs.length;
    const pct  = Math.round((_qIdx / n) * 100);
    const label = lang === 'pt' ? _quiz.labelPt : _quiz.labelEn;

    _el.innerHTML = `
      <div class="qg-wrap">
        <div class="qg-shell">

          <!-- Header -->
          <div class="qg-header">
            <button class="qg-back-btn" id="qg-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div class="qg-title-row">
              <span class="qg-quiz-icon">${_quiz.icon}</span>
              <span class="qg-quiz-name">${label}</span>
            </div>
            <div class="qg-score-badge">⭐ ${_score}</div>
          </div>

          <!-- Live HUD: chosen difficulty + elapsed time -->
          <div class="qg-hud">
            <span class="qg-hud-diff qg-diff-${getDifficulty()}">${diffLabel()}</span>
            <span class="qg-hud-timer" id="qg-timer">⏱ ${fmtTime(Math.floor((Date.now() - (_startTime || Date.now())) / 1000))}</span>
          </div>

          <!-- Progress -->
          <div class="qg-progress-wrap">
            <div class="qg-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="qg-progress-txt">
            ${lang === 'pt' ? 'Pergunta' : 'Question'} ${_qIdx + 1} ${lang === 'pt' ? 'de' : 'of'} ${n}
          </div>

          <!-- Question body -->
          <div class="qg-body">
            ${q.image ? `<div class="qg-image-area">${renderImage(q)}</div>` : ''}
            <div class="qg-question">${q.question}</div>

            <!-- Answer options -->
            <div class="qg-options qg-options-${q.options.length}" id="qg-options">
              ${q.options.map((opt, i) =>
                `<button class="qg-opt" data-idx="${i}">${opt}</button>`
              ).join('')}
            </div>

            <!-- Explanation (hidden until answered) -->
            <div class="qg-explanation" id="qg-exp" hidden>
              <div class="qg-exp-inner" id="qg-exp-text"></div>
            </div>

            <!-- Next button (hidden until answered) -->
            <div class="qg-actions" id="qg-actions" hidden>
              <button class="qg-btn" id="qg-next">
                ${_qIdx + 1 >= n
                  ? (lang === 'pt' ? 'Ver resultado' : 'See result')
                  : (lang === 'pt' ? 'Seguinte' : 'Next')}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

        </div>
      </div>`;

    /* Back */
    _el.querySelector('#qg-back')?.addEventListener('click', () => { stopTimer(); Nav.go('quiz'); });

    /* Answer buttons */
    const optEls = _el.querySelectorAll('.qg-opt');
    optEls.forEach(btn => {
      btn.addEventListener('click', () => {
        if (_chosen >= 0) return;
        _chosen = parseInt(btn.dataset.idx);
        revealAnswer(_chosen, q);
      });
    });
  }

  function revealAnswer(chosen, q) {
    const correct = q.correctIdx;
    const correct_  = chosen === correct;
    if (correct_) _score += 10;

    const optEls = _el?.querySelectorAll('.qg-opt');
    optEls?.forEach((btn, i) => {
      btn.disabled = true;
      if (i === correct) btn.classList.add('qg-opt-correct');
      else if (i === chosen && !correct_) btn.classList.add('qg-opt-wrong');
    });

    /* Show explanation */
    const expEl  = _el?.querySelector('#qg-exp');
    const expTxt = _el?.querySelector('#qg-exp-text');
    if (expEl && expTxt) {
      expEl.classList.add(correct_ ? 'qg-exp-correct' : 'qg-exp-wrong');
      const lang = getLang();
      const feedback = correct_
        ? (lang === 'pt' ? '✓ Correcto!' : '✓ Correct!')
        : (lang === 'pt' ? '✗ Errado!' : '✗ Wrong!');
      expTxt.innerHTML = `<strong>${feedback}</strong> ${q.explanation || ''}`;
      expEl.hidden = false;
    }

    /* Show next button */
    const actEl = _el?.querySelector('#qg-actions');
    if (actEl) {
      actEl.hidden = false;
      _el.querySelector('#qg-next')?.addEventListener('click', () => {
        _qIdx++;
        _chosen = -1;
        if (_qIdx >= _qs.length) renderResult();
        else renderQuestion();
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     RESULT SCREEN
  ══════════════════════════════════════════════════════════════════ */
  function renderResult() {
    _state = 'result';
    if (_startTime) _elapsed = Math.floor((Date.now() - _startTime) / 1000);
    stopTimer();
    const lang  = getLang();
    const total = _qs.length * 10;
    const pct   = Math.round((_score / total) * 100);
    const label = lang === 'pt' ? _quiz.labelPt : _quiz.labelEn;

    QuizEngine.saveHighscore(_quiz.id, _score);
    QuizEngine.markPlayed(_quiz.id);
    const hs = QuizEngine.getHighscore(_quiz.id);

    let medal = '🥉', praise;
    if (pct >= 90)      { medal = '🏆'; praise = lang === 'pt' ? 'Excelente!' : 'Excellent!'; }
    else if (pct >= 70) { medal = '🥇'; praise = lang === 'pt' ? 'Muito bem!' : 'Well done!'; }
    else if (pct >= 50) { medal = '🥈'; praise = lang === 'pt' ? 'Bom esforço!' : 'Good effort!'; }
    else                {               praise = lang === 'pt' ? 'Continua a praticar!' : 'Keep practising!'; }

    const isNewHS = _score >= hs;

    _el.innerHTML = `
      <div class="qg-wrap">
        <div class="qg-result">
          <div class="qg-result-medal">${medal}</div>
          <h2 class="qg-result-title">${lang === 'pt' ? 'Quiz concluído!' : 'Quiz complete!'}</h2>
          <p class="qg-result-quiz">${label}</p>
          <div class="qg-result-score">
            <div class="qg-score-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border2)" stroke-width="8"/>
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent)" stroke-width="8"
                  stroke-dasharray="${2.76 * pct} 276"
                  stroke-linecap="round" transform="rotate(-90 50 50)"/>
              </svg>
              <div class="qg-score-inner">
                <span class="qg-score-pct">${pct}%</span>
                <span class="qg-score-frac">${_score}/${total}</span>
              </div>
            </div>
          </div>
          <p class="qg-result-praise">${praise}</p>
          <div class="qg-result-meta">
            <span class="qg-hud-diff qg-diff-${getDifficulty()}">${diffLabel()}</span>
            <span class="qg-result-meta-chip">📝 ${_qs.length} ${lang === 'pt' ? 'perguntas' : 'questions'}</span>
            <span class="qg-result-meta-chip">⏱ ${fmtTime(_elapsed)}</span>
          </div>
          ${isNewHS ? `<div class="qg-new-hs">🌟 ${lang === 'pt' ? 'Novo recorde!' : 'New high score!'}</div>` : `<div class="qg-prev-hs">${lang === 'pt' ? 'Recorde:' : 'High score:'} ⭐ ${hs}</div>`}
          <div class="qg-result-actions">
            <button class="qg-btn qg-btn-ghost" id="qr-back">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              ${lang === 'pt' ? 'Voltar' : 'Back'}
            </button>
            <button class="qg-btn" id="qr-retry">
              🔄 ${lang === 'pt' ? 'Tentar novamente' : 'Try again'}
            </button>
          </div>
        </div>
      </div>`;

    _el.querySelector('#qr-back')?.addEventListener('click', () => Nav.go('quiz'));
    _el.querySelector('#qr-retry')?.addEventListener('click', () => startQuiz(_quiz));
  }

  /* ── Respond to quiz settings changes ── */
  document.addEventListener('quizsettingschange', () => {
    if (_state === 'browse' && _el?.closest('.view.active')) renderBrowse();
  });

  document.addEventListener('langchange', () => {
    if (_state === 'browse' && _el?.closest('.view.active')) renderBrowse();
  });

  return { show };
})();
