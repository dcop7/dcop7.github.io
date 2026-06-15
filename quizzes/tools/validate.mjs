#!/usr/bin/env node
/* Validation pipeline — run before shipping quiz content.
   Scans the unified per-topic database  quizzes/<topic>/<lang>/<difficulty>.json
   and verifies, for every question:
     - well-formed: q, a, exactly 4 options, a ∈ opts, options unique
     - any local image (quizzes/assets/...) actually exists on disk
   Exits non-zero if any problem is found, so broken content never ships.
   Run: node quizzes/tools/validate.mjs */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUIZ = join(ROOT, 'quizzes');
const DIFFS = ['easy', 'medium', 'hard'];
const LANGS = ['pt', 'en'];

let items = 0, errors = 0, withImg = 0, missImg = 0;
const problems = [];
const perTopic = {};

const isDir = async p => { try { return (await stat(p)).isDirectory(); } catch { return false; } };

const topics = [];
for (const name of (await readdir(QUIZ))) {
  if (name === 'assets' || name === 'tools') continue;
  if (await isDir(join(QUIZ, name, 'pt')) || await isDir(join(QUIZ, name, 'en'))) topics.push(name);
}

for (const topic of topics.sort()) {
  perTopic[topic] = { pt: 0, en: 0 };
  for (const lang of LANGS) {
    for (const diff of DIFFS) {
      const file = join(QUIZ, topic, lang, `${diff}.json`);
      if (!existsSync(file)) continue;
      const rel = `${topic}/${lang}/${diff}.json`;
      let arr;
      try { arr = JSON.parse(await readFile(file, 'utf8')); }
      catch (e) { problems.push(`${rel}: JSON parse failed — ${e.message}`); errors++; continue; }
      if (!Array.isArray(arr)) { problems.push(`${rel}: not an array`); errors++; continue; }
      arr.forEach((it, i) => {
        items++; perTopic[topic][lang]++;
        const at = `${rel}#${i}`;
        if (!it || typeof it.q !== 'string' || !it.q) { problems.push(`${at}: missing q`); errors++; }
        if (it.a == null || it.a === '') { problems.push(`${at}: missing a`); errors++; }
        if (!Array.isArray(it.opts) || it.opts.length !== 4) { problems.push(`${at}: opts must be exactly 4 (got ${it.opts?.length})`); errors++; }
        else {
          if (!it.opts.includes(it.a)) { problems.push(`${at}: answer not in opts`); errors++; }
          if (new Set(it.opts).size !== it.opts.length) { problems.push(`${at}: duplicate opts`); errors++; }
        }
        if (it.img) {
          withImg++;
          if (it.img.startsWith('quizzes/assets/') && !existsSync(join(ROOT, it.img))) {
            problems.push(`${at}: missing local image ${it.img}`); missImg++; errors++;
          }
        }
      });
    }
  }
}

console.log(`Validated ${items} questions across ${topics.length} topics — images referenced: ${withImg}, missing: ${missImg}`);
if (problems.length) {
  console.log(`\n✗ ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 50)) console.log('  - ' + p);
  if (problems.length > 50) console.log(`  …and ${problems.length - 50} more`);
  process.exit(1);
}
console.log('✓ All quiz content valid; all local images present.');
