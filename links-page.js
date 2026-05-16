const LinksPage = (function () {
  'use strict';

  let _currentCat = null;
  const lang = () => typeof I18n !== 'undefined' ? I18n.getLang() : 'pt';
  const t    = (k, vars) => typeof I18n !== 'undefined' ? I18n.t(k, vars) : k;

  function catName(c)  { return lang() === 'en' && c.cat_en ? c.cat_en : c.cat; }
  function linkDesc(l) { return lang() === 'en' && l.desc_en ? l.desc_en : l.desc; }

  function renderCatList(currentId) {
    const el = document.getElementById('lp-cat-list');
    if (!el || typeof LINKS_DATA === 'undefined') return;

    el.innerHTML = `
      <button class="lp-cat-item${!currentId ? ' active' : ''}" data-cat="">
        <span class="lp-cat-icon">✨</span>
        <span class="lp-cat-label">${t('lp.all')}</span>
      </button>
      ${LINKS_DATA.map(c => `
        <button class="lp-cat-item${currentId === c.id ? ' active' : ''}" data-cat="${c.id}">
          <span class="lp-cat-icon">${c.icon}</span>
          <span class="lp-cat-label">${catName(c)}</span>
          <span class="lp-cat-count">${c.links.length}</span>
        </button>`).join('')}`;

    el.onclick = e => {
      const btn = e.target.closest('.lp-cat-item');
      if (!btn) return;
      Nav.go(btn.dataset.cat ? 'links/' + btn.dataset.cat : 'links');
    };
  }

  function show(catId) {
    _currentCat = catId || null;
    renderCatList(catId);
    const content = document.getElementById('lp-content');
    if (!content || typeof LINKS_DATA === 'undefined') return;

    if (!catId) {
      renderOverview(content);
    } else {
      const cat = LINKS_DATA.find(c => c.id === catId);
      if (!cat) return;
      renderCategory(content, cat);
    }
  }

  function renderOverview(el) {
    const total = LINKS_DATA.reduce((s, c) => s + c.links.length, 0);
    el.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">${t('lp.title')}</h1>
        <p class="page-subtitle">${t('lp.count', { n: total, m: LINKS_DATA.length })}</p>
      </div>
      <div class="lp-overview-grid">
        ${LINKS_DATA.map(c => `
          <button class="lp-overview-card" data-cat="${c.id}">
            <div class="lp-ov-icon">${c.icon}</div>
            <div class="lp-ov-name">${catName(c)}</div>
            <div class="lp-ov-count">${c.links.length} sites</div>
          </button>`).join('')}
      </div>`;

    el.querySelectorAll('.lp-overview-card').forEach(btn => {
      btn.addEventListener('click', () => Nav.go('links/' + btn.dataset.cat));
    });
  }

  function renderCategory(el, cat) {
    el.innerHTML = `
      <div class="page-header">
        <div class="lp-cat-title-row">
          <span class="lp-cat-title-icon">${cat.icon}</span>
          <div>
            <h1 class="page-title">${catName(cat)}</h1>
            <p class="page-subtitle">${cat.links.length} sites</p>
          </div>
        </div>
      </div>
      <div class="lp-links-list">
        ${cat.links.map(link => linkCard(link)).join('')}
      </div>`;
  }

  function linkCard(link) {
    const isReal = link.url && link.url !== '#';
    let domain = '';
    if (isReal) {
      try { domain = new URL(link.url).hostname.replace('www.', ''); } catch {}
    }
    const tagsHTML = (link.tags || []).slice(0, 4).map(tg =>
      `<span class="lp-tag">${tg}</span>`).join('');

    return `
      <a class="lp-link-card${isReal ? '' : ' lp-link-soon'}"
         href="${isReal ? link.url : 'javascript:void(0)'}"
         ${isReal ? 'target="_blank" rel="noopener"' : ''}>
        <div class="lp-link-favicon">
          ${domain
            ? `<img src="https://www.google.com/s2/favicons?sz=32&domain=${domain}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="lp-link-favicon-ph"${domain ? ' style="display:none"' : ''}>🌐</div>
        </div>
        <div class="lp-link-body">
          <div class="lp-link-name">${link.name}</div>
          <div class="lp-link-desc">${linkDesc(link)}</div>
          ${tagsHTML ? `<div class="lp-link-tags">${tagsHTML}</div>` : ''}
        </div>
        <div class="lp-link-cta">
          ${isReal
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
            : `<span class="lp-soon">em breve</span>`}
        </div>
      </a>`;
  }

  document.addEventListener('langchange', () => {
    if (document.getElementById('view-links')?.classList.contains('active')) {
      show(_currentCat);
    }
  });

  return { show };
})();
