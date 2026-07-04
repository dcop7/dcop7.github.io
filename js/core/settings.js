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
    const wpEnabled  = localStorage.getItem('wallpaper-enabled') === 'true';
    const density    = localStorage.getItem('site-density') || 'comfortable';
    const isPt       = curLang === 'pt';
    const VT = (pt, en) => isPt ? pt : en;

    el.innerHTML = `
      <div class="view-inner">
        <div class="page-head">
          <span class="ph-ico">${AppIcons.icon('settings', 22)}</span>
          <div class="ph-titles">
            <h1 class="ph-title">${T('st.title')}</h1>
            <p class="ph-sub">${T('st.sub')}</p>
          </div>
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

          <!-- Homepage -->
          <div class="st-section">
            <div class="st-section-title">🏠 ${VT('Página inicial', 'Homepage')}</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">${VT('Cidade (meteorologia)', 'City (weather)')}</div>
                <div class="st-row-desc">${VT('Cidade usada no cartão de meteorologia da página inicial.', 'City used in the homepage weather card.')}</div>
              </div>
              <input type="text" id="st-weather-city" class="st-input" placeholder="Leiria"
                value="${(localStorage.getItem('weather-city') || 'Leiria').replace(/"/g, '&quot;')}"
                autocomplete="off" spellcheck="false" style="width:auto;min-width:140px">
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

    /* Weather city */
    const cityInput = el.querySelector('#st-weather-city');
    const saveCity = () => {
      const v = (cityInput.value || '').trim() || 'Leiria';
      localStorage.setItem('weather-city', v);
      document.dispatchEvent(new CustomEvent('weather-city-change'));
    };
    cityInput?.addEventListener('change', saveCity);
    cityInput?.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); cityInput.blur(); } });

    /* Density */
    el.querySelectorAll('#st-density .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        const d = btn.dataset.density;
        localStorage.setItem('site-density', d);
        applyDensity(d);
        el.querySelectorAll('#st-density .tsb').forEach(b => b.classList.toggle('active', b === btn));
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
