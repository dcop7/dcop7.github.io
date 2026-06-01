const LINKS_DATA = [
  {
    id: 'noticias', cat: 'Informação & Atualidade', cat_en: 'Information & News', icon: '📰',
    links: [
      { name:'Jornal de Notícias',     url:'https://www.jn.pt/',                         desc:'Notícias nacionais e foco regional',              desc_en:'National news with a regional focus',                tags:['notícias','jornais','portugal','nacional','regional','atualidade'] },
      { name:'Expresso',               url:'https://expresso.pt/',                        desc:'Jornalismo de referência e análise aprofundada',  desc_en:'Reference journalism and in-depth analysis',         tags:['notícias','jornais','análise','política','portugal'] },
      { name:'Diário de Notícias',     url:'https://www.dn.pt/',                          desc:'Título histórico da imprensa portuguesa',         desc_en:'Historic Portuguese newspaper',                      tags:['notícias','jornais','história','portugal','atualidade'] },
      { name:'Notícias ao Minuto',     url:'https://www.noticiasaominuto.com/',           desc:'Atualidade em tempo real, breaking news',         desc_en:'Real-time news and breaking stories',                tags:['notícias','tempo real','breaking','atualidade','rápido'] },
      { name:'Polígrafo',              url:'https://poligrafo.sapo.pt/',                  desc:'Verificação de factos em Portugal',               desc_en:'Fact-checking service in Portugal',                  tags:['fact-check','verificação','factos','verdade','portugal'] },
      { name:'Observador Fact Check',  url:'https://observador.pt/seccao/fact-check/',    desc:'Análise de veracidade de temas correntes',        desc_en:'Fact analysis on current affairs topics',            tags:['fact-check','verificação','observador','factos'] },
      { name:'Google Notícias',        url:'https://news.google.com/',                    desc:'Agregador de notícias globais em tempo real',     desc_en:'Global news aggregator in real time',                tags:['notícias','google','atualidade','mundo','internacional'] },
      { name:'Aquela Máquina',         url:'https://www.aquelamaquina.pt/',               desc:'Notícias do setor automóvel português',           desc_en:'Portuguese automotive sector news',                  tags:['automóvel','carros','motor','auto','lifestyle'] },
      { name:'Razão Automóvel',        url:'https://www.razaoautomovel.com/',             desc:'Ensaios e cultura automóvel',                     desc_en:'Car reviews and automotive culture',                 tags:['automóvel','carros','ensaios','motor','testes'] },
      { name:'Portugal Dir.',          url:'https://portugaldir.com/',                    desc:'Diretório de sites e serviços portugueses',       desc_en:'Directory of Portuguese websites and services',      tags:['portugal','diretório','sites','serviços'] },
    ]
  },
  {
    id: 'financas', cat: 'Finanças & Poupança', cat_en: 'Finance & Savings', icon: '💰',
    links: [
      { name:'Preços Combustíveis',     url:'https://precoscombustiveis.dgeg.gov.pt/',     desc:'Preços dos combustíveis em Portugal (DGEG)',      desc_en:'Official fuel prices in Portugal (DGEG)',            tags:['combustível','gasolina','gasóleo','preços','dgeg','portaria','portugal'] },
      { name:'Doutor Finanças',        url:'https://www.doutorfinancas.pt/',              desc:'Saúde financeira, crédito e habitação',           desc_en:'Financial health, credit and housing advice',        tags:['finanças','crédito','habitação','seguros','poupança','dinheiro'] },
      { name:'Contas Poupança',        url:'https://contaspoupanca.pt/',                  desc:'Dicas de poupança por Pedro Andersson',           desc_en:'Savings tips by Pedro Andersson',                    tags:['poupança','finanças','dicas','investimento','dinheiro'] },
      { name:'E-Konomista',            url:'https://ekonomista.pt/',                      desc:'Guia prático de economia e direitos do consumidor',desc_en:'Practical guide to economics and consumer rights',   tags:['economia','direitos','consumidor','finanças','prático'] },
      { name:'MoneyLab',               url:'https://moneylab.pt/',                        desc:'Educação financeira e investimentos pessoais',    desc_en:'Financial education and personal investments',        tags:['finanças','investimentos','educação','dinheiro'] },
      { name:'Tiago Felícia',          url:'https://www.tiagofelicia.pt/',                desc:'Literacia financeira e estratégias de investimento',desc_en:'Financial literacy and investment strategies',       tags:['literacia','finanças','investimentos','educação'] },
    ]
  },
  {
    id: 'habitacao', cat: 'Habitação & Bricolage', cat_en: 'Housing & DIY', icon: '🏠',
    links: [
      { name:'Fórum da Casa',          url:'https://www.forumdacasa.com/',                desc:'Maior comunidade de construção e obras em Portugal',desc_en:'Largest home improvement community in Portugal',     tags:['construção','obras','habitação','diy','casa','comunidade','bricolage'] },
      { name:'r/TudoCasa',             url:'https://www.reddit.com/r/TudoCasa/',          desc:'Comunidade Reddit sobre casa, obras e decoração em PT', desc_en:'Reddit community about homes and decor in PT',   tags:['casa','reddit','comunidade','obras','decoração','diy','portugal'] },
    ]
  },
  {
    id: 'tech', cat: 'Tecnologia & Digital', cat_en: 'Technology & Digital', icon: '💻',
    links: [
      { name:'Pplware',                url:'https://pplware.sapo.pt/',                    desc:'Software, apps e notícias digitais',              desc_en:'Software, apps and digital news in Portuguese',      tags:['tecnologia','software','apps','digital','tech','sapo'] },
      { name:'4gnews',                 url:'https://www.4gnews.pt/',                      desc:'Tecnologia de consumo e gadgets',                 desc_en:'Consumer technology and gadgets',                    tags:['tecnologia','gadgets','smartphones','tech','consumer'] },
      { name:'The New Stack',          url:'https://thenewstack.io/',                     desc:'Notícias e análises sobre cloud, DevOps e IA',    desc_en:'Cloud, DevOps and AI news and analysis',             tags:['cloud','devops','ia','kubernetes','tech','desenvolvimento'] },
      { name:'Lifehacker',             url:'https://lifehacker.com/',                     desc:'Dicas de eficiência tecnológica e produtividade', desc_en:'Tech efficiency and productivity tips',              tags:['produtividade','tecnologia','dicas','eficiência','lifehacks'] },
      { name:'Aberto até de Madrugada',url:'https://abertoatedemadrugada.com/',           desc:'Gadgets e domótica — tecnologia inteligente',    desc_en:'Gadgets and home automation technology',             tags:['gadgets','domótica','smart home','tecnologia','iot'] },
      { name:'Android Police',         url:'https://www.androidpolice.com/',              desc:'Notícias e análises sobre Android',               desc_en:'Android news and reviews',                           tags:['android','tech','smartphone','google','apps'] },
      { name:'Android Authority',      url:'https://www.androidauthority.com/',           desc:'Reviews e notícias do ecossistema Android',      desc_en:'Android ecosystem reviews and news',                 tags:['android','tech','reviews','smartphones','apps'] },
      { name:'Android Geek',           url:'https://androidgeek.pt/',                     desc:'Android em português — apps, dicas e tutoriais', desc_en:'Android in Portuguese — apps, tips and tutorials',   tags:['android','tech','portugal','apps','smartphones'] },
      { name:'XDA Forums',             url:'https://xdaforums.com/watched/threads',       desc:'Comunidade de desenvolvedores e modding Android', desc_en:'Android developer and modding community',            tags:['android','xda','modding','root','desenvolvimento','fórum'] },
      { name:'HirensBootCD',           url:'https://www.hirensbootcd.org/',               desc:'Ferramenta de recuperação e diagnóstico de sistemas',desc_en:'System recovery and diagnostic boot tool',         tags:['recuperação','boot','sistema','diagnóstico','técnico','windows'] },
      { name:'Ultimate Boot CD',       url:'https://www.ultimatebootcd.com/',             desc:'Diagnóstico de hardware em ambiente bootável',    desc_en:'Bootable hardware diagnostics environment',          tags:['diagnóstico','hardware','boot','técnico','manutenção'] },
      { name:'CrystalDiskInfo',        url:'https://crystalmark.info/en/software/crystaldiskinfo/', desc:'Saúde e temperatura dos discos rígidos/SSD',desc_en:'HDD/SSD health and temperature monitor',           tags:['disco','ssd','saúde','hardware','diagnóstico','temperatura'] },
      { name:'Sysinternals Suite',     url:'https://learn.microsoft.com/en-us/sysinternals/',desc:'Utilitários avançados oficiais para Windows',  desc_en:'Official advanced Windows system utilities',         tags:['windows','utilitários','sistema','microsoft','técnico','diagnóstico'] },
      { name:'Malwarebytes',           url:'https://www.malwarebytes.com/',               desc:'Limpeza e proteção contra malware',               desc_en:'Malware cleanup and protection tool',                tags:['segurança','antivírus','malware','proteção','vírus','limpeza'] },
      { name:'Sequator',               url:'https://sites.google.com/view/sequator/',     desc:'Alinhamento e empilhamento de fotos de astrofotografia',desc_en:'Astrophotography photo alignment and stacking',  tags:['astrofotografia','astronomia','foto','empilhamento','stars'] },
      { name:'DeepSkyStacker',         url:'http://deepskystacker.free.fr/portuguese/index.html',desc:'Software de astrofotografia de código aberto',desc_en:'Open source astrophotography software',             tags:['astrofotografia','astronomia','foto','software','stars'] },
    ]
  },
  {
    id: 'produtividade', cat: 'Produtividade & Ferramentas', cat_en: 'Productivity & Tools', icon: '⚡',
    links: [
      { name:'Notion',                 url:'https://www.notion.so/',                      desc:'Workspace tudo-em-um: notas, bases de dados, projetos',desc_en:'All-in-one workspace: notes, databases, projects', tags:['notas','gestão','workspace','produtividade','base de dados','organização'] },
      { name:'Trello',                 url:'https://trello.com/',                         desc:'Gestão de projetos em formato Kanban',            desc_en:'Kanban-style project management',                    tags:['kanban','gestão','projetos','tarefas','produtividade','organização'] },
      { name:'Excalidraw',             url:'https://excalidraw.com/',                     desc:'Quadro branco virtual com estilo desenhado à mão', desc_en:'Virtual whiteboard with hand-drawn style',           tags:['quadro','whiteboard','colaboração','desenho','diagramas','wireframe'] },
      { name:'Witeboard',              url:'https://witeboard.com/ce37dd30-ea9f-11ec-a3cf-a1feeb909d7e',desc:'Quadro branco online colaborativo e minimalista',desc_en:'Minimalist collaborative online whiteboard',     tags:['whiteboard','colaboração','desenho','quadro','notas'] },
      { name:'Miro',                   url:'https://miro.com/',                           desc:'Plataforma de colaboração visual para equipas',   desc_en:'Visual collaboration platform for teams',            tags:['colaboração','whiteboard','visual','equipa','reunião','mapas'] },
      { name:'Clockify',               url:'https://clockify.me/',                        desc:'Registo de tempo e timetracking gratuito',        desc_en:'Free time tracking and timesheet tool',              tags:['tempo','timetracking','horas','trabalho','freelancer','produtividade'] },
      { name:'Notesapps.info',         url:'https://notesapps.info/',                     desc:'Comparador de apps de notas',                    desc_en:'Note-taking apps comparison tool',                   tags:['notas','apps','comparação','ferramentas','produtividade'] },
      { name:'DeepL',                  url:'https://www.deepl.com/',                      desc:'Tradução de alta qualidade com IA',               desc_en:'High-quality AI-powered translation',                tags:['tradução','idiomas','texto','línguas','ia','linguagem'] },
      { name:'WolframAlpha',           url:'https://www.wolframalpha.com/',               desc:'Motor de conhecimento computacional',             desc_en:'Computational knowledge engine',                     tags:['matemática','computação','conhecimento','cálculo','ciência','respostas'] },
      { name:'G2',                     url:'https://www.g2.com/',                         desc:'Reviews e comparações de software empresarial',   desc_en:'Enterprise software reviews and comparisons',        tags:['software','reviews','comparação','empresas','saas','ferramentas'] },
      { name:'CloudConvert',           url:'https://cloudconvert.com/',                   desc:'Conversor universal de ficheiros online',         desc_en:'Universal online file converter',                    tags:['conversão','ficheiros','formato','media','pdf','converter'] },
      { name:'TinyWow',                url:'https://tinywow.com/',                        desc:'Edição e conversão de ficheiros gratuita online', desc_en:'Free online file editing and conversion',            tags:['conversão','ficheiros','pdf','imagens','ferramentas','online','grátis'] },
      { name:'PDF Bob',                url:'https://pdfbob.com/',                         desc:'Editor de PDF online simples e gratuito',        desc_en:'Simple free online PDF editor',                      tags:['pdf','editor','documentos','online','edição','grátis'] },
      { name:'Temp-mail',              url:'https://temp-mail.org/',                      desc:'Endereços de email temporários e descartáveis',   desc_en:'Temporary disposable email addresses',               tags:['email','temporário','privacidade','spam','descartável'] },
      { name:'Untools',                url:'https://untools.co/',                         desc:'Estruturas de pensamento e tomada de decisão',    desc_en:'Thinking frameworks and decision-making tools',       tags:['pensamento','estruturas','frameworks','decisão','mental','raciocínio'] },
      { name:'All the Way Leadership', url:'https://www.allthewayleadership.com/',        desc:'Recursos e artigos sobre liderança eficaz',       desc_en:'Leadership resources and articles',                  tags:['liderança','gestão','produtividade','crescimento','carreira'] },
      { name:'Spinbot',                url:'https://spinbot.com/',                        desc:'Parafrasear e reescrever textos automaticamente', desc_en:'Automatic text paraphrasing and rewriting',          tags:['texto','parafrasear','escrita','reescrita','conteúdo'] },
    ]
  },
  {
    id: 'compras', cat: 'E-Commerce & Preços', cat_en: 'Shopping & Prices', icon: '🛒',
    links: [
      { name:'KuantoKusta',            url:'https://www.kuantokusta.pt/',                 desc:'Comparador de preços português',                  desc_en:'Portuguese price comparison site',                   tags:['preços','comparação','compras','portugal','lojas','barato'] },
      { name:'Comparador ZWAME',       url:'https://comparador.zwame.pt/',                desc:'Comparador focado em tecnologia',                 desc_en:'Technology-focused price comparator',                tags:['tecnologia','preços','comparação','compras','gadgets','barato'] },
      { name:'Tropical Price',         url:'https://tropicalprice.com/',                  desc:'Compara preços Amazon em todo o mundo',           desc_en:'Compare Amazon prices worldwide',                    tags:['amazon','preços','comparação','mundial','importação','compras'] },
      { name:'Keepa',                  url:'https://keepa.com/',                          desc:'Histórico de preços e alertas Amazon',            desc_en:'Amazon price history and deal alerts',               tags:['amazon','histórico','preços','alertas','monitorização','compras'] },
    ]
  },
  {
    id: 'comunidade', cat: 'Comunidade & Social', cat_en: 'Community & Social', icon: '👥',
    links: [
      { name:'YouTube',                url:'https://www.youtube.com/',                    desc:'Vídeos, tutoriais e entretenimento',              desc_en:'Videos, tutorials and entertainment',                tags:['vídeo','entretenimento','tutoriais','social','youtube','streaming'] },
      { name:'LinkedIn',               url:'https://www.linkedin.com/',                   desc:'Rede profissional e oportunidades de emprego',    desc_en:'Professional network and job opportunities',          tags:['profissional','emprego','rede','carreira','networking','trabalho'] },
      { name:'Reddit',                 url:'https://www.reddit.com/',                     desc:'Comunidades e discussões sobre qualquer tema',    desc_en:'Communities and discussions on any topic',            tags:['comunidade','fórum','discussão','social','reddit','tópicos'] },
      { name:'Instagram',              url:'https://www.instagram.com/',                  desc:'Fotos, Reels e Stories',                          desc_en:'Photos, Reels and Stories',                          tags:['fotos','social','stories','reels','instagram','imagens'] },
      { name:'Facebook',               url:'https://www.facebook.com/',                   desc:'Rede social para amigos, família e grupos',       desc_en:'Social network for friends, family and groups',       tags:['social','amigos','família','grupos','facebook','comunidade'] },
      { name:'r/portugal',             url:'https://www.reddit.com/r/portugal/',           desc:'Reddit geral sobre Portugal',                    desc_en:'General Reddit community about Portugal',             tags:['portugal','reddit','comunidade','discussão','português'] },
      { name:'r/literaciafinanceira',  url:'https://www.reddit.com/r/literaciafinanceira/',desc:'Finanças pessoais e investimentos em PT',        desc_en:'Personal finance and investments in PT',              tags:['finanças','investimentos','reddit','portugal','poupança','literacia'] },
      { name:'r/devpt',                url:'https://www.reddit.com/r/devpt/',              desc:'Comunidade de programadores portugueses',         desc_en:'Portuguese developers community',                    tags:['programação','ti','dev','portugal','tech','desenvolvimento'] },
      { name:'Fórum ZWAME',             url:'https://forum.zwame.pt/',                     desc:'Maior fórum de tecnologia e comunidade de Portugal',desc_en:'Largest technology forum in Portugal',             tags:['fórum','tecnologia','comunidade','portugal','discussão','zwame','tech'] },
      { name:'r/ajuda',                url:'https://www.reddit.com/r/ajuda/',              desc:'Pedidos de ajuda e suporte geral',               desc_en:'Help requests and general support',                  tags:['ajuda','suporte','reddit','dúvidas','perguntas'] },
      { name:'r/portugalcaralho',      url:'https://www.reddit.com/r/portugalcaralho/',   desc:'Humor e memes sobre Portugal',                   desc_en:'Portuguese humor and memes',                         tags:['humor','portugal','memes','reddit','engraçado'] },
    ]
  },
  {
    id: 'ia', cat: 'Diretórios & IA', cat_en: 'Directories & AI', icon: '🤖',
    links: [
      { name:'Claude',                  url:'https://claude.ai/',                          desc:'Assistente de IA da Anthropic — conversação avançada',desc_en:"Anthropic's AI assistant — advanced conversation",  tags:['ia','chatbot','anthropic','claude','ai','assistente'] },
      { name:'ChatGPT',                url:'https://chat.openai.com/',                    desc:'Chatbot de IA da OpenAI — GPT-4 e mais',         desc_en:"OpenAI's AI chatbot — GPT-4 and more",               tags:['ia','chatbot','openai','gpt','ai','assistente'] },
      { name:'Gemini',                 url:'https://gemini.google.com/',                  desc:'Assistente de IA do Google — integrado com Google',desc_en:"Google's AI assistant — integrated with Google",    tags:['ia','google','chatbot','gemini','ai','assistente'] },
      { name:'AlternativeTo',          url:'https://alternativeto.net/',                  desc:'Encontra alternativas a qualquer software ou app',desc_en:'Find alternatives to any software or app',           tags:['alternativas','software','apps','comparação','open source'] },
      { name:'SimilarSites',           url:'https://www.similarsites.com/',               desc:'Descobre sites similares a qualquer website',    desc_en:'Discover sites similar to any website',              tags:['sites','descoberta','alternativas','web','similar'] },
      { name:'Efficient.app',          url:'https://efficient.app/',                      desc:'Ferramentas curadas para equipas e produtividade',desc_en:'Curated tools for teams and productivity',           tags:['ferramentas','equipa','produtividade','apps','curado'] },
      { name:'Futurepedia',            url:'https://www.futurepedia.io/',                 desc:'Maior diretório de ferramentas de IA atualizado diariamente',desc_en:'Largest daily-updated AI tools directory',    tags:['ia','ferramentas','ai','diretório','tools','lista'] },
      { name:'Productivity.directory', url:'https://productivity.directory/',             desc:'Diretório de recursos de produtividade',         desc_en:'Productivity resources directory',                   tags:['produtividade','ferramentas','apps','diretório','recursos'] },
      { name:'Humanize AI',            url:'https://www.humanizeai.io/',                  desc:'Naturaliza e humaniza texto gerado por IA',      desc_en:'Naturalizes and humanizes AI-generated text',         tags:['ia','texto','escrita','ai','naturalizar','humanizar'] },
      { name:'Aixploria',              url:'https://www.aixploria.com/en/ultimate-list-ai/',desc:'Lista definitiva de ferramentas de Inteligência Artificial',desc_en:'Ultimate list of Artificial Intelligence tools',tags:['ia','ferramentas','ai','lista','inteligência artificial','tools'] },
      { name:'FMHY',                   url:'https://fmhy.net/',                            desc:'Wiki enorme de recursos gratuitos — software, media e ferramentas',desc_en:'Massive wiki of free resources — software, media and tools',tags:['grátis','recursos','software','media','wiki','ferramentas','free','diretório'] },
    ]
  },
  {
    id: 'entretenimento', cat: 'Entretenimento', cat_en: 'Entertainment', icon: '🎬',
    links: [
      { name:'IMDb',                   url:'https://www.imdb.com/',                       desc:'Base de dados de cinema, séries e atores',       desc_en:'Cinema, series and actors database',                 tags:['cinema','filmes','séries','atores','avaliações','imdb','entretenimento'] },
      { name:'MovieWeb',               url:'https://movieweb.com/',                       desc:'Notícias e análises do mundo do cinema',         desc_en:'Movie world news and analysis',                      tags:['cinema','filmes','notícias','entretenimento','hollywood','séries'] },
      { name:'Box Office Mojo',        url:'https://www.boxofficemojo.com/',              desc:'Receitas de bilheteira e rankings de filmes',    desc_en:'Box office revenues and film rankings',              tags:['cinema','bilheteira','receitas','filmes','rankings','box office'] },
      { name:'Spotify',                url:'https://open.spotify.com/browse/featured',    desc:'Música, podcasts e audiobooks em streaming',     desc_en:'Music, podcasts and audiobooks streaming',           tags:['música','podcasts','streaming','spotify','audio','entretenimento'] },
      { name:'9GAG',                   url:'https://9gag.com/',                           desc:'Memes, GIFs e humor da internet',                desc_en:'Internet memes, GIFs and humor',                     tags:['humor','memes','gifs','viral','entretenimento','internet'] },
      { name:'Ainanas',                url:'http://ainanas.com/',                          desc:'Humor e entretenimento português',               desc_en:'Portuguese humor and entertainment',                 tags:['humor','portugal','entretenimento','viral','engraçado'] },
      { name:'Tabonito',               url:'http://www.tabonito.com/',                    desc:'Imagens e conteúdo engraçado',                   desc_en:'Funny images and entertaining content',              tags:['humor','imagens','entretenimento','viral','engraçado'] },
      { name:'Tafixe',                 url:'http://www.tafixe.com/',                      desc:'Vídeos e humor português',                       desc_en:'Portuguese videos and humor',                        tags:['humor','vídeos','portugal','entretenimento','engraçado'] },
    ]
  },
  {
    id: 'design', cat: 'Design & Criatividade', cat_en: 'Design & Creativity', icon: '🎨',
    links: [
      { name:'Canva',                  url:'https://www.canva.com/',                      desc:'Design gráfico online — apresentações, redes sociais e mais',desc_en:'Online graphic design — presentations, social media and more',tags:['design','gráfico','apresentações','redes sociais','criatividade','templates'] },
      { name:'Pixlr E',                url:'https://pixlr.com/e/',                        desc:'Editor de imagem profissional no browser',        desc_en:'Professional browser-based image editor',            tags:['imagens','edição','foto','design','photoshop','online'] },
      { name:'Adobe Firefly',          url:'https://www.adobe.com/products/firefly.html', desc:'Geração de imagens com IA da Adobe',              desc_en:'Adobe AI image generation tool',                     tags:['ia','adobe','imagens','geração','criatividade','ai','design'] },
      { name:'Upscale Media',          url:'https://www.upscale.media/pt',                desc:'Aumenta a resolução de imagens com IA',           desc_en:'AI-powered image resolution upscaler',               tags:['imagens','upscale','ia','qualidade','resolução','ai'] },
      { name:'RapidDraw',              url:'https://www.getrapidraw.com/',                desc:'Ferramenta de desenho rápido e colaborativo online',desc_en:'Fast online collaborative drawing tool',            tags:['desenho','colaboração','whiteboard','criatividade','online'] },
      { name:'Excalidraw',             url:'https://excalidraw.com/',                     desc:'Diagramas e wireframes com estilo desenhado à mão', desc_en:'Hand-drawn style diagrams and wireframes',           tags:['diagramas','wireframe','desenho','colaboração','whiteboard'] },
    ]
  },
];
