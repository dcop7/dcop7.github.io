# photogen — geração de assets da Fotografia (dev-only)

Gera **imagens estáticas** para a secção Fotografia usando o teu **ComfyUI local**.
É uma ferramenta de *desenvolvimento*: corre na tua máquina, escreve ficheiros
em `assets/photo/` e mais nada. O site continua **100% estático** e funciona
sem estes assets — as ilustrações são desenhadas por código em
`js/pages/photo-illus.js` (SVG) e os diagramas de pose em `js/pages/photography.js`.
Os assets foto-reais só **substituem** esses fallbacks quando existem.

```
Browser ──▶ assets/photo/index.json ──▶ usa <img> se o id existir
                    │
                    └─(ausente/erro)─▶ fallback: SVG procedural
```

## Requisitos

- **ComfyUI** a correr localmente (por omissão `http://127.0.0.1:8188`).
- Um checkpoint **SDXL foto-realista**. O manifesto assume
  `juggernautXL_ragnarokBy.safetensors`; se não existir, usa o primeiro disponível.
- **Node ≥ 18** (usa `fetch` nativo).
- **`cd tools/photogen && npm i`** — instala `sharp` (WebP otimizado) e
  `@imgly/background-removal-node` (recorte de fundo em CPU). O `node_modules`
  fica local a esta pasta e é ignorado pelo git.

### Recorte de fundo (transparência)

Default = **`imgly`** (`"rembg":"imgly"` no manifesto): remoção de fundo em **CPU**
via onnxruntime — limpa e independente da GPU. Corre num **processo-filho isolado**
(`matte-cli.mjs`) porque o onnxruntime *segfaulta* se correr no mesmo processo a
seguir ao trabalho HTTP do ComfyUI. 1ª corrida descarrega o modelo (~44 MB).

Alternativas (`--rembg <modo>` ou `"rembg"` no manifesto):
- `imgly` — CPU, recomendado (default).
- `inspyrenet` — nó `ComfyUI-Inspyrenet-Rembg` (alpha direto do ComfyUI). **Nota:**
  falha em GPUs AMD/ROCm com `miopenStatusUnknownError`. É gated por deteção.
- sem rembg → key por cor (`matte:"white"`/`"green"`), frágil com fundos de IA.

## Uso

```bash
# gera tudo o que ainda não existe (32 steps, qualidade final)
node tools/photogen/generate.mjs

node tools/photogen/generate.mjs --force            # regera tudo
node tools/photogen/generate.mjs --only pose-s-curve
node tools/photogen/generate.mjs --group poses      # só as poses
node tools/photogen/generate.mjs --steps 10         # rascunho rápido p/ testar prompts

# host alternativo
COMFY_HOST=http://127.0.0.1:8188 node tools/photogen/generate.mjs
```

Saída:
- `tools/photogen/out/<id>.png` — PNG cru (NÃO versionar; ver `.gitignore`).
- `assets/photo/<grupo>/<id>.webp` (ou `.png` sem sharp) — asset final.
- `assets/photo/index.json` — mapa `id → caminho`, lido pelo browser.

## Manifesto (`manifest.json`)

- `characters` — descrições fixas e detalhadas → **consistência** entre imagens.
- `styles` — blocos de estilo reutilizáveis (estúdio recorte, retrato de luz…).
- `assets[]` — cada asset: `id`, `group`, `character`, `style`, `prompt`,
  `seed`, `size`, e `matte`:
  - `"white"` (default das poses) — recorta fundo **branco** high-key → alpha.
  - `"green"` — recorta **chroma green** (alternativa).
  - `false` — sem recorte (cenas/retratos de luz).
  - `matteOpts` afina os limiares do recorte por asset.

Os `id` das poses casam com o array `POSES` em `js/pages/photography.js`.

## Notas de qualidade (importante)

- **Steps:** usa ≥ 30 para qualidade final. `--steps 8/10` é só para validar
  prompts — dá artefactos.
- **Consistência de personagem:** a descrição fixa + seed dá uma base, mas SDXL
  não garante o mesmo rosto entre poses. Para consistência forte considera
  IPAdapter / InstantID / um LoRA de personagem (avançado) — revê sempre o
  resultado a olho.
- **Recorte perfeito:** o key por cor/luminância é bom mas pode deixar franjas.
  Para recortes limpos, instala um nó de *background removal* no ComfyUI
  (ex.: `ComfyUI-Inspyrenet-Rembg`) e gera já com alpha.
- **1ª geração é lenta:** o ROCm compila kernels na primeira corrida; as
  seguintes são rápidas.
```
