/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — exercícios de Aplicar + laboratório da escada
   ──────────────────────────────────────────────────────────────────
     aplicar/triagem          12 coisas → o sítio certo (autónomo)
     aplicar/para             arrumar por acionabilidade + o tempo passa
     aplicar/projeto          construir um projeto no mundo (src 'proj')
     experimentar/pagina-ou-base  quatro perguntas + escada (src 'lad')
   O "Desenhar o teu sistema" vive em pr-design (fim deste ficheiro).
   ══════════════════════════════════════════════════════════════════ */
const PrApply = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, crumbs } = Pr;
  const W = PrWorld;
  const B = (pt, en) => ({ pt, en });

  const head = (area, crumb, kinds, h1, lede) => `${crumbs([{ label: L(PrApp.AREAS[area].name), href: '#' + area }, { label: crumb }])}
    <header class="pr-head"><p class="pr-kicker">${kinds.map(Pr.kindTag).join(' ')}</p><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</header>`;

  /* ════════════════ 1 · Para onde vai isto? ════════════════ */
  const PLACES = {
    task: { l: B('Lista de tarefas', 'Task list'), k: 'act' },
    note: { l: B('Notas', 'Notes'), k: 'info' },
    meeting: { l: B('Página da reunião', 'Meeting page'), k: 'info' },
    today: { l: B('Big 3 de hoje', "Today's Big 3"), k: 'today' },
    cal: { l: B('Calendário', 'Calendar'), k: null },
    project: { l: B('Nova linha em Projetos', 'New Projects row'), k: 'str' },
  };
  const TRI = [
    { s: B('A clínica liga: consulta marcada para terça às 15h.', 'The clinic calls: appointment booked for Tuesday at 3pm.'), a: 'cal',
      why: B('Tem hora marcada e acontece quer queiras quer não: calendário. Só nasce uma tarefa se houver alguma coisa para preparar antes.', 'It has a fixed time and happens either way: calendar. A task only appears if there is something to prepare beforehand.') },
    { s: B('Prometes enviar ao Rui os diapositivos até amanhã.', 'You promise to send Rui the slides by tomorrow.'), a: 'task',
      why: B('Um compromisso com prazo: "Enviar os diapositivos ao Rui", com a data de amanhã.', 'A commitment with a deadline: "Send the slides to Rui", dated tomorrow.') },
    { s: B('Na reunião semanal decide-se adiar o congelamento uma semana.', 'At the weekly sync it is decided to push the freeze back a week.'), a: 'meeting',
      why: B('Dito dentro de uma reunião marcada: entrada datada na página dessa série de reuniões.', 'Said inside a scheduled meeting: a dated entry on that meeting series page.') },
    { s: B('Ouves que os portáteis novos da empresa chegam com 32 GB.', "You hear the company's new laptops come with 32 GB."), a: 'note',
      why: B('Um facto ouvido de passagem: uma linha nas Notas, que se encontra depois pela palavra "portáteis".', 'A fact heard in passing: one line in Notes, found later by the word "laptops".') },
    { s: B('Hoje tem mesmo de sair a resposta à auditoria (já está na lista).', 'The audit reply really has to go out today (it is already on the list).'), a: 'today',
      why: B('Já existe como tarefa. O que é novo é a escolha de foco: um dos Big 3.', 'It already exists as a task. What is new is the focus choice: one of the Big 3.') },
    { s: B('Uma colega propõe organizarem juntas um workshop interno em março.', 'A colleague suggests you run an internal workshop together in March.'), a: 'project',
      why: B('Tem um resultado, uma data de fim e várias sessões de trabalho: um projeto (provavelmente em Later até se decidir).', 'It has an outcome, an end date and several work sessions: a project (probably Later until it is agreed).') },
    { s: B('Precisas de duas horas sem interrupções para escrever o plano trimestral (a tarefa já existe).', 'You need two uninterrupted hours to write the quarterly plan (the task already exists).'), a: 'cal',
      why: B('O que falta não é lembrar — é tempo protegido. Um bloco de foco no calendário (o empréstimo leve do time blocking).', 'What is missing is not a reminder — it is protected time. A focus block in the calendar (the light borrow from time blocking).') },
    { s: B('A Ana ficou de enviar os números ontem e não enviou.', 'Ana was meant to send the numbers yesterday and did not.'), a: 'task',
      why: B('Esperar é uma ação: "Insistir com a Ana pelos números", datada para quando vais voltar a perguntar.', 'Waiting is an action: "Chase Ana for the numbers", dated for when you will ask again.') },
    { s: B('Lês um artigo muito bom sobre revisões pós-incidente.', 'You read a great article on post-incident reviews.'), a: 'note',
      why: B('Referência para encontrar depois: uma linha nas Notas com o link. Se um dia houver muitas, viram uma página de Recursos.', 'Reference to find later: one line in Notes with the link. If there are ever many, they become a Resources page.') },
    { s: B('Lembras-te de que gostavas de um dia aprender piano.', 'You remember you would like to learn the piano one day.'), a: 'note',
      why: B('"Algum dia / Talvez": não é um compromisso. Uma nota com a etiqueta "idea", revista por trimestre.', '"Someday / Maybe": not a commitment. A note tagged "idea", reviewed quarterly.') },
    { s: B('No 1:1, a Elena diz que quer liderar o próximo projeto.', 'In the 1:1, Elena says she wants to lead the next project.'), a: 'meeting',
      why: B('Foi dito num 1:1: vai para a página de 1:1 da Elena, no bloco "Próximo". É lá que o vais ler antes da próxima conversa.', "It was said in a 1:1: it goes on Elena's 1:1 page, in the \"Next\" block. That is where you will read it before the next talk.") },
    { s: B('Decides que a mudança de casa é mesmo em fevereiro: contactos, caixas, contratos.', 'You decide the house move really is in February: contacts, boxes, contracts.'), a: 'project',
      why: B('Muitas ações, um fim: uma linha em Projetos. Na lista de tarefas entra só a PRÓXIMA ação, com o nome do projeto no fim.', 'Many actions, one end: a Projects row. Only the NEXT action goes on the task list, with the project name at the end.') },
  ];
  function triPage(rest, el) {
    PrShell.setArea('aplicar', tx('Para onde vai isto?', 'Where does this go?'));
    const st = { i: 0, ans: [], order: TRI.map((_, i) => i) };
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:920px">
      ${head('aplicar', tx('Para onde vai isto?', 'Where does this go?'), ['act', 'info', 'today', 'str'], tx('Para onde vai isto?', 'Where does this go?'),
        tx('Doze coisas que te chamam a atenção numa semana normal. Para cada uma, escolhe o sítio. O que interessa é o porquê — está sempre a seguir.', 'Twelve things that grab your attention in a normal week. Pick the place for each. What matters is the why — it always follows.'))}
      <div class="pr-sheet ap-card" data-tri aria-live="polite"></div>
      <p class="pr-sub" style="margin-top:.8rem">${esc(tx('Exercício autónomo: não mexe no mundo de exemplo.', 'Stand-alone exercise: it does not touch the sample world.'))}</p></div>`;
    const host = $('[data-tri]', el);
    const placeBtns = (cur, pick) => `<div class="ap-places">${Object.keys(PLACES).map(k => { const P = PLACES[k];
      const cls = pick == null ? '' : k === cur.a ? 'right' : k === pick ? 'wrong' : '';
      return `<button type="button" class="ap-place ${P.k ? Pr.KINDS[P.k].cls : 'k-none'} ${cls}" data-pl="${k}" ${pick != null ? 'disabled' : ''}><b>${esc(L(P.l))}</b>${P.k ? `<small>${esc(L(Pr.KINDS[P.k].name))}</small>` : `<small>${esc(tx('hora marcada', 'fixed time'))}</small>`}</button>`; }).join('')}</div>`;
    const draw = () => {
      if (st.i >= TRI.length) return end();
      const cur = TRI[st.order[st.i]], pick = st.ans[st.i];
      host.innerHTML = `<div class="ap-prog"><span class="pr-mono">${st.i + 1} / ${TRI.length}</span><div class="ap-dots">${TRI.map((_, j) => `<i class="${j < st.i ? (TRI[st.order[j]].a === st.ans[j] ? 'ok' : 'no') : j === st.i ? 'on' : ''}"></i>`).join('')}</div></div>
        <p class="ap-situ">${esc(L(cur.s))}</p>${placeBtns(cur, pick)}
        ${pick != null ? `<p class="wk-fb ${pick === cur.a ? 'ok' : 'no'}"><b>${esc(pick === cur.a ? tx('Certo. ', 'Right. ') : tx('É: ', 'It is: ') + L(PLACES[cur.a].l) + '. ')}</b>${esc(L(cur.why))}</p>
          <div class="pr-row" style="margin-top:1rem"><button type="button" class="btn btn-primary" data-nx>${esc(st.i === TRI.length - 1 ? tx('Ver o resultado', 'See the result') : tx('Seguinte', 'Next'))} →</button></div>` : ''}`;
      if (pick != null) $('[data-nx]', host).focus();
    };
    const end = () => {
      const ok = st.ans.filter((a, j) => a === TRI[st.order[j]].a).length;
      const miss = {}; st.ans.forEach((a, j) => { const r = TRI[st.order[j]].a; if (a !== r) (miss[r] = miss[r] || []).push(a); });
      const tips = {
        cal: B('O calendário é só para o que tem hora — consultas e blocos de foco. Prazos são datas de tarefas.', 'The calendar is only for things with a time — appointments and focus blocks. Deadlines are task dates.'),
        task: B('Se há alguma coisa para TU fazeres (incluindo voltar a perguntar), é uma tarefa.', 'If there is something for YOU to do (including asking again), it is a task.'),
        meeting: B('O que se diz numa reunião marcada vai para a página dessa reunião, não para a caixa de Notas.', 'What is said in a scheduled meeting goes on that meeting page, not into the Notes inbox.'),
        note: B('Factos, referências e ideias sem compromisso são Notas — uma linha cada.', 'Facts, references and uncommitted ideas are Notes — one line each.'),
        today: B('Os Big 3 escolhem-se de entre o que JÁ está na lista; nunca são um sítio de captura.', 'The Big 3 are picked from what is ALREADY on the list; never a capture point.'),
        project: B('Mais de uma ação e um fim à vista = um projeto. Na lista só entra a próxima ação.', 'More than one action and an end in sight = a project. Only the next action goes on the list.'),
      };
      host.innerHTML = `<p class="pr-kicker">${esc(tx('Resultado', 'Result'))}</p><p class="ap-score"><b>${ok}</b> / ${TRI.length}</p>
        ${Object.keys(miss).length ? `<p class="pr-sub">${esc(tx('Onde vale a pena voltar:', 'Worth another look:'))}</p><ul class="ap-tips">${Object.keys(miss).map(k => `<li><b>${esc(L(PLACES[k].l))}</b> — ${esc(L(tips[k]))}</li>`).join('')}</ul>`
          : `<p>${esc(tx('Tudo certo. O modelo está aí — agora experimenta-o com o mundo a mexer.', 'All right. The model is there — now try it with the world moving.'))}</p>`}
        <div class="pr-row" style="margin-top:1rem"><button type="button" class="btn" data-again>${esc(tx('Outra vez, noutra ordem', 'Again, in another order'))}</button><a class="btn btn-primary" href="#aplicar/semana">${esc(tx('Uma semana no sistema', 'A week in the system'))} →</a><a class="btn btn-ghost" href="#aprender/quatro">${esc(tx('Reler o modelo', 'Reread the model'))}</a></div>`;
    };
    host.onclick = e => {
      const b = e.target.closest('[data-pl]');
      if (b && !b.disabled) { st.ans[st.i] = b.dataset.pl; draw(); if (st.ans[st.i] === TRI[st.order[st.i]].a) Pr.pop($('.wk-fb', host)); return; }
      if (e.target.closest('[data-nx]')) { st.i++; draw(); return; }
      if (e.target.closest('[data-again]')) { st.i = 0; st.ans = []; st.order.sort(() => Math.random() - .5); draw(); }
    };
    draw();
  }

  /* ════════════════ 2 · PARA na prática ════════════════ */
  const PCAT = {
    p: { l: B('Projetos', 'Projects'), d: B('com fim', 'has an end') }, a: { l: B('Áreas', 'Areas'), d: B('contínuo', 'ongoing') },
    r: { l: B('Recursos', 'Resources'), d: B('referência', 'reference') }, x: { l: B('Arquivo', 'Archive'), d: B('inativo', 'inactive') },
  };
  const PITEMS = [
    { id: 1, t: B('Migrar a base de dados até dezembro', 'Migrate the database by December'), a: 'p', why: B('Um resultado e uma data.', 'An outcome and a date.'),
      later: { t: B('Migração da BD: terminada em dezembro', 'DB migration: finished in December'), a: 'x', why: B('Acabou: Estado = Done. Na base Projetos, "arquivar" é um estado — a linha fica.', 'It is over: Status = Done. In the Projects database, "archive" is a status — the row stays.') } },
    { id: 2, t: B('Saúde e exercício', 'Health and exercise'), a: 'a', why: B('Uma responsabilidade que nunca acaba.', 'A responsibility that never ends.') },
    { id: 3, t: B('Artigos sobre fotografia de paisagem', 'Articles on landscape photography'), a: 'r', why: B('Interesse, sem compromisso.', 'An interest, no commitment.'),
      later: { t: B('Fotografia de paisagem: marcaste uma viagem aos Açores em maio para fotografar', 'Landscape photography: you booked a photo trip to the Azores in May'), a: 'p', why: B('O interesse ganhou um resultado e uma data: passa a projeto. Os artigos continuam a ser recurso dele.', 'The interest gained an outcome and a date: it becomes a project. The articles remain its resource.') } },
    { id: 4, t: B('Exame de Estatística (15 jan)', 'Statistics exam (15 Jan)'), a: 'p', why: B('Tem dia marcado: projeto.', 'It has a date: project.'),
      later: { t: B('Exame de Estatística: feito, nota lançada', 'Statistics exam: done, grade published'), a: 'x', why: B('Feito. Fora de vista, não apagado.', 'Done. Out of sight, not deleted.') } },
    { id: 5, t: B('Liderar a equipa Atlas', 'Leading team Atlas'), a: 'a', why: B('Enquanto lideras a equipa, não há fim: área.', 'While you lead the team there is no end: area.'),
      later: { t: B('Equipa Atlas: fundiu-se com a Cobalt numa equipa nova', 'Team Atlas: merged with Cobalt into a new team'), a: 'x', why: B('A área deixou de existir. A página dela vai para o Arquivo; a equipa nova é uma linha nova na base central.', 'The area no longer exists. Its page goes to the Archive; the new team is a new row in the hub database.') } },
    { id: 6, t: B('Runbook de failover', 'Failover runbook'), a: 'r', why: B('Referência que se consulta. (Se és tu o dono do serviço, também se defende como Área.)', 'Reference you consult. (If you own the service, it can also be argued as an Area.)'), alt: 'a' },
    { id: 7, t: B('Site pessoal antigo, desligado em 2025', 'Old personal site, shut down in 2025'), a: 'x', why: B('Inativo: arquivo.', 'Inactive: archive.') },
    { id: 8, t: B('Finanças pessoais', 'Personal finances'), a: 'a', why: B('Contínuo: área. O "IRS deste ano" é que é um projeto.', 'Ongoing: area. "This year\'s tax return" is the project.') },
    { id: 9, t: B('Festa dos 40 da Marta (sábado 12)', "Marta's 40th party (Saturday the 12th)"), a: 'p', why: B('Um evento com data e várias ações.', 'An event with a date and several actions.') },
    { id: 10, t: B('Receitas que quero experimentar', 'Recipes I want to try'), a: 'r', why: B('Interesse: recurso. Sem fim e sem responsabilidade.', 'Interest: resource. No end, no responsibility.') },
  ];
  function paraPage(rest, el) {
    PrShell.setArea('aplicar', tx('PARA na prática', 'PARA in practice'));
    const st = { phase: 0, ans: {}, later: {} };
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1060px">
      ${head('aplicar', tx('PARA na prática', 'PARA in practice'), ['str'], tx('Arrumar pelo que vais fazer, não pelo assunto', 'File by what you will do, not by topic'),
        tx('PARA (Tiago Forte) arruma tudo em quatro categorias por grau de acionabilidade. Arruma dez coisas — depois deixa passar três meses e vê o que muda de categoria.', 'PARA (Tiago Forte) files everything into four categories by how actionable it is. Sort ten things — then let three months go by and see what changes category.'))}
      <div data-para></div>
      <section class="pr-section ap-map"><p class="pr-kicker">${esc(tx('E neste sistema?', 'And in this system?'))} ${Pr.srcTag('own')}</p>
        <div class="ap-map-g">${[
          ['p', B('Linhas na base Projetos, com Estado Now / Next / Later.', 'Rows in the Projects database, with Status Now / Next / Later.'), '#experimentar/notion/projects/board'],
          ['a', B('Linhas na base central (Equipas ou Áreas) e as séries de reuniões ligadas a elas.', 'Rows in the hub database (Teams or Areas) and the meeting series linked to them.'), '#experimentar/notion/teams/all'],
          ['r', B('Páginas soltas na secção Recursos da barra lateral — sem base de dados até haver muitas.', 'Loose pages in the Resources section of the sidebar — no database until there are many.'), '#experimentar/notion'],
          ['x', B('Não é um sítio: é um estado. Estado = Done nos projetos, "Arquivada" nas notas. As vistas escondem; nada se move.', 'Not a place: a state. Status = Done on projects, "Archived" on notes. Views hide them; nothing moves.'), '#experimentar/notion/projects/done'],
        ].map(([k, d, h]) => `<a class="ap-map-c p-${k}" href="${h}"><b>${esc(L(PCAT[k].l))}</b><span>${esc(L(d))}</span></a>`).join('')}</div></section>
      <p class="pr-sub" style="margin-top:1rem">${esc(tx('Exercício autónomo: não mexe no mundo de exemplo.', 'Stand-alone exercise: it does not touch the sample world.'))}</p></div>`;
    const host = $('[data-para]', el);
    const itemsNow = () => PITEMS.map(it => st.phase === 2 && it.later ? Object.assign({ id: it.id, changed: true }, it.later) : it);
    const draw = () => {
      const items = itemsNow();
      const pending = items.filter(it => (st.phase === 2 && it.changed ? st.later[it.id] : st.ans[it.id]) == null);
      const ansOf = it => st.phase === 2 && it.changed ? st.later[it.id] : st.ans[it.id];
      host.innerHTML = `<div class="ap-para">
        ${st.phase === 2 ? `<p class="ap-time">⟳ ${esc(tx('Três meses depois. As linhas marcadas mudaram — arruma-as outra vez.', 'Three months later. The highlighted rows changed — file them again.'))}</p>` : ''}
        <ol class="ap-para-l">${items.map(it => { const a = ansOf(it), ok = a != null && (a === it.a || a === it.alt), locked = a != null;
          return `<li class="${it.changed ? 'chg' : ''} ${locked ? (ok ? 'ok' : 'no') : ''}"><p>${esc(L(it.t))}</p>
            <div class="ap-para-b" role="group">${Object.keys(PCAT).map(k => `<button type="button" class="p-${k} ${a === k ? 'on' : ''} ${locked && k === it.a && a !== k ? 'right' : ''}" data-it="${it.id}" data-k="${k}" ${locked ? 'disabled' : ''} aria-pressed="${a === k}">${esc(L(PCAT[k].l))}</button>`).join('')}</div>
            ${locked ? `<p class="ap-why">${ok ? '' : `<b>${esc(L(PCAT[it.a].l))}.</b> `}${esc(L(it.why))}</p>` : ''}</li>`; }).join('')}</ol>
        <div class="pr-row" style="margin-top:1rem">${st.phase === 0 && !pending.length ? `<button type="button" class="btn btn-primary" data-time>${esc(tx('Deixar passar três meses', 'Let three months go by'))} →</button>`
          : st.phase === 2 && !pending.length ? `<p class="wk-fb ok">${esc(tx('As categorias mudam porque a tua relação com as coisas muda. Por isso o PARA arquiva por estado e a revisão semanal é o momento de mudar Now/Next/Later/Done — não um dia de "arrumações".', 'Categories change because your relationship with things changes. That is why PARA archives by state and the weekly review is when Now/Next/Later/Done change — not a "tidy-up" day.'))}</p>
            <button type="button" class="btn" data-again>${esc(tx('Recomeçar', 'Start again'))}</button>`
          : `<span class="pr-sub">${esc(tx(`Faltam ${pending.length}.`, `${pending.length} to go.`))}</span>`}</div></div>`;
    };
    host.onclick = e => {
      const b = e.target.closest('[data-it]');
      if (b && !b.disabled) { const id = +b.dataset.it; if (st.phase === 2 && PITEMS.find(x => x.id === id).later) st.later[id] = b.dataset.k; else st.ans[id] = b.dataset.k; draw(); return; }
      if (e.target.closest('[data-time]')) {
        st.phase = 2; draw();
        if (Pr.motionOk()) anime({ targets: $$('.ap-para-l li.chg', host), backgroundColor: ['rgba(233,178,31,.35)', 'rgba(233,178,31,0)'], duration: 1400, easing: 'easeOutQuad', delay: anime.stagger(90) });
        return;
      }
      if (e.target.closest('[data-again]')) { st.phase = 0; st.ans = {}; st.later = {}; draw(); }
    };
    draw();
  }

  /* ════════════════ 3 · Construir um projeto ════════════════ */
  const PSUG = {
    work: [
      { name: B('Plano de piquete da Beacon', 'Beacon on-call plan'), team: 'beacon', act: B('Rascunhar a escala de piquete de janeiro', "Draft January's on-call rota"), note: B('Beacon: o piquete atual tem 3 pessoas e quer passar a 5', 'Beacon: on-call currently has 3 people and wants to go to 5') },
      { name: B('Painel de custos por equipa', 'Cost dashboard per team'), team: 'org', act: B('Pedir à finança a exportação mensal de custos', 'Ask finance for the monthly cost export'), note: B('Toda a organização: a fatura da cloud vem por conta, não por equipa', 'Org-wide: the cloud bill comes per account, not per team') },
    ],
    study: [
      { name: B('Candidatura Erasmus', 'Erasmus application'), team: 'est', act: B('Pedir ao gabinete a lista de universidades parceiras', 'Ask the office for the list of partner universities'), note: B('Estudos: o prazo da candidatura é 31 de janeiro', 'Studies: the application deadline is 31 January') },
      { name: B('Viagem a Roma na Páscoa', 'Easter trip to Rome'), team: 'fin', act: B('Comparar voos para 28 de março', 'Compare flights for 28 March'), note: B('Finanças: orçamento máximo para a viagem: 400 €', 'Money: maximum trip budget: €400') },
    ],
  };
  const pmark = () => W.state().marks.proj || null;
  function projPage(rest, el) {
    PrShell.setArea('aplicar', tx('Construir um projeto', 'Build a project'));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1000px">
      ${head('aplicar', tx('Construir um projeto', 'Build a project'), ['str', 'act', 'info'], tx('Um projeto, de ponta a ponta', 'One project, end to end'),
        tx('Cinco passos no mundo de exemplo: a linha na base Projetos, o objetivo, a próxima ação, uma reunião e uma nota. No fim, uma pesquisa pelo nome junta tudo — sem pastas.', 'Five steps in the sample world: the Projects row, the objective, the next action, a meeting and a note. At the end, one name search brings it all together — no folders.'))}
      ${PrApp.worldBar('proj')}<div data-proj></div>${Pr.localNote()}</div>`;
    drawProj($('[data-proj]', el));
  }
  function drawProj(host) {
    const m = pmark(), step = m ? m.step : 0, sug = PSUG[W.scenario()];
    const p = m && W.rec('projects', m.pid);
    const name = p ? W.title('projects', p) : '';
    const hubRecs = W.recs('teams');
    const STEPS = [tx('A linha', 'The row'), tx('O objetivo', 'The objective'), tx('A próxima ação', 'The next action'), tx('Uma reunião', 'A meeting'), tx('Uma nota', 'A note'), tx('Encontrar tudo', 'Find it all')];
    const rail = `<ol class="wk-days ap-rail">${STEPS.map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><b>${i + 1}</b><span>${esc(s)}</span></li>`).join('')}</ol>`;
    let body = '';
    if (step === 0) {
      body = `<h2 class="pr-h3">${esc(tx('Dá-lhe um nome de resultado, não de tarefa', 'Give it an outcome name, not a task name'))}</h2>
        <p class="pr-sub">${esc(tx('Um projeto é um substantivo ("Plano de piquete"), não um verbo ("Fazer o plano"). O nome vai aparecer no fim de cada tarefa e nota dele — escolhe-o curto e único.', 'A project is a noun ("On-call plan"), not a verb ("Make the plan"). The name will appear at the end of each of its tasks and notes — keep it short and unique.'))}</p>
        <div class="pr-row" style="margin:.7rem 0">${sug.map((s, i) => `<button type="button" class="chip" data-sug="${i}">${esc(L(s.name))}</button>`).join('')}</div>
        <div class="ap-form"><label>${esc(tx('Nome', 'Name'))}<input type="text" data-pn maxlength="60"></label>
          <label>${esc(L(W.hub().prop))}<select data-pt>${hubRecs.map(r => `<option value="${r.id}">${esc(W.title('teams', r))}</option>`).join('')}</select></label>
          <label>${esc(tx('Estado', 'Status'))}<select data-ps><option value="next">Next</option><option value="now">Now</option><option value="later">Later</option></select></label></div>
        <p class="cp-warn" data-pwarn hidden></p>
        <button type="button" class="btn btn-primary" data-p0>${esc(tx('Criar a linha (com o modelo de projeto)', 'Create the row (with the project template)'))}</button>`;
    } else if (step === 1) {
      body = `<h2 class="pr-h3">${esc(tx('O objetivo, numa ou duas frases', 'The objective, in one or two sentences'))}</h2>
        <p class="pr-sub">${esc(tx('O modelo de página já trouxe as secções. Preenche só a primeira: o que é verdade quando isto estiver feito?', 'The page template already brought the sections. Fill only the first: what is true when this is done?'))}</p>
        <textarea class="ap-ta" data-obj maxlength="240" rows="3" placeholder="${esc(tx('Ex.: A Beacon tem uma escala de piquete de 5 pessoas, publicada e aceite por todos.', 'E.g. Beacon has a 5-person on-call rota, published and agreed by everyone.'))}"></textarea>
        <div class="pr-row"><button type="button" class="btn btn-primary" data-p1>${esc(tx('Guardar o objetivo', 'Save the objective'))}</button><button type="button" class="btn btn-ghost" data-skip>${esc(tx('Saltar', 'Skip'))}</button></div>`;
    } else if (step === 2) {
      const s = sug.find(x => L(x.name) === name);
      body = `<h2 class="pr-h3">${esc(tx('Só a PRÓXIMA ação vai para a lista', 'Only the NEXT action goes on the list'))}</h2>
        <p class="pr-sub">${esc(tx('O plano completo fica na página do projeto, em texto. Na lista entra uma tarefa: verbo primeiro, o nome do projeto no fim (acrescentado aqui automaticamente).', 'The full plan stays on the project page, as text. One task goes on the list: verb first, the project name at the end (added here automatically).'))}</p>
        <div class="ap-act"><input type="text" data-act maxlength="100" value="${esc(s ? L(s.act) : '')}" placeholder="${esc(tx('Verbo + o quê', 'Verb + what'))}"><code data-actpv></code></div>
        <p class="cp-warn" data-awarn hidden></p>
        <button type="button" class="btn btn-primary" data-p2>${esc(tx('Pôr na lista de tarefas', 'Put it on the task list'))}</button>`;
    } else if (step === 3) {
      body = `<h2 class="pr-h3">${esc(tx('Uma página de reunião ligada ao projeto', 'A meeting page linked to the project'))}</h2>
        <p class="pr-sub">${esc(tx('Uma reunião de arranque, pontual. A relação Projeto liga-a nos dois sentidos: a página do projeto passa a listá-la sozinha.', 'A one-off kick-off meeting. The Project relation links it both ways: the project page lists it on its own.'))}</p>
        <div class="ap-form"><label>${esc(tx('Nome', 'Name'))}<input type="text" data-mn maxlength="80" value="${esc(tx('Arranque: ', 'Kick-off: ') + name)}"></label>
          <label>${esc(tx('O que se combinou', 'What was agreed'))}<input type="text" data-mb maxlength="140" value="${esc(tx('Objetivo aceite; próxima revisão daqui a duas semanas.', 'Objective agreed; next check-in in two weeks.'))}"></label></div>
        <button type="button" class="btn btn-primary" data-p3>${esc(tx('Criar a reunião', 'Create the meeting'))}</button>`;
    } else if (step === 4) {
      const s = sug.find(x => L(x.name) === name), tm = W.rec('teams', (p.team || [])[0]);
      body = `<h2 class="pr-h3">${esc(tx('Uma nota que se encontra daqui a três meses', 'A note you will find in three months'))}</h2>
        <p class="pr-sub">${esc(tx(`Prefixo da ${L(W.hub().oneLower)}, o facto, e o nome do projeto no fim. A relação ${L(W.hub().prop)} fica preenchida — já não vai para a triagem.`, `${L(W.hub().prop)} prefix, the fact, and the project name at the end. The ${L(W.hub().prop)} relation gets set — it skips triage.`))}</p>
        <div class="ap-act"><input type="text" data-nt maxlength="140" value="${esc(s ? L(s.note) : (tm ? W.title('teams', tm) + ': ' : ''))}"><code data-ntpv></code></div>
        <button type="button" class="btn btn-primary" data-p4>${esc(tx('Guardar a nota', 'Save the note'))}</button>`;
    } else {
      const r = W.search(name), tm = W.rec('teams', (p.team || [])[0]);
      const grp = {}; r.forEach(x => { const g = x.kind === 'task' ? tx('Tarefas', 'Tasks') : L(W.schemaOf(x.db).name); (grp[g] = grp[g] || []).push(x); });
      const back = tm ? W.schemaOf('teams').props.filter(pp => pp.type === 'rel' && pp.back).map(pp => ({ n: L(pp.name), ids: W.val('teams', tm, pp) })) : [];
      body = `<h2 class="pr-h3">${esc(tx('Pesquisa: ', 'Search: '))}<code class="ap-q">${esc(name)}</code></h2>
        <p class="pr-sub">${esc(tx('Pesquisa por palavras inteiras, em tudo. Porque o nome está no fim de cada título, aparece tudo — em quatro sítios diferentes.', 'Whole-word search across everything. Because the name is at the end of every title, everything comes up — from four different places.'))}</p>
        <div class="ap-found">${Object.keys(grp).map(g => `<div><p class="pr-kicker">${esc(g)} · ${grp[g].length}</p><ul>${grp[g].map(x => `<li>${x.kind === 'rec' ? `<a href="#experimentar/notion/${x.db}/${(W.state().views[x.db] || [{ id: 'all' }])[0].id}/${x.id}">${esc(x.label)}</a>` : esc(x.label)}</li>`).join('')}</ul></div>`).join('')}</div>
        ${tm ? `<p class="pr-kicker" style="margin-top:1.2rem">${esc(tx(`E a página de ${W.title('teams', tm)} já sabe tudo isto (relações de duas vias):`, `And the ${W.title('teams', tm)} page already knows all this (two-way relations):`))}</p>
          <ul class="ap-back">${back.map(b => `<li><b>${esc(b.n)}</b> ${b.ids.length}</li>`).join('')}</ul>` : ''}
        <div class="pr-row" style="margin-top:1.2rem"><a class="btn btn-primary" href="#experimentar/notion/projects/active/${p.id}">${esc(tx('Abrir o projeto no playground', 'Open the project in the playground'))}</a>
          ${tm ? `<a class="btn" href="#experimentar/notion/teams/all/${tm.id}">${esc(tx('Abrir a página da ', 'Open the page of ') + W.title('teams', tm))}</a>` : ''}
          <button type="button" class="btn btn-ghost" data-again>${esc(tx('Construir outro', 'Build another'))}</button></div>`;
    }
    host.innerHTML = rail + `<div class="pr-sheet ap-card">${body}</div>`;
    wireProj(host, m, p, sug);
  }
  function wireProj(host, m, p, sug) {
    const set = (patch, ops) => { W.apply('proj', (ops || []).concat([{ o: 'mark', k: 'proj', v: Object.assign({}, m, patch) }])); drawProj(host); };
    const name = p ? W.title('projects', p) : '';
    const pv = (inp, out, fn) => { if (!inp) return; const f = () => { out.textContent = fn(inp.value.trim()); }; inp.addEventListener('input', f); f(); };
    pv($('[data-act]', host), $('[data-actpv]', host) || {}, v => v ? `${v} (${name})` : '');
    pv($('[data-nt]', host), $('[data-ntpv]', host) || {}, v => v ? (W.fold(v).includes(W.fold(name)) ? v : `${v} (${name})`) : '');
    host.onclick = e => {
      const t = e.target;
      const sg = t.closest('[data-sug]');
      if (sg) { const s = sug[+sg.dataset.sug]; $('[data-pn]', host).value = L(s.name); $('[data-pt]', host).value = s.team; return; }
      if (t.closest('[data-p0]')) {
        const nm = $('[data-pn]', host).value.trim(), warn = $('[data-pwarn]', host);
        if (nm.length < 3) { warn.hidden = false; warn.textContent = tx('Escreve um nome.', 'Type a name.'); return; }
        if (PrCapture.VERB_RX.test(nm)) { warn.hidden = false; warn.textContent = tx('Começa por um verbo — isso é uma tarefa. Um projeto é o resultado: "Plano de piquete", não "Fazer o plano".', 'It starts with a verb — that is a task. A project is the outcome: "On-call plan", not "Make the plan".'); return; }
        if (W.recs('projects').some(r => W.fold(W.title('projects', r)) === W.fold(nm))) { warn.hidden = false; warn.textContent = tx('Já existe um projeto com este nome — a pesquisa ia misturá-los.', 'A project with this name already exists — search would mix them up.'); return; }
        const id = 'pp' + Date.now().toString(36);
        set({ pid: id, step: 1 }, [{ o: 'add', db: 'projects', r: { id, name: nm, status: $('[data-ps]', host).value, team: [$('[data-pt]', host).value], body: PrSeed.TEMPLATES.project.body } }]);
        Pr.toast(tx('Linha criada em Projetos.', 'Row created in Projects.'));
        return;
      }
      if (t.closest('[data-p1]')) {
        const v = $('[data-obj]', host).value.trim(); if (!v) { $('[data-obj]', host).focus(); return; }
        const body = (p.body || []).map((b, i) => i === 1 ? { k: 'p', t: v } : b);
        set({ step: 2 }, [{ o: 'set', db: 'projects', id: p.id, k: 'body', v: body }]); return;
      }
      if (t.closest('[data-skip]')) { set({ step: 2 }); return; }
      if (t.closest('[data-p2]')) {
        const v = $('[data-act]', host).value.trim(), warn = $('[data-awarn]', host);
        if (!v) { $('[data-act]', host).focus(); return; }
        if (!PrCapture.VERB_RX.test(v) && !warn.dataset.once) { warn.hidden = false; warn.dataset.once = 1; warn.textContent = tx('Não parece começar por um verbo. "Rascunhar a escala" diz o que fazer; "Escala" não. (Carrega outra vez para guardar assim.)', 'It does not seem to start with a verb. "Draft the rota" says what to do; "Rota" does not. (Press again to save it anyway.)'); return; }
        set({ step: 3 }, [PrCapture.taskOp({ title: `${v} (${name})`, box: 'wp', due: W.clock() + 2, p: 4 })]);
        Pr.toast(tx('Na lista, em #Trabalho-Projetos, para daqui a 2 dias.', 'On the list, in #Work-Projects, due in 2 days.'));
        return;
      }
      if (t.closest('[data-p3]')) {
        const nm = $('[data-mn]', host).value.trim() || tx('Arranque: ', 'Kick-off: ') + name, b = $('[data-mb]', host).value.trim();
        const id = 'pm' + Date.now().toString(36);
        set({ step: 4 }, [{ o: 'add', db: 'meetings', r: { id, name: nm, type: 'od', project: [p.id], team: (p.team || []).slice(), cr: W.clock(), body: b ? [{ k: 'p', t: Pr.fmtDay(W.clock(), 'short') + ': ' + b }] : [] } }]);
        return;
      }
      if (t.closest('[data-p4]')) {
        let v = $('[data-nt]', host).value.trim(); if (!v) { $('[data-nt]', host).focus(); return; }
        if (!W.fold(v).includes(W.fold(name))) v = `${v} (${name})`;
        set({ step: 5 }, [{ o: 'add', db: 'notes', r: { id: 'pn' + Date.now().toString(36), name: v, team: (p.team || []).slice(), tags: [], cr: W.clock() } }]);
        return;
      }
      if (t.closest('[data-again]')) { W.apply('proj', { o: 'mark', k: 'proj', v: null }); drawProj(host); }
    };
  }

  /* ════════════════ 4 · Página ou base de dados? (laboratório) ════════════════ */
  function ladPage(rest, el) {
    PrShell.setArea('experimentar', tx('Página ou base de dados?', 'Page or database?'));
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:1000px">
      ${head('experimentar', tx('Página ou base de dados?', 'Page or database?'), ['str'], tx('Página ou base de dados?', 'Page or database?'),
        tx('Começa sempre pelo mais simples. Uma estrutura sobe um degrau só quando o degrau de baixo começa a doer — e a regra de três diz quando: à terceira vez, é um padrão.', 'Always start with the simplest thing. A structure climbs a rung only when the rung below starts to hurt — and the rule of three says when: the third time, it is a pattern.'))}
      ${PrApp.worldBar('lad')}
      <div class="ap-lad-g"><div class="pr-sheet ap-card" data-fq></div><div class="pr-sheet ap-card" data-ld></div></div>${Pr.localNote()}</div>`;
    PrLearn.DEMOS.fourq($('[data-fq]', el));
    drawLadder($('[data-ld]', el));
  }
  function drawLadder(host) {
    const n = PrLearn.decisionCount(), hasDb = !!W.schemaOf('decisions');
    const tagged = W.recs('notes').filter(r => (r.tags || []).includes('decision')).length;
    const hasView = (W.state().views.notes || []).some(v => v.id === 'decisions');
    const rung = hasDb ? 2 : hasView ? 1 : 0;
    const dnotes = W.recs('notes').filter(r => /^(decis[aã]o|decision)\s*:/i.test(W.title('notes', r)) || (r.tags || []).includes('decision'));
    host.innerHTML = `<p class="pr-kicker">${esc(tx('A escada, a sério', 'The ladder, for real'))}</p>
      ${hasDb ? `<h2 class="pr-h3">${esc(tx(`Linhas na base Decisões: ${W.recs('decisions').length}`, `Rows in the Decisions database: ${W.recs('decisions').length}`))}</h2>
        <ul class="ap-dn">${W.recs('decisions').map(r => `<li>⚖️ ${esc(W.title('decisions', r))}</li>`).join('')}</ul>`
      : `<h2 class="pr-h3">${esc(tx(`Notas de decisão no mundo: ${n}`, `Decision notes in the world: ${n}`))}</h2>
      <ul class="ap-dn">${dnotes.map(r => `<li>${esc(W.title('notes', r))}${(r.tags || []).includes('decision') ? ' <span class="nb-opt c-purple">decision</span>' : ''}</li>`).join('') || `<li class="pr-sub">${esc(tx('Nenhuma.', 'None.'))}</li>`}</ul>`}
      ${n < 3 && !hasDb ? `<p class="cp-warn">${esc(tx('Ainda não há três. Escreve outra nota "Decisão: …" no laboratório de captura (ou vive a semana guiada) e volta.', 'There are not three yet. Write another "Decision: …" note in the capture lab (or live the guided week) and come back.'))}</p>` : ''}
      <ol class="lr-ladder ap-ladder">
        <li class="${rung === 0 ? 'on' : 'past'}"><span class="pr-mono">${esc(tx('Degrau 0', 'Rung 0'))}</span><b>${esc(tx('Notas com "Decisão:" no título', 'Notes titled "Decision:"'))}</b><small>${esc(tx('É onde estás por defeito. Custo zero.', 'Where you are by default. Zero cost.'))}</small></li>
        <li class="${rung === 1 ? 'on' : rung > 1 ? 'past' : ''}"><span class="pr-mono">${esc(tx('Degrau 1', 'Rung 1'))}</span><b>${esc(tx('Etiqueta + vista filtrada', 'Tag + filtered view'))}</b>
          <small>${esc(tx('A etiqueta "decision" em cada nota de decisão e uma vista "Decisões" em Notas. Continuam a ser notas.', 'The "decision" tag on every decision note and a "Decisions" view in Notes. Still notes.'))}</small>
          ${rung === 0 ? `<button type="button" class="btn btn-sm" data-r1 ${n >= 3 ? '' : 'disabled'}>${esc(tx('Subir para o degrau 1', 'Climb to rung 1'))}</button>` : ''}</li>
        <li class="${rung === 2 ? 'on' : ''}"><span class="pr-mono">${esc(tx('Degrau 2', 'Rung 2'))}</span><b>${esc(tx('Base própria: Decisões', 'Own database: Decisions'))}</b>
          <small>${esc(tx('Quando precisas de campos que só este tipo tem: Estado (Aceite / Substituída), Confiança. As notas saem das Notas e viram linhas com o modelo ADR.', 'When you need fields only this kind has: Status (Accepted / Superseded), Confidence. The notes leave Notes and become rows with the ADR template.'))}</small>
          ${rung === 1 ? `<button type="button" class="btn btn-sm" data-r2>${esc(tx('Subir para o degrau 2', 'Climb to rung 2'))}</button>` : ''}</li>
      </ol>
      ${rung === 1 ? `<p class="pr-sub">${esc(tx(`Etiquetadas: ${tagged}. `, `Tagged: ${tagged}. `))}<a href="#experimentar/notion/notes/decisions">${esc(tx('Ver a vista "Decisões" no playground', 'See the "Decisions" view in the playground'))} →</a></p>` : ''}
      ${rung === 2 ? `<p class="wk-fb ok">${esc(tx('A base existe. Repara no que se ganhou (Estado, Confiança, vista "Baixa confiança") e no que custou: mais um sítio para manter. Por isso não se começa aqui.', 'The database exists. Notice what you gained (Status, Confidence, a "Low confidence" view) and what it cost: one more place to maintain. That is why you do not start here.'))}</p>
        <a class="btn btn-sm" href="#experimentar/notion/decisions/active">${esc(tx('Abrir Decisões no playground', 'Open Decisions in the playground'))} →</a>` : ''}`;
    host.onclick = e => {
      if (e.target.closest('[data-r1]')) {
        const ops = dnotes.map(r => ({ o: 'set', db: 'notes', id: r.id, k: 'tags', v: Array.from(new Set((r.tags || []).concat('decision'))) }));
        ops.push({ o: 'view+', db: 'notes', v: { id: 'decisions', name: B('Decisões', 'Decisions'), layout: 'table', filter: [{ p: 'tags', op: 'has', v: 'decision' }], sort: [{ p: 'cr', dir: 'desc' }], hide: [],
          why: B('Degrau 1 da escada: uma etiqueta e uma vista. Ainda são notas.', 'Rung 1 of the ladder: a tag and a view. Still notes.') } });
        W.apply('lad', ops); drawLadder(host); Pr.pop($('.lr-ladder li.on', host)); return;
      }
      if (e.target.closest('[data-r2]')) {
        const { ops, n: k } = PrNotion.decisionOps();
        W.apply('lad', ops); drawLadder(host); Pr.toast(tx(`Base Decisões criada com ${k} linhas.`, `Decisions created with ${k} rows.`));
      }
    };
  }

  Pr.route('aplicar/triagem', triPage);
  Pr.route('aplicar/para', paraPage);
  Pr.route('aplicar/projeto', projPage);
  Pr.route('experimentar/pagina-ou-base', ladPage);
  return { PLACES };
})();
