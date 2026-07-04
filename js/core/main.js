// ── FONT SIZE ─────────────────────────────────────────────────────
const FONT_SIZES = [13, 14, 16, 18, 20];
const FONT_LBLS  = ['XS', 'S', 'M', 'L', 'XL'];
let fontIdx = Math.min(Math.max(parseInt(localStorage.getItem('fontSize') ?? '2', 10) || 2, 0), FONT_SIZES.length - 1);

function applyFont() {
  document.documentElement.style.fontSize = FONT_SIZES[fontIdx] + 'px';
  const l = document.getElementById('font-lbl');
  if (l) l.textContent = FONT_LBLS[fontIdx];
  const dec = document.getElementById('font-dec');
  const inc = document.getElementById('font-inc');
  if (dec) dec.disabled = fontIdx === 0;
  if (inc) inc.disabled = fontIdx === FONT_SIZES.length - 1;
  localStorage.setItem('fontSize', fontIdx);
}
applyFont();
document.getElementById('font-dec').addEventListener('click', () => { if (fontIdx > 0) { fontIdx--; applyFont(); } });
document.getElementById('font-inc').addEventListener('click', () => { if (fontIdx < FONT_SIZES.length - 1) { fontIdx++; applyFont(); } });

// ── THEME MANAGER ─────────────────────────────────────────────────
const ThemeManager = (function () {
  const ALL_CLASSES = ['light'];

  function _apply(theme) {
    document.body.classList.remove(...ALL_CLASSES);
    if (theme === 'light') document.body.classList.add('light');
    localStorage.setItem('site-theme', theme);
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    if (window.applyWallpaper) window.applyWallpaper();
  }

  function openPanel() {
    const panel = document.getElementById('theme-panel');
    if (panel) panel.classList.toggle('open');
  }

  function closePanel() {
    document.getElementById('theme-panel')?.classList.remove('open');
  }

  const saved = localStorage.getItem('site-theme') || 'dark';
  _apply(saved);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => { _apply(btn.dataset.theme); closePanel(); });
    });
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      _apply((localStorage.getItem('site-theme') || 'dark') === 'dark' ? 'light' : 'dark');
    });
  });

  return { apply: _apply, openPanel, closePanel };
})();

// ── WALLPAPER ──────────────────────────────────────────────────────
const WALLPAPERS = {
  dark: [
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
    'https://images.unsplash.com/photo-1534796636912-3b952d9cd9e4?w=1920&q=80',
    'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1920&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80',
    'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=1920&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
    'https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=1920&q=80',
    'https://images.unsplash.com/photo-1511884484798-1fbeeb1dcf83?w=1920&q=80',
  ],
  light: [
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1920&q=80',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1920&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
    'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1920&q=80',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80',
    'https://images.unsplash.com/photo-1490750967868-88df5691cc7d?w=1920&q=80',
    'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1920&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80',
  ],
};

function applyWallpaper() {
  try {
    const enabled = localStorage.getItem('wallpaper-enabled') === 'true';
    const el = document.getElementById('bg-wallpaper');
    if (!el) return;
    if (!enabled) {
      el.style.backgroundImage = '';
      el.classList.remove('wp-active');
      document.body.classList.remove('wp-active');
      return;
    }
    const theme = localStorage.getItem('site-theme') || 'dark';
    const list = WALLPAPERS[theme] || WALLPAPERS.dark;
    const url = list[Math.floor(Math.random() * list.length)];
    el.classList.add('wp-active');
    document.body.classList.add('wp-active');
    el.style.backgroundImage = `url('${url}')`;
  } catch {}
}
window.applyWallpaper = applyWallpaper;

document.addEventListener('DOMContentLoaded', () => {
  applyWallpaper();
});

// ── CONSTANTS ──────────────────────────────────────────────────────
const WD    = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MO    = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MS    = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WD_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MO_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const lang  = () => typeof I18n !== 'undefined' ? I18n.getLang() : 'en';
const t     = (key, vars) => typeof I18n !== 'undefined' ? I18n.t(key, vars) : key;
const wd    = () => lang() === 'pt' ? WD : WD_EN;
const mo    = () => lang() === 'pt' ? MO : MO_EN;
const ms    = () => lang() === 'pt' ? MS : MS_EN;

