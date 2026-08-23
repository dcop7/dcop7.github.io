// ── APP ICONS — bespoke duotone icon set (brand language v4) ─────────
// Drawn specifically for Diogo Universe: one geometry (24px grid, 1.6
// stroke, round caps) and a per-section gradient restricted to the FIVE
// brand colour families (derived from the favicon): AZUL, CIANO, LARANJA,
// VERMELHO e DOURADO. Group logic: tons frios para Descobrir/Ferramentas,
// quentes para Diversão/Fotografia, vermelho reservado a alertas e F1,
// dourado para a marca (Início) e destaques. Loaded in <head> so every
// template can call AppIcons.icon() regardless of deferred-script order.
//   azul     #3b82f6→#60a5fa · #60a5fa→#93c5fd
//   ciano    #22d3ee→#67e8f9 (ponte azul-ciano: #38bdf8→#22d3ee)
//   laranja  #fb923c→#fdba74
//   vermelho #ef4444→#f97316 · #f87171→#fca5a5
//   dourado  #f2b344→#fbc75f (ouro do anel do favicon)
const AppIcons = (function () {

  /* duotone wrapper: gradient stroke + soft gradient fill on the silhouette.
     (The old "spark" brand dot was removed — even animated it read as a
     stray green pixel at sidebar sizes.) */
  function duo(id, c1, c2, body) {
    return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<defs><linearGradient id="ig-${id}" x1="4" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
<stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
${body.replaceAll('G', `url(#ig-${id})`).replaceAll('C2', c2).replaceAll('C1', c1)}
</svg>`;
  }

  const ICONS = {
    home: duo('home', '#f2b344', '#fbc75f', `
      <path d="M4 10.2 12 3.6l8 6.6V20a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 20z" fill="G" fill-opacity=".14" stroke="G"/>
      <path d="M9.6 21.3v-6.1a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v6.1" stroke="C2"/>
      <circle cx="12" cy="8.6" r=".9" fill="C2" stroke="none"/>`, { sx: 20.2, sy: 5.6, ss: .9 }),

    explorer: duo('explorer', '#38bdf8', '#22d3ee', `
      <circle cx="12" cy="12" r="7.6" fill="G" fill-opacity=".14" stroke="G"/>
      <path d="M4.4 12h15.2M12 4.4a12.8 12.8 0 0 1 3.2 7.6 12.8 12.8 0 0 1-3.2 7.6 12.8 12.8 0 0 1-3.2-7.6A12.8 12.8 0 0 1 12 4.4z" stroke="G" opacity=".85"/>
      <ellipse cx="12" cy="12" rx="10.4" ry="3.6" stroke="C2" opacity=".55" transform="rotate(-18 12 12)"/>`, { sx: 20.6, sy: 4.2, ss: .9 }),

    noticias: duo('noticias', '#60a5fa', '#93c5fd', `
      <path d="M3.6 4.6h12.8a1 1 0 0 1 1 1V19a1.5 1.5 0 0 0 3 0V8.2h1.4V19a2.9 2.9 0 0 1-2.9 2.9H5.5A2.9 2.9 0 0 1 2.6 19V5.6a1 1 0 0 1 1-1z" fill="G" fill-opacity=".13" stroke="G"/>
      <rect x="5.8" y="7.4" width="5" height="3.6" rx=".7" fill="C2" fill-opacity=".55" stroke="none"/>
      <path d="M13.4 8h1.6M13.4 10.4h1.6M5.9 13.8h9.1M5.9 16.6h9.1" stroke="C2" opacity=".85"/>`),

    /* cartão de cidadão: retrato + linhas de dados, tom frio (grupo Descobrir) */
    cidadao: duo('cidadao', '#38bdf8', '#67e8f9', `
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" fill="G" fill-opacity=".13" stroke="G"/>
      <circle cx="8.2" cy="10.4" r="2" stroke="G"/>
      <path d="M5.4 15.9c.5-1.7 1.5-2.6 2.8-2.6s2.3.9 2.8 2.6" stroke="G"/>
      <path d="M13.6 9.4h4.6M13.6 12.2h4.6M13.6 15h3" stroke="C2" opacity=".85"/>`, { sx: 20.4, sy: 3.6, ss: .8 }),

    eventos: duo('eventos', '#22d3ee', '#67e8f9', `
      <rect x="3.4" y="4.8" width="17.2" height="16.2" rx="2.2" fill="G" fill-opacity=".13" stroke="G"/>
      <path d="M8 2.8v3.4M16 2.8v3.4M3.6 9.6h16.8" stroke="G"/>
      <rect x="14.2" y="12.4" width="3.6" height="3.6" rx=".9" fill="C2" fill-opacity=".75" stroke="none"/>
      <path d="M6.6 13.8h.01M10.4 13.8h.01M6.6 17.4h.01M10.4 17.4h.01M14.4 17.4h.01" stroke="C2" stroke-width="1.9"/>`, { sx: 20.4, sy: 3.4, ss: .8 }),

    ocorrencias: duo('ocorrencias', '#fb923c', '#fdba74', `
      <path d="M10.6 4 2.5 17.6a1.9 1.9 0 0 0 1.6 2.9h15.8a1.9 1.9 0 0 0 1.6-2.9L13.4 4a1.9 1.9 0 0 0-2.8 0z" fill="G" fill-opacity=".15" stroke="G"/>
      <path d="M6.5 15.2h2.2l1.2-2.6 1.9 4 1.6-3.2 1 1.8h2.9" stroke="C2"/>`, { sx: 20.3, sy: 4.9, ss: .85 }),

    f1: duo('f1', '#ef4444', '#f97316', `
      <path d="M5 21.4V3.4" stroke="G" stroke-width="1.8"/>
      <path d="M5 4.2c2.6-1.5 5.3-1.5 8 0s5.3 1.5 7.6.2v8.4c-2.3 1.3-5 1.3-7.6-.2s-5.4-1.5-8 0z" fill="G" fill-opacity=".14" stroke="G"/>
      <rect x="8.2" y="5.2" width="3" height="3" rx=".4" fill="C1" fill-opacity=".8" stroke="none"/>
      <rect x="14.2" y="9" width="3" height="3" rx=".4" fill="C2" fill-opacity=".8" stroke="none"/>`, { sx: 20.6, sy: 17.6, ss: .85 }),

    oss: duo('oss', '#3b82f6', '#60a5fa', `
      <path d="m15.6 17.6 5.4-5.6-5.4-5.6M8.4 6.4 3 12l5.4 5.6" stroke="G" stroke-width="1.8"/>
      <path d="M13.4 4.6 10.6 19.4" stroke="C2" opacity=".8"/>`, { sx: 19.9, sy: 3.9, ss: .85 }),

    discovery: duo('discovery', '#f2b344', '#fbc75f', `
      <path d="M20.2 13.2 13.4 20a2 2 0 0 1-2.8 0L3 12.4V3.4h9l8.2 8.2a1.9 1.9 0 0 1 0 2.6z" fill="G" fill-opacity=".14" stroke="G"/>
      <circle cx="7.4" cy="7.8" r="1.5" fill="C2" fill-opacity=".8" stroke="none"/>`, { sx: 19.4, sy: 5.2, ss: .9 }),

    links: duo('links', '#fb923c', '#fdba74', `
      <path d="M10 13.2a4.7 4.7 0 0 0 7.1.5l2.8-2.8a4.7 4.7 0 0 0-6.6-6.6l-1.6 1.6" stroke="G" stroke-width="1.7"/>
      <path d="M14 10.8a4.7 4.7 0 0 0-7.1-.5l-2.8 2.8a4.7 4.7 0 0 0 6.6 6.6l1.6-1.6" stroke="C2" stroke-width="1.7" opacity=".85"/>`, { sx: 19.8, sy: 18.9, ss: .85 }),

    tools: duo('tools', '#3b82f6', '#60a5fa', `
      <path d="M14.2 6.6a1 1 0 0 0 0 1.4l1.8 1.8a1 1 0 0 0 1.4 0l3.3-3.3a5.6 5.6 0 0 1-7.4 7.4l-6.6 6.6a2 2 0 0 1-2.8-2.8l6.6-6.6a5.6 5.6 0 0 1 7.4-7.4z" fill="G" fill-opacity=".14" stroke="G"/>
      <circle cx="5.9" cy="18.1" r=".95" fill="C2" stroke="none"/>`),

    cheatsheets: duo('cheatsheets', '#22d3ee', '#67e8f9', `
      <rect x="4" y="2.6" width="16" height="18.8" rx="2.2" fill="G" fill-opacity=".13" stroke="G"/>
      <path d="m7.4 8.2 2.4 2.2-2.4 2.2" stroke="C2"/>
      <path d="M11.8 12.6h4.6M7.6 16.6h8.8" stroke="G" opacity=".85"/>`, { sx: 16.6, sy: 5.4, ss: .75 }),

    games: duo('games', '#fb923c', '#fdba74', `
      <rect x="2.2" y="6.4" width="19.6" height="11.6" rx="4.4" fill="G" fill-opacity=".14" stroke="G"/>
      <path d="M7.6 10.2v4M5.6 12.2h4" stroke="G" stroke-width="1.7"/>
      <circle cx="15.6" cy="13.8" r="1.1" fill="C2" stroke="none"/>
      <circle cx="18.3" cy="11" r="1.1" fill="C1" fill-opacity=".85" stroke="none"/>`, { sx: 20.7, sy: 4.3, ss: .85 }),

    quiz: duo('quiz', '#22d3ee', '#67e8f9', `
      <circle cx="12" cy="12" r="8.4" fill="G" fill-opacity=".13" stroke="G"/>
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 3.7" stroke="C2" stroke-width="1.7"/>
      <circle cx="12" cy="17" r=".95" fill="C2" stroke="none"/>`, { sx: 20.9, sy: 4.4, ss: .8 }),

    humor: duo('humor', '#f2b344', '#fbc75f', `
      <circle cx="12" cy="12" r="8.4" fill="G" fill-opacity=".15" stroke="G"/>
      <path d="M7.8 13.2a4.4 4.4 0 0 0 8.4 0z" fill="C2" fill-opacity=".6" stroke="C2" stroke-width="1.2"/>
      <path d="M8.6 9.3h.01M15.4 9.3h.01" stroke="G" stroke-width="2.1"/>`, { sx: 20.9, sy: 4.4, ss: .8 }),

    photography: duo('photography', '#f2b344', '#fbc75f', `
      <path d="M22 18.6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.7a2 2 0 0 1 2-2h3.4L9.2 4h5.6l1.8 2.7H20a2 2 0 0 1 2 2z" fill="G" fill-opacity=".13" stroke="G"/>
      <circle cx="12" cy="13.4" r="3.9" stroke="C2" stroke-width="1.7"/>
      <circle cx="12" cy="13.4" r="1.4" fill="C2" fill-opacity=".7" stroke="none"/>
      <circle cx="18.7" cy="9.6" r=".8" fill="C2" stroke="none"/>`, { noSpark: true }),

    visual: duo('visual', '#f87171', '#fca5a5', `
      <rect x="3" y="3.6" width="18" height="16.8" rx="2.2" fill="G" fill-opacity=".12" stroke="G"/>
      <path d="M12 4v16M3.4 12h17.2" stroke="G" opacity=".8"/>
      <rect x="5.2" y="5.8" width="4.6" height="4" rx=".9" fill="C2" fill-opacity=".65" stroke="none"/>
      <path d="M14.6 16.4h2.8M14.6 18h1.6M5.6 15.2l1.5 1.5 2.4-2.6" stroke="C2" opacity=".9"/>`, { sx: 17.4, sy: 8, ss: .7 }),

    settings: duo('settings', '#94a3b8', '#cbd5e1', `
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="G" fill-opacity=".12" stroke="G"/>
      <circle cx="12" cy="12" r="2.6" fill="C2" fill-opacity=".35" stroke="C2" stroke-width="1.6"/>`, { noSpark: true }),

    feed: duo('feed', '#f87171', '#fca5a5', `
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" stroke="G" stroke-width="1.8"/>
      <circle cx="5" cy="19" r="1.4" fill="C2" stroke="none"/>`),

  };

  function icon(r, size) {
    const s = ICONS[r] || '';
    return size ? s.replace('width="17" height="17"', `width="${size}" height="${size}"`) : s;
  }

  /* ── WEATHER ICON SET ─────────────────────────────────────────────
     Same duotone language as the app icons (emoji weather glyphs were
     unreadable at small sizes on the dark theme). Maps WMO codes. */
  function wsvg(id, body) {
    return `<svg class="wi" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<defs>
<linearGradient id="wg-sun" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse"><stop stop-color="#fbbf24"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
<linearGradient id="wg-moon" x1="6" y1="4" x2="18" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#c7d2fe"/><stop offset="1" stop-color="#818cf8"/></linearGradient>
<linearGradient id="wg-cloud" x1="4" y1="8" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#cbd5e1"/><stop offset="1" stop-color="#7686a0"/></linearGradient>
<linearGradient id="wg-rain" x1="6" y1="14" x2="18" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#7dd3fc"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
</defs>${body}</svg>`;
  }
  const CLOUD = (y, sc) => `<path transform="translate(0 ${y || 0}) scale(${sc || 1})" d="M7 17.5a4 4 0 0 1-.6-7.95 5.2 5.2 0 0 1 10.1-1.1A4.1 4.1 0 0 1 16.6 17z" fill="url(#wg-cloud)" fill-opacity=".25" stroke="url(#wg-cloud)"/>`;
  const SUN_S = `<circle cx="17.2" cy="6.4" r="2.6" fill="url(#wg-sun)" fill-opacity=".35" stroke="url(#wg-sun)"/><path d="M17.2 1.8v1.3M21.8 6.4h-1.3M20.5 3.1l-.9.9M13.9 3.1l.9.9" stroke="url(#wg-sun)"/>`;
  const MOON_S = `<path d="M19.8 8.2a4.1 4.1 0 0 1-5-5 4.6 4.6 0 1 0 5 5z" fill="url(#wg-moon)" fill-opacity=".3" stroke="url(#wg-moon)"/>`;
  const DROPS = (n) => {
    const xs = [8.4, 12, 15.6].slice(0, n);
    return xs.map((x, i) => `<path d="M${x} 19.4v2.2" stroke="url(#wg-rain)" stroke-width="1.9"${i === 1 ? ' transform="translate(0 .6)"' : ''}/>`).join('');
  };
  const WICONS = {
    sun:     wsvg('sun', `<circle cx="12" cy="12" r="4.4" fill="url(#wg-sun)" fill-opacity=".35" stroke="url(#wg-sun)"/><path d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" stroke="url(#wg-sun)"/>`),
    moon:    wsvg('moon', `<path d="M20 13.6A8 8 0 1 1 10.4 4 6.4 6.4 0 0 0 20 13.6z" fill="url(#wg-moon)" fill-opacity=".28" stroke="url(#wg-moon)"/>`),
    partd:   wsvg('partd', SUN_S + CLOUD(1.5, .92)),
    partn:   wsvg('partn', MOON_S + CLOUD(1.5, .92)),
    cloud:   wsvg('cloud', CLOUD(1)),
    fog:     wsvg('fog', CLOUD(-2.5, .85) + `<path d="M5.5 16.5h13M7 19.2h10" stroke="url(#wg-cloud)" opacity=".8"/>`),
    drizzle: wsvg('drizzle', CLOUD(-1.5, .9) + DROPS(2)),
    rain:    wsvg('rain', CLOUD(-1.5, .9) + DROPS(3)),
    snow:    wsvg('snow', CLOUD(-1.5, .9) + `<path d="M8.4 20h.01M12 21h.01M15.6 20h.01" stroke="#a5f3fc" stroke-width="2.2"/>`),
    thunder: wsvg('thunder', CLOUD(-1.5, .9) + `<path d="M12.6 15.6 10.4 19h3l-2 3.4" stroke="url(#wg-sun)" stroke-width="1.7"/>`),
  };
  function weather(code, isDay, size) {
    const c = +code;
    let k = 'cloud';
    if (c === 0 || c === 1) k = isDay ? 'sun' : 'moon';
    else if (c === 2) k = isDay ? 'partd' : 'partn';
    else if (c === 3) k = 'cloud';
    else if (c === 45 || c === 48) k = 'fog';
    else if (c >= 51 && c <= 57) k = 'drizzle';
    else if ((c >= 61 && c <= 67) || c === 80 || c === 81 || c === 82) k = 'rain';
    else if ((c >= 71 && c <= 77) || c === 85 || c === 86) k = 'snow';
    else if (c >= 95) k = 'thunder';
    const s = WICONS[k];
    return size ? s.replace('width="22" height="22"', `width="${size}" height="${size}"`) : s;
  }

  return { icon, weather };
})();
window.AppIcons = AppIcons;
