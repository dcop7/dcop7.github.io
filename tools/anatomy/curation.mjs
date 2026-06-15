/* ──────────────────────────────────────────────────────────────────────────
   Curated anatomy for the Corpo Humano atlas.
   - SYSTEMS: the top-level anatomical systems (the primary navigation axis).
   - STRUCTURES: which BodyParts3D parts to include, grouped per system, with
     our own PT/EN educational copy (names / function / location / facts).
       fma:   explicit FMA ids to include (if present in the zip)
       match: case-insensitive regex on the English part name — auto-captures
              left/right + variants. `exclude` trims false positives.
     A structure resolves to ALL present ids; multiple meshes (e.g. left+right,
     or every rib) merge into ONE pickable named node.
   Names authored by us → no licensing tie to the meshes.
   ────────────────────────────────────────────────────────────────────────── */

export const SYSTEMS = [
  { id:'esqueletico',  emoji:'🦴', color:'#e6e8ee', pt:'Sistema Esquelético', en:'Skeletal system',
    desc_pt:'A estrutura de 206 ossos que te sustenta, protege os órgãos, permite o movimento e fabrica sangue na medula.',
    desc_en:'The 206-bone frame that supports you, protects organs, enables movement and makes blood in its marrow.' },
  { id:'muscular',     emoji:'💪', color:'#cf6f6f', pt:'Sistema Muscular', en:'Muscular system',
    desc_pt:'Mais de 600 músculos que movem o corpo, mantêm a postura e geram calor. Os esqueléticos são voluntários.',
    desc_en:'Over 600 muscles that move the body, hold posture and make heat. The skeletal ones are voluntary.' },
  { id:'circulatorio', emoji:'❤️', color:'#e0414f', pt:'Sistema Circulatório', en:'Circulatory system',
    desc_pt:'O coração e ~100 000 km de vasos levam oxigénio e nutrientes a cada célula e trazem de volta os resíduos.',
    desc_en:'The heart and ~100,000 km of vessels carry oxygen and nutrients to every cell and bring waste back.' },
  { id:'respiratorio', emoji:'🫁', color:'#5fb0e0', pt:'Sistema Respiratório', en:'Respiratory system',
    desc_pt:'Leva o ar aos pulmões, onde o oxigénio entra no sangue e o dióxido de carbono sai. ~20 000 respirações/dia.',
    desc_en:'Brings air to the lungs, where oxygen enters the blood and carbon dioxide leaves. ~20,000 breaths a day.' },
  { id:'nervoso',      emoji:'🧠', color:'#efc663', pt:'Sistema Nervoso', en:'Nervous system',
    desc_pt:'O cérebro, a medula espinal e os nervos — a rede de comando que sente, pensa e controla todo o corpo.',
    desc_en:'The brain, spinal cord and nerves — the command network that senses, thinks and controls the whole body.' },
  { id:'digestivo',    emoji:'🍽️', color:'#dca15c', pt:'Sistema Digestivo', en:'Digestive system',
    desc_pt:'Um tubo de ~9 m que transforma a comida em energia e nutrientes e expulsa o que não se aproveita.',
    desc_en:'A ~9 m tube that turns food into energy and nutrients and expels what is not used.' },
  { id:'urinario',     emoji:'💧', color:'#74c7a6', pt:'Sistema Urinário', en:'Urinary system',
    desc_pt:'Os rins filtram o sangue e formam a urina, que os ureteres levam à bexiga para ser eliminada.',
    desc_en:'The kidneys filter the blood and make urine, which the ureters carry to the bladder to be removed.' },
  { id:'sentidos',     emoji:'👁️', color:'#b08fd9', pt:'Órgãos dos Sentidos', en:'Sense organs',
    desc_pt:'Os cinco sentidos — visão, audição, olfato, paladar e tato — recolhem informação do mundo e enviam-na ao cérebro para a interpretar.',
    desc_en:'The five senses — sight, hearing, smell, taste and touch — gather information about the world and send it to the brain to interpret.' },
];

