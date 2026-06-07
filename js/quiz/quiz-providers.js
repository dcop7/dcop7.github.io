/* ══════════════════════════════════════════════════════════════════
   QUIZ PROVIDERS — generate/serve questions per category (fully offline).
   Most quizzes load their banks from the in-repo split database
   (quizzes/<id>/<lang>/<difficulty>.json via QuizData); the rest are
   generated locally (math, clocks, flags from data/countries.json, …).
   Question shape:
   { id, question, options[], correctIdx, explanation,
     image?, imageType ('flag'|'svg'|null), difficulty, lang }
══════════════════════════════════════════════════════════════════ */

/* ── Fetch helper ── */
async function _qFetch(url, timeoutMs) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs || 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    return r;
  } catch (e) { clearTimeout(tid); throw e; }
}

/* ══════════════════════════════════════════════════════════════════
   EMBEDDED COUNTRY DATA — used when REST Countries API is unavailable
   Fields: n=name(EN), p=namePt, c=capital, r=cca2, g=region
══════════════════════════════════════════════════════════════════ */
const _COUNTRIES_FB = [
  {n:'Portugal',p:'Portugal',c:'Lisboa',r:'pt',g:'Europe'},
  {n:'Spain',p:'Espanha',c:'Madrid',r:'es',g:'Europe'},
  {n:'France',p:'França',c:'Paris',r:'fr',g:'Europe'},
  {n:'Germany',p:'Alemanha',c:'Berlim',r:'de',g:'Europe'},
  {n:'Italy',p:'Itália',c:'Roma',r:'it',g:'Europe'},
  {n:'United Kingdom',p:'Reino Unido',c:'Londres',r:'gb',g:'Europe'},
  {n:'Netherlands',p:'Países Baixos',c:'Amesterdão',r:'nl',g:'Europe'},
  {n:'Belgium',p:'Bélgica',c:'Bruxelas',r:'be',g:'Europe'},
  {n:'Switzerland',p:'Suíça',c:'Berna',r:'ch',g:'Europe'},
  {n:'Austria',p:'Áustria',c:'Viena',r:'at',g:'Europe'},
  {n:'Sweden',p:'Suécia',c:'Estocolmo',r:'se',g:'Europe'},
  {n:'Norway',p:'Noruega',c:'Oslo',r:'no',g:'Europe'},
  {n:'Denmark',p:'Dinamarca',c:'Copenhaga',r:'dk',g:'Europe'},
  {n:'Finland',p:'Finlândia',c:'Helsínquia',r:'fi',g:'Europe'},
  {n:'Poland',p:'Polónia',c:'Varsóvia',r:'pl',g:'Europe'},
  {n:'Greece',p:'Grécia',c:'Atenas',r:'gr',g:'Europe'},
  {n:'Czech Republic',p:'República Checa',c:'Praga',r:'cz',g:'Europe'},
  {n:'Hungary',p:'Hungria',c:'Budapeste',r:'hu',g:'Europe'},
  {n:'Romania',p:'Roménia',c:'Bucareste',r:'ro',g:'Europe'},
  {n:'Russia',p:'Rússia',c:'Moscovo',r:'ru',g:'Europe'},
  {n:'Ukraine',p:'Ucrânia',c:'Kiev',r:'ua',g:'Europe'},
  {n:'Turkey',p:'Turquia',c:'Ancara',r:'tr',g:'Asia'},
  {n:'United States',p:'Estados Unidos',c:'Washington D.C.',r:'us',g:'Americas'},
  {n:'Canada',p:'Canadá',c:'Ottawa',r:'ca',g:'Americas'},
  {n:'Mexico',p:'México',c:'Cidade do México',r:'mx',g:'Americas'},
  {n:'Brazil',p:'Brasil',c:'Brasília',r:'br',g:'Americas'},
  {n:'Argentina',p:'Argentina',c:'Buenos Aires',r:'ar',g:'Americas'},
  {n:'Colombia',p:'Colômbia',c:'Bogotá',r:'co',g:'Americas'},
  {n:'Chile',p:'Chile',c:'Santiago',r:'cl',g:'Americas'},
  {n:'Peru',p:'Peru',c:'Lima',r:'pe',g:'Americas'},
  {n:'Venezuela',p:'Venezuela',c:'Caracas',r:'ve',g:'Americas'},
  {n:'Cuba',p:'Cuba',c:'Havana',r:'cu',g:'Americas'},
  {n:'China',p:'China',c:'Pequim',r:'cn',g:'Asia'},
  {n:'Japan',p:'Japão',c:'Tóquio',r:'jp',g:'Asia'},
  {n:'South Korea',p:'Coreia do Sul',c:'Seul',r:'kr',g:'Asia'},
  {n:'India',p:'Índia',c:'Nova Deli',r:'in',g:'Asia'},
  {n:'Indonesia',p:'Indonésia',c:'Jacarta',r:'id',g:'Asia'},
  {n:'Saudi Arabia',p:'Arábia Saudita',c:'Riade',r:'sa',g:'Asia'},
  {n:'Iran',p:'Irão',c:'Teerão',r:'ir',g:'Asia'},
  {n:'Iraq',p:'Iraque',c:'Bagdade',r:'iq',g:'Asia'},
  {n:'Israel',p:'Israel',c:'Jerusalém',r:'il',g:'Asia'},
  {n:'Pakistan',p:'Paquistão',c:'Islamabad',r:'pk',g:'Asia'},
  {n:'Bangladesh',p:'Bangladesh',c:'Dacca',r:'bd',g:'Asia'},
  {n:'Thailand',p:'Tailândia',c:'Banguecoque',r:'th',g:'Asia'},
  {n:'Vietnam',p:'Vietname',c:'Hanói',r:'vn',g:'Asia'},
  {n:'Philippines',p:'Filipinas',c:'Manila',r:'ph',g:'Asia'},
  {n:'Malaysia',p:'Malásia',c:'Kuala Lumpur',r:'my',g:'Asia'},
  {n:'Singapore',p:'Singapura',c:'Singapura',r:'sg',g:'Asia'},
  {n:'Egypt',p:'Egipto',c:'Cairo',r:'eg',g:'Africa'},
  {n:'Nigeria',p:'Nigéria',c:'Abuja',r:'ng',g:'Africa'},
  {n:'South Africa',p:'África do Sul',c:'Pretória',r:'za',g:'Africa'},
  {n:'Kenya',p:'Quénia',c:'Nairóbi',r:'ke',g:'Africa'},
  {n:'Ethiopia',p:'Etiópia',c:'Adis Abeba',r:'et',g:'Africa'},
  {n:'Ghana',p:'Gana',c:'Acra',r:'gh',g:'Africa'},
  {n:'Morocco',p:'Marrocos',c:'Rabat',r:'ma',g:'Africa'},
  {n:'Tanzania',p:'Tanzânia',c:'Dodoma',r:'tz',g:'Africa'},
  {n:'Angola',p:'Angola',c:'Luanda',r:'ao',g:'Africa'},
  {n:'Mozambique',p:'Moçambique',c:'Maputo',r:'mz',g:'Africa'},
  {n:'Australia',p:'Austrália',c:'Camberra',r:'au',g:'Oceania'},
  {n:'New Zealand',p:'Nova Zelândia',c:'Wellington',r:'nz',g:'Oceania'},
  {n:'Fiji',p:'Fiji',c:'Suva',r:'fj',g:'Oceania'},
  {n:'Papua New Guinea',p:'Papua Nova Guiné',c:'Port Moresby',r:'pg',g:'Oceania'},
];

function _flagUrl(cca2) {
  /* Local public-domain flag SVGs (no runtime hotlink). A missing file falls
     back to a placeholder via the image onerror handler. */
  return `data/flags/${(cca2||'').toLowerCase()}.svg`;
}

