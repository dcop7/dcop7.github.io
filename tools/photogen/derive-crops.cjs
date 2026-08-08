/* ══════════════════════════════════════════════════════════════════════
   derive-crops — pares de composição CONTROLADOS, tirados da mesma imagem.

   O par mais honesto que existe para ensinar composição é aquele em que
   nada muda excepto onde a moldura foi posta: mesma cena, mesma luz, mesmo
   tratamento, mesmos píxeis. Quando o modelo consegue produzir as duas
   composições a partir de prompts iguais, usam-se dois assets; quando não
   consegue (a simetria é o caso claro — o SDXL nunca aceita estragar um
   reflexo), corta-se aqui.

   `rect` é [x, y, largura, altura] em píxeis da imagem de origem — e a
   origem é o ficheiro JÁ escrito em assets/photo (o pipeline reduz para
   1100px de largura), não o tamanho pedido ao ComfyUI.
   DEV-ONLY, como todo o tools/photogen.
   ════════════════════════════════════════════════════════════════════ */
const sharp = require('sharp');
const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'assets', 'photo');
const W = 1216, H = 832;

const JOBS = [
  // Simetria: o "não aplica" é a MESMA fotografia com a moldura fora do eixo
  // e o reflexo cortado. Ensina melhor do que outra cena — mostra que a
  // simetria é uma decisão de enquadramento e não uma propriedade do sítio.
  { from: 'comp2/comp-symmetry.webp', to: 'comp2/comp-symmetry-bad.webp', id: 'comp-symmetry-bad',
    rect: [290, 0, 810, 580] },
  // Proporção áurea: uma base larga, duas janelas — figura na divisão áurea
  // ou ao centro.
  { from: 'comp-base/base-golden.webp', to: 'comp2/comp-golden.webp', id: 'comp-golden',
    rect: [83, 115, 880, 602] },
  { from: 'comp-base/base-golden.webp', to: 'comp2/comp-golden-bad.webp', id: 'comp-golden-bad',
    rect: [187, 44, 880, 602] },
  // Espaço negativo: a mesma fotografia aberta e fechada. É literalmente a
  // quantidade de vazio que muda, e nada mais.
  { from: 'comp-base/base-negative.webp', to: 'comp2/comp-negative.webp', id: 'comp-negative',
    rect: [0, 1, 1070, 731] },
  { from: 'comp-base/base-negative.webp', to: 'comp2/comp-negative-bad.webp', id: 'comp-negative-bad',
    rect: [13, 178, 700, 479] },
];

(async () => {
  const idxPath = join(OUT, 'index.json');
  const index = JSON.parse(await readFile(idxPath, 'utf8'));
  for (const j of JOBS) {
    await sharp(join(OUT, j.from))
      .extract({ left: j.rect[0], top: j.rect[1], width: j.rect[2], height: j.rect[3] })
      .resize(W, H, { fit: 'fill' })
      .webp({ quality: 88 })
      .toFile(join(OUT, j.to));
    index[j.id] = j.to;
    console.log('•', j.id, '←', j.from, j.rect.join(','));
  }
  await writeFile(idxPath, JSON.stringify(index, null, 2) + '\n');
  console.log('✓ índice atualizado');
})();
