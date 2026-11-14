/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — conteúdo dos capítulos (Aprender)
   ──────────────────────────────────────────────────────────────────
   Base conceptual: "A Personal Productivity System: Capture, Triage,
   Review" (documento de referência do projeto). Reorganizado para ensinar:
   cada capítulo tem uma ideia central, uma demonstração ao vivo e o que
   levar. Marcadores no texto:
     <span data-src="est"></span>  conceito estabelecido (GTD, PARA, BuJo…)
     <span data-src="own"></span>  escolha de desenho do sistema de referência
     <span data-src="chk"></span>  depende do produto — confirmar na app
     <div data-demo="id"></div>    demonstração (pr-learn.js)
   HTML de confiança (escrito aqui), por isso não é escapado.
   ══════════════════════════════════════════════════════════════════ */
const PrLearnContent = (function () {
  'use strict';
  const B = (pt, en) => ({ pt, en });

  const BLOCKS = [
    { id: 'modelo', name: B('O modelo', 'The model'), d: B('Independente de qualquer app.', 'Independent of any app.') },
    { id: 'metodos', name: B('Os métodos', 'The methods'), d: B('GTD para as ações, um caderno para o dia, uma caixa para a informação, PARA para a estrutura.', 'GTD for actions, a notebook for the day, an inbox for information, PARA for structure.') },
    { id: 'estrutura', name: B('A estrutura', 'The structure'), d: B('Páginas, bases de dados, relações, e o ritmo que mantém tudo vivo.', 'Pages, databases, relations, and the rhythm that keeps it alive.') },
  ];

  const CH = [
  /* ───────────────────────── 1 ───────────────────────── */
  { id: 'quatro', block: 'modelo', min: 5, kinds: ['act', 'info', 'today', 'str'],
    title: B('Quatro espécies, quatro lugares', 'Four kinds, four places'),
    lede: B('Quase toda a gente perde o fio pelas mesmas razões. A solução não é uma app melhor — é um modelo pequeno, seguido com consistência.',
            'Most people lose track for the same few reasons. The fix is not a better app — it is a small model, followed consistently.'),
    body: {
      pt: `
<h2>O problema</h2>
<p>Ações e informação misturadas no mesmo sítio. Demasiados sítios para ver. Estrutura construída antes de haver alguma coisa para lá pôr. E nada que obrigue a olhar, com regularidade, para o que se foi acumulando. Cada uma destas falhas, sozinha, já basta para deixares de confiar no sistema — e um sistema em que não confias volta a viver na tua cabeça.</p>
<h2>Tudo o que te pede atenção é uma de quatro coisas</h2>
<p>Cada espécie tem um lugar, e cada lugar tem um só trabalho. <span data-src="own"></span></p>
<div data-demo="kinds"></div>
<p>Os nomes das ferramentas são exemplos de <em>categorias</em>, não recomendações testadas. O que importa é que cada lugar consiga fazer o seu trabalho:</p>
<table class="lr-table"><thead><tr><th>Papel</th><th>Tem de ter</th><th>É bom ter</th></tr></thead><tbody>
<tr><td><span class="k-tag k-act">Ações</span></td><td>Adicionar a partir do ecrã inicial do telemóvel; datas e horas em linguagem natural; lembretes a uma hora; pesquisa; tarefas recorrentes</td><td>Filtros guardados; subtarefas</td></tr>
<tr><td><span class="k-tag k-info">Informação</span></td><td>Capturar uma linha em dois toques ou menos; pesquisa por palavras inteiras; um campo de equipa/etiqueta; vistas filtradas; funcionar offline</td><td>Relações a outros registos; uma página por nota</td></tr>
<tr><td><span class="k-tag k-today">Hoje</span></td><td>Sem notificações; nada para manter</td><td>Espaço para desenhar</td></tr>
<tr><td><span class="k-tag k-str">Estrutura</span></td><td>Registos com campos; filtros e vistas; ligações entre registos</td><td>Modelos para registos novos</td></tr>
</tbody></table>
<p class="lr-note">Se uma ferramenta falha um "tem de ter", vais senti-lo na primeira semana. O <a href="#explorar/ferramentas">diretório de ferramentas</a> usa exatamente esta lista.</p>
<h2>Experimenta</h2>
<p>Seis coisas que chegam num dia normal. Para onde vai cada uma?</p>
<div data-demo="sorter"></div>`,
      en: `
<h2>The problem</h2>
<p>Actions and information mixed in one place. Too many places to look. Structure built before there is anything to put in it. And nothing that forces a regular look at what has piled up. Any one of these failures is enough to stop you trusting the system — and a system you do not trust moves back into your head.</p>
<h2>Everything that asks for your attention is one of four kinds</h2>
<p>Each kind gets one place, and each place has one job. <span data-src="own"></span></p>
<div data-demo="kinds"></div>
<p>Tool names are examples of <em>categories</em>, not tested recommendations. What matters is that each place can do its job:</p>
<table class="lr-table"><thead><tr><th>Role</th><th>Must have</th><th>Nice to have</th></tr></thead><tbody>
<tr><td><span class="k-tag k-act">Actions</span></td><td>Quick add from the phone's home screen; natural-language dates and times; reminders at a time; search; recurring tasks</td><td>Saved filters; subtasks</td></tr>
<tr><td><span class="k-tag k-info">Information</span></td><td>One-line capture in two taps or fewer; whole-word search; a team/tag field; filtered views; works offline</td><td>Relations to other records; a page body for each note</td></tr>
<tr><td><span class="k-tag k-today">Today</span></td><td>No notifications; nothing to maintain</td><td>Room to draw</td></tr>
<tr><td><span class="k-tag k-str">Structure</span></td><td>Records with fields; filters and views; links between records</td><td>Templates for new records</td></tr>
</tbody></table>
<p class="lr-note">If a tool fails a "must have", you will feel it within a week. The <a href="#explorar/ferramentas">tool directory</a> uses exactly this list.</p>
<h2>Try it</h2>
<p>Six things that arrive on a normal day. Where does each one go?</p>
<div data-demo="sorter"></div>`,
    },
    take: B(['Quatro espécies: ações, informação, hoje, estrutura.', 'Um lugar por espécie, um trabalho por lugar.', 'Escolhe ferramentas pelo que o lugar tem de fazer, não pela marca.'],
            ['Four kinds: actions, information, today, structure.', 'One place per kind, one job per place.', 'Choose tools by what the place must do, not by brand.']),
    next: [{ href: '#aplicar/triagem', l: B('Mais 12 casos: Para onde vai isto?', '12 more cases: Where does this go?') }, { href: '#explorar/mapa', l: B('O mapa do sistema', 'The system map') }],
  },

  /* ───────────────────────── 2 ───────────────────────── */
  { id: 'ciclo', block: 'modelo', min: 6, kinds: ['act', 'info'],
    title: B('O ciclo: capturar, triar, rever', 'The loop: capture, triage, review'),
    lede: B('Capturar é instantâneo e sem arrumar. Arrumar acontece uma vez por semana, em lote. É esta separação que torna a captura barata o suficiente para a fazeres sempre.',
            'Capture is instant and unsorted. Sorting happens once a week, in batch. That split is what makes capture cheap enough to do every time.'),
    body: {
      pt: `
<h2>Duas caixas de entrada, não uma nem doze</h2>
<p>O GTD pede poucos pontos de captura, esvaziados com regularidade <span data-src="est"></span>. O <em>Building a Second Brain</em> diz o mesmo de outra maneira: capturar primeiro, organizar depois — e as ações vão para o gestor de tarefas, as notas para a app de notas <span data-src="est"></span>. Daí as duas caixas: <b>ações</b> numa lista de tarefas, <b>informação</b> numa caixa de notas. Uma nota nunca é um "a fazer", e um "a fazer" nunca é uma nota.</p>
<p>O caderno do dia <em>não</em> é uma caixa de entrada: é foco. Uma ideia que chega a meio do dia vai para a lista (se for ação) ou para as Notas (se for informação) — nunca para a página, onde morreria com ela.</p>
<h2>A revisão semanal é o motor</h2>
<p>Uma reunião contigo, com agenda fixa e limite de tempo, cerca de 20 minutos <span data-src="own"></span>. A revisão é o "fator crítico de sucesso" do GTD — e é também onde mais vezes falha, sobretudo quando cresce <span data-src="est"></span>. Por isso há uma versão mínima para semanas más.</p>
<h2>Cada nota acaba algures</h2>
<p>Na revisão, cada nota nova recebe <b>um</b> destino. Nada fica a envelhecer no meio. <span data-src="own"></span></p>
<div data-demo="fates"></div>
<p class="lr-note">A regra dos dois minutos — se demora menos de dois minutos, faz já — pertence ao passo de <em>clarificar</em>, não à captura <span data-src="est"></span>. Durante o dia, só capturas; na triagem é que decides se é coisa de dois minutos.</p>`,
      en: `
<h2>Two inboxes, not one and not twelve</h2>
<p>GTD asks for few capture points, emptied regularly <span data-src="est"></span>. <em>Building a Second Brain</em> says the same in other words: capture first, organize later — and action items go to the task manager, notes to the notes app <span data-src="est"></span>. Hence two inboxes: <b>actions</b> in a task list, <b>information</b> in a notes inbox. A note is never a to-do, and a to-do is never a note.</p>
<p>The day notebook is <em>not</em> an inbox: it is focus. A thought that arrives mid-day goes to the list (if it is an action) or to Notes (if it is information) — never onto the page, where it would die with it.</p>
<h2>The weekly review is the engine</h2>
<p>One meeting with yourself, with a fixed agenda and a time limit, about 20 minutes <span data-src="own"></span>. The review is GTD's critical success factor — and also where it most often breaks down, especially as it grows <span data-src="est"></span>. That is why there is a minimum version for bad weeks.</p>
<h2>Every note ends somewhere</h2>
<p>At the review, each new note gets <b>one</b> fate. Nothing ages in the middle. <span data-src="own"></span></p>
<div data-demo="fates"></div>
<p class="lr-note">The two-minute rule — if it takes less than two minutes, do it now — belongs to the <em>clarify</em> step, not to capture <span data-src="est"></span>. During the day you only capture; at triage you decide whether it is a two-minute thing.</p>`,
    },
    take: B(['Captura sem classificar; classifica em lote.', 'Duas caixas: ações e informação. O caderno é foco, não captura.', 'Cada nota recebe um destino na revisão.'],
            ['Capture without classifying; classify in batch.', 'Two inboxes: actions and information. The notebook is focus, not capture.', 'Every note gets a fate at the review.']),
    next: [{ href: '#aplicar/semana', l: B('Viver o ciclo durante uma semana', 'Live the loop for a week') }, { href: '#experimentar/captura', l: B('Laboratório de captura', 'Capture lab') }],
  },

  /* ───────────────────────── 3 ───────────────────────── */
  { id: 'ideias', block: 'modelo', min: 7, kinds: ['act', 'info', 'str'],
    title: B('Oito ideias que fazem funcionar', 'Eight ideas that make it work'),
    lede: B('Cada escolha do sistema vem de uma destas oito ideias. Se perceberes as ideias, consegues reconstruí-lo em qualquer ferramenta.',
            'Every choice in the system comes from one of these eight ideas. Understand the ideas and you can rebuild it in any tool.'),
    body: {
      pt: `
<ol class="lr-ideas">
<li><b>Capturar sem classificar.</b> Escrever tem de custar segundos. Onde fica, decide-se depois, em lote. <span data-src="est"></span></li>
<li><b>Duas caixas de entrada.</b> Ações numa, informação na outra. <span data-src="est"></span></li>
<li><b>Uma casa por coisa; ligar pelo nome, não copiar.</b> Se os dados verdadeiros vivem noutro sítio (um ticket, um painel), guarda a definição e a ligação. Uma cópia de um número fica desatualizada no dia seguinte. <span data-src="own"></span></li>
<li><b>Nomear em palavras inteiras.</b> Títulos que se percebem sozinhos, e o projeto chamado pelo próprio nome em todo o lado. Esse hábito deixa a pesquisa arrumar por ti. <span data-src="own"></span></li>
<li><b>A revisão semanal é o motor.</b> Sem ela, cada caixa vira cemitério. <span data-src="est"></span></li>
<li><b>Cada nota acaba algures.</b> Agir, guardar, arquivar no sítio, graduar ou deitar fora. <span data-src="own"></span></li>
<li><b>A estrutura merece-se.</b> Começa com poucas bases de dados; uma nova só aparece depois de o mesmo tipo de nota surgir três vezes — a regra de três. <span data-src="own"></span></li>
<li><b>Limitar compromissos olhando, não com tetos.</b> Cada revisão inclui uma verificação rápida de capacidade, e um bloco protegido por semana vai para o que mais importa. <span data-src="own"></span></li>
</ol>
<h2>Pesquisar antes de estruturar</h2>
<p>Num estudo de campo da IBM com 345 utilizadores de email e cerca de 85 000 ações de reencontrar mensagens, quem arrumava em pastas não encontrava as coisas com mais sucesso do que quem pesquisava <span data-src="est"></span>. É email, não notas — trata-o como indício, não prova. A regra prática é a mesma a que outros praticantes chegam: arruma só o que a pesquisa não encontra.</p>
<p>Este sistema leva isto à letra: o elo entre uma tarefa, uma nota e um projeto é só <b>o nome do projeto, escrito como o dizes</b>, entre parênteses no fim do título. Experimenta pesquisar no mundo de exemplo:</p>
<div data-demo="search"></div>
<p class="lr-note">O documento de referência observou que a pesquisa do Notion só encontrou palavras inteiras ("tes" não encontrou "test") <span data-src="chk"></span>. Esta demonstração imita esse comportamento, para veres porque é que <em>armazém</em> funciona e <em>arm</em> não.</p>
<h2>Começar pequeno</h2>
<table class="lr-table"><tbody>
<tr><td><b>Semana 1</b></td><td>A lista de tarefas com alguns filtros guardados; a caixa de Notas; a revisão semanal.</td></tr>
<tr><td><b>Semana 3</b></td><td>Uma base de Projetos e uma base central (Equipas ou Áreas), para ligar as notas.</td></tr>
<tr><td><b>Mais tarde</b></td><td>Pessoas, 1:1, Reuniões — as seis bases centrais.</td></tr>
<tr><td><b>Só quando for preciso</b></td><td>Bases opcionais, cada uma depois de a regra de três o pedir.</td></tr>
</tbody></table>`,
      en: `
<ol class="lr-ideas">
<li><b>Capture without classifying.</b> Writing it down must cost seconds. Where it lives is decided later, in batch. <span data-src="est"></span></li>
<li><b>Two inboxes.</b> Actions in one, information in the other. <span data-src="est"></span></li>
<li><b>One home per thing; link by name, don't copy.</b> If the real data lives elsewhere (a ticket, a dashboard), keep the definition and a link. A copied number is out of date the next day. <span data-src="own"></span></li>
<li><b>Name things in whole words.</b> Titles that stand alone, and a project referred to by its own name everywhere. That habit lets search do the filing for you. <span data-src="own"></span></li>
<li><b>The weekly review is the engine.</b> Without it, every inbox becomes a graveyard. <span data-src="est"></span></li>
<li><b>Every note ends somewhere.</b> Act, keep, file, graduate or toss. <span data-src="own"></span></li>
<li><b>Structure is earned.</b> Start with a handful of databases; a new one appears only after the same kind of note has shown up three times — the rule of three. <span data-src="own"></span></li>
<li><b>Limit commitments by looking, not by caps.</b> Each review includes a quick capacity check, and one protected block each week goes to what matters most. <span data-src="own"></span></li>
</ol>
<h2>Search before structure</h2>
<p>In an IBM field study of 345 email users and about 85,000 re-finding actions, people who filed into folders were no more successful at finding things than people who searched <span data-src="est"></span>. It is email, not notes — treat it as supporting evidence, not proof. The practical rule is the one other practitioners reach: organize only what search cannot find.</p>
<p>This system takes that literally: the link between a task, a note and a project is just <b>the project's name, written the way you say it</b>, in brackets at the end of the title. Try searching the sample world:</p>
<div data-demo="search"></div>
<p class="lr-note">The reference document observed that Notion search only found whole words ("tes" did not find "test") <span data-src="chk"></span>. This demo imitates that behaviour, so you can see why <em>warehouse</em> works and <em>ware</em> does not.</p>
<h2>Start small</h2>
<table class="lr-table"><tbody>
<tr><td><b>Week 1</b></td><td>The task list with a few saved filters; the Notes inbox; the weekly review.</td></tr>
<tr><td><b>Week 3</b></td><td>A Projects database and a hub database (Teams or Areas), to link notes.</td></tr>
<tr><td><b>Later</b></td><td>Persons, 1:1s, Meetings — the six core databases.</td></tr>
<tr><td><b>Only when needed</b></td><td>Optional databases, each one only after the rule of three asks for it.</td></tr>
</tbody></table>`,
    },
    take: B(['Arruma só o que a pesquisa não encontra.', 'O nome do projeto no título é o elo entre tudo.', 'Começa pela lista, pelas Notas e pela revisão.'],
            ['Organize only what search cannot find.', 'The project name in the title is the link between everything.', 'Start with the list, Notes and the review.']),
    next: [{ href: '#aplicar/projeto', l: B('Construir um projeto e encontrá-lo pelo nome', 'Build a project and find it by name') }],
  },

  /* ───────────────────────── 4 ───────────────────────── */
  { id: 'gtd', block: 'metodos', min: 9, kinds: ['act'],
    title: B('GTD: ações que não voltam para a cabeça', 'GTD: actions that stay out of your head'),
    lede: B('Tudo o que tem a tua atenção e não está num sistema em que confias cria um "ciclo aberto". O GTD fecha esses ciclos em cinco etapas.',
            'Anything that has your attention but is not captured in a system you trust creates an "open loop". GTD closes those loops in five stages.'),
    body: {
      pt: `
<div data-demo="gtd5"></div>
<h2>Clarificar: começa sempre por um verbo</h2>
<p>O GTD define a "próxima ação" como uma atividade física e visível <span data-src="est"></span>. "Reunião com fornecedor" fica ambíguo em poucos dias: era para marcar? preparar? só aparecer? "Marcar reunião com fornecedor" nunca perde o sentido, porque o verbo <em>é</em> a clarificação.</p>
<div data-demo="verbfirst"></div>
<p>Um vocabulário pequeno e estável de verbos ajuda. Dois carregam quase todo o peso dos compromissos <span data-src="own"></span>: <b>Verificar</b> (confirmar que algo de outra pessoa ficou mesmo feito) e <b>Insistir</b> (estás à espera de alguém; a data é quando vais voltar a perguntar).</p>
<h2>Organizar: três contentores, pelo nível de atenção</h2>
<p>A pergunta que divide os contentores de trabalho é <b>o que acontece se me esquecer disto?</b> <span data-src="own"></span></p>
<table class="lr-table"><tbody>
<tr><td class="pr-mono">#Trabalho-Projetos</td><td>Compromissos e verificações de um projeto — <b>nome do projeto no fim do título</b>. Se esqueces, algo parte ou alguém fica pendurado.</td></tr>
<tr><td class="pr-mono">#Trabalho-Geral</td><td>Lembretes leves: falar com alguém, enviar um email, reservar uma sala. Se esqueces, pouca coisa parte.</td></tr>
<tr><td class="pr-mono">#Pessoal</td><td>Tudo o que é fora do trabalho.</td></tr>
</tbody></table>
<p>Sem subprojetos e sem etiquetas: o nome do projeto no título faz o trabalho de uma etiqueta, em texto simples, sem esquema para manter.</p>
<h2>À espera: a lista "Insistir"</h2>
<p>O GTD guarda uma lista "À espera" de tudo o que depende de outra pessoa <span data-src="est"></span>. O truque que funciona em qualquer gestor: regista o seguimento como uma ação com data — <b>a data em que vais verificar, não a data em que esperas o resultado</b>. Aqui é uma tarefa que começa por "Insistir"; um filtro que pesquisa "Insistir" é a lista inteira.</p>
<h2>Prioridade: só quando é verdade</h2>
<p>Quase tudo fica sem prioridade. Marcar P1 por hábito recria o ruído de "tudo é importante" que a prioridade devia cortar. Na maioria dos dias nada está marcado — e isso é o sistema a funcionar. <span data-src="own"></span></p>
<h2>Envolver: três filtros fixados no topo</h2>
<div data-demo="filters"></div>
<p class="lr-note">O documento usa três filtros porque o plano grátis do Todoist permitia três na altura em que foi escrito <span data-src="chk"></span>. Vê os limites atuais, com fonte e data, no <a href="#explorar/ferramentas/todoist">diretório</a>.</p>
<h2>Subtarefas: decompor uma tarefa, nunca espelhar um plano</h2>
<p>As subtarefas respondem a "quais são os passos desta tarefa concreta?" — nunca a "qual é o plano do projeto?". O plano é texto na página do projeto. Cria subtarefas quando começas a tarefa, não antes: uma pilha pré-carregada é uma segunda cópia do plano, e as duas divergem na primeira mudança. <span data-src="own"></span></p>`,
      en: `
<div data-demo="gtd5"></div>
<h2>Clarify: always start with a verb</h2>
<p>GTD defines a "next action" as a physical, visible activity <span data-src="est"></span>. "Vendor meeting" is ambiguous within days: was it to schedule it? prepare? just show up? "Schedule vendor meeting" never loses its meaning, because the verb <em>is</em> the clarification.</p>
<div data-demo="verbfirst"></div>
<p>A small, stable vocabulary of verbs helps. Two carry most of the weight for commitments <span data-src="own"></span>: <b>Verify</b> (check that something someone else owns was actually done) and <b>Chase</b> (you are waiting on someone; the date is when you will ask again).</p>
<h2>Organize: three containers, by attention level</h2>
<p>The question that splits the work containers is <b>what happens if I forget this?</b> <span data-src="own"></span></p>
<table class="lr-table"><tbody>
<tr><td class="pr-mono">#Work-Projects</td><td>Commitments and checks for a project — <b>project name at the end of the title</b>. Forget it and something breaks, or someone is let down.</td></tr>
<tr><td class="pr-mono">#Work-General</td><td>Light reminders: talk to someone, send an email, book a room. Forget it and little breaks.</td></tr>
<tr><td class="pr-mono">#Personal</td><td>Anything outside work.</td></tr>
</tbody></table>
<p>No sub-projects and no labels: the project name in the title does a label's job, as plain text, with no schema to maintain.</p>
<h2>Waiting For: the "Chase" list</h2>
<p>GTD keeps a Waiting For list of everything you depend on someone else for <span data-src="est"></span>. The trick that works in any task manager: record the follow-up as a dated action — <b>the date you will check, not the date you expect the result</b>. Here it is a task starting with "Chase"; a filter that searches "Chase" is the whole list.</p>
<h2>Priority: only when it is true</h2>
<p>Almost everything stays unprioritized. Flagging P1 as a habit recreates the "everything is important" noise priority exists to cut. Most days nothing is flagged — and that is the system working. <span data-src="own"></span></p>
<h2>Engage: three saved filters, pinned to the top</h2>
<div data-demo="filters"></div>
<p class="lr-note">The document uses three filters because Todoist's free plan allowed three when it was written <span data-src="chk"></span>. See current limits, with source and date, in the <a href="#explorar/ferramentas/todoist">directory</a>.</p>
<h2>Subtasks: decompose a task, never mirror a plan</h2>
<p>Subtasks answer "what are the steps of this one task?" — never "what is the project plan?". The plan is text on the project page. Create subtasks when you start the task, not before: a pre-loaded stack is a second copy of the plan, and the two drift apart at the first change. <span data-src="own"></span></p>`,
    },
    take: B(['Verbo primeiro: o verbo é a clarificação.', 'Contentores por nível de atenção, nome do projeto no título.', '"Insistir" + data de seguimento = lista "À espera" sem etiquetas.'],
            ['Verb first: the verb is the clarification.', 'Containers by attention level, project name in the title.', '"Chase" + a follow-up date = a Waiting For list with no labels.']),
    next: [{ href: '#experimentar/captura', l: B('Escrever tarefas no laboratório de captura', 'Write tasks in the capture lab') }],
  },

  /* ───────────────────────── 5 ───────────────────────── */
  { id: 'hoje', block: 'metodos', min: 5, kinds: ['today'],
    title: B('Hoje: um caderno descartável', 'Today: a disposable notebook'),
    lede: B('O caderno responde a uma pergunta: em que me foco hoje? Não tem índice, não migra nada, não se revê. Cada página morre ao fim do dia — de propósito.',
            'The notebook answers one question: what am I focusing on today? No index, no migrating, no reviewing. Every page dies at the end of the day — on purpose.'),
    body: {
      pt: `
<h2>Os Big 3</h2>
<p>Três coisas, escolhidas de manhã a partir do filtro "Próximos 7 dias" (que também mostra o que está atrasado). É uma <b>lista curta</b>, não um segundo sítio onde as tarefas vivem: a tarefa continua na lista e é lá que se conclui. O caderno só ilumina três para o dia ter um centro. <span data-src="own"></span></p>
<p>Porquê papel? Na experiência do autor, é um sítio para trabalhar e pensar <em>longe do computador</em>, sem email nem notificações, e onde se desenha à mão. São observações pessoais, não resultados de investigação — trata-as como tal.</p>
<h2>Símbolos: o mínimo, mas expressivos</h2>
<p>O criador do Bullet Journal, Ryder Carroll, recomenda reduzir os sinais personalizados ao mínimo: quantos mais inventas, mais lento ficas <span data-src="est"></span>. Este sistema usa quatro <span data-src="own"></span>. Toca nos itens para os fechar e vê o que acontece na lista de tarefas:</p>
<div data-demo="notebook"></div>
<p>A seta e a cruz separam duas razões diferentes para uma coisa não fechar. <b>→</b> quer dizer que continua viva na lista, só não foi hoje — não há nada a fazer. <b>✕</b> quer dizer que já não faz sentido, e isso tem de ser refletido na lista também, ou volta a aparecer onde já não pertence.</p>
<h2>Opcional: um rascunho de amanhã</h2>
<p>Ao fim do dia, escreve uma coisa provável para os Big 3 de amanhã. Tira a fricção da página em branco por dez segundos. Salta-o quando não sair naturalmente.</p>`,
      en: `
<h2>The Big 3</h2>
<p>Three items, picked each morning from the "Due in 7 days" filter (which also shows anything overdue). It is a <b>shortlist</b>, not a second place where tasks live: the task stays on the list and is completed there. The notebook just spotlights three so the day has a centre. <span data-src="own"></span></p>
<p>Why paper? In the author's experience it is a place to work and think <em>away from the computer</em>, with no email or notifications, where you can draw by hand. These are personal observations, not research findings — treat them that way.</p>
<h2>Symbols: minimal, but expressive</h2>
<p>The creator of the Bullet Journal, Ryder Carroll, recommends keeping custom signifiers to a minimum: the more you invent, the slower you get <span data-src="est"></span>. This system uses four <span data-src="own"></span>. Tap the items to close them and see what happens on the task list:</p>
<div data-demo="notebook"></div>
<p>The arrow and the cross separate two different reasons an item does not close. <b>→</b> means it is still alive on the list, just not today — nothing to do. <b>✕</b> means it no longer makes sense, and that has to be reflected on the list too, or it keeps resurfacing where it no longer belongs.</p>
<h2>Optional: draft tomorrow</h2>
<p>At the end of the day, write one likely item for tomorrow's Big 3. It removes blank-page friction for ten seconds. Skip it whenever it does not come naturally.</p>`,
    },
    take: B(['O caderno é foco, não captura.', 'Três itens da lista, nunca tarefas novas.', '✓ conclui, → deixa, ✕ apaga — sempre também na lista.'],
            ['The notebook is focus, not capture.', 'Three items from the list, never new tasks.', '✓ completes, → leaves, ✕ clears — always on the list too.']),
    next: [{ href: '#aplicar/hoje', l: B('Escolher os Big 3 no mundo de exemplo', 'Pick the Big 3 in the sample world') }],
  },

  /* ───────────────────────── 6 ───────────────────────── */
  { id: 'notas', block: 'metodos', min: 9, kinds: ['info'],
    title: B('Notas: a caixa de entrada da informação', 'Notes: the information inbox'),
    lede: B('Uma grande parte do dia não são ações: um facto sobre um sistema, um processo que mudou, uma decisão no corredor. Escolher a base de dados certa enquanto a pessoa ainda fala é exatamente o tipo de decisão que faz a captura falhar.',
            'A large share of the day is not actions: a fact about a system, a process that changed, a decision in a corridor. Choosing the right database while the person is still talking is exactly the kind of decision that makes capture fail.'),
    body: {
      pt: `
<h2>Regras de captura</h2>
<ol>
<li><b>Uma linha.</b> Se precisa de um parágrafo, escreve a linha agora e o parágrafo depois — cada linha é uma página completa por baixo.</li>
<li><b>Equipa primeiro</b>, como prefixo: <code>Atlas: …</code>.</li>
<li><b>Nome do projeto no fim</b>, quando a nota é sobre um projeto.</li>
<li><b>Um título que ainda faça sentido daqui a três meses.</b></li>
<li><b>Sem etiquetas, relações nem propriedades na captura.</b> A triagem preenche-as.</li>
<li><b>Se é uma ação, é uma tarefa, não uma nota.</b></li>
<li><b>Notas tiradas numa reunião marcada</b> vão para a página dessa reunião.</li>
</ol>
<p>Escreve uma nota e vê, ao vivo, que regras cumpre: <span data-src="own"></span></p>
<div data-demo="notelint"></div>
<h2>Sexta-feira: quatro destinos</h2>
<p>Abre a vista <b>Sem equipa</b> e dá a cada linha exatamente um destino, em cerca de cinco minutos: <b>Guardar</b> (definir a equipa), <b>Agir</b> (vira tarefa; a nota apaga-se se não tiver mais nada), <b>Deitar fora</b>, <b>Graduar</b> (passa para uma base de dados ou página). Como a vista é "equipa vazia", "vazia" quer sempre dizer "ainda não tratei" — por isso as notas transversais recebem a equipa <i>Toda a organização</i>. <span data-src="own"></span></p>
<h2>Cinco semanas depois: arquivar no sítio, deixar ou arquivar</h2>
<p>Uma nota guardada que nunca mais é vista é a forma como uma caixa vira cemitério. A vista <b>Revisão</b> mostra as notas criadas há 30–37 dias: uma fatia de uma semana, por isso cada nota aparece exatamente uma vez, sem marca de "revista". Cada uma recebe um de três destinos: <b>arquivar no sítio</b> (copiar a linha para a página a que pertence e arquivar a nota), <b>deixar</b>, ou <b>arquivar</b> (uma caixa de verificação, não uma mudança de sítio). <span data-src="own"></span></p>
<p class="lr-note">Ahrens (<em>How to Take Smart Notes</em>) pede que as notas efémeras sejam processadas em um ou dois dias <span data-src="est"></span>. Este sistema usa uma passagem semanal porque a maioria das notas de trabalho é <em>referência</em> — um facto, uma data, uma decisão — e não ideias por desenvolver. Se a fila passar ~30 linhas, faz triagem duas vezes por semana.</p>
<h2>O que não vai para as Notas</h2>
<table class="lr-table"><tbody>
<tr><td>Uma ação</td><td>Lista de tarefas</td></tr>
<tr><td>O que se disse numa reunião marcada</td><td>A página dessa reunião</td></tr>
<tr><td>Feedback, conquistas ou preocupações sobre uma pessoa</td><td>A página de 1:1 dessa pessoa — e confirma as regras da tua empresa sobre onde isso pode ficar</td></tr>
<tr><td>Palavras-passe e segredos</td><td>Um gestor de palavras-passe</td></tr>
<tr><td>Dados com fonte própria (métricas, tickets, incidentes)</td><td>A ferramenta que os produz; a nota guarda a ligação e uma leitura</td></tr>
</tbody></table>`,
      en: `
<h2>Capture rules</h2>
<ol>
<li><b>One line.</b> If it needs a paragraph, write the line now and the paragraph later — every row is a full page underneath.</li>
<li><b>Team first</b>, as a prefix: <code>Atlas: …</code>.</li>
<li><b>Project name last</b>, when the note is about a project.</li>
<li><b>A title that still makes sense in three months.</b></li>
<li><b>No tags, relations or properties at capture.</b> Triage fills them in.</li>
<li><b>If it is an action, it is a task, not a note.</b></li>
<li><b>Notes taken in a scheduled meeting</b> go on that meeting's page.</li>
</ol>
<p>Write a note and see, live, which rules it meets: <span data-src="own"></span></p>
<div data-demo="notelint"></div>
<h2>Friday: four outcomes</h2>
<p>Open the <b>No team</b> view and give each row exactly one fate, in about five minutes: <b>Keep</b> (set the team), <b>Act</b> (it becomes a task; the note is deleted unless it holds more), <b>Toss</b>, <b>Graduate</b> (it moves into a database or a page). Because the view is "team is empty", empty always means "not handled yet" — so cross-team notes get the team <i>Org-wide</i>. <span data-src="own"></span></p>
<h2>Five weeks later: file, leave or archive</h2>
<p>A kept note that is never looked at again is how an inbox becomes a graveyard. The <b>Review</b> view shows notes created 30–37 days ago: a one-week slice, so each note comes up exactly once, with no "reviewed" marker. Each gets one of three fates: <b>file</b> (copy the line into the page it belongs to and archive the note), <b>leave</b>, or <b>archive</b> (a checkbox, not a move). <span data-src="own"></span></p>
<p class="lr-note">Ahrens (<em>How to Take Smart Notes</em>) asks for fleeting notes to be processed within a day or two <span data-src="est"></span>. This system uses a weekly pass because most work notes are <em>reference</em> — a fact, a date, a decision — not raw ideas to develop. If the queue passes ~30 rows, triage twice a week.</p>
<h2>What does not go in Notes</h2>
<table class="lr-table"><tbody>
<tr><td>An action</td><td>Task list</td></tr>
<tr><td>Anything said in a scheduled meeting</td><td>That meeting's page</td></tr>
<tr><td>Feedback, wins or concerns about a person</td><td>That person's 1:1 page — and check your company's rules about where this may be stored</td></tr>
<tr><td>Passwords and secrets</td><td>A password manager</td></tr>
<tr><td>Data with its own source of truth (metrics, tickets, incidents)</td><td>The tool that produces it; the note keeps a link and a reading</td></tr>
</tbody></table>`,
    },
    take: B(['Uma linha, equipa primeiro, projeto no fim.', 'Sexta: guardar, agir, deitar fora, graduar.', 'Cinco semanas depois: arquivar no sítio, deixar, arquivar.'],
            ['One line, team first, project last.', 'Friday: keep, act, toss, graduate.', 'Five weeks later: file, leave, archive.']),
    next: [{ href: '#experimentar/notion/notes/noteam', l: B('Abrir a vista "Sem equipa" no playground', 'Open the "No team" view in the playground') }, { href: '#aplicar/revisao', l: B('Fazer a triagem na revisão semanal', 'Triage in the weekly review') }],
  },

  /* ───────────────────────── 7 ───────────────────────── */
  { id: 'para', block: 'metodos', min: 6, kinds: ['str'],
    title: B('PARA: arrumar por acionabilidade', 'PARA: organize by actionability'),
    lede: B('O PARA, de Tiago Forte, arruma pelo quão perto da ação uma coisa está — nunca pelo assunto. A pergunta não é "de que trata isto?", é "quão pronto está para agir?".',
            "Tiago Forte's PARA files things by how close to action they are — never by subject. The question is not 'what is this about?' but 'how ready for action is this?'."),
    body: {
      pt: `
<p>O PARA é o passo "Organizar" de um ciclo maior do <em>Building a Second Brain</em>, chamado CODE: Capturar, Organizar, Destilar, Expressar <span data-src="est"></span>. O GTD governa o fluxo das <em>ações</em>; o PARA governa a estrutura do <em>conhecimento</em>. Não competem: cobrem metades diferentes do mesmo problema.</p>
<div data-demo="para4"></div>
<h2>As coisas mudam de categoria</h2>
<p>Um recurso vira projeto no momento em que decides agir; um projeto vira arquivo quando acaba; uma área pode ficar inativa. Arrasta o tempo e segue três coisas: <span data-src="est"></span></p>
<div data-demo="paraflow"></div>
<h2>"Arquivar" pode ser um estado, não uma mudança de sítio</h2>
<p>No modelo original, arquivar é mover para uma pasta. Para páginas soltas, funciona. Mas uma <em>base de dados</em> já tem algo que uma pasta não tem: um campo Estado que pode dizer "acabado". Tirar a linha da base deitava fora exatamente a estrutura que a torna útil. Por isso, nas bases: <b>o estado arquiva, e a vista divide-se</b> — "Estado não é Done" no dia a dia, "Estado é Done" como registo do que se entregou. A pasta Arquivo fica para o que não tem estado próprio. <span data-src="own"></span></p>
<blockquote class="lr-quote">Nunca cries uma pasta, etiqueta ou base de dados vazia antes de teres conteúdo real para ela. <cite>— a regra de ouro, segundo Tiago Forte <span data-src="est"></span></cite></blockquote>
<h2>Porque é que o PARA encaixa no Notion</h2>
<p>Cada linha de uma base de dados no Notion é, por baixo, uma página completa. Não tens de escolher entre "lista estruturada" e "conteúdo livre": uma linha tem propriedades filtráveis <em>e</em> uma página aberta. É exatamente o que o PARA precisa.</p>`,
      en: `
<p>PARA is the "Organize" step of a larger loop in <em>Building a Second Brain</em>, called CODE: Capture, Organize, Distill, Express <span data-src="est"></span>. GTD governs the flow of <em>actions</em>; PARA governs the structure of <em>knowledge</em>. They do not compete: they cover different halves of the same problem.</p>
<div data-demo="para4"></div>
<h2>Things change category</h2>
<p>A resource becomes a project the moment you decide to act; a project becomes archive when it ends; an area can go inactive. Drag time forward and follow three things: <span data-src="est"></span></p>
<div data-demo="paraflow"></div>
<h2>"Archive" can be a status, not a move</h2>
<p>In the original model, archiving means moving into a folder. For loose pages, that works. But a <em>database</em> already has something a folder does not: a Status field that can say "finished". Pulling the row out would throw away exactly the structure that makes it useful. So in databases: <b>the status archives, and the view splits</b> — "Status is not Done" for day to day, "Status is Done" as a record of what shipped. The Archive folder is for things with no status of their own. <span data-src="own"></span></p>
<blockquote class="lr-quote">Never create an empty folder, tag or database before you have real content for it. <cite>— the golden rule, per Tiago Forte <span data-src="est"></span></cite></blockquote>
<h2>Why PARA fits Notion</h2>
<p>Every Notion database row is, underneath, a full page. You never choose between "structured list" and "free content": a row has filterable properties <em>and</em> an open page. Exactly what PARA needs.</p>`,
    },
    take: B(['Projetos → Áreas → Recursos → Arquivo, do mais acionável ao inativo.', 'As coisas mudam de categoria com o tempo.', 'Nas bases de dados, arquivar é um estado.'],
            ['Projects → Areas → Resources → Archive, most actionable to inactive.', 'Things change category over time.', 'In databases, archiving is a status.']),
    next: [{ href: '#aplicar/para', l: B('PARA na prática', 'PARA in practice') }],
  },

  /* ───────────────────────── 8 ───────────────────────── */
  { id: 'pagina-base', block: 'estrutura', min: 6, kinds: ['str'],
    title: B('Página ou base de dados?', 'Page or database?'),
    lede: B('Sempre que algo novo precisa de casa, quatro perguntas decidem o formato. E nenhum tipo de informação salta logo para base de dados: sobe uma escada, um degrau de cada vez.',
            'Every time something new needs a home, four questions decide the format. And no kind of information jumps straight to a database: it climbs a ladder, one rung at a time.'),
    body: {
      pt: `
<div data-demo="fourq"></div>
<p>Regra prática: duas ou mais respostas do mesmo lado decidem. Num empate, fica com o que já tens — passar de página a base mais tarde é barato. <span data-src="own"></span></p>
<p>Dois corolários: <b>duas bases com a mesma forma são uma base</b> (foi assim que "Algum dia / Ideias" virou uma etiqueta nas Notas); e <b>se os dados verdadeiros vivem noutra ferramenta, não são uma base aqui</b> — guarda a definição e a ligação.</p>
<h2>A escada da graduação</h2>
<p>Criar uma base para cada novo tipo <em>antes</em> de ele se repetir é a estrutura prematura de que a regra de ouro avisa — e devolve a pergunta "onde é que isto vai?" ao momento da captura. <span data-src="own"></span></p>
<div data-demo="ladder"></div>
<h2>Relação ou seleção?</h2>
<p>Uma <b>Relação</b> só quando precisas mesmo de uma ligação de duas vias (ver a ligação dos dois lados) ou quando o mesmo valor ficaria duplicado em três ou mais bases e divergiria. Fora disso, uma <b>Seleção</b> com uma vista filtrada dá o mesmo valor com muito menos montagem. <span data-src="own"></span></p>
<div data-demo="selectrel"></div>
<p><b>Seleção ou seleção múltipla?</b> A seleção obriga cada linha a um só valor de uma lista fixa — bom para um estado. A seleção múltipla ("etiquetas") deixa uma linha ter nenhum, um ou vários valores, criados na hora sem mexer no esquema.</p>`,
      en: `
<div data-demo="fourq"></div>
<p>Rule of thumb: two or more answers on the same side decide it. On a tie, keep what you already have — moving from page to database later is cheap. <span data-src="own"></span></p>
<p>Two corollaries: <b>two databases with the same shape are one database</b> (that is how "Someday / Ideas" became a tag in Notes); and <b>if the real data lives in another tool, it is not a database here</b> — keep the definition and the link.</p>
<h2>The graduation ladder</h2>
<p>Creating a database for each new kind <em>before</em> it recurs is the premature structure the golden rule warns against — and it brings the "where does this go?" question back to capture time. <span data-src="own"></span></p>
<div data-demo="ladder"></div>
<h2>Relation or select?</h2>
<p>Use a <b>Relation</b> only when you genuinely need a two-way link (seeing the connection from both sides) or when the same value would otherwise be duplicated across three or more databases and drift. Otherwise a <b>Select</b> with a filtered view gives the same value with far less setup. <span data-src="own"></span></p>
<div data-demo="selectrel"></div>
<p><b>Select or multi-select?</b> A select forces each row to one value from a fixed list — good for a state. A multi-select ("tags") lets a row carry none, one or several values, added on the fly without touching the schema.</p>`,
    },
    take: B(['Quatro perguntas: quantos, mesma forma, comparar, repetição.', 'Nota → etiqueta + vista → base de dados, pela regra de três.', 'Relação só para duas vias ou para evitar duplicar em 3+ bases.'],
            ['Four questions: how many, same shape, compare, repetition.', 'Note → tag + view → database, by the rule of three.', 'Relation only for two-way links or to avoid duplicating across 3+ databases.']),
    next: [{ href: '#experimentar/pagina-ou-base', l: B('Testar os teus próprios casos', 'Test your own cases') }],
  },

  /* ───────────────────────── 9 ───────────────────────── */
  { id: 'bases', block: 'estrutura', min: 10, kinds: ['str'],
    title: B('Bases de dados, peça a peça', 'Databases, piece by piece'),
    lede: B('Propriedades, vistas, filtros, relações, rollups e modelos — o vocabulário do Notion, explicado com as seis bases centrais do sistema.',
            'Properties, views, filters, relations, rollups and templates — the Notion vocabulary, explained with the six core databases of the system.'),
    body: {
      pt: `
<h2>Linhas, propriedades e corpo</h2>
<p>Uma base de dados é uma coleção de páginas com a mesma forma. Cada <b>propriedade</b> é uma coluna com um tipo: título, texto, seleção, seleção múltipla, caixa de verificação, URL, data, relação, rollup, e as automáticas <b>Criado em</b> e <b>Última edição</b>, que se preenchem sozinhas e não custam disciplina nenhuma. Regra: as propriedades servem para filtrar; o texto rico vive no <b>corpo</b> da página. <span data-src="own"></span></p>
<h2>Vistas: lentes sobre os mesmos dados</h2>
<p>Uma vista é um filtro + uma ordenação + um formato (tabela, quadro, lista…). Mudar de vista não muda os dados. Toca nas vistas guardadas das Notas:</p>
<div data-demo="minidb"></div>
<h2>Relações: a base central</h2>
<p>Pessoas, 1:1, Reuniões, Projetos e Notas precisam todas de saber "de que equipa". Sem uma base própria, a mesma lista de nomes ficava duplicada como seleção em até dez sítios — e divergia na primeira mudança de nome. A base <b>Equipas</b> é o único sítio onde os nomes existem; as outras apontam para ela com uma <b>relação</b>. <span data-src="own"></span></p>
<p>Uma relação de <b>duas vias</b> faz aparecer, na página da equipa, uma propriedade por cada base ligada — Notas, Projetos, Pessoas… — com os itens ligados. Custa zero e responde a "o que está ligado a esta equipa?". Mas é só uma lista: sem filtros nem ordenação.</p>
<p>Uma regra simples para todas as bases: <b>cada linha tem uma equipa</b>. O que é de ninguém em particular recebe <i>Toda a organização</i>; o que é de várias recebe todas. Assim, "equipa vazia" quer sempre dizer "alguém se esqueceu" — e uma vista "Equipa está vazia" em cada base é uma verificação de saúde gratuita.</p>
<h2>Rollups: contas sobre o que está ligado</h2>
<p>Um rollup segue uma relação e calcula algo sobre as linhas do outro lado: contar, contar as caixas por marcar, a data mais recente… "Notas vivas" na página de uma equipa é um rollup: segue a relação Notas e conta as que não estão arquivadas.</p>
<h2>Modelos</h2>
<p>Um modelo de base de dados dá a cada linha nova o mesmo esqueleto de página — Objetivo, Contexto, Pressupostos, Plano, Decisões, Ligações, no caso dos Projetos. Um modelo pode até trazer <b>vistas ligadas</b> já filtradas para a própria página.</p>
<h2>O que o Notion não faz</h2>
<p>Uma vista mostra linhas de <b>uma</b> base: não há uma lista nativa que misture reuniões, notas e projetos <span data-src="chk"></span>. O que se faz é uma página com várias vistas pequenas, uma por base, cada uma filtrada pela equipa. E filtros globais de painel, segundo um guia de terceiros, são de planos pagos <span data-src="chk"></span>.</p>
<p>Tudo isto, a funcionar, está no <a href="#experimentar/notion">playground</a>.</p>`,
      en: `
<h2>Rows, properties and body</h2>
<p>A database is a collection of pages with the same shape. Each <b>property</b> is a column with a type: title, text, select, multi-select, checkbox, URL, date, relation, rollup, and the automatic <b>Created time</b> and <b>Last edited time</b>, which fill themselves in and cost no discipline at all. Rule: properties are for filtering; rich text lives in the page <b>body</b>. <span data-src="own"></span></p>
<h2>Views: lenses over the same data</h2>
<p>A view is a filter + a sort + a layout (table, board, list…). Switching views does not change the data. Tap the saved Notes views:</p>
<div data-demo="minidb"></div>
<h2>Relations: the hub database</h2>
<p>Persons, 1:1s, Meetings, Projects and Notes all need to know "which team". Without a database of its own, the same list of names would be duplicated as a select in up to ten places — and drift at the first rename. The <b>Teams</b> database is the only place team names exist; the others point to it with a <b>relation</b>. <span data-src="own"></span></p>
<p>A <b>two-way</b> relation makes the team page gain one property per linked database — Notes, Projects, Persons… — listing the linked items. It costs nothing and answers "what is linked to this team?". But it is only a list: no filtering, no sorting.</p>
<p>One rule for every database: <b>every row has a team</b>. Something that belongs to no single team gets <i>Org-wide</i>; something spanning several gets all of them. Then "team is empty" always means "someone forgot" — and a "Team is empty" view in each database is a free health check.</p>
<h2>Rollups: maths over what is linked</h2>
<p>A rollup follows a relation and computes something over the rows on the other side: count, count unchecked boxes, the latest date… "Live notes" on a team page is a rollup: it follows the Notes relation and counts the ones not archived.</p>
<h2>Templates</h2>
<p>A database template gives every new row the same page skeleton — Objective, Context, Assumptions, Plan, Decisions, Links, for Projects. A template can even bring <b>linked views</b> already filtered to the page itself.</p>
<h2>What Notion does not do</h2>
<p>A view shows rows from <b>one</b> database: there is no native list mixing meetings, notes and projects <span data-src="chk"></span>. What you build is a page with several small views, one per database, each filtered to the team. And global dashboard filters are, per a third-party guide, on paid plans <span data-src="chk"></span>.</p>
<p>All of this, working, is in the <a href="#experimentar/notion">playground</a>.</p>`,
    },
    take: B(['Propriedades para filtrar; texto no corpo.', 'Uma base central evita a mesma lista duplicada em dez sítios.', 'Duas vias = a ligação vê-se dos dois lados; rollup = contas sobre ela.'],
            ['Properties to filter; text in the body.', 'A hub database avoids the same list duplicated in ten places.', 'Two-way = the link shows on both sides; rollup = maths over it.']),
    next: [{ href: '#experimentar/notion', l: B('Abrir o playground', 'Open the playground') }, { href: '#explorar/relacoes', l: B('Ver o mapa das relações', 'See the relation map') }],
  },

  /* ───────────────────────── 10 ───────────────────────── */
  { id: 'rituais', block: 'estrutura', min: 7, kinds: ['act', 'info', 'today'],
    title: B('Rituais: o dia e a semana', 'Rituals: the day and the week'),
    lede: B('Há uma só revisão: a semanal. Tudo o que é mais lento é um acrescento a ela, nunca um hábito separado. Dividir os ritmos em muitas revisões é o que faz as pessoas largarem todas.',
            'There is one review: the weekly one. Anything slower is an add-on to it, never a separate habit. Splitting rhythms into many reviews is what makes people drop all of them.'),
    body: {
      pt: `
<h2>O ritmo do dia</h2>
<table class="lr-table"><tbody>
<tr><td><b>Manhã</b> · 2 min</td><td>Abrir "Próximos 7 dias" (atrasadas incluídas). Escolher os Big 3 — usar o rascunho de ontem, se houver.</td></tr>
<tr><td><b>Durante o dia</b></td><td>Só capturar: ação → lista; informação → Notas (uma linha, equipa primeiro). O caderno fica aberto para pensar e desenhar.</td></tr>
<tr><td><b>Fim do dia</b> · 2 min</td><td>Fechar os símbolos (✓ → ✕). O que tem ✕ sai também da lista. Opcional: rascunho de amanhã.</td></tr>
</tbody></table>
<h2>A revisão semanal: uma reunião contigo</h2>
<p>O mesmo horário todas as semanas (sexta à tarde funciona bem), 20 minutos, telemóvel longe. Corre a partir de uma única tarefa recorrente cuja descrição <em>é</em> a agenda. <span data-src="own"></span></p>
<div data-demo="agenda"></div>
<h2>Regras que a mantêm viva</h2>
<table class="lr-table"><tbody>
<tr><td><b>Semana má</b></td><td>Revisão mínima de 5 minutos: só os passos 1 e 2.</td></tr>
<tr><td><b>Saltaste uma semana</b></td><td>Não recuperes. Faz a revisão normal; se "Sem equipa" passar ~30 linhas, faz o passo 4 duas vezes nessa semana.</td></tr>
<tr><td><b>Demora demasiado</b></td><td>Corta, não estiques. A revisão é a parte do GTD que mais se abandona, e abandona-se quando cresce <span data-src="est"></span>.</td></tr>
<tr><td><b>Gatilho</b></td><td>Tarefa recorrente, hora fixa. Junta-lhe algo de que gostas (um café).</td></tr>
<tr><td><b>Bloco protegido</b></td><td>Pelo menos 30 minutos, à medida da tarefa e móvel quando a semana muda. Um empréstimo leve do <em>time blocking</em>, não agendar todas as horas.</td></tr>
</tbody></table>
<p class="lr-note">Mais tarde, e só quando a revisão for hábito: verificações mensais e trimestrais (riscos, métricas, decisões, ideias) entram como linhas extra da mesma agenda, em semanas específicas.</p>`,
      en: `
<h2>The daily rhythm</h2>
<table class="lr-table"><tbody>
<tr><td><b>Morning</b> · 2 min</td><td>Open "Due in 7 days" (overdue included). Pick the Big 3 — use yesterday's draft line if there is one.</td></tr>
<tr><td><b>During the day</b></td><td>Capture only: action → list; information → Notes (one line, team first). The notebook stays open for thinking and drawing.</td></tr>
<tr><td><b>End of day</b> · 2 min</td><td>Close the symbols (✓ → ✕). Anything marked ✕ is cleared from the list too. Optional: draft tomorrow.</td></tr>
</tbody></table>
<h2>The weekly review: one meeting with yourself</h2>
<p>The same slot every week (Friday afternoon works well), 20 minutes, phone away. It runs from a single recurring task whose description <em>is</em> the agenda. <span data-src="own"></span></p>
<div data-demo="agenda"></div>
<h2>Rules that keep it alive</h2>
<table class="lr-table"><tbody>
<tr><td><b>Bad week</b></td><td>A 5-minute minimum review: steps 1 and 2 only.</td></tr>
<tr><td><b>Skipped a week</b></td><td>Don't catch up. Run the normal review; if "No team" passes ~30 rows, run step 4 twice that week.</td></tr>
<tr><td><b>Takes too long</b></td><td>Cut, don't extend. The review is the part of GTD people most often drop, and it gets dropped when it grows <span data-src="est"></span>.</td></tr>
<tr><td><b>Trigger</b></td><td>A recurring task, fixed time. Pair it with something you like (coffee).</td></tr>
<tr><td><b>Protected block</b></td><td>At least 30 minutes, sized to the task and movable when the week changes. A light borrow from time blocking, not scheduling every hour.</td></tr>
</tbody></table>
<p class="lr-note">Later, and only once the review is a habit: monthly and quarterly checks (risks, metrics, decisions, ideas) join as extra lines of the same agenda, on specific weeks.</p>`,
    },
    take: B(['Dois minutos de manhã, dois à noite, captura pelo meio.', 'Uma revisão semanal, sete passos, ~20 minutos.', 'Semana má: só tarefas e seguimentos.'],
            ['Two minutes in the morning, two at night, capture in between.', 'One weekly review, seven steps, ~20 minutes.', 'Bad week: tasks and follow-ups only.']),
    next: [{ href: '#aplicar/revisao', l: B('Fazer a revisão semanal', 'Run the weekly review') }],
  },

  /* ───────────────────────── 11 ───────────────────────── */
  { id: 'principios', block: 'estrutura', min: 7, kinds: ['str'],
    title: B('Desenhar qualquer base de dados', 'Designing any database'),
    lede: B('Dez princípios, e um teste de quatro perguntas para as bases "opcionais" — porque a maioria das coisas que a literatura sugere não merece uma base.',
            'Ten principles, and a four-question test for "optional" databases — because most things the literature suggests do not deserve one.'),
    body: {
      pt: `
<ol class="lr-ideas">
<li><b>Poucas propriedades</b> — só as que respondem a uma pergunta real de filtrar ou ordenar.</li>
<li><b>O tipo certo para cada campo</b> — seleção para valores fixos; data só para datas reais; relação só quando há ganho real nas duas vias.</li>
<li><b>O título identifica a linha sozinho</b>, sem abrir a página.</li>
<li><b>O conteúdo rico vive no corpo</b>, nunca numa propriedade.</li>
<li><b>Duas ou três vistas chegam</b>: uma filtrada para o dia a dia, uma agrupada para vista geral, uma sem filtro para a auditoria rara.</li>
<li><b>Deixa "Criado em" e "Última edição" trabalhar de graça.</b> Um campo manual de "atualizado em" quase sempre custa mais disciplina do que vale.</li>
<li><b>Antes de acrescentar o que quer que seja — uma base, uma relação, uma propriedade — diz a pergunta concreta a que responde hoje.</b> Se não consegues, é decoração.</li>
<li><b>Cada tipo de coisa tem uma casa.</b> Tarefas nunca vivem nas bases; conhecimento nunca vive na lista de tarefas. Duas bases com a mesma forma são uma.</li>
<li><b>Se os dados vivem noutra ferramenta, guarda a definição e a ligação</b>, não os dados.</li>
<li><b>Tipos novos sobem uma escada</b>: nota, depois etiqueta e vista, depois base.</li>
</ol>
<p>Todos são escolhas de desenho do sistema de referência <span data-src="own"></span>, apoiadas em boas práticas conhecidas.</p>
<h2>O teste das bases opcionais</h2>
<p>Um candidato tem de passar as quatro, por ordem. Escolhe um e corre o teste:</p>
<div data-demo="dbtest"></div>
<p class="lr-note">Os veredictos assumem um espaço pessoal de alguém que lidera várias equipas. Se o teu papel mudar, volta a correr o teste: um "não" pode virar "sim".</p>`,
      en: `
<ol class="lr-ideas">
<li><b>Few properties</b> — only the ones that answer a real filtering or sorting question.</li>
<li><b>The right type for each field</b> — select for fixed values; date only for real dates; relation only when there is a real two-way gain.</li>
<li><b>The title identifies the row on its own</b>, without opening the page.</li>
<li><b>Rich content lives in the body</b>, never in a property.</li>
<li><b>Two or three views cover almost everything</b>: one filtered for daily use, one grouped for an overview, one unfiltered for the rare audit.</li>
<li><b>Let Created time and Last edited time work for free.</b> A manual "last updated" field almost always costs more discipline than it is worth.</li>
<li><b>Before adding anything — a database, a relation, a property — name the concrete question it answers today.</b> If you cannot, it is decoration.</li>
<li><b>A kind of thing has one home.</b> Tasks never live in the databases; knowledge never lives in the task list. Two databases with the same shape are one.</li>
<li><b>If the data lives in another tool, store the definition and the link</b>, not the data.</li>
<li><b>New kinds climb a ladder</b>: note, then tag and view, then database.</li>
</ol>
<p>All are design choices of the reference system <span data-src="own"></span>, grounded in well-known good practice.</p>
<h2>The optional-database test</h2>
<p>A candidate must pass all four, in order. Pick one and run the test:</p>
<div data-demo="dbtest"></div>
<p class="lr-note">The verdicts assume a personal workspace for someone leading several teams. If your role changes, re-run the test: a "no" can become a "yes".</p>`,
    },
    take: B(['Diz a pergunta que um campo responde hoje — senão é decoração.', 'Duas ou três vistas por base.', 'A maioria dos candidatos fica secção, página ou ligação.'],
            ['Name the question a field answers today — otherwise it is decoration.', 'Two or three views per database.', 'Most candidates stay a section, a page or a link.']),
    next: [{ href: '#experimentar/notion', l: B('Acrescentar uma propriedade no playground', 'Add a property in the playground') }],
  },

  /* ───────────────────────── 12 ───────────────────────── */
  { id: 'fontes', block: 'estrutura', min: 4, kinds: [],
    title: B('Fontes, escolhas e limites', 'Sources, choices and limits'),
    lede: B('O que é conceito estabelecido, o que é escolha deste sistema, e o que o documento de referência deixa por resolver.',
            'What is an established concept, what is a choice of this system, and what the reference document leaves unresolved.'),
    body: {
      pt: `
<h2>Conceitos estabelecidos <span data-src="est"></span></h2>
<ul>
<li><b>GTD</b> (David Allen): ciclos abertos; capturar, clarificar, organizar, refletir, envolver; próxima ação; lista "À espera"; regra dos dois minutos; revisão semanal.</li>
<li><b>PARA e CODE</b> (Tiago Forte, <em>Building a Second Brain</em>): Projetos, Áreas, Recursos, Arquivo; capturar primeiro, organizar depois; nada de estrutura vazia.</li>
<li><b>Bullet Journal</b> (Ryder Carroll): poucos sinais.</li>
<li><b>Notas efémeras</b> (Sönke Ahrens, <em>How to Take Smart Notes</em>).</li>
<li><b>Roadmap Now-Next-Later</b> (Janna Bastow), <b>ADR</b> (registos de decisão), <b>RAID</b>, <b>Technology Radar</b> (Thoughtworks), <b>SLO e orçamento de erro</b> (Google SRE), <b>métricas DORA</b>.</li>
<li>O estudo da IBM sobre reencontrar email (pastas vs. pesquisa).</li>
</ul>
<h2>Escolhas do sistema de referência <span data-src="own"></span></h2>
<p>Funcionam, mas são decisões de desenho — adapta-as: os três contentores por nível de atenção; o nome do projeto entre parênteses no título; os verbos "Verificar" e "Insistir"; os quatro símbolos do caderno; a revisão de ~20 minutos com sete passos; a janela de 30–37 dias; a equipa "Toda a organização"; "arquivar é um estado"; a escada da graduação com a regra de três; os veredictos sobre bases opcionais.</p>
<h2>O que o documento deixa por resolver</h2>
<ul>
<li><b>O rollup "Último 1:1" não funciona como descrito.</b> A base 1:1 tem uma linha por pessoa (sem datas por sessão) e nenhuma relação a Pessoas é definida. No playground acrescentámos a relação "Ficha da pessoa" e o rollup usa a "Última edição" da página de 1:1 — e assinalamos a diferença.</li>
<li><b>Ficheiros em falta:</b> o documento remete para <code>example-workspace.md</code> e <code>cheatsheet.md</code>, que não existem no projeto. O mundo de exemplo foi construído a partir dos exemplos espalhados no próprio documento.</li>
<li><b>Escrito para quem lidera equipas de engenharia.</b> As bases opcionais (Catálogo de serviços, SLO, Radar) só fazem sentido nesse papel. O cenário "Estudos" mostra os mesmos princípios fora desse contexto.</li>
<li><b>Limites de produtos.</b> Números como "5 projetos grátis" ou "3 filtros" mudam com o tempo. Aqui não os repetimos como factos: o <a href="#explorar/ferramentas">diretório</a> tem cada limite com a fonte e a data em que foi verificado.</li>
<li><b>Pontos que o próprio documento marca "a verificar na app"</b> — pesquisa por parte de palavra, ações de botões no plano grátis, atalhos no iPhone/Android — ficam com o rótulo <span data-src="chk"></span>.</li>
</ul>`,
      en: `
<h2>Established concepts <span data-src="est"></span></h2>
<ul>
<li><b>GTD</b> (David Allen): open loops; capture, clarify, organize, reflect, engage; next action; Waiting For; the two-minute rule; the weekly review.</li>
<li><b>PARA and CODE</b> (Tiago Forte, <em>Building a Second Brain</em>): Projects, Areas, Resources, Archive; capture first, organize later; no empty structure.</li>
<li><b>Bullet Journal</b> (Ryder Carroll): few signifiers.</li>
<li><b>Fleeting notes</b> (Sönke Ahrens, <em>How to Take Smart Notes</em>).</li>
<li><b>Now-Next-Later roadmaps</b> (Janna Bastow), <b>ADRs</b> (decision records), <b>RAID</b>, the <b>Technology Radar</b> (Thoughtworks), <b>SLOs and error budgets</b> (Google SRE), <b>DORA metrics</b>.</li>
<li>The IBM study on re-finding email (folders vs search).</li>
</ul>
<h2>Choices of the reference system <span data-src="own"></span></h2>
<p>They work, but they are design decisions — adapt them: the three containers by attention level; the project name in brackets in the title; the verbs "Verify" and "Chase"; the four notebook symbols; the ~20-minute, seven-step review; the 30–37-day window; the "Org-wide" team; "archive is a status"; the graduation ladder with the rule of three; the verdicts on optional databases.</p>
<h2>What the document leaves unresolved</h2>
<ul>
<li><b>The "Last 1:1" rollup cannot work as described.</b> The 1:1 database has one row per person (no per-session dates) and no relation to Persons is defined. In the playground we added a "Person record" relation and the rollup uses the 1:1 page's "Last edited time" — and we flag the difference.</li>
<li><b>Missing files:</b> the document refers to <code>example-workspace.md</code> and <code>cheatsheet.md</code>, which do not exist in the project. The sample world was built from the examples scattered through the document itself.</li>
<li><b>Written for someone leading engineering teams.</b> The optional databases (Service Catalog, SLOs, Radar) only make sense in that role. The "Studies" scenario shows the same principles outside that context.</li>
<li><b>Product limits.</b> Numbers like "5 free projects" or "3 filters" change over time. We do not repeat them as facts here: the <a href="#explorar/ferramentas">directory</a> has each limit with its source and the date it was verified.</li>
<li><b>Points the document itself marks "to verify in-app"</b> — partial-word search, button actions on the free plan, iPhone/Android shortcuts — keep the <span data-src="chk"></span> label.</li>
</ul>`,
    },
    take: B(['Conceitos são gerais; escolhas adaptam-se.', 'Limites de produtos têm data.'], ['Concepts are general; choices are adaptable.', 'Product limits have dates.']),
    next: [{ href: '#aplicar/sistema', l: B('Desenhar o teu sistema', 'Design your system') }],
  },
  ];

  return { BLOCKS, CH };
})();
