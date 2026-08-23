/* ══════════════════════════════════════════════════════════════════
   NOTÍCIAS ▸ DESTAQUES — a edição do dia.

   Uma das duas vistas da secção Notícias:
     Destaques  (esta)  o que vale a pena ler, agrupado e ordenado
     Todas      #noticias/todas  o leitor RSS completo, cronológico

   Lê APENAS data/news/curated/latest.json, gerado uma vez por dia pela
   Action `news-curate.yml` (data/news/build-curated.mjs). O browser não
   fala com nenhum fornecedor de IA e não existe chave no cliente — como
   no resto do site, o "backend" é um ficheiro JSON commitado.

   O leitor completo é independente: dados diferentes, Action diferente,
   módulo diferente. Se a curadoria falhar num dia, esta vista mostra a
   última boa e diz de quando é; a vista Todas nem dá por isso.

   Rota: #noticias                    → Destaques (predefinição)
         #noticias/destaques          → idem
         #noticias/destaques/<tema>   → tema específico (sobrevive a refresh)
══════════════════════════════════════════════════════════════════ */
const DestaquesPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const BASE = 'data/news/curated/';

  /* Same three densities the RSS reader offers, so moving between the two
     pages does not mean relearning the controls. */
  const VIEW_MODES = [
    ['cards',   '▦', 'Cards',        'Cartões'],
    ['list',    '▤', 'List',         'Lista'],
    ['compact', '≣', 'Compact list', 'Lista compacta'],
  ];

  const _ls = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };

  let _inited = false, _doc = null, _theme = null, _wired = false;
  let _index = null, _day = '';           /* '' = the latest edition */
  let _mode = _ls('na-mode', 'cards');
  if (!VIEW_MODES.some(m => m[0] === _mode)) _mode = 'cards';

  /* ── helpers ── */
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function relTime(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return _t('just now', 'agora mesmo');
    const m = s / 60; if (m < 60) return _t(`${m | 0} min ago`, `há ${m | 0} min`);
    const h = m / 60; if (h < 24) return _t(`${h | 0}h ago`, `há ${h | 0}h`);
    const d = h / 24; if (d < 7) return _t(`${d | 0}d ago`, `há ${d | 0} dias`);
    return new Date(ts).toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { day: '2-digit', month: 'short' });
  }
  function fmtDay(iso) {
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    const s = d.toLocaleDateString(_lang() === 'en' ? 'en-GB' : 'pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    /* Sentence case, not title case: pt-PT writes "domingo, 23 de agosto",
       so a CSS `capitalize` would give "Domingo, 23 De Agosto". */
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function favURL(site) { try { const h = new URL(site).host; return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64` : ''; } catch { return ''; } }
  const themeLabel = (t) => (_lang() === 'en' ? (t.en || t.pt) : t.pt);

  /* As duas vistas da secção. Duplicado (em vez de partilhado) no leitor
     RSS: são cinco linhas e mantém os dois módulos independentes, que é
     a propriedade que faz a curadoria poder falhar sem afetar o resto. */
  function tabsHTML(active) {
    const tabs = [
      ['destaques', '⭐', 'Highlights', 'Destaques', '#noticias/destaques'],
      ['todas',     '🗞️', 'All',        'Todas',     '#noticias/todas'],
    ];
    return `<nav class="nw-tabs" aria-label="${_t('News views', 'Vistas das notícias')}">
      ${tabs.map(([id, ic, en, pt, href]) => `<a class="nw-tab${id === active ? ' active' : ''}" href="${href}"${id === active ? ' aria-current="page"' : ''}><span aria-hidden="true">${ic}</span> ${_t(en, pt)}</a>`).join('')}
    </nav>`;
  }

  /* The score is a model's judgement, not a measurement. The UI must
     never let it read as an objective ranking, so it is labelled, given
     a qualitative band, and kept visually separate from `sourceCount`,
     which IS measured. */
  function scoreBand(n) {
    if (n >= 80) return { cls: 'hi', pt: 'Muito relevante', en: 'Highly relevant' };
    if (n >= 60) return { cls: 'mid', pt: 'Relevante', en: 'Relevant' };
    return { cls: 'lo', pt: 'Contexto', en: 'Context' };
  }

  /* ── data ── */
  async function getJSON(url) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(to); }
  }
  const load = (day) => getJSON(day ? `${BASE}d/${day}.json` : `${BASE}latest.json`);

  /* The archive listing. Optional: without it the page still works and
     simply offers no other day — which is exactly the state on day one,
     when only today's edition exists. */
  async function loadIndex() {
    try { _index = await getJSON(BASE + 'index.json'); } catch { _index = null; }
    return _index;
  }
  function archiveDays() {
    const days = (_index && Array.isArray(_index.days)) ? _index.days.slice() : [];
    if (_doc && _doc.date) days.push(_doc.date);
    return [...new Set(days)].sort().reverse();
  }

  /* One chip per publisher, not per article. A publisher legitimately
     runs several pieces on one event (RTP filed five separate stories on
     the same medal haul), and rendering one chip each printed
     "RTP · RTP · RTP · RTP · RTP", which reads as a bug. Collapse to the
     newest article per publisher and show ×N when there are more. */
  function byPublisher(sources) {
    const map = new Map();
    for (const x of sources) {
      const k = x.source || x.url;
      const cur = map.get(k);
      if (!cur) map.set(k, { ...x, count: 1 });
      else { cur.count++; if (x.ts > cur.ts) { cur.url = x.url; cur.title = x.title; cur.ts = x.ts; } }
    }
    return [...map.values()];
  }

  /* ── render: one story ── */
  function storyCard(s) {
    const band = scoreBand(s.score);
    const sources = (s.sources || []);
    const lead = sources[0] || {};

    /* The thumbnail links to the same article as the headline; keep it
       out of the tab order so a card costs one tab stop, not three. */
    const thumb = s.image
      ? `<a class="na-thumb" href="${esc(lead.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="${esc(s.image)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.na-thumb').remove()"></a>`
      : '';

    const tags = (s.tags || []).filter(t => t && t !== 'mock')
      .map(t => `<span class="na-tag">#${esc(t)}</span>`).join('');

    /* sourceCount is measured; say so plainly. */
    const coverage = s.sourceCount > 1
      ? `<span class="na-cov" title="${_t('Measured: distinct feeds covering this story', 'Medido: fontes distintas que cobriram esta história')}">📡 ${s.sourceCount} ${_t('sources', 'fontes')}</span>`
      : `<span class="na-cov na-cov--one" title="${_t('Measured: only one feed covered this', 'Medido: só uma fonte cobriu isto')}">📡 1 ${_t('source', 'fonte')}</span>`;

    return `<article class="na-card">
      <div class="na-rank" aria-hidden="true">${s.rank}</div>
      ${thumb}
      <div class="na-body">
        <div class="na-top">
          ${coverage}
          <span class="na-score na-score--${band.cls}" title="${_t('Editorial importance estimated by the AI — an opinion, not a measurement', 'Importância editorial estimada pela IA — uma opinião, não uma medição')}">
            <span class="na-score-n">${s.score}</span><span class="na-score-l">${_t(band.en, band.pt)}</span>
          </span>
          <span class="na-time">${esc(relTime(s.ts))}</span>
        </div>

        <h3 class="na-title"><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></h3>
        ${s.summary ? `<p class="na-sum">${esc(s.summary)}</p>` : ''}
        ${s.why ? `<p class="na-why"><span class="na-why-l">${_t('Why it matters', 'Porque importa')}</span> ${esc(s.why)}</p>` : ''}

        <div class="na-srcs">
          ${byPublisher(sources).map((p, i) => {
            const f = favURL(p.site || p.url);
            const n = p.count > 1 ? `<span class="na-src-n" title="${_t(`${p.count} articles from this publisher`, `${p.count} artigos deste editor`)}">×${p.count}</span>` : '';
            return `<a class="na-src${i === 0 ? ' na-src--lead' : ''}" href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.title)}">
              ${f ? `<img src="${esc(f)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
              <span>${esc(p.source)}</span>${n}</a>`;
          }).join('')}
        </div>
        ${tags ? `<div class="na-tags">${tags}</div>` : ''}
      </div>
    </article>`;
  }

  /* Denser renderings of the same story. They drop the image and the
     "why" line first, because those are the parts a reader scanning a
     list is not reading — but the rank, the score and the measured
     source count survive every mode, since they are the whole point. */
  function storyRow(s) {
    const band = scoreBand(s.score);
    const pubs = byPublisher(s.sources);
    const lead = s.sources[0] || {};
    const thumb = s.image
      ? `<img class="na-r-img" src="${esc(s.image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
      : '';
    return `<article class="na-row">
      <span class="na-rank na-rank--sm" aria-hidden="true">${s.rank}</span>
      ${thumb}
      <div class="na-r-body">
        <a class="na-r-title" href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
        ${s.summary ? `<p class="na-r-sum">${esc(s.summary)}</p>` : ''}
        <div class="na-r-meta">
          <span class="na-score na-score--${band.cls}" title="${_t('AI estimate of importance — an opinion', 'Estimativa de importância da IA — uma opinião')}"><span class="na-score-n">${s.score}</span><span class="na-score-l">${_t(band.en, band.pt)}</span></span>
          <span class="na-cov${s.sourceCount > 1 ? '' : ' na-cov--one'}" title="${_t('Measured: distinct feeds', 'Medido: fontes distintas')}">📡 ${s.sourceCount}</span>
          ${pubs.slice(0, 3).map(p => `<a class="na-src" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.source)}${p.count > 1 ? `<span class="na-src-n">×${p.count}</span>` : ''}</a>`).join('')}
          <span class="na-time">${esc(relTime(s.ts))}</span>
        </div>
      </div>
    </article>`;
  }

  function storyCompact(s) {
    const band = scoreBand(s.score);
    const lead = s.sources[0] || {};
    return `<a class="na-cmp" href="${esc(lead.url)}" target="_blank" rel="noopener">
      <span class="na-rank na-rank--sm" aria-hidden="true">${s.rank}</span>
      <span class="na-cmp-score na-score--${band.cls}" title="${_t('AI estimate of importance', 'Estimativa de importância da IA')}">${s.score}</span>
      <span class="na-cmp-title">${esc(s.title)}</span>
      <span class="na-cmp-src">${esc(lead.source)}${s.sourceCount > 1 ? ` +${s.sourceCount - 1}` : ''}</span>
      <span class="na-time">${esc(relTime(s.ts))}</span>
    </a>`;
  }

  const renderer = () => (_mode === 'compact' ? storyCompact : _mode === 'list' ? storyRow : storyCard);

  /* ── render: theme ── */
  function renderTheme() {
    const grid = document.getElementById('na-grid');
    const t = (_doc.themes || []).find(x => x.id === _theme);
    if (!grid || !t) return;

    let activeBtn = null;
    document.querySelectorAll('#na-themes .na-theme').forEach(b => {
      const on = b.dataset.theme === _theme;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      if (on) activeBtn = b;
    });
    /* Under 700px the shared .seg turns into a horizontal scroll strip, so
       the selected theme can sit off-screen after a hash change. Pull it
       into view without scrolling the page itself. */
    if (activeBtn) {
      const strip = document.getElementById('na-themes');
      if (strip && strip.scrollWidth > strip.clientWidth + 4) {
        strip.scrollTo({ left: Math.max(0, activeBtn.offsetLeft - 16), behavior: 'smooth' });
      }
    }

    if (!t.stories.length) {
      const nEl = document.getElementById('na-note');
      if (nEl) { nEl.textContent = ''; nEl.hidden = true; }   /* don't leave the previous theme's note above an empty list */
      grid.className = 'na-grid';
      grid.innerHTML = `<div class="empty-state na-empty">
        <div class="es-ico">🌤️</div>
        <p><strong>${_t('A quiet day for this topic.', 'Um dia calmo neste tema.')}</strong></p>
        <p>${_t('Nothing worth featuring came through the feeds. Rather than fill the space, the editor left it empty.', 'Não passou nada que merecesse destaque. Em vez de encher, o editor deixou vazio.')}</p>
      </div>`;
      return;
    }

    /* A short list is a deliberate outcome, not a loading bug — say so.
       The ceiling is read from the data rather than hard-coded, so raising
       it in the build script does not leave this line lying. The note has
       its own element outside the grid, so the compact mode's bordered
       list does not swallow it. */
    const cap = Number(_doc.maxStories) || 12;
    const n = t.stories.length;
    const when = _day ? _t('in this edition', 'nesta edição') : _t('today', 'hoje');
    const note = n < cap
      ? _t(`${n} ${n === 1 ? 'story' : 'stories'} ${when} — of ${t.candidates} articles, the rest were not worth featuring.`,
           `${n} ${n === 1 ? 'história' : 'histórias'} ${when} — dos ${t.candidates} artigos, os restantes não mereciam destaque.`)
      : _t(`The ${n} strongest of ${t.candidates} articles from the last ${t.windowHours}h.`,
           `As ${n} mais fortes de ${t.candidates} artigos das últimas ${t.windowHours}h.`);

    const noteEl = document.getElementById('na-note');
    if (noteEl) { noteEl.textContent = note; noteEl.hidden = false; }
    grid.className = 'na-grid na-grid--' + _mode;
    grid.innerHTML = t.stories.map(renderer()).join('');
  }

  function goTheme(id) {
    if (!id || id === _theme) return;
    location.hash = '#noticias/destaques/' + id;
  }

  function setMode(m) {
    if (!m || m === _mode || !VIEW_MODES.some(x => x[0] === m)) return;
    _mode = m;
    try { localStorage.setItem('na-mode', m); } catch {}
    document.querySelectorAll('#na-view .na-view-b').forEach(b => {
      const on = b.dataset.mode === m;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderTheme();
  }

  /* Switching edition reloads that day's file and keeps the current
     theme when it exists there — a theme can be absent on a quiet day. */
  async function goDay(date) {
    const isLatest = _index && date === _index.latest;
    const want = isLatest ? '' : date;
    if (want === _day) return;
    const grid = document.getElementById('na-grid');
    if (grid) grid.innerHTML = `<div class="na-loading"><span class="na-spin"></span> ${_t('Loading…', 'A carregar…')}</div>`;
    try {
      const doc = await load(want);
      if (!doc || !Array.isArray(doc.themes) || !doc.themes.length) throw new Error('empty');
      _doc = doc; _day = want;
      const still = doc.themes.find(t => t.id === _theme && t.stories.length);
      _theme = (still || doc.themes.find(t => t.stories.length) || doc.themes[0]).id;
      shell(document.getElementById('view-destaques'));
      renderTheme();
    } catch (e) {
      if (grid) grid.innerHTML = `<div class="empty-state na-empty"><div class="es-ico">📭</div><p>${
        _t('That edition could not be loaded.', 'Não foi possível carregar essa edição.')}</p></div>`;
    }
  }

  /* ── shell ── */
  function shell(view) {
    const themes = _doc.themes || [];
    const total = themes.reduce((s, t) => s + t.stories.length, 0);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });
    /* Only flag staleness on the live edition — an archived day is
       *supposed* to be old, and labelling it "previous edition" there
       would be noise. */
    const stale = !_day && _doc.date !== today;
    const days = archiveDays();

    view.innerHTML = `
      <div class="na-wrap">
        <header class="page-head">
          <span class="ph-ico">${AppIcons.icon('noticias', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">${_t('News', 'Notícias')}</h1>
            <p class="ph-sub">${_t('What is worth reading today: articles covering the same event grouped into one story, ordered by editorial importance.',
                                   'O que vale a pena ler hoje: artigos sobre o mesmo acontecimento agrupados numa história, por importância editorial.')}</p>
          </div>
        </header>
        ${tabsHTML('destaques')}

        <div class="na-meta">
          ${days.length > 1
            ? `<label class="na-daysel"><span class="na-daysel-l">🗓️ ${_t('Edition', 'Edição')}</span>
                 <select id="na-day" class="na-sel" aria-label="${_t('Choose an edition', 'Escolher edição')}">
                   ${days.map(d => `<option value="${esc(d)}"${d === _doc.date ? ' selected' : ''}>${esc(fmtDay(d))}</option>`).join('')}
                 </select></label>`
            : `<span class="na-day">🗓️ ${esc(fmtDay(_doc.date))}</span>`}
          <span class="na-dot">·</span>
          <span>${total} ${_t('stories', 'histórias')} ${_t('in', 'em')} ${themes.length} ${_t('topics', 'temas')}</span>
          ${stale ? `<span class="na-stale" title="${_t('The daily job has not run yet today', 'A tarefa diária ainda não correu hoje')}">${_t('previous edition', 'edição anterior')}</span>` : ''}
          ${days.length === 1 ? `<span class="na-onlyday" title="${_t('The archive starts on the first run; earlier days do not exist yet', 'O arquivo começa na primeira corrida; dias anteriores ainda não existem')}">${_t('only edition so far', 'única edição por agora')}</span>` : ''}
          <div class="na-view seg" id="na-view" role="group" aria-label="${_t('View mode', 'Modo de visualização')}">
            ${VIEW_MODES.map(([id, ic, en, pt]) => `<button class="na-view-b${id === _mode ? ' active' : ''}" data-mode="${id}" title="${_t(en, pt)}" aria-label="${_t(en, pt)}" aria-pressed="${id === _mode}">${ic}</button>`).join('')}
          </div>
        </div>

        <div class="na-themes seg" id="na-themes" role="tablist" aria-label="${_t('Topics', 'Temas')}">
          ${themes.map(t => `<button class="na-theme seg-btn" role="tab" data-theme="${esc(t.id)}" aria-selected="false">
              <span aria-hidden="true">${t.icon}</span> ${esc(themeLabel(t))}
              <span class="na-theme-c">${t.stories.length}</span>
            </button>`).join('')}
        </div>

        <p class="na-note" id="na-note"></p>
        <div class="na-grid" id="na-grid"></div>

        <footer class="na-foot">
          <p><strong>${_t('How this is made', 'Como isto é feito')}</strong> —
          ${_t('Once a day the articles collected from the same sources as the All view are grouped by event, ordered and summarised automatically. Summaries are generated from the source material — nothing is written from scratch, and every headline links to the publisher that reported it. The score is an estimate of importance; the source count is measured.',
               'Uma vez por dia, os artigos recolhidos das mesmas fontes da vista Todas são agrupados por acontecimento, ordenados e resumidos automaticamente. Os resumos são gerados a partir do material das fontes — nada é escrito de raiz, e cada título liga ao editor que o publicou. A pontuação é uma estimativa de importância; o número de fontes é medido.')}</p>
        </footer>
      </div>`;

    if (!_wired) {
      view.addEventListener('click', (e) => {
        const t = e.target.closest('.na-theme');
        if (t) { goTheme(t.dataset.theme); return; }
        const v = e.target.closest('.na-view-b');
        if (v) setMode(v.dataset.mode);
      });
      view.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'na-day') goDay(e.target.value);
      });
      _wired = true;
    }
  }

  function emptyShell(view, msg) {
    view.innerHTML = `<div class="na-wrap">
      <header class="page-head">
        <span class="ph-ico">${AppIcons.icon('noticias', 22)}</span>
        <div class="ph-titles">
          <h1 class="ph-title">${_t('News', 'Notícias')}</h1>
          <p class="ph-sub">${_t('The day’s selection.', 'A seleção do dia.')}</p>
        </div>
      </header>
      ${tabsHTML('destaques')}
      <div class="empty-state na-empty"><div class="es-ico">📭</div><p>${msg}</p></div>
    </div>`;
  }

  /* ── public ── */
  const valid = (id) => !!(id && _doc && (_doc.themes || []).some(t => t.id === id));

  async function show(sub) {
    const view = document.getElementById('view-destaques');
    if (!view) return;

    if (_inited) {
      if (valid(sub) && sub !== _theme) { _theme = sub; renderTheme(); }
      return;
    }

    view.innerHTML = `<div class="na-wrap"><div class="na-loading"><span class="na-spin"></span> ${_t('Loading the edition…', 'A carregar a edição…')}</div></div>`;
    try {
      const [doc] = await Promise.all([load(), loadIndex()]);
      _doc = doc;
      if (!_doc || !Array.isArray(_doc.themes) || !_doc.themes.length) throw new Error('empty');
      /* Default to the first theme that actually has something to show. */
      const withStories = _doc.themes.filter(t => t.stories && t.stories.length);
      _theme = valid(sub) ? sub : ((withStories[0] || _doc.themes[0]).id);
      shell(view);
      renderTheme();
      _inited = true;
    } catch (e) {
      emptyShell(view, _t(
        'Today’s selection has not been generated yet. It is produced once a day — check back shortly, or open All for the full feed.',
        'A seleção de hoje ainda não foi gerada. É produzida uma vez por dia — volta daqui a pouco, ou abre Todas para o feed completo.'));
    }
  }

  return { show };
})();
