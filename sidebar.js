const Sidebar = (function () {
  'use strict';

  function init() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    renderLinks(sidebar);
    initMobileToggle();
    setHeaderVar();
    window.addEventListener('resize', setHeaderVar);
  }

  function setHeaderVar() {
    const h = document.getElementById('site-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
  }

  function renderLinks(sidebar) {
    const linksSection = sidebar.querySelector('#sb-links-section');
    if (!linksSection || typeof LINKS_DATA === 'undefined') return;

    linksSection.innerHTML = LINKS_DATA.map(cat => `
      <details class="sb-cat">
        <summary class="sb-cat-hdr">${cat.icon} ${cat.cat}</summary>
        <div class="sb-cat-links">
          ${cat.links.map(link => `
            <a class="sb-link" href="${link.url}" target="_blank" rel="noopener"
               data-tags="${(link.tags || []).join(',')}"
               title="${link.desc}">
              <span class="sb-link-name">${link.name}</span>
              <span class="sb-link-desc">${link.desc}</span>
            </a>`).join('')}
        </div>
      </details>`).join('');
  }

  function initMobileToggle() {
    const toggle = document.getElementById('sb-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !overlay || !sidebar) return;

    toggle.addEventListener('click', () => openSidebar());
    overlay.addEventListener('click', () => closeSidebar());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');
    document.body.classList.add('sb-open');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
    document.body.classList.remove('sb-open');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();
