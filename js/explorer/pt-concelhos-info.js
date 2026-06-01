/* ══════════════════════════════════════════════════════════════════
   CURATED CONCELHO INFO — bundled locally (no runtime API calls).
   Hand-authored, high-confidence cultural data for the district capitals
   and the most notable municipalities. Concelhos not listed here fall
   back to official CAOP stats + a Wikipedia link in the Portugal explorer.

   Keys are the concelho name normalised: lower-case, no accents, single
   spaces (matches PortugalExplorer._normalizeStr). Fields:
     poi  — pontos de interesse / monumentos
     hist — short history (1–2 sentences, European Portuguese)
     food — gastronomia típica
     trad — tradições / festas
══════════════════════════════════════════════════════════════════ */
const PT_CONCELHO_INFO = (function () {
  'use strict';

  const DATA = {
    /* ── Capitais de distrito ── */
    'aveiro': {
      poi: ['Ria de Aveiro', 'Canais e moliceiros', 'Sé de Aveiro', 'Museu de Aveiro (Santa Joana)', 'Costa Nova'],
      hist: 'Cidade ribeirinha marcada pela Ria e pela tradição do sal e da pesca do bacalhau. A foz aberta no século XIX revitalizou o porto e a indústria.',
      food: ['Ovos moles de Aveiro (IGP)', 'Enguias da Ria', 'Caldeirada de enguias'],
      trad: ['Festa de São Gonçalinho', 'Passeios de moliceiro'],
    },
    'beja': {
      poi: ['Castelo de Beja (Torre de Menagem)', 'Convento da Conceição', 'Sé de Beja'],
      hist: 'Fundada pelos romanos como Pax Julia, foi importante centro da Lusitânia. Domina a paisagem cerealífera do Baixo Alentejo.',
      food: ['Ensopado de borrego', 'Migas alentejanas', 'Queijo de ovelha'],
      trad: ['Cante alentejano (UNESCO)', 'Ovibeja (feira)'],
    },
    'braga': {
      poi: ['Sé de Braga', 'Bom Jesus do Monte', 'Santuário do Sameiro', 'Termas Romanas'],
      hist: 'Uma das cidades mais antigas da Península, fundada como Bracara Augusta. Centro religioso de Portugal e sede arquiepiscopal.',
      food: ['Rojões à minhota', 'Bacalhau à Braga', 'Pudim Abade de Priscos'],
      trad: ['Semana Santa (a mais antiga do país)', 'Festas de São João'],
    },
    'braganca': {
      poi: ['Castelo de Bragança', 'Domus Municipalis', 'Cidadela Medieval', 'Museu do Abade de Baçal'],
      hist: 'Berço da Casa de Bragança, dinastia que reinou em Portugal de 1640 a 1910. Preserva uma das cidadelas medievais mais bem conservadas do país.',
      food: ['Posta à mirandesa', 'Alheira', 'Butelo com casulas'],
      trad: ['Festa dos Rapazes', 'Caretos (máscaras)'],
    },
    'castelo branco': {
      poi: ['Jardim do Paço Episcopal', 'Castelo dos Templários', 'Museu Francisco Tavares Proença Júnior'],
      hist: 'Importante praça militar na fronteira da Beira. Famosa pelos bordados de Castelo Branco, tradição secular em seda sobre linho.',
      food: ['Queijo da Beira Baixa', 'Maranhos', 'Borrego assado'],
      trad: ['Bordados de Castelo Branco', 'Festa da Cidade (Maio)'],
    },
    'coimbra': {
      poi: ['Universidade de Coimbra (UNESCO)', 'Biblioteca Joanina', 'Sé Velha', 'Mosteiro de Santa Cruz', 'Portugal dos Pequenitos'],
      hist: 'Antiga capital do reino e sede de uma das universidades mais antigas do mundo (1290). Cidade do saber e do Fado de Coimbra.',
      food: ['Chanfana', 'Leitão da Bairrada', 'Pastéis de Santa Clara'],
      trad: ['Queima das Fitas', 'Fado de Coimbra', 'Serenata Monumental'],
    },
    'evora': {
      poi: ['Templo Romano (de Diana)', 'Sé de Évora', 'Capela dos Ossos', 'Universidade de Évora'],
      hist: 'Cidade-museu classificada Património Mundial (UNESCO). Reúne uma das mais ricas coleções de monumentos da Antiguidade em Portugal.',
      food: ['Açorda alentejana', 'Sopa de cação', 'Queijo de Évora (DOP)'],
      trad: ['Cante alentejano', 'Feira de São João'],
    },
    'faro': {
      poi: ['Cidade Velha (Arco da Vila)', 'Sé de Faro', 'Ria Formosa', 'Praia de Faro'],
      hist: 'Capital do Algarve, foi última cidade reconquistada aos mouros (1249). Marcada pela laguna da Ria Formosa.',
      food: ['Cataplana de marisco', 'Xerém com conquilhas', 'Doces de amêndoa'],
      trad: ['Festas da cidade', 'Folia algarvia'],
    },
    'guarda': {
      poi: ['Sé da Guarda', 'Torre de Menagem', 'Judiaria', 'Serra da Estrela (perto)'],
      hist: 'A cidade mais alta de Portugal (1056 m), fundada por D. Sancho I em 1199 como defesa contra Castela. Conhecida pelos "F": Forte, Fria, Farta, Fiel.',
      food: ['Queijo Serra da Estrela (DOP)', 'Bucho recheado', 'Sopa de castanhas'],
      trad: ['Festas da Cidade (Novembro)', 'Feira Farta'],
    },
    'leiria': {
      poi: ['Castelo de Leiria', 'Pinhal de Leiria', 'Santuário de Fátima (perto)'],
      hist: 'Cidade do castelo edificado por Afonso Henriques. O Pinhal de Leiria foi mandado plantar por D. Dinis no século XIII para travar as areias.',
      food: ['Morcela de Leiria', 'Brisas do Lis', 'Lampreia do Lis'],
      trad: ['Feira de Maio', 'Mercado medieval'],
    },
    'lisboa': {
      poi: ['Torre de Belém', 'Mosteiro dos Jerónimos', 'Castelo de São Jorge', 'Alfama', 'Praça do Comércio'],
      hist: 'Capital de Portugal e uma das mais antigas cidades da Europa. Centro do comércio das especiarias no século XVI, reconstruída pelo Marquês de Pombal após o terramoto de 1755.',
      food: ['Pastéis de Belém', 'Bacalhau à Brás', 'Sardinha assada', 'Caldo verde'],
      trad: ['Santos Populares (Santo António)', 'Fado de Lisboa'],
    },
    'portalegre': {
      poi: ['Sé de Portalegre', 'Castelo', 'Museu da Tapeçaria Guy Fino'],
      hist: 'Antigo centro têxtil do Alto Alentejo. A sua Manufactura de Tapeçarias, fundada em 1947, é mundialmente reconhecida.',
      food: ['Sopa de cação', 'Migas', 'Queijo de ovelha'],
      trad: ['Tapeçaria de Portalegre', 'Festas da cidade'],
    },
    'porto': {
      poi: ['Ribeira (UNESCO)', 'Torre dos Clérigos', 'Livraria Lello', 'Ponte Luís I', 'Palácio da Bolsa'],
      hist: 'Segunda cidade do país, deu nome a Portugal (Portus Cale). Cidade Invicta, ligada ao comércio do Vinho do Porto exportado desde o século XVII.',
      food: ['Francesinha', 'Tripas à moda do Porto', 'Bacalhau à Gomes de Sá'],
      trad: ['Festa de São João do Porto', 'Regata de barcos rabelos'],
    },
    'santarem': {
      poi: ['Portas do Sol', 'Igreja da Graça', 'Igreja de São João de Alporão'],
      hist: 'Conquistada por Afonso Henriques em 1147, é a "Capital do Gótico" pela abundância de monumentos. Coração do Ribatejo e da cultura tauromáquica.',
      food: ['Sopa da pedra', 'Fataça na telha', 'Celestes de Santarém'],
      trad: ['Feira Nacional de Agricultura', 'Festival Nacional de Gastronomia'],
    },
    'setubal': {
      poi: ['Convento de Jesus', 'Forte de São Filipe', 'Serra da Arrábida', 'Estuário do Sado'],
      hist: 'Importante porto pesqueiro e centro conserveiro. O estuário do Sado abriga uma população residente de golfinhos-roazes.',
      food: ['Choco frito', 'Moscatel de Setúbal (DOP)', 'Ostras do Sado'],
      trad: ['Festas de São Luís', 'Procissão do Senhor Jesus'],
    },
    'viana do castelo': {
      poi: ['Santuário de Santa Luzia', 'Castelo de Santiago da Barra', 'Praça da República', 'Navio-Museu Gil Eannes'],
      hist: 'Próspero porto de comércio com o Brasil e a pesca do bacalhau. Famosa pelo traje à vianesa e pela ourivesaria em filigrana.',
      food: ['Bacalhau à Zé do Pipo', 'Sarrabulho', 'Bolas de Berlim'],
      trad: ['Festas de Nossa Senhora da Agonia (Agosto)', 'Trajes e ouro'],
    },
    'vila real': {
      poi: ['Solar de Mateus (Casa de Mateus)', 'Santuário de Panóias', 'Capela Nova'],
      hist: 'Porta de entrada do Douro e de Trás-os-Montes. O Solar de Mateus, barroco, ficou imortalizado no rótulo do Mateus Rosé.',
      food: ['Covilhetes de Vila Real', 'Pitos de Santa Luzia', 'Cristas de galo'],
      trad: ['Feira de São Pedro', 'Louça preta de Bisalhães (UNESCO)'],
    },
    'viseu': {
      poi: ['Sé de Viseu', 'Museu Grão Vasco', 'Cava de Viriato', 'Centro Histórico'],
      hist: 'Cidade-jardim no coração da Beira Alta, terra do pintor renascentista Grão Vasco e do vinho do Dão.',
      food: ['Vinho do Dão (DOC)', 'Rancho à moda de Viseu', 'Castanha'],
      trad: ['Feira de São Mateus (a maior do interior)', 'Cabra-cega'],
    },
    'funchal': {
      poi: ['Sé do Funchal', 'Mercado dos Lavradores', 'Monte (teleférico e carros de cesto)', 'Forte de São Tiago'],
      hist: 'Capital da Madeira, fundada no século XV no início da Expansão Portuguesa. Foi entreposto do açúcar e berço do Vinho Madeira.',
      food: ['Espada com banana', 'Espetada em pau de loureiro', 'Bolo de mel', 'Poncha'],
      trad: ['Festa da Flor', 'Réveillon do Funchal (Guinness)'],
    },
    'ponta delgada': {
      poi: ['Portas da Cidade', 'Forte de São Brás', 'Convento de São Francisco', 'Lagoa das Sete Cidades (perto)'],
      hist: 'Maior cidade dos Açores, na ilha de São Miguel. Cresceu com o comércio do trigo, do pastel e da laranja para a Europa.',
      food: ['Cozido das Furnas', 'Ananás dos Açores', 'Queijadas da Vila'],
      trad: ['Festas do Senhor Santo Cristo dos Milagres', 'Festas do Espírito Santo'],
    },

    /* ── Concelhos notáveis ── */
    'sintra': {
      poi: ['Palácio da Pena', 'Palácio Nacional de Sintra', 'Quinta da Regaleira', 'Castelo dos Mouros', 'Cabo da Roca'],
      hist: 'Paisagem Cultural classificada Património Mundial (UNESCO). Refúgio romântico da realeza, descrita por Lord Byron como "Éden glorioso".',
      food: ['Queijadas de Sintra', 'Travesseiros de Sintra'],
      trad: ['Festas de São Pedro', 'Feira de Sintra'],
    },
    'cascais': {
      poi: ['Baía e Marina de Cascais', 'Boca do Inferno', 'Praia do Guincho', 'Cabo Raso', 'Casa das Histórias Paula Rego'],
      hist: 'Antiga vila piscatória que se tornou estância da corte no final do século XIX, quando a família real ali passava o verão.',
      food: ['Peixe e marisco fresco', 'Areias de Cascais'],
      trad: ['Festas do Mar', 'Estoril Open (ténis)'],
    },
    'obidos': {
      poi: ['Castelo de Óbidos', 'Muralhas medievais', 'Igreja de Santa Maria', 'Vila intramuros'],
      hist: 'Vila medieval oferecida como presente de casamento a rainhas de Portugal durante séculos (a "Vila das Rainhas").',
      food: ['Ginjinha de Óbidos (em copo de chocolate)', 'Trouxas de ovos'],
      trad: ['Mercado Medieval', 'Festival do Chocolate', 'Óbidos Vila Natal'],
    },
    'nazare': {
      poi: ['Praia da Nazaré', 'Sítio (funicular)', 'Forte de São Miguel Arcanjo (ondas gigantes)', 'Farol da Nazaré'],
      hist: 'Vila piscatória famosa pelas ondas gigantes da Praia do Norte (recordes mundiais de surf) e pelas tradições das varinas.',
      food: ['Caldeirada de peixe', 'Peixe seco ao sol', 'Sardinha'],
      trad: ['Os sete saiotes', 'Romaria de Nossa Senhora da Nazaré'],
    },
    'ourem': {
      poi: ['Santuário de Fátima', 'Castelo de Ourém', 'Vila Medieval de Ourém'],
      hist: 'Concelho do Santuário de Fátima, um dos maiores centros de peregrinação mariana do mundo, com origem nas aparições de 1917.',
      food: ['Bolo finto', 'Queijo fresco'],
      trad: ['Peregrinações de 13 de Maio e 13 de Outubro'],
    },
    'tomar': {
      poi: ['Convento de Cristo (UNESCO)', 'Castelo Templário', 'Aqueduto dos Pegões', 'Mata dos Sete Montes'],
      hist: 'Cidade-sede da Ordem dos Templários e depois da Ordem de Cristo. O Convento de Cristo é um dos mais notáveis monumentos do país.',
      food: ['Fatias de Tomar', 'Beija-me depressa'],
      trad: ['Festa dos Tabuleiros (de 4 em 4 anos)'],
    },
    'alcobaca': {
      poi: ['Mosteiro de Alcobaça (UNESCO)', 'Túmulos de D. Pedro e D. Inês'],
      hist: 'Cidade nascida em torno do Mosteiro cisterciense fundado em 1153 por Afonso Henriques, obra-prima do gótico onde repousam Pedro e Inês.',
      food: ['Doces conventuais', 'Pão de ló de Alfeizerão', 'Vinho de Alcobaça'],
      trad: ['Mostra Internacional de Doces e Licores Conventuais'],
    },
    'batalha': {
      poi: ['Mosteiro da Batalha (UNESCO)', 'Capelas Imperfeitas', 'Grutas da Moeda (perto)'],
      hist: 'Vila do Mosteiro de Santa Maria da Vitória, mandado erguer por D. João I para celebrar a vitória de Aljubarrota (1385).',
      food: ['Bolo da Batalha', 'Morcela de arroz'],
      trad: ['Recriação da Batalha de Aljubarrota'],
    },
    'guimaraes': {
      poi: ['Castelo de Guimarães', 'Paço dos Duques de Bragança', 'Centro Histórico (UNESCO)', 'Penha (teleférico)'],
      hist: '"Cidade Berço" de Portugal, onde nasceu D. Afonso Henriques e se formou o reino. O letreiro "Aqui Nasceu Portugal" é o seu emblema.',
      food: ['Rojões à minhota', 'Tortas de Guimarães', 'Toucinho do céu'],
      trad: ['Festas Gualterianas', 'Festas Nicolinas'],
    },
    'vila nova de gaia': {
      poi: ['Caves do Vinho do Porto', 'Mosteiro da Serra do Pilar', 'Teleférico de Gaia', 'Praias de Gaia'],
      hist: 'Na margem sul do Douro, é onde envelhece o Vinho do Porto nas caves históricas, frente à Ribeira do Porto.',
      food: ['Vinho do Porto', 'Sardinha assada'],
      trad: ['São João', 'Regata de barcos rabelos'],
    },
    'matosinhos': {
      poi: ['Praia de Matosinhos', 'Mercado Municipal', 'Casa de Chá da Boa Nova (Siza Vieira)', 'Forte de Leça'],
      hist: 'Capital portuguesa da indústria conserveira e da gastronomia de peixe grelhado, junto ao porto de Leixões.',
      food: ['Peixe grelhado', 'Conservas de Matosinhos', 'Caldeirada'],
      trad: ['Festas do Senhor de Matosinhos'],
    },
    'vila do conde': {
      poi: ['Mosteiro de Santa Clara', 'Aqueduto', 'Navio-escola / estaleiros', 'Praias'],
      hist: 'Vila de longa tradição naval e de construção de naus para os Descobrimentos. Conhecida pelas rendas de bilros.',
      food: ['Clarinhas de Vila do Conde', 'Peixe fresco'],
      trad: ['Rendas de bilros', 'Feira Nacional de Artesanato'],
    },
    'amarante': {
      poi: ['Ponte de São Gonçalo', 'Igreja e Mosteiro de São Gonçalo', 'Museu Amadeo de Souza-Cardoso'],
      hist: 'Vila ribeirinha do Tâmega ligada a São Gonçalo, casamenteiro popular. Terra do pintor modernista Amadeo de Souza-Cardoso.',
      food: ['Doces de São Gonçalo', 'Foguetes de Amarante', 'Vinho verde'],
      trad: ['Festas de São Gonçalo (bolos fálicos)'],
    },
    'lamego': {
      poi: ['Santuário de Nossa Senhora dos Remédios', 'Castelo de Lamego', 'Sé de Lamego'],
      hist: 'Cidade do Douro, palco das primeiras Cortes de Portugal segundo a tradição. Famosa pela escadaria barroca dos Remédios.',
      food: ['Presunto de Lamego', 'Espumante da Raposeira', 'Bola de Lamego'],
      trad: ['Festa dos Remédios (Setembro)'],
    },
    'chaves': {
      poi: ['Ponte Romana de Trajano', 'Forte de São Francisco', 'Termas de Chaves', 'Castelo (Torre de Menagem)'],
      hist: 'Antiga Aquae Flaviae romana, na raia transmontana. Cidade termal de águas quentes e da histórica fortificação de fronteira.',
      food: ['Presunto de Chaves (IGP)', 'Pastéis de Chaves (IGP)', 'Folar de Chaves'],
      trad: ['Feira dos Santos', 'Carnaval de Chaves'],
    },
    'lagos': {
      poi: ['Ponta da Piedade', 'Praia de Dona Ana', 'Mercado de Escravos', 'Forte da Ponta da Bandeira', 'Igreja de Santo António'],
      hist: 'Porto das Descobertas e base de Henrique o Navegador. Daqui partiram caravelas para a costa africana no século XV.',
      food: ['Cataplana', 'Percebes', 'Dom Rodrigos'],
      trad: ['Festa dos Descobrimentos', 'Banho 29'],
    },
    'portimao': {
      poi: ['Praia da Rocha', 'Museu de Portimão (antiga conserveira)', 'Marina de Portimão'],
      hist: 'Cidade conserveira na foz do Arade que se reinventou como destino balnear da Praia da Rocha.',
      food: ['Sardinha assada de Portimão', 'Cataplana de marisco'],
      trad: ['Festival da Sardinha'],
    },
    'silves': {
      poi: ['Castelo de Silves (mourisco)', 'Sé de Silves', 'Cruz de Portugal'],
      hist: 'Antiga capital do Al-Gharb (Algarve), foi importante cidade islâmica. O seu castelo de grés vermelho é dos mais bem conservados do país.',
      food: ['Doces de figo e amêndoa', 'Medronho'],
      trad: ['Feira Medieval de Silves'],
    },
    'loule': {
      poi: ['Mercado de Loulé', 'Castelo de Loulé', 'Praia de Vale do Lobo / Quarteira', 'Fonte da Benémola'],
      hist: 'Centro histórico e comercial do barrocal algarvio, com forte tradição artesanal (cobre, palma, cestaria).',
      food: ['Doçaria de amêndoa e figo', 'Xerém'],
      trad: ['Carnaval de Loulé', 'Festival MED', 'Mãe Soberana (romaria)'],
    },
    'tavira': {
      poi: ['Ponte Romana', 'Castelo de Tavira', 'Igreja de Santa Maria do Castelo', 'Ilha de Tavira'],
      hist: 'Cidade de igrejas e telhados de tesouro no sotavento algarvio, ligada à pesca do atum e à Ria Formosa.',
      food: ['Atum de Tavira', 'Polvo', 'Doces de amêndoa'],
      trad: ['Festas da cidade', 'Tradição do atum'],
    },
    'albufeira': {
      poi: ['Praia dos Pescadores', 'Praia da Falésia', 'Olhos de Água', 'Centro histórico'],
      hist: 'Antiga aldeia piscatória de origem árabe (Al-Buhera) que se tornou no maior centro turístico do Algarve.',
      food: ['Peixe grelhado', 'Cataplana'],
      trad: ['Festas de verão', 'Folia algarvia'],
    },
    'vila do bispo': {
      poi: ['Cabo de São Vicente', 'Fortaleza de Sagres', 'Praia do Castelejo', 'Parque Natural do Sudoeste'],
      hist: 'No extremo sudoeste da Europa, inclui Sagres, ponto associado à escola de navegação do Infante D. Henrique.',
      food: ['Percebes', 'Peixe e marisco da costa vicentina'],
      trad: ['Festa de Nossa Senhora de Guadalupe'],
    },
    'mertola': {
      poi: ['Castelo de Mértola', 'Igreja Matriz (antiga mesquita)', 'Núcleos museológicos', 'Pulo do Lobo (perto)'],
      hist: 'Vila-museu sobre o Guadiana, antigo porto fluvial romano e islâmico. Conserva a única mesquita medieval de Portugal transformada em igreja.',
      food: ['Ensopado de borrego', 'Migas', 'Queijo de Serpa (perto)'],
      trad: ['Festival Islâmico de Mértola'],
    },
    'elvas': {
      poi: ['Fortificações abaluartadas (UNESCO)', 'Aqueduto da Amoreira', 'Forte de Santa Luzia', 'Castelo de Elvas'],
      hist: 'Praça-forte de fronteira classificada Património Mundial, com o maior conjunto de fortificações abaluartadas terrestres do mundo.',
      food: ['Ameixas de Elvas', 'Sericaia com ameixa', 'Azeitonas'],
      trad: ['Feira de São Mateus'],
    },
    'marvao': {
      poi: ['Castelo de Marvão', 'Muralhas e vila intramuros', 'Vistas sobre a Serra de São Mamede'],
      hist: 'Ninho de águia a 862 m, vila amuralhada de origem islâmica com vistas amplas sobre o Alentejo e a Espanha.',
      food: ['Castanha de Marvão', 'Doçaria conventual'],
      trad: ['Festival do Castanheiro', 'Marvão Música (festival)'],
    },
    'reguengos de monsaraz': {
      poi: ['Aldeia histórica de Monsaraz', 'Castelo de Monsaraz', 'Cromeleque do Xerez', 'Grande Lago do Alqueva'],
      hist: 'Concelho do Alentejo vinhateiro junto ao Alqueva. Monsaraz é uma das mais bem preservadas aldeias muralhadas do país.',
      food: ['Vinhos de Reguengos (DOC)', 'Queijo', 'Ensopado de borrego'],
      trad: ['Monsaraz Museu Aberto', 'Olaria de São Pedro do Corval'],
    },
    'sines': {
      poi: ['Castelo de Sines (Casa de Vasco da Gama)', 'Praia de São Torpes', 'Porto de Sines'],
      hist: 'Terra natal de Vasco da Gama. Vila piscatória que acolhe hoje o maior porto de águas profundas de Portugal.',
      food: ['Peixe grelhado', 'Sapateira'],
      trad: ['Festival Músicas do Mundo (FMM Sines)'],
    },
    'ilhavo': {
      poi: ['Museu Marítimo de Ílhavo', 'Navio-Museu Santo André', 'Praia da Costa Nova (casas listradas)', 'Fábrica da Vista Alegre'],
      hist: 'Terra de pescadores do bacalhau e da Ria de Aveiro. Sede da histórica porcelana Vista Alegre, fundada em 1824.',
      food: ['Bacalhau', 'Caldeirada', 'Folar de Vale de Ílhavo'],
      trad: ['Festa do Bacalhau', 'Porcelana Vista Alegre'],
    },
    'espinho': {
      poi: ['Praia de Espinho', 'Casino de Espinho', 'Feira semanal (Segunda-Feira)'],
      hist: 'Antiga povoação de pescadores que se tornou estância balnear pioneira no Norte, com a chegada do comboio no século XIX.',
      food: ['Peixe grelhado', 'Caldeirada'],
      trad: ['Feira de Espinho', 'FEST (festival de cinema)'],
    },
    'ponte de lima': {
      poi: ['Ponte Romana e Medieval', 'Centro histórico', 'Ecovia do Rio Lima', 'Arnado (jardins)'],
      hist: 'A vila mais antiga de Portugal (foral de 1125), atravessada pela ponte sobre o Lima que lhe dá nome.',
      food: ['Arroz de sarrabulho à moda do Minho', 'Vinho verde de Ponte de Lima'],
      trad: ['Feiras Novas (Setembro)', 'Vaca das Cordas'],
    },
    'barcelos': {
      poi: ['Paço dos Condes (ruínas)', 'Ponte Medieval', 'Templo do Senhor da Cruz', 'Feira de Barcelos'],
      hist: 'Berço da lenda do Galo de Barcelos, símbolo de Portugal, e capital do artesanato e da olaria do Minho.',
      food: ['Galo (frango) assado', 'Vinho verde', 'Doçaria conventual'],
      trad: ['Feira semanal (Quinta-Feira)', 'Festas das Cruzes', 'Olaria de Barcelos'],
    },
    'moncao': {
      poi: ['Muralhas de Monção', 'Termas', 'Palácio da Brejoeira (perto)', 'Rio Minho (fronteira)'],
      hist: 'Praça raiana sobre o Minho, célebre pela heroína Deuladeu Martins e pelo vinho verde Alvarinho.',
      food: ['Vinho Alvarinho', 'Lampreia do Minho', 'Cordeiro'],
      trad: ['Festas da Coca (Corpo de Deus)'],
    },
    'caldas da rainha': {
      poi: ['Hospital Termal (Rainha D. Leonor)', 'Parque D. Carlos I', 'Museu José Malhoa', 'Praia da Foz do Arelho (perto)'],
      hist: 'Cidade termal fundada pela Rainha D. Leonor no século XV. Centro da cerâmica artística das Caldas (Bordalo Pinheiro).',
      food: ['Cavacas das Caldas', 'Trouxas de ovos', 'Beijinhos'],
      trad: ['Cerâmica das Caldas', 'Mercado da Fruta'],
    },
    'figueira da foz': {
      poi: ['Praia da Figueira (Claridade)', 'Casino Figueira', 'Cabo Mondego', 'Forte de Santa Catarina'],
      hist: 'Estância balnear na foz do Mondego, célebre desde o século XIX pelo seu vasto areal e pela vida de praia.',
      food: ['Caldeirada à pescador', 'Brisas do Mondego', 'Sável'],
      trad: ['Festas de São João', 'Mundialito de futebol de praia'],
    },
    'peniche': {
      poi: ['Fortaleza de Peniche', 'Cabo Carvoeiro', 'Ilha da Berlenga (reserva)', 'Praia de Supertubos'],
      hist: 'Península piscatória e antiga prisão política do Estado Novo. Meca do surf (Supertubos) e porta das Berlengas.',
      food: ['Caldeirada de peixe', 'Sapateira recheada', 'Esparregado'],
      trad: ['Rendas de bilros de Peniche', 'Festas de Nossa Senhora da Boa Viagem'],
    },
    'mafra': {
      poi: ['Palácio Nacional de Mafra (UNESCO)', 'Tapada de Mafra', 'Ericeira (World Surfing Reserve)'],
      hist: 'Concelho do monumental Palácio e Convento de Mafra, obra barroca de D. João V. Inclui a Ericeira, reserva mundial de surf.',
      food: ['Pão saloio', 'Peixe da Ericeira', 'Fradinhos'],
      trad: ['Concertos de carrilhão de Mafra'],
    },
    'oeiras': {
      poi: ['Palácio Marquês de Pombal', 'Forte de São Julião da Barra', 'Piscina Oceânica', 'Passeio Marítimo'],
      hist: 'Concelho da Linha de Cascais, residência do Marquês de Pombal. Hoje polo científico e empresarial junto ao Tejo.',
      food: ['Peixe grelhado', 'Doçaria conventual'],
      trad: ['Festas do concelho'],
    },
    'almada': {
      poi: ['Cristo Rei', 'Cacilhas (cacilheiros)', 'Costa da Caparica (praias)', 'Boca do Vento (elevador)'],
      hist: 'Na margem sul do Tejo, frente a Lisboa. O Santuário de Cristo Rei (1959) domina a vista sobre a Ponte 25 de Abril.',
      food: ['Peixe frito de Cacilhas', 'Caldeirada'],
      trad: ['Festas da cidade'],
    },
  };

  /* Normalise a concelho name to the key form used above. */
  function _norm(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  }
  function get(name) { return DATA[_norm(name)] || null; }

  return { get, _norm };
})();
