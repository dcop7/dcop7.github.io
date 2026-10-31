/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — conteúdo curado (zonas, locais, espécies, descobertas).
   Os números vêm das referências em REFS; os dados medidos (batimetria,
   perfis, registos OBIS, taxonomia WoRMS) são gerados por tools/ocean/ e
   vivem em data/ocean/. Ver data/ocean/SOURCES.md.
   Este ficheiro também é importado em Node pelo pipeline (sem imports).
   ══════════════════════════════════════════════════════════════════════ */

export const ZONES = [
  { id: 'epi', name: 'Epipelágica', alias: 'Zona da luz solar', from: 0, to: 200, color: '#3aa7d8',
    text: 'Aqui chega luz suficiente para a fotossíntese. O fitoplâncton desta camada produz cerca de metade do oxigénio libertado pela fotossíntese na Terra e alimenta quase toda a vida que está por baixo. O vermelho desaparece nos primeiros metros, o amarelo e o verde a seguir; aos 200 m resta cerca de 1 % da luz da superfície, quase só azul.' },
  { id: 'meso', name: 'Mesopelágica', alias: 'Zona do crepúsculo', from: 200, to: 1000, color: '#2b5ea8',
    text: 'Ainda há luz, mas não chega para a fotossíntese. Muitos animais são prateados ou transparentes e escondem a silhueta com luz própria virada para baixo (contrailuminação). Todas as noites, milhares de milhões de peixes, crustáceos e lulas sobem para se alimentar perto da superfície e voltam a descer de madrugada — a maior migração de animais do planeta.' },
  { id: 'bathy', name: 'Batipelágica', alias: 'Zona da meia-noite', from: 1000, to: 4000, color: '#262f6b',
    text: 'A luz do Sol já não chega. A única luz é a que os próprios animais produzem: a maioria das espécies desta zona é bioluminescente. A temperatura fica entre 1 e 4 °C quase todo o ano, a comida é escassa e muitos predadores esperam em vez de perseguir — bocas enormes, estômagos elásticos, iscos luminosos.' },
  { id: 'abysso', name: 'Abissopelágica', alias: 'O abismo', from: 4000, to: 6000, color: '#1b1840',
    text: 'Cobre a maior parte do fundo do mar: as planícies abissais. O alimento é sobretudo a "neve marinha" que cai lentamente das camadas de cima. Os sedimentos acumulam-se a poucos milímetros por milénio, e em certas regiões o fundo está coberto de nódulos polimetálicos que crescem ainda mais devagar.' },
  { id: 'hadal', name: 'Hadal', alias: 'As fossas', from: 6000, to: 11000, color: '#120a24',
    text: 'Só existe dentro das fossas oceânicas, onde uma placa tectónica mergulha por baixo de outra. A pressão ultrapassa mil vezes a da superfície. Mesmo assim há vida até ao fundo: anfípodes, pepinos-do-mar, foraminíferos gigantes. Os peixes param a cerca de 8 200–8 400 m, provavelmente por um limite fisiológico.' },
];
export const zoneAt = d => ZONES.find(z => d < z.to) || ZONES[ZONES.length - 1];

/* Marcas na régua de profundidade — tudo medido ou documentado */
export const MARKERS = [
  { d: 200, t: '1 % da luz solar (água muito límpida)', ref: 'kd' },
  { d: 332, t: 'Mergulho recorde com garrafas (A. Gabr, 2014)', ref: 'gabr' },
  { d: 828, t: 'Altura do Burj Khalifa, se estivesse virado para baixo', ref: 'burj' },
  { d: 923, t: 'Batisfera de Beebe e Barton (1934)', ref: 'beebe' },
  { d: 1000, t: 'Deixa de haver luz solar detetável', ref: 'kd' },
  { d: 2992, t: 'Mergulho recorde de um mamífero: baleia-bicuda-de-Cuvier', ref: 'schorr' },
  { d: 3682, t: 'Profundidade média do oceano', ref: 'charette' },
  { d: 3800, t: 'Destroços do Titanic', ref: 'titanic' },
  { d: 6957, t: 'Polvo mais fundo observado (polvo-dumbo, fossa de Java)', ref: 'jamieson20' },
  { d: 8336, t: 'Peixe mais fundo filmado (peixe-caracol, fossa de Izu-Ogasawara, 2022)', ref: 'uwa23' },
  { d: 8849, t: 'Altura do Evereste — caberia na fossa e sobravam ~2 km de água', ref: 'everest' },
  { d: 10935, t: 'Challenger Deep, o ponto mais fundo medido (±6 m)', ref: 'greenaway' },
];

