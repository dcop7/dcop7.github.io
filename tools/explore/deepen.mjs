/* Deepen the "aprofundar" tier — append specialized/deep items to each theme
   file (data/explore/<theme>.json), merging by id (skips ids already present).
   Run: node tools/explore/deepen.mjs */
import { readFile, writeFile } from 'node:fs/promises';
const ROOT = new URL('../../', import.meta.url);
const a = (id, subtheme, year, title, desc, fact, tags, extra = {}) =>
  ({ id, title, tier: 'aprofundar', subtheme, year, desc, fact, tags, ...extra });

const ADD = {
 universo: [
  a('idade-trevas', 'origem', -13700000000, 'A Idade das Trevas cósmica', 'O período sem estrelas entre os primeiros átomos e as primeiras estrelas.', 'Durou centenas de milhões de anos de escuridão total.', ['origem', 'cosmologia'], { related: ['primeiros-atomos', 'primeiras-estrelas'] }),
  a('reionizacao', 'cosmologia', -13200000000, 'A reionização', 'A luz das primeiras estrelas torna o gás do Universo transparente.', 'É uma das fronteiras que o James Webb está a explorar.', ['cosmologia', 'origem']),
  a('quasares', 'galaxias', 1963, 'Quasares', 'Núcleos de galáxias com buracos negros a brilhar mais que biliões de estrelas.', 'São dos objetos mais distantes e brilhantes que conseguimos ver.', ['galáxia', 'buraco-negro'], { related: ['sgr-a'] }),
  a('magnetares', 'estrelas', 1992, 'Magnetares', 'Estrelas de neutrões com os campos magnéticos mais fortes do Universo.', 'Poderiam apagar um cartão de crédito a meia distância da Lua.', ['estrelas', 'extremo'], { related: ['estrela-neutroes'] }),
  a('lentes-gravitacionais', 'cosmologia', 1979, 'Lentes gravitacionais', 'A gravidade curva a luz e amplia galáxias distantes como uma lupa cósmica.', 'Foi prevista por Einstein e hoje usa-se para mapear matéria escura.', ['cosmologia', 'gravidade'], { related: ['materia-escura'] }),
  a('nebulosa-planetaria', 'estrelas', 1764, 'Nebulosas planetárias', 'O belo invólucro de gás que uma estrela como o Sol expele no fim da vida.', 'O nome engana — não têm nada a ver com planetas.', ['estrelas', 'evolução'], { related: ['ana-branca'] }),
  a('antimateria', 'cosmologia', 1932, 'Matéria e antimatéria', 'Cada partícula tem uma gémea oposta; o Universo, por sorte, ficou com matéria a mais.', 'Se fossem iguais, tudo se teria aniquilado e nada existiria.', ['cosmologia', 'física']),
  a('raios-cosmicos', 'cosmologia', 1912, 'Raios cósmicos', 'Partículas vindas do espaço que bombardeiam a Terra a toda a hora.', 'Foram descobertas em voos de balão a grande altitude.', ['cosmologia', 'partículas']),
 ],
 solar: [
  a('io-vulcoes', 'luas', 1979, 'Io, a lua dos vulcões', 'A lua de Júpiter é o corpo com mais atividade vulcânica do Sistema Solar.', 'A Voyager apanhou vulcões em erupção em pleno voo.', ['lua', 'vulcão'], { related: ['luas-galileanas'] }),
  a('hexagono-saturno', 'planetas', 1988, 'O hexágono de Saturno', 'Uma estranha tempestade em forma de hexágono no polo norte de Saturno.', 'Cada lado é maior do que o diâmetro da Terra.', ['saturno', 'tempestade'], { related: ['saturno'] }),
  a('planeta-nove', 'corpos', 2016, 'O hipotético Planeta Nove', 'Órbitas estranhas de corpos distantes sugerem um planeta ainda por descobrir.', 'Seria várias vezes maior que a Terra, muito para lá de Neptuno.', ['corpos', 'mistério']),
  a('oumuamua', 'corpos', 2017, 'ʻOumuamua', 'O primeiro objeto vindo de fora do Sistema Solar a ser detetado.', 'A sua forma alongada gerou até especulações sobre naves alienígenas.', ['corpos', 'interestelar']),
  a('aneis-urano', 'planetas', 1977, 'Os anéis de Úrano e Neptuno', 'Descobre-se que não só Saturno tem anéis.', 'Os de Úrano foram detetados quando bloquearam a luz de uma estrela.', ['planeta', 'anéis'], { related: ['urano', 'saturno'] }),
  a('ganimedes', 'luas', 1610, 'Ganimedes, a maior lua', 'A maior lua do Sistema Solar, maior do que o planeta Mercúrio.', 'É a única lua com campo magnético próprio.', ['lua', 'júpiter'], { related: ['luas-galileanas'] }),
  a('heliosfera', 'sol', 2012, 'A fronteira do Sistema Solar', 'A Voyager 1 sai da heliosfera e entra no espaço interestelar.', 'É o objeto humano mais distante alguma vez construído.', ['sol', 'limite'], { related: ['voyager'] }),
  a('transito-venus', 'planetas', 1761, 'O trânsito de Vénus', 'Observar Vénus a cruzar o Sol permitiu medir a distância da Terra ao Sol.', 'É tão raro que só acontece duas vezes por século.', ['vénus', 'astronomia'], { related: ['venus'] }),
 ],
 terra: [
  a('nucleo-lehmann', 'geologia', 1936, 'A descoberta do núcleo interno', 'Inge Lehmann descobre, pelas ondas sísmicas, que a Terra tem um núcleo sólido.', 'Conseguiu-o sem nunca ver o interior do planeta.', ['geologia', 'núcleo'], { people: ['inge-lehmann'], related: ['campo-magnetico'] }),
  a('dorsais-oceanicas', 'geologia', 1960, 'As dorsais oceânicas', 'Cadeias de montanhas no fundo do mar provam que as placas se afastam.', 'Foi a prova que finalmente fez aceitar a tectónica de placas.', ['geologia', 'oceano'], { related: ['tectonica'] }),
  a('inversoes-magneticas', 'geologia', 1963, 'Inversões do campo magnético', 'Faixas magnéticas no fundo do mar registam quando os polos se inverteram.', 'O Norte magnético já foi o Sul muitas vezes na história da Terra.', ['geologia', 'magnetismo'], { related: ['campo-magnetico'] }),
  a('supererupcao-toba', 'extincoes', -74000, 'A supererupção de Toba', 'Um vulcão gigante na Indonésia pode ter quase extinguido a humanidade.', 'Há quem acredite que reduziu os humanos a poucos milhares.', ['vulcão', 'catástrofe'], { related: ['vulcoes'] }),
  a('sismo-valdivia', 'geologia', 1960, 'O maior sismo registado', 'O sismo de Valdivia, no Chile, atingiu magnitude 9,5.', 'Provocou um tsunami que chegou ao Japão um dia depois.', ['geologia', 'sismo'], { related: ['terremotos'] }),
  a('correntes-jato', 'atmosfera', 1939, 'As correntes de jato', 'Rios de vento a grande altitude que governam o tempo e as rotas dos aviões.', 'Voar com elas a favor poupa muito combustível e tempo.', ['atmosfera', 'vento'], { related: ['correntes-oceanicas'] }),
  a('permafrost', 'clima', 2000, 'O permafrost', 'Solo permanentemente gelado que guarda enormes quantidades de carbono.', 'Ao derreter, liberta gases que aceleram o aquecimento global.', ['clima', 'gelo'], { related: ['aquecimento-global'] }),
  a('grande-oxidacao-detalhe', 'geologia', -2400000000, 'As faixas de ferro', 'Camadas de rocha que registam o aparecimento do oxigénio nos oceanos.', 'Quase todo o ferro que usamos vem destes depósitos antigos.', ['geologia', 'oxigénio'], { related: ['grande-oxidacao'] }),
 ],
 vida: [
  a('estromatolitos', 'micro', -3500000000, 'Estromatólitos', 'Estruturas feitas por micróbios, entre os mais antigos sinais de vida.', 'Ainda se formam hoje em alguns pontos da Austrália.', ['micróbios', 'fóssil'], { related: ['cianobacterias'] }),
  a('endossimbiose', 'micro', 1967, 'A teoria da endossimbiose', 'Lynn Margulis mostra que as células complexas nasceram de uniões de micróbios.', 'Foi muito criticada antes de se tornar consensual.', ['célula', 'evolução'], { people: ['lynn-margulis'], related: ['celula-complexa'] }),
  a('trilobites', 'animais', -520000000, 'Trilobites', 'Artrópodes marinhos que dominaram os mares durante 270 milhões de anos.', 'Tinham olhos feitos de cristais de calcite.', ['animais', 'fóssil'], { related: ['explosao-cambrica'] }),
  a('primeiras-arvores', 'plantas', -380000000, 'As primeiras árvores', 'O aparecimento de troncos lenhosos cria as primeiras florestas.', 'Mudaram o clima ao retirar enormes quantidades de CO₂.', ['plantas', 'florestas'], { related: ['florestas-carbonifero'] }),
  a('insetos-gigantes', 'animais', -320000000, 'Insetos gigantes', 'O excesso de oxigénio permitiu libélulas do tamanho de gaivotas.', 'O nível de oxigénio limita o tamanho dos insetos.', ['animais', 'insetos'], { related: ['insetos'] }),
  a('extremofilos', 'micro', 1977, 'Extremófilos', 'Seres que vivem em ácido, gelo ou fontes ferventes do fundo do mar.', 'Mostram que a vida pode existir em lugares antes tidos como impossíveis.', ['micróbios', 'extremo'], { related: ['vida-extraterrestre'] }),
  a('coevolucao', 'plantas', -100000000, 'Flores e insetos, juntos', 'Plantas e polinizadores evoluem em parceria, moldando-se mutuamente.', 'Algumas flores só podem ser polinizadas por uma única espécie.', ['plantas', 'evolução'], { related: ['flores'] }),
  a('arvore-da-vida', 'evolucao', 1837, 'A árvore da vida', 'Todos os seres vivos estão ligados num único enorme parentesco.', 'Darwin desenhou-a pela primeira vez num caderno, com a nota "I think".', ['evolução', 'parentesco'], { related: ['selecao-natural'] }),
 ],
 dinos: [
  a('coelophysis', 'triasico', -210000000, 'Coelophysis', 'Um dos primeiros dinossauros bem conhecidos, ágil e carnívoro.', 'Foram encontrados aos milhares no mesmo local, nos EUA.', ['triásico', 'predador'], { related: ['primeiros-dinos'] }),
  a('repteis-marinhos', 'jurassico', -200000000, 'Répteis marinhos', 'Ictiossauros e plesiossauros dominavam os mares — não eram dinossauros.', 'Mary Anning descobriu muitos destes fósseis no séc. XIX.', ['jurássico', 'marinho'], { people: ['mary-anning'] }),
  a('brachiosaurus', 'jurassico', -154000000, 'Brachiosaurus', 'Um saurópode que erguia o pescoço como uma girafa gigante.', 'Ficou famoso na cena de abertura de "Parque Jurássico".', ['jurássico', 'gigante'], { related: ['saurópodes'] }),
  a('ankylosaurus', 'cretacico', -68000000, 'Ankylosaurus', 'Um herbívoro blindado com uma maça óssea na cauda.', 'Era praticamente um "tanque" vivo.', ['cretácico', 'herbívoro'] ),
  a('ovos-dinos', 'paleontologia', 1923, 'Ovos e ninhos de dinossauro', 'Expedições à Mongólia encontram os primeiros ninhos com ovos.', 'Provaram que muitos dinossauros cuidavam das crias.', ['paleontologia', 'ovos']),
  a('maiores-dinos', 'paleontologia', 2014, 'Os maiores de sempre', 'Fósseis na Argentina revelam titanossauros de até 37 metros.', 'Pesavam o equivalente a uma dezena de elefantes.', ['paleontologia', 'gigante'], { related: ['saurópodes'] }),
  a('mary-anning', 'paleontologia', 1811, 'Mary Anning', 'Uma das maiores caçadoras de fósseis, ignorada por ser mulher na sua época.', 'Inspirou o trava-língua "ela vende conchas à beira-mar".', ['paleontologia', 'pioneira'], { people: ['mary-anning'] }),
  a('metabolismo-dinos', 'paleontologia', 2014, 'Eram de sangue quente?', 'Estudos sugerem que muitos dinossauros tinham metabolismo intermédio.', 'Nem totalmente répteis frios, nem aves quentes.', ['paleontologia', 'ciência'], { related: ['aves-dinos'] }),
 ],
 humana: [
  a('denisovanos', 'hominideos', 2010, 'Os Denisovanos', 'Uma espécie humana descoberta apenas pelo ADN de um pequeno osso.', 'Povos da Ásia e Oceânia ainda carregam o seu ADN.', ['homo', 'adn'], { related: ['neandertais', 'adn-antigo'] }),
  a('homo-floresiensis', 'hominideos', 2003, 'O "Hobbit" de Flores', 'Uma espécie humana de pequena estatura que viveu numa ilha da Indonésia.', 'Media cerca de um metro de altura.', ['homo', 'descoberta']),
  a('adn-antigo', 'hominideos', 2010, 'Ler o ADN dos fósseis', 'A paleogenética permite ler o ADN de humanos com dezenas de milhares de anos.', 'Svante Pääbo ganhou o Nobel da Medicina por isso em 2022.', ['adn', 'ciência'], { people: ['svante-paabo'], related: ['neandertais'] }),
  a('ferramentas-pedra', 'prehistoria', -2600000, 'As primeiras ferramentas de pedra', 'Lascar pedras para cortar marca o início da tecnologia humana.', 'São anteriores ao próprio género Homo.', ['ferramentas', 'pré-história'], { related: ['homo-habilis'] }),
  a('domesticacao-caes', 'prehistoria', -15000, 'O cão, o primeiro amigo', 'Os lobos aproximam-se dos humanos e tornam-se os primeiros animais domésticos.', 'Aconteceu antes da agricultura.', ['domesticação', 'animais']),
  a('venus-paleoliticas', 'cultura', -25000, 'As "Vénus" paleolíticas', 'Pequenas estatuetas femininas entre as mais antigas obras de arte 3D.', 'A Vénus de Willendorf tem cerca de 25 mil anos.', ['arte', 'pré-história'], { related: ['arte-rupestre'] }),
  a('megafauna-extincao', 'migracoes', -12000, 'O fim da megafauna', 'Mamutes e outros gigantes extinguem-se com a chegada dos humanos e o degelo.', 'A caça e o clima terão atuado em conjunto.', ['extinção', 'megafauna'], { related: ['idades-do-gelo'] }),
  a('focos-agricultura', 'prehistoria', -8000, 'A agricultura nasce em vários sítios', 'Trigo no Médio Oriente, arroz na China, milho no México — tudo em separado.', 'A mesma ideia surgiu de forma independente pelo mundo.', ['agricultura', 'neolítico'], { related: ['agricultura'] }),
 ],
 civil: [
  a('gilgamesh', 'mesopotamia', -2100, 'A Epopeia de Gilgamesh', 'Uma das obras literárias mais antigas que se conhecem.', 'Inclui uma história de dilúvio anterior à da Bíblia.', ['mesopotâmia', 'literatura'], { related: ['escrita-cuneiforme'] }),
  a('idade-bronze', 'mesopotamia', -3300, 'A Idade do Bronze', 'Misturar cobre e estanho cria um metal duro que muda armas e ferramentas.', 'A sua procura criou as primeiras grandes redes de comércio.', ['metalurgia', 'antiguidade']),
  a('biblioteca-alexandria', 'grecia', -283, 'A Biblioteca de Alexandria', 'O maior centro de saber do mundo antigo.', 'Tentava reunir uma cópia de todos os livros existentes.', ['grécia', 'conhecimento'], { place: 'Alexandria' }),
  a('arquimedes', 'grecia', -250, 'Arquimedes', 'Um dos maiores génios da Antiguidade, na matemática e na engenharia.', 'Terá gritado "Eureka!" ao descobrir o princípio da impulsão no banho.', ['grécia', 'ciência'], { people: ['arquimedes'] }),
  a('coliseu', 'roma', 80, 'O Coliseu de Roma', 'Um anfiteatro para 50 mil pessoas, palco de combates de gladiadores.', 'Podia ser inundado para encenar batalhas navais.', ['roma', 'monumento'], { place: 'Roma', related: ['imperio-romano'] }),
  a('rota-seda', 'asia', -130, 'A Rota da Seda', 'Uma rede de rotas que ligava a China à Europa por comércio e ideias.', 'Por ela viajaram seda, especiarias, religiões e doenças.', ['comércio', 'ásia'], { related: ['china-antiga'] }),
  a('papel-china', 'asia', 105, 'A invenção do papel', 'A China inventa o papel, muito antes da Europa.', 'Levou mais de mil anos a chegar ao Ocidente.', ['china', 'invenção'], { related: ['imprensa'] }),
  a('linhas-nazca', 'americas', -100, 'As linhas de Nazca', 'Enormes desenhos no deserto do Peru, só visíveis do céu.', 'Ainda hoje não há certezas sobre a sua função.', ['américa', 'mistério'] ),
 ],
 mundial: [
  a('vikings', 'medieval', 793, 'Os Vikings', 'Navegadores e guerreiros nórdicos que chegaram à América antes de Colombo.', 'Tinham uma povoação no Canadá por volta do ano 1000.', ['medieval', 'navegação'], { related: ['colombo'] }),
  a('carlos-magno', 'medieval', 800, 'Carlos Magno', 'Reúne grande parte da Europa Ocidental num império cristão.', 'É lembrado como "pai da Europa".', ['medieval', 'império'] ),
  a('imperio-mongol', 'medieval', 1206, 'O Império Mongol', 'Gengis Khan cria o maior império terrestre contínuo da história.', 'Ia da Coreia até à Europa de Leste.', ['medieval', 'império'] ),
  a('magna-carta', 'medieval', 1215, 'A Magna Carta', 'Um documento que limita o poder do rei de Inglaterra.', 'É vista como uma semente das democracias modernas.', ['medieval', 'direitos'], { related: ['direitos-humanos'] }),
  a('queda-constantinopla', 'moderna', 1453, 'A queda de Constantinopla', 'Os otomanos tomam a cidade e marcam o fim do Império Bizantino.', 'Ajudou a empurrar a Europa para a era dos Descobrimentos.', ['otomano', 'história'], { related: ['descobrimentos-mundiais'] }),
  a('trafico-escravos', 'moderna', 1500, 'O tráfico transatlântico de escravos', 'Milhões de africanos são escravizados e levados para as Américas.', 'É uma das maiores tragédias da história humana.', ['história', 'injustiça'] ),
  a('revolucao-russa', 'secxx', 1917, 'A Revolução Russa', 'Os bolcheviques tomam o poder e criam o primeiro Estado comunista.', 'Daria origem à União Soviética.', ['revolução', 'século-xx'], { related: ['guerra-fria'] }),
  a('queda-uniao-sovietica', 'contemporanea', 1991, 'O fim da União Soviética', 'A maior potência comunista desfaz-se em 15 países.', 'Pôs fim definitivo à Guerra Fria.', ['século-xx', 'política'], { related: ['muro-berlim'] }),
 ],
 portugal: [
  a('tratado-tordesilhas', 'descobrimentos', 1494, 'Tratado de Tordesilhas', 'Portugal e Espanha dividem o mundo por descobrir com uma linha no mapa.', 'É por isso que no Brasil se fala português.', ['descobrimentos', 'tratado'], { related: ['descobrimentos-pt', 'cabral-brasil'] }),
  a('ines-castro', 'monarquia', 1355, 'Inês de Castro', 'A trágica história de amor que inspirou poetas durante séculos.', 'Reza a lenda que foi coroada rainha já depois de morta.', ['monarquia', 'lenda'] ),
  a('mosteiro-alcobaca', 'patrimonio', 1153, 'Mosteiro de Alcobaça', 'Uma obra-prima do gótico cisterciense e Património Mundial.', 'Guarda os túmulos de D. Pedro e de Inês de Castro.', ['monumento', 'gótico'], { place: 'Alcobaça', related: ['ines-castro'] }),
  a('padrao-descobrimentos', 'patrimonio', 1960, 'Padrão dos Descobrimentos', 'Um monumento em Lisboa que homenageia os navegadores portugueses.', 'Tem a forma de uma caravela com o Infante D. Henrique à proa.', ['monumento', 'descobrimentos'], { place: 'Belém, Lisboa', related: ['henrique-navegador'] }),
  a('ponte-25-abril', 'patrimonio', 1966, 'Ponte 25 de Abril', 'A ponte suspensa sobre o Tejo, ícone de Lisboa.', 'Chamou-se "Ponte Salazar" até à Revolução de 1974.', ['monumento', 'lisboa'], { place: 'Lisboa', related: ['25-abril'] }),
  a('fernando-pessoa', 'patrimonio', 1888, 'Fernando Pessoa', 'O maior poeta português do século XX, que escrevia sob vários "heterónimos".', 'Criou poetas inteiros, cada um com a sua biografia e estilo.', ['literatura', 'cultura'], { people: ['fernando-pessoa'] }),
  a('saramago-nobel', 'patrimonio', 1998, 'José Saramago, Nobel da Literatura', 'O único autor de língua portuguesa a vencer o Nobel da Literatura.', 'Ficou famoso pelo seu estilo sem pontuação tradicional.', ['literatura', 'nobel'], { people: ['jose-saramago'] }),
  a('barreto-pina-magalhaes', 'ciencia', 1922, 'A primeira travessia aérea do Atlântico Sul', 'Gago Coutinho e Sacadura Cabral cruzam o Atlântico Sul de avião.', 'Usaram um instrumento de navegação inventado por eles.', ['ciência', 'aviação'], { people: ['gago-coutinho'] }),
 ],
 tech: [
  a('colossus', 'computadores', 1943, 'Colossus', 'O primeiro computador eletrónico digital, usado para decifrar códigos nazis.', 'Foi mantido secreto durante décadas após a guerra.', ['computador', 'história'], { related: ['eniac', 'maquina-turing'] }),
  a('primeiro-bug', 'software', 1947, 'O primeiro "bug"', 'Uma traça presa num computador dá origem ao termo informático "bug".', 'O inseto foi colado no caderno de registo com a nota "first actual bug".', ['software', 'curiosidade'] ),
  a('rsa-criptografia', 'software', 1977, 'A criptografia de chave pública', 'O método RSA permite comunicar em segredo sem trocar chaves antes.', 'É a base da segurança da internet e das compras online.', ['software', 'segurança'] ),
  a('gps', 'redes', 1978, 'O GPS', 'Uma rede de satélites que diz a qualquer um onde está no planeta.', 'Precisa de corrigir os efeitos da relatividade de Einstein para ser exato.', ['redes', 'navegação'], { related: ['satelites'] }),
  a('fibra-otica', 'redes', 1966, 'A fibra ótica', 'Filamentos de vidro transmitem dados à velocidade da luz.', 'É a espinha dorsal da internet mundial.', ['redes', 'internet'], { related: ['tcp-ip'] }),
  a('usb', 'hardware', 1996, 'O USB', 'Uma ficha universal que substituiu dezenas de cabos diferentes.', 'Quase todos a ligam mal à primeira tentativa.', ['hardware', 'padrão'] ),
  a('bitcoin', 'software', 2009, 'Bitcoin e a blockchain', 'A primeira moeda digital sem banco central, baseada em blockchain.', 'O seu criador, "Satoshi Nakamoto", continua anónimo.', ['software', 'cripto'] ),
  a('computacao-quantica', 'hardware', 2019, 'Computação quântica', 'Computadores que usam a física quântica para certos cálculos impossíveis.', 'Prometem resolver problemas que demorariam milénios aos atuais.', ['hardware', 'futuro'], { related: ['microprocessador'] }),
 ],
 espaco: [
  a('laika', 'astronautas', 1957, 'Laika, a primeira viajante', 'Uma cadela torna-se o primeiro ser vivo a orbitar a Terra.', 'A sua viagem provou que um corpo podia sobreviver ao lançamento.', ['astronauta', 'animal'], { related: ['sputnik'] }),
  a('primeiro-spacewalk', 'astronautas', 1965, 'O primeiro passeio espacial', 'Alexei Leonov sai da nave e flutua no vácuo do espaço.', 'O fato inchou tanto que mal conseguiu voltar a entrar.', ['astronauta', 'marco'], { related: ['gagarin'] }),
  a('lado-oculto-lua', 'satelites', 1959, 'O lado oculto da Lua', 'A sonda Luna 3 fotografa pela primeira vez a face que nunca vemos.', 'A Lua mostra-nos sempre a mesma cara.', ['lua', 'sonda'], { related: ['lua'] }),
  a('mir', 'missoes', 1986, 'A estação Mir', 'A estação soviética que ensinou a humanidade a viver no espaço.', 'Bateu o recorde de permanência humana contínua em órbita.', ['estação', 'urss'], { related: ['iss'] }),
  a('challenger', 'missoes', 1986, 'O desastre do Challenger', 'O vaivém explode 73 segundos após o lançamento, em direto.', 'Mudou para sempre a forma como a NASA encara o risco.', ['nasa', 'tragédia'], { related: ['vaivem'] }),
  a('trappist1', 'descobertas', 2017, 'O sistema TRAPPIST-1', 'Sete planetas do tamanho da Terra em torno de uma só estrela.', 'Vários estão na zona onde poderia existir água líquida.', ['exoplanetas', 'descoberta'], { related: ['exoplanetas'] }),
  a('agua-marte', 'descobertas', 2015, 'Água líquida em Marte', 'Provas de que ainda corre água salgada à superfície de Marte.', 'Reforça a esperança de encontrar vida no planeta.', ['marte', 'água'], { related: ['marte', 'perseverance'] }),
  a('starlink', 'satelites', 2019, 'As megaconstelações de satélites', 'Milhares de satélites passam a dar internet a partir do espaço.', 'São tantos que já preocupam os astrónomos.', ['satélite', 'internet'], { related: ['spacex'] }),
 ],
 medicina: [
  a('estetoscopio', 'anatomia', 1816, 'O estetoscópio', 'Laennec inventa o instrumento que permite ouvir o corpo por dentro.', 'A ideia surgiu para não encostar o ouvido ao peito das doentes.', ['anatomia', 'diagnóstico'] ),
  a('malaria-mosquito', 'doencas', 1897, 'O mosquito e a malária', 'Descobre-se que a malária é transmitida pela picada do mosquito.', 'Abriu caminho ao combate a uma das doenças mais mortíferas.', ['doenças', 'descoberta'], { related: ['pandemias-historia'] }),
  a('vitaminas', 'saude', 1912, 'As vitaminas', 'Percebe-se que faltas de certas substâncias causam doenças.', 'O escorbuto dos marinheiros era simples falta de vitamina C.', ['saúde', 'nutrição'] ),
  a('eletrocardiograma', 'anatomia', 1903, 'O eletrocardiograma', 'Uma máquina passa a registar os sinais elétricos do coração.', 'Valeu um Nobel ao seu inventor.', ['anatomia', 'coração'], { related: ['circulacao-sangue'] }),
  a('bebe-proveta', 'cirurgia', 1978, 'O primeiro bebé-proveta', 'Nasce Louise Brown, a primeira pessoa concebida por fertilização in vitro.', 'Hoje milhões de pessoas nasceram graças a esta técnica.', ['cirurgia', 'fertilidade'] ),
  a('dialise', 'cirurgia', 1943, 'O rim artificial', 'A diálise passa a substituir a função dos rins.', 'Mantém vivas milhões de pessoas com insuficiência renal.', ['cirurgia', 'órgãos'], { related: ['transplantes'] }),
  a('anticorpos-monoclonais', 'vacinas', 1975, 'Anticorpos em laboratório', 'Aprende-se a fabricar anticorpos "à medida" para tratar doenças.', 'São hoje usados contra o cancro e doenças autoimunes.', ['fármaco', 'imunologia'] ),
  a('imunoterapia', 'doencas', 2011, 'Imunoterapia contra o cancro', 'Tratamentos que ensinam o sistema imunitário a atacar tumores.', 'Valeram o Nobel da Medicina em 2018.', ['cancro', 'tratamento'] ),
 ],
 ambiente: [
  a('curva-keeling', 'clima', 1958, 'A curva de Keeling', 'A medição contínua do CO₂ mostra-o a subir ano após ano.', 'É um dos gráficos mais importantes da ciência do clima.', ['clima', 'co2'], { related: ['aquecimento-global'] }),
  a('ipcc', 'clima', 1988, 'O IPCC', 'O painel da ONU que reúne a ciência mundial sobre o clima.', 'Os seus relatórios orientam as políticas climáticas globais.', ['clima', 'ciência'], { related: ['acordo-paris'] }),
  a('grande-smog-londres', 'poluicao', 1952, 'O Grande Nevoeiro de Londres', 'Uma nuvem de poluição mata milhares de pessoas em poucos dias.', 'Levou às primeiras grandes leis do ar limpo.', ['poluição', 'ar'] ),
  a('chuva-acida', 'poluicao', 1972, 'As chuvas ácidas', 'A poluição das fábricas torna a chuva ácida e mata florestas e lagos.', 'Foi muito reduzida com filtros e acordos internacionais.', ['poluição', 'floresta'] ),
  a('protocolo-quioto', 'sustentabilidade', 1997, 'Protocolo de Quioto', 'O primeiro grande acordo a impor limites às emissões de CO₂.', 'Foi o antecessor do Acordo de Paris.', ['acordo', 'clima'], { related: ['acordo-paris'] }),
  a('fusao-ignicao', 'energia', 2022, 'Energia de fusão: a ignição', 'Um laboratório consegue, pela primeira vez, mais energia de fusão do que a gasta.', 'A fusão é a mesma reação que alimenta o Sol.', ['energia', 'futuro'], { related: ['estrutura-sol', 'energia-nuclear'] }),
  a('microplasticos', 'poluicao', 2004, 'Os microplásticos', 'Minúsculos pedaços de plástico já estão por todo o lado — até em nós.', 'Foram encontrados no sangue humano e no topo do Evereste.', ['poluição', 'plástico'], { related: ['poluicao-plastico'] }),
  a('amazonia', 'conservacao', 1990, 'A floresta amazónica', 'O maior pulmão verde do planeta sofre com a desflorestação.', 'Produz parte do oxigénio e regula o clima de todo o continente.', ['conservação', 'floresta'], { related: ['extincao-especies'] }),
 ],
 arte: [
  a('arte-bizantina', 'arquitetura', 537, 'A arte bizantina', 'Mosaicos dourados e a imponente Santa Sofia marcam o Oriente cristão.', 'A cúpula de Santa Sofia parecia "suspensa do céu".', ['bizâncio', 'arquitetura'], { place: 'Istambul' }),
  a('ukiyo-e', 'movimentos', 1830, 'As gravuras japonesas (ukiyo-e)', 'A "Grande Onda" de Hokusai e outras gravuras encantam o mundo.', 'Influenciaram fortemente os impressionistas europeus.', ['japão', 'gravura'], { people: ['hokusai'], related: ['impressionismo'] }),
  a('art-nouveau', 'movimentos', 1890, 'A Art Nouveau', 'Linhas curvas inspiradas na natureza invadem a arte e a arquitetura.', 'Gaudí levou-a ao extremo em Barcelona.', ['movimento', 'arquitetura'] ),
  a('expressionismo', 'movimentos', 1893, 'O Expressionismo', 'A arte foca-se na emoção crua, como em "O Grito" de Munch.', '"O Grito" tornou-se um símbolo da angústia moderna.', ['movimento', 'emoção'] ),
  a('bauhaus', 'arquitetura', 1919, 'A Bauhaus', 'Uma escola que une arte, design e indústria.', 'Definiu o aspeto limpo e funcional do design moderno.', ['design', 'arquitetura'], { related: ['arquitetura-moderna'] }),
  a('guernica', 'pintura', 1937, '"Guernica"', 'O grito de Picasso contra o horror da guerra.', 'Foi pintado após o bombardeamento de uma vila espanhola.', ['pintura', 'protesto'], { people: ['pablo-picasso'], related: ['cubismo'] }),
  a('frida-kahlo', 'pintura', 1939, 'Frida Kahlo', 'Autorretratos intensos que transformaram a dor em arte.', 'Tornou-se um ícone cultural mundial.', ['pintura', 'ícone'], { people: ['frida-kahlo'] }),
  a('street-art', 'movimentos', 1980, 'A arte urbana', 'O grafiti e o stencil levam a arte para as ruas.', 'Obras de Banksy valem hoje milhões em leilão.', ['movimento', 'urbano'], { related: ['arte-digital'] }),
 ],
 musica: [
  a('opera', 'generos', 1607, 'O nascimento da ópera', 'Música, teatro e cenário juntam-se num só espetáculo total.', 'A "Orfeu" de Monteverdi é uma das primeiras grandes óperas.', ['género', 'clássica'], { related: ['musica-classica'] }),
  a('partitura-impressa', 'tecnologia', 1501, 'A música impressa', 'Imprimir partituras espalha a música muito além das cortes.', 'Fez pela música o que Gutenberg fez pelos livros.', ['tecnologia', 'notação'], { related: ['notacao-musical', 'imprensa'] }),
  a('motown', 'generos', 1959, 'A Motown', 'Uma editora que levou a música negra americana ao topo das tabelas.', 'Lançou estrelas como Stevie Wonder e Marvin Gaye.', ['género', 'soul'] ),
  a('woodstock', 'artistas', 1969, 'Woodstock', 'O festival que se tornou símbolo da contracultura dos anos 60.', 'Juntou cerca de 400 mil pessoas numa quinta.', ['festival', 'rock'], { related: ['rock'] }),
  a('reggae', 'generos', 1968, 'O Reggae', 'Nasce na Jamaica e leva uma mensagem de paz e resistência ao mundo.', 'Bob Marley tornou-o um fenómeno global.', ['género', 'jamaica'] ),
  a('punk', 'generos', 1976, 'O Punk', 'Uma explosão crua e rebelde que dizia que qualquer um podia tocar.', 'Bastavam três acordes e muita atitude.', ['género', 'rock'], { related: ['rock'] }),
  a('mtv', 'tecnologia', 1981, 'A MTV e o videoclipe', 'A televisão musical torna a imagem tão importante como o som.', 'A primeira música emitida foi, a propósito, "Video Killed the Radio Star".', ['tecnologia', 'vídeo'] ),
  a('kpop', 'generos', 2012, 'O K-pop', 'A pop coreana conquista audiências em todo o mundo.', '"Gangnam Style" foi o primeiro vídeo a chegar a mil milhões no YouTube.', ['género', 'global'], { related: ['streaming-musica'] }),
 ],
 cinema: [
  a('technicolor', 'efeitos', 1939, 'A chegada da cor', '"O Feiticeiro de Oz" e "E Tudo o Vento Levou" deslumbram com Technicolor.', 'A passagem do sépia para a cor em Oz é mágica até hoje.', ['cor', 'efeitos'], { related: ['cinema-sonoro'] }),
  a('neorrealismo', 'realizadores', 1948, 'O Neorrealismo italiano', 'Filmes rodados na rua, com gente comum, após a guerra.', 'Influenciou cineastas em todo o mundo.', ['movimento', 'itália'] ),
  a('kurosawa', 'realizadores', 1954, 'Akira Kurosawa', 'O mestre japonês de "Os Sete Samurais", que inspirou Hollywood.', '"Star Wars" foi diretamente inspirado num dos seus filmes.', ['realizador', 'japão'], { people: ['akira-kurosawa'], related: ['star-wars'] }),
  a('nouvelle-vague', 'realizadores', 1960, 'A Nouvelle Vague', 'Jovens críticos franceses tornam-se realizadores e quebram as regras.', 'Filmavam com câmaras leves, na rua e com pouco dinheiro.', ['movimento', 'frança'] ),
  a('bollywood', 'estudios', 1913, 'Bollywood', 'A enorme indústria de cinema da Índia, cheia de música e dança.', 'Produz mais filmes por ano do que Hollywood.', ['estúdios', 'índia'] ),
  a('matrix-bullet-time', 'efeitos', 1999, '"Matrix" e o bullet time', 'O efeito de "parar o tempo" à volta da câmara fascina o mundo.', 'Foi copiado e parodiado durante anos.', ['efeitos', 'inovação'], { related: ['efeitos-cgi'] }),
  a('nanook', 'filmes', 1922, 'O documentário', '"Nanook do Norte" lança o cinema documental.', 'Mostrava a vida real, embora algumas cenas fossem encenadas.', ['documentário', 'história'] ),
  a('cannes', 'estudios', 1946, 'O Festival de Cannes', 'O mais prestigiado festival de cinema do mundo.', 'A sua Palma de Ouro é um dos maiores prémios do cinema.', ['festival', 'prestígio'] ),
 ],
 desporto: [
  a('wimbledon', 'recordes', 1877, 'Wimbledon e o ténis', 'O torneio de ténis mais antigo e prestigiado do mundo.', 'Mantém a tradição de os jogadores vestirem de branco.', ['ténis', 'tradição'] ),
  a('jordan-nba', 'recordes', 1991, 'Michael Jordan', 'O jogador que tornou o basquetebol e a NBA um fenómeno mundial.', 'As suas sapatilhas criaram uma indústria por si só.', ['basquetebol', 'lenda'], { people: ['michael-jordan'], related: ['basquetebol'] }),
  a('doping-ben-johnson', 'recordes', 1988, 'O escândalo do doping', 'Ben Johnson perde o ouro olímpico por doping, abalando o desporto.', 'Levou a controlos antidoping muito mais rígidos.', ['doping', 'ética'] ),
  a('maratona-feminina', 'atletismo', 1984, 'A maratona feminina olímpica', 'Só em 1984 as mulheres puderam correr a maratona nos Jogos.', 'Durante décadas, acharam que era perigosa para elas — sem razão.', ['atletismo', 'igualdade'], { related: ['maratona'] }),
  a('mundial-feminino', 'futebol', 1991, 'O Mundial de futebol feminino', 'O futebol feminino ganha o seu próprio Campeonato do Mundo.', 'As suas finais batem hoje recordes de público.', ['futebol', 'igualdade'], { related: ['mundial-futebol'] }),
  a('halo-f1', 'formula1', 2018, 'O "Halo" na Fórmula 1', 'Um arco de titânio passa a proteger a cabeça dos pilotos.', 'Já salvou várias vidas em acidentes espetaculares.', ['fórmula1', 'segurança'], { related: ['senna'] }),
  a('rugby', 'recordes', 1823, 'A origem do rugby', 'Diz a lenda que nasceu quando um aluno pegou na bola e correu.', 'Deu origem também ao futebol americano.', ['desporto', 'história'] ),
  a('jogos-1936-tv', 'olimpicos', 1936, 'Os primeiros Jogos na TV', 'Berlim 1936 são os primeiros Jogos Olímpicos transmitidos por televisão.', 'Também foram usados como propaganda pelo regime nazi.', ['olímpicos', 'média'], { related: ['jesse-owens'] }),
 ],
 cultura: [
  a('hinduismo', 'religiao', -1500, 'O Hinduísmo', 'Uma das religiões mais antigas ainda praticadas, nascida na Índia.', 'Não tem um único fundador nem um único livro sagrado.', ['religião', 'índia'] ),
  a('confucionismo', 'filosofia', -500, 'Confúcio', 'Os seus ensinamentos moldaram a ética e a sociedade da Ásia Oriental.', 'Centram-se no respeito, na família e na harmonia social.', ['filosofia', 'ásia'] ),
  a('estoicismo', 'filosofia', -300, 'O Estoicismo', 'Uma filosofia de vida que ensina a focar no que podemos controlar.', 'Voltou a estar muito na moda no mundo atual.', ['filosofia', 'ética'] ),
  a('direitos-mulher', 'filosofia', 1792, 'Os direitos das mulheres', 'Mary Wollstonecraft defende a igualdade das mulheres.', 'Foi uma das primeiras grandes vozes do feminismo.', ['direitos', 'igualdade'], { people: ['mary-wollstonecraft'], related: ['direitos-civis'] }),
  a('sufragio-universal', 'filosofia', 1893, 'O direito de voto', 'A Nova Zelândia é o primeiro país a dar voto às mulheres.', 'A maioria dos países só o fez no século XX.', ['direitos', 'democracia'], { related: ['direitos-mulher'] }),
  a('esperanto', 'lingua', 1887, 'O Esperanto', 'Uma língua criada de propósito para unir o mundo.', 'É falada por comunidades em dezenas de países.', ['língua', 'utopia'] ),
  a('patrimonio-unesco', 'tradicoes', 1972, 'O Património Mundial', 'A UNESCO passa a proteger lugares de valor para toda a humanidade.', 'Inclui desde pirâmides a florestas e centros históricos.', ['tradição', 'proteção'] ),
  a('emoji', 'lingua', 1999, 'Os emoji', 'Pequenos símbolos tornam-se uma nova linguagem global.', 'O primeiro conjunto foi criado no Japão para telemóveis.', ['língua', 'digital'], { related: ['smartphone-iphone'] }),
 ],
};

let added = 0, skipped = 0;
for (const [theme, items] of Object.entries(ADD)) {
  const url = new URL(`data/explore/${theme}.json`, ROOT);
  const data = JSON.parse(await readFile(url));
  const ids = new Set(data.items.map(i => i.id));
  let n = 0;
  for (const it of items) { if (ids.has(it.id)) { skipped++; continue; } data.items.push(it); n++; added++; }
  data.items.sort((x, y) => (x.year || 0) - (y.year || 0));
  await writeFile(url, JSON.stringify(data, null, 1) + '\n');
  console.log(`${theme.padEnd(10)} +${n} aprofundar (total ${data.items.length})`);
}
console.log(`\nadded ${added} · skipped ${skipped} (dup ids)`);
