/* ══════════════════════════════════════════════════════════════════
   build-gaming.mjs — Product Discovery / 🎮 Gaming deals pipeline

   A GitHub Action (.github/workflows/discovery-refresh.yml) runs this every
   few hours. It collects game deals/giveaways from public sources, normalises
   them, computes deal metrics and writes static JSON for GitHub Pages — the
   browser only ever reads that JSON (no API calls, no backend).

   Sources (keyless by default):
     • CheapShark  — current deals across stores (sale/normal price, savings %,
       dealRating, steamRatingPercent) + per-game cheapest-ever price & date.
       USD prices. https://www.cheapshark.com/api/
     • Epic Games  — current/upcoming free games (promo dates, original €
       price, cover art). Public static endpoint.
     • Steam       — metadata enrichment (genres, release, cover, platforms,
       € price) via the public store appdetails endpoint.
     • IsThereAnyDeal — OPTIONAL (set ITAD_KEY secret): EUR prices + full price
       history. Skipped cleanly when the key is absent.

   Output: data/discovery/gaming/{index.json, games.json, g/<id>.json}
   Pure Node 18+ (global fetch). Run: node data/discovery/gaming/build-gaming.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const G_DIR = join(HERE, 'g');
const PSNAP = join(HERE, '_snap', 'prices.json');   // keyless price history (accrues per run)
const cfg = JSON.parse(readFileSync(join(HERE, 'sources.json'), 'utf8'));

const CS = 'https://www.cheapshark.com/api/1.0';
const EPIC = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions';
const STEAM = 'https://store.steampowered.com/api/appdetails';
const ITAD_KEY = process.env.ITAD_KEY || '';
const UA = 'dcop7.github.io product-discovery';
const NOW = Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

console.log(`[gaming] start ${new Date(NOW).toISOString()} | itad=${!!ITAD_KEY}`);

async function jget(url, { tries = 3, label = '' } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
      if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries - 1) { console.log(`  ${label || url.slice(0, 50)} fail: ${e.message}`); return null; } await sleep(600 * (i + 1)); }
  }
  return null;
}

/* ── stores ── */
let STORES = {};
async function loadStores() {
  const a = await jget(`${CS}/stores`, { label: 'stores' }) || [];
  a.forEach(s => { STORES[s.storeID] = { name: (cfg.storeMeta[s.storeID]?.name) || s.storeName, color: cfg.storeMeta[s.storeID]?.color || '#888', icon: 'https://www.cheapshark.com' + (s.images?.icon || '') }; });
}
const reputable = id => cfg.reputableStores.includes(String(id));

/* ── currency: CheapShark prices are USD → convert to EUR (keyless, ECB rate).
   ITAD prices (when present) are already EUR and are not re-converted. ── */
let FX = 0.92;
async function fetchFx() {
  const j = await jget('https://api.frankfurter.app/latest?from=USD&to=EUR', { label: 'fx' });
  if (j?.rates?.EUR) FX = j.rates.EUR;
  console.log(`  USD→EUR = ${FX}`);
}
const eur = v => v == null ? null : +(v * FX).toFixed(2);

/* ── direct store links (NOT the cheapshark.com/redirect affiliate URL, which
   routes through cj.dotomi.com and is blocked by ad-blockers). Steam → app
   page; other stores → their own search by title. ── */
function buyUrl(storeID, title, steamAppID) {
  if (String(storeID) === '1' && steamAppID) return 'https://store.steampowered.com/app/' + steamAppID + '/';
  const tmpl = cfg.storeMeta[String(storeID)]?.search;
  return tmpl ? tmpl.replace('{q}', encodeURIComponent(title)) : 'https://store.steampowered.com/search/?term=' + encodeURIComponent(title);
}

/* ── CheapShark deals (paginated, two sorts: rating + savings) ── */
const games = new Map();   // id → record
function gid(steamAppID, title) { return steamAppID ? 'steam-' + steamAppID : 'g-' + slug(title); }