// ── CLOCK (driven by AppTime, js/core/time.js) ────────────────────
function tick() {
  const n = AppTime.now();
  const l = lang();
  const dateEl = document.getElementById('date-el');
  const timeEl = document.getElementById('time-el');
  if (dateEl) dateEl.textContent = l === 'pt'
    ? `${WD[n.getDay()]}, ${n.getDate()} de ${MO[n.getMonth()]} de ${n.getFullYear()}`
    : `${WD_EN[n.getDay()]}, ${MO_EN[n.getMonth()]} ${n.getDate()}, ${n.getFullYear()}`;
  if (timeEl) timeEl.textContent =
    n.toLocaleTimeString(l === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
tick();
document.addEventListener('time:minute', tick);

// ── DAILY CONTENT ─────────────────────────────────────────────────
const QUOTES = [
  {t:'O único modo de fazer um excelente trabalho é amar o que se faz.',a:'Steve Jobs'},
  {t:'A vida é o que acontece enquanto estás ocupado a fazer outros planos.',a:'John Lennon'},
  {t:'Sê a mudança que queres ver no mundo.',a:'Mahatma Gandhi'},
  {t:'Tudo parece impossível até que seja feito.',a:'Nelson Mandela'},
  {t:'A imaginação é mais importante do que o conhecimento.',a:'Albert Einstein'},
  {t:'O futuro pertence àqueles que acreditam na beleza dos seus sonhos.',a:'Eleanor Roosevelt'},
  {t:'A persistência é o caminho do êxito.',a:'Charlie Chaplin'},
  {t:'A felicidade não é algo pronto. Vem das tuas próprias ações.',a:'Dalai Lama'},
  {t:'Nunca é tarde para ser o que poderias ter sido.',a:'George Eliot'},
  {t:'Acredita que podes e já estás a meio caminho.',a:'Theodore Roosevelt'},
  {t:'O modo de começar é parar de falar e começar a fazer.',a:'Walt Disney'},
  {t:'O sucesso não é definitivo, o fracasso não é fatal: é a coragem de continuar que conta.',a:'Winston Churchill'},
  {t:'Vive como se fosses morrer amanhã. Aprende como se fosses viver para sempre.',a:'Mahatma Gandhi'},
  {t:'O que sabemos é uma gota, o que ignoramos é um oceano.',a:'Isaac Newton'},
  {t:'Sê tu mesmo; todos os outros papéis já estão tomados.',a:'Oscar Wilde'},
  {t:'A arte é a mentira que nos permite perceber a verdade.',a:'Pablo Picasso'},
  {t:'Há apenas dois dias no ano em que nada pode ser feito: ontem e amanhã.',a:'Dalai Lama'},
  {t:'Não são os anos de vida que contam, mas a vida nos anos.',a:'Abraham Lincoln'},
  {t:'Em cada amanhecer há uma nova oportunidade de ser feliz.',a:'Ralph Waldo Emerson'},
  {t:'O sucesso é a soma de pequenos esforços repetidos dia após dia.',a:'Robert Collier'},
  {t:'Não é o mais forte que sobrevive, mas o mais adaptável às mudanças.',a:'Charles Darwin'},
  {t:'O homem sábio não diz tudo o que pensa, mas pensa tudo o que diz.',a:'Aristóteles'},
];

const RIDDLES = [
  {q:'O que tem cidades sem casas, florestas sem árvores e água sem peixes?',a:'Um mapa'},
  {q:'Quanto mais me tiras, maior fico. O que sou?',a:'Uma cova'},
  {q:'Tenho mãos mas não consigo bater palmas. O que sou?',a:'Um relógio'},
  {q:'O que é que fica no canto mas viaja por todo o mundo?',a:'Um selo postal'},
  {q:'O que é que tens tu que toda a gente usa mais do que tu?',a:'O teu nome'},
  {q:'Deito-me mas não durmo, tenho boca mas não falo. O que sou?',a:'Um rio'},
  {q:'O que é que voa sem ter asas e chora sem ter olhos?',a:'Uma nuvem'},
  {q:'Quanto mais seco, mais molhado fico. O que sou?',a:'Uma toalha'},
  {q:'O que é que o pobre tem, o rico precisa e se comeres morre?',a:'O nada'},
  {q:'Tenho ramos mas não sou árvore, tenho folhas mas não sou planta. O que sou?',a:'Um livro'},
  {q:'Sou leve como pena mas o homem mais forte não me consegue segurar por muito tempo. O que sou?',a:'O fôlego'},
  {q:'O que é que a neve tem de branco, o carvão tem de preto e o fogo tem de vermelho?',a:'A cor'},
  {q:'Sou filho do teu pai mas não sou teu irmão. Quem sou?',a:'Tu próprio'},
  {q:'O que nasce com quatro pernas, anda com duas e morre com três?',a:'O ser humano'},
  {q:'Qual é o único lugar onde sexta-feira vem antes de quinta-feira?',a:'No dicionário'},
  {q:'O que é que tem um pescoço mas não tem cabeça?',a:'Uma garrafa'},
  {q:'O que é que está sempre à tua frente mas não podes ver?',a:'O futuro'},
  {q:'O que é que quanto mais partilhas, mais tens?',a:'O conhecimento'},
  {q:'Tenho olhos mas não vejo, tenho nariz mas não cheiro. O que sou?',a:'Uma batata'},
  {q:'O que é que corre mas não tem pernas?',a:'A água'},
];

const WELCOME_MSGS = [
  'Pronto para conquistar mais um dia? 🚀',
  'O que vamos explorar hoje? ✨',
  'Hoje pode ser o teu melhor dia desta semana. 💪',
  'Cada dia é uma nova oportunidade de fazer algo incrível. 🌟',
  'Bem-vindo de volta! O que está nos planos? 🎯',
  'A consistência é o segredo do sucesso. Segue em frente! 🔥',
  'Um passo de cada vez constrói grandes conquistas. 🏔️',
  'Hoje é um excelente dia para aprender algo novo. 📚',
  'Faz hoje o que outros deixam para amanhã. ⚡',
  'A melhor altura para começar é agora. ⏰',
  'Pequenos progressos diários levam a grandes resultados. 📈',
  'A tua jornada continua aqui. 🗺️',
  'Inspira, expira e vai em frente! 🌊',
  'O esforço de hoje é o sucesso de amanhã. 🌅',
  'Foco, determinação e ação. Vamos lá! 🎪',
  'Não há dias maus — só dias de aprendizagem. 🧠',
  'Cada manhã é uma nova página em branco. Escreve algo bom. ✍️',
  'O sucesso adora quem aparece todos os dias. 🏆',
];

const WELCOME_MSGS_EN = [
  'Ready to conquer another day? 🚀',
  'What are we exploring today? ✨',
  'Today could be your best day this week. 💪',
  'Every day is a new opportunity to do something amazing. 🌟',
  'Welcome back! What\'s on the plan? 🎯',
  'Consistency is the secret to success. Keep going! 🔥',
  'One step at a time builds great achievements. 🏔️',
  'Today is a great day to learn something new. 📚',
  'Do today what others leave for tomorrow. ⚡',
  'The best time to start is now. ⏰',
  'Small daily progress leads to great results. 📈',
  'Your journey continues here. 🗺️',
  'Breathe in, breathe out, and move forward! 🌊',
  'Today\'s effort is tomorrow\'s success. 🌅',
  'Focus, determination and action. Let\'s go! 🎪',
  'There are no bad days — only learning days. 🧠',
  'Every morning is a blank page. Write something good. ✍️',
  'Success loves those who show up every day. 🏆',
];

function greetingKey() {
  return { morning: 'home.greet.morning', afternoon: 'home.greet.afternoon', evening: 'home.greet.evening' }[AppTime.period()];
}

function renderWelcome() {
  const greeting = t(greetingKey());
  const pool = lang() === 'pt' ? WELCOME_MSGS : WELCOME_MSGS_EN;
  const msg  = pool[Math.floor(Math.random() * pool.length)];
  const gEl = document.getElementById('wc-greeting');
  const mEl = document.getElementById('wc-msg');
  if (gEl) gEl.textContent = greeting;
  if (mEl) mEl.textContent = msg;
}
document.addEventListener('DOMContentLoaded', renderWelcome);

const LOCAL_JOKES = [
  {type:'twopart',setup:'Porque é que os programadores confundem o Halloween com o Natal?',delivery:'Porque Oct 31 = Dec 25!'},
  {type:'single',joke:'Um cientista entra num bar e pede H2O. O segundo cientista pede H2O também. O segundo morreu.'},
  {type:'twopart',setup:'O que é que um biólogo disse quando viu uma ameba comer outra ameba?',delivery:'Oh well, c\'est la vie!'},
  {type:'single',joke:'Pergunta ao Google qual é a melhor piada do mundo e ele responde: "Os resultados da pesquisa."'},
  {type:'twopart',setup:'Porque é que o espantalho ganhou um prémio?',delivery:'Porque era o melhor no seu campo!'},
  {type:'single',joke:'Um homem diz ao médico que se sente como se fosse uma baralha de cartas. O médico diz: "Vou mandá-lo para um especialista."'},
  {type:'twopart',setup:'O que disse o zero ao oito?',delivery:'Gostas muito de cinto!'},
  {type:'single',joke:'Fui ao médico e ele disse-me que tenho de parar de jogar golfe. Perguntei porquê. Ele disse: "Para eu poder jogar!"'},
  {type:'twopart',setup:'Porque é que os elefantes não usam computadores?',delivery:'Porque têm medo do rato!'},
  {type:'single',joke:'Um peixe bate na parede e diz: "Droga!"'},
  {type:'twopart',setup:'O que é que fica no canto e viaja por todo o mundo?',delivery:'Um selo!'},
  {type:'single',joke:'Perguntei a uma amiga se ia à prova de matemática. Ela disse: "Não sei, são muitas dúvidas."'},
  {type:'twopart',setup:'Como se chama um aluno que não estuda e passa?',delivery:'Passalho!'},
  {type:'single',joke:'O médico disse-me que sou viciado em Twitter. Estranhei muito, não é o tipo de diagnóstico que recebo todos os dias.'},
  {type:'twopart',setup:'O que é que a chuva disse ao milho?',delivery:'Olá, milho!'},
  {type:'single',joke:'Tentei escrever um livro sobre relógios mas demorei muito. Era uma perca de tempo.'},
  {type:'twopart',setup:'Porque é que o esqueleto não foi à festa?',delivery:'Porque não tinha corpo para isso!'},
  {type:'single',joke:'Comprei umas sapatilhas a um traficante. Não sei o que ele meteu nelas mas fiquei a correr o dia todo.'},
  {type:'twopart',setup:'O que é que a chávena disse ao café?',delivery:'Estou cheio de ti!'},
  {type:'single',joke:'Um homem vai ao psicólogo e diz que se sente invisível. O psicólogo diz: "Próximo!"'},
];

async function fetchJoke() {
  const local = LOCAL_JOKES[Math.floor(Math.random() * LOCAL_JOKES.length)];
  const bust = `&_=${Date.now()}`;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const ptRes = await fetch(`https://v2.jokeapi.dev/joke/Any?lang=pt&type=single,twopart&safe-mode${bust}`, {cache:'no-store',signal:ctrl.signal});
    const pt = await ptRes.json();
    if (!pt.error) return pt;
    const enRes = await fetch(`https://v2.jokeapi.dev/joke/Any?lang=en&type=single,twopart&safe-mode${bust}`, {cache:'no-store',signal:ctrl.signal});
    const en = await enRes.json();
    return en.error ? local : en;
  } catch { return local; }
}

function jokeHTML(j) {
  if (!j || j.error) return '<span class="dc-joke-single" style="color:var(--muted)">—</span>';
  return j.type === 'twopart'
    ? `<span class="dc-joke-setup">${j.setup}</span><span class="dc-joke-punchline">${j.delivery}</span>`
    : `<span class="dc-joke-single">${j.joke || '—'}</span>`;
}

async function loadDailyContent() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const q = pick(QUOTES);
  const r = pick(RIDDLES);

  const qEl = document.getElementById('dc-quote-wrap');
  const rEl = document.getElementById('dc-riddle-wrap');
  const jEl = document.getElementById('dc-joke-wrap');

  if (qEl) qEl.innerHTML = `
    <blockquote class="dc-quote">"${q.t}"</blockquote>
    <div class="dc-author">— ${q.a}</div>`;

  if (rEl) rEl.innerHTML = `
    <div class="dc-riddle-q">${r.q}</div>
    <button class="dc-reveal" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">${t('home.reveal')}</button>
    <div class="dc-answer">${r.a}</div>`;

  if (jEl) {
    const localJ = LOCAL_JOKES[Math.floor(Math.random() * LOCAL_JOKES.length)];
    jEl.innerHTML = jokeHTML(localJ);
  }
}
/* ── HOME: daily discovery panel (data from data/home/today.json) ──── */
function _escH(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function updateDiscGreeting() {
  const gEl = document.getElementById('disc-greeting');
  if (!gEl) return;
  const per = AppTime.period();
  const greet = lang() === 'pt'
    ? { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' }[per]
    : { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }[per];
  /* the wave lives in its own span so the gradient text-fill doesn't wash it out */
  gEl.innerHTML = `${greet} <span class="disc-wave">👋</span>`;
}

async function renderHomeDiscovery() {
  const panel = document.getElementById('disc-panel');
  const sEl = document.getElementById('disc-sub');
  const l = lang();
  updateDiscGreeting();

  /* the visible date always comes from the client clock — never from the
     snapshot file, which can be hours or days old */
  const n = AppTime.now();
  const todayLabel = l === 'pt' ? `Hoje, ${n.getDate()} de ${MO[n.getMonth()]}` : `${MO_EN[n.getMonth()]} ${n.getDate()}`;
  if (sEl) sEl.textContent = todayLabel;
  if (!panel) return;

  let data = null;
  try { const r = await fetch('data/home/today.json', { cache: 'no-store' }); if (r.ok) data = await r.json(); } catch (e) {}
  if (!data) { try { const r = await fetch('data/home/fallback.json'); if (r.ok) data = await r.json(); } catch (e) {} }
  if (!data) { panel.innerHTML = `<div class="disc-loading">${l === 'pt' ? 'Sem dados disponíveis offline.' : 'No data available offline.'}</div>`; return; }
  /* stale snapshot (Action delayed/failed): keep today's date, flag the content */
  if (sEl && data.date && data.date !== AppTime.dayKey()) {
    sEl.textContent = todayLabel + (l === 'pt' ? ` · conteúdo de ${data.dateLabel || data.date}` : ` · content from ${data.date}`);
  }

  const e = _escH;

  /* 💡 Inspiração do Dia — welcome message at the top, next to the greeting */
  const wEl = document.getElementById('disc-welcome');
  if (wEl) {
    if (data.inspiration && data.inspiration.quote) {
      wEl.innerHTML = `<span class="disc-welcome-ico">💡</span> “${e(data.inspiration.quote)}” <span class="disc-welcome-author">— ${e(data.inspiration.author)}</span>`;
      wEl.hidden = false;
    } else { wEl.hidden = true; }
  }
  const evItem = it => {
    const yr = it.year ? `<b class="disc-yr">${it.year}</b>` : '';
    const thumb = it.thumb ? `<img class="disc-thumb" src="${e(it.thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
    const body = `${thumb}<span class="disc-item-txt">${yr}${e(it.text || it.title)}</span>`;
    return it.url ? `<a class="disc-item" href="${e(it.url)}" target="_blank" rel="noopener">${body}</a>` : `<div class="disc-item">${body}</div>`;
  };
  const person = p => {
    const thumb = p.thumb ? `<img class="disc-thumb rnd" src="${e(p.thumb)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="disc-thumb rnd ph">🎂</span>`;
    return `<a class="disc-person" href="${e(p.url || '#')}" target="_blank" rel="noopener">${thumb}<span class="disc-person-txt"><b>${e(p.title)}</b>${p.year ? ` <span class="disc-yr">· ${p.year}</span>` : ''}<small>${e(p.extract || p.text || '')}</small></span></a>`;
  };
  const listCard = (icon, title, items, renderer, cls, moreUrl, moreLbl) =>
    (!items || !items.length) ? '' :
    `<section class="disc-card ${cls || ''}"><div class="disc-card-h"><span class="disc-ico">${icon}</span><h2>${title}</h2></div><div class="disc-card-b">${items.map(renderer).join('')}</div>${moreUrl ? `<a class="disc-more" href="${e(moreUrl)}" target="_blank" rel="noopener">${moreLbl} →</a>` : ''}</section>`;

  const otd = (data.links && data.links.onthisday) || '';
  const moreL = l === 'pt' ? 'Ver mais' : 'See more';
  const cards = [
    listCard('📜', l === 'pt' ? 'Hoje na História' : 'Today in History', data.history, evItem, '', otd, moreL),
    listCard('🌍', l === 'pt' ? 'Hoje em Portugal' : 'Today in Portugal', data.portugal, evItem, '', otd, moreL),
    listCard('🎂', l === 'pt' ? 'Nasceram Hoje' : 'Born Today', data.births, person, 'disc-people', otd, moreL),
  ];

  panel.innerHTML = `<div class="disc-grid">${cards.join('')}</div>`;
  renderHomeEvents();
}
document.addEventListener('DOMContentLoaded', renderHomeDiscovery);

// ── Eventos perto (4.º cartão): mesma lógica dos Eventos, cidade da meteo, 50 km, 14 dias ──
let _ncEvents = null, _ncPlaces = null;
const HOME_DISTRICT_CENTROIDS = {
  'Aveiro': [40.64, -8.65], 'Beja': [37.96, -7.87], 'Braga': [41.55, -8.42],
  'Bragança': [40.67, -7.50], 'Castelo Branco': [39.83, -7.49], 'Coimbra': [40.21, -8.43],
  'Évora': [38.57, -7.91], 'Faro': [37.01, -7.93], 'Guarda': [40.53, -7.27],
  'Leiria': [39.74, -8.81], 'Lisboa': [38.72, -9.14], 'Porto': [41.16, -8.62],
  'Portalegre': [39.30, -8.57], 'Setúbal': [38.52, -8.89], 'Santarém': [39.23, -8.69],
  'Viana do Castelo': [41.69, -8.83], 'Viseu': [40.66, -7.91], 'Vila Real': [41.30, -7.74],
  'Madeira': [32.75, -17.00], 'Açores': [37.74, -25.67],
};
function _haversine(a, b, c, d) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(c - a), dLon = r(d - b);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const _normd = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

async function renderHomeEvents() {
  const grid = document.querySelector('#disc-panel .disc-grid');
  if (!grid) return;
  grid.querySelector('.he-card')?.remove();   /* idempotent: avoid duplicates on re-render */
  const l = lang(), e = _escH;
  const RADIUS = 50, DAYS = 14;

  /* reference point = the configured weather location, Leiria as fallback */
  const wloc = getWeatherLoc();
  let lat = 39.7436, lon = -8.8071, cityName = 'Leiria';
  if (wloc.lat != null) { lat = wloc.lat; lon = wloc.lon; cityName = wloc.name; }
  else try { const w = await fetchWeatherForLoc(wloc); if (w && w.lat != null) { lat = w.lat; lon = w.lon; cityName = w.city; } } catch (er) {}

  try {
    if (!_ncEvents) { const r = await fetch('data/events/nocartaz.json'); _ncEvents = r.ok ? await r.json() : []; }
    if (!_ncPlaces) { const r = await fetch('data/events/pt-places.json'); _ncPlaces = r.ok ? await r.json() : {}; }
  } catch (er) { return; }

  const arr = Array.isArray(_ncEvents) ? _ncEvents : (_ncEvents.events || []);
  const geo = d => { const k = _normd(d); return _ncPlaces[k] || HOME_DISTRICT_CENTROIDS[d] || null; };
  const start = AppTime.today().getTime(), horizon = start + DAYS * 86400000;
  const near = [];
  for (const ev of arr) {
    const t = Date.parse(ev.start); if (isNaN(t) || t < start || t > horizon) continue;
    const g = geo(ev.district); if (!g) continue;
    const dist = _haversine(lat, lon, g[0], g[1]); if (dist > RADIUS) continue;
    near.push({ ev, t, dist });
  }
  near.sort((a, b) => a.t - b.t);
  const top = near.slice(0, 10);

  const head = `<div class="disc-card-h"><span class="disc-ico">📍</span><h2>${l === 'pt' ? 'Eventos perto' : 'Events nearby'}</h2></div>`;
  let body;
  if (!top.length) {
    body = `<div class="disc-card-b"><div class="he-empty">${l === 'pt' ? `Sem eventos a ${RADIUS} km de ${e(cityName)} nos próximos ${DAYS} dias.` : `No events within ${RADIUS} km of ${e(cityName)} in the next ${DAYS} days.`}</div></div>`;
  } else {
    const item = ({ ev, t }) => {
      const d = new Date(t), dl = `${d.getDate()} ${ms()[d.getMonth()].slice(0, 3)}`;
      const free = ev.free ? `<span class="he-free">${l === 'pt' ? 'grátis' : 'free'}</span>` : '';
      return `<a class="disc-item he-item" href="${e(ev.url || '#')}" target="_blank" rel="noopener"><span class="he-date">${dl}</span><span class="disc-item-txt">${e(ev.title)} <small class="he-loc">· ${e(ev.district)}</small>${free}</span></a>`;
    };
    body = `<div class="disc-card-b">${top.map(item).join('')}</div>`;
  }
  const sub = `<div class="he-sub">${e(cityName)} · ${RADIUS}&nbsp;km · ${l === 'pt' ? `${DAYS} dias` : `${DAYS} days`}</div>`;
  const card = `<section class="disc-card he-card">${head}${sub}${body}<a class="disc-more" href="#eventos">${l === 'pt' ? 'Ver todos os eventos' : 'See all events'} →</a></section>`;
  grid.insertAdjacentHTML('beforeend', card);
}

// ── ÚTIL HOJE (weather · fuel · electricity · holidays) ────────────
function wmo(code, isDay) {
  const m = {
    0:['☀️','Céu limpo','Clear sky'], 1:['🌤️','Pouco nublado','Mainly clear'],
    2:['⛅','Parcialmente nublado','Partly cloudy'], 3:['☁️','Nublado','Overcast'],
    45:['🌫️','Nevoeiro','Fog'], 48:['🌫️','Nevoeiro gelado','Rime fog'],
    51:['🌦️','Chuvisco fraco','Light drizzle'], 53:['🌦️','Chuvisco','Drizzle'], 55:['🌦️','Chuvisco forte','Dense drizzle'],
    56:['🌧️','Chuvisco gelado','Freezing drizzle'], 57:['🌧️','Chuvisco gelado','Freezing drizzle'],
    61:['🌧️','Chuva fraca','Light rain'], 63:['🌧️','Chuva','Rain'], 65:['🌧️','Chuva forte','Heavy rain'],
    66:['🌧️','Chuva gelada','Freezing rain'], 67:['🌧️','Chuva gelada','Freezing rain'],
    71:['🌨️','Neve fraca','Light snow'], 73:['🌨️','Neve','Snow'], 75:['🌨️','Neve forte','Heavy snow'], 77:['🌨️','Grãos de neve','Snow grains'],
    80:['🌦️','Aguaceiros','Showers'], 81:['🌦️','Aguaceiros','Showers'], 82:['⛈️','Aguaceiros fortes','Violent showers'],
    85:['🌨️','Aguaceiros de neve','Snow showers'], 86:['🌨️','Aguaceiros de neve','Snow showers'],
    95:['⛈️','Trovoada','Thunderstorm'], 96:['⛈️','Trovoada c/ granizo','Thunderstorm w/ hail'], 99:['⛈️','Trovoada c/ granizo','Thunderstorm w/ hail'],
  };
  const e = m[+code] || ['🌡️','—','—'];
  let emoji = e[0];
  if ((+code === 0 || +code === 1) && !isDay) emoji = '🌙';
  return { emoji, text: lang() === 'pt' ? e[1] : e[2] };
}

/* Portuguese cities offered by the weather widget's own picker: the 18
   district capitals + islands, with fixed coordinates — picking one never
   touches a geocoder, so the location is always exact. */
const PT_CITIES = [
  ['Aveiro', 40.641, -8.654], ['Beja', 38.015, -7.863], ['Braga', 41.545, -8.427],
  ['Bragança', 41.806, -6.757], ['Castelo Branco', 39.822, -7.491], ['Coimbra', 40.211, -8.429],
  ['Évora', 38.571, -7.913], ['Faro', 37.016, -7.935], ['Funchal', 32.667, -16.924],
  ['Guarda', 40.537, -7.268], ['Leiria', 39.744, -8.807], ['Lisboa', 38.722, -9.139],
  ['Ponta Delgada', 37.740, -25.669], ['Portalegre', 39.291, -7.428], ['Porto', 41.150, -8.610],
  ['Santarém', 39.236, -8.686], ['Setúbal', 38.524, -8.893], ['Viana do Castelo', 41.694, -8.831],
  ['Vila Real', 41.301, -7.742], ['Viseu', 40.657, -7.914],
];
const _citySlug = n => 'pt-' + n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');

function setWeatherCity(row) {
  const loc = { id: _citySlug(row[0]), name: row[0], country: 'PT', lat: row[1], lon: row[2] };
  localStorage.setItem('weather-loc', JSON.stringify(loc));
  localStorage.setItem('weather-city', loc.name);   /* legacy readers */
  document.dispatchEvent(new CustomEvent('weather-city-change'));
}

/* The configured weather location ({id, name, lat, lon}). A legacy city
   string is matched against PT_CITIES first; only truly unknown free text
   falls back to one geocoder resolution (then persisted). */
function getWeatherLoc() {
  try {
    const l = JSON.parse(localStorage.getItem('weather-loc') || 'null');
    if (l && l.lat != null && l.name) return l;
  } catch (e) {}
  const cityName = localStorage.getItem('weather-city') || 'Leiria';
  const row = PT_CITIES.find(c => c[0].toLowerCase() === cityName.toLowerCase());
  if (row) return { id: _citySlug(row[0]), name: row[0], country: 'PT', lat: row[1], lon: row[2] };
  return { name: cityName };
}

async function fetchWeatherForLoc(loc) {
  const key = 'weather-cache3-' + (loc.id != null ? 'id' + loc.id : String(loc.name || '').toLowerCase());
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 3600000 && c.w && c.w.feels != null) return c.w; } catch (e) {}
  try {
    let { lat, lon, name } = loc;
    if (lat == null || lon == null) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=pt`).then(r => r.json());
      const results = (g && g.results) || [];
      const c = results.find(r => r.country_code === 'PT') || results[0];
      if (!c) return null;
      lat = c.latitude; lon = c.longitude; name = c.name;
      /* migrate: persist the resolved id so this lookup never repeats */
      try {
        localStorage.setItem('weather-loc', JSON.stringify({ id: c.id, name: c.name, admin1: c.admin1 || '', country: c.country_code || '', lat, lon }));
      } catch (e) {}
    }
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset&hourly=temperature_2m&timezone=Europe%2FLisbon&forecast_days=6`).then(r => r.json());
    if (!w || !w.current) return null;
    const hT = (w.hourly && w.hourly.temperature_2m) || [];
    const out = {
      city: name, lat, lon,
      temp: Math.round(w.current.temperature_2m), feels: Math.round(w.current.apparent_temperature),
      humidity: Math.round(w.current.relative_humidity_2m), wind: Math.round(w.current.wind_speed_10m),
      code: w.current.weather_code, isDay: w.current.is_day,
      uv: w.daily.uv_index_max[0] != null ? Math.round(w.daily.uv_index_max[0]) : null,
      sunrise: w.daily.sunrise[0], sunset: w.daily.sunset[0],
      days: w.daily.time.map((tt, i) => ({
        date: tt, min: Math.round(w.daily.temperature_2m_min[i]), max: Math.round(w.daily.temperature_2m_max[i]),
        code: w.daily.weather_code[i], pop: w.daily.precipitation_probability_max[i],
        rain: w.daily.precipitation_sum[i], windMax: w.daily.wind_speed_10m_max[i] != null ? Math.round(w.daily.wind_speed_10m_max[i]) : null,
        uv: w.daily.uv_index_max[i] != null ? Math.round(w.daily.uv_index_max[i]) : null,
        sunrise: w.daily.sunrise[i], sunset: w.daily.sunset[i],
        hT: hT.slice(i * 24, i * 24 + 24).map(v => (v == null ? null : Math.round(v * 10) / 10)),
      })),
    };
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), w: out }));
    return out;
  } catch (e) { return null; }
}

