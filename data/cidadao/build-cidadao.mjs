/* ══════════════════════════════════════════════════════════════════
   build-cidadao.mjs — agregador de novidades do Estado (sem DB, sem deps)
   Corre numa GitHub Action (sem CORS) e escreve JSON estático:
       data/cidadao/novidades.json   novidades oficiais + radar de candidaturas
       data/cidadao/linkcheck.json   estado dos links curados (manutenção)
   Fontes (todas públicas, sem chaves):
     • RSS oficial do Diário da República (Série I) — legislação do dia
     • Google News RSS restringido a domínios oficiais (gov.pt, seg-social,
       ePortugal, Finanças, IEFP, DGES, Portal da Habitação…)
     • Google News RSS "radar" — deteção de candidaturas/apoios anunciados
   Resiliente como build-news.mjs: uma fonte que falhe não derruba as outras;
   se TODAS falharem, o JSON anterior é mantido (o commit não acontece).
   Run: node data/cidadao/build-cidadao.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 15000;
const RETAIN_DAYS = 45;
const MAX_ITEMS = 220;
const CONCURRENCY = 8;

const GNEWS = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-PT&gl=PT&ceid=PT:pt-150`;

/* ── Fontes ──
   gnews com site: devolve os artigos/páginas desses domínios indexados pelo
   Google — funciona como "RSS sintético" para portais oficiais que não têm
   feed próprio. O título vem com sufixo " - Fonte", removido ao normalizar. */
const SOURCES = [
  { id: 'dre',        name: 'Diário da República',   type: 'rss',   url: 'https://files.diariodarepublica.pt/rss/serie1.xml', topic: 'legislacao', site: 'https://diariodarepublica.pt' },
  { id: 'governo',    name: 'Portal do Governo',     type: 'gnews', q: 'site:portugal.gov.pt',            site: 'https://www.portugal.gov.pt' },
  { id: 'eportugal',  name: 'ePortugal',             type: 'gnews', q: 'site:eportugal.gov.pt',           site: 'https://eportugal.gov.pt' },
  { id: 'segsocial',  name: 'Segurança Social',      type: 'gnews', q: 'site:seg-social.pt',              site: 'https://www.seg-social.pt' },
  { id: 'financas',   name: 'AT · Finanças',         type: 'gnews', q: 'site:portaldasfinancas.gov.pt OR "Portal das Finanças" prazo OR entrega OR pagamento', site: 'https://www.portaldasfinancas.gov.pt' },
  { id: 'iefp',       name: 'IEFP',                  type: 'gnews', q: 'site:iefp.pt OR IEFP apoio OR medida OR candidatura', site: 'https://www.iefp.pt' },
  { id: 'habitacao',  name: 'Portal da Habitação',   type: 'gnews', q: 'site:portaldahabitacao.pt OR "Porta 65" OR "apoio à renda"', site: 'https://www.portaldahabitacao.pt' },
  { id: 'dges',       name: 'DGES · Ensino Superior', type: 'gnews', q: 'site:dges.gov.pt OR DGES bolsas OR candidatura "ensino superior"', site: 'https://www.dges.gov.pt' },
  { id: 'radar',      name: 'Radar de candidaturas', type: 'gnews', q: '"candidaturas abertas" OR "candidaturas até" apoio OR programa OR bolsa Portugal', site: '' },
  { id: 'novos',      name: 'Novos apoios anunciados', type: 'gnews', q: '"novo apoio" OR "novo subsídio" OR "nova prestação" OR "novo programa" OR "novo complemento" Portugal governo', site: '' },
];

/* Fontes municipais dinâmicas: um feed Google News site:<câmara> por cada
   concelho detalhado em municipios.json — adicionar um concelho ao JSON
   passa automaticamente a alimentar a tab Município com novidades locais. */
try {
  const mu = JSON.parse(readFileSync(dirname(fileURLToPath(import.meta.url)) + '/municipios.json', 'utf8'));
  for (const c of mu.concelhos || []) {
    let host = '';
    try { host = new URL(c.site).host.replace(/^www\./, ''); } catch {}
    if (host) SOURCES.push({ id: 'mun-' + c.id, name: 'Câmara de ' + c.nome, type: 'gnews', q: 'site:' + host, site: c.site });
  }
} catch (e) { console.warn('municipios.json não lido para fontes:', e.message); }