/* ── Locais de mergulho. Coordenadas = centro da grelha local GMRT. ── */
export const SITES = [
  { id: 'marianas', name: 'Fossa das Marianas', place: 'Challenger Deep · Pacífico ocidental', lat: 11.334, lon: 142.205,
    basin: 'POLYGON((125 0,170 0,170 30,125 30,125 0))', basinName: 'Pacífico ocidental (0–30° N, 125–170° E)',
    local: { s: 11.30, n: 11.37, w: 142.165, e: 142.245, res: 'max' },
    region: { s: 10.6, n: 12.2, w: 141.0, e: 143.8, res: 'med' },
    ref: 'greenaway', official: 10935,
    kind: 'Fossa oceânica', features: ['trench', 'hadalfloor'],
    text: 'A placa do Pacífico mergulha aqui por baixo da placa das Filipinas (subducção). O fundo da Challenger Deep é uma depressão alongada de sedimentos finos, com três "piscinas" principais. O valor de referência é 10 935 ± 6 m (Greenaway et al., 2021, com sensores de pressão de submersíveis); outras medições dão entre ~10 920 e ~10 985 m. A grelha GMRT usada aqui tem o seu próprio mínimo, que pode diferir alguns metros.' },
  { id: 'rainbow', name: 'Campo hidrotermal Rainbow', place: 'Dorsal Médio-Atlântica · Açores (Portugal)', lat: 36.23, lon: -33.902,
    basin: 'POLYGON((-50 25,-15 25,-15 45,-50 45,-50 25))', basinName: 'Atlântico nordeste (25–45° N, 15–50° W)',
    local: { s: 36.205, n: 36.255, w: -33.935, e: -33.870, res: 'max' },
    region: { s: 35.75, n: 36.75, w: -34.55, e: -33.25, res: 'med' },
    ref: 'charlou02', official: null,
    kind: 'Dorsal oceânica e fontes hidrotermais', features: ['ridge', 'vents'],
    text: 'Na Dorsal Médio-Atlântica as placas afastam-se ~2 cm por ano e nasce crosta nova. O Rainbow (descoberto em 1997) fica a ~2 300 m, para lá das 200 milhas dos Açores, sobre a plataforma continental estendida de Portugal, e assenta em rochas do manto (peridotitos serpentinizados). Os "fumadores negros" libertam fluidos a cerca de 365 °C, muito ácidos (pH ≈ 2,8) e ricos em hidrogénio, metano e ferro. Foi a primeira área marinha protegida designada por Portugal fora da sua Zona Económica Exclusiva, no âmbito da OSPAR.' },
  { id: 'ccz', name: 'Planície abissal Clarion-Clipperton', place: 'Pacífico central-oriental', lat: 13.8, lon: -116.6,
    basin: 'POLYGON((-150 0,-95 0,-95 25,-150 25,-150 0))', basinName: 'Pacífico oriental (0–25° N, 95–150° W)',
    local: { s: 13.77, n: 13.83, w: -116.635, e: -116.565, res: 'max' },
    region: { s: 13.0, n: 14.6, w: -117.4, e: -115.8, res: 'default' },
    ref: 'rabone23', official: null,
    kind: 'Planície abissal com nódulos', features: ['plain', 'nodules'],
    text: 'Uma área do tamanho dos EUA continentais entre as fraturas Clarion e Clipperton, a 4 000–5 500 m, com colinas abissais alongadas e o fundo coberto de nódulos de manganês, níquel, cobre e cobalto. É a região mais visada pela mineração em mar profundo. Um inventário de 2023 reuniu 5 578 espécies registadas, das quais se estima que 88–92 % ainda não tenham nome científico.' },
];

/* ── Espécies.
   depth: [mín, máx] do habitat típico (literatura, ver refs). core: faixa mais comum.
   rank: nível taxonómico mostrado (às vezes a ficha é de um género/família).
   sites: onde aparece ('*' = coluna de água de todos os locais).
   model: construtor procedural em o-fauna.mjs. Todos os modelos são reconstruções ilustrativas. */
