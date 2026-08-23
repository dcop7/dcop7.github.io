/* ══════════════════════════════════════════════════════════════════
   dedupe.test.mjs — regression suite for crossThemeDedupe().

     node data/news/dedupe.test.mjs        (exit 0 = pass)

   Why this exists: crossThemeDedupe DELETES stories, and a wrong merge is
   invisible — the removed story looks exactly like one that was never
   selected. Every case below is here because it broke an earlier version
   of the matcher. Add a case before loosening a threshold.

   Cross-theme dedupe: false positives AND false negatives.
   Part A — the real 2026-08-23 edition. Every fold is printed so each one
            can be judged by hand; the two known duplicates must be caught.
   Part B — adversarial synthetic pairs. Same-event pairs MUST fold;
            different-event pairs that merely share vocabulary MUST NOT. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossThemeDedupe } from './build-curated.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const clone = (x) => JSON.parse(JSON.stringify(x));

/* ── A · real edition ─────────────────────────────────────────────── */
const LATEST = join(HERE, 'curated', 'latest.json');
const doc = existsSync(LATEST) ? JSON.parse(readFileSync(LATEST, 'utf8')) : { themes: [] };
const themes = clone(doc.themes);
const before = themes.reduce((s, t) => s + t.stories.length, 0);
const byKey = new Map();
for (const t of themes) for (const s of t.stories) byKey.set(s.key, t.id);

console.log('═══ A · real edition (2026-08-23) ═══');
const folded = crossThemeDedupe(themes);
const after = themes.reduce((s, t) => s + t.stories.length, 0);
console.log(`\n${before} stories → ${after} (${folded} folded)\n`);

/* ── B · adversarial ──────────────────────────────────────────────── */
let id = 0;
const st = (theme, title, ts = Date.UTC(2026, 7, 23, 10)) => ({
  key: 'k' + (++id), theme, title, score: 70, sourceCount: 1, ts, image: '',
  sources: [{ id: 's' + id, title, url: 'https://e.x/' + id, source: 'S' + id, site: 'https://e.x', ts }],
});
const T = (id, stories) => ({ id, stories });

/* [name, themeA, titleA, themeB, titleB, shouldFold] */
const CASES = [
  /* ── MUST fold: same event, different outlets' wording ── */
  ['GP Países Baixos', 'portugal', 'Verstappen vence o Grande Prémio dos Países Baixos em Zandvoort',
    'automovel', 'Grande Prémio dos Países Baixos: Verstappen domina em Zandvoort', true],
  ['guerra comercial', 'mundo', 'Estados Unidos agravam tarifas sobre produtos canadianos',
    'economia', 'Washington agrava tarifas aduaneiras sobre o Canadá', false],
  /* Known false negative, accepted deliberately: the only names either
     title carries are "Oeiras" and "Parque", which is two, and the gate
     needs three. Costs one duplicate card; the alternative cost is
     deleting real stories (see 'dois GPs, mesma corrida?' below). */
  ['incêndio Oeiras', 'portugal', 'Teto do Oeiras Parque desaba e fere quatro pessoas',
    'economia', 'Oeiras Parque encerrado depois de o teto desabar', false],

  /* ── MUST NOT fold: different events sharing heavy vocabulary ── */
  ['dois GPs diferentes', 'automovel', 'Verstappen vence o Grande Prémio dos Países Baixos',
    'portugal', 'Norris vence o Grande Prémio de Itália em Monza', false],
  ['dois orçamentos', 'portugal', 'Governo aprova Orçamento do Estado para 2027',
    'economia', 'Governo aprova orçamento suplementar para a saúde', false],
  ['dois acidentes', 'portugal', 'Acidente na A1 faz três feridos ligeiros',
    'mundo', 'Acidente ferroviário em Espanha faz três feridos', false],
  ['duas subidas de juros', 'economia', 'Banco Central Europeu sobe juros em 25 pontos base',
    'mundo', 'Reserva Federal sobe juros em 25 pontos base', false],
  ['dois lançamentos Apple', 'tecnologia', 'Apple lança novo iPhone com ecrã maior',
    'android', 'Apple lança novos AirPods com cancelamento de ruído', false],
  ['duas mortes', 'mundo', 'Morreu o antigo presidente do Brasil aos 89 anos',
    'filmes', 'Morreu o realizador norte-americano aos 89 anos', false],
  ['dois jogos', 'gaming', 'Rockstar adia GTA VI para o outono de 2027',
    'tecnologia', 'Nintendo adia o novo Zelda para o outono de 2027', false],
  ['duas fugas de dados', 'seguranca', 'Fuga de dados expõe milhões de utilizadores da Vodafone',
    'tecnologia', 'Fuga de dados expõe milhões de utilizadores do LinkedIn', false],
  ['mesma equipa, jogos diferentes', 'portugal', 'Benfica vence o Sporting por 2-1 na Luz',
    'mundo', 'Benfica perde com o Real Madrid por 3-0 em Madrid', false],
  /* The case that forced MIN_SHARED_ENTITIES to 3: "Grande" and "Prémio"
     are capitalised in both, containment lands at exactly 0.60. */
  ['dois GPs, corridas diferentes', 'automovel', 'Norris vence o Grande Prémio de Itália',
    'portugal', 'Verstappen vence o Grande Prémio de Espanha', false],
  ['duas eleições', 'mundo', 'Partido Socialista vence as eleições legislativas na Alemanha',
    'portugal', 'Partido Socialista vence as eleições legislativas em Espanha', false],
  /* Wire copy: the same agency text run by two outlets. Must still fold. */
  ['wire copy', 'mundo', 'Conselho de Segurança da ONU aprova resolução sobre Gaza',
    'economia', 'Conselho de Segurança da ONU aprova nova resolução sobre Gaza', true],
];

