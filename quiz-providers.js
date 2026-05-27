/* ══════════════════════════════════════════════════════════════════
   QUIZ PROVIDERS — each provider fetches/generates questions
   Question shape:
   {
     id, question, options[], correctIdx, explanation,
     image?, imageType ('flag'|'img'|null), difficulty, lang
   }
══════════════════════════════════════════════════════════════════ */

/* ── Shared fetch helper with abort + timeout ── */
async function _qFetch(url, timeoutMs) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs || 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(tid);
    return r;
  } catch (e) { clearTimeout(tid); throw e; }
}

/* ══════════════════════════════════════════════════════════════════
   REST COUNTRIES  — countries, capitals, flags, continents
══════════════════════════════════════════════════════════════════ */
(function registerCountryProviders() {
  const CACHE_KEY = 'countries-v2';
  const API = 'https://restcountries.com/v3.1/all?fields=name,capital,flags,region,subregion,population,area,landlocked,currencies,languages,cca2';

  async function loadCountries() {
    const cached = QuizEngine.getCache(CACHE_KEY);
    if (cached) return cached;
    const r = await _qFetch(API, 8000);
    if (!r.ok) throw new Error('countries api error');
    const data = await r.json();
    const clean = data
      .filter(c => c.capital && c.capital[0] && c.name && c.name.common && c.flags)
      .map(c => ({
        name:     c.name.common,
        nameNat:  c.name.official,
        capital:  c.capital[0],
        flag:     c.flags.svg || c.flags.png || '',
        region:   c.region   || '',
        sub:      c.subregion || '',
        pop:      c.population || 0,
        landlocked: !!c.landlocked,
        currencies: Object.values(c.currencies || {}).map(x => x.name),
        languages:  Object.values(c.languages  || {}),
      }));
    QuizEngine.setCache(CACHE_KEY, clean);
    return clean;
  }

  /* Region labels PT/EN */
  const REGION_PT = {
    Africa:'África', Americas:'Américas', Asia:'Ásia',
    Europe:'Europa', Oceania:'Oceânia', Antarctic:'Antárctica',
  };

  /* ── COUNTRY QUIZ ── which country is this flag? */
  QuizEngine.register('flags', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all = await loadCountries();
      const n   = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(all).slice(0, Math.min(count || 10, 30));
      const names = all.map(c => c.name);

      return pool.map((c, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(c.name, names, n);
        const q = lang === 'pt'
          ? `De que país é esta bandeira?`
          : `Which country does this flag belong to?`;
        const exp = lang === 'pt'
          ? `Esta é a bandeira de <strong>${c.name}</strong>, situada em ${REGION_PT[c.region] || c.region}.`
          : `This is the flag of <strong>${c.name}</strong>, located in ${c.region}.`;
        return { id: `flag-${i}`, question: q, options, correctIdx, explanation: exp,
          image: c.flag, imageType: 'flag', difficulty: 'easy', lang };
      });
    }
  });

  /* ── CAPITAL QUIZ ── what is the capital of X? */
  QuizEngine.register('capitals', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all = await loadCountries();
      const n   = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(all).slice(0, count || 10);
      const caps = all.map(c => c.capital);

      return pool.map((c, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(c.capital, caps, n);
        const q = lang === 'pt'
          ? `Qual é a capital de <strong>${c.name}</strong>?`
          : `What is the capital of <strong>${c.name}</strong>?`;
        const exp = lang === 'pt'
          ? `A capital de <strong>${c.name}</strong> é <strong>${c.capital}</strong>.`
          : `The capital of <strong>${c.name}</strong> is <strong>${c.capital}</strong>.`;
        return { id: `cap-${i}`, question: q, options, correctIdx, explanation: exp,
          image: c.flag, imageType: 'flag', difficulty: 'medium', lang };
      });
    }
  });

  /* ── CONTINENT QUIZ ── which continent is this country in? */
  QuizEngine.register('continents', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all = await loadCountries();
      const pool = QuizEngine.shuffle(all).slice(0, count || 10);
      const regions = [...new Set(all.map(c => c.region))].filter(Boolean);
      const n = Math.min(QuizEngine.optionCount(age), regions.length);

      return pool.map((c, i) => {
        const label  = lang === 'pt' ? (REGION_PT[c.region] || c.region) : c.region;
        const allLbls = regions.map(r => lang === 'pt' ? (REGION_PT[r] || r) : r);
        const { options, correctIdx } = QuizEngine.buildOptions(label, allLbls, n);
        const q = lang === 'pt'
          ? `Em que continente fica <strong>${c.name}</strong>?`
          : `Which continent is <strong>${c.name}</strong> in?`;
        const exp = lang === 'pt'
          ? `<strong>${c.name}</strong> está em <strong>${label}</strong>.`
          : `<strong>${c.name}</strong> is in <strong>${label}</strong>.`;
        return { id: `cont-${i}`, question: q, options, correctIdx, explanation: exp,
          image: c.flag, imageType: 'flag', difficulty: 'easy', lang };
      });
    }
  });

  /* ── POPULATION QUIZ ── which country has more people? (2 choices) */
  QuizEngine.register('population', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all = await loadCountries().then(d => d.filter(c => c.pop > 1000000));
      const qs  = [];
      const pool = QuizEngine.shuffle(all);
      for (let i = 0; i < Math.min(count || 8, 20); i += 2) {
        const a = pool[i], b = pool[i + 1];
        if (!a || !b) break;
        const correct = a.pop > b.pop ? a.name : b.name;
        const q = lang === 'pt'
          ? `Qual país tem <strong>maior população</strong>?`
          : `Which country has a <strong>larger population</strong>?`;
        const aFmt = a.pop.toLocaleString(lang === 'pt' ? 'pt-PT' : 'en-GB');
        const bFmt = b.pop.toLocaleString(lang === 'pt' ? 'pt-PT' : 'en-GB');
        const exp = lang === 'pt'
          ? `${a.name}: ${aFmt} hab. · ${b.name}: ${bFmt} hab.`
          : `${a.name}: ${aFmt} people · ${b.name}: ${bFmt} people`;
        qs.push({ id: `pop-${i}`, question: q, options: [a.name, b.name],
          correctIdx: [a.name, b.name].indexOf(correct),
          explanation: exp, difficulty: 'medium', lang });
      }
      return qs;
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   OPEN TRIVIA DB  — general knowledge
══════════════════════════════════════════════════════════════════ */
(function registerTriviaProviders() {
  function he(s) {
    const d = document.createElement('div');
    d.innerHTML = s;
    return d.textContent || s;
  }

  async function fetchTrivia({ category, difficulty, count }) {
    const cKey = `trivia-${category}-${difficulty}-${count}`;
    const cached = QuizEngine.getCache(cKey);
    if (cached) return cached;
    const url = `https://opentdb.com/api.php?amount=${count}&type=multiple&difficulty=${difficulty}` +
      (category ? `&category=${category}` : '');
    const r = await _qFetch(url, 7000);
    if (!r.ok) throw new Error('trivia api error');
    const j = await r.json();
    if (j.response_code !== 0) throw new Error('trivia empty');
    QuizEngine.setCache(cKey, j.results);
    return j.results;
  }

  function mapTrivia(items, opts) {
    const { age, lang } = opts;
    const n = QuizEngine.optionCount(age);
    return items.map((item, i) => {
      const correct = he(item.correct_answer);
      const wrongs  = item.incorrect_answers.map(he);
      const pool    = [correct, ...wrongs];
      const { options, correctIdx } = QuizEngine.buildOptions(correct, pool, n);
      return {
        id: `trivia-${i}`,
        question: he(item.question),
        options, correctIdx,
        explanation: lang === 'pt'
          ? `A resposta correcta é: <strong>${correct}</strong>.`
          : `The correct answer is: <strong>${correct}</strong>.`,
        difficulty: item.difficulty,
        lang: 'en',
      };
    });
  }

  QuizEngine.register('general-knowledge', {
    async getQuestions(opts) {
      const { age } = opts;
      const diff = age <= 9 ? 'easy' : age <= 12 ? 'medium' : 'hard';
      const items = await fetchTrivia({ category: 9, difficulty: diff, count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('science', {
    async getQuestions(opts) {
      const { age } = opts;
      const diff = age <= 9 ? 'easy' : age <= 12 ? 'medium' : 'hard';
      const items = await fetchTrivia({ category: 17, difficulty: diff, count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('history', {
    async getQuestions(opts) {
      const { age } = opts;
      const diff = age <= 10 ? 'easy' : age <= 12 ? 'medium' : 'hard';
      const items = await fetchTrivia({ category: 23, difficulty: diff, count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('animals', {
    async getQuestions(opts) {
      const items = await fetchTrivia({ category: 27, difficulty: 'easy', count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('sport', {
    async getQuestions(opts) {
      const { age } = opts;
      const diff = age <= 10 ? 'easy' : 'medium';
      const items = await fetchTrivia({ category: 21, difficulty: diff, count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('music', {
    async getQuestions(opts) {
      const items = await fetchTrivia({ category: 12, difficulty: 'easy', count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });

  QuizEngine.register('vehicles', {
    async getQuestions(opts) {
      const items = await fetchTrivia({ category: 28, difficulty: 'easy', count: opts.count || 10 });
      return mapTrivia(items, opts);
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   MATH QUIZ  — generated locally
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('math', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a = parseInt(age) || 8;
    const qs = [];
    const n  = QuizEngine.optionCount(age);

    function makeQ() {
      let x, y, op, ans, qStr;
      if (a <= 7) {
        x = Math.floor(Math.random() * 10) + 1;
        y = Math.floor(Math.random() * 10) + 1;
        op = Math.random() < 0.6 ? '+' : '-';
        if (op === '-' && y > x) [x, y] = [y, x];
        ans = op === '+' ? x + y : x - y;
        qStr = `${x} ${op} ${y} = ?`;
      } else if (a <= 9) {
        op = ['+', '-', '×'][Math.floor(Math.random() * 3)];
        x = Math.floor(Math.random() * 20) + 1;
        y = Math.floor(Math.random() * 12) + 1;
        if (op === '-' && y > x) [x, y] = [y, x];
        ans = op === '+' ? x + y : op === '-' ? x - y : x * y;
        qStr = `${x} ${op} ${y} = ?`;
      } else if (a <= 12) {
        op = ['+', '-', '×', '÷'][Math.floor(Math.random() * 4)];
        if (op === '÷') {
          y = Math.floor(Math.random() * 9) + 2;
          ans = Math.floor(Math.random() * 12) + 1;
          x = y * ans;
        } else {
          x = Math.floor(Math.random() * 50) + 1;
          y = Math.floor(Math.random() * 20) + 1;
          if (op === '-' && y > x) [x, y] = [y, x];
          ans = op === '+' ? x + y : op === '-' ? x - y : x * y;
        }
        qStr = `${x} ${op} ${y} = ?`;
      } else {
        const ops2 = ['+', '-', '×', '÷', '²'];
        op = ops2[Math.floor(Math.random() * ops2.length)];
        if (op === '²') {
          x = Math.floor(Math.random() * 15) + 2;
          ans = x * x;
          qStr = `${x}² = ?`;
        } else if (op === '÷') {
          y = Math.floor(Math.random() * 11) + 2;
          ans = Math.floor(Math.random() * 20) + 1;
          x = y * ans;
          qStr = `${x} ÷ ${y} = ?`;
        } else {
          x = Math.floor(Math.random() * 100) + 10;
          y = Math.floor(Math.random() * 50) + 5;
          if (op === '-' && y > x) [x, y] = [y, x];
          ans = op === '+' ? x + y : op === '-' ? x - y : x * y;
          qStr = `${x} ${op} ${y} = ?`;
        }
      }
      return { q: qStr, ans };
    }

    const seen = new Set();
    let attempts = 0;
    while (qs.length < (count || 10) && attempts < 100) {
      attempts++;
      const { q, ans } = makeQ();
      if (seen.has(q)) continue;
      seen.add(q);
      const spread  = Math.max(2, Math.floor(Math.abs(ans) * 0.3));
      const wrongs  = [];
      let   tries   = 0;
      while (wrongs.length < n - 1 && tries < 30) {
        tries++;
        const off = (Math.floor(Math.random() * spread) + 1) * (Math.random() < 0.5 ? 1 : -1);
        const w   = ans + off;
        if (!wrongs.includes(w) && w !== ans) wrongs.push(w);
      }
      const { options, correctIdx } = QuizEngine.buildOptions(String(ans), wrongs.map(String), n);
      qs.push({
        id: `math-${qs.length}`,
        question: lang === 'pt' ? `Quanto é ${q}` : `What is ${q}`,
        options, correctIdx,
        explanation: lang === 'pt'
          ? `${q.replace('?', ans)} ✓`
          : `${q.replace('?', ans)} ✓`,
        difficulty: a <= 7 ? 'easy' : a <= 10 ? 'medium' : 'hard',
        lang,
      });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   TIMES TABLE QUIZ  — multiplication tables
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('timestables', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a  = parseInt(age) || 8;
    const n  = QuizEngine.optionCount(age);
    const maxTable = a <= 8 ? 5 : a <= 10 ? 10 : 12;
    const qs = [];
    const seen = new Set();
    let attempts = 0;

    while (qs.length < (count || 10) && attempts < 100) {
      attempts++;
      const x   = Math.floor(Math.random() * maxTable) + 2;
      const y   = Math.floor(Math.random() * maxTable) + 1;
      const key = `${x}x${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ans    = x * y;
      const wrongs = [];
      while (wrongs.length < n - 1) {
        const w = ans + (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? 1 : -1);
        if (w > 0 && !wrongs.includes(w) && w !== ans) wrongs.push(w);
      }
      const { options, correctIdx } = QuizEngine.buildOptions(String(ans), wrongs.map(String), n);
      qs.push({
        id: `tt-${qs.length}`,
        question: lang === 'pt' ? `${x} × ${y} = ?` : `${x} × ${y} = ?`,
        options, correctIdx,
        explanation: lang === 'pt' ? `${x} × ${y} = <strong>${ans}</strong>` : `${x} × ${y} = <strong>${ans}</strong>`,
        difficulty: x <= 5 ? 'easy' : 'medium',
        lang,
      });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   CLOCK QUIZ  — read analogue clock times
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('clocks', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a = parseInt(age) || 8;
    const n = QuizEngine.optionCount(age);
    const qs = [];
    const seen = new Set();

    const stepMins = a <= 8 ? 30 : a <= 10 ? 15 : a <= 12 ? 5 : 1;

    function fmtTime(h, m) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    function clockSVG(h, m) {
      const toRad = deg => (deg - 90) * Math.PI / 180;
      const minAngle = m * 6;
      const hourAngle = (h % 12) * 30 + m * 0.5;
      const cx = 60, cy = 60, r = 55;
      const mx = cx + 45 * Math.cos(toRad(minAngle));
      const my = cy + 45 * Math.sin(toRad(minAngle));
      const hx = cx + 30 * Math.cos(toRad(hourAngle));
      const hy = cy + 30 * Math.sin(toRad(hourAngle));
      const ticks = Array.from({length: 12}, (_, i) => {
        const a2 = toRad(i * 30);
        const x1 = cx + 50 * Math.cos(a2), y1 = cy + 50 * Math.sin(a2);
        const x2 = cx + 55 * Math.cos(a2), y2 = cy + 55 * Math.sin(a2);
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--text2)" stroke-width="2"/>`;
      }).join('');
      return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:120px;height:120px">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--card2)" stroke="var(--border2)" stroke-width="2"/>
        ${ticks}
        <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="var(--text)" stroke-width="4" stroke-linecap="round"/>
        <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="3" fill="var(--accent)"/>
      </svg>`;
    }

    let attempts = 0;
    while (qs.length < (count || 8) && attempts < 60) {
      attempts++;
      const h = Math.floor(Math.random() * 12);
      const m = Math.floor(Math.random() * (60 / stepMins)) * stepMins;
      const key = `${h}:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const correct = fmtTime(h, m);
      const wrongs  = [];
      while (wrongs.length < n - 1) {
        const wm = (m + (Math.floor(Math.random() * 3) + 1) * stepMins) % 60;
        const wh = Math.floor(Math.random() * 12);
        const w  = fmtTime(wh, wm);
        if (w !== correct && !wrongs.includes(w)) wrongs.push(w);
      }
      const { options, correctIdx } = QuizEngine.buildOptions(correct, wrongs, n);
      qs.push({
        id: `clock-${qs.length}`,
        question: lang === 'pt' ? 'Que horas são?' : 'What time does the clock show?',
        options, correctIdx,
        explanation: lang === 'pt'
          ? `São <strong>${correct}</strong>.`
          : `The time is <strong>${correct}</strong>.`,
        image: clockSVG(h, m),
        imageType: 'svg',
        difficulty: stepMins >= 30 ? 'easy' : stepMins >= 15 ? 'medium' : 'hard',
        lang,
      });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   EMOJI QUIZ  — guess from emoji
══════════════════════════════════════════════════════════════════ */
(function registerEmojiProvider() {
  const ITEMS = {
    pt: [
      ['🐘','Elefante'],['🦁','Leão'],['🐯','Tigre'],['🐻','Urso'],['🦊','Raposa'],
      ['🐺','Lobo'],['🐸','Rã'],['🐧','Pinguim'],['🦜','Papagaio'],['🦋','Borboleta'],
      ['🐙','Polvo'],['🦈','Tubarão'],['🐬','Golfinho'],['🦀','Caranguejo'],['🐢','Tartaruga'],
      ['🌸','Flor de cerejeira'],['🌻','Girassol'],['🌵','Cacto'],['🌴','Palmeira'],['🍀','Trevo'],
      ['🍎','Maçã'],['🍌','Banana'],['🍓','Morango'],['🍇','Uva'],['🍊','Laranja'],
      ['🍕','Pizza'],['🍔','Hambúrguer'],['🍦','Gelado'],['🎂','Bolo'],['🍩','Rosca'],
      ['🚀','Foguetão'],['✈️','Avião'],['🚂','Comboio'],['🚢','Navio'],['🚁','Helicóptero'],
      ['⚽','Bola de futebol'],['🏀','Basquetebol'],['🎸','Guitarra'],['🎹','Piano'],['🎺','Trompete'],
    ],
    en: [
      ['🐘','Elephant'],['🦁','Lion'],['🐯','Tiger'],['🐻','Bear'],['🦊','Fox'],
      ['🐺','Wolf'],['🐸','Frog'],['🐧','Penguin'],['🦜','Parrot'],['🦋','Butterfly'],
      ['🐙','Octopus'],['🦈','Shark'],['🐬','Dolphin'],['🦀','Crab'],['🐢','Turtle'],
      ['🌸','Cherry blossom'],['🌻','Sunflower'],['🌵','Cactus'],['🌴','Palm tree'],['🍀','Clover'],
      ['🍎','Apple'],['🍌','Banana'],['🍓','Strawberry'],['🍇','Grapes'],['🍊','Orange'],
      ['🍕','Pizza'],['🍔','Burger'],['🍦','Ice cream'],['🎂','Cake'],['🍩','Doughnut'],
      ['🚀','Rocket'],['✈️','Aeroplane'],['🚂','Train'],['🚢','Ship'],['🚁','Helicopter'],
      ['⚽','Football'],['🏀','Basketball'],['🎸','Guitar'],['🎹','Piano'],['🎺','Trumpet'],
    ]
  };

  QuizEngine.register('emoji', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(ITEMS[lang] || ITEMS.pt).slice(0, count || 10);
      const all  = (ITEMS[lang] || ITEMS.pt).map(x => x[1]);

      return pool.map((item, i) => {
        const [emoji, name] = item;
        const { options, correctIdx } = QuizEngine.buildOptions(name, all, n);
        const q = lang === 'pt' ? `O que representa este emoji?` : `What does this emoji represent?`;
        const exp = lang === 'pt'
          ? `${emoji} é um(a) <strong>${name}</strong>.`
          : `${emoji} is a <strong>${name}</strong>.`;
        return { id: `emoji-${i}`, question: q, options, correctIdx, explanation: exp,
          image: `<div style="font-size:4rem;text-align:center;line-height:1.2">${emoji}</div>`,
          imageType: 'svg', difficulty: 'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   SPACE QUIZ  — planets, moons, constellations
══════════════════════════════════════════════════════════════════ */
(function registerSpaceProvider() {
  const DATA = {
    pt: {
      planets: [
        { name:'Mercúrio', moons:0,  order:1, dist:'77M km',  type:'rochoso' },
        { name:'Vénus',    moons:0,  order:2, dist:'261M km', type:'rochoso' },
        { name:'Terra',    moons:1,  order:3, dist:'—',       type:'rochoso' },
        { name:'Marte',    moons:2,  order:4, dist:'225M km', type:'rochoso' },
        { name:'Júpiter',  moons:95, order:5, dist:'778M km', type:'gasoso'  },
        { name:'Saturno',  moons:146,order:6, dist:'1,4B km', type:'gasoso'  },
        { name:'Urano',    moons:28, order:7, dist:'2,9B km', type:'gelo'    },
        { name:'Neptuno',  moons:16, order:8, dist:'4,5B km', type:'gelo'    },
      ],
      facts: [
        { q:'Qual é o planeta mais próximo do Sol?',    a:'Mercúrio', exp:'Mercúrio é o primeiro planeta do Sistema Solar.'},
        { q:'Qual é o maior planeta do Sistema Solar?', a:'Júpiter',  exp:'Júpiter tem mais de 1 300 Terras de volume.'},
        { q:'Quantas luas tem a Terra?',                a:'1',        exp:'A lua da Terra chama-se Lua.', opts:['0','1','2','3']},
        { q:'Qual planeta tem os anéis mais visíveis?', a:'Saturno',  exp:'Os anéis de Saturno são compostos por gelo e rocha.'},
        { q:'Qual é o planeta mais quente?',            a:'Vénus',    exp:'Vénus é mais quente que Mercúrio por causa do efeito de estufa.'},
        { q:'Qual é o planeta vermelho?',               a:'Marte',    exp:'Marte tem cor avermelhada por causa do óxido de ferro.'},
        { q:'Quantos planetas tem o Sistema Solar?',    a:'8',        exp:'Os 8 planetas são: Mercúrio, Vénus, Terra, Marte, Júpiter, Saturno, Urano e Neptuno.', opts:['6','7','8','9']},
        { q:'O que é um ano-luz?',                      a:'A distância que a luz percorre em 1 ano', exp:'1 ano-luz ≈ 9,46 biliões de km.', opts:['Um tipo de estrela','A distância que a luz percorre em 1 ano','O tempo que a luz demora a sair do Sol','A velocidade máxima de um foguetão']},
        { q:'Que estrela aquece a Terra?',              a:'O Sol',    exp:'O Sol é uma estrela do tipo anã amarela.', opts:['A Lua','O Sol','Sírius','Alfa Centauri']},
        { q:'O que é uma galáxia?',                     a:'Um enorme conjunto de estrelas', exp:'A Via Láctea é a nossa galáxia.', opts:['Um planeta gigante','Um enorme conjunto de estrelas','Uma nuvem de gás','Um buraco negro']},
      ]
    },
    en: {
      planets: [
        { name:'Mercury', moons:0,  order:1 },
        { name:'Venus',   moons:0,  order:2 },
        { name:'Earth',   moons:1,  order:3 },
        { name:'Mars',    moons:2,  order:4 },
        { name:'Jupiter', moons:95, order:5 },
        { name:'Saturn',  moons:146,order:6 },
        { name:'Uranus',  moons:28, order:7 },
        { name:'Neptune', moons:16, order:8 },
      ],
      facts: [
        { q:'Which planet is closest to the Sun?',       a:'Mercury', exp:'Mercury is the first planet of the Solar System.'},
        { q:'Which is the largest planet?',              a:'Jupiter',  exp:'Jupiter could fit over 1,300 Earths inside it.'},
        { q:'How many moons does Earth have?',           a:'1',        exp:"Earth's moon is simply called the Moon.", opts:['0','1','2','3']},
        { q:'Which planet has the most visible rings?',  a:'Saturn',   exp:'Saturn\'s rings are made of ice and rock.'},
        { q:'Which is the hottest planet?',              a:'Venus',    exp:'Venus is hotter than Mercury due to the greenhouse effect.'},
        { q:'Which planet is called the Red Planet?',    a:'Mars',     exp:'Mars appears red due to iron oxide on its surface.'},
        { q:'How many planets are in the Solar System?', a:'8',        exp:'The 8 planets are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.', opts:['6','7','8','9']},
        { q:'What is a light-year?',                     a:'The distance light travels in one year', exp:'1 light-year ≈ 9.46 trillion km.', opts:['A type of star','The distance light travels in one year','The time light takes to leave the Sun','The maximum speed of a rocket']},
        { q:'Which star warms the Earth?',               a:'The Sun',  exp:'The Sun is a yellow dwarf star.', opts:['The Moon','The Sun','Sirius','Alpha Centauri']},
        { q:'What is a galaxy?',                         a:'A massive collection of stars', exp:'The Milky Way is our galaxy.', opts:['A giant planet','A massive collection of stars','A cloud of gas','A black hole']},
      ]
    }
  };

  QuizEngine.register('space', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n  = QuizEngine.optionCount(age);
      const d  = DATA[lang] || DATA.en;
      const qs = [];

      for (const fact of QuizEngine.shuffle(d.facts).slice(0, count || 10)) {
        const { options, correctIdx } = fact.opts
          ? { options: fact.opts, correctIdx: fact.opts.indexOf(fact.a) }
          : QuizEngine.buildOptions(fact.a, d.planets.map(p => p.name), n);
        qs.push({
          id: `space-${qs.length}`,
          question: fact.q, options, correctIdx,
          explanation: fact.exp,
          difficulty: age <= 10 ? 'easy' : 'medium',
          lang,
        });
      }
      return qs;
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   HUMAN BODY QUIZ
══════════════════════════════════════════════════════════════════ */
(function registerBodyProvider() {
  const DATA = {
    pt: [
      { q:'Qual é o osso mais longo do corpo?',               a:'Fémur',       opts:['Tíbia','Fémur','Rádio','Húmero'],          exp:'O fémur é o osso da coxa.' },
      { q:'Quantos dentes tem um adulto?',                    a:'32',          opts:['28','30','32','36'],                         exp:'Os adultos têm 32 dentes, incluindo os sisos.' },
      { q:'Qual o órgão que bombeia o sangue?',               a:'Coração',     opts:['Pulmão','Coração','Fígado','Rim'],           exp:'O coração bombeia cerca de 5 litros de sangue por minuto.' },
      { q:'Onde se produz a bílis?',                          a:'Fígado',      opts:['Estômago','Fígado','Rim','Pâncreas'],        exp:'A bílis é produzida no fígado e armazenada na vesícula biliar.' },
      { q:'Qual é o maior órgão do corpo humano?',            a:'Pele',        opts:['Fígado','Pulmão','Pele','Intestino'],        exp:'A pele é o maior órgão e cobre todo o corpo.' },
      { q:'Quantos ossos tem um adulto?',                     a:'206',         opts:['106','206','306','406'],                     exp:'Os adultos têm 206 ossos. Os bebés nascem com cerca de 270.' },
      { q:'Qual sentido usa os olhos?',                       a:'Visão',       opts:['Audição','Visão','Olfacto','Tacto'],         exp:'Os olhos captam luz e enviam sinais ao cérebro.' },
      { q:'Qual órgão filtra o sangue e produz urina?',       a:'Rim',         opts:['Coração','Pulmão','Fígado','Rim'],           exp:'Os rins filtram cerca de 180 litros de sangue por dia.' },
      { q:'O que transporta o oxigénio no sangue?',           a:'Glóbulos vermelhos', opts:['Plasma','Glóbulos brancos','Plaquetas','Glóbulos vermelhos'], exp:'Os glóbulos vermelhos contêm hemoglobina que transporta oxigénio.' },
      { q:'Qual é a parte do olho que controla a pupila?',    a:'Íris',        opts:['Córnea','Retina','Íris','Cristalino'],       exp:'A íris é a parte colorida do olho que ajusta o tamanho da pupila.' },
    ],
    en: [
      { q:'Which is the longest bone in the body?',            a:'Femur',       opts:['Tibia','Femur','Radius','Humerus'],          exp:'The femur is the thigh bone.' },
      { q:'How many teeth does an adult have?',               a:'32',          opts:['28','30','32','36'],                         exp:'Adults have 32 teeth, including wisdom teeth.' },
      { q:'Which organ pumps blood?',                         a:'Heart',       opts:['Lung','Heart','Liver','Kidney'],             exp:'The heart pumps about 5 litres of blood per minute.' },
      { q:'Where is bile produced?',                          a:'Liver',       opts:['Stomach','Liver','Kidney','Pancreas'],       exp:'Bile is made in the liver and stored in the gallbladder.' },
      { q:'Which is the largest organ in the human body?',    a:'Skin',        opts:['Liver','Lung','Skin','Intestine'],           exp:'Skin is the largest organ and covers the whole body.' },
      { q:'How many bones does an adult have?',               a:'206',         opts:['106','206','306','406'],                     exp:'Adults have 206 bones. Babies are born with about 270.' },
      { q:'Which sense uses the eyes?',                       a:'Sight',       opts:['Hearing','Sight','Smell','Touch'],           exp:'The eyes capture light and send signals to the brain.' },
      { q:'Which organ filters blood and makes urine?',       a:'Kidney',      opts:['Heart','Lung','Liver','Kidney'],             exp:'Kidneys filter about 180 litres of blood per day.' },
      { q:'What carries oxygen in the blood?',                a:'Red blood cells', opts:['Plasma','White blood cells','Platelets','Red blood cells'], exp:'Red blood cells contain haemoglobin which carries oxygen.' },
      { q:'Which part of the eye controls the pupil?',        a:'Iris',        opts:['Cornea','Retina','Iris','Lens'],             exp:'The iris is the coloured part of the eye that adjusts pupil size.' },
    ]
  };

  QuizEngine.register('body', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n   = QuizEngine.optionCount(age);
      const d   = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      return pool.map((item, i) => {
        const opts2 = item.opts && item.opts.length >= n
          ? item.opts.slice(0, n)
          : item.opts;
        const options    = opts2 || QuizEngine.buildOptions(item.a, d.map(x => x.a), n).options;
        const correctIdx = (opts2 || options).indexOf(item.a);
        return { id: `body-${i}`, question: item.q, options, correctIdx,
          explanation: item.exp, difficulty: age <= 10 ? 'easy' : 'medium', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   PROFESSIONS QUIZ
══════════════════════════════════════════════════════════════════ */
(function registerProfessionsProvider() {
  const DATA = {
    pt: [
      { emoji:'👨‍⚕️', name:'Médico',       clue:'Trata doenças e cuida da saúde das pessoas.' },
      { emoji:'👨‍🏫', name:'Professor',    clue:'Ensina alunos na escola ou universidade.' },
      { emoji:'👨‍🚒', name:'Bombeiro',     clue:'Combate incêndios e salva vidas em emergências.' },
      { emoji:'👮',   name:'Polícia',      clue:'Garante a segurança e a ordem pública.' },
      { emoji:'👨‍🍳', name:'Cozinheiro',   clue:'Prepara e cozinha alimentos.' },
      { emoji:'👨‍✈️', name:'Piloto',       clue:'Pilota aviões e transporte aéreo.' },
      { emoji:'👨‍🔧', name:'Mecânico',     clue:'Repara e mantém veículos e máquinas.' },
      { emoji:'👨‍⚖️', name:'Advogado',     clue:'Representa clientes em questões legais.' },
      { emoji:'👨‍🎨', name:'Artista',      clue:'Cria obras de arte, pinturas e esculturas.' },
      { emoji:'👩‍🚀', name:'Astronauta',   clue:'Viaja para o espaço e realiza missões espaciais.' },
      { emoji:'👩‍💻', name:'Programador',  clue:'Escreve código e desenvolve software.' },
      { emoji:'👨‍🌾', name:'Agricultor',   clue:'Cultiva plantas e cria animais para alimentação.' },
    ],
    en: [
      { emoji:'👨‍⚕️', name:'Doctor',      clue:'Treats illness and looks after people\'s health.' },
      { emoji:'👨‍🏫', name:'Teacher',     clue:'Teaches students at school or university.' },
      { emoji:'👨‍🚒', name:'Firefighter', clue:'Fights fires and saves lives in emergencies.' },
      { emoji:'👮',   name:'Police officer',clue:'Maintains safety and public order.' },
      { emoji:'👨‍🍳', name:'Chef',         clue:'Prepares and cooks food.' },
      { emoji:'👨‍✈️', name:'Pilot',        clue:'Flies aeroplanes and aircraft.' },
      { emoji:'👨‍🔧', name:'Mechanic',     clue:'Repairs and maintains vehicles and machines.' },
      { emoji:'👨‍⚖️', name:'Lawyer',       clue:'Represents clients in legal matters.' },
      { emoji:'👨‍🎨', name:'Artist',       clue:'Creates paintings, sculptures and artwork.' },
      { emoji:'👩‍🚀', name:'Astronaut',    clue:'Travels to space and carries out space missions.' },
      { emoji:'👩‍💻', name:'Programmer',   clue:'Writes code and develops software.' },
      { emoji:'👨‍🌾', name:'Farmer',       clue:'Grows crops and raises animals for food.' },
    ]
  };

  QuizEngine.register('professions', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const d    = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      const all  = d.map(x => x.name);
      const q    = lang === 'pt' ? 'Que profissão é esta?' : 'What is this profession?';

      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.name, all, n);
        return { id: `prof-${i}`, question: q, options, correctIdx,
          explanation: item.clue,
          image: `<div style="font-size:4rem;text-align:center;line-height:1.3">${item.emoji}</div>`,
          imageType: 'svg', difficulty: 'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   COLOURS QUIZ
══════════════════════════════════════════════════════════════════ */
(function registerColourProvider() {
  const COLOURS = {
    pt: [
      { hex:'#ef4444', name:'Vermelho' }, { hex:'#3b82f6', name:'Azul' },
      { hex:'#22c55e', name:'Verde' },    { hex:'#eab308', name:'Amarelo' },
      { hex:'#a855f7', name:'Roxo' },     { hex:'#f97316', name:'Laranja' },
      { hex:'#ec4899', name:'Rosa' },     { hex:'#14b8a6', name:'Ciano' },
      { hex:'#f8fafc', name:'Branco' },   { hex:'#1e293b', name:'Preto' },
      { hex:'#78716c', name:'Cinzento' }, { hex:'#92400e', name:'Castanho' },
    ],
    en: [
      { hex:'#ef4444', name:'Red' },      { hex:'#3b82f6', name:'Blue' },
      { hex:'#22c55e', name:'Green' },    { hex:'#eab308', name:'Yellow' },
      { hex:'#a855f7', name:'Purple' },   { hex:'#f97316', name:'Orange' },
      { hex:'#ec4899', name:'Pink' },     { hex:'#14b8a6', name:'Cyan' },
      { hex:'#f8fafc', name:'White' },    { hex:'#1e293b', name:'Black' },
      { hex:'#78716c', name:'Grey' },     { hex:'#92400e', name:'Brown' },
    ]
  };

  QuizEngine.register('colours', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const d    = COLOURS[lang] || COLOURS.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      const all  = d.map(x => x.name);
      const q    = lang === 'pt' ? 'Que cor é esta?' : 'What colour is this?';

      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.name, all, n);
        const swatch = `<div style="width:80px;height:80px;border-radius:50%;background:${item.hex};margin:0 auto;border:3px solid var(--border2)"></div>`;
        return { id: `col-${i}`, question: q, options, correctIdx,
          explanation: lang === 'pt' ? `Esta cor é <strong>${item.name}</strong>.` : `This colour is <strong>${item.name}</strong>.`,
          image: swatch, imageType: 'svg', difficulty: 'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   FAMOUS MONUMENTS QUIZ  — built-in data
══════════════════════════════════════════════════════════════════ */
(function registerMonumentsProvider() {
  const DATA = {
    pt: [
      { name:'Torre Eiffel',      country:'França',        fact:'Construída em 1889 para a Exposição Universal de Paris.' },
      { name:'Coliseu de Roma',   country:'Itália',        fact:'Arena romana que chegou a ter 80 000 espectadores.' },
      { name:'Muralha da China',  country:'China',         fact:'Tem mais de 21 000 km de comprimento.' },
      { name:'Machu Picchu',      country:'Peru',          fact:'Cidade inca construída no século XV a 2 430 m de altitude.' },
      { name:'Taj Mahal',         country:'Índia',         fact:'Mausoléu construído pelo imperador Shah Jahan em memória da sua esposa.' },
      { name:'Cristo Redentor',   country:'Brasil',        fact:'Estátua de 30 metros no cume do Corcovado no Rio de Janeiro.' },
      { name:'Acrópole de Atenas',country:'Grécia',        fact:'Complexo de templos construído no século V a.C., inclui o Pártenon.' },
      { name:'Pirâmides de Gizé', country:'Egipto',        fact:'As maiores pirâmides do mundo, construídas há 4 500 anos.' },
      { name:'Palácio de Versalhes',country:'França',      fact:'Palácio barroco que foi residência dos reis de França.' },
      { name:'Torre de Belém',    country:'Portugal',      fact:'Monumento manuelino edificado no século XVI em Lisboa.' },
      { name:'Mosteiro dos Jerónimos',country:'Portugal',  fact:'Monumento manuelino e Património Mundial da UNESCO em Lisboa.' },
    ],
    en: [
      { name:'Eiffel Tower',       country:'France',   fact:'Built in 1889 for the Paris World Fair.' },
      { name:'Colosseum',          country:'Italy',    fact:'Roman arena that once held 80,000 spectators.' },
      { name:'Great Wall of China',country:'China',    fact:'Over 21,000 km long.' },
      { name:'Machu Picchu',       country:'Peru',     fact:'15th-century Inca city built at 2,430 m altitude.' },
      { name:'Taj Mahal',          country:'India',    fact:'Mausoleum built by Emperor Shah Jahan for his wife.' },
      { name:'Christ the Redeemer',country:'Brazil',   fact:'30-metre statue on Corcovado hill in Rio de Janeiro.' },
      { name:'Acropolis of Athens',country:'Greece',   fact:'5th century BC temple complex including the Parthenon.' },
      { name:'Pyramids of Giza',   country:'Egypt',    fact:'The world\'s largest pyramids, built 4,500 years ago.' },
      { name:'Palace of Versailles',country:'France',  fact:'Baroque palace that was home to the French kings.' },
      { name:'Tower of Belém',     country:'Portugal', fact:'Manueline tower built in the 16th century in Lisbon.' },
      { name:'Jerónimos Monastery',country:'Portugal', fact:'UNESCO World Heritage Manueline monastery in Lisbon.' },
    ]
  };

  QuizEngine.register('monuments', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const d    = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      const all  = d.map(x => x.name);

      return pool.map((item, i) => {
        const q = lang === 'pt'
          ? `Em que país fica <strong>${item.name}</strong>?`
          : `In which country is <strong>${item.name}</strong>?`;
        const countries = d.map(x => x.country);
        const { options, correctIdx } = QuizEngine.buildOptions(item.country, countries, n);
        return { id: `mon-${i}`, question: q, options, correctIdx,
          explanation: item.fact, difficulty: age <= 10 ? 'easy' : 'medium', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   TECHNOLOGY QUIZ — computers, internet, AI basics
══════════════════════════════════════════════════════════════════ */
(function registerTechProvider() {
  const DATA = {
    pt: [
      { q:'O que significa "CPU"?',                               a:'Unidade Central de Processamento', opts:['Central Power Unit','Unidade Central de Processamento','Computer Processing Unit','Central Program Utility'], exp:'A CPU é o "cérebro" do computador que executa instruções.' },
      { q:'O que é a internet?',                                  a:'Uma rede global de computadores ligados entre si', opts:['Um programa de e-mail','Uma rede global de computadores ligados entre si','Um sistema operativo','Um tipo de processador'], exp:'A internet liga biliões de dispositivos em todo o mundo.' },
      { q:'O que é um ficheiro PDF?',                             a:'Um formato de documento portátil', opts:['Um vírus informático','Um tipo de imagem','Um formato de documento portátil','Um programa de jogos'], exp:'PDF significa "Portable Document Format", criado pela Adobe.' },
      { q:'Qual destes é um sistema operativo?',                  a:'Windows', opts:['Google Chrome','Word','Windows','Photoshop'], exp:'Windows é o sistema operativo mais usado em computadores pessoais.' },
      { q:'O que faz um antivírus?',                              a:'Protege o computador de software malicioso', opts:['Acelera o computador','Protege o computador de software malicioso','Liga à internet','Grava vídeos'], exp:'O antivírus detecta e remove vírus e outros programas maliciosos.' },
      { q:'O que é um "byte"?',                                   a:'Uma unidade de informação digital', opts:['Um tipo de processador','Uma unidade de informação digital','Um cabo de dados','Um programa informático'], exp:'1 byte = 8 bits. É a unidade básica de armazenamento digital.' },
      { q:'O que é inteligência artificial?',                     a:'Sistemas que simulam inteligência humana', opts:['Robôs que substituem humanos','Sistemas que simulam inteligência humana','Uma nova linguagem de programação','Computadores super-rápidos'], exp:'A IA permite que as máquinas aprendam e tomem decisões.' },
      { q:'O que é uma "password"?',                              a:'Uma palavra-chave para proteger o acesso', opts:['Um tipo de vírus','Uma palavra-chave para proteger o acesso','Um endereço de e-mail','Um ficheiro de imagem'], exp:'Usa sempre passwords fortes com letras, números e símbolos.' },
      { q:'O que significa "Wi-Fi"?',                             a:'Tecnologia de rede sem fios', opts:['Wireless Fidelity','Tecnologia de rede sem fios','Wide Field Internet','Ambas as anteriores'], exp:'Wi-Fi permite ligar dispositivos à internet sem cabos.' },
      { q:'Quantos bits tem 1 byte?',                             a:'8', opts:['4','8','16','32'], exp:'1 byte = 8 bits. Esta é a unidade base do armazenamento digital.' },
    ],
    en: [
      { q:'What does "CPU" stand for?',                            a:'Central Processing Unit', opts:['Central Power Unit','Central Processing Unit','Computer Processing Unit','Central Program Utility'], exp:'The CPU is the "brain" of the computer that executes instructions.' },
      { q:'What is the internet?',                                 a:'A global network of connected computers', opts:['An email program','A global network of connected computers','An operating system','A type of processor'], exp:'The internet connects billions of devices worldwide.' },
      { q:'What is a PDF file?',                                   a:'A portable document format', opts:['A computer virus','A type of image','A portable document format','A gaming program'], exp:'PDF stands for "Portable Document Format", created by Adobe.' },
      { q:'Which of these is an operating system?',               a:'Windows', opts:['Google Chrome','Word','Windows','Photoshop'], exp:'Windows is the most widely used operating system on personal computers.' },
      { q:'What does antivirus software do?',                     a:'Protects computers from malicious software', opts:['Speeds up the computer','Protects computers from malicious software','Connects to the internet','Records videos'], exp:'Antivirus detects and removes viruses and other malicious programs.' },
      { q:'What is a "byte"?',                                    a:'A unit of digital information', opts:['A type of processor','A unit of digital information','A data cable','A computer program'], exp:'1 byte = 8 bits. It is the basic unit of digital storage.' },
      { q:'What is artificial intelligence?',                     a:'Systems that simulate human intelligence', opts:['Robots that replace humans','Systems that simulate human intelligence','A new programming language','Very fast computers'], exp:'AI allows machines to learn and make decisions.' },
      { q:'What is a "password"?',                                a:'A secret word or phrase to protect access', opts:['A type of virus','A secret word or phrase to protect access','An email address','An image file'], exp:'Always use strong passwords with letters, numbers and symbols.' },
      { q:'What does "Wi-Fi" enable?',                            a:'Wireless internet connectivity', opts:['Wired connections only','Wireless internet connectivity','Faster hard drives','Better graphics'], exp:'Wi-Fi allows devices to connect to the internet without cables.' },
      { q:'How many bits are in 1 byte?',                         a:'8', opts:['4','8','16','32'], exp:'1 byte = 8 bits. This is the base unit of digital storage.' },
    ]
  };

  QuizEngine.register('technology', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const d    = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);

      return pool.map((item, i) => {
        const options    = (item.opts || []).slice(0, n);
        const correctIdx = options.indexOf(item.a);
        return { id: `tech-${i}`, question: item.q, options, correctIdx,
          explanation: item.exp, difficulty: age <= 10 ? 'easy' : 'medium', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   SPELLING / LANGUAGE QUIZ — Portuguese ortography & synonyms
══════════════════════════════════════════════════════════════════ */
(function registerLanguageProvider() {
  const ORTHO_PT = [
    { q:'Qual a escrita correcta?', opts:['desenvolvmento','desenvolvimento','desenvolivmento','desenvolvimeto'], a:'desenvolvimento', exp:'"Desenvolvimento" — palavra muito usada, não se esqueças dos dois "e".' },
    { q:'Qual a escrita correcta?', opts:['necessário','nessessário','necesário','necesário'], a:'necessário', exp:'"Necessário" — escreve-se com dois "s".' },
    { q:'Qual a escrita correcta?', opts:['definitivamente','definitvamente','difintivamente','definitivamente'], a:'definitivamente', exp:'"Definitivamente" — vem de "definitivo".' },
    { q:'Qual a escrita correcta?', opts:['excelente','excelente','exelente','ecxelente'], a:'excelente', exp:'"Excelente" — "xc" seguido de "e".' },
    { q:'Qual a escrita correcta?', opts:['provavelmente','provavelmente','provavelmete','provávelmente'], a:'provavelmente', exp:'"Provavelmente" — sem acento em "provavel".' },
    { q:'Qual é o sinónimo de "feliz"?',     opts:['triste','alegre','cansado','irritado'],  a:'alegre',    exp:'"Alegre" é sinónimo de "feliz".' },
    { q:'Qual é o sinónimo de "rápido"?',    opts:['lento','veloz','demorado','pesado'],     a:'veloz',     exp:'"Veloz" é sinónimo de "rápido".' },
    { q:'Qual é o antónimo de "pequeno"?',   opts:['médio','igual','grande','largo'],        a:'grande',    exp:'O antónimo (contrário) de "pequeno" é "grande".' },
    { q:'Qual é o antónimo de "fácil"?',     opts:['simples','rápido','difícil','curto'],    a:'difícil',   exp:'O antónimo de "fácil" é "difícil".' },
    { q:'Qual é o plural de "pão"?',         opts:['pãos','pões','pães','pans'],             a:'pães',      exp:'O plural de "pão" é "pães" — é uma excepção à regra geral.' },
    { q:'Qual é o plural de "mão"?',         opts:['mãos','mões','mães','mans'],             a:'mãos',      exp:'O plural de "mão" é "mãos".' },
    { q:'Completa: "Ele ___ para a escola."',opts:['vai','vou','vamos','vão'],               a:'vai',       exp:'"Ele vai" — 3ª pessoa do singular do verbo "ir".' },
  ];

  const VOCAB_EN = [
    { q:'What is the synonym of "happy"?',   opts:['sad','joyful','tired','angry'],        a:'joyful',    exp:'"Joyful" means feeling great happiness.' },
    { q:'What is the antonym of "small"?',   opts:['tiny','medium','large','narrow'],      a:'large',     exp:'The antonym (opposite) of "small" is "large".' },
    { q:'What is the antonym of "fast"?',    opts:['quick','slow','bright','hard'],         a:'slow',      exp:'The opposite of "fast" is "slow".' },
    { q:'What is the plural of "child"?',    opts:['childs','childes','children','childer'],a:'children',  exp:'"Children" is an irregular plural.' },
    { q:'What is the plural of "tooth"?',    opts:['tooths','teeths','tooths','teeth'],     a:'teeth',     exp:'"Teeth" is an irregular plural.' },
    { q:'Complete: "She ___ to school."',    opts:['go','goes','going','gone'],              a:'goes',      exp:'"She goes" — 3rd person singular of "to go".' },
    { q:'What is the synonym of "begin"?',   opts:['end','start','stop','pause'],           a:'start',     exp:'"Start" and "begin" mean the same thing.' },
    { q:'What is the antonym of "day"?',     opts:['morning','evening','night','afternoon'],a:'night',     exp:'The opposite of "day" is "night".' },
  ];

  QuizEngine.register('spelling-pt', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(ORTHO_PT).slice(0, count || 10);
      return pool.map((item, i) => {
        const options    = item.opts.slice(0, n);
        const correctIdx = options.indexOf(item.a);
        return { id: `spell-${i}`, question: item.q, options, correctIdx,
          explanation: item.exp, difficulty: age <= 10 ? 'easy' : 'medium', lang: 'pt' };
      });
    }
  });

  QuizEngine.register('vocabulary-en', {
    getQuestions(opts) {
      const { age, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(VOCAB_EN).slice(0, count || 8);
      return pool.map((item, i) => {
        const options    = item.opts.slice(0, n);
        const correctIdx = options.indexOf(item.a);
        return { id: `vocab-${i}`, question: item.q, options, correctIdx,
          explanation: item.exp, difficulty: age <= 10 ? 'easy' : 'medium', lang: 'en' };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   FOOD QUIZ — fruits, vegetables, dishes
══════════════════════════════════════════════════════════════════ */
(function registerFoodProvider() {
  const DATA = {
    pt: [
      { emoji:'🍎', name:'Maçã',        group:'fruta' },
      { emoji:'🍌', name:'Banana',      group:'fruta' },
      { emoji:'🍊', name:'Laranja',     group:'fruta' },
      { emoji:'🍇', name:'Uva',         group:'fruta' },
      { emoji:'🍓', name:'Morango',     group:'fruta' },
      { emoji:'🍑', name:'Pêssego',     group:'fruta' },
      { emoji:'🥝', name:'Kiwi',        group:'fruta' },
      { emoji:'🍍', name:'Ananás',      group:'fruta' },
      { emoji:'🥕', name:'Cenoura',     group:'legume' },
      { emoji:'🥦', name:'Brócolos',    group:'legume' },
      { emoji:'🧅', name:'Cebola',      group:'legume' },
      { emoji:'🍆', name:'Beringela',   group:'legume' },
      { emoji:'🥔', name:'Batata',      group:'legume' },
      { emoji:'🍅', name:'Tomate',      group:'fruta' },
      { emoji:'🫑', name:'Pimento',     group:'legume' },
    ],
    en: [
      { emoji:'🍎', name:'Apple',       group:'fruit' },
      { emoji:'🍌', name:'Banana',      group:'fruit' },
      { emoji:'🍊', name:'Orange',      group:'fruit' },
      { emoji:'🍇', name:'Grapes',      group:'fruit' },
      { emoji:'🍓', name:'Strawberry',  group:'fruit' },
      { emoji:'🍑', name:'Peach',       group:'fruit' },
      { emoji:'🥝', name:'Kiwi',        group:'fruit' },
      { emoji:'🍍', name:'Pineapple',   group:'fruit' },
      { emoji:'🥕', name:'Carrot',      group:'vegetable' },
      { emoji:'🥦', name:'Broccoli',    group:'vegetable' },
      { emoji:'🧅', name:'Onion',       group:'vegetable' },
      { emoji:'🍆', name:'Aubergine',   group:'vegetable' },
      { emoji:'🥔', name:'Potato',      group:'vegetable' },
      { emoji:'🍅', name:'Tomato',      group:'fruit' },
      { emoji:'🫑', name:'Pepper',      group:'vegetable' },
    ]
  };

  QuizEngine.register('food', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n    = QuizEngine.optionCount(age);
      const d    = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      const all  = d.map(x => x.name);
      const q    = lang === 'pt' ? 'O que é isto?' : 'What is this?';

      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.name, all, n);
        return { id: `food-${i}`, question: q, options, correctIdx,
          explanation: lang === 'pt' ? `Isto é um(a) <strong>${item.name}</strong> (${item.group}).` : `This is a <strong>${item.name}</strong> (${item.group}).`,
          image: `<div style="font-size:4.5rem;text-align:center;line-height:1.2">${item.emoji}</div>`,
          imageType: 'svg', difficulty: 'easy', lang };
      });
    }
  });
})();