export const SPECIES = [
  /* epipelágica */
  { id: 'physalia', pt: 'Caravela-portuguesa', sci: 'Physalia physalis', rank: 'species', depth: [0, 30], core: [0, 10], sites: '*', zone: 'epi', model: 'physalia', size: 0.25, biolum: false, mode: 'surface',
    text: 'Não é uma medusa: é uma colónia de organismos especializados (sifonóforo). O flutuador cheio de gás funciona como vela e é empurrado pelo vento; os tentáculos, com células urticantes poderosas, pendem normalmente vários metros abaixo e podem chegar a dezenas de metros.', refs: ['munro19'] },
  { id: 'thunnus', pt: 'Albacora', sci: 'Thunnus albacares', rank: 'species', depth: [0, 250], core: [0, 100], sites: '*', zone: 'epi', model: 'tuna', size: 1.4, biolum: false, mode: 'school', group: [5, 9],
    text: 'Atum dos mares tropicais e subtropicais. Passa a maior parte do tempo na camada misturada perto da superfície, com mergulhos ocasionais mais fundos. Como os outros atuns, conserva parte do calor dos músculos com trocadores de calor nos vasos sanguíneos, o que lhe permite nadar depressa e durante muito tempo.', refs: ['block01'] },
  { id: 'coryphaena', pt: 'Dourado', sci: 'Coryphaena hippurus', rank: 'species', depth: [0, 85], core: [0, 30], sites: '*', zone: 'epi', model: 'dorado', size: 1.0, biolum: false, mode: 'school', group: [2, 4],
    text: 'Peixe de águas quentes de mar aberto, muitas vezes junto a objetos flutuantes. Os machos adultos têm a testa quase vertical. Cresce muito depressa e vive poucos anos; as cores verde e dourada mudam rapidamente quando o peixe é stressado.', refs: ['fishbase'] },
  { id: 'physeter', pt: 'Cachalote', sci: 'Physeter macrocephalus', rank: 'species', depth: [0, 2000], core: [400, 1200], sites: '*', zone: 'meso', model: 'whale', size: 14, biolum: false, mode: 'hero',
    text: 'O maior predador com dentes. Nos mergulhos de alimentação desce habitualmente a 400–1 200 m e fica cerca de 45 minutos sem respirar, a caçar lulas por ecolocalização — os seus cliques estão entre os sons mais fortes produzidos por animais. Nos Açores é observado todo o ano.', refs: ['watwood06', 'mohl03'] },
  /* mesopelágica */
  { id: 'myctophid', pt: 'Peixes-lanterna', sci: 'Myctophidae', rank: 'family', depth: [0, 1500], core: [300, 1000], night: [10, 200], sites: '*', zone: 'meso', model: 'lantern', size: 0.08, biolum: true, mode: 'school', group: [25, 45],
    text: 'Uma família com ~250 espécies e, possivelmente, a maior biomassa de peixes do planeta. Cada espécie tem um padrão próprio de fotóforos (órgãos de luz) no corpo. De dia ficam a 300–1 000 m; à noite muitas sobem até aos 200 m de cima para comer zooplâncton — a migração vertical diária. As estimativas de biomassa mesopelágica variam muito (de ~1 a mais de 10 mil milhões de toneladas).', refs: ['irigoien14', 'catul11'] },
  { id: 'argyropelecus', pt: 'Peixe-machado', sci: 'Argyropelecus', rank: 'genus', depth: [100, 1500], core: [200, 650], sites: '*', zone: 'meso', model: 'hatchet', size: 0.07, biolum: true, mode: 'school', group: [4, 10],
    text: 'Corpo achatado e prateado como um espelho, olhos tubulares virados para cima para ver silhuetas contra a luz que vem de cima. Os fotóforos da barriga emitem luz azul com a intensidade da luz ambiente, apagando a sua própria sombra — contrailuminação.', refs: ['widder10'] },
  { id: 'cyclothone', pt: 'Peixes-boca-de-cerdas', sci: 'Cyclothone', rank: 'genus', depth: [300, 3000], core: [400, 1500], sites: '*', zone: 'meso', model: 'bristle', size: 0.05, biolum: true, mode: 'school', group: [12, 24],
    text: 'Pequenos (2–8 cm) e pouco conhecidos do público, mas provavelmente o género de vertebrados mais abundante da Terra: as redes de arrasto apanham-nos em todos os oceanos. As espécies mais fundas são pretas; as menos fundas, translúcidas.', refs: ['sutton08'] },
  { id: 'siphonophore', pt: 'Sifonóforo', sci: 'Siphonophorae', rank: 'order', depth: [0, 4000], core: [400, 1100], sites: '*', zone: 'meso', model: 'siphono', size: 6, biolum: true, mode: 'drift',
    text: 'Como a caravela-portuguesa, são colónias de "zooides" especializados: uns nadam, outros caçam, outros digerem ou reproduzem-se. Alguns fazem longas cortinas de tentáculos com dezenas de metros, entre os animais mais compridos do planeta. Muitos emitem luz azul quando tocados.', refs: ['munro19', 'haddock10'] },
  { id: 'vampyroteuthis', pt: 'Lula-vampira', sci: 'Vampyroteuthis infernalis', rank: 'species', depth: [500, 1500], core: [600, 1200], sites: '*', zone: 'meso', model: 'vampire', size: 0.25, biolum: true, mode: 'solo',
    text: 'Não é lula nem polvo: é o último representante de uma ordem própria. Vive na zona de mínimo de oxigénio, com metabolismo muito lento. Ao contrário do nome, não caça: recolhe neve marinha com dois filamentos retráteis. Quando ameaçada liberta das pontas dos braços uma nuvem de muco luminoso azul.', refs: ['hoving12', 'seibel97'] },
  /* batipelágica */
  { id: 'atolla', pt: 'Medusa-coroa', sci: 'Atolla wyvillei', rank: 'species', depth: [500, 4000], core: [800, 2000], sites: '*', zone: 'bathy', model: 'atolla', size: 0.15, biolum: true, mode: 'drift',
    text: 'Vermelho-escura — e o vermelho é invisível a esta profundidade porque a luz vermelha não chega cá abaixo. Quando atacada faz um "alarme" de luz azul que gira à volta do sino; a hipótese é que atraia um predador maior que coma o atacante. Um isco eletrónico que imita este padrão (o "e-jelly") ajudou a filmar a lula-gigante no seu habitat.', refs: ['widder10', 'widder19'] },
  { id: 'melanocetus', pt: 'Tamboril-de-profundidade', sci: 'Melanocetus johnsonii', rank: 'species', depth: [100, 4500], core: [1000, 2500], sites: '*', zone: 'bathy', model: 'angler', size: 0.15, biolum: true, mode: 'solo',
    text: 'A fêmea (até ~18 cm) espera imóvel com um isco luminoso na ponta de um espinho da barbatana dorsal; a luz vem de bactérias simbióticas. A boca e o estômago esticam o suficiente para engolir presas quase do seu tamanho. Os machos são muito mais pequenos.', refs: ['pietsch09'] },
  { id: 'eurypharynx', pt: 'Enguia-pelicano', sci: 'Eurypharynx pelecanoides', rank: 'species', depth: [500, 3000], core: [1200, 2000], sites: '*', zone: 'bathy', model: 'gulper', size: 0.75, biolum: true, mode: 'solo',
    text: 'A boca é enorme em relação ao corpo e abre como uma rede; come sobretudo pequenos crustáceos. Os olhos são minúsculos e a ponta da cauda tem um órgão luminoso. Os músculos são fracos: é um nadador lento.', refs: ['nielsen89'] },
  { id: 'anoplogaster', pt: 'Peixe-ogro', sci: 'Anoplogaster cornuta', rank: 'species', depth: [500, 5000], core: [500, 2000], sites: '*', zone: 'bathy', model: 'fangtooth', size: 0.16, biolum: false, mode: 'solo',
    text: 'Pequeno (até ~16 cm) mas com dentes enormes para o tamanho do corpo; os dois maiores encaixam em bolsas de cada lado do cérebro quando fecha a boca. Os juvenis vivem mais perto da superfície e são tão diferentes que foram descritos como outra espécie.', refs: ['fishbase'] },
  { id: 'grimpoteuthis', pt: 'Polvo-dumbo', sci: 'Grimpoteuthis', rank: 'genus', depth: [1000, 7000], core: [2000, 5000], sites: '*', zone: 'bathy', model: 'dumbo', size: 0.3, biolum: false, mode: 'nearfloor',
    text: 'Nada a bater as barbatanas da cabeça, que parecem orelhas. Vive perto do fundo e engole as presas inteiras. Um polvo-dumbo filmado a 6 957 m na fossa de Java (2019) é o cefalópode observado com segurança a maior profundidade.', refs: ['jamieson20'] },
  /* abissal (planície) */
  { id: 'psychropotes', pt: 'Pepino-do-mar-de-cauda', sci: 'Psychropotes longicauda', rank: 'species', depth: [2000, 6000], core: [3500, 5000], sites: ['ccz'], zone: 'abysso', model: 'psychro', size: 0.5, biolum: false, mode: 'benthic',
    text: 'Pepino-do-mar grande, gelatinoso, com um apêndice dorsal comprido que lembra uma cauda ou vela. Rasteja pelos sedimentos a ingerir a camada superficial rica em matéria orgânica. Também consegue nadar, ondulando o corpo.', refs: ['rabone23'] },
  { id: 'bathypterois', pt: 'Peixe-tripé', sci: 'Bathypterois', rank: 'genus', depth: [800, 5000], core: [1500, 4500], sites: ['ccz', 'rainbow'], zone: 'abysso', model: 'tripod', size: 0.3, biolum: false, mode: 'tripod',
    text: 'Fica "de pé" sobre três raios compridos e rígidos das barbatanas, virado para a corrente, com as barbatanas peitorais abertas como antenas para sentir as presas que passam. Assim fica acima da camada mais lenta da água junto ao fundo.', refs: ['fishbase'] },
  { id: 'coryphaenoides', pt: 'Granadeiros-abissais', sci: 'Coryphaenoides', rank: 'genus', depth: [2000, 4800], core: [2500, 4500], sites: ['ccz', 'rainbow'], zone: 'abysso', model: 'grenadier', size: 0.6, biolum: false, mode: 'nearfloor',
    text: 'Os granadeiros (C. armatus, C. yaquinae e outros) estão entre os peixes mais comuns nas câmaras com isco a mais de 2 000 m: chegam em minutos ao cheiro de comida. A cabeça grande afunila numa cauda longa e fina, daí os nomes ingleses "rattail" e "grenadier".', refs: ['fishbase'] },
  { id: 'xenophyophore', pt: 'Xenofióforos', sci: 'Xenophyophoroidea', rank: 'superfamily', depth: [500, 10700], core: [3000, 8000], sites: ['ccz', 'marianas'], zone: 'abysso', model: 'xeno', size: 0.1, biolum: false, mode: 'fixed',
    text: 'Cada um é uma única célula — um foraminífero gigante — que constrói uma carapaça frágil com grãos de sedimento e pode passar dos 10 cm. São muito abundantes nas planícies abissais e na Clarion-Clipperton, e foram filmados a 10 641 m na Sirena Deep, na Fossa das Marianas.', refs: ['gooday17', 'rabone23'] },
  /* fontes hidrotermais (Rainbow) */
  { id: 'rimicaris', pt: 'Camarão-das-fontes', sci: 'Rimicaris exoculata', rank: 'species', depth: [1600, 4000], core: [2200, 3700], sites: ['rainbow'], zone: 'bathy', model: 'shrimp', size: 0.05, biolum: false, mode: 'swarm',
    text: 'Forma enxames densos nas paredes das chaminés, nas zonas onde o fluido quente se mistura com a água fria. Não tem olhos normais, mas tem um órgão nas costas sensível a luz muito fraca. Vive em simbiose com bactérias que crescem na cabeça e nas brânquias e se alimentam dos compostos químicos do fluido.', refs: ['vandover89', 'zbinden20'] },
  { id: 'bathymodiolus', pt: 'Mexilhão-das-fontes', sci: 'Bathymodiolus azoricus', rank: 'species', depth: [800, 2400], core: [850, 2300], sites: ['rainbow'], zone: 'bathy', model: 'mussel', size: 0.08, biolum: false, mode: 'bed',
    text: 'Domina as fontes hidrotermais dos Açores menos fundas e, no Rainbow, as zonas onde o fluido está mais diluído. Nas brânquias tem dois tipos de bactérias simbióticas: umas usam enxofre, outras metano. Com essa energia química fabricam matéria orgânica sem luz solar.', refs: ['duperron06', 'zbinden20'] },
  { id: 'segonzacia', pt: 'Caranguejo-das-fontes', sci: 'Segonzacia mesatlantica', rank: 'species', depth: [800, 3700], core: [1700, 3500], sites: ['rainbow'], zone: 'bathy', model: 'crab', size: 0.07, biolum: false, mode: 'benthic', group: [2, 4],
    text: 'Caranguejo endémico das fontes hidrotermais da Dorsal Médio-Atlântica. Anda entre os mexilhões e os camarões e é ao mesmo tempo predador e necrófago.', refs: ['zbinden20'] },
  /* hadal (Marianas) */
  { id: 'pseudoliparis', pt: 'Peixe-caracol-das-Marianas', sci: 'Pseudoliparis swirei', rank: 'species', depth: [6200, 8200], core: [6900, 8000], sites: ['marianas'], zone: 'hadal', model: 'snailfish', size: 0.11, biolum: false, mode: 'nearfloor',
    text: 'Descrito em 2017 a partir de exemplares capturados entre ~6 900 e 8 000 m. O corpo é gelatinoso e o crânio não está completamente ossificado — ajuda a suportar a pressão. É o predador do topo nas fossas, sem concorrência de outros peixes, e come sobretudo anfípodes.', refs: ['gerringer17', 'yancey14'] },
  { id: 'hirondellea', pt: 'Anfípode-das-fossas', sci: 'Hirondellea gigas', rank: 'species', depth: [6000, 11000], core: [8000, 10950], sites: ['marianas'], zone: 'hadal', model: 'amphipod', size: 0.04, biolum: false, mode: 'swarm',
    text: 'Crustáceo necrófago que chega aos iscos em enxames, mesmo no fundo da Challenger Deep. Tem enzimas que digerem celulose, uma vantagem onde a comida mais disponível podem ser restos de plantas e madeira que caem até ao fundo.', refs: ['kobayashi12'] },
  { id: 'elpidiidae', pt: 'Pepinos-do-mar hadais', sci: 'Elpidiidae', rank: 'family', depth: [3000, 10700], core: [6000, 10000], sites: ['marianas', 'ccz'], zone: 'hadal', model: 'cucumber', size: 0.12, biolum: false, mode: 'benthic', group: [2, 5],
    text: 'Família de pepinos-do-mar das grandes profundidades, comum nas planícies abissais e dominante no fundo de várias fossas, onde comem os sedimentos que se acumulam na base. Muitos são translúcidos e quase sem pigmento; alguns andam sobre pés tubulares inchados.', refs: ['jamieson15'] },
];