/* ══════════════════════════════════════════════════════════════════
   COUNTRIES — loaded from the local in-repo dataset (data/countries.json,
   the same file the Explorer uses). No external API; flags are local PD
   SVGs. Falls back to a small embedded set if the file is unavailable.
══════════════════════════════════════════════════════════════════ */
(function registerCountryProviders() {
  const CACHE_KEY = 'countries-v4';
  const DATA_URL = 'data/countries.json';

  async function loadCountries() {
    const cached = QuizEngine.getCache(CACHE_KEY);
    if (cached) return cached;

    try {
      const r = await _qFetch(DATA_URL, 8000);
      if (!r.ok) throw new Error('not-found');
      const data = await r.json();
      const clean = data
        .filter(c => c.capital && c.capital[0] && c.name && c.name.common)
        .map(c => ({
          name:   c.name.common,
          namePt: c.namePt || c.name.common,
          capital: c.capital[0],
          flag:   (c.flags && c.flags.svg) || _flagUrl(c.cca2),  /* local PD SVG */
          region: c.region || '',
          pop:    c.population || 0,
          cca2:   (c.cca2 || '').toLowerCase(),
        }));
      if (!clean.length) throw new Error('empty');
      QuizEngine.setCache(CACHE_KEY, clean);
      return clean;
    } catch (_) {
      return _COUNTRIES_FB.map(c => ({
        name:   c.n,
        namePt: c.p,
        capital: c.c,
        flag:   _flagUrl(c.r),
        region: c.g,
        pop:    0,
        cca2:   c.r,
      }));
    }
  }

  const REGION_PT = {
    Africa:'África', Americas:'Américas', Asia:'Ásia',
    Europe:'Europa', Oceania:'Oceânia', Antarctic:'Antárctica',
  };

  function cName(c, lang) { return lang === 'pt' ? (c.namePt || c.name) : c.name; }
  function rLabel(r, lang) { return lang === 'pt' ? (REGION_PT[r] || r) : r; }

  /* ── FLAGS ── */
  QuizEngine.register('flags', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all  = await loadCountries();
      const n    = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(all).slice(0, count || 10);
      const names = all.map(c => cName(c, lang));

      return pool.map((c, i) => {
        const correct = cName(c, lang);
        const { options, correctIdx } = QuizEngine.buildOptions(correct, names, n);
        return {
          id: `flag-${i}`,
          question: lang === 'pt' ? 'De que país é esta bandeira?' : 'Which country does this flag belong to?',
          options, correctIdx,
          explanation: lang === 'pt'
            ? `Esta é a bandeira de <strong>${correct}</strong>, situada em ${rLabel(c.region, lang)}.`
            : `This is the flag of <strong>${correct}</strong>, located in ${c.region}.`,
          image: c.flag, imageType: 'flag', difficulty: 'easy', lang,
        };
      });
    }
  });

  /* ── CAPITALS ── */
  QuizEngine.register('capitals', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all  = await loadCountries();
      const n    = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(all).slice(0, count || 10);
      const caps = all.map(c => c.capital);

      return pool.map((c, i) => {
        const cn = cName(c, lang);
        const { options, correctIdx } = QuizEngine.buildOptions(c.capital, caps, n);
        return {
          id: `cap-${i}`,
          question: lang === 'pt' ? `Qual é a capital de <strong>${cn}</strong>?` : `What is the capital of <strong>${cn}</strong>?`,
          options, correctIdx,
          explanation: lang === 'pt'
            ? `A capital de <strong>${cn}</strong> é <strong>${c.capital}</strong>.`
            : `The capital of <strong>${cn}</strong> is <strong>${c.capital}</strong>.`,
          image: c.flag, imageType: 'flag', difficulty: 'medium', lang,
        };
      });
    }
  });

  /* ── CONTINENTS ── */
  QuizEngine.register('continents', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all     = await loadCountries();
      const pool    = QuizEngine.shuffle(all).slice(0, count || 10);
      const regions = [...new Set(all.map(c => c.region))].filter(Boolean);
      const n       = Math.min(QuizEngine.optionCount(age), regions.length);

      return pool.map((c, i) => {
        const cn     = cName(c, lang);
        const label  = rLabel(c.region, lang);
        const allLbl = regions.map(r => rLabel(r, lang));
        const { options, correctIdx } = QuizEngine.buildOptions(label, allLbl, n);
        return {
          id: `cont-${i}`,
          question: lang === 'pt' ? `Em que continente fica <strong>${cn}</strong>?` : `Which continent is <strong>${cn}</strong> in?`,
          options, correctIdx,
          explanation: lang === 'pt'
            ? `<strong>${cn}</strong> está em <strong>${label}</strong>.`
            : `<strong>${cn}</strong> is in <strong>${label}</strong>.`,
          image: c.flag, imageType: 'flag', difficulty: 'easy', lang,
        };
      });
    }
  });

  /* ── POPULATION ── */
  QuizEngine.register('population', {
    async getQuestions(opts) {
      const { age, lang, count } = opts;
      const all  = await loadCountries().then(d => d.filter(c => c.pop > 1000000));
      const pool = QuizEngine.shuffle(all);
      const qs   = [];
      for (let i = 0; i < Math.min((count || 8) * 2, pool.length - 1); i += 2) {
        const a = pool[i], b = pool[i + 1];
        if (!a || !b || !a.pop || !b.pop) continue;
        const bigger  = a.pop > b.pop ? a : b;
        const an = cName(a, lang), bn = cName(b, lang);
        const correct = a.pop > b.pop ? an : bn;
        qs.push({
          id: `pop-${i}`,
          question: lang === 'pt' ? 'Qual país tem <strong>maior população</strong>?' : 'Which country has a <strong>larger population</strong>?',
          options: [an, bn],
          correctIdx: [an, bn].indexOf(correct),
          explanation: lang === 'pt'
            ? `${an}: ${a.pop.toLocaleString('pt-PT')} hab. · ${bn}: ${b.pop.toLocaleString('pt-PT')} hab.`
            : `${an}: ${a.pop.toLocaleString('en-GB')} people · ${bn}: ${b.pop.toLocaleString('en-GB')} people`,
          difficulty: 'medium', lang,
        });
        if (qs.length >= (count || 8)) break;
      }
      return qs;
    }
  });
})();


/* ══════════════════════════════════════════════════════════════════
   TRIVIA PROVIDERS — offline, served from the in-repo split database
   (quizzes/<id>/<lang>/<difficulty>.json via QuizData). No external API.
══════════════════════════════════════════════════════════════════ */
(function registerTriviaProviders() {
  /* Offline provider — serves from the in-repo split database
     (quizzes/{bankKey}/{lang}/{difficulty}.json via QuizData); no API.
     Falls back to the PT bank if a language bank is momentarily missing. */
  function makeProvider(apiCat, bankKey, diffFn) {
    return {
      async getQuestions(opts) {
        const { age, lang } = opts;
        const diff = opts.difficulty || (diffFn ? diffFn(age) : 'easy');
        if (typeof QuizData === 'undefined') return [];
        let items = await QuizData.loadBank(bankKey, diff, lang);
        if ((!items || !items.length) && lang !== 'pt') items = await QuizData.loadBank(bankKey, diff, 'pt');
        return (items && items.length) ? QuizData.buildFromBank(items, { ...opts, category: bankKey }) : [];
      }
    };
  }

  QuizEngine.register('general-knowledge', makeProvider(9,  'gk',      a => a<=9?'easy':a<=12?'medium':'hard'));
  QuizEngine.register('science',           makeProvider(17, 'science',  a => a<=9?'easy':a<=12?'medium':'hard'));
  QuizEngine.register('history',           makeProvider(23, 'history',  a => a<=10?'easy':a<=12?'medium':'hard'));
  QuizEngine.register('animals',           makeProvider(27, 'animals',  () => 'easy'));
  QuizEngine.register('sport',             makeProvider(21, 'sport',    a => a<=10?'easy':'medium'));
  QuizEngine.register('music',             makeProvider(12, 'music',    () => 'easy'));
  QuizEngine.register('vehicles',          makeProvider(28, 'vehicles', () => 'easy'));
  QuizEngine.register('mythology',         makeProvider(0,  'mitologia', a => a<=9?'easy':a<=12?'medium':'hard'));
  QuizEngine.register('leiria',            makeProvider(0,  'leiria',    a => a<=10?'easy':'medium'));
})();

