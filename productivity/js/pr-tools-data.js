/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — diretório de ferramentas (dados, global `PrTools`)
   ──────────────────────────────────────────────────────────────────
   Regras deste ficheiro:
   · Sem pontuações. Cada ferramenta é comparada com os REQUISITOS de cada
     papel (tabela "What to look for in any tool" do documento de
     referência) e cada indicador diz: sim / limitado / só pago / não /
     por verificar.
   · Cada afirmação sobre o plano grátis ou um limite tem fonte (URL
     oficial) e data de verificação individual. O que não foi confirmado
     numa fonte oficial nesta revisão fica "por verificar" — não se adivinha.
   · Só entram ferramentas com plano grátis permanente (ou app grátis).
     Testes gratuitos de serviços pagos ficam de fora.
   · Preços tal como a página os mostrava na data (moeda incluída); podem
     variar por região e impostos.
   ══════════════════════════════════════════════════════════════════ */
const PrTools = (function () {
  'use strict';
  const B = (pt, en) => ({ pt, en });
  const D = '2026-11-14';

  /* fontes: uma por página consultada, com a data em que foi lida */
  const SRC = {
    todoist_p: { u: 'https://www.todoist.com/pricing', d: D },
    todoist_rec: { u: 'https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV', d: D },
    ticktick_p: { u: 'https://ticktick.com/about/upgrade', d: D },
    gtasks_h: { u: 'https://support.google.com/tasks/answer/7675772?hl=en', d: D },
    gtasks_rep: { u: 'https://support.google.com/tasks/answer/12132599', d: D },
    mstodo_store: { u: 'https://apps.microsoft.com/detail/9NBLGGH5R558', d: D },
    mstodo_share: { u: 'https://support.microsoft.com/en-US/ToDo/create-and-share-lists', d: D },
    mstodo_help: { u: 'https://support.microsoft.com/en-us/todo', d: D },
    notion_p: { u: 'https://www.notion.com/pricing', d: D },
    notion_rel: { u: 'https://www.notion.com/help/relations-and-rollups', d: D },
    notion_views: { u: 'https://www.notion.com/help/views-filters-and-sorts', d: D },
    obsidian_p: { u: 'https://obsidian.md/pricing', d: D },
    obsidian_h: { u: 'https://obsidian.md/', d: D },
    logseq_gh: { u: 'https://github.com/logseq/logseq', d: D },
    anytype_gh: { u: 'https://github.com/anyproto/anytype-ts', d: D },
    anytype_doc: { u: 'https://doc.anytype.io/anytype/resources/memberships', d: D },
    capacities_p: { u: 'https://capacities.io/pricing', d: D },
    joplin_h: { u: 'https://joplinapp.org/', d: D },
    joplin_p: { u: 'https://joplinapp.org/plans/', d: D },
    sn_p: { u: 'https://standardnotes.com/plans', d: D },
    simplenote_h: { u: 'https://simplenote.com/', d: D },
    keep_h: { u: 'https://workspace.google.com/products/keep/', d: D },
    clickup_p: { u: 'https://clickup.com/pricing', d: D },
    trello_p: { u: 'https://trello.com/pricing', d: D },
    asana_p: { u: 'https://asana.com/pricing', d: D },
    linear_p: { u: 'https://linear.app/pricing', d: D },
    gcal_h: { u: 'https://workspace.google.com/products/calendar/', d: D },
    gcal_appt: { u: 'https://support.google.com/calendar/answer/10729749?hl=en', d: D },
    ncal_h: { u: 'https://www.notion.com/product/calendar', d: D },
    bujo: { u: 'https://bulletjournal.com/pages/learn', d: null },
  };

  /* papéis e requisitos. must = "Must have", nice = "Nice to have".
     Os quatro primeiros vêm do documento de referência; o Calendário é
     uma escolha deste site (o documento não tem linha para ele). */
  const ROLES = {
    act: { k: 'act', n: B('Ações', 'Actions'), d: B('A lista de tarefas: tudo o que tens de fazer, com datas reais.', 'The task list: everything you must do, with real dates.'), src: 'doc', req: [
      { id: 'quick', must: true, n: B('Adicionar rápido a partir do ecrã principal do telemóvel', "Quick add from the phone's home screen") },
      { id: 'nlp', must: true, n: B('Datas e horas em linguagem natural', 'Natural-language dates and times') },
      { id: 'remind', must: true, n: B('Lembrete a uma hora', 'Reminders at a time') },
      { id: 'search', must: true, n: B('Pesquisa', 'Search') },
      { id: 'recur', must: true, n: B('Tarefas recorrentes', 'Recurring tasks') },
      { id: 'filters', must: false, n: B('Filtros guardados', 'Saved filters') },
      { id: 'sub', must: false, n: B('Subtarefas', 'Subtasks') },
    ] },
    info: { k: 'info', n: B('Informação', 'Information'), d: B('As Notas: o que ouviste, decidiste ou aprendeste, numa linha.', 'Notes: what you heard, decided or learned, in one line.'), src: 'doc', req: [
      { id: 'capture', must: true, n: B('Capturar uma linha em dois toques ou menos', 'One-line capture in two taps or fewer') },
      { id: 'wsearch', must: true, n: B('Pesquisa por palavras inteiras', 'Whole-word search') },
      { id: 'field', must: true, n: B('Um campo de equipa/etiqueta', 'A team/tag field') },
      { id: 'views', must: true, n: B('Vistas filtradas', 'Filtered views') },
      { id: 'offline', must: true, n: B('Funciona offline', 'Works offline') },
      { id: 'rel', must: false, n: B('Relações com outros registos', 'Relations to other records') },
      { id: 'body', must: false, n: B('Uma página (corpo) para cada nota', 'A page body for each note') },
    ] },
    today: { k: 'today', n: B('Hoje', 'Today'), d: B('O caderno do dia: três coisas, descartável.', 'The day notebook: three things, disposable.'), src: 'doc', req: [
      { id: 'nonotif', must: true, n: B('Sem notificações', 'No notifications') },
      { id: 'nomaint', must: true, n: B('Nada para manter', 'Nothing to maintain') },
      { id: 'draw', must: false, n: B('Espaço para desenhar', 'Room to draw') },
    ] },
    str: { k: 'str', n: B('Estrutura', 'Structure'), d: B('Bases de dados: projetos, equipas, pessoas, reuniões — ligadas.', 'Databases: projects, teams, people, meetings — linked.'), src: 'doc', req: [
      { id: 'fields', must: true, n: B('Registos com campos', 'Records with fields') },
      { id: 'views', must: true, n: B('Filtros e vistas', 'Filters and views') },
      { id: 'links', must: true, n: B('Ligações entre registos', 'Links between records') },
      { id: 'tpl', must: false, n: B('Modelos para registos novos', 'Templates for new records') },
    ] },
    cal: { k: null, n: B('Calendário', 'Calendar'), d: B('O que tem hora marcada — compromissos e blocos de foco.', 'What has a fixed time — appointments and focus blocks.'), src: 'site', req: [
      { id: 'multi', must: true, n: B('Vários calendários (trabalho, pessoal)', 'Several calendars (work, personal)') },
      { id: 'tasks', must: false, n: B('Mostra as tarefas com data ao lado dos eventos', 'Shows dated tasks next to events') },
      { id: 'focus', must: false, n: B('Blocos de foco', 'Focus blocks') },
    ] },
  };

  /* estado de um requisito: y sim · l limitado no grátis · p só pago · n não · c por verificar
     forma: [estado, fonte, nota?] — 'c' dispensa fonte */
  const Y = (s, n) => ['y', s, n], Lm = (s, n) => ['l', s, n], P = (s, n) => ['p', s, n], N = (s, n) => ['n', s, n], C = n => ['c', null, n];
  const OWN = n => ['y', 'own', n];

  const TOOLS = [
    /* ── Ações ── */
    { id: 'todoist', name: 'Todoist', kind: 'app', roles: ['act'], ref: true,
      fit: B('O papel de lista de tarefas do sistema de referência: quick-add numa linha, datas em linguagem natural, filtros.', 'The task-list role in the reference system: one-line quick add, natural-language dates, filters.'),
      feel: B('3 filtros no grátis — exatamente os três do sistema (Hoje, Próximos 7 dias, Seguimentos). Sem calendário nem tabela.', '3 filters on free — exactly the three this system uses (Today, Due in 7 days, Follow-ups). No calendar or table layouts.'),
      free: [
        [B('5 projetos pessoais', '5 personal projects'), 'todoist_p'],
        [B('3 filtros personalizados', '3 custom filters'), 'todoist_p'],
        [B('Lembretes de tarefa incluídos; lembretes personalizados não', 'Task reminders included; custom reminders not'), 'todoist_p'],
        [B('Vistas em lista e quadro; calendário e tabela não', 'List and board layouts; calendar and table not'), 'todoist_p'],
        [B('Ficheiros até 5 MB; 5 colaboradores por projeto', 'Files up to 5 MB; 5 collaborators per project'), 'todoist_p'],
        [B('Datas recorrentes em linguagem natural ("every Monday") no plano grátis', 'Natural-language recurring dates ("every Monday") on the free plan'), 'todoist_rec'],
      ],
      paid: [[B('Pro: 5 USD/mês (anual) ou 7 USD (mensal) — 300 projetos, 150 filtros, calendário, lembretes personalizados, duração', 'Pro: USD 5/month (yearly) or USD 7 (monthly) — 300 projects, 150 filters, calendar, custom reminders, duration'), 'todoist_p']],
      req: { act: { quick: C(), nlp: Y('todoist_rec'), remind: Lm('todoist_p', B('lembretes de tarefa; personalizados só no Pro', 'task reminders; custom ones Pro only')), search: C(), recur: Y('todoist_rec'), filters: Lm('todoist_p', B('3 filtros', '3 filters')), sub: C() } } },
    { id: 'ticktick', name: 'TickTick', kind: 'app', roles: ['act', 'cal'],
      fit: B('Lista de tarefas com calendário básico e hábitos na mesma app.', 'A task list with a basic calendar and habits in the same app.'),
      feel: B('9 listas e 99 tarefas por lista; 2 lembretes por tarefa.', '9 lists and 99 tasks per list; 2 reminders per task.'),
      free: [
        [B('9 listas, 99 tarefas por lista', '9 lists, 99 tasks per list'), 'ticktick_p'],
        [B('19 itens de checklist por tarefa; 2 lembretes por tarefa', '19 checklist items per task; 2 reminders per task'), 'ticktick_p'],
        [B('Vistas lista e Kanban, calendário básico', 'List and Kanban views, basic calendar'), 'ticktick_p'],
        [B('Linguagem natural (NLP) e sincronização entre plataformas', 'Natural language (NLP) and cross-platform sync'), 'ticktick_p'],
        [B('5 hábitos; 2 membros por lista partilhada', '5 habits; 2 members per shared list'), 'ticktick_p'],
      ],
      paid: [[B('Premium: 49,99 USD/ano — 299 listas, 999 tarefas por lista, vistas de calendário completas, duração das tarefas', 'Premium: USD 49.99/year — 299 lists, 999 tasks per list, full calendar views, task duration'), 'ticktick_p']],
      req: { act: { quick: C(), nlp: Y('ticktick_p'), remind: Lm('ticktick_p', B('2 por tarefa', '2 per task')), search: C(), recur: C(), filters: C(), sub: Lm('ticktick_p', B('checklist de 19 itens', '19-item checklist')) },
        cal: { multi: C(), tasks: Lm('ticktick_p', B('calendário básico', 'basic calendar')), focus: C() } } },
    { id: 'gtasks', name: 'Google Tasks', kind: 'app', roles: ['act'],
      fit: B('Se já vives no Gmail e no Google Calendar: as tarefas com data e hora aparecem no calendário.', 'If you already live in Gmail and Google Calendar: tasks with a date and time show up in the calendar.'),
      feel: B('Simples de propósito: não há filtros guardados nem etiquetas — confirma se te chega.', 'Simple on purpose: no saved filters or labels — check it is enough for you.'),
      free: [
        [B('Disponível no Calendar, na app Tasks e no painel lateral do Gmail, Drive e Docs', 'Available in Calendar, the Tasks app and the side panel of Gmail, Drive and Docs'), 'gtasks_h'],
        [B('Subtarefas e datas com notificações', 'Subtasks and due dates with notifications'), 'gtasks_h'],
        [B('Tarefas que se repetem (no Tasks e no Calendar)', 'Repeating tasks (in Tasks and Calendar)'), 'gtasks_rep'],
        [B('Contas de trabalho/escola: o administrador controla o acesso', 'Work/school accounts: the administrator controls access'), 'gtasks_h'],
      ],
      paid: [],
      req: { act: { quick: C(), nlp: C(), remind: Y('gtasks_h', B('notificações por data', 'due-date notifications')), search: C(), recur: Y('gtasks_rep'), filters: C(), sub: Y('gtasks_h') } } },
    { id: 'mstodo', name: 'Microsoft To Do', kind: 'app', roles: ['act'],
      fit: B('Se usas o Outlook: "O meu dia" e as tarefas aparecem no Outlook.', 'If you use Outlook: "My Day" and the tasks show up in Outlook.'),
      feel: B('Listas partilhadas só entre contas pessoais, ou dentro da mesma organização.', 'Shared lists only between personal accounts, or within the same organisation.'),
      free: [
        [B('App grátis (Microsoft Store)', 'Free app (Microsoft Store)'), 'mstodo_store'],
        [B('"O meu dia" para o foco diário; integração com o Outlook', '"My Day" for daily focus; Outlook integration'), 'mstodo_help'],
        [B('Partilhar listas entre contas pessoais, ou dentro da mesma organização; só listas criadas por ti', 'Share lists between personal accounts, or within one organisation; only lists you created'), 'mstodo_share'],
      ],
      paid: [],
      req: { act: { quick: C(), nlp: C(), remind: C(), search: C(), recur: C(), filters: C(), sub: C() } } },

    /* ── Informação (e estrutura) ── */
    { id: 'notion', name: 'Notion', kind: 'app', roles: ['info', 'str'], ref: true,
      fit: B('Notas e estrutura no mesmo sítio: bases com propriedades, vistas, relações e rollups. É a referência do playground.', 'Notes and structure in one place: databases with properties, views, relations and rollups. The playground models it.'),
      feel: B('Histórico de 7 dias e ficheiros até 5 MB. Offline só nas páginas que escolhes descarregar. Pesquisa por palavras inteiras (vê o capítulo).', '7-day history and 5 MB files. Offline only for pages you choose to download. Whole-word search (see the chapter).'),
      free: [
        [B('Blocos ilimitados num espaço só teu; espaços com vários membros têm limite de blocos', 'Unlimited blocks in a solo workspace; multi-member workspaces have a block limit'), 'notion_p'],
        [B('Ficheiros até 5 MB; histórico de páginas de 7 dias', 'Files up to 5 MB; 7-day page history'), 'notion_p'],
        [B('Automações básicas (só botões); IA em teste limitado', 'Basic automations (buttons only); limited AI trial'), 'notion_p'],
        [B('Offline: escolhes as páginas a descarregar', 'Offline: you choose pages to download'), 'notion_p'],
        [B('Relações e rollups: a página de ajuda não indica restrição de plano', 'Relations and rollups: the help page states no plan restriction'), 'notion_rel'],
        [B('Vistas tabela, quadro, cronologia, calendário, lista, galeria e gráfico: sem restrição de plano indicada', 'Table, board, timeline, calendar, list, gallery and chart views: no plan restriction stated'), 'notion_views'],
      ],
      paid: [[B('Plus: 9,50 EUR por membro/mês — ficheiros até 5 GB, histórico de 30 dias, automações de base de dados', 'Plus: EUR 9.50 per member/month — files up to 5 GB, 30-day history, database automations'), 'notion_p']],
      req: { info: { capture: C(), wsearch: C(B('o documento de referência observa pesquisa por palavras inteiras; confirma', 'the reference document observes whole-word search; confirm')), field: Y('notion_p', B('propriedades personalizadas', 'custom properties')), views: Y('notion_views'), offline: Lm('notion_p', B('páginas escolhidas', 'chosen pages')), rel: Y('notion_rel'), body: C() },
        str: { fields: Y('notion_p'), views: Y('notion_views'), links: Y('notion_rel'), tpl: C() } } },
    { id: 'obsidian', name: 'Obsidian', kind: 'app', roles: ['info'],
      fit: B('Notas em ficheiros Markdown no teu disco, offline, sem conta. Grátis também para uso comercial.', 'Notes as Markdown files on your disk, offline, no account. Free for commercial use too.'),
      feel: B('Sincronizar entre aparelhos é pago (Sync) — ou usas outro serviço de ficheiros por tua conta.', 'Syncing between devices is paid (Sync) — or you use another file service yourself.'),
      free: [
        [B('App grátis, "sem limites"; licença comercial não obrigatória', 'Free app, "without limits"; commercial licence not required'), 'obsidian_p'],
        [B('Notas guardadas localmente em Markdown; acessíveis offline', 'Notes stored locally as Markdown; available offline'), 'obsidian_h'],
      ],
      paid: [[B('Sync: 4 USD/mês (anual) · Publish: 8 USD/mês por site (anual) · licença comercial opcional: 50 USD/ano', 'Sync: USD 4/month (yearly) · Publish: USD 8/month per site (yearly) · optional commercial licence: USD 50/year'), 'obsidian_p']],
      req: { info: { capture: C(), wsearch: C(), field: C(), views: C(), offline: Y('obsidian_h'), rel: C(), body: Y('obsidian_h', B('cada nota é um ficheiro', 'each note is a file')) } } },
    { id: 'logseq', name: 'Logseq', kind: 'app', roles: ['info'], oss: 'AGPL-3.0',
      fit: B('Código aberto (AGPL-3.0), em Markdown ou Org-mode, organizado por blocos e diários.', 'Open source (AGPL-3.0), Markdown or Org-mode, organised by blocks and journals.'),
      feel: B('A versão "DB" e a sincronização nova estão em beta/alfa — o próprio projeto avisa que pode haver perda de dados.', 'The "DB" version and new sync are in beta/alpha — the project itself warns data loss is possible.'),
      free: [
        [B('Código aberto, licença AGPL-3.0', 'Open source, AGPL-3.0 licence'), 'logseq_gh'],
        [B('Formatos Markdown e Org-mode', 'Markdown and Org-mode formats'), 'logseq_gh'],
        [B('Versão DB em beta; app móvel nova e colaboração em tempo real em alfa ("data loss is possible")', 'DB version in beta; new mobile app and real-time collaboration in alpha ("data loss is possible")'), 'logseq_gh'],
      ],
      paid: [],
      req: { info: { capture: C(), wsearch: C(), field: C(), views: C(), offline: C(), rel: C(), body: C() } } },
    { id: 'anytype', name: 'Anytype', kind: 'app', roles: ['info', 'str'], oss: B('código disponível (Any Source Available 1.0)', 'source available (Any Source Available 1.0)'),
      fit: B('Local-first e com encriptação ponta a ponta, com objetos e tipos — notas e estrutura sem servidor obrigatório.', 'Local-first and end-to-end encrypted, with objects and types — notes and structure without a mandatory server.'),
      feel: B('Os limites do plano grátis (armazenamento remoto, espaços partilhados) estão numa página que não conseguimos ler de forma fiável: confirma na app.', 'Free-plan limits (remote storage, shared spaces) live on a page we could not read reliably: check in the app.'),
      free: [
        [B('Há um plano grátis e vários pagos; os pagos aumentam o armazenamento e os espaços partilhados', 'There is a free tier and several paid ones; paid ones raise storage and shared spaces'), 'anytype_doc'],
        [B('Acima do limite, os espaços deixam de sincronizar pelo nó de backup e ficam só locais', 'Over the limit, spaces stop syncing via the backup node and stay local only'), 'anytype_doc'],
        [B('"Local-first, peer-to-peer & end-to-end-encrypted"; offline-first', '"Local-first, peer-to-peer & end-to-end-encrypted"; offline-first'), 'anytype_gh'],
      ],
      paid: [],
      req: { info: { capture: C(), wsearch: C(), field: C(), views: C(), offline: Y('anytype_gh'), rel: C(), body: C() },
        str: { fields: C(), views: C(), links: C(), tpl: C() } } },
    { id: 'capacities', name: 'Capacities', kind: 'app', roles: ['info', 'str'],
      fit: B('Notas como objetos com tipos próprios (pessoa, livro, reunião), ilimitados no grátis. Pensado para uma pessoa.', 'Notes as objects with your own types (person, book, meeting), unlimited on free. Built for individuals.'),
      feel: B('Gestão de tarefas, consultas inteligentes e histórico de versões só no Pro.', 'Task management, smart queries and version history are Pro only.'),
      free: [
        [B('Objetos, espaços e tipos de objeto ilimitados', 'Unlimited objects, spaces and object types'), 'capacities_p'],
        [B('Media até 5 GB no total, depois 100 MB por mês', 'Media up to 5 GB total, then 100 MB per month'), 'capacities_p'],
        [B('Offline e sincronização entre aparelhos', 'Offline and sync across devices'), 'capacities_p'],
        [B('Partilha só de leitura; sem edição a várias pessoas', 'View-only sharing; no multi-user editing'), 'capacities_p'],
      ],
      paid: [[B('Pro: 9,99 USD/mês — tarefas, consultas inteligentes, calendário, histórico de versões, IA', 'Pro: USD 9.99/month — tasks, smart queries, calendar integration, version history, AI'), 'capacities_p']],
      req: { info: { capture: C(), wsearch: C(), field: Y('capacities_p', B('tipos de objeto próprios', 'custom object types')), views: C(), offline: Y('capacities_p'), rel: C(), body: C() },
        str: { fields: Y('capacities_p'), views: P('capacities_p', B('consultas inteligentes no Pro', 'smart queries on Pro')), links: C(), tpl: C() } } },
    { id: 'joplin', name: 'Joplin', kind: 'app', roles: ['info'], oss: B('código aberto', 'open source'), e2ee: true,
      fit: B('Código aberto, encriptação ponta a ponta, e sincronizas pelo serviço que já tens (Dropbox, OneDrive) ou pelo Joplin Cloud.', 'Open source, end-to-end encryption, and you sync through a service you already have (Dropbox, OneDrive) or Joplin Cloud.'),
      feel: B('Partilhar cadernos com outras pessoas é do Joplin Cloud Pro.', 'Sharing notebooks with others is Joplin Cloud Pro.'),
      free: [
        [B('App de código aberto para Windows, macOS, Linux, Android e iOS', 'Open-source app for Windows, macOS, Linux, Android and iOS'), 'joplin_h'],
        [B('Sincroniza com Joplin Cloud, Dropbox e OneDrive', 'Syncs with Joplin Cloud, Dropbox and OneDrive'), 'joplin_h'],
        [B('Encriptação ponta a ponta (E2EE)', 'End-to-end encryption (E2EE)'), 'joplin_h'],
      ],
      paid: [[B('Joplin Cloud Basic: 2,99 EUR/mês — 2 GB; Pro: 5,99 EUR/mês — 30 GB e partilha de cadernos', 'Joplin Cloud Basic: EUR 2.99/month — 2 GB; Pro: EUR 5.99/month — 30 GB and notebook sharing'), 'joplin_p']],
      req: { info: { capture: C(), wsearch: C(), field: C(), views: C(), offline: C(), rel: C(), body: C() } } },
    { id: 'standardnotes', name: 'Standard Notes', kind: 'app', roles: ['info'], e2ee: true,
      fit: B('Privacidade primeiro: encriptação ponta a ponta e sincronização ilimitada entre aparelhos no grátis.', 'Privacy first: end-to-end encryption and unlimited device sync on free.'),
      feel: B('No grátis, só notas de texto simples; o editor rico, pastas e o histórico ficam no pago.', 'On free, plain-text notes only; the rich editor, folders and history are paid.'),
      free: [
        [B('Sincronização ilimitada de aparelhos (web, desktop, móvel)', 'Unlimited device sync (web, desktop, mobile)'), 'sn_p'],
        [B('Encriptação ponta a ponta; acesso offline', 'End-to-end encryption; offline access'), 'sn_p'],
        [B('Só notas de texto simples; etiquetas; histórico só da sessão atual', 'Plain-text notes only; tags; history for the current session only'), 'sn_p'],
      ],
      paid: [[B('Productivity: 90 USD/ano — notas "Super", pastas, histórico de 1 ano', 'Productivity: USD 90/year — "Super" notes, folders, 1-year history'), 'sn_p']],
      req: { info: { capture: C(), wsearch: C(), field: Y('sn_p', B('etiquetas', 'tags')), views: C(), offline: Y('sn_p'), rel: N('sn_p', B('texto simples', 'plain text')), body: C() } } },
    { id: 'simplenote', name: 'Simplenote', kind: 'app', roles: ['info'],
      fit: B('Totalmente grátis e mínimo: notas, etiquetas, Markdown, sincronização e histórico.', 'Entirely free and minimal: notes, tags, Markdown, sync and history.'),
      feel: B('Não há vistas filtradas nem campos — só etiquetas e pesquisa.', 'No filtered views or fields — only tags and search.'),
      free: [
        [B('"Tudo completamente grátis": apps, backups, sincronização, partilha', '"All completely free": apps, backups, syncing, sharing'), 'simplenote_h'],
        [B('Etiquetas, Markdown, histórico de versões', 'Tags, Markdown, version history'), 'simplenote_h'],
        [B('iOS, Android, Mac, Windows, Linux e browser', 'iOS, Android, Mac, Windows, Linux and browser'), 'simplenote_h'],
      ],
      paid: [],
      req: { info: { capture: C(), wsearch: C(), field: Y('simplenote_h', B('etiquetas', 'tags')), views: C(), offline: C(), rel: C(), body: C() } } },
    { id: 'keep', name: 'Google Keep', kind: 'app', roles: ['info'],
      fit: B('Captura muito rápida (texto, lista, foto, áudio), etiquetas e offline, ligado à conta Google.', 'Very fast capture (text, list, photo, audio), labels and offline, tied to your Google account.'),
      feel: B('Pensado para notas soltas: sem campos nem vistas guardadas para uma triagem semanal.', 'Built for loose notes: no fields or saved views for a weekly triage.'),
      free: [
        [B('Notas, listas, fotos, desenhos e áudio; lembretes', 'Notes, lists, photos, drawings and audio; reminders'), 'keep_h'],
        [B('Etiquetas, cores, filtros, pesquisa', 'Labels, colours, filters, search'), 'keep_h'],
        [B('Edição partilhada em tempo real; funciona offline e sincroniza depois', 'Real-time shared editing; works offline and syncs later'), 'keep_h'],
      ],
      paid: [],
      req: { info: { capture: C(), wsearch: C(), field: Y('keep_h', B('etiquetas', 'labels')), views: Lm('keep_h', B('filtros por etiqueta/cor', 'filters by label/colour')), offline: Y('keep_h'), rel: C(), body: C() } } },

    /* ── Estrutura / projetos ── */
    { id: 'clickup', name: 'ClickUp', kind: 'app', roles: ['str', 'act'],
      fit: B('Gestão de projetos completa para equipas, com documentos e automações.', 'Full project management for teams, with docs and automations.'),
      feel: B('60 MB de armazenamento; campos personalizados e Gantt são "trial" no grátis.', '60 MB storage; custom fields and Gantt are "trial" on free.'),
      free: [
        [B('60 MB de armazenamento (só anexos contam)', '60 MB storage (only attachments count)'), 'clickup_p'],
        [B('Membros ilimitados; 5 Spaces, 40 listas por Space', 'Unlimited members; 5 Spaces, 40 Lists per Space'), 'clickup_p'],
        [B('Campos personalizados, Gantt, cronologia, dashboards: só em trial', 'Custom fields, Gantt, timeline, dashboards: trial only'), 'clickup_p'],
        [B('100 ações de automação/mês, 5 regras ativas', '100 automation actions/month, 5 active rules'), 'clickup_p'],
      ],
      paid: [[B('Core: 9 USD por utilizador/mês (anual) — armazenamento e Spaces ilimitados, campos personalizados', 'Core: USD 9 per user/month (yearly) — unlimited storage and Spaces, custom fields'), 'clickup_p']],
      req: { str: { fields: Lm('clickup_p', B('campos em trial', 'fields on trial')), views: C(), links: C(), tpl: C() },
        act: { quick: C(), nlp: C(), remind: C(), search: C(), recur: C(), filters: C(), sub: C() } } },
    { id: 'trello', name: 'Trello', kind: 'app', roles: ['str'],
      fit: B('Quadros Kanban simples: um quadro de projetos Now / Next / Later em minutos.', 'Simple Kanban boards: a Now / Next / Later projects board in minutes.'),
      feel: B('10 quadros por espaço; campos personalizados só no Standard; calendário e tabela só no Premium.', '10 boards per workspace; custom fields only on Standard; calendar and table only on Premium.'),
      free: [
        [B('Até 10 colaboradores e 10 quadros por Workspace; cartões ilimitados', 'Up to 10 collaborators and 10 boards per Workspace; unlimited cards'), 'trello_p'],
        [B('Ficheiros até 10 MB; 250 execuções de automação/mês', 'Files up to 10 MB; 250 automation runs/month'), 'trello_p'],
        [B('Vistas Calendário, Cronologia, Tabela: só Premium', 'Calendar, Timeline, Table views: Premium only'), 'trello_p'],
      ],
      paid: [[B('Standard: 5 USD por utilizador/mês (anual) — quadros ilimitados, campos personalizados', 'Standard: USD 5 per user/month (yearly) — unlimited boards, custom fields'), 'trello_p']],
      req: { str: { fields: P('trello_p', B('campos no Standard', 'fields on Standard')), views: Lm('trello_p', B('quadro; calendário/tabela no Premium', 'board; calendar/table on Premium')), links: C(), tpl: C() } } },
    { id: 'asana', name: 'Asana', kind: 'app', roles: ['str', 'act'],
      fit: B('Projetos e tarefas para duas pessoas no grátis, com lista, quadro e calendário.', 'Projects and tasks for two people on free, with list, board and calendar.'),
      feel: B('2 utilizadores; campos personalizados, cronologia e modelos só no Starter.', '2 users; custom fields, timeline and templates only on Starter.'),
      free: [
        [B('2 utilizadores; tarefas e projetos ilimitados', '2 users; unlimited tasks and projects'), 'asana_p'],
        [B('Vistas lista, quadro e calendário', 'List, board and calendar views'), 'asana_p'],
        [B('Armazenamento ilimitado, ficheiros até 100 MB', 'Unlimited storage, files up to 100 MB'), 'asana_p'],
      ],
      paid: [[B('Starter: 10,99 USD por utilizador/mês (anual) — cronologia, campos personalizados, modelos, automações', 'Starter: USD 10.99 per user/month (yearly) — timeline, custom fields, templates, automations'), 'asana_p']],
      req: { str: { fields: P('asana_p', B('campos no Starter', 'fields on Starter')), views: Y('asana_p', B('lista, quadro, calendário', 'list, board, calendar')), links: C(), tpl: P('asana_p') },
        act: { quick: C(), nlp: C(), remind: C(), search: C(), recur: C(), filters: C(), sub: C() } } },
    { id: 'linear', name: 'Linear', kind: 'app', roles: ['str'],
      fit: B('Para equipas de software: issues, ciclos e projetos. Não é uma ferramenta pessoal.', 'For software teams: issues, cycles and projects. Not a personal tool.'),
      feel: B('250 issues no total e 2 equipas no grátis.', '250 issues in total and 2 teams on free.'),
      free: [
        [B('Membros ilimitados, 2 equipas, 250 issues', 'Unlimited members, 2 teams, 250 issues'), 'linear_p'],
        [B('Ficheiros até 10 MB; API e webhooks', 'Files up to 10 MB; API and webhooks'), 'linear_p'],
      ],
      paid: [[B('Basic: 10 USD por utilizador/mês (anual) — issues ilimitadas, 5 equipas', 'Basic: USD 10 per user/month (yearly) — unlimited issues, 5 teams'), 'linear_p']],
      req: { str: { fields: C(), views: C(), links: C(), tpl: C() } } },

    /* ── Calendário ── */
    { id: 'gcal', name: 'Google Calendar', kind: 'app', roles: ['cal'],
      fit: B('Vários calendários, blocos de foco que silenciam notificações, e as tarefas do Google Tasks com hora.', 'Several calendars, focus blocks that mute notifications, and Google Tasks with a time.'),
      feel: B('Algumas funções de agendamento de marcações exigem Google Workspace ou Google One.', 'Some appointment-schedule features require Google Workspace or Google One.'),
      free: [
        [B('Calendários separados para trabalho, pessoal e outros; partilha', 'Separate calendars for work, personal and others; sharing'), 'gcal_h'],
        [B('Tarefas com data e hora aparecem no calendário', 'Tasks with a date and time appear in the calendar'), 'gcal_h'],
        [B('Contas pessoais podem criar agendamentos; algumas funções exigem subscrição', 'Personal accounts can create appointment schedules; some features need a subscription'), 'gcal_appt'],
      ],
      paid: [],
      req: { cal: { multi: Y('gcal_h'), tasks: Y('gcal_h'), focus: C(B('a página descreve "período de concentração"; confirma se está na tua conta', 'the page describes "focus time"; confirm it is on your account')) } } },
    { id: 'ncal', name: 'Notion Calendar', kind: 'app', roles: ['cal'],
      fit: B('Um calendário grátis por cima do Google, Outlook ou iCloud que mostra itens das tuas bases do Notion.', 'A free calendar on top of Google, Outlook or iCloud that shows items from your Notion databases.'),
      feel: B('Não é um calendário próprio: precisa de uma conta Google, Outlook ou iCloud.', 'Not a calendar of its own: it needs a Google, Outlook or iCloud account.'),
      free: [
        [B('Grátis', 'Free'), 'ncal_h'],
        [B('Liga a Google Calendar, Outlook e iCloud', 'Connects Google Calendar, Outlook and iCloud'), 'ncal_h'],
        [B('Mostra itens de bases do Notion ao lado dos eventos', 'Shows Notion database items next to events'), 'ncal_h'],
      ],
      paid: [],
      req: { cal: { multi: Y('ncal_h'), tasks: Lm('ncal_h', B('itens de bases do Notion', 'Notion database items')), focus: C() } } },

    /* ── Analógico (sem plano: o custo é o papel) ── */
    { id: 'notebook', name: B('Caderno', 'Notebook'), kind: 'paper', roles: ['today'], ref: true,
      fit: B('O papel de "Hoje" no sistema de referência: três coisas por dia, ✓ → ✕ à noite, página que morre.', 'The "Today" role in the reference system: three things a day, ✓ → ✕ at night, a page that dies.'),
      feel: B('Não guarda nada a longo prazo — e é isso que se quer.', 'It keeps nothing long-term — which is the point.'),
      free: [], paid: [],
      req: { today: { nonotif: OWN(), nomaint: OWN(), draw: OWN() } } },
    { id: 'bujo', name: 'Bullet Journal', kind: 'paper', roles: ['today', 'act'],
      fit: B('Um método de caderno (Ryder Carroll) com símbolos, registos diários e mensais e migração.', 'A notebook method (Ryder Carroll) with symbols, daily and monthly logs and migration.'),
      feel: B('Como lista de tarefas completa, falta-lhe lembrete a uma hora e pesquisa — por isso aqui fica no papel de Hoje.', 'As a full task list it lacks timed reminders and search — so here it stays in the Today role.'),
      free: [[B('O método está descrito gratuitamente no site do autor', 'The method is described for free on the author\'s site'), 'bujo']], paid: [],
      req: { today: { nonotif: OWN(), nomaint: ['l', 'own', B('a migração mensal é manutenção', 'monthly migration is maintenance')], draw: OWN() },
        act: { quick: ['n', 'own'], nlp: ['n', 'own'], remind: ['n', 'own'], search: ['n', 'own'], recur: ['l', 'own', B('copiado à mão', 'copied by hand')], filters: ['n', 'own'], sub: OWN() } } },
    { id: 'planner', name: B('Agenda de papel', 'Paper planner'), kind: 'paper', roles: ['today', 'cal'],
      fit: B('Dias e horas já impressos: bom para ver a semana e os compromissos de relance.', 'Days and hours already printed: good for seeing the week and appointments at a glance.'),
      feel: B('Compromissos partilhados com outras pessoas continuam a precisar de um calendário digital.', 'Appointments shared with others still need a digital calendar.'),
      free: [], paid: [],
      req: { today: { nonotif: OWN(), nomaint: OWN(), draw: ['l', 'own', B('pouco espaço livre', 'little free space')] },
        cal: { multi: ['n', 'own'], tasks: ['l', 'own', B('escritas à mão', 'written by hand')], focus: OWN() } } },
  ];

  const STATES = {
    y: { l: B('Sim', 'Yes'), s: '●' }, l: { l: B('Limitado no grátis', 'Limited on free'), s: '◐' }, p: { l: B('Só pago', 'Paid only'), s: '$' },
    n: { l: B('Não', 'No'), s: '○' }, c: { l: B('Por verificar', 'Not verified'), s: '?' },
  };
  /* resumo transparente: contagem por estado nos requisitos "must" de um papel — não é uma nota */
  function tally(tool, role) {
    const R = ROLES[role], r = (tool.req || {})[role]; if (!r) return null;
    const out = { y: 0, l: 0, p: 0, n: 0, c: 0, total: 0 };
    R.req.filter(q => q.must).forEach(q => { const v = r[q.id] || ['c']; out[v[0]]++; out.total++; });
    return out;
  }
  const tool = id => TOOLS.find(t => t.id === id);
  return { SRC, ROLES, TOOLS, STATES, tally, tool, VERIFIED: D };
})();
