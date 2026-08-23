/* ══════════════════════════════════════════════════════════════════
   themes.mjs — editorial themes for Notícias AI (V2).

   The RSS pipeline (build-news.mjs) classifies by SOURCE: every article
   inherits exactly one topic from its feed (`KW = []`, so there is no
   keyword cross-tagging). Those 17 raw topics are a map of *feeds*, not
   a map of *subjects*, so the curator consolidates them into 13
   editorial themes before asking the model anything.

   Two consolidation decisions, both from the feasibility report:

   • `carros` + `f1` → `automovel`. F1 yields ~20 articles/day and the
     site already has a dedicated Fórmula 1 section; as a standalone
     curated theme it would be padding.
   • `tldr`, `trailers` and `factcheck` are NOT curated. They are
     formats (a newsletter, a video feed, a genre), not subjects —
     ranking "the 5 most important fact-checks" is not a meaningful
     editorial act, and the existing Notícias page already serves them
     well as plain chronological lists.

   `mode` changes what the model is asked to do, because measurement
   showed the job is genuinely different per theme:

   • coverage  — several feeds report the same event (Portugal, Mundo,
                 Economia, Automóvel). Grouping is the main win.
   • discovery — each feed publishes distinct pieces (Tecnologia, IA,
                 Android…). Cross-source duplicates are near zero;
                 the win is picking 5 out of ~120 and saying why.
══════════════════════════════════════════════════════════════════ */

export const THEMES = [
  { id: 'portugal',      icon: '🇵🇹', pt: 'Portugal',        en: 'Portugal',        from: ['geral'],          mode: 'coverage'  },
  { id: 'mundo',         icon: '🌍', pt: 'Mundo',           en: 'World',           from: ['mundo'],          mode: 'coverage'  },
  { id: 'tecnologia',    icon: '💻', pt: 'Tecnologia',      en: 'Technology',      from: ['tecnologia'],     mode: 'discovery' },
  { id: 'ia',            icon: '🧠', pt: 'IA',              en: 'AI',              from: ['ia'],             mode: 'discovery' },
  { id: 'seguranca',     icon: '🔒', pt: 'Segurança',       en: 'Security',        from: ['seguranca'],      mode: 'discovery' },
  { id: 'devops',        icon: '🧩', pt: 'DevOps & Cloud',  en: 'DevOps & Cloud',  from: ['devops'],         mode: 'discovery' },
  { id: 'android',       icon: '📱', pt: 'Android & Móvel', en: 'Android & Mobile', from: ['android'],       mode: 'discovery' },
  { id: 'produtividade', icon: '🧰', pt: 'Produtividade',   en: 'Productivity',    from: ['produtividade'],  mode: 'discovery' },
  { id: 'ciencia',       icon: '🔬', pt: 'Ciência',         en: 'Science',         from: ['ciencia'],        mode: 'discovery' },
  { id: 'economia',      icon: '💶', pt: 'Economia',        en: 'Economy',         from: ['economia'],       mode: 'coverage'  },
  { id: 'automovel',     icon: '🚗', pt: 'Automóvel',       en: 'Automotive',      from: ['carros', 'f1'],   mode: 'coverage'  },
  { id: 'gaming',        icon: '🎮', pt: 'Gaming',          en: 'Gaming',          from: ['gaming'],         mode: 'discovery' },
  { id: 'filmes',        icon: '🎬', pt: 'Filmes & TV',     en: 'Film & TV',       from: ['filmes'],         mode: 'discovery' },
];

/* Raw topics deliberately left out of curation (see header). */
export const NOT_CURATED = ['tldr', 'trailers', 'factcheck'];