const S = (system, key, pt, en, fn_pt, fn_en, loc_pt, loc_en, opts = {}) =>
  ({ system, key, pt, en, fn_pt, fn_en, loc_pt, loc_en,
     facts_pt: opts.facts_pt || [], facts_en: opts.facts_en || [],
     fma: opts.fma, match: opts.match, exclude: opts.exclude });

export const STRUCTURES = [
  /* ───────────────────────── ESQUELÉTICO ───────────────────────── */
  S('esqueletico','cranio','Crânio','Skull','Protege o cérebro e dá forma à cara.','Protects the brain and shapes the face.','Cabeça','Head',
    { match:'(frontal bone|parietal bone|temporal bone|occipital bone|sphenoid|ethmoid|maxilla|zygomatic bone|nasal bone|lacrimal bone|vomer|palatine bone|inferior nasal concha)', facts_pt:['É feito de 22 ossos, quase todos fundidos.'], facts_en:['Made of 22 bones, nearly all fused together.'] }),
  S('esqueletico','mandibula','Mandíbula','Mandible','O único osso móvel da cabeça; permite mastigar e falar.','The only movable bone of the head; lets you chew and talk.','Maxilar inferior','Lower jaw',
    { match:'^mandible$', facts_pt:['É o osso mais forte e duro da face.'], facts_en:['It is the strongest, hardest bone of the face.'] }),
  S('esqueletico','coluna','Coluna vertebral','Vertebral column','Sustenta o tronco e protege a medula espinal.','Supports the trunk and protects the spinal cord.','Costas','Back',
    { match:'vertebra$', exclude:'arch|process|body of|cornu', facts_pt:['Tem 33 vértebras; um adulto fica com 24 móveis.'], facts_en:['Has 33 vertebrae; an adult keeps 24 movable ones.'] }),
  S('esqueletico','costelas','Costelas','Ribs','Formam a caixa torácica que protege o coração e os pulmões.','Form the rib cage that shields the heart and lungs.','Tórax','Chest',
    { match:'(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) rib$', facts_pt:['São 12 pares; os dois últimos são "flutuantes".'], facts_en:['12 pairs; the last two are "floating" ribs.'] }),
  S('esqueletico','esterno','Esterno','Sternum','Osso central do peito onde se ligam as costelas.','Central chest bone where the ribs attach.','Centro do tórax','Centre of chest',
    { match:'(manubrium|sternum|xiphoid)' }),
  S('esqueletico','clavicula','Clavícula','Clavicle','Liga o braço ao tronco; é o osso que mais frequentemente parte.','Links the arm to the trunk; the most commonly broken bone.','Ombro','Shoulder',
    { match:'^(left |right )?clavicle$' }),
  S('esqueletico','omoplata','Omoplata','Scapula','Osso triangular que ancora os músculos do ombro.','Triangular bone that anchors the shoulder muscles.','Costas, no ombro','Upper back',
    { match:'^(left |right )?scapula$' }),
  S('esqueletico','umero','Úmero','Humerus','O osso do braço, entre o ombro e o cotovelo.','The arm bone, between shoulder and elbow.','Braço','Upper arm',
    { match:'^(left |right )?humerus$' }),
  S('esqueletico','radio_ulna','Rádio e cúbito','Radius & ulna','Os dois ossos do antebraço que permitem rodar a mão.','The two forearm bones that let the hand rotate.','Antebraço','Forearm',
    { match:'^(left |right )?(radius|ulna)$' }),
  S('esqueletico','mao','Ossos da mão','Hand bones','27 ossos que dão à mão a sua destreza única.','27 bones that give the hand its unique dexterity.','Mão e punho','Hand and wrist',
    { match:'(metacarpal|phalanx of .*hand|carpal|scaphoid|lunate|trapezium|capitate|hamate)', exclude:'foot', facts_pt:['Cada mão tem 27 ossos — um quarto dos ossos do corpo.'], facts_en:['Each hand has 27 bones — a quarter of all the body’s bones.'] }),
  S('esqueletico','pelve','Pélvis','Pelvis','Anel ósseo que suporta o peso e protege os órgãos inferiores.','Bony ring that bears weight and protects the lower organs.','Anca','Hip',
    { match:'^(pelvis|hip bone|left hip bone|right hip bone|coxal bone)$' }),
  S('esqueletico','sacro','Sacro','Sacrum','Base da coluna que se encaixa na pélvis.','Base of the spine that wedges into the pelvis.','Base das costas','Lower back',
    { match:'^(sacrum|coccyx)$' }),
  S('esqueletico','femur','Fémur','Femur','O osso mais longo e forte do corpo; o osso da coxa.','The longest, strongest bone in the body; the thigh bone.','Coxa','Thigh',
    { match:'^(left |right )?femur$', facts_pt:['Aguenta cerca de 30× o teu peso corporal.'], facts_en:['It can bear about 30× your body weight.'] }),
  S('esqueletico','rotula','Rótula','Patella','Protege o joelho e melhora a força do movimento.','Protects the knee and boosts movement power.','Joelho','Knee',
    { match:'^(left |right )?patella$' }),
  S('esqueletico','tibia_fibula','Tíbia e perónio','Tibia & fibula','Os ossos da perna que suportam o peso até ao tornozelo.','The lower-leg bones that carry weight to the ankle.','Perna','Lower leg',
    { match:'^(left |right )?(tibia|fibula)$' }),
  S('esqueletico','pe','Ossos do pé','Foot bones','26 ossos que suportam o corpo e absorvem o impacto ao andar.','26 bones that hold up the body and absorb each step.','Pé e tornozelo','Foot and ankle',
    { match:'(metatarsal|phalanx of .*foot|calcaneus|talus|tarsal|navicular|cuboid|cuneiform)', facts_pt:['O calcâneo (calcanhar) é o maior osso do pé.'], facts_en:['The calcaneus (heel) is the largest bone of the foot.'] }),

  /* ───────────────────────── MUSCULAR ───────────────────────── */
  S('muscular','peitoral','Peitoral maior','Pectoralis major','Aproxima o braço do peito; usado a empurrar e abraçar.','Pulls the arm across the chest; used to push and hug.','Peito','Chest',
    { match:'pectoralis major', facts_pt:['É o músculo que dá forma ao peito.'], facts_en:['It is the muscle that shapes the chest.'] }),
  S('muscular','deltoide','Deltoide','Deltoid','Levanta o braço em qualquer direção; arredonda o ombro.','Raises the arm in any direction; rounds the shoulder.','Ombro','Shoulder',
    { match:'\\bdeltoid\\b', exclude:'ligament' }),
  S('muscular','biceps','Bíceps braquial','Biceps brachii','Dobra o cotovelo e roda o antebraço.','Bends the elbow and rotates the forearm.','Frente do braço','Front of upper arm',
    { match:'biceps brachii', facts_pt:['O nome significa "duas cabeças".'], facts_en:['The name means "two heads".'] }),
  S('muscular','triceps','Tríceps braquial','Triceps brachii','Estende o cotovelo; usado a empurrar.','Straightens the elbow; used to push.','Trás do braço','Back of upper arm',
    { match:'triceps brachii' }),
  S('muscular','abdominal','Reto abdominal','Rectus abdominis','Dobra o tronco para a frente; o famoso "six-pack".','Bends the trunk forward; the famous "six-pack".','Barriga','Belly',
    { match:'rectus abdominis' }),
  S('muscular','trapezio','Trapézio','Trapezius','Move e estabiliza a omoplata; encolhe os ombros.','Moves and steadies the shoulder blade; shrugs.','Pescoço e costas','Neck and upper back',
    { match:'trapezius' }),
  S('muscular','grandedorsal','Grande dorsal','Latissimus dorsi','Puxa o braço para baixo e para trás; o músculo das "asas".','Pulls the arm down and back; the "wings" muscle.','Costas','Back',
    { match:'latissimus dorsi' }),
  S('muscular','ecm','Esternocleidomastoideu','Sternocleidomastoid','Roda e inclina a cabeça.','Turns and tilts the head.','Lateral do pescoço','Side of neck',
    { match:'sternocleidomastoid' }),
  S('muscular','gluteo','Glúteo máximo','Gluteus maximus','O maior músculo do corpo; endireita a anca ao andar e subir.','The body’s largest muscle; extends the hip to walk and climb.','Nádega','Buttock',
    { match:'gluteus maximus', facts_pt:['É o maior músculo do corpo humano.'], facts_en:['It is the largest muscle in the human body.'] }),
  S('muscular','quadriceps','Quadríceps','Quadriceps','Estende o joelho; essencial para andar, correr e saltar.','Straightens the knee; key to walking, running and jumping.','Frente da coxa','Front of thigh',
    { match:'(rectus femoris|vastus lateralis|vastus medialis|vastus intermedius)' }),
  S('muscular','isquiotibiais','Isquiotibiais','Hamstrings','Dobram o joelho e estendem a anca.','Bend the knee and extend the hip.','Trás da coxa','Back of thigh',
    { match:'(biceps femoris|semitendinosus|semimembranosus)' }),
  S('muscular','gemeos','Gémeos','Gastrocnemius','Levanta o calcanhar; impulsiona cada passo e salto.','Lifts the heel; powers each step and jump.','Barriga da perna','Calf',
    { match:'(gastrocnemius|soleus)' }),
  S('muscular','sartorio','Sartório','Sartorius','O músculo mais longo do corpo; cruza a perna.','The longest muscle in the body; crosses the leg.','Coxa','Thigh',
    { match:'sartorius', facts_pt:['É o músculo mais comprido do corpo humano.'], facts_en:['It is the longest muscle in the human body.'] }),
  S('muscular','masseter','Masséter','Masseter','O músculo da mastigação; um dos mais fortes pelo seu tamanho.','The chewing muscle; one of the strongest for its size.','Bochecha','Cheek',
    { match:'masseter' }),

  /* ───────────────────────── CIRCULATÓRIO ───────────────────────── */
  S('circulatorio','coracao','Coração','Heart','Bombeia o sangue por todo o corpo, ~100 000 vezes por dia.','Pumps blood through the whole body ~100,000 times a day.','Centro do peito','Centre of chest',
    { match:'(wall of heart|papillary muscle|interventricular|chordae|trabeculae|cardiac)', facts_pt:['Bate cerca de 100 000 vezes por dia.','Tem quatro câmaras.'], facts_en:['Beats about 100,000 times a day.','It has four chambers.'] }),
  S('circulatorio','aorta','Aorta','Aorta','A maior artéria; leva o sangue oxigenado do coração ao corpo.','The largest artery; carries oxygen-rich blood from the heart.','Do coração para baixo','From the heart downward',
    { match:'aorta', facts_pt:['Tem cerca de 2,5 cm de diâmetro.'], facts_en:['It is about 2.5 cm wide.'] }),
  S('circulatorio','arterias','Artérias principais','Main arteries','Levam o sangue rico em oxigénio do coração até à cabeça, braços, abdómen e pernas.','Carry oxygen-rich blood from the heart to the head, arms, abdomen and legs.','Por todo o corpo','Throughout the body',
    { match:'artery', exclude:'pulmonary|coronary', facts_pt:['As carótidas alimentam o cérebro; as ilíacas, as pernas.'], facts_en:['The carotids feed the brain; the iliacs, the legs.'] }),
  S('circulatorio','veias','Veias principais','Main veins','Devolvem ao coração o sangue já usado pelos tecidos.','Return blood already used by the tissues back to the heart.','Por todo o corpo','Throughout the body',
    { match:'(vein|vena cava)', exclude:'pulmonary|cardiac', facts_pt:['As veias cavas são as maiores veias do corpo.'], facts_en:['The venae cavae are the body’s largest veins.'] }),
  S('circulatorio','pulmonar','Vasos pulmonares','Pulmonary vessels','Levam o sangue entre o coração e os pulmões para trocar gases.','Move blood between the heart and lungs to swap gases.','Entre coração e pulmões','Between heart and lungs',
    { match:'pulmonary (trunk|artery|vein)' }),

  /* ───────────────────────── RESPIRATÓRIO ───────────────────────── */
  S('respiratorio','pulmoes','Pulmões','Lungs','Trocam oxigénio por dióxido de carbono no sangue.','Swap oxygen for carbon dioxide in the blood.','Tórax','Chest',
    { match:'lobe of (left |right )?lung', facts_pt:['Têm ~300 milhões de alvéolos.','O pulmão direito tem 3 lobos; o esquerdo, 2.'], facts_en:['They hold ~300 million alveoli.','The right lung has 3 lobes; the left, 2.'] }),
  S('respiratorio','traqueia','Traqueia','Trachea','O tubo que leva o ar da garganta aos brônquios.','The tube that carries air from the throat to the bronchi.','Pescoço e tórax','Neck and chest',
    { match:'(trachea|bronchus)', exclude:'lobar|segmental' }),
  S('respiratorio','laringe','Laringe','Larynx','A "caixa de voz"; produz o som e protege as vias aéreas.','The "voice box"; makes sound and guards the airway.','Garganta','Throat',
    { match:'(thyroid cartilage|cricoid|arytenoid|corniculate|cuneiform cartilage|epiglottic|laryngeal)' }),
  S('respiratorio','diafragma','Diafragma','Diaphragm','O músculo em cúpula que puxa o ar para os pulmões.','The dome-shaped muscle that draws air into the lungs.','Sob os pulmões','Below the lungs',
    { match:'^(thoracic diaphragm|diaphragm)$', facts_pt:['Contrai-se ~20 000 vezes por dia sem pensares.'], facts_en:['It contracts ~20,000 times a day without you thinking.'] }),

  /* ───────────────────────── NERVOSO ───────────────────────── */
  S('nervoso','cerebro','Cérebro','Brain','O centro de comando: pensa, sente e controla tudo.','The command centre: thinks, feels and controls everything.','Cabeça','Head',
    { match:'(gyrus|cerebral hemisphere|cerebral cortex|white matter structure of cerebral|corpus callosum|insula|frontal lobe|parietal lobe|temporal lobe|occipital lobe)', exclude:'cerebell', facts_pt:['Tem ~86 mil milhões de neurónios.','Usa ~20 W — menos que uma lâmpada.'], facts_en:['It has ~86 billion neurons.','Uses ~20 W — less than a light bulb.'] }),
  S('nervoso','cerebelo','Cerebelo','Cerebellum','Coordena o equilíbrio e os movimentos finos.','Coordinates balance and fine movement.','Trás da cabeça','Back of the head',
    { match:'cerebellum' }),
  S('nervoso','troncocerebral','Tronco cerebral','Brainstem','Liga o cérebro ao resto do corpo; controla a respiração e os batimentos.','Links the brain to the rest of the body; runs breathing and heartbeat.','Base do cérebro','Base of the brain',
    { match:'(brainstem|midbrain|^pons$|peduncle of midbrain|medulla oblongata)', facts_pt:['Controla funções vitais automáticas.'], facts_en:['It runs automatic, life-critical functions.'] }),

  /* ───────────────────────── DIGESTIVO ───────────────────────── */
  S('digestivo','esofago','Esófago','Esophagus','Empurra a comida da boca para o estômago.','Pushes food from the mouth to the stomach.','Pescoço e tórax','Neck and chest',
    { match:'^esophagus$' }),
  S('digestivo','estomago','Estômago','Stomach','Mistura a comida com ácido forte para a digerir.','Mixes food with strong acid to digest it.','Abdómen superior esquerdo','Upper-left abdomen',
    { match:'^stomach$', facts_pt:['O seu ácido dissolveria metal.'], facts_en:['Its acid could dissolve metal.'] }),
  S('digestivo','figado','Fígado','Liver','O maior órgão interno; filtra o sangue e faz +500 tarefas.','The largest internal organ; filters blood, 500+ jobs.','Abdómen superior direito','Upper-right abdomen',
    { match:'^liver$', facts_pt:['Regenera-se a partir de só 25% de si.'], facts_en:['It can regrow from just 25% of itself.'] }),
  S('digestivo','vesicula','Vesícula biliar','Gallbladder','Guarda a bílis que digere as gorduras.','Stores the bile that digests fats.','Sob o fígado','Under the liver',
    { match:'^gallbladder$' }),
  S('digestivo','intestinodelgado','Intestino delgado','Small intestine','~7 m onde se absorve a maioria dos nutrientes.','~7 m where most nutrients are absorbed.','Centro do abdómen','Centre of the abdomen',
    { match:'(small intestine|duodenum|jejunum|ileum)', exclude:'artery|vein|papilla', facts_pt:['Esticado, mede ~7 metros.'], facts_en:['Unfolded, it is ~7 metres long.'] }),
  S('digestivo','intestinogrosso','Intestino grosso','Large intestine','Recupera a água e forma os resíduos sólidos.','Reclaims water and forms solid waste.','À volta do abdómen','Around the abdomen',
    { match:'(large intestine|colon|cecum|caecum|rectum|vermiform appendix)', exclude:'artery|vein|flexure|mesocolon|tenia' }),
  S('digestivo','baco','Baço','Spleen','Filtra o sangue e ajuda a defesa imunitária.','Filters blood and supports immune defence.','Abdómen superior esquerdo','Upper-left abdomen',
    { match:'^spleen$' }),

  /* ───────────────────────── URINÁRIO ───────────────────────── */
  S('urinario','rins','Rins','Kidneys','Filtram o sangue ~40 vezes por dia e fazem a urina.','Filter the blood ~40 times a day and make urine.','Meio das costas','Mid-back',
    { match:'^(left kidney|right kidney)$', facts_pt:['Filtram ~180 litros de sangue por dia.'], facts_en:['They filter ~180 litres of blood a day.'] }),
  S('urinario','ureteres','Ureteres','Ureters','Tubos que levam a urina dos rins à bexiga.','Tubes that carry urine from the kidneys to the bladder.','Abdómen','Abdomen',
    { match:'^(left ureter|right ureter|ureter)$' }),
  S('urinario','bexiga','Bexiga','Urinary bladder','Saco muscular que guarda a urina até ser eliminada.','Muscular bag that stores urine until it is released.','Baixo abdómen','Lower abdomen',
    { match:'^urinary bladder$', facts_pt:['Avisa o cérebro com ~200 ml.'], facts_en:['It signals the brain at ~200 ml.'] }),

  /* ───────────────────────── SENTIDOS ───────────────────────── */
  S('sentidos','olhos','Olhos','Eyes','Captam a luz e o cérebro transforma-a em imagens; ~80% do que aprendemos entra pela visão.','Capture light that the brain turns into images; ~80% of what we learn comes through sight.','Cara','Face',
    { match:'eyeball', facts_pt:['A retina tem ~120 milhões de bastonetes.'], facts_en:['The retina has ~120 million rods.'] }),
  S('sentidos','ouvido','Ouvido','Ear','Transforma as vibrações do ar em som e mantém o equilíbrio.','Turns air vibrations into sound and keeps you balanced.','Lados da cabeça','Sides of the head',
    { match:'^ear$', facts_pt:['O ouvido interno também controla o equilíbrio.'], facts_en:['The inner ear also controls balance.'] }),
  S('sentidos','nariz','Nariz','Nose','Deteta milhares de cheiros e aquece o ar que respiras.','Detects thousands of smells and warms the air you breathe.','Centro da cara','Centre of the face',
    { match:'nasal cartilage', facts_pt:['O olfato está ligado à memória e à emoção.'], facts_en:['Smell is wired to memory and emotion.'] }),
];
