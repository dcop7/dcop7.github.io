/* ══════════════════════════════════════════════════════════════════
   REALTIME EARTH — globe.gl 3D globe with live, toggleable data layers:
   earthquakes (USGS), tsunami flags, volcanoes / wildfires / severe storms
   (NASA EONET), real cloud imagery (NASA GIBS) and computed day/night.
   Optional time-travel to a past date.

   All sources are keyless + CORS-friendly. Visuals are real 3D objects
   (erupting volcano with smoke, flickering fire, rotating hurricane spiral,
   expanding seismic shockwaves), not flat markers.
══════════════════════════════════════════════════════════════════ */
const RealtimeEarth = (function () {
  'use strict';

  /* Bump on every meaningful change — logged on mount so we can confirm from the
     browser console exactly which build is actually running (rules out stale
     cached JS, the usual reason a fix "doesn't show up"). */
  const BUILD = 'v70 (2026-10-14 baked NASA textures · single reveal (no swap) · sRGB-correct shader · ocean glint · stars · live feed)';

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.min.js';
  const GLOBE_CDN = 'https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.min.js';

  /* The surface is ONE baked texture, shown once and never swapped. The old
     flow opened on a small bundled texture and ~5 s later crossfaded to a NASA
     download that looked different (bathymetry ridges, other ocean colour) —
     the "ao abrir mostra um fundo e passado 1-2 s muda" complaint. Now the
     globe stays hidden behind the loader until this texture is decoded, then
     fades in: what you first see is what stays.
     Both are baked offline by tools/earth/bake-day.py from NASA GIBS (public
     domain): Blue Marble shaded-relief land + a natural depth-shaded ocean,
     and VIIRS Black Marble city lights isolated into a luminance mask. */
  const TEX = {
    day:    { hi: 'assets/planets/earth-day-4k.jpg',    lo: 'assets/planets/earth-day-2k.jpg' },
    lights: { hi: 'assets/planets/earth-lights-4k.jpg', lo: 'assets/planets/earth-lights-2k.jpg' },
  };

  /* NASA GIBS WMS — one equirectangular image per date (EPSG:4326, 2:1).
     `px` = output width (height = px/2). Large for the static base imagery,
     smaller for the date-aware overlays that change often. */
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  function _gibsUrl(layer, date, fmt, px) {
    const W = px || 2048;
    const p = new URLSearchParams({
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer,
      CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: String(W), HEIGHT: String(W / 2),
      FORMAT: fmt || 'image/jpeg',
    });
    if (date) p.set('TIME', date);     /* omit for static layers (no time dim) */
    return `${GIBS}?${p.toString()}`;
  }

  /* (Cloud-free base imagery is now the baked local texture above — no
     runtime GIBS download for the base, so no swap and no "fica escuro".) */
  /* Clouds layer = NASA "VIIRS NOAA-20" true-colour. VIIRS has a wide enough swath
     for complete daily global coverage, so — unlike MODIS, whose narrow swath
     leaves slanted black ORBITAL GAPS in the daily mosaic ("nuvens cortadas") — it
     is gap-free. True-colour is already ~as bright as the base texture, so it gets
     only a gentle gamma lift. */
  const CLOUDS_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
  const CLOUDS_GAMMA = 0.92;

  /* Max anisotropy keeps the surface crisp at grazing angles (the horizon). */
  let _maxAniso = 8;
  function _aniso(tex) { if (tex) { tex.anisotropy = _maxAniso; tex.needsUpdate = true; } return tex; }

  /* True if an image is clearly brighter than black — used to reject a dark or
     error texture response before it can ever darken the globe. */
  function _isBright(img) {
    if (!img || !img.width) return false;
    try {
      const c = document.createElement('canvas'); c.width = 32; c.height = 16;
      const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, 32, 16);
      const d = cx.getImageData(0, 0, 32, 16).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return s / (d.length / 4) > 18;     /* mean brightness > ~18/255 */
    } catch (_) { return true; }           /* unsamplable (tainted) → assume ok */
  }

  /* Quality factor (1 = full; lower on small / low-end devices) → capped pixel
     ratio + fewer fire visuals, keeping the globe fluid on phones. */
  function _quality() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    if (small && (lowMem || lowCpu)) return 0.4;
    if (small) return 0.55;
    if (lowMem || lowCpu) return 0.75;
    return 1;
  }
  let _q = 1;
  function _pixelRatio() { return Math.min(window.devicePixelRatio || 1, _q < 0.6 ? 1.25 : 1.75); }

  /* ── Layers (order = toggle-bar order). `on` = default visibility. ── */
  const LAYERS = [
    { id: 'daynight', icon: '🌓', label: 'Dia/Noite',   on: true,  live: false },
    { id: 'quakes',   icon: '💢', label: 'Sismos',      on: true,  live: false },
    { id: 'tsunami',  icon: '🌊', label: 'Tsunamis',    on: false, live: false },
    { id: 'volcanoes',icon: '🌋', label: 'Vulcões',     on: true,  live: false },
    { id: 'fires',    icon: '🔥', label: 'Incêndios',   on: true,  live: false },
    { id: 'storms',   icon: '🌀', label: 'Tempestades', on: true,  live: false },
    { id: 'clouds',   icon: '☁️', label: 'Nuvens',      on: false, live: false },
  ];

  /* ── State ── */
  let _globe = null, _container = null, _mounted = false, _raf = null;
  let _on = {};                 /* layer id → bool */
  let _date = null;             /* null = now/live; else 'YYYY-MM-DD' */
  let _glowTex = null;
  let _shaderMat = null, _matUniforms = null, _sunTimer = null;
  let _volcanoes = [], _fires = [], _storms = [];
  let _quakeData = [];          /* {lat,lng,mag,tsunami,place,time,depth,url} */
  let _quakeMarks = [];         /* invisible hit spheres for quake hover/click */
  let _minMag = 4;              /* earthquake magnitude filter (default ≥4) */
  let _recencyDays = 7;         /* show EONET events active within N days */
  let _fireCap = 120;           /* hard safety cap on wildfire visuals */
  let _baseDayTex = null;       /* the baked day texture (cloud-free base) */
  let _stars = null;            /* background starfield (THREE.Points) */
  let _refreshT = null;         /* live-mode auto-refresh timer */
  let _sunAt = 0;               /* last per-frame sun refresh (ms) */
  let _tipDirty = true;         /* pointer/camera moved since the last pick */
  let _lastCam = '';            /* camera fingerprint, to detect auto-rotate/zoom */
  let _updatedAt = 0;           /* when the live data last loaded (ms) */
  let _loadSeq = 0;             /* guards against out-of-order async loads */
  let _tipEl = null, _ptr = null;   /* tooltip element + live pointer state */
  let _maxTexSize = 4096;       /* GPU max texture size (read from the renderer) */
  let _statusMsg = '';          /* last data-status text (restored after imagery loads) */
  let _imgLoads = 0;            /* nº of GIBS textures currently downloading */
  let _idleT = null;            /* timer that resumes the idle auto-rotate */
  const _texCache = new Map();  /* GIBS url → validated THREE.Texture (instant re-use) */

  /* ── Day/night shader. Lit by the dot of the WORLD-space surface normal with a
     WORLD-space sun direction (both from globe.gl's own getCoords/model frame —
     the same mapping the markers use). The normal comes from modelMatrix, not the
     camera, so the terminator is camera-independent and stays geographically
     correct under any zoom / drag / rotation. `dayNight` 0 = full daylight. */
  const VERT = `
    varying vec3 vWorldNormal; varying vec3 vWorldPos; varying vec2 vUv;
    void main(){ vWorldNormal = normalize(mat3(modelMatrix) * normal); vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp; }`;
  /* Textures are sampled RAW (no sRGB decode) and written raw, so the image
     appears exactly as baked. (The old shader decoded sRGB→linear on sample
     but never re-encoded on output — a hidden ~2.2 gamma darkening that was
     being "fixed" by hand with gamma 0.55. That was the real "fica escuro".)
     On top: soft day-side shading, a warm twilight band, a sun glint on open
     water, VIIRS city lights on the night side and a Fresnel atmosphere rim. */
  const FRAG = `
    uniform sampler2D dayTexture; uniform sampler2D prevDayTexture;
    uniform sampler2D nightTexture;
    uniform vec3 sunDirection; uniform float dayNight;
    uniform float dayGamma; uniform float prevGamma; uniform float texMix;
    varying vec3 vWorldNormal; varying vec3 vWorldPos; varying vec2 vUv;
    void main(){
      vec3 n = normalize(vWorldNormal);
      vec3 L = normalize(sunDirection);
      vec3 V = normalize(cameraPosition - vWorldPos);
      float i = dot(n, L);
      vec3 dayNew = pow(texture2D(dayTexture, vUv).rgb, vec3(dayGamma));
      vec3 dayOld = pow(texture2D(prevDayTexture, vUv).rgb, vec3(prevGamma));
      /* Imagery swaps (clouds toggle / date change) CROSSFADE, never pop. */
      vec3 day = mix(dayOld, dayNew, texMix);

      /* Open water = blue-dominant pixels → specular sun glint there only. */
      float water = smoothstep(0.015, 0.09, day.b - max(day.r, day.g * 0.9));
      vec3 H = normalize(L + V);
      float nh = max(dot(n, H), 0.0);
      float glint = pow(nh, 220.0) * 0.38 + pow(nh, 40.0) * 0.05;
      float shade = mix(0.80, 1.06, smoothstep(-0.05, 0.75, i));       /* soft volume */
      float twilight = 1.0 - smoothstep(0.0, 0.30, abs(i + 0.03));     /* dusk band */
      vec3 dayLit = day * mix(1.0, shade, dayNight)
                  + vec3(1.0, 0.94, 0.82) * glint * water * step(0.0, i) * dayNight
                  + vec3(0.22, 0.09, 0.0) * twilight * dayNight * 0.55;

      /* Night: moonlit Earth (cool, dim but readable) + warm city lights. */
      float lights = texture2D(nightTexture, vUv).r;
      vec3 night = day * vec3(0.24, 0.30, 0.46) + vec3(1.0, 0.76, 0.45) * pow(lights, 0.85) * 1.55
                 + vec3(0.010, 0.016, 0.034);

      float blend = mix(1.0, smoothstep(-0.16, 0.22, i), dayNight);
      vec3 col = mix(night, dayLit, blend);

      /* Fresnel atmosphere rim — brighter on the lit limb, faint on the night side. */
      float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
      col += vec3(0.32, 0.58, 1.0) * fres * 0.42 * mix(1.0, mix(0.22, 1.0, blend), dayNight);
      gl_FragColor = vec4(col, 1.0);
    }`;

  /* Subsolar point (lat/lon where the Sun is overhead) — low-precision NOAA
     formula. Returns the Sun's geocentric declination + the longitude under it
     from GMST. (The previous version added an extra 180° to the ecliptic
     longitude, flipping the declination's sign → wrong hemisphere lit.) */
  function _sunPos() {
    const rad = Math.PI / 180;
    const n = Date.now() / 86400000 + 2440587.5 - 2451545.0;     /* days since J2000 */
    const L = 280.460 + 0.9856474 * n;                            /* mean longitude (deg) */
    const g = (357.528 + 0.9856003 * n) * rad;                    /* mean anomaly (rad) */
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;  /* ecliptic lon */
    const eps = (23.439 - 0.0000004 * n) * rad;                   /* obliquity */
    const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad;  /* deg */
    const gmst = (280.46061837 + 360.98564736629 * n) % 360;
    let lon = ((ra - gmst) % 360 + 540) % 360 - 180;
    return { lat: dec / rad, lon };
  }

  /* ── Utils ── */
  function _loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  async function _fetchJson(url, ms, retries) {
    const attempt = async () => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), ms || 12000);
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } finally { clearTimeout(tid); }
    };
    let lastErr;
    /* One quick retry by default — NASA EONET intermittently 503s, which left
       volcanoes/fires/storms empty on an unlucky first try. */
    for (let i = 0; i <= (retries == null ? 1 : retries); i++) {
      try { return await attempt(); }
      catch (e) { lastErr = e; if (i < (retries == null ? 1 : retries)) await new Promise(r => setTimeout(r, 1200)); }
    }
    throw lastErr;
  }
  function _ymd(d) { return d.toISOString().slice(0, 10); }
  /* Effective imagery date: chosen date, or yesterday for "now" (today's GIBS
     mosaic is usually still being assembled). */
  function _imageryDate() {
    if (_date) return _date;
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return _ymd(d);
  }
  /* Human-friendly absolute + relative time from an epoch-ms or ISO string. */
  function _fmtTime(t) {
    if (t == null) return '';
    const d = typeof t === 'number' ? new Date(t) : new Date(t);
    if (isNaN(d)) return String(t);
    const abs = d.toLocaleString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const diff = Date.now() - d.getTime();
    if (diff < 0 || diff > 1000 * 3600 * 24 * 400) return abs;
    const h = diff / 3600000;
    const rel = h < 1 ? `há ${Math.max(1, Math.round(diff / 60000))} min`
      : h < 48 ? `há ${Math.round(h)} h`
      : `há ${Math.round(h / 24)} dias`;
    /* Relative first ("há 3 dias"), then the exact date — quicker to grasp. */
    return `${rel} · ${abs}`;
  }
  function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* Build a uniform event-description object the tooltip + detail card share. */
  function _quakeMeta(q) {
    const sev = q.mag >= 6 ? 'forte' : q.mag >= 4.5 ? 'moderado' : 'ligeiro';
    return {
      kind: 'quake', icon: q.tsunami ? '🌊' : '💢',
      title: `${q.tsunami ? 'Sismo (alerta tsunami)' : 'Sismo'} · M ${q.mag.toFixed(1)}`,
      rows: [
        ['Magnitude', `${q.mag.toFixed(1)} (${sev})`],
        ['Local', q.place || '—'],
        q.depth != null && isFinite(q.depth) ? ['Profundidade', `${Math.round(q.depth)} km`] : null,
        ['Quando', _fmtTime(q.time)],
      ].filter(Boolean),
      url: q.url, urlLabel: 'Detalhes USGS',
    };
  }
  function _eonetMeta(d, kind) {
    const map = { volcano: ['🌋', 'Vulcão'], fire: ['🔥', 'Incêndio'], storm: ['🌀', 'Tempestade'] };
    const [icon, type] = map[kind] || ['📍', 'Evento'];
    return {
      kind, icon, title: `${type} · ${d.title || type}`,
      rows: [
        ['Tipo', type],
        d.sizeLabel && kind !== 'storm' ? ['Porte', d.sizeLabel] : null,
        d.mag != null ? ['Intensidade', kind === 'storm' && /kts/i.test(d.magUnit || '') ? `${_stormClass(d.mag).name} · ${Math.round(d.mag * 1.852)} km/h` : `${d.mag} ${d.magUnit || ''}`.trim()] : null,
        kind === 'storm' && d.track ? ['Trajeto', `${d.track.length} posições registadas`] : null,
        d.startMs ? ['Início', _fmtTime(d.startMs)] : null,
        d.lastMs ? ['Última atividade', _fmtTime(d.lastMs)] : null,
        ['Coords', `${d.lat.toFixed(2)}°, ${d.lng.toFixed(2)}°`],
      ].filter(Boolean),
      url: d.url, urlLabel: 'Mais informação (NASA EONET)',
    };
  }
  /* Decorative parts (glow sprites, smoke, lava) should never be hover targets —
     only a small invisible hit sphere is. Otherwise a huge additive glow would
     keep the tooltip showing across a wide area / "stuck". */
  const _noRay = function () {};
  function _addHit(group, radius, y) {
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    if (y) hit.position.y = y;
    group.add(hit);
    return hit;
  }
  function _glowTexture() {
    if (_glowTex) return _glowTex;
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _glowTex = new THREE.CanvasTexture(cv); return _glowTex;
  }

  /* ═════════════════════════════ MOUNT ══════════════════════════════ */
  async function mount(container) {
    _container = container;
    LAYERS.forEach(l => { if (!(l.id in _on)) _on[l.id] = l.on; });

    container.innerHTML = `
      <div class="ex-rt-wrap">
        <div id="rt-globe" class="ex-rt-globe"></div>
        <div class="ex-loading" id="rt-loading">
          <div class="ex-loading-spinner"></div>
          <div class="ex-loading-text" id="rt-loading-txt">A preparar a Terra…</div>
        </div>

        <div class="ex-rt-layers" id="rt-layers">
          ${LAYERS.map(l => `<button class="ex-rt-chip${_on[l.id] ? ' on' : ''}" data-layer="${l.id}" title="${l.label}" aria-pressed="${_on[l.id] ? 'true' : 'false'}" aria-label="${l.label}">
            <span class="ex-rt-chip-ic">${l.icon}</span><span class="ex-rt-chip-lbl">${l.label}</span><span class="ex-rt-chip-n" data-n="${l.id}"></span></button>`).join('')}
        </div>

        <div class="ex-rt-time" id="rt-time">
          <button class="ex-rt-now on" id="rt-now">● Agora</button>
          <button class="ex-rt-now ex-rt-step" id="rt-prev" title="Dia anterior" aria-label="Dia anterior">‹</button>
          <button class="ex-rt-now" id="rt-date-btn" title="Escolher data">📅 <span id="rt-date-lbl">Data</span></button>
          <button class="ex-rt-now ex-rt-step" id="rt-next" title="Dia seguinte" aria-label="Dia seguinte" disabled>›</button>
          <input type="date" class="ex-rt-date-native" id="rt-date" lang="pt-PT" max="${_ymd(new Date())}"/>
          <button class="ex-rt-now" id="rt-filters-btn" title="Filtros" aria-expanded="false">⚙ Filtros</button>
          <button class="ex-rt-now" id="rt-feed-btn" title="Eventos em destaque" aria-expanded="false" aria-controls="rt-feed">☰ Destaques</button>
          <span class="ex-rt-status" id="rt-status"></span>
        </div>

        <div class="ex-rt-filters" id="rt-filters" hidden>
          <label class="ex-rt-filter-row">
            <span>💢 Sismos · magnitude ≥ <b id="rt-mag-val">${_minMag.toFixed(1)}</b></span>
            <input type="range" id="rt-mag" min="2.5" max="7" step="0.5" value="${_minMag}"/>
          </label>
          <label class="ex-rt-filter-row">
            <span>🌋🔥🌀 Atividade · <b id="rt-days-val">${_daysLabel(_recencyDays)}</b></span>
            <input type="range" id="rt-days" min="1" max="31" step="1" value="${_recencyDays}"/>
          </label>
          <div class="ex-rt-filter-note">Arrasta até ao fim (“tudo ativo”) para mostrar todos os eventos em curso; mais intensos aparecem maiores.</div>
        </div>

        <aside class="ex-rt-feed" id="rt-feed" aria-label="Eventos em destaque" hidden>
          <div class="ex-rt-feed-head">
            <div><div class="ex-rt-feed-title">Agora no planeta</div><div class="ex-rt-feed-sub" id="rt-feed-sub"></div></div>
            <button class="ex-rt-card-close" id="rt-feed-close" title="Fechar" aria-label="Fechar destaques">✕</button>
          </div>
          <div class="ex-rt-feed-list" id="rt-feed-list"><div class="ex-rt-feed-empty">A carregar eventos…</div></div>
        </aside>
        <div class="ex-rt-legend" id="rt-legend"></div>
        <div class="ex-rt-tooltip" id="rt-tooltip" hidden></div>
        <div class="ex-rt-detail" id="rt-detail" hidden></div>
        <div class="ex-solar-credit">Dados: USGS · NASA EONET · NASA GIBS</div>
      </div>`;

    _mounted = true; _active = true;
    console.info('%c[RealtimeEarth] build ' + BUILD, 'color:#7fb2ff;font-weight:700');
    _wireControls();

    const setTxt = t => { const e = document.getElementById('rt-loading-txt'); if (e) e.textContent = t; };
    try {
      setTxt('A carregar bibliotecas 3D…');
      await _loadScript(THREE_CDN);
      await _loadScript(GLOBE_CDN);
    } catch (e) {
      const ld = document.getElementById('rt-loading');
      if (ld) ld.innerHTML = `<div class="ex-error-icon">⚠</div><div class="ex-error-msg">Erro ao carregar o globo 3D.<br>Verifica a ligação à internet.</div>`;
      return;
    }
    if (typeof Globe === 'undefined') return;

    const ready = _initGlobe();
    _start();
    _reloadAll();                       /* live data loads while the texture decodes */
    _startRefresh();
    await ready;                        /* reveal only once the real surface is in */
    _reveal();
    /* Once the initial load settles, silently warm the clouds mosaic so the
       first ☁️ toggle shows instantly instead of after a multi-second download. */
    setTimeout(_prefetchClouds, 5000);
  }

  /* World-space direction toward the Sun, via globe.gl's getCoords so it is in
     the exact same frame as the globe surface (and the markers). Camera-
     independent, so the terminator never shifts on zoom/drag. */
  function _updateSun() {
    if (!_matUniforms || !_globe || !_globe.getCoords) return;
    const s = _sunPos();
    const c = _globe.getCoords(s.lat, s.lon, 0);
    if (c) _matUniforms.sunDirection.value.set(c.x, c.y, c.z).normalize();
  }
  function _startSunTimer() { if (!_sunTimer) { _updateSun(); _sunTimer = setInterval(_updateSun, 30000); } }

  function resume() {
    _active = true;
    _startRefresh();
    if (_globe) {
      const e = document.getElementById('rt-globe'); if (e) _globe.width(e.clientWidth).height(e.clientHeight);
      try { _globe.resumeAnimation(); } catch (_) {}
    }
    if (!_raf) _start();
    _startSunTimer();
  }
  function stop() {
    _active = false;
    if (_refreshT) { clearInterval(_refreshT); _refreshT = null; }
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_sunTimer) { clearInterval(_sunTimer); _sunTimer = null; }
    if (_idleT) { clearTimeout(_idleT); _idleT = null; }
    if (_globe) { try { _globe.pauseAnimation(); } catch (_) {} }   /* stop globe.gl's render loop while hidden */
  }

  /* Live mode re-fetches every 10 min so "tempo real" stays true while the tab
     sits open (skipped for archive dates and while the page is hidden). */
  function _startRefresh() {
    if (_refreshT) return;
    _refreshT = setInterval(() => {
      if (_active && !_date && !document.hidden) _reloadAll(true);
    }, 600000);
  }
  /* Don't burn GPU/battery rendering a globe nobody can see. */
  let _active = false;
  document.addEventListener('visibilitychange', () => {
    if (!_globe || !_active) return;
    if (document.hidden) {
      if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
      try { _globe.pauseAnimation(); } catch (_) {}
    } else {
      try { _globe.resumeAnimation(); } catch (_) {}
      if (!_raf) _start();
    }
  });

  /* ═════════════════════════════ GLOBE ══════════════════════════════ */
  function _initGlobe() {
    const el = document.getElementById('rt-globe');
    const W = el.clientWidth || 800, H = el.clientHeight || 600;

    /* animateIn:false — globe.gl's built-in intro animation runs its OWN
       point-of-view transition over the first few seconds, which overrides our
       pointOfView() call and slowly swung the camera off the daylit side onto
       the terminator — exactly the "goes dark a few seconds after opening,
       without touching anything" bug. We control the POV ourselves instead. */
    _globe = Globe({ animateIn: false })(el)
      .width(W).height(H)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#7fb2ff').atmosphereAltitude(0.16)
      .ringsData([]).ringColor(d => d.color).ringMaxRadius(d => d.maxR)
      .ringPropagationSpeed(d => d.speed).ringRepeatPeriod(d => d.repeat)
      .ringAltitude(0.008);

    /* Know the GPU's max anisotropy so textures stay sharp near the horizon,
       and cap the pixel ratio + event budget on small / low-end devices. */
    _q = _quality();
    try {
      const r = _globe.renderer();
      _maxAniso = r.capabilities.getMaxAnisotropy() || 8;
      _maxTexSize = r.capabilities.maxTextureSize || 4096;
      r.setPixelRatio(_pixelRatio());
    } catch (_) {}
    if (_q < 0.6) _fireCap = 60;
    else if (_q < 0.8) _fireCap = 90;

    /* Day/night shader material. Until the baked textures are decoded the
       globe stays hidden behind the loader (see _reveal), so no placeholder
       surface is ever visible and nothing swaps afterwards. */
    const blank = new THREE.DataTexture(new Uint8Array([6, 12, 26, 255]), 1, 1);
    blank.needsUpdate = true;
    _matUniforms = {
      dayTexture: { value: blank }, nightTexture: { value: blank },
      prevDayTexture: { value: blank }, prevGamma: { value: 1.0 },
      texMix: { value: 1.0 },          /* 1 = fully on the current texture */
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      dayNight: { value: _on.daynight ? 1 : 0 },
      dayGamma: { value: 1.0 },
    };
    const ready = _loadSurface();
    _shaderMat = new THREE.ShaderMaterial({ uniforms: _matUniforms, vertexShader: VERT, fragmentShader: FRAG });
    try { _globe.globeMaterial(_shaderMat); } catch (_) {}
    _updateSun();   /* set the initial sun direction */
    _addStars();

    /* Open on the daylit side, nudged ~56° east of the subsolar point so the
       evening terminator (and the first city lights) sit on the right limb —
       mostly bright, but the day/night layer reads at a glance. */
    const sp0 = _sunPos();
    _globe.pointOfView({ lat: Math.max(-35, Math.min(40, sp0.lat + 18)), lng: sp0.lon + 56, altitude: 2.3 }, 0);

    /* Keep the terminator anchored to the real Sun. */
    _startSunTimer();

    /* Gentle idle auto-rotate so the globe feels alive without input. Any
       interaction (drag/zoom/tap) pauses it; it resumes after 15s of quiet. */
    try {
      const c = _globe.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.35;
      c.enableDamping = true; c.dampingFactor = 0.08;
      c.minDistance = 112; c.maxDistance = 1100;   /* stay inside the starfield */
      const cam = _globe.camera(); if (cam.far < 9000) { cam.far = 9000; cam.updateProjectionMatrix(); }
    } catch (_) {}
    el.addEventListener('pointerdown', _pauseAutoRotate);
    el.addEventListener('wheel', _pauseAutoRotate, { passive: true });

    new ResizeObserver(() => {
      if (!_globe) return; const e = document.getElementById('rt-globe'); if (!e) return;
      _globe.width(e.clientWidth).height(e.clientHeight);
    }).observe(el);

    _wireHover(el);
    return ready;
  }

  /* 4K surface on desktop-class GPUs, 2K on phones / low-end / data-saver.
     localStorage 'rt-tex' = 'hi' | 'lo' forces one (debug/testing). */
  function _useHiTex() {
    let force = null; try { force = localStorage.getItem('rt-tex'); } catch (_) {}
    if (force === 'hi' || force === 'lo') return force === 'hi';
    const save = navigator.connection && navigator.connection.saveData;
    return !save && _q >= 0.75 && _maxTexSize >= 8192;
  }
  function _loadTex(url) {
    return new Promise(res => {
      const tl = new THREE.TextureLoader();
      tl.load(url, t => res(_aniso(t)), undefined, () => res(null));
    });
  }
  /* Load the baked day + city-lights textures (hi → lo → legacy fallback). */
  async function _loadSurface() {
    const hi = _useHiTex();
    let [day, lights] = await Promise.all([
      _loadTex(hi ? TEX.day.hi : TEX.day.lo), _loadTex(hi ? TEX.lights.hi : TEX.lights.lo)]);
    if (!day && hi) day = await _loadTex(TEX.day.lo);
    if (!day) day = await _loadTex('assets/planets/earth_atmos_2048.jpg');
    if (!lights && hi) lights = await _loadTex(TEX.lights.lo);
    if (!_matUniforms) return;
    if (lights) _matUniforms.nightTexture.value = lights;
    if (day) {
      _baseDayTex = day;
      /* Clouds may already be on (re-mount): let the cloud imagery win. */
      if (!_on.clouds || _matUniforms.dayTexture.value.isDataTexture) {
        _matUniforms.dayTexture.value = day; _matUniforms.prevDayTexture.value = day;
        _matUniforms.dayGamma.value = 1.0; _matUniforms.texMix.value = 1.0;
      }
      if (_on.clouds) _applyBaseTexture();
    }
  }
  /* Fade the finished globe in (CSS) and drop the loader. */
  function _reveal() {
    document.getElementById('rt-loading')?.remove();
    const el = document.getElementById('rt-globe');
    if (el) requestAnimationFrame(() => el.classList.add('is-ready'));
  }

  /* Static starfield far behind the globe: three point layers of decreasing
     count / increasing size, tinted blue-white to warm. Never pickable. */
  function _addStars() {
    if (_stars || !_globe) return;
    const grp = new THREE.Group();
    const tiers = [[_q < 0.6 ? 900 : 2000, 1.2, 0.55], [_q < 0.6 ? 260 : 520, 1.9, 0.8], [_q < 0.6 ? 50 : 110, 2.8, 1]];
    for (const [N, size, alpha] of tiers) {
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        let x, y, z, d;
        do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; d = x * x + y * y + z * z; } while (d > 1 || d < 0.01);
        const r = (3200 + Math.random() * 2400) / Math.sqrt(d);
        pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
        const t = Math.random(), b = 0.45 + Math.random() * 0.55;
        col[i * 3]     = b * (t < 0.2 ? 0.75 : t > 0.85 ? 1.0 : 0.92);
        col[i * 3 + 1] = b * (t < 0.2 ? 0.85 : t > 0.85 ? 0.88 : 0.95);
        col[i * 3 + 2] = b * (t < 0.2 ? 1.0 : t > 0.85 ? 0.7 : 1.0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({
        size, sizeAttenuation: false, vertexColors: true, map: _glowTexture(),
        transparent: true, opacity: alpha, depthWrite: false }));
      pts.raycast = _noRay;
      grp.add(pts);
    }
    _stars = grp;
    _scene().add(grp);
  }

  function _pauseAutoRotate() {
    try { _globe.controls().autoRotate = false; } catch (_) {}
    clearTimeout(_idleT);
    _idleT = setTimeout(() => { try { _globe.controls().autoRotate = true; } catch (_) {} }, 15000);
  }

  /* Smoothly fly the camera to an event when it is clicked — the detail card
     opens with its subject centred instead of wherever the globe happened to be. */
  function _flyTo(lat, lng) {
    if (!_globe || lat == null) return;
    _pauseAutoRotate();
    let alt = 2.4;
    try { alt = _globe.pointOfView().altitude || 2.4; } catch (_) {}
    _globe.pointOfView({ lat, lng, altitude: Math.min(alt, 1.7) }, 850);
  }

  /* Position + orient an object on the globe surface. axis 'y' points outward
     (volcano/fire), axis 'z' lies tangent (hurricane disc). */
  function _orient(obj, lat, lng, alt, axis) {
    const c = _globe.getCoords(lat, lng, alt == null ? 0.005 : alt);
    const v = new THREE.Vector3(c.x, c.y, c.z);
    obj.position.copy(v);
    const a = axis === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    obj.quaternion.setFromUnitVectors(a, v.clone().normalize());
  }
  function _scene() { return _globe.scene(); }

  /* ═════════════════════════════ VISUALS ════════════════════════════ */
  /* Erupting volcano, sized by significance: a basalt cone, a glowing crater,
     a fountain of lava bombs, and a tall rising smoke/ash plume. */
  function _buildVolcano(d) {
    const g = new THREE.Group();
    /* Size bucket from the activity-significance proxy: small · medium · large.
       (EONET has no physical size, so longevity/track-length stands in for it.) */
    const sig = d.signif || 0;
    const lvl = sig >= 0.6 ? 2 : sig >= 0.3 ? 1 : 0;
    d.sizeLabel = ['pequeno', 'médio', 'grande'][lvl];
    const S = [2.2, 3.6, 5.4][lvl];
    const qf = _q < 0.7 ? 0.6 : 1;                    /* fewer particles on weak devices */

    /* Stratovolcano profile: a broad lower flank + a steeper summit cone. */
    const lower = new THREE.Mesh(new THREE.ConeGeometry(1.75 * S, 1.7 * S, 26, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x3a2e26, side: THREE.DoubleSide }));
    lower.position.y = 0.85 * S; g.add(lower);
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.95 * S, 1.5 * S, 26, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x4c3b30, side: THREE.DoubleSide }));
    upper.position.y = 2.05 * S; g.add(upper);

    /* Glowing crater rim + molten vent + additive heat bloom. */
    const crater = new THREE.Mesh(new THREE.TorusGeometry(0.52 * S, 0.15 * S, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xff5314 }));
    crater.position.y = 2.78 * S; crater.rotation.x = Math.PI / 2; g.add(crater);
    const vent = new THREE.Mesh(new THREE.SphereGeometry(0.4 * S, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xffc23a }));
    vent.position.y = 2.74 * S; g.add(vent);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: 0xff4a00, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(5 * S); glow.position.y = 3 * S; g.add(glow);

    /* Lava fountain — incandescent bombs on parabolic arcs (more for bigger ones). */
    const LN = Math.round((26 + lvl * 22) * qf);
    const lpos = new Float32Array(LN * 3), lprog = new Float32Array(LN), lspd = new Float32Array(LN), lang = new Float32Array(LN);
    for (let i = 0; i < LN; i++) { lprog[i] = Math.random(); lspd[i] = 0.5 + Math.random() * 0.7; lang[i] = Math.random() * Math.PI * 2; }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const lava = new THREE.Points(lg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0xff7a18, size: 1.1 * S, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(lava);

    /* Glowing lava creeping down the flanks (bright points descending the cone). */
    const RN = Math.round((10 + lvl * 8) * qf);
    const rpos = new Float32Array(RN * 3), rprog = new Float32Array(RN), rang = new Float32Array(RN), rspd = new Float32Array(RN);
    for (let i = 0; i < RN; i++) { rprog[i] = Math.random(); rang[i] = Math.random() * Math.PI * 2; rspd[i] = 0.12 + Math.random() * 0.18; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    const streaks = new THREE.Points(rg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0xff3b08, size: 0.85 * S, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(streaks);

    /* Ash plume — a column that widens as it rises (mushroom), colour fading from
       dark ash at the base to pale grey at the top via per-vertex colour. */
    const N = Math.round((50 + lvl * 40) * qf);
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), prog = new Float32Array(N), pph = new Float32Array(N);
    for (let i = 0; i < N; i++) { prog[i] = Math.random(); pph[i] = Math.random() * Math.PI * 2; }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ map: _glowTexture(), size: 2.6 * S, vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    g.add(smoke);

    /* Decoration is non-interactive; a small invisible sphere is the hit target. */
    [lower, upper, crater, vent, glow, lava, streaks, smoke].forEach(o => { o.raycast = _noRay; });
    _addHit(g, 2.0 * S, 1.8 * S);
    g.userData = { smoke, prog, pph, N, lava, lprog, lspd, lang, LN, streaks, rprog, rang, rspd, RN, vent, crater, glow, S, d, meta: _eonetMeta(d, 'volcano'), lat: d.lat, lng: d.lng, alt: 0, axis: 'y' };
    _orient(g, d.lat, d.lng, 0, 'y');
    _scene().add(g);
    _volcanoes.push(g);
  }

  /* Wildfire: a flickering cluster of additive flame sprites. */
  /* Wildfire, sized by significance: a cluster of additive flame sprites with a
     rising smoke plume — big enough to read as a real fire front, not a speck. */
  function _buildFire(d) {
    const g = new THREE.Group();
    const cols = [0xff2a00, 0xff5a00, 0xffa81e];
    const S = 3.0 + (d.signif || 0) * 7.0;            /* overall scale */
    g.userData = { sprites: [], d, meta: _eonetMeta(d, 'fire'), lat: d.lat, lng: d.lng, alt: 0.002, axis: 'y' };
    const flames = 5;
    for (let i = 0; i < flames; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: cols[i % cols.length], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const base = S * (0.45 + Math.random() * 0.6);
      sp.scale.setScalar(base);
      sp.position.set((Math.random() - 0.5) * S * 0.7, base * 0.35, (Math.random() - 0.5) * S * 0.7);
      sp.userData = { base, ph: Math.random() * Math.PI * 2 };
      g.add(sp); g.userData.sprites.push(sp);
    }
    /* Fumo: três novelos que sobem, crescem e desvanecem em ciclo */
    g.userData.smoke = [];
    for (let i = 0; i < 3; i++) {
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: 0x6b6358, transparent: true, opacity: 0.3, depthWrite: false }));
      sm.userData = { p: i / 3 }; g.add(sm); g.userData.smoke.push(sm);
    }
    /* Fagulhas a subir */
    const EN = _q < 0.7 ? 10 : 18;
    const epos = new Float32Array(EN * 3), eprog = new Float32Array(EN), eang = new Float32Array(EN);
    for (let i = 0; i < EN; i++) { eprog[i] = Math.random(); eang[i] = Math.random() * Math.PI * 2; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    const embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0xffb347, size: S * 0.28, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(embers);
    Object.assign(g.userData, { S, embers, eprog, eang, EN });
    g.children.forEach(o => { o.raycast = _noRay; });
    _addHit(g, 1.5 * S, S * 0.5);
    _orient(g, d.lat, d.lng, 0.002, 'y');
    _scene().add(g);
    _fires.push(g);
  }

  /* ── Tempestades / furacões ──
     Antes: um disco plano com duas linhas em espiral. Agora:
     · textura procedimental com bandas de nuvens fofas, nuvem central densa
       e — nos mais fortes — olho limpo com parede do olho brilhante;
     · duas camadas que rodam a velocidades diferentes (o centro gira mais
       depressa) e uma sombra difusa no mar por baixo, para dar volume;
     · sentido real: anti-horário no hemisfério norte, horário no sul;
     · tamanho pela categoria de Saffir-Simpson (vento do EONET em nós);
     · o trajeto já percorrido desenhado no globo, a desvanecer para trás. */
  const _stormTex = {};
  function _stormClass(kts) {
    if (kts == null) return { cat: 0, name: 'Tempestade' };
    if (kts < 34) return { cat: 0, name: 'Depressão tropical' };
    if (kts < 64) return { cat: 0.5, name: 'Tempestade tropical' };
    const c = kts < 83 ? 1 : kts < 96 ? 2 : kts < 113 ? 3 : kts < 137 ? 4 : 5;
    return { cat: c, name: `Furacão cat. ${c}` };
  }
  function _hurricaneTexture(eye) {
    if (_stormTex[eye]) return _stormTex[eye];
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d'), R = S / 2;
    ctx.translate(R, R);
    let seed = eye ? 7 : 3;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const puff = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.55, `rgba(240,246,255,${a * 0.55})`); g.addColorStop(1, 'rgba(230,238,250,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    /* nuvem central densa */
    puff(0, 0, R * 0.42, 0.95);
    /* bandas em espiral logarítmica (sentido anti-horário visto de cima) */
    const ARMS = 4;
    for (let arm = 0; arm < ARMS; arm++) {
      const a0 = arm / ARMS * Math.PI * 2;
      for (let k = 0; k < 150; k++) {
        const t = k / 150, r = R * (0.12 + t * 0.86);
        /* (y do canvas aponta para baixo: ângulo a crescer = sentido horário à vista)
           para fora as bandas rodam no sentido horário, logo enrolam para dentro
           no anti-horário, como num ciclone do hemisfério norte */
        const ang = a0 + Math.log(r / (R * 0.12)) * 2.1 + (rnd() - 0.5) * 0.35;
        const w = R * (0.05 + t * 0.09) * (0.7 + rnd() * 0.6);
        const fade = Math.pow(1 - t, 1.3);
        puff(Math.cos(ang) * r, Math.sin(ang) * r, w, 0.16 + 0.5 * fade * (0.6 + rnd() * 0.4));
      }
    }
    /* fiapos soltos na periferia (fluxo de saída) */
    for (let i = 0; i < 90; i++) {
      const r = R * (0.55 + rnd() * 0.42), ang = rnd() * Math.PI * 2;
      puff(Math.cos(ang) * r, Math.sin(ang) * r, R * (0.03 + rnd() * 0.05), 0.08 + rnd() * 0.1);
    }
    if (eye) {
      /* parede do olho (anel brilhante) e o olho limpo */
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = R * 0.05;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.085, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.075);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.075, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    const tex = new THREE.CanvasTexture(cv);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    _stormTex[eye] = tex;
    return tex;
  }
  function _buildStorm(d) {
    const g = new THREE.Group();
    const cls = _stormClass(/kts/i.test(d.magUnit || '') ? d.mag : null);
    d.sizeLabel = cls.name;
    const D = 9 + (cls.cat || (d.signif || 0) * 2) * 2.6;       /* diâmetro em unidades do globo */
    const south = d.lat < 0, eye = cls.cat >= 2;
    const mat = (tex, op) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    /* sombra difusa no mar */
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(D * 0.46, 40),
      new THREE.MeshBasicMaterial({ map: _glowTexture(), color: 0x000814, transparent: true, opacity: 0.45, depthWrite: false }));
    shadow.position.set(D * 0.05, -D * 0.05, -0.15);
    g.add(shadow);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(D, D), mat(_hurricaneTexture(false), 0.78));
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(D * 0.62, D * 0.62), mat(_hurricaneTexture(eye), 0.92));
    inner.position.z = 0.25;
    if (south) { outer.scale.x = -1; inner.scale.x = -1; }   /* espelho: as bandas enrolam ao contrário */
    g.add(outer); g.add(inner);
    [shadow, outer, inner].forEach(o => { o.raycast = _noRay; });
    _addHit(g, D * 0.3, 0);
    g.userData = { disc: inner, outer, d, dir: south ? -1 : 1, ph: Math.random() * 6.28, meta: _eonetMeta(d, 'storm'), lat: d.lat, lng: d.lng, alt: 0.01, axis: 'z' };
    _orient(g, d.lat, d.lng, 0.01, 'z');
    if (d.track && d.track.length > 1) _stormTrack(g, d.track);
    _scene().add(g);
    _storms.push(g);
  }
  /* trajeto já percorrido: linha à superfície, do mais antigo (ténue) ao atual */
  function _stormTrack(g, track) {
    const pts = [], cols = [];
    g.updateMatrixWorld(true);
    const c0 = new THREE.Color(0x1e3a5f), c1 = new THREE.Color(0x9fe3ff), tmp = new THREE.Color();
    const n = track.length;
    for (let i = 0; i < n - 1; i++) {
      const [la0, lo0] = track[i], [la1, lo1] = track[i + 1];
      let dlo = lo1 - lo0; if (dlo > 180) dlo -= 360; if (dlo < -180) dlo += 360;
      for (let k = 0; k < 4; k++) {
        const f = k / 4, la = la0 + (la1 - la0) * f, lo = lo0 + dlo * f;
        const c = _globe.getCoords(la, lo, 0.004);
        pts.push(g.worldToLocal(new THREE.Vector3(c.x, c.y, c.z)));
        tmp.copy(c0).lerp(c1, (i + f) / (n - 1)); cols.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const cl = _globe.getCoords(track[n - 1][0], track[n - 1][1], 0.004);
    pts.push(g.worldToLocal(new THREE.Vector3(cl.x, cl.y, cl.z))); cols.push(c1.r, c1.g, c1.b);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    line.raycast = _noRay;
    g.add(line);
    /* pontos das posições registadas */
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(track.map(([la, lo]) => {
      const c = _globe.getCoords(la, lo, 0.005); return g.worldToLocal(new THREE.Vector3(c.x, c.y, c.z));
    })), new THREE.PointsMaterial({ map: _glowTexture(), color: 0xbfeaff, size: 1.3, transparent: true, opacity: 0.7, depthWrite: false }));
    dots.raycast = _noRay;
    g.add(dots);
  }

  function _clear(arr) {
    arr.forEach(o => {
      _scene().remove(o);
      o.traverse(n => {
        if (n.geometry) n.geometry.dispose();
        if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose());
        /* Shared textures (glow/spiral) are cached module-side — not disposed here. */
      });
    });
    arr.length = 0;
  }

  /* ═════════════════════════════ RINGS (quakes / tsunami) ═══════════ */
  function _applyRings() {
    if (!_globe) return;
    const data = [];
    const showQ = _on.quakes, showT = _on.tsunami;
    const shown = [];
    _quakeData.forEach(q => {
      if (q.mag < _minMag) return;                 /* magnitude filter */
      const isT = q.tsunami;
      if (isT && showT) {
        data.push({ lat: q.lat, lng: q.lng, maxR: 7 + q.mag, speed: 4, repeat: 700,
          color: t => `rgba(56,189,248,${1 - t})` });
        shown.push(q);
      } else if (showQ) {
        const c = q.mag >= 6 ? [255, 80, 80] : q.mag >= 4.5 ? [255, 160, 60] : [255, 220, 90];
        data.push({ lat: q.lat, lng: q.lng, maxR: Math.max(2, q.mag * 1.1), speed: 2 + q.mag * 0.2, repeat: 900,
          color: t => `rgba(${c[0]},${c[1]},${c[2]},${1 - t})` });
        shown.push(q);
      }
    });
    _globe.ringsData(data);
    _buildQuakeMarks(shown);
  }

  /* Invisible hit spheres at each shown quake so they can be hovered/clicked
     (the propagating rings themselves are not raycast targets). */
  function _buildQuakeMarks(quakes) {
    _clear(_quakeMarks);
    if (!_globe) return;
    quakes.forEach(q => {
      const r = Math.max(1.2, q.mag * 0.9);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      _orient(m, q.lat, q.lng, 0.004, 'y');
      m.userData = { meta: _quakeMeta(q), lat: q.lat, lng: q.lng, alt: 0.004, axis: 'y' };
      _scene().add(m);
      _quakeMarks.push(m);
    });
  }

  /* ═════════════════════════════ DATA LOADERS ══════════════════════ */
  function _status(msg) {
    _statusMsg = msg || '';
    const e = document.getElementById('rt-status');
    if (e && !_imgLoads) e.textContent = _statusMsg;   /* imagery feedback has priority */
  }

  async function _loadQuakes(seq) {
    try {
      let url;
      if (_date) {
        const end = new Date(_date + 'T23:59:59Z'), start = new Date(_date + 'T00:00:00Z');
        url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${_ymd(start)}&endtime=${_ymd(end)}&minmagnitude=4&orderby=magnitude&limit=400`;
      } else {
        url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
      }
      const j = await _fetchJson(url, 12000);
      if (seq !== _loadSeq) return;
      _quakeData = (j.features || []).map(f => ({
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
        depth: f.geometry.coordinates[2],
        mag: f.properties.mag || 0, tsunami: f.properties.tsunami === 1,
        place: f.properties.place || '', time: f.properties.time,
        url: f.properties.url || '',
      })).filter(q => isFinite(q.lat) && isFinite(q.lng));
    } catch (e) { if (seq === _loadSeq) _quakeData = []; }
    if (seq === _loadSeq) _applyRings();
  }

  /* NASA EONET events for a category → [{lat,lng,title}]. */
  async function _loadEonet(cat, seq) {
    try {
      let url = `https://eonet.gsfc.nasa.gov/api/v3/events?category=${cat}&limit=200`;
      if (_date) {
        const d = new Date(_date), end = new Date(d); end.setUTCDate(end.getUTCDate() + 1);
        const start = new Date(d); start.setUTCDate(start.getUTCDate() - 30);   /* events active around the date */
        url += `&status=all&start=${_ymd(start)}&end=${_ymd(end)}`;
      } else {
        url += '&status=open';
      }
      const j = await _fetchJson(url, 12000);
      if (seq !== _loadSeq) return [];
      return (j.events || []).map(ev => {
        const geom = (ev.geometry || []).filter(g => Array.isArray(g.coordinates) && g.coordinates.length >= 2);
        if (!geom.length) return null;
        const last = geom[geom.length - 1];       /* most recent track point */
        const src = (ev.sources || [])[0] || {};
        const startMs = geom[0].date ? Date.parse(geom[0].date) : null;
        const lastMs = last.date ? Date.parse(last.date) : null;
        /* Significance proxy: how long the event has been tracked + how many
           updates — longer-running events render bigger / more impactful. */
        const spanDays = startMs && lastMs ? (lastMs - startMs) / 86400000 : 0;
        const signif = Math.min(1, (geom.length - 1) / 12 * 0.6 + spanDays / 60 * 0.4);
        return {
          lng: last.coordinates[0], lat: last.coordinates[1], title: ev.title,
          startMs, lastMs, signif,
          mag: last.magnitudeValue != null ? last.magnitudeValue : null,
          magUnit: last.magnitudeUnit || '',
          track: geom.length > 1 ? geom.slice(-80).map(g => [g.coordinates[1], g.coordinates[0]]) : null,
          url: src.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${ev.id}`,
        };
      }).filter(Boolean).filter(e => isFinite(e.lat) && isFinite(e.lng));
    } catch (e) { return []; }
  }

  /* Reference time for "recency": the chosen date (end of day) or now. */
  function _refTime() { return _date ? Date.parse(_date + 'T23:59:59Z') : Date.now(); }
  /* Slider value 31 = "tudo ativo" (no recency window). */
  const _showAll = () => _recencyDays > 30;
  function _daysLabel(v) { return v > 30 ? 'tudo o que está ativo' : `últimos ${v} dia${v === 1 ? '' : 's'}`; }
  /* Keep only events still active within `_recencyDays` of the reference time,
     newest first. Removes long-stale EONET events (e.g. a 2021 volcano that is
     no longer erupting) so the globe shows what's actually active now — unless
     "tudo ativo" is selected, which keeps every currently-tracked event. */
  function _filterRecent(list) {
    const ref = _refTime(), win = _recencyDays * 86400000;
    return list
      .filter(e => e.lastMs == null || ((_showAll() || ref - e.lastMs <= win) && ref - e.lastMs >= -86400000))
      .sort((a, b) => (b.lastMs || 0) - (a.lastMs || 0));
  }

  /* ═════════════════════════════ GIBS IMAGERY ══════════════════════ */
  /* Imagery-download feedback: while any GIBS texture is in flight the status
     pill shows a pulsing "a carregar imagem de satélite…" instead of leaving
     the user staring at an unchanged globe for seconds. */
  function _imgLoadStart() { _imgLoads++; _syncImgStatus(); }
  function _imgLoadEnd() { _imgLoads = Math.max(0, _imgLoads - 1); _syncImgStatus(); }
  function _syncImgStatus() {
    const e = document.getElementById('rt-status'); if (!e) return;
    if (_imgLoads > 0) { e.classList.add('loading'); e.textContent = '🛰 a carregar imagem de satélite…'; }
    else { e.classList.remove('loading'); e.textContent = _statusMsg; }
  }

  /* Load (or re-use) a validated GIBS texture. Every downloaded texture is kept
     in `_texCache`, so toggling clouds off/on or revisiting a date is INSTANT —
     no re-download, no seconds-long wait. `silent` skips the status feedback
     (used by the background prefetch). cb(null) on failure/dark image. */
  function _loadGibsTexture(url, cb, silent) {
    const hit = _texCache.get(url);
    if (hit) { cb(hit); return; }
    if (!silent) _imgLoadStart();
    const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
    tl.load(url, tex => {
      if (!silent) _imgLoadEnd();
      if (!_isBright(tex.image)) { cb(null); return; }   /* dark/incomplete mosaic */
      _aniso(tex);     /* raw sampling (no sRGB decode) — see FRAG */
      _texCache.set(url, tex);
      cb(tex);
    }, undefined, () => { if (!silent) _imgLoadEnd(); cb(null); });
  }

  /* Swap the day texture with a ~1s shader crossfade (texMix 0→1, animated in
     _frame) instead of an abrupt pop — the old "outra imagem aparece de
     repente" complaint. No-op if the texture is already showing. */
  function _setDayTexture(tex, gamma) {
    if (!_matUniforms || !tex || _matUniforms.dayTexture.value === tex) return;
    _matUniforms.prevDayTexture.value = _matUniforms.dayTexture.value;
    _matUniforms.prevGamma.value = _matUniforms.dayGamma.value;
    _matUniforms.dayTexture.value = tex;
    _matUniforms.dayGamma.value = gamma;
    _matUniforms.texMix.value = 0;
  }

  function _cloudsUrl() { return _gibsUrl(CLOUDS_LAYER, _imageryDate(), 'image/jpeg', Math.min(4096, _maxTexSize)); }

  function _applyBaseTexture() {
    if (!_matUniforms) return;
    /* No clouds → the cached hi-res Blue Marble (or keep the local fallback). */
    if (!_on.clouds) {
      if (_baseDayTex) _setDayTexture(_baseDayTex, 1.0);
      return;
    }
    /* Clouds on → date-aware true-colour VIIRS mosaic (gap-free, unlike MODIS). */
    _loadGibsTexture(_cloudsUrl(), tex => {
      if (tex && _on.clouds) _setDayTexture(tex, CLOUDS_GAMMA);
    });
  }

  /* Warm the clouds mosaic for the current date in the background (after the
     initial load settles), so the first ☁️ toggle is instant instead of a
     multi-second download. Desktop-class devices only — no wasted MBs on 4G. */
  function _prefetchClouds() {
    if (_q < 0.75 || _on.clouds || _texCache.has(_cloudsUrl())) return;
    _loadGibsTexture(_cloudsUrl(), () => {}, true);
  }

  /* ═════════════════════════════ RELOAD ════════════════════════════ */
  async function _reloadAll(quiet) {
    const seq = ++_loadSeq;
    if (!quiet) _status('a carregar…');
    _applyBaseTexture();

    /* Quakes / tsunami share the USGS dataset. */
    if (_on.quakes || _on.tsunami) await _loadQuakes(seq); else { _quakeData = []; _applyRings(); }

    /* EONET layers. */
    _clear(_volcanoes); _clear(_fires); _clear(_storms);
    const jobs = [];
    if (_on.volcanoes) jobs.push(_loadEonet('volcanoes', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).forEach(_buildVolcano); }));
    if (_on.fires)     jobs.push(_loadEonet('wildfires', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).slice(0, _fireCap).forEach(_buildFire); }));
    if (_on.storms)    jobs.push(_loadEonet('severeStorms', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).forEach(_buildStorm); }));
    await Promise.all(jobs);

    if (seq === _loadSeq) { if (!_date) _updatedAt = Date.now(); _dataChanged(); }
  }

  /* Everything that summarises the loaded data: chip counts, status pill,
     legend and the "Agora no planeta" feed. */
  function _dataChanged() {
    _updateCounts();
    _status(_statusText());
    _updateLegend();
    _renderFeed();
  }
  function _shownQuakes() {
    return _quakeData.filter(q => q.mag >= _minMag && (q.tsunami ? (_on.tsunami || _on.quakes) : _on.quakes));
  }
  function _updateCounts() {
    const n = {
      quakes: _on.quakes ? _quakeData.filter(q => q.mag >= _minMag && !(q.tsunami && _on.tsunami)).length : null,
      tsunami: _on.tsunami ? _quakeData.filter(q => q.tsunami && q.mag >= _minMag).length : null,
      volcanoes: _on.volcanoes ? _volcanoes.length : null,
      fires: _on.fires ? _fires.length : null,
      storms: _on.storms ? _storms.length : null,
    };
    document.querySelectorAll('#rt-layers .ex-rt-chip-n').forEach(el => {
      const v = n[el.dataset.n];
      el.textContent = v == null ? '' : String(v);
      el.hidden = v == null;
    });
  }
  function _statusText() {
    if (_date) { const [y, m, d] = _date.split('-'); return `Arquivo · ${d}/${m}/${y}`; }
    if (!_updatedAt) return '';
    return 'Ao vivo · ' + new Date(_updatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }
  function _rel(ms) {
    if (!ms) return '';
    const m = Math.max(1, Math.round((_refTime() - ms) / 60000));
    if (m < 60) return `há ${m} min`;
    if (m < 48 * 60) return `há ${Math.round(m / 60)} h`;
    return `há ${Math.round(m / 1440)} d`;
  }
  /* "Agora no planeta": the most notable events per layer, each one a button
     that flies the camera there and opens its detail card. */
  function _renderFeed() {
    const list = document.getElementById('rt-feed-list'); if (!list) return;
    const sub = document.getElementById('rt-feed-sub');
    if (sub) sub.textContent = _date ? 'Eventos à data escolhida' : 'Os eventos mais relevantes agora';
    const groups = [];
    const qs = _shownQuakes().sort((a, b) => b.mag - a.mag).slice(0, 6);
    if (qs.length) groups.push(['Sismos mais fortes', qs.map(q => ({
      icon: q.tsunami ? '🌊' : '💢', badge: q.mag.toFixed(1),
      tone: q.mag >= 6 ? 'hi' : q.mag >= 4.5 ? 'mid' : 'lo',
      title: (q.place || 'Local desconhecido').replace(/^\d+\s*km\s+[NSEW]{1,3}\s+of\s+/i, ''),
      sub: _rel(q.time) + (q.depth != null && isFinite(q.depth) ? ` · ${Math.round(q.depth)} km prof.` : ''),
      lat: q.lat, lng: q.lng, meta: _quakeMeta(q) }))]);
    const ev = (arr, label, icon, n) => {
      const items = arr.map(g => g.userData).filter(u => u && u.d)
        .sort((a, b) => (b.d.signif || 0) - (a.d.signif || 0) || (b.d.lastMs || 0) - (a.d.lastMs || 0))
        .slice(0, n).map(u => ({
          icon, title: u.d.title || label, sub: _rel(u.d.lastMs) + (u.d.sizeLabel ? (u.meta && u.meta.kind === 'storm' ? ` · ${u.d.sizeLabel}` : ` · porte ${u.d.sizeLabel}`) : ''),
          lat: u.lat, lng: u.lng, meta: u.meta }));
      if (items.length) groups.push([label, items]);
    };
    if (_on.storms) ev(_storms, 'Tempestades ativas', '🌀', 5);
    if (_on.volcanoes) ev(_volcanoes, 'Vulcões em atividade', '🌋', 5);
    if (_on.fires) ev(_fires, 'Grandes incêndios', '🔥', 5);
    list.__items = [];
    if (!groups.length) {
      list.innerHTML = '<div class="ex-rt-feed-empty">Sem eventos para as camadas e filtros ativos.</div>';
      return;
    }
    list.innerHTML = groups.map(([label, items]) => `
      <div class="ex-rt-feed-grp">${_esc(label)}</div>
      ${items.map(it => { const i = list.__items.push(it) - 1; return `
        <button class="ex-rt-feed-it" data-i="${i}">
          <span class="ex-rt-feed-ic${it.tone ? ' ' + it.tone : ''}">${it.badge ? _esc(it.badge) : it.icon}</span>
          <span class="ex-rt-feed-tx"><span class="ex-rt-feed-t">${_esc(it.title)}</span><span class="ex-rt-feed-s">${_esc(it.sub)}</span></span>
        </button>`; }).join('')}`).join('');
  }

  /* Bottom-left key: what the quake ring colours mean (the chips already name
     the layers, so the old icon list was redundant). */
  function _updateLegend() {
    const el = document.getElementById('rt-legend');
    if (!el) return;
    const parts = [];
    if (_on.quakes) parts.push(`<span class="ex-rt-leg-t">Sismos</span>
      <span class="ex-rt-leg"><i style="background:#ffdc5a"></i>&lt; 4,5</span>
      <span class="ex-rt-leg"><i style="background:#ffa03c"></i>4,5–6</span>
      <span class="ex-rt-leg"><i style="background:#ff5050"></i>≥ 6</span>`);
    if (_on.tsunami) parts.push(`<span class="ex-rt-leg"><i style="background:#38bdf8"></i>alerta de tsunami</span>`);
    if (_on.daynight) parts.push(`<span class="ex-rt-leg"><i class="ex-rt-leg-sun"></i>dia · noite em tempo real</span>`);
    el.innerHTML = parts.join('<span class="ex-rt-leg-sep"></span>');
  }

  /* ═════════════════════════════ ANIMATION ═════════════════════════ */
  function _start() {
    let last = performance.now();
    const tick = () => {
      _raf = requestAnimationFrame(tick);
      const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;
      /* Tooltip FIRST and isolated, so an error in the marker animation below can
         never stop it from hiding (which would leave a "stuck" popup). It also
         runs from pointer events directly — this rAF pass is just a backstop. */
      try {
        const c = _globe && _globe.camera();
        if (c) {
          const f = c.position.x.toFixed(1) + ',' + c.position.y.toFixed(1) + ',' + c.position.z.toFixed(1);
          if (f !== _lastCam) { _lastCam = f; _tipDirty = true; }
        }
        if (_tipDirty) _updateTooltip();
      } catch (_) {}
      try { _frame(t, dt); } catch (_) {}
      last = t;
    };
    _raf = requestAnimationFrame(tick);
  }

  function _frame(t, dt) {
      /* (No per-frame re-pinning: globe.gl moves the CAMERA, the globe and
         every marker stay fixed in world space — positions are set once at
         build time.) The sun direction is re-derived once a second: cheap, and
         it self-heals if globe.gl wasn't ready for getCoords() at mount. */
      if (t - _sunAt > 1000) { _sunAt = t; _updateSun(); }

      /* Advance the day-texture crossfade (~1s from old imagery to new). */
      if (_matUniforms && _matUniforms.texMix.value < 1) {
        _matUniforms.texMix.value = Math.min(1, _matUniforms.texMix.value + dt * 1.1);
      }

      /* Volcano: mushrooming ash plume (dark→pale), arcing lava fountain, lava
         creeping down the flanks, and a pulsing molten crater. */
      for (const v of _volcanoes) {
        const u = v.userData, S = u.S || 1;
        const spos = u.smoke.geometry.attributes.position, scol = u.smoke.geometry.attributes.color;
        for (let i = 0; i < u.N; i++) {
          u.prog[i] += dt * (0.11 + (i % 5) * 0.012);
          if (u.prog[i] > 1) u.prog[i] -= 1;
          const p = u.prog[i];
          const spread = S * (0.28 + p * p * 2.6);            /* widen with height → mushroom */
          const a = u.pph[i] + p * 1.4 + t * 0.0009;          /* slow swirl */
          spos.setXYZ(i, Math.cos(a) * spread, S * (2.7 + p * 9.5), Math.sin(a) * spread);
          const gc = 0.16 + p * 0.56;                         /* dark ash → pale grey */
          scol.setXYZ(i, gc * 1.06, gc, gc * 0.92);
        }
        spos.needsUpdate = true; scol.needsUpdate = true;
        if (u.lava) {
          const lpos = u.lava.geometry.attributes.position;
          for (let i = 0; i < u.LN; i++) {
            u.lprog[i] += dt * u.lspd[i];
            if (u.lprog[i] > 1) u.lprog[i] -= 1;
            const p = u.lprog[i], h = p * (1 - p) * 4;         /* parabolic arc 0..1..0 */
            const rad = S * (0.1 + p * 1.15);
            lpos.setXYZ(i, Math.cos(u.lang[i]) * rad, S * (2.7 + h * 6.2), Math.sin(u.lang[i]) * rad);
          }
          lpos.needsUpdate = true;
        }
        if (u.streaks) {
          const rp = u.streaks.geometry.attributes.position;
          for (let i = 0; i < u.RN; i++) {
            u.rprog[i] += dt * u.rspd[i];
            if (u.rprog[i] > 1) u.rprog[i] -= 1;
            const p = u.rprog[i];
            rp.setXYZ(i, Math.cos(u.rang[i]) * S * (0.32 + p * 1.5), S * (2.7 - p * 2.5), Math.sin(u.rang[i]) * S * (0.32 + p * 1.5));
          }
          rp.needsUpdate = true;
        }
        const pulse = 0.5 + 0.35 * Math.sin(t * 0.006 + v.id);
        if (u.vent) u.vent.material.color.setHSL(0.045, 1, 0.45 + 0.16 * pulse);
        if (u.crater) u.crater.material.color.setHSL(0.04, 1, 0.4 + 0.13 * pulse);
        if (u.glow) { u.glow.material.opacity = 0.55 + 0.4 * pulse; u.glow.scale.setScalar(S * (4.6 + 0.9 * pulse)); }
      }
      /* Fire flicker. */
      for (const f of _fires) {
        const u = f.userData;
        for (const sp of u.sprites) {
          const s = sp.userData.base * (0.8 + 0.35 * Math.sin(t * 0.012 + sp.userData.ph));
          sp.scale.setScalar(s);
          sp.material.opacity = 0.6 + 0.3 * Math.sin(t * 0.01 + sp.userData.ph);
        }
        if (u.smoke) for (const sm of u.smoke) {
          sm.userData.p = (sm.userData.p + dt * 0.12) % 1;
          const p = sm.userData.p;
          sm.position.set(u.S * 0.35 * p, u.S * (0.7 + p * 2.6), 0);
          sm.scale.setScalar(u.S * (0.8 + p * 1.8));
          sm.material.opacity = 0.34 * Math.sin(p * Math.PI);
        }
        if (u.embers) {
          const ep = u.embers.geometry.attributes.position;
          for (let i = 0; i < u.EN; i++) {
            u.eprog[i] += dt * 0.5; if (u.eprog[i] > 1) { u.eprog[i] -= 1; u.eang[i] = Math.random() * Math.PI * 2; }
            const p = u.eprog[i], r = u.S * (0.15 + p * 0.5);
            ep.setXYZ(i, Math.cos(u.eang[i]) * r + Math.sin(t * 0.004 + i) * u.S * 0.08, u.S * (0.3 + p * 2.2), Math.sin(u.eang[i]) * r);
          }
          ep.needsUpdate = true;
          u.embers.material.opacity = 0.75 + 0.2 * Math.sin(t * 0.02);
        }
      }
      /* Hurricane spin (around its tangent normal = local Z). */
      for (const s of _storms) {
        const u = s.userData;
        u.disc.rotation.z += dt * 0.9 * u.dir;          /* núcleo mais rápido */
        u.outer.rotation.z += dt * 0.32 * u.dir;
        u.disc.material.opacity = 0.86 + 0.08 * Math.sin(t * 0.002 + u.ph);
      }
  }

  /* ═════════════════════════════ HOVER / PICK ══════════════════════ */
  /* Returns the picked object's userData ({ meta, lat, lng, … }) or null. */
  function _pickMeta(clientX, clientY, el) {
    if (!_globe) return null;
    const cam = _globe.camera(), rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const m = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, cam);
    const targets = [..._quakeMarks, ..._volcanoes, ..._fires, ..._storms];
    const hits = ray.intersectObjects(targets, true);
    if (!hits.length) return null;
    /* Distance to the globe's near surface, so we can ignore events on the far
       (hidden) hemisphere — the globe mesh isn't a raycast target and doesn't
       occlude these spheres, which would otherwise make the tooltip "stick". */
    const R = _globe.getGlobeRadius ? _globe.getGlobeRadius() : 100;
    const near = new THREE.Vector3();
    const hasNear = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(0, 0, 0), R), near);
    /* Only accept hits on the near side. If the ray misses the globe entirely
       (cursor in the space around it), cap at the distance to the globe centre so
       a marker poking past the far limb can't keep the tooltip up — the cause of
       a popup "not disappearing" when the pointer is off the globe. */
    const maxDist = (hasNear ? cam.position.distanceTo(near) : cam.position.length()) + R * 0.2;
    for (const h of hits) {
      if (h.distance > maxDist) continue;           /* behind the visible globe */
      let o = h.object; while (o && !o.userData?.meta && o.parent) o = o.parent;
      if (o && o.userData && o.userData.meta) return o.userData;
    }
    return null;
  }

  function _tipHtml(meta) {
    const rows = meta.rows.map(([k, v]) => `<span class="ex-rt-tip-row"><b>${_esc(k)}</b> ${_esc(v)}</span>`).join('');
    return `<span class="ex-rt-tip-title">${meta.icon} ${_esc(meta.title)}</span>${rows}<span class="ex-rt-tip-hint">${meta.url ? 'toca para ver detalhes' : ''}</span>`;
  }
  /* Show the event detail popup (data + a "Mais informação" link inside it). */
  function _showCard(meta) {
    const d = document.getElementById('rt-detail'); if (!d) return;
    d.innerHTML = _cardHtml(meta);
    d.hidden = false;
    const close = d.querySelector('#rt-card-close');
    if (close) close.onclick = () => { d.hidden = true; };
  }
  function _hideCard() { const d = document.getElementById('rt-detail'); if (d) d.hidden = true; }
  function _cardHtml(meta) {
    const rows = meta.rows.map(([k, v]) => `<div class="ex-rt-card-row"><span>${_esc(k)}</span><span>${_esc(v)}</span></div>`).join('');
    const link = meta.url ? `<a class="ex-rt-card-link" href="${_esc(meta.url)}" target="_blank" rel="noopener">${_esc(meta.urlLabel || 'Mais informação')} ↗</a>` : '';
    return `<button class="ex-rt-card-close" id="rt-card-close" title="Fechar">✕</button>
      <div class="ex-rt-card-title">${meta.icon} ${_esc(meta.title)}</div>
      <div class="ex-rt-card-rows">${rows}</div>${link}`;
  }

  /* The tooltip is driven by the RAF loop (_updateTooltip), not by pointer
     events. Here we only TRACK the pointer — cheap, and impossible to get wrong.
     Every frame the loop re-decides, from the live pointer position, whether an
     event is under the cursor and shows/hides accordingly, so the tooltip can
     never get "stuck": the instant the cursor isn't over an event (or leaves the
     globe, or a drag starts) the very next frame hides it. Tracking on document
     in the capture phase guarantees we still see moves even if globe.gl's canvas
     controls swallow or re-target them. */
  function _wireHover(el) {
    _tipEl = document.getElementById('rt-tooltip');
    _ptr = { x: 0, y: 0, inside: false, down: false, downX: 0, downY: 0, dragMoved: false };

    function track(e) {
      _ptr.x = e.clientX; _ptr.y = e.clientY;
      const r = el.getBoundingClientRect();
      _ptr.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (_ptr.down && (Math.abs(e.clientX - _ptr.downX) > 6 || Math.abs(e.clientY - _ptr.downY) > 6)) _ptr.dragMoved = true;
      /* Decide show/hide immediately on the move itself (not only in rAF), so the
         tooltip responds the instant the pointer leaves an event. Listening for
         BOTH pointermove and mousemove, on document in the capture phase, means
         no canvas/control can swallow the move that should hide it. */
      try { _updateTooltip(); } catch (_) {}
    }
    document.addEventListener('pointermove', track, true);
    document.addEventListener('mousemove', track, true);
    el.addEventListener('pointerdown', e => { _ptr.down = true; _ptr.downX = e.clientX; _ptr.downY = e.clientY; _ptr.dragMoved = false; });
    window.addEventListener('pointerup', () => { _ptr.down = false; });
    window.addEventListener('blur', () => { _ptr.inside = false; if (_tipEl) _tipEl.hidden = true; });
    el.addEventListener('pointerleave', () => { _ptr.inside = false; if (_tipEl) _tipEl.hidden = true; });
    el.addEventListener('mouseleave', () => { _ptr.inside = false; if (_tipEl) _tipEl.hidden = true; });

    /* Click/tap an event (a real click, not a drag-rotate) → show a detail popup
       with the event data + a "Mais informação ↗" link inside (works on mobile,
       where there is no hover). Clicking empty globe closes it. */
    el.addEventListener('click', () => {
      if (_ptr.dragMoved) return;
      const u = _pickMeta(_ptr.x, _ptr.y, el);
      if (u) { _showCard(u.meta); _flyTo(u.lat, u.lng); } else _hideCard();
    });
    if (!_escBound) {
      document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideCard(); });
      _escBound = true;
    }
  }
  let _escBound = false;

  /* Per-frame tooltip sync from the live pointer (the heartbeat that makes a
     "stuck" tooltip impossible). */
  function _updateTooltip() {
    _tipDirty = false;
    const tip = _tipEl; if (!tip) return;
    const el = document.getElementById('rt-globe'); if (!el) return;
    if (!_ptr || !_ptr.inside || _ptr.down) {
      if (!tip.hidden) tip.hidden = true; el.style.cursor = ''; return;
    }
    const picked = _pickMeta(_ptr.x, _ptr.y, el);
    const meta = picked && picked.meta;
    if (!meta) { if (!tip.hidden) tip.hidden = true; el.style.cursor = ''; return; }
    const html = _tipHtml(meta);
    if (tip.__html !== html) { tip.innerHTML = html; tip.__html = html; }
    tip.hidden = false;
    const rect = el.getBoundingClientRect();
    const x = Math.min(_ptr.x - rect.left + 14, rect.width - 240);
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = (_ptr.y - rect.top + 14) + 'px';
    el.style.cursor = meta.url ? 'pointer' : '';
  }

  /* ═════════════════════════════ CONTROLS ══════════════════════════ */
  function _wireControls() {
    const bar = document.getElementById('rt-layers');
    bar?.addEventListener('click', e => {
      const chip = e.target.closest('.ex-rt-chip'); if (!chip) return;
      const id = chip.dataset.layer; _on[id] = !_on[id];
      chip.classList.toggle('on', _on[id]);
      chip.setAttribute('aria-pressed', _on[id] ? 'true' : 'false');
      _applyLayer(id);
    });
    document.getElementById('rt-now')?.addEventListener('click', () => _setDate(null));
    /* Custom date control: a button (shows dd/mm/yyyy) opens the native picker. */
    const dateBtn = document.getElementById('rt-date-btn');
    const dateIn = document.getElementById('rt-date');
    dateBtn?.addEventListener('click', () => {
      if (!dateIn) return;
      if (typeof dateIn.showPicker === 'function') { try { dateIn.showPicker(); return; } catch (_) {} }
      dateIn.focus(); dateIn.click();
    });
    dateIn?.addEventListener('change', e => { if (e.target.value) _setDate(e.target.value); });

    /* ‹ › day stepping — quick time-travel without opening the picker.
       Stepping forward past yesterday goes back to live ("Agora"). */
    const _shiftDay = delta => {
      const base = _date ? new Date(_date + 'T12:00:00Z') : new Date();
      base.setUTCDate(base.getUTCDate() + delta);
      const today = _ymd(new Date());
      const ymd = _ymd(base);
      _setDate(ymd >= today ? null : ymd);
    };
    document.getElementById('rt-prev')?.addEventListener('click', () => _shiftDay(-1));
    document.getElementById('rt-next')?.addEventListener('click', () => _shiftDay(1));

    /* Filters popover. */
    const fbtn = document.getElementById('rt-filters-btn');
    const fpop = document.getElementById('rt-filters');
    fbtn?.addEventListener('click', () => {
      const open = fpop.hidden; fpop.hidden = !open; fbtn.classList.toggle('on', open);
      fbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* "Destaques" feed — open by default on wide screens, remembered. */
    const feed = document.getElementById('rt-feed'), feedBtn = document.getElementById('rt-feed-btn');
    const setFeed = open => {
      if (!feed) return;
      feed.hidden = !open;
      feedBtn?.classList.toggle('on', open);
      feedBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
      try { localStorage.setItem('rt-feed', open ? '1' : '0'); } catch (_) {}
    };
    let saved = null; try { saved = localStorage.getItem('rt-feed'); } catch (_) {}
    setFeed(saved == null ? window.innerWidth > 980 : saved === '1');
    feedBtn?.addEventListener('click', () => setFeed(feed.hidden));
    document.getElementById('rt-feed-close')?.addEventListener('click', () => setFeed(false));
    document.getElementById('rt-feed-list')?.addEventListener('click', e => {
      const b = e.target.closest('.ex-rt-feed-it'); if (!b) return;
      const it = (e.currentTarget.__items || [])[+b.dataset.i]; if (!it) return;
      _showCard(it.meta); _flyTo(it.lat, it.lng);
      if (window.innerWidth <= 640) setFeed(false);   /* bottom sheet → get out of the way */
    });
    const magIn = document.getElementById('rt-mag'), magVal = document.getElementById('rt-mag-val');
    magIn?.addEventListener('input', e => {
      _minMag = parseFloat(e.target.value); if (magVal) magVal.textContent = _minMag.toFixed(1);
      _applyRings(); _dataChanged();
    });
    const daysIn = document.getElementById('rt-days'), daysVal = document.getElementById('rt-days-val');
    let _daysT = null;
    daysIn?.addEventListener('input', e => {
      _recencyDays = parseInt(e.target.value, 10); if (daysVal) daysVal.textContent = _daysLabel(_recencyDays);
      /* Debounce — reload the EONET layers (recency affects all of them). */
      clearTimeout(_daysT);
      _daysT = setTimeout(() => {
        const seq = _loadSeq;
        _clear(_volcanoes); _clear(_fires); _clear(_storms);
        const jobs = [];
        if (_on.volcanoes) jobs.push(_loadEonet('volcanoes', seq).then(l => _filterRecent(l).forEach(_buildVolcano)));
        if (_on.fires)     jobs.push(_loadEonet('wildfires', seq).then(l => _filterRecent(l).slice(0, _fireCap).forEach(_buildFire)));
        if (_on.storms)    jobs.push(_loadEonet('severeStorms', seq).then(l => _filterRecent(l).forEach(_buildStorm)));
        Promise.all(jobs).then(() => _dataChanged());
      }, 320);
    });
  }

  /* Apply a single layer toggle with the cheapest update path. */
  function _applyLayer(id) {
    if (id === 'daynight') { if (_matUniforms) _matUniforms.dayNight.value = _on.daynight ? 1 : 0; _updateLegend(); return; }
    if (id === 'clouds') { _applyBaseTexture(); return; }
    if (id === 'quakes' || id === 'tsunami') {
      if ((_on.quakes || _on.tsunami) && !_quakeData.length) { _loadQuakes(++_loadSeq).then(() => _dataChanged()); }
      else _applyRings();
      _dataChanged(); return;
    }
    /* volcanoes / fires / storms → (re)load just that layer. */
    const seq = _loadSeq;
    if (id === 'volcanoes') { _clear(_volcanoes); if (_on.volcanoes) _loadEonet('volcanoes', seq).then(l => _filterRecent(l).forEach(_buildVolcano)).then(() => _dataChanged()); }
    if (id === 'fires')     { _clear(_fires);     if (_on.fires)     _loadEonet('wildfires', seq).then(l => _filterRecent(l).slice(0, _fireCap).forEach(_buildFire)).then(() => _dataChanged()); }
    if (id === 'storms')    { _clear(_storms);    if (_on.storms)    _loadEonet('severeStorms', seq).then(l => _filterRecent(l).forEach(_buildStorm)).then(() => _dataChanged()); }
    _dataChanged();
  }

  function _setDate(date) {
    _date = date;
    const now = document.getElementById('rt-now');
    const dateEl = document.getElementById('rt-date');
    const dateLbl = document.getElementById('rt-date-lbl');
    const dateBtn = document.getElementById('rt-date-btn');
    const nextBtn = document.getElementById('rt-next');
    if (now) now.classList.toggle('on', date === null);
    if (dateBtn) dateBtn.classList.toggle('on', date !== null);
    if (nextBtn) nextBtn.disabled = date === null;   /* can't step past "Agora" */
    if (date === null) { if (dateEl) dateEl.value = ''; if (dateLbl) dateLbl.textContent = 'Data'; }
    else { if (dateEl) dateEl.value = date; if (dateLbl) { const [y, m, d] = date.split('-'); dateLbl.textContent = `${d}/${m}/${y}`; } }
    _reloadAll();
  }

  /* Read-only probe for headless verification (sun, camera, textures). */
  function _debug() {
    const u = _matUniforms, sp = _sunPos();
    const c = _globe && _globe.camera();
    return {
      sun: sp, sunDir: u && u.sunDirection.value.toArray().map(v => +v.toFixed(3)),
      sunCoords: _globe && _globe.getCoords ? Object.values(_globe.getCoords(sp.lat, sp.lon, 0)).map(v => +v.toFixed(1)) : null,
      cam: c && c.position.toArray().map(v => +v.toFixed(1)), dayNight: u && u.dayNight.value,
      day: u && u.dayTexture.value.image && u.dayTexture.value.image.width,
      pov: _globe && _globe.pointOfView(),
    };
  }

  return { mount, resume, stop, _debug };
})();
