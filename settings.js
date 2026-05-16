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
    const curLang = typeof I18n !== 'undefined' ? I18n.getLang() : 'pt';
    const mediaMode = localStorage.getItem('media-view') || 'comfortable';
    const mediaDays = localStorage.getItem('media-days') || '14';
    const hangAge   = localStorage.getItem('hangman-age') || '7';
    const iconStyle = localStorage.getItem('icon-style') || 'colored';
    const wpEnabled = localStorage.getItem('wallpaper-enabled') === 'true';
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
                <div class="st-row-label">Ícones</div>
                <div class="st-row-desc">Coloridos ou monocromáticos</div>
              </div>
              <div class="tool-seg" id="st-icon-style">
                <button class="tsb${iconStyle==='colored'?' active':''}" data-style="colored">🌈 Coloridos</button>
                <button class="tsb${iconStyle==='mono'?' active':''}" data-style="mono">◾ Mono</button>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Wallpaper dinâmico</div>
                <div class="st-row-desc">Imagem de fundo adaptada ao tema (requer internet)</div>
              </div>
              <label class="st-toggle-wrap">
                <input type="checkbox" id="st-wp-toggle" ${wpEnabled?'checked':''} style="display:none">
                <div class="st-toggle" id="st-wp-track"><div class="st-toggle-knob"></div></div>
              </label>
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
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Língua</div>
                <div class="st-row-desc">Idioma da interface</div>
              </div>
              <div class="tool-seg" id="st-lang-seg">
                <button class="tsb${curLang==='pt'?' active':''}" data-lang="pt">🇵🇹 PT</button>
                <button class="tsb${curLang==='en'?' active':''}" data-lang="en">🇬🇧 EN</button>
              </div>
            </div>
          </div>

          <div class="st-section">
            <div class="st-section-title">🎬 Entretenimento</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Dias de histórico</div>
                <div class="st-row-desc">Quantos dias de episódios mostrar</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <input type="range" id="st-media-days" min="3" max="30" step="1" value="${mediaDays}" style="width:100px">
                <span class="st-days-lbl" id="st-days-lbl">${mediaDays} dias</span>
              </div>
            </div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Vista</div>
                <div class="st-row-desc">Densidade de informação</div>
              </div>
              <div class="tool-seg" id="st-media-view">
                <button class="tsb${mediaMode==='comfortable'?' active':''}" data-view="comfortable">Confortável</button>
                <button class="tsb${mediaMode==='compact'?' active':''}" data-view="compact">Compacta</button>
                <button class="tsb${mediaMode==='ultra'?' active':''}" data-view="ultra">Ultra</button>
              </div>
            </div>
          </div>

          <div class="st-section">
            <div class="st-section-title">🪢 Jogo da Forca</div>
            <div class="st-row">
              <div class="st-row-info">
                <div class="st-row-label">Faixa etária padrão</div>
                <div class="st-row-desc">Dificuldade das palavras ao iniciar</div>
              </div>
              <div class="tool-seg" id="st-hang-age">
                <button class="tsb${hangAge==='5'?' active':''}" data-age="5">5–7 anos</button>
                <button class="tsb${hangAge==='7'?' active':''}" data-age="7">7–9 anos</button>
                <button class="tsb${hangAge==='10'?' active':''}" data-age="10">10–12 anos</button>
                <button class="tsb${hangAge==='13'?' active':''}" data-age="13">13+ anos</button>
              </div>
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

    el.querySelectorAll('#st-icon-style .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        const style = btn.dataset.style;
        localStorage.setItem('icon-style', style);
        document.body.classList.toggle('icons-mono', style === 'mono');
        el.querySelectorAll('#st-icon-style .tsb').forEach(b => b.classList.toggle('active', b === btn));
      })
    );

    const wpToggle = el.querySelector('#st-wp-toggle');
    const wpTrack  = el.querySelector('#st-wp-track');
    function syncWpTrack() {
      wpTrack?.classList.toggle('on', wpToggle?.checked);
    }
    wpToggle?.addEventListener('change', () => {
      localStorage.setItem('wallpaper-enabled', wpToggle.checked ? 'true' : 'false');
      if (window.applyWallpaper) window.applyWallpaper();
      syncWpTrack();
    });
    syncWpTrack();

    el.querySelector('#st-font-dec')?.addEventListener('click', () => {
      document.getElementById('font-dec')?.click();
      _syncFont();
    });
    el.querySelector('#st-font-inc')?.addEventListener('click', () => {
      document.getElementById('font-inc')?.click();
      _syncFont();
    });

    el.querySelectorAll('#st-lang-seg .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        if (typeof I18n !== 'undefined' && I18n.getLang() !== btn.dataset.lang) I18n.toggle();
        el.querySelectorAll('#st-lang-seg .tsb').forEach(b => b.classList.toggle('active', b === btn));
      })
    );

    const daysSlider = el.querySelector('#st-media-days');
    const daysLbl    = el.querySelector('#st-days-lbl');
    daysSlider?.addEventListener('input', () => {
      const v = daysSlider.value;
      daysLbl.textContent = v + ' dias';
      localStorage.setItem('media-days', v);
    });

    el.querySelectorAll('#st-media-view .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        localStorage.setItem('media-view', btn.dataset.view);
        el.querySelectorAll('#st-media-view .tsb').forEach(b => b.classList.toggle('active', b === btn));
      })
    );

    el.querySelectorAll('#st-hang-age .tsb').forEach(btn =>
      btn.addEventListener('click', () => {
        localStorage.setItem('hangman-age', btn.dataset.age);
        el.querySelectorAll('#st-hang-age .tsb').forEach(b => b.classList.toggle('active', b === btn));
        const hfAgeBtn = document.querySelector(`.hf-age-btn[data-age="${btn.dataset.age}"]`);
        if (hfAgeBtn) hfAgeBtn.click();
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
  }

  return { show };
})();