async function fetchDeals() {
  const seen = new Set();
  for (const sortBy of ['Deal Rating', 'Savings']) {
    for (let page = 0; page < cfg.dealPages; page++) {
      const url = `${CS}/deals?pageSize=60&page=${page}&sortBy=${encodeURIComponent(sortBy)}&onSale=1`;
      const list = await jget(url, { label: `deals ${sortBy} p${page}` });
      if (!list || !list.length) break;
      for (const d of list) {
        if (!reputable(d.storeID)) continue;
        const normal = +d.normalPrice, sale = +d.salePrice;
        if (!(normal > 0)) continue;
        const id = gid(d.steamAppID, d.title);
        const key = id + ':' + d.storeID;
        if (seen.has(key)) continue; seen.add(key);
        let g = games.get(id);
        if (!g) { g = { id, title: d.title, steamAppID: d.steamAppID || null, thumb: d.thumb, cur: '$', deals: [], steamRating: +d.steamRatingPercent || null, csGameID: d.gameID }; games.set(id, g); }
        g.steamRating = g.steamRating || (+d.steamRatingPercent || null);
        g.csGameID = g.csGameID || d.gameID;
        g.deals.push({ storeID: d.storeID, sale, normal, savings: Math.round(+d.savings), dealID: d.dealID, dealRating: +d.dealRating || 0 });
      }
      await sleep(350);
    }
  }
  console.log(`  deals: ${games.size} unique games`);
}

/* ── cheapest-ever price + date (batched) ── */
async function fetchLows() {
  const ids = [...games.values()].map(g => g.csGameID).filter(Boolean);
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25);
    const map = await jget(`${CS}/games?ids=${batch.join(',')}`, { label: 'lows' });
    if (map) for (const csId in map) {
      const g = [...games.values()].find(x => x.csGameID === csId);
      if (g && map[csId].cheapestPriceEver) { g.low = +map[csId].cheapestPriceEver.price; g.lowDate = map[csId].cheapestPriceEver.date * 1000; }
    }
    await sleep(300);
  }
}

/* ── Epic free games (rich: € price, dates, art) ── */
const freeNow = [];
async function fetchEpicFree() {
  const data = await jget(`${EPIC}?locale=${cfg.locale.epicLocale}&country=${cfg.locale.country}`, { label: 'epic' });
  const els = data?.data?.Catalog?.searchStore?.elements || [];
  for (const e of els) {
    const offs = (e.promotions?.promotionalOffers || [])[0]?.promotionalOffers || [];
    const off = offs.find(o => o.discountSetting?.discountPercentage === 0);
    if (!off) continue;                                  // only truly-free (100% off) right now
    const img = t => (e.keyImages || []).find(i => i.type === t)?.url;
    const s = e.productSlug || e.catalogNs?.mappings?.[0]?.pageSlug || (e.offerMappings || [])[0]?.pageSlug || slug(e.title);
    freeNow.push({
      id: 'epic-' + slug(e.title), title: e.title, store: 'Epic Games Store', storeColor: '#2a2a2a',
      orig: e.price?.totalPrice?.fmtPrice?.originalPrice || null, cur: '€', sale: 0,
      end: off.endDate, start: off.startDate,
      image: img('OfferImageWide') || img('DieselStoreFrontWide') || img('Thumbnail'),
      url: 'https://store.epicgames.com/p/' + String(s).replace(/^\/+/, ''),
      desc: (e.description || '').slice(0, 200), source: 'epic',
    });
  }
  console.log(`  epic free: ${freeNow.length}`);
}

/* ── CheapShark free (100% off across stores) → merge into freeNow ── */
async function fetchCsFree() {
  const list = await jget(`${CS}/deals?upperPrice=0&pageSize=40&onSale=1`, { label: 'cs free' }) || [];
  for (const d of list) {
    if (!reputable(d.storeID)) continue;
    const title = d.title;
    if (freeNow.some(f => slug(f.title) === slug(title))) continue;   // dedup vs Epic
    freeNow.push({
      id: 'free-' + slug(title), title, store: STORES[d.storeID]?.name || 'Store', storeColor: STORES[d.storeID]?.color || '#888',
      orig: String(eur(+d.normalPrice)).replace('.', ',') + '€', cur: '€', sale: 0, end: null,
      image: d.thumb, steamAppID: d.steamAppID || null,
      url: buyUrl(d.storeID, title, d.steamAppID), source: 'cheapshark',
    });
  }
  console.log(`  free total: ${freeNow.length}`);
}

