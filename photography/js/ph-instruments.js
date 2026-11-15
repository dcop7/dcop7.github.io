/* ══════════════════════════════════════════════════════════════════
   PhInstruments — a bancada de instrumentos do Laboratório.

   As oito calculadoras que eram uma grelha de formulários passam a ser UMA
   bancada: a lista à esquerda (cada instrumento mostra o resultado atual,
   por isso a lista já é uma leitura), o instrumento aberto à direita com
   cursores em stops, o número grande e um desenho que mostra a conta —
   régua de profundidade de campo, leque de ângulo de visão, linha do dia.

   As fórmulas são as mesmas de sempre (as da secção antiga, conferidas);
   mudou a forma de lhes mexer. O sensor vem do tipo de câmara escolhido no
   site. Os valores ficam guardados em localStorage['ph-inst'].

     PhInstruments.mount(host, { id, cls, go })
     PhInstruments.IDS
   ══════════════════════════════════════════════════════════════════ */
const PhInstruments = (function () {
  'use strict';
  const I = (n, o) => PhIcon.svg(n, o);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const num = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');

  const APERTURES = [1, 1.2, 1.4, 1.8, 2, 2.8, 3.5, 4, 5.6, 8, 11, 16, 22, 32];
  const SHUTTERS = [1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 15, 30];
  const ISOS = [50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200];
  const NDS = [[1, 'ND2'], [2, 'ND4'], [3, 'ND8'], [4, 'ND16'], [5, 'ND32'], [6, 'ND64'], [7, 'ND128'], [8, 'ND256'], [9, 'ND512'], [10, 'ND1000'], [12, 'ND4000'], [15, 'ND32000'], [16, 'ND64000']];
  const SENSORS = [
    ['ff', 'Full Frame', 1, 0.03], ['apsc15', 'APS-C (1,5×)', 1.5, 0.02], ['apsc16', 'APS-C Canon (1,6×)', 1.6, 0.019], ['mft', 'Micro 4/3', 2, 0.015],
    ['one', '1 polegada', 2.7, 0.011], ['ph15', 'Telemóvel 1/1,5"', 4.7, 0.006], ['ph23', 'Telemóvel 1/2,3"', 5.6, 0.005]];
  const CLS_SENSOR = { phone: 'ph15', apsc: 'apsc16', ff: 'ff', mft: 'mft' };
  const sensor = id => SENSORS.find(s => s[0] === id) || SENSORS[2];

  const fA = N => 'f/' + num(N, 1);
  function fT(t) {
    if (t < 0.4) return '1/' + Math.round(1 / t) + ' s';
    if (t < 60) return num(t, t < 10 ? 1 : 0) + ' s';
    if (t < 3600) return num(t / 60, 1) + ' min';
    return num(t / 3600, 2) + ' h';
  }
  const fM = m => !isFinite(m) || m > 9000 ? '∞' : m < 1 ? Math.round(m * 100) + ' cm' : num(m, m < 10 ? 2 : m < 100 ? 1 : 0) + ' m';

  /* ── desenhos ── */
  /* régua de distâncias em escala logarítmica (0,2 m … ∞) */
  function ruler(near, far, focus, marks) {
    const X = m => clamp((Math.log(Math.min(Math.max(m, 0.2), 2000)) - Math.log(0.2)) / (Math.log(2000) - Math.log(0.2)), 0, 1) * 100;
    const a = X(near), b = isFinite(far) ? X(far) : 100;
    return `<div class="in-ruler" role="img" aria-label="Zona nítida de ${fM(near)} a ${fM(far)}">
      <i class="in-ruler-band" style="left:${a}%;width:${Math.max(1, b - a)}%"></i>
      ${focus ? `<i class="in-ruler-f" style="left:${X(focus)}%"><b>foco</b></i>` : ''}
      ${(marks || []).map(([m, l]) => `<i class="in-ruler-m" style="left:${X(m)}%"><b>${l}</b></i>`).join('')}
      ${[[0.3, '0,3'], [1, '1 m'], [3, '3'], [10, '10'], [30, '30'], [100, '100'], [2000, '∞']].map(([m, l]) => `<span style="left:${X(m)}%">${l}</span>`).join('')}</div>`;
  }
  /* leque do ângulo de visão, visto de cima */
  function fan(deg) {
    const a = clamp(deg, 1, 170) * Math.PI / 360, R = 86, cx = 100, cy = 96;
    const x1 = cx - Math.sin(a) * R, x2 = cx + Math.sin(a) * R, y = cy - Math.cos(a) * R;
    return `<svg class="in-fan" viewBox="0 0 200 104" role="img" aria-label="Ângulo de visão de ${Math.round(deg)} graus">
      <path class="in-fan-ref" d="M${cx} ${cy}L${cx - 86 * Math.sin(0.345)} ${cy - 86 * Math.cos(0.345)}A86 86 0 0 1 ${cx + 86 * Math.sin(0.345)} ${cy - 86 * Math.cos(0.345)}Z"/>
      <path class="in-fan-a" d="M${cx} ${cy}L${x1.toFixed(1)} ${y.toFixed(1)}A${R} ${R} 0 ${deg > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y.toFixed(1)}Z"/>
      <rect x="${cx - 7}" y="${cy - 3}" width="14" height="8" rx="1.5" class="in-fan-cam"/></svg>
      <p class="in-vis-n">A tracejado: o que vê uma 50 mm em Full Frame (≈ 40°).</p>`;
  }
  /* triângulo: três barras em stops em torno do EV */
  function bars(items) {
    return `<div class="in-bars">${items.map(([l, v, pct]) => `<div class="in-bar"><span>${l}</span><i><b style="width:${clamp(pct, 2, 100)}%"></b></i><output>${v}</output></div>`).join('')}</div>`;
  }

  /* ── instrumentos ── */
  const EV_DESC = [[0, 'Cenas muito escuras: Via Láctea, light painting.'], [5, 'Noite urbana e interiores muito escuros.'], [8, 'Interiores com luz artificial.'],
    [11, 'Interiores bem iluminados, montras e palcos.'], [13, 'Exterior muito nublado ou sombra fechada.'], [15, 'Exterior nublado ou sombra aberta.'],
    [16, 'Sol direto (regra Sunny 16: f/16 a 1/ISO).'], [99, 'Luz muito intensa: praia, neve, contraluz ao sol.']];
  const LE_EFFECTS = [[10, 'Nuvens em movimento', '10 s'], [60, 'Água sedosa suave (rio lento)', '1 min'], [120, 'Água sedosa intensa (cascata)', '2 min'],
    [300, 'Rastos de luz de carros', '5 min'], [900, 'Rastos de estrelas', '15 min'], [3600, 'Light painting longo', '1 h']];

  const TOOLS = [
    { id: 'exposure', icon: 'ev', name: 'Exposição', sub: 'Quanta luz cabe numa combinação de abertura, tempo e ISO — e que outras combinações dão a mesma fotografia.',
      init: () => ({ N: 8, t: 1 / 125, iso: 100 }),
      fields: [['N', 'Abertura', 'stops', APERTURES, fA], ['t', 'Tempo', 'stops', SHUTTERS, fT], ['iso', 'ISO', 'stops', ISOS, v => 'ISO ' + v]],
      calc(v) {
        const ev = Math.log2(v.N * v.N / v.t) - Math.log2(v.iso / 100);
        const desc = EV_DESC.find(d => ev < d[0])[1];
        const eq = [-2, -1, 1, 2].map(s => { const N = v.N * Math.pow(2, s / 2), t = v.t * Math.pow(2, s); return `<li><b>${fA(N)}</b><span>${fT(t)}</span><small>${s < 0 ? 'mais fundo desfocado, tempo mais curto' : 'mais profundidade, tempo mais longo'}</small></li>`; });
        return { big: 'EV ' + num(ev, 1), sum: 'EV ' + num(ev, 1), text: 'Expõe corretamente: ' + desc.charAt(0).toLowerCase() + desc.slice(1),
          vis: `<p class="in-vis-t">A mesma exposição, com outra abertura</p><ul class="in-eq">${eq.join('')}</ul>` };
      } },
    { id: 'dof', icon: 'ruler', name: 'Profundidade de campo', sub: 'De onde até onde fica nítido, para uma focal, uma abertura e uma distância de foco.',
      init: c => ({ f: 50, N: 1.8, d: 3, s: c.sensor }),
      fields: [['f', 'Focal real', 'num', 4, 600, 'mm', true], ['N', 'Abertura', 'stops', APERTURES, fA], ['d', 'Distância ao sujeito', 'num', 0.2, 200, 'm', true], ['s', 'Sensor', 'sensor']],
      calc(v) {
        const c = sensor(v.s)[3], d = v.d * 1000, H = v.f * v.f / (v.N * c) + v.f;
        const near = d * H / (H + (d - v.f)), far = H > d - v.f ? d * H / (H - (d - v.f)) : Infinity;
        const tot = (far - near) / 1000;
        return { big: isFinite(tot) ? fM(tot) : '∞', sum: isFinite(tot) ? fM(tot) : '∞',
          text: `Nítido de ${fM(near / 1000)} a ${fM(far / 1000)}. Hiperfocal a ${fM(H / 1000)}.`,
          vis: ruler(near / 1000, far / 1000, v.d) };
      } },
    { id: 'focal', icon: 'lens', name: 'Focal equivalente', sub: 'A mesma objetiva vê menos num sensor mais pequeno. A focal equivalente diz que enquadramento vais ter.',
      init: c => ({ f: 35, s: c.sensor }),
      fields: [['f', 'Focal real', 'num', 2, 800, 'mm', true], ['s', 'Sensor', 'sensor']],
      calc(v) {
        const crop = sensor(v.s)[2], eq = v.f * crop, h = 2 * Math.atan(18 / eq) * 180 / Math.PI, dg = 2 * Math.atan(21.63 / eq) * 180 / Math.PI;
        return { big: Math.round(eq) + ' mm', sum: Math.round(eq) + ' mm eq.', text: `Equivalente em Full Frame (crop ${num(crop, 1)}×). Ângulo de visão: ${Math.round(h)}° na horizontal, ${Math.round(dg)}° na diagonal.`, vis: fan(h) };
      } },
    { id: 'hf', icon: 'infinity', name: 'Hiperfocal', sub: 'A distância a que deves focar para ter nítido da metade dela até ao infinito. É a base da paisagem e do zone focusing.',
      init: c => ({ f: 24, N: 8, s: c.sensor }),
      fields: [['f', 'Focal real', 'num', 4, 300, 'mm', true], ['N', 'Abertura', 'stops', APERTURES, fA], ['s', 'Sensor', 'sensor']],
      calc(v) {
        const H = (v.f * v.f / (v.N * sensor(v.s)[3]) + v.f) / 1000;
        return { big: fM(H), sum: fM(H), text: `Foca a ${fM(H)}: fica nítido de ${fM(H / 2)} até ao infinito.`, vis: ruler(H / 2, Infinity, H) };
      } },
    { id: 'nd', icon: 'nd', name: 'Filtro ND', sub: 'Um filtro de densidade neutra tira luz sem mudar a cor. Vê para quanto passa o tempo de exposição.',
      init: () => ({ t: 1 / 250, nd: 10 }),
      fields: [['t', 'Tempo sem filtro', 'stops', SHUTTERS.filter(t => t <= 1), fT], ['nd', 'Filtro', 'stops', NDS.map(n => n[0]), v => NDS.find(n => n[0] === v)[1] + ' · −' + v + ' stops']],
      calc(v) {
        const t = v.t * Math.pow(2, v.nd);
        const rows = [3, 6, 10, 15].map(s => `<li class="${s === v.nd ? 'on' : ''}"><b>${NDS.find(n => n[0] === s)[1]}</b><span>${fT(v.t * Math.pow(2, s))}</span><small>−${s} stops</small></li>`);
        return { big: fT(t), sum: fT(t), text: `De ${fT(v.t)} para ${fT(t)} com o filtro posto.${t >= 1 ? ' Precisas de tripé.' : ''}`,
          vis: `<p class="in-vis-t">Os filtros mais comuns, com este tempo de partida</p><ul class="in-eq">${rows.join('')}</ul>` };
      } },
    { id: 'flash', icon: 'flash', name: 'Flash: número guia', sub: 'Número guia = abertura × distância (a ISO 100). Escolhe o que queres saber; os outros dois são dados.',
      init: () => ({ want: 'd', gn: 58, N: 5.6, d: 3, iso: 100 }),
      fields: [['want', 'Calcular', 'seg', [['d', 'Distância'], ['N', 'Abertura'], ['gn', 'Número guia']]], ['gn', 'Número guia (ISO 100, m)', 'num', 8, 80, '', false, 'gn'],
        ['N', 'Abertura', 'stops', APERTURES, fA, 'N'], ['d', 'Distância', 'num', 0.5, 30, 'm', true, 'd'], ['iso', 'ISO', 'stops', ISOS, v => 'ISO ' + v]],
      calc(v) {
        const k = Math.sqrt(v.iso / 100);
        if (v.want === 'd') { const d = v.gn * k / v.N; return { big: fM(d), sum: fM(d), text: `Alcance máximo a ${fA(v.N)} e ISO ${v.iso}: GN ${v.gn} × ${num(k, 2)} ÷ ${num(v.N, 1)}.`, vis: ruler(0.3, d, d) }; }
        if (v.want === 'N') { const N = v.gn * k / v.d; return { big: fA(N), sum: fA(N), text: `Abertura para iluminar um sujeito a ${fM(v.d)} com ISO ${v.iso}.`, vis: '' }; }
        const gn = v.N * v.d / k; return { big: 'GN ' + Math.round(gn), sum: 'GN ' + Math.round(gn), text: `Potência mínima (a ISO 100) para ${fA(v.N)} a ${fM(v.d)}.`, vis: '' };
      } },
    { id: 'le', icon: 'wave', name: 'Longa exposição', sub: 'Parte do efeito que queres e do tempo que a câmara mede sem filtro; a conta diz que ND levar.',
      init: () => ({ fx: 60, t: 1 / 250 }),
      fields: [['fx', 'Efeito', 'stops', LE_EFFECTS.map(e => e[0]), v => { const e = LE_EFFECTS.find(x => x[0] === v); return e[1]; }], ['t', 'Tempo medido sem filtro', 'stops', SHUTTERS.filter(t => t <= 1 / 30), fT]],
      calc(v) {
        const stops = Math.log2(v.fx / v.t);
        const nd = NDS.reduce((b, n) => Math.abs(n[0] - stops) < Math.abs(b[0] - stops) ? n : b, NDS[0]);
        const rest = stops - nd[0], tReal = v.t * Math.pow(2, nd[0]);
        const how = Math.abs(rest) < 0.4 ? 'Fica certo sem mexer em mais nada.'
          : rest > 0 ? `Faltam ${num(rest, 1)} stops: fecha a abertura ou baixa o ISO.` : `Sobram ${num(-rest, 1)} stops: abre a abertura ou sobe o ISO.`;
        return { big: nd[1], sum: nd[1], text: `Precisas de cerca de ${num(stops, 1)} stops de filtro. Com ${nd[1]} o tempo fica em ${fT(tReal)}. ${how}`,
          vis: bars([['Sem filtro', fT(v.t), 4], [nd[1], fT(tReal), clamp(nd[0] / 16 * 100, 4, 100)], ['Efeito', fT(v.fx), clamp(stops / 16 * 100, 4, 100)]]) };
      } },
    { id: 'gh', icon: 'sunrise', name: 'Hora dourada e azul', sub: 'A que horas a luz fica baixa e quente, e quando o céu passa a azul profundo, para um sítio e um dia.',
      init: () => ({ lat: 38.72, lon: -9.14, date: new Date().toISOString().slice(0, 10) }),
      fields: [['lat', 'Latitude', 'num', -66, 66, '°', false], ['lon', 'Longitude', 'num', -180, 180, '°', false], ['date', 'Data', 'date'], ['loc', '', 'locate']],
      calc(v) {
        const lat = v.lat * Math.PI / 180, d = new Date(v.date + 'T12:00:00');
        if (isNaN(d)) return { big: '—', sum: '—', text: 'Indica uma data.', vis: '' };
        const J = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        const dec = -23.45 * Math.PI / 180 * Math.cos(2 * Math.PI / 365 * (J + 10));
        const B = 2 * Math.PI * (J - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
        const tz = -d.getTimezoneOffset() / 60, noon = 12 - v.lon / 15 - eot / 60 + tz;
        const ha = alt => { const c = (Math.sin(alt * Math.PI / 180) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec)); return c < -1 || c > 1 ? null : Math.acos(c) * 180 / Math.PI / 15; };
        const hm = h => { if (h == null) return '—'; const t = ((h % 24) + 24) % 24, hr = Math.floor(t), mn = Math.round((t - hr) * 60); return String(mn === 60 ? hr + 1 : hr).padStart(2, '0') + ':' + String(mn === 60 ? 0 : mn).padStart(2, '0'); };
        const sun = ha(-0.8333), blue = ha(-6), gLo = ha(-4), gHi = ha(6);
        if (sun == null) return { big: '—', sum: '—', text: 'Nesta latitude e data o sol não nasce ou não se põe.', vis: '' };
        const seg = (a, b, cls) => a == null || b == null ? '' : `<i class="${cls}" style="left:${clamp(a / 24 * 100, 0, 100)}%;width:${clamp((b - a) / 24 * 100, 0, 100)}%"></i>`;
        const rows = [['in-gh-b', 'Hora azul', noon - blue, noon - gLo], ['in-gh-g', 'Hora dourada', noon - gLo, noon - gHi], ['', 'Nascer do sol', noon - sun, null], ['', 'Pôr do sol', noon + sun, null],
          ['in-gh-g', 'Hora dourada', noon + gHi, noon + gLo], ['in-gh-b', 'Hora azul', noon + gLo, noon + blue]];
        return { big: hm(noon + gHi) + ' – ' + hm(noon + gLo), sum: hm(noon + gHi) + '–' + hm(noon + gLo),
          text: `Hora dourada da tarde em ${num(v.lat, 2)}°, ${num(v.lon, 2)}° (hora local do teu dispositivo, UTC${tz >= 0 ? '+' : ''}${tz}).`,
          vis: `<div class="in-day" role="img" aria-label="Linha do dia">${seg(noon - sun, noon + sun, 'in-gh-d')}${seg(noon - blue, noon - gLo, 'in-gh-b')}${seg(noon - gLo, noon - gHi, 'in-gh-g')}${seg(noon + gHi, noon + gLo, 'in-gh-g')}${seg(noon + gLo, noon + blue, 'in-gh-b')}
            ${[0, 6, 12, 18, 24].map(h => `<span style="left:${h / 24 * 100}%">${h}h</span>`).join('')}</div>
            <ul class="in-times">${rows.map(([c, l, a, b]) => `<li><i class="${c}"></i><span>${l}</span><b>${hm(a)}${b == null ? '' : ' – ' + hm(b)}</b></li>`).join('')}</ul>` };
      } },
  ];
  const IDS = TOOLS.map(t => t.id);

  /* ── estado ── */
  function load() { try { return JSON.parse(localStorage.getItem('ph-inst')) || {}; } catch (_) { return {}; } }
  function save(all) { try { localStorage.setItem('ph-inst', JSON.stringify(all)); } catch (_) {} }

  /* ── campos ── */
  function fieldHTML(f, v, want) {
    const [k, label, type] = f;
    const dep = f[type === 'num' ? 7 : 5];
    if (dep && want === dep) return '';                               // é a incógnita: não se pede
    if (type === 'stops') {
      const list = f[3], i = list.reduce((b, x, j) => Math.abs(Math.log(x / v[k])) < Math.abs(Math.log(list[b] / v[k])) ? j : b, 0);
      return `<div class="in-f" data-k="${k}" data-t="stops"><div class="in-f-h"><span>${label}</span><output>${esc(f[4](list[i]))}</output></div>
        <div class="in-f-c"><button type="button" class="in-step" data-s="-1" aria-label="${label}: anterior">${I('minus')}</button>
        <input type="range" min="0" max="${list.length - 1}" step="1" value="${i}" aria-label="${label}"/>
        <button type="button" class="in-step" data-s="1" aria-label="${label}: seguinte">${I('plus')}</button></div></div>`;
    }
    if (type === 'num') {
      const [, , , min, max, unit, log] = f;
      const pos = log ? (Math.log(v[k]) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v[k] - min) / (max - min);
      return `<div class="in-f" data-k="${k}" data-t="num" data-log="${log ? 1 : 0}" data-min="${min}" data-max="${max}"><div class="in-f-h"><label for="in-${k}">${label}</label>
        <span class="in-num"><input id="in-${k}" type="number" inputmode="decimal" value="${v[k]}" min="${min}" max="${max}" step="any"/>${unit ? `<i>${unit}</i>` : ''}</span></div>
        ${unit === '°' ? '' : `<div class="in-f-c in-f-c1"><input type="range" min="0" max="1000" step="1" value="${Math.round(clamp(pos, 0, 1) * 1000)}" aria-label="${label}" tabindex="-1"/></div>`}</div>`;
    }
    if (type === 'sensor') return `<div class="in-f" data-k="${k}" data-t="select"><div class="in-f-h"><label for="in-${k}">${label}</label></div>
        <select id="in-${k}" class="in-sel">${SENSORS.map(s => `<option value="${s[0]}"${s[0] === v[k] ? ' selected' : ''}>${s[1]} · CoC ${num(s[3], 3)} mm</option>`).join('')}</select></div>`;
    if (type === 'seg') return `<div class="in-f" data-k="${k}" data-t="seg"><div class="in-f-h"><span>${label}</span></div>
        <div class="in-seg" role="group" aria-label="${label}">${f[3].map(([val, l]) => `<button type="button" data-v="${val}" aria-pressed="${v[k] === val}">${l}</button>`).join('')}</div></div>`;
    if (type === 'date') return `<div class="in-f" data-k="${k}" data-t="date"><div class="in-f-h"><label for="in-${k}">${label}</label></div><input id="in-${k}" class="in-sel" type="date" value="${esc(v[k])}"/></div>`;
    if (type === 'locate') return `<div class="in-f"><button type="button" class="btn btn-sm in-locate">${I('pin')}<span>Usar a minha localização</span></button></div>`;
    return '';
  }

  function mount(host, opt) {
    const all = load();
    const ctx = { sensor: CLS_SENSOR[opt.cls] || 'apsc16' };
    const state = {};
    TOOLS.forEach(t => { state[t.id] = Object.assign(t.init(ctx), all[t.id] || {}); if (t.id === 'gh') state.gh.date = t.init(ctx).date; });
    let cur = IDS.includes(opt.id) ? opt.id : (IDS.includes(all._last) ? all._last : 'exposure');

    host.innerHTML = `<div class="in">
      <div class="in-list" role="tablist" aria-label="Instrumentos">${TOOLS.map(t => `<button type="button" role="tab" class="in-tab" data-id="${t.id}" aria-selected="false">
        ${I(t.icon)}<span class="in-tab-n">${t.name}</span><output class="in-tab-v"></output></button>`).join('')}</div>
      <div class="in-main" role="tabpanel"></div></div>`;
    const main = host.querySelector('.in-main');

    const sums = () => TOOLS.forEach(t => { host.querySelector(`.in-tab[data-id="${t.id}"] .in-tab-v`).textContent = t.calc(state[t.id]).sum; });
    function result() {
      const t = TOOLS.find(x => x.id === cur), r = t.calc(state[cur]);
      main.querySelector('.in-big').textContent = r.big;
      main.querySelector('.in-text').textContent = r.text;
      main.querySelector('.in-vis').innerHTML = r.vis || '';
      const all2 = load(); all2[cur] = state[cur]; all2._last = cur; save(all2);
      sums();
    }
    function open(id, quiet) {
      cur = id;
      const t = TOOLS.find(x => x.id === id), v = state[id];
      host.querySelectorAll('.in-tab').forEach(b => { const on = b.dataset.id === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      main.innerHTML = `<header class="in-head"><h3>${t.name}</h3><p>${t.sub}</p></header>
        <div class="in-cols"><div class="in-fields">${t.fields.map(f => fieldHTML(f, v, v.want)).join('')}</div>
        <div class="in-out"><p class="in-out-k dp-mono">Resultado</p><output class="in-big" aria-live="polite"></output><p class="in-text"></p><div class="in-vis"></div></div></div>`;
      result();
      if (!quiet && opt.onOpen) opt.onOpen(id);
    }

    host.querySelector('.in-list').addEventListener('click', e => { const b = e.target.closest('.in-tab'); if (b) open(b.dataset.id); });
    host.querySelector('.in-list').addEventListener('keydown', e => {
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); const n = IDS[(IDS.indexOf(cur) + d + IDS.length) % IDS.length]; open(n); host.querySelector(`.in-tab[data-id="${n}"]`).focus();
    });
    main.addEventListener('input', e => {
      const f = e.target.closest('.in-f'); if (!f || !f.dataset.k) return;
      const t = TOOLS.find(x => x.id === cur), def = t.fields.find(x => x[0] === f.dataset.k), v = state[cur], k = f.dataset.k;
      if (f.dataset.t === 'stops') { v[k] = def[3][+e.target.value]; f.querySelector('output').textContent = def[4](v[k]); }
      else if (f.dataset.t === 'num') {
        const min = +f.dataset.min, max = +f.dataset.max, log = f.dataset.log === '1';
        const nI = f.querySelector('input[type=number]'), rI = f.querySelector('input[type=range]');
        if (rI && e.target === rI) {
          const p = +rI.value / 1000; let val = log ? Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min))) : min + p * (max - min);
          val = val >= 100 ? Math.round(val) : val >= 10 ? Math.round(val * 10) / 10 : Math.round(val * 100) / 100;
          v[k] = val; nI.value = val;
        } else {
          const val = parseFloat(String(nI.value).replace(',', '.')); if (!(val > 0 || (min < 0 && isFinite(val)))) return;
          v[k] = clamp(val, min, max);
          if (rI) rI.value = Math.round(clamp(log ? (Math.log(v[k]) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v[k] - min) / (max - min), 0, 1) * 1000);
        }
      } else if (f.dataset.t === 'select' || f.dataset.t === 'date') v[k] = e.target.value;
      result();
    });
    main.addEventListener('click', e => {
      const st = e.target.closest('.in-step');
      if (st) { const r = st.parentElement.querySelector('input'); r.value = clamp(+r.value + +st.dataset.s, +r.min, +r.max); r.dispatchEvent(new Event('input', { bubbles: true })); return; }
      const sg = e.target.closest('.in-seg button');
      if (sg) { state[cur][sg.closest('.in-f').dataset.k] = sg.dataset.v; return open(cur, true); }
      const lc = e.target.closest('.in-locate');
      if (lc && navigator.geolocation) {
        lc.disabled = true; lc.querySelector('span').textContent = 'A localizar…';
        const done = () => { lc.disabled = false; lc.querySelector('span').textContent = 'Usar a minha localização'; };
        navigator.geolocation.getCurrentPosition(p => { state.gh.lat = Math.round(p.coords.latitude * 100) / 100; state.gh.lon = Math.round(p.coords.longitude * 100) / 100; open('gh', true); },
          () => { done(); if (typeof PhShell !== 'undefined') PhShell.toast('Não foi possível obter a localização.', 3000); }, { timeout: 8000 });
      }
    });
    open(cur, true);
    return { open: id => { if (IDS.includes(id)) open(id, true); } };
  }

  return { mount, IDS, TOOLS: TOOLS.map(t => ({ id: t.id, name: t.name, icon: t.icon, sub: t.sub })) };
})();
