/* ══════════════════════════════════════════════════════════════════
   DCOP7 Productivity — percurso "Executar e dirigir" (conteúdo)
   ──────────────────────────────────────────────────────────────────
   Acrescenta ao PrLearnContent um segundo percurso de capítulos, ao lado
   de "Organizar" (os capítulos originais). Não é um resumo de livros: cada
   capítulo liga uma ideia ao sistema que o visitante já montou.

   Marcadores de evidência (pr-core.js → srcTag):
     res   resultado de investigação publicada (com a fonte no fim)
     est   enquadramento reconhecido (GTD, autodeterminação, dupla via…)
     auth  modelo de um autor (Clear, Covey, Pink, Fogg, Newport…)
     tip   conselho prático deste site
     weak  ideia popular com evidência fraca ou que não se replicou
   Fontes verificadas em nov/2026 (ver `refs` de cada capítulo). Números
   só quando a fonte os sustenta, com as ressalvas que a fonte tem.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const B = (pt, en) => ({ pt, en });
  const C = PrLearnContent;

  C.TRACKS = [
    { id: 'org', n: '1', name: B('Organizar', 'Organizing'), d: B('Onde as coisas vivem: tarefas, notas, projetos, bases de dados e o ritmo que os mantém vivos.', 'Where things live: tasks, notes, projects, databases and the rhythm that keeps them alive.') },
    { id: 'ed', n: '2', name: B('Executar e dirigir', 'Executing & directing'), d: B('O lado humano: hábitos, adiar, foco, como decidimos, o que nos move e o que merece o nosso tempo. Cada capítulo tem um laboratório onde mexes nas variáveis — com as tuas próprias coisas, se quiseres.',
      'The human side: habits, putting things off, focus, how we decide, what moves us and what deserves our time. Each chapter has a lab where you change the variables — with your own things, if you like.') },
  ];
  C.BLOCKS.forEach(b => { b.track = b.track || 'org'; });
  C.BLOCKS.push(
    { id: 'executar', track: 'ed', name: B('Executar', 'Executing'), d: B('Fazer acontecer, de forma sustentável: hábitos, adiar, foco e energia.', 'Making it happen, sustainably: habits, putting things off, focus and energy.') },
    { id: 'dirigir', track: 'ed', name: B('Dirigir', 'Directing'), d: B('Escolher bem: como julgamos, o que nos motiva, e o que merece o nosso tempo.', 'Choosing well: how we judge, what motivates us, and what deserves our time.') },
  );

  const ref = (txt, url) => url ? `${txt} <a href="${url}" target="_blank" rel="noopener noreferrer">↗</a>` : txt;

  C.CH.push(
  /* ───────────────────────── hábitos ───────────────────────── */
  { id: 'habitos', block: 'executar', min: 9, kinds: [],
    title: B('Hábitos: o sistema que se mantém sozinho', 'Habits: the system that keeps itself going'),
    lede: B('A revisão semanal e os Big 3 só funcionam se acontecerem sem negociação. Isso não é força de vontade — é hábito, e os hábitos fazem-se com contexto e repetição.',
            'The weekly review and the Big 3 only work if they happen without negotiation. That is not willpower — it is habit, and habits are built from context and repetition.'),
    body: {
      pt: `
<h2>O que é, de facto, um hábito</h2>
<p>Na investigação, um hábito é uma <b>ligação aprendida entre um contexto e uma resposta</b>: o mesmo sítio, a mesma hora ou a mesma ação anterior passam a disparar o comportamento quase sem decisão <span data-src="res"></span>. Em dois estudos de diário com estudantes universitários, 35% e 43% das ações registadas repetiam-se quase todos os dias no mesmo sítio — muitas vezes com a cabeça noutro lado <span data-src="res"></span>.</p>
<p>Daí a consequência prática mais útil: <b>mudar o contexto muda o hábito</b>. Mudar de casa, de equipa ou de horário é a melhor altura para começar um hábito — e a pior para manter um.</p>
<h2>Quanto tempo demora</h2>
<p>O número "21 dias" não tem base <span data-src="weak"></span>. No estudo mais citado (Lally e colegas, 2010), 96 pessoas escolheram uma ação para repetir todos os dias durante 12 semanas. Nas 39 cujos dados se ajustaram ao modelo, a mediana até chegar a 95% do seu próprio máximo de automatismo foi de <b>66 dias</b> — com uma variação enorme, de 18 a 254 dias (este último é uma projeção para lá do fim do estudo) <span data-src="res"></span>. Não há um número universal: o tempo depende da pessoa e da ação. Duas coisas que importam mais do que o número:</p>
<ul><li><b>Falhar um dia não estragava</b> a formação do hábito; ser muito irregular estragava.</li>
<li>Ações mais exigentes (como exercício) tendiam a demorar mais a ficar automáticas do que ações simples.</li></ul>
<h2>Âncoras: "depois de X, faço Y"</h2>
<p>Planear <em>quando</em> e <em>onde</em> ("se for segunda às 9h, então abro a revisão") chama-se <b>intenção de implementação</b> (Gollwitzer). É das técnicas mais estudadas: a meta-análise de 2006 (94 testes) encontrou um efeito médio-grande face a só ter a intenção <span data-src="res"></span>; uma meta-análise maior, de 2024 (642 testes), confirmou o efeito em comportamentos, pensamentos e emoções, maior quando o plano tem a forma "se… então…" e é ensaiado <span data-src="res"></span>. Resumos dessa análise indicam que, corrigido o viés de publicação, o efeito fica bastante mais pequeno — não confirmámos esses números no texto integral. O "habit stacking" de James Clear e as "âncoras" do <em>Tiny Habits</em> de BJ Fogg são aplicações desta ideia <span data-src="auth"></span>.</p>
<h2>As quatro leis (James Clear)</h2>
<p>Clear organiza um hábito em <b>deixa → vontade → resposta → recompensa</b>, e propõe quatro leis para o criar: torná-lo <b>óbvio, atrativo, fácil e satisfatório</b> — e o inverso para quebrar um: invisível, pouco atrativo, difícil, insatisfatório <span data-src="auth"></span>. É um modelo prático que junta ideias de vários lados (aprendizagem por reforço, contexto, fricção); não foi testado como um todo, mas cada lei aponta para uma alavanca que podes experimentar.</p>
<div data-demo="m-loop"></div>
<h2>Identidade: "sou alguém que…"</h2>
<p>Clear propõe hábitos baseados na identidade: cada repetição é um "voto" no tipo de pessoa que queres ser <span data-src="auth"></span>. Há apoio para a direção inversa — inferimos quem somos em parte a partir do que nos vemos fazer (teoria da autoperceção, Bem) <span data-src="res"></span>. Mas cuidado com versões mágicas: um estudo famoso em que pedir para "ser um eleitor" (em vez de "votar") aumentava a participação <b>não se replicou</b> em experiências de campo maiores — os autores originais contestam essas replicações, mas a de 2020 foi feita para responder às suas críticas <span data-src="weak"></span>. A identidade ajuda a <em>manter</em> o que já fazes; não substitui a repetição.</p>
<h2>No teu sistema</h2>
<ul><li>A revisão semanal é o hábito-mãe: uma hora fixa, um sítio fixo, uma agenda fixa <span data-src="tip"></span>.</li>
<li>Os Big 3 ancoram-se a algo que já fazes todas as manhãs (o café, abrir o portátil) <span data-src="tip"></span>.</li>
<li>Começa ridiculamente pequeno: "abrir o filtro Hoje" conta. A ação cresce depois <span data-src="auth"></span>.</li></ul>`,
      en: `
<h2>What a habit actually is</h2>
<p>In research, a habit is a <b>learned link between a context and a response</b>: the same place, time or preceding action comes to trigger the behaviour with little decision-making <span data-src="res"></span>. In two diary studies with university students, 35% and 43% of the recorded actions were repeated almost every day in the same place — often while people were thinking about something else <span data-src="res"></span>.</p>
<p>Hence the most useful practical consequence: <b>changing the context changes the habit</b>. Moving house, team or schedule is the best moment to start a habit — and the worst to keep one.</p>
<h2>How long it takes</h2>
<p>The "21 days" figure has no basis <span data-src="weak"></span>. In the most cited study (Lally and colleagues, 2010), 96 people chose an action to repeat every day for 12 weeks. Among the 39 whose data fitted the model, the median time to reach 95% of their own maximum automaticity was <b>66 days</b> — with huge variation, from 18 to 254 days (the latter a projection beyond the end of the study) <span data-src="res"></span>. There is no universal number: the time depends on the person and the action. Two things matter more than the number:</p>
<ul><li><b>Missing a single day did not derail</b> habit formation; being very irregular did.</li>
<li>More demanding actions (such as exercise) tended to take longer to become automatic than simple ones.</li></ul>
<h2>Anchors: "after X, I do Y"</h2>
<p>Planning <em>when</em> and <em>where</em> ("if it is Monday at 9am, then I open the review") is called an <b>implementation intention</b> (Gollwitzer). It is one of the most studied techniques: the 2006 meta-analysis (94 tests) found a medium-to-large effect over intention alone <span data-src="res"></span>; a larger 2024 meta-analysis (642 tests) confirmed the effect on behaviour, thoughts and feelings, larger when the plan takes the "if… then…" form and is rehearsed <span data-src="res"></span>. Summaries of that analysis report that, once corrected for publication bias, the effect becomes considerably smaller — we have not confirmed those figures in the full text. James Clear's "habit stacking" and the "anchors" of BJ Fogg's <em>Tiny Habits</em> are applications of this idea <span data-src="auth"></span>.</p>
<h2>The four laws (James Clear)</h2>
<p>Clear splits a habit into <b>cue → craving → response → reward</b>, and proposes four laws to build one: make it <b>obvious, attractive, easy and satisfying</b> — and the inverse to break one: invisible, unattractive, difficult, unsatisfying <span data-src="auth"></span>. It is a practical model that combines ideas from several places (reinforcement learning, context, friction); it has not been tested as a whole, but each law points to a lever you can try.</p>
<div data-demo="m-loop"></div>
<h2>Identity: "I am someone who…"</h2>
<p>Clear proposes identity-based habits: every repetition is a "vote" for the kind of person you want to be <span data-src="auth"></span>. There is support for the reverse direction — we infer who we are partly from what we see ourselves do (Bem's self-perception theory) <span data-src="res"></span>. But beware magical versions: a famous study in which asking people to "be a voter" (rather than "vote") raised turnout <b>did not replicate</b> in larger field experiments — the original authors dispute those replications, but the 2020 one was designed to answer their criticism <span data-src="weak"></span>. Identity helps you <em>keep</em> what you already do; it does not replace repetition.</p>
<h2>In your system</h2>
<ul><li>The weekly review is the parent habit: a fixed time, a fixed place, a fixed agenda <span data-src="tip"></span>.</li>
<li>Anchor the Big 3 to something you already do every morning (coffee, opening the laptop) <span data-src="tip"></span>.</li>
<li>Start absurdly small: "open the Today filter" counts. The action grows later <span data-src="auth"></span>.</li></ul>`,
    },
    take: B(['Um hábito é contexto + repetição, não força de vontade.', 'Semanas a meses, não 21 dias — e falhar um dia não estraga.', '"Depois de X, faço Y": ancora o novo ao que já fazes.', 'Mudar o ambiente é mais fiável do que prometer a ti próprio.'],
            ['A habit is context + repetition, not willpower.', 'Weeks to months, not 21 days — and missing a day does not ruin it.', '"After X, I do Y": anchor the new to what you already do.', 'Changing your environment is more reliable than promising yourself.']),
    next: [{ href: '#experimentar/habito', l: B('Desenhar um hábito no laboratório', 'Design a habit in the lab') }, { href: '#aprender/rituais', l: B('A revisão semanal (percurso Organizar)', 'The weekly review (Organizing track)') }],
    refs: [
      ref('Lally, P., van Jaarsveld, C., Potts, H. & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. <i>European Journal of Social Psychology</i>, 40(6), 998–1009.', 'https://doi.org/10.1002/ejsp.674'),
      ref('Wood, W., Quinn, J. & Kashy, D. (2002). Habits in everyday life. <i>Journal of Personality and Social Psychology</i>, 83(6), 1281–1297.', 'https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Wood.Quinn_.Kashy_.2002_Habits_in_everyday_life.pdf'),
      ref('Neal, D., Wood, W. & Quinn, J. (2006). Habits — a repeat performance. <i>Current Directions in Psychological Science</i>, 15(4), 198–202.', 'https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Neal.Wood_.Quinn_.2006_Habits_a_repeat_performance.pdf'),
      ref('Gollwitzer, P. & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. <i>Advances in Experimental Social Psychology</i>, 38, 69–119.'),
      ref('Sheeran, P., Listrom, O. & Gollwitzer, P. M. (2025). The when and how of planning: Meta-analysis of the scope and components of implementation intentions in 642 tests. <i>European Review of Social Psychology</i>, 36(1), 162–194 (online em / online in 2024).', 'https://doi.org/10.1080/10463283.2024.2334563'),
      ref('Bem, D. (1972). Self-perception theory. <i>Advances in Experimental Social Psychology</i>, 6, 1–62.'),
      ref('Bryan, C., Walton, G., Rogers, T. & Dweck, C. (2011). Motivating voter turnout by invoking the self. <i>PNAS</i>, 108(31), 12653–12656.'),
      ref('Gerber, A., Huber, G., Biggers, D. & Hendry, D. (2016). A field experiment shows that subtle linguistic cues might not affect voter behavior. <i>PNAS</i>. · Gerber, A., Huber, G. & Fang, A. (2018), <i>Political Psychology</i>. · Gerber, A., Huber, G. & Fang, A. (2020). Voting behavior is unaffected by subtle linguistic cues: Evidence from a psychologically authentic replication. <i>Behavioural Public Policy</i>, 7(2), 380–394.', 'https://doi.org/10.1073/pnas.1513727113'),
      ref('Clear, J. (2018). <i>Atomic Habits</i>. Avery. · Fogg, B. J. (2019). <i>Tiny Habits</i>. Houghton Mifflin Harcourt. · Wood, W. (2019). <i>Good Habits, Bad Habits</i>. FSG.'),
    ] },

  /* ───────────────────────── adiar ───────────────────────── */
  { id: 'adiar', block: 'executar', min: 8, kinds: [],
    title: B('Agora contra depois: porque adiamos', 'Now versus later: why we put things off'),
    lede: B('Adiar raramente é preguiça ou má gestão do tempo. É, muitas vezes, fugir a um mau bocado agora — e passar a conta ao "eu" de amanhã.',
            'Putting things off is rarely laziness or poor time management. It is often escaping a bad moment now — and handing the bill to tomorrow\'s self.'),
    body: {
      pt: `
<h2>O presente pesa mais</h2>
<p>Damos menos valor a recompensas que chegam mais tarde, e essa desvalorização é mais forte perto do presente do que longe dele (desconto temporal, de forma hiperbólica) <span data-src="res"></span>. Por isso "começo amanhã" parece sempre razoável hoje — e amanhã volta a parecer.</p>
<div data-demo="m-discount"></div>
<h2>O que prevê o adiamento</h2>
<p>A maior meta-análise sobre procrastinação (Steel, 2007, 691 correlações) encontrou como preditores mais fortes: <b>a tarefa ser aversiva</b>, <b>a recompensa estar longe</b>, <b>pouca confiança em conseguir</b> (autoeficácia) e <b>impulsividade</b>/distração <span data-src="res"></span>. Steel e König juntaram-nos na teoria da motivação temporal: a motivação sobe com a <b>expectativa</b> de conseguir e com o <b>valor</b> do resultado, e desce quanto maiores forem a <b>impulsividade</b> e o <b>atraso</b> até à recompensa <span data-src="est"></span>. É uma teoria, não uma medição — e uma forma útil de ver as quatro alavancas.</p>
<h2>É sobretudo emocional</h2>
<p>Sirois e Pychyl descrevem a procrastinação como <b>reparar o humor a curto prazo</b>: fugimos do desconforto que a tarefa provoca agora (tédio, frustração, dúvida, medo de não estar à altura), e o custo cai no "eu" futuro <span data-src="res"></span>. Isto explica porque "organiza-te melhor" raramente resolve: a lista está organizada, o problema é o que sentes ao olhar para ela.</p>
<h2>O que costuma ajudar</h2>
<ul>
<li><b>Tornar o primeiro passo pequeno e concreto</b> — a próxima ação do GTD é exatamente isto: reduz a incerteza e o desconforto de começar <span data-src="est"></span>.</li>
<li><b>Aproximar o prazo</b>: numa experiência com estudantes, prazos intermédios impostos e espaçados deram melhores resultados do que um só prazo no fim <span data-src="res"></span>.</li>
<li><b>Aproximar a recompensa</b>: juntar a tarefa a algo de que gostas ("temptation bundling", Milkman). No estudo original o efeito foi grande no início e foi caindo; num ensaio 15 vezes maior, o ganho de ensinar a "juntar" foi modesto <span data-src="res"></span>.</li>
<li><b>Afastar a tentação</b> (ambiente) em vez de lhe resistir <span data-src="tip"></span>.</li>
<li><b>Planear quando e onde</b> (intenções de implementação, capítulo anterior) <span data-src="res"></span>.</li>
<li><b>Dar nome ao que estás a evitar</b> — "isto é aborrecido" ou "não sei por onde começar" pedem soluções diferentes <span data-src="tip"></span>.</li>
</ul>
<p class="lr-note">A ideia de que a "força de vontade se gasta" como um depósito (ego depletion) era popular, mas uma replicação em 23 laboratórios encontrou um efeito próximo de zero <span data-src="weak"></span>. Não precisas de "poupar" força de vontade — precisas de depender menos dela.</p>`,
      en: `
<h2>The present weighs more</h2>
<p>We value rewards less the later they arrive, and that discount is steeper close to the present than far from it (temporal discounting, hyperbolic in shape) <span data-src="res"></span>. That is why "I'll start tomorrow" always sounds reasonable today — and does again tomorrow.</p>
<div data-demo="m-discount"></div>
<h2>What predicts putting things off</h2>
<p>The largest meta-analysis of procrastination (Steel, 2007, 691 correlations) found the strongest predictors to be: <b>the task being aversive</b>, <b>the reward being far away</b>, <b>low confidence in succeeding</b> (self-efficacy) and <b>impulsiveness</b>/distractibility <span data-src="res"></span>. Steel and König brought them together in temporal motivation theory: motivation rises with the <b>expectancy</b> of succeeding and the <b>value</b> of the outcome, and falls the greater the <b>impulsiveness</b> and the <b>delay</b> until the reward <span data-src="est"></span>. It is a theory, not a measurement — and a useful way to see the four levers.</p>
<h2>It is mostly emotional</h2>
<p>Sirois and Pychyl describe procrastination as <b>short-term mood repair</b>: we escape the discomfort the task causes now (boredom, frustration, doubt, fear of not being good enough), and the cost lands on our future self <span data-src="res"></span>. That explains why "get organised" rarely fixes it: the list is organised; the problem is how you feel when you look at it.</p>
<h2>What tends to help</h2>
<ul>
<li><b>Make the first step small and concrete</b> — GTD's next action is exactly this: it cuts the uncertainty and discomfort of starting <span data-src="est"></span>.</li>
<li><b>Bring the deadline closer</b>: in an experiment with students, imposed, evenly spaced intermediate deadlines produced better results than a single deadline at the end <span data-src="res"></span>.</li>
<li><b>Bring the reward closer</b>: pair the task with something you enjoy ("temptation bundling", Milkman). In the original study the effect was large at first and faded; in a trial 15 times larger, the gain from teaching people to "bundle" was modest <span data-src="res"></span>.</li>
<li><b>Move the temptation away</b> (environment) instead of resisting it <span data-src="tip"></span>.</li>
<li><b>Plan when and where</b> (implementation intentions, previous chapter) <span data-src="res"></span>.</li>
<li><b>Name what you are avoiding</b> — "this is boring" and "I don't know where to start" call for different fixes <span data-src="tip"></span>.</li>
</ul>
<p class="lr-note">The idea that "willpower gets used up" like a tank (ego depletion) was popular, but a replication across 23 labs found an effect close to zero <span data-src="weak"></span>. You don't need to "save" willpower — you need to rely on it less.</p>`,
    },
    take: B(['Adiar é sobretudo fugir a um desconforto agora.', 'Quatro alavancas: confiança, valor, impulsividade, distância da recompensa.', 'Um primeiro passo pequeno resolve mais do que uma lista mais bonita.', 'Depende menos da força de vontade: muda o ambiente.'],
            ['Putting things off is mostly escaping discomfort now.', 'Four levers: confidence, value, impulsiveness, distance to the reward.', 'A small first step fixes more than a prettier list.', 'Rely less on willpower: change the environment.']),
    next: [{ href: '#experimentar/adiar', l: B('Porque é que estou a adiar isto?', 'Why am I putting this off?') }, { href: '#aprender/gtd', l: B('A próxima ação (GTD)', 'The next action (GTD)') }],
    refs: [
      ref('Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure. <i>Psychological Bulletin</i>, 133(1), 65–94.', 'https://prism.ucalgary.ca/items/d0dea740-4751-4e9a-84da-2d8ad446830d/full'),
      ref('Steel, P. & König, C. (2006). Integrating theories of motivation. <i>Academy of Management Review</i>, 31(4), 889–913 (a forma exata da equação varia entre textos; aqui só usamos a sua estrutura / the exact form of the equation varies between texts; only its structure is used here).'),
      ref('Sirois, F. & Pychyl, T. (2013). Procrastination and the priority of short-term mood regulation: Consequences for future self. <i>Social and Personality Psychology Compass</i>, 7(2), 115–127.', 'https://eprints.whiterose.ac.uk/id/eprint/91793/'),
      ref('Milkman, K., Minson, J. & Volpp, K. (2014). Holding the Hunger Games hostage at the gym: An evaluation of temptation bundling. <i>Management Science</i>, 60(2), 283–299.', 'https://repository.upenn.edu/oid_papers/150'),
      ref('Kirgios, E., Mandel, G., Park, Y., Milkman, K., Gromet, D., Kay, J. & Duckworth, A. (2020). Teaching temptation bundling to boost exercise: A field experiment. <i>Organizational Behavior and Human Decision Processes</i>, 161, 20–35 (6 792 participantes / participants).', 'https://econpapers.repec.org/RePEc:eee:jobhdp:v:161:y:2020:i:s:p:20-35'),
      ref('Ariely, D. & Wertenbroch, K. (2002). Procrastination, deadlines, and performance: Self-control by precommitment. <i>Psychological Science</i>, 13(3), 219–224.'),
      ref('Hagger, M. et al. (2016). A multilab preregistered replication of the ego-depletion effect. <i>Perspectives on Psychological Science</i>, 11(4), 546–573 (23 laboratórios / labs, N = 2141, d = 0,04).'),
      ref('Ainslie, G. (1975). Specious reward: A behavioral theory of impulsiveness and impulse control. <i>Psychological Bulletin</i>, 82(4), 463–496.'),
    ] },

  /* ───────────────────────── foco ───────────────────────── */
  { id: 'foco', block: 'executar', min: 8, kinds: [],
    title: B('Foco, interrupções e energia', 'Focus, interruptions and energy'),
    lede: B('Cada troca de tarefa custa alguma coisa, e uma tarefa mal fechada continua a ocupar a cabeça. O foco protege-se com o desenho do dia — e com descanso a sério.',
            'Every task switch costs something, and a task left half-closed keeps occupying your mind. Focus is protected by how the day is designed — and by real rest.'),
    body: {
      pt: `
<h2>Trocar de tarefa custa</h2>
<p>Em laboratório, mudar de uma tarefa para outra é mais lento e dá mais erros do que repetir a mesma: o cérebro tem de "carregar" as regras da nova <span data-src="res"></span>. Em tarefas simples o custo é de frações de segundo por troca; o que pesa no trabalho real é o número de trocas e o que fica para trás.</p>
<h2>Resíduo de atenção</h2>
<p>Sophie Leroy mostrou que, ao passar para uma tarefa nova, parte da atenção fica presa na anterior — sobretudo quando ficou por acabar — e o desempenho na nova baixa <span data-src="res"></span>. Um detalhe curioso do estudo: acabar a tarefa anterior <em>sob um prazo apertado</em> ajudou a desligar dela.</p>
<p>É aqui que a captura do GTD ganha uma razão de ser: em experiências de Masicampo e Baumeister, objetivos por cumprir geravam pensamentos intrusivos e pior desempenho noutra tarefa — e <b>fazer um plano concreto</b> para eles reduzia essa interferência <span data-src="res"></span>. Escrever a próxima ação antes de mudar de tarefa é uma forma barata de "fechar" o ciclo <span data-src="tip"></span>.</p>
<h2>Interrupções</h2>
<p>Num estudo de Gloria Mark e colegas, quem era interrompido acabava as tarefas <b>mais depressa</b>, com qualidade semelhante — mas com mais stress, frustração e pressão de tempo <span data-src="res"></span>. As interrupções não só roubam tempo; cobram-no em desgaste.</p>
<p>O "trabalho profundo" de Cal Newport — blocos longos sem distrações para o trabalho que exige mais — é um modelo de autor que organiza estas ideias <span data-src="auth"></span>. No teu sistema já existe uma versão leve: <b>um bloco de foco por semana</b>, escolhido na revisão <span data-src="own"></span>.</p>
<h2>Energia e recuperação</h2>
<ul>
<li><b>Pausas curtas</b> (10 minutos ou menos) associam-se a mais vigor e menos fadiga; numa meta-análise, não melhoraram o desempenho em geral — pausas mais longas podem ser precisas para trabalho exigente <span data-src="res"></span>.</li>
<li><b>Sono</b>: duas semanas a dormir 6 horas por noite produziram défices cognitivos que se acumularam — e as pessoas quase não davam por eles <span data-src="res"></span>.</li>
<li>Ciclos de "90 minutos" de energia e afirmações precisas sobre "horas de ouro" são populares mas têm pouca base direta <span data-src="weak"></span>. O que é útil: <b>observa quando o teu trabalho difícil corre melhor</b> e protege essas horas <span data-src="tip"></span>.</li>
</ul>`,
      en: `
<h2>Switching costs</h2>
<p>In the lab, switching from one task to another is slower and more error-prone than repeating the same one: the brain has to "load" the new task's rules <span data-src="res"></span>. In simple tasks the cost is fractions of a second per switch; what weighs in real work is the number of switches and what gets left behind.</p>
<h2>Attention residue</h2>
<p>Sophie Leroy showed that when moving to a new task, part of your attention stays stuck on the previous one — especially if it was left unfinished — and performance on the new one drops <span data-src="res"></span>. A curious detail of the study: finishing the previous task <em>under a tight deadline</em> helped people let go of it.</p>
<p>This is where GTD capture earns its keep: in experiments by Masicampo and Baumeister, unfulfilled goals produced intrusive thoughts and worse performance on another task — and <b>making a concrete plan</b> for them reduced that interference <span data-src="res"></span>. Writing down the next action before switching tasks is a cheap way to "close" the loop <span data-src="tip"></span>.</p>
<h2>Interruptions</h2>
<p>In a study by Gloria Mark and colleagues, interrupted people finished tasks <b>faster</b>, with similar quality — but with more stress, frustration and time pressure <span data-src="res"></span>. Interruptions don't only steal time; they charge it as wear.</p>
<p>Cal Newport's "deep work" — long distraction-free blocks for the most demanding work — is an author's model that organises these ideas <span data-src="auth"></span>. Your system already has a light version: <b>one focus block a week</b>, chosen at the review <span data-src="own"></span>.</p>
<h2>Energy and recovery</h2>
<ul>
<li><b>Short breaks</b> (10 minutes or less) are associated with more vigour and less fatigue; in a meta-analysis they did not improve performance overall — longer breaks may be needed for demanding work <span data-src="res"></span>.</li>
<li><b>Sleep</b>: two weeks of 6-hour nights produced cognitive deficits that kept accumulating — and people barely noticed them <span data-src="res"></span>.</li>
<li>"90-minute" energy cycles and precise claims about "golden hours" are popular but have little direct support <span data-src="weak"></span>. What is useful: <b>notice when your hard work goes best</b> and protect those hours <span data-src="tip"></span>.</li>
</ul>`,
    },
    take: B(['Menos trocas vale mais do que trocas mais rápidas.', 'Antes de mudar, escreve a próxima ação: fecha o ciclo.', 'Interrupções custam tempo e desgaste.', 'Sono e pausas não são prémios — são parte do trabalho.'],
            ['Fewer switches beat faster switches.', 'Before switching, write down the next action: close the loop.', 'Interruptions cost time and wear.', 'Sleep and breaks are not rewards — they are part of the work.']),
    next: [{ href: '#experimentar/foco', l: B('Mede o teu custo de troca e desenha um dia', 'Measure your switch cost and design a day') }, { href: '#aplicar/revisao', l: B('O bloco de foco na revisão', 'The focus block in the review') }],
    refs: [
      ref('Monsell, S. (2003). Task switching. <i>Trends in Cognitive Sciences</i>, 7(3), 134–140. · Rubinstein, J., Meyer, D. & Evans, J. (2001). Executive control of cognitive processes in task switching. <i>JEP: Human Perception and Performance</i>, 27(4), 763–797.'),
      ref('Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. <i>Organizational Behavior and Human Decision Processes</i>, 109(2), 168–181.', 'https://econpapers.repec.org/RePEc:eee:jobhdp:v:109:y:2009:i:2:p:168-181'),
      ref('Masicampo, E. J. & Baumeister, R. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. <i>JPSP</i>, 101(4), 667–683.', 'https://pubmed.ncbi.nlm.nih.gov/21688924/'),
      ref('Mark, G., Gudith, D. & Klocke, U. (2008). The cost of interrupted work: More speed and stress. <i>Proceedings of CHI 2008</i>, 107–110.', 'https://www.ics.uci.edu/~gmark/chi08-mark.pdf'),
      ref('Albulescu, P. et al. (2022). "Give me a break!" A systematic review and meta-analysis on the efficacy of micro-breaks. <i>PLOS ONE</i>, 17(8), e0272460.', 'https://www.eurekalert.org/news-releases/962663'),
      ref('Van Dongen, H., Maislin, G., Mullington, J. & Dinges, D. (2003). The cumulative cost of additional wakefulness. <i>SLEEP</i>, 26(2), 117–126.', 'https://ntrs.nasa.gov/citations/20040087752'),
      ref('Newport, C. (2016). <i>Deep Work</i>. Grand Central.'),
    ] },

  /* ───────────────────────── decidir ───────────────────────── */
  { id: 'decidir', block: 'dirigir', min: 9, kinds: [],
    title: B('Como julgamos: rápido, devagar, e otimista demais', 'How we judge: fast, slow, and too optimistic'),
    lede: B('Planear é prever — e as previsões humanas falham de formas conhecidas. Saber quais é a melhor defesa: não confiar menos em ti, mas pôr o sistema a corrigir-te.',
            'Planning is forecasting — and human forecasts fail in known ways. Knowing which is the best defence: not trusting yourself less, but letting the system correct you.'),
    body: {
      pt: `
<h2>Sistema 1 e Sistema 2</h2>
<p>Daniel Kahneman popularizou duas formas de pensar: uma <b>rápida, automática e intuitiva</b> (Sistema 1) e uma <b>lenta, deliberada e cansativa</b> (Sistema 2) <span data-src="est"></span>. O próprio Kahneman apresenta-os como "personagens" para facilitar a explicação — não como duas partes do cérebro. A intuição é excelente onde há experiência e feedback rápido; falha em problemas novos e em previsões.</p>
<div data-demo="m-sys12"></div>
<h2>A falácia do planeamento</h2>
<p>Subestimamos quanto tempo as nossas tarefas vão levar, mesmo quando sabemos que tarefas parecidas se atrasaram antes (Kahneman e Tversky deram-lhe o nome) <span data-src="res"></span>. Num estudo clássico, estudantes previram em média 34 dias para acabar a tese; levaram 56, e só cerca de 30% acabaram a tempo — e eram menos otimistas a prever o tempo dos <em>outros</em> <span data-src="res"></span>. O que ajudou: obrigar a pensar em experiências passadas parecidas.</p>
<p>A correção prática chama-se <b>classe de referência</b>: em vez de imaginar os passos, pergunta "quanto demoraram as últimas cinco coisas parecidas?" <span data-src="est"></span>. É por isso que a revisão semanal tem uma verificação de capacidade: não é pessimismo, é usar o teu histórico <span data-src="own"></span>.</p>
<h2>Âncoras e enquadramentos</h2>
<p>Um número que vês antes de estimar puxa a estimativa para ele (ancoragem), e a mesma escolha descrita como ganho ou como perda muda o que as pessoas preferem (enquadramento) <span data-src="res"></span>. Ao contrário de muita psicologia popular, estes dois efeitos <b>replicaram-se</b> num grande projeto com dezenas de amostras (Many Labs) <span data-src="res"></span>. Na prática: estima antes de veres a estimativa de outra pessoa; descreve uma decisão das duas formas antes de escolher <span data-src="tip"></span>.</p>
<h2>O pré-mortem</h2>
<p>Gary Klein propôs imaginar que o projeto <em>já falhou</em> e escrever porquê, antes de começar <span data-src="auth"></span>. Klein apoia-se num estudo de 1989 sobre explicar acontecimentos imaginados como já ocorridos (Mitchell, Russo e Pennington); a melhoria de "30%" que costuma acompanhar a técnica vem da leitura de Klein e não a confirmámos no artigo original <span data-src="auth"></span>. É barato e encaixa no modelo de projeto: as razões são hipóteses — viram riscos na página do projeto e, quando há ação, tarefas.</p>
<p class="lr-note">Uma ressalva honesta: o capítulo do livro de Kahneman sobre "priming" (palavras que mudariam o comportamento sem darmos por isso) assentava em estudos que não se replicaram — o próprio Kahneman alertou para um "acidente de comboio" nesta área em 2012 <span data-src="weak"></span>. O resto do livro, incluindo os vieses acima, tem melhor apoio.</p>`,
      en: `
<h2>System 1 and System 2</h2>
<p>Daniel Kahneman popularised two modes of thinking: one <b>fast, automatic and intuitive</b> (System 1) and one <b>slow, deliberate and effortful</b> (System 2) <span data-src="est"></span>. Kahneman himself presents them as "characters" to make the explanation easier — not as two parts of the brain. Intuition is excellent where there is experience and quick feedback; it fails on new problems and on forecasts.</p>
<div data-demo="m-sys12"></div>
<h2>The planning fallacy</h2>
<p>We underestimate how long our own tasks will take, even when we know similar tasks ran late before (Kahneman and Tversky named it) <span data-src="res"></span>. In a classic study, students predicted on average 34 days to finish their thesis; they took 56, and only about 30% finished on time — and they were less optimistic predicting <em>other people's</em> time <span data-src="res"></span>. What helped: making them think about similar past experiences.</p>
<p>The practical fix is called a <b>reference class</b>: instead of imagining the steps, ask "how long did the last five similar things take?" <span data-src="est"></span>. That is why the weekly review has a capacity check: it is not pessimism, it is using your track record <span data-src="own"></span>.</p>
<h2>Anchors and frames</h2>
<p>A number you see before estimating pulls the estimate towards it (anchoring), and the same choice described as a gain or as a loss changes what people prefer (framing) <span data-src="res"></span>. Unlike a lot of popular psychology, both effects <b>replicated</b> in a large project with dozens of samples (Many Labs) <span data-src="res"></span>. In practice: estimate before you see someone else's estimate; describe a decision both ways before choosing <span data-src="tip"></span>.</p>
<h2>The premortem</h2>
<p>Gary Klein proposed imagining that the project <em>has already failed</em> and writing down why, before you start <span data-src="auth"></span>. Klein builds on a 1989 study about explaining events imagined as having already happened (Mitchell, Russo and Pennington); the "30%" improvement often quoted with the technique comes from Klein's reading and we have not confirmed it in the original paper <span data-src="auth"></span>. It is cheap and fits the project model: the reasons are hypotheses — they become risks on the project page and, where there is an action, tasks.</p>
<p class="lr-note">An honest caveat: the chapter of Kahneman's book on "priming" (words that supposedly change behaviour without us noticing) rested on studies that did not replicate — Kahneman himself warned of a "train wreck" in this area in 2012 <span data-src="weak"></span>. The rest of the book, including the biases above, has better support.</p>`,
    },
    take: B(['A intuição é ótima com experiência e feedback; fraca a prever.', 'Estima com o histórico (classe de referência), não com os passos imaginados.', 'Estima antes de ouvir números; vê a decisão como ganho e como perda.', 'Antes de um projeto: imagina que falhou e escreve porquê.'],
            ['Intuition is great with experience and feedback; weak at forecasting.', 'Estimate from your track record (reference class), not imagined steps.', 'Estimate before hearing numbers; see a decision as gain and as loss.', 'Before a project: imagine it failed and write down why.']),
    next: [{ href: '#experimentar/decidir', l: B('Calibrar as tuas estimativas e fazer um pré-mortem', 'Calibrate your estimates and run a premortem') }],
    refs: [
      ref('Kahneman, D. (2011). <i>Thinking, Fast and Slow</i>. FSG. · Kahneman, D. & Tversky, A. (1979). Intuitive prediction: Biases and corrective procedures. <i>TIMS Studies in Management Science</i>, 12, 313–327.'),
      ref('Buehler, R., Griffin, D. & Ross, M. (1994). Exploring the "planning fallacy". <i>JPSP</i>, 67(3), 366–381.', 'https://bear.warrington.ufl.edu/brenner/mar7588/Papers/buehler-et-al-1994.pdf'),
      ref('Tversky, A. & Kahneman, D. (1974). Judgment under uncertainty: Heuristics and biases. <i>Science</i>, 185, 1124–1131. · (1981). The framing of decisions and the psychology of choice. <i>Science</i>, 211, 453–458.'),
      ref('Frederick, S. (2005). Cognitive reflection and decision making. <i>Journal of Economic Perspectives</i>, 19(4), 25–42 (as perguntas da demonstração são originais, no mesmo estilo / the demo questions are original, in the same style).'),
      ref('Klein, R. et al. (2014). Investigating variation in replicability: A "Many Labs" replication project. <i>Social Psychology</i>, 45(3), 142–152.', 'https://www.doi.org/10.1027/1864-9335/A000178'),
      ref('Klein, G. (2007). Performing a project premortem. <i>Harvard Business Review</i>, 85(9). · Mitchell, D., Russo, J. & Pennington, N. (1989). Back to the future: Temporal perspective in the explanation of events. <i>Journal of Behavioral Decision Making</i>, 2(1), 25–38.'),
      ref('Kahneman, D. (2012). Carta aberta sobre a replicação de estudos de priming / open letter on priming replication; Schimmack, U., Heene, M. & Kesavan, K. (2017). Reconstruction of a train wreck.', 'https://replicationindex.com/2017/02/02/reconstruction-of-a-train-wreck-how-priming-research-went-of-the-rails/'),
    ] },

  /* ───────────────────────── motivação ───────────────────────── */
  { id: 'motivacao', block: 'dirigir', min: 8, kinds: [],
    title: B('O que nos move', 'What moves us'),
    lede: B('Uma rotina que dependa só de prémios e de disciplina acaba por se partir. As que duram costumam ter escolha, progresso visível e uma razão que interessa.',
            'A routine that depends only on rewards and discipline eventually breaks. The ones that last usually have choice, visible progress and a reason that matters.'),
    body: {
      pt: `
<h2>A teoria por trás</h2>
<p>A <b>teoria da autodeterminação</b> (Deci e Ryan) é das teorias de motivação mais estudadas. Propõe três necessidades psicológicas: <b>autonomia</b> (sentir que escolhes), <b>competência</b> (sentir que és capaz e progrides) e <b>relação</b> (ligação aos outros) <span data-src="est"></span>. Quando o ambiente as apoia, a motivação tende a ser mais autónoma e mais persistente <span data-src="res"></span>.</p>
<h2>O livro <em>Drive</em></h2>
<p>Daniel Pink levou estas ideias ao trabalho com três palavras: <b>autonomia, mestria e propósito</b> <span data-src="auth"></span>. Repara na diferença: autonomia e mestria correspondem a autonomia e competência; Pink troca a "relação" por "propósito". É uma síntese de autor, útil e memorável, mas não é a teoria original.</p>
<h2>Prémios: quando ajudam e quando estragam</h2>
<p>Uma meta-análise de 128 experiências (Deci, Koestner e Ryan, 1999) concluiu que <b>prémios tangíveis e esperados</b>, dados por fazer uma atividade que já era interessante, tendem a reduzir a motivação intrínseca para ela — mais em crianças do que em universitários — enquanto o feedback positivo tendeu a aumentá-la <span data-src="res"></span>. Mas o quadro é mais fino do que "prémios são maus":</p>
<ul><li>O resultado foi contestado por outra equipa (Cameron e Pierce), que encontrou efeitos mais limitados — o debate continua <span data-src="res"></span>.</li>
<li>Para tarefas <b>aborrecidas</b> não há motivação intrínseca a estragar; aí, um prémio ou um prazo podem simplesmente ajudar <span data-src="est"></span>.</li>
<li>Para tarefas aborrecidas que importam, explicar <b>porquê</b> e dar alguma escolha no <b>como</b> ajuda a "interiorizar" a razão <span data-src="est"></span>.</li></ul>
<div data-demo="m-reward"></div>
<h2>No teu sistema</h2>
<ul><li><b>Autonomia</b>: és tu que escolhes os Big 3 de entre a lista — não a app <span data-src="own"></span>.</li>
<li><b>Competência</b>: ✓ no caderno e projetos que passam a "Done" são progresso visível. Um hábito pequeno que corre bem vale mais que um grande que falha <span data-src="tip"></span>.</li>
<li><b>Propósito / relação</b>: na página de cada projeto, o "Objetivo" responde a "para quem é isto e porque importa?" <span data-src="tip"></span>.</li></ul>`,
      en: `
<h2>The theory underneath</h2>
<p><b>Self-determination theory</b> (Deci and Ryan) is among the most studied theories of motivation. It proposes three psychological needs: <b>autonomy</b> (feeling you choose), <b>competence</b> (feeling capable and making progress) and <b>relatedness</b> (connection to others) <span data-src="est"></span>. When the environment supports them, motivation tends to be more self-endorsed and more persistent <span data-src="res"></span>.</p>
<h2>The book <em>Drive</em></h2>
<p>Daniel Pink brought these ideas to work with three words: <b>autonomy, mastery and purpose</b> <span data-src="auth"></span>. Notice the difference: autonomy and mastery map to autonomy and competence; Pink swaps "relatedness" for "purpose". It is an author's synthesis, useful and memorable, but it is not the original theory.</p>
<h2>Rewards: when they help and when they spoil</h2>
<p>A meta-analysis of 128 experiments (Deci, Koestner and Ryan, 1999) concluded that <b>tangible, expected rewards</b>, given for doing an activity that was already interesting, tend to reduce intrinsic motivation for it — more in children than in university students — while positive feedback tended to increase it <span data-src="res"></span>. But the picture is finer than "rewards are bad":</p>
<ul><li>The result was disputed by another team (Cameron and Pierce), who found more limited effects — the debate continues <span data-src="res"></span>.</li>
<li>For <b>boring</b> tasks there is no intrinsic motivation to spoil; there, a reward or a deadline may simply help <span data-src="est"></span>.</li>
<li>For boring tasks that matter, explaining <b>why</b> and giving some choice in <b>how</b> helps "internalise" the reason <span data-src="est"></span>.</li></ul>
<div data-demo="m-reward"></div>
<h2>In your system</h2>
<ul><li><b>Autonomy</b>: you pick the Big 3 from the list — not the app <span data-src="own"></span>.</li>
<li><b>Competence</b>: ✓ in the notebook and projects moving to "Done" are visible progress. A small habit that goes well is worth more than a big one that fails <span data-src="tip"></span>.</li>
<li><b>Purpose / relatedness</b>: on each project page, the "Objective" answers "who is this for and why does it matter?" <span data-src="tip"></span>.</li></ul>`,
    },
    take: B(['Autonomia, competência e relação sustentam a motivação (Pink diz propósito).', 'Prémios esperados podem estragar o gosto por coisas que já eram interessantes.', 'Para o aborrecido: explica o porquê e dá escolha no como.', 'Progresso visível alimenta a sensação de competência.'],
            ['Autonomy, competence and relatedness sustain motivation (Pink says purpose).', 'Expected rewards can spoil enjoyment of things that were already interesting.', 'For the boring: explain why and give a choice in how.', 'Visible progress feeds the sense of competence.']),
    next: [{ href: '#experimentar/motivacao', l: B('Redesenhar uma tarefa', 'Redesign a task') }],
    refs: [
      ref('Ryan, R. & Deci, E. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. <i>American Psychologist</i>, 55(1), 68–78.', 'https://doi.org/10.1037/0003-066X.55.1.68'),
      ref('Deci, E., Koestner, R. & Ryan, R. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. <i>Psychological Bulletin</i>, 125(6), 627–668.', 'https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf'),
      ref('Cameron, J. & Pierce, W. D. (1994). Reinforcement, reward, and intrinsic motivation: A meta-analysis. <i>Review of Educational Research</i>, 64(3), 363–423.'),
      ref('Pink, D. (2009). <i>Drive: The Surprising Truth About What Motivates Us</i>. Riverhead.'),
      ref('Deci, E., Eghrari, H., Patrick, B. & Leone, D. (1994). Facilitating internalization: The self-determination theory perspective. <i>Journal of Personality</i>, 62(1), 119–142.'),
    ] },

  /* ───────────────────────── importante ───────────────────────── */
  { id: 'importante', block: 'dirigir', min: 8, kinds: [],
    title: B('O que merece o teu tempo', 'What deserves your time'),
    lede: B('Um sistema bem organizado pode deixar-te muito eficiente a fazer as coisas erradas. Esta é a parte que escolhe para onde o sistema aponta.',
            'A well-organised system can make you very efficient at doing the wrong things. This is the part that chooses where the system points.'),
    body: {
      pt: `
<h2>Importante não é urgente</h2>
<p>Stephen Covey popularizou uma matriz de importância × urgência e a ideia de que o trabalho que muda as coisas está quase todo no quadrante <b>importante mas não urgente</b> (o seu "Quadrante II") <span data-src="auth"></span>. Há investigação que mostra porque é difícil: no <b>efeito da mera urgência</b>, as pessoas escolheram tarefas com prazo curto mas recompensa menor em vez de tarefas com recompensa maior — mesmo quando o "prazo" era ilusório; lembrar o ganho de cada tarefa na hora de escolher reduziu o efeito <span data-src="res"></span>.</p>
<p>No teu sistema, o antídoto já existe: na revisão semanal escolhes <b>uma coisa importante</b> e dás-lhe um bloco protegido no calendário <span data-src="own"></span>.</p>
<h2>Controlar, influenciar, aceitar</h2>
<p>Covey distingue o <b>círculo de preocupação</b> (o que te preocupa) do <b>círculo de influência</b> (onde consegues agir), e chama "proatividade" a pôr a energia no segundo <span data-src="auth"></span>. A ideia é muito mais antiga — Epicteto já separava o que depende de nós do que não depende <span data-src="est"></span>. Prático: para cada preocupação, uma de três saídas — <b>agir</b> (vira tarefa), <b>influenciar</b> (falar com alguém: vira "Insistir com…" ou entra no próximo 1:1) ou <b>largar</b> (deixa de ocupar a lista) <span data-src="tip"></span>.</p>
<h2>Começar pelo fim</h2>
<p>"Começar com o fim em mente" (Covey) é, na prática, planear de trás para a frente: o resultado, depois os marcos, depois a próxima ação de hoje <span data-src="auth"></span>. É exatamente o modelo de projeto do percurso Organizar: <b>Objetivo</b> na página, plano em texto, e só a próxima ação na lista <span data-src="own"></span>.</p>
<h2>Os outros hábitos de Covey, em poucas linhas</h2>
<p>Pensar em <b>ganho mútuo</b>, procurar <b>primeiro compreender</b> e depois ser compreendido, e <b>sinergia</b> são sobre trabalhar com pessoas; "afiar a serra" é sobre renovação <span data-src="auth"></span>. São princípios de um autor, não resultados de investigação; aqui aparecem onde tocam o sistema — no 1:1 (ouvir antes de propor) e no capítulo de foco e energia.</p>`,
      en: `
<h2>Important is not urgent</h2>
<p>Stephen Covey popularised an importance × urgency matrix and the idea that the work that changes things sits mostly in the <b>important but not urgent</b> quadrant (his "Quadrant II") <span data-src="auth"></span>. Research shows why it is hard: in the <b>mere urgency effect</b>, people chose tasks with a short deadline but a smaller reward over tasks with a bigger reward — even when the "deadline" was illusory; reminding them of each task's payoff at the moment of choice reduced the effect <span data-src="res"></span>.</p>
<p>In your system, the antidote already exists: at the weekly review you pick <b>one important thing</b> and give it a protected block in the calendar <span data-src="own"></span>.</p>
<h2>Control, influence, accept</h2>
<p>Covey separates the <b>circle of concern</b> (what worries you) from the <b>circle of influence</b> (where you can act), and calls putting your energy in the second "proactivity" <span data-src="auth"></span>. The idea is much older — Epictetus already separated what is up to us from what is not <span data-src="est"></span>. Practical: for each worry, one of three exits — <b>act</b> (it becomes a task), <b>influence</b> (talk to someone: it becomes "Chase…" or goes into the next 1:1) or <b>let go</b> (it stops occupying the list) <span data-src="tip"></span>.</p>
<h2>Begin with the end</h2>
<p>"Begin with the end in mind" (Covey) is, in practice, planning backwards: the outcome, then the milestones, then today's next action <span data-src="auth"></span>. It is exactly the project model from the Organizing track: the <b>Objective</b> on the page, the plan as text, and only the next action on the list <span data-src="own"></span>.</p>
<h2>Covey's other habits, briefly</h2>
<p>Thinking <b>win-win</b>, seeking <b>first to understand</b> then to be understood, and <b>synergy</b> are about working with people; "sharpen the saw" is about renewal <span data-src="auth"></span>. They are one author's principles, not research findings; here they appear where they touch the system — in the 1:1 (listen before proposing) and in the focus and energy chapter.</p>`,
    },
    take: B(['A urgência rouba escolhas mesmo quando é falsa — lembra-te do ganho de cada tarefa.', 'Uma coisa importante por semana, com tempo marcado.', 'Cada preocupação: agir, influenciar ou largar.', 'Planeia de trás para a frente; só a próxima ação vai para a lista.'],
            ['Urgency hijacks choices even when it is fake — recall each task\'s payoff.', 'One important thing a week, with time booked.', 'Each worry: act, influence or let go.', 'Plan backwards; only the next action goes on the list.']),
    next: [{ href: '#experimentar/prioridades', l: B('O que depende de mim — e o que importa', 'What is up to me — and what matters') }, { href: '#aplicar/projeto', l: B('Construir um projeto', 'Build a project') }],
    refs: [
      ref('Covey, S. (1989). <i>The 7 Habits of Highly Effective People</i>. Free Press.'),
      ref('Zhu, M., Yang, Y. & Hsee, C. (2018). The mere urgency effect. <i>Journal of Consumer Research</i>, 45(3), 673–690.', 'https://hub.jhu.edu/2018/05/31/meeting-deadlines-time-management-behaviors'),
      ref('Epicteto / Epictetus, <i>Enchiridion</i>, 1.'),
    ] },
  );
})();
