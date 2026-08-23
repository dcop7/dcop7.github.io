/* ══════════════════════════════════════════════════════════════════
   NOTÍCIAS AI (V2) — leitor da curadoria diária.

   Lê APENAS data/news/curated/latest.json, gerado uma vez por dia pela
   Action `news-curate.yml` (data/news/build-curated.mjs). Não há chave
   de API no cliente e o browser nunca fala com a Groq nem com nenhum
   fornecedor de IA — tal como no resto do site, o "backend" é um
   ficheiro JSON commitado.

   Corre em paralelo com #noticias (o agregador RSS cronológico), que
   fica intacto: páginas diferentes, dados diferentes, Actions
   diferentes. Se a curadoria falhar num dia, esta página mostra a
   última boa e diz de quando é; a página antiga nem dá por isso.

   Rota: #noticias-ai            → primeiro tema com histórias
         #noticias-ai/<tema>     → tema específico (sobrevive a refresh)
══════════════════════════════════════════════════════════════════ */
const NoticiasAiPage = (function () {
  'use strict';

  const _lang = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt');
  const _t = (en, pt) => (_lang() === 'en' ? en : pt);
  const SRC = 'data/news/curated/latest.json';

  let _inited = false, _doc = null, _theme = null, _wired = false;

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
  async function load() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(SRC, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } finally { clearTimeout(to); }
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
          ${sources.map((x, i) => {
            const f = favURL(x.site || x.url);
            return `<a class="na-src${i === 0 ? ' na-src--lead' : ''}" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title)}">
              ${f ? `<img src="${esc(f)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
              <span>${esc(x.source)}</span></a>`;
          }).join('')}
        </div>
        ${tags ? `<div class="na-tags">${tags}</div>` : ''}
      </div>
    </article>`;
  }

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
      grid.innerHTML = `<div class="empty-state na-empty">
        <div class="es-ico">🌤️</div>
        <p><strong>${_t('A quiet day for this topic.', 'Um dia calmo neste tema.')}</strong></p>
        <p>${_t('Nothing worth featuring came through the feeds. Rather than fill the space, the editor left it empty.', 'Não passou nada que merecesse destaque. Em vez de encher, o editor deixou vazio.')}</p>
      </div>`;
      return;
    }

    /* Fewer than five is a deliberate outcome, not a loading bug — say so. */
    const note = t.stories.length < 5
      ? `<p class="na-note">${_t(
          `${t.stories.length} ${t.stories.length === 1 ? 'story' : 'stories'} today — the rest of the ${t.candidates} articles were not worth featuring.`,
          `${t.stories.length} ${t.stories.length === 1 ? 'história' : 'histórias'} hoje — os restantes ${t.candidates} artigos não mereciam destaque.`)}</p>`
      : `<p class="na-note">${_t(
          `The 5 strongest of ${t.candidates} articles from the last ${t.windowHours}h.`,
          `As 5 mais fortes de ${t.candidates} artigos das últimas ${t.windowHours}h.`)}</p>`;

    grid.innerHTML = note + t.stories.map(storyCard).join('');
  }

  function goTheme(id) {
    if (!id || id === _theme) return;
    location.hash = '#noticias-ai/' + id;
  }

  /* ── shell ── */
  function shell(view) {
    const themes = _doc.themes || [];
    const total = themes.reduce((s, t) => s + t.stories.length, 0);
    const stale = _doc.date !== new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });

    view.innerHTML = `
      <div class="na-wrap">
        <header class="page-head">
          <span class="ph-ico">${AppIcons.icon('noticiasai', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">${_t('News AI', 'Notícias AI')}</h1>
            <p class="ph-sub">${_t('The day’s news, grouped and ranked by an AI editor — at most 5 stories per topic. Experimental, running alongside the full RSS reader.',
                                   'As notícias do dia, agrupadas e ordenadas por um editor de IA — no máximo 5 histórias por tema. Experimental, a correr ao lado do leitor RSS completo.')}</p>
          </div>
          <div class="ph-actions">
            <a class="btn btn-sm" href="#noticias">${_t('Full RSS reader', 'Leitor RSS completo')} →</a>
          </div>
        </header>

        <div class="na-meta">
          <span class="na-day">🗓️ ${esc(fmtDay(_doc.date))}</span>
          <span class="na-dot">·</span>
          <span>${total} ${_t('stories', 'histórias')} ${_t('in', 'em')} ${themes.length} ${_t('topics', 'temas')}</span>
          ${stale ? `<span class="na-stale" title="${_t('The daily job has not run yet today', 'A tarefa diária ainda não correu hoje')}">${_t('previous edition', 'edição anterior')}</span>` : ''}
        </div>

        <div class="na-themes seg" id="na-themes" role="tablist" aria-label="${_t('Topics', 'Temas')}">
          ${themes.map(t => `<button class="na-theme seg-btn" role="tab" data-theme="${esc(t.id)}" aria-selected="false">
              <span aria-hidden="true">${t.icon}</span> ${esc(themeLabel(t))}
              <span class="na-theme-c">${t.stories.length}</span>
            </button>`).join('')}
        </div>

        <div class="na-grid" id="na-grid"></div>

        <footer class="na-foot">
          <p><strong>${_t('How this is made', 'Como isto é feito')}</strong> —
          ${_t('The same RSS feeds as the main News page are collected first; once a day an AI editor groups articles covering the same event, ranks them and writes the summaries. The score is the AI’s own estimate of importance — an opinion. The source count is measured. Headlines link to the original publishers.',
               'São recolhidos os mesmos feeds RSS da página Notícias; uma vez por dia um editor de IA agrupa os artigos sobre o mesmo acontecimento, ordena-os e escreve os resumos. A pontuação é a estimativa de importância da própria IA — uma opinião. O número de fontes é medido. Os títulos ligam aos editores originais.')}</p>
        </footer>
      </div>`;

    if (!_wired) {
      view.addEventListener('click', (e) => {
        const b = e.target.closest('.na-theme');
        if (b) goTheme(b.dataset.theme);
      });
      _wired = true;
    }
  }

  function emptyShell(view, msg) {
    view.innerHTML = `<div class="na-wrap">
      <header class="page-head">
        <span class="ph-ico">${AppIcons.icon('noticiasai', 22)}</span>
        <div class="ph-titles">
          <h1 class="ph-title">${_t('News AI', 'Notícias AI')}</h1>
          <p class="ph-sub">${_t('AI-curated daily edition (experimental).', 'Edição diária curada por IA (experimental).')}</p>
        </div>
        <div class="ph-actions"><a class="btn btn-sm" href="#noticias">${_t('Full RSS reader', 'Leitor RSS completo')} →</a></div>
      </header>
      <div class="empty-state na-empty"><div class="es-ico">📭</div><p>${msg}</p></div>
    </div>`;
  }

  /* ── public ── */
  const valid = (id) => !!(id && _doc && (_doc.themes || []).some(t => t.id === id));

  async function show(sub) {
    const view = document.getElementById('view-noticias-ai');
    if (!view) return;

    if (_inited) {
      if (valid(sub) && sub !== _theme) { _theme = sub; renderTheme(); }
      return;
    }

    view.innerHTML = `<div class="na-wrap"><div class="na-loading"><span class="na-spin"></span> ${_t('Loading the edition…', 'A carregar a edição…')}</div></div>`;
    try {
      _doc = await load();
      if (!_doc || !Array.isArray(_doc.themes) || !_doc.themes.length) throw new Error('empty');
      /* Default to the first theme that actually has something to show. */
      const withStories = _doc.themes.filter(t => t.stories && t.stories.length);
      _theme = valid(sub) ? sub : ((withStories[0] || _doc.themes[0]).id);
      shell(view);
      renderTheme();
      _inited = true;
    } catch (e) {
      emptyShell(view, _t(
        'The curated edition has not been generated yet. It is produced once a day by a GitHub Action — check back shortly, or use the full RSS reader.',
        'A edição curada ainda não foi gerada. É produzida uma vez por dia por uma GitHub Action — volta daqui a pouco, ou usa o leitor RSS completo.'));
    }
  }

  return { show };
})();
