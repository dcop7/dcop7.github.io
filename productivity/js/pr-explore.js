/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — Explorar + "Desenhar o teu sistema"
   ──────────────────────────────────────────────────────────────────
     explorar/mapa                 segue uma coisa pelo sistema (SVG)
     explorar/relacoes             o esquema ao vivo, explicado
     explorar/ferramentas[/<id>]   diretório: requisitos, fontes, datas
     explorar/combinar             uma ferramenta por papel → lacunas
     aplicar/sistema               restrições → ferramentas → plano
   Sem pontuações: os indicadores são requisitos concretos, cada um com
   o seu estado e a fonte de onde veio.
   ══════════════════════════════════════════════════════════════════ */
const PrExplore = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const T = PrTools;
  const B = (pt, en) => ({ pt, en });
  const nm = t => (typeof t.name === 'object' ? L(t.name) : t.name);
  const head = (area, crumb, kinds, h1, lede, wide) => `${crumbs([{ label: L(PrApp.AREAS[area].name), href: '#' + area }, { label: crumb }])}
    <header class="pr-head"${wide ? ' style="max-width:none"' : ''}><p class="pr-kicker">${kinds.map(Pr.kindTag).join(' ')}</p><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</header>`;
  const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return Pr.lang() === 'en' ? new Date(y, m - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(y, m - 1, dd).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  function srcLink(key) {
    if (!key || key === 'own') return `<span class="ex-src own">${esc(tx('natureza do papel', 'nature of paper'))}</span>`;
    const s = T.SRC[key]; if (!s) return '';
    return `<a class="ex-src" href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${esc(host(s.u))}${ICON.ext || ''}</a>${s.d ? `<span class="ex-date">${esc(tx('verificado ', 'checked '))}${esc(fmtDate(s.d))}</span>` : `<span class="ex-date">${esc(tx('fonte do método', 'method source'))}</span>`}`;
  }
  const stIcon = s => `<span class="ex-st st-${s}" title="${esc(L(T.STATES[s].l))}" aria-label="${esc(L(T.STATES[s].l))}">${T.STATES[s].s}</span>`;
  const roleName = r => L(T.ROLES[r].n);
  const roleTag = r => T.ROLES[r].k ? Pr.kindTag(T.ROLES[r].k).replace(/>[^<]*</, `>${esc(roleName(r))}<`) : `<span class="k-tag k-cal">${esc(roleName(r))}</span>`;

  /* ════════════════ mapa do sistema ════════════════ */
  const MNODES = {
    in: { x: 88, y: 220, l: B('Chama-te a atenção', 'Grabs your attention'), c: 'in' },
    act: { x: 330, y: 50, l: B('Lista de tarefas', 'Task list'), c: 'act', role: 'act' },
    info: { x: 330, y: 118, l: B('Notas', 'Notes'), c: 'info', role: 'info' },
    meet: { x: 330, y: 186, l: B('Página da reunião', 'Meeting page'), c: 'info', role: 'str' },
    today: { x: 330, y: 254, l: B('Caderno (Big 3)', 'Notebook (Big 3)'), c: 'today', role: 'today' },
    str: { x: 330, y: 322, l: B('Projetos', 'Projects'), c: 'str', role: 'str' },
    cal: { x: 330, y: 390, l: B('Calendário', 'Calendar'), c: 'cal', role: 'cal' },
    rev: { x: 590, y: 220, l: B('Revisão semanal', 'Weekly review'), c: 'rev' },
    done: { x: 850, y: 50, l: B('Feito ✓', 'Done ✓'), c: 'end' },
    kept: { x: 850, y: 118, l: B('Notas, com equipa', 'Notes, with a team'), c: 'end' },
    filed: { x: 850, y: 186, l: B('A página a que pertence', 'The page it belongs to'), c: 'end' },
    rec: { x: 850, y: 254, l: B('Um registo estruturado', 'A structured record'), c: 'end' },
    out: { x: 850, y: 322, l: B('Arquivo ou lixo', 'Archive or bin'), c: 'end' },
    next: { x: 850, y: 390, l: B('Próxima ação na lista', 'Next action on the list'), c: 'end' },
  };
  const ITEMS = [
    { id: 'promise', s: B('Prometes enviar os diapositivos ao Rui até amanhã', 'You promise to send Rui the slides by tomorrow'), path: ['in', 'act', 'done'],
      steps: [B('Quick-add em segundos: "Enviar os diapositivos ao Rui amanhã".', 'Quick-add in seconds: "Send the slides to Rui tomorrow".'), B('Aparece no filtro Hoje amanhã; fazes e marcas. Nunca passa pela revisão.', 'It shows in the Today filter tomorrow; you do it and tick it. It never needs the review.')] },
    { id: 'fact', s: B('Ouves que os portáteis novos chegam com 32 GB', 'You hear the new laptops come with 32 GB'), path: ['in', 'info', 'rev', 'kept'],
      steps: [B('Uma linha nas Notas, sem equipa — capturar não exige decidir.', 'One line in Notes, no team — capturing does not require deciding.'), B('Sexta: na vista "Sem equipa" recebe um destino.', 'Friday: in the "No team" view it gets a fate.'), B('Guardar: ganha equipa e sai da fila. Volta a aparecer uma vez, 30 dias depois.', 'Keep: it gets a team and leaves the queue. It comes up once more, 30 days later.')] },
    { id: 'decision', s: B('A Ana diz que está decidido: PostgreSQL gerido', 'Ana says it is decided: managed PostgreSQL'), path: ['in', 'info', 'rev', 'rec'],
      steps: [B('"Decisão: …" nas Notas.', '"Decision: …" in Notes.'), B('Na revisão, é a terceira nota de decisão.', 'At the review, it is the third decision note.'), B('Graduar: a regra de três pede uma base Decisões — vira um registo com Estado e Confiança.', 'Graduate: the rule of three calls for a Decisions database — it becomes a record with Status and Confidence.')] },
    { id: 'meeting', s: B('Na reunião semanal adia-se o congelamento', 'At the weekly sync the freeze is pushed back'), path: ['in', 'meet', 'filed'],
      steps: [B('Dito numa reunião marcada: entrada datada na página da reunião.', 'Said in a scheduled meeting: a dated entry on the meeting page.'), B('Já está onde pertence — não precisa de triagem.', 'It is already where it belongs — no triage needed.')] },
    { id: 'focus', s: B('Hoje tem mesmo de sair a resposta à auditoria', 'The audit reply really must go out today'), path: ['in', 'today', 'done'],
      steps: [B('A tarefa já existe: escreves-a nos Big 3 de manhã.', 'The task already exists: you write it in the morning Big 3.'), B('À noite: ✓ no caderno e ✓ na lista. A página morre.', 'In the evening: ✓ in the notebook and ✓ on the list. The page dies.')] },
    { id: 'project', s: B('A direção pede para reduzir 20% o custo da cloud até junho', 'Leadership asks to cut cloud cost 20% by June'), path: ['in', 'str', 'rev', 'next'],
      steps: [B('Uma linha em Projetos (Next), com o modelo de página.', 'A Projects row (Next), with the page template.'), B('Na revisão: este projeto tem uma tarefa aberta?', 'At the review: does this project have an open task?'), B('Se não: a próxima ação vai para a lista, com o nome do projeto no fim.', 'If not: the next action goes on the list, with the project name at the end.')] },
    { id: 'appt', s: B('A clínica marca consulta para terça às 15h', 'The clinic books you in for Tuesday at 3pm'), path: ['in', 'cal', 'done'],
      steps: [B('Tem hora: calendário. Não é uma tarefa.', 'It has a time: calendar. It is not a task.'), B('Acontece. Se houver algo para preparar, isso sim é uma tarefa.', 'It happens. If there is something to prepare, that is a task.')] },
  ];
  function mapPage(rest, el) {
    PrShell.setArea('explorar', tx('Mapa do sistema', 'System map'));
    let cur = ITEMS[1];
    el.innerHTML = `<div class="pr-wrap pr-page">
      ${head('explorar', tx('Mapa do sistema', 'System map'), ['act', 'info', 'today', 'str'], tx('Segue uma coisa pelo sistema', 'Follow one thing through the system'),
        tx('Escolhe algo que te chama a atenção e vê por onde passa até acabar. Depois toca num lugar para ver o que esse lugar tem de saber fazer — é isso que decide a ferramenta, não o logótipo.', 'Pick something that grabs your attention and watch where it goes until it ends. Then tap a place to see what that place must be able to do — that is what decides the tool, not the logo.'))}
      <div class="ex-items" role="tablist">${ITEMS.map(it => `<button type="button" role="tab" class="ex-item" data-it="${it.id}" aria-selected="${it === cur}">${esc(L(it.s))}</button>`).join('')}</div>
      <div class="ex-map-g"><div class="pr-sheet ex-map" data-map></div><aside class="ex-map-side" data-side aria-live="polite"></aside></div>
      <section class="pr-section"><p class="pr-kicker">${esc(tx('Como encaixam', 'How they fit'))} ${Pr.srcTag('own')}</p><h2 class="pr-h2">${esc(tx('Tarefas, calendário, notas e projetos', 'Tasks, calendar, notes and projects'))}</h2>
        <div class="pr-table-wrap"><table class="pr-table ex-fit"><thead><tr><th></th><th>${esc(tx('Guarda', 'Holds'))}</th><th>${esc(tx('Não guarda', 'Does not hold'))}</th><th>${esc(tx('Liga-se aos outros por', 'Links to the others through'))}</th></tr></thead><tbody>
          ${[[B('Tarefas', 'Tasks'), B('Tudo o que tens de fazer, com datas reais', 'Everything you must do, with real dates'), B('Planos, contexto, factos', 'Plans, context, facts'), B('O nome do projeto no fim do título', 'The project name at the end of the title')],
            [B('Calendário', 'Calendar'), B('Só o que tem hora: compromissos e blocos de foco', 'Only things with a time: appointments and focus blocks'), B('Prazos (são datas de tarefas)', 'Deadlines (they are task dates)'), B('Um bloco de foco por semana, escolhido na revisão', 'One focus block a week, chosen at the review')],
            [B('Notas', 'Notes'), B('O que ouviste, decidiste, aprendeste — uma linha', 'What you heard, decided, learned — one line'), B('Ações (viram tarefas na triagem)', 'Actions (they become tasks at triage)'), B('A relação Equipa; o nome do projeto no título', 'The Team relation; the project name in the title')],
            [B('Projetos', 'Projects'), B('O objetivo, o plano em texto, as decisões', 'The objective, the plan as text, the decisions'), B('A lista de tarefas do projeto', "The project's task list"), B('Relações para Equipas e Reuniões; a pesquisa pelo nome', 'Relations to Teams and Meetings; name search')],
            [B('Caderno', 'Notebook'), B('Três coisas hoje', 'Three things today'), B('Nada que precise de sobreviver a esta noite', 'Anything that must survive tonight'), B('Copias da lista de manhã; ✓ ✕ voltam à lista à noite', 'Copied from the list each morning; ✓ ✕ go back to the list at night')],
          ].map(r => `<tr><th>${esc(L(r[0]))}</th><td>${esc(L(r[1]))}</td><td>${esc(L(r[2]))}</td><td>${esc(L(r[3]))}</td></tr>`).join('')}</tbody></table></div></section></div>`;
    const map = $('[data-map]', el), side = $('[data-side]', el);
    let sel = null, run = 0;
    const draw = () => {
      const on = new Set(cur.path), edges = [];
      Object.keys(MNODES).filter(k => MNODES[k].c !== 'in' && MNODES[k].c !== 'rev' && MNODES[k].c !== 'end').forEach(k => edges.push(['in', k]));
      ['act', 'info', 'str'].forEach(k => edges.push([k, 'rev']));
      ['done', 'kept', 'filed', 'rec', 'out', 'next'].forEach(k => edges.push(['rev', k]));
      edges.push(['act', 'done'], ['meet', 'filed'], ['today', 'done'], ['cal', 'done']);
      const onEdge = (a, b) => { const i = cur.path.indexOf(a); return i >= 0 && cur.path[i + 1] === b; };
      const ln = (a, b) => { const A = MNODES[a], Bn = MNODES[b]; const x1 = A.x + 80, x2 = Bn.x - 80, mx = (x1 + x2) / 2; return `M${x1} ${A.y} C${mx} ${A.y} ${mx} ${Bn.y} ${x2} ${Bn.y}`; };
      map.innerHTML = `<svg viewBox="0 0 940 440" class="ex-svg" role="img" aria-label="${esc(tx('Mapa do percurso', 'Route map'))}">
        <g class="ex-cols">${[[88, B('Chega', 'Arrives')], [330, B('Captura', 'Capture')], [590, B('Triagem', 'Triage')], [850, B('Acaba', 'Ends up')]].map(([x, l]) => `<text x="${x}" y="16" text-anchor="middle">${esc(L(l).toUpperCase())}</text>`).join('')}</g>
        ${edges.map(([a, b]) => `<path class="ex-e ${onEdge(a, b) ? 'on' : ''}" d="${ln(a, b)}" ${onEdge(a, b) ? `data-e="${cur.path.indexOf(a)}"` : ''}/>`).join('')}
        ${Object.keys(MNODES).map(k => { const n = MNODES[k]; return `<g class="ex-n c-${n.c} ${on.has(k) ? 'on' : 'off'} ${sel === k ? 'sel' : ''}" ${n.role ? `data-node="${k}" tabindex="0" role="button"` : ''}>
          <rect x="${n.x - 80}" y="${n.y - 20}" width="160" height="40" rx="6"/><text x="${n.x}" y="${n.y + 4}" text-anchor="middle">${esc(L(n.l))}</text></g>`; }).join('')}
        <circle class="ex-dot" r="6" cx="${MNODES.in.x}" cy="${MNODES.in.y}"/></svg>`;
      sideDraw();
      animateDot();
    };
    const sideDraw = () => {
      if (sel) {
        const n = MNODES[sel], R = T.ROLES[n.role];
        const tools = T.TOOLS.filter(t => t.roles.includes(n.role));
        side.innerHTML = `<p class="pr-kicker">${esc(tx('O que este lugar tem de saber fazer', 'What this place must be able to do'))} ${Pr.srcTag(R.src === 'doc' ? 'own' : 'own')}</p><h2 class="pr-h3">${esc(L(n.l))}</h2>
          <ul class="ex-req">${R.req.map(q => `<li class="${q.must ? 'must' : 'nice'}"><b>${esc(q.must ? tx('Tem de', 'Must') : tx('Bom ter', 'Nice'))}</b> ${esc(L(q.n))}</li>`).join('')}</ul>
          <p class="pr-sub">${esc(tx(`${tools.length} ferramentas do diretório servem este papel.`, `${tools.length} directory tools serve this role.`))}</p>
          <div class="pr-row"><a class="btn btn-sm" href="#explorar/ferramentas/@${n.role}">${esc(tx('Ver no diretório', 'See in the directory'))} →</a><button type="button" class="btn btn-sm btn-ghost" data-unsel>${esc(tx('Voltar ao percurso', 'Back to the route'))}</button></div>`;
        return;
      }
      side.innerHTML = `<p class="pr-kicker">${esc(tx('O percurso', 'The route'))}</p><h2 class="pr-h3">${esc(L(cur.s))}</h2>
        <ol class="ex-steps">${cur.steps.map(s => `<li>${esc(L(s))}</li>`).join('')}</ol>
        <p class="pr-sub">${esc(tx('Toca num lugar do mapa (coluna Captura) para ver os requisitos dele.', 'Tap a place on the map (Capture column) to see its requirements.'))}</p>`;
    };
    const animateDot = () => {
      const dot = $('.ex-dot', map), my = ++run;
      const segs = $$('.ex-e.on', map).sort((a, b) => a.dataset.e - b.dataset.e);
      if (!Pr.motionOk() || !segs.length) { const last = MNODES[cur.path[cur.path.length - 1]]; dot.setAttribute('cx', last.x - 80); dot.setAttribute('cy', last.y); return; }
      let i = 0;
      const step = () => {
        if (my !== run || !segs[i]) return;
        const seg = segs[i], len = seg.getTotalLength(), o = { t: 0 };
        anime({ targets: o, t: 1, duration: 650, easing: 'easeInOutSine',
          update: () => { const pt = seg.getPointAtLength(o.t * len); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); },
          complete: () => { i++; if (my === run) step(); } });
      };
      step();
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-it]'); if (b) { cur = ITEMS.find(x => x.id === b.dataset.it); sel = null; $$('[data-it]', el).forEach(x => x.setAttribute('aria-selected', x === b)); draw(); return; }
      const n = e.target.closest('[data-node]'); if (n) { sel = n.dataset.node; draw(); return; }
      if (e.target.closest('[data-unsel]')) { sel = null; draw(); }
    });
    el.addEventListener('keydown', e => { const n = e.target.closest && e.target.closest('[data-node]'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = n.dataset.node; draw(); } });
    draw();
  }

  /* ════════════════ relações (esquema ao vivo) ════════════════ */
  function relPage(rest, el) {
    PrShell.setArea('explorar', tx('Como as bases de dados se ligam', 'How the databases connect'));
    const W = PrWorld, st = W.state();
    const rows = [];
    st.dbs.forEach(d => st.schema[d].props.forEach(p => {
      if (p.type === 'rel' && !p.back) {
        const back = p.rel.two ? (st.schema[p.rel.db] || { props: [] }).props.find(q => q.id === p.rel.back) : null;
        rows.push({ k: 'rel', from: d, p, to: p.rel.db, back });
      }
      if (p.type === 'rollup') rows.push({ k: 'roll', from: d, p });
    }));
    const dn = d => `${st.schema[d].icon} ${L(st.schema[d].name)}`;
    el.innerHTML = `<div class="pr-wrap pr-page">
      ${head('explorar', tx('Como as bases de dados se ligam', 'How the databases connect'), ['str'], tx('Como as bases de dados se ligam', 'How the databases connect'),
        tx('Desenhado ao vivo a partir do mundo de exemplo. Se acrescentares uma relação ou um rollup no playground, aparece aqui.', 'Drawn live from the sample world. Add a relation or a rollup in the playground and it shows up here.'))}
      ${PrApp.worldBar('nb')}
      <div class="ex-rel-g"><div class="pr-sheet ex-rel-map">${PrNotion.schemaSvg()}</div>
      <div><p class="pr-kicker">${esc(tx('Cada ligação, em português corrente', 'Every link, in plain words'))}</p>
        <ul class="ex-rels">${rows.map(r => r.k === 'rel'
          ? `<li><span class="ex-rk">${r.back ? '⇄' : '→'}</span><div><b>${esc(dn(r.from))} · ${esc(L(r.p.name))}</b><span>${esc(r.back
              ? tx(`aponta para ${L(st.schema[r.to].name)}; do outro lado aparece sozinha como "${L(r.back.name)}"`, `points to ${L(st.schema[r.to].name)}; on the other side it shows up on its own as "${L(r.back.name)}"`)
              : tx(`aponta para ${L(st.schema[r.to].name)}, só deste lado (uma via)`, `points to ${L(st.schema[r.to].name)}, on this side only (one-way)`))}</span>${r.p.note ? `<small class="ex-note">${esc(L(r.p.note))}</small>` : ''}</div></li>`
          : `<li><span class="ex-rk">Σ</span><div><b>${esc(dn(r.from))} · ${esc(L(r.p.name))}</b><span>${esc(rollPhrase(r))}</span>${r.p.q ? `<small>${esc(tx('Pergunta: ', 'Question: '))}${esc(L(r.p.q))}</small>` : ''}</div></li>`).join('')}</ul>
        <a class="btn btn-sm" href="#experimentar/notion/mapa">${esc(tx('Mexer no playground', 'Play in the playground'))} →</a></div></div>
      ${Pr.localNote()}</div>`;
  }
  function rollPhrase(r) {
    const W = PrWorld, st = W.state(), rel = st.schema[r.from].props.find(q => q.id === r.p.roll.rel);
    const target = rel ? (rel.back ? rel.back.db : rel.rel.db) : null;
    const tp = target ? st.schema[target].props.find(q => q.id === r.p.roll.prop) : null;
    const fn = W.ROLL_FNS[r.p.roll.fn] || r.p.roll.fn;
    return tx(`segue "${rel ? L(rel.name) : '?'}" até ${target ? L(st.schema[target].name) : '?'} e calcula "${typeof fn === 'object' ? L(fn) : fn}" de "${tp ? L(tp.name) : '?'}"`,
      `follows "${rel ? L(rel.name) : '?'}" to ${target ? L(st.schema[target].name) : '?'} and computes "${typeof fn === 'object' ? L(fn) : fn}" of "${tp ? L(tp.name) : '?'}"`);
  }

  /* ════════════════ diretório ════════════════ */
  const FILTERS = {
    offline: { l: B('Funciona offline (verificado)', 'Works offline (verified)'), test: t => ((t.req.info || {}).offline || [])[0] === 'y' || t.kind === 'paper' },
    oss: { l: B('Código aberto ou disponível', 'Open or source-available'), test: t => !!t.oss },
    e2ee: { l: B('Encriptação ponta a ponta', 'End-to-end encryption'), test: t => !!t.e2ee || t.id === 'anytype' },
    share: { l: B('Partilhar no grátis', 'Sharing on free'), test: t => ['todoist', 'ticktick', 'mstodo', 'keep', 'simplenote', 'clickup', 'trello', 'asana', 'linear', 'gcal', 'notion'].includes(t.id) },
    paper: { l: B('Papel', 'Paper'), test: t => t.kind === 'paper' },
  };
  function toolsPage(rest, el) {
    const id = String(rest || '');
    if (id && T.tool(id)) return toolDetail(T.tool(id), el);
    PrShell.setArea('explorar', tx('Diretório de ferramentas', 'Tool directory'));
    const q = { role: id.startsWith('@') ? id.slice(1) : '' };
    const st = { role: T.ROLES[q.role] ? q.role : 'act', f: new Set() };
    try { const saved = JSON.parse(sessionStorage.getItem('pr-tools-f') || 'null'); if (saved && !q.role) { st.role = saved.role || st.role; (saved.f || []).forEach(x => st.f.add(x)); } } catch (e) {}
    el.innerHTML = `<div class="pr-wrap pr-page">
      ${head('explorar', tx('Diretório de ferramentas', 'Tool directory'), ['act', 'info', 'today', 'str'], tx('Escolher pelo papel, não pelo logótipo', 'Choose by role, not by logo'),
        tx('22 ferramentas com plano grátis permanente (ou grátis de todo), comparadas com os requisitos de cada papel. Sem pontuações: cada indicador diz o que é, de onde vem e quando foi verificado.', '22 tools with a permanent free plan (or entirely free), checked against each role\'s requirements. No scores: every indicator says what it is, where it comes from and when it was checked.'))}
      <div class="ex-dir-ctl">
        <div class="seg" role="tablist" aria-label="${esc(tx('Papel', 'Role'))}">${Object.keys(T.ROLES).map(r => `<button type="button" class="seg-btn" role="tab" data-role="${r}">${esc(roleName(r))}</button>`).join('')}</div>
        <div class="pr-row ex-flt">${Object.keys(FILTERS).map(k => `<button type="button" class="chip" data-f="${k}" aria-pressed="false">${esc(L(FILTERS[k].l))}</button>`).join('')}</div>
      </div>
      <p class="ex-legend">${Object.keys(T.STATES).map(s => `${stIcon(s)} ${esc(L(T.STATES[s].l))}`).join(' · ')}</p>
      <div data-dir aria-live="polite"></div>
      <aside class="ex-method"><p class="pr-kicker">${esc(tx('Como isto foi feito', 'How this was made'))}</p>
        <ul><li>${esc(tx(`Requisitos: a tabela "o que procurar em qualquer ferramenta" do documento de referência (Ações, Informação, Hoje, Estrutura). Os do Calendário são uma escolha deste site.`, `Requirements: the "what to look for in any tool" table from the reference document (Actions, Information, Today, Structure). The Calendar ones are this site's choice.`))}</li>
          <li>${esc(tx(`Planos grátis e limites lidos nas páginas oficiais em ${fmtDate(T.VERIFIED)}. Cada afirmação tem a sua ligação e data. Preços como a página os mostrava; variam por região e impostos.`, `Free plans and limits read from the official pages on ${fmtDate(T.VERIFIED)}. Every claim has its own link and date. Prices as shown on the page; they vary by region and tax.`))}</li>
          <li>${esc(tx('"Por verificar" quer dizer que não o confirmámos numa fonte oficial nesta revisão — não que não exista. Testa-o na app antes de mudares de sistema.', '"Not verified" means we did not confirm it in an official source in this review — not that it is missing. Test it in the app before switching systems.'))}</li>
          <li>${esc(tx('Ficaram de fora serviços que só têm teste gratuito. Nenhuma ferramenta pagou ou foi contactada; não há ligações de afiliado.', 'Services with only a free trial were left out. No tool paid or was contacted; there are no affiliate links.'))}</li></ul></aside></div>`;
    const dir = $('[data-dir]', el);
    const save = () => { try { sessionStorage.setItem('pr-tools-f', JSON.stringify({ role: st.role, f: [...st.f] })); } catch (e) {} };
    const draw = () => {
      $$('[data-role]', el).forEach(b => { b.setAttribute('aria-selected', b.dataset.role === st.role); b.classList.toggle('active', b.dataset.role === st.role); });
      $$('[data-f]', el).forEach(b => b.setAttribute('aria-pressed', st.f.has(b.dataset.f)));
      const R = T.ROLES[st.role];
      let list = T.TOOLS.filter(t => t.roles.includes(st.role));
      const before = list.length;
      st.f.forEach(k => { list = list.filter(FILTERS[k].test); });
      dir.innerHTML = `<p class="pr-sub ex-count">${esc(tx(`${list.length} de ${before} ferramentas para ${roleName(st.role)} · ${L(R.d)}`, `${list.length} of ${before} tools for ${roleName(st.role)} · ${L(R.d)}`))}</p>
        ${list.length ? `<div class="pr-table-wrap"><table class="ex-dir"><thead><tr><th scope="col">${esc(tx('Ferramenta', 'Tool'))}</th>${R.req.map(qq => `<th scope="col" class="${qq.must ? 'must' : 'nice'}"><span>${esc(L(qq.n))}</span><small>${esc(qq.must ? tx('tem de', 'must') : tx('bom ter', 'nice'))}</small></th>`).join('')}<th scope="col">${esc(tx('O limite que vais sentir', 'The limit you will feel'))}</th></tr></thead>
          <tbody>${list.map(t => { const r = t.req[st.role] || {};
            return `<tr><th scope="row"><a href="#explorar/ferramentas/${t.id}">${esc(nm(t))}</a>${t.ref ? `<small class="ex-ref">${esc(tx('sistema de referência', 'reference system'))}</small>` : ''}${t.kind === 'paper' ? `<small>${esc(tx('papel', 'paper'))}</small>` : ''}</th>
              ${R.req.map(qq => { const v = r[qq.id] || ['c']; return `<td class="${qq.must ? 'must' : 'nice'}" title="${esc(L(T.STATES[v[0]].l) + (v[2] ? ' — ' + L(v[2]) : ''))}">${stIcon(v[0])}${v[2] ? `<small>${esc(L(v[2]))}</small>` : ''}</td>`; }).join('')}
              <td class="ex-feel">${esc(L(t.feel))}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="empty-state"><p>${esc(tx('Nenhuma ferramenta cumpre todos os filtros para este papel.', 'No tool meets every filter for this role.'))}</p><button type="button" class="btn btn-sm" data-clear>${esc(tx('Limpar filtros', 'Clear filters'))}</button></div>`}`;
    };
    el.addEventListener('click', e => {
      const r = e.target.closest('[data-role]'); if (r) { st.role = r.dataset.role; save(); draw(); return; }
      const f = e.target.closest('[data-f]'); if (f) { st.f.has(f.dataset.f) ? st.f.delete(f.dataset.f) : st.f.add(f.dataset.f); save(); draw(); return; }
      if (e.target.closest('[data-clear]')) { st.f.clear(); save(); draw(); }
    });
    draw();
  }
  function toolDetail(t, el) {
    PrShell.setArea('explorar', nm(t));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:980px">
      ${crumbs([{ label: L(PrApp.AREAS.explorar.name), href: '#explorar' }, { label: tx('Diretório de ferramentas', 'Tool directory'), href: '#explorar/ferramentas' }, { label: nm(t) }])}
      <header class="pr-head"><p class="pr-kicker">${t.roles.map(roleTag).join(' ')}${t.ref ? ` <span class="src-tag own">${esc(tx('sistema de referência', 'reference system'))}</span>` : ''}</p><h1>${esc(nm(t))}</h1><p class="lede">${esc(L(t.fit))}</p></header>
      <div class="ex-td-g">
        <section><p class="pr-kicker">${esc(t.kind === 'paper' ? tx('Custo', 'Cost') : tx('Plano grátis', 'Free plan'))}</p>
          ${t.free.length ? `<ul class="ex-facts">${t.free.map(f => `<li><span>${esc(L(f[0]))}</span>${srcLink(f[1])}</li>`).join('')}</ul>` : `<p>${esc(tx('Não há plano: o custo é o do papel.', 'There is no plan: the cost is the paper.'))}</p>`}
          ${t.paid.length ? `<p class="pr-kicker" style="margin-top:1.2rem">${esc(tx('O que fica a pagar', 'What stays paid'))}</p><ul class="ex-facts">${t.paid.map(f => `<li><span>${esc(L(f[0]))}</span>${srcLink(f[1])}</li>`).join('')}</ul>` : ''}
          <p class="cp-warn" style="margin-top:1rem"><b>${esc(tx('O limite que vais sentir: ', 'The limit you will feel: '))}</b>${esc(L(t.feel))}</p>
          ${t.oss ? `<p class="pr-sub">${esc(tx('Licença: ', 'Licence: '))}${esc(typeof t.oss === 'object' ? L(t.oss) : t.oss)}</p>` : ''}</section>
        <section>${t.roles.map(r => { const R = T.ROLES[r], v = t.req[r] || {}; const tl = T.tally(t, r);
          return `<div class="ex-td-role"><p class="pr-kicker">${esc(tx('Como papel de ', 'As the role of '))}${esc(roleName(r))}</p>
            <p class="ex-tally">${['y', 'l', 'p', 'n', 'c'].filter(s => tl[s]).map(s => `${stIcon(s)} ${tl[s]}`).join(' ')} <span class="pr-sub">${esc(tx(`dos ${tl.total} requisitos "tem de"`, `of the ${tl.total} "must" requirements`))}</span></p>
            <ul class="ex-reqs">${R.req.map(q => { const s = v[q.id] || ['c']; return `<li>${stIcon(s[0])}<div><b>${esc(L(q.n))}</b>${q.must ? '' : ` <small>(${esc(tx('bom ter', 'nice to have'))})</small>`}${s[2] ? `<span>${esc(L(s[2]))}</span>` : ''}${s[0] !== 'c' ? srcLink(s[1]) : `<span class="ex-date">${esc(tx('testa na app', 'test it in the app'))}</span>`}</div></li>`; }).join('')}</ul></div>`; }).join('')}</section>
      </div>
      <div class="pr-row" style="margin-top:1.6rem"><a class="btn" href="#explorar/ferramentas/@${t.roles[0]}">← ${esc(tx('Diretório', 'Directory'))}</a><a class="btn btn-ghost" href="#explorar/combinar">${esc(tx('Combinar com outras', 'Combine with others'))}</a></div></div>`;
  }

  /* ════════════════ combinar ════════════════ */
  const STACK_KEY = 'pr-stack';
  const PRESETS = [
    { n: B('O sistema de referência', 'The reference system'), s: { act: 'todoist', info: 'notion', today: 'notebook', str: 'notion', cal: 'gcal' } },
    { n: B('Tudo Google', 'All Google'), s: { act: 'gtasks', info: 'keep', today: 'notebook', str: '', cal: 'gcal' } },
    { n: B('Local e privado', 'Local and private'), s: { act: 'ticktick', info: 'obsidian', today: 'bujo', str: 'anytype', cal: 'planner' } },
  ];
  function combPage(rest, el) {
    PrShell.setArea('explorar', tx('Combinar ferramentas', 'Combine tools'));
    let s = Pr.store.get(STACK_KEY) || Object.assign({}, PRESETS[0].s);
    el.innerHTML = `<div class="pr-wrap pr-page">
      ${head('explorar', tx('Combinar ferramentas', 'Combine tools'), ['act', 'info', 'today', 'str'], tx('Uma ferramenta por papel', 'One tool per role'),
        tx('O sistema é a combinação. Escolhe quem faz cada papel e vê os requisitos que ficam por cumprir, os que dependem de pagar, e onde duas ferramentas se pisam.', 'The system is the combination. Choose who plays each role and see which requirements stay unmet, which depend on paying, and where two tools overlap.'))}
      <div class="pr-row" style="margin-bottom:1rem"><span class="pr-sub">${esc(tx('Começar de:', 'Start from:'))}</span>${PRESETS.map((p, i) => `<button type="button" class="chip" data-pre="${i}">${esc(L(p.n))}</button>`).join('')}</div>
      <div class="ex-comb-g"><div class="ex-slots" data-slots></div><div class="pr-sheet ex-verdict" data-ver aria-live="polite"></div></div>
      <p class="pr-sub" style="margin-top:1rem">${esc(tx('A tua combinação fica guardada neste browser.', 'Your combination is saved in this browser.'))}</p></div>`;
    const slots = $('[data-slots]', el), ver = $('[data-ver]', el);
    const draw = () => {
      Pr.store.set(STACK_KEY, s);
      slots.innerHTML = Object.keys(T.ROLES).map(r => { const opts = T.TOOLS.filter(t => t.roles.includes(r));
        return `<label class="ex-slot r-${r}"><span class="ex-slot-h">${roleTag(r)}<small>${esc(L(T.ROLES[r].d))}</small></span>
          <select data-slot="${r}"><option value="">${esc(tx('— ninguém —', '— nobody —'))}</option>${opts.map(t => `<option value="${t.id}" ${s[r] === t.id ? 'selected' : ''}>${esc(nm(t))}</option>`).join('')}</select></label>`; }).join('');
      const gaps = [], paid = [], unk = [];
      Object.keys(T.ROLES).forEach(r => {
        const t = T.tool(s[r]);
        if (!t) { gaps.push(tx(`${roleName(r)}: ninguém faz este papel.`, `${roleName(r)}: nobody plays this role.`)); return; }
        T.ROLES[r].req.filter(q => q.must).forEach(q => { const v = (t.req[r] || {})[q.id] || ['c'];
          if (v[0] === 'n') gaps.push(`${roleName(r)} · ${nm(t)}: ${L(q.n)}`);
          if (v[0] === 'p') paid.push(`${roleName(r)} · ${nm(t)}: ${L(q.n)}`);
          if (v[0] === 'l') paid.push(`${roleName(r)} · ${nm(t)}: ${L(q.n)} — ${v[2] ? L(v[2]) : tx('limitado', 'limited')}`);
          if (v[0] === 'c') unk.push(`${roleName(r)} · ${nm(t)}: ${L(q.n)}`); });
      });
      const used = {}; Object.keys(s).forEach(r => { if (s[r]) (used[s[r]] = used[s[r]] || []).push(r); });
      const multi = Object.keys(used).filter(k => used[k].length > 1);
      const notes = [];
      multi.forEach(k => { const rs = used[k];
        if (rs.includes('act') && rs.includes('info')) notes.push(tx(`${nm(T.tool(k))} faz Ações e Informação: mantém duas caixas separadas lá dentro — uma tarefa nunca é uma nota.`, `${nm(T.tool(k))} plays Actions and Information: keep two separate inboxes inside it — a task is never a note.`));
        else notes.push(tx(`${nm(T.tool(k))} faz ${rs.map(roleName).join(' e ')}: menos apps, um só sítio para manter.`, `${nm(T.tool(k))} plays ${rs.map(roleName).join(' and ')}: fewer apps, one place to maintain.`)); });
      if (s.today && T.tool(s.today).kind !== 'paper') notes.push(tx('Hoje numa app: os requisitos são "sem notificações" e "nada para manter" — confirma que a app os cumpre.', 'Today in an app: the requirements are "no notifications" and "nothing to maintain" — check the app meets them.'));
      if (s.cal === 'ncal') notes.push(tx('O Notion Calendar precisa de uma conta Google, Outlook ou iCloud por baixo.', 'Notion Calendar needs a Google, Outlook or iCloud account underneath.'));
      if (s.str && !s.info) notes.push(tx('Estrutura sem Notas: os factos soltos vão acabar dentro dos projetos ou na cabeça.', 'Structure without Notes: loose facts will end up inside projects or in your head.'));
      const apps = new Set(Object.values(s).filter(Boolean)).size;
      const list = (arr, cls) => arr.length ? `<ul class="ex-vl ${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="pr-sub">${esc(tx('Nada.', 'None.'))}</p>`;
      ver.innerHTML = `<p class="pr-kicker">${esc(tx(`${apps} ferramenta(s) para ${Object.keys(T.ROLES).filter(r => s[r]).length} papéis`, `${apps} tool(s) for ${Object.keys(T.ROLES).filter(r => s[r]).length} roles`))}</p>
        <h3 class="ex-vh">${stIcon('n')} ${esc(tx('Requisitos "tem de" que falham', '"Must" requirements that fail'))}</h3>${list(gaps, 'n')}
        <h3 class="ex-vh">${stIcon('l')} ${esc(tx('Limitados no grátis ou só pagos', 'Limited on free or paid only'))}</h3>${list(paid, 'l')}
        ${notes.length ? `<h3 class="ex-vh">⇄ ${esc(tx('Onde se tocam', 'Where they touch'))}</h3>${list(notes, '')}` : ''}
        <details class="ex-unk"><summary>${stIcon('c')} ${esc(tx(`${unk.length} requisitos por verificar — testa-os na app`, `${unk.length} requirements not verified — test them in the app`))}</summary>${list(unk, 'c')}</details>
        <div class="pr-row" style="margin-top:1rem"><a class="btn btn-sm btn-primary" href="#aplicar/sistema">${esc(tx('Transformar num plano de arranque', 'Turn it into a start-up plan'))} →</a></div>`;
    };
    el.addEventListener('change', e => { const sl = e.target.closest('[data-slot]'); if (sl) { s[sl.dataset.slot] = sl.value; draw(); Pr.pop(ver); } });
    el.addEventListener('click', e => { const p = e.target.closest('[data-pre]'); if (p) { s = Object.assign({}, PRESETS[+p.dataset.pre].s); draw(); Pr.pop(ver); } });
    draw();
  }

  /* ════════════════ Desenhar o teu sistema ════════════════ */
  const DKEY = 'pr-design';
  const QS = [
    { id: 'life', q: B('Para que é o sistema?', 'What is the system for?'), o: [['work', B('Trabalho com várias equipas', 'Work with several teams')], ['study', B('Estudos', 'Studies')], ['life', B('Vida pessoal', 'Personal life')]] },
    { id: 'eco', q: B('Onde já vives?', 'Where do you already live?'), o: [['google', B('Google (Gmail, Calendar)', 'Google (Gmail, Calendar)')], ['ms', B('Microsoft (Outlook)', 'Microsoft (Outlook)')], ['none', B('Nenhum em especial', 'Nowhere in particular')]] },
    { id: 'priv', q: B('Privacidade', 'Privacy'), o: [['normal', B('O normal chega', 'The usual is fine')], ['local', B('Quero os dados no meu aparelho / encriptados', 'I want my data on my device / encrypted')]] },
    { id: 'share', q: B('Partilhas listas ou projetos com outras pessoas?', 'Do you share lists or projects with others?'), o: [['no', B('Não', 'No')], ['yes', B('Sim', 'Yes')]] },
    { id: 'paper', q: B('Um caderno em papel para o dia?', 'A paper notebook for the day?'), o: [['yes', B('Sim', 'Yes')], ['no', B('Prefiro tudo digital', 'I prefer all-digital')]] },
  ];
  /* candidatos por papel, por ordem de critérios explícitos (cada razão aparece) */
  function candidates(role, a) {
    const reasons = t => {
      const r = [];
      if (t.ref) r.push(['+', tx('é a do sistema de referência', 'used by the reference system')]);
      if (a.eco === 'google' && ['gtasks', 'keep', 'gcal'].includes(t.id)) r.push(['+', tx('já estás no Google', 'you are already on Google')]);
      if (a.eco === 'ms' && t.id === 'mstodo') r.push(['+', tx('integra com o Outlook', 'works with Outlook')]);
      if (a.priv === 'local') { if (['obsidian', 'anytype', 'joplin', 'standardnotes', 'logseq'].includes(t.id) || t.kind === 'paper') r.push(['+', tx('dados locais ou encriptados', 'local or encrypted data')]); else if (role === 'info' || role === 'str') r.push(['−', tx('dados na nuvem do fornecedor', "data in the vendor's cloud")]); }
      if (a.share === 'yes') { if (FILTERS.share.test(t)) r.push(['+', tx('partilha no grátis', 'sharing on free')]); else if (t.kind !== 'paper') r.push(['−', tx('partilha limitada ou paga', 'sharing limited or paid')]); }
      if (a.paper === 'yes' && role === 'today' && t.id === 'notebook') r.push(['+', tx('pediste papel', 'you asked for paper')]);
      if (a.paper === 'no' && t.kind === 'paper') r.push(['−', tx('preferes digital', 'you prefer digital')]);
      if (a.life !== 'work' && t.id === 'linear') r.push(['−', tx('feito para equipas de software', 'built for software teams')]);
      const tl = T.tally(t, role); if (tl && tl.n) r.push(['−', tx(`${tl.n} requisito(s) "tem de" falham`, `${tl.n} "must" requirement(s) fail`)]);
      return r;
    };
    let list = T.TOOLS.filter(t => t.roles.includes(role));
    if (role === 'today' && a.paper === 'no') list = list.concat(['mstodo'].map(T.tool));
    return list.map(t => { const r = reasons(t); return { t, r, k: r.filter(x => x[0] === '+').length - r.filter(x => x[0] === '−').length }; })
      .sort((x, y) => y.k - x.k || (T.tally(y.t, role) || { y: 0 }).y - (T.tally(x.t, role) || { y: 0 }).y).slice(0, 4);
  }
  function designPage(rest, el) {
    PrShell.setArea('aplicar', tx('Desenhar o teu sistema', 'Design your system'));
    let st = Pr.store.get(DKEY) || { a: {}, pick: {} };
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1080px">
      ${head('aplicar', tx('Desenhar o teu sistema', 'Design your system'), ['act', 'info', 'today', 'str'], tx('Desenhar o teu sistema', 'Design your system'),
        tx('Cinco perguntas sobre ti. Depois, para cada papel, as ferramentas que fazem sentido — com as razões à vista — e um plano de arranque para levares. Não precisas de mudar tudo no primeiro dia.', 'Five questions about you. Then, for each role, the tools that make sense — with the reasons in view — and a start-up plan to take with you. You do not need to change everything on day one.'))}
      <div class="pr-sheet ap-card ds-q" data-q></div><div data-out></div>
      <p class="pr-sub" style="margin-top:1rem">${esc(tx('As respostas ficam só neste browser. Nada é enviado.', 'Answers stay in this browser only. Nothing is sent.'))}</p></div>`;
    const qh = $('[data-q]', el), out = $('[data-out]', el);
    const save = () => Pr.store.set(DKEY, st);
    const drawQ = () => {
      qh.innerHTML = `<ol class="ds-qs">${QS.map(q => `<li><p>${esc(L(q.q))}</p><div class="seg" role="group">${q.o.map(([v, l]) => `<button type="button" class="seg-btn ${st.a[q.id] === v ? 'active' : ''}" data-a="${q.id}" data-v="${v}" aria-pressed="${st.a[q.id] === v}" aria-selected="${st.a[q.id] === v}">${esc(L(l))}</button>`).join('')}</div></li>`).join('')}</ol>`;
    };
    const ready = () => QS.every(q => st.a[q.id]);
    const drawOut = () => {
      if (!ready()) { out.innerHTML = `<p class="pr-sub" style="margin-top:1rem">${esc(tx(`Faltam ${QS.filter(q => !st.a[q.id]).length} respostas.`, `${QS.filter(q => !st.a[q.id]).length} answers to go.`))}</p>`; return; }
      const roles = ['act', 'info', 'today', 'str', 'cal'];
      roles.forEach(r => { const c = candidates(r, st.a); if (!st.pick[r] || !c.some(x => x.t.id === st.pick[r])) st.pick[r] = c[0] ? c[0].t.id : ''; });
      save();
      out.innerHTML = `<section class="pr-section"><p class="pr-kicker">${esc(tx('Uma ferramenta por papel', 'One tool per role'))}</p>
        <div class="ds-roles">${roles.map(r => `<div class="ds-role"><p class="ds-rh">${roleTag(r)}</p>${candidates(r, st.a).map(c => `<label class="ds-cand ${st.pick[r] === c.t.id ? 'on' : ''}"><input type="radio" name="ds-${r}" value="${c.t.id}" data-pick="${r}" ${st.pick[r] === c.t.id ? 'checked' : ''}>
          <span><b>${esc(nm(c.t))}</b> <a href="#explorar/ferramentas/${c.t.id}" class="ds-more" aria-label="${esc(tx('Detalhe de ', 'Details of ') + nm(c.t))}">${esc(tx('detalhe', 'details'))}</a>
          <span class="ds-why">${c.r.map(x => `<i class="${x[0] === '+' ? 'p' : 'm'}">${x[0]} ${esc(x[1])}</i>`).join('') || `<i>${esc(tx('sem razões a favor ou contra', 'no reasons for or against'))}</i>`}</span></span></label>`).join('')}</div>`).join('')}</div>
        <p class="pr-sub">${esc(tx('Ordenadas pelas razões a favor menos as contra; em empate, pelos requisitos "tem de" confirmados. Não é uma nota.', 'Ordered by reasons for minus reasons against; on a tie, by confirmed "must" requirements. Not a score.'))}</p></section>
        <section class="pr-section"><p class="pr-kicker">${esc(tx('O teu plano de arranque', 'Your start-up plan'))} ${Pr.srcTag('own')}</p>
          <div class="ds-plan">${planHtml(st)}</div>
          <div class="pr-row" style="margin-top:1rem"><button type="button" class="btn btn-primary" data-copy>${esc(tx('Copiar em Markdown', 'Copy as Markdown'))}</button><button type="button" class="btn" data-dl>${esc(tx('Descarregar .md', 'Download .md'))}</button><button type="button" class="btn btn-ghost" data-reset>${esc(tx('Recomeçar', 'Start over'))}</button></div></section>`;
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (b) { st.a[b.dataset.a] = b.dataset.v; save(); drawQ(); drawOut(); return; }
      if (e.target.closest('[data-copy]')) { const md = planMd(st); (navigator.clipboard ? navigator.clipboard.writeText(md) : Promise.reject()).then(() => Pr.toast(tx('Copiado.', 'Copied.')), () => Pr.toast(tx('Não foi possível copiar — usa "Descarregar".', 'Could not copy — use "Download".'))); return; }
      if (e.target.closest('[data-dl]')) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([planMd(st)], { type: 'text/markdown' })); a.download = tx('o-meu-sistema.md', 'my-system.md'); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return; }
      if (e.target.closest('[data-reset]')) { st = { a: {}, pick: {} }; save(); drawQ(); drawOut(); }
    });
    el.addEventListener('change', e => { const r = e.target.closest('[data-pick]'); if (r) { st.pick[r.dataset.pick] = r.value; save(); drawOut(); } });
    drawQ(); drawOut();
  }
  function planData(st) {
    const p = st.pick, n = id => (T.tool(id) ? nm(T.tool(id)) : tx('(por escolher)', '(to choose)'));
    const hub = st.a.life === 'work' ? tx('Equipas', 'Teams') : tx('Áreas', 'Areas');
    const boxes = st.a.life === 'work' ? tx('#Trabalho-Projetos, #Trabalho-Geral, #Pessoal', '#Work-Projects, #Work-General, #Personal') : tx('#Projetos, #Geral, #Pessoal', '#Projects, #General, #Personal');
    return [
      { h: tx('Semana 1', 'Week 1'), items: [
        tx(`Lista de tarefas em ${n(p.act)}: três contentores (${boxes}) e três filtros guardados — Hoje, Próximos 7 dias, Seguimentos.`, `Task list in ${n(p.act)}: three containers (${boxes}) and three saved filters — Today, Due in 7 days, Follow-ups.`),
        tx(`Caixa de Notas em ${n(p.info)}: uma linha por nota, com um campo de ${hub.toLowerCase()} que fica vazio até à triagem.`, `Notes inbox in ${n(p.info)}: one line per note, with a ${hub.toLowerCase()} field left empty until triage.`),
        tx(`Hoje — ${n(p.today)}: três coisas de manhã, ✓ → ✕ à noite.`, `Today — ${n(p.today)}: three things each morning, ✓ → ✕ at night.`),
        tx(`Revisão semanal marcada em ${n(p.cal)}: 20 minutos, sempre à mesma hora, com a agenda de sete passos.`, `Weekly review booked in ${n(p.cal)}: 20 minutes, same time every week, with the seven-step agenda.`)] },
      { h: tx('Semana 3', 'Week 3'), items: [
        tx(`Em ${n(p.str)}: uma base Projetos (Estado Now / Next / Later / On Hold / Done) e uma base ${hub}.`, `In ${n(p.str)}: a Projects database (Status Now / Next / Later / On Hold / Done) and a ${hub} database.`),
        tx(`Ligar as Notas à base ${hub} com uma relação de duas vias.`, `Link Notes to the ${hub} database with a two-way relation.`),
        tx('O nome de cada projeto no fim de cada tarefa e nota dele.', "Each project's name at the end of each of its tasks and notes.")] },
      { h: tx('Depois', 'Later'), items: [
        tx(`Pessoas e Reuniões${st.a.life === 'work' ? ', e 1:1 se geres pessoas' : ''}.`, `People and Meetings${st.a.life === 'work' ? ', and 1:1s if you manage people' : ''}.`),
        tx('Bases opcionais (Decisões, Riscos…) só quando a regra de três disser: à terceira nota do mesmo tipo.', 'Optional databases (Decisions, Risks…) only when the rule of three says so: at the third note of the same kind.')] },
    ];
  }
  function planHtml(st) { return planData(st).map(s => `<div class="ds-wk"><h3>${esc(s.h)}</h3><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join(''); }
  function planMd(st) {
    const p = st.pick;
    return `# ${tx('O meu sistema', 'My system')}\n\n` +
      ['act', 'info', 'today', 'str', 'cal'].map(r => `- **${roleName(r)}:** ${T.tool(p[r]) ? nm(T.tool(p[r])) : '—'}`).join('\n') + '\n\n' +
      planData(st).map(s => `## ${s.h}\n\n${s.items.map(i => `- [ ] ${i}`).join('\n')}`).join('\n\n') +
      `\n\n---\n${tx('Feito em DCOP7 Productivity. Limites dos planos grátis verificados em ', 'Made with DCOP7 Productivity. Free-plan limits checked on ')}${T.VERIFIED}.\n`;
  }

  Pr.route('explorar/mapa', mapPage);
  Pr.route('explorar/relacoes', relPage);
  Pr.route('explorar/ferramentas', toolsPage);
  Pr.route('explorar/combinar', combPage);
  Pr.route('aplicar/sistema', designPage);
  return { candidates };
})();
