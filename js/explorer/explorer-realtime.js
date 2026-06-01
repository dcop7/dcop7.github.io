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

  const TEX_DAY   = 'assets/planets/earth_atmos_2048.jpg';
  const TEX_NIGHT = 'assets/planets/earth-night.jpg';

  /* NASA GIBS WMS — one equirectangular image per date (EPSG:4326, 2:1). */
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  function _gibsUrl(layer, date, fmt) {
    const p = new URLSearchParams({
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer,
      CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: '2048', HEIGHT: '1024',
      FORMAT: fmt || 'image/jpeg', TIME: date,
    });
    return `${GIBS}?${p.toString()}`;
  }

  /* ── Layers (order = toggle-bar order). `on` = default visibility. ── */
  const LAYERS = [
    { id: 'daynight', icon: '🌓', label: 'Dia/Noite',   on: true,  live: false },
    { id: 'quakes',   icon: '💢', label: 'Sismos',      on: true,  live: false },
    { id: 'tsunami',  icon: '🌊', label: 'Tsunamis',    on: false, live: false },
    { id: 'volcanoes',icon: '🌋', label: 'Vulcões',     on: true,  live: false },
    { id: 'fires',    icon: '🔥', label: 'Incêndios',   on: true,  live: false },
    { id: 'storms',   icon: '🌀', label: 'Tempestades', on: true,  live: false },
    { id: 'clouds',   icon: '☁️', label: 'Nuvens',      on: false, live: false },
    { id: 'temp',     icon: '🌡️', label: 'Temperatura', on: false, live: false },
    { id: 'planes',   icon: '✈️', label: 'Aviões',      on: false, live: true  },
  ];

  /* ── State ── */
  let _globe = null, _container = null, _mounted = false, _raf = null;
  let _on = {};                 /* layer id → bool */
  let _date = null;             /* null = now/live; else 'YYYY-MM-DD' */
  let _glowTex = null;
  let _shaderMat = null, _matUniforms = null, _sunTimer = null;
  let _volcanoes = [], _fires = [], _storms = [], _planes = [];
  let _quakeData = [];          /* {lat,lng,mag,tsunami,place,time} */
  let _tempMesh = null;
  let _planeTimer = null;
  let _loadSeq = 0;             /* guards against out-of-order async loads */

  /* ── Day/night shader (after the country globe). Blends a day texture with a
     night texture by the real sun direction; `dayNight` 0 = full daylight. ── */
  const VERT = `
    varying vec3 vNormal; varying vec2 vUv;
    void main(){ vNormal = normalize(normalMatrix * normal); vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const FRAG = `
    #define PI 3.1415926538
    uniform sampler2D dayTexture; uniform sampler2D nightTexture;
    uniform vec2 sunPosition; uniform vec2 globeRotation; uniform float dayNight;
    varying vec3 vNormal; varying vec2 vUv;
    float toRad(in float a){ return a*PI/180.0; }
    vec3 p2c(in vec2 c){ float t=toRad(90.0-c.x), p=toRad(90.0-c.y);
      return vec3(sin(p)*cos(t), cos(p), sin(p)*sin(t)); }
    void main(){
      float invLon=toRad(globeRotation.x), invLat=-toRad(globeRotation.y);
      mat3 rx=mat3(1.,0.,0., 0.,cos(invLat),-sin(invLat), 0.,sin(invLat),cos(invLat));
      mat3 ry=mat3(cos(invLon),0.,sin(invLon), 0.,1.,0., -sin(invLon),0.,cos(invLon));
      vec3 sun = rx*ry*p2c(sunPosition);
      float i = dot(normalize(vNormal), normalize(sun));
      vec3 day = texture2D(dayTexture, vUv).rgb;
      vec3 night = texture2D(nightTexture, vUv).rgb * 1.4;
      float blend = mix(1.0, smoothstep(-0.12, 0.18, i), dayNight);
      gl_FragColor = vec4(mix(night, day, blend), 1.0);
    }`;

  function _sunPos() {
    const d = Date.now() / 86400000 + 2440587.5 - 2451545;
    const M = (357.5291 + 0.98560028 * d) * Math.PI / 180;
    const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M)) * Math.PI / 180;
    const l = M + C + (283.0 + 180) * Math.PI / 180;
    const dec = Math.asin(Math.sin(23.4397 * Math.PI / 180) * Math.sin(l));
    const ra = Math.atan2(Math.cos(23.4397 * Math.PI / 180) * Math.sin(l), Math.cos(l));
    const LMST = (280.46061837 + 360.98564736629 * d) * Math.PI / 180;
    return { lat: dec * 180 / Math.PI, lon: 180 - ((LMST - ra) * 180 / Math.PI % 360 + 360) % 360 };
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
          <input type="date" class="ex-rt-date" id="rt-date" max="${_ymd(new Date())}"/>
          <span class="ex-rt-status" id="rt-status"></span>
        </div>

        <div class="ex-rt-legend" id="rt-legend"></div>
        <div class="ex-rt-tooltip" id="rt-tooltip" hidden></div>
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

  function _updateSun() { if (_matUniforms) { const s = _sunPos(); _matUniforms.sunPosition.value.set(s.lon, s.lat); } }
  function _startSunTimer() { if (!_sunTimer) { _updateSun(); _sunTimer = setInterval(_updateSun, 30000); } }

  function resume() {
    if (_globe) { const e = document.getElementById('rt-globe'); if (e) _globe.width(e.clientWidth).height(e.clientHeight); }
    if (!_raf) _start();
    _startSunTimer();
    _schedulePlanes();
  }
  function stop() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_planeTimer) { clearInterval(_planeTimer); _planeTimer = null; }
    if (_sunTimer) { clearInterval(_sunTimer); _sunTimer = null; }
  }

  /* ═════════════════════════════ GLOBE ══════════════════════════════ */
  function _initGlobe() {
    const el = document.getElementById('rt-globe');
    const W = el.clientWidth || 800, H = el.clientHeight || 600;

    _globe = Globe({ animateIn: true })(el)
      .width(W).height(H)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#7fb2ff').atmosphereAltitude(0.16)
      .ringsData([]).ringColor(d => d.color).ringMaxRadius(d => d.maxR)
      .ringPropagationSpeed(d => d.speed).ringRepeatPeriod(d => d.repeat)
      .ringAltitude(0.008);

    /* Day/night shader material on the globe surface. */
    const tl = new THREE.TextureLoader();
    const day = tl.load(TEX_DAY, () => {});
    const night = tl.load(TEX_NIGHT, () => {});
    if (THREE.SRGBColorSpace) { day.colorSpace = THREE.SRGBColorSpace; night.colorSpace = THREE.SRGBColorSpace; }
    const sp = _sunPos();
    _matUniforms = {
      dayTexture: { value: day }, nightTexture: { value: night },
      sunPosition: { value: new THREE.Vector2(sp.lon, sp.lat) },
      globeRotation: { value: new THREE.Vector2() }, dayNight: { value: _on.daynight ? 1 : 0 },
    };
    _shaderMat = new THREE.ShaderMaterial({ uniforms: _matUniforms, vertexShader: VERT, fragmentShader: FRAG });
    try { _globe.globeMaterial(_shaderMat); } catch (_) {}

    _globe.pointOfView({ lat: 20, lng: -20, altitude: 2.4 }, 0);
    _globe.onZoom(pov => { if (pov && _matUniforms) _matUniforms.globeRotation.value.set(pov.lng, pov.lat); });

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

  /* ═════════════════════════════ VISUALS ════════════════════════════ */
  /* Erupting volcano: a brown cone, a glowing vent, and rising smoke particles. */
  function _buildVolcano(d) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.8, 2.2, 14),
      new THREE.MeshBasicMaterial({ color: 0x5a463a }));
    cone.position.y = 1.1; g.add(cone);
    const vent = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7a18 }));
    vent.position.y = 2.2; g.add(vent);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: 0xff5a00, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(5); glow.position.y = 2.4; g.add(glow);

    const N = 36, pos = new Float32Array(N * 3), prog = new Float32Array(N);
    for (let i = 0; i < N; i++) prog[i] = Math.random();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ map: _glowTexture(), color: 0xb0a89c, size: 1.6, transparent: true, opacity: 0.5, depthWrite: false }));
    g.add(smoke);
    g.userData = { smoke, prog, N, label: '🌋 ' + (d.title || 'Vulcão') };
    _orient(g, d.lat, d.lng, 0, 'y');
    _scene().add(g);
    _volcanoes.push(g);
  }

  /* Wildfire: a flickering cluster of additive flame sprites. */
  function _buildFire(d) {
    const g = new THREE.Group();
    const cols = [0xff3000, 0xff6a00, 0xffb000];
    g.userData = { sprites: [], label: '🔥 ' + (d.title || 'Incêndio') };
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTexture(), color: cols[i % cols.length], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      const base = 2 + Math.random() * 1.5;
      sp.scale.setScalar(base);
      sp.position.set((Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
      sp.userData = { base, ph: Math.random() * Math.PI * 2 };
      g.add(sp); g.userData.sprites.push(sp);
    }
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
    g.userData = { disc, label: '🌀 ' + (d.title || 'Tempestade') };
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
    mesh.userData = { label: '✈️ ' + (d.call || 'Voo') + (d.country ? ' · ' + d.country : ''), lat: d.lat, lng: d.lng, track: d.track || 0, vel: d.vel || 0, alt };
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
    _quakeData.forEach(q => {
      const isT = q.tsunami;
      if (isT && showT) {
        data.push({ lat: q.lat, lng: q.lng, maxR: 7 + q.mag, speed: 4, repeat: 700,
          color: t => `rgba(56,189,248,${1 - t})` });
      } else if (showQ) {
        const c = q.mag >= 6 ? [255, 80, 80] : q.mag >= 4.5 ? [255, 160, 60] : [255, 220, 90];
        data.push({ lat: q.lat, lng: q.lng, maxR: Math.max(2, q.mag * 1.1), speed: 2 + q.mag * 0.2, repeat: 900,
          color: t => `rgba(${c[0]},${c[1]},${c[2]},${1 - t})` });
      }
    });
    _globe.ringsData(data);
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
        mag: f.properties.mag || 0, tsunami: f.properties.tsunami === 1,
        place: f.properties.place || '', time: f.properties.time,
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
        return { lng: last.coordinates[0], lat: last.coordinates[1], title: ev.title };
      }).filter(Boolean).filter(e => isFinite(e.lat) && isFinite(e.lng));
    } catch (e) { return []; }
  }

  async function _loadPlanes() {
    if (!_on.planes || _date) { _clear(_planes); return; }
    try {
      const j = await _fetchJson('https://opensky-network.org/api/states/all', 12000);
      const states = (j && j.states) || [];
      const picked = states
        .filter(s => s[5] != null && s[6] != null && !s[8])   /* lon, lat, not on_ground */
        .slice(0, 280);
      _clear(_planes);
      picked.forEach(s => _buildPlane({ lng: s[5], lat: s[6], alt: s[7], vel: s[9], track: s[10], call: (s[1] || '').trim(), country: s[2] }));
      _status(_statusText());
    } catch (e) {
      _clear(_planes);
      _status('aviões indisponíveis (OpenSky/CORS)');
    }
  }

  /* ═════════════════════════════ GIBS IMAGERY ══════════════════════ */
  function _applyBaseTexture() {
    if (!_matUniforms) return;
    const date = _imageryDate();
    const url = _on.clouds
      ? _gibsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', date, 'image/jpeg')
      : TEX_DAY;
    const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
    tl.load(url, tex => {
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      if (_matUniforms) { _matUniforms.dayTexture.value = tex; }
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
    tl.load(_gibsUrl('MODIS_Terra_Land_Surface_Temp_Day', _imageryDate(), 'image/png'), tex => {
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex; mat.needsUpdate = true;
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
    if (_on.volcanoes) jobs.push(_loadEonet('volcanoes', seq).then(list => { if (seq === _loadSeq) list.forEach(_buildVolcano); }));
    if (_on.fires)     jobs.push(_loadEonet('wildfires', seq).then(list => { if (seq === _loadSeq) list.slice(0, 160).forEach(_buildFire); }));
    if (_on.storms)    jobs.push(_loadEonet('severeStorms', seq).then(list => { if (seq === _loadSeq) list.forEach(_buildStorm); }));
    await Promise.all(jobs);

    await _loadPlanes();
    if (seq === _loadSeq) _status(_statusText());
    _updateLegend();
  }

  function _statusText() {
    const bits = [];
    if (_on.quakes || _on.tsunami) bits.push(`${_quakeData.length} sismos`);
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

      /* Volcano smoke rising + glow flicker. */
      for (const v of _volcanoes) {
        const u = v.userData, pos = u.smoke.geometry.attributes.position;
        for (let i = 0; i < u.N; i++) {
          u.prog[i] += dt * (0.25 + (i % 5) * 0.03);
          if (u.prog[i] > 1) u.prog[i] -= 1;
          const p = u.prog[i], spread = 0.5 + p * 1.6;
          pos.setXYZ(i, Math.sin(i * 12.9) * spread, 2.3 + p * 6, Math.cos(i * 7.7) * spread);
        }
        pos.needsUpdate = true;
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
    if (_on.planes && !_date) _planeTimer = setInterval(_loadPlanes, 20000);
  }

  /* ═════════════════════════════ HOVER ═════════════════════════════ */
  function _wireHover(el) {
    const tip = document.getElementById('rt-tooltip');
    el.addEventListener('pointermove', e => {
      if (!_globe || !tip) return;
      const cam = _globe.camera(), rect = el.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(m, cam);
      const targets = [..._volcanoes, ..._fires, ..._storms, ..._planes];
      const hit = ray.intersectObjects(targets, true)[0];
      if (hit) {
        let o = hit.object; while (o && !o.userData?.label && o.parent) o = o.parent;
        const label = o?.userData?.label;
        if (label) {
          tip.textContent = label; tip.hidden = false;
          tip.style.left = (e.clientX - rect.left + 12) + 'px';
          tip.style.top = (e.clientY - rect.top + 12) + 'px';
          return;
        }
      }
      tip.hidden = true;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });
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
    document.getElementById('rt-date')?.addEventListener('change', e => { if (e.target.value) _setDate(e.target.value); });
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
    if (id === 'volcanoes') { _clear(_volcanoes); if (_on.volcanoes) _loadEonet('volcanoes', seq).then(l => l.forEach(_buildVolcano)).then(() => _status(_statusText())); }
    if (id === 'fires')     { _clear(_fires);     if (_on.fires)     _loadEonet('wildfires', seq).then(l => l.slice(0,160).forEach(_buildFire)).then(() => _status(_statusText())); }
    if (id === 'storms')    { _clear(_storms);    if (_on.storms)    _loadEonet('severeStorms', seq).then(l => l.forEach(_buildStorm)).then(() => _status(_statusText())); }
    _updateLegend();
  }

  function _setDate(date) {
    _date = date;
    const now = document.getElementById('rt-now');
    const dateEl = document.getElementById('rt-date');
    const planesChip = document.querySelector('.ex-rt-chip[data-layer="planes"]');
    if (now) now.classList.toggle('on', date === null);
    if (date === null && dateEl) dateEl.value = '';
    /* Live flights only make sense "now"; disable the chip for past dates. */
    if (planesChip) planesChip.classList.toggle('disabled', date !== null);
    _schedulePlanes();
    _reloadAll();
  }

  return { mount, resume, stop };
})();
