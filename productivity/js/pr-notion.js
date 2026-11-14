/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — Playground de bases de dados (global `PrNotion`)
   ──────────────────────────────────────────────────────────────────
   Um espaço de trabalho ao estilo do Notion, sobre o mundo de exemplo:
   barra lateral (Favoritos + PARA), vistas (tabela/quadro/lista),
   filtros, ordenação, agrupamento, propriedades (incluindo relações de
   duas vias e rollups), modelos, uma página aberta ao lado com as
   ligações visíveis, o mapa das relações, e o relógio simulado.

   Prioridade: CLAREZA. Cada vista diz em português o que está a filtrar;
   cada relação mostra de onde vem; cada rollup mostra a conta que faz.
   Tudo o que muda passa pelo PrWorld com src 'nb' (repõe-se à parte).
   ══════════════════════════════════════════════════════════════════ */
const PrNotion = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const W = PrWorld;
  const SRC = 'nb';

  const TYPE_NAMES = {
    title: { pt: 'Título', en: 'Title' }, text: { pt: 'Texto', en: 'Text' }, select: { pt: 'Seleção', en: 'Select' }, multi: { pt: 'Seleção múltipla', en: 'Multi-select' },
    check: { pt: 'Caixa de verificação', en: 'Checkbox' }, url: { pt: 'URL', en: 'URL' }, rel: { pt: 'Relação', en: 'Relation' }, rollup: { pt: 'Rollup', en: 'Rollup' },
    created: { pt: 'Criado em', en: 'Created time' }, edited: { pt: 'Última edição', en: 'Last edited time' }, date: { pt: 'Data', en: 'Date' },
  };
  const TYPE_ICON = { title: 'Aa', text: '≡', select: '◉', multi: '☰', check: '☑', url: '🔗', rel: '↗', rollup: 'Σ', created: '◷', edited: '◷', date: '▦' };
  const OP_NAMES = {
    contains: { pt: 'contém', en: 'contains' }, not_contains: { pt: 'não contém', en: 'does not contain' }, empty: { pt: 'está vazio', en: 'is empty' }, not_empty: { pt: 'não está vazio', en: 'is not empty' },
    is: { pt: 'é', en: 'is' }, is_not: { pt: 'não é', en: 'is not' }, has: { pt: 'inclui', en: 'contains' }, not_has: { pt: 'não inclui', en: 'does not contain' },
    checked: { pt: 'está marcada', en: 'is checked' }, unchecked: { pt: 'não está marcada', en: 'is unchecked' },
    past: { pt: 'nos últimos N dias', en: 'within the last N days' }, older: { pt: 'há mais de N dias', en: 'more than N days ago' }, between: { pt: 'entre há N e há M dias', en: 'between N and M days ago' },
    eq: { pt: '=', en: '=' }, gt: { pt: '>', en: '>' }, lt: { pt: '<', en: '<' },
  };
  const FOLDERS = { top: null, areas: { pt: 'Áreas', en: 'Areas' }, people: { pt: 'Gestão de pessoas', en: 'People Management' } };

  /* ── missões guiadas (estado à parte do mundo) ── */
  const MISSIONS = [
    { id: 'view', t: { pt: 'Muda de vista', en: 'Switch views' }, d: { pt: 'Nas Notas, abre a vista "Sem equipa": é a fila da triagem de sexta.', en: 'In Notes, open the "No team" view: it is Friday\'s triage queue.' }, go: ['notes', 'noteam'] },
    { id: 'filter', t: { pt: 'Constrói um filtro', en: 'Build a filter' }, d: { pt: 'Em qualquer vista, acrescenta um filtro e lê a frase que o explica.', en: 'In any view, add a filter and read the sentence that explains it.' } },
    { id: 'rel', t: { pt: 'Segue uma relação', en: 'Follow a relation' }, d: { pt: 'Abre uma equipa e toca numa das notas ligadas — vais parar à outra base.', en: 'Open a team and tap one of its linked notes — you land in the other database.' }, go: ['teams', 'all'] },
    { id: 'rollup', t: { pt: 'Cria um rollup', en: 'Create a rollup' }, d: { pt: 'Em Equipas, acrescenta uma propriedade Rollup (ex.: contar Projetos).', en: 'In Teams, add a Rollup property (e.g. count Projects).' }, go: ['teams', 'all'] },
    { id: 'tpl', t: { pt: 'Usa um modelo', en: 'Use a template' }, d: { pt: 'Em Projetos, cria uma linha a partir do "Modelo de projeto".', en: 'In Projects, create a row from the "Project template".' }, go: ['projects', 'active'] },
    { id: 'clock', t: { pt: 'Avança o relógio', en: 'Move the clock' }, d: { pt: 'Avança uma semana e vê notas novas entrarem na vista "Revisão" (30–37 dias).', en: 'Move forward a week and watch new notes enter the "Review" view (30–37 days).' }, go: ['notes', 'review'] },
  ];
  const MKEY = 'pr-nb-missions';
  const missionsDone = () => Pr.store.get(MKEY, {});
  function done(id) {
    const m = missionsDone(); if (m[id]) return;
    m[id] = 1; Pr.store.set(MKEY, m);
    const ms = MISSIONS.find(x => x.id === id);
    Pr.toast(tx('Missão cumprida: ', 'Mission done: ') + L(ms.t));
  }

  /* ── estado da página ── */
  let mOpen = null;
  document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('nb-missions')) mOpen = e.target.open; }, true);
  let el = null, cur = { db: 'notes', view: null }, peek = null, panel = null, mode = 'db', delArm = null, fresh = null;
  const vlist = db => W.state().views[db] || [];
  const curView = () => vlist(cur.db).find(v => v.id === cur.view) || vlist(cur.db)[0];
  const props = db => (W.schemaOf(db) || { props: [] }).props;
  const apply = ops => W.apply(SRC, ops);
  const go = (db, view, rec) => PrNav.go(`experimentar/notion/${db}${view ? '/' + view : ''}${rec ? '/' + rec : ''}`, { keep: true });

  function route(rest, root) {
    el = root;
    const [db, view, rec] = (rest || '').split('/');
    if (db === 'mapa') { mode = 'schema'; }
    else {
      mode = 'db';
      const dbs = W.state().dbs;
      cur.db = dbs.includes(db) ? db : (cur.db && dbs.includes(cur.db) ? cur.db : 'notes');
      const vs = vlist(cur.db);
      cur.view = vs.some(v => v.id === view) ? view : (vs.find(v => v.def) || vs[0]).id;
      peek = rec && W.rec(cur.db, rec) ? { db: cur.db, id: rec } : (peek && W.rec(peek.db, peek.id) ? peek : null);
      if (cur.db === 'notes' && cur.view === 'noteam') done('view');
    }
    panel = null;
    PrShell.setArea('experimentar', tx('Playground de bases de dados', 'Database playground'));
    shell();
    Pr.store.set('pr-nb-seen', 1);
  }

  /* ════════════════ moldura ════════════════ */
  function shell() {
    const m = missionsDone();
    const nDone = MISSIONS.filter(x => m[x.id]).length;
    el.innerHTML = `<div class="pr-wrap pr-page nb-page">
      ${crumbs([{ label: tx('Experimentar', 'Experiment'), href: '#experimentar' }, { label: tx('Playground de bases de dados', 'Database playground') }])}
      <header class="nb-head">
        <div><h1 class="pr-h2" style="font-size:clamp(1.6rem,3vw,2.3rem)">${esc(tx('Playground de bases de dados', 'Database playground'))}</h1>
          <p class="pr-sub" style="max-width:70ch">${esc(tx('Um espaço de trabalho ao estilo do Notion com o mundo de exemplo. Mexe à vontade: as alterações ficam só neste browser e repõem-se a qualquer momento.',
            'A Notion-style workspace with the sample world. Change anything: changes stay in this browser and can be reset at any time.'))}</p></div>
        <details class="nb-missions" ${(mOpen != null ? mOpen : nDone === 0 && !Pr.store.get('pr-nb-seen', 0)) ? 'open' : ''}>
          <summary><b>${esc(tx('Missões', 'Missions'))}</b> <span class="pr-mono">${nDone}/${MISSIONS.length}</span></summary>
          <ol>${MISSIONS.map(x => `<li class="${m[x.id] ? 'ok' : ''}"><span class="nb-mk">${m[x.id] ? ICON.check : ''}</span><div><b>${esc(L(x.t))}</b><p>${esc(L(x.d))}</p>
            ${x.go && !m[x.id] ? `<button type="button" class="btn btn-sm btn-ghost" data-act="mgo" data-db="${x.go[0]}" data-v="${x.go[1]}">${esc(tx('Ir', 'Go'))} ${ICON.arrow}</button>` : ''}</div></li>`).join('')}</ol>
          ${nDone ? `<button type="button" class="btn btn-sm btn-ghost" data-act="mreset">${esc(tx('Recomeçar as missões', 'Restart missions'))}</button>` : ''}
        </details>
      </header>
      ${PrApp.worldBar(SRC)}
      <div class="nb-app ${peek ? 'has-peek' : ''}" data-nb>
        <nav class="nb-side" aria-label="${esc(tx('Espaço de trabalho', 'Workspace'))}">${sidebar()}</nav>
        <section class="nb-main" aria-live="polite">${mode === 'schema' ? schemaPane() : dbPane()}</section>
        ${peek ? `<aside class="nb-peek" aria-label="${esc(tx('Página aberta', 'Open page'))}">${peekPane()}</aside>` : ''}
      </div>
      ${Pr.localNote(tx('Os nomes "Notion", "Todoist" e afins referem-se a produtos reais só para explicar conceitos.', 'Names like "Notion" and "Todoist" refer to real products only to explain concepts.'))}
    </div>`;
    if (fresh) { const f = $(`[data-row="${fresh}"]`, el); if (f) Pr.pop(f); fresh = null; }
  }
  function rerender(keepFocus) {
    const k = keepFocus && document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null;
    shell();
    if (k) { const f = $(`[data-focus="${k}"]`, el); if (f) { f.focus(); if (f.select && f.type === 'text') { const v = f.value; f.value = ''; f.value = v; } } }
  }

  /* ── barra lateral: Favoritos + PARA ── */
  function sidebar() {
    const st = W.state(), S = st.schema;
    const item = db => `<button type="button" class="nb-si ${mode === 'db' && cur.db === db ? 'on' : ''}" data-act="db" data-db="${db}"><span class="nb-ic">${S[db].icon}</span>${esc(L(S[db].name))}<span class="nb-cnt">${W.recs(db).length}</span></button>`;
    const favs = st.dbs.filter(db => S[db].fav);
    const res = st.resources || [];
    const hasDec = !!S.decisions;
    return `<p class="nb-sh">⭐ ${esc(tx('Favoritos', 'Favorites'))}</p>${favs.map(item).join('')}
      <p class="nb-sh">${esc(tx('PARA', 'PARA'))}</p>
      ${item('projects')}
      <p class="nb-fold">🟩 ${esc(tx('Áreas', 'Areas'))}</p>
      <div class="nb-in">${st.dbs.filter(db => S[db].folder === 'areas').map(item).join('')}
        ${st.dbs.some(db => S[db].folder === 'people') ? `<p class="nb-fold">${esc(L(FOLDERS.people))}</p><div class="nb-in">${st.dbs.filter(db => S[db].folder === 'people').map(item).join('')}</div>` : ''}
        ${hasDec ? '' : `<button type="button" class="nb-si nb-optdb ${mode === 'opt' ? 'on' : ''}" data-act="opt">${ICON.plus}${esc(tx('Base opcional: Decisões', 'Optional: Decisions'))}</button>`}</div>
      <p class="nb-fold">🟨 ${esc(tx('Recursos', 'Resources'))}</p><div class="nb-in">${res.map(r => `<span class="nb-si nb-page-i">📄 ${esc(L(r.name))}</span>`).join('')}</div>
      <p class="nb-fold">📦 ${esc(tx('Arquivo', 'Archive'))}</p><div class="nb-in"><span class="nb-si nb-page-i nb-dim">${esc(tx('(por ano — só o que não tem estado próprio)', '(by year — only what has no status of its own)'))}</span></div>
      <div class="nb-side-foot">
        <button type="button" class="nb-si ${mode === 'schema' ? 'on' : ''}" data-act="schema"><span class="nb-ic">⌘</span>${esc(tx('Mapa das relações', 'Relation map'))}</button>
        <div class="nb-clock"><span class="pr-kicker">${esc(tx('Relógio', 'Clock'))}</span><b>${esc(Pr.fmtDay(st.clock, 'long'))}</b>
          <button type="button" class="btn btn-sm" data-act="clock">${esc(tx('Avançar 1 semana', 'Forward 1 week'))}</button></div>
      </div>`;
  }

  /* ════════════════ painel da base ════════════════ */
  function dbPane() {
    if (mode === 'opt') return optPane();
    const db = cur.db, S = W.schemaOf(db), v = curView();
    const res = W.query(db, v);
    const pr = props(db);
    const visible = pr.filter(p => !(v.hide || []).includes(p.id));
    const isTpl = S.template || db === 'teams';
    return `<div class="nb-dbhead"><span class="nb-dbicon">${S.icon}</span><div><h2>${esc(L(S.name))}</h2>
        <p class="nb-q"><span class="pr-kicker">${esc(tx('Responde a', 'Answers'))}</span> ${esc(L(S.q || ''))}</p></div></div>
      <div class="nb-tabs" role="tablist">${vlist(db).map(x => `<button type="button" role="tab" class="nb-tab ${x.id === v.id ? 'on' : ''}" aria-selected="${x.id === v.id}" data-act="view" data-v="${x.id}">${layoutIcon(x.layout)} ${esc(L(x.name))}</button>`).join('')}
        <button type="button" class="nb-tab nb-tab-add" data-act="panel" data-p="newview" aria-label="${esc(tx('Nova vista', 'New view'))}">${ICON.plus}</button></div>
      <div class="nb-tools">
        <div class="nb-seg" role="group" aria-label="${esc(tx('Formato', 'Layout'))}">${['table', 'board', 'list'].map(l => `<button type="button" data-act="layout" data-l="${l}" aria-pressed="${v.layout === l}" title="${esc(layoutName(l))}">${layoutIcon(l)}<span>${esc(layoutName(l))}</span></button>`).join('')}</div>
        ${toolBtn('filter', tx('Filtro', 'Filter'), (v.filter || []).length)}${toolBtn('sort', tx('Ordenar', 'Sort'), (v.sort || []).length)}
        ${v.layout === 'board' ? toolBtn('group', tx('Agrupar', 'Group'), v.group ? 1 : 0) : ''}${toolBtn('props', tx('Propriedades', 'Properties'), 0)}
        <span class="pr-spacer"></span>
        <div class="nb-new">${isTpl ? `<button type="button" class="btn btn-sm" data-act="panel" data-p="newrec">${esc(tx('Modelos', 'Templates'))} ▾</button>` : ''}<button type="button" class="btn btn-sm btn-primary" data-act="rec-new">${ICON.plus} ${esc(tx('Novo', 'New'))}</button></div>
      </div>
      ${panel ? `<div class="nb-panel">${panelHtml()}</div>` : ''}
      <p class="nb-explain">${explain(db, v, res)}</p>
      ${v.why ? `<p class="nb-why">${esc(L(v.why))}</p>` : ''}
      <div class="nb-view">${v.layout === 'board' ? board(db, v, res, visible) : v.layout === 'list' ? list(db, res, visible) : table(db, res, visible)}</div>`;
  }
  const toolBtn = (p, label, n) => `<button type="button" class="nb-tool ${panel === p ? 'on' : ''} ${n ? 'has' : ''}" data-act="panel" data-p="${p}" aria-expanded="${panel === p}">${esc(label)}${n ? ` <span class="pr-mono">${n}</span>` : ''}</button>`;
  const layoutName = l => ({ table: tx('Tabela', 'Table'), board: tx('Quadro', 'Board'), list: tx('Lista', 'List') }[l]);
  const layoutIcon = l => ({ table: '▦', board: '▥', list: '☰' }[l] || '▦');

  function explain(db, v, res) {
    const fs = (v.filter || []).map(f => `<span class="nb-fx">${esc(W.filterText(db, f))}</span>`);
    const ss = (v.sort || []).map(s => { const p = W.prop(db, s.p); return p ? `«${esc(L(p.name))}» ${s.dir === 'desc' ? '↓' : '↑'}` : ''; }).filter(Boolean);
    const g = v.layout === 'board' && v.group ? W.prop(db, v.group) : null;
    return `${fs.length ? `${esc(tx('Mostra as linhas em que', 'Shows rows where'))} ${fs.join(` <b>${esc(tx('e', 'and'))}</b> `)}` : esc(tx('Sem filtro: mostra todas as linhas', 'No filter: shows every row'))}
      ${ss.length ? ` · ${esc(tx('ordenadas por', 'sorted by'))} ${ss.join(', ')}` : ''}${g ? ` · ${esc(tx('agrupadas por', 'grouped by'))} «${esc(L(g.name))}»` : ''}
      → <b class="nb-count">${res.rows.length}</b> ${esc(tx('de', 'of'))} ${res.total}`;
  }

  /* ── valores ── */
  function opt(p, id) { const o = (p.opts || []).find(x => x.id === id); return o ? `<span class="nb-opt c-${o.c || 'gray'}">${esc(L(o.l))}</span>` : ''; }
  function cell(db, r, p, opts) {
    const v = W.val(db, r, p), now = W.clock();
    switch (p.type) {
      case 'title': return `<button type="button" class="nb-title" data-act="open" data-db="${db}" data-id="${r.id}">${esc(v) || `<i>${esc(tx('Sem título', 'Untitled'))}</i>`}</button>`;
      case 'select': return opt(p, v);
      case 'multi': return v.map(id => opt(p, id)).join('');
      case 'check': return opts && opts.ro ? (v ? '☑' : '☐') : `<input type="checkbox" class="nb-cb" ${v ? 'checked' : ''} data-act="chk" data-id="${r.id}" data-pid="${p.id}" aria-label="${esc(L(p.name))}">`;
      case 'url': return v ? `<span class="nb-url">${esc(v.replace(/^https?:\/\//, ''))}</span>` : '';
      case 'created': case 'edited': case 'date': return v != null ? `<span class="nb-date" title="${esc(Pr.fmtDay(v, 'long'))}">${esc(Pr.relDay(v, now))}</span>` : '';
      case 'rel': { const tdb = W.relTarget(db, p); const max = opts && opts.max; const more = max && v.length > max ? v.length - max : 0; return (more ? v.slice(0, max) : v).map(id => { const x = W.rec(tdb, id); return x ? `<button type="button" class="nb-chip" data-act="open" data-db="${tdb}" data-id="${id}" data-from="${db}">${esc(W.title(tdb, x))}</button>` : ''; }).join('') + (more ? `<span class="nb-more">+${more}</span>` : ''); }
      case 'rollup': return rollCell(db, r, p, v, now);
      default: return esc(v || '');
    }
  }
  function rollCell(db, r, p, v, now) {
    const k = W.rollKind(p);
    if (k === 'num') return `<span class="nb-num">${v == null ? '' : v}${p.roll.fn === 'pct_checked' ? '%' : ''}</span>`;
    if (k === 'date') return v != null ? `<span class="nb-date">${esc(Pr.relDay(v, now))}</span>` : '';
    if (!v || !v.orig) return '';
    return v.orig.map(x => Array.isArray(x) ? x.map(i => v.tp && v.tp.opts ? opt(v.tp, i) : esc(i)).join('') : v.tp && v.tp.type === 'select' ? opt(v.tp, x) : `<span class="nb-orig">${esc(typeof x === 'boolean' ? (x ? '☑' : '☐') : typeof x === 'number' ? Pr.relDay(x, now) : x)}</span>`).join('');
  }
  function th(p) {
    return `<th scope="col" title="${esc(L(TYPE_NAMES[p.type]) + (p.back ? ' · ' + tx('lado de volta', 'back side') : '') + (p.q ? ' — ' + L(p.q) : ''))}"><span class="nb-ty">${TYPE_ICON[p.type] || ''}</span>${esc(L(p.name))}${p.back ? ' <span class="nb-back">↩</span>' : ''}${p.note ? ' <span class="nb-flag" title="' + esc(L(p.note)) + '">!</span>' : ''}</th>`;
  }
  function table(db, res, visible) {
    if (!res.rows.length) return emptyView();
    return `<div class="nb-tablewrap"><table class="nb-table"><thead><tr>${visible.map(th).join('')}</tr></thead><tbody>
      ${res.rows.map(r => `<tr data-row="${r.id}" class="${peek && peek.id === r.id ? 'on' : ''} ${r.archived ? 'arch' : ''}">${visible.map(p => `<td class="t-${p.type}">${cell(db, r, p, { max: 3 })}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }
  function list(db, res, visible) {
    if (!res.rows.length) return emptyView();
    const extra = visible.filter(p => p.type !== 'title').slice(0, 3);
    return `<ul class="nb-list">${res.rows.map(r => `<li data-row="${r.id}" class="${peek && peek.id === r.id ? 'on' : ''}">${cell(db, r, W.titleProp(db))}<span class="nb-list-m">${extra.map(p => cell(db, r, p, { ro: true })).join(' ')}</span></li>`).join('')}</ul>`;
  }
  function board(db, v, res, visible) {
    if (!res.groups) return `<p class="nb-empty">${esc(tx('Escolhe uma propriedade para agrupar (Seleção, Relação, Seleção múltipla ou Caixa).', 'Pick a property to group by (Select, Relation, Multi-select or Checkbox).'))}</p>`;
    const extra = visible.filter(p => p.type !== 'title' && p.id !== v.group).slice(0, 2);
    const gp = W.prop(db, v.group);
    return `${gp && (gp.type === 'multi' || (gp.type === 'rel')) ? `<p class="nb-why">${esc(tx('Uma linha com vários valores aparece em cada coluna a que pertence.', 'A row with several values appears in each column it belongs to.'))}</p>` : ''}
      <div class="nb-board">${res.groups.filter(g => g.rows.length || !g.key.none).map(g => `<div class="nb-col"><p class="nb-col-h">${g.key.c ? `<span class="nb-opt c-${g.key.c}">${esc(g.key.label)}</span>` : `<b>${esc(g.key.label)}</b>`} <span class="pr-mono">${g.rows.length}</span></p>
        ${g.rows.map(r => `<div class="nb-card ${peek && peek.id === r.id ? 'on' : ''}" data-row="${r.id}">${cell(db, r, W.titleProp(db))}<div class="nb-card-m">${extra.map(p => cell(db, r, p, { ro: true })).join(' ')}</div></div>`).join('')}</div>`).join('')}</div>`;
  }
  const emptyView = () => `<div class="nb-empty"><b>${esc(tx('Nenhuma linha passa este filtro.', 'No row passes this filter.'))}</b><br>${esc(cur.view === 'noteam' ? tx('Fila vazia: a triagem está em dia.', 'Empty queue: triage is up to date.') : tx('Muda o filtro ou avança o relógio.', 'Change the filter or move the clock.'))}</div>`;

  /* ════════════════ painéis de edição ════════════════ */
  function panelHtml() {
    const db = cur.db, v = curView(), pr = props(db);
    if (panel === 'filter') {
      const filterable = pr.filter(p => W.opsFor(p).length);
      return `<p class="nb-ph">${esc(tx('Filtros (todos têm de ser verdade)', 'Filters (all must be true)'))}</p>
        ${(v.filter || []).map((f, i) => filterRow(db, f, i, filterable)).join('') || `<p class="pr-sub">${esc(tx('Sem filtros.', 'No filters.'))}</p>`}
        <div class="pr-row"><button type="button" class="btn btn-sm" data-act="f-add">${ICON.plus} ${esc(tx('Acrescentar filtro', 'Add filter'))}</button>
        <span class="pr-sub">${esc(tx('No Notion também há filtros avançados com "ou" e grupos; aqui ficamos pelo "e".', 'Notion also has advanced filters with "or" and groups; here we keep to "and".'))}</span></div>`;
    }
    if (panel === 'sort') {
      return `<p class="nb-ph">${esc(tx('Ordenação (a primeira manda; as seguintes desempatam)', 'Sort (the first one wins; the next ones break ties)'))}</p>
        ${(v.sort || []).map((s, i) => `<div class="nb-frow"><select data-sort="${i}" data-k="p" data-focus="s${i}p">${pr.filter(p => p.type !== 'rollup' || W.rollKind(p) !== 'list').map(p => `<option value="${p.id}" ${p.id === s.p ? 'selected' : ''}>${esc(L(p.name))}</option>`).join('')}</select>
          <select data-sort="${i}" data-k="dir" data-focus="s${i}d"><option value="asc" ${s.dir === 'asc' ? 'selected' : ''}>${esc(tx('Ascendente ↑', 'Ascending ↑'))}</option><option value="desc" ${s.dir === 'desc' ? 'selected' : ''}>${esc(tx('Descendente ↓', 'Descending ↓'))}</option></select>
          <button type="button" class="pr-icon-btn" data-act="s-del" data-i="${i}" aria-label="${esc(tx('Remover', 'Remove'))}">${ICON.x}</button></div>`).join('') || `<p class="pr-sub">${esc(tx('Pela ordem em que foram criadas.', 'In creation order.'))}</p>`}
        <button type="button" class="btn btn-sm" data-act="s-add">${ICON.plus} ${esc(tx('Acrescentar ordenação', 'Add sort'))}</button>`;
    }
    if (panel === 'group') {
      const gpbl = pr.filter(p => ['select', 'multi', 'rel', 'check'].includes(p.type));
      return `<p class="nb-ph">${esc(tx('Agrupar o quadro por', 'Group the board by'))}</p><div class="pr-row">${gpbl.map(p => `<button type="button" class="chip" aria-pressed="${v.group === p.id}" data-act="g-set" data-pid="${p.id}">${TYPE_ICON[p.type]} ${esc(L(p.name))}</button>`).join('')}</div>`;
    }
    if (panel === 'props') {
      return `<p class="nb-ph">${esc(tx('Propriedades desta base', 'Properties of this database'))} <span class="pr-sub">— ${esc(tx('o olho mostra/esconde nesta vista; o resto muda a base inteira', 'the eye shows/hides in this view; the rest changes the whole database'))}</span></p>
        <ul class="nb-props">${pr.map(p => `<li><span class="nb-ty">${TYPE_ICON[p.type]}</span><div><b>${esc(L(p.name))}</b> <small>${esc(L(TYPE_NAMES[p.type]))}${propDetail(db, p)}</small>${p.q ? `<p>${esc(tx('Responde a: ', 'Answers: '))}${esc(L(p.q))}</p>` : ''}${p.note ? `<p class="nb-flagtxt">! ${esc(L(p.note))}</p>` : ''}</div>
          ${p.type === 'title' ? '' : `<button type="button" class="pr-icon-btn" data-act="hide" data-pid="${p.id}" aria-pressed="${!(v.hide || []).includes(p.id)}" title="${esc(tx('Mostrar nesta vista', 'Show in this view'))}">${(v.hide || []).includes(p.id) ? '◌' : '◉'}</button>
          ${p.back ? `<span class="nb-backnote" title="${esc(tx('Remove-se do lado de onde vem', 'Remove it from the side it comes from'))}">↩</span>` : `<button type="button" class="pr-icon-btn ${delArm === p.id ? 'nb-arm' : ''}" data-act="p-del" data-pid="${p.id}" title="${esc(tx('Apagar a propriedade', 'Delete the property'))}">${delArm === p.id ? '?' : ICON.x}</button>`}`}</li>`).join('')}</ul>
        ${delArm ? `<p class="nb-flagtxt">${esc(tx('Toca outra vez para apagar. Os valores perdem-se (podes repor a experiência).', 'Tap again to delete. The values are lost (you can reset the experiment).'))}</p>` : ''}
        <button type="button" class="btn btn-sm" data-act="panel" data-p="newprop">${ICON.plus} ${esc(tx('Nova propriedade', 'New property'))}</button>`;
    }
    if (panel === 'newprop') return newPropForm(db);
    if (panel === 'newview') return `<p class="nb-ph">${esc(tx('Nova vista', 'New view'))}</p>
      <div class="nb-frow"><input type="text" data-nv="name" maxlength="40" placeholder="${esc(tx('Nome da vista', 'View name'))}" data-focus="nvn">
      <select data-nv="layout">${['table', 'board', 'list'].map(l => `<option value="${l}">${esc(layoutName(l))}</option>`).join('')}</select>
      <label class="nb-inl"><input type="checkbox" data-nv="copy" checked> ${esc(tx('copiar os filtros desta vista', 'copy this view\'s filters'))}</label>
      <button type="button" class="btn btn-sm btn-primary" data-act="v-create">${esc(tx('Criar', 'Create'))}</button></div>
      ${vlist(db).length > 1 ? `<button type="button" class="btn btn-sm btn-ghost btn-danger" data-act="v-del">${esc(tx('Apagar a vista atual', 'Delete the current view'))} («${esc(L(v.name))}»)</button>` : ''}
      <p class="pr-sub">${esc(tx('Regra do sistema: duas ou três vistas chegam — uma filtrada para o dia a dia, uma agrupada, uma sem filtro.', 'System rule: two or three views are enough — one filtered for daily use, one grouped, one unfiltered.'))}</p>`;
    if (panel === 'newrec') {
      const T = PrSeed.TEMPLATES, S = W.schemaOf(db);
      const tpls = [S.template, db === 'teams' ? 'team' : null].filter(Boolean);
      return `<p class="nb-ph">${esc(tx('Modelos desta base', 'Templates of this database'))}</p><div class="pr-row">${tpls.map(t => `<button type="button" class="btn btn-sm" data-act="rec-new" data-tpl="${t}">📄 ${esc(L(T[t].name))}</button>`).join('')}</div>
        <p class="pr-sub">${esc(tx('Um modelo dá a cada linha nova o mesmo esqueleto de página. No Notion pode ser o modelo predefinido da base.', 'A template gives every new row the same page skeleton. In Notion it can be the database\'s default template.'))}</p>`;
    }
    return '';
  }
  function propDetail(db, p) {
    if (p.type === 'rel') {
      const tdb = W.relTarget(db, p), tn = L(W.schemaOf(tdb).name);
      if (p.back) { const src = W.prop(p.back.db, p.back.via); return ` · ${tx('automática, vem de', 'automatic, from')} ${tn} › ${src ? L(src.name) : '?'}`; }
      return ` → ${tn}${p.rel.two ? ` · ${tx('duas vias', 'two-way')}` : ` · ${tx('uma via', 'one-way')}`}`;
    }
    if (p.type === 'rollup') { const rp = W.prop(db, p.roll.rel), tdb = rp ? W.relTarget(db, rp) : null, tp = tdb ? W.prop(tdb, p.roll.prop) : null;
      return ` · ${rp ? L(rp.name) : '?'} › ${tp ? L(tp.name) : '?'} › ${L(W.ROLL_FNS[p.roll.fn])}`; }
    if (p.opts) return ` · ${p.opts.length} ${tx('opções', 'options')}`;
    return '';
  }
  function filterRow(db, f, i, filterable) {
    const p = W.prop(db, f.p) || filterable[0];
    const ops = W.opsFor(p);
    let val = '';
    if (W.needsVal(f.op)) {
      if (p.type === 'select' || p.type === 'multi') val = `<select data-flt="${i}" data-k="v" data-focus="f${i}v">${(p.opts || []).map(o => `<option value="${o.id}" ${o.id === f.v ? 'selected' : ''}>${esc(L(o.l))}</option>`).join('')}</select>`;
      else if (p.type === 'rel') { const tdb = W.relTarget(db, p); val = `<select data-flt="${i}" data-k="v" data-focus="f${i}v">${W.recs(tdb).map(x => `<option value="${x.id}" ${x.id === f.v ? 'selected' : ''}>${esc(W.title(tdb, x))}</option>`).join('')}</select>`; }
      else if (f.op === 'between') val = `<input type="number" min="0" max="999" data-flt="${i}" data-k="v0" value="${esc(Array.isArray(f.v) ? f.v[0] : 0)}" data-focus="f${i}a" aria-label="N"><span>–</span><input type="number" min="0" max="999" data-flt="${i}" data-k="v1" value="${esc(Array.isArray(f.v) ? f.v[1] : 7)}" data-focus="f${i}b" aria-label="M">`;
      else if (['past', 'older', 'eq', 'gt', 'lt'].includes(f.op)) val = `<input type="number" min="0" max="999" data-flt="${i}" data-k="v" value="${esc(f.v)}" data-focus="f${i}v" aria-label="N">`;
      else val = `<input type="text" data-flt="${i}" data-k="v" value="${esc(f.v || '')}" data-focus="f${i}v" placeholder="${esc(tx('texto…', 'text…'))}">`;
    }
    return `<div class="nb-frow"><select data-flt="${i}" data-k="p" data-focus="f${i}p">${filterable.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${TYPE_ICON[x.type]} ${esc(L(x.name))}</option>`).join('')}</select>
      <select data-flt="${i}" data-k="op" data-focus="f${i}o">${ops.map(o => `<option value="${o}" ${o === f.op ? 'selected' : ''}>${esc(L(OP_NAMES[o]))}</option>`).join('')}</select>${val}
      <button type="button" class="pr-icon-btn" data-act="f-del" data-i="${i}" aria-label="${esc(tx('Remover filtro', 'Remove filter'))}">${ICON.x}</button></div>`;
  }
  function defaultFilter(db, p) {
    const op = W.opsFor(p)[0];
    let v = '';
    if (p.type === 'select' || p.type === 'multi') v = (p.opts[0] || {}).id;
    else if (p.type === 'rel') v = (W.recs(W.relTarget(db, p))[0] || {}).id;
    else if (op === 'between') v = [30, 37];
    else if (['past', 'older', 'eq', 'gt', 'lt'].includes(op)) v = op === 'past' ? 7 : 1;
    return { p: p.id, op, v };
  }

  /* ── nova propriedade ── */
  let np = null;
  function newPropForm(db) {
    np = np && np.db === db ? np : { db, type: 'select', name: '', q: '', rel: '', two: true, roll: { rel: '', prop: '', fn: 'count' }, opts: '' };
    const T = ['text', 'select', 'multi', 'check', 'url', 'rel', 'rollup'];
    const rels = props(db).filter(p => p.type === 'rel');
    const rr = rels.find(p => p.id === np.roll.rel) || rels[0];
    const tdb = rr ? W.relTarget(db, rr) : null;
    const tprops = tdb ? props(tdb).filter(p => !['rollup'].includes(p.type)) : [];
    if (np.type === 'rollup' && rr && !np.roll.rel) np.roll.rel = rr.id;
    if (np.type === 'rollup' && tprops.length && !tprops.some(p => p.id === np.roll.prop)) np.roll.prop = (tprops.find(p => p.type === 'title') || tprops[0]).id;
    const others = W.state().dbs.filter(x => x !== db);
    let preview = '';
    if (np.type === 'rollup' && rr) {
      const fake = { id: '__pv', type: 'rollup', name: { pt: '', en: '' }, roll: { rel: rr.id, prop: np.roll.prop, fn: np.roll.fn } };
      const sch = W.schemaOf(db); sch.props.push(fake);
      try { preview = W.recs(db).slice(0, 4).map(r => `<li><b>${esc(W.title(db, r))}</b>: ${rollCell(db, r, fake, W.val(db, r, fake), W.clock()) || '—'}</li>`).join(''); } finally { sch.props.pop(); }
    }
    return `<p class="nb-ph">${esc(tx('Nova propriedade', 'New property'))}</p>
      <div class="nb-np">
        <label>${esc(tx('Tipo', 'Type'))}<select data-np="type" data-focus="npt">${T.map(t => `<option value="${t}" ${np.type === t ? 'selected' : ''}>${TYPE_ICON[t]} ${esc(L(TYPE_NAMES[t]))}</option>`).join('')}</select></label>
        <label>${esc(tx('Nome', 'Name'))}<input type="text" maxlength="32" data-np="name" value="${esc(np.name)}" data-focus="npn" placeholder="${esc(np.type === 'rollup' ? tx('ex.: N.º de projetos', 'e.g. No. of projects') : tx('ex.: Impacto', 'e.g. Impact'))}"></label>
        ${np.type === 'select' || np.type === 'multi' ? `<label class="wide">${esc(tx('Opções (separadas por vírgulas)', 'Options (comma-separated)'))}<input type="text" data-np="opts" value="${esc(np.opts)}" data-focus="npo" placeholder="${esc(tx('Alto, Médio, Baixo', 'High, Medium, Low'))}"></label>` : ''}
        ${np.type === 'rel' ? `<label>${esc(tx('Liga a', 'Links to'))}<select data-np="rel" data-focus="npr">${others.map(x => `<option value="${x}" ${np.rel === x ? 'selected' : ''}>${esc(L(W.schemaOf(x).name))}</option>`).join('')}</select></label>
          <label class="nb-inl wide"><input type="checkbox" data-np="two" ${np.two ? 'checked' : ''}> ${esc(tx('Duas vias — mostrar também na outra base', 'Two-way — also show on the other database'))}</label>` : ''}
        ${np.type === 'rollup' ? (rels.length ? `<label>${esc(tx('1. Seguir a relação', '1. Follow the relation'))}<select data-np="rrel" data-focus="nprr">${rels.map(p => `<option value="${p.id}" ${rr && rr.id === p.id ? 'selected' : ''}>${esc(L(p.name))} → ${esc(L(W.schemaOf(W.relTarget(db, p)).name))}</option>`).join('')}</select></label>
          <label>${esc(tx('2. Olhar para a propriedade', '2. Look at the property'))}<select data-np="rprop" data-focus="nprp">${tprops.map(p => `<option value="${p.id}" ${np.roll.prop === p.id ? 'selected' : ''}>${esc(L(p.name))}</option>`).join('')}</select></label>
          <label>${esc(tx('3. Calcular', '3. Calculate'))}<select data-np="rfn" data-focus="nprf">${Object.keys(W.ROLL_FNS).map(f => `<option value="${f}" ${np.roll.fn === f ? 'selected' : ''}>${esc(L(W.ROLL_FNS[f]))}</option>`).join('')}</select></label>
          <div class="nb-pv wide"><p class="pr-kicker">${esc(tx('Pré-visualização', 'Preview'))}</p><ul>${preview}</ul></div>`
          : `<p class="nb-flagtxt wide">${esc(tx('Um rollup precisa de uma relação nesta base. Cria primeiro uma propriedade Relação.', 'A rollup needs a relation in this database. Create a Relation property first.'))}</p>`) : ''}
        <label class="wide">${esc(tx('Que pergunta concreta responde HOJE?', 'What concrete question does it answer TODAY?'))} <small>${esc(tx('(princípio 7 — obrigatório)', '(principle 7 — required)'))}</small>
          <input type="text" maxlength="90" data-np="q" value="${esc(np.q)}" data-focus="npq" placeholder="${esc(tx('ex.: Que riscos altos ainda não têm ação?', 'e.g. Which high risks still have no action?'))}"></label>
        <div class="pr-row wide"><button type="button" class="btn btn-sm btn-primary" data-act="p-create" ${np.name.trim() && np.q.trim().length > 8 && (np.type !== 'rollup' || rels.length) ? '' : 'disabled'}>${esc(tx('Criar propriedade', 'Create property'))}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="panel" data-p="props">${esc(tx('Cancelar', 'Cancel'))}</button>
          ${np.q.trim().length <= 8 ? `<span class="pr-sub">${esc(tx('Sem uma pergunta, é decoração.', 'Without a question, it is decoration.'))}</span>` : ''}</div>
      </div>`;
  }
  function createProp() {
    const db = cur.db, id = 'u' + Date.now().toString(36);
    const name = np.name.trim(), q = np.q.trim();
    const p = { id, type: np.type, name, q, added: true };
    if (np.type === 'select' || np.type === 'multi') {
      const cols = ['blue', 'green', 'orange', 'purple', 'red', 'yellow', 'pink', 'brown', 'gray'];
      p.opts = np.opts.split(',').map(s => s.trim()).filter(Boolean).slice(0, 9).map((l, i) => ({ id: 'o' + i, l, c: cols[i % cols.length] }));
      if (!p.opts.length) p.opts = [{ id: 'o0', l: tx('Opção 1', 'Option 1'), c: 'blue' }];
    }
    if (np.type === 'rel') {
      const tdb = np.rel || W.state().dbs.find(x => x !== db);
      p.multi = true;
      p.rel = { db: tdb, two: !!np.two, back: 'bk_' + id, backName: W.schemaOf(db).name };
    }
    if (np.type === 'rollup') p.roll = { rel: np.roll.rel, prop: np.roll.prop, fn: np.roll.fn };
    if (apply({ o: 'prop+', db, p })) {
      if (np.type === 'rollup') done('rollup');
      Pr.toast(np.type === 'rel' && np.two ? tx(`Relação criada — vê também a base ${L(W.schemaOf(p.rel.db).name)}: ganhou a propriedade de volta.`, `Relation created — look at ${L(W.schemaOf(p.rel.db).name)} too: it gained the back property.`) : tx('Propriedade criada.', 'Property created.'));
      np = null; panel = 'props';
      rerender();
    }
  }

  /* ════════════════ página aberta (peek) ════════════════ */
  function peekPane() {
    const db = peek.db, r = W.rec(db, peek.id); if (!r) return '';
    const S = W.schemaOf(db), now = W.clock();
    const pr = props(db).filter(p => p.type !== 'title');
    const links = linkMap(db, r);
    return `<div class="nb-pk-h"><span class="pr-kicker">${S.icon} ${esc(L(S.name))}</span><button type="button" class="pr-icon-btn" data-act="peek-close" aria-label="${esc(tx('Fechar', 'Close'))}">${ICON.x}</button></div>
      <input class="nb-pk-title" type="text" value="${esc(W.title(db, r))}" data-pe="title" data-focus="pkt" aria-label="${esc(tx('Título', 'Title'))}">
      <dl class="nb-pk-props">${pr.map(p => `<dt title="${esc(L(TYPE_NAMES[p.type]))}"><span class="nb-ty">${TYPE_ICON[p.type]}</span>${esc(L(p.name))}</dt><dd>${editor(db, r, p, now)}</dd>`).join('')}</dl>
      ${links}
      <div class="nb-pk-body"><p class="pr-kicker">${esc(tx('Corpo da página', 'Page body'))}</p>
        ${(r.body || []).map(b => b.k === 'h' ? `<h4>${esc(L(b.t))}</h4>` : b.k === 'views' ? linkedViews(r) : `<p class="${b.ph ? 'ph' : ''}">${esc(L(b.t))}</p>`).join('') || `<p class="ph">${esc(tx('Vazio. Cada linha é uma página completa por baixo — o texto longo vive aqui, não nas propriedades.', 'Empty. Every row is a full page underneath — long text lives here, not in properties.'))}</p>`}
        <div class="nb-frow"><input type="text" maxlength="200" data-body placeholder="${esc(tx('Acrescentar uma linha…', 'Add a line…'))}" data-focus="pkb" aria-label="${esc(tx('Nova linha', 'New line'))}"><button type="button" class="btn btn-sm" data-act="body-add">${esc(tx('Acrescentar', 'Add'))}</button></div></div>
      <div class="nb-pk-foot"><span class="pr-sub">${esc(tx('Criado', 'Created'))} ${esc(Pr.fmtDay(r.cr))} · ${esc(tx('editado', 'edited'))} ${esc(Pr.relDay(r.ed != null ? r.ed : r.cr, now))}</span>
        <button type="button" class="btn btn-sm btn-ghost btn-danger" data-act="rec-del">${esc(delArm === 'rec' ? tx('Confirmar: apagar', 'Confirm: delete') : tx('Apagar', 'Delete'))}</button></div>`;
  }
  function editor(db, r, p, now) {
    const v = W.val(db, r, p);
    switch (p.type) {
      case 'text': case 'url': return `<input type="text" value="${esc(v)}" data-pe="${p.id}" data-focus="pe-${p.id}" maxlength="120">`;
      case 'select': return `<select data-pe="${p.id}" data-focus="pe-${p.id}"><option value="">—</option>${p.opts.map(o => `<option value="${o.id}" ${o.id === v ? 'selected' : ''}>${esc(L(o.l))}</option>`).join('')}</select>`;
      case 'multi': return `<div class="nb-ms">${p.opts.map(o => `<button type="button" class="nb-opt c-${o.c} ${v.includes(o.id) ? 'on' : 'off'}" data-act="ms" data-pid="${p.id}" data-o="${o.id}" aria-pressed="${v.includes(o.id)}">${esc(L(o.l))}</button>`).join('')}</div>`;
      case 'check': return `<input type="checkbox" class="nb-cb" ${v ? 'checked' : ''} data-act="chk" data-id="${r.id}" data-pid="${p.id}" aria-label="${esc(L(p.name))}">`;
      case 'created': case 'edited': return `<span class="nb-date">${esc(Pr.fmtDay(v, 'long'))}</span> <small class="nb-auto">${esc(tx('automático', 'automatic'))}</small>`;
      case 'rel': return relEditor(db, r, p, v);
      case 'rollup': return `${rollCell(db, r, p, v, now) || '—'}<p class="nb-rollx">${esc(rollExplain(db, p, v))}</p>`;
    }
    return esc(v);
  }
  function relEditor(db, r, p, v) {
    const tdb = W.relTarget(db, p), all = W.recs(tdb);
    const open = relOpen === p.id;
    return `<div class="nb-rel">${v.map(id => { const x = W.rec(tdb, id); return x ? `<button type="button" class="nb-chip" data-act="open" data-db="${tdb}" data-id="${id}" data-from="${db}">${esc(W.title(tdb, x))}</button>` : ''; }).join('')}
      <button type="button" class="nb-chip nb-chip-edit" data-act="rel-open" data-pid="${p.id}" aria-expanded="${open}">${open ? tx('fechar', 'close') : tx('editar', 'edit')}</button></div>
      ${p.back ? `<p class="nb-rollx">↩ ${esc(tx(`Lado de volta: vem da propriedade «${L((W.prop(p.back.db, p.back.via) || {}).name)}» em ${L(W.schemaOf(p.back.db).name)}. Editar aqui muda lá também.`, `Back side: comes from the «${L((W.prop(p.back.db, p.back.via) || {}).name)}» property in ${L(W.schemaOf(p.back.db).name)}. Editing here changes it there too.`))}</p>` : ''}
      ${p.note ? `<p class="nb-flagtxt">! ${esc(L(p.note))}</p>` : ''}
      ${open ? `<ul class="nb-relpick">${all.map(x => `<li><label><input type="checkbox" data-act="rel-toggle" data-pid="${p.id}" data-tid="${x.id}" ${v.includes(x.id) ? 'checked' : ''}> ${esc(W.title(tdb, x))}</label></li>`).join('')}</ul>` : ''}`;
  }
  let relOpen = null;
  function rollExplain(db, p, v) {
    const rp = W.prop(db, p.roll.rel); if (!rp) return '';
    const tdb = W.relTarget(db, rp), tp = W.prop(tdb, p.roll.prop);
    const n = (W.val(db, W.rec(db, peek.id), rp) || []).length;
    return tx(`Segue «${L(rp.name)}» (${n} ligada${n === 1 ? '' : 's'} em ${L(W.schemaOf(tdb).name)}) → olha para «${tp ? L(tp.name) : '?'}» → ${L(W.ROLL_FNS[p.roll.fn])}`,
      `Follows «${L(rp.name)}» (${n} linked in ${L(W.schemaOf(tdb).name)}) → looks at «${tp ? L(tp.name) : '?'}» → ${L(W.ROLL_FNS[p.roll.fn])}`);
  }
  /* mapa local: este registo e tudo o que está ligado, de todas as bases */
  function linkMap(db, r) {
    const rels = props(db).filter(p => p.type === 'rel');
    const groups = rels.map(p => ({ p, tdb: W.relTarget(db, p), ids: W.val(db, r, p) })).filter(g => g.ids.length);
    if (!groups.length) return `<div class="nb-lm nb-lm-empty"><p class="pr-kicker">${esc(tx('Ligações', 'Links'))}</p><p class="pr-sub">${esc(tx('Nada ligado. Se esta base tem uma relação, usa "editar" acima.', 'Nothing linked. If this database has a relation, use "edit" above.'))}</p></div>`;
    const H = Math.max(110, groups.reduce((s, g) => s + Math.min(g.ids.length, 5), 0) * 24 + groups.length * 18 + 16);
    let y = 18; const nodes = [];
    groups.forEach(g => { nodes.push({ head: true, y, label: L(W.schemaOf(g.tdb).name) + ' · ' + L(g.p.name) + (g.p.back ? ' ↩' : '') }); y += 18;
      g.ids.slice(0, 5).forEach(id => { nodes.push({ y, db: g.tdb, id, label: W.title(g.tdb, W.rec(g.tdb, id)), back: !!g.p.back }); y += 24; });
      if (g.ids.length > 5) { nodes.push({ y, more: g.ids.length - 5 }); y += 18; } });
    const cy = H / 2;
    return `<div class="nb-lm"><p class="pr-kicker">${esc(tx('Ligações desta página', 'Links from this page'))}</p>
      <svg class="nb-lm-svg" viewBox="0 0 320 ${H}" style="height:${H}px" role="img" aria-label="${esc(tx('Mapa das ligações', 'Link map'))}">
        ${nodes.filter(n => n.id).map(n => `<path d="M88 ${cy} C 130 ${cy}, 130 ${n.y - 4}, 168 ${n.y - 4}" class="${n.back ? 'bk' : ''}"/>`).join('')}
        <rect x="4" y="${cy - 16}" width="84" height="32" rx="5" class="me"/><text x="46" y="${cy + 4}" text-anchor="middle" class="me-t">${esc(W.title(db, r).slice(0, 13))}</text>
        ${nodes.map(n => n.head ? `<text x="170" y="${n.y}" class="hd">${esc(n.label.slice(0, 40))}</text>` : n.more ? `<text x="176" y="${n.y}" class="hd">+${n.more}</text>`
          : `<a href="#experimentar/notion/${n.db}/${(vlist(n.db).find(v => v.def) || vlist(n.db)[0]).id}/${n.id}" data-act="open" data-db="${n.db}" data-id="${n.id}" data-from="${db}"><circle cx="171" cy="${n.y - 4}" r="3.5"/><text x="180" y="${n.y}">${esc(n.label.slice(0, 30))}${n.label.length > 30 ? '…' : ''}</text></a>`).join('')}
      </svg><p class="pr-sub">${esc(tx('Linha cheia: esta página aponta para lá. Tracejado (↩): a outra página aponta para esta.', 'Solid line: this page points there. Dashed (↩): the other page points here.'))}</p></div>`;
  }
  /* vistas ligadas dentro da página de uma equipa (modelo "equipa") */
  function linkedViews(team) {
    const parts = [['notes', p => !p.archived], ['projects', p => p.status !== 'done'], ['meetings', () => true]].filter(([db]) => W.schemaOf(db));
    return `<div class="nb-lv"><p class="pr-kicker">${esc(tx('Vistas ligadas — filtradas: Equipa inclui esta página', 'Linked views — filtered: Team contains this page'))}</p>
      ${parts.map(([db, extra]) => { const rows = W.recs(db).filter(x => (x.team || []).includes(team.id) && extra(x));
        return `<div class="nb-lv-t"><b>${W.schemaOf(db).icon} ${esc(L(W.schemaOf(db).name))}</b> <span class="pr-mono">${rows.length}</span><ul>${rows.slice(0, 4).map(x => `<li>${esc(W.title(db, x))}</li>`).join('')}${rows.length > 4 ? `<li class="pr-sub">+${rows.length - 4}</li>` : ''}</ul></div>`; }).join('')}
      <p class="pr-sub">${esc(tx('Uma vista mostra uma base só: no Notion não há lista nativa que misture bases. Daí uma vista pequena por base.', 'A view shows one database only: Notion has no native list mixing databases. Hence one small view per database.'))}</p></div>`;
  }

  /* ════════════════ base opcional (Decisões) ════════════════ */
  function optPane() {
    const n = PrLearn.decisionCount();
    const tests = [
      [tx('Os mesmos poucos campos?', 'Same few fields?'), true, tx('Nome, Estado, Equipa, Confiança — sempre os mesmos (formato ADR).', 'Name, Status, Team, Confidence — always the same (ADR format).')],
      [tx('Já se repetiu (regra de três)?', 'Has it recurred (rule of three)?'), n >= 3, tx(`Há ${n} nota(s) de decisão nas Notas.`, `There are ${n} decision note(s) in Notes.`)],
      [tx('Um campo que só este tipo tem?', 'A field only this kind has?'), true, tx('Estado (Proposta/Aceite/Substituída) e Confiança.', 'Status (Proposed/Accepted/Superseded) and Confidence.')],
      [tx('Os dados verdadeiros vivem aqui?', 'Does the real data live here?'), true, tx('Sim — não há outra ferramenta dona das decisões.', 'Yes — no other tool owns the decisions.')],
    ];
    const pass = tests.every(t => t[1]);
    return `<div class="nb-dbhead"><span class="nb-dbicon">⚖️</span><div><h2>${esc(tx('Decisões — merece uma base?', 'Decisions — does it earn a database?'))}</h2>
      <p class="nb-q">${esc(tx('A estrutura merece-se. Uma base opcional só nasce quando passa as quatro perguntas, por ordem.', 'Structure is earned. An optional database is born only when it passes the four questions, in order.'))}</p></div></div>
      <ol class="lr-dbt">${tests.map((t, i) => `<li class="${t[1] ? 'ok' : 'no'}"><span>${t[1] ? ICON.check : ICON.x}</span><div><b>${esc(t[0])}</b><br><small>${esc(t[2])}</small></div></li>`).join('')}</ol>
      ${pass ? `<p class="lr-verdict">${esc(tx(`Passa. Criar a base move as ${n} notas de decisão para lá (degrau 2 da escada).`, `It passes. Creating the database moves the ${n} decision notes into it (rung 2 of the ladder).`))}</p>
          <button type="button" class="btn btn-primary" data-act="opt-create">${esc(tx('Criar a base Decisões e mover as notas', 'Create Decisions and move the notes'))}</button>`
        : `<p class="lr-verdict">${esc(tx('Ainda não. Até à terceira, uma etiqueta "decision" e uma vista filtrada das Notas fazem o trabalho.', 'Not yet. Until the third one, a "decision" tag and a filtered Notes view do the job.'))}</p>
          <div class="pr-row"><button type="button" class="btn" data-act="opt-note">${esc(tx('Escrever mais uma nota de decisão', 'Write one more decision note'))}</button><a class="btn btn-ghost" href="#aplicar/semana">${esc(tx('Ou vive a semana guiada', 'Or live the guided week'))}</a></div>`}`;
  }
  function decisionOps() {
    const notes = W.recs('notes').filter(r => /^(decis[aã]o|decision)\s*:/i.test(W.title('notes', r)) || (r.tags || []).includes('decision'));
    const ops = [{ o: 'db+', db: 'decisions' }];
    notes.forEach(r => {
      const nm = typeof r.name === 'object' ? { pt: String(r.name.pt).replace(/^decis[aã]o\s*:\s*/i, ''), en: String(r.name.en).replace(/^decision\s*:\s*/i, '') } : String(r.name).replace(/^(decis[aã]o|decision)\s*:\s*/i, '');
      ops.push({ o: 'add', db: 'decisions', r: { id: 'd_' + r.id, name: nm, dstatus: 'acc', team: (r.team || []).slice(), conf: 'md', cr: r.cr, body: PrSeed.TEMPLATES.adr.body } });
      ops.push({ o: 'del', db: 'notes', id: r.id });
    });
    return { ops, n: notes.length };
  }
  function createDecisions() {
    const { ops, n } = decisionOps(), notes = { length: n };
    apply(ops);
    Pr.toast(tx(`Base Decisões criada com ${notes.length} linhas. As notas saíram das Notas.`, `Decisions created with ${notes.length} rows. The notes left Notes.`));
    go('decisions', 'active');
  }

  /* ════════════════ mapa das relações ════════════════ */
  function schemaSvg(opts) {
    const st = W.state(), dbs = st.dbs, S = st.schema;
    const Wd = 900, Ht = 560, cx = 450, cy = 270;
    const ORDER = ['notes', 'projects', 'decisions', 'meetings', 'persons', 'oneonones'];
    const others = dbs.filter(d => d !== 'teams').sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const pos = { teams: [cx, cy] };
    others.forEach((d, i) => { const a = -Math.PI / 2 + (i / others.length) * Math.PI * 2; pos[d] = [cx + Math.cos(a) * 330, cy + Math.sin(a) * 205]; });
    const bw = 168, bh = d => 40 + S[d].props.filter(p => p.type === 'rel' || p.type === 'rollup').length * 15;
    const edges = [];
    dbs.forEach(d => S[d].props.forEach(p => { if (p.type === 'rel' && !p.back && S[p.rel.db]) edges.push({ from: d, to: p.rel.db, p, two: !!p.rel.two }); }));
    const sel = opts && opts.sel;
    const clip = (a, b, d) => { const [x1, y1] = a, [x2, y2] = b; const hw = bw / 2, hh = bh(d) / 2; const dx = x2 - x1, dy = y2 - y1;
      const t = Math.min(Math.abs(hw / (dx || 1e-6)), Math.abs(hh / (dy || 1e-6))); return [x1 + dx * t, y1 + dy * t]; };
    return `<svg class="nb-schema" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(tx('Mapa das bases de dados e relações', 'Map of databases and relations'))}">
      <defs><marker id="nbm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
      ${edges.map((e, i) => { const a = clip(pos[e.from], pos[e.to], e.from), b = clip(pos[e.to], pos[e.from], e.to);
        const self = e.from === e.to; if (self) return '';
        const on = sel && (sel === e.from || sel === e.to);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + (i % 2 ? 8 : -6);
        return `<g class="edge ${e.two ? 'two' : 'one'} ${on ? 'on' : ''} ${sel && !on ? 'dim' : ''}"><path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" marker-end="url(#nbm)" ${e.two ? 'marker-start="url(#nbm)"' : ''}/>
          <text x="${mx}" y="${my}" text-anchor="middle">${esc(L(e.p.name))}</text></g>`; }).join('')}
      ${dbs.map(d => { const [x, y] = pos[d], h = bh(d), rp = S[d].props.filter(p => p.type === 'rel' || p.type === 'rollup');
        return `<a href="#experimentar/notion/${d}" data-act="db" data-db="${d}" class="node ${d === 'teams' ? 'hub' : ''} ${sel === d ? 'on' : ''} ${sel && sel !== d && !edges.some(e => (e.from === sel && e.to === d) || (e.to === sel && e.from === d)) ? 'dim' : ''}">
          <rect x="${x - bw / 2}" y="${y - h / 2}" width="${bw}" height="${h}" rx="7"/>
          <text x="${x}" y="${y - h / 2 + 22}" text-anchor="middle" class="nm">${S[d].icon} ${esc(L(S[d].name))} · ${W.recs(d).length}</text>
          ${rp.map((p, i) => `<text x="${x - bw / 2 + 10}" y="${y - h / 2 + 40 + i * 15}" class="pp ${p.type}">${p.type === 'rollup' ? 'Σ' : p.back ? '↩' : '↗'} ${esc(L(p.name).slice(0, 20))}</text>`).join('')}</a>`; }).join('')}
    </svg>`;
  }
  function schemaPane() {
    return `<div class="nb-dbhead"><span class="nb-dbicon">⌘</span><div><h2>${esc(tx('Mapa das relações', 'Relation map'))}</h2>
      <p class="nb-q">${esc(tx('Desenhado a partir do esquema atual — se criares uma relação ou um rollup, aparece aqui. Toca numa base para a abrir.', 'Drawn from the current schema — create a relation or a rollup and it shows up here. Tap a database to open it.'))}</p></div></div>
      <div class="nb-schema-wrap">${schemaSvg()}</div>
      <ul class="nb-legend"><li><span class="lg two"></span>${esc(tx('Relação de duas vias: aparece dos dois lados (↗ ida, ↩ volta)', 'Two-way relation: shows on both sides (↗ forward, ↩ back)'))}</li>
        <li><span class="lg one"></span>${esc(tx('Relação de uma via: só se vê de onde parte', 'One-way relation: only visible where it starts'))}</li>
        <li><b>Σ</b> ${esc(tx('Rollup: uma conta sobre o que está do outro lado de uma relação', 'Rollup: a calculation over what is on the other side of a relation'))}</li></ul>
      <p class="pr-sub" style="margin-top:1rem">${esc(tx(`A base ${L(W.hub().db)} está no centro: é o único sítio onde os nomes existem. As outras apontam para ela em vez de repetirem a mesma lista.`, `The ${L(W.hub().db)} database sits in the middle: it is the only place the names exist. The others point to it instead of repeating the same list.`))}</p>`;
  }

  /* ════════════════ eventos ════════════════ */
  function updView(fn) { const v = Pr.clone(curView()); fn(v); apply({ o: 'viewset', db: cur.db, vid: v.id, v }); }
  function newRec(tpl) {
    const db = cur.db, id = 'r' + Date.now().toString(36);
    const T = PrSeed.TEMPLATES;
    const r = { id, name: tpl === 'project' ? tx('Projeto novo', 'New project') : tpl === 'adr' ? tx('Decisão nova', 'New decision') : tx('Sem título', 'Untitled'), body: tpl ? Pr.clone(T[tpl].body) : [] };
    if (db === 'projects') r.status = 'later';
    if (db === 'decisions') r.dstatus = 'prop';
    /* uma linha nova numa vista filtrada herda o filtro quando dá (como no Notion) */
    (curView().filter || []).forEach(f => { const p = W.prop(db, f.p); if (!p || p.back) return;
      if (f.op === 'is' && p.type === 'select') r[p.id] = f.v; if (f.op === 'has' && (p.type === 'multi' || p.type === 'rel')) r[p.id] = [f.v]; if (f.op === 'checked') r[p.id] = true; });
    if (apply({ o: 'add', db, r })) {
      if (tpl === 'project') done('tpl');
      peek = { db, id }; fresh = id; panel = null;
      rerender();
      const t = $('.nb-pk-title', el); if (t) { t.focus(); t.select(); }
    }
  }

  function onClick(e) {
    const a = e.target.closest('[data-act]'); if (!a || !el.contains(a)) return;
    const act = a.dataset.act;
    if (act !== 'p-del' && act !== 'rec-del') delArm = null;
    switch (act) {
      case 'db': e.preventDefault(); peek = null; go(a.dataset.db); return;
      case 'schema': mode = 'schema'; peek = null; PrNav.go('experimentar/notion/mapa', { keep: true }); return;
      case 'opt': mode = 'opt'; peek = null; rerender(); return;
      case 'opt-create': createDecisions(); return;
      case 'opt-note': apply({ o: 'add', db: 'notes', r: { id: 'nd' + Date.now().toString(36), name: tx('Decisão: o painel de custos é revisto na revisão mensal de fiabilidade', 'Decision: the cost dashboard is checked at the monthly reliability review'), team: [], tags: ['decision'] } }); rerender(); return;
      case 'mgo': go(a.dataset.db, a.dataset.v); return;
      case 'mreset': Pr.store.del(MKEY); rerender(); return;
      case 'view': peek = null; go(cur.db, a.dataset.v); return;
      case 'layout': updView(v => { v.layout = a.dataset.l; if (v.layout === 'board' && !v.group) { const g = props(cur.db).find(p => ['select', 'rel'].includes(p.type)); v.group = g ? g.id : null; } }); if (a.dataset.l === 'board') panel = 'group'; rerender(); return;
      case 'panel': panel = panel === a.dataset.p ? null : a.dataset.p; if (panel === 'newprop') np = null; rerender(); return;
      case 'f-add': { const p = props(cur.db).find(x => W.opsFor(x).length && x.type !== 'title') || W.titleProp(cur.db); updView(v => { v.filter = (v.filter || []).concat([defaultFilter(cur.db, p)]); }); done('filter'); rerender(); return; }
      case 'f-del': updView(v => { v.filter.splice(+a.dataset.i, 1); }); rerender(); return;
      case 's-add': updView(v => { v.sort = (v.sort || []).concat([{ p: W.titleProp(cur.db).id, dir: 'asc' }]); }); rerender(); return;
      case 's-del': updView(v => { v.sort.splice(+a.dataset.i, 1); }); rerender(); return;
      case 'g-set': updView(v => { v.group = a.dataset.pid; }); rerender(); return;
      case 'hide': updView(v => { v.hide = v.hide || []; const i = v.hide.indexOf(a.dataset.pid); if (i >= 0) v.hide.splice(i, 1); else v.hide.push(a.dataset.pid); }); rerender(); return;
      case 'p-del': if (delArm === a.dataset.pid) { apply({ o: 'prop-', db: cur.db, pid: a.dataset.pid }); delArm = null; } else delArm = a.dataset.pid; rerender(); return;
      case 'p-create': createProp(); return;
      case 'v-create': { const nm = ($('[data-nv="name"]', el).value || '').trim() || tx('Vista nova', 'New view'); const lay = $('[data-nv="layout"]', el).value; const copy = $('[data-nv="copy"]', el).checked;
        const id = 'v' + Date.now().toString(36), base = curView();
        const nv = { id, name: nm, layout: lay, filter: copy ? Pr.clone(base.filter || []) : [], sort: copy ? Pr.clone(base.sort || []) : [], hide: [], group: lay === 'board' ? (props(cur.db).find(p => ['select', 'rel'].includes(p.type)) || {}).id : null };
        apply({ o: 'view+', db: cur.db, v: nv }); panel = null; go(cur.db, id); return; }
      case 'v-del': { const id = curView().id; apply({ o: 'view-', db: cur.db, vid: id }); panel = null; go(cur.db); return; }
      case 'rec-new': newRec(a.dataset.tpl); return;
      case 'open': {
        e.preventDefault();
        const db = a.dataset.db, id = a.dataset.id;
        if (a.dataset.from && a.dataset.from !== db) { if (peek && (peek.db === 'teams' || a.dataset.from === 'teams')) done('rel'); else done('rel'); }
        relOpen = null;
        if (db !== cur.db || mode !== 'db') { peek = { db, id }; go(db, null, id); }
        else { peek = { db, id }; rerender(); }
        const pk = $('.nb-peek', el); if (pk && window.innerWidth < 1100) pk.scrollIntoView({ block: 'start' });
        return;
      }
      case 'peek-close': peek = null; relOpen = null; rerender(); return;
      case 'chk': { const db = peek && a.closest('.nb-peek') ? peek.db : cur.db; const r = W.rec(db, a.dataset.id); apply({ o: 'set', db, id: r.id, k: a.dataset.pid, v: !r[a.dataset.pid] }); rerender(); return; }
      case 'ms': { const r = W.rec(peek.db, peek.id), cur2 = (r[a.dataset.pid] || []).slice(), i = cur2.indexOf(a.dataset.o); if (i >= 0) cur2.splice(i, 1); else cur2.push(a.dataset.o); apply({ o: 'set', db: peek.db, id: peek.id, k: a.dataset.pid, v: cur2 }); rerender(); return; }
      case 'rel-open': relOpen = relOpen === a.dataset.pid ? null : a.dataset.pid; rerender(); return;
      case 'rel-toggle': relToggle(a.dataset.pid, a.dataset.tid, a.checked); return;
      case 'body-add': addBody(); return;
      case 'rec-del': if (delArm === 'rec') { const p = peek; peek = null; delArm = null; apply({ o: 'del', db: p.db, id: p.id }); rerender(); Pr.toast(tx('Linha apagada (repor a experiência devolve-a).', 'Row deleted (resetting the experiment brings it back).')); } else { delArm = 'rec'; rerender(); } return;
      case 'clock': apply({ o: 'clock', d: 7 }); done('clock'); Pr.toast(tx('Uma semana depois: ', 'One week later: ') + Pr.fmtDay(W.clock(), 'long')); rerender(); return;
    }
  }
  function relToggle(pid, tid, on) {
    const db = peek.db, p = W.prop(db, pid), r = W.rec(db, peek.id);
    if (p.back) {
      /* editar o lado de volta = mudar a propriedade de ida no outro registo */
      const o = W.rec(p.back.db, tid), list = (o[p.back.via] || []).slice(), i = list.indexOf(r.id);
      if (on && i < 0) list.push(r.id); if (!on && i >= 0) list.splice(i, 1);
      apply({ o: 'set', db: p.back.db, id: tid, k: p.back.via, v: list });
    } else {
      let list = (r[pid] || []).slice(); const i = list.indexOf(tid);
      if (on && i < 0) list.push(tid);
      if (!on && i >= 0) list.splice(i, 1);
      apply({ o: 'set', db, id: r.id, k: pid, v: list });
    }
    rerender();
  }
  function addBody() {
    const inp = $('[data-body]', el); const t = (inp && inp.value || '').trim(); if (!t) return;
    apply({ o: 'body+', db: peek.db, id: peek.id, blocks: [{ k: 'p', t: `${Pr.fmtDay(W.clock(), 'short')}: ${t}` }] });
    rerender(); const n = $('[data-body]', el); if (n) n.focus();
  }
  function onChange(e) {
    const t = e.target; if (!el.contains(t)) return;
    if (t.dataset.flt != null) {
      const i = +t.dataset.flt, k = t.dataset.k;
      updView(v => { const f = v.filter[i];
        if (k === 'p') { const p = W.prop(cur.db, t.value); v.filter[i] = defaultFilter(cur.db, p); }
        else if (k === 'op') { f.op = t.value; const p = W.prop(cur.db, f.p); const d = defaultFilter(cur.db, p); if (f.op === 'between') f.v = [30, 37]; else if (Array.isArray(f.v) || (W.needsVal(f.op) && (f.v == null || f.v === ''))) f.v = d.v; }
        else if (k === 'v0' || k === 'v1') { const arr = Array.isArray(f.v) ? f.v.slice() : [0, 7]; arr[k === 'v0' ? 0 : 1] = Math.max(0, +t.value || 0); f.v = arr; }
        else f.v = t.type === 'number' ? Math.max(0, +t.value || 0) : t.value; });
      done('filter'); rerender(true); return;
    }
    if (t.dataset.sort != null) { const i = +t.dataset.sort; updView(v => { v.sort[i][t.dataset.k] = t.value; }); rerender(true); return; }
    if (t.dataset.np) {
      const k = t.dataset.np;
      if (k === 'two') np.two = t.checked; else if (k === 'rrel') { np.roll.rel = t.value; np.roll.prop = ''; } else if (k === 'rprop') np.roll.prop = t.value; else if (k === 'rfn') np.roll.fn = t.value; else np[k] = t.value;
      rerender(true); return;
    }
    if (t.dataset.pe && peek) {
      const k = t.dataset.pe === 'title' ? 'name' : t.dataset.pe;
      const r = W.rec(peek.db, peek.id); const v = t.value;
      if (k === 'name' && !v.trim()) return;
      if (L(r[k]) === v) return;
      apply({ o: 'set', db: peek.db, id: peek.id, k, v: t.tagName === 'SELECT' && !v ? null : v });
      /* texto: confirma-se ao sair do campo — redesenhar agora engolia o
         clique que provocou a saída. Atualiza só o que se vê. */
      if (t.tagName === 'SELECT') { rerender(true); return; }
      const row = $(`[data-row="${peek.id}"] .nb-title`, el); if (row && k === 'name') row.textContent = v;
    }
  }
  function onInput(e) {
    const t = e.target; if (!el.contains(t)) return;
    if (t.dataset.np === 'name' || t.dataset.np === 'q' || t.dataset.np === 'opts') {
      np[t.dataset.np] = t.value;
      const b = $('[data-act="p-create"]', el); if (b) b.disabled = !(np.name.trim() && np.q.trim().length > 8);
    }
  }
  function onKey(e) {
    if (!el || !el.contains(e.target)) return;
    if (e.key === 'Enter' && e.target.matches('[data-body]')) { e.preventDefault(); addBody(); }
    if (e.key === 'Enter' && e.target.matches('.nb-pk-title, [data-pe]')) { e.target.blur(); }
    if (e.key === 'Escape' && peek) { peek = null; rerender(); }
  }
  document.addEventListener('click', e => { if (el && document.body.contains(el) && $('[data-nb]', el)) onClick(e); });
  document.addEventListener('change', e => { if (el && $('[data-nb]', el)) onChange(e); });
  document.addEventListener('input', e => { if (el && $('[data-nb]', el)) onInput(e); });
  document.addEventListener('keydown', e => { if (el && $('[data-nb]', el)) onKey(e); });
  document.addEventListener('focusout', e => { if (el && $('[data-nb]', el) && e.target.matches && e.target.matches('.nb-pk-title, .nb-pk-props input[type=text]')) onChange(e); });

  Pr.route('experimentar/notion', (rest, root) => route(rest, root));

  return { schemaSvg, cell, TYPE_NAMES, decisionOps };
})();
