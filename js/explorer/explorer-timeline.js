/* ══════════════════════════════════════════════════════════════════
   TIMELINE EXPLORER — Scrollytelling cinematográfico (Linha do Tempo)
   Uma viagem do Big Bang ao presente: capítulos em ecrã inteiro, fundos
   temáticos com crossfade + parallax, revelação progressiva. Toda a arte
   é gerada localmente (SVG/CSS) — offline, sem dependências nem copyright.
   Os eventos vêm de data/timeline.json (nada hardcoded no código).
══════════════════════════════════════════════════════════════════ */
const TimelineExplorer = (function () {
  'use strict';

  let _data = null, _loaded = false, _root = null, _scroll = null, _fixed = null;
  let _scenes = [], _hint = null, _active = -1, _raf = 0, _ro = null, _io = null, _lastFocus = null, _escBound = false;

  function _lang() { return typeof I18n !== 'undefined' ? I18n.getLang() : 'pt'; }
  function _t(en, pt) { return _lang() === 'en' ? en : pt; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const nf = n => n.toLocaleString(_lang() === 'en' ? 'en' : 'pt-PT');
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const PRESENT = new Date().getFullYear();

  let CATS = {};
  function _buildCats() {
    CATS = {
      universo: { emoji:'🌌', label:_t('Universe','Universo'),               color:'#8b5cf6' },
      solar:    { emoji:'☀️', label:_t('Solar System','Sistema Solar'),       color:'#f59e0b' },
      terra:    { emoji:'🌍', label:_t('Earth','Terra'),                     color:'#3b82f6' },
      vida:     { emoji:'🦠', label:_t('Life','Vida'),                       color:'#10b981' },
      dinos:    { emoji:'🦕', label:_t('Dinosaurs','Dinossauros'),           color:'#84cc16' },
      humana:   { emoji:'🦣', label:_t('Human evolution','Evolução Humana'), color:'#d97706' },
      civil:    { emoji:'🏺', label:_t('Ancient civilisations','Civilizações Antigas'), color:'#eab308' },
      mundial:  { emoji:'⚔️', label:_t('World history','História Mundial'),   color:'#ef4444' },
      portugal: { emoji:'🇵🇹', label:'Portugal',                             color:'#16a34a' },
      espaco:   { emoji:'🚀', label:_t('Space','Espaço'),                    color:'#06b6d4' },
      tech:     { emoji:'💻', label:_t('Technology','Tecnologia'),           color:'#6366f1' },
      medicina: { emoji:'🧬', label:_t('Medicine','Medicina'),              color:'#ec4899' },
      ambiente: { emoji:'🌱', label:_t('Environment','Ambiente'),            color:'#14b8a6' },
      cultura:  { emoji:'🎨', label:_t('Culture','Cultura'),                color:'#a855f7' },
    };
  }
  const cat = e => CATS[e.cat] || { emoji:'•', label:'', color:'#6366f1' };

  function agoStr(y) {
    const a = PRESENT - y;
    if (a >= 1e9) return _t('', 'há ') + (a / 1e9).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) + _t(' billion years ago', ' mil milhões de anos');
    if (a >= 1e6) return _t('', 'há ') + Math.round(a / 1e6).toLocaleString('pt-PT') + _t(' million years ago', ' milhões de anos');
    if (a >= 1e4) return _t('', 'há ') + Math.round(a / 1e3).toLocaleString('pt-PT') + _t(' thousand years ago', ' mil anos');
    if (a > 1) return _t('', 'há ') + nf(a) + _t(' years ago', ' anos');
    if (a === 1) return _t('1 year ago', 'há 1 ano');
    return _t('this year', 'este ano');
  }
  function cardDate(y) {
    if (y < -10000) return agoStr(y);
    if (y < 0) return nf(Math.abs(y)) + ' ' + _t('BCE', 'a.C.');
    return String(y);
  }

  /* ── generated event thumbnail (vector, offline) ── */
  function _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function _rng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }
  function _starsMarkup(rnd, n, w, h) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${(rnd() * 1.3 + 0.4).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.6 + 0.2).toFixed(2)}"/>`;
    return s;
  }
  function _motif(c, color) {
    const W = 'rgba(255,255,255,.92)', S = 'rgba(255,255,255,.6)';
    switch (c) {
      case 'universo': { let g = ''; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g += `<line x1="160" y1="72" x2="${(160 + Math.cos(a) * 60).toFixed(0)}" y2="${(72 + Math.sin(a) * 46).toFixed(0)}" stroke="${color}" stroke-width="2" opacity=".5"/>`; } return `${g}<circle cx="160" cy="72" r="16" fill="#fff"/><circle cx="160" cy="72" r="30" fill="none" stroke="${W}" stroke-width="1.5" opacity=".5"/>`; }
      case 'solar': return `<circle cx="86" cy="72" r="26" fill="${color}"/><ellipse cx="86" cy="72" rx="120" ry="40" fill="none" stroke="${S}" stroke-width="1.5"/><ellipse cx="86" cy="72" rx="86" ry="28" fill="none" stroke="${S}" stroke-width="1.5"/><circle cx="206" cy="72" r="9" fill="${W}"/><circle cx="150" cy="46" r="5" fill="${W}"/>`;
      case 'terra': return `<circle cx="160" cy="72" r="46" fill="${color}"/><path d="M130 62 q14 -10 26 -2 q12 8 4 16 q-12 8 -24 2 q-12 -6 -6 -16Z" fill="${W}" opacity=".85"/><path d="M170 84 q12 -4 18 4 q4 8 -6 12 q-12 2 -16 -6Z" fill="${W}" opacity=".8"/>`;
      case 'vida': return `<circle cx="160" cy="72" r="44" fill="none" stroke="${W}" stroke-width="3"/><circle cx="160" cy="72" r="16" fill="${color}"/><circle cx="138" cy="56" r="5" fill="${W}"/><circle cx="184" cy="64" r="6" fill="${W}"/><circle cx="150" cy="92" r="5" fill="${W}"/>`;
      case 'dinos': return `<path d="M70 110 q4 -34 30 -40 q6 -28 30 -30 q-6 12 2 18 q16 2 22 16 q14 2 22 16 l16 4 q-8 8 -18 4 q4 14 -8 18 l-4 -14 q-10 6 -18 0 l-2 12 q-10 0 -10 -10 q-26 4 -34 -10 q-12 4 -16 18Z" fill="${W}"/><circle cx="120" cy="48" r="3" fill="${color}"/>`;
      case 'humana': return `<circle cx="160" cy="40" r="12" fill="${W}"/><path d="M160 54 q14 4 14 24 l-4 26 q8 14 4 22 l-8 -2 l-4 -22 l-4 22 l-8 2 q-4 -8 4 -22 l-4 -26 q0 -20 14 -24Z" fill="${W}"/>`;
      case 'civil': return `<path d="M70 50 L160 30 L250 50 Z" fill="${W}"/><rect x="74" y="50" width="172" height="8" fill="${W}"/>${[0,1,2,3,4].map(i=>`<rect x="${84+i*36}" y="60" width="14" height="46" fill="${S}"/>`).join('')}<rect x="70" y="106" width="180" height="9" fill="${W}"/>`;
      case 'mundial': return `<circle cx="120" cy="72" r="40" fill="none" stroke="${W}" stroke-width="3"/><ellipse cx="120" cy="72" rx="18" ry="40" fill="none" stroke="${S}" stroke-width="2"/><line x1="80" y1="72" x2="160" y2="72" stroke="${S}" stroke-width="2"/><rect x="176" y="40" width="6" height="70" fill="${W}"/><path d="M182 44 l44 8 l-44 12Z" fill="${color}"/>`;
      case 'portugal': return `<path d="M60 96 q40 12 100 0 t100 0 v8 q-60 14 -100 2 t-100 -2Z" fill="${color}" opacity=".6"/><path d="M120 96 L200 96 L188 76 L132 76Z" fill="${W}"/><rect x="158" y="34" width="4" height="44" fill="${W}"/><path d="M162 38 q34 8 0 30Z" fill="${W}"/>`;
      case 'espaco': return `<path d="M160 26 q20 26 18 58 l-8 18 h-20 l-8 -18 q-2 -32 18 -58Z" fill="${W}"/><circle cx="160" cy="60" r="8" fill="${color}"/><path d="M142 84 l-16 18 l18 -4Z" fill="${S}"/><path d="M178 84 l16 18 l-18 -4Z" fill="${S}"/><path d="M150 102 q10 22 20 0 q-6 14 -10 22 q-4 -8 -10 -22Z" fill="${color}"/>`;
      case 'tech': return `<rect x="118" y="40" width="84" height="64" rx="6" fill="none" stroke="${W}" stroke-width="3"/><rect x="138" y="60" width="44" height="24" rx="3" fill="${color}"/>`;
      case 'medicina': { let r = ''; for (let i = 0; i <= 6; i++) { const y = 36 + i * 11; r += `<line x1="${(160 - Math.sin(i) * 22).toFixed(0)}" y1="${y}" x2="${(160 + Math.sin(i) * 22).toFixed(0)}" y2="${y}" stroke="${S}" stroke-width="2"/>`; } return `<path d="M138 36 q44 18 0 72" fill="none" stroke="${W}" stroke-width="3"/><path d="M182 36 q-44 18 0 72" fill="none" stroke="${color}" stroke-width="3"/>${r}`; }
      case 'ambiente': return `<path d="M160 30 q44 18 30 56 q-12 30 -30 30 q-18 0 -30 -30 q-14 -38 30 -56Z" fill="${color}"/><path d="M160 36 V112" stroke="${W}" stroke-width="2"/>`;
      case 'cultura': return `<path d="M160 36 q56 0 56 40 q0 18 -22 18 q-14 0 -14 12 q0 12 -20 12 q-56 0 -56 -50 q0 -44 56 -44Z" fill="${W}"/><circle cx="138" cy="60" r="6" fill="#ef4444"/><circle cx="166" cy="52" r="6" fill="#f59e0b"/><circle cx="190" cy="64" r="6" fill="#3b82f6"/>`;
      default: return `<circle cx="160" cy="72" r="34" fill="${color}"/>`;
    }
  }
  function artSVG(e) {
    const c = cat(e), seed = _hash(e.id), rnd = _rng(seed + 7), id = 'a' + seed;
    return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.color}" stop-opacity=".5"/><stop offset="1" stop-color="#080a14"/></linearGradient></defs>
      <rect width="320" height="150" fill="url(#${id})"/>${_starsMarkup(rnd, 22, 320, 150)}${_motif(e.cat, c.color)}</svg>`;
  }

  /* ── Wikipedia link (static; no fetch) ── */
  const WIKI = {
    'primeiras-particulas':'Nucleossíntese primordial','primeiros-atomos':'Recombinação (cosmologia)','primeiras-estrelas':'População estelar','primeiras-galaxias':'Formação e evolução de galáxias','via-lactea':'Via Láctea','formacao-sol':'Sol','sistema-solar':'Sistema Solar','formacao-planetas':'Formação e evolução do Sistema Solar','formacao-asteroides':'Cintura de asteroides','formacao-cometas':'Cometa','formacao-luas-anoes':'Planeta anão','formacao-terra':'Terra','formacao-lua':'Lua','formacao-atmosfera':'Atmosfera terrestre','formacao-oceanos':'Oceano','primeiros-continentes':'Crosta continental','rodinia':'Rodínia','pangeia':'Pangeia','separacao-continentes':'Deriva continental','extincoes':'Extinção Permiano-Triássica','idades-gelo':'Idade do gelo','primeira-vida':'Origem da vida','bacterias':'Bactéria','fotossintese':'Fotossíntese','grande-oxidacao':'Grande Evento de Oxigenação','multicelulares':'Organismo multicelular','cambriana':'Explosão cambriana','primeiros-peixes':'Peixe','primeiras-plantas':'Planta','insetos':'Inseto','anfibios':'Anfíbio','repteis':'Réptil','primeiros-dinossauros':'Dinossauro','primeiros-mamiferos':'Mamífero','grandes-sauropodes':'Sauropoda','primeiras-aves':'Archaeopteryx','t-rex':'Tyrannosaurus','triceratops':'Triceratops','velociraptor':'Velociraptor','extincao-dinos':'Extinção do Cretáceo-Paleogeno','australopithecus':'Australopithecus','homo-habilis':'Homo habilis','homo-erectus':'Homo erectus','neandertais':'Homem de Neandertal','homo-sapiens':'Homo sapiens','arte-rupestre':'Arte rupestre','mesopotamia':'Mesopotâmia','sumeria':'Suméria','egipto':'Antigo Egito','piramides':'Pirâmides do Egito','babilonia':'Babilônia','fenicios':'Fenícios','grecia':'Grécia Antiga','partenon':'Partenon','persas':'Império Aquemênida','china-antiga':'Dinastia Qin','imperio-romano':'Império Romano','coliseu':'Coliseu','maia':'Civilização maia','inca':'Império Inca','asteca':'Astecas','escrita':'História da escrita','papel':'Papel','medicina-antiga':'Trepanação','queda-roma':'Queda do Império Romano do Ocidente','idade-media':'Idade Média','cruzadas':'Cruzada','renascimento':'Renascimento','imprensa':'Imprensa','mona-lisa':'Mona Lisa','descobrimentos':'Era dos descobrimentos','reforma':'Reforma Protestante','revolucao-cientifica':'Revolução Científica','revolucao-industrial':'Revolução Industrial','primeira-guerra':'Primeira Guerra Mundial','segunda-guerra':'Segunda Guerra Mundial','guerra-fria':'Guerra Fria','muro-berlim':'Queda do Muro de Berlim','fundacao-portugal':'Tratado de Zamora','sao-mamede':'Batalha de São Mamede','aljubarrota':'Batalha de Aljubarrota','conquista-ceuta':'Conquista de Ceuta','descobrimentos-pt':'Descobrimentos portugueses','chegada-india':'Vasco da Gama','chegada-brasil':'Descobrimento do Brasil','restauracao':'Restauração da Independência','terramoto-1755':'Sismo de Lisboa de 1755','invasoes-francesas':'Invasões Francesas','republica':'Implantação da República Portuguesa','estado-novo':'Estado Novo (Portugal)','25-abril':'Revolução dos Cravos','adesao-cee':'União Europeia','euro-pt':'Euro','sputnik':'Sputnik 1','gagarin':'Iuri Gagarin','apollo-11':'Apollo 11','voyager-1':'Voyager 1','voyager-2':'Voyager 2','space-shuttle':'Ônibus espacial','iss':'Estação Espacial Internacional','curiosity':'Curiosity','perseverance':'Perseverance (sonda)','jwst':'Telescópio espacial James Webb','maquina-vapor':'Máquina a vapor','eletricidade':'Lâmpada incandescente','telefone':'Telefone','radio':'Rádio (comunicação)','automovel':'Automóvel','aviao':'Avião','televisao':'Televisão','computador':'Computador','internet':'Internet','www':'World Wide Web','smartphone':'Smartphone','ia':'Inteligência artificial','variola':'Varíola','microrganismos':'Louis Pasteur','penicilina':'Penicilina','adn':'Ácido desoxirribonucleico','genoma':'Projeto Genoma Humano','vacinas-mrna':'Vacina de RNA','pequena-idade-gelo':'Pequena Idade do Gelo','co2':'Dióxido de carbono','acordo-paris':'Acordo de Paris','clima-extremo':'Eventos climáticos extremos','cinema':'Cinema','streaming':'Streaming',
  };
  const wikiUrl = e => 'https://pt.wikipedia.org/wiki/' + encodeURIComponent((e.wiki || WIKI[e.id] || e.title).replace(/ /g, '_'));

  /* ── chapters (narrative groupings). Events come from the dataset. ── */
  function _CHAPTERS() {
    return [
      { id:'bigbang',  theme:'bigbang',     emoji:'💥', title:_t('The Big Bang','O Big Bang'),                   scale:_t('13.8 billion years ago','há 13,8 mil milhões de anos'),  lead:_t('Space, time and matter did not exist — everything sprang from a single incandescent instant. In a fraction of a second the Universe inflated and began to cool, and the first particles emerged from that energy. It is the zero point of all history: without it, nothing that follows would exist.','Não existia espaço, tempo nem matéria — tudo surgiu de um único instante incandescente. Numa fração de segundo o Universo inflacionou e começou a arrefecer, e dessa energia nasceram as primeiras partículas. É o ponto zero de toda a história: sem ele, nada do que se segue existiria.') },
      { id:'stars',    theme:'galaxy',      emoji:'✨', title:_t('First stars & galaxies','As primeiras estrelas e galáxias'), scale:_t('13.6 billion years ago','há 13,6 mil milhões de anos'), lead:_t('For millions of years the Universe was dark — just hydrogen and helium. Gravity pulled that gas together until the first stars ignited, forging in their cores the elements we are made of. As they died they scattered those atoms across the cosmos and gathered into galaxies — among them, our Milky Way.','Durante milhões de anos o Universo foi escuro, apenas hidrogénio e hélio. A gravidade juntou esse gás até acender as primeiras estrelas, que forjaram nos seus núcleos os elementos de que somos feitos. Ao morrerem, espalharam esses átomos pelo cosmos e agruparam-se em galáxias — entre elas, a nossa Via Láctea.') },
      { id:'solar',    theme:'solar',       emoji:'☀️', title:_t('The Solar System','O Sistema Solar'),           scale:_t('4.6 billion years ago','há 4,6 mil milhões de anos'),    lead:_t('A cloud of gas and dust collapsed and lit up the Sun. Around it, the leftovers formed a disc where dust stuck into rocks, and rocks into planets. In this chaotic cradle the Earth found its place — at just the right distance to one day hold liquid water.','Uma nuvem de gás e poeira colapsou e acendeu o Sol. À sua volta, os restos formaram um disco onde a poeira se colou em pedras, e as pedras em planetas. Foi neste berço caótico que a Terra ganhou o seu lugar, à distância certa para um dia ter água líquida.') },
      { id:'terra',    theme:'terra',       emoji:'🌍', title:_t('The young Earth','A Terra jovem'),              scale:_t('4.5 billion years ago','há 4,5 mil milhões de anos'),    lead:_t('Earth was born a hell of molten rock, bombarded by asteroids. One such collision, with a Mars-sized world, blasted out the debris that became the Moon. As it cooled, vapour condensed into rain that fell for millennia and filled the first oceans — the stage where life would begin.','A Terra nasceu um inferno de rocha fundida, bombardeada por asteroides. Uma dessas colisões, com um planeta do tamanho de Marte, arrancou os destroços que formaram a Lua. Ao arrefecer, o vapor condensou-se em chuva que caiu durante milénios e encheu os primeiros oceanos — o palco onde a vida iria começar.') },
      { id:'vida',     theme:'ocean',       emoji:'🦠', title:_t('The first life','A primeira vida'),             scale:_t('3.8 billion years ago','há 3,8 mil milhões de anos'),    lead:_t('In the primitive oceans, simple molecules organised into something able to copy itself: life. For billions of years it stayed microscopic, but microbes invented photosynthesis and began releasing oxygen. That gas, toxic to almost everything alive, transformed the planet’s atmosphere forever.','Nos oceanos primitivos, moléculas simples organizaram-se em algo capaz de se copiar: a vida. Durante milhares de milhões de anos foi apenas microscópica, mas micróbios inventaram a fotossíntese e começaram a libertar oxigénio. Esse gás, tóxico para quase tudo o que existia, transformou para sempre a atmosfera do planeta.') },
      { id:'cambrico', theme:'reef',        emoji:'🐚', title:_t('Life explodes','A explosão da vida'),           scale:_t('541 million years ago','há 541 milhões de anos'),       lead:_t('In a geological blink, life diversified in an explosion of forms. Eyes, shells, skeletons and the first hunters appeared. Animals crawled out of the water, plants covered the land, and the world filled with visible life.','Num piscar de olhos geológico, a vida diversificou-se numa explosão de formas. Surgiram olhos, conchas, esqueletos e os primeiros caçadores. Os animais saíram da água, as plantas cobriram a terra, e o mundo encheu-se de vida visível.') },
      { id:'dinos',    theme:'jungle',      emoji:'🦕', title:_t('Age of dinosaurs','A era dos dinossauros'),     scale:_t('230–66 million years ago','há 230 a 66 milhões de anos'), lead:_t('After the greatest extinction ever, reptiles rose and gave way to the dinosaurs, who reigned for over 160 million years — some evolving into today’s birds. Their reign ended suddenly 66 million years ago when an asteroid struck, opening the way for the mammals.','Após a maior extinção de sempre, os répteis ergueram-se e deram origem aos dinossauros, que reinaram mais de 160 milhões de anos — alguns evoluindo para as aves de hoje. O seu reinado acabou de repente, há 66 milhões de anos, quando um asteroide embateu, abrindo caminho aos mamíferos.') },
      { id:'humana',   theme:'savanna',     emoji:'🦣', title:_t('The rise of humans','A ascensão humana'),       scale:_t('3 million – 300 000 years ago','há 3 milhões – 300 mil anos'), lead:_t('Small and nocturnal under the dinosaurs, mammals inherited the world after the extinction. In Africa, some primates began to walk upright, make tools and tame fire. Around 300,000 years ago came Homo sapiens — a species able to imagine, speak and tell stories like this one.','Pequenos e noturnos sob os dinossauros, os mamíferos herdaram o mundo depois da extinção. Em África, alguns primatas começaram a andar erguidos, a fazer ferramentas e a dominar o fogo. Há cerca de 300 mil anos surgiu o Homo sapiens — uma espécie capaz de imaginar, falar e contar histórias como esta.') },
      { id:'civil',    theme:'desert',      emoji:'🏺', title:_t('First civilisations','As primeiras civilizações'), scale:_t('5000 – 1500 years ago','há 5 000 – 1 500 anos'),       lead:_t('When humans learned to farm, they could settle and build the first cities. With them came writing, laws, empires and organised religion. From Mesopotamia and Egypt to Greece and Rome were born ideas — democracy, philosophy, law — that still shape the world today.','Quando os humanos aprenderam a cultivar a terra, puderam fixar-se e construir as primeiras cidades. Com elas vieram a escrita, as leis, os impérios e a religião organizada. Da Mesopotâmia e do Egito à Grécia e a Roma nasceram ideias — democracia, filosofia, direito — que ainda hoje moldam o mundo.') },
      { id:'portugal', theme:'discovery',   emoji:'🇵🇹', title:'Portugal',                                         scale:_t('since 1143','desde 1143'),                              lead:_t('On Europe’s western edge, one of the first nation-states formed in the 12th century. Small and facing the sea, Portugal launched into ocean exploration and opened sea routes that connected the continents for the first time. That daring brought glory and tragedy, and left its mark — in language and culture — across the planet.','No extremo ocidental da Europa formou-se, no século XII, um dos primeiros estados-nação. Pequeno e virado para o mar, Portugal lançou-se à exploração do oceano e abriu rotas marítimas que ligaram pela primeira vez os continentes. Essa ousadia trouxe glória e tragédia, e deixou marcas — na língua e na cultura — em todo o planeta.') },
      { id:'moderno',  theme:'industrial',  emoji:'⚙️', title:_t('The modern world','O mundo moderno'),           scale:_t('the last 500 years','últimos 500 anos'),                lead:_t('The Renaissance rekindled curiosity, the printing press spread knowledge, and science began to explain the world. The industrial and technological revolutions sped everything up: machines, electricity, medicine, communications. In a few centuries humanity changed more than in millennia — with extraordinary progress and devastating wars.','O Renascimento reacendeu a curiosidade, a imprensa espalhou o conhecimento e a ciência passou a explicar o mundo. As revoluções industrial e tecnológica aceleraram tudo: máquinas, eletricidade, medicina, comunicações. Em poucos séculos a humanidade transformou-se mais do que em milénios — com avanços extraordinários e guerras devastadoras.') },
      { id:'espaco',   theme:'spacemodern', emoji:'🚀', title:_t('The space age','A era espacial'),               scale:_t('since 1957','desde 1957'),                              lead:_t('For the first time in history, life left its planet. In a few decades we went from the first satellite to humans on the Moon and probes that have left the Solar System. Seeing Earth from space changed how we see ourselves — a fragile blue dot — and raised the next question: how far will we go?','Pela primeira vez na história, a vida saiu do seu planeta. Em poucas décadas passámos do primeiro satélite ao Homem na Lua e a sondas que já deixaram o Sistema Solar. Ver a Terra do espaço mudou a forma como nos vemos — um frágil ponto azul — e abriu a pergunta seguinte: até onde iremos?') },
    ];
  }
  function chapterOf(e) {
    const y = e.year, c = e.cat;
    if (c === 'universo') return y <= -13.5e9 ? 'bigbang' : 'stars';
    if (c === 'solar') return 'solar';
    if (c === 'terra') return 'terra';
    if (c === 'vida') return y <= -541e6 ? 'vida' : 'cambrico';
    if (c === 'dinos') return 'dinos';
    if (c === 'humana') return 'humana';
    if (c === 'portugal') return 'portugal';
    if (c === 'civil') return 'civil';
    if (c === 'cultura') return y <= 500 ? 'civil' : 'moderno';
    if (c === 'mundial') return y <= 1000 ? 'civil' : 'moderno';
    if (c === 'espaco') return 'espaco';
    return 'moderno';
  }

  /* ── themed full-screen backgrounds (generated) ── */
  const THEME_G = {
    bigbang:['#2a0a4a','#05030d'], galaxy:['#0a1040','#04030d'], solar:['#3a2406','#0a0612'],
    terra:['#4a1c06','#160a1e'], ocean:['#063a3a','#03121f'], reef:['#06304f','#04101c'],
    jungle:['#0c3a16','#05140a'], savanna:['#4a3208','#180f06'], desert:['#5a3e16','#1a1206'],
    discovery:['#06304a','#041420'], industrial:['#2e2436','#0a0a14'], spacemodern:['#0a1240','#03030c'],
  };
  function sceneArt(theme, color) {
    const W = 'rgba(255,255,255,.9)', D = '#070912', sun = c => `<circle cx="980" cy="170" r="90" fill="${c}"/><circle cx="980" cy="170" r="150" fill="${c}" opacity=".18"/>`;
    switch (theme) {
      case 'bigbang': return `<defs><radialGradient id="bb" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#ffd9a0"/><stop offset=".55" stop-color="#c084fc" stop-opacity=".5"/><stop offset="1" stop-color="transparent"/></radialGradient></defs><circle cx="600" cy="350" r="360" fill="url(#bb)"/>${Array.from({length:18},(_,i)=>{const a=i/18*6.283;return `<line x1="600" y1="350" x2="${(600+Math.cos(a)*520).toFixed(0)}" y2="${(350+Math.sin(a)*360).toFixed(0)}" stroke="#c084fc" stroke-width="2" opacity=".25"/>`}).join('')}`;
      case 'galaxy': return `<g transform="translate(600,360)">${[0,1,2].map(k=>`<ellipse rx="${420-k*60}" ry="${150-k*22}" fill="none" stroke="#a78bfa" stroke-width="2" opacity="${.4-k*.1}" transform="rotate(${18+k*8})"/>`).join('')}<circle r="46" fill="#fff"/><circle r="92" fill="#a78bfa" opacity=".25"/></g>`;
      case 'solar': return `${sun('#fbbf24')}${[260,200,150].map((r,i)=>`<ellipse cx="600" cy="400" rx="${r*2.4}" ry="${r}" fill="none" stroke="#fcd34d" stroke-width="2" opacity=".3"/>`).join('')}<circle cx="600" cy="160" r="14" fill="#93c5fd"/><circle cx="180" cy="520" r="20" fill="#fca5a5"/>`;
      case 'terra': return `<defs><radialGradient id="te" cx=".5" cy="1" r="1"><stop offset="0" stop-color="${color}"/><stop offset=".6" stop-color="#7c2d12"/><stop offset="1" stop-color="#160a1e"/></radialGradient></defs><circle cx="600" cy="980" r="640" fill="url(#te)"/><path d="M0 760 q300 -60 600 0 t600 0" fill="none" stroke="#fb923c" stroke-width="3" opacity=".5"/>${[300,600,820].map(x=>`<path d="M${x} 880 q30 -40 60 0" stroke="#fdba74" stroke-width="3" fill="none" opacity=".4"/>`).join('')}`;
      case 'ocean': return `<defs><linearGradient id="oc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7490" stop-opacity=".5"/><stop offset="1" stop-color="#03121f"/></linearGradient></defs><rect y="120" width="1200" height="640" fill="url(#oc)"/>${[0,1,2,3].map(i=>`<path d="M0 ${200+i*120} q300 -40 600 0 t600 0" fill="none" stroke="#22d3ee" stroke-width="2" opacity=".18"/>`).join('')}${[200,500,800,1000].map((x,i)=>`<circle cx="${x}" cy="${300+i*90}" r="${6+i*2}" fill="#a5f3fc" opacity=".4"/>`).join('')}<path d="M300 60 L380 760 M620 40 L520 760 M900 70 L860 760" stroke="#67e8f9" stroke-width="40" opacity=".05"/>`;
      case 'reef': return `<path d="M300 60 L360 760 M700 40 L640 760" stroke="#7dd3fc" stroke-width="50" opacity=".06"/>${[120,360,640,920].map((x,i)=>`<path d="M${x} 760 q-20 -120 10 -200 q20 -50 0 -120" fill="none" stroke="#f472b6" stroke-width="${8+i*2}" opacity=".5"/><path d="M${x+40} 760 q14 -90 -6 -150" fill="none" stroke="#34d399" stroke-width="8" opacity=".5"/>`).join('')}<ellipse cx="900" cy="300" rx="60" ry="30" fill="#fcd34d" opacity=".4"/>`;
      case 'jungle': return `${sun('#fde68a')}<path d="M0 760 V520 q200 -80 400 -20 t400 -10 t400 -30 V760Z" fill="#14532d" opacity=".8"/><path d="M0 760 V600 q300 -60 600 -10 t600 -30 V760Z" fill="${D}"/>${[160,520,860].map(x=>`<path d="M${x} 600 q-30 -120 0 -200 M${x} 600 q40 -80 90 -120 M${x} 600 q-50 -70 -100 -90" stroke="#166534" stroke-width="6" fill="none" opacity=".7"/>`).join('')}<path d="M700 600 q4 -40 40 -56 q40 -30 70 -30 q-12 14 0 24 q30 4 36 26 l20 6 q-12 8 -24 2 q4 16 -10 18 l-4 -12 q-12 4 -18 -2 q-30 6 -42 -8 q-16 4 -22 22Z" fill="${D}"/>`;
      case 'savanna': return `${sun('#fb923c')}<path d="M0 760 V640 q300 -30 600 -6 t600 -18 V760Z" fill="${D}"/>${[200,560,920].map((x,i)=>`<rect x="${x-4}" y="${420+i*20}" width="8" height="${220-i*20}" fill="${D}"/><path d="M${x-90} ${430+i*20} q90 -60 180 0 q-90 -24 -180 0Z" fill="#3f2d10"/>`).join('')}`;
      case 'desert': return `${sun('#fbbf24')}<path d="M0 760 V650 q300 -50 600 0 t600 -10 V760Z" fill="#78350f" opacity=".7"/><path d="M0 760 V690 q300 -30 600 6 t600 -16 V760Z" fill="${D}"/><path d="M740 690 L860 470 L980 690Z" fill="#a16207"/><path d="M880 690 L980 510 L1080 690Z" fill="#854d0e"/><rect x="150" y="500" width="16" height="190" fill="${D}"/><rect x="210" y="500" width="16" height="190" fill="${D}"/><rect x="135" y="486" width="106" height="16" fill="${D}"/>`;
      case 'discovery': return `<defs><linearGradient id="se" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0369a1" stop-opacity=".5"/><stop offset="1" stop-color="#041420"/></linearGradient></defs>${sun('#fcd34d')}<rect y="470" width="1200" height="290" fill="url(#se)"/>${[0,1,2].map(i=>`<path d="M0 ${520+i*70} q150 -24 300 0 t300 0 t300 0 t300 0" fill="none" stroke="#38bdf8" stroke-width="2" opacity=".25"/>`).join('')}<g transform="translate(560,420)"><path d="M-90 60 q90 30 180 0 l-26 36 q-64 16 -128 0Z" fill="${D}"/><rect x="-4" y="-70" width="8" height="130" fill="${D}"/><path d="M4 -64 q70 16 0 60Z" fill="#e2e8f0"/><path d="M-4 -50 q-60 14 0 50Z" fill="#cbd5e1"/></g>`;
      case 'industrial': return `<path d="M0 760 V470 h120 v-70 h70 v70 h90 V520 h140 v-90 h70 v90 h120 V480 h160 v280Z" fill="${D}"/>${[150,330,640,860].map((x,i)=>`<rect x="${x}" y="${300-i*10}" width="34" height="${180+i*10}" fill="#1f2937"/><ellipse cx="${x+17}" cy="${290-i*10}" rx="40" ry="24" fill="#64748b" opacity=".18"/><ellipse cx="${x+30}" cy="${250-i*10}" rx="56" ry="30" fill="#64748b" opacity=".12"/>`).join('')}<g transform="translate(980,250)" opacity=".5"><circle r="46" fill="none" stroke="#94a3b8" stroke-width="10"/>${Array.from({length:8},(_,i)=>{const a=i/8*6.283;return `<rect x="-6" y="-66" width="12" height="20" fill="#94a3b8" transform="rotate(${i*45})"/>`}).join('')}<circle r="14" fill="#94a3b8"/></g>`;
      case 'spacemodern': return `<circle cx="300" cy="900" r="560" fill="#1e3a5f"/><path d="M-260 700 a560 560 0 0 1 1120 0" fill="none" stroke="#38bdf8" stroke-width="3" opacity=".4"/><g transform="translate(820,300) rotate(18)"><path d="M0 -90 q34 44 30 100 l-12 30 h-36 l-12 -30 q-4 -56 30 -100Z" fill="#e2e8f0"/><circle cx="0" cy="-40" r="13" fill="#38bdf8"/><path d="M-30 40 l-26 30 l28 -8Z" fill="#94a3b8"/><path d="M30 40 l26 30 l-28 -8Z" fill="#94a3b8"/><path d="M-16 70 q16 34 32 0 q-8 22 -16 36 q-8 -14 -16 -36Z" fill="#fb923c"/></g><g transform="translate(360,210)" opacity=".8"><rect x="-50" y="-5" width="100" height="10" fill="#cbd5e1"/><rect x="-8" y="-22" width="16" height="44" fill="#94a3b8"/>${[-46,-30,30,46].map(x=>`<rect x="${x}" y="-16" width="12" height="32" fill="#38bdf8"/>`).join('')}</g>`;
      default: return '';
    }
  }

  async function _ensure() {
    if (_loaded) return;
    try { const r = await fetch('data/timeline.json'); _data = r.ok ? await r.json() : []; }
    catch (e) { _data = []; }
    (_data || []).sort((a, b) => a.year - b.year);
    _loaded = true;
  }

  /* ── documentary build ── */
  let _depth = 'key', _theme = 'all', _ioRail = null, _railChs = [], _docBound = false;

  function storyChapters() {
    return _CHAPTERS().map(ch => {
      let evs = (_data || []).filter(e => chapterOf(e) === ch.id);
      if (_theme !== 'all') evs = evs.filter(e => e.cat === _theme);
      if (_depth === 'key') { const k = evs.filter(e => e.key); if (k.length) evs = k; }
      evs.sort((a, b) => a.year - b.year);
      return { ch, evs };
    }).filter(x => _theme === 'all' || x.evs.length);
  }

  function eraHero(ch) {
    const g = THEME_G[ch.theme] || ['#10131f', '#05060d'];
    return `<div class="tl-hero" style="--g1:${g[0]};--g2:${g[1]}">
      <img class="tl-hero-bg" src="assets/timeline/chapter-${ch.id}.jpg" alt="" onerror="this.style.display='none'">
      <div class="tl-hero-grad"></div>
      <div class="tl-hero-in">
        <div class="tl-hero-em">${ch.emoji}</div>
        <div class="tl-hero-scale">${esc(ch.scale)}</div>
        <h2 class="tl-hero-title">${esc(ch.title)}</h2>
        <p class="tl-hero-lead">${esc(ch.lead)}</p>
      </div>
    </div>`;
  }

  function eventScene(e, i) {
    const c = cat(e);
    const related = (e.related || []).map(r => (_data || []).find(x => x.id === r)).filter(Boolean).slice(0, 3);
    return `<article class="tl-sc${i % 2 ? ' tl-sc-alt' : ''}" data-scid="${esc(e.id)}" style="--c:${c.color}">
      <div class="tl-sc-media">
        <img src="assets/timeline/${esc(e.id)}.jpg" alt="${esc(e.title)}" loading="lazy" onerror="this.closest('.tl-sc-media').classList.add('tl-noimg')">
        <span class="tl-sc-em">${c.emoji}</span>
        <span class="tl-sc-cat">${esc(c.label)}</span>
      </div>
      <div class="tl-sc-txt">
        <div class="tl-sc-meta"><span class="tl-sc-date">${esc(cardDate(e.year))}</span><span class="tl-sc-ago">${agoStr(e.year)}</span>${e.period ? `<span class="tl-sc-per">${esc(e.period)}</span>` : ''}${e.place ? `<span class="tl-sc-per">📍 ${esc(e.place)}</span>` : ''}</div>
        <h3 class="tl-sc-title">${esc(e.title)}</h3>
        <p class="tl-sc-desc">${esc(e.desc || '')}</p>
        ${e.fact ? `<p class="tl-sc-fact"><span>💡</span> ${esc(e.fact)}</p>` : ''}
        <div class="tl-sc-foot">
          <a class="tl-sc-wiki" href="${wikiUrl(e)}" target="_blank" rel="noopener">📖 ${_t('Wikipedia','Wikipédia')} ↗</a>
          ${related.map(r => `<button class="tl-chip" data-go="${esc(r.id)}" style="--c:${cat(r).color}"><span>${cat(r).emoji}</span>${esc(r.title)}</button>`).join('')}
        </div>
      </div>
    </article>`;
  }

  function themeSelect() {
    const opts = ['<option value="all">' + _t('All themes', 'Todos os temas') + '</option>']
      .concat(Object.keys(CATS).map(k => `<option value="${k}"${_theme === k ? ' selected' : ''}>${CATS[k].emoji} ${esc(CATS[k].label)}</option>`));
    return `<select class="tl-theme" id="tl-theme" aria-label="${_t('Theme','Tema')}">${opts.join('')}</select>`;
  }

  /* depth + theme controls — rendered into the shared top bar (same row as the
     mode toggle) so the header stays one compact line. */
  function docControls() {
    return `<div class="tl-seg" id="tl-depth" role="group" aria-label="${_t('Detail level','Nível de detalhe')}">
        <button data-depth="key" class="${_depth === 'key' ? 'on' : ''}">✨ ${_t('Highlights','Destaques')}</button>
        <button data-depth="all" class="${_depth === 'all' ? 'on' : ''}">📚 ${_t('Complete','Completo')}</button>
      </div>${themeSelect()}`;
  }
  function shell() {
    return `
      <div class="tl-wrap tl-doc">
        <div class="tl-doc-scroll" id="tl-scroll">
          <div class="tl-doc-stage" id="tl-stage"></div>
        </div>
        <nav class="tl-rail" id="tl-rail" aria-label="${_t('Chapters','Capítulos')}"></nav>
        <div class="tl-detail" id="tl-detail" role="dialog" aria-modal="true" aria-labelledby="tl-d-title" hidden></div>
      </div>`;
  }

  function renderDoc() {
    const stage = _root && _root.querySelector('#tl-stage');
    if (!stage) return;
    const chs = storyChapters();
    stage.innerHTML = chs.length
      ? chs.map(({ ch, evs }) => `
        <section class="tl-chsec" id="tl-ch-${ch.id}" data-ch="${ch.id}" aria-label="${esc(ch.title)}">
          ${eraHero(ch)}
          <div class="tl-chbody">${evs.map(eventScene).join('')}</div>
        </section>`).join('')
      : `<p class="tl-empty">${_t('No events for this theme.', 'Sem eventos para este tema.')}</p>`;
    /* rail */
    const rail = _root.querySelector('#tl-rail');
    if (rail) rail.innerHTML = chs.map(({ ch }) => `<button class="tl-dot" data-ch="${ch.id}" title="${esc(ch.title)}" aria-label="${esc(ch.title)}"><span class="tl-dot-lbl">${ch.emoji} ${esc(ch.title)}</span></button>`).join('');
    _railChs = chs.map(x => x.ch.id);
    _setupObservers();
    const sc = _root.querySelector('#tl-scroll'); if (sc) sc.scrollTop = 0;
  }

  function _setupObservers() {
    if (_io) _io.disconnect();
    _io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) en.target.classList.add('tl-in'); }), { root: _scroll, threshold: 0.18 });
    _root.querySelectorAll('.tl-hero-in, .tl-sc').forEach(el => _io.observe(el));
    if (_ioRail) _ioRail.disconnect();
    _ioRail = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) _setRail(en.target.dataset.ch); });
    }, { root: _scroll, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    _root.querySelectorAll('.tl-chsec').forEach(el => _ioRail.observe(el));
  }
  function _setRail(chId) {
    _root && _root.querySelectorAll('.tl-dot').forEach(b => b.classList.toggle('on', b.dataset.ch === chId));
  }
  function scrollToChapterId(chId) {
    const el = _root && _root.querySelector('#tl-ch-' + chId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function relatedGo(id) {
    const sc = _root && _root.querySelector('[data-scid="' + id + '"]');
    if (sc) { sc.scrollIntoView({ behavior: 'smooth', block: 'center' }); sc.classList.remove('tl-flash'); void sc.offsetWidth; sc.classList.add('tl-flash'); }
    else openDetail(id);
  }
  function scrollToEvent(id) {
    const sc = _root && _root.querySelector('[data-scid="' + id + '"]');
    if (sc) sc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else { const e = (_data || []).find(x => x.id === id); if (e) scrollToChapterId(chapterOf(e)); }
  }

  /* ── detail panel ── */
  function openDetail(id) {
    const e = (_data || []).find(x => x.id === id);
    if (!e || !_root) return;
    const d = _root.querySelector('#tl-detail'); if (!d) return;
    const c = cat(e);
    const related = (e.related || []).map(r => (_data || []).find(x => x.id === r)).filter(Boolean);
    d.style.setProperty('--c', c.color);
    d.innerHTML = `
      <button class="tl-d-close" aria-label="${_t('Close','Fechar')}">✕</button>
      <div class="tl-d-media">${artSVG(e)}<img class="tl-photo" src="assets/timeline/${esc(e.id)}.jpg" alt="" loading="lazy" onerror="this.remove()"><span class="tl-d-media-em">${c.emoji}</span></div>
      <div class="tl-d-head">
        <span class="tl-d-emoji">${c.emoji}</span>
        <div><span class="tl-d-cat">${esc(c.label)}</span><h2 class="tl-d-title" id="tl-d-title">${esc(e.title)}</h2></div>
      </div>
      <div class="tl-d-meta">
        <span>🕓 ${cardDate(e.year)}</span><span>⏳ ${agoStr(e.year)}</span>
        ${e.period ? `<span>📜 ${esc(e.period)}</span>` : ''}${e.place ? `<span>📍 ${esc(e.place)}</span>` : ''}
      </div>
      <p class="tl-d-desc">${esc(e.desc || '')}</p>
      ${e.fact ? `<div class="tl-d-fact"><strong>💡 ${_t('Did you know?','Curiosidade')}</strong> ${esc(e.fact)}</div>` : ''}
      <a class="tl-d-wikilink" href="${wikiUrl(e)}" target="_blank" rel="noopener">📖 ${_t('Read on Wikipedia','Ler na Wikipédia')} ↗</a>
      ${related.length ? `<div class="tl-d-rel-label">🔗 ${_t('Related events','Eventos relacionados')}</div>
        <div class="tl-d-rel">${related.map(r => `<button class="tl-chip" data-id="${esc(r.id)}" style="--c:${cat(r).color}"><span>${cat(r).emoji}</span>${esc(r.title)}</button>`).join('')}</div>` : ''}`;
    d.hidden = false; d.scrollTop = 0;
    d.querySelector('.tl-d-close').onclick = closeDetail;
    d.querySelectorAll('.tl-chip[data-id]').forEach(b => b.onclick = () => { openDetail(b.dataset.id); scrollToEvent(b.dataset.id); });
    _lastFocus = document.activeElement;
    requestAnimationFrame(() => d.querySelector('.tl-d-close')?.focus());
  }
  function closeDetail() {
    const d = _root && _root.querySelector('#tl-detail');
    if (d) d.hidden = true;
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} _lastFocus = null; }
  }

  /* ── lifecycle (story / documentary) ── */
  function _storyMount(sub) {
    _root = sub;
    _buildCats();
    sub.innerHTML = shell();
    if (_slot) _slot.innerHTML = docControls();
    _scroll = sub.querySelector('#tl-scroll');
    wireStory();
    _ensure().then(() => renderDoc());
  }
  function wireStory() {
    _slot && _slot.querySelector('#tl-depth').addEventListener('click', e => {
      const b = e.target.closest('[data-depth]'); if (!b) return;
      _depth = b.dataset.depth;
      _slot.querySelectorAll('#tl-depth button').forEach(x => x.classList.toggle('on', x.dataset.depth === _depth));
      renderDoc();
    });
    _slot && _slot.querySelector('#tl-theme').addEventListener('change', e => { _theme = e.target.value; renderDoc(); });
    _root.querySelector('#tl-rail').addEventListener('click', e => { const b = e.target.closest('.tl-dot'); if (b) scrollToChapterId(b.dataset.ch); });
    _root.querySelector('#tl-stage').addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { relatedGo(go.dataset.go); return; }
      const media = e.target.closest('.tl-sc-media'); if (media) { const sc = media.closest('[data-scid]'); if (sc) openDetail(sc.dataset.scid); }
    });
    _root.querySelector('#tl-detail').addEventListener('click', e => {
      const chip = e.target.closest('.tl-chip[data-id]'); if (chip) openDetail(chip.dataset.id);
    });
    /* close the panel naturally: click outside it, or Escape (bound once) */
    if (!_docBound) {
      /* Click anywhere outside the open panel closes it (capture + stop so it
         doesn't also trigger a new open). Clicks inside the panel are ignored. */
      document.addEventListener('click', e => {
        if (!_root) return; const d = _root.querySelector('#tl-detail');
        if (!d || d.hidden) return;
        if (e.target.closest('#tl-detail')) return;
        closeDetail(); e.stopPropagation();
      }, true);
      document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !_root) return; const d = _root.querySelector('#tl-detail'); if (d && !d.hidden) closeDetail(); });
      _docBound = true;
    }
  }
  function _storyResume() { if (_root) _scroll = _root.querySelector('#tl-scroll') || _scroll; }
  function _storyStop() { closeDetail(); }
  function _storyDiscover() {
    _ensure().then(() => {
      if (!_data || !_data.length) return;
      const e = _data[Math.floor(Math.random() * _data.length)];
      scrollToEvent(e.id);
      setTimeout(() => openDetail(e.id), 650);
    });
  }

  /* ══ mode coordinator: História (scrollytelling) | Explorar (interativo) ══ */
  let _coRoot = null, _mode = 'story', _content = null, _slot = null;
  function mount(sub) {
    _coRoot = sub;
    try { const s = localStorage.getItem('tl-mode'); if (s === 'interactive' || s === 'story') _mode = s; } catch (e) {}
    sub.innerHTML = `
      <div class="tl-topbar">
        <div class="tl-modes" role="tablist" aria-label="${_t('Timeline mode', 'Modo da linha do tempo')}">
          <button class="tl-mode" data-mode="story" role="tab">📖 ${_t('Story', 'História')}</button>
          <button class="tl-mode" data-mode="interactive" role="tab">🔭 ${_t('Explore', 'Explorar')}</button>
        </div>
        <div class="tl-slot" id="tl-slot"></div>
      </div>
      <div class="tl-mode-content" id="tl-mode-content"></div>`;
    _content = sub.querySelector('#tl-mode-content');
    _slot = sub.querySelector('#tl-slot');
    sub.querySelector('.tl-modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
    setMode(_mode);
  }
  function setMode(m) {
    if (!_content) return;
    _mode = m;
    try { localStorage.setItem('tl-mode', m); } catch (e) {}
    _coRoot.querySelectorAll('.tl-mode').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    try { _storyStop(); } catch (e) {}
    try { if (typeof TimelineInteractive !== 'undefined') TimelineInteractive.stop(); } catch (e) {}
    if (_slot) _slot.innerHTML = '';
    _content.innerHTML = '';
    if (m === 'interactive' && typeof TimelineInteractive !== 'undefined') TimelineInteractive.mount(_content);
    else _storyMount(_content);
  }
  function resume() { if (_mode === 'interactive' && typeof TimelineInteractive !== 'undefined') TimelineInteractive.resume(); else _storyResume(); }
  function stop() { try { _storyStop(); } catch (e) {} try { if (typeof TimelineInteractive !== 'undefined') TimelineInteractive.stop(); } catch (e) {} }
  function discoverRandom() { if (_mode === 'interactive' && typeof TimelineInteractive !== 'undefined') TimelineInteractive.discoverRandom(); else _storyDiscover(); }

  return { mount, resume, stop, discoverRandom };
})();