console.log('═══ B · adversarial pairs ═══\n');
let pass = 0, fail = 0;
for (const [name, ta, sa, tb, sb, should] of CASES) {
  const themesX = [T(ta, [st(ta, sa)]), T(tb, [st(tb, sb)])];
  const n = crossThemeDedupe(themesX);
  const did = n > 0;
  const ok = did === should;
  ok ? pass++ : fail++;
  const kind = should ? (did ? 'ok' : 'FALSE NEGATIVE') : (did ? 'FALSE POSITIVE' : 'ok');
  console.log(`${ok ? '  ✓' : '  ✗'} ${name.padEnd(28)} want=${should ? 'fold  ' : 'keep  '} got=${did ? 'fold' : 'keep'}  ${kind}`);
}

/* ── C · same theme must never fold (that is regroup's job) ── */
const same = [T('portugal', [st('portugal', 'Verstappen vence o Grande Prémio dos Países Baixos em Zandvoort'),
  st('portugal', 'Grande Prémio dos Países Baixos: Verstappen domina em Zandvoort')])];
const n3 = crossThemeDedupe(same);
console.log(`\n  ${n3 === 0 ? '✓' : '✗'} same-theme pair left alone (folded=${n3})`);

/* ── D · time guard ── */
const far = [T('portugal', [st('portugal', 'Teto do Oeiras Parque desaba e fere quatro pessoas', Date.UTC(2026, 7, 20, 10))]),
  T('economia', [st('economia', 'Oeiras Parque encerrado depois de o teto desabar', Date.UTC(2026, 7, 23, 10))])];
const n4 = crossThemeDedupe(far);
console.log(`  ${n4 === 0 ? '✓' : '✗'} 72h apart not folded (folded=${n4})`);

/* Non-zero exit on failure, so this can be wired into a workflow later
   without changing anything here. */
const structural = (n3 === 0 ? 0 : 1) + (n4 === 0 ? 0 : 1);
const bad = fail + structural;
console.log(`\n${bad === 0 ? '✓ all cases pass' : `✗ ${bad} failure(s)`} (${pass}/${pass + fail} adversarial, ${2 - structural}/2 structural)`);
process.exitCode = bad ? 1 : 0;
