#!/usr/bin/env node
/* Generate a large, VERIFIED geography quiz in the new per-quiz layout:
     quizzes/geografia/{pt,en}/{easy,medium,hard}.json
   Everything is derived from the local in-repo dataset data/countries.json
   (no API, no invented facts). Each question carries an `exp` fact built from
   the same data. Country names: namePt (PT) / name.common (EN). PT capitals use
   a curated accurate map; EN capitals use the dataset's capital field.
   Run: node quizzes/tools/gen-geografia-v2.mjs */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONT_PT = { 'Africa':'África','Asia':'Ásia','Europe':'Europa','North America':'América do Norte','South America':'América do Sul','Oceania':'Oceânia','Antarctica':'Antárctida' };
const CONT_EN = { 'Africa':'Africa','Asia':'Asia','Europe':'Europe','North America':'North America','South America':'South America','Oceania':'Oceania','Antarctica':'Antarctica' };

/* Curated, accurate PT capital names keyed by cca2. */
const CAP_PT = {
  PT:'Lisboa',ES:'Madrid',FR:'Paris',GB:'Londres',DE:'Berlim',IT:'Roma',NL:'Amesterdão',BE:'Bruxelas',
  CH:'Berna',AT:'Viena',SE:'Estocolmo',NO:'Oslo',DK:'Copenhaga',FI:'Helsínquia',PL:'Varsóvia',GR:'Atenas',
  IE:'Dublin',CZ:'Praga',HU:'Budapeste',RO:'Bucareste',RU:'Moscovo',UA:'Kiev',TR:'Ancara',HR:'Zagrebe',
  US:'Washington, D.C.',CA:'Otava',MX:'Cidade do México',BR:'Brasília',AR:'Buenos Aires',CL:'Santiago',
  CO:'Bogotá',PE:'Lima',VE:'Caracas',CU:'Havana',UY:'Montevideu',CN:'Pequim',JP:'Tóquio',KR:'Seul',
  IN:'Nova Deli',ID:'Jacarta',SA:'Riade',IR:'Teerão',IQ:'Bagdade',IL:'Jerusalém',PK:'Islamabade',
  TH:'Banguecoque',VN:'Hanói',PH:'Manila',MY:'Kuala Lumpur',SG:'Singapura',EG:'Cairo',NG:'Abuja',
  ZA:'Pretória',KE:'Nairóbi',ET:'Adis Abeba',GH:'Acra',MA:'Rabat',AO:'Luanda',MZ:'Maputo',SN:'Dacar',
  AU:'Camberra',NZ:'Wellington',IS:'Reiquiavique',LU:'Luxemburgo',
};

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pickDistinct(correct, pool, n){ const d=[]; const seen=new Set([correct]); for(const x of shuffle(pool)){ if(d.length>=n)break; if(x==null||seen.has(x))continue; seen.add(x); d.push(x);} return d; }
function fmtPop(p){ if(p>=1e9)return (p/1e9).toFixed(1).replace('.0','')+' mil milhões'; if(p>=1e6)return (p/1e6).toFixed(1).replace('.0','')+' milhões'; if(p>=1e3)return Math.round(p/1e3)+' mil'; return ''+p; }
function fmtPopEn(p){ if(p>=1e9)return (p/1e9).toFixed(1).replace('.0','')+' billion'; if(p>=1e6)return (p/1e6).toFixed(1).replace('.0','')+' million'; if(p>=1e3)return Math.round(p/1e3)+'k'; return ''+p; }
function fmtArea(a){ return a>=1e6 ? (a/1e6).toFixed(2)+' milhões de km²' : Math.round(a).toLocaleString('pt-PT')+' km²'; }
function fmtAreaEn(a){ return a>=1e6 ? (a/1e6).toFixed(2)+' million km²' : Math.round(a).toLocaleString('en-US')+' km²'; }

const countries = JSON.parse(await readFile(join(ROOT,'data','countries.json'),'utf8'))
  .filter(c => c.namePt && c.name?.common && c.continents?.[0] && c.population != null);
countries.sort((a,b)=>(b.population||0)-(a.population||0));
const N = countries.length;
const tierOf = i => i < N*0.30 ? 'easy' : i < N*0.65 ? 'medium' : 'hard';

const langName = (c, lang) => lang==='pt' ? c.namePt : c.name.common;
const contName = (c, lang) => (lang==='pt'?CONT_PT:CONT_EN)[c.continents[0]];
const capName  = (c, lang) => lang==='pt' ? CAP_PT[c.cca2] : (c.capital?.[0] || null);
const firstVal = o => o ? Object.values(o)[0] : null;
const curName  = c => { const v=firstVal(c.currencies); return v && v.name ? v.name : null; };
const langOf   = c => firstVal(c.languages);

