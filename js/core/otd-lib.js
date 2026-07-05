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
  /* stronger Portugal signal for matching free-text extracts (proper nouns only —
     excludes the bare "português/portuguesa" that also tags the language / Brazil). */
  const PT_STRONG = /\bportugal\b|lisboa|coimbra|a[çc]ores|madeira|alentejo|algarve|sal[aá]zar|rep[úu]blica portuguesa|reino de portugal|rei de portugal|rainha de portugal|descobrimentos portugu|vasco da gama|cam[õo]es|d\. afonso|d\. jo[ãa]o|d\. manuel|d\. sebasti[ãa]o/i;
  /* births: relevant fields (sci/tech/arts/letters/sport/history) vs pop-only */
  const B_GOOD = /\b(cientista|f[íi]sic|qu[íi]mic|bi[óo]log|matem[áa]tic|engenheir|inventor|astr[óo]nom|astronauta|programador|inform[áa]tic|escritor|escritora|autor|poeta|poetisa|romancista|dramaturg|fil[óo]sof|pintor|pintora|escultor|arquitet|compositor|maestro|economista|m[ée]dic|cirurgi[ãa]|explorador|navegador|nobel|estadista|pioneir|fundador|rei\b|rainha|imperador|monarca|hist[oó]ria|scientist|physicist|inventor|engineer|mathematician|astronomer|writer|poet|painter|composer|philosopher|architect|explorer|nobel)\b/i;
  const B_SPORT = /\b(futebolista|t[ée]nista|ol[íi]mpic|atleta|ciclista|nadador|automobilismo|f[óo]rmula 1|basquetebol|andebol|footballer|olympic athlete)\b/i;
  const B_POP = /\b(cantor|cantora|ator\b|atriz|apresentador|youtuber|influen|\brapper\b|\bdj\b|\bmodelo\b|reality|celebridade|tiktok|actor|actress|singer|rapper|tv personality|youtube)\b/i;

  function rankBirths(births, n) {
    return births
      .map(mapItem)
      .filter(b => b.title)
      .map(b => {
        const h = hay(b), good = B_GOOD.test(h), sport = B_SPORT.test(h), pop = B_POP.test(h);
        if (pop && !good) return null;                      /* drop pop-only celebs */
        if (!good && !sport && !b.thumb) return null;        /* drop the truly obscure */
        let s = 0;
        if (b.year) s += Math.max(0, (2010 - b.year)) / 8;   /* historical figures preferred */
        if (good) s += 35; if (sport) s += 14;
        if (b.thumb) s += 18;
        s += Math.min(40, (b.extract || '').length / 4);     /* longer article ≈ more notable */
        return { ...b, _s: s };
      })
      .filter(Boolean)
      .sort((a, b) => b._s - a._s)
      .slice(0, n)
      .map(({ _s, ...b }) => b);
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

  /* feeds → the three homepage sections; empty sections fall back to
     the matching section of `fallback` (may be {}). */
  function buildSections(pt, en, fallback) {
    fallback = fallback || {};
    const ptAll = pt ? [...(pt.selected || []), ...(pt.events || [])] : [];
    const enAll = en ? [...(en.events || []), ...(en.selected || [])] : [];

    /* 🎂 Nasceram Hoje — relevant people, PT feed first, up to 15 */
    let births = rankBirths(pt ? (pt.births || []) : [], 15);
    if (births.length < 6 && en) births = births.concat(rankBirths(en.births || [], 15).filter(x => !births.find(o => o.title === x.title))).slice(0, 15);
    if (!births.length) births = fallback.births || [];

    /* 🌍 Hoje em Portugal — Portugal-related items across the whole PT feed
       (events + people born/died), so it's not as sparse as an events-only
       filter. text (PT_RE) reliably tags Portuguese people via nationality;
       the extract is matched only against strong proper-noun signals. */
    const ptPool = pt ? [...(pt.selected || []), ...(pt.events || []), ...(pt.births || []), ...(pt.deaths || [])] : [];
    const ptExtract = x => clean((x.pages && x.pages[0] && x.pages[0].extract) || '');
    let portugal = pick(ptPool.filter(x => PT_RE.test(clean(x.text)) || PT_STRONG.test(ptExtract(x))), 15);
    if (!portugal.length) portugal = fallback.portugal || [];
    const ptUsed = new Set(portugal.map(x => x.title));

    /* 📜 Hoje na História — world efemérides in Portuguese (minus Portugal ones) */
    let history = pick(ptAll.filter(x => !PT_RE.test(clean(x.text))), 15).filter(x => !ptUsed.has(x.title));
    if (history.length < 6 && en) history = history.concat(pick(enAll, 15).filter(x => !history.find(o => o.title === x.title))).slice(0, 15);
    if (!history.length) history = fallback.history || [];

    return { births, portugal, history };
  }

  const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  return { buildSections, clean, cap, MONTHS_PT };
});
