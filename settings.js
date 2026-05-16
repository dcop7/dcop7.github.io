const SettingsPage = (function () {
  'use strict';

  let _built = false;
  let _el    = null;

  function show() {
    _el = document.getElementById('view-settings');
    if (!_el) return;
    if (!_built) { _built = true; _build(_el); }
    _syncAll();
  }

  function _build(el) {
    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">⚙️ Definições</h1>
          <p class="page-subtitle">Personaliza a tua experiência</p>
        </div>
        <div class="st-grid">

          <div class="st-section">
            <div class="st-section-title">🎨 Aparência</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Tema</div>
                <div class="st-row-desc">Modo escuro ou claro</div>
              </div>
              <div class="theme-grid" id="st-theme-grid" style="width:auto">
                <button class="theme-option" data-theme="dark">Dark</button>
                <button class="theme-option" data-theme="light">Light</button>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Tamanho da letra</div>
                <div class="st-row-desc">Ajusta o tamanho do texto em todo o site</div>
              </div>
              <div class="st-font-ctrl">
                <button class="st-font-btn" id="st-font-dec">−</button>
                <span class="st-font-lbl" id="st-font-lbl">M</span>
                <button class="st-font-btn" id="st-font-inc">+</button>
              </div>
            </div>
          </div>

          <div class="st-section">
            <div class="st-section-title">⭐ Favoritos</div>
            <div id="st-bm-list" class="st-bm-list"></div>
            <div class="st-bm-actions">
              <button class="tool-btn" id="st-bm-add">+ Adicionar</button>
              <button class="tool-btn tool-btn-sec" id="st-bm-reset">↺ Repor padrão</button>
            </div>
          </div>

        </div>
      </div>`;
    _wire(el);
  }

  function _wire(el) {
    el.querySelectorAll('#st-theme-grid .theme-option').forEach(btn =>
      btn.addEventListener('click', () => {
        ThemeManager.apply(btn.dataset.theme);
        _syncTheme();
      })
    );

    el.querySelector('#st-font-dec')?.addEventListener('click', () => {
      document.getElementById('font-dec')?.click();
      _syncFont();
    });
    el.querySelector('#st-font-inc')?.addEventListener('click', () => {
      document.getElementById('font-inc')?.click();
      _syncFont();
    });

    el.querySelector('#st-bm-add')?.addEventListener('click', _addBm);
    el.querySelector('#st-bm-reset')?.addEventListener('click', () => {
      if (!confirm('Repor os favoritos para o padrão?')) return;
      localStorage.removeItem('home-bookmarks');
      window.Bookmarks?.render();
      _renderBmList();
    });

    _renderBmList();
  }

  function _addBm() {
    const urlRaw = prompt('URL do site (ex: https://github.com):');
    if (!urlRaw) return;
    let url = urlRaw.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    let name;
    try { name = new URL(url).hostname.replace('www.', ''); } catch { name = url; }
    const label = prompt('Nome:', name);
    if (!label) return;
    const bm = window.Bookmarks.get();
    bm.push({ name: label.trim(), url });
    window.Bookmarks.save(bm);
    window.Bookmarks.render();
    _renderBmList();
  }

  function _renderBmList() {
    const list = _el?.querySelector('#st-bm-list');
    if (!list) return;
    const bm = window.Bookmarks?.get() || [];
    if (!bm.length) {
      list.innerHTML = '<div class="st-empty">Sem favoritos guardados.</div>';
      return;
    }
    list.innerHTML = bm.map((b, i) => {
      const fav = window.Bookmarks?.favUrl(b.url) || '';
      return `<div class="st-bm-row" data-idx="${i}">
        ${fav
          ? `<img src="${fav}" class="st-bm-icon" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'st-bm-icon',textContent:'🌐'}))">`
          : '<span class="st-bm-icon" style="font-size:.9rem">🌐</span>'}
        <span class="st-bm-name" title="${b.name}">${b.name}</span>
        <span class="st-bm-url" title="${b.url}">${b.url}</span>
        <button class="st-bm-del" data-idx="${i}" title="Remover">✕</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.st-bm-del').forEach(btn =>
      btn.addEventListener('click', () => {
        const bm2 = window.Bookmarks.get();
        bm2.splice(+btn.dataset.idx, 1);
        window.Bookmarks.save(bm2);
        window.Bookmarks.render();
        _renderBmList();
      })
    );
  }

  function _syncTheme() {
    const cur = localStorage.getItem('site-theme') || 'dark';
    _el?.querySelectorAll('#st-theme-grid .theme-option').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === cur)
    );
  }

  function _syncFont() {
    const lbl = document.getElementById('font-lbl');
    const st  = _el?.querySelector('#st-font-lbl');
    if (st && lbl) st.textContent = lbl.textContent;
  }

  function _syncAll() {
    _syncTheme();
    _syncFont();
    _renderBmList();
  }

  return { show };
})();