/* ── Steam metadata enrichment (capped + spaced) ── */
async function enrichSteam() {
  const ranked = [...games.values()].filter(g => g.steamAppID).sort((a, b) => dealScore(b) - dealScore(a)).slice(0, cfg.steamEnrichMax);
  let ok = 0;
  for (const g of ranked) {
    const j = await jget(`${STEAM}?appids=${g.steamAppID}&cc=${cfg.locale.steamCC}&l=${cfg.locale.steamLang}`, { label: 'steam ' + g.steamAppID, tries: 2 });
    const d = j && j[g.steamAppID] && j[g.steamAppID].success && j[g.steamAppID].data;
    if (d) {
      g.genres = (d.genres || []).map(x => x.description).slice(0, 4);
      g.release = d.release_date?.date || null;
      g.cover = d.header_image || g.thumb;
      g.platforms = Object.entries(d.platforms || {}).filter(([, v]) => v).map(([k]) => k);
      g.descFull = (d.short_description || '').replace(/<[^>]+>/g, '').slice(0, 320);
      g.eur = d.price_overview?.final_formatted || null;
      ok++;
    }
    await sleep(260);
  }
  console.log(`  steam enriched: ${ok}/${ranked.length}`);
}

/* ── optional ITAD (EUR + history) ── */
async function enrichItad() {
  if (!ITAD_KEY) { console.log('  itad: skipped (no key)'); return false; }
  let done = 0;
  const list = [...games.values()].filter(g => g.steamAppID).sort((a, b) => dealScore(b) - dealScore(a)).slice(0, 150);
  for (const g of list) {
    try {
      const look = await jget(`https://api.isthereanydeal.com/games/lookup/v1?key=${ITAD_KEY}&appid=${g.steamAppID}`, { label: 'itad lookup' });
      const uid = look?.game?.id; if (!uid) continue;
      const hist = await jget(`https://api.isthereanydeal.com/games/history/v2?key=${ITAD_KEY}&id=${uid}&country=PT&since=${new Date(NOW - 1100 * 864e5).toISOString()}`, { label: 'itad hist' });
      if (Array.isArray(hist) && hist.length) {
        g.history = hist.map(h => [Date.parse(h.timestamp), +(h.deal?.price?.amount ?? h.price?.amount)]).filter(p => p[1] >= 0);
        g.cur = '€';
      }
      done++; await sleep(500);
    } catch {}
  }
  console.log(`  itad: ${done} games with history`);
  return done > 0;
}

/* ── metrics ── */
function bestDeal(g) { return (g.deals || []).slice().sort((a, b) => a.sale - b.sale)[0] || null; }
function dealScore(g) {
  const bd = bestDeal(g); if (!bd) return 0;
  const w = cfg.scoreWeights;
  const savings = (bd.savings || 0) / 100;
  const rating = (g.steamRating || 0) / 100;
  const dr = (bd.dealRating || 0) / 10;
  const near = g.low ? Math.max(0, 1 - Math.max(0, (bd.sale - g.low) / g.low)) : 0;
  return +(100 * (w.savings * savings + w.steamRating * rating + w.dealRating * dr + w.nearLow * near)).toFixed(1);
}
function verdict(g) {
  const bd = bestDeal(g); if (!bd || !g.low) return null;
  if (bd.sale <= g.low * cfg.verdict.greatMul) return 'great';
  if (bd.sale <= g.low * cfg.verdict.okMul) return 'ok';
  return 'wait';
}
function pctAboveLow(g) { const bd = bestDeal(g); return (bd && g.low > 0) ? (bd.sale - g.low) / g.low : null; }

/* ── compact card + detail ── */
function card(g) {
  const bd = bestDeal(g);
  return {
    id: g.id, title: g.title, thumb: g.cover || g.thumb, cur: '€', store: STORES[bd?.storeID]?.name || '',
    storeColor: STORES[bd?.storeID]?.color || '#888', sale: bd ? eur(bd.sale) : null, normal: bd ? eur(bd.normal) : null,
    cut: bd ? bd.savings : 0, low: g.low != null ? eur(g.low) : null, lowDate: g.lowDate ?? null, pctLow: pctAboveLow(g),
    score: dealScore(g), steamRating: g.steamRating || null, verdict: verdict(g),
    genres: g.genres || null, steamAppID: g.steamAppID || null,
    url: bd ? buyUrl(bd.storeID, g.title, g.steamAppID) : null,
  };
}
function detail(g) {
  const hist = (g.history && g.history.length) ? g.history : (g.histSeries || []);   // ITAD (EUR) > keyless snapshot
  return {
    ...card(g), descFull: g.descFull || '', release: g.release || null, platforms: g.platforms || [], eur: g.eur || null,
    history: hist.length ? hist : null,
    deals: (g.deals || []).slice().sort((a, b) => a.sale - b.sale).map(d => ({
      store: STORES[d.storeID]?.name || '', storeColor: STORES[d.storeID]?.color || '#888',
      sale: eur(d.sale), normal: eur(d.normal), cut: d.savings, url: buyUrl(d.storeID, g.title, g.steamAppID),
    })),
  };
}

