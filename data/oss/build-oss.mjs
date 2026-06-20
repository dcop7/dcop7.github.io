/* ══════════════════════════════════════════════════════════════════
   build-oss.mjs — "Descobrir Tech" static data pipeline (no backend)

   A GitHub Action (.github/workflows/oss-refresh.yml) runs this daily. It:
     1. DISCOVERS repos via the GitHub Search API (full repo metadata comes
        back in one call: stars, forks, language, license, dates, topics…),
        across curated categories + languages + a "recent & rising" sweep.
     2. ENRICHES with Hacker News (Algolia API) — Show HN, top, recent — and
        with community Awesome Lists (parsed from their raw README).
     3. CORRELATES HN posts and Awesome entries to the canonical owner/name.
     4. Tracks a compact STAR HISTORY snapshot (data/oss/_snap/stars.json) and
        diffs it for recent star velocity (Δ7d). Bootstraps from stars/age.
     5. SCORES relevance (velocity + activity + log stars + youth + HN +
        awesome) so total-star giants don't always dominate.
     6. WRITES static JSON shards for GitHub Pages:
          data/oss/index.json          catalog + precomputed homepage bundles
          data/oss/projects.json       compact search index (all projects)
          data/oss/p/<owner__name>.json per-project detail (lazy-loaded)
          data/oss/_snap/stars.json    internal star-history snapshot

   Auth: uses GH_TOKEN / GITHUB_TOKEN when present (the Action passes the
   automatic token — the user manages no key). Without a token it still works
   unauthenticated at reduced volume (handy for local testing).

   Pure Node 18+ (global fetch). Run: node data/oss/build-oss.mjs
══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;                       // data/oss
const P_DIR = join(OUT, 'p');
const SNAP = join(OUT, '_snap', 'stars.json');
const cfg = JSON.parse(readFileSync(join(HERE, 'sources.json'), 'utf8'));

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const AUTHED = !!TOKEN;
const UA = 'dcop7.github.io oss-discovery';
const DAY = 86400e3;
const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Volume scales with auth: full in the Action, light when testing locally. */
const SEARCH_PAGES = AUTHED ? 2 : 1;        // 100 repos/page
const SEARCH_GAP   = AUTHED ? 2200 : 6500;  // respect search rate (30/min vs 10/min)
const ENRICH       = AUTHED;                 // languages breakdown via GraphQL needs a token

console.log(`[oss] start ${TODAY} | auth=${AUTHED} | pages=${SEARCH_PAGES}`);

/* ── low-level fetchers (retry + rate-limit aware) ───────────────────── */
async function ghJSON(url, { search = false } = {}) {
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, { headers });
    if (r.status === 403 || r.status === 429) {       // primary/secondary rate limit
      const reset = +r.headers.get('x-ratelimit-reset') * 1000;
      const wait = Math.min(60000, Math.max(2000, (reset && reset > NOW) ? reset - Date.now() : 4000 * (i + 1)));
      console.log(`  …rate-limited, waiting ${(wait / 1000) | 0}s`);
      await sleep(wait); continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 80)}`);
    return r.json();
  }
  throw new Error('gave up (rate limit): ' + url.slice(0, 80));
}
async function text(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 80)}`);
  return r.text();
}

/* ── GitHub Search (returns full repo objects) ───────────────────────── */
const repos = new Map();   // key owner/name(lower) → raw repo + provenance
function canon(full) { return full.toLowerCase(); }
function ingestRepo(it, { cat, viaAwesome, awesomeList } = {}) {
  if (!it || it.fork || it.archived) return;
  const key = canon(it.full_name);
  let rec = repos.get(key);
  if (!rec) { rec = { it, cats: new Set(), awesome: [], hn: [] }; repos.set(key, rec); }
  else if (it.stargazers_count != null) rec.it = it;     // freshest metadata wins
  if (cat) rec.cats.add(cat);
  if (viaAwesome && !rec.awesome.find(a => a.id === awesomeList.id)) rec.awesome.push(awesomeList);
}

