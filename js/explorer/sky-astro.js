/* ══════════════════════════════════════════════════════════════════
   SkyAstro — astronomia de posição para o "Céu Esta Noite"
   ──────────────────────────────────────────────────────────────────
   Código próprio, sem bibliotecas. Precisão de minutos de arco — de
   sobra para um mapa do céu a olho nu e para horas de nascer/pôr ao
   minuto.

   • Planetas: elementos keplerianos aproximados da JPL (E. M. Standish,
     "Keplerian Elements for Approximate Positions of the Major Planets",
     tabela 1, válida 1800–2050), heliocêntricos J2000 → geocêntricos.
   • Sol: posição geocêntrica = −(baricentro Terra-Lua) dos mesmos
     elementos, para ficar coerente com os planetas.
   • Lua: elementos médios + os 12/5/2 termos de perturbação principais
     (método de Paul Schlyter), com paralaxe topocêntrica (≈1°).
   • Estrelas/planetas J2000 → equador da data por precessão (IAU 1976).
   • ISS: propagação secular J2 + arrasto (ṅ/2) a partir do TLE, com a
     correção de movimento médio de Brouwer do SGP4. Erro de segundos
     a poucos dias da época do TLE — chega para dizer "passa às 19:42".

   Ângulos em graus nas interfaces públicas; datas são objetos Date.
   ══════════════════════════════════════════════════════════════════ */
