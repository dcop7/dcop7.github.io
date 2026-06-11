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

// ── CLOCK ──────────────────────────────────────────────────────────
function tick() {
  const n = new Date();
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
setInterval(tick, 30000);

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

function renderWelcome() {
  const h = new Date().getHours();
  const greeting = h < 12 ? t('home.greet.morning') : h < 19 ? t('home.greet.afternoon') : t('home.greet.evening');
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
document.addEventListener('DOMContentLoaded', loadDailyContent);

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
  { id:'bomb',        key:'game.bomb',        icon:'💥' },
  { id:'gravity-lab', key:'game.gravity-lab', icon:'🔬' },
  { id:'chain-reaction', key:'game.chain-reaction', icon:'⚙️' },
  { id:'bridge-builder', key:'game.bridge-builder', icon:'🌉' },
  { id:'sky-hopper',  key:'game.sky-hopper',  icon:'🌟' },
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
  setInterval(tickTimezones, 1000);
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

let holYear = new Date().getFullYear();

function holHTML(date, name, sub, reason) {
  const today = new Date(); today.setHours(0,0,0,0);
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
  loadDailyContent();
  renderHolidays();
  renderFavGames();
  renderTimezones();
  // Update hero search placeholder for active language
  const heroInput = document.getElementById('hero-search');
  if (heroInput) heroInput.placeholder = lang() === 'pt' ? 'Pesquisar no Google.pt…' : 'Search Google.com…';
});
