/* ══════════════════════════════════════════════════════════════════
   Torres Impossíveis — níveis.
   Blocos: [x, y, z, cor?, decoração?] (y para cima). Nós = topo livre de
   um bloco. start/goal são nós (a célula onde a Lia está de pé).
   groups: peças que rodam (pivot = célula central, axis 'x'|'y'|'z').
   sliders: peças que deslizam (dir, min..max). plates: botões.
   stairs: { at, dir } — escada na célula `at` a subir na direção dir.
   Cada nível é verificado pelo solucionador (MonoPuzzleGame._solve).
══════════════════════════════════════════════════════════════════ */
const MONO_LEVELS = (function () {
  'use strict';
  /* ajudantes */
  const col = (x, z, y0, y1, c, top) => { const a = []; for (let y = y0; y <= y1; y++) a.push([x, y, z, c, y === y1 ? top : null]); return a; };
  const row = (x0, x1, y, z, c) => { const a = []; for (let x = x0; x <= x1; x++) a.push([x, y, z, c]); return a; };
  const rowz = (x, y, z0, z1, c) => { const a = []; for (let z = z0; z <= z1; z++) a.push([x, y, z, c]); return a; };
  const slab = (x0, x1, y, z0, z1, c) => { const a = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) a.push([x, y, z, c]); return a; };

  return [
    {
      id: 'M1', name: 'O Primeiro Passo', sky: ['#ffd6e8', '#c7d2fe'], par: 12,
      pal: { a: '#f4c2c2', b: '#e7b8d8', c: '#fff7ed', d: '#f9a8d4', goal: '#fde68a', tree: '#a7f3d0', handle: '#f472b6' },
      hint: 'Toca no fim do caminho. Os olhos não te enganam… ou enganam?',
      outro: 'O que parece ligado, está ligado.',
      blocks: [
        ...col(0, 0, -4, -1, '#e2a3c7'), ...row(0, 3, 0, 0, '#f4c2c2'),
        ...col(8, 1, -3, 0, '#c4b5fd'), ...row(5, 8, 1, 1, '#ddd6fe'),
        [3, -1, 0, '#e2a3c7', 'win'], [8, 2, 2, '#ddd6fe', 'dome'],
      ],
      start: [0, 1, 0], goal: [7, 2, 1],
    },
    {
      id: 'M2', name: 'A Ponte que Gira', sky: ['#c7f0e8', '#bfdbfe'], par: 14, parTurns: 1,
      pal: { a: '#9ad7c8', b: '#b5e3d8', c: '#fff7ed', d: '#7dd3fc', goal: '#fde68a', tree: '#86efac', handle: '#f472b6' },
      hint: 'Arrasta a manivela cor-de-rosa (ou toca nela) para rodar a ponte.',
      outro: 'Às vezes o caminho só precisa de uma volta.',
      blocks: [
        ...slab(0, 2, 0, 0, 2, '#9ad7c8'), ...col(1, 1, -4, -1, '#7cc3b3'), [0, 1, 2, '#9ad7c8', 'tree'],
        ...slab(6, 8, 0, 0, 2, '#a5c8f0'), ...col(7, 1, -4, -1, '#8fb4e0'), [8, 1, 0, '#a5c8f0', 'dome'],
        ...col(4, 4, -3, -1, '#e9d5ff'),
      ],
      groups: [{ id: 'ponte', blocks: [...row(3, 5, 0, 1, '#f5d0a9')], pivot: [4, 0, 1], axis: 'y', state: 1, handle: [4, 0, 4] }],
      start: [0, 1, 0], goal: [8, 1, 2],
    },
    {
      id: 'M3', name: 'O Elevador do Faroleiro', sky: ['#fde2c8', '#fbcfe8'], par: 16, parTurns: 1,
      pal: { a: '#f6c7a8', b: '#f3b49a', c: '#fff7ed', d: '#fda4af', goal: '#fde68a', tree: '#a7f3d0', handle: '#ec4899' },
      hint: 'Sobe para o elevador e arrasta o puxador. Lá em cima, olha bem…',
      outro: 'Nem sempre é preciso chegar ao topo.',
      blocks: [
        ...row(0, 3, 0, 0, '#f6c7a8'), ...col(0, 0, -4, -1, '#e8a98a'), [3, -1, 0, '#e8a98a', 'win'],
        ...row(6, 8, 3, 1, '#c4b5fd'), ...col(8, 1, -2, 2, '#a78bfa'), [8, 0, 1, '#a78bfa', 'win'], [8, 4, 2, '#c4b5fd', 'dome'], [8, 3, 2, '#c4b5fd'],
      ],
      sliders: [{ id: 'elev', blocks: [[4, 0, 0, '#fef3c7']], dir: [0, 1, 0], min: 0, max: 4, pos: 0, handle: [4, -1, 1] }],
      start: [0, 1, 0], goal: [8, 4, 1],
    },
    {
      id: 'M4', name: 'O Carrossel', sky: ['#e0e7ff', '#fbcfe8'], par: 14, parTurns: 1,
      pal: { a: '#c7d2fe', b: '#a5b4fc', c: '#fff7ed', d: '#f0abfc', goal: '#fde68a', tree: '#bbf7d0', handle: '#db2777' },
      hint: 'Fica em cima da plataforma e roda-a contigo.',
      outro: 'Quem não se mexe também viaja.',
      blocks: [
        ...row(0, 2, 0, 4, '#c7d2fe'), ...col(0, 4, -3, -1, '#a5b4fc'),
        ...rowz(4, 0, 6, 9, '#f5d0fe'), ...col(4, 9, -3, -1, '#e9a8f5'), [5, 0, 9, '#f5d0fe', 'tree'],
        ...col(4, 4, -4, -1, '#fbcfe8'),
      ],
      groups: [{ id: 'carrossel', blocks: [[3, 0, 4, '#fde68a'], [4, 0, 4, '#fef3c7']], pivot: [4, 0, 4], axis: 'y', state: 0, handle: [6, -1, 6] }],
      start: [0, 1, 4], goal: [4, 1, 9],
    },
    {
      id: 'M5', name: 'A Parede que Deita', sky: ['#d9f99d', '#a5f3fc'], par: 14, parTurns: 1,
      pal: { a: '#bef264', b: '#a3e635', c: '#fff7ed', d: '#67e8f9', goal: '#fde68a', tree: '#4ade80', handle: '#e11d48' },
      hint: 'Uma parede no caminho? Deita-a.',
      outro: 'As paredes também podem ser pontes.',
      blocks: [
        ...row(0, 3, 0, 0, '#bef264'), ...col(1, 0, -4, -1, '#a3e635'),
        ...row(7, 9, 0, 0, '#a5f3fc'), ...col(9, 0, -4, -1, '#67e8f9'), [9, 1, 0, '#a5f3fc', 'flag'],
      ],
      groups: [{ id: 'parede', blocks: [[4, 0, 0, '#fef08a'], [4, 1, 0, '#fde047', 'win'], [4, 2, 0, '#eab308']], pivot: [4, 0, 0], axis: 'z', state: 0, range: [-1, 0], handle: [4, 0, 2] }],
      start: [0, 1, 0], goal: [8, 1, 0],
    },
    {
      id: 'M6', name: 'O Botão do Jardim', sky: ['#fef9c3', '#d9f99d'], par: 20, parTurns: 1,
      pal: { a: '#fde68a', b: '#fcd34d', c: '#fff7ed', d: '#fb923c', goal: '#fef3c7', tree: '#4ade80', plate: '#fb7185', handle: '#e11d48' },
      hint: 'Há um botão no chão. O que fará?',
      outro: 'Um passo no sítio certo move montanhas.',
      blocks: [
        ...slab(0, 2, 0, 0, 2, '#fde68a'), ...col(1, 1, -4, -1, '#f5c451'), [2, 1, 0, '#fde68a', 'tree'],
        ...row(5, 8, 0, 1, '#fdba74'), ...col(8, 1, -4, -1, '#fb923c'), [8, 1, 2, '#fdba74', 'dome'], [8, 0, 2, '#fdba74'],
        [5, 0, 2, '#fdba74', 'tree'],
      ],
      sliders: [{ id: 'ponte', blocks: [[3, -3, 1, '#fecaca', 'winz'], [4, -3, 1, '#fecaca', 'winz']], dir: [0, 1, 0], min: 0, max: 3, pos: 0 }],
      plates: [{ node: [0, 1, 2], act: { id: 'ponte', to: 3 } }],
      start: [0, 1, 0], goal: [8, 1, 1],
    },
    {
      id: 'M7', name: 'O Topo do Mundo', sky: ['#c4b5fd', '#fbcfe8'], par: 24, parTurns: 2,
      pal: { a: '#ddd6fe', b: '#c4b5fd', c: '#fff7ed', d: '#f0abfc', goal: '#fde68a', tree: '#a7f3d0', handle: '#be185d' },
      hint: 'Duas manivelas. Pensa antes de rodar.',
      outro: 'Do topo do mundo, tudo parece ligado.',
      blocks: [
        ...row(0, 3, 0, 0, '#ddd6fe'), ...col(0, 0, -4, -1, '#c4b5fd'),
        ...row(10, 12, 2, 1, '#f5d0fe'), ...col(12, 1, -2, 1, '#e9a8f5'), [12, 3, 2, '#f5d0fe', 'dome'], [12, 2, 2, '#f5d0fe'],
        ...col(5, 3, -4, -1, '#e0e7ff'), ...col(8, 3, -4, -1, '#e0e7ff'),
      ],
      groups: [
        { id: 'r1', blocks: [[4, 0, 0, '#fde68a'], [5, 0, 0, '#fef3c7'], [6, 0, 0, '#fde68a']], pivot: [5, 0, 0], axis: 'y', state: 1, handle: [5, 0, 3] },
        { id: 'r2', blocks: [[8, 1, 1, '#fce7f3'], [9, 1, 1, '#fbcfe8'], [8, 1, 0, '#fbcfe8']], pivot: [8, 1, 1], axis: 'y', state: 2, handle: [8, 0, 3] },
      ],
      start: [0, 1, 0], goal: [11, 3, 1],
    },
    {
      id: 'M8', name: 'A Escada sem Fim', sky: ['#fbcfe8', '#a5b4fc'], par: 20, parTurns: 1,
      pal: { a: '#fecdd3', b: '#fda4af', c: '#fff7ed', d: '#c4b5fd', goal: '#fde68a', tree: '#bbf7d0', handle: '#9d174d' },
      hint: 'Sobe as escadas… e chega lá abaixo.',
      outro: 'Para cima, para baixo — depende de quem olha.',
      blocks: [
        ...row(0, 2, 0, 0, '#fecdd3'), ...col(0, 0, -4, -1, '#fda4af'),
        ...row(4, 5, 1, 0, '#fecdd3'), ...row(7, 8, 2, 0, '#fecdd3'), ...col(8, 0, -4, 1, '#fda4af'), [8, -1, 0, '#fda4af', 'win'],
        ...col(3, 0, -4, 0, '#fda4af'), ...col(6, 0, -4, 1, '#fda4af'),
        [3, -1, -3, '#c4b5fd'], [4, -1, -3, '#c4b5fd'], ...col(3, -3, -5, -2, '#a78bfa'), [2, -1, -3, '#c4b5fd', 'dome'],
      ],
      stairs: [{ at: [3, 1, 0], dir: [1, 0, 0] }, { at: [6, 2, 0], dir: [1, 0, 0] }],
      groups: [{ id: 'rodo', blocks: [[5, -1, -3, '#ddd6fe'], [6, -1, -3, '#ede9fe'], [7, -1, -3, '#ddd6fe']], pivot: [6, -1, -3], axis: 'y', state: 1, handle: [6, -2, -5] }],
      start: [0, 1, 0], goal: [3, 0, -3],
    },
  ];
})();
