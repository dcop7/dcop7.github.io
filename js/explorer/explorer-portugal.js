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

  /* ══════════════════════════════════════════════════════════════════
     INTERFACE (redesenho out/2026)
     ──────────────────────────────────────────────────────────────────
     Mapa temático: os distritos (ou os 278 concelhos) pintados pela
     métrica escolhida — população, densidade, idosos, jovens, área,
     altitude ou simplesmente a região — com legenda, ranking lateral e
     um painel com separadores (Resumo · Concelhos · Cultura).

     Dados: Censos 2021 do INE por concelho (data/pt-concelhos-stats.json,
     gerado por tools/pt/build-concelhos-stats.mjs) + CAOP (área,
     freguesias, altitude) no próprio GeoJSON. Os totais de distrito são
     somas dos concelhos, por isso batem sempre certo com o mapa.
     A Wikipédia (resumo + foto) é pedida ao vivo, só ao abrir um painel.
     ══════════════════════════════════════════════════════════════════ */
  const PT_GEOJSON = 'data/pt-districts.geojson';
  const PT_CONCELHOS = 'data/pt-concelhos.geojson';
  const PT_STATS = 'data/pt-concelhos-stats.json';
  const ISLANDS = new Set(['madeira', 'acores']);
  const ISLAND_BOUNDS = { acores: [[36.9, -31.3], [39.75, -24.95]], madeira: [[32.6, -17.3], [33.12, -16.25]] };

  const REGION = {
    Norte:    { name: 'Norte',    col: '#3b82f6' },
    Centro:   { name: 'Centro',   col: '#22c55e' },
    AML:      { name: 'Área Metropolitana de Lisboa', col: '#f43f5e' },
    Alentejo: { name: 'Alentejo', col: '#f59e0b' },
    Algarve:  { name: 'Algarve',  col: '#06b6d4' },
    RAA:      { name: 'Açores',   col: '#8b5cf6' },
    RAM:      { name: 'Madeira',  col: '#ec4899' },
  };

  const nf0 = n => Math.round(n).toLocaleString('pt-PT');
  const nf1 = n => n.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const METRICS = {
    district: { label: 'Cores', kind: 'cat' },
    region:   { label: 'Regiões',   kind: 'cat' },
    pop:      { label: 'População', kind: 'seq', fmt: nf0, unit: ' hab.', rank: 'mais populoso', desc: 'Residentes nos Censos 2021' },
    dens:     { label: 'Densidade', kind: 'seq', fmt: nf0, unit: ' hab/km²', rank: 'mais denso', desc: 'Habitantes por km²' },
    old:      { label: 'Idosos',    kind: 'seq', fmt: nf1, unit: '%', rank: 'mais envelhecido', desc: 'Percentagem com 65 ou mais anos' },
    young:    { label: 'Jovens',    kind: 'seq', fmt: nf1, unit: '%', rank: 'mais jovem', desc: 'Percentagem com menos de 15 anos' },
    area:     { label: 'Área',      kind: 'seq', fmt: nf0, unit: ' km²', rank: 'maior', desc: 'Área total' },
    alt:      { label: 'Altitude',  kind: 'seq', fmt: nf0, unit: ' m', rank: 'mais alto', desc: 'Ponto mais alto' },
  };
  /* rampa sequencial (azul-noite → amarelo), legível nos dois temas */
  const RAMP = ['#1d3b6a', '#1e5f8f', '#178aa3', '#2fb09a', '#7fcf73', '#e7e163'];

  /* ── estado ── */
  let _map = null, _container = null, _wrap = null;
  let _base = null, _baseStyle = 'clean';
  let _distLayer = null, _concLayer = null, _labelLayer = null, _islandMarkers = [];
  let _concData = null, _stats = null;
  let _dRec = {}, _cRecs = [], _nat = null;
  let _level = 'district', _metric = 'district';
  let _selected = null, _selConc = null, _tab = 'resumo', _concSort = 'pop';
  let _themeObs = null;
  try {
    _baseStyle = localStorage.getItem('pt-basemap2') || 'clean';
    _metric = localStorage.getItem('pt-metric') || 'district';
    if (!METRICS[_metric]) _metric = 'district';
  } catch (e) {}

  const _norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* o GeoJSON traz "Vila Nova De Gaia" — em português as partículas ficam em minúscula */
  const _ptName = s => s.replace(/ (Da|De|Do|Das|Dos|E)(?= )/g, m => m.toLowerCase());
  const _isDark = () => !document.body.classList.contains('light');
  const D = id => DISTRICTS.find(d => d.id === id);
  function _findDistrict(name) { const n = _norm(name); return DISTRICTS.find(d => _norm(d.name) === n) || null; }

  /* ── Leaflet (lazy) ── */
  async function _loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' }));
      }
      const s = Object.assign(document.createElement('script'), { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function _json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); }

  /* ── registos (distrito e concelho) com todas as métricas ── */
  function _buildRecords() {
    const st = (_stats && _stats.c) || {};
    _cRecs = _concData.features.map(f => {
      const p = f.properties, k = p.d + '|' + _norm(p.c), s = st[k] || [];
      const area = (p.ha || 0) / 100;
      return { kind: 'c', f, name: _ptName(p.c), d: p.d, nf: p.nf, area, alt: p.am, pop: s[0] || null,
        young: s[1] ?? null, old: s[2] ?? null, dens: s[0] && area ? s[0] / area : null };
    });
    const agg = {};
    for (const c of _cRecs) {
      const a = agg[c.d] = agg[c.d] || { pop: 0, area: 0, y: 0, o: 0, n: 0, alt: 0 };
      a.pop += c.pop || 0; a.area += c.area; a.y += (c.young || 0) * (c.pop || 0); a.o += (c.old || 0) * (c.pop || 0); a.n++; a.alt = Math.max(a.alt, c.alt || 0);
    }
    _dRec = {};
    for (const d of DISTRICTS) {
      const a = agg[d.id];
      _dRec[d.id] = a
        ? { kind: 'd', d, name: d.name, pop: a.pop, area: a.area, dens: a.pop / a.area, young: a.y / a.pop, old: a.o / a.pop, munic: a.n, alt: a.alt }
        : _islandRec(d);
    }
    const tot = Object.values(agg).reduce((s, a) => ({ pop: s.pop + a.pop, area: s.area + a.area, y: s.y + a.y, o: s.o + a.o }), { pop: 0, area: 0, y: 0, o: 0 });
    _nat = { pop: tot.pop, dens: tot.pop / tot.area, young: tot.y / tot.pop, old: tot.o / tot.pop };
  }
  /* ilhas: totais dos Censos 2021 (INE, NUTS 30/20); área e concelhos dos dados do distrito */
  function _islandRec(d) {
    const s = ((_stats && _stats.isl) || {})[d.id];
    const pop = s ? s[0] : d.pop;
    return { kind: 'd', d, name: d.name, pop, area: d.area, dens: pop / d.area, young: s ? s[1] : null, old: s ? s[2] : null,
      munic: d.munic, alt: d.id === 'acores' ? 2351 : 1862, island: true };
  }
  const val = (rec, m) => rec ? (m === 'district' || m === 'region' ? null : rec[m]) : null;

  /* escala por quantis (a população é muito assimétrica — com intervalos
     iguais, Lisboa e Porto ficavam com uma cor e o resto do país com outra) */
  function _scale(recs, m) {
    const v = recs.map(r => val(r, m)).filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return { color: () => '#64748b', breaks: [] };
    const k = RAMP.length, breaks = [];
    for (let i = 1; i < k; i++) breaks.push(v[Math.min(v.length - 1, Math.floor(i * v.length / k))]);
    return {
      min: v[0], max: v[v.length - 1], breaks,
      color: x => (x == null || !isFinite(x)) ? '#475569' : RAMP[breaks.filter(b => x >= b).length],
    };
  }
  function _catColor(rec) {
    const d = rec.kind === 'd' ? rec.d : D(rec.d);
    return _metric === 'region' ? (REGION[d.nuts2] || {}).col || '#64748b' : d.color;
  }

  /* ════════════════════════════ MOUNT ════════════════════════════ */
  async function mount(container) {
    _container = container;
    container.innerHTML = `
      <div class="pt-explorer-wrap ptx">
        <aside class="ptx-side">
          <div class="ptx-side-hd">
            <h2>Explorar Portugal</h2>
            <p>18 distritos, 278 concelhos e as ilhas — com os números dos Censos 2021.</p>
            <div class="ptx-search">
              <input id="ptx-q" type="search" placeholder="Distrito ou concelho…" autocomplete="off" aria-label="Pesquisar distrito ou concelho" aria-controls="ptx-qres">
              <button id="ptx-rand" class="ptx-icon-btn" title="Descobrir um sítio ao calhas" aria-label="Descobrir um sítio ao calhas">🎲</button>
              <div class="ptx-qres" id="ptx-qres" role="listbox" hidden></div>
            </div>
            <div class="ptx-seg ptx-level" role="group" aria-label="Ver o mapa por">
              <button data-level="district" class="${_level === 'district' ? 'on' : ''}">Distritos</button>
              <button data-level="concelho" class="${_level === 'concelho' ? 'on' : ''}">Concelhos</button>
            </div>
          </div>
          <div class="ptx-rank-hd"><span id="ptx-rank-ttl">Distritos</span><small id="ptx-rank-sub"></small></div>
          <ol class="ptx-rank" id="ptx-rank"></ol>
        </aside>

        <div class="ptx-mapcol">
          <div class="ptx-toolbar">
            <div class="ptx-metrics" role="group" aria-label="Colorir o mapa por">
              ${Object.entries(METRICS).map(([k, m]) => `<button data-metric="${k}" class="${k === _metric ? 'on' : ''}" aria-pressed="${k === _metric}">${m.label}</button>`).join('')}
            </div>
          </div>
          <div class="ptx-seg ptx-base" role="group" aria-label="Fundo do mapa">
            ${[['clean', 'Mapa'], ['topo', 'Relevo'], ['satellite', 'Satélite']].map(([k, l]) => `<button data-base="${k}" class="${k === _baseStyle ? 'on' : ''}">${l}</button>`).join('')}
          </div>
          <div class="ptx-map" id="ptx-map"></div>
          <div class="ptx-legend" id="ptx-legend"></div>
          <div class="ptx-islands" role="group" aria-label="Regiões autónomas">
            <button data-island="acores">🌋 Açores</button><button data-island="madeira">🌺 Madeira</button>
          </div>
          <div class="ptx-loading" id="ptx-loading"><span></span>A carregar o mapa de Portugal…</div>
        </div>

        <section class="ptx-panel" id="ptx-panel" aria-label="Informação" tabindex="-1">
          <button class="ptx-close" id="ptx-close" aria-label="Fechar painel">✕</button>
          <div class="ptx-panel-body" id="ptx-pbody"></div>
        </section>
      </div>`;
    _wrap = container.querySelector('.pt-explorer-wrap');

    try {
      await _loadLeaflet();
      [, _concData, _stats] = await Promise.all([null, _json(PT_CONCELHOS), _json(PT_STATS).catch(() => null)]);
      _buildRecords();
      const gj = await _json(PT_GEOJSON);
      _initMap(gj);
    } catch (e) {
      container.querySelector('#ptx-loading').innerHTML = 'Não foi possível carregar o mapa. Verifica a ligação e volta a abrir este separador.';
      return;
    }
    container.querySelector('#ptx-loading')?.remove();
    _wireUI();
    _refresh();
  }

  function resume() { setTimeout(() => { try { _map?.invalidateSize(); } catch (e) {} }, 80); }
  function stop() {}

  /* ════════════════════════════ MAPA ════════════════════════════ */
  function _initMap(gj) {
    const el = _container.querySelector('#ptx-map');
    _map = L.map(el, { center: [39.6, -8.0], zoom: 7, minZoom: 5, maxZoom: 13, zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: 'bottomright' }).addTo(_map);
    _map.createPane('ptLabels'); _map.getPane('ptLabels').style.zIndex = 650; _map.getPane('ptLabels').style.pointerEvents = 'none';
    _setBase(_baseStyle);
    _fitMainland(false);

    _distLayer = L.geoJSON(gj, {
      onEachFeature(f, layer) {
        const d = _findDistrict(f.properties.name);
        if (!d) return;
        layer._d = d;
        layer.on({
          mouseover: e => _hover(e.target, true),
          mouseout: e => _hover(e.target, false),
          click: () => _select(d),
        });
        layer.bindTooltip(() => _tipHTML(_dRec[d.id]), { sticky: true, direction: 'top', className: 'ptx-tip', opacity: 1 });
      },
    }).addTo(_map);

    _concLayer = L.geoJSON(_concData, {
      onEachFeature(f, layer) {
        const rec = _cRecs.find(r => r.f === f);
        layer._c = rec;
        layer.on({
          mouseover: e => _hover(e.target, true),
          mouseout: e => _hover(e.target, false),
          click: e => { L.DomEvent.stopPropagation(e); _selectConcelho(rec); },
        });
        layer.bindTooltip(() => _tipHTML(rec), { sticky: true, direction: 'top', className: 'ptx-tip', opacity: 1 });
      },
    });

    /* ilhas: marcadores (o GeoJSON só cobre o continente) */
    _islandMarkers = ['madeira', 'acores'].map(id => {
      const d = D(id);
      return L.circleMarker([d.lat, d.lon], { radius: 9, weight: 2, color: '#fff', fillColor: d.color, fillOpacity: .9 })
        .bindTooltip(() => _tipHTML(_dRec[id]), { direction: 'top', className: 'ptx-tip', opacity: 1 })
        .on('click', () => _select(d)).addTo(_map);
    });

    _map.on('zoomend', _labels);
    if (!_themeObs) {
      _themeObs = new MutationObserver(() => { if (_baseStyle === 'clean') _setBase('clean'); _refresh(); });
      _themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function _fitMainland(anim = true) {
    try { _map.fitBounds([[36.95, -9.6], [42.16, -6.18]], { paddingTopLeft: [16, 56], paddingBottomRight: [16, 40], animate: anim }); } catch (e) {}
  }

  function _setBase(style) {
    _baseStyle = style;
    try { localStorage.setItem('pt-basemap2', style); } catch (e) {}
    if (_base) _map.removeLayer(_base);
    const name = style === 'clean' ? (_isDark() ? 'dark' : 'light') : style;
    /* "Mapa" fica sem nomes do fornecedor: as nossas etiquetas (distritos e,
       ao abrir um distrito, os concelhos) não se duplicam com as dele */
    _base = Basemaps.layer(name, { labels: style === 'satellite', labelsPane: 'ptLabels' }).addTo(_map);
    if (_base.bringToBack) _base.bringToBack();
    _wrap.classList.toggle('ptx-sat', style === 'satellite');
    _container.querySelectorAll('[data-base]').forEach(b => b.classList.toggle('on', b.dataset.base === style));
    if (_distLayer) _paint();
  }

  /* ── pintura ── */
  function _fillOpacity() { return _baseStyle === 'satellite' ? 0.55 : _baseStyle === 'topo' ? 0.6 : 0.78; }
  function _hi() { return _isDark() ? '#ffffff' : '#0f172a'; }
  function _edge() { return _isDark() ? 'rgba(8,12,20,.85)' : 'rgba(255,255,255,.95)'; }

  function _paint() {
    const m = METRICS[_metric], op = _fillOpacity();
    const dRecs = Object.values(_dRec).filter(r => !r.island);
    const showConc = _level === 'concelho' || !!_selected;
    const concSet = _level === 'concelho' ? _cRecs : _cRecs.filter(r => _selected && r.d === _selected.id);
    const sD = m.kind === 'seq' ? _scale(dRecs, _metric) : null;
    const sC = m.kind === 'seq' ? _scale(concSet, _metric) : null;
    _sc = showConc ? sC : sD;

    _distLayer.eachLayer(l => {
      const d = l._d; if (!d) return;
      const rec = _dRec[d.id], sel = _selected === d;
      if (showConc) {
        /* por baixo dos concelhos só ficam os contornos dos distritos */
        const dim = _selected && !sel;
        l.setStyle({ fillColor: _isDark() ? '#0b1220' : '#e2e8f0', fillOpacity: dim ? (_baseStyle === 'clean' ? .55 : .35) : 0,
          color: sel ? _hi() : (_isDark() ? 'rgba(255,255,255,.55)' : 'rgba(15,23,42,.55)'), weight: sel ? 2.6 : 1.3, opacity: 1 });
      } else {
        l.setStyle({ fillColor: m.kind === 'seq' ? sD.color(val(rec, _metric)) : _catColor(rec), fillOpacity: op, color: _edge(), weight: 1.4, opacity: 1 });
      }
    });

    if (showConc) {
      if (!_map.hasLayer(_concLayer)) _concLayer.addTo(_map);
      _concLayer.eachLayer(l => {
        const r = l._c, inSet = _level === 'concelho' || r.d === (_selected && _selected.id);
        const on = _selConc === r;
        l.setStyle(inSet
          ? { fillColor: m.kind === 'seq' ? sC.color(val(r, _metric)) : _catColor(r), fillOpacity: on ? Math.min(.95, op + .15) : op,
              color: on ? _hi() : _edge(), weight: on ? 3 : .7, opacity: 1 }
          : { fillOpacity: 0, opacity: 0, weight: 0 });
        if (on) l.bringToFront();
      });
      _distLayer.bringToFront();
      _distLayer.eachLayer(l => { l.options.interactive = false; if (l._path) l._path.style.pointerEvents = 'none'; });
    } else {
      if (_map.hasLayer(_concLayer)) _map.removeLayer(_concLayer);
      _distLayer.eachLayer(l => { l.options.interactive = true; if (l._path) l._path.style.pointerEvents = ''; });
    }
    _islandMarkers.forEach((mk, i) => {
      const rec = _dRec[['madeira', 'acores'][i]];
      mk.setStyle({ fillColor: m.kind === 'seq' ? (val(rec, _metric) == null ? '#475569' : (sD ? sD.color(val(rec, _metric)) : '#64748b')) : _catColor(rec) });
    });
    _legend();
    _labels();
  }
  let _sc = null;

  function _hover(layer, on) {
    if (on) {
      layer.setStyle({ weight: 2.6, color: _hi() });
      layer.bringToFront();
    } else {
      _paint();
    }
  }

  function _tipHTML(rec) {
    if (!rec) return '';
    const m = METRICS[_metric];
    const v = val(rec, _metric);
    const sub = rec.kind === 'c' ? `Concelho · ${esc(D(rec.d).name)}` : (rec.island ? 'Região autónoma' : `Distrito · ${esc((REGION[rec.d.nuts2] || {}).name || '')}`);
    const line = m.kind === 'seq'
      ? (v == null ? '<span class="ptx-tip-v">sem dados</span>' : `<span class="ptx-tip-v">${m.fmt(v)}${m.unit}</span> <span class="ptx-tip-m">${esc(m.label.toLowerCase())}</span>`)
      : `<span class="ptx-tip-m">${rec.pop ? nf0(rec.pop) + ' habitantes' : ''}</span>`;
    return `<b>${esc(rec.name)}</b><small>${sub}</small>${line}`;
  }

  /* ── etiquetas próprias (só no fundo "Mapa", que não tem nomes até ao zoom 9) ── */
  function _labels() {
    if (!_map) return;
    if (_labelLayer) { _map.removeLayer(_labelLayer); _labelLayer = null; }
    const z = _map.getZoom(), out = [];
    if (_baseStyle !== 'clean' && _baseStyle !== 'topo') { /* satélite já traz nomes */ }
    else if (_selected && !ISLANDS.has(_selected.id) && z >= 8.5) {
      _concLayer.eachLayer(l => { if (l._c.d === _selected.id) out.push([l.getBounds().getCenter(), l._c.name, 'c']); });
    } else if (!_selected && _level === 'district' && z < 9) {
      _distLayer.eachLayer(l => { if (l._d) out.push([_labelPoint(l._d, l), l._d.name, 'd']); });
    }
    if (!out.length) return;
    _labelLayer = L.layerGroup(out.map(([ll, name, k]) => L.marker(ll, { interactive: false, keyboard: false, pane: 'ptLabels',
      icon: L.divIcon({ className: 'ptx-lbl ptx-lbl-' + k, html: `<span>${esc(name)}</span>`, iconSize: [0, 0] }) }))).addTo(_map);
  }
  /* centro do retângulo, mas puxado para a capital nos distritos de forma estranha (Setúbal, Lisboa) */
  const LABEL_AT = { setubal: [38.25, -8.62], lisboa: [38.98, -9.18], porto: [41.22, -8.4], 'viana-do-castelo': [41.88, -8.5] };
  function _labelPoint(d, l) { return LABEL_AT[d.id] || l.getBounds().getCenter(); }

  /* ── legenda ── */
  function _legend() {
    const el = _container.querySelector('#ptx-legend'), m = METRICS[_metric];
    if (m.kind === 'cat') {
      el.innerHTML = _metric === 'region'
        ? `<div class="ptx-lg-ttl">Regiões (NUTS II)</div>${Object.values(REGION).map(r => `<div class="ptx-lg-row"><i style="background:${r.col}"></i>${esc(r.name)}</div>`).join('')}`
        : `<div class="ptx-lg-ttl">Cada distrito com a sua cor</div><div class="ptx-lg-hint">Escolhe uma métrica para comparar</div>`;
      return;
    }
    const s = _sc;
    if (!s || !s.breaks.length) { el.innerHTML = ''; return; }
    const edges = [s.min, ...s.breaks, s.max];
    const scope = _level === 'concelho' ? 'todos os concelhos' : _selected ? `concelhos de ${_selected.name}` : 'distritos';
    el.innerHTML = `<div class="ptx-lg-ttl">${esc(m.label)} <small>· ${esc(scope)}</small></div>
      <div class="ptx-lg-ramp">${RAMP.map((c, i) => `<div><i style="background:${c}"></i><span>${i === RAMP.length - 1 ? '≥ ' : ''}${m.fmt(edges[i])}</span></div>`).join('')}</div>
      <div class="ptx-lg-hint">${esc(m.desc)} · cada cor junta ⅙ dos sítios</div>`;
  }

  /* ════════════════════════════ RANKING ════════════════════════════ */
  function _rank() {
    const m = METRICS[_metric];
    let recs, ttl;
    if (_selected && !ISLANDS.has(_selected.id)) { recs = _cRecs.filter(r => r.d === _selected.id); ttl = `Concelhos de ${_selected.name}`; }
    else if (_level === 'concelho') { recs = _cRecs; ttl = 'Todos os concelhos'; }
    else { recs = Object.values(_dRec); ttl = 'Distritos e ilhas'; }
    const key = m.kind === 'seq' ? _metric : 'pop';
    recs = recs.slice().sort((a, b) => (val(b, key) ?? -1) - (val(a, key) ?? -1));
    const max = Math.max(...recs.map(r => val(r, key) || 0));
    const mm = METRICS[key];
    _container.querySelector('#ptx-rank-ttl').textContent = ttl;
    _container.querySelector('#ptx-rank-sub').textContent = `por ${mm.label.toLowerCase()}`;
    const ol = _container.querySelector('#ptx-rank');
    ol.innerHTML = recs.map((r, i) => {
      const v = val(r, key), on = (r.kind === 'd' && _selected === r.d) || (r.kind === 'c' && _selConc === r);
      const col = m.kind === 'seq' && _sc ? _sc.color(v) : _catColor(r);
      return `<li><button class="${on ? 'on' : ''}" data-${r.kind}="${r.kind === 'd' ? r.d.id : _cRecs.indexOf(r)}">
        <span class="ptx-rk-n">${i + 1}</span>
        <span class="ptx-rk-body"><span class="ptx-rk-name">${esc(r.name)}</span>
          <span class="ptx-rk-bar"><i style="width:${max ? Math.max(2, (v || 0) / max * 100) : 0}%;background:${col}"></i></span></span>
        <span class="ptx-rk-v">${v == null ? '—' : mm.fmt(v) + (mm.unit === '%' ? '%' : '')}</span>
      </button></li>`;
    }).join('');
    ol.querySelector('button.on')?.scrollIntoView({ block: 'nearest' });
  }

  /* ════════════════════════════ SELEÇÃO ════════════════════════════ */
  function _select(d, opts) {
    _selected = d; _selConc = null; _tab = (opts && opts.tab) || 'resumo';
    if (ISLANDS.has(d.id)) {
      _map.flyToBounds(ISLAND_BOUNDS[d.id], { padding: [30, 30], duration: .8 });
    } else {
      let lay = null; _distLayer.eachLayer(l => { if (l._d === d) lay = l; });
      if (lay) _map.flyToBounds(lay.getBounds(), { padding: [30, 30], maxZoom: 10, duration: .8 });
    }
    _openPanel(); _renderDistrict(d); _refresh();
  }
  function _selectConcelho(rec) {
    const d = D(rec.d);
    if (_selected !== d) _selected = d;
    _selConc = rec;
    let lay = null; _concLayer.eachLayer(l => { if (l._c === rec) lay = l; });
    if (lay) _map.flyToBounds(lay.getBounds(), { padding: [60, 60], maxZoom: 11, duration: .8 });
    _openPanel(); _renderConcelho(rec); _refresh();
  }
  function _clear() {
    _selected = null; _selConc = null;
    _wrap.classList.remove('ptx-open');
    setTimeout(() => { try { _map.invalidateSize(); } catch (e) {} }, 320);
    _fitMainland(); _refresh();
  }
  function _openPanel() {
    const was = _wrap.classList.contains('ptx-open');
    _wrap.classList.add('ptx-open');
    if (!was) setTimeout(() => { try { _map.invalidateSize(); } catch (e) {} }, 320);
    _container.querySelector('#ptx-pbody').scrollTop = 0;
  }
  function _refresh() { if (!_distLayer) return; _paint(); _rank(); }

  /* ── posição num ranking ── */
  function _rankOf(rec, key, pool) {
    const v = val(rec, key); if (v == null) return null;
    const vs = pool.map(r => val(r, key)).filter(x => x != null);
    return { pos: vs.filter(x => x > v).length + 1, of: vs.length };
  }

  /* ── painel: distrito ── */
  function _stat(label, value, sub) { return `<div class="ptx-stat"><span class="ptx-stat-v">${value}</span><span class="ptx-stat-l">${label}</span>${sub ? `<span class="ptx-stat-s">${sub}</span>` : ''}</div>`; }
  function _ageBar(rec) {
    if (rec.young == null) return '';
    const y = rec.young, o = rec.old, a = 100 - y - o;
    const natO = _nat.old;
    return `<div class="ptx-age">
      <div class="ptx-age-ttl">Idades <small>· Censos 2021</small></div>
      <div class="ptx-age-bar" role="img" aria-label="${nf1(y)}% jovens, ${nf1(a)}% entre 15 e 64, ${nf1(o)}% idosos">
        <i class="y" style="width:${y}%"></i><i class="a" style="width:${a}%"></i><i class="o" style="width:${o}%"></i>
        <b style="left:${100 - natO}%" title="Média nacional de idosos: ${nf1(natO)}%"></b>
      </div>
      <div class="ptx-age-lg"><span><i class="y"></i>Menos de 15: ${nf1(y)}%</span><span><i class="a"></i>15–64: ${nf1(a)}%</span><span><i class="o"></i>65 ou mais: ${nf1(o)}%</span><span><i class="nat"></i>média do país</span></div>
      <p class="ptx-age-note">${o > natO + 3 ? `Mais envelhecido do que o país (${nf1(natO)}% de idosos no continente).` : o < natO - 3 ? `Mais jovem do que o país (${nf1(natO)}% de idosos no continente).` : `Perto da média do continente (${nf1(natO)}% de idosos).`}</p>
    </div>`;
  }

  function _renderDistrict(d) {
    const el = _container.querySelector('#ptx-pbody'), rec = _dRec[d.id];
    const pool = Object.values(_dRec).filter(r => !r.island);
    const rk = k => { if (rec.island) return ''; const r = _rankOf(rec, k, pool); return r ? `${r.pos}.º de ${r.of}` : ''; };
    const extra = DISTRICT_MON[d.id] || {};
    const pois = [...(d.landmarks || []), ...((extra.poi || []).filter(p => !(d.landmarks || []).includes(p)))];
    const concs = _cRecs.filter(r => r.d === d.id);
    const reg = REGION[d.nuts2] || { name: d.region, col: d.color };
    el.innerHTML = `
      <header class="ptx-hero" style="--c:${d.color}">
        <div class="ptx-hero-img" id="ptx-hero-img"></div>
        <div class="ptx-hero-txt">
          <span class="ptx-chip" style="--c:${reg.col}">${esc(reg.name)}</span>
          <h2>${esc(d.name)}</h2>
          <p>${esc(d.tagline)}</p>
        </div>
      </header>
      <div class="ptx-stats">
        ${_stat('habitantes', nf0(rec.pop), rk('pop'))}
        ${_stat('km²', nf0(rec.area), rk('area'))}
        ${_stat('hab/km²', nf0(rec.dens), rk('dens'))}
        ${_stat(rec.island ? 'concelhos' : 'concelhos', rec.munic, `capital: ${esc(d.capital)}`)}
      </div>
      ${_ageBar(rec)}
      <div class="ptx-tabs" role="tablist">
        ${[['resumo', 'Resumo'], ...(concs.length ? [['concelhos', `Concelhos (${concs.length})`]] : []), ['cultura', 'Cultura']].map(([k, l]) =>
          `<button role="tab" data-tab="${k}" aria-selected="${_tab === k}" class="${_tab === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div class="ptx-tabbody" id="ptx-tabbody"></div>
      <p class="ptx-src">Dados: INE, Censos 2021 · CAOP (DGT)${rec.island ? ' · valores aproximados para as ilhas' : ''}.</p>`;
    const body = el.querySelector('#ptx-tabbody');
    const paintTab = () => {
      el.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === _tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      if (_tab === 'concelhos') body.innerHTML = _concTable(concs), _wireConcTable(body, concs);
      else if (_tab === 'cultura') body.innerHTML = `
        ${extra.mon && extra.mon.length ? `<h3>🏛 Monumentos</h3><div class="ptx-links">${extra.mon.map(m => `<a href="${_wikiPt(m[1])}" target="_blank" rel="noopener">${esc(m[0])} ↗</a>`).join('')}</div>` : ''}
        <h3>📍 Pontos de interesse</h3><div class="ptx-tags">${pois.map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <h3>🍽 Gastronomia</h3><div class="ptx-tags food">${(d.food || []).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <h3>🎉 Tradições</h3><div class="ptx-tags trad">${(d.traditions || []).map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
      else body.innerHTML = `
        <p class="ptx-text">${esc(d.history)}</p>
        ${(d.facts || []).length ? `<h3>💡 Sabias que…</h3><ul class="ptx-facts">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${concs.length ? `<button class="btn btn-sm" data-goto="concelhos">Ver os ${concs.length} concelhos →</button>` : ''}`;
      body.querySelector('[data-goto]')?.addEventListener('click', () => { _tab = 'concelhos'; paintTab(); });
    };
    el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { _tab = b.dataset.tab; paintTab(); }));
    paintTab();
    _wikiHero(el.querySelector('#ptx-hero-img'), d.capital, d.name, true);
  }

  function _concTable(concs) {
    const cols = [['name', 'Concelho'], ['pop', 'Pop.'], ['dens', 'hab/km²'], ['old', '65+']];
    const s = _concSort;
    const list = concs.slice().sort((a, b) => s === 'name' ? a.name.localeCompare(b.name, 'pt') : (val(b, s) ?? -1) - (val(a, s) ?? -1));
    const max = Math.max(...concs.map(r => r.pop || 0));
    return `<table class="ptx-ctable"><thead><tr>${cols.map(([k, l]) => `<th><button data-sort="${k}" class="${s === k ? 'on' : ''}">${l}${s === k ? ' ↓' : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${list.map(r => `<tr data-ci="${_cRecs.indexOf(r)}">
        <td><span class="ptx-ct-name">${esc(r.name)}${_norm(r.name) === _norm(D(r.d).capital) ? ' <small>capital</small>' : ''}</span><span class="ptx-ct-bar"><i style="width:${(r.pop || 0) / max * 100}%"></i></span></td>
        <td>${r.pop ? nf0(r.pop) : '—'}</td><td>${r.dens ? nf0(r.dens) : '—'}</td><td>${r.old != null ? nf1(r.old) + '%' : '—'}</td></tr>`).join('')}</tbody></table>`;
  }
  function _wireConcTable(body, concs) {
    body.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { _concSort = b.dataset.sort; body.innerHTML = _concTable(concs); _wireConcTable(body, concs); }));
    body.querySelectorAll('tr[data-ci]').forEach(tr => tr.addEventListener('click', () => _selectConcelho(_cRecs[+tr.dataset.ci])));
  }

  /* ── painel: concelho ── */
  function _cmp(v, nat, unit, more, less) {
    if (v == null || nat == null) return '';
    const dlt = v - nat;
    if (unit === '%') return Math.abs(dlt) < 1 ? 'na média do país' : `${nf1(Math.abs(dlt))} p.p. ${dlt > 0 ? more : less} que o país`;
    const r = v / nat;
    return r > 1.15 ? `${nf1(r)}× a média do país` : r < 0.87 ? `${nf0(100 - r * 100)}% abaixo da média` : 'perto da média do país';
  }
  function _renderConcelho(rec) {
    const d = D(rec.d), el = _container.querySelector('#ptx-pbody');
    const pool = _cRecs.filter(r => r.d === rec.d);
    const rk = k => { const r = _rankOf(rec, k, pool); return r ? `${r.pos}.º de ${r.of} no distrito` : ''; };
    const capital = _norm(rec.name) === _norm(d.capital);
    const info = (typeof PT_CONCELHO_INFO !== 'undefined') ? PT_CONCELHO_INFO.get(rec.name) : null;
    el.innerHTML = `
      <button class="ptx-back" id="ptx-back">← ${esc(d.name)}</button>
      <header class="ptx-hero" style="--c:${d.color}">
        <div class="ptx-hero-img" id="ptx-hero-img"></div>
        <div class="ptx-hero-txt">
          <span class="ptx-chip" style="--c:${d.color}">${capital ? '⭐ Capital de distrito' : 'Concelho'} · ${esc(d.name)}</span>
          <h2>${esc(rec.name)}</h2>
        </div>
      </header>
      <div class="ptx-stats">
        ${_stat('habitantes', rec.pop ? nf0(rec.pop) : '—', rk('pop'))}
        ${_stat('hab/km²', rec.dens ? nf0(rec.dens) : '—', _cmp(rec.dens, _nat.dens))}
        ${_stat('km²', nf1(rec.area), rk('area'))}
        ${_stat('freguesias', rec.nf ?? '—', '')}
        ${_stat('m de altitude máx.', rec.alt ? nf0(rec.alt) : '—', rk('alt'))}
        ${_stat('% com 65 ou mais', rec.old != null ? nf1(rec.old) + '%' : '—', _cmp(rec.old, _nat.old, '%', 'mais', 'menos'))}
      </div>
      ${_ageBar(rec)}
      <div class="ptx-wiki" id="ptx-wiki"><p class="ptx-muted">A procurar na Wikipédia…</p></div>
      ${info ? `
        ${info.poi && info.poi.length ? `<h3>📍 Pontos de interesse</h3><div class="ptx-tags">${info.poi.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${info.food && info.food.length ? `<h3>🍽 Gastronomia</h3><div class="ptx-tags food">${info.food.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${info.trad && info.trad.length ? `<h3>🎉 Tradições</h3><div class="ptx-tags trad">${info.trad.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
        ${info.hist ? `<h3>📖 História</h3><p class="ptx-text">${esc(info.hist)}</p>` : ''}` : ''}
      <p class="ptx-src">Dados: INE, Censos 2021 · CAOP (DGT) · Wikipédia.</p>`;
    el.querySelector('#ptx-back').addEventListener('click', () => { _selConc = null; _tab = 'concelhos'; _select(d, { tab: 'concelhos' }); });
    _wikiHero(el.querySelector('#ptx-hero-img'), rec.name, d.name, false, el.querySelector('#ptx-wiki'));
  }

  /* ── Wikipédia ao vivo (resumo + foto), com cache na sessão ── */
  async function _wiki(name, dname) {
    const key = 'ptwiki2:' + name + '|' + dname;
    try { const c = sessionStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    const api = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&format=json&origin=*&srsearch=';
    const s = await fetch(api + encodeURIComponent(`${name} município distrito de ${dname}`)).then(r => r.json());
    const hits = ((s.query || {}).search || []).map(h => h.title);
    const n = _norm(name);
    const title = hits.find(t => _norm(t) === n) || hits.find(t => _norm(t).startsWith(n + ' (')) || hits.find(t => _norm(t).startsWith(n)) || null;
    if (!title) return null;
    const sum = await fetch('https://pt.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))).then(r => (r.ok ? r.json() : null));
    if (!sum || sum.type === 'disambiguation') return null;
    /* o Wikimedia só serve miniaturas em larguras-padrão (330, 500, 960…) —
       pedir 640px dá erro 400 */
    const th = sum.thumbnail, ow = (sum.originalimage || {}).width || 0;
    const img = th ? th.source.replace(/\/\d+px-/, '/' + (ow >= 960 ? 960 : ow >= 500 ? 500 : th.width) + 'px-') : null;
    const out = { title: sum.title, extract: sum.extract, img, thumb: th ? th.source : null, url: ((sum.content_urls || {}).desktop || {}).page || _wikiPt(title) };
    try { sessionStorage.setItem(key, JSON.stringify(out)); } catch (e) {}
    return out;
  }
  async function _wikiHero(imgEl, name, dname, heroOnly, textEl) {
    let w = null;
    try { w = await _wiki(name, dname); } catch (e) {}
    if (imgEl && imgEl.isConnected && w && w.img) {
      const im = new Image();
      im.alt = ''; im.decoding = 'async';
      im.onload = () => { if (!imgEl.isConnected) return; imgEl.replaceChildren(im); imgEl.insertAdjacentHTML('beforeend', '<span class="ptx-credit">Foto: Wikipédia</span>'); imgEl.parentElement.classList.add('has-img'); };
      im.onerror = () => { if (w.thumb && im.src !== w.thumb) im.src = w.thumb; };
      im.src = w.img;
    }
    if (!heroOnly && textEl && textEl.isConnected) {
      textEl.innerHTML = w && w.extract
        ? `<p class="ptx-text">${esc(w.extract)}</p><a class="ptx-wlink" href="${esc(w.url)}" target="_blank" rel="noopener">Ler mais na Wikipédia ↗</a>`
        : `<a class="ptx-wlink" href="${_wikiPt(name)}" target="_blank" rel="noopener">Procurar ${esc(name)} na Wikipédia ↗</a>`;
    }
  }

  /* ════════════════════════════ UI ════════════════════════════ */
  function _wireUI() {
    const c = _container;
    c.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => {
      _level = b.dataset.level;
      c.querySelectorAll('[data-level]').forEach(x => x.classList.toggle('on', x === b));
      if (_level === 'concelho' && _metric === 'district') _setMetric('pop');
      if (_level === 'concelho' && !_selected) _fitMainland();
      _refresh();
    }));
    c.querySelectorAll('[data-metric]').forEach(b => b.addEventListener('click', () => _setMetric(b.dataset.metric)));
    c.querySelectorAll('[data-base]').forEach(b => b.addEventListener('click', () => { _setBase(b.dataset.base); _labels(); }));
    c.querySelectorAll('[data-island]').forEach(b => b.addEventListener('click', () => _select(D(b.dataset.island))));
    c.querySelector('#ptx-close').addEventListener('click', _clear);
    c.querySelector('#ptx-rank').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d) _select(D(b.dataset.d)); else if (b.dataset.c) _selectConcelho(_cRecs[+b.dataset.c]);
    });
    c.querySelector('#ptx-rand').addEventListener('click', discoverRandom);

    /* pesquisa: distritos e concelhos */
    const q = c.querySelector('#ptx-q'), res = c.querySelector('#ptx-qres');
    let hits = [];
    const run = () => {
      const s = _norm(q.value);
      if (!s) { res.hidden = true; return; }
      const ds = DISTRICTS.filter(d => _norm(d.name).includes(s)).map(d => ({ t: 'd', d, name: d.name, sub: 'Distrito' }));
      const cs = _cRecs.filter(r => _norm(r.name).includes(s)).sort((a, b) => _norm(a.name).indexOf(s) - _norm(b.name).indexOf(s)).map(r => ({ t: 'c', r, name: r.name, sub: `Concelho · ${D(r.d).name}` }));
      hits = [...ds, ...cs].slice(0, 8);
      res.innerHTML = hits.length ? hits.map((h, i) => `<button role="option" data-i="${i}"><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></button>`).join('') : '<div class="ptx-qnone">Nada encontrado</div>';
      res.hidden = false;
    };
    const go = h => { if (!h) return; q.value = ''; res.hidden = true; if (h.t === 'd') _select(h.d); else _selectConcelho(h.r); };
    q.addEventListener('input', run);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(hits[0]); } if (e.key === 'Escape') { q.value = ''; res.hidden = true; } });
    res.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) go(hits[+b.dataset.i]); });
    document.addEventListener('click', e => { if (!c.contains(e.target) || !e.target.closest('.ptx-search')) res.hidden = true; });

    if (!_escBound) {
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && _container && _container.offsetParent !== null && _wrap.classList.contains('ptx-open')) _clear(); });
      _escBound = true;
    }
  }
  let _escBound = false;

  function _setMetric(k) {
    _metric = k;
    try { localStorage.setItem('pt-metric', k); } catch (e) {}
    _container.querySelectorAll('[data-metric]').forEach(b => { const on = b.dataset.metric === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    _refresh();
  }

  function discoverRandom() {
    if (!_cRecs.length) return;
    if (Math.random() < 0.35) { const d = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)]; _select(d); return d.name; }
    const r = _cRecs[Math.floor(Math.random() * _cRecs.length)];
    _selectConcelho(r);
    return r.name;
  }

  return { mount, resume, stop, discoverRandom };
})();
