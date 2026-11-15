/* ══════════════════════════════════════════════════════════════════
   PhIcon — ícones de traço do microsite (desenho próprio, 24×24, sem
   dependências). Substituem os emojis que os capítulos herdaram do portal:
   um emoji muda de desenho em cada sistema operativo e não obedece ao tema;
   estes herdam a cor do texto (currentColor) e têm sempre o mesmo peso.

     PhIcon.svg('aperture')            → '<svg class="ic" …>'
     PhIcon.svg('star', { fill: 1 })   → preenchido
     PhIcon.has(nome)
   ══════════════════════════════════════════════════════════════════ */
const PhIcon = (function () {
  'use strict';
  const P = {
    /* câmara e exposição */
    aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3l4.2 7.3M20.6 9.4l-8.4.1M19.8 16.5l-4.3-7.3M12 21l-4.2-7.3M3.4 14.6l8.4-.1M4.2 7.5l4.3 7.3"/>',
    shutter: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.6 1.6M9.5 2.5h5M12 2.5V5"/>',
    iso: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7 9.5v5M10.2 14.5h1.6a1.2 1.2 0 000-2.5h-.6a1.2 1.2 0 010-2.5h1.6M16.8 9.5a1.6 2.5 0 100 5 1.6 2.5 0 000-5z"/>',
    ev: '<path d="M4 20L20 4M6.5 5.5v5M4 8h5M15 17h5"/>',
    meter: '<path d="M3 16a9 9 0 0118 0"/><path d="M12 16l4.5-6.5"/><path d="M3 19.5h18"/>',
    focus: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="2.2"/>',
    nd: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 6.5l5 5M12 11l5.6 5.6M12 15.5l3.4 3.4"/>',
    tripod: '<path d="M12 9l-6 12M12 9l6 12M12 9v9"/><rect x="8.5" y="3" width="7" height="5" rx="1"/><path d="M15.5 5.5H18"/>',
    hand: '<path d="M8 12.5V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8c0 4-2.2 7-6 7-2.6 0-4-1-5.4-3.4L4 14a1.5 1.5 0 012.6-1.5l1.4 2"/>',
    sensor: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><rect x="7" y="8.5" width="10" height="7" rx=".6"/>',
    flash: '<path d="M13 2.5L5.5 13.5h5L10 21.5l8.5-12h-5.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    sunrise: '<path d="M4 18h16M6.5 18a5.5 5.5 0 0111 0M12 5.5v3M5.2 9.8l1.7 1.7M18.8 9.8l-1.7 1.7M2.5 21.5h19"/>',
    wave: '<path d="M2.5 9c2.4 0 2.4 2 4.8 2s2.4-2 4.8-2 2.4 2 4.8 2 2.4-2 4.6-2M2.5 15c2.4 0 2.4 2 4.8 2s2.4-2 4.8-2 2.4 2 4.8 2 2.4-2 4.6-2"/>',
    ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M6.5 8v3M10 8v4.5M13.5 8v3M17 8v4.5"/>',
    lens: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M9.5 9.5a3.6 3.6 0 012.5-1"/>',
    camera: '<path d="M3.5 8.5a1.5 1.5 0 011.5-1.5h2.2l1.4-2.2h6.8L16.8 7H19a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/><circle cx="12" cy="12.8" r="3.6"/>',
    crop: '<path d="M6.5 2.5v15h15M2.5 6.5h15v15"/>',
    infinity: '<path d="M12 12c-1.6-2.4-3-3.5-4.8-3.5a3.5 3.5 0 000 7c1.8 0 3.2-1.1 4.8-3.5zm0 0c1.6 2.4 3 3.5 4.8 3.5a3.5 3.5 0 000-7c-1.8 0-3.2 1.1-4.8 3.5z"/>',
    /* mesa de trabalho */
    histogram: '<path d="M3 20.5h18M3.5 20V15l2.5-2 2.4 3 2.8-9 2.6 6 2.4-3.4 2.3 5 2 .9V20"/>',
    split: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M12 2.5v19M8.5 10l-2 2 2 2M15.5 10l2 2-2 2"/>',
    side: '<rect x="2.5" y="5" width="8.5" height="14" rx="1.2"/><rect x="13" y="5" width="8.5" height="14" rx="1.2"/>',
    single: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.8v5.4M7.8 10.5h5.4"/>',
    panelL: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M9 4.5v15"/>',
    panelR: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M15 4.5v15"/>',
    expand: '<path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5"/>',
    clip: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.2"/>',
    sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h10M18 17.5h2"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="17.5" r="2"/>',
    curve: '<path d="M3.5 3.5v17h17"/><path d="M5.5 18.5c5 0 6-2 7.5-6s3-7 7-7"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-.9.7-1.6 1.7-1.6H17a4 4 0 004-4c0-4.5-4-8.1-9-8.1z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.6" cy="7.3" r="1"/>',
    grain: '<circle cx="6" cy="7" r=".8"/><circle cx="12" cy="5.5" r=".8"/><circle cx="17.5" cy="8" r=".8"/><circle cx="8.5" cy="12" r=".8"/><circle cx="15" cy="12.5" r=".8"/><circle cx="5.5" cy="17" r=".8"/><circle cx="11.5" cy="18" r=".8"/><circle cx="18" cy="17" r=".8"/>',
    detail: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    film: '<rect x="3" y="3.5" width="18" height="17" rx="1.5"/><path d="M7.5 3.5v17M16.5 3.5v17M3 8h4.5M3 12h4.5M3 16h4.5M16.5 8H21M16.5 12H21M16.5 16H21"/>',
    undo: '<path d="M8 6L3.5 10.5 8 15"/><path d="M3.5 10.5H14a6 6 0 010 12h-3"/>',
    redo: '<path d="M16 6l4.5 4.5L16 15"/><path d="M20.5 10.5H10a6 6 0 000 12h3"/>',
    reset: '<path d="M4 12a8 8 0 108-8H7.5"/><path d="M10.5 1L7.5 4l3 3"/>',
    download: '<path d="M12 3.5v12M7 11l5 5 5-5M4 20.5h16"/>',
    upload: '<path d="M12 16V4M7 8.5l5-5 5 5M4 20.5h16"/>',
    /* navegação e geral */
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    up: '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
    arrow: '<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5"/>',
    external: '<path d="M10 5H5v14h14v-5M14 4h6v6M20 4l-9 9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 114 2c-.9.7-1.6 1.2-1.6 2.4M12 16.8v.2"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5zM4 20.5A2.5 2.5 0 016.5 18"/>',
    flask: '<path d="M9.5 3h5M10.5 3v6L4.8 18.6A1.6 1.6 0 006.2 21h11.6a1.6 1.6 0 001.4-2.4L13.5 9V3M7.5 15h9"/>',
    studio: '<path d="M4 4h9l4 5v5l-4 5H4z"/><path d="M17 11.5h3.5M9 19v2.5M6 21.5h6"/>',
    street: '<path d="M4 21V8l5-3v16M9 21V11l6-3v13M15 21v-9l5 2v7M2.5 21h19"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',
    list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.5M4 12h.5M4 17.5h.5"/>',
    bolt: '<path d="M13 2.5L5.5 13.5h5L10 21.5l8.5-12h-5.5z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9"/>',
    idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0012 3z"/>',
    pin: '<path d="M12 21.5s6.5-6.3 6.5-11.5a6.5 6.5 0 00-13 0c0 5.200 6.5 11.5 6.500 11.5z"/><circle cx="12" cy="10" r="2.3"/>',
    compose: '<rect x="3.500" y="4.5" width="17" height="15" rx="1"/><path d="M9.2 4.5v15M14.8 4.5v15M3.5 9.500h17M3.5 14.500h17"/>',
    edit: '<path d="M4 20l1-4.500L16.500 4l3.500 3.500L8.500 19z"/><path d="M14 6.500l3.500 3.500"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100"/>',
    mountain: '<path d="M2.500 19.500l6.500-11 4 6.500 2.500-3.500 6 8z"/><circle cx="17.500" cy="6.500" r="1.800"/>',
    person: '<circle cx="12" cy="7.500" r="3.500"/><path d="M5 20.500c.500-4 3.300-6 7-6s6.500 2 7 6"/>',
    moon: '<path d="M20.500 13.500A8.500 8.500 0 1110.500 3.500a6.800 6.800 0 0010 10z"/>',
    city: '<path d="M4 21V8l5-3v16M9 21V11l6-3v13M15 21v-9l5 2v7M2.500 21h19"/>',
    box: '<path d="M12 3l8.500 4.500v9L12 21l-8.500-4.500v-9z"/><path d="M3.500 7.500L12 12l8.500-4.500M12 12v9"/>',
    wand: '<path d="M5 19L16 8M14 6l4 4M18.500 3v3M17 4.500h3M6 4v2.500M4.800 5.200h2.500M19 14v2.500M17.800 15.200h2.500"/>',
    heart: '<path d="M12 20.500s-8-4.800-8-10.800a4.500 4.500 0 018-2.800 4.500 4.500 0 018 2.800c0 6-8 10.800-8 10.800z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
    layers: '<path d="M12 3.500L21 8.500 12 13.500 3 8.500zM3.500 12.500L12 17.300l8.500-4.800M3.500 16.200L12 21l8.500-4.800"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    photo: '<rect x="3" y="4.500" width="18" height="15" rx="1.500"/><circle cx="8.500" cy="9.500" r="1.600"/><path d="M3.500 17l5-5 3.500 3.500 3-3 5.500 5.500"/>',
  };
  function svg(name, o) {
    const d = P[name] || P.info;
    const fill = o && o.fill;
    return `<svg class="ic${o && o.cls ? ' ' + o.cls : ''}" viewBox="0 0 24 24" width="1em" height="1em" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${(o && o.w) || 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  }
  /* ── emojis → ícones ───────────────────────────────────────────────
     Os capítulos e os JSON herdados do portal usam ~180 emojis diferentes
     como ícones (títulos, separadores, chips). Em vez de reescrever 500
     ocorrências em 20 ficheiros, trata-se aqui: sempre que um capítulo
     desenha, os emojis que têm equivalente passam a ícone de traço e os
     restantes saem. Os dados continuam como estão (e o emoji continua a
     servir de recurso se este ficheiro faltar). Símbolos tipográficos
     (✓ ✗ ↔ → ©) não são tocados. */
  const MAP = {
    '⚠': 'warn', '🪤': 'warn', '🚧': 'warn', '✅': 'check', '☑': 'check', '⛔': 'x', '❌': 'x', '🚫': 'x', '💡': 'idea', '🧠': 'idea', '🎯': 'target',
    '📷': 'camera', '📸': 'camera', '🎥': 'camera', '🎞': 'film', '🎬': 'film', '⏱': 'shutter', '⏳': 'shutter', '⌛': 'shutter', '☀': 'sun', '🔆': 'sun', '🌞': 'sun',
    '🔵': 'aperture', '🔘': 'aperture', '🔭': 'lens', '🔍': 'search', '🔎': 'search', '🔬': 'detail', '🎨': 'palette', '🖼': 'compose', '📐': 'ruler', '📏': 'ruler',
    '✂': 'crop', '📖': 'book', '📚': 'book', '🎓': 'book', '🧮': 'ev', '🎚': 'sliders', '🎛': 'sliders', '📈': 'curve', '📊': 'histogram', '⚡': 'flash',
    '🌅': 'sunrise', '🌇': 'sunrise', '🌄': 'sunrise', '🌊': 'wave', '💧': 'wave', '💦': 'wave', '🏔': 'mountain', '⛰': 'mountain', '🏞': 'mountain',
    '👤': 'person', '🧍': 'person', '👥': 'person', '👁': 'eye', '⚖': 'meter', '📋': 'list', '🗂': 'list', '⚙': 'gear', '🛠': 'gear', '🔧': 'gear', '📍': 'pin',
    '🌃': 'moon', '🌌': 'moon', '🌙': 'moon', '🌓': 'moon', '📦': 'box', '✨': 'wand', '🪄': 'wand', '🔗': 'arrow', 'ℹ': 'info', '✋': 'hand', '🤚': 'hand',
    '🧪': 'flask', '🏙': 'city', '🏛': 'city', '🕶': 'eye', '🧭': 'target', '🔦': 'flash', '🎒': 'box', '📝': 'edit', '✏': 'edit', '🗺': 'pin', '⏰': 'clock', '🕐': 'clock',
    '💚': 'palette', '🌡': 'sun', '🌫': 'layers', '☁': 'layers', '🌤': 'sun', '🌧': 'wave', '❤': 'heart', '📱': 'photo', '🖥': 'photo', '🌈': 'palette',
  };
  const KEEP = '©®™↔↕✔✖▶◀‼⁉';
  const RE = /\p{Extended_Pictographic}[\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\p{Extended_Pictographic}]*\s?/gu;
  const HAS = /\p{Extended_Pictographic}/u;
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CANVAS: 1, svg: 1, INPUT: 1 };

  function tidy(root) {
    if (!root || root.nodeType !== 1) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!HAS.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) if (SKIP[p.nodeName] || (p.classList && p.classList.contains('dk'))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const txt = n.nodeValue, parent = n.parentNode;
      let icon = null, lead = true;
      const out = txt.replace(RE, (m, off) => {
        const ch = m.codePointAt(0) <= 0xFFFF ? m[0] : m.slice(0, 2);
        if (KEEP.includes(ch)) return m;
        if (lead && !txt.slice(0, off).trim() && MAP[ch]) icon = MAP[ch];
        lead = false;
        return '';
      });
      if (out === txt) continue;
      const inOption = parent.nodeName === 'OPTION';
      if (icon && !inOption) {
        const t = document.createElement('template');
        t.innerHTML = svg(icon, { cls: 'ic-e' });
        parent.insertBefore(t.content.firstChild, n);
      }
      n.nodeValue = icon && !inOption ? out.replace(/^\s+/, ' ') : out;
      /* o emoji era tudo o que o elemento tinha e não há ícone para ele */
      if (!icon && !parent.textContent.trim() && !parent.children.length) parent.setAttribute('data-noico', '');
    }
  }
  /* observa um contentor e arruma cada pedaço que os capítulos desenham */
  function watch(root) {
    if (!root || !window.MutationObserver) return;
    let queue = new Set(), raf = 0;
    const flush = () => { raf = 0; const q = queue; queue = new Set(); q.forEach(el => { if (el.isConnected) tidy(el); }); };
    new MutationObserver(list => {
      for (const m of list) for (const nd of m.addedNodes) {
        if (nd.nodeType === 1) queue.add(nd);
        else if (nd.nodeType === 3 && nd.parentNode && HAS.test(nd.nodeValue)) queue.add(nd.parentNode);
      }
      if (queue.size && !raf) raf = requestAnimationFrame(flush);
    }).observe(root, { childList: true, subtree: true });
    tidy(root);
  }

  return { svg, has: n => !!P[n], names: () => Object.keys(P), tidy, watch };
})();
