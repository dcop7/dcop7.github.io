#!/usr/bin/env node
/* Generate the Solar System quiz from verified, STABLE astronomical facts
   (order from the Sun, superlatives, notable moons, inner-planet moon counts).
   We avoid volatile data (e.g. exact gas-giant moon counts that change).
   Run: node quizzes/tools/gen-solar.mjs */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const P = [
  { pt:'Mercúrio', order:1, moons:0, note:'o planeta mais próximo do Sol' },
  { pt:'Vénus',    order:2, moons:0, note:'o planeta mais quente do Sistema Solar' },
  { pt:'Terra',    order:3, moons:1, moon:'Lua', note:'o único planeta com vida conhecida' },
  { pt:'Marte',    order:4, moons:2, moon:'Fobos', note:'o planeta vermelho' },
  { pt:'Júpiter',  order:5, moon:'Ganimedes', note:'o maior planeta do Sistema Solar' },
  { pt:'Saturno',  order:6, moon:'Titã', note:'o planeta famoso pelos seus anéis proeminentes' },
  { pt:'Urano',    order:7, note:'o planeta que roda quase "deitado" (eixo muito inclinado)' },
  { pt:'Neptuno',  order:8, moon:'Tritão', note:'o planeta mais distante do Sol' },
];
const NAMES = P.map(p => p.pt);
const ORD = ['primeiro','segundo','terceiro','quarto','quinto','sexto','sétimo','oitavo'];

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function opts4(c, pool){ const d=shuffle(pool.filter(x=>x!==c)).slice(0,3); return shuffle([c,...d]); }
const out = { easy: [], medium: [], hard: [] };
const add = (tier, q, a, opts, exp) => out[tier].push({ q, a, opts, exp });

/* Superlatives (1 correct planet of 4) */
const SUP = [
  ['Qual é o maior planeta do Sistema Solar?', 'Júpiter', 'easy'],
  ['Qual é o planeta mais pequeno do Sistema Solar?', 'Mercúrio', 'easy'],
  ['Qual é o planeta mais quente do Sistema Solar?', 'Vénus', 'medium'],
  ['Qual é o planeta mais próximo do Sol?', 'Mercúrio', 'easy'],
  ['Qual é o planeta mais distante do Sol?', 'Neptuno', 'easy'],
  ['Que planeta é conhecido pelos seus anéis proeminentes?', 'Saturno', 'easy'],
  ['Qual é o planeta vermelho?', 'Marte', 'easy'],
  ['Em que planeta existe vida conhecida?', 'Terra', 'easy'],
  ['Que planeta tem a Grande Mancha Vermelha?', 'Júpiter', 'medium'],
  ['Que planeta roda quase "deitado", com o eixo muito inclinado?', 'Urano', 'hard'],
  ['Que planeta roda no sentido retrógrado (ao contrário da maioria)?', 'Vénus', 'hard'],
  ['Em que planeta se encontra o Monte Olimpo, o maior vulcão do Sistema Solar?', 'Marte', 'hard'],
];
for (const [q, a, tier] of SUP) add(tier, q, a, opts4(a, NAMES), `Resposta: ${a} — ${P.find(p=>p.pt===a)?.note || ''}`.trim());

/* Order from the Sun (both directions) */
for (const p of P) {
  add(p.order <= 4 ? 'easy' : 'medium',
    `Qual é a posição de ${p.pt} a partir do Sol?`, ORD[p.order-1],
    opts4(ORD[p.order-1], ORD), `${p.pt} é o ${ORD[p.order-1]} planeta a contar do Sol.`);
  add('medium',
    `Qual é o ${ORD[p.order-1]} planeta a partir do Sol?`, p.pt,
    opts4(p.pt, NAMES), `O ${ORD[p.order-1]} planeta é ${p.pt}.`);
}

/* Neighbour ordering */
for (let i = 0; i < P.length - 1; i++) {
  add('medium', `Que planeta vem logo a seguir a ${P[i].pt} (afastando-se do Sol)?`, P[i+1].pt,
    opts4(P[i+1].pt, NAMES), `Depois de ${P[i].pt} vem ${P[i+1].pt}.`);
  add('hard', `Que planeta vem imediatamente antes de ${P[i+1].pt} (em direção ao Sol)?`, P[i].pt,
    opts4(P[i].pt, NAMES), `Antes de ${P[i+1].pt} está ${P[i].pt}.`);
}

/* Inner-planet moon counts (stable) */
for (const p of P.filter(x => x.moons != null)) {
  add('medium', `Quantas luas tem ${p.pt}?`, String(p.moons),
    shuffle([...new Set([String(p.moons), '0', '1', '2', '3'])].slice(0,4)),
    `${p.pt} tem ${p.moons} ${p.moons === 1 ? 'lua' : 'luas'}.`);
}

/* Notable moons */
for (const p of P.filter(x => x.moon)) {
  const moons = P.filter(x => x.moon).map(x => x.moon);
  add('hard', `Qual destas é uma lua de ${p.pt}?`, p.moon, opts4(p.moon, moons),
    `${p.moon} é uma lua de ${p.pt}.`);
}

/* Reverse "note" identification */
for (const p of P.filter(x => x.note)) {
  add('medium', `Que planeta é ${p.note}?`, p.pt, opts4(p.pt, NAMES),
    `${p.pt} é ${p.note}.`);
}

/* General facts */
add('easy', 'Quantos planetas tem o Sistema Solar?', '8', shuffle(['8','7','9','10']),
  'Desde a reclassificação de Plutão (2006), são 8 planetas.');
add('easy', 'Qual é a estrela no centro do Sistema Solar?', 'O Sol', shuffle(['O Sol','Sírius','Alfa Centauri','A Lua']),
  'O Sol é a estrela central do Sistema Solar.');
add('medium', 'Qual é o nome da galáxia onde se encontra o Sistema Solar?', 'Via Láctea',
  shuffle(['Via Láctea','Andrómeda','Triângulo','Sombrero']), 'O Sistema Solar fica na Via Láctea.');
add('hard', 'A que grupo pertence Plutão desde 2006?', 'Planetas anões',
  shuffle(['Planetas anões','Planetas gigantes','Asteroides','Cometas']), 'Plutão foi reclassificado como planeta anão em 2006.');

for (const tier of ['easy','medium','hard']) {
  await writeFile(join(ROOT,'quizzes',tier,'solar.json'), JSON.stringify(out[tier], null, 2) + '\n', 'utf8');
  console.log(`  wrote ${tier}/solar.json — ${out[tier].length} entries`);
}
console.log(`Total solar questions: ${out.easy.length + out.medium.length + out.hard.length}`);
