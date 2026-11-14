/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — Laboratório de captura (global `PrCapture`)
   ──────────────────────────────────────────────────────────────────
   • parse(linha)   — quick-add ao estilo do Todoist: título, #contentor,
                      data em linguagem natural (pt/en), hora, p1–p3.
                      É uma IMITAÇÃO didática da sintaxe, não o produto.
   • lintNote(s)    — as regras de captura de notas (Parte 3)
   • a página       — capturar ações e notas para o mundo de exemplo e ver
                      os três filtros e a fila "Sem equipa" a mudar.
   ══════════════════════════════════════════════════════════════════ */
const PrCapture = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const W = PrWorld;
  const SRC = 'cap';

  /* ── parser ── */
  const WD = [
    ['dom', 'domingo', 'sun', 'sunday'], ['seg', 'segunda', 'mon', 'monday'], ['ter', 'terça', 'terca', 'tue', 'tuesday'], ['qua', 'quarta', 'wed', 'wednesday'],
    ['qui', 'quinta', 'thu', 'thursday'], ['sex', 'sexta', 'fri', 'friday'], ['sáb', 'sab', 'sábado', 'sabado', 'sat', 'saturday'],
  ];
  /* "começa por um verbo?" — lista explícita + infinitivos portugueses (-ar/-er/-ir/-por),
     com uma lista curta de substantivos que acabam igual. Heurística: avisa, nunca bloqueia. */
  const VERB_LIST = /^(verificar|insistir|escrever|rever|preparar|decidir|enviar|mencionar|falar|perguntar|pedir|reservar|marcar|atualizar|ler|resolver|comprar|pagar|renovar|ligar|ver|fazer|tratar|estudar|entregar|confirmar|pôr|por|repor|propor|compor|dispor|ir|dar|ter|ser|vir|trazer|dizer|verify|chase|draft|review|prepare|decide|email|mention|ask|book|schedule|send|update|read|solve|buy|pay|renew|call|check|write|study|submit|confirm|collect|add|agree|analyse|analyze|answer|approve|arrange|attend|build|cancel|change|choose|clean|close|compare|complete|contact|create|define|delete|deliver|design|discuss|do|download|edit|estimate|explain|file|find|finish|fix|follow|get|give|go|help|hire|install|invite|list|look|make|meet|merge|migrate|move|order|organise|organize|outline|pack|pick|plan|post|print|publish|put|reply|report|request|research|reschedule|return|run|sign|sketch|sort|start|take|tell|test|text|try|upload|visit|wrap)\b/i;
  const NOT_VERB = /^(lugar|jantar|almoçar|mar|bar|par|lar|altar|radar|açúcar|mulher|prazer|poder|dever|colar|olhar|pomar|militar|familiar|calendar|dollar|bar|car|star|war|year|order of|seminar|webinar|solar|polar|regular|similar|particular|popular|cedar|sugar|pillar|collar|mortar|grammar)$/i;
  const VERB_RX = { test(s) {
    const t = String(s || '').trim(); if (VERB_LIST.test(t)) return true;
    const w = (t.match(/^[\p{L}]+/u) || [''])[0].toLowerCase();
    return w.length >= 4 && /(ar|er|ir|por)$/.test(w) && !NOT_VERB.test(w);
  } };

  function parse(line, now) {
    now = now == null ? W.clock() : now;
    const out = { title: '', box: null, boxRaw: null, due: null, time: null, p: null, tokens: [], warn: [] };
    let s = ' ' + String(line || '') + ' ';
    const mark = (re, fn) => { s = s.replace(re, (...m) => { const r = fn(...m); return r === false ? m[0] : ' '; }); };
    /* #Contentor (até ao próximo espaço — por isso os nomes levam hífen) */
    mark(/\s#([^\s#]+)/g, (m, name) => {
      const b = W.boxes().find(x => W.fold(L(x.l).replace(/^#/, '')) === W.fold(name));
      out.boxRaw = name; out.box = b ? b.id : null;
      out.tokens.push({ k: 'box', t: '#' + name, ok: !!b });
      if (!b) out.warn.push(tx(`"#${name}" não é um contentor que exista. Os do mundo de exemplo: ${W.boxes().map(x => L(x.l)).join(', ')}.`, `"#${name}" is not an existing container. The sample world's: ${W.boxes().map(x => L(x.l)).join(', ')}.`));
    });
    mark(/\s(p[1-4])(?=\s)/gi, (m, p) => { out.p = +p[1]; out.tokens.push({ k: 'p', t: p.toLowerCase(), ok: true }); });
    /* hora: "às 8", "as 8h", "at 8", "8am", "14h30" */
    mark(/\s(?:[àa]s|at)\s+(\d{1,2})(?:[:h](\d{2}))?h?(am|pm)?(?=\s)/gi, (m, h, mi, ap) => { let H = +h; if (ap && ap.toLowerCase() === 'pm' && H < 12) H += 12; out.time = `${String(H).padStart(2, '0')}:${mi || '00'}`; out.tokens.push({ k: 'time', t: m.trim(), ok: true }); });
    mark(/\s(\d{1,2})(am|pm)(?=\s)/gi, (m, h, ap) => { let H = +h; if (ap.toLowerCase() === 'pm' && H < 12) H += 12; out.time = `${String(H).padStart(2, '0')}:00`; out.tokens.push({ k: 'time', t: m.trim(), ok: true }); });
    /* datas */
    const setDue = (d, t) => { out.due = d; out.tokens.push({ k: 'date', t, ok: true }); };
    mark(/\s(hoje|today)(?=\s)/gi, (m, w) => setDue(now, w));
    mark(/\s(amanh[ãa]|tomorrow)(?=\s)/gi, (m, w) => setDue(now + 1, w));
    mark(/\s(daqui a|in)\s+(\d{1,2})\s+(dias?|days?)(?=\s)/gi, (m, a, n) => setDue(now + +n, m.trim()));
    mark(/\s(pr[óo]xima semana|next week)(?=\s)/gi, (m) => { const wd = Pr.weekday(now); const toMon = ((8 - wd) % 7) || 7; setDue(now + toMon, m.trim()); });
    mark(/\s([a-zçáé]{3,9})(?=\s)/gi, (m, w) => {
      if (out.due != null) return false;
      const i = WD.findIndex(arr => arr.includes(w.toLowerCase())); if (i < 0) return false;
      const wd = Pr.weekday(now); let n = (i - wd + 7) % 7; setDue(now + n, w); return true;
    });
    out.title = s.replace(/\s+/g, ' ').trim();
    if (out.title && !VERB_RX.test(out.title)) out.warn.push(tx('O título não começa por um verbo. "Reunião com X" fica ambíguo em poucos dias: era para marcar, preparar, ou só aparecer?', 'The title does not start with a verb. "Meeting with X" becomes ambiguous within days: schedule it, prepare it, or just show up?'));
    if (out.box === 'wp' && !W.projOf(out.title)) out.warn.push(tx('Em #…-Projetos, o nome do projeto vai no fim do título, entre parênteses — é o elo de pesquisa.', 'In #…-Projects, the project name goes at the end of the title, in brackets — it is the search link.'));
    if (out.p === 1) out.warn.push(tx('P1 só quando é mesmo mais urgente do que o resto. Na maioria dos dias nada tem prioridade.', 'P1 only when it is genuinely more urgent than the rest. Most days nothing is flagged.'));
    return out;
  }
  function taskOp(parsed, extra) {
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    return { o: 'add', db: 'tasks', r: Object.assign({ id, t: parsed.title, box: parsed.box || 'wg', due: parsed.due, p: parsed.p || 4 }, extra || {}) };
  }

  /* ── regras das notas (partilhadas com Aprender › Notas) ── */
  const ACTION_VERBS = /^(ver|verificar|ligar|enviar|marcar|lembrar|comprar|falar|pedir|rever|fazer|tratar|check|call|send|book|remember|buy|ask|review|do|email|chase|insistir|schedule|update|atualizar)\b/i;
  const VAGUE = /\b(coisa|isto|aquilo|cena|thing|stuff|something|algo)\b/i;
  function lintNote(s) {
    s = String(s || '').trim();
    const body = s.replace(/^[^:]{2,30}:\s*/, '');
    const m = s.match(/^([^:]{2,30}):\s/);
    const teams = W.recs('teams').map(r => W.fold(W.title('teams', r)));
    const pref = m ? W.fold(m[1]) : '';
    const kind = /^(decis[aã]o|decision|risco|risk|ideia|idea)$/i.test(pref);
    return {
      action: ACTION_VERBS.test(body),
      vague: VAGUE.test(s),
      short: s.split(/\s+/).length < 5,
      team: m && teams.includes(pref) ? m[1] : null,
      kind: kind ? m[1] : null,
      badPrefix: m && !teams.includes(pref) && !kind ? m[1] : null,
      project: W.projOf(s),
    };
  }

  /* ════════════════ página ════════════════ */
  let el = null, tab = 'act', filt = 'due7', last = null;
  const EX_ACT = () => W.scenario() === 'work'
    ? [tx('Marcar reunião com o fornecedor #Trabalho-Geral amanhã às 8', 'Schedule vendor meeting #Work-General tomorrow at 8'),
       tx('Verificar se o teste de recuo passou em staging (Migração da BD) #Trabalho-Projetos qua p1', 'Verify rollback test passed in staging (DB migration) #Work-Projects wed p1'),
       tx('Insistir com a Elena pelo rascunho (Renovação do CI) #Trabalho-Projetos sexta', 'Chase Elena for the draft (CI revamp) #Work-Projects fri'),
       tx('Reunião fornecedor #Trabalho Geral amanhã', 'Vendor meeting #Work General tomorrow')]
    : [tx('Ler o capítulo 6 (Exame de Estatística) #Projetos quinta', 'Read chapter 6 (Statistics exam) #Projects thu'),
       tx('Insistir com a Inês pela bibliografia (Trabalho de Sociologia) #Projetos daqui a 3 dias', 'Chase Inês for the bibliography (Sociology paper) #Projects in 3 days'),
       tx('Pagar a renda #Geral sexta às 9', 'Pay the rent #General fri at 9'),
       tx('Ginásio #Geral', 'Gym #General')];
  const EX_NOTE = () => W.scenario() === 'work'
    ? [tx('Atlas: a Ana assinalou picos de atraso no fim do mês (Migração da BD)', 'Atlas: Ana flagged lag spikes at month-end (DB migration)'), tx('Coisa do Kafka', 'Kafka thing'), tx('Ver a cache amanhã', 'Check the cache tomorrow'), tx('Decisão: o ensaio é ao sábado (Migração da BD)', 'Decision: the rehearsal is on a Saturday (DB migration)')]
    : [tx('Estudos: o exame de Estatística é na sala 2.14 (Exame de Estatística)', 'Studies: the Statistics exam is in room 2.14 (Statistics exam)'), tx('Coisa do Excel', 'Excel thing'), tx('Comprar marcadores', 'Buy highlighters')];

  function page(rest, root) {
    el = root;
    PrShell.setArea('experimentar', tx('Laboratório de captura', 'Capture lab'));
    draw();
  }
  function draw() {
    el.innerHTML = `<div class="pr-wrap pr-page">
      ${crumbs([{ label: tx('Experimentar', 'Experiment'), href: '#experimentar' }, { label: tx('Laboratório de captura', 'Capture lab') }])}
      <header class="pr-head"><p class="pr-kicker">${Pr.kindTag('act')} ${Pr.kindTag('info')}</p><h1>${esc(tx('Capturar em segundos', 'Capture in seconds'))}</h1>
        <p class="lede">${esc(tx('Escrever tem de custar segundos, ou deixas de o fazer — e as coisas voltam a viver na tua cabeça. Uma ação numa linha; uma informação numa linha. O resto decide-se na revisão.',
          'Writing it down must cost seconds, or you stop doing it — and things move back into your head. An action in one line; a piece of information in one line. The rest is decided at the review.'))}</p></header>
      ${PrApp.worldBar(SRC)}
      <div class="cp-grid">
        <section class="cp-in pr-sheet" aria-label="${esc(tx('Capturar', 'Capture'))}">
          <div class="seg" role="tablist">
            <button type="button" role="tab" class="seg-btn ${tab === 'act' ? 'active' : ''}" aria-selected="${tab === 'act'}" data-tab="act">${esc(tx('Uma ação', 'An action'))}</button>
            <button type="button" role="tab" class="seg-btn ${tab === 'note' ? 'active' : ''}" aria-selected="${tab === 'note'}" data-tab="note">${esc(tx('Uma nota', 'A note'))}</button>
          </div>
          ${tab === 'act' ? actForm() : noteForm()}
        </section>
        <section class="cp-out" aria-live="polite">${outPane()}</section>
      </div>
      <p class="pr-sub" style="margin-top:1.2rem">${Pr.srcTag('chk')} ${esc(tx('A sintaxe imita o quick-add do Todoist (#projeto, p1, datas em linguagem natural) para ensinar a ideia. Cada app tem a sua — confirma na tua.', 'The syntax imitates Todoist quick-add (#project, p1, natural-language dates) to teach the idea. Every app has its own — check yours.'))}</p>
      ${Pr.localNote()}
    </div>`;
    if (tab === 'act') updParse(); else updLint();
  }
  function actForm() {
    return `<label class="cp-label" for="cp-q">${esc(tx('Quick-add', 'Quick add'))} <span class="pr-sub">${esc(tx('uma linha: título, #contentor, data, p1', 'one line: title, #container, date, p1'))}</span></label>
      <input id="cp-q" class="cp-q" type="text" autocomplete="off" spellcheck="false" maxlength="200" placeholder="${esc(EX_ACT()[0])}">
      <div class="cp-parse" data-parse></div>
      <div class="pr-row"><button type="button" class="btn btn-primary" data-add disabled>${ICON.plus} ${esc(tx('Adicionar tarefa', 'Add task'))}</button><span class="pr-sub cp-hint">Enter</span></div>
      <p class="pr-kicker" style="margin-top:1.1rem">${esc(tx('Experimenta', 'Try'))}</p>
      <div class="cp-ex">${EX_ACT().map((x, i) => `<button type="button" class="cp-exb" data-ex="${i}">${esc(x)}</button>`).join('')}</div>
      <details class="cp-help"><summary>${esc(tx('O que o parser entende', 'What the parser understands'))}</summary>
        <ul><li><code>#${esc(L(W.boxes()[0].l).slice(1))}</code> — ${esc(tx('contentor (até ao próximo espaço: por isso os nomes levam hífen)', 'container (up to the next space: hence hyphenated names)'))}</li>
        <li><code>${esc(tx('hoje · amanhã · sexta · daqui a 3 dias · próxima semana', 'today · tomorrow · fri · in 3 days · next week'))}</code></li>
        <li><code>${esc(tx('às 8 · 14h30', 'at 8 · 2pm'))}</code> · <code>p1 p2 p3</code></li></ul></details>`;
  }
  function noteForm() {
    return `<label class="cp-label" for="cp-n">${esc(tx('Uma linha para as Notas', 'One line for Notes'))} <span class="pr-sub">${esc(tx('equipa primeiro, projeto no fim', 'team first, project last'))}</span></label>
      <input id="cp-n" class="cp-q" type="text" autocomplete="off" maxlength="200" placeholder="${esc(EX_NOTE()[0])}">
      <ul class="lr-lint cp-lint" data-lint></ul>
      <div class="pr-row"><button type="button" class="btn btn-primary" data-addn disabled>${ICON.plus} ${esc(tx('Capturar nota', 'Capture note'))}</button>
        <span class="pr-sub">${esc(tx('Sem equipa, etiquetas nem propriedades — a triagem trata disso.', 'No team, tags or properties — triage handles that.'))}</span></div>
      <p class="pr-kicker" style="margin-top:1.1rem">${esc(tx('Experimenta', 'Try'))}</p>
      <div class="cp-ex">${EX_NOTE().map((x, i) => `<button type="button" class="cp-exb" data-exn="${i}">${esc(x)}</button>`).join('')}</div>`;
  }
  function outPane() {
    const F = W.TASK_FILTERS, now = W.clock();
    const list = W.filterTasks(filt);
    const nt = W.query('notes', (W.state().views.notes || []).find(v => v.id === 'noteam') || { filter: [{ p: 'team', op: 'empty' }] });
    return `<div class="pr-sheet cp-box"><div class="cp-box-h"><b>${esc(tx('Lista de tarefas', 'Task list'))}</b><span class="pr-sub">${esc(Pr.fmtDay(now, 'long'))}</span></div>
        <div class="seg" role="tablist">${Object.keys(F).map(k => `<button type="button" role="tab" class="seg-btn ${k === filt ? 'active' : ''}" aria-selected="${k === filt}" data-filt="${k}">${esc(L(F[k].name))} <span class="pr-mono" data-fc="${k}">${W.filterTasks(k).length}</span></button>`).join('')}</div>
        <p class="lr-q pr-mono">${esc(L(F[filt].q))}</p>
        <ul class="lr-tasks" data-tasks>${list.map(t => taskRow(t, now)).join('') || `<li class="pr-sub">${esc(tx('Nada aqui.', 'Nothing here.'))}</li>`}</ul>
        ${(() => { const nd = W.tasks().filter(t => t.due == null); return nd.length ? `<p class="pr-sub">${esc(tx(`+ ${nd.length} sem data — ficam no contentor e aparecem nas passagens normais.`, `+ ${nd.length} undated — they sit in their container and come up in normal passes.`))}</p>` : ''; })()}</div>
      <div class="pr-sheet cp-box" data-noteq><div class="cp-box-h"><b>${esc(tx('Notas › Sem equipa', 'Notes › No team'))}</b><span class="pr-mono">${nt.rows.length}</span></div>
        <ul class="lr-mini">${nt.rows.slice(-5).reverse().map(r => `<li class="${r.id === last ? 'cp-new' : ''}"><span>${esc(W.title('notes', r))}</span><small>${esc(Pr.relDay(r.cr, now))}</small></li>`).join('')}</ul>
        <a class="btn btn-sm btn-ghost" href="#experimentar/notion/notes/noteam">${esc(tx('Ver no playground', 'See it in the playground'))} ${ICON.arrow}</a></div>`;
  }
  function taskRow(t, now) {
    return PrLearn.taskLi(t, now).replace('<li>', `<li class="${t.id === last ? 'cp-new' : ''}">`);
  }

  function chipsHtml(p) {
    const B = p.box ? W.box(p.box) : null;
    const row = (k, label, val, ok) => `<div class="cp-f ${ok === false ? 'bad' : val ? 'on' : ''}"><span class="pr-kicker">${esc(label)}</span><b>${val ? esc(val) : '—'}</b></div>`;
    return `<div class="cp-fields">${row('t', tx('Tarefa', 'Task'), p.title, !!p.title)}
      ${row('b', tx('Contentor', 'Container'), p.boxRaw ? (B ? L(B.l) : '#' + p.boxRaw + ' ?') : tx('(predefinido)', '(default)') + ' ' + L(W.box('wg').l), p.boxRaw ? !!B : null)}
      ${row('d', tx('Data', 'Due'), p.due != null ? Pr.fmtDay(p.due, 'long') + (p.time ? ' · ' + p.time : '') : '', null)}
      ${row('p', tx('Prioridade', 'Priority'), p.p ? 'P' + p.p : '', null)}</div>
      ${p.tokens.length ? `<p class="cp-tok">${p.tokens.map(t => `<span class="cp-t ${t.k} ${t.ok ? '' : 'bad'}">${esc(t.t)}</span>`).join(' ')}</p>` : ''}
      ${p.warn.map(w => `<p class="cp-warn">${esc(w)}</p>`).join('')}`;
  }
  function updParse() {
    const inp = $('#cp-q', el); if (!inp) return;
    const p = parse(inp.value);
    $('[data-parse]', el).innerHTML = inp.value.trim() ? chipsHtml(p) : `<p class="pr-sub">${esc(tx('Escreve ou escolhe um exemplo: vês os campos a preencherem-se a partir de uma linha só.', 'Type or pick an example: watch the fields fill in from a single line.'))}</p>`;
    $('[data-add]', el).disabled = !p.title || (p.boxRaw && !p.box);
  }
  function updLint() {
    const inp = $('#cp-n', el); if (!inp) return;
    const s = inp.value.trim(), out = $('[data-lint]', el);
    $('[data-addn]', el).disabled = !s;
    if (!s) { out.innerHTML = ''; return; }
    const r = lintNote(s);
    const li = (ok, t, soft) => `<li class="${ok ? 'ok' : soft ? 'soft' : 'no'}">${ok ? ICON.check : ICON.x}<span>${esc(t)}</span></li>`;
    out.innerHTML = [
      li(!r.action, r.action ? tx('Isto é uma AÇÃO: vai para a lista de tarefas, não para as Notas.', 'This is an ACTION: it belongs on the task list, not in Notes.') : tx('Não é uma ação disfarçada.', 'Not a disguised action.')),
      li(!r.vague && !r.short, r.vague ? tx('Palavra vaga: daqui a três meses não vais saber o que era.', 'Vague word: in three months you will not know what it was.') : r.short ? tx('Muito curta para se perceber sozinha.', 'Too short to stand alone.') : tx('Percebe-se sozinha.', 'Stands on its own.')),
      li(!!(r.team || r.kind), r.team ? tx(`Equipa primeiro: «${r.team}».`, `Team first: «${r.team}».`) : r.kind ? tx(`Tipo primeiro: «${r.kind}».`, `Kind first: «${r.kind}».`) : r.badPrefix ? tx(`«${r.badPrefix}» não é uma equipa do mundo de exemplo.`, `«${r.badPrefix}» is not a team in the sample world.`) : tx('Sem prefixo — bem, se for transversal.', 'No prefix — fine if cross-team.'), !r.badPrefix),
      li(!!r.project, r.project ? tx(`Projeto no fim: «${r.project}».`, `Project last: «${r.project}».`) : tx('Sem projeto — só se for sobre um.', 'No project — only if it is about one.'), true),
    ].join('');
  }

  async function addTask() {
    const inp = $('#cp-q', el); const p = parse(inp.value); if (!p.title) return;
    const op = taskOp(p);
    const from = $('[data-parse] .cp-fields', el);
    if (W.apply(SRC, op)) {
      last = op.r.id;
      const inF = Object.keys(W.TASK_FILTERS).filter(k => W.filterTasks(k).some(t => t.id === last));
      if (inF.length && !inF.includes(filt)) filt = inF[0];
      await Pr.fly(from, $(`[data-filt="${filt}"]`, el), { cls: 'k-act', text: p.title });
      inp.value = '';
      $('.cp-out', el).innerHTML = outPane(); updParse();
      Pr.toast(inF.length ? tx(`Entrou em: ${inF.map(k => L(W.TASK_FILTERS[k].name)).join(', ')}.`, `Now in: ${inF.map(k => L(W.TASK_FILTERS[k].name)).join(', ')}.`) : tx('Sem data: fica no contentor, fora dos filtros de datas.', 'Undated: it sits in its container, outside the date filters.'));
      inp.focus();
    }
  }
  async function addNote() {
    const inp = $('#cp-n', el); const s = inp.value.trim(); if (!s) return;
    const r = lintNote(s);
    if (r.action) Pr.toast(tx('Capturada — mas é uma ação. Na triagem de sexta vai virar tarefa ("Agir").', 'Captured — but it is an action. At Friday triage it will become a task ("Act").'));
    const id = 'n' + Date.now().toString(36);
    if (W.apply(SRC, { o: 'add', db: 'notes', r: { id, name: s, team: [], tags: [] } })) {
      last = id;
      await Pr.fly(inp, $('[data-noteq]', el), { cls: 'k-info', text: s });
      inp.value = ''; $('.cp-out', el).innerHTML = outPane(); updLint(); inp.focus();
    }
  }

  document.addEventListener('input', e => { if (!el || !el.contains(e.target)) return; if (e.target.id === 'cp-q') updParse(); if (e.target.id === 'cp-n') updLint(); });
  document.addEventListener('keydown', e => { if (!el || !el.contains(e.target) || e.key !== 'Enter') return; if (e.target.id === 'cp-q') { e.preventDefault(); addTask(); } if (e.target.id === 'cp-n') { e.preventDefault(); addNote(); } });
  document.addEventListener('click', e => {
    if (!el || !el.contains(e.target) || !$('.cp-grid', el)) return;
    const t = e.target.closest('[data-tab],[data-ex],[data-exn],[data-add],[data-addn],[data-filt]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; draw(); $(tab === 'act' ? '#cp-q' : '#cp-n', el).focus(); }
    else if (t.dataset.ex != null) { $('#cp-q', el).value = EX_ACT()[+t.dataset.ex]; updParse(); $('#cp-q', el).focus(); }
    else if (t.dataset.exn != null) { $('#cp-n', el).value = EX_NOTE()[+t.dataset.exn]; updLint(); $('#cp-n', el).focus(); }
    else if (t.hasAttribute('data-add')) addTask();
    else if (t.hasAttribute('data-addn')) addNote();
    else if (t.dataset.filt) { filt = t.dataset.filt; $('.cp-out', el).innerHTML = outPane(); Pr.stagger($$('[data-tasks] li', el)); }
  });

  Pr.route('experimentar/captura', page);
  return { parse, taskOp, lintNote, VERB_RX };
})();
