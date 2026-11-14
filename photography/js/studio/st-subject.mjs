/* ══════════════════════════════════════════════════════════════════════
   Sujeito 3D (pessoa sintética MakeHuman, CC0 — ver assets/models/studio/
   CREDITS.md), partilhado pelo Estúdio e pelo Exterior.

   `wrap` recebe cada material com luz: o Estúdio passa studioMaterial (patch
   das sombras das luzes de área); o Exterior usa os materiais tal como estão.
   ══════════════════════════════════════════════════════════════════════ */
import { THREE, GLTFLoader, canvasTex, noiseField } from './st-core.mjs';

const BASE = '/assets/models/studio/';

export async function loadSubject({ wrap = m => m, onProgress } = {}) {
  const tl = new THREE.TextureLoader();
  const tex = (n, srgb = true) => new Promise(res => tl.load(BASE + 'tex/' + n + '.webp', t => {
    t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; onProgress?.(); res(t);
  }, undefined, () => res(null)));
  const [gltf, skin, eye, hair, brows, lashes, clothes, clothesN, clothesAO, shoes] = await Promise.all([
    new GLTFLoader().loadAsync(BASE + 'subject.glb'),
    tex('skin'), tex('eye'), tex('hair'), tex('brows'), tex('lashes'), tex('clothes'), tex('clothes-n', false), tex('clothes-ao', false), tex('shoes'),
  ]);
  const ex = gltf.scene.userData || {};
  /* poros: mapa de normais procedural muito fino, repetido */
  const pores = canvasTex(256, 256, (c, w, h) => {
    const n = noiseField(w, h, 2, 77), m = noiseField(w, h, 6, 78);
    const im = c.createImageData(w, h);
    const H = (x, y) => n[((y + h) % h) * w + ((x + w) % w)] * 0.7 + m[((y + h) % h) * w + ((x + w) % w)] * 0.3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
      const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1, l = Math.hypot(nx, ny, nz);
      im.data.set([(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255, 255], (y * w + x) * 4);
    }
    c.putImageData(im, 0, 0);
  }, { srgb: false, repeat: [24, 24] });
  const M = {
    body: wrap(new THREE.MeshPhysicalMaterial({ map: skin, roughness: 0.5, normalMap: pores, normalScale: new THREE.Vector2(0.06, 0.06), sheen: 0.25, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.55, 0.38, 0.33), envMapIntensity: 0 }), { skin: true }),
    eyes: wrap(new THREE.MeshStandardMaterial({ map: eye, roughness: 0.35, envMapIntensity: 0 })),
    cornea: new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.035, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0 }),
    hair: wrap(new THREE.MeshStandardMaterial({ map: hair, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.42, envMapIntensity: 0 })),
    brows: wrap(new THREE.MeshStandardMaterial({ map: brows, transparent: true, depthWrite: false, roughness: 0.7, envMapIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 })),
    lashes: wrap(new THREE.MeshStandardMaterial({ map: lashes, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0 })),
    clothes: wrap(new THREE.MeshStandardMaterial({ map: clothes, normalMap: clothesN, aoMap: clothesAO, aoMapIntensity: 0.8, roughness: 0.88, envMapIntensity: 0 })),
    shoes: wrap(new THREE.MeshStandardMaterial({ map: shoes, roughness: 0.55, envMapIntensity: 0 })),
  };
  /* a córnea só soma especular: shading normal mas sem sombra própria */
  wrap(M.cornea);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = M[o.name] || M.body;
    o.castShadow = !['cornea', 'brows', 'lashes'].includes(o.name);
    o.receiveShadow = true;
    o.userData.subject = true;
    if (o.name === 'brows' || o.name === 'lashes') o.renderOrder = 2;
    if (o.name === 'cornea') o.renderOrder = 3;
  });
  return { group: gltf.scene, mats: M, ref: ex.ref || null };
}
