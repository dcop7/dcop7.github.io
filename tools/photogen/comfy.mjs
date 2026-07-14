/* Minimal ComfyUI API client (dev-only). No external deps — Node ≥18 fetch.
   Talks to a local ComfyUI instance to run a plain SDXL txt2img graph. */
const HOST = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
const CLIENT_ID = 'photogen-' + Math.random().toString(36).slice(2);

export { HOST };

export async function listCheckpoints() {
  const r = await fetch(`${HOST}/object_info/CheckpointLoaderSimple`);
  if (!r.ok) throw new Error(`ComfyUI unreachable at ${HOST} (${r.status})`);
  const j = await r.json();
  return j.CheckpointLoaderSimple.input.required.ckpt_name[0];
}

export async function nodeAvailable(name) {
  const r = await fetch(`${HOST}/object_info/${encodeURIComponent(name)}`);
  if (!r.ok) return false;
  const t = await r.text();
  return t.length > 5 && t.includes(name);
}

// Standard SDXL text-to-image graph in the /prompt API format.
// rembg:'inspyrenet' inserts a background-removal node so SaveImage writes a
// PNG with a real alpha channel (much cleaner than colour-keying).
export function txt2imgGraph(o) {
  const {
    ckpt, positive, negative, seed,
    steps = 30, cfg = 6, sampler = 'dpmpp_2m_sde', scheduler = 'karras',
    width = 832, height = 1216, prefix = 'photogen', rembg = null, rembgJit = 'default',
  } = o;
  const g = {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
    '3': { class_type: 'KSampler', inputs: {
      seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1,
      model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: prefix } },
  };
  if (rembg === 'inspyrenet') {
    g['10'] = { class_type: 'InspyrenetRembg', inputs: { image: ['8', 0], torchscript_jit: rembgJit } };
    g['9'].inputs.images = ['10', 0];
  }
  return g;
}

export async function queue(graph) {
  const r = await fetch(`${HOST}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph, client_id: CLIENT_ID }),
  });
  if (!r.ok) throw new Error(`queue failed ${r.status}: ${await r.text()}`);
  return (await r.json()).prompt_id;
}

export async function waitForImages(promptId, { timeout = 240000, interval = 1500 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await fetch(`${HOST}/history/${promptId}`);
    if (r.ok) {
      const entry = (await r.json())[promptId];
      if (entry?.status?.status_str === 'error') throw new Error('ComfyUI reported an error for ' + promptId);
      if (entry?.outputs) {
        const imgs = [];
        for (const node of Object.values(entry.outputs)) if (node.images) imgs.push(...node.images);
        if (imgs.length) return imgs;
      }
    }
    await new Promise(res => setTimeout(res, interval));
  }
  throw new Error('timed out waiting for ' + promptId);
}

export async function fetchImage(img) {
  const u = new URL(`${HOST}/view`);
  u.searchParams.set('filename', img.filename);
  u.searchParams.set('subfolder', img.subfolder || '');
  u.searchParams.set('type', img.type || 'output');
  const r = await fetch(u);
  if (!r.ok) throw new Error(`fetch image failed ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
