/* ══════════════════════════════════════════════════════════════════════
   Estúdio virtual — esquemas de luz.

   az: graus a partir do eixo da câmara (negativo = à esquerda da câmara)
   el: graus acima dos olhos · dist: metros até ao rosto
   power: stops RELATIVOS — depois de aplicar, o estúdio desloca todas as
   potências em bloco até o fotómetro dar a abertura pedida (`fnum`), como
   se faz num estúdio a sério (mede-se e acerta-se a principal, as razões
   ficam). `lockPower` desliga esse acerto.
   O texto curto de cada esquema completa o que PhotoLightArt já explica
   (como/sinal/porquê/cuidado) — aqui fica só o que é próprio do estúdio 3D.
   ══════════════════════════════════════════════════════════════════════ */
export const PRESETS = [
  {
    id: 'rembrandt', name: 'Rembrandt', lp: 'rembrandt',
    hint: 'Uma softbox a 45° e alta. Procura o triângulo de luz na face escura.',
    lights: [{ role: 'key', mod: 'softbox', az: -55, el: 45, dist: 1.5, power: 0 }],
    paper: 'charcoal', bdDist: 2.4, fnum: 8, yaw: 0,
  },
  {
    id: 'loop', name: 'Loop', lp: 'loop',
    hint: 'Principal a 30°, pouco acima dos olhos, e um rebatedor branco a abrir as sombras.',
    lights: [
      { role: 'key', mod: 'softbox', az: -30, el: 22, dist: 1.4, power: 0 },
      { role: 'bounce', surface: 'white', az: 60, el: -8, dist: 1.3 },
    ],
    paper: 'grey', bdDist: 2.6, fnum: 8, yaw: 0,
  },
  {
    id: 'butterfly', name: 'Butterfly', lp: 'butterfly',
    hint: 'Beauty dish na girafa, por cima da câmara. A sombra do nariz cai a direito.',
    lights: [{ role: 'key', mod: 'dish', az: 0, el: 42, dist: 1.05, power: 0 }],
    paper: 'grey', bdDist: 2.6, fnum: 8, yaw: 0,
  },
  {
    id: 'split', name: 'Split', lp: 'split',
    hint: 'Uma só fonte dura a 90°. A linha de sombra passa pelo meio do nariz.',
    lights: [{ role: 'key', mod: 'bare', az: -90, el: 4, dist: 1.25, power: 0 }],
    paper: 'black', bdDist: 3, fnum: 8, yaw: 0,
  },
  {
    id: 'clamshell', name: 'Clamshell', lp: 'clamshell',
    hint: 'Dish por cima e um refletor prateado por baixo do queixo: duas luzes em concha.',
    lights: [
      { role: 'key', mod: 'dish', az: 0, el: 40, dist: 0.95, power: 0 },
      { role: 'bounce', surface: 'silver', az: 0, el: -58, dist: 0.52, tilt: 0 },
    ],
    paper: 'white', bdDist: 2.4, fnum: 8, yaw: 0, frame: 'face',
  },
  {
    id: 'three-point', name: 'Três pontos', lp: 'three-point',
    hint: 'Principal, preenchimento ~1,7 stops abaixo e um recorte atrás para descolar do fundo.',
    lights: [
      { role: 'key', mod: 'softbox', az: -40, el: 30, dist: 1.4, power: 0 },
      { role: 'fill', mod: 'octa', az: 45, el: 8, dist: 2.3, power: -1.7 },
      { role: 'rim', mod: 'strip', az: 150, el: 22, dist: 1.35, power: -0.6 },
    ],
    paper: 'charcoal', bdDist: 2.8, fnum: 8, yaw: 0,
  },
  {
    id: 'high-key', name: 'High key', lp: 'high-key',
    hint: 'Duas luzes no fundo branco, ~1,5 stops acima do rosto, e luz ampla à frente.',
    lights: [
      { role: 'key', mod: 'octa', az: -15, el: 18, dist: 1.6, power: 0 },
      { role: 'bounce', surface: 'white', az: 50, el: -5, dist: 1.0 },
      { role: 'bg', mod: 'umbrella', az: -145, el: 6, dist: 1.5, power: 0.4, aim: 'backdrop' },
      { role: 'bg', mod: 'umbrella', az: 145, el: 6, dist: 1.5, power: 0.4, aim: 'backdrop' },
    ],
    paper: 'white', bdDist: 2.2, fnum: 8, yaw: 0,
  },
  {
    id: 'low-key', name: 'Low key', lp: 'low-key',
    hint: 'Uma grelha estreita, fundo preto bem longe. Só uma parte do rosto emerge.',
    lights: [{ role: 'key', mod: 'grid', az: -65, el: 32, dist: 1.15, power: 0 }],
    paper: 'black', bdDist: 3.6, fnum: 8, yaw: 0,
  },
  {
    id: 'cinematic', name: 'Cinemático', lp: null,
    hint: 'Principal quente e lateral, recorte frio por trás e uma mancha azul no fundo. Contraste de cor, não só de luz.',
    lights: [
      { role: 'key', mod: 'strip', az: -70, el: 14, dist: 1.15, power: 0, kelvin: 5600, gel: 'cto' },
      { role: 'rim', mod: 'grid', az: 140, el: 24, dist: 1.4, power: 0.4, gel: 'teal' },
      { role: 'bg', mod: 'grid', az: 165, el: -12, dist: 1.1, power: -0.6, gel: 'blue', aim: 'backdrop', tilt: 6, feather: 12 },
    ],
    paper: 'charcoal', bdDist: 2.8, fnum: 4, yaw: -12, cam: { wb: 4600 },
  },
  {
    id: 'short', name: 'Short', lp: 'short',
    hint: 'Rosto virado; a luz cai no lado que se afasta da câmara. Afina o rosto.',
    lights: [{ role: 'key', mod: 'softbox', az: 45, el: 30, dist: 1.35, power: 0 }],
    paper: 'charcoal', bdDist: 2.6, fnum: 8, yaw: 30,
  },
  {
    id: 'broad', name: 'Broad', lp: 'broad',
    hint: 'Mesmo rosto virado; agora a luz cai no lado virado à câmara. Abre e alarga.',
    lights: [{ role: 'key', mod: 'softbox', az: -50, el: 30, dist: 1.35, power: 0 }],
    paper: 'charcoal', bdDist: 2.6, fnum: 8, yaw: 30,
  },
  {
    id: 'rim', name: 'Contraluz', lp: 'rim',
    hint: 'Duas stripbox atrás, a desenhar o contorno. Uma chave fraca à frente só para os olhos.',
    lights: [
      { role: 'rim', mod: 'strip', az: -135, el: 12, dist: 1.3, power: 0 },
      { role: 'rim', mod: 'strip', az: 135, el: 12, dist: 1.3, power: 0 },
      { role: 'fill', mod: 'octa', az: 10, el: 10, dist: 2.4, power: -3 },
    ],
    paper: 'black', bdDist: 3.2, fnum: 5.6, yaw: 0, meterOn: 'rim',
  },
];