/* ══════════════════════════════════════════════════════════════════
   DATA-BACKED PROVIDERS — powered by the lazy-loaded split database
   (/quizzes/{difficulty}/{category}.json via QuizData). Each provider
   loads the file for the chosen difficulty on demand, and falls back to
   a small embedded set (same item shape) so it always works offline even
   if the file is missing. New visual/symbology categories use this path.
══════════════════════════════════════════════════════════════════ */
(function registerDataProviders() {
  /* embedded fallbacks: { easy:[...], medium:[...], hard:[...] } in bank shape.
     The full content lives in the JSON files; these are a safety net only. */
  function makeDataProvider(category, embedded) {
    return {
      async getQuestions(opts) {
        const diff = opts.difficulty || 'easy';
        let items = (typeof QuizData !== 'undefined')
          ? await QuizData.loadBank(category, diff, opts.lang) : null;
        /* Image/symbol quizzes (monuments, logos, signs) are largely
           language-neutral and may not have a per-language bank yet — fall
           back to the PT bank so they still work in EN (never empty). */
        if ((!items || !items.length) && typeof QuizData !== 'undefined' && opts.lang !== 'pt') {
          items = await QuizData.loadBank(category, diff, 'pt');
        }
        if (!items || !items.length) {
          items = (embedded && (embedded[diff] || embedded.easy)) || [];
        }
        if (typeof QuizData !== 'undefined') return QuizData.buildFromBank(items, { ...opts, category });
        /* QuizData unavailable — degrade gracefully with the engine helpers */
        const pool = QuizEngine.shuffle(items).slice(0, opts.count || 10);
        return pool.map((it, i) => {
          const { options, correctIdx } = QuizEngine.buildOptions(it.a, it.opts.filter(o => o !== it.a), 4);
          const out = { id:`d-${i}`, question:it.q, options, correctIdx, explanation:it.exp||'', difficulty:diff, lang:opts.lang||'pt' };
          if (it.img) { out.image = it.img; out.imageType = it.imgType || 'svg'; }
          return out;
        });
      }
    };
  }

  /* Tiny SVG helpers for road-sign fallbacks (full set is in the JSON files). */
  const SIGN = {
    stop: `<svg viewBox="0 0 120 120" width="150" height="150"><polygon points="36,8 84,8 112,36 112,84 84,112 36,112 8,84 8,36" fill="#c1121f" stroke="#fff" stroke-width="5"/><text x="60" y="72" font-family="Arial" font-weight="bold" font-size="26" fill="#fff" text-anchor="middle">STOP</text></svg>`,
    yield: `<svg viewBox="0 0 120 120" width="150" height="150"><polygon points="60,108 6,16 114,16" fill="#fff" stroke="#c1121f" stroke-width="9"/></svg>`,
  };

  const EMB = {
    sinais: {
      easy: [
        { q:'Que sinal de trânsito é este?', a:'STOP (paragem obrigatória)', opts:['STOP (paragem obrigatória)','Cedência de passagem','Sentido proibido','Estacionamento'], exp:'O sinal octogonal vermelho obriga a parar e ceder a passagem.', img:SIGN.stop, imgType:'svg' },
        { q:'Que sinal de trânsito é este?', a:'Cedência de passagem', opts:['Cedência de passagem','STOP','Proibição de ultrapassar','Curva perigosa'], exp:'O triângulo invertido indica que deve ceder a passagem.', img:SIGN.yield, imgType:'svg' },
      ],
    },
    carros: {
      easy: [
        { q:'De que país é originária a marca BMW?', a:'Alemanha', opts:['Alemanha','Itália','Japão','EUA'], exp:'A BMW foi fundada em Munique, na Alemanha, em 1916.' },
      ],
    },
    simbolos: {
      easy: [
        { q:'Qual é o símbolo químico do oxigénio?', a:'O', opts:['O','Ox','Og','O₂'], exp:'O oxigénio é representado pela letra O na tabela periódica.' },
      ],
    },
  };

  QuizEngine.register('sinais-transito', makeDataProvider('sinais',   EMB.sinais));
  QuizEngine.register('car-brands',      makeDataProvider('carros',   EMB.carros));
  QuizEngine.register('symbols',         makeDataProvider('simbolos', EMB.simbolos));
  QuizEngine.register('geografia-pt',    makeDataProvider('geografia'));
  QuizEngine.register('ciencia-pt',      makeDataProvider('ciencia'));
  QuizEngine.register('historia-pt',     makeDataProvider('historia'));
  QuizEngine.register('portugal-quiz',   makeDataProvider('portugal'));
  /* Image-based (local-asset pipeline) + expanded text categories */
  QuizEngine.register('tech-logos',      makeDataProvider('logos-tech'));
  QuizEngine.register('car-logos',       makeDataProvider('logos-car'));
  QuizEngine.register('tecnologia-pt',   makeDataProvider('tecnologia'));
  QuizEngine.register('monumentos-img',  makeDataProvider('monumentos'));
  QuizEngine.register('f1',              makeDataProvider('f1'));
  QuizEngine.register('solar-pt',        makeDataProvider('solar'));
  QuizEngine.register('apps',            makeDataProvider('apps'));
  QuizEngine.register('flags-europa',    makeDataProvider('bandeiras-europa'));
  /* "Guess from the image" quizzes — locally generated photos, no copyright. */
  QuizEngine.register('prof-img',        makeDataProvider('prof-img'));
  QuizEngine.register('animais-img',     makeDataProvider('animais-img'));
  QuizEngine.register('planetas-img',    makeDataProvider('planetas-img'));
  QuizEngine.register('alimentos-img',   makeDataProvider('alimentos-img'));
  QuizEngine.register('orgaos-img',      makeDataProvider('orgaos-img'));
  QuizEngine.register('desporto-img',    makeDataProvider('desporto-img'));
  QuizEngine.register('mitos-img',       makeDataProvider('mitos-img'));
})();

