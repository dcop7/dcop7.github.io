#!/usr/bin/env node
/* Append curated new pt-PT questions to the split database, de-duplicated by
   question text (normalised). Each new item: { q, a, opts:[4 unique, incl a], exp }.
   Safe to re-run — existing questions are never duplicated.
   Run: node quizzes/tools/expand-banks.mjs */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* New questions, grouped by category → difficulty. Verified general-knowledge
   facts; pt-PT spelling. */
const NEW = {
  gk: {
    easy: [
      { q:'Qual é a capital de Portugal?', a:'Lisboa', opts:['Porto','Lisboa','Coimbra','Braga'], exp:'Lisboa é a capital e maior cidade de Portugal.' },
      { q:'Quantas cores tem o arco-íris?', a:'7', opts:['5','6','7','8'], exp:'Vermelho, laranja, amarelo, verde, azul, anil e violeta.' },
      { q:'Qual é o maior animal terrestre?', a:'Elefante-africano', opts:['Rinoceronte','Girafa','Elefante-africano','Hipopótamo'], exp:'O elefante-africano é o maior animal terrestre atual.' },
      { q:'Em que estação caem as folhas das árvores?', a:'Outono', opts:['Primavera','Verão','Outono','Inverno'], exp:'No outono muitas árvores perdem as folhas.' },
      { q:'Qual é a cor que se obtém ao misturar azul e amarelo?', a:'Verde', opts:['Laranja','Verde','Roxo','Castanho'], exp:'Azul + amarelo = verde.' },
    ],
    medium: [
      { q:'Qual é a montanha mais alta de Portugal continental?', a:'Torre (Serra da Estrela)', opts:['Pico do Areeiro','Torre (Serra da Estrela)','Marão','Gerês'], exp:'A Torre, na Serra da Estrela, tem 1 993 m.' },
      { q:'Quantos jogadores tem uma equipa de futebol em campo?', a:'11', opts:['9','10','11','12'], exp:'Cada equipa tem 11 jogadores, incluindo o guarda-redes.' },
      { q:'Qual é o planeta mais próximo do Sol?', a:'Mercúrio', opts:['Vénus','Mercúrio','Marte','Terra'], exp:'Mercúrio é o planeta mais próximo do Sol.' },
    ],
    hard: [
      { q:'Em que ano se deu a Revolução dos Cravos?', a:'1974', opts:['1910','1926','1974','1986'], exp:'O 25 de Abril de 1974 pôs fim ao Estado Novo.' },
      { q:'Qual é o ponto mais alto de Portugal?', a:'Montanha do Pico (Açores)', opts:['Torre','Montanha do Pico (Açores)','Pico do Areeiro','Foia'], exp:'A Montanha do Pico, nos Açores, tem 2 351 m.' },
    ],
  },
  science: {
    easy: [
      { q:'Qual é o estado da água quando congela?', a:'Sólido', opts:['Líquido','Sólido','Gasoso','Plasma'], exp:'A água congela e passa ao estado sólido (gelo).' },
      { q:'Que órgão bombeia o sangue pelo corpo?', a:'Coração', opts:['Pulmão','Coração','Fígado','Rim'], exp:'O coração bombeia o sangue por todo o corpo.' },
    ],
    medium: [
      { q:'Qual é o gás que as plantas absorvem na fotossíntese?', a:'Dióxido de carbono', opts:['Oxigénio','Azoto','Dióxido de carbono','Hidrogénio'], exp:'As plantas absorvem CO₂ e libertam oxigénio.' },
      { q:'Quantos ossos tem aproximadamente o corpo humano adulto?', a:'206', opts:['106','206','306','406'], exp:'O esqueleto humano adulto tem 206 ossos.' },
    ],
    hard: [
      { q:'Qual é a velocidade aproximada da luz no vácuo?', a:'300 000 km/s', opts:['30 000 km/s','300 000 km/s','3 000 km/s','3 milhões km/s'], exp:'A luz viaja a cerca de 299 792 km/s no vácuo.' },
      { q:'Qual é a partícula de carga negativa do átomo?', a:'Eletrão', opts:['Protão','Neutrão','Eletrão','Fotão'], exp:'O eletrão tem carga negativa.' },
    ],
  },
  history: {
    easy: [
      { q:'Quem foi o primeiro rei de Portugal?', a:'D. Afonso Henriques', opts:['D. Dinis','D. Afonso Henriques','D. João I','D. Manuel I'], exp:'D. Afonso Henriques tornou-se o primeiro rei de Portugal em 1143.' },
      { q:'Que navegador português chegou à Índia por mar em 1498?', a:'Vasco da Gama', opts:['Fernão de Magalhães','Vasco da Gama','Bartolomeu Dias','Pedro Álvares Cabral'], exp:'Vasco da Gama chegou a Calecute, na Índia, em 1498.' },
    ],
    medium: [
      { q:'Quem terá chegado ao Brasil em 1500?', a:'Pedro Álvares Cabral', opts:['Vasco da Gama','Pedro Álvares Cabral','Cristóvão Colombo','Fernão de Magalhães'], exp:'Pedro Álvares Cabral chegou ao Brasil em 1500.' },
    ],
    hard: [
      { q:'Em que ano Lisboa foi devastada por um grande terramoto?', a:'1755', opts:['1531','1755','1834','1909'], exp:'O Terramoto de 1755 destruiu grande parte de Lisboa.' },
    ],
  },
  animals: {
    easy: [
      { q:'Qual destes animais é um mamífero?', a:'Golfinho', opts:['Tubarão','Golfinho','Polvo','Salmão'], exp:'O golfinho é um mamífero marinho, não um peixe.' },
      { q:'Quantas patas tem uma aranha?', a:'8', opts:['6','8','10','12'], exp:'As aranhas têm 8 patas.' },
    ],
    medium: [
      { q:'Qual é a ave que não voa e vive na Antárctida?', a:'Pinguim', opts:['Avestruz','Pinguim','Galinha','Emu'], exp:'O pinguim não voa e vive sobretudo no hemisfério sul.' },
    ],
    hard: [
      { q:'Qual é o único mamífero que põe ovos e é nativo da Austrália?', a:'Ornitorrinco', opts:['Coala','Canguru','Ornitorrinco','Wombat'], exp:'O ornitorrinco é um mamífero monotremado que põe ovos.' },
    ],
  },
  sport: {
    easy: [
      { q:'Com quantos jogadores joga uma equipa de voleibol em campo?', a:'6', opts:['5','6','7','11'], exp:'O voleibol joga-se com 6 jogadores por equipa.' },
      { q:'Em que desporto se usa uma raquete e uma bola amarela num court?', a:'Ténis', opts:['Squash','Ténis','Badminton','Padel'], exp:'O ténis usa raquete e bola amarela.' },
    ],
    medium: [
      { q:'De quantos em quantos anos se realizam os Jogos Olímpicos de Verão?', a:'4', opts:['2','3','4','5'], exp:'Os Jogos Olímpicos realizam-se de 4 em 4 anos.' },
    ],
    hard: [
      { q:'Que país venceu o primeiro Campeonato do Mundo de Futebol, em 1930?', a:'Uruguai', opts:['Brasil','Argentina','Uruguai','Itália'], exp:'O Uruguai venceu o Mundial de 1930, que organizou.' },
    ],
  },
  music: {
    easy: [
      { q:'Quantas cordas tem normalmente uma guitarra clássica?', a:'6', opts:['4','5','6','7'], exp:'A guitarra clássica tem 6 cordas.' },
      { q:'Que instrumento tem teclas pretas e brancas?', a:'Piano', opts:['Violino','Piano','Flauta','Bateria'], exp:'O piano tem teclas pretas e brancas.' },
    ],
    medium: [
      { q:'Qual é o género musical tradicional português classificado pela UNESCO?', a:'Fado', opts:['Fado','Samba','Flamenco','Tango'], exp:'O Fado é Património Cultural Imaterial da Humanidade desde 2011.' },
    ],
    hard: [
      { q:'Quantos músicos tem um quarteto?', a:'4', opts:['2','3','4','5'], exp:'Um quarteto é composto por 4 músicos.' },
      { q:'Que compositor austríaco escreveu a ópera "A Flauta Mágica"?', a:'Mozart', opts:['Beethoven','Mozart','Bach','Vivaldi'], exp:'W. A. Mozart compôs "A Flauta Mágica" (1791).' },
    ],
  },
  vehicles: {
    easy: [
      { q:'Quantas rodas tem normalmente um motociclo?', a:'2', opts:['2','3','4','6'], exp:'Um motociclo tem normalmente 2 rodas.' },
      { q:'Que veículo anda sobre carris?', a:'Comboio', opts:['Autocarro','Comboio','Camião','Mota'], exp:'O comboio circula sobre carris (via férrea).' },
    ],
    medium: [
      { q:'Que veículo é movido pela força do vento numas velas?', a:'Veleiro', opts:['Submarino','Veleiro','Jet-ski','Ferry'], exp:'O veleiro usa velas para aproveitar o vento.' },
      { q:'Qual destes transportes é o mais rápido em viagens longas?', a:'Avião', opts:['Comboio','Autocarro','Avião','Navio'], exp:'O avião é, em geral, o transporte mais rápido em longas distâncias.' },
    ],
    hard: [
      { q:'Como se chama o veículo elétrico de duas rodas que se equilibra sozinho?', a:'Segway', opts:['Trotinete','Segway','Monociclo','Velocípede'], exp:'O Segway é um veículo elétrico auto-equilibrado de duas rodas.' },
      { q:'Que tipo de motor tornou famosa a Revolução Industrial nos transportes?', a:'Motor a vapor', opts:['Motor elétrico','Motor a vapor','Motor a jato','Motor diesel'], exp:'A máquina a vapor impulsionou comboios e navios no século XIX.' },
    ],
  },
};

let added = 0, skipped = 0;
for (const cat of Object.keys(NEW)) {
  for (const diff of Object.keys(NEW[cat])) {
    const path = join(ROOT, 'quizzes', cat, 'pt', `${diff}.json`);
    const arr = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
    const seen = new Set(arr.map(it => norm(it.q)));
    for (const it of NEW[cat][diff]) {
      if (seen.has(norm(it.q))) { skipped++; continue; }
      /* sanity: 4 unique options including the answer */
      if (!Array.isArray(it.opts) || it.opts.length !== 4 || new Set(it.opts).size !== 4 || !it.opts.includes(it.a)) {
        console.warn('  ! skipped malformed:', it.q); continue;
      }
      arr.push({ q: it.q, a: it.a, opts: it.opts, exp: it.exp || '' });
      seen.add(norm(it.q)); added++;
    }
    writeFileSync(path, JSON.stringify(arr, null, 2) + '\n');
  }
}
console.log(`Expansion done: +${added} new questions (${skipped} already present).`);
