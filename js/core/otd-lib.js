/* ══════════════════════════════════════════════════════════════════
   otd-lib.js — shared "on this day" selection logic.
   Single source of truth used by BOTH:
     • data/home/build-home.mjs (GitHub Action, via createRequire)
     • js/core/main.js in the browser (live fallback when today.json is
       from a previous day because the Action ran late)
   Takes the raw Wikimedia on-this-day feeds (PT + EN) and produces the
   three homepage sections: history, portugal, births.
   UMD: exposes window.OTDLib in the browser, module.exports in Node.
   ══════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OTDLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clean = s => (s || '').toString().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const cap = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  /* map a Wikimedia on-this-day item → flat record */
  function mapItem(it) {
    const p = (it.pages || [])[0] || {};
    return {
      year: it.year || null,
      text: clean(it.text),
      title: clean(p.normalizedtitle || p.title || '').replace(/_/g, ' '),
      extract: cap(p.extract || '', 160),
      thumb: (p.thumbnail && p.thumbnail.source) || '',
      url: (p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) || '',
    };
  }
  const hay = it => (it.text + ' ' + (it.extract || '') + ' ' + (it.title || '')).toLowerCase();

  /* keyword filters — PT first (the feed is Portuguese), EN as backup */
  const PT_RE = /\bportugal\b|portugu[êe]s|portuguesa|lisboa|\bporto\b(?!-riquenh)|coimbra|\bbraga\b|[ée]vora|a[çc]ores|a[çc]oriano|madeira|madeirense|alentejo|algarve|sal[aá]zar|rep[úu]blica portugu|reino de portugal|rei de portugal|rainha de portugal|descobrimentos|vasco da gama|cam[õo]es|lusitan|lus[óo]fon|d\. afonso|d\. jo[ãa]o|d\. manuel|d\. pedro|d\. maria|d\. sebasti[ãa]o|infante d/i;
  /* births: relevant fields (sci/tech/arts/letters/sport/history) vs pop-only */
  const B_GOOD = /\b(cientista|f[íi]sic|qu[íi]mic|bi[óo]log|matem[áa]tic|engenheir|inventor|astr[óo]nom|astronauta|programador|inform[áa]tic|escritor|escritora|autor|poeta|poetisa|romancista|dramaturg|fil[óo]sof|pintor|pintora|escultor|arquitet|compositor|maestro|economista|m[ée]dic|cirurgi[ãa]|explorador|navegador|nobel|estadista|pioneir|fundador|rei\b|rainha|imperador|monarca|hist[oó]ria|scientist|physicist|inventor|engineer|mathematician|astronomer|writer|poet|painter|composer|philosopher|architect|explorer|nobel)\b/i;
  const B_SPORT = /\b(futebolista|t[ée]nista|ol[íi]mpic|atleta|ciclista|nadador|automobilismo|f[óo]rmula 1|basquetebol|andebol|footballer|olympic athlete)\b/i;
  const B_POP = /\b(cantor|cantora|ator\b|atriz|apresentador|youtuber|influen|\brapper\b|\bdj\b|\bmodelo\b|reality|celebridade|tiktok|actor|actress|singer|rapper|tv personality|youtube)\b/i;

  /* ── measured notability ──────────────────────────────────────────
     How many language editions of Wikipedia carry an article about this
     subject. It is the signal the heuristic below never had: `rankBirths`
     scores by birth year, so on 24/08 it ranked five medieval nobles
     above Jorge Luis Borges (192 sitelinks) and Yasser Arafat (153).

     Two requests for the whole day, ~1s: resolve the article titles the
     feed already gave us to Wikidata ids (50 per call), then read the
     sitelink counts. Everything is optional — no network, a slow reply or
     a missing id leaves `sl` undefined and every consumer falls back to
     the behaviour it had before. */
  const WD_UA = 'dcop7.github.io homepage (https://github.com/dcop7/dcop7.github.io)';
  /* Both header names on purpose: Wikimedia rate-limits anonymous clients
     hard, and Node's default agent gets 429s almost immediately. Node
     honours `User-Agent`; browsers forbid setting it and read
     `Api-User-Agent` instead, so sending both identifies us either way. */
  async function _json(url, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms || 12000);
    try {
      const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': WD_UA, 'Api-User-Agent': WD_UA } });
      if (r.status === 429) return { _retry: true };
      return r.ok ? await r.json() : null;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  /* One polite retry: this runs once a day, so waiting a couple of
     seconds costs nothing and a transient 429 would otherwise silently
     drop the signal for the whole edition. */
  async function _jsonRetry(url) {
    let j = await _json(url);
    if (j && j._retry) {
      await new Promise(r => setTimeout(r, 2500));
      j = await _json(url);
    }
    return j && j._retry ? null : j;
  }

  async function sitelinkCounts(titles, lang) {
    const out = {};
    const uniq = [...new Set(titles.filter(Boolean))];
    for (let i = 0; i < uniq.length; i += 50) {
      const batch = uniq.slice(i, i + 50);
      const q = await _jsonRetry(`https://${lang || 'pt'}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*`
        + `&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(batch.join('|'))}`);
      const pages = (q && q.query && q.query.pages) || [];
      const ids = [], byId = {};
      for (const pg of pages) {
        const qid = pg.pageprops && pg.pageprops.wikibase_item;
        if (qid) { ids.push(qid); byId[qid] = pg.title; }
      }
      if (!ids.length) continue;
      const w = await _jsonRetry('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*'
        + `&props=sitelinks&ids=${ids.join('|')}`);
      const ents = (w && w.entities) || {};
      for (const qid of Object.keys(ents)) {
        const n = Object.keys(ents[qid].sitelinks || {}).length;
        if (byId[qid] && n) out[byId[qid]] = n;
      }
    }
    return out;
  }

  /* Attaches `sl` in place and returns the same object, so a caller can
     await it or ignore it entirely. */
  async function enrich(sections, lang) {
    try {
      const all = [];
      for (const k of ['history', 'portugal', 'births']) for (const x of sections[k] || []) all.push(x);
      const counts = await sitelinkCounts(all.map(x => x.title), lang);
      if (!Object.keys(counts).length) return sections;
      for (const x of all) { const n = counts[x.title]; if (n) x.sl = n; }

      /* Re-rank now that the measured signal exists. Without this the
         counts would be attached but unused: buildSections already
         ordered everything before the first request went out, which is
         how Borges (192 sitelinks) stayed at position 13. */
      if (Array.isArray(sections.births)) {
        sections.births = sections.births
          .map(b => ({ b, s: birthScore(b) }))
          .sort((x, y) => y.s - x.s)
          .map(x => x.b);
      }
      /* Events keep the thumbnail preference — a card with no image reads
         as an afterthought — and use reach only to order within that. */
      for (const k of ['history', 'portugal']) {
        if (!Array.isArray(sections[k])) continue;
        sections[k] = sections[k].slice().sort((a2, b2) =>
          (b2.thumb ? 1 : 0) - (a2.thumb ? 1 : 0) || (b2.sl || 0) - (a2.sl || 0));
      }
    } catch (e) { /* enrichment is never load-bearing */ }
    return sections;
  }

  /* Shared by the initial ranking and by the re-rank that happens once
     sitelink counts arrive (they are fetched after buildSections, so the
     first pass never sees them). */
  function birthScore(b, good, sport) {
    if (good === undefined) { const h = hay(b); good = B_GOOD.test(h); sport = B_SPORT.test(h); }
    let s = 0;
    /* Measured notability dominates when available: it is the only signal
       here that is not a guess. Capped so one very famous contemporary
       cannot bury every historical figure outright. */
    if (b.sl) s += Math.min(120, b.sl * 1.2);
    else if (b.year) s += Math.max(0, (2010 - b.year)) / 8;   /* fallback: prefer historical */
    if (good) s += 35; if (sport) s += 14;
    if (b.thumb) s += 18;
    s += Math.min(40, (b.extract || '').length / 4);          /* longer article ≈ more notable */
    return s;
  }

  function rankBirths(births, n) {
    return births
      .map(mapItem)
      .filter(b => b.title)
      .map(b => {
        const h = hay(b), good = B_GOOD.test(h), sport = B_SPORT.test(h), pop = B_POP.test(h);
        if (pop && !good) return null;                      /* drop pop-only celebs */
        if (!good && !sport && !b.thumb) return null;        /* drop the truly obscure */
        return { ...b, _s: birthScore(b, good, sport) };
      })
      .filter(Boolean)
      .sort((a, b) => b._s - a._s)
      .slice(0, n)
      .map(({ _s, ...b }) => b);
  }

  /* The feed lists some events twice in the same year, once in `selected`
     and once in `events`, worded differently — 24/08 carried both "Eclode
     no Porto a Revolução Liberal…" and "Tem início a Revolução liberal do
     Porto." Same year plus a heavy word overlap is enough to call it one
     event; requiring the year to match keeps it from ever folding two
     different anniversaries. The longer entry survives, being the more
     informative of the two. */
  const STOPW = new Set(['para', 'como', 'mais', 'pelo', 'pela', 'dos', 'das', 'que', 'com', 'sua', 'seu', 'uma', 'the', 'and']);
  const words = (s) => new Set(String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOPW.has(w)));

  function dedupeSameEvent(list) {
    const out = [];
    for (const x of list) {
      const w = words(x.text || x.title);
      const twin = out.find(o => {
        if (!o.year || !x.year || o.year !== x.year) return false;
        const ow = o._w || (o._w = words(o.text || o.title));
        let inter = 0; for (const t of w) if (ow.has(t)) inter++;
        return inter >= 2 && inter / Math.min(w.size, ow.size) >= 0.6;
      });
      if (!twin) { x._w = w; out.push(x); continue; }
      if ((x.text || '').length > (twin.text || '').length) {
        twin.text = x.text; twin._w = w;
        if (!twin.thumb && x.thumb) twin.thumb = x.thumb;
        if ((x.extract || '').length > (twin.extract || '').length) twin.extract = x.extract;
      }
    }
    return out.map(({ _w, ...rest }) => rest);
  }

  function pick(items, n, filterRe) {
    let arr = (items || []).map(mapItem).filter(x => x.text);
    if (filterRe) arr = arr.filter(x => filterRe.test(hay(x)));
    /* dedupe by title (then text) */
    const seen = new Set();
    arr = arr.filter(x => { const k = (x.title || x.text).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    /* prefer entries with a thumbnail, keep chronological-ish variety */
    const withThumb = arr.filter(x => x.thumb), without = arr.filter(x => !x.thumb);
    return withThumb.concat(without).slice(0, n);
  }

  /* How many items a section carries when nobody says otherwise. This is
     what the browser renders and what the live rebuild produces. The
     GitHub Action asks for a bigger pool (`opts.limit`) because it then
     has data/home/curate-otd.mjs rank that pool down to LIMIT again —
     ranking 15 candidates into 15 slots would not be a selection. */
  const LIMIT = 15;

  /* feeds → the three homepage sections; empty sections fall back to
     the matching section of `fallback` (may be {}). */
  function buildSections(pt, en, fallback, opts) {
    fallback = fallback || {};
    const N = Math.max(1, (opts && opts.limit) || LIMIT);
    const ptAll = pt ? [...(pt.selected || []), ...(pt.events || [])] : [];
    const enAll = en ? [...(en.events || []), ...(en.selected || [])] : [];

    /* 🎂 Nasceram Hoje — relevant people, PT feed first, up to 15 */
    let births = rankBirths(pt ? (pt.births || []) : [], N);
    if (births.length < 6 && en) births = births.concat(rankBirths(en.births || [], N).filter(x => !births.find(o => o.title === x.title))).slice(0, N);
    if (!births.length) births = fallback.births || [];

    /* 🌍 Hoje em Portugal — Portugal-related items across the whole PT feed
       (events + people born/died), so it's not as sparse as an events-only
       filter. text (PT_RE) reliably tags Portuguese people via nationality;
       the extract is matched only against strong proper-noun signals. */
    const ptPool = pt ? [...(pt.selected || []), ...(pt.events || []), ...(pt.births || []), ...(pt.deaths || [])] : [];
    /* Matched on the ENTRY TEXT only. Matching the article extract as well
       was measured on 24/08 to admit two items and zero real ones: the
       1662 Book of Common Prayer and Fernando I of Romania both mention
       Portugal somewhere in their article without being about it. The
       text carries the nationality for people and the place for events,
       which is the whole of what this section is asking. */
    let portugal = dedupeSameEvent(pick(ptPool.filter(x => PT_RE.test(clean(x.text))), N));
    if (!portugal.length) portugal = fallback.portugal || [];
    const ptUsed = new Set(portugal.map(x => x.title));

    /* 📜 Hoje na História — world efemérides in Portuguese (minus Portugal ones) */
    let history = pick(ptAll.filter(x => !PT_RE.test(clean(x.text))), N).filter(x => !ptUsed.has(x.title));
    if (history.length < 6 && en) history = history.concat(pick(enAll, N).filter(x => !history.find(o => o.title === x.title))).slice(0, N);
    if (!history.length) history = fallback.history || [];

    return { births, portugal, history };
  }

  const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  return { buildSections, enrich, sitelinkCounts, clean, cap, MONTHS_PT, LIMIT };
});