const SkyAstro = (function () {
  'use strict';

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const sin = x => Math.sin(x * D2R), cos = x => Math.cos(x * D2R);
  const norm = x => ((x % 360) + 360) % 360;
  const jd = date => date.getTime() / 86400000 + 2440587.5;
  const T = date => (jd(date) - 2451545.0) / 36525;           /* séculos desde J2000 */

  /* ── tempo sideral ───────────────────────────────────────────── */
  function gmst(date) {
    const d = jd(date) - 2451545.0, t = d / 36525;
    return norm(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t);
  }
  const lst = (date, lon) => norm(gmst(date) + lon);

  /* ── conversões ──────────────────────────────────────────────── */
  function eclToEq(lam, beta, eps) {
    const x = cos(beta) * cos(lam), y = cos(beta) * sin(lam), z = sin(beta);
    const ye = y * cos(eps) - z * sin(eps), ze = y * sin(eps) + z * cos(eps);
    return { ra: norm(Math.atan2(ye, x) * R2D), dec: Math.asin(Math.max(-1, Math.min(1, ze))) * R2D };
  }
  /* obliquidade média da eclíptica */
  const obliquity = date => { const t = T(date); return 23.439291111 - 0.0130041667 * t; };

  /* Precessão J2000 → data (Lieske 1977 / IAU 1976). */
  function precess(ra, dec, date) {
    const t = T(date);
    const zeta = (2306.2181 * t + 0.30188 * t * t) / 3600;
    const z = (2306.2181 * t + 1.09468 * t * t) / 3600;
    const th = (2004.3109 * t - 0.42665 * t * t) / 3600;
    const A = cos(dec) * sin(ra + zeta);
    const B = cos(th) * cos(dec) * cos(ra + zeta) - sin(th) * sin(dec);
    const Cc = sin(th) * cos(dec) * cos(ra + zeta) + cos(th) * sin(dec);
    return { ra: norm(Math.atan2(A, B) * R2D + z), dec: Math.asin(Math.max(-1, Math.min(1, Cc))) * R2D };
  }

  /* Equatorial (da data) → horizontal. az: 0 = Norte, 90 = Este. */
  function toHorizon(ra, dec, lat, lon, date) {
    const H = lst(date, lon) - ra;
    const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * R2D;
    const az = Math.atan2(-sin(H) * cos(dec), cos(lat) * sin(dec) - sin(lat) * cos(dec) * cos(H)) * R2D;
    return { alt, az: norm(az) };
  }
  /* refração atmosférica aproximada (Bennett), para o que está perto do horizonte */
  const refract = alt => alt < -1.5 ? 0 : 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * D2R) / 60;

  /* ── planetas (Standish, tabela 1) ───────────────────────────────
     [a, e, I, L, ϖ, Ω] e as respetivas taxas por século */
  const EL = {
    mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
    venus:   [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
    earth:   [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
    mars:    [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
    jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
    saturn:  [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
    uranus:  [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
    neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  };

  function kepler(M, e) {          /* M em graus → E em radianos */
    const m = norm(M + 180) - 180, Mr = m * D2R;
    let E = Mr + e * Math.sin(Mr);
    for (let k = 0; k < 12; k++) {
      const dE = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  /* posição heliocêntrica eclíptica J2000 (UA) */
  function helio(name, date) {
    const t = T(date), [b, r] = EL[name];
    const a = b[0] + r[0] * t, e = b[1] + r[1] * t, I = b[2] + r[2] * t;
    const L = b[3] + r[3] * t, w = b[4] + r[4] * t, O = b[5] + r[5] * t;
    const om = w - O, M = L - w;
    const E = kepler(M, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const co = cos(om), so = sin(om), cO = cos(O), sO = sin(O), cI = cos(I), sI = sin(I);
    return {
      x: (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      y: (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      z: (so * sI) * xp + (co * sI) * yp,
    };
  }

  const EPS0 = 23.43928;   /* obliquidade J2000 */
  function vecToEqJ2000(v) {
    const ye = v.y * cos(EPS0) - v.z * sin(EPS0), ze = v.y * sin(EPS0) + v.z * cos(EPS0);
    const dist = Math.hypot(v.x, ye, ze);
    return { ra: norm(Math.atan2(ye, v.x) * R2D), dec: Math.asin(ze / dist) * R2D, dist };
  }

  /* Planeta: RA/Dec da data, distâncias, fase e magnitude visual. */
  const MAG = {
    mercury: (rD, i) => -0.42 + rD + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i,
    venus:   (rD, i) => -4.40 + rD + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i,
    mars:    (rD, i) => -1.52 + rD + 0.016 * i,
    jupiter: (rD, i) => -9.40 + rD + 0.005 * i,
    saturn:  (rD, i) => -8.88 + rD + 0.044 * i,
    uranus:  (rD) => -7.19 + rD,
    neptune: (rD) => -6.87 + rD,
  };
  function planet(name, date) {
    /* tempo-luz: uma iteração chega (erro < 1″ para estas distâncias) */
    const E = helio('earth', date);
    let P = helio(name, date);
    let g = { x: P.x - E.x, y: P.y - E.y, z: P.z - E.z };
    const lt = Math.hypot(g.x, g.y, g.z) * 0.0057755183;      /* dias */
    P = helio(name, new Date(date.getTime() - lt * 86400000));
    g = { x: P.x - E.x, y: P.y - E.y, z: P.z - E.z };
    const eq = vecToEqJ2000(g);
    const p = precess(eq.ra, eq.dec, date);
    const r = Math.hypot(P.x, P.y, P.z), Rs = Math.hypot(E.x, E.y, E.z), D = eq.dist;
    const i = Math.acos(Math.max(-1, Math.min(1, (r * r + D * D - Rs * Rs) / (2 * r * D)))) * R2D;
    let mag = MAG[name](5 * Math.log10(r * D), i);
    if (name === 'saturn') {
      /* anéis: brilham mais quanto mais abertos (B = inclinação vista da Terra;
         polo de Saturno α 40,589°, δ 83,537°) */
      const sB = Math.abs(sin(83.537) * sin(eq.dec) + cos(83.537) * cos(eq.dec) * cos(eq.ra - 40.589));
      mag += -2.60 * sB + 1.25 * sB * sB;
    }
    return { ra: p.ra, dec: p.dec, dist: D, r, phase: i, illum: (1 + cos(i)) / 2, mag };
  }

  function sun(date) {
    const E = helio('earth', date);
    const eq = vecToEqJ2000({ x: -E.x, y: -E.y, z: -E.z });
    const p = precess(eq.ra, eq.dec, date);
    /* longitude eclíptica (só para a fase da Lua) */
    const lon = norm(Math.atan2(-E.y, -E.x) * R2D + 1.3969713 * T(date));
    return { ra: p.ra, dec: p.dec, dist: eq.dist, lon };
  }

  /* ── Lua (Schlyter) ──────────────────────────────────────────── */
  function moonGeo(date) {
    const d = jd(date) - 2451543.5;
    const N = norm(125.1228 - 0.0529538083 * d), i = 5.1454, w = norm(318.0634 + 0.1643573223 * d);
    const a = 60.2666, e = 0.054900, M = norm(115.3654 + 13.0649929509 * d);
    const ws = norm(282.9404 + 4.70935e-5 * d), Ms = norm(356.0470 + 0.9856002585 * d);
    const E = kepler(M, e);
    const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv) * R2D, r = Math.hypot(xv, yv);
    const xh = r * (cos(N) * cos(v + w) - sin(N) * sin(v + w) * cos(i));
    const yh = r * (sin(N) * cos(v + w) + cos(N) * sin(v + w) * cos(i));
    const zh = r * sin(v + w) * sin(i);
    let lon = Math.atan2(yh, xh) * R2D, lat = Math.atan2(zh, Math.hypot(xh, yh)) * R2D;
    const Ls = Ms + ws, Lm = M + w + N, Dd = Lm - Ls, F = Lm - N;
    lon += -1.274 * sin(M - 2 * Dd) + 0.658 * sin(2 * Dd) - 0.186 * sin(Ms) - 0.059 * sin(2 * M - 2 * Dd)
         - 0.057 * sin(M - 2 * Dd + Ms) + 0.053 * sin(M + 2 * Dd) + 0.046 * sin(2 * Dd - Ms) + 0.041 * sin(M - Ms)
         - 0.035 * sin(Dd) - 0.031 * sin(M + Ms) - 0.015 * sin(2 * F - 2 * Dd) + 0.011 * sin(M - 4 * Dd);
    lat += -0.173 * sin(F - 2 * Dd) - 0.055 * sin(M - F - 2 * Dd) - 0.046 * sin(M + F - 2 * Dd)
         + 0.033 * sin(F + 2 * Dd) + 0.017 * sin(2 * M + F);
    const dist = r - 0.58 * cos(M - 2 * Dd) - 0.46 * cos(2 * Dd);    /* raios terrestres */
    const eq = eclToEq(norm(lon), lat, obliquity(date));
    return { ra: eq.ra, dec: eq.dec, lon: norm(lon), lat, dist };
  }
  /* Lua topocêntrica: a paralaxe chega a 1° — sem ela a Lua aparecia
     no sítio errado do mapa e a hora de nascer falhava minutos. */
  function moon(date, lat, lon) {
    const g = moonGeo(date);
    const s = sun(date);
    const elong = norm(g.lon - s.lon);                 /* 0 nova · 180 cheia */
    const illum = (1 - cos(elong)) / 2;
    let ra = g.ra, dec = g.dec;
    if (lat != null) {
      const H = lst(date, lon) - g.ra, rho = 1 / g.dist;
      const x = cos(g.dec) * cos(H) - rho * cos(lat), y = cos(g.dec) * sin(H), z = sin(g.dec) - rho * sin(lat);
      ra = norm(lst(date, lon) - Math.atan2(y, x) * R2D);
      dec = Math.atan2(z, Math.hypot(x, y)) * R2D;
    }
    return { ra, dec, elong, illum, waxing: elong < 180, distKm: g.dist * 6378.14 };
  }

  /* ── nascer / pôr / crepúsculos ──────────────────────────────────
     Amostra a altitude de 10 em 10 min e interpola os cruzamentos. */
  function crossings(altFn, from, to, h0, stepMin = 10) {
    const out = [];
    let t0 = from.getTime(), a0 = altFn(new Date(t0)) - h0;
    for (let t = t0 + stepMin * 60000; t <= to.getTime(); t += stepMin * 60000) {
      const a1 = altFn(new Date(t)) - h0;
      if ((a0 < 0) !== (a1 < 0)) {
        /* bissecção curta para afinar ao segundo */
        let lo = t - stepMin * 60000, hi = t, alo = a0;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2, am = altFn(new Date(mid)) - h0;
          if ((alo < 0) !== (am < 0)) hi = mid; else { lo = mid; alo = am; }
        }
        out.push({ t: new Date((lo + hi) / 2), rising: a1 > a0 });
      }
      a0 = a1;
    }
    return out;
  }
  const sunAlt = (lat, lon) => d => { const s = sun(d); return toHorizon(s.ra, s.dec, lat, lon, d).alt; };
  const moonAlt = (lat, lon) => d => { const m = moon(d, lat, lon); return toHorizon(m.ra, m.dec, lat, lon, d).alt; };
  const planetAlt = (name, lat, lon) => d => { const p = planet(name, d); return toHorizon(p.ra, p.dec, lat, lon, d).alt; };

  /* A "noite" de uma data: do meio-dia local ao meio-dia seguinte. */
  function nightWindow(date) {
    const n = new Date(date);
    if (n.getHours() < 12) n.setDate(n.getDate() - 1);
    n.setHours(12, 0, 0, 0);
    return [n, new Date(n.getTime() + 24 * 3600000)];
  }

  function nightInfo(date, lat, lon) {
    const [a, b] = nightWindow(date);
    const f = sunAlt(lat, lon);
    const pick = (h, rising) => (crossings(f, a, b, h).find(c => c.rising === rising) || {}).t || null;
    return {
      from: a, to: b,
      sunset: pick(-0.833, false), sunrise: pick(-0.833, true),
      civilEnd: pick(-6, false), civilStart: pick(-6, true),
      darkStart: pick(-18, false), darkEnd: pick(-18, true),
    };
  }

  function riseSet(altFn, from, to, h0) {
    const c = crossings(altFn, from, to, h0);
    return { rise: (c.find(x => x.rising) || {}).t || null, set: (c.find(x => !x.rising) || {}).t || null };
  }

  /* Próxima fase da Lua: elongação alvo 0/90/180/270. */
  function nextPhase(date, target) {
    const f = d => { const e = norm(moonGeo(d).lon - sun(d).lon - target); return e > 180 ? e - 360 : e; };
    let t = date.getTime(), prev = f(date);
    for (let k = 0; k < 31 * 8; k++) {
      const tn = t + 3 * 3600000, cur = f(new Date(tn));
      if (prev < 0 && cur >= 0 && cur - prev < 90) {
        let lo = t, hi = tn;
        for (let j = 0; j < 30; j++) { const mid = (lo + hi) / 2; if (f(new Date(mid)) < 0) lo = mid; else hi = mid; }
        return new Date((lo + hi) / 2);
      }
      t = tn; prev = cur;
    }
    return null;
  }

  /* ── ISS / satélites: TLE → posição ──────────────────────────── */
  const RE = 6378.135, KE = 0.0743669161, J2 = 1.082616e-3, MIN_PER_DAY = 1440;
  function parseTLE(l1, l2) {
    const yy = +l1.slice(18, 20), doy = +l1.slice(20, 32);
    const year = yy < 57 ? 2000 + yy : 1900 + yy;
    const epoch = new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86400000);
    const ndot2 = +l1.slice(33, 43);                                    /* rev/dia² */
    const i = +l2.slice(8, 16), raan = +l2.slice(17, 25), e = +('0.' + l2.slice(26, 33).trim());
    const argp = +l2.slice(34, 42), M = +l2.slice(43, 51), n = +l2.slice(52, 63);
    /* movimento médio de Kozai → Brouwer (como na inicialização do SGP4) */
    const n0 = n * 2 * Math.PI / MIN_PER_DAY, ci = cos(i), k2 = 0.5 * J2;
    const a1 = Math.pow(KE / n0, 2 / 3), b = Math.pow(1 - e * e, 1.5);
    const d1 = 1.5 * k2 * (3 * ci * ci - 1) / (a1 * a1 * b);
    const a0 = a1 * (1 - d1 / 3 - d1 * d1 - 134 / 81 * d1 * d1 * d1);
    const d0 = 1.5 * k2 * (3 * ci * ci - 1) / (a0 * a0 * b);
    const nB = n0 / (1 + d0), aB = a0 / (1 - d0);
    const p = aB * (1 - e * e);
    const f = J2 * nB / (p * p);
    return {
      epoch, i, e, a: aB, n: nB, ndot2,
      raan, argp, M,
      raanDot: -1.5 * f * ci * R2D,                                     /* graus/min */
      argpDot: 0.75 * f * (5 * ci * ci - 1) * R2D,
      MDot: (nB + 0.75 * f * Math.sqrt(1 - e * e) * (3 * ci * ci - 1)) * R2D,
    };
  }

  /* posição ECI (km, equador da data) */
  function satECI(s, date) {
    const tm = (date.getTime() - s.epoch.getTime()) / 60000, td = tm / MIN_PER_DAY;
    const M = s.M + s.MDot * tm + 360 * s.ndot2 * td * td;
    const O = s.raan + s.raanDot * tm, w = s.argp + s.argpDot * tm;
    const E = kepler(M, s.e);
    const a = s.a * RE * (1 - (2 / 3) * (s.ndot2 * 2 / (s.n * MIN_PER_DAY / (2 * Math.PI))) * td);   /* o arrasto encolhe a órbita */
    const xp = a * (Math.cos(E) - s.e), yp = a * Math.sqrt(1 - s.e * s.e) * Math.sin(E);
    const co = cos(w), so = sin(w), cO = cos(O), sO = sin(O), cI = cos(s.i), sI = sin(s.i);
    return {
      x: (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      y: (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      z: (so * sI) * xp + (co * sI) * yp,
    };
  }
  /* observador em coordenadas ECI (elipsoide WGS-84, altitude 0) */
  function obsECI(lat, lon, date) {
    const f = 1 / 298.257223563, e2 = f * (2 - f);
    const N = 6378.137 / Math.sqrt(1 - e2 * sin(lat) ** 2);
    const th = lst(date, lon);
    const rxy = N * cos(lat);
    return { x: rxy * cos(th), y: rxy * sin(th), z: N * (1 - e2) * sin(lat) };
  }
  function satLook(s, lat, lon, date) {
    const r = satECI(s, date), o = obsECI(lat, lon, date), th = lst(date, lon);
    const rx = r.x - o.x, ry = r.y - o.y, rz = r.z - o.z;
    const S = sin(lat) * cos(th) * rx + sin(lat) * sin(th) * ry - cos(lat) * rz;
    const Ee = -sin(th) * rx + cos(th) * ry;
    const Z = cos(lat) * cos(th) * rx + cos(lat) * sin(th) * ry + sin(lat) * rz;
    const range = Math.hypot(S, Ee, Z);
    return { alt: Math.asin(Z / range) * R2D, az: norm(Math.atan2(Ee, -S) * R2D), range, eci: r };
  }
  /* sombra cilíndrica da Terra */
  function sunlit(r, date) {
    const s = sun(date);
    const u = { x: cos(s.dec) * cos(s.ra), y: cos(s.dec) * sin(s.ra), z: sin(s.dec) };
    const dot = r.x * u.x + r.y * u.y + r.z * u.z;
    if (dot > 0) return true;
    const px = r.x - dot * u.x, py = r.y - dot * u.y, pz = r.z - dot * u.z;
    return Math.hypot(px, py, pz) > RE;
  }
  function subPoint(s, date) {
    const r = satECI(s, date);
    const lon = norm(Math.atan2(r.y, r.x) * R2D - gmst(date) + 180) - 180;
    const lat = Math.atan2(r.z, Math.hypot(r.x, r.y)) * R2D;   /* geocêntrica — chega para "por cima de onde" */
    return { lat, lon, altKm: Math.hypot(r.x, r.y, r.z) - RE };
  }

  /* Passagens visíveis: satélite > minAlt, iluminado pelo Sol, e o
     observador no escuro (Sol abaixo de −6°). */
  function passes(s, lat, lon, from, days = 5, minAlt = 10) {
    const out = [], step = 20000, end = from.getTime() + days * 86400000;
    const sAlt = sunAlt(lat, lon);
    let cur = null;
    for (let t = from.getTime(); t <= end; t += step) {
      const d = new Date(t), lk = satLook(s, lat, lon, d);
      if (lk.alt >= minAlt) {
        const vis = sunlit(lk.eci, d) && sAlt(d) < -6;
        if (!cur) cur = { start: d, startAz: lk.az, max: lk.alt, maxAt: d, maxAz: lk.az, visible: false, visStart: null, visEnd: null };
        if (lk.alt > cur.max) { cur.max = lk.alt; cur.maxAt = d; cur.maxAz = lk.az; }
        if (vis) { cur.visible = true; if (!cur.visStart) { cur.visStart = d; cur.visStartAz = lk.az; } cur.visEnd = d; cur.visEndAz = lk.az; }
        cur.end = d; cur.endAz = lk.az;
      } else if (cur) {
        if (cur.visible) out.push(cur);
        cur = null;
      }
    }
    if (cur && cur.visible) out.push(cur);
    return out;
  }

  return {
    D2R, R2D, norm, jd, gmst, lst, precess, toHorizon, refract, eclToEq, obliquity,
    planet, sun, moon, moonGeo, nightInfo, riseSet, crossings, nextPhase,
    sunAlt, moonAlt, planetAlt,
    parseTLE, satECI, satLook, sunlit, subPoint, passes,
  };
})();
if (typeof module !== 'undefined') module.exports = SkyAstro;
