/* ══════════════════════════════════════════════════════════════════
   rollup.test.mjs — contract tests for the weekly/monthly editions.

     node data/news/rollup.test.mjs        (exit 0 = pass)

   Offline and filesystem-free: rollup() is a pure function of the daily
   documents it is handed, so the whole thing can be exercised against
   synthetic history. That matters, because on the day this was written
   there was exactly one real edition on disk — the behaviour that needs
   proving is what happens after a week, not what happens today.

   What is pinned down:
     1. PERSISTENCE beats a single strong day. A story that ran three
        days at 78 must outrank one that ran once at 85.
     2. The same event across consecutive days folds into ONE entry, and
        the fold is conservative — two different events that share
        vocabulary must stay separate.
     3. The union of publishers is preserved across the run.
     4. Caps hold, ranks are contiguous, and internal bookkeeping fields
        never reach the output.
══════════════════════════════════════════════════════════════════ */
import { rollup, isoWeek, weekRange, monthKey, WEEK_MAX } from './rollup.mjs';

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

let uid = 0;
const story = (title, score, sources = ['A'], ts = Date.UTC(2026, 7, 24)) => ({
  key: 'k' + (++uid), slug: 's' + uid, theme: 'portugal', date: '2026-08-24',
  rank: 1, title, summary: 'resumo', why: 'porque', score, sourceCount: sources.length,
  tags: [], ts, image: '',
  sources: sources.map((s, i) => ({ id: `${s}-${uid}-${i}`, title, url: `https://${s}.x/${uid}`, source: s, site: `https://${s}.x`, ts })),
});
const day = (date, stories) => ({ date, generated: date + 'T07:00:00Z', model: 'test',
  themes: [{ id: 'portugal', icon: '🇵🇹', pt: 'Portugal', en: 'Portugal', mode: 'coverage', candidates: 30, stories }] });

const build = (days, cap = WEEK_MAX) =>
  rollup(days, { id: '2026-W35', period: 'week', from: '2026-08-24', to: '2026-08-30', cap });

/* ── 1 · date helpers ────────────────────────────────────────────── */
console.log('\n1 · date helpers');
check('Monday and Sunday of the same ISO week agree',
  isoWeek('2026-08-24') === isoWeek('2026-08-30'), `${isoWeek('2026-08-24')} vs ${isoWeek('2026-08-30')}`);
check('the next Monday starts a new week', isoWeek('2026-08-30') !== isoWeek('2026-08-31'));
check('weekRange spans Monday to Sunday',
  JSON.stringify(weekRange('2026-08-27')) === JSON.stringify(['2026-08-24', '2026-08-30']), JSON.stringify(weekRange('2026-08-27')));
check('monthKey', monthKey('2026-08-24') === '2026-08');

/* ── 2 · persistence outranks a single strong day ────────────────── */
console.log('\n2 · persistence');
{
  const T = 'Greve geral paralisa os transportes em Lisboa';
  const doc = build([
    day('2026-08-24', [story(T, 78, ['Expresso'])]),
    day('2026-08-25', [story(T, 76, ['Público'])]),
    day('2026-08-26', [story(T, 74, ['RTP']), story('Cimeira europeia decide novo pacote de defesa', 85, ['Euronews'])]),
  ]);
  const s = doc.themes[0].stories;
  check('three-day story at 78 outranks a one-day story at 85',
    s[0].title === T && s[0].days === 3, `#1 = "${s[0].title.slice(0, 40)}" (days ${s[0].days})`);
  check('the one-day story is still present', s.some(x => x.score === 85 && x.days === 1));
  check('weight is score + persistence + coverage', s[0].weight === 78 + 6 * 2 + 2 * 3, String(s[0].weight));
  check('publishers are unioned across the run', s[0].sourceCount === 3, String(s[0].sourceCount));
  check('firstSeen/lastSeen span the run', s[0].firstSeen === '2026-08-24' && s[0].lastSeen === '2026-08-26');
}

/* ── 3 · folding is conservative ─────────────────────────────────── */
console.log('\n3 · folding');
{
  /* Same event, reworded by a different outlet on the second day. */
  const doc = build([
    day('2026-08-24', [story('Conselho de Segurança da ONU aprova resolução sobre Gaza', 80)]),
    day('2026-08-25', [story('Conselho de Segurança da ONU aprova nova resolução sobre Gaza', 82)]),
  ]);
  check('the same event on two days folds into one', doc.themes[0].stories.length === 1, String(doc.themes[0].stories.length));
  check('the fold keeps the stronger telling', doc.themes[0].stories[0].score === 82);
}
{
  /* Different events that merely share vocabulary must stay apart. */
  const doc = build([
    day('2026-08-24', [story('Fuga de dados expõe milhões de utilizadores da Vodafone', 80)]),
    day('2026-08-25', [story('Fuga de dados expõe milhões de utilizadores do LinkedIn', 80)]),
  ]);
  check('different events sharing words stay separate', doc.themes[0].stories.length === 2, String(doc.themes[0].stories.length));
}
{
  const doc = build([
    day('2026-08-24', [story('Norris vence o Grande Prémio de Itália', 80)]),
    day('2026-08-25', [story('Verstappen vence o Grande Prémio de Espanha', 80)]),
  ]);
  check('two different races stay separate', doc.themes[0].stories.length === 2, String(doc.themes[0].stories.length));
}

/* ── 4 · caps, ranks, cleanliness ────────────────────────────────── */
console.log('\n4 · output shape');
{
  const many = Array.from({ length: 25 }, (_, i) => story(`Acontecimento distinto número ${i} em ${2000 + i}`, 50 + i));
  const doc = build([day('2026-08-24', many)], 10);
  const s = doc.themes[0].stories;
  check('cap holds', s.length === 10, String(s.length));
  check('ranks are 1..n contiguous', s.every((x, i) => x.rank === i + 1));
  check('sorted by weight descending', s.every((x, i) => i === 0 || s[i - 1].weight >= x.weight));
  const leaked = ['_w', '_e', '_days', '_first', '_last', '_best'].filter(k => k in s[0]);
  check('no internal fields leak into output', leaked.length === 0, leaked.join(','));
  check('every story keeps its sources', s.every(x => Array.isArray(x.sources) && x.sources.length));
  check('document carries its period and range', doc.period === 'week' && doc.from === '2026-08-24' && doc.days.length === 1);
}
{
  const doc = build([day('2026-08-24', []), day('2026-08-25', [])]);
  check('a theme with no stories is omitted entirely', doc.themes.length === 0, String(doc.themes.length));
}

console.log(`\n${fail === 0 ? '✓ all cases pass' : `✗ ${fail} failure(s)`} (${pass}/${pass + fail})`);
process.exitCode = fail ? 1 : 0;
