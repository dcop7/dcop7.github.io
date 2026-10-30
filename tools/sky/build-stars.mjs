/* ══════════════════════════════════════════════════════════════════
   build-stars.mjs — gera data/sky/stars.json para o "Céu Esta Noite"
   ──────────────────────────────────────────────────────────────────
   Entrada: o Yale Bright Star Catalogue, 5.ª ed. (Hoffleit & Warren,
   1991 — dados científicos públicos, NASA ADC / CDS V/50), em JSON com
   os campos HR, RA ("05h 55m 10.3s"), Dec ("+07° 24′ 25″"), V, K, C, B, N.
   Cópia usada: github.com/brettonw/YaleBrightStarCatalog (bsc5-short.json).

   Uso:  node tools/sky/build-stars.mjs <caminho/bsc5-short.json>

   Saída (compacta):
     stars: [[ra°, dec°, mag, K/100, con], …]   — J2000, V ≤ 5,0 + as
             estrelas das linhas das constelações, mesmo que mais fracas
     names: { índice: "Nome" }                  — nomes próprios (PT)
     lines: { "Ori": [[i, j], …] }              — figuras das constelações
     cons:  { "Ori": "Orionte", … }             — os 88 nomes em português
     dso:   [[ra°, dec°, "Nome", "tipo"]]       — objetos a olho nu
   As figuras das constelações foram desenhadas para este projeto (pares
   de estrelas pela designação de Bayer), não copiadas de outro atlas.
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('uso: node tools/sky/build-stars.mjs <bsc5-short.json>'); process.exit(1); }
const cat = JSON.parse(fs.readFileSync(src, 'utf8'));

const ra = s => { const m = s.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/); return (+m[1] + +m[2] / 60 + +m[3] / 3600) * 15; };
const dec = s => { const m = s.match(/([+-])(\d+)°\s*(\d+)′\s*([\d.]+)″/); const v = +m[2] + +m[3] / 60 + +m[4] / 3600; return m[1] === '-' ? -v : v; };

/* ── nomes das 88 constelações (PT-PT) ── */
const CONS = {
  And: 'Andrómeda', Ant: 'Máquina Pneumática', Aps: 'Ave do Paraíso', Aqr: 'Aquário', Aql: 'Águia', Ara: 'Altar', Ari: 'Carneiro',
  Aur: 'Cocheiro', Boo: 'Boieiro', Cae: 'Buril', Cam: 'Girafa', Cnc: 'Caranguejo', CVn: 'Cães de Caça', CMa: 'Cão Maior',
  CMi: 'Cão Menor', Cap: 'Capricórnio', Car: 'Quilha', Cas: 'Cassiopeia', Cen: 'Centauro', Cep: 'Cefeu', Cet: 'Baleia',
  Cha: 'Camaleão', Cir: 'Compasso', Col: 'Pomba', Com: 'Cabeleira de Berenice', CrA: 'Coroa Austral', CrB: 'Coroa Boreal',
  Crv: 'Corvo', Crt: 'Taça', Cru: 'Cruzeiro do Sul', Cyg: 'Cisne', Del: 'Golfinho', Dor: 'Dourado', Dra: 'Dragão',
  Equ: 'Cavalo Menor', Eri: 'Erídano', For: 'Fornalha', Gem: 'Gémeos', Gru: 'Grou', Her: 'Hércules', Hor: 'Relógio',
  Hya: 'Hidra', Hyi: 'Hidra Macho', Ind: 'Índio', Lac: 'Lagarto', Leo: 'Leão', LMi: 'Leão Menor', Lep: 'Lebre',
  Lib: 'Balança', Lup: 'Lobo', Lyn: 'Lince', Lyr: 'Lira', Men: 'Mesa', Mic: 'Microscópio', Mon: 'Unicórnio', Mus: 'Mosca',
  Nor: 'Esquadro', Oct: 'Oitante', Oph: 'Ofiúco', Ori: 'Orionte', Pav: 'Pavão', Peg: 'Pégaso', Per: 'Perseu', Phe: 'Fénix',
  Pic: 'Pintor', Psc: 'Peixes', PsA: 'Peixe Austral', Pup: 'Popa', Pyx: 'Bússola', Ret: 'Retículo', Sge: 'Flecha',
  Sgr: 'Sagitário', Sco: 'Escorpião', Scl: 'Escultor', Sct: 'Escudo', Ser: 'Serpente', Sex: 'Sextante', Tau: 'Touro',
  Tel: 'Telescópio', Tri: 'Triângulo', TrA: 'Triângulo Austral', Tuc: 'Tucano', UMa: 'Ursa Maior', UMi: 'Ursa Menor',
  Vel: 'Vela', Vir: 'Virgem', Vol: 'Peixe Voador', Vul: 'Raposa',
};

/* ── figuras: [constelação, "a-b c-d …"] com letras gregas de Bayer;
   "And:α" refere uma estrela de outra constelação ── */