/* ── Temas (classificação por palavras-chave) ── */
const TOPIC_KW = [
  ['impostos',  /\bIRS\b|\bIMI\b|\bIUC\b|\bIVA\b|imposto|fiscal|finanças|e-?fatura|contribuint|liquidaç|dedução|retenç/i],
  ['apoios',    /apoio|subsídio|prestaç|abono|bolsa|complemento|benefíci|candidatura|tarifa social|garantia para a inf|vale\b|cheque/i],
  ['habitacao', /habitaç|renda|arrendament|casa própria|crédito à habitação|porta 65|IHRU|hipotec|imóve/i],
  ['trabalho',  /trabalh|emprego|desemprego|salári|IEFP|estágio|pensã|reforma|contribuiç|segurança social/i],
  ['saude',     /saúde|SNS|médic|vacin|hospital|utente|enfermeir|farmác|dentista/i],
  ['educacao',  /escola|educaç|ensino|estudante|propina|manuais|matrícula|universidade|DGES|creche/i],
  ['documentos', /cartão de cidadão|passaporte|carta de condução|registo|notariado|identidade|IMT\b|inspeção/i],
  ['justica',   /julgado(s)? de paz|tribunal|custas|advogad|injunç|mediaç|arbitragem|litígio|contraordenaç|multa|seguradora|fundo de garantia autom/i],
];
function classify(...texts) {
  const hay = texts.filter(Boolean).join(' ');
  const out = [];
  for (const [t, re] of TOPIC_KW) if (re.test(hay)) out.push(t);
  return out.length ? out : ['outros'];
}
/* Sinal "radar": notícia que anuncia candidaturas/prazos concretos. */
const RADAR_RE = /candidatur|inscriç|prazo|até \d{1,2} de|abr(e|iu|em)|dispon[ií]ve|entrega|pagamento|novo apoio|passa a/i;
/* Sinal "novo": apoio/medida acabado de anunciar ou a entrar em vigor —
   é isto que faz um apoio novo aparecer automaticamente na tab Agora. */
const NOVO_RE = /\bnovo (apoio|subs[ií]dio|programa|complemento|benef[ií]cio|incentivo|regime|passe)|\bnova (presta[çc][ãa]o|medida|linha|tarifa|dedu[çc][ãa]o)|entra(m)? em vigor|passa(m)? a (pagar|ser|estar|abranger|ter)|v[ãa]o (receber|pagar menos|ter direito)|alargad[oa]|cria[çc][ãa]o d[eo]|aprovad[oa] (o|a|em)/i;
/* Ruído a excluir do radar geral (desporto, autarquias-espetáculo, etc.). */
const NOISE_RE = /futebol|liga\b|festival|concerto|meteorologia|horóscopo|cartaz|jogo d[oa]/i;

/* ── helpers (mesma família do build-news.mjs) ── */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', euro: '€' };
const decodeEntities = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ''; } })
  .replace(/&([a-z]+[0-9]?);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m));
const stripCdata = (s) => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, ' ');
const clean = (s) => decodeEntities(stripTags(stripCdata(s || ''))).replace(/\s+/g, ' ').trim();
const normTitle = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function tagInner(block, name) {
  const re = new RegExp('<(?:\\w+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?' + name + '>', 'i');
  const m = block.match(re); return m ? m[1] : '';
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const title = clean(tagInner(b, 'title'));
    const link = clean(tagInner(b, 'link'));
    const ts = Date.parse(clean(tagInner(b, 'pubDate') || tagInner(b, 'date')));
    const desc = clean(tagInner(b, 'description')).slice(0, 300);
    if (!title || !link) continue;
    out.push({ title, link, ts: isNaN(ts) ? null : ts, desc });
  }
  return out;
}

async function pool(items, n, fn) {
  const ret = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { ret[idx] = await fn(items[idx], idx); } catch (e) { ret[idx] = { _err: String((e && e.message) || e) }; } }
  }));
  return ret;
}

/* ════════════════════════════ NOVIDADES ════════════════════════════ */
const now = Date.now();
const minTs = now - RETAIN_DAYS * 86400000;
const maxTs = now + 36 * 3600000;

const results = await pool(SOURCES, CONCURRENCY, async (src) => {
  const url = src.type === 'rss' ? src.url : GNEWS(src.q);
  const items = parseFeed(await fetchText(url));
  return { src, items };
});

const sourcesMeta = [];
const all = [];
for (let k = 0; k < SOURCES.length; k++) {
  const src = SOURCES[k];
  const r = results[k];
  if (!r || r._err || !r.items) {
    console.warn(`✗ ${src.id}: ${r && r._err}`);
    sourcesMeta.push({ id: src.id, name: src.name, site: src.site, ok: false, count: 0 });
    continue;
  }
  let kept = 0;
  for (const it of r.items) {
    if (it.ts == null) it.ts = now;
    if (it.ts < minTs || it.ts > maxTs) continue;
    /* Google News: título vem como "Título - Fonte"; guarda a fonte real. */
    let title = it.title, via = '';
    if (src.type === 'gnews') {
      const m = it.title.match(/^(.*)\s-\s([^-]{2,40})$/);
      if (m) { title = m[1].trim(); via = m[2].trim(); }
    }
    /* DRE: o RSS não traz pubDate; a data vem no sufixo do título
       ("… - Diário da República n.º 137/2026, Série I de 2026-07-17"). */
    if (src.id === 'dre') {
      const m = title.match(/^(.*?)\s*-\s*Diário da República n\.º\s*([\d/]+),?\s*(Série [IVX]+)\s*de\s*(\d{4}-\d{2}-\d{2})\s*$/i);
      if (m) {
        /* a descrição traz o sumário do diploma ("Altera o…"), muito mais
           útil do que o número sozinho */
        title = it.desc ? `${m[1].trim()} — ${it.desc}` : m[1].trim();
        via = `${m[3]} · DR ${m[2]}`;
        const t = Date.parse(m[4] + 'T12:00:00');
        if (!isNaN(t)) it.ts = t;
      }
    }
    if (!title || title.length < 12) continue;
    const topics = classify(title, it.desc);
    const isRadar = src.id === 'radar' || (RADAR_RE.test(title) && topics.some(t => t !== 'outros'));
    if (src.id === 'radar' || src.id === 'novos') {
      /* pesquisas abertas: só entra o que fala mesmo de apoios/medidas */
      if (NOISE_RE.test(title) || !/apoio|candidatur|bolsa|programa|subsídio|prestaç|complemento|prémio|incentivo|tarifa|pensã|abono|vale\b/i.test(title)) continue;
    }
    const isNovo = src.id === 'novos' || (NOVO_RE.test(title) && topics.some(t => t === 'apoios' || t === 'impostos' || t === 'habitacao' || t === 'trabalho'));
    const item = { title: title.slice(0, 220), url: it.link, source: src.id, via, ts: it.ts, topics, radar: !!isRadar };
    if (isNovo) item.novo = true;
    all.push(item);
    kept++;
  }
  sourcesMeta.push({ id: src.id, name: src.name, site: src.site, ok: true, count: kept });
  console.log(`✓ ${src.id}: ${kept} itens`);
}

