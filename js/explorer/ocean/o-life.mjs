/* ══════════════════════════════════════════════════════════════════════
   Oceano profundo — populações.

   Cada espécie só aparece dentro da sua faixa de profundidade (literatura;
   ver o-content.mjs) e no(s) local(is) onde está documentada. A densidade
   mostrada é ILUSTRATIVA: comprimida para que, numa descida de minutos,
   se vejam animais que na realidade estão muito mais espalhados.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, clamp, lerp, smooth, rng } from './o-core.mjs';
import { getModel } from './o-fauna.mjs';

const MAX = { school: 90, solo: 4, drift: 6, hero: 1, nearfloor: 8, benthic: 40, tripod: 10, fixed: 50, swarm: 320, bed: 30, surface: 6 };
const SPEED = { tuna: 2.2, dorado: 1.6, lantern: 0.45, hatchet: 0.25, bristle: 0.2, whale: 1.4, vampire: 0.08, siphono: 0.03, atolla: 0.04, angler: 0.02, gulper: 0.12, fangtooth: 0.18, dumbo: 0.15, grenadier: 0.35, snailfish: 0.12, shrimp: 0.25, amphipod: 0.5, physalia: 0.05, psychro: 0.01, cucumber: 0.005, crab: 0.03 };
const UPRIGHT = new Set(['atolla', 'dumbo']);

export class Life {
  constructor(engine, floor, site, species) {
    this.E = engine; this.F = floor; this.site = site;
    this.group = new THREE.Group(); engine.scene.add(this.group);
    this.pools = [];
    this.R = rng(42);
    for (const sp of species) {
      const md = getModel(sp.model), max = MAX[sp.mode] || 6;
      const geo = md.geo.clone();
      const inst = new Float32Array(max * 4);
      for (let i = 0; i < max; i++) { inst[i * 4] = this.R() * 100; inst[i * 4 + 1] = 1; inst[i * 4 + 2] = 4; }
      const attr = new THREE.InstancedBufferAttribute(inst, 4); attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aInst', attr);
      const mesh = new THREE.InstancedMesh(geo, md.mat, max);
      mesh.count = 0; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (md.info.mat?.transparent) mesh.renderOrder = 3;
      this.group.add(mesh);
      this.pools.push({ sp, md, mesh, attr, agents: [], max, schools: [], cool: 0 });
    }
    this.byId = new Map(this.pools.map(p => [p.sp.id, p]));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(0, 0, 0, 'YZX');
    this.alarm = 0;
  }

  /** abundância relativa (0–1) de uma espécie à profundidade d */
  density(sp, d) {
    let [a, b] = sp.depth, [c0, c1] = sp.core;
    if (sp.night && this.E.sunK < 0.5) { [c0, c1] = sp.night; a = Math.min(a, c0); }
    if (d < a || d > b) return 0;
    const up = c0 > a ? smooth(a, c0, d) : 1, dn = c1 < b ? 1 - smooth(c1, b, d) : 1;
    return Math.max(0.12, Math.min(up, dn)) * (d >= c0 && d <= c1 ? 1 : 0.6);
  }
  visRadius() { const e = this.E.depth; return e < 150 ? 55 : e < 400 ? 40 : 32; }

  update(dt) {
    const E = this.E, cam = E.camera.position, d = Math.max(0, -cam.y), F = this.F;
    const floorY = F.heightAt(cam.x, cam.z), alt = cam.y - floorY;
    const R = this.visRadius();
    for (const P of this.pools) {
      const sp = P.sp, mode = sp.mode;
      /* despawn */
      for (let i = P.agents.length - 1; i >= 0; i--) {
        const a = P.agents[i]; const dd = a.p.distanceTo(cam);
        const ad = -a.p.y;
        if (a.pinned) continue;
        if (dd > R * 1.6 || (mode !== 'hero' && (ad < sp.depth[0] - 30 || ad > sp.depth[1] + 30))) P.agents.splice(i, 1);
      }
      /* spawn */
      const f = this.density(sp, d);
      const benthic = ['benthic', 'tripod', 'fixed', 'bed', 'nearfloor'].includes(mode);
      const atFloor = alt < 60;
      let want = 0;
      if (mode === 'school') want = Math.round(f * (sp.group ? 2 : 1)) * 1;
      else if (mode === 'surface') want = d < 40 ? 4 : 0;
      else if (mode === 'hero') want = 0;
      else if (mode === 'swarm') want = atFloor && this.density(sp, -floorY) > 0 ? 1 : 0;
      else if (benthic) want = atFloor && this.density(sp, -floorY) > 0 ? Math.ceil(this.density(sp, -floorY) * (mode === 'nearfloor' ? 3 : mode === 'fixed' ? 30 : mode === 'bed' ? 20 : mode === 'tripod' ? 6 : 14)) : 0;
      else want = Math.ceil(f * (mode === 'drift' ? 4 : 3) * (d > 300 ? 1.5 : 1));
      P.cool -= dt;
      const units = mode === 'school' ? P.schools.filter(s => s.n > 0).length : mode === 'swarm' ? (P.agents.length ? 1 : 0) : P.agents.length;
      if (units < want && P.cool <= 0) { this.spawn(P, { R, floorY }); P.cool = mode === 'school' ? 1.2 : 0.4; }
      this.step(P, dt, floorY);
      this.write(P);
    }
  }

  /** cria uma unidade (cardume, enxame ou indivíduo); front=true põe-na diante da câmara */
  spawn(P, { R, floorY, front = false, near = false } = {}) {
    const E = this.E, cam = E.camera.position, sp = P.sp, mode = sp.mode, r = this.R;
    const fwd = new THREE.Vector3(); E.camera.getWorldDirection(fwd);
    const pick = (dmin, dmax, cone) => {
      const v = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).normalize();
      if (front || r() < 0.7) v.lerp(fwd, cone).normalize();
      return v.multiplyScalar(lerp(dmin, dmax, r())).add(cam);
    };
    const clampY = p => { const lo = -sp.depth[1], hi = -sp.depth[0]; p.y = clamp(p.y, lo + 1, Math.min(hi, -0.3)); return p; };
    const size = () => sp.size * lerp(0.75, 1.15, r());
    const base = { sp, phase: r() * 100, glow: 1, yaw: r() * 6.283, pitch: 0, t: 0, v: new THREE.Vector3() };
    const fl = (x, z) => this.F.heightAt(x, z);
    if (mode === 'school') {
      const n = Math.min(P.max - P.agents.length, Math.round(lerp(sp.group[0], sp.group[1], r())));
      if (n <= 0) return null;
      const deep = E.depth > 300;
      const c = clampY(pick(front ? Math.max(2, sp.size * 25) : deep ? 5 : 9, front ? Math.max(4, sp.size * 40) : deep ? 14 : R * 0.6, front ? 1 : 0.8));
      const S = { c, yaw: r() * 6.283, n, spd: SPEED[sp.model] * lerp(0.8, 1.2, r()), turn: 0 };
      P.schools.push(S);
      const spread = Math.max(0.6, sp.size * 2.5) * Math.cbrt(n);
      for (let i = 0; i < n; i++) P.agents.push({ ...base, phase: r() * 100, school: S, off: new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread * 0.5, (r() - 0.5) * spread), p: c.clone().add(new THREE.Vector3((r() - 0.5) * spread, 0, (r() - 0.5) * spread)), size: size(), yaw: S.yaw });
      return P.agents[P.agents.length - 1];
    }
    if (mode === 'swarm') {
      const out = [];
      if (sp.id === 'rimicaris') {
        for (const v of this.F.vents) for (let i = 0; i < 38 && P.agents.length < P.max; i++) {
          const a = { ...base, phase: r() * 100, vent: v, ang: r() * 6.283, hh: lerp(0.15, 0.85, r()) * v.h, w: (r() < 0.5 ? -1 : 1) * lerp(0.05, 0.2, r()), size: size(), p: v.top.clone() };
          P.agents.push(a); out.push(a);
        }
      } else {
        for (let i = 0; i < 60 && P.agents.length < P.max; i++) { const a = { ...base, phase: r() * 100, orbit: lerp(1.5, 6, r()), ang: r() * 6.283, hy: lerp(-1.4, 1.2, r()), w: (r() < 0.5 ? -1 : 1) * lerp(0.15, 0.5, r()), size: size(), p: cam.clone() }; P.agents.push(a); out.push(a); }
      }
      return out[0] || null;
    }
    if (P.agents.length >= P.max) return null;
    let p;
    if (['benthic', 'tripod', 'fixed', 'bed', 'nearfloor'].includes(mode)) {
      let x, z, tries = 0;
      do {
        const ang = front ? Math.atan2(fwd.x, fwd.z) + (r() - 0.5) * 0.9 : r() * 6.283, dist = front ? lerp(3, 7, r()) : lerp(3, R * 0.8, r());
        x = cam.x + Math.sin(ang) * dist; z = cam.z + Math.cos(ang) * dist;
        if (mode === 'bed' && this.F.vents.length) { const v = this.F.vents[Math.floor(r() * this.F.vents.length)]; const a2 = r() * 6.283, d2 = lerp(2.5, 8, r()); x = v.x + Math.cos(a2) * d2; z = v.z + Math.sin(a2) * d2; }
      } while (++tries < 6 && Math.abs(fl(x, z) - floorY) > 25);
      const y = fl(x, z) + (mode === 'nearfloor' ? lerp(0.6, 3, r()) : mode === 'tripod' ? 0.6 * sp.size : 0);
      p = new THREE.Vector3(x, y, z);
    } else if (mode === 'surface') { p = pick(4, 22, 0.5); p.y = -0.08; }
    else if (mode === 'hero') {
      /* o cachalote atravessa a vista a uma distância segura */
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize(), fh = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      p = cam.clone().addScaledVector(fh, 16).addScaledVector(side, -26); p.y = cam.y - 2;
      const a = { ...base, p, size: sp.size, yaw: Math.atan2(-side.z, side.x), hero: true, life: 0 };
      P.agents.push(a); return a;
    } else { const deep = E.depth > 300; p = clampY(pick(near ? Math.max(1.2, sp.size * 5) : deep ? 3 : R * 0.4, near ? Math.max(2.2, sp.size * 9) : deep ? 16 : R * 0.85, near ? 1 : 0.85)); }
    const a = { ...base, p, size: size(), home: p.clone(), tgt: p.clone() };
    if (mode === 'drift' || UPRIGHT.has(sp.model)) a.pitch = 0;
    P.agents.push(a);
    return a;
  }

  step(P, dt, floorY) {
    const E = this.E, cam = E.camera.position, sp = P.sp, r = this.R, mode = sp.mode, spd = SPEED[sp.model] || 0.1, t = E.time;
    for (const S of P.schools) {
      S.turn += (r() - 0.5) * dt * 0.8; S.turn *= 0.98; S.yaw += S.turn * dt;
      const away = S.c.clone().sub(cam); away.y = 0; const dc = away.length();
      if (dc < 5) S.yaw += Math.sign(Math.sin(Math.atan2(away.x, away.z) - S.yaw)) * dt * 1.5;
      S.c.x += -Math.sin(S.yaw) * S.spd * dt * -1; S.c.z += -Math.cos(S.yaw) * S.spd * dt * -1;
      S.c.y = clamp(S.c.y + Math.sin(t * 0.3 + S.yaw) * 0.05 * dt, -sp.depth[1] + 1, Math.min(-sp.depth[0], -0.5));
      S.n = 0;
    }
    P.schools = P.schools.filter(S => P.agents.some(a => a.school === S));
    for (const a of P.agents) {
      a.t += dt;
      if (a.frozen) { a.swim = a.swim || 3; continue; }
      if (a.school) {
        a.school.n++;
        const S = a.school, cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
        const tgt = new THREE.Vector3(S.c.x + a.off.x * cy + a.off.z * sy, S.c.y + a.off.y, S.c.z - a.off.x * sy + a.off.z * cy);
        tgt.x += Math.sin(t * 0.7 + a.phase) * 0.15 * sp.size * 4; tgt.y += Math.cos(t * 0.5 + a.phase) * 0.1 * sp.size * 4;
        const dv = tgt.sub(a.p); a.v.lerp(dv.multiplyScalar(1.2), 1 - Math.exp(-dt * 2));
        this._avoid(a, cam, dt);
        a.p.addScaledVector(a.v, dt);
        const hv = Math.hypot(a.v.x, a.v.z);
        if (hv > 0.02) a.yaw = lerpAng(a.yaw, Math.atan2(a.v.x, a.v.z) - Math.PI / 2, 1 - Math.exp(-dt * 4));
        a.swim = 3 + hv / Math.max(0.05, sp.size) * 1.6;
        continue;
      }
      if (a.vent) {
        const v = a.vent; a.ang += a.w * dt / Math.max(0.3, v.r);
        const rr = v.r * (1.25 - 0.6 * a.hh / v.h) + 0.08 + Math.sin(t * 2 + a.phase) * 0.05;
        a.p.set(v.x + Math.cos(a.ang) * rr, v.base + a.hh + Math.sin(t * 1.3 + a.phase) * 0.06, v.z + Math.sin(a.ang) * rr);
        a.yaw = tanYaw(a.ang, a.w); a.swim = 9; a.pitch = 0.5;
        continue;
      }
      if (a.orbit) {
        const sub = E.sub.p; a.ang += a.w * dt / a.orbit * 2;
        const fy = this.F.heightAt(sub.x, sub.z);
        a.p.set(sub.x + Math.cos(a.ang) * a.orbit, Math.max(fy + 0.15, sub.y + a.hy) + Math.sin(t * 3 + a.phase) * 0.2, sub.z + Math.sin(a.ang) * a.orbit);
        a.yaw = tanYaw(a.ang, a.w); a.swim = 14;
        continue;
      }
      switch (mode) {
        case 'hero': {
          a.life += dt;
          const f = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
          a.p.addScaledVector(f, spd * dt); a.p.y += Math.sin(a.life * 0.2) * 0.1 * dt;
          a.swim = 1.2;
          if (a.life > 70) a.dead = true;
          break;
        }
        case 'benthic': case 'fixed': case 'bed': case 'tripod': {
          if (mode === 'benthic') { const f = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw)); a.p.addScaledVector(f, spd * dt); a.yaw += Math.sin(t * 0.05 + a.phase) * 0.02 * dt; a.p.y = this.F.heightAt(a.p.x, a.p.z); }
          a.swim = 0.8;
          break;
        }
        default: {
          /* vaguear lento à volta de um ponto */
          if (!a.tgt || a.p.distanceTo(a.tgt) < 0.5 || r() < dt * 0.05) {
            a.tgt = a.home.clone().add(new THREE.Vector3((r() - 0.5) * 12, (r() - 0.5) * 4, (r() - 0.5) * 12));
            if (mode === 'nearfloor') a.tgt.y = this.F.heightAt(a.tgt.x, a.tgt.z) + lerp(0.5, 2.5, r());
            else a.tgt.y = clamp(a.tgt.y, -sp.depth[1] + 1, Math.min(-sp.depth[0], -0.3));
          }
          const dv = a.tgt.clone().sub(a.p); const L = dv.length();
          a.v.lerp(dv.multiplyScalar(spd / Math.max(L, 1e-3)), 1 - Math.exp(-dt * 0.8));
          this._avoid(a, cam, dt);
          a.p.addScaledVector(a.v, dt);
          if (mode === 'surface') a.p.y = -0.08;
          if (!UPRIGHT.has(sp.model) && mode !== 'drift' && mode !== 'surface') {
            const hv = Math.hypot(a.v.x, a.v.z);
            if (hv > 0.005) a.yaw = lerpAng(a.yaw, Math.atan2(a.v.x, a.v.z) - Math.PI / 2, 1 - Math.exp(-dt * 2));
            a.pitch = lerp(a.pitch, clamp(a.v.y / Math.max(hv, 0.05), -0.5, 0.5), 1 - Math.exp(-dt * 2));
          } else a.yaw += dt * 0.05;
          a.swim = mode === 'drift' ? 2.4 : 2 + a.v.length() / Math.max(0.05, sp.size) * 2;
          if (sp.model === 'angler' || sp.model === 'dumbo') a.swim = 1.6;
        }
      }
      /* luz própria */
      if (sp.biolum) {
        const dc = a.p.distanceTo(cam);
        const disturbed = dc < (E.lights ? 3 : 7) + sp.size * 4 || a === this.selected;
        if (sp.model === 'atolla') a.glow = lerp(a.glow, disturbed ? 1.6 : 0.3, 1 - Math.exp(-dt * 3));
        else if (sp.model === 'vampire') a.glow = disturbed ? 0.9 + 0.5 * Math.sin(t * 9 + a.phase) : 0.25;
        else if (sp.model === 'siphono') a.glow = 0.2 + (disturbed ? 1.2 : 0) * Math.max(0, Math.sin(t * 5 + a.phase));
        else if (sp.model === 'angler') a.glow = 0.75 + 0.25 * Math.sin(t * 1.3 + a.phase);
        else a.glow = 1;
      }
    }
    if (mode === 'hero') P.agents = P.agents.filter(a => !a.dead);
  }
  _avoid(a, cam, dt) {
    const d = a.p.distanceTo(cam), m = 1.2 + a.sp.size * 1.5;
    if (d < m) { const push = a.p.clone().sub(cam).normalize().multiplyScalar((m - d) * 2); a.v.addScaledVector(push, dt * 4); }
  }

  write(P) {
    const n = Math.min(P.agents.length, P.max), A = P.attr.array, m = this._m, q = this._q, s = this._s, e = this._e;
    for (let i = 0; i < n; i++) {
      const a = P.agents[i];
      e.set(0, a.yaw || 0, UPRIGHT.has(P.sp.model) ? 0 : (a.pitch || 0), 'YZX');
      q.setFromEuler(e); s.setScalar(a.size);
      m.compose(a.p, q, s); P.mesh.setMatrixAt(i, m);
      A[i * 4] = a.phase; A[i * 4 + 1] = a.glow ?? 1; A[i * 4 + 2] = a.swim || 3;
    }
    P.mesh.count = n;
    if (n) { P.mesh.instanceMatrix.needsUpdate = true; P.attr.needsUpdate = true; }
  }

  /** distância ao animal mais próximo no centro da vista (para a exposição dos faróis) */
  nearestAhead() {
    const E = this.E, cam = E.camera.position, f = this._fw || (this._fw = new THREE.Vector3()); E.camera.getWorldDirection(f);
    let best = null; const v = this._tv || (this._tv = new THREE.Vector3());
    for (const P of this.pools) for (let i = 0; i < Math.min(P.agents.length, P.max); i++) {
      const a = P.agents[i]; v.subVectors(a.p, cam); const d = v.length(); if (d > 12 || d < 0.05) continue;
      if (v.dot(f) / d < 0.8 || a.size * 40 < d) continue;
      if (best === null || d < best) best = d;
    }
    return best;
  }
  /** animal mais próximo do cursor (ndc), ou null */
  pick(ndc) {
    const E = this.E, cam = E.camera.position; let best = null, bd = 1e9;
    const pxPerM = E.h / (2 * Math.tan(E.camera.fov * Math.PI / 360));
    for (const P of this.pools) for (let i = 0; i < Math.min(P.agents.length, P.max); i++) {
      const a = P.agents[i], d = a.p.distanceTo(cam); if (d > 45) continue;
      const s = E.project(a.p); if (!s) continue;
      const rad = Math.max(14, a.size * 0.7 * pxPerM / d);
      const dx = s.x - ndc.cx, dy = s.y - ndc.cy, dist = Math.hypot(dx, dy);
      if (dist < rad && dist + d * 0.5 < bd) { bd = dist + d * 0.5; best = a; }
    }
    return best;
  }
  /** garante um exemplar à vista (para "Ir ver") */
  summon(id) {
    const P = this.byId.get(id); if (!P) return null;
    const near = P.agents.filter(a => a.p.distanceTo(this.E.camera.position) < 14);
    if (near.length) return near[0];
    const floorY = this.F.heightAt(this.E.camera.position.x, this.E.camera.position.z);
    return this.spawn(P, { R: this.visRadius(), floorY, front: true, near: true });
  }
  spawnHero() { const P = this.byId.get('physeter'); if (P && !P.agents.length) return this.spawn(P, {}); return P?.agents[0] || null; }
  counts() { const o = {}; for (const P of this.pools) o[P.sp.id] = Math.min(P.agents.length, P.max); return o; }
  dispose() { this.E.scene.remove(this.group); for (const P of this.pools) { P.mesh.geometry.dispose(); P.mesh.dispose(); } }
}
/* rumo tangente a um círculo percorrido no sentido de w (modelo com frente em +x) */
const tanYaw = (ang, w) => { const s = Math.sign(w) || 1; return Math.atan2(-Math.cos(ang) * s, -Math.sin(ang) * s); };
const lerpAng = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