const FIG = [
  ['Ori', 'α-γ α-ζ γ-δ δ-ε ε-ζ ζ-κ δ-β λ-α λ-γ'],
  ['UMa', 'α-β β-γ γ-δ δ-α δ-ε ε-ζ ζ-η'],
  ['UMi', 'α-δ δ-ε ε-ζ ζ-β β-γ γ-η η-ζ'],
  ['Cas', 'β-α α-γ γ-δ δ-ε'],
  ['Cyg', 'α-γ γ-η η-β γ-δ γ-ε ε-ζ'],
  ['Lyr', 'α-ζ ζ-β β-γ γ-δ δ-ζ'],
  ['Aql', 'β-α α-γ α-δ δ-ζ δ-λ'],
  ['Sco', 'σ-α α-τ τ-ε ε-μ μ-ζ ζ-η η-θ θ-ι ι-κ κ-λ σ-δ δ-β δ-π'],
  ['Sgr', 'γ-δ γ-ε δ-ε δ-λ λ-φ φ-δ φ-σ σ-τ τ-ζ ζ-ε ζ-φ'],
  ['Leo', 'α-η η-γ γ-ζ ζ-μ μ-ε α-θ θ-β β-δ δ-γ δ-θ'],
  ['Tau', 'λ-γ γ-δ δ-ε ε-β γ-θ θ-α α-ζ'],
  ['Gem', 'α-β α-τ τ-ε ε-μ μ-η β-δ δ-ζ ζ-γ'],
  ['CMa', 'β-α α-δ δ-ε δ-η'],
  ['CMi', 'α-β'],
  ['Aur', 'α-β β-θ θ-ι ι-α'],
  ['Peg', 'α-β β-And:α And:α-γ γ-α α-ζ ζ-θ θ-ε β-η'],
  ['And', 'α-δ δ-β β-γ β-μ μ-ν'],
  ['Per', 'α-δ δ-ε ε-ζ α-γ γ-η α-β'],
  ['Boo', 'α-ε ε-δ δ-β β-γ γ-ρ ρ-α α-η α-ζ'],
  ['CrB', 'θ-β β-α α-γ γ-δ δ-ε ε-ι'],
  ['Her', 'ε-ζ ζ-η η-π π-ε ζ-β'],
  ['Vir', 'α-γ γ-η η-β γ-δ δ-ε α-ζ ζ-δ'],
  ['Dra', 'β-γ γ-ξ ξ-ν ν-β ξ-δ'],
  ['Cep', 'α-β β-γ γ-ι ι-ζ ζ-α'],
  ['Cru', 'α-γ β-δ'],
  ['Cen', 'α-β'],
  ['Ari', 'α-β β-γ'],
  ['Lib', 'α-β β-γ α-σ'],
  ['Del', 'α-β β-δ δ-γ γ-α β-ε'],
  ['Tri', 'α-β β-γ γ-α'],
];

/* ── nomes próprios em português (HR → nome); os restantes brilhantes
   mantêm o nome tradicional do catálogo ── */
const PT_NAMES = {
  2491: 'Sírius', 2326: 'Canopo', 5340: 'Arcturo', 7001: 'Vega', 1708: 'Capela', 1713: 'Rigel', 2943: 'Prócion',
  2061: 'Betelgeuse', 7557: 'Altair', 1457: 'Aldebarã', 6134: 'Antares', 5056: 'Espiga', 2990: 'Pólux',
  8728: 'Fomalhaut', 7924: 'Deneb', 3982: 'Régulo', 2891: 'Castor', 424: 'Estrela Polar', 936: 'Algol',
};

const DSO = [
  [56.75, 24.12, 'Plêiades', 'aglomerado'],
  [10.68, 41.27, 'Galáxia de Andrómeda', 'galáxia'],
  [83.82, -5.39, 'Nebulosa de Orionte', 'nebulosa'],
  [34.75, 57.13, 'Duplo Aglomerado de Perseu', 'aglomerado'],
  [130.10, 19.98, 'Presépio', 'aglomerado'],
  [66.75, 15.87, 'Híades', 'aglomerado'],
];

const recs = cat.filter(s => s.RA && s.Dec && s.V != null).map(s => ({
  hr: +s.HR, ra: ra(s.RA), dec: dec(s.Dec), v: +s.V, k: +s.K || 6000, c: s.C || '', b: s.B || '', n: s.N || '',
}));

/* resolve "α" (ou "And:α") dentro de uma constelação → registo mais brilhante */
function find(con, tok) {
  let c = con, b = tok;
  if (tok.includes(':')) [c, b] = tok.split(':');
  const m = recs.filter(r => r.c === c && (r.b === b || r.b.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '') === b));
  if (!m.length) throw new Error(`estrela não encontrada: ${c} ${b}`);
  return m.sort((x, y) => x.v - y.v)[0];
}

const need = new Set();
const figRecs = FIG.map(([con, spec]) => [con, spec.split(/\s+/).map(pair => {
  const [a, b] = pair.split(/-(?=[^-]*$)/);   /* o último hífen separa (And:α-γ) */
  const ra_ = find(con, a), rb = find(con, b);
  need.add(ra_.hr); need.add(rb.hr);
  return [ra_.hr, rb.hr];
})]);

const keep = recs.filter(r => r.v <= 5.0 || need.has(r.hr)).sort((a, b) => a.v - b.v);
const idx = new Map(keep.map((r, i) => [r.hr, i]));
const stars = keep.map(r => [+r.ra.toFixed(3), +r.dec.toFixed(3), +r.v.toFixed(2), Math.round(r.k / 100), r.c]);
const names = {};
keep.forEach((r, i) => {
  if (PT_NAMES[r.hr]) names[i] = PT_NAMES[r.hr];
  else if (r.n && r.v <= 2.6) names[i] = r.n;
});
const lines = {};
figRecs.forEach(([con, pairs]) => { lines[con] = pairs.map(([a, b]) => [idx.get(a), idx.get(b)]); });

const out = { _doc: 'Gerado por tools/sky/build-stars.mjs a partir do Yale Bright Star Catalogue (BSC5). Ver o cabeçalho do script.', stars, names, lines, cons: CONS, dso: DSO };
const dest = path.resolve('data/sky/stars.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`${stars.length} estrelas · ${Object.keys(names).length} nomes · ${Object.keys(lines).length} figuras → ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
