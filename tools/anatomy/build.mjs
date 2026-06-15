/* ──────────────────────────────────────────────────────────────────────────
   build-anatomy — BodyParts3D (CC-BY-SA) → per-system GLB atlas for the web
   ----------------------------------------------------------------------------
   Source : BodyParts3D 3.0 obj_99 (99% poly-reduced OBJ, FMA-named, ONE shared
            coordinate space so every part self-assembles → no manual alignment).
   Output : assets/models/anatomy/<system>.glb   (one named node per structure)
            data/anatomy/manifest.json            (PT/EN names, function, facts)

   Node-only (no Blender/Python). OBJ → @gltf-transform Document → weld → meshopt.

   Usage:
     node tools/anatomy/build.mjs --index        # list every FMA id present in the zip
     node tools/anatomy/build.mjs --check         # report which curated ids are missing
     node tools/anatomy/build.mjs                 # build GLBs + manifest
   ────────────────────────────────────────────────────────────────────────── */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yauzl from 'yauzl';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WORK = join(HERE, '_work');
const ZIP  = join(WORK, 'obj99.zip');
const OUT_MODELS = join(ROOT, 'assets', 'models', 'anatomy');
const OUT_DATA   = join(ROOT, 'data', 'anatomy');

const { SYSTEMS, STRUCTURES } = await import('./curation.mjs');

/* ── 1. read the whole zip into an in-memory map  id(lowercased name) → buffer ─ */
function readZip(zipPath) {
  return new Promise((resolve, reject) => {
    const entries = new Map();                 // "FMA9611" → Buffer (obj text)
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('entry', (entry) => {
        const m = /([A-Za-z]+\d+)\.obj$/.exec(entry.fileName);
        if (!m) { zip.readEntry(); return; }
        zip.openReadStream(entry, (e, rs) => {
          if (e) return reject(e);
          const chunks = [];
          rs.on('data', (c) => chunks.push(c));
          rs.on('end', () => { entries.set(m[1], Buffer.concat(chunks)); zip.readEntry(); });
        });
      });
      zip.on('end', () => resolve(entries));
      zip.readEntry();
    });
  });
}

/* ── 2. minimal OBJ parser → {positions:Float32Array, indices:Uint32Array} ──── */
function parseOBJ(buf) {
  const text = buf.toString('utf8');
  const verts = [];           // flat x,y,z
  const idx = [];
  let nl = 0;
  for (let i = 0, n = text.length; i < n; i++) {
    // read a line
    let j = text.indexOf('\n', i); if (j < 0) j = n;
    const line = text.slice(i, j); i = j;
    if (line.charCodeAt(0) === 118 /* v */ && line.charCodeAt(1) === 32) {
      const p = line.split(/\s+/);
      verts.push(+p[1], +p[2], +p[3]);
    } else if (line.charCodeAt(0) === 102 /* f */ && line.charCodeAt(1) === 32) {
      const p = line.trim().split(/\s+/);
      // f v/vt/vn … — take vertex index only; triangulate polygon as a fan
      const vi = [];
      for (let k = 1; k < p.length; k++) {
        const s = p[k]; if (!s) continue;
        let a = parseInt(s, 10); if (a < 0) a = verts.length / 3 + a + 1;
        vi.push(a - 1);
      }
      for (let k = 1; k + 1 < vi.length; k++) idx.push(vi[0], vi[k], vi[k + 1]);
    }
    nl++;
  }
  return { positions: new Float32Array(verts), indices: new Uint32Array(idx) };
}

/* compute per-vertex (smooth) normals */
function computeNormals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l;
  }
  return nrm;
}

/* ── 3. global normalization: detect vertical axis from union bbox, build a
        transform that stands the body Y-up, feet at y=0, centred on X/Z. ───── */
function unionBounds(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { positions } of parts) {
    for (let i = 0; i < positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        const v = positions[i + a];
        if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v;
      }
    }
  }
  return { lo, hi, size: [hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]] };
}

