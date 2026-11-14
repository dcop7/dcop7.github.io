/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — páginas de topo (global `PrApp`)
   Home, índices das quatro áreas, gestão do mundo de exemplo, e o
   despacho de rotas para os módulos (Pr.routes).
   ══════════════════════════════════════════════════════════════════ */
const PrApp = (function () {
  'use strict';
  const { esc, L, tx, $, $$, ICON, kindTag, crumbs } = Pr;
  const B = (pt, en) => ({ pt, en });

  const AREAS = {
    aprender: { n: '01', name: B('Aprender', 'Learn'), q: B('Quero perceber', 'I want to understand'),
      d: B('O modelo das quatro espécies, o ciclo capturar → triar → rever, GTD, PARA e as bases de dados — com uma pequena demonstração em cada capítulo.',
           'The four-kinds model, the capture → triage → review loop, GTD, PARA and databases — with a small live demo in every chapter.') },
    explorar: { n: '02', name: B('Explorar', 'Explore'), q: B('Quero ver como encaixa', 'I want to see how it fits'),
      d: B('Mapas vivos do sistema: por onde passa cada coisa, como as bases de dados se ligam, e que ferramentas fazem cada papel.',
           'Live maps of the system: where each thing travels, how the databases link, and which tools play each role.') },
    experimentar: { n: '03', name: B('Experimentar', 'Experiment'), q: B('Quero mexer', 'I want to tinker'),
      d: B('Um playground de bases de dados ao estilo do Notion, um laboratório de captura e o teste "página ou base de dados".',
           'A Notion-style database playground, a capture lab and the "page or database" test.') },
    aplicar: { n: '04', name: B('Aplicar', 'Apply'), q: B('Quero praticar', 'I want to practise'),
      d: B('Uma semana inteira no sistema, a revisão semanal, exercícios de triagem e PARA, e o desenho do teu próprio sistema.',
           'A whole week in the system, the weekly review, triage and PARA drills, and the design of your own system.') },
  };

  const ENTRIES = {
    explorar: [
      { id: 'mapa', name: B('Mapa do sistema', 'System map'), core: true, kinds: ['act', 'info', 'today', 'str'],
        d: B('Segue uma coisa desde que te chama a atenção até ao sítio onde acaba — e vê o que cada lugar tem de saber fazer.', 'Follow one thing from the moment it grabs your attention to where it ends up — and see what each place must be able to do.') },
      { id: 'relacoes', name: B('Como as bases de dados se ligam', 'How the databases connect'), kinds: ['str'],
        d: B('A base central, as relações de duas vias e os rollups, desenhados ao vivo a partir do mundo de exemplo.', 'The hub database, two-way relations and rollups, drawn live from the sample world.') },
      { id: 'ferramentas', name: B('Diretório de ferramentas', 'Tool directory'), kinds: ['act', 'info', 'today', 'str'],
        d: B('22 ferramentas com o plano grátis verificado, o que cumprem para cada papel e o que fica a pagar. Fonte e data em cada afirmação.', '22 tools with a verified free plan, what they meet for each role and what stays paid. Source and date on every claim.') },
      { id: 'combinar', name: B('Combinar ferramentas', 'Combine tools'), kinds: ['act', 'info', 'today', 'str'],
        d: B('Escolhe uma ferramenta por papel e vê onde se completam, onde se pisam e que papel fica sem dono.', 'Pick one tool per role and see where they complement each other, where they overlap and which role is left uncovered.') },
    ],
    experimentar: [
      { id: 'notion', name: B('Playground de bases de dados', 'Database playground'), core: true, kinds: ['str', 'info'],
        d: B('Propriedades, filtros, ordenação, vistas, relações, rollups e modelos, com dados de exemplo realistas. As ligações entre bases ficam à vista.', 'Properties, filters, sorting, views, relations, rollups and templates, on realistic sample data. The links between databases stay visible.') },
      { id: 'captura', name: B('Laboratório de captura', 'Capture lab'), core: true, kinds: ['act', 'info'],
        d: B('Escreve uma tarefa numa linha ao estilo quick-add e vê os três filtros a mudar; escreve uma nota e vê se resiste a três meses.', 'Type a task in one quick-add line and watch the three filters change; write a note and see if it survives three months.') },
      { id: 'pagina-ou-base', name: B('Página ou base de dados?', 'Page or database?'), kinds: ['str'],
        d: B('As quatro perguntas, a escada da graduação e a regra de três — com as notas do mundo de exemplo.', 'The four questions, the graduation ladder and the rule of three — using the sample world\'s notes.') },
    ],
    aplicar: [
      { id: 'semana', name: B('Uma semana no sistema', 'A week in the system'), core: true, kinds: ['act', 'info', 'today', 'str'],
        d: B('De segunda a sexta: os Big 3 de manhã, o que chega durante o dia, o fecho à noite e a revisão de sexta. Tudo fica no mundo de exemplo.', 'Monday to Friday: the morning Big 3, what arrives during the day, the evening close and the Friday review. Everything lands in the sample world.') },
      { id: 'revisao', name: B('Revisão semanal', 'Weekly review'), core: true, kinds: ['act', 'info', 'str'],
        d: B('Os sete passos, cerca de 20 minutos, sobre o estado atual do mundo. Com o modo "semana má" de 5 minutos.', 'The seven steps, about 20 minutes, on the current state of the world. With the 5-minute "bad week" mode.') },
      { id: 'hoje', name: B('Hoje e os Big 3', 'Today and the Big 3'), kinds: ['today', 'act'],
        d: B('Ver a capacidade, escolher três coisas da lista e fechar o dia com ✓ → ✕.', 'Check capacity, pick three things from the list and close the day with ✓ → ✕.') },
      { id: 'triagem', name: B('Para onde vai isto?', 'Where does this go?'), kinds: ['act', 'info', 'today', 'str'],
        d: B('Doze coisas que te chamam a atenção. Para cada uma, o lugar certo — e porquê.', 'Twelve things that grab your attention. For each one, the right place — and why.') },
      { id: 'para', name: B('PARA na prática', 'PARA in practice'), kinds: ['str'],
        d: B('Arrumar por acionabilidade em vez de assunto, e ver as coisas mudarem de categoria com o tempo.', 'File by actionability instead of topic, and watch things change category over time.') },
      { id: 'projeto', name: B('Construir um projeto', 'Build a project'), kinds: ['str', 'act', 'info'],
        d: B('Uma linha na base Projetos, o modelo de página, a primeira ação, uma reunião e uma nota — e a pesquisa por nome que junta tudo.', 'A Projects row, the page template, the first action, a meeting and a note — and the name search that brings it all together.') },
      { id: 'sistema', name: B('Desenhar o teu sistema', 'Design your system'), kinds: ['act', 'info', 'today', 'str'],
        d: B('As tuas restrições → uma ferramenta por papel → um plano de arranque de semana 1, semana 3 e depois.', 'Your constraints → one tool per role → a start-up plan for week 1, week 3 and later.') },
    ],
  };

  const areaLabel = id => L(AREAS[id].name);
  const sameScreen = (a, b) => {
    /* o playground muda de base/vista sem saltar para o topo */
    const pa = String(a).split('/'), pb = String(b).split('/');
    return pa[0] === pb[0] && pa[1] === pb[1] && ['notion', 'ferramentas'].includes(pa[1]);
  };

  /* ── barra do mundo (reutilizada por todas as experiências que o alteram) ── */
  function worldBar(src) {
    const n = src ? PrWorld.count(src) : 0;
    const sc = PrWorld.scenario();
    return `<div class="pr-wbar" data-wbar="${esc(src || '')}">
      <div class="pr-wbar-sc" role="group" aria-label="${esc(tx('Mundo de exemplo', 'Sample world'))}">
        <span class="pr-kicker">${esc(tx('Mundo', 'World'))}</span>
        ${['work', 'study'].map(id => `<button type="button" class="chip" data-wb-sc="${id}" aria-pressed="${sc === id}">${esc(L(PrSeed[id].short))}</button>`).join('')}
      </div>
      ${src ? `<div class="pr-reset"><span class="cnt" data-wb-cnt>${esc(n === 1 ? tx('1 alteração aqui', '1 change here') : tx(`${n} alterações aqui`, `${n} changes here`))}</span>
        <button type="button" class="btn btn-sm" data-wb-reset="${esc(src)}" ${n ? '' : 'disabled'}>${ICON.reset}${esc(tx('Repor esta experiência', 'Reset this experiment'))}</button></div>` : ''}
      <a class="pr-wbar-link" href="#mundo">${esc(tx('Gerir o mundo de exemplo', 'Manage the sample world'))}</a>
    </div>`;
  }
  function syncWorldBars() {
    $$('[data-wbar]').forEach(el => {
      const src = el.dataset.wbar; if (!src) return;
      const n = PrWorld.count(src);
      const c = $('[data-wb-cnt]', el); if (c) c.textContent = n === 1 ? tx('1 alteração aqui', '1 change here') : tx(`${n} alterações aqui`, `${n} changes here`);
      const b = $('[data-wb-reset]', el); if (b) b.disabled = !n;
    });
  }
  document.addEventListener('click', e => {
    const sc = e.target.closest('[data-wb-sc]');
    if (sc) { PrWorld.setScenario(sc.dataset.wbSc); Pr.toast(tx('Mundo: ', 'World: ') + L(PrSeed[sc.dataset.wbSc].label)); return; }
    const rs = e.target.closest('[data-wb-reset]');
    if (rs) {
      const src = rs.dataset.wbReset;
      PrWorld.resetSrc(src);
      Pr.toast(tx('Experiência reposta. O resto do mundo ficou como estava.', 'Experiment reset. The rest of the world stayed as it was.'));
      return;
    }
    const ra = e.target.closest('[data-reset-all]');
    if (ra) { PrWorld.resetAll(); Pr.toast(tx('O mundo de exemplo voltou ao estado original.', 'The sample world is back to its original state.')); }
  });
  document.addEventListener('pr:world', e => {
    if (e.detail && e.detail.reset) { PrNav.refresh(); return; }
    syncWorldBars();
  });

  /* ═════════════ home ═════════════ */
  const ROUTER_EX = [
    { s: B('“Verificar se o teste de recuo passou em staging”', '“Verify the rollback test passed in staging”'), k: 'act', why: B('Começa por um verbo e alguém fica à espera do resultado: é uma ação, vai para a lista de tarefas.', 'It starts with a verb and someone is waiting for the result: an action, it goes to the task list.') },
    { s: B('A Ana diz que o atraso de replicação dispara no fim do mês', 'Ana says replication lag spikes at month-end'), k: 'info', why: B('Ouviste um facto. Não há nada para fazer já: uma linha na caixa de Notas, triada na sexta.', 'You heard a fact. Nothing to do right now: one line in the Notes inbox, triaged on Friday.') },
    { s: B('“Hoje tenho mesmo de acabar o runbook”', '“Today I really must finish the runbook”'), k: 'today', why: B('A tarefa já existe. Isto é escolher o foco do dia: um dos Big 3 do caderno.', 'The task already exists. This is choosing the day\'s focus: one of the notebook Big 3.') },
    { s: B('Uma iniciativa nova: reduzir 20% o custo da cloud até junho', 'A new initiative: cut cloud cost by 20% by June'), k: 'str', why: B('Tem resultado, fim e várias sessões: uma linha na base Projetos, ligada à equipa.', 'It has an outcome, an end and several sessions: a row in the Projects database, linked to the team.') },
    { s: B('O teste-t entra no exame, a ANOVA não', 'The t-test is in the exam, ANOVA is not'), k: 'info', why: B('Uma coisa que aprendeste e vais querer encontrar: Notas, com o nome do projeto no fim.', 'Something you learned and will want to find: Notes, with the project name at the end.') },
    { s: B('Ler o rascunho da Inês até quarta', "Read Inês's draft by Wednesday"), k: 'act', why: B('Verbo + prazo real: tarefa com data, em #Projetos.', 'Verb + a real deadline: a dated task in #Projects.') },
  ];
  let _routerT = 0, _routerI = 0, _routerUser = false;

  function home(el) {
    PrShell.setArea(null);
    const K = Pr.KINDS;
    el.innerHTML = `
    <section class="pr-hero">
      <div class="pr-wrap pr-hero-grid">
        <div>
          <p class="pr-kicker">${esc(tx('Capturar · Triar · Rever', 'Capture · Triage · Review'))}</p>
          <h1>${tx('Um sistema em que <em>confias</em>, não mais uma app.', 'A system you <em>trust</em>, not another app.')}</h1>
          <p class="lede">${esc(tx('Tudo o que te pede atenção é uma de quatro coisas. Cada uma tem um lugar e cada lugar tem um só trabalho. Aqui aprendes o modelo, vês como as peças se ligam, mexes numa base de dados a sério e montas o teu — sem contas, também offline.',
            'Everything that asks for your attention is one of four kinds. Each kind gets one place, and each place has one job. Here you learn the model, see how the parts connect, work with a real database and build your own — no accounts, offline too.'))}</p>
          <div class="pr-hero-cta">
            <a class="btn btn-primary" href="#aprender/quatro">${esc(tx('Começar pelo modelo', 'Start with the model'))}</a>
            <a class="btn" href="#aplicar/semana">${esc(tx('Viver uma semana no sistema', 'Live a week in the system'))}</a>
            <a class="btn btn-ghost" href="#experimentar/notion">${esc(tx('Abrir o playground', 'Open the playground'))} ${ICON.arrow}</a>
          </div>
        </div>
        <div class="pr-hero-art">
          <div class="pr-sheet pr-router" aria-live="polite">
            <div class="k-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <p class="pr-kicker" style="margin:.8rem 0 .5rem">${esc(tx('Chegou isto:', 'This just arrived:'))}</p>
            <div class="pr-router-in" data-router-in></div>
            <p class="pr-router-q">${esc(tx('Que espécie de coisa é? Toca para responder, ou espera.', 'What kind of thing is it? Tap to answer, or wait.'))}</p>
            <div class="pr-router-boxes">
              ${Object.keys(K).map(k => `<button type="button" class="pr-router-box ${K[k].cls}" data-router-k="${k}"><b>${esc(L(K[k].name))}</b><small>${esc(L(K[k].place))}</small></button>`).join('')}
            </div>
            <p class="pr-router-why" data-router-why></p>
          </div>
        </div>
      </div>
    </section>
    <div class="pr-wrap"><nav class="pr-areas" aria-label="${esc(tx('Áreas', 'Areas'))}">
      ${Object.keys(AREAS).map(id => {
        const a = AREAS[id];
        const ent = id === 'aprender' ? (typeof PrLearn !== 'undefined' ? PrLearn.chapters().slice(0, 3).map(c => L(c.title)) : []) : (ENTRIES[id] || []).slice(0, 3).map(e => L(e.name));
        return `<a class="pr-area" href="#${id}"><span class="pr-kicker">${a.n} — ${esc(L(a.name))}</span><h3>${esc(L(a.q))}</h3><p>${esc(L(a.d))}</p>
          <ul>${ent.map(x => `<li>${esc(x)}</li>`).join('')}</ul><span class="go">${esc(tx('Entrar', 'Enter'))} →</span></a>`;
      }).join('')}
    </nav></div>
    <section class="pr-wrap pr-section">
      <div class="pr-start">
        <div>
          <p class="pr-kicker">${esc(tx('O ciclo', 'The loop'))}</p>
          <h2 class="pr-h2">${esc(tx('Capturar em segundos. Arrumar uma vez por semana.', 'Capture in seconds. Sort once a week.'))}</h2>
          <p class="pr-sub" style="max-width:56ch">${esc(tx('Capturar não exige decidir onde a coisa vive. Essa decisão acontece em lote, na revisão semanal — cerca de 20 minutos com uma agenda fixa. É a revisão que impede as caixas de entrada de virarem cemitérios.',
            'Capturing does not require deciding where a thing lives. That decision happens in batch, at the weekly review — about 20 minutes with a fixed agenda. The review is what keeps every inbox from becoming a graveyard.'))}</p>
          ${loopSvg()}
        </div>
        <div>
          <p class="pr-kicker">${esc(tx('Um caminho para começar', 'A path to start'))}</p>
          <ol class="pr-steps">
            <li><b><a href="#aprender/quatro">${esc(tx('Quatro espécies, quatro lugares', 'Four kinds, four places'))}</a></b><p>${esc(tx('O modelo inteiro em cinco minutos.', 'The whole model in five minutes.'))}</p></li>
            <li><b><a href="#aplicar/semana">${esc(tx('Uma semana no sistema', 'A week in the system'))}</a></b><p>${esc(tx('Capturar, escolher o foco, fechar o dia e rever — com consequências.', 'Capture, pick the focus, close the day and review — with consequences.'))}</p></li>
            <li><b><a href="#experimentar/notion">${esc(tx('O playground de bases de dados', 'The database playground'))}</a></b><p>${esc(tx('Vê o que a semana deixou: notas por equipa, relações, rollups.', 'See what the week left behind: notes by team, relations, rollups.'))}</p></li>
            <li><b><a href="#aplicar/sistema">${esc(tx('Desenhar o teu sistema', 'Design your system'))}</a></b><p>${esc(tx('Uma ferramenta por papel e um plano para a semana 1.', 'One tool per role and a plan for week 1.'))}</p></li>
          </ol>
        </div>
      </div>
    </section>
    <section class="pr-wrap pr-section">
      <p class="pr-kicker">${esc(tx('O mundo de exemplo', 'The sample world'))}</p>
      <h2 class="pr-h2">${esc(tx('Dois cenários, a mesma estrutura', 'Two scenarios, the same structure'))}</h2>
      <p class="pr-sub" style="max-width:64ch;margin-bottom:1rem">${esc(tx('O exemplo principal é o do documento de referência: alguém que lidera três equipas, com projetos, pessoas e reuniões. O segundo é uma estudante com um part-time. Muda de cenário quando quiseres — cada um guarda as suas alterações.',
        "The main example is the reference document's: someone who leads three teams, with projects, people and meetings. The second is a student with a part-time job. Switch whenever you like — each one keeps its own changes."))}</p>
      ${worldBar(null)}
    </section>`;
    startRouter(el);
  }

  function loopSvg() {
    return `<svg class="pr-loop" viewBox="0 0 520 210" role="img" aria-label="${esc(tx('Ação → lista de tarefas; nota → caixa de notas; ambas → revisão semanal → agir, arquivar no sítio, graduar, deixar, arquivar', 'Action → task list; note → notes inbox; both → weekly review → act, file, graduate, leave, archive'))}">
      <defs><marker id="pr-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
      <g font-family="Inter, sans-serif" font-size="12" fill="currentColor">
        <rect x="6" y="22" width="120" height="44" rx="6" class="lp-act"/><text x="66" y="41" text-anchor="middle" font-weight="700">${esc(tx('Capturar ação', 'Capture action'))}</text><text x="66" y="57" text-anchor="middle" class="lp-dim">${esc(tx('segundos', 'seconds'))}</text>
        <rect x="6" y="140" width="120" height="44" rx="6" class="lp-info"/><text x="66" y="159" text-anchor="middle" font-weight="700">${esc(tx('Capturar nota', 'Capture note'))}</text><text x="66" y="175" text-anchor="middle" class="lp-dim">${esc(tx('uma linha', 'one line'))}</text>
        <rect x="190" y="80" width="140" height="50" rx="6" class="lp-rev"/><text x="260" y="101" text-anchor="middle" font-weight="700">${esc(tx('Revisão semanal', 'Weekly review'))}</text><text x="260" y="118" text-anchor="middle" class="lp-dim">~20 min</text>
        <path d="M126 44 C160 44 160 98 186 100" class="lp-line" marker-end="url(#pr-ah)"/>
        <path d="M126 162 C160 162 160 112 186 110" class="lp-line" marker-end="url(#pr-ah)"/>
        ${[[tx('Agir', 'Act'), 20, 'lp-act'], [tx('Arquivar no sítio', 'File'), 62, 'lp-str'], [tx('Graduar', 'Graduate'), 104, 'lp-str'], [tx('Deixar', 'Keep / leave'), 146, 'lp-info'], [tx('Arquivar / deitar fora', 'Archive / toss'), 188, 'lp-out']].map(([l, y, c]) =>
          `<path d="M330 105 C360 105 360 ${y - 4} 388 ${y - 4}" class="lp-line" marker-end="url(#pr-ah)"/><text x="394" y="${y}" class="${c}-t" font-weight="600">${esc(l)}</text>`).join('')}
        <circle r="5" class="lp-dot"><animateMotion dur="5s" repeatCount="indefinite" path="M66 66 C66 90 160 98 260 105 C360 105 360 58 388 58"/></circle>
      </g></svg>`;
  }

  function startRouter(el) {
    clearInterval(_routerT); _routerUser = false;
    const box = $('[data-router-in]', el); if (!box) return;
    const show = (i) => {
      _routerI = (i + ROUTER_EX.length) % ROUTER_EX.length;
      const ex = ROUTER_EX[_routerI];
      $$('.pr-router-box', el).forEach(b => b.classList.remove('hit'));
      $('[data-router-why]', el).textContent = '';
      typeIn(box, L(ex.s));
    };
    const reveal = (pick) => {
      const ex = ROUTER_EX[_routerI];
      const right = $(`[data-router-k="${ex.k}"]`, el);
      right.classList.add('hit');
      const why = $('[data-router-why]', el);
      const ok = pick == null || pick === ex.k;
      why.innerHTML = (pick == null ? '' : `<b>${esc(ok ? tx('Certo. ', 'Right. ') : tx('Quase. ', 'Not quite. '))}</b>`) + esc(L(ex.why));
      Pr.pop(right);
    };
    $$('[data-router-k]', el).forEach(b => b.addEventListener('click', () => {
      _routerUser = true; clearInterval(_routerT);
      if ($('.pr-router-box.hit', el)) { show(_routerI + 1); return; }
      reveal(b.dataset.routerK);
    }));
    show(0);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let phase = 0;
    _routerT = setInterval(() => {
      if (!document.body.contains(box)) { clearInterval(_routerT); return; }
      if (_routerUser) return;
      if (phase === 0) { reveal(null); phase = 1; } else { show(_routerI + 1); phase = 0; }
    }, 3400);
  }
  function typeIn(box, text) {
    box.innerHTML = '<span data-tt></span><span class="caret" aria-hidden="true"></span>';
    const tt = box.firstChild;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { tt.textContent = text; return; }
    let i = 0; const step = () => { if (!document.body.contains(tt)) return; tt.textContent = text.slice(0, i); if (i++ < text.length) setTimeout(step, 14); };
    step();
  }

  /* ═════════════ índices das áreas ═════════════ */
  function kindsMeta(kinds) { return (kinds || []).map(k => kindTag(k)).join(''); }
  function areaIndex(id, el) {
    const a = AREAS[id];
    PrShell.setArea(id, L(a.name));
    let list = '';
    if (id === 'aprender') list = typeof PrLearn !== 'undefined' ? PrLearn.indexHtml() : '';
    else list = `<ol class="pr-index">${ENTRIES[id].map((e, i) => `<li><a href="#${id}/${e.id}"><span class="n">${String(i + 1).padStart(2, '0')}</span><b>${esc(L(e.name))}</b>
      <span class="meta">${e.core ? `<span class="core">${esc(tx('essencial', 'core'))}</span>` : ''}${kindsMeta(e.kinds)}</span><p>${esc(L(e.d))}</p></a></li>`).join('')}</ol>`;
    el.innerHTML = `<div class="pr-wrap pr-page">
      <header class="pr-head"><p class="pr-kicker">${a.n} — ${esc(L(a.name))}</p><h1>${esc(L(a.q))}</h1><p class="lede">${esc(L(a.d))}</p></header>
      ${list}
      ${id !== 'aprender' ? `<div class="pr-section">${worldBar(null)}</div>` : ''}
    </div>`;
  }

  /* ═════════════ gerir o mundo ═════════════ */
  function worldPage(el) {
    PrShell.setArea(null, tx('Mundo de exemplo', 'Sample world'));
    const used = PrWorld.sourcesUsed();
    const st = PrWorld.state();
    const nRec = st.dbs.reduce((s, db) => s + PrWorld.recs(db).length, 0);
    el.innerHTML = `<div class="pr-wrap pr-page" style="max-width:860px">
      ${crumbs([{ label: 'DCOP7 Productivity', href: '#' }, { label: tx('Mundo de exemplo', 'Sample world') }])}
      <header class="pr-head"><p class="pr-kicker">${esc(tx('Partilhado por todas as experiências', 'Shared by every experiment'))}</p><h1>${esc(tx('O mundo de exemplo', 'The sample world'))}</h1>
        <p class="lede">${esc(tx('As experiências que mexem em dados usam todas o mesmo mundo: o que fazes numa vê-se nas outras. Cada alteração fica registada com a experiência que a fez, por isso podes desfazer só uma experiência, ou voltar tudo ao início.',
          'The experiments that change data all share one world: what you do in one shows up in the others. Every change is recorded with the experiment that made it, so you can undo just one experiment, or take everything back to the start.'))}</p></header>
      ${worldBar(null)}
      <div class="pr-section">
        <h2 class="pr-h3">${esc(L(PrSeed[PrWorld.scenario()].label))}</h2>
        <p class="pr-sub">${esc(tx(`${st.dbs.length} bases de dados · ${nRec} registos · ${PrWorld.tasks().length} tarefas abertas · relógio: ${Pr.fmtDay(st.clock, 'long')}`,
          `${st.dbs.length} databases · ${nRec} records · ${PrWorld.tasks().length} open tasks · clock: ${Pr.fmtDay(st.clock, 'long')}`))}</p>
        <table class="pr-table" style="margin-top:1rem"><thead><tr><th>${esc(tx('Experiência', 'Experiment'))}</th><th>${esc(tx('Alterações', 'Changes'))}</th><th></th></tr></thead><tbody>
        ${Object.keys(PrWorld.SOURCES).map(k => { const s = PrWorld.SOURCES[k], n = PrWorld.count(k);
          return `<tr><td><a href="${s.href}">${esc(L(s))}</a></td><td class="pr-mono">${n}</td><td style="text-align:right"><button type="button" class="btn btn-sm" data-wb-reset="${k}" ${n ? '' : 'disabled'}>${ICON.reset}${esc(tx('Repor', 'Reset'))}</button></td></tr>`; }).join('')}
        </tbody></table>
        <div class="pr-row" style="margin-top:1.2rem"><button type="button" class="btn btn-danger" data-reset-all ${used.length ? '' : 'disabled'}>${ICON.reset}${esc(tx('Repor o mundo inteiro', 'Reset the whole world'))}</button>
          <span class="pr-sub">${esc(tx('Só afeta o cenário aberto. O outro guarda as suas alterações.', 'Only affects the open scenario. The other one keeps its changes.'))}</span></div>
        <p class="pr-sub" style="margin-top:1.4rem">${esc(tx('Nota: se uma experiência alterou algo que outra criou (por exemplo, triaste na revisão uma nota capturada na semana guiada), repor a que criou leva também essa alteração.',
          'Note: if one experiment changed something another created (say, you triaged in the review a note captured in the guided week), resetting the one that created it takes that change with it.'))}</p>
      </div>
      ${Pr.localNote()}
    </div>`;
  }

  /* ═════════════ despacho ═════════════ */
  let _last = null;
  function show(route, opt) {
    const el = document.getElementById('pr-view'); if (!el) return;
    const r = route || '';
    const parts = r.split('/');
    const top = parts[0];
    try {
      if (!r) home(el);
      else if (r === 'mundo') worldPage(el);
      else if (AREAS[top] && parts.length === 1) areaIndex(top, el);
      else if (Pr.routes[top + '/' + parts[1]]) {
        PrShell.setArea(top, areaLabel(top));
        Pr.routes[top + '/' + parts[1]](parts.slice(2).join('/'), el, { how: opt && opt.how, prev: _last });
      } else if (Pr.routes[top]) {
        PrShell.setArea(top, areaLabel(top));
        Pr.routes[top](parts.slice(1).join('/'), el, { how: opt && opt.how, prev: _last });
      } else notFound(el, r);
    } catch (err) {
      console.error('[productivity]', err);
      el.innerHTML = `<div class="pr-wrap pr-page"><div class="empty-state"><p class="es-title">${esc(tx('Algo correu mal ao desenhar esta página.', 'Something went wrong drawing this page.'))}</p>
        <p class="es-hint">${esc(String(err && err.message || err))}</p><a class="btn" href="#">${esc(tx('Voltar ao início', 'Back to the start'))}</a></div></div>`;
    }
    _last = r;
    if (!opt || opt.how !== 'refresh') {
      const main = document.getElementById('main');
      if (opt && opt.how === 'push' && main && document.activeElement && !el.contains(document.activeElement)) main.focus({ preventScroll: true });
    }
  }
  function notFound(el, r) {
    PrShell.setArea(null);
    el.innerHTML = `<div class="pr-wrap pr-page"><div class="empty-state"><p class="es-title">${esc(tx('Esta página não existe.', 'This page does not exist.'))}</p>
      <p class="es-hint pr-mono">#${esc(r)}</p><a class="btn" href="#">${esc(tx('Voltar ao início', 'Back to the start'))}</a></div></div>`;
  }

  return { show, sameScreen, worldBar, AREAS, ENTRIES };
})();
