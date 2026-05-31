#!/usr/bin/env node
/* Append VERIFIED, hand-authored questions to the trivia categories.
   Idempotent: merges by question text, so re-running never duplicates.
   Every entry has exactly 4 options (1 correct + 3 plausible distractors)
   and accurate facts — no fabrication, no placeholders.
   Run: node quizzes/tools/expand-trivia.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* category → tier → [ {q,a,opts,exp} ] */
const ADD = {
  historia: {
    medium: [
      { q:'Quem foi o líder da União Soviética durante a maior parte da Segunda Guerra Mundial?', a:'Josef Estaline', opts:['Josef Estaline','Lenine','Trotsky','Kruschev'], exp:'Estaline liderou a URSS de 1924 até à sua morte em 1953.' },
      { q:'Em que cidade foi assinada a independência dos Estados Unidos em 1776?', a:'Filadélfia', opts:['Filadélfia','Nova Iorque','Boston','Washington'], exp:'A Declaração de Independência foi assinada na Filadélfia.' },
      { q:'Que civilização desenvolveu a escrita cuneiforme?', a:'Suméria', opts:['Suméria','Egípcia','Fenícia','Maia'], exp:'Os sumérios, na Mesopotâmia, criaram a escrita cuneiforme.' },
      { q:'Quem proclamou a República Portuguesa em 1910?', a:'O movimento republicano', opts:['O movimento republicano','D. Manuel II','Salazar','Sidónio Pais'], exp:'A República foi proclamada a 5 de Outubro de 1910, pondo fim à monarquia.' },
      { q:'Que rota comercial ligava a Europa à Ásia na Idade Média?', a:'Rota da Seda', opts:['Rota da Seda','Rota do Sal','Rota do Âmbar','Rota do Ouro'], exp:'A Rota da Seda ligava a China ao Mediterrâneo.' },
      { q:'Quem unificou a Itália no século XIX?', a:'Garibaldi e Cavour', opts:['Garibaldi e Cavour','Napoleão III','Bismarck','Vítor Emanuel III'], exp:'A unificação italiana (Risorgimento) deveu-se sobretudo a Garibaldi e Cavour.' },
      { q:'Que império foi governado por Solimão, o Magnífico?', a:'Império Otomano', opts:['Império Otomano','Império Persa','Império Mogol','Império Bizantino'], exp:'Solimão, o Magnífico, liderou o auge do Império Otomano no século XVI.' },
    ],
    hard: [
      { q:'Em que ano foi assinada a Paz de Augsburgo?', a:'1555', opts:['1555','1492','1648','1789'], exp:'A Paz de Augsburgo (1555) permitiu a cada príncipe alemão escolher a religião do seu território.' },
      { q:'Que tratado dividiu o Império Carolíngio em 843?', a:'Tratado de Verdun', opts:['Tratado de Verdun','Tratado de Tordesilhas','Paz de Vestfália','Tratado de Aquisgrão'], exp:'O Tratado de Verdun dividiu o império de Carlos Magno entre os seus netos.' },
      { q:'Quem foi o último imperador da China?', a:'Puyi', opts:['Puyi','Sun Yat-sen','Mao Tsé-Tung','Hirohito'], exp:'Puyi foi o último imperador, deposto em 1912.' },
      { q:'Que batalha de 1415 foi vencida por Henrique V de Inglaterra?', a:'Azincourt', opts:['Azincourt','Hastings','Crécy','Bosworth'], exp:'A Batalha de Azincourt foi uma vitória inglesa na Guerra dos Cem Anos.' },
      { q:'Que cidade-estado grega era famosa pela sua disciplina militar?', a:'Esparta', opts:['Esparta','Atenas','Corinto','Tebas'], exp:'Esparta era conhecida pela rigorosa educação militar (agogê).' },
      { q:'Em que ano começou a Reforma Protestante de Lutero?', a:'1517', opts:['1517','1453','1492','1648'], exp:'Lutero afixou as 95 teses em 1517.' },
    ],
  },
  ciencia: {
    medium: [
      { q:'Qual é a unidade de medida da corrente elétrica?', a:'Ampere', opts:['Ampere','Volt','Watt','Ohm'], exp:'A corrente elétrica mede-se em amperes (A).' },
      { q:'Que cientista propôs a teoria da evolução por seleção natural?', a:'Charles Darwin', opts:['Charles Darwin','Gregor Mendel','Louis Pasteur','Lamarck'], exp:'Darwin publicou "A Origem das Espécies" em 1859.' },
      { q:'Qual é o maior osso do corpo humano?', a:'Fémur', opts:['Fémur','Húmero','Tíbia','Crânio'], exp:'O fémur, na coxa, é o osso mais longo e forte.' },
      { q:'Que planeta é conhecido como o planeta vermelho?', a:'Marte', opts:['Marte','Júpiter','Vénus','Mercúrio'], exp:'Marte deve a cor ao óxido de ferro (ferrugem) na superfície.' },
      { q:'Qual é o principal gás responsável pelo efeito de estufa?', a:'Dióxido de carbono', opts:['Dióxido de carbono','Oxigénio','Azoto','Hélio'], exp:'O CO₂ é o principal gás de efeito de estufa de origem humana.' },
      { q:'Como se chama a mudança de estado de gás para líquido?', a:'Condensação', opts:['Condensação','Evaporação','Sublimação','Fusão'], exp:'A condensação é a passagem do estado gasoso ao líquido.' },
    ],
    hard: [
      { q:'Qual é o número atómico do carbono?', a:'6', opts:['6','12','8','14'], exp:'O carbono tem 6 protões, logo número atómico 6.' },
      { q:'Que tipo de célula não possui núcleo definido?', a:'Procariótica', opts:['Procariótica','Eucariótica','Animal','Vegetal'], exp:'As células procarióticas (bactérias) não têm núcleo delimitado.' },
      { q:'Qual é a lei que relaciona pressão e volume de um gás a temperatura constante?', a:'Lei de Boyle', opts:['Lei de Boyle','Lei de Ohm','Lei de Hooke','Lei de Newton'], exp:'A Lei de Boyle: a pressão é inversamente proporcional ao volume (T constante).' },
      { q:'Que partícula medeia a força eletromagnética?', a:'Fotão', opts:['Fotão','Gluão','Bosão de Higgs','Neutrino'], exp:'O fotão é a partícula mediadora da força eletromagnética.' },
      { q:'Qual é a unidade SI de energia?', a:'Joule', opts:['Joule','Newton','Watt','Pascal'], exp:'A energia mede-se em joules (J) no Sistema Internacional.' },
      { q:'Que organelo celular é responsável pela produção de energia (ATP)?', a:'Mitocôndria', opts:['Mitocôndria','Ribossoma','Núcleo','Cloroplasto'], exp:'A mitocôndria é a "central energética" da célula.' },
    ],
  },
  tecnologia: {
    medium: [
      { q:'O que significa "URL"?', a:'Uniform Resource Locator', opts:['Uniform Resource Locator','Universal Reference Link','Unified Resource Layer','User Routing Link'], exp:'URL é o endereço único de um recurso na web.' },
      { q:'Que estrutura de dados segue a regra FIFO (primeiro a entrar, primeiro a sair)?', a:'Fila', opts:['Fila','Pilha','Árvore','Grafo'], exp:'Numa fila (queue) o primeiro elemento a entrar é o primeiro a sair.' },
      { q:'Que empresa criou o sistema operativo Android?', a:'Google', opts:['Google','Apple','Microsoft','Samsung'], exp:'O Android é mantido pela Google.' },
      { q:'O que faz uma VPN?', a:'Cria uma ligação privada e cifrada', opts:['Cria uma ligação privada e cifrada','Acelera o processador','Aumenta o armazenamento','Edita imagens'], exp:'Uma VPN cria um túnel cifrado para proteger a ligação.' },
    ],
    hard: [
      { q:'Em que base numérica trabalham internamente os computadores?', a:'Binária (base 2)', opts:['Binária (base 2)','Decimal (base 10)','Hexadecimal (base 16)','Octal (base 8)'], exp:'Os computadores operam em binário (0 e 1).' },
      { q:'Que protocolo é usado para enviar correio eletrónico?', a:'SMTP', opts:['SMTP','HTTP','FTP','DNS'], exp:'O SMTP (Simple Mail Transfer Protocol) envia email.' },
      { q:'Quem é considerado o pai da World Wide Web?', a:'Tim Berners-Lee', opts:['Tim Berners-Lee','Bill Gates','Steve Jobs','Alan Turing'], exp:'Tim Berners-Lee inventou a Web em 1989 no CERN.' },
      { q:'Que tipo de algoritmo é o "quicksort"?', a:'Ordenação', opts:['Ordenação','Pesquisa','Compressão','Encriptação'], exp:'O quicksort é um algoritmo de ordenação eficiente (média O(n log n)).' },
    ],
  },
  portugal: {
    medium: [
      { q:'Qual é o ponto mais ocidental da Europa continental?', a:'Cabo da Roca', opts:['Cabo da Roca','Cabo de São Vicente','Cabo Carvoeiro','Cabo Espichel'], exp:'O Cabo da Roca, em Sintra, é o ponto mais ocidental do continente europeu.' },
      { q:'Que região é famosa pelo vinho verde?', a:'Minho', opts:['Minho','Alentejo','Algarve','Douro'], exp:'O vinho verde é produzido na região do Minho, no noroeste.' },
      { q:'Quantos distritos tem Portugal continental?', a:'18', opts:['18','20','12','22'], exp:'Portugal continental está dividido em 18 distritos.' },
    ],
    hard: [
      { q:'Em que ano foi inaugurada a Ponte 25 de Abril?', a:'1966', opts:['1966','1974','1955','1982'], exp:'Foi inaugurada em 1966 (originalmente Ponte Salazar).' },
      { q:'Que tratado de 1373 estabeleceu a aliança entre Portugal e Inglaterra?', a:'Tratado de 1373 (Anglo-Português)', opts:['Tratado de 1373 (Anglo-Português)','Tratado de Windsor','Tratado de Tordesilhas','Tratado de Methuen'], exp:'O tratado de 1373, reforçado por Windsor (1386), é a base da aliança mais antiga do mundo.' },
      { q:'Qual é o arquipélago português mais próximo do continente americano?', a:'Açores', opts:['Açores','Madeira','Selvagens','Berlengas'], exp:'Os Açores situam-se no meio do Atlântico Norte.' },
    ],
  },
};

let total = 0, added = 0;
for (const [cat, tiers] of Object.entries(ADD)) {
  for (const [tier, items] of Object.entries(tiers)) {
    const p = join(ROOT, 'quizzes', tier, `${cat}.json`);
    if (!existsSync(p)) { console.log(`  skip (missing): ${tier}/${cat}.json`); continue; }
    const arr = JSON.parse(await readFile(p, 'utf8'));
    const seen = new Set(arr.map(x => x.q));
    let n = 0;
    for (const it of items) if (!seen.has(it.q)) { arr.push(it); seen.add(it.q); n++; added++; }
    total += arr.length;
    await writeFile(p, JSON.stringify(arr, null, 2) + '\n', 'utf8');
    console.log(`  ${tier}/${cat}.json — +${n} → ${arr.length}`);
  }
}
console.log(`Added ${added} new verified questions.`);
