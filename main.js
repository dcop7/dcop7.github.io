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

// ── THEME ─────────────────────────────────────────────────────────
let isDark = (localStorage.getItem('theme') ?? (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')) === 'dark';
function applyTheme() {
  document.body.classList.toggle('light', !isDark);
  const t = document.getElementById('theme-track');
  if (t) t.classList.toggle('active', !isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
function toggleTheme() { isDark = !isDark; applyTheme(); }
applyTheme();

// ── CONSTANTS ──────────────────────────────────────────────────────
const WD = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const WMO_MAP = {
  0:{l:'Sol',i:'☀️'},1:{l:'Principalmente sol',i:'🌤️'},2:{l:'Parcialmente nublado',i:'⛅'},
  3:{l:'Nublado',i:'☁️'},45:{l:'Nevoeiro',i:'🌫️'},48:{l:'Nevoeiro gelado',i:'🌫️'},
  51:{l:'Chuvisco leve',i:'🌦️'},53:{l:'Chuvisco',i:'🌦️'},55:{l:'Chuvisco forte',i:'🌧️'},
  61:{l:'Chuva leve',i:'🌧️'},63:{l:'Chuva',i:'🌧️'},65:{l:'Chuva forte',i:'🌧️'},
  71:{l:'Neve leve',i:'🌨️'},73:{l:'Neve',i:'❄️'},75:{l:'Neve forte',i:'❄️'},
  80:{l:'Aguaceiros',i:'🌦️'},81:{l:'Aguaceiros',i:'🌧️'},82:{l:'Aguaceiros fortes',i:'⛈️'},
  95:{l:'Trovoada',i:'⛈️'},96:{l:'Trovoada c/ granizo',i:'⛈️'},99:{l:'Trovoada intensa',i:'⛈️'},
};
const wmo = c => WMO_MAP[c] || {l:'Desconhecido',i:'🌡️'};

function compass(d) {
  return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(d / 22.5) % 16];
}
function uvCls(v) { return v <= 2 ? 'uv-low' : v <= 5 ? 'uv-mod' : v <= 7 ? 'uv-high' : v <= 10 ? 'uv-vhigh' : 'uv-extreme'; }
function fmtT(iso) { return iso ? iso.slice(11, 16) : '—'; }

// ── CLOCK ──────────────────────────────────────────────────────────
function tick() {
  const n = new Date();
  document.getElementById('date-el').textContent =
    `${WD[n.getDay()]}, ${n.getDate()} de ${MO[n.getMonth()]} de ${n.getFullYear()}`;
  document.getElementById('time-el').textContent =
    n.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
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

function renderWelcome() {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bom dia! ☀️' : h < 19 ? 'Boa tarde! 🌤️' : 'Boa noite! 🌙';
  const msg = WELCOME_MSGS[Math.floor(Math.random() * WELCOME_MSGS.length)];
  const gEl = document.getElementById('wc-greeting');
  const mEl = document.getElementById('wc-msg');
  if (gEl) gEl.textContent = greeting;
  if (mEl) mEl.textContent = msg;
}
renderWelcome();

async function fetchJoke() {
  const bust = `&_=${Date.now()}`;
  try {
    const ptRes = await fetch(`https://v2.jokeapi.dev/joke/Any?lang=pt&type=single,twopart&safe-mode${bust}`, {cache:'no-store'});
    const pt = await ptRes.json();
    if (!pt.error) return pt;
    const enRes = await fetch(`https://v2.jokeapi.dev/joke/Any?lang=en&type=single,twopart&safe-mode${bust}`, {cache:'no-store'});
    return await enRes.json();
  } catch { return null; }
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
    <button class="dc-reveal" onclick="this.nextElementSibling.style.display='block';this.style.display='none'">Ver resposta</button>
    <div class="dc-answer">${r.a}</div>`;

  if (jEl) {
    const j = await fetchJoke();
    jEl.innerHTML = jokeHTML(j);
  }
}
loadDailyContent();

// ── WINDY MAP ─────────────────────────────────────────────────────
let mapLatLon = [39.7436, -8.8071];

function setMap(lat, lon, ov = 'rain') {
  document.getElementById('windy-map').src =
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}` +
    `&zoom=6&level=surface&overlay=${ov}&product=ecmwf&menu=&message=true&marker=true` +
    `&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
}

document.getElementById('map-tabs').addEventListener('click', e => {
  const b = e.target.closest('.map-tab');
  if (!b) return;
  document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
  b.classList.add('active');
  setMap(mapLatLon[0], mapLatLon[1], b.dataset.ov);
});

// ── POPUP ─────────────────────────────────────────────────────────
const popup = document.getElementById('popup');
let popT;
let currentCityMeta = null;

function positionPopup(anchor, pw = 268) {
  const r = anchor.getBoundingClientRect();
  popup.style.width = pw + 'px';
  let left = r.left + r.width / 2 - pw / 2;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  popup.style.left = `${left}px`;
  popup.style.top  = `${r.bottom + 8}px`;
  requestAnimationFrame(() => {
    const ph = popup.getBoundingClientRect().height;
    const topAbove = r.top - ph - 10;
    if (topAbove >= 8) popup.style.top = `${topAbove}px`;
  });
}

function hidePopup() {
  clearTimeout(popT);
  popT = setTimeout(() => { popup.classList.remove('show', 'city-pop'); popup.style.width = ''; }, 130);
}

function showCityPopup(anchor, meta) {
  if (!meta) return;
  clearTimeout(popT);
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(meta.wiki)}`;
  const knownHTML = (meta.known || []).map(k => `<li>${k}</li>`).join('');
  popup.classList.add('city-pop');
  popup.innerHTML = `
    <div class="pop-city-hdr"><span class="pop-city-hdr-icon">🏙️</span>${meta.name}</div>
    <div class="pop-city-stats">
      ${meta.founded ? `<div class="pop-city-row"><span class="pop-city-lbl">Fundada em</span><span class="pop-city-val">${meta.founded}</span></div>` : ''}
      ${meta.pop    ? `<div class="pop-city-row"><span class="pop-city-lbl">Habitantes</span><span class="pop-city-val">${meta.pop}</span></div>` : ''}
    </div>
    ${knownHTML ? `<div class="pop-city-known">
      <div class="pop-city-known-ttl">Mais conhecido por</div>
      <ul class="pop-city-list">${knownHTML}</ul>
    </div>` : ''}
    <a class="pop-city-wiki" href="${wikiUrl}" target="_blank" rel="noopener">Ver na Wikipedia &rarr;</a>`;
  positionPopup(anchor, 300);
  popup.classList.add('show');
}

// ── GAUGE POPUP ───────────────────────────────────────────────────
const gaugePop = document.getElementById('gauge-pop');
let gaugeT;

const GAUGES = {
  wind:{lbl:'Vento',unit:'km/h',min:0,max:120,
    ticks:[{v:0,l:'Calmo',c:'#4ade80'},{v:20,l:'Suave',c:'#86efac'},{v:39,l:'Moderado',c:'#facc15'},{v:62,l:'Forte',c:'#fb923c'},{v:89,l:'Tempestade',c:'#f87171'}]},
  humidity:{lbl:'Humidade',unit:'%',min:0,max:100,
    ticks:[{v:0,l:'Seca',c:'#fcd34d'},{v:30,l:'Confortável',c:'#4ade80'},{v:60,l:'Húmida',c:'#60a5fa'},{v:80,l:'Muito Húmida',c:'#818cf8'}]},
  pressure:{lbl:'Pressão',unit:'hPa',min:960,max:1040,
    ticks:[{v:960,l:'Muito Baixa',c:'#93c5fd'},{v:980,l:'Baixa',c:'#60a5fa'},{v:1000,l:'Normal',c:'#4ade80'},{v:1020,l:'Alta',c:'#fb923c'}]},
  cloud:{lbl:'Nebulosidade',unit:'%',min:0,max:100,
    ticks:[{v:0,l:'Limpo',c:'#fcd34d'},{v:25,l:'Pouco Nublado',c:'#a5b4fc'},{v:50,l:'Parcialmente Nublado',c:'#94a3b8'},{v:87,l:'Nublado',c:'#64748b'}]},
  uv:{lbl:'Índice UV',unit:'',min:0,max:12,
    ticks:[{v:0,l:'Baixo',c:'#4ade80'},{v:3,l:'Moderado',c:'#facc15'},{v:6,l:'Alto',c:'#fb923c'},{v:8,l:'Muito Alto',c:'#f87171'},{v:11,l:'Extremo',c:'#c084fc'}]},
  precipitation:{lbl:'Precipitação',unit:'mm',min:0,max:30,
    ticks:[{v:0,l:'Sem chuva',c:'#4ade80'},{v:2.5,l:'Ligeira',c:'#93c5fd'},{v:7.5,l:'Moderada',c:'#60a5fa'},{v:15,l:'Forte',c:'#3b82f6'}]},
  sunrise:{lbl:'Nascer do Sol',unit:''},
  sunset:{lbl:'Pôr do Sol',unit:''},
};

function getGaugeCat(g, val) {
  let cat = g.ticks?.[0];
  if (!g.ticks) return null;
  for (const t of g.ticks) { if (val >= t.v) cat = t; }
  return cat;
}

function showGaugePop(anchor, key, val) {
  const g = GAUGES[key];
  if (!g || !g.ticks) return;
  clearTimeout(gaugeT);
  const cat = getGaugeCat(g, val);
  const pct = Math.min(100, Math.max(0, ((val - g.min) / (g.max - g.min)) * 100));
  const scaleHTML = g.ticks.map(t =>
    `<span><span class="gp-sc-dot" style="background:${t.c}"></span>${t.l}</span>`).join('');
  gaugePop.innerHTML = `
    <div class="gp-lbl">${g.lbl}</div>
    <div class="gp-val">${val}${g.unit ? '<span style="font-size:.7rem;opacity:.5;margin-left:.1rem">' + g.unit + '</span>' : ''}
      ${cat ? `<span class="gp-cat" style="color:${cat.c}">${cat.l}</span>` : ''}</div>
    <div class="gp-bar-bg"><div class="gp-bar-fill" style="width:${pct}%;background:${cat?.c || 'var(--accent)'}"></div></div>
    <div class="gp-scale">${scaleHTML}</div>`;

  const r = anchor.getBoundingClientRect();
  const pw = 210;
  let left = r.left + r.width / 2 - pw / 2;
  let top  = r.top - 160;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top < 8) top = r.bottom + 6;
  gaugePop.style.left = `${left}px`;
  gaugePop.style.top  = `${top}px`;
  gaugePop.classList.add('show');
}

function hideGaugePop() {
  clearTimeout(gaugeT);
  gaugeT = setTimeout(() => gaugePop.classList.remove('show'), 130);
}

document.getElementById('weather-hero').addEventListener('mouseover', e => {
  const b = e.target.closest('.stat-box[data-gauge]');
  if (b) showGaugePop(b, b.dataset.gauge, +b.dataset.gv);
});
document.getElementById('weather-hero').addEventListener('click', e => {
  const wrap = e.target.closest('.hero-city-img-wrap');
  if (wrap) { showCityPopup(wrap, currentCityMeta); return; }
  const b = e.target.closest('.stat-box[data-gauge]');
  if (b) showGaugePop(b, b.dataset.gauge, +b.dataset.gv);
});
document.getElementById('weather-hero').addEventListener('mouseleave', hideGaugePop);

// ── FORECAST POPUP ────────────────────────────────────────────────
function showForecastPopup(anchor, data, dayAlerts) {
  clearTimeout(popT);
  const w = wmo(data.code);
  const dt = new Date(data.date + 'T12:00:00');
  const dayLabel  = data.dayName === 'Hoje' ? 'Hoje' : WD[dt.getDay()];
  const dateLabel = `${dt.getDate()} de ${MO[dt.getMonth()]}`;

  const aLvl = {yellow:'pill-y', orange:'pill-o', red:'pill-r'};
  const aTxt = {yellow:'Amarelo', orange:'Laranja', red:'Vermelho'};
  const seenAlerts = new Set();
  const uniqueAlerts = (dayAlerts || []).filter(a => {
    const k = `${a.awarenessLevelID || a.awarenessLevel || ''}|${a.awarenessTypeName || ''}`;
    return seenAlerts.has(k) ? false : (seenAlerts.add(k), true);
  });
  const alertsHTML = uniqueAlerts.length ? `
    <div class="pop-alerts">
      ${uniqueAlerts.map(a => {
        const lvl  = (a.awarenessLevelID || a.awarenessLevel || 'yellow').toLowerCase();
        const type = a.awarenessTypeName || 'Aviso';
        const areas = (a.areas || []).filter(Boolean).join(', ');
        const end  = a.endTime || '';
        return `<div class="pop-alert-row">
          <span class="alert-pill ${aLvl[lvl] || 'pill-y'}">⚠️ ${aTxt[lvl] || 'Aviso'}</span>
          <span>${type}${areas ? ' · ' + areas : ''}${end ? ' até ' + fmtT(end) : ''}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  popup.innerHTML = `
    <div class="pop-day">${dayLabel}</div>
    <div class="pop-date">${dateLabel}</div>
    <div class="pop-hero">
      <div class="pop-icon">${w.i}</div>
      <div>
        <div class="pop-hi">${data.maxT}°C</div>
        <div class="pop-lo">Mín ${data.minT}°C</div>
        ${data.feelsMax != null ? `<div class="pop-feels">Sensação até ${data.feelsMax}°C</div>` : ''}
        <div class="pop-cond">${w.l}</div>
      </div>
    </div>
    <div class="pop-grid">
      <div class="pop-stat"><div class="ps-l">Vento máx.</div><div class="ps-v">${data.wind} km/h</div></div>
      <div class="pop-stat"><div class="ps-l">Rajadas</div><div class="ps-v">${data.gusts ?? '—'} km/h</div></div>
      <div class="pop-stat"><div class="ps-l">Humidade</div><div class="ps-v">${data.hum ?? '—'}%</div></div>
      <div class="pop-stat"><div class="ps-l">Prob. chuva</div><div class="ps-v">${data.rain}%</div></div>
      <div class="pop-stat"><div class="ps-l">Precipitação</div><div class="ps-v">${(+data.precip || 0).toFixed(1)} mm</div></div>
      ${data.uv != null ? `<div class="pop-stat"><div class="ps-l">Índice UV</div><div class="ps-v ${uvCls(data.uv)}">${data.uv}</div></div>` : ''}
    </div>
    ${data.sunrise ? `<div class="pop-sun"><span>🌅 Nascer ${fmtT(data.sunrise)}</span><span>🌇 Pôr ${fmtT(data.sunset)}</span></div>` : ''}
    ${alertsHTML}`;

  positionPopup(anchor);
  popup.classList.add('show');
}

// ── HOURLY POPUP ──────────────────────────────────────────────────
let hourlyStore = null;

function showHourlyPopup(anchor, idx) {
  clearTimeout(popT);
  if (!hourlyStore) return;
  const hr = hourlyStore;
  const t  = hr.time[idx] || '';
  const hw = wmo(hr.weather_code[idx]);
  const temp   = Math.round(hr.temperature_2m[idx]);
  const feels  = hr.apparent_temperature ? Math.round(hr.apparent_temperature[idx]) : null;
  const rain   = hr.precipitation_probability[idx] ?? 0;
  const precip = hr.precipitation ? +(hr.precipitation[idx] ?? 0) : 0;
  const wind   = Math.round(hr.wind_speed_10m[idx]);
  const wDir   = compass(hr.wind_direction_10m[idx]);
  const cloud  = hr.cloud_cover?.[idx] ?? '—';
  const gusts  = hr.wind_gusts_10m ? Math.round(hr.wind_gusts_10m[idx]) : null;
  const hour   = t.slice(11, 16) || '—';

  popup.innerHTML = `
    <div class="pop-day">${hour === '—' ? 'Agora' : hour}</div>
    <div class="pop-date">${hw.l}</div>
    <div class="pop-hero">
      <div class="pop-icon">${hw.i}</div>
      <div>
        <div class="pop-hi">${temp}°C</div>
        ${feels != null ? `<div class="pop-lo">Sensação ${feels}°C</div>` : ''}
      </div>
    </div>
    <div class="pop-grid">
      <div class="pop-stat"><div class="ps-l">Vento</div><div class="ps-v">${wind} km/h</div></div>
      <div class="pop-stat"><div class="ps-l">Direção</div><div class="ps-v">${wDir}</div></div>
      ${gusts != null ? `<div class="pop-stat"><div class="ps-l">Rajadas</div><div class="ps-v">${gusts} km/h</div></div>` : ''}
      <div class="pop-stat"><div class="ps-l">Nuvens</div><div class="ps-v">${cloud}%</div></div>
      <div class="pop-stat"><div class="ps-l">Prob. chuva</div><div class="ps-v">${rain}%</div></div>
      ${precip > 0 ? `<div class="pop-stat"><div class="ps-l">Precipitação</div><div class="ps-v">${precip.toFixed(1)} mm</div></div>` : ''}
    </div>`;

  positionPopup(anchor);
  popup.classList.add('show');
}

document.getElementById('hourly-scroll').addEventListener('mouseover', e => {
  const card = e.target.closest('.h-card');
  if (!card || !('idx' in card.dataset)) return;
  showHourlyPopup(card, +card.dataset.idx);
});
document.getElementById('hourly-scroll').addEventListener('mouseleave', hidePopup);

// ── IPMA ALERTS ───────────────────────────────────────────────────
let activeAlerts = [];

async function fetchAlerts() {
  try {
    const r   = await fetch('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json');
    const raw = await r.json();
    const now = Date.now();
    const map = {};
    (Array.isArray(raw) ? raw : []).forEach(w => {
      const lvl = (w.awarenessLevelID || w.awarenessLevel || '').toLowerCase();
      if (!['yellow','orange','red'].includes(lvl)) return;
      const key = `${lvl}|${w.awarenessTypeName}|${w.startTime || ''}|${w.endTime || ''}`;
      if (!map[key]) map[key] = {...w, lvl, areas:[]};
      const area = w.area_name_pt || w.regionName || '';
      if (area && !map[key].areas.includes(area)) map[key].areas.push(area);
    });
    activeAlerts = Object.values(map).filter(w => {
      const s = new Date(w.startTime || w.start_time || 0).getTime();
      const e = new Date(w.endTime   || w.end_time   || 0).getTime();
      return now >= s && now <= e;
    });
  } catch { activeAlerts = []; }
}

function getAlertsForDay(dateStr) {
  const s = new Date(dateStr + 'T00:00:00').getTime();
  const e = new Date(dateStr + 'T23:59:59').getTime();
  return activeAlerts.filter(a => {
    const as = new Date(a.startTime || a.start_time || 0).getTime();
    const ae = new Date(a.endTime   || a.end_time   || 0).getTime();
    return as <= e && ae >= s;
  });
}

// ── WEATHER ───────────────────────────────────────────────────────
const CITY_META = {
  '38.7223,-9.1393': {name:'Lisboa',        wiki:'Lisbon',            founded:'c. 138 a.C.',pop:'547 000',  known:['Torre de Belém','Mosteiro dos Jerónimos','Alfama e Castelo de São Jorge','Oceanário de Lisboa','Tram 28']},
  '41.1579,-8.6291': {name:'Porto',         wiki:'Porto',             founded:'c. 300 d.C.', pop:'237 000', known:['Centro Histórico (Património UNESCO)','Caves do Vinho do Porto','Livraria Lello','Ponte D. Luís I','Ribeira']},
  '41.5454,-8.4265': {name:'Braga',         wiki:'Braga',             founded:'16 a.C.',     pop:'193 000', known:['Bom Jesus do Monte','Sé de Braga (mais antiga de Portugal)','Termas Romanas do Alto da Cividade','Braga Romana']},
  '40.2033,-8.4103': {name:'Coimbra',       wiki:'Coimbra',           founded:'c. 138 a.C.', pop:'106 000', known:['Universidade (Património UNESCO)','Biblioteca Joanina','Fado de Coimbra','Mosteiro de Santa Cruz','Rio Mondego']},
  '37.0193,-7.9304': {name:'Faro',          wiki:'Faro,_Portugal',    founded:'séc. X (mouros)',pop:'64 000',known:['Cidade Velha amuralhada','Parque Natural da Ria Formosa','Praia de Faro','Sé Catedral','Museu Municipal']},
  '38.5667,-7.9000': {name:'Évora',         wiki:'Évora',             founded:'séc. I a.C.', pop:'57 000',  known:['Templo Romano (Património UNESCO)','Aqueduto da Prata','Cromeleque dos Almendres','Catedral de Évora']},
  '40.6405,-8.6538': {name:'Aveiro',        wiki:'Aveiro,_Portugal',  founded:'séc. XI',     pop:'81 000',  known:['Canais e Moliceiros (Veneza Portuguesa)','Arte Nova','Praia da Costa Nova','Museu de Aveiro','Ovos Moles']},
  '38.5244,-8.8882': {name:'Setúbal',       wiki:'Setúbal',           founded:'1249',        pop:'121 000', known:['Parque Natural da Arrábida','Baía e Estuário do Sado','Castelo de Palmela','Mercado do Livramento','Peixinhos da Horta']},
  '40.6566,-7.9122': {name:'Viseu',         wiki:'Viseu',             founded:'séc. I a.C.', pop:'100 000', known:['Museu Grão Vasco','Sé Catedral de Viseu','Centro Histórico Medieval','Vinho Dão','Festas da Cidade']},
  '39.7436,-8.8071': {name:'Leiria',        wiki:'Leiria',            founded:'1135',        pop:'127 000', known:['Castelo de Leiria','Mosteiro da Batalha (UNESCO)','Pinhal de Leiria (Rei D. Dinis)','Praia da Nazaré','Museu de Arte Islâmica']},
  '39.2333,-8.6833': {name:'Santarém',      wiki:'Santarém,_Portugal',founded:'séc. I a.C.', pop:'63 000',  known:['Capital do Gótico Português','Feira Nacional da Agricultura','Torre das Cabaças','Jardas da Ribeira de Santarém']},
  '32.6669,-16.9241':{name:'Funchal',       wiki:'Funchal',           founded:'1424',        pop:'112 000', known:['Mercado dos Lavradores','Carros de Cesto do Monte','Jardim Botânico da Madeira','Levadas da Madeira','Vinho Madeira']},
  '37.7412,-25.6756':{name:'Ponta Delgada', wiki:'Ponta_Delgada',     founded:'1546',        pop:'68 000',  known:['Portas da Cidade','Caldeira das Sete Cidades','Lagoa das Furnas','Termas da Ribeira Grande','Cozido das Furnas']},
};

// ── HERO WEATHER ANIMATIONS (ha-*) ────────────────────────────────
function haRays(n = 10, innerR = 32, container = 130) {
  const cx = container / 2;
  return Array.from({length: n}, (_, i) => {
    const angle = (360 / n) * i;
    const h = i % 2 === 0 ? 22 : 16;
    const top = cx - innerR - h;
    const toY = h + innerR;
    return `<div class="ha-ray" style="height:${h}px;top:${top}px;left:${cx - 2}px;transform-origin:2px ${toY}px;transform:rotate(${angle}deg);--rd:${(i * (2.8 / n)).toFixed(2)}s"></div>`;
  }).join('');
}

function haCloud(dark = false, w = 96, h = 58, top = 56, left = 27) {
  const dk = dark ? ' ha-dark' : '';
  const p1w = Math.round(w * .42), p2w = Math.round(w * .52), p3w = Math.round(w * .36);
  const bH = Math.round(h * .52);
  return `<div class="ha-cloud-g${dk}" style="top:${top}px;left:${left}px">
    <div class="ha-cp" style="width:${p1w}px;height:${p1w}px;bottom:${bH}px;left:${Math.round(w*.06)}px"></div>
    <div class="ha-cp" style="width:${p2w}px;height:${p2w}px;bottom:${bH}px;left:${Math.round(w*.25)}px"></div>
    <div class="ha-cp" style="width:${p3w}px;height:${p3w}px;bottom:${bH}px;left:${Math.round(w*.58)}px"></div>
    <div class="ha-cb" style="width:${w}px;height:${bH + 6}px;bottom:0;left:0"></div>
    <div class="ha-cshadow" style="width:${Math.round(w*.65)}px;height:${Math.round(h*.2)}px;bottom:-${Math.round(h*.13)}px;left:${Math.round(w*.18)}px"></div>
  </div>`;
}

function haDrops(cfgs) {
  return cfgs.map(([l, t, h, spd, dly]) =>
    `<div class="ha-drop" style="left:${l}px;top:${t}px;height:${h}px;--hspd:${spd}s;--hdly:${dly}s"></div>`
  ).join('');
}

function haFlakes(cfgs) {
  return cfgs.map(([l, t, sz, spd, dly, sx]) =>
    `<div class="ha-flake" style="left:${l}px;top:${t}px;width:${sz}px;height:${sz}px;--hspd:${spd}s;--hdly:${dly}s;--hsx:${sx}px"></div>`
  ).join('');
}

function haAnimHTML(code) {
  const c = +code;
  if (c <= 1)
    return `<div class="ha-wrap">
      <div class="ha-rays-ring">${haRays(10)}</div>
      <div class="ha-corona"></div>
      <div class="ha-core"></div>
    </div>`;
  if (c === 2)
    return `<div class="ha-wrap">
      <div class="ha-ms-wrap" style="top:8px;left:6px;width:62px;height:62px">
        <div class="ha-ms-ring" style="width:62px;height:62px;top:0;left:0">${haRays(8, 16, 62)}</div>
        <div class="ha-ms-core" style="width:28px;height:28px;box-shadow:0 0 14px rgba(255,185,0,.9),0 0 28px rgba(255,120,0,.55)"></div>
      </div>
      ${haCloud(false, 90, 54, 72, 24)}
    </div>`;
  if (c === 3)
    return `<div class="ha-wrap">${haCloud(false, 104, 62, 44, 23)}</div>`;
  if (c === 45 || c === 48)
    return `<div class="ha-wrap">
      ${haCloud(false, 90, 54, 10, 30)}
      <div class="ha-fog-b" style="width:82px;left:34px;top:74px;--hfd:3.5s;--hfdl:0s"></div>
      <div class="ha-fog-b" style="width:66px;left:42px;top:87px;--hfd:4.3s;--hfdl:.7s"></div>
      <div class="ha-fog-b" style="width:72px;left:36px;top:100px;--hfd:3.8s;--hfdl:1.4s"></div>
    </div>`;
  if (c >= 51 && c <= 55)
    return `<div class="ha-wrap">
      ${haCloud(false, 88, 52, 10, 31)}
      ${haDrops([[42,72,13,.96,0],[56,70,12,1.1,.32],[70,73,13,.9,.65]])}
    </div>`;
  if ((c >= 61 && c <= 65) || (c >= 80 && c <= 82))
    return `<div class="ha-wrap">
      ${haCloud(true, 100, 56, 8, 25)}
      ${haDrops([[34,74,15,.72,0],[49,72,16,.78,.16],[63,75,15,.7,.38],[77,73,16,.74,.24],[90,76,13,.68,.52]])}
    </div>`;
  if (c >= 71 && c <= 75)
    return `<div class="ha-wrap">
      ${haCloud(true, 92, 54, 8, 29)}
      ${haFlakes([[40,72,8,1.5,0,3],[55,70,7,1.3,.45,-3],[70,74,8,1.55,.85,4],[85,71,6,1.4,.25,-2]])}
    </div>`;
  if (c >= 95)
    return `<div class="ha-wrap">
      ${haCloud(true, 102, 58, 8, 24)}
      ${haDrops([[36,74,14,.7,0],[52,72,15,.72,.2],[68,76,14,.68,.42]])}
      <div class="ha-bolt" style="bottom:6px;left:50%;transform:translateX(-50%)">⚡</div>
    </div>`;
  return `<div class="ha-wrap" style="font-size:3rem;display:flex;align-items:center;justify-content:center">${wmo(c).i}</div>`;
}

// ── SMALL WEATHER ANIMATIONS (wa-* for other uses) ────────────────
function sunWrap(scale = 1, opacity = 1) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((ra, i) =>
    `<div class="wa-sun-ray" style="--ra:${ra}deg;--rd:${(i * 0.15).toFixed(2)}s"></div>`).join('');
  const sz = Math.round(18 * scale);
  return `<div class="wa-sun-wrap" style="opacity:${opacity}">
    ${rays}<div class="wa-sun-core" style="width:${sz}px;height:${sz}px"></div>
  </div>`;
}
function cloudGrp(dark = false) {
  return `<div class="wa-cloud-grp${dark ? ' wa-cloud-dark' : ''}">
    <div class="wa-cl-body"></div><div class="wa-cl-p1"></div><div class="wa-cl-p2"></div>
  </div>`;
}
function drops(configs) {
  return configs.map(([x, h, spd, dly]) =>
    `<div class="wa-drop" style="left:${x}px;top:32px;height:${h}px;--spd:${spd}s;--dly:${dly}s"></div>`
  ).join('');
}
function flakes(configs) {
  return configs.map(([x, spd, dly, sx]) =>
    `<div class="wa-flake" style="left:${x}px;top:30px;--spd:${spd}s;--dly:${dly}s;--sx:${sx || 4}px"></div>`
  ).join('');
}

function getAnimHTML(code) {
  const c = +code;
  if (c === 0 || c === 1)
    return `<div class="w-anim">${sunWrap()}</div>`;
  if (c === 2)
    return `<div class="w-anim" style="position:relative">
      <div class="wa-pcloudy-sun">${[0,45,90,135,180,225,270,315].map((ra,i)=>`<div class="wa-sun-ray" style="--ra:${ra}deg;--rd:${(i*.12).toFixed(2)}s"></div>`).join('')}<div class="wa-sun-core" style="width:16px;height:16px"></div></div>
      <div style="position:absolute;bottom:4px;right:4px">${cloudGrp()}</div>
    </div>`;
  if (c === 3)
    return `<div class="w-anim">${cloudGrp(true)}</div>`;
  if (c === 45 || c === 48)
    return `<div class="w-anim" style="position:relative">
      ${cloudGrp(true)}
      <div class="wa-fog-line" style="width:50px;left:8px;top:46px;--fd:3.5s;--fdl:0s"></div>
      <div class="wa-fog-line" style="width:38px;left:16px;top:54px;--fd:4.5s;--fdl:.8s"></div>
    </div>`;
  if (c >= 51 && c <= 55)
    return `<div class="w-anim" style="position:relative">${cloudGrp()}${drops([[24,9,.95,0],[34,11,1.15,.35],[44,9,.9,.7]])}</div>`;
  if ((c >= 61 && c <= 65) || (c >= 80 && c <= 82))
    return `<div class="w-anim" style="position:relative">${cloudGrp(true)}${drops([[18,12,.68,0],[28,14,.76,.18],[38,11,.7,.42],[50,12,.65,.28]])}</div>`;
  if (c >= 71 && c <= 75)
    return `<div class="w-anim" style="position:relative">${cloudGrp(true)}${flakes([[20,1.45,0,3],[33,1.25,.4,-3],[46,1.55,.75,4]])}</div>`;
  if (c >= 95)
    return `<div class="w-anim" style="position:relative">${cloudGrp(true)}${drops([[20,12,.62,0],[33,14,.68,.22],[46,11,.6,.48]])}<div class="wa-bolt">⚡</div></div>`;
  return `<div class="w-anim" style="font-size:2.6rem;display:flex;align-items:center;justify-content:center">${wmo(c).i}</div>`;
}

const CITY_OPTIONS = `
  <option value="38.7223,-9.1393">Lisboa</option>
  <option value="41.1579,-8.6291">Porto</option>
  <option value="41.5454,-8.4265">Braga</option>
  <option value="40.2033,-8.4103">Coimbra</option>
  <option value="37.0193,-7.9304">Faro</option>
  <option value="38.5667,-7.9000">Évora</option>
  <option value="40.6405,-8.6538">Aveiro</option>
  <option value="38.5244,-8.8882">Setúbal</option>
  <option value="40.6566,-7.9122">Viseu</option>
  <option value="39.7436,-8.8071">Leiria</option>
  <option value="39.2333,-8.6833">Santarém</option>
  <option value="32.6669,-16.9241">Funchal</option>
  <option value="37.7412,-25.6756">Ponta Delgada</option>`;

document.getElementById('weather-hero').addEventListener('change', e => {
  if (e.target.matches('.hero-city-select')) loadWeather(e.target.value);
});

async function loadWeather(latlon) {
  const [lat, lon] = latlon.split(',').map(Number);
  mapLatLon = [lat, lon];
  setMap(lat, lon, document.querySelector('.map-tab.active')?.dataset.ov || 'rain');

  const hero   = document.getElementById('weather-hero');
  const curVal = latlon;
  const meta   = CITY_META[latlon] || {name: latlon, wiki: null};

  currentCityMeta = meta;

  const heroLeft = imgHTML => `
    <div class="hero-left">
      <div class="hero-city-img-wrap">${imgHTML}</div>
      <select class="hero-city-select">${CITY_OPTIONS}</select>
    </div>`;

  hero.innerHTML = `<div class="hero-body">
    ${heroLeft('<div class="hero-city-img-ph">📷</div>')}
    <div class="hero-center" style="color:rgba(107,125,160,.8);font-size:.85rem">A carregar meteorologia…</div>
    <div class="hero-right"></div>
  </div>`;
  hero.querySelector('.hero-city-select').value = curVal;

  document.getElementById('hourly-row').innerHTML = '';
  document.getElementById('forecast-row').innerHTML = '';

  const [weatherRes, wikiRes] = await Promise.allSettled([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,weather_code,surface_pressure,cloud_cover` +
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,relative_humidity_2m_max,uv_index_max,sunrise,sunset` +
      `&timezone=Europe%2FLisbon&forecast_days=7`
    ).then(r => r.json()),
    meta.wiki
      ? fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(meta.wiki)}`).then(r => r.json())
      : Promise.resolve(null),
    fetchAlerts(),
  ]);

  if (weatherRes.status !== 'fulfilled') {
    hero.innerHTML = `<div class="hero-body">
      ${heroLeft('<div class="hero-city-img-ph">📷</div>')}
      <div class="hero-center" style="color:#ef4444;font-size:.85rem">Erro ao carregar meteorologia.</div>
      <div class="hero-right"></div>
    </div>`;
    hero.querySelector('.hero-city-select').value = curVal;
    return;
  }

  const {current: c, daily: dl, hourly: hr} = weatherRes.value;
  hourlyStore = hr;

  const cw  = wmo(c.weather_code);
  const uv0 = dl.uv_index_max?.[0] ?? null;
  const maxToday = Math.round(dl.temperature_2m_max[0]);
  const minToday = Math.round(dl.temperature_2m_min[0]);

  const wikiThumb = wikiRes.status === 'fulfilled' && wikiRes.value?.thumbnail?.source;
  const imgHTML = wikiThumb
    ? `<img class="hero-city-img" src="${wikiThumb}" alt="${meta.name}">`
    : `<div class="hero-city-img-ph">📷 ${meta.name}</div>`;

  function statBar(key, val) {
    const g = GAUGES[key]; if (!g?.ticks) return '';
    const pct = Math.min(100, Math.max(0, ((val - (g.min || 0)) / ((g.max || 100) - (g.min || 0))) * 100));
    const cat = getGaugeCat(g, val);
    return `<div class="sbox-bar"><div class="sbox-bar-fill" style="width:${pct}%;background:${cat?.c || 'var(--accent)'}"></div></div>`;
  }

  const wxCat = (+c.weather_code) <= 1 ? 'sun'
    : (+c.weather_code) === 2 ? 'pcloudy'
    : (+c.weather_code) <= 48 ? ((+c.weather_code) >= 45 ? 'fog' : 'cloud')
    : (+c.weather_code) <= 55 ? 'drizzle'
    : (+c.weather_code) <= 82 ? 'rain'
    : (+c.weather_code) <= 75 ? 'snow' : 'storm';
  hero.setAttribute('data-wx', wxCat);

  const windVal = Math.round(c.wind_speed_10m);
  const uvVal   = uv0 ?? 0;
  const precVal = +(c.precipitation || 0);

  hero.innerHTML = `<div class="hero-body">
    ${heroLeft(imgHTML)}
    <div class="hero-center">
      <div class="hero-wx-icon">${haAnimHTML(c.weather_code)}</div>
      <div class="hero-temp-block">
        <div class="hero-temp">${Math.round(c.temperature_2m)}<sup>°C</sup></div>
        <div class="hero-cond">${cw.l}</div>
        <div class="hero-feels">Sensação: ${Math.round(c.apparent_temperature)}°C</div>
        <div class="hero-minmax">↑ ${maxToday}° · ↓ ${minToday}°</div>
      </div>
    </div>
    <div class="hero-right">
      <div class="stat-grid">
        <div class="stat-box" data-gauge="wind" data-gv="${windVal}">
          <div class="sbox-icon">💨</div><div class="sbox-label">Vento</div>
          <div class="sbox-val">${windVal} <span style="font-size:.6rem;opacity:.5">km/h</span></div>
          <div class="sbox-sub">${compass(c.wind_direction_10m)}</div>
          ${statBar('wind', windVal)}
        </div>
        <div class="stat-box" data-gauge="humidity" data-gv="${c.relative_humidity_2m}">
          <div class="sbox-icon">💧</div><div class="sbox-label">Humidade</div>
          <div class="sbox-val">${c.relative_humidity_2m}<span style="font-size:.6rem;opacity:.5">%</span></div>
          ${statBar('humidity', c.relative_humidity_2m)}
        </div>
        <div class="stat-box" data-gauge="pressure" data-gv="${Math.round(c.surface_pressure)}">
          <div class="sbox-icon">🌡️</div><div class="sbox-label">Pressão</div>
          <div class="sbox-val">${Math.round(c.surface_pressure)} <span style="font-size:.6rem;opacity:.5">hPa</span></div>
          ${statBar('pressure', Math.round(c.surface_pressure))}
        </div>
        <div class="stat-box" data-gauge="cloud" data-gv="${c.cloud_cover}">
          <div class="sbox-icon">☁️</div><div class="sbox-label">Nuvens</div>
          <div class="sbox-val">${c.cloud_cover}<span style="font-size:.6rem;opacity:.5">%</span></div>
          ${statBar('cloud', c.cloud_cover)}
        </div>
        <div class="stat-box" data-gauge="uv" data-gv="${uvVal}">
          <div class="sbox-icon">🌞</div><div class="sbox-label">Índice UV</div>
          <div class="sbox-val ${uv0 != null ? uvCls(uv0) : ''}">${uv0 ?? '—'}</div>
          ${statBar('uv', uvVal)}
        </div>
        <div class="stat-box" data-gauge="precipitation" data-gv="${precVal}">
          <div class="sbox-icon">🌧️</div><div class="sbox-label">Precipitação</div>
          <div class="sbox-val">${precVal} <span style="font-size:.6rem;opacity:.5">mm</span></div>
          ${statBar('precipitation', precVal)}
        </div>
        <div class="stat-box">
          <div class="sbox-icon">🌅</div><div class="sbox-label">Nascer do sol</div>
          <div class="sbox-val">${fmtT(dl.sunrise?.[0])}</div>
        </div>
        <div class="stat-box">
          <div class="sbox-icon">🌇</div><div class="sbox-label">Pôr do sol</div>
          <div class="sbox-val">${fmtT(dl.sunset?.[0])}</div>
        </div>
      </div>
    </div>
  </div>`;

  hero.querySelector('.hero-city-select').value = curVal;

  const cityWrap = hero.querySelector('.hero-city-img-wrap');
  if (cityWrap) {
    cityWrap.addEventListener('mouseenter', () => { clearTimeout(popT); showCityPopup(cityWrap, currentCityMeta); });
    cityWrap.addEventListener('mouseleave', hidePopup);
  }

  // ── HOURLY ──
  const nowTs = Date.now();
  let hi = hr.time.findIndex(t => new Date(t).getTime() >= nowTs);
  if (hi < 0) hi = 0;

  document.getElementById('hourly-row').innerHTML = hr.time.slice(hi, hi + 24).map((t, i) => {
    const idx  = hi + i;
    const hw   = wmo(hr.weather_code[idx]);
    const rain = hr.precipitation_probability[idx] ?? 0;
    return `<div class="h-card${i === 0 ? ' h-now' : ''}" data-idx="${idx}">
      <div class="h-time">${i === 0 ? 'Agora' : t.slice(11, 16)}</div>
      <div class="h-ico">${hw.i}</div>
      <div class="h-tmp">${Math.round(hr.temperature_2m[idx])}°</div>
      <div class="h-prcp">${rain > 0 ? rain + '%' : ''}</div>
    </div>`;
  }).join('');

  // ── 7-DAY FORECAST ──
  const fcRow = document.getElementById('forecast-row');
  fcRow.innerHTML = '';
  dl.time.forEach((dateStr, i) => {
    const dt       = new Date(dateStr + 'T12:00:00');
    const dn       = i === 0 ? 'Hoje' : WD[dt.getDay()];
    const dw       = wmo(dl.weather_code[i]);
    const maxT     = Math.round(dl.temperature_2m_max[i]);
    const minT     = Math.round(dl.temperature_2m_min[i]);
    const rain     = dl.precipitation_probability_max?.[i] ?? 0;
    const wind     = Math.round(dl.wind_speed_10m_max?.[i] ?? 0);
    const gusts    = dl.wind_gusts_10m_max?.[i] != null ? Math.round(dl.wind_gusts_10m_max[i]) : null;
    const hum      = dl.relative_humidity_2m_max?.[i] ?? null;
    const precip   = dl.precipitation_sum?.[i] ?? 0;
    const uv       = dl.uv_index_max?.[i] != null ? Math.round(dl.uv_index_max[i]) : null;
    const feelsMax = dl.apparent_temperature_max?.[i] != null ? Math.round(dl.apparent_temperature_max[i]) : null;
    const sunrise  = dl.sunrise?.[i] ?? '';
    const sunset   = dl.sunset?.[i] ?? '';

    const dayAlerts  = getAlertsForDay(dateStr);
    const hasAlert   = dayAlerts.length > 0;
    const alertColor = hasAlert
      ? (dayAlerts[0].lvl === 'red'    ? 'rgba(239,68,68,.35)'
       : dayAlerts[0].lvl === 'orange' ? 'rgba(249,115,22,.35)'
       : 'rgba(245,158,11,.35)')
      : '';
    const rainBar = rain > 5 ? `🌧️ ${rain}%` : '';

    const card = document.createElement('div');
    card.className = 'fc' + (i === 0 ? ' fc-today' : '');
    if (hasAlert) card.style.borderColor = alertColor;
    card.innerHTML = `
      <div class="fc-day">${dn}</div>
      <div class="fc-date">${dt.getDate()} ${MS[dt.getMonth()]}</div>
      <div class="fc-ico">${dw.i}</div>
      <div class="fc-temps"><span class="fc-hi-v">↑ ${maxT}°</span><span class="fc-sep">/</span><span class="fc-lo-v">↓ ${minT}°</span></div>
      <div class="fc-rain">${rainBar}</div>
      ${hasAlert ? `<div class="fc-alert-dot">${dayAlerts[0].lvl === 'red' ? '🔴' : dayAlerts[0].lvl === 'orange' ? '🟠' : '🟡'}</div>` : ''}`;

    card.addEventListener('mouseenter', () => showForecastPopup(card, {
      date:dateStr, dayName:dn, code:dl.weather_code[i],
      maxT, minT, feelsMax, wind, gusts, hum, rain, precip, uv, sunrise, sunset
    }, dayAlerts));
    card.addEventListener('mouseleave', hidePopup);
    fcRow.appendChild(card);
  });
}

loadWeather('39.7436,-8.8071');

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
      <div class="hol-mon">${MS[date.getMonth()]}</div>
    </div>
    <div>
      <div class="hol-name">${name}</div>
      <div class="hol-sub">${sub} · ${WD[date.getDay()]}</div>
    </div>
  </div>`;
}

function renderHolidays() {
  const y = holYear;
  document.getElementById('hol-year-label').textContent = y;
  const nat = ptNat(y).sort((a, b) => a.d - b.d);
  document.getElementById('nat-hols').innerHTML = nat.map(h => holHTML(h.d, h.n, 'Nacional')).join('');
  const mun = MUN.map(m => ({date: new Date(y, m.m - 1, m.d), n: m.n, c: m.c}))
    .sort((a, b) => a.date - b.date);
  document.getElementById('mun-hols').innerHTML = mun.map(h => holHTML(h.date, h.n, h.c)).join('');
}

document.getElementById('hol-prev').addEventListener('click', () => { holYear--; renderHolidays(); });
document.getElementById('hol-next').addEventListener('click', () => { holYear++; renderHolidays(); });
renderHolidays();