function nearestArea(areas, lat, lon) {
  let best = null, bd = Infinity;
  for (const a of areas || []) { const d = (a.lat - lat) ** 2 + (a.lon - lon) ** 2; if (d < bd) { bd = d; best = a; } }
  return best;
}
async function fetchIpmaWarnings() {
  try { const c = JSON.parse(localStorage.getItem('ipma-warn') || 'null'); if (c && Date.now() - c.t < 1800000) return c.w; } catch (e) {}
  try {
    const arr = await fetch('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json').then(r => r.json());
    const now = Date.now(), by = {};
    for (const w of arr) {
      if (!w.idAreaAviso || w.awarenessLevelID === 'green') continue;
      if (w.endTime && new Date(w.endTime).getTime() < now) continue;
      (by[w.idAreaAviso] ||= []).push({ type: w.awarenessTypeName, level: w.awarenessLevelID, start: w.startTime, end: w.endTime, text: (w.text || '').trim() });
    }
    localStorage.setItem('ipma-warn', JSON.stringify({ t: Date.now(), w: by }));
    return by;
  } catch (e) { return null; }
}
function uvLevel(uv) {
  const l = lang(); if (uv == null) return '';
  if (uv < 3) return l === 'pt' ? 'Baixo' : 'Low';
  if (uv < 6) return l === 'pt' ? 'Moderado' : 'Moderate';
  if (uv < 8) return l === 'pt' ? 'Alto' : 'High';
  if (uv < 11) return l === 'pt' ? 'Muito alto' : 'Very high';
  return l === 'pt' ? 'Extremo' : 'Extreme';
}

