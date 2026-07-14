/* Optional post-processing: chroma-key a solid green background to alpha and
   emit an optimised WebP. Requires `sharp` (npm i sharp). If sharp is missing
   the caller falls back to writing the raw PNG on the green background. */

export async function trySharp() {
  try { return (await import('sharp')).default; }
  catch { return null; }
}

// Green-screen key: pixels where green clearly dominates → transparent, with a
// soft edge and light green-spill suppression. Tunables come from the manifest.
export async function greenScreenToWebp(pngBuffer, out, opt = {}) {
  const sharp = await trySharp();
  if (!sharp) return false;
  const key = opt.key ?? 0.28;       // green dominance to start cutting
  const soft = opt.soft ?? 0.12;     // feather width
  const maxW = opt.maxWidth ?? 900;  // resize for the web

  const src = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const greenness = (g - Math.max(r, b)) / 255;
    if (greenness > key + soft) { data[i + 3] = 0; }
    else if (greenness > key) {
      data[i + 3] = Math.round(255 * (1 - (greenness - key) / soft));
      // suppress green spill on the fringe
      const avg = (r + b) / 2; if (g > avg) data[i + 1] = Math.round(avg + (g - avg) * 0.4);
    }
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
    .resize({ width: Math.min(maxW, info.width), withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(out);
  return true;
}

// High-key WHITE background → alpha. More reliable than green with most
// photoreal SDXL checkpoints (they render cleaner seamless white than a flat
// chroma green). Protects coloured/dark pixels; only near-white low-chroma
// pixels are cut, so neutral-grey wardrobe survives.
export async function whiteScreenToWebp(pngBuffer, out, opt = {}) {
  const sharp = await trySharp();
  if (!sharp) return false;
  const hi = opt.hi ?? 244;        // >= → fully transparent
  const lo = opt.lo ?? 226;        // <= → fully opaque; between → feather
  const chroma = opt.chroma ?? 22; // max (maxC-minC) to still count as "white"
  const maxW = opt.maxWidth ?? 900;

  const src = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    if (mx - mn > chroma) continue;           // coloured → keep
    if (mn >= hi) data[i + 3] = 0;
    else if (mn > lo) data[i + 3] = Math.round(255 * (1 - (mn - lo) / (hi - lo)));
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } })
    .resize({ width: Math.min(maxW, info.width), withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(out);
  return true;
}

// Background removal on the CPU via @imgly/background-removal-node (onnxruntime).
// GPU-independent — the reliable path when a ComfyUI rembg node can't run
// (e.g. ROCm/MIOpen errors). First run downloads the model (~44 MB, cached).
export async function imglyToWebp(pngBuffer, out, opt = {}) {
  let removeBackground;
  try { ({ removeBackground } = await import('@imgly/background-removal-node')); }
  catch { return false; }
  // Os recursos (resources.json + modelos onnx) vivem na dist do pacote; aponta
  // o publicPath para lá (a lib resolveria mal a partir do cwd do repo).
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const { dirname } = await import('node:path');
  const req = createRequire(import.meta.url);
  const distDir = dirname(req.resolve('@imgly/background-removal-node'));
  const input = new Blob([pngBuffer], { type: 'image/png' });   // a lib precisa do mime
  const blob = await removeBackground(input, {
    publicPath: pathToFileURL(distDir + '/').href,
    model: opt.model || 'medium',   // 'small' | 'medium' | 'large'
    output: { format: 'image/png' },
  });
  const cut = Buffer.from(await blob.arrayBuffer());
  const sharp = await trySharp();
  if (!sharp) return { png: cut };  // sem sharp → caller grava PNG com alpha
  await sharp(cut)
    .resize({ width: Math.min(opt.maxWidth ?? 900, 4096), withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 90, effort: 5 })
    .toFile(out);
  return true;
}

// No transparency needed (scenes): just optimise to WebP.
export async function toWebp(pngBuffer, out, opt = {}) {
  const sharp = await trySharp();
  if (!sharp) return false;
  await sharp(pngBuffer)
    .resize({ width: Math.min(opt.maxWidth ?? 1100, 4096), withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 })
    .toFile(out);
  return true;
}
