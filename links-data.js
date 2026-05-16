const LINKS_DATA = [
  {
    id: 'noticias', cat: 'Informação & Atualidade', icon: '📰',
    links: [
      { name:'Jornal de Notícias',     url:'https://www.jn.pt/',                         desc:'Notícias nacionais e foco regional',              tags:['notícias','jornais','portugal','nacional','regional','atualidade'] },
      { name:'Expresso',               url:'https://expresso.pt/',                        desc:'Jornalismo de referência e análise aprofundada',  tags:['notícias','jornais','análise','política','portugal'] },
      { name:'Diário de Notícias',     url:'https://www.dn.pt/',                          desc:'Título histórico da imprensa portuguesa',         tags:['notícias','jornais','história','portugal','atualidade'] },
      { name:'Notícias ao Minuto',     url:'https://www.noticiasaominuto.com/',           desc:'Atualidade em tempo real, breaking news',         tags:['notícias','tempo real','breaking','atualidade','rápido'] },
      { name:'Polígrafo',              url:'https://poligrafo.sapo.pt/',                  desc:'Verificação de factos em Portugal',               tags:['fact-check','verificação','factos','verdade','portugal'] },
      { name:'Observador Fact Check',  url:'https://observador.pt/seccao/fact-check/',    desc:'Análise de veracidade de temas correntes',        tags:['fact-check','verificação','observador','factos'] },
      { name:'Google Notícias',        url:'https://news.google.com/',                    desc:'Agregador de notícias globais em tempo real',     tags:['notícias','google','atualidade','mundo','internacional'] },
      { name:'Aquela Máquina',         url:'https://www.aquelamaquina.pt/',               desc:'Notícias do setor automóvel português',           tags:['automóvel','carros','motor','auto','lifestyle'] },
      { name:'Razão Automóvel',        url:'https://www.razaoautomovel.com/',             desc:'Ensaios e cultura automóvel',                     tags:['automóvel','carros','ensaios','motor','testes'] },
      { name:'Portugal Dir.',          url:'https://portugaldir.com/',                    desc:'Diretório de sites e serviços portugueses',       tags:['portugal','diretório','sites','serviços'] },
    ]
  },
  {
    id: 'financas', cat: 'Finanças & Poupança', icon: '💰',
    links: [
      { name:'Preços Combustíveis',     url:'https://precoscombustiveis.dgeg.gov.pt/',     desc:'Preços dos combustíveis em Portugal (DGEG)',      tags:['combustível','gasolina','gasóleo','preços','dgeg','portaria','portugal'] },
      { name:'Doutor Finanças',        url:'https://www.doutorfinancas.pt/',              desc:'Saúde financeira, crédito e habitação',           tags:['finanças','crédito','habitação','seguros','poupança','dinheiro'] },
      { name:'Contas Poupança',        url:'https://contaspoupanca.pt/',                  desc:'Dicas de poupança por Pedro Andersson',           tags:['poupança','finanças','dicas','investimento','dinheiro'] },
      { name:'E-Konomista',            url:'https://ekonomista.pt/',                      desc:'Guia prático de economia e direitos do consumidor',tags:['economia','direitos','consumidor','finanças','prático'] },
      { name:'MoneyLab',               url:'https://moneylab.pt/',                        desc:'Educação financeira e investimentos pessoais',    tags:['finanças','investimentos','educação','dinheiro'] },
      { name:'Tiago Felícia',          url:'https://www.tiagofelicia.pt/',                desc:'Literacia financeira e estratégias de investimento',tags:['literacia','finanças','investimentos','educação'] },
    ]
  },
  {
    id: 'habitacao', cat: 'Habitação & Bricolage', icon: '🏠',
    links: [
      { name:'Fórum da Casa',          url:'https://www.forumdacasa.com/',                desc:'Maior comunidade de construção e obras em Portugal',tags:['construção','obras','habitação','diy','casa','comunidade','bricolage'] },
      { name:'r/TudoCasa',             url:'https://www.reddit.com/r/TudoCasa/',          desc:'Comunidade Reddit sobre casa, obras e decoração em PT', tags:['casa','reddit','comunidade','obras','decoração','diy','portugal'] },
    ]
  },
  {
    id: 'tech', cat: 'Tecnologia & Digital', icon: '💻',
    links: [
      { name:'Pplware',                url:'https://pplware.sapo.pt/',                    desc:'Software, apps e notícias digitais',              tags:['tecnologia','software','apps','digital','tech','sapo'] },
      { name:'4gnews',                 url:'https://www.4gnews.pt/',                      desc:'Tecnologia de consumo e gadgets',                 tags:['tecnologia','gadgets','smartphones','tech','consumer'] },
      { name:'The New Stack',          url:'https://thenewstack.io/',                     desc:'Notícias e análises sobre cloud, DevOps e IA',    tags:['cloud','devops','ia','kubernetes','tech','desenvolvimento'] },
      { name:'Lifehacker',             url:'https://lifehacker.com/',                     desc:'Dicas de eficiência tecnológica e produtividade', tags:['produtividade','tecnologia','dicas','eficiência','lifehacks'] },
      { name:'Aberto até de Madrugada',url:'https://abertoatedemadrugada.com/',           desc:'Gadgets e domótica — tecnologia inteligente',    tags:['gadgets','domótica','smart home','tecnologia','iot'] },
      { name:'Android Police',         url:'https://www.androidpolice.com/',              desc:'Notícias e análises sobre Android',               tags:['android','tech','smartphone','google','apps'] },
      { name:'Android Authority',      url:'https://www.androidauthority.com/',           desc:'Reviews e notícias do ecossistema Android',      tags:['android','tech','reviews','smartphones','apps'] },
      { name:'Android Geek',           url:'https://androidgeek.pt/',                     desc:'Android em português — apps, dicas e tutoriais', tags:['android','tech','portugal','apps','smartphones'] },
      { name:'XDA Forums',             url:'https://xdaforums.com/watched/threads',       desc:'Comunidade de desenvolvedores e modding Android', tags:['android','xda','modding','root','desenvolvimento','fórum'] },
      { name:'HirensBootCD',           url:'https://www.hirensbootcd.org/',               desc:'Ferramenta de recuperação e diagnóstico de sistemas',tags:['recuperação','boot','sistema','diagnóstico','técnico','windows'] },
      { name:'Ultimate Boot CD',       url:'https://www.ultimatebootcd.com/',             desc:'Diagnóstico de hardware em ambiente bootável',    tags:['diagnóstico','hardware','boot','técnico','manutenção'] },
      { name:'CrystalDiskInfo',        url:'https://crystalmark.info/en/software/crystaldiskinfo/', desc:'Saúde e temperatura dos discos rígidos/SSD',tags:['disco','ssd','saúde','hardware','diagnóstico','temperatura'] },
      { name:'Sysinternals Suite',     url:'https://learn.microsoft.com/en-us/sysinternals/',desc:'Utilitários avançados oficiais para Windows',  tags:['windows','utilitários','sistema','microsoft','técnico','diagnóstico'] },
      { name:'Malwarebytes',           url:'https://www.malwarebytes.com/',               desc:'Limpeza e proteção contra malware',               tags:['segurança','antivírus','malware','proteção','vírus','limpeza'] },
      { name:'Sequator',               url:'https://sites.google.com/view/sequator/',     desc:'Alinhamento e empilhamento de fotos de astrofotografia',tags:['astrofotografia','astronomia','foto','empilhamento','stars'] },
      { name:'DeepSkyStacker',         url:'http://deepskystacker.free.fr/portuguese/index.html',desc:'Software de astrofotografia de código aberto',tags:['astrofotografia','astronomia','foto','software','stars'] },
    ]
  },
  {
    id: 'produtividade', cat: 'Produtividade & Ferramentas', icon: '⚡',
    links: [
      { name:'Notion',                 url:'https://www.notion.so/',                      desc:'Workspace tudo-em-um: notas, bases de dados, projetos',tags:['notas','gestão','workspace','produtividade','base de dados','organização'] },
      { name:'Trello',                 url:'https://trello.com/',                         desc:'Gestão de projetos em formato Kanban',            tags:['kanban','gestão','projetos','tarefas','produtividade','organização'] },
      { name:'Excalidraw',             url:'https://excalidraw.com/',                     desc:'Quadro branco virtual com estilo desenhado à mão', tags:['quadro','whiteboard','colaboração','desenho','diagramas','wireframe'] },
      { name:'Witeboard',              url:'https://witeboard.com/ce37dd30-ea9f-11ec-a3cf-a1feeb909d7e',desc:'Quadro branco online colaborativo e minimalista',tags:['whiteboard','colaboração','desenho','quadro','notas'] },
      { name:'Miro',                   url:'https://miro.com/',                           desc:'Plataforma de colaboração visual para equipas',   tags:['colaboração','whiteboard','visual','equipa','reunião','mapas'] },
      { name:'Clockify',               url:'https://clockify.me/',                        desc:'Registo de tempo e timetracking gratuito',        tags:['tempo','timetracking','horas','trabalho','freelancer','produtividade'] },
      { name:'Notesapps.info',         url:'https://notesapps.info/',                     desc:'Comparador de apps de notas',                    tags:['notas','apps','comparação','ferramentas','produtividade'] },
      { name:'DeepL',                  url:'https://www.deepl.com/',                      desc:'Tradução de alta qualidade com IA',               tags:['tradução','idiomas','texto','línguas','ia','linguagem'] },
      { name:'WolframAlpha',           url:'https://www.wolframalpha.com/',               desc:'Motor de conhecimento computacional',             tags:['matemática','computação','conhecimento','cálculo','ciência','respostas'] },
      { name:'G2',                     url:'https://www.g2.com/',                         desc:'Reviews e comparações de software empresarial',   tags:['software','reviews','comparação','empresas','saas','ferramentas'] },
      { name:'CloudConvert',           url:'https://cloudconvert.com/',                   desc:'Conversor universal de ficheiros online',         tags:['conversão','ficheiros','formato','media','pdf','converter'] },
      { name:'TinyWow',                url:'https://tinywow.com/',                        desc:'Edição e conversão de ficheiros gratuita online', tags:['conversão','ficheiros','pdf','imagens','ferramentas','online','grátis'] },
      { name:'PDF Bob',                url:'https://pdfbob.com/',                         desc:'Editor de PDF online simples e gratuito',        tags:['pdf','editor','documentos','online','edição','grátis'] },
      { name:'Temp-mail',              url:'https://temp-mail.org/',                      desc:'Endereços de email temporários e descartáveis',   tags:['email','temporário','privacidade','spam','descartável'] },
      { name:'Untools',                url:'https://untools.co/',                         desc:'Estruturas de pensamento e tomada de decisão',    tags:['pensamento','estruturas','frameworks','decisão','mental','raciocínio'] },
      { name:'All the Way Leadership', url:'https://www.allthewayleadership.com/',        desc:'Recursos e artigos sobre liderança eficaz',       tags:['liderança','gestão','produtividade','crescimento','carreira'] },
      { name:'Spinbot',                url:'https://spinbot.com/',                        desc:'Parafrasear e reescrever textos automaticamente', tags:['texto','parafrasear','escrita','reescrita','conteúdo'] },
    ]
  },
  {
    id: 'compras', cat: 'E-Commerce & Preços', icon: '🛒',
    links: [
      { name:'KuantoKusta',            url:'https://www.kuantokusta.pt/',                 desc:'Comparador de preços português',                  tags:['preços','comparação','compras','portugal','lojas','barato'] },
      { name:'Comparador ZWAME',       url:'https://comparador.zwame.pt/',                desc:'Comparador focado em tecnologia',                 tags:['tecnologia','preços','comparação','compras','gadgets','barato'] },
      { name:'Tropical Price',         url:'https://tropicalprice.com/',                  desc:'Compara preços Amazon em todo o mundo',           tags:['amazon','preços','comparação','mundial','importação','compras'] },
      { name:'Keepa',                  url:'https://keepa.com/',                          desc:'Histórico de preços e alertas Amazon',            tags:['amazon','histórico','preços','alertas','monitorização','compras'] },
    ]
  },
  {
    id: 'comunidade', cat: 'Comunidade & Social', icon: '👥',
    links: [
      { name:'YouTube',                url:'https://www.youtube.com/',                    desc:'Vídeos, tutoriais e entretenimento',              tags:['vídeo','entretenimento','tutoriais','social','youtube','streaming'] },
      { name:'LinkedIn',               url:'https://www.linkedin.com/',                   desc:'Rede profissional e oportunidades de emprego',    tags:['profissional','emprego','rede','carreira','networking','trabalho'] },
      { name:'Reddit',                 url:'https://www.reddit.com/',                     desc:'Comunidades e discussões sobre qualquer tema',    tags:['comunidade','fórum','discussão','social','reddit','tópicos'] },
      { name:'Instagram',              url:'https://www.instagram.com/',                  desc:'Fotos, Reels e Stories',                          tags:['fotos','social','stories','reels','instagram','imagens'] },
      { name:'Facebook',               url:'https://www.facebook.com/',                   desc:'Rede social para amigos, família e grupos',       tags:['social','amigos','família','grupos','facebook','comunidade'] },
      { name:'r/portugal',             url:'https://www.reddit.com/r/portugal/',           desc:'Reddit geral sobre Portugal',                    tags:['portugal','reddit','comunidade','discussão','português'] },
      { name:'r/literaciafinanceira',  url:'https://www.reddit.com/r/literaciafinanceira/',desc:'Finanças pessoais e investimentos em PT',        tags:['finanças','investimentos','reddit','portugal','poupança','literacia'] },
      { name:'r/devpt',                url:'https://www.reddit.com/r/devpt/',              desc:'Comunidade de programadores portugueses',         tags:['programação','ti','dev','portugal','tech','desenvolvimento'] },
      { name:'Fórum ZWAME',             url:'https://forum.zwame.pt/',                     desc:'Maior fórum de tecnologia e comunidade de Portugal',tags:['fórum','tecnologia','comunidade','portugal','discussão','zwame','tech'] },
      { name:'r/ajuda',                url:'https://www.reddit.com/r/ajuda/',              desc:'Pedidos de ajuda e suporte geral',               tags:['ajuda','suporte','reddit','dúvidas','perguntas'] },
      { name:'r/portugalcaralho',      url:'https://www.reddit.com/r/portugalcaralho/',   desc:'Humor e memes sobre Portugal',                   tags:['humor','portugal','memes','reddit','engraçado'] },
    ]
  },
  {
    id: 'ia', cat: 'Diretórios & IA', icon: '🤖',
    links: [
      { name:'Claude',                  url:'https://claude.ai/',                          desc:'Assistente de IA da Anthropic — conversação avançada',tags:['ia','chatbot','anthropic','claude','ai','assistente'] },
      { name:'ChatGPT',                url:'https://chat.openai.com/',                    desc:'Chatbot de IA da OpenAI — GPT-4 e mais',         tags:['ia','chatbot','openai','gpt','ai','assistente'] },
      { name:'Gemini',                 url:'https://gemini.google.com/',                  desc:'Assistente de IA do Google — integrado com Google',tags:['ia','google','chatbot','gemini','ai','assistente'] },
      { name:'AlternativeTo',          url:'https://alternativeto.net/',                  desc:'Encontra alternativas a qualquer software ou app',tags:['alternativas','software','apps','comparação','open source'] },
      { name:'SimilarSites',           url:'https://www.similarsites.com/',               desc:'Descobre sites similares a qualquer website',    tags:['sites','descoberta','alternativas','web','similar'] },
      { name:'Efficient.app',          url:'https://efficient.app/',                      desc:'Ferramentas curadas para equipas e produtividade',tags:['ferramentas','equipa','produtividade','apps','curado'] },
      { name:'Futurepedia',            url:'https://www.futurepedia.io/',                 desc:'Maior diretório de ferramentas de IA atualizado diariamente',tags:['ia','ferramentas','ai','diretório','tools','lista'] },
      { name:'Productivity.directory', url:'https://productivity.directory/',             desc:'Diretório de recursos de produtividade',         tags:['produtividade','ferramentas','apps','diretório','recursos'] },
      { name:'Humanize AI',            url:'https://www.humanizeai.io/',                  desc:'Naturaliza e humaniza texto gerado por IA',      tags:['ia','texto','escrita','ai','naturalizar','humanizar'] },
      { name:'Aixploria',              url:'https://www.aixploria.com/en/ultimate-list-ai/',desc:'Lista definitiva de ferramentas de Inteligência Artificial',tags:['ia','ferramentas','ai','lista','inteligência artificial','tools'] },
    ]
  },
  {
    id: 'entretenimento', cat: 'Entretenimento', icon: '🎬',
    links: [
      { name:'IMDb',                   url:'https://www.imdb.com/',                       desc:'Base de dados de cinema, séries e atores',       tags:['cinema','filmes','séries','atores','avaliações','imdb','entretenimento'] },
      { name:'MovieWeb',               url:'https://movieweb.com/',                       desc:'Notícias e análises do mundo do cinema',         tags:['cinema','filmes','notícias','entretenimento','hollywood','séries'] },
      { name:'Box Office Mojo',        url:'https://www.boxofficemojo.com/',              desc:'Receitas de bilheteira e rankings de filmes',    tags:['cinema','bilheteira','receitas','filmes','rankings','box office'] },
      { name:'Spotify',                url:'https://open.spotify.com/browse/featured',    desc:'Música, podcasts e audiobooks em streaming',     tags:['música','podcasts','streaming','spotify','audio','entretenimento'] },
      { name:'9GAG',                   url:'https://9gag.com/',                           desc:'Memes, GIFs e humor da internet',                tags:['humor','memes','gifs','viral','entretenimento','internet'] },
      { name:'Ainanas',                url:'http://ainanas.com/',                          desc:'Humor e entretenimento português',               tags:['humor','portugal','entretenimento','viral','engraçado'] },
      { name:'Tabonito',               url:'http://www.tabonito.com/',                    desc:'Imagens e conteúdo engraçado',                   tags:['humor','imagens','entretenimento','viral','engraçado'] },
      { name:'Tafixe',                 url:'http://www.tafixe.com/',                      desc:'Vídeos e humor português',                       tags:['humor','vídeos','portugal','entretenimento','engraçado'] },
    ]
  },
  {
    id: 'design', cat: 'Design & Criatividade', icon: '🎨',
    links: [
      { name:'Canva',                  url:'https://www.canva.com/',                      desc:'Design gráfico online — apresentações, redes sociais e mais',tags:['design','gráfico','apresentações','redes sociais','criatividade','templates'] },
      { name:'Pixlr E',                url:'https://pixlr.com/e/',                        desc:'Editor de imagem profissional no browser',        tags:['imagens','edição','foto','design','photoshop','online'] },
      { name:'Adobe Firefly',          url:'https://www.adobe.com/products/firefly.html', desc:'Geração de imagens com IA da Adobe',              tags:['ia','adobe','imagens','geração','criatividade','ai','design'] },
      { name:'Upscale Media',          url:'https://www.upscale.media/pt',                desc:'Aumenta a resolução de imagens com IA',           tags:['imagens','upscale','ia','qualidade','resolução','ai'] },
      { name:'RapidDraw',              url:'https://www.getrapidraw.com/',                desc:'Ferramenta de desenho rápido e colaborativo online',tags:['desenho','colaboração','whiteboard','criatividade','online'] },
      { name:'Excalidraw',             url:'https://excalidraw.com/',                     desc:'Diagramas e wireframes com estilo desenhado à mão', tags:['diagramas','wireframe','desenho','colaboração','whiteboard'] },
    ]
  },
];