async function main() {
  const mode = process.argv.includes('--index') ? 'index'
            : process.argv.includes('--check') ? 'check' : 'build';

  if (!existsSync(ZIP)) { console.error('Missing', ZIP, '— download obj_99.zip first.'); process.exit(1); }
  console.log('Reading zip…');
  const zip = await readZip(ZIP);
  console.log('OBJ entries in zip:', zip.size);

  const names = JSON.parse(readFileSync(join(WORK, 'names.json'), 'utf8'));
  const presentIds = [...zip.keys()];

  if (mode === 'index') {
    presentIds.sort().forEach(id => console.log(id, '\t', names[id] || ''));
    return;
  }

  // resolve every curated structure to one-or-more present OBJ ids.
  // a structure may specify explicit `fma:[...]` and/or `match` (regex on the
  // English name) — `match` auto-captures left/right/sub-part variants.
  const missing = [];
  for (const s of STRUCTURES) {
    const ids = new Set((s.fma || []).filter(id => zip.has(id)));
    if (s.match) {
      const re = new RegExp(s.match, 'i');
      const exclude = s.exclude ? new RegExp(s.exclude, 'i') : null;
      for (const id of presentIds) {
        const nm = names[id] || '';
        if (re.test(nm) && !(exclude && exclude.test(nm))) ids.add(id);
      }
    }
    s._ids = [...ids];
    if (!s._ids.length) missing.push(`${s.key} (${s.system}) — ${s.match ? '/'+s.match+'/' : ''} ${JSON.stringify(s.fma||[])}`);
  }
  if (missing.length) {
    console.log('\n⚠ MISSING meshes for', missing.length, 'structures:');
    missing.forEach(m => console.log('  -', m));
  }
  if (mode === 'check') return;

  // parse all included meshes once, compute global transform
  const parsed = new Map();   // id → geometry
  for (const s of STRUCTURES) for (const id of s._ids)
    if (!parsed.has(id)) parsed.set(id, parseOBJ(zip.get(id)));

  const b = unionBounds([...parsed.values()]);
  const vAxis = b.size.indexOf(Math.max(...b.size));          // vertical = largest extent
  const axes = [0, 1, 2].filter(a => a !== vAxis);            // the two horizontal axes
  const targetH = 16;                                         // scene units, matches old viewer
  const scale = targetH / (b.size[vAxis] || 1);
  const cx = (b.lo[axes[0]] + b.hi[axes[0]]) / 2;
  const cz = (b.lo[axes[1]] + b.hi[axes[1]]) / 2;
  const vMin = b.lo[vAxis];
  // map raw (X,Y,Z) → scene: vertical→Y (feet at 0), horizontals→X,Z centred
  const toScene = (p, i) => {
    const x = (p[i + axes[0]] - cx) * scale;
    const y = (p[i + vAxis] - vMin) * scale;
    const z = (p[i + axes[1]] - cz) * scale;
    return [x, y, z];
  };
  console.log('Vertical axis:', vAxis, 'scale:', scale.toFixed(4));

  mkdirSync(OUT_MODELS, { recursive: true });
  mkdirSync(OUT_DATA, { recursive: true });
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const manifest = { systems: SYSTEMS, structures: [] };

  for (const sys of SYSTEMS) {
    const members = STRUCTURES.filter(s => s.system === sys.id && s._ids.length);
    if (!members.length) continue;
    const doc = new Document();
    const buffer = doc.createBuffer();
    const scene = doc.createScene();
    const mat = doc.createMaterial(sys.id)
      .setBaseColorFactor([...hexRGB(sys.color), 1])
      .setRoughnessFactor(0.6).setMetallicFactor(0.0);

    for (const s of members) {
      // merge all laterality variants into one named node
      const node = doc.createNode(s.key);
      s._ids.forEach((id, k) => {
        const g = parsed.get(id);
        const pos = new Float32Array(g.positions.length);
        for (let i = 0; i < g.positions.length; i += 3) {
          const [x, y, z] = toScene(g.positions, i);
          pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
        }
        const nrm = computeNormals(pos, g.indices);
        const prim = doc.createPrimitive()
          .setMaterial(mat)
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
          .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer))
          .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.indices).setBuffer(buffer));
        const mesh = doc.createMesh(`${s.key}_${k}`).addPrimitive(prim);
        if (k === 0) node.setMesh(mesh);
        else { const sub = doc.createNode(`${s.key}_${k}`).setMesh(mesh); node.addChild(sub); }
      });
      scene.addChild(node);
      manifest.structures.push({
        key: s.key, system: s.system, node: s.key,
        pt: s.pt, en: s.en, fn_pt: s.fn_pt, fn_en: s.fn_en,
        loc_pt: s.loc_pt, loc_en: s.loc_en, facts_pt: s.facts_pt || [], facts_en: s.facts_en || [],
      });
    }

    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.008, lockBorder: false }),
      dedup(), prune()
    );
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
    const glb = await io.writeBinary(doc);
    writeFileSync(join(OUT_MODELS, `${sys.id}.glb`), glb);
    console.log(`✓ ${sys.id}.glb  (${members.length} structures, ${(glb.byteLength/1024).toFixed(0)} KB)`);
  }

  writeFileSync(join(OUT_DATA, 'manifest.json'), JSON.stringify(manifest));
  console.log(`✓ manifest.json  (${manifest.structures.length} structures, ${SYSTEMS.length} systems)`);
}

function hexRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  // linearize for glTF baseColorFactor (sRGB→linear approx)
  return [((n >> 16) & 255), ((n >> 8) & 255), (n & 255)].map(c => {
    const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
