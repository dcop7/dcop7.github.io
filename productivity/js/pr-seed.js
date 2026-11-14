/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — o mundo de exemplo (sementes)
   ──────────────────────────────────────────────────────────────────
   Dois cenários com a MESMA estrutura (é essa a lição: os princípios
   não dependem do contexto):

   • work  — o mundo do documento de referência: uma pessoa que lidera
             várias equipas (Atlas, Beacon, Cobalt + "Toda a organização"),
             as pessoas, os projetos, as reuniões e as relações entre eles.
   • study — um cenário mais pequeno de estudos e vida pessoal: as
             "equipas" passam a ser Áreas (Estudos, Casa, Saúde, Finanças).

   Tudo é fictício. Datas = dias simulados (0 = segunda, 26 out 2026).
   O relógio arranca na segunda de manhã (dia 0): a caixa "Sem equipa"
   tem o que entrou desde a última revisão (sexta, dia −3).

   Esquema: cada base de dados declara as propriedades. Relações guardam-se
   num só lado (`rel.db`); o lado de volta (`back`) é calculado — é assim
   que uma relação de duas vias aparece "sozinha" na outra base.
   ══════════════════════════════════════════════════════════════════ */
const PrSeed = (function () {
  'use strict';
  const B = (pt, en) => ({ pt, en });
  const O = (id, pt, en, c) => ({ id, l: B(pt, en), c });

  /* ── opções partilhadas ── */
  const STATUS = [O('now', 'Now', 'Now', 'blue'), O('next', 'Next', 'Next', 'purple'), O('later', 'Later', 'Later', 'gray'), O('hold', 'On Hold', 'On Hold', 'orange'), O('done', 'Done', 'Done', 'green')];
  const PRIO = [O('p1', 'P1', 'P1', 'red'), O('p2', 'P2', 'P2', 'orange'), O('p3', 'P3', 'P3', 'yellow')];
  const RISK = [O('g', '🟢', '🟢', 'green'), O('o', '🟠', '🟠', 'orange'), O('r', '🔴', '🔴', 'red')];

  function schema(hub) {
    /* hub = nome da base central (Teams / Áreas) e da propriedade que liga a ela */
    const H = hub.prop;
    return {
      teams: {
        name: hub.db, icon: '👥', fav: true, folder: 'areas',
        q: hub.q,
        props: [
          { id: 'name', type: 'title', name: B('Nome', 'Name') },
          { id: 'full', type: 'text', name: B('Nome completo', 'Full name') },
          { id: 'tnote', type: 'text', name: B('Notas (1 linha)', 'Notes (1 line)') },
          { id: 'b_notes', type: 'rel', back: { db: 'notes', via: 'team' }, name: B('Notas', 'Notes') },
          { id: 'b_projects', type: 'rel', back: { db: 'projects', via: 'team' }, name: B('Projetos', 'Projects') },
          { id: 'b_persons', type: 'rel', back: { db: 'persons', via: 'team' }, name: hub.persons },
          { id: 'b_meet', type: 'rel', back: { db: 'meetings', via: 'team' }, name: hub.meetings },
          { id: 'r_live', type: 'rollup', name: B('Notas vivas', 'Live notes'), roll: { rel: 'b_notes', prop: 'archived', fn: 'unchecked' },
            q: B('Quantas notas ainda vivas há desta ' + hub.oneLower.pt + '?', 'How many live notes does this ' + hub.oneLower.en + ' have?') },
        ],
      },
      notes: {
        name: B('Notas', 'Notes'), icon: '📝', fav: true, folder: 'areas',
        q: B('O que ouvi, decidi ou aprendi — e onde está?', 'What did I hear, decide or learn — and where is it?'),
        props: [
          { id: 'name', type: 'title', name: B('Nome', 'Name') },
          { id: 'team', type: 'rel', rel: { db: 'teams', two: true, back: 'b_notes' }, name: H },
          { id: 'tags', type: 'multi', name: B('Etiquetas', 'Tags'), opts: [
            O('decision', 'decision', 'decision', 'purple'), O('risk', 'risk', 'risk', 'red'), O('debt', 'debt', 'debt', 'orange'), O('idea', 'idea', 'idea', 'yellow'),
            O('metric', 'metric', 'metric', 'blue'), O('vendor', 'vendor', 'vendor', 'brown'), O('process', 'process', 'process', 'green'), O('system', 'system', 'system', 'gray'), O('planning', 'planning', 'planning', 'pink')] },
          { id: 'archived', type: 'check', name: B('Arquivada', 'Archived') },
          { id: 'cr', type: 'created', name: B('Criada', 'Created time') },
        ],
      },
      projects: {
        name: B('Projetos', 'Projects'), icon: '🗂️', fav: true, folder: 'top',
        q: B('Que iniciativas com fim estão em curso, e em que estado?', 'Which initiatives with an end are running, and in what state?'),
        template: 'project',
        props: [
          { id: 'name', type: 'title', name: B('Nome', 'Name') },
          { id: 'status', type: 'select', name: B('Estado', 'Status'), opts: STATUS },
          { id: 'prio', type: 'select', name: B('Prioridade', 'Priority'), opts: PRIO },
          { id: 'target', type: 'text', name: B('Alvo', 'Target') },
          { id: 'risk', type: 'select', name: B('Risco', 'Risk'), opts: RISK },
          { id: 'team', type: 'rel', multi: true, rel: { db: 'teams', two: true, back: 'b_projects' }, name: H },
          { id: 'b_meetings', type: 'rel', back: { db: 'meetings', via: 'project' }, name: hub.meetings },
          { id: 'tracker', type: 'url', name: B('Tracker', 'Tracker') },
          { id: 'cr', type: 'created', name: B('Criado', 'Created time') },
        ],
      },
      persons: {
        name: hub.persons, icon: '🧑', fav: false, folder: 'people',
        q: B('Quem é quem, e quando falámos pela última vez?', 'Who is who, and when did we last talk?'),
        props: [
          { id: 'name', type: 'title', name: B('Nome', 'Name') },
          { id: 'team', type: 'rel', rel: { db: 'teams', two: true, back: 'b_persons' }, name: H },
          { id: 'role', type: 'text', name: B('Função', 'Role') },
        ].concat(hub.oneOnOne ? [
          { id: 'b_11', type: 'rel', back: { db: 'oneonones', via: 'person' }, name: B('1:1', '1:1') },
          { id: 'r_last', type: 'rollup', name: B('Último 1:1', 'Last 1:1'), roll: { rel: 'b_11', prop: 'ed', fn: 'latest' },
            q: B('Há quanto tempo não tenho um 1:1 com esta pessoa?', 'How long since my last 1:1 with this person?') },
        ] : []),
      },
      meetings: {
        name: hub.meetings, icon: '📅', fav: true, folder: 'areas',
        q: B('O que se disse em cada reunião (uma página por série)?', 'What was said in each meeting (one page per series)?'),
        props: [
          { id: 'name', type: 'title', name: B('Nome', 'Name') },
          { id: 'type', type: 'select', name: B('Tipo', 'Type'), opts: [O('rec', 'Recorrente', 'Recurring', 'blue'), O('od', 'Pontual', 'On Demand', 'gray')] },
          { id: 'project', type: 'rel', rel: { db: 'projects', two: true, back: 'b_meetings' }, name: B('Projeto', 'Project') },
          { id: 'team', type: 'rel', multi: true, rel: { db: 'teams', two: true, back: 'b_meet' }, name: H },
          { id: 'ed', type: 'edited', name: B('Última edição', 'Last edited time') },
        ],
      },
    };
  }

  function oneOnOneSchema() {
    return {
      name: B('1:1', '1:1 Meetings'), icon: '🤝', fav: true, folder: 'people',
      q: B('O que combinei com cada pessoa (uma página por pessoa)?', 'What did I agree with each person (one page per person)?'),
      props: [
        { id: 'name', type: 'title', name: B('Pessoa', 'Person') },
        { id: 'person', type: 'rel', rel: { db: 'persons', two: true, back: 'b_11' }, name: B('Ficha da pessoa', 'Person record'),
          note: B('Ligação acrescentada aqui: o documento de referência pede um rollup "Último 1:1" em Pessoas, mas não define a relação de que ele precisa.',
                  'Link added here: the reference document asks for a "Last 1:1" rollup on Persons but never defines the relation it needs.') },
        { id: 'team', type: 'rel', rel: { db: 'teams', two: false }, name: B('Equipa', 'Team') },
        { id: 'ed', type: 'edited', name: B('Última edição', 'Last edited time') },
      ],
    };
  }

  /* Decisões: base OPCIONAL — só aparece quando passa o teste (Parte 9) */
  const OPTIONAL = {
    decisions: {
      name: B('Decisões', 'Decisions'), icon: '⚖️', fav: false, folder: 'areas', template: 'adr',
      q: B('O que decidimos sobre X, porquê, e ainda vale?', 'What did we decide about X, why, and is it still valid?'),
      props: [
        { id: 'name', type: 'title', name: B('Nome', 'Name') },
        { id: 'dstatus', type: 'select', name: B('Estado', 'Status'), opts: [O('prop', 'Proposta', 'Proposed', 'gray'), O('acc', 'Aceite', 'Accepted', 'green'), O('sup', 'Substituída', 'Superseded', 'orange'), O('rej', 'Rejeitada', 'Rejected', 'red')] },
        { id: 'team', type: 'rel', multi: true, rel: { db: 'teams', two: false }, name: B('Equipa', 'Team') },
        { id: 'conf', type: 'select', name: B('Confiança', 'Confidence'), opts: [O('hi', 'Alta', 'High', 'green'), O('md', 'Média', 'Medium', 'yellow'), O('lo', 'Baixa', 'Low', 'red')] },
        { id: 'cr', type: 'created', name: B('Criada', 'Created time') },
      ],
      views: [
        { id: 'active', name: B('Ativas', 'Active'), layout: 'table', filter: [{ p: 'dstatus', op: 'is_not', v: 'sup' }, { p: 'dstatus', op: 'is_not', v: 'rej' }], sort: [] },
        { id: 'lowconf', name: B('Baixa confiança', 'Low confidence'), layout: 'table', filter: [{ p: 'conf', op: 'is', v: 'lo' }], sort: [] },
        { id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [{ p: 'cr', dir: 'desc' }] },
      ],
    },
  };

  /* modelos de página (corpo) */
  const TEMPLATES = {
    project: { name: B('Modelo de projeto', 'Project template'), body: [
      { k: 'h', t: B('Objetivo', 'Objective') }, { k: 'p', t: B('Uma ou duas frases. O que é verdade quando isto estiver feito?', 'One or two sentences. What is true when this is done?'), ph: true },
      { k: 'h', t: B('Contexto', 'Context') }, { k: 'p', t: B('Porquê agora, quem está envolvido, de que depende.', 'Why now, who is involved, what it depends on.'), ph: true },
      { k: 'h', t: B('Pressupostos', 'Assumptions') }, { k: 'p', t: B('O que damos por certo, e como o confirmar.', 'What we take on faith, and how to check it.'), ph: true },
      { k: 'h', t: B('Plano', 'Plan') }, { k: 'p', t: B('Fases em texto simples — sem caixas de verificação. O próximo passo vai para a lista de tarefas só quando for mesmo o próximo.', 'Phases as plain text — no checkboxes. The next step goes to the task list only when it is actually next.'), ph: true },
      { k: 'h', t: B('Decisões', 'Decisions') }, { k: 'p', t: B('Linhas datadas — 24 out: escolhemos X em vez de Y porque Z.', 'Dated lines — 24 Oct: chose X over Y because Z.'), ph: true },
      { k: 'h', t: B('Ligações', 'Links') }, { k: 'p', t: B('Tracker, documentos, painéis.', 'Tracker, documents, dashboards.'), ph: true },
    ] },
    adr: { name: B('Registo de decisão (ADR)', 'Decision record (ADR)'), body: [
      { k: 'h', t: B('Contexto', 'Context') }, { k: 'p', t: B('O que obriga a decidir agora?', 'What forces this decision now?'), ph: true },
      { k: 'h', t: B('Decisão', 'Decision') }, { k: 'p', t: B('O que vamos fazer? Um parágrafo.', 'What are we doing? One paragraph.'), ph: true },
      { k: 'h', t: B('Consequências', 'Consequences') }, { k: 'p', t: B('O que fica mais fácil? O que fica mais difícil?', 'What gets easier? What gets harder?'), ph: true },
      { k: 'h', t: B('Rever quando', 'Revisit when') }, { k: 'p', t: B('Que mudança de contexto reabriria isto?', 'What change in context would reopen this?'), ph: true },
    ] },
    team: { name: B('Página de equipa com vistas', 'Team page with views'), body: [
      { k: 'h', t: B('Como esta equipa trabalha', 'How this team works') }, { k: 'p', t: B('Prioridades, rituais, contactos.', 'Priorities, rituals, contacts.'), ph: true },
      { k: 'views', t: B('Vistas ligadas, filtradas por esta página', 'Linked views, filtered to this page') },
    ] },
  };

  /* vistas guardadas (Parte 3 e Parte 8 do documento) */
  function views(hub) {
    return {
      notes: [
        { id: 'recent', name: B('Recentes', 'Recent'), layout: 'table', filter: [{ p: 'cr', op: 'past', v: 30 }, { p: 'archived', op: 'unchecked' }], sort: [{ p: 'cr', dir: 'desc' }], hide: [], def: true,
          why: B('A vista do dia a dia: só o último mês, sem arquivadas. Nunca abrir milhares de linhas sem filtro.', 'The everyday view: only the last month, no archived notes. Never open thousands of unfiltered rows.') },
        { id: 'noteam', name: B('Sem ' + hub.oneLower.pt, 'No ' + hub.oneLower.en), layout: 'table', filter: [{ p: 'team', op: 'empty' }], sort: [{ p: 'cr', dir: 'asc' }], hide: [],
          why: B('A caixa de triagem de sexta: "vazio" quer sempre dizer "ainda não tratei".', "Friday's triage queue: 'empty' always means 'not handled yet'.") },
        { id: 'byteam', name: B('Por ' + hub.oneLower.pt, 'By ' + hub.oneLower.en), layout: 'board', group: 'team', filter: [{ p: 'archived', op: 'unchecked' }], sort: [{ p: 'cr', dir: 'desc' }], hide: [],
          why: B('Para preparar uma reunião com uma equipa.', 'To prepare for a meeting with a team.') },
        { id: 'ideas', name: B('Ideias', 'Ideas'), layout: 'list', filter: [{ p: 'tags', op: 'has', v: 'idea' }, { p: 'archived', op: 'unchecked' }], sort: [{ p: 'cr', dir: 'asc' }], hide: [],
          why: B('O "Algum dia / Talvez" do GTD, como etiqueta. Revê-se por trimestre.', "GTD's Someday/Maybe, as a tag. Reviewed quarterly.") },
        { id: 'review', name: B('Revisão', 'Review'), layout: 'table', filter: [{ p: 'team', op: 'not_empty' }, { p: 'archived', op: 'unchecked' }, { p: 'cr', op: 'between', v: [30, 37] }], sort: [{ p: 'cr', dir: 'asc' }], hide: [],
          why: B('Uma fatia de uma semana (criadas há 30–37 dias): cada nota guardada volta a aparecer exatamente uma vez.', 'A one-week slice (created 30–37 days ago): every kept note comes up exactly once.') },
        { id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [{ p: 'cr', dir: 'desc' }], hide: [],
          why: B('Sem filtro, arquivadas incluídas. Só para uma auditoria rara.', 'No filter, archived included. Only for a rare full audit.') },
      ],
      projects: [
        { id: 'active', name: B('Em curso', 'Active'), layout: 'table', filter: [{ p: 'status', op: 'is_not', v: 'done' }], sort: [{ p: 'status', dir: 'asc' }], hide: [], def: true,
          why: B('"Arquivar" é um estado, não uma mudança de sítio: o Done sai da vista, não da base.', "'Archive' is a status, not a move: Done leaves the view, not the database.") },
        { id: 'board', name: B('Now · Next · Later', 'Now · Next · Later'), layout: 'board', group: 'status', filter: [], sort: [], hide: [],
          why: B('Horizontes em vez de datas inventadas.', 'Horizons instead of invented dates.') },
        { id: 'byteam', name: B('Por ' + hub.oneLower.pt, 'By ' + hub.oneLower.en), layout: 'board', group: 'team', filter: [{ p: 'status', op: 'is_not', v: 'done' }], sort: [], hide: [],
          why: B('Projetos agrupados pela relação com a base central.', 'Projects grouped by the relation to the hub database.') },
        { id: 'done', name: B('Feitos', 'Done'), layout: 'list', filter: [{ p: 'status', op: 'is', v: 'done' }], sort: [{ p: 'cr', dir: 'desc' }], hide: [],
          why: B('O registo do que se entregou — ainda filtrável e estruturado.', 'The record of what shipped — still filterable and structured.') },
      ],
      teams: [{ id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [], hide: [], def: true }],
      persons: [{ id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [], hide: [], def: true }],
      oneonones: [{ id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [{ p: 'ed', dir: 'asc' }], hide: [], def: true }],
      meetings: [
        { id: 'all', name: B('Todas', 'All'), layout: 'table', filter: [], sort: [{ p: 'ed', dir: 'desc' }], hide: [], def: true },
        { id: 'type', name: B('Por tipo', 'By type'), layout: 'board', group: 'type', filter: [], sort: [], hide: [] },
      ],
    };
  }

  /* ════════════════ cenário 1: trabalho (o documento) ════════════════ */
  const hubWork = {
    db: B('Equipas', 'Teams'), prop: B('Equipa', 'Team'), oneLower: B('equipa', 'team'),
    persons: B('Pessoas', 'Persons'), meetings: B('Reuniões', 'Meetings'), oneOnOne: true,
    q: B('Onde existem os nomes das equipas — e o que está ligado a cada uma?', 'Where do team names live — and what is linked to each one?'),
  };
  const W = {
    id: 'work',
    label: B('Trabalho — liderar várias equipas', 'Work — leading several teams'),
    short: B('Trabalho', 'Work'),
    boxes: [
      { id: 'wp', l: B('#Trabalho-Projetos', '#Work-Projects'), d: B('Compromissos e verificações — nome do projeto no fim do título', 'Commitments and checks — project name at the end of the title') },
      { id: 'wg', l: B('#Trabalho-Geral', '#Work-General'), d: B('Lembretes leves, sem projeto', 'Light reminders, no project') },
      { id: 'pe', l: B('#Pessoal', '#Personal'), d: B('Tudo o que é fora do trabalho', 'Anything outside work') },
    ],
    schema: Object.assign(schema(hubWork), { oneonones: oneOnOneSchema() }),
    views: views(hubWork),
    hub: hubWork,
    records: {
      teams: [
        { id: 'atlas', name: 'Atlas', full: B('Infraestrutura de Plataforma', 'Platform Infrastructure'), tnote: B('Antiga equipa de SRE', 'Old SRE team'), cr: -400 },
        { id: 'beacon', name: 'Beacon', full: B('Dados e Analítica', 'Data & Analytics'), tnote: '', cr: -400 },
        { id: 'cobalt', name: 'Cobalt', full: B('Produtividade de Desenvolvimento', 'Developer Productivity'), tnote: B('CI/CD e ferramentas internas', 'CI/CD and internal tools'), cr: -400 },
        { id: 'org', name: B('Toda a organização', 'Org-wide'), full: B('Transversal', 'Cross-team'), tnote: B('Para o que não é de uma só equipa', 'For anything that belongs to no single team'), cr: -400,
          body: [{ k: 'p', t: B('Esta linha existe para que "equipa vazia" queira sempre dizer "alguém se esqueceu", e nunca "é para todos".', "This row exists so that 'team is empty' always means 'someone forgot', never 'it's for everyone'.") }] },
      ],
      notes: [
        { id: 'n1', name: B('Beacon: a carga noturna do armazém de dados demora 3 h, antes 1 h (Acelerar o armazém)', 'Beacon: warehouse nightly load now takes 3h, was 1h (Warehouse speed-up)'), team: ['beacon'], tags: ['system'], cr: -12 },
        { id: 'n2', name: B('Cobalt: as novas imagens dos runners chegam a 3 nov, conta com uma semana instável (Renovação do CI)', 'Cobalt: new runner images land Nov 3, expect a flaky week (CI revamp)'), team: ['cobalt'], tags: ['process'], cr: -9 },
        { id: 'n3', name: B('Decisão: todos os serviços novos publicam no Event Bus (Atualização do Event Bus)', 'Decision: all new services publish to the Event Bus (Event Bus upgrade)'), team: ['org'], tags: ['decision'], cr: -16 },
        { id: 'n4', name: B('Risco: só uma pessoa conhece a configuração do agendador antigo', 'Risk: only one person knows the legacy scheduler setup'), team: [], tags: [], cr: -1 },
        { id: 'n5', name: B('Atlas: o Kubernetes está duas versões menores atrás (Atualização do k8s)', 'Atlas: Kubernetes is two minor versions behind (k8s upgrade)'), team: ['atlas'], tags: ['debt'], cr: -19 },
        { id: 'n6', name: B('Cobalt: a taxa de acerto da cache de builds caiu para 55% (Renovação do CI)', 'Cobalt: build cache hit rate dropped to 55% (CI revamp)'), team: [], tags: [], cr: -1 },
        { id: 'n7', name: B('Ideia: 15 minutos semanais de "pergunta à plataforma"', 'Idea: weekly 15-min "ask the platform" office hours'), team: ['org'], tags: ['idea'], cr: -24 },
        { id: 'n8', name: B('Fornecedor X: renovação a 15 jan, preço +20% (Revisão de acessos)', 'Vendor X renewal due Jan 15, pricing +20% (Access review)'), team: [], tags: [], cr: -3 },
        { id: 'n9', name: B('Planeamento trimestral: a Cobalt quer modelos de CI no 1.º semestre (Renovação do CI)', 'Quarterly planning: Cobalt wants CI templates in H1 (CI revamp)'), team: ['cobalt'], tags: ['planning'], cr: -7 },
        { id: 'n10', name: B('Atlas: o ensaio da migração precisa de uma janela de congelamento de 4 h (Migração da BD)', 'Atlas: cutover rehearsal needs a 4h freeze window (DB migration)'), team: ['atlas'], tags: [], cr: -6 },
        { id: 'n11', name: B('Atlas: a Ana assinalou picos de atraso de replicação no fim do mês (Migração da BD)', 'Atlas: Ana flagged replication lag spikes at month-end (DB migration)'), team: [], tags: [], cr: 0 },
        { id: 'n12', name: B('Atlas: incidente de failover da BD principal a 14 out, postmortem na wiki (core-db)', 'Atlas: core DB failover incident Oct 14, postmortem in the wiki (core-db)'), team: ['atlas'], tags: ['system'], cr: -12 },
        { id: 'n13', name: B('Decisão: os modelos de CI vivem num único repositório partilhado (Renovação do CI)', 'Decision: CI templates live in one shared repository (CI revamp)'), team: ['cobalt'], tags: ['decision'], cr: -10 },
        { id: 'n14', name: B('Lembrar de ver a cache', 'Remember to check cache'), team: [], tags: [], cr: -2 },
        { id: 'n15', name: B('Coisa do Kafka', 'Kafka thing'), team: [], tags: [], cr: -3 },
        { id: 'n16', name: B('Elena: prefere um ponto da situação por escrito antes da reunião de sexta', 'Elena: prefers a written update before the Friday sync'), team: ['cobalt'], tags: [], cr: -33 },
        { id: 'n17', name: B('Atlas: a BD de staging passa a ser refrescada todos os domingos à noite', 'Atlas: the staging DB is now refreshed every Sunday night'), team: ['atlas'], tags: ['system'], cr: -31 },
        { id: 'n18', name: B('Cobalt: o painel de testes instáveis mudou para um URL novo', 'Cobalt: the flaky-test dashboard moved to a new URL'), team: ['cobalt'], tags: [], cr: -35 },
        { id: 'n19', name: B('Beacon: entra uma analista nova em novembro', 'Beacon: a new analyst joins in November'), team: ['beacon'], tags: [], cr: -32 },
        { id: 'n20', name: B('Toda a organização: o prazo da formação de segurança passou para 1 dez', 'Org-wide: the security training deadline moved to Dec 1'), team: ['org'], tags: ['process'], cr: -36 },
        { id: 'n21', name: B('Atlas: atualização para Postgres 16 concluída em staging (Migração da BD)', 'Atlas: Postgres 16 upgrade finished in staging (DB migration)'), team: ['atlas'], tags: ['system'], archived: true, cr: -48 },
        { id: 'n22', name: B('Ideia: um modelo de runbook comum a todas as equipas', 'Idea: one runbook template shared by every team'), team: ['org'], tags: ['idea'], cr: -22 },
        { id: 'n24', name: B('Beacon: os painéis passam para a nova ferramenta de BI no 1.º trimestre', 'Beacon: dashboards move to the new BI tool in Q1'), team: ['beacon'], tags: ['planning'], cr: -14 },
      ],
      projects: [
        { id: 'p_db', name: B('Migração da BD', 'DB migration'), status: 'now', prio: 'p1', target: B('dez 2026', 'Dec 2026'), risk: 'o', team: ['atlas'], tracker: 'https://tracker.example/ATLAS-142', cr: -60,
          body: [
            { k: 'h', t: B('Objetivo', 'Objective') }, { k: 'p', t: B('A BD principal corre no fornecedor gerido, com o antigo desligado e um plano de recuo testado.', 'The core database runs on the managed provider, with the old one switched off and a tested rollback plan.') },
            { k: 'h', t: B('Contexto', 'Context') }, { k: 'p', t: B('O contrato do datacenter acaba em março. A Atlas lidera; a Cobalt congela deploys no ensaio.', 'The datacenter contract ends in March. Atlas leads; Cobalt freezes deploys for the rehearsal.') },
            { k: 'h', t: B('Plano', 'Plan') }, { k: 'p', t: B('1) réplica e medição do atraso · 2) ensaio com congelamento de 4 h · 3) migração · 4) desligar o antigo.', '1) replica and lag measurement · 2) rehearsal with a 4h freeze · 3) cutover · 4) switch off the old one.') },
            { k: 'h', t: B('Decisões', 'Decisions') }, { k: 'p', t: B('14 out: ensaio antes da migração real, porque o último failover correu mal.', '14 Oct: rehearsal before the real cutover, because the last failover went badly.') },
          ] },
        { id: 'p_ci', name: B('Renovação do CI', 'CI revamp'), status: 'now', target: B('1.º trim. 2027', 'Q1 2027'), risk: 'g', team: ['cobalt'], cr: -45 },
        { id: 'p_wh', name: B('Acelerar o armazém', 'Warehouse speed-up'), status: 'now', target: '', risk: 'o', team: ['beacon'], cr: -20 },
        { id: 'p_acc', name: B('Revisão de acessos', 'Access review'), status: 'next', target: B('jan 2027', 'Jan 2027'), risk: 'g', team: ['org'], cr: -30 },
        { id: 'p_k8s', name: B('Atualização do k8s', 'k8s upgrade'), status: 'next', target: '', risk: 'o', team: ['atlas'], cr: -15 },
        { id: 'p_eb', name: B('Atualização do Event Bus', 'Event Bus upgrade'), status: 'later', target: '2027', risk: 'g', team: ['atlas', 'beacon'], cr: -90 },
        { id: 'p_off', name: B('Encontro anual das equipas', 'Team offsite'), status: 'done', target: B('out 2026', 'Oct 2026'), risk: 'g', team: ['org'], cr: -100 },
      ],
      persons: [
        { id: 'ana', name: 'Ana', team: ['atlas'], role: B('Responsável pela BD', 'DB lead'), cr: -300 },
        { id: 'marta', name: 'Marta', team: ['atlas'], role: 'SRE', cr: -300 },
        { id: 'elena', name: 'Elena', team: ['cobalt'], role: B('Engenheira principal', 'Staff engineer'), cr: -300 },
        { id: 'tomas', name: 'Tomás', team: ['cobalt'], role: B('Engenheiro', 'Engineer'), cr: -200 },
        { id: 'rui', name: 'Rui', team: ['beacon'], role: B('Engenheiro de dados', 'Data engineer'), cr: -250 },
      ],
      oneonones: [
        { id: 'o_ana', name: 'Ana', person: ['ana'], team: ['atlas'], ed: -7, cr: -300, body: [
          { k: 'h', t: B('Próximo', 'Next') }, { k: 'p', t: B('Perguntar como correu o teste de recuo; falar da formação em PostgreSQL gerido.', 'Ask how the rollback test went; discuss the managed PostgreSQL training.') },
          { k: 'h', t: B('19 out', '19 Oct') }, { k: 'p', t: B('Quer liderar o ensaio. Preocupada com o atraso de replicação.', 'Wants to lead the rehearsal. Worried about replication lag.') }] },
        { id: 'o_marta', name: 'Marta', person: ['marta'], team: ['atlas'], ed: -10, cr: -300 },
        { id: 'o_elena', name: 'Elena', person: ['elena'], team: ['cobalt'], ed: -14, cr: -300 },
        { id: 'o_rui', name: 'Rui', person: ['rui'], team: ['beacon'], ed: -21, cr: -250 },
      ],
      meetings: [
        { id: 'm_sync', name: B('Reunião semanal da Plataforma', 'Platform weekly sync'), type: 'rec', team: ['atlas', 'cobalt'], project: [], ed: -7, cr: -300 },
        { id: 'm_qp', name: B('Planeamento trimestral', 'Quarterly planning'), type: 'od', team: ['org'], project: [], ed: -8, cr: -40 },
        { id: 'm_reh', name: B('Revisão do ensaio da migração', 'Cutover rehearsal review'), type: 'od', team: ['atlas'], project: ['p_db'], ed: -5, cr: -12 },
        { id: 'm_rel', name: B('Revisão mensal de fiabilidade', 'Monthly reliability review'), type: 'rec', team: ['org'], project: [], ed: -29, cr: -200 },
        { id: 'm_beacon', name: B('Reunião da Beacon', 'Beacon sync'), type: 'rec', team: ['beacon'], project: [], ed: -6, cr: -300 },
      ],
      tasks: [
        { id: 't1', t: B('Verificar se o teste de recuo passou em staging (Migração da BD)', 'Verify rollback test passed in staging (DB migration)'), box: 'wp', due: 2, p: 1 },
        { id: 't2', t: B('Pedir à Cobalt um congelamento de deploys de 4 h antes do ensaio (Migração da BD)', 'Ask Cobalt for a 4h deploy freeze before rehearsal (DB migration)'), box: 'wp', due: 1 },
        { id: 't3', t: B('Preparar o runbook da migração (Migração da BD)', 'Prepare cutover runbook (DB migration)'), box: 'wp', due: 4,
          sub: [{ t: B('Recolher os passos de failover com a Ana', 'Collect failover steps from Ana') }, { t: B('Escrever o runbook', 'Draft the runbook') }, { t: B('Rever com quem está de piquete na Atlas', 'Review with the Atlas on-call') }] },
        { id: 't4', t: B('Insistir com a Ana pelos números do atraso de replicação (Migração da BD)', 'Chase Ana for replication lag numbers (DB migration)'), box: 'wp', due: 1 },
        { id: 't5', t: B('Insistir com a Elena pelo rascunho da especificação dos modelos (Renovação do CI)', 'Chase Elena for the template spec draft (CI revamp)'), box: 'wp', due: 4 },
        { id: 't6', t: B('Rever a proposta de atualização do cluster (Atualização do k8s)', 'Review cluster upgrade proposal (k8s upgrade)'), box: 'wp', due: -2 },
        { id: 't7', t: B('Enviar à Ana um email sobre a agenda do encontro', 'Email Ana about the offsite agenda'), box: 'wg', due: 0 },
        { id: 't8', t: B('Falar da janela de congelamento à Beacon na reunião de quinta', 'Mention the freeze window to Team Beacon at Thursday sync'), box: 'wg', due: 3 },
        { id: 't9', t: B('Reservar uma sala para o planeamento trimestral', 'Book a room for quarterly planning'), box: 'wg', due: null },
        { id: 't10', t: B('Atualizar os diapositivos do roadmap', 'Update roadmap slides'), box: 'wg', due: 6 },
        { id: 't11', t: B('Escrever o âmbito da revisão de acessos (Revisão de acessos)', 'Draft the access review scope (Access review)'), box: 'wp', due: 9 },
        { id: 't12', t: B('Marcar a revisão do carro', 'Book car service appointment'), box: 'pe', due: 5 },
        { id: 't13', t: B('Revisão semanal — 20 min, telemóvel longe', 'Weekly review — 20 min, phone away'), box: 'wg', due: 4, rec: 7, p: 4 },
      ],
      cal: [
        { id: 'c1', t: B('Reunião semanal da Plataforma', 'Platform weekly sync'), day: 1, h: 10, len: 1, kind: 'meet' },
        { id: 'c2', t: B('Reunião da Beacon', 'Beacon sync'), day: 3, h: 14, len: 1, kind: 'meet' },
        { id: 'c3', t: B('Revisão semanal', 'Weekly review'), day: 4, h: 16, len: .5, kind: 'review' },
        { id: 'c4', t: B('Reunião semanal da Plataforma', 'Platform weekly sync'), day: 8, h: 10, len: 1, kind: 'meet' },
        { id: 'c5', t: B('Reunião da Beacon', 'Beacon sync'), day: 10, h: 14, len: 1, kind: 'meet' },
        { id: 'c6', t: B('Planeamento trimestral', 'Quarterly planning'), day: 9, h: 9, len: 2, kind: 'meet' },
        { id: 'c7', t: B('Revisão semanal', 'Weekly review'), day: 11, h: 16, len: .5, kind: 'review' },
      ],
      resources: [
        { id: 'r_metrics', name: B('Métricas que acompanho', 'Metrics I watch') },
        { id: 'r_runbooks', name: B('Runbooks e guias', 'Runbooks and how-tos') },
      ],
    },
  };

  /* ════════════════ cenário 2: estudos e vida pessoal ════════════════ */
  const hubStudy = {
    db: B('Áreas', 'Areas'), prop: B('Área', 'Area'), oneLower: B('área', 'area'),
    persons: B('Pessoas', 'People'), meetings: B('Aulas e encontros', 'Classes & meetups'), oneOnOne: false,
    q: B('Que áreas da minha vida mantenho — e o que está ligado a cada uma?', 'Which areas of my life do I maintain — and what is linked to each?'),
  };
  const S = {
    id: 'study',
    label: B('Estudos e vida pessoal', 'Studies and personal life'),
    short: B('Estudos', 'Studies'),
    boxes: [
      { id: 'wp', l: B('#Projetos', '#Projects'), d: B('Compromissos de um projeto — nome do projeto no fim do título', 'Project commitments — project name at the end of the title') },
      { id: 'wg', l: B('#Geral', '#General'), d: B('Lembretes leves', 'Light reminders') },
      { id: 'pe', l: B('#Part-time', '#Part-time'), d: B('O trabalho em part-time', 'The part-time job') },
    ],
    schema: schema(hubStudy),
    views: views(hubStudy),
    hub: hubStudy,
    records: {
      teams: [
        { id: 'est', name: B('Estudos', 'Studies'), full: B('Licenciatura, 2.º ano', 'Degree, 2nd year'), tnote: '', cr: -400 },
        { id: 'casa', name: B('Casa', 'Home'), full: B('Casa e mudança', 'Home and moving'), tnote: '', cr: -400 },
        { id: 'saude', name: B('Saúde', 'Health'), full: B('Saúde e desporto', 'Health and sport'), tnote: '', cr: -400 },
        { id: 'fin', name: B('Finanças', 'Money'), full: B('Finanças pessoais', 'Personal finance'), tnote: '', cr: -400 },
        { id: 'geral', name: B('Geral', 'General'), full: B('Transversal', 'Cross-area'), tnote: B('Para o que não é de uma só área', 'For anything that belongs to no single area'), cr: -400 },
      ],
      notes: [
        { id: 's1', name: B('Estatística: o teste-t entra no exame, a ANOVA não (Exame de Estatística)', 'Statistics: the t-test is in the exam, ANOVA is not (Statistics exam)'), team: ['est'], tags: ['planning'], cr: -6 },
        { id: 's2', name: B('Prof. Lima: o atendimento passa para quinta às 14h', 'Prof. Lima: office hours move to Thursday at 2pm'), team: ['est'], tags: ['process'], cr: -12 },
        { id: 's3', name: B('Casa: o contrato atual acaba a 31 de março (Mudança de casa)', 'Home: the current lease ends on 31 March (Moving house)'), team: ['casa'], tags: [], cr: -9 },
        { id: 's4', name: B('Ideia: trocar o ginásio por corrida três vezes por semana', 'Idea: swap the gym for running three times a week'), team: ['saude'], tags: ['idea'], cr: -20 },
        { id: 's5', name: B('Finanças: a renda sobe 2% em janeiro', 'Money: the rent goes up 2% in January'), team: ['fin'], tags: [], cr: -15 },
        { id: 's6', name: B('Decisão: a Inês fica com a introdução e a bibliografia (Trabalho de Sociologia)', 'Decision: Inês takes the introduction and bibliography (Sociology paper)'), team: ['est'], tags: ['decision'], cr: -3 },
        { id: 's7', name: B('Biblioteca: a sala de estudo abre até à meia-noite em época de exames', 'Library: the study room stays open until midnight during exams'), team: [], tags: [], cr: -1 },
        { id: 's8', name: B('Comprar marcadores', 'Buy highlighters'), team: [], tags: [], cr: -2 },
        { id: 's9', name: B('Coisa do Excel', 'Excel thing'), team: [], tags: [], cr: -2 },
        { id: 's10', name: B('Casa: o senhorio aceita visitas ao fim de semana (Mudança de casa)', 'Home: the landlord allows viewings at weekends (Moving house)'), team: [], tags: [], cr: 0 },
        { id: 's11', name: B('Saúde: as análises de rotina repetem-se de 6 em 6 meses', 'Health: routine blood tests repeat every 6 months'), team: ['saude'], tags: [], cr: -33 },
        { id: 's12', name: B('Estudos: a plataforma da faculdade muda de endereço em outubro', 'Studies: the university platform moves to a new address in October'), team: ['est'], tags: [], cr: -35 },
        { id: 's13', name: B('Inês: prefere mensagens a chamadas', 'Inês: prefers messages to calls'), team: ['est'], tags: [], cr: -31 },
        { id: 's14', name: B('Ideia: um mapa de revisão por capítulo para cada exame', 'Idea: a revision map per chapter for every exam'), team: ['est'], tags: ['idea'], cr: -25 },
      ],
      projects: [
        { id: 'sp_ex', name: B('Exame de Estatística', 'Statistics exam'), status: 'now', prio: 'p1', target: B('15 jan', '15 Jan'), risk: 'o', team: ['est'], cr: -30 },
        { id: 'sp_soc', name: B('Trabalho de Sociologia', 'Sociology paper'), status: 'now', target: B('6 dez', '6 Dec'), risk: 'g', team: ['est'], cr: -18 },
        { id: 'sp_mov', name: B('Mudança de casa', 'Moving house'), status: 'next', target: B('mar 2027', 'Mar 2027'), risk: 'g', team: ['casa'], cr: -25 },
        { id: 'sp_run', name: B('Correr 10 km', 'Run 10 km'), status: 'later', target: '', risk: 'g', team: ['saude'], cr: -40 },
        { id: 'sp_irs', name: B('IRS 2026', '2026 tax return'), status: 'done', target: B('jun 2026', 'Jun 2026'), risk: 'g', team: ['fin'], cr: -200 },
      ],
      persons: [
        { id: 'lima', name: 'Prof. Lima', team: ['est'], role: B('Professor de Estatística', 'Statistics lecturer'), cr: -60 },
        { id: 'ines', name: 'Inês', team: ['est'], role: B('Colega do trabalho de grupo', 'Group-work classmate'), cr: -60 },
        { id: 'costa', name: 'Sr. Costa', team: ['casa'], role: B('Senhorio', 'Landlord'), cr: -300 },
      ],
      meetings: [
        { id: 'sm_est', name: B('Aulas de Estatística', 'Statistics classes'), type: 'rec', team: ['est'], project: ['sp_ex'], ed: -4, cr: -60 },
        { id: 'sm_soc', name: B('Grupo de Sociologia', 'Sociology group'), type: 'rec', team: ['est'], project: ['sp_soc'], ed: -3, cr: -18 },
        { id: 'sm_nut', name: B('Consulta de nutrição', 'Nutrition appointment'), type: 'od', team: ['saude'], project: [], ed: -40, cr: -40 },
      ],
      tasks: [
        { id: 'st1', t: B('Resolver os exercícios 3 e 4 de testes de hipóteses (Exame de Estatística)', 'Solve hypothesis-testing exercises 3 and 4 (Statistics exam)'), box: 'wp', due: 1, p: 1 },
        { id: 'st2', t: B('Rever o capítulo 5 antes da aula (Exame de Estatística)', 'Review chapter 5 before class (Statistics exam)'), box: 'wp', due: 3 },
        { id: 'st3', t: B('Insistir com o senhorio sobre a data de saída (Mudança de casa)', 'Chase the landlord about the move-out date (Moving house)'), box: 'wp', due: 2 },
        { id: 'st4', t: B('Marcar consulta de nutrição', 'Book a nutrition appointment'), box: 'wg', due: -1 },
        { id: 'st5', t: B('Pagar a quota do ginásio', 'Pay the gym fee'), box: 'wg', due: 4 },
        { id: 'st6', t: B('Enviar ao gerente a disponibilidade de dezembro', 'Send my December availability to the manager'), box: 'pe', due: 2 },
        { id: 'st7', t: B('Comprar um presente para a mãe', 'Buy a present for Mum'), box: 'wg', due: null },
        { id: 'st8', t: B('Revisão semanal — 20 min, telemóvel longe', 'Weekly review — 20 min, phone away'), box: 'wg', due: 4, rec: 7 },
      ],
      cal: [
        { id: 'sc1', t: B('Aula de Estatística', 'Statistics class'), day: 1, h: 9, len: 2, kind: 'meet' },
        { id: 'sc2', t: B('Turno no part-time', 'Part-time shift'), day: 2, h: 17, len: 4, kind: 'meet' },
        { id: 'sc3', t: B('Grupo de Sociologia', 'Sociology group'), day: 3, h: 14, len: 1, kind: 'meet' },
        { id: 'sc4', t: B('Revisão semanal', 'Weekly review'), day: 4, h: 18, len: .5, kind: 'review' },
        { id: 'sc5', t: B('Aula de Estatística', 'Statistics class'), day: 8, h: 9, len: 2, kind: 'meet' },
        { id: 'sc6', t: B('Turno no part-time', 'Part-time shift'), day: 9, h: 17, len: 4, kind: 'meet' },
        { id: 'sc7', t: B('Grupo de Sociologia', 'Sociology group'), day: 10, h: 14, len: 1, kind: 'meet' },
        { id: 'sc8', t: B('Revisão semanal', 'Weekly review'), day: 11, h: 18, len: .5, kind: 'review' },
      ],
      resources: [
        { id: 'r_study', name: B('Como estudo para exames', 'How I study for exams') },
        { id: 'r_house', name: B('Lista de verificação de casas', 'House-viewing checklist') },
      ],
    },
  };

  /* Chegadas da semana guiada: uma situação real → onde vai? → que título?
     dest: task | note | meeting | today | project · good = índice da
     redação forte em `titles` (as outras são as fracas típicas). */
  const WEEK = {
    work: [
      { day: 0, id: 'e1', situ: B('No corredor, a Ana diz-te que está decidido: os novos serviços de dados usam PostgreSQL gerido.', 'In the corridor, Ana tells you it is decided: new data services use managed PostgreSQL.'),
        dest: 'note', team: 'atlas', tags: ['decision'],
        titles: [B('Falar da BD', 'Talk about the DB'), B('Decisão: os novos serviços de dados usam PostgreSQL gerido (Migração da BD)', 'Decision: new data services use managed PostgreSQL (DB migration)'), B('A Ana disse uma coisa importante sobre bases de dados', 'Ana said something important about databases')], good: 1,
        why: B('Ouviste uma decisão: é informação, não uma ação. Vai para a caixa de Notas numa linha — "Decisão:" à frente, o nome do projeto no fim. É a terceira nota de decisão: a regra de três vai acender-se.', 'You heard a decision: it is information, not an action. It goes to the Notes inbox in one line — "Decision:" first, the project name last. It is the third decision note: the rule of three is about to light up.') },
      { day: 0, id: 'e2', situ: B('O Tomás pede-te que revejas a proposta dos modelos de CI até quinta.', 'Tomás asks you to review the CI templates proposal by Thursday.'),
        dest: 'task', box: 'wp', due: 3, project: 'p_ci',
        titles: [B('Proposta dos modelos', 'Templates proposal'), B('Tomás — CI??', 'Tomás — CI??'), B('Rever a proposta dos modelos de CI (Renovação do CI)', 'Review the CI templates proposal (CI revamp)')], good: 2,
        why: B('É algo que tens de fazer, com prazo: uma tarefa. Começa por um verbo, leva o nome do projeto no fim, vai para #Trabalho-Projetos porque é um compromisso, e tem data porque a data é real.', 'Something you must do, with a deadline: a task. It starts with a verb, ends with the project name, goes to #Work-Projects because it is a commitment, and has a date because the date is real.') },
      { day: 1, id: 'e3', situ: B('De manhã pensas: "hoje tenho mesmo de acabar o runbook da migração".', 'In the morning you think: "today I really have to finish the cutover runbook".'),
        dest: 'today', task: 't3',
        why: B('Isto não é uma coisa nova para guardar: a tarefa já existe na lista. É uma escolha de foco — vai para os Big 3 do caderno. O caderno nunca é um sítio de captura.', 'This is not a new thing to store: the task already exists. It is a focus choice — it goes into the notebook Big 3. The notebook is never a capture point.') },
      { day: 1, id: 'e4', situ: B('Na Revisão do ensaio da migração (reunião marcada) combina-se que o ensaio é no sábado 14.', 'In the Cutover rehearsal review (a scheduled meeting) it is agreed the rehearsal is on Saturday the 14th.'),
        dest: 'meeting', meeting: 'm_reh',
        why: B('Notas tiradas DENTRO de uma reunião marcada vão para a página dessa reunião, numa entrada datada — não para a caixa de Notas.', 'Notes taken INSIDE a scheduled meeting go on that meeting\'s page, as a dated entry — not into the Notes inbox.') },
      { day: 2, id: 'e5', situ: B('O Fornecedor X promete enviar o relatório da auditoria "na próxima semana".', 'Vendor X promises to send the audit report "next week".'),
        dest: 'task', box: 'wp', due: 7, project: 'p_acc',
        titles: [B('À espera do Fornecedor X', 'Waiting for Vendor X'), B('Insistir com o Fornecedor X pelo relatório da auditoria (Revisão de acessos)', 'Chase Vendor X for the audit report (Access review)'), B('Relatório?', 'Report?')], good: 1,
        why: B('Estás à espera de alguém: no GTD isso é a lista "À espera". Aqui é uma tarefa que começa por "Insistir", com a data em que vais VOLTAR a perguntar — não a data em que esperas o resultado.', 'You are waiting on someone: in GTD that is the Waiting For list. Here it is a task starting with "Chase", dated for when you will ASK AGAIN — not when you expect the result.') },
      { day: 2, id: 'e6', situ: B('Um colega comenta que o painel de custos da cloud passou a atualizar de hora a hora.', 'A colleague mentions the cloud cost dashboard now updates every hour.'),
        dest: 'note', team: 'org', tags: [],
        titles: [B('Toda a organização: o painel de custos da cloud passa a atualizar de hora a hora', 'Org-wide: the cloud cost dashboard now updates every hour'), B('Painel', 'Dashboard'), B('Ver o painel de custos', 'Check the cost dashboard')], good: 0,
        why: B('Um facto ouvido de passagem: Notas, uma linha que ainda faça sentido daqui a três meses. "Ver o painel" seria uma ação disfarçada — e não há nada para fazer.', 'A fact heard in passing: Notes, one line that still makes sense in three months. "Check the dashboard" would be a disguised action — and there is nothing to do.') },
      { day: 3, id: 'e7', situ: B('A direção pede uma iniciativa nova: reduzir 20% o custo da cloud até junho, liderada pela Atlas.', 'Leadership asks for a new initiative: cut cloud cost by 20% by June, led by Atlas.'),
        dest: 'project', project: { name: B('Redução de custos da cloud', 'Cloud cost reduction'), status: 'next', team: ['atlas'], target: B('jun 2027', 'Jun 2027') },
        why: B('Tem um resultado, um fim e várias sessões de trabalho: é um Projeto (no sentido PARA). Uma linha na base Projetos, com o modelo de página. Ainda não há tarefas — só a próxima ação, quando houver.', 'It has an outcome, an end and several work sessions: a Project (in the PARA sense). One row in the Projects database, with the page template. No tasks yet — only the next action, when there is one.') },
      { day: 3, id: 'e8', situ: B('Lembras-te, a caminho de casa, de que o cartão de cidadão caduca em dezembro.', 'On the way home you remember your ID card expires in December.'),
        dest: 'task', box: 'pe', due: null,
        titles: [B('Cartão de cidadão', 'ID card'), B('Renovar o cartão de cidadão', 'Renew the ID card'), B('Não esquecer!!', "Don't forget!!")], good: 1,
        why: B('Uma ação pessoal: #Pessoal, verbo à frente. Sem data inventada — fica na lista e aparece nas passagens normais.', 'A personal action: #Personal, verb first. No invented date — it sits on the list and comes up in normal passes.') },
    ],
    study: [
      { day: 0, id: 'e1', situ: B('No fim da aula, o Prof. Lima diz que a matéria do capítulo 7 também sai no exame.', 'At the end of class, Prof. Lima says chapter 7 is also in the exam.'),
        dest: 'meeting', meeting: 'sm_est',
        why: B('Foi dito numa aula — um "encontro" marcado com página própria. Vai para a página das Aulas de Estatística, numa entrada datada.', 'It was said in a class — a scheduled meeting with its own page. It goes on the Statistics classes page, as a dated entry.') },
      { day: 0, id: 'e2', situ: B('A Inês pede-te que leias o rascunho dela até quarta.', 'Inês asks you to read her draft by Wednesday.'),
        dest: 'task', box: 'wp', due: 2, project: 'sp_soc',
        titles: [B('Rascunho Inês', 'Inês draft'), B('Ler o rascunho da Inês (Trabalho de Sociologia)', "Read Inês's draft (Sociology paper)"), B('Sociologia!!!', 'Sociology!!!')], good: 1,
        why: B('Uma ação com prazo e de um projeto: verbo à frente, nome do projeto no fim, #Projetos.', 'An action with a deadline, part of a project: verb first, project name last, #Projects.') },
      { day: 1, id: 'e3', situ: B('Ouves no bar que a cantina passa a fechar às 15h às sextas.', 'You hear at the café that the canteen now closes at 3pm on Fridays.'),
        dest: 'note', team: 'geral', tags: [],
        titles: [B('Cantina', 'Canteen'), B('Geral: a cantina passa a fechar às 15h às sextas', 'General: the canteen now closes at 3pm on Fridays'), B('Ir à cantina mais cedo', 'Go to the canteen earlier')], good: 1,
        why: B('Um facto: Notas, numa linha que se encontra depois pela palavra "cantina".', 'A fact: Notes, in one line you will find later by the word "canteen".') },
      { day: 2, id: 'e4', situ: B('Decides que a corrida dos 10 km vai mesmo acontecer: inscreves-te para abril.', 'You decide the 10 km run is really happening: you sign up for April.'),
        dest: 'project', project: { name: B('Correr 10 km', 'Run 10 km'), status: 'next', team: ['saude'], target: B('abr 2027', 'Apr 2027') }, existing: 'sp_run',
        why: B('A ideia já era um Projeto em "Later". Ganhou um fim (abril) e passa a "Next": a estrutura muda de estado, não se cria outra.', 'The idea was already a Later project. It got an end (April) and moves to Next: the structure changes state; nothing new is created.') },
      { day: 3, id: 'e5', situ: B('O senhorio responde: "aviso-o da data de saída até ao fim do mês".', 'The landlord replies: "I will confirm the move-out date by the end of the month".'),
        dest: 'task', box: 'wp', due: 8, project: 'sp_mov',
        titles: [B('Senhorio', 'Landlord'), B('À espera do Sr. Costa', 'Waiting for Mr Costa'), B('Insistir com o Sr. Costa pela data de saída (Mudança de casa)', 'Chase Mr Costa for the move-out date (Moving house)')], good: 2,
        why: B('Estás à espera de alguém: uma tarefa "Insistir", datada para quando vais voltar a perguntar.', 'You are waiting on someone: a "Chase" task, dated for when you will ask again.') },
    ],
  };

  /* ofertas dos exercícios autónomos (não mexem no mundo) */
  return { work: W, study: S, OPTIONAL, TEMPLATES, WEEK, B };
})();
