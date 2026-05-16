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
    if (themeBtn) themeBtn.addEventListener('click', openPanel);
    document.addEventListener('click', e => {
      const panel = document.getElementById('theme-panel');
      if (!panel?.classList.contains('open')) return;
      if (!panel.contains(e.target) && e.target !== themeBtn) closePanel();
    });
  });

  return { apply: _apply, openPanel, closePanel };
})();

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
    n.toLocaleTimeString(l === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' });
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
renderWelcome();

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
loadDailyContent();

// ── HERO SEARCH (Google-only with autocomplete) ────────────────────
function doSearch(q) {
  if (!q.trim()) return;
  window.open(`https://www.google.com/search?q=${encodeURIComponent(q.trim())}`, '_blank', 'noopener');
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

  const qaPalette = document.getElementById('qa-palette');
  if (qaPalette) qaPalette.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('cp:open'));
  });
});

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────
let _gKey = null;
document.addEventListener('keydown', e => {
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
  const cpOpen = !document.getElementById('cp-overlay')?.hidden;

  if (e.key === 'Escape') {
    if (cpOpen) { document.dispatchEvent(new CustomEvent('cp:close')); return; }
    const srInput = document.getElementById('search-input');
    if (document.activeElement === srInput) { srInput.blur(); srInput.value = ''; }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('cp:open'));
    return;
  }

  if (typing || cpOpen) return;

  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
    return;
  }

  if (e.key === 'g' || e.key === 'G') { _gKey = Date.now(); return; }

  if (_gKey && Date.now() - _gKey < 1500 && typeof Nav !== 'undefined') {
    const map = { h:'home', g:'games', l:'links', t:'tools', c:'cheatsheets', m:'media', w:'workout' };
    const dest = map[e.key.toLowerCase()];
    if (dest) { e.preventDefault(); Nav.go(dest); }
    _gKey = null;
    return;
  }
  _gKey = null;
});

// ── BOOKMARKS ────────────────────────────────────────────────────
const DEFAULT_BOOKMARKS = [
  { name:'GitHub',      url:'https://github.com' },
  { name:'Google',      url:'https://google.com' },
  { name:'YouTube',     url:'https://youtube.com' },
  { name:'ChatGPT',     url:'https://chatgpt.com' },
  { name:'MDN',         url:'https://developer.mozilla.org' },
  { name:'StackOverflow', url:'https://stackoverflow.com' },
];

function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('home-bookmarks') || 'null') || DEFAULT_BOOKMARKS; }
  catch { return DEFAULT_BOOKMARKS; }
}

function saveBookmarks(bm) {
  localStorage.setItem('home-bookmarks', JSON.stringify(bm));
}

function favUrl(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
  catch { return ''; }
}