async function search(q, sort, { cat } = {}) {
  for (let page = 1; page <= SEARCH_PAGES; page++) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}` +
                `&sort=${sort}&order=desc&per_page=100&page=${page}`;
    let data;
    try { data = await ghJSON(url, { search: true }); }
    catch (e) { console.log('  search fail:', q.slice(0, 50), e.message); break; }
    const items = data.items || [];
    items.forEach(it => ingestRepo(it, { cat }));
    process.stdout.write(`  search "${q.slice(0, 42)}" p${page} → +${items.length}\n`);
    await sleep(SEARCH_GAP);
    if (items.length < 100) break;
  }
}

async function discover() {
  const recentISO = new Date(NOW - 365 * DAY).toISOString().slice(0, 10);   // created within ~1y
  const pushedISO = new Date(NOW - 90 * DAY).toISOString().slice(0, 10);    // active in ~90d
  /* GitHub repo search has no OR/parentheses — query each topic separately. */
  for (const c of cfg.categories) {
    const topics = c.topics.slice(0, AUTHED ? 5 : 2);
    for (const t of topics) {
      await search(`topic:${t} stars:>400 pushed:>${pushedISO}`, 'stars', { cat: c.id });
      if (AUTHED) await search(`topic:${t} stars:>120 created:>${recentISO}`, 'updated', { cat: c.id });
    }
  }
  /* "recent & rising" — new repos already gaining traction (trending proxy) */
  await search(`stars:>300 created:>${recentISO} pushed:>${pushedISO}`, 'stars');
  /* top by language (broad popularity backbone) */
  for (const lang of Object.keys(cfg.languages).slice(0, AUTHED ? 16 : 8)) {
    await search(`language:"${lang}" stars:>2000 pushed:>${pushedISO}`, 'stars');
  }
}

/* ── Hacker News via Algolia (no key, no CORS issue server-side) ──────── */
async function hackerNews() {
  const queries = [
    'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=points%3E25&hitsPerPage=300',
    'https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=200',
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=100',
  ];
  const seen = new Set();
  for (const u of queries) {
    let data; try { data = JSON.parse(await text(u)); } catch (e) { console.log('  HN fail', e.message); continue; }
    for (const h of (data.hits || [])) {
      if (seen.has(h.objectID)) continue; seen.add(h.objectID);
      const gh = ghFromUrl(h.url) || ghFromText(h.title);
      if (!gh) continue;
      const rec = repos.get(canon(gh));
      const post = { title: h.title, points: h.points | 0, comments: h.num_comments | 0,
        url: h.url, objectID: h.objectID, date: (h.created_at || '').slice(0, 10) };
      if (rec) rec.hn.push(post);
      else hnOrphans.set(canon(gh), [...(hnOrphans.get(canon(gh)) || []), { gh, post }]);
    }
    await sleep(400);
  }
  console.log(`  HN: matched posts to ${[...repos.values()].filter(r => r.hn.length).length} known repos, ${hnOrphans.size} new`);
}
const hnOrphans = new Map();

/* Fetch the highest-scoring HN-launched repos we don't have yet, so the
   "Descobertas da comunidade" rail surfaces buzzy projects before they blow up. */
async function fetchHnOrphans() {
  const top = [...hnOrphans.entries()]
    .filter(([key]) => !repos.has(key))
    .map(([key, arr]) => ({ key, arr, top: Math.max(...arr.map(x => x.post.points)) }))
    .sort((a, b) => b.top - a.top).slice(0, AUTHED ? 300 : 20);
  console.log(`  HN orphans to fetch: ${top.length}`);
  let ok = 0;
  for (const { key, arr } of top) {
    try {
      const it = await ghJSON(`https://api.github.com/repos/${key}`);
      if (it && it.full_name && !it.fork) {
        ingestRepo(it);
        const rec = repos.get(canon(it.full_name));
        if (rec) arr.forEach(x => rec.hn.push(x.post));
        ok++;
      }
    } catch { /* gone/renamed */ }
    await sleep(AUTHED ? 140 : 1100);
  }
  console.log(`  HN orphans fetched: ${ok}`);
}
function ghFromUrl(u) {
  if (!u) return null;
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:[/#?].*)?$/i.exec(u);
  if (!m) return null;
  const name = m[2].replace(/\.git$/, '');
  if (['sponsors', 'topics', 'collections', 'about', 'features'].includes(m[1].toLowerCase())) return null;
  return `${m[1]}/${name}`;
}
function ghFromText() { return null; }   // conservative: only correlate by explicit URL

/* ── Awesome Lists (parse raw README → repo links per heading) ────────── */
async function awesomeLists() {
  for (const a of cfg.awesome) {
    let md;
    const tryBranches = [a.branch, a.branch === 'main' ? 'master' : 'main'];
    for (const br of tryBranches) {
      try { md = await text(`https://raw.githubusercontent.com/${a.repo}/${br}/README.md`); break; } catch {}
    }
    if (!md) { console.log('  awesome fail:', a.repo); continue; }
    let heading = '';
    let n = 0;
    for (const line of md.split('\n')) {
      const h = /^#{2,4}\s+(.+?)\s*$/.exec(line);
      if (h) { heading = h[1].replace(/[#*`\[\]]/g, '').trim(); continue; }
      // list item linking to a github repo:  - [name](https://github.com/owner/repo) - desc
      const m = /^\s*[-*]\s*\[([^\]]+)\]\((https?:\/\/github\.com\/[^)]+)\)\s*[-–—:]?\s*(.*)$/.exec(line);
      if (!m) continue;
      const gh = ghFromUrl(m[2]); if (!gh) continue;
      const list = { id: a.id, label: a.label, emoji: a.emoji, category: a.category, heading: heading || a.label, desc: m[3].trim() };
      awesomeIndex.set(canon(gh), [...(awesomeIndex.get(canon(gh)) || []), list]);
      const rec = repos.get(canon(gh));
      if (rec) ingestRepo(rec.it, { cat: a.category, viaAwesome: true, awesomeList: list });
      n++;
    }
    console.log(`  awesome ${a.repo}: ${n} repo links`);
    await sleep(300);
  }
}
const awesomeIndex = new Map();   // canon → [list…]  (also for orphans we may fetch)

/* Pull in the most-cited Awesome repos we don't have yet (so curation adds
   coverage, not just popularity). Fetch their metadata via Search by name. */
async function fetchAwesomeOrphans() {
  const counts = new Map();
  for (const [key, lists] of awesomeIndex) if (!repos.has(key)) counts.set(key, lists.length);
  // most-cited first (appears in more lists / sections) so we add quality, not noise
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, AUTHED ? 500 : 20).map(e => e[0]);
  console.log(`  awesome orphans to fetch: ${top.length}`);
  let ok = 0;
  for (const key of top) {
    try {
      const it = await ghJSON(`https://api.github.com/repos/${key}`);   // REST: full repo metadata
      if (it && it.full_name) {
        const lists = awesomeIndex.get(canon(it.full_name)) || awesomeIndex.get(key) || [];
        ingestRepo(it, { cat: lists[0]?.category });
        const rec = repos.get(canon(it.full_name));
        if (rec) lists.forEach(l => { if (!rec.awesome.find(a => a.id === l.id)) rec.awesome.push(l); });
        ok++;
      }
    } catch { /* renamed/deleted repo — skip */ }
    await sleep(AUTHED ? 140 : 1100);   // stay within core rate (1000/h authed, 60/h anon)
  }
  console.log(`  awesome orphans fetched: ${ok}`);
}

/* ── GraphQL enrichment (languages %) — token only, batched ───────────── */
async function enrich() {
  if (!ENRICH) { console.log('  enrich: skipped (no token)'); return; }
  const keys = [...repos.keys()];
  for (let i = 0; i < keys.length; i += 80) {
    const batch = keys.slice(i, i + 80);
    const q = `query{${batch.map((k, j) => {
      const [o, n] = k.split('/');
      return `r${j}: repository(owner:${JSON.stringify(o)}, name:${JSON.stringify(n)}){ ` +
        `nameWithOwner watchers{totalCount} languages(first:6, orderBy:{field:SIZE, direction:DESC}){ totalSize edges{size node{name color}} } }`;
    }).join(' ')}}`;
    try {
      const r = await fetch('https://api.github.com/graphql', {
        method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'User-Agent': UA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await r.json();
      if (data.data) for (const k in data.data) {
        const rr = data.data[k]; if (!rr) continue;
        const rec = repos.get(canon(rr.nameWithOwner)); if (!rec) continue;
        rec.watchers = rr.watchers?.totalCount;
        const tot = rr.languages?.totalSize || 0;
        rec.langs = (rr.languages?.edges || []).map(e => ({ name: e.node.name, color: e.node.color, pct: tot ? Math.round(e.size / tot * 100) : 0 }));
      }
    } catch (e) { console.log('  graphql batch fail', e.message); }
    await sleep(800);
  }
  console.log(`  enrich: languages for ${[...repos.values()].filter(r => r.langs).length} repos`);
}

/* ── star history snapshot (compact, weekly points, 90d window) ───────── */
function loadSnap() { try { return JSON.parse(readFileSync(SNAP, 'utf8')); } catch { return {}; } }
function velocityFrom(series, it) {
  // Real Δ7d: today's stars vs the snapshot point ~7d old. Bootstrap from age
  // when no old-enough point exists yet (first ~week of runs).
  const starsNow = it.stargazers_count;
  if (series && series.length) {
    let ref = null;
    for (let i = series.length - 1; i >= 0; i--) {
      if (daysBetween(series[i][0], TODAY) >= 6) { ref = series[i]; break; }
    }
    if (ref) {
      const d = daysBetween(ref[0], TODAY);
      if (d > 0) return { d7: Math.round((starsNow - ref[1]) * 7 / d), boot: false };
    }
  }
  const ageW = Math.max(1, (NOW - Date.parse(it.created_at)) / (7 * DAY));
  return { d7: Math.round(starsNow / ageW), boot: true };
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/* ── relevance score ──────────────────────────────────────────────────
   Combine signals so a 300k-star 10-year-old repo doesn't always win. */
function scoreOf(p, it, hnBest, awesomeN) {
  const ageDays = Math.max(1, (NOW - Date.parse(it.created_at)) / DAY);
  const pushedDaysAgo = (NOW - Date.parse(it.pushed_at)) / DAY;
  const velocity = Math.log10(1 + Math.max(0, p.vel));                 // stars/week
  const activity = Math.exp(-pushedDaysAgo / 45);                       // 1=just pushed → ~0 stale
  const stars = Math.log10(1 + it.stargazers_count);
  const youth = (ageDays < 540 ? 1 : 0) * Math.log10(1 + Math.max(0, p.vel)) * 1.2;
  const hn = hnBest ? Math.log10(1 + hnBest.points + hnBest.comments) * Math.exp(-((NOW - Date.parse(hnBest.date)) / DAY) / 120) : 0;
  const awe = Math.log10(1 + awesomeN);
  return +(3.2 * velocity + 2.4 * activity + 1.3 * stars + 1.6 * youth + 1.8 * hn + 1.2 * awe).toFixed(3);
}

/* ── assemble records ─────────────────────────────────────────────────── */
function shortDesc(s, n = 160) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function build() {
  const snap = loadSnap();
  const projects = [];
  const details = new Map();
  const langColor = cfg.languages;

  for (const [key, rec] of repos) {
    const it = rec.it;
    const id = it.full_name.replace('/', '__');
    const series = snap[id] || [];
    const { d7, boot } = velocityFrom(series, it);
    const vel = Math.max(0, d7);
    const p = { vel };
    const hnPosts = [...(rec.hn || [])].sort((a, b) => (b.points + b.comments) - (a.points + a.comments));
    const hnBest = hnPosts[0] || null;
    const awesomeIn = rec.awesome || [];
    const cats = [...rec.cats];
    const created = (it.created_at || '').slice(0, 10);
    const pushed = (it.pushed_at || '').slice(0, 10);
    const score = scoreOf(p, it, hnBest, awesomeIn.length);

    const card = {
      id, name: it.name, owner: it.owner?.login || it.full_name.split('/')[0],
      desc: shortDesc(it.description), lang: it.language || null,
      langColor: it.language ? (langColor[it.language] || '#8b949e') : null,
      stars: it.stargazers_count, forks: it.forks_count, issues: it.open_issues_count,
      d7, boot, vel, score, cats, lists: awesomeIn.length,
      hn: hnBest ? { points: hnBest.points, comments: hnBest.comments } : null,
      license: it.license?.spdx_id && it.license.spdx_id !== 'NOASSERTION' ? it.license.spdx_id : null,
      created, pushed, topics: (it.topics || []).slice(0, 6),
      isNew: (NOW - Date.parse(it.created_at)) < 400 * DAY,
    };
    projects.push(card);

    details.set(id, {
      ...card,
      descFull: it.description || '', homepage: it.homepage || '', avatar: it.owner?.avatar_url || '',
      ghUrl: it.html_url, defaultBranch: it.default_branch,
      watchers: rec.watchers,   // real subscriber count (GraphQL only); REST watchers_count == stars, so omit it
      langs: rec.langs || (it.language ? [{ name: it.language, color: langColor[it.language] || '#8b949e', pct: 100 }] : []),
      hnPosts: hnPosts.slice(0, 5),
      awesomeIn: awesomeIn.map(a => ({ list: a.id, label: a.label, emoji: a.emoji, heading: a.heading, category: a.category })),
      starsSeries: appendSnap(series, it.stargazers_count),
    });
  }

  /* persist updated snapshot (weekly cadence, 90d window) */
  const newSnap = {};
  for (const [id, d] of details) newSnap[id] = d.starsSeries;
  writeSnap(newSnap);

  return { projects, details };
}
function appendSnap(series, stars) {
  const s = [...series];
  const last = s[s.length - 1];
  if (!last || daysBetween(last[0], TODAY) >= 6) s.push([TODAY, stars]);
  else last[1] = stars;                                   // refresh today's point
  const cutoff = NOW - 95 * DAY;
  return s.filter(pt => Date.parse(pt[0]) >= cutoff);
}
function writeSnap(obj) { mkdirSync(dirname(SNAP), { recursive: true }); writeFileSync(SNAP, JSON.stringify(obj)); }

/* ── bundles for the homepage ─────────────────────────────────────────── */
function makeBundles(projects, langColor) {
  const by = (arr, f, n) => arr.slice().sort(f).slice(0, n);
  const recent = p => (NOW - Date.parse(p.created)) < 400 * DAY;
  const active = p => (NOW - Date.parse(p.pushed)) < 120 * DAY;

  const trending = by(projects.filter(active), (a, b) => b.score - a.score, 40);
  const neu = by(projects.filter(p => recent(p) && active(p)), (a, b) => (b.vel - a.vel) || (b.stars - a.stars), 40);
  const community = by(projects.filter(p => p.hn), (a, b) => ((b.hn.points + b.hn.comments) - (a.hn.points + a.hn.comments)), 40);
  const gems = by(projects.filter(p => p.stars < 5000 && p.stars > 150 && active(p)), (a, b) => b.score - a.score, 40);
  const popular = by(projects, (a, b) => b.stars - a.stars, 40);

  /* top per category & language */
  const topByCat = {};
  for (const c of cfg.categories) topByCat[c.id] = by(projects.filter(p => p.cats.includes(c.id)), (a, b) => b.score - a.score, 24);
  const langCounts = {};
  projects.forEach(p => { if (p.lang) langCounts[p.lang] = (langCounts[p.lang] || 0) + 1; });
  const topLangs = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a]).slice(0, 12);
  const topByLang = {};
  for (const l of topLangs) topByLang[l] = by(projects.filter(p => p.lang === l), (a, b) => b.score - a.score, 24);

  /* collections from awesome groupings */
  const collections = cfg.awesome.map(a => {
    const items = by(projects.filter(p => p.cats.includes(a.category)), (x, y) => y.score - x.score, 12);
    return { id: a.id, label: a.label, emoji: a.emoji, category: a.category, items: items.map(slim) };
  }).filter(c => c.items.length >= 4);

  const surprise = by(projects.filter(p => p.score > 4 && active(p)), (a, b) => b.score - a.score, 120).map(p => p.id);

  const slimList = arr => arr.map(slim);
  return {
    trending: slimList(trending), new: slimList(neu), community: slimList(community),
    gems: slimList(gems), popular: slimList(popular),
    topByCat: mapVals(topByCat, slimList), topByLang: mapVals(topByLang, slimList),
    collections, surprise,
  };
}
const mapVals = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
/* compact card for rails (everything the card UI needs, no second fetch) */
function slim(p) {
  return { id: p.id, name: p.name, owner: p.owner, desc: p.desc, lang: p.lang, langColor: p.langColor,
    stars: p.stars, forks: p.forks, d7: p.d7, boot: p.boot, score: p.score, cats: p.cats,
    lists: p.lists, hn: p.hn, license: p.license, created: p.created, pushed: p.pushed, isNew: p.isNew, topics: p.topics };
}

/* ── write everything ─────────────────────────────────────────────────── */
function writeAll(projects, details) {
  mkdirSync(P_DIR, { recursive: true });
  // prune stale per-project files
  if (existsSync(P_DIR)) for (const f of readdirSync(P_DIR)) {
    const id = f.replace(/\.json$/, '');
    if (!details.has(id)) try { rmSync(join(P_DIR, f)); } catch {}
  }
  for (const [id, d] of details) writeFileSync(join(P_DIR, id + '.json'), JSON.stringify(d));

  const langCounts = {};
  projects.forEach(p => { if (p.lang) langCounts[p.lang] = (langCounts[p.lang] || 0) + 1; });
  const languages = Object.entries(langCounts).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, color: cfg.languages[name] || '#8b949e', count }));
  const categories = cfg.categories.map(c => ({ id: c.id, emoji: c.emoji, label: c.label, label_en: c.label_en,
    count: projects.filter(p => p.cats.includes(c.id)).length }));

  const index = { generatedAt: new Date(NOW).toISOString(), count: projects.length,
    authed: AUTHED, categories, languages, bundles: makeBundles(projects, cfg.languages) };
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
  writeFileSync(join(OUT, 'projects.json'), JSON.stringify({ generatedAt: index.generatedAt, projects: projects.map(slim) }));

  console.log(`[oss] wrote index (${projects.length} projects, ${categories.length} cats, ${languages.length} langs), ${details.size} detail files`);
}

/* ── main ─────────────────────────────────────────────────────────────── */
(async () => {
  await discover();
  await awesomeLists();
  await fetchAwesomeOrphans();
  await hackerNews();
  await fetchHnOrphans();
  await enrich();
  console.log(`[oss] collected ${repos.size} repos`);
  const { projects, details } = build();
  writeAll(projects, details);
  console.log('[oss] done.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