/* ── elementos geológicos e fenómenos ── */
export const FEATURES = [
  { id: 'trench', name: 'Fossa oceânica', site: 'marianas', text: 'As fossas formam-se onde uma placa oceânica antiga e densa mergulha por baixo de outra. A Fossa das Marianas tem ~2 500 km de comprimento em arco; a Challenger Deep fica na extremidade sul. As paredes descem milhares de metros com declives que, em certos troços, passam os 20°.', refs: ['stern12', 'gmrt'] },
  { id: 'hadalfloor', name: 'Fundo da Challenger Deep', site: 'marianas', text: 'Sedimento fino e macio que se acumula no ponto mais baixo da fossa, trazido por pequenos deslizamentos das paredes. Foi aqui que pousaram o Trieste (1960), o Deepsea Challenger (2012) e o Limiting Factor (2019 em diante).', refs: ['greenaway'] },
  { id: 'ridge', name: 'Dorsal Médio-Atlântica', site: 'rainbow', text: 'Uma cordilheira com ~16 000 km no meio do Atlântico, onde as placas se afastam. No eixo há um vale central (rifte) com falhas e vulcões; a crosta fica mais velha e mais funda à medida que se afasta do eixo. Os Açores são parte emersa deste sistema.', refs: ['gmrt'] },
  { id: 'vents', name: 'Fumadores negros', site: 'rainbow', text: 'A água do mar entra nas fendas, aquece perto do magma e reage com as rochas. Volta a sair a centenas de graus, carregada de metais dissolvidos; ao misturar-se com a água a ~3 °C os sulfuretos de metais precipitam — o "fumo" preto — e constroem chaminés. A energia química sustenta ecossistemas que não dependem da luz solar.', refs: ['charlou02', 'zbinden20'] },
  { id: 'plain', name: 'Planície abissal', site: 'ccz', text: 'As zonas planas mais extensas da Terra, cobertas de sedimentos finos (argilas e restos de plâncton). Na Clarion-Clipperton o relevo é de colinas abissais paralelas, com dezenas a centenas de metros de altura, alinhadas com a direção da crosta original.', refs: ['gmrt'] },
  { id: 'nodules', name: 'Nódulos polimetálicos', site: 'ccz', text: 'Concreções do tamanho de uma batata que crescem alguns milímetros por milhão de anos à volta de um núcleo (um dente de tubarão, um fragmento de rocha). Muitos animais só vivem fixos nestes nódulos — removê-los elimina o seu habitat. Um estudo de 2024 propôs que produzem oxigénio no escuro ("oxigénio escuro"); a hipótese é contestada e está a ser testada.', refs: ['rabone23', 'sweetman24'] },
];

