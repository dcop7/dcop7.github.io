#!/usr/bin/env node
/* One-off migration: pull the PT built-in trivia banks out of
   js/quiz/quiz-providers.js (_TRIVIA.pt + _TRIVIA_EXTRA.pt) and write them as
   the split offline database files quizzes/{easy,medium,hard}/{category}.json,
   bucketed by each item's difficulty tag d (1→easy, 2→medium, 3→hard).
   Item shape written: { q, a, opts:[...], exp }.
   Run: node quizzes/tools/extract-trivia.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'js', 'quiz', 'quiz-providers.js');
const src = readFileSync(SRC, 'utf8');

/* Extract the object literal that follows `const <name> = ` by brace-matching. */
function extractObject(name) {
  const start = src.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`${name} not found`);
  let i = src.indexOf('{', start);
  let depth = 0, inStr = null, esc = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { return src.slice(i, j + 1); } }
  }
  throw new Error(`unterminated object for ${name}`);
}

const TRIVIA = eval('(' + extractObject('_TRIVIA') + ')');
const EXTRA  = eval('(' + extractObject('_TRIVIA_EXTRA') + ')');

/* Merge EXTRA into TRIVIA (append, never overwrite) — same as the runtime. */
for (const lang of Object.keys(EXTRA)) {
  TRIVIA[lang] = TRIVIA[lang] || {};
  for (const cat of Object.keys(EXTRA[lang])) {
    TRIVIA[lang][cat] = (TRIVIA[lang][cat] || []).concat(EXTRA[lang][cat]);
  }
}

const DIFF = { 1: 'easy', 2: 'medium', 3: 'hard' };
const pt = TRIVIA.pt || {};
let total = 0;
const summary = {};

for (const cat of Object.keys(pt)) {
  const buckets = { easy: [], medium: [], hard: [] };
  for (const it of pt[cat]) {
    const d = it.d || 2;
    const item = { q: it.q, a: it.a, opts: it.opts, exp: it.exp || '' };
    buckets[DIFF[d] || 'medium'].push(item);
  }
  for (const diff of ['easy', 'medium', 'hard']) {
    const dir = join(ROOT, 'quizzes', diff);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${cat}.json`), JSON.stringify(buckets[diff], null, 2) + '\n');
    total += buckets[diff].length;
  }
  summary[cat] = `${buckets.easy.length}/${buckets.medium.length}/${buckets.hard.length}`;
}

console.log('Extracted PT banks → quizzes/{easy,medium,hard}/<cat>.json (easy/medium/hard counts):');
for (const c of Object.keys(summary)) console.log(`  ${c.padEnd(10)} ${summary[c]}`);
console.log(`Total questions written: ${total}`);
