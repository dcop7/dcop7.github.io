/* ══════════════════════════════════════════════════════════════════
   PORTUGAL EXPLORER — Interactive District & Municipality Guide
══════════════════════════════════════════════════════════════════ */
const PortugalExplorer = (function () {
  'use strict';

  /* ── District cultural data ── */
  const DISTRICTS = [
    {
      id: 'aveiro', name: 'Aveiro',
      region: 'Centro', nuts2: 'Centro',
      pop: 714200, area: 2808, munic: 19,
      capital: 'Aveiro', lat: 40.6405, lon: -8.6538,
      emoji: '🌊', tagline: 'A Veneza Portuguesa',
      color: '#3b82f6',
      landmarks: ['Ria de Aveiro', 'Costa Nova (casas listradas)', 'Universidade de Aveiro', 'Museu de Aveiro (Santa Joana)', 'Praia de Mira'],
      food: ['Ovos moles de Aveiro (IGP)', 'Enguias da Ria', 'Caldeirada de enguias', 'Saraiva', 'Tripas à moda de Aveiro'],
      traditions: ['Moliceiros na Ria', 'Cortejo de São Gonçalinho', 'Carnaval de Ovar', 'Festival do Marisco de Mira'],
      history: 'Aveiro ganhou o nome de "Veneza Portuguesa" pelos seus canais e embarcações tradicionais. Foi um dos maiores portos de pesca do bacalhau nos mares do Norte, e a Ria de Aveiro foi essencial para a produção de sal e o transporte de mercadorias. A chegada do caminho de ferro no século XIX impulsionou a industrialização da região.',
      facts: ['A Ria de Aveiro tem 45 km de comprimento e até 11 km de largura', 'Os ovos moles são produzidos desde o século XVI por monjas do Convento de Jesus', 'Costa Nova foi construída por pescadores que decoraram as suas casas com listas coloridas'],
    },
    {
      id: 'beja', name: 'Beja',
      region: 'Alentejo', nuts2: 'Alentejo',
      pop: 152800, area: 10225, munic: 14,
      capital: 'Beja', lat: 38.0153, lon: -7.8630,
      emoji: '🌾', tagline: 'O Celeiro do Alentejo',
      color: '#f59e0b',
      landmarks: ['Castelo de Beja', 'Museu Regional de Beja', 'Castro Verde', 'Mértola (vila museu)', 'Barragem do Alqueva'],
      food: ['Ensopado de borrego', 'Migas alentejanas', 'Carne de porco à alentejana', 'Queijo de ovelha', 'Carolo'],
      traditions: ['Festa da Espiga', 'Cante Alentejano (UNESCO)', 'Festas de Santo António em Serpa'],
      history: 'Beja tem mais de 2500 anos de história. Fora capital da Lusitânia na época romana sob o nome de Pax Julia. A cidade foi reconquistada aos mouros em 1162 por Afonso Henriques. O Alentejo foi durante séculos o "celeiro" de Portugal, produzindo a maior parte dos cereais do país.',
      facts: ['Mértola é conhecida como a "Vila Museu" por ter o maior número de museus per capita de Portugal', 'O Alqueva é o maior lago artificial da Europa Ocidental', 'O cante alentejano é Património Imaterial da Humanidade pela UNESCO desde 2014'],
    },
    {
      id: 'braga', name: 'Braga',
      region: 'Minho', nuts2: 'Norte',
      pop: 848200, area: 2673, munic: 14,
      capital: 'Braga', lat: 41.5454, lon: -8.4265,
      emoji: '⛪', tagline: 'A Cidade dos Arcebispos',
      color: '#8b5cf6',
      landmarks: ['Bom Jesus do Monte', 'Sé de Braga', 'Santuário do Sameiro', 'Braga Romana', 'Parque Nacional Peneda-Gerês'],
      food: ['Rojões à minhota', 'Bacalhau à Braga', 'Papas de sarrabulho', 'Vinho verde', 'Torta de Viana'],
      traditions: ['Semana Santa de Braga (a mais antiga de Portugal)', 'Festas de São João', 'Viagem Medieval de Barcelos'],
      history: 'Braga é uma das cidades mais antigas da Península Ibérica. Fundada pelos romanos como Bracara Augusta no século I a.C., foi capital da Gallaecia. Foi um dos principais centros do Cristianismo na Península. Os seus arcebispos tiveram enorme influência política e religiosa ao longo da história portuguesa.',
      facts: ['O Bom Jesus do Monte tem a mais antiga Via Sacra do mundo ainda em funcionamento', 'Braga tem a Semana Santa mais antiga de Portugal, com mais de 500 anos', 'É a terceira cidade mais populosa de Portugal'],
    },
    {
      id: 'braganca', name: 'Bragança',
      region: 'Trás-os-Montes', nuts2: 'Norte',
      pop: 136000, area: 6608, munic: 12,
      capital: 'Bragança', lat: 41.8061, lon: -6.7587,
      emoji: '🏰', tagline: 'A Capital de Trás-os-Montes',
      color: '#6b7280',
      landmarks: ['Castelo de Bragança (Domus Municipalis)', 'Cidadela Medieval', 'Parque Natural de Montesinho', 'Museu do Abade de Baçal'],
      food: ['Alheira de Mirandela (IGP)', 'Presunto de Vinhais (IGP)', 'Butelo e casulas', 'Posta mirandesa', 'Mel de Trás-os-Montes'],
      traditions: ['Máscaras de Lazarim (Carnaval)', 'Festa de Santo António', 'Pauliteiros de Miranda'],
      history: 'Bragança foi fundada no séc. XII e tornou-se capital do ducado de Bragança, cujos duques viriam a ser os últimos reis de Portugal. A Casa de Bragança reinou em Portugal de 1640 a 1910. O município preserva uma das cidadelas medievais melhor conservadas do país.',
      facts: ['A Domus Municipalis de Bragança é o único edifício municipal românico civil da Península Ibérica', 'O Parque Natural de Montesinho tem mais de 600 espécies de fauna', 'A alheira foi inventada pelos Judeus portugueses para dissimular a sua identidade perante a Inquisição'],
    },
    {
      id: 'castelo-branco', name: 'Castelo Branco',
      region: 'Beira Interior', nuts2: 'Centro',
      pop: 196000, area: 6675, munic: 11,
      capital: 'Castelo Branco', lat: 39.8231, lon: -7.4972,
      emoji: '🧵', tagline: 'Terra dos Colchas Bordadas',
      color: '#10b981',
      landmarks: ['Jardim do Paço Episcopal', 'Museu Francisco Tavares Proença Júnior', 'Monsanto (aldeia histórica)', 'Idanha-a-Velha (cidade romana)'],
      food: ['Queijo da Serra da Estrela', 'Migas com entrecosto', 'Chanfana', 'Ensopado de borrego'],
      traditions: ['Colchas bordadas de Castelo Branco', 'Festa dos Rapazes (Navidades no Nordeste)'],
      history: 'Castelo Branco foi um importante posto militar na Idade Média, disputado entre Portugal e Castela. O Jardim do Paço, construído no século XVIII, é um dos jardins formais mais belos de Portugal. A região é conhecida pelos bordados de Castelo Branco, tradição de séculos.',
      facts: ['Os bordados de Castelo Branco são uma das mais antigas tradições artesanais de Portugal', 'Monsanto foi eleita "a aldeia mais portuguesa de Portugal" em 1938', 'Idanha-a-Velha tem ruínas de uma cidade romana e visigótica'],
    },
    {
      id: 'coimbra', name: 'Coimbra',
      region: 'Beira Litoral', nuts2: 'Centro',
      pop: 430000, area: 3947, munic: 17,
      capital: 'Coimbra', lat: 40.2057, lon: -8.4194,
      emoji: '🎓', tagline: 'A Cidade do Conhecimento',
      color: '#dc2626',
      landmarks: ['Universidade de Coimbra (UNESCO)', 'Biblioteca Joanina', 'Mosteiro de Santa Cruz', 'Portugal dos Pequenitos', 'Convento de Cristo (Tomar)'],
      food: ['Chanfana de cabrito', 'Leitão da Bairrada', 'Arroz de lampreia', 'Pastéis de Tentúgal', 'Raivas de Coimbra'],
      traditions: ['Fado de Coimbra', 'Queima das Fitas', 'Serenata Monumental'],
      history: 'Coimbra foi a capital de Portugal no séc. XII e XIII. A sua universidade, fundada em 1290, é uma das mais antigas do mundo e a mais antiga de Portugal. A Biblioteca Joanina, construída no século XVIII, é considerada uma das mais belas bibliotecas do mundo.',
      facts: ['A Universidade de Coimbra é Património Mundial da UNESCO desde 2013', 'A Biblioteca Joanina tem morcegos que vivem lá para proteger os livros dos insetos', 'O Fado de Coimbra tem uma tradição diferente do Fado de Lisboa — é cantado exclusivamente por homens'],
    },
    {
      id: 'evora', name: 'Évora',
      region: 'Alto Alentejo', nuts2: 'Alentejo',
      pop: 166700, area: 7393, munic: 14,
      capital: 'Évora', lat: 38.5710, lon: -7.9097,
      emoji: '🏛', tagline: 'A Cidade Museu',
      color: '#d97706',
      landmarks: ['Templo Romano de Évora', 'Catedral de Évora', 'Cromeleque dos Almendres', 'Aqueduto da Prata', 'Casa dos Ossos'],
      food: ['Açorda alentejana', 'Sopa de cação', 'Carne de porco à alentejana', 'Queijo de Évora (DOP)', 'Encharcada'],
      traditions: ['Cante Alentejano', 'São João de Évora', 'Festa da Cidade'],
      history: 'Évora é Património Mundial da UNESCO desde 1986. Fundada pelos romanos, a cidade tem uma das melhores coleções de monumentos da Antiguidade em Portugal. O Cromeleque dos Almendres, a 12 km da cidade, é o maior conjunto megalítico da Península Ibérica.',
      facts: ['Évora foi capital do Reino do Algarve antes de Faro', 'O Templo Romano de Diana é o mais bem preservado da Península Ibérica', 'O Cromeleque dos Almendres é mais antigo que Stonehenge'],
    },
    {
      id: 'faro', name: 'Faro',
      region: 'Algarve', nuts2: 'Algarve',
      pop: 444900, area: 4960, munic: 16,
      capital: 'Faro', lat: 37.0194, lon: -7.9304,
      emoji: '🌞', tagline: 'O Algarve — Sol e História',
      color: '#f97316',
      landmarks: ['Ria Formosa (Reserva Natural)', 'Sagres e Cabo de São Vicente', 'Silves (castelo mourisco)', 'Praia da Marinha', 'Lagoa dos Salgados'],
      food: ['Cataplana de marisco', 'Amêijoas na cataplana', 'Caranguejo', 'Figos do Algarve (IGP)', 'Medronho'],
      traditions: ['Festas do Mar', 'Festival de Silves Medieval', 'Carnaval de Loulé'],
      history: 'O Algarve (do árabe Al-Gharb — "o ocidente") foi o último território português reconquistado aos mouros em 1249. Sob o reinado de D. Henrique o Navegador, Sagres tornou-se o ponto de partida das Descobertas Portuguesas. O Algarve moderno é um dos destinos turísticos mais visitados da Europa.',
      facts: ['Sagres foi onde Henrique o Navegador estabeleceu a sua escola de navegação', 'A Ria Formosa é um dos mais importantes santuários de aves da Europa', 'O caranguejo do Algarve é exportado para toda a Europa'],
    },
    {
      id: 'guarda', name: 'Guarda',
      region: 'Beira Interior', nuts2: 'Centro',
      pop: 160900, area: 5518, munic: 14,
      capital: 'Guarda', lat: 40.5364, lon: -7.2676,
      emoji: '🏔', tagline: 'A Mais Alta, Fria, Forte e Fiel',
      color: '#6b7280',
      landmarks: ['Catedral da Guarda', 'Torre de Menagem', 'Serra da Estrela', 'Sortelha (aldeia histórica)', 'Belmonte (terra de Álvares Cabral)'],
      food: ['Queijo Serra da Estrela (DOP)', 'Chouriço de carne da Serra', 'Bacalhau à moda da Serra', 'Mel da Serra da Estrela'],
      traditions: ['Festas da Cidade (Novembro)', 'Feira de S. Mateus', 'Sabores da Serra'],
      history: 'Guarda foi fundada em 1199 por D. Sancho I como posto de defesa contra as invasões de Castela. O seu brasão tem as palavras "Forte, Fria, Farta, Fiel" que descrevem o seu carácter. A Serra da Estrela, ponto mais alto de Portugal Continental (1993 m), domina o horizonte.',
      facts: ['Guarda é a cidade mais alta de Portugal, a 1056 m de altitude', 'A Serra da Estrela dá nome ao queijo mais famoso de Portugal', 'Belmonte tem uma das mais antigas comunidades judaicas de Portugal'],
    },
    {
      id: 'leiria', name: 'Leiria',
      region: 'Beira Litoral', nuts2: 'Centro',
      pop: 470600, area: 3517, munic: 16,
      capital: 'Leiria', lat: 39.7437, lon: -8.8071,
      emoji: '🏰', tagline: 'Terra de Reis e Pinheiros',
      color: '#22c55e',
      landmarks: ['Castelo de Leiria', 'Mosteiro de Alcobaça (UNESCO)', 'Mosteiro da Batalha (UNESCO)', 'Fátima (Santuário)', 'Óbidos (vila medieval)'],
      food: ['Leitão da Bairrada', 'Caldeirada de peixe da Nazaré', 'Doces conventuais de Alcobaça', 'Pão de ló de Margaride'],
      traditions: ['Peregrinação de Fátima (13 de cada mês)', 'Festa das Cruzes de Barcelos', 'Óbidos Medieval'],
      history: 'Leiria tem uma das maiores concentrações de Patrimónios da Humanidade UNESCO de Portugal. O Mosteiro de Alcobaça, fundado em 1153 por Afonso Henriques, e o Mosteiro da Batalha, construído para celebrar a vitória de Aljubarrota (1385), são dois dos mais importantes edifícios góticos da Península Ibérica.',
      facts: ['Fátima recebe cerca de 6 milhões de peregrinos por ano', 'Óbidos foi oferecida como presente de casamento a várias rainhas de Portugal', 'A Floresta de Leiria (Pinhal de Leiria) foi plantada por D. Dinis no século XIII'],
    },
    {
      id: 'lisboa', name: 'Lisboa',
      region: 'Área Metropolitana de Lisboa', nuts2: 'AML',
      pop: 2275000, area: 2761, munic: 18,
      capital: 'Lisboa', lat: 38.7167, lon: -9.1333,
      emoji: '🌉', tagline: 'A Cidade das Sete Colinas',
      color: '#6366f1',
      landmarks: ['Torre de Belém (UNESCO)', 'Mosteiro dos Jerónimos (UNESCO)', 'Castelo de São Jorge', 'Alfama', 'Oceanário de Lisboa'],
      food: ['Pastéis de Belém', 'Bacalhau à Brás', 'Sardinhas assadas', 'Caldo verde', 'Bitoque'],
      traditions: ['Santos Populares (Festas de Lisboa)', 'Fado de Lisboa', 'Carnaval de Torres Vedras'],
      history: 'Lisboa é uma das capitais mais antigas da Europa, habitada há mais de 3000 anos. Tornou-se a capital de Portugal no século XIII. No século XVI, era uma das maiores e mais ricas cidades do mundo, como centro do comércio das especiarias. O terramoto de 1755 destruiu grande parte da cidade, que foi reconstruída pela visão do Marquês de Pombal.',
      facts: ['Lisboa é a única capital europeia com acesso direto ao Atlântico', 'O elétrico 28 é o transporte público mais icónico da cidade', 'O Marquês de Pombal reconstruiu o centro de Lisboa num tempo recorde após o terramoto de 1755'],
    },
    {
      id: 'portalegre', name: 'Portalegre',
      region: 'Alto Alentejo', nuts2: 'Alentejo',
      pop: 118500, area: 6065, munic: 15,
      capital: 'Portalegre', lat: 39.2960, lon: -7.4289,
      emoji: '🪡', tagline: 'Terra dos Tapetes e da Cortiça',
      color: '#84cc16',
      landmarks: ['Castelo de Portalegre', 'Museu da Tapeçaria de Guy Fino', 'Serra de São Mamede', 'Marvão (aldeia histórica)', 'Castelo de Vide'],
      food: ['Sopa de cação', 'Migas com entrecosto', 'Queijo de ovelha alentejano', 'Encharcada'],
      traditions: ['Tapeçaria de Portalegre', 'Festas da Cidade', 'Feira do Artesanato'],
      history: 'Portalegre foi um importante centro têxtil nos séculos XVII-XIX. A sua Manufactura de Tapeçarias, fundada em 1947, produz algumas das mais belas tapeçarias do mundo. A Serra de São Mamede é o ponto mais alto do Alentejo e abriga fauna única.',
      facts: ['Marvão, a 862m de altitude, tem as melhores vistas do Alentejo', 'As tapeçarias de Portalegre são exportadas para museus de todo o mundo', 'A cortiça do Alentejo representa 50% da produção mundial'],
    },
    {
      id: 'porto', name: 'Porto',
      region: 'Douro Litoral', nuts2: 'Norte',
      pop: 1817000, area: 2395, munic: 18,
      capital: 'Porto', lat: 41.1579, lon: -8.6291,
      emoji: '🍷', tagline: 'A Invicta',
      color: '#dc2626',
      landmarks: ['Ribeira do Porto (UNESCO)', 'Caves de Vinho do Porto', 'Livraria Lello', 'Torre dos Clérigos', 'Palácio da Bolsa', 'Serralves'],
      food: ['Francesinha', 'Tripas à moda do Porto', 'Vinho do Porto', 'Pastel de Chaves', 'Bacalhau à Gomes de Sá'],
      traditions: ['Festa de São João do Porto', 'Queima das Fitas', 'Regata das Barcos Rabelos'],
      history: 'Porto é a segunda maior cidade de Portugal e deu nome ao país — "Portus Cale". A sua Ribeira e o conjunto das Caves de Vinho do Porto em Vila Nova de Gaia são Património Mundial da UNESCO desde 1996. O Vinho do Porto, exportado para todo o mundo desde o século XVII, é um dos produtos portugueses mais famosos.',
      facts: ['Porto deu o nome a Portugal — o país chama-se Portucale', 'A Livraria Lello, inaugurada em 1906, é uma das mais belas do mundo e inspirou J.K. Rowling', 'A Francesinha foi inventada em 1952 por Daniel da Silva'],
    },
    {
      id: 'santarem', name: 'Santarém',
      region: 'Ribatejo', nuts2: 'Alentejo',
      pop: 454000, area: 6747, munic: 21,
      capital: 'Santarém', lat: 39.2369, lon: -8.6860,
      emoji: '🐂', tagline: 'Capital do Gótico e da Toirada',
      color: '#ef4444',
      landmarks: ['Portas do Sol', 'Igreja de Santa Cruz', 'Almourol (castelo fluvial)', 'Vale do Tejo', 'Constância'],
      food: ['Sopa da pedra de Almeirim', 'Morcela de arroz de Benfica do Ribatejo', 'Tomatada com ovos', 'Queijo de Abrantes'],
      traditions: ['Feira Nacional de Agricultura', 'Festival Nacional de Gastronomia', 'Colete Encarnado (Vila Franca de Xira)'],
      history: 'Santarém foi um dos primeiros territórios conquistados por Afonso Henriques aos mouros (1147). Conhecida como a "Capital do Gótico" pela abundância de monumentos desta época, e o "Celeiro de Portugal" pela fertilidade dos seus campos do Tejo. O Ribatejo é também o coração da cultura tauromáquica portuguesa.',
      facts: ['Santarém tem mais igrejas góticas por km² do que qualquer outra cidade de Portugal', 'A Feira Nacional de Agricultura é o maior evento agropecuário ibérico', 'O Festival Nacional de Gastronomia é o mais antigo de Portugal'],
    },
    {
      id: 'setubal', name: 'Setúbal',
      region: 'Área Metropolitana de Lisboa', nuts2: 'AML',
      pop: 851300, area: 5064, munic: 13,
      capital: 'Setúbal', lat: 38.5236, lon: -8.8939,
      emoji: '🐬', tagline: 'Terra de Golfinhos e Muscat',
      color: '#06b6d4',
      landmarks: ['Serra da Arrábida (Parque Natural)', 'Palácio Nacional de Sintra', 'Cabo Espichel', 'Sesimbra', 'Palmela'],
      food: ['Choco frito de Setúbal', 'Moscatel de Setúbal (DOP)', 'Azeitona Maçanilha', 'Queijadas de Sintra'],
      traditions: ['Festas de São Luís', 'Feira de Março de Palmela', 'Vindimas do Moscatel'],
      history: 'Setúbal tem uma das mais ricas histórias marítimas de Portugal. A Serra da Arrábida, classificada como Parque Natural, tem algumas das praias mais belas de Portugal Continental. Sintra, com os seus palácios românticos, é Património Mundial da UNESCO desde 1995.',
      facts: ['A baía de Setúbal tem uma das maiores populações de golfinhos da Europa', 'Sintra foi descrita por Lord Byron como "o Éden glorioso"', 'O Moscatel de Setúbal é produzido há mais de 2000 anos'],
    },
    {
      id: 'viana-do-castelo', name: 'Viana do Castelo',
      region: 'Minho', nuts2: 'Norte',
      pop: 244800, area: 2255, munic: 10,
      capital: 'Viana do Castelo', lat: 41.6918, lon: -8.8340,
      emoji: '🎣', tagline: 'Senhora da Agonia e do Mar',
      color: '#0ea5e9',
      landmarks: ['Basílica de Santa Luzia', 'Vila do Conde (Mosteiro)', 'Parque Nacional Peneda-Gerês', 'Afife', 'Rio Minho'],
      food: ['Papas de sarrabulho', 'Vinho verde', 'Arroz de sarrabulho', 'Broas de mel'],
      traditions: ['Festas de Nossa Senhora da Agonia (agosto — maiores festas regionais do Norte)', 'Viana Folk', 'Romaria de Stª Luzia'],
      history: 'Viana do Castelo é conhecida pelas suas festas de Nossa Senhora da Agonia, consideradas as maiores festas populares do norte de Portugal. A cidade foi um importante porto de pesca e comércio com o Brasil. A Basílica de Santa Luzia, construída no séc. XX, domina a cidade a partir do Monte de Santa Luzia.',
      facts: ['As Festas de Viana são Imaterial Cultural Heritage da UNESCO', 'O traje típico de Viana é o mais rico e elaborado de Portugal', 'Viana foi um dos maiores portos exportadores de bacalhau seco para o Brasil'],
    },
    {
      id: 'vila-real', name: 'Vila Real',
      region: 'Trás-os-Montes', nuts2: 'Norte',
      pop: 206700, area: 4328, munic: 14,
      capital: 'Vila Real', lat: 41.3000, lon: -7.7457,
      emoji: '🍇', tagline: 'Terra do Vinho e da Louça de Bisalhães',
      color: '#7c3aed',
      landmarks: ['Solar de Mateus', 'Parque Natural do Alvão', 'Montalegre (Terras de Barroso)', 'Vidago Palace'],
      food: ['Posta mirandesa', 'Presunto de Barroso (IGP)', 'Vinho de Chaves', 'Mel de Barroso (DOP)', 'Queijo de Cabra Transmontano (DOP)'],
      traditions: ['Carnaval de Chaves', 'Feira de São Mateus', 'Festas de Barroso'],
      history: 'Vila Real é conhecida pela louça preta de Bisalhães, técnica neolítica única no mundo. O Solar de Mateus, construído no séc. XVIII, está representado na garrafa do famoso Mateus Rosé. A região de Barroso foi classificada como Reserva da Biosfera da UNESCO.',
      facts: ['A louça preta de Bisalhães usa uma técnica neolítica única declarada Património Imaterial da UNESCO', 'O Solar de Mateus é um dos edifícios barrocos mais importantes de Portugal', 'A carne mirandesa é uma das raças bovinas mais antigas da Península Ibérica'],
    },
    {
      id: 'viseu', name: 'Viseu',
      region: 'Beira Alta', nuts2: 'Centro',
      pop: 377600, area: 5010, munic: 24,
      capital: 'Viseu', lat: 40.6566, lon: -7.9122,
      emoji: '🎨', tagline: 'Cidade Jardim de Portugal',
      color: '#059669',
      landmarks: ['Sé de Viseu', 'Museu Grão Vasco', 'Quinta das Vendas', 'Serra da Estrela', 'Cávado'],
      food: ['Vinho Dão (DOC)', 'Vitela de Lafões (IGP)', 'Queijo de Azeitão', 'Bôla de Lamego'],
      traditions: ['Feira de São Mateus (a maior do Interior Norte)', 'Festas da Cidade', 'Festival MED de Loulé'],
      history: 'Viseu é conhecida como a "Cidade Jardim" de Portugal pela sua qualidade de vida e espaços verdes. O Museu Grão Vasco possui a maior coleção de obras do pintor Vasco Fernandes (Grão Vasco), um dos maiores pintores renascentistas portugueses.',
      facts: ['O Vinho Dão é considerado um dos melhores vinhos tintos de Portugal', 'Grão Vasco pintou algumas das mais importantes obras do Renascimento português', 'Viseu é consistentemente classificada como uma das melhores cidades para viver em Portugal'],
    },
    {
      id: 'madeira', name: 'Madeira',
      region: 'Região Autónoma da Madeira', nuts2: 'RAM',
      pop: 254000, area: 741, munic: 11,
      capital: 'Funchal', lat: 32.7607, lon: -16.9595,
      emoji: '🌺', tagline: 'Ilha das Flores no Atlântico',
      color: '#ec4899',
      landmarks: ['Monte (teleférico e carros de cesto)', 'Levadas da Madeira', 'Cabo Girão (maior falésia da Europa)', 'Funchal (mercado dos Lavradores)', 'Porto Moniz'],
      food: ['Espada com banana', 'Bolo de mel da Madeira', 'Vinho Madeira (DOC)', 'Poncha', 'Espetada'],
      traditions: ['Festa da Flor', 'Réveillon da Madeira (o maior de Portugal)', 'Festival do Atlântico'],
      history: 'A Madeira foi descoberta pelos portugueses em 1419 e foi o primeiro grande sucesso da Expansão Portuguesa. A ilha tornou-se um importante entreposto comercial para a cana-de-açúcar. O Vinho Madeira, produzido há 500 anos, é um dos vinhos mais históricos do mundo.',
      facts: ['O Réveillon da Madeira tem os maiores fogos de artifício da Europa e está no Guinness', 'As Levadas são canais de irrigação com mais de 2500 km de extensão, escavados à mão', 'Cristiano Ronaldo nasceu no Funchal'],
    },
    {
      id: 'acores', name: 'Açores',
      region: 'Região Autónoma dos Açores', nuts2: 'RAA',
      pop: 236000, area: 2333, munic: 19,
      capital: 'Ponta Delgada', lat: 37.7412, lon: -25.6756,
      emoji: '🌋', tagline: 'Nove Ilhas, Um Paraíso',
      color: '#06b6d4',
      landmarks: ['Sete Cidades (São Miguel)', 'Furnas (termas e cozido)', 'Caldeira do Faial', 'Fajã dos Cubres (Jogo)', 'Pico (vulcão mais alto de Portugal)'],
      food: ['Cozido das Furnas', 'Alcatra de terceira', 'Queijo São Jorge (DOP)', 'Ananás dos Açores', 'Licor de maracujá'],
      traditions: ['Festas do Espírito Santo (século XII)', 'Tourada à corda (Terceira)', 'Semana do Mar de Horta'],
      history: 'Os Açores foram descobertos pelos portugueses por volta de 1427 e são o ponto mais ocidental da Europa. As ilhas têm origem vulcânica e o Pico é o ponto mais alto de Portugal (2351m). O arquipélago foi uma paragem essencial nas rotas marítimas entre a Europa, América e África.',
      facts: ['O Pico é o ponto mais alto de Portugal a 2351 m', 'A Lagoa das Sete Cidades tem duas cores diferentes devido a uma diferença de pH', 'Os Açores são o único local da Europa onde se cultivam ananases em estufas aquecidas por fontes geotérmicas'],
    },
  ];

  /* ── Historic monuments per district (name + PT Wikipedia article) +
     a few extra points of interest. Kept separate so the DISTRICTS block
     stays readable; rendered as clickable links in the info panel. ── */
  const DISTRICT_MON = {
    aveiro: { mon: [
      ['Sé de Aveiro', 'Sé_de_Aveiro'], ['Mosteiro de Jesus (Museu de Aveiro)', 'Mosteiro_de_Jesus_(Aveiro)'],
      ['Farol da Barra', 'Farol_da_Barra_de_Aveiro'], ['Mosteiro de Arouca', 'Mosteiro_de_Arouca'],
    ], poi: ['Praia da Barra', 'Pateira de Fermentelos', 'Passadiços do Paiva (Arouca)', 'Ponte 516 Arouca'] },
    beja: { mon: [
      ['Castelo de Beja', 'Castelo_de_Beja'], ['Convento da Conceição (Museu Rainha D. Leonor)', 'Convento_de_Nossa_Senhora_da_Conceição_(Beja)'],
      ['Castelo de Mértola', 'Castelo_de_Mértola'], ['Igreja Matriz de Mértola (antiga mesquita)', 'Igreja_Matriz_de_Mértola'],
    ], poi: ['Pulo do Lobo', 'Mina de São Domingos', 'Vila Nova de Milfontes'] },
    braga: { mon: [
      ['Sé de Braga', 'Sé_de_Braga'], ['Santuário do Bom Jesus do Monte', 'Santuário_do_Bom_Jesus_do_Monte'],
      ['Santuário do Sameiro', 'Santuário_do_Sameiro'], ['Mosteiro de Tibães', 'Mosteiro_de_São_Martinho_de_Tibães'],
      ['Capela de São Frutuoso', 'Capela_de_São_Frutuoso_de_Montélios'],
    ], poi: ['Termas Romanas do Alto da Cividade', 'Geres (Peneda-Gerês)', 'Citânia de Briteiros'] },
    braganca: { mon: [
      ['Castelo de Bragança', 'Castelo_de_Bragança'], ['Domus Municipalis', 'Domus_Municipalis'],
      ['Sé de Bragança', 'Concatedral_de_Bragança'], ['Mosteiro de Castro de Avelãs', 'Mosteiro_de_Castro_de_Avelãs'],
    ], poi: ['Parque Natural de Montesinho', 'Centro de Arte Contemporânea Graça Morais', 'Miranda do Douro'] },
    'castelo-branco': { mon: [
      ['Jardim do Paço Episcopal', 'Jardim_do_Paço_Episcopal_de_Castelo_Branco'], ['Castelo de Monsanto', 'Castelo_de_Monsanto'],
      ['Sé de Castelo Branco', 'Sé_de_Castelo_Branco'], ['Ruínas romanas de Idanha-a-Velha', 'Idanha-a-Velha'],
    ], poi: ['Aldeia Histórica de Monsanto', 'Penha Garcia', 'Reserva Natural da Serra da Malcata'] },
    coimbra: { mon: [
      ['Universidade de Coimbra (Paço das Escolas)', 'Universidade_de_Coimbra'], ['Biblioteca Joanina', 'Biblioteca_Joanina'],
      ['Sé Velha de Coimbra', 'Sé_Velha_de_Coimbra'], ['Mosteiro de Santa Cruz', 'Mosteiro_de_Santa_Cruz_(Coimbra)'],
      ['Mosteiro de Santa Clara-a-Velha', 'Mosteiro_de_Santa_Clara-a-Velha'],
    ], poi: ['Portugal dos Pequenitos', 'Conímbriga (ruínas romanas)', 'Penedo da Saudade'] },
    evora: { mon: [
      ['Templo Romano de Évora', 'Templo_romano_de_Évora'], ['Sé de Évora', 'Sé_de_Évora'],
      ['Capela dos Ossos', 'Capela_dos_Ossos_(Évora)'], ['Cromeleque dos Almendres', 'Cromeleque_dos_Almendres'],
      ['Aqueduto da Água de Prata', 'Aqueduto_da_Água_de_Prata'],
    ], poi: ['Universidade de Évora', 'Praça do Giraldo', 'Anta Grande do Zambujeiro'] },
    faro: { mon: [
      ['Sé de Faro', 'Sé_de_Faro'], ['Castelo de Silves', 'Castelo_de_Silves'],
      ['Fortaleza de Sagres', 'Fortaleza_de_Sagres'], ['Cabo de São Vicente', 'Cabo_de_São_Vicente'],
    ], poi: ['Ria Formosa', 'Praia da Marinha', 'Ponta da Piedade (Lagos)', 'Grutas de Benagil'] },
    guarda: { mon: [
      ['Sé da Guarda', 'Sé_da_Guarda'], ['Castelo de Belmonte', 'Castelo_de_Belmonte'],
      ['Aldeia Histórica de Sortelha', 'Sortelha'], ['Torre de Menagem da Guarda', 'Castelo_da_Guarda'],
    ], poi: ['Serra da Estrela (Torre)', 'Museu Judaico de Belmonte', 'Aldeia de Linhares da Beira'] },
    leiria: { mon: [
      ['Castelo de Leiria', 'Castelo_de_Leiria'], ['Mosteiro de Alcobaça', 'Mosteiro_de_Alcobaça'],
      ['Mosteiro da Batalha', 'Mosteiro_da_Batalha'], ['Santuário de Fátima', 'Santuário_de_Fátima'],
      ['Castelo de Óbidos', 'Castelo_de_Óbidos'],
    ], poi: ['Praia da Nazaré (Canhão)', 'Vila medieval de Óbidos', 'Grutas de Mira de Aire'] },
    lisboa: { mon: [
      ['Torre de Belém', 'Torre_de_Belém'], ['Mosteiro dos Jerónimos', 'Mosteiro_dos_Jerónimos'],
      ['Castelo de São Jorge', 'Castelo_de_São_Jorge'], ['Sé de Lisboa', 'Sé_de_Lisboa'],
      ['Padrão dos Descobrimentos', 'Padrão_dos_Descobrimentos'], ['Palácio Nacional de Sintra', 'Palácio_Nacional_de_Sintra'],
    ], poi: ['Palácio da Pena (Sintra)', 'Praça do Comércio', 'Cabo da Roca', 'Elétrico 28'] },
    portalegre: { mon: [
      ['Sé de Portalegre', 'Sé_de_Portalegre'], ['Castelo de Marvão', 'Castelo_de_Marvão'],
      ['Castelo de Castelo de Vide', 'Castelo_de_Vide'], ['Castelo de Arronches', 'Castelo_de_Arronches'],
    ], poi: ['Aldeia de Marvão', 'Judiaria de Castelo de Vide', 'Serra de São Mamede'] },
    porto: { mon: [
      ['Torre dos Clérigos', 'Torre_dos_Clérigos'], ['Sé do Porto', 'Sé_do_Porto'],
      ['Palácio da Bolsa', 'Palácio_da_Bolsa'], ['Igreja de São Francisco', 'Igreja_de_São_Francisco_(Porto)'],
      ['Ponte Luís I', 'Ponte_Luís_I'], ['Livraria Lello', 'Livraria_Lello'],
    ], poi: ['Ribeira do Porto', 'Caves do Vinho do Porto (Gaia)', 'Fundação de Serralves', 'Mercado do Bolhão'] },
    santarem: { mon: [
      ['Convento de Cristo (Tomar)', 'Convento_de_Cristo'], ['Castelo de Almourol', 'Castelo_de_Almourol'],
      ['Igreja da Graça (Santarém)', 'Igreja_da_Graça_(Santarém)'], ['Castelo de Torres Novas', 'Castelo_de_Torres_Novas'],
    ], poi: ['Portas do Sol', 'Aqueduto dos Pegões (Tomar)', 'Mata Nacional dos Sete Montes'] },
    setubal: { mon: [
      ['Castelo de Palmela', 'Castelo_de_Palmela'], ['Convento de Jesus (Setúbal)', 'Convento_de_Jesus_(Setúbal)'],
      ['Forte de São Filipe', 'Forte_de_São_Filipe_(Setúbal)'], ['Santuário do Cabo Espichel', 'Cabo_Espichel'],
    ], poi: ['Serra da Arrábida', 'Praia de Galápos', 'Reserva Natural do Estuário do Sado'] },
    'viana-do-castelo': { mon: [
      ['Santuário de Santa Luzia', 'Santuário_de_Santa_Luzia'], ['Castelo de Santiago da Barra', 'Castelo_de_Santiago_da_Barra'],
      ['Citânia de Santa Luzia', 'Citânia_de_Santa_Luzia'], ['Ponte Medieval de Ponte de Lima', 'Ponte_de_Lima'],
    ], poi: ['Monte de Santa Luzia', 'Praia do Cabedelo', 'Parque Nacional Peneda-Gerês'] },
    'vila-real': { mon: [
      ['Solar de Mateus', 'Casa_de_Mateus'], ['Santuário de Panóias', 'Santuário_de_Panóias'],
      ['Castelo de Montalegre', 'Castelo_de_Montalegre'], ['Termas de Vidago (Vidago Palace)', 'Vidago_Palace_Hotel'],
    ], poi: ['Parque Natural do Alvão', 'Reserva da Biosfera de Barroso', 'Vinhas do Douro (Mesão Frio)'] },
    viseu: { mon: [
      ['Sé de Viseu', 'Sé_de_Viseu'], ['Museu Grão Vasco', 'Museu_Grão_Vasco'],
      ['Santuário dos Remédios (Lamego)', 'Santuário_de_Nossa_Senhora_dos_Remédios'], ['Cava de Viriato', 'Cava_de_Viriato'],
    ], poi: ['Centro Histórico de Viseu', 'Caves da Raposeira (Lamego)', 'Serra do Caramulo'] },
    madeira: { mon: [
      ['Sé do Funchal', 'Sé_do_Funchal'], ['Fortaleza de São Tiago', 'Forte_de_São_Tiago_(Funchal)'],
      ['Igreja de Nossa Senhora do Monte', 'Igreja_de_Nossa_Senhora_do_Monte'], ['Cabo Girão', 'Cabo_Girão'],
    ], poi: ['Mercado dos Lavradores', 'Levadas da Madeira', 'Pico do Areeiro', 'Porto Moniz'] },
    acores: { mon: [
      ['Forte de São Brás', 'Forte_de_São_Brás'], ['Convento e Igreja de São Francisco (Ponta Delgada)', 'Convento_de_São_Francisco_(Ponta_Delgada)'],
      ['Paisagem da Vinha do Pico (UNESCO)', 'Paisagem_da_cultura_da_vinha_da_Ilha_do_Pico'], ['Igreja de São Sebastião', 'Igreja_Matriz_de_São_Sebastião_(Ponta_Delgada)'],
    ], poi: ['Lagoa das Sete Cidades', 'Furnas (caldeiras)', 'Montanha do Pico', 'Algar do Carvão'] },
  };

  function _wikiPt(title) { return `https://pt.wikipedia.org/wiki/${encodeURIComponent(title)}`; }

  /* ── State ── */
  let _map       = null;
  let _inited    = false;
  let _markers   = [];
  let _capitalMarkers = [];
  let _geoLayer  = null;
  let _selected  = null;
  let _container = null;
  let _baseTile  = null;
  let _baseStyle = 'standard';
  /* ── Concelho (municipality) drilldown ── */
  let _concelhoData   = null;   /* parsed pt-concelhos.geojson FeatureCollection */
  let _concelhoLayer  = null;   /* Leaflet layer for the active district's concelhos */
  let _concelhoSel    = null;   /* selected concelho feature */
  let _concelhoLoading = false;

  /* ── District boundaries (bundled locally, simplified) — property "name"
     matches the district names in DISTRICTS exactly. ── */
  const PT_GEOJSON = 'data/pt-districts.geojson';
  const PT_CONCELHOS = 'data/pt-concelhos.geojson';

  /* District capitals — used to flag the capital concelho with extra context.
     Authentic, hand-checked; everything else uses the official CAOP stats only. */
  const CAPITAL_IDS = {
    aveiro:'Aveiro', beja:'Beja', braga:'Braga', braganca:'Braganca', 'castelo-branco':'Castelo Branco',
    coimbra:'Coimbra', evora:'Evora', faro:'Faro', guarda:'Guarda', leiria:'Leiria', lisboa:'Lisboa',
    portalegre:'Portalegre', porto:'Porto', santarem:'Santarem', setubal:'Setubal',
    'viana-do-castelo':'Viana Do Castelo', 'vila-real':'Vila Real', viseu:'Viseu',
  };

  /* ── Leaflet lazy load ── */
  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = Object.assign(document.createElement('link'),
          { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
        document.head.appendChild(link);
      }
      const s = Object.assign(document.createElement('script'),
        { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function _isDark() { return !document.body.classList.contains('light'); }

  /* Selectable basemap styles (atlas-style detail: roads, places, terrain). */
  const PT_BASEMAPS = {
    standard:  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', sub: 'abcd', attr: '© OpenStreetMap © CARTO' },
    dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png',          sub: 'abcd', attr: '© OpenStreetMap © CARTO' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', sub: '', attr: '© Esri, Maxar' },
    terrain:   { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',  sub: '', attr: '© Esri' },
  };

  function _setBasemap(style) {
    if (!_map || !PT_BASEMAPS[style]) return;
    _baseStyle = style;
    try { localStorage.setItem('pt-basemap', style); } catch (e) {}
    if (_baseTile) { _map.removeLayer(_baseTile); _baseTile = null; }
    const b = PT_BASEMAPS[style];
    _baseTile = L.tileLayer(b.url, { attribution: b.attr, subdomains: b.sub, maxZoom: 18 }).addTo(_map);
    _baseTile.bringToBack();
    const el = document.getElementById('pt-leaflet-map');
    if (el) el.classList.toggle('pt-sat', style === 'satellite');
    document.querySelectorAll('.pt-basemap-btn').forEach(x => {
      const on = x.dataset.base === style;
      x.classList.toggle('active', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    _onZoom(); // refresh capital-label visibility for the new style
  }

  /* ── Mount ── */
  async function mount(container) {
    _container = container;
    container.innerHTML = `
      <div class="pt-explorer-wrap">
        <div class="pt-map-area" id="pt-map-area">
          <div id="pt-leaflet-map"></div>
          <div class="pt-basemap-bar" id="pt-basemap-bar" role="group" aria-label="Estilo do mapa">
            <button class="pt-basemap-btn active" data-base="standard" aria-pressed="true">Político</button>
            <button class="pt-basemap-btn" data-base="terrain" aria-pressed="false">Relevo</button>
            <button class="pt-basemap-btn" data-base="satellite" aria-pressed="false">Satélite</button>
            <button class="pt-basemap-btn" data-base="dark" aria-pressed="false">Escuro</button>
          </div>
          <div class="pt-loading" id="pt-loading">
            <div class="pt-loading-spinner"></div>
            <div class="pt-loading-txt">A carregar mapa de Portugal…</div>
          </div>
        </div>

        <div class="pt-sidebar" id="pt-sidebar">
          <div class="pt-sidebar-header">
            <div class="pt-sidebar-title">
              <span class="pt-sidebar-flag">🇵🇹</span>
              <span>Explorar Portugal</span>
            </div>
            <div class="pt-search-bar">
              <input class="pt-search-input" id="pt-search" type="text" placeholder="Pesquisar distrito…" autocomplete="off" aria-label="Pesquisar distrito"/>
              <button class="pt-discover-btn" id="pt-discover" title="Descobrir distrito aleatório" aria-label="Descobrir distrito aleatório">🎲</button>
            </div>
          </div>

          <div class="pt-district-list" id="pt-district-list">
            ${DISTRICTS.map(d => `
              <button class="pt-district-chip" data-id="${d.id}">
                <span class="pt-dc-emoji">${d.emoji}</span>
                <span class="pt-dc-name">${d.name}</span>
                <span class="pt-dc-region">${d.region}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="pt-info-panel" id="pt-info-panel" role="region" aria-label="Informação do distrito" tabindex="-1">
          <button class="pt-info-close" id="pt-info-close" aria-label="Fechar painel">✕</button>
          <div class="pt-info-content" id="pt-info-content"></div>
        </div>
      </div>`;

    await _loadLeaflet();
    _initMap(container);
    _wireSearch(container);
    _wireSidebar(container);
    container.querySelectorAll('.pt-basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => _setBasemap(btn.dataset.base));
    });
    document.getElementById('pt-loading')?.remove();
    _inited = true;
  }

  function resume() {
    setTimeout(() => _map?.invalidateSize(), 80);
  }

  function stop() {}

  /* ── Map init ── */
  function _initMap(container) {
    const el = container.querySelector('#pt-leaflet-map');
    if (!el) return;

    _map = L.map(el, {
      center: [39.6, -8.0], zoom: 7, minZoom: 6, maxZoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(_map);
    /* Restore saved style; default to the detailed political map (atlas feel). */
    let _savedBase; try { _savedBase = localStorage.getItem('pt-basemap'); } catch (e) {}
    _setBasemap((_savedBase && PT_BASEMAPS[_savedBase]) ? _savedBase : 'standard');

    _addDistrictMarkers();
    _addCapitalLabels();

    /* As the user zooms in, fade the district fills so the underlying roads,
       labels and terrain stay readable (was a fixed, heavy overlay). */
    _map.on('zoomend', _onZoom);

    /* Try loading GeoJSON boundaries */
    _tryLoadGeoJSON();
  }

  /* District fill opacity — deliberately light so the basemap (roads, cities,
     terrain, coastlines) stays readable. The selection is conveyed mainly by a
     coloured border, not a solid block (think "Google Maps selected area"). */
  function _fillFor(selected) {
    const z = _map ? _map.getZoom() : 7;
    if (selected) return z >= 10 ? 0.12 : z >= 8 ? 0.20 : 0.28;
    return z >= 10 ? 0.02 : z >= 8 ? 0.05 : 0.08;
  }

  function _onZoom() {
    if (!_geoLayer) return;
    _geoLayer.eachLayer(layer => {
      const props = layer.feature?.properties || {};
      const d = _findDistrict(Object.values(props).find(v => typeof v === 'string'));
      layer.setStyle({ fillOpacity: _fillFor(d === _selected) });
    });
    /* Capital labels only on satellite imagery (no built-in labels there);
       every other basemap already prints place names, so showing our own would
       duplicate them. Also gated by zoom to stay useful and uncluttered. */
    const showCaps = _map.getZoom() >= 8 && _baseStyle === 'satellite';
    _capitalMarkers.forEach(m => {
      const el = m.getElement();
      if (el) el.style.display = showCaps ? '' : 'none';
    });
  }

  /* Permanent capital labels (real coordinates from district data — no fabrication). */
  function _addCapitalLabels() {
    DISTRICTS.forEach(d => {
      const m = L.marker([d.lat, d.lon], {
        interactive: false, keyboard: false,
        icon: L.divIcon({
          className: 'pt-capital-label',
          html: `<span class="pt-cap-dot"></span><span class="pt-cap-name">${d.capital}</span>`,
          iconSize: [0, 0],
        }),
      }).addTo(_map);
      const el = m.getElement(); if (el) el.style.display = 'none';
      _capitalMarkers.push(m);
    });
  }

  function _addDistrictMarkers() {
    DISTRICTS.forEach(d => {
      const m = L.circleMarker([d.lat, d.lon], {
        radius: _markerRadius(d),
        fillColor: d.color,
        color: d.color,
        weight: 2,
        opacity: 0.85,
        fillOpacity: 0.35,
      }).addTo(_map);
      m.bindTooltip(d.name, { permanent: false, direction: 'top', offset: [0, -8] });
      m.on('click', () => _select(d));
      _markers.push({ dist: d, marker: m });
    });
  }

  function _markerRadius(d) {
    const base = Math.sqrt(d.pop / 1000);
    return Math.max(8, Math.min(28, base));
  }

  async function _tryLoadGeoJSON() {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(PT_GEOJSON, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) return;
      const gj = await r.json();

      /* Find which property has district names */
      const sample = gj.features?.[0]?.properties || {};
      const nameKey = ['name','NAME_1','Dico','DICO','Distrito','distrito','NME','NOME','Desig'].find(k => k in sample);
      if (!nameKey) return;

      _geoLayer = L.geoJSON(gj, {
        style(feature) {
          const d = _findDistrict(feature.properties[nameKey]);
          const base = d ? d.color : '#6366f1';
          return {
            fillColor: base,
            color: _isDark() ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)',
            weight: 1.2,
            fillOpacity: _fillFor(d === _selected),
          };
        },
        onEachFeature(feature, layer) {
          const rawName = feature.properties[nameKey];
          const d = _findDistrict(rawName);
          if (!d) return;
          layer.bindTooltip(d.name, { sticky: true, direction: 'top', className: 'pt-geo-tooltip' });
          layer.on({
            mouseover(e) {
              if (d !== _selected) {
                e.target.setStyle({ fillOpacity: 0.38, weight: 2 });
                e.target.bringToFront();
              }
            },
            mouseout(e) {
              if (d !== _selected) _geoLayer?.resetStyle(e.target);
            },
            click() { _select(d); },
          });
        },
      }).addTo(_map);

      /* Once GeoJSON loads, shrink circle markers to small accent dots */
      _markers.forEach(({ marker }) => {
        marker.setStyle({ radius: 5, fillOpacity: 0.6, weight: 1 });
        marker.bringToFront();
      });

    } catch (e) {
      /* Silently fail — markers remain the interactive fallback */
    }
  }

  function _normalizeStr(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function _findDistrict(name) {
    const n = _normalizeStr(name);
    return DISTRICTS.find(d => _normalizeStr(d.name) === n) || null;
  }

  /* ── Selection ── */
  function _select(d) {
    _selected = d;
    _clearConcelhos();   /* leaving any previous district's drilldown */

    /* Highlight / reset circle markers */
    const hasGeo = !!_geoLayer;
    _markers.forEach(({ dist, marker }) => {
      if (hasGeo) {
        /* GeoJSON loaded — markers are small accent dots */
        marker.setStyle({
          radius:      dist === d ? 8 : 5,
          fillOpacity: dist === d ? 1 : 0.6,
          weight:      dist === d ? 2 : 1,
        });
      } else {
        marker.setStyle({
          fillOpacity: dist === d ? 0.75 : 0.35,
          weight:      dist === d ? 3    : 2,
          radius:      dist === d ? _markerRadius(dist) + 4 : _markerRadius(dist),
        });
      }
    });

    /* Re-style GeoJSON polygons; capture the selected layer for fit-to-bounds. */
    let selLayer = null;
    if (_geoLayer) {
      _geoLayer.eachLayer(layer => {
        const props = layer.feature?.properties || {};
        const fd = _findDistrict(Object.values(props).find(v => typeof v === 'string'));
        const isSelected = fd === d;
        const base = fd ? fd.color : '#6366f1';
        layer.setStyle({
          fillColor: base,
          fillOpacity: _fillFor(isSelected),
          /* Selected = bright coloured outline; others = subtle hairline. */
          color: isSelected ? base : (_isDark() ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)'),
          weight: isSelected ? 3 : 1.2,
          opacity: isSelected ? 0.95 : 0.6,
        });
        if (isSelected) { selLayer = layer; layer.bringToFront(); }
      });
    }

    /* Render + open the info panel (third grid column on desktop, bottom sheet
       on mobile). Opening resizes the map area, so invalidate + fit after. */
    _renderInfo(d);
    const wrap = _container?.querySelector('.pt-explorer-wrap');
    wrap?.classList.add('pt-info-open');
    _fitDistrict(d, selLayer);
    setTimeout(() => { try { _map?.invalidateSize(); _fitDistrict(d, selLayer); } catch (e) {} }, 340);

    /* Highlight list item */
    document.querySelectorAll('.pt-district-chip').forEach(c => {
      const on = c.dataset.id === d.id;
      c.classList.toggle('active', on);
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
  }

  /* Close the info panel (shared by the ✕ button and the Escape key). */
  function _closePanel() {
    const wrap = _container?.querySelector('.pt-explorer-wrap');
    if (!wrap || !wrap.classList.contains('pt-info-open')) return;
    wrap.classList.remove('pt-info-open');
    _clearConcelhos();
    _selected = null;
    _markers.forEach(({ dist, marker }) => {
      marker.setStyle({ fillOpacity: 0.35, weight: 2, radius: _markerRadius(dist) });
    });
    document.querySelectorAll('.pt-district-chip').forEach(c => { c.classList.remove('active'); c.removeAttribute('aria-current'); });
    setTimeout(() => { try { _map?.invalidateSize(); } catch (e) {} }, 340);
  }

  /* Auto-zoom to fit the selected district's bounds (smooth, capped so it
     never zooms in excessively); falls back to a centred view. */
  function _fitDistrict(d, layer) {
    if (!_map) return;
    try {
      const sz = _map.getSize();
      if (sz.x <= 0 || sz.y <= 0) { _map.setView([d.lat, d.lon], 9); return; }
      if (layer && layer.getBounds && layer.getBounds().isValid()) {
        _map.flyToBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 11, duration: 0.8 });
      } else {
        _map.flyTo([d.lat, d.lon], 9, { duration: 0.8 });
      }
    } catch (e) { try { _map.setView([d.lat, d.lon], 9); } catch (e2) {} }
  }

  /* ════════════════════ CONCELHO (MUNICIPALITY) DRILLDOWN ════════════════════ */

  /* Lazy-load the bundled concelhos GeoJSON once. */
  async function _loadConcelhos() {
    if (_concelhoData || _concelhoLoading) return _concelhoData;
    _concelhoLoading = true;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(PT_CONCELHOS, { signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok) _concelhoData = await r.json();
    } catch (e) { /* drilldown unavailable — district view still works */ }
    _concelhoLoading = false;
    return _concelhoData;
  }

  function _clearConcelhos() {
    if (_concelhoLayer) { _concelhoLayer.remove(); _concelhoLayer = null; }
    _concelhoSel = null;
  }

  /* Draw the clickable concelhos for the active district on top of the map. */
  async function _showConcelhos(d) {
    await _loadConcelhos();
    if (!_concelhoData || !_map || _selected !== d) return;
    _clearConcelhos();

    const feats = _concelhoData.features.filter(f => f.properties.d === d.id);
    if (!feats.length) return;

    _concelhoLayer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
      style: () => ({
        fillColor: d.color,
        color: _isDark() ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)',
        weight: 1,
        fillOpacity: 0.12,
      }),
      onEachFeature(feature, layer) {
        const name = feature.properties.c;
        layer.bindTooltip(name, { sticky: true, direction: 'top', className: 'pt-geo-tooltip' });
        layer.on({
          mouseover(e) { if (feature !== _concelhoSel) { e.target.setStyle({ fillOpacity: 0.32, weight: 1.6 }); e.target.bringToFront(); } },
          mouseout(e)  { if (feature !== _concelhoSel) _concelhoLayer?.resetStyle(e.target); },
          click(e) { L.DomEvent.stopPropagation(e); _selectConcelho(feature, layer, d); },
        });
      },
    }).addTo(_map);

    /* Fade the district outline so concelhos read clearly. */
    if (_concelhoLayer.getBounds && _concelhoLayer.getBounds().isValid()) {
      _map.flyToBounds(_concelhoLayer.getBounds(), { padding: [30, 30], maxZoom: 11, duration: 0.7 });
    }
  }

  function _selectConcelho(feature, layer, d) {
    _concelhoSel = feature;
    if (_concelhoLayer) {
      _concelhoLayer.eachLayer(l => {
        const on = l.feature === feature;
        l.setStyle({ fillOpacity: on ? 0.5 : 0.12, weight: on ? 2.4 : 1, color: on ? d.color : (_isDark() ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)') });
        if (on) l.bringToFront();
      });
    }
    try {
      if (layer.getBounds && layer.getBounds().isValid()) _map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 12, duration: 0.7 });
    } catch (e) {}
    _renderConcelhoInfo(feature, d);
    _container?.querySelector('.pt-explorer-wrap')?.classList.add('pt-info-open');
    setTimeout(() => { try { _map?.invalidateSize(); } catch (e) {} }, 320);
  }

  /* ── Info panel ── */
  function _renderInfo(d) {
    const el = document.getElementById('pt-info-content');
    if (!el) return;

    const pop  = (d.pop || 0).toLocaleString('pt');
    const area = (d.area || 0).toLocaleString('pt') + ' km²';
    const density = (d.pop && d.area)
      ? Math.round(d.pop / d.area).toLocaleString('pt') + ' hab/km²' : '—';
    const extra = DISTRICT_MON[d.id] || {};
    /* Merge curated landmarks with the extra points of interest (de-duped). */
    const pois = [...(d.landmarks || []), ...((extra.poi || []).filter(p => !(d.landmarks || []).includes(p)))];

    el.innerHTML = `
      <div class="pt-info-hero" style="--dist-color:${d.color}">
        <div class="pt-info-emoji">${d.emoji}</div>
        <div class="pt-info-title-group">
          <div class="pt-info-name">${d.name}</div>
          <div class="pt-info-tagline">${d.tagline}</div>
        </div>
      </div>

      <div class="pt-info-stats">
        <div class="pt-info-stat"><span class="pt-stat-val">${pop}</span><span class="pt-stat-lbl">habitantes</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${area}</span><span class="pt-stat-lbl">área</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${d.munic}</span><span class="pt-stat-lbl">concelhos</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${d.region}</span><span class="pt-stat-lbl">região</span></div>
      </div>

      <div class="pt-info-rows">
        <div class="pt-info-row"><span class="pt-row-icon">🏙</span><span class="pt-row-lbl">Capital</span><span class="pt-row-val">${d.capital}</span></div>
        <div class="pt-info-row"><span class="pt-row-icon">👣</span><span class="pt-row-lbl">Densidade</span><span class="pt-row-val">${density}</span></div>
        <div class="pt-info-row"><span class="pt-row-icon">🌍</span><span class="pt-row-lbl">NUTS II</span><span class="pt-row-val">${d.nuts2}</span></div>
      </div>

      <button class="pt-drill-btn" id="pt-drill" data-id="${d.id}">🔎 Explorar concelhos (${d.munic})</button>

      ${extra.mon && extra.mon.length ? `
      <div class="pt-info-section">
        <div class="pt-section-title">🏛 Monumentos Históricos</div>
        <div class="pt-links-wrap">
          ${extra.mon.map(m => `<a class="pt-mon-link" href="${_wikiPt(m[1])}" target="_blank" rel="noopener">${m[0]} ↗</a>`).join('')}
        </div>
      </div>` : ''}

      <div class="pt-info-section">
        <div class="pt-section-title">📍 Pontos de Interesse</div>
        <div class="pt-tags-wrap">${pois.map(l => `<span class="pt-tag">${l}</span>`).join('')}</div>
      </div>

      <div class="pt-info-section">
        <div class="pt-section-title">🍽 Gastronomia</div>
        <div class="pt-tags-wrap">${(d.food || []).map(f => `<span class="pt-tag food">${f}</span>`).join('')}</div>
      </div>

      <div class="pt-info-section">
        <div class="pt-section-title">🎉 Tradições</div>
        <div class="pt-tags-wrap">${(d.traditions || []).map(t => `<span class="pt-tag trad">${t}</span>`).join('')}</div>
      </div>

      <div class="pt-info-section">
        <div class="pt-section-title">📖 História</div>
        <p class="pt-history-text">${d.history}</p>
      </div>

      <div class="pt-info-section">
        <div class="pt-section-title">💡 Sabia que…</div>
        <div class="pt-facts-list">
          ${(d.facts || []).map(f => `<div class="pt-fact-item">• ${f}</div>`).join('')}
        </div>
      </div>`;

    el.querySelector('#pt-drill')?.addEventListener('click', () => _showConcelhos(d));
  }

  /* Concelho info panel — uses ONLY authentic CAOP figures (freguesias, area,
     max altitude) plus a Wikipedia link. No invented cultural data per concelho. */
  function _renderConcelhoInfo(feature, d) {
    const el = document.getElementById('pt-info-content');
    if (!el) return;
    const p = feature.properties;
    const areaKm = p.ha ? (p.ha / 100).toLocaleString('pt', { maximumFractionDigits: 1 }) + ' km²' : '—';
    const isCapital = CAPITAL_IDS[d.id] && _normalizeStr(CAPITAL_IDS[d.id]) === _normalizeStr(p.c);
    const wiki = `https://pt.wikipedia.org/wiki/${encodeURIComponent(p.c.replace(/ /g, '_'))}`;
    /* Curated local info (no API call). Null when this concelho isn't covered. */
    const info = (typeof PT_CONCELHO_INFO !== 'undefined') ? PT_CONCELHO_INFO.get(p.c) : null;

    el.innerHTML = `
      <button class="pt-back-btn" id="pt-back">← ${d.name}</button>
      <div class="pt-info-hero" style="--dist-color:${d.color}">
        <div class="pt-info-emoji">${isCapital ? '⭐' : '🏘'}</div>
        <div class="pt-info-title-group">
          <div class="pt-info-name">${p.c}</div>
          <div class="pt-info-tagline">${isCapital ? `Capital de distrito · ${d.name}` : `Concelho · distrito de ${d.name}`}</div>
        </div>
      </div>

      <div class="pt-info-stats">
        <div class="pt-info-stat"><span class="pt-stat-val">${p.nf ?? '—'}</span><span class="pt-stat-lbl">freguesias</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${areaKm}</span><span class="pt-stat-lbl">área</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${p.am ? p.am + ' m' : '—'}</span><span class="pt-stat-lbl">altitude máx.</span></div>
        <div class="pt-info-stat"><span class="pt-stat-val">${d.name}</span><span class="pt-stat-lbl">distrito</span></div>
      </div>

      ${info ? `
        <div class="pt-info-section">
          <div class="pt-section-title">📖 História</div>
          <p class="pt-history-text">${info.hist}</p>
        </div>
        ${info.poi && info.poi.length ? `
        <div class="pt-info-section">
          <div class="pt-section-title">📍 Pontos de Interesse</div>
          <div class="pt-tags-wrap">${info.poi.map(x => `<span class="pt-tag">${x}</span>`).join('')}</div>
        </div>` : ''}
        ${info.food && info.food.length ? `
        <div class="pt-info-section">
          <div class="pt-section-title">🍽 Gastronomia</div>
          <div class="pt-tags-wrap">${info.food.map(x => `<span class="pt-tag food">${x}</span>`).join('')}</div>
        </div>` : ''}
        ${info.trad && info.trad.length ? `
        <div class="pt-info-section">
          <div class="pt-section-title">🎉 Tradições</div>
          <div class="pt-tags-wrap">${info.trad.map(x => `<span class="pt-tag trad">${x}</span>`).join('')}</div>
        </div>` : ''}
        <div class="pt-info-section">
          <div class="pt-section-title">🔗 Saber mais</div>
          <a class="pt-wiki-link" href="${wiki}" target="_blank" rel="noopener">Wikipédia: ${p.c} ↗</a>
        </div>`
      : `
        <div class="pt-info-section">
          <div class="pt-section-title">📖 Sobre o concelho</div>
          <p class="pt-history-text">${p.c} é um concelho do distrito de ${d.name}, na região ${d.region}.${isCapital ? ` É a capital do distrito.` : ''} Os dados oficiais (freguesias, área e altitude) são da Carta Administrativa Oficial de Portugal (CAOP, Direção-Geral do Território).</p>
        </div>
        <div class="pt-info-section">
          <div class="pt-section-title">🔗 Saber mais</div>
          <a class="pt-wiki-link" href="${wiki}" target="_blank" rel="noopener">Wikipédia: ${p.c} ↗</a>
        </div>
        <div class="pt-info-note">Informação cultural detalhada para este concelho ainda não está disponível — vê o nível do distrito de <strong>${d.name}</strong> em “← ${d.name}”.</div>`}`;

    el.querySelector('#pt-back')?.addEventListener('click', () => _backToDistrict(d));
  }

  /* Return from a concelho to its parent district view. */
  function _backToDistrict(d) {
    _concelhoSel = null;
    if (_concelhoLayer) {
      _concelhoLayer.eachLayer(l => l.setStyle({ fillOpacity: 0.12, weight: 1, color: _isDark() ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)' }));
    }
    _renderInfo(d);
    if (_concelhoLayer && _concelhoLayer.getBounds && _concelhoLayer.getBounds().isValid()) {
      _map.flyToBounds(_concelhoLayer.getBounds(), { padding: [30, 30], maxZoom: 11, duration: 0.6 });
    }
  }

  /* ── Search + controls ── */
  function _wireSearch(container) {
    const input = container.querySelector('#pt-search');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = _normalizeStr(input.value);
      container.querySelectorAll('.pt-district-chip').forEach(c => {
        const name = _normalizeStr(c.querySelector('.pt-dc-name')?.textContent || '');
        c.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });

    container.querySelector('#pt-discover')?.addEventListener('click', () => {
      const d = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)];
      _select(d);
    });

    container.querySelector('#pt-info-close')?.addEventListener('click', _closePanel);

    /* Escape closes the open info panel (bind once, even across re-mounts). */
    if (!_ptEscBound) {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && _container && _container.offsetParent !== null) _closePanel();
      });
      _ptEscBound = true;
    }
  }
  let _ptEscBound = false;

  function _wireSidebar(container) {
    container.querySelectorAll('.pt-district-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const d = DISTRICTS.find(x => x.id === chip.dataset.id);
        if (d) _select(d);
      });
    });
  }

  /* ── Public discover ── */
  function discoverRandom() {
    const d = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)];
    _select(d);
    return d.name;
  }

  return { mount, resume, stop, discoverRandom };
})();
