/* ══════════════════════════════════════════════════════════════════
   REALTIME EARTH — globe.gl 3D globe with live, toggleable data layers:
   earthquakes (USGS), tsunami flags, volcanoes / wildfires / severe storms
   (NASA EONET), real cloud + surface-temperature imagery (NASA GIBS),
   computed day/night, and live flights (OpenSky). Optional time-travel to a
   past date for everything except live flights.

   All sources are keyless + CORS-friendly. Visuals are real 3D objects
   (erupting volcano with smoke, flickering fire, rotating hurricane spiral,
   expanding seismic shockwaves), not flat markers.
══════════════════════════════════════════════════════════════════ */
const RealtimeEarth = (function () {
  'use strict';

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.min.js';
  const GLOBE_CDN = 'https://unpkg.com/globe.gl@2.27.2/dist/globe.gl.min.js';

  const TEX_DAY   = 'assets/planets/earth_atmos_2048.jpg';   /* local fallback */
  const TEX_NIGHT = 'assets/planets/earth-night.jpg';        /* local fallback */

  /* NASA GIBS WMS — one equirectangular image per date (EPSG:4326, 2:1).
     `px` = output width (height = px/2). Large for the static base imagery,
     smaller for the date-aware overlays that change often. */
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  function _gibsUrl(layer, date, fmt, px) {
    const W = px || 2048;
    const p = new URLSearchParams({
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer,
      CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: String(W), HEIGHT: String(W / 2),
      FORMAT: fmt || 'image/jpeg', TIME: date,
    });
    return `${GIBS}?${p.toString()}`;
  }

  /* High-res, cloud-free base imagery (NASA "Blue Marble: Next Generation", a
     static monthly composite) is far sharper than the bundled 2048px texture.
     The request size is capped to the GPU's real max texture size at load time
     (see _initGlobe) so it can never upload as black. The night-lights texture
     stays the bundled one (VIIRS "Black Marble" is near-pure-black over land). */
  /* The hi-res NASA day mosaic is ~1.5× darker than the bundled day texture;
     this multiplier keeps the daylit globe equally bright before and after the
     hi-res swap so it never appears to "go dark". */
  const DAY_HI_BOOST = 1.55;

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
  let _volcanoes = [], _fires = [], _storms = [], _planes = [];
  let _quakeData = [];          /* {lat,lng,mag,tsunami,place,time,depth,url} */
  let _quakeMarks = [];         /* invisible hit spheres for quake hover/click */
  let _minMag = 4;              /* earthquake magnitude filter (default ≥4) */
  let _recencyDays = 7;         /* show EONET events active within N days */
  let _fireCap = 120;           /* hard safety cap on wildfire visuals */
  let _baseDayTex = null;       /* cached hi-res Blue Marble (cloud-free base) */
  let _loadSeq = 0;             /* guards against out-of-order async loads */
  let _tipEl = null, _ptr = null;   /* tooltip element + live pointer state */
  let _tempMesh = null, _planeTimer = null;   /* retired layers (kept inert) */

  /* ── Day/night shader. Lit by the dot of the WORLD-space surface normal with a
     WORLD-space sun direction (both from globe.gl's own getCoords/model frame —
     the same mapping the markers use). The normal comes from modelMatrix, not the
     camera, so the terminator is camera-independent and stays geographically
     correct under any zoom / drag / rotation. `dayNight` 0 = full daylight. */
  const VERT = `
    varying vec3 vWorldNormal; varying vec2 vUv;
    void main(){ vWorldNormal = normalize(mat3(modelMatrix) * normal); vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const FRAG = `
    uniform sampler2D dayTexture; uniform sampler2D nightTexture;
    uniform vec3 sunDirection; uniform float dayNight; uniform float dayBoost;
    varying vec3 vWorldNormal; varying vec2 vUv;
    void main(){
      float i = dot(normalize(vWorldNormal), normalize(sunDirection));
      /* dayBoost normalises brightness across textures: the hi-res NASA "Blue
         Marble" is markedly darker than the bundled day texture, so without this
         the globe visibly dimmed the moment the hi-res image swapped in. */
      vec3 day = clamp(texture2D(dayTexture, vUv).rgb * dayBoost, 0.0, 1.0);
      /* Night side = a clearly visible dusky Earth (60% of the day texture) + city
         lights + a blue earthshine floor, so the night hemisphere is never a dark
         void even when the user rotates straight onto it. */
      vec3 night = texture2D(nightTexture, vUv).rgb * 1.2 + day * 0.6 + vec3(0.03, 0.045, 0.075);
      float blend = mix(1.0, smoothstep(-0.22, 0.30, i), dayNight);
      gl_FragColor = vec4(mix(night, day, blend), 1.0);
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
  async function _fetchJson(url, ms) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms || 12000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(tid); }
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
        d.mag != null ? ['Intensidade', `${d.mag} ${d.magUnit || ''}`.trim()] : null,
        d.startMs ? ['Início', _fmtTime(d.startMs)] : null,
        d.lastMs ? ['Última atividade', _fmtTime(d.lastMs)] : null,
        ['Coords', `${d.lat.toFixed(2)}°, ${d.lng.toFixed(2)}°`],
      ].filter(Boolean),
      url: d.url, urlLabel: 'Mais informação (NASA EONET)',
    };
  }
  function _planeMeta(d) {
    return {
      kind: 'plane', icon: '✈️', title: `Voo ${d.call || '—'}`,
      rows: [
        d.country ? ['País', d.country] : null,
        d.vel ? ['Velocidade', `${Math.round(d.vel * 3.6)} km/h`] : null,
        d.alt ? ['Altitude', `${Math.round(d.alt)} m`] : null,
      ].filter(Boolean),
      url: '', urlLabel: '',
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
          <div class="ex-loading-text" id="rt-loading-txt">A inicializar a Terra em tempo real…</div>
        </div>

        <div class="ex-rt-layers" id="rt-layers">
          ${LAYERS.map(l => `<button class="ex-rt-chip${_on[l.id] ? ' on' : ''}" data-layer="${l.id}" title="${l.label}">
            <span class="ex-rt-chip-ic">${l.icon}</span><span class="ex-rt-chip-lbl">${l.label}</span></button>`).join('')}
        </div>

        <div class="ex-rt-time" id="rt-time">
          <button class="ex-rt-now on" id="rt-now">● Agora</button>
          <button class="ex-rt-now" id="rt-date-btn" title="Escolher data">📅 <span id="rt-date-lbl">Data</span></button>
          <input type="date" class="ex-rt-date-native" id="rt-date" lang="pt-PT" max="${_ymd(new Date())}"/>
          <button class="ex-rt-now" id="rt-filters-btn" title="Filtros">⚙ Filtros</button>
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

        <div class="ex-rt-legend" id="rt-legend"></div>
        <div class="ex-rt-tooltip" id="rt-tooltip" hidden></div>
        <div class="ex-rt-detail" id="rt-detail" hidden></div>
        <div class="ex-solar-credit">Dados: USGS · NASA EONET · NASA GIBS · OpenSky Network</div>
      </div>`;

    _mounted = true;
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

    _initGlobe();
    document.getElementById('rt-loading')?.remove();
    _start();
    _reloadAll();
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
    if (_globe) {
      const e = document.getElementById('rt-globe'); if (e) _globe.width(e.clientWidth).height(e.clientHeight);
      try { _globe.resumeAnimation(); } catch (_) {}
    }
    if (!_raf) _start();
    _startSunTimer();
    _schedulePlanes();
  }
  function stop() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_planeTimer) { clearInterval(_planeTimer); _planeTimer = null; }
    if (_sunTimer) { clearInterval(_sunTimer); _sunTimer = null; }
    if (_globe) { try { _globe.pauseAnimation(); } catch (_) {} }   /* stop globe.gl's render loop while hidden */
  }

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
    let _maxTexSize = 4096;
    try {
      const r = _globe.renderer();
      _maxAniso = r.capabilities.getMaxAnisotropy() || 8;
      _maxTexSize = r.capabilities.maxTextureSize || 4096;
      r.setPixelRatio(_pixelRatio());
    } catch (_) {}
    if (_q < 0.6) _fireCap = 60;
    else if (_q < 0.8) _fireCap = 90;

    /* Day/night shader material on the globe surface. Start from the bundled
       textures (instant), then swap in the high-res GIBS imagery once loaded. */
    const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
    const day = tl.load(TEX_DAY, () => {});
    const night = tl.load(TEX_NIGHT, () => {});
    if (THREE.SRGBColorSpace) { day.colorSpace = THREE.SRGBColorSpace; night.colorSpace = THREE.SRGBColorSpace; }
    _aniso(day); _aniso(night);
    /* High-res day upgrade. Cap the request to the GPU's real max texture size:
       a texture larger than the GPU allows uploads as BLACK, which would turn the
       daylit globe dark a few seconds after opening (a prime suspect for the
       persistent "fica escuro"). We also verify the downloaded image is actually
       bright before swapping, so a dark/error response can never darken the
       globe either — the bright bundled texture stays put if anything is off. */
    const hiPx = Math.min(4096, _maxTexSize);
    if (hiPx >= 2048) {
      const hiUrl = _gibsUrl('BlueMarble_NextGeneration', '2004-08-01', 'image/jpeg', hiPx);
      tl.load(hiUrl, tex => {
        if (!_matUniforms || _on.clouds || !_isBright(tex.image)) { _baseDayTex = _isBright(tex.image) ? tex : _baseDayTex; return; }
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        _aniso(tex);
        _matUniforms.dayTexture.value = tex; _matUniforms.dayBoost.value = DAY_HI_BOOST;
        _baseDayTex = tex;
      }, undefined, () => {});
    }
    /* Night side keeps the bundled city-lights texture: the hi-res VIIRS "Black
       Marble" is almost pure black over land/ocean, so swapping it in turned the
       whole night hemisphere into a black void a few seconds after load. */
    _matUniforms = {
      dayTexture: { value: day }, nightTexture: { value: night },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      dayNight: { value: _on.daynight ? 1 : 0 },
      dayBoost: { value: 1.0 },        /* 1.0 for the bright bundled texture */
    };
    _shaderMat = new THREE.ShaderMaterial({ uniforms: _matUniforms, vertexShader: VERT, fragmentShader: FRAG });
    try { _globe.globeMaterial(_shaderMat); } catch (_) {}
    _updateSun();   /* set the initial sun direction */

    /* Open looking straight at the daylit side (the subsolar point) so the globe
       is bright and vivid on load, not facing the dark night hemisphere. */
    const sp0 = _sunPos();
    _globe.pointOfView({ lat: Math.max(-55, Math.min(55, sp0.lat)), lng: sp0.lon, altitude: 2.4 }, 0);

    /* Keep the terminator anchored to the real Sun. */
    _startSunTimer();

    new ResizeObserver(() => {
      if (!_globe) return; const e = document.getElementById('rt-globe'); if (!e) return;
      _globe.width(e.clientWidth).height(e.clientHeight);
    }).observe(el);

    _wireHover(el);
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

  /* Re-pin objects to the globe surface every frame from their stored lat/lng,
     so they track the globe exactly however globe.gl moves on drag/zoom (the
     same approach the planes use). Keeps hover targets aligned with what's
     drawn — otherwise stale hit-spheres drift and the tooltip gets "stuck". */
  function _reglue(arr) {
    if (!_globe) return;
    for (const o of arr) {
      const u = o.userData;
      if (u && u.lat != null) _orient(o, u.lat, u.lng, u.alt, u.axis);
    }
  }

  /* ═════════════════════════════ VISUALS ════════════════════════════ */
  /* Erupting volcano, sized by significance: a basalt cone, a glowing crater,
     a fountain of lava bombs, and a tall rising smoke/ash plume. */
  function _buildVolcano(d) {
    const g = new THREE.Group();
    const S = 2.4 + (d.signif || 0) * 4.5;            /* overall scale */
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4 * S, 2.4 * S, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x4a3a30, side: THREE.DoubleSide }));
    cone.position.y = 1.2 * S; g.add(cone);
    /* Glowing crater + additive heat glow. */
    const vent = new THREE.Mesh(new THREE.SphereGeometry(0.55 * S, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb024 }));
    vent.position.y = 2.4 * S; g.add(vent);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: 0xff4400, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(4 * S); glow.position.y = 2.6 * S; g.add(glow);

    /* Lava fountain — bright bombs launched upward, falling back (animated). */
    const LN = 40, lpos = new Float32Array(LN * 3), lprog = new Float32Array(LN), lspd = new Float32Array(LN);
    for (let i = 0; i < LN; i++) { lprog[i] = Math.random(); lspd[i] = 0.6 + Math.random() * 0.6; }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    const lava = new THREE.Points(lg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0xff6a10, size: 1.3 * S, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(lava);

    /* Smoke / ash plume rising high above the crater. */
    const N = 46, pos = new Float32Array(N * 3), prog = new Float32Array(N);
    for (let i = 0; i < N; i++) prog[i] = Math.random();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0x8a8278, size: 2.4 * S, transparent: true, opacity: 0.42, depthWrite: false }));
    g.add(smoke);

    /* Decoration is non-interactive; a small invisible sphere is the hit target. */
    [cone, vent, glow, lava, smoke].forEach(o => { o.raycast = _noRay; });
    _addHit(g, 2.4 * S, 1.6 * S);
    g.userData = { smoke, prog, N, lava, lprog, lspd, LN, vent, S, meta: _eonetMeta(d, 'volcano'), lat: d.lat, lng: d.lng, alt: 0, axis: 'y' };
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
    g.userData = { sprites: [], meta: _eonetMeta(d, 'fire'), lat: d.lat, lng: d.lng, alt: 0.002, axis: 'y' };
    const flames = 5;
    for (let i = 0; i < flames; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: cols[i % cols.length], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      const base = S * (0.45 + Math.random() * 0.6);
      sp.scale.setScalar(base);
      sp.position.set((Math.random() - 0.5) * S * 0.7, base * 0.35, (Math.random() - 0.5) * S * 0.7);
      sp.userData = { base, ph: Math.random() * Math.PI * 2 };
      g.add(sp); g.userData.sprites.push(sp);
    }
    /* Smoke plume drifting up from the fire. */
    const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: 0x6b6358, transparent: true, opacity: 0.3, depthWrite: false }));
    smoke.scale.setScalar(S * 1.3); smoke.position.y = S * 1.1; g.add(smoke);
    g.children.forEach(o => { o.raycast = _noRay; });
    _addHit(g, 1.5 * S, S * 0.5);
    _orient(g, d.lat, d.lng, 0.002, 'y');
    _scene().add(g);
    _fires.push(g);
  }

  /* Severe storm / hurricane: a rotating spiral cloud disc tangent to the surface. */
  let _spiralTex = null;
  function _spiralTexture() {
    if (_spiralTex) return _spiralTex;
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d'); ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t < 60; t++) {
        const a = arm * Math.PI + t * 0.18, r = t * 0.95;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    _spiralTex = new THREE.CanvasTexture(cv); return _spiralTex;
  }
  function _buildStorm(d) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: _spiralTexture(), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    g.add(disc);
    disc.raycast = _noRay;
    _addHit(g, 6, 0);
    g.userData = { disc, meta: _eonetMeta(d, 'storm'), lat: d.lat, lng: d.lng, alt: 0.01, axis: 'z' };
    _orient(g, d.lat, d.lng, 0.01, 'z');
    _scene().add(g);
    _storms.push(g);
  }

  /* Plane: a small triangular dart at altitude, heading along its track. */
  function _buildPlane(d) {
    const geo = new THREE.ConeGeometry(0.5, 1.8, 4);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const alt = 0.02 + Math.min(0.04, (d.alt || 8000) / 12000 * 0.03);
    _orient(mesh, d.lat, d.lng, alt, 'y');
    /* Rotate around the local outward axis to face the heading. */
    mesh.rotateY((d.track || 0) * Math.PI / 180);
    mesh.userData = { meta: _planeMeta(d), lat: d.lat, lng: d.lng, track: d.track || 0, vel: d.vel || 0, alt };
    _scene().add(mesh);
    _planes.push(mesh);
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
  function _status(msg) { const e = document.getElementById('rt-status'); if (e) e.textContent = msg || ''; }

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

  async function _loadPlanes() {
    if (!_on.planes || _date) { _clear(_planes); return; }
    /* OpenSky now restricts CORS to its own domain, so a direct browser fetch
       is blocked. Try direct first (works if that ever changes), then fall back
       to a public CORS proxy (best-effort; may be rate-limited). */
    const API = 'https://opensky-network.org/api/states/all';
    let j = null;
    try { j = await _fetchJson(API, 9000); }
    catch (_) {
      try { j = await _fetchJson('https://api.allorigins.win/raw?url=' + encodeURIComponent(API), 18000); }
      catch (_) {}
    }
    const states = (j && j.states) || null;
    if (!states) {
      _clear(_planes);
      _status('aviões indisponíveis (OpenSky bloqueia CORS de outros sites)');
      return;
    }
    const picked = states
      .filter(s => s[5] != null && s[6] != null && !s[8])   /* lon, lat, not on_ground */
      .slice(0, 280);
    _clear(_planes);
    picked.forEach(s => _buildPlane({ lng: s[5], lat: s[6], alt: s[7], vel: s[9], track: s[10], call: (s[1] || '').trim(), country: s[2] }));
    _status(_statusText());
  }

  /* ═════════════════════════════ GIBS IMAGERY ══════════════════════ */
  function _applyBaseTexture() {
    if (!_matUniforms) return;
    /* No clouds → use the cached hi-res Blue Marble (or local fallback). */
    if (!_on.clouds) {
      if (_baseDayTex) { _matUniforms.dayTexture.value = _baseDayTex; _matUniforms.dayBoost.value = DAY_HI_BOOST; }
      return;
    }
    /* Clouds on → date-aware true-colour MODIS mosaic at high resolution. */
    const url = _gibsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', _imageryDate(), 'image/jpeg', 4096);
    const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
    tl.load(url, tex => {
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      _aniso(tex);
      if (_matUniforms) { _matUniforms.dayTexture.value = tex; _matUniforms.dayBoost.value = DAY_HI_BOOST; }
    }, undefined, () => {/* keep current on failure */});
  }
  function _applyTempOverlay() {
    if (!_globe) return;
    if (_tempMesh) { _scene().remove(_tempMesh); _tempMesh = null; }
    if (!_on.temp) return;
    const r = (_globe.getGlobeRadius ? _globe.getGlobeRadius() : 100) * 1.003;
    const geo = new THREE.SphereGeometry(r, 64, 48);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.78, depthWrite: false });
    _tempMesh = new THREE.Mesh(geo, mat);
    _scene().add(_tempMesh);
    const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
    tl.load(_gibsUrl('MODIS_Terra_Land_Surface_Temp_Day', _imageryDate(), 'image/png', 2048), tex => {
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      _aniso(tex); mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => {});
  }

  /* ═════════════════════════════ RELOAD ════════════════════════════ */
  async function _reloadAll() {
    const seq = ++_loadSeq;
    _status('a carregar…');
    _applyBaseTexture();
    _applyTempOverlay();

    /* Quakes / tsunami share the USGS dataset. */
    if (_on.quakes || _on.tsunami) await _loadQuakes(seq); else { _quakeData = []; _applyRings(); }

    /* EONET layers. */
    _clear(_volcanoes); _clear(_fires); _clear(_storms);
    const jobs = [];
    if (_on.volcanoes) jobs.push(_loadEonet('volcanoes', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).forEach(_buildVolcano); }));
    if (_on.fires)     jobs.push(_loadEonet('wildfires', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).slice(0, _fireCap).forEach(_buildFire); }));
    if (_on.storms)    jobs.push(_loadEonet('severeStorms', seq).then(list => { if (seq === _loadSeq) _filterRecent(list).forEach(_buildStorm); }));
    await Promise.all(jobs);

    await _loadPlanes();
    if (seq === _loadSeq) _status(_statusText());
    _updateLegend();
  }

  function _statusText() {
    const bits = [];
    if (_on.quakes || _on.tsunami) bits.push(`${_quakeData.filter(q => q.mag >= _minMag).length} sismos`);
    if (_on.volcanoes) bits.push(`${_volcanoes.length} vulcões`);
    if (_on.fires) bits.push(`${_fires.length} incêndios`);
    if (_on.storms) bits.push(`${_storms.length} tempestades`);
    if (_on.planes && !_date) bits.push(`${_planes.length} aviões`);
    return bits.join(' · ');
  }

  function _updateLegend() {
    const el = document.getElementById('rt-legend');
    if (!el) return;
    const active = LAYERS.filter(l => _on[l.id] && l.id !== 'daynight');
    el.innerHTML = active.map(l => `<span class="ex-rt-leg"><span>${l.icon}</span>${l.label}</span>`).join('');
  }

  /* ═════════════════════════════ ANIMATION ═════════════════════════ */
  function _start() {
    let last = performance.now();
    const tick = () => {
      _raf = requestAnimationFrame(tick);
      const t = performance.now(), dt = Math.min(0.05, (t - last) / 1000); last = t;

      /* Keep the sun direction + event markers locked to the globe's current
         orientation (all camera-independent; cheap). */
      _updateSun();
      _reglue(_quakeMarks); _reglue(_volcanoes); _reglue(_fires); _reglue(_storms);
      /* Heartbeat: keep the hover tooltip honest from the live pointer. */
      _updateTooltip();

      /* Volcano: rising ash plume, arcing lava fountain, flickering crater. */
      for (const v of _volcanoes) {
        const u = v.userData, S = u.S || 1;
        const spos = u.smoke.geometry.attributes.position;
        for (let i = 0; i < u.N; i++) {
          u.prog[i] += dt * (0.18 + (i % 5) * 0.02);
          if (u.prog[i] > 1) u.prog[i] -= 1;
          const p = u.prog[i], spread = S * (0.4 + p * 1.4);
          spos.setXYZ(i, Math.sin(i * 12.9) * spread, S * (2.6 + p * 7), Math.cos(i * 7.7) * spread);
        }
        spos.needsUpdate = true;
        if (u.lava) {
          const lpos = u.lava.geometry.attributes.position;
          for (let i = 0; i < u.LN; i++) {
            u.lprog[i] += dt * u.lspd[i];
            if (u.lprog[i] > 1) u.lprog[i] -= 1;
            const p = u.lprog[i];
            const h = (p * (1 - p) * 4);                /* parabolic arc 0..1..0 */
            const ang = i * 2.39, rad = S * (0.15 + p * 0.9);
            lpos.setXYZ(i, Math.cos(ang) * rad, S * (2.4 + h * 5.5), Math.sin(ang) * rad);
          }
          lpos.needsUpdate = true;
        }
        if (u.vent) u.vent.material.color.setHSL(0.06, 1, 0.5 + 0.12 * Math.sin(t * 0.01 + v.id));
      }
      /* Fire flicker. */
      for (const f of _fires) for (const sp of f.userData.sprites) {
        const s = sp.userData.base * (0.8 + 0.35 * Math.sin(t * 0.012 + sp.userData.ph));
        sp.scale.setScalar(s);
        sp.material.opacity = 0.6 + 0.3 * Math.sin(t * 0.01 + sp.userData.ph);
      }
      /* Hurricane spin (around its tangent normal = local Z). */
      for (const s of _storms) s.userData.disc.rotation.z -= dt * 1.2;
      /* Planes drift forward along their track (dead-reckoning between fetches). */
      for (const pl of _planes) {
        const u = pl.userData;
        if (u.vel > 0) {
          const dpos = u.vel * dt / 111320;                 /* metres → ~degrees */
          const rad = u.track * Math.PI / 180;
          u.lat += dpos * Math.cos(rad);
          u.lng += dpos * Math.sin(rad) / Math.max(0.2, Math.cos(u.lat * Math.PI / 180));
          _orient(pl, u.lat, u.lng, u.alt, 'y');
          pl.rotateY(u.track * Math.PI / 180);
        }
      }
      last = t;
    };
    _raf = requestAnimationFrame(tick);
  }

  function _schedulePlanes() {
    if (_planeTimer) { clearInterval(_planeTimer); _planeTimer = null; }
    if (_on.planes && !_date) _planeTimer = setInterval(_loadPlanes, 45000);
  }

  /* ═════════════════════════════ HOVER / PICK ══════════════════════ */
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
    const maxDist = hasNear ? cam.position.distanceTo(near) + R * 0.2 : Infinity;
    for (const h of hits) {
      if (h.distance > maxDist) continue;           /* behind the visible globe */
      let o = h.object; while (o && !o.userData?.meta && o.parent) o = o.parent;
      if (o && o.userData && o.userData.meta) return o.userData.meta;
    }
    return null;
  }

  function _tipHtml(meta) {
    const rows = meta.rows.map(([k, v]) => `<span class="ex-rt-tip-row"><b>${_esc(k)}</b> ${_esc(v)}</span>`).join('');
    return `<span class="ex-rt-tip-title">${meta.icon} ${_esc(meta.title)}</span>${rows}${meta.url ? '<span class="ex-rt-tip-hint">clica para abrir a página ↗</span>' : ''}`;
  }
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
    }
    document.addEventListener('pointermove', track, true);
    el.addEventListener('pointerdown', e => { _ptr.down = true; _ptr.downX = e.clientX; _ptr.downY = e.clientY; _ptr.dragMoved = false; });
    window.addEventListener('pointerup', () => { _ptr.down = false; });
    window.addEventListener('blur', () => { _ptr.inside = false; });
    el.addEventListener('pointerleave', () => { _ptr.inside = false; });

    /* Click an event (a real click, not a drag-rotate) → open its source page. */
    el.addEventListener('click', () => {
      if (_ptr.dragMoved) return;
      const meta = _pickMeta(_ptr.x, _ptr.y, el);
      if (meta && meta.url) window.open(meta.url, '_blank', 'noopener');
    });
  }

  /* Per-frame tooltip sync from the live pointer (the heartbeat that makes a
     "stuck" tooltip impossible). */
  function _updateTooltip() {
    const tip = _tipEl; if (!tip) return;
    const el = document.getElementById('rt-globe'); if (!el) return;
    if (!_ptr || !_ptr.inside || _ptr.down) {
      if (!tip.hidden) tip.hidden = true; el.style.cursor = ''; return;
    }
    const meta = _pickMeta(_ptr.x, _ptr.y, el);
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

    /* Filters popover. */
    const fbtn = document.getElementById('rt-filters-btn');
    const fpop = document.getElementById('rt-filters');
    fbtn?.addEventListener('click', () => {
      const open = fpop.hidden; fpop.hidden = !open; fbtn.classList.toggle('on', open);
    });
    const magIn = document.getElementById('rt-mag'), magVal = document.getElementById('rt-mag-val');
    magIn?.addEventListener('input', e => {
      _minMag = parseFloat(e.target.value); if (magVal) magVal.textContent = _minMag.toFixed(1);
      _applyRings(); _status(_statusText());
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
        Promise.all(jobs).then(() => _status(_statusText()));
      }, 320);
    });
  }

  /* Apply a single layer toggle with the cheapest update path. */
  function _applyLayer(id) {
    if (id === 'daynight') { if (_matUniforms) _matUniforms.dayNight.value = _on.daynight ? 1 : 0; return; }
    if (id === 'clouds') { _applyBaseTexture(); _updateLegend(); return; }
    if (id === 'temp')   { _applyTempOverlay(); _updateLegend(); return; }
    if (id === 'quakes' || id === 'tsunami') {
      if ((_on.quakes || _on.tsunami) && !_quakeData.length) { _loadQuakes(++_loadSeq).then(() => _status(_statusText())); }
      else _applyRings();
      _updateLegend(); return;
    }
    if (id === 'planes') { _schedulePlanes(); _loadPlanes(); _updateLegend(); return; }
    /* volcanoes / fires / storms → (re)load just that layer. */
    const seq = _loadSeq;
    if (id === 'volcanoes') { _clear(_volcanoes); if (_on.volcanoes) _loadEonet('volcanoes', seq).then(l => _filterRecent(l).forEach(_buildVolcano)).then(() => _status(_statusText())); }
    if (id === 'fires')     { _clear(_fires);     if (_on.fires)     _loadEonet('wildfires', seq).then(l => _filterRecent(l).slice(0, _fireCap).forEach(_buildFire)).then(() => _status(_statusText())); }
    if (id === 'storms')    { _clear(_storms);    if (_on.storms)    _loadEonet('severeStorms', seq).then(l => _filterRecent(l).forEach(_buildStorm)).then(() => _status(_statusText())); }
    _updateLegend();
  }

  function _setDate(date) {
    _date = date;
    const now = document.getElementById('rt-now');
    const dateEl = document.getElementById('rt-date');
    const dateLbl = document.getElementById('rt-date-lbl');
    const dateBtn = document.getElementById('rt-date-btn');
    const planesChip = document.querySelector('.ex-rt-chip[data-layer="planes"]');
    if (now) now.classList.toggle('on', date === null);
    if (dateBtn) dateBtn.classList.toggle('on', date !== null);
    if (date === null) { if (dateEl) dateEl.value = ''; if (dateLbl) dateLbl.textContent = 'Data'; }
    else if (dateLbl) { const [y, m, d] = date.split('-'); dateLbl.textContent = `${d}/${m}/${y}`; }
    /* Live flights only make sense "now"; disable the chip for past dates. */
    if (planesChip) planesChip.classList.toggle('disabled', date !== null);
    _schedulePlanes();
    _reloadAll();
  }

  return { mount, resume, stop };
})();
