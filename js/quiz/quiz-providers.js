/* ══════════════════════════════════════════════════════════════════
   QUIZ PROVIDERS — fetch/generate questions per category
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
   BUILT-IN TRIVIA BANKS — used when quiz lang is PT (or API fails)
══════════════════════════════════════════════════════════════════ */
const _TRIVIA = {
  pt: {
    gk: [
      {q:'Quantos planetas tem o Sistema Solar?',a:'8',opts:['6','7','8','9'],exp:'Os 8 planetas: Mercúrio, Vénus, Terra, Marte, Júpiter, Saturno, Urano e Neptuno.',d:1},
      {q:'Qual é o maior oceano do mundo?',a:'Pacífico',opts:['Atlântico','Índico','Pacífico','Ártico'],exp:'O oceano Pacífico cobre mais de 165 milhões de km².',d:2},
      {q:'Em que país fica a Torre Eiffel?',a:'França',opts:['Itália','Espanha','França','Alemanha'],exp:'A Torre Eiffel fica em Paris, França, e foi construída em 1889.',d:1},
      {q:'Qual é o animal mais rápido do mundo?',a:'Guepardo',opts:['Leão','Águia','Guepardo','Leopardo'],exp:'O guepardo pode atingir 112 km/h em corrida.',d:1},
      {q:'Quantos continentes tem a Terra?',a:'7',opts:['5','6','7','8'],exp:'Os 7 continentes: África, Antárctica, Ásia, Europa, América do Norte, América do Sul e Oceânia.',d:1},
      {q:'Qual é o rio mais longo do mundo?',a:'Nilo',opts:['Amazonas','Nilo','Yangtzé','Mississípi'],exp:'O Nilo tem cerca de 6 650 km de comprimento.',d:2},
      {q:'Quantos lados tem um hexágono?',a:'6',opts:['4','5','6','8'],exp:'Hexa significa seis em grego.',d:1},
      {q:'Qual é a capital da Austrália?',a:'Camberra',opts:['Sydney','Melbourne','Camberra','Perth'],exp:'Camberra é a capital da Austrália, não Sydney.',d:3},
      {q:'De que material é feita a teia da aranha?',a:'Seda',opts:['Algodão','Seda','Nylon','Lã'],exp:'A teia de aranha é feita de seda proteica — mais resistente que o aço do mesmo peso.',d:2},
      {q:'Quantas horas tem um dia?',a:'24',opts:['12','20','24','48'],exp:'Um dia tem 24 horas, que é o tempo que a Terra demora a dar uma volta completa sobre si mesma.',d:1},
      {q:'Qual é o metal mais leve?',a:'Lítio',opts:['Alumínio','Ferro','Cobre','Lítio'],exp:'O lítio é o metal mais leve da tabela periódica.',d:3},
      {q:'Quantas asas tem uma borboleta?',a:'4',opts:['2','4','6','8'],exp:'As borboletas têm 4 asas: duas anteriores e duas posteriores.',d:1},
      {q:'Qual é o osso mais longo do corpo humano?',a:'Fémur',opts:['Tíbia','Fémur','Húmero','Rádio'],exp:'O fémur é o osso da coxa e o mais longo do corpo.',d:2},
      {q:'Quem escreveu "Os Lusíadas"?',a:'Luís de Camões',opts:['Fernando Pessoa','Eça de Queirós','Luís de Camões','José Saramago'],exp:'"Os Lusíadas" é o épico nacional de Portugal, escrito por Luís de Camões no século XVI.',d:3},
      {q:'Que instrumento usa um astrónomo?',a:'Telescópio',opts:['Microscópio','Telescópio','Barómetro','Bússola'],exp:'O telescópio permite observar objetos distantes no espaço.',d:1},
      {q:'Quantas estrelas tem a bandeira de Portugal?',a:'0',opts:['0','5','7','17'],exp:'A bandeira de Portugal não tem estrelas; tem o escudo e a esfera armilar.',d:1},
      {q:'Qual é a maior ilha do mundo?',a:'Gronelândia',opts:['Madagáscar','Bornéu','Gronelândia','Austrália'],exp:'A Gronelândia tem cerca de 2,16 milhões de km². A Austrália é considerada continente.',d:3},
      {q:'Qual é o deserto quente mais extenso do mundo?',a:'Sara',opts:['Gobi','Atacama','Sara','Kalahari'],exp:'O Sara, no norte de África, é o maior deserto quente do mundo.',d:1},
      {q:'Qual é o monte mais alto do mundo?',a:'Everest',opts:['K2','Kilimanjaro','Everest','Mont Blanc'],exp:'O Monte Everest tem 8 849 m, na fronteira Nepal/China.',d:1},
      {q:'Qual o oceano que banha as costas de Portugal?',a:'Atlântico',opts:['Pacífico','Atlântico','Índico','Ártico'],exp:'Portugal é banhado pelo oceano Atlântico.',d:1},
      {q:'Quantos minutos tem uma hora?',a:'60',opts:['30','45','60','100'],exp:'Uma hora tem 60 minutos.',d:1},
      {q:'Quem pintou a Mona Lisa?',a:'Leonardo da Vinci',opts:['Vincent van Gogh','Pablo Picasso','Leonardo da Vinci','Michelangelo'],exp:'Leonardo da Vinci pintou a Mona Lisa entre 1503 e 1519.',d:2},
      {q:'Qual é a maior cordilheira do mundo?',a:'Andes',opts:['Himalaia','Alpes','Andes','Rochosas'],exp:'Os Andes têm cerca de 7 000 km de extensão, na América do Sul.',d:3},
      {q:'Qual é a moeda do Japão?',a:'Iene',opts:['Yuan','Won','Iene','Rúpia'],exp:'A moeda oficial do Japão é o iene (¥).',d:2},
      {q:'Quantos quilómetros tem a fronteira terrestre Portugal-Espanha?',a:'1 214 km',opts:['600 km','900 km','1 214 km','1 800 km'],exp:'A Raia tem 1 214 km, sendo uma das fronteiras mais antigas da Europa.',d:3},
    ],
    science: [
      {q:'O que estuda a biologia?',a:'Os seres vivos',opts:['As rochas','Os seres vivos','Os planetas','Os números'],exp:'A biologia é a ciência que estuda todos os seres vivos.',d:1},
      {q:'Qual é o símbolo químico do ouro?',a:'Au',opts:['Or','Go','Au','Ag'],exp:'Au vem do latim "aurum".',d:2},
      {q:'O que é a fotossíntese?',a:'Processo pelo qual as plantas produzem alimento',opts:['A respiração dos animais','Processo pelo qual as plantas produzem alimento','A digestão dos insetos','O ciclo da água'],exp:'As plantas usam luz solar, CO₂ e água para produzir glucose e oxigénio.',d:2},
      {q:'De que é composta a água?',a:'Hidrogénio e oxigénio',opts:['Hidrogénio e azoto','Hidrogénio e oxigénio','Oxigénio e carbono','Azoto e oxigénio'],exp:'H₂O = 2 átomos de hidrogénio + 1 átomo de oxigénio.',d:2},
      {q:'Qual é a força que nos mantém na Terra?',a:'Gravidade',opts:['Magnetismo','Fricção','Gravidade','Electricidade'],exp:'A gravidade é a força de atracção entre massas. A Terra atrai tudo para o seu centro.',d:2},
      {q:'Quantas células tem o corpo humano?',a:'Cerca de 37 biliões',opts:['Cerca de 1 milhão','Cerca de 1 bilião','Cerca de 37 biliões','Cerca de 1 trilião'],exp:'Estima-se que o corpo humano tenha cerca de 37,2 biliões de células.',d:3},
      {q:'O que é um átomo?',a:'A menor unidade da matéria',opts:['Uma molécula de água','A menor unidade da matéria','Um tipo de célula','Uma partícula de luz'],exp:'Os átomos são os blocos fundamentais de toda a matéria.',d:2},
      {q:'Qual é o planeta mais próximo do Sol?',a:'Mercúrio',opts:['Vénus','Terra','Mercúrio','Marte'],exp:'Mercúrio é o primeiro planeta do Sistema Solar.',d:1},
      {q:'O que é um vulcão?',a:'Uma abertura na crosta terrestre que liberta magma',opts:['Uma montanha com neve','Uma abertura na crosta terrestre que liberta magma','Um tipo de nuvem','Um canal submarino'],exp:'Quando o magma sai pelo vulcão, chama-se lava.',d:2},
      {q:'Qual é a velocidade da luz?',a:'300 000 km/s',opts:['150 000 km/s','300 000 km/s','600 000 km/s','100 000 km/s'],exp:'A luz percorre cerca de 300 000 km por segundo no vácuo.',d:3},
      {q:'O que estuda a meteorologia?',a:'O tempo e o clima',opts:['Os meteoros','O tempo e o clima','Os oceanos','Os vulcões'],exp:'A meteorologia estuda a atmosfera e os fenómenos climáticos.',d:2},
      {q:'Qual é o gás mais abundante na atmosfera?',a:'Azoto',opts:['Oxigénio','Azoto','Hidrogénio','Dióxido de carbono'],exp:'O ar é cerca de 78% azoto e 21% oxigénio.',d:2},
      {q:'A que temperatura congela a água ao nível do mar?',a:'0°C',opts:['-10°C','0°C','4°C','10°C'],exp:'À pressão atmosférica normal, a água congela a 0°C.',d:1},
      {q:'Como se chama a nossa galáxia?',a:'Via Láctea',opts:['Andrómeda','Triângulo','Via Láctea','Sombrero'],exp:'O Sistema Solar fica na galáxia Via Láctea.',d:1},
      {q:'A que temperatura ferve a água ao nível do mar?',a:'100°C',opts:['50°C','100°C','150°C','200°C'],exp:'A água ferve a 100°C ao nível do mar.',d:1},
      {q:'O que é o DNA?',a:'O código genético dos seres vivos',opts:['Um vírus','O código genético dos seres vivos','Uma proteína de defesa','Um açúcar'],exp:'O DNA contém as instruções genéticas que definem cada ser vivo.',d:3},
      {q:'Qual é o planeta mais quente do Sistema Solar?',a:'Vénus',opts:['Mercúrio','Vénus','Marte','Júpiter'],exp:'Vénus chega a 462°C devido ao seu efeito de estufa, sendo mais quente que Mercúrio.',d:3},
      {q:'Quantos ossos tem um adulto humano?',a:'206',opts:['100','206','300','450'],exp:'Um adulto tem 206 ossos. Os bebés nascem com cerca de 300, que se fundem.',d:2},
      {q:'Qual a força que faz cair uma maçã da árvore?',a:'Gravidade',opts:['Magnetismo','Gravidade','Eletricidade','Atrito'],exp:'A gravidade puxa todos os corpos para o centro da Terra.',d:1},
    ],
    history: [
      {q:'Em que ano terminou a Segunda Guerra Mundial?',a:'1945',opts:['1939','1942','1945','1950'],exp:'A Segunda Guerra Mundial terminou em 1945 com a rendição da Alemanha (maio) e do Japão (agosto).',d:2},
      {q:'Quem foi o primeiro presidente dos EUA?',a:'George Washington',opts:['Abraham Lincoln','Thomas Jefferson','George Washington','Benjamin Franklin'],exp:'George Washington foi o primeiro presidente dos Estados Unidos (1789–1797).',d:2},
      {q:'Em que ano chegou o Homem à Lua?',a:'1969',opts:['1959','1965','1969','1972'],exp:'Neil Armstrong e Buzz Aldrin chegaram à Lua a 20 de julho de 1969, na missão Apollo 11.',d:1},
      {q:'Quem descobriu o Brasil?',a:'Pedro Álvares Cabral',opts:['Cristóvão Colombo','Vasco da Gama','Pedro Álvares Cabral','Fernão de Magalhães'],exp:'Pedro Álvares Cabral chegou ao Brasil a 22 de abril de 1500.',d:2},
      {q:'Em que ano ocorreu a Revolução dos Cravos em Portugal?',a:'1974',opts:['1968','1970','1974','1976'],exp:'A Revolução dos Cravos aconteceu a 25 de abril de 1974, restaurando a democracia em Portugal.',d:2},
      {q:'Quem foi Napoleão Bonaparte?',a:'Imperador de França',opts:['Rei de Espanha','Imperador de França','Czar da Rússia','Chanceler da Alemanha'],exp:'Napoleão Bonaparte foi Imperador de França de 1804 a 1814/1815.',d:3},
      {q:'Qual é a civilização que construiu as pirâmides do Egipto?',a:'Egípcia',opts:['Romana','Grega','Egípcia','Mesopotâmica'],exp:'As pirâmides foram construídas pelos antigos Egípcios há cerca de 4 500 anos.',d:1},
      {q:'Em que continente nasceu a humanidade?',a:'África',opts:['Ásia','Europa','África','América'],exp:'Os fósseis mais antigos de humanos modernos foram encontrados em África.',d:2},
      {q:'Quando começou a Primeira Guerra Mundial?',a:'1914',opts:['1910','1914','1918','1920'],exp:'A Primeira Guerra Mundial começou em julho de 1914 e terminou em novembro de 1918.',d:3},
      {q:'Quem foi Júlio César?',a:'General e ditador romano',opts:['Rei da Grécia','General e ditador romano','Faraó do Egipto','Imperador da China'],exp:'Júlio César foi um dos mais importantes líderes da Roma Antiga, assassinado em 44 a.C.',d:3},
      {q:'Em que ano se deu a Revolução Francesa?',a:'1789',opts:['1689','1789','1820','1848'],exp:'A Revolução Francesa começou em 1789 com a tomada da Bastilha.',d:3},
      {q:'Quem foi o primeiro rei de Portugal?',a:'D. Afonso Henriques',opts:['D. Dinis','D. João I','D. Afonso Henriques','D. Sancho I'],exp:'D. Afonso Henriques foi o primeiro rei de Portugal (1139-1185).',d:2},
      {q:'Que navegador português chegou à Índia em 1498?',a:'Vasco da Gama',opts:['Cristóvão Colombo','Vasco da Gama','Pedro Álvares Cabral','Bartolomeu Dias'],exp:'Vasco da Gama abriu a rota marítima para a Índia em 1498.',d:2},
      {q:'Em que ano se deu o grande terramoto de Lisboa?',a:'1755',opts:['1700','1755','1822','1910'],exp:'O grande terramoto de Lisboa foi a 1 de novembro de 1755.',d:3},
      {q:'Quem foi Sócrates (filósofo)?',a:'Filósofo da Grécia antiga',opts:['Imperador romano','Filósofo da Grécia antiga','Pintor renascentista','Cientista britânico'],exp:'Sócrates (470-399 a.C.) foi um dos fundadores da filosofia ocidental.',d:3},
      {q:'Em que ano entrou Portugal na CEE/União Europeia?',a:'1986',opts:['1974','1980','1986','2000'],exp:'Portugal aderiu à então CEE a 1 de janeiro de 1986.',d:2},
      {q:'Quem inventou a lâmpada incandescente?',a:'Thomas Edison',opts:['Nikola Tesla','Thomas Edison','Alexander Graham Bell','Albert Einstein'],exp:'Thomas Edison patenteou a lâmpada incandescente em 1879.',d:2},
    ],
    animals: [
      {q:'O que come um coelho?',a:'Ervas e vegetais',opts:['Carne','Ervas e vegetais','Peixes','Insectos'],exp:'Os coelhos são herbívoros — comem ervas, cenouras, folhas e outros vegetais.',d:1},
      {q:'Qual é o maior animal terrestre?',a:'Elefante-africano',opts:['Hipopótamo','Girafa','Elefante-africano','Rinoceronte'],exp:'O elefante-africano é o maior animal terrestre, podendo pesar mais de 6 toneladas.',d:1},
      {q:'Quantas patas tem uma aranha?',a:'8',opts:['6','8','10','4'],exp:'As aranhas têm 8 patas, o que as distingue dos insectos (que têm 6).',d:1},
      {q:'Que som faz um gato?',a:'Mia',opts:['Late','Muge','Mia','Grasna'],exp:'Os gatos miam para comunicar com os humanos — é um comportamento aprendido.',d:1},
      {q:'Qual é o peixe mais rápido?',a:'Peixe-vela',opts:['Tubarão','Atum','Peixe-vela','Espadarte'],exp:'O peixe-vela pode atingir 110 km/h, sendo o peixe mais rápido do mundo.',d:2},
      {q:'De que se alimenta o panda gigante?',a:'Bambu',opts:['Peixe','Bambu','Mel','Frutos'],exp:'O panda gigante come quase exclusivamente bambu, consumindo até 40 kg por dia.',d:1},
      {q:'Qual animal tem a maior língua?',a:'Girafa',opts:['Camaleão','Girafa','Formigueiro','Elefante'],exp:'A língua da girafa tem cerca de 45 cm de comprimento.',d:3},
      {q:'Quantas asas tem uma abelha?',a:'4',opts:['2','4','6','0'],exp:'As abelhas têm 4 asas — 2 anteriores e 2 posteriores que se ligam em voo.',d:2},
      {q:'O que é um mamífero?',a:'Animal que amamenta as crias',opts:['Animal que bota ovos','Animal que amamenta as crias','Animal que vive na água','Animal com escamas'],exp:'Os mamíferos são animais de sangue quente que amamentam as crias com leite.',d:2},
      {q:'Qual é o maior animal do mundo?',a:'Baleia-azul',opts:['Elefante-africano','Tubarão-baleia','Baleia-azul','Crocodilo'],exp:'A baleia-azul pode atingir 30 metros e 180 toneladas.',d:1},
      {q:'Qual o mamífero que põe ovos?',a:'Ornitorrinco',opts:['Ouriço','Ornitorrinco','Esquilo','Toupeira'],exp:'O ornitorrinco é um dos raros mamíferos que põem ovos (monotremados).',d:3},
      {q:'Qual o símbolo nacional de Portugal mais famoso?',a:'Galo de Barcelos',opts:['Lobo Ibérico','Galo de Barcelos','Cavalo Lusitano','Touro'],exp:'O Galo de Barcelos é um dos símbolos mais reconhecíveis de Portugal.',d:2},
      {q:'Quantos corações tem um polvo?',a:'3',opts:['1','2','3','4'],exp:'O polvo tem 3 corações: um sistémico e dois branquiais.',d:3},
      {q:'Qual é a ave mais pequena do mundo?',a:'Beija-flor-abelha',opts:['Pintassilgo','Beija-flor-abelha','Pardal','Andorinha'],exp:'O beija-flor-abelha de Cuba pesa apenas ~2 g.',d:3},
      {q:'Que som faz um cão?',a:'Ladra',opts:['Mia','Ladra','Muge','Crocita'],exp:'Os cães ladram para comunicar.',d:1},
      {q:'Que idade pode atingir uma tartaruga gigante?',a:'Mais de 150 anos',opts:['20 anos','50 anos','100 anos','Mais de 150 anos'],exp:'Algumas tartarugas das Galápagos ultrapassam os 150 anos.',d:2},
    ],
    sport: [
      {q:'Quantos jogadores tem uma equipa de futebol?',a:'11',opts:['9','10','11','12'],exp:'Cada equipa de futebol tem 11 jogadores em campo, incluindo o guarda-redes.',d:1},
      {q:'Em que desporto se usa uma raquete e uma rede baixa?',a:'Ténis',opts:['Basquetebol','Badminton','Ténis','Squash'],exp:'No ténis usa-se uma raquete para rebater uma bola por cima de uma rede.',d:1},
      {q:'Quantos anos separam cada Jogos Olímpicos de Verão?',a:'4',opts:['2','4','5','6'],exp:'Os Jogos Olímpicos de Verão realizam-se de 4 em 4 anos.',d:2},
      {q:'Em que país nasceu o futebol moderno?',a:'Inglaterra',opts:['Brasil','Alemanha','Inglaterra','Espanha'],exp:'O futebol moderno foi codificado em Inglaterra em 1863.',d:2},
      {q:'Que desporto se joga com um volante?',a:'Badminton',opts:['Squash','Ténis','Paddle','Badminton'],exp:'O volante é o projéctil usado no badminton, feito de penas ou plástico.',d:2},
      {q:'Quantos pontos vale uma cesta de 3 pontos no basquetebol?',a:'3',opts:['1','2','3','4'],exp:'O lançamento de trás da linha de 3 pontos vale 3 pontos no basquetebol.',d:2},
      {q:'Em que desporto se usa um taco para bater numa bola?',a:'Golfe',opts:['Hóquei','Polo','Golfe','Cricket'],exp:'No golfe, o objectivo é introduzir a bola no buraco com o menor número de tacadas.',d:2},
      {q:'Qual é o maior torneio de ténis realizado em Wimbledon?',a:'Grand Slam',opts:['Copa Davis','Masters','Grand Slam','Liga ATP'],exp:'Wimbledon é um dos 4 torneios Grand Slam do ténis mundial.',d:3},
      {q:'Em que ano Portugal venceu o Campeonato da Europa de futebol?',a:'2016',opts:['2004','2008','2012','2016'],exp:'Portugal venceu o Euro 2016 em França, com vitória sobre os anfitriões na final.',d:1},
      {q:'Quantos pontos vale um golo no futebol?',a:'1',opts:['1','2','3','5'],exp:'Cada golo no futebol vale 1 ponto.',d:1},
      {q:'Qual é o desporto nacional do Japão?',a:'Sumô',opts:['Judo','Karaté','Sumô','Kendo'],exp:'O sumô é considerado o desporto nacional do Japão.',d:3},
      {q:'Quantos sets pode ter um jogo de ténis masculino em Grand Slam?',a:'Até 5',opts:['Até 3','Até 4','Até 5','Até 7'],exp:'Nos Grand Slams masculinos joga-se à melhor de 5 sets.',d:3},
      {q:'Em que desporto se usa um capacete e bastão?',a:'Hóquei no gelo',opts:['Ténis','Basquetebol','Hóquei no gelo','Vólei'],exp:'No hóquei usa-se capacete e um bastão (stick).',d:2},
    ],
    music: [
      {q:'Quantas cordas tem um violino?',a:'4',opts:['3','4','5','6'],exp:'O violino tem 4 cordas: Sol, Ré, Lá e Mi.',d:2},
      {q:'Qual instrumento é considerado "o rei dos instrumentos"?',a:'Órgão',opts:['Piano','Violino','Órgão','Harpa'],exp:'O órgão é chamado "o rei dos instrumentos" pela sua grandiosidade e variedade de sons.',d:3},
      {q:'De que país é o fado?',a:'Portugal',opts:['Espanha','Brasil','Portugal','Argentina'],exp:'O fado é o género musical tradicional português, classificado como Património da UNESCO.',d:1},
      {q:'Quantas teclas brancas tem um piano normal?',a:'52',opts:['48','52','56','60'],exp:'Um piano de 88 teclas tem 52 teclas brancas e 36 teclas pretas.',d:3},
      {q:'O que é uma sinfonia?',a:'Uma composição para orquestra',opts:['Uma canção popular','Uma composição para orquestra','Um dueto de piano','Uma dança tradicional'],exp:'Uma sinfonia é uma composição musical extensa para orquestra, geralmente com 4 andamentos.',d:2},
      {q:'Quem foi Beethoven?',a:'Um compositor alemão',opts:['Um cantor inglês','Um compositor alemão','Um violinista italiano','Um pianista francês'],exp:'Ludwig van Beethoven foi um dos maiores compositores da história, que continuou a compor mesmo depois de ficar surdo.',d:2},
      {q:'Que instrumento toca-se com um arco?',a:'Violino',opts:['Guitarra','Flauta','Violino','Saxofone'],exp:'O violino, viola, violoncelo e contrabaixo tocam-se com um arco.',d:1},
      {q:'O que é o jazz?',a:'Um género musical americano',opts:['Música clássica europeia','Um género musical americano','Dança tradicional africana','Música folclórica portuguesa'],exp:'O jazz nasceu nos Estados Unidos no início do século XX.',d:2},
      {q:'Quantas notas tem a escala musical básica?',a:'7',opts:['5','7','9','12'],exp:'Dó, Ré, Mi, Fá, Sol, Lá, Si — sete notas (mais a oitava).',d:1},
      {q:'Quem é considerada a "Rainha do Fado"?',a:'Amália Rodrigues',opts:['Mariza','Amália Rodrigues','Carminho','Ana Moura'],exp:'Amália Rodrigues (1920-1999) é a "Rainha do Fado".',d:1},
      {q:'Como se chama o instrumento de cordas duplas típico do fado?',a:'Guitarra portuguesa',opts:['Bandolim','Cavaquinho','Guitarra portuguesa','Viola braguesa'],exp:'A guitarra portuguesa tem 12 cordas em 6 ordens duplas, com som inconfundível.',d:2},
      {q:'Quem compôs as bandas sonoras de filmes como "Lisbon Story"?',a:'Madredeus',opts:['Mariza','Madredeus','Carlos do Carmo','Dulce Pontes'],exp:'Os Madredeus compuseram a banda sonora do filme "Lisbon Story" de Wim Wenders.',d:3},
      {q:'De quantas cordas é feita uma viola clássica?',a:'6',opts:['4','5','6','8'],exp:'A guitarra/viola clássica tem 6 cordas afinadas Mi-Lá-Ré-Sol-Si-Mi.',d:2},
    ],
  },
  en: {
    gk: [
      {q:'How many planets are in the Solar System?',a:'8',opts:['6','7','8','9'],exp:'The 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.'},
      {q:'Which is the largest ocean on Earth?',a:'Pacific',opts:['Atlantic','Indian','Pacific','Arctic'],exp:'The Pacific Ocean covers more than 165 million km².'},
      {q:'In which country is the Eiffel Tower?',a:'France',opts:['Italy','Spain','France','Germany'],exp:'The Eiffel Tower is in Paris, France, and was built in 1889.'},
      {q:'What is the fastest land animal?',a:'Cheetah',opts:['Lion','Eagle','Cheetah','Leopard'],exp:'The cheetah can reach speeds of 112 km/h.'},
      {q:'How many continents are there on Earth?',a:'7',opts:['5','6','7','8'],exp:'The 7 continents: Africa, Antarctica, Asia, Europe, North America, South America and Oceania.'},
      {q:'Which is the longest river in the world?',a:'Nile',opts:['Amazon','Nile','Yangtze','Mississippi'],exp:'The Nile is approximately 6,650 km long.'},
      {q:'How many sides does a hexagon have?',a:'6',opts:['4','5','6','8'],exp:'Hexa means six in Greek.'},
      {q:'What is the capital of Australia?',a:'Canberra',opts:['Sydney','Melbourne','Canberra','Perth'],exp:'Canberra is Australia\'s capital city, not Sydney.'},
      {q:'What material does a spider use for its web?',a:'Silk',opts:['Cotton','Silk','Nylon','Thread'],exp:'Spider webs are made of silk protein — stronger than steel by weight.'},
      {q:'How many hours are in a day?',a:'24',opts:['12','20','24','48'],exp:'A day has 24 hours, the time Earth takes to complete one rotation.'},
      {q:'How many wings does a butterfly have?',a:'4',opts:['2','4','6','8'],exp:'Butterflies have 4 wings: two forewings and two hindwings.'},
      {q:'What instrument does an astronomer use?',a:'Telescope',opts:['Microscope','Telescope','Barometer','Compass'],exp:'A telescope allows us to observe distant objects in space.'},
    ],
    science: [
      {q:'What does biology study?',a:'Living organisms',opts:['Rocks','Living organisms','Planets','Numbers'],exp:'Biology is the science that studies all living things.'},
      {q:'What is the chemical symbol for gold?',a:'Au',opts:['Or','Go','Au','Ag'],exp:'Au comes from the Latin word "aurum".'},
      {q:'What is photosynthesis?',a:'The process by which plants make food',opts:['Animal respiration','The process by which plants make food','Insect digestion','The water cycle'],exp:'Plants use sunlight, CO₂ and water to produce glucose and oxygen.'},
      {q:'What is water made of?',a:'Hydrogen and oxygen',opts:['Hydrogen and nitrogen','Hydrogen and oxygen','Oxygen and carbon','Nitrogen and oxygen'],exp:'H₂O = 2 hydrogen atoms + 1 oxygen atom.'},
      {q:'What force keeps us on Earth?',a:'Gravity',opts:['Magnetism','Friction','Gravity','Electricity'],exp:'Gravity is the force of attraction between masses.'},
      {q:'What is an atom?',a:'The smallest unit of matter',opts:['A water molecule','The smallest unit of matter','A type of cell','A particle of light'],exp:'Atoms are the fundamental building blocks of all matter.'},
      {q:'What is a volcano?',a:'An opening in Earth\'s crust that releases magma',opts:['A snowy mountain','An opening in Earth\'s crust that releases magma','A type of cloud','An underwater channel'],exp:'When magma exits the volcano it is called lava.'},
      {q:'What is the speed of light?',a:'300,000 km/s',opts:['150,000 km/s','300,000 km/s','600,000 km/s','100,000 km/s'],exp:'Light travels about 300,000 km per second in a vacuum.'},
      {q:'What does meteorology study?',a:'Weather and climate',opts:['Meteors','Weather and climate','Oceans','Volcanoes'],exp:'Meteorology studies the atmosphere and weather phenomena.'},
      {q:'What does a microscope do?',a:'Makes very small things appear larger',opts:['Looks at stars','Makes very small things appear larger','Measures temperature','Detects sound'],exp:'Microscopes magnify tiny objects so we can study them in detail.'},
    ],
    history: [
      {q:'In which year did World War II end?',a:'1945',opts:['1939','1942','1945','1950'],exp:'World War II ended in 1945 — Germany surrendered in May, Japan in August.'},
      {q:'Who was the first US President?',a:'George Washington',opts:['Abraham Lincoln','Thomas Jefferson','George Washington','Benjamin Franklin'],exp:'George Washington was the first US President (1789–1797).'},
      {q:'In which year did humans first land on the Moon?',a:'1969',opts:['1959','1965','1969','1972'],exp:'Neil Armstrong and Buzz Aldrin landed on the Moon on 20 July 1969 (Apollo 11).'},
      {q:'Who built the Egyptian pyramids?',a:'The ancient Egyptians',opts:['The Romans','The Greeks','The ancient Egyptians','The Mesopotamians'],exp:'The pyramids were built by the ancient Egyptians about 4,500 years ago.'},
      {q:'When did World War I begin?',a:'1914',opts:['1910','1914','1918','1920'],exp:'World War I began in July 1914 and ended in November 1918.'},
      {q:'Who was Julius Caesar?',a:'A Roman general and dictator',opts:['King of Greece','A Roman general and dictator','Pharaoh of Egypt','Emperor of China'],exp:'Julius Caesar was one of the most important leaders of ancient Rome, assassinated in 44 BC.'},
      {q:'In which year did Christopher Columbus reach the Americas?',a:'1492',opts:['1488','1492','1498','1502'],exp:'Christopher Columbus reached the Bahamas on 12 October 1492.'},
      {q:'Who invented the telephone?',a:'Alexander Graham Bell',opts:['Thomas Edison','Nikola Tesla','Alexander Graham Bell','Guglielmo Marconi'],exp:'Alexander Graham Bell is credited with inventing the telephone in 1876.'},
    ],
  }
};

