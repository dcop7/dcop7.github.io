/* ══════════════════════════════════════════════════════════════════
   CIDADÃO — camada de agregação e alerta sobre o Estado português
   Missão: mostrar rapidamente o que há para tratar, o que mudou, o que
   está a chegar e o que pode estar a escapar (apoios subutilizados).
   Dados:
     data/cidadao/calendario.json  regras de prazos (anuais + pessoais)
     data/cidadao/apoios.json      catálogo curado de apoios/benefícios
     data/cidadao/novidades.json   novidades oficiais (GitHub Action, 6/6h)
   O motor de prazos expande as regras no browser com o AppTime como
   relógio único; o perfil (localStorage) personaliza tudo: IUC pelo mês
   da matrícula, inspeção pela idade do carro, validade do CC/carta, e
   filtragem de prazos/apoios por situação de vida. Sem chaves de API.
══════════════════════════════════════════════════════════════════ */
const CidadaoPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const BASE = 'data/cidadao/';
  const DAY = 86400000;

  /* ── Categorias de prazos ── */
  const CATS = {
    impostos:  { icon: '🧾', pt: 'Impostos',   en: 'Taxes',      color: '#f59e0b' },
    automovel: { icon: '🚗', pt: 'Automóvel',  en: 'Car',        color: '#3b82f6' },
    documentos:{ icon: '🪪', pt: 'Documentos', en: 'Documents',  color: '#8b5cf6' },
    habitacao: { icon: '🏠', pt: 'Habitação',  en: 'Housing',    color: '#14b8a6' },
    familia:   { icon: '👨‍👩‍👧', pt: 'Família', en: 'Family',     color: '#ec4899' },
    educacao:  { icon: '🎓', pt: 'Educação',   en: 'Education',  color: '#06b6d4' },
    saude:     { icon: '🏥', pt: 'Saúde',      en: 'Health',     color: '#22c55e' },
    trabalho:  { icon: '💼', pt: 'Trabalho',   en: 'Work',       color: '#a16207' },
    pensoes:   { icon: '👴', pt: 'Pensões',    en: 'Pensions',   color: '#f472b6' },
    energia:   { icon: '⚡', pt: 'Energia',    en: 'Energy',     color: '#eab308' },
    mobilidade:{ icon: '🚆', pt: 'Mobilidade', en: 'Mobility',   color: '#10b981' },
    outros:    { icon: '✨', pt: 'Outros',     en: 'Other',      color: '#64748b' },
  };
  const cat = (k) => CATS[k] || CATS.outros;
  const catLabel = (k) => _t(cat(k).en, cat(k).pt);

  /* ── Perfil (tags de situação de vida) ── */
  const TAGS = [
    ['jovem',        '🧑', 'Under 36',        'Até 35 anos'],
    ['estudante',    '🎓', 'Student',         'Estudante'],
    ['familia',      '👨‍👩‍👧', 'Has children', 'Com filhos'],
    ['senior',       '🧓', '65+',             '65+ anos'],
    ['trabalhador',  '💼', 'Employee',        'Por conta de outrem'],
    ['independente', '🧮', 'Self-employed',   'Independente'],
    ['desempregado', '🔍', 'Unemployed',      'Desempregado'],
    ['inquilino',    '🏘️', 'Renting',         'Vivo em casa arrendada'],
    ['proprietario', '🔑', 'Homeowner',       'Casa própria'],
    ['carro',        '🚗', 'Car owner',       'Tenho carro'],
    ['deficiencia',  '♿', 'Disability',      'Com deficiência'],
    ['cuidador',     '❤️‍🩹', 'Caregiver',    'Cuidador informal'],
    ['emigrante',    '✈️', 'Returning emigrant', 'Emigrante/regresso'],
    ['baixos',       '🪙', 'Low income',      'Rendimentos baixos'],
  ];

  /* ── Temas das novidades ── */
  const NTOPICS = {
    legislacao: { icon: '📜', pt: 'Legislação', en: 'Legislation' },
    impostos:   { icon: '🧾', pt: 'Impostos',   en: 'Taxes' },
    apoios:     { icon: '🤝', pt: 'Apoios',     en: 'Benefits' },
    habitacao:  { icon: '🏠', pt: 'Habitação',  en: 'Housing' },
    trabalho:   { icon: '💼', pt: 'Trabalho',   en: 'Work' },
    saude:      { icon: '🏥', pt: 'Saúde',      en: 'Health' },
    educacao:   { icon: '🎓', pt: 'Educação',   en: 'Education' },
    documentos: { icon: '🪪', pt: 'Documentos', en: 'Documents' },
    outros:     { icon: '📌', pt: 'Outros',     en: 'Other' },
  };

  const TABS = [
    ['agora',     '⚡', 'Now',       'Agora'],
    ['prazos',    '📅', 'Deadlines', 'Prazos'],
    ['apoios',    '🤝', 'Benefits',  'Apoios'],
    ['novidades', '🆕', 'Updates',   'Novidades'],
  ];

  /* ── Estado ── */
  let _cal = null, _apoios = null, _nov = null;
  let _tab = 'agora';
  let _pzCat = '', _pzMine = false;
  let _apCat = '', _apQuery = '', _apLittle = false;
  let _nvTopic = '', _nvSource = '';

  /* Perfil + prazos seguidos (localStorage) */
  const LS_PROFILE = 'cidadao-profile', LS_FOLLOW = 'cidadao-follow';
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(LS_PROFILE)) || {}; } catch { return {}; }
  }
  function saveProfile(p) { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch {} }
  let _profile = loadProfile();          /* { tags:[], matMonth, matYear, ccExpiry, cartaExpiry } */
  function loadFollow() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_FOLLOW)) || []); } catch { return new Set(); }
  }
  function saveFollow() { try { localStorage.setItem(LS_FOLLOW, JSON.stringify([..._follow])); } catch {} }
  let _follow = loadFollow();

  /* ── helpers ── */
  const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function _fetchJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    return fetch(url, { signal: ctrl.signal }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).finally(() => clearTimeout(t));
  }
  const _today = () => (typeof AppTime !== 'undefined' ? AppTime.today() : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })());
  const fmtDate = (d, opts) => d.toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', opts || { day: 'numeric', month: 'long' });
  const fmtMonthYear = (d) => d.toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { month: 'long', year: 'numeric' });
  function relTime(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return _t('just now', 'agora mesmo');
    const m = s / 60; if (m < 60) return _t(`${m | 0} min ago`, `há ${m | 0} min`);
    const h = m / 60; if (h < 24) return _t(`${h | 0}h ago`, `há ${h | 0}h`);
    const d = h / 24; if (d < 7) { const n = d | 0; return _t(`${n}d ago`, n === 1 ? 'há 1 dia' : `há ${n} dias`); }
    return new Date(ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' });
  }
  const daysTo = (d) => Math.round((d - _today()) / DAY);
  const hasTag = (t) => (_profile.tags || []).includes(t);

  /* ═══════════════════ MOTOR DE PRAZOS ═══════════════════
     Expande cada regra do calendário em ocorrências concretas e devolve a
     próxima relevante: { rule, start, end, status } com status
     'open' (janela a decorrer) | 'upcoming' (ainda vai abrir). */
  function mk(y, m, d) { return new Date(y, m - 1, d); }
  function nextRange(startMD, endMD) {
    const t = _today(), y = t.getFullYear();
    for (const yy of [y, y + 1]) {
      const end = mk(yy, endMD[0], endMD[1]);
      if (end >= t) return { start: mk(yy, startMD[0], startMD[1]), end };
    }
    return null;
  }
  function occurrenceFor(rule) {
    const w = rule.when || {};
    const t = _today();
    if (w.type === 'range') return nextRange(w.start, w.end);
    if (w.type === 'day') { const r = nextRange(w.date, w.date); return r; }
    if (w.type === 'multi') {
      const y = t.getFullYear();
      const all = [];
      for (const yy of [y, y + 1]) for (const [m, d] of w.dates) all.push(mk(yy, m, d));
      const next = all.filter(d => d >= t).sort((a, b) => a - b)[0];
      if (!next) return null;
      const start = new Date(next.getFullYear(), next.getMonth(), 1);
      return { start, end: next };
    }
    if (w.type === 'monthly') {
      const end = mk(t.getFullYear(), t.getMonth() + 1, w.day);
      const occ = end >= t ? end : mk(t.getFullYear(), t.getMonth() + 2, w.day);
      return { start: new Date(occ.getFullYear(), occ.getMonth(), 1), end: occ };
    }
    if (w.type === 'personal') return personalOccurrence(w.kind);
    return null;   /* info: sem data */
  }
  /* Prazos pessoais derivados do perfil. */
  function personalOccurrence(kind) {
    const t = _today(), y = t.getFullYear();
    if (kind === 'iuc') {
      const m = +_profile.matMonth;
      if (!m) return null;
      const yy = mk(y, m, new Date(y, m, 0).getDate()) >= t ? y : y + 1;
      return { start: mk(yy, m, 1), end: mk(yy, m, new Date(yy, m, 0).getDate()) };
    }
    if (kind === 'inspecao') {
      const m = +_profile.matMonth, my = +_profile.matYear;
      if (!m || !my) return null;
      /* ligeiros: 1.ª aos 4 anos, 2/2 até aos 8, depois anual */
      const dues = [];
      for (let age = 4; age <= 60; age += (age < 8 ? 2 : 1)) dues.push(mk(my + age, m, new Date(my + age, m, 0).getDate()));
      const next = dues.filter(d => d >= t)[0];
      if (!next) return null;
      return { start: new Date(next - 90 * DAY), end: next };   /* pode antecipar-se 3 meses */
    }
    if (kind === 'cc' || kind === 'carta') {
      const raw = kind === 'cc' ? _profile.ccExpiry : _profile.cartaExpiry;
      if (!raw) return null;
      const end = new Date(raw + (raw.length === 7 ? '-01' : ''));
      if (isNaN(end) || end < t) return isNaN(end) ? null : { start: end, end, overdue: true };
      return { start: new Date(end - 183 * DAY), end };         /* renovável 6 meses antes */
    }
    return null;
  }
  /* Lista de prazos expandidos, ordenada pela data-limite. */
  function deadlines() {
    if (!_cal) return [];
    const out = [];
    for (const rule of _cal.items) {
      const occ = occurrenceFor(rule);
      if (!occ) { if ((rule.when || {}).type === 'info') out.push({ rule, info: true }); continue; }
      const open = occ.start <= _today();
      out.push({ rule, start: occ.start, end: occ.end, overdue: !!occ.overdue, status: open ? 'open' : 'upcoming' });
    }
    return out.sort((a, b) => (a.info ? 1 : b.info ? -1 : a.end - b.end));
  }
  /* Um prazo "é para mim" se o perfil partilha alguma tag (ou é para todos).
     Sem perfil definido mostra-se tudo. */
  function isMine(who) {
    if (!who || !who.length || who.includes('todos')) return true;
    if (!(_profile.tags || []).length) return true;
    return who.some(hasTag);
  }
  /* Prazos pessoais só aparecem se o dado do perfil existir (occurrenceFor
     devolve null caso contrário) — mas o cartão-guia aparece na tab Prazos. */

  /* ═══════════════════ RENDER: badges e cartões ═══════════════════ */
  function statusBadge(d) {
    if (d.info) return `<span class="cd-badge cd-b-info">ℹ️ ${_t('No fixed date', 'Sem data fixa')}</span>`;
    if (d.overdue) return `<span class="cd-badge cd-b-urgent">⚠️ ${_t('Expired', 'Caducado')}</span>`;
    const n = daysTo(d.end);
    if (d.status === 'open') {
      if (n === 0) return `<span class="cd-badge cd-b-urgent">🔥 ${_t('Ends today', 'Termina hoje')}</span>`;
      if (n <= 14) return `<span class="cd-badge cd-b-urgent">🔥 ${_t(`Ends in ${n}d`, `Termina em ${n} dias`)}</span>`;
      return `<span class="cd-badge cd-b-open">🟢 ${_t(`Open · ends ${fmtDate(d.end)}`, `A decorrer · até ${fmtDate(d.end)}`)}</span>`;
    }
    if (+d.start === +d.end) {   /* data-limite única (ex.: pagamento) */
      const n2 = daysTo(d.end);
      return `<span class="cd-badge cd-b-soon">⏳ ${n2 <= 45 ? _t(`In ${n2}d`, `Daqui a ${n2} dias`) : fmtDate(d.end)}</span>`;
    }
    const s = daysTo(d.start);
    return `<span class="cd-badge cd-b-soon">🔜 ${s <= 45 ? _t(`Opens in ${s}d`, `Abre em ${s} dias`) : _t('Opens ', 'Abre a ') + fmtDate(d.start)}</span>`;
  }
  function deadlineCard(d, compact) {
    const r = d.rule, c = cat(r.cat);
    const followed = _follow.has(r.id);
    const range = d.info ? '' :
      `<span class="cd-dl-date">${d.status === 'open' || d.overdue ? '⏳' : '🗓️'} ${
        d.overdue ? _t('expired ', 'caducou a ') + fmtDate(d.end, { day: 'numeric', month: 'long', year: 'numeric' })
        : (+d.start === +d.end ? fmtDate(d.end) : `${fmtDate(d.start)} → ${fmtDate(d.end)}`)}${r.approx ? ' <span class="cd-approx" title="' + _t('Typical dates — confirm at the official link', 'Datas típicas — confirma no link oficial') + '">≈</span>' : ''}</span>`;
    return `<article class="cd-dl${d.status === 'open' ? ' cd-dl--open' : ''}" style="--cc:${c.color}">
      <div class="cd-dl-head">
        <span class="cd-dl-ico">${r.icon || c.icon}</span>
        <div class="cd-dl-t">
          <span class="cd-dl-title">${esc(r.title)}</span>
          <span class="cd-dl-cat">${c.icon} ${esc(catLabel(r.cat))}${r.source ? ' · ' + esc(r.source) : ''}</span>
        </div>
        <button class="cd-follow${followed ? ' active' : ''}" data-follow="${r.id}" title="${_t('Follow this deadline', 'Seguir este prazo')}" aria-pressed="${followed}">${followed ? '★' : '☆'}</button>
      </div>
      ${compact ? '' : `<p class="cd-dl-desc">${esc(r.desc)}</p>`}
      <div class="cd-dl-foot">
        ${statusBadge(d)}
        ${range}
        <span class="cd-dl-spacer"></span>
        ${d.info || !d.end ? '' : `<button class="cd-ics" data-ics="${r.id}" title="${_t('Add to calendar (.ics)', 'Adicionar ao calendário (.ics)')}">📆 .ics</button>`}
        <a class="cd-link" href="${esc(r.url)}" target="_blank" rel="noopener">${_t('Official site', 'Site oficial')} ↗</a>
      </div>
    </article>`;
  }

  function apoioCard(a) {
    const c = cat(a.cat);
    const stateBadge = {
      continuo:  `<span class="cd-badge cd-b-open">${_t('Apply anytime', 'Pede-se a qualquer altura')}</span>`,
      automatico:`<span class="cd-badge cd-b-auto">⚙️ ${_t('Automatic', 'Automático')}</span>`,
      anual:     `<span class="cd-badge cd-b-soon">🗓️ ${esc(a.window || _t('Annual', 'Anual'))}</span>`,
      janela:    `<span class="cd-badge cd-b-soon">📢 ${esc(a.window || _t('Application windows', 'Janelas de candidatura'))}</span>`,
    }[a.state] || '';
    const mine = a.who && a.who.tags && (_profile.tags || []).length && a.who.tags.some(hasTag);
    return `<article class="cd-ap${a.littleKnown ? ' cd-ap--gem' : ''}" style="--cc:${c.color}">
      <div class="cd-ap-head">
        <span class="cd-ap-ico">${a.icon}</span>
        <div class="cd-ap-t">
          <span class="cd-ap-name">${esc(a.name)}${a.littleKnown ? ` <span class="cd-gem" title="${_t('Under-used benefit', 'Apoio subutilizado')}">💎</span>` : ''}</span>
          <span class="cd-ap-cat">${c.icon} ${esc(catLabel(a.cat))}${mine ? ` · <b>${_t('matches your profile', 'condiz com o teu perfil')}</b>` : ''}</span>
        </div>
      </div>
      <p class="cd-ap-sum">${esc(a.sum)}</p>
      <dl class="cd-ap-facts">
        <div><dt>${_t('Who', 'Para quem')}</dt><dd>${esc(a.who && a.who.txt || '—')}</dd></div>
        <div><dt>${_t('Amount', 'Quanto')}</dt><dd>${esc(a.value || '—')}</dd></div>
        <div><dt>${_t('How', 'Como pedir')}</dt><dd>${esc(a.how || '—')}</dd></div>
      </dl>
      <div class="cd-ap-foot">${stateBadge}<span class="cd-dl-spacer"></span><a class="cd-link" href="${esc(a.url)}" target="_blank" rel="noopener">${_t('Official site', 'Site oficial')} ↗</a></div>
    </article>`;
  }

  function novidadeRow(n) {
    const srcMeta = ((_nov && _nov.sources) || []).find(s => s.id === n.source);
    const tchips = (n.topics || []).slice(0, 2).map(t => {
      const m = NTOPICS[t] || NTOPICS.outros;
      return `<span class="cd-nv-topic">${m.icon} ${_t(m.en, m.pt)}</span>`;
    }).join('');
    return `<a class="cd-nv" href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="cd-nv-meta">
        <span class="cd-nv-src">${esc((srcMeta && srcMeta.name) || n.source)}${n.via ? ' · ' + esc(n.via) : ''}</span>
        <span class="cd-nv-time">${relTime(n.ts)}</span>
      </div>
      <span class="cd-nv-title">${n.radar ? '🎯 ' : ''}${esc(n.title)}</span>
      <div class="cd-nv-chips">${tchips}</div>
    </a>`;
  }

  /* ═══════════════════ TAB: AGORA ═══════════════════ */
  function renderAgora(el) {
    const ds = deadlines().filter(d => isMine(d.rule.who));
    const urgent = ds.filter(d => !d.info && (d.overdue || (d.status === 'open' && daysTo(d.end) <= 21)));
    const open = ds.filter(d => !d.info && !d.overdue && d.status === 'open' && daysTo(d.end) > 21);
    const soon = ds.filter(d => !d.info && d.status === 'upcoming' && daysTo(d.start) <= 60);
    const followed = ds.filter(d => _follow.has(d.rule.id) && !urgent.includes(d));
    const radar = (((_nov && _nov.items) || []).filter(n => n.radar)).slice(0, 5);
    const recent = (((_nov && _nov.items) || []).filter(n => !n.radar)).slice(0, 6);
    /* "podes estar a perder": apoios 💎 que condizem com o perfil (ou todos, sem perfil) */
    const gems = (((_apoios && _apoios.items) || []).filter(a => {
      const tags = (a.who && a.who.tags) || [];
      return a.littleKnown && (!(_profile.tags || []).length || tags.some(hasTag) || tags.includes('todos'));
    }));

    const noProfile = !(_profile.tags || []).length && !_profile.matMonth && !_profile.ccExpiry;
    el.innerHTML = `
      ${noProfile ? `<div class="cd-hint">
          <span class="cd-hint-ico">👤</span>
          <div><b>${_t('Make it yours.', 'Personaliza esta página.')}</b> ${_t('Set your profile (life situation, car plate month, ID card expiry) and this page shows only what matters to you — IUC, inspection, renewals…', 'Define o teu perfil (situação de vida, mês da matrícula, validade do CC) e esta página passa a mostrar só o que te diz respeito — IUC, inspeção, renovações…')}</div>
          <button class="btn btn-primary btn-sm" data-open-profile>${_t('Set up profile', 'Definir perfil')}</button>
        </div>` : ''}
      ${urgent.length ? `<h2 class="cd-h2">🔥 ${_t('Needs attention', 'Precisa de atenção')}</h2>
        <div class="cd-grid">${urgent.map(d => deadlineCard(d)).join('')}</div>` : ''}
      ${followed.length ? `<h2 class="cd-h2">★ ${_t('Following', 'A seguir')}</h2>
        <div class="cd-grid">${followed.map(d => deadlineCard(d, true)).join('')}</div>` : ''}
      ${open.length ? `<h2 class="cd-h2">🟢 ${_t('Open now', 'A decorrer')}</h2>
        <div class="cd-grid">${open.map(d => deadlineCard(d, true)).join('')}</div>` : ''}
      ${soon.length ? `<h2 class="cd-h2">🔜 ${_t('Next 60 days', 'Próximos 60 dias')}</h2>
        <div class="cd-grid">${soon.map(d => deadlineCard(d, true)).join('')}</div>` : ''}
      ${!urgent.length && !open.length && !soon.length ? `<div class="empty-state"><span class="es-ico">🌤️</span>
        <div class="es-title">${_t('Nothing urgent for your profile', 'Nada urgente para o teu perfil')}</div>
        <div class="es-hint">${_t('Check the Deadlines tab for the full year calendar.', 'Espreita a tab Prazos para veres o calendário do ano inteiro.')}</div></div>` : ''}
      ${radar.length ? `<h2 class="cd-h2">🎯 ${_t('Applications radar', 'Radar de candidaturas')} <span class="cd-h2-note">${_t('auto-detected in official news', 'detetado automaticamente nas notícias oficiais')}</span></h2>
        <div class="cd-nv-list">${radar.map(novidadeRow).join('')}</div>` : ''}
      ${gems.length ? `<h2 class="cd-h2">💎 ${_t('You may be missing out', 'Podes estar a perder')}</h2>
        <div class="cd-grid">${gems.slice(0, 3).map(apoioCard).join('')}</div>
        <button class="btn btn-sm cd-more" data-goto-tab="apoios">${_t('See all benefits', 'Ver todos os apoios')} →</button>` : ''}
      ${recent.length ? `<h2 class="cd-h2">🆕 ${_t('Changed recently', 'Mudou recentemente')}</h2>
        <div class="cd-nv-list">${recent.map(novidadeRow).join('')}</div>
        <button class="btn btn-sm cd-more" data-goto-tab="novidades">${_t('All updates', 'Todas as novidades')} →</button>` : ''}`;
  }

  /* ═══════════════════ TAB: PRAZOS ═══════════════════ */
  function renderPrazos(el) {
    let ds = deadlines();
    if (_pzMine) ds = ds.filter(d => isMine(d.rule.who));
    if (_pzCat) ds = ds.filter(d => d.rule.cat === _pzCat);
    const cats = [...new Set((_cal ? _cal.items : []).map(r => r.cat))];

    /* Cartões-guia para prazos pessoais sem dados no perfil. */
    const missing = (_cal ? _cal.items : []).filter(r => (r.when || {}).type === 'personal' && !occurrenceFor(r)
      && (!_pzCat || r.cat === _pzCat) && (!_pzMine || isMine(r.who)));

    /* Agrupar por mês da data-limite. */
    const groups = new Map();
    for (const d of ds) {
      if (d.info) { const k = 'info'; (groups.get(k) || groups.set(k, []).get(k)).push(d); continue; }
      const k = `${d.end.getFullYear()}-${String(d.end.getMonth()).padStart(2, '0')}`;
      (groups.get(k) || groups.set(k, []).get(k)).push(d);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === 'info' ? 1 : b === 'info' ? -1 : a < b ? -1 : 1));

    el.innerHTML = `
      <div class="cd-toolbar">
        <div class="seg cd-cats">
          <button class="seg-btn${!_pzCat ? ' active' : ''}" data-pzcat="">${_t('All', 'Todos')}</button>
          ${cats.map(c => `<button class="seg-btn${_pzCat === c ? ' active' : ''}" data-pzcat="${c}">${cat(c).icon} ${esc(catLabel(c))}</button>`).join('')}
        </div>
        <label class="chip${_pzMine ? ' active' : ''}" id="cd-pz-mine" role="switch" aria-checked="${_pzMine}">👤 ${_t('Only for me', 'Só para mim')}</label>
        <button class="btn btn-sm" id="cd-ics-all" title="${_t('Download followed/all deadlines as calendar', 'Descarregar os prazos como calendário')}">📆 ${_t('Export .ics', 'Exportar .ics')}</button>
      </div>
      ${missing.length ? `<div class="cd-hint cd-hint--soft"><span class="cd-hint-ico">🔧</span>
        <div>${_t('These depend on your data: ', 'Estes prazos dependem dos teus dados: ')}${missing.map(r => esc(r.title)).join(' · ')}.
        ${_t('Fill them in your profile to see real dates.', 'Preenche-os no perfil para veres datas reais.')}</div>
        <button class="btn btn-sm" data-open-profile>${_t('Profile', 'Perfil')}</button></div>` : ''}
      ${keys.map(k => {
        const list = groups.get(k);
        const title = k === 'info' ? `ℹ️ ${_t('No fixed date', 'Sem data fixa')}`
          : (() => { const [y, m] = k.split('-'); return '📅 ' + fmtMonthYear(new Date(+y, +m, 1)); })();
        return `<h2 class="cd-h2">${title}</h2><div class="cd-grid">${list.map(d => deadlineCard(d)).join('')}</div>`;
      }).join('') || `<div class="empty-state"><span class="es-ico">📭</span><div class="es-title">${_t('No deadlines for this filter', 'Sem prazos para este filtro')}</div></div>`}
      <p class="cd-disclaimer">≈ ${_t('Marked windows are typical dates; the exact days are set yearly by the State — always confirm at the official link. This page aggregates and simplifies; it does not replace official services.', 'As janelas marcadas são datas típicas; os dias exatos são fixados anualmente pelo Estado — confirma sempre no link oficial. Esta página agrega e simplifica; não substitui os serviços oficiais.')}</p>`;
  }

  /* ═══════════════════ TAB: APOIOS ═══════════════════ */
  function renderApoios(el) {
    let list = (_apoios && _apoios.items) || [];
    const cats = [...new Set(list.map(a => a.cat))];
    if (_apCat) list = list.filter(a => a.cat === _apCat);
    if (_apLittle) list = list.filter(a => a.littleKnown);
    if (_apQuery) { const q = norm(_apQuery); list = list.filter(a => norm(a.name + ' ' + a.sum + ' ' + (a.who && a.who.txt)).includes(q)); }
    /* perfil primeiro */
    const score = (a) => ((_profile.tags || []).length && (a.who.tags || []).some(hasTag) ? 0 : 1);
    list = [...list].sort((a, b) => score(a) - score(b) || (b.littleKnown ? 1 : 0) - (a.littleKnown ? 1 : 0));

    el.innerHTML = `
      <div class="cd-toolbar">
        <input type="search" id="cd-ap-q" class="cd-search" placeholder="${_t('Search benefits…', 'Pesquisar apoios…')}" value="${esc(_apQuery)}">
        <div class="seg cd-cats">
          <button class="seg-btn${!_apCat ? ' active' : ''}" data-apcat="">${_t('All', 'Todos')}</button>
          ${cats.map(c => `<button class="seg-btn${_apCat === c ? ' active' : ''}" data-apcat="${c}">${cat(c).icon} ${esc(catLabel(c))}</button>`).join('')}
        </div>
        <label class="chip${_apLittle ? ' active' : ''}" id="cd-ap-little" role="switch" aria-checked="${_apLittle}">💎 ${_t('Little-known', 'Pouco conhecidos')}</label>
      </div>
      <div class="cd-grid cd-grid--ap">${list.map(apoioCard).join('') || `<div class="empty-state"><span class="es-ico">🔍</span><div class="es-title">${_t('Nothing found', 'Nada encontrado')}</div></div>`}</div>
      <p class="cd-disclaimer">${_t('Amounts are indicative and change with the State Budget — the official link is always the reference.', 'Os valores são indicativos e mudam com o Orçamento do Estado — o link oficial é sempre a referência.')}</p>`;
  }

  /* ═══════════════════ TAB: NOVIDADES ═══════════════════ */
  function renderNovidades(el) {
    const items = (_nov && _nov.items) || [];
    const srcs = ((_nov && _nov.sources) || []).filter(s => s.count > 0);
    let list = items;
    if (_nvTopic) list = list.filter(n => (n.topics || []).includes(_nvTopic));
    if (_nvSource) list = list.filter(n => n.source === _nvSource);
    const topics = [...new Set(items.flatMap(n => n.topics || []))];
    const upd = _nov && _nov.generated ? new Date(_nov.generated) : null;

    el.innerHTML = `
      <div class="cd-toolbar">
        <div class="seg cd-cats">
          <button class="seg-btn${!_nvTopic ? ' active' : ''}" data-nvtopic="">${_t('All', 'Todas')}</button>
          ${topics.map(t => { const m = NTOPICS[t] || NTOPICS.outros; return `<button class="seg-btn${_nvTopic === t ? ' active' : ''}" data-nvtopic="${t}">${m.icon} ${_t(m.en, m.pt)}</button>`; }).join('')}
        </div>
      </div>
      <div class="cd-src-row">
        <button class="chip${!_nvSource ? ' active' : ''}" data-nvsrc="">${_t('All sources', 'Todas as fontes')}</button>
        ${srcs.map(s => `<button class="chip${_nvSource === s.id ? ' active' : ''}" data-nvsrc="${esc(s.id)}">${esc(s.name)} <span class="cd-chip-c">${s.count}</span></button>`).join('')}
      </div>
      <div class="cd-nv-list">${list.map(novidadeRow).join('') || `<div class="empty-state"><span class="es-ico">📭</span><div class="es-title">${_t('No updates for this filter', 'Sem novidades para este filtro')}</div></div>`}</div>
      <p class="cd-disclaimer">${upd ? `🕒 ${_t('Updated', 'Atualizado')} ${upd.toLocaleString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ` : ''}${_t('Aggregated automatically every 6h from the official Diário da República feed and official-domain news.', 'Agregado automaticamente de 6 em 6 horas a partir do feed oficial do Diário da República e de notícias de domínios oficiais.')}</p>`;
  }

  /* ═══════════════════ PERFIL (painel) ═══════════════════ */
  function renderProfilePanel() {
    const pane = document.getElementById('cd-profile');
    if (!pane) return;
    const tags = _profile.tags || [];
    pane.innerHTML = `
      <div class="cd-pf-card">
        <div class="cd-pf-head">
          <span class="cd-pf-title">👤 ${_t('My profile', 'O meu perfil')}</span>
          <button class="cd-pf-x" id="cd-pf-close" aria-label="${_t('Close', 'Fechar')}">✕</button>
        </div>
        <p class="cd-pf-sub">${_t('Everything stays on this device (localStorage) — nothing is sent anywhere.', 'Fica tudo neste dispositivo (localStorage) — nada é enviado para lado nenhum.')}</p>
        <div class="cd-pf-sec">${_t('My situation', 'A minha situação')}</div>
        <div class="cd-pf-tags">
          ${TAGS.map(([id, ic, en, pt]) => `<button class="chip${tags.includes(id) ? ' active' : ''}" data-pftag="${id}" aria-pressed="${tags.includes(id)}">${ic} ${_t(en, pt)}</button>`).join('')}
        </div>
        <div class="cd-pf-sec">${_t('My dates (for real deadlines)', 'As minhas datas (para prazos reais)')}</div>
        <div class="cd-pf-fields">
          <label>🚗 ${_t('Car plate month', 'Mês da matrícula do carro')}
            <select id="cd-pf-matmonth"><option value="">—</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${+_profile.matMonth === i + 1 ? ' selected' : ''}>${new Date(2000, i, 1).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { month: 'long' })}</option>`).join('')}</select></label>
          <label>📆 ${_t('Car first-registration year', 'Ano da 1.ª matrícula')}
            <input type="number" id="cd-pf-matyear" min="1960" max="${new Date().getFullYear()}" placeholder="2018" value="${esc(_profile.matYear || '')}"></label>
          <label>🪪 ${_t('Citizen Card expiry', 'Validade do Cartão de Cidadão')}
            <input type="month" id="cd-pf-cc" value="${esc(_profile.ccExpiry || '')}"></label>
          <label>🚙 ${_t('Driving licence expiry', 'Validade da carta de condução')}
            <input type="month" id="cd-pf-carta" value="${esc(_profile.cartaExpiry || '')}"></label>
        </div>
        <div class="cd-pf-foot">
          <button class="btn btn-ghost btn-sm" id="cd-pf-clear">${_t('Clear profile', 'Limpar perfil')}</button>
          <button class="btn btn-primary btn-sm" id="cd-pf-done">${_t('Done', 'Concluir')}</button>
        </div>
      </div>`;
  }
  function toggleProfile(showIt) {
    const pane = document.getElementById('cd-profile');
    if (!pane) return;
    const show = showIt !== undefined ? showIt : pane.hidden;
    if (show) renderProfilePanel();
    pane.hidden = !show;
  }
  function profileSummary() {
    const n = (_profile.tags || []).length;
    return n ? `👤 ${n} ${_t(n === 1 ? 'trait' : 'traits', n === 1 ? 'traço' : 'traços')}` : `👤 ${_t('Profile', 'Perfil')}`;
  }

  /* ═══════════════════ ICS export ═══════════════════ */
  function icsEscape(s) { return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function icsDate(d) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
  function buildICS(list) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dcop7//cidadao//PT', 'CALSCALE:GREGORIAN'];
    for (const d of list) {
      if (d.info || !d.end) continue;
      const dayAfter = new Date(+d.end + DAY);
      L.push('BEGIN:VEVENT',
        `UID:cidadao-${d.rule.id}-${icsDate(d.end)}@dcop7.github.io`,
        `DTSTART;VALUE=DATE:${icsDate(d.end)}`,
        `DTEND;VALUE=DATE:${icsDate(dayAfter)}`,
        `SUMMARY:${icsEscape('🇵🇹 ' + d.rule.title)}`,
        `DESCRIPTION:${icsEscape((d.rule.action || d.rule.desc || '') + (d.rule.url ? ' — ' + d.rule.url : ''))}`,
        'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(d.rule.title)}`, 'END:VALARM',
        'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }
  function downloadICS(list, name) {
    const blob = new Blob([buildICS(list)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ═══════════════════ SHELL + wiring ═══════════════════ */
  function renderTab() {
    const el = document.getElementById('cd-body');
    if (!el) return;
    document.querySelectorAll('#cd-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _tab));
    if (_tab === 'prazos') renderPrazos(el);
    else if (_tab === 'apoios') renderApoios(el);
    else if (_tab === 'novidades') renderNovidades(el);
    else renderAgora(el);
    const pb = document.getElementById('cd-profile-btn');
    if (pb) pb.innerHTML = profileSummary();
  }

  function buildShell(view) {
    view.innerHTML = `
      <div class="view-inner cd-wrap">
        <header class="page-head">
          <span class="ph-ico">${typeof AppIcons !== 'undefined' ? AppIcons.icon('cidadao', 22) : '🇵🇹'}</span>
          <div class="ph-titles">
            <h1 class="ph-title">${_t('Citizen', 'Cidadão')}</h1>
            <p class="ph-sub">${_t('Deadlines, benefits and State changes — aggregated and simplified. Not a replacement for official services.', 'Prazos, apoios e mudanças do Estado — agregados e simplificados. Não substitui os serviços oficiais.')}</p>
          </div>
          <div class="ph-actions">
            <button class="btn btn-sm" id="cd-profile-btn" aria-haspopup="dialog">${profileSummary()}</button>
          </div>
        </header>
        <div class="seg" id="cd-tabs" role="tablist">
          ${TABS.map(([id, ic, en, pt]) => `<button class="seg-btn${id === _tab ? ' active' : ''}" role="tab" data-tab="${id}">${ic} ${_t(en, pt)}</button>`).join('')}
        </div>
        <div id="cd-profile" class="cd-profile" hidden></div>
        <div id="cd-body" class="cd-body"><div class="cd-loading">${_t('Loading…', 'A carregar…')}</div></div>
      </div>`;
    wire(view);
  }

  function wire(view) {
    view.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('#cd-tabs .seg-btn');
      if (tabBtn) { location.hash = '#cidadao/' + tabBtn.dataset.tab; return; }
      const goto = e.target.closest('[data-goto-tab]');
      if (goto) { location.hash = '#cidadao/' + goto.dataset.gotoTab; return; }
      if (e.target.closest('#cd-profile-btn') || e.target.closest('[data-open-profile]')) { toggleProfile(); return; }
      if (e.target.closest('#cd-pf-close') || e.target.closest('#cd-pf-done')) { toggleProfile(false); renderTab(); return; }
      if (e.target.closest('#cd-pf-clear')) { _profile = {}; saveProfile(_profile); renderProfilePanel(); renderTab(); return; }
      const tag = e.target.closest('[data-pftag]');
      if (tag) {
        const id = tag.dataset.pftag;
        const set = new Set(_profile.tags || []);
        set.has(id) ? set.delete(id) : set.add(id);
        _profile.tags = [...set]; saveProfile(_profile); renderProfilePanel();
        return;
      }
      const fol = e.target.closest('[data-follow]');
      if (fol) {
        const id = fol.dataset.follow;
        _follow.has(id) ? _follow.delete(id) : _follow.add(id);
        saveFollow(); renderTab();
        return;
      }
      const ics = e.target.closest('[data-ics]');
      if (ics) {
        const d = deadlines().find(x => x.rule.id === ics.dataset.ics);
        if (d) downloadICS([d], `prazo-${d.rule.id}.ics`);
        return;
      }
      if (e.target.closest('#cd-ics-all')) {
        const ds = deadlines().filter(d => !d.info && isMine(d.rule.who));
        const followedOnly = ds.filter(d => _follow.has(d.rule.id));
        downloadICS(followedOnly.length ? followedOnly : ds, 'prazos-cidadao.ics');
        return;
      }
      const pz = e.target.closest('[data-pzcat]');
      if (pz) { _pzCat = pz.dataset.pzcat; renderTab(); return; }
      if (e.target.closest('#cd-pz-mine')) { _pzMine = !_pzMine; renderTab(); return; }
      const ap = e.target.closest('[data-apcat]');
      if (ap) { _apCat = ap.dataset.apcat; renderTab(); return; }
      if (e.target.closest('#cd-ap-little')) { _apLittle = !_apLittle; renderTab(); return; }
      const nt = e.target.closest('[data-nvtopic]');
      if (nt) { _nvTopic = nt.dataset.nvtopic; renderTab(); return; }
      const ns = e.target.closest('[data-nvsrc]');
      if (ns) { _nvSource = ns.dataset.nvsrc; renderTab(); return; }
    });
    /* pesquisa de apoios (input não sobrevive ao re-render → delegado) */
    view.addEventListener('input', (e) => {
      if (e.target.id === 'cd-ap-q') {
        clearTimeout(wire._qt);
        wire._qt = setTimeout(() => {
          _apQuery = e.target.value;
          const el = document.getElementById('cd-body');
          if (el) { renderApoios(el); const q = document.getElementById('cd-ap-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
        }, 220);
      }
    });
    view.addEventListener('change', (e) => {
      const map = { 'cd-pf-matmonth': 'matMonth', 'cd-pf-matyear': 'matYear', 'cd-pf-cc': 'ccExpiry', 'cd-pf-carta': 'cartaExpiry' };
      const key = map[e.target.id];
      if (key) { _profile[key] = e.target.value || undefined; saveProfile(_profile); }
    });
  }

  /* ═══════════════════ dados + show ═══════════════════ */
  let _built = false;
  async function loadData() {
    const [cal, ap, nov] = await Promise.allSettled([
      _cal ? Promise.resolve(_cal) : _fetchJSON(BASE + 'calendario.json'),
      _apoios ? Promise.resolve(_apoios) : _fetchJSON(BASE + 'apoios.json'),
      _fetchJSON(BASE + 'novidades.json'),   /* sempre fresco (Action 6/6h) */
    ]);
    if (cal.status === 'fulfilled') _cal = cal.value;
    if (ap.status === 'fulfilled') _apoios = ap.value;
    if (nov.status === 'fulfilled') _nov = nov.value;
  }

  async function show(sub) {
    const view = document.getElementById('view-cidadao');
    if (!view) return;
    const valid = TABS.map(t => t[0]);
    if (sub && valid.includes(sub)) _tab = sub;
    if (!_built) { _built = true; buildShell(view); }
    else document.querySelectorAll('#cd-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _tab));
    if (!_cal || !_apoios) {
      await loadData();
    } else if (!_nov) { loadData().then(renderTab); }
    renderTab();
  }

  /* re-render no idioma certo */
  document.addEventListener('langchange', () => {
    if (!_built) return;
    const view = document.getElementById('view-cidadao');
    if (view) { _built = false; view.innerHTML = ''; if (view.classList.contains('active')) { _built = true; buildShell(view); renderTab(); } }
  });
  /* virou o dia → os prazos mudam de estado */
  document.addEventListener('time:day', () => { if (_built) renderTab(); });

  return { show };
})();
