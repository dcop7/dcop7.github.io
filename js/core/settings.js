const SettingsPage = (function () {
  'use strict';

  let _el = null;
  const T = k => typeof I18n !== 'undefined' ? I18n.t(k) : k;

  /* Selected weather location (stable id + coords) with legacy fallback */
  function _cityLabel() {
    try {
      const l = JSON.parse(localStorage.getItem('weather-loc') || 'null');
      if (l && l.name) return l.name + (l.admin1 ? ` (${l.admin1})` : '');
    } catch (e) {}
    return localStorage.getItem('weather-city') || 'Leiria';
  }

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
              <div class="st-city-wrap">
                <input type="text" id="st-weather-city" class="st-input" placeholder="${VT('Pesquisar cidade…', 'Search city…')}"
                  value="${_cityLabel().replace(/"/g, '&quot;')}"
                  autocomplete="off" spellcheck="false" style="width:auto;min-width:200px">
                <div class="st-city-drop" id="st-city-drop" hidden></div>
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
    const VT = (pt, en) => ((typeof I18n !== 'undefined' ? I18n.getLang() : 'pt') === 'pt') ? pt : en;
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

    /* Weather city — autocomplete against the Open-Meteo geocoder. The user
       picks an explicit result and we persist its stable id + coordinates
       (weather-loc); free text alone is never trusted as a location. */
    const cityInput = el.querySelector('#st-weather-city');
    const cityDrop  = el.querySelector('#st-city-drop');
    let _acTimer = null;
    const closeDrop = () => { if (cityDrop) { cityDrop.hidden = true; cityDrop.innerHTML = ''; } };

    async function searchCities(q) {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=pt`);
        const j = await r.json();
        return (j && j.results) || [];
      } catch { return []; }
    }
    function pickCity(c) {
      const loc = { id: c.id, name: c.name, admin1: c.admin1 || '', country: c.country_code || '', lat: c.latitude, lon: c.longitude };
      localStorage.setItem('weather-loc', JSON.stringify(loc));
      localStorage.setItem('weather-city', loc.name);          /* legacy readers */
      try { localStorage.removeItem('weather-cache-' + loc.name.toLowerCase()); } catch (e) {}
      if (cityInput) cityInput.value = _cityLabel();
      closeDrop();
      document.dispatchEvent(new CustomEvent('weather-city-change'));
    }
    cityInput?.addEventListener('input', () => {
      clearTimeout(_acTimer);
      const q = cityInput.value.trim();
      if (q.length < 2) { closeDrop(); return; }
      _acTimer = setTimeout(async () => {
        const res = await searchCities(q);
        if (!cityDrop) return;
        if (!res.length) { cityDrop.innerHTML = `<div class="st-city-empty">${VT('Sem resultados', 'No results')}</div>`; cityDrop.hidden = false; return; }
        cityDrop.innerHTML = res.map((c, i) =>
          `<button type="button" class="st-city-opt" data-i="${i}">
            <b>${c.name}</b><small>${[c.admin1, c.country_code].filter(Boolean).join(' · ')}</small>
          </button>`).join('');
        cityDrop.hidden = false;
        cityDrop.querySelectorAll('.st-city-opt').forEach(btn =>
          btn.addEventListener('mousedown', ev => { ev.preventDefault(); pickCity(res[+btn.dataset.i]); }));
      }, 250);
    });
    cityInput?.addEventListener('blur', () => setTimeout(() => { if (cityInput) cityInput.value = _cityLabel(); closeDrop(); }, 180));
    cityInput?.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') closeDrop();
      if (ev.key === 'Enter') { ev.preventDefault(); cityDrop?.querySelector('.st-city-opt')?.dispatchEvent(new MouseEvent('mousedown')); }
    });

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