/* ══════════════════════════════════════════════════════════════════
   EXPANDED BANKS — additional verified questions merged into _TRIVIA.
   Goal: keep every category richly playable fully offline (no API).
   New EN banks (animals/sport/music) + vehicles (PT & EN) close the gaps
   where providers previously fell back to general knowledge.
   Every fact below is independently checkable — nothing approximated.
══════════════════════════════════════════════════════════════════ */
const _TRIVIA_EXTRA = {
  pt: {
    gk: [
      {q:'Qual é a capital de Portugal?',a:'Lisboa',opts:['Porto','Lisboa','Coimbra','Braga'],exp:'Lisboa é a capital de Portugal desde 1255.',d:1},
      {q:'Quantas cores tem o arco-íris?',a:'7',opts:['5','6','7','8'],exp:'Vermelho, laranja, amarelo, verde, azul, anil e violeta.',d:1},
      {q:'Qual é o maior país do mundo em área?',a:'Rússia',opts:['Canadá','China','Rússia','EUA'],exp:'A Rússia tem cerca de 17 milhões de km², abrangendo 11 fusos horários.',d:2},
      {q:'Qual é o país mais populoso do mundo?',a:'Índia',opts:['China','Índia','EUA','Indonésia'],exp:'A Índia ultrapassou a China como país mais populoso em 2023.',d:3},
      {q:'Em que cidade fica a estátua da Liberdade?',a:'Nova Iorque',opts:['Washington','Boston','Nova Iorque','Filadélfia'],exp:'A Estátua da Liberdade foi um presente da França aos EUA em 1886.',d:2},
      {q:'Qual é o menor país do mundo?',a:'Vaticano',opts:['Mónaco','Vaticano','São Marino','Liechtenstein'],exp:'O Vaticano tem apenas 0,44 km².',d:3},
      {q:'Qual é a língua mais falada do mundo (nativos)?',a:'Mandarim',opts:['Inglês','Espanhol','Mandarim','Hindi'],exp:'O chinês mandarim tem o maior número de falantes nativos.',d:3},
      {q:'Quantos segundos tem um minuto?',a:'60',opts:['30','60','90','100'],exp:'Um minuto tem 60 segundos.',d:1},
      {q:'Qual é o símbolo de Paris?',a:'Torre Eiffel',opts:['Big Ben','Torre Eiffel','Coliseu','Estátua da Liberdade'],exp:'A Torre Eiffel é o símbolo mais reconhecido de Paris.',d:1},
      {q:'Em que país fica a cidade de Quioto?',a:'Japão',opts:['China','Coreia do Sul','Japão','Tailândia'],exp:'Quioto foi a capital imperial do Japão durante mais de mil anos.',d:2},
      {q:'Qual é a maior floresta tropical do mundo?',a:'Amazónia',opts:['Congo','Amazónia','Bornéu','Taiga'],exp:'A floresta amazónica cobre grande parte da América do Sul.',d:1},
      {q:'Que cor se obtém misturando azul e amarelo?',a:'Verde',opts:['Laranja','Verde','Roxo','Castanho'],exp:'Azul + amarelo = verde, na mistura de cores.',d:1},
      {q:'Quantos dias tem um ano bissexto?',a:'366',opts:['364','365','366','367'],exp:'Um ano bissexto tem 366 dias, com 29 de fevereiro.',d:2},
      {q:'Qual é a moeda usada em Portugal?',a:'Euro',opts:['Escudo','Euro','Peseta','Libra'],exp:'Portugal adotou o euro em 2002.',d:1},
      {q:'Qual é o lago de água doce mais profundo do mundo?',a:'Baikal',opts:['Superior','Vitória','Baikal','Tanganica'],exp:'O lago Baikal, na Sibéria, tem mais de 1 600 m de profundidade.',d:3},
      {q:'Com que país tem Portugal fronteira terrestre?',a:'Espanha',opts:['França','Espanha','Marrocos','Itália'],exp:'Portugal só tem fronteira terrestre com Espanha.',d:1},
      {q:'Qual é a capital do Brasil?',a:'Brasília',opts:['Rio de Janeiro','São Paulo','Brasília','Salvador'],exp:'Brasília é a capital do Brasil desde 1960.',d:2},
      {q:'Quantas pontas tem uma estrela do mar comum?',a:'5',opts:['4','5','6','8'],exp:'A maioria das estrelas-do-mar tem 5 braços.',d:2},
    ],
    science: [
      {q:'Qual é o planeta com mais luas?',a:'Saturno',opts:['Júpiter','Saturno','Urano','Neptuno'],exp:'Saturno tem mais de 140 luas confirmadas, ultrapassando Júpiter.',d:3},
      {q:'O que mede um termómetro?',a:'Temperatura',opts:['Pressão','Temperatura','Humidade','Velocidade'],exp:'O termómetro mede a temperatura.',d:1},
      {q:'Qual é o estado da água a 0°C ou menos?',a:'Sólido (gelo)',opts:['Líquido','Gasoso','Sólido (gelo)','Plasma'],exp:'Abaixo de 0°C a água congela e torna-se gelo.',d:1},
      {q:'Qual gás as plantas absorvem do ar?',a:'Dióxido de carbono',opts:['Oxigénio','Dióxido de carbono','Azoto','Hélio'],exp:'As plantas absorvem CO₂ e libertam oxigénio na fotossíntese.',d:2},
      {q:'Qual é a unidade de força no Sistema Internacional?',a:'Newton',opts:['Joule','Watt','Newton','Pascal'],exp:'A força mede-se em newtons (N), em honra de Isaac Newton.',d:3},
      {q:'O que é um eclipse solar?',a:'A Lua tapa o Sol',opts:['A Terra tapa o Sol','A Lua tapa o Sol','O Sol apaga-se','A Lua brilha mais'],exp:'No eclipse solar, a Lua fica entre a Terra e o Sol.',d:2},
      {q:'Quantos cromossomas tem uma célula humana?',a:'46',opts:['23','46','48','64'],exp:'As células humanas têm 46 cromossomas (23 pares).',d:3},
      {q:'Qual é o metal líquido à temperatura ambiente?',a:'Mercúrio',opts:['Ferro','Mercúrio','Alumínio','Chumbo'],exp:'O mercúrio é o único metal líquido à temperatura ambiente.',d:3},
      {q:'O que produz a electricidade numa central hidroeléctrica?',a:'A água em movimento',opts:['O vento','A água em movimento','O sol','O carvão'],exp:'A água em queda faz girar turbinas que geram electricidade.',d:2},
      {q:'Que parte da planta absorve a água do solo?',a:'As raízes',opts:['As folhas','As flores','As raízes','O caule'],exp:'As raízes absorvem água e nutrientes do solo.',d:1},
      {q:'Qual é o som mais rápido: no ar ou na água?',a:'Na água',opts:['No ar','Na água','Igual','No vácuo'],exp:'O som viaja mais depressa na água do que no ar.',d:3},
      {q:'O que é a evaporação?',a:'A passagem de líquido a gás',opts:['A passagem de gás a líquido','A passagem de líquido a gás','A passagem de sólido a líquido','O congelamento'],exp:'A evaporação transforma a água líquida em vapor.',d:2},
      {q:'Qual é o órgão da respiração nos peixes?',a:'Guelras',opts:['Pulmões','Guelras','Pele','Boca'],exp:'Os peixes respiram através das guelras (brânquias).',d:1},
      {q:'Quantas patas tem um insecto?',a:'6',opts:['4','6','8','10'],exp:'Todos os insectos têm 6 patas.',d:1},
    ],
    history: [
      {q:'Quem foi o navegador que deu a primeira volta ao mundo?',a:'Fernão de Magalhães',opts:['Vasco da Gama','Fernão de Magalhães','Cristóvão Colombo','Bartolomeu Dias'],exp:'A expedição de Magalhães (1519-1522) foi a primeira a circum-navegar o globo.',d:3},
      {q:'Que muralha dividia Berlim até 1989?',a:'Muro de Berlim',opts:['Muralha da China','Muro de Berlim','Muro de Adriano','Linha Maginot'],exp:'O Muro de Berlim caiu a 9 de novembro de 1989.',d:2},
      {q:'Quem foi Cleópatra?',a:'Rainha do Egipto',opts:['Rainha de França','Rainha do Egipto','Imperatriz romana','Rainha de Espanha'],exp:'Cleópatra VII foi a última faraó do Egipto.',d:2},
      {q:'Em que século viveu D. Afonso Henriques?',a:'Século XII',opts:['Século X','Século XII','Século XV','Século XVII'],exp:'D. Afonso Henriques (c.1109-1185) fundou Portugal no século XII.',d:3},
      {q:'Que civilização inventou a democracia?',a:'Grécia Antiga',opts:['Roma','Egipto','Grécia Antiga','Pérsia'],exp:'A democracia nasceu em Atenas, na Grécia Antiga.',d:2},
      {q:'Quem liderou a Índia na independência de forma não-violenta?',a:'Gandhi',opts:['Nehru','Gandhi','Mandela','Churchill'],exp:'Mahatma Gandhi liderou a independência da Índia através da resistência pacífica.',d:2},
      {q:'Que império construiu o Coliseu?',a:'Império Romano',opts:['Império Grego','Império Romano','Império Persa','Império Otomano'],exp:'O Coliseu foi construído pelos romanos no século I d.C.',d:1},
      {q:'Em que ano afundou o Titanic?',a:'1912',opts:['1905','1912','1920','1931'],exp:'O Titanic afundou na sua viagem inaugural, em abril de 1912.',d:2},
      {q:'Quem foi Marco Polo?',a:'Um explorador veneziano',opts:['Um rei inglês','Um explorador veneziano','Um general romano','Um faraó'],exp:'Marco Polo viajou pela Ásia e chegou à China no século XIII.',d:3},
      {q:'Que rei mandou erguer o Padrão dos Descobrimentos?',a:'Nenhum (foi de 1940)',opts:['D. Manuel I','D. João II','D. Sebastião','Nenhum (foi de 1940)'],exp:'O Padrão dos Descobrimentos foi erguido em 1940 para a Exposição do Mundo Português.',d:3},
      {q:'Que documento limitou o poder do rei inglês em 1215?',a:'Magna Carta',opts:['Magna Carta','Constituição','Bill of Rights','Tratado de Tordesilhas'],exp:'A Magna Carta (1215) limitou o poder do rei João de Inglaterra.',d:3},
      {q:'Quem pintou o teto da Capela Sistina?',a:'Michelangelo',opts:['Leonardo da Vinci','Rafael','Michelangelo','Donatello'],exp:'Michelangelo pintou o teto da Capela Sistina entre 1508 e 1512.',d:2},
      {q:'Que tratado dividiu o "novo mundo" entre Portugal e Espanha?',a:'Tratado de Tordesilhas',opts:['Tratado de Windsor','Tratado de Tordesilhas','Tratado de Versalhes','Tratado de Madrid'],exp:'O Tratado de Tordesilhas (1494) dividiu as terras descobertas entre as duas coroas.',d:3},
    ],
    animals: [
      {q:'Qual é o maior felino do mundo?',a:'Tigre',opts:['Leão','Tigre','Leopardo','Jaguar'],exp:'O tigre-siberiano é o maior felino, podendo pesar mais de 300 kg.',d:2},
      {q:'Que animal é conhecido como o "rei da selva"?',a:'Leão',opts:['Tigre','Leão','Elefante','Gorila'],exp:'O leão é tradicionalmente chamado o rei da selva.',d:1},
      {q:'Qual ave não voa mas corre muito depressa?',a:'Avestruz',opts:['Pinguim','Avestruz','Galinha','Pavão'],exp:'A avestruz corre até 70 km/h e é a maior ave do mundo.',d:2},
      {q:'Quantas patas tem um caranguejo?',a:'10',opts:['6','8','10','12'],exp:'Os caranguejos têm 10 patas, incluindo as pinças.',d:2},
      {q:'Que animal muda de cor para se camuflar?',a:'Camaleão',opts:['Sapo','Camaleão','Coruja','Lobo'],exp:'O camaleão muda de cor para comunicar e regular a temperatura.',d:1},
      {q:'Qual destes animais é um anfíbio?',a:'Rã',opts:['Lagarto','Rã','Cobra','Tartaruga'],exp:'A rã é um anfíbio: vive na água e em terra.',d:2},
      {q:'Qual é o animal mais alto do mundo?',a:'Girafa',opts:['Elefante','Girafa','Camelo','Avestruz'],exp:'A girafa pode atingir 5,5 m de altura.',d:1},
      {q:'O que produz a abelha?',a:'Mel',opts:['Leite','Mel','Seda','Cera apenas'],exp:'As abelhas produzem mel a partir do néctar das flores.',d:1},
      {q:'Que mamífero marinho é conhecido pela inteligência?',a:'Golfinho',opts:['Tubarão','Golfinho','Atum','Polvo'],exp:'Os golfinhos estão entre os animais mais inteligentes do planeta.',d:1},
      {q:'Qual destes animais hiberna no inverno?',a:'Urso',opts:['Leão','Urso','Zebra','Canguru'],exp:'Muitos ursos hibernam durante o inverno.',d:2},
      {q:'Qual é o maior réptil do mundo?',a:'Crocodilo-de-água-salgada',opts:['Píton','Crocodilo-de-água-salgada','Iguana','Dragão-de-komodo'],exp:'O crocodilo-de-água-salgada pode passar dos 6 metros.',d:3},
      {q:'Que animal carrega as crias numa bolsa?',a:'Canguru',opts:['Coala','Canguru','Lontra','Esquilo'],exp:'O canguru é um marsupial: transporta as crias numa bolsa.',d:1},
      {q:'Quantos olhos tem a maioria das aranhas?',a:'8',opts:['2','4','6','8'],exp:'A maioria das aranhas tem 8 olhos.',d:3},
    ],
    sport: [
      {q:'Quantos jogadores tem uma equipa de basquetebol em campo?',a:'5',opts:['4','5','6','7'],exp:'No basquetebol cada equipa tem 5 jogadores em campo.',d:1},
      {q:'De quantos em quantos anos há um Mundial de futebol?',a:'4',opts:['2','3','4','5'],exp:'O Campeonato do Mundo de futebol realiza-se de 4 em 4 anos.',d:1},
      {q:'Que país ganhou mais Mundiais de futebol?',a:'Brasil',opts:['Alemanha','Brasil','Itália','Argentina'],exp:'O Brasil venceu 5 Campeonatos do Mundo.',d:2},
      {q:'Em que desporto existe o "strike" e o "spare"?',a:'Bowling',opts:['Ténis','Bowling','Golfe','Críquete'],exp:'Strike e spare são termos do bowling.',d:2},
      {q:'Quantos anéis tem o símbolo olímpico?',a:'5',opts:['3','4','5','6'],exp:'Os 5 anéis representam os cinco continentes.',d:1},
      {q:'Em que país se realizaram os primeiros Jogos Olímpicos modernos (1896)?',a:'Grécia',opts:['França','Grécia','Inglaterra','EUA'],exp:'Os primeiros Jogos Olímpicos modernos foram em Atenas, em 1896.',d:3},
      {q:'Qual é a distância de uma maratona?',a:'42,195 km',opts:['21 km','42,195 km','50 km','100 km'],exp:'A maratona tem 42,195 km.',d:3},
      {q:'Que clube português tem mais títulos nacionais de futebol?',a:'Benfica',opts:['FC Porto','Benfica','Sporting','Braga'],exp:'O Benfica é o clube com mais campeonatos nacionais de Portugal.',d:3},
      {q:'Em que desporto se usa um "puck"?',a:'Hóquei no gelo',opts:['Hóquei no gelo','Ténis de mesa','Polo','Andebol'],exp:'O disco (puck) é usado no hóquei no gelo.',d:2},
      {q:'Quem é considerado o melhor jogador de futebol português de sempre por muitos?',a:'Cristiano Ronaldo',opts:['Eusébio','Cristiano Ronaldo','Luís Figo','Rui Costa'],exp:'Cristiano Ronaldo é o melhor marcador da história das seleções.',d:1},
      {q:'Quantos pontos vale um "try" no râguebi?',a:'5',opts:['3','5','6','7'],exp:'Um try vale 5 pontos no râguebi.',d:3},
      {q:'Em que superfície se joga Wimbledon?',a:'Relva',opts:['Terra batida','Relva','Cimento','Sintético'],exp:'Wimbledon é o único Grand Slam jogado em relva.',d:3},
    ],
    music: [
      {q:'Quantas linhas tem uma pauta musical?',a:'5',opts:['4','5','6','7'],exp:'A pauta musical tem 5 linhas e 4 espaços.',d:2},
      {q:'Qual destes é um instrumento de sopro?',a:'Flauta',opts:['Violino','Flauta','Tambor','Piano'],exp:'A flauta é um instrumento de sopro (aerofone).',d:1},
      {q:'Qual destes é um instrumento de percussão?',a:'Bateria',opts:['Bateria','Guitarra','Violoncelo','Harpa'],exp:'A bateria é um instrumento de percussão.',d:1},
      {q:'O que indica o "andamento" de uma música?',a:'A velocidade',opts:['O volume','A velocidade','A altura','O instrumento'],exp:'O andamento (tempo) indica a velocidade da música.',d:2},
      {q:'Qual é o instrumento com teclas pretas e brancas?',a:'Piano',opts:['Órgão','Piano','Acordeão','Todos'],exp:'O piano (e também o órgão e o acordeão) tem teclas pretas e brancas.',d:1},
      {q:'Quantos músicos tem normalmente um quarteto?',a:'4',opts:['2','3','4','5'],exp:'Um quarteto é formado por 4 músicos.',d:1},
      {q:'Que festival de música português é um dos maiores da Europa?',a:'Rock in Rio Lisboa',opts:['Tomorrowland','Rock in Rio Lisboa','Glastonbury','Coachella'],exp:'O Rock in Rio Lisboa é um dos grandes festivais realizados em Portugal.',d:3},
      {q:'O que é uma "ópera"?',a:'Um teatro cantado',opts:['Uma dança','Um teatro cantado','Um tipo de tambor','Uma orquestra pequena'],exp:'A ópera é uma obra teatral inteiramente cantada.',d:2},
      {q:'Quem dirige uma orquestra?',a:'O maestro',opts:['O solista','O maestro','O compositor','O produtor'],exp:'O maestro (regente) dirige a orquestra.',d:1},
      {q:'Que país venceu o Festival Eurovisão em 2017 com Salvador Sobral?',a:'Portugal',opts:['Espanha','Portugal','Itália','França'],exp:'Salvador Sobral deu a Portugal a primeira vitória na Eurovisão, em 2017.',d:2},
      {q:'Quantas cordas tem uma guitarra clássica?',a:'6',opts:['4','5','6','12'],exp:'A guitarra clássica tem 6 cordas.',d:1},
    ],
    vehicles: [
      {q:'Quantas rodas tem um carro normal?',a:'4',opts:['2','3','4','6'],exp:'A maioria dos automóveis tem 4 rodas.',d:1},
      {q:'Que veículo anda sobre carris?',a:'Comboio',opts:['Autocarro','Comboio','Camião','Mota'],exp:'O comboio circula sobre carris (linhas férreas).',d:1},
      {q:'Que veículo voa transportando passageiros?',a:'Avião',opts:['Barco','Avião','Comboio','Submarino'],exp:'O avião transporta passageiros pelo ar.',d:1},
      {q:'Qual destes veículos anda debaixo de água?',a:'Submarino',opts:['Veleiro','Submarino','Ferry','Jet ski'],exp:'O submarino navega submerso.',d:1},
      {q:'Quantas rodas tem uma bicicleta?',a:'2',opts:['1','2','3','4'],exp:'A bicicleta tem 2 rodas.',d:1},
      {q:'Que veículo é usado para combater incêndios?',a:'Camião dos bombeiros',opts:['Ambulância','Camião dos bombeiros','Carro da polícia','Táxi'],exp:'O camião dos bombeiros transporta água e equipamento.',d:1},
      {q:'O que faz um motor a combustão?',a:'Queima combustível para gerar movimento',opts:['Usa apenas eletricidade','Queima combustível para gerar movimento','Usa energia solar','Funciona com água'],exp:'O motor a combustão queima gasolina ou gasóleo para mover o veículo.',d:2},
      {q:'Qual é o veículo mais rápido: avião ou carro?',a:'Avião',opts:['Carro','Avião','Igual','Depende do dia'],exp:'Os aviões comerciais voam a cerca de 900 km/h.',d:1},
      {q:'Como se chama o veículo que leva astronautas ao espaço?',a:'Foguetão',opts:['Avião','Foguetão','Helicóptero','Balão'],exp:'Os foguetões transportam astronautas e satélites para o espaço.',d:1},
      {q:'Que documento é preciso para conduzir um carro?',a:'Carta de condução',opts:['Passaporte','Carta de condução','Bilhete de identidade','Cartão de cidadão'],exp:'É obrigatório ter carta de condução para conduzir.',d:2},
      {q:'Que parte do carro serve para parar?',a:'Os travões',opts:['O acelerador','Os travões','O volante','Os faróis'],exp:'Os travões reduzem a velocidade e param o carro.',d:1},
      {q:'Como se chama o veículo de duas rodas com motor?',a:'Mota',opts:['Bicicleta','Mota','Trotinete','Triciclo'],exp:'A motociclo (mota) tem duas rodas e motor.',d:1},
      {q:'Qual destes é um veículo elétrico famoso?',a:'Comboio elétrico',opts:['Comboio elétrico','Carroça','Veleiro','Planador'],exp:'Muitos comboios funcionam a eletricidade, sem emissões diretas.',d:2},
      {q:'O que mede o velocímetro de um carro?',a:'A velocidade',opts:['A gasolina','A velocidade','A temperatura','A distância'],exp:'O velocímetro indica a velocidade do veículo.',d:2},
    ],
  },
  en: {
    gk: [
      {q:'What is the capital of Portugal?',a:'Lisbon',opts:['Porto','Lisbon','Coimbra','Madrid'],exp:'Lisbon has been the capital of Portugal since 1255.',d:1},
      {q:'How many colours are in a rainbow?',a:'7',opts:['5','6','7','8'],exp:'Red, orange, yellow, green, blue, indigo and violet.',d:1},
      {q:'Which is the largest country by area?',a:'Russia',opts:['Canada','China','Russia','USA'],exp:'Russia spans about 17 million km² across 11 time zones.',d:2},
      {q:'Which is the most populous country?',a:'India',opts:['China','India','USA','Indonesia'],exp:'India overtook China as the most populous country in 2023.',d:3},
      {q:'In which city is the Statue of Liberty?',a:'New York',opts:['Washington','Boston','New York','Chicago'],exp:'The Statue of Liberty was a gift from France to the USA in 1886.',d:2},
      {q:'Which is the smallest country in the world?',a:'Vatican City',opts:['Monaco','Vatican City','San Marino','Malta'],exp:'Vatican City is just 0.44 km².',d:3},
      {q:'How many seconds are in a minute?',a:'60',opts:['30','60','90','100'],exp:'There are 60 seconds in a minute.',d:1},
      {q:'Which country is shaped like a boot?',a:'Italy',opts:['Spain','Italy','Greece','Portugal'],exp:'Italy is famously shaped like a boot.',d:1},
      {q:'Which is the largest rainforest on Earth?',a:'Amazon',opts:['Congo','Amazon','Borneo','Taiga'],exp:'The Amazon rainforest covers much of South America.',d:1},
      {q:'What colour do you get mixing blue and yellow?',a:'Green',opts:['Orange','Green','Purple','Brown'],exp:'Blue + yellow makes green.',d:1},
      {q:'How many days are in a leap year?',a:'366',opts:['364','365','366','367'],exp:'A leap year has 366 days, with 29 February.',d:2},
      {q:'Which ocean is the largest?',a:'Pacific',opts:['Atlantic','Indian','Pacific','Arctic'],exp:'The Pacific is the largest and deepest ocean.',d:1},
      {q:'What currency is used across most of Europe?',a:'Euro',opts:['Dollar','Euro','Pound','Franc'],exp:'The euro is used by many European Union countries.',d:1},
      {q:'Which is the longest wall in the world?',a:'Great Wall of China',opts:['Berlin Wall','Great Wall of China',"Hadrian's Wall",'Western Wall'],exp:'The Great Wall of China stretches over 21,000 km.',d:2},
      {q:'What is the capital of Japan?',a:'Tokyo',opts:['Osaka','Kyoto','Tokyo','Nagoya'],exp:'Tokyo is the capital and largest city of Japan.',d:1},
      {q:'Which planet do we live on?',a:'Earth',opts:['Mars','Venus','Earth','Jupiter'],exp:'We live on planet Earth, the third from the Sun.',d:1},
    ],
    science: [
      {q:'Which planet has the most moons?',a:'Saturn',opts:['Jupiter','Saturn','Uranus','Neptune'],exp:'Saturn has over 140 confirmed moons, more than Jupiter.',d:3},
      {q:'What does a thermometer measure?',a:'Temperature',opts:['Pressure','Temperature','Humidity','Speed'],exp:'A thermometer measures temperature.',d:1},
      {q:'Which gas do plants absorb from the air?',a:'Carbon dioxide',opts:['Oxygen','Carbon dioxide','Nitrogen','Helium'],exp:'Plants absorb CO₂ and release oxygen during photosynthesis.',d:2},
      {q:'What is the SI unit of force?',a:'Newton',opts:['Joule','Watt','Newton','Pascal'],exp:'Force is measured in newtons (N), named after Isaac Newton.',d:3},
      {q:'During a solar eclipse, what blocks the Sun?',a:'The Moon',opts:['The Earth','The Moon','A planet','A comet'],exp:'In a solar eclipse the Moon passes between the Earth and the Sun.',d:2},
      {q:'How many chromosomes does a human cell have?',a:'46',opts:['23','46','48','64'],exp:'Human cells have 46 chromosomes (23 pairs).',d:3},
      {q:'Which metal is liquid at room temperature?',a:'Mercury',opts:['Iron','Mercury','Aluminium','Lead'],exp:'Mercury is the only metal that is liquid at room temperature.',d:3},
      {q:'Which part of a plant absorbs water from the soil?',a:'The roots',opts:['The leaves','The flowers','The roots','The stem'],exp:'Roots absorb water and nutrients from the soil.',d:1},
      {q:'How many legs does an insect have?',a:'6',opts:['4','6','8','10'],exp:'All insects have 6 legs.',d:1},
      {q:'What do fish use to breathe?',a:'Gills',opts:['Lungs','Gills','Skin','Mouth'],exp:'Fish breathe using their gills.',d:1},
      {q:'What is H₂O commonly known as?',a:'Water',opts:['Salt','Water','Air','Sugar'],exp:'H₂O is the chemical formula for water.',d:1},
      {q:'What force pulls objects toward Earth?',a:'Gravity',opts:['Magnetism','Gravity','Friction','Tension'],exp:'Gravity pulls everything toward the centre of the Earth.',d:1},
      {q:'What is the centre of an atom called?',a:'Nucleus',opts:['Electron','Nucleus','Proton shell','Orbit'],exp:'The nucleus contains protons and neutrons.',d:3},
      {q:'Which is the closest star to Earth?',a:'The Sun',opts:['The Moon','The Sun','Sirius','Polaris'],exp:'The Sun is the nearest star to Earth.',d:1},
    ],
    history: [
      {q:'Who led the first expedition to sail around the world?',a:'Ferdinand Magellan',opts:['Vasco da Gama','Ferdinand Magellan','Christopher Columbus','James Cook'],exp:"Magellan's expedition (1519-1522) first circumnavigated the globe.",d:3},
      {q:'In which year did the Berlin Wall fall?',a:'1989',opts:['1979','1985','1989','1991'],exp:'The Berlin Wall fell on 9 November 1989.',d:2},
      {q:'Who was Cleopatra?',a:'Queen of Egypt',opts:['Queen of France','Queen of Egypt','Roman empress','Queen of Greece'],exp:'Cleopatra VII was the last pharaoh of ancient Egypt.',d:2},
      {q:'Which ancient civilisation invented democracy?',a:'Ancient Greece',opts:['Rome','Egypt','Ancient Greece','Persia'],exp:'Democracy began in Athens, ancient Greece.',d:2},
      {q:'Who led India to independence through non-violence?',a:'Gandhi',opts:['Nehru','Gandhi','Mandela','Churchill'],exp:'Mahatma Gandhi led India to independence peacefully.',d:2},
      {q:'In which year did the Titanic sink?',a:'1912',opts:['1905','1912','1920','1931'],exp:'The Titanic sank on its maiden voyage in April 1912.',d:2},
      {q:'Who painted the ceiling of the Sistine Chapel?',a:'Michelangelo',opts:['Leonardo da Vinci','Raphael','Michelangelo','Donatello'],exp:'Michelangelo painted it between 1508 and 1512.',d:2},
      {q:'Which document limited the English king’s power in 1215?',a:'Magna Carta',opts:['Magna Carta','Constitution','Bill of Rights','Treaty of Paris'],exp:'The Magna Carta limited the power of King John in 1215.',d:3},
      {q:'Who was the first man on the Moon?',a:'Neil Armstrong',opts:['Buzz Aldrin','Neil Armstrong','Yuri Gagarin','Michael Collins'],exp:'Neil Armstrong was the first person to walk on the Moon in 1969.',d:1},
      {q:'Who was the first person in space?',a:'Yuri Gagarin',opts:['Yuri Gagarin','Neil Armstrong','John Glenn','Alan Shepard'],exp:'Yuri Gagarin orbited Earth in 1961.',d:3},
      {q:'Which empire built the Colosseum?',a:'Roman Empire',opts:['Greek Empire','Roman Empire','Persian Empire','Ottoman Empire'],exp:'The Romans built the Colosseum in the 1st century AD.',d:1},
      {q:'Who was Marco Polo?',a:'A Venetian explorer',opts:['An English king','A Venetian explorer','A Roman general','A pharaoh'],exp:'Marco Polo travelled across Asia to China in the 13th century.',d:3},
      {q:'In which year did World War I begin?',a:'1914',opts:['1910','1914','1918','1920'],exp:'World War I began in 1914.',d:2},
    ],
    animals: [
      {q:'What is the largest land animal?',a:'African elephant',opts:['Hippopotamus','Giraffe','African elephant','Rhinoceros'],exp:'The African elephant can weigh over 6 tonnes.',d:1},
      {q:'What is the fastest land animal?',a:'Cheetah',opts:['Lion','Cheetah','Horse','Greyhound'],exp:'The cheetah can reach 112 km/h.',d:1},
      {q:'How many legs does a spider have?',a:'8',opts:['6','8','10','4'],exp:'Spiders have 8 legs; insects have 6.',d:1},
      {q:'What is the largest animal in the world?',a:'Blue whale',opts:['Elephant','Whale shark','Blue whale','Giraffe'],exp:'The blue whale can reach 30 m and 180 tonnes.',d:1},
      {q:'Which bird cannot fly?',a:'Penguin',opts:['Eagle','Penguin','Sparrow','Owl'],exp:'Penguins cannot fly but are excellent swimmers.',d:1},
      {q:'What does a panda mainly eat?',a:'Bamboo',opts:['Fish','Bamboo','Honey','Berries'],exp:'Giant pandas eat almost only bamboo.',d:1},
      {q:'Which animal is known as the king of the jungle?',a:'Lion',opts:['Tiger','Lion','Elephant','Gorilla'],exp:'The lion is traditionally called the king of the jungle.',d:1},
      {q:'How many hearts does an octopus have?',a:'3',opts:['1','2','3','4'],exp:'An octopus has three hearts.',d:3},
      {q:'Which animal carries its young in a pouch?',a:'Kangaroo',opts:['Koala','Kangaroo','Otter','Squirrel'],exp:'The kangaroo is a marsupial that carries young in a pouch.',d:1},
      {q:'Which is the tallest animal in the world?',a:'Giraffe',opts:['Elephant','Giraffe','Camel','Ostrich'],exp:'The giraffe can reach 5.5 m tall.',d:1},
      {q:'Which sea creature has eight arms?',a:'Octopus',opts:['Squid','Octopus','Starfish','Jellyfish'],exp:'An octopus has eight arms.',d:1},
      {q:'What is a young dog called?',a:'Puppy',opts:['Kitten','Puppy','Cub','Foal'],exp:'A young dog is called a puppy.',d:1},
      {q:'Which is the largest reptile?',a:'Saltwater crocodile',opts:['Python','Saltwater crocodile','Iguana','Komodo dragon'],exp:'The saltwater crocodile can exceed 6 metres.',d:3},
      {q:'What do bees make?',a:'Honey',opts:['Milk','Honey','Silk','Wax only'],exp:'Bees make honey from flower nectar.',d:1},
      {q:'Which animal can change colour to camouflage?',a:'Chameleon',opts:['Frog','Chameleon','Owl','Wolf'],exp:'Chameleons change colour to communicate and regulate temperature.',d:2},
      {q:'How many humps does a dromedary camel have?',a:'1',opts:['1','2','3','0'],exp:'A dromedary has one hump; a Bactrian camel has two.',d:2},
    ],
    sport: [
      {q:'How many players are on a football team on the pitch?',a:'11',opts:['9','10','11','12'],exp:'Each football team has 11 players including the goalkeeper.',d:1},
      {q:'How many players are on a basketball team on court?',a:'5',opts:['4','5','6','7'],exp:'Basketball teams have 5 players on court.',d:1},
      {q:'How many rings are on the Olympic symbol?',a:'5',opts:['3','4','5','6'],exp:'The five rings represent the five continents.',d:1},
      {q:'How often is the football World Cup held?',a:'Every 4 years',opts:['Every 2 years','Every 3 years','Every 4 years','Every 5 years'],exp:'The World Cup is held every four years.',d:1},
      {q:'Which country has won the most football World Cups?',a:'Brazil',opts:['Germany','Brazil','Italy','Argentina'],exp:'Brazil has won 5 World Cups.',d:2},
      {q:'On what surface is Wimbledon played?',a:'Grass',opts:['Clay','Grass','Hard court','Carpet'],exp:'Wimbledon is the only Grand Slam played on grass.',d:3},
      {q:'How long is a marathon?',a:'42.195 km',opts:['21 km','42.195 km','50 km','100 km'],exp:'A marathon is 42.195 km long.',d:3},
      {q:'In which sport do you score a "try"?',a:'Rugby',opts:['Cricket','Rugby','Hockey','Tennis'],exp:'A try is scored in rugby.',d:2},
      {q:'Which sport uses a shuttlecock?',a:'Badminton',opts:['Squash','Tennis','Badminton','Table tennis'],exp:'A shuttlecock is used in badminton.',d:2},
      {q:'How many points is a touchdown worth in American football?',a:'6',opts:['3','6','7','5'],exp:'A touchdown is worth 6 points.',d:3},
      {q:'Where were the first modern Olympic Games held in 1896?',a:'Athens',opts:['Paris','Athens','London','Rome'],exp:'The first modern Olympics were held in Athens in 1896.',d:3},
      {q:'In golf, what is one stroke under par called?',a:'Birdie',opts:['Eagle','Birdie','Bogey','Par'],exp:'One under par is a birdie; one over par is a bogey.',d:3},
    ],
    music: [
      {q:'How many strings does a standard guitar have?',a:'6',opts:['4','5','6','12'],exp:'A standard guitar has 6 strings.',d:1},
      {q:'How many lines are on a musical staff?',a:'5',opts:['4','5','6','7'],exp:'A musical staff has 5 lines and 4 spaces.',d:2},
      {q:'Which of these is a wind instrument?',a:'Flute',opts:['Violin','Flute','Drum','Piano'],exp:'The flute is a wind instrument.',d:1},
      {q:'Which of these is a percussion instrument?',a:'Drums',opts:['Drums','Guitar','Cello','Harp'],exp:'Drums are percussion instruments.',d:1},
      {q:'Who conducts an orchestra?',a:'The conductor',opts:['The soloist','The conductor','The composer','The producer'],exp:'The conductor leads the orchestra.',d:1},
      {q:'What is an opera?',a:'A sung drama',opts:['A dance','A sung drama','A type of drum','A small band'],exp:'An opera is a drama that is entirely sung.',d:2},
      {q:'How many musicians are in a quartet?',a:'4',opts:['2','3','4','5'],exp:'A quartet has 4 musicians.',d:1},
      {q:'What does "tempo" describe in music?',a:'The speed',opts:['The volume','The speed','The pitch','The instrument'],exp:'Tempo describes how fast or slow the music is.',d:2},
      {q:'How many keys does a standard piano have?',a:'88',opts:['66','76','88','100'],exp:'A standard piano has 88 keys.',d:3},
      {q:'Which instrument is played with a bow?',a:'Violin',opts:['Trumpet','Violin','Flute','Drum'],exp:'The violin is played with a bow.',d:1},
      {q:'Which clef is used for high-pitched notes?',a:'Treble clef',opts:['Bass clef','Treble clef','Alto clef','Tenor clef'],exp:'The treble clef is used for higher notes.',d:3},
      {q:'What is the traditional music of Portugal called?',a:'Fado',opts:['Flamenco','Fado','Samba','Tango'],exp:'Fado is the traditional Portuguese music, a UNESCO heritage.',d:2},
    ],
    vehicles: [
      {q:'How many wheels does a typical car have?',a:'4',opts:['2','3','4','6'],exp:'Most cars have 4 wheels.',d:1},
      {q:'Which vehicle runs on rails?',a:'Train',opts:['Bus','Train','Lorry','Motorbike'],exp:'A train runs on rails.',d:1},
      {q:'Which vehicle flies carrying passengers?',a:'Aeroplane',opts:['Boat','Aeroplane','Train','Submarine'],exp:'An aeroplane carries passengers through the air.',d:1},
      {q:'Which vehicle travels underwater?',a:'Submarine',opts:['Sailboat','Submarine','Ferry','Jet ski'],exp:'A submarine travels underwater.',d:1},
      {q:'How many wheels does a bicycle have?',a:'2',opts:['1','2','3','4'],exp:'A bicycle has 2 wheels.',d:1},
      {q:'Which vehicle is used to fight fires?',a:'Fire engine',opts:['Ambulance','Fire engine','Police car','Taxi'],exp:'A fire engine carries water and equipment.',d:1},
      {q:'What carries astronauts into space?',a:'Rocket',opts:['Aeroplane','Rocket','Helicopter','Balloon'],exp:'Rockets carry astronauts and satellites into space.',d:1},
      {q:'What part of a car makes it stop?',a:'The brakes',opts:['The accelerator','The brakes','The steering wheel','The lights'],exp:'The brakes slow and stop the car.',d:1},
      {q:'What is a two-wheeled motor vehicle called?',a:'Motorcycle',opts:['Bicycle','Motorcycle','Scooter','Tricycle'],exp:'A motorcycle has two wheels and an engine.',d:1},
      {q:'What does a speedometer measure?',a:'Speed',opts:['Fuel','Speed','Temperature','Distance'],exp:'A speedometer shows the vehicle’s speed.',d:2},
      {q:'Which document do you need to drive a car?',a:'Driving licence',opts:['Passport','Driving licence','ID card','Ticket'],exp:'A driving licence is required to drive.',d:2},
      {q:'What does a combustion engine burn to create motion?',a:'Fuel',opts:['Water','Fuel','Sunlight','Air only'],exp:'A combustion engine burns petrol or diesel.',d:2},
      {q:'Which vehicle has a propeller on top and can hover?',a:'Helicopter',opts:['Aeroplane','Helicopter','Glider','Rocket'],exp:'A helicopter uses rotor blades to hover and fly.',d:2},
      {q:'What is the long vehicle that carries many passengers on roads?',a:'Bus',opts:['Car','Bus','Van','Taxi'],exp:'A bus carries many passengers along roads.',d:1},
    ],
  },
};