/* dedupe por título normalizado (o gnews repete a mesma peça em várias queries) */
const seen = new Set();
const deduped = [];
for (const a of all.sort((x, y) => y.ts - x.ts)) {
  const key = normTitle(a.title).slice(0, 90);
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(a);
}
const items = deduped.slice(0, MAX_ITEMS);
const okCount = sourcesMeta.filter(s => s.ok).length;
console.log(`Novidades: ${all.length} → ${items.length} após dedupe (${okCount}/${SOURCES.length} fontes ok)`);

/* Se TODAS as fontes falharem, mantém o snapshot anterior (não escreve). */
const OUT = HERE + '/novidades.json';
if (okCount === 0 && existsSync(OUT)) {
  console.warn('Todas as fontes falharam — mantém-se o novidades.json anterior.');
} else {
  writeFileSync(OUT, JSON.stringify({
    generated: new Date(now).toISOString(),
    sources: sourcesMeta,
    items,
  }));
  console.log('Escrito novidades.json');
}

/* ════════════════════ LINK-CHECK (manutenção automática) ════════════════════
   Verifica os links oficiais curados em apoios.json e calendario.json e
   escreve linkcheck.json — se um organismo mudar o URL, o problema fica
   visível no repo sem ninguém ter de testar links à mão. Nunca falha o build. */
async function checkLink(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    let r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!r.ok && r.status !== 403 && r.status !== 405) {
      r = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA } });
    }
    /* 403/405/429 = bloqueio anti-bot ou método recusado, não é link morto */
    return { status: r.status, ok: r.ok || [403, 405, 429].includes(r.status) };
  } catch (e) {
    /* erro de rede (TLS antigo, firewall anti-bot…) ≠ link morto: alguns
       portais do Estado recusam o fetch do Node mas abrem no browser
       (seg-social.pt) — marca como desconhecido, não como partido. */
    return { status: 0, ok: null, err: String((e && e.message) || e).slice(0, 80) };
  } finally { clearTimeout(t); }
}

try {
  const targets = [];
  for (const f of ['apoios.json', 'calendario.json']) {
    const data = JSON.parse(readFileSync(HERE + '/' + f, 'utf8'));
    for (const it of data.items || []) if (it.url) targets.push({ id: `${f.replace('.json', '')}:${it.id}`, url: it.url });
  }
  /* municipios.json: sites das câmaras + páginas de apoios/fontes das taxas */
  try {
    const mu = JSON.parse(readFileSync(HERE + '/municipios.json', 'utf8'));
    for (const c of mu.concelhos || []) {
      if (c.site) targets.push({ id: `municipio:${c.id}`, url: c.site });
      for (const a of c.apoios || []) if (a.url) targets.push({ id: `municipio:${c.id}:${a.id}`, url: a.url });
    }
  } catch {}
  const checks = await pool(targets, 6, async (t) => ({ ...t, ...(await checkLink(t.url)) }));
  const broken = checks.filter(c => c && c.ok === false);
  const unknown = checks.filter(c => c && c.ok === null);
  writeFileSync(HERE + '/linkcheck.json', JSON.stringify({
    generated: new Date().toISOString(),
    total: targets.length,
    broken: broken.length,
    unknown: unknown.length,
    results: checks.map(c => ({ id: c.id, url: c.url, status: c.status, ok: c.ok })),
  }, null, 1));
  console.log(`Link-check: ${targets.length - broken.length - unknown.length}/${targets.length} ok, ${unknown.length} desconhecidos${broken.length ? ' — PARTIDOS: ' + broken.map(b => b.id).join(', ') : ''}`);
} catch (e) {
  console.warn('Link-check falhou (não-fatal):', e.message);
}
