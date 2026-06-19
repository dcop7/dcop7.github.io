/* Migrate the legacy flat data/timeline.json (146 events, cat + key) into the
   new per-theme knowledge-base structure data/explore/<theme>.json, assigning
   tier (key→destaque, else explorar) and a best-effort subtheme by keyword.
   Items with no keyword match keep subtheme:null (shown under "Geral").
   The 'jogos' theme is SKIPPED here — it is authored from scratch.
   Run: node tools/explore/migrate.mjs */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = new URL('../../', import.meta.url);
const timeline = JSON.parse(await readFile(new URL('data/timeline.json', ROOT)));
const index = JSON.parse(await readFile(new URL('data/explore/index.json', ROOT)));
const THEMES = index.themes;

const SKIP = new Set(['jogos']);   // authored by hand

// best-effort subtheme keyword rules per theme (regex over title+desc+period)
const RULES = {
  universo: [['origem', /big bang|inflaç|primeir|átomo|partícul/i], ['galaxias', /galáx|via láctea|andr[óo]meda/i], ['estrelas', /estrela|supernova|nebulosa|sol nasce/i], ['buracos', /buraco negro|singular/i], ['cosmologia', /expans|energia escura|matéria escura|fundo cósmico|hubble/i]],
  solar: [['sol', /\bsol\b|solar(?!es)/i], ['planetas', /planeta|terra|marte|júpiter|saturno|vénus|merc[úu]rio|úrano|neptuno/i], ['luas', /lua|satélite natural/i], ['corpos', /asteroide|cometa|cintura|kuiper/i], ['exploracao', /sonda|missão|voyager|apollo|rover/i]],
  terra: [['formacao', /formaç|acreç|colisão|origem da terra/i], ['geologia', /tect[óo]nic|continent|pangeia|vulcão|placa/i], ['atmosfera', /atmosfera|oceano|oxigén/i], ['clima', /glaciaç|idade do gelo|clima/i], ['extincoes', /extinç/i]],
  vida: [['origem', /primeira vida|abiog|luca|origem da vida/i], ['evolucao', /evoluç|seleção natural|cambriano/i], ['plantas', /planta|fotoss|floresta/i], ['animais', /animal|peixe|anf[íi]bio|réptil|mamífero|ave/i], ['micro', /bactéria|célula|procariont|eucariont/i]],
  dinos: [['triasico', /triás/i], ['jurassico', /juráss/i], ['cretacico', /cretác|t-?rex|tiranoss/i], ['extincao', /extinç|chicxulub|asteroide/i], ['paleontologia', /f[óo]ssil|paleont|descobert/i]],
  humana: [['hominideos', /homo|austral|hominíd|neandertal|sapiens/i], ['migracoes', /migraç|saída de áfrica|povoament/i], ['prehistoria', /neolít|paleolít|agricultura|fogo/i], ['cultura', /linguagem|arte rupestre|pintura/i]],
  civil: [['mesopotamia', /mesopot|suméri|babil[óo]n|escrita cune/i], ['egito', /egito|faraó|pirâmide|nilo/i], ['grecia', /grég|grécia|atenas|alexandre|democracia ateni/i], ['roma', /roma|império romano|césar/i], ['asia', /china|índia|dinastia|imperador/i], ['americas', /maia|asteca|inca|olmeca/i]],
  mundial: [['medieval', /idade média|medieval|feudal|cruzad|peste negra/i], ['moderna', /renascen|imprensa|reforma|descobr/i], ['revolucoes', /revoluç|iluminismo|industrial|francesa|americana/i], ['secxx', /guerra mundial|grande guerra|nazi|hitler|guerra fria/i], ['contemporanea', /internet|globaliz|muro de berlim|11 de setembro|pandemia/i]],
  portugal: [['formacao', /condado|afonso henriques|reconquista|1143|d\. afonso/i], ['descobrimentos', /descobr|henrique|gama|cabral|navegaç|caravela/i], ['monarquia', /rei d\.|dinastia|restauração|terramoto|pombal/i], ['republica', /repúblic|1910|estado novo|salazar/i], ['democracia', /25 de abril|abril de 1974|democra|adesão|euro/i], ['patrimonio', /mosteiro|torre de belém|património|fado|azulejo/i]],
  tech: [['computadores', /computador|eniac|microprocessador|pc|ibm|altair/i], ['internet', /internet|web|www|arpanet|tcp\/ip|navegador|browser|google/i], ['smartphones', /telem[óo]vel|smartphone|iphone|android|gsm/i], ['ia', /inteligência artificial|\bia\b|rede neur|chatgpt|aprendizagem/i], ['software', /software|sistema operativo|windows|linux|unix|programaç/i], ['hardware', /transístor|chip|circuito|disco|memória/i], ['redes', /rede|cloud|wifi|ethernet|servidor/i]],
  espaco: [['missoes', /apollo|missão|sputnik|gagarin|estação espacial|iss|artemis/i], ['astronautas', /astronauta|cosmonauta|armstrong|gagarin/i], ['telescopios', /telesc[óo]pio|hubble|webb|james webb/i], ['satelites', /satélite|sonda|voyager|rover|sonda espacial/i], ['descobertas', /descobert|exoplaneta|buraco negro|ondas gravit/i]],
  medicina: [['anatomia', /anatomia|circulaç|sangue|coração/i], ['doencas', /peste|varíola|gripe|epidemia|pandemia|vírus|cólera/i], ['vacinas', /vacina|penicilina|antibiót|fármaco|insulina|anestesia/i], ['cirurgia', /cirurgia|transplant|operaç/i], ['genetica', /dna|gen[óe]|genoma|crispr|hereditar/i], ['saude', /saúde pública|saneament|esperança de vida|oms/i]],
  ambiente: [['clima', /aquecimento|clima|co2|carbono|acordo de paris/i], ['energia', /energia|petróleo|nuclear|solar|eólic|renov/i], ['conservacao', /espécie|conservaç|extinç|biodivers|parque/i], ['poluicao', /poluiç|plástico|smog|ozono/i], ['sustentabilidade', /reciclag|sustent|verde/i]],
  arte: [['movimentos', /renascen|barroco|impressionis|cubismo|surreal|romantismo|modern/i], ['pintura', /pintura|quadro|mona lisa|van gogh|picasso/i], ['escultura', /escultura|estátua|david|mármore/i], ['arquitetura', /arquitet|catedral|edifício|templo/i], ['fotografia', /fotografia|daguerre|câmara/i]],
  musica: [['generos', /jazz|rock|blues|clássic|hip hop|pop|eletr[óo]nic/i], ['artistas', /beethoven|mozart|beatles|elvis|bach|compositor/i], ['albuns', /álbum|disco/i], ['instrumentos', /piano|guitarra|violino|instrumento/i], ['tecnologia', /gravaç|fon[óo]grafo|sintetiz|mp3|streaming|vinil/i]],
  cinema: [['filmes', /filme|longa-metragem|oscar/i], ['realizadores', /realizador|spielberg|hitchcock|kubrick/i], ['estudios', /estúdio|hollywood|disney|warner/i], ['efeitos', /efeitos|computa|cgi|3d|animaç/i], ['streaming', /streaming|netflix|vídeo/i]],
  desporto: [['futebol', /futebol|mundial de futebol|fifa|eusébio|ronaldo/i], ['olimpicos', /olímpic|olimp[íi]ada/i], ['formula1', /fórmula 1|f1|grande prémio/i], ['atletismo', /atletismo|maratona|corrida|salto/i], ['recordes', /recorde|recordista/i]],
  cultura: [['religiao', /religião|cristianismo|islã|budismo|igreja|templo/i], ['filosofia', /filosof|sócrates|platão|aristót|iluminismo/i], ['lingua', /escrita|alfabeto|língua|imprensa|livro/i], ['tradicoes', /tradiç|festa|carnaval|costume/i]],
};