export const DISCOVERIES = [
  { y: 1875, t: 'O navio HMS Challenger sonda 8 184 m (4 475 braças) perto das Marianas com uma linha e um peso. A Challenger Deep tem o nome dele.', ref: 'challenger' },
  { y: 1934, t: 'William Beebe e Otis Barton descem a 923 m numa esfera de aço suspensa por um cabo e descrevem pela primeira vez animais luminosos vistos ao vivo.', ref: 'beebe' },
  { y: 1960, t: 'Jacques Piccard e Don Walsh chegam ao fundo da Challenger Deep no batiscafo Trieste.', ref: 'greenaway' },
  { y: 1977, t: 'O submersível Alvin descobre fontes hidrotermais com ecossistemas inteiros no rifte das Galápagos — vida que não depende da luz do Sol.', ref: 'corliss79' },
  { y: 2012, t: 'James Cameron desce sozinho à Challenger Deep no Deepsea Challenger.', ref: 'greenaway' },
  { y: 2014, t: 'Baleias-bicudas-de-Cuvier com marcas de satélite mergulham a 2 992 m: recorde dos mamíferos.', ref: 'schorr' },
  { y: 2017, t: 'É descrito o peixe-caracol-das-Marianas, capturado entre ~6 900 e 8 000 m.', ref: 'gerringer17' },
  { y: 2019, t: 'Um polvo-dumbo é filmado a 6 957 m na fossa de Java.', ref: 'jamieson20' },
  { y: 2021, t: 'Medições de pressão de mergulhos tripulados fixam a Challenger Deep em 10 935 ± 6 m.', ref: 'greenaway' },
  { y: 2022, t: 'Um peixe-caracol juvenil é filmado a 8 336 m na fossa de Izu-Ogasawara (publicado em 2023).', ref: 'uwa23' },
  { y: 2023, t: 'O primeiro inventário da Clarion-Clipperton reúne 5 578 espécies, a maioria por descrever.', ref: 'rabone23' },
];

