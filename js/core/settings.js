const SettingsPage = (function () {
  'use strict';

  let _el = null;
  const T = k => typeof I18n !== 'undefined' ? I18n.t(k) : k;

  /* ── Apply density body class ── */
  function applyDensity(d) {
    document.body.classList.remove('density-comfortable', 'density-compact', 'density-list');
    if (d && d !== 'comfortable') document.body.classList.add('density-' + d);
  }

  function show() {
    _el = document.getElementById('view-settings');
    if (!_el) return;
    _build(_el);
    _syncAll();
  }

  function _build(el) {
    const curLang      = typeof I18n !== 'undefined' ? I18n.getLang() : 'pt';
    const tvDays       = localStorage.getItem('md-tv')       || '7';
    const theatersDays = localStorage.getItem('md-theaters') || '30';
    const digitalDays  = localStorage.getItem('md-digital')  || '7';
    const wpEnabled  = localStorage.getItem('wallpaper-enabled') === 'true';
    const density    = localStorage.getItem('site-density') || 'comfortable';
    const isPt       = curLang === 'pt';
    const VT = (pt, en) => isPt ? pt : en;

    el.innerHTML = `
      <div class="view-inner">
        <div class="page-header">
          <h1 class="page-title">⚙️ ${T('st.title')}</h1>
          <p class="page-subtitle">${T('st.sub')}</p>
        </div>
        <div class="st-grid">

          <!-- Appearance -->
          <div class="st-section">
            <div class="st-section-title">🎨 ${T('st.appearance')}</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('st.theme')}</div>
                <div class="st-row-desc">${T('st.theme.desc')}</div>
              </div>
              <div class="theme-grid" id="st-theme-grid" style="width:auto">
                <button class="theme-option" data-theme="dark">Dark</button>
                <button class="theme-option" data-theme="light">Light</button>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('st.wallpaper')}</div>
                <div class="st-row-desc">${T('st.wallpaper.desc')}</div>
              </div>
              <label class="st-toggle-wrap">
                <input type="checkbox" id="st-wp-toggle" ${wpEnabled?'checked':''} style="display:none">
                <div class="st-toggle${wpEnabled?' on':''}" id="st-wp-track"><div class="st-toggle-knob"></div></div>
              </label>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('st.fontsize')}</div>
                <div class="st-row-desc">${T('st.fontsize.desc')}</div>
              </div>
              <div class="st-font-ctrl">
                <button class="st-font-btn" id="st-font-dec">−</button>
                <span class="st-font-lbl" id="st-font-lbl">M</span>
                <button class="st-font-btn" id="st-font-inc">+</button>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('st.lang')}</div>
                <div class="st-row-desc">${T('st.lang.desc')}</div>
              </div>
              <div class="tool-seg" id="st-lang-seg">
                <button class="tsb${curLang==='pt'?' active':''}" data-lang="pt">🇵🇹 PT</button>
                <button class="tsb${curLang==='en'?' active':''}" data-lang="en">🇬🇧 EN</button>
              </div>
            </div>
          </div>

          <!-- Interface (global density) -->
          <div class="st-section">
            <div class="st-section-title">📐 ${T('st.interface')}</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('st.density')}</div>
                <div class="st-row-desc">${T('st.density.desc')}</div>
              </div>
              <div class="tool-seg" id="st-density">
                <button class="tsb${density==='comfortable'?' active':''}" data-density="comfortable">${T('st.density.comfortable')}</button>
                <button class="tsb${density==='compact'?' active':''}" data-density="compact">${T('st.density.compact')}</button>
                <button class="tsb${density==='list'?' active':''}" data-density="list">${T('st.density.list')}</button>
              </div>
            </div>
          </div>

          <!-- Entertainment -->
          <div class="st-section">
            <div class="st-section-title">🎬 ${T('st.entertainment')}</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('md.tv')}</div>
                <div class="st-row-desc">${T('st.mediadays.desc')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <input type="range" id="st-tv-days" min="3" max="30" step="1" value="${tvDays}" style="width:100px">
                <span id="st-tv-days-lbl" style="font-size:.78rem;font-family:var(--font-mono);font-weight:600;color:var(--accent);min-width:52px">${tvDays} ${T('st.mediadays.unit')}</span>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('md.theaters')}</div>
                <div class="st-row-desc">${T('st.mediadays.desc')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <input type="range" id="st-theaters-days" min="7" max="90" step="1" value="${theatersDays}" style="width:100px">
                <span id="st-theaters-days-lbl" style="font-size:.78rem;font-family:var(--font-mono);font-weight:600;color:var(--accent);min-width:52px">${theatersDays} ${T('st.mediadays.unit')}</span>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${T('md.digital')}</div>
                <div class="st-row-desc">${T('st.mediadays.desc')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <input type="range" id="st-digital-days" min="3" max="30" step="1" value="${digitalDays}" style="width:100px">
                <span id="st-digital-days-lbl" style="font-size:.78rem;font-family:var(--font-mono);font-weight:600;color:var(--accent);min-width:52px">${digitalDays} ${T('st.mediadays.unit')}</span>
              </div>
            </div>
          </div>

        </div>
      </div>`;
    _wire(el);
  }

  function _wire(el) {
    /* Theme */
    el.querySelectorAll('#st-theme-grid .theme-option').forEach(btn =>
      btn.addEventListener('click', () => {
        ThemeManager.apply(btn.dataset.theme);
        _syncTheme();
      })
    );

    /* Wallpaper */
    const wpToggle = el.querySelector('#st-wp-toggle');
    const wpTrack  = el.querySelector('#st-wp-track');
    wpToggle?.addEventListener('change', () => {
      localStorage.setItem('wallpaper-enabled', wpToggle.checked ? 'true' : 'false');
      if (window.applyWallpaper) window.applyWallpaper();
      wpTrack?.classList.toggle('on', wpToggle.checked);
    });

    /* Font size */
    el.querySelector('#st-font-dec')?.addEventListener('click', () => { document.getElementById('font-dec')?.click(); _syncFont(); });
    el.querySelector('#st-font-inc')?.addEventListener('click', () => { document.getElementById('font-inc')?.click(); _syncFont(); });

    /* Language */
    el.querySelectorAll('#st-lang-seg .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        if (typeof I18n !== 'undefined' && I18n.getLang() !== btn.dataset.lang) I18n.toggle();
        el.querySelectorAll('#st-lang-seg .tsb').forEach(b => b.classList.toggle('active', b === btn));
      })
    );

    /* Density */
    el.querySelectorAll('#st-density .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        const d = btn.dataset.density;
        localStorage.setItem('site-density', d);
        applyDensity(d);
        el.querySelectorAll('#st-density .tsb').forEach(b => b.classList.toggle('active', b === btn));
        /* sync media page if open */
        if (typeof MediaPage !== 'undefined') MediaPage.syncDensity(d);
      })
    );

    /* Media days — three separate */
    [['tv','#st-tv-days','#st-tv-days-lbl'],
     ['theaters','#st-theaters-days','#st-theaters-days-lbl'],
     ['digital','#st-digital-days','#st-digital-days-lbl']].forEach(([key, slId, lblId]) => {
      const sl  = el.querySelector(slId);
      const lbl = el.querySelector(lblId);
      sl?.addEventListener('input', () => {
        lbl.textContent = sl.value + ' ' + T('st.mediadays.unit');
        localStorage.setItem('md-' + key, sl.value);
      });
    });
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

  function _syncAll() { _syncTheme(); _syncFont(); }

  /* Rebuild settings on language change */
  document.addEventListener('langchange', () => {
    if (_el && _el.classList.contains('active')) {
      _build(_el);
      _syncAll();
    }
  });

  /* Apply saved density on page load */
  document.addEventListener('DOMContentLoaded', () => {
    applyDensity(localStorage.getItem('site-density') || 'comfortable');
  });

  return { show, applyDensity };
})();