function upcomingHolidays(n) {
  const today = AppTime.today();
  const y = today.getFullYear();
  const all = [...ptNat(y), ...ptNat(y + 1)];
  return all.filter(h => h.d >= today).sort((a, b) => a.d - b.d).slice(0, n);
}
function daysUntil(d) { return Math.round((d - AppTime.today()) / 86400000); }
function countdownTxt(days) {
  const l = lang();
  if (days <= 0) return l === 'pt' ? 'Hoje' : 'Today';
  if (days === 1) return l === 'pt' ? 'Amanhã' : 'Tomorrow';
  return l === 'pt' ? `faltam ${days} dias` : `in ${days} days`;
}

function openHolidayModal() {
  const l = lang();
  const today = AppTime.today();
  let y = today.getFullYear();
  const ov = document.createElement('div');
  ov.className = 'hm-overlay';
  document.body.appendChild(ov);

  function render() {
    const list = ptNat(y).sort((a, b) => a.d - b.d);
    const rows = list.map(h => {
      const past = y < today.getFullYear() || (y === today.getFullYear() && h.d < today);
      const isToday = h.d.toDateString() === today.toDateString();
      const future = h.d >= today;
      return `<div class="hm-row${past ? ' hm-past' : ''}${isToday ? ' hm-today' : ''}">
        <div class="hm-date"><b>${h.d.getDate()}</b> ${ms()[h.d.getMonth()]}</div>
        <div class="hm-info"><div class="hm-name">${_escH(h.n)}</div><div class="hm-sub">${wd()[h.d.getDay()]}${future ? ` · ${countdownTxt(daysUntil(h.d))}` : ''}</div>
          ${h.r ? `<div class="hm-reason">${_escH(h.r)}</div>` : ''}</div>
      </div>`;
    }).join('');
    ov.innerHTML = `<div class="hm-modal" role="dialog" aria-modal="true" aria-label="${l === 'pt' ? 'Feriados' : 'Holidays'}">
      <div class="hm-head">
        <div class="hm-ynav"><button class="hm-y" data-d="-1" aria-label="${l === 'pt' ? 'Ano anterior' : 'Previous year'}">‹</button><h3>📅 ${y}</h3><button class="hm-y" data-d="1" aria-label="${l === 'pt' ? 'Ano seguinte' : 'Next year'}">›</button></div>
        <button class="hm-close" aria-label="${l === 'pt' ? 'Fechar' : 'Close'}">✕</button></div>
      <div class="hm-body">${rows}</div></div>`;
    ov.querySelector('.hm-close').addEventListener('click', close);
    ov.querySelectorAll('.hm-y').forEach(b => b.addEventListener('click', () => { y += +b.dataset.d; render(); }));
  }
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
  function esc(e) { if (e.key === 'Escape') close(); }
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  render();
}

/* ── Weather widget interactions: city picker + detail popovers ──────
   Wired once via delegation so the hourly/day re-renders never stack
   listeners. _uwData holds the last rendered forecast + warnings. */
let _uwData = null;

/* worst active IPMA warning level overlapping a given local day */
function _dayWarnLvl(dateStr, warns) {
  const sev = { red: 3, orange: 2, yellow: 1 };
  const d0 = new Date(dateStr + 'T00:00').getTime(), d1 = d0 + 86400000;
  let best = 0, lvl = null;
  for (const wn of warns || []) {
    const s = wn.start ? Date.parse(wn.start) : 0, e = wn.end ? Date.parse(wn.end) : s + 1;
    if (s < d1 && e > d0 && (sev[wn.level] || 0) > best) { best = sev[wn.level]; lvl = wn.level; }
  }
  return lvl;
}

/* 24h temperature sparkline (procedural SVG, no libs) */
function _uwSpark(hT) {
  const pts = (hT || []).filter(v => v != null);
  if (pts.length < 6) return '';
  const W = 240, H = 46, lo = Math.min(...pts), hi = Math.max(...pts), rng = (hi - lo) || 1;
  const step = W / (pts.length - 1);
  const xy = pts.map((v, i) => [i * step, H - 8 - ((v - lo) / rng) * (H - 16)]);
  const line = xy.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `0,${H} ` + line + ` ${W},${H}`;
  const hiIx = pts.indexOf(hi), loIx = pts.indexOf(lo);
  return `<div class="uw-spark-wrap">
    <svg class="uw-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="uwsa" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(99,102,241,.35)"/><stop offset="1" stop-color="rgba(99,102,241,0)"/></linearGradient></defs>
      <polygon points="${area}" fill="url(#uwsa)"/>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${xy[hiIx][0].toFixed(1)}" cy="${xy[hiIx][1].toFixed(1)}" r="2.6" fill="#ef4444"/>
      <circle cx="${xy[loIx][0].toFixed(1)}" cy="${xy[loIx][1].toFixed(1)}" r="2.6" fill="#3b82f6"/>
    </svg>
    <div class="uw-spark-x"><span>00h</span><span>12h</span><span>24h</span></div>
  </div>`;
}

function _uwDayHTML(di) {
  if (!_uwData) return '';
  const d = _uwData.w.days[di]; if (!d) return '';
  const l = lang(), dt = new Date(d.date + 'T00:00'), dw = wmo(d.code, 1);
  const fmt1 = v => String((+v).toFixed(1)).replace('.', l === 'pt' ? ',' : '.');
  const cell = (ico, lbl, val) => val == null ? '' :
    `<div class="uw-cell"><span class="uw-cell-i">${ico}</span><span class="uw-cell-l">${lbl}</span><span class="uw-cell-v">${val}</span></div>`;
  const cells = [
    cell('💧', l === 'pt' ? 'Prob. chuva' : 'Rain prob.', d.pop != null ? `${d.pop}%` : null),
    cell('🌧️', l === 'pt' ? 'Precipitação' : 'Precip.', d.rain != null ? `${fmt1(d.rain)} mm` : null),
    cell('💨', l === 'pt' ? 'Vento máx.' : 'Max wind', d.windMax != null ? `${d.windMax} km/h` : null),
    cell('☀️', 'UV', d.uv != null ? `${d.uv} · ${uvLevel(d.uv)}` : null),
    cell('🌅', l === 'pt' ? 'Nascer' : 'Sunrise', d.sunrise ? d.sunrise.slice(11, 16) : null),
    cell('🌇', l === 'pt' ? 'Pôr do sol' : 'Sunset', d.sunset ? d.sunset.slice(11, 16) : null),
  ].join('');
  /* warnings that touch this day */
  const dayWarns = (_uwData.warns || []).filter(wn => {
    const s = wn.start ? Date.parse(wn.start) : 0, e = wn.end ? Date.parse(wn.end) : s + 1;
    return s < dt.getTime() + 86400000 && e > dt.getTime();
  });
  const warnRow = dayWarns.length
    ? `<div class="uw-pop-warns">${dayWarns.map(wn => `<span class="uw-w lvl-${_escH(wn.level)}">⚠️ ${_escH(wn.type)}</span>`).join('')}</div>` : '';
  return `<div class="uw-pop-h"><span class="uw-pop-ico">${AppIcons.weather(d.code, 1, 30)}</span>
      <div><b>${wd()[dt.getDay()]}, ${dt.getDate()} ${ms()[dt.getMonth()]}</b><small>${dw.text} · <span class="uw-max">▲ ${d.max}°</span> <span class="uw-min">▼ ${d.min}°</span></small></div>
      <button type="button" class="uw-pop-x" aria-label="Fechar">✕</button></div>
    ${_uwSpark(d.hT)}
    <div class="uw-pop-grid">${cells}</div>
    ${warnRow}`;
}