/* ══════════════════════════════════════════════════════════════════
   MATH QUIZ  — generated locally
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('math', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a = parseInt(age) || 8;
    const n = QuizEngine.optionCount(age);
    const qs = [];

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
        if (op === '÷') { y = Math.floor(Math.random() * 9)+2; ans = Math.floor(Math.random()*12)+1; x = y*ans; }
        else { x = Math.floor(Math.random()*50)+1; y = Math.floor(Math.random()*20)+1; if (op==='-'&&y>x)[x,y]=[y,x]; ans = op==='+'?x+y:op==='-'?x-y:x*y; }
        qStr = `${x} ${op} ${y} = ?`;
      } else {
        const ops2 = ['+','-','×','÷','²'];
        op = ops2[Math.floor(Math.random()*ops2.length)];
        if (op==='²') { x=Math.floor(Math.random()*15)+2; ans=x*x; qStr=`${x}² = ?`; }
        else if (op==='÷') { y=Math.floor(Math.random()*11)+2; ans=Math.floor(Math.random()*20)+1; x=y*ans; qStr=`${x} ÷ ${y} = ?`; }
        else { x=Math.floor(Math.random()*100)+10; y=Math.floor(Math.random()*50)+5; if(op==='-'&&y>x)[x,y]=[y,x]; ans=op==='+'?x+y:op==='-'?x-y:x*y; qStr=`${x} ${op} ${y} = ?`; }
      }
      return { q: qStr, ans };
    }

    const seen = new Set();
    let att = 0;
    while (qs.length < (count||10) && att < 100) {
      att++;
      const { q, ans } = makeQ();
      if (seen.has(q)) continue;
      seen.add(q);
      const spread = Math.max(2, Math.floor(Math.abs(ans)*0.3));
      const wrongs = [];
      let t = 0;
      while (wrongs.length < n-1 && t < 30) { t++; const off=(Math.floor(Math.random()*spread)+1)*(Math.random()<.5?1:-1); const w=ans+off; if(!wrongs.includes(w)&&w!==ans)wrongs.push(w); }
      const { options, correctIdx } = QuizEngine.buildOptions(String(ans), wrongs.map(String), n);
      qs.push({ id:`math-${qs.length}`, question: lang==='pt'?`Quanto é ${q}`:`What is ${q}`, options, correctIdx, explanation:`${q.replace('?',ans)} ✓`, difficulty:a<=7?'easy':a<=10?'medium':'hard', lang });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   TIMES TABLE QUIZ
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('timestables', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a = parseInt(age)||8;
    const n = QuizEngine.optionCount(age);
    const maxTable = a<=8?5:a<=10?10:12;
    const qs = [], seen = new Set();
    let att = 0;
    while (qs.length < (count||10) && att < 100) {
      att++;
      const x = Math.floor(Math.random()*maxTable)+2;
      const y = Math.floor(Math.random()*maxTable)+1;
      const key = `${x}x${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ans = x*y;
      const wrongs = [];
      while (wrongs.length < n-1) { const w=ans+(Math.floor(Math.random()*5)+1)*(Math.random()<.5?1:-1); if(w>0&&!wrongs.includes(w)&&w!==ans)wrongs.push(w); }
      const { options, correctIdx } = QuizEngine.buildOptions(String(ans), wrongs.map(String), n);
      qs.push({ id:`tt-${qs.length}`, question:`${x} × ${y} = ?`, options, correctIdx, explanation:`${x} × ${y} = <strong>${ans}</strong>`, difficulty:x<=5?'easy':'medium', lang });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   CLOCK QUIZ
══════════════════════════════════════════════════════════════════ */
QuizEngine.register('clocks', {
  getQuestions(opts) {
    const { age, lang, count } = opts;
    const a = parseInt(age)||8;
    const n = QuizEngine.optionCount(age);
    const stepMins = a<=8?30:a<=10?15:a<=12?5:1;
    const qs = [], seen = new Set();

    function fmt(h, m) { return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }

    function clockSVG(h, m) {
      const toRad = deg => (deg-90)*Math.PI/180;
      const ma = m*6, ha = (h%12)*30+m*0.5;
      const cx=60, cy=60;
      const mx=cx+45*Math.cos(toRad(ma)), my=cy+45*Math.sin(toRad(ma));
      const hx=cx+30*Math.cos(toRad(ha)), hy=cy+30*Math.sin(toRad(ha));
      const ticks=Array.from({length:12},(_,i)=>{const a2=toRad(i*30);const x1=cx+50*Math.cos(a2),y1=cy+50*Math.sin(a2),x2=cx+55*Math.cos(a2),y2=cy+55*Math.sin(a2);return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--text2)" stroke-width="2"/>`;}).join('');
      return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:120px;height:120px"><circle cx="${cx}" cy="${cy}" r="55" fill="var(--card2)" stroke="var(--border2)" stroke-width="2"/>${ticks}<line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="var(--text)" stroke-width="4" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--accent)"/></svg>`;
    }

    let att = 0;
    while (qs.length < (count||8) && att < 60) {
      att++;
      const h = Math.floor(Math.random()*12);
      const m = Math.floor(Math.random()*(60/stepMins))*stepMins;
      const key = `${h}:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const correct = fmt(h, m);
      const wrongs = [];
      while (wrongs.length < n-1) { const wm=(m+(Math.floor(Math.random()*3)+1)*stepMins)%60; const wh=Math.floor(Math.random()*12); const w=fmt(wh,wm); if(w!==correct&&!wrongs.includes(w))wrongs.push(w); }
      const { options, correctIdx } = QuizEngine.buildOptions(correct, wrongs, n);
      qs.push({ id:`clock-${qs.length}`, question:lang==='pt'?'Que horas são?':'What time does the clock show?', options, correctIdx, explanation:lang==='pt'?`São <strong>${correct}</strong>.`:`The time is <strong>${correct}</strong>.`, image:clockSVG(h,m), imageType:'svg', difficulty:stepMins>=30?'easy':stepMins>=15?'medium':'hard', lang });
    }
    return qs;
  }
});

/* ══════════════════════════════════════════════════════════════════
   EMOJI QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const ITEMS = {
    pt:[
      ['🐘','Elefante'],['🦁','Leão'],['🐯','Tigre'],['🐻','Urso'],['🦊','Raposa'],
      ['🐺','Lobo'],['🐸','Rã'],['🐧','Pinguim'],['🦜','Papagaio'],['🦋','Borboleta'],
      ['🐙','Polvo'],['🦈','Tubarão'],['🐬','Golfinho'],['🦀','Caranguejo'],['🐢','Tartaruga'],
      ['🌸','Flor'],['🌻','Girassol'],['🌵','Cacto'],['🌴','Palmeira'],['🍀','Trevo'],
      ['🍎','Maçã'],['🍌','Banana'],['🍓','Morango'],['🍇','Uva'],['🍊','Laranja'],
      ['🍕','Pizza'],['🍔','Hambúrguer'],['🍦','Gelado'],['🎂','Bolo'],['🍩','Rosca'],
      ['🚀','Foguetão'],['✈️','Avião'],['🚂','Comboio'],['🚢','Navio'],['🚁','Helicóptero'],
      ['⚽','Bola de futebol'],['🏀','Basquetebol'],['🎸','Guitarra'],['🎹','Piano'],['🎺','Trompete'],
    ],
    en:[
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
      const n = QuizEngine.optionCount(age);
      const d = ITEMS[lang] || ITEMS.pt;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      const all  = d.map(x => x[1]);
      return pool.map(([emoji, name], i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(name, all, n);
        return { id:`emoji-${i}`, question:lang==='pt'?'O que representa este emoji?':'What does this emoji represent?', options, correctIdx, explanation:lang==='pt'?`${emoji} é um(a) <strong>${name}</strong>.`:`${emoji} is a <strong>${name}</strong>.`, image:`<div style="font-size:4rem;text-align:center;line-height:1.2">${emoji}</div>`, imageType:'svg', difficulty:'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   SPACE QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {q:'Qual é o planeta mais próximo do Sol?',a:'Mercúrio',opts:['Vénus','Terra','Mercúrio','Marte'],exp:'Mercúrio é o primeiro planeta do Sistema Solar.'},
      {q:'Qual é o maior planeta do Sistema Solar?',a:'Júpiter',opts:['Saturno','Neptuno','Júpiter','Urano'],exp:'Júpiter tem mais de 1 300 Terras de volume.'},
      {q:'Quantas luas tem a Terra?',a:'1',opts:['0','1','2','3'],exp:'A lua da Terra chama-se simplesmente Lua.'},
      {q:'Qual planeta tem os anéis mais visíveis?',a:'Saturno',opts:['Júpiter','Urano','Neptuno','Saturno'],exp:'Os anéis de Saturno são compostos por gelo e rocha.'},
      {q:'Qual é o planeta mais quente?',a:'Vénus',opts:['Mercúrio','Vénus','Marte','Júpiter'],exp:'Vénus é mais quente que Mercúrio por causa do efeito de estufa.'},
      {q:'Qual é o planeta vermelho?',a:'Marte',opts:['Mercúrio','Vénus','Marte','Júpiter'],exp:'Marte tem cor avermelhada por causa do óxido de ferro na sua superfície.'},
      {q:'Quantos planetas tem o Sistema Solar?',a:'8',opts:['6','7','8','9'],exp:'Os 8 planetas: Mercúrio, Vénus, Terra, Marte, Júpiter, Saturno, Urano e Neptuno.'},
      {q:'O que é um ano-luz?',a:'A distância que a luz percorre em 1 ano',opts:['Um tipo de estrela','A distância que a luz percorre em 1 ano','O tempo que a luz sai do Sol','A velocidade de um foguetão'],exp:'1 ano-luz ≈ 9,46 biliões de km.'},
      {q:'Qual estrela aquece a Terra?',a:'O Sol',opts:['A Lua','O Sol','Sírius','Alfa Centauri'],exp:'O Sol é uma estrela do tipo anã amarela.'},
      {q:'O que é uma galáxia?',a:'Um enorme conjunto de estrelas',opts:['Um planeta gigante','Um enorme conjunto de estrelas','Uma nuvem de gás','Um buraco negro'],exp:'A Via Láctea é a nossa galáxia e contém mais de 200 mil milhões de estrelas.'},
      {q:'Qual é o planeta mais longe do Sol?',a:'Neptuno',opts:['Saturno','Urano','Plutão','Neptuno'],exp:'Neptuno é o oitavo e mais distante planeta do Sistema Solar.'},
      {q:'O que orbita em torno da Terra?',a:'A Lua',opts:['O Sol','Marte','A Lua','Vénus'],exp:'A Lua demora cerca de 27 dias a dar uma volta completa à Terra.'},
    ],
    en:[
      {q:'Which planet is closest to the Sun?',a:'Mercury',opts:['Venus','Earth','Mercury','Mars'],exp:'Mercury is the first planet of the Solar System.'},
      {q:'Which is the largest planet?',a:'Jupiter',opts:['Saturn','Neptune','Jupiter','Uranus'],exp:'Jupiter could fit over 1,300 Earths inside it.'},
      {q:'How many moons does Earth have?',a:'1',opts:['0','1','2','3'],exp:"Earth's moon is simply called the Moon."},
      {q:'Which planet has the most visible rings?',a:'Saturn',opts:['Jupiter','Uranus','Neptune','Saturn'],exp:"Saturn's rings are made of ice and rock."},
      {q:'Which is the hottest planet?',a:'Venus',opts:['Mercury','Venus','Mars','Jupiter'],exp:'Venus is hotter than Mercury due to the greenhouse effect.'},
      {q:'Which planet is called the Red Planet?',a:'Mars',opts:['Mercury','Venus','Mars','Jupiter'],exp:'Mars appears red due to iron oxide on its surface.'},
      {q:'How many planets are in the Solar System?',a:'8',opts:['6','7','8','9'],exp:'The 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.'},
      {q:'What is a light-year?',a:'The distance light travels in one year',opts:['A type of star','The distance light travels in one year','Time for light to leave the Sun','The speed of a rocket'],exp:'1 light-year ≈ 9.46 trillion km.'},
      {q:'Which star warms the Earth?',a:'The Sun',opts:['The Moon','The Sun','Sirius','Alpha Centauri'],exp:'The Sun is a yellow dwarf star.'},
      {q:'What is a galaxy?',a:'A massive collection of stars',opts:['A giant planet','A massive collection of stars','A cloud of gas','A black hole'],exp:'The Milky Way is our galaxy and contains over 200 billion stars.'},
      {q:'Which is the furthest planet from the Sun?',a:'Neptune',opts:['Saturn','Uranus','Pluto','Neptune'],exp:'Neptune is the eighth and most distant planet in the Solar System.'},
      {q:'What orbits the Earth?',a:'The Moon',opts:['The Sun','Mars','The Moon','Venus'],exp:'The Moon takes about 27 days to complete one orbit of Earth.'},
    ]
  };
  QuizEngine.register('space', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n  = QuizEngine.optionCount(age);
      const d  = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`space-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:age<=10?'easy':'medium', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   HUMAN BODY QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {q:'Qual é o osso mais longo do corpo?',a:'Fémur',opts:['Tíbia','Fémur','Rádio','Húmero'],exp:'O fémur é o osso da coxa.'},
      {q:'Quantos dentes tem um adulto?',a:'32',opts:['28','30','32','36'],exp:'Os adultos têm 32 dentes, incluindo os sisos.'},
      {q:'Qual órgão bombeia o sangue?',a:'Coração',opts:['Pulmão','Coração','Fígado','Rim'],exp:'O coração bombeia cerca de 5 litros de sangue por minuto.'},
      {q:'Onde se produz a bílis?',a:'Fígado',opts:['Estômago','Fígado','Rim','Pâncreas'],exp:'A bílis é produzida no fígado e armazenada na vesícula biliar.'},
      {q:'Qual é o maior órgão do corpo humano?',a:'Pele',opts:['Fígado','Pulmão','Pele','Intestino'],exp:'A pele é o maior órgão e cobre todo o corpo.'},
      {q:'Quantos ossos tem um adulto?',a:'206',opts:['106','206','306','406'],exp:'Os adultos têm 206 ossos. Os bebés nascem com cerca de 270.'},
      {q:'Qual sentido usa os olhos?',a:'Visão',opts:['Audição','Visão','Olfacto','Tacto'],exp:'Os olhos captam luz e enviam sinais ao cérebro.'},
      {q:'Qual órgão filtra o sangue e produz urina?',a:'Rim',opts:['Coração','Pulmão','Fígado','Rim'],exp:'Os rins filtram cerca de 180 litros de sangue por dia.'},
      {q:'O que transporta oxigénio no sangue?',a:'Glóbulos vermelhos',opts:['Plasma','Glóbulos brancos','Plaquetas','Glóbulos vermelhos'],exp:'Os glóbulos vermelhos contêm hemoglobina que transporta oxigénio.'},
      {q:'Qual parte do olho controla a pupila?',a:'Íris',opts:['Córnea','Retina','Íris','Cristalino'],exp:'A íris é a parte colorida do olho que ajusta o tamanho da pupila.'},
      {q:'Quantos pulmões tem o ser humano?',a:'2',opts:['1','2','3','4'],exp:'O ser humano tem 2 pulmões — o direito é ligeiramente maior que o esquerdo.'},
      {q:'Que órgão controla todos os outros?',a:'Cérebro',opts:['Coração','Fígado','Cérebro','Estômago'],exp:'O cérebro é o órgão central do sistema nervoso e controla todo o corpo.'},
    ],
    en:[
      {q:'Which is the longest bone in the body?',a:'Femur',opts:['Tibia','Femur','Radius','Humerus'],exp:'The femur is the thigh bone.'},
      {q:'How many teeth does an adult have?',a:'32',opts:['28','30','32','36'],exp:'Adults have 32 teeth, including wisdom teeth.'},
      {q:'Which organ pumps blood?',a:'Heart',opts:['Lung','Heart','Liver','Kidney'],exp:'The heart pumps about 5 litres of blood per minute.'},
      {q:'Where is bile produced?',a:'Liver',opts:['Stomach','Liver','Kidney','Pancreas'],exp:'Bile is made in the liver and stored in the gallbladder.'},
      {q:'Which is the largest organ in the human body?',a:'Skin',opts:['Liver','Lung','Skin','Intestine'],exp:'Skin is the largest organ and covers the whole body.'},
      {q:'How many bones does an adult have?',a:'206',opts:['106','206','306','406'],exp:'Adults have 206 bones. Babies are born with about 270.'},
      {q:'Which sense uses the eyes?',a:'Sight',opts:['Hearing','Sight','Smell','Touch'],exp:'The eyes capture light and send signals to the brain.'},
      {q:'Which organ filters blood and makes urine?',a:'Kidney',opts:['Heart','Lung','Liver','Kidney'],exp:'Kidneys filter about 180 litres of blood per day.'},
      {q:'What carries oxygen in the blood?',a:'Red blood cells',opts:['Plasma','White blood cells','Platelets','Red blood cells'],exp:'Red blood cells contain haemoglobin which carries oxygen.'},
      {q:'Which part of the eye controls the pupil?',a:'Iris',opts:['Cornea','Retina','Iris','Lens'],exp:'The iris is the coloured part of the eye that adjusts pupil size.'},
      {q:'How many lungs does a human have?',a:'2',opts:['1','2','3','4'],exp:'Humans have 2 lungs — the right is slightly larger than the left.'},
      {q:'Which organ controls all others?',a:'Brain',opts:['Heart','Liver','Brain','Stomach'],exp:'The brain is the central organ of the nervous system.'},
    ]
  };
  QuizEngine.register('body', {
    async getQuestions(opts) {
      const { lang, count } = opts;
      const diff = opts.difficulty || 'easy';
      /* Prefer the in-repo split database (quizzes/body/<lang>/<diff>.json);
         the embedded DATA below is only an offline safety net. */
      if (typeof QuizData !== 'undefined') {
        const items = await QuizData.loadBank('body', diff, lang);
        if (items && items.length) return QuizData.buildFromBank(items, { ...opts, category: 'body' });
      }
      const n = QuizEngine.optionCount();
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count || 10);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`body-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:diff, lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   FAMOUS MONUMENTS QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {name:'Torre Eiffel',country:'França',fact:'Construída em 1889 para a Exposição Universal de Paris.'},
      {name:'Coliseu de Roma',country:'Itália',fact:'Arena romana que chegou a ter 80 000 espectadores.'},
      {name:'Muralha da China',country:'China',fact:'Tem mais de 21 000 km de comprimento.'},
      {name:'Machu Picchu',country:'Peru',fact:'Cidade inca construída no século XV a 2 430 m de altitude.'},
      {name:'Taj Mahal',country:'Índia',fact:'Mausoléu construído pelo imperador Shah Jahan em memória da sua esposa.'},
      {name:'Cristo Redentor',country:'Brasil',fact:'Estátua de 30 metros no cume do Corcovado no Rio de Janeiro.'},
      {name:'Acrópole de Atenas',country:'Grécia',fact:'Complexo de templos do século V a.C., inclui o Pártenon.'},
      {name:'Pirâmides de Gizé',country:'Egipto',fact:'As maiores pirâmides do mundo, construídas há 4 500 anos.'},
      {name:'Palácio de Versalhes',country:'França',fact:'Palácio barroco que foi residência dos reis de França.'},
      {name:'Torre de Belém',country:'Portugal',fact:'Monumento manuelino do século XVI em Lisboa.'},
      {name:'Mosteiro dos Jerónimos',country:'Portugal',fact:'Património Mundial da UNESCO, estilo manuelino, em Lisboa.'},
      {name:'Stonehenge',country:'Reino Unido',fact:'Monumento pré-histórico de pedras gigantes no sul de Inglaterra.'},
    ],
    en:[
      {name:'Eiffel Tower',country:'France',fact:'Built in 1889 for the Paris World Fair.'},
      {name:'Colosseum',country:'Italy',fact:'Roman arena that once held 80,000 spectators.'},
      {name:'Great Wall of China',country:'China',fact:'Over 21,000 km long.'},
      {name:'Machu Picchu',country:'Peru',fact:'15th-century Inca city built at 2,430 m altitude.'},
      {name:'Taj Mahal',country:'India',fact:'Mausoleum built by Emperor Shah Jahan for his wife.'},
      {name:'Christ the Redeemer',country:'Brazil',fact:'30-metre statue on Corcovado hill in Rio de Janeiro.'},
      {name:'Acropolis of Athens',country:'Greece',fact:'5th century BC temple complex including the Parthenon.'},
      {name:'Pyramids of Giza',country:'Egypt',fact:"The world's largest pyramids, built 4,500 years ago."},
      {name:'Palace of Versailles',country:'France',fact:'Baroque palace that was home to the French kings.'},
      {name:'Tower of Belém',country:'Portugal',fact:'Manueline tower built in the 16th century in Lisbon.'},
      {name:'Jerónimos Monastery',country:'Portugal',fact:'UNESCO World Heritage Manueline monastery in Lisbon.'},
      {name:'Stonehenge',country:'United Kingdom',fact:'Prehistoric monument of giant stones in southern England.'},
    ]
  };
  QuizEngine.register('monuments', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n = QuizEngine.optionCount(age);
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      const countries = d.map(x => x.country);
      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.country, countries, n);
        return { id:`mon-${i}`, question:lang==='pt'?`Em que país fica <strong>${item.name}</strong>?`:`In which country is <strong>${item.name}</strong>?`, options, correctIdx, explanation:item.fact, difficulty:age<=10?'easy':'medium', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   PROFESSIONS QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {e:'👨‍⚕️',n:'Médico',c:'Trata doenças e cuida da saúde das pessoas.'},
      {e:'👨‍🏫',n:'Professor',c:'Ensina alunos na escola ou universidade.'},
      {e:'👨‍🚒',n:'Bombeiro',c:'Combate incêndios e salva vidas em emergências.'},
      {e:'👮',n:'Polícia',c:'Garante a segurança e a ordem pública.'},
      {e:'👨‍🍳',n:'Cozinheiro',c:'Prepara e cozinha alimentos.'},
      {e:'👨‍✈️',n:'Piloto',c:'Pilota aviões e transporte aéreo.'},
      {e:'👨‍🔧',n:'Mecânico',c:'Repara e mantém veículos e máquinas.'},
      {e:'👨‍⚖️',n:'Advogado',c:'Representa clientes em questões legais.'},
      {e:'👨‍🎨',n:'Artista',c:'Cria obras de arte, pinturas e esculturas.'},
      {e:'👩‍🚀',n:'Astronauta',c:'Viaja para o espaço e realiza missões espaciais.'},
      {e:'👩‍💻',n:'Programador',c:'Escreve código e desenvolve software.'},
      {e:'👨‍🌾',n:'Agricultor',c:'Cultiva plantas e cria animais para alimentação.'},
    ],
    en:[
      {e:'👨‍⚕️',n:'Doctor',c:"Treats illness and looks after people's health."},
      {e:'👨‍🏫',n:'Teacher',c:'Teaches students at school or university.'},
      {e:'👨‍🚒',n:'Firefighter',c:'Fights fires and saves lives in emergencies.'},
      {e:'👮',n:'Police officer',c:'Maintains safety and public order.'},
      {e:'👨‍🍳',n:'Chef',c:'Prepares and cooks food.'},
      {e:'👨‍✈️',n:'Pilot',c:'Flies aeroplanes and aircraft.'},
      {e:'👨‍🔧',n:'Mechanic',c:'Repairs and maintains vehicles and machines.'},
      {e:'👨‍⚖️',n:'Lawyer',c:'Represents clients in legal matters.'},
      {e:'👨‍🎨',n:'Artist',c:'Creates paintings, sculptures and artwork.'},
      {e:'👩‍🚀',n:'Astronaut',c:'Travels to space and carries out space missions.'},
      {e:'👩‍💻',n:'Programmer',c:'Writes code and develops software.'},
      {e:'👨‍🌾',n:'Farmer',c:'Grows crops and raises animals for food.'},
    ]
  };
  QuizEngine.register('professions', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n = QuizEngine.optionCount(age);
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      const all = d.map(x => x.n);
      const q = lang==='pt'?'Que profissão é esta?':'What is this profession?';
      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.n, all, n);
        return { id:`prof-${i}`, question:q, options, correctIdx, explanation:item.c, image:`<div style="font-size:4rem;text-align:center;line-height:1.3">${item.e}</div>`, imageType:'svg', difficulty:'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   COLOURS QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const C = {
    pt:[{h:'#ef4444',n:'Vermelho'},{h:'#3b82f6',n:'Azul'},{h:'#22c55e',n:'Verde'},{h:'#eab308',n:'Amarelo'},{h:'#a855f7',n:'Roxo'},{h:'#f97316',n:'Laranja'},{h:'#ec4899',n:'Rosa'},{h:'#14b8a6',n:'Ciano'},{h:'#f8fafc',n:'Branco'},{h:'#1e293b',n:'Preto'},{h:'#78716c',n:'Cinzento'},{h:'#92400e',n:'Castanho'}],
    en:[{h:'#ef4444',n:'Red'},{h:'#3b82f6',n:'Blue'},{h:'#22c55e',n:'Green'},{h:'#eab308',n:'Yellow'},{h:'#a855f7',n:'Purple'},{h:'#f97316',n:'Orange'},{h:'#ec4899',n:'Pink'},{h:'#14b8a6',n:'Cyan'},{h:'#f8fafc',n:'White'},{h:'#1e293b',n:'Black'},{h:'#78716c',n:'Grey'},{h:'#92400e',n:'Brown'}]
  };
  QuizEngine.register('colours', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n = QuizEngine.optionCount(age);
      const d = C[lang] || C.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      const all = d.map(x => x.n);
      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.n, all, n);
        return { id:`col-${i}`, question:lang==='pt'?'Que cor é esta?':'What colour is this?', options, correctIdx, explanation:lang==='pt'?`Esta cor é <strong>${item.n}</strong>.`:`This colour is <strong>${item.n}</strong>.`, image:`<div style="width:80px;height:80px;border-radius:50%;background:${item.h};margin:0 auto;border:3px solid var(--border2)"></div>`, imageType:'svg', difficulty:'easy', lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   TECHNOLOGY QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {q:'O que significa "CPU"?',a:'Unidade Central de Processamento',opts:['Central Power Unit','Unidade Central de Processamento','Computer Processing Unit','Central Program Utility'],exp:'A CPU é o "cérebro" do computador que executa instruções.'},
      {q:'O que é a internet?',a:'Uma rede global de computadores ligados entre si',opts:['Um programa de e-mail','Uma rede global de computadores ligados entre si','Um sistema operativo','Um tipo de processador'],exp:'A internet liga biliões de dispositivos em todo o mundo.'},
      {q:'Qual destes é um sistema operativo?',a:'Windows',opts:['Google Chrome','Word','Windows','Photoshop'],exp:'Windows é o sistema operativo mais usado em computadores pessoais.'},
      {q:'O que faz um antivírus?',a:'Protege o computador de software malicioso',opts:['Acelera o computador','Protege o computador de software malicioso','Liga à internet','Grava vídeos'],exp:'O antivírus detecta e remove vírus e outros programas maliciosos.'},
      {q:'O que é um "byte"?',a:'Uma unidade de informação digital',opts:['Um tipo de processador','Uma unidade de informação digital','Um cabo de dados','Um programa informático'],exp:'1 byte = 8 bits. É a unidade básica de armazenamento digital.'},
      {q:'O que é inteligência artificial?',a:'Sistemas que simulam inteligência humana',opts:['Robôs que substituem humanos','Sistemas que simulam inteligência humana','Uma nova linguagem de programação','Computadores super-rápidos'],exp:'A IA permite que as máquinas aprendam e tomem decisões.'},
      {q:'O que é uma "password"?',a:'Uma palavra-chave para proteger o acesso',opts:['Um tipo de vírus','Uma palavra-chave para proteger o acesso','Um endereço de e-mail','Um ficheiro de imagem'],exp:'Usa sempre passwords fortes com letras, números e símbolos.'},
      {q:'Quantos bits tem 1 byte?',a:'8',opts:['4','8','16','32'],exp:'1 byte = 8 bits. Esta é a unidade base do armazenamento digital.'},
      {q:'O que é Wi-Fi?',a:'Tecnologia de rede sem fios',opts:['Um tipo de cabo','Tecnologia de rede sem fios','Um programa de segurança','Uma marca de computadores'],exp:'Wi-Fi permite ligar dispositivos à internet sem cabos.'},
      {q:'O que é um URL?',a:'O endereço de uma página na internet',opts:['Um tipo de vírus','O endereço de uma página na internet','Um programa de e-mail','Um ficheiro de vídeo'],exp:'URL significa "Uniform Resource Locator" — é o endereço web que escreves no browser.'},
    ],
    en:[
      {q:'What does "CPU" stand for?',a:'Central Processing Unit',opts:['Central Power Unit','Central Processing Unit','Computer Processing Unit','Central Program Utility'],exp:'The CPU is the "brain" of the computer that executes instructions.'},
      {q:'What is the internet?',a:'A global network of connected computers',opts:['An email program','A global network of connected computers','An operating system','A type of processor'],exp:'The internet connects billions of devices worldwide.'},
      {q:'Which of these is an operating system?',a:'Windows',opts:['Google Chrome','Word','Windows','Photoshop'],exp:'Windows is the most widely used operating system on personal computers.'},
      {q:'What does antivirus software do?',a:'Protects computers from malicious software',opts:['Speeds up the computer','Protects computers from malicious software','Connects to the internet','Records videos'],exp:'Antivirus detects and removes viruses and other malicious programs.'},
      {q:'What is a "byte"?',a:'A unit of digital information',opts:['A type of processor','A unit of digital information','A data cable','A computer program'],exp:'1 byte = 8 bits. It is the basic unit of digital storage.'},
      {q:'What is artificial intelligence?',a:'Systems that simulate human intelligence',opts:['Robots that replace humans','Systems that simulate human intelligence','A new programming language','Very fast computers'],exp:'AI allows machines to learn and make decisions.'},
      {q:'What is a "password"?',a:'A secret word or phrase to protect access',opts:['A type of virus','A secret word or phrase to protect access','An email address','An image file'],exp:'Always use strong passwords with letters, numbers and symbols.'},
      {q:'How many bits are in 1 byte?',a:'8',opts:['4','8','16','32'],exp:'1 byte = 8 bits. This is the base unit of digital storage.'},
      {q:'What does Wi-Fi enable?',a:'Wireless internet connectivity',opts:['Wired connections only','Wireless internet connectivity','Faster hard drives','Better graphics'],exp:'Wi-Fi allows devices to connect to the internet without cables.'},
      {q:'What is a URL?',a:'The address of a web page',opts:['A type of virus','The address of a web page','An email program','A video file'],exp:'URL stands for "Uniform Resource Locator" — it\'s the web address you type in a browser.'},
    ]
  };
  QuizEngine.register('technology', {
    async getQuestions(opts) {
      const { lang, count } = opts;
      const diff = opts.difficulty || 'easy';
      /* Shares the rich in-repo Technology bank (quizzes/tecnologia/<lang>/...);
         the embedded DATA below is only an offline safety net. */
      if (typeof QuizData !== 'undefined') {
        const items = await QuizData.loadBank('tecnologia', diff, lang);
        if (items && items.length) return QuizData.buildFromBank(items, { ...opts, category: 'tecnologia' });
      }
      const n = QuizEngine.optionCount();
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`tech-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:diff, lang };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   SPELLING / LANGUAGE QUIZZES
══════════════════════════════════════════════════════════════════ */
(function() {
  const ORTHO_PT = [
    {q:'Qual a escrita correcta?',opts:['desenvolvmento','desenvolvimento','desenvolivmento','desenvolvimeto'],a:'desenvolvimento',exp:'"Desenvolvimento" — não te esqueças dos dois "e".'},
    {q:'Qual a escrita correcta?',opts:['necessário','nessessário','necesário','nescesário'],a:'necessário',exp:'"Necessário" — escreve-se com dois "s".'},
    {q:'Qual a escrita correcta?',opts:['definitivamente','definitvamente','difintivamente','definitivamente'],a:'definitivamente',exp:'"Definitivamente" — vem de "definitivo".'},
    {q:'Qual a escrita correcta?',opts:['excelente','ecxelente','exelente','excelente'],a:'excelente',exp:'"Excelente" — "xc" seguido de "e".'},
    {q:'Qual é o sinónimo de "feliz"?',opts:['triste','alegre','cansado','irritado'],a:'alegre',exp:'"Alegre" é sinónimo de "feliz".'},
    {q:'Qual é o sinónimo de "rápido"?',opts:['lento','veloz','demorado','pesado'],a:'veloz',exp:'"Veloz" é sinónimo de "rápido".'},
    {q:'Qual é o antónimo de "pequeno"?',opts:['médio','igual','grande','largo'],a:'grande',exp:'O antónimo (contrário) de "pequeno" é "grande".'},
    {q:'Qual é o antónimo de "fácil"?',opts:['simples','rápido','difícil','curto'],a:'difícil',exp:'O antónimo de "fácil" é "difícil".'},
    {q:'Qual é o plural de "pão"?',opts:['pãos','pões','pães','pans'],a:'pães',exp:'O plural de "pão" é "pães" — excepção à regra geral.'},
    {q:'Qual é o plural de "mão"?',opts:['mãos','mões','mães','mans'],a:'mãos',exp:'O plural de "mão" é "mãos".'},
    {q:'Completa: "Ele ___ para a escola."',opts:['vai','vou','vamos','vão'],a:'vai',exp:'"Ele vai" — 3ª pessoa do singular do verbo "ir".'},
    {q:'Qual é o plural de "leão"?',opts:['leões','leãos','leons','leão'],a:'leões',exp:'O plural de "leão" é "leões".'},
  ];
  const VOCAB_EN = [
    {q:'What is the synonym of "happy"?',opts:['sad','joyful','tired','angry'],a:'joyful',exp:'"Joyful" means feeling great happiness.'},
    {q:'What is the antonym of "small"?',opts:['tiny','medium','large','narrow'],a:'large',exp:'The antonym (opposite) of "small" is "large".'},
    {q:'What is the antonym of "fast"?',opts:['quick','slow','bright','hard'],a:'slow',exp:'The opposite of "fast" is "slow".'},
    {q:'What is the plural of "child"?',opts:['childs','childes','children','childer'],a:'children',exp:'"Children" is an irregular plural.'},
    {q:'What is the plural of "tooth"?',opts:['tooths','teeths','toothes','teeth'],a:'teeth',exp:'"Teeth" is an irregular plural.'},
    {q:'Complete: "She ___ to school."',opts:['go','goes','going','gone'],a:'goes',exp:'"She goes" — 3rd person singular of "to go".'},
    {q:'What is the synonym of "begin"?',opts:['end','start','stop','pause'],a:'start',exp:'"Start" and "begin" mean the same thing.'},
    {q:'What is the antonym of "day"?',opts:['morning','evening','night','afternoon'],a:'night',exp:'The opposite of "day" is "night".'},
    {q:'What is the plural of "mouse"?',opts:['mouses','mices','mouse','mice'],a:'mice',exp:'"Mice" is the irregular plural of "mouse".'},
    {q:'Complete: "They ___ playing football."',opts:['is','am','are','be'],a:'are',exp:'"They are" — 3rd person plural of "to be".'},
  ];

  QuizEngine.register('spelling-pt', {
    getQuestions(opts) {
      const { age, count } = opts;
      const n = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(ORTHO_PT).slice(0, count||10);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`spell-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:age<=10?'easy':'medium', lang:'pt' };
      });
    }
  });

  QuizEngine.register('vocabulary-en', {
    getQuestions(opts) {
      const { age, count } = opts;
      const n = QuizEngine.optionCount(age);
      const pool = QuizEngine.shuffle(VOCAB_EN).slice(0, count||8);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`vocab-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:age<=10?'easy':'medium', lang:'en' };
      });
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   FOOD QUIZ
══════════════════════════════════════════════════════════════════ */
(function() {
  const DATA = {
    pt:[
      {e:'🍎',n:'Maçã',g:'fruta'},{e:'🍌',n:'Banana',g:'fruta'},{e:'🍊',n:'Laranja',g:'fruta'},
      {e:'🍇',n:'Uva',g:'fruta'},{e:'🍓',n:'Morango',g:'fruta'},{e:'🍑',n:'Pêssego',g:'fruta'},
      {e:'🥝',n:'Kiwi',g:'fruta'},{e:'🍍',n:'Ananás',g:'fruta'},{e:'🫐',n:'Mirtilo',g:'fruta'},
      {e:'🥕',n:'Cenoura',g:'legume'},{e:'🥦',n:'Brócolos',g:'legume'},{e:'🧅',n:'Cebola',g:'legume'},
      {e:'🍆',n:'Beringela',g:'legume'},{e:'🥔',n:'Batata',g:'legume'},{e:'🍅',n:'Tomate',g:'fruta'},
    ],
    en:[
      {e:'🍎',n:'Apple',g:'fruit'},{e:'🍌',n:'Banana',g:'fruit'},{e:'🍊',n:'Orange',g:'fruit'},
      {e:'🍇',n:'Grapes',g:'fruit'},{e:'🍓',n:'Strawberry',g:'fruit'},{e:'🍑',n:'Peach',g:'fruit'},
      {e:'🥝',n:'Kiwi',g:'fruit'},{e:'🍍',n:'Pineapple',g:'fruit'},{e:'🫐',n:'Blueberry',g:'fruit'},
      {e:'🥕',n:'Carrot',g:'vegetable'},{e:'🥦',n:'Broccoli',g:'vegetable'},{e:'🧅',n:'Onion',g:'vegetable'},
      {e:'🍆',n:'Aubergine',g:'vegetable'},{e:'🥔',n:'Potato',g:'vegetable'},{e:'🍅',n:'Tomato',g:'fruit'},
    ]
  };
  QuizEngine.register('food', {
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n = QuizEngine.optionCount(age);
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      const all = d.map(x => x.n);
      return pool.map((item, i) => {
        const { options, correctIdx } = QuizEngine.buildOptions(item.n, all, n);
        return { id:`food-${i}`, question:lang==='pt'?'O que é isto?':'What is this?', options, correctIdx, explanation:lang==='pt'?`Isto é um(a) <strong>${item.n}</strong> (${item.g}).`:`This is a <strong>${item.n}</strong> (${item.g}).`, image:`<div style="font-size:4.5rem;text-align:center;line-height:1.2">${item.e}</div>`, imageType:'svg', difficulty:'easy', lang };
      });
    }
  });
})();
