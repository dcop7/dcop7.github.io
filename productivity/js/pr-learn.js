/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — Aprender (global `PrLearn`)
   Índice por blocos, página de capítulo (com índice lateral e
   anterior/seguinte) e as demonstrações embutidas (data-demo).
   As demos LEEM o mundo de exemplo, nunca o alteram.
   ══════════════════════════════════════════════════════════════════ */
const PrLearn = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, kindTag, srcTag, crumbs } = Pr;
  const { BLOCKS, CH } = PrLearnContent;
  const B = (pt, en) => ({ pt, en });

  const chapters = () => CH;
  /* dois percursos: Organizar (os blocos originais) e Executar e dirigir
     (acrescentado por pr-mind-content.js). Um bloco sem track é 'org'. */
  const trackOf = b => (b && b.track) || 'org';
  const tracks = () => PrLearnContent.TRACKS || [{ id: 'org' }];
  const trackCh = t => CH.filter(c => trackOf(BLOCKS.find(b => b.id === c.block)) === t);
  const kinds = c => (c.kinds || []).map(kindTag).join('');
  function indexHtml() {
    const multi = tracks().length > 1;
    return tracks().map(t => { let n = 0;
      return `${multi ? `<section class="pr-track" id="track-${t.id}"><div class="pr-trackhead"><p class="pr-kicker">${esc(tx('Percurso', 'Track'))} ${esc(t.n || '')}</p><h2>${esc(L(t.name))}</h2><p>${esc(L(t.d))}</p></div>` : ''}
      ${BLOCKS.filter(b => trackOf(b) === t.id).map(b => `<div class="pr-blockhead"><h2>${esc(L(b.name))}</h2><p>${esc(L(b.d))}</p></div>
      <ol class="pr-index">${CH.filter(c => c.block === b.id).map(c => { n++; return `<li><a href="#aprender/${c.id}"><span class="n">${String(n).padStart(2, '0')}</span><b>${esc(L(c.title))}</b>
        <span class="meta">${kinds(c)}<span class="pr-mono" style="color:var(--pr-dim)">${c.min} min</span></span><p>${esc(L(c.lede))}</p></a></li>`; }).join('')}</ol>`).join('')}${multi ? '</section>' : ''}`; }).join('');
  }

  function chapter(id, el) {
    const c0 = CH.find(c => c.id === id);
    const tid = c0 ? trackOf(BLOCKS.find(b => b.id === c0.block)) : 'org', TCH = trackCh(tid), track = tracks().find(t => t.id === tid) || {};
    const i = TCH.findIndex(c => c.id === id);
    if (i < 0) { el.innerHTML = `<div class="pr-wrap pr-page"><div class="empty-state"><p class="es-title">${esc(tx('Capítulo não encontrado.', 'Chapter not found.'))}</p><a class="btn" href="#aprender">${esc(tx('Ver os capítulos', 'See the chapters'))}</a></div></div>`; return; }
    const c = TCH[i], prev = TCH[i - 1], next = TCH[i + 1];
    const other = tracks().find(t => t.id !== tid);
    const blk = BLOCKS.find(b => b.id === c.block);
    PrShell.setArea('aprender', L(c.title));
    el.innerHTML = `<div class="pr-wrap pr-page lr-layout">
      <aside class="lr-aside" aria-label="${esc(tx('Capítulos', 'Chapters'))}">
        ${track.name && tracks().length > 1 ? `<p class="lr-track">${esc(L(track.name))}</p>` : ''}
        ${BLOCKS.filter(b => trackOf(b) === tid).map(b => `<p class="pr-kicker">${esc(L(b.name))}</p><ol>${CH.filter(x => x.block === b.id).map(x =>
          `<li><a href="#aprender/${x.id}" ${x.id === c.id ? 'aria-current="page" class="on"' : ''}>${esc(L(x.title))}</a></li>`).join('')}</ol>`).join('')}
        ${other && other.name ? `<p class="lr-other"><a href="#aprender/${(trackCh(other.id)[0] || {}).id}">${esc(tx('Outro percurso: ', 'Other track: '))}${esc(L(other.name))} →</a></p>` : ''}
      </aside>
      <article class="lr-article">
        ${crumbs([{ label: tx('Aprender', 'Learn'), href: '#aprender' }].concat(track.name && tracks().length > 1 ? [{ label: L(track.name), href: '#aprender' }] : []).concat([{ label: L(blk.name) }, { label: L(c.title) }]))}
        <header class="pr-head"><p class="pr-kicker">${String(i + 1).padStart(2, '0')} · ${c.min} min ${(c.kinds || []).map(kindTag).join(' ')}</p>
          <h1>${esc(L(c.title))}</h1><p class="lede">${esc(L(c.lede))}</p></header>
        <div class="lr-legend">${tid === 'org' ? `${srcTag('est')} ${esc(tx('vem da literatura', 'from the literature'))} · ${srcTag('own')} ${esc(tx('decisão do sistema de referência', 'decision of the reference system'))} · ${srcTag('chk')} ${esc(tx('depende do produto', 'depends on the product'))}`
          : `${srcTag('res')} ${esc(tx('estudos publicados', 'published studies'))} · ${srcTag('est')} ${esc(tx('enquadramento reconhecido', 'recognised framework'))} · ${srcTag('auth')} ${esc(tx('modelo de um autor', "one author's model"))} · ${srcTag('tip')} ${esc(tx('conselho deste site', "this site's advice"))} · ${srcTag('weak')} ${esc(tx('evidência fraca', 'weak evidence'))}`}</div>
        <div class="lr-body">${L(c.body)}</div>
        ${c.refs ? `<section class="lr-refs"><p class="pr-kicker">${esc(tx('Fontes deste capítulo', 'Sources for this chapter'))}</p><ol>${c.refs.map(r => `<li>${r}</li>`).join('')}</ol></section>` : ''}
        <section class="lr-take"><p class="pr-kicker">${esc(tx('Para levar', 'Takeaways'))}</p><ul>${L(c.take).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          ${(c.next || []).length ? `<div class="pr-row" style="margin-top:1rem">${c.next.map(n => `<a class="btn" href="${n.href}">${esc(L(n.l))} ${ICON.arrow}</a>`).join('')}</div>` : ''}</section>
        <nav class="pr-pager" aria-label="${esc(tx('Capítulos', 'Chapters'))}">
          ${prev ? `<a href="#aprender/${prev.id}"><small>← ${esc(tx('anterior', 'previous'))}</small><b>${esc(L(prev.title))}</b></a>` : '<span></span>'}
          ${next ? `<a class="next" href="#aprender/${next.id}"><small>${esc(tx('seguinte', 'next'))} →</small><b>${esc(L(next.title))}</b></a>` : ''}
        </nav>
      </article></div>`;
    $$('[data-src]', el).forEach(s => { s.outerHTML = srcTag(s.dataset.src); });
    $$('[data-demo]', el).forEach(d => { const f = DEMOS[d.dataset.demo]; d.classList.add('lr-demo'); if (['kinds', 'para4'].includes(d.dataset.demo)) d.classList.add('lr-bare'); if (f) f(d); });
  }

  /* ════════════════ demonstrações ════════════════ */
  const DEMOS = {};
  const demoHead = (t, sub) => `<div class="lr-demo-h"><span class="lr-demo-k">${esc(tx('Demonstração', 'Demo'))}</span><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;

  /* 1 · as quatro espécies, com exemplos do cenário atual */
  DEMOS.kinds = el => {
    const K = Pr.KINDS, w = PrWorld.scenario() === 'work';
    const ex = w ? { act: B('Insistir com a Ana pelos números do atraso (Migração da BD)', 'Chase Ana for the lag numbers (DB migration)'), info: B('Atlas: o ensaio precisa de 4 h de congelamento (Migração da BD)', 'Atlas: rehearsal needs a 4h freeze (DB migration)'), today: B('□ Verificar o teste de recuo', '□ Verify the rollback test'), str: B('Uma linha em Projetos: Migração da BD', 'A Projects row: DB migration') }
                 : { act: B('Ler o rascunho da Inês (Trabalho de Sociologia)', "Read Inês's draft (Sociology paper)"), info: B('Estatística: o teste-t entra no exame (Exame de Estatística)', 'Statistics: the t-test is in the exam (Statistics exam)'), today: B('□ Exercícios 3 e 4', '□ Exercises 3 and 4'), str: B('Uma linha em Projetos: Mudança de casa', 'A Projects row: Moving house') };
    el.innerHTML = `<div class="lr-kinds">${Object.keys(K).map((k, i) => `<div class="lr-kind ${K[k].cls}"><span class="pr-mono">${i + 1}</span><b>${esc(L(K[k].name))}</b>
      <p>${esc(L(K[k].q))}</p><span class="lr-kind-place">${esc(L(K[k].place))}</span><code>${esc(L(ex[k]))}</code></div>`).join('')}</div>`;
  };

  /* 2 · triagem rápida em quatro espécies */
  const SORT_ITEMS = [
    { s: B('A Marta pede-te para rever o plano de piquete até sexta', 'Marta asks you to review the on-call plan by Friday'), k: 'act', why: B('Verbo + prazo: tarefa com data.', 'Verb + deadline: a dated task.') },
    { s: B('Ouves que o fornecedor de email vai mudar de preços em janeiro', 'You hear the email vendor changes prices in January'), k: 'info', why: B('Um facto para encontrar depois: uma linha nas Notas.', 'A fact to find later: one line in Notes.') },
    { s: B('Decides que hoje o foco é fechar o runbook', 'You decide today\'s focus is closing the runbook'), k: 'today', why: B('A tarefa já existe; isto é foco — um dos Big 3.', 'The task already exists; this is focus — one of the Big 3.') },
    { s: B('Uma equipa nova, "Delta", passa a reportar-te', 'A new team, "Delta", now reports to you'), k: 'str', why: B('Uma linha nova na base central (Equipas). Os nomes das equipas só existem lá.', 'A new row in the hub database (Teams). Team names only live there.') },
    { s: B('Lembras-te de que tens de renovar o passaporte', 'You remember you need to renew your passport'), k: 'act', why: B('Uma ação pessoal, sem data inventada.', 'A personal action, no invented date.') },
    { s: B('O professor diz que o exame passa para 15 de janeiro', 'The lecturer says the exam moves to 15 January'), k: 'info', why: B('Informação — e se foi dito numa aula marcada, vai para a página dessa aula.', 'Information — and if it was said in a scheduled class, it goes on that class\'s page.') },
  ];
  DEMOS.sorter = el => {
    const K = Pr.KINDS; let score = 0, done = 0;
    el.innerHTML = demoHead(tx('Para onde vai?', 'Where does it go?'), tx('Escolhe a espécie de cada coisa', 'Pick the kind of each thing')) +
      `<ol class="lr-sort">${SORT_ITEMS.map((it, i) => `<li data-i="${i}"><p>${esc(L(it.s))}</p><div class="lr-sort-b" role="group">${Object.keys(K).map(k =>
        `<button type="button" class="btn btn-sm lr-kbtn ${K[k].cls}" data-k="${k}">${esc(L(K[k].name))}</button>`).join('')}</div><p class="lr-sort-why" aria-live="polite"></p></li>`).join('')}</ol>
      <p class="lr-score" aria-live="polite"></p>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const li = b.closest('li'); if (li.dataset.done) return;
      const it = SORT_ITEMS[+li.dataset.i], ok = b.dataset.k === it.k;
      li.dataset.done = '1'; done++; if (ok) score++;
      $$('[data-k]', li).forEach(x => { x.disabled = true; if (x.dataset.k === it.k) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      li.classList.add(ok ? 'ok' : 'no');
      $('.lr-sort-why', li).innerHTML = `<b>${esc(ok ? tx('Certo.', 'Right.') : tx('É ', 'It is ') + L(K[it.k].name) + '.')}</b> ${esc(L(it.why))}`;
      if (done === SORT_ITEMS.length) $('.lr-score', el).innerHTML = `${esc(tx(`${score} de ${done} certas.`, `${score} of ${done} right.`))} <a href="#aplicar/triagem">${esc(tx('Mais 12 casos →', '12 more cases →'))}</a>`;
    });
  };

  /* 3 · o destino de uma nota */
  const FATE_NOTES = [
    { t: B('Lembrar de ver a cache', 'Remember to check cache'), best: 'act', why: B('Esconde uma ação. Vira tarefa ("Verificar se a cache recuperou (Renovação do CI)") e a nota apaga-se.', 'It hides an action. It becomes a task ("Verify the build cache recovered (CI revamp)") and the note is deleted.') },
    { t: B('Atlas: a Ana assinalou picos de atraso de replicação no fim do mês (Migração da BD)', 'Atlas: Ana flagged replication lag spikes at month-end (DB migration)'), best: 'keep', why: B('Vale a pena encontrar depois. Guarda-se: define-se a equipa (Atlas) e sai da fila.', 'Worth finding later. Keep it: set the team (Atlas) and it leaves the queue.') },
    { t: B('Coisa do Kafka', 'Kafka thing'), best: 'toss', why: B('Ninguém vai voltar a perceber isto. Deita-se fora.', 'Nobody will understand this again. Toss it.') },
    { t: B('Decisão: os modelos de CI vivem num só repositório (Renovação do CI)', 'Decision: CI templates live in one repository (CI revamp)'), best: 'grad', why: B('Pertence a algo estruturado: quando houver a base Decisões (à terceira decisão), passa para lá.', 'It belongs to something structured: once a Decisions database exists (at the third decision), it moves there.') },
  ];
  const FATES = { keep: B('Guardar', 'Keep'), act: B('Agir', 'Act'), toss: B('Deitar fora', 'Toss'), grad: B('Graduar', 'Graduate') };
  const FATE_DEST = { keep: B('Fica nas Notas, com equipa', 'Stays in Notes, with a team'), act: B('Lista de tarefas', 'Task list'), toss: B('Lixo', 'Bin'), grad: B('Uma base de dados', 'A database') };
  DEMOS.fates = el => {
    let i = 0;
    const draw = () => {
      const n = FATE_NOTES[i];
      el.innerHTML = demoHead(tx('Triagem de sexta', 'Friday triage'), tx(`nota ${i + 1} de ${FATE_NOTES.length}`, `note ${i + 1} of ${FATE_NOTES.length}`)) +
        `<div class="lr-fates"><div class="lr-note-card k-info" data-card>${esc(L(n.t))}</div>
        <div class="lr-fate-row">${Object.keys(FATES).map(f => `<button type="button" class="lr-fate" data-f="${f}"><b>${esc(L(FATES[f]))}</b><small>${esc(L(FATE_DEST[f]))}</small></button>`).join('')}</div>
        <p class="lr-fate-why" aria-live="polite"></p>
        <div class="pr-row"><button type="button" class="btn btn-sm" data-nx hidden>${esc(tx('Próxima nota', 'Next note'))} ${ICON.arrow}</button></div></div>`;
    };
    draw();
    el.addEventListener('click', async e => {
      if (e.target.closest('[data-nx]')) { i = (i + 1) % FATE_NOTES.length; draw(); return; }
      const b = e.target.closest('[data-f]'); if (!b || el.dataset.busy) return;
      const n = FATE_NOTES[i], ok = b.dataset.f === n.best;
      el.dataset.busy = '1';
      await Pr.fly($('[data-card]', el), b, { cls: 'k-info' });
      delete el.dataset.busy;
      $$('[data-f]', el).forEach(x => x.classList.toggle('best', x.dataset.f === n.best));
      $('.lr-fate-why', el).innerHTML = `<b>${esc(ok ? tx('Isso mesmo.', 'Exactly.') : tx('Melhor: ', 'Better: ') + L(FATES[n.best]) + '.')}</b> ${esc(L(n.why))}`;
      $('[data-nx]', el).hidden = false;
    });
  };

  /* 4 · pesquisa por palavras inteiras no mundo de exemplo */
  DEMOS.search = el => {
    const w = PrWorld.scenario() === 'work';
    const sugg = w ? [tx('migração', 'migration'), 'Atlas', tx('Insistir', 'Chase'), tx('migr', 'migr')] : [tx('Estatística', 'Statistics'), tx('casa', 'house'), tx('Insistir', 'Chase'), tx('Estat', 'Stat')];
    el.innerHTML = demoHead(tx('Pesquisa no mundo de exemplo', 'Search the sample world'), tx('só palavras inteiras', 'whole words only')) +
      `<div class="lr-search"><label class="lr-search-in">${ICON.search}<input type="search" placeholder="${esc(tx('Escreve uma palavra…', 'Type a word…'))}" aria-label="${esc(tx('Pesquisar', 'Search'))}"></label>
      <div class="pr-row">${sugg.map(s => `<button type="button" class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="lr-search-out" aria-live="polite"></div></div>`;
    const inp = $('input', el), out = $('.lr-search-out', el);
    const run = () => {
      const q = inp.value.trim();
      if (!q) { out.innerHTML = `<p class="pr-sub">${esc(tx('Experimenta o nome de um projeto, uma equipa, ou um pedaço de palavra.', 'Try a project name, a team, or part of a word.'))}</p>`; return; }
      const r = PrWorld.search(q), part = PrWorld.partial(q);
      const groups = {};
      r.forEach(x => { const g = x.kind === 'task' ? tx('Tarefas', 'Tasks') : L(PrWorld.schemaOf(x.db).name); (groups[g] = groups[g] || []).push(x); });
      out.innerHTML = (r.length ? Object.keys(groups).map(g => `<div class="lr-sr-g"><p class="pr-kicker">${esc(g)} · ${groups[g].length}</p><ul>${groups[g].slice(0, 6).map(x =>
        `<li class="${x.archived ? 'arch' : ''}">${esc(x.label)}${x.archived ? ` <small>(${esc(tx('arquivada', 'archived'))})</small>` : ''}</li>`).join('')}${groups[g].length > 6 ? `<li class="more">+${groups[g].length - 6}</li>` : ''}</ul></div>`).join('')
        : `<p class="lr-miss"><b>${esc(tx('Nada.', 'Nothing.'))}</b> ${esc(part ? tx(`Uma pesquisa por parte de palavra encontraria ${part} — mas a pesquisa por palavras inteiras não. Escreve a palavra completa.`, `A partial-word search would find ${part} — but whole-word search does not. Type the full word.`) : tx('Nenhum título usa esta palavra.', 'No title uses this word.'))}</p>`);
    };
    inp.addEventListener('input', run);
    el.addEventListener('click', e => { const c = e.target.closest('[data-s]'); if (c) { inp.value = c.dataset.s; run(); } });
    run();
  };

  /* 5 · as cinco etapas do GTD */
  const GTD5 = [
    { n: B('Capturar', 'Capture'), m: B('Recolher tudo o que tem a tua atenção, já, sem julgar.', 'Collect everything that has your attention, immediately, without judging it.'), h: B('Quick-add na lista (ações) · uma linha nas Notas (informação)', 'Quick-add to the list (actions) · one line in Notes (information)') },
    { n: B('Clarificar', 'Clarify'), m: B('Decidir o que cada coisa significa e qual é a próxima ação física.', 'Decide what each item means and what the next physical action is.'), h: B('Verbo primeiro nas tarefas · equipa como prefixo nas notas', 'Verb first on tasks · team as a prefix on notes') },
    { n: B('Organizar', 'Organize'), m: B('Pôr o que foi clarificado no sítio a que pertence.', 'Put the clarified item where it belongs.'), h: B('Três contentores + nome do projeto no título · triagem de sexta', 'Three containers + project name in the title · Friday triage') },
    { n: B('Refletir', 'Reflect'), m: B('Rever o sistema com regularidade para continuares a confiar nele.', 'Review the system regularly so you keep trusting it.'), h: B('Ritual diário do caderno + revisão semanal', 'Daily notebook ritual + weekly review') },
    { n: B('Envolver', 'Engage'), m: B('Escolher o que fazer agora, com confiança.', 'Choose what to do right now, with confidence.'), h: B('Três filtros guardados', 'Three saved filters') },
  ];
  DEMOS.gtd5 = el => {
    let cur = 0;
    const draw = () => {
      el.innerHTML = demoHead(tx('As cinco etapas', 'The five stages')) + `<ol class="lr-gtd" role="tablist">${GTD5.map((s, i) => `<li><button type="button" role="tab" aria-selected="${i === cur}" data-i="${i}"><span class="pr-mono">${i + 1}</span>${esc(L(s.n))}</button></li>`).join('')}</ol>
        <div class="lr-gtd-p" role="tabpanel"><p><b>${esc(L(GTD5[cur].n))}.</b> ${esc(L(GTD5[cur].m))}</p><p class="pr-sub">${esc(tx('Neste sistema: ', 'In this system: '))}${esc(L(GTD5[cur].h))}</p>
        ${cur === 4 ? `<p class="pr-sub">↺ ${esc(tx('E as coisas novas continuam a chegar — volta-se a capturar.', 'And new things keep showing up — back to capture.'))}</p>` : ''}</div>`;
    };
    draw();
    el.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { cur = +b.dataset.i; draw(); Pr.pop($('.lr-gtd-p', el)); $(`[data-i="${cur}"]`, el).focus(); } });
  };

  /* 6 · verbo primeiro */
  const VERBS = [
    [B('Reunião com fornecedor', 'Vendor meeting'), B('<em>Marcar</em> reunião com o fornecedor', '<em>Schedule</em> vendor meeting')],
    [B('Proposta de atualização do cluster', 'Cluster upgrade proposal'), B('<em>Rever</em> a proposta de atualização do cluster (Atualização do k8s)', '<em>Review</em> cluster upgrade proposal (k8s upgrade)')],
    [B('Diapositivos do roadmap', 'Roadmap slides'), B('<em>Atualizar</em> os diapositivos do roadmap', '<em>Update</em> roadmap slides')],
    [B('À espera dos números da Ana', "Waiting for Ana's numbers"), B('<em>Insistir</em> com a Ana pelos números do atraso (Migração da BD)', '<em>Chase</em> Ana for replication lag numbers (DB migration)')],
    [B('O teste de recuo passou?', 'Did the rollback test pass?'), B('<em>Verificar</em> se o teste de recuo passou em staging (Migração da BD)', '<em>Verify</em> rollback test passed in staging (DB migration)')],
  ];
  DEMOS.verbfirst = el => {
    el.innerHTML = demoHead(tx('Em vez de… escreve', 'Instead of… write'), tx('toca para clarificar', 'tap to clarify')) +
      `<ul class="lr-verbs">${VERBS.map((v, i) => `<li><button type="button" data-i="${i}" aria-expanded="false"><s>${esc(L(v[0]))}</s><span class="lr-verb-to" hidden>${L(v[1])}</span></button></li>`).join('')}</ul>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const on = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', on); $('.lr-verb-to', b).hidden = !on; $('s', b).hidden = on;
      if (on) Pr.pop($('.lr-verb-to', b));
    });
  };

  /* 7 · os três filtros, sobre as tarefas do mundo */
  DEMOS.filters = el => {
    let cur = 'today';
    const draw = () => {
      const F = PrWorld.TASK_FILTERS, list = PrWorld.filterTasks(cur), now = PrWorld.clock();
      el.innerHTML = demoHead(tx('Três filtros', 'Three filters'), tx('sobre as tarefas do mundo de exemplo · ', 'over the sample world\'s tasks · ') + Pr.fmtDay(now, 'long')) +
        `<div class="seg" role="tablist">${Object.keys(F).map(k => `<button type="button" role="tab" class="seg-btn ${k === cur ? 'active' : ''}" aria-selected="${k === cur}" data-f="${k}">${esc(L(F[k].name))} <span class="pr-mono">${PrWorld.filterTasks(k).length}</span></button>`).join('')}</div>
        <p class="lr-q pr-mono">${esc(L(F[cur].q))}</p>
        <ul class="lr-tasks">${list.map(t => taskLi(t, now)).join('') || `<li class="pr-sub">${esc(tx('Nada aqui.', 'Nothing here.'))}</li>`}</ul>
        <p class="pr-sub">${esc(cur === 'due7' ? tx('"Antes de daqui a 7 dias" inclui as atrasadas — um "próximos 7 dias" simples deixava-as cair.', '"Before in 7 days" includes overdue ones — a plain "next 7 days" would drop them.')
          : cur === 'follow' ? tx('Sem etiqueta "à espera": o verbo no título é a lista.', 'No "waiting" label: the verb in the title is the list.') : tx('Atrasadas incluídas: a escolha da manhã nunca perde o que escorregou.', 'Overdue included: the morning pick never misses what slipped.'))}</p>`;
    };
    draw();
    el.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { cur = b.dataset.f; draw(); Pr.stagger($$('.lr-tasks li', el)); } });
  };
  function taskLi(t, now) {
    const od = t.due != null && t.due < now;
    const bx = PrWorld.box(t.box);
    return `<li><span class="lr-cb" aria-hidden="true"></span><span class="lr-tt">${esc(L(t.t))}</span>
      <span class="lr-tm">${t.p && t.p < 4 ? `<span class="lr-p p${t.p}">P${t.p}</span>` : ''}<span class="${od ? 'od' : ''}">${esc(Pr.relDay(t.due, now))}</span><span class="pr-mono">${esc(L(bx ? bx.l : ''))}</span></span></li>`;
  }

  /* 8 · o caderno e os símbolos */
  const SYMS = ['□', '✓', '→', '✕'];
  const SYM_EFFECT = {
    '□': B('Escolhida de manhã, ainda por resolver.', 'Picked this morning, not resolved yet.'),
    '✓': B('Feita — e marcada como concluída na lista também.', 'Done — and checked off on the list too.'),
    '→': B('Continua aberta — fica na lista tal como está, só não foi hoje.', 'Still open — stays on the list as-is, just not today.'),
    '✕': B('Já não é precisa — apaga-se da lista também, ou volta a aparecer.', 'No longer needed — cleared from the list too, or it keeps resurfacing.'),
  };
  DEMOS.notebook = el => {
    const picks = PrWorld.filterTasks('due7').slice(0, 3);
    const st = picks.map(() => 0);
    const draw = () => {
      el.innerHTML = demoHead(tx('A página de hoje', "Today's page"), tx('toca num item para mudar o símbolo', 'tap an item to change its symbol')) +
        `<div class="lr-nb"><div class="lr-page"><p class="lr-page-d">${esc(Pr.fmtDay(PrWorld.clock(), 'long'))}</p><p class="lr-page-h">BIG 3</p>
        ${picks.map((t, i) => `<button type="button" class="lr-nb-it" data-i="${i}"><span class="lr-sym">${SYMS[st[i]]}</span>${esc(L(t.t))}</button>`).join('')}
        <p class="lr-page-tm">${esc(tx('Amanhã, talvez: …', 'Tomorrow, maybe: …'))}</p></div>
        <div class="lr-nb-fx"><p class="pr-kicker">${esc(tx('Na lista de tarefas', 'On the task list'))}</p>${picks.map((t, i) => `<p class="lr-fx s${st[i]}"><b>${SYMS[st[i]]}</b> ${esc(L(SYM_EFFECT[SYMS[st[i]]]))}</p>`).join('')}
        <p class="pr-sub">${esc(tx('O caderno nunca tem uma tarefa que a lista não tenha. Cada símbolo fecha, deixa ou apaga a MESMA tarefa na lista.', 'The notebook never holds a task the list does not have. Each symbol closes, leaves or clears the SAME task on the list.'))}</p></div></div>`;
    };
    draw();
    el.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; st[i] = (st[i] + 1) % 4; draw(); Pr.pop($(`[data-i="${i}"] .lr-sym`, el)); });
  };

  /* 9 · verificador de notas */
  const ACTION_VERBS = /^(ver|verificar|ligar|enviar|marcar|lembrar|comprar|falar|pedir|rever|fazer|tratar|check|call|send|book|remember|buy|ask|review|do|email|chase|insistir|schedule|update|atualizar)\b/i;
  const VAGUE = /\b(coisa|isto|aquilo|cena|thing|stuff|this|that|something|algo)\b/i;
  DEMOS.notelint = el => {
    const ex = [
      B('Falar do congelamento', 'Talk about the freeze'), B('Atlas: o ensaio da migração precisa de 4 h de congelamento (Migração da BD)', 'Atlas: cutover rehearsal needs a 4h freeze window (DB migration)'),
      B('Lembrar de ver a cache', 'Remember to check cache'), B('A Ana disse uma coisa importante sobre a BD', 'Ana said something important about the DB'),
    ];
    el.innerHTML = demoHead(tx('Esta nota resiste a três meses?', 'Will this note survive three months?')) +
      `<label class="lr-search-in lr-lint-in"><input type="text" maxlength="200" aria-label="${esc(tx('Título da nota', 'Note title'))}" placeholder="${esc(tx('Escreve uma nota numa linha…', 'Write a note in one line…'))}"></label>
      <div class="pr-row" style="margin:.5rem 0">${ex.map((x, i) => `<button type="button" class="chip" data-x="${i}">${esc(L(x).slice(0, 34))}${L(x).length > 34 ? '…' : ''}</button>`).join('')}</div>
      <ul class="lr-lint" aria-live="polite"></ul>`;
    const inp = $('input', el), out = $('.lr-lint', el);
    const run = () => {
      const s = inp.value.trim();
      if (!s) { out.innerHTML = ''; return; }
      const teamNames = PrWorld.recs('teams').map(r => PrWorld.fold(PrWorld.title('teams', r)));
      const m = s.match(/^([^:]{2,30}):\s/);
      const pref = m ? PrWorld.fold(m[1]) : '';
      const kindPrefix = /^(decis[aã]o|decision|risco|risk|ideia|idea)$/i.test(pref);
      const checks = [
        { ok: s.split(/\s+/).length >= 5 && s.length <= 140, t: tx('Uma linha com conteúdo (5+ palavras, até ~140 caracteres)', 'One line with substance (5+ words, up to ~140 characters)') },
        { ok: !!m && (teamNames.includes(pref) || kindPrefix), warn: !!m, t: m ? (teamNames.includes(pref) ? tx(`Equipa primeiro: «${m[1]}»`, `Team first: «${m[1]}»`) : kindPrefix ? tx(`Tipo primeiro: «${m[1]}» (bom para a regra de três)`, `Kind first: «${m[1]}» (good for the rule of three)`) : tx(`Prefixo «${m[1]}» não é uma equipa do mundo de exemplo`, `Prefix «${m[1]}» is not a team in the sample world`)) : tx('Sem equipa à frente — tudo bem se for transversal ou desconhecida', 'No team prefix — fine if it is cross-team or unknown') },
        { ok: !!PrWorld.projOf(s), soft: true, t: PrWorld.projOf(s) ? tx(`Nome do projeto no fim: «${PrWorld.projOf(s)}»`, `Project name last: «${PrWorld.projOf(s)}»`) : tx('Sem projeto no fim — só é preciso se a nota for sobre um projeto', 'No project at the end — only needed if the note is about a project') },
        { ok: !VAGUE.test(s), t: VAGUE.test(s) ? tx('Palavra vaga ("coisa", "isto"): daqui a três meses não vais saber o que era', 'Vague word ("thing", "this"): in three months you will not know what it was') : tx('Sem palavras vagas', 'No vague words') },
        { ok: !ACTION_VERBS.test(s.replace(/^[^:]{2,30}:\s*/, '')), t: ACTION_VERBS.test(s.replace(/^[^:]{2,30}:\s*/, '')) ? tx('Começa por um verbo de ação: isto parece uma TAREFA, não uma nota', 'Starts with an action verb: this looks like a TASK, not a note') : tx('Não é uma ação disfarçada', 'Not a disguised action') },
      ];
      out.innerHTML = checks.map(c => `<li class="${c.ok ? 'ok' : (c.soft || c.warn === false) ? 'soft' : 'no'}">${c.ok ? ICON.check : ICON.x}<span>${esc(c.t)}</span></li>`).join('');
    };
    inp.addEventListener('input', run);
    el.addEventListener('click', e => { const c = e.target.closest('[data-x]'); if (c) { inp.value = L(ex[+c.dataset.x]); run(); } });
  };

  /* 10 · as quatro categorias do PARA */
  const PARA = [
    { id: 'p', n: B('Projetos', 'Projects'), d: B('Um resultado definido com fim, ao longo de várias sessões.', 'A defined outcome with an end date, across several sessions.'), w: B('Migração da BD', 'DB migration'), s: B('Exame de Estatística', 'Statistics exam') },
    { id: 'a', n: B('Áreas', 'Areas'), d: B('Uma responsabilidade contínua, sem fim.', 'An ongoing responsibility with no end.'), w: B('Operações da equipa Atlas', 'Team Atlas operations'), s: B('Saúde', 'Health') },
    { id: 'r', n: B('Recursos', 'Resources'), d: B('Material de referência ou interesse, sem responsabilidade.', 'Reference material or an interest, no responsibility attached.'), w: B('Runbook de failover', 'Failover runbook'), s: B('Como estudo para exames', 'How I study for exams') },
    { id: 'x', n: B('Arquivo', 'Archive'), d: B('Tudo o resto — fora de vista, não apagado.', 'Everything else — out of sight, not deleted.'), w: B('Um projeto acabado, um sistema desligado', 'A finished project, a defunct system'), s: B('IRS 2026', '2026 tax return') },
  ];
  DEMOS.para4 = el => {
    const w = PrWorld.scenario() === 'work';
    el.innerHTML = `<div class="lr-para"><div class="lr-para-axis"><span>${esc(tx('mais acionável', 'most actionable'))}</span><span>${esc(tx('inativo', 'inactive'))}</span></div>
      ${PARA.map(p => `<div class="lr-para-c p-${p.id}"><b>${esc(L(p.n))}</b><p>${esc(L(p.d))}</p><code>${esc(L(w ? p.w : p.s))}</code></div>`).join('')}</div>`;
  };

  /* 11 · PARA ao longo do tempo */
  const FLOW = [
    { t: B('Correr', 'Running'), steps: [[0, 'r', B('Um interesse: artigos sobre corrida.', 'An interest: running articles.')], [3, 'p', B('Semana 3: inscreves-te nos 10 km de abril — agora há um resultado e um fim.', 'Week 3: you sign up for the April 10 km — now there is an outcome and an end.')], [10, 'x', B('Semana 10: a prova acabou. Numa base de dados, Estado = Done; a linha fica.', 'Week 10: the race is over. In a database, Status = Done; the row stays.')]] },
    { t: B('Exame de Estatística', 'Statistics exam'), steps: [[0, 'p', B('Um projeto com data: 15 de janeiro.', 'A project with a date: 15 January.')], [8, 'x', B('Semana 8: exame feito. Estado = Done.', 'Week 8: exam done. Status = Done.')]] },
    { t: B('Equipa Beacon', 'Team Beacon'), steps: [[0, 'a', B('Uma área: lideras a equipa, sem fim à vista.', 'An area: you lead the team, no end in sight.')], [6, 'x', B('Semana 6: a equipa funde-se com outra. A página da área vai para o Arquivo.', 'Week 6: the team merges into another. The area page goes to the Archive.')]] },
  ];
  DEMOS.paraflow = el => {
    el.innerHTML = demoHead(tx('O tempo a passar', 'Time passing')) +
      `<label class="lr-range"><span>${esc(tx('Semana', 'Week'))} <b data-wk>0</b></span><input type="range" min="0" max="12" value="0" aria-label="${esc(tx('Semana', 'Week'))}"></label>
      <div class="lr-pf">${PARA.map(p => `<div class="lr-pf-col p-${p.id}" data-col="${p.id}"><p class="pr-kicker">${esc(L(p.n))}</p></div>`).join('')}</div><ul class="lr-pf-log" aria-live="polite"></ul>`;
    const chips = FLOW.map((f, i) => { const c = document.createElement('div'); c.className = 'lr-pf-chip'; c.textContent = L(f.t); c.dataset.i = i; return c; });
    const at = (f, w) => f.steps.filter(s => s[0] <= w).pop();
    const draw = (w, animate) => {
      $('[data-wk]', el).textContent = w;
      chips.forEach((c, i) => {
        const s = at(FLOW[i], w); const col = $(`[data-col="${s[1]}"]`, el);
        if (c.parentNode !== col) { col.appendChild(c); if (animate) Pr.pop(c); }
      });
      $('.lr-pf-log', el).innerHTML = FLOW.map(f => `<li><b>${esc(L(f.t))}:</b> ${esc(L(at(f, w)[2]))}</li>`).join('');
    };
    $('input', el).addEventListener('input', e => draw(+e.target.value, true));
    draw(0);
  };

  /* 12 · as quatro perguntas */
  const FOURQ = [
    { q: B('Quantos itens, no total?', 'How many items, in total?'), p: B('Poucos e estáveis (até ~8–10)', 'Few and stable (up to ~8–10)'), d: B('Muitos, ou a crescer', 'Many, or growing') },
    { q: B('Têm todos a mesma "forma" (os mesmos campos)?', 'Do they all share the same "shape" (same fields)?'), p: B('Não — cada um é um mundo', 'No — each one is its own world'), d: B('Sim — as mesmas propriedades', 'Yes — the same properties') },
    { q: B('Precisas de comparar, filtrar ou ordenar vários?', 'Do you need to compare, filter or sort several?'), p: B('Não', 'No'), d: B('Sim', 'Yes') },
    { q: B('É uma estrutura que se repete muito?', 'Is it a structure that repeats often?'), p: B('Não', 'No'), d: B('Sim, e duplicá-la à mão é chato', 'Yes, and duplicating it by hand is annoying') },
  ];
  const FOURQ_EX = [
    { n: B('Runbooks (5, cada um diferente)', 'Runbooks (5, each different)'), a: ['p', 'p', 'p', 'p'] },
    { n: B('Reuniões (uma por série)', 'Meetings (one per series)'), a: ['d', 'd', 'd', 'd'] },
    { n: B('Métricas que acompanho (6)', 'Metrics I watch (6)'), a: ['p', 'd', 'p', 'p'] },
    { n: B('Decisões (a crescer)', 'Decisions (growing)'), a: ['d', 'd', 'd', 'p'] },
  ];
  DEMOS.fourq = el => {
    let a = [null, null, null, null];
    const draw = () => {
      const np = a.filter(x => x === 'p').length, nd = a.filter(x => x === 'd').length;
      const v = a.includes(null) ? null : nd >= 2 && nd > np ? 'd' : np >= 2 && np > nd ? 'p' : 'tie';
      el.innerHTML = demoHead(tx('Página ou base de dados?', 'Page or database?'), tx('responde ou escolhe um exemplo', 'answer or pick an example')) +
        `<div class="pr-row" style="margin-bottom:.7rem">${FOURQ_EX.map((x, i) => `<button type="button" class="chip" data-ex="${i}">${esc(L(x.n))}</button>`).join('')}</div>
        <ol class="lr-4q">${FOURQ.map((q, i) => `<li><p>${esc(L(q.q))}</p><div class="lr-4q-b"><button type="button" data-q="${i}" data-v="p" aria-pressed="${a[i] === 'p'}">${esc(L(q.p))}<small>${esc(tx('página', 'page'))}</small></button>
          <button type="button" data-q="${i}" data-v="d" aria-pressed="${a[i] === 'd'}">${esc(L(q.d))}<small>${esc(tx('base de dados', 'database'))}</small></button></div></li>`).join('')}</ol>
        <p class="lr-verdict ${v || ''}" aria-live="polite">${v == null ? esc(tx('Responde às quatro.', 'Answer all four.')) : v === 'd' ? `<b>${esc(tx('Base de dados', 'Database'))}</b> — ${esc(tx(`${nd} de 4 respostas apontam para uma base.`, `${nd} of 4 answers point to a database.`))}` : v === 'p' ? `<b>${esc(tx('Página', 'Page'))}</b> — ${esc(tx(`${np} de 4 respostas apontam para páginas.`, `${np} of 4 answers point to pages.`))}` : `<b>${esc(tx('Empate', 'Tie'))}</b> — ${esc(tx('fica com o que já tens; mudar de página para base mais tarde é barato.', 'keep what you have; moving from page to database later is cheap.'))}`}</p>`;
    };
    draw();
    el.addEventListener('click', e => {
      const x = e.target.closest('[data-ex]'); if (x) { a = FOURQ_EX[+x.dataset.ex].a.slice(); draw(); Pr.pop($('.lr-verdict', el)); return; }
      const b = e.target.closest('[data-q]'); if (b) { a[+b.dataset.q] = b.dataset.v; draw(); if (!a.includes(null)) Pr.pop($('.lr-verdict', el)); }
    });
  };

  /* 13 · a escada, com a contagem real das notas de decisão */
  function decisionCount() {
    return PrWorld.recs('notes').filter(r => /^(decis[aã]o|decision)\s*:/i.test(PrWorld.title('notes', r)) || (r.tags || []).includes('decision')).length;
  }
  DEMOS.ladder = el => {
    const n = decisionCount(), hasDb = !!PrWorld.schemaOf('decisions');
    const rung = hasDb ? 2 : n >= 3 ? 1 : 0;
    el.innerHTML = demoHead(tx('A escada, no mundo de exemplo', 'The ladder, in the sample world'), tx(`notas de decisão: ${n}`, `decision notes: ${n}`)) +
      `<ol class="lr-ladder">${[
        [B('Degrau 0', 'Rung 0'), B('Uma nota cujo título diz o que é: "Decisão: …"', 'A note whose title says what it is: "Decision: …"'), B('Custo zero. Sobe quando escreves a TERCEIRA.', 'Zero cost. Climb when you write the THIRD.')],
        [B('Degrau 1', 'Rung 1'), B('A etiqueta "decision" + uma vista filtrada das Notas', 'The "decision" tag + a filtered Notes view'), B('Uma etiqueta, uma vista. Sobe quando precisas de um campo que só este tipo tem (Estado, Confiança).', 'One tag, one view. Climb when you need a field only this kind has (Status, Confidence).')],
        [B('Degrau 2', 'Rung 2'), B('Uma base própria, com poucos campos', 'A dedicated database, with a few fields'), B('Uma base, um punhado de propriedades.', 'One database, a handful of properties.')],
      ].map((r, i) => `<li class="${i === rung ? 'on' : i < rung ? 'past' : ''}"><span class="pr-mono">${esc(L(r[0]))}</span><b>${esc(L(r[1]))}</b><small>${esc(L(r[2]))}</small></li>`).join('')}</ol>
      <p class="pr-sub">${esc(rung === 0 ? tx(`Há ${n} nota(s) de decisão. À terceira, a regra de três diz que é um padrão — vive uma semana no sistema e vais lá chegar.`, `There are ${n} decision note(s). At the third, the rule of three says it is a pattern — live a week in the system and you will get there.`)
        : rung === 1 ? tx('Já há três: é um padrão. Uma etiqueta e uma vista chegam até precisares de um campo próprio.', 'There are three: it is a pattern. A tag and a view are enough until you need a field of its own.')
        : tx('A base Decisões existe no mundo de exemplo.', 'The Decisions database exists in the sample world.'))}</p>
      <a class="btn btn-sm" href="#experimentar/pagina-ou-base">${esc(tx('Subir a escada no laboratório', 'Climb the ladder in the lab'))} ${ICON.arrow}</a>`;
  };

  /* 14 · seleção vs relação: renomear uma equipa */
  DEMOS.selectrel = el => {
    let renamed = false, fixed = 0;
    const dbs = [tx('Notas', 'Notes'), tx('Projetos', 'Projects'), tx('Pessoas', 'Persons'), tx('Reuniões', 'Meetings'), '1:1'];
    const draw = () => {
      const nm = renamed ? 'Atlas Platform' : 'Atlas';
      el.innerHTML = demoHead(tx('Renomear uma equipa', 'Rename a team'), tx('a mesma mudança, dois desenhos', 'the same change, two designs')) +
        `<div class="lr-sr"><div><p class="pr-kicker">${esc(tx('Seleção em cada base', 'A select in each database'))}</p><ul>${dbs.map((d, i) => `<li><span>${esc(d)}</span><code class="${renamed && i >= fixed ? 'stale' : ''}">${esc(renamed && i >= fixed ? 'Atlas' : nm)}</code></li>`).join('')}</ul>
          ${renamed && fixed < dbs.length ? `<button type="button" class="btn btn-sm" data-fix>${esc(tx(`Corrigir à mão (${dbs.length - fixed} por corrigir)`, `Fix by hand (${dbs.length - fixed} left)`))}</button>` : ''}</div>
        <div><p class="pr-kicker">${esc(tx('Relação para Equipas', 'A relation to Teams'))}</p><ul>${dbs.map(d => `<li><span>${esc(d)}</span><code>→ ${esc(nm)}</code></li>`).join('')}</ul>
          <p class="pr-sub">${esc(tx('O nome existe num só sítio. Renomear é uma edição.', 'The name lives in one place. Renaming is one edit.'))}</p></div></div>
        <button type="button" class="btn btn-sm" data-ren>${esc(renamed ? tx('Voltar a "Atlas"', 'Back to "Atlas"') : tx('Renomear "Atlas" para "Atlas Platform"', 'Rename "Atlas" to "Atlas Platform"'))}</button>`;
    };
    draw();
    el.addEventListener('click', e => {
      if (e.target.closest('[data-ren]')) { renamed = !renamed; fixed = 0; draw(); }
      else if (e.target.closest('[data-fix]')) { fixed++; draw(); }
    });
  };

  /* 15 · mini base de dados (vistas das Notas) */
  DEMOS.minidb = el => {
    const vs = (PrWorld.state().views.notes || []).filter(v => ['recent', 'noteam', 'ideas', 'review'].includes(v.id));
    let cur = vs[0] && vs[0].id;
    const draw = () => {
      const v = vs.find(x => x.id === cur); const res = PrWorld.query('notes', v);
      const teamP = PrWorld.prop('notes', 'team');
      el.innerHTML = demoHead(tx('Quatro vistas, os mesmos dados', 'Four views, the same data'), tx(`${res.total} notas na base`, `${res.total} notes in the database`)) +
        `<div class="seg" role="tablist">${vs.map(x => `<button type="button" role="tab" class="seg-btn ${x.id === cur ? 'active' : ''}" aria-selected="${x.id === cur}" data-v="${x.id}">${esc(L(x.name))}</button>`).join('')}</div>
        <p class="lr-q">${(v.filter || []).map(f => `<span class="pr-mono">${esc(PrWorld.filterText('notes', f))}</span>`).join(' <b>e</b> ') || esc(tx('Sem filtro', 'No filter'))} → <b>${res.rows.length}</b></p>
        <ul class="lr-mini">${res.rows.slice(0, 7).map(r => { const tm = PrWorld.val('notes', r, teamP); return `<li><span>${esc(PrWorld.title('notes', r))}</span><small>${tm.length ? esc(tm.map(id => PrWorld.title('teams', PrWorld.rec('teams', id))).join(', ')) : `<i>${esc(tx('sem equipa', 'no team'))}</i>`} · ${esc(Pr.relDay(r.cr, PrWorld.clock()))}</small></li>`; }).join('')}
        ${res.rows.length > 7 ? `<li class="more">+${res.rows.length - 7}</li>` : ''}</ul>
        <p class="pr-sub">${esc(L(v.why || ''))}</p>
        <a class="btn btn-sm" href="#experimentar/notion/notes/${cur}">${esc(tx('Abrir esta vista no playground', 'Open this view in the playground'))} ${ICON.arrow}</a>`;
    };
    draw();
    el.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { cur = b.dataset.v; draw(); Pr.stagger($$('.lr-mini li', el)); } });
  };

  /* 16 · a agenda da revisão semanal */
  const AGENDA = [
    [B('Tarefas', 'Tasks'), 3, B('"Próximos 7 dias". Atrasadas: fazer, reagendar ou apagar. Capacidade: mais de ~15? Empurra as menos importantes ANTES de acrescentar.', '"Due in 7 days". Overdue: do, reschedule or delete. Capacity: more than ~15? Push the least important out BEFORE adding.')],
    [B('Seguimentos', 'Follow-ups'), 2, B('"Seguimentos". Enviar os lembretes devidos, nova data, fechar o que chegou.', '"Follow-ups". Send due nudges, set the next date, close what arrived.')],
    [B('Projetos', 'Projects'), 3, B('Cada projeto "Now": atualizar o estado, pesquisar o nome na lista — há pelo menos uma tarefa aberta? Se não: próxima ação, ou On Hold / Done.', 'Each "Now" project: update status, search its name in the list — at least one open task? If not: next action, or On Hold / Done.')],
    [B('Notas novas', 'New notes'), 4, B('"Sem equipa": guardar / agir / deitar fora / graduar.', '"No team": keep / act / toss / graduate.')],
    [B('Notas antigas', 'Old notes'), 3, B('"Revisão" (30–37 dias): arquivar no sítio / deixar / arquivar.', '"Review" (30–37 days): file / leave / archive.')],
    [B('Próxima semana', 'Next week'), 3, B('Calendário + "Próximos 7 dias". UMA coisa para um bloco protegido de 30+ min, marcado.', 'Calendar + "Due in 7 days". ONE thing for a protected 30+ min focus block, booked.')],
    [B('Fechar', 'Close'), 1, B('O que estiver solto (papel, cabeça) → lista ou Notas.', 'Anything loose (paper, head) → list or Notes.')],
  ];
  DEMOS.agenda = el => {
    let bad = false;
    const draw = () => {
      const tot = AGENDA.reduce((s, a, i) => s + (!bad || i < 2 ? a[1] : 0), 0);
      el.innerHTML = demoHead(tx('A agenda', 'The agenda'), tx(`total: ${tot} min`, `total: ${tot} min`)) +
        `<label class="lr-toggle"><input type="checkbox" ${bad ? 'checked' : ''} data-bad> ${esc(tx('Semana má (versão mínima)', 'Bad week (minimum version)'))}</label>
        <ol class="lr-agenda">${AGENDA.map((a, i) => `<li class="${bad && i >= 2 ? 'off' : ''}"><span class="lr-ag-n">${i + 1}</span><div><b>${esc(L(a[0]))}</b><p>${esc(L(a[2]))}</p></div><span class="lr-ag-m"><i style="width:${a[1] * 22}px"></i>${a[1]}′</span></li>`).join('')}</ol>
        <div class="pr-row"><button type="button" class="btn btn-sm" data-copy>${esc(tx('Copiar a agenda para a descrição da tarefa', 'Copy the agenda for the task description'))}</button><a class="btn btn-sm btn-ghost" href="#aplicar/revisao">${esc(tx('Fazer a revisão', 'Run the review'))} ${ICON.arrow}</a></div>`;
    };
    draw();
    el.addEventListener('change', e => { if (e.target.matches('[data-bad]')) { bad = e.target.checked; draw(); } });
    el.addEventListener('click', async e => {
      if (!e.target.closest('[data-copy]')) return;
      const txt = tx('Revisão semanal — 20 min, telemóvel longe', 'Weekly review — 20 min, phone away') + '\n' + AGENDA.map((a, i) => `${i + 1}. ${L(a[0])} (${a[1]}): ${L(a[2])}`).join('\n') + '\n' +
        tx('Semana má: só 1 e 2 (5 min). Saltaste uma semana: não recuperes.', "Bad week: 1 and 2 only (5 min). Skipped a week: don't catch up.");
      try { await navigator.clipboard.writeText(txt); Pr.toast(tx('Agenda copiada.', 'Agenda copied.')); } catch (_) { Pr.toast(tx('Não foi possível copiar.', 'Could not copy.')); }
    });
  };

  /* 17 · o teste das bases opcionais */
  const DBT = [
    { n: B('Decisões', 'Decisions'), r: [1, 1, 1, 1], v: B('✅ Base opcional — cria-se à terceira nota "Decisão:". Mesmo formato sempre (ADR), com estado e substituição.', '✅ Optional database — created at the third "Decision:" note. Same shape every time (ADR), with status and supersession.') },
    { n: B('Riscos e dívida', 'Risks and debt'), r: [1, 1, 1, 1], v: B('✅ UMA base com um campo Tipo (Risco/Problema/Dívida), não três: partilham quase tudo.', '✅ ONE database with a Type field (Risk/Issue/Debt), not three: they share almost everything.') },
    { n: B('Radar tecnológico', 'Technology radar'), r: [1, 1, 1, 1], v: B('🟡 Condicional — só se defines direção técnica para várias equipas. É uma posição (Adopt/Trial/Assess/Hold), não um inventário.', '🟡 Conditional — only if you set technical direction across teams. A stance (Adopt/Trial/Assess/Hold), not an inventory.') },
    { n: B('SLOs', 'SLOs'), r: [1, 1, 0, 0], v: B('❌ Sem base — uma propriedade e uma secção no Catálogo de serviços. Os números vivem na monitorização.', '❌ No database — a property and a section on the Service Catalog. The numbers live in monitoring.') },
    { n: B('KPIs e métricas', 'KPIs and metrics'), r: [0, 1, 0, 0], v: B('❌ Uma página "Métricas que acompanho" com até 8 linhas. Os números vivem nos painéis.', '❌ One "Metrics I watch" page with up to 8 rows. The numbers live in dashboards.') },
    { n: B('Incidentes', 'Incidents'), r: [1, 1, 1, 0], v: B('❌ Ligar, não copiar: uma nota com a ligação ao postmortem oficial.', '❌ Link, don\'t copy: a note with a link to the official postmortem.') },
    { n: B('Runbooks', 'Runbooks'), r: [0, 0, 0, 1], v: B('❌ Páginas em Recursos — cada um tem a sua forma, e são poucos.', '❌ Pages in Resources — each has its own shape, and there are few.') },
  ];
  const TESTS = [B('Os mesmos poucos campos?', 'Same few fields?'), B('Já se repetiu (regra de três)?', 'Has it recurred (rule of three)?'), B('Um campo que só este tipo tem?', 'A field only this kind has?'), B('Os dados verdadeiros vivem AQUI (não noutra ferramenta)?', 'Does the real data live HERE (not in another tool)?')];
  DEMOS.dbtest = el => {
    let cur = 0, step = 0;
    const draw = () => {
      const c = DBT[cur]; const failAt = c.r.indexOf(0);
      const shown = failAt >= 0 ? Math.min(step, failAt + 1) : Math.min(step, 4);
      const done = shown === 4 || (failAt >= 0 && shown > failAt);
      el.innerHTML = demoHead(tx('O teste das quatro perguntas', 'The four-question test')) +
        `<div class="pr-row" style="margin-bottom:.7rem">${DBT.map((x, i) => `<button type="button" class="chip" aria-pressed="${i === cur}" data-c="${i}">${esc(L(x.n))}</button>`).join('')}</div>
        <ol class="lr-dbt">${TESTS.map((t, i) => `<li class="${i < shown ? (c.r[i] ? 'ok' : 'no') : ''}"><span>${i < shown ? (c.r[i] ? ICON.check : ICON.x) : i + 1}</span>${esc(L(t))}</li>`).join('')}</ol>
        ${done ? `<p class="lr-verdict">${esc(L(c.v))}</p>` : `<button type="button" class="btn btn-sm" data-step>${esc(step ? tx('Próxima pergunta', 'Next question') : tx('Correr o teste', 'Run the test'))}</button>`}`;
    };
    draw();
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-c]'); if (c) { cur = +c.dataset.c; step = 0; draw(); return; }
      if (e.target.closest('[data-step]')) { step++; draw(); Pr.pop($('.lr-dbt li.ok:last-of-type, .lr-dbt li.no', el)); }
    });
  };

  /* ════════════════ rota ════════════════ */
  Pr.route('aprender', (rest, el) => chapter(rest.split('/')[0], el));

  return { chapters, indexHtml, decisionCount, taskLi, DEMOS, trackOf, trackCh };
})();