export const REFS = {
  greenaway: { c: 'Greenaway S. et al. (2021). Revised depth of the Challenger Deep from submersible transects. Deep-Sea Research I 178:103644.', u: 'https://doi.org/10.1016/j.dsr.2021.103644' },
  gmrt: { c: 'Ryan W.B.F. et al. (2009). Global Multi-Resolution Topography synthesis. G³ 10:Q03014. Dados GMRT (CC BY 4.0).', u: 'https://www.gmrt.org/' },
  woa23: { c: 'Locarnini R.A. et al.; Garcia H.E. et al. (2024). World Ocean Atlas 2023 — temperatura, salinidade, oxigénio. NOAA NCEI.', u: 'https://www.ncei.noaa.gov/products/world-ocean-atlas' },
  obis: { c: 'OBIS (2026). Ocean Biodiversity Information System. IOC-UNESCO. Registos de ocorrência.', u: 'https://obis.org/' },
  worms: { c: 'WoRMS Editorial Board (2026). World Register of Marine Species (CC BY 4.0).', u: 'https://www.marinespecies.org/' },
  saunders81: { c: 'Saunders P.M. (1981). Practical conversion of pressure to depth. J. Phys. Oceanogr. 11:573–574.', u: 'https://doi.org/10.1175/1520-0485(1981)011%3C0573:PCOPTD%3E2.0.CO;2' },
  unesco83: { c: 'Fofonoff N.P., Millard R.C. (1983). Algorithms for computation of fundamental properties of seawater. UNESCO Tech. Pap. Mar. Sci. 44.', u: 'https://unesdoc.unesco.org/ark:/48223/pf0000059832' },
  kd: { c: 'Morel A. et al. (2007). Optical properties of the "clearest" natural waters. Limnol. Oceanogr. 52:217–229.', u: 'https://doi.org/10.4319/lo.2007.52.1.0217' },
  taira05: { c: 'Taira K. et al. (2005). Deep and bottom currents in the Challenger Deep, Mariana Trench. J. Oceanogr. 61:447–454.', u: 'https://doi.org/10.1007/s10872-005-0053-z' },
  charlou02: { c: 'Charlou J.L. et al. (2002). Geochemistry of high H₂ and CH₄ vent fluids issuing from ultramafic rocks at the Rainbow hydrothermal field (36°14′N, MAR). Chem. Geol. 191:345–359.', u: 'https://doi.org/10.1016/S0009-2541(02)00134-1' },
  zbinden20: { c: 'Zbinden M., Cambon-Bonavita M.-A. (2020). Rimicaris exoculata: biology and ecology of a shrimp from deep-sea hydrothermal vents. MEPS 652:187–222.', u: 'https://doi.org/10.3354/meps13467' },
  rabone23: { c: 'Rabone M. et al. (2023). How many metazoan species live in the world\'s largest mineral exploration region? Current Biology 33:2383–2396.', u: 'https://doi.org/10.1016/j.cub.2023.04.052' },
  sweetman24: { c: 'Sweetman A.K. et al. (2024). Evidence of dark oxygen production at the abyssal seafloor. Nature Geoscience 17:737–739 (contestado).', u: 'https://doi.org/10.1038/s41561-024-01480-8' },
  gerringer17: { c: 'Gerringer M.E. et al. (2017). Pseudoliparis swirei sp. nov.: a newly-discovered hadal snailfish from the Mariana Trench. Zootaxa 4358:161–177.', u: 'https://doi.org/10.11646/zootaxa.4358.1.7' },
  yancey14: { c: 'Yancey P.H. et al. (2014). Marine fish may be biochemically constrained from inhabiting the deepest ocean depths. PNAS 111:4461–4465.', u: 'https://doi.org/10.1073/pnas.1322003111' },
  uwa23: { c: 'University of Western Australia / Tokyo Univ. of Marine Science and Technology (2023). Peixe-caracol filmado a 8 336 m (Izu-Ogasawara, ago. 2022).', u: 'https://www.uwa.edu.au/news/article/2023/april/uwa-scientists-film-and-catch-deepest-fish-on-record' },
  jamieson20: { c: 'Jamieson A.J., Vecchione M. (2020). First in situ observation of Cephalopoda at hadal depths. Marine Biology 167:82.', u: 'https://doi.org/10.1007/s00227-020-03701-1' },
  jamieson15: { c: 'Jamieson A.J. (2015). The Hadal Zone: Life in the Deepest Oceans. Cambridge University Press.', u: 'https://doi.org/10.1017/CBO9781139061384' },
  kobayashi12: { c: 'Kobayashi H. et al. (2012). The hadal amphipod Hirondellea gigas possessing a unique cellulase. PLoS ONE 7:e42727.', u: 'https://doi.org/10.1371/journal.pone.0042727' },
  gooday17: { c: 'Scripps Institution of Oceanography (2011). Xenofióforos identificados a 10 641 m na Sirena Deep (Fossa das Marianas) por L. Levin e A. Gooday.', u: 'https://scripps.ucsd.edu/news/scientists-id-giant-amoebas-extreme-deep' },
  schorr: { c: 'Schorr G.S. et al. (2014). First long-term behavioral records from Cuvier\'s beaked whales reveal record-breaking dives. PLoS ONE 9:e92633.', u: 'https://doi.org/10.1371/journal.pone.0092633' },
  watwood06: { c: 'Watwood S.L. et al. (2006). Deep-diving foraging behaviour of sperm whales. J. Anim. Ecol. 75:814–825.', u: 'https://doi.org/10.1111/j.1365-2656.2006.01101.x' },
  mohl03: { c: 'Møhl B. et al. (2003). The monopulsed nature of sperm whale clicks. JASA 114:1143–1154.', u: 'https://doi.org/10.1121/1.1586258' },
  irigoien14: { c: 'Irigoien X. et al. (2014). Large mesopelagic fishes biomass and trophic efficiency in the open ocean. Nature Communications 5:3271.', u: 'https://doi.org/10.1038/ncomms4271' },
  catul11: { c: 'Catul V. et al. (2011). A review on mesopelagic fishes belonging to family Myctophidae. Rev. Fish Biol. Fish. 21:339–354.', u: 'https://doi.org/10.1007/s11160-010-9176-4' },
  sutton08: { c: 'Sutton T.T. et al. (2008). Vertical structure, biomass and topographic association of deep-pelagic fishes in relation to a mid-ocean ridge system. DSR II 55:161–184.', u: 'https://doi.org/10.1016/j.dsr2.2007.09.013' },
  widder10: { c: 'Widder E.A. (2010). Bioluminescence in the ocean: origins of biological, chemical, and ecological diversity. Science 328:704–708.', u: 'https://doi.org/10.1126/science.1174269' },
  widder19: { c: 'NOAA Ocean Exploration (2019). Journey into Midnight — lula-gigante filmada com o isco "e-jelly".', u: 'https://oceanexplorer.noaa.gov/explorations/19biolum/' },
  haddock10: { c: 'Haddock S.H.D., Moline M.A., Case J.F. (2010). Bioluminescence in the sea. Annu. Rev. Mar. Sci. 2:443–493.', u: 'https://doi.org/10.1146/annurev-marine-120308-081028' },
  munro19: { c: 'Munro C. et al. (2019). Morphology and development of the Portuguese man of war, Physalia physalis. Scientific Reports 9:15522.', u: 'https://doi.org/10.1038/s41598-019-51842-1' },
  block01: { c: 'Block B.A. et al. (2001). Migratory movements, depth preferences, and thermal biology of Atlantic bluefin tuna. Science 293:1310–1314 (fisiologia térmica dos atuns).', u: 'https://doi.org/10.1126/science.1061197' },
  hoving12: { c: 'Hoving H.J.T., Robison B.H. (2012). Vampire squid: detritivores in the oxygen minimum zone. Proc. R. Soc. B 279:4559–4567.', u: 'https://doi.org/10.1098/rspb.2012.1357' },
  seibel97: { c: 'Seibel B.A., Thuesen E.V., Childress J.J. (1997). Metabolism of Vampyroteuthis infernalis. Biol. Bull. 192:262–278.', u: 'https://doi.org/10.2307/1542720' },
  pietsch09: { c: 'Pietsch T.W. (2009). Oceanic Anglerfishes: Extraordinary Diversity in the Deep Sea. University of California Press.', u: 'https://www.ucpress.edu/book/9780520255425/oceanic-anglerfishes' },
  nielsen89: { c: 'Nielsen J.G., Bertelsen E., Jespersen Å. (1989). The biology of Eurypharynx pelecanoides. Acta Zoologica 70:187–197.', u: 'https://doi.org/10.1111/j.1463-6395.1989.tb01069.x' },
  rogacheva12: { c: 'Rogacheva A., Gebruk A., Alt C.H.S. (2012). Holothuroidea of the Charlie Gibbs Fracture Zone area. Mar. Biol. Res. 9:587–623 (e revisões de Elpidiidae).', u: 'https://doi.org/10.1080/17451000.2012.750428' },
  vandover89: { c: 'Van Dover C.L. et al. (1989). A novel eye in "eyeless" shrimp from hydrothermal vents of the Mid-Atlantic Ridge. Nature 337:458–460.', u: 'https://doi.org/10.1038/337458a0' },
  duperron06: { c: 'Duperron S. et al. (2006). A dual symbiosis shared by two mussel species, Bathymodiolus azoricus and B. puteoserpentis. Environ. Microbiol. 8:1441–1447.', u: 'https://doi.org/10.1111/j.1462-2920.2006.01038.x' },
  stern12: { c: 'Stern R.J. et al. (2012). To understand subduction initiation, study forearc crust. Lithosphere 4:469–483 (sistema Izu-Bonin-Marianas).', u: 'https://doi.org/10.1130/L183.1' },
  corliss79: { c: 'Corliss J.B. et al. (1979). Submarine thermal springs on the Galápagos Rift. Science 203:1073–1083.', u: 'https://doi.org/10.1126/science.203.4385.1073' },
  challenger: { c: 'Report on the Scientific Results of the Voyage of H.M.S. Challenger (1873–76), Narrative.', u: 'https://www.19thcenturyscience.org/HMSC/HMSC-INDEX/index-linked.htm' },
  beebe: { c: 'Beebe W. (1934). Half Mile Down. Harcourt, Brace. Recorde de 3 028 pés (923 m), ao largo das Bermudas.', u: 'https://en.wikipedia.org/wiki/Bathysphere' },
  gabr: { c: 'Guinness World Records — Deepest SCUBA dive (male): 332,35 m, Ahmed Gabr, 2014.', u: 'https://www.guinnessworldrecords.com/world-records/deepest-scuba-dive-(male)' },
  burj: { c: 'Council on Tall Buildings and Urban Habitat — Burj Khalifa, 828 m.', u: 'https://www.skyscrapercenter.com/building/burj-khalifa/3' },
  charette: { c: 'Charette M.A., Smith W.H.F. (2010). The volume of Earth\'s ocean. Oceanography 23:112–114.', u: 'https://doi.org/10.5670/oceanog.2010.51' },
  titanic: { c: 'NOAA — RMS Titanic, destroços a ~3 800 m.', u: 'https://www.noaa.gov/office-of-general-counsel/gc-international-section/rms-titanic-history-and-significance' },
  everest: { c: 'Nepal/China (2020) — altura oficial do Evereste: 8 848,86 m.', u: 'https://en.wikipedia.org/wiki/Mount_Everest' },
  fishbase: { c: 'Froese R., Pauly D. (eds.) FishBase — fichas de espécie (profundidades e biologia).', u: 'https://www.fishbase.se/' },
};