function _uwWarnHTML(wi) {
  if (!_uwData) return '';
  const wn = _uwData.warns[wi]; if (!wn) return '';
  const l = lang();
  const lvl = { yellow: l === 'pt' ? 'Amarelo' : 'Yellow', orange: l === 'pt' ? 'Laranja' : 'Orange', red: l === 'pt' ? 'Vermelho' : 'Red' }[wn.level] || wn.level;
  const fmt = x => { try { return new Date(x).toLocaleString(l === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const period = wn.start && wn.end ? `${fmt(wn.start)} → ${fmt(wn.end)}` : '';
  return `<div class="uw-pop-h"><span class="uw-pop-ico">⚠️</span>
      <div><b>${_escH(wn.type)} · <span class="uw-lvl-${_escH(wn.level)}">${lvl}</span></b>${period ? `<small>${period}</small>` : ''}</div>
      <button type="button" class="uw-pop-x" aria-label="Fechar">✕</button></div>
    ${wn.text ? `<div class="uw-pop-txt">${_escH(wn.text)}</div>` : `<div class="uw-pop-txt">${lang() === 'pt' ? 'Aviso IPMA em vigor para a região.' : 'IPMA warning in effect for the region.'}</div>`}`;
}

function _wireWeatherWidget() {
  if (window._uwWired) return;
  window._uwWired = true;
  document.addEventListener('click', ev => {
    if (!document.getElementById('util-panel')) return;
    const pop  = document.getElementById('uw-pop');
    const drop = document.getElementById('uw-city-drop');
    if (ev.target.closest('#uw-city-btn')) {
      if (drop) { drop.hidden = !drop.hidden; if (!drop.hidden) { drop.querySelector('#uw-city-filter')?.focus(); } }
      if (pop) pop.hidden = true;
      return;
    }
    const opt = ev.target.closest('.uw-city-opt');
    if (opt) { setWeatherCity(PT_CITIES[+opt.dataset.ci]); return; }
    if (drop && !drop.hidden && !ev.target.closest('#uw-city-drop')) drop.hidden = true;
    if (ev.target.closest('.uw-pop-x')) { if (pop) pop.hidden = true; return; }
    const day = ev.target.closest('.uw-day[data-di]');
    if (day && pop) {
      pop.innerHTML = _uwDayHTML(+day.dataset.di); pop.hidden = false;
      document.querySelectorAll('.uw-day').forEach(b => b.classList.toggle('on', b === day));
      return;
    }
    const pill = ev.target.closest('.uw-w[data-wi]');
    if (pill && pop) { pop.innerHTML = _uwWarnHTML(+pill.dataset.wi); pop.hidden = false; return; }
    if (pop && !pop.hidden && !ev.target.closest('#uw-pop')) {
      pop.hidden = true;
      document.querySelectorAll('.uw-day.on').forEach(b => b.classList.remove('on'));
    }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const pop = document.getElementById('uw-pop'); if (pop) pop.hidden = true;
    const drop = document.getElementById('uw-city-drop'); if (drop) drop.hidden = true;
  });
  document.addEventListener('input', ev => {
    if (!ev.target || ev.target.id !== 'uw-city-filter') return;
    const q = ev.target.value.toLowerCase();
    document.querySelectorAll('#uw-city-drop .uw-city-opt').forEach(b => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
  });

  /* pointer devices: the detail opens on hover — no click needed
     (click/tap still works everywhere, and is the only path on touch) */
  if (window.matchMedia && matchMedia('(hover: hover)').matches) {
    let hideT = null, curDi = null;
    document.addEventListener('mouseover', ev => {
      const pop = document.getElementById('uw-pop');
      if (!pop) return;
      const day = ev.target.closest('.uw-day[data-di]');
      const pill = ev.target.closest('.uw-w[data-wi]');
      if (day || pill || ev.target.closest('#uw-pop')) { clearTimeout(hideT); hideT = null; }
      if (day) {
        const di = +day.dataset.di;
        if (di !== curDi || pop.hidden) {
          curDi = di;
          pop.innerHTML = _uwDayHTML(di); pop.hidden = false;
          document.querySelectorAll('.uw-day').forEach(b => b.classList.toggle('on', b === day));
        }
      } else if (pill) {
        curDi = null;
        pop.innerHTML = _uwWarnHTML(+pill.dataset.wi); pop.hidden = false;
      }
    });
    document.addEventListener('mouseout', ev => {
      const pop = document.getElementById('uw-pop');
      if (!pop || pop.hidden) return;
      const to = ev.relatedTarget;
      if (to && (to.closest?.('.uw-day') || to.closest?.('#uw-pop') || to.closest?.('.uw-w'))) return;
      clearTimeout(hideT);
      hideT = setTimeout(() => {
        pop.hidden = true; curDi = null;
        document.querySelectorAll('.uw-day.on').forEach(b => b.classList.remove('on'));
      }, 220);
    });
  }
}
_wireWeatherWidget();

async function renderUtility() {
  const panel = document.getElementById('util-panel');
  if (!panel) return;
  const l = lang(), e = _escH;
  const num = (v, dg) => v == null ? '—' : v.toFixed(dg).replace('.', ',');
  const more = (url, label) => `<a class="util-more" href="${url}" target="_blank" rel="noopener">${label} →</a>`;

  let u = null;
  try { const r = await fetch('data/home/utility.json', { cache: 'no-store' }); if (r.ok) u = await r.json(); } catch (er) {}

  /* ── Weather (live for the configured location, fallback utility.json Leiria) ── */
  let w = await fetchWeatherForLoc(getWeatherLoc());
  if (!w && u && u.weather) w = u.weather;

  /* warnings for this city's IPMA area (live, else cached in utility.json) */
  let warnings = [];
  if (w && u && u.ipma) {
    let code = w.area;
    if (!code && w.lat != null) { const a = nearestArea(u.ipma.areas, w.lat, w.lon); code = a && a.code; }
    if (code) { const live = await fetchIpmaWarnings(); warnings = (live && live[code]) || (u.ipma.warnings && u.ipma.warnings[code]) || []; }
  }

  let weatherCard;
  if (w) {
    const cur = wmo(w.code, w.isDay), d0 = w.days && w.days[0];
    /* one pill per warning type (IPMA repeats the same type per time window);
       keep the most severe level of each */
    const sev = { red: 3, orange: 2, yellow: 1 };
    const byType = {};
    for (const wn of warnings) {
      const prev = byType[wn.type];
      if (!prev || (sev[wn.level] || 0) > (sev[prev.level] || 0)) byType[wn.type] = wn;
    }
    const uniqWarn = Object.values(byType);
    _uwData = { w, warns: uniqWarn };
    /* forecast as rows: everything readable at a glance — icon, temps,
       rain probability+amount, max wind, and a warning dot on days covered
       by an active IPMA warning */
    const fmt1 = v => String((+v).toFixed(1)).replace('.', l === 'pt' ? ',' : '.');
    const fc = (w.days || []).slice(1, 6).map((d, ix) => {
      const dw = wmo(d.code, 1), nm = wd()[new Date(d.date + 'T00:00').getDay()].slice(0, 3);
      const lvl = _dayWarnLvl(d.date, warnings);
      return `<button type="button" class="uw-day" data-di="${ix + 1}" aria-label="${nm}">
        <span class="uw-day-n">${nm}${lvl ? `<i class="uw-day-w lvl-${lvl}"></i>` : ''}</span>
        <span class="uw-day-i" title="${dw.text}">${AppIcons.weather(d.code, 1, 20)}</span>
        <span class="uw-day-t"><b>${d.max}°</b><em>${d.min}°</em></span>
        <span class="uw-day-x" title="${l === 'pt' ? 'Prob. de chuva · precipitação' : 'Rain prob. · precipitation'}">💧 ${d.pop != null ? d.pop + '%' : '—'}${d.rain != null && d.rain >= 0.1 ? ` <small>${fmt1(d.rain)}mm</small>` : ''}</span>
        <span class="uw-day-x" title="${l === 'pt' ? 'Vento máximo' : 'Max wind'}">💨 ${d.windMax != null ? d.windMax : '—'}</span>
      </button>`;
    }).join('');
    const stats = [
      w.feels != null ? `<span title="${l === 'pt' ? 'Sensação' : 'Feels like'}">🌡️ ${w.feels}°</span>` : '',
      w.humidity != null ? `<span title="${l === 'pt' ? 'Humidade' : 'Humidity'}">💧 ${w.humidity}%</span>` : '',
      w.wind != null ? `<span title="${l === 'pt' ? 'Vento' : 'Wind'}">💨 ${w.wind} km/h</span>` : '',
      w.uv != null ? `<span title="UV">☀️ UV ${w.uv} <small>${uvLevel(w.uv)}</small></span>` : '',
      w.sunrise && w.sunset ? `<span class="uw-sun-chip" title="${l === 'pt' ? 'Nascer · pôr do sol' : 'Sunrise · sunset'}">🌅 ${w.sunrise.slice(11, 16)} · 🌇 ${w.sunset.slice(11, 16)}</span>` : '',
    ].filter(Boolean).join('');
    const warnHtml = uniqWarn.length ? `<div class="uw-warn">${uniqWarn.slice(0, 4).map((wn, wi) => `<button type="button" class="uw-w lvl-${e(wn.level)}" data-wi="${wi}" title="${e(wn.text || wn.type)}">⚠️ ${e(wn.type)}</button>`).join('')}</div>` : '';
    const cityOpts = PT_CITIES.map((c, ci) =>
      `<button type="button" class="uw-city-opt${c[0] === w.city ? ' on' : ''}" data-ci="${ci}">${c[0]}</button>`).join('');
    weatherCard = `<section class="util-card util-weather">
      <div class="util-h"><span class="util-ico">🌤️</span><h2>${l === 'pt' ? 'Meteorologia' : 'Weather'}</h2>
        <button type="button" class="util-tag uw-city-btn" id="uw-city-btn" aria-haspopup="listbox" title="${l === 'pt' ? 'Mudar cidade' : 'Change city'}">${e(w.city)} <span class="uw-caret">▾</span></button>
        <div class="uw-city-drop" id="uw-city-drop" hidden>
          <input class="uw-city-filter" id="uw-city-filter" type="search" placeholder="${l === 'pt' ? 'Filtrar…' : 'Filter…'}" autocomplete="off">
          <div class="uw-city-list">${cityOpts}</div>
        </div>
      </div>
      <div class="uw-now"><span class="uw-emoji">${AppIcons.weather(w.code, w.isDay, 42)}</span>
        <div class="uw-main"><span class="uw-temp">${w.temp}°</span><span class="uw-state">${cur.text}</span></div>
        ${d0 ? `<div class="uw-mm"><span class="uw-max">▲ ${d0.max}°</span><span class="uw-min">▼ ${d0.min}°</span></div>` : ''}</div>
      <div class="uw-stats">${stats}</div>
      ${warnHtml}
      <div class="uw-fc">${fc}</div>
      <div class="uw-pop" id="uw-pop" hidden></div>
      <div class="util-foot">${more('https://www.ipma.pt/pt/otempo/prev.localidade.hora/', l === 'pt' ? 'Ver no IPMA' : 'See on IPMA')}</div></section>`;
  } else {
    weatherCard = `<section class="util-card util-weather"><div class="util-h"><span class="util-ico">🌤️</span><h2>${l === 'pt' ? 'Meteorologia' : 'Weather'}</h2></div><div class="util-empty">${l === 'pt' ? 'Indisponível' : 'Unavailable'}</div></section>`;
  }

  /* ── Fuel (utility.json — Portugal Continental, comparação semanal) ── */
  let fuelCard = '';
  if (u && u.fuel) {
    const f = u.fuel;
    const row = (label, o, wk) => {
      if (!o || o.price == null) return '';
      const d = wk != null ? wk : o.delta;
      let dl = '';
      if (d != null && Math.abs(d) >= 0.001) { const up = d > 0; dl = `<span class="uf-d ${up ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${num(Math.abs(d), 3)}</span>`; }
      else if (d != null) dl = `<span class="uf-d flat">=</span>`;
      return `<div class="uf-row"><span class="uf-l">${label}</span><span class="uf-p">${num(o.price, 3)} €<small>/L</small></span>${dl}</div>`;
    };
    const wk = f.week || {};
    const foot = f.weekFrom
      ? (l === 'pt' ? `Variação vs ${f.weekFrom.slice(8, 10)}/${f.weekFrom.slice(5, 7)} · DGEG` : `Change vs ${f.weekFrom.slice(8, 10)}/${f.weekFrom.slice(5, 7)} · DGEG`)
      : (l === 'pt' ? 'Média nacional · DGEG' : 'National avg · DGEG');
    fuelCard = `<section class="util-card util-fuel">
      <div class="util-h"><span class="util-ico">⛽</span><h2>${l === 'pt' ? 'Combustíveis' : 'Fuel'}</h2><span class="util-tag">${l === 'pt' ? 'Continente' : 'Mainland'}</span></div>
      ${row('Gasolina 95', f.gasolina95, wk.gasolina95)}${row(l === 'pt' ? 'Gasóleo' : 'Diesel', f.gasoleo, wk.gasoleo)}${row('GPL Auto', f.gpl, wk.gpl)}
      <div class="util-foot">${foot}<br>${more('https://precoscombustiveis.dgeg.gov.pt/', l === 'pt' ? 'Mapa de preços' : 'Price map')}</div></section>`;
  }

  /* ── Energia: eletricidade (estimativa na fatura) + gás natural ── */
  let elecCard = '';
  if (u && u.electricity) {
    const el = u.electricity;
    const trI = el.trend === 'up' ? '<span class="ue-t up">▲</span>' : el.trend === 'down' ? '<span class="ue-t dn">▼</span>' : '';
    const gas = u.gas ? `<div class="ue-gas"><span class="ue-gas-l">🔥 ${l === 'pt' ? 'Gás natural' : 'Natural gas'}</span><span class="ue-gas-v"><b>${num(u.gas.price, 2)}</b> c€/kWh</span><small>${e(u.gas.label)}</small></div>` : '';
    elecCard = `<section class="util-card util-elec">
      <div class="util-h"><span class="util-ico">⚡</span><h2>${l === 'pt' ? 'Energia' : 'Energy'}</h2></div>
      <div class="ue-now"><span class="ue-price">${num(el.bill, 1)}<small> c€/kWh</small></span>${trI}</div>
      <div class="ue-sub">${l === 'pt' ? 'Eletricidade · estimativa indexada (c/ IVA)' : 'Electricity · indexed estimate (incl. VAT)'}</div>
      ${gas}
      <div class="util-foot">OMIE ${num(el.omie, 2)} c€/kWh · ${num(el.min, 1)}–${num(el.max, 1)}<br>${more('https://www.erse.pt/simuladores/', l === 'pt' ? 'Simular fatura (ERSE)' : 'Bill simulator (ERSE)')}</div></section>`;
  }

  /* ── Holidays (next 3 + modal with year navigation) ── */
  const up = upcomingHolidays(3);
  const holRows = up.map(h => `<div class="uh-row"><div class="uh-date"><b>${h.d.getDate()}</b> ${ms()[h.d.getMonth()].slice(0, 3)}</div>
    <div class="uh-info"><span class="uh-name">${e(h.n)}</span><span class="uh-cd">${countdownTxt(daysUntil(h.d))}</span></div></div>`).join('');
  const holCard = `<section class="util-card util-hol">
    <div class="util-h"><span class="util-ico">📅</span><h2>${l === 'pt' ? 'Próximos Feriados' : 'Next Holidays'}</h2></div>
    ${holRows}<button class="uh-all" id="util-hol-all">${l === 'pt' ? 'Ver todos' : 'See all'} →</button></section>`;

  panel.innerHTML = `<div class="util-grid">${weatherCard}${fuelCard}${elecCard}${holCard}</div>`;
  document.getElementById('util-hol-all')?.addEventListener('click', openHolidayModal);
}
document.addEventListener('DOMContentLoaded', renderUtility);

// ── HERO SEARCH (Google-only with autocomplete) ────────────────────
function doSearch(q) {
  if (!q.trim()) return;
  const domain = lang() === 'pt' ? 'google.pt' : 'google.com';
  window.open(`https://www.${domain}/search?q=${encodeURIComponent(q.trim())}`, '_blank', 'noopener');
}

let _acTimer = null;
let _acIdx = -1;
let _acItems = [];

async function fetchAC(q) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=json`, {signal: ctrl.signal});
    const data = await res.json();
    return (data || []).slice(0, 8).map(x => x.phrase || '');
  } catch { return []; }
}

function renderAC(items, input) {
  const box = document.getElementById('hero-autocomplete');
  if (!box) return;
  _acItems = items;
  _acIdx = -1;
  if (!items.length) { box.hidden = true; return; }
  box.innerHTML = items.map((s, i) =>
    `<div class="hero-ac-item" data-i="${i}" role="option">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      ${s}
    </div>`).join('');
  box.hidden = false;
  box.querySelectorAll('.hero-ac-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = _acItems[+el.dataset.i];
      closeAC();
      doSearch(input.value);
    });
  });
}

function closeAC() {
  const box = document.getElementById('hero-autocomplete');
  if (box) box.hidden = true;
  _acIdx = -1;
  _acItems = [];
}

document.addEventListener('DOMContentLoaded', () => {
  const heroInput = document.getElementById('hero-search');
  const heroBtn   = document.getElementById('hero-search-btn');

  if (heroInput) {
    heroInput.placeholder = lang() === 'pt' ? 'Pesquisar no Google.pt…' : 'Search Google.com…';
  }

  if (heroInput) {
    heroInput.addEventListener('input', () => {
      const q = heroInput.value.trim();
      clearTimeout(_acTimer);
      if (!q) { closeAC(); return; }
      _acTimer = setTimeout(async () => {
        const items = await fetchAC(q);
        renderAC(items, heroInput);
      }, 220);
    });
    heroInput.addEventListener('keydown', e => {
      const box = document.getElementById('hero-autocomplete');
      const visible = box && !box.hidden;
      if (e.key === 'ArrowDown' && visible) {
        e.preventDefault();
        _acIdx = Math.min(_acIdx + 1, _acItems.length - 1);
        heroInput.value = _acItems[_acIdx] || heroInput.value;
        box.querySelectorAll('.hero-ac-item').forEach((el, i) => el.classList.toggle('ac-active', i === _acIdx));
        return;
      }
      if (e.key === 'ArrowUp' && visible) {
        e.preventDefault();
        _acIdx = Math.max(_acIdx - 1, -1);
        heroInput.value = _acIdx >= 0 ? _acItems[_acIdx] : heroInput.value;
        box.querySelectorAll('.hero-ac-item').forEach((el, i) => el.classList.toggle('ac-active', i === _acIdx));
        return;
      }
      if (e.key === 'Escape') { closeAC(); return; }
      if (e.key === 'Enter') { e.preventDefault(); closeAC(); doSearch(heroInput.value); }
    });
    heroInput.addEventListener('blur', () => setTimeout(closeAC, 150));
  }
  if (heroBtn) heroBtn.addEventListener('click', () => { closeAC(); doSearch(heroInput?.value || ''); });

});

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const srInput = document.getElementById('search-input');
    if (document.activeElement === srInput) { srInput.blur(); srInput.value = ''; }
  }
});

// ── SITES FAVORITOS (from LINKS_DATA) ────────────────────────────
const DEFAULT_FAV_LINKS = [
  'https://www.notion.so/',
  'https://excalidraw.com/',
  'https://pplware.sapo.pt/',
  'https://lifehacker.com/',
];

function getFavLinks() {
  try { return JSON.parse(localStorage.getItem('home-fav-links') || 'null') || DEFAULT_FAV_LINKS; }
  catch { return DEFAULT_FAV_LINKS; }
}

function allLinksFlat() {
  if (typeof LINKS_DATA === 'undefined') return [];
  return LINKS_DATA.flatMap(c => c.links);
}

function favUrl(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
  catch { return ''; }
}

function setDynGrid(el, count, minPx) {
  const min = minPx || 110;
  el.style.gridTemplateColumns = count <= 2
    ? `repeat(${count || 1},1fr)`
    : `repeat(auto-fill,minmax(${min}px,1fr))`;
}

function renderFavLinks() {
  const grid = document.getElementById('wbm-grid');
  if (!grid) return;
  const urls = getFavLinks();
  const all = allLinksFlat();
  const items = urls.map(url => {
    const found = all.find(l => l.url === url);
    let hostname = url;
    try { hostname = new URL(url).hostname.replace('www.', ''); } catch {}
    return { name: found ? found.name : hostname, url };
  });
  setDynGrid(grid, items.length, 130);
  if (!items.length) {
    grid.innerHTML = '<div class="wft-empty">Sem favoritos. Clica ✎ para adicionar.</div>';
    return;
  }
  grid.innerHTML = items.map(b => {
    const fav = favUrl(b.url);
    return `<a class="wbm-item" href="${b.url}" target="_blank" rel="noopener">
      ${fav ? `<img class="wbm-favicon" src="${fav}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
      <span class="wbm-name">${b.name}</span>
    </a>`;
  }).join('');
}

function openFavLinksEditor() {
  const urls = getFavLinks();
  if (typeof LINKS_DATA === 'undefined' || !LINKS_DATA.length) {
    alert('A carregar dados de links…');
    return;
  }
  let modal = document.getElementById('wfl-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wfl-modal';
    modal.className = 'ph-modal-overlay';
    modal.innerHTML = `<div class="ph-modal-box" style="max-width:480px">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">Sites Favoritos</span>
        <button class="ph-modal-close" id="wfl-modal-close">✕</button>
      </div>
      <div style="padding:1rem;max-height:60vh;overflow-y:auto" id="wfl-chk-list"></div>
      <div style="padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end">
        <button class="t-btn t-btn-ghost" id="wfl-modal-close2">Cancelar</button>
        <button class="t-btn" id="wfl-modal-save">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#wfl-chk-list').innerHTML = LINKS_DATA.map(cat => `
    <div style="margin-bottom:.75rem">
      <div style="font-size:.7rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">${cat.icon} ${cat.cat}</div>
      ${cat.links.map(l => `<label class="wft-chk-item"><input type="checkbox" value="${l.url}" ${urls.includes(l.url) ? 'checked' : ''}> ${l.name}</label>`).join('')}
    </div>`).join('');
  modal.hidden = false;

  const close = () => { modal.hidden = true; };
  modal.querySelector('#wfl-modal-close').onclick = close;
  modal.querySelector('#wfl-modal-close2').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#wfl-modal-save').onclick = () => {
    const selected = [...modal.querySelectorAll('input:checked')].map(i => i.value);
    localStorage.setItem('home-fav-links', JSON.stringify(selected));
    renderFavLinks();
    close();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  renderFavLinks();
  document.getElementById('wbm-add')?.addEventListener('click', openFavLinksEditor);
});

window.Bookmarks = { get: getFavLinks, render: renderFavLinks, favUrl };

// ── FAVORITE TOOLS WIDGET ─────────────────────────────────────────
const ALL_TOOLS = [
  { id:'countdown',  label:'Temporizador',     icon:'⏳', route:'tools' },
  { id:'stopwatch',  label:'Cronómetro',       icon:'⏱️', route:'tools' },
  { id:'pomodoro',   label:'Pomodoro',         icon:'🍅', route:'tools' },
  { id:'json',       label:'JSON',             icon:'{}', route:'tools' },
  { id:'base64',     label:'Base64',           icon:'⌗',  route:'tools' },
  { id:'markdown',   label:'Markdown',         icon:'M↓', route:'tools' },
  { id:'regex',      label:'Regex',            icon:'.*', route:'tools' },
  { id:'uuid',       label:'UUID',             icon:'#',  route:'tools' },
  { id:'timestamp',  label:'Timestamp',        icon:'🕐', route:'tools' },
  { id:'calculator', label:'Calculadora',      icon:'🔢', route:'tools' },
  { id:'colors',     label:'Paleta de Cores',  icon:'🎨', route:'tools' },
  { id:'unitconv',   label:'Conversor',        icon:'⟷', route:'tools' },
];
const DEFAULT_FAV_TOOLS = ['countdown','json','regex','calculator'];

function getFavTools() {
  try { return JSON.parse(localStorage.getItem('home-fav-tools') || 'null') || DEFAULT_FAV_TOOLS; }
  catch { return DEFAULT_FAV_TOOLS; }
}

function renderFavTools() {
  const grid = document.getElementById('wft-grid');
  if (!grid) return;
  const favIds = getFavTools();
  const favItems = favIds.map(id => ALL_TOOLS.find(t => t.id === id)).filter(Boolean);
  setDynGrid(grid, favItems.length, 110);
  if (!favItems.length) {
    grid.innerHTML = '<div class="wft-empty">Sem ferramentas favoritas.</div>';
    return;
  }
  grid.innerHTML = favItems.map(t => `
    <button class="wft-item" data-tool="${t.id}" title="${t.label}">
      <span class="wft-icon">${t.icon}</span>
      <span class="wft-label">${t.label}</span>
    </button>`).join('');
  grid.querySelectorAll('.wft-item').forEach(btn => {
    btn.addEventListener('click', () => {
      Nav.go('tools');
      setTimeout(() => {
        document.querySelector(`.tool-nav-btn[data-tid="${btn.dataset.tool}"]`)?.click();
      }, 150);
    });
  });
}

function openFavToolsEditor() {
  const favIds = getFavTools();
  const checked = ALL_TOOLS.map(t => `
    <label class="wft-chk-item">
      <input type="checkbox" value="${t.id}" ${favIds.includes(t.id) ? 'checked' : ''}> ${t.icon} ${t.label}
    </label>`).join('');

  let modal = document.getElementById('wft-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wft-modal';
    modal.className = 'ph-modal-overlay';
    modal.innerHTML = `<div class="ph-modal-box" style="max-width:400px">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">Ferramentas Favoritas</span>
        <button class="ph-modal-close" id="wft-modal-close">✕</button>
      </div>
      <div style="padding:1rem" id="wft-chk-list"></div>
      <div style="padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end">
        <button class="t-btn t-btn-ghost" id="wft-modal-close2">Cancelar</button>
        <button class="t-btn" id="wft-modal-save">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#wft-chk-list').innerHTML = checked;
  modal.hidden = false;

  const close = () => { modal.hidden = true; };
  modal.querySelector('#wft-modal-close').onclick = close;
  modal.querySelector('#wft-modal-close2').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#wft-modal-save').onclick = () => {
    const ids = [...modal.querySelectorAll('input:checked')].map(i => i.value);
    localStorage.setItem('home-fav-tools', JSON.stringify(ids));
    renderFavTools();
    close();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  renderFavTools();
  document.getElementById('wft-edit')?.addEventListener('click', openFavToolsEditor);
});

// ── FAVORITE GAMES WIDGET ─────────────────────────────────────────
const ALL_GAMES = [
  { id:'hangman',     key:'game.hangman',     icon:'🪢' },
  { id:'minesweeper', key:'game.minesweeper', icon:'💣' },
  { id:'memory',      key:'game.memory',      icon:'🃏' },
  { id:'wordle',      key:'game.wordle',      icon:'📝' },
  { id:'reaction',    key:'game.reaction',    icon:'⚡' },
  { id:'chess',       key:'game.chess',       icon:'♟️' },
  { id:'battleship',  key:'game.battleship',  icon:'🚢' },
  { id:'uno',         key:'game.uno',         icon:'🃏' },
  { id:'bomb',        key:'game.bomb',        icon:'💥' },
  { id:'gravity-lab', key:'game.gravity-lab', icon:'🔬' },
  { id:'neon-shooter',key:'game.neon-shooter',icon:'🛸' },
];
const DEFAULT_FAV_GAMES = ['hangman','minesweeper','wordle','chess'];

function getFavGames() {
  try { return JSON.parse(localStorage.getItem('home-fav-games') || 'null') || DEFAULT_FAV_GAMES; }
  catch { return DEFAULT_FAV_GAMES; }
}

function renderFavGames() {
  const grid = document.getElementById('wfg-grid');
  if (!grid) return;
  const favIds = getFavGames();
  const favItems = favIds.map(id => ALL_GAMES.find(g => g.id === id)).filter(Boolean);
  setDynGrid(grid, favItems.length, 100);
  if (!favItems.length) {
    grid.innerHTML = '<div class="wft-empty">Sem jogos favoritos.</div>';
    return;
  }
  grid.innerHTML = favItems.map(g => `
    <button class="wft-item" data-game="${g.id}" title="${t(g.key)}">
      <span class="wft-icon">${g.icon}</span>
      <span class="wft-label">${t(g.key)}</span>
    </button>`).join('');
  grid.querySelectorAll('.wft-item').forEach(btn => {
    btn.addEventListener('click', () => Nav.go('games/' + btn.dataset.game));
  });
}

function openFavGamesEditor() {
  const favIds = getFavGames();
  let modal = document.getElementById('wfg-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wfg-modal';
    modal.className = 'ph-modal-overlay';
    modal.innerHTML = `<div class="ph-modal-box" style="max-width:400px">
      <div class="ph-modal-hdr">
        <span class="ph-modal-title">Jogos Favoritos</span>
        <button class="ph-modal-close" id="wfg-modal-close">✕</button>
      </div>
      <div style="padding:1rem" id="wfg-chk-list"></div>
      <div style="padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;gap:.5rem;justify-content:flex-end">
        <button class="t-btn t-btn-ghost" id="wfg-modal-close2">Cancelar</button>
        <button class="t-btn" id="wfg-modal-save">Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.querySelector('#wfg-chk-list').innerHTML = ALL_GAMES.map(g => `
    <label class="wft-chk-item">
      <input type="checkbox" value="${g.id}" ${favIds.includes(g.id) ? 'checked' : ''}> ${g.icon} ${t(g.key)}
    </label>`).join('');
  modal.hidden = false;

  const close = () => { modal.hidden = true; };
  modal.querySelector('#wfg-modal-close').onclick = close;
  modal.querySelector('#wfg-modal-close2').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#wfg-modal-save').onclick = () => {
    const ids = [...modal.querySelectorAll('input:checked')].map(i => i.value);
    localStorage.setItem('home-fav-games', JSON.stringify(ids));
    renderFavGames();
    close();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  renderFavGames();
  document.getElementById('wfg-edit')?.addEventListener('click', openFavGamesEditor);
});

// ── TIMEZONE CLOCKS ───────────────────────────────────────────────
function ptTzAbbr() {
  const parts = new Intl.DateTimeFormat('en', {timeZoneName: 'short', timeZone: 'Europe/Lisbon'})
    .formatToParts(new Date());
  return (parts.find(p => p.type === 'timeZoneName') || {}).value || '';
}

function utcOffset(tz) {
  const now = new Date();
  const d = new Date(now.toLocaleString('en-US', {timeZone: tz}));
  const offset = (d - new Date(now.toLocaleString('en-US', {timeZone: 'UTC'}))) / 3600000;
  const sign = offset >= 0 ? '+' : '-';
  const h = Math.floor(Math.abs(offset));
  const m = Math.round((Math.abs(offset) - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2,'0') : ''}`;
}

function renderTimezones() {
  const grid = document.getElementById('wtz-grid');
  if (!grid) return;
  const now = new Date();
  const l = lang();
  const locale = l === 'pt' ? 'pt-PT' : 'en-GB';
  const fmtPT  = new Intl.DateTimeFormat(locale, {timeZone: 'Europe/Lisbon', hour:'2-digit', minute:'2-digit', hour12:false});
  const fmtUTC = new Intl.DateTimeFormat(locale, {timeZone: 'UTC',            hour:'2-digit', minute:'2-digit', hour12:false});
  const abbr   = ptTzAbbr();
  const ptOffset = utcOffset('Europe/Lisbon');
  const ptLabel  = l === 'pt' ? '🇵🇹 Lisboa' : '🇵🇹 Lisbon';
  grid.innerHTML = `
    <div class="wtz-item wtz-primary">
      <span class="wtz-label">${ptLabel}</span>
      <div class="wtz-right">
        <span class="wtz-time" data-tz="Europe/Lisbon">${fmtPT.format(now)}</span>
        <span class="wtz-gmt">${abbr} · ${ptOffset}</span>
      </div>
    </div>
    <div class="wtz-item">
      <span class="wtz-label">GMT</span>
      <div class="wtz-right">
        <span class="wtz-time" data-tz="UTC">${fmtUTC.format(now)}</span>
        <span class="wtz-gmt">UTC+0</span>
      </div>
    </div>
    <div class="wtz-item" style="border-bottom:none">
      <span class="wtz-label">UTC</span>
      <div class="wtz-right">
        <span class="wtz-time" data-tz="UTC">${fmtUTC.format(now)}</span>
        <span class="wtz-gmt">UTC+0</span>
      </div>
    </div>`;
}

function tickTimezones() {
  const now = new Date();
  const l = lang();
  const locale = l === 'pt' ? 'pt-PT' : 'en-GB';
  document.querySelectorAll('.wtz-time[data-tz]').forEach(el => {
    const fmt = new Intl.DateTimeFormat(locale, {timeZone: el.dataset.tz, hour:'2-digit', minute:'2-digit', hour12:false});
    el.textContent = fmt.format(now);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderTimezones();
  document.addEventListener('time:second', tickTimezones);
});

// ── HOLIDAYS ──────────────────────────────────────────────────────
function getEaster(y) {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31), dy=((h+l-7*m+114)%31)+1;
  return new Date(y, mo-1, dy);
}

function ptNat(y) {
  const e   = getEaster(y);
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return [
    {d:new Date(y,0,1),   n:'Ano Novo',                    r:'Celebração do início do novo ano civil.'},
    {d:add(e,-47),        n:'Carnaval',                    r:'Período festivo anterior à Quaresma, com desfiles e mascaras.'},
    {d:add(e,-2),         n:'Sexta-feira Santa',            r:'Morte de Jesus Cristo na cruz, segundo a tradição cristã.'},
    {d:e,                 n:'Páscoa',                      r:'Ressurreição de Jesus Cristo, festa central do calendário cristão.'},
    {d:new Date(y,3,25),  n:'Dia da Liberdade',            r:'Aniversário da Revolução dos Cravos (1974) que restaurou a democracia em Portugal.'},
    {d:new Date(y,4,1),   n:'Dia do Trabalhador',          r:'Celebração internacional dos direitos dos trabalhadores.'},
    {d:add(e,60),         n:'Corpo de Deus',               r:'Festa católica que celebra a presença de Cristo na Eucaristia.'},
    {d:new Date(y,5,10),  n:'Dia de Portugal',             r:'Data da morte de Luís de Camões (1580), símbolo da cultura e identidade portuguesa.'},
    {d:new Date(y,7,15),  n:'Assunção de Nossa Senhora',   r:'Dogma católico da ascensão da Virgem Maria ao Céu.'},
    {d:new Date(y,9,5),   n:'Implantação da República',    r:'Aniversário da proclamação da República Portuguesa (1910).'},
    {d:new Date(y,10,1),  n:'Dia de Todos os Santos',      r:'Dia em que a Igreja Católica honra todos os santos e bem-aventurados.'},
    {d:new Date(y,11,1),  n:'Restauração da Independência',r:'Aniversário da separação de Portugal da Espanha e restauração da monarquia (1640).'},
    {d:new Date(y,11,8),  n:'Imaculada Conceição',         r:'Dogma católico segundo o qual a Virgem Maria foi concebida sem pecado original.'},
    {d:new Date(y,11,25), n:'Natal',                       r:'Celebração do nascimento de Jesus Cristo.'},
  ];
}

const MUN = [
  {m:3, d:15, n:'Mártires de Marrocos',       c:'Santarém'},
  {m:5, d:22, n:'Nossa Senhora da Encarnação', c:'Leiria'},
  {m:6, d:13, n:'Santo António',              c:'Lisboa'},
  {m:6, d:24, n:'São João',                   c:'Porto · Braga · Guimarães'},
  {m:7, d:1,  n:'Dia da Região Autónoma',     c:'Funchal'},
  {m:7, d:4,  n:'Rainha Santa Isabel',        c:'Coimbra'},
  {m:9, d:7,  n:'Feriado Municipal',          c:'Faro'},
  {m:9, d:15, n:'Nossa Senhora da Boa Viagem',c:'Setúbal'},
  {m:11,d:27, n:'Nossa Senhora das Dores',    c:'Viseu'},
  {m:12,d:12, n:'Nossa Senhora da Conceição', c:'Évora'},
];

let holYear = AppTime.now().getFullYear();

function holHTML(date, name, sub, reason) {
  const today = AppTime.today();
  const curYear  = today.getFullYear();
  const isPast   = holYear === curYear && date < today;
  const isToday  = holYear === curYear && date.toDateString() === today.toDateString();
  return `<div class="hol-item${isPast ? ' hol-past' : ''}${isToday ? ' hol-today' : ''}">
    <div class="hol-box">
      <div class="hol-num">${date.getDate()}</div>
      <div class="hol-mon">${ms()[date.getMonth()]}</div>
    </div>
    <div class="hol-info">
      <div class="hol-name">${name}</div>
      <div class="hol-sub">${sub} · ${wd()[date.getDay()]}</div>
      ${reason ? `<div class="hol-reason">${reason}</div>` : ''}
    </div>
  </div>`;
}

function renderHolidays() {
  const y = holYear;
  const lbl = document.getElementById('hol-year-label');
  if (lbl) lbl.textContent = y;
  const nat = ptNat(y).sort((a, b) => a.d - b.d);
  const natEl = document.getElementById('nat-hols');
  if (natEl) natEl.innerHTML = nat.map(h => holHTML(h.d, h.n, t('hol.nat.lbl'), h.r)).join('');
  const mun = MUN.map(m => ({date: new Date(y, m.m - 1, m.d), n: m.n, c: m.c}))
    .sort((a, b) => a.date - b.date);
  const munEl = document.getElementById('mun-hols');
  if (munEl) munEl.innerHTML = mun.map(h => holHTML(h.date, h.n, h.c, '')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hol-prev')?.addEventListener('click', e => { e.stopPropagation(); holYear--; renderHolidays(); });
  document.getElementById('hol-next')?.addEventListener('click', e => { e.stopPropagation(); holYear++; renderHolidays(); });
  renderHolidays();

  const holToggle = document.getElementById('hol-toggle');
  const holBody   = document.getElementById('hol-body');
  const holChev   = document.getElementById('hol-chevron');
  holToggle?.addEventListener('click', () => {
    const open = holBody.hidden;
    holBody.hidden = !open;
    if (holChev) holChev.textContent = open ? '▾' : '▸';
  });
});

document.addEventListener('langchange', () => {
  tick();
  renderWelcome();
  renderHomeDiscovery();
  renderUtility();
});

document.addEventListener('weather-city-change', () => { renderUtility(); renderHomeEvents(); });

// ── TIME-DRIVEN RE-RENDERS ────────────────────────────────────────
// Everything date-dependent re-renders from the single AppTime clock
// (js/core/time.js). No component may keep a date computed at page load:
// a tab left open for days must stay correct without a refresh.
document.addEventListener('time:period', () => {   // Bom dia → Boa tarde → Boa noite
  renderWelcome();
  updateDiscGreeting();
});
document.addEventListener('time:hour', () => {     // weather cache is 1 h, warnings 30 min
  renderUtility();
});
document.addEventListener('time:day', () => {      // midnight, month/year rollover, wake from sleep
  tick();
  renderWelcome();
  _ncEvents = _ncPlaces = null;                    // events snapshot is refreshed daily
  renderHomeDiscovery();                           // also re-runs renderHomeEvents
  renderUtility();
  holYear = AppTime.now().getFullYear();
  renderHolidays();
  renderTimezones();                               // DST: offset/abbr labels can change
});
