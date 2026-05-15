const RssPage = (function () {
  'use strict';

  const SOURCES = [
    { id: 'hn-top',  label: 'HN Top',   icon: '🔥', type: 'hn', tag: 'front_page' },
    { id: 'hn-new',  label: 'HN New',   icon: '🆕', type: 'hn', tag: 'story'      },
    { id: 'hn-ask',  label: 'HN Ask',   icon: '❓', type: 'hn', tag: 'ask_hn'     },
    { id: 'hn-show', label: 'HN Show',  icon: '👁️', type: 'hn', tag: 'show_hn'   },
  ];

  let _activeSource = 'hn-top';
  let _cache = {};
  let _rendered = false;

  function timeAgo(ts) {
    const sec = Math.floor(Date.now() / 1000) - ts;
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.floor(hr / 24)}d`;
  }

  function domain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  async function fetchHN(tag, n = 30) {
    const url = `https://hn.algolia.com/api/v1/search?tags=${tag}&hitsPerPage=${n}`;
    const r = await fetch(url);
    const d = await r.json();
    return (d.hits || []).map(h => ({
      id:       h.objectID,
      title:    h.title,
      url:      h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      points:   h.points || 0,
      author:   h.author,
      time:     h.created_at_i,
      comments: h.num_comments || 0,
      hn_url:   `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
  }

  function cardHTML(item, idx) {
    const dm = domain(item.url);
    return `<div class="rss-card" onclick="window.open('${item.url}','_blank','noopener')">
      <div class="rss-card-title">${item.title}</div>
      <div class="rss-card-meta">
        ${dm ? `<span>${dm}</span>` : ''}
        <span class="rss-card-score">▲ ${item.points}</span>
        <span class="rss-card-comments">💬 ${item.comments}</span>
        <span>by ${item.author}</span>
        <span>${timeAgo(item.time)} ago</span>
        <a class="rss-card-hn" href="${item.hn_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--muted);font-size:.62rem">HN ↗</a>
      </div>
    </div>`;
  }

  async function loadSource(srcId) {
    _activeSource = srcId;
    const src = SOURCES.find(s => s.id === srcId);
    if (!src) return;

    const list = document.getElementById('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="hn-loading"><div class="hn-spinner"></div>Loading…</div>';

    document.querySelectorAll('.rss-source-item').forEach(el => {
      el.classList.toggle('active', el.dataset.src === srcId);
    });

    if (_cache[srcId]) {
      list.innerHTML = _cache[srcId].map(cardHTML).join('');
      return;
    }

    try {
      const items = await fetchHN(src.tag, 40);
      _cache[srcId] = items;
      list.innerHTML = items.length
        ? items.map(cardHTML).join('')
        : '<div class="hn-empty">No stories found.</div>';
    } catch {
      list.innerHTML = '<div class="hn-empty">Failed to load feed.</div>';
    }
  }

  function render() {
    const page = document.getElementById('feed-page');
    if (!page) return;

    page.innerHTML = `
      <div class="rss-page-grid">
        <div class="rss-sources">
          ${SOURCES.map(s => `
            <div class="rss-source-item${s.id === _activeSource ? ' active' : ''}" data-src="${s.id}">
              <span class="rss-source-icon">${s.icon}</span>${s.label}
            </div>`).join('')}
        </div>
        <div class="rss-feed-list" id="feed-list">
          <div class="hn-loading"><div class="hn-spinner"></div>Loading…</div>
        </div>
      </div>`;

    page.querySelectorAll('.rss-source-item').forEach(el => {
      el.addEventListener('click', () => loadSource(el.dataset.src));
    });

    loadSource(_activeSource);
    _rendered = true;
  }

  function show() {
    if (!_rendered) render();
    else loadSource(_activeSource);
  }

  // ── HOME WIDGET ────────────────────────────────────────────────
  async function loadWidget() {
    const list = document.getElementById('hn-widget-list');
    if (!list) return;
    try {
      const items = await fetchHN('front_page', 10);
      if (!items.length) { list.innerHTML = '<div class="hn-empty">No stories.</div>'; return; }
      list.innerHTML = items.map((item, i) => `
        <div class="hn-item" onclick="window.open('${item.url}','_blank','noopener')" title="${item.title}">
          <span class="hn-rank">${i + 1}</span>
          <div class="hn-body">
            <div class="hn-title">${item.title}</div>
            <div class="hn-meta">
              <span class="hn-score">▲ ${item.points}</span>
              <span>💬 ${item.comments}</span>
              <span>${timeAgo(item.time)}</span>
              ${domain(item.url) ? `<span class="hn-domain">${domain(item.url)}</span>` : ''}
            </div>
          </div>
        </div>`).join('');
    } catch {
      list.innerHTML = '<div class="hn-empty">Failed to load.</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget);
  } else {
    loadWidget();
  }

  return { show };
})();
