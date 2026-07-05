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
    el.querySelector('#st-font-dec')?.addEventListener('click', () => { window.FontCtl?.step(-1); _syncFont(); });
    el.querySelector('#st-font-inc')?.addEventListener('click', () => { window.FontCtl?.step(1); _syncFont(); });

    /* Language */
    el.querySelectorAll('#st-lang-seg .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        if (typeof I18n !== 'undefined' && I18n.getLang() !== btn.dataset.lang) I18n.toggle();
        el.querySelectorAll('#st-lang-seg .tsb').forEach(b => b.classList.toggle('active', b === btn));
      })
    );

    /* (A cidade da meteorologia escolhe-se agora no próprio widget da homepage.) */

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
    const st = _el?.querySelector('#st-font-lbl');
    if (st && window.FontCtl) st.textContent = FontCtl.label();
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

  /* ── QUICK PREFS PANEL (header popover / mobile bottom sheet) ──────
     The Definições page left the navigation; these are the fast, frequent
     preferences. The full page + route stay in the codebase for later. */
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('prefs-btn');
    const pop = document.getElementById('prefs-pop');
    const ov  = document.getElementById('prefs-overlay');
    if (!btn || !pop) return;
    const isPt = () => (typeof I18n !== 'undefined' ? I18n.getLang() : 'pt') === 'pt';

    const L = {
      title: ['Preferências', 'Preferences'],
      wp: ['Wallpaper dinâmico', 'Dynamic wallpaper'], 'wp.d': ['Imagem de fundo adaptada ao tema', 'Theme-matched background image'],
      den: ['Densidade', 'Density'], 'den.d': ['Espaçamento da interface', 'Interface spacing'],
      'den.1': ['Confortável', 'Comfortable'], 'den.2': ['Compacta', 'Compact'], 'den.3': ['Lista', 'List'],
      font: ['Tamanho da letra', 'Font size'], 'font.d': ['Aplica-se a todo o site', 'Applies to the whole site'],
    };
    function syncLabels() {
      const i = isPt() ? 0 : 1;
      pop.querySelectorAll('[data-pp]').forEach(el => { const k = el.dataset.pp; if (L[k]) el.textContent = L[k][i]; });
    }
    function syncState() {
      const wpOn = localStorage.getItem('wallpaper-enabled') === 'true';
      const wpInput = document.getElementById('pp-wp-input');
      if (wpInput) wpInput.checked = wpOn;
      document.getElementById('pp-wp-track')?.classList.toggle('on', wpOn);
      const den = localStorage.getItem('site-density') || 'comfortable';
      pop.querySelectorAll('#pp-density .pp-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.density === den));
      if (window.FontCtl) {
        const ppLbl = document.getElementById('pp-font-lbl');
        if (ppLbl) ppLbl.textContent = FontCtl.label();
        const dec = document.getElementById('pp-font-dec'), inc = document.getElementById('pp-font-inc');
        if (dec) dec.disabled = FontCtl.atMin();
        if (inc) inc.disabled = FontCtl.atMax();
      }
    }
    function open()  { syncLabels(); syncState(); pop.hidden = false; if (ov) ov.hidden = false; }
    function close() { pop.hidden = true; if (ov) ov.hidden = true; }

    btn.addEventListener('click', () => (pop.hidden ? open() : close()));
    document.getElementById('pp-close')?.addEventListener('click', close);
    ov?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) close(); });
    document.addEventListener('click', e => {
      if (pop.hidden) return;
      if (!e.target.closest('#prefs-pop') && !e.target.closest('#prefs-btn')) close();
    });

    document.getElementById('pp-wp-input')?.addEventListener('change', e => {
      localStorage.setItem('wallpaper-enabled', e.target.checked ? 'true' : 'false');
      if (window.applyWallpaper) window.applyWallpaper();
      document.getElementById('pp-wp-track')?.classList.toggle('on', e.target.checked);
    });
    pop.querySelectorAll('#pp-density .pp-seg-btn').forEach(b =>
      b.addEventListener('click', () => {
        localStorage.setItem('site-density', b.dataset.density);
        applyDensity(b.dataset.density);
        syncState();
      }));
    document.getElementById('pp-font-dec')?.addEventListener('click', () => { window.FontCtl?.step(-1); syncState(); });
    document.getElementById('pp-font-inc')?.addEventListener('click', () => { window.FontCtl?.step(1); syncState(); });
    document.addEventListener('langchange', () => { if (!pop.hidden) syncLabels(); });
  });

  return { show, applyDensity };
})();