function buildFor(lang){
  const out = { easy:[], medium:[], hard:[] };
  const allCont = [...new Set(countries.map(c=>contName(c,lang)).filter(Boolean))];
  const allNames = countries.map(c=>langName(c,lang));
  const allCaps  = countries.map(c=>capName(c,lang)).filter(Boolean);
  const allCur   = [...new Set(countries.map(curName).filter(Boolean))];
  const allLang  = [...new Set(countries.map(langOf).filter(Boolean))];
  const push = (tier, q, a, opts, exp) => {
    if (opts.length!==4 || new Set(opts).size!==4 || !opts.includes(a)) return;
    out[tier].push({ q, a, opts: shuffle(opts), exp });
  };

  countries.forEach((c, i) => {
    const tier = tierOf(i);
    const name = langName(c, lang), cont = contName(c, lang);
    if (!cont) return;
    // A) Continent
    {
      const opts = [cont, ...pickDistinct(cont, allCont, 3)];
      const exp = lang==='pt' ? `${name} fica na ${cont}.` : `${name} is in ${cont}.`;
      push(tier, lang==='pt'?`Em que continente fica <strong>${name}</strong>?`:`Which continent is <strong>${name}</strong> in?`, cont, opts, exp);
    }
    // B) Capital (forward)
    const cap = capName(c, lang);
    if (cap) {
      const opts = [cap, ...pickDistinct(cap, allCaps, 3)];
      const exp = lang==='pt' ? `A capital de ${name} é ${cap} (${cont}).` : `The capital of ${name} is ${cap} (${cont}).`;
      push(tier, lang==='pt'?`Qual é a capital de <strong>${name}</strong>?`:`What is the capital of <strong>${name}</strong>?`, cap, opts, exp);
      // C) Capital (reverse) — only easy/medium to stay fair
      if (tier!=='hard') {
        const opts2 = [name, ...pickDistinct(name, allNames, 3)];
        const exp2 = lang==='pt' ? `${cap} é a capital de ${name}.` : `${cap} is the capital of ${name}.`;
        push(tier, lang==='pt'?`De que país é capital <strong>${cap}</strong>?`:`<strong>${cap}</strong> is the capital of which country?`, name, opts2, exp2);
      }
    }
    /* Currency & language names in the dataset are in English, so these
       question types are EN-only (avoids English answers in a PT quiz). */
    if (lang === 'en') {
      const cur = curName(c);
      if (cur && allCur.length>4) {
        const opts = [cur, ...pickDistinct(cur, allCur, 3)];
        push(tier, `Which currency is used in <strong>${name}</strong>?`, cur, opts, `${name} uses the ${cur}.`);
      }
      const lg = langOf(c);
      if (lg && allLang.length>4) {
        const opts = [lg, ...pickDistinct(lg, allLang, 3)];
        push(tier, `Which language is spoken in <strong>${name}</strong>?`, lg, opts, `${lg} is spoken in ${name}.`);
      }
    }
  });

  // E) Largest population among 4
  for (let t=0; t<3; t++){
    const tier = ['easy','medium','hard'][t];
    const slice = countries.slice(t*Math.floor(N/3), (t+1)*Math.floor(N/3));
    for (let k=0; k+4<=slice.length && k<48; k+=4){
      const grp = slice.slice(k, k+4);
      const win = grp.reduce((a,b)=>(b.population>a.population?b:a));
      const names = grp.map(c=>langName(c,lang));
      const exp = lang==='pt' ? `${langName(win,lang)} tem cerca de ${fmtPop(win.population)} de habitantes.` : `${langName(win,lang)} has about ${fmtPopEn(win.population)} people.`;
      push(tier, lang==='pt'?'Qual destes países tem <strong>maior população</strong>?':'Which of these countries has the <strong>largest population</strong>?', langName(win,lang), names, exp);
    }
  }
  // F) Largest area among 4
  const byArea = [...countries].filter(c=>c.area).sort((a,b)=>b.area-a.area);
  for (let k=0; k+4<=byArea.length && k<72; k+=4){
    const grp = byArea.slice(k, k+4);
    const win = grp.reduce((a,b)=>(b.area>a.area?b:a));
    const tier = k<16?'easy':k<44?'medium':'hard';
    const names = grp.map(c=>langName(c,lang));
    const exp = lang==='pt' ? `${langName(win,lang)} tem cerca de ${fmtArea(win.area)}.` : `${langName(win,lang)} covers about ${fmtAreaEn(win.area)}.`;
    push(tier, lang==='pt'?'Qual destes países tem <strong>maior área</strong>?':'Which of these countries has the <strong>largest area</strong>?', langName(win,lang), names, exp);
  }

  for (const tier of ['easy','medium','hard']){
    const seen=new Set(); const uniq=[];
    for (const it of shuffle(out[tier])){ if(seen.has(it.q))continue; seen.add(it.q); uniq.push(it); }
    out[tier] = uniq.slice(0, 220);
  }
  return out;
}

let total=0;
for (const lang of ['pt','en']){
  const banks = buildFor(lang);
  const dir = join(ROOT,'quizzes','geografia',lang);
  await mkdir(dir,{recursive:true});
  for (const tier of ['easy','medium','hard']){
    await writeFile(join(dir,`${tier}.json`), JSON.stringify(banks[tier],null,1)+'\n');
    total += banks[tier].length;
    console.log(`${lang}/${tier}: ${banks[tier].length}`);
  }
}
console.log('TOTAL geografia questions:', total);