function renderBookmarks() {
  const grid = document.getElementById('wbm-grid');
  if (!grid) return;
  const bm = getBookmarks();
  if (!bm.length) {
    grid.innerHTML = '<div class="wbm-empty">Sem favoritos. Clica + para adicionar.</div>';
    return;
  }
  grid.innerHTML = bm.map((b, i) => {
    const fav = favUrl(b.url);
    return `<a class="wbm-item" href="${b.url}" target="_blank" rel="noopener" data-i="${i}">
      ${fav ? `<img class="wbm-favicon" src="${fav}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
      <span class="wbm-favicon-ph"${fav ? ' style="display:none"' : ''}>🌐</span>
      <span class="wbm-name">${b.name}</span>
    </a>`;
  }).join('');
}

function addBookmark() {
  const urlRaw = prompt('URL do site:');
  if (!urlRaw) return;
  let url = urlRaw.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  let name;
  try { name = new URL(url).hostname.replace('www.', ''); } catch { name = url; }
  const label = prompt('Nome:', name);
  if (!label) return;
  const bm = getBookmarks();
  bm.push({ name: label.trim(), url });
  saveBookmarks(bm);
  renderBookmarks();
}

document.addEventListener('DOMContentLoaded', () => {
  renderBookmarks();
  document.getElementById('wbm-add')?.addEventListener('click', addBookmark);
});

// ── TIMEZONE CLOCKS ───────────────────────────────────────────────
const TZ_ZONES = [
  { label: 'Portugal',  tz: 'Europe/Lisbon' },
  { label: 'UTC',       tz: 'UTC' },
  { label: 'New York',  tz: 'America/New_York' },
];

function renderTimezones() {
  const grid = document.getElementById('wtz-grid');
  if (!grid) return;
  const now = new Date();
  grid.innerHTML = TZ_ZONES.map(z => {
    const fmt = new Intl.DateTimeFormat('pt-PT', {timeZone: z.tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
    const dateFmt = new Intl.DateTimeFormat('pt-PT', {timeZone: z.tz, day:'2-digit', month:'short'});
    return `<div class="wtz-item">
      <div class="wtz-label">${z.label}</div>
      <div class="wtz-time" data-tz="${z.tz}">${fmt.format(now)}</div>
      <div class="wtz-date">${dateFmt.format(now)}</div>
    </div>`;
  }).join('');
}

function tickTimezones() {
  const now = new Date();
  document.querySelectorAll('.wtz-time[data-tz]').forEach(el => {
    const fmt = new Intl.DateTimeFormat('pt-PT', {timeZone: el.dataset.tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
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
    {d:new Date(y,0,1),   n:'Ano Novo'},
    {d:add(e,-47),        n:'Carnaval'},
    {d:add(e,-2),         n:'Sexta-feira Santa'},
    {d:e,                 n:'Páscoa'},
    {d:new Date(y,3,25),  n:'Dia da Liberdade'},
    {d:new Date(y,4,1),   n:'Dia do Trabalhador'},
    {d:add(e,60),         n:'Corpo de Deus'},
    {d:new Date(y,5,10),  n:'Dia de Portugal'},
    {d:new Date(y,7,15),  n:'Assunção de Nossa Senhora'},
    {d:new Date(y,9,5),   n:'Implantação da República'},
    {d:new Date(y,10,1),  n:'Dia de Todos os Santos'},
    {d:new Date(y,11,1),  n:'Restauração da Independência'},
    {d:new Date(y,11,8),  n:'Imaculada Conceição'},
    {d:new Date(y,11,25), n:'Natal'},
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

function holHTML(date, name, sub) {
  const today = new Date(); today.setHours(0,0,0,0);
  const curYear  = today.getFullYear();
  const isPast   = holYear === curYear && date < today;
  const isToday  = holYear === curYear && date.toDateString() === today.toDateString();
  return `<div class="hol-item${isPast ? ' hol-past' : ''}${isToday ? ' hol-today' : ''}">
    <div class="hol-box">
      <div class="hol-num">${date.getDate()}</div>
      <div class="hol-mon">${ms()[date.getMonth()]}</div>
    </div>
    <div>
      <div class="hol-name">${name}</div>
      <div class="hol-sub">${sub} · ${wd()[date.getDay()]}</div>
    </div>
  </div>`;
}

function renderHolidays() {
  const y = holYear;
  const lbl = document.getElementById('hol-year-label');
  if (lbl) lbl.textContent = y;
  const nat = ptNat(y).sort((a, b) => a.d - b.d);
  const natEl = document.getElementById('nat-hols');
  if (natEl) natEl.innerHTML = nat.map(h => holHTML(h.d, h.n, t('hol.nat.lbl'))).join('');
  const mun = MUN.map(m => ({date: new Date(y, m.m - 1, m.d), n: m.n, c: m.c}))
    .sort((a, b) => a.date - b.date);
  const munEl = document.getElementById('mun-hols');
  if (munEl) munEl.innerHTML = mun.map(h => holHTML(h.date, h.n, h.c)).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hol-prev')?.addEventListener('click', () => { holYear--; renderHolidays(); });
  document.getElementById('hol-next')?.addEventListener('click', () => { holYear++; renderHolidays(); });
  renderHolidays();
});

document.addEventListener('langchange', () => {
  tick();
  renderWelcome();
  loadDailyContent();
  renderHolidays();
});
