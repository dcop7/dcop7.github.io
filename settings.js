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
