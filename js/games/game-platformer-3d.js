/* ══════════════════════════════════════════════════════════════════
   Ilhas Flutuantes — aventura de plataformas 3D com o Pip.
   4 ilhas no céu, cada uma com uma mecânica nova:
     1. Prado      — saltos, molas, caixotes e geleias (salta-lhes em cima)
     2. Nuvens     — plataformas móveis, nuvens que se desfazem, molas-nuvem
     3. Cristal    — barras de fogo a rodar, bolas de picos, gelo nas bordas
     4. Vulcão     — lava, jatos de fogo e uma subida final
   Cada ilha tem 5 estrelas: a Grande Estrela no fim + 4 escondidas
   (num sítio alto, num desafio de 8 flores azuis, atrás de caixotes, …).

   Física própria (sem motor externo): o Pip é um cilindro (r .35, alto
   1.1) contra caixas alinhadas aos eixos e ilhas redondas (cilindros);
   resolve-se o plano XZ como círculo-contra-retângulo e o eixo Y à parte
   (aterrar / bater com a cabeça). Câmara em terceira pessoa que se pode
   rodar (arrastar / Q E) e segue sozinha por trás quando o Pip corre.
   Comandos: WASD/setas, Espaço (duplo salto), Shift/C no ar = bater no
   chão; no toque, joystick à esquerda e botões à direita.
══════════════════════════════════════════════════════════════════ */
const Platformer3DGame = (function () {
  'use strict';
  const U = ArcadeKit.U, TAU = Math.PI * 2;
  const R = .35, PH = 1.1, GRAV = 30, JUMP = 11.2, JUMP2 = 10, SPEED = 7.2, ACC = 46, AIR = 20, FRIC = 34;

  /* ════════════════════════════════════════════════════════════════
     níveis (objetos: ilhas, caixas, plataformas, inimigos, itens)
     ilha: top em y, raio r.  caixa: centro x,z; topo em y; w,h,d.
  ════════════════════════════════════════════════════════════════ */
  const ring = (cx, y, cz, r, n, k) => Array.from({ length: n }, (_, i) => ({ t: k || 'coin', x: cx + Math.cos(i / n * TAU) * r, y, z: cz + Math.sin(i / n * TAU) * r }));
  const line = (x0, y0, z0, x1, y1, z1, n, k) => Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : .5; return { t: k || 'coin', x: U.lerp(x0, x1, t), y: U.lerp(y0, y1, t), z: U.lerp(z0, z1, t) }; });
  const arc = (x0, z0, x1, z1, y, h, n) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return { t: 'coin', x: U.lerp(x0, x1, t), y: y + Math.sin(t * Math.PI) * h, z: U.lerp(z0, z1, t) }; });

  const LEVELS = [
    { id: 'I1', name: 'Ilha do Prado', theme: 0, par: 150, start: [0, 0, 0], objs: [
      { t: 'isle', x: 0, y: 0, z: 0, r: 7 }, { t: 'tree', x: -4, y: 0, z: -3 }, { t: 'tree', x: -5, y: 0, z: 2 }, { t: 'rock', x: 4, y: 0, z: 4 }, { t: 'flowers', x: 2, y: 0, z: -4 },
      ...ring(0, .8, 0, 3.5, 8),
      { t: 'sign', x: 2, y: 0, z: 3, txt: 'Salta (Espaço) — duas vezes no ar!' },
      { t: 'box', x: 0, y: 1.2, z: -10, w: 3, h: 1.2, d: 3, m: 'wood' },
      { t: 'box', x: 0, y: 2.4, z: -14.5, w: 3, h: 1.2, d: 3, m: 'wood' },
      ...line(0, 2.2, -10, 0, 3.4, -14.5, 3),
      { t: 'isle', x: 0, y: 3, z: -24, r: 6 }, { t: 'tree', x: 3, y: 3, z: -26 }, { t: 'flowers', x: -3, y: 3, z: -22 },
      { t: 'slime', x: 2, y: 3, z: -22, range: 3 }, { t: 'slime', x: -2, y: 3, z: -26, range: 3, axis: 'z' },
      { t: 'crate', x: -4, y: 3, z: -24 }, { t: 'crate', x: -4, y: 4, z: -24 },
      { t: 'check', x: 0, y: 3, z: -20 },
      { t: 'spring', x: 4, y: 3, z: -22 },
      { t: 'isle', x: 7.5, y: 11, z: -19, r: 2.2 }, { t: 'star', x: 7.5, y: 12.2, z: -19 },
      ...line(4, 5, -22, 6.5, 10, -20, 4),
      { t: 'box', x: 0, y: 4, z: -33, w: 2, h: .8, d: 4, m: 'wood' },
      { t: 'box', x: 0, y: 5, z: -39, w: 2, h: .8, d: 4, m: 'wood' },
      { t: 'box', x: -5, y: 6, z: -42, w: 4, h: .8, d: 2, m: 'wood' },
      ...line(0, 5, -33, 0, 6, -39, 4),
      { t: 'isle', x: -14, y: 6, z: -42, r: 6 }, { t: 'tree', x: -17, y: 6, z: -44 }, { t: 'tree', x: -16, y: 6, z: -39 }, { t: 'rock', x: -11, y: 6, z: -45 },
      { t: 'slime', x: -14, y: 6, z: -40, range: 3 }, { t: 'slime', x: -12, y: 6, z: -44, range: 2, axis: 'z' }, { t: 'slime', x: -16, y: 6, z: -42, range: 2 },
      ...ring(-14, 6.8, -42, 2.5, 8, 'red'),
      { t: 'redstar', x: -14, y: 8, z: -42 },
      { t: 'check', x: -10, y: 6, z: -42 },
      { t: 'crate', x: -18, y: 6, z: -41 }, { t: 'crate', x: -18, y: 6, z: -43 }, { t: 'crate', x: -18, y: 7, z: -42 },
      { t: 'star', x: -19.5, y: 6.6, z: -42, hide: true },
      { t: 'box', x: -14, y: 7.5, z: -52, w: 3, h: 1, d: 3, m: 'stone' },
      { t: 'box', x: -14, y: 9, z: -57, w: 3, h: 1, d: 3, m: 'stone' },
      { t: 'box', x: -9, y: 10.5, z: -59, w: 3, h: 1, d: 3, m: 'stone' },
      { t: 'box', x: -4, y: 12, z: -59, w: 3, h: 1, d: 3, m: 'stone' },
      ...line(-14, 8.4, -52, -4, 12.9, -59, 6),
      { t: 'isle', x: 4, y: 12, z: -62, r: 5 }, { t: 'tree', x: 7, y: 12, z: -64 }, { t: 'flowers', x: 2, y: 12, z: -65 },
      { t: 'star', x: 9, y: 13, z: -58, high: true }, { t: 'box', x: 9, y: 12, z: -58, w: 1.4, h: .6, d: 1.4, m: 'wood' },
      { t: 'goal', x: 4, y: 12, z: -62 },
    ] },
    { id: 'I2', name: 'Ilha das Nuvens', theme: 1, par: 170, start: [0, 0, 0], objs: [
      { t: 'isle', x: 0, y: 0, z: 0, r: 6 }, { t: 'tree', x: -3, y: 0, z: 3 }, { t: 'flowers', x: 3, y: 0, z: 2 },
      { t: 'sign', x: 2, y: 0, z: -3, txt: 'As plataformas mexem-se — espera pelo momento.' },
      { t: 'move', x: 0, y: .6, z: -9, w: 3, h: .6, d: 3, m: 'cloud', ax: 0, ay: 0, az: -9, bx: 0, by: 0, bz: -17, sp: .5 },
      ...line(0, 1.6, -9, 0, 1.6, -17, 5),
      { t: 'isle', x: 0, y: 1, z: -24, r: 4.5 }, { t: 'slime', x: 1, y: 1, z: -24, range: 2.5 },
      { t: 'check', x: -2, y: 1, z: -22 },
      { t: 'crumb', x: 6, y: 1.5, z: -24, w: 2.4, h: .5, d: 2.4 }, { t: 'crumb', x: 10, y: 2.2, z: -24, w: 2.4, h: .5, d: 2.4 }, { t: 'crumb', x: 14, y: 3, z: -24, w: 2.4, h: .5, d: 2.4 }, { t: 'crumb', x: 18, y: 3.8, z: -24, w: 2.4, h: .5, d: 2.4 },
      ...line(6, 2.5, -24, 18, 4.8, -24, 7),
      { t: 'isle', x: 25, y: 4, z: -24, r: 5 }, { t: 'tree', x: 27, y: 4, z: -27 }, { t: 'rock', x: 22, y: 4, z: -27 },
      { t: 'cloudspring', x: 25, y: 4, z: -20 },
      { t: 'isle', x: 25, y: 13, z: -17, r: 2.5 }, { t: 'star', x: 25, y: 14.2, z: -17 },
      { t: 'move', x: 25, y: 4.6, z: -32, w: 3, h: .6, d: 3, m: 'cloud', ax: 25, ay: 4.6, az: -32, bx: 25, by: 10, bz: -32, sp: .4 },
      { t: 'isle', x: 25, y: 10, z: -40, r: 4.5 }, { t: 'slime', x: 26, y: 10, z: -41, range: 2 }, { t: 'slime', x: 23, y: 10, z: -39, range: 2, axis: 'z' },
      { t: 'check', x: 25, y: 10, z: -37 },
      { t: 'move', x: 18, y: 10.4, z: -40, w: 2.5, h: .5, d: 2.5, m: 'cloud', ax: 19, ay: 10.4, az: -40, bx: 9, by: 10.4, bz: -40, sp: .45 },
      { t: 'move', x: 5, y: 11, z: -46, w: 2.5, h: .5, d: 2.5, m: 'cloud', ax: 5, ay: 11, az: -44, bx: 5, by: 11, bz: -54, sp: .5 },
      ...ring(14, 11.4, -40, 0, 1), ...line(9, 11.5, -40, 18, 11.5, -40, 6, 'red'), ...line(5, 12, -45, 5, 12, -54, 2, 'red'),
      { t: 'redstar', x: 0, y: 12.5, z: -58 },
      { t: 'isle', x: 0, y: 11, z: -60, r: 4 },
      { t: 'crate', x: -2, y: 11, z: -62 }, { t: 'crate', x: -2, y: 12, z: -62 }, { t: 'crate', x: -3, y: 11, z: -61 },
      { t: 'star', x: -3.5, y: 11.6, z: -63, hide: true },
      { t: 'crumb', x: 0, y: 12, z: -66, w: 2, h: .5, d: 2 }, { t: 'crumb', x: 0, y: 13, z: -70, w: 2, h: .5, d: 2 }, { t: 'crumb', x: 4, y: 14, z: -73, w: 2, h: .5, d: 2 },
      { t: 'isle', x: 10, y: 14.5, z: -76, r: 5 }, { t: 'tree', x: 13, y: 14.5, z: -78 },
      { t: 'star', x: 6, y: 17.5, z: -80, high: true }, { t: 'box', x: 6, y: 16.2, z: -80, w: 1.6, h: .5, d: 1.6, m: 'cloud' }, { t: 'spring', x: 8, y: 14.5, z: -79 },
      { t: 'goal', x: 11, y: 14.5, z: -74 },
    ] },
    { id: 'I3', name: 'Ilha de Cristal', theme: 2, par: 190, start: [0, 0, 0], objs: [
      { t: 'isle', x: 0, y: 0, z: 0, r: 6 }, { t: 'crystal', x: -3, y: 0, z: 3 }, { t: 'crystal', x: 4, y: 0, z: -2 },
      { t: 'sign', x: 2, y: 0, z: 2, txt: 'Barras de fogo! Salta-as ou passa no momento certo.' },
      { t: 'box', x: 0, y: 0, z: -11, w: 3, h: 2, d: 10, m: 'crystal' },
      { t: 'spinner', x: 0, y: .6, z: -11, len: 4, sp: 1.6 },
      ...line(0, .8, -7, 0, .8, -15, 5),
      { t: 'isle', x: 0, y: 0, z: -22, r: 5 }, { t: 'slime', x: 2, y: 0, z: -22, range: 2 },
      { t: 'check', x: 0, y: 0, z: -18 },
      { t: 'spikeball', x: -3, y: 0, z: -22, ax: -3, az: -25, bx: -3, bz: -19, sp: .7 },
      { t: 'box', x: -3.4, y: 2.5, z: -18.6, w: 1.6, h: 2.5, d: 1.6, m: 'crystal' }, { t: 'star', x: -3.4, y: 3.7, z: -18.6, high: true },
      { t: 'box', x: 8, y: 0, z: -22, w: 8, h: 2, d: 2.4, m: 'crystal' },
      { t: 'spikeball', x: 8, y: 0, z: -22, ax: 5, az: -22, bx: 11, bz: -22, sp: .9 },
      ...line(5, .9, -22, 11, .9, -22, 4),
      { t: 'isle', x: 17, y: 1, z: -22, r: 4.5 }, { t: 'crystal', x: 19, y: 1, z: -24 },
      { t: 'spinner', x: 17, y: 1.6, z: -22, len: 4, sp: -1.3, two: true },
      { t: 'spring', x: 19, y: 1, z: -20 },
      { t: 'isle', x: 21.5, y: 9, z: -16.5, r: 2.2 }, { t: 'star', x: 21.5, y: 10.2, z: -16.5, high: true },
      { t: 'box', x: 17, y: 2.5, z: -31, w: 2.4, h: 1, d: 2.4, m: 'crystal' }, { t: 'box', x: 17, y: 4, z: -36, w: 2.4, h: 1, d: 2.4, m: 'crystal' }, { t: 'box', x: 12, y: 5.5, z: -38, w: 2.4, h: 1, d: 2.4, m: 'crystal' },
      { t: 'isle', x: 4, y: 6, z: -40, r: 5 }, { t: 'crystal', x: 1, y: 6, z: -43 }, { t: 'crystal', x: 7, y: 6, z: -43 },
      { t: 'check', x: 6, y: 6, z: -38 },
      ...ring(4, 6.8, -40, 3.2, 8, 'red'), { t: 'spinner', x: 4, y: 6.6, z: -40, len: 3.6, sp: 1.1 },
      { t: 'redstar', x: 4, y: 8.5, z: -40 },
      { t: 'crate', x: -0.5, y: 6, z: -38 }, { t: 'crate', x: -0.5, y: 6, z: -39 }, { t: 'crate', x: -0.5, y: 7, z: -38.5 },
      { t: 'star', x: 0, y: 6.6, z: -37.5, hide: true },
      { t: 'move', x: 4, y: 6.6, z: -48, w: 2.6, h: .6, d: 2.6, m: 'crystal', ax: 4, ay: 6.6, az: -47, bx: 4, by: 10, bz: -55, sp: .35 },
      { t: 'isle', x: 4, y: 10, z: -62, r: 5 }, { t: 'spikeball', x: 4, y: 10, z: -62, ax: 1, az: -62, bx: 7, bz: -62, sp: 1.2 },
      { t: 'goal', x: 4, y: 10, z: -65 },
    ] },
    { id: 'I4', name: 'Ilha do Vulcão', theme: 3, par: 210, start: [0, 0, 0], lava: -6, objs: [
      { t: 'isle', x: 0, y: 0, z: 0, r: 6 }, { t: 'rock', x: -3, y: 0, z: 3 }, { t: 'rock', x: 4, y: 0, z: 3 },
      { t: 'sign', x: 2, y: 0, z: -3, txt: 'Cuidado com a lava e os jatos de fogo.' },
      { t: 'box', x: 0, y: .5, z: -9, w: 2.4, h: 1.5, d: 2.4, m: 'basalt' }, { t: 'fire', x: 0, y: .5, z: -9, per: 2.4 },
      { t: 'box', x: 0, y: 1, z: -14, w: 2.4, h: 1.5, d: 2.4, m: 'basalt' }, { t: 'box', x: 4.5, y: 3.4, z: -14, w: 1.4, h: 1, d: 1.4, m: 'basalt' }, { t: 'star', x: 4.5, y: 4.6, z: -14 },
      { t: 'box', x: 0, y: 1.5, z: -19, w: 2.4, h: 1.5, d: 2.4, m: 'basalt' }, { t: 'fire', x: 0, y: 1.5, z: -19, per: 2.4, ph: 1.2 },
      ...line(0, 2, -9, 0, 2.5, -19, 3),
      { t: 'isle', x: 0, y: 2, z: -28, r: 5 }, { t: 'slime', x: 1, y: 2, z: -28, range: 2.5 }, { t: 'slime', x: -1, y: 2, z: -30, range: 2, axis: 'z' },
      { t: 'check', x: 0, y: 2, z: -24 },
      { t: 'crate', x: 3, y: 2, z: -30 }, { t: 'crate', x: 3, y: 3, z: -30 }, { t: 'crate', x: 2.4, y: 2, z: -31 }, { t: 'star', x: 3.6, y: 2.6, z: -31.2, hide: true },
      { t: 'move', x: -8, y: 2.4, z: -28, w: 2.5, h: .6, d: 2.5, m: 'basalt', ax: -7, ay: 2.4, az: -28, bx: -15, by: 2.4, bz: -28, sp: .5 },
      { t: 'isle', x: -21, y: 3, z: -28, r: 4.5 }, { t: 'spinner', x: -21, y: 3.6, z: -28, len: 4, sp: 1.5 },
      ...ring(-21, 3.8, -28, 2.6, 8, 'red'), { t: 'redstar', x: -21, y: 5.5, z: -28 },
      { t: 'box', x: 0, y: 3, z: -36, w: 2.4, h: 1, d: 2.4, m: 'basalt' }, { t: 'box', x: 0, y: 4.2, z: -40, w: 2.4, h: 1, d: 2.4, m: 'basalt' }, { t: 'fire', x: 0, y: 4.2, z: -40, per: 2, ph: .5 },
      { t: 'box', x: 0, y: 5.4, z: -44, w: 2.4, h: 1, d: 2.4, m: 'basalt' },
      { t: 'isle', x: 0, y: 6, z: -52, r: 5 }, { t: 'check', x: 0, y: 6, z: -48 },
      { t: 'spikeball', x: 0, y: 6, z: -52, ax: -3, az: -52, bx: 3, bz: -52, sp: 1 }, { t: 'spikeball', x: 0, y: 6, z: -55, ax: 3, az: -55, bx: -3, bz: -55, sp: 1 },
      { t: 'spring', x: 3, y: 6, z: -50 }, { t: 'isle', x: 8, y: 14.4, z: -50, r: 2.2 }, { t: 'star', x: 8, y: 15.6, z: -50, high: true },
      { t: 'crumb', x: 0, y: 7, z: -60, w: 2.2, h: .5, d: 2.2 }, { t: 'crumb', x: 0, y: 8, z: -64, w: 2.2, h: .5, d: 2.2 }, { t: 'crumb', x: 0, y: 9, z: -68, w: 2.2, h: .5, d: 2.2 },
      { t: 'box', x: 0, y: 10, z: -72, w: 2.4, h: 1, d: 2.4, m: 'basalt' }, { t: 'fire', x: 0, y: 10, z: -72, per: 1.8 },
      { t: 'isle', x: 0, y: 11, z: -80, r: 6 }, { t: 'spinner', x: 0, y: 11.6, z: -80, len: 5, sp: 1.2, two: true },
      { t: 'goal', x: 0, y: 11, z: -84 },
    ] },
  ];

  const THEMES = [
    { sky: ['#5fb4f5', '#dff2ff'], fog: '#cfe9ff', hemiSky: '#eef6ff', grass: '#6fd65a', grass2: '#3f9e3c', dirt: '#8a5a34', dirt2: '#6b4226', rock: '#7d766e', sun: '#fff1d6', amb: 1.25, leaf: '#4caf50', flowers: ['#f472b6', '#fde047', '#ffffff', '#ef4444'] },
    { sky: ['#9aa8fb', '#fde4f1'], fog: '#efe4ff', hemiSky: '#fff4fb', grass: '#a7ecc0', grass2: '#6fd09a', dirt: '#b9a6d9', dirt2: '#9a86c4', rock: '#8f86b8', sun: '#fff1f6', amb: 1.3, leaf: '#f9a8d4', flowers: ['#f9a8d4', '#ffffff', '#c4b5fd', '#fde68a'] },
    { sky: ['#1b3558', '#6aa9d8'], fog: '#5f8fb8', hemiSky: '#d9f0ff', grass: '#a5e3f7', grass2: '#6cb7dd', dirt: '#3f5f86', dirt2: '#2f4a6c', rock: '#56739a', sun: '#e0f2ff', amb: 1.15, leaf: '#67e8f9', flowers: ['#a5f3fc', '#ffffff', '#c4b5fd', '#7dd3fc'] },
    { sky: ['#2a0a10', '#c2410c'], fog: '#5a1d18', hemiSky: '#ffd6b8', grass: '#5c5853', grass2: '#44403c', dirt: '#2f2a27', dirt2: '#1f1b19', rock: '#1c1917', sun: '#ffd0a0', amb: 1, leaf: '#78716c', flowers: ['#fb923c', '#fde047', '#ef4444', '#f97316'], lavaCracks: true },
  ];

  /* ════════════════════════════════════════════════════════════════
     construção da cena
  ════════════════════════════════════════════════════════════════ */
  /* ── direção de arte 3D: cel-shading (toon em 3 tons) + contorno escuro quente (casca invertida),
     o mesmo traço "livro ilustrado" do Pip em 2D. Metais, cristais e brilhos ficam em PBR/aditivo. ── */
  const OUTC = '#2a1406';
  const S = (c, o) => Arcade3D.std(c, o);
  let _grad = null;
  function grad() {
    if (_grad) return _grad;
    const t = new THREE.DataTexture(new Uint8Array([110, 182, 255]), 3, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return (_grad = t);
  }
  const Tn = (color, o) => Arcade3D.mat('toon:' + color + ':' + JSON.stringify(o || {}), () => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: grad() }, o || {})));
  const OLM = () => Arcade3D.mat('outline3d', () => new THREE.MeshBasicMaterial({ color: OUTC, side: THREE.BackSide }));
  /* casca de contorno: a mesma geometria (centrada) um pouco maior, só com as faces de trás.
     t = espessura em unidades do mundo (assume pais sem escala) */
  function hull(mesh, t) {
    const geo = mesh.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
    const b = geo.boundingBox, s = mesh.scale;
    const k = (a, sc) => 1 + 2 * t / Math.max(.001, (b.max[a] - b.min[a]) * Math.abs(sc || 1));
    const o = new THREE.Mesh(geo, OLM()); o.scale.set(k('x', s.x), k('y', s.y), k('z', s.z));
    o.position.set(-(b.max.x + b.min.x) / 2 * (o.scale.x - 1), -(b.max.y + b.min.y) / 2 * (o.scale.y - 1), -(b.max.z + b.min.z) / 2 * (o.scale.z - 1));
    mesh.add(o); return mesh;
  }
  const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
  function noiseGeo(geo, amt, seed) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 2) * Math.sin(y * 4.3 + seed); p.setXYZ(i, x * (1 + n * amt), y, z * (1 + n * amt)); }
    geo.computeVertexNormals(); return geo;
  }
  const rnd = s => { let v = s * 9301 + 49297; return () => ((v = (v * 9301 + 49297) % 233280) / 233280); };

  /* ── ilha: tampo de relva com borda irregular, franja de relva pendurada, estratos de terra/rocha,
     raízes, rochas a flutuar por baixo e tufos de erva/flores por cima ── */
  function isleMesh(o, th, idx, R3) {
    const g = new THREE.Group(), r = o.r, rn = rnd(idx * 7 + 3), seg = Math.max(28, Math.round(r * 9));
    const topGeo = new THREE.CylinderGeometry(r, r * .97, .5, seg, 1);
    const pos = topGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z); if (d < .01) continue;
      const a = Math.atan2(z, x), dd = (Math.sin(a * 5 + idx) * .06 + Math.sin(a * 11 + idx * 3) * .03 + .02) * (d / r);
      pos.setX(i, x * (1 + dd / d)); pos.setZ(i, z * (1 + dd / d));
    }
    topGeo.computeVertexNormals();
    const top = new THREE.Mesh(topGeo, [Tn(th.grass2), Tn(th.grass), Tn(th.dirt)]);
    top.position.y = -.25; top.receiveShadow = true; top.castShadow = true; g.add(top);
    hull(top, .03);
    /* franja de relva pendurada */
    const fr = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 9, 7), Tn(th.grass2), seg);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), E = new THREE.Euler();
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU + rn() * .05, rr = r * (.99 + rn() * .01);
      E.set(0, -a, 0); Q.setFromEuler(E);
      const s = .75 + rn() * .5; SC.set(s * .75, s * (1.1 + rn() * .6), s);
      V.set(Math.cos(a) * rr, -.42 - SC.y * .1, Math.sin(a) * rr); M4.compose(V, Q, SC); fr.setMatrixAt(i, M4);
    }
    fr.castShadow = true; g.add(fr);
    /* estratos */
    const layers = [[.8, r * .97, r * .8, th.dirt, .06], [1, r * .8, r * .58, th.rock, .1], [r * .9 + .7, r * .58, .12, th.dirt2 || th.dirt, .14]];
    let y = -.5;
    layers.forEach(([h, r0, r1, col, n], k) => {
      const geo = noiseGeo(new THREE.CylinderGeometry(r0, r1, h, 16, 3), n, idx + k * 3);
      const m = new THREE.Mesh(geo, Tn(col, { flatShading: true })); m.position.y = y - h / 2; m.castShadow = true; g.add(m);
      y -= h;
    });
    /* rebordo de rocha mais clara entre a terra e a rocha */
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * .8, .09, 6, seg), Tn(mix(th.rock, '#ffffff', .25))); band.rotation.x = Math.PI / 2; band.position.y = -1.3; g.add(band);
    /* raízes penduradas */
    const rootM = Tn('#6b4a2e');
    for (let k = 0, n = Math.max(2, Math.round(r * .8)); k < n; k++) {
      const a = rn() * TAU, rr = r * (.6 + rn() * .3), L = 1 + rn() * 2.2;
      const pts = [0, .33, .66, 1].map(t => new THREE.Vector3(Math.cos(a) * (rr - t * .4) + Math.sin(t * 5 + k) * .15, -1 - t * L, Math.sin(a) * (rr - t * .4) + Math.cos(t * 4 + k) * .15));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .045, 5, false), rootM); g.add(tube);
    }
    /* rochas a flutuar por baixo */
    for (let k = 0, n = Math.min(3, Math.round(r / 2.2)); k < n; k++) {
      const a = rn() * TAU, d = r * (.6 + rn() * .5), s = .25 + rn() * .35;
      const m = new THREE.Mesh(noiseGeo(new THREE.DodecahedronGeometry(s, 0), .15, k + idx), Tn(th.rock, { flatShading: true }));
      m.position.set(Math.cos(a) * d, -2.2 - rn() * 2, Math.sin(a) * d); hull(m, .025); g.add(m);
      if (R3) R3.floaters.push({ m, y0: m.position.y, ph: rn() * 6 });
    }
    /* tufos de erva e flores */
    const nT = Math.round(r * r * 1.8), tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(.045, .22, 4), Tn(mix(th.grass, th.grass2, .6)), nT);
    for (let i = 0; i < nT; i++) {
      const a = rn() * TAU, d = Math.sqrt(rn()) * r * .93;
      E.set((rn() - .5) * .5, rn() * 3, (rn() - .5) * .5); Q.setFromEuler(E); const s = .6 + rn() * .8; SC.set(s, s, s);
      V.set(Math.cos(a) * d, .07 * s, Math.sin(a) * d); M4.compose(V, Q, SC); tuft.setMatrixAt(i, M4);
    }
    g.add(tuft);
    /* manchas no tampo (relva mais clara / gelo / fendas de lava a brilhar no vulcão) */
    const nP = Math.round(r * 1.3), lavaT = th.lavaCracks, patch = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), lavaT ? Tn('#ff6a1f', { emissive: '#ff4d00', emissiveIntensity: .9, polygonOffset: true, polygonOffsetFactor: -2 }) : Tn(mix(th.grass, '#ffffff', .18), { polygonOffset: true, polygonOffsetFactor: -2 }), nP);
    for (let i = 0; i < nP; i++) {
      const a = rn() * TAU, d = Math.sqrt(rn()) * r * .75, sz = lavaT ? .12 + rn() * .2 : .35 + rn() * .8;
      E.set(-Math.PI / 2, 0, rn() * TAU); Q.setFromEuler(E); SC.set(sz * (lavaT ? 3.2 : 1.5), sz, 1);
      V.set(Math.cos(a) * d, .012, Math.sin(a) * d); M4.compose(V, Q, SC); patch.setMatrixAt(i, M4);
    }
    patch.receiveShadow = true; g.add(patch);
    const nF = Math.round(r * 2), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), Tn('#ffffff'), nF), FC = th.flowers || ['#f472b6', '#fde047', '#ffffff', '#c084fc'], C = new THREE.Color();
    for (let i = 0; i < nF; i++) {
      const a = rn() * TAU, d = Math.sqrt(rn()) * r * .9;
      V.set(Math.cos(a) * d, .2, Math.sin(a) * d); SC.set(1, .6, 1); Q.identity(); M4.compose(V, Q, SC); fl.setMatrixAt(i, M4); fl.setColorAt(i, C.set(FC[i % FC.length]));
    }
    g.add(fl);
    g.position.set(o.x, o.y, o.z);
    return g;
  }
  const MAT = { wood: '#c0844a', stone: '#b4aca4', cloud: '#ffffff', crystal: '#7dd3fc', basalt: '#4a433e' };
  function boxMesh(o, th) {
    const m = o.m || 'stone', col = MAT[m];
    const mat = o.t === 'crumb' ? Tn('#e7d6b5') : m === 'crystal' ? S(col, { roughness: .15, metalness: .1, transparent: true, opacity: .92, emissive: '#1e6fa8', emissiveIntensity: .25 }) : m === 'cloud' ? Tn(col, { emissive: '#e9e3ff', emissiveIntensity: .2 }) : Tn(col);
    const mesh = new THREE.Mesh(Arcade3D.roundBox(m === 'cloud' ? .35 : .08), mat);
    mesh.scale.set(o.w, o.h, o.d); mesh.position.set(o.x, o.y - o.h / 2, o.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    hull(mesh, .035);
    const gg = new THREE.Group(); gg.add(mesh);
    if (m === 'wood' && o.t === 'box') {
      /* tábuas: faixa clara por cima e frisos */
      const top = new THREE.Mesh(new THREE.BoxGeometry(o.w * .96, .06, o.d * .96), Tn('#dca068')); top.position.set(o.x, o.y + .01, o.z); top.receiveShadow = true; gg.add(top);
      const n = Math.max(1, Math.round(o.w / .6));
      for (let i = 1; i < n; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.03, .065, o.d * .96), Tn('#8a5a2c')); l.position.set(o.x - o.w / 2 + i * o.w / n, o.y + .015, o.z); gg.add(l); }
    } else if (m === 'stone' || m === 'basalt') {
      /* musgo / lava a escorrer no topo */
      const cap = new THREE.Mesh(new THREE.BoxGeometry(o.w * .9, .05, o.d * .9), Tn(m === 'stone' ? '#6cbf4a' : '#ff7a2f', m === 'basalt' ? { emissive: '#c2410c', emissiveIntensity: .5 } : {})); cap.position.set(o.x, o.y + .005, o.z); gg.add(cap);
    }
    if (o.t !== 'box') return mesh;   /* plataformas móveis/que caem: a malha é movida diretamente */
    return gg;
  }
  function tree(o, th) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .27, 1.7, 9), Tn('#7a4a26')); trunk.position.y = .85; trunk.castShadow = true; hull(trunk, .03); g.add(trunk);
    const col = th.leaf || '#4caf50', colL = mix(col, '#ffffff', .22);
    [[0, 2.15, 0, 1.05, col], [.55, 1.75, .3, .72, col], [-.55, 1.85, -.2, .78, col], [0, 2.75, .1, .68, colL], [-.2, 2.3, .6, .55, colL]].forEach(([x, y, z, r, c]) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), Tn(c, { flatShading: true })); b.position.set(x, y, z); b.castShadow = true; hull(b, .035); g.add(b);
    });
    g.position.set(o.x, o.y, o.z); g.rotation.y = o.x; return g;
  }
  function rock(o) { const m = new THREE.Mesh(noiseGeo(new THREE.DodecahedronGeometry(.8, 0), .2, o.x), Tn('#9a948d', { flatShading: true })); m.position.set(o.x, o.y + .3, o.z); m.scale.set(1.2, .8, 1); m.castShadow = true; hull(m, .035); return m; }
  function crystal(o) {
    const g = new THREE.Group();
    [[0, 1.2, 0, .35], [.4, .8, .2, .22], [-.35, .7, -.1, .2]].forEach(([x, h, z, r]) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), S('#a5f3fc', { roughness: .1, metalness: .2, emissive: '#22d3ee', emissiveIntensity: .5 })); m.scale.set(1, h / r, 1); m.position.set(x, h * .6, z); m.castShadow = true; hull(m, .025); g.add(m); });
    const gl = new THREE.Sprite(Arcade3D.glowSprite('#67e8f9')); gl.scale.set(2.4, 2.4, 1); gl.position.y = .9; g.add(gl);
    g.position.set(o.x, o.y, o.z); return g;
  }
  function flowers(o) {
    const g = new THREE.Group();
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, r = .3 + (i % 3) * .35, col = ['#f472b6', '#fde047', '#ffffff', '#c084fc'][i % 4];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .32, 4), Tn('#3f9a2a')); st.position.set(Math.cos(a) * r, .16, Math.sin(a) * r); g.add(st);
      for (let k = 0; k < 5; k++) { const pa = k / 5 * TAU, pt = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), Tn(col)); pt.scale.set(1, .4, 1.4); pt.position.set(st.position.x + Math.cos(pa) * .07, .33, st.position.z + Math.sin(pa) * .07); pt.rotation.y = -pa; g.add(pt); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), Tn('#f59e0b')); c.position.set(st.position.x, .345, st.position.z); g.add(c);
    }
    g.position.set(o.x, o.y, o.z); return g;
  }
  /* ilha distante (silhueta com tom de atmosfera, sem nevoeiro) */
  function farIsle(th, s, seed) {
    const g = new THREE.Group(), rn = rnd(seed);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * .95, s * .18, 18), new THREE.MeshBasicMaterial({ color: mix(th.grass, th.fog, .5), fog: false })); g.add(top);
    const und = new THREE.Mesh(noiseGeo(new THREE.ConeGeometry(s * .95, s * 1.6, 12, 3), .12, seed), new THREE.MeshBasicMaterial({ color: mix(th.dirt, th.fog, .55), fog: false }));
    und.rotation.x = Math.PI; und.position.y = -s * .09 - s * .8; g.add(und);
    for (let k = 0; k < 3; k++) { const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(s * (.15 + rn() * .12), 0), new THREE.MeshBasicMaterial({ color: mix(th.leaf || '#4caf50', th.fog, .5), fog: false })); tr.position.set((rn() - .5) * s, s * .25, (rn() - .5) * s); g.add(tr); }
    return g;
  }
  function cloudPuff(lava, rn) {
    const c = new THREE.Group(), n = 4 + Math.floor(rn() * 3), m = lava ? Tn('#5b524c', { emissive: '#3a1410', emissiveIntensity: .35 }) : Tn('#ffffff', { emissive: '#ffffff', emissiveIntensity: .28 });
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.3 + rn() * 1, 12, 9), m); s.position.set(k * 1.5 - n * .7, Math.sin(k * 1.7) * .35, (rn() - .5) * 1.6); s.scale.y = .72; c.add(s); }
    return c;
  }

  function build3D(G, api) {
    const renderer = Arcade3D.attach(api.stage);
    const th = THEMES[G.L.theme];
    const { scene, sun, hemi } = Arcade3D.stdScene({ sky: th.hemiSky || '#eef6ff', ground: th.dirt, hemi: th.amb, sun: th.sun, sunI: 2.2, normalBias: .03 });
    scene.fog = new THREE.Fog(th.fog, 34, 110);
    const cam = new THREE.PerspectiveCamera(55, 1, .1, 400);
    const R3 = { renderer, scene, cam, sun, objs: [], coins: [], movers: [], spin: [], fx: [], clouds: [], floaters: [] };
    G.r3 = R3;
    api.stage.style.background = `linear-gradient(180deg, ${th.sky[0]} 0%, ${th.sky[1]} 62%, ${th.fog} 100%)`;
    /* sol (brilho que acompanha a câmara, ao longe) */
    R3.sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: Arcade3D.glowTex(), color: G.L.lava != null ? '#ffb37a' : '#fff6d8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }));
    R3.sunSpr.scale.set(70, 70, 1); scene.add(R3.sunSpr);
    /* mar de nuvens (ou de lava) lá em baixo */
    const lava = G.L.lava != null;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ color: lava ? '#ff5a1f' : th.fog, transparent: true, opacity: lava ? 1 : .85, fog: true, toneMapped: !lava }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = lava ? G.L.lava : -26; scene.add(sea); R3.sea = sea;
    const rn = rnd(G.li * 13 + 5);
    for (let i = 0; i < 30; i++) {
      const c = cloudPuff(lava, rn);
      c.position.set(-70 + rn() * 140, lava ? G.L.lava + .3 : -24 + rn() * 18, -120 + rn() * 140); c.userData.v = .3 + rn() * .5; scene.add(c); R3.clouds.push(c);
    }
    /* ilhas distantes à volta (profundidade) */
    if (!lava) for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + rn() * .4, d = 120 + rn() * 50, s = 5 + rn() * 9;
      const fi = farIsle(th, s, i + G.li * 9); fi.position.set(Math.cos(a) * d, -6 + rn() * 34, -40 + Math.sin(a) * d); scene.add(fi);
    }
    G.L.objs.forEach((o, idx) => {
      let m = null;
      if (o.t === 'isle') m = isleMesh(o, th, idx, R3);
      else if (o.t === 'box' || o.t === 'crumb' || o.t === 'move') { m = boxMesh(o, th); if (o.t !== 'box') o.mesh = m; }
      else if (o.t === 'tree') m = tree(o, th);
      else if (o.t === 'rock') m = rock(o);
      else if (o.t === 'crystal') m = crystal(o);
      else if (o.t === 'flowers') m = flowers(o);
      if (m) { scene.add(m); R3.objs.push(m); }
    });
    /* itens e entidades com malha própria */
    G.coins.forEach(c => { c.mesh = coinMesh(c.red); c.mesh.position.set(c.x, c.y, c.z); scene.add(c.mesh); });
    G.stars.forEach(s => { s.mesh = starMesh(s.big ? 1.6 : 1); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh); s.mesh.visible = !s.red; });
    G.crates.forEach(c => {
      c.mesh = new THREE.Mesh(Arcade3D.roundBox(.06), Tn('#d0924f')); c.mesh.scale.setScalar(.95); c.mesh.position.set(c.x, c.y + .475, c.z); c.mesh.castShadow = c.mesh.receiveShadow = true; hull(c.mesh, .03);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.02, .14, 1.02), Tn('#7a4a26')); c.mesh.add(band); const b2 = band.clone(); b2.rotation.x = Math.PI / 2; c.mesh.add(b2); const b3 = band.clone(); b3.rotation.z = Math.PI / 2; c.mesh.add(b3);
      scene.add(c.mesh);
    });
    G.springs.forEach(s => { s.mesh = springMesh(s.cloud); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh); });
    G.enemies.forEach(e => { e.mesh = e.t === 'slime' ? slimeMesh(G.L.theme) : spikeMesh(); e.mesh.position.set(e.x, e.y, e.z); scene.add(e.mesh); });
    G.spinners.forEach(s => { s.mesh = spinnerMesh(s); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh); });
    G.fires.forEach(f => { f.mesh = fireMesh(); f.mesh.position.set(f.x, f.y, f.z); scene.add(f.mesh); });
    G.checks.forEach(c => { c.mesh = flagMesh(); c.mesh.position.set(c.x, c.y, c.z); scene.add(c.mesh); });
    G.signs.forEach(s => { const m = signMesh(); m.position.set(s.x, s.y, s.z); m.rotation.y = Math.atan2(-s.x, -s.z) + Math.PI; scene.add(m); });
    if (G.goal) { const g = goalMesh(); g.position.set(G.goal.x, G.goal.y, G.goal.z); scene.add(g); G.goal.mesh = g; }
    /* o Pip */
    R3.fox = foxMesh(); scene.add(R3.fox);
    R3.shadow = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .28, depthWrite: false }));
    R3.shadow.rotation.x = -Math.PI / 2; scene.add(R3.shadow);
  }

  function coinMesh(red) {
    const g = new THREE.Group();
    if (red) {
      /* flor azul (desafio das 8 flores) */
      const pet = S('#60a5fa', { roughness: .35, emissive: '#1e3a8a', emissiveIntensity: .35 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, m = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), pet); m.scale.set(1, .45, 1.4); m.position.set(Math.cos(a) * .17, 0, Math.sin(a) * .17); m.rotation.y = -a; g.add(m); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), S('#fde047', { roughness: .4 })); c.position.y = .04; g.add(c);
      g.rotation.x = Math.PI / 2.4; const w = new THREE.Group(); w.add(g); return w;
    }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .08, 22), Tn('#fbbf24', { emissive: '#b45309', emissiveIntensity: .35 }));
    m.rotation.x = Math.PI / 2; m.castShadow = true; g.add(m);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .1, 16), Tn('#fff1a8', { emissive: '#f59e0b', emissiveIntensity: .25 })); s.rotation.x = Math.PI / 2; g.add(s);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.32, .025, 6, 24), OLM()); g.add(rim);
    return g;
  }
  function starShape() {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .38 : .9; const x = Math.cos(a) * r, y = -Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
    sh.closePath(); return sh;
  }
  function starMesh(sc) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(), { depth: .25, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 3 }), S('#facc15', { metalness: .6, roughness: .25, emissive: '#b45309', emissiveIntensity: .5 }));
    m.geometry.center(); m.castShadow = true; hull(m, .05); g.add(m);
    const glow = new THREE.Sprite(Arcade3D.glowSprite('#fde68a')); glow.scale.set(3, 3, 1); g.add(glow);
    g.scale.setScalar(.7 * sc); return g;
  }
  function springMesh(cloud) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.55, .62, .2, 18), Tn('#64748b')); base.position.y = .1; hull(base, .03); g.add(base);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(.35, .06, 8, 20), S('#cbd5e1', { metalness: .9, roughness: .2 })); coil.rotation.x = Math.PI / 2; coil.position.y = .3; g.add(coil);
    const coil2 = coil.clone(); coil2.position.y = .45; g.add(coil2);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .16, 18), Tn(cloud ? '#ffffff' : '#ef4444')); top.position.y = .6; top.castShadow = true; hull(top, .03); g.add(top);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .02, 16), Tn(cloud ? '#c7d2fe' : '#fde047')); dot.position.y = .09; top.add(dot);
    g.userData.top = top; return g;
  }
  function slimeMesh(theme) {
    const col = ['#4ade80', '#c084fc', '#38bdf8', '#fb923c'][theme];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.5, 22, 16, 0, TAU, 0, Math.PI * .62), Tn(col, { transparent: true, opacity: .94 }));
    body.scale.set(1, .85, 1); body.position.y = .05; body.castShadow = true; g.add(body);
    const ol = new THREE.Mesh(body.geometry, OLM()); ol.scale.setScalar(1.06); body.add(ol);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .6 })); shine.scale.set(1.3, .6, .8); shine.position.set(-.2, .38, .18); body.add(shine);
    [-.17, .17].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 10), Tn('#ffffff')); e.scale.set(1, 1.15, .6); e.position.set(x, .36, .38); hull(e, .015); g.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), S('#111827', { roughness: .2 })); p.position.set(x, .35, .45); g.add(p);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.set(x + .02, .38, .49); g.add(h);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: OUTC })); mouth.rotation.z = Math.PI; mouth.position.set(0, .22, .45); g.add(mouth);
    g.userData.body = body; return g;
  }
  function spikeMesh() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 1), Tn('#4b5563')); b.castShadow = true; hull(b, .03); g.add(b);
    const pos = b.geometry.attributes.position, seen = new Set();
    for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize(), k = v.toArray().map(n => n.toFixed(2)).join(); if (seen.has(k)) continue; seen.add(k); if (seen.size > 20) break; const c = new THREE.Mesh(new THREE.ConeGeometry(.1, .35, 6), Tn('#e5e7eb')); c.position.copy(v.clone().multiplyScalar(.5)); c.lookAt(v.clone().multiplyScalar(2)); c.rotateX(Math.PI / 2); g.add(c); }
    g.position.y = .45; const w = new THREE.Group(); w.add(g); w.userData.ball = g;
    /* olhos zangados (não rodam com a bola; olham para onde vai) */
    const face = new THREE.Group(); face.position.y = .5; w.add(face); w.userData.face = face;
    [-.15, .15].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), Tn('#ffffff')); e.scale.set(1, 1, .5); e.position.set(x, .05, .44); hull(e, .015); face.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#dc2626' })); p.position.set(x, .04, .49); face.add(p);
      const br = new THREE.Mesh(new THREE.BoxGeometry(.16, .035, .03), new THREE.MeshBasicMaterial({ color: OUTC })); br.position.set(x, .17, .47); br.rotation.z = x > 0 ? .45 : -.45; face.add(br);
    });
    return w;
  }
  function spinnerMesh(s) {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.35, .45, .6, 12), Tn('#57534e')); hub.castShadow = true; hull(hub, .03); g.add(hub);
    const arms = new THREE.Group(); g.add(arms); g.userData.arms = arms;
    const n = Math.round(s.len / .55);
    (s.two ? [0, Math.PI] : [0]).forEach(a0 => { for (let i = 1; i <= n; i++) { const f = new THREE.Sprite(Arcade3D.glowSprite('#fb923c')); f.scale.set(.9, .9, 1); f.position.set(Math.cos(a0) * i * .55, 0, Math.sin(a0) * i * .55); arms.add(f); const core = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), Arcade3D.glowMat('#ffedb3')); core.position.copy(f.position); arms.add(core); } });
    return g;
  }
  function fireMesh() {
    const g = new THREE.Group();
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(.4, .5, .15, 14), Tn('#1c1917')); vent.position.y = .07; hull(vent, .03); g.add(vent);
    const col = new THREE.Group(); g.add(col); g.userData.col = col;
    for (let i = 0; i < 7; i++) { const f = new THREE.Sprite(Arcade3D.glowSprite(i % 2 ? '#fb923c' : '#fde047')); f.scale.set(1.2 - i * .1, 1.2 - i * .1, 1); f.position.y = .3 + i * .45; col.add(f); }
    return g;
  }
  function flagMesh() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.2, 8), Tn('#e2e8f0')); pole.position.y = 1.1; hull(pole, .02); g.add(pole);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(.9, .55, 6, 1), new THREE.MeshToonMaterial({ color: '#ef4444', side: THREE.DoubleSide, gradientMap: grad() })); f.position.set(.47, 1.85, 0); g.add(f); g.userData.flag = f;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), S('#facc15', { metalness: .7 })); ball.position.y = 2.25; g.add(ball);
    return g;
  }
  function signMesh() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 1, .12), Tn('#7a4a26')); post.position.y = .5; hull(post, .02); g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, .6, .08), Tn('#d39a5c')); board.position.y = 1.05; board.castShadow = true; hull(board, .025); g.add(board);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ map: Arcade3D.emojiTex('💡', 96), transparent: true })); q.position.set(0, 1.05, .05); g.add(q);
    return g;
  }
  function goalMesh() {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, .5, 24), Tn('#e2e8f0')); ped.position.y = .25; ped.receiveShadow = true; hull(ped, .03); g.add(ped);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(1.1, .06, 8, 40), Arcade3D.glowMat('#fde68a')); ringM.rotation.x = Math.PI / 2; ringM.position.y = .52; g.add(ringM);
    const st = starMesh(1.9); st.position.y = 2.1; g.add(st); g.userData.star = st;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, 8, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    beam.position.y = 4; g.add(beam);
    return g;
  }

  /* ── o Pip em 3D ──
     Coerente com o Pip 2D: bípede, cabeça grande, focinho com a parte de baixo creme, bochechas
     fofas, olhos grandes, orelhas com pontas escuras, "meias" pretas, cauda farta em 3 segmentos
     com ponta branca e o lenço turquesa com duas pontas que esvoaçam. Rig: anca → coxa → joelho,
     ombro → braço → cotovelo; animado em animFox() a partir do estado físico. */
  function foxMesh() {
    const fur = Tn('#f2741f'), cream = Tn('#fff4e3'), sock = Tn('#3b2416'), pink = Tn('#ffc4ab'), white = Tn('#ffffff'), eyeM = S('#1d0e05', { roughness: .15 }), scarf = Tn('#14b8a6'), scarfD = Tn('#0d7d73');
    const g = new THREE.Group(), body = new THREE.Group(); body.position.y = .5; g.add(body);
    const add = (parent, geo, mat, x, y, z, sx, sy, sz, ow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; if (ow) hull(m, ow); parent.add(m); return m; };
    const sph = (r, a, b) => new THREE.SphereGeometry(r, a || 20, b || 14);
    const hips = new THREE.Group(); hips.position.y = -.08; body.add(hips);
    /* tronco */
    add(hips, sph(.2), fur, 0, .17, 0, .95, 1.1, .88, .022);
    add(hips, sph(.15), cream, 0, .16, .09, .82, 1.02, .55);
    /* cabeça */
    const head = new THREE.Group(); head.position.set(0, .55, .03); hips.add(head);
    add(head, sph(.29, 26, 18), fur, 0, 0, 0, 1.06, .95, 1, .024);
    [-1, 1].forEach(s => { const c = add(head, new THREE.ConeGeometry(.085, .17, 10), cream, s * .245, -.12, -.06, 1, 1, .75, .012); c.rotation.z = s * 2.25; c.rotation.x = -.5; });
    add(head, sph(.2), cream, 0, -.12, .1, 1.05, .6, .92);
    add(head, sph(.15), fur, 0, -.035, .25, .8, .6, 1.3, .018);
    add(head, sph(.13), cream, 0, -.1, .25, .8, .5, 1.18);
    add(head, sph(.045, 12, 10), sock, 0, -.01, .44, 1.2, .9, 1, .008);
    const eyes = [];
    [-1, 1].forEach(s => {
      const e = new THREE.Group(); e.position.set(s * .118, .035, .232); e.rotation.y = s * .33; head.add(e);
      add(e, sph(.078, 16, 12), white, 0, 0, 0, .85, 1.08, .42, .012);
      add(e, sph(.052, 14, 10), eyeM, 0, -.006, .026, .86, 1, .42);
      add(e, sph(.018, 8, 6), white, .022, .026, .045);
      eyes.push(e);
    });
    const ears = [];
    [-1, 1].forEach(s => {
      const e = new THREE.Group(); e.position.set(s * .15, .21, -.03); e.rotation.z = -s * .3; head.add(e);
      add(e, new THREE.ConeGeometry(.105, .31, 14), fur, 0, .13, 0, 1, 1, .55, .016);
      add(e, new THREE.ConeGeometry(.062, .18, 12), pink, 0, .1, .03, 1, 1, .32);
      add(e, new THREE.ConeGeometry(.036, .1, 12), sock, 0, .232, 0, 1, 1, .6);
      ears.push(e);
    });
    /* lenço */
    const sc = add(hips, new THREE.TorusGeometry(.15, .052, 10, 24), scarf, 0, .37, 0, 1, 1, 1, .012); sc.rotation.x = Math.PI / 2;
    add(hips, sph(.065), scarfD, 0, .36, -.16, 1, 1, 1, .01);
    const tails = [-1, 1].map(s => { const t = new THREE.Group(); t.position.set(s * .03, .35, -.18); hips.add(t); const geo = new THREE.BoxGeometry(.075, .02, .28); geo.translate(0, 0, -.14); add(t, geo, s < 0 ? scarf : scarfD, 0, 0, 0); return t; });
    /* braços */
    const arm = s => {
      const sh = new THREE.Group(); sh.position.set(s * .185, .28, .02); hips.add(sh);
      add(sh, new THREE.CapsuleGeometry(.052, .1, 4, 10), fur, 0, -.075, 0, 1, 1, 1, .014);
      const el = new THREE.Group(); el.position.y = -.15; sh.add(el);
      add(el, new THREE.CapsuleGeometry(.046, .08, 4, 10), sock, 0, -.06, 0, 1, 1, 1, .014);
      add(el, sph(.062, 12, 10), sock, 0, -.13, .01, 1, .9, 1.1, .012);
      return { sh, el };
    };
    const leg = s => {
      const hp = new THREE.Group(); hp.position.set(s * .09, 0, 0); hips.add(hp);
      add(hp, new THREE.CapsuleGeometry(.066, .1, 4, 10), fur, 0, -.09, 0, 1, 1, 1, .015);
      const kn = new THREE.Group(); kn.position.y = -.19; hp.add(kn);
      add(kn, new THREE.CapsuleGeometry(.052, .1, 4, 10), sock, 0, -.08, 0, 1, 1, 1, .014);
      add(kn, sph(.078, 12, 10), sock, 0, -.19, .04, .9, .55, 1.4, .012);
      return { hp, kn };
    };
    /* cauda farta: 3 segmentos em cadeia */
    const tail = new THREE.Group(); tail.position.set(0, .06, -.15); hips.add(tail);
    const t1 = new THREE.Group(); tail.add(t1); add(t1, sph(.12), fur, 0, 0, -.12, .85, .85, 1.5, .018);
    const t2 = new THREE.Group(); t2.position.z = -.24; t1.add(t2); add(t2, sph(.155), fur, 0, 0, -.12, .92, .92, 1.3, .02);
    const t3 = new THREE.Group(); t3.position.z = -.25; t2.add(t3); add(t3, sph(.125), cream, 0, 0, -.06, .9, .9, 1.25, .018);
    g.userData = { body, hips, head, ears, eyes, tails, arms: [arm(-1), arm(1)], legs: [leg(-1), leg(1)], tail: [t1, t2, t3], blink: 2 };
    return g;
  }
  /* pose do Pip 3D (ângulos alvo, suavizados) */
  function animFox(G, dt) {
    const F = G.r3.fox.userData, p = G.p, t = G.t;
    const spd = Math.min(1.25, Math.hypot(p.vx, p.vz) / SPEED), air = !p.on, ph = p.run * 3;
    const T = { lean: 0, bob: 0, leg: [[0, .1], [0, .1]], arm: [[.15, -.35, .25], [.15, -.35, .25]], tail: .45, tailY: 0, ear: 0, headX: 0, scarf: .2 + spd * .5 };
    const L = T.leg, A = T.arm;
    if (G.won) {
      const hop = Math.abs(Math.sin(G.winT * 8));
      T.arm = [[-2.8, -.2, .5], [-2.8, -.2, .5]]; T.leg = [[-.3 * hop, .5 * hop], [-.3 * hop, .5 * hop]]; T.tail = .9 + Math.sin(t * 14) * .3; T.bob = hop * .08; T.headX = -.25;
    } else if (G.dead) {
      T.arm = [[-2.6, .3, .6], [-2.6, .3, .6]]; T.leg = [[-.8, 1.2], [.4, .6]]; T.ear = .7;
    } else if (p.inv > 1.25) {
      T.lean = -.35; T.arm = [[-2.3, .4, .6], [-2.1, .5, .6]]; T.leg = [[-.7, .9], [-.2, .6]]; T.ear = .8; T.tail = .9;
    } else if (p.pound) {
      T.leg = [[-1.4, 2.2], [-1.4, 2.2]]; T.arm = [[-.9, -1.4, .3], [-.9, -1.4, .3]]; T.tail = .2; T.ear = .6;
    } else if (air) {
      if (p.vy > 3) { T.leg = [[-1.1, 1.7], [.35, .5]]; T.arm = [[-2.5, -.3, .2], [.8, -.5, .25]]; T.tail = .25; T.ear = .3; T.lean = .12; }
      else if (p.vy > -3) { T.leg = [[-.55, .7], [.45, .5]]; T.arm = [[-1.4, -.3, .8], [-1.4, -.3, .8]]; T.tail = .5; }
      else { const fl = Math.sin(t * 20) * .2; T.leg = [[-.25, .35], [.2, .4]]; T.arm = [[-2.7 + fl, -.2, .5], [-2.7 - fl, -.2, .5]]; T.tail = 1; T.ear = -.25; T.lean = -.05; }
    } else if (spd > .06) {
      const a = .45 + .55 * Math.min(1, spd);
      for (let i = 0; i < 2; i++) {
        const o = i ? Math.PI : 0;
        L[i] = [-a * Math.sin(ph + o) * .95, .2 + 1.5 * a * Math.max(0, Math.cos(ph + o))];
        A[i] = [a * .95 * Math.sin(ph + o), -(.55 + .45 * a), .2];
      }
      T.lean = .3 * Math.min(1, spd); T.bob = Math.abs(Math.cos(ph)) * .045 * spd; T.tail = .25 + .2 * spd; T.tailY = Math.sin(ph) * .35; T.ear = .3 * spd; T.headX = Math.sin(ph * 2) * .04;
    } else {
      const br = Math.sin(t * 2.6);
      T.bob = br * .008; T.tail = .5 + Math.sin(t * 2) * .08; T.tailY = Math.sin(t * 2.1) * .35; T.arm = [[.12 + br * .04, -.35, .22], [.12 + br * .04, -.35, .22]];
      T.ear = Math.max(0, Math.sin(t * 1.7) - .9) * 4;
    }
    const k = 1 - Math.exp(-dt * 18), lr = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    lr(F.hips.rotation, 'x', T.lean); lr(F.hips.position, 'y', -.08 + T.bob);
    F.legs.forEach((l, i) => { lr(l.hp.rotation, 'x', T.leg[i][0]); lr(l.kn.rotation, 'x', T.leg[i][1]); });
    F.arms.forEach((a, i) => { const s = i ? 1 : -1; lr(a.sh.rotation, 'x', T.arm[i][0]); lr(a.el.rotation, 'x', T.arm[i][1]); lr(a.sh.rotation, 'z', s * T.arm[i][2]); });
    F.tail.forEach((s, i) => { lr(s.rotation, 'x', T.tail * (i ? .35 : .7)); lr(s.rotation, 'y', T.tailY * (i ? .7 : .4) + Math.sin(t * 4 - i) * .06 * i); });
    F.ears.forEach((e, i) => lr(e.rotation, 'x', -T.ear * .6));
    lr(F.head.rotation, 'x', T.headX - T.lean * .4);
    F.tails.forEach((s, i) => { s.rotation.x = .35 + T.scarf * .6 + Math.sin(t * (10 + spd * 10) + i * 1.3) * (.12 + spd * .2); s.rotation.y = (i ? 1 : -1) * .25 + Math.sin(t * 7 + i) * .1; });
    /* piscar */
    F.blink -= dt; if (F.blink < -.12) F.blink = 2 + Math.random() * 3;
    const ey = G.dead ? .25 : F.blink < 0 ? .12 : 1; F.eyes.forEach(e => { e.scale.y += (ey - e.scale.y) * Math.min(1, dt * 30); });
  }

  /* ════════════════════════════════════════════════════════════════
     estado
  ════════════════════════════════════════════════════════════════ */
  const SAVE = 'isles:save';
  const save = () => { try { return JSON.parse(localStorage.getItem(SAVE)) || { u: 1, s: {} }; } catch (e) { return { u: 1, s: {} }; } };
  const putSave = v => { try { localStorage.setItem(SAVE, JSON.stringify(v)); } catch (e) {} };

  function setup(api, o) {
    const li = Math.max(0, LEVELS.findIndex(l => l.id === o.mode));
    const L = LEVELS[li];
    const G = {
      li, L, t: 0, time: 0, coinsN: 0, reds: 0, deaths: 0, kills: 0,
      p: { x: L.start[0], y: L.start[1], z: L.start[2], vx: 0, vy: 0, vz: 0, on: true, ground: null, jumps: 0, coyote: 0, buf: 0, hp: 3, inv: 0, face: Math.PI, run: 0, pound: false, flip: 0, sq: 0 },
      cam: { yaw: 0, pitch: .38, dist: 8, manual: 0, x: 0, y: 4, z: 8 },
      keys: {}, joy: null, camDrag: null, touch: false, holdJ: false,
      solids: [], coins: [], stars: [], crates: [], springs: [], enemies: [], spinners: [], fires: [], checks: [], signs: [], goal: null, check: { x: L.start[0], y: L.start[1], z: L.start[2] },
      got: new Set(), won: false, winT: 0, dead: false, deadT: 0, msg: null, msgT: 0,
    };
    let starN = 0;
    L.objs.forEach(o => {
      if (o.t === 'isle') G.solids.push({ k: 'cyl', x: o.x, y: o.y, z: o.z, r: o.r, bot: o.y - .5 });
      else if (o.t === 'box') G.solids.push({ k: 'box', x: o.x, y: o.y, z: o.z, w: o.w, h: o.h, d: o.d });
      else if (o.t === 'move') { const s = { k: 'box', mv: o, x: o.ax, y: o.ay, z: o.az, w: o.w, h: o.h, d: o.d, dx: 0, dy: 0, dz: 0 }; G.solids.push(s); o.solid = s; }
      else if (o.t === 'crumb') { const s = { k: 'box', crumb: o, x: o.x, y: o.y, z: o.z, w: o.w, h: o.h, d: o.d, y0: o.y }; G.solids.push(s); o.solid = s; o.st = 0; }
      else if (o.t === 'coin' || o.t === 'red') G.coins.push({ x: o.x, y: o.y, z: o.z, red: o.t === 'red' });
      else if (o.t === 'star') G.stars.push({ id: 's' + (starN++), x: o.x, y: o.y, z: o.z, hide: o.hide, high: o.high });
      else if (o.t === 'redstar') G.stars.push({ id: 'r', x: o.x, y: o.y, z: o.z, red: true });
      else if (o.t === 'crate') { const c = { x: o.x, y: o.y, z: o.z, alive: true }; c.solid = { k: 'box', crate: c, x: o.x, y: o.y + .95, z: o.z, w: .95, h: .95, d: .95 }; G.solids.push(c.solid); G.crates.push(c); }
      else if (o.t === 'spring' || o.t === 'cloudspring') G.springs.push({ x: o.x, y: o.y, z: o.z, cloud: o.t === 'cloudspring', anim: 0 });
      else if (o.t === 'slime') G.enemies.push({ t: 'slime', x: o.x, y: o.y, z: o.z, x0: o.x, z0: o.z, range: o.range || 2, axis: o.axis || 'x', ph: Math.random() * 6, alive: true, squash: 0 });
      else if (o.t === 'spikeball') G.enemies.push({ t: 'spike', x: o.x, y: o.y, z: o.z, ax: o.ax, az: o.az, bx: o.bx, bz: o.bz, sp: o.sp || 1, ph: Math.random() * 6, alive: true });
      else if (o.t === 'spinner') G.spinners.push({ x: o.x, y: o.y, z: o.z, len: o.len, sp: o.sp, two: o.two, a: 0 });
      else if (o.t === 'fire') G.fires.push({ x: o.x, y: o.y, z: o.z, per: o.per || 2, ph: o.ph || 0, on: false });
      else if (o.t === 'check') G.checks.push({ x: o.x, y: o.y, z: o.z, on: false });
      else if (o.t === 'sign') G.signs.push({ x: o.x, y: o.y, z: o.z, txt: o.txt });
      else if (o.t === 'goal') G.goal = { x: o.x, y: o.y, z: o.z };
    });
    G.stars.push({ id: 'g', goal: true, big: true, x: G.goal.x, y: G.goal.y + 2.1, z: G.goal.z, hidden: true });
    G.totalStars = G.stars.length;
    G.redTotal = G.coins.filter(c => c.red).length;
    const sv = save(); G.prevStars = new Set((sv.s[L.id] || {}).got || []);
    if (typeof Arcade3D !== 'undefined') Arcade3D.load().then(() => { try { build3D(G, api); } catch (e) { console.warn('[ilhas] 3D falhou', e); G.fail = true; } }).catch(() => { G.fail = true; });
    return G;
  }

  /* ════════════════════════════════════════════════════════════════
     física
  ════════════════════════════════════════════════════════════════ */
  function bottomOf(s) { return s.k === 'cyl' ? s.bot : s.y - s.h; }
  /* empurrar o círculo (px,pz,r) para fora do sólido no plano XZ; devolve a normal ou null */
  function pushXZ(s, p) {
    if (s.k === 'cyl') {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), m = s.r + R;
      if (d < m && d > 1e-6) { const k = (m - d); p.x += dx / d * k; p.z += dz / d * k; return [dx / d, dz / d]; }
      return null;
    }
    const hx = s.w / 2, hz = s.d / 2, cx = U.clamp(p.x, s.x - hx, s.x + hx), cz = U.clamp(p.z, s.z - hz, s.z + hz);
    let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d >= R) return null;
    if (d < 1e-6) {
      /* centro dentro do retângulo: sai pelo lado mais perto */
      const l = p.x - (s.x - hx), r = s.x + hx - p.x, f = p.z - (s.z - hz), b = s.z + hz - p.z, mn = Math.min(l, r, f, b);
      if (mn === l) { p.x = s.x - hx - R; return [-1, 0]; } if (mn === r) { p.x = s.x + hx + R; return [1, 0]; }
      if (mn === f) { p.z = s.z - hz - R; return [0, -1]; } p.z = s.z + hz + R; return [0, 1];
    }
    const k = R - d; p.x += dx / d * k; p.z += dz / d * k; return [dx / d, dz / d];
  }
  function overXZ(s, x, z, shrink) {
    if (s.k === 'cyl') return Math.hypot(x - s.x, z - s.z) < s.r + R * (shrink || .3);
    const m = R * (shrink || .3);
    return x > s.x - s.w / 2 - m && x < s.x + s.w / 2 + m && z > s.z - s.d / 2 - m && z < s.z + s.d / 2 + m;
  }

  function input(G) {
    const k = G.keys;
    let mx = (k.ArrowRight || k.d || k.D ? 1 : 0) - (k.ArrowLeft || k.a || k.A ? 1 : 0);
    let mz = (k.ArrowUp || k.w || k.W ? 1 : 0) - (k.ArrowDown || k.s || k.S ? 1 : 0);
    if (G.joy) { mx = G.joy.vx; mz = -G.joy.vy; }
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    return { mx, mz, j: !!(k[' '] || G.btnJ), pound: !!(k.Shift || k.c || k.C || G.btnP) };
  }

  function step(G, dt, api) {
    const p = G.p, I = input(G);
    p.inv = Math.max(0, p.inv - dt); p.coyote = Math.max(0, p.coyote - dt); p.buf = Math.max(0, p.buf - dt);
    p.sq += (0 - p.sq) * Math.min(1, dt * 12);
    if (p.flip > 0) p.flip = Math.max(0, p.flip - dt * 2.4);
    const jp = I.j && !G.holdJ; G.holdJ = I.j;
    if (jp) p.buf = .13;
    /* direção relativa à câmara */
    const yaw = G.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let wx = fx * I.mz + rx * I.mx, wz = fz * I.mz + rz * I.mx;
    const wl = Math.hypot(wx, wz);
    const tvx = wx * SPEED, tvz = wz * SPEED;
    const a = p.on ? (wl > .05 ? ACC : FRIC) : AIR;
    const dvx = tvx - p.vx, dvz = tvz - p.vz, dl = Math.hypot(dvx, dvz), mxs = a * dt;
    if (dl > mxs) { p.vx += dvx / dl * mxs; p.vz += dvz / dl * mxs; } else { p.vx = tvx; p.vz = tvz; }
    if (wl > .1) { const tf = Math.atan2(wx, wz); p.face += U.angDiff(tf, p.face) * Math.min(1, dt * 14); }
    /* salto / duplo salto / bater no chão */
    if (p.buf > 0) {
      if (p.on || p.coyote > 0) { p.vy = JUMP; p.on = false; p.coyote = 0; p.jumps = 1; p.buf = 0; p.sq = -.25; sfx(api, 'jump'); dust(G, p.x, p.y, p.z, 5); p.ground = null; }
      else if (p.jumps < 2 && !p.pound) { p.vy = JUMP2; p.jumps = 2; p.buf = 0; p.flip = 1; sfx(api, 'jump2'); }
    }
    if (!I.j && p.vy > 4.5 && !p.spring) p.vy = Math.max(4.5, p.vy - 60 * dt);   /* salto variável */
    if (I.pound && !p.on && !p.pound && p.vy < 8) { p.pound = true; p.vx *= .2; p.vz *= .2; p.vy = 4; G.poundT = .14; sfx(api, 'pound'); }
    if (p.pound) { if (G.poundT > 0) { G.poundT -= dt; p.vy = 2; p.vx = p.vz = 0; } else p.vy = -26; }
    else p.vy = Math.max(p.vy - GRAV * dt, -32);
    /* plataforma por baixo: arrasta o Pip */
    if (p.on && p.ground && (p.ground.dx || p.ground.dy || p.ground.dz)) { p.x += p.ground.dx; p.y += p.ground.dy; p.z += p.ground.dz; }
    /* horizontal */
    p.x += p.vx * dt; p.z += p.vz * dt;
    G.solids.forEach(s => {
      if (s.gone) return;
      const top = s.y, bot = bottomOf(s);
      if (p.y >= top - .04 || p.y + PH <= bot) return;
      /* degrau baixo: sobe */
      if (top - p.y < .35 && p.on && overXZ(s, p.x, p.z, 1)) { p.y = top; p.ground = s; return; }
      const n = pushXZ(s, p);
      if (n) { const vn = p.vx * n[0] + p.vz * n[1]; if (vn < 0) { p.vx -= vn * n[0]; p.vz -= vn * n[1]; } }
    });
    /* vertical */
    const y0 = p.y; p.y += p.vy * dt;
    let landed = null;
    if (p.vy <= 0) {
      G.solids.forEach(s => {
        if (s.gone) return;
        if (y0 >= s.y - .06 && p.y <= s.y && overXZ(s, p.x, p.z)) { if (!landed || s.y > landed.y) landed = s; }
      });
    } else {
      G.solids.forEach(s => {
        if (s.gone) return;
        const bot = bottomOf(s);
        if (y0 + PH <= bot + .05 && p.y + PH > bot && overXZ(s, p.x, p.z, -.2)) { p.y = bot - PH; p.vy = 0; if (s.crate) breakCrate(G, api, s.crate); }
      });
    }
    const wasOn = p.on;
    if (landed) {
      p.y = landed.y;
      if (!wasOn) { p.sq = Math.min(.35, -p.vy / 60); if (p.vy < -14) dust(G, p.x, p.y, p.z, 8); sfx(api, 'land'); }
      if (p.pound) { p.pound = false; api.shake(6, .2); dust(G, p.x, p.y, p.z, 14); shock(G, api); if (landed.crate) breakCrate(G, api, landed.crate); }
      p.vy = 0; p.on = true; p.jumps = 0; p.ground = landed; p.spring = false;
      if (landed.crumb && !landed.crumb.falling) landed.crumb.st = Math.max(landed.crumb.st, .001);
    } else if (p.on) {
      /* ainda há chão? */
      const g = p.ground;
      if (!g || g.gone || !overXZ(g, p.x, p.z) || Math.abs(p.y - g.y) > .3) { p.on = false; p.coyote = .1; p.ground = null; }
      else p.y = g.y;
    }
    /* molas */
    G.springs.forEach(s => {
      if (p.vy <= 0 && Math.hypot(p.x - s.x, p.z - s.z) < .7 && p.y <= s.y + .75 && p.y >= s.y + .1) {
        p.vy = s.cloud ? 28 : 24; p.on = false; p.ground = null; p.jumps = 1; p.pound = false; p.spring = true; s.anim = 1; p.flip = 1;
        sfx(api, 'spring');
      }
    });
    /* cair ao vazio / lava */
    if (p.y < (G.L.lava != null ? G.L.lava + .2 : -18)) { die(G, api, G.L.lava != null ? 'lava' : 'fall'); }
    p.run += dt * Math.hypot(p.vx, p.vz) * 1.6;
  }

  function hurt(G, api, from) {
    const p = G.p;
    if (p.inv > 0 || G.won || G.dead) return;
    p.hp--; p.inv = 1.6;
    if (from) { const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1; p.vx = dx / d * 8; p.vz = dz / d * 8; }
    p.vy = 8; p.on = false; p.ground = null; p.pound = false;
    api.shake(8, .3); api.vibe([40, 30, 40]); sfx(api, 'hurt');
    if (p.hp <= 0) die(G, api, 'hp');
  }
  function die(G, api, why) {
    if (G.dead || G.won) return;
    G.dead = true; G.deadT = 0; G.deaths++; G.why = why;
    sfx(api, 'die'); api.vibe([60, 40, 90]);
  }
  function respawn(G) {
    const c = G.check, p = G.p;
    Object.assign(p, { x: c.x, y: c.y + .05, z: c.z, vx: 0, vy: 0, vz: 0, on: true, ground: null, hp: 3, inv: 1.5, pound: false, jumps: 0 });
    G.dead = false;
  }
  function shock(G, api) {
    G.enemies.forEach(e => { if (e.alive && e.t === 'slime' && Math.hypot(e.x - G.p.x, e.z - G.p.z) < 2.4 && Math.abs(e.y - G.p.y) < 1) killEnemy(G, api, e); });
  }
  function breakCrate(G, api, c) {
    if (!c.alive) return;
    c.alive = false; c.solid.gone = true;
    if (c.mesh) { c.mesh.visible = false; burst3(G, c.x, c.y + .5, c.z, '#c58a4a', 14); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; G.coins.push({ x: c.x + Math.cos(a) * .6, y: c.y + .7, z: c.z + Math.sin(a) * .6, pop: true, vy: 6, red: false }); if (G.r3) { const cc = G.coins[G.coins.length - 1]; cc.mesh = coinMesh(false); cc.mesh.position.set(cc.x, cc.y, cc.z); G.r3.scene.add(cc.mesh); } }
    sfx(api, 'crate');
    /* estrelas escondidas atrás de caixotes ficam à vista */
    G.stars.forEach(s => { if (s.hide && Math.hypot(s.x - c.x, s.z - c.z) < 2.2) s.hide = false; });
  }
  function killEnemy(G, api, e) {
    e.alive = false; e.dieT = 0; G.kills++;
    burst3(G, e.x, e.y + .4, e.z, '#ffffff', 12);
    sfx(api, 'stomp');
  }

  function world(G, dt, api) {
    const p = G.p;
    /* plataformas móveis e que caem */
    G.solids.forEach(s => {
      if (s.mv) {
        const o = s.mv, k = (Math.sin(G.t * o.sp * 2) + 1) / 2;
        const nx = U.lerp(o.ax, o.bx, k), ny = U.lerp(o.ay, o.by, k), nz = U.lerp(o.az, o.bz, k);
        s.dx = nx - s.x; s.dy = ny - s.y; s.dz = nz - s.z; s.x = nx; s.y = ny; s.z = nz;
        if (o.mesh) o.mesh.position.set(nx, ny - o.h / 2, nz);
      }
      if (s.crumb) {
        const o = s.crumb;
        if (o.st > 0 && !o.falling) { o.st += dt; if (o.mesh) o.mesh.position.x = o.x + Math.sin(G.t * 50) * .04; if (o.st > .55) { o.falling = true; o.fv = 0; sfx(api, 'crumble'); } }
        if (o.falling) { o.fv += 20 * dt; s.y -= o.fv * dt; if (o.mesh) o.mesh.position.y = s.y - o.h / 2; if (s.y < s.y0 - .6) s.gone = true; if (s.y < s.y0 - 30) { o.falling = false; o.st = 0; s.y = s.y0; s.gone = false; if (o.mesh) { o.mesh.position.set(o.x, s.y - o.h / 2, o.z); o.mesh.scale.set(.01, .01, .01); o.grow = 0; } } }
        if (o.mesh && o.grow != null) { o.grow += dt * 3; const k = Math.min(1, o.grow); o.mesh.scale.set(o.w * k, o.h * k, o.d * k); if (k >= 1) o.grow = null; }
      }
    });
    /* moedas */
    G.coins.forEach(c => {
      if (c.got) return;
      if (c.pop) { c.vy -= 20 * dt; c.y += c.vy * dt; const f = G.solids.find(s => !s.gone && overXZ(s, c.x, c.z, -.5) && c.y <= s.y + .5 && c.y >= s.y - .5); if (f && c.vy < 0) { c.y = f.y + .5; c.vy = 0; c.pop = false; } if (c.y < -40) c.got = true; }
      if (Math.hypot(c.x - p.x, c.z - p.z) < .75 && c.y > p.y - .3 && c.y < p.y + PH + .4) {
        c.got = true; if (c.mesh) c.mesh.visible = false;
        if (c.red) { G.reds++; sfx(api, 'red', G.reds); if (G.reds >= G.redTotal) { const rs = G.stars.find(s => s.red); if (rs) { rs.red = false; if (rs.mesh) rs.mesh.visible = true; banner(G, api, 'Estrela das flores azuis!', 'Apareceu no centro'); } } }
        else { G.coinsN++; sfx(api, 'coin'); }
        burst3(G, c.x, c.y, c.z, c.red ? '#93c5fd' : '#fde68a', 6);
      }
      if (c.mesh) { c.mesh.position.set(c.x, c.y + Math.sin(G.t * 3 + c.x) * .08, c.z); c.mesh.rotation.y = G.t * 3 + c.z; }
    });
    /* estrelas */
    G.stars.forEach(s => {
      if (s.got) return;
      if (s.mesh) { s.mesh.visible = !s.red && !s.hidden; s.mesh.rotation.y = G.t * 1.8; s.mesh.position.y = s.y + Math.sin(G.t * 2) * .15; if (s.hide && s.mesh.children[0]) s.mesh.children[0].material.opacity = 1; }
      if (s.red || s.hidden) return;
      if (Math.hypot(s.x - p.x, s.z - p.z) < 1 && s.y > p.y - .5 && s.y < p.y + PH + .8) {
        s.got = true; G.got.add(s.id); if (s.mesh) s.mesh.visible = false;
        burst3(G, s.x, s.y, s.z, '#fde047', 26); sfx(api, 'star');
        api.hitstop(.06);
        banner(G, api, `★ Estrela ${G.got.size}/${G.totalStars}`, s.id === 'r' ? 'Desafio das flores!' : s.high ? 'Bem alto!' : s.hide ? 'Escondida!' : '');
      }
    });
    /* caixotes (malha segue o sólido) */
    /* molas */
    G.springs.forEach(s => { s.anim = Math.max(0, s.anim - dt * 4); if (s.mesh) s.mesh.userData.top.position.y = .6 - Math.sin(s.anim * Math.PI) * .25; });
    /* inimigos */
    G.enemies.forEach(e => {
      if (!e.alive) { if (e.mesh) { e.dieT += dt; e.mesh.scale.set(1 + e.dieT * 2, Math.max(.01, 1 - e.dieT * 4), 1 + e.dieT * 2); if (e.dieT > .3) e.mesh.visible = false; } return; }
      e.ph += dt;
      if (e.t === 'slime') {
        const k = Math.sin(e.ph * .9) * e.range;
        const ox = e.x, oz = e.z;
        if (e.axis === 'z') e.z = e.z0 + k; else e.x = e.x0 + k;
        e.dir = Math.atan2(e.x - ox, e.z - oz);
        if (e.mesh) { e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y = e.dir || 0; const hop = Math.abs(Math.sin(e.ph * 6)); e.mesh.position.y = e.y + hop * .18; e.mesh.userData.body.scale.set(1 + (1 - hop) * .15, .85 - (1 - hop) * .15, 1 + (1 - hop) * .15); }
      } else {
        const k = (Math.sin(e.ph * e.sp * 2) + 1) / 2;
        e.x = U.lerp(e.ax, e.bx, k); e.z = U.lerp(e.az, e.bz, k);
        if (e.mesh) { e.mesh.position.set(e.x, e.y, e.z); e.mesh.userData.ball.rotation.x = e.ph * 4; e.mesh.userData.ball.rotation.z = e.ph * 3; }
      }
      if (G.dead || G.won) return;
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), ey = e.y;
      if (d < .8 && p.y < ey + 1 && p.y + PH > ey) {
        if (e.t === 'slime' && (p.vy < -1 && p.y > ey + .45 || p.pound)) { killEnemy(G, api, e); p.vy = G.holdJ ? 13 : 9; p.pound = false; p.on = false; p.jumps = 1; return; }
        hurt(G, api, e);
      }
    });
    /* barras de fogo */
    G.spinners.forEach(s => {
      s.a += s.sp * dt;
      if (s.mesh) s.mesh.userData.arms.rotation.y = -s.a;
      if (G.dead || G.won || Math.abs(p.y + .5 - s.y) > .8) return;
      (s.two ? [0, Math.PI] : [0]).forEach(a0 => {
        const a = s.a + a0, ex = s.x + Math.cos(a) * s.len, ez = s.z + Math.sin(a) * s.len;
        if (U.segDist(p.x, p.z, s.x, s.z, ex, ez) < R + .25 && Math.hypot(p.x - s.x, p.z - s.z) > .3) hurt(G, api, s);
      });
    });
    /* jatos de fogo */
    G.fires.forEach(f => {
      const c = ((G.t + f.ph) % f.per) / f.per, on = c > .55, warn = c > .4 && !on;
      f.on = on;
      if (f.mesh) { const col = f.mesh.userData.col; col.visible = on || warn; col.scale.set(on ? 1 : .4, on ? 1 + Math.sin(G.t * 30) * .08 : .3, on ? 1 : .4); }
      if (on && !G.dead && Math.hypot(p.x - f.x, p.z - f.z) < .75 && p.y < f.y + 3.2 && p.y >= f.y - .1) hurt(G, api, f);
    });
    /* bandeiras */
    G.checks.forEach(c => { if (!c.on && Math.hypot(p.x - c.x, p.z - c.z) < 1.4 && Math.abs(p.y - c.y) < 1.5) { c.on = true; G.check = c; sfx(api, 'check'); banner(G, api, 'Bandeira!', 'Recomeças daqui'); if (c.mesh) c.mesh.userData.flag.material.color.set('#22c55e'); } if (c.mesh) c.mesh.userData.flag.rotation.y = Math.sin(G.t * 3 + c.x) * .25; });
    /* meta */
    if (G.goal && !G.won && !G.dead && Math.hypot(p.x - G.goal.x, p.z - G.goal.z) < 1.3 && Math.abs(p.y - G.goal.y - .5) < 1.6) win(G, api);
    if (G.goal && G.goal.mesh) { const st = G.goal.mesh.userData.star; st.rotation.y = G.t * 1.5; st.position.y = 2.1 + Math.sin(G.t * 2) * .15; }
  }

  function win(G, api) {
    G.won = true; G.winT = 0;
    const gs = G.stars.find(s => s.goal); gs.got = true; G.got.add('g');
    sfx(api, 'win'); api.vibe([30, 50, 30, 50, 90]);
  }
  function finish(G, api) {
    const L = G.L, sv = save(), rec0 = sv.s[L.id] || { got: [] };
    const all = new Set([...(rec0.got || []), ...G.got]);
    sv.s[L.id] = { got: [...all], best: Math.max(rec0.best || 0, G.coinsN) }; sv.u = Math.max(sv.u || 1, G.li + 2); putSave(sv);
    const score = G.coinsN * 10 + G.got.size * 1000 + Math.max(0, Math.round((L.par - G.time) * 10)) - G.deaths * 200;
    let rec = null;
    try { if (typeof GameProgress !== 'undefined') rec = GameProgress.record('platformer-3d', { won: true, score: Math.max(0, score), mode: L.id, meta: { level: G.li + 1, stars: G.got.size, totalStars: G.totalStars, all: all.size >= G.totalStars } }); } catch (e) {}
    const next = LEVELS[G.li + 1], mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60);
    api.panel({
      icon: next ? '🏝️' : '👑', title: next ? `${L.name} — concluída!` : 'Todas as ilhas salvas!', big: Math.max(0, score),
      sub: (rec && rec.newBest ? '<div class="ak-rec">★ Novo recorde!</div>' : '') + `Estrelas desta ilha: <b>${all.size}/${G.totalStars}</b>`,
      stats: [['Estrelas agora', G.got.size + '/' + G.totalStars], ['Moedas', G.coinsN], ['Tempo', mm + ':' + String(ss).padStart(2, '0')], ['Quedas', G.deaths]],
      buttons: [
        ...(next ? [{ label: '▶ Próxima ilha', primary: true, fn: () => api.play(next.id) }] : []),
        { label: '↺ Repetir (procurar estrelas)', primary: !next, fn: () => api.play(L.id) },
        { label: 'Mapa das ilhas', fn: () => api.menu() },
      ],
    });
  }

  /* ════════════════════════════════════════════════════════════════
     ciclo
  ════════════════════════════════════════════════════════════════ */
  function update(G, dt, api) {
    G.t += dt; G.dtDraw = dt;
    if (G.msgT > 0) G.msgT -= dt;
    if (!G.r3) return;
    if (G.won) {
      G.winT += dt; G.p.face += dt * 8; G.p.vx = G.p.vz = 0;
      if (G.winT > .2 && Math.random() < dt * 8) burst3(G, G.goal.x + U.rand(-2, 2), G.goal.y + U.rand(2, 5), G.goal.z + U.rand(-2, 2), U.pick(['#fde047', '#f472b6', '#60a5fa', '#4ade80']), 16);
      world(G, dt, api);
      if (G.winT > 2.6 && !G.sent) { G.sent = true; finish(G, api); }
      return;
    }
    if (G.dead) { G.deadT += dt; world(G, dt, api); if (G.deadT > 1.1) respawn(G); return; }
    G.time += dt;
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) { step(G, dt / n, api); if (G.dead) break; }
    world(G, dt, api);
    /* câmara: segue por trás quando o Pip corre (se não estiveres a rodá-la) */
    const c = G.cam, p = G.p;
    c.manual = Math.max(0, c.manual - dt);
    const k = G.keys; if (k.q || k.Q) { c.yaw += dt * 2.2; c.manual = 1.5; } if (k.e || k.E) { c.yaw -= dt * 2.2; c.manual = 1.5; }
    const sp = Math.hypot(p.vx, p.vz);
    if (c.manual <= 0 && sp > 2 && p.on) { const behind = Math.atan2(-p.vx, -p.vz); c.yaw += U.angDiff(behind, c.yaw) * Math.min(1, dt * .9) * Math.min(1, sp / SPEED); }
  }

  function draw(G, ctx, W, H, api) {
    const R3 = G.r3;
    if (!R3) { ctx.fillStyle = '#7cc6ff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = "700 15px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.fillText(G.fail ? 'Este jogo precisa de WebGL (3D).' : 'A construir as ilhas…', W / 2, H / 2); return; }
    const cam = R3.cam, p = G.p, c = G.cam;
    Arcade3D.fit(api.stage, cam);
    /* câmara orbital suave */
    const tx = p.x, ty = p.y + 1.2, tz = p.z;
    const cx = tx + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, cy = ty + Math.sin(c.pitch) * c.dist, cz = tz + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist;
    const lk = Math.min(1, .016 * 9);
    c.x += (cx - c.x) * lk; c.y += (cy - c.y) * lk; c.z += (cz - c.z) * lk;
    if (!G.camInit) { c.x = cx; c.y = cy; c.z = cz; G.camInit = true; }
    const [sx, sy] = api.shakeXY;
    cam.position.set(c.x + sx * .02, c.y + sy * .02, c.z);
    cam.lookAt(tx, ty, tz);
    Arcade3D.sunAt(R3.sun, p.x, p.y, p.z, 16, [-.5, 1, .35]);
    /* o Pip */
    const fox = R3.fox, U3 = fox.userData;
    fox.position.set(p.x, p.y, p.z);
    fox.rotation.y = p.face;
    fox.visible = !(p.inv > 0 && Math.floor(G.t * 16) % 2) || G.dead;
    animFox(G, Math.min(.05, G.dtDraw || .016));
    U3.body.rotation.x = p.pound ? (G.poundT > 0 ? -TAU * (1 - G.poundT / .14) : 0) : p.flip > 0 ? -(1 - p.flip) * TAU : 0;
    fox.scale.set(1 - p.sq * .5, 1 + p.sq, 1 - p.sq * .5);
    if (G.dead) { fox.rotation.z = Math.min(Math.PI / 2, G.deadT * 6); }
    else fox.rotation.z = 0;

    /* sombra no chão por baixo */
    let gy = -999;
    G.solids.forEach(s => { if (!s.gone && overXZ(s, p.x, p.z, -.3) && s.y <= p.y + .05 && s.y > gy) gy = s.y; });
    R3.shadow.visible = gy > -999; if (gy > -999) { R3.shadow.position.set(p.x, gy + .02, p.z); const h = p.y - gy; R3.shadow.scale.setScalar(Math.max(.4, 1 - h * .08)); R3.shadow.material.opacity = Math.max(.08, .3 - h * .02); }
    R3.clouds.forEach(cl => { cl.position.x += cl.userData.v * .016; if (cl.position.x > 70) cl.position.x = -70; });
    R3.floaters.forEach(f => { f.m.position.y = f.y0 + Math.sin(G.t * 1.2 + f.ph) * .25; f.m.rotation.y = G.t * .2 + f.ph; });
    if (R3.sunSpr) R3.sunSpr.position.set(cam.position.x - 120, cam.position.y + 95, cam.position.z - 160);
    G.crates.forEach(cr => { if (cr.mesh && cr.alive) cr.mesh.rotation.y = 0; });
    /* faíscas 3D */
    for (let i = R3.fx.length - 1; i >= 0; i--) { const f = R3.fx[i]; f.life -= .016; f.v.y -= .016 * 12; f.m.position.addScaledVector(f.v, .016); f.m.material.opacity = Math.max(0, f.life * 2); if (f.life <= 0) { R3.scene.remove(f.m); f.m.material.dispose(); R3.fx.splice(i, 1); } }
    R3.renderer.render(R3.scene, cam);
    drawUI(G, ctx, W, H, api);
  }

  function burst3(G, x, y, z, col, n) {
    const R3 = G.r3; if (!R3) return;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Sprite(Arcade3D.glowSprite(col).clone()); m.material.transparent = true; m.scale.setScalar(.35);
      m.position.set(x, y, z); R3.scene.add(m);
      R3.fx.push({ m, v: new THREE.Vector3(U.rand(-4, 4), U.rand(2, 7), U.rand(-4, 4)), life: U.rand(.4, .7) });
    }
  }
  function dust(G, x, y, z, n) { burst3(G, x, y + .1, z, G.L.theme === 3 ? '#a8a29e' : '#ffffff', n); }
  function banner(G, api, a, b) { api.banner(a, b); }

  /* ── UI 2D: joystick, botões, dicas ── */
  const pxK = api => api.W / ((api.stage && api.stage.clientWidth) || api.W);
  function btns(G, api) { const k = pxK(api), W = api.W, H = api.H; return [{ id: 'j', x: W - 70 * k, y: H - 78 * k, r: 44 * k, ic: '⤒' }, { id: 'p', x: W - 158 * k, y: H - 58 * k, r: 32 * k, ic: '⬇' }]; }
  function drawUI(G, ctx, W, H, api) {
    const k = pxK(api), p = G.p;
    ctx.save();
    /* corações */
    for (let i = 0; i < 3; i++) { const x = (24 + i * 26) * k, y = 78 * k, on = i < p.hp; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = on ? '#f43f5e' : 'rgba(0,0,0,.35)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-12, -2, -6, -11, 0, -5); ctx.bezierCurveTo(6, -11, 12, -2, 0, 8); ctx.fill(); ctx.stroke(); ctx.restore(); }
    /* flores azuis (quando já apanhaste alguma) */
    if (G.reds > 0 && G.reds < G.redTotal) { ctx.fillStyle = '#bfdbfe'; ctx.font = `800 ${14 * k}px 'Space Grotesk', system-ui`; ctx.textAlign = 'left'; ctx.fillText(`🌼 ${G.reds}/${G.redTotal}`, 104 * k, 84 * k); }
    /* placa com dica perto */
    const sg = G.signs.find(s => Math.hypot(s.x - p.x, s.z - p.z) < 3);
    if (sg && !G.won) { ctx.font = `700 ${14 * k}px 'Space Grotesk', system-ui`; const tw = ctx.measureText(sg.txt).width + 28 * k; ctx.fillStyle = 'rgba(20,20,40,.7)'; U.rr(ctx, (W - tw) / 2, 108 * k, tw, 32 * k, 16 * k); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(sg.txt, W / 2, 129 * k); }
    if (G.touch) {
      if (G.joy) {
        ctx.globalAlpha = .35; ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(G.joy.ox, G.joy.oy, 56 * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = .8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(G.joy.ox + G.joy.vx * 46 * k, G.joy.oy + G.joy.vy * 46 * k, 22 * k, 0, TAU); ctx.fill();
      } else { ctx.globalAlpha = .45; ctx.fillStyle = '#fff'; ctx.font = `700 ${13 * k}px 'Space Grotesk', system-ui`; ctx.textAlign = 'left'; ctx.fillText('◀ arrasta aqui para andar ▶', 18 * k, H - 30 * k); }
      btns(G, api).forEach(b => {
        const on = (b.id === 'j' && G.btnJ) || (b.id === 'p' && G.btnP);
        ctx.globalAlpha = on ? .6 : .32; ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = .85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${b.r * .75}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.ic, b.x, b.y + 1);
      });
      ctx.globalAlpha = 1;
    } else if (G.time < 7 && G.li === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = "700 14px 'Space Grotesk', system-ui"; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6;
      ctx.fillText('WASD/setas andar · Espaço saltar (2× no ar) · Shift bater no chão · arrastar/Q E rodar a câmara', W / 2, H - 22);
    }
    ctx.restore();
  }

  /* entrada: toque (joystick à esquerda, botões e câmara à direita) e rato (arrastar = câmara) */
  function down(G, x, y, api, e) {
    if (e && e.pointerType !== 'mouse') G.touch = true;
    const id = e && e.pointerId != null ? e.pointerId : 1;
    if (G.touch) {
      const b = btns(G, api).find(b => Math.hypot(x - b.x, y - b.y) < b.r * 1.3);
      if (b) { if (b.id === 'j') { G.btnJ = id; } else { G.btnP = id; } return; }
      if (x < api.W * .45 && !G.joy) { G.joy = { id, ox: x, oy: y, vx: 0, vy: 0 }; return; }
    }
    G.camDrag = { id, x, y, yaw: G.cam.yaw, pitch: G.cam.pitch };
  }
  function move(G, x, y, api, e, isDown) {
    const id = e && e.pointerId != null ? e.pointerId : 1, k = pxK(api);
    if (G.joy && G.joy.id === id) { const dx = x - G.joy.ox, dy = y - G.joy.oy, d = Math.hypot(dx, dy), m = 56 * k; G.joy.vx = d > m ? dx / d : dx / m; G.joy.vy = d > m ? dy / d : dy / m; return; }
    if (G.camDrag && G.camDrag.id === id && isDown) { G.cam.yaw = G.camDrag.yaw - (x - G.camDrag.x) / (api.W) * 4.5; G.cam.pitch = U.clamp(G.camDrag.pitch + (y - G.camDrag.y) / api.H * 2, .12, 1.1); G.cam.manual = 2; }
  }
  function up(G, x, y, api, e) {
    const id = e && e.pointerId != null ? e.pointerId : 1;
    if (G.joy && G.joy.id === id) G.joy = null;
    if (G.btnJ === id) G.btnJ = null;
    if (G.btnP === id) G.btnP = null;
    if (G.camDrag && G.camDrag.id === id) G.camDrag = null;
  }
  function key(G, e) { G.keys[e.key] = true; if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return true; }
  function keyup(G, e) { G.keys[e.key] = false; }

  /* ── som ── */
  function sfx(api, k, n) {
    const s = api.sfx;
    if (k === 'jump') s.tone(380, .12, 'triangle', .06, 0, 700);
    else if (k === 'jump2') s.tone(560, .14, 'triangle', .06, 0, 1000);
    else if (k === 'land') s.noise(.06, .03, 0, 500, 'lowpass');
    else if (k === 'coin') { s.tone(1568, .05, 'triangle', .045); s.tone(2093, .09, 'sine', .03, .035); }
    else if (k === 'red') s.tone(523 * Math.pow(2, (n || 0) / 8), .14, 'triangle', .06);
    else if (k === 'star') s.arp([784, 988, 1175, 1568, 1976], .07, .2, 'triangle', .08);
    else if (k === 'spring') s.tone(260, .3, 'sine', .08, 0, 900);
    else if (k === 'stomp') { s.tone(500, .08, 'square', .05, 0, 200); s.noise(.1, .05, 0, 900); }
    else if (k === 'pound') s.tone(300, .15, 'sawtooth', .05, 0, 120);
    else if (k === 'crate') s.noise(.2, .08, 0, 700);
    else if (k === 'hurt') s.tone(220, .25, 'sawtooth', .06, 0, 110);
    else if (k === 'die') s.arp([494, 392, 330, 262], .1, .16, 'triangle', .07);
    else if (k === 'check') s.arp([659, 784, 988], .07, .14, 'triangle', .06);
    else if (k === 'crumble') s.noise(.25, .05, 0, 400);
    else if (k === 'win') s.arp([523, 659, 784, 1047, 1319, 1568], .1, .25, 'triangle', .08);
  }

  /* ── menu: ilhas ── */
  const picker = {
    html() {
      const sv = save();
      return `<style>
.il-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:4px 0}
.il-c{border:0;border-radius:18px;padding:16px 12px;cursor:pointer;color:#fff;font:700 .9rem 'Space Grotesk',system-ui;text-align:left;box-shadow:0 8px 22px rgba(0,0,0,.25);transition:transform .15s;position:relative;overflow:hidden;min-height:110px}
.il-c:hover:not([disabled]){transform:translateY(-3px)}
.il-c[disabled]{opacity:.45;cursor:not-allowed}
.il-c b{display:block;font-size:1.05rem;text-shadow:0 2px 8px rgba(0,0,0,.35)}.il-c small{display:block;opacity:.9;font-weight:600;margin-top:3px}
.il-c i{position:absolute;right:12px;bottom:10px;font-style:normal;letter-spacing:1px;color:#fde047;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.il-c em{position:absolute;right:10px;top:8px;font-size:1.8rem;font-style:normal}
</style><div class="il-grid">${LEVELS.map((l, i) => { const lock = i + 1 > (sv.u || 1), got = ((sv.s[l.id] || {}).got || []).length, th = THEMES[l.theme];
        return `<button class="il-c" data-il="${l.id}" ${lock ? 'disabled' : ''} style="background:linear-gradient(160deg,${th.sky[0]},${th.grass2} 85%)"><em>${lock ? '🔒' : ['🌿', '☁️', '💎', '🌋'][l.theme]}</em><b>${i + 1}. ${l.name}</b><small>${['Saltos, molas e geleias', 'Plataformas móveis e nuvens', 'Barras de fogo e picos', 'Lava e jatos de fogo'][l.theme]}</small><i>${lock ? '' : '★ ' + got + '/5'}</i></button>`; }).join('')}</div>`;
    },
    wire(el, start) { el.querySelectorAll('[data-il]').forEach(b => b.addEventListener('click', () => start(b.dataset.il))); },
  };

  const KIT = ArcadeKit.create({
    id: 'platformer-3d', title: 'Ilhas Flutuantes', icon: '🏝️', accent: '#38bdf8', accent2: '#4ade80', bg: '#7cc6ff', aspect: 'wide', transparent: true, diff: false,
    destroy: G => { if (G.r3) { Arcade3D.disposeOwn(G.r3.scene); Arcade3D.detach(); G.r3 = null; } },
    tagline: 'Uma aventura 3D pelas ilhas do céu: salta, explora e encontra as 5 estrelas de cada ilha.',
    view: { w: 960 }, picker, ready: { title: 'Toca para começar', hint: 'Arrasta para rodar a câmara.' },
    how: [
      '<b>WASD / setas</b> para andar (em relação à câmara), <b>Espaço</b> para saltar — e outra vez no ar para o <b>duplo salto</b>.',
      'Salta em cima das geleias. No ar, <b>Shift</b> (ou C) faz o Pip <b>bater no chão</b>: parte caixotes e derruba inimigos à volta.',
      'Cada ilha tem <b>5 estrelas</b>: a Grande Estrela no fim, uma bem alta, uma escondida atrás de caixotes, uma pelas 8 flores azuis e outra à tua espera. <b>Arrasta</b> (ou Q/E) para rodar a câmara.',
    ],
    controls: ['⌨️ WASD Espaço Shift Q E', '🖱️ arrastar = câmara', '👆 joystick + botões'],
    setup, update, draw, down, move, up, key, keyup,
    begin: (G, api) => { if (matchMedia('(pointer: coarse)').matches) G.touch = true; },
    hud: G => [['Ilha', G.li + 1 + '/' + LEVELS.length], ['Moedas', G.coinsN], ['Estrelas', G.got.size + '/' + G.totalStars]],
    pauseButtons: (G, api) => [{ label: 'Mapa das ilhas', fn: () => api.menu() }],
    achievements: [
      { id: 'isle.1', name: 'Asas de Raposa', icon: '🏝️', desc: 'Conclui a primeira ilha das Ilhas Flutuantes.', test: c => ((c.result.meta || {}).level || 0) >= 1 },
      { id: 'isle.all', name: 'Senhor do Céu', icon: '👑', desc: 'Conclui todas as Ilhas Flutuantes.', test: c => ((c.result.meta || {}).level || 0) >= 4 },
      { id: 'isle.stars', name: 'Céu Estrelado', icon: '⭐', desc: 'Apanha as 5 estrelas de uma ilha.', test: c => !!(c.result.meta || {}).all },
    ],
  });
  KIT._levels = LEVELS;
  return KIT;
})();