function subFor(theme, e) {
  const rules = RULES[theme]; if (!rules) return null;
  const hay = `${e.title} ${e.desc || ''} ${e.period || ''}`;
  for (const [sub, re] of rules) if (re.test(hay)) return sub;
  return null;
}

const byTheme = {};
let n = 0, withSub = 0;
for (const e of timeline) {
  const theme = e.cat;
  if (!THEMES[theme] || SKIP.has(theme)) continue;
  const sub = subFor(theme, e);
  if (sub) withSub++;
  const item = {
    id: e.id, title: e.title, tier: e.key ? 'destaque' : 'explorar',
    subtheme: sub, year: e.year,
  };
  if (e.date) item.date = e.date;
  if (e.period) item.period = e.period;
  if (e.place) item.place = e.place;
  item.desc = e.desc; if (e.fact) item.fact = e.fact;
  if (e.related && e.related.length) item.related = e.related;
  item.tags = [];
  (byTheme[theme] = byTheme[theme] || []).push(item);
  n++;
}

await mkdir(new URL('data/explore/', ROOT), { recursive: true });
for (const [theme, items] of Object.entries(byTheme)) {
  items.sort((a, b) => a.year - b.year);
  await writeFile(new URL(`data/explore/${theme}.json`, ROOT), JSON.stringify({ theme, items }, null, 1) + '\n');
  const d = items.filter(i => i.tier === 'destaque').length;
  console.log(`${theme.padEnd(10)} ${String(items.length).padStart(3)} items · ${d} destaque · ${items.filter(i => i.subtheme).length} w/ subtheme`);
}
console.log(`\nmigrated ${n} events into ${Object.keys(byTheme).length} themes · ${withSub} got a subtheme · jogos skipped (authored)`);
