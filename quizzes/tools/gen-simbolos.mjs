#!/usr/bin/env node
/* Expand the "símbolos" category with VERIFIED chemical-element questions
   (periodic table — symbols are language-neutral, PT names are accurate).
   Merges idempotently: keeps hand-authored items, replaces only the
   generated (gen:"chem") ones. Run: node quizzes/tools/gen-simbolos.mjs */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* [symbol, ptName, tier] — verified periodic-table data */
const EL = [
  ['H','Hidrogénio','easy'],['He','Hélio','easy'],['Li','Lítio','medium'],['Be','Berílio','hard'],
  ['B','Boro','medium'],['C','Carbono','easy'],['N','Azoto','easy'],['O','Oxigénio','easy'],
  ['F','Flúor','medium'],['Ne','Néon','medium'],['Na','Sódio','easy'],['Mg','Magnésio','easy'],
  ['Al','Alumínio','easy'],['Si','Silício','medium'],['P','Fósforo','easy'],['S','Enxofre','easy'],
  ['Cl','Cloro','easy'],['Ar','Árgon','medium'],['K','Potássio','medium'],['Ca','Cálcio','easy'],
  ['Sc','Escândio','hard'],['Ti','Titânio','medium'],['V','Vanádio','hard'],['Cr','Crómio','medium'],
  ['Mn','Manganês','hard'],['Fe','Ferro','easy'],['Co','Cobalto','medium'],['Ni','Níquel','medium'],
  ['Cu','Cobre','easy'],['Zn','Zinco','easy'],['Ga','Gálio','hard'],['Ge','Germânio','hard'],
  ['As','Arsénio','medium'],['Se','Selénio','hard'],['Br','Bromo','medium'],['Kr','Crípton','hard'],
  ['Ag','Prata','easy'],['Cd','Cádmio','hard'],['Sn','Estanho','medium'],['Sb','Antimónio','hard'],
  ['I','Iodo','easy'],['Xe','Xénon','hard'],['Cs','Césio','hard'],['Ba','Bário','medium'],
  ['W','Tungsténio','hard'],['Pt','Platina','medium'],['Au','Ouro','easy'],['Hg','Mercúrio','easy'],
  ['Pb','Chumbo','easy'],['Bi','Bismuto','hard'],['Rn','Rádon','hard'],['Ra','Rádio','medium'],
  ['U','Urânio','medium'],['Pu','Plutónio','hard'],
  ['Rb','Rubídio','hard'],['Sr','Estrôncio','hard'],['Y','Ítrio','hard'],['Zr','Zircónio','hard'],
  ['Nb','Nióbio','hard'],['Mo','Molibdénio','hard'],['Tc','Tecnécio','hard'],['Ru','Ruténio','hard'],
  ['Rh','Ródio','hard'],['Pd','Paládio','medium'],['In','Índio','hard'],['Te','Telúrio','hard'],
  ['La','Lantânio','hard'],['Ce','Cério','hard'],['Nd','Neodímio','hard'],['Sm','Samário','hard'],
  ['Eu','Európio','hard'],['Gd','Gadolínio','hard'],['Tb','Térbio','hard'],['Hf','Háfnio','hard'],
  ['Ta','Tântalo','hard'],['Re','Rénio','hard'],['Os','Ósmio','hard'],['Ir','Irídio','medium'],
  ['Tl','Tálio','hard'],['Po','Polónio','medium'],['At','Ástato','hard'],['Fr','Frâncio','hard'],
  ['Ac','Actínio','hard'],['Th','Tório','medium'],['Pa','Protactínio','hard'],['Np','Neptúnio','hard'],
  ['Am','Amerício','hard'],['Cm','Cúrio','hard'],
];

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function opts4(c, pool){ const d=shuffle(pool.filter(x=>x!==c)).slice(0,3); return shuffle([c,...d]); }

const symbols = EL.map(e => e[0]);
const names   = EL.map(e => e[1]);
const gen = { easy: [], medium: [], hard: [] };
for (const [sym, name, tier] of EL) {
  gen[tier].push({ q:`Qual é o símbolo químico de ${name}?`, a:sym, opts:opts4(sym, symbols),
    exp:`O símbolo químico de ${name} é ${sym}.`, gen:'chem' });
  gen[tier].push({ q:`Que elemento químico tem o símbolo ${sym}?`, a:name, opts:opts4(name, names),
    exp:`O símbolo ${sym} corresponde ao ${name}.`, gen:'chem' });
}

for (const tier of ['easy','medium','hard']) {
  const p = join(ROOT,'quizzes','simbolos','pt',`${tier}.json`);
  let existing = [];
  if (existsSync(p)) existing = JSON.parse(await readFile(p,'utf8')).filter(it => it.gen !== 'chem');
  const merged = existing.concat(gen[tier]);
  await writeFile(p, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`  ${tier}/simbolos.json — ${existing.length} kept + ${gen[tier].length} chem = ${merged.length}`);
}
console.log('Done.');