/* ── write ── */
function writeAll(hasHistory) {
  mkdirSync(G_DIR, { recursive: true });
  const all = [...games.values()].filter(g => bestDeal(g));

  /* accrue a keyless price history: one EUR point per game per day, 3-year
     window. Grows over time across Action runs; ITAD (when present) supplies a
     backfilled series instead. */
  const dayMs = Date.parse(new Date(NOW).toISOString().slice(0, 10));
  let snap = {}; try { snap = JSON.parse(readFileSync(PSNAP, 'utf8')); } catch {}
  const cutoff = NOW - 1095 * 864e5, newSnap = {};
  for (const g of all) {
    const p = eur(bestDeal(g).sale);
    let series = (snap[g.id] || []).filter(pt => pt[0] >= cutoff);
    const last = series[series.length - 1];
    if (last && last[0] === dayMs) last[1] = p; else series.push([dayMs, p]);
    newSnap[g.id] = series; g.histSeries = series;
  }
  mkdirSync(dirname(PSNAP), { recursive: true }); writeFileSync(PSNAP, JSON.stringify(newSnap));

  // prune stale detail files
  const ids = new Set(all.map(g => g.id));
  if (existsSync(G_DIR)) for (const f of readdirSync(G_DIR)) { if (!ids.has(f.replace(/\.json$/, ''))) try { rmSync(join(G_DIR, f)); } catch {} }
  for (const g of all) writeFileSync(join(G_DIR, g.id + '.json'), JSON.stringify(detail(g)));

  const cards = all.map(card);
  const by = (arr, f, n) => arr.slice().sort(f).slice(0, n);
  const active = freeNow.filter(f => !f.end || Date.parse(f.end) > NOW);
  const bestDeals = by(cards.filter(c => c.cut > 0), (a, b) => b.score - a.score, 40);
  const historicLows = by(cards.filter(c => c.pctLow != null && c.pctLow <= 0.15 && c.cut > 0), (a, b) => a.pctLow - b.pctLow, 40);
  const endingSoon = active.filter(f => f.end && Date.parse(f.end) - NOW < 60 * 3600e3).sort((a, b) => Date.parse(a.end) - Date.parse(b.end));

  // stats
  const freeValue = active.reduce((s, f) => s + (parseFloat(String(f.orig).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0), 0);
  const biggest = Math.max(0, ...cards.map(c => c.cut || 0));
  const best = bestDeals[0] || null;
  const stats = {
    freeCount: active.length, freeValue: +freeValue.toFixed(2), freeValueCur: '€',
    biggestCut: biggest, historicLowCount: cards.filter(c => c.verdict === 'great' && c.cut > 0).length,
    best: best ? { id: best.id, title: best.title, cut: best.cut } : null,
  };

  const genreSet = {}; cards.forEach(c => (c.genres || []).forEach(g => genreSet[g] = (genreSet[g] || 0) + 1));
  const genres = Object.entries(genreSet).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, count]) => ({ name, count }));

  const index = {
    generatedAt: new Date(NOW).toISOString(), currency: '€', hasHistory,
    count: cards.length, stores: STORES, genres,
    bundles: { freeNow: active, bestDeals, historicLows, endingSoon }, stats,
  };
  writeFileSync(join(HERE, 'index.json'), JSON.stringify(index));
  writeFileSync(join(HERE, 'games.json'), JSON.stringify({ generatedAt: index.generatedAt, games: cards }));
  console.log(`[gaming] wrote index (${cards.length} games, ${active.length} free), ${all.length} detail files`);
}

/* ── main ── */
(async () => {
  await fetchFx();
  await loadStores();
  await fetchDeals();
  await fetchLows();
  await fetchEpicFree();
  await fetchCsFree();
  await enrichSteam();
  const hasHistory = await enrichItad();
  writeAll(hasHistory);
  console.log('[gaming] done.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