export const DEFAULT_CAM = { focal: 85, iso: 100, shutter: 1 / 160, wb: 5600, dist: 2.2, height: 1.48, az: 0, orient: 'portrait' };

/** Paradas normalizadas (1/3 stop) para os seletores */
export const APERTURES = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const SHUTTERS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 800, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000];
export const ISOS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 12800];
export const FOCALS = [24, 28, 35, 50, 70, 85, 105, 135, 200];

export const fmtShutter = t => (t >= 1 ? t + ' s' : '1/' + Math.round(1 / t));
export const fmtF = n => 'f/' + (n >= 10 ? Math.round(n) : (+n.toFixed(1)).toString().replace('.', ','));
export const fmtPower = p => {
  const den = Math.pow(2, -p);
  if (den <= 1.01) return '1/1';
  const near = Math.round(den);
  if (Math.abs(near - den) / den < 0.04 && (near & (near - 1)) === 0) return '1/' + near;
  /* como nos flashes: a parada inteira abaixo + décimos de stop acima dela */
  const base = Math.pow(2, Math.ceil(Math.log2(den) - 1e-9));
  const tenths = Math.round((Math.log2(base) - Math.log2(den)) * 10) / 10;
  return '1/' + base + (tenths ? ' +' + String(tenths).replace('.', ',') : '');
};