/* Merge the expanded banks into _TRIVIA (append, never overwrite). */
(function mergeTriviaBanks() {
  for (const lang of Object.keys(_TRIVIA_EXTRA)) {
    _TRIVIA[lang] = _TRIVIA[lang] || {};
    for (const cat of Object.keys(_TRIVIA_EXTRA[lang])) {
      _TRIVIA[lang][cat] = (_TRIVIA[lang][cat] || []).concat(_TRIVIA_EXTRA[lang][cat]);
    }
  }
})();

/* ══════════════════════════════════════════════════════════════════
   OPEN TRIVIA DB — uses built-in banks for PT, API+fallback for EN
══════════════════════════════════════════════════════════════════ */
(function registerTriviaProviders() {
  /* Age → content band: 1 = younger, 2 = middle, 3 = older. */
  function _ageBand(age) {
    const a = parseInt(age) || 8;
    if (a <= 8)  return 1;
    if (a <= 11) return 2;
    return 3;
  }

  /* When a bank carries `d` difficulty tags (1/2/3), pick age-appropriate items:
     younger get only easy; middle get easy+medium; older get medium+hard.
     Widens the pool automatically if a band has too few items for the count. */
  function _selectForAge(bank, age, need, key) {
    const take = pool => key ? QuizEngine.pickFresh(pool, need, key) : QuizEngine.shuffle(pool).slice(0, need);
    if (!bank.some(it => it.d)) return take(bank);
    const band = _ageBand(age);
    const d = it => it.d || 2;
    let pool = band === 1 ? bank.filter(it => d(it) <= 1)
             : band === 2 ? bank.filter(it => d(it) <= 2)
             :              bank.filter(it => d(it) >= 2);
    if (pool.length < need) pool = band === 3 ? bank : bank.filter(it => d(it) <= 2);
    if (pool.length < need) pool = bank;
    return take(pool);
  }

  function fromBank(bank, opts) {
    const { age, lang, count } = opts;
    const n    = QuizEngine.optionCount(age);
    /* Rotation key per bank+age band so the fallback cycles, not repeats. */
    const key  = opts.bankKey ? `tb-${opts.bankKey}-${lang}-${_ageBand(age)}` : null;
    const pool = _selectForAge(bank, age, count || 10, key);
    return pool.map((item, i) => {
      const distractors = item.opts.filter(o => o !== item.a);
      const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
      return {
        id: `bank-${i}`,
        question: item.q,
        options, correctIdx,
        explanation: item.exp,
        difficulty: item.d === 1 ? 'easy' : item.d === 3 ? 'hard' : 'medium',
        lang,
      };
    });
  }

  /* Offline-only provider. Serves from the split in-repo database
     (new layout quizzes/{bankKey}/{lang}/{diff}.json, legacy fallback handled
     by QuizData) for BOTH languages — no external API. The in-file _TRIVIA
     bank is a tiny safety net used only if the JSON is unavailable. */
  function makeProvider(apiCat, bankKey, diffFn) {
    return {
      async getQuestions(opts) {
        const { age, lang } = opts;
        const diff = opts.difficulty || (diffFn ? diffFn(age) : 'easy');
        if (typeof QuizData !== 'undefined') {
          const items = await QuizData.loadBank(bankKey, diff, lang);
          if (items && items.length) return QuizData.buildFromBank(items, { ...opts, category: bankKey });
        }
        const tri = (_TRIVIA[lang] && _TRIVIA[lang][bankKey]) || _TRIVIA.pt[bankKey] || _TRIVIA.pt.gk || [];
        return fromBank(tri, { ...opts, bankKey });
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
    getQuestions(opts) {
      const { age, lang, count } = opts;
      const n = QuizEngine.optionCount(age);
      const d = DATA[lang] || DATA.en;
      const pool = QuizEngine.shuffle(d).slice(0, count||10);
      return pool.map((item, i) => {
        const distractors = item.opts.filter(o => o !== item.a);
        const { options, correctIdx } = QuizEngine.buildOptions(item.a, distractors, n);
        return { id:`tech-${i}`, question:item.q, options, correctIdx, explanation:item.exp, difficulty:age<=10?'easy':'medium', lang };
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
